# Phase 2B-hotfix-2 — Strict role-aware operational scoping + task CTA color fix

**Baseline commit:** `daed1ef feat(product): add assignment responsibility UI`
**Continues from (uncommitted):** Phase 2B task-action UX hotfix (`docs/claude-reports/2026-06-26-phase-2b-task-action-ux-hotfix.md`)
**Scope:** Frontend/UI scoping + a button-rendering fix. **No** SQL / RLS / migration / backend / dependency / Expo-config / EAS / prebuild changes. **Not committed, not staged.**

---

## 1. Working-tree state found before editing

`git status --short` showed exactly the previous task hotfix and its report — no unrelated changes — so this pass continued from them:

```
 M src/features/tasks/figma-tasks.tsx
 M src/features/tasks/task-editor.tsx
 M src/locales/ar.json
 M src/locales/en.json
?? docs/claude-reports/2026-06-26-phase-2b-task-action-ux-hotfix.md
```

The prior hotfix had: row quick-complete/cancel confirmation sheet, fall-through checkbox, the first cut of family task scoping (which *included* unassigned-open tasks), and the detail status copy split. This pass tightens that scoping and fixes the detail CTA color, then extends the same scoping discipline to medications/doses, appointments, and visits.

---

## 2. Exact files changed (this pass)

| File | Change |
| --- | --- |
| `src/features/tasks/task-editor.tsx` | **CTA fix:** detail complete action now uses the proven `FigmaFooterPrimaryButton` (filled teal) instead of `FigmaButton variant="primary"`; stacked above the quiet secondary. Tightened `canAct` / `canUpdateStatus` to **assignee-only** (no unassigned pick-up). |
| `src/features/tasks/figma-tasks.tsx` | Tightened family scope: `isMine` = assigned-to-me **or** completed-by-me only (dropped unassigned-open); `canActOn` non-managers = assigned-to-me only. |
| `src/features/medications/today.ts` | Added `responsibleUserId` to `DoseItem` and threaded `medication.responsible_user_id` into each computed dose. |
| `src/features/medications/figma-medications.tsx` | Family scopes the **today doses** list + summary to their responsible meds; per-dose register button gated to manager-or-responsible. |
| `src/features/care-circle/figma-home.tsx` | Home dashboard: care-loop / next-dose / dose strip / dose list + register **and** next-appointment / today-appointment count all scoped for family; dose register gated per responsibility. |
| `src/features/appointments/figma-appointments.tsx` | Added `canCollaborate` prop; family sees only appointments `assigned_to` them. |
| `src/app/(app)/appointments/index.tsx` | Passes `canCollaborate={circle.canLogDoses}` to `FigmaAppointments`. |
| `src/features/visits/figma-visits.tsx` | Family sees only visits where `visitor_user_id` === them. |
| `src/locales/ar.json`, `src/locales/en.json` | Task scope-note copy updated ("…assigned to you **only**", no longer "and available"); plus the prior hotfix's task keys. |

---

## 3. Role interpretation used

Effective roles (no new roles activated; `caregiver`/`elder` not activated):

- **`admin`, `primary_caregiver` → managers.** `circle.canManage === true`. See and manage everything.
- **`family_member` → doer.** `!canManage && canCollaborate` (`canCollaborate` = `circle.canLogDoses`). Scoped to items where the responsibility field === their user id. `caregiver` (not activated, but `canLogDoses`-true) would behave the same.
- **`remote_member` (and `elder`) → read-only.** `!canManage && !canCollaborate`. No action affordances (already true — every register/status/complete affordance is gated on `canLog`/`canCollaborate`/`canManage`). Keeps the existing read-only lists.

Uniform predicate across every area: **`scopeToMine = !canManage && canCollaborate`**. When true, filter the operational list to `responsibilityField === userId`. `userId = useAuth().user?.id`. Derived from the booleans the screens already receive — **no `role` enum threading, no new props beyond `canCollaborate` where a screen lacked it**.

Responsibility fields used: tasks `assigned_to` (+ `completed_by` for own history) · medications `responsible_user_id` · appointments `assigned_to` · visits `visitor_user_id`.

---

## 4. Task detail primary action color fix

Root cause: `FigmaButton variant="primary"` renders through `FigmaColors` with a **function-form `style`** Pressable — the exact shape the repo documented as not reliably painting its fill on the Android device (the reason `FigmaFooterPrimaryButton` was created as a plain-Pressable, body-rendered filled-teal CTA using `useTheme().primary`/`onPrimary`). In the nested `FigmaFormScreen` context it read as dark/disabled.

