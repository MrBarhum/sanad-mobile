import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/constants/icons';
import { FontFamily, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';
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
 * A distinct icon per tone so status is never communicated by color alone — the
 * shape carries meaning for low-vision / color-blind users, reinforced by the
 * always-present text label.
 */
const ICON_BY_TONE: Record<StatusTone, IconName> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
  neutral: 'dot',
};

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  /** Override the leading icon with another semantic icon (still shape-based). */
  iconName?: IconName;
  /**
   * Legacy escape hatch: render a literal text glyph instead of the tone icon.
   * Kept so existing call sites keep working; new code should use `iconName`.
   */
  glyph?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pill badge for a status (e.g. a medication dose "given", a task "done"). A soft
 * tinted background with a strong foreground, a bold tone icon and a text label —
 * legible in light & dark, never color-only, calm rather than loud.
 */
export function StatusBadge({ tone, label, iconName, glyph, style }: StatusBadgeProps) {
  const theme = useTheme();
  const fg = theme[FG_BY_TONE[tone]];
  const bg = theme[BG_BY_TONE[tone]];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]} accessibilityRole="text">
      {glyph ? (
        <ThemedText style={[styles.glyph, { color: fg }]}>{glyph}</ThemedText>
      ) : (
        <Icon name={iconName ?? ICON_BY_TONE[tone]} size={14} color={FG_BY_TONE[tone]} />
      )}
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
  glyph: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  label: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 19 },
});
