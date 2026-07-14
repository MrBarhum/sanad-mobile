# Sanad — Phases 1–5 Full Session Report

**Date:** 2026-07-14
**Repo:** `E:\Projects\sanad-mobile-clean`
**Working location:** isolated git worktree `.claude/worktrees/phases-1-to-5`, branch **`worktree-phases-1-to-5`** (branched from `master` @ `ced8554`). The main checkout was never modified.
**Branch status at report time:** clean; **8 commits** ahead of `master`; **not pushed**, no PR opened.
**Author:** Claude (Opus 4.8, 1M context), background session.

---

## 0. What this was

Execute the "Suggested next phases" (§M) of the master product-map report
(`docs/claude-reports/2026-07-14-product-map-workflows-and-ui-inventory.md`),
**Phases 1 through 5**, and deliberately **skip Phase 6** — the 2F-11D
data-only / Android background action-button push work, which is the item
deferred with a documented product decision ("Option A for MVP": delivery >
lock-screen-button convenience; recorded in
`2026-07-13-phase-2f-11c-closeout-and-2f-11d-decision.md` and §H.1 of the map).

**Constraints honored throughout:** no Supabase/SQL/deploy/cron/secret action;
no `.env` opened; no new dependencies added; no `git add .`; no push/PR without
approval. All Supabase RLS claims are **read** from `supabase/migrations/*.sql`,
never executed. UI work followed the Sanad UI/UX skill (Arabic-first RTL, ≥48dp
targets, status = icon+text+color, theme tokens only, no new glyph literals,
confirm destructive actions).

---

## 1. Executive summary

| Phase | Result |
|---|---|
| **1 — MVP reachability (P0/P1 cluster)** | ✅ Done. The headline "built but unreachable" risk is closed: member management, recipient profile, emergency contacts, circle timezone, and doctor edit/delete are all reachable now; remove-member confirms. |
| **2 — Safety & correctness polish** | ✅ Done. Detail complete/cancel now confirm everywhere; task reopen added; completed-appointments history fixed; Home + dose-log failures surface; shared type scale raised toward the elder floor. |
| **3 — Role QA pass** | ◑ Code-level verification done (RLS read + confirmed); **device execution needs real accounts/hardware** — checklist delivered. |
| **4 — Notification QA pass** | ◑ Code item done (unsaved guard); **device matrix needs hardware**; `check-missed-doses` cron flagged for your approval. |
| **5 — Cleanup / release-readiness** | ◑ Dead code deleted, version from config; **larger token/i18n consolidation + EAS/expo-doctor patch bump deferred** (need your go-ahead). |
| **6 — Deferred (2F-11D)** | ⏸ Untouched, by your decision. |

**Net diff vs `master`:** 36 files, **+1321 / −2915** lines (the deletions are 11
verified-dead files). Every commit passes `tsc --noEmit`, `check:mojibake`,
`git diff --check`, and ar/en key parity (final **1002 / 1002**).

---

## 2. Commit-by-commit log (branch `worktree-phases-1-to-5`)

| # | SHA | Title | Closes |
|---|---|---|---|
| 1 | `385be96` | feat(members): make member management reachable + confirm removal | P0-1, P0-2 |
| 2 | `23e5428` | feat(nav): reach recipient profile, emergency contacts, circle timezone | P1-1, P1-3 |
| 3 | `efa34fd` | feat(doctors): add edit + delete on the live doctors screen | P1-2 |
| 4 | `7793b90` | feat(status): confirm detail complete/cancel, task reopen, completed history | P1-4, P1-5, P1-6 |
| 5 | `4e58243` | feat(reliability): surface Home load errors + dose-log failures | P1-10, P2-5 |
| 6 | `c5a6e77` | a11y(type): raise shared Figma primitives toward the 14pt elder floor | P1-8 (partial) |
| 7 | `1679408` | chore: unsaved-settings guard, version from config, delete dead code | P2-8, P3-1, P2-1 |
| 8 | `b517e66` + this file | docs(product): record phases 1-5 implementation + role/notification QA | — |

---

## 3. Phase 1 — MVP reachability (detail)

### P0-1 — Member management is reachable (was: built but unrouted)
**Problem:** change-role, reactivate, leave-circle, transfer-ownership, and
manage-invitations existed only in the legacy `MembersManager`/`RoleModal`, which
no route imported. The shipped roster (`FigmaMembers`) could only view + remove.

