import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Cairo } from '@/components/figma/form-typography';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared auth text field (Figma `FieldInput` parity): a label above a raised input
 * with a 1.5px border, radius 12, teal focus border, and an eye show/hide toggle
 * for password fields. Email is forced LTR. Inline error / hint below. Extracted so
 * sign-in, sign-up, forgot-password, and reset-password all read identically.
 */
export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  isPassword,
  ltr,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  isPassword?: boolean;
  ltr?: boolean;
} & TextInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const borderColor = error ? theme.errorFg : focused ? theme.primary : theme.border;

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" style={Cairo.semibold}>
        {label}
      </ThemedText>
      <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSunken, borderColor }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={isPassword && !show}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          style={[styles.input, Cairo.regular, { color: theme.text }, ltr ? styles.ltr : null]}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setShow((value) => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t(show ? 'auth.hidePassword' : 'auth.showPassword')}
            style={styles.eyeButton}>
            <Icon name={show ? 'viewOff' : 'view'} size={18} color="textMuted" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText
          type="small"
          style={[{ color: theme.errorFg }, Cairo.regular]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textMuted" style={Cairo.regular}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16 },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  eyeButton: { paddingStart: 8, paddingVertical: 4 },
});
