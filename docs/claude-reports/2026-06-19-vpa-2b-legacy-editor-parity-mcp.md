# VPA-2b — Legacy Editor Parity (edit screens)

**Date:** 2026-06-19
**Phase:** VPA-2b — port the four legacy edit screens to the accepted Figma editor pattern. Edit screens only.
**Mode:** Edit. **No commit. No stage.** No EAS / prebuild / Supabase / backend / schema / auth / SQL / edge-function / env / dependency / route / navigation changes.
**Baseline:** branch `master`, working tree **clean** at start, HEAD `8ce4e90 docs(ui): audit form screens with Figma MCP` (VPA-2). Gate `git status --short` → clean.

## Headline
All four legacy editors — **task, medication, appointment, visit** — were re-platformed from the legacy `Screen` / `FormActions` / fieldset shell onto the Figma editor pattern (`FigmaFormScreen` + `FigmaFormCard` + body-rendered `FigmaFooterPrimaryButton`), mirroring the already-ported `vital-editor` / `log-editor` and each entity's add-form. **All save / update / delete / status / schedule / permission logic is preserved unchanged** — only the shell, cards, fields, and CTA were restyled. A 4-agent adversarial review confirmed every hard invariant on all four; the one defect it found (a status-label color regression in dark mode) was fixed in all editors.

---

## 1. Figma Make source used

| Field | Value |
|---|---|
| **Canonical link** | `https://www.figma.com/make/nIeplIvufiFjoJBZxC7zbX/Mobile-app-design-upload?t=Au75XfxmDZu83NM2-6` |
| **Form designs read from** | `MpgXzFWQpGYbO7x4S7HCgd` (`--Copy-`, the only file containing `Add*` screens) |
| **MCP read?** | **Yes — live this session** (`get_design_context` 0:1 + `ReadMcpResourceTool`). |

The canonical file has **no edit screens** (and no `Add*` screens). Per the task ("if edit-specific Figma screens do not exist, use the matching add form design as the visual source and preserve edit-only behavior"), the visual source for each editor is its **app add-form** (already Figma-faithful) and the **already-ported `vital`/`daily-log` editors** as the implementation reference; the `--Copy-` `Add*` screens were read live via MCP for section order/copy confirmation.

### Figma MCP resources/screens inspected (live)
- `AddTaskScreen.tsx`, `AddMedicationScreen.tsx`, `AddAppointmentScreen.tsx`, `AddVisitScreen.tsx`, `AddDailyLogScreen.tsx` (`--Copy-` `src/app/components/`) — for section order, card grouping, field order, and the 52dp teal footer-save pattern.
- Required reports read & used: `2026-06-19-figma-mcp-full-visual-parity-audit.md`, `2026-06-19-vpa-1a-shared-primitives-mcp.md`, `2026-06-19-vpa-2-form-screens-mcp.md`.

### App reference files inspected (read-only, not edited)
`vital-editor.tsx`, `log-editor.tsx` (the ported pattern), the four add-forms + field fragments (`task-form`, `medication-form`, `appointment-form` + `figma-appointment-fields`, `visit-form` + `figma-visit-fields`), `figma-form-screen.tsx`, `schedule-summary.tsx`, the `[id].tsx` routes, and `en.json` (to confirm every reused `t()` key — `*.detailTitle`, `*.readOnly`, etc. — already exists; **no locale edits**).

---

## 2. Files changed (4)

`git diff --stat` → **4 files changed, 814 insertions(+), 643 deletions(-)**:
```
 src/features/appointments/appointment-editor.tsx | 261 ++++------
 src/features/medications/medication-editor.tsx   | 422 +++++--------
 src/features/tasks/task-editor.tsx               | 506 +++++---------
 src/features/visits/visit-editor.tsx             | 268 ++++------
```
`vital-editor.tsx` and `log-editor.tsx` (allowed only for reference extraction) were **not modified**. No add-forms, field fragments, routes, locales, schemas, hooks, or shared primitives were touched.

---

## 3. Per-editor summary of what was ported

