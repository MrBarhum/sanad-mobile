# Design System — Tokens, Icons & Core Primitives

This section is the source-of-truth reference for Sanad's design *language* — not a screen, but the token layer and the handful of reusable primitives every screen is built from. Everything here lives in `src/constants/theme.ts` (the single token file — the old `figma-tokens.ts` / `form-typography.ts` / Cairo layer is deleted), `src/constants/icons.ts` + `src/constants/glyphs.ts` (the icon vocabularies), and the primitive components under `src/components/`. Read it first, because every other section maps its screens onto these tokens and components. Design direction, in the file's own words: **"Warm Care OS" — a calm, premium, Arabic-first family-care interface** whose identity comes from typography (one typeface, IBM Plex Sans Arabic), warm-neutral canvases (never flat white / pure black), one confident teal brand, a soft sand accent, and per-feature category tints — never from gradients, heavy shadows, or decoration. Tuned for older adults: large targets, strong contrast, status never color-only, light and dark are full peers.

---

## 1. Color palette (`Colors.light` / `Colors.dark`)

Colors are consumed via `useTheme()`, which returns the active scheme's object. Every key exists in **both** `light` and `dark` (the `ThemeColor` type is `keyof light & keyof dark`), so any token name is safe to use in either theme. Hex values below are quoted exactly from `theme.ts:33-152`.

### 1.1 Surfaces & text

| Token | Light | Dark | Meaning / usage |
|---|---|---|---|
| `text` | `#1A1714` | `#EDE8DF` | Primary text/ink. Warm near-black on light, warm off-white on dark. Default `<Icon>` and `<ThemedText>` color. |
| `textSecondary` | `#6B6258` | `#ACA89D` | Secondary text — subtitles, quiet labels, `neutral` GlyphChip/StatusBadge foreground. |
| `textMuted` | `#6D6760` | `#908981` | **Quieter than `textSecondary`** — metadata/timestamps only, never body text. Deliberately darkened (light) / lightened (dark) to clear AA 4.5:1 even on the deepest sunken well. |
| `background` | `#F7F3EE` | `#0F0E0C` | App canvas — warm porcelain (light) / warm graphite near-black (dark). Default `<ThemedView>` background. |
| `backgroundElement` | `#FFFFFF` | `#1A1916` | Card / panel surface (`Surface` tone `card`). White (light), lifted graphite (dark). |
| `backgroundSelected` | `#E4DDCE` | `#322E27` | Pressed/selected fill; secondary-button fill; IconButton fill; neutral GlyphChip bg; switch-off is *not* this (see below). |
| `backgroundSunken` | `#EDE8DF` | `#26231E` | Recessed wells **inside** cards + input fields; skeleton block color; switch-off track. |
| `border` | `#E1DDD8` | `#2E2A24` | Hairline card/panel border (present in **both** themes — see the card ruling). Secondary-button border; pressed IconButton fill. |
| `divider` | `#ECE7DF` | `#211F1B` | Softer than `border` — row separators **inside** one surface. |
| `ringTrack` | `rgba(26,23,20,0.08)` | `rgba(237,232,223,0.10)` | Care-loop ring unfilled track (decorative SVG stroke; contrast N/A). |

### 1.2 Brand (teal)

| Token | Light | Dark | Meaning / usage |
|---|---|---|---|
| `primary` | `#2A7F71` | `#4BA898` | The one confident teal. Filled primary-button bg; switch-on track; spinner color; active accents. Light value nudged darker so white `onPrimary` clears AA 4.5:1. |
| `primaryPressed` | `#256F63` | `#3E9384` | Primary button while pressed. |
| `onPrimary` | `#FFFFFF` | `#0F0E0C` | Text/icon **on** a filled `primary` surface. White on light; dark ink on the lighter dark-mode teal. |
| `primaryBg` | `#EAF3F1` | `#1C2D29` | Tinted teal surface — chips/links/active, `Surface` tone `primary`, `primary` GlyphChip bg. |
| `primaryText` | `#1F6E60` | `#7AC8BA` | Brand-colored **text** on the canvas (darker/lighter than `primary` so it clears AA). `plain` button label; link text; `primary` GlyphChip foreground. |

### 1.3 Warm sand / gold accent (celebratory + empty-state only)

Per the standing decision, gold is reserved for **celebration and empty-state** moments; caution uses amber (`warningFg`), never gold.

| Token | Light | Dark | Meaning / usage |
|---|---|---|---|
| `accentFg` | `#8A5A17` | `#DDAF63` | Accent **text/icon** on the canvas; `accent` GlyphChip foreground. |
| `accentBg` | `#F4E9D5` | `#34291A` | Soft accent surface; `Surface` tone `accent`; `accent` GlyphChip bg. |
| `accentSolid` | `#C8904A` | `#C8904A` | Gold **fill** (celebratory). Currently key-symmetric; sparingly used. |
| `accentText` | `#7A4E12` | `#E2B872` | Sand text/eyebrow on the canvas (AA). |
| `onAccent` | `#2A1D05` | `#0F0E0C` | Dark text **on** the gold `accentSolid` fill (white failed AA at 2.78). |

