# Phase MS-1B — Exact-copy rebuild: Add Task, Add Appointment, Add Visit, Add Daily Log

**Date:** 2026-06-17
**Scope:** Rebuild `/tasks/new`, `/appointments/new`, `/visits/new`, `/daily-logs/new` from the Figma Make export, following the QA-approved MS-1A approach. **Not staged, not committed.**
**Refs:** `docs/claude-reports/2026-06-16-missing-screens-export-analysis.md`, `docs/claude-reports/2026-06-17-ms-1a-exact-add-medication-vital.md`, `docs/claude-reports/2026-06-17-ms-1a-qa-patch-vital-chips-dates-12h-time.md`.

---

## 1. Summary

Four more add screens rebuilt as **true Figma screen compositions** on the MS-1A shell (`FigmaFormScreen` + `FigmaFormCard` + `FigmaFormField` + `FigmaChipSelect` + new `FigmaToggleRow`/`FigmaMutedNote`): a fixed header, grouped radius-16 cards, raised teal-focus inputs, teal pill chips, and a sticky teal save — replacing the old flat-form compositions. The export's hardcoded **blue `#2F6FD0` + IBM Plex + native HTML date/time/`<select>`** are NOT copied — it's the committed **teal + Cairo**, the **protected wheel pickers**, and the **12-hour Arabic `TimeField`** (which still stores `HH:MM`).

Every screen keeps Sanad's real logic verbatim and **rejects the export's unsafe/invented bits**:
- **Task** — Sanad's **assign-to-me toggle** (real `user.id`), not the export's invented assignee dropdown (سارة/خالد/نورة); plus Sanad's category selector + notes the export omits.
- **Appointment** — the **real doctors list** (`useDoctors`) + "بدون طبيب", not the export's hardcoded doctors (الحربي/الزهراني/الغامدي); required date + start, optional end, end-before-start via schema.
- **Visit** — the **RLS-correct** self-link control: the toggle shows **only to managers**, collaborators get a static note (the export showed the toggle to everyone); optional start/end times preserved.
- **Daily Log** — the **"غير محدّد" unset** option on every chip group (maps to null) and the **distinct "بدون" pain state** (null) vs an observed 0 — both omitted by the export; gold non-diagnostic banner + all 4 note fields + the one-log-per-date conflict message.

Shared fieldsets (used by the edit flows), all schemas/hooks, and every approved center screen are untouched. The one shared-shell change (`figma-form-screen.tsx`) is additive (optional banner + two helpers) and does **not** alter the QA-approved `/medications/new` or `/vitals/new`.

An adversarial 4-verifier review (task · appointment · visit · log+boundary), each prompted to *refute* parity/preservation against the export and `HEAD`, returned **pass** on all four with one intentional, documented `concern` (§7).

---

## 2. Figma files inspected

- `…/AddTaskScreen.tsx` — header (no banner), main-info card (title/description/priority), due-date card, assignee `<select>` (invented names), sticky save.
- `…/AddAppointmentScreen.tsx` — header, main-info (title + type chips), date/time card (required date + start, optional end), location + doctor `<select>` (invented), notes, sticky save.
- `…/AddVisitScreen.tsx` — header, single card (visitor name, date + time, notes, link-to-account toggle), sticky save.
- `…/AddDailyLogScreen.tsx` — header + subtitle, gold disclaimer, date card, observational chip groups, pain stepper (0–10, no "none"), notes, sticky save.

---

## 3. Files changed

**New (3 figma fieldsets):**
- `src/features/appointments/figma-appointment-fields.tsx` — `FigmaAppointmentFields` (main-info, date/time, location+doctor, notes; real doctors).
- `src/features/visits/figma-visit-fields.tsx` — `FigmaVisitFields` (name, date, optional start/end, notes; returns a fragment so the form wraps it with the RLS toggle).
- `src/features/daily-logs/figma-daily-log-fields.tsx` — `FigmaDailyLogFields` (date, 5 chip groups w/ unset, pain card w/ "بدون", 4 notes).

**Modified:**
- `src/features/tasks/task-form.tsx` — rebuilt to the Figma shell (self-contained; logic identical to `HEAD`).
- `src/features/appointments/appointment-form.tsx`, `src/features/visits/visit-form.tsx`, `src/features/daily-logs/log-form.tsx` — rebuilt to the Figma shell + the new fieldsets (logic identical to `HEAD`).
- `src/app/(app)/{tasks,appointments,visits,daily-logs}/new.tsx` — hide the native header only in the allowed branch.
- `src/components/figma/figma-form-screen.tsx` — `disclaimer` made **optional** (banner only when provided) + new `FigmaMutedNote` and `FigmaToggleRow` helpers.
- `src/locales/en.json`, `src/locales/ar.json` — 6 additive keys (both locales): `tasks.dueTitle`, `appointments.dateTimeTitle`, `dailyLogs.addSubtitle`, `dailyLogs.dailyTitle`, `dailyLogs.painScaleHint`, `dailyLogs.painOutOf`.

