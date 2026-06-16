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
    /** Quieter than textSecondary — metadata/timestamps only, never body text. */
    textMuted: '#8A837A',
    background: '#F7F3EE',
    backgroundElement: '#FFFFFF',
    /** Pressed/selected fill — a step deeper than backgroundSunken (derived). */
    backgroundSelected: '#E4DDCE',
    /** Recessed wells INSIDE cards + input fields (Figma Make input/secondary tone). */
    backgroundSunken: '#EDE8DF',
    border: '#E1DDD8',
    /** Softer than border — separators between rows inside one surface. */
    divider: '#ECE7DF',

    // Brand — one confident teal (Figma Make parity; was brand blue #1B5FBE).
    primary: '#2E8A7B',
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
    onAccent: '#FFFFFF', // text/icon on accentSolid
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
    categoryGold: '#C8904A',
    categoryTeal: '#2E8A7B',
  },
  dark: {
    // Warm graphite — near-black canvas, lifted cards (Figma Make parity).
    text: '#EDE8DF',
    textSecondary: '#ACA89D',
    textMuted: '#8A837A',
    background: '#0F0E0C',
    backgroundElement: '#1A1916',
    backgroundSelected: '#322E27',
    backgroundSunken: '#26231E',
    border: '#2E2A24',
    divider: '#211F1B',

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
