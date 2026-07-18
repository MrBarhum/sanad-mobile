import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'eyebrow'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'sectionTitle'
    | 'cardTitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? (type === 'link' || type === 'linkPrimary' ? 'primaryText' : 'text')] },
        type === 'default' && styles.default,
        type === 'display' && styles.display,
        type === 'eyebrow' && styles.eyebrow,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'sectionTitle' && styles.sectionTitle,
        type === 'cardTitle' && styles.cardTitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.link,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * Type scale — sized for Arabic script (taller joins and diacritics need
 * roomier line-heights, ≈1.5×). Hierarchy comes from clear size AND weight
 * steps, never from shrinking text below the 14pt readability floor. Each
 * weight pins its exact font file plus the numeric weight, so text falls back
 * gracefully to the system font before assets load (or on platforms without
 * them).
 */
const styles = StyleSheet.create({
  small: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 400,
  },
  smallBold: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 600,
  },
  default: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: 400,
  },
  /**
   * Flagship hero step above `title`, for the future Today-Home greeting. Additive
   * — not used by any current screen; `title` remains the default screen heading.
   */
  display: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    lineHeight: 46,
    fontWeight: 700,
  },
  /** Small overline above a hero (e.g. "اليوم / TODAY"). Pair with a muted/accent color. */
  eyebrow: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  /** Screen-level greeting/hero. Was 48 — web-scaled; 30 is the mobile sweet spot. */
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 42,
    fontWeight: 700,
  },
  subtitle: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: 700,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 19,
    lineHeight: 30,
    fontWeight: 700,
  },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 17,
    lineHeight: 27,
    fontWeight: 600,
  },
  link: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    lineHeight: 28,
    fontWeight: 500,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 14,
  },
});
