import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/constants/icons';
import { BorderWidth, FontFamily, Radius, TouchTarget, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'plain';
export type ButtonSize = 'md' | 'sm';

/** Icon tint per variant — mirrors each variant's label color, as a theme token. */
const ICON_COLOR: Record<ButtonVariant, ThemeColor> = {
  primary: 'onPrimary',
  secondary: 'text',
  danger: 'errorFg',
  plain: 'primaryText',
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconName?: IconName;
  /** Legacy leading text glyph. Kept for existing call sites; prefer `iconName`. */
  glyph?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  accessibilityLabel?: string;
};

/**
 * The single Dar button primitive. Variants:
 *   - primary   — `btn` fill + `btnInk`, 2px `line` border, radius 8 (the main action).
 *   - secondary — `card` fill + 2px `line` border + `ink` text (companion actions).
 *   - danger    — `card` fill + 2px `err` border + `err` text (restrained destructive).
 *   - plain     — text-only, `acc`, underlined (low-emphasis tertiary actions).
 * Always meets the touch-target floor; labels stay legible in light & dark.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  iconName,
  glyph,
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
  accessibilityLabel,
}: ButtonProps) {
  const c = useTheme();
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { background: string; pressed: string; border: string; text: string }> = {
    primary: { background: c.primary, pressed: c.primaryPressed, border: c.border, text: c.onPrimary },
    secondary: { background: c.backgroundElement, pressed: c.backgroundSunken, border: c.border, text: c.text },
    danger: { background: c.backgroundElement, pressed: c.errorBg, border: c.errorFg, text: c.errorFg },
    plain: { background: 'transparent', pressed: c.backgroundSelected, border: 'transparent', text: c.primaryText },
  };
  const colors = palette[variant];
  const fadedDisabled = !isPrimary && isDisabled;
  const iconColor: ThemeColor = ICON_COLOR[variant];
  const labelSize = size === 'sm' ? 15 : variant === 'plain' ? 15 : isPrimary ? 17 : 16;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={{ color: colors.pressed }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        variant === 'plain' && styles.plain,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: variant === 'plain' ? 0 : BorderWidth.standard,
          opacity: fadedDisabled ? 0.45 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          {iconName ? <Icon name={iconName} size={size === 'sm' ? 16 : 18} color={iconColor} /> : null}
          {glyph && !iconName ? (
            <Text accessibilityElementsHidden style={[styles.glyph, { color: colors.text }]}>
              {glyph}
            </Text>
          ) : null}
          <Text
            style={[
              { fontFamily: FontFamily.bold, fontSize: labelSize, color: colors.text },
              variant === 'plain' && styles.plainLabel,
            ]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: TouchTarget.comfortable, paddingVertical: 13, paddingHorizontal: 24 },
  sm: { minHeight: TouchTarget.min, paddingVertical: 8, paddingHorizontal: 16 },
  plain: { minHeight: 0, paddingVertical: 4, paddingHorizontal: 4 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  glyph: { fontSize: 17, fontFamily: FontFamily.bold },
  plainLabel: { textDecorationLine: 'underline' },
});
