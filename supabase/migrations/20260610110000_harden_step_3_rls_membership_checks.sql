-- Step 3.1 — RLS membership / ownership check hardening hotfix.
--
-- The Step 3.0 policies for care_tasks, family_visits, and care_appointments each
-- validate a foreign reference (task assignee, visit visitor account, appointment
-- doctor) with an inline correlated subquery of the form:
--
--     exists (select 1 from public.<inner> x
--             where x.<key> = <outer_ref> and x.circle_id = circle_id [and ...])
--
-- The bare `circle_id` on the right is AMBIGUOUS: the inner table
-- (circle_members / doctors) also has a `circle_id` column, so the unqualified
-- name resolves to the INNER table, not the policy's row. The predicate collapses
-- to `x.circle_id = x.circle_id` (a tautology), so the cross-circle guard never
-- fires — an assignee / visitor / doctor from ANOTHER circle would satisfy the
-- check. (The Sanad app only ever references same-circle rows, so this was never
-- exploited; this hotfix closes the latent gap.)
--
-- Fix: move each check into a SECURITY DEFINER helper that takes the circle and the
-- referenced id as EXPLICIT parameters, so the predicate is unambiguous. Behavior
-- is otherwise unchanged: same roles, same active-membership requirement for the
-- assignee / visitor, same circle-ownership requirement for the doctor. Policy
-- names are preserved.
--
-- Scope: hardens the six already-applied Step 3.0 manager INSERT / UPDATE policies
-- in place. Tables, enums, constraints, triggers, and every other policy are left
-- untouched. (The same ambiguous pattern also exists in the Step 2.x medication
-- policies — medication_schedules / medication_logs — which are OUT OF SCOPE for
-- this Step 3.0 hotfix and should be addressed in a separate pass.)
--
-- Idempotent / safe to re-run (apply manually via the Sanad Dashboard SQL Editor):
-- helper functions use create or replace with re-asserted revoke/grant; policies
-- are dropped before being recreated. No table/enum/constraint changes, no data
-- writes.

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Any-status circle membership. Re-asserted here (it was introduced in the Step
-- 4.0 hardening) so this migration is self-contained even if Step 4.0 SQL has not
-- been applied. SECURITY DEFINER + empty search_path (every object schema-
-- qualified) so it runs above circle_members' RLS without recursion, mirroring the
-- existing is_circle_member / has_circle_role helpers.
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

-- Active circle membership — used by the task-assignee and visit-visitor checks,
-- which require the referenced user to be an ACTIVE member of the row's circle
-- (matching the original Step 3.0 intent: `cm.status = 'active'`).
create or replace function public.is_active_user_circle_member(p_circle_id uuid, p_user_id uuid)
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
      and cm.status = 'active'
  );
$$;

revoke all on function public.is_active_user_circle_member(uuid, uuid) from public;
grant execute on function public.is_active_user_circle_member(uuid, uuid) to authenticated;

-- Doctor belongs to a circle — used by the appointment doctor-reference check.
-- The original inline subquery (`from public.doctors d where d.id = doctor_id and
-- d.circle_id = circle_id`) has the same ambiguity: `circle_id` binds to doctors,
-- not the appointment row. Explicit parameters fix it.
create or replace function public.is_circle_doctor(p_circle_id uuid, p_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.doctors d
    where d.id = p_doctor_id
      and d.circle_id = p_circle_id
  );
$$;

revoke all on function public.is_circle_doctor(uuid, uuid) from public;
grant execute on function public.is_circle_doctor(uuid, uuid) to authenticated;

-- ── care_tasks: manager INSERT / UPDATE (assignee must be an active member) ───

drop policy if exists "Managers can add care tasks" on public.care_tasks;
create policy "Managers can add care tasks"
on public.care_tasks
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

drop policy if exists "Managers can update care tasks" on public.care_tasks;
create policy "Managers can update care tasks"
on public.care_tasks
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

-- ── family_visits: manager INSERT / UPDATE (visitor must be an active member) ──

drop policy if exists "Managers can add family visits" on public.family_visits;
create policy "Managers can add family visits"
on public.family_visits
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (visitor_user_id is null or public.is_active_user_circle_member(circle_id, visitor_user_id))
);

drop policy if exists "Managers can update family visits" on public.family_visits;
create policy "Managers can update family visits"
on public.family_visits
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (visitor_user_id is null or public.is_active_user_circle_member(circle_id, visitor_user_id))
);

-- ── care_appointments: manager INSERT / UPDATE (doctor must belong to circle) ──

drop policy if exists "Managers can add care appointments" on public.care_appointments;
create policy "Managers can add care appointments"
on public.care_appointments
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (doctor_id is null or public.is_circle_doctor(circle_id, doctor_id))
);

drop policy if exists "Managers can update care appointments" on public.care_appointments;
create policy "Managers can update care appointments"
on public.care_appointments
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (doctor_id is null or public.is_circle_doctor(circle_id, doctor_id))
);
