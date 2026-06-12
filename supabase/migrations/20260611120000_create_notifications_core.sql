-- Step 6.0 — Notification & reminder data architecture (core tables).
--
-- Adds the device-token registry, per-user/per-circle preferences, the
-- user-visible notification inbox, the service-owned logical delivery queue
-- (notification_outbox), and a PER-DEVICE push delivery table
-- (notification_push_deliveries). Companion files add the SECURITY DEFINER
-- functions (20260611120100) and the care-circle timezone (20260611120200) —
-- apply all three, in order.
--
-- Two-level delivery model (so a user with several devices is tracked correctly):
--   * notification_outbox          — ONE logical job per (notification, channel).
--                                    Fanned out atomically in SQL; never sent
--                                    directly. status: pending → fanned | skipped
--                                    | failed ('fanned' = materialized into
--                                    deliveries, NOT delivered).
--   * notification_push_deliveries — ONE row per (outbox, active device token).
--                                    This is where the external Expo send happens,
--                                    with per-device tickets/receipts, bounded
--                                    retries, and crash recovery. A raw token is
--                                    NEVER stored here (it lives only in
--                                    push_tokens, referenced by id).
--
-- Privacy / trust model (RLS + grants here, enforced in the functions):
--   * push_tokens / notification_preferences / notifications — owner-only SELECT;
--     client writes go through RPCs; no member can read another's rows.
--   * notification_outbox / notification_push_deliveries — service-side ONLY: RLS
--     on with NO permissive policy and all client DML revoked.
--
-- Idempotent / safe to re-run (apply manually via the Sanad Dashboard SQL
-- editor): enums in guarded DO blocks; tables/indexes use if not exists;
-- constraints in pg_constraint-guarded DO blocks; triggers/policies dropped
-- before recreating; revokes/grants are inherently idempotent. Reuses
-- public.set_updated_at(). No raw push token, secret, or health value is ever
-- written to a log by these objects.

-- ── Enums ─────────────────────────────────────────────────────────────────────

do $$
begin
  create type public.notification_type as enum (
    'medication_due',
    'medication_missed',
    'task_due',
    'appointment_upcoming',
    'visit_update',
    'care_update',
    'emergency',
    'system'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.notification_channel as enum ('push');
exception
  when duplicate_object then null;
end
$$;

-- Logical outbox job status. 'fanned' means it was materialized into per-device
-- deliveries — NOT that Expo delivered anything. Actual delivery truth lives only
-- in notification_push_deliveries. (No 'processing'/'sent' here on purpose, so the
-- logical job is never mistaken for a successful push.)
do $$
begin
  create type public.notification_outbox_status as enum (
    'pending', 'fanned', 'skipped', 'failed'
  );
exception
  when duplicate_object then null;
end
$$;

-- Per-device push delivery lifecycle (the unit that is actually sent to Expo).
do $$
begin
  create type public.notification_delivery_status as enum (
    'pending', 'processing', 'sent', 'failed', 'skipped'
  );
exception
  when duplicate_object then null;
end
$$;

-- ── 1. push_tokens ────────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  device_id text,
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.push_tokens'::regclass
      and conname = 'push_tokens_platform_valid'
  ) then
    alter table public.push_tokens
      add constraint push_tokens_platform_valid
      check (platform in ('ios', 'android', 'web'));
  end if;
end
$$;

create index if not exists push_tokens_user_active_idx
  on public.push_tokens (user_id) where is_active;
create index if not exists push_tokens_token_idx on public.push_tokens (expo_push_token);

-- HARD INVARIANT: a raw token can be ACTIVE for at most ONE user at a time. A
-- physical device handed to / re-logged-in by a new account must never deliver to
-- the previous one. register_push_token serializes the handover with a
-- transaction-level advisory lock keyed on the token; this partial unique index is
-- the backstop that makes a concurrent double-activation impossible.
create unique index if not exists push_tokens_active_token_unique
  on public.push_tokens (expo_push_token) where is_active;

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

-- ── 2. notification_preferences ───────────────────────────────────────────────
-- A row with circle_id = null is the user's global default. `timezone` here is
-- the USER's device zone, used only for quiet hours / display — NOT for resolving
-- circle-level schedule wall-clock times (that uses care_circles.timezone).
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  circle_id uuid references public.care_circles(id) on delete cascade,
  medication_reminders boolean not null default true,
  missed_dose_alerts boolean not null default true,
  task_reminders boolean not null default true,
  appointment_reminders boolean not null default true,
  visit_updates boolean not null default true,
  care_updates boolean not null default true,
  emergency_alerts boolean not null default true,
  remote_summary boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, circle_id)
);

create unique index if not exists notification_preferences_user_global_unique
  on public.notification_preferences (user_id)
  where circle_id is null;

