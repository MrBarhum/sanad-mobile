# Sanad — Milestone 5: The Redesign ("the suit")

**Branch:** `milestone-5-redesign` (off `master` @ 369c6c2) in an isolated worktree · one conventional commit per unit · no push/PR.
**Scope guard:** VISUAL ONLY. No behavior, routing, data, query, permission, or i18n-semantic change. Copy adjusted only where a label is a design artifact, always ar+en at parity.
**Validation quartet (green after every phase):** `npx tsc --noEmit` · `node scripts/check-mojibake.js` (254 files) · `git -c core.autocrlf=false diff --check` · locale parity (1089/1089, ar==en).

> Living document — updated per phase/screen. Status legend: ✅ done · 🔧 in progress · ⏭ planned.

## Status at a glance
| Phase | State | Headline |
|---|---|---|
| A — one token system | ✅ | theme.ts sole source; IBM Plex only (Cairo retired); A3 contrast fixed; **P2-2 token half closed** |
| B — core components | ✅ | **Buttons + status pills + card/field/chip/empty/sheet/header all folded** to one survivor each (**P2-2 closed**); a11y labels localized |
| C — screens | ✅ | all 15 live screens + the 4 Tier-C screens on one visual language; state-defect fixes done; dead files deleted |
| D — moments of care | ✅ | completion moment done (no gamification); motion respects reduced-motion; **warm-copy voice «دفء عائلي هادئ» applied + audited** |
| E — sweep + verify | ✅ | **E1 done → P1-8 closed** (132 sites raised); E2 a11y done; E3 font-scale → device checklist deliverable |

**Closed backlog items:** P1-8 (type floor), P2-2 (two token systems + button impls), P2-13 (tab-bar web-guard), part of P2-3 (semantic icons for the migrated buttons), P2-5-adjacent (vitals/daily-logs error recovery), the Explore light-mode scheme bug, all hardcoded status-color hex (now tokens), loading skeletons, **P2-1 dead-file deletion**, **every component dedup (card/field/chip/empty/sheet/header)**, and the **warm-copy voice pass**.
**Deferred (needs a device, documented, non-regressions):** the E3 font-scale device QA (the visual-QA checklist), and the per-index category cycles (decorative). All quartet-green; every commit is on `milestone-5-redesign` (no push).

---

## Step 0 — Git + baseline ✅
- `milestone-4.1-fixes` confirmed **fully merged into `master`** (`git rev-list --left-right --count master...milestone-4.1-fixes` = 0/0).
- Worktree `milestone-5-redesign` created off local `master` (== origin/master @ 369c6c2); `node_modules` junctioned from the main checkout so the quartet runs.
- **Baseline quartet green** before any change: tsc ✅ · mojibake ✅ (270) · parity ✅ (1087/1087) · diff ✅.
- **Step 0.2 (regenerated supabase types) — SKIPPED** (precondition not met): `grep list_care_activity|set_missed_dose_grace_minutes src/types/supabase.ts` = 0. The M4 localized casts stay (carry-over F2 remains open).

---

## Understand map (methodology)
Six parallel read-only agents (workflow `wf_391ee2a5-bee`, 0 errors, ~648k tokens, 183 tool calls) mapped: the two token systems + unified surface, the full ~69-file consumer blast radius, the Phase-B component/button set, the Phase-C screen inventory, the E1 sub-14 sweep, and the Phase-D design-artifact copy. The A3 contrast matrix was computed by me deterministically (WCAG math on the exact palette — not LLM arithmetic).

### The two token systems (P2-2)
| | **WINNER — survives** | **LOSER — migrate away, delete** |
|---|---|---|
| File | `src/constants/theme.ts` | `src/components/figma/figma-tokens.ts` + `form-typography.ts` |
| Color | `Colors{light,dark}` (a11y-tuned, richer: textMuted, semantic fg/bg, category ramp) | `FigmaColors{dark,light}`, `FigmaStatus`, `FigmaCategory` |
| Type | `FontFamily` = **IBM Plex Sans Arabic**; now a full `Type`/`FontSize` scale | `FigmaFontSize` (**sub-14** = P1-8), `FigmaWeight`, `FigmaFont` = **Cairo** |
| Geometry | `Radius`, `Spacing`, `IconSize`, `ChipSize`, `CardShadow`, `TouchTarget`, `Gutter` | `FigmaRadius`, `FigmaLayout`, `FigmaRing`, `withAlpha` |
| Access | `useTheme()` → `Colors[scheme]` (already used by 68 files) | `const c = FigmaColors[useColorScheme()]` (bypasses the theme system) |

