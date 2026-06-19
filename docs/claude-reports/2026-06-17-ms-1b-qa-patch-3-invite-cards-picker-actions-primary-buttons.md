# QA Patch 3 — Invite role cards, picker actions, primary button visibility

**Date:** 2026-06-17
**Scope:** `/circle-members/invite` role selector, the shared `PickerSheet` footer (global), and the shared `FigmaButton` primary (global, covers all new Figma-form save/create actions). **Not staged, not committed.**

---

## 1. Summary (the three headline outcomes)

- **The invite role selector is now LARGE STACKED CARDS, not chips.** Each role is a full-width rounded card with a radio + title + description; selected = Sanad teal tint + teal border + filled check; unselected = raised surface + hairline. (The previous chip-style solution was replaced, as requested.)
- **The picker actions are CENTERED, VERTICALLY STACKED, and clearly visible.** "تم" is Sanad-teal bold; "مسح" and "إلغاء" are high-contrast (near-white in dark). Not right-aligned, no dark/low-contrast text.
- **Primary buttons are globally visible.** The shared `FigmaButton` now renders enabled primaries as full-opacity filled Sanad teal with a high-contrast label, and renders the **disabled** state as a clear neutral grey instead of a faded-teal that looked dim/hidden.

---

## 2. Files changed

- `src/components/figma/figma-form-screen.tsx` — added **`FigmaCardSelect`** (large stacked option cards: radio + title + description) + its styles; imported `Check`.
- `src/features/invitations/invite-form.tsx` — role selector switched from `FigmaChipSelect` to **`FigmaCardSelect`** with role titles + descriptions.
- `src/components/picker-sheet.tsx` — footer actions rebuilt as **centered, stacked text actions** (teal تم, near-white مسح/إلغاء).
- `src/components/figma/figma-button.tsx` — **disabled state = clear neutral grey** (was 50%-opacity faded teal); enabled/loading appearance unchanged.
- `src/locales/en.json`, `src/locales/ar.json` — added **`circleMembers.roleDescriptions`** (all six roles, both locales).

(Everything else in `git status` — `date-field`, `figma-home`, the add forms/fields, the editors, the `*-card.tsx`, `today-overview`, `circle-dashboard`, `eslint.config.js`, `dashboard-tile.tsx`, and prior reports — is from earlier **uncommitted** phases, not this patch.)

---

## 3. Fix 1 — Invite role selector is now large cards (not chips)

New reusable **`FigmaCardSelect<T>`** renders each option as a full-width, vertically **stacked card**: a `flexDirection: 'row'` Pressable (`paddingVertical 12 / paddingHorizontal 14`, `borderWidth 1.5`, radius 12) containing a radio circle on the start + a column with a **title** (15/600) above a **description** (13, muted). It is not a chip and not inline text.
- **Selected:** `theme.primaryBg` tint + `theme.primary` border + a **filled teal radio with a white `Check`** — Sanad teal, not the export's blue.
- **Unselected:** `theme.backgroundSunken` raised surface + `theme.border` hairline.

In `invite-form.tsx`, the role options are built from the **real allowlist** `invitableRoles(actorRole)` mapped to `{ value, title: circleMembers.roles.X, description: circleMembers.roleDescriptions.X }` — no fake/hardcoded roles. `useCreateInvitation` and the one-time created-code reveal are unchanged. The **Create button** (`invitations.create`) is a full-width filled-teal `FigmaButton` in the sticky footer, enabled on open (disabled only while `create.isPending`). The six `roleDescriptions` were added to both locales.

## 4. Fix 2 — Picker actions centered/stacked and visible

`PickerSheet`'s footer is now a **vertical, centered** stack of text actions (`styles.actions` is a column with `gap`; each action is a `Pressable` with `actionRow` = centered + `actionLabel` `textAlign:'center'`, `fontSize 17`):
- **تم / Done** → `theme.primary` (Sanad teal), **bold**.
- **مسح / Clear** (only when `onClear` provided) → `theme.text` (near-white in dark, high contrast).
- **إلغاء / Cancel** → `theme.text` (near-white in dark, high contrast).

