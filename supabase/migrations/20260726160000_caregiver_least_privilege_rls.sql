-- Milestone 8 · C1 — least-privilege RLS for the hired-caregiver role.
--
-- ── WHY THIS FILE ADDS AND NEVER REWRITES ────────────────────────────────────
--
-- Adding a role means touching RLS, and a permission regression is the most
-- dangerous defect class in this codebase — Milestone 7 fixed a live production
-- bug of exactly that shape. So NOT ONE existing policy is dropped, altered or
-- re-created here. Every statement below is a `CREATE POLICY ... AS RESTRICTIVE`
-- or a new function.
--
-- RESTRICTIVE is the whole trick. PostgreSQL combines PERMISSIVE policies with
-- OR and then ANDs the result with every RESTRICTIVE policy. You therefore
-- cannot subtract a privilege with another permissive policy — but a restrictive
-- one narrows without touching what is already there. Each predicate below has
-- the shape
--
--     not public.is_circle_caregiver(circle_id) or <the caregiver's own scope>
--
-- so for an admin / primary_caregiver / family_member / remote_member the first
-- disjunct is TRUE and the whole policy short-circuits to TRUE. Their access is
-- not merely "intended to be" unchanged — it is unchanged by construction, and
-- the before/after role-probe matrix
-- (docs/deployment/milestone-8-role-probe-read.sql) is the evidence.
--
-- ── WHAT WAS ALREADY TRUE BEFORE THIS FILE ───────────────────────────────────
--
-- `caregiver` has been in the `circle_role` enum since the initial schema
-- (20260607033000:3-10) and is already NAMED in the write policies for
-- medication_logs, care_tasks, daily_care_logs, vital_readings and family_visits.
-- `can_view_all_operational()` deliberately does NOT include it
-- (admin / primary_caregiver / remote_member only), so the row-level read scope
-- for a caregiver already resolves to:
--
--   * care_tasks           → only rows assigned to her or completed by her  ✔ wanted
--   * care_appointments    → only rows assigned to her                      ~ see below
--   * family_visits        → only rows where she is the visitor             ~ see below
--   * medication_logs      → only meds she is responsible for               ✔ wanted
--
-- That is already most of the Milestone 8 permission model. This file closes the
-- five places where the pre-existing rules are WIDER than the milestone allows.
--
-- ── THE FIVE GAPS THIS CLOSES ────────────────────────────────────────────────
--
--  1. circle_members SELECT is `is_circle_member(circle_id)` — role-blind — so a
--     caregiver would read the ENTIRE member roster (names, and for herself the
--     email column). The milestone is explicit: she cannot view the roster.
--     Narrowed to her own membership row, which she needs to resolve her own
--     role. (The `list_circle_members` RPC bypasses RLS and is gated separately
--     in 20260726160100.)
--
--  2. medications / medication_schedules SELECT are `is_circle_member(circle_id)`
--     — she would read every medication in the circle, including ones she has no
--     part in. A hired worker does not need the family's full medication list to
--     give the three doses she is responsible for, and that list is a medical
--     history. Narrowed to the medications she is responsible for, which is the
--     same predicate medication_logs already uses — so the three tables now
--     agree instead of the log being tighter than the medication it points at.
--
--  3. daily_care_logs / vital_readings SELECT are `is_circle_member(circle_id)`.
--     She may RECORD both (the milestone says so — she is the person present),
--     but reading the family's own observations and the recipient's longitudinal
--     vitals is the coordination layer, not the care work in front of her.
--     Narrowed to rows she recorded herself — which is also exactly what the
--     "prove she did her job" protection requires her to be able to see.
--
--  4. family_visits INSERT/UPDATE already name `caregiver`
--     (20260610...:"Members can add their own family visits"), so she could
--     create and edit a family visit for herself. Family visits are out of her
--     remit. Denied.
--
--  5. care_appointments / family_visits SELECT admit her for rows where she is
--     the assignee / visitor. A manager CAN still assign her one — the manager's
--     own INSERT check is `is_active_user_circle_member`, which is role-blind,
--     and widening or narrowing THAT would change a manager's behaviour, which
--     this milestone must not do. So the assignment stays possible and simply
--     becomes inert: she cannot see it. (The client also stops offering her in
--     the appointment/visit assignee pickers.)
--
-- ── WHAT IS DELIBERATELY NOT NARROWED ────────────────────────────────────────
--
--  * care_recipients, doctors, emergency_contacts — she keeps full SELECT.
--    The milestone grants her the emergency card and the recipient's basic
--    profile explicitly: she is the person who would have to call. The emergency
--    card is composed from exactly these three tables plus the recipient's blood
--    type / allergies / chronic conditions / emergency notes.
--  * care_circles — she must resolve her own circle.
--  * profiles, notifications, notification_preferences, push_tokens — already
--    own-row-only for every role.
--  * circle_invitations — RLS is enabled with ZERO policies, so the table is
--    already deny-all to every role; it is reachable only through the
--    manager-gated RPCs.
--
-- Reversible: every object created here is dropped by name in the "undo" block
-- at the foot of this file (commented out — it is documentation, not an action).
-- Nothing here depends on data, so the undo restores the exact prior state.