**Decision (A4, owner-set): IBM Plex Sans Arabic wins; Cairo is retired.** Both palettes were already re-pointed to the same Figma-Make teal/porcelain/graphite values, so color consolidation is largely a mechanical rename onto `useTheme()`; the visible identity change is the typeface + the type-floor + the contrast fixes.

### Three styling tiers across live screens
- **Tier A** (pure Figma tokens + Cairo): Home, Medications(list), Tasks(list), Pulse, Appointments(list), Vitals, Visits(list), Daily-logs(list), Doctors, Members, Available-to-claim, Notifications-inbox, Account, Explore, Emergency-card.
- **Tier B** (hybrid — figma-form primitives that read theme.ts colors but render in Cairo): every add/edit form + editor, invite-form, onboarding-form, auth screens.
- **Tier C** (pure legacy theme.ts + IBM Plex, never reskinned): notification-settings, invitations-list, emergency contacts-manager, recipient profile-form. Highest-effort reskin targets — they visually clash with the redesign.

### Confirmed dead / unrouted (ignore or delete during sweep)
`today-overview`, `today-care-ring`, `tasks-card`, `appointments-card`, `vitals-card`, `vitals-center`, `visits-card`, `daily-logs-card`, `daily-logs-center`. **Do NOT delete** the like-named live data/helper modules: `today.ts`, the `*-fields.ts` draft helpers, `describe.ts`.

---

## Phase A — one token system ✅

**Complete.** theme.ts is the sole token source; `figma-tokens.ts` + `form-typography.ts` are deleted; Cairo is retired (removed from `_layout` `useFonts` + `@expo-google-fonts/cairo` dep); every consumer renders in IBM Plex on theme.ts. **P2-2's token half is closed** (the 4-button half closes in Phase B). Full quartet green. The 52-file consumer migration ran as a spec-driven workflow with **adversarial per-file verification** (104 agents) — which caught a systemic bug (dropped `Cairo.semibold/bold` weight overrides regressing to Regular) that I then fixed across 6 files, plus 5 `textMuted`→`textSecondary` faithfulness reverts and 20 stale-comment cleanups. Details below.


### A1/A4 — consolidation direction
- theme.ts is the sole source. `figma-tokens.ts` + `form-typography.ts` to be deleted once all consumers migrate; Cairo removed from `_layout.tsx` `useFonts` + the `@expo-google-fonts/cairo` dep.
- Migration mechanic: `const c = FigmaColors[scheme]` → `const c = useTheme()`; key remap: `card`→`backgroundElement`, `mutedSurface`→`backgroundSunken` (exact), `muted`→`textSecondary` (or `textMuted` for metadata — a **grey-on-grey fix** in dark), `elevated`→`backgroundSunken` (recessed) / `backgroundElement` (card) per context, `border`→`border` (adopt solid, drop the alpha hairline), `error`→`errorFg` (text) / `dangerSolid` (fill), `success`→`successFg`, `FigmaRadius.*`→`Radius.*` (value-identical), `FigmaFont.*`→`FontFamily.*` (extrabold→bold — IBM Plex has no 800), `withAlpha`→theme `withAlpha`.

### A2 — unified type scale (floor 14 = LAW) ✅ (in theme.ts)
| preset | size | line-height | family | usage |
|---|---|---|---|---|
| `caption` | 14 | 22 (1.57×) | regular | **the floor** — metadata, timestamps, hints, helper/error, pill+chip labels |
| `captionStrong` | 14 | 22 | semibold | field labels, eyebrows, active tab |
| `body` | 16 | 26 (1.63×) | regular | default reading text |
| `bodyStrong` | 16 | 26 | semibold | emphasized body, row values, primary button label, links |
| `cardTitle` | 18 | 28 (1.56×) | semibold | list-row / card titles |
| `sectionTitle` | 20 | 30 (1.5×) | bold | section headings |
| `subtitle` | 22 | 32 (1.45×) | bold | sub-hero headings, large stats |
| `hero` | 26 | 38 (1.46×) | bold | screen hero heading |
| `display` | 30 | 42 (1.4×) | bold | flagship greeting / dashboard hero |
| `displayXL` | 34 | 46 (1.35×) | bold | reserved oversized hero |
| `code` | 14 | 21 | mono | invite codes / IDs (raised to floor) |

