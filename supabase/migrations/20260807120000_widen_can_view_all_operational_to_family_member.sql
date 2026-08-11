-- Milestone 9 · D1 — add `family_member` to public.can_view_all_operational().
--
-- ── WHAT THIS CLOSES ─────────────────────────────────────────────────────────
--
-- CLAUDE.md standing decision A1 ("transparent circle") says every ACTIVE member
-- may SEE all of a circle's operational data, and claims this "mirrors the server
-- can_view_all_operational posture". It never did — it inverted it. The function
-- has been `admin | primary_caregiver | remote_member` since Phase 2D
-- (20260626161000_backfill_phase_2d_responsibility_rls.sql:24-32), so a
-- family_member was narrowed by RLS to her own rows on every gated surface.
--
-- The shipped result was incoherent in a way no reading defends: a READ-ONLY
-- remote member saw MORE of the circle than an ACTIVE family member doing the
-- care. It also made two shipped affordances dishonest — the «كل المهام» scope
-- pill returned a list identical to «مهامي», and the inline «أنا متكفّل» claim
-- pill could never render for the roles it was built for, because an unassigned
-- task (`assigned_to IS NULL`) can never satisfy `assigned_to = auth.uid()`.
--
-- Full analysis: docs/claude-reports/2026-08-07-qa-verification.md (F1).
-- Runbook + acceptance criteria: docs/deployment/milestone-9-d1-runbook.md.
--
-- ── ADD family_member. NEVER caregiver. ──────────────────────────────────────
--
-- This is the load-bearing sentence of the file. `care_tasks` and
-- `medication_logs` are the only two gated tables with NO restrictive Milestone-8
-- backstop — 20260726160000_caregiver_least_privilege_rls.sql narrows
-- circle_members, medications, medication_schedules, daily_care_logs,
-- vital_readings, family_visits and care_appointments, and not those two. So this
-- function is the ONLY thing holding them narrow for a hired caregiver. Adding
-- 'caregiver' here would silently hand a paid worker the family's entire task list
-- and complete dose history, with no policy left to catch it.
--
-- ── FIVE SURFACES MOVE, NOT ONE ──────────────────────────────────────────────
--
-- Every gated policy CALLS this function; not one inlines the array. So replacing
-- the body widens all five at once, including one that lives outside this tree:
--
--   S1 public.care_tasks         SELECT  20260626161000:54-68  (assigned_to/completed_by = me)
--   S2 public.care_appointments  SELECT  20260626161000:88-99  (assigned_to = me)
--   S3 public.medication_logs    SELECT  20260626161000:150-161(responsible for the medication)
--   S4 public.family_visits      SELECT  20260626161000:164-175(visitor_user_id = me)
--   S5 storage.objects           SELECT  docs/deployment/dose-proof-storage.sql:67-85
--
-- S5 is the trap 20260729120000:60-65 warns about: a migrations-only scan finds
-- four call sites; there are five. The dose-proof bucket therefore widens for
-- family_member whether or not a line is written about storage — the only choice
-- available was whether to COUNTERACT it, and the decision is not to. The storage
-- policy's own header says it mirrors the medication_logs row policy and that "if
-- those row policies ever change, change these in the same migration"; freezing it
-- narrow would leave a photo LESS visible than the row that points at it, so the UI
-- would render a photo slot whose signed-URL request 400s. See the runbook for the
-- full argument, including the point that remote_member already reads every one of
-- those photos today.
--
-- The delta on S5 is READ-only: INSERT/UPDATE/DELETE on the bucket
-- (dose-proof-storage.sql:92-207) never call this function.
--
-- NOTE the `medication_id` path segment stays load-bearing after this change: it
-- scopes the CAREGIVER to her own medications' photos via the policy's second
-- disjunct, and it backs the CHECK constraint at 20260726130000:44-61 that stops a
-- row pointing at another circle's object. It is not decorative.
--
-- ── `create or replace`, NEVER `drop` ────────────────────────────────────────
--
-- All five policies hold a pg_depend dependency on this function's OID.
-- `drop function` errors; `drop ... cascade` SILENTLY DROPS ALL FIVE POLICIES,
-- leaving care_tasks, care_appointments, medication_logs and family_visits with no
-- permissive SELECT policy at all — deny-all for every role, admins included.
-- `create or replace` preserves the OID (so the policies are not even invalidated)
-- and preserves privileges (so `authenticated` keeps EXECUTE and `anon` stays
-- revoked under the H1 rule from 20260726150000).
--
-- Idempotent / safe to re-run. Creates no policy, so the M8 relative policy-count
-- assertion at 20260726160000:315-345 is unaffected on a fresh replay.
-- Rollback: docs/deployment/milestone-9-d1-rollback.sql (verified to restore the
-- exact pre-D1 read matrix).

