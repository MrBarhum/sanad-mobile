import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
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
 * A distinct glyph per tone so status is never communicated by color alone — the
 * shape carries meaning for low-vision / color-blind users, reinforced by the
 * always-present text label.
 */
const GLYPH_BY_TONE: Record<StatusTone, string> = {
  success: '✓',
  warning: '!',
  error: '✕',
  info: 'i',
  neutral: '•',
};

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  /** Override the leading glyph (still shape-based, never color-only). */
  glyph?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pill badge for a status (e.g. a medication dose "given", a task "done"). Pairs a
 * soft tinted background, a strong foreground, a tone glyph and a text label so it
 * is legible in light & dark and never relies on color alone.
 */
export function StatusBadge({ tone, label, glyph, style }: StatusBadgeProps) {
  const theme = useTheme();
  const fg = theme[FG_BY_TONE[tone]];
  const bg = theme[BG_BY_TONE[tone]];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]} accessibilityRole="text">
      <View style={[styles.glyph, { borderColor: fg }]}>
        <ThemedText style={[styles.glyphText, { color: fg }]}>{glyph ?? GLYPH_BY_TONE[tone]}</ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ color: fg }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    alignSelf: 'flex-start',
  },
  glyph: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
});