### 1.4 Semantic status foregrounds + soft backgrounds

Each status has a **foreground** (text + icon) and a **soft background** (badges/tinted surfaces). Status is always icon + text, never color alone.

| Tone | `…Fg` light | `…Fg` dark | `…Bg` light | `…Bg` dark | Meaning |
|---|---|---|---|---|---|
| success | `#1F7A4D` | `#5AAE85` | `#E4F1EA` | `#16291F` | Done / given / positive |
| warning | `#9A5B00` | `#D9A24A` | `#F6EBD7` | `#332813` | Caution / amber (the dedicated caution tone) |
| error | `#B5403F` | `#E07A78` | `#F7E5E3` | `#3A1E1C` | Destructive / missed / failed — the **restrained** danger foreground |
| info | `#3E6FA0` | `#7FA8D8` | `#E7EEF7` | `#1B2738` | Neutral information |

### 1.5 Filled-status fills & second elevation

| Token | Light | Dark | Meaning / usage |
|---|---|---|---|
| `dangerSolid` | `#C45050` | `#C45050` | Softer destructive **fill** (the "calm danger" — explicitly NOT the bell-badge alert red `#D92D20`). Pair with `onError`. |
| `onError` | `#FFFFFF` | `#FFFFFF` | Text on a solid danger fill. |
| `onSuccess` | `#FFFFFF` | `#0F0E0C` | Text on a solid success fill. |
| `onWarning` | `#2A1D05` | `#2A1D05` | Dark text on a solid amber fill. |
| `backgroundRaised` | `#FFFFFF` | `#232019` | Second elevation step (light lifts via shadow; dark via a lighter nested well). |
| `overlay` | `rgba(26,23,20,0.45)` | `rgba(0,0,0,0.55)` | Modal scrim / backdrop. |

### 1.6 Per-feature category ramp (5-step)

Used as `<Icon>` tint colors on feature/medication **identity** chips (passed to `GlyphChip color=`). The chip's tint background is derived at consume time via `withAlpha(hex, 0.14)`.

| Token | Light | Dark |
|---|---|---|
| `categoryBlue` | `#5A8ABF` | `#6A9ACC` |
| `categoryPurple` | `#8B6FA8` | `#9B7FC0` |
| `categoryGreen` | `#4A9A75` | `#5AAE85` |
| `categoryGold` | `#BA8645` (darkened from `#C8904A` to clear 3:1 UI on a card) | `#C8904A` |
| `categoryTeal` | `#2E8A7B` | `#4BA898` |

### 1.7 `withAlpha(hex, alpha)` helper

`theme.ts:341-347`. Parses a `#RRGGBB` hex and returns an `rgba(r, g, b, a)` string. The one sanctioned way to derive low-opacity (≈0.08–0.22) tint fills/borders from a ramp solid — e.g. `GlyphChip` derives its category-tint background as `withAlpha(theme[color], 0.14)`.

---

## 2. Typography

**One typeface: IBM Plex Sans Arabic** (SIL OFL, bundled font assets, loaded once in the root layout via `expo-font`). One family carries both Arabic and Latin, so mixed content (medication names, emails) stays harmonious. Static weight files → each weight is its own family name, paired with the matching numeric `fontWeight` for clean fallback before the asset loads (`theme.ts:164-190`).

```
FontFamily.regular  = 'IBMPlexSansArabic-Regular'
FontFamily.medium   = 'IBMPlexSansArabic-Medium'
FontFamily.semibold = 'IBMPlexSansArabic-SemiBold'
FontFamily.bold     = 'IBMPlexSansArabic-Bold'
```

`Fonts` (`theme.ts:171-190`) is a platform-selected map exposing `sans` (= `FontFamily.regular`), plus `serif` / `rounded` / `mono` fallbacks per platform (iOS `ui-*`, web CSS vars, default system). `mono` backs the `code` preset (invite codes, IDs).

### 2.1 `FontSize` — raw numeric scale (`theme.ts:205-214`)

**LAW: 14 is the absolute floor.** Nothing a caregiver must read renders below 14, ever. Body is 16, Arabic line-heights ≥ 1.5×. The only sanctioned sub-14 uses are pure decorative chrome that is NOT content (a superscript count badge, a `·` meta separator).

| Name | Size |
|---|---|
| `caption` | 14 |
| `body` | 16 |
| `cardTitle` | 18 |
| `sectionTitle` | 20 |
| `subtitle` | 22 |
| `hero` | 26 |
| `display` | 30 |
| `displayXL` | 34 |

### 2.2 `Type` — ready-to-spread presets (`theme.ts:216-239`)

Each bundles `fontFamily` + `fontSize` + `lineHeight`. Prefer spreading a preset over hand-setting size/line-height/family.

