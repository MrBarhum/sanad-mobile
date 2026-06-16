# Sanad → Figma Make: Exact-Copy Technical Plan

**Date:** 2026-06-16
**Type:** Plan only. **No implementation. No dependencies installed. No `package.json`/`app.json`/source changed (except this report). Not committed.**
**Mandate:** Stop adapting. Make the running Sanad app look **as literally like the Figma Make output as possible** — layout, hierarchy, spacing, shapes, typography, the care ring, tabs, cards, the whole visual feel — while eventually preserving real data, backend/auth/notification/medication logic, Arabic RTL, and Android/Expo-dev-client runtime.

> **Brutally honest headline:** "Close enough through Sanad's existing components" is structurally incapable of matching Figma — that is exactly what produced the rejected result twice. To get a near-pixel match we must **rebuild the view layer from the Figma component tree**, add **three things the current app lacks** (`react-native-svg`, the **Cairo** font, and the **lucide** icon shapes), **stop routing Home through Sanad's primitives** (`Surface`/`Section`/`Screen`/`DashboardTile`/`CircleSwitcher`/`NavCard`/the View-ring/the Ionicons set), and **adopt the Figma layout/type values verbatim** (including its small type, which conflicts with Sanad's older-adult accessibility floor — a real tradeoff, called out in §10/§13). This requires an Expo **dev-client rebuild** (native modules). It is a view-layer rebuild, not a data/back-end rebuild.

---

## 1. Executive summary

The Figma Make export is a **Vite/React web** app: hand-built screens using **lucide-react** icons, **Cairo** (Google Fonts), an **inline-SVG** care-loop arc, a teal "Warm Care OS" palette, large soft radii, and small dense type — wrapped in a 390×844 phone-frame preview. Sanad is **Expo/React Native** with **IBM Plex Sans Arabic**, **Ionicons/MaterialCommunityIcons**, **no SVG**, and a mature, accessibility-tuned component system (`Surface`, `Section`, `Screen`, `DashboardTile`, `StatusBadge`, `Button`, `NavCard`, `CircleSwitcher`, the bordered-View ring).

Phase A aligned the **color tokens** (teal) and Phase C re-laid Home, but both **reused Sanad's primitives, type family, and the View-ring** — so the output kept Sanad's spacing rhythm, card chrome, section headers, icon shapes, and ring silhouette. It read as "old Sanad with Figma colors." That is the core failure (§2).

**Recommended path:** a **from-scratch RN rebuild of the presentation layer** that mirrors the Figma DOM 1:1, driven by a **new `figma/` token + primitive set** encoding the export's literal values, with **`react-native-svg`** (the arc + exact vector icons), **`lucide-react-native`** (exact icon shapes), and **bundled Cairo**. Real data flows into the new visual shells via the existing hooks (unchanged). Old primitives are **replaced for rebuilt screens**, not adapted. A WebView "show-it-on-the-phone" demo is possible and is the *only* truly 100% pixel-identical option, but it cannot be the product (mock data, no real auth/Supabase, degraded RTL/native/perf/a11y) — recommended only as a throwaway reference (§5).

With `react-native-svg` + lucide + Cairo + faithful primitives, **most of the UI can be made visually identical** (layout, color, radii, cards, ring, tabs, pills, grid, icons); a short list remains **near-identical** (font shaping metrics, shadow rendering, the device's real status bar vs the export's fake one, cross-device width) — enumerated honestly in §9/§10.

---

## 2. Why previous attempts failed visually

Concretely, the prior work routed the Figma design through Sanad abstractions, each of which injects Sanad's look:

- **`Screen`** imposes `Gutter` (20→24), `MaxContentWidth` centering, and its own safe-area padding model — not the Figma `px-5 pt-14` full-bleed scroll.
- **`Surface`/`Card`/`Section`** impose Sanad's card radius (`Radius.card = 20`), hairline, padding (`Spacing.four = 24`), light-only shadow, and an accessible **section header** (`sectionTitle` 19/30/700) — the Figma has no such section chrome; its cards are `rounded-3xl`(24)/`rounded-2xl`(16) with `p-4`/`p-5` and 13px eyebrow labels.
- **`DashboardTile`** (even "lighter") is still a titled tile with a chip + meta in a wrap-grid — not the Figma's 4-up **icon-only quick-action** tiles with 10px labels, nor its 22px-number stat cards, nor its dose rows.
- **`CircleSwitcher`** renders a bordered card with a glyph avatar + role — not the Figma header's inline recipient name (20/700) + `chevron-down` + custom dropdown + age/location subtitle.
- **`today-care-ring.tsx`** is a **full bordered View circle** — fundamentally a different silhouette from the Figma **stroked 300° arc with a 60° gap and round caps**.
- **Ionicons/MCI** icon shapes differ from **lucide** (stroke weight, corner radius, metaphors) — so even identical placement reads as a different app.
- **IBM Plex Sans Arabic** vs **Cairo** changes letterforms, weight texture, and rhythm app-wide.
- **Sanad's accessible type scale** (body 16–17, never <14) vs the Figma's 10–13px dense type changes information density and hierarchy.

