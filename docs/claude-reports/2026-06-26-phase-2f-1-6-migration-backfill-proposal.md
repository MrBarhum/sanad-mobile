# Phase 2F-1.6 — Migration Backfill Proposal / Apply-Pack

**Status:** Proposal / apply-pack **for review only**. **No SQL was run, no Supabase CLI used, no
connection made, no migration files created, no app code / types changed.** The SQL below is *draft
text* to be reviewed and, after human approval, copied into migration files in a later step.
**Baseline commit:** `7839cdf docs(product): audit live schema backfill needs`.
**Predecessors followed:** Phase 2A/2B assignment, Phase 2D RLS (audit + applied-verification), Phase
2E claim flow (rpc-audit + sql-apply-pack + applied-verification), Phase 2F notification readiness,
Phase 2F-1.5 live-schema backfill audit.

> **Provenance of the SQL.** Every block below is transcribed from the exact SQL that the
> applied-verification reports confirm was **manually run in the Sanad Dashboard**: Apply-pack A from
> `2026-06-19-product-phase-2a-assignment-audit.md` §5.1/§5.2 (confirmed applied in
> `2026-06-19-product-phase-2b-assignment-ui.md` §1); Apply-pack B from
> `2026-06-26-phase-2d-rls-hardening-audit.md` §5 (confirmed in `…phase-2d-rls-applied-verification.md`);
> Apply-pack C verbatim from `2026-06-26-phase-2e-claim-flow-sql-apply-pack.md` §2 (confirmed in
> `…phase-2e-claim-flow-applied-verification.md`). Reproducing the **exact** live text is the whole
> point of a backfill — the bodies are not re-designed here.

---

## 1. Executive summary

### 1.1 Why this backfill exists

Phase 2F-1.5 established that the repo's `supabase/migrations/` tree stops at `20260611120200` and
contains **no Phase 2A / 2D / 2E migration**. The entire responsibility + RLS-hardening + claim-flow
layer is **live-only** — applied by hand in the Dashboard and documented only in reports. A fresh
`supabase db reset` / new environment would reproduce the **pre-2D** schema (no assignee columns on
appointments/medications, open `is_circle_member` SELECT policies, and the self-visit-DELETE +
unassigned-task-UPDATE allowances that 2D/2E deliberately removed).

This report packages the **reviewed, additive, idempotent SQL bodies** that will (after human
approval) become three migration files, so the repo can reproduce the live schema and Phase 2F
notification SQL can be authored on a reproducible base.

### 1.2 What it will reconcile

- **Apply-pack A (Phase 2A):** `care_appointments.assigned_to`, `medications.responsible_user_id` (+
  indexes) and the manager INSERT/UPDATE active-member guard policies that shipped with them.
- **Apply-pack B (Phase 2D):** the `can_view_all_operational` / `is_responsible_for_medication`
  helpers; responsibility-scoped SELECT on `care_tasks` / `care_appointments` / `family_visits` /
  `medication_logs`; the `medication_logs` INSERT/UPDATE responsibility gates; and the removal of the
  `care_tasks` collaborator-UPDATE `assigned_to is null` allowance.
- **Apply-pack C (Phase 2E):** `list_available_to_claim`; the four `claim_*` RPCs;
  `set_assigned_appointment_outcome`; `enforce_family_visit_collaborator_scope` (+ trigger); the
  `enforce_care_task_collaborator_scope` body with the `sanad.in_claim` bypass; and the drop of the
  own-visit DELETE policy.

Not in scope (already reconciled): the two **original** columns (`care_tasks.assigned_to`,
`family_visits.visitor_user_id`) and `set_circle_timezone` are in committed migrations + types. **No
new enum/type** is introduced ("unable" reuses the existing `cancelled` status values).

### 1.3 Explicit statement

**No SQL from this report was executed. No migration files were created. No Supabase connection or
CLI command was made. No app source, generated types, dependencies, Expo config, native files, or
existing migrations were modified.** The only filesystem write is this markdown report. All SQL is
review-only draft text.

---

## 2. Proposed migration grouping (do **not** create these files yet)

Three future migration files, dated **after** the last committed migration (`20260611120200`) so
history stays linear:

