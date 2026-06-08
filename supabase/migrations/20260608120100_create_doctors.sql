-- Doctors for a care circle (step 1.2).
--
-- The recipient's treating doctors / clinics. One circle has many doctors.
-- Same RLS model as emergency_contacts: every active member can read, only
-- admins and primary caregivers can mutate. Reuses public.set_updated_at() and
-- the security-definer helpers from the initial core schema.
--
-- This migration is idempotent / safe to re-run: because the SQL is applied
-- manually via the Sanad Supabase Dashboard (not `supabase db push`), Supabase's
-- migration history may not record it, so `db push` could later run this file
-- again. Every statement therefore guards against already-existing objects.

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null,
  specialty text,
  phone text,
  clinic_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Doctors are always queried by their circle.
create index if not exists doctors_circle_id_idx on public.doctors (circle_id);

drop trigger if exists doctors_set_updated_at on public.doctors;
create trigger doctors_set_updated_at
before update on public.doctors
for each row execute function public.set_updated_at();

alter table public.doctors enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view doctors" on public.doctors;
create policy "Members can view doctors"
on public.doctors
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT: admins and primary caregivers only.
drop policy if exists "Managers can add doctors" on public.doctors;
create policy "Managers can add doctors"
on public.doctors
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- UPDATE: admins and primary caregivers only.
drop policy if exists "Managers can update doctors" on public.doctors;
create policy "Managers can update doctors"
on public.doctors
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- DELETE: admins and primary caregivers only.
drop policy if exists "Managers can delete doctors" on public.doctors;
create policy "Managers can delete doctors"
on public.doctors
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
