import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'plain';
export type ButtonSize = 'md' | 'sm';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Optional leading text glyph (non-emoji, e.g. 'ï¼‹' on add actions) rendered
   * in the label color. Decorative â€” the label always carries the meaning.
   */
  glyph?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  accessibilityLabel?: string;
};

/**
 * The single button primitive across the care screens. Variants:
 *   - primary   â€” filled brand blue (the main action), darkens while pressed.
 *   - secondary â€” quiet warm-neutral fill (companion actions). Calm on both the
 *                 canvas and on cards; never a huge white slab in dark mode.
 *   - danger    â€” soft error-tinted fill with strong error text. Reads clearly
 *                 destructive yet stays visually + semantically separate from
 *                 save/confirm, without shouting.
 *   - plain     â€” text-only, brand-colored (low-emphasis tertiary actions).
 * Always meets the touch-target floor; labels stay legible in light & dark.
 * Cross-platform â€” no native-only APIs.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  glyph,
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<
    ButtonVariant,
    { background: string; pressed: string; border: string; text: string }
  > = {
    primary: {
      background: theme.primary,
      pressed: theme.primaryPressed,
      border: 'transparent',
      text: theme.onPrimary,
    },
    secondary: {
      background: theme.backgroundSelected,
      pressed: theme.border,
      border: 'transparent',
      text: theme.text,
    },
    danger: {
      background: theme.errorBg,
      pressed: theme.errorBg,
      border: theme.errorFg,
      text: theme.errorFg,
    },
    plain: {
      background: 'transparent',
      pressed: theme.backgroundSelected,
      border: 'transparent',
      text: theme.primaryText,
    },
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
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        {
          backgroundColor: pressed && !isDisabled ? colors.pressed : colors.background,
          borderColor: colors.border,
          opacity: isDisabled ? 0.45 : pressed && variant === 'danger' ? 0.75 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          {glyph ? (
            <ThemedText
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[size === 'sm' ? styles.glyphSm : styles.glyphMd, { color: colors.text }]}>
              {glyph}
            </ThemedText>
          ) : null}
          <ThemedText
            style={[size === 'sm' ? styles.labelSm : styles.labelMd, { color: colors.text }]}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: TouchTarget.comfortable, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four },
  sm: { minHeight: TouchTarget.min, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  labelMd: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  labelSm: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  glyphMd: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  glyphSm: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
});
