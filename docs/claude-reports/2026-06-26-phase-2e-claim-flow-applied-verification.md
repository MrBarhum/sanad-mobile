# Phase 2E-1 — "أنا متكفّل" / Available-to-Claim: applied verification

**Baseline:** `87e5a8c docs(product): verify responsibility-based RLS hardening`.
**Companion docs:** audit `docs/claude-reports/2026-06-26-phase-2e-claim-flow-rpc-audit.md`; apply pack `docs/claude-reports/2026-06-26-phase-2e-claim-flow-sql-apply-pack.md` (the SQL this record verifies).
**Nature of this document:** a **verification record**. The Phase 2E claim-flow SQL was **applied manually by the user** in the Sanad Supabase Dashboard SQL editor, and the preflight/verification results below were **manually produced by the user**. **Claude ran no SQL, made no Supabase connection, used no CLI, and changed no app code** — this report only records and reconciles the user-provided results. Nothing committed or staged.

---

## 1. Manual apply summary

- **Claude ran no SQL** and made **no Supabase connection / used no CLI**. The user pasted the §2 APPLY block from the apply pack into the Dashboard SQL editor and ran it by hand.
- The full Phase 2E APPLY (single `begin; … commit;` transaction) executed with result: **`Success. No rows returned`** — expected for a pure DDL batch (function/trigger/policy definitions; no rows selected).
- No data rows, tables, columns, enums, or roles were changed by the apply.

---

## 2. Preflight results summary

All preconditions from §1 of the apply pack were confirmed **before** applying — the schema was in the required post-Phase-2D state:

| Precondition | Result |
| --- | --- |
| `care_appointments.assigned_to` exists | ✅ present |
| `medications.responsible_user_id` exists | ✅ present |
| Phase 2D helper `can_view_all_operational` exists | ✅ present |
| Phase 2D helper `is_responsible_for_medication` exists | ✅ present |
| Helper `active_circle_member_role` exists | ✅ present |
| Helper `has_circle_role` exists | ✅ present |
| Helper `is_circle_member` exists | ✅ present |
| No Phase 2E functions existed before apply | ✅ none (0 rows) |
| `Members can update assigned care tasks` is post-2D (no `assigned_to is null` branch) | ✅ post-2D confirmed |
| `care_tasks_collaborator_scope` trigger exists | ✅ present |
| `enforce_care_task_collaborator_scope` function exists | ✅ present |
| `Members can delete their own family visits` existed before apply | ✅ present (removed by the apply — see §3/§4) |

No STOP condition was triggered; apply proceeded.

---

## 3. Objects applied

| Object | Kind | Change |
| --- | --- | --- |
| `public.list_available_to_claim(uuid)` | RPC (SECURITY DEFINER) | **created** — unified available-to-claim discovery feed |
| `public.claim_care_task(uuid)` | RPC (SECURITY DEFINER) | **created** — claim an unassigned open task |
| `public.claim_medication_responsibility(uuid)` | RPC (SECURITY DEFINER) | **created** — claim an active med with no responsible user |
| `public.claim_care_appointment(uuid)` | RPC (SECURITY DEFINER) | **created** — claim an unassigned scheduled appointment |
| `public.claim_family_visit(uuid)` | RPC (SECURITY DEFINER) | **created** — claim a planned unlinked visit |
| `public.set_assigned_appointment_outcome(uuid, public.care_appointment_status)` | RPC (SECURITY DEFINER) | **created** — assignee/manager marks appointment completed/cancelled |
| `public.enforce_family_visit_collaborator_scope()` | trigger function | **created** — status-only guard for linked visitors |
| `family_visits_collaborator_scope` | trigger | **created** — `BEFORE UPDATE` binding of the visit guard |
| `public.enforce_care_task_collaborator_scope()` | trigger function | **body updated** — added the transaction-local claim bypass (`sanad.in_claim`); all other Phase 2D behavior preserved |
| `"Members can delete their own family visits"` on `public.family_visits` | RLS policy | **removed** — visit DELETE is now manager-only (closes the claim→delete escalation) |

All six RPCs were applied with `revoke all … from public; grant execute … to authenticated`. No direct table privileges were changed; the collaborator outcome paths (`care_tasks`, `family_visits`, `medication_logs`) retain their existing RLS/trigger-gated direct DML.

---

## 4. Verification results (user-run, post-apply)

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| Phase 2E function count (6 RPCs + visit trigger fn) | 7 | **7** | ✅ |
| claim/status triggers count (`family_visits_collaborator_scope` + `care_tasks_collaborator_scope`) | 2 | **2** | ✅ |
| own-visit delete policy count | 0 | **0** | ✅ (policy removed) |
| remote_member calling the feed | blocked `42501` | **`42501`** — `your role is not allowed to view claimable items` | ✅ |
| remote_member calling a claim | blocked `42501` | **`42501`** — `your role is not allowed to claim items` | ✅ |

QA ids resolved for the feed simulation: circle id ✅, family1 id ✅, remote1 id ✅, an unassigned QA task id ✅.

---

## 5. Feed count reconciliation

