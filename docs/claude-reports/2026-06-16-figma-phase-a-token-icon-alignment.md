# Figma Make Parity — Phase A: Token + Icon Alignment

**Date:** 2026-06-16
**Scope:** Phase A of the visual-parity plan — **design-token re-point + semantic-icon expansion only.** No screens, no Home, no components (beyond what was actually needed: nothing in `icon.tsx`), no dependencies, no config, no backend. **Not committed.**
**Source of truth:** `docs/claude-reports/2026-06-16-figma-make-visual-parity-analysis.md`, `docs/figma/make-export/extracted/src/styles/theme.css` + `fonts.css` + the export screens, `docs/figma/sanad-mobile-design-acceptance-criteria.md`, the UI/UX skill.

---

## 1. Summary

Re-pointed Sanad's design tokens (`src/constants/theme.ts`) from the prior **brand-blue** "Warm Care OS" palette to the **Figma Make teal / porcelain / graphite** direction, and added a **5-step per-feature category color ramp**. Expanded the semantic icon vocabulary (`src/constants/icons.ts`) with **23 new names** needed to translate the Figma Make design — all resolved on the already-installed `@expo/vector-icons` (Ionicons + MaterialCommunityIcons), **no `lucide-react`, no new dependency, no change to `icon.tsx`**.

Token **keys are unchanged** — every existing `ThemeColor` consumer keeps working; only **values** changed and the ramp was **appended** (symmetrically in both light and dark). This is the foundation layer: with it in place, every later screen restyle inherits the new look from tokens instead of hardcoding colors.

Cairo font and `react-native-svg` were **intentionally deferred** (per the approved decisions). The care-loop ring will be adapted from existing RN Views in the Home phase unless `react-native-svg` is separately approved later.

> **Validation note up front (read §10):** `npm run check:mojibake`, `git diff --check`, and `npx expo-doctor` all **pass**. `npx tsc --noEmit` **reports 92 errors — but 92/92 are inside the Figma Make *web* export under `docs/figma/make-export/extracted/` (missing `lucide-react`/`@radix-ui/*`/`vite` etc.), and 0 are in Sanad's `src/`.** Phase A's edits are type-clean. This is a **pre-existing repo condition** (the web export sits inside the repo and `tsconfig` scans it), not caused by Phase A. Per the task rule "if any command fails, stop and explain, do not commit," I did **not** commit and did **not** work around it by editing out-of-scope config. A one-line unblock is recommended in §10.

---

## 2. Files changed

| File | Change | In scope? |
|---|---|---|
| `src/constants/theme.ts` | Re-pointed both `Colors.light` and `Colors.dark` to the Figma Make palette; added 5 category tokens to each; updated the header doc comment. **Keys unchanged.** | ✅ (listed) |
| `src/constants/icons.ts` | Added 23 semantic icon entries; updated the FAMILY-POLICY doc comment to list the new MCI care-domain glyphs. | ✅ (listed) |
| `src/components/icon.tsx` | **Not changed** — the new families (ionicons/material-community) and the one new directional icon (`back`, via the existing `rtlName` path) are already fully supported. | ✅ (not needed) |
| `docs/claude-reports/2026-06-16-figma-phase-a-token-icon-alignment.md` | This report. | ✅ (listed) |

No other file touched. Confirmation in §12.

---

## 3. Figma theme values extracted (from `theme.css` / `fonts.css`)

