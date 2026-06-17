# Phase MS-1A Patch — QA fixes: vital type chips, medication date guards, 12-hour Arabic time UX

**Date:** 2026-06-17
**Scope:** Three S24 QA fixes for `/vitals/new` and `/medications/new` + the shared date/time picker helpers they depend on. **Not staged, not committed.**
**Refs:** `docs/claude-reports/2026-06-17-ms-1a-exact-add-medication-vital.md`, the export's `AddVitalScreen.tsx` / `AddMedicationScreen.tsx`.

---

## 1. Summary

Three targeted fixes from S24 QA, all keeping the MS-1A Figma layout (Cairo, Sanad teal, gold disclaimer banners, warm cards):

1. **Vital type chips** — the measurement-type selector now renders as **clearly tappable teal pills** (was reading as plain text). Replaced the reused `OptionSelect` with a new screen-friendly `FigmaChipSelect` (raised hairline pill unselected; teal fill + teal border + leading check + bold when selected).
2. **Medication schedule dates** — start/end **cannot be a past date**, end **cannot be before start**. Added an opt-in `minDate` prop to the protected wheel `DateField` (clamps the wheel so past dates are unreachable), clear-end-on-start-advance handling, **save disabled** on any residual invalid state, and inline Arabic errors.
3. **12-hour Arabic time UX** — `TimeField`'s wheel now shows **hour 1–12 + minute + صباحًا/مساءً**, with a friendly 12-hour display on the trigger, while it **still stores/emits 24-hour `HH:MM`** exactly as before.

All work stays on the protected wheel pickers — **no native/web date/time inputs introduced**. The shared schema, duplicate-time validation, schedule edit flow, `OptionSelect`, and every approved center screen are untouched.

An adversarial 3-verifier review (12h-time · dates · chips-boundary), each prompted to *refute* the claims against `HEAD` and the export, returned **pass / pass / pass** with zero regressions (one transparency note only).

---

## 2. Files changed

**Shared picker helpers (required for Fix 2 + Fix 3):**
- `src/components/date-time-shared.ts` — added optional `DateFieldProps.minDate`; added 12-hour helpers `to12h` / `from12h` / `formatHm12` + `Period` / `Hm12` types.
- `src/components/date-field.tsx` — implemented `minDate` clamping (`clampToMin` on open / every selection / commit; year/month/day ranges start at the min). **No `minDate` ⇒ unchanged full range.**
- `src/components/date-field.web.tsx` — pass `min={minDate}` to the existing HTML date input.
- `src/components/time-field.tsx` — 12-hour wheel (hour 1–12 + minute + period) + 12-hour trigger display; **emits 24-hour `HH:MM`** via `from12h` + `formatHmParts`.

**The two screens + their helpers:**
- `src/components/figma/figma-form-screen.tsx` — added `FigmaChipSelect` (the new teal pill selector).
- `src/features/vitals/figma-vital-fields.tsx` — type selector now uses `FigmaChipSelect` (was `OptionSelect`).
- `src/features/medications/figma-schedule-fields.tsx` — `minDate` on both date fields, clear-end-on-start-advance, live inline date errors, exported `scheduleDatesValid` / `scheduleDateErrors`.
- `src/features/medications/medication-form.tsx` — save disabled when `!scheduleDatesValid(...)`.
- `src/locales/en.json`, `src/locales/ar.json` — additive: `pickers.period` / `pickers.am` / `pickers.pm`, `medications.errors.dateInPast` (both locales).

**Deliberately NOT touched:** `option-select.tsx` logic (only its MS-0 Cairo reskin is in the tree), `schedule-fields.tsx`, `schedule-validation.ts`, `schedule-modal-host.tsx`, `vital-fields.tsx`, all `*schema.ts`/`hooks.ts`/`api.ts`, every `figma-*` center screen, `package.json`.

---

## 3. Vital type chip visual fix details

