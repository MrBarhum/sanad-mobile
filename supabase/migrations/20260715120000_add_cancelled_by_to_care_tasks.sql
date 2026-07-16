-- Milestone 4 · A9 / P3-2 — record WHO cancelled a task (mirror of completed_by).
--
-- Additive and idempotent. NOT auto-applied. Apply it BEFORE shipping the client
-- build that writes `cancelled_by` (see docs/claude-reports/2026-07-14-milestone-4-runbook.md)
-- or the cancel write fails with "column cancelled_by does not exist".

-- 1) The column. `on delete set null` so removing a member never violates the
--    consistency constraint below (matches completed_by's FK behavior).
alter table public.care_tasks
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null;

-- 2) cancelled_by may only be set on a cancelled task (mirrors
--    care_tasks_completed_by_consistent). One-directional: a cancelled task may
--    still have cancelled_by null (legacy rows), so the FK's on-delete-set-null
--    can never break this check.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_tasks'::regclass
      and conname = 'care_tasks_cancelled_by_consistent'
  ) then
    alter table public.care_tasks
      add constraint care_tasks_cancelled_by_consistent
      check (cancelled_by is null or status = 'cancelled');
  end if;
end
$$;

-- 3) Extend the collaborator-scope trigger so a non-manager who cancels records an
--    HONEST cancelled_by (their own uid, never spoofed) and a completing
--    collaborator never sets cancelled_by. Managers stay exempt. This is the exact
--    body from the create migration (20260610090000) with only the completion-
--    bookkeeping branch extended — keep the two in sync if either changes.
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

  -- Completion bookkeeping must be honest (no spoofing completed_by / cancelled_by).
  if new.status = 'completed' then
    if new.completed_by is distinct from auth.uid() or new.completed_at is null then
      raise exception 'completing a task must set completed_by to the current user and completed_at';
    end if;
    if new.cancelled_by is not null then
      raise exception 'a completed task must not carry cancelled_by';
    end if;
  else
    -- new.status = 'cancelled'
    if new.cancelled_at is null or new.completed_by is not null then
      raise exception 'cancelling a task must set cancelled_at and leave completed_by null';
    end if;
    if new.cancelled_by is not null and new.cancelled_by is distinct from auth.uid() then
      raise exception 'cancelling a task must set cancelled_by to the current user';
    end if;
  end if;

  return new;
end;
$$;