**Light (`:root`):** `--background #F7F3EE`, `--card #FFFFFF`, `--foreground #1A1714`, `--secondary/--muted/--input-background #EDE8DF`, `--muted-foreground #6B6258`, `--sanad-neutral #8A837A`, `--border rgba(26,23,20,0.1)`, `--primary/--sanad-primary #2E8A7B`, `--accent/--sanad-accent #C8904A`, `--destructive/--sanad-error/--sanad-emergency #C45050`, `--sanad-success #4A9A75`.
**Dark (`.dark`):** `--background #0F0E0C`, `--card #1A1916`, "elevated" wells `#232019` (from the screens), `--foreground #EDE8DF`, `--secondary/--muted/--input #26231E`, `--muted-foreground/--sanad-neutral #8A837A`, `--border rgba(237,232,223,0.08)`, `--primary #4BA898`, `--primary-foreground #0F0E0C` (dark text on the lighter teal), `--accent #C8904A`, `--accent-foreground #0F0E0C`, `--destructive #C45050`, `--sanad-success #5AAE85`.
**Category ramp (`--chart-1..5`):** teal `#2E8A7B`/`#4BA898`, gold `#C8904A`, green `#4A9A75`/`#5AAE85`, purple `#8B6FA8`/`#9B7FC0`, blue `#5A8ABF`/`#6A9ACC`.
**Radius:** `--radius: 1.25rem` (20). **Font:** Cairo (deferred — §7).

---

## 4. Sanad token changes made

Key tokens, before → after (full set in `theme.ts`). **All keys preserved; values only.**

| Token | Light before → after | Dark before → after | Mapping |
|---|---|---|---|
| `background` | `#F6F4EF` → **`#F7F3EE`** | `#151412` → **`#0F0E0C`** | 1:1 export |
| `backgroundElement` (card) | `#FFFFFF` (same) | `#201F1B` → **`#1A1916`** | 1:1 export |
| `backgroundRaised` | `#FFFFFF` (same) | `#26241F` → **`#232019`** | 1:1 export "elevated" |
| `backgroundSunken` | `#F3F1EB` → **`#EDE8DF`** | `#1B1A17` → **`#26231E`** | 1:1 export input/secondary |
| `backgroundSelected` | `#ECE9E1` → **`#E4DDCE`** | `#2C2A25` → **`#322E27`** | **derived** (see §9) |
| `border` | `#E2DFD6` → **`#E1DDD8`** | `#353329` → **`#2E2A24`** | light flattened from export; dark **adjusted** (§9) |
| `divider` | `#ECE9E2` → **`#ECE7DF`** | `#272520` → **`#211F1B`** | **derived** |
| `text` | `#1D1B16` → **`#1A1714`** | `#F4F2EC` → **`#EDE8DF`** | 1:1 export |
| `textSecondary` | `#5C594F` → **`#6B6258`** | `#ACA89D` (same) | light 1:1 export |
| `textMuted` | `#767266` → **`#8A837A`** | `#8B877C` → **`#8A837A`** | 1:1 export neutral |
| `primary` | `#1B5FBE` → **`#2E8A7B`** | `#2F6FD0` → **`#4BA898`** | **1:1 export (the headline change)** |
| `primaryPressed` | `#164E9D` → **`#256F63`** | `#275FB4` → **`#3E9384`** | **derived** darker teal |
| `onPrimary` | `#FFFFFF` (same) | `#FFFFFF` → **`#0F0E0C`** | dark 1:1 export (dark text on light teal) |
| `primaryBg` | `#E8EFFA` → **`#EAF3F1`** | `#1D2B42` → **`#1C2D29`** | teal tint (flattened/derived) |
| `primaryText` | `#17549F` → **`#1F6E60`** | `#96BEF5` → **`#7AC8BA`** | **derived** for AA on canvas |
| `accentSolid` | `#B97A1E` → **`#C8904A`** | `#C8923C` → **`#C8904A`** | 1:1 export accent |
| `onAccent` | `#FFFFFF` (same) | `#1A1408` → **`#0F0E0C`** | dark 1:1 export |
| `dangerSolid` | `#D92D20` → **`#C45050`** | `#E5564D` → **`#C45050`** | 1:1 export (softer red) |
| `successFg` | `#1A7A43` → **`#1F7A4D`** | `#4DC07D` → **`#5AAE85`** | dark 1:1 export; light **AA-adjusted** |
| `warningFg` | `#9A5B00` (same) | `#E2A23E` → **`#D9A24A`** | kept AA dark amber (export warning = gold, too light for text) |
| `errorFg` | `#BE2E2E` → **`#B5403F`** | `#EF6F6B` → **`#E07A78`** | **derived** toward export red, AA-kept |
| `infoFg` | `#17549F` → **`#3E6FA0`** | `#96BEF5` → **`#7FA8D8`** | **derived** (info stays blue, distinct from teal) |
| semantic `*Bg` (success/warning/error/info/accent) | retinted toward the export hues | retinted | **derived** tints |
| `overlay` | `rgba(29,27,22,.45)` → `rgba(26,23,20,.45)` | unchanged | aligned to new text |

