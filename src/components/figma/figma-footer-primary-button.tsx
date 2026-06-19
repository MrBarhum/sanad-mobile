import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type FigmaFooterPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  /** Shows a spinner and blocks the press while a submit is in flight. */
  loading?: boolean;
  accessibilityHint?: string;
};

/**
 * THE single primary CTA for every add / save / create form. It is rendered as the
 * last block of the form BODY (the FigmaFormScreen `footer` prop path did not render
 * on the Android device — see docs/claude-reports/2026-06-19-*).
 *
 * Implementation note: this is a PLAIN React Native `Pressable` — the exact shape a
 * raw runtime test on /tasks/new proved visible on device, where the previous
 * (otherwise near-identical) implementation did not appear. So it deliberately
 * avoids the extras the previous version carried (a function-form `style`,
 * `overflow:'hidden'`, `numberOfLines`, and a custom `fontFamily`): a full-width,
 * 56dp (Sanad primary-action floor; Figma's save CTA is 52dp), radius-12 (Figma
 * rounded-xl) filled Sanad-teal rectangle with a high-contrast centered label, in
 * light AND dark mode.
 *
 * It takes NO `variant`, `disabled`, or `style` prop, so a caller can't collapse it
 * to faint/grey text, and there is NO disabled state for validation-incomplete forms
 * — the caller's submit handler validates and shows inline errors while this stays a
 * visible green button. The only state is `loading`: a high-contrast spinner that
 * also blocks double-submit. Colors come from `useTheme()` (theme.primary fill /
 * theme.onPrimary label) so the fill matches the rest of the screen.
 */
export function FigmaFooterPrimaryButton({
  label,
  onPress,
  loading = false,
  accessibilityHint,
}: FigmaFooterPrimaryButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading }}
      style={[styles.button, { backgroundColor: theme.primary }]}>
      {loading ? (
        <ActivityIndicator color={theme.onPrimary} />
      ) : (
        <Text style={[styles.label, { color: theme.onPrimary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
