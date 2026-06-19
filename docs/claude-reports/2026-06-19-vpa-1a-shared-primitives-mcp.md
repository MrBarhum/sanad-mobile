# VPA-1a — Shared Visual Primitives (Figma MCP parity)

**Date:** 2026-06-19
**Phase:** VPA-1a (shared primitives only — low-risk shared surfaces; no broad feature-screen edits).
**Mode:** Edit. Visual-only. **No commit. No stage.** No EAS / prebuild / Supabase / backend / schema / auth / SQL / edge-function / env / dependency / Expo-config changes.
**Baseline at start:** branch `master`, working tree **clean**, on top of `3e3f8d3 chore(config): add Expo ESLint flat config` (parent `615735d feat(ui): apply Figma form parity and visible CTAs`). The dirty tree shown in some earlier snapshots was stale — those edits are already committed.

---

## 1. Figma Make source used

| Field | Value |
|---|---|
| **Canonical link (this task)** | `https://www.figma.com/make/nIeplIvufiFjoJBZxC7zbX/Mobile-app-design-upload?t=Au75XfxmDZu83NM2-6` |
| **fileKey** | `nIeplIvufiFjoJBZxC7zbX` |
| **Link type** | Full **Figma Make** file (`/make/<fileKey>/…`) — a React/Vite/Tailwind v4 codebase, not a frame-based file. Inline styles + the shadcn `ui/*` primitives **are** the design spec. |
| **MCP read?** | **Yes — live, this session.** `get_design_context` on `nodeId 0:1` returned the source manifest; individual files read with `ReadMcpResourceTool` (server `plugin:figma:figma`, `file://figma/make/source/nIeplIvufiFjoJBZxC7zbX/…`). |
| **Authenticated user** | `ibrahim.khalifeh91@gmail.com` (per the 2026-06-19 audit `whoami`). |

> **Note on which file this is.** The required audit (`docs/claude-reports/2026-06-19-figma-mcp-full-visual-parity-audit.md`) inspected the **`--Copy-`** sibling (`MpgXzFWQpGYbO7x4S7HCgd`), which contains the appended `Add*` form screens. The **canonical** file used here (`nIeplIvufiFjoJBZxC7zbX`) contains the first-pass **center/list** screens + the shadcn `ui/*` primitives + style tokens, but **no `Add*` form screens**. That is fine for VPA-1a: the in-scope surfaces are *shared primitives*, whose geometry derives from the canonical **design tokens** and **button/card/input/sheet** language — not from any single form screen. Where the audit's per-form numbers were the only evidence (form save-CTA radius), they were cross-checked against the canonical token system rather than trusted blindly.

### Figma MCP resources / components inspected (live)
- `src/styles/theme.css` — design tokens (`--radius: 1.25rem` = **20px**; teal `--primary` `#2E8A7B`/`#4BA898`; `--input-background` `#EDE8DF`/`#26231E`; `--ring` teal).
- `src/styles/index.css`, `src/styles/fonts.css` chain (`globals.css` → 404, harmless; `theme.css` carries the tokens).
- `src/app/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `sheet.tsx`, `drawer.tsx`, `dialog.tsx` — the shadcn primitives the screens compose.
- `src/app/components/HomeScreen.tsx` — real inline usage (the canonical truth, since screens style inline).

### Canonical design facts extracted
- **Base radius** 20px. Modal/sheet/dialog surfaces use `rounded-t-lg` / `rounded-lg` = **20**. Cards = `rounded-2xl`(16) / `rounded-3xl`(24).
- **Filled action buttons** in the real screens (HomeScreen dose-actions, emergency "عرض") use `rounded-xl` = **12**, weight 600–700. The audit independently put the form **save CTA radius = 12**. → The figma-layer comments that claimed "rounded-2xl"(16) were a **misread**.
- **Horizontal gutter** = `px-5` = **20** everywhere (= the app's own `Gutter` constant). The form shell used 16; the sheets used 24.
- **Bottom drawer grab handle** = `h-2 w-[100px]` → height **8** (app used 5).
- **Inputs** use `bg-input-background` (the **sunken** `#EDE8DF`/`#26231E` tone), border 1px, `placeholder = muted-foreground`.

---

## 2. Files changed (7) and intentionally left unchanged (2)

`git diff --stat` → **7 files changed, 29 insertions(+), 28 deletions(-)**:

