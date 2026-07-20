/**
 * Sanad design tokens — a single source of truth for color, type, spacing,
 * radius, elevation and touch-target sizing.
 *
 * Visual direction: «دار · الأخضر والرمل» (Dar / Green & Sand) — a "family house"
 * feel: sturdy, grounded, calm. Warm sand canvas (`background`), cream cards
 * (`backgroundElement`), a deep-green header band (`band`) with cream ink
 * (`bandInk`), and 2px solid deep-green borders (`border` = `line`) on almost
 * everything. Flat elevation (no shadows); gold (`goldFill`/`goldInk`) is reserved
 * for exactly the claim + one-time-warning surfaces. Typeface: Cairo. Tuned for
 * older adults: ≥16 body, strong AA contrast, status never color-only. Light and
 * dark are full peers — only token values swap, never layout.
 *
 * Milestone 6 (2026-07-20) re-pointed every color VALUE to the Dar handoff palette
 * (source: docs/design/tokens.reference.ts) while KEEPING all existing key names —
 * so the whole app shifts identity from the token change alone — and added the
 * genuinely new roles `band`/`bandInk`/`goldFill`/`goldInk`. The full handoff-token
 * → repo-token mapping (and the collapse of the category ramp onto the single green
 * accent) is in docs/claude-reports/2026-07-20-milestone-6-dar.md. AA verified in
 * both themes.
 *
 * All existing token keys are preserved so every consumer keeps working; only
 * values changed + the four new keys were appended.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Surfaces & text — warm sand canvas, cream cards, deep-green ink & borders.
    text: '#14312A', // ink
    textSecondary: '#47594F', // mut
    /** Dar has one muted tone — mut is used for every secondary/meta line. */
    textMuted: '#47594F', // mut
    background: '#EFE8D6', // bg (warm sand)
    backgroundElement: '#FAF6EA', // card (cream)
    /** Pressed/selected fill + grab handles — the sunken well tone. */
    backgroundSelected: '#E4DBC4', // sunken
    /** Recessed wells INSIDE cards + input fields. */
    backgroundSunken: '#E4DBC4', // sunken
    border: '#14312A', // line (= ink in light — the 2px solid edge)
    /** Dar dividers are the same 2px line as borders. */
    divider: '#14312A', // line
    /** Legacy care-loop ring track (ring retired; kept for type symmetry). */
    ringTrack: 'rgba(20, 49, 42, 0.12)',

    // Brand — deep green. `primary`/`btn` = the button/active fill; `primaryText`/
    // `acc` = accent text, links, icons. Same value in light (the Dar palette).
    primary: '#0E4A40', // btn
    primaryPressed: '#0A3A32', // derived darker btn (press)
    onPrimary: '#F4EEDC', // btnInk (cream on green)
    primaryBg: '#D9E4DE', // tacc — tinted accent/info surface
    primaryText: '#0E4A40', // acc — accent text/links/icons

    // Accent = the GOLD pairing (goldFill fill + goldInk text). Reserved for the
    // two sanctioned gold uses (claim surfaces, one-time warnings) + the gold banner.
    accentFg: '#2A2408', // goldInk (text on gold)
    accentBg: '#E3C36A', // goldFill (gold surface)

    // Semantic foregrounds (stroke/text) + tint fills (icon+text always accompany).
    successFg: '#2E6A4E', // ok
    successBg: '#DAE8DC', // tok (success tint)
    warningFg: '#7F5A08', // warn (amber caution — never the gold)
    warningBg: '#EEE2C1', // twarn (caution tint)
    errorFg: '#9C4034', // err (restrained danger)
    errorBg: '#F1DED6', // terr (danger tint)
    infoFg: '#0E4A40', // acc — info shares the green accent
    infoBg: '#D9E4DE', // tacc — info tint

    // Solid-fill on-colors (mostly type-symmetry). Dar rule: an err fill takes
    // bg-colored text; gold fill takes goldInk.
    accentSolid: '#E3C36A', // goldFill
    accentText: '#7F5A08', // warm accent eyebrow (= warn)
    onAccent: '#2A2408', // goldInk (text on gold fill)
    dangerSolid: '#9C4034', // err — the solid danger fill (emergency call, delete)
    onError: '#EFE8D6', // bg-colored text on an err fill
    onSuccess: '#F4EEDC', // cream text on a solid ok fill
    onWarning: '#2A2408', // dark text on a solid warn fill
    backgroundRaised: '#FAF6EA', // flat — no second elevation (= card)

    /** Bottom-sheet / modal scrim (Dar spec). */
    overlay: 'rgba(8, 18, 14, 0.55)',

    // Feature-identity ramp — Dar collapses per-feature color to the single green
    // accent (the HTML draws every feature icon in `acc`); identity now comes from
    // the glyph, not the hue. Kept key-symmetric so every GlyphChip consumer works.
    categoryBlue: '#0E4A40', // acc
    categoryPurple: '#0E4A40', // acc
    categoryGreen: '#0E4A40', // acc
    categoryGold: '#0E4A40', // acc
    categoryTeal: '#0E4A40', // acc

    // NEW Dar roles (no prior repo home): the deep-green header band + its cream
    // ink, and the gold fill/ink pair used ONLY on claim + one-time-warning surfaces.
    band: '#0E4A40',
    bandInk: '#F4EEDC',
    goldFill: '#E3C36A',
    goldInk: '#2A2408',
  },
  dark: {
    // Deep green-black canvas, lifted green cards, borders LIGHTEN (not ink).
    text: '#EEE7D4', // ink
    textSecondary: '#A9BCAD', // mut
    textMuted: '#A9BCAD', // mut
    background: '#0A1B17', // bg
    backgroundElement: '#122B24', // card
    backgroundSelected: '#0E211C', // sunken
    backgroundSunken: '#0E211C', // sunken
    border: '#6B8074', // line (lightens away from ink so edges read in dark)
    divider: '#6B8074', // line
    ringTrack: 'rgba(238, 231, 212, 0.12)',

    primary: '#7FC7B4', // btn
    primaryPressed: '#6BB3A0', // derived darker btn
    onPrimary: '#06231C', // btnInk (dark on light-teal)
    primaryBg: '#1D3B33', // tacc
    primaryText: '#8FCBB8', // acc

    accentFg: '#1A1408', // goldInk
    accentBg: '#C8A33B', // goldFill

    successFg: '#93C9A6', // ok
    successBg: '#1E3D2C', // tok
    warningFg: '#DDB65E', // warn
    warningBg: '#41351A', // twarn
    errorFg: '#E2907F', // err
    errorBg: '#46271F', // terr
    infoFg: '#8FCBB8', // acc
    infoBg: '#1D3B33', // tacc

    accentSolid: '#C8A33B', // goldFill
    accentText: '#DDB65E', // warn
    onAccent: '#1A1408', // goldInk
    dangerSolid: '#E2907F', // err
    onError: '#0A1B17', // bg-colored text on err fill
    onSuccess: '#06231C',
    onWarning: '#1A1408',
    backgroundRaised: '#122B24', // = card (flat)

    overlay: 'rgba(0, 0, 0, 0.6)',

    categoryBlue: '#8FCBB8', // acc
    categoryPurple: '#8FCBB8', // acc
    categoryGreen: '#8FCBB8', // acc
    categoryGold: '#8FCBB8', // acc
    categoryTeal: '#8FCBB8', // acc

    band: '#123B32',
    bandInk: '#EEE7D4',
    goldFill: '#C8A33B',
    goldInk: '#1A1408',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * App typeface — Cairo (SIL OFL), the single family for the Dar identity, loaded
 * once in the root layout from `@expo-google-fonts/cairo` (pure JS asset package —
 * no native module, no rebuild). One family carries Arabic AND Latin so mixed
 * content (medication names, emails) stays harmonious. Static weight files → each
 * weight is its own family name.
 *
 * The Dar weight scale is 400/600/700/800/900; the repo key names are kept
 * (regular→400, medium→600, semibold→700, bold→800) with `black`→900 added, so
 * every existing `FontFamily.*` consumer keeps working. IBM Plex Sans Arabic is
 * fully retired — there is exactly one typeface.
 */
export const FontFamily = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_600SemiBold',
  semibold: 'Cairo_700Bold',
  bold: 'Cairo_800ExtraBold',
  black: 'Cairo_900Black',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.regular,
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: FontFamily.regular,
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: `${FontFamily.regular}, var(--font-display)`,
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * TYPE SCALE — the single source of text sizing for the whole app.
 *
 * LAW: 14 is the ABSOLUTE FLOOR. Nothing a caregiver must read renders below 14
 * anywhere, ever (older-adult readability). Body is 16. Arabic line-heights are
 * ≥1.5×. The ONLY sanctioned sub-14 uses are pure decorative chrome that is NOT
 * content (a superscript count badge, a «·» meta separator) — never a label,
 * value, timestamp, status, hint, or body line.
 *
 * `FontSize` is the raw numeric scale; `Type` bundles size + line-height + the
 * matching Cairo family into ready-to-spread TextStyle presets. Prefer
 * spreading a `Type.*` preset over hand-setting fontSize/lineHeight/fontFamily.
 */
export const FontSize = {
  caption: 14,
  body: 16,
  cardTitle: 18,
  sectionTitle: 20,
  subtitle: 22,
  hero: 26,
  display: 30,
  displayXL: 34,
} as const;

export const Type = {
  /** THE 14 floor — metadata, timestamps, hints, helper/error text, pill + chip labels. */
  caption: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 22 },
  /** 14 emphasized — field labels, section eyebrows (add letterSpacing at the site), active tab. */
  captionStrong: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 22 },
  /** Default reading text / paragraph copy. */
  body: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 26 },
  /** Emphasized body, list-row values, primary button label, inline links. */
  bodyStrong: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 26 },
  /** List-row + card/section-item titles. */
  cardTitle: { fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 28 },
  /** Section headings / group labels. */
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 30 },
  /** Sub-hero headings and large single stats. */
  subtitle: { fontFamily: FontFamily.bold, fontSize: 22, lineHeight: 32 },
  /** Screen hero heading. */
  hero: { fontFamily: FontFamily.bold, fontSize: 26, lineHeight: 38 },
  /** Flagship greeting / dashboard hero. */
  display: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 42 },
  /** Reserved oversized hero (additive; currently unused). */
  displayXL: { fontFamily: FontFamily.bold, fontSize: 34, lineHeight: 46 },
  /** Monospace / technical (invite codes, IDs) — raised to the 14 floor. */
  code: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 14, lineHeight: 21 },
} as const;

