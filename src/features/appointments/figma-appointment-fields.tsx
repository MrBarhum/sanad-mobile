import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import {
  FigmaChipSelect,
  FigmaFieldLabel,
  FigmaFormCard,
  FigmaFormField,
} from '@/components/figma/figma-form-screen';
import { FigmaFont } from '@/components/figma/figma-tokens';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Doctor } from '@/features/doctors/api';

import type { AppointmentType } from './api';
import type { AppointmentDraft } from './appointment-fields';
import { APPOINTMENT_TYPES } from './schema';

/**
 * Figma-faithful inputs for an appointment on the Add-Appointment screen — a
 * visual rebuild of the export's main-info / date-time / location-doctor / notes
 * cards, wired to Sanad's draft + `prepareAppointment` validation. The doctor
 * picker uses the REAL doctors list (+ "no doctor"), never the export's invented
 * names. Date + start time are required; end time is optional and validated as
 * not-before-start by the schema. Date/time use the protected wheel pickers.
 */
export function FigmaAppointmentFields({
  draft,
  onChange,
  errors,
  doctors,
}: {
  draft: AppointmentDraft;
  onChange: (patch: Partial<AppointmentDraft>) => void;
  errors: Partial<Record<string, string>>;
  doctors: Doctor[];
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const typeOptions: { value: AppointmentType; label: string }[] = APPOINTMENT_TYPES.map((value) => ({
    value,
    label: t(`appointments.type.${value}`),
  }));
  const doctorOptions = [
    { value: '', label: t('appointments.noDoctor') },
    ...doctors.map((doctor) => ({ value: doctor.id, label: doctor.name })),
  ];

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'title':
        return t('appointments.errors.title');
      case 'date':
        return t('appointments.errors.date');
      case 'startTime':
        return t('appointments.errors.startTime');
      case 'endTime':
        return t('appointments.errors.endTime');
      case 'endBeforeStart':
        return t('appointments.errors.endBeforeStart');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  return (
    <>
      {/* Main info */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('appointments.fields.title')}
          value={draft.title}
          onChangeText={(value) => onChange({ title: value })}
          placeholder={t('appointments.placeholders.title')}
          required
          error={fieldError(errors.title)}
        />
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>
            {t('appointments.fields.type')}
          </Text>
          <FigmaChipSelect
            value={draft.type}
            options={typeOptions}
            onChange={(value) => onChange({ type: value })}
          />
        </View>
      </FigmaFormCard>

      {/* Date & time */}
      <FigmaFormCard label={t('appointments.dateTimeTitle')}>
        <View style={styles.field}>
          <FigmaFieldLabel label={t('appointments.fields.date')} required />
          <DateField
            value={draft.date}
            onChange={(value) => onChange({ date: value })}
            accessibilityLabel={t('appointments.fields.date')}
            error={fieldError(errors.date)}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <FigmaFieldLabel label={t('appointments.fields.startTime')} required />
            <TimeField
              value={draft.startTime}
              onChange={(value) => onChange({ startTime: value })}
              accessibilityLabel={t('appointments.fields.startTime')}
              error={fieldError(errors.start_time)}
            />
          </View>
          <View style={styles.col}>
            <FigmaFieldLabel label={t('appointments.fields.endTime')} />
            <TimeField
              value={draft.endTime}
              onChange={(value) => onChange({ endTime: value })}
              clearable
              accessibilityLabel={t('appointments.fields.endTime')}
              error={fieldError(errors.end_time)}
            />
          </View>
        </View>
      </FigmaFormCard>

      {/* Location & doctor */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('appointments.fields.location')}
          value={draft.location}
          onChangeText={(value) => onChange({ location: value })}
          placeholder={t('appointments.placeholders.location')}
          error={fieldError(errors.location)}
        />
        {doctors.length > 0 ? (
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>
              {t('appointments.fields.doctor')}
            </Text>
            <FigmaChipSelect
              value={draft.doctorId}
              options={doctorOptions}
              onChange={(value) => onChange({ doctorId: value })}
            />
          </View>
        ) : null}
      </FigmaFormCard>

      {/* Notes */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('appointments.fields.notes')}
          value={draft.notes}
          onChangeText={(value) => onChange({ notes: value })}
          placeholder={t('appointments.placeholders.notes')}
          multiline
          error={fieldError(errors.notes)}
        />
      </FigmaFormCard>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  groupLabel: { fontSize: 14, fontFamily: FigmaFont.semibold },
  field: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three },
  col: { flex: 1, gap: Spacing.two },
});