Sanctioned sub-14 exceptions (decorative chrome only, never content): superscript count badge, «·» meta separator, and — pending a device check — the 3 bottom-tab labels + the ring's inner caption.

### A3 — contrast audit (WCAG, both themes) ✅ audit · 🔧 fixes at token level
Deterministic ratios on the exact palette. Text target 4.5:1, UI/icon 3:1. **Fails found & fixed in theme.ts (commit `0f49e91`):**

| token pair | theme | before | after fix | fix |
|---|---|---|---|---|
| `textMuted` → `backgroundSunken` | light | 3.07 ❌ | 4.58 ✅ | textMuted `#8A837A`→`#6D6760` |
| `textMuted` → background/card | light | 3.39 / 3.74 ❌ | 5.06 / 5.59 ✅ | (same) |
| `textMuted` → `backgroundSunken` | dark | 4.18 ❌ | 4.53 ✅ | textMuted `#8A837A`→`#908981` |
| `onPrimary` (white) → `primary` | light | **4.17 ❌** | **4.80 ✅** | primary `#2E8A7B`→`#2A7F71` (the button) |
| `onAccent` (white) → `accentSolid` | light | 2.78 ❌ | 5.91 ✅ | onAccent `#FFFFFF`→`#2A1D05` |
| `categoryGold` icon → card | light | 2.78 ❌ | 3.19 ✅ | categoryGold `#C8904A`→`#BA8645` |

Two remaining "fails" in the raw matrix (`onError`→`errorFg` dark; `onWarning`→`warningFg` light) are **non-occurring pairings** — the `on*`/`accentSolid`/`dangerSolid` filled-status tokens have **zero consumers** today, and filled badges will pair `on*` with the *solid* tokens (onError white on dangerSolid = 4.55 ✅; onAccent dark on accentSolid = 5.91 ✅). No change needed; `onAccent` fixed proactively for Phase-D use. All body/secondary/brand/badge text already passes (see full matrix in scratchpad `contrast.js`).

### A5 — rhythm
One 4pt `Spacing` scale + one `Radius` family already in theme.ts; ad-hoc values removed per screen as touched in Phase C.

### Consumer blast radius (69 files: 35 trivial · 28 moderate · 6 complex)
Hardest: `figma-tokens.ts` (linchpin), `figma-home.tsx` (102 refs), `figma-medications.tsx` (71), `figma-notifications.tsx` (47, sole `FigmaStatus`), `figma-emergency-card.tsx` (45), `figma-doctors.tsx` (42). Migration order: shared `components/figma/*` primitives first (every screen composes them), then feature screens, then delete `figma-tokens.ts` + `form-typography.ts` + Cairo loading.

**Migration record (figma-tokens importers: 49 → 0):**
- ✅ Shared `components/figma/*` primitives migrated by hand (highest reuse): `care-loop-ring` (exercises `ringTrack`, inlined `FigmaRing`), the display set (`figma-screen`, `icon-chip`, `figma-status-pill`, `figma-segmented-tabs`, `figma-list-row`), the survivors (`figma-header`, `figma-bottom-sheet`, `figma-form-screen` [+8 sub-14 raises, dark-mode check-color fix], `figma-tab-bar` [web-guard hook, label 13→14]), and the delete-targets (`figma-card`, `figma-button`, `figma-field`) migrated onto theme.ts (Phase B removes the components).
- ✅ 52 feature/form/auth consumers migrated via workflow `wf_61d897d7-8af` (migrate→verify pipeline; 29 clean, 23 flagged & fixed).
  - **Real regressions the verify caught & I fixed:** dropped `Cairo.semibold/bold` overrides that fell back to Regular — restored with `FontFamily.*` in sign-in (2 links), sign-up (1), form-actions (status), form-modal (close), picker-sheet (Done/Clear/Cancel/close/selected row), weekday-selector (selected chip).
  - **Faithfulness reverts:** 5 timestamp sites `textMuted`→`textSecondary` (figma-home, figma-pulse, figma-tasks, figma-vitals, available-to-claim) to keep the migration a pure 1:1 (metadata-quiet timestamps are a Phase-C design call, not a migration change).
  - **Doc comments:** 20 stale "Cairo + Figma tokens" comments corrected; `Cairo` grep is now clean (only `Africa/Cairo` remains).
