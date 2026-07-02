# Phase 2E-1 — "أنا متكفّل" / Available-to-Claim: product + RLS/RPC audit and manual SQL proposal

**Baseline:** `87e5a8c docs(product): verify responsibility-based RLS hardening` (working tree clean).
**Status of this document:** audit + **proposal only**. **No SQL was run**, no Supabase connection made, no Supabase CLI used, no app code changed except adding this report. Nothing committed or staged.

> ⚠️ The Phase 2D responsibility-based RLS hardening was **applied manually** in the Sanad Supabase Dashboard and is documented (verbatim) in `docs/claude-reports/2026-06-26-phase-2d-rls-hardening-audit.md` + `…-applied-verification.md`. Two responsibility columns (`care_appointments.assigned_to`, `medications.responsible_user_id`) and all Phase 2D policies/helpers live in the **DB only**, not in committed migrations. **Run §8.1 inventory first** and reconcile before applying any SQL here.

---

## 0. Method & sources inspected

- **Migrations (repo):** `initial_core_schema`, `create_care_circle_rpc`, `create_care_tasks`, `create_care_appointments`, `create_family_visits`, `create_medications`, `create_medication_schedules`, `create_medication_logs`, `harden_step_3_rls_membership_checks`, `harden_medication_rls_ownership_checks`, `create_membership_invitation_rpcs`, `lock_down_membership_and_ownership`, `add_care_circle_timezone`.
- **Generated types:** `src/types/supabase.ts` — confirms live-only columns (`care_appointments.assigned_to`, `medications.responsible_user_id`) and the exact enums; the `Functions` block defines **none** of the six proposed names (`list_available_to_claim`, `claim_care_task`, `claim_medication_responsibility`, `claim_care_appointment`, `claim_family_visit`, `set_assigned_appointment_outcome`) — no collisions. (An unrelated `claim_push_deliveries` service_role-only notification function exists — different name, not touched.)
- **App API (client is direct-table + RPC; no server writes on core tables):** `src/features/{tasks,appointments,medications,visits}/api.ts`.
- **Current applied policy state (authoritative):** the two Phase 2D reports above + `2026-06-26-phase-2b-strict-operational-scoping.md`.
- **QA fixtures:** `2026-06-26-qa-seed-operational-data-sql.md` (the `[QA]` seed already includes **unassigned/unlinked** rows — perfect claim fixtures).

**Role model (verbatim from the schema + Phase 2D):**

| Role | Class | Can manage | Can log doses | **Can claim (this phase)** |
| --- | --- | --- | --- | --- |
| `admin` | manager (sees all) | ✅ | ✅ | ✅ |
| `primary_caregiver` | manager (sees all) | ✅ | ✅ | ✅ |
| `family_member` | doer (scoped to self) | ❌ | ✅ | ✅ |
| `caregiver` *(defined, not activated)* | doer-like | ❌ | ✅ | ✅ *(policy only; not in UI)* |
| `remote_member` | read-only | ❌ | ❌ | ⛔ |
| `elder` *(defined, not activated)* | read-only | ❌ | ❌ | ⛔ |

Managers = `{admin, primary_caregiver}`. **Claim-capable = `{admin, primary_caregiver, family_member, caregiver}`.** Membership table is **`public.circle_members`** (`role` = `role`, active = `status = 'active'`). Enums: `public.circle_role`, `public.care_task_status` (`open/completed/cancelled`), `public.care_appointment_status` (`scheduled/completed/cancelled`), `public.family_visit_status` (`planned/completed/cancelled`), `public.medication_log_status` (`given/missed/postponed`).

---

## 1. Product workflow summary

