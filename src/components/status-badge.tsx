import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/constants/icons';
import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
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

/** The Dar status pill carries a soft tone TINT fill behind the stroke + label. */
const BG_BY_TONE: Record<StatusTone, ThemeColor> = {
  success: 'successBg',
  warning: 'warningBg',
  error: 'errorBg',
  info: 'infoBg',
  neutral: 'backgroundSunken',
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
  /** Legacy escape hatch: a literal text glyph instead of the tone icon. */
  glyph?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The Dar status pill: a soft tone tint fill behind a 1.5px stroke in the tone
 * color, radius 4, a tone icon + a 14/700 label — icon + text (never color-only),
 * calm rather than loud. Matches the dose / task status pills exactly.
 */
export function StatusBadge({ tone, label, iconName, glyph, style }: StatusBadgeProps) {
  const c = useTheme();
  const fg = c[FG_BY_TONE[tone]];

  return (
    <View
      style={[styles.badge, { borderColor: fg, backgroundColor: c[BG_BY_TONE[tone]] }, style]}
      accessibilityRole="text">
      {glyph ? (
        <ThemedText style={[styles.glyph, { color: fg }]}>{glyph}</ThemedText>
      ) : (
        <Icon name={iconName ?? ICON_BY_TONE[tone]} size={12} color={FG_BY_TONE[tone]} />
      )}
      <ThemedText style={[styles.label, { color: fg }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: BorderWidth.thin,
    borderRadius: Radius.tiny,
    paddingVertical: 2,
    paddingHorizontal: 9,
    alignSelf: 'flex-start',
  },
  glyph: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  label: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 19 },
});
