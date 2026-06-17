# Phase MS-0 — Reskin shared form & picker primitives to the Figma visual language

**Date:** 2026-06-17 (planned as MS-0 in the 2026-06-16 missing-screens analysis)
**Scope:** Visual reskin ONLY of the 10 shared form/picker primitives. No app schemas, hooks, Supabase calls, notification registration, medication validation, or backend logic touched. No dependencies added. **Not staged, not committed.**
**Refs:** `docs/claude-reports/2026-06-16-missing-screens-export-analysis.md` (MS-0 definition), `docs/claude-reports/2026-06-16-unmigrated-screens-and-flows-audit.md`, `docs/claude-reports/2026-06-16-figma-full-app-parity-pass.md`

---

## 1. Summary

The shared form/picker primitives still rendered in the **legacy IBM Plex Sans Arabic** typeface, while the committed Figma center screens render in **Cairo**. Crucially, the legacy theme (`src/constants/theme.ts`) was **already re-pointed to the Figma teal / warm-graphite palette in Phase A** — so these primitives' *colors and radii already matched* the Figma language; the dominant remaining gap was **typography**.

MS-0 closes that gap with a tightly-scoped, behavior-neutral restyle:

1. **Typeface → Cairo** across all 10 primitives, applied as a `fontFamily` style override layered on top of the existing `ThemedText` / `TextInput` styles (sizes, weights, colors, accessibility all unchanged). Centralized in a new helper so the IBM-Plex→Cairo mapping is not duplicated per file.
2. **Cairo buttons** — a new `FormButton` (a behavior-faithful, Cairo, teal, rounded-2xl clone of the legacy `Button`) is swapped into the four sheet/action primitives so their buttons are Cairo too. The legacy `Button` (consumed by the already-migrated center screens) is left **untouched**.
3. **Sheet surfaces lifted to the card tone** (`background` → `backgroundElement`) on the two bottom sheets, matching the Figma `FigmaBottomSheet` (rounded top + handle + hairline on the lifted card surface).

Colors stay on `useTheme()` (already the Figma palette), which guarantees **zero color regression and full light/dark coherence**. Every component's public API, behavior, validation, and the **protected Android wheel-picker structure** are preserved verbatim.

An adversarial 4-verifier review (each prompted to *refute* preservation, comparing every file against `HEAD`) returned **all-preserved** across all 15 behavior rules and all 5 boundary checks, with line-level evidence.

---

## 2. Files changed

**Modified (10 primitives — visual layer only):**
- `src/components/form-field.tsx`
- `src/components/form-modal.tsx`
- `src/components/form-actions.tsx`
- `src/components/option-select.tsx`
- `src/components/picker-sheet.tsx`
- `src/components/date-field.tsx`
- `src/components/time-field.tsx`
- `src/components/date-time-field.tsx`
- `src/components/weekday-selector.tsx`
- `src/components/item-actions.tsx`

**New (2 allowed `figma/form-*` helpers — prevent duplication, no public-API change to the 10):**
- `src/components/figma/form-typography.ts` — `Cairo` font-family style fragments (regular…extrabold), the IBM-Plex→Cairo override applied to existing text.
- `src/components/figma/form-button.tsx` — `FormButton`, a Cairo/teal/rounded-2xl behavior-faithful clone of the legacy `Button` (same variants `primary/secondary/danger/plain`, sizes `md/sm`, loading/disabled/pressed/accessibility), used by the four sheet/action primitives.

**Deliberately NOT touched:** `button.tsx`, `date-time-shared.ts`, `themed-text.tsx`, `themed-view.tsx`, `constants/theme.ts`, every `figma-*` center primitive, all schemas/hooks/api/notification/validation files, `package.json`/`package-lock.json`.

> The `src/features/*` card/dashboard edits, `eslint.config.js`, `src/components/dashboard-tile.tsx`, and the `docs/claude-reports/*.md` files that appear in `git status` are **pre-existing from earlier sessions — not part of MS-0**.

---

## 3. Visual changes per component