```
 src/components/date-field.tsx                        | 6 +++---
 src/components/figma/figma-button.tsx                | 4 ++--
 src/components/figma/figma-footer-primary-button.tsx | 9 +++++----
 src/components/figma/figma-form-screen.tsx           | 8 ++++----
 src/components/figma/form-button.tsx                 | 4 ++--
 src/components/form-modal.tsx                        | 14 +++++++-------
 src/components/picker-sheet.tsx                      | 12 ++++++------
```

**Left unchanged on purpose (verified already on-spec):**
- `src/components/button.tsx` (legacy `Button`) — primary is already filled, radius `Radius.md` = **12** (= Figma `rounded-xl`), weight 600, pressed→`primaryPressed`, and `fadedDisabled` already **excludes** the primary variant (no faint primary). Fully compliant; no edit.
- `src/components/dashboard-tile.tsx` — tile container radius `Radius.lg` = **16** already matches the design's `rounded-2xl`(16) quick-action/summary tiles. The design's quick-action chip is a 40×40 **`rounded-xl` square**, which the shared `GlyphChip` (out of scope) only renders as a **pill**; matching the icon size alone would enlarge an already-pill chip without true parity. No safe in-scope change → no edit.

---

## 3. Shared-primitive mismatches fixed

### Buttons → unify on Figma `rounded-xl` (12)
| File | Before → After | Figma evidence |
|---|---|---|
| `figma/figma-footer-primary-button.tsx` (the forced save CTA) | `borderRadius 18 → 12`; `minHeight 64 → 56`; label `fontWeight '800' → '700'`; comment updated | Filled action buttons = `rounded-xl`(12). Height **56** = Sanad primary-action floor (a documented, deliberate deviation above Figma's 52dp). Weight 700 sits in the design's 600–700 band and renders consistently on system fonts. |
| `figma/figma-button.tsx` (`FigmaButton`) | `borderRadius FigmaRadius.r16 → r12`; comment `rounded-2xl → rounded-xl` | same |
| `figma/form-button.tsx` (`FormButton`) | `borderRadius Radius.lg(16) → Radius.md(12)`; comments updated | same |

Result: **every** form/CTA button now shares radius **12** (legacy `Button` was already 12), matching the design's filled action-button language and making the footer CTA + the secondary `FormButton` directly beneath it in `FormModal` consistent.

### Form shell — `figma/figma-form-screen.tsx`
- Header / banner / scroll content horizontal gutter **16 → 20** (`Gutter`), matching the design's `px-5` and the app's own `Gutter` constant. Added `Gutter` to the theme import.
- Header `paddingBottom` left at **16** (= design `pb-4`). The inline body-rendered footer block is **byte-identical** (no sticky/pinned footer reintroduced; nothing moved into the `footer` prop).

### Inputs / date field — `date-field.tsx`
- Trigger background `backgroundElement → backgroundSunken` — matches the design's `--input-background` (the recessed input tone) and the figma text-field treatment.
- `borderWidth 1 → 1.5` and `paddingHorizontal 16 → 14` — aligns the date trigger to the figma form text field. `borderRadius` left at 12 (`Radius.md`).
- **Picker logic, `parseYmd`/`formatYmd`/`clampToMin`, the `I18nManager.isRTL` day/month/year column ordering, and all data flow are untouched.**

### Sheets / pickers / modals — `picker-sheet.tsx`, `form-modal.tsx`
- Sheet top radius `Radius.xl(24) → Radius.card(20)` — matches the design `rounded-t-lg` / `--radius` base = 20.
- Sheet content horizontal padding `24 → 20` (`Gutter`), unifying with the 20px gutter; `form-modal` header + content both moved to `Gutter`.
- Grab handle `44×5 → 48×8` — height **8** matches the design `h-2`; width kept at a conventional, accessible **48** (the vaul default is the wider 100px; a 48-wide handle reads cleanly on a phone sheet and is clearly more prominent than the prior 44×5).
- **Selection / scroll / commit logic and `onDone`/`onCancel`/`onClear` (picker) and `onSubmit`/`onClose` + no-backdrop-dismiss (modal) are untouched.**

---

## 4. CTA confirmation

The bottom primary CTA remains, at every call site, **visible · green/teal-filled · `Pressable`-based · body-rendered**:
- `FigmaFooterPrimaryButton` is still a **plain `Pressable`** filled with `theme.primary` (`#2E8A7B` light / `#4BA898` dark). It exposes **no `variant` / `disabled` / `style` prop**, so a caller cannot collapse it to faint/grey text.
- **No faint/grey disabled visuals** for validation-incomplete forms. The only state is `loading` (a busy spinner that blocks double-submit); the **idle CTA stays visibly filled**. Validation still happens in the caller's `onSubmit` (an invalid press shows inline errors, not a submit).
- It is rendered in the **body / scroll content** (the last block inside `FigmaFormScreen`'s `ScrollView`, inside `FormModal`'s `ScrollView`, and inline in `form-actions`) — **not** as a pinned/KAV-sibling footer and **not** moved into a `footer` prop. The old broken CTA abstraction was **not** reintroduced.
- `FigmaButton`/`FormButton`/legacy `Button` primaries are likewise always filled full-opacity teal, pressable unless busy.
- **No Figma brand-blue** (`#2F6FD0`/`#1B5FBE`/`#96BEF5`/`#1D2B42`) introduced; teal + Cairo + warm-dark baseline preserved; RTL/Arabic layout intact (no forced text alignment; logical flex; `ChevronRight` still the RTL back affordance).

---

## 5. No backend / infra changes

Confirmed by the diff and the cross-cut scope audit: **only** the 7 in-scope UI primitives changed. **No** changes to Supabase / backend / schemas / auth / SQL / edge functions / `.env`, **no** EAS, **no** prebuild, **no** `app.json` / Expo config, **no** `package.json` / lockfile / dependencies, **no** navigation / routes / validation / hooks. Nothing staged; nothing committed.

---

## 6. Validation results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **clean** — scanned 260 active source/config files, no strong mojibake signatures |
| `git -c core.autocrlf=false diff --check` | **exit 0** (no whitespace/conflict errors) |
| `npx tsc --noEmit` | **exit 0** |
| `npx expo-doctor` | **21/21 checks passed, no issues** |

### Adversarial review (8-agent workflow)
One verifier per changed file + a cross-cutting scope/CTA auditor independently re-ran `git diff`, read each file, and tried to falsify every constraint. **8/8 returned severity `none`**; all of `changeMatchesFigmaSpec`, `visualOnly`, `ctaConstraintsUpheld`, `rtlPreserved`, `scopeRespected` = **true**. The only two notes were correct recognitions of *intended* deviations (date-field border 1→1.5 vs the design's 1px for clearer field edges; grab-handle width 48 vs the drawer's literal 100px) — neither a violation.

---

## 7. Recommended Android QA checklist (S24-class, dark + light)

1. **Open an add form** (`tasks/new`, `medications/new`, `appointments/new`, `visits/new`, `daily-logs/new`, `vitals/new`, `circle-members/invite`):
   - Save CTA is a **filled teal** full-width button, **radius 12**, **~56dp** tall, label crisp — in **both** themes. Tapping while a form is incomplete shows **inline errors** (button never greys out / never goes faint).
   - Tap save with a valid form → spinner shows, **no double-submit**, navigates/saves as before.
   - Content sits in a **20px** side gutter; header back-button + title rhythm reads correctly in **RTL** (Arabic), back chevron points to the start edge.
2. **Date/time fields** (e.g. appointment/visit/medication dates): the trigger now reads as a **recessed (sunken) input** with a slightly heavier 1.5px border; opening the picker, scrolling wheels, Done/Clear/Cancel and the stored `YYYY-MM-DD` value all behave exactly as before. Confirm RTL day→month→year column order.
3. **Picker sheet & form modal**: sheet top corners ~**20** radius, a more visible **48×8** grab handle, 20px content gutter; backdrop/close/Cancel/submit behavior unchanged; CTA reachable.
4. **Edit/detail modals** that use `FormModal` (doctors, emergency-contacts, medication schedule): the body-rendered teal CTA + secondary cancel sit consistently (both radius 12); two-step delete confirms still work.
5. **Regression spot-checks**: medication/vitals/emergency **safety copy** intact; **Western digits** + LTR isolation on times/codes unaffected; no blue flash anywhere; touch targets (CTA ≥56, controls ≥48) hold.

---

## 8. Out-of-scope follow-ups noted (not done here)
- `figma/figma-bottom-sheet.tsx` (not in VPA-1a scope) still uses radius 24 + a 48×4 handle; align it to 20 / `h-2` in a later sheet pass for full consistency with `picker-sheet`/`form-modal`.
- The design's quick-action chip is a `rounded-xl` square; giving `dashboard-tile` true parity needs a shape/size option on the shared `GlyphChip` (out of scope).

**Stopping here per instructions: no commit, no stage.**
