# Phase 2B-hotfix — Task action UX + role-aware task visibility

**Date:** 2026-06-26
**Baseline:** `daed1ef feat(product): add assignment responsibility UI`
**Scope:** Frontend (React Native / Expo) UI filtering, confirmation, copy, and button labels only. **No** Supabase / SQL / RLS / migration / backend / dependency / Expo-config / EAS / prebuild changes. **Not committed, not staged.**

---

## 1. Exact files changed

| File | Change |
| --- | --- |
| `src/features/tasks/figma-tasks.tsx` | Role-aware task scoping for non-managers; quick-complete **and** quick-cancel now open a confirmation sheet instead of mutating instantly; non-actionable checkbox falls through to open detail (no silent no-op); scope note + scoped empty state. |
| `src/features/tasks/task-editor.tsx` | Detail (read-only path) banner now distinguishes *can edit details* from *can update status*; status-action buttons relabelled (`تم الإنجاز` / `تعذّر الإنجاز`), primary kept as the always-filled teal CTA. |
| `src/locales/ar.json` | New keys only: `tasks.markComplete`, `tasks.markUnable`, `tasks.statusOnly`, `tasks.confirmCompleteTitle/Body`, `tasks.confirmUnableTitle/Body`, `figma.tasks.emptyMine`, `figma.tasks.scopeNote`. |
| `src/locales/en.json` | English mirror of the same new keys. |

No existing translation values were changed, so the legacy `src/features/tasks/tasks-center.tsx` (which still references `tasks.complete` / `tasks.cancelTask`) remains valid and untouched.

---

## 2. Current role / task-visibility behaviour found (before this pass)

- **Permission model** (`src/features/circle-selection/permissions.ts`), surfaced to the screens via `CircleGate` as two booleans:
  - `canManage` = `admin` | `primary_caregiver`.
  - `canCollaborate` (= `canLogDoses`) = `admin` | `primary_caregiver` | `family_member` | `caregiver`.
  - So role is derivable without new props: **manager** = `canManage`; **actionable non-manager** (family/caregiver) = `!canManage && canCollaborate`; **read-only** (remote/elder) = `!canManage && !canCollaborate`.
- **Task list** (`FigmaTasks`): fetched **all** circle tasks (`fetchTasks` → every row for the circle) and showed the same today/open/done view to **everyone**. A family member saw the whole circle's tasks by default.
- **Quick actions on a row:** tapping the round checkbox called `complete.mutateAsync` immediately; tapping the `X` called `cancel.mutateAsync` immediately — **no confirmation**. When the user couldn't act, the checkbox was a *disabled* `Pressable` that swallowed the tap (silent no-op — it didn't open detail).
- **Task detail** (`TaskEditor`): managers → editable `TaskEditScreen`; everyone else → `TaskViewScreen`, which always showed `tasks.readOnly` = "للعرض فقط — لا تملك صلاحية التعديل" even when the viewer was the assignee and **could** update status via the `StatusSection` complete/cancel buttons below it.
- **Detail action buttons:** `StatusSection` already rendered the complete action as `FigmaButton` `variant="primary"` (the design-system always-filled teal CTA — it cannot render a grey/disabled primary). Label was the generic `tasks.complete` = "إنجاز"; secondary was `tasks.cancelTask` = "إلغاء" (ambiguous with a dialog "cancel").

---

## 3. Task-row quick action — what changed

`src/features/tasks/figma-tasks.tsx`

- **Confirmation sheet, no instant mutation.** Tapping the round checkbox (complete) or the `X` (cancel) now sets a `confirm = { task, kind }` and opens a `FigmaBottomSheet` (`TaskConfirmSheet`):
  - **Complete:** title `تأكيد إنجاز المهمة؟`, body `هل تريد تعليم هذه المهمة كمُنجَزة؟`, the **task title shown on its own line**, primary **filled teal** CTA `تم الإنجاز`, secondary `إلغاء` (dismisses the sheet).
  - **Cancel / not-completed:** title `تأكيد تعذّر إنجاز المهمة؟`, body + task title, primary **danger** CTA `تعذّر الإنجاز` (consistent with the cancelled-status error tone), secondary `إلغاء`.
  - The actual `completeTask` / `cancelTask` mutation runs **only** from the sheet's primary button. On failure the sheet stays open for retry (not a silent fail); the dismiss button and backdrop are disabled while the action is in flight.
  - The sheet keeps a retained snapshot (`shown`) so the correct copy/colour persists during the slide-out animation after `confirm` clears (no wrong-variant flicker).
