-- Phase 2F-1.7 — Repo backfill of the manually-applied Phase 2E claim flow.
--
-- These objects were originally applied BY HAND in the Sanad Supabase Dashboard
-- (Phase 2E; confirmed applied in
-- docs/claude-reports/2026-06-26-phase-2e-claim-flow-applied-verification.md — 7 functions,
-- 2 triggers, own-visit DELETE policy removed) and were absent from repo migrations. SQL is
-- copied verbatim from Apply-pack C of
-- docs/claude-reports/2026-06-26-phase-2f-1-6-migration-backfill-proposal.md; the outer
-- begin;/commit; wrapper is omitted to match house style (the migration runner wraps each
-- file in its own transaction). Depends on Apply-pack A columns + Apply-pack B RLS (run
-- 20260626160000 and 20260626161000 first). No new enum values. Idempotent / safe to re-run.

-- =========================================================================
-- Backfill Phase 2E-1 — Available-to-Claim / "أنا متكفّل"
-- Managers = {admin, primary_caregiver}; claim-capable = managers + {family_member, caregiver}.
-- remote_member / elder cannot claim. Depends on Apply-pack A columns + Apply-pack B RLS.
-- =========================================================================

-- 1) Discovery RPC ---------------------------------------------------------
create or replace function public.list_available_to_claim(p_circle_id uuid)
returns table (
  item_type    text,
  item_id      uuid,
  circle_id    uuid,
  title        text,
  subtitle     text,
  category     text,
  priority     text,
  scheduled_at timestamptz,
  date_value   date,
  time_value   time,
  status       text,
  created_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.circle_role;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  -- `is null` guard required: NULL not in (...) is NULL, not true.
  v_role := public.active_circle_member_role(p_circle_id);
  if v_role is null then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if v_role not in ('admin','primary_caregiver','family_member','caregiver') then
    raise exception 'your role is not allowed to view claimable items' using errcode = '42501';
  end if;

  return query
  -- 1) Unassigned open tasks
  select 'task'::text, t.id, t.circle_id, t.title,
         null::text, t.category::text, t.priority::text,
         null::timestamptz, t.due_date, t.due_time, t.status::text, t.created_at
  from public.care_tasks t
  where t.circle_id = p_circle_id and t.status = 'open' and t.assigned_to is null
  union all
  -- 2) Active medications with no responsible person
  select 'medication'::text, m.id, m.circle_id, m.name,
         m.dosage, m.form::text, null::text,
         null::timestamptz, null::date, null::time,
         case when m.is_active then 'active' else 'inactive' end, m.created_at
  from public.medications m
  where m.circle_id = p_circle_id and m.is_active = true and m.responsible_user_id is null
  union all
  -- 3) Scheduled appointments with no assignee
  select 'appointment'::text, a.id, a.circle_id, a.title,
         a.location, a.appointment_type::text, null::text,
         a.starts_at, null::date, null::time, a.status::text, a.created_at
  from public.care_appointments a
  where a.circle_id = p_circle_id and a.status = 'scheduled' and a.assigned_to is null
  union all
  -- 4) Planned visits with no linked visitor
  select 'visit'::text, v.id, v.circle_id, v.visitor_name,
         null::text, null::text, null::text,
         null::timestamptz, v.visit_date, v.start_time, v.status::text, v.created_at
  from public.family_visits v
  where v.circle_id = p_circle_id and v.status = 'planned' and v.visitor_user_id is null
  order by 8 nulls last, 9 nulls last, 10 nulls last, 12 desc;  -- scheduled_at, date_value, time_value, created_at
end;
$$;
revoke all on function public.list_available_to_claim(uuid) from public;
grant execute on function public.list_available_to_claim(uuid) to authenticated;

-- 2) Claim RPCs ------------------------------------------------------------
-- ── claim_care_task ───────────────────────────────────────────────────────────
create or replace function public.claim_care_task(p_task_id uuid)
returns public.care_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_circle  uuid;
  v_role    public.circle_role;
  v_row     public.care_tasks;
  v_claimed boolean;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select circle_id into v_circle from public.care_tasks where id = p_task_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  v_role := public.active_circle_member_role(v_circle);
  if v_role is null then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if v_role not in ('admin','primary_caregiver','family_member','caregiver') then
    raise exception 'your role is not allowed to claim items' using errcode = '42501';
  end if;

  -- Exempt this claim from enforce_care_task_collaborator_scope; reset to 'off'
  -- right after the guarded UPDATE so the bypass covers ONLY that one statement.
  perform pg_catalog.set_config('sanad.in_claim', 'on', true);

  update public.care_tasks
     set assigned_to = v_uid
   where id = p_task_id
     and assigned_to is null
     and status = 'open'
  returning * into v_row;
  v_claimed := found;  -- capture before the reset PERFORM clobbers FOUND
  perform pg_catalog.set_config('sanad.in_claim', 'off', true);

  if v_claimed then
    return v_row;
  end if;

  -- Not claimed: re-read to disambiguate. Idempotent self re-claim -> success;
  -- owned by someone else -> 23505; wrong status -> 22023.
  select * into v_row from public.care_tasks where id = p_task_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  elsif v_row.assigned_to = v_uid then
    return v_row;
  elsif v_row.assigned_to is not null then
    raise exception 'someone else already claimed this item' using errcode = '23505';
  else
    raise exception 'this item is not available to claim' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.claim_care_task(uuid) from public;
