import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { TimeFieldProps } from './date-time-shared';
import { ThemedText } from './themed-text';

const DANGER = '#dc2626';

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
          borderColor: error ? DANGER : theme.backgroundSelected,
          borderWidth: 1,
          borderStyle: 'solid',
          borderRadius: Spacing.two,
          paddingTop: Spacing.three,
          paddingBottom: Spacing.three,
          paddingLeft: Spacing.three,
          paddingRight: Spacing.three,
          fontSize: 16,
          minHeight: 52,
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          opacity: disabled ? 0.6 : 1,
        }}
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
  error: { color: DANGER },
});