- **Affordance only when actionable.** The quick-complete checkbox is a `Pressable` only when `canActOn(task)`; the `X` is rendered only for `open && canAct`. `canActOn` is unchanged: `open && (canManage || (canCollaborate && (assigned == null || assigned == me)))`.
- **No silent failure when not actionable.** When the user cannot act, the checkbox is now a plain `View` with `pointerEvents="none"`, so the tap **falls through to the row** and opens task detail (previously a disabled `Pressable` ate the tap and did nothing).
- Removed the now-unused per-row `pending` plumbing (`pendingId`/`act`) in favour of the sheet's `acting` state.

---

## 4. Task-detail action buttons / copy — what changed

`src/features/tasks/task-editor.tsx`

- **Separated "can edit details" from "can update status".** `TaskViewScreen` now computes
  `canUpdateStatus = task.status === 'open' && canCollaborate && (assigned == null || assigned == me)`
  and shows:
  - `tasks.statusOnly` = **"يمكنك تحديث حالة المهمة فقط"** when the non-manager can act on this task, **instead of** the misleading "للعرض فقط — لا تملك صلاحية التعديل".
  - `tasks.readOnly` (unchanged copy) only when the viewer genuinely can't act (e.g. remote member, or someone else's assigned task, or a closed task).
- **Primary status action** (`StatusSection`): relabelled `tasks.complete` → **`tasks.markComplete` = "تم الإنجاز" / "Mark complete"**, kept as `FigmaButton variant="primary"` — the always-filled teal CTA. (The primitive guarantees a full-opacity teal fill; the prior "dark/disabled" impression came from the misleading read-only banner priming the whole screen as disabled plus the generic label — both now addressed.)
- **Secondary status action:** relabelled `tasks.cancelTask` → **`tasks.markUnable` = "تعذّر الإنجاز" / "Couldn't complete"**, kept as the quiet `secondary` variant so it reads as a clear, non-destructive-by-accident option (no longer the ambiguous bare "إلغاء").
- **No new status values / API change.** Still the existing `completeTask` (`status: 'completed'`) and `cancelTask` (`status: 'cancelled'`) flows — label-only and gating changes.

---

## 5. `family_member` / `remote_member` task visibility — what changed

`src/features/tasks/figma-tasks.tsx` — **UI filtering only; RLS untouched.**

- **Managers** (`canManage`): unchanged — full today / open / done over **all** circle tasks; the `+` add button; every quick/detail action.
- **Actionable non-managers** (`!canManage && canCollaborate` → `family_member` / `caregiver`): now default to **their** tasks via `scopeToMine`. A task is "mine" when:
  - it's **assigned to me**, or
  - I **completed it** (`completed_by == me`, so my history shows under *done*), or
  - it's an **unassigned open** task I'm allowed to pick up (matches `canActOn` for unassigned tasks — current product already lets family members act on these).
  - The today/open/done tabs operate within that scope; a muted **scope note** (`figma.tasks.scopeNote`) explains the view, and an empty result shows `figma.tasks.emptyMine` instead of the generic empty.
- **Read-only members** (`!canManage && !canCollaborate` → `remote_member` / `elder`): **unchanged** — they keep the existing full read-only list the product already exposes, with **no action affordances** (`canActOn` is false → checkbox is a non-interactive status dot, no `X`, no quick-complete; detail shows the read-only banner and no status buttons).

---

## 6. Constraint confirmation

