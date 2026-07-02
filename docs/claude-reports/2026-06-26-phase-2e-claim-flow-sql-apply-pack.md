# Phase 2E-1 — "أنا متكفّل" / Available-to-Claim: FINAL manual SQL apply pack

**Source of truth:** `docs/claude-reports/2026-06-26-phase-2e-claim-flow-rpc-audit.md` (audit + adversarial review). This pack is the **copy-pasteable, manual-only** distillation — no new design. Apply by hand in the **Sanad** Supabase Dashboard → SQL editor. **Nothing here was run.** No CLI, no connection, no data/table/column/enum/role changes.

Objects created/changed by the APPLY:
`list_available_to_claim`, `claim_care_task`, `claim_medication_responsibility`, `claim_care_appointment`, `claim_family_visit`, `set_assigned_appointment_outcome`, `enforce_family_visit_collaborator_scope` (+ its trigger), `enforce_care_task_collaborator_scope` (body replaced — adds claim bypass, behavior otherwise identical), and dropping the own-visit DELETE policy.

---

## 1. Preconditions / run first (read-only)

Run each check. **Do not run §2 APPLY unless the STOP conditions below all pass.**

```sql
-- (a) Live responsibility columns must exist (APPLY depends on them; does NOT add them).
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in
      (('care_appointments','assigned_to'), ('medications','responsible_user_id'));
-- EXPECT: exactly 2 rows.

-- (b) Phase 2D helper functions must exist (proves 2D hardening is live).
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('can_view_all_operational','is_responsible_for_medication',
                  'active_circle_member_role','has_circle_role','is_circle_member');
-- EXPECT: can_view_all_operational + is_responsible_for_medication present (plus the base helpers).

-- (c) No Phase 2E claim functions already exist.
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('list_available_to_claim','claim_care_task','claim_medication_responsibility',
                  'claim_care_appointment','claim_family_visit','set_assigned_appointment_outcome',
                  'enforce_family_visit_collaborator_scope');
-- EXPECT: 0 rows.

-- (d) The task collaborator UPDATE policy must be the POST-2D form (NO `assigned_to is null` branch).
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'care_tasks'
  and policyname = 'Members can update assigned care tasks';
-- EXPECT: qual & with_check =
--   has_circle_role(circle_id, ARRAY['caregiver','family_member']) AND (assigned_to = auth.uid())
-- The predicate must NOT contain `assigned_to is null`.

-- (e) The existing task trigger + its function must exist (APPLY replaces the function body).
select tgname, tgrelid::regclass from pg_trigger where tgname = 'care_tasks_collaborator_scope';
select proname from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'enforce_care_task_collaborator_scope';
-- EXPECT: trigger present + function present.

-- (f) Whether the own-visit DELETE policy is currently present (APPLY drops it; drop is `if exists`).
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'family_visits'
  and policyname = 'Members can delete their own family visits';
-- EXPECT: 0 or 1 row — either is fine.
```

**STOP conditions (do not APPLY if any is true):**

- (a) returns fewer than 2 rows → a live-only column is missing. **Stop.**
- (b) `can_view_all_operational` or `is_responsible_for_medication` is missing → Phase 2D is not applied. **Stop — apply Phase 2D first.**
- (c) returns any row → a Phase 2E object already exists. **Stop and review** (APPLY is idempotent `create or replace`, but confirm intent before overwriting).
- (d) predicate still contains `assigned_to is null`, or the policy is absent → schema is **pre-2D**. **Stop — apply Phase 2D first.** (The claim safety argument relies on post-2D RLS blocking direct non-manager writes to unowned rows.)
- (e) the task trigger or its function is missing → Phase 2D trigger not applied. **Stop.** Before replacing it in §2, eyeball the live `enforce_care_task_collaborator_scope` body against §2's reproduction so the only diff is the added bypass block.
- (f) either result is acceptable; no stop.

---

## 2. Final APPLY SQL

> One transaction. Every statement is transaction-safe DDL (no `ALTER TYPE … ADD VALUE`). Idempotent (`create or replace` / `drop … if exists`). **No data rows, tables, columns, enums, or roles are changed.** Paste and run the whole block once.

