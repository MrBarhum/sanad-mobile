import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaButton } from '@/components/figma/figma-button';
import {
  FigmaFormCard,
  FigmaFormField,
  FigmaFormScreen,
  FigmaSwitch,
} from '@/components/figma/figma-form-screen';
import { FigmaFont } from '@/components/figma/figma-tokens';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { todayYmd } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import { FigmaScheduleFields, scheduleDatesValid } from './figma-schedule-fields';
import { useCreateMedication } from './hooks';
import { medicationSchema } from './schema';
import { defaultScheduleDraft, prepareSchedule, type ScheduleDraft } from './schedule-fields';
import { duplicateTimesInDraft } from './schedule-validation';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Add-medication form — an exact-copy rebuild of the Figma `AddMedicationScreen`
 * (header + gold disclaimer + medication-info card + dose-schedule card + notes
 * card + sticky save), wired to Sanad's real create flow, schema, and the
 * protected schedule validation. The Figma export's blue/IBM-Plex are replaced
 * with the committed teal/Cairo tokens, and its native time/date inputs with the
 * protected wheel pickers — but the layout, sections, and order match the export.
 */
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
  // (the inline error in the schedule fields tells the user which rows to fix).
  const hasDuplicateTimes = duplicateTimesInDraft(schedule).length > 0;
  // Block save when the schedule dates violate the add-flow constraints (no past
  // dates; end not before start). The pickers also enforce this via minDate.
  const datesValid = scheduleDatesValid(schedule, todayYmd());

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
    <FigmaFormScreen
      title={t('medications.addTitle')}
      subtitle={t('medications.addSubtitle')}
      onBack={() => router.back()}
      disclaimer={t('medications.disclaimer')}
      footer={
        <View style={styles.footer}>
          {submitError ? (
            <Text
              style={[styles.footerError, { color: theme.errorFg }]}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          ) : null}
          <FigmaButton
            label={t('medications.add')}
            onPress={onSubmit}
            loading={submitting}
            disabled={!dirty || hasDuplicateTimes || !datesValid}
          />
        </View>
      }>
      <UnsavedChangesGuard when={dirty && !submitted} />

      {/* Medication info */}
      <FigmaFormCard label={t('medications.medicationInfoTitle')}>
        <FigmaFormField
          label={t('medications.fields.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('medications.placeholders.name')}
          required
          error={medFieldError(medErrors.name)}
        />
        <FigmaFormField
          label={t('medications.fields.dosage')}
          value={dosage}
          onChangeText={setDosage}
          placeholder={t('medications.placeholders.dosage')}
          error={medFieldError(medErrors.dosage)}
        />
        <FigmaFormField
          label={t('medications.fields.form')}
          value={medForm}
          onChangeText={setMedForm}
          placeholder={t('medications.placeholders.form')}
          error={medFieldError(medErrors.form)}
        />
        <FigmaFormField
          label={t('medications.fields.instructions')}
          value={instructions}
          onChangeText={setInstructions}
          placeholder={t('medications.placeholders.instructions')}
          multiline
          error={medFieldError(medErrors.instructions)}
        />

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>
              {t('medications.fields.withFood')}
            </Text>
            <Text style={[styles.switchHint, { color: theme.textSecondary }]}>
              {t('medications.withFoodReminder')}
            </Text>
          </View>
          <FigmaSwitch
            value={withFood}
            onValueChange={setWithFood}
            accessibilityLabel={t('medications.fields.withFood')}
          />
        </View>
      </FigmaFormCard>

      {/* Dose schedule */}
      <FigmaFormCard label={t('medications.firstScheduleTitle')}>
        <FigmaScheduleFields value={schedule} onChange={setSchedule} errors={scheduleErrors} />
      </FigmaFormCard>

      {/* Notes */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('medications.fields.scheduleNotes')}
          value={schedule.notes}
          onChangeText={(notes) => setSchedule((current) => ({ ...current, notes }))}
          placeholder={t('medications.placeholders.scheduleNotes')}
          multiline
          error={scheduleErrors.notes ? t('validation.tooLong') : undefined}
        />
      </FigmaFormCard>
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: Spacing.two },
  footerError: { fontSize: 13, fontFamily: FigmaFont.regular, textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 15, fontFamily: FigmaFont.regular },
  switchHint: { fontSize: 13, fontFamily: FigmaFont.regular },
});
