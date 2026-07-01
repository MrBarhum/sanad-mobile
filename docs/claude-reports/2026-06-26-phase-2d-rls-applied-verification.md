# Phase 2D — RLS applied verification

**Baseline:** `54e27f9 fix(product): scope operational surfaces by responsibility`.
**Companion audit:** `docs/claude-reports/2026-06-26-phase-2d-rls-hardening-audit.md` (the proposal this verifies).
**Nature of this document:** a verification record. The RLS SQL was **applied manually by the user** in the Sanad Supabase Dashboard, and the helper/policy/simulation results below were **manually verified by the user**. **Claude ran no SQL, made no Supabase connection, used no CLI, and changed no app code** — this report only records and reconciles the user-provided results. Nothing committed or staged.

---

## 1. What was manually applied in Supabase

The user applied the Phase 2D hardening SQL (§5 of the audit) by hand in the Dashboard SQL editor. Applied set:

- **Two helper functions** (additive) — see §2.
- **`care_tasks`**: SELECT replaced with responsibility-scoped predicate; family/caregiver UPDATE tightened (unassigned allowance removed).
- **`care_appointments`**: SELECT replaced with responsibility-scoped predicate.
- **`family_visits`**: SELECT replaced with responsibility-scoped predicate.
- **`medication_logs`**: SELECT, INSERT, and UPDATE replaced with manager-or-responsible predicates (the audit's optional dose-log SELECT scope was applied alongside the mandatory INSERT/UPDATE gate).
- **`medications` / `medication_schedules`**: **left broad** (unchanged) — intentional shared catalog/schedule reference (see §6).
- Manager INSERT / manager UPDATE / DELETE policies and the `enforce_care_task_collaborator_scope` trigger were left untouched.

No data rows were modified; all changes were policy/function definitions.

---

## 2. Helper functions verified

The user confirmed both new helpers exist in `public` (`SECURITY DEFINER`, `stable`, `search_path = ''`):

| Function | Signature | Purpose |
| --- | --- | --- |
| `can_view_all_operational` | `(p_circle_id uuid) → boolean` | The "sees every operational row" group: returns true for `admin`, `primary_caregiver`, and (for now) `remote_member`. Single switch point for the remote read-scope decision. |
| `is_responsible_for_medication` | `(p_circle_id uuid, p_medication_id uuid, p_user_id uuid) → boolean` | True when `p_user_id` is the `responsible_user_id` of the medication in that circle. Gates dose-log read/insert/update for doers. |

These compose with the pre-existing helpers (`is_circle_member`, `has_circle_role`, `is_circle_medication`, `is_circle_medication_schedule_for_medication`) used by the unchanged integrity checks.

---

## 3. Policy changes verified

The user confirmed the live policies now read as follows (matching the audit proposal):

| Table | Operation | Verified predicate (effective) |
| --- | --- | --- |
| `care_tasks` | SELECT | `can_view_all_operational(circle_id)` **OR** (`is_circle_member` AND (`assigned_to = auth.uid()` **OR** `completed_by = auth.uid()`)) |
| `care_tasks` | UPDATE (family/caregiver) | `has_circle_role([caregiver, family_member])` AND `assigned_to = auth.uid()` — **no unassigned allowance** (status-only via the unchanged trigger) |
| `care_appointments` | SELECT | `can_view_all_operational(circle_id)` **OR** (`is_circle_member` AND `assigned_to = auth.uid()`) |
| `family_visits` | SELECT | `can_view_all_operational(circle_id)` **OR** (`is_circle_member` AND `visitor_user_id = auth.uid()`) |
| `medication_logs` | SELECT | `can_view_all_operational(circle_id)` **OR** (`is_circle_member` AND `is_responsible_for_medication(circle_id, medication_id, auth.uid())`) |
| `medication_logs` | INSERT / UPDATE | manager **OR** (doer AND `is_responsible_for_medication(...)`), preserving the circle/medication/schedule integrity checks (USING gates the old row, WITH CHECK the new row) |
| `medications`, `medication_schedules` | SELECT | **unchanged — broad** (`is_circle_member`) |
| `can_view_all_operational` membership | — | includes `admin`, `primary_caregiver`, `remote_member` |

Manager read/write remains full; `family_member` is scoped to own assigned/responsible/linked rows; `remote_member` retains broad read-only and no operational mutation path (it is absent from every write-policy role array).

---

## 4. Family1 server-side RLS simulation — counts vs. expected `[QA]` seed

The user simulated family1's session server-side (e.g. `set local role authenticated` + JWT `sub` = family1, inside a rolled-back transaction) and counted the `[QA]` rows visible. All four match the seed exactly:

| Entity | family1 visible | Expected from `[QA]` seed | Why it matches |
| --- | --- | --- | --- |
| **Tasks** | **4** | 3 open assigned to family1 **+** 1 completed-by-family1 | SELECT = `assigned_to = me OR completed_by = me`. The 3 open assigned rows match `assigned_to`; the completed seed task (assigned to **and** completed by family1) matches on both columns (one row, not double-counted). Unassigned (3) and family2/primary1 tasks are correctly excluded. |
| **Appointments** | **3** | 2 today + 1 tomorrow, all `assigned_to` family1 | SELECT = `assigned_to = me`. family1's three assigned appointments match; family2 (2, incl. the completed one), primary1 (1), and the unassigned (1) are excluded. |
| **Visits** | **2** | 1 today + 1 tomorrow, `visitor_user_id` = family1 | SELECT = `visitor_user_id = me`. family1's two linked visits match; family2/primary1 linked and the unlinked visit are excluded. |
| **Medication logs** | **1** | 1 "given" dose log on `[QA] دواء ميتفورمين` (responsible = family1), recorded by family1 | SELECT = responsible-medication check. The seed created exactly one dose log, on a medication family1 is responsible for, so it is visible. No other logs exist. |

Reconciliation: the counts equal the **server-enforced** scope, independent of the UI's client-side filter — confirming RLS now enforces what the app previously only hid. (Unassigned rows do not leak: `null = auth.uid()` is never true, and the null-responsible medication is not matched by `is_responsible_for_medication`.)

---

## 5. Product decision — `remote_member` broad read-only

Confirmed and applied as the interim policy:

- `remote_member` is included in `can_view_all_operational`, so it retains **broad read-only** visibility of operational rows (tasks, appointments, doses/logs, visits) — matching the shipped app, where remote sees full read-only lists. **Zero UX regression.**
- `remote_member` has **no operational mutation path** (absent from every INSERT/UPDATE/DELETE role array on `care_tasks`, `care_appointments`, `medications`, `medication_schedules`, `medication_logs`, `family_visits`).
- Unassigned operational rows are **manager-only for doer execution**; `family_member` cannot read or act on them, while `remote_member` may **read** them for now under this broad read-only allowance.
- Moving remote to a narrower **summary-only** model later is a single-point change: remove `remote_member` from `can_view_all_operational` (plus build the summary surface). Deferred, product-gated.

---

## 6. Known remaining caveats

1. **`medications` and `medication_schedules` SELECT remain broadly readable.** This is intentional: they are the **shared catalog / schedule reference** (the "All medications" tab is reference data for everyone), and the client-side today's-doses computation needs medications + schedules + logs readable together (and medication creation RETURNINGs the new row). Dose **responsibility** is therefore enforced at the **dose-log mutation** layer, not by hiding the catalog. If the catalog itself must later be scoped, that requires a separate redesign (e.g. a `SECURITY DEFINER` "today's doses" RPC) — do not scope these tables casually or the catalog, dose computation, and medication creation will break.
2. **A future clinical/professional role must be separate from `remote_member`.** `remote_member` is currently "broad read-only family observer." A clinician/professional viewer (or any role needing different read/write scope) should be introduced as its **own** role with its **own** policies, **not** by overloading `remote_member`. Do not widen `remote_member` to cover professional access.
3. **Live-vs-repo drift remains a standing concern.** `care_appointments.assigned_to` and `medications.responsible_user_id` (and now these policies) were applied manually; keep the repo migrations / generated types in sync, and re-run the §7 policy inventory from the audit whenever auditing future changes.
4. **No claim / notifications / new roles** were introduced — out of scope, as in the audit.

---

## 7. Manual app QA checklist still required

Server-side counts verify the RLS; the **app** must still be exercised end-to-end with the `[QA]` seed users (circle `رعاية الوالد الغالي`) to confirm no regression:

1. **family1 app still works** — tasks/appointments/visits lists populate with only their own items (4 / 3 / 2); today's doses show only their responsible meds and register works; deep-linking to a family2 item now returns empty (server-enforced); completing an unassigned task is rejected; logging a non-responsible dose is rejected.
2. **admin / primary still see all** — every `[QA]` task/appointment/dose/visit incl. unassigned; can edit/complete items assigned to others; can log any dose; manager **create medication** still works (RETURNING read-back); the "All medications" catalog lists every med.
3. **remote read-only** — lists still populate (broad read-only); every operational mutation (task complete/cancel, dose register, appointment/visit status) is rejected; remote is never an assignee/responsible/visitor.
4. **family2** — symmetric to family1; sees none of family1's items.
5. **Regression sweep** — dose status still computes (names/times resolve) for all roles; create task/appointment/visit; family records own visit; member/responsible names still display (via the `list_circle_members` RPC, unaffected by these changes).

---

## 8. Confirmation

- **No SQL was run by Claude**; the SQL was applied manually by the user. Claude made **no Supabase connection** and **used no Supabase CLI**.
- **No app source code changed** — the only filesystem write is this markdown report under `docs/claude-reports/`.
- **No `.env` / secrets** read or modified; **no** dependency, Expo-config, native, backend-function, EAS, or prebuild change.
- Stayed inside `E:\Projects\sanad-mobile`; no other project touched.
- **Not committed, not staged.**

---

## 9. Git status & diff

`git --no-pager status --short`:

```
?? docs/claude-reports/2026-06-26-phase-2d-rls-applied-verification.md
?? docs/claude-reports/2026-06-26-phase-2d-rls-hardening-audit.md
```

`git --no-pager diff --stat`:

```
(no output — no tracked files modified; the only changes are the two untracked reports above)
```