- ✅ Deleted `figma-tokens.ts` + `form-typography.ts`; Cairo removed from `_layout` + `package.json`.

### Decisions & deliberate departures (owner can revert any by token name)
1. **primary teal nudged darker** (`#2E8A7B`→`#2A7F71`, light only) — required to clear AA on the white-on-teal primary button (4.17→4.80). Same teal identity; dark primary unchanged.
2. **warning/postponed = amber, not gold.** Figma reused the gold accent (`#C8904A`) for "warning". Per A3 the gold accent is reserved for **celebratory + empty-state** moments; caution uses the dedicated `warningFg` amber. Status stays icon+text (never color-only), so the shift is safe and on-brief.
3. **figma `elevated` → `backgroundSunken`** (recessed wells/inputs) rather than repointing the unused `backgroundRaised`. Light wells go a hair deeper (`#F7F3EE`→`#EDE8DF`), which reads as more intentional separation.
4. **`textMuted` ≈ `textSecondary` in light** after the darken (both must clear 4.5). The muted/secondary distinction now comes from weight/size, not a failing grey — by design (research: grey-on-grey is the documented mHealth failure for older users).

---

## Phase B — core components ✅

Note: the "migrate the existing Figma components to tokens" half of Phase B is **already complete** — every `components/figma/*` primitive was moved onto theme.ts in Phase A. What remains is the **dedup** (one implementation per category) — **now complete** (see the completion pass below).

- ✅ **Buttons (P2-2 button half closed).** 4 impls → `Button` (unified survivor) + `FigmaFooterPrimaryButton` (kept as a documented Android render-workaround; system font by design; flagged for on-device QA). Deleted `FigmaButton` (12 consumers) + `FormButton` (3); repointed all to `Button`. FigmaButton's danger (solid red) → Button's calm soft danger; secondary → `backgroundSelected`. Two lucide `Icon` props → semantic `iconName` via the ICONS registry (added `signOut`, `claim` — closes P2-3 for these). `443ff9c`.
- ✅ **Status pills (one implementation).** Folded `FigmaStatusPill`→`StatusBadge` across its 3 consumers (medications dose pills, appointments, visits) via a status→tone map (given/completed→success, postponed→warning+clock, missed/cancelled→error, unlogged→neutral+clock). Baked-in contrast fix: the dose "given" pill dropped hardcoded `#5AAE85` (fails AA as text in light) for the AA-safe `successFg`/`successBg`. StatusBadge label 13.5→14, glyph 13→14 (floor). `9fe7026`.
- ✅ **a11y (E2 pull-forward).** `FigmaHeader` back/add + `FigmaBottomSheet` close labels were hardcoded English (announced in English on every Arabic screen) → localized via `common.back`/`common.add`/`common.close` (parity 1089). `70b3f79`.
- ✅ **All remaining folds done** (the "completion pass" — one component per job, each an owner-approved "which look wins" ruling; see the dedicated section below): `Surface`, `FormField`, `OptionSelect`, `GlyphChip`, `EmptyState`, one sheet chrome, one header back affordance.
- ✅ **Loading skeletons.** New pure-JS `Skeleton` + `SkeletonList` (Animated opacity, honors OS reduce-motion) wired into all 10 list screens' loading branches (spinner → card-shaped placeholders). Vitals (grid) + emergency detail keep the spinner. `14a5190`.

## Phase C — screens ✅ (canonical order)
All 15 live screens are already on theme.ts + IBM Plex (Phase A) and at the 14 floor (E1). Screen-level **defects fixed**: Explore's fixed-dark `FigmaColors.dark.error` (light-mode bug); **Vitals** error now has a retry + a loading spinner; **Daily-logs** bare-text loading/error → spinner + card+retry; Home completion hex → `successFg`. **Hardcoded status hex fully tokenized** (`313b5ad`): figma-home + figma-medications `DOSE_STATUS` → `colorKey` (successFg/warningFg/errorFg — AA-safe + mode-adaptive), medications active-badge, and the emergency-card danger text → `errorFg`. Loading skeletons wired (above). **Component dedups completed** (see the completion pass below) so every screen now renders one card / field / chip / empty / sheet / header look. **Tier-C reskin done:** the 4 screens (notification-settings, invitations-list, emergency contacts-manager, recipient profile-form) were audited — their content was already on the redesign primitives (Surface, FormField, GlyphChip, EmptyState, StatusBadge, Button; themed native headers; no hardcoded colors); the one clash, two native RN `<Switch>`es, is now the brand `FigmaSwitch` (`d003b9b`). The only remaining item is the decorative per-index category color cycle (low priority, not a correctness issue).