grant execute on function public.claim_care_task(uuid) to authenticated;

-- ── claim_medication_responsibility ───────────────────────────────────────────
create or replace function public.claim_medication_responsibility(p_medication_id uuid)
returns public.medications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_circle uuid;
  v_role   public.circle_role;
  v_row    public.medications;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select circle_id into v_circle from public.medications where id = p_medication_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  v_role := public.active_circle_member_role(v_circle);
  if v_role is null then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if v_role not in ('admin','primary_caregiver','family_member','caregiver') then
    raise exception 'your role is not allowed to claim items' using errcode = '42501';
  end if;

  -- No content trigger on medications: no bypass flag needed.
  update public.medications
     set responsible_user_id = v_uid
   where id = p_medication_id
     and responsible_user_id is null
     and is_active = true
  returning * into v_row;

  if found then
    return v_row;
  end if;

  -- Idempotent self re-claim -> success; owned by someone else -> 23505;
  -- inactive/ineligible -> 22023.
  select * into v_row from public.medications where id = p_medication_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  elsif v_row.responsible_user_id = v_uid then
    return v_row;
  elsif v_row.responsible_user_id is not null then
    raise exception 'someone else already claimed this item' using errcode = '23505';
  else
    raise exception 'this item is not available to claim' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.claim_medication_responsibility(uuid) from public;
grant execute on function public.claim_medication_responsibility(uuid) to authenticated;

-- ── claim_care_appointment ────────────────────────────────────────────────────
create or replace function public.claim_care_appointment(p_appointment_id uuid)
returns public.care_appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_circle uuid;
  v_role   public.circle_role;
  v_row    public.care_appointments;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select circle_id into v_circle from public.care_appointments where id = p_appointment_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  v_role := public.active_circle_member_role(v_circle);
  if v_role is null then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if v_role not in ('admin','primary_caregiver','family_member','caregiver') then
    raise exception 'your role is not allowed to claim items' using errcode = '42501';
  end if;

  -- No content trigger on care_appointments: no bypass flag needed.
  update public.care_appointments
     set assigned_to = v_uid
   where id = p_appointment_id
     and assigned_to is null
     and status = 'scheduled'
  returning * into v_row;

  if found then
    return v_row;
  end if;

  -- Idempotent self re-claim -> success; owned by someone else -> 23505;
  -- not scheduled -> 22023.
  select * into v_row from public.care_appointments where id = p_appointment_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  elsif v_row.assigned_to = v_uid then
    return v_row;
  elsif v_row.assigned_to is not null then
    raise exception 'someone else already claimed this item' using errcode = '23505';
  else
    raise exception 'this item is not available to claim' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.claim_care_appointment(uuid) from public;
grant execute on function public.claim_care_appointment(uuid) to authenticated;

-- ── claim_family_visit ────────────────────────────────────────────────────────
create or replace function public.claim_family_visit(p_visit_id uuid)
returns public.family_visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_circle  uuid;
  v_role    public.circle_role;
  v_row     public.family_visits;
  v_claimed boolean;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select circle_id into v_circle from public.family_visits where id = p_visit_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  v_role := public.active_circle_member_role(v_circle);
  if v_role is null then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if v_role not in ('admin','primary_caregiver','family_member','caregiver') then
    raise exception 'your role is not allowed to claim items' using errcode = '42501';
  end if;

  -- Exempt this claim from enforce_family_visit_collaborator_scope; reset to 'off'
  -- right after the guarded UPDATE (confines the bypass to one statement).
  perform pg_catalog.set_config('sanad.in_claim', 'on', true);

  update public.family_visits
     set visitor_user_id = v_uid
   where id = p_visit_id
     and visitor_user_id is null
     and status = 'planned'
  returning * into v_row;
  v_claimed := found;  -- capture before the reset PERFORM clobbers FOUND
  perform pg_catalog.set_config('sanad.in_claim', 'off', true);

  if v_claimed then
    return v_row;
  end if;

  -- Idempotent self re-claim -> success; owned by someone else -> 23505;
  -- not planned -> 22023.
  select * into v_row from public.family_visits where id = p_visit_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  elsif v_row.visitor_user_id = v_uid then
    return v_row;
  elsif v_row.visitor_user_id is not null then
    raise exception 'someone else already claimed this item' using errcode = '23505';
  else
    raise exception 'this item is not available to claim' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.claim_family_visit(uuid) from public;
grant execute on function public.claim_family_visit(uuid) to authenticated;

