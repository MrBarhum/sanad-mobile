-- Step 2.1 — Medication RLS ownership-check hardening hotfix.
--
-- The Step 2.0 manager/caregiver INSERT/UPDATE policies for medication_schedules
-- and medication_logs validate a foreign reference (the schedule's parent
-- medication, the log's medication / schedule) with an inline correlated subquery
-- of the form:
--
--     exists (select 1 from public.<inner> x
--             where x.<key> = <outer_ref> and x.circle_id = circle_id [and ...])
--
-- The bare `circle_id` on the right is AMBIGUOUS: the inner table (medications /
-- medication_schedules) also has a `circle_id` column, so the unqualified name
-- resolves to the INNER table, not the policy's target row. The predicate
-- degenerates to `x.circle_id = x.circle_id` (a tautology), so the intended
-- same-circle guard never fires — a medication / schedule from ANOTHER circle
-- would satisfy the check. The medication_logs schedule subquery has the SAME
-- problem twice over: both `s.circle_id = circle_id` and `s.medication_id =
-- medication_id` bind to the inner medication_schedules row (which has both
-- columns), so the schedule's circle AND medication ownership both collapse to
-- tautologies.
--
-- (The Sanad app only ever submits same-circle references — the form derives
-- medication_id / schedule_id from the active circle — so this was never
-- exploited; this hotfix closes the latent cross-circle integrity gap.)
--
-- Fix: move each check into a SECURITY DEFINER helper that takes the circle and
-- the referenced id(s) as EXPLICIT parameters, so the predicate cannot be
-- shadowed by an inner table column. Behavior is otherwise unchanged: same roles,
-- same active-membership model, same same-circle / same-medication requirements.
-- Policy names are preserved.
--
-- Scope: hardens the four already-applied Step 2.0 INSERT/UPDATE policies in
-- place (medication_schedules add/update, medication_logs add/update). The SELECT
-- and DELETE policies on all three medication tables use only is_circle_member /
-- has_circle_role (no foreign subquery, no ambiguity) and are LEFT UNTOUCHED, as
-- are tables, indexes, the medication_log_status enum, constraints, and triggers.
-- This mirrors the Step 3.1 hotfix (20260610110000), which flagged these
-- medication policies as the out-of-scope follow-up now addressed here.
--
-- Idempotent / safe to re-run (apply manually via the Sanad Dashboard SQL Editor):
-- helper functions use create or replace with re-asserted revoke/grant; policies
-- are dropped before being recreated. No table/enum/constraint/trigger changes,
-- no data writes.

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- A medication belongs to a circle. Replaces the ambiguous
-- `from public.medications m where m.id = medication_id and m.circle_id =
-- circle_id` subquery. SECURITY DEFINER + empty search_path (every object schema-
-- qualified) so it runs above medications' own RLS without recursion, mirroring
-- the existing is_circle_member / has_circle_role / is_circle_doctor helpers.
create or replace function public.is_circle_medication(p_circle_id uuid, p_medication_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.medications m
    where m.id = p_medication_id
      and m.circle_id = p_circle_id
  );
$$;

revoke all on function public.is_circle_medication(uuid, uuid) from public;
grant execute on function public.is_circle_medication(uuid, uuid) to authenticated;

-- A medication schedule belongs to a circle. Provided for completeness / reuse
-- (the circle-only ownership check); the medication_logs policies use the
-- stricter schedule+medication variant below.
create or replace function public.is_circle_medication_schedule(p_circle_id uuid, p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.medication_schedules s
    where s.id = p_schedule_id
      and s.circle_id = p_circle_id
  );
$$;

revoke all on function public.is_circle_medication_schedule(uuid, uuid) from public;
grant execute on function public.is_circle_medication_schedule(uuid, uuid) to authenticated;

-- A medication schedule belongs to a circle AND to a specific medication. Used by
-- the medication_logs checks, where the original inline subquery's `s.circle_id =
-- circle_id` and `s.medication_id = medication_id` BOTH degenerated to tautologies
-- (medication_schedules has both columns). Explicit parameters fix both at once.
create or replace function public.is_circle_medication_schedule_for_medication(
  p_circle_id uuid,
  p_schedule_id uuid,
  p_medication_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.medication_schedules s
    where s.id = p_schedule_id
      and s.circle_id = p_circle_id
      and s.medication_id = p_medication_id
  );
$$;

revoke all on function public.is_circle_medication_schedule_for_medication(uuid, uuid, uuid) from public;
grant execute on function public.is_circle_medication_schedule_for_medication(uuid, uuid, uuid) to authenticated;

-- ── medication_schedules: manager INSERT / UPDATE (parent medication same circle) ─

-- INSERT: admins / primary caregivers only, and the referenced medication must
-- belong to the same circle (blocks cross-circle medication_id references).
drop policy if exists "Managers can add medication schedules" on public.medication_schedules;
create policy "Managers can add medication schedules"
on public.medication_schedules
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and public.is_circle_medication(circle_id, medication_id)
);

-- UPDATE: admins / primary caregivers only; the post-update medication must still
-- belong to the same circle.
drop policy if exists "Managers can update medication schedules" on public.medication_schedules;
create policy "Managers can update medication schedules"
on public.medication_schedules
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and public.is_circle_medication(circle_id, medication_id)
);

-- ── medication_logs: caregiver INSERT / UPDATE (medication + schedule same circle) ─

-- INSERT: any caregiving member may confirm/record a dose. The medication must
-- belong to the same circle, and a non-null schedule must belong to the same
-- circle AND the same medication (blocks cross-circle / mismatched references).
drop policy if exists "Caregivers can add medication logs" on public.medication_logs;
create policy "Caregivers can add medication logs"
on public.medication_logs
for insert
to authenticated
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
);

-- UPDATE: any caregiving member may change a dose outcome; the post-update
-- references must satisfy the same cross-circle integrity as INSERT.
drop policy if exists "Caregivers can update medication logs" on public.medication_logs;
create policy "Caregivers can update medication logs"
on public.medication_logs
for update
to authenticated
using (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
)
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
);
