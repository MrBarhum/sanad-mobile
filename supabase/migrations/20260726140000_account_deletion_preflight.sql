-- Milestone 7 · A10 — Account deletion preflight.
--
-- Google Play requires in-app account deletion for any app that allows account
-- creation. This is the read-only half: it tells the caller EXACTLY what deleting
-- their account would destroy, and blocks the cases that would destroy other
-- people's data. The deletion itself needs the service role (auth.users is owned
-- by supabase_auth_admin) and lives in the `delete-account` edge function.
--
-- ── THE HAZARD THIS EXISTS TO PREVENT ────────────────────────────────────────
--
--   profiles.id        references auth.users(id)     on delete cascade
--   care_circles.owner_id references public.profiles(id) on delete cascade
--
-- so `auth.admin.deleteUser(uid)` cascades:
--
--   auth.users -> profiles -> care_circles (every circle they OWN)
--              -> medications, medication_schedules, medication_logs,
--                 care_tasks, care_appointments, family_visits, vital_readings,
--                 daily_care_logs, care_recipients, emergency_contacts, doctors,
--                 circle_invitations, circle_members, ...
--
-- A user who owns a circle that five relatives actively use would, by tapping
-- "delete my account", silently destroy every one of those records for all of
-- them. Nothing warns anybody. That is unacceptable, and it is not obvious from
-- the client — which is exactly why the check has to be server-side and
-- authoritative, not a UI courtesy.
--
-- POLICY:
--   * owner of a circle with >= 1 OTHER active member  -> BLOCKED. They must
--     transfer ownership (public.transfer_circle_ownership, 20260610130200:65)
--     or remove the other members first.
--   * owner of a circle where they are the only active member -> the circle and
--     its data are deleted with them. Intended, and disclosed before they confirm.
--   * member but not owner -> they simply leave; the circle is untouched.
--
-- Idempotent: create or replace + re-asserted grants. Safe to re-run.
-- Read-only: this function mutates nothing.
--
-- NOT auto-applied — Milestone 7 runbook step R8.

create or replace function public.account_deletion_preflight()
returns table (
  circle_id uuid,
  circle_name text,
  recipient_name text,
  -- 'blocked'  : caller owns it and other active members remain
  -- 'deleted'  : caller owns it and is the only active member -> destroyed with them
  -- 'left'     : caller is a member but not the owner -> circle untouched
  outcome text,
  other_active_members integer
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    c.id,
    c.name,
    r.full_name,
    case
      when c.owner_id = (select auth.uid()) and others.n > 0 then 'blocked'
      when c.owner_id = (select auth.uid())                  then 'deleted'
      else 'left'
    end as outcome,
    others.n
  from public.care_circles c
  join public.circle_members me
    on me.circle_id = c.id
   and me.user_id = (select auth.uid())
   and me.status = 'active'
  left join public.care_recipients r
    on r.circle_id = c.id
  cross join lateral (
    select count(*)::integer as n
      from public.circle_members m
     where m.circle_id = c.id
       and m.status = 'active'
       and m.user_id <> (select auth.uid())
  ) others
  order by
    case
      when c.owner_id = (select auth.uid()) and others.n > 0 then 0
      when c.owner_id = (select auth.uid())                  then 1
      else 2
    end,
    c.name;
$$;

revoke all on function public.account_deletion_preflight() from public;
grant execute on function public.account_deletion_preflight() to authenticated;

notify pgrst, 'reload schema';

-- Read-only verification (run as a signed-in user, not as postgres):
--   select * from public.account_deletion_preflight();
--
-- Expect one row per circle the caller is an ACTIVE member of. A caller with no
-- circles gets zero rows, which is a valid "nothing but the account itself will
-- be deleted" result — the edge function treats an empty set as deletable.
