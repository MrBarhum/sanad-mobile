-- Daily care logs for a care circle (step 4.0).
--
-- Family / caregiver daily observations about the care recipient: mood, sleep,
-- appetite, hydration, a 0–10 pain level, mobility, and free-text notes. Records
-- family-provided observations only — no medical advice, diagnosis, or range
-- interpretation. One circle has many daily logs; several members may each log
-- the same day, but a single member may not file two logs for the same date.
--
-- RLS model:
--   * Every active member can read the circle's daily logs.
--   * Admin / primary_caregiver / caregiver / family_member may add a log, always
--     attributed to themselves (recorded_by = auth.uid()) or left anonymous.
--   * A member may edit / delete their own log (recorded_by = auth.uid()).
--   * Admins and primary caregivers may edit / delete any log in the circle.
-- Reuses public.set_updated_at() and the security-definer helpers
-- public.is_circle_member / public.has_circle_role from the initial core schema.
--
-- Idempotent / safe to re-run (applied manually via the Sanad Dashboard, so the
-- CLI migration history may not record it): enums are created in guarded DO
-- blocks (no `create type if not exists` in Postgres); tables/indexes use
-- if not exists; constraints are added inside pg_constraint-guarded DO blocks;
-- triggers / policies are dropped before recreating.

do $$
begin
  create type public.daily_mood as enum (
    'great', 'good', 'okay', 'sad', 'anxious', 'angry', 'confused', 'tired'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.sleep_quality as enum ('good', 'fair', 'poor', 'unknown');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.appetite_level as enum ('good', 'normal', 'low', 'none', 'unknown');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.hydration_level as enum ('good', 'normal', 'low', 'unknown');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.mobility_level as enum (
    'normal', 'limited', 'needs_help', 'bedbound', 'unknown'
  );
exception
  when duplicate_object then null;
end
$$;

-- Membership helper for the manager-edit author check below. It takes the circle
-- and user as explicit parameters so the membership test can never be written with
-- an ambiguous unqualified column: in an inline subquery, `cm.circle_id =
-- circle_id` would bind the bare `circle_id` to circle_members (the inner table),
-- making the test a tautology rather than a cross-circle guard. As a function the
-- predicate references the named parameters, which is unambiguous.
--
-- SECURITY DEFINER with an empty search_path (every object schema-qualified) so it
-- runs above circle_members' RLS without recursion, mirroring the existing
-- is_circle_member / has_circle_role helpers. Membership is ANY status (a
-- since-removed member still counts) so a manager can edit a record they authored.
-- Idempotent: create or replace + re-asserted revoke/grant.
create or replace function public.is_user_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
  );
$$;

revoke all on function public.is_user_circle_member(uuid, uuid) from public;
grant execute on function public.is_user_circle_member(uuid, uuid) to authenticated;

create table if not exists public.daily_care_logs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  log_date date not null default current_date,
  mood public.daily_mood,
  sleep_quality public.sleep_quality,
  appetite public.appetite_level,
  hydration public.hydration_level,
  pain_level int,
  mobility public.mobility_level,
  bathroom_notes text,
  food_notes text,
  activity_notes text,
  general_notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_care_logs_circle_id_idx on public.daily_care_logs (circle_id);
-- The daily-logs center lists / filters by date within a circle.
create index if not exists daily_care_logs_circle_date_idx
  on public.daily_care_logs (circle_id, log_date);

-- A pain level, when given, is a 0–10 self-/observer-reported scale.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.daily_care_logs'::regclass
      and conname = 'daily_care_logs_pain_level_range'
  ) then
    alter table public.daily_care_logs
      add constraint daily_care_logs_pain_level_range
      check (pain_level is null or (pain_level >= 0 and pain_level <= 10));
  end if;
end
$$;

-- One log per circle per date per author. Partial (recorded_by is not null) so
-- multiple members can each log the same day, but a single member cannot file a
-- duplicate log for the same date. Anonymous (recorded_by null) logs are exempt.
create unique index if not exists daily_care_logs_one_per_author_per_day
  on public.daily_care_logs (circle_id, log_date, recorded_by)
  where recorded_by is not null;

drop trigger if exists daily_care_logs_set_updated_at on public.daily_care_logs;
create trigger daily_care_logs_set_updated_at
before update on public.daily_care_logs
for each row execute function public.set_updated_at();

alter table public.daily_care_logs enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view daily logs" on public.daily_care_logs;
create policy "Members can view daily logs"
on public.daily_care_logs
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT (members): any caregiving role may add a log, but ONLY attributed to
-- themselves (recorded_by = auth.uid()). Because auth.uid() passes has_circle_role
-- only for its own circle, this pins the author to the acting member and blocks
-- cross-circle attribution. Non-managers may NOT insert an anonymous
-- (recorded_by null) row — that is the separate manager policy below.
drop policy if exists "Members can add daily logs" on public.daily_care_logs;
create policy "Members can add daily logs"
on public.daily_care_logs
for insert
to authenticated
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
);

-- INSERT (managers, anonymous): admins / primary caregivers may additionally file
-- an unattributed log (recorded_by null) for the circle.
drop policy if exists "Managers can add anonymous daily logs" on public.daily_care_logs;
create policy "Managers can add anonymous daily logs"
on public.daily_care_logs
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and recorded_by is null
);

-- UPDATE (managers): admins / primary caregivers may edit any log; the post-update
-- author must stay null or a member of the SAME circle, validated via
-- public.is_user_circle_member(circle_id, recorded_by). Using the helper (explicit
-- params) instead of an inline subquery avoids the ambiguous-`circle_id` trap.
-- Any-status membership, so a manager can still edit a log whose author was since
-- removed; the client never reassigns recorded_by. Cross-circle authors stay blocked.
drop policy if exists "Managers can update daily logs" on public.daily_care_logs;
create policy "Managers can update daily logs"
on public.daily_care_logs
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (recorded_by is null or public.is_user_circle_member(circle_id, recorded_by))
);

-- UPDATE (own): a caregiving member may edit their own log; ownership may not be
-- reassigned (recorded_by stays the acting user).
drop policy if exists "Members can update own daily logs" on public.daily_care_logs;
create policy "Members can update own daily logs"
on public.daily_care_logs
for update
to authenticated
using (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
)
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
);

-- DELETE (managers): admins / primary caregivers may remove any log in the circle.
drop policy if exists "Managers can delete daily logs" on public.daily_care_logs;
create policy "Managers can delete daily logs"
on public.daily_care_logs
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- DELETE (own): caregivers / family members may remove their own log.
drop policy if exists "Members can delete own daily logs" on public.daily_care_logs;
create policy "Members can delete own daily logs"
on public.daily_care_logs
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and recorded_by = auth.uid()
);