**Contrast intent:** brand text uses a **darker teal** on light (`primaryText #1F6E60`) and a **lighter teal** on dark (`#7AC8BA`) so links clear WCAG AA on the canvas; teal **fills** pair with white (light) / near-black (dark) text per the export. Semantic `*Fg` tokens stay AA-dark (light) / AA-light (dark); the brighter export chip colors live in the **category ramp** and the `*Solid` tokens for fills, not as small-text colors. Final on-device contrast verification is a Phase-B/Home QA item.

**Notification bell badge** (`#D92D20`, hardcoded in `features/notifications/notification-bell.tsx`) was **left unchanged** — it is a feature component (out of scope) and an intentional fixed red. The `dangerSolid` token is now `#C45050`; the bell keeps its own value.

---

## 5. Category tokens added

Added **5 solids per palette** (10 values, key-symmetric) — used as `<Icon color="…">` tints for feature/medication identity chips, matching the export's `--chart-*` ramp:

| Token | Light | Dark |
|---|---|---|
| `categoryBlue` | `#5A8ABF` | `#6A9ACC` |
| `categoryPurple` | `#8B6FA8` | `#9B7FC0` |
| `categoryGreen` | `#4A9A75` | `#5AAE85` |
| `categoryGold` | `#C8904A` | `#C8904A` |
| `categoryTeal` | `#2E8A7B` | `#4BA898` |

**Why only solids (the "smaller clean structure" the task invited):** the export draws each chip as `icon-color` + a `~12–18%`-opacity tint of the *same* color. Encoding both a solid **and** a tint as flat `ThemeColor` keys would add 10 more keys and bloat the union. Instead, the **5 solids** are the tokens; the **low-opacity tint background** is derived at consume time in **Phase B** (either a tiny `withAlpha(token, 0.14)` helper, or a new `category` tone set on `GlyphChip`/`Surface`). This keeps `ThemeColor` clean now and defers the (component-level) tint decision to the phase that actually builds the chips — no component was touched in Phase A.

---

## 6. Icon names added (23)

All on `@expo/vector-icons` (no `lucide-react`/`lucide-react-native`; families imported only inside `icon.tsx`). **Every glyph name was verified to exist in the installed glyphmaps** (Ionicons 1357 keys, MCI 7448) — important because `icon.tsx` casts the name, so `tsc` cannot catch a bad glyph.

| Semantic name | Family · glyph | Notes |
|---|---|---|
| `back` | ionicons · `arrow-back` (rtl `arrow-forward`) | **directional** — header back arrow, mirrors in RTL via the existing path |
| `chevronDown` | ionicons · `chevron-down` | circle switcher / expandable rows (not directional) |
| `explore` | ionicons · `compass-outline` | Explore tab |
| `activity` | ionicons · `pulse` | generic reading/activity — **not** a health verdict |
| `heart` | ionicons · `heart-outline` | identity only — never health-color coded |
| `location` | ionicons · `location-outline` | appointment location |
| `drop` | ionicons · `water-outline` | blood type / hydration |
| `temperature` | **material-community** · `thermometer` | care-domain reading |
| `oxygen` | **material-community** · `lungs` | care-domain reading |
| `mood` | ionicons · `happy-outline` | daily-log observation, not a clinical scale |
| `appetite` | **material-community** · `silverware-fork-knife` | daily-log observation |
| `more` | ionicons · `ellipsis-horizontal` | row overflow |
| `edit` | ionicons · `create-outline` | pencil (shares the `dailyLog` glyph — intentional) |
| `copy` | ionicons · `copy-outline` | copy invite code |
| `view` | ionicons · `eye-outline` | viewer role |
| `invite` | ionicons · `person-add-outline` | invite member |
| `removeMember` | ionicons · `person-remove-outline` | remove member |
| `owner` | **material-community** · `crown-outline` | care-circle owner role |
| `role` | ionicons · `ribbon-outline` | role legend |
| `shield` | ionicons · `shield-checkmark-outline` | emergency "view-only" disclaimer |
| `lock` | ionicons · `lock-closed-outline` | read-only / permission |
| `moon` | ionicons · `moon-outline` | theme toggle (Account) |
| `sun` | ionicons · `sunny-outline` | theme toggle (Account) |

