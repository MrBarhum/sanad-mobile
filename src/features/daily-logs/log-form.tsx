import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';

import { useCreateDailyLog } from './hooks';
import {
  DailyLogFieldset,
  defaultDailyLogDraft,
  prepareDailyLog,
  type DailyLogDraft,
} from './log-fields';

const DANGER = '#dc2626';

/** Add-daily-log form (caregiving roles only). */
export function DailyLogForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateDailyLog(circleId);

  const [draft, setDraft] = useState<DailyLogDraft>(() => defaultDailyLogDraft());
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitting = create.isPending;

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
      router.back();
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
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            {t('dailyLogs.disclaimer')}
          </ThemedText>

          <DailyLogFieldset draft={draft} onChange={patch} errors={errors} />

          {submitError ? (
            <ThemedText style={styles.submitError} accessibilityRole="alert">
              {submitError}
            </ThemedText>
          ) : null}

          <Button
            label={t('dailyLogs.saveLog')}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.save}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  flex: { flex: 1, width: '100%' },
  content: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  submitError: { color: DANGER },
  save: { marginTop: Spacing.two },
});
