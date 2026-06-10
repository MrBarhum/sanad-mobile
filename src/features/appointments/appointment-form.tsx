import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useDoctors } from '@/features/doctors/hooks';

import {
  AppointmentFieldset,
  defaultAppointmentDraft,
  prepareAppointment,
  type AppointmentDraft,
} from './appointment-fields';
import { useCreateAppointment } from './hooks';

const DANGER = '#dc2626';

/** Add-appointment form (managers only). */
export function AppointmentForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateAppointment(circleId);
  const doctorsQuery = useDoctors(circleId);

  const [draft, setDraft] = useState<AppointmentDraft>(() => defaultAppointmentDraft());
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitting = create.isPending;

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
      router.back();
    } catch {
      setSubmitError(t('appointments.saveFailed'));
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
            {t('appointments.disclaimer')}
          </ThemedText>

          <AppointmentFieldset
            draft={draft}
            onChange={patch}
            errors={errors}
            doctors={doctorsQuery.data ?? []}
          />

          {submitError ? (
            <ThemedText style={styles.submitError} accessibilityRole="alert">
              {submitError}
            </ThemedText>
          ) : null}

          <Button
            label={t('appointments.saveAppointment')}
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
