-- Planned / recorded family visits to the care recipient (step 3.0).
--
-- A light log of who is visiting and when, so the family can coordinate company
-- and presence. Records family-provided coordination data only — no medical
-- advice. One circle has many visits; a visit may optionally be linked to the
-- visiting member's account (visitor_user_id).
--
-- RLS model:
--   * Every active member can read the circle's visits.
--   * Admins and primary caregivers manage visits fully (any visitor).
--   * Caregivers and family members may record their own visits (visitor linked
--     to their account) and update / cancel / delete those own visits.
-- Reuses public.set_updated_at() and the security-definer helpers
-- public.is_circle_member / public.has_circle_role from the initial core schema.
--
-- Idempotent / safe to re-run (applied manually via the Sanad Dashboard): the
-- enum is created in a guarded DO block; tables/indexes use if not exists; the
-- constraint is added inside a pg_constraint-guarded DO block; triggers/policies
-- are dropped before recreating.

do $$
begin
  create type public.family_visit_status as enum ('planned', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.family_visits (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  visitor_name text not null,
  visitor_user_id uuid references public.profiles(id) on delete set null,
  visit_date date not null,
  start_time time,
  end_time time,
  status public.family_visit_status not null default 'planned',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_visits_circle_id_idx on public.family_visits (circle_id);
-- The visits center lists by date within a circle.
create index if not exists family_visits_circle_date_idx on public.family_visits (circle_id, visit_date);
create index if not exists family_visits_visitor_user_id_idx on public.family_visits (visitor_user_id);

-- When both are given, a visit may not end before it starts.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.family_visits'::regclass
      and conname = 'family_visits_end_after_start'
  ) then
    alter table public.family_visits
      add constraint family_visits_end_after_start
      check (end_time is null or start_time is null or end_time >= start_time);
  end if;
end
$$;

drop trigger if exists family_visits_set_updated_at on public.family_visits;
create trigger family_visits_set_updated_at
before update on public.family_visits
for each row execute function public.set_updated_at();

alter table public.family_visits enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view family visits" on public.family_visits;
create policy "Members can view family visits"
on public.family_visits
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT (managers): admins / primary caregivers may record any visitor; a
-- non-null visitor account must be an active member of the same circle.
drop policy if exists "Managers can add family visits" on public.family_visits;
create policy "Managers can add family visits"
on public.family_visits
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    visitor_user_id is null
    or exists (
      select 1
      from public.circle_members cm
      where cm.user_id = visitor_user_id
        and cm.circle_id = circle_id
        and cm.status = 'active'
    )
  )
);

-- INSERT (own): caregivers / family members may record a visit linked to their
-- own account.
drop policy if exists "Members can add their own family visits" on public.family_visits;
create policy "Members can add their own family visits"
on public.family_visits
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
);

-- UPDATE (managers): admins / primary caregivers may change any visit; the
-- post-update visitor account must satisfy the same circle integrity as INSERT.
drop policy if exists "Managers can update family visits" on public.family_visits;
create policy "Managers can update family visits"
on public.family_visits
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    visitor_user_id is null
    or exists (
      select 1
      from public.circle_members cm
      where cm.user_id = visitor_user_id
        and cm.circle_id = circle_id
        and cm.status = 'active'
    )
  )
);

-- UPDATE (own): caregivers / family members may update / cancel their own visits
-- and may not reassign them to another member.
drop policy if exists "Members can update their own family visits" on public.family_visits;
create policy "Members can update their own family visits"
on public.family_visits
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
)
with check (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
);

-- DELETE (managers): admins / primary caregivers may delete any visit.
drop policy if exists "Managers can delete family visits" on public.family_visits;
create policy "Managers can delete family visits"
on public.family_visits
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- DELETE (own): caregivers / family members may delete their own visits.
drop policy if exists "Members can delete their own family visits" on public.family_visits;
create policy "Members can delete their own family visits"
on public.family_visits
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
);
