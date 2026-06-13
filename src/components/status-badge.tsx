import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const FG_BY_TONE: Record<StatusTone, ThemeColor> = {
  success: 'successFg',
  warning: 'warningFg',
  error: 'errorFg',
  info: 'infoFg',
  neutral: 'textSecondary',
};

const BG_BY_TONE: Record<StatusTone, ThemeColor> = {
  success: 'successBg',
  warning: 'warningBg',
  error: 'errorBg',
  info: 'infoBg',
  neutral: 'backgroundSelected',
};

/**
 * A distinct glyph per tone so status is never communicated by color alone â€” the
 * shape carries meaning for low-vision / color-blind users, reinforced by the
 * always-present text label.
 */
const GLYPH_BY_TONE: Record<StatusTone, string> = {
  success: 'âœ“',
  warning: '!',
  error: 'âœ•',
  info: 'i',
  neutral: 'â€¢',
};

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  /** Override the leading glyph (still shape-based, never color-only). */
  glyph?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pill badge for a status (e.g. a medication dose "given", a task "done"). A soft
 * tinted background with a strong foreground, a bold tone glyph and a text label â€”
 * legible in light & dark, never color-only, calm rather than loud.
 */
export function StatusBadge({ tone, label, glyph, style }: StatusBadgeProps) {
  const theme = useTheme();
  const fg = theme[FG_BY_TONE[tone]];
  const bg = theme[BG_BY_TONE[tone]];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]} accessibilityRole="text">
      <ThemedText style={[styles.glyph, { color: fg }]}>{glyph ?? GLYPH_BY_TONE[tone]}</ThemedText>
      <ThemedText style={[styles.label, { color: fg }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.one,
    alignSelf: 'flex-start',
  },
  glyph: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  label: { fontFamily: FontFamily.semibold, fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
});
