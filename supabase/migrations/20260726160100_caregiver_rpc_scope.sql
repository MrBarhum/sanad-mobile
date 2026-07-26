-- Milestone 8 · C1 — scope the SECURITY DEFINER read/claim RPCs away from the
-- hired caregiver.
--
-- ── WHY THIS FILE EXISTS SEPARATELY FROM THE RLS ONE ─────────────────────────
--
-- 20260726160000 narrows what a caregiver can read at the ROW level, and it does
-- so purely additively, with RESTRICTIVE policies that cannot touch another
-- role. That technique does not reach here. Every function below is
-- `SECURITY DEFINER`, which means it runs as the owner and BYPASSES RLS
-- entirely — `list_care_activity` happily returns all 45 pulse rows to a
-- `family_member` whose `can_view_all_operational()` is FALSE. A restrictive
-- policy is invisible to it. The gate has to live inside the function body, so
-- these nine functions must be replaced.
--
-- ── HOW THE REPLACEMENT WAS PRODUCED (this matters) ──────────────────────────
--
-- NOT hand-written. Each body below was read out of PRODUCTION with
-- `pg_get_functiondef(oid)` and then edited by a script that ASSERTS its pattern
-- matched exactly once, aborting otherwise. The generated diff was reviewed line
-- by line before this file was committed.
--
-- That precaution is not theatre. This milestone discovered that FOUR function
-- bodies in production do not match the repo file that supposedly created them
-- (`create_circle_invitation`, `update_circle_member_role`, `leave_care_circle`,
-- `update_circle_member_status` — all from 20260610130100, which the migration
-- ledger nonetheless reports as applied). Had these replacements been written by
-- copying the repo's version of each function, this migration would have
-- silently shipped whatever else had drifted along with it — including an
-- unreviewed lock-ordering change to the last-admin race. Generating from the
-- live definition makes the edit named in each section header the ONLY
-- difference between what runs today and what runs after this file.
--
-- ── THE EDITS, AND WHY EACH IS SAFE FOR THE OTHER FOUR ROLES ─────────────────
--
--  * Six functions — claim_care_task, claim_care_appointment, claim_family_visit,
--    claim_medication_responsibility, list_available_to_claim,
--    set_assigned_appointment_outcome — carry a literal role allow-list
--    `('admin','primary_caregiver','family_member','caregiver')`. The edit
--    deletes the single token `,'caregiver'`. Nothing else in those bodies
--    changes, so no other role's path is even reachable by the diff.
--
--    Claiming is deliberately NOT part of the hired-caregiver role. She works a
--    given list; she does not pick up unowned family work. `remote_member` was
--    already refused here and stays refused, with the same message and the same
--    SQLSTATE.
--
--  * list_care_activity gains one conjunct on its existing visibility gate:
--    `and not public.is_circle_caregiver(p_circle_id)`. For every other role
--    that helper returns FALSE, so the conjunct is TRUE and the result set is
--    bit-for-bit unchanged. The activity feed is the family's oversight view.
--
--    Note this yields an EMPTY RESULT rather than an exception, because the
--    function is `language sql` and converting it to plpgsql to raise would mean
--    rewriting all 130 lines — a far larger blast radius than the guard is
--    worth. The negative test therefore asserts that a caregiver gets 0 rows
--    while an admin in the same circle gets the full feed, which is unambiguous.
--
--  * list_circle_members gains an explicit `42501` refusal for a caregiver. It
--    has to be here: the RESTRICTIVE policy added to `circle_members` in
--    20260726160000 narrows the TABLE, and this function bypasses the table's
--    RLS. Both halves are needed, and both are tested.
--
-- ── WHAT IS NOT CHANGED ──────────────────────────────────────────────────────
--
--  * No signature, return type, volatility, security setting or `search_path` is
--    touched on any function — those come straight from `pg_get_functiondef`.
--  * `create or replace` preserves existing privileges, so the H1 grant posture
--    (authenticated + service_role, never anon) survives. The assertion block at
--    the foot of this file proves that rather than assuming it.
--  * `notification_recipient_eligible` and `notification_recipients_for_item_event`
--    still include `caregiver`. She SHOULD receive a reminder for a dose she is
--    responsible for — that is her worklist arriving, not the family's
--    coordination layer. Left deliberately.
--
-- Reversible: re-running the generator against the pre-migration definitions
-- restores them exactly; the pre-edit bodies are archived in the milestone
-- report.

-- ── claim_care_task — drop 'caregiver' from the role allow-list ──────────────────
CREATE OR REPLACE FUNCTION public.claim_care_task(p_task_id uuid)
 RETURNS care_tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_role not in ('admin','primary_caregiver','family_member') then
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
$function$
;

