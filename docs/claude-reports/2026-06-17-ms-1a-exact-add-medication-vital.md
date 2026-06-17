# Phase MS-1A — Exact-copy rebuild: Add Medication & Add Vital

**Date:** 2026-06-17
**Scope:** Visually rebuild `/medications/new` and `/vitals/new` from the new Figma Make export, preserving Sanad's real create flow, schema, validation, and protected pickers. **Not staged, not committed.**
**Refs:** `docs/claude-reports/2026-06-16-missing-screens-export-analysis.md`, `docs/claude-reports/2026-06-16-ms-0-form-picker-primitives.md`

---

## 1. Summary

MS-0 reskinned the shared form primitives but the two `/new` screens still used the **old Sanad form composition** (a flat `Screen` + stacked fields). MS-1A replaces that composition with an **exact-copy rebuild of the Figma `AddMedicationScreen` / `AddVitalScreen`**: a fixed header (rounded back button + stacked title/subtitle + hairline divider), a full-bleed **gold disclaimer banner**, a scrolling stack of **grouped cards** (radius-16, muted section labels), and a **sticky teal save** footer.

The rebuild is **layout-only on top of Sanad's real logic**. Every create hook, schema, validation path, the **duplicate-time safety guard**, the unsaved-changes guard, and the **protected wheel date/time pickers** are reused unchanged. The export's hardcoded **blue `#2F6FD0` + IBM Plex** and **native HTML date/time inputs** are NOT copied — tokens are the committed **teal + Cairo**, and date/time use Sanad's wheel `DateField`/`TimeField`. The shared `schedule-fields.tsx` / `vital-fields.tsx` (used by the out-of-scope edit flows) are **untouched** — only their pure functions are imported into new screen-specific Figma fieldsets.

An adversarial 3-verifier review (medication · vital · boundary), each prompted to *refute* parity/preservation against the export and `HEAD`, returned **pass** on all three with only two intentional, documented `concern`s (§6).

---

## 2. Figma files inspected

- `docs/figma/make-export/missing-screens-2026-06-16/extracted/src/app/components/AddMedicationScreen.tsx` — header, gold disclaimer, medication-info card (incl. with-food pill toggle), dose-schedule card (7-chip weekday row + "every day" text toggle + repeatable time rows + dashed add + date range), notes card, sticky save.
- `docs/figma/make-export/missing-screens-2026-06-16/extracted/src/app/components/AddVitalScreen.tsx` — header, gold non-diagnostic disclaimer, measurement-type pill chips, value card (BP split systolic/`/`/diastolic vs single big value + unit box), date/time card, notes card, sticky save.
- The export's shared `T` token block + inline `TextField` (the source of the raised-input / 1.5px-border / radius-10 field style) — **structure copied, its blue/IBM Plex tokens discarded.**

---

## 3. Files changed

**New (3):**
- `src/components/figma/figma-form-screen.tsx` — the shared Figma add-screen shell: `FigmaFormScreen` (header + gold banner + scroll + sticky footer + keyboard avoidance + safe-area), `FigmaFormCard`, `FigmaSectionLabel`, `FigmaFieldLabel`, `FigmaFormField` (raised teal-focus text field), `FigmaSwitch` (pill toggle).
- `src/features/medications/figma-schedule-fields.tsx` — `FigmaScheduleFields`: the Figma dose-schedule editor (7-chip weekday row + text toggle, dose-time rows with wheel `TimeField` + X remove + dashed add, date range with two wheel `DateField`s). Reuses `duplicateTimesInDraft`, `WEEKDAY_KEYS`, `ScheduleDraft` from the originals.
- `src/features/vitals/figma-vital-fields.tsx` — `FigmaVitalFields`: the Figma type/value/date-time/notes cards (pill type selector via `OptionSelect`, big LTR centered BP/value inputs, wheel `DateField`/`TimeField`). Reuses `VITAL_READING_TYPES`, `DEFAULT_UNITS`, `VitalDraft`.

**Modified (6):**
- `src/features/medications/medication-form.tsx` — JSX rebuilt to the Figma shell; **all logic identical to `HEAD`**.
- `src/features/vitals/vital-form.tsx` — JSX rebuilt to the Figma shell; **all logic identical to `HEAD`**.
- `src/app/(app)/medications/new.tsx`, `src/app/(app)/vitals/new.tsx` — hide the native stack header only in the allowed branch (`<Stack.Screen options={{ headerShown: false }} />`); the not-allowed `EmptyState` keeps the native header + back.
- `src/locales/en.json`, `src/locales/ar.json` — 6 additive keys (both locales): `medications.addSubtitle`, `medications.clearDays`, `medications.periodTitle`, `medications.placeholders.name`, `medications.withFoodReminder`, `vitals.addSubtitle`.

**Deliberately NOT touched:** `schedule-fields.tsx`, `schedule-validation.ts`, `vital-fields.tsx` (shared with edit flows), all `*schema.ts`/`hooks.ts`/`api.ts`, notifications, every `figma-*` center screen/primitive, `package.json`.

