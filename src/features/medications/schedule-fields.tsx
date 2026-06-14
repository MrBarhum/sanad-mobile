import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { WeekdaySelector } from '@/components/weekday-selector';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatHm, todayYmd } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import type { MedicationSchedule, ScheduleInput } from './api';
import { scheduleSchema } from './schema';
import { duplicateTimes, duplicateTimesInDraft } from './schedule-validation';

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
    // No days pre-selected: a new schedule starts empty and the user opts in by
    // tapping days (or "Every day"). At least one day is required to save.
    days_of_week: [],
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

  // Reject exact duplicate time rows before they reach the DB. The schema can't
  // express "no repeats", so we enforce it here — the single entry point both the
  // add-medication form and the schedule modal flow through. Two identical times
  // would double-count a dose and collide on the dose list's React key.
  if (duplicateTimes(parsed.data.times).length > 0) {
    return { ok: false, errors: { times: 'duplicate' } };
  }

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
  const theme = useTheme();

  // Short chip labels + full names indexed 0 (Sun)..6 (Sat), matching WEEKDAY_KEYS.
  const dayLabels = WEEKDAY_KEYS.map((key) => t(`medications.weekdaysShort.${key}`));
  const dayFullLabels = WEEKDAY_KEYS.map((key) => t(`medications.weekdays.${key}`));

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
    switch (errors?.times) {
      case undefined:
      // The duplicate case is surfaced by the live indicator below (which also
      // highlights the offending rows) — don't double up the message here.
      case 'duplicate':
        return undefined;
      case 'time':
        return t('medications.errors.timeFormat');
      default:
        return t('medications.errors.timesRequired');
    }
  }

  const duplicateTimeValues = new Set(duplicateTimesInDraft(value));
  const hasDuplicateTimes = duplicateTimeValues.size > 0;

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
      <WeekdaySelector
        label={t('medications.fields.days')}
        value={value.days_of_week}
        onChange={(days) => onChange({ ...value, days_of_week: days })}
        dayLabels={dayLabels}
        accessibilityDayLabels={dayFullLabels}
        everyDayLabel={t('medications.everyDay')}
        error={errors?.days_of_week ? t('medications.errors.daysRequired') : undefined}
      />

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('medications.fields.times')}</ThemedText>
        {value.times.map((time, index) => {
          const isDuplicate = duplicateTimeValues.has(formatHm(time));
          return (
            <View
              key={index}
              style={[
                styles.timeRow,
                isDuplicate && {
                  ...styles.timeRowInvalid,
                  borderColor: theme.errorFg,
                  backgroundColor: theme.errorBg,
                },
              ]}>
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
          );
        })}
        <Button
          size="sm"
          variant="secondary"
          label={t('medications.addTimeToSchedule')}
          onPress={addTime}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t('medications.helpSameDays')}
        </ThemedText>
        {timesError() ? (
          <ThemedText type="small" themeColor="errorFg" accessibilityRole="alert">
            {timesError()}
          </ThemedText>
        ) : null}
        {hasDuplicateTimes ? (
          <ThemedText type="small" themeColor="errorFg" accessibilityRole="alert">
            {t('medications.errors.duplicateTime')}
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
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  timeRowInvalid: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.two },
  timeInput: { flex: 1 },
});
