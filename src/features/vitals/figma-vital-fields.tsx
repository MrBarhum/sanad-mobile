import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { DateField } from '@/components/date-field';
import {
  FigmaChipSelect,
  FigmaFieldLabel,
  FigmaFormCard,
  FigmaFormField,
} from '@/components/figma/figma-form-screen';
import { TimeField } from '@/components/time-field';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { VitalReadingType } from './api';
import { DEFAULT_UNITS, VITAL_READING_TYPES } from './schema';
import type { VitalDraft } from './vital-fields';

/** A big, LTR-isolated, centered numeric input — the Figma value field. */
function BigValueInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  error,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  error?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.errorFg : focused ? theme.primary : theme.border;
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textMuted}
      keyboardType={keyboardType}
      maxLength={maxLength}
      accessibilityLabel={accessibilityLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.bigInput, { backgroundColor: theme.backgroundSunken, borderColor, color: theme.text }]}
    />
  );
}

/**
 * Figma-faithful inputs for a vital reading on the Add-Vital screen — a visual
 * rebuild of the export's measurement-type / value / date-time / notes cards,
 * wired to Sanad's draft. Blood pressure splits into systolic / diastolic; other
 * types use one value + unit; `other` allows a notes-only record. There is NO
 * normal/abnormal interpretation and NO health-color coding — values are neutral.
 * Date/time use the protected wheel pickers (no native inputs). State + the
 * `prepareVital` validation stay owned by `VitalForm`.
 */
export function FigmaVitalFields({
  draft,
  onChange,
  errors,
}: {
  draft: VitalDraft;
  onChange: (patch: Partial<VitalDraft>) => void;
  errors: Partial<Record<string, string>>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const typeOptions: { value: VitalReadingType; label: string }[] = VITAL_READING_TYPES.map(
    (value) => ({ value, label: t(`vitals.type.${value}`) }),
  );

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
  const selectedTypeLabel = t(`vitals.type.${draft.type}`);

  return (
    <>
      {/* Measurement type */}
      <FigmaFormCard label={t('vitals.fields.type')}>
        <FigmaChipSelect
          value={draft.type}
          options={typeOptions}
          onChange={(type) => onChange({ type, unit: DEFAULT_UNITS[type] })}
        />
      </FigmaFormCard>

      {/* Value */}
      <FigmaFormCard label={t('vitals.valueLabel')}>
        {isBloodPressure ? (
          <View style={styles.group}>
            <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
              {`${selectedTypeLabel} (${draft.unit || DEFAULT_UNITS.blood_pressure})`}
            </Text>
            <View style={styles.bpRow}>
              <View style={styles.bpCol}>
                <FigmaFieldLabel label={t('vitals.fields.systolic')} />
                <BigValueInput
                  value={draft.systolic}
                  onChangeText={(systolic) => onChange({ systolic })}
                  placeholder={t('vitals.placeholders.systolic')}
                  keyboardType="number-pad"
                  maxLength={3}
                  error={!!errors.systolic}
                  accessibilityLabel={t('vitals.fields.systolic')}
                />
              </View>
              <Text style={[styles.bpSlash, { color: theme.textMuted }]}>/</Text>
              <View style={styles.bpCol}>
                <FigmaFieldLabel label={t('vitals.fields.diastolic')} />
                <BigValueInput
                  value={draft.diastolic}
                  onChangeText={(diastolic) => onChange({ diastolic })}
                  placeholder={t('vitals.placeholders.diastolic')}
                  keyboardType="number-pad"
                  maxLength={3}
                  error={!!errors.diastolic}
                  accessibilityLabel={t('vitals.fields.diastolic')}
                />
              </View>
            </View>
            {errors.systolic || errors.diastolic ? (
              <Text style={[styles.error, { color: theme.errorFg }]} accessibilityRole="alert">
                {fieldError(errors.systolic ?? errors.diastolic)}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.group}>
            <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
              {valueOptional ? t('vitals.fields.valueOptional') : selectedTypeLabel}
            </Text>
            <View style={styles.valueRow}>
              <View style={styles.valueMain}>
                <BigValueInput
                  value={draft.value}
                  onChangeText={(value) => onChange({ value })}
                  placeholder={t('vitals.placeholders.value')}
                  keyboardType="decimal-pad"
                  error={!!errors.value}
                  accessibilityLabel={valueOptional ? t('vitals.fields.valueOptional') : t('vitals.fields.value')}
                />
              </View>
              <TextInput
                value={draft.unit}
                onChangeText={(unit) => onChange({ unit })}
                placeholder={t('vitals.placeholders.unit')}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('vitals.fields.unit')}
                style={[styles.unitBox, { backgroundColor: theme.backgroundSunken, borderColor: theme.border, color: theme.textSecondary }]}
              />
            </View>
            {errors.value ? (
              <Text style={[styles.error, { color: theme.errorFg }]} accessibilityRole="alert">
                {fieldError(errors.value)}
              </Text>
            ) : null}
          </View>
        )}
      </FigmaFormCard>

      {/* Date & time */}
      <FigmaFormCard label={t('vitals.fields.readingAt')}>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateCol}>
            <DateField
              label={t('vitals.fields.date')}
              value={draft.date}
              onChange={(date) => onChange({ date })}
              error={fieldError(errors.date)}
            />
          </View>
          <View style={styles.timeCol}>
            <TimeField
              label={t('vitals.fields.time')}
              value={draft.time}
              onChange={(time) => onChange({ time })}
              error={fieldError(errors.time)}
            />
          </View>
        </View>
      </FigmaFormCard>

      {/* Notes */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('vitals.fields.notes')}
          value={draft.notes}
          onChangeText={(notes) => onChange({ notes })}
          placeholder={t('vitals.placeholders.notes')}
          multiline
          error={fieldError(errors.notes)}
        />
      </FigmaFormCard>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  subLabel: { fontSize: 14, fontFamily: FontFamily.regular },
  bpRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  bpCol: { flex: 1, gap: 4 },
  bpSlash: { fontSize: 28, fontFamily: FontFamily.regular, paddingBottom: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  valueMain: { flex: 2 },
  bigInput: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 22,
    fontFamily: FontFamily.semibold,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  unitBox: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
  },
  error: { fontSize: 14, fontFamily: FontFamily.regular },
  dateTimeRow: { flexDirection: 'row', gap: Spacing.three },
  dateCol: { flex: 2 },
  timeCol: { flex: 1 },
});
