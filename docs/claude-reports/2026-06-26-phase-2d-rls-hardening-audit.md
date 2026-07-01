# Phase 2D — RLS hardening audit + manual SQL proposal (responsibility-based operational access)

**Baseline:** `54e27f9 fix(product): scope operational surfaces by responsibility`.
**Status of this document:** audit + **proposal only**. **No SQL was run**, no Supabase CLI used, no connection made, no app code changed except adding this report. Nothing committed or staged.

> ⚠️ The operational scoping shipped in `54e27f9` is **UI-only** (client `Array.filter` over data the server still returns in full). This document proposes the server-side (RLS) enforcement. **Do not apply the SQL from this report yet** — run the **§7 inventory first** to confirm the live policies match the assumptions below, because two columns (`care_appointments.assigned_to`, `medications.responsible_user_id`) and possibly other policy tweaks were applied **manually** to the live DB and may not be fully represented in the repo migrations.

---

## 0. Method & sources inspected

- Migrations: `initial_core_schema`, `create_care_circle_rpc`, `create_care_tasks`, `create_care_appointments`, `create_family_visits`, `create_medications`, `create_medication_schedules`, `create_medication_logs`, `harden_step_3_rls_membership_checks`, `harden_medication_rls_ownership_checks`, `lock_down_membership_and_ownership`, `add_care_circle_timezone`.
- Generated types: `src/types/supabase.ts` (live-schema mirror — confirms `care_appointments.assigned_to` and `medications.responsible_user_id` exist in the live DB although absent from the committed `create_*` migrations).
- App API: `src/features/{tasks,appointments,medications,visits}/api.ts`, `src/features/circle-members/api.ts`, `src/features/circle-selection/permissions.ts`.
- Confirmed: member display names come from the **`list_circle_members` SECURITY DEFINER RPC**, not direct `profiles` reads (`profiles` RLS is own-row only). **Tightening operational SELECT policies therefore does NOT affect responsible/assignee name display.**

Role → capability map (`permissions.ts`, mirrors every RLS role array):

| Role | `canManage` | `canLogDoses` | Audit class |
| --- | --- | --- | --- |
| `admin` | ✅ | ✅ | manager (sees all) |
| `primary_caregiver` | ✅ | ✅ | manager (sees all) |
| `family_member` | ❌ | ✅ | doer (scoped to self) |
| `caregiver` *(not activated)* | ❌ | ✅ | doer-like |
| `remote_member` | ❌ | ❌ | read-only |
| `elder` *(not activated)* | ❌ | ❌ | read-only |

---

## 1. Current RLS / policy inventory by table

Helper functions present (all `SECURITY DEFINER`, `stable`, `search_path=''` unless noted), reusable by the proposal:

- `is_circle_member(circle_id)` → caller is an **active** member (`auth.uid()`).
- `has_circle_role(circle_id, roles[])` → caller is an **active** member whose role ∈ roles.
- `is_user_circle_member(circle_id, user_id)` / `is_active_user_circle_member(circle_id, user_id)` → membership of a **given** user.
- `is_circle_doctor`, `is_circle_medication`, `is_circle_medication_schedule`, `is_circle_medication_schedule_for_medication` → same-circle/ownership integrity checks (explicit params; fixed the old ambiguous-`circle_id` tautology).
- `enforce_care_task_collaborator_scope()` → `BEFORE UPDATE` trigger on `care_tasks`: a non-manager may only move an **open** task to completed/cancelled, may not edit content/reassign, and must set `completed_by = auth.uid()` honestly.
- `active_circle_member_role(circle_id)` (Step 5.0, referenced by `set_circle_timezone`), `set_updated_at()`, `handle_new_user()`, plus RPCs `create_care_circle`, `transfer_circle_ownership`, membership RPCs.