-- ── 1. The role test ─────────────────────────────────────────────────────────
--
-- SECURITY DEFINER for the same reason `is_circle_member` is: it reads
-- circle_members, and it is called FROM a policy ON circle_members. Running as
-- the owner (which is `rolbypassrls`) is what stops that from recursing.
--
-- `set search_path = ''` + fully-qualified names, matching the house pattern for
-- every other RLS helper.
create or replace function public.is_circle_caregiver(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role = 'caregiver'::public.circle_role
  );
$$;

comment on function public.is_circle_caregiver(uuid) is
  'True when the CALLER is an active hired caregiver of this circle. Used only in '
  'RESTRICTIVE policies of the form `not is_circle_caregiver(circle_id) or <scope>`, '
  'which is why it must stay caller-relative and must never take a user_id argument.';

-- House pattern: CREATE FUNCTION implicitly grants EXECUTE to the PUBLIC
-- pseudo-role, so revoke that, then grant explicitly. `anon` needs no revoke —
-- Milestone 7 H1 (20260726150000) altered the default privileges so new
-- functions in `public` are no longer granted to anon; the assertion block at
-- the foot of this file proves that rule still holds rather than assuming it.
revoke all on function public.is_circle_caregiver(uuid) from public;
grant execute on function public.is_circle_caregiver(uuid) to authenticated;
grant execute on function public.is_circle_caregiver(uuid) to service_role;

-- ── 2. circle_members — she sees only her own membership row ─────────────────
create policy "Caregivers see only their own membership"
  on public.circle_members
  as restrictive
  for select
  to authenticated
  using (
    not public.is_circle_caregiver(circle_id)
    or user_id = (select auth.uid())
  );

-- ── 3. medications + schedules — only what she is responsible for ────────────
create policy "Caregivers see only their responsible medications"
  on public.medications
  as restrictive
  for select
  to authenticated
  using (
    not public.is_circle_caregiver(circle_id)
    or responsible_user_id = (select auth.uid())
  );

create policy "Caregivers see only their responsible schedules"
  on public.medication_schedules
  as restrictive
  for select
  to authenticated
  using (
    not public.is_circle_caregiver(circle_id)
    or public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
  );

-- ── 4. daily logs + vitals — she reads back only what she recorded ───────────
create policy "Caregivers see only their own daily logs"
  on public.daily_care_logs
  as restrictive
  for select
  to authenticated
  using (
    not public.is_circle_caregiver(circle_id)
    or recorded_by = (select auth.uid())
  );

create policy "Caregivers see only their own vital readings"
  on public.vital_readings
  as restrictive
  for select
  to authenticated
  using (
    not public.is_circle_caregiver(circle_id)
    or recorded_by = (select auth.uid())
  );

-- ── 5. family visits — entirely out of her remit ─────────────────────────────
create policy "Caregivers cannot see family visits"
  on public.family_visits
  as restrictive
  for select
  to authenticated
  using (not public.is_circle_caregiver(circle_id));

create policy "Caregivers cannot add family visits"
  on public.family_visits
  as restrictive
  for insert
  to authenticated
  with check (not public.is_circle_caregiver(circle_id));

