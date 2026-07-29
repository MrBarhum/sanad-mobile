-- Milestone 9 · B1 — functional proof that dose authorship can no longer be forged.
--
-- ROLLED BACK. Everything below runs inside a transaction that is discarded, so it
-- writes nothing. Run it AFTER 20260729130000.
--
--   npx supabase db query --linked -f docs/deployment/milestone-9-authorship-forgery-probe.sql -o csv
--
-- Every row must read `PASS`. A single `FAIL` means a hired caregiver can still
-- misrepresent who administered a dose, or when — the exact guarantee Milestone 8
-- exists to provide.
--
-- ── WHY A BEHAVIOURAL PROBE AND NOT JUST THE PRIVILEGE MATRIX ────────────────
--
-- The execute-privilege probe proves the trigger function is not callable by a
-- signed-in user. It says nothing about whether the trigger actually overrides a
-- forged value — that is a behaviour, and only an attempted forgery can settle it.
-- This file performs the attack the audit described and asserts it fails:
--
--   1. INSERT a dose log claiming ANOTHER member recorded it, backdated to 1990.
--      Expect: recorded_by rewritten to the caller, recorded_at rewritten to now().
--   2. UPDATE that row claiming the other member recorded it, backdated again.
--      Expect: recorded_by AND recorded_at unchanged from step 1 (the original is
--      immutable), and corrected_by / corrected_at stamped with the real corrector.
--
-- It runs as `authenticated` with a real member's JWT claims, exactly as the
-- Milestone 8 role matrix does, because as `postgres` (rolbypassrls) the whole
-- thing would pass while testing nothing.

begin;

do $$
declare
  v_circle   uuid;
  v_med      uuid;
  v_actor    uuid;
  v_victim   uuid;
  v_log      uuid;
  r_by       uuid;
  r_at       timestamptz;
  c_by       uuid;
  c_at       timestamptz;
  first_at   timestamptz;
  acc        jsonb := '[]'::jsonb;
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  -- A circle that has a medication and at least two active members: one to act
  -- as, one to impersonate. Managers may log any medication in their circle, so
  -- an admin is the cleanest actor.
  select m.circle_id, m.id
    into v_circle, v_med
  from public.medications m
  where exists (
    select 1 from public.circle_members cm
    where cm.circle_id = m.circle_id and cm.status = 'active' and cm.role = 'admin'
  )
  and (select count(*) from public.circle_members cm2
       where cm2.circle_id = m.circle_id and cm2.status = 'active') >= 2
  order by m.created_at
  limit 1;

  if v_circle is null then
    perform set_config('probe.b1',
      jsonb_build_array(jsonb_build_object(
        'check', '00 preconditions',
        'expected', 'a circle with >=1 medication and >=2 active members',
        'actual', 'none found',
        'verdict', 'SKIPPED - inconclusive, not a pass'))::text, true);
    return;
  end if;

  select cm.user_id into v_actor
  from public.circle_members cm
  where cm.circle_id = v_circle and cm.status = 'active' and cm.role = 'admin'
  order by cm.created_at limit 1;

  select cm.user_id into v_victim
  from public.circle_members cm
  where cm.circle_id = v_circle and cm.status = 'active' and cm.user_id <> v_actor
  order by cm.created_at limit 1;

  -- Become the actor. Without this the probe runs as postgres, which bypasses RLS
  -- and would record a passing lie.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if current_user <> 'authenticated' then
    raise exception 'probe aborted: role switch did not take (current_user=%)', current_user;
  end if;

  -- ── Attack 1: forge the author and the time on INSERT ──────────────────────
  insert into public.medication_logs
    (circle_id, medication_id, schedule_id, dose_date, scheduled_time, status,
     recorded_by, recorded_at)
  values
    (v_circle, v_med, null, date '1999-01-01', time '08:00', 'given',
     v_victim, timestamptz '1990-01-01 00:00:00+00')
  returning id, recorded_by, recorded_at into v_log, r_by, r_at;

  first_at := r_at;

  acc := acc || jsonb_build_object(
    'check', '01 INSERT recorded_by is the caller, not the forged member',
    'expected', 'actor ' || left(v_actor::text, 8),
    'actual',   'got '   || left(coalesce(r_by::text, 'null'), 8),
    'verdict',  case when r_by = v_actor then 'PASS' else 'FAIL' end);

  acc := acc || jsonb_build_object(
    'check', '02 INSERT recorded_at is now(), not the backdated 1990 value',
    'expected', 'within 60s of now()',
    'actual',   to_char(r_at, 'YYYY-MM-DD HH24:MI:SS'),
    'verdict',  case when abs(extract(epoch from (r_at - now()))) < 60
                     then 'PASS' else 'FAIL' end);

  -- ── Attack 2: forge the author and the time on UPDATE (the correction path) ─
  update public.medication_logs
     set status      = 'missed',
         recorded_by = v_victim,
         recorded_at = timestamptz '1990-01-01 00:00:00+00'
   where id = v_log
  returning recorded_by, recorded_at, corrected_by, corrected_at
       into r_by, r_at, c_by, c_at;

  acc := acc || jsonb_build_object(
    'check', '03 UPDATE cannot rewrite recorded_by (original author immutable)',
    'expected', 'actor ' || left(v_actor::text, 8),
    'actual',   'got '   || left(coalesce(r_by::text, 'null'), 8),
    'verdict',  case when r_by = v_actor then 'PASS' else 'FAIL' end);

  acc := acc || jsonb_build_object(
    'check', '04 UPDATE cannot rewrite recorded_at (original time immutable)',
    'expected', to_char(first_at, 'YYYY-MM-DD HH24:MI:SS'),
    'actual',   to_char(r_at, 'YYYY-MM-DD HH24:MI:SS'),
    'verdict',  case when r_at = first_at then 'PASS' else 'FAIL' end);

  acc := acc || jsonb_build_object(
    'check', '05 correction is attributed to the real corrector',
    'expected', 'actor ' || left(v_actor::text, 8),
    'actual',   'got '   || left(coalesce(c_by::text, 'null'), 8),
    'verdict',  case when c_by = v_actor then 'PASS' else 'FAIL' end);

  acc := acc || jsonb_build_object(
    'check', '06 correction is timestamped',
    'expected', 'within 60s of now()',
    'actual',   coalesce(to_char(c_at, 'YYYY-MM-DD HH24:MI:SS'), 'null'),
    'verdict',  case when c_at is not null and abs(extract(epoch from (c_at - now()))) < 60
                     then 'PASS' else 'FAIL' end);

  execute 'reset role';
  perform set_config('probe.b1', acc::text, true);
end;
$$;

-- The --linked transport returns only the LAST result set.
select x."check", x.expected, x.actual, x.verdict
from jsonb_to_recordset(current_setting('probe.b1')::jsonb)
       as x("check" text, expected text, actual text, verdict text)
order by x."check";

rollback;