| Preset | Family | Size / LH | Intended use |
|---|---|---|---|
| `caption` | regular | 14 / 22 | Metadata, timestamps, hints, helper/error text, pill + chip labels (**the 14 floor**). |
| `captionStrong` | semibold | 14 / 22 | Emphasized 14 — field labels, section eyebrows, active tab. |
| `body` | regular | 16 / 26 | Default reading/paragraph text. |
| `bodyStrong` | semibold | 16 / 26 | Emphasized body, list-row values, primary button label, inline links. |
| `cardTitle` | semibold | 18 / 28 | List-row + card/section-item titles. |
| `sectionTitle` | bold | 20 / 30 | Section headings / group labels. |
| `subtitle` | bold | 22 / 32 | Sub-hero headings, large single stats. |
| `hero` | bold | 26 / 38 | Screen hero heading. |
| `display` | bold | 30 / 42 | Flagship greeting / dashboard hero. |
| `displayXL` | bold | 34 / 46 | Reserved oversized hero (additive; unused). |
| `code` | mono | 14 / 21 | Monospace/technical (invite codes, IDs) — raised to the 14 floor. |

> Note: `Type.*` and the `ThemedText type=` presets (Section 9) are **two parallel scales** with slightly different numbers. `ThemedText` was tuned for mobile (e.g. its `sectionTitle` is 19/30, `cardTitle` 17/27, `title` 30/42) while `Type.sectionTitle` is 20/30 and `Type.cardTitle` 18/28. A redesign should reconcile these; both are live in the codebase today.

---

## 3. Spacing, radius, sizing tokens

### 3.1 `Spacing` — 4-pt scale (`theme.ts:245-255`)

Names are historical; prefer the scale over magic numbers.

| Name | dp |
|---|---|
| `half` | 2 |
| `one` | 4 |
| `two` | 8 |
| `three` | 16 |
| `four` | 24 |
| `five` | 32 |
| `section` | 40 (between-section rhythm, fills the 32→64 gap; opt-in) |
| `six` | 64 |

### 3.2 `Radius` (`theme.ts:283-290`)

| Name | dp | Note |
|---|---|---|
| `sm` | 8 | Skeleton block default |
| `md` | 12 | Button corner |
| `lg` | 16 | |
| `card` | 20 | **Standard panel radius** (`Surface` default) |
| `xl` | 24 | |
| `pill` | 999 | Stadium — GlyphChip, IconButton, StatusBadge, switch |

### 3.3 `IconSize` — `<Icon>` glyph sizes (`theme.ts:263-268`)

`sm/md/lg` deliberately match the old GlyphChip glyph sizes so the text-glyph → vector move was 1:1.

| Token | dp |
|---|---|
| `sm` | 16 |
| `md` | 20 (default) |
| `lg` | 28 |
| `xl` | 40 (reserved for a future Today-Home hero) |

### 3.4 `ChipSize` — icon-chip **diameters** (`theme.ts:274-280`)

Distinct from `IconSize` (the glyph inside). Geometry, identical in both themes. (Note: `GlyphChip` internally uses its own `DIAMETER` map — see Section 6 — which differs slightly from these `ChipSize` values.)

| Token | dp |
|---|---|
| `xs` | 28 |
| `sm` | 36 |
| `md` | 40 |
| `lg` | 44 |
| `xl` | 48 |

### 3.5 `CardShadow` — light-only elevation (`theme.ts:297-308`)

Whisper-soft, **light mode only** (dark separates surfaces via lifted background + hairline border; a shadow reads as a smear on dark). Opacity ≤ 0.07 — depth felt, not seen.
- **Native:** `shadowColor '#28241A'`, `shadowOpacity 0.06`, `shadowRadius 10`, `shadowOffset {0, 3}`, `elevation 1`.
- **Web:** `boxShadow '0 2px 10px rgba(40, 36, 26, 0.06)'`.

### 3.6 `TouchTarget` (`theme.ts:314-317`)

| Token | dp | Note |
|---|---|---|
| `min` | 48 | Accessibility floor for older adults (IconButton, sm button) |
| `comfortable` | 52 | Primary controls (md button) |

### 3.7 Layout constants

| Token | Value | Meaning (`theme.ts:319-333`) |
|---|---|---|
| `Gutter` | 20 | Phone horizontal edge padding for full-width content |
| `BottomTabInset` | iOS 50 / Android 80 / else 0 | Bottom tab-bar clearance |
| `TopTabInset` | web 32 (`Spacing.five`) / else 0 | Clears the web-only floating top tab bar |
| `MaxContentWidth` | 720 | Max width for browsing/list content (tablet & web) |
| `MaxFormWidth` | 480 | Narrower max width for form/settings layouts |

---

## 4. Icon system

Two vocabularies. **Semantic vector icons** (`icons.ts`) are the modern system; **decorative text glyphs** (`glyphs.ts`) are the legacy ASCII-safe marks still used for avatars and a few escape hatches.

### 4.1 Semantic icons — `ICONS` (`src/constants/icons.ts`)

