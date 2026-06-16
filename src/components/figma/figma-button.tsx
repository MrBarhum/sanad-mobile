import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';

import { FigmaColors, FigmaFont, FigmaRadius } from './figma-tokens';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Variant = 'primary' | 'secondary' | 'danger';

type FigmaButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  Icon?: IconCmp;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * The Figma button: a filled teal primary (rounded-2xl), a quiet secondary
 * (elevated + hairline), or a filled red danger. Cairo bold label, ≥52dp tall,
 * optional leading lucide icon. Matches the Figma sheet/save buttons.
 */
export function FigmaButton({
  label,
  onPress,
  variant = 'primary',
  Icon,
  disabled = false,
  loading = false,
  style,
  accessibilityHint,
}: FigmaButtonProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
  const isDisabled = disabled || loading;

  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary, border: 'transparent' },
    secondary: { bg: c.elevated, fg: c.text, border: c.border },
    danger: { bg: c.error, fg: '#FFFFFF', border: 'transparent' },
  };
  const p = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: p.bg, borderColor: p.border, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={18} color={p.fg} /> : null}
          <Text style={[styles.label, { color: p.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 16, fontFamily: FigmaFont.bold },
});
