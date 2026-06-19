# Phase MS-1B QA Patch — RTL picker order, Done visibility, Home quick access, Task assignee

**Date:** 2026-06-17
**Scope:** Four S24 QA corrections — shared date/time pickers (global), the Home quick-access section, and `/tasks/new`. **Not staged, not committed.**
**Refs:** `docs/claude-reports/2026-06-17-ms-1b-exact-add-task-appointment-visit-log.md`.

---

## 1. Summary

Four targeted QA fixes, three of them in shared/global surfaces:

1. **RTL date picker column order** — in Arabic the wheel now reads **اليوم · الشهر · السنة from the right** (day rightmost); LTR keeps the ISO year-month-day order. Applied globally in `DateField`.
2. **Picker "تم" visibility** — Done is now a solid **high-contrast teal CTA** (bold Cairo + leading check), never reading as dim/disabled. Applied globally in `PickerSheet`.
3. **Home quick access** — expanded from 4 to **8 tiles** (vitals, daily-logs, doctors, members, medications, tasks, appointments, **visits**) in a 4-up wrapping grid, reusing the exact Figma quick-action visual language.
4. **Task "تعيين إلى"** — the assign-to-me toggle is replaced by a Figma-style **selector of REAL circle members** (no fake names), since the data model safely supports it.

All four preserve the stored formats, the protected wheel-picker behavior, the 12-hour Arabic time UX, validation, and permissions. An adversarial 3-verifier review (pickers · home · assignee+boundary) returned **pass** on all three with one benign `concern` (§5).

---

## 2. Files changed

- `src/components/date-field.tsx` — **Fix 1**: reorder the wheel columns for RTL.
- `src/components/picker-sheet.tsx` — **Fix 2**: Done is a dedicated high-contrast teal CTA.
- `src/features/care-circle/figma-home.tsx` — **Fix 3**: expand `quickActions` to 8 + a 4-up wrap grid.
- `src/features/tasks/task-form.tsx` — **Fix 4**: real circle-member assignee selector (consumes the existing `useCircleMembers`).
- `src/locales/en.json`, `src/locales/ar.json` — 3 additive task keys (both locales): `tasks.fields.assignedTo`, `tasks.assignNone`, `tasks.assignMe`.

**Deliberately NOT touched:** `date-time-shared.ts` (formats/helpers), `time-field.tsx`, all schemas/hooks/api, the circle-members data layer (only **consumed**), every approved add/center screen except the Home quick-access section, `package.json`.

---

## 3. RTL date picker column-order fix details

`DateField` now builds the three wheel columns and orders them by direction:
```ts
const dateColumns = I18nManager.isRTL
  ? [dayColumn, monthColumn, yearColumn]
  : [yearColumn, monthColumn, dayColumn];
```
Because an RTL flex row places the first child at the **right** edge, the rightmost column becomes **اليوم (day)**, then **الشهر (month)**, then **السنة (year)** — the natural Arabic reading order. LTR keeps the existing `year · month · day`. The reorder is **purely visual**: each `WheelColumn` keeps its own `value`/`onSelect`, and `formatYmd`, `clampToMin` (leap-safe day clamp), and `minDate` clamping (`firstYear`/`minMonth`/`minDay`) are byte-identical to `HEAD`. The stored/emitted value is unchanged **`YYYY-MM-DD`**. No native input introduced. (Applies to every `DateField` across the app.)

## 4. Picker Done visibility fix details