create index if not exists notification_preferences_user_idx
  on public.notification_preferences (user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_preferences'::regclass
      and conname = 'notification_preferences_quiet_hours_complete'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_quiet_hours_complete
      check (
        quiet_hours_enabled = false
        or (quiet_hours_start is not null and quiet_hours_end is not null)
      );
  end if;
end
$$;

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

-- ── 3. notifications (user-visible inbox) ─────────────────────────────────────
-- The inbox row may carry useful detail (title/body/data) for the AUTHENTICATED
-- in-app center. The remote Expo payload is generic (see the functions/Edge code)
-- so health detail never reaches a lock screen or provider.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  circle_id uuid references public.care_circles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  deep_link text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  dedupe_key text
);

create unique index if not exists notifications_user_dedupe_unique
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_circle_created_idx
  on public.notifications (circle_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ── 4. notification_outbox (logical fan-out job) ──────────────────────────────
-- One job per (notification, channel). Fanned out atomically by
-- fanout_due_notifications (no persistent 'processing' state → it can never get
-- stuck); attempt_count only guards against a poison row.
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel public.notification_channel not null default 'push',
  status public.notification_outbox_status not null default 'pending',
  available_at timestamptz not null default now(),
  attempt_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, channel)
);

create index if not exists notification_outbox_status_available_idx
  on public.notification_outbox (status, available_at);
create index if not exists notification_outbox_notification_idx
  on public.notification_outbox (notification_id);

drop trigger if exists notification_outbox_set_updated_at on public.notification_outbox;
create trigger notification_outbox_set_updated_at
before update on public.notification_outbox
for each row execute function public.set_updated_at();

-- ── 5. notification_push_deliveries (per-device send) ─────────────────────────
-- One row per (outbox job, active device token). This is the unit the outbox
-- processor claims + sends, and where Expo tickets/receipts and per-device retry
-- live. The raw token is NOT stored here — push_token_id references push_tokens.
create table if not exists public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  push_token_id uuid not null references public.push_tokens(id) on delete cascade,
  status public.notification_delivery_status not null default 'pending',
  available_at timestamptz not null default now(),
  attempt_count int not null default 0,
  locked_at timestamptz,
  -- Claim lease: each successful claim/reclaim stamps a fresh random token; the
  -- result recorders only write if it still matches, so a stale worker that wakes
  -- after its lock expired cannot overwrite a newer worker's result.
  claim_token uuid,
  sent_at timestamptz,
  expo_ticket_id text,
  receipt_id text,
  receipt_status text,
  error_code text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outbox_id, push_token_id)
);

-- Defensive idempotency: if the table predates this column on a partial apply.
alter table public.notification_push_deliveries
  add column if not exists claim_token uuid;

-- Due pending + stale-processing recovery scans.
create index if not exists notification_push_deliveries_status_available_idx
  on public.notification_push_deliveries (status, available_at);
create index if not exists notification_push_deliveries_status_locked_idx
  on public.notification_push_deliveries (status, locked_at);
create index if not exists notification_push_deliveries_token_idx
  on public.notification_push_deliveries (push_token_id);
-- Receipt-checking scan: sent rows still missing a receipt.
create index if not exists notification_push_deliveries_receipt_pending_idx
  on public.notification_push_deliveries (status) where receipt_status is null;

drop trigger if exists notification_push_deliveries_set_updated_at on public.notification_push_deliveries;
create trigger notification_push_deliveries_set_updated_at
before update on public.notification_push_deliveries
for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.push_tokens enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_push_deliveries enable row level security;

-- push_tokens: owner-only SELECT; writes via RPC.
drop policy if exists "Users can view their own push tokens" on public.push_tokens;
create policy "Users can view their own push tokens"
on public.push_tokens
for select
to authenticated
using (user_id = auth.uid());
revoke insert, update, delete on public.push_tokens from anon, authenticated;

-- notification_preferences: owner-only SELECT; writes via upsert RPC.
drop policy if exists "Users can view their own notification preferences" on public.notification_preferences;
create policy "Users can view their own notification preferences"
on public.notification_preferences
for select
to authenticated
using (user_id = auth.uid());
revoke insert, update, delete on public.notification_preferences from anon, authenticated;

-- notifications: a row is visible only to its recipient AND, for circle-linked
-- rows, only while they are an ACTIVE member of that circle. A user removed from a
-- circle immediately loses read access to that circle's historical notifications
-- (the rows are KEPT, not deleted — history is preserved). Global/system rows
-- (circle_id is null) stay visible to their user. Rejoining/reactivation restores
-- visibility of that user's own historical circle rows (an accepted, documented
-- trade-off — the rows were always theirs). Uses the SECURITY DEFINER membership
-- helper to avoid RLS recursion. No client writes (server creates; read-state via
-- the lease/membership-checked RPCs).
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
  and (circle_id is null or public.is_active_user_circle_member(circle_id, auth.uid()))
);
revoke insert, update, delete on public.notifications from anon, authenticated;

-- outbox + deliveries: service-side only — RLS on, no policy, all client DML
-- revoked. service_role bypasses RLS; the SECURITY DEFINER functions run as owner.
revoke all on public.notification_outbox from anon, authenticated;
revoke all on public.notification_push_deliveries from anon, authenticated;

notify pgrst, 'reload schema';
