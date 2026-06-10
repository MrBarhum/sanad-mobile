-- Vital readings for a care circle (step 4.0).
--
-- Medical-adjacent measurements recorded by the family (blood pressure, heart
-- rate, temperature, blood sugar, oxygen saturation, weight, or other). Records
-- family-provided numbers only — the app never interprets, flags, or advises on
-- a value. One circle has many readings.
--
-- RLS model:
--   * Every active member can read the circle's readings.
--   * Admin / primary_caregiver / caregiver / family_member may add a reading,
--     attributed to themselves (recorded_by = auth.uid()) or left anonymous.
--   * A member may edit / delete their own reading (recorded_by = auth.uid()).
--   * Admins and primary caregivers may edit / delete any reading in the circle.
-- Reuses public.set_updated_at() and the security-definer helpers
-- public.is_circle_member / public.has_circle_role from the initial core schema.
--
-- Idempotent / safe to re-run (applied manually via the Sanad Dashboard): enum
-- created in a guarded DO block; table / indexes use if not exists; constraints
-- added inside pg_constraint-guarded DO blocks; triggers / policies dropped
-- before recreating. Constraints stay deliberately loose (presence / positivity
-- only) — they never encode "normal" medical ranges.

do $$
begin
  create type public.vital_reading_type as enum (
    'blood_pressure', 'heart_rate', 'temperature', 'blood_sugar',
    'oxygen_saturation', 'weight', 'other'
  );
exception
  when duplicate_object then null;
end
$$;

-- Membership helper for the manager-edit author check below (same definition as in
-- the daily_care_logs migration; defined here too so this migration is
-- self-contained and order-independent — create or replace is idempotent). Explicit
-- parameters avoid the ambiguous-unqualified-column trap an inline subquery would
-- hit (`cm.circle_id = circle_id` binding to circle_members). SECURITY DEFINER +
-- empty search_path so it runs above circle_members' RLS; ANY-status membership.
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

create table if not exists public.vital_readings (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  reading_at timestamptz not null default now(),
  reading_type public.vital_reading_type not null,
  systolic int,
  diastolic int,
  numeric_value numeric,
  unit text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vital_readings_circle_id_idx on public.vital_readings (circle_id);
-- The vitals center lists readings by time within a circle.
create index if not exists vital_readings_circle_reading_at_idx
  on public.vital_readings (circle_id, reading_at);
create index if not exists vital_readings_reading_type_idx on public.vital_readings (reading_type);

-- A blood-pressure reading carries both systolic and diastolic.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_bp_pair'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_bp_pair
      check (
        reading_type <> 'blood_pressure'
        or (systolic is not null and diastolic is not null)
      );
  end if;
end
$$;

-- A measured (non-blood-pressure) reading carries a numeric value. `other` is
-- exempt so a free-text-only note can still be recorded.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_measured_value'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_measured_value
      check (
        reading_type in ('blood_pressure', 'other')
        or numeric_value is not null
      );
  end if;
end
$$;

-- Positivity guards for any present number (no upper bounds / range judgements).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_systolic_positive'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_systolic_positive
      check (systolic is null or systolic > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_diastolic_positive'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_diastolic_positive
      check (diastolic is null or diastolic > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_numeric_value_positive'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_numeric_value_positive
      check (numeric_value is null or numeric_value > 0);
  end if;
end
$$;

drop trigger if exists vital_readings_set_updated_at on public.vital_readings;
create trigger vital_readings_set_updated_at
before update on public.vital_readings
for each row execute function public.set_updated_at();

alter table public.vital_readings enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view vital readings" on public.vital_readings;
create policy "Members can view vital readings"
on public.vital_readings
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT (members): any caregiving role may add a reading, but ONLY attributed to
-- themselves (recorded_by = auth.uid()), which pins the author to the acting member
-- and blocks cross-circle attribution. Non-managers may NOT insert an anonymous
-- (recorded_by null) row — that is the separate manager policy below.
drop policy if exists "Members can add vital readings" on public.vital_readings;
create policy "Members can add vital readings"
on public.vital_readings
for insert
to authenticated
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
);

-- INSERT (managers, anonymous): admins / primary caregivers may additionally file
-- an unattributed reading (recorded_by null) for the circle.
drop policy if exists "Managers can add anonymous vital readings" on public.vital_readings;
create policy "Managers can add anonymous vital readings"
on public.vital_readings
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and recorded_by is null
);

-- UPDATE (managers): admins / primary caregivers may edit any reading; the
-- post-update author must stay null or a member of the SAME circle, validated via
-- public.is_user_circle_member(circle_id, recorded_by). Using the helper (explicit
-- params) instead of an inline subquery avoids the ambiguous-`circle_id` trap.
-- Any-status membership, so a manager can still edit a reading whose author was
-- since removed; the client never reassigns recorded_by. Cross-circle blocked.
drop policy if exists "Managers can update vital readings" on public.vital_readings;
create policy "Managers can update vital readings"
on public.vital_readings
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (recorded_by is null or public.is_user_circle_member(circle_id, recorded_by))
);

-- UPDATE (own): a caregiving member may edit their own reading; ownership stays.
drop policy if exists "Members can update own vital readings" on public.vital_readings;
create policy "Members can update own vital readings"
on public.vital_readings
for update
to authenticated
using (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
)
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
);

-- DELETE (managers): admins / primary caregivers may remove any reading.
drop policy if exists "Managers can delete vital readings" on public.vital_readings;
create policy "Managers can delete vital readings"
on public.vital_readings
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- DELETE (own): caregivers / family members may remove their own reading.
drop policy if exists "Members can delete own vital readings" on public.vital_readings;
create policy "Members can delete own vital readings"
on public.vital_readings
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and recorded_by = auth.uid()
);
