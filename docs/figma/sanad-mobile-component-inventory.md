# Sanad Mobile — Component Inventory & Design System

Part of the **Sanad Figma handoff package**. This document is the authoritative catalog of every UI component, the full design-token set, the icon vocabulary, and the spec for the signature **Today Care Ring**. It is written so a human product designer and Figma AI can build a component library that maps 1:1 to the shipped React Native primitives — implementation should be a *translation*, not a redesign.

**Sibling docs (cross-referenced, not duplicated here):**
- `sanad-mobile-figma-design-brief.md` — product, users, principles, IA summary, mobile frames, home direction, visual system.
- `sanad-mobile-screen-inventory.md` — every screen, interaction inventory, Figma frame set, data states.
- `sanad-mobile-figma-ai-master-prompt.md` — the single paste-ready Figma / Figma Make prompt.
- `sanad-mobile-design-acceptance-criteria.md` — how a future implementer safely builds the approved Figma design.
- `../claude-reports/2026-06-16-figma-handoff-package.md` — run report (written by the orchestrator).

---

## A. Overview

### A.1 The 1:1 mapping rule

Every Figma component in the Sanad library **must mirror an existing React Native primitive** under `src/components/` (and a handful of reusable feature components under `src/features/`). The token names, prop names, variant axes, and accessibility behaviors below are taken verbatim from the codebase. The intent is explicit:

> **A designer changes the Figma component; an engineer changes the matching `.tsx`; nothing new is invented at implementation time.** If a Figma variant has no matching prop, it cannot ship without a code change — so propose it as **NEW/proposed** and flag it here, never silently.

Where this document marks something **NEW (proposed)** — `TodayHero`, `CareRecipientCard`, `FeatureTile` — it is a *composition* the home redesign needs but which is not yet a standalone primitive in `src/components/`. These are described as compositions of existing primitives plus the new structure they add, so engineering can implement them as thin new components without re-deriving the system.

### A.2 How the system maps to React Native primitives

| Layer | Where it lives | Figma equivalent |
|---|---|---|
| **Tokens** | `src/constants/theme.ts` (`Colors`, `Spacing`, `Radius`, `IconSize`, `TouchTarget`, `Gutter`, `FontFamily`, `CardShadow`, `MaxContentWidth`, `MaxFormWidth`) | Figma variables/tokens (color, number, string) — see §C |
| **Icon vocabulary** | `src/constants/icons.ts` (semantic name → vector glyph) + the single `src/components/icon.tsx` | Figma icon set, one component with a `name` variant — see §C.7 |
| **Glyph fallback** | `src/constants/glyphs.ts` (ASCII-safe code-point constants, letterform avatars) | Figma text/letterform layers; never decorative Unicode in source |
| **Primitives** | `src/components/*.tsx` | The component catalog — see §B |
| **Signature element** | `src/features/care-circle/today-care-ring.tsx` | The Today Care Ring component — see §D |
| **Feature cards** | `src/features/{tasks,appointments,daily-logs,vitals,visits}/…-card.tsx` | Five dashboard cards, all thin wrappers over `DashboardTile` |

### A.3 Component count

The shared library at `src/components/` exports **39 distinct components** across **30 source modules** (ignoring 4 `*.web.tsx` platform variants). If you count only the canonical top-level component per module and exclude in-file siblings/aliases (`Card`, `Section`, `WheelColumn`, `StickyFormActions`, `AnimatedSplashOverlay`), the figure is **34**.

Plus **8 reusable feature components** outside `src/components/`: `TodayCareRing`, `TasksCard`, `AppointmentsCard`, `DailyLogsCard`, `VitalsCard`, `VisitsCard`, `NotificationBell`, `PushStatusCard`.

For the Figma library, build **~30 base components** (one per module) and **3 proposed compositions** (`TodayHero`, `CareRecipientCard`, `FeatureTile`). The rest are variants/states on those base components.

### A.4 Standing constraints every component must encode

- **Arabic-first RTL** is the default frame direction. Build every component as a Figma variant set with an **LTR/RTL** axis (or at minimum design RTL-first and verify the mirror). Directional icons mirror; LTR runs (phone, time, code, email, dose strength) are bidi-isolated.
- **Older-adult accessibility:** touch targets ≥ 48 dp (primary ≥ 56 dp), ≥ 8 dp apart; body text ≥ 17 sp where possible, never below 14 sp; contrast ≥ 4.5:1 (≥ 3:1 large); **status is always icon + text + color, never color-only.**
- **Medical safety:** no component interprets, judges, or color-codes health. Vitals/doses render value + unit + optional neutral trend only.
- **Dark mode is a full peer** (not pure black). Every component has a Light and Dark variant. Light separates surfaces by whisper-soft shadow; Dark by lifted background + hairline border, never shadow.

---

## B. Component catalog

Legend: **Props** lists real prop names with their literal union values where the codebase exposes them. **Figma variants** enumerates the variant axes a designer must build. Every component implicitly carries a **Theme = Light / Dark** axis and a **Direction = LTR / RTL** axis unless noted; these are omitted from each row only to avoid repetition — *they always exist.*

---

### B.1 Primitives & layout

#### Screen — `src/components/screen.tsx`
- **Purpose:** The canonical responsive screen container. A full-width ScrollView (or static View) wrapping a single centered max-width column; fixes an app-wide edge-clipping bug. Every screen uses this — designers should never hand-roll screen padding.
- **Props:** `children`; `scroll?: boolean` (def `true`); `maxWidth?: number` (def `MaxContentWidth` = 720; forms pass `MaxFormWidth` = 480); `gutter?: number` (def `Gutter` = 20); `gap?: number` (def `Spacing.three` = 16); `edges?: {top?: boolean; bottom?: boolean}` (def `{top:false, bottom:true}`); `contentBottomInset?: number`; `footer?: ReactNode` (sticky, outside scroll); `header?: ReactNode` (fixed, above scroll — rare; prefer native headers); `center?: boolean`; `keyboardAvoiding?: boolean`; `refreshControl?`; `contentContainerStyle`, `style`, `testID`.
- **Visual guidance:** Background = `background` token (`ThemedView`). Horizontal padding = `Gutter` (20; brief recommends 24 — flag in `sanad-mobile-figma-design-brief.md`). `padTop = (edges.top ? safeAreaTop : 0) + Spacing.four`; `padBottom = (edges.bottom ? safeAreaBottom : 0) + Spacing.five + contentBottomInset`. **Tab screens (no native header) must set `edges={{top:true}}`.**
- **Figma variants:** Scroll (scrollable / static-centered); Max-width (Content 720 / Form 480); With-footer (none / sticky footer). Build a frame template at S24 Ultra (~1440×3120 @ design scale; 360–412 dp logical) with safe-area + Android nav-bar guides.
- **Accessibility:** RTL-agnostic (symmetric `paddingHorizontal`, no directional padding); `keyboardShouldPersistTaps="handled"`; pull-to-refresh in scroll mode only.

#### ThemedView — `src/components/themed-view.tsx`
- **Purpose:** A `View` whose background follows a theme token.
- **Props:** extends `ViewProps`; `lightColor?`, `darkColor?`; `type?: ThemeColor` (def `background`).
- **Figma variants:** Tone = any `ThemeColor`. In practice build as a background-color variable binding, not a separate component.