Feature code references icons **by meaning** (`<Icon name="medication" />`), never by a family glyph name. Only `icon.tsx` imports the families. Each entry: `family` (`'ionicons'` | `'material-community'`), `name` (glyph in that family), optional `rtlName` (mirrored glyph in RTL) and `directional` flag.

**Family policy:** Ionicons is the default (calm even-weight silhouettes, proper `chevron-back`/`chevron-forward` for RTL). A small deliberate set uses MaterialCommunityIcons where recognisability is materially better: `medication` (pill), `doctor`, `vital` (heart-pulse), `temperature` (thermometer), `oxygen` (lungs), `appetite` (fork-knife), `owner` (crown-outline). Both fonts ship in the single `@expo/vector-icons` package — no extra dependency.

**Collisions resolved:** the old glyph set reused one mark for several meanings; here `task` is a checklist (not the success check ✓) and `appointment` is a calendar (not the clock), so a task never looks "done" and an appointment never looks like a generic time.

Full `IconName` vocabulary (`icons.ts:48-121`):

| Group | Semantic name → family:glyph |
|---|---|
| **Nav & structure** | `chevron` → ionicons `chevron-forward` (RTL `chevron-back`, directional); `add` → `add`; `close` → `close`; `dot` → `ellipse` |
| **Status** (bold filled, always with a label) | `success` → `checkmark-circle`; `warning` → `warning`; `error` → `close-circle`; `info` → `information-circle` |
| **Time** | `clock` → `time-outline`; `calendar` → `calendar-outline` |
| **Feature identities** | `medication` → mc:`pill`; `task` → `checkbox-outline`; `appointment` → `calendar-outline`; `visit` → `home-outline`; `dailyLog` → `create-outline`; `vital` → mc:`heart-pulse`; `doctor` → mc:`doctor`; `emergency` → `medkit`; `member` → `people-outline`; `profile` → `person-circle-outline`; `notification` → `notifications-outline`; `settings` → `settings-outline`; `system` → `cog-outline`; `call` → `call` |
| **Nav additions** | `back` → `arrow-back` (RTL `arrow-forward`, directional); `chevronDown` → `chevron-down` (not directional) |
| **Reading identities** | `explore` → `compass-outline`; `activity` → `pulse`; `heart` → `heart-outline`; `location` → `location-outline`; `drop` → `water-outline`; `temperature` → mc:`thermometer`; `oxygen` → mc:`lungs`; `weight` → mc:`weight`; `mood` → `happy-outline`; `sleep` → `moon-outline`; `appetite` → mc:`silverware-fork-knife`; `sparkle` → `sparkles-outline` |
| **Actions & roles** | `more` → `ellipsis-horizontal`; `signOut` → `log-out-outline`; `claim` → `hand-left-outline` (the «أنا متكفّل» CTA); `edit` → `create-outline`; `copy` → `copy-outline`; `view` → `eye-outline`; `viewOff` → `eye-off-outline`; `invite` → `person-add-outline`; `removeMember` → `person-remove-outline`; `owner` → mc:`crown-outline`; `role` → `ribbon-outline`; `shield` → `shield-checkmark-outline`; `lock` → `lock-closed-outline` |
| **Theme toggle** | `moon` → `moon-outline`; `sun` → `sunny-outline` |

Only two icons are **directional** (mirror in RTL by swapping to `rtlName`): `chevron` and `back`. Any directional icon without an `rtlName` would instead get a horizontal-flip transform (`scaleX: -1`).

### 4.2 Decorative glyphs — `Glyph` (`src/constants/glyphs.ts`)

ASCII-safe marks built from numeric code points via `String.fromCodePoint`, so the source can never be corrupted by an encoding round-trip (no raw Unicode literal in `.tsx`). Non-emoji, monochrome, never carry meaning alone. Import `Glyph.*` rather than writing a glyph literal.

| Key | Char | Purpose | Key | Char | Purpose |
|---|---|---|---|---|---|
| `chevron` | `›` | nav "go" | `check` | `✓` | done / selected |
| `bullet` | `•` | separator / avatar fallback | `cross` | `✕` | cancelled / close / missed |
| `middot` | `·` | metadata separator | `clock` | `◷` | pending / upcoming |
| `dot` | `●` | unread indicator | `plus` | `＋` | add (fullwidth) |
| `minus` | `－` | remove (fullwidth) | `info` | `i` | informational |
| `warn` | `!` | warning | `medication` | `◉` | med identity |
| `task` | `✓` | task | `appointment` | `◷` | appointment |
| `visit` | `⌂` | visit | `dailyLog` | `✎` | daily log |
| `vital` | `♡` | vital | `members` | `❖` | members |
| `profile` | `✦` | profile | `doctor` | `✜` | doctor |
| `contact` | `✆` | contact | `emergency` | `✚` | emergency |
| `system` | `⊙` | system | `diamond` | `◈` | explore placeholder |
| `bullseye` | `◎` | explore placeholder | | | |

