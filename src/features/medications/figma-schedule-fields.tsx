import { Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { FigmaFieldLabel } from '@/components/figma/figma-form-screen';
import { TimeField } from '@/components/time-field';
import { FontFamily, Radius, Spacing, TouchTarget, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatHm, todayYmd } from '@/utils/date';

import { WEEKDAY_KEYS, type ScheduleDraft } from './schedule-fields';
import { duplicateTimesInDraft } from './schedule-validation';

/** 0 = Sunday .. 6 = Saturday — matches the DB convention (see schedule-fields). */
const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

export type ScheduleDateErrors = { start?: 'past'; end?: 'past' | 'beforeStart' };

/**
 * Date constraints for a NEW medication schedule: start/end can't be before today
 * and end can't be before start. ('YYYY-MM-DD' sorts chronologically, so string
 * comparison is correct.) Add-flow only — the shared schema is untouched so
 * existing historical schedules and the edit flow keep working.
 */
export function scheduleDateErrors(draft: ScheduleDraft, today: string): ScheduleDateErrors {
  const out: ScheduleDateErrors = {};
  if (draft.start_date && draft.start_date < today) out.start = 'past';
  if (draft.end_date) {
    if (draft.end_date < today) out.end = 'past';
    else if (draft.start_date && draft.end_date < draft.start_date) out.end = 'beforeStart';
  }
  return out;
}

/** True when the draft's start/end dates satisfy the add-flow constraints. */
export function scheduleDatesValid(draft: ScheduleDraft, today: string): boolean {
  const errors = scheduleDateErrors(draft, today);
  return !errors.start && !errors.end;
}

/**
 * Figma-faithful inline schedule editor for the Add-Medication screen — a visual
 * rebuild of the export's "جدول الجرعات" section (weekday row + dose-time rows +
 * date range). It deliberately mirrors the layout of `AddMedicationScreen` while
 * preserving Sanad's real behavior:
 *   - opt-in weekday selection, 0 = Sunday .. 6 = Saturday;
 *   - the protected wheel `TimeField` / `DateField` (NO native time/date inputs);
 *   - live duplicate-time detection + per-row highlight (the parent blocks save).
 * The schedule `notes` field is rendered by the parent as a separate card (also
 * matching the export). State + validation stay owned by `MedicationForm`.
 */
export function FigmaScheduleFields({
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

  const dayLabels = WEEKDAY_KEYS.map((key) => t(`medications.weekdaysShort.${key}`));
  const dayFullLabels = WEEKDAY_KEYS.map((key) => t(`medications.weekdays.${key}`));
  const selectedDays = new Set(value.days_of_week);
  const allSelected = DAY_INDEXES.every((day) => selectedDays.has(day));

  function setDays(days: number[]) {
    onChange({ ...value, days_of_week: [...days].sort((a, b) => a - b) });
  }
  function toggleDay(day: number) {
    const next = new Set(selectedDays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setDays([...next]);
  }
  function toggleEveryDay() {
    setDays(allSelected ? [] : [...DAY_INDEXES]);
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

  const duplicateTimeValues = new Set(duplicateTimesInDraft(value));
  const hasDuplicateTimes = duplicateTimeValues.size > 0;

  function timesError(): string | undefined {
    switch (errors?.times) {
      case undefined:
      case 'duplicate':
        return undefined;
      case 'time':
        return t('medications.errors.timeFormat');
      default:
        return t('medications.errors.timesRequired');
    }
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

  // Date constraints: no past dates, end not before start. The picker enforces
  // these via minDate; these messages cover any residual invalid state.
  const today = todayYmd();
  const liveDateErrors = scheduleDateErrors(value, today);
  // End date can't be earlier than today OR the chosen start date.
  const endMinDate = value.start_date && value.start_date > today ? value.start_date : today;

  function startDateError(): string | undefined {
    if (liveDateErrors.start === 'past') return t('medications.errors.dateInPast');
    return dateError(errors?.start_date);
  }
  function endDateError(): string | undefined {
    if (liveDateErrors.end === 'past') return t('medications.errors.dateInPast');
    if (liveDateErrors.end === 'beforeStart') return t('medications.errors.endBeforeStart');
    return dateError(errors?.end_date);
  }

  function setStartDate(next: string) {
    // If the new start is after the current end, drop the now-invalid end date.
    const end = value.end_date && value.end_date < next ? '' : value.end_date;
    onChange({ ...value, start_date: next, end_date: end });
  }

  return (
    <View style={styles.container}>
      {/* Days of the week */}
      <View style={styles.group}>
        <FigmaFieldLabel label={t('medications.fields.days')} />
        <View style={styles.daysRow}>
          {DAY_INDEXES.map((day) => {
            const on = selectedDays.has(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleDay(day)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={dayFullLabels[day]}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: on ? theme.primaryBg : theme.backgroundSunken,
                    borderColor: on ? theme.primary : theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.dayChipText,
                    { color: on ? theme.primaryText : theme.textSecondary, fontFamily: on ? FontFamily.semibold : FontFamily.regular },
                  ]}>
                  {dayLabels[day]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={toggleEveryDay} accessibilityRole="button" hitSlop={Spacing.two} style={styles.everyDay}>
          <Text style={[styles.everyDayText, { color: theme.primaryText }]}>
            {allSelected ? t('medications.clearDays') : t('medications.everyDay')}
          </Text>
        </Pressable>
        {errors?.days_of_week ? (
          <Text style={[styles.fieldError, { color: theme.errorFg }]} accessibilityRole="alert">
            {t('medications.errors.daysRequired')}
          </Text>
        ) : null}
      </View>

      {/* Dose times */}
      <View style={styles.group}>
        <FigmaFieldLabel label={t('medications.fields.times')} />
        {value.times.map((time, index) => {
          const isDuplicate = duplicateTimeValues.has(formatHm(time));
          return (
            <View
              key={index}
              style={[
                styles.timeRow,
                isDuplicate && {
                  borderWidth: 1,
                  borderRadius: Radius.md,
                  padding: Spacing.two,
                  borderColor: theme.errorFg,
                  backgroundColor: theme.errorBg,
                },
              ]}>
              <View style={styles.timeField}>
                <TimeField
                  value={time}
                  onChange={(next) => setTime(index, next)}
                  accessibilityLabel={`${t('medications.fields.times')} ${index + 1}`}
                />
              </View>
              {value.times.length > 1 ? (
                <Pressable
                  onPress={() => removeTime(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  style={[styles.removeTime, { backgroundColor: withAlpha(theme.errorFg, 0.13), borderColor: withAlpha(theme.errorFg, 0.3) }]}>
                  <X size={16} color={theme.errorFg} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <Pressable
          onPress={addTime}
          accessibilityRole="button"
          accessibilityLabel={t('medications.addTimeToSchedule')}
          style={[styles.addTime, { borderColor: theme.border }]}>
          <Plus size={15} color={theme.primaryText} />
          <Text style={[styles.addTimeText, { color: theme.primaryText }]}>
            {t('medications.addTime')}
          </Text>
        </Pressable>
        <Text style={[styles.help, { color: theme.textSecondary }]}>{t('medications.helpSameDays')}</Text>
        {timesError() ? (
          <Text style={[styles.fieldError, { color: theme.errorFg }]} accessibilityRole="alert">
            {timesError()}
          </Text>
        ) : null}
        {hasDuplicateTimes ? (
          <Text style={[styles.fieldError, { color: theme.errorFg }]} accessibilityRole="alert">
            {t('medications.errors.duplicateTime')}
          </Text>
        ) : null}
      </View>

      {/* Medication period (date range) */}
      <View style={styles.group}>
        <FigmaFieldLabel label={t('medications.periodTitle')} />
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <DateField
              label={t('medications.fields.startDate')}
              value={value.start_date}
              onChange={setStartDate}
              minDate={today}
              error={startDateError()}
            />
          </View>
          <View style={styles.dateCol}>
            <DateField
              label={t('medications.fields.endDate')}
              value={value.end_date}
              onChange={(next) => onChange({ ...value, end_date: next })}
              clearable
              minDate={endMinDate}
              error={endDateError()}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  group: { gap: Spacing.two },
  daysRow: { flexDirection: 'row', gap: 4 },
  dayChip: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: { fontSize: 11 },
  everyDay: { alignSelf: 'flex-start', paddingVertical: 2 },
  everyDayText: { fontSize: 12, fontFamily: FontFamily.medium },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  timeField: { flex: 1 },
  removeTime: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTime: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TouchTarget.min,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 14,
  },
  addTimeText: { fontSize: 14, fontFamily: FontFamily.medium },
  help: { fontSize: 13, fontFamily: FontFamily.regular },
  fieldError: { fontSize: 13, fontFamily: FontFamily.regular },
  dateRow: { flexDirection: 'row', gap: Spacing.three },
  dateCol: { flex: 1 },
});