Fix (`StatusSection`): the complete action is now `FigmaFooterPrimaryButton` (`label = tasks.markComplete` → "تم الإنجاز" / "Mark complete") — the same proven filled-teal CTA as every save button — **stacked full-width** above the quiet secondary `FigmaButton variant="secondary"` (`tasks.markUnable` → "تعذّر الإنجاز"). No faint/disabled primary styling remains. Confirmation-sheet copy and the rest of the prior hotfix are unchanged.

---

## 5. Task visibility — final behavior

- **Manager:** all tasks; today/open/done; full add/edit/status/delete (unchanged).
- **family_member:** sees only tasks **assigned to them** or **completed by them** (history). **Unassigned open tasks are no longer shown** (the prior hotfix had included them; removed this pass). Scope note now reads "تظهر هنا المهام المُسندة إليك فقط." / "Showing only tasks assigned to you." `canActOn` and the detail `canAct`/`canUpdateStatus` are assignee-only (no unassigned pick-up).
- **remote_member:** read-only full list; no quick-complete circle, no cancel X, no detail status buttons.
- **Confirmation behavior preserved:** tapping a card opens detail; tapping the complete circle opens the confirmation sheet; no instant complete.

Unassigned tasks are **manager-only** this pass (no "available to claim" workflow — explicitly out of scope).

---

## 6. Medication / dose visibility and registration gating

- `DoseItem` now carries `responsibleUserId` (from `medications.responsible_user_id`), threaded in `computeDoseItems` — doses are derived from schedules (which lack the field), so this join was required.
- **Medications screen (`figma-medications.tsx`), Today tab:** family sees only doses for meds they are responsible for (`visibleDoses`); the given/total summary reflects that scope. The register button (and the given/postponed/missed action row) is gated `canLog && (canManage || dose.responsibleUserId === userId)` — family **cannot register** doses for meds they aren't responsible for, and **cannot see/register unassigned** (null-responsible) doses (managers still see/register all).
- **Home dashboard (`figma-home.tsx`):** the care-loop ring, next-dose preview, dose strip, and today's-doses list with inline register are all scoped to `visibleDoses`; register gated the same way.
- **The "All medications" catalog tab is intentionally left visible** to everyone (it is reference data — names/schedules — not an operational dose action). Only the operational **dose** surface is scoped, matching the QA finding.
- remote_member: `canLog` false ⇒ no register affordance anywhere.

---

## 7. Appointment visibility behavior

- `care_appointments.assigned_to` (already on the row). `FigmaAppointments` gained a `canCollaborate` prop (wired from `circle.canLogDoses` in `appointments/index.tsx`).
- **Manager:** all appointments; add/edit/status (unchanged — these were already `canManage`-only).
- **family_member:** sees only appointments `assigned_to` them (both upcoming/completed tabs). Home next-appointment preview + today-appointment count are scoped identically (computed from the filtered list via `countAppointmentsToday`).
- **remote_member:** sees all read-only; no add/edit/status (appointment actions are manager-only). Deep-linking to a detail yields the read-only view (the editor already branches on `canManage`).

---

## 8. Visit visibility behavior

- `family_visits.visitor_user_id` (already on the row). `FigmaVisits` already received `canManage`/`canCollaborate` and `userId`.
- **Manager:** all visits (unchanged).
- **family_member:** sees only visits linked to them (`visitor_user_id === userId`), across upcoming/recent tabs. The create-flow self-link for collaborators is **preserved** (`visit-form.tsx` forces own-account link). Editing/status/delete of their **own** visit is preserved (`visit-editor.tsx`: `canEdit = canManage || (canCollaborate && isOwner)`; non-owned → read-only view).
- **remote_member:** read-only; `canAdd`/`canEdit` false ⇒ no actions.

---

## 9. UI-only — RLS hardening still required (server-side enforcement)

**This pass is frontend/UI scoping only.** Every change is a client-side `Array.filter` / affordance gate over data the backend still returns in full (`fetch*` use `select('*')` by circle). A user who tampers with the client or calls the API directly could still read or mutate out-of-scope rows. **True enforcement requires a later RLS pass** that restricts, server-side, which tasks/appointments/visits/medication-doses each role may `select`/`insert`/`update` (e.g. family_member limited to rows where the responsibility column = `auth.uid()`, and dose `insert` allowed only for responsible medications). The dose `insertLog`/`updateLogStatus` mutations are currently gated only in the UI. **Until that RLS pass lands, this scoping is a UX/least-surprise layer, not a security boundary.**

---

## 10. Constraint confirmation

- **No** Supabase CLI; **no** SQL / RLS / migration / Edge Function / schema change. All `api.ts` query/mutation code is untouched; visibility is pure client-side filtering of existing `fetch*` results.
- **No** backend logic, env, dependency, `package.json`, Expo-config, native, or build change. **No** EAS, **no** prebuild. No new packages.
- **No** secrets read/written; no `.env` touched.
- **No** new roles; `caregiver`/`elder` not activated. **Not** implemented: "أنا متكفل"/claim RPC, notifications, escalation, WhatsApp/contact import, prayer-time logic.
- Stayed inside `E:\Projects\sanad-mobile`. **Not committed, not staged.**