---

## 4. How Add Medication now matches Figma

- **Header** — rounded back button (`ChevronRight`, the RTL "back") + stacked title (`medications.addTitle`) and subtitle (`medications.addSubtitle`, "the app records medication times only") + hairline bottom divider. Matches the export header.
- **Gold disclaimer banner** — full-bleed, directly under the header, using the **existing `medications.disclaimer`** (the Arabic copy is byte-identical to the export's banner) in `accentFg` on `accentBg`.
- **Medication-info card** — section label `medicationInfoTitle`; fields in export order: name (required `*`) → dosage → form → instructions (multiline); then a hairline divider and the **with-food row** (label + reminder sub-line + `FigmaSwitch` pill toggle).
- **Dose-schedule card** — section label `firstScheduleTitle`; the Figma layout exactly: **7 equal weekday chips in a justified row** with an "every day / clear all" **text toggle below** (not the old `WeekdaySelector`'s every-day-chip-on-top), **dose-time rows** (each a wheel `TimeField` + an `X` remove button when more than one) with a **dashed "add time"** button, and a **date range** (start `*` + end) as two side-by-side wheel `DateField`s.
- **Notes card** — a standalone final card (schedule notes), matching the export's trailing notes card.
- **Sticky footer** — full-width **teal `FigmaButton`** save (`medications.add`), with the submit error shown above it. Teal + Cairo throughout; no blue, no IBM Plex.

## 5. How Add Vital now matches Figma

- **Header** — back + title (`vitals.addTitle`) + subtitle (`vitals.addSubtitle`, "readings for tracking only") + divider.
- **Gold non-diagnostic banner** — full-bleed, using the existing **`vitals.disclaimer`** (Arabic identical to the export), in gold.
- **Measurement-type card** — `vitals.fields.type` label + a wrap of **pill chips** (`OptionSelect`, teal fill + border + bold on select).
- **Value card** — `vitals.valueLabel`; **blood pressure** shows the export's split: **systolic** input + a large `/` + **diastolic** input (both big, centered, LTR-isolated), with the unit shown inline (`type (mmHg)`); **non-BP** shows one **big value input + a unit box** beside it. Values are neutral — no normal/abnormal labels, no health-color coding.
- **Date & time card** — `readingAt` label + wheel `DateField` (2/3) and wheel `TimeField` (1/3), matching the export's date-(wide)/time-(narrow) split.
- **Notes card** + **sticky teal save** (`vitals.add`). Teal + Cairo; no blue/IBM Plex.

---

## 6. Exact differences from Figma, and why

1. **Date/time are wheel-picker triggers, not native inputs.** The export uses `<input type="date|time">` (browser calendar/clock). Sanad's safety rule forbids native pickers, so these are the protected wheel `DateField`/`TimeField` triggers (a tappable field that opens the wheel sheet). **Required deviation.**
2. **Tokens are teal + Cairo, not blue + IBM Plex.** The export hardcodes `#2F6FD0` + IBM Plex; we use the committed theme (teal `#4BA898`/`#2E8A7B`) + Cairo. **Mandated by the task.**
3. **Selected chips carry a check glyph + 48dp height.** The vital type selector reuses `OptionSelect`, so selected chips show **check + fill + bold** at the 48dp accessibility height — slightly taller than the export's ~32dp color-only pills. **Intentional a11y choice** (status never color-only; large targets for elders).
4. **Blood-pressure unit is read-only (still persisted).** The export's BP card hardcodes "BP (mmHg)" with no unit input; we match that — BP shows the unit inline and does not expose an editable unit field. The unit is still set (`DEFAULT_UNITS.blood_pressure = mmHg`) and saved. Non-BP keeps an **editable** unit box. **Figma-parity choice; no data lost.**
5. **Add-time button copy.** The button reuses the existing approved key `medications.addTime` ("إضافة وقت") rather than the export's literal "إضافة موعد جرعة" — to keep one consistent Sanad string. **Wording-only difference.**
6. **Header back icon.** Uses `ChevronRight` (the export's add-screen back glyph) rather than the center screens' `ArrowRight`; both are the RTL "back". The protected pickers render at the card surface tone with a hairline (their MS-0 styling), marginally flatter than the raised text inputs.

---

## 7. Logic / safety preserved confirmation

Verified against `HEAD` (byte-level) and by the adversarial review — **all preserved, unchanged:**
- **Add Medication:** `useCreateMedication`, `medicationSchema`, `prepareSchedule`, `nullify`, the full `onSubmit` (same payload), `submitted → router.back()`, `useUnsavedChanges` + `UnsavedChangesGuard`, the with-food boolean, weekday **opt-in 0=Sunday..6=Saturday** + every-day toggle, **HH:MM** via wheel `TimeField`.
- **Add Vital:** `useCreateVital`, `prepareVital` (**imported**, not reimplemented), the full `onSubmit`, unsaved guard, vital types incl. **`other`**, **BP → systolic/diastolic** (number-pad, maxLength 3), **non-BP → single value**, **`other` value optional**, unit persisted, date+time via wheel pickers.
- **Non-diagnostic rule:** the gold disclaimer banner is present and prominent on both screens; **no normal/abnormal labeling, no health-color coding** on any value (values render neutral; red is used only for invalid-input borders/messages, never interpretation).

## 8. Duplicate-time validation preserved confirmation

Unchanged and active in this flow: `hasDuplicateTimes = duplicateTimesInDraft(schedule).length > 0` still **blocks save** (`disabled={!dirty || hasDuplicateTimes}`), duplicate rows are still **highlighted** (`errorFg` border + `errorBg` fill) via `duplicateTimesInDraft` in `FigmaScheduleFields`, and the `medications.errors.duplicateTime` message is still shown. `schedule-validation.ts` is **not modified** (cross-schedule conflict isn't active in the add flow — there is no existing medication yet — exactly as before).

## 9. Protected picker behavior preserved confirmation

No native date/time inputs were introduced (grep of all 5 target files: zero `type="date|time"`, `<input`, `<textarea`, `DateTimePicker`). All date/time use the wheel `DateField`/`TimeField` (which render `PickerSheet` + `WheelColumn` — the Android-safe full-width column structure, draft-commit-on-Done, leap-safe YYYY-MM-DD, 24-hour HH:MM), untouched since MS-0.

## 10. Approved center/list screens untouched confirmation

The boundary verifier confirmed **no** `src/features/**/figma-*.tsx` and **none** of `figma-tab-bar/screen/card/button/header/list-row/segmented-tabs/status-pill/field/icon-chip/care-loop-ring/bottom-sheet` appear in the diff. `schedule-fields.tsx`, `schedule-validation.ts`, `vital-fields.tsx`, all schemas/hooks/api, notifications, and `package.json`/`package-lock.json` are unmodified. The edit flows (`schedule-modal-host`, `vital-editor`) are unaffected.

---

## 11. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run check:mojibake` | **Clean** — 256 files, no mojibake |
| `git -c core.autocrlf=false diff --check` | **Clean** |
| `npx expo-doctor` | **21/21 passed** |
| Locale JSON parse (en + ar) | **Valid** — 6 new keys present in both, additions only |
| Adversarial review (3 verifiers) | **pass / pass / pass** — 0 regressions; 2 intentional `concern`s (§6) |

---

## 12. Is a new dev build required?

**No.** The change is pure JS/TS. The icons (`ChevronRight`, `Plus`, `X`) come from **`lucide-react-native`** — already a committed dependency, already used by `FigmaHeader` — and Cairo is already loaded in the root layout. No native module added or changed; `package.json` is untouched. The existing dev client picks this up via Fast Refresh / a JS reload — **no `expo run:android`, prebuild, or EAS build needed.**

---

## 13. S24 Ultra QA checklist (Android · Arabic · RTL) — screenshot targets

- [ ] **`/medications/new`** — header (back + "إضافة دواء" + subtitle + divider) → gold disclaimer banner → medication-info card (name `*`, dosage, form, instructions, with-food toggle) → dose-schedule card → notes card → sticky teal "إضافة الدواء". *(screenshot: full screen, dark)*
- [ ] **Duplicate-time error state** — add two identical dose times; confirm both rows highlight red, the duplicate message shows, and the **save button is disabled**. *(screenshot: schedule card with red rows + disabled save)*
- [ ] **Date/time picker open** — tap a dose time (and a start date); confirm the **wheel sheet** opens (not a calendar/clock), value commits only on Done. *(screenshot: open wheel sheet)*
- [ ] **`/vitals/new`** — header → gold non-diagnostic banner → type chips → value card → date/time card → notes → sticky teal "حفظ القياس". *(screenshot: full screen)*
- [ ] **Blood pressure selected** — type = ضغط الدم; confirm split systolic `/` diastolic big LTR inputs + inline "(mmHg)". *(screenshot: BP value card)*
- [ ] **Non-BP vital selected** — type = النبض (or another); confirm single big value input + editable unit box. *(screenshot: single-value card)*
- [ ] **Notes section** — confirm the multiline notes card renders and accepts Arabic. *(screenshot: notes card)*
- [ ] **Light / dark sanity** — toggle the system theme; confirm teal primary, gold banner, warm card surfaces, raised inputs, and Cairo all read coherently in both. *(screenshots: light + dark)*

---

*MS-1A complete: `/medications/new` and `/vitals/new` are exact-copy rebuilds of the Figma add screens (teal + Cairo, wheel pickers, gold disclaimers), with every create hook, schema, the duplicate-time safety guard, and the protected pickers preserved, and the shared edit-flow files + approved center screens untouched. Not staged, not committed.*
