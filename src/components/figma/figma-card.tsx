import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FigmaCardProps = {
  children: ReactNode;
  /** Background tone: the card surface (default) or the recessed "elevated" well. */
  tone?: 'card' | 'elevated';
  /** Corner radius (default 24). */
  radius?: number;
  /** Inner padding (default 20). Pass 0 for none. */
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A flat card: a surface with a 1px hairline border and a large soft radius. Pass
 * `onPress` to make it tappable. (Phase B folds this into the shared `Surface`.)
 */
export function FigmaCard({
  children,
  tone = 'card',
  radius = Radius.xl,
  padding = 20,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: FigmaCardProps) {
  const c = useTheme();

  const base: ViewStyle = {
    backgroundColor: tone === 'elevated' ? c.backgroundSunken : c.backgroundElement,
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
        android_ripple={{ color: c.backgroundSunken }}
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
