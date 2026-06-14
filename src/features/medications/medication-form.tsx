import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { StickyFormActions } from '@/components/form-actions';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { Section } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { fieldErrors } from '@/utils/form';

import { useCreateMedication } from './hooks';
import { medicationSchema } from './schema';
import {
  ScheduleFields,
  defaultScheduleDraft,
  prepareSchedule,
  type ScheduleDraft,
} from './schedule-fields';
import { duplicateTimesInDraft } from './schedule-validation';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Add-medication form: medication details plus its first dose schedule. */
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
  const [submitted, setSubmitted] = useState(false);

  const { dirty } = useUnsavedChanges({ name, dosage, medForm, instructions, withFood, schedule });
  const submitting = create.isPending;
  // Mirror the schedule modal: block save while the schedule has duplicate times
  // (the inline error in ScheduleFields tells the user which rows to fix).
  const hasDuplicateTimes = duplicateTimesInDraft(schedule).length > 0;

  // Navigate back only after the guard has released (next commit), so a successful
  // save doesn't trip the unsaved-changes prompt.
  useEffect(() => {
    if (submitted) router.back();
  }, [submitted, router]);

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
      setSubmitted(true);
    } catch {
      setSubmitError(t('medications.saveFailed'));
    }
  }

  return (
    <Screen
      maxWidth={MaxFormWidth}
      keyboardAvoiding
      footer={
        <StickyFormActions
          saveLabel={t('medications.add')}
          onSave={onSubmit}
          saving={submitting}
          disabled={!dirty || hasDuplicateTimes}
          status={submitError ? 'error' : 'idle'}
          errorLabel={submitError ?? undefined}
        />
      }>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <ThemedText type="small" themeColor="textMuted">
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
          trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
          accessibilityLabel={t('medications.fields.withFood')}
        />
      </View>

      <ThemedView type="border" style={styles.divider} />

      <Section title={t('medications.firstScheduleTitle')}>
        <ScheduleFields value={schedule} onChange={setSchedule} errors={scheduleErrors} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginTop: Spacing.one },
});
