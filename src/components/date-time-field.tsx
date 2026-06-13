import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { DateField } from './date-field';
import { ThemedText } from './themed-text';
import { TimeField } from './time-field';

export type DateTimeFieldProps = {
  /** Section heading shown above the date + time pair. */
  label?: string;
  /** 'YYYY-MM-DD' or ''. */
  dateValue: string;
  /** 'HH:MM' or ''. */
  timeValue: string;
  onChangeDate: (value: string) => void;
  onChangeTime: (value: string) => void;
  dateLabel?: string;
  timeLabel?: string;
  dateError?: string | null;
  timeError?: string | null;
  disabled?: boolean;
};

/**
 * A date + time pair for editing a single instant (e.g. a vital reading's time).
 * Composes the platform-aware DateField + TimeField so the whole app shares one
 * date/time UX. The caller keeps the two parts as 'YYYY-MM-DD' + 'HH:MM' strings
 * and combines them into an ISO timestamp at save time (see combineDateTimeToInstant).
 */
export function DateTimeField({
  label,
  dateValue,
  timeValue,
  onChangeDate,
  onChangeTime,
  dateLabel,
  timeLabel,
  dateError,
  timeError,
  disabled,
}: DateTimeFieldProps) {
  return (
    <View style={styles.container}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <View style={styles.row}>
        <View style={styles.col}>
          <DateField
            label={dateLabel}
            value={dateValue}
            onChange={onChangeDate}
            error={dateError}
            disabled={disabled}
          />
        </View>
        <View style={styles.col}>
          <TimeField
            label={timeLabel}
            value={timeValue}
            onChange={onChangeTime}
            error={timeError}
            disabled={disabled}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors FormField's label-to-control rhythm.
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  col: { flexGrow: 1, flexBasis: 160 },
});
