# Phase MS-1B QA Patch 2 — Invite rebuild, picker footer, vital & daily-log detail/edit

**Date:** 2026-06-17
**Scope:** `/circle-members/invite`, the shared `PickerSheet` footer (global), `/vitals/[id]`, `/daily-logs/[id]`. **Not staged, not committed.**
**Refs:** `docs/claude-reports/2026-06-17-ms-1b-qa-patch-pickers-home-assignee.md`, `docs/claude-reports/2026-06-17-ms-1b-exact-add-task-appointment-visit-log.md`, the missing-screens audit + analysis.

---

## 1. Summary

Four QA corrections, two of which closed **old-UI visual leaks** on existing-item detail screens:

1. **`/circle-members/invite`** rebuilt in the Figma form language — gold sensitive-data banner, **role chips** (not inline text), raised name input, sticky teal create, reskinned one-time code reveal.
2. **`PickerSheet` footer** restacked to a clear, centered vertical layout — **تم** is an unmistakable teal CTA (bold + check), **مسح** a visible elevated button, **إلغاء** clear teal text.
3. **`/vitals/[id]`** detail/edit rebuilt in the Figma language (view + edit), removing the old `Screen`/`Surface`/`FormActions` UI.
4. **`/daily-logs/[id]`** detail/edit rebuilt in the Figma language (view + edit), card-based (no crowded inline text).

All real hooks, validation, permissions, the non-diagnostic / observational framing, the "غير محدّد" unset + distinct "بدون" pain states, two-step delete, and the protected wheel pickers (incl. 12-hour time + RTL date order) are preserved. No backend/schema/api/deps changed. An adversarial 3-verifier review returned **pass** (the one flagged item — an unused import — was fixed).

---

## 2. Files changed

- `src/features/invitations/invite-form.tsx` — **Fix 1**: full Figma rebuild (form + created-code reveal).
- `src/app/(app)/circle-members/invite.tsx` — hide native header in the canManage branch.
- `src/components/picker-sheet.tsx` — **Fix 2**: restacked, high-contrast footer actions (global).
- `src/components/figma/figma-form-screen.tsx` — **footer made optional** (read-only screens have no save bar); additive, the add screens still pass `footer`.
- `src/features/vitals/vital-editor.tsx` — **Fix 3**: Figma view/edit rebuild.
- `src/features/daily-logs/log-editor.tsx` — **Fix 4**: Figma view/edit rebuild.

**Deliberately NOT touched:** all schemas/hooks/api, `date-field.tsx`/`time-field.tsx` (RTL date order + 12-hour time from QA patch 1 are unchanged here), the shared fieldsets, every approved center/list screen, `package.json`. No locale keys were needed (all reused).

---

## 3. Invite member visual rebuild details

`InviteForm` is now built on `FigmaFormScreen`:
- **Header** (back + `invitations.inviteTitle`) + **gold sensitive-data banner** (`disclaimer = invitations.warning`).
- **Role card** — a `FigmaChipSelect`: each role is a rounded pill; **selected = teal fill + teal border + leading check + bold**, unselected = raised surface + hairline. No inline `OptionSelect` text.
- **Optional reference-name card** — a raised `FigmaFormField`.
- **Sticky teal create** (`FigmaButton`, loading/disabled wired to `create.isPending`).
- **Created-code reveal** reskinned in the same language: a `FigmaFormScreen` with the **`codeOnceWarning` gold banner**, the code on a raised card via **`LtrText` (selectable, LTR, letter-spaced)**, role + expiry meta, and copy / share / create-another `FigmaButton`s.

**Real logic preserved:** roles come from **`invitableRoles(actorRole)`** (the allowlist) with the unchanged `defaultRole`; `useCreateInvitation`, the one-time `setCreated` reveal, `copyInviteCode`/`shareInviteMessage`, and the role/expiry labels are unchanged. No fake roles or data. The `canManage` gate (and `managersOnly` fallback) is intact; the native header is hidden only in the canManage branch.

## 4. Picker action layout / visibility fix details

`PickerSheet`'s footer is a **stacked, centered, full-width** action set (no cramped row) — three consistent `Pressable`s replacing the previous mix:
- **تم / Done** — solid teal (`theme.primary`, pressed `primaryPressed`), **bold Cairo** label in `onPrimary` with a **leading check glyph**. No `disabled`/opacity path → it can never look greyed.
- **مسح / Clear** (only when `onClear` provided) — a visible **elevated** button (`backgroundSelected` fill + `border` + `text` label), readable in dark mode.
- **إلغاء / Cancel** — a **plain teal-text** button (`primaryText`), clearly readable in dark mode.

**Behavior preserved:** Done commits the draft, Cancel/backdrop/close discard, Clear only appears when provided. The Android-safe wheel body (`body` width 100%, `WheelColumn` flex:1, `ROW_HEIGHT = 48`) is untouched, the **12-hour time picker** (`time-field.tsx`) and the **RTL date column order** (`date-field.tsx`) are unchanged by this patch. The unused `FormButton` import was removed. Applies to **every** picker (date + time, all screens).

## 5. Vital detail/edit rebuild details

`VitalEditor` now renders the Figma language and hides the native header in the loaded branch:
- **Edit mode** (`canEdit`): `FigmaFormScreen` with the **gold non-diagnostic banner**, **`FigmaVitalFields`** (the same type/value/date-time/notes cards as `/vitals/new`), a **sticky teal save** with inline saved/error status, and a **two-step delete in a separate card** (not in the footer, not mixed with save).
- **View mode** (read-only): a read-only note + **card-based** display (type / value / date-time / notes), **no footer**.
- **Non-diagnostic preserved:** no normal/abnormal labels, no health-color coding (values render in neutral `theme.text`); BP split + other-type behavior come from the reused `FigmaVitalFields`/`prepareVital`. `useVital`/`useUpdateVital`/`useDeleteVital`, the `isOwner`/`canEdit` gate, `vitalDraftFromRow`, the unsaved-changes guard, and loading/error/not-found states are unchanged.