```sql
begin;

-- =========================================================================
-- Phase 2E-1 — Available-to-Claim / "أنا متكفّل" : APPLY
-- Managers = {admin, primary_caregiver}; claim-capable = managers + {family_member, caregiver}.
-- remote_member / elder cannot claim.
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

commit;
```

---

## 3. Final VERIFICATION SQL

> Rolled-back tests only. Resolve real UUIDs from the `[QA]` seed (circle `رعاية الوالد الغالي`; family1 `sanad.qa.family1@example.com`, remote1 `sanad.qa.remote1@example.com`). The SQL editor bypasses RLS by default; `set local role authenticated` + `request.jwt.claims.sub` makes `auth.uid()` resolve to the simulated user so RLS/role checks evaluate that member.

```sql
-- (a) All six Phase 2E functions exist.
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('list_available_to_claim','claim_care_task','claim_medication_responsibility',
                  'claim_care_appointment','claim_family_visit','set_assigned_appointment_outcome',
                  'enforce_family_visit_collaborator_scope')
order by proname;
-- EXPECT: 7 rows (6 RPCs + the visit trigger function).

-- (b) The family_visits status-only trigger is bound.
select tgname, tgrelid::regclass as on_table
from pg_trigger
where tgname in ('family_visits_collaborator_scope','care_tasks_collaborator_scope')
order by tgname;
-- EXPECT: family_visits_collaborator_scope on public.family_visits (and the task trigger still present).

-- (c) The own-visit DELETE policy is removed.
select count(*) as own_visit_delete_policy_count
from pg_policies
where schemaname = 'public' and tablename = 'family_visits'
  and policyname = 'Members can delete their own family visits';
-- EXPECT: 0.
```

```sql
-- Resolve ids once (copy into the blocks below).
select cc.id as circle_id from public.care_circles cc
where cc.name = 'رعاية الوالد الغالي' order by cc.created_at limit 1;
select p.id from public.profiles p join auth.users u on u.id = p.id
where lower(u.email) = 'sanad.qa.family1@example.com';
select p.id from public.profiles p join auth.users u on u.id = p.id
where lower(u.email) = 'sanad.qa.remote1@example.com';
```

```sql
-- (d) family1 available-to-claim feed = 6 (task 3 / medication 1 / appointment 1 / visit 1).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<FAMILY1_UUID>","role":"authenticated"}';

  select item_type, count(*)
  from public.list_available_to_claim('<CIRCLE_UUID>')
  group by 1 order by 1;
  -- EXPECT: appointment 1, medication 1, task 3, visit 1   (total 6)
rollback;
```

```sql
-- (e) remote_member cannot view the feed nor claim.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<REMOTE1_UUID>","role":"authenticated"}';

  do $$ begin
    perform public.list_available_to_claim('<CIRCLE_UUID>');
    raise notice 'UNEXPECTED: remote saw the feed';
  exception when others then raise notice 'expected 42501: %', SQLERRM; end $$;

  do $$ begin
    perform public.claim_care_task('<ANY_UNASSIGNED_TASK_ID>');
    raise notice 'UNEXPECTED: remote claimed';
  exception when others then raise notice 'expected 42501: %', SQLERRM; end $$;
rollback;
```

---

## 4. Final ROLLBACK SQL

> One transaction. Reverses §2 completely — drops the Phase 2E objects, drops the visit trigger + function, restores the original task trigger body (without the claim bypass), and restores the own-visit DELETE policy. **No data changes.** The `sanad.in_claim` GUC is transaction-local and needs no cleanup.