`initialFor(name)` (`glyphs.ts:60-63`): returns the first grapheme of a (possibly Arabic, possibly empty) display name, or `Glyph.bullet` (`•`) when blank — for letterform avatars.

---

## 5. Core primitives

### 5.1 `Icon` (`src/components/icon.tsx`)

The one centralized icon; the only file allowed to import the vector families. Color flows through `useTheme()`, so icons follow light/dark automatically; directional icons mirror in RTL. **Decorative by default** — hidden from screen readers unless `accessibilityLabel` is passed (then announced as an `image`). Also exports `IconFonts` (the merged Ionicons + MaterialCommunityIcons font map) for the root `useFonts`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | `IconName` | — (required) | Semantic name; never a raw family glyph. |
| `size` | `'sm'\|'md'\|'lg'\|'xl'` or number | `'md'` (20) | Token or explicit px. |
| `color` | `ThemeColor` | `'text'` | Resolved for the active scheme. |
| `accessibilityLabel` | string | — | Provided ⇒ meaningful & announced; omitted ⇒ decorative & hidden. |
| `style` | `StyleProp<TextStyle>` | — | |

### 5.2 `Button` (`src/components/button.tsx`)

The single button primitive. Always meets the touch-target floor; labels stay legible in light & dark; cross-platform.

**Variants** (`ButtonVariant`):
- `primary` — filled brand teal (`primary` bg → `primaryPressed` when pressed), `onPrimary` label. **Always a full-opacity filled teal rectangle even when disabled** (never greyed) so "filled teal = main action" always reads; pressability is still gated by `disabled`/`loading`.
- `secondary` — quiet `backgroundSelected` fill, `border` hairline edge, `text` label; pressed → `border` fill. Calm on canvas and on cards; dims to 0.45 opacity when disabled.
- `danger` — `errorBg` fill, `errorFg` border + `errorFg` label; drops to 0.75 opacity while pressed. Reads destructive without shouting; dims when disabled.
- `plain` — transparent, `primaryText` label; pressed → `backgroundSelected` fill. Low-emphasis tertiary; dims when disabled.

Icon tint per variant (`ICON_COLOR`): primary→`onPrimary`, secondary→`text`, danger→`errorFg`, plain→`primaryText`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | — (required) | Always carries the meaning. |
| `onPress` | `() => void` | — (required) | |
| `variant` | `'primary'\|'secondary'\|'danger'\|'plain'` | `'primary'` | |
| `size` | `'md'\|'sm'` | `'md'` | md = `minHeight 52` (comfortable), pad V 16 / H 24, label 16/24 semibold, icon 18. sm = `minHeight 48` (min), pad V 8 / H 16, label 14/21 semibold, icon 16. |
| `iconName` | `IconName` | — | Optional leading icon in the label color. |
| `glyph` | string | — | Legacy leading text glyph (e.g. `＋`); prefer `iconName`. |
| `loading` | boolean | `false` | Shows an `ActivityIndicator` in the label color instead of content. |
| `disabled` | boolean | `false` | |
| `style`, `accessibilityHint`, `accessibilityLabel` | | | `accessibilityLabel` falls back to `label`. |

Shape: `borderRadius Radius.md` (12), hairline border, row content with `Spacing.two` gap, centered.

### 5.3 `IconButton` (`src/components/icon-button.tsx`)

A square/pill, accessible icon-only button that always meets the **48dp** floor (`TouchTarget.min`). **For SECONDARY actions only** — primary operations must use a labeled `Button` (never a tiny icon-only target). `accessibilityLabel` is **required** (the control is icon-only).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `iconName` | `IconName` | — | Preferred. Rendered at size 20. |
| `icon` | string | — | Legacy glyph/emoji string (decorative; meaning from label). |
| `accessibilityLabel` | string | — (**required**) | Spoken label. |
| `onPress` | `() => void` | — (required) | |
| `accessibilityHint` | string | — | |
| `color` | `ThemeColor` | `'text'` | Icon foreground. |
| `filled` | boolean | `true` | `backgroundSelected` fill for a clear tappable affordance; pressed → `border` fill + 0.6 opacity. |
| `disabled` | boolean | `false` | 0.5 opacity. |

Shape: `minWidth`/`minHeight` 48, `Radius.pill`, `hitSlop 8`, `paddingHorizontal 8`.

### 5.4 `Surface` / `Card` / `Section` (`src/components/surface.tsx`)

**The ONE card/panel primitive (M5 card ruling — law).** A card carries a **hairline border in BOTH themes** (the border defines the edge for older eyes and is what reads in dark mode where a shadow barely registers). A **whisper-soft `CardShadow` sits on top in LIGHT mode only**, as warmth; dark mode has no shadow. Tinted/sunken tones stay flat (single elevation step, no shadow). Pass `onPress` to make the whole surface a button (Android ripple, other platforms an opacity dip to 0.8; disabled → 0.5).