Common to all four: `Screen`→`FigmaFormScreen` (own header + back chevron; native header hidden via `Stack.Screen headerShown:false` in the loader, exactly like vital/log); each section wrapped in a `FigmaFormCard`; legacy `Button`/`FormActions` save bar → body-rendered `FigmaFooterPrimaryButton`; legacy `Button` actions → `FigmaButton` (primary/secondary/danger); status/delete two-step kept in their own cards; a read-only `ViewScreen` for non-editors; `UnsavedChangesGuard`, `useUnsavedChanges`, validation, and every mutation **call preserved verbatim**.

### Appointment editor (`appointment-editor.tsx`)
- `AppointmentEditScreen` mirrors the add-form: `FigmaMutedNote` disclaimer + **`FigmaAppointmentFields`** (the same fragment the add-form uses → identical 4-card layout, real `APPOINTMENT_TYPES` chips, real doctors) → status card → delete card → body save CTA.
- Save unchanged: `prepareAppointment(draft)` → `update.mutateAsync({ id, patch: prepared.input })`. Status (`useSetAppointmentStatus`: complete/cancel/reopen, gated by `canManage`) and two-step delete (`useDeleteAppointment`) preserved. Non-managers get `AppointmentViewScreen` (read-only cards + status badge, no actions/CTA).

### Visit editor (`visit-editor.tsx`)
- `VisitEditScreen` wraps **`FigmaVisitFields`** (same fragment as the add-form, including the **optional start/end times**) in a card → status → delete → body CTA.
- Save unchanged and **account link preserved**: `prepareVisit(draft)` → `update.mutateAsync({ id, patch: { ...prepared.value, visitor_user_id: initial.visitor_user_id } })`, so RLS (own-visit / manager) still holds. `canEdit = canManage || (canCollaborate && isOwner)` gating, status (`useSetVisitStatus`), and delete (`useDeleteVisit`) preserved. Non-editors get `VisitViewScreen`.

### Task editor (`task-editor.tsx`)
- `TaskEditScreen` rebuilds the add-form's section order with inline cards: main-info (title, description, **category** chips, **priority** chips) → due-date/time card (`الموعد النهائي`, date 2 : time 1) → assignee card → notes card → status card → delete card → body CTA.
- **Data flow preserved deliberately:** the editor keeps its existing **assign-to-me toggle** (`assigned_to = assignToMe ? userId : null`), rendered as a `FigmaToggleRow` — it does **not** adopt the add-form's real-member picker (that would change behavior). Save unchanged: `taskSchema.safeParse(...)` → `update.mutateAsync({ id, patch })`. Status (`useCompleteTask`/`useCancelTask`, full `canAct` gating + completed/cancelled timestamps) and delete (`useDeleteTask`) preserved. Non-managers get `TaskViewScreen` (read-only + status; collaborators can still complete/cancel).

### Medication editor (`medication-editor.tsx`)
- Multi-section management screen (not a single-submit form). `FigmaFormScreen` + gold disclaimer banner → **medication-info `FigmaFormCard`** mirroring the add-form's info card (name/dosage/form/instructions + `with food` `FigmaSwitch` row with divider) → **info save CTA** (body `FigmaFooterPrimaryButton`, placed after the info card since the save scopes to the info section) → activation card → **dose-schedule manager** → delete card.
- **Schedule editing behavior fully preserved:** `SchedulesManager` keeps `ScheduleSummary` (its own surface, rendered directly), per-schedule cards (now `FigmaFormCard` + `StatusBadge` + `ItemActions` edit/delete), activate/deactivate (`useSetScheduleActive`), delete (`useDeleteSchedule`), add/edit via **`ScheduleModalHost`** (unchanged), and the empty state. No medication data fields invented. Save (`medicationSchema` → `useUpdateMedication`), activation (`useSetMedicationActive`), and two-step medication delete (`useDeleteMedication`) all unchanged. Non-managers get read-only info + read-only schedule cards.

---

## 4. Save / delete behavior preserved

Confirmed by the adversarial diff review (old→new) on each file: every `*.mutateAsync(...)` call (update / delete / status / activate / schedule add-edit-delete) has **identical arguments** to the pre-port version; the validation (`taskSchema`/`medicationSchema`/`prepareAppointment`/`prepareVisit`) is unchanged; permission gating expressions (`canManage` / `canCollaborate` / `canEdit` / `isOwner` / `canAct`) are identical; two-step delete (confirm → `confirmDelete` danger + cancel → `mutateAsync(id)` → `router.back()`) is intact; and each read-only path is preserved. Only JSX/shell/styles changed.

