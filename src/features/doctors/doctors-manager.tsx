import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ContactCard } from '@/components/contact-card';
import { FormField } from '@/components/form-field';
import { FormModal } from '@/components/form-modal';
import { ItemActions } from '@/components/item-actions';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Glyph } from '@/constants/glyphs';
import { Spacing } from '@/constants/theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { confirmDiscard } from '@/utils/confirm';
import { fieldErrors } from '@/utils/form';

import type { Doctor } from './api';
import { useCreateDoctor, useDeleteDoctor, useDoctors, useUpdateDoctor } from './hooks';
import { doctorSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Doctors list with add/edit/delete (managers only can mutate). */
export function DoctorsManager({ circleId, canManage }: { circleId: string; canManage: boolean }) {
  const { t } = useTranslation();
  const doctors = useDoctors(circleId);
  const deleteDoctor = useDeleteDoctor(circleId);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const modalOpen = adding || editing !== null;
  const closeModal = () => {
    setAdding(false);
    setEditing(null);
  };

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDoctor.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (doctors.isLoading) return <LoadingState />;
  if (doctors.isError) {
    return (
      <ErrorState
        message={t('doctors.loadError')}
        retryLabel={t('retry')}
        onRetry={() => doctors.refetch()}
      />
    );
  }

  const items = doctors.data ?? [];

  return (
    <>
      <Screen>
        {canManage ? (
          <Button glyph={Glyph.plus} label={t('doctors.add')} onPress={() => setAdding(true)} />
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={Glyph.doctor}
            title={t('doctors.emptyTitle')}
            subtitle={canManage ? t('doctors.emptySubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>
            {items.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                canManage={canManage}
                deleting={deletingId === doctor.id}
                onEdit={() => setEditing(doctor)}
                onDelete={() => onDelete(doctor.id)}
              />
            ))}
          </View>
        )}
      </Screen>

      {modalOpen ? (
        <DoctorFormModal
          key={editing?.id ?? 'new'}
          circleId={circleId}
          initial={editing}
          onClose={closeModal}
        />
      ) : null}
    </>
  );
}

function DoctorCard({
  doctor,
  canManage,
  deleting,
  onEdit,
  onDelete,
}: {
  doctor: Doctor;
  canManage: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ContactCard
      name={doctor.name}
      subtitle={doctor.specialty}
      details={[doctor.clinic_name]}
      phone={doctor.phone}
      callLabel={doctor.phone ? `${t('common.call')} ${doctor.name}` : undefined}
      notes={doctor.notes}>
      {canManage ? (
        <ItemActions
          deleting={deleting}
          onEdit={onEdit}
          onDelete={onDelete}
          labels={{
            edit: t('common.edit'),
            delete: t('common.delete'),
            confirm: t('common.confirmDelete'),
            cancel: t('common.cancel'),
          }}
        />
      ) : null}
    </ContactCard>
  );
}

/** The validated add/edit doctor form modal (also reused by the Figma screen). */
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

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
});
