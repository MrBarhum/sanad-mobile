import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { DateFieldProps } from './date-time-shared';
import { ThemedText } from './themed-text';

/**
 * Web date field: a real `<input type="date">` so the browser's accessible date
 * picker appears (no manual typing required). Stores / emits 'YYYY-MM-DD' (or ''
 * when cleared) — the exact value format the HTML date input uses, so no
 * conversion is needed. The native build uses a scrollable picker instead (see
 * date-field.tsx). `clearable` is implicit on web (the input's own clear control).
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  disabled = false,
  accessibilityLabel,
}: DateFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <input
        type="date"
        value={value}
        disabled={disabled}
        aria-label={accessibilityLabel ?? label}
        onChange={(event) => onChange(event.target.value)}
        style={{
          color: theme.text,
          backgroundColor: theme.backgroundElement,
          borderColor: error ? theme.errorFg : theme.border,
          borderWidth: 1,
          borderStyle: 'solid',
          borderRadius: Radius.md,
          paddingTop: Spacing.three,
          paddingBottom: Spacing.three,
          paddingLeft: Spacing.three,
          paddingRight: Spacing.three,
          fontSize: 16,
          minHeight: TouchTarget.comfortable,
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          opacity: disabled ? 0.6 : 1,
        }}
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
  field: { gap: Spacing.one },
});