**Tones** (`SurfaceTone` → background token): `card`→`backgroundElement`, `sunken`→`backgroundSunken`, `selected`→`backgroundSelected`, `primary`→`primaryBg`, `accent`→`accentBg`, `success`→`successBg`, `warning`→`warningBg`, `error`→`errorBg`, `info`→`infoBg`. Only `card` (and only when not dark) gets the shadow.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tone` | `SurfaceTone` | `'card'` | See table above. |
| `padded` | `boolean \| number` | `true` | `true` = `Spacing.four` (24); a number = that many dp; `false` = none. |
| `bordered` | boolean | `true` | Hairline border in both themes. |
| `radius` | number | `Radius.card` (20) | |
| `gap` | number | — | Vertical gap between stacked children (e.g. a form card's fields — this is the old FigmaFormCard job). |
| `onPress` | `() => void` | — | Makes it a pressable button. |
| `selected` | boolean | — | Forwarded to `accessibilityState` (e.g. a selected option card). |
| `disabled`, `accessibilityLabel`, `accessibilityHint`, `style`, `testID` | | | |

`Card` is a **named alias** of `Surface` (intent only). There is no `FigmaCard`/`FigmaFormCard` — both deleted.

`Section({ title, action, children, gap = Spacing.three, style })`: a titled group — an accessible `sectionTitle` heading row (with an optional trailing `action` node, `space-between`) plus its content, consistent spacing.

### 5.5 `GlyphChip` (`src/components/glyph-chip.tsx`)

Sanad's **identity anchor**: a soft tinted circle (`Radius.pill`) holding a vector icon or a letterform. Shape carries identity; tint stays within the calm palette; never the sole carrier of meaning (decorative by default). Absorbs the old `IconChip`.

Two coloring modes:
- **Semantic `tone`** (`GlyphChipTone`) drives both fg + bg from the palette: `primary`→`primaryText`/`primaryBg`, `accent`→`accentFg`/`accentBg`, `neutral`→`textSecondary`/`backgroundSelected`, `success`/`warning`/`error`/`info`→ the matching `…Fg`/`…Bg`.
- **`color` override** (a ramp token like `categoryTeal`): the mark takes that color on a **soft `withAlpha(color, 0.14)` tint** of it — the per-feature/category look.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `iconName` | `IconName` | — | Preferred way to give a chip identity. |
| `glyph` | string | — | Letterform (initial) or non-emoji glyph — for avatars a vector set can't render, or fallback. |
| `tone` | `GlyphChipTone` | `'primary'` | |
| `color` | `ThemeColor` | — | Overrides `tone` (category ramp look). |
| `size` | `'xs'\|'sm'\|'md'\|'lg'` | `'md'` | Diameter `xs 28 / sm 36 / md 44 / lg 64`; glyph size `xs 14 / sm 16 / md 20 / lg 28`. |
| `accessibilityLabel` | string | — | Pass only when the chip stands alone. |

> The internal `DIAMETER` map (`28/36/44/64`) differs from the shared `ChipSize` token (`28/36/40/44/48`) — `GlyphChip` does not consume `ChipSize`. Flag for a redesign.

### 5.6 `StatusBadge` (`src/components/status-badge.tsx`)

Pill badge for a status (e.g. dose "given", task "done"). A soft tinted background + strong foreground + a **bold tone icon** + a text label — legible in light & dark, **never color-only**, calm not loud. A distinct icon per tone so shape carries meaning for low-vision/color-blind users.

Tones (`StatusTone` → fg / bg / icon): `success`→`successFg`/`successBg`/`success`, `warning`→`warningFg`/`warningBg`/`warning`, `error`→`errorFg`/`errorBg`/`error`, `info`→`infoFg`/`infoBg`/`info`, `neutral`→`textSecondary`/`backgroundSelected`/`dot`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tone` | `StatusTone` | — (required) | Drives color + default icon. |
| `label` | string | — (required) | Always present (never icon-only). |
| `iconName` | `IconName` | — | Override the tone icon (still shape-based). |
| `glyph` | string | — | Legacy: literal text glyph instead of the tone icon. |
| `style` | | | |

Shape: `Radius.pill`, row, gap `Spacing.one + half` (6), pad V 6 / H 12, `alignSelf: flex-start`, icon size 14, label 14/19 semibold.

### 5.7 States — `LoadingState` / `ErrorState` / `EmptyState` (`src/components/states.tsx`)

- **`LoadingState({ label? })`** — full-area centered `ActivityIndicator` (large, `primary` color) with an optional `textSecondary` label below. Centered layout, `gap Spacing.four`.
- **`ErrorState({ message, retryLabel, onRetry })`** — full-area centered: a `GlyphChip iconName="warning" tone="error" size="lg"`, the `message` as an `accessibilityRole="alert"` centered line, and a **secondary** `Button` labelled `retryLabel`. Error states keep this **bespoke** card — they are NOT folded into `EmptyState`.
- **`EmptyState({ title, subtitle?, icon?, iconName? })`** — **the one empty-state primitive**; every list empty uses it. A single `Surface tone="card"` with, top-to-bottom: an optional `GlyphChip` (`iconName` preferred → `tone="neutral" size="lg"`; else a legacy `glyph`), the `title` (`ThemedText type="cardTitle"`, centered), and an optional `subtitle` (`type="small"` `textSecondary`, centered). **Each screen passes its own feature icon.** Padding V `Spacing.five` / H `Spacing.four`, `gap Spacing.three`, centered.

