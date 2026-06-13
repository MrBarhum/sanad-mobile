import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { FontFamily, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type FormFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

/**
 * Labeled, themed text input used by the care forms. Adds an inline label, an
 * optional error and a clear focus ring (brand-colored border) so the active
 * field is always obvious â€” important under keyboard navigation and for older
 * users. Direction follows the app's RTL/LTR setting (no hardcoded textAlign),
 * so Arabic content aligns to the start automatically. Pass `multiline` for
 * notes fields. All standard TextInput props pass through.
 */
export function FormField({ label, error, style, multiline, onFocus, onBlur, ...rest }: FormFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.errorFg : focused ? theme.primary : theme.border;

  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <TextInput
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={label}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.inputFocused,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <ThemedText
          type="small"
          style={{ color: theme.errorFg }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    minHeight: TouchTarget.comfortable,
  },
  inputFocused: { borderWidth: 2, paddingHorizontal: Spacing.three - 1, paddingVertical: Spacing.three - 1 },
  multiline: { minHeight: 112, paddingTop: Spacing.three, textAlignVertical: 'top' },
});