In `PickerSheet`, **Done** is now a dedicated solid CTA instead of a quiet button:
```tsx
<Pressable onPress={onDone}
  style={({ pressed }) => [styles.done, { backgroundColor: pressed ? theme.primaryPressed : theme.primary }]}>
  <ThemedText style={[styles.doneLabel, Cairo.bold, { color: theme.onPrimary }]}>{`${Glyph.check}  ${doneLabel}`}</ThemedText>
</Pressable>
```
- Background = **Sanad teal** (`theme.primary` = `#2E8A7B` light / `#4BA898` dark), pressed = `primaryPressed`.
- Label = **bold Cairo** in `onPrimary` (readable: `#0F0E0C` dark / `#FFFFFF` light; ~7:1 contrast) with a leading **check glyph** — clearly the confirm action.
- **No disabled/opacity path** — it can never look greyed.
- **Clear** (secondary) and **Cancel** (plain) remain visible `FormButton`s. Behavior unchanged: draft commits **only on Done**; backdrop / close icon / Cancel **discard** (the draft is local state). The Android-safe body (full-width column block, `WheelColumn` flex:1, 48dp rows) is untouched. Applies to **every** picker sheet (date + time).

## 5. Home quick-access expansion details

`figma-home.tsx`'s `quickActions` grew from 4 to **8**, all real routes, in the natural RTL order:

| Tile | Route | Icon | Tile | Route | Icon |
|---|---|---|---|---|---|
| القياسات الحيوية | `/vitals` | Activity | الأدوية | `/medications` | Pill |
| السجلات اليومية | `/daily-logs` | FileText | المهام | `/tasks` | ListChecks |
| الأطباء | `/doctors` | Stethoscope | المواعيد | `/appointments` | Calendar |
| الأعضاء | `/circle-members` | Users | الزيارات | `/visits` | UserPlus |

(All 8 routes resolve to real screens; the QA-missing **الزيارات / `/visits`** is included.)

- **Same visual language:** each tile is the existing `Pressable` + `IconChip` (size 40, r12, iconSize 20) + 2-line label on a `c.card` surface with `c.border` hairline and `FigmaRadius.r16` — **no NavCard / DashboardTile**.
- **Layout:** the grid now `flexWrap`s with `columnGap`/`rowGap` 12 and each tile gets an **exact computed width** `(width − gutter·2 − 12·3) / 4` (via `useWindowDimensions`), so 4 fit per row → two clean rows of four. RTL ordering follows the array order (first tile top-right).
- **Nothing else on Home changed** — the header, care-loop hero, next-dose, today's doses list + inline status logging, the emergency banner, the appointment card, and the circle switcher are all untouched (the diff is only the imports, the `quickActions` array, the tile-width const, and the grid/tile styles).

## 6. Task assignee UI / data decision

**Real member assignment IS safely supported now — implemented the "yes" path.**
- **Why it's safe:** `TaskInput.assigned_to` is already `string | null` (a free user-id FK; `api.ts`/`schema.ts` unchanged), and a safe existing hook — **`useCircleMembers(circleId)`** (`src/features/circle-members/hooks.ts`) — lists the real roster with `userId`, `fullName`, `email`, `status`, and `isSelf`.
- **What was used:** the assign-to-me `Switch` is replaced by a **"تعيين إلى" `FigmaChipSelect`** whose options are:
  1. **"بدون تعيين"** (`tasks.assignNone`) → `assigned_to = null` (the unchanged default).
  2. **"أنا"** (`tasks.assignMe`) → the current user's id — the **same id the old toggle produced**.
  3. every **active, non-self** circle member with a name/email, labelled by **`member.fullName ?? member.email`** — **real data only, no invented names**.
- **Payload:** `assigned_to: assignedTo === '' ? null : assignedTo`. Assigning to another member stores that member's `userId`, which the free `assigned_to` FK accepts safely. **No backend / schema / migration / notification workflow** was added — the patch only consumes the existing hook.

---

## 7. Logic preserved confirmation

Verified against `HEAD` and by the adversarial review:
- **Task create:** `taskSchema.safeParse` + the full payload (title/description/category/priority/due_date/due_time/notes) unchanged; only `assigned_to` now comes from the selector; `useUnsavedChanges` tracks `assignedTo` (instead of `assignToMe`); the `/tasks/new` manager-only gate and the unsaved-changes guard are unchanged.
- **Date:** `YYYY-MM-DD` I/O, leap clamp, and `minDate` clamping unchanged (reorder is visual only).
- **No backend/api/schema/hook touched** — `tasks/api.ts`, `tasks/schema.ts`, `tasks/hooks.ts`, and `circle-members/*` have empty diffs; no deps added.