| Order | Proposed file (future) | Contents |
|---|---|---|
| 1 | `20260626160000_backfill_phase_2a_assignment_columns.sql` | Apply-pack A |
| 2 | `20260626161000_backfill_phase_2d_responsibility_rls.sql` | Apply-pack B |
| 3 | `20260626162000_backfill_phase_2e_claim_flow.sql` | Apply-pack C |

**Why this grouping and order are required (hard dependencies):**

1. **A before B.** The 2D helper `is_responsible_for_medication` and the scoped SELECT/log-gate
   policies reference `medications.responsible_user_id` and `care_appointments.assigned_to`. Those
   columns must exist first, or B fails on a fresh replay.
2. **B before C.** The Phase 2E claim safety argument *depends on* post-2D RLS (a non-manager can no
   longer directly write an unowned row; the claim path is the only sanctioned null→self transition).
   `list_available_to_claim` also reads `responsible_user_id` / `assigned_to`. The 2E apply-pack's own
   STOP conditions (`§1(a)–(e)`) refuse to run unless the 2A columns and 2D helpers are present and
   the task collaborator policy is already in post-2D form — encoding this ordering.
3. **Three files, not one.** Mirrors the three real apply events (each with its own audit +
   applied-verification), keeps each file independently reviewable and rollback-able, and matches the
   house style. A single mega-file would be harder to review against the §7 verification inventory.

**Idempotency posture (all three):** every statement is `add column if not exists` /
`create index if not exists` / `create or replace function` / `drop policy if exists` + `create
policy` / `drop trigger if exists` + `create trigger` / `drop policy if exists` (removal). So each
pack is a **safe no-op against the already-live production DB** and correctly **builds the live state
on a fresh DB** replayed from the committed migrations. The `begin; … commit;` wrappers make them safe
to paste into the Dashboard as-is; when converted to migration files the wrapper can be dropped (the
migration runner wraps each file in its own transaction).

---

## 3. Apply-pack A — Phase 2A assignment columns

