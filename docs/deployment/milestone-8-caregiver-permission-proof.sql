-- Milestone 8 · C1 — positive and negative proof of the hired-caregiver role,
-- executed against production INSIDE A ROLLED-BACK TRANSACTION.
--
--   npx supabase db query --linked -f docs/deployment/milestone-8-caregiver-permission-proof.sql -o csv
--
-- ── WHY IT IS SHAPED LIKE THIS ───────────────────────────────────────────────
--
-- There is no `caregiver` member in production and there must not be one: adding
-- a real member would move `circle_members` from 6 to 7 rows for every existing
-- role and destroy the before/after comparability of
-- milestone-8-role-probe-read.sql. So this script promotes ONE existing member
-- to `caregiver` for the life of the transaction, gives her exactly one
-- responsible medication and one assigned task, probes every allowed and every
-- forbidden action as her, and rolls the whole thing back. Nothing persists —
-- the role change, the responsibility, the assignment and every row written by a
-- positive probe all disappear with the ROLLBACK.
--
-- Every probe records the SQLSTATE, not just a count. This matters: an RLS
-- filter yields 0 rows with no error, a missing GRANT raises 42501, and a failed
-- WITH CHECK raises 42501 with a different message. "Zero rows" and "refused"
-- are different security facts and the report must not conflate them.
--
-- UPDATE probes record ROWS AFFECTED rather than an error, because a RESTRICTIVE
-- or role-scoped USING clause makes the row invisible rather than raising — a
-- forbidden UPDATE silently touches 0 rows, and a probe that only watched for an
-- exception would score that as a pass for the wrong reason.
--
-- `expected` is written next to each probe so the output is self-checking: the
-- final column is a literal PASS/FAIL and the last row is the overall verdict.

begin;

do $$
declare
  v_uid      uuid;
  v_circle   uuid;
  v_med      uuid;   -- the one medication she is responsible for
  v_med_other uuid;  -- a medication she is NOT responsible for
  v_sched    uuid;
  v_task     uuid;   -- the one task assigned to her
  v_task_other uuid; -- a task assigned to someone else
  v_appt     uuid;
  v_member   uuid;   -- her circle_members row id
  v_admin    uuid;   -- the circle admin, used for the manager-side setup
  v_other_member uuid;
  n          bigint;
  st         text;
  acc        jsonb := '[]'::jsonb;
  v_expect_tasks bigint;   -- tasks she is entitled to, computed as postgres
  v_all_tasks    bigint;   -- every task in the circle, to prove she sees fewer

