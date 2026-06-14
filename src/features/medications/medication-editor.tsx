import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { FormActions } from '@/components/form-actions';
import { FormField } from '@/components/form-field';
import { ItemActions } from '@/components/item-actions';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Glyph } from '@/constants/glyphs';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { formatHm } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import type { Medication, MedicationSchedule } from './api';
import {
  useDeleteMedication,
  useDeleteSchedule,
  useMedication,
  useSchedulesByMedication,
  useSetMedicationActive,
  useSetScheduleActive,
  useUpdateMedication,
} from './hooks';
import { medicationSchema } from './schema';
import { WEEKDAY_KEYS } from './schedule-fields';
import { ScheduleModalHost } from './schedule-modal-host';
import { ScheduleSummary } from './schedule-summary';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Loads a medication + its schedules, then renders the view/edit screen. */
export function MedicationEditor({
  circleId,
  canManage,
  medicationId,
}: {
  circleId: string;
  canManage: boolean;
  medicationId: string;
}) {
  const { t } = useTranslation();
  const medication = useMedication(medicationId);
  const schedules = useSchedulesByMedication(medicationId);

  if (medication.isLoading || schedules.isLoading) return <LoadingState />;
  if (medication.isError || schedules.isError) {
    return (
      <ErrorState
        message={t('medications.loadError')}
        retryLabel={t('retry')}
        onRetry={() => {
          medication.refetch();
          schedules.refetch();
        }}
      />
    );
  }
  if (!medication.data) {
    return (
      <Screen scroll={false} center>
        <EmptyState icon={Glyph.medication} title={t('medications.notFound')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Section A — Medication information */}
      <Section title={t('medications.medicationInfoTitle')}>
        {canManage ? (
          <MedicationFields key={medication.data.id} circleId={circleId} initial={medication.data} />
        ) : (
          <ReadOnlyMedication medication={medication.data} />
        )}

        {canManage ? <ActivationRow circleId={circleId} medication={medication.data} /> : null}
      </Section>

      <ThemedView type="border" style={styles.divider} />

      {/* Section B — Dose schedules */}
      <SchedulesManager
        circleId={circleId}
        medicationId={medication.data.id}
        schedules={schedules.data ?? []}
        canManage={canManage}
      />

      {canManage ? <DeleteMedicationRow circleId={circleId} id={medication.data.id} /> : null}
    </Screen>
  );
}

function MedicationFields({ circleId, initial }: { circleId: string; initial: Medication }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateMedication(circleId);

  const [name, setName] = useState(initial.name);
  const [dosage, setDosage] = useState(initial.dosage ?? '');
  const [medForm, setMedForm] = useState(initial.form ?? '');
  const [instructions, setInstructions] = useState(initial.instructions ?? '');
  const [withFood, setWithFood] = useState(initial.with_food);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges({ name, dosage, medForm, instructions, withFood });
  const submitting = update.isPending;

  function touch() {
    if (status !== 'idle') setStatus('idle');
  }

  function fieldError(code?: string): string | undefined {
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
    const parsed = medicationSchema.safeParse({
      name,
      dosage,
      form: medForm,
      instructions,
      with_food: withFood,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus('idle');
      return;
    }
    setErrors({});
    try {
      await update.mutateAsync({
        id: initial.id,
        patch: {
          name: parsed.data.name,
          dosage: nullify(parsed.data.dosage),
          form: nullify(parsed.data.form),
          instructions: nullify(parsed.data.instructions),
          with_food: parsed.data.with_food,
        },
      });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={styles.fields}>
      <UnsavedChangesGuard when={dirty} />
      <FormField
        label={t('medications.fields.name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          touch();
        }}
        error={fieldError(errors.name)}
      />
      <FormField
        label={t('medications.fields.dosage')}
        value={dosage}
        onChangeText={(v) => {
          setDosage(v);
          touch();
        }}
        placeholder={t('medications.placeholders.dosage')}
        error={fieldError(errors.dosage)}
      />
      <FormField
        label={t('medications.fields.form')}
        value={medForm}
        onChangeText={(v) => {
          setMedForm(v);
          touch();
        }}
        placeholder={t('medications.placeholders.form')}
        error={fieldError(errors.form)}
      />
      <FormField
        label={t('medications.fields.instructions')}
        value={instructions}
        onChangeText={(v) => {
          setInstructions(v);
          touch();
        }}
        placeholder={t('medications.placeholders.instructions')}
        multiline
        error={fieldError(errors.instructions)}
      />
      <View style={styles.switchRow}>
        <ThemedText type="smallBold">{t('medications.fields.withFood')}</ThemedText>
        <Switch
          value={withFood}
          onValueChange={(v) => {
            setWithFood(v);
            touch();
          }}
          trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
          accessibilityLabel={t('medications.fields.withFood')}
        />
      </View>

      <FormActions
        saveLabel={t('common.saveChanges')}
        onSave={onSubmit}
        saving={submitting}
        disabled={!dirty}
        status={status}
        savedLabel={t('medications.saved')}
        errorLabel={t('medications.saveFailed')}
      />
    </View>
  );
}

function ReadOnlyMedication({ medication }: { medication: Medication }) {
  const { t } = useTranslation();
  return (
    <View style={styles.fields}>
      <Surface tone="info" style={styles.notice}>
        <ThemedText type="small" themeColor="infoFg">
          {t('medications.readOnly')}
        </ThemedText>
      </Surface>
      <ThemedText type="subtitle">{medication.name}</ThemedText>
      {medication.dosage ? <InfoRow label={t('medications.fields.dosage')} value={medication.dosage} /> : null}
      {medication.form ? <InfoRow label={t('medications.fields.form')} value={medication.form} /> : null}
      <InfoRow
        label={t('medications.fields.withFood')}
        value={medication.with_food ? t('common.yes') : t('common.no')}
      />
      {medication.instructions ? (
        <InfoRow label={t('medications.fields.instructions')} value={medication.instructions} />
      ) : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText>{value}</ThemedText>
    </View>
  );
}

function ActivationRow({ circleId, medication }: { circleId: string; medication: Medication }) {
  const { t } = useTranslation();
  const setActive = useSetMedicationActive(circleId);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      await setActive.mutateAsync({ id: medication.id, isActive: !medication.is_active });
    } finally {
      setPending(false);
    }
  }

  return (
    <Surface style={styles.activationCard}>
      <ThemedText type="smallBold">
        {medication.is_active ? t('medications.activeLabel') : t('medications.inactiveLabel')}
      </ThemedText>
      <Button
        variant="secondary"
        label={medication.is_active ? t('medications.deactivate') : t('medications.reactivate')}
        loading={pending}
        disabled={pending}
        onPress={toggle}
      />
    </Surface>
  );
}

function DeleteMedicationRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const del = useDeleteMedication(circleId);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    try {
      await del.mutateAsync(id);
      router.back();
    } catch {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <View style={styles.confirmRow}>
        <Button variant="danger" label={t('common.confirmDelete')} loading={pending} onPress={onDelete} />
        <Button
          variant="secondary"
          label={t('common.cancel')}
          disabled={pending}
          onPress={() => setConfirming(false)}
        />
      </View>
    );
  }

  return (
    <Button
      variant="danger"
      label={t('medications.deleteMedication')}
      onPress={() => setConfirming(true)}
    />
  );
}