| Component | Visual change | Unchanged |
|---|---|---|
| **form-field** | Label/input/error → Cairo. | Direction-following (NO forced `textAlign`), teal focus ring (2px `primary`), red inline error, elevated input surface, radius, `{...rest}` pass-through. |
| **form-modal** | Title (Cairo bold) + close glyph + error → Cairo; sheet lifted to **card** surface; actions → Cairo `FormButton`. | Explicit-close-only (no backdrop dismiss), keyboard avoidance, ScrollView `keyboardShouldPersistTaps`, submit/cancel disabled+loading, safe-area, grab handle. |
| **form-actions** | Saved/error status + buttons → Cairo (`FormButton`). | `FormActions` + `StickyFormActions` exports, save disabled/loading, status colors, **non-destructive** secondary (Save never mixed with delete), sticky top divider + safe-area. |
| **option-select** | Label + chips → Cairo (selected semibold). | Single-choice radio semantics, selected = teal fill + teal border + leading check + bold, 48dp targets, disabled, RTL-safe wrap. |
| **picker-sheet** | Title/close/column labels/rows → Cairo (selected bold); sheet lifted to **card** surface; Done/Clear/Cancel → Cairo `FormButton`. | **Android-safe layout (see §5)**, draft-commit-on-Done, Clear/Cancel/backdrop semantics, selected row = fill + check + bold, scroll-to-selected. |
| **date-field** | Label / trigger value / error → Cairo (dropped the hardcoded IBM-Plex on the trigger). | `YYYY-MM-DD` I/O, leap-safe day clamp, `PickerSheet` (no native input), columns row, all date math. |
| **time-field** | Same as date-field. | 24-hour `HH:MM` I/O, `minuteStep`, time-display directionality, `PickerSheet`. |
| **date-time-field** | Section label → Cairo. | Date+time composition, row/col layout, props. |
| **weekday-selector** | Label / chips / error → Cairo (selected bold). | Opt-in selection, `0=Sun..6=Sat`, every-day toggle, selected = fill + check + bold, sort order. |
| **item-actions** | Buttons → Cairo `FormButton` (size `sm`). | Two-step inline delete (`confirming` state), **no native Alert**, deleting/disabled handling. |

**Visual-target coverage:** Cairo ✓ · teal primary (already, via theme) ✓ · warm graphite/card surfaces ✓ · same radii/hairlines ✓ · Cairo rounded-2xl buttons ✓ · teal focus ring ✓ · red inline errors ✓ · ≥48dp targets ✓ · rounded-top sheets w/ handle + hairline on lifted card ✓ · selected = check + fill + bold ✓ · destructive = icon-area + text + color (not color-only) ✓ · light mode coherent (dual-tuned theme retained) ✓.

---

## 4. Exact behaviors confirmed unchanged

Verified file-by-file against `HEAD` (byte-level), all **preserved**:

- **Public API:** every exported signature and Props type of the 10 components is byte-for-byte identical. No prop added, removed, renamed, or retyped.
- **form-field:** `borderColor = error ? errorFg : focused ? primary : border`; `inputFocused` 2px ring; `onFocus/onBlur` wrappers; `{...rest}`; **no `textAlign`** (LTR email/phone/codes stay readable).
- **form-modal:** dismissal is explicit-only (KeyboardAvoidingView backdrop has no `onPress`); `disabled = submitting || submitDisabled`, `loading = submitting`; cancel `disabled = submitting`.
- **form-actions:** both variants exported with `SharedProps`; idle/saved/error status; secondary stays non-destructive; sticky divider + safe-area.
- **option-select / weekday-selector:** selection semantics, `0=Sun..6=Sat`, every-day toggle, opt-in, sort, check+fill+bold.
- **item-actions:** two-step `confirming` flow; **no `Alert.alert`** introduced; `deleting`/`disabled` wiring intact.
- **FormButton parity:** same 4-variant palette/tokens, `isDisabled = disabled || loading`, opacity `0.45` disabled / `0.75` danger-pressed, `ActivityIndicator` on loading, full accessibility (`role/label/hint/state`). Differs from `Button` ONLY by Cairo label + `Radius.lg`; the unused `icon/glyph` branch is dropped (no `FormButton` caller passes them — behavior-neutral).

---

## 5. Protected picker behavior confirmation

`picker-sheet.tsx` — the Android blank-surface-safe structure is **untouched**; only colors/fonts and the `Button→FormButton` element name changed:

- **Sheet body stays a full-width column block** — `body: { width: '100%' }` with the "Do NOT make this a row" comment intact; `<View style={styles.body}>{children}</View>` is byte-identical to `HEAD`.
- **`WheelColumn` stays `flex: 1`** (`column: { flex: 1 }`).
- **48dp rows** (`ROW_HEIGHT = TouchTarget.min`) and **`VISIBLE_ROWS = 5`** unchanged; `columnScroll` height still `ROW_HEIGHT * VISIBLE_ROWS`.
- **Draft committed only on Done** — backdrop tap, close icon, and `onRequestClose` all call `onCancel` (discard); `onDone` commits. The commit/clear math lives in `date-field`/`time-field` and is byte-identical.
- **Clear** rendered only when `onClear` provided; **selected row** = `primaryBg` fill + leading check + bold (`rowTextSelected` 700 retained; Cairo layered before it so the weight still wins).
- **`maybeScrollToSelected`** scroll-into-view logic unchanged.
- **No native input / `DateTimePicker`** introduced anywhere; `date-time-shared.ts` confirmed **unmodified** (absent from `git status`).
- **DateField** `YYYY-MM-DD` + leap-safe clamp (`Math.min(draft.day, daysInMonth(...))`) preserved; **TimeField** 24-hour `HH:MM` + `minuteStep` + LTR-isolated display preserved.