## 5. CTA confirmation

Every editable editor's save CTA is a **body-rendered `FigmaFooterPrimaryButton`** — teal (`theme.primary`), a plain `Pressable`, **loading-gated only** (no `disabled`/faint/grey validation state; an invalid press runs validation → inline errors), rendered as a body block (verified **not** passed to `FigmaFormScreen`'s `footer` prop — `grep 'footer='` is empty across all four; no sticky/KAV footer). For the single-form editors (task/appointment/visit) it is the final block after the status + delete cards; for the medication management screen it sits with the info section it saves. Status actions and delete use teal/secondary/`danger` `FigmaButton`s. Read-only view screens correctly have no CTA. The dark-mode status-label color regression flagged by review was fixed (`statusLabel` now carries `theme.text`).

## 6. No backend / infra changes

Only the 4 editor `.tsx` files changed. **No** Supabase / backend / schema / auth / SQL / edge-function / hook / mutation-shape / data-fetching / route / navigation / locale / dependency / Expo-config / `.env` / EAS / prebuild / shared-primitive changes. Teal + Cairo + warm-dark preserved; no blue reintroduced; RTL/Arabic preserved (`ChevronRight` back via `FigmaFormScreen`, `isolateLtr` timestamps, no forced text alignment). Nothing staged; nothing committed.

## 7. Validation results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **clean** — 260 active files, no signatures |
| `git -c core.autocrlf=false diff --check` | **exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| `npx expo-doctor` | **21/21 checks passed** |

**Adversarial review (4-agent workflow):** 4/4 returned; **all hard invariants pass on all four** (`behaviorPreserved`, `ctaCompliant`, `noForbiddenChange`, `rtlPreserved` = true). Appointment & visit clean; task & medication flagged one **low** cosmetic dark-mode `statusLabel` color bug — **fixed** in all four, then re-validated (tsc/mojibake/diff-check all green).

## 8. Android QA checklist (edited editors)

Test in **dark + light**, RTL/Arabic, as a manager and as a non-manager/collaborator:

**Task edit (`tasks/[id]`)**
1. Opens with the Figma header (own back chevron, no double native header); cards in add-form order (info → due → assignee → notes).
2. Edit fields → teal "save changes" (body, after status+delete) persists; invalid (empty title) shows inline error, CTA stays filled.
3. "Assign to me" toggle still sets/clears assignment (assign-to-me semantics, not a member list).
4. Status card: **complete / cancel** work for an open task with correct gating; completed/cancelled timestamp shows; **"Status" label is legible in dark mode**.
5. Two-step delete confirms then returns. Non-manager sees read-only + status (collaborator can complete/cancel), no save/delete.

**Medication edit (`medications/[id]`)**
1. Gold non-diagnostic banner; info card (name/dosage/form/instructions + with-food switch); teal save persists info; invalid name → inline error.
2. **Schedules**: summary renders; each schedule card shows days/times/range/status; **schedule number legible in dark mode**; add/edit opens the schedule modal and saves; activate/deactivate and delete a schedule work; empty state shows when none.
3. Activate/deactivate the medication; two-step medication delete returns. Non-manager: read-only info + read-only schedule cards.

**Appointment edit (`appointments/[id]`)**
1. `FigmaAppointmentFields` cards (title+type, date+start/end, location+doctor, notes); real appointment types + doctors; teal save persists; invalid → inline errors.
2. Status: mark completed / cancelled / reopen (manager); badge legible. Two-step delete returns. Non-manager: read-only + status badge.

**Visit edit (`visits/[id]`)**
1. Card with visitor name → date → **optional start/end times** → notes; teal save persists and **keeps the account link** (visit still shows under the right account); invalid → inline errors.
2. Status: completed / cancelled / reopen with correct gating; two-step delete returns. Collaborator on own visit can edit; others read-only.

**Cross-cutting:** no double headers; CTAs always visible filled teal; no blue; no mojibake; date/time wheel pickers + Western digits/LTR isolation intact.

**Stopping here per instructions: no commit, no stage.**