#### ThemedText — `src/components/themed-text.tsx`
- **Purpose:** Themed `Text` carrying the app type scale.
- **Props:** extends `TextProps`; `type?` (def `default`); `themeColor?: ThemeColor`.
- **`type` union:** `default | display | eyebrow | title | small | smallBold | subtitle | sectionTitle | cardTitle | link | linkPrimary | code`. (`display` is additive/unused; `eyebrow` is a Latin-only overline.)
- **Visual guidance:** see the type scale in §C.2. `link`/`linkPrimary` default to `primaryText` color.
- **Figma variants:** Type-style (the full union above) — implement as Figma text styles bound to this component, not as 12 separate components. Color = `themeColor` token.
- **Accessibility:** caller passes `accessibilityRole` (`header` for titles). Smallest meaningful text is 14 sp.

#### Surface (+ aliases Card, Section) — `src/components/surface.tsx`
- **Purpose:** The one card/panel primitive; optionally pressable. `Card` = default Surface alias. `Section` = a titled group (header + children).
- **Surface props:** `children?`; `tone?: SurfaceTone` (def `card`); `padded?: boolean` (def `true`); `bordered?: boolean` (def `true`); `radius?: number` (def `Radius.card` = 20); `onPress?`; `accessibilityLabel?`, `accessibilityHint?`; `selected?: boolean`; `disabled?: boolean`; `style`, `testID`.
- **`SurfaceTone` union:** `card | sunken | selected | primary | accent | success | warning | error | info`.
- **Section props:** `title?: string`; `action?: ReactNode`; `children`; `gap?: number`; `style`.
- **Visual guidance:** radius `card` (20); padding `Spacing.three` (16) when `padded`. **Light mode:** `CardShadow` (whisper-soft, 0 3 10, opacity 0.06). **Dark mode:** NO shadow — separate by `backgroundElement` lift + hairline `border`. Tones map to the soft `*Bg` tokens (`successBg`, `warningBg`, etc.) with matching `*Fg` text; `sunken` = `backgroundSunken`; `selected` = `backgroundSelected`.
- **Figma variants:** Tone (9 values above); Padded (true/false); Bordered (true/false); Interactive (static / pressable → adds Pressed + Disabled + Selected states); Radius (sm 8 / md 12 / lg 16 / card 20 / xl 24). Section variant adds Title-present / Title-absent and With-action.
- **Accessibility:** when `onPress` set → `accessibilityRole="button"`, `accessibilityState={{disabled, selected}}`, Android ripple, pressed opacity dip. `Section` title is `accessibilityRole="header"`. **Never nest a Surface inside a Surface** (no card-in-card).

---

### B.2 Buttons & actions

#### Button — `src/components/button.tsx`
- **Purpose:** The single labeled button primitive across all care screens. Name by what happens ("احفظ"/Save), and keep the name consistent through the flow.
- **Props:** `label: string`; `onPress`; `variant?: ButtonVariant` (def `primary`); `size?: ButtonSize` (def `md`); `iconName?: IconName` (leading, decorative); `glyph?: string` (legacy leading glyph — avoid in new work); `loading?: boolean`; `disabled?: boolean`; `style`; `accessibilityHint?`, `accessibilityLabel?`.
- **`ButtonVariant` union:** `primary | secondary | danger | plain`. **`ButtonSize` union:** `md | sm`.
- **Visual guidance:** `primary` = `primary` fill + `onPrimary` text, pressed → `primaryPressed`. `secondary` = `backgroundSelected`/quiet fill + `text`. `danger` = soft `errorBg` fill + strong `errorFg` text (deliberately distinct from save — not a loud red fill). `plain` = text-only. Size `md` → height ≥ `TouchTarget.comfortable` (52; primary actions ≥ 56); `sm` → height ≥ `TouchTarget.min` (48). Radius `md`/`pill` per usage; pill for chip-like CTAs.
- **Figma variants:** Variant (`primary` / `secondary` / `danger` / `plain`); Size (`md` / `sm`); State (Default / Pressed / Disabled / Loading); Icon (none / leading iconName). Loading shows a centered spinner and disables.
- **Accessibility:** `accessibilityRole="button"`; label fallback `accessibilityLabel ?? label`; `accessibilityState={{disabled: isDisabled, busy: loading}}`. Leading glyph/icon hidden from a11y. Meets touch-target floor. **Primary actions must be a labeled Button, never icon-only.**

#### IconButton — `src/components/icon-button.tsx`
- **Purpose:** Square, accessible, icon-only button — **SECONDARY actions only** (close, small toggles). Primary actions must use the labeled `Button`.
- **Props:** `iconName?: IconName`; `icon?: string` (legacy glyph); `accessibilityLabel: string` (**REQUIRED**); `onPress`; `accessibilityHint?`; `color?: ThemeColor` (def `text`); `filled?: boolean` (def `true`); `disabled?: boolean`; `style`.
- **Visual guidance:** `minWidth/minHeight = TouchTarget.min` (48); `hitSlop = 8`; filled background uses a quiet surface tone.
- **Figma variants:** Filled (true/false); State (Default / Pressed / Disabled); Color token.
- **Accessibility:** `accessibilityRole="button"`; required `accessibilityLabel` (icon-only); `accessibilityState={{disabled}}`.

#### ItemActions — `src/components/item-actions.tsx`
- **Purpose:** Edit + Delete row actions with an **inline two-step delete confirm** (no system `Alert.alert`, web-safe). The single approved delete affordance.
- **Props:** `onEdit`; `onDelete`; `deleting?: boolean`; `disabled?: boolean`; `labels: {edit; delete; confirm; cancel}` (all strings).
- **Visual guidance:** uses Button `sm` `secondary` (edit) / `danger` (delete). Confirm state swaps Edit+Delete for **Confirm (danger)** + **Cancel (secondary)**.
- **Figma variants:** State (Resting → shows Edit + Delete / Confirming → shows Confirm + Cancel); Deleting (loading on Confirm, Cancel disabled).
- **Accessibility:** inherits Button a11y. **Destructive: delete requires an explicit second tap** (error-tolerance rule).

#### FormActions & StickyFormActions — `src/components/form-actions.tsx`
- **Purpose:** Inline (`FormActions`) or sticky-bottom (`StickyFormActions`) save area: primary save + optional non-destructive secondary + an inline saved/error status line. **Destructive actions are deliberately excluded here** (save is never mixed with delete).
- **Props:** `saveLabel: string`; `onSave`; `saving?: boolean`; `disabled?: boolean`; `status?: FormActionsStatus`; `savedLabel?`, `errorLabel?`; `secondaryLabel?`, `onSecondary?`; `saveAccessibilityHint?`. `FormActions` adds `style?`.
- **`FormActionsStatus` union:** `idle | saved | error`.
- **Visual guidance:** Save = primary Button. Status line above the button: `saved` in `successFg`, `error` in `errorFg`. `StickyFormActions` respects bottom safe-area inset + a top `divider`, caps at `MaxFormWidth`, sits within thumb reach.
- **Figma variants:** Layout (Inline / Sticky); Status (idle / saved / error); Saving (loading on save); With-secondary (true/false); Save-disabled (true/false).
- **Accessibility:** status line `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`; save shows `loading={saving}`; secondary disabled while saving.

---

### B.3 Status / identity / informational

#### StatusBadge — `src/components/status-badge.tsx`
- **Purpose:** A pill badge for a status (dose "given", task "done", appointment "scheduled"): tinted background + tone icon + text label.
- **Props:** `tone: StatusTone`; `label: string`; `iconName?: IconName` (override); `glyph?: string` (legacy); `style?`.
- **`StatusTone` union:** `success | warning | error | info | neutral`. Default icon per tone: success→`success`, warning→`warning`, error→`error`, info→`info`, neutral→`dot`.
- **Visual guidance:** background = `*Bg` token, foreground (icon + text) = `*Fg` token; neutral uses quiet surface. Pill radius. Used by every domain's status (medications given/postponed/missed; tasks open/completed/cancelled; appointments scheduled/completed/cancelled; visits planned/completed/cancelled; invitations pending/accepted/revoked/expired; member roles/ownership).
- **Figma variants:** Tone (`success` / `warning` / `error` / `info` / `neutral`).
- **Accessibility:** `accessibilityRole="text"`. **NEVER color-only** — a distinct shape icon per tone + an always-present text label. This is the canonical example of the status-pattern rule.

