import { AlertCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/icon';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FormFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  /** Appends « (مطلوب)» to the label in the danger tone. */
  required?: boolean;
  /** Quiet helper line under the input (hidden while an error shows). */
  hint?: string;
  /**
   * Password mode: renders a trailing show/hide eye toggle and OWNS
   * `secureTextEntry` (its reveal state). Pass `revealLabel` / `hideLabel` for the
   * accessible action labels. Off (default) leaves every existing field unchanged.
   */
  secureToggle?: boolean;
  revealLabel?: string;
  hideLabel?: string;
};

/**
 * The Dar labeled text field used across the care forms: a 15/700 label (+ a
 * «(مطلوب)» marker in the danger tone), a 2px-bordered `sunken` input at radius 8
 * with a 16px value, an `acc` focus ring, and a `terr`+`err` validation state with
 * an icon + 15/700 message. Direction follows the app RTL/LTR (no hardcoded
 * textAlign), so Arabic aligns to the start. Pass `multiline` for notes, or
 * `secureToggle` for a password field with an eye reveal. All standard TextInput
 * props pass through.
 */
export function FormField({
  label,
  error,
  required,
  hint,
  style,
  multiline,
  onFocus,
  onBlur,
  secureToggle,
  revealLabel,
  hideLabel,
  secureTextEntry,
  ...rest
}: FormFieldProps) {
  const { t } = useTranslation();
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  const borderColor = error ? c.errorFg : focused ? c.primaryText : c.border;
  const backgroundColor = error ? c.errorBg : c.backgroundSunken;

  // Type the focus/blur args off TextInputProps so they track the installed RN's
  // event types (SDK 56 uses FocusEvent/BlurEvent, not NativeSyntheticEvent).
  const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={[styles.label, { color: c.text }]}>
          {label}
          {required ? <Text style={{ color: c.errorFg }}>{` (${t('common.required')})`}</Text> : null}
        </Text>
      ) : null}
      {secureToggle ? (
        <View style={[styles.inputRow, { backgroundColor, borderColor }]}>
          <TextInput
            placeholderTextColor={c.textSecondary}
            accessibilityLabel={label}
            secureTextEntry={!reveal}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[styles.rowInput, { color: c.text }, style]}
            {...rest}
          />
          <Pressable
            onPress={() => setReveal((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={reveal ? hideLabel : revealLabel}
            style={styles.eyeButton}>
            <Icon name={reveal ? 'viewOff' : 'view'} size={18} color="textSecondary" />
          </Pressable>
        </View>
      ) : (
        <TextInput
          placeholderTextColor={c.textSecondary}
          accessibilityLabel={label}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          secureTextEntry={secureTextEntry}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            styles.input,
            multiline && styles.multiline,
            { color: c.text, backgroundColor, borderColor },
            style,
          ]}
          {...rest}
        />
      )}
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
  // Password row: the border/fill live on the wrapper; the eye sits at the end.
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    minHeight: 48,
    gap: 10,
  },
  rowInput: { flex: 1, paddingVertical: 11, fontSize: 16, fontFamily: FontFamily.medium },
  eyeButton: { paddingVertical: 4 },
  hint: { fontSize: 14, fontFamily: FontFamily.medium },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  errorText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold },
});
