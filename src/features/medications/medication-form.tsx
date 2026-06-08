import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fieldErrors } from '@/utils/form';

import { useCreateMedication } from './hooks';
import { medicationSchema } from './schema';
import {
  ScheduleFields,
  defaultScheduleDraft,
  prepareSchedule,
  type ScheduleDraft,
} from './schedule-fields';

const DANGER = '#dc2626';
const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Add-medication form: medication details plus its first schedule. */
export function MedicationForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const create = useCreateMedication(circleId);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [medForm, setMedForm] = useState('');
  const [instructions, setInstructions] = useState('');
  const [withFood, setWithFood] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleDraft>(() => defaultScheduleDraft());
  const [medErrors, setMedErrors] = useState<Partial<Record<string, string>>>({});
  const [scheduleErrors, setScheduleErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitting = create.isPending;

  function medFieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'name':
        return t('medications.errors.name');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  async function onSubmit() {
    const med = medicationSchema.safeParse({
      name,
      dosage,
      form: medForm,
      instructions,
      with_food: withFood,
    });
    const prepared = prepareSchedule(schedule);

    setMedErrors(med.success ? {} : fieldErrors(med.error));
    setScheduleErrors(prepared.ok ? {} : prepared.errors);
    if (!med.success || !prepared.ok) return;

    setSubmitError(null);
    try {
      await create.mutateAsync({
        medication: {
          name: med.data.name,
          dosage: nullify(med.data.dosage),
          form: nullify(med.data.form),
          instructions: nullify(med.data.instructions),
          with_food: med.data.with_food,
        },
        schedule: prepared.input,
      });
      router.back();
    } catch {
      setSubmitError(t('medications.saveFailed'));
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
            {t('medications.disclaimer')}
          </ThemedText>

          <FormField
            label={t('medications.fields.name')}
            value={name}
            onChangeText={setName}
            error={medFieldError(medErrors.name)}
          />
          <FormField
            label={t('medications.fields.dosage')}
            value={dosage}
            onChangeText={setDosage}
            placeholder={t('medications.placeholders.dosage')}
            error={medFieldError(medErrors.dosage)}
          />
          <FormField
            label={t('medications.fields.form')}
            value={medForm}
            onChangeText={setMedForm}
            placeholder={t('medications.placeholders.form')}
            error={medFieldError(medErrors.form)}
          />
          <FormField
            label={t('medications.fields.instructions')}
            value={instructions}
            onChangeText={setInstructions}
            placeholder={t('medications.placeholders.instructions')}
            multiline
            error={medFieldError(medErrors.instructions)}
          />
          <View style={styles.switchRow}>
            <ThemedText type="smallBold">{t('medications.fields.withFood')}</ThemedText>
            <Switch
              value={withFood}
              onValueChange={setWithFood}
              trackColor={{ true: theme.text, false: theme.backgroundSelected }}
              accessibilityLabel={t('medications.fields.withFood')}
            />
          </View>

          <ThemedView type="backgroundSelected" style={styles.divider} />
          <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
            {t('medications.scheduleSectionTitle')}
          </ThemedText>

          <ScheduleFields value={schedule} onChange={setSchedule} errors={scheduleErrors} />

          {submitError ? (
            <ThemedText style={styles.submitError} accessibilityRole="alert">
              {submitError}
            </ThemedText>
          ) : null}

          <Button
            label={t('medications.saveMedication')}
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: Spacing.one },
  sectionTitle: { fontSize: 22, lineHeight: 30 },
  submitError: { color: DANGER },
  save: { marginTop: Spacing.two },
});
