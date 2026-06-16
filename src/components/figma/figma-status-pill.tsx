import type { ComponentType } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FigmaFont, FigmaRadius, withAlpha } from './figma-tokens';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type FigmaStatusPillProps = {
  label: string;
  /** Status color (icon + label). */
  color: string;
  Icon: IconCmp;
  /**
   * Background. Default = a 12% tint of `color`. Pass a solid color (e.g. the
   * `mutedSurface` token) for pending/unlogged so it reads lighter, not tinted.
   */
  background?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A Figma status pill: a rounded-full chip with a status icon + text label on a
 * soft tint. Status is never color-only — the shape icon + label always carry the
 * meaning. Used for dose / task / appointment statuses across the Figma screens.
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
    borderRadius: FigmaRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 11, lineHeight: 16, fontFamily: FigmaFont.medium },
});