The `list_available_to_claim` verification script's expectations were written against the **`[QA]` seed only** (6 items). The live circle also contains **pre-existing, non-QA** unowned operational rows, and `list_available_to_claim` correctly returns **all claimable items in the circle**, not just the `[QA]`-prefixed ones. So the higher live counts are **correct behavior, not a failure** — they confirm the RPC surfaces every unowned/eligible item.

| Entity | QA-seed expected | Live actual | Breakdown (live existing + QA) |
| --- | --- | --- | --- |
| Appointments | 1 | **4** | 3 live unassigned scheduled + 1 QA unassigned scheduled |
| Medications | 1 | **5** | 4 live active w/o `responsible_user_id` + 1 QA active w/o `responsible_user_id` |
| Tasks | 3 | **5** | 2 live unassigned open + 3 QA unassigned open |
| Visits | 1 | **1** | 0 live + 1 QA planned unlinked |
| **Total** | **6** | **15** | **9 live + 6 QA** |

Interpretation:

- **Eligibility filters verified:** every returned row satisfies its unowned + eligible-status predicate (task `open` & `assigned_to is null`; medication `is_active` & `responsible_user_id is null`; appointment `scheduled` & `assigned_to is null`; visit `planned` & `visitor_user_id is null`). The user listed the items and confirmed the split above.
- **Scope verified:** all counts are within the single resolved circle; no cross-circle leakage.
- **QA rows accounted for:** the 6 expected `[QA]` items are all present within the 15 (3 task + 1 appointment + 1 medication + 1 visit).
- **Action for the QA-only assertion (optional):** to reproduce the strict "6" number, re-run the feed count filtered to `[QA]` titles/names, or run it in a clean circle with only the `[QA]` seed. The live-count result needs no fix.

---

## 6. Product confirmation

The applied server behavior matches the confirmed product decisions:

- **Claiming is immediate** — a single atomic `UPDATE … WHERE <col> IS NULL … RETURNING` fills the responsibility column with `auth.uid()`; no manager-approval step.
- **Claiming = operational responsibility only** — the claim sets `assigned_to` / `responsible_user_id` / `visitor_user_id`; it grants outcome/status rights, not edit rights.
- **remote_member cannot claim** — feed and claim both rejected with `42501` (verified §4). remote stays broad read-only (unchanged).
- **Linked/claimed visitor cannot delete a visit** — the own-visit DELETE policy is removed (count 0, verified §4); the linked visitor **cancels / marks unable** (status → `cancelled`) instead. Detail edits and relink are blocked by `enforce_family_visit_collaborator_scope`.
- **Owner can update outcome/status only** — task complete/cancel (existing collaborator policy + trigger), medication dose logging (given/missed/postponed, existing responsible-gated policy), appointment completed/cancelled (`set_assigned_appointment_outcome`), visit completed/cancelled (own-update policy now trigger-constrained).
- **Sensitive detail editing remains manager-only** — no collaborator path edits task/appointment/visit details or the medication catalog; managers retain full assign/reassign/edit/delete.

---

## 7. Remaining work

The **server side is live**; the client is not yet wired. Outstanding:

1. **UI implementation of `متاح للتكفّل`** — the available-to-claim feed screen (grouped by type), item cards per entity, and the **`أنا متكفّل`** CTA, gated to claim-capable roles and hidden from `remote_member`/`elder`. (See §10 of the audit report.)
2. **App API wiring to the RPCs** — add client calls for `list_available_to_claim` and the four `claim_*` RPCs; switch appointment status for non-managers to `set_assigned_appointment_outcome`; keep task/visit/dose outcome paths on their existing direct-table writes (now trigger-constrained); map `error.code === '23505'` → `تم التكفّل بهذا العنصر من شخص آخر`.
3. **App QA after the UI lands** — run the §5 checklist of the apply pack with the `[QA]` seed users (feed visibility, per-type claim, move-to-my-screen, outcome-only editing, manager reach, remote cannot claim, race → already-claimed).
4. **Future manager notification** — inform managers when someone claims an item ("فلان تكفّل بـ …"). Not implemented; the claim RPCs are the natural hook (emit into the existing notification outbox in a later phase).

---

## 8. Confirmation

- **No SQL was run by Claude**; the SQL was applied manually by the user. Claude made **no Supabase connection** and **used no Supabase CLI**.
- **No app source code changed** — the only filesystem write is this markdown report under `docs/claude-reports/`. No dependency, Expo-config, native, backend/Edge-function, generated-types, or migration change. **No EAS, no prebuild.**
- **No `.env` / secrets** read or modified.
- Stayed inside `E:\Projects\sanad-mobile`; **ThinkMate Chess and all other projects untouched**.
- **Not committed, not staged.**

---

## 9. Git status & diff

`git --no-pager status --short`:

```
?? docs/claude-reports/2026-06-26-phase-2e-claim-flow-applied-verification.md
?? docs/claude-reports/2026-06-26-phase-2e-claim-flow-rpc-audit.md
?? docs/claude-reports/2026-06-26-phase-2e-claim-flow-sql-apply-pack.md
```

*(All three Phase 2E reports are untracked and uncommitted — the audit and apply pack from the prior tasks, plus this verification record. This task added only the verification report.)*

`git --no-pager diff --stat`:

```
(no output — no tracked files modified; the only changes are the untracked reports above)
```