---

## 6. Product-safety logic untouched confirmation

- **Medication duplicate-time / cross-schedule conflict validation** — `src/features/medications/schedule-validation.ts`, `schedule-fields.tsx`, `medication-form.tsx` are **not in the diff**.
- **Schemas / hooks / api / Supabase / notification registration / backend** — no `*schema.ts`, `*hooks.ts`, `*api.ts`, `src/features/notifications/*`, or `src/constants/theme.ts` modified (targeted path+glob diff query returned empty).
- **Center / list screens & their primitives** — no `src/features/**/figma-*.tsx` and none of `figma-{tab-bar,screen,card,button,header,list-row,segmented-tabs,status-pill,bottom-sheet,field}`, `icon-chip`, `care-loop-ring` modified. The only `figma/` files in the diff are the 2 new MS-0 helpers.
- **Dependencies** — `git diff -- package.json package-lock.json` is **empty**. Nothing installed.

All confirmed independently by the boundary verifier (5/5 checks pass).

---

## 7. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run check:mojibake` | **Clean** — scanned 253 active files, no mojibake signatures |
| `git -c core.autocrlf=false diff --check` | **Clean** — no whitespace/LF errors |
| `npx expo-doctor` | **21/21 checks passed** |
| Adversarial preservation review (4 verifiers) | **all-preserved** — 15/15 behavior rules, 5/5 boundary checks, 0 regressions |

---

## 8. Is a new dev build required?

**No.** The change is **pure JS/TS**. The Cairo families referenced via `FigmaFont` (`Cairo_400Regular`…`Cairo_800ExtraBold`) come from `@expo-google-fonts/cairo`, which is **already a committed dependency and already registered in the root layout** (from the earlier Figma foundation work). No native module was added or changed, and `package.json`/`package-lock.json` are untouched — so the existing dev client picks this up via the JS bundle (Fast Refresh / reload); **no `expo run:android`, prebuild, or EAS build is needed.**

> Caveat: this only holds for a build that already includes the Cairo fonts (i.e. any build at/after the committed Figma foundation). On an older build predating Cairo, the labels would fall back to the system font until rebuilt — but the current committed app already bundles Cairo.

---

## 9. S24 Ultra QA checklist (Android · Arabic · RTL · dark + light)

- [ ] **Open `/vitals/new`** — fields/labels render in **Cairo**, teal focus ring on focus, inputs on the elevated surface; the disclaimer + non-diagnostic framing unchanged.
- [ ] **Open a date/time picker** (e.g. the vital's date+time) — the **wheel sheet opens (NOT a calendar/clock input)**, columns are full-width (no blank Android surface), rows are 48dp, the selected row shows **fill + check + bold**, and the value commits **only on Done** (Cancel/backdrop discards). Clear empties an optional field.
- [ ] **Open `/medications/new`** — name/dosage/instruction fields in Cairo; schedule section renders.
- [ ] **Test the weekday selector** — starts empty (opt-in); tapping selects (fill + check + bold); "Every day" selects all 7 then clears; order is Sun→Sat.
- [ ] **Add a duplicate time on a medication schedule** — confirm the **duplicate-time / conflict validation still blocks save** (the protected guard is unchanged; the reskin must not have affected it).
- [ ] **Test option chips** (e.g. medication form/category, task priority) — single-choice; selected = teal fill + check + bold, not color-only; ≥48dp.
- [ ] **Test form-field LTR isolation** where available (e.g. an email/phone/code field) — content stays **left-to-right and readable** (no forced right-align).
- [ ] **Toggle light / dark** — sheets sit on the lifted **card** surface with a hairline; teal primary, warm graphite (dark) / porcelain (light); buttons, status, and selected states stay coherent in both.
- [ ] **Two-step delete** (e.g. a doctor/contact row via `ItemActions`) — delete swaps to an inline confirm/cancel pair (no native Alert); confirm shows the loading spinner.

---

*MS-0 complete: the shared form & picker primitives now render in the Figma language (Cairo + teal + warm card surfaces + rounded-2xl buttons) with every behavior, API, validation, and the protected wheel-picker structure preserved. This unblocks MS-1 (reskinning the add/edit/detail forms that consume these primitives). Not staged, not committed.*