## Phase D — moments of care ✅
- ✅ **Completion moment.** When all of today's doses are logged, the ring shows a quiet «اكتملت جرعات اليوم» check on the AA-safe `successFg` — no score/streak/points (the no-gamification rule). `b337021`.
- ✅ **Motion.** The app's only real animation is the splash overlay, which already respects OS reduced-motion; nothing new added, so nothing new to gate.
- ✅ **Warm copy — «دفء عائلي هادئ» (calm family warmth), owner-approved voice.** Applied across the whole locale (`33d39a2` warmed the 74-key empty-state + error subset to «تعذّر … حاول مجددًا» / «… بعد» / «يوم هادئ»; the earlier `8d09b45` added the try-again cues). **Then audited both locales** across six voice categories — errors, empties, confirmations, missed/overdue, success/celebration/greeting, hints/descriptions — plus a violation scan. Findings: **0 exclamation marks and 0 emojis in either `ar.json` or `en.json`** (quiet celebration), **0 harsh «فشل»/«خطأ»** (all errors use «تعذّر …»), missed doses framed as facts not failures («جرعة فائتة» / «لم تُسجّل بعد»), empties framed as good news, canonical terminology respected (0 «معلّق»; «مفتوحة»/«فعّال» intact), confirmations plain and reassuring, and the care recipient always referenced with dignity («الشخص الذي تعتني به» / «الشخص الذي يتلقّى الرعاية»). **Nothing semantically risky was guessed** — the deliberately-untouched set (per the "flag, don't guess" rule) is: canonical status enums, medical/legal disclaimers, precise field labels, and the `auth.errors.password` length rule («يجب … ٦ أحرف»), which is a factual constraint, not guilt. The voice is now recorded as **law** in `CLAUDE.md`. Parity held at 1089/1089.

## Phase E — full sweep + verification 🔧 (P1-8 closed)
- ✅ **E1 (P1-8 closed).** Swept the whole codebase: **132 content sub-14 sites raised to 14** across 31 live screens + care-loop-ring + ThemedText eyebrow/code, with broken co-located line-heights bumped. The only sub-14 remaining anywhere is the sanctioned bell unread-count badge (`badgeText` 10). `7ea2ae1`. (Dead/unrouted files left untouched — noted for the P2-1 cleanup.)
- ✅ **E2 a11y.** Icon buttons carry labels (header back/add + sheet close **localized** this milestone, `70b3f79`); contrast fixed at the token level (Phase-A A3); ≥48dp targets preserved; status stays icon+text.
- ⏭ **E3 font-scale QA** → the **visual-QA-checklist** deliverable (`2026-07-17-milestone-5-visual-qa-checklist.md`): Home/meds/a form/a detail at 130% + 200%, both themes, RTL. Needs a device — the E1 reflow, the tab-bar/ring label raises, and the FigmaFooterPrimaryButton workaround are the flagged risks.

---

## Completion pass — one component per job (owner-approved rulings) ✅

The deferred component dedups were each an owner "which look wins" call. The rulings (now **law** in `CLAUDE.md`):

### The card ruling — `Surface`
Fold everything onto `Surface` with one amendment: a **hairline border in BOTH themes** (the border carries the edge for older eyes and reads in dark mode where a shadow barely registers) + the **whisper-shadow on top in light mode only** (warmth). `FigmaCard` and `FigmaFormCard` are deleted; `Surface` gained a `gap` prop (groups a card's fields — FigmaFormCard's job) and a numeric `padded`. `fbf25c9` (FigmaCard), `fafd365` (FigmaFormCard).

