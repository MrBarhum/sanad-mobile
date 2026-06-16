# Figma Make → React Native Visual Parity Analysis

**Date:** 2026-06-16
**Type:** Analysis / planning report only. **No app source changed. No dependencies installed. Not committed.**
**Export analyzed:** `docs/figma/make-export/extracted/`
**Goal:** Reach the highest achievable visual parity between the Figma Make design and the shipped Sanad Expo/React Native app, while preserving Sanad's real data, navigation, auth, Supabase hooks, notification logic, picker/selector/validation fixes, RTL, accessibility, and medical-safety boundaries.

> **Honest framing up front.** The Figma Make export is a **Vite + React *web* app** (Tailwind v4 + shadcn/ui + lucide-react + Cairo web font + mock data). It is a high-quality **visual reference**, not code to port. "100% pixel-perfect" is **not** an honest target on Android React Native, for concrete reasons documented in §6 (no SVG arc primitive without an approved dependency, a different bundled font, a web color space, and — most importantly — Sanad's older-adult accessibility floor that *requires* larger type and bigger targets than the export uses). What **is** achievable is **high-fidelity visual parity**: same palette, same layout language, same hero, same card/rhythm/iconography, same dark-first warmth — re-expressed in Sanad's existing Expo/RN architecture with its accessibility rules honored. This report says exactly which parts match 1:1, which need adaptation, and how to minimize the visible delta.

---

## 1. Summary

**What Figma Make generated.** A self-contained web prototype of Sanad: one `App.tsx` phone-frame preview shell, a 3-tab bottom nav, and **12 hand-built screen components** (Home, Explore, Account, Medications, Emergency, Notifications, Tasks, Appointments, Vitals, Doctors, Members, Daily Logs). Visits reuses the Appointments screen. Each screen is styled with **inline `style={{…}}` objects + Tailwind utility classes**, uses **lucide-react** icons, and renders **hardcoded mock data** held in local `useState`. A Sanad-specific theme (`src/styles/theme.css`) defines the color tokens; `fonts.css` pulls **Cairo** from Google Fonts.

**Is the export complete enough to implement from?** **As a *visual* source of truth — yes, for the screens it covers.** As a *structural* spec — **no, on its own.** It is a curated set of **~12 "happy-path hero" screens**, not the ~112 screens/states the design-direction prompt requested. It does **not** include: splash, sign-in/sign-up, email-confirm, create-circle onboarding, join-by-code, recipient profile, notification settings / quiet hours / push-status, a dedicated Visits screen, medication detail + schedule editor + duplicate-time validation, any add/edit *form* beyond a 3-field demo sheet, task/appointment/visit/log/vital **detail** screens, role-change modal, invitations list, circle switcher as a full surface, and almost all **empty / loading / error / read-only** states. For those, the **existing Sanad handoff docs remain the structural source of truth** — pair this export with `sanad-mobile-screen-inventory.md` and `sanad-mobile-component-inventory.md`.

**Does it map to Sanad?** Strongly. Every generated screen corresponds to a real Sanad route/feature, the dose-loop model (`given / postponed / missed`) matches Sanad's exactly, the Arabic copy is realistic and on-brand, and the medical-safety + RTL + accessibility intentions in the prompt match Sanad's. The **two big divergences** from Sanad's current implemented design system are deliberate design decisions you must ratify: **(a) a teal primary** (`#2E8A7B` / dark `#4BA898`) instead of Sanad's brand blue (`#1B5FBE` / `#2F6FD0`), and **(b) the Cairo typeface** instead of the bundled IBM Plex Sans Arabic. Both are addressed in §3 and §10-Phase-A.

**Bottom line.** Proceed — but treat the export as a **design comp to translate**, screen by screen, into Sanad's primitives and tokens. Do the **token + Home work first** (highest visual leverage), and ratify the palette/font decisions before writing component code.

---

## 2. Export structure

### 2.1 Framework / build system
- **Vite 6 + React 18** web app (`vite.config.ts`, `index.html`, `src/main.tsx`). Scripts: `vite` / `vite build`. **Web only.**
- **Tailwind CSS v4** (`@tailwindcss/vite`, `tw-animate-css`) with CSS custom properties and `@theme inline`.
- **shadcn/ui** (50 Radix-based components under `src/app/components/ui/`) — **present but unused** by the actual screens (see §2.4). Default shadcn theme sits in `default_shadcn_theme.css` (overridden by Sanad's `theme.css`).
- **Icons:** `lucide-react` (web SVG icon set) everywhere.
- **Fonts:** `Cairo` + `Cairo Play` via a Google Fonts `@import` (`src/styles/fonts.css`).
- Heavy web-only deps in `package.json` (none of which belong in Sanad): `@mui/material`, `@emotion/*`, `recharts`, `embla-carousel`, `react-slick`, `react-dnd`, `vaul`, `cmdk`, `sonner`, `react-hook-form`, `react-day-picker`, `motion`, `canvas-confetti`, `next-themes`, `react-router`, etc.

### 2.2 Important files
| File | Role |
|---|---|
| `src/app/App.tsx` | Preview shell: a 390×844 "phone frame" with fake status bar + home indicator, `screenStack` stack-nav, dark-mode toggle, 3 tab→screen map. **Web preview chrome, not app architecture.** |
| `src/app/components/BottomNav.tsx` | 3-tab bottom bar (الحساب / استكشاف / الرئيسية), active tab gets a teal-tinted pill. |
| `src/app/components/*Screen.tsx` (12) | The actual designs (see §4). |
| `src/styles/theme.css` | **The visual gold mine** — Sanad color tokens, radius, dark/light (see §3.1). |
| `src/styles/fonts.css` | Cairo web font import. |
| `default_shadcn_theme.css` | Stock shadcn theme (mostly irrelevant; overridden). |
| `src/app/components/figma/ImageWithFallback.tsx` | A web `<img>` fallback helper (web-only). |
| `src/imports/pasted_text/sanad-app-design-direction.md` | The full prompt given to Figma Make — confirms intent, screen list, and constraints (matches Sanad's). |
| `guidelines/Guidelines.md` | **Unedited Figma template boilerplate** — no project rules; ignore. |
| `index.html`, `main.tsx`, `vite.config.ts`, `postcss.config.mjs`, `package.json`, `pnpm-workspace.yaml` | Web build scaffolding — **do not touch / do not port.** |

### 2.3 CSS / theme files
- `src/styles/theme.css` — the **Sanad token set** to mine (§3.1).
- `src/styles/fonts.css` — Cairo import.
- `src/styles/globals.css` (empty), `index.css`, `tailwind.css` — Tailwind plumbing.
- `default_shadcn_theme.css` — stock; ignore.

### 2.4 Assets & a critical structural note
- **No image/font binary assets** are bundled (Cairo loads from Google Fonts over the network; there are no `.ttf`/`.png`/`.svg` files in the export).
- **The 50 `ui/*.tsx` shadcn components are dead weight.** Spot-checking every screen, **none import from `./ui/…`** — the screens are hand-rolled with inline styles. So the shadcn library is Figma Make's default scaffold, **not** part of this design. Do not treat `ui/button.tsx`, `ui/card.tsx`, etc. as the spec; the *screens* are the spec.
- All "data" is **mock arrays + `useState`** inside each screen (e.g. `initialDoses`, `meds`, `emergencyContacts`). This is throwaway prototype state, **not** a data layer.

---

## 3. Visual direction extracted

### 3.1 Palette (from `theme.css`) — *this is the new visual target*
**Light ("warm porcelain"):** background `#F7F3EE`, card `#FFFFFF`, foreground `#1A1714`, muted `#EDE8DF`, muted-foreground `#6B6258`, border `rgba(26,23,20,0.1)`.
**Dark ("near-black graphite", dark is the default):** background `#0F0E0C`, card `#1A1916`, elevated/sunken `#232019`, foreground `#EDE8DF`, muted-foreground `#8A837A`, border `rgba(237,232,223,0.08)`.
**Brand & semantic (both modes):**
- **primary (teal):** light `#2E8A7B`, dark `#4BA898` — the signature brand color, used for the care ring, primary buttons, active tab, links, "تسجيل".
- **accent (gold/sand):** `#C8904A` (both modes).
- success `#4A9A75` / dark `#5AAE85`; warning = accent `#C8904A`; **error / emergency `#C45050`** (softer than Sanad's current `#BE2E2E`/`#D92D20`).
- **Per-feature "category" colors** (the `--chart-*` ramp, used as icon-chip tints across screens): blue `#5A8ABF`, purple `#8B6FA8`, green `#4A9A75`, gold `#C8904A`, teal `#4BA898`. Each feature/medication gets a color; chips render at ~12–18% opacity of it.

> **Divergence from current Sanad tokens.** Sanad today ships **blue** primary (`#1B5FBE`/`#2F6FD0`) and **no category-color system**. The export's warm backgrounds are very close to Sanad's (`#F6F4EF` ≈ `#F7F3EE`); the **primary hue is the real change.** Since the user wants to match the Figma design, the recommendation (§10-A) is to **re-point Sanad's `theme.ts` primary/semantic tokens to the export values and add a category-color ramp** — done once, in tokens, so every screen inherits it.

### 3.2 Typography
- **Family: Cairo** (a rounded, friendly, very legible Arabic+Latin family). Sanad currently bundles **IBM Plex Sans Arabic** (also excellent). Matching the export ⇒ bundle Cairo (font-asset + `expo-font` + the Expo font plugin in `app.json`). See §6 and §10-A for the decision.
- **Weights used:** 400 / 500 / 600 / 700 / 800 (the export leans on 700-800 for headings).
- **Sizes used (web px):** screen titles 18–26, hero number 26, section eyebrows 12–13, body 14–15, metadata 10–12, pills 10–11. **These are small** — see §6/§3-note: many fall **below Sanad's 14sp floor / 17sp body target**, so the RN build must scale them up. This is the largest unavoidable, *intentional* deviation.
- Letter-spacing is applied to a few Latin/eyebrow runs and the invite code — **must not be applied to Arabic** in RN (breaks letter-joining); the export already keeps it off Arabic body text.

### 3.3 Layout rhythm
- Horizontal gutter **20px** (`px-5`); top header pad **~56px** (`pt-14`, i.e. status-bar clearance — in RN this becomes the safe-area inset).
- Vertical rhythm: cards separated by 8–16px (`gap-2`/`gap-3`), sections by ~24px (`mb-6`/`gap-6`), section eyebrow label + content.
- **Radius is large and soft:** cards `rounded-2xl` (16) and `rounded-3xl` (24); bottom sheets `rounded-t-3xl` (24); pills/chips `rounded-full`; icon chips `rounded-xl`/`rounded-2xl` (12–16). Base `--radius` is `1.25rem` (20px). Maps cleanly to Sanad's `Radius` scale (`card:20`, `lg:16`, `xl:24`, `pill:999`).

### 3.4 Surface / card style
- Flat cards: `background: card` + **1px hairline border** (`rgba(…,0.07–0.1)`), **no drop shadow** in dark; shadows appear only on the circle-switcher dropdown and bottom-sheet scrims. A second "elevated/sunken" tone (`#232019` dark / `#F7F3EE` light) marks nested wells (next-dose chip, schedule chips, inputs). **No card-in-card heavy nesting.** This matches Sanad's surface philosophy (lifted bg + hairline in dark, whisper shadow in light) almost exactly.

### 3.5 Navigation style
- **Bottom tab bar, 3 tabs** (Home / Explore / Account), active = teal pill behind a 20px lucide icon + bolder label. Matches Sanad's tab set.
- **Stack screens** open over the tabs with a **circular back button** in the header (`ArrowRight`, which points the correct way for RTL "back"), a centered bold title, and a **round teal `+` button** for "add". Header also hosts a round **bell** and round **emergency phone** on Home.
- This is exactly Sanad's existing Expo Router model (tabs + pushed stack screens with native/headerless headers).

### 3.6 Home composition (the centerpiece — see §4/§6)
Top→bottom: header (date eyebrow • care-recipient name with a chevron-down circle switcher • "82 سنة · مسقط، عُمان") + round bell + round red emergency call → then the **Care-Loop hero card** (a real **SVG progress arc** showing `given/total` "جرعات اليوم", a "الجرعة التالية" next-dose chip, and a row of time-status pills) → a **2-up "today" stat row** (tasks 2/4, appointments 1) → a **next-appointment card** → a **4-column quick-actions grid** (vitals/logs/doctors/members, each a category-colored icon tile) → a **today-doses list** with inline `تسجيل` → expand-to-`أُعطيت/تأجيل/فائتة` → an **emergency banner**. It is genuinely **Today-first, single-hero, breathing** — the opposite of the rejected four-grid home.

### 3.7 Icon style
- **lucide-react** line icons, ~12–28px, 2px stroke (2.5 when active), almost always inside a **rounded chip tinted with the category/semantic color** at ~12–18% opacity. Never bare emoji, never decorative glyphs — consistent with Sanad's "semantic icon + label" rule. (Translation: lucide → Sanad's `<Icon>` semantic set; see §5/§8.)

### 3.8 Motion / interaction clues
- Arc fill animates (`transition: stroke-dasharray 0.6s ease`).
- Bottom sheets slide up from the bottom over a 50% scrim; tap-scrim to dismiss (Sanad's `FormModal` deliberately does **not** dismiss on scrim — keep Sanad's safer behavior).
- Inline dose-action row expands under a dose. Tab/active states animate color.
- Copy-code shows a 2s "تم النسخ" confirmation. All gentle, minimal — fits Sanad's "deliberate, minimal motion" rule. None of it requires a motion library in RN (use `LayoutAnimation`/`reanimated` already present, or nothing).

---

## 4. Screen inventory from export

| # | Export screen / file | Represents in Sanad | Maps to existing Sanad screen | Completeness |
|---|---|---|---|---|
| 1 | `HomeScreen.tsx` | Today-first care dashboard | `(tabs)/index.tsx` + `features/care-circle/*` | **Complete hero** (one populated "active day" variant). No empty/loading/error/no-circle variants. |
| 2 | `ExploreScreen.tsx` | "All tools" directory (3 grouped sections) | `(tabs)/explore.tsx` (currently a dev placeholder) | **Complete** as a grouped nav list. Reframes Explore as the *full feature index* (a real improvement over the current placeholder). |
| 3 | `AccountScreen.tsx` | Account hub (identity, circle, settings, sign-out) | `(tabs)/account.tsx` | **Complete** for the happy path. No loading/error; dark-toggle is in-screen (Sanad uses OS theme). |
| 4 | `MedicationsScreen.tsx` | Medications center (today doses + all meds) + add sheet | `medications/index.tsx` + `features/medications/*` | **Partial** — center + a 3-field add sheet. No detail, schedule editor, duplicate-time validation, edit, activate/deactivate flow. |
| 5 | `EmergencyScreen.tsx` | Emergency card (the show-a-stranger screen) | `emergency-card.tsx` + `features/emergency/*` | **Complete & strong** — identity, medical info, notes, contacts w/ call, disclaimer, current meds. |
| 6 | `NotificationsScreen.tsx` | Notifications center (read/unread) | `notifications.tsx` + `features/notifications/notifications-center.tsx` | **Partial** — center only. **No** notification *settings*, quiet hours, push-status, or local-test (a Sanad priority cluster). |
| 7 | `TasksScreen.tsx` | Tasks center (today/open/done) + add sheet + empty | `tasks/index.tsx` + `features/tasks/*` | **Partial** — center + minimal add + empty state. No detail/edit. |
| 8 | `AppointmentsScreen.tsx` | Appointments center (upcoming/completed) | `appointments/index.tsx` + `features/appointments/*` | **Partial** — center only; `+` is non-functional; **also reused as the "Visits" screen** by App.tsx. No add/detail. |
| 9 | `VitalsScreen.tsx` | Vitals center (2-col grid) + add sheet + disclaimer | `vitals/index.tsx` + `features/vitals/*` | **Partial** — center + add sheet. Carries the strongest non-diagnostic disclaimer. No detail/edit. |
| 10 | `DoctorsScreen.tsx` | Doctors list + one-tap call | `doctors.tsx` + `features/doctors/*` | **Partial** — list + call. `+` non-functional; no add/edit/detail. |
| 11 | `MembersScreen.tsx` | Care-circle roster + role legend + invite sheet | `circle-members/index.tsx` + `features/circle-members/*` | **Partial** — roster + role explanation + invite-code sheet. No change-role modal, invitations list, remove confirm. |
| 12 | `DailyLogsScreen.tsx` | Daily logs (observation cards) + add sheet | `daily-logs/index.tsx` + `features/daily-logs/*` | **Partial** — list + structured add sheet (option chips + notes). No detail/edit. |
| — | `App.tsx` / `BottomNav.tsx` | App shell + tab bar | `app/_layout.tsx`, `(app)/(tabs)/_layout.tsx`, `app-tabs.tsx` | Preview shell only (see §8). Tab bar visual = usable spec. |
| — | *(not generated)* | Splash, sign-in/up, onboarding, join-circle, recipient profile, notif settings, visits-own, all detail/forms/modals, all empty/loading/error/read-only states | See `sanad-mobile-screen-inventory.md` | **Missing — use the handoff docs as the spec; extrapolate the export's visual language onto them.** |

---

## 5. Component inventory from export

> The export has **no shared component library in use** (shadcn `ui/` is unused). The reusable *patterns* below are inlined repeatedly across screens — in Sanad they become (or map to) real primitives.

| Export pattern | Visual purpose | Props/variants visible | Sanad equivalent | Translation strategy |
|---|---|---|---|---|
| **Screen wrapper** `div.flex.flex-col.h-full dir="rtl"` + header (back/title/＋) | Page chrome | `isDark`, `onBack`/`onNavigate` | `components/screen.tsx` (+ native header) | Use `Screen`; header back-button + `+` → `IconButton`/`Button`. Safe-area replaces `pt-14`. |
| **Card** `rounded-2xl/3xl` + `1px border` | Surface | tone via inline bg | `components/surface.tsx` (`Surface`/`Card`, `SurfaceTone`) | Use `Surface`; add radius/tone to match. No new primitive. |
| **CareLoopArc** (SVG circle, 60° gap, `given/total`) | Signature dose-loop ring | `given`, `total`, `isDark` | `features/care-circle/today-care-ring.tsx` (bordered ring, **no SVG**) | **Decision (see §6):** approve `react-native-svg` to match the arc exactly, **or** adapt the existing bordered/segmented ring. Highest-visibility delta. |
| **Dose row** (status chip + name/dose + time + `تسجيل` → inline given/postpone/missed) | The medication loop | `status: pending/given/postponed/missed` | `features/medications/medications-center.tsx`, dose cards, `StatusBadge` | Rebuild row visuals; wire to real `useTodayDoses` + the existing mark mutations. Keep status = icon+text+color. |
| **Status pill / badge** (icon + Arabic label, tinted bg) | given/postponed/missed/pending | 4 states, color+bg+icon+label | `components/status-badge.tsx` | Map state→tone; **never color-only** (already satisfied). |
| **Category icon chip** (`{color}15/18` bg, lucide icon) | Feature/medication identity | `color`, `icon`, size 36–56 | `components/glyph-chip.tsx` (`iconName`, `tone`, `size`) | Add a "category color" tone option; use semantic `<Icon>`. |
| **Stat tile** (icon + label + big number `2` `/4`) | Today summary counts | label/value/color | `components/dashboard-tile.tsx` or a small new `StatTile` | Reuse `DashboardTile` pattern at larger type; tokens only. |
| **Quick-action grid tile** (4-col, icon chip + label) | Secondary nav | `id/label/icon/color` | `DashboardTile` / `NavCard` | 4-col grid of compact tiles — keep labels ≥ a11y floor (so likely 3-col or larger). |
| **Contact / doctor card** (avatar/icon + name + relation + LTR phone + round call) | One-tap call | `name/relation/phone/color` | `components/contact-card.tsx` | Direct map; `LtrText` for the phone; `tel:` via existing `Linking` helper. |
| **Notification row** (icon chip + title + body + time + unread dot, tinted unread bg) | Inbox | `read`, `type`, `color` | `features/notifications/notifications-center.tsx` | Restyle existing center; keep real unread source + `NotificationBell` badge. |
| **Bottom sheet** (`rounded-t-3xl`, grab handle, scrim) | Add forms | open/close, fields | `components/form-modal.tsx` / `picker-sheet.tsx` | Use `FormModal` (no scrim-dismiss — keep Sanad's safer rule). |
| **Text field** (`label` above + rounded input, `dir="rtl"`) | Forms | label/placeholder | `components/form-field.tsx` | Direct map; keep real validation. |
| **Option chips** (Daily Logs add) | Single-select enums | options[] | `components/option-select.tsx` | Direct map (selected = tint+border+check+bold). |
| **Tab switcher** (today/all, today/open/done…) | In-screen segmented control | active tab | (new) small `SegmentedTabs` or `OptionSelect` styled | Add a small segmented primitive or restyle `OptionSelect`. |
| **Back/Add/Bell/Emergency round buttons** (44px) | Header actions | — | `components/icon-button.tsx` | Use `IconButton`; **enlarge to ≥48dp** (export uses 44). |
| **Role legend / disclaimer banner** | Plain-language help / medical note | — | `components/info-banner.tsx` | Use `InfoBanner` tones. |

---

## 6. Visual parity feasibility

Legend: ✅ match closely · ◑ match with adaptation · ⚠ unavoidable difference (documented).

| Element / screen | Match exactly? | Needs adaptation? | Reason | Proposed RN implementation |
|---|---|---|---|---|
| **Colors / palette** | ✅ (values) | ◑ token swap | Hexes are portable; Sanad currently ships **blue**, export is **teal** | Re-point `theme.ts` `primary`/`primaryPressed`/`primaryBg`/`primaryText` + semantic + add category ramp to the export values. Backgrounds already ~match. **One-time, high-leverage.** |
| **Typography (family)** | ◑ | ◑ font bundle | Export uses **Cairo** (web `@import`); Sanad bundles **IBM Plex Sans Arabic** | **Decision:** to match Figma, add Cairo as a bundled `expo-font` asset + register weights in `app.json`'s font plugin + repoint `FontFamily`. Otherwise keep IBM Plex (close in spirit) — visible but subtle delta. |
| **Typography (sizes)** | ⚠ | ◑ scale up | Export body/meta run **10–14px**; Sanad requires **body ≥17sp, never <14sp**, targets ≥48/56dp | **Accessibility wins.** Re-map the export's scale onto Sanad's type scale (eyebrow→13–14, body→16–17, titles→19–30). Slightly lower density than the comp — *intended, mandatory* deviation. |
| **Bottom tabs** | ✅ | ◑ icons | 3 tabs, active teal pill — identical model; lucide→semantic icons | Restyle `app-tabs.tsx`: teal-tint active pill, label always visible, semantic `<Icon>` (home/compass/person). |
| **Medication dose cards** | ✅ | ◑ wire real data | Pure layout + the exact given/postponed/missed model Sanad already has | Rebuild card visuals in `medications-center` + dose components; wire to `useTodayDoses` + existing mutations; `StatusBadge` tones. |
| **Emergency card** | ✅ | minor | Static read-only layout, ports almost 1:1 | Restyle `emergency-card.tsx` + `contacts-manager`; red-tinted header, medical-info list, `ContactCard` call rows, keep the "ليست خدمة طوارئ" disclaimer. |
| **Notifications center** | ✅ | ◑ wire | Row layout ports cleanly | Restyle `notifications-center`; real unread source; **settings/quiet-hours/push-status not in export → design from handoff docs.** |
| **Forms** | ◑ | ◑ | Export shows only a 3-field demo sheet; Sanad forms are richer + validated | Use `FormField`/`FormModal`/`FormActions`/`OptionSelect`; **apply the export's visual styling, keep Sanad's fields + validation + pickers.** |
| **Modals / bottom sheets** | ◑ | ◑ behavior | Web sheet dismisses on scrim-tap; uses `vaul`/CSS | Use `FormModal`/`PickerSheet`; **keep Sanad's no-scrim-dismiss** (prevents data loss). Slide-up via existing libs. |
| **Icons** | ◑ | ◑ remap | lucide-react is web-only; Sanad uses `@expo/vector-icons` via semantic `<Icon>` | Map each lucide glyph → a semantic name (Ionicons/MCI); **add ~15 new semantic names** to `icons.ts` (§8). **No lucide install.** |
| **Shadows / elevation** | ✅ dark / ◑ light | minor | Dark uses border-only (matches Sanad); light uses soft shadow | Dark: hairline border + lifted bg (already Sanad's model). Light: `CardShadow`. |
| **SVG care-loop arc (ring)** | ⚠ | ◑ **dependency decision** | A true stroked progress arc needs `react-native-svg`; Sanad has **no SVG** and the current ring is a bordered/segmented `View` | **Decision point:** (a) get `react-native-svg` approved → near-exact arc; (b) adapt the **existing `TodayCareRing`** (bordered ring + segment strip) — no dep, ~85% of the impression. **Recommend (a) for parity** since the ring is the signature; otherwise (b). |
| **Per-feature category colors** | ✅ | ◑ tokens | Just color values | Add a `category` color ramp to `theme.ts`; apply as chip tones. |
| **Responsive layout** | ◑ | ◑ | Export is fixed 390×844; Sanad targets S24 Ultra + smaller, with safe areas | Use `Screen` (safe-area, max-width), flex/percentage grids; verify 360dp → 412dp; `pt-14` → top inset. |
| **RTL behavior** | ✅ | minor | Export hard-codes `dir="rtl"`, uses `ArrowRight` as back, LTR-isolates phones/codes | Sanad's `I18nManager` RTL + logical layout already do this; mirror only `chevron`; `LtrText` for phones/times/codes. **Better than the export** (export hard-codes direction; Sanad is logical). |
| **Tap targets** | ⚠ | ◑ enlarge | Export uses 44px buttons / 28px checkboxes / tiny pills | Enlarge to ≥48dp (primary ≥56dp). Minor visual growth; accessibility-mandatory. |
| **Status-bar / home-indicator / phone frame** | n/a | drop | Web preview chrome | Not part of the app; the OS provides these. |

---

## 7. What to translate into Sanad (the design ideas worth keeping)

1. **The teal "Warm Care OS" palette** — warm porcelain/near-black surfaces + **teal primary** + gold accent + soft `#C45050` emergency. Adopt as the token base.
2. **The Care-Loop hero** as the Home centerpiece — a single, calm, premium signature (arc + `given/total` + next dose + status-pill strip). This is the approved replacement for the rejected grid home.
3. **Today-first, single-hero Home composition** with strong hierarchy and breathing room (hero → 2-up stats → next appointment → quick actions → today doses → emergency banner). No wall of identical tiles.
4. **Inline dose marking** (`تسجيل` expands to أُعطيت / تأجيل / فائتة) — fast loop closure right where the dose is shown.
5. **Category-colored icon chips** — a quiet, premium way to differentiate features/medications without clutter (each at low-opacity tint).
6. **Large soft radii** (cards 20–24, pill chips) + **hairline-bordered flat cards** + **nested "elevated" wells** for sub-content.
7. **The Emergency card** layout — red-tinted header, "للاطلاع فقط — ليست خدمة طوارئ" badge, medical-info list, call rows, ambulance disclaimer. Near-1:1 portable and on-message.
8. **Explore as the full feature index** (grouped sections) — a genuine improvement over the current placeholder tab; demotes feature nav off Home cleanly.
9. **Plain-language role legend** on Members (مسؤول/محرر/مشاهد with one-line descriptions) — matches Sanad's "human capabilities, not DB roles" rule.
10. **Notification unread treatment** (tinted bg + unread dot + bolder title) and **"قراءة الكل"**.
11. **The realistic Arabic copy** throughout (dose statuses, disclaimers, role text, emergency wording) — reusable seed copy that already respects medical-safety and Western digits.
12. **Vitals/Daily-logs disclaimers** ("سجل توثيقي فقط… لا تُفسَّر"; "ملاحظات عائلية… ليست تقييمات طبية") — keep verbatim; they satisfy the medical-safety boundary.

---

## 8. What NOT to translate (web-only / unsuitable)

1. **The Vite/React web app shell** — `App.tsx` phone frame, fake status bar, home indicator, `screenStack`, `index.html`, `main.tsx`, `vite.config.ts`, `postcss.config.mjs`, `pnpm-workspace.yaml`. Sanad has Expo Router; keep it.
2. **`lucide-react`** — do **not** install `lucide-react` *or* `lucide-react-native`. Remap every glyph to Sanad's semantic `<Icon>` (Ionicons/MCI via `@expo/vector-icons`, already installed). New semantic names to add to `src/constants/icons.ts` (all resolvable in the two installed families — **no new dependency**):

   | lucide (export) | Used for | Proposed semantic name → family/glyph |
   |---|---|---|
   | `Compass` | Explore tab | `explore` → ionicons `compass-outline` |
   | `Activity` | vitals/general | `activity` → ionicons `pulse` (or reuse `vital`) |
   | `FileText` | daily log | reuse `dailyLog` |
   | `Stethoscope` | doctor/appointment | reuse `doctor` (MCI) / keep `appointment` calendar |
   | `Heart` | medical info | `heart` → ionicons `heart-outline` (no health-color) |
   | `MoreHorizontal` | row overflow | `more` → ionicons `ellipsis-horizontal` |
   | `Shield` | emergency disclaimer | `shield` → ionicons `shield-checkmark-outline` |
   | `Siren`/`AlertCircle` | emergency | reuse `emergency` (medkit) / `warning` |
   | `AlertTriangle` | warning | reuse `warning` |
   | `Droplets` | blood type/hydration | `drop` → ionicons `water-outline` |
   | `Thermometer` | temperature | `temperature` → MCI `thermometer` |
   | `Wind` | oxygen | `oxygen` → MCI `weather-windy`/`lungs` |
   | `MapPin` | location | `location` → ionicons `location-outline` |
   | `Crown` | owner role | `owner` → MCI `crown-outline` |
   | `Eye` | viewer role | `view` → ionicons `eye-outline` |
   | `Edit3` | editor role/edit | `edit` → ionicons `create-outline` |
   | `UserMinus` | remove member | `removeMember` → MCI `account-minus-outline` |
   | `Copy` | copy code | `copy` → ionicons `copy-outline` |
   | `Smile` | mood | `mood` → ionicons `happy-outline` |
   | `Utensils` | appetite | `appetite` → MCI `silverware-fork-knife` |
   | `Moon`/`Sun` | theme | `moon`/`sun` → ionicons `moon-outline`/`sunny-outline` |
   | `Home`/`User`/`Bell`/`Phone`/`Plus`/`Check`/`Clock`/`X`/`Calendar`/`ChevronLeft`/`ChevronDown`/`ArrowRight`/`Pill`/`Users`/`CheckSquare`/`Circle` | — | already covered by existing `medication/task/appointment/member/profile/notification/call/add/success/clock/close/calendar/chevron/dot` |

3. **shadcn/ui (`ui/*.tsx`) + Radix + MUI + emotion** — unused web component libraries. Ignore entirely.
4. **CSS-only patterns that don't map** — Tailwind utility classes, CSS custom properties, `@theme inline`, `tw-animate-css`, hover states, `letterSpacing` on Arabic, `textTransform: uppercase` (meaningless for Arabic).
5. **Browser-only APIs** — `<a href="tel:">` (use `Linking.openURL('tel:')`), `navigator.clipboard` (use `expo-clipboard` only if approved; otherwise existing share helper), `next-themes` dark toggle (Sanad follows OS theme via `useColorScheme`), `canvas-confetti`/`sonner`/`motion`/`recharts`.
6. **The in-screen dark-mode toggle button** — Sanad themes from the OS; don't add a manual toggle (the Account "الوضع الليلي" row can stay as a *visual* item but should map to OS setting guidance, not a custom theme store, unless separately specced).
7. **Unrealistic placeholder behavior** — local `useState` mock arrays, `Date.now()` ids, the non-functional `+` buttons, scrim-tap dismissal, the reused Appointments-as-Visits shortcut. These are prototype shortcuts.
8. **Mock data that must not replace real hooks** — `initialDoses`, `meds`, `appts`, `vitalsData`, `logs`, `members`, `doctors`, `emergencyContacts`, `notifs`, the invite code `SND-4F9K2`, "والدي أحمد / 82 سنة / مسقط". **Visuals only;** bind to the existing Supabase-backed hooks.

---

## 9. Mapping table — Figma export → Sanad code

| Area | Figma export source | Sanad target file(s) | Notes |
|---|---|---|---|
| **App shell** | `App.tsx` (preview frame) | `app/_layout.tsx`, `(app)/_layout.tsx`, `(app)/(tabs)/_layout.tsx` | Keep Expo Router; take only visual cues. |
| **Bottom tabs** | `BottomNav.tsx` | `components/app-tabs.tsx` (+ `.web.tsx`) | Active teal pill, semantic icons, always-on labels. |
| **Home** | `HomeScreen.tsx` + `CareLoopArc` | `(tabs)/index.tsx`, `features/care-circle/{circle-dashboard,today-overview,today-care-ring}.tsx`, `components/dashboard-tile.tsx` | **Supersedes the rejected home** (§11). Wire to real hooks. |
| **Medications** | `MedicationsScreen.tsx` | `medications/index.tsx`, `features/medications/{medications-center,medication-editor,medication-form,schedule-fields,schedule-summary}.tsx` | Restyle visuals; **keep schedule validation + pickers** (§12). |
| **Tasks** | `TasksScreen.tsx` | `tasks/index.tsx`, `features/tasks/{tasks-center,task-editor,task-form,tasks-card}.tsx` | Checkbox→complete; keep cancel/delete confirm. |
| **Appointments** | `AppointmentsScreen.tsx` | `appointments/index.tsx`, `features/appointments/{appointments-center,appointment-editor,appointment-form,appointment-fields,appointments-card}.tsx` | Export `+`/detail not designed — use handoff docs. |
| **Visits** | *(reuses AppointmentsScreen)* | `visits/index.tsx`, `features/visits/*` | No bespoke Visits design exists; reuse the appointment card language. |
| **Daily logs** | `DailyLogsScreen.tsx` | `daily-logs/index.tsx`, `features/daily-logs/{daily-logs-center,log-editor,log-form,log-fields,daily-logs-card}.tsx` | Keep "ملاحظات عائلية… ليست تقييمات طبية"; option chips → `OptionSelect`. |
| **Vitals** | `VitalsScreen.tsx` | `vitals/index.tsx`, `features/vitals/{vitals-center,vital-editor,vital-form,vital-fields}.tsx` | 2-col grid; keep strongest non-diagnostic disclaimer; value+unit+timestamp only. |
| **Doctors** | `DoctorsScreen.tsx` | `doctors.tsx`, `features/doctors/doctors-manager.tsx`, `components/contact-card.tsx` | Call row via `Linking`; phone in `LtrText`. |
| **Emergency** | `EmergencyScreen.tsx` | `emergency-card.tsx`, `features/emergency/{emergency-card,contacts-manager}.tsx`, `emergency-contacts.tsx` | Near-1:1 port; keep all disclaimers. |
| **Members** | `MembersScreen.tsx` | `circle-members/{index,invite,invitations}.tsx`, `features/circle-members/{members-manager,role-modal,permissions}.tsx`, `features/invitations/*` | Roster + role legend port; change-role modal/invitations from handoff docs. |
| **Notifications** | `NotificationsScreen.tsx` | `notifications.tsx`, `features/notifications/{notifications-center,notification-bell}.tsx` | Center ports; **settings/quiet-hours/push-status from handoff docs**, keep opt-in + honest copy (§12). |
| **Account** | `AccountScreen.tsx` | `(tabs)/account.tsx`, `features/circle-selection/circle-switcher.tsx` | Identity + grouped sections + danger sign-out; theme follows OS. |
| **Forms / pickers / modals** | inline add-sheets (Meds/Tasks/Vitals/Logs/Members) | `components/{form-field,form-modal,form-actions,option-select,weekday-selector,date-field,time-field,date-time-field,picker-sheet,timezone-picker}.tsx` | Apply export styling to the **existing** form/picker primitives; **do not replace picker internals** (§12). |
| **Shared cards / components** | inline card/chip/badge/contact/notification patterns | `components/{surface,glyph-chip,status-badge,nav-card,dashboard-tile,contact-card,info-banner,icon-button,button,states}.tsx` | Restyle in place; tokens only. |
| **Theme tokens** | `styles/theme.css` (+ `fonts.css`) | `src/constants/theme.ts` (+ `src/constants/icons.ts`, font assets, `app.json` font plugin) | The single source of truth; everything else inherits. |

---

## 10. Implementation strategy (phased, for visual parity)

> Sequenced by leverage and risk. Each phase is independently reviewable; **stage specific files only; no `git add .`; no commit/push unless asked.** Device screenshot comparison on the S24 Ultra (Arabic, RTL, dark) is the acceptance gate from Phase C onward.

### Phase A — Theme / token alignment *(do first; highest leverage)*
- **Files:** `src/constants/theme.ts` (primary/semantic re-point to teal + add category-color ramp + confirm warm bg/dark values); `src/components/themed-text.tsx` (confirm scale, raise body floor to 17 if approved); `src/constants/icons.ts` (add the ~15 new semantic names from §8). **Font decision:** if adopting Cairo — add font assets + `expo-font` + the font plugin in `app.json` and repoint `FontFamily` (this is the one place a *config* file is in scope, and it needs explicit approval since `app.json` is otherwise protected).
- **Risks:** palette change ripples app-wide (intended); contrast must be re-verified (teal on porcelain, teal on near-black); a font swap touches every screen and `app.json` (native font registration).
- **Validation:** `tsc`, `expo-doctor`, `check:mojibake`, `diff --check`; contrast spot-checks; render a couple of existing screens to confirm nothing breaks.
- **Screenshot comparison?** Light (a before/after of one existing screen to confirm the token swap reads correctly).

### Phase B — Shared primitives
- **Files:** `components/{surface,button,status-badge,glyph-chip,nav-card,dashboard-tile,contact-card,info-banner,icon-button,states,screen}.tsx`; possibly a small new `SegmentedTabs` primitive (today/all switcher) and a `StatTile`. **Decision gate:** the `CareLoopArc` — if `react-native-svg` is approved, build an `ArcRing`; else refine `today-care-ring.tsx`.
- **Risks:** keep public props stable so screens don't need lock-step edits; `react-native-svg` (if approved) is a **native** dependency → triggers a dev-client rebuild (must be explicitly approved and planned).
- **Validation:** `tsc`/`expo-doctor`; component render checks in dark + light.
- **Screenshot comparison?** Yes for the ring (arc vs adapted) to confirm the chosen approach reads as premium.

### Phase C — Home replacement (the rejected home → Figma home)
- **Files:** `(app)/(tabs)/index.tsx`, `features/care-circle/{circle-dashboard,today-overview,today-care-ring}.tsx`, `components/dashboard-tile.tsx`, `features/circle-selection/circle-switcher.tsx`, the five `features/*/*-card.tsx`. **This overwrites the rejected prototype files** (§11) — content replacement, not git surgery.
- **Risks:** must keep the real hooks (`useTodayDoses`, upcoming appointments, today tasks, active circle) and not regress loading/empty/error/no-circle states (which the export omitted — design them from the handoff docs). Type sizes/targets must meet the a11y floor (so density differs slightly from the comp).
- **Validation:** full check suite; **device screenshot comparison required** (Home active-day vs the export Home), plus the no-data/loading/error variants.
- **Screenshot comparison?** **Yes — mandatory.** This is the headline parity screen.

### Phase D — Priority screens: Medications, Emergency, Notifications, Forms
- **Files:** `features/medications/*` + `medications/*`; `emergency-card.tsx` + `features/emergency/*` + `emergency-contacts.tsx`; `features/notifications/notifications-center.tsx` (+ keep settings/opt-in untouched in logic, restyle only); the form/picker primitives styling pass.
- **Risks:** **highest** around medications (schedule validation, duplicate-time, pickers) and notifications (opt-in/channel order, push-status copy) — these are protected (§12); restyle the *wrappers* only. Forms must keep real fields + validation.
- **Validation:** full suite; verify pickers still render/return values on Android; verify duplicate-time still blocks save; verify notification opt-in sequence unchanged.
- **Screenshot comparison?** Yes for Medications center + Emergency card + Notifications center; functional QA for forms/pickers.

### Phase E — Remaining modules
- **Files:** tasks/appointments/visits/daily-logs/vitals centers + editors + forms; doctors; members/invitations/role-modal/recipient-profile; account; auth/onboarding/join (not in export → from handoff docs); all empty/loading/error/read-only states.
- **Risks:** breadth; consistency drift — enforce tokens + primitives from A/B.
- **Validation:** full suite per feature slice; device QA in AR/RTL/dark.
- **Screenshot comparison?** Spot-check per module; full pass before any release.

---

## 11. Handling the rejected current Home changes

**Current uncommitted (pre-existing) working-tree changes** — the rejected Today-first prototype:
`src/features/care-circle/{circle-dashboard,today-overview}.tsx`, `src/features/{tasks,appointments,daily-logs,vitals,visits}/*-card.tsx`, `src/locales/{ar,en}.json`, and untracked `src/components/dashboard-tile.tsx` (+ the report `docs/claude-reports/2026-06-15-today-first-home-refinement.md`).

- **Should the Figma design supersede them? YES.** The Figma Make Home (Care-Loop hero, single-hero, breathing) is the **approved visual target** and directly replaces the rejected four-grid home. The rejected files' *concept* (today-first, the dose ring, the feature cards) survives; their *layout* (stacked identical `DashboardTile` grids) is what the Figma design overrides.
- **How to replace safely without git surgery (no `reset`/`restore`/`clean`):** A later implementation task should **overwrite the file contents in place** using normal edits — i.e. open `today-overview.tsx` / `circle-dashboard.tsx` / `dashboard-tile.tsx` and **rewrite their JSX to the Figma-derived layout**, keeping the real hooks. The new code simply *replaces* the rejected code as a forward edit; the rejected version never needs to be "restored to" — it is edited past. `dashboard-tile.tsx` is either repurposed (kept as a smaller/quieter tile used sparingly) or its content replaced by the new hero/stat-tile primitives.
- **Locales:** the rejected change touched `ar.json`/`en.json` (Today quick-tile copy). Keep both files structurally identical; the implementation updates copy forward to match the Figma wording — again a forward edit, not a revert.
- **Net:** no git history operations. The working tree moves from "rejected prototype" to "Figma-parity implementation" by editing the same files forward. (If the team prefers a clean base, that is a **human decision** to make via normal git outside this analysis — this report does not perform or recommend `reset`/`restore`/`clean`.)

---

## 12. Protected files to avoid (touch only as the explicit, verified task)

Restyle the **visual wrapper** only; never change the logic in:
- **Date/time pickers & selectors:** `components/{date-field,time-field,date-time-field,picker-sheet,weekday-selector,timezone-picker,option-select}.tsx`, `date-time-shared.ts`, `src/utils/date.ts`. (Android blank-surface fix, leap-clamp, weekday behavior, `'YYYY-MM-DD'`/`'HH:MM'` contracts.) **Do not swap picker internals.**
- **Medication schedule validation:** `features/medications/{schedule-validation,schema}.ts`, `features/care-activity/today.ts`. (Duplicate-time + conflict logic, dose computation, React-key safety.)
- **Notification registration / hooks:** `features/notifications/{push-registration,hooks,notification-observer,push-status-card,schema,device}.ts(x)`. (Channel-before-permission, no auto-prompt, honest copy, Quiet Hours.) Restyle `notifications-center`/`notification-bell` visuals only.
- **Auth / circle gating:** `app/(app)/_layout.tsx`, `app/(auth)/_layout.tsx`, `providers/*`, `features/care-circle/circle-gate.tsx`, `features/circle-selection/*`.
- **Destructive-action & unsaved-changes machinery:** `components/{item-actions,unsaved-changes-guard}.tsx`, `utils/confirm.ts`, `hooks/use-unsaved-changes.ts`.
- **Supabase / backend / data hooks** — `features/**/api.ts`, `features/**/hooks.ts`, anything touching queries/mutations/RLS/RPC. **Visual layer reads existing hooks; it does not change what they fetch or write.**
- **Env / config / secrets** — `.env*`, EAS, Supabase, Firebase. Never touched. (`app.json` only if the Cairo-font decision is approved, and then only the font plugin entry.)
- **Encoding guards** — `scripts/check-mojibake.js`, `.editorconfig`, `.gitattributes`.

---

## 13. Acceptance criteria for later implementation

A parity implementation slice is acceptable only when **all** hold:
- [ ] **Visual match to the Figma Make comp** on **S24 Ultra screenshots** (Arabic, RTL, **dark-first**, then light) — palette, hero, cards, rhythm, iconography read as the same design within the documented, intentional deviations (type ≥ a11y floor, targets ≥48/56dp, no SVG arc only if the dep wasn't approved).
- [ ] **Arabic RTL correct** end-to-end — logical layout (no hardcoded left/right), `chevron` mirrors, LTR runs (phones/times/doses/codes/emails) isolated via `LtrText`, Western digits.
- [ ] **Dark mode correct** (the primary theme) and light mode verified; all colors via `theme.ts` tokens.
- [ ] **No web dependencies** added — no `lucide-react(-native)`, `vite`, `shadcn`, `@mui/*`, `tailwind`(web), `recharts`, `motion`, etc. Icons via the semantic `<Icon>`. (`react-native-svg` only if separately approved for the arc.)
- [ ] **No backend changes** — hooks/queries/mutations/RLS untouched; real data wired, no mock arrays shipped.
- [ ] **Existing logic preserved** — pickers render/return values; duplicate-medication-time + schedule-conflict validation intact; notification opt-in/channel-before-permission/honest copy intact; destructive actions confirm; unsaved-changes guard intact.
- [ ] **No raw Unicode glyph icons**; status = icon + text + color; **no medical interpretation** (value+unit+timestamp only; disclaimers preserved); no guaranteed-emergency / guaranteed-delivery claims.
- [ ] **`npx tsc --noEmit`, `npx expo-doctor`, `npm run check:mojibake`, `git -c core.autocrlf=false diff --check`** all pass.
- [ ] **Device QA required before any commit**; commit only when asked, specific files only.

---

## 14. Final recommendation

- **Proceed?** **Yes.** The export is a strong, on-brand, premium visual direction that decisively answers the rejected-home problem. It is worth implementing.
- **Is the export code alone enough?** **No — not as a build-from-source spec.** It is ~12 happy-path hero screens of *web* code with mock data. Use it as the **visual comp**, and pair it with the existing handoff docs (`sanad-mobile-screen-inventory.md`, `sanad-mobile-component-inventory.md`, `sanad-mobile-design-acceptance-criteria.md`) for the ~100 screens/states it didn't generate. **Translate, don't port.**
- **More Figma screenshots needed?** **Yes, for the gaps** — to hit parity on the missing surfaces, request comps (or Figma frames) for: **splash, sign-in/up, create-circle onboarding, join-by-code, recipient profile, notification *settings* + quiet hours + push-status, a dedicated Visits screen, medication *detail* + schedule editor + duplicate-time validation, the full add/edit *forms* for each module, detail screens, change-role modal, invitations list, and every empty/loading/error/read-only state.** Also request the **light-mode** variants (the export ships dark-first; light values exist in tokens but few light comps were generated) and the **3 Home alternatives** the prompt asked for (only one Home was generated).
- **Decisions to ratify before coding (Phase A):** **(1)** adopt the **teal primary** (recommended — it's the whole point of matching the comp); **(2)** **font** — bundle **Cairo** for exact parity *or* keep **IBM Plex Sans Arabic** (close, zero new asset/config) — recommend a quick side-by-side on device; **(3)** the **arc ring** — approve **`react-native-svg`** for an exact arc *or* adapt the existing no-dependency ring.
- **Home first, or full app in phases?** **Home first**, then the priority cluster (Medications → Emergency → Notifications → Forms), then the rest — exactly the polish order the design prompt itself requested. Do **Phase A (tokens) before Home**, because the palette/type/icon foundation is what makes every subsequent screen match cheaply.
- **Safest next Claude Code prompt strategy:** scope each implementation prompt to **one phase / one feature slice**, and in the prompt: name the **target Sanad files**, attach the relevant **export screen + this report's mapping row**, restate the **protected-files list (§12)** and **acceptance criteria (§13)**, require **tokens-only + semantic icons + real hooks (no mock data)**, forbid **web deps + git add . + commits**, and require **device screenshot comparison** before declaring done. Start with: *"Phase A — align `theme.ts` to the Figma Make palette (teal primary + category ramp), add the new semantic icon names, decide the font; analysis report at `docs/claude-reports/2026-06-16-figma-make-visual-parity-analysis.md` §10-A. No source beyond tokens/icons; run the four validations; do not commit."*

---

*Inspected: the full `docs/figma/make-export/extracted/` tree (12 screens, App shell, BottomNav, `theme.css`, `fonts.css`, `package.json`, the design-direction prompt, Guidelines, shadcn `ui/` confirmed unused); Sanad `src/constants/{theme,icons}.ts`, `components/icon.tsx`, and the prior handoff docs. No app source, package files, `app.json`, `.env`, or backend touched. No dependencies installed. Not committed.*
