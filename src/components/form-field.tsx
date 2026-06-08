import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

const DANGER = '#dc2626';

type FormFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

/**
 * Labeled, themed text input used by the care forms. Mirrors the input styling
 * on the auth/onboarding screens and adds an inline label + optional error.
 * Direction follows the app's RTL/LTR setting (no hardcoded textAlign), so
 * Arabic content aligns to the start automatically. Pass `multiline` for notes
 * fields. All standard TextInput props pass through.
 */
export function FormField({ label, error, style, multiline, ...rest }: FormFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: error ? DANGER : theme.backgroundSelected,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <ThemedText
          type="small"
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    minHeight: 52,
  },
  multiline: { minHeight: 104, paddingTop: Spacing.three, textAlignVertical: 'top' },
  error: { color: DANGER },
});
