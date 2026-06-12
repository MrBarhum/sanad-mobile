-- =============================================================================
-- Sanad — Step 6.0: Notifications & Reminder Engine — COMPLETE DASHBOARD SQL
-- (production-hardened: care-circle timezone, send-CLAIM revalidation with a
--  per-device claim LEASE, source-event validity, stale-processing recovery,
--  membership-scoped notification reads, one-active-token invariant, explicit
--  role allow-list, per-device deliveries, generic remote payload)
-- =============================================================================
-- Apply this entire file ONCE in the Sanad Supabase Dashboard → SQL Editor.
-- Idempotent and safe to re-run. DO NOT apply with the Supabase CLI (shared
-- account). No secrets, project URLs, or placeholders appear in this file.
--
-- Privacy: the notifications SELECT policy requires ACTIVE circle membership for
-- circle-linked rows (a removed member loses read access; history is kept), and
-- the read-state RPCs enforce the same. Send-time safety: every per-device
-- claim/reclaim REVALIDATES authorization AND that the SOURCE care event still
-- requires the notification (notification_source_validity), and stamps a
-- claim_token LEASE so a stale worker can never overwrite a newer result.
--
-- Order: prerequisites → PART 1 core tables → PART 2 functions → PART 3 circle
-- timezone.
--
-- Source migrations concatenated here, in order:
--   1) supabase/migrations/20260611120000_create_notifications_core.sql
--   2) supabase/migrations/20260611120100_create_notification_functions.sql
--   3) supabase/migrations/20260611120200_add_care_circle_timezone.sql
-- =============================================================================

-- ── Prerequisite re-asserts (no-ops if they already exist) ───────────────────
create or replace function public.is_active_user_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.user_id = p_user_id and cm.status = 'active'
  );
$$;
revoke all on function public.is_active_user_circle_member(uuid, uuid) from public;
grant execute on function public.is_active_user_circle_member(uuid, uuid) to authenticated;

create or replace function public.active_circle_member_role(p_circle_id uuid)
returns public.circle_role
language sql
stable
security definer
set search_path = ''
as $$
  select cm.role
  from public.circle_members cm
  where cm.circle_id = p_circle_id and cm.user_id = auth.uid() and cm.status = 'active'
  limit 1;
$$;
revoke all on function public.active_circle_member_role(uuid) from public;
grant execute on function public.active_circle_member_role(uuid) to authenticated;


-- =============================================================================
-- PART 1 / 3 — Core tables, enums, indexes, constraints, triggers, RLS
-- (from 20260611120000_create_notifications_core.sql)
-- =============================================================================

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


-- =============================================================================
-- PART 2 / 3 — SECURITY DEFINER functions (enqueue / source-validity / fan-out +
-- materialize / per-device claim WITH send-time + source revalidation + lease +
-- crash recovery / lease-guarded recorders / retention sweep / token invalidation)
-- (from 20260611120100_create_notification_functions.sql)
-- =============================================================================

-- Step 6.0 — Notification & reminder functions (the sensitive operations).
--
-- Companion to 20260611120000_create_notifications_core.sql (apply that first).
-- Every function is SECURITY DEFINER with `set search_path = ''` and every object
-- schema-qualified. EXECUTE is revoked from public, then granted to the narrowest
-- role: `authenticated` (client-callable: own token/prefs/read-state) or
-- `service_role` (server-only: resolve recipients, enqueue, fan-out + REVALIDATE,
-- claim per-device deliveries, record results, invalidate tokens). A normal
-- member can never send a notification to an arbitrary recipient/title/body.
--
-- Authorization is revalidated at DELIVERY time (in fanout_due_notifications), not
-- only at enqueue, because a push may be deferred for hours. That keeps all the
-- authorization rules in ONE server-side place.
--
-- Idempotent / safe to re-run: every function is create-or-replace with
-- re-asserted revoke/grant.

-- ── is_valid_timezone ─────────────────────────────────────────────────────────
create or replace function public.is_valid_timezone(p_tz text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_tz);
$$;

revoke all on function public.is_valid_timezone(text) from public;
grant execute on function public.is_valid_timezone(text) to authenticated, service_role;

