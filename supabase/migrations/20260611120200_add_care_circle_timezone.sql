-- Step 6.0 — Care-circle timezone (canonical zone for scheduled care events).
--
-- A medication dose at 08:00 or a task due at 14:00 is ONE real care event that
-- must happen at the cared-for person's local 08:00/14:00 — not a different event
-- in every recipient's country. So scheduled wall-clock times
-- (medication_schedules, care_tasks.due_*) are interpreted in the CARE CIRCLE's
-- timezone. Appointments stay absolute (timestamptz). The user/recipient timezone
-- on notification_preferences is used only for quiet hours / display.
--
-- care_circles is RPC-only for writes (direct INSERT/UPDATE/DELETE were revoked in
-- the Step 5.0 lockdown), so this timezone is changed exclusively through the
-- manager-only set_circle_timezone RPC below.
--
-- Idempotent / safe to re-run (apply manually via the Sanad Dashboard). Depends on
-- public.is_valid_timezone and public.active_circle_member_role (defined in the
-- notification functions migration and the Step 5.0 RPCs respectively).

-- ── Column: existing circles backfill to 'UTC'; the UI prompts a manager to set
--    the real zone (see the circle-timezone settings card). ─────────────────────
alter table public.care_circles
  add column if not exists timezone text not null default 'UTC';

-- ── set_circle_timezone ───────────────────────────────────────────────────────
-- Manager-only (admin / primary_caregiver). Validates the IANA name and updates
-- the circle's timezone. Returns the stored value.
create or replace function public.set_circle_timezone(
  p_circle_id uuid,
  p_timezone text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.circle_role;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_timezone is null or not public.is_valid_timezone(p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;

  -- `is null` guard required: a non-member yields NULL and NULL not in (...) is
  -- NULL (not true), which would otherwise slip through.
  v_actor := public.active_circle_member_role(p_circle_id);
  if v_actor is null or v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can change the circle timezone' using errcode = '42501';
  end if;

  update public.care_circles set timezone = p_timezone where id = p_circle_id;
  return p_timezone;
end;
$$;

revoke all on function public.set_circle_timezone(uuid, text) from public;
grant execute on function public.set_circle_timezone(uuid, text) to authenticated;

notify pgrst, 'reload schema';
