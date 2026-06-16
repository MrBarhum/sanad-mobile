import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';

import { FigmaColors, FigmaLayout, FigmaRadius } from './figma-tokens';

type FigmaCardProps = {
  children: ReactNode;
  /** Background tone: the card surface (default) or the lifted "elevated" well. */
  tone?: 'card' | 'elevated';
  /** Corner radius (default 24 = Figma rounded-3xl). */
  radius?: number;
  /** Inner padding (default 20). Pass 0 for none. */
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The Figma exact-copy card: a flat surface with a 1px hairline border and a
 * large soft radius (no Sanad shadow rules). Pass `onPress` to make it tappable.
 * Mirrors the Figma screens' `rounded-2xl`/`rounded-3xl` bordered cards.
 */
export function FigmaCard({
  children,
  tone = 'card',
  radius = FigmaRadius.r24,
  padding = FigmaLayout.heroPadding,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: FigmaCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  const base: ViewStyle = {
    backgroundColor: tone === 'elevated' ? c.elevated : c.card,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        android_ripple={{ color: c.elevated }}
        style={({ pressed }) => [base, styles.clip, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }

  return <View style={[base, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  pressed: { opacity: 0.85 },
});