**"متاح للتكفّل" (Available to claim)** is a dedicated discovery surface where a claim-capable member sees circle items that currently have **no owner**, and can press **"أنا متكفّل" (I'll take responsibility)** to immediately become that item's owner. The **core rule** for this phase: *every item assigned to / responsible to / linked to / claimed by a person lets that same person update its operational **outcome/status** — never its sensitive details.*

What "أنا متكفّل" means per entity (claim → later outcome):

| Entity | Claim = becomes | Then may set (outcome) | Never may (manager-only) |
| --- | --- | --- | --- |
| **Task** (`care_tasks`) | `assigned_to` | `completed` / تم الإنجاز, `cancelled` (تعذّر الإنجاز) | edit title/desc/category/priority/date, reassign, delete |
| **Medication** (`medications`) | `responsible_user_id` | log doses `given`/`missed`/`postponed` (أُعطيت/لم تُعطَ/مؤجلة) | edit name/dosage/schedule/instructions, deactivate, delete |
| **Appointment** (`care_appointments`) | `assigned_to` | `completed` / تم الموعد, `cancelled` (تعذّر الموعد) | edit date/time/doctor/location/type, delete |
| **Visit** (`family_visits`) | `visitor_user_id` | `completed` / تمت الزيارة, `cancelled` (تعذّرت الزيارة) | edit date/time/notes/name, relink, delete |

**Why claiming is immediate (no approval queue):** the product goal is to get unowned care work picked up fast. Claiming only **fills a currently-null responsibility column** — it grants outcome/status rights, not edit rights — so it is low-risk and reversible (a manager can reassign at any time). No manager-approval step is introduced this phase. **Race rule:** if two members claim the same item simultaneously, **exactly one wins** (single atomic `UPDATE … WHERE col IS NULL … RETURNING`); the loser gets a safe error → `تم التكفّل بهذا العنصر من شخص آخر` / *Someone else already claimed this item*.

**What stays manager-only:** creating items, editing item **details**, reassigning/relinking to another person, deleting, and (proposed) deleting visits. `remote_member`/`elder` cannot claim or act. Managers keep full reach via the existing manager UI (assign/reassign/edit/delete).

**Explicitly out of scope (not implemented here):** notifications/escalation/WhatsApp, manager-approval queue, new roles, reassignment workflow, claiming already-owned items, family editing medication schedules or appointment details, and any **UI** or **SQL execution**. (A future manager notification "someone claimed X" is noted in §12.)

---

## 2. Current schema & policy findings relevant to claim / outcome

### 2.1 Responsibility columns & eligibility fields

| Entity | Responsibility col | "Unowned" predicate | Eligible-status predicate |
| --- | --- | --- | --- |
| `care_tasks` | `assigned_to uuid → profiles(id)` | `assigned_to is null` | `status = 'open'` |
| `medications` | `responsible_user_id uuid → profiles(id)` *(live-only)* | `responsible_user_id is null` | `is_active = true` |
| `care_appointments` | `assigned_to uuid → profiles(id)` *(live-only)* | `assigned_to is null` | `status = 'scheduled'` |
| `family_visits` | `visitor_user_id uuid → profiles(id)` | `visitor_user_id is null` | `status = 'planned'` |

### 2.2 Current SELECT visibility (post-2D) — **why discovery needs an RPC**

- `care_tasks`: `can_view_all_operational(circle_id)` **OR** (`is_circle_member` AND (`assigned_to = auth.uid()` OR `completed_by = auth.uid()`)).
- `care_appointments`: `can_view_all_operational` **OR** (`is_circle_member` AND `assigned_to = auth.uid()`).
- `family_visits`: `can_view_all_operational` **OR** (`is_circle_member` AND `visitor_user_id = auth.uid()`).
- `medication_logs`: `can_view_all_operational` **OR** (`is_circle_member` AND `is_responsible_for_medication(...)`).
- `medications` / `medication_schedules`: **broad** (`is_circle_member`) — intentional shared catalog.
- `can_view_all_operational(circle_id)` returns true for `{admin, primary_caregiver, remote_member}`.

⇒ For a `family_member`, **`null = auth.uid()` is never true**, so unassigned tasks / appointments / visits are **invisible** through normal table SELECT. The app therefore **cannot** list claimable tasks/appointments/visits directly — discovery must be a **SECURITY DEFINER RPC**. (Unassigned medications remain visible via the broad catalog, but medication **claiming still needs an RPC** because `medications` UPDATE is manager-only — see §2.3. A unified feed also keeps the four surfaces consistent.)

### 2.3 Current write/outcome paths — the four starting points differ

| Entity | Claim reachable by direct write? | Outcome reachable by assigned doer today? | Conclusion |
| --- | --- | --- | --- |
| **Task** | ❌ collaborator UPDATE requires `assigned_to = auth.uid()`; unassigned → blocked. | ✅ once assigned: collaborator UPDATE policy `has_circle_role([caregiver,family_member]) AND assigned_to = auth.uid()` + trigger `enforce_care_task_collaborator_scope` (open→completed/cancelled, content frozen). | **Claim RPC** needed; outcome already works. |
| **Medication dose** | ❌ `medications` UPDATE is manager-only. | ✅ once responsible: `medication_logs` INSERT/UPDATE = manager **OR** (doer AND `is_responsible_for_medication`). | **Claim RPC** needed; dose logging already works. |
| **Appointment** | ❌ UPDATE is manager-only; no `assigned_to` referenced. | ❌ **no collaborator UPDATE policy and no trigger** — assigned doer is fully blocked. | **Claim RPC + outcome RPC** needed. |
| **Visit** | ❌ own-UPDATE requires `visitor_user_id = auth.uid()`; unlinked → blocked. | ⚠️ once linked: own-UPDATE policy `has_circle_role([caregiver,family_member]) AND visitor_user_id = auth.uid()` allows status — **but is field-unrestricted (over-broad)** and there is **no** trigger. | **Claim RPC + status-only trigger** (tighten); delete tightening recommended. |

### 2.4 The two trigger conflicts the claim must solve

Both `care_tasks` and (proposed) `family_visits` have `BEFORE UPDATE` collaborator-scope triggers that **restrict non-managers to status-only changes**. A claim sets the responsibility column while `status` stays `open`/`planned` — which those triggers would reject (`"collaborators may only complete or cancel …"` and the content-immutability check on `assigned_to`/`visitor_user_id`). The claim RPCs must therefore be **exempted** from these triggers. See §6.3 for the transaction-local bypass and its safety proof. *(Appointments/medications have no such trigger — their claims need no bypass.)*

### 2.5 The over-broad visit own-UPDATE (confirmed gap)

`"Members can update their own family visits"`: USING **and** WITH CHECK = `has_circle_role([caregiver,family_member]) AND visitor_user_id = auth.uid()`. WITH CHECK constrains only role + that the row stays linked to the caller — **it does not restrict which columns change**. A linked visitor can freely edit `visitor_name`, `visit_date`, `start_time`, `end_time`, `notes`, `status` (no state machine), and `created_by`. Relink is blocked (WITH CHECK pins `visitor_user_id = auth.uid()`), but **field-level content editing is not**. RLS cannot express column immutability; a `BEFORE UPDATE` trigger (or an RPC) is required — §6.3/§6.5. Also: `"Members can delete their own family visits"` means that after a claim (`visitor_user_id = me`) a doer could **delete a manager-created visit** — an escalation the claim newly exposes (§6.6).

---

## 3. Available-to-claim discovery design

### 3.1 Unified feed vs separate functions — **recommend one unified feed**

A single `list_available_to_claim(p_circle_id uuid)` returning a normalized union of the four entity types is recommended:

- One authorization site (auth + active-member + claim-capable role) instead of four.
- One network round-trip; the app renders one list with per-type cards.
- Same privacy posture everywhere (only safe display fields).

Separate per-entity functions would only be preferable if each needed very different filters/pagination or if one entity's projection had materially different privacy needs — not the case here (all four are "unowned + eligible-status, safe display fields only"). If later needed (e.g. large circles + pagination), the unified feed can be split without changing the claim RPCs. **Decision: unified feed.**

### 3.2 Proposed return shape

```
item_type    text          -- 'task' | 'medication' | 'appointment' | 'visit'
item_id      uuid
circle_id    uuid
title        text          -- task.title | medication.name | appointment.title | visit.visitor_name
subtitle     text NULL     -- medication.dosage | appointment.location | (task/visit: NULL)
category     text NULL     -- task.category | medication.form | appointment.appointment_type
priority     text NULL     -- task.priority (else NULL)
scheduled_at timestamptz NULL  -- appointment.starts_at (else NULL)
date_value   date NULL     -- task.due_date | visit.visit_date
time_value   time NULL     -- task.due_time | visit.start_time
status       text          -- 'open' | 'active' | 'scheduled' | 'planned'
created_at   timestamptz
```

### 3.3 Privacy considerations

- **Only safe display fields.** Deliberately **excluded:** task `description`/`notes`, medication `instructions`, appointment `notes`/`doctor_id`, visit `notes`, and every author/audit column. Medication `name`/`dosage`/`form` are already broadly readable (shared catalog) so surfacing them leaks nothing new.
- **`appointment_type` + `location` are surfaced** so a member can decide whether to take an appointment. These are the only mild-sensitivity fields; if product prefers, drop `location` (→ `subtitle = NULL`) with a one-line edit. Flagged in §11.
- The function is `SECURITY DEFINER` and **hard-filters to unowned + eligible-status rows in the caller's circle** after verifying the caller is an active, claim-capable member — it never returns owned rows, other circles, or rows to `remote_member`/`elder`.

---

## 4. Claim RPC design

### 4.1 Shape (all four)

Each `claim_*` RPC is `SECURITY DEFINER`, `set search_path = ''`, everything schema-qualified, `revoke all … from public; grant execute … to authenticated` — matching the existing membership RPCs. Flow:

1. `auth.uid()` present, else `28000`.
2. Resolve the row's `circle_id` (definer read), else `P0002` not found.
3. `v_role := public.active_circle_member_role(circle_id)`; `is null` ⇒ `42501` not a member; `not in ('admin','primary_caregiver','family_member','caregiver')` ⇒ `42501` (excludes `remote_member`/`elder`). *(The `is null` guard is mandatory: `NULL not in (…)` is `NULL`, not true.)*
4. **Atomic claim** — single `UPDATE … SET <col> = auth.uid() WHERE id = p_id AND <col> IS NULL AND <eligible-status> RETURNING * INTO v_row`.
5. If a row was updated → return it. Else **re-read** to disambiguate the reason and raise.

### 4.2 Eligibility rules

| RPC | Sets | Claim WHERE |
| --- | --- | --- |
| `claim_care_task(p_task_id)` | `assigned_to` | `assigned_to is null AND status = 'open'` |
| `claim_medication_responsibility(p_medication_id)` | `responsible_user_id` | `responsible_user_id is null AND is_active = true` |
| `claim_care_appointment(p_appointment_id)` | `assigned_to` | `assigned_to is null AND status = 'scheduled'` |
| `claim_family_visit(p_visit_id)` | `visitor_user_id` | `visitor_user_id is null AND status = 'planned'` |

### 4.3 Race-safety strategy

The **only** mutation is the single atomic `UPDATE … WHERE <col> IS NULL …`. Postgres row-locks the target; of N concurrent claimers, exactly one sees `<col> IS NULL` and writes — the rest match 0 rows (`FOUND = false`). No `SELECT … FOR UPDATE` + re-check needed; the conditional `UPDATE` is the lock. The pre-read of `circle_id`/role is only for authorization and cannot affect who wins. The post-failure re-read is only to choose the error message and is allowed to be racy (a benign mislabel between "already claimed" and "not available" in a rare interleaving does not affect correctness).

### 4.4 Allowed roles

Claim-capable set enforced in step 3: `admin`, `primary_caregiver`, `family_member`, `caregiver`. `remote_member` and `elder` → `42501`. Managers are intentionally included (a manager may also claim from the feed; they normally assign from the manager UI). `caregiver` is accepted by the policy but is not surfaced in the UI (not activated) — consistent with every other Sanad policy array.

### 4.5 Error behavior (stable contract for the app)

| Condition | SQLSTATE | Message (stable) | App mapping |
| --- | --- | --- | --- |
| Not authenticated | `28000` | `authentication required` | generic auth error / re-login |
| Not an active member | `42501` | `not an active member of this circle` | generic "not allowed" |
| Role can't claim (`remote`/`elder`) | `42501` | `your role is not allowed to claim items` | hide CTA / "not allowed" |
| Item id missing | `P0002` | `item not found` | refresh feed |
| **Lost the race (owned by someone)** | `23505` | `someone else already claimed this item` | **`تم التكفّل بهذا العنصر من شخص آخر`** → refresh |
| Ineligible (wrong status / inactive) | `22023` | `this item is not available to claim` | refresh feed |

`supabase-js` surfaces `error.code` (the SQLSTATE) and `error.message`, so the app branches on `code === '23505'` for the "someone else" copy and falls back to a generic claim-failed message otherwise. (PostgREST also maps `23505 → HTTP 409`, `42501 → 403`, `P0002 → 404`.) On success the RPC returns the **updated row**, which the app uses to move the item into "my" lists without a refetch. A repeat claim by the **same** caller (double-tap) is **idempotent** — it returns the already-owned row, not a `23505` — so a fast double-press never shows the "someone else" error to the actual owner.

---

## 5. Outcome / status design

| Owner | Mechanism | Allowed transition | Detail edits |
| --- | --- | --- | --- |
| **Assigned task owner** | **Existing** collaborator UPDATE policy + `enforce_care_task_collaborator_scope` trigger (unchanged behavior). App calls `completeTask`/`cancelTask` (direct `.update`). | `open → completed` / `open → cancelled`, timestamps enforced. | Blocked by trigger. |
| **Responsible medication owner** | **Existing** `medication_logs` INSERT/UPDATE = manager OR (doer AND `is_responsible_for_medication`). App calls `insertLog`/`updateLogStatus`. | dose `given` / `missed` / `postponed`. | Catalog/schedule edits blocked (manager-only). |
| **Assigned appointment owner** | **New** `set_assigned_appointment_outcome(p_appointment_id, p_status)` RPC (managers-or-assignee). App switches `setAppointmentStatus` to this RPC. | `scheduled → completed` / `scheduled → cancelled` only. | Blocked (RPC writes only `status`). |
| **Linked visit owner** | **New** `enforce_family_visit_collaborator_scope` trigger tightens the existing own-UPDATE to status-only. App keeps `setVisitStatus` (direct `.update({status})`). | `planned → completed` / `planned → cancelled` only. | **Now** blocked by trigger (was over-broad). |

Notes: **"unable/تعذّر"** maps to the existing `cancelled` value for both appointments and tasks — **no new enum value** is added (see §11). Marking an appointment `completed`/`cancelled` also auto-suppresses its pending `appointment_upcoming` reminder via the existing `notification_source_validity()` (`status <> 'scheduled'`), which is the desired side-effect. Detail editing stays **manager-only** across all four entities.

---

## 6. Manual-only SQL proposal

> Apply **manually** in the Sanad Supabase Dashboard SQL editor **after** §8.1 inventory, and apply the whole §6 set as **one batch** — in particular the visit claim (§6.2), its collaborator trigger (§6.3b), and the DELETE tightening (§6.6) must land **together** (never the visit claim alone). **No data rows are modified** — every statement is a function/policy/trigger definition. All idempotent (`create or replace`, `drop … if exists` + recreate). Follows the house convention: `security definer`, `set search_path = ''`, schema-qualified refs, `auth.uid()` guard, `revoke all … from public; grant execute … to authenticated`.

### 6.0 Precondition (must already be true — verify in §8.1)

`care_appointments.assigned_to` and `medications.responsible_user_id` exist in the live DB (added manually pre-2D; present in `src/types/supabase.ts`). The claim/outcome SQL below **depends** on them, **and on the full Phase 2D hardening (policies + `enforce_care_task_collaborator_scope` trigger) already being live** — apply Phase 2D first if not (§11.1). Do **not** add columns here and do **not** apply on a pre-2D schema — if the columns or 2D policies are missing, stop and reconcile the live-vs-repo drift first.

### 6.1 Discovery RPC — `list_available_to_claim`

```sql
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
```

### 6.2 Claim RPCs

```sql
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

  -- Exempt this claim from enforce_care_task_collaborator_scope (see §6.3).
  -- Reset to 'off' immediately after the guarded UPDATE so the bypass covers
  -- ONLY that one statement (confines it even inside a longer transaction).
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

  -- Exempt this claim from enforce_family_visit_collaborator_scope (see §6.3).
  -- Reset to 'off' immediately after the guarded UPDATE (confines the bypass).
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
```

### 6.3 Trigger changes (claim bypass + visit status-only tightening)

**Bypass mechanism & safety.** The claim RPCs set a **transaction-local** GUC `sanad.in_claim = 'on'` (`set_config(..., is_local => true)`) immediately before their single guarded `UPDATE`. Both collaborator-scope triggers honor it as an early `return new`. This is safe because:

1. A PostgREST/`supabase-js` client **cannot** set a GUC — it can only invoke functions we expose; the only functions that set `sanad.in_claim` are the claim RPCs, which then run **only** the tightly-scoped claim `UPDATE` (`WHERE <col> IS NULL AND <eligible-status>`, `SET <col> = auth.uid()`).
2. `is_local => true` scopes the flag to the **current transaction**; PostgREST runs each request in its own transaction. **Additionally, each claim RPC resets `sanad.in_claim` to `'off'` immediately after its guarded UPDATE** (§6.2), so the bypass covers exactly one statement even inside a longer transaction or a future nested-definer caller.
3. Independently, post-2D RLS already blocks a non-manager from updating an unowned row directly, so the only writer that can reach these triggers with an unowned row is the definer claim RPC.

```sql
-- 6.3a  care_tasks: add the claim bypass to the EXISTING trigger function.
--       ONLY the first guarded block is new; the rest is the verified Phase-2D body,
--       reproduced verbatim so the drop/recreate is behavior-preserving.
create or replace function public.enforce_care_task_collaborator_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- NEW: exempt the SECURITY DEFINER claim RPC (claim_care_task). tx-local flag;
  -- unreachable by direct client UPDATE. See §6.3 safety note.
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

-- 6.3b  family_visits: NEW status-only collaborator trigger (mirrors care_tasks),
--       closing the over-broad own-UPDATE (§2.5) and honoring the claim bypass.
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
```

### 6.4 Appointment outcome RPC — `set_assigned_appointment_outcome`

```sql
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
```

### 6.5 Visit outcome — **no RPC required** (trigger + existing policy)

After §6.3b, a linked visitor's `setVisitStatus(id, 'completed'|'cancelled')` (direct `.update({status})`) is authorized by the existing `"Members can update their own family visits"` policy (`visitor_user_id = auth.uid()`) and constrained to status-only by the new trigger. Unlike appointments (which had **no** collaborator UPDATE policy), visits already have one — so tightening it is sufficient and needs the least app change. *Optional symmetry:* if product prefers a uniform RPC surface, a `set_linked_visit_outcome(p_visit_id, p_status)` mirroring §6.4 (manager-or-linked-visitor; `planned → completed/cancelled`) can be added later; it is **not** needed for correctness.

### 6.6 REQUIRED tightening — visit DELETE (close the claim→delete escalation)

⚠️ **Mandatory — apply in the same batch as `claim_family_visit` + §6.3b; never ship the visit claim without it.** Because a claim sets `visitor_user_id = me`, the surviving own-DELETE policy `"Members can delete their own family visits"` would then let a claimer **delete a manager-authored visit** — a self-service privilege escalation that does **not** exist today (an unlinked visit fails `visitor_user_id = auth.uid()`, so no doer can delete it). The claim feature newly exposes it, so this fix is part of the claim, not an option. Tasks/appointments have **no** collaborator delete; align visits:

```sql
-- Make family_visits DELETE manager-only (mirrors care_tasks / care_appointments).
drop policy if exists "Members can delete their own family visits" on public.family_visits;
-- "Managers can delete family visits" (managers) remains and is sufficient.
```

This is a **reversible policy change, not a destructive data change** — the spec's "no destructive changes" means no data/table/column loss; the policy is restored verbatim in §7 rollback. Trade-off: a family member can no longer **delete** a visit they created — they **cancel** it (status → `cancelled`), the intended operational outcome. Preserving self-delete while `claim_family_visit` exists would leave the escalation open — **not acceptable**. Flagged in §11.

### 6.7 Grants

Every function above ends with `revoke all … from public; grant execute … to authenticated`. **No table privileges change.** In particular, `authenticated` **must retain its existing (RLS- and trigger-gated) direct DML** on `care_tasks` (`completeTask`/`cancelTask`), `family_visits` (`setVisitStatus`), and `medication_logs` (`insertLog`/`updateLogStatus`) — those outcome paths stay **direct-table** writes; only the four claim writes and the appointment status flip move into `SECURITY DEFINER` RPCs. Do **not** revoke those grants (that would break the collaborator outcome paths). The claim/outcome RPCs need no new direct `UPDATE`/`INSERT` grant because their writes execute inside the definer functions.

---

## 7. Rollback SQL

```sql
-- Drop the new claim/discovery/outcome functions.
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

-- Restore the own-visit DELETE policy (only if §6.6 was applied).
drop policy if exists "Members can delete their own family visits" on public.family_visits;
create policy "Members can delete their own family visits"
on public.family_visits
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver','family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
);
```

No data is touched by apply or rollback; the `sanad.in_claim` GUC is transaction-local and needs no cleanup.

---

## 8. Verification SQL

> Resolve real UUIDs from the `[QA]` seed (circle `رعاية الوالد الغالي`; users `ibrahim.khalifeh91@gmail.com` = admin, `sanad.qa.primary1@…`, `…family1@…`, `…family2@…`, `…remote1@…`, password `123456`). The seed already contains the claim fixtures: **3 unassigned open tasks, 1 unassigned scheduled appointment, 1 active med with no responsible person (فيتامين د), 1 planned unlinked visit** ⇒ `list_available_to_claim` should return **6** rows (3 task + 1 appointment + 1 medication + 1 visit).

### 8.1 Inventory FIRST (run before applying anything)

```sql
-- Confirm the live responsibility columns exist (proposal depends on them).
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in
      (('care_appointments','assigned_to'), ('medications','responsible_user_id'));

-- Confirm no claim RPC already exists, and the current operational policies match §2.
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('list_available_to_claim','claim_care_task','claim_medication_responsibility',
                  'claim_care_appointment','claim_family_visit','set_assigned_appointment_outcome');

select tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname='public'
  and tablename in ('care_tasks','care_appointments','medications','medication_logs','family_visits')
order by tablename, cmd, policyname;
```

### 8.2 After applying — functions & trigger exist

```sql
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc where pronamespace='public'::regnamespace
  and proname in ('list_available_to_claim','claim_care_task','claim_medication_responsibility',
                  'claim_care_appointment','claim_family_visit','set_assigned_appointment_outcome',
                  'enforce_family_visit_collaborator_scope');

select tgname, tgrelid::regclass from pg_trigger
where tgname in ('family_visits_collaborator_scope','care_tasks_collaborator_scope');
```

### 8.3 Simulate family1's feed (expect 6: task 3 / appointment 1 / medication 1 / visit 1)

```sql
-- Resolve ids once (copy them into the blocks below).
select cc.id as circle_id from public.care_circles cc where cc.name='رعاية الوالد الغالي' order by cc.created_at limit 1;
select p.id from public.profiles p join auth.users u on u.id=p.id where lower(u.email)='sanad.qa.family1@example.com';

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<FAMILY1_UUID>","role":"authenticated"}';

  -- Whole feed and per-type counts:
  select item_type, count(*) from public.list_available_to_claim('<CIRCLE_UUID>') group by 1 order by 1;
  -- Expect: appointment 1, medication 1, task 3, visit 1  (total 6)
rollback;
```

### 8.4 Successful claim, then loser fails (race), all wrapped & rolled back

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<FAMILY1_UUID>","role":"authenticated"}';

  -- Pick one unassigned task id from the feed above, then:
  select id, assigned_to, status from public.claim_care_task('<UNASSIGNED_TASK_ID>');
  -- Expect: row returned with assigned_to = FAMILY1, status still 'open'.

  -- Now switch to family2 and try to claim the SAME task:
  set local request.jwt.claims = '{"sub":"<FAMILY2_UUID>","role":"authenticated"}';
  do $$ begin
    perform public.claim_care_task('<UNASSIGNED_TASK_ID>');
    raise notice 'UNEXPECTED: second claim succeeded';
  exception when others then
    raise notice 'expected loser error: SQLSTATE=% MESSAGE=%', SQLSTATE, SQLERRM;
    -- Expect SQLSTATE 23505, message 'someone else already claimed this item'
  end $$;
rollback;
```

### 8.5 Assigned owner can set an outcome (appointment + visit)

> The claim RPCs reset `sanad.in_claim` to `'off'` right after their own guarded UPDATE (§6.2), so the DIRECT updates below run with the collaborator-scope **trigger active** — this exercises the real outcome path, not the bypass. The detail-edit negative test runs **while the visit is still `planned`**, so the content-freeze branch (not the status-gate branch) is what fires.

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<FAMILY1_UUID>","role":"authenticated"}';

  -- Appointment: claim, then complete via the outcome RPC.
  select id from public.claim_care_appointment('<UNASSIGNED_APPT_ID>');
  select id, status from public.set_assigned_appointment_outcome('<UNASSIGNED_APPT_ID>', 'completed');
  -- Expect: status 'completed'.

  -- Visit: claim (row stays 'planned'), then confirm DETAIL edits are blocked by the trigger:
  select id from public.claim_family_visit('<UNLINKED_VISIT_ID>');
  do $$ begin
    update public.family_visits set notes = 'hijack', visit_date = current_date + 5
      where id = '<UNLINKED_VISIT_ID>';
    raise notice 'UNEXPECTED: detail edit was allowed';
  exception when others then
    raise notice 'expected block: %', SQLERRM;  -- collaborators may not change a visit's details
  end $$;

  -- Status-only cancel succeeds (planned -> cancelled), trigger active:
  update public.family_visits set status = 'cancelled' where id = '<UNLINKED_VISIT_ID>';
  -- Expect: 1 row.
rollback;
```

### 8.6 Remote cannot claim or view the feed

```sql
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

> The SQL editor runs as a role that **bypasses RLS by default**; `set local role authenticated` drops to a role for which **RLS applies**, and `request.jwt.claims.sub` makes `auth.uid()` resolve to the simulated user so `active_circle_member_role`/`has_circle_role` evaluate that member. Always wrap in `begin … rollback` so nothing persists. If you claimed rows outside a transaction during manual testing, re-run the `[QA]` seed to reset ownership.

---

## 9. Required app QA plan (after SQL is applied)

Using the `[QA]` seed users/circle:

1. **family1 — discovery:** the "متاح للتكفّل" feed lists exactly the 6 unowned items (3 tasks, 1 appointment, 1 med فيتامين د, 1 visit). None of family2's/primary1's owned items appear.
2. **family1 — claim task:** press "أنا متكفّل" on an unassigned task → it disappears from the feed and appears in **my tasks** as assigned to family1 (status open); family1 can then mark **تم الإنجاز/تعذّر الإنجاز** (existing complete/cancel).
3. **family1 — claim medication:** claim فيتامين د → it appears in family1's **today's doses**; register **أُعطيت/لم تُعطَ/مؤجلة** works; family1 still **cannot** edit the medication's name/dosage/schedule.
4. **family1 — claim appointment:** claim the unassigned appointment → appears in **my appointments**; **تم الموعد/تعذّر الموعد** works via the new RPC; family1 cannot edit date/doctor/location.
5. **family1 — claim visit:** claim the unlinked visit → appears in **my visits**; **تمت الزيارة/تعذّرت الزيارة** works; attempting to edit visit details is rejected; the delete affordance is gone (manager-only).
6. **Race:** on two devices (family1 + family2), claim the same item near-simultaneously → one succeeds, the other shows `تم التكفّل بهذا العنصر من شخص آخر` and the item refreshes out of its feed.
7. **remote1:** the "متاح للتكفّل" surface is **not** offered (or the CTA is hidden); any forced call is rejected. remote is never an owner.
8. **Manager (admin/primary):** unassigned items still visible in manager UI; managers can assign/reassign/edit/delete as before; a manager may also use the feed to claim. Reassigning a claimed item to someone else still works.
9. **Regression:** existing scoped lists (Phase 2D) unchanged; dose names/times still resolve; `list_circle_members` name display unaffected; manager create-medication (RETURNING read-back) still works.

---

## 10. UI implementation plan (next phase — **do not implement now**)

- **`متاح للتكفّل` feed screen:** new surface (entry point on Home and/or each center's header) that calls `list_available_to_claim(circleId)` and renders grouped sections (Tasks / Medications / Appointments / Visits). Gate visibility to claim-capable roles via the existing `permissions.ts` (`canManage || canCollaborate`); hide entirely for `remote_member`/`elder`.
- **Per-type item cards:** map the normalized row → existing card visuals (task card, dose card, appointment card, visit card) using `title/subtitle/category/priority/scheduled_at/date_value/time_value/status`. Reuse the icon/glyph system (per the Sanad UI/UX skill) — Arabic-first RTL, older-adult sizing.
- **`أنا متكفّل` CTA:** primary button on each card → calls the matching `claim_*` RPC; optimistic remove-from-feed with rollback on error.
- **Success/error states:** success → toast + move the item into the member's "my" list from the returned row (no refetch). Error → map `error.code`: `23505` → `تم التكفّل بهذا العنصر من شخص آخر`; else generic `تعذّر التكفّل، حاول مرة أخرى`. Auth/role errors → hide CTA.
- **Refresh behavior:** pull-to-refresh + refetch after any claim (self or on focus) so a losing claim reconciles; invalidate the relevant center queries so the claimed item appears in "my" screens.
- **Outcome wiring:** switch `setAppointmentStatus` to `set_assigned_appointment_outcome` for non-managers (or all); keep `completeTask`/`cancelTask` and `setVisitStatus` (now trigger-constrained) and `insertLog`/`updateLogStatus` as-is; restrict visit **detail** editing and delete to managers in the UI to match the server.
- **Copy:** add `ar`/`en` strings for `متاح للتكفّل` / *Available to claim*, `أنا متكفّل` / *I'll take responsibility*, the race error, and the outcome labels (all already partly present for task/dose/appointment/visit status).

---

## 11. Known risks / open questions

1. **Live-vs-repo drift (highest) — confirm the post-2D state before applying.** Everything the claim/outcome SQL depends on — `care_appointments.assigned_to`, `medications.responsible_user_id`, all Phase 2D policies/helpers, the `enforce_care_task_collaborator_scope` trigger — lives in the **DB only**. The committed migrations still carry the **pre-2D** task collaborator policy (with the `assigned_to is null` allowance); the "RLS blocks a non-manager from directly updating an unowned row" safety argument (§6.3) holds **only** on the post-2D schema. **Run §8.1 first and diff the live policies/trigger** — do **not** apply on a pre-2D database (apply Phase 2D first). The `create or replace` on the task trigger must exactly restore the current body **plus** the bypass line (§6.3a is the verified body).
2. **Modifying a verified security trigger.** §6.3a re-creates `enforce_care_task_collaborator_scope`. The only functional change is the leading `sanad.in_claim` early-return; if you prefer zero change to that function, the alternative is a `care_tasks`-specific carve-out branch (`old.assigned_to is null → allow the assign-only transition`), which is equivalent in safety but rewrites more of the body. Bypass-flag chosen for **minimal diff**.
3. **Appointment "unable" maps to `cancelled`.** `care_appointment_status` has only `scheduled/completed/cancelled` (no `unable/no_show`). تعذّر الموعد → `cancelled` (same for تعذّر الإنجاز → task `cancelled`, تعذّرت الزيارة → visit `cancelled`). Adding a distinct value is an `ALTER TYPE … ADD VALUE` (cannot run in a txn block) plus CHECK/trigger/notification reconciliation — **deferred**; label-mapping preferred, as instructed.
4. **Visit status-only safety.** The over-broad own-UPDATE is closed by the new trigger (§6.3b) and the **required** DELETE tightening (§6.6, applied atomically with the visit claim). Trade-off: linked visitors (incl. self-created) can no longer edit visit **details** or delete — only cancel. Confirm this is acceptable (it matches the core rule that detail editing is manager-only); if self-created visits should stay editable by their author, that needs a separate, `created_by`-aware rule (note: `created_by` is client-supplied today, so it is **not** a safe authorization signal without also tightening the create path).
5. **Medication catalog stays broadly visible.** By Phase 2D design, `medications`/`medication_schedules` SELECT remain broad; the claim feed does not change that. Unassigned meds are discoverable both in the catalog and the feed — acceptable.
6. **Feed `location` disclosure.** Appointment `location` is surfaced as `subtitle` to aid the claim decision; if product deems clinic/location sensitive, drop it (§3.3) — one-line edit.
7. **`caregiver` accepted but not activated.** It sits in the claim-capable array for consistency; no such members exist and the UI won't offer claiming to it. Do not activate here.
8. **Future manager notification.** When a member claims an item, managers should later be informed ("فلان تكفّل بـ …"). Not implemented now; the claim RPCs are the natural hook (emit into the existing notification outbox in a later phase). No notification code is added here.
9. **`created_by` remains client-supplied** on visits/appointments/logs (unchanged). The claim/outcome model does not rely on it for authorization; noted as pre-existing.
10. **`created_at` not in the trigger content-freeze list** (both `care_tasks` and the new `family_visits` trigger). A collaborator could tamper with `created_at` during a status change. Accepted as-is (symmetric with the existing verified `care_tasks` trigger; the app never sends `created_at` on a status update, and `updated_at` is trigger-managed). If audit-integrity requires it, add `new.created_at is distinct from old.created_at` to the freeze list in §6.3b (and, if desired, §6.3a).

---

## 12. Confirmation

- **No SQL was run**; **no Supabase connection** made; **no Supabase CLI** used; **no migration applied**; **no SQL executed**.
- **No app source code changed** — the only filesystem write is this markdown report under `docs/claude-reports/`. No dependency, Expo-config, native, backend/Edge-function, or generated-types change. **No EAS, no prebuild.**
- **No `.env` / secrets** read or modified.
- Stayed inside `E:\Projects\sanad-mobile`; **ThinkMate Chess and all other projects untouched**.
- **Not committed, not staged.**

---

## 13. Git status & diff

`git --no-pager status --short`:

```
?? docs/claude-reports/2026-06-26-phase-2e-claim-flow-rpc-audit.md
```

`git --no-pager diff --stat`:

```
(no output — no tracked files modified; the only change is the untracked report above)
```
