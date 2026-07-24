import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/constants/icons';
import { Radius, TouchTarget, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';
import { ThemedText } from './themed-text';

type IconButtonProps = {
  /** A semantic vector icon (preferred). */
  iconName?: IconName;
  /** Legacy: a glyph/emoji string. Decorative — meaning comes from accessibilityLabel. */
  icon?: string;
  /** REQUIRED: spoken label, since the control is icon-only. */
  accessibilityLabel: string;
  onPress: () => void;
  accessibilityHint?: string;
  /** Foreground (icon) theme color. Default 'text'. */
  color?: ThemeColor;
  /** Subtle filled background (default true) for a clear, tappable affordance. */
  filled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A square, accessible icon button that always meets the 48dp touch-target floor.
 * Use only for SECONDARY actions — primary operations use a labeled Button so the
 * action is never a tiny icon-only target (an accessibility requirement for older
 * users). The reference implementation of the icon-only-control pattern.
 */
export function IconButton({
  iconName,
  icon,
  accessibilityLabel,
  onPress,
  accessibilityHint,
  color = 'text',
  filled = true,
  disabled = false,
  style,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={8}
      android_ripple={{ color: theme.border }}
      style={[
        styles.button,
        filled && { backgroundColor: theme.backgroundSelected },
        disabled && styles.disabled,
        style,
      ]}>
      {iconName ? (
        <Icon name={iconName} size={20} color={color} />
      ) : icon ? (
        <ThemedText style={[styles.icon, { color: theme[color] }]}>{icon}</ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: TouchTarget.min,
    minHeight: TouchTarget.min,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  icon: { fontSize: 20, lineHeight: 24 },
  disabled: { opacity: 0.5 },
});
