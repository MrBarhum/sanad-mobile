-- Calendar items / appointments for a care circle (step 3.0).
--
-- Doctor visits, lab tests, pharmacy pickups, therapy, home-care visits, family
-- gatherings, and general appointments the family schedules around the care
-- recipient. Records family-provided scheduling data only — no medical advice.
-- One circle has many appointments; an appointment may optionally reference a
-- doctor already recorded for the same circle.
--
-- RLS model: every active member can read; only admins and primary caregivers
-- create / edit / delete appointments. A non-null doctor_id must belong to the
-- same circle (blocks cross-circle references).
-- Reuses public.set_updated_at() and the security-definer helpers
-- public.is_circle_member / public.has_circle_role from the initial core schema.
--
-- Idempotent / safe to re-run (applied manually via the Sanad Dashboard): enums
-- created in guarded DO blocks; tables/indexes use if not exists; constraints
-- added inside pg_constraint-guarded DO blocks; triggers/policies dropped before
-- recreating.

do $$
begin
  create type public.care_appointment_type as enum (
    'doctor', 'lab', 'pharmacy', 'therapy', 'home_care', 'family', 'general'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.care_appointment_status as enum ('scheduled', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.care_appointments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  title text not null,
  appointment_type public.care_appointment_type not null default 'general',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  doctor_id uuid references public.doctors(id) on delete set null,
  notes text,
  status public.care_appointment_status not null default 'scheduled',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_appointments_circle_id_idx on public.care_appointments (circle_id);
-- The appointment center lists upcoming items by start time within a circle.
create index if not exists care_appointments_circle_starts_idx
  on public.care_appointments (circle_id, starts_at);
create index if not exists care_appointments_doctor_id_idx on public.care_appointments (doctor_id);

-- An appointment may not end before it starts.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_appointments'::regclass
      and conname = 'care_appointments_ends_after_starts'
  ) then
    alter table public.care_appointments
      add constraint care_appointments_ends_after_starts
      check (ends_at is null or ends_at >= starts_at);
  end if;
end
$$;

drop trigger if exists care_appointments_set_updated_at on public.care_appointments;
create trigger care_appointments_set_updated_at
before update on public.care_appointments
for each row execute function public.set_updated_at();

alter table public.care_appointments enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view care appointments" on public.care_appointments;
create policy "Members can view care appointments"
on public.care_appointments
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT: admins / primary caregivers only. A non-null doctor must belong to the
-- same circle.
drop policy if exists "Managers can add care appointments" on public.care_appointments;
create policy "Managers can add care appointments"
on public.care_appointments
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    doctor_id is null
    or exists (
      select 1
      from public.doctors d
      where d.id = doctor_id
        and d.circle_id = circle_id
    )
  )
);

-- UPDATE: admins / primary caregivers only; the post-update doctor reference must
-- satisfy the same cross-circle integrity as INSERT.
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
  and (
    doctor_id is null
    or exists (
      select 1
      from public.doctors d
      where d.id = doctor_id
        and d.circle_id = circle_id
    )
  )
);

-- DELETE: admins / primary caregivers only.
drop policy if exists "Managers can delete care appointments" on public.care_appointments;
create policy "Managers can delete care appointments"
on public.care_appointments
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
