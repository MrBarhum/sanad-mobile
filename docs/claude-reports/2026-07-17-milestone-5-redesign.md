# Sanad — Milestone 5: The Redesign ("the suit")

**Branch:** `milestone-5-redesign` (off `master` @ 369c6c2) in an isolated worktree · one conventional commit per unit · no push/PR.
**Scope guard:** VISUAL ONLY. No behavior, routing, data, query, permission, or i18n-semantic change. Copy adjusted only where a label is a design artifact, always ar+en at parity.
**Validation quartet (green after every phase):** `npx tsc --noEmit` · `node scripts/check-mojibake.js` (270 files) · `git -c core.autocrlf=false diff --check` · locale parity (1087/1087, ar==en).

> Living document — updated per phase/screen. Status legend: ✅ done · 🔧 in progress · ⏭ planned.

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

## Phase A — one token system 🔧

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

### Decisions & deliberate departures (owner can revert any by token name)
1. **primary teal nudged darker** (`#2E8A7B`→`#2A7F71`, light only) — required to clear AA on the white-on-teal primary button (4.17→4.80). Same teal identity; dark primary unchanged.
2. **warning/postponed = amber, not gold.** Figma reused the gold accent (`#C8904A`) for "warning". Per A3 the gold accent is reserved for **celebratory + empty-state** moments; caution uses the dedicated `warningFg` amber. Status stays icon+text (never color-only), so the shift is safe and on-brief.
3. **figma `elevated` → `backgroundSunken`** (recessed wells/inputs) rather than repointing the unused `backgroundRaised`. Light wells go a hair deeper (`#F7F3EE`→`#EDE8DF`), which reads as more intentional separation.
4. **`textMuted` ≈ `textSecondary` in light** after the darken (both must clear 4.5). The muted/secondary distinction now comes from weight/size, not a failing grey — by design (research: grey-on-grey is the documented mHealth failure for older users).

---

## Phase B — core components ⏭ (plan)
One `Button` (survivor, theme.ts + IBM Plex + semantic Icon) absorbs the 3 duplicates: `FormButton` (Cairo clone), `FigmaButton` (12 consumers, reads FigmaColors directly), `FigmaFooterPrimaryButton` (renders in the **system** font). Survivors that others fold into: `Surface` (←FigmaCard, FigmaFormCard), `StatusBadge` (←FigmaStatusPill; bump 13.5→14), `EmptyState`/`LoadingState` (←all inline figma empties), `OptionSelect` (←FigmaChipSelect/CardSelect, WeekdaySelector chip), `GlyphChip` (←icon-chip), `FormField` (←FigmaField/FigmaFormField), unified sheet chrome (FigmaBottomSheet/FormModal/PickerSheet/TimezonePicker), unified header (FigmaHeader/FigmaFormScreen). **No skeleton system exists** — decision pending: standardize on `LoadingState` vs add a pure-JS `Skeleton`. Also fix `figma-header` hardcoded English `back`/`add` a11y labels (E2).

## Phase C — screens ⏭ (canonical order)
Home (flagship) → Medications → Tasks → سجل النشاط (+Home نبض) → Appointments → Vitals → Visits → Daily-logs → Doctors → Members → Available-to-claim → Notifications&settings → Account → Auth ×4 → Join/Invite. Known screen-level defects to fix in-pass: Explore hardcodes `FigmaColors.dark.error` (light-mode bug); Vitals error has no retry; Daily-logs loading/error are bare text; hardcoded status hex in figma-home/figma-medications/emergency-card; arbitrary per-index category cycles.

## Phase D — moments of care ⏭
131 copy candidates catalogued (tone north-star: `pulse.shareEmpty`). Reword the repeated `saveFailed`/`loadError` families once; add try-again cues. Completion state: quiet «اليوم اكتمل» on the ring (subtle check, no gamification). Exclusion list respected (status/enum labels, field names, medical-safety disclaimers, validation/format errors — NOT touched).

## Phase E — full sweep + verification ⏭ (closes P1-8)
**E1 pre-scan: 148 raw sub-14 sites** (all in the Figma/Cairo layer + status-badge 13/13.5 + care-loop-ring 11) + 6 dead sub-14 token definitions (0 consumers). Heaviest file: figma-home.tsx (30). 144 are caregiver-read content → raised to ≥14; 4 are the sanctioned decorative exceptions. Full list to be enumerated at E1.

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
