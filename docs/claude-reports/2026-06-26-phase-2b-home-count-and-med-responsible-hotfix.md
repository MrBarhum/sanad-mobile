# Phase 2B-hotfix-3 — Home task due-today count scoping + medication responsible labels

**Baseline:** continues the uncommitted Phase 2B strict-operational-scoping working tree (`daed1ef feat(product): add assignment responsibility UI` + the two prior 2026-06-26 hotfix reports).
**Scope:** Frontend/UI only. **No** SQL / RLS / migration / backend / dependency / Expo-config / EAS / prebuild / seed change. **Not committed, not staged.**

This pass closes the two follow-ups the strict-scoping report left open (§13): "Home task count not scoped" and surfacing responsibility on the manager dose/medication UI.

---

## 1. Exact files changed (this pass)

| File | Change |
| --- | --- |
| `src/features/tasks/hooks.ts` | `useTodayTaskSummary(circleId, scopeToUserId?)` — added an optional `scopeToUserId`. When set, the summary is computed over only the tasks `assigned_to === scopeToUserId` before `summarizeTodayTasks`. Managers pass `null` (whole circle). Backward compatible (2nd arg optional). |
| `src/features/care-circle/figma-home.tsx` | **(A)** Pass `scopeToMine ? userId : null` into `useTodayTaskSummary`, so the "مستحقة اليوم" stat is scoped like the dose/appointment summaries already are. **(B)** Added the manager-only responsible label to each `DoseRow` (`responsibleText`, rendered under the meta row with a `Users` glyph) + two styles. |
| `src/features/medications/figma-medications.tsx` | **(B)** Swapped `useMemberLookup` → `useResponsibleLabel`. `DoseCard` gained a `responsibleText` prop (manager-only) rendered under the dose meta row. `MedicationRow`'s `responsibleName` → `responsibleText`, now the full localized line and **manager-gated** (was a bare name shown to everyone). |
| `src/features/circle-members/member-assignment.tsx` | **(B)** Extended `ResolvedMember` with `role` + localized `roleLabel`; `useMemberLookup` now populates them. Added `useResponsibleLabel(circleId)` → `(userId) => string` producing the one-line label (`غير مسند` / `المسؤول: أنا` / `المسؤول: <name> - <role>`), reusing the existing email-safe naming. |
| `src/locales/ar.json`, `src/locales/en.json` | Added `assignment.unassigned`, `assignment.responsibleValue` (`المسؤول: {{value}}`), `assignment.nameWithRole` (`{{name}} - {{role}}`). (The other keys in the diff — `tasks.markComplete`, `…scopeNote`, etc. — are pre-existing from hotfix-2, shown only because they share the file.) |

No other files were touched. Role display names reuse the existing `circleMembers.roles.*` strings (no new role copy).

---

## 2. Root cause — why family1's Home task count showed 11

The Home screen has two scoped summaries (doses, appointments) gated by
`scopeToMine = !circle.canManage && circle.canLogDoses`, but the **task** stat was never scoped:

```tsx
// before
const { summary: taskSummary } = useTodayTaskSummary(circle.circleId);
...
value={String(taskSummary.dueToday)}
```

`useTodayTaskSummary` fetched the **whole circle's** tasks (`useTasks` → `select('*')` by circle, the full RLS set) and ran `summarizeTodayTasks` over all of them. `summary.dueToday` therefore counted **every open task due today in the circle** — for the QA seed that is 3 (family1) + 3 (family2) + 2 (primary1) + 3 (unassigned) = **11** — and rendered identically for every role. The detailed tasks list *was* already scoped (hotfix-2's `isMine` filter in `figma-tasks.tsx`), so the list showed family1 their 3 tasks while the Home stat still showed 11 — the exact mismatch reported. This was the deferred "Home task count not scoped" item from the strict-scoping report §13 (it had noted only a number leaks, no task details — still a correctness/consistency bug).

**Fix:** scope the count at the same boundary the rest of Home uses. The summary now filters to `assigned_to === userId` for collaborators before counting; managers still count the whole circle. `summarizeTodayTasks` already counts only `status === 'open'` tasks toward `dueToday`, so completed/cancelled tasks are never counted, and unassigned tasks (`assigned_to === null`) never match a real `userId`, so they are excluded for family members.

---

## 3. Final Home task due-today count behavior, by role

| Role | `scopeToUserId` passed | Counts | QA seed expectation |
| --- | --- | --- | --- |
| `admin` | `null` (manager) | all open tasks due today in the circle | **11** |
| `primary_caregiver` | `null` (manager) | all open tasks due today in the circle | **11** |
| `family_member` (family1) | their `userId` | only open tasks due today `assigned_to` them | **3** |
| `family_member` (family2) | their `userId` | only open tasks due today `assigned_to` them | **3** |
| `remote_member` | `null` | not a collaborator (`canLogDoses` false), so unscoped — but remote has no QA tasks of its own; it sees the circle-wide number read-only with no task actions | 11 (read-only) |