#### GlyphChip — `src/components/glyph-chip.tsx`
- **Purpose:** Identity anchor — a soft tinted circle holding a vector icon OR a letterform (used as avatars, e.g. an Arabic initial "د").
- **Props:** `iconName?: IconName`; `glyph?: string` (letterform/avatar); `tone?: GlyphChipTone` (def `primary`); `size?: GlyphChipSize` (def `md`); `accessibilityLabel?`; `style?`.
- **`GlyphChipTone` union:** `primary | accent | neutral | success | warning | error | info`. **`GlyphChipSize` union:** `sm | md | lg` → diameters **36 / 44 / 64**, glyph sizes **16 / 20 / 28** (matching `IconSize` sm/md/lg).
- **Visual guidance:** circular (pill radius); tinted background = tone `*Bg`, icon = tone `*Fg`.
- **Figma variants:** Tone (7); Size (sm 36 / md 44 / lg 64); Content (icon / letterform).
- **Accessibility:** decorative by default (`accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`) unless `accessibilityLabel` is given.

#### InfoBanner — `src/components/info-banner.tsx`
- **Purpose:** A contained tinted notice row (chip + message + optional action line). Replaces floating gray disclaimer paragraphs — used for medical-safety disclaimers, reminder notices, trust/security warnings.
- **Props:** `text: string`; `actionText?: string`; `tone?: 'info' | 'warning' | 'neutral' | 'accent'` (def `info`); `onPress?`; `accessibilityLabel?`.
- **Visual guidance:** `neutral` renders on a `sunken` surface; others on the tone surface (`infoBg`/`warningBg`/`accentBg`). Icon per tone (warning→`warning`, else `info`). Action line appends a `chevron`.
- **Figma variants:** Tone (`info` / `warning` / `neutral` / `accent`); With-action (true/false); Pressable (true/false → adds Pressed).
- **Accessibility:** if `onPress`, the whole banner is a Surface button (inherits Surface a11y).

#### HintRow — `src/components/hint-row.tsx`
- **Purpose:** Demo/scaffold row (label + inline code box). **Expo-template leftover** — defaults `'Try editing'` / `'app/index.tsx'`. **Not a care-domain component.**
- **Props:** `title?: string` (def `'Try editing'`); `hint?: ReactNode` (def `'app/index.tsx'`).
- **Figma guidance:** Include only as a "deprecated / do-not-use" entry in the library so it isn't reinvented. No care variants.

#### LtrText (+ `isolateLtr`) — `src/components/ltr-text.tsx`
- **Purpose:** Force a value to render LTR and bidi-isolate it inside the RTL UI — for phone numbers, emails, IANA timezone ids, invitation codes, times, dose strengths ("500 mg"), and English medication names. Load-bearing for RTL correctness.
- **Props:** extends `ThemedTextProps`; `children`, `style`, `...rest`. Helper `isolateLtr(value: string): string` wraps a string in U+2066 (LRI) … U+2069 (PDI), built via `String.fromCodePoint` so no invisible chars live in source.
- **Visual guidance:** sets `writingDirection: 'ltr'`; alignment inherits (start = right in RTL), so the value still sits at the start of its container. **Do not force a whole container LTR to fix one number.**
- **Figma variants:** none structural — this is a behavior. In Figma, model it as a "LTR-isolated value" text style used wherever a number/code/phone appears inside Arabic. Always shown with Western Arabic digits (0–9).
- **Accessibility:** inherits ThemedText; values are often `selectable`.

---

### B.4 Navigation / dashboard cards

#### NavCard — `src/components/nav-card.tsx`
- **Purpose:** A full-width dashboard/navigation card: identity chip + title + live subtitle + trailing chevron. Used for "go to a section" rows that need a description (e.g. Account → Members, Account → Notification settings).
- **Props:** `iconName?: IconName`; `glyph?: string`; `glyphTone?: GlyphChipTone` (def `primary`); `title: string`; `subtitle?: string`; `onPress`; `tone?: SurfaceTone` (def `card`); `titleColor?: 'text' | 'errorFg'` (def `text`); `accessibilityLabel?`, `accessibilityHint?`.
- **Visual guidance:** built on Surface button; `minHeight: 88`; chip (GlyphChip) at start, chevron at end (mirrors in RTL). `tone="error"` + `titleColor="errorFg"` for emergency rows.
- **Figma variants:** Tone (SurfaceTone, esp. `card` / `error`); Title-color (`text` / `errorFg`); State (Default / Pressed); With-subtitle (true/false).
- **Accessibility:** `accessibilityLabel ?? title`; chevron mirrors via `<Icon name="chevron">`; ≥ 88 dp tall (comfortable target).

#### DashboardTile — `src/components/dashboard-tile.tsx` *(new/untracked file in working tree)*
- **Purpose:** Compact tappable tile for 2-column grids (`width: 48%`): chip + chevron on top, then title + one meta line. The shared tile language for the (rejected) dense home and the five feature cards.
- **Props:** `iconName: IconName`; `title: string`; `meta: string`; `onPress`; `tone?: GlyphChipTone` (def `primary`); `surfaceTone?: SurfaceTone` (def `card`); `titleColor?: ThemeColor` (def `text`); `accessibilityHint?`.
- **Visual guidance:** `width: 48%`, `minHeight: 116`, `padding: Spacing.three`, `gap: Spacing.three`, `justifyContent: space-between`. Top row: GlyphChip (sm, 36 dp) at start + chevron (`textMuted`) at end. Title `cardTitle` (`numberOfLines: 1`), meta `small`/`textSecondary` (`numberOfLines: 2`). `surfaceTone="error"` + `titleColor="errorFg"` for the emergency tile.
- **Figma variants:** Chip-tone (GlyphChipTone); Surface-tone (`card` / `error`); Title-color; State (Default / Pressed).
- **Accessibility:** Surface button; `accessibilityLabel = `${title}. ${meta}`` read as one node; chip + chevron decorative.
- **⚠ Design caution:** This tile is the root cause of the **rejected** home (a wall of ~15 identical 48%/116-dp boxes). In the approved home it should be **demoted to a small, quiet secondary set**, not stacked in three grids. See the home direction in `sanad-mobile-figma-design-brief.md` and the rejection rationale in `sanad-mobile-screen-inventory.md`. Keep `DashboardTile` for *quiet secondary navigation only*; the hero and care-recipient context must NOT be DashboardTiles.

#### FeatureTile — **NEW (proposed)** composition over DashboardTile
- **Purpose:** The approved-home replacement for the "wall of tiles": a *small, quiet* secondary feature entry. Visually lighter than `DashboardTile` (no loud chip fill, generous spacing) so feature navigation reads as demoted, not as a command grid.
- **Proposed props:** same shape as `DashboardTile` (`iconName`, `title`, optional one-line `meta`, `onPress`) but a `quiet` visual treatment: smaller chip, no per-tile metrics strings, `numberOfLines: 1` meta.
- **Visual guidance:** prefer a single-column or max 2-column quiet list; use `card` surface with hairline border, `textSecondary` meta, `primary`/`neutral` chip tone. Avoid bulleted count metrics ("Today: x • Total: y") that made the old tiles read as a report.
- **Figma variants:** Layout (single-column row / 2-up tile); With-meta (true/false); State (Default / Pressed). Theme + Direction as always.
- **Accessibility:** same as DashboardTile (single button node, `title. meta`, decorative chevron). **Mark clearly as proposed** — it requires a new thin component in `src/components/`.