-- ── notification_defer_until ──────────────────────────────────────────────────
-- Earliest time a non-emergency push may go out, given the recipient's timezone +
-- quiet-hours window (handles windows crossing midnight). Emergencies / disabled
-- windows return p_now unchanged.
create or replace function public.notification_defer_until(
  p_now timestamptz,
  p_timezone text,
  p_quiet_hours_enabled boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_is_emergency boolean
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_local timestamp;
  v_local_time time;
  v_local_date date;
begin
  if coalesce(p_is_emergency, false)
     or not coalesce(p_quiet_hours_enabled, false)
     or p_quiet_hours_start is null
     or p_quiet_hours_end is null
     or p_quiet_hours_start = p_quiet_hours_end then
    return p_now;
  end if;

  v_local := p_now at time zone v_tz;
  v_local_time := v_local::time;
  v_local_date := v_local::date;

  if p_quiet_hours_start < p_quiet_hours_end then
    if v_local_time >= p_quiet_hours_start and v_local_time < p_quiet_hours_end then
      return ((v_local_date::text || ' ' || p_quiet_hours_end::text)::timestamp) at time zone v_tz;
    end if;
    return p_now;
  else
    if v_local_time >= p_quiet_hours_start then
      return (((v_local_date + 1)::text || ' ' || p_quiet_hours_end::text)::timestamp) at time zone v_tz;
    elsif v_local_time < p_quiet_hours_end then
      return ((v_local_date::text || ' ' || p_quiet_hours_end::text)::timestamp) at time zone v_tz;
    end if;
    return p_now;
  end if;
end;
$$;

revoke all on function public.notification_defer_until(timestamptz, text, boolean, time, time, boolean) from public;
grant execute on function public.notification_defer_until(timestamptz, text, boolean, time, time, boolean) to service_role;

-- ── effective_notification_prefs ──────────────────────────────────────────────
-- Circle-specific over global over defaults, per field. `timezone` here is the
-- USER's zone (quiet hours / display), never the circle's schedule zone.
create or replace function public.effective_notification_prefs(
  p_user_id uuid,
  p_circle_id uuid
)
returns table (
  medication_reminders boolean,
  missed_dose_alerts boolean,
  task_reminders boolean,
  appointment_reminders boolean,
  visit_updates boolean,
  care_updates boolean,
  emergency_alerts boolean,
  remote_summary boolean,
  quiet_hours_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.notification_preferences%rowtype;
  g public.notification_preferences%rowtype;
begin
  if p_circle_id is not null then
    select * into c from public.notification_preferences np
    where np.user_id = p_user_id and np.circle_id = p_circle_id;
  end if;
  select * into g from public.notification_preferences np
  where np.user_id = p_user_id and np.circle_id is null;

  return query select
    coalesce(c.medication_reminders,  g.medication_reminders,  true),
    coalesce(c.missed_dose_alerts,    g.missed_dose_alerts,    true),
    coalesce(c.task_reminders,        g.task_reminders,        true),
    coalesce(c.appointment_reminders, g.appointment_reminders, true),
    coalesce(c.visit_updates,         g.visit_updates,         true),
    coalesce(c.care_updates,          g.care_updates,          true),
    coalesce(c.emergency_alerts,      g.emergency_alerts,      true),
    coalesce(c.remote_summary,        g.remote_summary,        true),
    coalesce(c.quiet_hours_enabled,   g.quiet_hours_enabled,   false),
    coalesce(c.quiet_hours_start,     g.quiet_hours_start),
    coalesce(c.quiet_hours_end,       g.quiet_hours_end),
    coalesce(nullif(c.timezone, ''),  nullif(g.timezone, ''),  'UTC');
end;
$$;

revoke all on function public.effective_notification_prefs(uuid, uuid) from public;
grant execute on function public.effective_notification_prefs(uuid, uuid) to service_role;

-- ── notification_recipient_eligible ───────────────────────────────────────────
-- The single source of the recipient-role + preference matrix, used by BOTH
-- recipient resolution (enqueue side) and revalidation (delivery side) so they can
-- never drift. True when the user's active role is eligible for the type AND the
-- effective preference for that type is on.
--   * remote_member is a follow-up role: NOT eligible for the operational
--     reminders medication_due / task_due (the people doing care), but eligible
--     (per prefs) for missed-dose, appointment, visit, care-update, emergency.
--   * caregiver / elder are not special-cased (and are unassignable).
create or replace function public.notification_recipient_eligible(
  p_user_id uuid,
  p_circle_id uuid,
  p_type public.notification_type
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.circle_role;
  prefs record;
  v_pref boolean;
begin
  if p_circle_id is not null then
    select cm.role into v_role
    from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.user_id = p_user_id and cm.status = 'active';
    -- Explicit allow-list of CURRENTLY supported recipient roles. caregiver / elder
    -- (deferred least-privilege roles) and any null/unknown role are rejected — so
    -- even an OLD database membership carrying such a role stays safe, not only
    -- newly-assigned ones. Do not rely on assignment-time rejection alone.
    if v_role is null
       or v_role not in ('admin', 'primary_caregiver', 'family_member', 'remote_member') then
      return false;
    end if;
    -- remote_member is a follow-up role: never the operational reminders.
    if v_role = 'remote_member' and p_type in ('medication_due', 'task_due') then
      return false;
    end if;
  end if;

  select * into prefs from public.effective_notification_prefs(p_user_id, p_circle_id);
  v_pref := case p_type
    when 'medication_due' then prefs.medication_reminders
    when 'medication_missed' then prefs.missed_dose_alerts
    when 'task_due' then prefs.task_reminders
    when 'appointment_upcoming' then prefs.appointment_reminders
    when 'visit_update' then prefs.visit_updates
    when 'care_update' then prefs.care_updates
    when 'emergency' then prefs.emergency_alerts
    when 'system' then true
    else true
  end;
  return coalesce(v_pref, true);
end;
$$;

revoke all on function public.notification_recipient_eligible(uuid, uuid, public.notification_type) from public;
grant execute on function public.notification_recipient_eligible(uuid, uuid, public.notification_type) to service_role;

-- ── circle_notification_recipients ────────────────────────────────────────────
-- Active members of a circle eligible for a type (via notification_recipient_
-- eligible), with each recipient's resolved timezone + quiet-hours window (used
-- only for deferral).
create or replace function public.circle_notification_recipients(
  p_circle_id uuid,
  p_type public.notification_type
)
returns table (
  user_id uuid,
  timezone text,
  quiet_hours_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cm.user_id,
    ep.timezone,
    ep.quiet_hours_enabled,
    ep.quiet_hours_start,
    ep.quiet_hours_end
  from public.circle_members cm
  cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
  where cm.circle_id = p_circle_id
    and cm.status = 'active'
    and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
$$;

revoke all on function public.circle_notification_recipients(uuid, public.notification_type) from public;
grant execute on function public.circle_notification_recipients(uuid, public.notification_type) to service_role;

-- ── enqueue_notification (service-only creation + outbox job) ─────────────────
-- Creates the inbox row de-duped on (user_id, dedupe_key) and, only for a NEW
-- row, the logical outbox job (quiet-hours-aware initial available_at). Deliveries
-- are NOT created here — they are materialized at fan-out from the CURRENT active
-- tokens. Reserved to service_role.
create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_circle_id uuid default null,
  p_data jsonb default '{}'::jsonb,
  p_deep_link text default null,
  p_dedupe_key text default null,
  p_expires_at timestamptz default null,
  p_timezone text default 'UTC',
  p_quiet_hours_enabled boolean default false,
  p_quiet_hours_start time default null,
  p_quiet_hours_end time default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_available timestamptz;
begin
  if p_user_id is null then
    raise exception 'recipient is required' using errcode = '22023';
  end if;
  if p_circle_id is not null
     and not public.is_active_user_circle_member(p_circle_id, p_user_id) then
    return null;
  end if;

  insert into public.notifications (
    user_id, circle_id, type, title, body, data, deep_link, dedupe_key, expires_at
  )
  values (
    p_user_id, p_circle_id, p_type, p_title, p_body,
    coalesce(p_data, '{}'::jsonb), p_deep_link, p_dedupe_key, p_expires_at
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null
  do nothing
  returning id into v_id;

  if v_id is null then
    return null;
  end if;

  v_available := public.notification_defer_until(
    now(), p_timezone, p_quiet_hours_enabled,
    p_quiet_hours_start, p_quiet_hours_end, p_type = 'emergency'
  );

  insert into public.notification_outbox (notification_id, user_id, channel, status, available_at)
  values (v_id, p_user_id, 'push', 'pending', v_available)
  on conflict (notification_id, channel) do nothing;

  return v_id;
end;
$$;

revoke all on function public.enqueue_notification(
  uuid, public.notification_type, text, text, uuid, jsonb, text, text, timestamptz, text, boolean, time, time
) from public;
grant execute on function public.enqueue_notification(
  uuid, public.notification_type, text, text, uuid, jsonb, text, text, timestamptz, text, boolean, time, time
) to service_role;

-- ── register_push_token (client) ──────────────────────────────────────────────
create or replace function public.register_push_token(
  p_token text,
  p_platform text,
  p_device_id text default null,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_token is null or btrim(p_token) = '' then
    raise exception 'a push token is required' using errcode = '22023';
  end if;
  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid platform' using errcode = '22023';
  end if;

  -- Serialize every registration of THIS raw token so the deactivate-others +
  -- upsert below is atomic per token: two concurrent registrations of the same
  -- device token cannot both end active. The transaction-level advisory lock is
  -- released at commit; the push_tokens_active_token_unique partial index is the
  -- hard backstop if a path ever skips this lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_token)::bigint);

  update public.push_tokens
    set is_active = false
    where expo_push_token = p_token and user_id <> v_uid and is_active;

  insert into public.push_tokens (
    user_id, expo_push_token, platform, device_id, app_version, is_active, last_seen_at
  )
  values (v_uid, p_token, p_platform, p_device_id, p_app_version, true, now())
  on conflict (user_id, expo_push_token) do update
    set platform = excluded.platform,
        device_id = excluded.device_id,
        app_version = excluded.app_version,
        is_active = true,
        last_seen_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_push_token(text, text, text, text) from public;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;

-- ── deactivate_push_token (client, e.g. on logout) ────────────────────────────
create or replace function public.deactivate_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  update public.push_tokens
    set is_active = false
    where user_id = v_uid and expo_push_token = p_token;
end;
$$;

revoke all on function public.deactivate_push_token(text) from public;
grant execute on function public.deactivate_push_token(text) to authenticated;

-- ── upsert_notification_preferences (client) ──────────────────────────────────
create or replace function public.upsert_notification_preferences(
  p_circle_id uuid,
  p_medication_reminders boolean,
  p_missed_dose_alerts boolean,
  p_task_reminders boolean,
  p_appointment_reminders boolean,
  p_visit_updates boolean,
  p_care_updates boolean,
  p_emergency_alerts boolean,
  p_remote_summary boolean,
  p_quiet_hours_enabled boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_timezone text
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.notification_preferences;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_circle_id is not null
     and not public.is_active_user_circle_member(p_circle_id, v_uid) then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if p_timezone is not null and p_timezone <> '' and not public.is_valid_timezone(p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  if coalesce(p_quiet_hours_enabled, false)
     and (p_quiet_hours_start is null or p_quiet_hours_end is null) then
    raise exception 'quiet hours require a start and end' using errcode = '22023';
  end if;

  update public.notification_preferences np
    set medication_reminders  = coalesce(p_medication_reminders, np.medication_reminders),
        missed_dose_alerts    = coalesce(p_missed_dose_alerts, np.missed_dose_alerts),
        task_reminders        = coalesce(p_task_reminders, np.task_reminders),
        appointment_reminders = coalesce(p_appointment_reminders, np.appointment_reminders),
        visit_updates         = coalesce(p_visit_updates, np.visit_updates),
        care_updates          = coalesce(p_care_updates, np.care_updates),
        emergency_alerts      = coalesce(p_emergency_alerts, np.emergency_alerts),
        remote_summary        = coalesce(p_remote_summary, np.remote_summary),
        quiet_hours_enabled   = coalesce(p_quiet_hours_enabled, np.quiet_hours_enabled),
        quiet_hours_start     = p_quiet_hours_start,
        quiet_hours_end       = p_quiet_hours_end,
        timezone              = coalesce(nullif(p_timezone, ''), np.timezone)
    where np.user_id = v_uid
      and np.circle_id is not distinct from p_circle_id
    returning * into v_row;

  if not found then
    insert into public.notification_preferences (
      user_id, circle_id, medication_reminders, missed_dose_alerts, task_reminders,
      appointment_reminders, visit_updates, care_updates, emergency_alerts, remote_summary,
      quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone
    )
    values (
      v_uid, p_circle_id,
      coalesce(p_medication_reminders, true),
      coalesce(p_missed_dose_alerts, true),
      coalesce(p_task_reminders, true),
      coalesce(p_appointment_reminders, true),
      coalesce(p_visit_updates, true),
      coalesce(p_care_updates, true),
      coalesce(p_emergency_alerts, true),
      coalesce(p_remote_summary, true),
      coalesce(p_quiet_hours_enabled, false),
      p_quiet_hours_start, p_quiet_hours_end,
      nullif(p_timezone, '')
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text
) from public;
grant execute on function public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text
) to authenticated;

-- ── set_notification_read / mark_all_notifications_read (client) ──────────────
create or replace function public.set_notification_read(p_notification_id uuid, p_read boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  -- Only rows the user can actually SEE (mirrors the SELECT policy): their own AND,
  -- for circle-linked rows, only while an active member. A notification for a
  -- circle the user was removed from can't be mutated through this definer.
  update public.notifications
    set read_at = case when p_read then coalesce(read_at, now()) else null end
    where id = p_notification_id
      and user_id = v_uid
      and (circle_id is null or public.is_active_user_circle_member(circle_id, v_uid));
end;
$$;

revoke all on function public.set_notification_read(uuid, boolean) from public;
grant execute on function public.set_notification_read(uuid, boolean) to authenticated;

create or replace function public.mark_all_notifications_read(p_circle_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  update public.notifications
    set read_at = now()
    where user_id = v_uid
      and read_at is null
      and (p_circle_id is null or circle_id = p_circle_id)
      -- Only rows the user can SEE (active member for circle-linked rows).
      and (circle_id is null or public.is_active_user_circle_member(circle_id, v_uid));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read(uuid) from public;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

-- ── notification_source_validity (service) — is the care event still due? ─────
-- A push can sit queued / quiet-hours-deferred while its SOURCE changes. This is
-- the single authoritative check that the underlying care event still warrants the
-- notification, using ONLY the immutable occurrence context stored in
-- notifications.data (no sensitive names/values needed). Returns (valid, reason);
-- reason is a safe machine-readable code (never source detail). Called from BOTH
-- fanout_due_notifications and (authoritatively) claim_push_deliveries. Types
-- without a concrete source identifier (visit_update / care_update / emergency /
-- system) are always valid. A row missing its occurrence context is treated as
-- valid ('no_source_context') so legacy rows are never silently dropped.
create or replace function public.notification_source_validity(p_notification_id uuid)
returns table (valid boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n public.notifications%rowtype;
  v_schedule_id uuid;
  v_dose_date date;
  v_scheduled_time time;
  v_sched public.medication_schedules%rowtype;
  v_med_active boolean;
  v_weekday integer;
  v_task public.care_tasks%rowtype;
  v_due_date date;
  v_due_time time;
  v_appt public.care_appointments%rowtype;
  v_starts_at timestamptz;
begin
  select * into n from public.notifications nn where nn.id = p_notification_id;
  if not found then
    return query select false, 'no_notification'; return;
  end if;

  if n.type in ('medication_due', 'medication_missed') then
    v_schedule_id := nullif(n.data ->> 'scheduleId', '')::uuid;
    v_dose_date := nullif(n.data ->> 'doseDate', '')::date;
    v_scheduled_time := nullif(n.data ->> 'scheduledTime', '')::time;
    if v_schedule_id is null or v_dose_date is null or v_scheduled_time is null then
      return query select true, 'no_source_context'; return;
    end if;

    select * into v_sched from public.medication_schedules ms where ms.id = v_schedule_id;
    if not found or not v_sched.is_active then
      return query select false, 'schedule_inactive'; return;
    end if;
    select m.is_active into v_med_active from public.medications m where m.id = v_sched.medication_id;
    if v_med_active is null or not v_med_active then
      return query select false, 'medication_inactive'; return;
    end if;

    -- Occurrence must still be a real slot of the (possibly edited) schedule.
    -- extract(dow) is 0=Sunday..6=Saturday, matching days_of_week (JS getDay()).
    v_weekday := extract(dow from v_dose_date)::integer;
    if not (v_weekday = any (v_sched.days_of_week))
       or not (v_scheduled_time = any (v_sched.times))
       or v_dose_date < v_sched.start_date
       or (v_sched.end_date is not null and v_dose_date > v_sched.end_date) then
      return query select false, 'occurrence_changed'; return;
    end if;

    -- Recorded since enqueue? (true for a due reminder AND for a late missed dose.)
    if exists (
      select 1 from public.medication_logs ml
      where ml.schedule_id = v_schedule_id
        and ml.dose_date = v_dose_date
        and ml.scheduled_time = v_scheduled_time
    ) then
      return query select false, 'dose_recorded'; return;
    end if;

    return query select true, 'ok'; return;

  elsif n.type = 'task_due' then
    if nullif(n.data ->> 'taskId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_task from public.care_tasks t where t.id = (n.data ->> 'taskId')::uuid;
    if not found then
      return query select false, 'task_missing'; return;
    end if;
    if v_task.status <> 'open' then
      return query select false, 'task_closed'; return;
    end if;
    -- Rescheduled? Compare the CURRENT due date/time to the occurrence that
    -- produced this notification (dueTime is the task's raw time, null = date-only).
    v_due_date := nullif(n.data ->> 'dueDate', '')::date;
    v_due_time := nullif(n.data ->> 'dueTime', '')::time;
    if v_task.due_date is distinct from v_due_date
       or v_task.due_time is distinct from v_due_time then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  elsif n.type = 'appointment_upcoming' then
    if nullif(n.data ->> 'appointmentId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_appt from public.care_appointments a where a.id = (n.data ->> 'appointmentId')::uuid;
    if not found then
      return query select false, 'appointment_missing'; return;
    end if;
    if v_appt.status <> 'scheduled' then
      return query select false, 'appointment_closed'; return;
    end if;
    v_starts_at := nullif(n.data ->> 'startsAt', '')::timestamptz;
    if v_appt.starts_at is distinct from v_starts_at then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  else
    -- No concrete validatable source identifier — keep existing behavior.
    return query select true, 'ok'; return;
  end if;
end;
$$;

revoke all on function public.notification_source_validity(uuid) from public;
grant execute on function public.notification_source_validity(uuid) to service_role;

-- ── fanout_due_notifications (service) — REVALIDATE + materialize deliveries ──
-- Atomically processes due outbox jobs. For each, it RE-VALIDATES at delivery
-- time (expiry, recipient exists, still an active member, role + preference still
-- eligible) and RE-DEFERS for quiet hours configured since enqueue. Only then does
-- it materialize one delivery per CURRENT active device token. Because all of this
-- runs in one transaction, a crash rolls back cleanly (no stuck 'processing'
-- outbox); FOR UPDATE SKIP LOCKED lets multiple workers fan out different jobs.
-- A per-row sub-transaction isolates a poison row (counts an attempt; terminal
-- 'failed' at the cap). Returns counts.
create or replace function public.fanout_due_notifications(
  p_limit integer default 100,
  p_max_attempts integer default 5
)
returns table (fanned integer, skipped integer, deferred integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n public.notifications%rowtype;
  prefs record;
  v_defer timestamptz;
  v_active_tokens integer;
  v_src_valid boolean;
  v_src_reason text;
  v_fanned integer := 0;
  v_skipped integer := 0;
  v_deferred integer := 0;
begin
  for r in
    select o.id as outbox_id, o.notification_id, o.user_id
    from public.notification_outbox o
    where o.status = 'pending' and o.available_at <= now()
    order by o.available_at asc
    for update skip locked
    limit greatest(p_limit, 1)
  loop
    begin
      select * into n from public.notifications nn where nn.id = r.notification_id;
      if not found then
        update public.notification_outbox set status = 'skipped', last_error = 'no_notification' where id = r.outbox_id;
        v_skipped := v_skipped + 1; continue;
      end if;

      if n.expires_at is not null and n.expires_at <= now() then
        update public.notification_outbox set status = 'skipped', last_error = 'expired' where id = r.outbox_id;
        v_skipped := v_skipped + 1; continue;
      end if;

      if not exists (select 1 from public.profiles p where p.id = r.user_id) then
        update public.notification_outbox set status = 'skipped', last_error = 'no_recipient' where id = r.outbox_id;
        v_skipped := v_skipped + 1; continue;
      end if;

      if n.circle_id is not null and not public.is_active_user_circle_member(n.circle_id, r.user_id) then
        update public.notification_outbox set status = 'skipped', last_error = 'not_member' where id = r.outbox_id;
        v_skipped := v_skipped + 1; continue;
      end if;

      if not public.notification_recipient_eligible(r.user_id, n.circle_id, n.type) then
        update public.notification_outbox set status = 'skipped', last_error = 'not_eligible' where id = r.outbox_id;
        v_skipped := v_skipped + 1; continue;
      end if;

      -- Does the source CARE EVENT still require this notification? (dose recorded,
      -- schedule/medication inactive, occurrence no longer in the schedule, task
      -- closed/rescheduled, appointment cancelled/rescheduled, …)
      select sv.valid, sv.reason into v_src_valid, v_src_reason
      from public.notification_source_validity(n.id) sv;
      if not coalesce(v_src_valid, true) then
        update public.notification_outbox
          set status = 'skipped', last_error = coalesce(v_src_reason, 'source_invalid')
          where id = r.outbox_id;
        v_skipped := v_skipped + 1; continue;
      end if;

      -- Quiet hours configured/changed since enqueue → re-defer (non-emergency).
      select * into prefs from public.effective_notification_prefs(r.user_id, n.circle_id);
      v_defer := public.notification_defer_until(
        now(), prefs.timezone, prefs.quiet_hours_enabled,
        prefs.quiet_hours_start, prefs.quiet_hours_end, n.type = 'emergency'
      );
      if v_defer > now() then
        update public.notification_outbox set available_at = v_defer where id = r.outbox_id;
        v_deferred := v_deferred + 1; continue;
      end if;

      -- Materialize one delivery per currently-active device token.
      insert into public.notification_push_deliveries (outbox_id, push_token_id, status, available_at)
      select r.outbox_id, pt.id, 'pending', now()
      from public.push_tokens pt
      where pt.user_id = r.user_id and pt.is_active
      on conflict (outbox_id, push_token_id) do nothing;

      select count(*) into v_active_tokens
      from public.push_tokens pt where pt.user_id = r.user_id and pt.is_active;

      if v_active_tokens = 0 then
        update public.notification_outbox set status = 'skipped', last_error = 'no_active_token' where id = r.outbox_id;
        v_skipped := v_skipped + 1; continue;
      end if;

      update public.notification_outbox set status = 'fanned', last_error = null where id = r.outbox_id;
      v_fanned := v_fanned + 1;
    exception when others then
      update public.notification_outbox
        set attempt_count = attempt_count + 1,
            status = case when attempt_count + 1 >= greatest(p_max_attempts, 1) then 'failed' else 'pending' end,
            last_error = left(sqlerrm, 1000)
        where id = r.outbox_id;
      v_skipped := v_skipped + 1;
    end;
  end loop;

  fanned := v_fanned;
  skipped := v_skipped;
  deferred := v_deferred;
  return next;
end;
$$;

revoke all on function public.fanout_due_notifications(integer, integer) from public;
grant execute on function public.fanout_due_notifications(integer, integer) to service_role;

-- ── claim_push_deliveries (service) — REVALIDATE + claim per device ───────────
-- The AUTHORITATIVE send-time gate. Because a push may sit (deferred, queued, or
-- awaiting retry) for hours after fan-out, EVERY claim AND every stale-lock
-- reclaim re-checks authorization here, immediately before the Edge Function
-- sends — fan-out validation alone is NOT relied on at send time. For each due
-- 'pending' or stale 'processing' delivery (FOR UPDATE SKIP LOCKED):
--   * SKIP (status 'skipped', safe machine-readable reason, NO attempt consumed,
--     not returned) when the notification is gone/expired, the recipient is gone,
--     they are no longer an ACTIVE member, their role/preference no longer permits
--     the type, or the token is gone/inactive/owned by another user;
--   * RE-DEFER (back to 'pending', available_at = newly-computed quiet-hours end,
--     NO attempt consumed, not returned) when non-emergency quiet hours now cover
--     "now" (emergency never defers);
--   * otherwise CLAIM: 'processing', locked_at = now(), attempt_count += 1 (exactly
--     once), or terminal 'failed' at the attempt cap — and RETURN it.
-- Only returned rows are sent. The return carries the token + minimal generic
-- routing data only (never care detail); the raw token is not stored anywhere.
create or replace function public.claim_push_deliveries(
  p_limit integer default 100,
  p_lock_timeout_seconds integer default 600,
  p_max_attempts integer default 5
)
returns table (
  delivery_id uuid,
  claim_token uuid,
  token text,
  push_token_id uuid,
  notification_id uuid,
  circle_id uuid,
  type public.notification_type,
  deep_link text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_user uuid;
  v_notification uuid;
  n public.notifications%rowtype;
  pt public.push_tokens%rowtype;
  prefs record;
  v_defer timestamptz;
  v_next integer;
  v_claim uuid;
  v_src_valid boolean;
  v_src_reason text;
begin
  for r in
    select d.id, d.outbox_id, d.push_token_id, d.attempt_count
    from public.notification_push_deliveries d
    where (d.status = 'pending' and d.available_at <= now())
       or (d.status = 'processing'
           and d.locked_at < now() - make_interval(secs => greatest(p_lock_timeout_seconds, 1)))
    order by d.available_at asc
    for update skip locked
    limit greatest(p_limit, 1)
  loop
    begin
      select ob.user_id, ob.notification_id into v_user, v_notification
      from public.notification_outbox ob where ob.id = r.outbox_id;
      if not found then
        update public.notification_push_deliveries d
          set status = 'skipped', last_error = 'no_outbox', locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;

      select * into n from public.notifications nn where nn.id = v_notification;
      if not found then
        update public.notification_push_deliveries d
          set status = 'skipped', last_error = 'no_notification', locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;
      if n.expires_at is not null and n.expires_at <= now() then
        update public.notification_push_deliveries d
          set status = 'skipped', last_error = 'expired', locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;

      if not exists (select 1 from public.profiles p where p.id = v_user) then
        update public.notification_push_deliveries d
          set status = 'skipped', last_error = 'no_recipient', locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;

      if n.circle_id is not null and not public.is_active_user_circle_member(n.circle_id, v_user) then
        update public.notification_push_deliveries d
          set status = 'skipped', last_error = 'not_member', locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;

      if not public.notification_recipient_eligible(v_user, n.circle_id, n.type) then
        update public.notification_push_deliveries d
          set status = 'skipped', last_error = 'not_eligible', locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;

      -- AUTHORITATIVE: does the source care event still require this notification?
      -- (dose recorded since enqueue, schedule/medication deactivated, occurrence
      -- removed, task completed/cancelled/rescheduled, appointment cancelled/
      -- rescheduled, …). A source-invalid row is skipped without consuming a send
      -- attempt; no source detail is exposed (only a machine-readable reason).
      select sv.valid, sv.reason into v_src_valid, v_src_reason
      from public.notification_source_validity(v_notification) sv;
      if not coalesce(v_src_valid, true) then
        update public.notification_push_deliveries d
          set status = 'skipped', last_error = coalesce(v_src_reason, 'source_invalid'),
              locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;

      -- Token must still exist, be active, and belong to the intended user.
      select * into pt from public.push_tokens p where p.id = r.push_token_id;
      if not found or not pt.is_active or pt.user_id <> v_user then
        update public.notification_push_deliveries d
          set status = 'skipped', last_error = 'token_inactive', locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;

      -- Quiet hours configured/changed since fan-out → re-defer (non-emergency).
      -- A defer never consumes a send attempt.
      select * into prefs from public.effective_notification_prefs(v_user, n.circle_id);
      v_defer := public.notification_defer_until(
        now(), prefs.timezone, prefs.quiet_hours_enabled,
        prefs.quiet_hours_start, prefs.quiet_hours_end, n.type = 'emergency'
      );
      if v_defer > now() then
        update public.notification_push_deliveries d
          set status = 'pending', available_at = v_defer, locked_at = null, claim_token = null
          where d.id = r.id;
        continue;
      end if;

      -- Valid: claim. Increment exactly once; terminal-fail at the cap. A fresh
      -- claim_token is the lease the result recorders must present to win.
      v_next := r.attempt_count + 1;
      if v_next > greatest(p_max_attempts, 1) then
        update public.notification_push_deliveries d
          set status = 'failed', last_error = 'max_attempts', locked_at = null,
              claim_token = null, attempt_count = v_next
          where d.id = r.id;
        continue;
      end if;
      v_claim := gen_random_uuid();
      update public.notification_push_deliveries d
        set status = 'processing', locked_at = now(), attempt_count = v_next, claim_token = v_claim
        where d.id = r.id;

      delivery_id := r.id;
      claim_token := v_claim;
      token := pt.expo_push_token;
      push_token_id := r.push_token_id;
      notification_id := v_notification;
      circle_id := n.circle_id;
      type := n.type;
      deep_link := n.deep_link;
      attempt_count := v_next;
      return next;
    exception when others then
      -- Poison row isolation: count an attempt; terminal-fail at the cap. Drop the
      -- lease either way so a later run can re-evaluate.
      update public.notification_push_deliveries d
        set attempt_count = d.attempt_count + 1,
            status = case when d.attempt_count + 1 >= greatest(p_max_attempts, 1)
                          then 'failed'::public.notification_delivery_status
                          else 'pending'::public.notification_delivery_status end,
            locked_at = null,
            claim_token = null,
            last_error = left(sqlerrm, 1000)
        where d.id = r.id;
    end;
  end loop;
end;
$$;

revoke all on function public.claim_push_deliveries(integer, integer, integer) from public;
grant execute on function public.claim_push_deliveries(integer, integer, integer) to service_role;

-- ── per-device delivery result recorders (service) — lease-guarded ────────────
-- Each recorder writes ONLY when the row is still 'processing' AND the caller
-- holds the current claim lease (claim_token). A stale worker whose lock expired
-- (its row reclaimed with a NEW claim_token) matches zero rows → returns false, so
-- the Edge Function logs `stale_claim` and never records a false result over a
-- newer worker. The lease is cleared on every terminal/retry transition. (External
-- push remains at-least-once; the lease only prevents stale DB-state corruption.)
create or replace function public.mark_delivery_sent(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_ticket_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer;
begin
  update public.notification_push_deliveries
    set status = 'sent', sent_at = now(), expo_ticket_id = p_ticket_id,
        last_error = null, locked_at = null, claim_token = null
    where id = p_delivery_id and status = 'processing' and claim_token = p_claim_token;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.mark_delivery_sent(uuid, uuid, text) from public;
grant execute on function public.mark_delivery_sent(uuid, uuid, text) to service_role;

create or replace function public.mark_delivery_failed(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_error text default null,
  p_retry_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer;
begin
  if p_retry_at is null then
    update public.notification_push_deliveries
      set status = 'failed', last_error = left(p_error, 1000), locked_at = null, claim_token = null
      where id = p_delivery_id and status = 'processing' and claim_token = p_claim_token;
  else
    update public.notification_push_deliveries
      set status = 'pending', available_at = p_retry_at, last_error = left(p_error, 1000),
          locked_at = null, claim_token = null
      where id = p_delivery_id and status = 'processing' and claim_token = p_claim_token;
  end if;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.mark_delivery_failed(uuid, uuid, text, timestamptz) from public;
grant execute on function public.mark_delivery_failed(uuid, uuid, text, timestamptz) to service_role;

create or replace function public.mark_delivery_skipped(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer;
begin
  update public.notification_push_deliveries
    set status = 'skipped', last_error = left(p_reason, 1000), locked_at = null, claim_token = null
    where id = p_delivery_id and status = 'processing' and claim_token = p_claim_token;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.mark_delivery_skipped(uuid, uuid, text) from public;
grant execute on function public.mark_delivery_skipped(uuid, uuid, text) to service_role;

-- One receipt per delivery (folded into the row). Validates the expected
-- Expo-ticket ↔ delivery relationship: writes ONLY when the delivery is 'sent' and
-- still carries the ticket the receipt is for, so a stale/mismatched receipt is a
-- no-op (returns false).
create or replace function public.record_delivery_receipt(
  p_delivery_id uuid,
  p_expected_ticket text,
  p_receipt_id text,
  p_status text,
  p_error_code text,
  p_details text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer;
begin
  update public.notification_push_deliveries
    set receipt_id = p_receipt_id,
        receipt_status = p_status,
        error_code = p_error_code,
        last_error = case when p_status = 'error' then left(p_details, 1000) else last_error end
    where id = p_delivery_id
      and status = 'sent'
      and expo_ticket_id is not distinct from p_expected_ticket;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.record_delivery_receipt(uuid, text, text, text, text, text) from public;
grant execute on function public.record_delivery_receipt(uuid, text, text, text, text, text) to service_role;

-- Stops re-polling tickets past the provider retention window: marks 'sent'
-- deliveries with no receipt older than the cutoff as receipt_status 'unchecked'.
-- Bounded by p_limit; returns the number marked.
create or replace function public.mark_stale_receipts_unchecked(
  p_cutoff timestamptz,
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer;
begin
  with stale as (
    select d.id from public.notification_push_deliveries d
    where d.status = 'sent' and d.receipt_status is null
      and d.expo_ticket_id is not null and d.sent_at < p_cutoff
    order by d.sent_at asc
    limit greatest(p_limit, 1)
  )
  update public.notification_push_deliveries d
    set receipt_status = 'unchecked', error_code = 'retention_window'
    from stale s where d.id = s.id;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.mark_stale_receipts_unchecked(timestamptz, integer) from public;
grant execute on function public.mark_stale_receipts_unchecked(timestamptz, integer) to service_role;

-- ── token invalidation (service) — definitive provider errors only ────────────
create or replace function public.deactivate_push_token_value(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_tokens set is_active = false where expo_push_token = p_token;
end;
$$;

revoke all on function public.deactivate_push_token_value(text) from public;
grant execute on function public.deactivate_push_token_value(text) to service_role;

create or replace function public.deactivate_push_token_by_id(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_tokens set is_active = false where id = p_id;
end;
$$;

revoke all on function public.deactivate_push_token_by_id(uuid) from public;
grant execute on function public.deactivate_push_token_by_id(uuid) to service_role;

notify pgrst, 'reload schema';


-- =============================================================================
-- PART 3 / 3 — Care-circle timezone column + manager-only set_circle_timezone
-- (from 20260611120200_add_care_circle_timezone.sql)
-- =============================================================================

-- Step 6.0 — Care-circle timezone (canonical zone for scheduled care events).
--
-- A medication dose at 08:00 or a task due at 14:00 is ONE real care event that
-- must happen at the cared-for person's local 08:00/14:00 — not a different event
-- in every recipient's country. So scheduled wall-clock times
-- (medication_schedules, care_tasks.due_*) are interpreted in the CARE CIRCLE's
-- timezone. Appointments stay absolute (timestamptz). The user/recipient timezone
-- on notification_preferences is used only for quiet hours / display.
--
-- care_circles is RPC-only for writes (direct INSERT/UPDATE/DELETE were revoked in
-- the Step 5.0 lockdown), so this timezone is changed exclusively through the
-- manager-only set_circle_timezone RPC below.
--
-- Idempotent / safe to re-run (apply manually via the Sanad Dashboard). Depends on
-- public.is_valid_timezone and public.active_circle_member_role (defined in the
-- notification functions migration and the Step 5.0 RPCs respectively).

-- ── Column: existing circles backfill to 'UTC'; the UI prompts a manager to set
--    the real zone (see the circle-timezone settings card). ─────────────────────
alter table public.care_circles
  add column if not exists timezone text not null default 'UTC';

-- ── set_circle_timezone ───────────────────────────────────────────────────────
-- Manager-only (admin / primary_caregiver). Validates the IANA name and updates
-- the circle's timezone. Returns the stored value.
create or replace function public.set_circle_timezone(
  p_circle_id uuid,
  p_timezone text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.circle_role;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_timezone is null or not public.is_valid_timezone(p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;

  -- `is null` guard required: a non-member yields NULL and NULL not in (...) is
  -- NULL (not true), which would otherwise slip through.
  v_actor := public.active_circle_member_role(p_circle_id);
  if v_actor is null or v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can change the circle timezone' using errcode = '42501';
  end if;

  update public.care_circles set timezone = p_timezone where id = p_circle_id;
  return p_timezone;
end;
$$;

revoke all on function public.set_circle_timezone(uuid, text) from public;
grant execute on function public.set_circle_timezone(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- =============== End of Step 6.0 complete SQL artifact ===============