New `FigmaChipSelect<T>` in `figma-form-screen.tsx`, used by the vitals type card:
- Each option is a full **pill** (`Radius.pill`, `1.5px` border, `minHeight = TouchTarget.min` = 48dp), wrapped (`flexWrap`, gap 8) — reads as a tappable control, not text.
- **Unselected:** raised surface (`theme.backgroundSunken`, lighter than the card) + hairline (`theme.border`) + muted text.
- **Selected:** **teal** fill (`theme.primaryBg`) + **teal** border (`theme.primary`) + **leading check** (`Glyph.check`) + **bold** (`FigmaFont.semibold`) + teal text (`theme.primaryText`) — never color-only, and teal (not the export's blue).
- Single-choice `accessibilityRole="radio"` + `selected` state. Mirrors the export's pill layout, upgraded with the a11y check + 48dp target.
- **Logic preserved:** options still come from `VITAL_READING_TYPES` (incl. `blood_pressure` and `other`); `onChange` still does `{ type, unit: DEFAULT_UNITS[type] }`; selecting BP still shows the systolic/diastolic split. `OptionSelect` is **not** modified, so every other form that uses it is unaffected.

## 4. Medication date min / end-before-start validation details

- **`DateField.minDate` (new, optional):** when set, the wheel's year/month/day columns start at the min and `clampToMin` re-clamps the draft on open, on every column change, and on commit — so a date earlier than the min **cannot be selected or committed**. When omitted (every other caller, incl. birth dates), the field keeps its full 120-year-back range — **birth-date pickers are unaffected** (verified: only the medication add-schedule passes `minDate`).
- **In `FigmaScheduleFields`:** start `minDate = today`; end `minDate = max(today, start)`. When the user advances start past the current end, the now-invalid **end date is cleared** (with an empty-string guard).
- **Save disabled:** `medication-form` computes `datesValid = scheduleDatesValid(schedule, todayYmd())` and `disabled={!dirty || hasDuplicateTimes || !datesValid}`. `scheduleDateErrors` flags `start < today` (`past`), `end < today` (`past`), `end < start` (`beforeStart`).
- **Inline Arabic errors:** past → `medications.errors.dateInPast` ("لا يمكن اختيار تاريخ في الماضي"); end-before-start → existing `medications.errors.endBeforeStart`.
- **No native input** on native (`DateField` still uses `PickerSheet` + `WheelColumn`); the web variant only adds `min` to its pre-existing HTML input.
- **Add-flow only:** the shared `medicationSchema`, `schedule-validation.ts`, and the edit flow (`schedule-modal-host`) are unchanged — **existing historical/edit schedules are unaffected** (no past-date rule was added to the schema). `YYYY-MM-DD` strings compare chronologically, so the comparisons are correct.

## 5. 12-hour time picker UX details

- `TimeField`'s wheel now has **three full-width columns**: hour `1..12`, minute (honoring `minuteStep`), and a **period** column with Arabic labels **صباحًا / مساءً** (`pickers.am` / `pickers.pm`).
- The trigger shows a friendly 12-hour string (e.g. `8:00 صباحًا`) via `formatHm12`.
- Applies to **all** `TimeField`-based pickers (medication dose times, vitals time, tasks/appointments/visits/daily-logs, notification quiet hours) — a consistent Arabic 12-hour UX — because the contract is unchanged (below).

## 6. Internal HH:MM preservation confirmation

The field **stores and emits 24-hour `HH:MM` exactly as before.** `commit()` does `from12h(draft.hour12, draft.minute, draft.period) → formatHmParts(...) → onChange('HH:MM')`. The 12-hour parts exist **only** in the wheel + the trigger display; `onChange` never receives 12-hour data. The `TimeFieldProps` contract (`value: 'HH:MM'` in / `onChange: 'HH:MM'` out) is byte-identical, so every consumer is unaffected.

**Midnight/noon mapping verified** (node replica of `to12h`/`from12h` — all 1440 minutes round-trip losslessly):
- `12:00 صباحًا` → `00:00` · `12:00 مساءً` → `12:00` · `1:00 مساءً` → `13:00` · `8:00 صباحًا` → `08:00` · `11:30 مساءً` → `23:30`.

## 7. Duplicate-time validation preservation confirmation

Unchanged and still effective. `duplicateTimes` / `duplicateTimesInDraft` normalize via `formatHm` on the stored **`HH:MM`** strings — which the 12-hour UI still produces — so duplicate detection, the per-row red highlight, the duplicate message, and the save-block (`hasDuplicateTimes`) all work exactly as before. `schedule-validation.ts` is not modified.

## 8. Protected picker behavior confirmation

`PickerSheet` is unchanged: the sheet **body stays a full-width column block** (not a row — the Android blank-surface fix), `WheelColumn` is `flex:1`, rows are 48dp, the **draft commits only on Done**, and **Cancel / backdrop discards** (closes without calling `onChange`; the draft is local state reset on open). No native `<input type="time|date">` or `DateTimePicker` was introduced in any native file. `minuteStep` and `clearable` (`''`) behavior preserved.

## 9. Approved center/list screens untouched confirmation

The boundary verifier confirmed **no** `src/features/**/figma-*.tsx` (center) and **none** of `figma-tab-bar/screen/card/button/header/list-row/segmented-tabs/status-pill/bottom-sheet/field/icon-chip/care-loop-ring` appear in the diff. No schema/hook/api/validation file changed; `package.json`/`package-lock.json` diff is empty (no deps added). `OptionSelect` logic untouched.

---

## 10. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run check:mojibake` | **Clean** — 256 files |
| `git -c core.autocrlf=false diff --check` | **Clean** |
| `npx expo-doctor` | **21/21 passed** |
| Locale JSON parse (en + ar) | **Valid** — 4 new keys in both, additions only |
| 12h↔24h conversion (node replica) | **All 1440 minutes round-trip; all required cases pass** |
| Adversarial review (3 verifiers) | **pass / pass / pass** — 0 regressions |

---

## 11. Is a new dev build required?

**No.** Pure JS/TS — no native module added or changed and `package.json` is untouched (the icons use the already-committed `lucide-react-native`). The existing dev client picks this up via Fast Refresh / a JS reload — **no `expo run:android`, prebuild, or EAS build needed.**

---

## 12. S24 Ultra QA checklist

- [ ] **`/vitals/new` type chips** — the "نوع القياس" options render as distinct **teal pills**, clearly tappable (not plain text); selected shows check + bold + teal fill, unselected is a raised hairline pill.
- [ ] **`/vitals/new` blood pressure selected** — selecting ضغط الدم keeps the chip highlighted and shows the systolic `/` diastolic split.
- [ ] **`/medications/new` start date cannot be past** — open the start-date wheel; confirm earlier-than-today values are not reachable; default (today) is valid.
- [ ] **`/medications/new` end date cannot be past or before start** — the end-date wheel can't go before max(today, start); advancing start past a set end clears the end; an end-before-start state shows the Arabic error and disables save.
- [ ] **Time picker shows 1–12 + صباحًا/مساءً** — open any dose-time / reading-time picker; confirm the hour column is 1–12 and the period column shows صباحًا / مساءً; the trigger reads e.g. "8:00 صباحًا".
- [ ] **Selected time still saves as HH:MM internally** — set 1:00 مساءً and save; confirm the stored reminder/reading time is `13:00` (and 12:00 صباحًا → `00:00`, 12:00 مساءً → `12:00`).
- [ ] **Duplicate time still blocks save** — add two identical dose times; confirm the rows highlight red, the duplicate message shows, and the save button stays disabled.
- [ ] **Light / dark sanity** — chips, banners, pickers, and the 12-hour wheel all read coherently in both themes.

---

*MS-1A patch complete: vital type chips read as teal pills, medication schedule dates are guarded against past/end-before-start at the picker + save level, and TimeField offers a 1–12 + صباحًا/مساءً UX while still storing 24-hour HH:MM. Duplicate-time validation, the protected wheel pickers, the schedule edit flow, and all approved center screens are untouched. Not staged, not committed.*