---

## 11. Validation results

| Check | Result |
| --- | --- |
| `npm run check:mojibake` | ✅ scanned 261 files — no strong mojibake signatures. |
| `git -c core.autocrlf=false diff --check` | ✅ clean. |
| `npx tsc --noEmit` | ✅ exit 0 — no type errors (incl. the `DoseItem` field addition). |
| `npx expo-doctor` | ✅ 21/21 checks passed. |

`git --no-pager status --short`:

```
 M src/app/(app)/appointments/index.tsx
 M src/features/appointments/figma-appointments.tsx
 M src/features/care-circle/figma-home.tsx
 M src/features/medications/figma-medications.tsx
 M src/features/medications/today.ts
 M src/features/tasks/figma-tasks.tsx
 M src/features/tasks/task-editor.tsx
 M src/features/visits/figma-visits.tsx
 M src/locales/ar.json
 M src/locales/en.json
?? docs/claude-reports/2026-06-26-phase-2b-task-action-ux-hotfix.md
?? docs/claude-reports/2026-06-26-phase-2b-strict-operational-scoping.md
```

`git --no-pager diff --stat` (cumulative with the prior hotfix for the two task files + locales):

```
 src/app/(app)/appointments/index.tsx             |   6 +-
 src/features/appointments/figma-appointments.tsx |  14 +-
 src/features/care-circle/figma-home.tsx          |  30 ++-
 src/features/medications/figma-medications.tsx   |  21 +-
 src/features/medications/today.ts                |   4 +
 src/features/tasks/figma-tasks.tsx               | 281 +++++++++++++++------
 src/features/tasks/task-editor.tsx               |  54 +++--
 src/features/visits/figma-visits.tsx             |  12 +-
 src/locales/ar.json                              |  11 +-
 src/locales/en.json                              |  11 +-
 10 files changed, 322 insertions(+), 122 deletions(-)
```

---

## 12. Android QA checklist (S24 Ultra · Arabic · RTL · dark mode)

Use the dummy QA users (manager, family_member assignee, remote_member). Assign one task / appointment / visit / medication to the family_member; leave others assigned elsewhere or unassigned.

1. **family_member sees only assigned tasks** — Tasks list shows only tasks assigned to them (+ their completed history); scope note "تظهر هنا المهام المُسندة إليك فقط." present.
2. **family_member does not see unassigned tasks by default** — an open task with no assignee does **not** appear for the family_member (it still appears for the manager).
3. **family_member cannot register doses for meds they're not responsible for** — Today doses (Medications screen **and** Home) show only doses for meds where they are `responsible_user_id`; no "سجّل"/register button on others; unassigned-responsible doses not shown to them. Manager still sees/register all.
4. **family_member sees only assigned appointments** — Appointments list (both tabs) and Home next-appointment/today-count show only appointments `assigned_to` them.
5. **family_member sees only linked visits** — Visits list (upcoming/recent) shows only visits where they are the `visitor_user_id`.
6. **remote_member has no operational action buttons** — no task complete/cancel, no dose register, no appointment/visit status actions anywhere; lists are read-only.
7. **task detail "تم الإنجاز" is filled teal/green and works** — open a task assigned to the family_member; banner reads "يمكنك تحديث حالة المهمة فقط"; the **filled teal** "تم الإنجاز" CTA completes the task; secondary "تعذّر الإنجاز" is clearly the quiet option. Verify it is **not** dark/disabled in dark mode.
8. **manager still sees all** — manager sees all tasks/appointments/visits/doses and retains every add/edit/status/register/delete action.

Also re-verify (no regressions): confirmation sheet still gates row quick actions; RTL/Arabic intact; Western digits; date/time pickers still render; no mojibake; dark mode.

---

## 13. Open questions / follow-ups

- **RLS hardening (required for real enforcement)** — see §9. The single most important follow-up.
- **Home task count not scoped.** The Home "tasks due today" stat is still a circle-wide aggregate (the home has no task *item* preview, only a number, so no item details leak). Appointment count + next-appt and all dose surfaces **are** scoped. Scoping the task count would mean threading scope into `useTodayTaskSummary` — deferred to keep this pass bounded.
- **remote_member still sees full read-only lists** (consistent with the prior task hotfix). Policy preferred "summary/read-only only"; reducing remote to summary-only is a larger IA change, deferred. No actions are exposed to them today.
- **Medication "All" catalog tab** stays visible to all roles (reference data). If product wants the catalog itself scoped, that's a separate decision.
- **"Available to claim" (متاح للتكفل)** workflow for unassigned items — explicitly not implemented; unassigned items are manager-only for now.
