-- Medication dose logs for a care circle (step 2.0).
--
-- One row records the outcome of a single scheduled dose (given / missed /
-- postponed). A partial unique index prevents duplicate logs for the same
-- scheduled dose (schedule_id + dose_date + scheduled_time) while still allowing
-- ad-hoc logs that are not tied to a schedule (schedule_id is null).
--
-- RLS differs from medications/schedules: any caregiving member (admin,
-- primary_caregiver, family_member, caregiver) may record/confirm a dose, but
-- only admins / primary caregivers may delete a log. Members can read.
--
-- Idempotent / safe to re-run: the enum is created inside a guarded DO block
-- (no `create type if not exists` exists in Postgres); tables/indexes use
-- if not exists; triggers/policies are dropped before recreate.

do $$
begin
  create type public.medication_log_status as enum ('given', 'missed', 'postponed');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  schedule_id uuid references public.medication_schedules(id) on delete set null,
  dose_date date not null,
  scheduled_time time not null,
  status public.medication_log_status not null,
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medication_logs_circle_id_idx on public.medication_logs (circle_id);
-- Today's-doses queries fetch a circle's logs for one date.
create index if not exists medication_logs_circle_date_idx
  on public.medication_logs (circle_id, dose_date);
create index if not exists medication_logs_medication_id_idx
  on public.medication_logs (medication_id);

-- One log per scheduled dose (when tied to a schedule). Ad-hoc logs
-- (schedule_id is null) are exempt so they can be recorded freely.
create unique index if not exists medication_logs_scheduled_dose_unique
  on public.medication_logs (schedule_id, dose_date, scheduled_time)
  where schedule_id is not null;

drop trigger if exists medication_logs_set_updated_at on public.medication_logs;
create trigger medication_logs_set_updated_at
before update on public.medication_logs
for each row execute function public.set_updated_at();

alter table public.medication_logs enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view medication logs" on public.medication_logs;
create policy "Members can view medication logs"
on public.medication_logs
for select
to authenticated
using (public.is_circle_member(circle_id));

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
  and exists (
    select 1
    from public.medications m
    where m.id = medication_id
      and m.circle_id = circle_id
  )
  and (
    schedule_id is null
    or exists (
      select 1
      from public.medication_schedules s
      where s.id = schedule_id
        and s.circle_id = circle_id
        and s.medication_id = medication_id
    )
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
  and exists (
    select 1
    from public.medications m
    where m.id = medication_id
      and m.circle_id = circle_id
  )
  and (
    schedule_id is null
    or exists (
      select 1
      from public.medication_schedules s
      where s.id = schedule_id
        and s.circle_id = circle_id
        and s.medication_id = medication_id
    )
  )
);

-- DELETE: admins and primary caregivers only.
drop policy if exists "Managers can delete medication logs" on public.medication_logs;
create policy "Managers can delete medication logs"
on public.medication_logs
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