- **No** Supabase CLI use; **no** SQL / RLS / migration / Edge Function / schema changes. `src/features/tasks/api.ts` and all DB queries are untouched — visibility is pure client-side filtering of the same `fetchTasks` result.
- **No** backend logic, environment, dependency, `package.json`, Expo-config, native, or build changes. **No** EAS, **no** prebuild. No new packages.
- **No** secrets read or written; no `.env` touched.
- Stayed entirely inside `E:\Projects\sanad-mobile`; no other project touched.
- **Not committed, not staged.** Only the four files above are modified in the working tree.

---

## 7. Validation results

| Check | Result |
| --- | --- |
| `npm run check:mojibake` | ✅ scanned 261 files — no strong mojibake signatures (no raw Unicode glyph literals added). |
| `git -c core.autocrlf=false diff --check` | ✅ clean (no whitespace/encoding issues). |
| `npx tsc --noEmit` | ✅ exit 0 — no type errors. |
| `npx expo-doctor` | ✅ 21/21 checks passed. |

`git --no-pager status --short`:

```
 M src/features/tasks/figma-tasks.tsx
 M src/features/tasks/task-editor.tsx
 M src/locales/ar.json
 M src/locales/en.json
```

`git --no-pager diff --stat`:

```
 src/features/tasks/figma-tasks.tsx | 278 ++++++++++++++++++++++++++-----------
 src/features/tasks/task-editor.tsx |  19 ++-
 src/locales/ar.json                |  11 +-
 src/locales/en.json                |  11 +-
 4 files changed, 232 insertions(+), 87 deletions(-)
```

---

## 8. Android QA checklist (S24 Ultra · Arabic · RTL · dark mode)

Use the dummy QA users in the Sanad Supabase project (one manager, one `family_member` assignee, one `remote_member`).

1. **Assigned family member sees the task** — sign in as the family member; the task assigned to them appears in *today*/*open* (and the muted "تظهر هنا المهام المُسندة إليك والمهام المتاحة فقط." note is shown). Tasks assigned to *other* members are **not** listed.
2. **Tapping the card opens details** — tapping the task row (including on the status dot of a non-actionable task) navigates to the task detail.
3. **Tapping the circle asks for confirmation** — tapping the round checkbox opens the bottom sheet (`تأكيد إنجاز المهمة؟` + the task title), and **does not** complete until `تم الإنجاز` is pressed; `إلغاء` dismisses with no change. Same for the `X` → `تأكيد تعذّر إنجاز المهمة؟`.
4. **Detail "تم الإنجاز" is a clear filled teal action and works** — open an assigned open task; the banner reads "يمكنك تحديث حالة المهمة فقط" (not "للعرض فقط…"); the primary button is a filled teal `تم الإنجاز` that completes the task; secondary `تعذّر الإنجاز` is clearly the quiet/secondary option. Verify it does **not** look dim/disabled in dark mode.
5. **Family member does not default to everyone else's tasks** — confirm the list is scoped to assigned-to-me + unassigned-open + my history, across all three tabs.
6. **Remote member is read-only** — sign in as the `remote_member`: list rows have **no** quick-complete circle and **no** `X`; opening a task shows the read-only banner and **no** status action buttons.

Also re-verify (no regressions): RTL/Arabic layout intact; Western digits in due times; date/time pickers still render (unchanged here); no mojibake anywhere on the tasks screens.

---

## 9. Open questions / suggested follow-ups

- **RLS alignment (next pass, explicitly out of scope here).** Visibility is currently UI-only; a family member could still fetch the full circle list at the data layer. If "family members only see their tasks" must be enforced, that's a separate RLS/policy task (not done here per instructions).
- **Optional "all tasks" toggle for family members.** Current behaviour scopes them with no escape hatch (the safest default). If product wants family members to *optionally* browse the whole circle, add a scope toggle in a later pass.
- **Quick-cancel from the list.** Kept (now confirmed) to preserve the manager experience. If product prefers cancellation to be detail-only, the row `X` can be removed in a follow-up.
- **Action-error surfacing.** On a failed quick action the sheet stays open for retry but shows no explicit error text (matches the existing detail-screen behaviour). A small inline error line could be added app-wide for task mutations.
