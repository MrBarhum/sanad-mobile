# Sanad — Milestone 5 "The Redesign" — Full Session Report

**Author:** Claude (Opus 4.8, 1M context) · **Date:** 2026-07-18
**Branch:** `milestone-5-redesign` (off `master` @ `369c6c2`), in an isolated git worktree.
**HEAD:** `7164a82` · **31 commits** ahead of base · **not pushed, no PR opened.**
**Net change:** 95 files changed, **+2,413 / −3,989** (a ~1,576-line-lighter codebase), 17 files deleted, 3 added.

> This is the exhaustive, self-contained record of Milestone 5. The living per-phase document is `2026-07-17-milestone-5-redesign.md`; the on-device manual matrix is `2026-07-17-milestone-5-visual-qa-checklist.md`. This report folds both into one narrative and adds the final completion pass.

---

## 1. What Milestone 5 was

An **elder-grade, warm, calm, token-driven redesign** ("the suit") of the Sanad care-coordination app — a **visual-only** overhaul with a hard scope guard:

> **Zero behavior, routing, data, query, permission, or i18n-*semantic* change.** Copy was adjusted only for tone (the warm-voice pass) or where a label was a design artifact — always in `ar.json` **and** `en.json` at exact key parity.

The work was structured as Phases A–E plus a final **completion pass**, under standing rules: zero new native dependencies (Expo SDK 56 set only), `ar`/`en` parity after every change, RTL/a11y preserved, one conventional commit per unit, the validation quartet green after every phase, and **never push**.

### The validation quartet (green after every single commit and at the end)
| Gate | Command | Final result |
|---|---|---|
| Types | `npx tsc --noEmit` | ✅ 0 errors |
| Encoding | `node scripts/check-mojibake.js` | ✅ clean (254 active source/config files scanned) |
| Whitespace | `git -c core.autocrlf=false diff --check` | ✅ clean |
| i18n parity | `ar.json` == `en.json` key set, no empties | ✅ **1089 / 1089** |

---

## 2. Final status at a glance

| Phase | State | Headline |
|---|---|---|
| **A** — one token system | ✅ | `theme.ts` is the sole design-token source; IBM Plex Sans Arabic only (Cairo retired); WCAG contrast fixed; type floor 14 established. **P2-2 token half closed.** |
| **B** — core components | ✅ | Every visual job folded to **one** survivor component (Button, StatusBadge, Surface, FormField, OptionSelect, GlyphChip, EmptyState, FigmaSwitch); a11y labels localized. **P2-2 fully closed.** |
| **C** — screens | ✅ | All 15 live screens **+ the 4 Tier-C screens** on one visual language; state-defect fixes; dead files deleted. |
| **D** — moments of care | ✅ | Quiet completion moment (no gamification); motion respects reduced-motion; the **warm-voice «دفء عائلي هادئ»** applied and audited across both locales. |
| **E** — sweep + verify | ✅ | **P1-8 closed** (132 sub-14 sites raised to the 14 floor); a11y labels localized; font-scale/RTL device QA captured as a checklist deliverable. |

