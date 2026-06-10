-- Shared care tasks for a care circle (step 3.0).
--
-- A to-do list the family and caregivers coordinate around (errands, meals,
-- hygiene, movement, appointments to attend, …). Records family-provided
-- coordination data only — no medical advice. One circle has many tasks.
--
-- RLS model:
--   * Every active member can read the circle's tasks.
--   * Admins and primary caregivers manage tasks fully (create / edit / delete).
--   * Caregivers and family members may act on tasks that are assigned to them
--     or left unassigned (e.g. mark them completed / cancelled) — supporting
--     normal family collaboration — but may not reassign a task to someone else.
-- Reuses public.set_updated_at() and the security-definer helpers
-- public.is_circle_member / public.has_circle_role from the initial core schema.
--
-- Idempotent / safe to re-run (applied manually via the Sanad Dashboard, so the
-- CLI migration history may not record it): enums are created in guarded DO
-- blocks (no `create type if not exists` in Postgres); tables/indexes use
-- if not exists; constraints are added inside pg_constraint-guarded DO blocks;
-- triggers/policies are dropped before recreating.

do $$
begin
  create type public.care_task_category as enum (
    'general', 'medication', 'meal', 'hygiene', 'movement', 'errand', 'appointment', 'other'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.care_task_priority as enum ('low', 'normal', 'high', 'urgent');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.care_task_status as enum ('open', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  title text not null,
  description text,
  category public.care_task_category not null default 'general',
  priority public.care_task_priority not null default 'normal',
  status public.care_task_status not null default 'open',
  due_date date,
  due_time time,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_tasks_circle_id_idx on public.care_tasks (circle_id);
-- The task center lists / filters by due date and by status within a circle.
create index if not exists care_tasks_circle_due_idx on public.care_tasks (circle_id, due_date);
create index if not exists care_tasks_circle_status_idx on public.care_tasks (circle_id, status);
create index if not exists care_tasks_assigned_to_idx on public.care_tasks (assigned_to);

-- Keep the status and its timestamp consistent: a task is completed exactly when
-- completed_at is set, and cancelled exactly when cancelled_at is set, so a row
-- never carries a stale or conflicting timestamp. The app sets these alongside
-- the status transition. Guarded so the migration is safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_tasks'::regclass
      and conname = 'care_tasks_completed_at_consistent'
  ) then
    alter table public.care_tasks
      add constraint care_tasks_completed_at_consistent
      check ((status = 'completed') = (completed_at is not null));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_tasks'::regclass
      and conname = 'care_tasks_cancelled_at_consistent'
  ) then
    alter table public.care_tasks
      add constraint care_tasks_cancelled_at_consistent
      check ((status = 'cancelled') = (cancelled_at is not null));
  end if;
end
$$;