```sql
begin;

-- Drop the Phase 2E functions.
drop function if exists public.list_available_to_claim(uuid);
drop function if exists public.claim_care_task(uuid);
drop function if exists public.claim_medication_responsibility(uuid);
drop function if exists public.claim_care_appointment(uuid);
drop function if exists public.claim_family_visit(uuid);
drop function if exists public.set_assigned_appointment_outcome(uuid, public.care_appointment_status);

-- Remove the visit collaborator trigger + function.
drop trigger  if exists family_visits_collaborator_scope on public.family_visits;
drop function if exists public.enforce_family_visit_collaborator_scope();

-- Restore the ORIGINAL care_tasks trigger body (remove the claim-bypass block).
create or replace function public.enforce_care_task_collaborator_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_circle_role(old.circle_id, array['admin','primary_caregiver']::public.circle_role[]) then
    return new;
  end if;
  if old.status <> 'open' then
    raise exception 'collaborators may only act on an open task';
  end if;
  if new.status not in ('completed','cancelled') then
    raise exception 'collaborators may only complete or cancel a task';
  end if;
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
  if new.status = 'completed' then
    if new.completed_by is distinct from auth.uid() or new.completed_at is null then
      raise exception 'completing a task must set completed_by to the current user and completed_at';
    end if;
  else
    if new.cancelled_at is null or new.completed_by is not null then
      raise exception 'cancelling a task must set cancelled_at and leave completed_by null';
    end if;
  end if;
  return new;
end;
$$;

-- Restore the own-visit DELETE policy.
drop policy if exists "Members can delete their own family visits" on public.family_visits;
create policy "Members can delete their own family visits"
on public.family_visits
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver','family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
);

commit;
```

---

## 5. App QA checklist after apply

Run with the `[QA]` seed users once the UI is implemented (server behavior can be pre-checked via §3).

- [ ] **family1 sees the "متاح للتكفّل" feed** — the 6 unowned items (3 tasks, 1 medication فيتامين د, 1 appointment, 1 visit); none of family2/primary1's owned items appear.
- [ ] **family1 can claim a task** ("أنا متكفّل") → task leaves the feed and appears in **my tasks** (assigned to family1, still open).
- [ ] **family1 can claim a medication** → appears in family1's **today's doses**; dose register (أُعطيت/لم تُعطَ/مؤجلة) works.
- [ ] **family1 can claim an appointment** → appears in **my appointments**; outcome (تم الموعد/تعذّر الموعد) works via the outcome RPC.
- [ ] **family1 can claim a visit** → appears in **my visits**; outcome (تمت الزيارة/تعذّرت الزيارة) works; **no delete affordance**.
- [ ] **Claimed item moves to the owner's own screen** — leaves the feed for everyone else on refresh.
- [ ] **Owner can update outcome/status only** — cannot edit task/appointment/visit **details** or the medication catalog; cannot delete a visit (cancel instead).
- [ ] **Manager (admin/primary) still sees all** — unassigned + owned; can assign/reassign/edit/delete as before; may also claim from the feed.
- [ ] **remote_member cannot claim** — the feed/CTA is not offered; any forced call is rejected; remote is never an owner.
- [ ] **Race condition** — two members claim the same item near-simultaneously → one succeeds, the other shows `تم التكفّل بهذا العنصر من شخص آخر` (SQLSTATE 23505) and the item refreshes out of their feed.

---

## 6. Confirmation

- **No SQL was run**; **no Supabase connection**; **no Supabase CLI**; **no migration applied**; **no data changed**.
- **No app source code changed** — the only filesystem write is this markdown file under `docs/claude-reports/`. No dependency, Expo-config, native, backend/Edge-function, generated-types, or migration change. **No EAS, no prebuild.**
- **No `.env` / secrets** read or modified.
- Stayed inside `E:\Projects\sanad-mobile`; **ThinkMate Chess and all other projects untouched**.
- **Not committed, not staged.**

---

## 7. Git status & diff

`git --no-pager status --short`:

```
?? docs/claude-reports/2026-06-26-phase-2e-claim-flow-rpc-audit.md
?? docs/claude-reports/2026-06-26-phase-2e-claim-flow-sql-apply-pack.md
```

*(The first file is the still-uncommitted Phase 2E audit report from the prior task; this task added only the second file. Both are untracked — nothing staged or committed.)*

`git --no-pager diff --stat`:

```
(no output — no tracked files modified; the only changes are the two untracked reports above)
```
