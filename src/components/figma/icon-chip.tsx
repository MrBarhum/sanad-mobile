import type { ComponentType } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FigmaLayout, FigmaRadius, withAlpha } from './figma-tokens';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type IconChipProps = {
  /** A lucide-react-native icon component. */
  Icon: IconCmp;
  /** The chip's accent color (icon color + low-opacity tint background). */
  color: string;
  /** Chip diameter (default 40 — Figma's quick-action chip). */
  size?: number;
  /** Icon glyph size (default 20). */
  iconSize?: number;
  /** Corner radius (default 12 — rounded-xl; pass `FigmaRadius.pill` for a circle). */
  radius?: number;
  /** Background tint opacity (default 0.14 ≈ the Figma `${color}18`). */
  tintOpacity?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A tinted icon chip — the Figma idiom of a lucide icon inside a soft, low-opacity
 * tint of its own (often per-feature category) color. Decorative; pair with a
 * visible text label at the call site.
 */
export function IconChip({
  Icon,
  color,
  size = FigmaLayout.iconChip.md,
  iconSize = 20,
  radius = FigmaRadius.r12,
  tintOpacity = 0.14,
  style,
}: IconChipProps) {
  return (
    <View
      style={[
        styles.chip,
        { width: size, height: size, borderRadius: radius, backgroundColor: withAlpha(color, tintOpacity) },
        style,
      ]}>
      <Icon size={iconSize} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
});