**Fix:** a new Figma-styled sheet `src/features/circle-members/figma-member-actions.tsx`
(`MemberActionsSheet` + `memberHasActions`) hosts all per-member actions, built on
`FigmaBottomSheet`/`FigmaButton`/`FigmaCardSelect` and wired to the **existing
authoritative hooks** (`useUpdateMemberRole`, `useUpdateMemberStatus`,
`useLeaveCircle`, `useTransferOwnership`) and **existing permission gates**
(`assignableRolesFor`, `canChangeStatus`, `isLastActiveAdmin`). The roster
(`figma-members.tsx`) was reworked so:
- rows the actor can act on are pressable (a `MoreHorizontal` affordance) and open the sheet;
- removed members are shown to managers so they can be reactivated;
- a "Manage invitations" secondary button routes managers to `/circle-members/invitations` (previously reachable only from the dead manager).

Role change is one explicit save with a live effect note (reversible → no
double-confirm). Remove / leave / transfer-ownership are **two-step confirms**
with plain-language warnings. All server RPCs + guardrails (last-admin,
owner-protected) remain authoritative; the UI only decides what to surface.

### P0-2 — Remove-member now confirms
Was a single tap on the live roster. Now routed through the sheet's two-step
confirm (`removeConfirmBody` → `confirmRemove` / `cancel`).

### P1-1 — Recipient profile & emergency contacts reachable
Both screens were linked only from the dead dashboard.
- **Explore** (`src/app/(app)/(tabs)/explore.tsx`) gains a "care recipient profile"
  row (`/recipient-profile`) — visible to all, read-only for non-managers.
- **Emergency card** (`src/features/emergency/figma-emergency-card.tsx`) now takes
  `canManage` and shows a **manager-only "Edit"** affordance on its Medical
  section (→ `/recipient-profile`) and Contacts section (→ `/emergency-contacts`).
  The card itself stays read-only; only the shortcuts are new. This is the most
  contextual entry — the card *displays* exactly those fields.

### P1-3 — Circle timezone reachable
`CircleTimezoneCard` had no importer at all. Mounted on
`src/features/notifications/notification-settings.tsx`, where circle timezone
governs when reminders fire. It self-gates: managers can change it, others see a
read-only value + "managers only" note. A code comment distinguishes it from the
pre-existing per-user quiet-hours timezone display.

### P1-2 — Doctor edit + delete on the live screen
`FigmaDoctors` could only add + call. Added a manager-only action footer to each
Figma doctor card: **Edit** (reuses the existing validated `DoctorFormModal` in
edit mode) and **Delete** behind a two-step inline confirm, with a surfaced error
on failure. `DoctorFormModal` already supported `initial` for editing; only the
UI entry was missing.

### P1-7 — Appointment outcome for assignees — VERIFIED, no change needed
The map flagged this "Needs QA" citing the *dead* `appointments-center`. In the
live path it already works: the route passes `canCollaborate={circle.canLogDoses}`,
`figma-appointments` scopes non-manager collaborators to their assigned
appointments and lets them open the detail, and `AppointmentViewScreen` shows the
outcome buttons via `canMarkOutcome` (`appointment-editor.tsx`). Left as-is.

---

## 4. Phase 2 — Safety & correctness polish (detail)

### P1-5 — Detail complete/cancel now confirm (tasks, appointments, visits)
Detail-screen outcome mutations previously fired instantly (the list already used
a confirm). Added a **two-step confirm** with a plain-language prompt to all three
`StatusSection`s (`task-editor.tsx`, `appointment-editor.tsx`, `visit-editor.tsx`),
mirroring the list (complete = primary, cancel = danger). Failures now show an
inline `role="alert"` error instead of being swallowed in a `finally`.

### P1-6 — Manager task reopen (undo)
Tasks were terminal with no reopen (appointments/visits already reopened). Added
`reopenTask` (`tasks/api.ts`) + `useReopenTask` (`tasks/hooks.ts`) and a manager-only
"Reopen task" button in the task `StatusSection`. The update sets
`status='open'` and nulls `completed_at/completed_by/cancelled_at` to satisfy the
three CHECK constraints (`care_tasks_completed_at_consistent`,
`_cancelled_at_consistent`, `_completed_by_consistent`, in
`20260610090000_create_care_tasks.sql`). The collaborator-scope trigger
(`:150-156`) explicitly lets managers "change anything", so RLS keeps reopen
managers-only. **Recommend a device confirm** that reopen persists (the map
tagged this "Needs QA").

### P1-4 — Completed appointments show real history
The "Completed" tab filtered the future-only upcoming dataset, so it was
structurally empty. Added `fetchCompletedAppointments` (all dates, newest first;
`appointments/api.ts`) + `useCompletedAppointments` (lazy — only fetches when the
tab opens; `hooks.ts`) and wired the tab to switch queries
(`figma-appointments.tsx`). `invalidateAll` already covers the new query key
(`['appointments']` prefix).