#### ContactCard — `src/components/contact-card.tsx`
- **Purpose:** A scannable doctor / emergency-contact card: avatar + name + qualifier + detail lines + a **one-tap call row** + an optional actions slot. Used in doctors, emergency contacts, and the emergency card.
- **Props:** `name: string`; `subtitle?: string | null`; `details?: (string | null | undefined)[]`; `phone?: string | null`; `callLabel?: string`; `notes?: string | null`; `children?: ReactNode` (actions slot, e.g. ItemActions).
- **Visual guidance:** header row = GlyphChip avatar via `initialFor(name)` + name (`cardTitle`) + subtitle (`smallBold`, `primaryText`). Detail/notes in `textSecondary`. **Call row** (only when `phone` present): centered, `backgroundColor: primaryBg`, `minHeight: TouchTarget.comfortable` (52), `<Icon name="call" size 20 color primaryText>` + phone via `LtrText` (18/700, `selectable`). Actions slot separated by a hairline top divider.
- **Figma variants:** With-call-row (true/false — a doctor's phone is optional, a contact's is required); With-actions (true/false); With-subtitle / With-details / With-notes (presence toggles); Primary-badge (for emergency contacts, an inline `StatusBadge tone="info"` "رئيسية").
- **Accessibility:** call row `accessibilityRole="button"`, `accessibilityLabel = callLabel ?? phone` (e.g. "اتصال {name}"); opens `tel:` (sanitized to `[\d+]`), fails quietly on tablets/emulators — **no confirmation dialog, no "guaranteed response" wording.** Phone is LTR-isolated and selectable.

---

### B.5 Empty / loading / error states

#### LoadingState — `src/components/states.tsx`
- **Purpose:** Full-area centered spinner.
- **Props:** `label?: string`.
- **Visual guidance:** `ActivityIndicator` (`primary`, `large`), centered; optional label below.
- **Figma variants:** With-label (true/false).
- **Accessibility:** optional label `accessibilityRole="text"`.

#### ErrorState — `src/components/states.tsx`
- **Purpose:** Full-area centered error + retry. Used for every "could not load …" failure.
- **Props:** `message: string`; `retryLabel: string`; `onRetry`.
- **Visual guidance:** `GlyphChip iconName="warning" tone="error" size="lg"` (64 dp) above the message; retry is a `Button variant="secondary"`. Copy is specific and non-apologetic ("تعذّر تحميل …").
- **Figma variants:** none beyond Theme/Direction.
- **Accessibility:** message `accessibilityRole="alert"`.

#### EmptyState — `src/components/states.tsx`
- **Purpose:** Centered empty-state card that instructs and invites action (never a blank, never a mood).
- **Props:** `title: string`; `subtitle?: string`; `icon?: string` (legacy glyph); `iconName?: IconName` (preferred).
- **Visual guidance:** a `Surface` containing a chip (`tone="neutral" size="lg"`) above centered title + subtitle. Subtitle (the "add the first …" invitation) is often shown only to users who can act.
- **Figma variants:** With-icon (true/false); With-subtitle (true/false).
- **Accessibility:** title/subtitle are plain text; pair with the screen's primary "Add" CTA where relevant.

---

### B.6 Forms & inputs

#### FormField — `src/components/form-field.tsx`
- **Purpose:** A labeled themed text input with a focus ring and inline error. The base text input across every form.
- **Props:** extends `TextInputProps`; `label?: string`; `error?: string | null`; `multiline?`; `onFocus`, `onBlur`, `style`, `...rest` (keyboardType, autoCapitalize, secureTextEntry, etc.).
- **Visual guidance:** **label ABOVE the input** (always). `minHeight: TouchTarget.comfortable` (52); `multiline` → 112 min-height, top-aligned. Focus ring = brand `primary` border (2 dp); error border = `errorFg`. **No hardcoded `textAlign`** — direction follows RTL so Arabic aligns to start automatically; LTR fields (email, phone) still receive `keyboardType`.
- **Figma variants:** State (Default / Focused / Error / Disabled); Multiline (single / multiline); With-value / Empty (placeholder). Theme + Direction.
- **Accessibility:** `accessibilityLabel = label`; error text `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`.

#### FormModal — `src/components/form-modal.tsx`
- **Purpose:** A bottom-sheet modal hosting an add/edit form (chrome only; the caller owns fields + validation). Used for add/edit doctor and add/edit emergency contact, and the schedule modal host.
- **Props:** `visible: boolean`; `title: string`; `submitLabel`, `cancelLabel`, `closeLabel: string`; `submitting?: boolean`; `submitDisabled?: boolean`; `error?: string | null`; `onSubmit`; `onClose`; `children`.
- **Visual guidance:** bottom sheet, rounded top corners (`card`/`xl` radius), decorative grabber, caps at `MaxFormWidth`, honors bottom safe-area inset; `KeyboardAvoidingView` (iOS padding). **No backdrop-tap dismiss** (explicit Close / Cancel only — avoids losing input).
- **Figma variants:** State (Default / Submitting → loading on submit, Cancel disabled); Submit-disabled (true/false); With-error (true/false).
- **Accessibility:** title `accessibilityRole="header"`; close button `accessibilityRole="button"` + `accessibilityLabel={closeLabel}` (glyph `close`), meets touch floor; error line alert + polite.

#### OptionSelect — `src/components/option-select.tsx`
- **Purpose:** A labeled single-choice segmented chip group (category / priority / type / unit / role / mood enums). Generic `<T extends string>`.
- **Props:** `label?: string`; `value: T`; `options: readonly SelectOption<T>[]` (`{value:T; label:string}`); `onChange: (value:T)=>void`; `disabled?: boolean`.
- **Visual guidance:** chips wrap; `minHeight: TouchTarget.min` (48); selected = brand tint (`primaryBg`) + brand border + **leading `check` icon** + bold (never color-only). 1.5 dp border for affordance. Deliberately NOT the Button `secondary` variant.
- **Figma variants:** Chip-state (Default / Selected / Disabled); group wrapping. Theme + Direction (chips lay out start→end, RTL-mirrored).
- **Accessibility:** each chip `accessibilityRole="radio"`, `accessibilityState={{selected, disabled}}`, `accessibilityLabel = option.label`.

#### WeekdaySelector (+ internal Chip) — `src/components/weekday-selector.tsx`
- **Purpose:** Explicit opt-in multi-select for weekdays + an "Every day" select-all/clear. Days **0=Sun … 6=Sat** (DB convention). Used in medication dose schedules; its behavior was specifically fixed — protect it.
- **Props:** `value: number[]`; `onChange: (next:number[])=>void`; `dayLabels: readonly string[]`; `accessibilityDayLabels?: readonly string[]`; `everyDayLabel: string`; `label?: string`; `error?: string`.
- **Visual guidance:** day chips (short Arabic names أحد/إثنين/…); selected = tint + border + `check` icon + bold weight; ≥ 48 dp targets. "Every day" toggles all/none.
- **Figma variants:** Day-chip (Default / Selected); Every-day (Default / Active); Error (none / shown).
- **Accessibility:** each day chip `accessibilityRole="checkbox"` + `accessibilityState={{checked}}`; full weekday name as `accessibilityLabel`; error `accessibilityRole="alert"`.

---

### B.7 Date / time / pickers

> **Protect the picker fix.** Android date/time pickers previously rendered as blank surfaces; that was fixed. Do not swap the implementation. All four are touch-wheel (no manual typing) on native; web uses native `<input type=date|time>`. Western Arabic digits, LTR-isolated, throughout.

