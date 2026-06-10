import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { formatHm, todayYmd } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import type { MedicationSchedule, ScheduleInput } from './api';
import { scheduleSchema } from './schema';

/** Form state for a single schedule (mirrors scheduleSchema input shape). */
export type ScheduleDraft = {
  days_of_week: number[];
  times: string[];
  start_date: string;
  end_date: string;
  notes: string;
};

/** 0 = Sunday .. 6 = Saturday — matches the DB convention and Date.getDay(). */
export const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function defaultScheduleDraft(): ScheduleDraft {
  return {
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    times: ['08:00'],
    start_date: todayYmd(),
    end_date: '',
    notes: '',
  };
}

export function scheduleToDraft(schedule: MedicationSchedule): ScheduleDraft {
  return {
    days_of_week: [...schedule.days_of_week].sort((a, b) => a - b),
    times: schedule.times.map(formatHm),
    start_date: schedule.start_date,
    end_date: schedule.end_date ?? '',
    notes: schedule.notes ?? '',
  };
}

/**
 * Validates and normalizes a draft into a `ScheduleInput`. Trims/drops empty
 * time rows, sorts the weekdays, defaults an empty start date to today, and maps
 * empty optional fields to null. Returns either the input or per-field error
 * codes for the form to localize.
 */
export function prepareSchedule(
  draft: ScheduleDraft,
):
  | { ok: true; input: ScheduleInput }
  | { ok: false; errors: Partial<Record<string, string>> } {
  const cleaned = {
    days_of_week: [...draft.days_of_week].sort((a, b) => a - b),
    times: draft.times.map((time) => time.trim()).filter((time) => time !== ''),
    start_date: draft.start_date.trim(),
    end_date: draft.end_date.trim(),
    notes: draft.notes.trim(),
  };

  const parsed = scheduleSchema.safeParse(cleaned);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  return {
    ok: true,
    input: {
      days_of_week: parsed.data.days_of_week,
      times: parsed.data.times,
      start_date: parsed.data.start_date === '' ? todayYmd() : parsed.data.start_date,
      end_date: parsed.data.end_date === '' ? null : parsed.data.end_date,
      notes: parsed.data.notes === '' ? null : parsed.data.notes,
    },
  };
}

/**
 * Controlled editor for one schedule: weekday chips, a list of HH:MM times,
 * optional start/end dates, and notes. The parent owns the `value` state and
 * receives every change via `onChange`. Arabic-first, RTL-friendly.
 */
export function ScheduleFields({
  value,
  onChange,
  errors,
}: {
  value: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
  errors?: Partial<Record<string, string>>;
}) {
  const { t } = useTranslation();

  function toggleDay(day: number) {
    const set = new Set(value.days_of_week);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    onChange({ ...value, days_of_week: [...set].sort((a, b) => a - b) });
  }

  function setTime(index: number, next: string) {
    const times = value.times.slice();
    times[index] = next;
    onChange({ ...value, times });
  }

  function addTime() {
    onChange({ ...value, times: [...value.times, ''] });
  }

  function removeTime(index: number) {
    onChange({ ...value, times: value.times.filter((_, i) => i !== index) });
  }

  function timesError(): string | undefined {
    const code = errors?.times;
    if (!code) return undefined;
    return code === 'time' ? t('medications.errors.timeFormat') : t('medications.errors.timesRequired');
  }

  function dateError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'startDate':
      case 'endDate':
        return t('medications.errors.dateFormat');
      case 'endBeforeStart':
        return t('medications.errors.endBeforeStart');
      default:
        return t('validation.generic');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <ThemedText type="smallBold">{t('medications.fields.days')}</ThemedText>
        <View style={styles.days}>
          {WEEKDAY_KEYS.map((key, index) => {
            const selected = value.days_of_week.includes(index);
            return (
              <Pressable
                key={key}
                onPress={() => toggleDay(index)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t(`medications.weekdays.${key}`)}>
                <ThemedView
                  type={selected ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.dayChip}>
                  <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                    {t(`medications.weekdaysShort.${key}`)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>
        {errors?.days_of_week ? (
          <ThemedText type="small" style={styles.error} accessibilityRole="alert">
            {t('medications.errors.daysRequired')}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('medications.fields.times')}</ThemedText>
        {value.times.map((time, index) => (
          <View key={index} style={styles.timeRow}>
            <View style={styles.timeInput}>
              <TimeField
                value={time}
                onChange={(next) => setTime(index, next)}
                accessibilityLabel={`${t('medications.fields.times')} ${index + 1}`}
              />
            </View>
            {value.times.length > 1 ? (
              <Button
                size="sm"
                variant="secondary"
                label={t('common.delete')}
                onPress={() => removeTime(index)}
              />
            ) : null}
          </View>
        ))}
        <Button
          size="sm"
          variant="secondary"
          label={t('medications.addTime')}
          onPress={addTime}
        />
        {timesError() ? (
          <ThemedText type="small" style={styles.error} accessibilityRole="alert">
            {timesError()}
          </ThemedText>
        ) : null}
      </View>

      <DateField
        label={t('medications.fields.startDate')}
        value={value.start_date}
        onChange={(next) => onChange({ ...value, start_date: next })}
        error={dateError(errors?.start_date)}
      />
      <DateField
        label={t('medications.fields.endDate')}
        value={value.end_date}
        onChange={(next) => onChange({ ...value, end_date: next })}
        clearable
        error={dateError(errors?.end_date)}
      />
      <FormField
        label={t('medications.fields.scheduleNotes')}
        value={value.notes}
        onChangeText={(next) => onChange({ ...value, notes: next })}
        placeholder={t('medications.placeholders.scheduleNotes')}
        multiline
        error={errors?.notes ? t('validation.tooLong') : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  section: { gap: Spacing.two },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  dayChip: {
    minHeight: 40,
    minWidth: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  timeInput: { flex: 1 },
  error: { color: '#dc2626' },
});
