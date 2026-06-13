import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CardShadow, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type SurfaceTone =
  | 'card'
  | 'sunken'
  | 'selected'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

const BG_BY_TONE: Record<SurfaceTone, ThemeColor> = {
  card: 'backgroundElement',
  sunken: 'backgroundSunken',
  selected: 'backgroundSelected',
  primary: 'primaryBg',
  accent: 'accentBg',
  success: 'successBg',
  warning: 'warningBg',
  error: 'errorBg',
  info: 'infoBg',
};

type SurfaceProps = {
  children?: ReactNode;
  tone?: SurfaceTone;
  /** Inner padding (default Spacing.four). Pass false for none. */
  padded?: boolean;
  /** Hairline border for definition against the canvas (default true). */
  bordered?: boolean;
  /** Corner radius (default Radius.card). */
  radius?: number;
  /** Makes the whole surface a button. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Forwarded to accessibilityState (e.g. a selected option card). */
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A themed container surface â€” the one card/panel primitive used across the app.
 * Cards get a whisper-soft shadow in light mode (dark mode separates by lifted
 * background + hairline border instead). Pass `onPress` to make it a pressable
 * card â€” Android gets a native ripple, other platforms a gentle opacity dip.
 */
export function Surface({
  children,
  tone = 'card',
  padded = true,
  bordered = true,
  radius = Radius.card,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  selected,
  disabled = false,
  style,
  testID,
}: SurfaceProps) {
  const theme = useTheme();
  const scheme = useColorScheme();

  const base: ViewStyle = {
    backgroundColor: theme[BG_BY_TONE[tone]],
    borderRadius: radius,
    borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
    borderColor: theme.border,
  };
  // Depth only where it helps: plain cards on the light canvas. Tinted and
  // sunken tones stay flat so the hierarchy keeps a single elevation step.
  const elevated = tone === 'card' && scheme !== 'dark';
  const content = [base, elevated && CardShadow, padded && styles.padded, style];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, selected }}
        testID={testID}
        android_ripple={{ color: theme.backgroundSelected, foreground: true }}
        style={({ pressed }) => [
          content,
          // Ripple handles Android feedback; clip it to the rounded corners.
          Platform.OS === 'android' && styles.rippleClip,
          pressed && Platform.OS !== 'android' && styles.pressed,
          disabled && styles.disabled,
        ]}>
        {children}
      </Pressable>
    );
  }

  return (
    <View style={content} testID={testID}>
      {children}
    </View>
  );
}

/** A card is just the default surface â€” kept as a named alias for intent. */
export function Card(props: SurfaceProps) {
  return <Surface {...props} />;
}

type SectionProps = {
  title?: string;
  /** Optional trailing element on the heading row (e.g. a small action). */
  action?: ReactNode;
  children: ReactNode;
  /** Gap between the heading and the body content (default Spacing.three). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A titled section: an accessible heading row plus its content, with consistent
 * spacing. Use to group related content on a screen.
 */
export function Section({ title, action, children, gap = Spacing.three, style }: SectionProps) {
  return (
    <View style={[{ gap }, style]}>
      {title || action ? (
        <View style={styles.header}>
          {title ? (
            <ThemedText type="sectionTitle" accessibilityRole="header" style={styles.headerTitle}>
              {title}
            </ThemedText>
          ) : (
            <View style={styles.headerTitle} />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { padding: Spacing.four },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  rippleClip: { overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerTitle: { flexShrink: 1 },
});
