import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StickyFormActions } from '@/components/form-actions';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MaxFormWidth } from '@/constants/theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

import { useCreateVital } from './hooks';
import { VitalFieldset, defaultVitalDraft, prepareVital, type VitalDraft } from './vital-fields';

/** Add-vital-reading form (caregiving roles only). */
export function VitalForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateVital(circleId);

  const [draft, setDraft] = useState<VitalDraft>(() => defaultVitalDraft());
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { dirty } = useUnsavedChanges(draft);
  const submitting = create.isPending;

  useEffect(() => {
    if (submitted) router.back();
  }, [submitted, router]);

  function patch(part: Partial<VitalDraft>) {
    setDraft((current) => ({ ...current, ...part }));
  }

  async function onSubmit() {
    const prepared = prepareVital(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) return;

    setSubmitError(null);
    try {
      await create.mutateAsync(prepared.input);
      setSubmitted(true);
    } catch {
      setSubmitError(t('vitals.saveFailed'));
    }
  }

  return (
    <Screen
      maxWidth={MaxFormWidth}
      keyboardAvoiding
      footer={
        <StickyFormActions
          saveLabel={t('vitals.add')}
          onSave={onSubmit}
          saving={submitting}
          disabled={!dirty}
          status={submitError ? 'error' : 'idle'}
          errorLabel={submitError ?? undefined}
        />
      }>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <ThemedText type="small" themeColor="textMuted">
        {t('vitals.disclaimer')}
      </ThemedText>

      <VitalFieldset draft={draft} onChange={patch} errors={errors} />
    </Screen>
  );
}
