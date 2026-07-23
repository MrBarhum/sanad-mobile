import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/form-field';
import { FormModal } from '@/components/form-modal';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { confirmDiscard } from '@/utils/confirm';
import { fieldErrors } from '@/utils/form';

import type { Doctor } from './api';
import { useCreateDoctor, useUpdateDoctor } from './hooks';
import { doctorSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * The validated add/edit doctor form modal — the live Figma doctors screen mounts
 * this for both adding and editing a doctor. Extracted from the (now removed)
 * legacy DoctorsManager so the one surviving piece stands on its own.
 */
export function DoctorFormModal({
  circleId,
  initial,
  onClose,
}: {
  circleId: string;
  initial: Doctor | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateDoctor(circleId);
  const update = useUpdateDoctor(circleId);

  const [name, setName] = useState(initial?.name ?? '');
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [clinicName, setClinicName] = useState(initial?.clinic_name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { dirty } = useUnsavedChanges({ name, specialty, phone, clinicName, notes });
  const submitting = create.isPending || update.isPending;

  function requestClose() {
    if (!dirty) {
      onClose();
      return;
    }
    confirmDiscard(
      {
        title: t('common.unsavedTitle'),
        message: t('common.unsavedMessage'),
        confirm: t('common.discardChanges'),
        cancel: t('common.keepEditing'),
      },
      onClose,
    );
  }

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'name':
        return t('doctors.errors.name');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  async function onSubmit() {
    const parsed = doctorSchema.safeParse({ name, specialty, phone, clinic_name: clinicName, notes });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitError(null);
    const input = {
      name: parsed.data.name,
      specialty: nullify(parsed.data.specialty),
      phone: nullify(parsed.data.phone),
      clinic_name: nullify(parsed.data.clinic_name),
      notes: nullify(parsed.data.notes),
    };

    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, input });
      } else {
        await create.mutateAsync(input);
      }
      onClose();
    } catch {
      setSubmitError(t('doctors.saveFailed'));
    }
  }

  return (
    <FormModal
      visible
      title={initial ? t('doctors.editTitle') : t('doctors.addTitle')}
      submitLabel={initial ? t('common.saveChanges') : t('doctors.add')}
      cancelLabel={t('common.cancel')}
      closeLabel={t('common.close')}
      submitting={submitting}
      error={submitError}
      onSubmit={onSubmit}
      onClose={requestClose}>
      <FormField
        label={t('doctors.fields.name')}
        value={name}
        onChangeText={setName}
        required
        error={fieldError(errors.name)}
      />
      <FormField
        label={t('doctors.fields.specialty')}
        value={specialty}
        onChangeText={setSpecialty}
        placeholder={t('doctors.placeholders.specialty')}
        error={fieldError(errors.specialty)}
      />
      <FormField
        label={t('doctors.fields.phone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        error={fieldError(errors.phone)}
      />
      <FormField
        label={t('doctors.fields.clinicName')}
        value={clinicName}
        onChangeText={setClinicName}
        placeholder={t('doctors.placeholders.clinicName')}
        error={fieldError(errors.clinic_name)}
      />
      <FormField
        label={t('doctors.fields.notes')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('doctors.placeholders.notes')}
        multiline
        error={fieldError(errors.notes)}
      />
    </FormModal>
  );
}
