import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { StickyFormActions } from '@/components/form-actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useDoctors } from '@/features/doctors/hooks';

import {
  AppointmentFieldset,
  defaultAppointmentDraft,
  prepareAppointment,
  type AppointmentDraft,
} from './appointment-fields';
import { useCreateAppointment } from './hooks';

/** Add-appointment form (managers only). */
export function AppointmentForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
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
    <ThemedView style={styles.container}>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
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
        </ScrollView>

        <StickyFormActions
          saveLabel={t('appointments.add')}
          onSave={onSubmit}
          saving={submitting}
          disabled={!dirty}
          status={submitError ? 'error' : 'idle'}
          errorLabel={submitError ?? undefined}
        />
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  flex: { flex: 1, width: '100%' },
  scroll: { flex: 1, width: '100%' },
  content: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
});