> Source: `2026-06-19-product-phase-2a-assignment-audit.md` §5.1 + §5.2 (confirmed applied in
> `2026-06-19-product-phase-2b-assignment-ui.md` §1: "both scripts ran without errors … indexed,
> manager INSERT/UPDATE active-member guard"). Additive nullable columns + guarded indexes; the two
> manager policies per table are dropped/recreated (names preserved) to add the cross-circle
> active-member guard. No table rewrite; no data change.

```sql
begin;

-- =========================================================================
-- Backfill Phase 2A — responsible-person columns for appointments + medications
-- Additive, idempotent. Mirrors care_tasks.assigned_to (nullable FK -> profiles,
-- on delete set null, indexed) and extends the manager INSERT/UPDATE policies
-- with the active-member guard (is_active_user_circle_member). Mutation rights
-- are UNCHANGED (admins / primary caregivers only). No collaborator path added.
-- =========================================================================

-- 1) care_appointments.assigned_to -----------------------------------------
alter table public.care_appointments
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists care_appointments_assigned_to_idx
  on public.care_appointments (assigned_to);

-- INSERT: managers only; doctor must belong to the circle AND a non-null assignee
-- must be an active member of the same circle (blocks cross-circle assignment).
drop policy if exists "Managers can add care appointments" on public.care_appointments;
create policy "Managers can add care appointments"
on public.care_appointments
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (doctor_id is null or public.is_circle_doctor(circle_id, doctor_id))
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

-- UPDATE: managers only; post-update doctor + assignee must satisfy the same guards.
drop policy if exists "Managers can update care appointments" on public.care_appointments;
create policy "Managers can update care appointments"
on public.care_appointments
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (doctor_id is null or public.is_circle_doctor(circle_id, doctor_id))
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

-- 2) medications.responsible_user_id ---------------------------------------
alter table public.medications
  add column if not exists responsible_user_id uuid references public.profiles(id) on delete set null;

create index if not exists medications_responsible_user_id_idx
  on public.medications (responsible_user_id);

-- Manager INSERT/UPDATE gain the active-member guard. Dose-logging RLS is NOT
-- touched here (any caregiving member may still record a dose; responsibility is
-- gated in Apply-pack B on medication_logs).
drop policy if exists "Managers can add medications" on public.medications;
create policy "Managers can add medications"
on public.medications
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (responsible_user_id is null or public.is_active_user_circle_member(circle_id, responsible_user_id))
);

drop policy if exists "Managers can update medications" on public.medications;
create policy "Managers can update medications"
on public.medications
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (responsible_user_id is null or public.is_active_user_circle_member(circle_id, responsible_user_id))
);

notify pgrst, 'reload schema';

commit;
```

---

## 4. Apply-pack B — Phase 2D responsibility-based RLS

> Source: `2026-06-26-phase-2d-rls-hardening-audit.md` §5.0/§5.1/§5.2/§5.4/§5.5 (confirmed in
> `…phase-2d-rls-applied-verification.md` — including the **optional dose-log SELECT scope**, which
> §1 of that report states "was applied alongside the mandatory INSERT/UPDATE gate"). Policy **names
> are preserved** so the swap is exact and rollback is symmetric. Predicates use `(select auth.uid())`
> (evaluated once per query, per Supabase RLS guidance). **SELECT is never broadened back to bare
> `is_circle_member`** — managers/remote read broadly via `can_view_all_operational`; doers see only
> owned/responsible rows. `medications` / `medication_schedules` SELECT deliberately stay broad
> (shared catalog + dose computation + `createMedicationWithSchedule` RETURNING) and are **not**
> touched.

```sql
begin;

-- =========================================================================
-- Backfill Phase 2D — responsibility-based operational RLS
-- Additive helpers + scoped SELECT + responsibility log gates + removal of the
-- unassigned-task collaborator allowance. Idempotent (create or replace / drop
-- policy if exists + recreate). No data change. Depends on Apply-pack A columns.
-- =========================================================================

-- 5.0 Helpers (additive) ---------------------------------------------------
-- "Sees every operational row" = managers + (for now) remote read-only.
-- SINGLE SWITCH POINT for the remote decision: to move remote to summary-only
-- (Option B) later, remove 'remote_member' from this one array.
create or replace function public.can_view_all_operational(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_circle_role(
    p_circle_id,
    array['admin','primary_caregiver','remote_member']::public.circle_role[]
  );
$$;
revoke all on function public.can_view_all_operational(uuid) from public;
grant execute on function public.can_view_all_operational(uuid) to authenticated;

-- True when p_user_id is the responsible owner of a medication in the circle.
create or replace function public.is_responsible_for_medication(
  p_circle_id uuid, p_medication_id uuid, p_user_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.medications m
    where m.id = p_medication_id
      and m.circle_id = p_circle_id
      and m.responsible_user_id = p_user_id
  );
$$;
revoke all on function public.is_responsible_for_medication(uuid, uuid, uuid) from public;
grant execute on function public.is_responsible_for_medication(uuid, uuid, uuid) to authenticated;

-- 5.1 care_tasks — scope SELECT + remove the unassigned collaborator allowance
drop policy if exists "Members can view care tasks" on public.care_tasks;
create policy "Members can view care tasks"
on public.care_tasks
for select
to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (
    public.is_circle_member(circle_id)
    and (
      assigned_to = (select auth.uid())
      or completed_by = (select auth.uid())
    )
  )
);

-- Collaborator UPDATE: drop the `assigned_to is null` branch → doers may act ONLY
-- on tasks assigned to them. The status-only trigger is unchanged (see Apply-pack C
-- for the body that gains only the claim bypass).
drop policy if exists "Members can update assigned care tasks" on public.care_tasks;
create policy "Members can update assigned care tasks"
on public.care_tasks
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver','family_member']::public.circle_role[])
  and assigned_to = (select auth.uid())
)
with check (
  public.has_circle_role(circle_id, array['caregiver','family_member']::public.circle_role[])
  and assigned_to = (select auth.uid())
);

-- 5.2 care_appointments — scope SELECT (INSERT/UPDATE/DELETE stay manager-only) --
drop policy if exists "Members can view care appointments" on public.care_appointments;
create policy "Members can view care appointments"
on public.care_appointments
for select
to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (
    public.is_circle_member(circle_id)
    and assigned_to = (select auth.uid())
  )
);

-- 5.4 medication_logs — gate INSERT/UPDATE to managers-or-responsible ----------
drop policy if exists "Caregivers can add medication logs" on public.medication_logs;
create policy "Caregivers can add medication logs"
on public.medication_logs
for insert
to authenticated
with check (
  (
    public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[])
    or (
      public.has_circle_role(circle_id, array['family_member','caregiver']::public.circle_role[])
      and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
    )
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
);

drop policy if exists "Caregivers can update medication logs" on public.medication_logs;
create policy "Caregivers can update medication logs"
on public.medication_logs
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[])
  or (
    public.has_circle_role(circle_id, array['family_member','caregiver']::public.circle_role[])
    and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
  )
)
with check (
  (
    public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[])
    or (
      public.has_circle_role(circle_id, array['family_member','caregiver']::public.circle_role[])
      and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
    )
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
);

-- 5.4 (applied) medication_logs — scope dose-log READS for doers ---------------
drop policy if exists "Members can view medication logs" on public.medication_logs;
create policy "Members can view medication logs"
on public.medication_logs
for select
to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (
    public.is_circle_member(circle_id)
    and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
  )
);

-- 5.5 family_visits — scope SELECT (own-record INSERT/UPDATE untouched here) ----
drop policy if exists "Members can view family visits" on public.family_visits;
create policy "Members can view family visits"
on public.family_visits
for select
to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (
    public.is_circle_member(circle_id)
    and visitor_user_id = (select auth.uid())
  )
);

notify pgrst, 'reload schema';

commit;
```

*Not touched by B (and intentionally so): `medications` / `medication_schedules` SELECT stay broad
(`is_circle_member`); `care_tasks` INSERT / manager-UPDATE / DELETE; `care_appointments`
INSERT/UPDATE/DELETE; `medication_logs` DELETE (manager-only); the manager guards from Apply-pack A.*

---

## 5. Apply-pack C — Phase 2E claim flow

> Source: **verbatim** from `2026-06-26-phase-2e-claim-flow-sql-apply-pack.md` §2 (the exact block
> confirmed applied in `…phase-2e-claim-flow-applied-verification.md`: single `begin;…commit;`,
> "Success. No rows returned"; post-apply 7 functions / 2 triggers / own-visit DELETE policy = 0;
> remote blocked `42501`). Immediate-claim semantics; already-claimed race → `23505`; unauthorized →
> `42501`; ineligible status → `22023`. The `enforce_care_task_collaborator_scope` body is the
> verified 2D body **plus** the transaction-local `sanad.in_claim` bypass (confined to the single
> guarded UPDATE). No new enum values; existing status enums preserved.

```sql
begin;

-- =========================================================================
-- Backfill Phase 2E-1 — Available-to-Claim / "أنا متكفّل"
-- Managers = {admin, primary_caregiver}; claim-capable = managers + {family_member, caregiver}.
-- remote_member / elder cannot claim. Depends on Apply-pack A columns + Apply-pack B RLS.
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

notify pgrst, 'reload schema';

commit;
```

> **Divergence note (deliberate, safe):** the two trailing `notify pgrst, 'reload schema';` lines in
> packs A and C are **added** beyond the original apply-packs so PostgREST immediately exposes the new
> columns/RPCs after a migration replay. They change no schema and are idempotent. If exact byte
> reproduction of the original apply is preferred, drop them (Supabase reloads on its own shortly
> after). Everything else in pack C is byte-for-byte the applied §2 block.

---

## 6. Grants and security review

**Every callable helper/RPC** uses `security definer` + `set search_path = ''`, schema-qualifies all
objects, and follows `revoke all … from public;` then `grant execute … to authenticated;` — matching
the house pattern. No function is granted to `public`, `anon`, or `service_role`.

| Function | `security definer` / `search_path=''` | Grant | Callable by | Notes |
|---|:--:|---|---|---|
| `can_view_all_operational(uuid)` | ✅ | authenticated | authenticated (RLS internal) | Boolean helper used inside SELECT policies; harmless if called directly. **Single switch point** for the remote read decision. |
| `is_responsible_for_medication(uuid,uuid,uuid)` | ✅ | authenticated | authenticated (RLS internal) | Boolean helper gating dose-log read/insert/update. |
| `list_available_to_claim(uuid)` | ✅ | authenticated | authenticated | Rejects non-member / remote / elder with `42501`; returns only safe display fields (no notes/instructions/doctor). |
| `claim_care_task(uuid)` | ✅ | authenticated | authenticated | Immediate atomic claim; `42501` / `23505` / `22023`. |
| `claim_medication_responsibility(uuid)` | ✅ | authenticated | authenticated | as above |
| `claim_care_appointment(uuid)` | ✅ | authenticated | authenticated | as above |
| `claim_family_visit(uuid)` | ✅ | authenticated | authenticated | as above |
| `set_assigned_appointment_outcome(uuid, care_appointment_status)` | ✅ | authenticated | authenticated | manager **or** assigned member only; `scheduled → completed/cancelled` only; writes status only. |
| `enforce_care_task_collaborator_scope()` | ✅ | *(trigger fn)* | invoked by trigger only | **Internal.** Not meaningfully callable directly (needs `NEW`/`OLD`). See note below. |
| `enforce_family_visit_collaborator_scope()` | ✅ | *(trigger fn)* | invoked by trigger only | **Internal.** As above. |

**Callable by `authenticated`:** the two helpers + `list_available_to_claim` + the four `claim_*` +
`set_assigned_appointment_outcome` (8 functions). **Internal-only:** the two trigger functions (run by
`care_tasks_collaborator_scope` / `family_visits_collaborator_scope`).

**No broad grant to `public`.** Every callable function explicitly `revoke all … from public`. The
Apply-pack A/B **policies** widen nothing: INSERT/UPDATE stay manager-only (A); SELECT is scoped to
`can_view_all_operational OR owner` (B) — **never** reverted to bare `is_circle_member`. `remote_member`
gets **read-only** breadth via `can_view_all_operational` and **no** write policy anywhere (not in any
`[caregiver,family_member]` or manager array), and is rejected from the claim feed/claim RPCs with
`42501`. `elder` is likewise excluded.

**One observation (not a change):** the two **trigger functions** are created *without* an explicit
`revoke … from public`, so — like any Postgres function — they carry the default `EXECUTE` to
`PUBLIC`. This is **harmless**: a trigger function returning `trigger` cannot be usefully invoked
outside a trigger (it dereferences `NEW`/`OLD`). To exactly reproduce the live objects, the backfill
**keeps** them as-is. An optional tidy-up (`revoke all on function
public.enforce_*_collaborator_scope() from public;`) could be added later, but is not required and is
out of scope for a faithful backfill.

---

## 7. Verification SQL (read-only — run manually **after** applying; do **not** run now)

All queries are read-only inventory checks for the user to run in the Dashboard SQL editor after a
future apply. **Nothing here is executed by this report.**

> **On the QA counts in checks (9)–(10) — historical references, not guaranteed live counts.** The
> specific numbers cited below (family1 seeing tasks 4 / appointments 3 / visits 2 / medication_logs
> 1, and the available-to-claim feed of 6) are **historical `[QA]`-seed baselines from the earlier
> applied-verification reports** and held only for one specific seed state. They are **not** guaranteed
> current-live counts: on the real circle the live feed was larger (≈15 items, because older non-`[QA]`
> unassigned items also qualify), and any manual QA that has since **claimed** items will legitimately
> lower these numbers. Treat the structural checks (1)–(8) and the security invariant (9) as the ones
> that must hold exactly; treat the counts in (10) as **regression references** to compare against a
> known or freshly-reseeded `[QA]` baseline only.

```sql
-- (1) Columns exist (Apply-pack A).
select table_name, column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in
      (('care_appointments','assigned_to'), ('medications','responsible_user_id'));
-- EXPECT: exactly 2 rows, both uuid, is_nullable = YES.

-- (2) Indexes exist (Apply-pack A).
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in ('care_appointments_assigned_to_idx','medications_responsible_user_id_idx');
-- EXPECT: 2 rows.

-- (3) Helper + RPC signatures exist (Apply-packs B + C).
select proname, pg_get_function_identity_arguments(oid) as args, prosecdef as security_definer
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('can_view_all_operational','is_responsible_for_medication',
                  'list_available_to_claim','claim_care_task','claim_medication_responsibility',
                  'claim_care_appointment','claim_family_visit','set_assigned_appointment_outcome',
                  'enforce_family_visit_collaborator_scope','enforce_care_task_collaborator_scope')
order by proname;
-- EXPECT: 10 rows; every row security_definer = true. Phase-2E callable set (6 RPCs) +
--         enforce_family_visit_collaborator_scope = the "7 functions" the 2E verification counted.

-- (4) Trigger count (both status-only triggers bound).
select tgname, tgrelid::regclass as on_table
from pg_trigger
where tgname in ('family_visits_collaborator_scope','care_tasks_collaborator_scope')
order by tgname;
-- EXPECT: 2 rows — family_visits_collaborator_scope on public.family_visits,
--         care_tasks_collaborator_scope on public.care_tasks.

-- (5) Own-visit DELETE policy is removed = 0.
select count(*) as own_visit_delete_policy_count
from pg_policies
where schemaname = 'public' and tablename = 'family_visits'
  and policyname = 'Members can delete their own family visits';
-- EXPECT: 0.

-- (6) Task collaborator UPDATE policy has NO `assigned_to is null` branch.
select policyname, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'care_tasks'
  and policyname = 'Members can update assigned care tasks';
-- EXPECT: qual & with_check =
--   has_circle_role(circle_id, ARRAY['caregiver','family_member']) AND (assigned_to = auth.uid())
-- MUST NOT contain `assigned_to is null`.

-- (7) Scoped SELECT policies use responsibility predicates (not bare is_circle_member).
select tablename, policyname, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('care_tasks','care_appointments','family_visits','medication_logs')
  and cmd = 'SELECT'
order by tablename, policyname;
-- EXPECT each qual references can_view_all_operational(circle_id) OR the owner column
-- (assigned_to / visitor_user_id / is_responsible_for_medication(...)). NONE should be a
-- bare public.is_circle_member(circle_id).

-- (8) medications / medication_schedules SELECT deliberately stayed BROAD.
select tablename, policyname, qual
from pg_policies
where schemaname = 'public' and tablename in ('medications','medication_schedules') and cmd = 'SELECT';
-- EXPECT: is_circle_member(circle_id) (shared catalog — intentional, not drift).
```

```sql
-- (9) remote feed/claim blocked — rolled-back simulation (resolve real [QA] UUIDs first).
-- Circle 'رعاية الوالد الغالي'; remote1 sanad.qa.remote1@example.com.
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

```sql
-- (10) Family1 RLS simulation — HISTORICAL [QA]-seed reference, NOT a guaranteed live count.
-- Same-seed-state baselines only (from the earlier reports):
--   phase-2d-rls-applied-verification §4 recorded Tasks 4, Appointments 3, Visits 2, Medication logs 1.
--   phase-2e-claim-flow-applied-verification §3(d) recorded an available-to-claim feed of 6
--     (task 3 / medication 1 / appointment 1 / visit 1) as the [QA]-only expected SUBSET.
-- list_available_to_claim caveats: the TOTAL live feed may be GREATER than 6 (older non-[QA]
--   unassigned items also qualify — it was ≈15 live), and after any claims even that [QA]-only
--   subset can DECREASE. These counts match only on the same seed state and legitimately change
--   once items are claimed. The count-independent SECURITY invariant that must hold regardless:
--   family1 sees ONLY its own/responsible/linked rows (assigned_to / responsible / visitor =
--   family1), never unrelated members' items.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<FAMILY1_UUID>","role":"authenticated"}';
  select 'tasks'        as t, count(*) from public.care_tasks         where circle_id = '<CIRCLE_UUID>'
  union all select 'appointments', count(*) from public.care_appointments where circle_id = '<CIRCLE_UUID>'
  union all select 'visits',       count(*) from public.family_visits     where circle_id = '<CIRCLE_UUID>';
  -- Same-seed reference only: tasks 4, appointments 3, visits 2 (medication_logs 1 — check separately).
  -- After claims these can legitimately change; the invariant is that family1 sees ONLY its
  -- own/responsible/linked rows, never unrelated members' items — that is the real check here.
rollback;
```

If any of the **structural / security** checks (1)–(9) disagree with these documented expectations,
the **live** DB has itself drifted from the reports — **stop and reconcile before creating migration
files.** Check (10) is a **historical `[QA]`-seed regression reference, not a strict current-live
count** (see the note under the §7 heading): its numbers hold only on the same seed state and
legitimately change after items are claimed, so a mismatch there should be investigated (most likely
an item was claimed during QA, or older non-`[QA]` items are present) rather than treated as schema
drift.

---

## 8. Risk notes

1. **Exact-reproduction risk (highest).** The backfill's value is that a replay reproduces the live
   schema *identically*. The bodies here are transcribed from the verified apply-packs, but the
   authoritative comparison is against the **live** objects. Before creating migration files, run the
   §7 inventory (and, ideally, `pg_get_functiondef` on each function) and diff against these blocks;
   proceed only on an exact match.
2. **Function-body drift risk.** The single highest-care object is
   `enforce_care_task_collaborator_scope` — its **live body already contains** the `sanad.in_claim`
   bypass (Apply-pack C step 4), which is *not* in the committed `20260610090000` migration. If a
   reviewer instead copies the committed (pre-2E) body into the backfill, the claim path breaks
   subtly. Use the pack-C body verbatim; verify with `pg_get_functiondef`.
3. **Policy-name mismatch risk.** `drop policy if exists` is only correct if the name matches exactly.
   If the live DB carries any operational SELECT policy under a *different* name (e.g. a
   manually-added extra), tightening the named one leaves the other OR-ing in full access
   (multiple permissive SELECT policies are OR-ed). §7 check (7) and a full `pg_policies` dump per
   table guard against this — confirm each table has exactly the expected policy set and no stray
   permissive SELECT.
4. **Dashboard-live vs. repo-migration-sequence risk.** Even after backfill, **the Dashboard remains
   the source of truth for current production**; the migration files bring the *repo* forward. Because
   the packs are idempotent, applying them to live is a safe no-op — but the intent is repo/new-env
   reproduction, not re-applying to production. Keep the ordering A→B→C; a fresh replay runs the
   committed base migrations first, then these three transform them to the live state.
5. **Types-regeneration timing.** Do **not** regenerate `src/types/supabase.ts` from a fresh
   migrations-only DB (it would delete the two hand-patched columns and break the build). Regenerate
   **from live**, and only **after** the backfill files exist and are validated — which then makes the
   `callClaimRpc` cast in `src/features/claiming/api.ts` redundant (it may stay; removing it is a
   later code change).
6. **No notification SQL before this is reconciled.** Phase 2F recipient resolution depends on the
   live-only columns/helpers/RPCs reconciled here (2F-1.5 §5). Authoring Phase 2F-2 notification SQL
   against the stale committed migrations risks referencing objects the repo doesn't declare or
   re-introducing dropped allowances. **2F-2 must follow the backfill.**
7. **`caregiver` in policy arrays** is intentional (kept for parity) though the role is not activated
   — harmless (no such members). Do not activate it here.
8. **Apply-pack A column FKs** are `on delete set null`; a removed member's profile clears the
   assignment rather than orphaning. This matches live and needs no data migration (both columns
   default null).

---

## 9. Recommended next step

**Human review of the three SQL bodies above**, then one of:

- **If they match live** (§7 inventory + `pg_get_functiondef` diff all agree): proceed to create the
  three actual migration files
  (`20260626160000_backfill_phase_2a_assignment_columns.sql`,
  `20260626161000_backfill_phase_2d_responsibility_rls.sql`,
  `20260626162000_backfill_phase_2e_claim_flow.sql`) from these reviewed bodies (a normal committed
  change, outside this report-only phase), run local/static validation (`tsc --noEmit`,
  `expo-doctor`, `diff --check`) and — ideally — a `db reset` on a scratch project to prove replay
  reproduces live; then regenerate types **from live**.
- **If a mismatch is found:** adjust this proposal to match the live objects exactly, re-review, then
  create the files.

**Do not proceed to Phase 2F-2 notification SQL yet.** The notification recipient/producer design
must build on the reconciled schema, after the backfill files exist and types are regenerated.

---

## 10. Confirmation

- ✅ **No SQL run.** All SQL is review-only draft text; nothing executed.
- ✅ **No Supabase CLI / connection.** No `supabase` command, no login/link/db push/pull/dump, no
  `gen types`, no remote access or introspection. Every "live" fact is quoted from prior reports.
- ✅ **No app code changed.** No source, dependencies, Expo config, native files, or backend functions
  modified.
- ✅ **No migration files created.** Nothing was written under `supabase/migrations/`. The three file
  names are proposals only.
- ✅ **No generated types changed.** `src/types/supabase.ts` untouched.
- ✅ **No env / secrets touched.** No `.env` read; no tokens/keys inspected or printed.
- ✅ **No commit / no stage / no EAS / no prebuild.** The only filesystem write is this markdown
  report. No other project touched (ThinkMate untouched).

## 11. `git` status & diff

Run at hand-off (read-only):

- `git --no-pager status --short`
- `git --no-pager diff --stat`

The only expected change is the addition of this untracked file:
`docs/claude-reports/2026-06-26-phase-2f-1-6-migration-backfill-proposal.md`.
