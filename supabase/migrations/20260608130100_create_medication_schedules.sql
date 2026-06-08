-- Medication schedules for a care circle (step 2.0).
--
-- When a medication should be taken. One medication has many schedules; each
-- schedule has a set of weekdays and a set of times. Same RLS model as
-- medications: members read, admins / primary caregivers mutate.
--
-- days_of_week convention: 0 = Sunday, 1 = Monday, ... 6 = Saturday (matches
-- JavaScript Date.getDay()). The client computes "today's doses" using the local
-- device weekday against this array.
--
-- Idempotent / safe to re-run: create table/index if not exists, and drop
-- trigger/policy if exists before recreating.

create table if not exists public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  -- 0 = Sunday .. 6 = Saturday (JS Date.getDay()).
  days_of_week int[] not null default array[0, 1, 2, 3, 4, 5, 6],
  times time[] not null,
  start_date date not null default current_date,
  end_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medication_schedules_circle_id_idx
  on public.medication_schedules (circle_id);
create index if not exists medication_schedules_medication_id_idx
  on public.medication_schedules (medication_id);

-- Data-integrity CHECK constraints, added idempotently (guarded on pg_constraint
-- so re-running never errors on an already-present constraint, and we avoid bare
-- ALTER TABLE ADD CONSTRAINT which is not re-runnable).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and conname = 'medication_schedules_days_nonempty'
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_days_nonempty
      check (coalesce(array_length(days_of_week, 1), 0) >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and conname = 'medication_schedules_days_range'
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_days_range
      check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and conname = 'medication_schedules_times_nonempty'
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_times_nonempty
      check (coalesce(array_length(times, 1), 0) >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and conname = 'medication_schedules_date_range'
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_date_range
      check (end_date is null or end_date >= start_date);
  end if;
end
$$;

drop trigger if exists medication_schedules_set_updated_at on public.medication_schedules;
create trigger medication_schedules_set_updated_at
before update on public.medication_schedules
for each row execute function public.set_updated_at();

alter table public.medication_schedules enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view medication schedules" on public.medication_schedules;
create policy "Members can view medication schedules"
on public.medication_schedules
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT: admins and primary caregivers only, and the referenced medication must
-- belong to the same circle (blocks cross-circle medication_id references).
drop policy if exists "Managers can add medication schedules" on public.medication_schedules;
create policy "Managers can add medication schedules"
on public.medication_schedules
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and exists (
    select 1
    from public.medications m
    where m.id = medication_id
      and m.circle_id = circle_id
  )
);

-- UPDATE: admins and primary caregivers only; the post-update medication must
-- still belong to the same circle.
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
  and exists (
    select 1
    from public.medications m
    where m.id = medication_id
      and m.circle_id = circle_id
  )
);

-- DELETE: admins and primary caregivers only.
drop policy if exists "Managers can delete medication schedules" on public.medication_schedules;
create policy "Managers can delete medication schedules"
on public.medication_schedules
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
