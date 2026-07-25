-- Milestone 7 · A8 — Restore the claim bypass in the care-task collaborator trigger.
--
-- ROOT CAUSE (regression, not a new feature):
--   20260626162000_backfill_phase_2e_claim_flow.sql:407-418 re-created
--   public.enforce_care_task_collaborator_scope() and ADDED a tx-local bypass so
--   the SECURITY DEFINER claim RPC could reassign an OPEN task:
--
--       if coalesce(pg_catalog.current_setting('sanad.in_claim', true), '') = 'on'
--         then return new; end if;
--
--   20260715120000_add_cancelled_by_to_care_tasks.sql:35 then re-created the SAME
--   function to add the cancelled_by bookkeeping — but branched from the ORIGINAL
--   20260610090000 body (its own comment says so at :32-34) and therefore DROPPED
--   the bypass. `grep in_claim` returns 6 hits in 20260626162000 and 0 in
--   20260715120000. Because 20260715120000 sorts last, the deployed trigger has no
--   bypass.
--
-- EFFECT: public.claim_care_task still sets sanad.in_claim = 'on'
--   (20260626162000:124) and updates assigned_to while status = 'open'. With the
--   bypass gone the trigger reaches
--   `if new.status not in ('completed','cancelled')` and raises
--   'collaborators may only complete or cancel a task'. So a family_member or
--   caregiver CANNOT claim a task («أنا متكفّل»).
--   public.enforce_family_visit_collaborator_scope() was never re-created and still
--   HAS its bypass (20260626162000:468), so visit claiming keeps working — the
--   failure is partial and reads as a task-specific bug rather than a regression.
--   Medication and appointment claims have no trigger and are unaffected.
--
-- FIX: re-create the function as the exact UNION of the two bodies — the
--   20260715120000 body (cancelled_by bookkeeping) with the 20260626162000 bypass
--   restored as the first statement. Nothing else changes; no policy, column,
--   constraint, or trigger binding is touched (the trigger
--   care_tasks_collaborator_scope from 20260610090000:198 already points here).
--
-- Idempotent: `create or replace function` only. Safe to re-run.
--
-- NOT auto-applied — see the Milestone 7 runbook step R4 in
-- docs/claude-reports/2026-07-26-milestone-7-plan.md.
--
-- MAINTAINER NOTE: three migrations now define this function
-- (20260610090000, 20260626162000, 20260715120000, and this one). If any future
-- migration re-creates it again, it MUST carry both the sanad.in_claim bypass and
-- the cancelled_by branch, or one of the two features silently breaks.

create or replace function public.enforce_care_task_collaborator_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Exempt the SECURITY DEFINER claim RPC (public.claim_care_task). The flag is
  -- transaction-local and set only inside that function, so it is unreachable by a
  -- direct client UPDATE. RESTORED — see the header.
  if coalesce(pg_catalog.current_setting('sanad.in_claim', true), '') = 'on' then
    return new;
  end if;

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

-- Read-only verification (run after applying; expects exactly one row, `t`):
--   select p.proname,
--          position('sanad.in_claim' in pg_get_functiondef(p.oid)) > 0 as has_bypass,
--          position('cancelled_by' in pg_get_functiondef(p.oid)) > 0  as has_cancelled_by
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname = 'enforce_care_task_collaborator_scope';

notify pgrst, 'reload schema';
