/**
 * Sanad design tokens — a single source of truth for color, type, spacing,
 * radius, elevation and touch-target sizing.
 *
 * Visual direction: "Warm Care OS" — a calm, premium, Arabic-first family-care
 * interface. Identity comes from typography (IBM Plex Sans Arabic), warm-neutral
 * canvases (never flat white / pure black), one confident brand blue, and soft
 * tinted anchors — not from gradients, heavy shadows or decoration. Tuned for
 * older adults and family caregivers: large targets, strong contrast, status is
 * never color-only. Light and dark are full peers.
 *
 * Existing token keys (text/background/backgroundElement/backgroundSelected/
 * textSecondary/border/primary/onPrimary/primaryBg/primaryText/semantic Fg+Bg,
 * Spacing, MaxContentWidth, MaxFormWidth, Fonts, BottomTabInset, TopTabInset,
 * Radius, TouchTarget, Gutter) are preserved so every consumer keeps working;
 * the rest is additive (textMuted, backgroundSunken, divider, primaryPressed,
 * accentFg/Bg, overlay, FontFamily, CardShadow).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Surfaces & text — warm porcelain canvas, white cards, warm hairlines.
    text: '#1D1B16',
    textSecondary: '#5C594F',
    /** Quieter than textSecondary — metadata/timestamps only, never body text. */
    textMuted: '#767266',
    background: '#F6F4EF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#ECE9E1',
    /** Recessed wells INSIDE cards (picker wheels, code blocks, quiet rows). */
    backgroundSunken: '#F3F1EB',
    border: '#E2DFD6',
    /** Softer than border — separators between rows inside one surface. */
    divider: '#ECE9E2',

    // Brand — one confident, calm blue (kept compatible with the app icon).
    primary: '#1B5FBE',
    primaryPressed: '#164E9D',
    onPrimary: '#FFFFFF',
    primaryBg: '#E8EFFA', // tinted primary surface (chips/links/info)
    primaryText: '#17549F', // brand-colored text on a normal surface

    // Warm sand accent — reserved for "today/highlight" moments, used sparingly.
    accentFg: '#8A5A17',
    accentBg: '#F5EBD8',

    // Semantic foregrounds (text + icon) and soft backgrounds (badges/surfaces)
    successFg: '#1A7A43',
    successBg: '#E3F2E7',
    warningFg: '#9A5B00',
    warningBg: '#F8EDD8',
    errorFg: '#BE2E2E',
    errorBg: '#FAE7E4',
    infoFg: '#17549F',
    infoBg: '#E8EFFA',

    // Additive foundation tokens — a "today/now" accent ramp, filled-status
    // foregrounds and a second surface lift. Currently UNUSED: they exist so the
    // upcoming Today-Home hero, the signature care ring and filled controls have
    // tokens to reference. Not applied to any existing screen in this phase.
    accentSolid: '#B97A1E', // saturated sand for a "today/now" fill
    accentText: '#7A4E12', // sand text/eyebrow on the canvas (AA)
    onAccent: '#FFFFFF', // text/icon on accentSolid
    dangerSolid: '#D92D20', // saturated destructive fill (also the bell badge red)
    onError: '#FFFFFF',
    onSuccess: '#FFFFFF',
    onWarning: '#2A1D05', // dark text reads on a solid amber
    backgroundRaised: '#FFFFFF', // second elevation step (light lifts via shadow)

    /** Modal scrim. */
    overlay: 'rgba(29, 27, 22, 0.45)',
  },
  dark: {
    // Warm graphite — lifted cards, never pure black.
    text: '#F4F2EC',
    textSecondary: '#ACA89D',
    textMuted: '#8B877C',
    background: '#151412',
    backgroundElement: '#201F1B',
    backgroundSelected: '#2C2A25',
    backgroundSunken: '#1B1A17',
    border: '#353329',
    divider: '#272520',

    primary: '#2F6FD0',
    primaryPressed: '#275FB4',
    onPrimary: '#FFFFFF',
    primaryBg: '#1D2B42',
    primaryText: '#96BEF5',

    accentFg: '#DDAF63',
    accentBg: '#352A17',

    successFg: '#4DC07D',
    successBg: '#152F20',
    warningFg: '#E2A23E',
    warningBg: '#332813',
    errorFg: '#EF6F6B',
    errorBg: '#3A1D1B',
    infoFg: '#96BEF5',
    infoBg: '#1D2B42',

    // Additive foundation tokens — see the light palette for intent. Unused in
    // this phase; present so light/dark stay key-symmetric (required by the
    // `ThemeColor` type below).
    accentSolid: '#C8923C',
    accentText: '#E2B872',
    onAccent: '#1A1408',
    dangerSolid: '#E5564D',
    onError: '#FFFFFF',
    onSuccess: '#FFFFFF',
    onWarning: '#2A1D05',
    backgroundRaised: '#26241F', // second lift above backgroundElement on graphite

    overlay: 'rgba(0, 0, 0, 0.55)',
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
