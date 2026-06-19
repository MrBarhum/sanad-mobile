import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormModal } from '@/components/form-modal';
import { confirmDiscard } from '@/utils/confirm';
import { formatHm } from '@/utils/date';

import type { MedicationSchedule } from './api';
import { useCreateSchedule, useUpdateSchedule } from './hooks';
import {
  ScheduleFields,
  WEEKDAY_KEYS,
  defaultScheduleDraft,
  prepareSchedule,
  scheduleToDraft,
  type ScheduleDraft,
} from './schedule-fields';
import { findScheduleConflicts } from './schedule-validation';

/** Add/edit a single dose schedule in a bottom-sheet modal (managers only). */
export function ScheduleModalHost({
  circleId,
  medicationId,
  initial,
  existing,
  onClose,
}: {
  circleId: string;
  medicationId: string;
  initial: MedicationSchedule | null;
  /** All schedules for this medication, used to detect weekday+time conflicts. */
  existing: MedicationSchedule[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateSchedule(circleId, medicationId);
  const update = useUpdateSchedule(circleId);

  const [draft, setDraft] = useState<ScheduleDraft>(() =>
    initial ? scheduleToDraft(initial) : defaultScheduleDraft(),
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitting = create.isPending || update.isPending;
  const baseline = JSON.stringify(initial ? scheduleToDraft(initial) : defaultScheduleDraft());
  const dirty = JSON.stringify(draft) !== baseline;

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

  async function onSubmit() {
    const prepared = prepareSchedule(draft);
    if (!prepared.ok) {
      setErrors(prepared.errors);
      return;
    }

    // Block exact same weekday+time slots that already exist in another active
    // schedule. Overlapping days at different times stay allowed.
    const conflicts = findScheduleConflicts(draft, existing, initial?.id);
    if (conflicts.length > 0) {
      const first = conflicts[0];
      setErrors({});
      setSubmitError(
        t('medications.errors.conflict', {
          day: t(`medications.weekdays.${WEEKDAY_KEYS[first.day]}`),
          time: formatHm(first.time),
        }),
      );
      return;
    }

    setErrors({});
    setSubmitError(null);
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, schedule: prepared.input });
      } else {
        await create.mutateAsync(prepared.input);
      }
      onClose();
    } catch {
      setSubmitError(t('medications.saveFailed'));
    }
  }

  return (
    <FormModal
      visible
      title={initial ? t('medications.editScheduleTitle') : t('medications.addScheduleTitle')}
      submitLabel={initial ? t('medications.saveScheduleChanges') : t('medications.addScheduleSubmit')}
      cancelLabel={t('common.cancel')}
      closeLabel={t('common.close')}
      submitting={submitting}
      error={submitError}
      onSubmit={onSubmit}
      onClose={requestClose}>
      <ScheduleFields value={draft} onChange={setDraft} errors={errors} />
    </FormModal>
  );
}
