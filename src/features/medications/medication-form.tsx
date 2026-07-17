import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import {
  FigmaFormCard,
  FigmaFormField,
  FigmaFormScreen,
  FigmaSwitch,
} from '@/components/figma/figma-form-screen';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { FontFamily, Spacing } from '@/constants/theme';
import { MemberSelect } from '@/features/circle-members/member-assignment';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { todayYmd } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import { FigmaScheduleFields, scheduleDatesValid } from './figma-schedule-fields';
import { useCreateMedication } from './hooks';
import { medicationSchema } from './schema';
import { defaultScheduleDraft, prepareSchedule, type ScheduleDraft } from './schedule-fields';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Add-medication form — an exact-copy rebuild of the Figma `AddMedicationScreen`
 * (header + gold disclaimer + medication-info card + dose-schedule card + notes
 * card + sticky save), wired to Sanad's real create flow, schema, and the
 * protected schedule validation. The Figma export's blue/IBM-Plex are replaced
 * with the committed teal/IBM Plex tokens, and its native time/date inputs with the
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
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [schedule, setSchedule] = useState<ScheduleDraft>(() => defaultScheduleDraft());
  const [medErrors, setMedErrors] = useState<Partial<Record<string, string>>>({});
  const [scheduleErrors, setScheduleErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { dirty } = useUnsavedChanges({
    name,
    dosage,
    medForm,
    instructions,
    withFood,
    responsibleUserId,
    schedule,
  });
  const submitting = create.isPending;
  // Whether the schedule's add-flow date constraints hold (no past dates; end not
  // before start). The pickers enforce this; onSubmit re-checks before saving.
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
    // Block invalid submits here (not via a disabled button): prepareSchedule
    // rejects duplicate/short schedules, and the schedule fields surface past /
    // end-before-start dates inline. The CTA itself stays a visible green button.
    if (!med.success || !prepared.ok || !datesValid) return;

    setSubmitError(null);
    try {
      await create.mutateAsync({
        medication: {
          name: med.data.name,
          dosage: nullify(med.data.dosage),
          form: nullify(med.data.form),
          instructions: nullify(med.data.instructions),
          with_food: med.data.with_food,
          responsible_user_id: responsibleUserId === '' ? null : responsibleUserId,
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
      disclaimer={t('medications.disclaimer')}>
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

      {/* Responsible person */}
      <FigmaFormCard>
        <MemberSelect
          circleId={circleId}
          value={responsibleUserId}
          label={t('assignment.responsible')}
          onChange={setResponsibleUserId}
        />
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
        <FigmaFooterPrimaryButton label={t('medications.add')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: Spacing.two },
  footerError: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 15, fontFamily: FontFamily.regular },
  switchHint: { fontSize: 13, fontFamily: FontFamily.regular },
});
