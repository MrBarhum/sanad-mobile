@AGENTS.md

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
`src/constants/theme.ts` is the **single** source of design tokens — color (`Colors.light/dark` via `useTheme()`), the type scale (`Type` / `FontSize`), `Spacing`, `Radius`, `ChipSize`, `IconSize`, `CardShadow`, `TouchTarget`, `Gutter`, and the `withAlpha()` helper. The parallel `figma-tokens.ts` / `form-typography.ts` (Cairo) system is **deleted** — do not reintroduce a second token or font layer. One typeface: **IBM Plex Sans Arabic** (`FontFamily`), bundled as font assets; there is no Cairo. New UI reads tokens via `useTheme()` + the `theme.ts` exports; never hardcode a hex/size that a token already covers.

## Type floor = 14 (P1-8)
14 is the **absolute** floor for any text a caregiver reads — nothing below 14 anywhere (body 16, Arabic line-heights ≥1.5×). Prefer spreading a `Type.*` preset over hand-setting fontSize/lineHeight/fontFamily. The only sanctioned sub-14 uses are pure decorative chrome that is NOT content (a superscript count badge, a «·» meta separator).

## Danger tone is calm + restrained
Emergency / destructive UI uses a **restrained** danger tone + an icon — visible, never alarming (no harsh alarm-red). Danger text → `errorFg`; a solid danger fill → `dangerSolid` (the softer `#C45050`, not a bright alert red) with `onError`. The warm **gold accent** (`accentSolid` / `accentFg`) is reserved for **celebratory + empty-state** moments only; caution/warning uses the dedicated **amber** `warningFg`, never the gold. Status is never color-only — always icon + text.

## Care is not a game (no gamification)
No streaks, scores, points, leaderboards, or competitive mechanics — anywhere. Completion is acknowledged with a **quiet** moment of care (e.g. a gentle «اليوم اكتمل» on the dose ring), never a reward mechanic. Motion is subtle and short, and respects the OS reduced-motion setting.

## The card ruling — one Surface, border both themes
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
