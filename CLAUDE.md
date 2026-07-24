@AGENTS.md

# Standing engineering law — NEVER a function-form Pressable `style` (device-verified)

**This bug has been found and fixed twice and reintroduced once. Do not bring it back a third time.**

Under this project's NativeWind setup (`babel.config.js` uses `jsxImportSource: 'nativewind'`, so `react-native-css-interop` wraps **every** RN core component), a **function-form `style` on a `Pressable`** — `style={({ pressed }) => [...]}` (or `=> pressed && x`, or any callback) — is **dropped on the Android device**. The css-interop resolves the inline `style` prop, cannot walk a function, spreads it to `{}`, and overwrites the real style. Result: the box (border + fill + padding + radius) never renders and the control collapses to bare, borderless text/icons. Static styles are unaffected. This is device-only (native) — `tsc`/web/most tooling look fine, so it is NOT caught by CI; it is only visible on the Android device.

- **BROKEN (never write this on a Pressable):**
  `style={({ pressed }) => [styles.chip, { backgroundColor }, pressed && styles.pressed]}`
- **CORRECT:**
  `android_ripple={{ color: theme.backgroundSelected }}` + `style={[styles.chip, { backgroundColor }, disabled && styles.disabled]}`
  Get press feedback from **`android_ripple`**, never a `pressed` style callback. Keep all `disabled`/`selected`/tone branches as **static** array entries (they are fine — it is only the `({ pressed }) =>` wrapper that breaks).

History: first isolated 2026-06-19 (`docs/claude-reports/2026-06-19-fix-figma-footer-primary-button-raw-implementation.md`), reintroduced by the `acccdcd` Dar restyle into `OptionSelect`, then swept app-wide 2026-07-24. The one intentional exception is `app-tabs.web.tsx` — a **web-only** file where the native css-interop path does not run (its native twin `app-tabs.tsx` is unaffected). A quick guard: `grep -rnE "style=\{\(\{\s*pressed" src/` should return only that web file.

# Standing decisions (Milestone 4 — "The Pulse")

These are settled product/engineering conventions for Sanad. Follow them by default; call out any deliberate departure in your session report.

## Visibility posture — transparent circle (A1)
Every **active** member may **see** all of a circle's operational data (tasks, doses, appointments, visits, logs, vitals) — this mirrors the server `can_view_all_operational` posture. The UI never hides other members' work from a non-manager. Instead, lists offer an explicit **«مهامي / كل المهام»** (mine / all) scope toggle, defaulting collaborators to "mine" and managers to "all". Unassigned open work shows an inline **«أنا متكفّل»** claim for any claim-capable member. Who can *mutate* is still gated by role + RLS (unchanged); only *visibility* is transparent.

## Canonical feature order (A7)
Order features the same way everywhere (Home quick-actions, Explore, in-list grouping):

**medications → tasks → appointments → vitals → visits → daily logs → doctors → members**

Within a list, surface what needs attention first, then fall back to chronological: tasks = overdue → priority (urgent→low) → due date/time; doses = unlogged first (stable, time order preserved within each group).