No right-alignment; no dark/low-contrast `onPrimary` text. **Behavior preserved:** Done commits, backdrop/close/Cancel discard, Clear only shows when provided. The Android-safe wheel body (`body` width 100%, `WheelColumn` flex:1, `ROW_HEIGHT = 48`) is untouched, and this patch did not alter the RTL date column order or the 12-hour time picker (those live in `date-field.tsx`/`time-field.tsx` from an earlier patch and are unchanged here).

## 5. Fix 3 — Primary action buttons globally visible

The shared **`FigmaButton`** (used by every new Figma-form primary action — `إنشاء دعوة`, `إضافة موعد`, `إضافة مهمة`, `إضافة زيارة`, `إضافة دواء`, `إضافة قياس`, `حفظ السجل اليومي`/`إضافة سجل يومي`, plus the vital/daily-log editor saves) now disambiguates disabled from busy:
```ts
const inactive = disabled && !loading;
// inactive  -> backgroundColor mutedSurface + border, label muted  (clearly disabled, not a faded teal)
// otherwise -> backgroundColor primary (vivid teal), opacity 1     (enabled vivid; loading keeps teal + spinner)
```
- **Enabled** = filled Sanad teal + high-contrast `onPrimary` label, full opacity — never dim/hidden. (Byte-equivalent to before for the enabled case.)
- **Disabled** = a clear neutral grey, so a not-yet-dirty add form reads as "disabled," not as a broken faded-teal button.
- **Loading** keeps the vivid teal fill + spinner.

All listed create/save actions use `FigmaButton` with the default primary variant, so this one change makes them all clearly visible.

---

## 6. Validations

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run check:mojibake` | **Clean** — 259 files |
| `git -c core.autocrlf=false diff --check` | **Clean** |
| `npx expo-doctor` | **21/21 passed** |
| Locale JSON parse (en + ar) | **Valid** — `roleDescriptions` added to both |
| Adversarial review (3 verifiers) | invite-cards **pass**, buttons-boundary **pass**, picker **pass** (its lone flag was a wording technicality — `date-field.tsx` shows modified from the earlier RTL patch, not this one; the picker footer + `time-field` are correct/untouched) |

**Behavior / boundary preserved:** no backend/hooks/schemas/api changed (consuming existing hooks only); no dependencies added (`package.json`/lock diff empty); no approved center/list screen broadly rewritten (the only shared primitive touched is `FigmaButton`, whose change is additive — disabled look only).

---

## 7. Is a new dev build required?

**No.** Pure JS/TS — no native module or dependency change. Fast Refresh / a JS reload picks it up.

---

## 8. No commit

Nothing was staged or committed. `git add`, `git reset`, `git restore`, and `git clean` were not used. EAS / `expo run:android` / prebuild were not run.

---

## 9. S24 Ultra QA checklist

- [ ] **`/circle-members/invite`** — roles render as **large stacked cards** (radio + title + description), selected card teal-tinted with a check; **not** chips/inline.
- [ ] **Create button** (`إنشاء دعوة`) — full-width filled teal, clearly visible on open.
- [ ] **Date picker actions** — centered, stacked: **تم** teal, **مسح** white, **إلغاء** white; not right-aligned.
- [ ] **Time picker actions** — same; the wheel still shows 1–12 + صباحًا/مساءً.
- [ ] **Primary save/create buttons** across the new forms — vivid filled teal when enabled; clearly grey (not faded teal) when disabled; never hidden on dark.
- [ ] **Light / dark sanity** — role cards, picker actions, and primary buttons read coherently in both.

---

*QA Patch 3 complete: invite roles are large selectable cards (not chips), picker actions are centered/stacked with a teal "تم" and white "مسح"/"إلغاء", and primary buttons are globally visible (vivid teal enabled, clear grey disabled). Real role/invitation logic, picker behavior, and the boundary are preserved. Not staged, not committed.*
