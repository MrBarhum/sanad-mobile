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

import { FigmaVitalFields } from './figma-vital-fields';
import { useCreateVital } from './hooks';
import { defaultVitalDraft, prepareVital, type VitalDraft } from './vital-fields';

/**
 * Add-vital-reading form — an exact-copy rebuild of the Figma `AddVitalScreen`
 * (header + gold non-diagnostic disclaimer + measurement-type card + value card
 * + date-time card + notes card + sticky save), wired to Sanad's real create
 * flow + `prepareVital` validation. Figma's blue/IBM-Plex are replaced with the
 * committed teal/IBM Plex; its native date/time inputs with the protected wheel
 * pickers. No diagnosis, no value interpretation, no health-color coding.
 */
export function VitalForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
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
    <FigmaFormScreen
      title={t('vitals.addTitle')}
      subtitle={t('vitals.addSubtitle')}
      onBack={() => router.back()}
      disclaimer={t('vitals.disclaimer')}>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <FigmaVitalFields draft={draft} onChange={patch} errors={errors} />

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
        <FigmaFooterPrimaryButton label={t('vitals.add')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: Spacing.two },
  footerError: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});