| Table | Operation | Current policy (name) | Predicate (effective) |
| --- | --- | --- | --- |
| **care_tasks** | SELECT | "Members can view care tasks" | `is_circle_member(circle_id)` → **every active member sees ALL tasks** |
| | INSERT | "Managers can add care tasks" | managers + `(assigned_to is null or is_active_user_circle_member(circle_id, assigned_to))` |
| | UPDATE (mgr) | "Managers can update care tasks" | USING managers; CHECK managers + assignee-valid |
| | UPDATE (collab) | "Members can update assigned care tasks" | `has_circle_role(circle_id,[caregiver,family_member]) and (assigned_to is null OR assigned_to = auth.uid())` **← allows acting on UNASSIGNED** + status-only trigger |
| | DELETE | "Managers can delete care tasks" | managers |
| **care_appointments** | SELECT | "Members can view care appointments" | `is_circle_member` → **all members see ALL** |
| | INSERT/UPDATE | "Managers can add/update care appointments" | managers + `(doctor_id is null or is_circle_doctor(...))`. **No `assigned_to` reference anywhere.** |
| | DELETE | "Managers can delete care appointments" | managers |
| **medications** | SELECT | "Members can view medications" | `is_circle_member` → **all members see ALL** |
| | INSERT/UPDATE/DELETE | "Managers can add/update/delete medications" | managers. **No `responsible_user_id` reference anywhere.** |
| **medication_schedules** | SELECT | "Members can view medication schedules" | `is_circle_member` → all |
| | INSERT/UPDATE/DELETE | "Managers …" | managers + `is_circle_medication(...)` |
| **medication_logs** | SELECT | "Members can view medication logs" | `is_circle_member` → all |
| | INSERT/UPDATE | "Caregivers can add/update medication logs" | `has_circle_role(circle_id,[admin,primary_caregiver,family_member,caregiver])` + circle/medication/schedule integrity. **No responsibility check — any caregiving member may log ANY medication's dose.** |
| | DELETE | "Managers can delete medication logs" | managers |
| **family_visits** | SELECT | "Members can view family visits" | `is_circle_member` → all |
| | INSERT (mgr) | "Managers can add family visits" | managers + visitor-valid |
| | INSERT (own) | "Members can add their own family visits" | `[caregiver,family_member]` + `visitor_user_id = auth.uid()` |
| | UPDATE (mgr/own) | "Managers/Members … update …" | managers; or `[caregiver,family_member]` + `visitor_user_id = auth.uid()` |
| | DELETE (mgr/own) | "Managers/Members … delete …" | managers; or `[caregiver,family_member]` + `visitor_user_id = auth.uid()` |
| **circle_members** | SELECT only | "Users can view members in their circles" | `is_circle_member`. Writes **revoked** → RPC-only (`lock_down…`). |
| **care_circles** | SELECT only | "Users can view circles they belong to" + "Owners can view their own circles" | `is_circle_member(id)` / `owner_id = auth.uid()`. Writes **revoked** → RPC-only. |
| **profiles** | SELECT/UPDATE own | "Users can view/update their own profile" | `id = auth.uid()`. Member names exposed only via `list_circle_members` RPC. |

---

## 2. App queries / mutations that depend on these tables

| Area | Read | Write |
| --- | --- | --- |
| Tasks | `fetchTasks` `select('*').eq('circle_id')`; `fetchTask(id)` (detail) | `createTask` (mgr); `updateTask` (mgr, no RETURNING); `completeTask`/`cancelTask` (status update, no RETURNING); `deleteTask` (mgr) |
| Appointments | `fetchUpcomingAppointments` `select('*').eq('circle_id').gte('starts_at', today)`; `fetchAppointment(id)` | `createAppointment`/`updateAppointment`/`setAppointmentStatus`/`deleteAppointment` (all mgr; no RETURNING) |
| Medications | `fetchActiveMedications`, `fetchActiveSchedules`, `fetchSchedulesByMedication`, `fetchLogsForDate`, `fetchMedication(id)` — **today's-doses is computed client-side from medications + schedules + logs together** (`today.ts`) | `createMedicationWithSchedule` **chains `.insert(...).select('id').single()` (RETURNING — needs SELECT-visibility of the new medication)**; `updateMedication`/`setMedicationActive`/`deleteMedication`; schedule writes; `insertLog`/`updateLogStatus` (dose logging); `deleteLog` (mgr) |
| Visits | `fetchVisits` `select('*').eq('circle_id')`; `fetchVisit(id)` | `createVisit`/`updateVisit`/`setVisitStatus`/`deleteVisit` |
| Members | `list_circle_members` RPC | role/status/leave/transfer RPCs |

Dependencies that constrain the proposal:

