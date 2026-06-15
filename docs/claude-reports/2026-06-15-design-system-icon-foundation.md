# Design-System + Icon Foundation — Implementation Report

**Date:** 2026-06-15
**Scope:** Phase 1A + Phase 1B of the approved "Design-system + icon foundation" plan.
**Status:** Implemented and validated. **Not committed** (per instructions).

---

## Summary

Introduced a centralized, semantic vector-icon system for Sanad built on
`@expo/vector-icons`, and migrated the shared/high-impact UI primitives and the
care-circle dashboard surfaces onto it — without redesigning any layout, without
touching backend, and without disturbing the recently-fixed pickers, selectors,
medication-schedule validation, or notification logic.

Components now reference icons by **meaning** (`<Icon name="medication" />`),
never by an icon-family glyph name. A single component (`src/components/icon.tsx`)
is the only place allowed to import the icon families; everything else goes
through the semantic map in `src/constants/icons.ts`. This gives one place to
enforce size/color tokens, accessibility, RTL mirroring, and any future family
swap.

The existing ASCII-safe `glyphs.ts` is **untouched and retained** as the fallback
for the many areas intentionally left for a later phase. This was a bounded
migration (24 files), not a 50-file sweep.

A false claim in the project docs — that `@expo/vector-icons` "ships with Expo /
adds no new dependency" — was corrected in both the UI/UX skill and the product
review, because verification showed it is **not** bundled by Expo in this repo
and had to be installed explicitly.

---

## Files changed

### New (2)
- `src/constants/icons.ts` — semantic `IconName` type + `ICONS` map (family, glyph name, RTL metadata).
- `src/components/icon.tsx` — the centralized `<Icon>` component (only file importing the icon families) + exported `IconFonts` for preload.

### Modified — design tokens & app shell (3)
- `src/constants/theme.ts` — additive tokens: `IconSize`, `Spacing.section`, and color tokens (`accentSolid`, `accentText`, `onAccent`, `dangerSolid`, `onError`, `onSuccess`, `onWarning`, `backgroundRaised`) in **both** light and dark palettes.
- `src/components/themed-text.tsx` — additive `display` and `eyebrow` text variants.
- `src/app/_layout.tsx` — spread `IconFonts` into the existing `useFonts` call (preload, no other boot changes).

### Modified — shared primitives (8)
- `src/components/status-badge.tsx`, `glyph-chip.tsx`, `info-banner.tsx`, `nav-card.tsx`, `contact-card.tsx`, `button.tsx`, `states.tsx`, `icon-button.tsx`.

### Modified — dashboard surfaces (7)
- `src/features/care-circle/circle-dashboard.tsx`
- `src/features/tasks/tasks-card.tsx`, `appointments/appointments-card.tsx`, `daily-logs/daily-logs-card.tsx`, `vitals/vitals-card.tsx`, `visits/visits-card.tsx`
- `src/features/notifications/notification-bell.tsx` (visual leading icon only)

### Modified — docs & package files (4)
- `.claude/skills/sanad-mobile-ui-ux-design/SKILL.md`
- `docs/product/sanad-product-and-design-review.md`
- `package.json`, `package-lock.json`

**Diff stat:** 22 files changed, 214 insertions(+), 98 deletions(-), plus 2 new files.

---

## Dependency added and why

- **Added:** `@expo/vector-icons@^15.0.2` (resolved 15.1.1) via `npx expo install @expo/vector-icons`.
- **Why:** It is required for a real vector-icon foundation, and verification (during planning and again here) confirmed it was **not** present in `node_modules`, **not** in `package-lock.json`, and **not** a dependency/peer of `expo@56.0.12`. It is the single approved icon dependency.
- **No native rebuild:** the package is JS + bundled-font; its glyph fonts load through the already-installed `expo-font` native module on the current Development Build (Metro serves the `.ttf`s). Confirmed `expo-doctor` is still 21/21.
- **Bounded:** `package.json` gained exactly one line (`"@expo/vector-icons": "^15.0.2"`); the lockfile change is limited to that package. No other dependency was added (`lucide-react-native`, `react-native-svg` were **not** installed).

