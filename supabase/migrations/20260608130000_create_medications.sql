-- Medications for a care circle (step 2.0).
--
-- The list of medicines the family records for the care recipient. One circle
-- has many medications. Records family-provided data only — no medical advice.
-- Mirrors the existing RLS model: every active member can read, only admins and
-- primary caregivers can mutate. Reuses public.set_updated_at() and the
-- security-definer helpers public.is_circle_member / public.has_circle_role from
-- the initial core schema.
--
-- Idempotent / safe to re-run (applied manually via the Sanad Dashboard, so the
-- CLI migration history may not record it): create table/index if not exists,
-- and drop trigger/policy if exists before recreating.

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null,
  dosage text,
  form text,
  instructions text,
  with_food boolean not null default false,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medications_circle_id_idx on public.medications (circle_id);
-- The medication center lists active medications by circle.
create index if not exists medications_circle_active_idx
  on public.medications (circle_id) where is_active;

drop trigger if exists medications_set_updated_at on public.medications;
create trigger medications_set_updated_at
before update on public.medications
for each row execute function public.set_updated_at();

alter table public.medications enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view medications" on public.medications;
create policy "Members can view medications"
on public.medications
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT: admins and primary caregivers only.
drop policy if exists "Managers can add medications" on public.medications;
create policy "Managers can add medications"
on public.medications
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- UPDATE: admins and primary caregivers only (also used for deactivation).
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
);

-- DELETE: admins and primary caregivers only (the UI prefers deactivation).
drop policy if exists "Managers can delete medications" on public.medications;
create policy "Managers can delete medications"
on public.medications
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