-- 3) Appointment outcome RPC ----------------------------------------------
create or replace function public.set_assigned_appointment_outcome(
  p_appointment_id uuid,
  p_status public.care_appointment_status
)
returns public.care_appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_circle     uuid;
  v_assigned   uuid;
  v_status     public.care_appointment_status;
  v_is_manager boolean;
  v_row        public.care_appointments;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  -- `is null` guard required: NULL not in (...) is NULL (not true), which would
  -- otherwise fall through to a raw 23502 NOT NULL violation on status.
  if p_status is null or p_status not in ('completed','cancelled') then
    raise exception 'outcome must be completed or cancelled' using errcode = '22023';
  end if;

  select circle_id, assigned_to, status
    into v_circle, v_assigned, v_status
  from public.care_appointments
  where id = p_appointment_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  v_is_manager := public.has_circle_role(
    v_circle, array['admin','primary_caregiver']::public.circle_role[]);

  if not v_is_manager then
    if not public.has_circle_role(
         v_circle, array['family_member','caregiver']::public.circle_role[]) then
      raise exception 'you are not allowed to update this appointment' using errcode = '42501';
    end if;
    if v_assigned is distinct from v_uid then
      raise exception 'only the assigned member can update this appointment' using errcode = '42501';
    end if;
  end if;

  if v_status <> 'scheduled' then
    raise exception 'only a scheduled appointment can be completed or cancelled' using errcode = '22023';
  end if;

  update public.care_appointments
     set status = p_status
   where id = p_appointment_id
     and status = 'scheduled'
  returning * into v_row;

  if not found then
    raise exception 'only a scheduled appointment can be completed or cancelled' using errcode = '22023';
  end if;
  return v_row;
end;
$$;
revoke all on function public.set_assigned_appointment_outcome(uuid, public.care_appointment_status) from public;
grant execute on function public.set_assigned_appointment_outcome(uuid, public.care_appointment_status) to authenticated;

-- 4) care_tasks trigger fn — ADD the claim bypass (rest is the verified 2D body) --
create or replace function public.enforce_care_task_collaborator_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- NEW: exempt the SECURITY DEFINER claim RPC (claim_care_task). tx-local flag;
  -- unreachable by direct client UPDATE.
  if coalesce(pg_catalog.current_setting('sanad.in_claim', true), '') = 'on' then
    return new;
  end if;

  -- Managers may change anything.
  if public.has_circle_role(old.circle_id, array['admin','primary_caregiver']::public.circle_role[]) then
    return new;
  end if;
  -- Non-managers: only act on a currently-open task.
  if old.status <> 'open' then
    raise exception 'collaborators may only act on an open task';
  end if;
  -- ...and only to complete or cancel it.
  if new.status not in ('completed','cancelled') then
    raise exception 'collaborators may only complete or cancel a task';
  end if;
  -- Content fields immutable for collaborators.
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
  -- Completion bookkeeping must be honest.
  if new.status = 'completed' then
    if new.completed_by is distinct from auth.uid() or new.completed_at is null then
      raise exception 'completing a task must set completed_by to the current user and completed_at';
    end if;
  else -- new.status = 'cancelled'
    if new.cancelled_at is null or new.completed_by is not null then
      raise exception 'cancelling a task must set cancelled_at and leave completed_by null';
    end if;
  end if;
  return new;
end;
$$;
-- (trigger care_tasks_collaborator_scope already exists and is unchanged.)

-- 5) family_visits status-only collaborator trigger fn + binding ------------
create or replace function public.enforce_family_visit_collaborator_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Exempt the SECURITY DEFINER claim RPC (claim_family_visit).
  if coalesce(pg_catalog.current_setting('sanad.in_claim', true), '') = 'on' then
    return new;
  end if;

  -- Managers may change anything.
  if public.has_circle_role(old.circle_id, array['admin','primary_caregiver']::public.circle_role[]) then
    return new;
  end if;
  -- Non-managers (linked visitor): only act on a currently-planned visit.
  if old.status <> 'planned' then
    raise exception 'collaborators may only act on a planned visit';
  end if;
  -- ...and only to complete or cancel it.
  if new.status not in ('completed','cancelled') then
    raise exception 'collaborators may only complete or cancel a visit';
  end if;
  -- Content fields immutable for collaborators (incl. no relink, no circle move).
  if new.circle_id is distinct from old.circle_id
     or new.visitor_name is distinct from old.visitor_name
     or new.visitor_user_id is distinct from old.visitor_user_id
     or new.visit_date is distinct from old.visit_date
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.notes is distinct from old.notes
     or new.created_by is distinct from old.created_by then
    raise exception 'collaborators may not change a visit''s details';
  end if;
  return new;
end;
$$;

drop trigger if exists family_visits_collaborator_scope on public.family_visits;
create trigger family_visits_collaborator_scope
before update on public.family_visits
for each row execute function public.enforce_family_visit_collaborator_scope();

-- 6) Tighten family_visits DELETE to manager-only (close claim -> delete escalation) --
drop policy if exists "Members can delete their own family visits" on public.family_visits;
-- "Managers can delete family visits" remains and is sufficient.

notify pgrst, 'reload schema';