### The one-wins survivors
| Job | Survivor | Folded & deleted | Commit |
|---|---|---|---|
| Card / panel | `Surface` | FigmaCard, FigmaFormCard | `fbf25c9`, `fafd365` |
| Text field | `FormField` (+`required`, `hint`) | FigmaField, FigmaFormField | `90f3215`, `fafd365` |
| Single-choice selector | `OptionSelect` (+`card` variant, `description`) | FigmaChipSelect, FigmaCardSelect | `fafd365` |
| Identity / icon chip | `GlyphChip` (semantic `iconName` + `color`) | icon-chip | `90f3215` |
| Empty state | `EmptyState` (feature icon per screen) | 10 inline figma empties | `24f55c7` |
| Toggle | `FigmaSwitch` | 2 Tier-C native `<Switch>`es | `d003b9b` |

- **`WeekdaySelector` stays separate** — it is a **multi-select (checkbox)**, so folding it into the single-select radio `OptionSelect` would change behavior (forbidden). Its chip visuals were aligned to `OptionSelect` instead (`24f55c7`).
- **`EmptyState` fold rule:** each list's empty shows **its feature's semantic icon** (activity/task/appointment/visit/doctor/claim/medication/vital/notification/dailyLog). Error states keep their own bespoke card — they are not empties.

### One sheet chrome, one header back affordance
- **Sheet survivor = the `FormModal`/`PickerSheet` chrome** (centered `backgroundElement` card, `Radius.card` top corners, hairline border, 8dp `backgroundSelected` handle, `MaxFormWidth`, `sectionTitle` title). `FigmaBottomSheet` was the outlier (`Radius.xl`, borderless, 4dp alpha handle, raw 18/bold title) → rebuilt on the canonical chrome, behavior untouched (`4d66b7d`). The three sheets **stay distinct components** because each encodes a different behavior contract (FormModal: explicit-close + keyboard-avoidance + submit/cancel; PickerSheet: backdrop-cancel + Done/Clear/Cancel; FigmaBottomSheet: backdrop-dismiss action sheet) — a visual-only phase must not merge behavior.
- **Header survivor = `FigmaHeader`'s round 44dp pill + back arrow.** `FigmaFormScreen`'s header used a smaller 36dp `Radius.md` + ChevronRight → aligned to the 44dp pill + ArrowRight (`4d66b7d`). The two header components stay distinct (list headers: centered title + add button; form headers: start title+subtitle + divider) — only the shared back atom is unified.

### P2-1 dead-file deletion ✅
The catalogued dead set (`today-overview`, `today-care-ring`, `tasks-card`, `appointments-card`, `vitals-card`, `vitals-center`, `visits-card`, `daily-logs-card`, `daily-logs-center`) was grep-verified (0 importers) and deleted in `54847a3`; the like-named live helpers (`today.ts`, `*-fields.ts`, `describe.ts`) were spared.

---

## Token reference table (post-Phase-A) — owner can request taste tweaks by name
### Colors — light
`text #1A1714` · `textSecondary #6B6258` · `textMuted #6D6760`◆ · `background #F7F3EE` · `backgroundElement #FFFFFF` · `backgroundSelected #E4DDCE` · `backgroundSunken #EDE8DF` · `border #E1DDD8` · `divider #ECE7DF` · `ringTrack rgba(26,23,20,.08)`◆ · `primary #2A7F71`◆ · `primaryPressed #256F63` · `onPrimary #FFFFFF` · `primaryBg #EAF3F1` · `primaryText #1F6E60` · `accentFg #8A5A17` · `accentBg #F4E9D5` · `accentSolid #C8904A` · `accentText #7A4E12` · `onAccent #2A1D05`◆ · `successFg #1F7A4D` · `successBg #E4F1EA` · `warningFg #9A5B00` · `warningBg #F6EBD7` · `errorFg #B5403F` · `errorBg #F7E5E3` · `infoFg #3E6FA0` · `infoBg #E7EEF7` · `dangerSolid #C45050` · `onError #FFFFFF` · `onSuccess #FFFFFF` · `onWarning #2A1D05` · `backgroundRaised #FFFFFF` · `overlay rgba(26,23,20,.45)` · `categoryBlue #5A8ABF` · `categoryPurple #8B6FA8` · `categoryGreen #4A9A75` · `categoryGold #BA8645`◆ · `categoryTeal #2E8A7B`
### Colors — dark
`text #EDE8DF` · `textSecondary #ACA89D` · `textMuted #908981`◆ · `background #0F0E0C` · `backgroundElement #1A1916` · `backgroundSelected #322E27` · `backgroundSunken #26231E` · `border #2E2A24` · `divider #211F1B` · `ringTrack rgba(237,232,223,.10)`◆ · `primary #4BA898` · `primaryPressed #3E9384` · `onPrimary #0F0E0C` · `primaryBg #1C2D29` · `primaryText #7AC8BA` · `accentFg #DDAF63` · `accentBg #34291A` · `accentSolid #C8904A` · `accentText #E2B872` · `onAccent #0F0E0C` · `successFg #5AAE85` · `successBg #16291F` · `warningFg #D9A24A` · `warningBg #332813` · `errorFg #E07A78` · `errorBg #3A1E1C` · `infoFg #7FA8D8` · `infoBg #1B2738` · `dangerSolid #C45050` · `onError #FFFFFF` · `onSuccess #0F0E0C` · `onWarning #2A1D05` · `backgroundRaised #232019` · `overlay rgba(0,0,0,.55)` · `categoryBlue #6A9ACC` · `categoryPurple #9B7FC0` · `categoryGreen #5AAE85` · `categoryGold #C8904A` · `categoryTeal #4BA898`

