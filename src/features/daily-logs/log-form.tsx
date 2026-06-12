import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StickyFormActions } from '@/components/form-actions';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MaxFormWidth } from '@/constants/theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

import { useCreateDailyLog } from './hooks';
import {
  DailyLogFieldset,
  defaultDailyLogDraft,
  prepareDailyLog,
  type DailyLogDraft,
} from './log-fields';

/** Add-daily-log form (caregiving roles only). */
export function DailyLogForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateDailyLog(circleId);

  const [draft, setDraft] = useState<DailyLogDraft>(() => defaultDailyLogDraft());
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { dirty } = useUnsavedChanges(draft);
  const submitting = create.isPending;

  useEffect(() => {
    if (submitted) router.back();
  }, [submitted, router]);

  function patch(part: Partial<DailyLogDraft>) {
    setDraft((current) => ({ ...current, ...part }));
  }

  async function onSubmit() {
    const prepared = prepareDailyLog(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) return;

    setSubmitError(null);
    try {
      await create.mutateAsync(prepared.input);
      setSubmitted(true);
    } catch (error) {
      // The DB enforces one log per author per date (partial unique index). Surface
      // that specific case instead of the generic failure so the user knows to edit
      // their existing log rather than retrying. 23505 = unique_violation.
      const code = (error as { code?: string } | null)?.code;
      setSubmitError(
        code === '23505'
          ? t('dailyLogs.errors.alreadyLoggedToday')
          : t('dailyLogs.saveFailed'),
      );
    }
  }

  return (
    <Screen
      maxWidth={MaxFormWidth}
      keyboardAvoiding
      footer={
        <StickyFormActions
          saveLabel={t('dailyLogs.add')}
          onSave={onSubmit}
          saving={submitting}
          disabled={!dirty}
          status={submitError ? 'error' : 'idle'}
          errorLabel={submitError ?? undefined}
        />
      }>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('dailyLogs.disclaimer')}
      </ThemedText>

      <DailyLogFieldset draft={draft} onChange={patch} errors={errors} />
    </Screen>
  );
}