### 5.8 `Skeleton` / `SkeletonList` (`src/components/skeleton.tsx`)

- **`Skeleton({ width='100%', height=16, radius=Radius.sm, style })`** — a single placeholder block that gently pulses (opacity only, ~700ms each way, ~1s loop) in `backgroundSunken`. **Honors OS reduce-motion** (`useReduceMotion` subscribes to `AccessibilityInfo`): when on, holds a static 0.6 opacity instead of animating. Hidden from screen readers. Pure-JS.
- **`SkeletonList({ count=4 })`** — the list-loading placeholder: `count` card-shaped rows matching the feature lists' rhythm — a leading 44×44 pill skeleton + two text-line skeletons (70% / 45% width). Wrapper announces `accessibilityRole="progressbar"` busy once. Card styling mirrors a real list card (`backgroundElement`, hairline `border`, `Radius.card`, `Spacing.three` padding/gap).

### 5.9 `FigmaSwitch` (`src/components/figma/figma-form-screen.tsx:129-157`)

**The one toggle** — the 48×28 brand pill; the platform `Switch` is never used. `accessibilityRole="switch"` with `accessibilityState.checked`.

| Prop | Type | Notes |
|---|---|---|
| `value` | boolean | On/off. |
| `onValueChange` | `(next: boolean) => void` | |
| `accessibilityLabel` | string? | |

Visuals: track 48×28, `borderRadius 14`, `borderWidth 1.5`, `paddingHorizontal 2`. **On** → `backgroundColor: primary`, `borderColor: primary`, thumb at trailing edge (`justifyContent: flex-end`). **Off** → `backgroundColor: backgroundSunken`, `borderColor: border`, thumb at leading edge (`flex-start`). Thumb is a fixed 20×20 white circle (`borderRadius 10`). RTL-aware purely via flexbox (off = leading edge, on = trailing edge). Related helpers in the same file: `FigmaToggleRow` (label + optional hint + switch, optional top divider) and `FigmaMutedNote` (a muted 14/21 explanatory line).

### 5.10 `ThemedText` (`src/components/themed-text.tsx`)

The base text component; resolves color via `useTheme()`. Default color = `text` (or `primaryText` for `link`/`linkPrimary`); override with `themeColor` (any `ThemeColor`). **Its `type` presets are a parallel scale to `Type.*`** (see the note in §2.2):

| `type` | Family | Size / LH / weight |
|---|---|---|
| `default` | regular | 16 / 26 / 400 |
| `display` | bold | 34 / 46 / 700 (additive; unused) |
| `eyebrow` | semibold | 14 / 20 / 600, `letterSpacing 0.5` |
| `title` | bold | 30 / 42 / 700 (screen greeting/hero) |
| `subtitle` | bold | 22 / 32 / 700 |
| `sectionTitle` | bold | 19 / 30 / 700 |
| `cardTitle` | semibold | 17 / 27 / 600 |
| `small` | regular | 14 / 22 / 400 |
| `smallBold` | semibold | 14 / 22 / 600 |
| `link` / `linkPrimary` | medium | 15 / 28 / 500, `primaryText` color |
| `code` | mono | 14, weight 700 android / 500 else |

### 5.11 `ThemedView` (`src/components/themed-view.tsx`)

A `View` whose `backgroundColor` resolves from a `ThemeColor` (`type` prop, default `background`). Also accepts legacy `lightColor`/`darkColor` props (present in the type but the implementation only reads `type`). The canvas primitive under most screens.

### 5.12 `LtrText` / `isolateLtr` (`src/components/ltr-text.tsx`)

RTL-safety helpers. **`LtrText`** wraps a left-to-right value (phone number, email, ID, invitation code, time, English medication name) so it renders correctly inside the Arabic-first RTL UI: forces `writingDirection: 'ltr'` and bidi-isolates the string (`U+2066 LRI … U+2069 PDI`, built from code points so no invisible chars live in source). Alignment inherits (start = right in RTL), so the value sits at the start of its container. **`isolateLtr(value)`** returns the LRI…PDI-wrapped string for embedding a value inline within a larger translated Arabic string without reordering neighbors. Extends `ThemedTextProps`.

### 5.13 `AnimatedSplashOverlay` / `AnimatedIcon` (`src/components/animated-icon.tsx`)