-- completed_by may only be set when the task is completed (so open / cancelled
-- tasks never carry a completer). One-directional on purpose: a completed task is
-- allowed to have completed_by null, so the completed_by FK's `on delete set
-- null` (when a member is removed) can never violate this constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_tasks'::regclass
      and conname = 'care_tasks_completed_by_consistent'
  ) then
    alter table public.care_tasks
      add constraint care_tasks_completed_by_consistent
      check (completed_by is null or status = 'completed');
  end if;
end
$$;

drop trigger if exists care_tasks_set_updated_at on public.care_tasks;
create trigger care_tasks_set_updated_at
before update on public.care_tasks
for each row execute function public.set_updated_at();

-- Column-level scope for collaborators. The collaborator UPDATE policy below lets
-- caregivers / family members touch tasks assigned to them or left unassigned,
-- but RLS WITH CHECK cannot compare against the previous row, so it cannot stop
-- them rewriting a task's content, reassigning it, spoofing who completed it, or
-- acting on an already-closed task. This trigger enforces that a non-manager may
-- ONLY transition an OPEN task to completed or cancelled, may not change any
-- content field, and must set the completion bookkeeping honestly (completed_by
-- = the acting user). Managers (admin / primary_caregiver) are exempt. It runs in
-- addition to (not instead of) the RLS policies, which still gate which rows each
-- role may touch.
--
-- SECURITY DEFINER with an empty search_path: every object is schema-qualified
-- (public.* / auth.uid()) so the function cannot be hijacked by a caller-set
-- search_path.
create or replace function public.enforce_care_task_collaborator_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Managers may change anything.
  if public.has_circle_role(
    old.circle_id,
    array['admin', 'primary_caregiver']::public.circle_role[]
  ) then
    return new;
  end if;

  -- Non-managers (caregiver / family_member): only act on a currently-open task.
  if old.status <> 'open' then
    raise exception 'collaborators may only act on an open task';
  end if;

  -- ...and only to complete or cancel it.
  if new.status not in ('completed', 'cancelled') then
    raise exception 'collaborators may only complete or cancel a task';
  end if;

  -- Content fields are immutable for collaborators.
  if new.circle_id is distinct from old.circle_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.priority is distinct from old.priority
    or new.due_date is distinct from old.due_date
    or new.due_time is distinct from old.due_time
    or new.assigned_to is distinct from old.assigned_to
    or new.created_by is distinct from old.created_by then
    raise exception 'collaborators may not change a task''s content';
  end if;

  -- Completion bookkeeping must be honest (no spoofing completed_by).
  if new.status = 'completed' then
    if new.completed_by is distinct from auth.uid() or new.completed_at is null then
      raise exception 'completing a task must set completed_by to the current user and completed_at';
    end if;
  else
    -- new.status = 'cancelled'
    if new.cancelled_at is null or new.completed_by is not null then
      raise exception 'cancelling a task must set cancelled_at and leave completed_by null';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists care_tasks_collaborator_scope on public.care_tasks;
create trigger care_tasks_collaborator_scope
before update on public.care_tasks
for each row execute function public.enforce_care_task_collaborator_scope();

alter table public.care_tasks enable row level security;

-- SELECT: any active member of the circle.
drop policy if exists "Members can view care tasks" on public.care_tasks;
create policy "Members can view care tasks"
on public.care_tasks
for select
to authenticated
using (public.is_circle_member(circle_id));

-- INSERT: admins and primary caregivers only. A non-null assignee must be an
-- active member of the same circle (blocks cross-circle assignment).
drop policy if exists "Managers can add care tasks" on public.care_tasks;
create policy "Managers can add care tasks"
on public.care_tasks
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    assigned_to is null
    or exists (
      select 1
      from public.circle_members cm
      where cm.user_id = assigned_to
        and cm.circle_id = circle_id
        and cm.status = 'active'
    )
  )
);

-- UPDATE (managers): admins / primary caregivers may change any task; the
-- post-update assignee must still be null or an active member of the circle.
drop policy if exists "Managers can update care tasks" on public.care_tasks;
create policy "Managers can update care tasks"
on public.care_tasks
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    assigned_to is null
    or exists (
      select 1
      from public.circle_members cm
      where cm.user_id = assigned_to
        and cm.circle_id = circle_id
        and cm.status = 'active'
    )
  )
);

-- UPDATE (collaborators): caregivers / family members may act on a task that is
-- assigned to them or left unassigned (e.g. mark it completed / cancelled). The
-- with-check keeps the assignee null or self, and the care_tasks_collaborator_
-- scope trigger restricts them to changing only the task's status — they cannot
-- edit a task's content or reassign it; that stays with managers.
drop policy if exists "Members can update assigned care tasks" on public.care_tasks;
create policy "Members can update assigned care tasks"
on public.care_tasks
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and (assigned_to is null or assigned_to = auth.uid())
)
with check (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and (assigned_to is null or assigned_to = auth.uid())
);

-- DELETE: admins and primary caregivers only.
drop policy if exists "Managers can delete care tasks" on public.care_tasks;
create policy "Managers can delete care tasks"
on public.care_tasks
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
