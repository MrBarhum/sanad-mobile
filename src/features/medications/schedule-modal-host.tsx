import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormModal } from '@/components/form-modal';

import type { MedicationSchedule } from './api';
import { useCreateSchedule, useUpdateSchedule } from './hooks';
import {
  ScheduleFields,
  defaultScheduleDraft,
  prepareSchedule,
  scheduleToDraft,
  type ScheduleDraft,
} from './schedule-fields';

/** Add/edit a single schedule in a bottom-sheet modal (managers only). */
export function ScheduleModalHost({
  circleId,
  medicationId,
  initial,
  onClose,
}: {
  circleId: string;
  medicationId: string;
  initial: MedicationSchedule | null;
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

  async function onSubmit() {
    const prepared = prepareSchedule(draft);
    if (!prepared.ok) {
      setErrors(prepared.errors);
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
      submitLabel={t('common.save')}
      cancelLabel={t('common.cancel')}
      closeLabel={t('common.close')}
      submitting={submitting}
      error={submitError}
      onSubmit={onSubmit}
      onClose={onClose}>
      <ScheduleFields value={draft} onChange={setDraft} errors={errors} />
    </FormModal>
  );
}