---

## Icon families chosen and why

**Default: Ionicons.** Calm, even-weight silhouettes read clearly for older eyes;
first-class status marks (`checkmark-circle`, `warning`, `close-circle`,
`information-circle`) fit the icon+text+color pattern; and the
`chevron-forward`/`chevron-back` pair gives correct RTL mirroring for the one
directional icon. Ionicons is also quieter than Material, which keeps the visual
"boldness budget" available for the future Sanad signature element rather than
spending it on iconography.

**Exception: MaterialCommunityIcons for three care-domain icons** where
recognizability is materially better and Ionicons has no good equivalent:
- `medication` -> `pill`
- `doctor` -> `doctor`
- `vital` -> `heart-pulse`

Both fonts ship inside the single `@expo/vector-icons` package, so the exception
adds **no** further dependency. The family choice is centralized entirely in
`src/constants/icons.ts`; no feature component knows which family it gets, so
swapping or extending later is a one-file change.

---

## Semantic icon map summary

`src/constants/icons.ts` exports `ICONS` (semantic name -> `{ family, name, rtlName?, directional? }`) and the `IconName` type. Names available to call sites:

`chevron` (directional, RTL-mirrored), `add`, `close`, `dot`, `success`,
`warning`, `error`, `info`, `clock`, `calendar`, `medication`, `task`,
`appointment`, `visit`, `dailyLog`, `vital`, `doctor`, `emergency`, `member`,
`profile`, `notification`, `settings`, `system`, `call`.

**Collisions resolved** (the old glyph set reused one mark for several meanings):
- `task` is now a checklist (`checkbox-outline`), **not** the success check — a task no longer looks "done".
- `appointment` is now a calendar (`calendar-outline`), **not** the clock — distinct from generic time.

**RTL:** `chevron` is the only directional entry; the component swaps to
`chevron-back` when `I18nManager.isRTL`. (A horizontal-flip fallback exists for
any future directional icon without a paired glyph.) All status and
feature-identity icons are non-directional and never mirror. Every chosen glyph
name was verified to exist in the installed glyphmaps before use.

---

## What was migrated

**Shared primitives (additive — legacy `glyph` props kept working):**
- `status-badge.tsx` — tone now defaults to a vector `Icon` (success/warning/error/info/neutral-dot); `glyph`/`iconName` overrides still honored.
- `glyph-chip.tsx` — added an `iconName` branch; the `glyph` string path is **kept** for letterform avatars (a vector set cannot render arbitrary initials). Not converted into a pure icon wrapper.
- `nav-card.tsx` — leading chip takes `iconName`; the trailing chevron is now `<Icon name="chevron">` (centralized RTL mirroring).
- `info-banner.tsx` — tone -> `iconName` through GlyphChip.
- `contact-card.tsx` — phone affordance glyph -> `<Icon name="call">`; the name avatar stays on the `initialFor` letterform path.
- `button.tsx` — added an `iconName` branch (only the leading-glyph slot); variants/sizing/loading/touch-target/a11y untouched. The legacy `glyph` path is preserved, so existing call sites are unchanged.
- `states.tsx` — `ErrorState` uses `iconName="warning"`; `EmptyState` gained an `iconName` prop (legacy `icon` glyph still works).
- `icon-button.tsx` — added an `iconName` branch as the reference icon-only-control implementation (it has zero call sites, so risk-free).

**Dashboard surfaces:**
- `circle-dashboard.tsx` — feature/settings rows now pass semantic `iconName` (`medication`, `task`, `appointment`, `visit`, `dailyLog`, `vital`, `emergency`, `member`, `profile`, `call`, `doctor`); the settings-row chevron is now `<Icon>`. Layout, grouping, accessibility roles/labels/hints unchanged.
- The five delegated dashboard cards (`tasks`, `appointments`, `daily-logs`, `vitals`, `visits`) pass `iconName` instead of a glyph.
- `notification-bell.tsx` — gained a decorative leading `notification` icon only. The unread-count source, `> 0` visibility gate, `99+` cap, count-aware accessibility-label branch, and the fixed `#D92D20` badge fill are **byte-for-byte unchanged**.