#### DateField — `src/components/date-field.tsx` (+ `date-field.web.tsx`)
- **Purpose:** A labeled date trigger opening a year/month/day wheel; emits `'YYYY-MM-DD'` or `''`.
- **Props (`DateFieldProps`):** `label?`; `value: string`; `onChange: (v:string)=>void`; `error?: string|null`; `placeholder?`; `disabled?` (def `false`); `clearable?` (def `false`); `accessibilityLabel?`.
- **Visual guidance:** trigger looks like a FormField (label above, value/placeholder, trailing chevron). Year range `thisYear-120 … thisYear+5` (suits elderly birth dates); day clamps to month length (leap-aware). Commits only on Done.
- **Figma variants:** State (Default / Filled / Error / Disabled); Clearable (true/false); the wheel sheet itself = PickerSheet.
- **Accessibility:** trigger `accessibilityRole="button"`, `accessibilityLabel ?? label`, `accessibilityState={{disabled}}`; chevron hidden; error alert + polite.

#### TimeField — `src/components/time-field.tsx` (+ `time-field.web.tsx`)
- **Purpose:** A labeled time trigger opening an hour/minute wheel; emits 24-hour `'HH:MM'` or `''`. **No AM/PM.**
- **Props (`TimeFieldProps`):** as DateField plus `minuteStep?: number` (def `1`).
- **Visual guidance:** hours 0–23, minutes honor `minuteStep` (always includes 0). 24-hour, Western digits.
- **Figma variants:** same axes as DateField.
- **Accessibility:** same pattern as DateField.

#### DateTimeField — `src/components/date-time-field.tsx`
- **Purpose:** A Date + Time pair for a single instant (e.g. a vital reading time). Composes platform-aware DateField + TimeField.
- **Props (`DateTimeFieldProps`):** `label?`; `dateValue`, `timeValue`; `onChangeDate`, `onChangeTime`; `dateLabel?`, `timeLabel?`; `dateError?: string|null`, `timeError?: string|null`; `disabled?`.
- **Visual guidance:** flex row, `flexBasis: 160`, wraps on narrow phones. Caller combines parts into an ISO instant at save.
- **Figma variants:** Wrapped (side-by-side / stacked); per-field error states.
- **Accessibility:** inherits DateField/TimeField; two labeled triggers.

#### PickerSheet (+ WheelColumn) — `src/components/picker-sheet.tsx`
- **Purpose:** The bottom-sheet chrome for native date/time pickers; `WheelColumn` is one scrollable numeric column.
- **PickerSheet props:** `visible`, `title`, `doneLabel`, `cancelLabel`, `clearLabel`, `closeLabel?`, `onDone`, `onCancel`, `onClear?` (optional → shows Clear), `children`.
- **WheelColumn props:** `label?`; `values: number[]`; `selected: number`; `onSelect: (v:number)=>void`; `formatValue?`; `accessibilityLabel?`.
- **Visual guidance:** rows = `TouchTarget.min` (48), 5 visible; selected row = `check` + tint + bold. Actions: Done (primary), optional Clear (secondary), Cancel (plain). Honors bottom safe-area inset; the body must be a column (documented Android blank-picker fix). **Backdrop tap = Cancel/discard** (commit only on Done) — note this differs from FormModal/TimezonePicker, which have no backdrop dismiss.
- **Figma variants:** With-clear (true/false); number of WheelColumns (1 time-hour+minute / 3 date-year+month+day); WheelColumn row (Default / Selected).
- **Accessibility:** title `accessibilityRole="header"`; close `accessibilityRole="button"` (label `closeLabel ?? cancelLabel`, glyph `close`); WheelColumn row `accessibilityRole="button"` + `accessibilityState={{selected}}`; auto-scrolls selected into view once.

#### TimezonePicker (+ internal Row) — `src/components/timezone-picker.tsx`
- **Purpose:** A searchable, touch-friendly IANA timezone selector (City, Country + IANA id) with a "use this device" shortcut. Used to set the care-circle timezone.
- **Props:** `visible: boolean`; `currentId: string`; `deviceTz: string`; `onSelect: (id:string)=>void`; `onClose: ()=>void`.
- **Visual guidance:** modal, **no backdrop dismiss** (explicit Close); search `TextInput` (`autoCapitalize="none"`, labeled); rows show localized City/Country + IANA id via `LtrText`; selected = `check` + tint + bold; empty → "لا توجد مناطق زمنية مطابقة".
- **Figma variants:** Row (Default / Selected); Search (empty / typing / no-results).
- **Accessibility:** title header role; close button labeled (`common.close`); rows `accessibilityRole="button"` + `accessibilityState={{selected}}`. Returns only the IANA id; the caller confirms/persists separately (an explicit confirmation step exists in `CircleTimezoneCard`).

---

### B.8 Guards / links / misc

#### UnsavedChangesGuard — `src/components/unsaved-changes-guard.tsx`
- **Purpose:** A drop-in guard for create/edit forms: prompts before leaving (back gesture, header back, hardware back) when there are unsaved edits.
- **Props:** `when: boolean` (renders `null`).
- **Visual guidance:** no visual surface of its own; surfaces a confirm dialog with centralized copy `common.unsavedTitle / unsavedMessage / discardChanges / keepEditing`.
- **Figma variants:** model only the **confirm dialog** it triggers: Title + Message + "Discard changes" (destructive) + "Keep editing" (primary/secondary). Build this as a reusable Confirm-Dialog component for the library.
- **Accessibility:** dialog is system-driven; ensure the "Keep editing" option is the safe default focus.

#### ExternalLink — `src/components/external-link.tsx`
- **Purpose:** Opens external URLs in an in-app browser (native) or `_blank` (web).
- **Props:** `Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string }`.
- **Figma guidance:** styled as `ThemedText type="link"`/`linkPrimary`. No special variants.

#### Collapsible — `src/components/ui/collapsible.tsx`
- **Purpose:** A disclosure section with a rotating chevron (uses `expo-symbols`). Likely Expo-template-derived; use sparingly.
- **Props:** `PropsWithChildren & { title: string }`.
- **Figma variants:** State (Collapsed / Expanded — chevron rotates).
- **Accessibility:** ⚠ **a11y gap in code** — no `accessibilityRole="button"` / `accessibilityState={{expanded}}`. If used in Sanad UI, the Figma spec must require adding these (note for the implementer in `sanad-mobile-design-acceptance-criteria.md`).

#### AnimatedIcon & AnimatedSplashOverlay — `src/components/animated-icon.tsx` (+ `.web.tsx`)
- **Purpose:** Splash/logo animation. `AnimatedSplashOverlay` is the only one mounted at the shell — a full-screen solid `#208AEF` overlay that fades out (~600 ms) after first paint. Uses Expo-template assets; mostly boilerplate.
- **Props:** none.
- **Figma guidance:** model the splash as a single full-bleed brand-blue frame with the Sanad mark, fading to the Home/auth resolution. Respect reduced motion. (Splash color `#208AEF` is hard-coded, NOT a theme token — flag if rebranding.)
- **Accessibility:** decorative only; respect reduced-motion (gentle fade).