Existing names (chevron, add, close, dot, success, warning, error, info, clock, calendar, medication, task, appointment, visit, dailyLog, vital, doctor, emergency, member, profile, notification, settings, system, call) are **unchanged and still work**. New MCI care-domain glyphs (`temperature`, `oxygen`, `appetite`, `owner`) extend the previously-3-icon MCI exception; both families already ship in `@expo/vector-icons`, so **no new dependency**.

---

## 7. Cairo decision (deferred)

- Figma Make used **Cairo** (Google Fonts web `@import`).
- **This phase keeps IBM Plex Sans Arabic** (already bundled) to avoid app-wide font churn and a native font-asset + `app.json` font-plugin change in a token-only phase.
- Cairo can be evaluated **later** via on-device side-by-side screenshots; if adopted it becomes its own small task (bundle the weights, register in the Expo font plugin, repoint `FontFamily`). No `FontFamily`/`Fonts`/`app.json` change was made here.

## 8. react-native-svg / care-ring decision (deferred)

- Figma Make draws the care-loop as a true **SVG progress arc** (`<circle>` with `stroke-dasharray`, 60° bottom gap).
- **This phase adds no native/SVG dependency.** `react-native-svg` was **not** installed.
- The Home phase will **adapt the ring using existing React Native `View`s** (the current bordered/segmented `today-care-ring.tsx` approach), unless a later **explicit approval** adds `react-native-svg` for a near-exact arc. The token foundation for the ring (teal `primary`, `categoryTeal`, `successFg`, neutral track via `border`/`textMuted`) is now in place either way.

---

## 9. Risks

- **App-wide hue shift (intended).** Every screen that reads `primary`/semantic tokens now renders **teal** instead of blue the moment it next renders. This is the goal, but it means the *unbuilt* screens already changed color before their layout is redone — expect a transitional look until Phase B/C. No layout changed.
- **Derived (non-1:1) values** — flagged so they can be tuned against the comp on device:
  - `backgroundSelected` (both modes), `divider` (both), `primaryPressed` (both), `primaryText`/`primaryBg` (both), `errorFg`/`infoFg` (both), and all semantic `*Bg` tints are **derived** (the export defined no separate pressed/selected/divider tone and used brighter chip colors than are safe for small text).
  - `border` **dark** `#2E2A24` was **nudged up** from the export's ultra-subtle ~7–8%-alpha hairline so older-adult users can actually see card edges on the near-black canvas. If exact-match is preferred over visibility, lower it toward `#262420`.