-- ── claim_care_appointment — drop 'caregiver' from the role allow-list ───────────
CREATE OR REPLACE FUNCTION public.claim_care_appointment(p_appointment_id uuid)
 RETURNS care_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_role not in ('admin','primary_caregiver','family_member') then
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
$function$
;

-- ── claim_family_visit — drop 'caregiver' from the role allow-list ───────────────
CREATE OR REPLACE FUNCTION public.claim_family_visit(p_visit_id uuid)
 RETURNS family_visits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_role not in ('admin','primary_caregiver','family_member') then
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
$function$
;

-- ── claim_medication_responsibility — drop 'caregiver' from the role allow-list ───
CREATE OR REPLACE FUNCTION public.claim_medication_responsibility(p_medication_id uuid)
 RETURNS medications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_role not in ('admin','primary_caregiver','family_member') then
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
$function$
;

-- ── list_available_to_claim — drop 'caregiver' from the role allow-list ──────────
CREATE OR REPLACE FUNCTION public.list_available_to_claim(p_circle_id uuid)
 RETURNS TABLE(item_type text, item_id uuid, circle_id uuid, title text, subtitle text, category text, priority text, scheduled_at timestamp with time zone, date_value date, time_value time without time zone, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_role not in ('admin','primary_caregiver','family_member') then
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
$function$
;

-- ── set_assigned_appointment_outcome — drop 'caregiver' from the collaborator role array ───
CREATE OR REPLACE FUNCTION public.set_assigned_appointment_outcome(p_appointment_id uuid, p_status care_appointment_status)
 RETURNS care_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
         v_circle, array['family_member']::public.circle_role[]) then
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
$function$
;