#### AppTabs / BottomTabs — `src/components/app-tabs.tsx` (+ `.web.tsx`)
- **Purpose:** The app's bottom tab bar (native `NativeTabs`; web a top-floating custom Tabs).
- **Tabs (order):** `index` → `tabs.home` (الرئيسية), `explore` → `tabs.explore` (استكشاف), `account` → `tabs.account` (الحساب). i18n labels render Arabic.
- **Visual guidance:** `backgroundColor = background`; active indicator = `primaryBg` pill; inactive icon = `textSecondary`; inactive label = `textSecondary`, selected label = `primaryText`. Active state carried by tint + label weight.
- **Figma variants:** Per-tab (Home / Explore / Account); Tab-state (Inactive / Active). Build as a bottom bar component respecting safe-area + Android nav bar; primary actions on screens sit above it within thumb reach.
- **Accessibility:** native tab roles; ⚠ **account tab reuses the home PNG icon as a placeholder** (`TODO` in code) — the Figma set should supply a dedicated Account icon (use the `profile` semantic icon). Flag in `sanad-mobile-screen-inventory.md`.

---

### B.9 Reusable feature components

#### NotificationBell — `src/features/notifications/notification-bell.tsx`
- **Purpose:** A **labeled pill** (deliberately NOT an icon-only bell — clearer for older users) with an unread-count badge; opens `/notifications`. Used in the dashboard header and Account header.
- **Props:** none (reads `useUnreadCount()`).
- **Visual guidance:** `Pressable` → `<Icon name="notification" size 18>` + label "الإشعارات" + conditional badge. Badge shown only when unread > 0: min-width 22, pill, fixed fill `#D92D20` (a hard-coded saturated red, **intentionally NOT a theme token** because `errorFg` is lighter in dark mode and would weaken white text), white text 700, shows count or `99+`. `hitSlop = Spacing.two`, `minHeight: TouchTarget.min`. Pressed → `backgroundSelected`.
- **Figma variants:** Badge (none / count 1–99 / `99+`); State (Default / Pressed).
- **Accessibility:** `accessibilityRole="button"`; label switches `notifications.openCenterWithCount` ("فتح الإشعارات، {count} غير مقروءة") vs `notifications.openCenter` ("فتح الإشعارات").

#### PushStatusCard — `src/features/notifications/push-status-card.tsx`
- **Purpose:** Arabic-first *why* + a single explicit "Enable notifications" control. **Must NOT read like developer diagnostics.** Permission is never auto-requested.
- **Props:** none (reads `usePushRegistration()`).
- **Visual guidance:** header `GlyphChip iconName="system"` (tone `info` when enabled, else `neutral`) + title "ابقَ على اطّلاع بالرعاية" + body + privacy line. Action area (top-bordered) branches: `web-unsupported` / `no-device` → plain explanatory text; `enabled` → `StatusBadge tone="success"` + secondary "إيقافها على هذا الجهاز"; otherwise primary "تفعيل الإشعارات". A result line (live region) explains non-enabled outcomes in user language (never raw token/permission enum/project id).
- **Figma variants:** State (Disabled-can-enable / Enabled / Web-unsupported / No-device); Result-line (none / denied / unsupported / no-device / project-id-missing / error); Working (loading on the button).
- **Accessibility:** result text `accessibilityLiveRegion="polite"`; buttons show `loading={isWorking}`. No diagnostics tone.

#### The five dashboard feature cards
`TasksCard`, `AppointmentsCard`, `DailyLogsCard`, `VitalsCard`, `VisitsCard` — files: `src/features/{tasks,appointments,daily-logs,vitals,visits}/…-card.tsx`. **All are thin wrappers over `DashboardTile`.**
- **Shared shape:** `({ circleId }: { circleId: string })`; each calls a `useToday*Summary(circleId)` hook and builds a `meta` string with the rule: **loading → section subtitle; zero → `*.summary.none`; otherwise → `*.summary.count(s)`**. Renders `<DashboardTile iconName=… title=… meta=… onPress=router.push(route)>`. No empty/error UI of their own.

| Card | iconName | route | none / count copy |
|---|---|---|---|
| **TasksCard** | `task` | `/tasks` | none if `dueToday===0 && completedToday===0`; else `tasks.summary.counts {due, done}` |
| **AppointmentsCard** | `appointment` | `/appointments` | `count===0` → none; else `appointments.summary.count {count}` |
| **DailyLogsCard** | `dailyLog` | `/daily-logs` | `todayCount===0` → none; `latestMood` → `dailyLogs.summary.countsMood {count, mood}`; else `dailyLogs.summary.counts {count}` |
| **VitalsCard** | `vital` | `/vitals` | `totalCount===0` → none; else `vitals.summary.counts {today, total}` |
| **VisitsCard** | `visit` | `/visits` | `count===0` → none; else `visits.summary.count {count}` |

- **Figma variants:** per card → Meta-state (Loading-subtitle / Empty-none / Has-count). Theme + Direction.
- **⚠ Design caution:** the bulleted count metas ("Today's doses: x • Given: y • Remaining: z", "Today: x • Total: y") are exactly what made the rejected home read like a report. In the approved home, **prefer `FeatureTile` (quiet) treatment without dense metric strings**; reserve precise counts for the Today hero and the Today Care Ring. See §D and `sanad-mobile-figma-design-brief.md`.
- **Accessibility:** DashboardTile reads `title. meta` as one node; decorative chevron mirrors in RTL.

---

### B.10 Proposed home compositions (NEW — flag explicitly)

These three are **NOT yet standalone primitives**. They are what the approved Today-first home needs (Option 1 / Option 2 in the brief). Each is a composition of existing primitives plus new structure; engineering implements them as thin new components. **Do not present them as existing — mark NEW/proposed in the Figma library.**

#### TodayHero — **NEW (proposed)**
- **Purpose:** The single confident "what matters now" hero of the home. It carries the **Today Care Ring** (§D) plus the **one strong next-action** (next dose / next thing to do today). It is the *one* place boldness is spent; everything else stays quiet.
- **Proposed composition:** a large `Surface` (radius `card`/`xl`, generous padding ≥ `Spacing.four`) containing: TodayCareRing (left/start) + a next-action block (label `today.nextDoseLabel` "الجرعة القادمة" + medication name + LTR-isolated time in `accentFg`, trailing chevron). Whole card is one pressable → `/medications` (or the relevant next-action route).
- **Visual guidance:** sand accent (`accentBg` / `accentSolid` / `accentFg`) reserved here as the "today/now" signal; brand blue for the primary action. Single-column, full readable width; do NOT make this a 48% tile.
- **States to design:** Loading (ring loading + "جارٍ تحميل جرعات اليوم…"); No-doses-today (`today.loopNone` "لا جرعات مجدولة اليوم"); In-progress (`{given} of {total}`, next dose shown); All-given (`today.loopAllDone` "اكتملت جرعات اليوم", next-dose block shows `today.nextDoseAllGiven`).
- **Figma variants:** Today-state (Loading / Empty / In-progress / Complete); Theme; Direction. Plus the Option 2 alternative (a "now" card atop a vertical day timeline) — design as a sibling variant if pursuing Option 2.
- **Accessibility:** the hero `Surface` carries the spoken `accessibilityLabel` (ring is decorative). Compose: `{loopCardTitle}. {loopA11y}. {nextDoseLabel}: {nextDoseSpoken}`. Target ≥ 56 dp for the action; one clear node.

#### CareRecipientCard — **NEW (proposed)**
- **Purpose:** The calm "who we're caring for today" context at the top of the home — the care recipient's identity (name, optional avatar/initial) and the active care-circle context. Replaces the generic CircleSwitcher-as-first-thing feeling with a warm, person-first anchor.
- **Proposed composition:** a `Surface` with a `GlyphChip` (initial via `initialFor(recipientName)`) + recipient name (`sectionTitle`) + circle context (`small`/`textSecondary`, e.g. circle name or "دائرة الرعاية"); a quiet "switch" affordance **only when the user belongs to >1 circle** (opens the existing CircleSwitcher modal). No fake medical status anywhere.
- **Visual guidance:** warm, identity-led (person, not metrics). `card` surface; chip tone `primary`. Keep it quiet — it sets context, it is not the hero.
- **Figma variants:** Circles (single → non-interactive / multiple → switchable, opens modal); With-avatar / Initial-only; Theme; Direction.
- **Accessibility:** if switchable, `accessibilityRole="button"` + hint = switch label; otherwise non-interactive. Recipient name read first (RTL reading order). No health-status text.