function SchedulesManager({
  circleId,
  medicationId,
  schedules,
  canManage,
}: {
  circleId: string;
  medicationId: string;
  schedules: MedicationSchedule[];
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const setActive = useSetScheduleActive(circleId);
  const del = useDeleteSchedule(circleId);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MedicationSchedule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const modalOpen = adding || editing !== null;
  const closeModal = () => {
    setAdding(false);
    setEditing(null);
  };

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      await del.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(schedule: MedicationSchedule) {
    setTogglingId(schedule.id);
    try {
      await setActive.mutateAsync({ id: schedule.id, isActive: !schedule.is_active });
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <View style={styles.fields}>
      <ThemedText type="sectionTitle" accessibilityRole="header">
        {t('medications.dosesSectionTitle')}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {t('medications.scheduleGroupsHelp')}
      </ThemedText>

      {schedules.length > 0 ? <ScheduleSummary schedules={schedules} /> : null}

      {schedules.length === 0 ? (
        <EmptyState title={t('medications.noSchedules')} />
      ) : (
        <View style={styles.list}>
          {schedules.map((schedule, index) => (
            <ScheduleCard
              key={schedule.id}
              number={index + 1}
              schedule={schedule}
              canManage={canManage}
              deleting={deletingId === schedule.id}
              toggling={togglingId === schedule.id}
              onEdit={() => setEditing(schedule)}
              onDelete={() => onDelete(schedule.id)}
              onToggleActive={() => toggleActive(schedule)}
            />
          ))}
        </View>
      )}

      {canManage ? (
        <>
          <Button
            variant="secondary"
            label={t('medications.addScheduleAtMed')}
            onPress={() => setAdding(true)}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('medications.helpDifferentDays')}
          </ThemedText>
        </>
      ) : null}

      {modalOpen ? (
        <ScheduleModalHost
          key={editing?.id ?? 'new'}
          circleId={circleId}
          medicationId={medicationId}
          initial={editing}
          existing={schedules}
          onClose={closeModal}
        />
      ) : null}
    </View>
  );
}

function ScheduleCard({
  number,
  schedule,
  canManage,
  deleting,
  toggling,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  number: number;
  schedule: MedicationSchedule;
  canManage: boolean;
  deleting: boolean;
  toggling: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const { t } = useTranslation();

  const daysText =
    schedule.days_of_week.length >= 7
      ? t('medications.everyDay')
      : [...schedule.days_of_week]
          .sort((a, b) => a - b)
          .map((day) => t(`medications.weekdaysShort.${WEEKDAY_KEYS[day]}`))
          .join('، ');
  const timesText = [...schedule.times].map(formatHm).sort().join('، ');
  const rangeText = schedule.end_date
    ? `${schedule.start_date} — ${schedule.end_date}`
    : `${t('medications.fromDate')} ${schedule.start_date}`;

  return (
    <Surface style={styles.scheduleCard}>
      <View style={styles.scheduleHeader}>
        <ThemedText type="smallBold">{t('medications.scheduleNumber', { number })}</ThemedText>
        <StatusBadge
          tone={schedule.is_active ? 'success' : 'neutral'}
          label={
            schedule.is_active
              ? t('medications.scheduleActiveLabel')
              : t('medications.scheduleStoppedLabel')
          }
        />
      </View>

      <InfoRow label={t('medications.fields.days')} value={daysText} />
      <InfoRow label={t('medications.fields.times')} value={timesText} />
      <InfoRow label={t('medications.fields.startDate')} value={rangeText} />
      {schedule.notes ? (
        <InfoRow label={t('medications.fields.scheduleNotes')} value={schedule.notes} />
      ) : null}

      {canManage ? (
        <View style={styles.scheduleActions}>
          <Button
            size="sm"
            variant="secondary"
            label={schedule.is_active ? t('medications.deactivate') : t('medications.reactivate')}
            loading={toggling}
            disabled={toggling}
            onPress={onToggleActive}
          />
          <ItemActions
            deleting={deleting}
            onEdit={onEdit}
            onDelete={onDelete}
            labels={{
              edit: t('common.edit'),
              delete: t('common.delete'),
              confirm: t('common.confirmDelete'),
              cancel: t('common.cancel'),
            }}
          />
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  fields: { gap: Spacing.three },
  notice: { padding: Spacing.three },
  infoRow: { gap: Spacing.half },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  activationCard: { gap: Spacing.two },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  list: { gap: Spacing.three },
  scheduleCard: { gap: Spacing.two },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  scheduleActions: { gap: Spacing.two, marginTop: Spacing.one },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