### P1-10 — Home surfaces sub-query failures
Home swallowed doses/tasks/appointments load errors, so an empty dashboard looked
like "nothing today." Now a single **retryable banner** appears if any of the
three today-queries errored, refetching all three. Required exposing `refetch`
from `useTodayTaskSummary` (`tasks/hooks.ts`).

### P2-5 — Silent mutation failures (highest-impact cases)
Failed **dose logs** (Home + medications list) now show an inline error instead of
the row silently reverting; **doctor delete** and the **detail outcome** mutations
also surface errors. Remaining silent spots (medication activation toggle /
delete, log & vital delete) are noted as follow-up.

### P1-8 — Type scale toward the 14sp elder floor (partial, high-leverage)
The Figma exact-copy scale sits below the older-adult floor. Rather than a risky
per-screen sweep, raised the **shared primitives** that set the app-wide floor:
list-row subtitles 12→14, status-pill labels 11→14, section eyebrows 12→13,
bottom-tab labels 11→13 (kept 13 not 14 — three flex-1 tabs are layout-sensitive).
Documented the floor policy on the `FigmaFontSize` token (which is currently
unreferenced). A comprehensive per-screen sweep + device verification at
130%/200% remains the "design + QA" portion the map itself scoped.

---

## 5. Phase 3 — Role gate vs RLS verification (code-read)

Read from `supabase/migrations/` — **not executed**. Answers the map's §F.3 open
questions (Q1–Q5):

| Q | Answer | Evidence |
|---|---|---|
| Q1 remote read scope | `remote_member` reads ALL operational data (== manager read); `can_view_all_operational` includes it. The deliberate "single switch point." | `20260626161000_...rls.sql:24,55,89,150,165` |
| Q2 assignee appt outcome | Allowed server-side (`assigned_to = auth.uid()`); now surfaced in-app. | `20260626162000_...claim_flow.sql:382` |
| Q3 non-responsible dose/task | Blocked: dose-log needs manager OR `is_responsible_for_medication`; task complete needs `assigned_to = auth.uid()`. | `20260626161000_...rls.sql:102,37,74` |
| Q4 `set_circle_timezone` | Manager-only (42501 otherwise). | `20260611120200_...timezone.sql:48` |
| Q5 caregiver/elder | Server-rejected by role + invitation RPCs; claim RPCs reject remote/elder. | `20260610130100_...rpcs.sql:93,476`; `20260626162000_...claim_flow.sql:118` |

**For device QA to re-verify (policies were hand-applied then back-filled — confirm live == repo):**
remote is full-read not summary-only; family_member sees all meds/vitals/daily-logs
but only their own tasks/appts/visits/dose-logs (asymmetry — intended?);
`caregiver` is dormant not removed; a raw PostgREST reassignment of
`assigned_to`/`visitor_user_id` must still fail. A per-role device checklist is in
`2026-07-14-phases-1-5-implementation-and-qa.md` §B.2.

---

## 6. Phase 4 — Notification QA

- **Code done — P2-8:** notification-settings now warns before leaving with unsaved
  edits (`UnsavedChangesGuard` + a baseline-snapshot `dirty` flag reset on
  load/save).
- **Device matrix (needs hardware):** Samsung S24 + one other Android ×
  foreground/background/killed × Doze/battery-opt — confirm detailed remote text,
  tap-to-open, in-app complete/snooze, local/foreground buttons, quiet hours,
  per-scope prefs. Expected (per settled §H.1): backgrounded/killed remote pushes
  render **no** action buttons on Android (accepted MVP limitation).
- **P1-9 — FLAG (needs your approval):** `check-missed-doses` is deployed but not
  among the 3 active cron jobs, so tier-2 missed-dose escalation may never fire.
  This is a cron/Supabase change requiring your explicit go-ahead (project ref
  `qccgshanmoeybagxwvcs`) — **not touched here**.

---

## 7. Phase 5 — Cleanup

- **P2-1 — deleted 11 verified-dead files** (each confirmed zero `src/` importers
  by a dedicated verification pass): `circle-members/members-manager.tsx`,
  `circle-members/role-modal.tsx`, `care-circle/circle-dashboard.tsx`,
  `circle-selection/circle-switcher.tsx`, `notifications/notification-bell.tsx`,
  `medications/medications-center.tsx`, `tasks/tasks-center.tsx`,
  `appointments/appointments-center.tsx`, `visits/visits-center.tsx`,
  `notifications/notifications-center.tsx`, `emergency/emergency-card.tsx`.
  tsc stayed green after deletion.
- **P3-1 — version from config:** Account reads `Constants.expoConfig?.version`
  (expo-constants) instead of hardcoded `'1.0.0'`.
- **KEPT `doctors/doctors-manager.tsx`** — its `DoctorFormModal` is live (reused by
  `figma-doctors`); only the unused `DoctorsManager` component is dead.