Notes:
- Unassigned open tasks are **excluded** for family members (manager-only), matching policy.
- Completed/cancelled tasks are never counted toward `dueToday`/`openTotal` (unchanged `summarizeTodayTasks` semantics).
- `remote_member` keeps the existing read-only behavior (consistent with the rest of the Phase 2B passes — remote scoping to summary-only remains a deferred IA decision, and no remote action affordances exist).

---

## 4. Medication / dose responsible labels — how they display

A new `useResponsibleLabel(circleId)` resolver maps a `responsible_user_id` (or any assignee id) to one localized, **email-free** line, built on the existing `useMemberLookup`:

| Situation | Rendered text (ar) | Rendered text (en) |
| --- | --- | --- |
| Unassigned (`responsible_user_id` null) | `غير مسند` | `Unassigned` |
| Current user is responsible | `المسؤول: أنا` | `Responsible: Me` |
| Another active member | `المسؤول: سارة - مقدّم الرعاية الأساسي` | `Responsible: Sara - Primary caregiver` |
| Unknown / since-removed id | `المسؤول: عضو` | `Responsible: Member` (never an email) |

Where it shows:
- **`figma-medications.tsx` — Today dose cards** and **All-tab medication rows**: shown **only when `canManage`** (`responsibleText={canManage ? responsibleLabel(...) : null}`), rendered as a muted row with a `Users` glyph under the existing content.
- **`figma-home.tsx` — Today's-doses list rows**: same manager-only label added under each dose row's meta line.

By role:
- **Managers (`admin`, `primary_caregiver`):** see the responsible person (name + role) on every dose card and medication row, including `غير مسند` for unassigned meds — so a manager can see at a glance who owns each dose.
- **`family_member`:** label **omitted** (least-cluttered safe option). On the scoped dose surface they only ever see their own meds, so `المسؤول: أنا` on every card would be pure noise; the All-medications catalog stays clean reference data. (Previously the All tab showed a bare responsible name to everyone — now manager-gated, a deliberate de-clutter, not a data change.)
- **`remote_member`:** not a manager ⇒ no responsible labels and no action buttons (read-only, unchanged).

Role names come from the existing `circleMembers.roles.*` localization; no emails are ever rendered (the resolver falls back to the neutral `عضو` / `Member`).

---

## 5. Notifications — NOT implemented (note only)

No notification code was written in this pass. **Future medication reminder routing** (dose due / missed / postponed reminders) **should target `medications.responsible_user_id`** as the recipient: the responsible member is the operational owner of that medication's doses, mirroring this UI scoping (family members already only see/act on doses for meds they are responsible for). For unassigned meds (`responsible_user_id` null), reminders should fall back to managers (`admin` / `primary_caregiver`), consistent with "unassigned operational items are manager-only." `remote_member` must never receive operational dose reminders. Tasks/appointments/visits would route on their own responsibility fields (`assigned_to` / `assigned_to` / `visitor_user_id`) by the same rule. Implementing this requires the deferred server-side work (a reminder scheduler + the RLS-hardening pass) and is explicitly out of scope here.

---

## 6. Preserved strict scoping (no regressions)

- **Task row confirmation** (hotfix-2 confirmation sheet / detail CTA): untouched — only the Home *count* hook signature changed; `figma-tasks.tsx` / `task-editor.tsx` were not edited this pass.
- **Family task list filtering** (`isMine` = assigned-to-me or completed-by-me): untouched.
- **Medication dose filtering + register gating** (`scopeToMine` visibleDoses; `canLog && (canManage || responsible === me)`): untouched; the responsible label is additive display only.
- **Appointments / visits filtering:** untouched.
- **Remote read-only:** untouched — no new action affordances; responsible labels are manager-gated so remote sees none.
- **Seed SQL:** not touched.

---

## 7. Confirmation — no backend/config changes

- **No** Supabase CLI, SQL, RLS, migration, Edge Function, or schema change. `useTasks`/`useTodayDoses`/member queries are unchanged (`select('*')` by circle); all scoping is client-side `Array.filter` / render gating.
- **No** backend logic, `.env`/secret, dependency, `package.json`, Expo-config, native, EAS, or prebuild change. No new packages.
- **No** new roles activated; responsibility is only **displayed**, never assigned (no writes to `responsible_user_id`).
- Stayed inside `E:\Projects\sanad-mobile`. **Not committed, not staged.**

> Caveat (unchanged from hotfix-2 §9): this remains **UI-only** scoping over data the backend still returns in full. True enforcement still requires the later RLS pass.

