import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { OptionSelect, type SelectOption } from '@/components/option-select';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { todayYmd } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import type {
  AppetiteLevel,
  DailyCareLog,
  DailyLogInput,
  DailyMood,
  HydrationLevel,
  MobilityLevel,
  SleepQuality,
} from './api';
import {
  APPETITE_LEVELS,
  HYDRATION_LEVELS,
  MOBILITY_LEVELS,
  MOODS,
  PAIN_LEVELS,
  SLEEP_QUALITIES,
  dailyLogSchema,
} from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());
/** Sentinel select value meaning "not recorded" (maps to null on save). */
const UNSET = '';

/** Editable daily-log draft kept as form-friendly values. */
export type DailyLogDraft = {
  logDate: string;
  mood: string;
  sleepQuality: string;
  appetite: string;
  hydration: string;
  painLevel: number | null;
  mobility: string;
  bathroomNotes: string;
  foodNotes: string;
  activityNotes: string;
  generalNotes: string;
};

export function defaultDailyLogDraft(): DailyLogDraft {
  return {
    logDate: todayYmd(),
    mood: UNSET,
    sleepQuality: UNSET,
    appetite: UNSET,
    hydration: UNSET,
    painLevel: null,
    mobility: UNSET,
    bathroomNotes: '',
    foodNotes: '',
    activityNotes: '',
    generalNotes: '',
  };
}

export function dailyLogDraftFromRow(row: DailyCareLog): DailyLogDraft {
  return {
    logDate: row.log_date,
    mood: row.mood ?? UNSET,
    sleepQuality: row.sleep_quality ?? UNSET,
    appetite: row.appetite ?? UNSET,
    hydration: row.hydration ?? UNSET,
    painLevel: row.pain_level,
    mobility: row.mobility ?? UNSET,
    bathroomNotes: row.bathroom_notes ?? '',
    foodNotes: row.food_notes ?? '',
    activityNotes: row.activity_notes ?? '',
    generalNotes: row.general_notes ?? '',
  };
}

type PreparedDailyLog =
  | { ok: true; input: DailyLogInput }
  | { ok: false; errors: Partial<Record<string, string>> };

/** Validates the draft and maps unset selects / empty notes to null. */
export function prepareDailyLog(draft: DailyLogDraft): PreparedDailyLog {
  const parsed = dailyLogSchema.safeParse({
    log_date: draft.logDate,
    bathroom_notes: draft.bathroomNotes,
    food_notes: draft.foodNotes,
    activity_notes: draft.activityNotes,
    general_notes: draft.generalNotes,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  return {
    ok: true,
    input: {
      log_date: parsed.data.log_date,
      mood: draft.mood === UNSET ? null : (draft.mood as DailyMood),
      sleep_quality: draft.sleepQuality === UNSET ? null : (draft.sleepQuality as SleepQuality),
      appetite: draft.appetite === UNSET ? null : (draft.appetite as AppetiteLevel),
      hydration: draft.hydration === UNSET ? null : (draft.hydration as HydrationLevel),
      pain_level: draft.painLevel,
      mobility: draft.mobility === UNSET ? null : (draft.mobility as MobilityLevel),
      bathroom_notes: nullify(parsed.data.bathroom_notes),
      food_notes: nullify(parsed.data.food_notes),
      activity_notes: nullify(parsed.data.activity_notes),
      general_notes: nullify(parsed.data.general_notes),
    },
  };
}

/** Controlled inputs for a daily log, shared by the create + edit screens. */
export function DailyLogFieldset({
  draft,
  onChange,
  errors,
}: {
  draft: DailyLogDraft;
  onChange: (patch: Partial<DailyLogDraft>) => void;
  errors: Partial<Record<string, string>>;
}) {
  const { t } = useTranslation();

  function withUnset<T extends string>(
    group: string,
    values: readonly T[],
  ): SelectOption<string>[] {
    return [
      { value: UNSET, label: t('dailyLogs.unset') },
      ...values.map((value) => ({ value, label: t(`dailyLogs.${group}.${value}`) })),
    ];
  }

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'logDate':
        return t('dailyLogs.errors.logDate');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  return (
    <View style={styles.fields}>
      <DateField
        label={t('dailyLogs.fields.logDate')}
        value={draft.logDate}
        onChange={(value) => onChange({ logDate: value })}
        error={fieldError(errors.log_date)}
      />

      <OptionSelect
        label={t('dailyLogs.fields.mood')}
        value={draft.mood}
        options={withUnset('mood', MOODS)}
        onChange={(value) => onChange({ mood: value })}
      />
      <OptionSelect
        label={t('dailyLogs.fields.sleepQuality')}
        value={draft.sleepQuality}
        options={withUnset('sleepQuality', SLEEP_QUALITIES)}
        onChange={(value) => onChange({ sleepQuality: value })}
      />
      <OptionSelect
        label={t('dailyLogs.fields.appetite')}
        value={draft.appetite}
        options={withUnset('appetite', APPETITE_LEVELS)}
        onChange={(value) => onChange({ appetite: value })}
      />
      <OptionSelect
        label={t('dailyLogs.fields.hydration')}
        value={draft.hydration}
        options={withUnset('hydration', HYDRATION_LEVELS)}
        onChange={(value) => onChange({ hydration: value })}
      />

      <View style={styles.field}>
        <ThemedText type="smallBold">{t('dailyLogs.fields.painLevel')}</ThemedText>
        <View style={styles.painRow}>
          <Button
            size="sm"
            variant={draft.painLevel === null ? 'primary' : 'secondary'}
            label={t('dailyLogs.painNone')}
            onPress={() => onChange({ painLevel: null })}
          />
          {PAIN_LEVELS.map((level) => (
            <Button
              key={level}
              size="sm"
              variant={draft.painLevel === level ? 'primary' : 'secondary'}
              label={String(level)}
              onPress={() => onChange({ painLevel: level })}
            />
          ))}
        </View>
      </View>

      <OptionSelect
        label={t('dailyLogs.fields.mobility')}
        value={draft.mobility}
        options={withUnset('mobility', MOBILITY_LEVELS)}
        onChange={(value) => onChange({ mobility: value })}
      />

      <FormField
        label={t('dailyLogs.fields.bathroomNotes')}
        value={draft.bathroomNotes}
        onChangeText={(value) => onChange({ bathroomNotes: value })}
        placeholder={t('dailyLogs.placeholders.bathroomNotes')}
        multiline
        error={fieldError(errors.bathroom_notes)}
      />
      <FormField
        label={t('dailyLogs.fields.foodNotes')}
        value={draft.foodNotes}
        onChangeText={(value) => onChange({ foodNotes: value })}
        placeholder={t('dailyLogs.placeholders.foodNotes')}
        multiline
        error={fieldError(errors.food_notes)}
      />
      <FormField
        label={t('dailyLogs.fields.activityNotes')}
        value={draft.activityNotes}
        onChangeText={(value) => onChange({ activityNotes: value })}
        placeholder={t('dailyLogs.placeholders.activityNotes')}
        multiline
        error={fieldError(errors.activity_notes)}
      />
      <FormField
        label={t('dailyLogs.fields.generalNotes')}
        value={draft.generalNotes}
        onChangeText={(value) => onChange({ generalNotes: value })}
        placeholder={t('dailyLogs.placeholders.generalNotes')}
        multiline
        error={fieldError(errors.general_notes)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: Spacing.three },
  field: { gap: Spacing.one },
  painRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
