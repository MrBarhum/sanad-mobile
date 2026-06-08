import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { FormModal } from '@/components/form-modal';
import { ItemActions } from '@/components/item-actions';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
import {
  ScheduleFields,
  WEEKDAY_KEYS,
  defaultScheduleDraft,
  prepareSchedule,
  scheduleToDraft,
  type ScheduleDraft,
} from './schedule-fields';
import { ScheduleModalHost } from './schedule-modal-host';

const SUCCESS = '#16a34a';
const DANGER = '#dc2626';
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
      <ThemedView style={styles.centered}>
        <EmptyState title={t('medications.notFound')} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {canManage ? (
          <MedicationFields key={medication.data.id} circleId={circleId} initial={medication.data} />
        ) : (
          <ReadOnlyMedication medication={medication.data} />
        )}

        {canManage ? <ActivationRow circleId={circleId} medication={medication.data} /> : null}

        <ThemedView type="backgroundSelected" style={styles.divider} />

        <SchedulesManager
          circleId={circleId}
          medicationId={medication.data.id}
          schedules={schedules.data ?? []}
          canManage={canManage}
        />

        {canManage ? <DeleteMedicationRow circleId={circleId} id={medication.data.id} /> : null}
      </ScrollView>
    </ThemedView>
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
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={styles.fields}>
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
          trackColor={{ true: theme.text, false: theme.backgroundSelected }}
          accessibilityLabel={t('medications.fields.withFood')}
        />
      </View>

      {status === 'saved' ? (
        <ThemedText style={[styles.statusText, { color: SUCCESS }]} accessibilityRole="alert">
          {t('medications.saved')}
        </ThemedText>
      ) : null}
      {status === 'error' ? (
        <ThemedText style={[styles.statusText, { color: DANGER }]} accessibilityRole="alert">
          {t('medications.saveFailed')}
        </ThemedText>
      ) : null}

      <Button
        label={t('medications.saveMedication')}
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
      />
    </View>
  );
}

function ReadOnlyMedication({ medication }: { medication: Medication }) {
  const { t } = useTranslation();
  return (
    <View style={styles.fields}>
      <ThemedView type="backgroundElement" style={styles.notice}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('medications.readOnly')}
        </ThemedText>
      </ThemedView>
      <ThemedText style={styles.readName}>{medication.name}</ThemedText>
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
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
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
    <ThemedView type="backgroundElement" style={styles.activationCard}>
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
    </ThemedView>
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
      <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
        {t('medications.scheduleSectionTitle')}
      </ThemedText>

      {canManage ? (
        <Button variant="secondary" label={t('medications.addSchedule')} onPress={() => setAdding(true)} />
      ) : null}

      {schedules.length === 0 ? (
        <EmptyState title={t('medications.noSchedules')} />
      ) : (
        <View style={styles.list}>
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
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

      {modalOpen ? (
        <ScheduleModalHost
          key={editing?.id ?? 'new'}
          circleId={circleId}
          medicationId={medicationId}
          initial={editing}
          onClose={closeModal}
        />
      ) : null}
    </View>
  );
}

function ScheduleCard({
  schedule,
  canManage,
  deleting,
  toggling,
  onEdit,
  onDelete,
  onToggleActive,
}: {
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
  const timesText = schedule.times.map(formatHm).join('، ');
  const rangeText = schedule.end_date
    ? `${schedule.start_date} — ${schedule.end_date}`
    : `${t('medications.fromDate')} ${schedule.start_date}`;

  return (
    <ThemedView type="backgroundElement" style={styles.scheduleCard}>
      <View style={styles.scheduleHeader}>
        <ThemedText style={styles.scheduleTimes}>{timesText}</ThemedText>
        {!schedule.is_active ? (
          <ThemedView type="backgroundSelected" style={styles.badge}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('medications.inactiveLabel')}
            </ThemedText>
          </ThemedView>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {daysText}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {rangeText}
      </ThemedText>
      {schedule.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {schedule.notes}
        </ThemedText>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  fields: { gap: Spacing.three },
  notice: { borderRadius: Spacing.two, padding: Spacing.three },
  readName: { fontSize: 22, fontWeight: '700' },
  infoRow: { gap: Spacing.half },
  infoValue: { fontSize: 16, lineHeight: 24 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  statusText: { fontSize: 14, fontWeight: '600' },
  activationCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  sectionTitle: { fontSize: 22, lineHeight: 30 },
  list: { gap: Spacing.three },
  scheduleCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  scheduleTimes: { fontSize: 18, fontWeight: '600' },
  badge: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  scheduleActions: { gap: Spacing.two, marginTop: Spacing.one },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