---

## 8. Validation results

| Check | Result |
| --- | --- |
| `npm run check:mojibake` | ✅ scanned 261 files — no strong mojibake signatures. |
| `git -c core.autocrlf=false diff --check` | ✅ clean (exit 0). |
| `npx tsc --noEmit` | ✅ exit 0 — no type errors (incl. the additive `ResolvedMember` fields, consumed elsewhere via `.label` only). |
| `npx expo-doctor` | ✅ 21/21 checks passed. |

`git --no-pager status --short`:

```
 M src/app/(app)/appointments/index.tsx
 M src/features/appointments/figma-appointments.tsx
 M src/features/care-circle/figma-home.tsx
 M src/features/circle-members/member-assignment.tsx
 M src/features/medications/figma-medications.tsx
 M src/features/medications/today.ts
 M src/features/tasks/figma-tasks.tsx
 M src/features/tasks/hooks.ts
 M src/features/tasks/task-editor.tsx
 M src/features/visits/figma-visits.tsx
 M src/locales/ar.json
 M src/locales/en.json
?? docs/claude-reports/2026-06-26-phase-2b-strict-operational-scoping.md
?? docs/claude-reports/2026-06-26-phase-2b-task-action-ux-hotfix.md
?? docs/claude-reports/2026-06-26-qa-seed-operational-data-sql.md
?? docs/claude-reports/2026-06-26-phase-2b-home-count-and-med-responsible-hotfix.md
```

`git --no-pager diff --stat`:

```
 src/app/(app)/appointments/index.tsx              |   6 +-
 src/features/appointments/figma-appointments.tsx  |  14 +-
 src/features/care-circle/figma-home.tsx           |  53 +++-
 src/features/circle-members/member-assignment.tsx |  37 ++-
 src/features/medications/figma-medications.tsx    |  52 ++--
 src/features/medications/today.ts                 |   4 +
 src/features/tasks/figma-tasks.tsx                | 281 +++++++++++++++-------
 src/features/tasks/hooks.ts                       |  23 +-
 src/features/tasks/task-editor.tsx                |  54 +++--
 src/features/visits/figma-visits.tsx              |  12 +-
 src/locales/ar.json                               |  16 +-
 src/locales/en.json                               |  16 +-
 12 files changed, 424 insertions(+), 144 deletions(-)
```

> The diff --stat is cumulative with the prior Phase 2B hotfixes. **This pass** edited only these 6: `tasks/hooks.ts`, `care-circle/figma-home.tsx`, `medications/figma-medications.tsx`, `circle-members/member-assignment.tsx`, `locales/ar.json`, `locales/en.json`. The full `git --no-pager diff` for them is reproduced in the session output; `hooks.ts` and `member-assignment.tsx` are 100% this-pass, while the figma screens and locales also carry hotfix-2 hunks.

---

## 9. Android / web QA checklist (S24 Ultra · Arabic · RTL · dark mode)

Use the `[QA]`-seed circle `رعاية الوالد الغالي` and the dummy users.

1. **family1 Home task count shows 3, not 11** — log in as `sanad.qa.family1@example.com`; the Home "المهام / مستحقة اليوم" stat reads **3**.
2. **family2 Home task count shows 3** — as `sanad.qa.family2@example.com`, the stat reads **3**.
3. **admin/primary Home task count still shows 11** — as admin (`ibrahim.khalifeh91@gmail.com`) and primary (`sanad.qa.primary1@example.com`), the stat reads **11**.
4. **family1 tasks screen still shows only their 3 open tasks + own history** — the Tasks list is unchanged (3 assigned open + the completed-by-family1 row); scope note "تظهر هنا المهام المُسندة إليك فقط." present.
5. **Manager medication/dose cards show responsible names** — as a manager, the Medications **Today** dose cards and **All** rows, and the Home today-doses rows, each show `المسؤول: <name> - <role>` (e.g. family1's meds show family1's name; unassigned vitamin D shows `غير مسند`). No email is ever shown.
6. **family cannot register doses for meds they're not responsible for** — as family1, Today doses show only their meds with a register button; other/unassigned doses are not shown; no responsible label clutter on their cards.
7. **remote has no operational action buttons** — as `sanad.qa.remote1@example.com`: read-only lists, no task complete/cancel, no dose register, no appointment/visit status, and no responsible labels (manager-only).

Also re-verify (no regressions): family/manager dose filtering & register gating, appointment/visit scoping, task confirmation sheet, RTL/Arabic, Western digits, dark mode, no mojibake.

---

## 10. No commit / no stage

Nothing was committed or staged. The only new artifact is this report (plus the working-tree edits above). Work stopped after the report + status/diff.
