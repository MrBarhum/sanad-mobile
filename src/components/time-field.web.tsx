import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { TimeFieldProps } from './date-time-shared';
import { ThemedText } from './themed-text';

/**
 * Web time field: a real `<input type="time">` so the browser's accessible time
 * picker appears. Stores / emits 24-hour 'HH:MM' (or '' when cleared) — the value
 * format the HTML time input uses, so no conversion is needed. The native build
 * uses a scrollable picker instead (see time-field.tsx).
 */
export function TimeField({
  label,
  value,
  onChange,
  error,
  disabled = false,
  minuteStep,
  accessibilityLabel,
}: TimeFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <input
        type="time"
        value={value}
        disabled={disabled}
        step={minuteStep && minuteStep > 1 ? minuteStep * 60 : undefined}
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
