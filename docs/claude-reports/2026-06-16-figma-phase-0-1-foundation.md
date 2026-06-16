# Figma Exact-Copy — Phase 0 + Phase 1: Foundation

**Date:** 2026-06-16
**Scope:** Build the technical foundation to copy the Figma Make UI literally — add the missing capabilities (SVG, lucide icons, Cairo), a Figma exact-token layer, the SVG care ring, the Figma tab bar, and supporting primitives. **No Home content rebuilt yet. Not committed.**
**Source of truth:** `docs/claude-reports/2026-06-16-figma-exact-copy-technical-plan.md` + the Figma export (`App.tsx`, `HomeScreen.tsx`, `BottomNav.tsx`, `theme.css`, `fonts.css`, `package.json`).

---

## ⚠ Critical — a dev-client rebuild is REQUIRED before these changes appear

`react-native-svg` is a **native module**. The currently-installed Android Expo dev client binary does **not** contain its native code, and `lucide-react-native` renders **through** `react-native-svg`. Therefore:

- **The new FigmaTabBar (lucide icons) and the CareLoopRing (SVG) will NOT render — and may error at runtime — until the Android dev client is rebuilt.**
- Rebuild locally with **`npx expo run:android`** (a local dev-client build; **not** an EAS build, which is out of scope/forbidden here).
- Cairo font loading and the token layer work without a rebuild, but the tab bar can't render its icons until the rebuild lands.

This is expected for Phase 0 (we added native capability on purpose). Metro fast-refresh alone is insufficient for the new native module.

---

## 1. Summary

Phase 0 + 1 prove the exact-copy foundation:
- **Cairo loads** (400/500/600/700/800) in the root layout, ready before first paint, alongside the existing IBM Plex (kept for legacy screens).
- **`react-native-svg` is installed** and used by a new, geometry-exact **`CareLoopRing`** (the Figma 300° arc — not the old bordered-View ring).
- **`lucide-react-native` is installed** and used by the new **`FigmaTabBar`** (and ready for all Figma primitives).
- **The bottom tab bar is replaced**: the old `NativeTabs` (unstyleable) → Expo Router JS `Tabs` with a custom `FigmaTabBar` (teal active pill, lucide icons, Cairo labels, RTL order) — navigation behavior preserved.
- **A Figma exact-token layer** (`figma-tokens.ts`) encodes the literal palette, radii, type scale, category colors, Home constants, and ring geometry — independent of Sanad's accessibility scale, per the approved exact-copy direction.
- Supporting primitives (`FigmaScreen`, `FigmaCard`, `IconChip`) are in place for Phase 2.

No Home content was rebuilt; no data flow, backend, validation, notifications, or pickers were touched. All four validations pass.

---

## 2. Dependencies added

Installed via `npx expo install react-native-svg lucide-react-native @expo-google-fonts/cairo` (Expo-resolved, SDK-56 compatible):

| Package | Version | Native? | Dev-client rebuild? | Purpose |
|---|---|---|---|---|
| `react-native-svg` | `15.15.4` (Expo-pinned) | **Yes** | **Required** | The exact stroked care-loop arc; backs lucide icons; any precise vector. |
| `lucide-react-native` | `^1.18.0` | No (JS, via svg) | Required (because it renders through svg) | Exact Figma icon shapes (tab bar now; all Figma primitives next). |
| `@expo-google-fonts/cairo` | `^0.4.2` | No (JS + font assets) | Not required | The Cairo typeface used by Figma exact-copy screens. |

`npm install` reported "added 15 packages" (the three above + transitive). `package.json` and `package-lock.json` were updated by Expo/npm (included in status). **No EAS, no deploy, no backend.**

---

## 3. Whether a dev-client rebuild is required

**Yes — required** (see the ⚠ banner). `react-native-svg` ships native code absent from the current dev-client binary; the FigmaTabBar (lucide → svg) and CareLoopRing (svg) depend on it. Rebuild with `npx expo run:android`. Cairo + tokens do not need it, but the visible Phase-1 UI (tabs/ring) does.

---

## 4. Files changed

**New (`src/components/figma/`)**
- `figma-tokens.ts` — the exact-token layer (§5).
- `care-loop-ring.tsx` — SVG `CareLoopRing` (§6).
- `figma-tab-bar.tsx` — `FigmaTabBar` (§7).
- `figma-screen.tsx` — full-bleed RTL screen container (Figma gutter + safe-area; replaces `Screen` on Figma screens). *Foundation for Phase 2.*
- `figma-card.tsx` — flat hairline-bordered card, large radius (rounded-2xl/3xl), optional pressable. *Foundation for Phase 2.*
- `icon-chip.tsx` — tinted lucide icon chip (the Figma `${color}18` idiom). *Foundation for Phase 2.*