**Deliberately NOT touched:** the shared `appointment-fields.tsx`, `visit-fields.tsx`, `log-fields.tsx`, `schedule-fields.tsx` (edit flows), all `*schema.ts`/`hooks.ts`/`api.ts`, every `figma-*` center primitive, `medication-form.tsx`/`vital-form.tsx`, `package.json`.

---

## 4. How Add Task now matches Figma

Header (back + "إضافة مهمة", no banner) → a muted coordination disclaimer line → **main-info card** (title required `*`, description, then **priority chips** — and Sanad's **category chips**) → **"الموعد النهائي" card** (due date + due time) → **assignee card** (assign-to-me toggle) → **notes card** → sticky teal "إضافة المهمة". Teal chips + Cairo; due date/time use the protected wheel pickers. The export's invented assignee dropdown is replaced by the real toggle.

## 5. How Add Appointment now matches Figma

Header ("إضافة موعد", no banner) → muted disclaimer → **main-info card** (title required + **type chips**) → **"التاريخ والوقت" card** (date required `*`, start time required `*`, end time optional) → **location + doctor card** (location text + **real doctor chips** with "بدون طبيب", shown only when doctors exist) → **notes card** → sticky teal "إضافة الموعد". end-before-start is enforced by `appointmentSchema`.

## 6. How Add Visit now matches Figma

Header ("إضافة زيارة", no banner) → muted disclaimer → **single card** (visitor name required `*`, date required `*`, optional start/end times, notes, a hairline divider, then the self-link control) → sticky teal save. **RLS-correct:** the "link to my account" toggle appears **only for managers**; collaborators see a static note (`visits.ownVisitNote`) — the export's toggle-for-everyone is not copied.

## 7. How Add Daily Log now matches Figma

Header ("إضافة سجل يومي" + subtitle "ملاحظات مشاهَدة فقط — ليست تشخيصًا") → **gold non-diagnostic banner** → **date card** → **"الملاحظات اليومية" card** (5 chip groups — mood/sleep/appetite/hydration/mobility — divided, each with **"غير محدّد"** as the first chip) → **pain card** ("بدون" chip + minus/big-number/plus stepper + 0–10 quick row; big number shows "—" when "بدون") → **notes card** (Sanad's 4 note fields) → sticky teal "حفظ السجل اليومي".

---

## 8. Exact differences from Figma, and why

1. **Date/time are protected wheel pickers, not native inputs** (Sanad safety rule). **Required.**
2. **Teal + Cairo, not blue + IBM Plex** (mandated). Chips use the 48dp accessibility height + a selected **check** glyph (status never color-only), slightly taller than the export's color-only pills.
3. **Task assignee = real "assign to me" toggle**, not the export's invented name dropdown. **No fake data.**
4. **Appointment doctor = real `useDoctors` list + "بدون طبيب"**, not the export's hardcoded doctors. **No fake data.**
5. **Visit self-link toggle is manager-only** (collaborators get a static note) — the export's toggle-for-everyone would violate RLS. Visit start/end times stay **optional** (the export showed one required time). **Safety/behavior.**
6. **Daily log keeps "غير محدّد" unset + distinct "بدون" pain (null≠0)** and **4 structured note fields** — the export omitted all of these. **Data-model fidelity.** The 0–10 quick-select row is compact (per Figma); the accessible primary path is the 44dp stepper + "بدون" chip.
7. **Task & Daily Log keep fields the export omits** (task category + notes; daily-log's 4 notes). **Preserve existing data.**
8. **Header/button copy uses Sanad's existing "إضافة X" keys** (e.g. visit = "إضافة زيارة") rather than the export's "تسجيل زيارة" — the **same QA-approved choice as MS-1A vitals**: it keeps all add screens consistent and avoids changing the shared `visits.add` key (also used by the center FAB, which is out of scope).
9. **Non-medical coordination disclaimers** (task/appointment/visit) render as a small muted line, not a gold banner (the export has no banner there); the daily-log keeps its gold non-diagnostic banner. **Disclaimers preserved, not removed.**

---

## 9. Logic / safety preserved confirmation

Verified against `HEAD` (byte-level) and by the adversarial review — **all preserved:**
- **Task:** `useCreateTask`, `taskSchema`, `nullify`, full create payload (category, priority, due_date, due_time, **assigned_to = assignToMe ? user.id : null**, notes), unsaved guard.
- **Appointment:** `useCreateAppointment`, `useDoctors`, **imported** `prepareAppointment`/`defaultAppointmentDraft`, `APPOINTMENT_TYPES`, end-before-start via schema, unsaved guard.
- **Visit:** `useCreateVisit`, **imported** `prepareVisit`, `linkToSelf = !canManage`, `visitorUserId = (canManage ? linkToSelf : true) ? user.id : null` (byte-identical), optional times, end-before-start via schema, unsaved guard.
- **Daily Log:** `useCreateDailyLog`, **imported** `prepareDailyLog`, **"غير محدّد"→null** mapping, **`painLevel` null ("بدون") vs 0**, the **`23505` → `alreadyLoggedToday`** duplicate-date catch, 4 note fields, unsaved guard, observational-only (no diagnosis wording; disclaimer present).
- **Permission gating** unchanged on all four routes (canManage / canLogDoses), native header hidden only in the allowed branch.

## 10. Protected picker behavior preserved confirmation

No native date/time/`<select>` introduced (grep of the new/rewritten screen files: zero `type="date|time"`, `<input`, `<select`, `<textarea`, `DateTimePicker`). All date/time use the wheel `DateField`/`TimeField` (Android-safe full-width columns, draft-commit-on-Done, leap-safe `YYYY-MM-DD`, 24-hour `HH:MM`), unchanged.

## 11. 12-hour UX / internal HH:MM preservation confirmation

Every time input on these screens (task due time; appointment start/end; visit start/end) uses the shared `TimeField`, which (since the MS-1A patch) shows a **1–12 + صباحًا/مساءً** wheel and a friendly 12-hour trigger display, while **still emitting/storing 24-hour `HH:MM`**. No screen converts or stores 12-hour data; duplicate-time/schedule/notification logic is unaffected. (The daily-log screen has no time input.)

## 12. Approved center/list screens untouched confirmation

The boundary verifier confirmed: **no** `src/features/**/figma-*.tsx` (center) and **none** of `figma-tab-bar/screen/card/button/header/list-row/segmented-tabs/status-pill/bottom-sheet/field/icon-chip/care-loop-ring` in the diff. The shared `appointment-fields.tsx`, `visit-fields.tsx`, `log-fields.tsx`, `schedule-fields.tsx`, all schemas/hooks/api, and notifications are unmodified (edit flows unaffected). `medication-form.tsx`/`vital-form.tsx` are **not** in the diff and still pass a `disclaimer` (gold banner intact) — the `figma-form-screen.tsx` change is additive and does not alter their QA result. `package.json`/`package-lock.json` diff is empty (no deps added).

---

## 13. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run check:mojibake` | **Clean** — 259 files |
| `git -c core.autocrlf=false diff --check` | **Clean** |
| `npx expo-doctor` | **21/21 passed** |
| Locale JSON parse (en + ar) | **Valid** — 6 new keys in both, additions only |
| Adversarial review (4 verifiers) | **pass / pass / pass / pass** — 0 regressions; 1 intentional `concern` (§8.8) |

---

## 14. Is a new dev build required?

**No.** Pure JS/TS — no native module added or changed and `package.json` is untouched (icons use the already-committed `lucide-react-native`; Cairo is already loaded). Fast Refresh / a JS reload picks it up — **no `expo run:android`, prebuild, or EAS build needed.**

---

## 15. S24 Ultra QA checklist — screenshot targets (Android · Arabic · RTL)

- [ ] **`/tasks/new`** — header → main-info card (title `*`, description, category chips, priority chips) → due card → assign-to-me toggle → notes → sticky teal save. *(screenshot: full screen, dark)*
- [ ] **`/appointments/new`** — header → title `*` + type chips → date/time card (date `*`, start `*`, end optional) → location + doctor → notes → save. *(screenshot)*
- [ ] **`/appointments/new` doctor picker / no-doctor state** — confirm the doctor chips are the **real** circle doctors with "بدون طبيب" selectable (and the doctor card is hidden when there are no doctors). *(screenshot: doctor chips with "بدون طبيب" selected)*
- [ ] **`/visits/new`** — visitor name `*`, date `*`, optional start/end times, notes; as a **manager** the "link to my account" toggle shows; as a **collaborator** a static note shows instead. *(screenshots: manager + collaborator)*
- [ ] **`/daily-logs/new`** — subtitle + gold banner → date → 5 observation chip groups → pain card → 4 note fields → save. *(screenshot)*
- [ ] **Daily log unset states** — each chip group's first chip is **"غير محدّد"** and is selected by default. *(screenshot: groups showing غير محدّد selected)*
- [ ] **Daily log pain none vs 0** — "بدون" selected shows "—" as the big number; selecting 0 shows "0" — visibly different states. *(screenshots: بدون vs 0)*
- [ ] **Time picker open** — on a time field (e.g. appointment start), the wheel shows **1–12 + صباحًا/مساءً**; saved value persists as `HH:MM`. *(screenshot: open wheel)*
- [ ] **Date picker open** — the wheel date picker opens (not a native calendar). *(screenshot)*
- [ ] **Light / dark sanity** — chips, cards, banners, toggles, and pickers read coherently in both themes. *(screenshots: light + dark)*

---

*MS-1B complete: `/tasks/new`, `/appointments/new`, `/visits/new`, `/daily-logs/new` are exact-copy rebuilds of the Figma add screens (teal + Cairo, wheel pickers, 12-hour Arabic time), with every create hook, schema, the visit RLS self-link rule, the daily-log unset + "بدون" pain states + duplicate-date handling, real doctors/assignees (no invented data), and all disclaimers preserved — and the shared fieldsets, approved center screens, and the QA-approved `/medications/new` & `/vitals/new` untouched. Not staged, not committed.*