◆ = changed/added this milestone.

### Type (see A2 table) · Spacing `half2 one4 two8 three16 four24 five32 section40 six64` · Radius `sm8 md12 lg16 card20 xl24 pill999` · IconSize `sm16 md20 lg28 xl40` · ChipSize◆ `xs28 sm36 md40 lg44 xl48` · TouchTarget `min48 comfortable52` · Gutter 20 · MaxContentWidth 720 · MaxFormWidth 480

---

## Commit log (this milestone)
- `0f49e91` feat(theme): unify the type scale + a11y contrast fixes on the single token system.
- `c55aa8e` docs(milestone-5): record the understand map, contrast audit + Phase A foundation.
- `2050491` refactor(care-ring): migrate the care-loop ring onto the single token system.
- `642c372` refactor(figma-primitives): migrate the shared display primitives onto theme.ts.
- `bba4706` refactor(figma-primitives): migrate header/tab-bar/sheet/form-screen onto theme.ts.
- `d5c535b` refactor(figma-primitives): migrate the delete-target primitives onto theme.ts.
- `2d33bac` docs(milestone-5): track Phase A migration progress.
- `805a32b` refactor(tokens): consolidate every consumer onto theme.ts + retire Cairo (P2-2 token half). **← Phase A complete**
- `95b333a` docs(milestone-5): close Phase A + record standing rules in CLAUDE.md.
- `443ff9c` refactor(button): fold FigmaButton + FormButton into the single Button (P2-2 button half). **← Phase B started**
- `24de14e` docs(milestone-5): record the Button consolidation.
- `9fe7026` refactor(status): fold FigmaStatusPill into the single StatusBadge.
- `70b3f79` fix(a11y): localize the header back/add + sheet close labels (E2).
- `7ea2ae1` fix(a11y): raise every content font size to the 14 floor (E1 / **P1-8 closed**).
- `b337021` feat(care): Phase-D completion moment + calm loading/error states (vitals, daily-logs).
- `8e4728d` docs(milestone-5): finalize the report + add the visual-QA checklist deliverable.
- `313b5ad` refactor(status): tokenize the hardcoded dose-status + emergency danger colors.
- `8d09b45` fix(copy): add try-again cues to the error strings that lacked them.
- `14a5190` feat(loading): add a reduced-motion Skeleton primitive + wire it into the list screens.
- `54847a3` refactor(cleanup): delete the P2-1 dead-file set (unrouted, 0 importers). **← completion pass**
- `fbf25c9` refactor(card): fold FigmaCard onto the single Surface (card ruling).
- `33d39a2` feat(copy): warm-voice pass on empty-state + error copy — «دفء عائلي هادئ».
- `90f3215` refactor(chip): fold IconChip onto the single GlyphChip identity chip.
- `fafd365` refactor(ui): fold form primitives onto Surface/FormField/OptionSelect.
- `24f55c7` refactor(ui): fold inline list-empties onto the shared EmptyState.
- `4d66b7d` refactor(ui): one sheet chrome + one header back affordance.
- `d003b9b` refactor(ui): tier-C toggles use the canonical FigmaSwitch.
- `_pending_` docs(milestone-5): record the completion pass + voice guide as law. **← this commit**