1. **Dose computation needs `medications` + `medication_schedules` + `medication_logs` readable together.** If `medications`/`schedules` SELECT were scoped to a family member's responsible meds, the **"All medications" catalog tab** (intentionally shared reference data per Phase 2B) would break, and dose names/times couldn't resolve. ⇒ **Keep `medications` and `medication_schedules` SELECT broad.** Enforce dose responsibility at the **log mutation** layer instead.
2. **`createMedicationWithSchedule` uses RETURNING** (`.select('id')`). The new medication must be SELECT-visible to its inserting manager. Broad `medications` SELECT (unchanged) satisfies this. (No other operational insert chains `.select()`, so tightened SELECT policies won't block any write.)
3. **Manager mutations are role-only** (USING = `has_circle_role([admin,primary_caregiver])`), independent of any assignee. Managers updating rows assigned to others keeps working after SELECT scoping (PostgREST updates here don't RETURNING).
4. The UI already filters every operational surface client-side, so tightening the server to match is **zero-regression** for the shipped app (the client filter becomes redundant, not contradicted).

---

## 3. Risk analysis (current server-side reality)

**What a `family_member` can do server-side TODAY (regardless of the UI):**
- **Read every task / appointment / medication / schedule / dose log / visit in the circle** (all SELECT = `is_circle_member`). The UI hides others' items; the API returns them in full to anyone with a valid session who calls `select('*')` directly.
- **Complete/cancel UNASSIGNED tasks** — the collaborator UPDATE policy allows `assigned_to is null`. (Content edits/reassign are still blocked by the trigger; but acting on unassigned violates the new "unassigned = manager-only" policy.)
- **Log/record a dose for ANY medication** in the circle, including meds they are not responsible for (`medication_logs` insert/update = any caregiving member). The UI gates the register button to responsible meds; the server does not.
- **Record/update/delete their own visits** (already correctly scoped to `visitor_user_id = auth.uid()`).
- Cannot insert/update tasks (beyond own-assigned status), appointments, medications, or schedules (manager-only). Cannot delete tasks/appointments/medications/logs.

**What a `remote_member` can do server-side TODAY:**
- **Read everything** in the circle (SELECT = `is_circle_member`, which includes remote).
- **No operational mutations**: remote is excluded from every collaborator/caregiver write array (`[caregiver,family_member]` for tasks/visits; `[admin,primary_caregiver,family_member,caregiver]` for logs) and from all manager arrays. ✅ Remote is already effectively read-only at the server — the only open question is whether its **reads** should stay broad.

**What UI-only scoping hides but does NOT enforce (the gap this proposal closes):**
- Family seeing only their assigned tasks / appointments, responsible doses, linked visits → **not enforced** (server returns all).
- Family not acting on unassigned tasks → **not enforced** (collaborator policy still allows `assigned_to is null`).
- Family registering doses only for responsible meds → **not enforced** (any caregiving member may log any med).
- "Unassigned = manager-only" → **not enforced** for reads or for task actions.

---

## 4. Proposed server-side access matrix

`M` = manager (`admin`/`primary_caregiver`), `F` = `family_member` (and not-yet-activated `caregiver`), `R` = `remote_member`. "own" = the responsibility column equals `auth.uid()`.

| Table · op | admin | primary_caregiver | family_member | remote_member | Unassigned row |
| --- | --- | --- | --- | --- | --- |
| **care_tasks** SELECT | all | all | own (`assigned_to`=me **or** `completed_by`=me) | all *(read-only, Option A)* | M + R only |
| care_tasks INSERT | ✅ | ✅ | ⛔ | ⛔ | — |
| care_tasks UPDATE | any | any | own-assigned, **status-only** (trigger); **not unassigned** | ⛔ | M only |
| care_tasks DELETE | ✅ | ✅ | ⛔ | ⛔ | M only |
| **care_appointments** SELECT | all | all | own (`assigned_to`=me) | all *(A)* | M + R only |
| care_appointments INSERT/UPDATE/STATUS/DELETE | ✅ | ✅ | ⛔ (read-only) | ⛔ | M only |
| **medications** SELECT | all | all | **all (catalog/reference)** | all | shared catalog |
| medications INSERT/UPDATE/DELETE | ✅ | ✅ | ⛔ | ⛔ | M only |
| **medication_schedules** SELECT | all | all | **all (dose compute)** | all | shared |
| medication_schedules INSERT/UPDATE/DELETE | ✅ | ✅ | ⛔ | ⛔ | M only |
| **medication_logs** SELECT | all | all | own responsible-med logs *(recommended; or broad)* | all *(A)* | M (+ R) |
| medication_logs INSERT/UPDATE | any med | any med | **only meds where `responsible_user_id`=me** | ⛔ | M only (null-responsible med ⇒ M only) |
| medication_logs DELETE | ✅ | ✅ | ⛔ | ⛔ | M only |
| **family_visits** SELECT | all | all | own (`visitor_user_id`=me) | all *(A)* | M + R only |
| family_visits INSERT/UPDATE/DELETE | any | any | own-linked only (`visitor_user_id`=me) | ⛔ | M only |

**Remote SELECT decision (explicit, as requested):**
- **Option A — broad read-only (recommended for THIS pass).** Remote keeps full read access; zero mutation. Matches the shipped app (remote shows full read-only lists) → **zero UX regression**. Trade-off: remote also reads unassigned/all rows, so the strict "unassigned = manager-only" applies to the **doer (family)** boundary, with remote treated as an explicit separate read allowance.
- **Option B — summary/scoped read (deferred, product-gated).** Tighten remote to a summary RPC or scoped reads. This is an IA change (the Phase 2B reports already deferred "remote → summary-only") and would make remote see nothing operational without a new summary surface. **Not** done here.
- Implemented via a single helper `can_view_all_operational(circle_id)` that today returns true for `admin, primary_caregiver, remote_member`. **Switching to Option B later = remove `remote_member` from that one function** (plus build the summary surface).

---

## 5. Manual-only SQL proposal

> Apply **manually** in the Sanad Supabase Dashboard SQL editor, **after** running §7's inventory and confirming the live policies match §1. No data is modified. Every change is idempotent (`create or replace`, `drop policy if exists` + recreate). Policy **names are preserved** so rollback is symmetric. `(select auth.uid())` is used in predicates (evaluated once per query — Supabase RLS performance guidance).

### 5.0 Helper functions (additive — safe, no behavior change until policies use them)

```sql
-- The "sees every operational row" group: managers + (for now) remote read-only.
-- SINGLE SWITCH POINT for the remote decision: to move remote to summary-only
-- (Option B) later, drop 'remote_member' from this array.
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
-- Used to gate dose logging (and optionally dose-log reads) to managers-or-responsible.
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
```

### 5.1 care_tasks — scope SELECT + remove the unassigned collaborator allowance

```sql
-- SELECT: managers/remote see all; a doer sees only tasks assigned to them or
-- that they completed (own history). Replaces the broad is_circle_member SELECT.
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

-- UPDATE (collaborators): drop the `assigned_to is null` branch so doers may act
-- ONLY on tasks assigned to them. The status-only trigger is unchanged.
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
```

*(INSERT / manager-UPDATE / DELETE policies are already correct — left untouched. The `enforce_care_task_collaborator_scope` trigger is left untouched.)*

### 5.2 care_appointments — scope SELECT

```sql
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
```

*(INSERT/UPDATE/DELETE stay manager-only — appointments have no collaborator mutation path, matching the UI.)*

### 5.3 medications & medication_schedules — SELECT stays BROAD (justified)

**No change.** `medications` and `medication_schedules` SELECT remain `is_circle_member`. Reasons: the **"All medications" catalog is intentionally shared reference data** (Phase 2B product decision); today's-doses is computed client-side from these tables together; and `createMedicationWithSchedule` RETURNINGs the new medication. Scoping these would break the catalog, dose computation, and the create read-back. Responsibility is enforced on **dose logs** (§5.4). Medication catalog **writes** are already manager-only.

### 5.4 medication_logs — gate INSERT/UPDATE to managers-or-responsible (+ optional SELECT scope)

```sql
-- INSERT: managers may log any dose; a doer may log ONLY for meds they are
-- responsible for. Circle/medication/schedule integrity checks preserved.
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

-- UPDATE: same manager-or-responsible gate on both the existing row (USING) and
-- the post-update row (WITH CHECK).
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
```

**Optional (recommended for consistency) — scope dose-log READS for doers:**

```sql
-- Managers/remote read all logs; a doer reads only logs for meds they are
-- responsible for. (meds/schedules stay broad, so dose names/times still resolve.)
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
```

*(DELETE stays manager-only.)*

### 5.5 family_visits — scope SELECT

```sql
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
```

*(The own-record INSERT/UPDATE/DELETE policies already scope to `visitor_user_id = auth.uid()` and are left untouched.)*

### 5.6 Supporting tables — no change

`circle_members`, `care_circles` (writes already RPC-only), and `profiles` (own-row, names via `list_circle_members` RPC) are **not** touched. No new roles activated. No "أنا متكفل"/claim. No notifications.

---

## 6. Rollback SQL (restore the pre-2D state)

```sql
-- care_tasks SELECT → broad
drop policy if exists "Members can view care tasks" on public.care_tasks;
create policy "Members can view care tasks" on public.care_tasks
for select to authenticated using (public.is_circle_member(circle_id));

-- care_tasks collaborator UPDATE → restore the unassigned allowance
drop policy if exists "Members can update assigned care tasks" on public.care_tasks;
create policy "Members can update assigned care tasks" on public.care_tasks
for update to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver','family_member']::public.circle_role[])
  and (assigned_to is null or assigned_to = (select auth.uid()))
)
with check (
  public.has_circle_role(circle_id, array['caregiver','family_member']::public.circle_role[])
  and (assigned_to is null or assigned_to = (select auth.uid()))
);

-- care_appointments SELECT → broad
drop policy if exists "Members can view care appointments" on public.care_appointments;
create policy "Members can view care appointments" on public.care_appointments
for select to authenticated using (public.is_circle_member(circle_id));

-- family_visits SELECT → broad
drop policy if exists "Members can view family visits" on public.family_visits;
create policy "Members can view family visits" on public.family_visits
for select to authenticated using (public.is_circle_member(circle_id));

-- medication_logs SELECT → broad (only if §5.4-optional was applied)
drop policy if exists "Members can view medication logs" on public.medication_logs;
create policy "Members can view medication logs" on public.medication_logs
for select to authenticated using (public.is_circle_member(circle_id));

-- medication_logs INSERT/UPDATE → restore "any caregiving member" (pre-2D hardened form)
drop policy if exists "Caregivers can add medication logs" on public.medication_logs;
create policy "Caregivers can add medication logs" on public.medication_logs
for insert to authenticated
with check (
  public.has_circle_role(circle_id, array['admin','primary_caregiver','family_member','caregiver']::public.circle_role[])
  and public.is_circle_medication(circle_id, medication_id)
  and (schedule_id is null or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id))
);
drop policy if exists "Caregivers can update medication logs" on public.medication_logs;
create policy "Caregivers can update medication logs" on public.medication_logs
for update to authenticated
using (
  public.has_circle_role(circle_id, array['admin','primary_caregiver','family_member','caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin','primary_caregiver','family_member','caregiver']::public.circle_role[])
  and public.is_circle_medication(circle_id, medication_id)
  and (schedule_id is null or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id))
);

-- Optionally drop the new helpers (harmless to keep):
-- drop function if exists public.can_view_all_operational(uuid);
-- drop function if exists public.is_responsible_for_medication(uuid, uuid, uuid);
```

---

## 7. Verification SQL & manual QA

### 7.1 Inventory FIRST (run before applying anything)

```sql
-- Current policies on the operational tables (confirm they match §1 before editing).
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('care_tasks','care_appointments','medications',
                    'medication_schedules','medication_logs','family_visits')
order by tablename, cmd, policyname;

-- Confirm the two manually-added columns exist (the proposal assumes them).
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in
      (('care_appointments','assigned_to'), ('medications','responsible_user_id'));
```

### 7.2 After applying — confirm policies & helpers exist

```sql
-- New/edited policies are present with the expected predicates.
select tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and tablename in ('care_tasks','care_appointments','medication_logs','family_visits')
order by tablename, cmd, policyname;

-- Helper functions exist.
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('can_view_all_operational','is_responsible_for_medication');
```

### 7.3 Simulate RLS per role (optional, advanced — wrap in a rolled-back tx)

> The SQL editor runs as an owner that **bypasses RLS**. To test as a user, assume the `authenticated` role and set the JWT `sub`. **Always** wrap in `begin … rollback` so nothing persists.

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<FAMILY1_USER_UUID>","role":"authenticated"}';

-- Expect ONLY family1's assigned/completed tasks (3 + own history), NOT 11:
select count(*) from public.care_tasks where circle_id = '<CIRCLE_UUID>';
-- Expect ONLY family1's assigned appointments:
select count(*) from public.care_appointments where circle_id = '<CIRCLE_UUID>';
-- Expect ONLY family1's linked visits:
select count(*) from public.family_visits where circle_id = '<CIRCLE_UUID>';
rollback;
```

### 7.4 Manual app QA with the existing `[QA]` seed users

Circle `رعاية الوالد الغالي`; users from the seed report (admin `ibrahim.khalifeh91@gmail.com`, primary `sanad.qa.primary1`, family1 `sanad.qa.family1`, family2 `sanad.qa.family2`, remote `sanad.qa.remote1`).

1. **family1** — tasks/appointments/visits lists show only their own items; dose register works only for their responsible meds; **direct deep-link** to a family2 task/appointment/visit detail now returns empty (server-enforced, not just hidden).
2. **family1 cannot log a non-responsible dose** — attempting to register a dose for a med responsible to family2 fails server-side (previously the UI hid it but the API allowed it).
3. **family1 cannot act on an unassigned task** — completing an unassigned `[QA]` task fails server-side.
4. **family2** — symmetric to family1; sees none of family1's items.
5. **admin / primary** — see all `[QA]` tasks/appointments/doses/visits incl. unassigned; can edit/complete items assigned to others; can log any dose. The **"All medications" catalog tab still lists every med** for all roles.
6. **remote** — read-only lists still populate (Option A); every mutation (task status, dose register, visit/appointment status) is rejected; verify remote is never an assignee/responsible/visitor.
7. **Regression sweep** — manager create medication (RETURNING read-back) still works; create task/appointment/visit; family completes own task; family records own visit; dose status still computes (names/times resolve) for everyone.

---

## 8. Known risks / things to review before running

1. **Live vs. repo drift (highest priority).** `care_appointments.assigned_to` and `medications.responsible_user_id` were applied **manually**; the live SELECT policies may already differ from §1. **Run §7.1 first** and reconcile before applying — the `drop policy if exists` + recreate is safe, but only correct if the names match (otherwise an old broad policy could survive under a different name and keep OR-ing in full access).
2. **Multiple permissive SELECT policies are OR-ed.** If any *other* SELECT policy exists on these tables (e.g., a manually-added one), tightening the named one does **not** restrict access. Verify each table has exactly the expected SELECT policy set.
3. **Remote read scope is a product decision (Option A vs B).** Shipping Option A means remote can still read unassigned/all rows. Get explicit product sign-off; the switch point is one helper.
4. **`medications`/`medication_schedules` SELECT intentionally stay broad.** This is a deliberate exception (catalog + dose compute + RETURNING). If product later wants the catalog itself scoped, that is a separate change requiring a dose-compute redesign (e.g., a SECURITY DEFINER "today's doses" RPC) — do **not** scope these tables casually or the dose UI and medication creation will break.
5. **Dose-log SELECT scoping (§5.4-optional)** adds an indexed subquery to the hot `fetchLogsForDate` query. Low cost (PK lookup on `medications`), but validate on real data volumes; it is separable from the mandatory INSERT/UPDATE gate.
6. **`caregiver` role** appears in the doer arrays but is not activated — harmless (no such members exist). Do not activate it here.
7. **No claim / notifications / new roles** — explicitly out of scope; the proposal does not add an "أنا متكفل" path, so unassigned items remain manager-only with no doer self-claim.
8. **Apply in a low-traffic window** and keep the §6 rollback ready; re-run §7.4 QA immediately after.

---

## 9. Confirmation

- **No SQL was run**; **no Supabase connection** was made; **no Supabase CLI** used; **no migration applied**.
- **No app source code changed** — the only filesystem write is this markdown report under `docs/claude-reports/`.
- **No `.env` / secrets** read or modified; **no** dependency, Expo-config, native, or backend-function change; **no EAS**, **no prebuild**.
- Stayed inside `E:\Projects\sanad-mobile`; no other project touched.
- **Not committed, not staged.**

---

## 10. Git status & diff

The prior Phase 2B working-tree edits and earlier reports are now committed (baseline `54e27f9`), so the **only** change in the working tree is this new untracked report. Nothing staged, nothing committed by this task.

`git --no-pager status --short`:

```
?? docs/claude-reports/2026-06-26-phase-2d-rls-hardening-audit.md
```

`git --no-pager diff --stat`:

```
(no output — no tracked files modified; the only change is the untracked report above)
```
