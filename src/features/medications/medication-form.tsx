import { useRouter } from 'expo-router';
import { AlertCircle, ChevronRight, Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptionSelect } from '@/components/option-select';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useMemberOptions } from '@/features/circle-members/member-assignment';
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
 * Add-medication form, rebuilt to the Dar "6b" frame (green band header + gold
 * non-diagnostic banner + section cards + inline text fields + responsible chips +
 * the schedule editor + a full-width save), wired to Sanad's real create flow,
 * schema, and the protected schedule validation. Everything is inline-Dar and
 * scoped to Medications — no shared form component is restyled. Behaviour, data,
 * validation and copy are unchanged (bare ghost placeholders per the Dar correction).
 */
export function MedicationForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const responsibleOptions = useMemberOptions(circleId, responsibleUserId);

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
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Form header band */}
        <View style={[styles.band, { backgroundColor: c.band, paddingTop: insets.top + 16 }]}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[styles.bandBack, { borderColor: c.bandInk }]}>
            <ChevronRight size={20} color={c.bandInk} strokeWidth={2.4} />
          </Pressable>
          <View style={styles.bandTitleCol}>
            <Text style={[styles.bandTitle, { color: c.bandInk }]}>{t('medications.addTitle')}</Text>
            <Text style={[styles.bandSubtitle, { color: c.bandInk }]}>{t('medications.addSubtitle')}</Text>
          </View>
          <View style={styles.bandSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <UnsavedChangesGuard when={dirty && !submitted} />

          {/* Non-diagnostic disclaimer (gold) */}
          <View style={[styles.disclaimer, { backgroundColor: c.goldFill, borderColor: c.border }]}>
            <Info size={20} color={c.goldInk} strokeWidth={2.2} style={styles.disclaimerIcon} />
            <Text style={[styles.disclaimerText, { color: c.goldInk }]}>{t('medications.disclaimer')}</Text>
          </View>

          {/* Medication info */}
          <Surface tone="card" padded={14} gap={14}>
            <SectionHeader title={t('medications.medicationInfoTitle')} />
            <MedField
              label={t('medications.fields.name')}
              required
              value={name}
              onChangeText={setName}
              placeholder={t('medications.placeholders.name')}
              error={medFieldError(medErrors.name)}
            />
            <MedField
              label={t('medications.fields.dosage')}
              value={dosage}
              onChangeText={setDosage}
              placeholder={t('medications.placeholders.dosage')}
              error={medFieldError(medErrors.dosage)}
            />
            <MedField
              label={t('medications.fields.form')}
              value={medForm}
              onChangeText={setMedForm}
              placeholder={t('medications.placeholders.form')}
              error={medFieldError(medErrors.form)}
            />
            <MedField
              label={t('medications.fields.instructions')}
              value={instructions}
              onChangeText={setInstructions}
              placeholder={t('medications.placeholders.instructions')}
              multiline
              error={medFieldError(medErrors.instructions)}
            />
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={[styles.switchLabel, { color: c.text }]}>{t('medications.fields.withFood')}</Text>
                <Text style={[styles.switchHint, { color: c.textSecondary }]}>{t('medications.withFoodReminder')}</Text>
              </View>
              <DarSwitch
                value={withFood}
                onValueChange={setWithFood}
                accessibilityLabel={t('medications.fields.withFood')}
              />
            </View>
          </Surface>

          {/* Responsible person — the ONE shared selector (per the single-component
              law); no per-screen custom chips. */}
          <Surface tone="card" padded={14} gap={12}>
            <SectionHeader title={t('assignment.responsible')} />
            <OptionSelect
              value={responsibleUserId}
              options={responsibleOptions}
              onChange={setResponsibleUserId}
            />
          </Surface>

          {/* Dose schedule */}
          <Surface tone="card" padded={14} gap={12}>
            <SectionHeader title={t('medications.firstScheduleTitle')} />
            <FigmaScheduleFields value={schedule} onChange={setSchedule} errors={scheduleErrors} />
          </Surface>

          {/* Notes */}
          <Surface tone="card" padded={14}>
            <MedField
              label={t('medications.fields.scheduleNotes')}
              value={schedule.notes}
              onChangeText={(notes) => setSchedule((current) => ({ ...current, notes }))}
              placeholder={t('medications.placeholders.scheduleNotes')}
              multiline
              error={scheduleErrors.notes ? t('validation.tooLong') : undefined}
            />
          </Surface>

          {/* Primary CTA — always a visible green button; an invalid press runs
              validation and reveals the inline errors. */}
          {submitError ? (
            <Text
              style={[styles.footerError, { color: c.errorFg }]}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          ) : null}
          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t('medications.add')}
            style={[styles.saveBtn, { backgroundColor: c.primary, borderColor: c.border, opacity: submitting ? 0.7 : 1 }]}>
            <Text style={[styles.saveText, { color: c.onPrimary }]}>{t('medications.add')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Inline Dar text field: 2px border, sunken fill (terr on error), acc focus ring. */
function MedField({
  label,
  required,
  value,
  onChangeText,
  placeholder,
  error,
  multiline,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string;
  multiline?: boolean;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.errorFg : focused ? c.primaryText : c.border;
  const backgroundColor = error ? c.errorBg : c.backgroundSunken;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>
        {label}
        {required ? <Text style={{ color: c.errorFg }}>{` (${t('common.required')})`}</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, { borderColor, backgroundColor, color: c.text }, multiline && styles.inputMultiline]}
      />
      {error ? (
        <View style={styles.fieldErrorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <AlertCircle size={15} color={c.errorFg} strokeWidth={2.4} />
          <Text style={[styles.fieldErrorText, { color: c.errorFg }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The Dar brand toggle (48×28 pill): 2px border, sunken off / btn on, card thumb. */
function DarSwitch({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {
          backgroundColor: value ? c.primary : c.backgroundSunken,
          borderColor: value ? c.primary : c.border,
          justifyContent: value ? 'flex-end' : 'flex-start',
        },
      ]}>
      <View style={[styles.thumb, { backgroundColor: c.backgroundElement, borderColor: c.border }]} />
    </Pressable>
  );
}

const R8 = Radius.card;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Header band
  band: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  bandBack: {
    width: 44,
    height: 44,
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bandTitleCol: { flex: 1, minWidth: 0 },
  bandTitle: { fontSize: 20, fontFamily: FontFamily.bold, lineHeight: 28 },
  bandSubtitle: { fontSize: 14, fontFamily: FontFamily.medium, opacity: 0.85 },
  bandSpacer: { width: 44, flexShrink: 0 },
  // Scroll body
  scroll: { paddingHorizontal: 14, paddingTop: 14, gap: 12 },
  // Disclaimer
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disclaimerIcon: { marginTop: 2 },
  disclaimerText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 25 },
  // Fields
  field: { gap: 5 },
  fieldLabel: { fontSize: 15, fontFamily: FontFamily.semibold },
  input: {
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontFamily: FontFamily.medium,
    minHeight: 48,
  },
  inputMultiline: { minHeight: 84, paddingTop: 11 },
  fieldErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  fieldErrorText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold },
  // With-food row
  divider: { height: BorderWidth.standard, alignSelf: 'stretch' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 15, fontFamily: FontFamily.medium },
  switchHint: { fontSize: 14, fontFamily: FontFamily.medium },
  track: {
    width: 48,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.thin,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  thumb: { width: 20, height: 20, borderRadius: 10, borderWidth: BorderWidth.thin },
  // Footer
  footerError: { fontSize: 14, fontFamily: FontFamily.medium, textAlign: 'center' },
  saveBtn: {
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveText: { fontSize: 17, fontFamily: FontFamily.bold },
});
