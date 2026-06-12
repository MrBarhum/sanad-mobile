/**
 * Sanad design tokens — a single source of truth for color, spacing, radius,
 * typography and touch-target sizing. Arabic-first, calm & trustworthy, tuned for
 * older adults and family caregivers (large targets, strong contrast, never
 * color-only). Light and dark are full peers.
 *
 * Existing token keys (text/background/backgroundElement/backgroundSelected/
 * textSecondary, Spacing, MaxContentWidth, MaxFormWidth, Fonts, BottomTabInset,
 * TopTabInset) are preserved so every current consumer keeps working; the rest is
 * additive (brand, semantic, border, Radius, TouchTarget, Gutter).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Surfaces & text
    text: '#14161A',
    textSecondary: '#586070',
    background: '#F4F6F9', // soft canvas so cards float
    backgroundElement: '#FFFFFF', // cards / inputs
    backgroundSelected: '#E7EAF0',
    border: '#DCE0E7',

    // Brand
    primary: '#1B63C5',
    onPrimary: '#FFFFFF',
    primaryBg: '#E9F0FB', // tinted primary surface (links/info chips)
    primaryText: '#1B5BB5', // brand-colored text on a normal surface

    // Semantic foregrounds (text + icon) and soft backgrounds (badges/surfaces)
    successFg: '#1A7A43',
    successBg: '#E4F3EA',
    warningFg: '#A85B00',
    warningBg: '#FAEEDB',
    errorFg: '#C42B2B',
    errorBg: '#FBE7E7',
    infoFg: '#1B5BB5',
    infoBg: '#E9F0FB',
  },
  dark: {
    text: '#F3F5F7',
    textSecondary: '#A8ADB7',
    background: '#0B0C0F',
    backgroundElement: '#191B20',
    backgroundSelected: '#272A31',
    border: '#2C2F37',

    primary: '#2768CC',
    onPrimary: '#FFFFFF',
    primaryBg: '#16263F',
    primaryText: '#8FB8F0',

    successFg: '#46C078',
    successBg: '#12311F',
    warningFg: '#E0982F',
    warningBg: '#33260E',
    errorFg: '#F26464',
    errorBg: '#3A1A1A',
    infoFg: '#8FB8F0',
    infoBg: '#16263F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
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
  six: 64,
} as const;

/** Corner-radius scale. `pill` rounds to a stadium/circle. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

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
