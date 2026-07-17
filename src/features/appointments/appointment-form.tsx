import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormScreen, FigmaMutedNote } from '@/components/figma/figma-form-screen';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useDoctors } from '@/features/doctors/hooks';

import {
  defaultAppointmentDraft,
  prepareAppointment,
  type AppointmentDraft,
} from './appointment-fields';
import { FigmaAppointmentFields } from './figma-appointment-fields';
import { useCreateAppointment } from './hooks';

/**
 * Add-appointment form — an exact-copy rebuild of the Figma `AddAppointmentScreen`
 * wired to Sanad's real create flow, schema, and the real doctors list. Figma's
 * blue/IBM-Plex become teal/IBM Plex, its native date/time inputs become the
 * protected wheel pickers, and its hardcoded doctors become the real list.
 */
export function AppointmentForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const create = useCreateAppointment(circleId);
  const doctorsQuery = useDoctors(circleId);

  const [draft, setDraft] = useState<AppointmentDraft>(() => defaultAppointmentDraft());
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { dirty } = useUnsavedChanges(draft);
  const submitting = create.isPending;

  useEffect(() => {
    if (submitted) router.back();
  }, [submitted, router]);

  function patch(part: Partial<AppointmentDraft>) {
    setDraft((current) => ({ ...current, ...part }));
  }

  async function onSubmit() {
    const prepared = prepareAppointment(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) return;

    setSubmitError(null);
    try {
      await create.mutateAsync(prepared.input);
      setSubmitted(true);
    } catch {
      setSubmitError(t('appointments.saveFailed'));
    }
  }

  return (
    <FigmaFormScreen title={t('appointments.addTitle')} onBack={() => router.back()}>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <FigmaMutedNote>{t('appointments.disclaimer')}</FigmaMutedNote>

      <FigmaAppointmentFields
        circleId={circleId}
        draft={draft}
        onChange={patch}
        errors={errors}
        doctors={doctorsQuery.data ?? []}
      />

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
        <FigmaFooterPrimaryButton label={t('appointments.add')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: Spacing.two },
  footerError: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});
