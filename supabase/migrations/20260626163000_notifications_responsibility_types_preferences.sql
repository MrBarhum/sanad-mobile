-- Phase 2F-3 — Inert responsibility-aware notification SQL (1 of 2): types + preferences.
--
-- Adds the new notification_type enum values, the 4 new notification_preferences columns,
-- and the widened upsert_notification_preferences signature, exactly as reviewed in
-- docs/claude-reports/2026-06-26-phase-2f-2-responsibility-aware-notification-sql-proposal.md
-- (§13-A). INERT: nothing in this file produces a notification or enables delivery.
--
-- WHY ITS OWN FILE (enum-in-transaction rule): a newly added enum value cannot be USED in
-- the same transaction that adds it. The migration runner wraps each file in its own
-- transaction, so these ADD VALUE statements commit here — before the resolver functions in
-- 20260626164000_notifications_responsibility_resolvers.sql reference them at runtime. The
-- preference-column ADDs and the upsert recreate in this file do NOT reference any new enum
-- value, so they are safe alongside the ADD VALUEs.
--
-- The outer begin;/commit; wrapper is omitted to match house style (the migration runner
-- wraps each file in its own transaction). Idempotent (add value if not exists / add column
-- if not exists / drop+recreate the upsert). No producer, no delivery, no policy change, no
-- data change. The producer migration (…165000_…producers.sql) is DEFERRED and intentionally
-- NOT created in this phase.

-- A1. Enum values (own migration; a new value cannot be used in the same transaction).
alter type public.notification_type add value if not exists 'item_assigned';
alter type public.notification_type add value if not exists 'task_overdue';
alter type public.notification_type add value if not exists 'visit_upcoming';
alter type public.notification_type add value if not exists 'item_claimed';
alter type public.notification_type add value if not exists 'item_completed';
alter type public.notification_type add value if not exists 'item_cancelled';
alter type public.notification_type add value if not exists 'claim_digest';

-- A2. Preference columns (additive, defaulted).
alter table public.notification_preferences
  add column if not exists assignment_alerts         boolean not null default true,
  add column if not exists activity_updates          boolean not null default true,
  add column if not exists available_to_claim_digest boolean not null default false,
  add column if not exists visit_reminders           boolean not null default true;

-- A3. upsert_notification_preferences: +4 optional params. Drop old signature + recreate
--     (named-arg client calls remain compatible via the new defaults). Pairs with 2F-5 UI.
drop function if exists public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text);

create or replace function public.upsert_notification_preferences(
  p_circle_id uuid,
  p_medication_reminders boolean, p_missed_dose_alerts boolean, p_task_reminders boolean,
  p_appointment_reminders boolean, p_visit_updates boolean, p_care_updates boolean,
  p_emergency_alerts boolean, p_remote_summary boolean,
  p_quiet_hours_enabled boolean, p_quiet_hours_start time, p_quiet_hours_end time, p_timezone text,
  p_assignment_alerts boolean default null, p_activity_updates boolean default null,
  p_available_to_claim_digest boolean default null, p_visit_reminders boolean default null
) returns public.notification_preferences
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row public.notification_preferences;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_circle_id is not null and not public.is_active_user_circle_member(p_circle_id, v_uid) then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if p_timezone is not null and p_timezone <> '' and not public.is_valid_timezone(p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  if coalesce(p_quiet_hours_enabled,false) and (p_quiet_hours_start is null or p_quiet_hours_end is null) then
    raise exception 'quiet hours require a start and end' using errcode = '22023';
  end if;

  update public.notification_preferences np set
    medication_reminders      = coalesce(p_medication_reminders, np.medication_reminders),
    missed_dose_alerts        = coalesce(p_missed_dose_alerts, np.missed_dose_alerts),
    task_reminders            = coalesce(p_task_reminders, np.task_reminders),
    appointment_reminders     = coalesce(p_appointment_reminders, np.appointment_reminders),
    visit_updates             = coalesce(p_visit_updates, np.visit_updates),
    care_updates              = coalesce(p_care_updates, np.care_updates),
    emergency_alerts          = coalesce(p_emergency_alerts, np.emergency_alerts),
    remote_summary            = coalesce(p_remote_summary, np.remote_summary),
    assignment_alerts         = coalesce(p_assignment_alerts, np.assignment_alerts),
    activity_updates          = coalesce(p_activity_updates, np.activity_updates),
    available_to_claim_digest = coalesce(p_available_to_claim_digest, np.available_to_claim_digest),
    visit_reminders           = coalesce(p_visit_reminders, np.visit_reminders),
    quiet_hours_enabled       = coalesce(p_quiet_hours_enabled, np.quiet_hours_enabled),
    quiet_hours_start         = p_quiet_hours_start,
    quiet_hours_end           = p_quiet_hours_end,
    timezone                  = coalesce(nullif(p_timezone,''), np.timezone)
  where np.user_id = v_uid and np.circle_id is not distinct from p_circle_id
  returning * into v_row;

  if not found then
    insert into public.notification_preferences (
      user_id, circle_id, medication_reminders, missed_dose_alerts, task_reminders,
      appointment_reminders, visit_updates, care_updates, emergency_alerts, remote_summary,
      assignment_alerts, activity_updates, available_to_claim_digest, visit_reminders,
      quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone
    ) values (
      v_uid, p_circle_id,
      coalesce(p_medication_reminders,true), coalesce(p_missed_dose_alerts,true), coalesce(p_task_reminders,true),
      coalesce(p_appointment_reminders,true), coalesce(p_visit_updates,true), coalesce(p_care_updates,true),
      coalesce(p_emergency_alerts,true), coalesce(p_remote_summary,true),
      coalesce(p_assignment_alerts,true), coalesce(p_activity_updates,true),
      coalesce(p_available_to_claim_digest,false), coalesce(p_visit_reminders,true),
      coalesce(p_quiet_hours_enabled,false), p_quiet_hours_start, p_quiet_hours_end, nullif(p_timezone,'')
    ) returning * into v_row;
  end if;
  return v_row;
end; $$;
revoke all on function public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text,
  boolean, boolean, boolean, boolean) from public;
grant execute on function public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text,
  boolean, boolean, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