create or replace function public.can_view_all_operational(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_circle_role(
    p_circle_id,
    array['admin','primary_caregiver','family_member','remote_member']::public.circle_role[]
  );
$$;

comment on function public.can_view_all_operational(uuid) is
  'True when the CALLER sees every operational row in this circle: admin, '
  'primary_caregiver, family_member (added by Milestone 9 D1) and remote_member. '
  'The hired `caregiver` is deliberately EXCLUDED and must stay excluded — care_tasks '
  'and medication_logs have no restrictive M8 backstop, so this function is the only '
  'thing holding them narrow for her. Gates five SELECT policies: care_tasks, '
  'care_appointments, medication_logs, family_visits, and the dose-proof storage '
  'bucket (docs/deployment/dose-proof-storage.sql).';

revoke all on function public.can_view_all_operational(uuid) from public;
grant execute on function public.can_view_all_operational(uuid) to authenticated;

-- ── Assert the outcome ───────────────────────────────────────────────────────
--
-- A migration that silently did nothing is the failure mode this milestone is
-- written against, so it checks itself. Critically it asserts the three ORIGINAL
-- roles are still present as well as the new one: checking only for
-- 'family_member' would pass even if the whole array had been replaced by a single
-- element, which would lock every manager out of the circle.
do $$
declare
  body text;
  missing text;
  role_name text;
  expected constant text[] := array['admin','primary_caregiver','family_member','remote_member'];
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  select p.prosrc into body
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'can_view_all_operational';

  if body is null then
    raise exception 'D1 failed: public.can_view_all_operational is missing';
  end if;

  foreach role_name in array expected loop
    if position('''' || role_name || '''' in body) = 0 then
      missing := coalesce(missing || ', ', '') || role_name;
    end if;
  end loop;
  if missing is not null then
    raise exception 'D1 failed: role(s) absent from can_view_all_operational: %', missing;
  end if;

  -- The one role that must NOT be there. A future "just add caregiver too" is the
  -- single most damaging edit available to this function; fail the migration rather
  -- than let it land quietly.
  if position('''caregiver''' in replace(body, '''primary_caregiver''', '')) > 0 then
    raise exception
      'D1 failed: caregiver present in can_view_all_operational - care_tasks and '
      'medication_logs have no restrictive backstop and would open to a hired worker';
  end if;

  -- SECURITY DEFINER is what lets the function read circle_members from inside a
  -- policy on tables the caller cannot fully read. Losing it would break every gate.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'can_view_all_operational' and p.prosecdef
  ) then
    raise exception 'D1 failed: can_view_all_operational is no longer SECURITY DEFINER';
  end if;

  -- `create or replace` preserves privileges; prove it rather than assume it.
  if has_function_privilege('anon', 'public.can_view_all_operational(uuid)', 'EXECUTE') then
    raise exception 'D1 failed: can_view_all_operational became anon-executable';
  end if;
  if not has_function_privilege('authenticated', 'public.can_view_all_operational(uuid)', 'EXECUTE') then
    raise exception 'D1 failed: authenticated lost EXECUTE on can_view_all_operational';
  end if;

  raise notice
    'D1 verified: can_view_all_operational = admin, primary_caregiver, family_member, remote_member (caregiver excluded)';
end;
$$;

notify pgrst, 'reload schema';
