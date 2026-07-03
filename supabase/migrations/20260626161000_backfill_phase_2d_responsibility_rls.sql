-- Phase 2F-1.7 — Repo backfill of the manually-applied Phase 2D responsibility RLS.
--
-- These objects were originally applied BY HAND in the Sanad Supabase Dashboard
-- (Phase 2D; confirmed applied in
-- docs/claude-reports/2026-06-26-phase-2d-rls-applied-verification.md, including the
-- optional dose-log SELECT scope) and were absent from repo migrations. SQL is copied
-- verbatim from Apply-pack B of
-- docs/claude-reports/2026-06-26-phase-2f-1-6-migration-backfill-proposal.md; the outer
-- begin;/commit; wrapper is omitted to match house style (the migration runner wraps each
-- file in its own transaction). Depends on Apply-pack A columns (run 20260626160000 first).
-- Idempotent / safe to re-run against the already-live DB.

-- =========================================================================
-- Backfill Phase 2D — responsibility-based operational RLS
-- Additive helpers + scoped SELECT + responsibility log gates + removal of the
-- unassigned-task collaborator allowance. Idempotent (create or replace / drop
-- policy if exists + recreate). No data change. Depends on Apply-pack A columns.
-- =========================================================================

-- 5.0 Helpers (additive) ---------------------------------------------------
-- "Sees every operational row" = managers + (for now) remote read-only.
-- SINGLE SWITCH POINT for the remote decision: to move remote to summary-only
-- (Option B) later, remove 'remote_member' from this one array.
create or replace function public.can_view_all_operational(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_circle_role(
    p_circle_id,
    array['admin','primary_caregiver','remote_member']::public.circle_role[]
  );
$$;
revoke all on function public.can_view_all_operational(uuid) from public;
grant execute on function public.can_view_all_operational(uuid) to authenticated;

-- True when p_user_id is the responsible owner of a medication in the circle.
create or replace function public.is_responsible_for_medication(
  p_circle_id uuid, p_medication_id uuid, p_user_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.medications m
    where m.id = p_medication_id
      and m.circle_id = p_circle_id
      and m.responsible_user_id = p_user_id
  );
$$;
revoke all on function public.is_responsible_for_medication(uuid, uuid, uuid) from public;
grant execute on function public.is_responsible_for_medication(uuid, uuid, uuid) to authenticated;

-- 5.1 care_tasks — scope SELECT + remove the unassigned collaborator allowance
drop policy if exists "Members can view care tasks" on public.care_tasks;
create policy "Members can view care tasks"
on public.care_tasks
for select
to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (
    public.is_circle_member(circle_id)
    and (
      assigned_to = (select auth.uid())
      or completed_by = (select auth.uid())
    )
  )
);

-- Collaborator UPDATE: drop the `assigned_to is null` branch → doers may act ONLY
-- on tasks assigned to them. The status-only trigger is unchanged (see Apply-pack C
-- for the body that gains only the claim bypass).
drop policy if exists "Members can update assigned care tasks" on public.care_tasks;
create policy "Members can update assigned care tasks"
on public.care_tasks
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver','family_member']::public.circle_role[])
  and assigned_to = (select auth.uid())
)
with check (
  public.has_circle_role(circle_id, array['caregiver','family_member']::public.circle_role[])
  and assigned_to = (select auth.uid())
);

-- 5.2 care_appointments — scope SELECT (INSERT/UPDATE/DELETE stay manager-only) --
drop policy if exists "Members can view care appointments" on public.care_appointments;
create policy "Members can view care appointments"
on public.care_appointments
for select
to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (
    public.is_circle_member(circle_id)
    and assigned_to = (select auth.uid())
  )
);

-- 5.4 medication_logs — gate INSERT/UPDATE to managers-or-responsible ----------
drop policy if exists "Caregivers can add medication logs" on public.medication_logs;
create policy "Caregivers can add medication logs"
on public.medication_logs
for insert
to authenticated
with check (
  (
    public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[])
    or (
      public.has_circle_role(circle_id, array['family_member','caregiver']::public.circle_role[])
      and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
    )
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
);

drop policy if exists "Caregivers can update medication logs" on public.medication_logs;
create policy "Caregivers can update medication logs"
on public.medication_logs
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[])
  or (
    public.has_circle_role(circle_id, array['family_member','caregiver']::public.circle_role[])
    and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
  )
)
with check (
  (
    public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[])
    or (
      public.has_circle_role(circle_id, array['family_member','caregiver']::public.circle_role[])
      and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
    )
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
);

-- 5.4 (applied) medication_logs — scope dose-log READS for doers ---------------
drop policy if exists "Members can view medication logs" on public.medication_logs;
create policy "Members can view medication logs"
on public.medication_logs
for select
to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (
    public.is_circle_member(circle_id)
    and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
  )
);

-- 5.5 family_visits — scope SELECT (own-record INSERT/UPDATE untouched here) ----
drop policy if exists "Members can view family visits" on public.family_visits;
create policy "Members can view family visits"
on public.family_visits
for select
to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (
    public.is_circle_member(circle_id)
    and visitor_user_id = (select auth.uid())
  )
);

notify pgrst, 'reload schema';