- **`onPrimary`/`onAccent`/`onSuccess` dark are now near-black** (`#0F0E0C`) because the dark-mode teal/gold/green are *light* fills (the export's choice). These tokens are currently unused by screens (per the icon-foundation report), so the change is latent; verify when filled controls are built.
- **Contrast** of the new teal and semantic colors must be **re-verified on device** in both themes during Phase B/Home QA (teal desaturates for aging eyes).
- **No functional risk:** no keys removed, no component/hook/picker/validation/notification/backend code touched; `expo-doctor` 21/21.

---

## 10. Validation results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **PASS** — scanned 226 active source/config files; no strong signatures. |
| `git -c core.autocrlf=false diff --check` | **PASS** — clean (exit 0). |
| `npx expo-doctor` | **PASS** — 21/21 checks. |
| `npx tsc --noEmit` | **FAILS (exit 2) — but 92/92 errors are in the Figma Make web export under `docs/figma/make-export/extracted/`; 0 in Sanad `src/`.** Phase A's `theme.ts`/`icons.ts` are type-clean. |

**The tsc failure, precisely.** The export is **Vite/React web code** (imports `lucide-react`, `@radix-ui/*`, `vite`, `recharts`, `class-variance-authority`, `react-dom/client`, …) that isn't — and per the constraints must not be — installed in Sanad. Sanad's `tsconfig.json` uses `include: ["**/*.ts", "**/*.tsx", …]` with `exclude` of only `node_modules` and `supabase/functions`, so it pulls the export's `.tsx` files into the TypeScript program and reports their missing-module errors. This condition **landed when the export was added to the repo** (before Phase A); it is **independent of the token/icon work** (a per-file grep shows 0 errors in `src/`, including the two files I edited).

**Recommended one-line unblock (NOT done here — out of this phase's scope):** add the export path to `tsconfig.json`'s `exclude`, e.g. `"docs/figma/make-export"` (or `"docs"`). That is a config edit outside the approved Phase-A file list, and the task instructs stopping on a failed command rather than working around it, so I left `tsconfig` untouched and surfaced it instead. With that one exclude added (a tiny, safe follow-up the user can approve), `tsc --noEmit` returns to green and Phase A's clean result is confirmed end-to-end. Per the rules: **not committed; no `git reset/restore/clean` used.**

---

## 11. What Phase B should do next

1. **First, unblock `tsc`** — add `docs/figma/make-export` (or `docs`) to `tsconfig.json` `exclude` (one line) so repo-wide type-checking is green again. (Or move/gitignore the export out of the compiled root — a human call.)
2. **Category-tint mechanism** — add the deferred low-opacity tint for category chips: either a `withAlpha(themeColorValue, alpha)` util or a `category`/per-feature tone on `GlyphChip` (and matching `Surface` tone). This is the first real component touch.
3. **Shared primitives restyle (tokens only, APIs stable):** `surface.tsx` (radius toward 20/24, hairline border, the `backgroundRaised` nested-well), `button.tsx` (teal primary, ≥56dp), `status-badge.tsx` (dose `given/postponed/missed` tones from `successFg/warningFg/errorFg` + the softer red), `nav-card.tsx`, `info-banner.tsx`, `dashboard-tile.tsx`, `screen.tsx`, `app-tabs.tsx` (active teal pill, new `explore` icon), and a small `SegmentedTabs` for the today/all switchers.
4. **Care-ring decision** — adapt `today-care-ring.tsx` with the new tokens, or seek approval for `react-native-svg` for the exact arc.
5. **Then Phase C (Home)** per the parity analysis, wiring real hooks (no mock data).

Throughout: tokens only (no hardcoded colors), semantic `<Icon>` (no lucide), preserve RTL/accessibility/medical-safety/pickers/validation/notification opt-in, and device-screenshot-compare from Home onward.

---

## 12. Confirmation — what was NOT changed

- **No screens / no Home / no feature components** were modified. The rejected Home prototype files (`circle-dashboard.tsx`, `today-overview.tsx`, the `*-card.tsx`, `dashboard-tile.tsx`) were **not touched** by this phase (they remain in their pre-existing uncommitted state).
- **No `icon.tsx`** change (not needed).
- **No backend / Supabase / Firebase / EAS / SQL / deploy.** No data hooks, queries, RLS, or notification logic touched.
- **No `package.json` / `package-lock.json` / `app.json` / `eas.json` / `.env`** changes. **No dependency installed** (`npm install` not run). **No `tsconfig.json`** change (recommended but deferred — §10/§11).
- **No font added** (Cairo deferred). **No `react-native-svg`** added.
- **No commit, no `git add`, no push, no `git reset/restore/clean`.**
- Only four files are in scope: `src/constants/theme.ts`, `src/constants/icons.ts`, and this report (plus the untouched-but-considered `icon.tsx`).