**Everything in the milestone backlog is closed except two documented, non-regression items:** the on-device font-scale/RTL QA (needs a physical device — it's the checklist), and the decorative per-index category-color cycle (purely aesthetic).

---

## 3. Phase A — one token system (P2-2 token half)

**The problem:** the app carried **two parallel design-token systems** and two typefaces.

| | **Winner (survives)** | **Loser (migrated away + deleted)** |
|---|---|---|
| File | `src/constants/theme.ts` | `figma-tokens.ts` + `form-typography.ts` |
| Color | `Colors{light,dark}` via `useTheme()` (a11y-tuned) | `FigmaColors`, `FigmaStatus`, `FigmaCategory` |
| Type | **IBM Plex Sans Arabic** (`FontFamily`) + a real `Type`/`FontSize` scale | `FigmaFontSize` (**sub-14**), `FigmaWeight`, **Cairo** |
| Geometry | `Radius`, `Spacing`, `IconSize`, `ChipSize`, `CardShadow`, `TouchTarget`, `Gutter` | `FigmaRadius`, `FigmaLayout`, `FigmaRing` |
| Access | `useTheme()` → `Colors[scheme]` | `FigmaColors[useColorScheme()]` (bypassed the theme system) |

**What was done:**
- **`theme.ts` became the single source of truth.** All 49 `figma-tokens` importers were migrated to `useTheme()`; `figma-tokens.ts` and `form-typography.ts` were **deleted**; **Cairo was retired** (removed from `_layout.tsx` `useFonts` and the `@expo-google-fonts/cairo` dependency in `package.json`). One typeface remains: IBM Plex Sans Arabic.
- **Unified type scale with a hard 14 floor** (`caption` 14 → `displayXL` 34), Arabic line-heights ≥ 1.5×.
- **WCAG contrast audit** (deterministic ratios on the exact palette, not LLM arithmetic) found and fixed several fails at the token level (commit `0f49e91`):
  - `textMuted` darkened (`#8A837A`→`#6D6760` light / `#908981` dark) to clear 4.5:1 on wells and cards — killing the classic grey-on-grey mHealth failure for older eyes.
  - Primary teal nudged darker (`#2E8A7B`→`#2A7F71`, light only) so the white-on-teal primary button clears AA (4.17 → 4.80).
  - `onAccent` fixed white→dark (`#2A1D05`) for the gold accent (2.78 → 5.91).
- **Method:** the 52-file consumer migration ran as a spec-driven workflow with **adversarial per-file verification** (104 agents), which caught a systemic regression — dropped `Cairo.semibold/bold` weight overrides falling back to Regular — that was then fixed across 6 files, plus 5 faithfulness reverts and 20 stale-comment cleanups.

**Commits:** `0f49e91`, `c55aa8e`, `2050491`, `642c372`, `bba4706`, `d5c535b`, `2d33bac`, `805a32b`, `95b333a`.

---

## 4. Phase B — core components (one implementation per job)

The "migrate Figma primitives to tokens" half of Phase B finished inside Phase A. What remained was the **dedup**: every visual job should have exactly **one** component. The early dedups:

- **Buttons (`443ff9c`):** 4 implementations → the single `Button` (+ `FigmaFooterPrimaryButton`, deliberately kept as a documented Android render-workaround, flagged for device QA). Deleted `FigmaButton` (12 consumers) and `FormButton` (3). FigmaButton's harsh solid-red danger → Button's calm soft danger; two lucide `Icon` props → semantic `iconName` via the ICONS registry (added `signOut`, `claim`).
- **Status pills (`9fe7026`):** folded `FigmaStatusPill` → the single `StatusBadge` across its 3 consumers via a status→tone map, and dropped a hardcoded `#5AAE85` "given" pill for the AA-safe `successFg`/`successBg`.
- **a11y (`70b3f79`):** header back/add + sheet close labels were hardcoded English (announced in English on every Arabic screen) → localized via `common.back`/`common.add`/`common.close`.

The remaining folds (card/field/chip/empty/sheet/header) were visual-decision-entangled and were completed in the **completion pass** (§8).

**Commits:** `443ff9c`, `24de14e`, `9fe7026`, `070460e`, `70b3f79`.

---

## 5. Phase C — screens

All 15 live screens were already on `theme.ts` + IBM Plex (Phase A) and at the 14 floor (Phase E). Screen-level work:

- **Defects fixed:** Explore's fixed-dark `FigmaColors.dark.error` (a light-mode bug); Vitals gained a loading spinner + error retry; Daily-logs' bare-text loading/error → spinner + card-with-retry; Home's completion hex → `successFg`.
- **Hardcoded status hex fully tokenized (`313b5ad`):** figma-home + figma-medications `DOSE_STATUS` → semantic `colorKey`s (AA-safe + mode-adaptive), the medications active-badge, and the emergency-card danger text → `errorFg`.
- **Loading skeletons (`14a5190`):** a new pure-JS `Skeleton` + `SkeletonList` (Animated opacity, honors OS reduce-motion) wired into all 10 list screens' loading branches.
- **Tier-C reskin (this session):** the 4 screens flagged as "least reskinned" — notification-settings, invitations-list, emergency contacts-manager, recipient profile-form — were audited. Their content was **already** on the redesign primitives (Surface, FormField, GlyphChip, EmptyState, StatusBadge, Button; themed native detail-screen headers; no hardcoded colors). The **one clash** was two native RN `<Switch>`es → replaced with the brand `FigmaSwitch` (`d003b9b`), with the now-orphaned `theme`/`useTheme`/`Switch`/`Platform` imports pruned.

**Commits:** `313b5ad`, `8315ac1`, `d003b9b` (+ the completion-pass folds that touch every screen).

---

## 6. Phase D — moments of care + the warm voice

- **Completion moment (`b337021`):** when all of today's doses are logged, the dose ring shows a quiet «اكتملت جرعات اليوم» check on the AA-safe `successFg` — **no** score/streak/points (the no-gamification rule). Care is not a game.
- **Motion:** the app's only real animation (the splash overlay) already respects OS reduced-motion; nothing new was added, so nothing new needed gating.
- **Warm copy — the «دفء عائلي هادئ» (calm family warmth) voice.** See §7 for the full guide + audit.

---

## 7. The copy voice — «دفء عائلي هادئ» + the audit

The owner-approved voice, now recorded as **law** in `CLAUDE.md`:

- **Simple Modern Standard Arabic**, no dialect, short sentences, **gender-neutral** (masdar/neutral forms) so a daughter, son, or nurse all read naturally.
- **Never guilt or alarm.** A missed dose is a *fact to act on*, not a failure — «جرعة فائتة» / «لم تُسجّل بعد». An empty day is *good news* — «يوم هادئ» / «… بعد» / «كل شيء على ما يُرام».
- **Errors say what happened + what to do**, no codes/jargon: «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» Use «تعذّر …», never «فشل»/«خطأ».
- **Celebration stays quiet** — plain «تم حفظ التغييرات» / «اكتملت جرعات اليوم». **No exclamation marks, no emojis** in core UI.
- **The care recipient is always spoken of with dignity** — «الشخص الذي تعتني به» / «الشخص الذي يتلقّى الرعاية», never a cold/clinical label.
- North star: `pulse.shareEmpty`. **English mirrors the same warmth.** When a warmer wording would change *meaning* (a medical/legal disclaimer, a canonical status enum «مفتوحة»/«فعّال», a precise field label or password rule), it is left and flagged — never guessed.

**Application:** commit `33d39a2` warmed the 74-key empty-state + error subset (`ar` + `en` together, 79 value-line changes in `ar.json`); the earlier `8d09b45` added the "try again" cues to the three error strings that lacked them.

**Audit (this session)** — I scanned **both locales** across six voice categories (errors, empties, confirmations, missed/overdue, success/celebration/greeting, hints/descriptions) plus a violation scan. Findings:

| Check | Result |
|---|---|
| Exclamation marks / emojis in `ar.json` or `en.json` | **0 / 0** (quiet celebration) |
| Harsh «فشل» / «خطأ» | **0** — all errors use «تعذّر …» |
| Missed-dose framing | fact-to-act-on («جرعة فائتة» / «لم تُسجّل بعد»), never blame |
| Empty-state framing | good news («يوم هادئ» / «… بعد» / «كل شيء على ما يُرام») |
| Canonical terminology | **0** «معلّق»; «مفتوحة» / «فعّال» intact (A8 respected) |
| Confirmations | plain + reassuring («يمكنك دعوته مجدّدًا لاحقًا») |
| Care recipient | always dignified |

**Deliberately untouched (per "flag, don't guess"):** canonical status enums, medical/legal disclaimers, precise field labels, and the `auth.errors.password` length rule («يجب … ٦ أحرف» — a factual constraint, not guilt). No semantically risky string was guessed. Parity held at 1089/1089.

---

## 8. The completion pass — one component per job

The deferred component dedups were each an owner "which look wins" ruling. All are now done and recorded as **law** in `CLAUDE.md`.

### 8.1 The card ruling — `Surface`
Everything folds onto the single `Surface` primitive, with one amendment:

> A card carries a **hairline border in BOTH themes** — the border defines the edge for older eyes and is what reads in dark mode, where a shadow barely registers. A **whisper-soft shadow** (`CardShadow`) sits *on top* in **light mode only**, as warmth; dark mode has border only. Tinted/sunken tones stay flat (single elevation step).

`FigmaCard` and `FigmaFormCard` are deleted. `Surface` gained a **`gap`** prop (groups a card's fields — FigmaFormCard's old job) and a numeric **`padded`**. `Card` is a named alias of `Surface`.

### 8.2 The one-wins survivors

| Visual job | Survivor | Folded away & deleted | Commit |
|---|---|---|---|
| Card / panel | `Surface` (`gap`, numeric `padded`) | FigmaCard, FigmaFormCard | `fbf25c9`, `fafd365` |
| Text field | `FormField` (+ `required`, `hint`) | FigmaField, FigmaFormField | `90f3215`, `fafd365` |
| Single-choice selector | `OptionSelect` (+ `card` variant, `description`) | FigmaChipSelect, FigmaCardSelect | `fafd365` |
| Identity / icon chip | `GlyphChip` (semantic `iconName` + `color`) | icon-chip | `90f3215` |
| Empty state | `EmptyState` (each list shows its feature icon) | 10 inline figma empties | `24f55c7` |
| Toggle | `FigmaSwitch` (48×28 brand pill) | 2 Tier-C native `<Switch>`es | `d003b9b` |

**Notes on judgment calls:**
- **`WeekdaySelector` was NOT folded** into `OptionSelect`. It is a **multi-select (checkbox)** control; folding it into the single-select radio `OptionSelect` would change behavior — forbidden in a visual-only phase. Its chip **visuals** were aligned to `OptionSelect` instead (unselected text color + selected weight) so the two chip groups match in the schedule modal.
- **`EmptyState` fold rule:** each list's empty shows **its feature's semantic icon** (activity/task/appointment/visit/doctor/claim/medication/vital/notification/dailyLog). The `GlyphChip` fold required mapping the old lucide line-icons and the `present.ts` pulse-event visuals to the semantic ICONS registry (added `weight`, `sleep`, `sparkle`). **Error states keep their own bespoke card** — they are not empties, and their retry/refetch UI is a different concern.

### 8.3 One sheet chrome, one header back affordance
- **Canonical sheet chrome = the `FormModal`/`PickerSheet` card** (centered `backgroundElement` card, `Radius.card` top corners, hairline border, 8dp `backgroundSelected` grab handle, `MaxFormWidth`, `sectionTitle` title). `FigmaBottomSheet` was the outlier (`Radius.xl`, borderless, a 4dp alpha handle, a raw 18/bold title) → **rebuilt** on the canonical chrome, **behavior untouched** (`4d66b7d`). The three sheets **stay distinct components on purpose** — each encodes a different behavior contract (FormModal: explicit-close + keyboard-avoidance + submit/cancel footer; PickerSheet: backdrop-cancel + Done/Clear/Cancel; FigmaBottomSheet: backdrop-dismiss action sheet). A visual-only phase must not merge behavior.
- **Canonical back affordance = `FigmaHeader`'s round 44dp pill + back arrow.** `FigmaFormScreen`'s header used a smaller 36dp `Radius.md` button + ChevronRight → **aligned** to the 44dp pill + ArrowRight (`4d66b7d`). The two header components remain distinct (list headers: centered title + add button; form headers: start title+subtitle + divider); only the shared back atom is unified.

### 8.4 P2-1 dead-file deletion (`54847a3`)
The catalogued dead set was grep-verified (0 importers) and deleted: `today-overview`, `today-care-ring`, `tasks-card`, `appointments-card`, `vitals-card`, `vitals-center`, `visits-card`, `daily-logs-card`, `daily-logs-center`. The like-named **live** helpers (`today.ts`, the `*-fields.ts` draft helpers, `describe.ts`) were spared.

---

## 9. Phase E — sweep + verification

- **E1 / P1-8 closed (`7ea2ae1`):** swept the whole codebase and raised **132 content sub-14 sites to the 14 floor** across 31 live screens + care-loop-ring + ThemedText, with broken co-located line-heights bumped. The only sub-14 remaining is the sanctioned bell unread-count badge (decorative chrome, not content).
- **E2 a11y:** icon buttons carry localized labels; contrast fixed at the token level (§3); ≥48dp targets preserved; status is always icon + text (never color-only).
- **E3 font-scale QA → the visual-QA-checklist deliverable:** an on-device matrix (Home / meds / a form / a detail at 100/130/200%, both themes, RTL). This needs a physical device; the flagged runtime risks are the E1 reflow, the tab-bar/ring label raises, and the `FigmaFooterPrimaryButton` system-font workaround.

---

## 10. Files deleted / added

**Deleted (17)** — dead duplicates and the retired token/font layer:
```
components/figma/  figma-button · figma-card · figma-field · figma-status-pill ·
                   figma-tokens.ts · form-button · form-typography.ts · icon-chip
features/          appointments/appointments-card · care-circle/today-care-ring ·
                   care-circle/today-overview · daily-logs/daily-logs-card ·
                   daily-logs/daily-logs-center · tasks/tasks-card ·
                   visits/visits-card · vitals/vitals-card · vitals/vitals-center
```

**Added (3):**
```
src/components/skeleton.tsx                                   (pure-JS loading skeleton)
docs/claude-reports/2026-07-17-milestone-5-redesign.md       (living report)
docs/claude-reports/2026-07-17-milestone-5-visual-qa-checklist.md  (device QA matrix)
```
(This full-session report is the fourth deliverable.)

---

## 11. Standing laws recorded in `CLAUDE.md`

Milestone 5 added these to the project's standing decisions (they OVERRIDE default behavior for all future work):
1. **One token system is law** — `theme.ts` sole source; no second token/font layer; one typeface (IBM Plex Sans Arabic).
2. **Type floor = 14** — nothing below 14 for content; body 16; Arabic line-heights ≥ 1.5×.
3. **Danger tone is calm + restrained** — `errorFg` / soft `dangerSolid`, never alarm-red; gold accent reserved for celebration + empty states; caution uses amber `warningFg`; status is never color-only.
4. **Care is not a game** — no streaks/scores/points/leaderboards; quiet completion moment; motion respects reduced-motion.
5. **The card ruling** — one `Surface`, hairline border both themes, whisper-shadow light-only.
6. **One component per job** — the M5 survivors (Surface, FormField, OptionSelect, GlyphChip, EmptyState, FigmaSwitch).
7. **One sheet chrome, one header back affordance** — canonical chrome + 44dp pill back; behavior contracts stay separate.
8. **Copy voice «دفء عائلي هادئ»** — the full guide (§7).

---

## 12. Complete commit log (base `369c6c2` → HEAD `7164a82`, oldest first)

| Commit | Summary |
|---|---|
| `0f49e91` | feat(theme): unify the type scale + a11y contrast fixes on the single token system |
| `c55aa8e` | docs: record the understand map, contrast audit + Phase A foundation |
| `2050491` | refactor(care-ring): migrate the care-loop ring onto the single token system |
| `642c372` | refactor(figma-primitives): migrate the shared display primitives onto theme.ts |
| `bba4706` | refactor(figma-primitives): migrate header/tab-bar/sheet/form-screen onto theme.ts |
| `d5c535b` | refactor(figma-primitives): migrate the delete-target primitives onto theme.ts |
| `2d33bac` | docs: track Phase A migration progress (figma-tokens 49 → 43) |
| `805a32b` | refactor(tokens): consolidate every consumer onto theme.ts + retire Cairo — **Phase A complete** |
| `95b333a` | docs: close Phase A in the report + record standing rules in CLAUDE.md |
| `443ff9c` | refactor(button): fold FigmaButton + FormButton into the single Button — **Phase B started** |
| `24de14e` | docs: record the Button consolidation |
| `9fe7026` | refactor(status): fold FigmaStatusPill into the single StatusBadge |
| `070460e` | docs: record the StatusBadge fold + a11y label fix |
| `70b3f79` | fix(a11y): localize the header back/add + sheet close labels (E2) |
| `7ea2ae1` | fix(a11y): raise every content font size to the 14 floor (E1 / **P1-8 closed**) |
| `b337021` | feat(care): Phase-D completion moment + calm loading/error states |
| `8e4728d` | docs: finalize the report + add the visual-QA checklist deliverable |
| `313b5ad` | refactor(status): tokenize the hardcoded dose-status + emergency danger colors |
| `8d09b45` | fix(copy): add try-again cues to the error strings that lacked them (Phase D) |
| `14a5190` | feat(loading): add a reduced-motion Skeleton primitive + wire it into the list screens |
| `8315ac1` | docs: record status-hex tokenization, error copy + skeletons |
| `2d46894` | docs: refresh the closed/deferred backlog lines |
| `54847a3` | refactor(cleanup): delete the P2-1 dead-file set (unrouted, 0 importers) |
| `fbf25c9` | refactor(card): fold FigmaCard onto the single Surface (card ruling) |
| `33d39a2` | feat(copy): warm-voice pass on empty-state + error copy — «دفء عائلي هادئ» |
| `90f3215` | refactor(chip): fold IconChip onto the single GlyphChip identity chip |
| `fafd365` | refactor(ui): fold form primitives onto Surface/FormField/OptionSelect |
| `24f55c7` | refactor(ui): fold inline list-empties onto the shared EmptyState |
| `4d66b7d` | refactor(ui): one sheet chrome + one header back affordance |
| `d003b9b` | refactor(ui): tier-C toggles use the canonical FigmaSwitch |
| `7164a82` | docs: record the completion pass + voice guide as law — **milestone complete** |

---

## 13. How to review

1. **Read the diff by theme, not by file:** the migration commits (`0f49e91`…`805a32b`) are the token consolidation; the `refactor(...fold...)` commits are the one-per-job dedups; the two `feat(copy)`/`fix(copy)` commits are the warm voice.
2. **Confirm the scope guard held:** the diff should show no route changes, no query/hook/permission logic changes, no i18n *key* additions/removals (parity is 1089/1089 both before-this-pass and after). Copy value changes are tone-only.
3. **Run the quartet** from the worktree: `npx tsc --noEmit` · `node scripts/check-mojibake.js` · `git -c core.autocrlf=false diff --check` · the locale parity check.
4. **On-device pass:** work the visual-QA checklist (font scale 100/130/200%, both themes, RTL) — this is the one gate a headless environment can't clear.
5. **The taste calls to sanity-check:** the primary-teal darken (light only), warning=amber-not-gold, `Surface`'s border-in-both-themes, the 44dp back pill on form screens, and the warm-copy wording. Any of these is reversible by token name or string.

## 14. What remains (documented, non-regression)

- **On-device font-scale / RTL QA** — the manual matrix in the visual-QA checklist. Needs a physical device.
- **Decorative per-index category-color cycle** — purely aesthetic (list rows cycle accent hues by index); no correctness impact, low priority.

**Nothing was pushed.** All 31 commits live on `milestone-5-redesign` in the worktree, ready for the maintainer to review and merge.