/**
 * 4-pt spacing scale. Names are historical (one = 4pt … six = 64pt); prefer the
 * scale over magic numbers everywhere.
 */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  /** Between-section rhythm — fills the 32→64 gap. Additive; opt-in per layout. */
  section: 40,
  six: 64,
} as const;

/**
 * Icon sizing scale (dp) for the centralized `<Icon>` component. `sm/md/lg`
 * deliberately match the existing GlyphChip glyph sizes (16/20/28) so the move
 * from text glyphs to vector icons is visually 1:1; `xl` is reserved for a
 * future Today-Home hero.
 */
export const IconSize = {
  sm: 16,
  md: 20,
  lg: 28,
  xl: 40,
} as const;

/**
 * Icon-chip DIAMETERS (dp) for the tinted feature/identity chips — distinct from
 * IconSize (the glyph that sits inside them). Geometry, identical in both themes.
 */
export const ChipSize = {
  xs: 28,
  sm: 36,
  md: 40,
  lg: 44,
  xl: 48,
} as const;

/**
 * Corner-radius scale — the Dar scale is 8 / 6 / 4 / 999 / 16. Cards, buttons and
 * inputs = 8 (the dominant radius, so the historical panel keys `sm/md/lg/card/xl`
 * all resolve to 8 and every consumer lands on the right value); `control` (6) =
 * small icon squares & inner controls (dose beads, status squares); `tiny` (4) =
 * tiny badges & status pills; `pill` (999) = pills, avatars, checkbox circles;
 * `sheet` (16) = bottom-sheet top corners. Do not invent radii.
 */
