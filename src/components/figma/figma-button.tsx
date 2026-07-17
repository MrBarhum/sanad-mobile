import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
 * A filled teal primary (rounded), a quiet secondary (recessed + hairline), or a
 * filled danger. Bold label, ≥52dp tall, optional leading icon. (Phase B folds
 * this into the shared `Button`.)
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
  const c = useTheme();
  const isPrimary = variant === 'primary';
  // A PRIMARY action is ALWAYS a filled, full-opacity teal rectangle and stays
  // pressable unless busy — never grey/faded "disabled" styling (which reads as dim/
  // hidden). Form validation lives in the submit handler: pressing an incomplete
  // form shows inline errors instead of submitting. Only the quiet/danger variants
  // honor `disabled` (e.g. a busy sign-out), and a busy button keeps its vivid fill.
  const isDisabled = loading || (!isPrimary && disabled);
  const inactive = !isPrimary && disabled && !loading;

  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary, border: 'transparent' },
    secondary: { bg: c.backgroundSunken, fg: c.text, border: c.border },
    danger: { bg: c.dangerSolid, fg: c.onError, border: 'transparent' },
  };
  const p = palette[variant];
  const fg = inactive ? c.textSecondary : p.fg;

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
        inactive
          ? { backgroundColor: c.backgroundSunken, borderColor: c.border }
          : { backgroundColor: p.bg, borderColor: p.border, opacity: pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={18} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 16, fontFamily: FontFamily.bold },
});
