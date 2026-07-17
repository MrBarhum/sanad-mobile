import type { ComponentType } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily, Radius, withAlpha } from '@/constants/theme';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type FigmaStatusPillProps = {
  label: string;
  /** Status color (icon + label). */
  color: string;
  Icon: IconCmp;
  /**
   * Background. Default = a 12% tint of `color`. Pass a solid color (e.g. the
   * `backgroundSunken` token) for pending/unlogged so it reads lighter, not tinted.
   */
  background?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A status pill: a rounded-full chip with a status icon + text label on a soft
 * tint. Status is never color-only — the shape icon + label always carry the
 * meaning. Used for dose / task / appointment statuses across the screens.
 */
export function FigmaStatusPill({ label, color, Icon, background, style }: FigmaStatusPillProps) {
  return (
    <View
      style={[styles.pill, { backgroundColor: background ?? withAlpha(color, 0.12) }, style]}
      accessibilityRole="text">
      <Icon size={12} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  // Status text carries meaning (status = icon + text + color) — keep it legible
  // for older readers at the 14 floor.
  label: { fontSize: 14, lineHeight: 18, fontFamily: FontFamily.medium },
});