## 6. Daily log detail/edit rebuild details

`DailyLogEditor` likewise:
- **Edit mode**: `FigmaFormScreen` with the **gold observational banner**, **`FigmaDailyLogFields`** (keeps the **"غير محدّد" unset** chips + the distinct **"بدون" pain (null) vs 0** + the 4 note fields), sticky save + status, and a **separate two-step delete card**.
- **View mode**: a **calm observational note** (muted, **no gold banner**) + a **card-based** read-only layout (the `describeDailyLog` / `describeDailyLogNotes` rows rendered as labelled rows in cards) — not crowded inline text.
- **Preserved:** `useDailyLog`/`useUpdateDailyLog`/`useDeleteDailyLog`, `prepareDailyLog`, `dailyLogDraftFromRow`, the `isOwner`/`canEdit` gate, the unsaved guard, two-step delete, and the observational (non-diagnostic) framing. The daily-log list/center density was **not** touched (per the request to defer it).

---

## 7. Logic preserved confirmation

Verified against `HEAD` and by the adversarial review: all create/update/delete hooks, `invitableRoles`, `prepareVital`/`prepareDailyLog`, `vitalDraftFromRow`/`dailyLogDraftFromRow`, the invitation one-time reveal + copy/share, and the unsaved-changes guard are unchanged. No `*schema.ts`/`api.ts`/`hooks.ts` for vitals/daily-logs/invitations is in the diff; `package.json`/`package-lock.json` diff is empty.

## 8. Protected picker behavior confirmation

No native date/time inputs introduced. The wheel `PickerSheet` keeps its Android-safe structure and draft-commit-on-Done / cancel-discard semantics; the footer change is presentation-only. The 12-hour time UX and the RTL date column order are unchanged by this patch.

## 9. Permission / read-only behavior confirmation

`/vitals/[id]` and `/daily-logs/[id]` keep `canEdit = canManage || (canCollaborate && isOwner)`: editors get the edit form + delete; non-editors get the read-only card view (no save, no delete). `/circle-members/invite` keeps the `canManage`-only gate with the `managersOnly` fallback.

## 10. Destructive confirmation preservation

Both editors keep the **two-step inline delete** (a danger button → confirm/cancel pair with a loading state), rendered in a **separate card** from save (never mixed), navigating back on success. The picker Clear/Cancel are non-destructive.

## 11. Approved center/list screens untouched confirmation

This patch changes only `invite-form.tsx`, `circle-members/invite.tsx`, `picker-sheet.tsx`, `figma-form-screen.tsx` (additive footer-optional), `vital-editor.tsx`, and `log-editor.tsx`. No `figma-*` center/list screen (Home/`figma-home`, `today-overview`, `circle-dashboard`, the `*-card.tsx`) was modified by this patch — those appear in `git status` only from earlier uncommitted phases. The `FigmaFormScreen` footer change is additive and the six `/new` add forms still pass `footer`, so their save bar is unaffected.

---

## 12. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run check:mojibake` | **Clean** — 259 files |
| `git -c core.autocrlf=false diff --check` | **Clean** |
| `npx expo-doctor` | **21/21 passed** |
| Locale JSON parse (en + ar) | **Valid** (no new keys needed) |
| Adversarial review (3 verifiers) | **pass** — invite/picker/editors all verified; the one flagged item (an unused import) was fixed |

---

## 13. Is a new dev build required?

**No.** Pure JS/TS — no native module added or changed and `package.json` is untouched. Fast Refresh / a JS reload picks it up — **no `expo run:android`, prebuild, or EAS build needed.**

---

## 14. S24 Ultra QA checklist

- [ ] **`/circle-members/invite` role selector** — roles render as teal **chips/cards** (selected = fill + check + bold), not inline text; gold sensitive-data banner + sticky teal create.
- [ ] **Invitation code reveal** — after creating, the one-time code shows on a raised card (LTR, selectable) with copy / share / create-another and the gold "use once" banner.
- [ ] **Date picker actions** — تم واضح (teal + check), مسح واضح (elevated), إلغاء واضح (teal text), stacked and centered.
- [ ] **Time picker actions** — same stacked/centered, clear تم/مسح/إلغاء; the wheel still shows 1–12 + صباحًا/مساءً.
- [ ] **`/vitals/[id]`** — no old UI: Figma header + gold non-diagnostic banner + grouped cards; edit shows the fields + sticky save; view shows read-only cards; no normal/abnormal or health-color coding.
- [ ] **`/daily-logs/[id]`** — no old UI and **no crowded inline text**: edit shows the chip groups (unset + بدون) + notes; view shows a card-based read-only layout with a calm observational note.
- [ ] **Delete confirmation** — on both editors, delete asks confirm/cancel (two-step), kept separate from save, and returns to the list on success.
- [ ] **Read-only mode** — a non-editing viewer (no manage permission / not owner) sees the read-only card view with no save/delete.

---

*MS-1B QA patch 2 complete: the invite screen and both existing-item detail/edit screens (vitals, daily logs) are rebuilt in the Figma language — closing the old-UI leaks — and the picker footer is a clear stacked layout with an unmistakable teal "تم". All real logic, permissions, non-diagnostic/observational framing, unset/pain-none states, two-step delete, and protected pickers are preserved; the daily-log list density was intentionally left for later. Not staged, not committed.*
