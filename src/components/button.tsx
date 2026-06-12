import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'plain';
export type ButtonSize = 'md' | 'sm';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  accessibilityLabel?: string;
};

/**
 * The single button primitive across the care screens. Variants:
 *   - primary   — filled brand blue (the main action). Replaces the former
 *                 pure-black/white inversion so the call-to-action reads as a
 *                 calm, trustworthy button, not a stark block.
 *   - secondary — subtle filled with a hairline border (companion actions).
 *   - danger    — destructive outline in the error color (kept visually +
 *                 semantically separate from save/confirm).
 *   - plain     — text-only, brand-colored (low-emphasis tertiary actions).
 * Always meets the touch-target floor; labels stay legible in light & dark.
 * Cross-platform — no native-only APIs.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { background: string; border: string; text: string }> = {
    primary: { background: theme.primary, border: theme.primary, text: theme.onPrimary },
    secondary: { background: theme.backgroundElement, border: theme.border, text: theme.text },
    danger: { background: 'transparent', border: theme.errorFg, text: theme.errorFg },
    plain: { background: 'transparent', border: 'transparent', text: theme.primaryText },
  };
  const colors = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: colors.background, borderColor: colors.border, opacity: isDisabled ? 0.5 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <ThemedText style={[size === 'sm' ? styles.labelSm : styles.labelMd, { color: colors.text }]}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: TouchTarget.comfortable, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four },
  sm: { minHeight: TouchTarget.min, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  labelMd: { fontSize: 16, fontWeight: '700' },
  labelSm: { fontSize: 14, fontWeight: '700' },
});
