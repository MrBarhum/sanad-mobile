-- Milestone 4 · B3 — Per-circle missed-dose grace. Adds
-- care_circles.missed_dose_grace_minutes (the wait after a scheduled dose time
-- before the tier-2 "not recorded" alert; the tier-3 manager escalation fires at
-- 2× this value) and a manager-only setter. NOT auto-applied — see the
-- milestone-4 runbook; also deploy check-missed-doses and schedule its cron
-- (resolves the previously-unscheduled missed-dose job).

alter table public.care_circles
  add column if not exists missed_dose_grace_minutes int not null default 30;

-- Keep the grace within a sane band (5 minutes .. 4 hours). 2× the max (8h) still
-- sits inside the edge function's max-age backstop, so tier-3 always has a window.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_circles'::regclass
      and conname = 'care_circles_missed_dose_grace_range'
  ) then
    alter table public.care_circles
      add constraint care_circles_missed_dose_grace_range
      check (missed_dose_grace_minutes between 5 and 240);
  end if;
end
$$;

-- Manager-only setter (mirrors set_circle_timezone). Direct writes to care_circles
-- are revoked, so this SECURITY DEFINER RPC is the only path. Clamps out-of-range
-- input defensively even though the client stepper is bounded.
create or replace function public.set_missed_dose_grace_minutes(
  p_circle_id uuid,
  p_minutes int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.circle_role;
  v_minutes int;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_minutes is null then
    raise exception 'minutes is required' using errcode = '22023';
  end if;

  v_actor := public.active_circle_member_role(p_circle_id);
  if v_actor is null or v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can change the missed-dose grace' using errcode = '42501';
  end if;

  v_minutes := least(240, greatest(5, p_minutes));
  update public.care_circles
    set missed_dose_grace_minutes = v_minutes
    where id = p_circle_id;

  return v_minutes;
end;
$$;

revoke all on function public.set_missed_dose_grace_minutes(uuid, int) from public;
grant execute on function public.set_missed_dose_grace_minutes(uuid, int) to authenticated;
