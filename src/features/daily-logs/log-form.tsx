import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormScreen } from '@/components/figma/figma-form-screen';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

import { FigmaDailyLogFields } from './figma-daily-log-fields';
import { useCreateDailyLog } from './hooks';
import { defaultDailyLogDraft, prepareDailyLog, type DailyLogDraft } from './log-fields';

/**
 * Add-daily-log form — an exact-copy rebuild of the Figma `AddDailyLogScreen`
 * (header + gold non-diagnostic banner + date / observations / pain / notes
 * cards), wired to Sanad's real create flow + schema. Figma's blue/IBM-Plex
 * become teal/IBM Plex. The observational disclaimer, the "غير محدّد" unset states,
 * and the distinct "بدون" pain state are preserved; the one-log-per-date conflict
 * surfaces its specific message.
 */
export function DailyLogForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
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
        code === '23505' ? t('dailyLogs.errors.alreadyLoggedToday') : t('dailyLogs.saveFailed'),
      );
    }
  }

  return (
    <FigmaFormScreen
      title={t('dailyLogs.addTitle')}
      subtitle={t('dailyLogs.addSubtitle')}
      onBack={() => router.back()}
      disclaimer={t('dailyLogs.disclaimer')}>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <FigmaDailyLogFields draft={draft} onChange={patch} errors={errors} />

      {/* Primary CTA — rendered directly in the body (not the footer prop, which
          did not render on Android). Always a filled teal button; an invalid press
          runs validation and shows inline errors. */}
      <View style={styles.footer}>
        {submitError ? (
          <Text
            style={[styles.footerError, { color: theme.errorFg }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {submitError}
          </Text>
        ) : null}
        <FigmaFooterPrimaryButton label={t('dailyLogs.add')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: Spacing.two },
  footerError: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});