## 8. Protected picker behavior confirmation

Both `DateField` and `TimeField` still open the wheel `PickerSheet` (no native date/time inputs). The Android-safe structure (full-width column block, `WheelColumn` flex:1, 48dp rows), **draft-commit-on-Done**, and **Cancel/backdrop discard** are all preserved; the Done restyle is presentation-only.

## 9. 12-hour HH:MM preservation confirmation

`TimeField` is untouched by this patch — it still shows the **1–12 + صباحًا/مساءً** wheel and stores **24-hour `HH:MM`**. The task due-time (and every other time field) is unaffected.

## 10. Approved screens untouched confirmation

The only files changed by this patch are the shared pickers (`date-field.tsx`, `picker-sheet.tsx` — global, by request), `figma-home.tsx` (**only** the quick-access section), `task-form.tsx`, and the two locales. No other `figma-*` center screen is changed; `/medications/new`, `/vitals/new`, `/appointments/new`, `/visits/new`, `/daily-logs/new` change only through the **global picker fixes** (Done + RTL date order), which preserve all their behavior. (The other entries in `git status` — the MS-1B add-screen files and the pre-existing `*-card.tsx`/`circle-dashboard`/`today-overview`/`eslint.config.js`/`dashboard-tile.tsx`/older reports — are not part of this patch.)

---

## 11. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run check:mojibake` | **Clean** — 259 files |
| `git -c core.autocrlf=false diff --check` | **Clean** |
| `npx expo-doctor` | **21/21 passed** |
| Locale JSON parse (en + ar) | **Valid** — 3 new keys in both, additions only |
| Adversarial review (3 verifiers) | **pass / pass / pass** — 0 regressions; 1 benign `concern` (§6 self-dedupe) |

---

## 12. Is a new dev build required?

**No.** Pure JS/TS — no native module added or changed and `package.json` is untouched. The new Home icons (`Pill`, `ListChecks`, `UserPlus`) are exports of the already-installed `lucide-react-native`. Fast Refresh / a JS reload picks it up — **no `expo run:android`, prebuild, or EAS build needed.**

---

## 13. S24 Ultra QA checklist

- [ ] **Date picker in Arabic** — open any date wheel; the **rightmost** column is **اليوم**, then **الشهر**, then **السنة**; picking a date still saves correctly (and respects min-date where set, e.g. medication schedule).
- [ ] **Done button** — the **تم** action is a clearly visible **teal** button with a check, never looking grey/disabled; **مسح** and **إلغاء** still visible; Done commits, Cancel/backdrop discards.
- [ ] **Home quick access** — shows **8** tiles including **الزيارات**, in two rows of four, same chip/card style; each navigates to its real screen.
- [ ] **`/tasks/new` assignee** — the assignee area shows a **"تعيين إلى"** selector (Figma chip style) with **"بدون تعيين"**, **"أنا"**, and real circle-member names.
- [ ] **No fake names** — only real members (and "أنا"/"بدون تعيين") appear; an unnamed member without name/email is omitted, not faked.
- [ ] **Task save still works** — creating with "بدون تعيين", "أنا", and another member each persists the right `assigned_to` (null / self id / member id).
- [ ] **Time picker** — still **1–12 + صباحًا/مساءً** and stores **HH:MM** (task due time, etc.).
- [ ] **Light / dark sanity** — date columns, Done CTA, Home tiles, and the assignee chips read coherently in both themes.

---

*MS-1B QA patch complete: RTL date columns read day→month→year from the right, the picker Done is an unmistakable teal CTA, Home quick access reaches all eight important areas (incl. visits), and the task assignee is a real-member selector with no fabricated data — all with the stored formats, protected pickers, 12-hour time UX, validation, and permissions preserved. Not staged, not committed.*
