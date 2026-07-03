-- Phase 2F-1.7 — Repo backfill of the manually-applied Phase 2A assignment columns.
--
-- These objects were originally applied BY HAND in the Sanad Supabase Dashboard
-- (Phase 2A; confirmed applied in
-- docs/claude-reports/2026-06-19-product-phase-2b-assignment-ui.md §1) and were absent
-- from repo migrations. This file brings the repo forward so a fresh `supabase db reset`
-- reproduces the live schema. SQL is copied verbatim from Apply-pack A of
-- docs/claude-reports/2026-06-26-phase-2f-1-6-migration-backfill-proposal.md; the outer
-- begin;/commit; wrapper is omitted to match house style (the migration runner wraps each
-- file in its own transaction). Idempotent / safe to re-run against the already-live DB.

-- =========================================================================
-- Backfill Phase 2A — responsible-person columns for appointments + medications
-- Additive, idempotent. Mirrors care_tasks.assigned_to (nullable FK -> profiles,
-- on delete set null, indexed) and extends the manager INSERT/UPDATE policies
-- with the active-member guard (is_active_user_circle_member). Mutation rights
-- are UNCHANGED (admins / primary caregivers only). No collaborator path added.
-- =========================================================================

-- 1) care_appointments.assigned_to -----------------------------------------
alter table public.care_appointments
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists care_appointments_assigned_to_idx
  on public.care_appointments (assigned_to);

-- INSERT: managers only; doctor must belong to the circle AND a non-null assignee
-- must be an active member of the same circle (blocks cross-circle assignment).
drop policy if exists "Managers can add care appointments" on public.care_appointments;
create policy "Managers can add care appointments"
on public.care_appointments
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (doctor_id is null or public.is_circle_doctor(circle_id, doctor_id))
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

-- UPDATE: managers only; post-update doctor + assignee must satisfy the same guards.
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
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

-- 2) medications.responsible_user_id ---------------------------------------
alter table public.medications
  add column if not exists responsible_user_id uuid references public.profiles(id) on delete set null;

create index if not exists medications_responsible_user_id_idx
  on public.medications (responsible_user_id);

-- Manager INSERT/UPDATE gain the active-member guard. Dose-logging RLS is NOT
-- touched here (any caregiving member may still record a dose; responsibility is
-- gated in Apply-pack B on medication_logs).
drop policy if exists "Managers can add medications" on public.medications;
create policy "Managers can add medications"
on public.medications
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (responsible_user_id is null or public.is_active_user_circle_member(circle_id, responsible_user_id))
);

drop policy if exists "Managers can update medications" on public.medications;
create policy "Managers can update medications"
on public.medications
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (responsible_user_id is null or public.is_active_user_circle_member(circle_id, responsible_user_id))
);

notify pgrst, 'reload schema';
