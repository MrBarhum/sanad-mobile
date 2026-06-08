import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

const DANGER = '#dc2626';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
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
};

/**
 * Themed pressable used across the care screens. Mirrors the inline button
 * styling already used on the auth/onboarding screens, but as one reusable
 * primitive with `primary` (filled), `secondary` (subtle), and `danger`
 * (destructive outline) variants. Cross-platform — no native-only APIs.
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
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { background: string; border: string; text: string }> = {
    primary: { background: theme.text, border: theme.text, text: theme.background },
    secondary: {
      background: theme.backgroundElement,
      border: theme.backgroundSelected,
      text: theme.text,
    },
    danger: { background: 'transparent', border: DANGER, text: DANGER },
  };
  const colors = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: colors.background, borderColor: colors.border, opacity: isDisabled ? 0.6 : 1 },
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
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: 52, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four },
  sm: { minHeight: 40, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  labelMd: { fontSize: 16, fontWeight: '600' },
  labelSm: { fontSize: 14, fontWeight: '600' },
});