None of these are bugs — they're the system working as designed. The lesson: **adapting through them can only ever approximate.** Exact match requires bypassing them on rebuilt screens.

---

## 3. Figma export structure and what must be copied

Source: `docs/figma/make-export/extracted/` (Vite/React, shadcn present-but-unused, screens are inline-styled + lucide + mock data). The **values to copy verbatim**:

**Palette (`src/styles/theme.css`)** — already in Sanad's `theme.ts` after Phase A. Dark (default): bg `#0F0E0C`, card `#1A1916`, elevated `#232019`, border `rgba(237,232,223,0.07)`, text `#EDE8DF`, muted `#8A837A`, primary `#4BA898`, accent `#C8904A`, success `#5AAE85`, error `#C45050`. Light: bg `#F7F3EE`, card `#FFFFFF`, elevated `#F7F3EE`, border `rgba(26,23,20,0.08)`, primary `#2E8A7B`. Category ramp `--chart-1..5` (teal/gold/green/purple/blue). `--radius: 1.25rem` (20).

**Type (`src/styles/fonts.css`)** — **Cairo** (300/400/500/600/700/800) + Cairo Play. Observed sizes: hero number 26/700, screen titles 18–26/700–800, section eyebrows 12–13/600, body 14–15, metadata 10–12, pill labels 10–11. Line-height ~1.5.

**Care-loop arc (`HomeScreen.tsx` → `CareLoopArc`)** — SVG `144×144`, circle `r=54`, `cx=cy=72`, `strokeWidth=10`, **`gapAngle=60°`** (arc = 300°), `startAngle = 90 + 30 = 120°`, `strokeLinecap="round"`, track `rgba(237,232,223,0.1)`/`rgba(26,23,20,0.08)`, fill `--sanad-primary` (teal), progress = `(given/total) × arcLength` via `strokeDasharray`, **0.6s ease** fill transition. Center: `given` 26/700 + `/total` 15/400 + "جرعات اليوم" 11/muted, `paddingTop: 8`.

**Home layout (`HomeScreen.tsx`)** — `dir="rtl"`, scroll container; header `px-5 pt-14 pb-4` with date 12/muted, recipient `20/700` + `ChevronDown`, age/location 12/muted, round **44px** `Bell` + round **44px** red `Phone` (emergency, `rgba(196,80,80,0.12)` bg); circle-switcher dropdown (`rounded-2xl`, shadow); **hero** `mx-5 rounded-3xl p-5` with eyebrow "دورة الدواء · اليوم" 13/600 + "عرض الكل" teal link, then arc + next-dose chip + a wrap row of status time-pills (`rounded-full px-2 py-1`, icon 12 + time, tinted by status); **today summary** two `rounded-2xl p-4` stat cards (number 22/700); **next appointment** `rounded-3xl p-4` (48px icon chip + name/time + `ChevronLeft`); **quick actions** `grid-cols-4 gap-3`, each `rounded-2xl py-3` with a 40px tinted icon chip + 10px label, per-feature colors (`#5A8ABF/#8B6FA8/#4A9A75/#C8904A`); **doses list** rows `rounded-2xl px-4 py-3` (36px status circle + name/dose + time + status pill + "تسجيل" → inline 3 action buttons given/postpone/missed, each `rounded-xl py-2.5` status-tinted); **emergency banner** `rounded-3xl p-4` red-tinted (44px `AlertCircle` chip + text + filled red "عرض" button).

**Shell (`App.tsx`)** — fake 390×844 phone frame, fake status bar (9:41 + SVG wifi/battery), home-indicator pill, fixed dark-mode toggle, dark default, `BottomNav` only on tab screens. **The frame/status-bar/indicator/toggle are preview chrome — NOT copied** (the device provides real chrome).