#### FeatureTile — **NEW (proposed)** — see §B.4 above (the quiet demoted secondary nav tile).

---

## C. Design tokens (Figma tokens table)

Single source of truth: `src/constants/theme.ts`. **Figma variable names must mirror these keys and values exactly.** No magic numbers, no hardcoded hex, in any component.

### C.1 Color — Light ("warm porcelain") & Dark ("warm graphite")

Dark is a full peer (not pure black). Build two Figma variable modes (Light / Dark) under one collection; every color token has a value in both.

| Token | Light | Dark | Meaning / usage |
|---|---|---|---|
| `text` | `#1D1B16` | `#F4F2EC` | Primary body/heading text |
| `textSecondary` | `#5C594F` | `#ACA89D` | Secondary text |
| `textMuted` | `#767266` | `#8B877C` | Metadata/timestamps only, never body |
| `background` | `#F6F4EF` | `#151412` | Screen canvas |
| `backgroundElement` | `#FFFFFF` | `#201F1B` | Card surface |
| `backgroundSelected` | `#ECE9E1` | `#2C2A25` | Selected / pressed quiet surface |
| `backgroundSunken` | `#F3F1EB` | `#1B1A17` | Recessed wells inside cards (picker wheels, code) |
| `backgroundRaised` | `#FFFFFF` | `#26241F` | Second elevation step (dark lifts; light uses shadow) |
| `border` | `#E2DFD6` | `#353329` | Hairline border |
| `divider` | `#ECE9E2` | `#272520` | Row separators inside one surface |
| `primary` | `#1B5FBE` | `#2F6FD0` | Brand blue — primary actions |
| `primaryPressed` | `#164E9D` | `#275FB4` | Pressed primary |
| `onPrimary` | `#FFFFFF` | `#FFFFFF` | Text/icon on primary |
| `primaryBg` | `#E8EFFA` | `#1D2B42` | Tinted brand surface (chips/links/info) |
| `primaryText` | `#17549F` | `#96BEF5` | Brand-colored text on a normal surface |
| `accentFg` | `#8A5A17` | `#DDAF63` | Sand accent foreground (today/now) |
| `accentBg` | `#F5EBD8` | `#352A17` | Sand accent surface |
| `accentSolid` | `#B97A1E` | `#C8923C` | Saturated sand fill (today/now) |
| `accentText` | `#7A4E12` | `#E2B872` | Sand text/eyebrow on canvas (AA) |
| `onAccent` | `#FFFFFF` | `#1A1408` | Text/icon on `accentSolid` |
| `successFg` | `#1A7A43` | `#4DC07D` | Success foreground (icon+text) |
| `successBg` | `#E3F2E7` | `#152F20` | Success surface |
| `warningFg` | `#9A5B00` | `#E2A23E` | Warning foreground |
| `warningBg` | `#F8EDD8` | `#332813` | Warning surface |
| `errorFg` | `#BE2E2E` | `#EF6F6B` | Error foreground |
| `errorBg` | `#FAE7E4` | `#3A1D1B` | Error surface |
| `infoFg` | `#17549F` | `#96BEF5` | Info foreground |
| `infoBg` | `#E8EFFA` | `#1D2B42` | Info surface |
| `dangerSolid` | `#D92D20` | `#E5564D` | Saturated destructive fill (also bell-badge red) |
| `onError` | `#FFFFFF` | `#FFFFFF` | Text on destructive |
| `onSuccess` | `#FFFFFF` | `#FFFFFF` | Text on solid success |
| `onWarning` | `#2A1D05` | `#2A1D05` | Dark text on solid amber |
| `overlay` | `rgba(29,27,22,0.45)` | `rgba(0,0,0,0.55)` | Modal scrim |

**Note (hard-coded, NOT tokens — do not mirror as theme variables, but document):** NotificationBell badge fill `#D92D20` + white `#FFFFFF` (intentional for contrast on both themes); AnimatedSplashOverlay `#208AEF` (splash). These are deliberate exceptions.

**Accessibility:** verify brand blue on porcelain meets AA (blue desaturates for aging eyes). `accentText` / `onWarning` are tuned for AA on their backgrounds.

### C.2 Type — IBM Plex Sans Arabic (one family, Arabic + Latin)

Weights bundled: Regular / Medium / SemiBold / Bold (`FontFamily.regular/medium/semibold/bold`). Each static weight is its own family name; pair with the matching numeric weight so fallback is clean.

| Style (`ThemedText type`) | Size | Line height | Weight | Usage |
|---|---|---|---|---|
| `display` | 34 | 46 | 700 | Additive/unused; reserve for hero numerals |
| `title` | 30 | 42 | 700 | Screen heading |
| `subtitle` | 22 | 32 | 700 | Sub-heading |
| `sectionTitle` | 19 | 30 | 700 | Section header |
| `cardTitle` | 17 | 27 | 600 | Card title |
| `default` (body) | 16 | 26 | 400 | Body — **review recommends raising to 17 floor** |
| `link` / `linkPrimary` | 15 | 28 | 500 | Inline links (`primaryText` color) |
| `small` | 14 | 22 | 400 | Captions/meta |
| `smallBold` | 14 | 22 | 600 | Emphasized caption |
| `eyebrow` | 13 | 18 | 600, +0.5 letter-spacing | **LATIN ONLY** — letter-spacing breaks Arabic letter-joining |
| `code` | 13 | — | mono | Code/IANA-like values |

**Recommendation to bake into Figma:** set the **body floor at 17 sp** (not 16) per the accessibility review; never go below 14 sp; let text scale to 130% and ~200%. **`eyebrow` must never wrap Arabic** (letter-spacing breaks joining).

### C.3 Spacing (4-pt scale)

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `half` | 2 | | `five` | 32 |
| `one` | 4 | | `section` | 40 |
| `two` | 8 | | `six` | 64 |
| `three` | 16 | | `Gutter` (phone edge) | 20 |
| `four` | 24 | | (brief recommends gutter 24) | |

### C.4 Radius

| Token | Value | Usage |
|---|---|---|
| `sm` | 8 | small chips/wells |
| `md` | 12 | inputs, small cards |
| `lg` | 16 | medium cards |
| `card` | 20 | standard panel |
| `xl` | 24 | hero / sheet tops |
| `pill` | 999 | stadium (badges, chips, avatars) |

### C.5 Icon sizes (`IconSize`)

| Token | Value | Note |
|---|---|---|
| `sm` | 16 | matches GlyphChip sm glyph |
| `md` | 20 | default UI |
| `lg` | 28 | matches GlyphChip lg glyph |
| `xl` | 40 | reserved for Today hero |

### C.6 Touch targets & elevation

| Item | Value |
|---|---|
| `TouchTarget.min` | 48 dp (accessibility floor) |
| `TouchTarget.comfortable` | 52 dp (primary controls; primary actions ≥ 56) |
| Min spacing between targets | ≥ 8 dp |
| `MaxContentWidth` | 720 (browsing/list on tablet/web) |
| `MaxFormWidth` | 480 (forms/settings) |
| **Elevation — Light** | `CardShadow`: `0 3 10 rgba(40,36,26,0.06)`, opacity ≤ 0.07 (felt, not seen) |
| **Elevation — Dark** | NO shadow — separate by `backgroundElement`/`backgroundRaised` lift + hairline `border` |