**Modified**
- `src/app/_layout.tsx` — import + load Cairo 400/500/600/700/800 in the existing `useFonts` (gates first paint), with a comment that Figma screens use Cairo and legacy screens keep IBM Plex.
- `src/components/app-tabs.tsx` — replaced `NativeTabs` with Expo Router JS `Tabs` + custom `tabBar={FigmaTabBar}` (navigation preserved via standard `tabPress` emit + `navigate`).
- `package.json`, `package-lock.json` — the three dependencies (Expo/npm-generated).

**Report**
- `docs/claude-reports/2026-06-16-figma-phase-0-1-foundation.md` (this file).

---

## 5. Figma tokens added (`figma-tokens.ts`)

- **`FigmaColors` (dark + light)** — dark: bg `#0F0E0C`, card `#1A1916`, elevated `#232019`, text `#EDE8DF`, muted `#8A837A`, border `rgba(237,232,223,0.07)`, ringTrack `rgba(237,232,223,0.10)`, primary `#4BA898`, onPrimary `#0F0E0C`, accent `#C8904A`, error `#C45050`, success `#5AAE85`. Light: bg `#F7F3EE`, card `#FFFFFF`, primary `#2E8A7B`, …
- **`FigmaCategory`** — blue `#5A8ABF`, purple `#8B6FA8`, green `#4A9A75`, gold `#C8904A`, teal `#4BA898` / tealLight `#2E8A7B`.
- **`FigmaRadius`** — 8 / 12 / 16 / 20 / 24 / 999.
- **`FigmaFontSize`** — 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 26 (intentionally below Sanad's a11y floor; this is exact-copy).
- **`FigmaWeight`** — 400 / 500 / 600 / 700 / 800.
- **`FigmaFont`** — Cairo family keys (`Cairo_400Regular` … `Cairo_800ExtraBold`).
- **`FigmaLayout`** — gutter 20, heroPadding 20, headerActionSize 44, iconChip { 28, 36, 40, 44, 48 }.
- **`FigmaRing`** — size 144, cx/cy 72, radius 54, stroke 10, gapAngle 60, startAngle 120.
- **`withAlpha(hex, a)`** — builds `rgba(...)` tints (the RN equivalent of the Figma `${color}18`).

A header comment states these are deliberately independent of `src/constants/theme.ts` and that Figma screens use Cairo.

---

## 6. CareLoopRing implementation details

`src/components/figma/care-loop-ring.tsx`, built with `react-native-svg` (`Svg`, `Circle`, `G`), copying the Figma `CareLoopArc` math verbatim:

- `144×144`; `cx=cy=72`; `r=54`; `strokeWidth=10`; `strokeLinecap="round"`.
- `circumference = 2π·54`; `arcLength = circumference · (300/360)` (a **300° arc**, 60° bottom gap); positioned by a `<G rotation={120} originX/Y={72}>` — same start angle as the export.
- **Track** = full 300° arc in the faint Figma `ringTrack`; **progress** = teal (`primary`) `Circle` with `strokeDasharray=[progress, circumference]`, `progress = (given/total)·arcLength`.
- `total = 0` is safe (no progress arc; `safeGiven` clamped to `[0, total]`).
- **Center** (Cairo): `given` at 26/700 + `/total` at 15/400 (LTR-isolated numeric run) + the "جرعات اليوم" label at 11.
- **Accessibility:** the SVG + center are decorative (`accessibilityElementsHidden`); the wrapper carries one `accessibilityLabel` describing the dose loop (reusing the existing `today.loopA11y` / `loopA11yNone` strings). `given`/`total` are props.
- Colors pick the dark/light Figma set via `useColorScheme`. **Does not** use the old View-based `today-care-ring.tsx`.

*(Static fill for now; the optional 0.6s animate is a Phase-2 polish via the already-installed reanimated.)*

---

## 7. FigmaTabBar implementation details

`src/components/figma/figma-tab-bar.tsx`, copying `BottomNav.tsx`:

- Three tabs only — `index → الرئيسية` (Home), `explore → استكشاف` (Compass), `account → الحساب` (User) — lucide icons at **20px**, active **strokeWidth 2.5** / idle 2.
- Active **teal pill** (`44×28`, radius 12, `withAlpha(primary, 0.15)` dark / `0.10` light) behind the icon; label **11px**, **600** active / **400** idle; active color = teal, idle = muted.
- **Card background**, **hairline top border**, bottom padding = `max(safe-area bottom, 12)` (the Figma `pb-6` / home indicator → real safe area on device).
- **RTL order** is automatic: the row mirrors under `I18nManager.isRTL`, so Home sits at the right (matching Figma).

**Wiring (`app-tabs.tsx`):** Expo Router JS `Tabs` with `tabBar={({ state, navigation }) => <FigmaTabBar … />}`. `FigmaTabBar` takes simple typed props (`activeIndex`, `routeNames`, `onSelect`) — no fragile `@react-navigation/*` type import (those aren't top-level). `onSelect` emits the standard `tabPress` and calls `navigation.navigate(route.name)` only when not already active and not prevented — **behavior preserved**. `Tabs.Screen` entries set the three titles.

---

## 8. What was replaced from old Sanad

- **`NativeTabs` (native tab bar) → JS `Tabs` + `FigmaTabBar`.** The old native bar (brand-pill via `indicatorColor`, **PNG** tab icons in `assets/images/tabIcons/*`) is gone; those PNG icons are no longer referenced by the tab bar. This is the deliberate "no old Sanad tab style."
- **Conceptually superseded (not yet rewired):** the old View-based `today-care-ring.tsx` is replaced by the new SVG `CareLoopRing` — but `today-care-ring.tsx` is still imported by the Phase-C `today-overview.tsx` and was **left untouched** this phase (Home content rewrite is Phase 2).

Nothing else was removed; legacy screens still use `Screen`/`Surface`/IBM Plex/Ionicons until migrated.

---

## 9. What is intentionally NOT done yet

- **Home content not rebuilt** — `circle-dashboard.tsx` / `today-overview.tsx` are unchanged; `CareLoopRing`/`FigmaScreen`/`FigmaCard`/`IconChip` are **not** yet composed into Home. (Phase 2.)
- **No Home data rewrite** — no hooks/queries/data touched.
- **Semantic `<Icon>` not re-pointed to lucide** — legacy screens keep Ionicons/MCI; the Figma primitives use lucide **directly** (cleaner, per the task's allowance). Whether to fully re-point `<Icon>` is a Phase 2/3 decision.
- **IBM Plex not removed** — both families load; Cairo is used only by the new Figma primitives so far.
- **Care ring animation** (0.6s) — deferred to Phase 2 polish.
- **No medication validation / notification registration / pickers / SQL / Edge Functions / .env / backend** touched. No EAS, no deploy, no commit.

---

## 10. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) — incl. the custom `tabBar`, `react-native-svg`, lucide, and Cairo types |
| `npm run check:mojibake` | **PASS** — 232 active files (incl. the 6 new figma files), no strong signatures |
| `git -c core.autocrlf=false diff --check` | **PASS** — clean (exit 0) |
| `npx expo-doctor` | **PASS** — 21/21 (new deps version-aligned for SDK 56) |

One transient tsc error (`StyleSheet.absoluteFillObject` not in these RN types) was fixed by using `position:'absolute', inset:0` (non-directional, RTL-safe). No commit; no `git add`; no `git reset/restore/clean`.

---

## 11. Exact next step — Phase 2 (Home content)

> **Prereq: run `npx expo run:android` once** to rebuild the dev client with `react-native-svg` (otherwise the new tabs/ring won't render). Then:
>
> Build `src/features/care-circle/figma-home.tsx` as a literal translation of the Figma `HomeScreen.tsx`, composed from the Phase-1 primitives and wired to the **real** existing hooks (no mock data):
> 1. `FigmaScreen` (full-bleed RTL) wrapper.
> 2. **Header** — date + recipient name (lucide `ChevronDown` dropdown using `useCircleSelection`) + age/location; round 44px lucide `Bell` (→ notifications, real unread) + round red `Phone` (→ emergency card).
> 3. **Hero** `FigmaCard` (rounded-3xl, p-20): eyebrow "دورة الدواء · اليوم" + "عرض الكل" link, then `CareLoopRing` wired to `useTodayDoses`/`summarizeDoses` (`given`/`total`), the next-dose chip (earliest not-given), and the status time-pill strip.
> 4. **Today summary** — two stat cards (`useTodayTaskSummary`, `useTodayAppointmentSummary`).
> 5. **Next appointment** card (`useUpcomingAppointments`).
> 6. **Quick actions** — 4-up `IconChip` grid (vitals/logs/doctors/members) with the per-feature category colors.
> 7. **Doses list** — rows with status pills + inline "تسجيل" → given/postpone/missed via the real `useLogDose` (gated by `canLogDoses`).
> 8. **Emergency banner** (red-tinted).
> Then point the Home dashboard branch (`(tabs)/index.tsx` / `circle-dashboard.tsx`) at `figma-home.tsx`, retire the Phase-C `today-overview`/View-ring usage, and screenshot-compare against the Figma on the S24 Ultra (dark + light, populated + empty). Preserve RTL, real data, and all backend/validation/notification logic.

---

*Inspected (read-only): the Figma export primaries + current `_layout.tsx`, `app-tabs.tsx`, `(tabs)/_layout.tsx`, `app.json`, `assets/fonts/`. Changed only: the 6 new figma files, `_layout.tsx`, `app-tabs.tsx`, `package.json`/`package-lock.json` (Expo/npm), and this report. No backend/secrets/EAS/deploy; not committed.*