export const Radius = {
  sm: 8,
  md: 8,
  lg: 8,
  card: 8,
  xl: 8,
  control: 6,
  tiny: 4,
  sheet: 16,
  pill: 999,
} as const;

/**
 * Border widths — Dar draws **2px solid** borders on almost everything (`standard`);
 * small status pills and tiny badges use a `thin` 1.5px stroke. The old
 * `StyleSheet.hairlineWidth` edges are retired in the Dar restyle.
 */
export const BorderWidth = {
  thin: 1.5,
  standard: 2,
} as const;

/**
 * Flat elevation (Dar law) — cards are defined by their 2px `border`, not by a
 * shadow, in BOTH themes. This is a deliberate no-op kept so the single `Surface`
 * consumer (and any future spread of `CardShadow`) stays valid without a shadow.
 * Depth comes from the border + tint tones; overlays use a scrim, never lift.
 */
export const CardShadow = {} as object;

/**
 * Minimum / comfortable touch-target heights (dp). 48 is the accessibility floor
 * for older adults; primary controls use `comfortable`.
 */
export const TouchTarget = {
  min: 48,
  comfortable: 52,
} as const;

/** Phone horizontal gutter — consistent edge padding for full-width content. */
export const Gutter = 20;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
/**
 * On web the tab bar floats absolutely at the TOP of every tab screen (see
 * app-tabs.web.tsx), unlike native where it sits at the bottom. Add this to a
 * tab screen's top padding so its heading clears the floating web bar. 0 on
 * native, where the top is handled by the safe-area inset instead.
 */
export const TopTabInset = Platform.select({ web: Spacing.five }) ?? 0;
/** Max width for browsing/list content on tablet & web. */
export const MaxContentWidth = 720;
/** Narrower max width for form/settings layouts so they stay readable on web/tablet. */
export const MaxFormWidth = 480;

/**
 * Build an `rgba(r, g, b, a)` string from a `#RRGGBB` hex — used to derive the
 * low-opacity (0.08–0.22) tint fills/borders for category & status chips from the
 * ramp solids. Relocated here from the retired figma-tokens layer so tint
 * derivation has a home on the single token system.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
