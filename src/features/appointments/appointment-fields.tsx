import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { OptionSelect, type SelectOption } from '@/components/option-select';
import { Spacing } from '@/constants/theme';
import type { Doctor } from '@/features/doctors/api';
import { combineDateTimeToInstant, hmFromInstant, ymdFromInstant } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import type { AppointmentInput, AppointmentType, CareAppointment } from './api';
import { APPOINTMENT_TYPES, appointmentSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Editable appointment draft kept as form-friendly strings. */
export type AppointmentDraft = {
  title: string;
  type: AppointmentType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  doctorId: string;
  notes: string;
};

export function defaultAppointmentDraft(): AppointmentDraft {
  return {
    title: '',
    type: 'general',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    doctorId: '',
    notes: '',
  };
}

/** Builds a draft from an existing appointment row (splits the timestamps). */
export function appointmentDraftFromRow(row: CareAppointment): AppointmentDraft {
  return {
    title: row.title,
    type: row.appointment_type,
    date: ymdFromInstant(row.starts_at),
    startTime: hmFromInstant(row.starts_at),
    endTime: row.ends_at ? hmFromInstant(row.ends_at) : '',
    location: row.location ?? '',
    doctorId: row.doctor_id ?? '',
    notes: row.notes ?? '',
  };
}

type PreparedAppointment =
  | { ok: true; input: AppointmentInput }
  | { ok: false; errors: Partial<Record<string, string>> };

/** Validates the draft and combines date + times into ISO timestamps. */
export function prepareAppointment(draft: AppointmentDraft): PreparedAppointment {
  const parsed = appointmentSchema.safeParse({
    title: draft.title,
    date: draft.date,
    start_time: draft.startTime,
    end_time: draft.endTime,
    location: draft.location,
    notes: draft.notes,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const startsAt = combineDateTimeToInstant(parsed.data.date, parsed.data.start_time);
  if (!startsAt) return { ok: false, errors: { start_time: 'startTime' } };
  const endsAt =
    parsed.data.end_time === ''
      ? null
      : combineDateTimeToInstant(parsed.data.date, parsed.data.end_time);

  return {
    ok: true,
    input: {
      title: parsed.data.title,
      appointment_type: draft.type,
      starts_at: startsAt,
      ends_at: endsAt,
      location: nullify(parsed.data.location),
      doctor_id: draft.doctorId === '' ? null : draft.doctorId,
      notes: nullify(parsed.data.notes),
    },
  };
}

/** Controlled inputs for an appointment, shared by the create + edit screens. */
export function AppointmentFieldset({
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

  const typeOptions: SelectOption<AppointmentType>[] = APPOINTMENT_TYPES.map((value) => ({
    value,
    label: t(`appointments.type.${value}`),
  }));
  const doctorOptions: SelectOption<string>[] = [
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
    <View style={styles.fields}>
      <FormField
        label={t('appointments.fields.title')}
        value={draft.title}
        onChangeText={(value) => onChange({ title: value })}
        placeholder={t('appointments.placeholders.title')}
        error={fieldError(errors.title)}
      />

      <OptionSelect
        label={t('appointments.fields.type')}
        value={draft.type}
        options={typeOptions}
        onChange={(value) => onChange({ type: value })}
      />

      <FormField
        label={t('appointments.fields.date')}
        value={draft.date}
        onChangeText={(value) => onChange({ date: value })}
        placeholder={t('appointments.placeholders.date')}
        autoCapitalize="none"
        error={fieldError(errors.date)}
      />
      <FormField
        label={t('appointments.fields.startTime')}
        value={draft.startTime}
        onChangeText={(value) => onChange({ startTime: value })}
        placeholder={t('appointments.placeholders.startTime')}
        autoCapitalize="none"
        error={fieldError(errors.start_time)}
      />
      <FormField
        label={t('appointments.fields.endTime')}
        value={draft.endTime}
        onChangeText={(value) => onChange({ endTime: value })}
        placeholder={t('appointments.placeholders.endTime')}
        autoCapitalize="none"
        error={fieldError(errors.end_time)}
      />

      <FormField
        label={t('appointments.fields.location')}
        value={draft.location}
        onChangeText={(value) => onChange({ location: value })}
        placeholder={t('appointments.placeholders.location')}
        error={fieldError(errors.location)}
      />

      {doctors.length > 0 ? (
        <OptionSelect
          label={t('appointments.fields.doctor')}
          value={draft.doctorId}
          options={doctorOptions}
          onChange={(value) => onChange({ doctorId: value })}
        />
      ) : null}

      <FormField
        label={t('appointments.fields.notes')}
        value={draft.notes}
        onChangeText={(value) => onChange({ notes: value })}
        placeholder={t('appointments.placeholders.notes')}
        multiline
        error={fieldError(errors.notes)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: Spacing.three },
});