## Canonical terminology (A8)
One term per concept, in **every** namespace including `figma.*`:
- Task "open" status → **«مفتوحة»** (not «معلقة»).
- Medication / schedule "active" → **«فعّال»** ; inactive → **«غير فعّال»** (not «نشط» / «موقوف»).
- "No assignee" in pickers → the shared `assignment.none` copy (don't reintroduce per-feature variants).
- Member display name always comes from `memberDisplayName()` (full name → email local-part → neutral fallback); never a bare «عضو» when any identity exists, never a raw email inline.
All user-facing strings live in i18n (`ar.json` + `en.json`, kept at **exact key parity**). No hardcoded Arabic in components/handlers — including notification action labels and confirmations. `__DEV__`-only QA strings are the sole exception.

## Confirmation patterns
A one-tap action that mutates data or ends a session must be guarded by exactly one of these three sanctioned patterns — never fire silently:
1. **`confirmAction()`** (`src/utils/confirm.ts`) — the lightweight cross-platform prompt (sign-out, claim, medication/schedule activate·deactivate).
2. **Inline two-step confirm** — the delete rows (`ItemActions` / body confirm).
3. **Bottom-sheet confirm** — task complete/cancel and dose-status correction.

Every mutation must also **surface its failure** (an `accessibilityRole="alert"` message), never revert silently.

## Zero new native dependencies (this phase)
Do not add packages that require a native rebuild / EAS build. Use only what's already installed (Expo SDK 56 set). New capability must be composed from existing native modules (`expo-linking`, `expo-notifications`, `expo-secure-store`, …) or deferred. Pure-JS dependencies are acceptable only with strong justification.

## Backend changes are hand-applied
Migrations and edge functions are **written** in-repo but **never** auto-applied/deployed. Each backend-touching change ships with an ordered runbook step the maintainer runs (migrations → deploy functions → `cron.schedule` → Auth redirect URLs). Never run `supabase db push` / `functions deploy` / SQL mutations / cron changes without explicit approval of the exact command. Never print secrets or raw push tokens.

# Standing decisions (Milestone 5 — "The Redesign")

## One token system is law (P2-2 closed)
`src/constants/theme.ts` is the **single** source of design tokens — color (`Colors.light/dark` via `useTheme()`), the type scale (`Type` / `FontSize`), `Spacing`, `Radius`, `ChipSize`, `IconSize`, `CardShadow`, `TouchTarget`, `Gutter`, and the `withAlpha()` helper. The parallel `figma-tokens.ts` / `form-typography.ts` system is **deleted** — do not reintroduce a second token or font layer. New UI reads tokens via `useTheme()` + the `theme.ts` exports; never hardcode a hex/size that a token already covers.
> **The single-token-system rule stands.** Two clauses are SUPERSEDED by Milestone 6 ("Dar"): (1) the palette VALUES were re-pointed to the "Dar / Green & Sand" identity (same key names, new values + a few new keys); (2) the typeface is now **Cairo**, not IBM Plex Sans Arabic — see the M6 section below.

## Type floor = 14 (P1-8)
14 is the **absolute** floor for any text a caregiver reads — nothing below 14 anywhere (body 16, Arabic line-heights ≥1.5×). Prefer spreading a `Type.*` preset over hand-setting fontSize/lineHeight/fontFamily. The only sanctioned sub-14 uses are pure decorative chrome that is NOT content (a superscript count badge, a «·» meta separator).

## Danger tone is calm + restrained
Emergency / destructive UI uses a **restrained** danger tone + an icon — visible, never alarming (no harsh alarm-red). Danger text → `errorFg`; a solid danger fill → `dangerSolid` (the softer `#C45050`, not a bright alert red) with `onError`. The warm **gold accent** (`accentSolid` / `accentFg`) is reserved for **celebratory + empty-state** moments only; caution/warning uses the dedicated **amber** `warningFg`, never the gold. Status is never color-only — always icon + text.

## Care is not a game (no gamification)
No streaks, scores, points, leaderboards, or competitive mechanics — anywhere. Completion is acknowledged with a **quiet** moment of care (e.g. a gentle «اليوم اكتمل» on the dose ring), never a reward mechanic. Motion is subtle and short, and respects the OS reduced-motion setting.

## The card ruling — one Surface, border both themes
> **SUPERSEDED by Milestone 6 ("Dar").** The whisper-soft light-mode shadow is retired: a Dar card is **flat in both themes** — `card` fill, a **2px solid `line` border**, `Radius.sm` (8), and **no shadow** (flat elevation everywhere; overlays use a scrim, not lift). The *one-Surface* rule and everything below still holds — only the hairline+shadow treatment changed. See the M6 card law.

`Surface` (`src/components/surface.tsx`) is the **one** card/panel primitive. A card carries a **hairline border in BOTH themes** — the border defines the edge for older eyes and is what reads in dark mode, where a shadow barely registers. A **whisper-soft shadow** (`CardShadow`) sits *on top* in **light mode only**, as warmth; dark mode has no shadow. Tinted/sunken tones (`primary`, `sunken`, …) stay flat — a single elevation step, no shadow. `Card` is a named alias of `Surface`; there is **no** `FigmaCard`/`FigmaFormCard` — both are deleted. Group a card's fields with the `gap` prop (was FigmaFormCard's job); size inner padding with `padded` (`true` = `Spacing.four`, a number = dp, `false` = none).

## One component per job — the M5 survivors
Each visual job has exactly **one** component; the Figma-era duplicates were folded and deleted. Do not reintroduce a parallel variant.
- **Card / panel** → `Surface` (⊃ FigmaCard, FigmaFormCard).
- **Text field** → `FormField` (⊃ FigmaField, FigmaFormField) — spreads all `TextInputProps`; has `required` + `hint`.
- **Single-choice selector** → `OptionSelect` (⊃ FigmaChipSelect, FigmaCardSelect) — `variant="chip"` (default) or `"card"` (radio + title + optional `description`). `WeekdaySelector` stays separate because it is **multi-select** (checkbox), but its chip visuals match `OptionSelect`.
- **Identity / icon chip** → `GlyphChip` (⊃ icon-chip) — takes a semantic `iconName` (never a resolved color); `color` overrides the tone.
- **Empty state** → `EmptyState` (`src/components/states.tsx`) — one Surface card + a `GlyphChip` in the feature's semantic icon + title (+ optional subtitle). Every list empty uses it; each screen passes **its feature icon**. Error states keep their own bespoke card (they are not empties).
- **Toggle** → `FigmaSwitch` (the 48×28 brand pill) — never the platform `Switch`.

