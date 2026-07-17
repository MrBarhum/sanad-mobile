import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';

export type FormButtonVariant = 'primary' | 'secondary' | 'danger' | 'plain';
export type FormButtonSize = 'md' | 'sm';

type FormButtonProps = {
  label: string;
  onPress: () => void;
  variant?: FormButtonVariant;
  size?: FormButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  accessibilityLabel?: string;
};

/**
 * The IBM Plex button for the reskinned shared form / picker primitives (MS-0).
 *
 * A behavior-faithful re-skin of the legacy `Button`: identical variants
 * (primary filled teal · secondary quiet elevated+hairline · danger soft
 * error-tint with strong error text · plain text-only teal), sizes, loading /
 * disabled handling, pressed feedback and accessibility. It reads its colors from
 * the same theme (already the Figma teal / warm-graphite palette) so it sits
 * coherently next to the other reskinned primitives, and differs from the legacy
 * `Button` ONLY by rendering its label in **IBM Plex** (the Figma typeface) on the
 * Figma rounded-xl radius. The legacy `Button` is left untouched for the
 * already-migrated center screens that consume it.
 */
export function FormButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
  accessibilityLabel,
}: FormButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  // A PRIMARY form CTA is ALWAYS a filled, full-opacity teal rectangle and stays
  // pressable unless busy — never grey/faded "disabled" styling. Validation runs in
  // the submit handler: pressing an incomplete form shows inline field errors, it
  // does not submit. Only the secondary/cancel and danger variants honor `disabled`.
  const isDisabled = loading || (!isPrimary && disabled);
  const fadedDisabled = !isPrimary && disabled && !loading;

  const palette: Record<
    FormButtonVariant,
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
      border: theme.border,
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
          opacity: fadedDisabled ? 0.45 : pressed && variant === 'danger' ? 0.75 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          <ThemedText style={[size === 'sm' ? styles.labelSm : styles.labelMd, { fontFamily: FontFamily.semibold }, { color: colors.text }]}>
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
    borderRadius: Radius.md, // 12 — Figma rounded-xl button
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: TouchTarget.comfortable, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four },
  sm: { minHeight: TouchTarget.min, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  labelMd: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  labelSm: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
});
