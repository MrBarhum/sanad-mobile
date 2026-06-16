/**
 * Figma exact-copy token layer.
 *
 * Literal values lifted from the Figma Make export
 * (docs/figma/make-export/extracted/src/styles/theme.css + HomeScreen.tsx +
 * BottomNav.tsx). These power the Figma-faithful primitives under
 * `src/components/figma/*` and are DELIBERATELY independent of Sanad's
 * accessibility-tuned scale in `src/constants/theme.ts`. This phase is about
 * copying the Figma output as literally as possible — including its smaller type
 * and exact geometry — per the approved exact-copy plan
 * (docs/claude-reports/2026-06-16-figma-exact-copy-technical-plan.md).
 *
 * TYPEFACE: Figma exact-copy screens render in **Cairo** (loaded in the root
 * layout); legacy Sanad screens keep IBM Plex Sans Arabic until migrated.
 */

/** Exact Figma palette, dark (default) + light. */
export const FigmaColors = {
  dark: {
    background: '#0F0E0C',
    card: '#1A1916',
    /** Lifted nested surface (Figma "elevated"). */
    elevated: '#232019',
    text: '#EDE8DF',
    muted: '#8A837A',
    border: 'rgba(237, 232, 223, 0.07)',
    /** Care-ring track (un-filled portion). */
    ringTrack: 'rgba(237, 232, 223, 0.10)',
    primary: '#4BA898',
    onPrimary: '#0F0E0C',
    accent: '#C8904A',
    error: '#C45050',
    success: '#5AAE85',
  },
  light: {
    background: '#F7F3EE',
    card: '#FFFFFF',
    elevated: '#F7F3EE',
    text: '#1A1714',
    muted: '#6B6258',
    border: 'rgba(26, 23, 20, 0.08)',
    ringTrack: 'rgba(26, 23, 20, 0.08)',
    primary: '#2E8A7B',
    onPrimary: '#FFFFFF',
    accent: '#C8904A',
    error: '#C45050',
    success: '#4A9A75',
  },
} as const;

export type FigmaScheme = keyof typeof FigmaColors;

/** Per-feature category colors (Figma `--chart-*` ramp), used as icon-chip tints. */
export const FigmaCategory = {
  blue: '#5A8ABF',
  purple: '#8B6FA8',
  green: '#4A9A75',
  gold: '#C8904A',
  /** Teal: dark-mode primary / light-mode primary. */
  teal: '#4BA898',
  tealLight: '#2E8A7B',
} as const;

/** Corner radii (px) — Figma rounded-xl(12) / 2xl(16) / base(20) / 3xl(24) / pill. */
export const FigmaRadius = {
  r8: 8,
  r12: 12,
  r16: 16,
  r20: 20,
  r24: 24,
  pill: 999,
} as const;

/** Figma type scale (px). Intentionally smaller than Sanad's accessibility floor. */
export const FigmaFontSize = {
  xxs: 10,
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 15,
  body: 16,
  title: 18,
  lead: 20,
  stat: 22,
  hero: 26,
} as const;

/** Numeric weights present in the Figma design. */
export const FigmaWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/**
 * Cairo family names — the keys registered with `useFonts` in the root layout
 * (from `@expo-google-fonts/cairo`). Use these as `fontFamily` on Figma screens.
 */
export const FigmaFont = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extrabold: 'Cairo_800ExtraBold',
} as const;

/** Home / shell layout constants (px). */
export const FigmaLayout = {
  /** Horizontal screen gutter (Figma px-5). */
  gutter: 20,
  /** Hero card inner padding (Figma p-5). */
  heroPadding: 20,
  /** Round header action button (bell / emergency). */
  headerActionSize: 44,
  /** Tinted icon-chip diameters used across the Figma screens. */
  iconChip: { xs: 28, sm: 36, md: 40, lg: 44, xl: 48 },
} as const;

/** Care-loop ring geometry — copied verbatim from `HomeScreen.tsx` → `CareLoopArc`. */
export const FigmaRing = {
  size: 144,
  cx: 72,
  cy: 72,
  radius: 54,
  stroke: 10,
  /** Bottom gap (degrees) → the arc spans 360 - 60 = 300°. */
  gapAngle: 60,
  /** 90 + gapAngle/2 = 120°. */
  startAngle: 120,
} as const;

/**
 * Build an `rgba(r, g, b, a)` string from a `#RRGGBB` hex — the RN equivalent of
 * the Figma `${color}18` low-opacity tints used for icon chips / status pills.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