## One sheet chrome, one header back affordance
The **canonical bottom-sheet chrome** is the centered `backgroundElement` card: `Radius.card` top corners, a hairline border, an 8dp `backgroundSelected` grab handle, `MaxFormWidth`, a `sectionTitle` title. `FormModal`, `PickerSheet`, and `FigmaBottomSheet` all wear it. They remain **three components** on purpose — each encodes a different behavior contract (FormModal: explicit-close + keyboard-avoidance + submit/cancel footer; PickerSheet: backdrop-cancel + Done/Clear/Cancel; FigmaBottomSheet: backdrop-dismiss action sheet). Match the chrome; never merge the behaviors.
The **canonical back affordance** is a round **44dp pill + back arrow** (`FigmaHeader`). `FigmaFormScreen`'s header matches it. List headers (centered title, add button) and form headers (start title+subtitle, divider) stay distinct chrome for distinct screen classes; only the shared back atom is unified.

## Copy voice — «دفء عائلي هادئ» (calm family warmth)
Every user-facing string, in `ar.json` **and** `en.json` (kept at exact key parity), speaks in one voice:
- **Simple Modern Standard Arabic** — no dialect. Short sentences. **Gender-neutral** (masdar / neutral forms), so a daughter, son, or nurse all read naturally.
- **Never guilt or alarm.** A missed dose is a *fact to act on*, not a failure — «جرعة فائتة» / «لم تُسجّل بعد», never blame. An empty day is *good news* — «يوم هادئ» / «… بعد» / «كل شيء على ما يُرام».
- **Errors say what happened + what to do** — no codes, no jargon: «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» Use «تعذّر …», never «فشل» / «خطأ».
- **Celebration stays quiet** — a plain «تم حفظ التغييرات» / «اكتملت جرعات اليوم». **No exclamation marks, no emojis** in core UI (both locales are at zero — keep them there).
- **The care recipient is always spoken of with dignity** — «الشخص الذي تعتني به» / «الشخص الذي يتلقّى الرعاية», never a cold or clinical label.
North star: `pulse.shareEmpty`. English mirrors the same warmth. When a warmer wording would risk changing **meaning** (a medical/legal disclaimer, a canonical status enum «مفتوحة» / «فعّال», a precise field label or password rule), leave it and flag it — never guess.

# Standing decisions (Milestone 6 — "Dar" visual identity)

The chosen art direction is **«دار · الأخضر والرمل» (Dar / Green & Sand)** — a "family house" feel: sturdy, grounded, everything in its place. Warm sand canvas, cream cards, a deep-green header band. These laws are the visual constitution; the pixel source of truth is `docs/design/design/Sanad Home Directions.dc.html` (where it and any spec disagree, the HTML wins). All the Milestone 4/5 laws above stay in force EXCEPT the two clauses explicitly marked **SUPERSEDED** — the 14 floor, calm danger tone, care-is-not-a-game, one-component-per-job, one-sheet-chrome, and the copy voice all remain law.

## Flat, bordered, grounded (supersedes the M5 card shadow)
- **2px solid borders on almost everything** — cards, buttons, inputs, list containers, icon squares, tab bar, dividers. The border color is the `line`/`border` token (in light it equals `ink`; in dark it *lightens* away from `ink` so edges read). Small status pills / tiny badges use a **1.5px** stroke.
- **Flat elevation everywhere** — no gradients, no glassmorphism, essentially no shadows. `CardShadow` is retired to a no-op; depth comes from the border + tint tones, not lift. Sheets/overlays use a **scrim** (see one-sheet-chrome), never a drop shadow.
- **Radius scale = 8 / 6 / 4 / 999 / 16.** Cards·buttons·inputs = 8 (`Radius.sm`); small icon squares & inner controls = 6; tiny badges = 4; pills·avatars·checkbox-circles = 999; bottom-sheet top corners = 16. Do not invent radii.
- Section header = a **10×10 solid `btn`-colored square** + 16px/800 title (+ optional underlined `acc` link on the end side).

