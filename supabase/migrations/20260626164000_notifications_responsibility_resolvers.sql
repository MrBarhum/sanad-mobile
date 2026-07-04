-- Phase 2F-3 — Inert responsibility-aware notification SQL (2 of 2): resolvers + source validity.
--
-- Expands effective_notification_prefs, updates notification_recipient_eligible, adds the
-- responsibility resolvers (notification_item_owner, notification_item_managers,
-- notification_recipients_for_item_event), adds notification_recipient_current, and re-creates
-- notification_source_validity with the recipient-currency gate + visit / task_overdue branches —
-- exactly as reviewed in
-- docs/claude-reports/2026-06-26-phase-2f-2-responsibility-aware-notification-sql-proposal.md (§13-B).
-- INERT: these functions add capability only; nothing calls the resolvers until a producer exists,
-- and the producer migration (…165000_…producers.sql) is DEFERRED / intentionally NOT created here.
--
-- ORDERING: depends on the enum values + preference columns added in
-- 20260626163000_notifications_responsibility_types_preferences.sql. The new enum values are USED
-- here (notification_recipient_eligible / notification_recipients_for_item_event /
-- notification_source_validity reference item_assigned/task_overdue/visit_upcoming/item_claimed/…),
-- so they must already be committed. Run 20260626163000 first (enum-in-transaction rule).
--
-- DEPENDENCY CAVEAT (B1): effective_notification_prefs is DROP+recreated because its return shape
-- gains 4 columns (create-or-replace cannot change a function's return type). Its callers
-- (notification_recipient_eligible, circle_notification_recipients, fanout_due_notifications,
-- claim_push_deliveries) late-bind by name, so the drop is expected to succeed. If Postgres instead
-- raises a dependency error (2BP01 "other objects depend on it") on the drop, do NOT use
-- `drop ... cascade`; recreate the named dependents in order after the expanded function. Verify on a
-- scratch/staging DB before applying (see the Phase 2F-3 report).
--
-- The outer begin;/commit; wrapper is omitted to match house style (the migration runner wraps each
-- file in its own transaction). security definer + set search_path = '' + revoke all from public +
-- service_role-only grants are preserved on every function. No producer, no trigger, no delivery, no
-- policy change, no data change.

-- B1. effective_notification_prefs: expand return (drop + recreate; PL/pgSQL callers late-bind).
drop function if exists public.effective_notification_prefs(uuid, uuid);
create function public.effective_notification_prefs(p_user_id uuid, p_circle_id uuid)
returns table (
  medication_reminders boolean, missed_dose_alerts boolean, task_reminders boolean,
  appointment_reminders boolean, visit_updates boolean, care_updates boolean,
  emergency_alerts boolean, remote_summary boolean,
  assignment_alerts boolean, activity_updates boolean,
  available_to_claim_digest boolean, visit_reminders boolean,
  quiet_hours_enabled boolean, quiet_hours_start time, quiet_hours_end time, timezone text
) language plpgsql stable security definer set search_path = '' as $$
declare c public.notification_preferences%rowtype; g public.notification_preferences%rowtype;
begin
  if p_circle_id is not null then
    select * into c from public.notification_preferences np where np.user_id=p_user_id and np.circle_id=p_circle_id;
  end if;
  select * into g from public.notification_preferences np where np.user_id=p_user_id and np.circle_id is null;
  return query select
    coalesce(c.medication_reminders,  g.medication_reminders,  true),
    coalesce(c.missed_dose_alerts,    g.missed_dose_alerts,    true),
    coalesce(c.task_reminders,        g.task_reminders,        true),
    coalesce(c.appointment_reminders, g.appointment_reminders, true),
    coalesce(c.visit_updates,         g.visit_updates,         true),
    coalesce(c.care_updates,          g.care_updates,          true),
    coalesce(c.emergency_alerts,      g.emergency_alerts,      true),
    coalesce(c.remote_summary,        g.remote_summary,        true),
    coalesce(c.assignment_alerts,     g.assignment_alerts,     true),
    coalesce(c.activity_updates,      g.activity_updates,      true),
    coalesce(c.available_to_claim_digest, g.available_to_claim_digest, false),
    coalesce(c.visit_reminders,       g.visit_reminders,       true),
    coalesce(c.quiet_hours_enabled,   g.quiet_hours_enabled,   false),
    coalesce(c.quiet_hours_start,     g.quiet_hours_start),
    coalesce(c.quiet_hours_end,       g.quiet_hours_end),
    coalesce(nullif(c.timezone,''),   nullif(g.timezone,''),   'UTC');
end; $$;
revoke all on function public.effective_notification_prefs(uuid, uuid) from public;
grant execute on function public.effective_notification_prefs(uuid, uuid) to service_role;

-- B2. notification_recipient_eligible: map new types + full remote exclusion (create or replace).
create or replace function public.notification_recipient_eligible(
  p_user_id uuid, p_circle_id uuid, p_type public.notification_type
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.circle_role; prefs record; v_pref boolean;
begin
  if p_circle_id is not null then
    select cm.role into v_role from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.user_id = p_user_id and cm.status = 'active';
    if v_role is null
       or v_role not in ('admin','primary_caregiver','family_member','caregiver','remote_member') then
      return false;  -- elder / null / removed
    end if;
    -- NOTE: `caregiver` is ADDED to the allow-list here (the committed engine omits it). Phase 2E
    -- makes caregiver a claim-capable owner, so a caregiver owner must be able to receive its own
    -- reminders. Harmless today (no active caregiver members); flag for product sign-off (§18).
    if v_role = 'remote_member' and p_type in (
      'medication_due','medication_missed','task_due','task_overdue',
      'appointment_upcoming','visit_upcoming','item_assigned',
      'item_claimed','item_completed','item_cancelled','claim_digest'
    ) then
      return false;  -- remote is a read-only observer: no operational/assignment/awareness pushes
    end if;
  end if;

  select * into prefs from public.effective_notification_prefs(p_user_id, p_circle_id);
  v_pref := case p_type
    when 'medication_due'      then prefs.medication_reminders
    when 'medication_missed'   then prefs.missed_dose_alerts
    when 'task_due'            then prefs.task_reminders
    when 'task_overdue'        then prefs.task_reminders
    when 'appointment_upcoming' then prefs.appointment_reminders
    when 'visit_upcoming'      then prefs.visit_reminders
    when 'visit_update'        then prefs.visit_updates
    when 'care_update'         then prefs.care_updates
    when 'item_assigned'       then prefs.assignment_alerts
    when 'item_claimed'        then prefs.activity_updates
    when 'item_completed'      then prefs.activity_updates
    when 'item_cancelled'      then prefs.activity_updates
    when 'claim_digest'        then prefs.available_to_claim_digest
    when 'emergency'           then prefs.emergency_alerts
    when 'system'              then true
    else true
  end;
  return coalesce(v_pref, true);
end; $$;
revoke all on function public.notification_recipient_eligible(uuid, uuid, public.notification_type) from public;
grant execute on function public.notification_recipient_eligible(uuid, uuid, public.notification_type) to service_role;

-- B3.1 notification_item_owner — the responsibility column for an entity (null = unowned).
create or replace function public.notification_item_owner(p_entity text, p_item_id uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid;
begin
  case p_entity
    when 'task'        then select assigned_to         into v_owner from public.care_tasks         where id = p_item_id;
    when 'medication'  then select responsible_user_id into v_owner from public.medications        where id = p_item_id;
    when 'appointment' then select assigned_to         into v_owner from public.care_appointments  where id = p_item_id;
    when 'visit'       then select visitor_user_id     into v_owner from public.family_visits       where id = p_item_id;
    else v_owner := null;
  end case;
  return v_owner;
end; $$;
revoke all on function public.notification_item_owner(text, uuid) from public;
grant execute on function public.notification_item_owner(text, uuid) to service_role;

-- B3.2 notification_item_managers — active managers with tz/quiet-hours (fallback/awareness/escalation).
create or replace function public.notification_item_managers(p_circle_id uuid)
returns table (user_id uuid, timezone text, quiet_hours_enabled boolean,
               quiet_hours_start time, quiet_hours_end time)
language sql stable security definer set search_path = '' as $$
  select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
  from public.circle_members cm
  cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
  where cm.circle_id = p_circle_id and cm.status = 'active'
    and cm.role in ('admin','primary_caregiver');
$$;
revoke all on function public.notification_item_managers(uuid) from public;
grant execute on function public.notification_item_managers(uuid) to service_role;

-- B3.3 notification_recipients_for_item_event — audience class derived from p_type; every branch
--       filtered by active membership + notification_recipient_eligible (role/pref/remote/elder).
create or replace function public.notification_recipients_for_item_event(
  p_circle_id uuid, p_type public.notification_type, p_entity text, p_item_id uuid
)
returns table (user_id uuid, timezone text, quiet_hours_enabled boolean,
               quiet_hours_start time, quiet_hours_end time)
language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid;
begin
  -- Manager-awareness → managers only.
  if p_type in ('item_claimed','item_completed','item_cancelled') then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver')
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Claim digest → claim-capable members who opted in.
  if p_type = 'claim_digest' then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver','family_member','caregiver')
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Owner-targeted reminders / assignment. Notify the owner ONLY when they hold a valid operational
  -- role (manager or doer); an owner who opted out returns empty (no escalation — opt-out respected).
  v_owner := public.notification_item_owner(p_entity, p_item_id);
  if v_owner is not null and exists (
       select 1 from public.circle_members cm
       where cm.circle_id = p_circle_id and cm.user_id = v_owner and cm.status = 'active'
         and cm.role in ('admin','primary_caregiver','family_member','caregiver')
     ) then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.user_id = v_owner
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Unassigned OR owner has a non-operational role (a manager mis-assigned a remote_member/elder,
  -- which the assignment RLS permits — it checks membership, not role): manager fallback ONLY for
  -- medication/appointment/visit reminders. task_due / task_overdue / item_assigned → NOBODY
  -- (no spam; the claim feed + the manager UI cover unassigned/mis-assigned tasks).
  if p_type in ('medication_due','medication_missed','appointment_upcoming','visit_upcoming') then
    return query
      select m.user_id, m.timezone, m.quiet_hours_enabled, m.quiet_hours_start, m.quiet_hours_end
      from public.notification_item_managers(p_circle_id) m
      where public.notification_recipient_eligible(m.user_id, p_circle_id, p_type);
    return;
  end if;
  return;  -- no recipients
end; $$;
revoke all on function public.notification_recipients_for_item_event(uuid, public.notification_type, text, uuid) from public;
grant execute on function public.notification_recipients_for_item_event(uuid, public.notification_type, text, uuid) to service_role;

-- B4. notification_recipient_current — send-time recipient-currency gate (used by B5).
create or replace function public.notification_recipient_current(p_notification_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare n public.notifications%rowtype; v_entity text; v_item uuid;
begin
  select * into n from public.notifications where id = p_notification_id;
  if not found then return false; end if;

  -- Manager-escalation rows (producer sets data.tier='manager'; e.g. tier-2 medication_missed /
  -- task_overdue after the owner failed to act) validate a CURRENT active manager, NOT item
  -- ownership — otherwise the owner-only resolver would drop them as 'not_current_recipient'.
  if (n.data ->> 'tier') = 'manager' then
    return exists (
      select 1 from public.circle_members cm
      where cm.circle_id = n.circle_id and cm.user_id = n.user_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver')
    ) and public.notification_recipient_eligible(n.user_id, n.circle_id, n.type);
  end if;

  v_entity := nullif(n.data ->> 'entity', '');
  v_item   := nullif(n.data ->> 'itemId', '')::uuid;
  if v_entity is null or v_item is null then
    return true;  -- legacy / no item context → do not block
  end if;
  return exists (
    select 1 from public.notification_recipients_for_item_event(n.circle_id, n.type, v_entity, v_item) r
    where r.user_id = n.user_id
  );
end; $$;
revoke all on function public.notification_recipient_current(uuid) from public;
grant execute on function public.notification_recipient_current(uuid) to service_role;

-- B5. notification_source_validity — FULL body = the current committed body (20260611120100) with
--     the three 2F-2 insertions integrated (marked NEW). Signature/return + grants UNCHANGED, so
--     create-or-replace (no drop) is valid and the fanout/claim call sites are untouched.
create or replace function public.notification_source_validity(p_notification_id uuid)
returns table (valid boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n public.notifications%rowtype;
  v_schedule_id uuid;
  v_dose_date date;
  v_scheduled_time time;
  v_sched public.medication_schedules%rowtype;
  v_med_active boolean;
  v_weekday integer;
  v_task public.care_tasks%rowtype;
  v_due_date date;
  v_due_time time;
  v_appt public.care_appointments%rowtype;
  v_starts_at timestamptz;
  v_visit public.family_visits%rowtype;   -- NEW (2F-2)
  v_visit_date date;                       -- NEW (2F-2)
  v_visit_start time;                      -- NEW (2F-2)
begin
  select * into n from public.notifications nn where nn.id = p_notification_id;
  if not found then
    return query select false, 'no_notification'; return;
  end if;

  -- NEW (2F-2): recipient-currency gate. Skip a queued notification whose recipient is no longer the
  -- correct target — reassigned/claimed away, role or membership lost, or a manager-escalation row
  -- whose recipient is no longer a manager. Legacy rows (no data.entity/itemId and non-'manager'
  -- tier) are treated valid by notification_recipient_current, preserving prior behavior.
  if not public.notification_recipient_current(p_notification_id) then
    return query select false, 'not_current_recipient'; return;
  end if;

  if n.type in ('medication_due', 'medication_missed') then
    v_schedule_id := nullif(n.data ->> 'scheduleId', '')::uuid;
    v_dose_date := nullif(n.data ->> 'doseDate', '')::date;
    v_scheduled_time := nullif(n.data ->> 'scheduledTime', '')::time;
    if v_schedule_id is null or v_dose_date is null or v_scheduled_time is null then
      return query select true, 'no_source_context'; return;
    end if;

    select * into v_sched from public.medication_schedules ms where ms.id = v_schedule_id;
    if not found or not v_sched.is_active then
      return query select false, 'schedule_inactive'; return;
    end if;
    select m.is_active into v_med_active from public.medications m where m.id = v_sched.medication_id;
    if v_med_active is null or not v_med_active then
      return query select false, 'medication_inactive'; return;
    end if;

    -- Occurrence must still be a real slot of the (possibly edited) schedule.
    -- extract(dow) is 0=Sunday..6=Saturday, matching days_of_week (JS getDay()).
    v_weekday := extract(dow from v_dose_date)::integer;
    if not (v_weekday = any (v_sched.days_of_week))
       or not (v_scheduled_time = any (v_sched.times))
       or v_dose_date < v_sched.start_date
       or (v_sched.end_date is not null and v_dose_date > v_sched.end_date) then
      return query select false, 'occurrence_changed'; return;
    end if;

    -- Recorded since enqueue? (true for a due reminder AND for a late missed dose.)
    if exists (
      select 1 from public.medication_logs ml
      where ml.schedule_id = v_schedule_id
        and ml.dose_date = v_dose_date
        and ml.scheduled_time = v_scheduled_time
    ) then
      return query select false, 'dose_recorded'; return;
    end if;

    return query select true, 'ok'; return;

  -- NEW (2F-2): task_overdue folded into the task branch (was `n.type = 'task_due'`), so a completed,
  -- cancelled, or rescheduled task also invalidates its overdue reminder.
  elsif n.type in ('task_due', 'task_overdue') then
    if nullif(n.data ->> 'taskId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_task from public.care_tasks t where t.id = (n.data ->> 'taskId')::uuid;
    if not found then
      return query select false, 'task_missing'; return;
    end if;
    if v_task.status <> 'open' then
      return query select false, 'task_closed'; return;
    end if;
    -- Rescheduled? Compare the CURRENT due date/time to the occurrence that
    -- produced this notification (dueTime is the task's raw time, null = date-only).
    v_due_date := nullif(n.data ->> 'dueDate', '')::date;
    v_due_time := nullif(n.data ->> 'dueTime', '')::time;
    if v_task.due_date is distinct from v_due_date
       or v_task.due_time is distinct from v_due_time then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  elsif n.type = 'appointment_upcoming' then
    if nullif(n.data ->> 'appointmentId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_appt from public.care_appointments a where a.id = (n.data ->> 'appointmentId')::uuid;
    if not found then
      return query select false, 'appointment_missing'; return;
    end if;
    if v_appt.status <> 'scheduled' then
      return query select false, 'appointment_closed'; return;
    end if;
    v_starts_at := nullif(n.data ->> 'startsAt', '')::timestamptz;
    if v_appt.starts_at is distinct from v_starts_at then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  -- NEW (2F-2): visit_upcoming branch — visit still planned + occurrence (visit_date/start_time)
  -- unchanged. Uses the generic data.itemId (the new visit producer stores entity='visit'+itemId).
  elsif n.type = 'visit_upcoming' then
    if nullif(n.data ->> 'itemId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_visit from public.family_visits v where v.id = (n.data ->> 'itemId')::uuid;
    if not found then
      return query select false, 'visit_missing'; return;
    end if;
    if v_visit.status <> 'planned' then
      return query select false, 'visit_closed'; return;
    end if;
    v_visit_date := nullif(n.data ->> 'visitDate', '')::date;
    v_visit_start := nullif(n.data ->> 'startTime', '')::time;
    if v_visit.visit_date is distinct from v_visit_date
       or v_visit.start_time is distinct from v_visit_start then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  else
    -- No concrete validatable source identifier — keep existing behavior.
    return query select true, 'ok'; return;
  end if;
end;
$$;
revoke all on function public.notification_source_validity(uuid) from public;
grant execute on function public.notification_source_validity(uuid) to service_role;

notify pgrst, 'reload schema';