---

## What was intentionally left on glyphs.ts

`glyphs.ts` is unchanged and remains the fallback. Deliberately **not** migrated this phase:
- **Feature centers & editors** (`medications-center`, `tasks-center`, `appointments-center`, `visits-center`, `daily-logs-center`, `vitals-center`, and the matching editors, plus `notifications-center`'s `TYPE_GLYPH`). They pass explicit `glyph` overrides to `StatusBadge`/`Button` or read `Glyph` directly, so they keep working untouched.
- **`account.tsx` and `explore.tsx`** — still use `Glyph` with `NavCard`/`GlyphChip` (kept working via the preserved `glyph` prop).
- **Letterform avatars** — `contact-card` avatar, `members-manager`, `circle-switcher` keep `initialFor`/`glyph` (vector icons cannot render arbitrary Arabic/Latin initials).
- **Inline separators/marks** — `Glyph.dot`, `Glyph.middot`, `Glyph.bullet`, and glyphs inside the protected files.
- **Protected recent-fix files** — pickers, selectors, schedule validation, notification opt-in/hooks (see Regression risks). None were edited.

---

## Design tokens added / deferred

**Added now (additive, currently unused — zero change to existing screens):**
- `IconSize = { sm:16, md:20, lg:28, xl:40 }` — `sm/md/lg` match the existing GlyphChip glyph sizes so the text-glyph -> vector-icon switch is visually 1:1.
- `Spacing.section = 40` — fills the 32 -> 64 gap for future section rhythm.
- Colors in **both** light and dark (required by the `ThemeColor` key-symmetry type): `accentSolid`, `accentText`, `onAccent` (the "today/now" ramp for the future hero/signature ring), `dangerSolid`, `onError`, `onSuccess`, `onWarning` (filled-status foregrounds), `backgroundRaised` (second surface lift on graphite).
- `themed-text.tsx`: `display` (34/46/700) and `eyebrow` (13/18/600, letterSpacing 0.5) variants for the future Today-Home greeting.

**Deferred to the Today-Home task (restyle, not done here):**
- Bumping base body from 16 to 17 (explicitly out of scope this task).
- Restructuring `CardShadow` into a `low/high` elevation ramp (more invasive; `backgroundRaised` added as the dark second step, but no new shadow object).
- Wiring `Section`'s default gap to `Spacing.section`; using `divider` for internal rows.
- Applying the accent ramp / `display` / `eyebrow` / elevation to real screens.
- Re-pointing the feature time-chips off the overloaded `accentBg`; replacing ad-hoc feature font sizes; realigning `Gutter` 20 -> 24.

---

## Documentation corrections made

Replaced the false "ships with Expo / no new dependency" claim with the
corrected, repo-specific wording ("install with `npx expo install
@expo/vector-icons`; not bundled by Expo in this repo; one approved icon
dependency; JS + bundled-font, no native rebuild") in:

- `.claude/skills/sanad-mobile-ui-ux-design/SKILL.md` — the icon-rules bullet, the scope-discipline "Vector-icon migration" bullet (also notes the foundation now exists and the scope guardrail still holds), and the Forbidden-actions dependency line.
- `docs/product/sanad-product-and-design-review.md` — the headline (Section 0, point 3), the Section 5 "durable fix" heading, and Section 5 step 2.

Scope discipline preserved: the skill still says not to migrate icons during
unrelated work and not to restructure the Today Home during unrelated work.

---

## Regression risks and how they were avoided

- **Breaking the protected recent fixes.** None of the protected files were touched (verified via `git status`): no `picker-sheet`, `date-field`, `time-field`, `date-time-field`, `timezone-picker`, `weekday-selector`, `option-select`, `schedule-*`, `medication-form`, `push-registration`, notification `hooks`, `notification-settings`, `push-status-card`, or `reminder-notice`. They continue to use `glyphs.ts` internally.
- **Notification behavior.** `notification-bell` change is purely additive (one decorative icon). Unread count, `99+` cap, conditional render, count-aware a11y label, and the `#D92D20` fill are unchanged.
- **API breakage.** Every primitive kept its existing props; `iconName` was added **beside** `glyph`/`icon`. Out-of-scope callers that pass `glyph` are unchanged and still render. `glyph`/`icon` props were only loosened to optional, never removed.
- **Avatar regression.** GlyphChip keeps its letterform path; it was not converted into a pure icon wrapper.
- **RTL.** Text chevrons used to mirror via bidi reordering; a naive vector swap would not. The `<Icon>` handles this centrally (`chevron-back` in RTL), so the migration improves rather than regresses mirroring. To verify on device.
- **Icon flash / missing glyphs.** Both icon fonts are preloaded in the root `useFonts`, alongside IBM Plex, so icons are ready before first paint.
- **Type/encoding safety.** `tsc --noEmit` is clean; `glyphs.ts` and its ASCII-safe `String.fromCodePoint` invariant are untouched; `check:mojibake` is clean.
- **Visual alignment.** Boxed vector icons center differently from text glyphs (the badge/chevron/button glyph metrics). This is the main thing to confirm on device (see QA).

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **Pass** (exit 0, no errors) |
| `npm run check:mojibake` | **Pass** — scanned 223 files, no strong mojibake signatures |
| `git -c core.autocrlf=false diff --check` | **Pass** (clean, no whitespace/encoding issues) |
| `npx expo-doctor` | **Pass** — 21/21 checks |
| `git --no-pager status --short` | 22 modified + 2 untracked (icon.tsx, icons.ts) |
| `git --no-pager diff --stat` | 22 files, +214 / -98 |
| `package.json` diff | only `+ "@expo/vector-icons": "^15.0.2"` |

No commit was made.

---

## Real-device QA checklist (S24 Ultra: Android, Arabic, RTL, dark mode)

```
[ ] Dashboard renders all feature icons (pill, calendar, home, pencil/notes,
    heart-pulse, checklist, medkit, people, person, phone, doctor) — no missing/box glyphs, no flash
[ ] Nav chevrons point start-ward (left) in RTL on feature cards + settings rows
[ ] Status badges show icon + text + color (e.g. invitation/owner/primary badges)
[ ] Notification bell: leading bell icon present; unread count, 99+ cap, and red badge unchanged
[ ] Icons vertically centered against adjacent labels (badge 13.5, chevron, button label, phone number)
[ ] Contact/doctor cards: phone "call" icon centered with the LTR number; name avatar still shows the initial
[ ] Dark mode: icon colors resolve via theme (no hardcoded tints); bell red still high-contrast
[ ] Touch targets unchanged (nav rows, bell pill, buttons >= their previous floors)
[ ] REGRESSION GUARDS:
    [ ] Date/time pickers still render and return values
    [ ] Weekday selector + option-select chips behave (selected = fill + check + bold)
    [ ] Medication duplicate-time save-block still fires; schedule conflict still blocks
    [ ] Notification enable -> channel-before-permission -> token -> unread flow unchanged
[ ] Font scaling 130% / ~200% — no clipping; TalkBack: icons decorative, labels announced
```

---

## Open follow-ups

1. **Today-first Home** — not implemented here. The additive tokens (`display`, `eyebrow`, accent ramp, `Spacing.section`, `backgroundRaised`) and `IconSize.xl` are staged for it.
2. **Sanad signature element ("Today Care Ring")** — specified only; **not built**. To be implemented in the dedicated Today-Home task, consuming the accent ramp + a ring-stroke token.
3. **Remaining `Glyph` consumers** — feature centers/editors, `account.tsx`, `explore.tsx`, and `notifications-center`'s `TYPE_GLYPH` still use `glyphs.ts`. Migrate in a follow-up icon pass (their `StatusBadge`/`Button`/`NavCard`/`GlyphChip` now all accept `iconName`). Separators and letterform avatars should stay on `glyphs.ts` permanently.
4. **Historical docs mojibake** — one earlier `docs/claude-reports/*` file is known to contain real mojibake and was deliberately left unfixed; not in scope here. Revisit if/when those reports are cleaned.
5. **Optional:** wire `expo-font`/config-plugin embedding of the icon fonts for production builds (runtime preload is sufficient for the dev build today).
```