- **Deferred (larger / device-verified passes):** two token systems (P2-2),
  `figma.*` label drift + hardcoded Arabic notification strings (P2-10), full
  per-screen 14sp sweep (rest of P1-8), and now-orphaned primitives
  (`NavCard`/`HintRow`/`Collapsible` etc.) whose only consumer was the deleted
  dashboard. EAS build + expo patch-version bump also deferred (see §9).

---

## 8. File inventory

**Added (2 source + 2 docs):**
`src/features/circle-members/figma-member-actions.tsx`;
this report + `2026-07-14-phases-1-5-implementation-and-qa.md`.

**Modified (source):** `app/(app)/(tabs)/account.tsx`, `explore.tsx`,
`app/(app)/emergency-card.tsx`; `components/figma/{figma-list-row,figma-status-pill,figma-tab-bar,figma-tokens}.tsx`;
`features/appointments/{api,hooks,appointment-editor,figma-appointments}.tsx`;
`features/care-circle/figma-home.tsx`; `features/circle-members/figma-members.tsx`;
`features/doctors/figma-doctors.tsx`; `features/emergency/figma-emergency-card.tsx`;
`features/medications/figma-medications.tsx`;
`features/notifications/notification-settings.tsx`;
`features/tasks/{api,hooks,task-editor}.tsx`; `features/visits/visit-editor.tsx`;
`src/locales/{ar,en}.json`.

**Deleted (11):** listed in §7.

**i18n keys added (both ar + en, parity preserved):** `circleMembers.{manage,
manageInvitations, removeConfirmBody, leaveConfirmTitle, leaveConfirmBody,
confirmLeave, makeOwnerConfirmBody, roleSaved}`; `figma.explore.items.recipientProfile`;
`tasks.reopen`; `appointments.{confirmCompletedBody, confirmCancelledBody}`;
`visits.{confirmCompletedBody, confirmCancelledBody}`;
`careCircle.dashboard.today.{loadError, logFailed}`.

---

## 9. Validation results (this session)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** (re-run after every commit) |
| `npm run check:mojibake` | clean (268 files) |
| `git -c core.autocrlf=false diff --check` | clean |
| ar/en locale key parity | **1002 / 1002** |
| `npx expo-doctor` | **1 check failed — 8 packages behind their SDK-56 patch versions** (`expo`, `expo-router`, `expo-notifications`, `expo-constants`, `expo-dev-client`, `expo-linking`, `expo-splash-screen`, `@expo/ui`). **Pre-existing** — no dependencies were added/changed this session. Resolve with `npx expo install --check` when ready (mutates deps / may need native rebuild — your call). |

No test runner exists in this repo; `tsc` + mojibake + `git diff --check` are the
project's validation gates (all green).

---

## 10. What needs you (cannot be done from here)

1. **Push + PR** — I committed in the isolated worktree but did not push or open a
   PR (your standing rule: no push without explicit ask). Say the word and I'll
   `git push` + `gh pr create --draft`.
2. **Device QA** — Phase 3 per-role checklist and Phase 4 notification matrix need
   real hardware + real accounts per role.
3. **`check-missed-doses` cron (P1-9)** — needs your explicit approval of the exact
   command (Supabase guardrails).
4. **expo patch bump / EAS build** — deps/native change; your go-ahead.
5. **Optional follow-ups I can take next:** the remaining P2-5 silent-failure spots,
   P2-2 token consolidation, P2-10 i18n string extraction, and the full P1-8 sweep.

---

## 11. Reviewer-report checklist (standing format)

- **CWD / branch:** `E:\Projects\sanad-mobile-clean` → worktree `worktree-phases-1-to-5` (off `master` @ `ced8554`); main checkout untouched.
- **Status:** clean, 8 commits ahead, **not pushed**.
- **Files read:** the master map report; membership/doctors/appointments/visits/tasks/emergency/notifications feature code; shared Figma primitives; `supabase/migrations/*` (read-only); locale files.
- **Files changed:** 25 modified, 2 added, 11 deleted (see §8).
- **Commands run:** `git` (status/log/diff/add/commit/rm), `tsc --noEmit`, `npm run check:mojibake`, `node` parity checks, `npx expo-doctor`. No network mutation.
- **Checks/results:** §9 — tsc 0, mojibake clean, diff-check clean, parity 1002/1002, expo-doctor 1 pre-existing fail.
- **Supabase commands run:** none. **Deploy / SQL / cron / secret action:** none.
- **Findings:** Phases 1–5 delivered as code; Phase 3/4 device execution + P1-9 cron + EAS/expo bump remain (need you); Phase 6 deferred by decision.
- **Recommended next step:** review the branch; on approval, push + open a draft PR; then schedule device QA and decide the `check-missed-doses` cron.

*End of report.*
