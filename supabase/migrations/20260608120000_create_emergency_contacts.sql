-- Emergency contacts for a care circle (step 1.2).
--
-- People to call in an emergency (family, neighbour, caregiver, …). One circle
-- has many contacts. Mirrors the care_recipients RLS model: every active member
-- can read the contacts, but only admins and primary caregivers can mutate them.
-- Reuses the existing public.set_updated_at() trigger function and the
-- security-definer helpers public.is_circle_member / public.has_circle_role
-- defined in the initial core schema.
--
-- This migration is idempotent / safe to re-run: because the SQL is applied
-- manually via the Sanad Supabase Dashboard (not `supabase db push`), Supabase's
-- migration history may not record it, so `db push` could later run this file
-- again. Every statement therefore guards against already-existing objects.

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null,
  relationship text,
  phone text not null,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contacts are always queried by their circle.
create index if not exists emergency_contacts_circle_id_idx
  on public.emergency_contacts (circle_id);

drop trigger if exists emergency_contacts_set_updated_at on public.emergency_contacts;
create trigger emergency_contacts_set_updated_at
before update on public.emergency_contacts
for each row execute function public.set_updated_at();

alter table public.emergency_contacts enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view emergency contacts" on public.emergency_contacts;
create policy "Members can view emergency contacts"
on public.emergency_contacts
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT: admins and primary caregivers only. caregiver/family roles cannot
-- manage contacts in this step.
drop policy if exists "Managers can add emergency contacts" on public.emergency_contacts;
create policy "Managers can add emergency contacts"
on public.emergency_contacts
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- UPDATE: admins and primary caregivers only.
drop policy if exists "Managers can update emergency contacts" on public.emergency_contacts;
create policy "Managers can update emergency contacts"
on public.emergency_contacts
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- DELETE: admins and primary caregivers only.
drop policy if exists "Managers can delete emergency contacts" on public.emergency_contacts;
create policy "Managers can delete emergency contacts"
on public.emergency_contacts
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