### C.7 Icon vocabulary (semantic name → meaning, family, RTL)

Source: `src/constants/icons.ts`. Reference icons **by meaning only** (`<Icon name="medication" />`) — never by a raw family glyph, never as a raw Unicode literal in source (that was the mojibake bug). Default family **Ionicons**; **MaterialCommunityIcons** only for the three care-domain marks noted. Both ship in the single `@expo/vector-icons` dependency.

| Semantic name | Meaning | Family | Glyph | Directional (RTL-mirrored) |
|---|---|---|---|---|
| `chevron` | Trailing "go" affordance | Ionicons | `chevron-forward` / `chevron-back` | **YES — the ONLY directional icon** (swaps to `chevron-back` in RTL) |
| `add` | Add / create | Ionicons | `add` | no |
| `close` | Close / dismiss | Ionicons | `close` | no |
| `dot` | Neutral marker (unread / neutral status) | Ionicons | `ellipse` | no |
| `success` | Success / done | Ionicons | `checkmark-circle` | no |
| `warning` | Warning | Ionicons | `warning` | no |
| `error` | Error / cancelled | Ionicons | `close-circle` | no |
| `info` | Info | Ionicons | `information-circle` | no |
| `clock` | Time / postponed | Ionicons | `time-outline` | no |
| `calendar` | Date | Ionicons | `calendar-outline` | no |
| `medication` | Medication (pill) | **MaterialCommunity** | `pill` | no |
| `task` | Task (checklist — NOT the success check) | Ionicons | `checkbox-outline` | no |
| `appointment` | Appointment (calendar — NOT the clock) | Ionicons | `calendar-outline` | no |
| `visit` | Family visit (home) | Ionicons | `home-outline` | no |
| `dailyLog` | Daily log (pencil/create) | Ionicons | `create-outline` | no |
| `vital` | Vital (heart-pulse) | **MaterialCommunity** | `heart-pulse` | no |
| `doctor` | Doctor | **MaterialCommunity** | `doctor` | no |
| `emergency` | Emergency (medkit) | Ionicons | `medkit` | no |
| `member` | Circle member(s) | Ionicons | `people-outline` | no |
| `profile` | Care-recipient profile | Ionicons | `person-circle-outline` | no |
| `notification` | Notification bell | Ionicons | `notifications-outline` | no |
| `settings` | Settings | Ionicons | `settings-outline` | no |
| `system` | System / cog | Ionicons | `cog-outline` | no |
| `call` | Phone call | Ionicons | `call` | no |

**Collisions deliberately resolved:** `task` ≠ `success` (checklist vs check — a task must not look "done"); `appointment` ≠ `clock` (calendar vs time — an appointment must not look like a generic time).

**Icon component (`src/components/icon.tsx`):** the single place that imports the families, enforces size/color tokens, applies RTL mirroring (swap to `rtlName` or `scaleX:-1`), and sets a11y labels. Icons are decorative-by-default (hidden from screen readers) unless given an `accessibilityLabel`. **Status is always icon + text + color** — never icon-only for meaning.

**Glyph fallback (`src/constants/glyphs.ts`):** ASCII-safe code-point constants for not-yet-migrated areas and for letterform avatars a vector set can't render (e.g. Arabic initial "د"). In Figma, model avatars as text/letterform layers, not decorative Unicode.

---

## D. Signature element spec — the Today Care Ring

**File:** `src/features/care-circle/today-care-ring.tsx` — `TodayCareRing({ given, total, loading, title, caption })`. Pure Views + theme tokens + `<Icon>` — **no SVG, no animation, no new dependencies.** This is the one bold, distinctly-Sanad motif; it lives inside the **TodayHero** (§B.10) and is the heart of the home.

### D.1 What it represents
The **today medication dose loop**: how many of today's *scheduled* doses have been recorded as given, out of the total scheduled (`given` of `total`). It is a **task-completion loop**, NOT a health graph. It reflects *recorded dose completion only* — never a clinical interpretation, never a judgment about the person's health.

### D.2 Layout
A row (`gap: Spacing.four`) = a **ring badge** (84 dp diameter, 8 dp border, pill radius) + a **text column** (`title` in `cardTitle` + `caption` in `small`/`textSecondary` + an optional segment strip). The ring badge and segment strip are **decorative** (`accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`); the parent hero `Surface` carries the spoken label.

### D.3 States — `loopState(loading, given, total)` → `loading | empty | progress | complete`

| State | Condition | Ring border / bg | Ring interior | Strip | Caption (passed in) |
|---|---|---|---|---|---|
| **loading** | `loading === true` | `border` / `backgroundSunken` | `<Icon name="medication" lg textSecondary>` | hidden | `today.loopLoading` "جارٍ تحميل جرعات اليوم…" |
| **empty** | `total === 0` | `border` / `backgroundSunken` | `<Icon name="medication" lg textSecondary>` | hidden | `today.loopNone` "لا جرعات مجدولة اليوم" |
| **progress** | `0 ≤ given < total` | `accentSolid` / `accentBg` | `<LtrText accentFg>{given}/{total}</LtrText>` (20 sp, weight 800) | shown | `today.loopDoses` "{{given}} من {{total}} جرعة اليوم" |
| **complete** | `given ≥ total` (total > 0) | `successFg` / `successBg` | `<Icon name="success" lg successFg>` | shown | `today.loopAllDone` "اكتملت جرعات اليوم" |

**Color semantics (NOT health colors):** loading/empty = neutral (`border`/`textSecondary`); progress = **sand accent** (the "today/now" signal, `accentSolid`/`accentBg`/`accentFg`); complete = **success** (`successFg`/`successBg`) — success here means "the loop is closed for today", i.e. all scheduled doses were *recorded*, not that the person is healthy.

### D.4 Segment strip
Shown only in progress/complete. Up to `MAX_SEGMENTS = 8` segments: ≤ 8 doses → one segment per dose with `filledCount = given`; > 8 doses → proportional `filledCount = round(given/total × 8)`. Filled = `successFg` (complete) or `accentSolid` (progress); empty = `backgroundSelected`. The strip is also accessibility-hidden (decorative reinforcement of the worded caption).

### D.5 Accessibility captions (computed in the hero, not the ring)
- `today.loopA11y` "حلقة رعاية اليوم: {{given}} من {{total}} جرعة تم إعطاؤها" (progress/complete)
- `today.loopA11yNone` "حلقة رعاية اليوم: لا جرعات مجدولة اليوم" (loading/empty)

The hero `Surface` carries the full spoken label; the ring/strip never speak on their own.

### D.6 The two inviolable rules
1. **Never color-only.** The meaning is ALWAYS stated in words in the caption, and the count/icon sits inside the ring. Color is reinforcement, never the sole signal — so the ring works for color-blind and low-vision users and under TalkBack.
2. **Never a health judgment.** The ring measures *recorded task completion*, not wellness. No "good/bad", no "normal/abnormal", no health color-coding, no clinical interpretation. The complete state means the day's *recording loop* is closed, full stop. This keeps the signature element inside Sanad's medical-safety boundary (records & reminds; does not diagnose or interpret).

### D.7 Figma variants for the ring
- **Care-state:** Loading / Empty / Progress / Complete (the four `loopState` outcomes).
- **Strip:** Hidden (loading/empty) / Shown (progress/complete), with `filledCount` 0…8.
- **Theme:** Light / Dark (full peer — tokens already symmetric).
- **Direction:** LTR / RTL (the ring is centered/symmetric; the count uses LtrText so `given/total` reads left-to-right inside Arabic; the text column flows RTL).

Build the ring as one Figma component with the Care-state variant axis; bind every color to a theme variable so Light/Dark switch is a mode change, not a redraw.
