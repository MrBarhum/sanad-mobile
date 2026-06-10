import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { FormField } from '@/components/form-field';
import { OptionSelect, type SelectOption } from '@/components/option-select';
import { Spacing } from '@/constants/theme';
import {
  combineDateTimeToInstant,
  hmFromInstant,
  isValidHm,
  isValidYmd,
  todayYmd,
  ymdFromInstant,
} from '@/utils/date';

import type { VitalInput, VitalReading, VitalReadingType } from './api';
import { DEFAULT_UNITS, VITAL_READING_TYPES, toPositiveInt, toPositiveNumber } from './schema';

/** Editable vital draft kept as form-friendly strings. */
export type VitalDraft = {
  type: VitalReadingType;
  date: string;
  time: string;
  systolic: string;
  diastolic: string;
  value: string;
  unit: string;
  notes: string;
};

function nowHm(): string {
  return hmFromInstant(new Date().toISOString());
}

export function defaultVitalDraft(): VitalDraft {
  return {
    type: 'blood_pressure',
    date: todayYmd(),
    time: nowHm(),
    systolic: '',
    diastolic: '',
    value: '',
    unit: DEFAULT_UNITS.blood_pressure,
    notes: '',
  };
}

export function vitalDraftFromRow(row: VitalReading): VitalDraft {
  return {
    type: row.reading_type,
    date: ymdFromInstant(row.reading_at),
    time: hmFromInstant(row.reading_at),
    systolic: row.systolic !== null ? String(row.systolic) : '',
    diastolic: row.diastolic !== null ? String(row.diastolic) : '',
    value: row.numeric_value !== null ? String(row.numeric_value) : '',
    unit: row.unit ?? '',
    notes: row.notes ?? '',
  };
}

type PreparedVital =
  | { ok: true; input: VitalInput }
  | { ok: false; errors: Partial<Record<string, string>> };

/**
 * Validates the draft and builds a VitalInput. Blood pressure requires both
 * systolic and diastolic; other measured types require a numeric value; `other`
 * allows a notes-only record. The date + time combine into an ISO instant.
 */
export function prepareVital(draft: VitalDraft): PreparedVital {
  const errors: Partial<Record<string, string>> = {};

  if (!isValidYmd(draft.date)) errors.date = 'date';
  if (!isValidHm(draft.time)) errors.time = 'time';

  let readingAt: string | null = null;
  if (!errors.date && !errors.time) {
    readingAt = combineDateTimeToInstant(draft.date, draft.time);
    if (!readingAt) errors.time = 'time';
  }

  const unit = draft.unit.trim();
  if (unit.length > 40) errors.unit = 'tooLong';
  const notes = draft.notes.trim();
  if (notes.length > 1000) errors.notes = 'tooLong';

  let systolic: number | null = null;
  let diastolic: number | null = null;
  let numericValue: number | null = null;

  if (draft.type === 'blood_pressure') {
    systolic = toPositiveInt(draft.systolic);
    diastolic = toPositiveInt(draft.diastolic);
    if (systolic === null) errors.systolic = 'systolic';
    if (diastolic === null) errors.diastolic = 'diastolic';
  } else {
    numericValue = toPositiveNumber(draft.value);
    if (numericValue === null && (draft.type !== 'other' || draft.value.trim() !== '')) {
      errors.value = 'value';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    input: {
      reading_at: readingAt as string,
      reading_type: draft.type,
      systolic,
      diastolic,
      numeric_value: numericValue,
      unit: unit === '' ? null : unit,
      notes: notes === '' ? null : notes,
    },
  };
}

/** Controlled inputs for a vital reading, shared by the create + edit screens. */
export function VitalFieldset({
  draft,
  onChange,
  errors,
}: {
  draft: VitalDraft;
  onChange: (patch: Partial<VitalDraft>) => void;
  errors: Partial<Record<string, string>>;
}) {
  const { t } = useTranslation();

  const typeOptions: SelectOption<VitalReadingType>[] = VITAL_READING_TYPES.map((value) => ({
    value,
    label: t(`vitals.type.${value}`),
  }));

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'date':
        return t('vitals.errors.date');
      case 'time':
        return t('vitals.errors.time');
      case 'systolic':
        return t('vitals.errors.systolic');
      case 'diastolic':
        return t('vitals.errors.diastolic');
      case 'value':
        return t('vitals.errors.value');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  const isBloodPressure = draft.type === 'blood_pressure';
  const valueOptional = draft.type === 'other';

  return (
    <View style={styles.fields}>
      <OptionSelect
        label={t('vitals.fields.type')}
        value={draft.type}
        options={typeOptions}
        onChange={(type) => onChange({ type, unit: DEFAULT_UNITS[type] })}
      />

      <DateTimeField
        label={t('vitals.fields.readingAt')}
        dateValue={draft.date}
        timeValue={draft.time}
        onChangeDate={(date) => onChange({ date })}
        onChangeTime={(time) => onChange({ time })}
        dateLabel={t('vitals.fields.date')}
        timeLabel={t('vitals.fields.time')}
        dateError={fieldError(errors.date)}
        timeError={fieldError(errors.time)}
      />

      {isBloodPressure ? (
        <View style={styles.row}>
          <View style={styles.col}>
            <FormField
              label={t('vitals.fields.systolic')}
              value={draft.systolic}
              onChangeText={(value) => onChange({ systolic: value })}
              placeholder={t('vitals.placeholders.systolic')}
              keyboardType="number-pad"
              maxLength={3}
              error={fieldError(errors.systolic)}
            />
          </View>
          <View style={styles.col}>
            <FormField
              label={t('vitals.fields.diastolic')}
              value={draft.diastolic}
              onChangeText={(value) => onChange({ diastolic: value })}
              placeholder={t('vitals.placeholders.diastolic')}
              keyboardType="number-pad"
              maxLength={3}
              error={fieldError(errors.diastolic)}
            />
          </View>
        </View>
      ) : (
        <FormField
          label={valueOptional ? t('vitals.fields.valueOptional') : t('vitals.fields.value')}
          value={draft.value}
          onChangeText={(value) => onChange({ value })}
          placeholder={t('vitals.placeholders.value')}
          keyboardType="decimal-pad"
          error={fieldError(errors.value)}
        />
      )}

      <FormField
        label={t('vitals.fields.unit')}
        value={draft.unit}
        onChangeText={(value) => onChange({ unit: value })}
        placeholder={t('vitals.placeholders.unit')}
        autoCapitalize="none"
        autoCorrect={false}
        error={fieldError(errors.unit)}
      />

      <FormField
        label={t('vitals.fields.notes')}
        value={draft.notes}
        onChangeText={(value) => onChange({ notes: value })}
        placeholder={t('vitals.placeholders.notes')}
        multiline
        error={fieldError(errors.notes)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: Spacing.three },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  col: { flexGrow: 1, flexBasis: 120 },
});
