import { AlertCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FormFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  /** Appends « (مطلوب)» to the label in the danger tone. */
  required?: boolean;
  /** Quiet helper line under the input (hidden while an error shows). */
  hint?: string;
};

/**
 * The Dar labeled text field used across the care forms: a 15/700 label (+ a
 * «(مطلوب)» marker in the danger tone), a 2px-bordered `sunken` input at radius 8
 * with a 16px value, an `acc` focus ring, and a `terr`+`err` validation state with
 * an icon + 15/700 message. Direction follows the app RTL/LTR (no hardcoded
 * textAlign), so Arabic aligns to the start. Pass `multiline` for notes. All
 * standard TextInput props pass through.
 */
export function FormField({ label, error, required, hint, style, multiline, onFocus, onBlur, ...rest }: FormFieldProps) {
  const { t } = useTranslation();
  const c = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? c.errorFg : focused ? c.primaryText : c.border;
  const backgroundColor = error ? c.errorBg : c.backgroundSunken;

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={[styles.label, { color: c.text }]}>
          {label}
          {required ? <Text style={{ color: c.errorFg }}>{` (${t('common.required')})`}</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={c.textSecondary}
        accessibilityLabel={label}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
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
          { color: c.text, backgroundColor, borderColor },
          style,
        ]}
        {...rest}
      />
      {hint && !error ? <Text style={[styles.hint, { color: c.textSecondary }]}>{hint}</Text> : null}
      {error ? (
        <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <AlertCircle size={15} color={c.errorFg} strokeWidth={2.4} />
          <Text style={[styles.errorText, { color: c.errorFg }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 5 },
  label: { fontSize: 15, fontFamily: FontFamily.semibold },
  input: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontFamily: FontFamily.medium,
    minHeight: 48,
  },
  multiline: { minHeight: 84, paddingTop: 11 },
  hint: { fontSize: 14, fontFamily: FontFamily.medium },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  errorText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold },
});
