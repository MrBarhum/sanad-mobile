/**
 * Sanad design tokens — a single source of truth for color, type, spacing,
 * radius, elevation and touch-target sizing.
 *
 * Visual direction: "Warm Care OS" — a calm, premium, Arabic-first family-care
 * interface. Identity comes from typography (IBM Plex Sans Arabic), warm-neutral
 * canvases (never flat white / pure black), one confident teal brand, a soft sand
 * accent, and per-feature category tints — not from gradients, heavy shadows or
 * decoration. Tuned for older adults and family caregivers: large targets, strong
 * contrast, status is never color-only. Light and dark are full peers.
 *
 * Phase A (Figma Make parity, 2026-06-16): the palette was re-pointed from the
 * prior brand blue to the Figma Make teal / porcelain / graphite direction (values
 * derived from docs/figma/make-export/extracted/src/styles/theme.css), and a
 * 5-step category color ramp (categoryBlue/Purple/Green/Gold/Teal) was added for
 * feature-identity icon chips. Token KEYS are unchanged — only values changed and
 * the ramp was appended — so every existing consumer keeps working. Rationale +
 * the few derived (non-1:1) values are documented in
 * docs/claude-reports/2026-06-16-figma-phase-a-token-icon-alignment.md.
 *
 * Existing token keys (text/background/backgroundElement/backgroundSelected/
 * textSecondary/border/primary/onPrimary/primaryBg/primaryText/semantic Fg+Bg,
 * Spacing, MaxContentWidth, MaxFormWidth, Fonts, BottomTabInset, TopTabInset,
 * Radius, TouchTarget, Gutter) are preserved so every consumer keeps working;
 * the rest is additive (textMuted, backgroundSunken, divider, primaryPressed,
 * accentFg/Bg, overlay, FontFamily, CardShadow, category* ramp).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Surfaces & text — warm porcelain canvas, white cards, warm hairlines.
    text: '#1A1714',
    textSecondary: '#6B6258',
    /** Quieter than textSecondary — metadata/timestamps only, never body text.
     * Darkened #8A837A → #6D6760 so it clears AA 4.5:1 even on the deepest light
     * well (backgroundSunken) — kills the documented grey-on-grey failure. */
    textMuted: '#6D6760',
    background: '#F7F3EE',
    backgroundElement: '#FFFFFF',
    /** Pressed/selected fill — a step deeper than backgroundSunken (derived). */
    backgroundSelected: '#E4DDCE',
    /** Recessed wells INSIDE cards + input fields (Figma Make input/secondary tone). */
    backgroundSunken: '#EDE8DF',
    border: '#E1DDD8',
    /** Softer than border — separators between rows inside one surface. */
    divider: '#ECE7DF',
    /** Care-loop ring un-filled track (decorative SVG stroke; contrast N/A). */
    ringTrack: 'rgba(26, 23, 20, 0.08)',

    // Brand — one confident teal (Figma Make parity; was brand blue #1B5FBE).
    // Nudged darker #2E8A7B → #2A7F71 so white onPrimary clears AA 4.5:1 on the
    // filled primary button (was 4.17). Same teal identity, generous contrast.
    primary: '#2A7F71',
    primaryPressed: '#256F63',
    onPrimary: '#FFFFFF',
    primaryBg: '#EAF3F1', // tinted teal surface (chips/links/active)
    primaryText: '#1F6E60', // darker teal so brand text clears AA on porcelain

    // Warm sand accent — reserved for "today/highlight" moments, used sparingly.
    accentFg: '#8A5A17',
    accentBg: '#F4E9D5',

    // Semantic foregrounds (text + icon) and soft backgrounds (badges/surfaces)
    successFg: '#1F7A4D',
    successBg: '#E4F1EA',
    warningFg: '#9A5B00',
    warningBg: '#F6EBD7',
    errorFg: '#B5403F',
    errorBg: '#F7E5E3',
    infoFg: '#3E6FA0',
    infoBg: '#E7EEF7',

    // Filled-status foregrounds + a second surface lift. The filled-status fgs are
    // still UNUSED by screens; kept key-symmetric for the ThemeColor type.
    accentSolid: '#C8904A', // Figma Make gold accent fill
    accentText: '#7A4E12', // sand text/eyebrow on the canvas (AA)
    onAccent: '#2A1D05', // dark text on the gold accentSolid fill (white failed AA at 2.78)
    dangerSolid: '#C45050', // softer Figma Make destructive fill (NOT the bell badge red #D92D20)
    onError: '#FFFFFF',
    onSuccess: '#FFFFFF',
    onWarning: '#2A1D05', // dark text reads on a solid amber
    backgroundRaised: '#FFFFFF', // second elevation step (light lifts via shadow)

    /** Modal scrim. */
    overlay: 'rgba(26, 23, 20, 0.45)',

    // Per-feature category ramp (Figma Make chart palette) — used as <Icon> tint
    // colors for feature/medication identity chips. Low-opacity tint backgrounds
    // are derived at consume time (Phase B), so only the 5 solids live here.
    categoryBlue: '#5A8ABF',
    categoryPurple: '#8B6FA8',
    categoryGreen: '#4A9A75',
    categoryGold: '#BA8645', // darkened from #C8904A so the icon tint clears 3:1 UI on a card
    categoryTeal: '#2E8A7B',
  },
  dark: {
    // Warm graphite — near-black canvas, lifted cards (Figma Make parity).
    text: '#EDE8DF',
    textSecondary: '#ACA89D',
    /** Lightened #8A837A → #908981 so metadata clears AA 4.5:1 on dark sunken wells. */
    textMuted: '#908981',
    background: '#0F0E0C',
    backgroundElement: '#1A1916',
    backgroundSelected: '#322E27',
    backgroundSunken: '#26231E',
    border: '#2E2A24',
    divider: '#211F1B',
    /** Care-loop ring un-filled track (decorative SVG stroke; contrast N/A). */
    ringTrack: 'rgba(237, 232, 223, 0.10)',

    primary: '#4BA898',
    primaryPressed: '#3E9384',
    onPrimary: '#0F0E0C', // dark text on the lighter dark-mode teal (Figma Make)
    primaryBg: '#1C2D29',
    primaryText: '#7AC8BA',

    accentFg: '#DDAF63',
    accentBg: '#34291A',

    successFg: '#5AAE85',
    successBg: '#16291F',
    warningFg: '#D9A24A',
    warningBg: '#332813',
    errorFg: '#E07A78',
    errorBg: '#3A1E1C',
    infoFg: '#7FA8D8',
    infoBg: '#1B2738',

    // Filled-status foregrounds — see the light palette. Light fills in dark mode
    // take dark on* text; still UNUSED by screens, kept key-symmetric.
    accentSolid: '#C8904A',
    accentText: '#E2B872',
    onAccent: '#0F0E0C',
    dangerSolid: '#C45050',
    onError: '#FFFFFF',
    onSuccess: '#0F0E0C',
    onWarning: '#2A1D05',
    backgroundRaised: '#232019', // second lift (Figma Make elevated nested-well)

    overlay: 'rgba(0, 0, 0, 0.55)',

    categoryBlue: '#6A9ACC',
    categoryPurple: '#9B7FC0',
    categoryGreen: '#5AAE85',
    categoryGold: '#C8904A',
    categoryTeal: '#4BA898',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * App typeface — IBM Plex Sans Arabic (SIL OFL, bundled in assets/fonts, loaded
 * once in the root layout via expo-font). One family carries Arabic AND Latin so
 * mixed content (medication names, emails) stays harmonious. Static weight files
 * → each weight is its own family name; pair with the matching numeric
 * fontWeight so platforms without the file (or before load) fall back cleanly to
 * the system font at the right weight.
 */
export const FontFamily = {
  regular: 'IBMPlexSansArabic-Regular',
  medium: 'IBMPlexSansArabic-Medium',
  semibold: 'IBMPlexSansArabic-SemiBold',
  bold: 'IBMPlexSansArabic-Bold',
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
 * matching IBM Plex family into ready-to-spread TextStyle presets. Prefer
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

/** Corner-radius scale. `card` is the standard panel radius; `pill` a stadium. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 20,
  xl: 24,
  pill: 999,
} as const;

/**
 * Whisper-soft card elevation for LIGHT mode only — dark mode separates surfaces
 * by lifted background + hairline border instead (shadows read as smears on a
 * dark canvas). Keep opacity ≤0.07: depth should be felt, not seen.
 */
export const CardShadow = Platform.select({
  web: {
    boxShadow: '0 2px 10px rgba(40, 36, 26, 0.06)',
  },
  default: {
    shadowColor: '#28241A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
}) as object;

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