**Bottom nav (`BottomNav.tsx`)** — `dir="rtl"`, 3 tabs (الحساب/استكشاف/الرئيسية), each ≥48 min-height; active = teal pill (`44×28 rounded-xl`, `rgba(75,168,152,0.15)`) behind a 20px lucide icon at `strokeWidth 2.5`, label 11px (600 active/400 idle), `borderTop` hairline, `pb-6`.

**Other screens (`*Screen.tsx`)** — Medications, Emergency, Notifications, Tasks, Appointments, Vitals, Doctors, Members, DailyLogs, Account, Explore: same idiom (header back-arrow + title + round teal `+`, tinted icon chips, `rounded-2xl/3xl` cards, bottom-sheet add forms, per-feature colors, lucide icons, mock data). Visits reuses Appointments. These define the full-app target (§9-plan).

**Deps to copy the *intent* of (not the web packages):** `lucide-react` → lucide shapes; Cairo → Cairo; inline `<svg>` → `react-native-svg`. Ignore `@mui/*`, `recharts`, `vaul`, `cmdk`, `react-router`, shadcn, Vite, Tailwind-web.

---

## 4. Best recommended strategy for exact visual match

**RN presentation-layer rebuild against a dedicated Figma design layer, with the three missing capabilities added.** Structure:

1. **New token module `src/constants/figma-tokens.ts`** (or extend `theme.ts`) holding the **literal** Figma values: the exact hexes (already aligned), the **radius scale 8/12/16/20/24**, the **Figma type scale** (10/11/12/13/14/15/16/18/20/22/26 with weights), the per-feature **category** colors, the **44/40/36/28px** chip sizes, `px-5`/`pt-14` spacing. Critically, this layer does **not** inherit Sanad's accessibility-tuned scale; it mirrors Figma. (Sanad's `theme.ts` stays for non-rebuilt areas during migration.)

2. **New Cairo font**, bundled and loaded before first paint; set as the default family for the rebuilt UI.

3. **`react-native-svg`** for the care-loop arc (exact 300° stroked arc + round caps + reanimated 0.6s fill) and for any precise vector.

4. **`lucide-react-native`** so every icon is the *same shape* as Figma (the single biggest "feels like a different app" lever after type).

5. **New Figma-faithful primitives** under `src/components/figma/`: `FigmaScreen` (full-bleed RTL scroll, `px-5`, real safe-area top instead of `pt-14`), `FigmaCard` (radius 16/20/24 + exact border/bg, no Sanad shadow rules), `IconChip` (tinted circle/rounded square at 36/40/44/48), `CareLoopRing` (SVG), `StatusPill`, `DoseRow`, `QuickActionTile`, `StatCard`, `SectionEyebrow`, `FigmaTabBar`, `FigmaHeader`, `FigmaButton`, `FigmaField`, `FigmaBottomSheet`. These mirror the Figma component tree names/structure so the port is mechanical and reviewable.

6. **Rebuild each screen** as a 1:1 translation of the corresponding `*Screen.tsx` (same tree, same numbers), then **wire real data** (existing hooks) into the same visual shells. Replace `App.tsx`'s frame with the device; replace `BottomNav` with `FigmaTabBar` wired to Expo Router tabs.

7. **Keep all data/logic** (Supabase, auth gate, notifications, medication validation, pickers) behind the new views. The pickers/validation are logic+some UI; for exact match their *visible* surfaces (date/time sheets, weekday selector, option chips) get Figma-faithful wrappers, but the validated logic is reused, not rewritten (§7 protected note).

This is "rebuild the rendering, reuse the brains." It is the honest route to parity and it is fully compatible with the non-negotiables (data/RTL/Android/backend preserved).

---

## 5. Alternative strategies considered

| Strategy | Visual fidelity | Verdict |
|---|---|---|
| **A. RN rebuild + svg + lucide + Cairo + new primitives** (recommended §4) | **Near-pixel** (95–99% on the target device) | **Recommended.** Only path that's both exact and a real, data-backed product. |
| **B. RN rebuild using Figma values but NO new deps** (Ionicons, View-ring, IBM Plex) | ~70–80% | **Rejected.** This is essentially what failed — wrong icons, wrong ring silhouette, wrong font. "Exact" is impossible without svg/lucide/Cairo. |
| **C. Deeper design-system replacement** (delete Sanad primitives, make the Figma primitives THE system app-wide) | Near-pixel, and cleaner long-term | **Recommended as the end-state of A.** Same work as A, just also retiring the old primitives once all screens migrate. Do A first, converge to C. |
| **D. WebView rendering the exported Vite app** | **100% pixel** (it *is* the Figma output) | **Reference/demo only.** Mock data, no Supabase/auth/notifications, no real RTL keyboard/native gestures, worse perf/scroll/a11y, can't preserve behavior. Good for "see it on the phone today"; cannot be the product. If used, isolate behind a hidden `/figma-preview` route, never the real tabs. |
| **E. Hybrid: WebView for a pixel-reference + RN rebuild for the product** | n/a | **Useful.** Ship D as an internal compare-target while building A. Low cost, high value for QA. |
| **F. nativewind (already installed) to run the Figma Tailwind classes directly** | High, and fast to port | **Adopt as an accelerant inside A** where the Figma uses classes; fall back to explicit `StyleSheet` with the same numbers for inline-styled parts. Not a standalone strategy. |