The launch/splash animation, **not a design-system primitive** — it is Expo's stock reanimated splash scaffold (a solid-color overlay that scales/fades out over 600ms via a `Keyframe`, and a logo/glow reveal). It still references the old Expo template blue (`#208AEF`, gradient `#3C9FFE→#0274DF`) and `expo-logo.png` / `logo-glow.png`, **not** Sanad's teal token — flag as leftover scaffolding for the redesign.

---

## 6. Shared copy — the `common` i18n namespace

Generic action labels reused across screens (`src/locales/ar.json` + `en.json`, exact key parity). All quoted verbatim.

| Key | Arabic | English |
|---|---|---|
| `edit` | «تعديل» | "Edit" |
| `details` | «التفاصيل» | "Details" |
| `delete` | «حذف» | "Delete" |
| `call` | «اتصال» | "Call" |
| `confirmDelete` | «تأكيد الحذف» | "Confirm delete" |
| `cancel` | «إلغاء» | "Cancel" |
| `save` | «حفظ» | "Save" |
| `saveChanges` | «حفظ التغييرات» | "Save changes" |
| `close` | «إغلاق» | "Close" |
| `back` | «رجوع» | "Back" |
| `add` | «إضافة» | "Add" |
| `ok` | «حسنًا» | "OK" |
| `yes` | «نعم» | "Yes" |
| `no` | «لا» | "No" |
| `unsavedTitle` | «تغييرات غير محفوظة» | "Unsaved changes" |
| `unsavedMessage` | «لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟» | "You have unsaved changes. Leave without saving?" |
| `discardChanges` | «تجاهل التغييرات» | "Discard changes" |
| `keepEditing` | «متابعة التعديل» | "Keep editing" |

Note the voice: `confirmDelete` says «تأكيد الحذف», the discard flow uses «تجاهل التغييرات» / «متابعة التعديل» (not «فشل»/«خطأ»), and there are **no exclamation marks or emojis** anywhere — consistent with the calm-family-warmth standing decision.

---

## Workflows

These are cross-cutting "how a designer wires the system together" flows, not user journeys (this domain has no screens of its own).

### A. Apply a color to any element
1. Never hardcode a hex a token covers. Call `const theme = useTheme()` inside the component.
2. Pick the semantic token (`theme.primary`, `theme.errorFg`, `theme.textSecondary`, …). It auto-resolves to the active light/dark value.
3. For a per-feature identity tint, pass a `category*` ramp token to `GlyphChip color=`; the soft background is derived for you via `withAlpha(hex, 0.14)`.

### B. Size a piece of text
1. Prefer spreading a preset — `Type.body`, `Type.caption`, `Type.cardTitle`, … — or set `ThemedText type=`.
2. Never drop below **14** for content. Sub-14 is allowed only for a decorative count badge or a `·` separator.
3. For a left-to-right value (time, phone, code, email, Latin med name) inside Arabic UI, wrap it in `LtrText` (or `isolateLtr` inline).

### C. Build a card / panel
1. Use `Surface` (or its `Card` alias) — it is the only card. Choose a `tone` (`card` default; `sunken`/`primary`/`error`/… for tinted).
2. Set inner padding with `padded` (`true` = 24dp, a number, or `false`) and group inner fields with `gap`.
3. The hairline border renders in both themes automatically; the soft shadow appears in light mode only for the plain `card` tone — you don't add either manually.
4. Make it tappable by passing `onPress` (adds Android ripple / opacity dip + button a11y role).

### D. Show a status
1. Use `StatusBadge` with a `tone` + a text `label`. The tone picks the color **and** a distinct shape icon — status is never color-only.
2. For an identity anchor (feature icon on a card/row/empty state) use `GlyphChip` with an `iconName` and a `tone` or `color`.

### E. Render list states (loading / empty / error)
1. **Loading** → `SkeletonList count={n}` (or `Skeleton` for a bespoke block); it auto-honors OS reduce-motion.
2. **Empty** → `EmptyState` with the feature's own `iconName`, a warm `title`, and an optional `subtitle`. Every list empty uses this one component.
3. **Error** → `ErrorState` with a plain-language `message` (voice: «تعذّر …», never «فشل»), a `retryLabel`, and `onRetry`. Error keeps its own bespoke card (not folded into `EmptyState`).

### F. Add or restyle an icon app-wide
1. To use an icon: `<Icon name="medication" />` — reference by **meaning** only. Add `accessibilityLabel` only if it stands alone; otherwise it's decorative and hidden.
2. To restyle app-wide: change the single entry in `ICONS` (`icons.ts`). To add one: add a semantic key there (keep it ASCII; pick Ionicons unless a MaterialCommunityIcons care-domain glyph is materially clearer).
3. For a decorative non-emoji mark (avatar initial, separator), use `Glyph.*` / `initialFor()` from `glyphs.ts` — never inline a raw Unicode literal.

### G. Add a toggle
1. Use `FigmaSwitch` (the 48×28 brand pill) — never the platform `Switch`. Wire `value` + `onValueChange`, and pass an `accessibilityLabel`.
2. For a full "label + hint + switch" settings row, use `FigmaToggleRow`.