create policy "Caregivers cannot update family visits"
  on public.family_visits
  as restrictive
  for update
  to authenticated
  using (not public.is_circle_caregiver(circle_id))
  with check (not public.is_circle_caregiver(circle_id));

-- ── 6. appointments — out of her remit even if a manager assigns her one ─────
create policy "Caregivers cannot see care appointments"
  on public.care_appointments
  as restrictive
  for select
  to authenticated
  using (not public.is_circle_caregiver(circle_id));

-- ── 7. Assert the outcome ────────────────────────────────────────────────────
--
-- A migration that silently did nothing is exactly the failure mode this whole
-- milestone is written against, so it checks itself rather than trusting.
do $$
declare
  missing text;
  n       integer;
  expected constant text[][] := array[
    array['circle_members',       'Caregivers see only their own membership'],
    array['medications',          'Caregivers see only their responsible medications'],
    array['medication_schedules', 'Caregivers see only their responsible schedules'],
    array['daily_care_logs',      'Caregivers see only their own daily logs'],
    array['vital_readings',       'Caregivers see only their own vital readings'],
    array['family_visits',        'Caregivers cannot see family visits'],
    array['family_visits',        'Caregivers cannot add family visits'],
    array['family_visits',        'Caregivers cannot update family visits'],
    array['care_appointments',    'Caregivers cannot see care appointments']
  ];
  i integer;
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  -- 7a. the helper exists, is SECURITY DEFINER, and is not anon-executable.
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'is_circle_caregiver'
    and p.prosecdef;
  if n <> 1 then
    raise exception 'M8 failed: is_circle_caregiver missing or not SECURITY DEFINER (found %)', n;
  end if;

  if has_function_privilege('anon', 'public.is_circle_caregiver(uuid)', 'EXECUTE') then
    raise exception
      'M8 failed: is_circle_caregiver is anon-executable - the H1 default-privilege rule regressed';
  end if;
  if not has_function_privilege('authenticated', 'public.is_circle_caregiver(uuid)', 'EXECUTE') then
    raise exception 'M8 failed: authenticated lost EXECUTE on is_circle_caregiver';
  end if;

  -- 7b. every restrictive policy landed, and landed as RESTRICTIVE. A policy
  --     created PERMISSIVE by accident would WIDEN access instead of narrowing
  --     it — the exact inverse of the intent — so the permissive flag is checked
  --     explicitly rather than inferred from the name.
  for i in 1 .. array_length(expected, 1) loop
    select count(*) into n
    from pg_policies
    where schemaname = 'public'
      and tablename  = expected[i][1]
      and policyname = expected[i][2]
      and permissive = 'RESTRICTIVE';
    if n <> 1 then
      missing := coalesce(missing || ', ', '') || expected[i][1] || '.' || expected[i][2];
    end if;
  end loop;
  if missing is not null then
    raise exception 'M8 failed: missing or non-restrictive policy: %', missing;
  end if;

  -- 7c. nothing pre-existing was disturbed. 61 policies existed in `public`
  --     before this file; it adds 9 and removes none.
  select count(*) into n from pg_policies where schemaname = 'public';
  if n <> 70 then
    raise exception
      'M8 failed: expected 70 policies in public after this migration (61 before + 9 new), found %', n;
  end if;

  raise notice 'M8 verified: is_circle_caregiver present, 9 restrictive policies added, 70 total';
end;
$$;

-- ── Undo (documentation, not executed) ───────────────────────────────────────
--
--   drop policy "Caregivers cannot see care appointments"        on public.care_appointments;
--   drop policy "Caregivers cannot update family visits"         on public.family_visits;
--   drop policy "Caregivers cannot add family visits"            on public.family_visits;
--   drop policy "Caregivers cannot see family visits"            on public.family_visits;
--   drop policy "Caregivers see only their own vital readings"   on public.vital_readings;
--   drop policy "Caregivers see only their own daily logs"       on public.daily_care_logs;
--   drop policy "Caregivers see only their responsible schedules" on public.medication_schedules;
--   drop policy "Caregivers see only their responsible medications" on public.medications;
--   drop policy "Caregivers see only their own membership"       on public.circle_members;
--   drop function public.is_circle_caregiver(uuid);