-- ── list_care_activity — exclude caregivers from the pulse gate ──────────────────
CREATE OR REPLACE FUNCTION public.list_care_activity(p_circle_id uuid, p_limit integer DEFAULT 30, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(event_type text, event_id uuid, occurred_at timestamp with time zone, actor_user_id uuid, actor_name text, title text, subtitle text, item_type text, item_id uuid, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with events as (
    -- A dose was logged (given / postponed / missed).
    select
      'dose_logged'::text as event_type,
      ml.id as event_id,
      coalesce(ml.recorded_at, ml.created_at) as occurred_at,
      ml.recorded_by as actor_user_id,
      m.name as title,
      ml.status::text as subtitle,
      'medication'::text as item_type,
      ml.medication_id as item_id,
      ml.status::text as status
    from public.medication_logs ml
    join public.medications m on m.id = ml.medication_id
    where ml.circle_id = p_circle_id

    union all
    -- A task was completed or marked couldn't-complete.
    select
      case when t.status = 'completed' then 'task_completed' else 'task_cancelled' end,
      t.id,
      coalesce(t.completed_at, t.cancelled_at),
      coalesce(t.completed_by, t.cancelled_by),
      t.title,
      null::text,
      'task'::text,
      t.id,
      t.status::text
    from public.care_tasks t
    where t.circle_id = p_circle_id and t.status in ('completed', 'cancelled')

    union all
    -- An appointment outcome was recorded.
    select
      'appointment_outcome'::text,
      a.id,
      a.updated_at,
      a.assigned_to,
      a.title,
      a.status::text,
      'appointment'::text,
      a.id,
      a.status::text
    from public.care_appointments a
    where a.circle_id = p_circle_id and a.status in ('completed', 'cancelled')

    union all
    -- A visit was completed.
    select
      'visit_completed'::text,
      v.id,
      v.updated_at,
      v.visitor_user_id,
      v.visitor_name,
      null::text,
      'visit'::text,
      v.id,
      v.status::text
    from public.family_visits v
    where v.circle_id = p_circle_id and v.status = 'completed'

    union all
    -- A vital reading was recorded.
    select
      'vital_recorded'::text,
      vr.id,
      coalesce(vr.reading_at, vr.created_at),
      vr.recorded_by,
      vr.reading_type::text,
      null::text,
      'vital'::text,
      vr.id,
      null::text
    from public.vital_readings vr
    where vr.circle_id = p_circle_id

    union all
    -- A daily wellbeing log was added.
    select
      'daily_log_added'::text,
      d.id,
      d.created_at,
      d.recorded_by,
      d.log_date::text,
      null::text,
      'daily_log'::text,
      d.id,
      null::text
    from public.daily_care_logs d
    where d.circle_id = p_circle_id

    union all
    -- A member joined the circle.
    select
      'member_joined'::text,
      cm.id,
      cm.created_at,
      cm.user_id,
      null::text,
      cm.role::text,
      'member'::text,
      cm.id,
      cm.status::text
    from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.status = 'active'
  )
  select
    e.event_type,
    e.event_id,
    e.occurred_at,
    e.actor_user_id,
    p.full_name as actor_name,
    e.title,
    e.subtitle,
    e.item_type,
    e.item_id,
    e.status
  from events e
  left join public.profiles p on p.id = e.actor_user_id
  -- Visibility gate: only an active member of the circle sees its pulse. This
  -- SECURITY DEFINER function bypasses RLS, so this check is load-bearing.
  where public.is_circle_member(p_circle_id)
    -- Milestone 8: the activity feed is the family's oversight view. A hired
    -- caregiver sees the care work in front of her, not the coordination layer.
    -- For every other role is_circle_caregiver() is FALSE, so this conjunct is
    -- TRUE and their result set is bit-for-bit what it was before.
    and not public.is_circle_caregiver(p_circle_id)
    and e.occurred_at is not null
    and (p_before is null or e.occurred_at < p_before)
  order by e.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$
;

-- ── list_circle_members — refuse the roster to a caregiver ───────────────────────
CREATE OR REPLACE FUNCTION public.list_circle_members(p_circle_id uuid)
 RETURNS TABLE(member_id uuid, user_id uuid, role circle_role, status member_status, full_name text, email text, is_self boolean, is_owner boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role public.circle_role;
  v_is_manager boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  v_role := public.active_circle_member_role(p_circle_id);
  if v_role is null then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  -- Milestone 8: a hired caregiver may not view the member roster. This RPC is
  -- SECURITY DEFINER and bypasses RLS, so the restrictive policy on
  -- circle_members cannot reach it — the refusal has to live here.
  if v_role = 'caregiver' then
    raise exception 'your role is not allowed to view the member roster'
      using errcode = '42501';
  end if;
  v_is_manager := v_role in ('admin', 'primary_caregiver');

  return query
  select
    cm.id,
    cm.user_id,
    cm.role,
    cm.status,
    p.full_name,
    -- Managers see every email; anyone sees their own; others get NULL.
    case when v_is_manager or cm.user_id = auth.uid() then u.email::text else null end,
    (cm.user_id = auth.uid()),
    (cm.user_id = cc.owner_id),
    cm.created_at
  from public.circle_members cm
  join public.care_circles cc on cc.id = cm.circle_id
  left join public.profiles p on p.id = cm.user_id
  left join auth.users u on u.id = cm.user_id
  where cm.circle_id = p_circle_id
  order by
    case cm.status when 'active' then 0 else 1 end,
    case cm.role
      when 'admin' then 0
      when 'primary_caregiver' then 1
      when 'caregiver' then 2
      when 'family_member' then 3
      when 'remote_member' then 4
      else 5
    end,
    cm.created_at asc;
end;
$function$
;

-- ── Assert the outcome ───────────────────────────────────────────────────────
--
-- `create or replace function` is silent about almost everything that could go
-- wrong here: a body that failed to pick up the guard, a privilege that was
-- dropped, a role token that was removed from the wrong list. So it is checked.
do $$
declare
  n     integer;
  bad   text;
  fname text;
  guarded constant text[] := array[
    'claim_care_task',
    'claim_care_appointment',
    'claim_family_visit',
    'claim_medication_responsibility',
    'list_available_to_claim',
    'set_assigned_appointment_outcome'
  ];
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  -- 1. The six allow-lists no longer mention caregiver, and STILL mention the
  --    three roles that were always there. Checking only the removal would pass
  --    even if the whole list had been deleted.
  foreach fname in array guarded loop
    select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname  = fname
      and p.prosrc like '%''caregiver''%';
    if n <> 0 then
      bad := coalesce(bad || ', ', '') || fname || ' (still allows caregiver)';
    end if;

    select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname  = fname
      and p.prosrc like '%''admin''%'
      and p.prosrc like '%''primary_caregiver''%'
      and p.prosrc like '%''family_member''%';
    if n = 0 then
      bad := coalesce(bad || ', ', '') || fname || ' (lost an existing role)';
    end if;
  end loop;

  -- 2. The two bespoke guards landed.
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'list_care_activity'
    and p.prosrc like '%not public.is_circle_caregiver(p_circle_id)%';
  if n <> 1 then bad := coalesce(bad || ', ', '') || 'list_care_activity (pulse gate missing)'; end if;

  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'list_circle_members'
    and p.prosrc like '%not allowed to view the member roster%';
  if n <> 1 then bad := coalesce(bad || ', ', '') || 'list_circle_members (roster guard missing)'; end if;

  if bad is not null then
    raise exception 'M8 RPC scope failed: %', bad;
  end if;

  -- 3. The grant posture survived `create or replace`, including the H1 rule
  --    that nothing in `public` is anon-executable.
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n <> 0 then
    raise exception 'M8 RPC scope failed: % public function(s) became anon-executable', n;
  end if;

  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if n <> 0 then
    raise exception 'M8 RPC scope failed: % public function(s) lost authenticated EXECUTE', n;
  end if;

  raise notice 'M8 RPC scope verified: 6 allow-lists narrowed, 2 guards added, grants intact';
end;
$$;