---

## 6. Dependencies required for true parity

> All installed with `npx expo install <pkg>` so Expo resolves SDK-56-compatible versions. **Do not install in this task.** Native modules require an **Expo dev-client rebuild** (one rebuild covers all of them).

| Dependency | Why needed | Figma feature it enables | Dev-client rebuild? | Risks | Alternative if not added |
|---|---|---|---|---|---|
| **react-native-svg** | RN has no vector/stroked-arc primitive | The signature **CareLoopArc** (300° stroked arc, round caps, proportional fill, 0.6s animate); any precise vector; backing for lucide icons | **Yes** (native) | Minimal — first-class Expo support, ubiquitous; must rebuild dev client once | Bordered-View ring (the rejected silhouette) — **not acceptable for parity** |
| **lucide-react-native** | Sanad's Ionicons/MCI are different shapes than the Figma's lucide | Exact icon shapes everywhere (Bell, Pill, Stethoscope, Activity, FileText, Users, AlertCircle, Chevrons, Check/Clock/X, Phone, Plus, Crown/Eye/Edit, etc.) | **Yes** (pulls react-native-svg) | Icon-system migration; small bundle add; must keep our semantic `<Icon>` indirection so call sites stay clean | Hand-port only the ~30 used lucide glyphs as `react-native-svg` paths (no extra dep, more work) **or** keep Ionicons (not exact) |
| **Cairo font** (via **@expo-google-fonts/cairo**, or bundle the TTFs in `assets/fonts`) | Figma uses Cairo; IBM Plex reads as "old Sanad" | The entire typographic feel (Arabic letterforms, weight texture, rhythm) | **No** (runtime load via existing `expo-font`; production embedding optional via the font plugin) | Cairo Arabic shaping differs from IBM Plex (intended); must load 400/500/600/700(/800) before first paint to avoid a flash; slightly larger asset payload | Keep IBM Plex — **not exact** |
| **react-native-reanimated** | *(already installed, 4.3.1)* | The arc fill 0.6s transition + tab/press micro-motion | No | None | Static ring (acceptable, slightly less faithful) |
| **nativewind** | *(already installed, 4.2.5)* | Lets us mirror the Figma Tailwind classes literally to speed a faithful port | No | className/native edge cases | Explicit `StyleSheet` with identical numeric values |

**Net new installs to recommend:** `react-native-svg`, `lucide-react-native`, `@expo-google-fonts/cairo` (the last is JS+assets, no rebuild). One dev-client rebuild for the two native ones.

---

## 7. Files/components that should be replaced, not adapted

Direct calls. For **rebuilt (Figma) screens**, do **not** route through these — they impose the old look:

- **`src/components/screen.tsx`** → replace usage with `FigmaScreen` (full-bleed RTL scroll, `px-5`, safe-area top, no max-width centering on phone). *(Keep `Screen` for not-yet-migrated screens during migration.)*
- **`src/components/surface.tsx` (`Surface`/`Card`/`Section`)** → replace with `FigmaCard` + `SectionEyebrow`. Sanad's `Section` header and card chrome are a primary "old Sanad" tell.
- **`src/components/dashboard-tile.tsx`** → **discard** for Home; replace with `QuickActionTile` (icon-only, 10px label) + `StatCard` (22px number). It cannot become the Figma tiles by adaptation.
- **`src/features/circle-selection/circle-switcher.tsx`** → **discard its card UI** on Home; rebuild as the Figma inline header name + `ChevronDown` + dropdown sheet. **Keep the multi-circle data/logic** (`useCircleSelection`).
- **`src/features/care-circle/today-care-ring.tsx`** (View ring) → **replace** with `CareLoopRing` (react-native-svg). Different silhouette; not adaptable.
- **`src/components/app-tabs.tsx`** → **replace** with `FigmaTabBar` (3 tabs, teal pill, 20px lucide icon, 11px label). Wire to Expo Router `Tabs`.
- **`src/components/status-badge.tsx`, `glyph-chip.tsx`, `nav-card.tsx`, `button.tsx`, `icon-button.tsx`** → replace with `StatusPill`, `IconChip`, `FigmaButton`, etc. for rebuilt screens (Sanad's badge/button radii, paddings, and icon shapes differ).
- **`src/components/icon.tsx` + `src/constants/icons.ts`** → re-point the semantic `<Icon>` to **lucide-react-native** families (keep the semantic-name indirection; swap the underlying family). This makes every screen's icons exact in one place.
- **`src/features/*/*-card.tsx`** (the 5 dashboard cards) → rebuilt as Figma tiles/stat cards (or removed in favor of the new Home composition).
- **Type scale in `src/components/themed-text.tsx`** → for rebuilt screens, use the Figma sizes (via `figma-tokens`); the Sanad accessible scale stays for legacy screens until migrated.

**Keep and reuse (logic, not look):** all `features/**/api.ts` + `hooks.ts`, `providers/*`, `circle-gate.tsx`, `circle-selection/provider.tsx`, `schedule-validation.ts`, `today.ts`, the date/time/picker logic, notification registration/hooks, `utils/*`. The pickers' *visible* surfaces get Figma wrappers; their validated internals are reused (do not rewrite the blank-surface/leap-clamp/duplicate-time fixes).

---

## 8. Home exact-copy plan

**Goal:** `(tabs)/index.tsx` (the dashboard branch) renders a 1:1 translation of `HomeScreen.tsx`, on real data.

**New files**
- `src/components/figma/figma-tokens.ts` — exact values (radius 8/12/16/20/24, type scale, category colors, chip sizes, `px-5/pt-14`).
- `src/components/figma/figma-screen.tsx`, `figma-card.tsx`, `icon-chip.tsx`, `status-pill.tsx`, `section-eyebrow.tsx`, `care-loop-ring.tsx` (svg), `quick-action-tile.tsx`, `stat-card.tsx`, `dose-row.tsx`, `figma-header.tsx`, `circle-dropdown.tsx`.
- `src/features/care-circle/figma-home.tsx` — the composed screen (header → hero(ring+next dose+status strip) → today summary(2 stat cards) → next appointment → quick actions(4-up) → doses list → emergency banner), matching the Figma tree.

**Replaced/retired on Home:** `circle-dashboard.tsx` + `today-overview.tsx` (current adapted versions superseded by `figma-home.tsx`), `today-care-ring.tsx` (→ `CareLoopRing`), `dashboard-tile.tsx` usage, `CircleSwitcher` card usage, `app-tabs.tsx` (→ `FigmaTabBar`).

**Dependencies needed for Home:** `react-native-svg` (ring), `lucide-react-native` (all Home icons), **Cairo** (all Home text). All three are required for an exact Home; without any one of them Home cannot match (ring shape, icon shapes, or font will be wrong).

**Data wiring (unchanged hooks):** `useTodayDoses`/`summarizeDoses` → ring `given/total`, the status strip, and the doses list with real `useLogDose` actions (gated by `canLogDoses`); `useTodayTaskSummary`/`useTodayAppointmentSummary` → the two stat cards; `useUpcomingAppointments` → the next-appointment card (or a calm empty state if none); `useCircleSelection`/`ActiveCircle` → header recipient name + dropdown; existing routes for taps; `NotificationBell` count source reused behind a lucide `Bell`.

**Specifics — must match:** the **300° arc** (not a full ring); **44px** round header buttons; **Cairo** weights; the **per-feature category colors** on quick-action chips; the **status time-pill strip**; the **inline "تسجيل" → 3 actions** dose interaction; the red **emergency banner + header phone button**; `rounded-3xl`(24) hero / `rounded-2xl`(16) tiles; dark as the default theme.

**Honest Home deltas:** the device's real status bar replaces the fake 9:41 bar; the phone-frame/home-indicator are dropped; on a 412dp S24 the fixed `px-5` leaves marginally more content width than the 390px comp (near-identical); Cairo on Android shapes Arabic slightly differently than Cairo-on-web (near-identical); Sanad's accessibility floor is **not** applied here (Figma's 10–13px text is copied) — see §10/§13.

---

## 9. Full-app exact-copy plan

Same idiom applied screen-by-screen, each a 1:1 translation of its `*Screen.tsx` with real data:

- **Bottom tabs** → `FigmaTabBar` (3 tabs, teal pill, lucide icons, 11px labels) on Expo Router `Tabs`. Replaces `app-tabs.tsx`.
- **Shared cards** → `FigmaCard`/`IconChip`/`SectionEyebrow` everywhere (replace `Surface`/`Section`/`NavCard`).
- **Buttons** → `FigmaButton` (teal filled primary `rounded-2xl`, secondary tinted, the round `+` header button, the filled red emergency button).
- **Status badges** → `StatusPill` (icon + label, status-tinted, `rounded-full`) matching the Figma dose/appointment/task statuses.
- **Forms** → `FigmaField` (label 13/600 + `rounded-xl` input on elevated bg) + the add/edit **bottom sheet** (`rounded-t-3xl`, grab handle, scrim) — reuse Sanad's validated form/picker logic inside.
- **Modals/sheets** → `FigmaBottomSheet` for add-medication/task/vital/log/contact/role; the circle-switcher dropdown; date/time/weekday pickers visually wrapped (logic preserved).
- **Medications** → center (today doses + med list, summary pill, today/all tab switcher), dose card states, add/edit, detail + schedule editor + duplicate-time validation surface, all in the Figma idiom. (Highest-value screen after Home.)
- **Emergency** → red-tinted header, "للاطلاع فقط — ليست خدمة طوارئ" badge, medical-info list, one-tap call rows, current-meds list, disclaimer. Near-1:1 portable.
- **Notifications** → center (unread tinted rows + dot, "قراءة الكل"); plus the settings/quiet-hours/push-status screens (not in the export → design in the same idiom; preserve opt-in/channel-before-permission).
- **Explore / Account** → grouped section lists (icon chip + label + sublabel + `ChevronLeft`), danger sign-out, identity header. Explore becomes the full feature index.
- **Tasks / Appointments / Visits / Daily logs / Vitals** → centers (tab switchers, status pills, per-feature colors), add sheets, detail/edit — reuse the Forms pattern.
- **Auth / onboarding / join / recipient profile / detail screens / empty-loading-error states** → not in the export; build in the same idiom from the screen-inventory doc.

Convergence (Strategy C): once a screen is migrated, delete its old primitives' usages; when all screens are migrated, retire `Surface`/`Section`/`DashboardTile`/`NavCard`/`app-tabs`/the View-ring entirely so the Figma primitives are the only system.

---

## 10. Exact-match blockers and how to remove them

| # | What can't match now | Technical change to make it match | Recommend? |
|---|---|---|---|
| 1 | **Stroked 300° care arc** (we draw a full View ring) | Add **react-native-svg**; draw the exact `Circle` with `strokeDasharray`/`strokeLinecap="round"`/rotate | **Yes** |
| 2 | **Icon shapes** (Ionicons/MCI ≠ lucide) | Add **lucide-react-native**; re-point semantic `<Icon>` to it | **Yes** |
| 3 | **Typography feel** (IBM Plex ≠ Cairo) | Bundle **Cairo**, set as default family, load before paint | **Yes** |
| 4 | **Old card/section/tab chrome** (Sanad radii/padding/headers/shadows) | Build `figma/` primitives; stop using `Surface`/`Section`/`DashboardTile`/`app-tabs` on rebuilt screens | **Yes** |
| 5 | **Information density** (Sanad ≥14–17sp vs Figma 10–13px) | Adopt the Figma type scale in `figma-tokens` for rebuilt screens | **Yes for parity** — but this **regresses older-adult accessibility**; recommend shipping an optional "larger text" scale later, and being explicit with the user that exact = small text (§13) |
| 6 | **Fake iOS status bar / 9:41 / phone frame / home indicator** | None desirable — the device renders the real status bar and gesture area | **No** (these are preview chrome; copying them on a real phone is wrong) |
| 7 | **Cross-device pixel identity** (comp is 390×844; S24 ≈ 412×915 dp) | Use the same px values; accept proportional reflow; optionally scale by width | **Partially** — match at the target size; near-identical elsewhere (don't pixel-freeze a phone UI) |
| 8 | **Shadow rendering** (CSS `box-shadow` ≠ RN elevation/shadow) | Use `react-native-svg`/layered views or tuned RN shadow to approximate; dark mode uses borders anyway (matches) | Near — acceptable |
| 9 | **Arc fill animation (0.6s)** | Use **reanimated** (already installed) to animate `strokeDasharray` | **Yes** (cheap) |
| 10 | **Dark-mode toggle button (fixed)** | Sanad follows OS theme; offer a real setting in Account, not a floating toggle | **No** (preview-only artifact) |

No blocker is an irreducible "React Native limitation" — each is removed by a dependency or a rebuild. The only things we deliberately **won't** match are preview-chrome artifacts (6, 10) and absolute cross-device pixel-freezing (7).

---

## 11. Implementation phases (ordered for parity, not for low risk)

**Phase 0 — Capability foundation (enables everything).** `expo install react-native-svg lucide-react-native @expo-google-fonts/cairo`; **rebuild the Android dev client**; add `figma-tokens.ts`; load Cairo in the root layout (before paint); re-point the semantic `<Icon>` to lucide. *Validate:* `tsc`/`expo-doctor`/`check:mojibake`; app boots with Cairo + lucide on one existing screen.

**Phase 1 — Exact Home shell: tabs + font + SVG ring.** Build `FigmaTabBar` (replace `app-tabs`), `FigmaScreen`, `CareLoopRing` (svg, static props). Verify the tab bar + ring against the Figma on device (screenshot compare). *Pure visual; no data yet.*

**Phase 2 — Exact Home content.** Build `figma-home.tsx` + all Home primitives (header/dropdown, hero, stat cards, next-appointment, quick actions, dose rows, emergency banner); wire real hooks + `useLogDose`. Retire `circle-dashboard`/`today-overview`/`today-care-ring`/`DashboardTile` on Home. Screenshot-compare Home vs Figma (dark + light, populated + empty).

**Phase 3 — Exact shared primitives.** Finalize `FigmaCard`, `StatusPill`, `FigmaButton`, `IconChip`, `FigmaField`, `FigmaBottomSheet`, `SectionEyebrow` as the reusable kit; wrap the date/time/weekday pickers visually (preserve logic).

**Phase 4 — Priority screens.** Medications → Emergency → Notifications → Forms (add/edit sheets), each a 1:1 port on real data, preserving validation/opt-in. Screenshot-compare each.

**Phase 5 — Remaining screens/states.** Tasks/Appointments/Visits/DailyLogs/Vitals/Doctors/Members/Explore/Account + auth/onboarding/join/profile/detail + empty/loading/error/read-only states (from the screen-inventory doc, in the Figma idiom). Then retire the legacy primitives (converge to Strategy C).

**Throughout:** dark-first; RTL via `I18nManager` + logical layout + `LtrText` for times/phones/codes; real data only; backend/validation/notification logic untouched; device screenshot-compare is the acceptance gate.

---

## 12. First implementation task to run after approval

> **Phase 0 + 1 — "Figma capability foundation + exact Home shell (no data)."**
>
> In `E:\Projects\sanad-mobile`, with approval to add dependencies and rebuild the dev client:
> 1. `npx expo install react-native-svg lucide-react-native @expo-google-fonts/cairo` (do **not** hand-edit `package.json` versions; let Expo resolve). Rebuild the Android Expo dev client.
> 2. Add `src/components/figma/figma-tokens.ts` encoding the **exact** Figma values from `docs/figma/make-export/extracted/src/styles/theme.css` + `HomeScreen.tsx` (radius 8/12/16/20/24; type scale 10/11/12/13/14/15/16/18/20/22/26 with weights; category colors `#5A8ABF/#8B6FA8/#4A9A75/#C8904A`; chip sizes 28/36/40/44/48; gutter 20; header top via safe-area). Do **not** reuse Sanad's accessible scale here.
> 3. Load **Cairo** (400/500/600/700/800) in `src/app/_layout.tsx` `useFonts` alongside the existing fonts; gate first paint on it.
> 4. Re-point the semantic `<Icon>` (`src/components/icon.tsx` + `icons.ts`) to **lucide-react-native**, keeping the semantic names; map the names used by Home (bell/medication/doctor/appointment/task/vital/dailyLog/member/profile/call/emergency/chevron/chevronDown/check/clock/close/add/activity/heart).
> 5. Build `src/components/figma/care-loop-ring.tsx` with **react-native-svg** matching the arc exactly (r54, cx/cy72, stroke10, gap60° → 300° arc, startAngle120°, round caps, teal fill, track tints, reanimated 0.6s fill) — static `given`/`total` props.
> 6. Build `src/components/figma/figma-tab-bar.tsx` (3 tabs, teal pill 44×28, 20px lucide icon at strokeWidth 2.5, 11px label) and wire it as the Expo Router tab bar (replace `app-tabs` on the tabs layout).
> 7. **Validate:** `npx tsc --noEmit`, `npx expo-doctor`, `npm run check:mojibake`, `git -c core.autocrlf=false diff --check`. Run on the **S24 Ultra** and screenshot-compare the **tab bar** and the **ring** against the Figma. No data wiring, no other screens. Do not commit.

This proves the three capabilities (svg/lucide/Cairo) and the two hardest exact elements (ring + tabs) before touching data — if those match, the rest is mechanical.

---

## 13. Risks

- **Dev-client rebuild required** (react-native-svg + lucide-react-native are native). The user must accept rebuilding the Android dev client; until then the new icons/ring won't run. (Cairo alone needs no rebuild.)
- **Accessibility regression (the big one).** Copying Figma's 10–13px type and tighter targets **violates Sanad's older-adult accessibility rules** (≥14/17sp, ≥48dp). The user explicitly prioritizes exact match over adaptation, so this is a *chosen* tradeoff — but it is a real product regression for the actual audience. **Recommendation:** match Figma now for sign-off, then add an optional global "larger text / comfortable" scale so the family can opt into accessibility without abandoning the look. Get explicit user acknowledgment.
- **Icon-system migration churn.** Re-pointing `<Icon>` to lucide touches every screen's icons at once; mitigated by the existing semantic indirection (one file changes the family). Verify no missing lucide names.
- **Cairo flash / load timing.** Must gate first paint on Cairo or text flashes IBM Plex/system first; bundle the needed weights only to control payload.
- **Two parallel design systems during migration.** Until Phase 5 converges, both Sanad and Figma primitives exist; enforce that rebuilt screens use only `figma/` primitives to avoid a hybrid look.
- **Picker/validation surfaces.** Wrapping the date/time/weekday pickers visually must not regress the blank-surface/leap-clamp/duplicate-time fixes — wrap, don't rewrite.
- **Scope/time.** This is a multi-phase rebuild, not a tweak. Honest expectation: Home exact (Phases 0–2) is a meaningful chunk; full-app parity (Phases 3–5) is larger.
- **Cross-device variance.** Pixel-exact at 390/412dp; other sizes near-identical. Don't promise pixel-freeze across all phones.

---

## 14. Final recommendation

**Proceed with Strategy A (RN presentation-layer rebuild) + the three dependencies (`react-native-svg`, `lucide-react-native`, Cairo), converging toward Strategy C.** This is the only path that is simultaneously **near-pixel-accurate** and a **real, data-backed, RTL-correct, Android-runnable product**. Adapting through Sanad's primitives cannot reach parity — that has been demonstrated twice; stop doing it.

- **Do Home first** (Phases 0–2): it's the rejected screen, the highest-value proof, and it exercises every hard capability (svg ring, lucide, Cairo, faithful primitives, real data). If Home matches on the S24, the approach is validated and the rest is mechanical translation.
- **Build the optional WebView `/figma-preview`** (Strategy D/E) as a throwaway pixel-reference for QA compare — never as the product.
- **Accept and document the accessibility tradeoff** (Figma's small type) with the user, and plan an opt-in larger-text scale.
- **Approve dependency installs + one Android dev-client rebuild** before Phase 0; nothing in this plan touches Supabase/auth/notifications/medication logic — that all stays behind the new views.

What can be **100% identical:** layout structure, spacing, radii, colors (exact hex), the care arc (with svg), card shapes, dose list, quick-action grid, tab pill, status pills, and — with lucide — the icons. What can only be **near-identical:** Cairo's Android-vs-web Arabic shaping, shadow rendering, the device's real status bar (vs the fake one, which we should not copy), arc anti-aliasing, and absolute pixel parity across non-target screen sizes. What should **not be preserved** from current Sanad: the View-ring, `DashboardTile`, `Surface`/`Section` chrome, `app-tabs`, the `CircleSwitcher` card UI, Ionicons/MCI shapes, IBM Plex as the family, and Sanad's accessible type scale on rebuilt screens — each blocks parity.

---

*Inspected (read-only): the Figma export primaries (`App.tsx`, `HomeScreen.tsx` incl. `CareLoopArc` geometry, `BottomNav.tsx`, `theme.css`, `fonts.css`, `package.json`) and current Sanad state (`app.json`, `assets/fonts/` = IBM Plex only, `theme.ts`/`icons.ts`/`icon.tsx`, the Home stack, shared primitives). No source/config changed except this report. No dependencies installed. Not committed.*