## The Dar palette + Cairo typeface (supersedes IBM Plex Sans Arabic)
- `src/constants/theme.ts` stays the single token source; its VALUES now carry the Dar identity in BOTH themes. The token→role mapping is recorded in `docs/claude-reports/2026-07-20-milestone-6-dar.md`. New roles added as keys: `band`/`bandInk` (header band), `goldFill`/`goldInk` (gold), `sunken` and the tint pairs.
- **One typeface: Cairo** (weights 400/600/700/800/900), the single app family for Arabic AND Latin. IBM Plex Sans Arabic is fully retired (package + assets removed). Never ship a second font family.
- **AA token pairings are law** — use the fixed text-on-fill pairs exactly, in both themes, never remix: `btn`+`btnInk` · `band`+`bandInk` · `goldFill`+`goldInk` · an `err` fill → `bg`-colored text. Tint fills (`tok`/`twarn`/`terr`/`tacc`) pair with their matching stroke color (`ok`/`warn`/`err`/`acc`) or `ink` text. The palette is AA-verified — do not derive new colors or re-pair.

## Body ≥16 (tightens, does not replace, the 14 floor)
Running/body text is **≥16px** for older readers. **14–15px is allowed only for short meta labels, and only at ≥600 weight** — never a paragraph. This sits on top of the still-binding 14 absolute floor: nothing renders below 14, body is 16, Arabic line-heights ≥1.5× (1.6–1.7 in disclaimers). Big numeric values (times in tiles, BP inputs) render LTR: value 26/900 centered for inputs, up to 46/900 for hero counts.

## Gold is reserved for exactly two things
The gold tokens (`goldFill`/`goldInk`) appear ONLY on: (1) the **«متاح للتكفّل» / available-to-claim** surfaces, and (2) **one-time / irreversible warnings** (e.g. an invite code shown once, the unread-count badge floating on the band). Nowhere else. Caution/warning uses `warn`/`twarn` (amber), success uses `ok`/`tok` (green), accent/info uses `acc`/`tacc` (green). This retargets the M5 "gold = celebratory + empty-state" rule: in Dar, empty/celebration is a calm green `tok`+`ok` check, not gold.

## Both themes are first-class; RTL is the layout
- Every screen exists in **light AND dark** — identical layout, only token values swap. Never a light-only or dark-only screen.
- **RTL always** (I18nManager forceRTL). Text aligns to the start; **forward chevrons point LEFT, back chevrons point RIGHT.** Use start/end style props so layout mirrors automatically. Reuse the existing `LtrText`/`isolateLtr` helpers — do NOT add a second bidi mechanism.
- **Numeric strings render LTR inside RTL text** — times («6:00 م»), dates (2026-07-19), values (128/82), phones (+966…), codes (SND-7K4M). Each `dir="ltr"` span in the HTML maps to an LTR-isolated `Text`.
- **Status is never color-only** — always icon + Arabic text label, in both themes. Status pill = 1.5px stroke, radius 4–6 or 999, tint fill, 14/700 label with icon.
- **Emergency red (`err`) is restrained** — bordered tints and small filled call buttons, never full-red screens or alarm styling (consistent with the calm-danger law above).
- **Non-diagnostic disclaimers stay verbatim** — vitals, daily logs, and the emergency card keep «للحفظ والمتابعة فقط، ليست تشخيصًا» (and the emergency shield note) exactly as designed.

## App shell
3-tab bottom bar, RTL order with **الرئيسية (Home) FIRST from the right**: الرئيسية · استكشاف · الحساب. Active tab = solid `btn` fill + `btnInk` icon/label (800); inactive = `mut` on `card`; 2px top border; 2px dividers between tabs. Header band has three variants: **tab screen** (band, 24/800 title + optional 16px subtitle at 85%), **sub-screen** (44×44 bordered back square at start, centered 20/800 title, 44×44 filled action square or spacer at end), **form screen** (back square + 20/800 title + 14px subtitle).

## Scope: visual identity only
Milestone 6 changes **look**, never behavior. No routing, data, query, permission, or feature changes. Every user-facing string stays in i18next in BOTH locales at parity — never hardcode Arabic in a component even though the HTML shows it inline. Where the HTML's Arabic improves on a current string, update the i18n VALUE (ar + en), never inline it. Two design corrections apply over the mockups: (1) render the **neutral** responsible-person form (person icon + name, never a gendered «المسؤول/المسؤولة» word — the app stores no gender); (2) use the bare example as a ghost placeholder («ميتفورمين»), not a «مثال: …» prefix. Zero new native dependencies except the Cairo font package (fonts are assets).