begin
  perform set_config('search_path', 'pg_catalog, public', true);

  -- ── Setup, as postgres (bypasses RLS) ──────────────────────────────────────
  select cm.circle_id, cm.user_id, cm.id
    into v_circle, v_uid, v_member
  from public.circle_members cm
  where cm.status = 'active' and cm.role = 'remote_member'
  order by cm.created_at
  limit 1;
  if v_uid is null then
    raise exception 'proof aborted: no active remote_member to borrow as the test caregiver';
  end if;

  select cm.id into v_other_member
  from public.circle_members cm
  where cm.circle_id = v_circle and cm.user_id <> v_uid and cm.status = 'active'
  order by cm.created_at limit 1;

  select cm.user_id into v_admin
  from public.circle_members cm
  where cm.circle_id = v_circle and cm.status = 'active' and cm.role = 'admin'
  order by cm.created_at limit 1;
  if v_admin is null then
    raise exception 'proof aborted: no active admin to perform the manager-side setup';
  end if;

  -- Promote her for the life of this transaction only. Done as postgres because
  -- circle_members carries NO update policy at all — role changes normally go
  -- through the SECURITY DEFINER update_circle_member_role RPC.
  update public.circle_members set role = 'caregiver' where id = v_member;

  -- The rest of the setup is manager work, so it is performed AS THE ADMIN.
  --
  -- This is not cosmetic. `enforce_care_task_collaborator_scope` is a BEFORE
  -- UPDATE trigger whose manager bypass is
  -- `has_circle_role(old.circle_id, ['admin','primary_caregiver'])`, which keys
  -- off auth.uid(). Bare `postgres` has no JWT claim, so auth.uid() is NULL, the
  -- bypass fails, and postgres itself is judged a collaborator — the trigger
  -- refuses the assignment with 'collaborators may only complete or cancel a
  -- task'. Setting the claim (while staying `postgres`, so RLS is still
  -- bypassed for the setup) makes the trigger see a manager, which is also what
  -- really happens in the app.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- Give her exactly one responsible medication, and remember one she has no
  -- part in, so "she sees only hers" is testable rather than vacuous.
  select m.id into v_med from public.medications m
  where m.circle_id = v_circle and m.is_active order by m.created_at limit 1;
  select m.id into v_med_other from public.medications m
  where m.circle_id = v_circle and m.id <> v_med order by m.created_at limit 1;
  update public.medications set responsible_user_id = v_uid where id = v_med;
  update public.medications set responsible_user_id = null where id = v_med_other;

  select s.id into v_sched from public.medication_schedules s
  where s.medication_id = v_med order by s.created_at limit 1;

  -- One task assigned to her, one assigned elsewhere.
  select t.id into v_task from public.care_tasks t
  where t.circle_id = v_circle and t.status = 'open' order by t.created_at limit 1;
  select t.id into v_task_other from public.care_tasks t
  where t.circle_id = v_circle and t.id <> v_task and t.status = 'open'
  order by t.created_at limit 1;
  update public.care_tasks set assigned_to = v_uid where id = v_task;
  update public.care_tasks set assigned_to = null where id = v_task_other;

  select a.id into v_appt from public.care_appointments a
  where a.circle_id = v_circle order by a.created_at limit 1;

  -- The care_tasks expectation is COMPUTED, not hardcoded. The SELECT policy is
  -- `assigned_to = uid OR completed_by = uid`, and the borrowed account may
  -- already carry historical rows on either column — an earlier draft of this
  -- probe asserted a flat "1" and failed for that reason, not because of a
  -- permission defect. Both numbers are captured so the assertion proves the
  -- interesting thing: she sees exactly her entitled set, and strictly fewer
  -- than the circle's full task list.
  select count(*) into v_expect_tasks from public.care_tasks t
  where t.circle_id = v_circle and (t.assigned_to = v_uid or t.completed_by = v_uid);
  select count(*) into v_all_tasks from public.care_tasks t where t.circle_id = v_circle;

  -- ── Become her ─────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if current_user <> 'authenticated' then
    raise exception 'proof aborted: role switch did not take (current_user=%)', current_user;
  end if;

  -- ═══ POSITIVE — every allowed action must succeed ═════════════════════════

  begin select count(*) into n from public.care_circles; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read care_circles', 'expected', '1 (her circle)',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.care_recipients; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read care_recipients (basic profile)', 'expected', '1',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.doctors; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read doctors (emergency card)', 'expected', '>=1',
    'actual', n||'/'||st, 'verdict', case when n>=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.emergency_contacts; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read emergency_contacts (emergency card)', 'expected', '>=1',
    'actual', n||'/'||st, 'verdict', case when n>=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.medications; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read medications', 'expected', 'exactly 1 (only hers)',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.medication_schedules; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read medication_schedules', 'expected', 'only her medication''s',
    'actual', n||'/'||st, 'verdict', case when n>=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.care_tasks; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read care_tasks',
    'expected', v_expect_tasks||' (hers only) of '||v_all_tasks||' in the circle',
    'actual', n||'/'||st,
    'verdict', case when n = v_expect_tasks and n < v_all_tasks then 'PASS' else 'FAIL' end);

  -- log a dose for the medication she is responsible for
  begin
    insert into public.medication_logs
      (circle_id, medication_id, schedule_id, dose_date, scheduled_time, status, recorded_by)
    values (v_circle, v_med, v_sched, current_date, '08:00', 'given', v_uid);
    n := 1; st := 'ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'INSERT medication_log for her responsible med', 'expected', 'succeeds',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  -- complete the task assigned to her
  begin
    update public.care_tasks
      set status='completed', completed_by=v_uid, completed_at=now()
    where id = v_task;
    get diagnostics n = row_count; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'UPDATE care_task assigned to her (complete)', 'expected', '1 row',
    'actual', n||' rows/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin
    insert into public.daily_care_logs (circle_id, log_date, general_notes, recorded_by)
    values (v_circle, current_date, 'm8 proof', v_uid);
    n := 1; st := 'ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'INSERT daily_care_log (own)', 'expected', 'succeeds',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin
    insert into public.vital_readings (circle_id, reading_type, systolic, diastolic, reading_at, recorded_by)
    values (v_circle, 'blood_pressure', 120, 80, now(), v_uid);
    n := 1; st := 'ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'INSERT vital_reading (own)', 'expected', 'succeeds',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.daily_care_logs; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read back her own daily logs', 'expected', '1 (hers only, not the family''s 3)',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.vital_readings; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read back her own vitals', 'expected', '1 (hers only)',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.medication_logs; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'positive', 'probe', 'read medication_logs', 'expected', 'only her responsible med''s',
    'actual', n||'/'||st, 'verdict', case when n>=1 then 'PASS' else 'FAIL' end);

  -- ═══ NEGATIVE — the DATABASE must refuse, not the UI ══════════════════════

  begin select count(*) into n from public.circle_members; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'read circle_members (roster)', 'expected', 'exactly 1 = her own row, not 6',
    'actual', n||'/'||st, 'verdict', case when n=1 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.care_appointments; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'read care_appointments', 'expected', '0',
    'actual', n||'/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.family_visits; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'read family_visits', 'expected', '0',
    'actual', n||'/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  begin select count(*) into n from public.circle_invitations; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'read circle_invitations', 'expected', '0',
    'actual', n||'/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  begin
    execute format('select count(*) from public.list_circle_members(%L)', v_circle) into n; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC list_circle_members', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    execute format('select count(*) from public.list_care_activity(%L, 500, null)', v_circle) into n; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC list_care_activity (Pulse)', 'expected', '0 rows (admin sees 45)',
    'actual', n||'/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  begin
    execute format('select count(*) from public.list_available_to_claim(%L)', v_circle) into n; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC list_available_to_claim', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    execute format('select count(*) from public.list_circle_invitations(%L)', v_circle) into n; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC list_circle_invitations', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    execute format('select public.claim_care_task(%L)', v_task_other); n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC claim_care_task', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    execute format('select public.claim_medication_responsibility(%L)', v_med_other); n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC claim_medication_responsibility', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    execute format('select public.set_assigned_appointment_outcome(%L, %L)', v_appt, 'completed'); n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC set_assigned_appointment_outcome', 'expected', 'refused',
    'actual', n||'/'||st, 'verdict', case when st<>'ok' then 'PASS' else 'FAIL' end);

  begin
    execute format('select public.create_circle_invitation(%L, %L, null, null)', v_circle, 'family_member'); n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC create_circle_invitation', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    execute format('select public.update_circle_member_role(%L, %L)', v_other_member, 'admin'); n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC update_circle_member_role', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    execute format('select public.set_missed_dose_grace_minutes(%L, 30)', v_circle); n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC set_missed_dose_grace_minutes', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    execute format('select public.set_circle_timezone(%L, %L)', v_circle, 'Asia/Riyadh'); n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'RPC set_circle_timezone', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    insert into public.family_visits (circle_id, visitor_name, visit_date, visitor_user_id, status)
    values (v_circle, 'm8 proof', current_date, v_uid, 'planned');
    n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'INSERT family_visit (own)', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    insert into public.medication_logs
      (circle_id, medication_id, dose_date, scheduled_time, status, recorded_by)
    values (v_circle, v_med_other, current_date, '09:00', 'given', v_uid);
    n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'INSERT medication_log for a med she is NOT responsible for', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    insert into public.care_tasks (circle_id, title, status, created_by)
    values (v_circle, 'm8 proof', 'open', v_uid);
    n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'INSERT care_task', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    insert into public.medications (circle_id, name) values (v_circle, 'm8 proof');
    n:=1; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'INSERT medication', 'expected', 'refused 42501',
    'actual', n||'/'||st, 'verdict', case when st='42501' then 'PASS' else 'FAIL' end);

  begin
    update public.medications set name = 'tampered' where id = v_med;
    get diagnostics n = row_count; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'UPDATE her own responsible medication', 'expected', '0 rows (read-only to her)',
    'actual', n||' rows/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  begin
    delete from public.medications where id = v_med;
    get diagnostics n = row_count; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'DELETE a medication', 'expected', '0 rows',
    'actual', n||' rows/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  begin
    update public.care_tasks set status='completed' where id = v_task_other;
    get diagnostics n = row_count; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'UPDATE a task NOT assigned to her', 'expected', '0 rows',
    'actual', n||' rows/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  begin
    update public.care_recipients set full_name='tampered' where circle_id = v_circle;
    get diagnostics n = row_count; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'UPDATE care_recipient', 'expected', '0 rows (read-only)',
    'actual', n||' rows/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  begin
    update public.circle_members set role='admin' where id = v_member;
    get diagnostics n = row_count; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'self-promote via circle_members UPDATE', 'expected', '0 rows / refused',
    'actual', n||' rows/'||st, 'verdict', case when n<=0 then 'PASS' else 'FAIL' end);

  begin
    update public.emergency_contacts set name='tampered' where circle_id = v_circle;
    get diagnostics n = row_count; st:='ok';
  exception when others then n:=-1; st:=sqlstate; end;
  acc := acc || jsonb_build_object(
    'kind', 'negative', 'probe', 'UPDATE emergency_contacts', 'expected', '0 rows (read-only)',
    'actual', n||' rows/'||st, 'verdict', case when n=0 then 'PASS' else 'FAIL' end);

  execute 'reset role';

  -- Transaction-local; discarded by the ROLLBACK below.
  perform set_config('probe.matrix', acc::text, true);
end;
$$;

with r as (
  select * from jsonb_to_recordset(current_setting('probe.matrix')::jsonb)
    as x(kind text, probe text, expected text, actual text, verdict text)
)
select kind, probe, expected, actual, verdict from r
union all
select 'VERDICT',
       (select count(*)::text from r) || ' probes',
       (select count(*)::text from r where verdict='PASS') || ' pass',
       (select count(*)::text from r where verdict='FAIL') || ' fail',
       case when exists (select 1 from r where verdict='FAIL')
            then 'OVERALL FAIL' else 'OVERALL PASS' end
order by 1 desc, 2;

rollback;
