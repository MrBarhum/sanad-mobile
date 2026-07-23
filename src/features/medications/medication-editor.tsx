import { Stack, useRouter } from 'expo-router';
import { Check, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import {
  FigmaFormScreen,
  FigmaMutedNote,
  FigmaSectionLabel,
  FigmaSwitch,
} from '@/components/figma/figma-form-screen';
import { FormField } from '@/components/form-field';
import { isolateLtr } from '@/components/ltr-text';
import { SectionHeader } from '@/components/section-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Glyph } from '@/constants/glyphs';
import { BorderWidth, FontFamily, Radius, Spacing } from '@/constants/theme';
import { MemberSelect, useMemberLookup } from '@/features/circle-members/member-assignment';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { confirmAction } from '@/utils/confirm';
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

/**
 * View / edit a medication + its dose schedules — the Dar "10a" manager editor
 * (FigmaFormScreen green band + gold non-diagnostic banner + grouped Surface
 * cards). The medication-info section mirrors the Add-Medication form's info card
 * and saves with a body-rendered teal CTA; the dose-schedule manager (add / edit
 * via the schedule modal, activate / deactivate, delete), the activation row, and
 * the two-step delete keep their exact existing behavior — only their surfaces are
 * restyled to the frame. Real hooks, schema validation, and permissions are
 * unchanged. (Unlike the single-submit add form, this is a multi-section management
 * screen, so the info save sits with the info section and schedules are managed live.)
 */
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
        <EmptyState icon={Glyph.medication} title={t('medications.notFound')} />
      </ThemedView>
    );
  }

  return (
    <>
      {/* The Figma editor draws its own header; hide the native one. */}
      <Stack.Screen options={{ headerShown: false }} />
      <MedicationEditorScreen
        key={medication.data.id}
        circleId={circleId}
        medication={medication.data}
        schedules={schedules.data ?? []}
        canManage={canManage}
      />
    </>
  );
}

function MedicationEditorScreen({
  circleId,
  medication,
  schedules,
  canManage,
}: {
  circleId: string;
  medication: Medication;
  schedules: MedicationSchedule[];
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <FigmaFormScreen
      title={t('medications.detailTitle')}
      onBack={() => router.back()}
      disclaimer={t('medications.disclaimer')}>
      {canManage ? (
        <MedicationInfoFields circleId={circleId} initial={medication} />
      ) : (
        <ReadOnlyMedicationInfo circleId={circleId} medication={medication} />
      )}

      {canManage ? <ActivationRow circleId={circleId} medication={medication} /> : null}

      <SchedulesManager
        circleId={circleId}
        medicationId={medication.id}
        schedules={schedules}
        canManage={canManage}
      />

      {canManage ? <DeleteMedicationRow circleId={circleId} id={medication.id} /> : null}
    </FigmaFormScreen>
  );
}

function MedicationInfoFields({ circleId, initial }: { circleId: string; initial: Medication }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateMedication(circleId);

  const [name, setName] = useState(initial.name);
  const [dosage, setDosage] = useState(initial.dosage ?? '');
  const [medForm, setMedForm] = useState(initial.form ?? '');
  const [instructions, setInstructions] = useState(initial.instructions ?? '');
  const [withFood, setWithFood] = useState(initial.with_food);
  const [responsibleUserId, setResponsibleUserId] = useState(initial.responsible_user_id ?? '');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges({
    name,
    dosage,
    medForm,
    instructions,
    withFood,
    responsibleUserId,
  });
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
          responsible_user_id: responsibleUserId === '' ? null : responsibleUserId,
        },
      });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <UnsavedChangesGuard when={dirty} />
      <Surface tone="card" radius={Radius.card} padded={16} gap={16}>
        <FigmaSectionLabel>{t('medications.medicationInfoTitle')}</FigmaSectionLabel>
        <FormField
          label={t('medications.fields.name')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            touch();
          }}
          required
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

        <View style={[styles.divider, { backgroundColor: theme.backgroundSunken }]} />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>
              {t('medications.fields.withFood')}
            </Text>
            <Text style={[styles.switchHint, { color: theme.textSecondary }]}>
              {t('medications.withFoodReminder')}
            </Text>
          </View>
          {/* State word so the toggle is never communicated by color alone. */}
          <Text
            style={[
              styles.stateWord,
              { color: withFood ? theme.primaryText : theme.textSecondary },
            ]}>
            {withFood ? t('common.toggleOn') : t('common.toggleOff')}
          </Text>
          <FigmaSwitch
            value={withFood}
            onValueChange={(v) => {
              setWithFood(v);
              touch();
            }}
            accessibilityLabel={t('medications.fields.withFood')}
          />
        </View>
      </Surface>

      {/* Responsible person — neutral chips (person name only, never gendered). */}
      <Surface tone="card" radius={Radius.card} padded={16} gap={16}>
        <MemberSelect
          circleId={circleId}
          value={responsibleUserId}
          label={t('assignment.responsible')}
          onChange={(v) => {
            setResponsibleUserId(v);
            touch();
          }}
        />
      </Surface>

      {/* Info save CTA — body-rendered teal button. This is a multi-section
          management screen, so the save belongs to the medication-info section
          (schedules below are managed live via their own modal). */}
      <View style={styles.footer}>
        {status === 'saved' ? (
          <View style={styles.savedRow} accessibilityLiveRegion="polite">
            <Check size={16} color={theme.successFg} strokeWidth={2.8} />
            <Text style={[styles.savedText, { color: theme.successFg }]}>{t('medications.saved')}</Text>
          </View>
        ) : null}
        {status === 'error' ? (
          <Text style={[styles.statusText, { color: theme.errorFg }]} accessibilityRole="alert">
            {t('medications.saveFailed')}
          </Text>
        ) : null}
        <FigmaFooterPrimaryButton
          label={t('common.saveChanges')}
          onPress={onSubmit}
          loading={submitting}
        />
      </View>
    </>
  );
}

function ReadOnlyMedicationInfo({
  circleId,
  medication,
}: {
  circleId: string;
  medication: Medication;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const responsible = useMemberLookup(circleId)(medication.responsible_user_id);
  return (
    <>
      <FigmaMutedNote>{t('medications.readOnly')}</FigmaMutedNote>
      <Surface tone="card" radius={Radius.card} padded={16} gap={12}>
        <FigmaSectionLabel>{t('medications.medicationInfoTitle')}</FigmaSectionLabel>
        <Text style={[styles.title, { color: theme.text }]}>{medication.name}</Text>
        {medication.dosage ? (
          <InfoRow label={t('medications.fields.dosage')} value={medication.dosage} />
        ) : null}
        {medication.form ? (
          <InfoRow label={t('medications.fields.form')} value={medication.form} />
        ) : null}
        <InfoRow
          label={t('medications.fields.withFood')}
          value={medication.with_food ? t('common.yes') : t('common.no')}
        />
        {responsible ? (
          <InfoRow label={t('assignment.responsible')} value={responsible.label} />
        ) : null}
        {medication.instructions ? (
          <InfoRow label={t('medications.fields.instructions')} value={medication.instructions} />
        ) : null}
      </Surface>
    </>
  );
}

/** A Dar info row: a muted 15/700 label on the start, an 15/800 value on the end. */
function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function ActivationRow({ circleId, medication }: { circleId: string; medication: Medication }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const setActive = useSetMedicationActive(circleId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const willDeactivate = medication.is_active;

  // Deactivating stops this medication's reminders — confirm before the one tap,
  // and surface a failure instead of leaving the toggle looking unchanged (A4).
  function onToggle() {
    confirmAction(
      {
        title: willDeactivate
          ? t('medications.confirmDeactivateTitle')
          : t('medications.confirmReactivateTitle'),
        message: willDeactivate
          ? t('medications.confirmDeactivateMessage')
          : t('medications.confirmReactivateMessage'),
        confirm: willDeactivate ? t('medications.deactivate') : t('medications.reactivate'),
        cancel: t('common.cancel'),
      },
      () => {
        void runToggle();
      },
      { destructive: willDeactivate },
    );
  }

  async function runToggle() {
    setPending(true);
    setError(null);
    try {
      await setActive.mutateAsync({ id: medication.id, isActive: !medication.is_active });
    } catch {
      setError(t('medications.toggleFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Surface tone="card" radius={Radius.card} padded={16} gap={12}>
      {error ? (
        <Text
          style={[styles.statusText, { color: theme.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={styles.activationRow}>
        <View style={styles.activationLabelGroup}>
          {medication.is_active ? (
            <Check size={16} color={theme.successFg} strokeWidth={2.6} />
          ) : null}
          <Text style={[styles.blockTitle, { color: theme.text }]}>
            {medication.is_active ? t('medications.activeLabel') : t('medications.inactiveLabel')}
          </Text>
        </View>
        <Button
          size="sm"
          variant="secondary"
          label={medication.is_active ? t('medications.deactivate') : t('medications.reactivate')}
          loading={pending}
          disabled={pending}
          onPress={onToggle}
        />
      </View>
    </Surface>
  );
}

function DeleteMedicationRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const del = useDeleteMedication(circleId);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setPending(true);
    setError(null);
    try {
      await del.mutateAsync(id);
      router.back();
    } catch {
      // Surface the failure instead of silently resetting the button (A4).
      setError(t('medications.deleteFailed'));
      setPending(false);
    }
  }

  return (
    <View style={styles.deleteBlock}>
      {error ? (
        <Text
          style={[styles.statusText, { color: theme.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {confirming ? (
        <View style={styles.actionRow}>
          <View style={styles.actionCol}>
            <Button
              label={t('common.confirmDelete')}
              variant="danger"
              loading={pending}
              onPress={onDelete}
            />
          </View>
          <View style={styles.actionCol}>
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={pending}
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      ) : (
        <DarActionButton
          size="block"
          tone="danger"
          Icon={Trash2}
          label={t('medications.deleteMedication')}
          onPress={() => setConfirming(true)}
        />
      )}
    </View>
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
  const theme = useTheme();
  const setActive = useSetScheduleActive(circleId);
  const del = useDeleteSchedule(circleId);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MedicationSchedule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const modalOpen = adding || editing !== null;
  const closeModal = () => {
    setAdding(false);
    setEditing(null);
  };

  async function onDelete(id: string) {
    setDeletingId(id);
    setActionError(null);
    try {
      await del.mutateAsync(id);
    } catch {
      setActionError(t('medications.scheduleActionFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  // Deactivating a schedule stops its reminders — confirm before the tap (A4).
  function toggleActive(schedule: MedicationSchedule) {
    const willDeactivate = schedule.is_active;
    confirmAction(
      {
        title: willDeactivate
          ? t('medications.confirmScheduleDeactivateTitle')
          : t('medications.confirmScheduleReactivateTitle'),
        message: willDeactivate
          ? t('medications.confirmScheduleDeactivateMessage')
          : t('medications.confirmScheduleReactivateMessage'),
        confirm: willDeactivate ? t('medications.deactivate') : t('medications.reactivate'),
        cancel: t('common.cancel'),
      },
      () => {
        void runToggle(schedule);
      },
      { destructive: willDeactivate },
    );
  }

  async function runToggle(schedule: MedicationSchedule) {
    setTogglingId(schedule.id);
    setActionError(null);
    try {
      await setActive.mutateAsync({ id: schedule.id, isActive: !schedule.is_active });
    } catch {
      setActionError(t('medications.scheduleActionFailed'));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <View style={styles.schedules}>
      <SectionHeader title={t('medications.dosesSectionTitle')} />
      <FigmaMutedNote>{t('medications.scheduleGroupsHelp')}</FigmaMutedNote>
      {actionError ? (
        <Text
          style={[styles.statusText, { color: theme.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {actionError}
        </Text>
      ) : null}

      {schedules.length > 0 ? <ScheduleSummary schedules={schedules} /> : null}

      {schedules.length === 0 ? (
        <EmptyState title={t('medications.noSchedules')} />
      ) : (
        schedules.map((schedule, index) => (
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
        ))
      )}

      {canManage ? (
        <>
          <DarActionButton
            size="block"
            tone="accent"
            Icon={Plus}
            label={t('medications.addScheduleAtMed')}
            onPress={() => setAdding(true)}
          />
          <FigmaMutedNote>{t('medications.helpDifferentDays')}</FigmaMutedNote>
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
  const theme = useTheme();
  // Inline two-step delete confirm (replaces the buttons in place) — same guarded
  // flow as before, laid out to the frame's single action row.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const daysText =
    schedule.days_of_week.length >= 7
      ? t('medications.everyDay')
      : [...schedule.days_of_week]
          .sort((a, b) => a - b)
          .map((day) => t(`medications.weekdaysShort.${WEEKDAY_KEYS[day]}`))
          .join('، ');
  const timesText = isolateLtr([...schedule.times].map(formatHm).sort().join('، '));
  const rangeText = schedule.end_date
    ? `${isolateLtr(schedule.start_date)} — ${isolateLtr(schedule.end_date)}`
    : `${t('medications.fromDate')} ${isolateLtr(schedule.start_date)}`;

  return (
    <Surface tone="card" radius={Radius.card} padded={16} gap={12}>
      <View style={styles.scheduleHeader}>
        <Text style={[styles.blockTitle, { color: theme.text }]}>
          {t('medications.scheduleNumber', { number })}
        </Text>
        <StatusBadge
          tone={schedule.is_active ? 'success' : 'neutral'}
          label={
            schedule.is_active
              ? t('medications.scheduleActiveLabel')
              : t('medications.scheduleStoppedLabel')
          }
        />
      </View>

      <View style={styles.infoGrid}>
        <InfoRow label={t('medications.fields.days')} value={daysText} />
        <InfoRow label={t('medications.fields.times')} value={timesText} />
        <InfoRow label={t('medications.fields.startDate')} value={rangeText} />
        {schedule.notes ? (
          <InfoRow label={t('medications.fields.scheduleNotes')} value={schedule.notes} />
        ) : null}
      </View>

      {canManage ? (
        confirmingDelete ? (
          <View style={styles.actionRow}>
            <View style={styles.actionCol}>
              <Button
                size="sm"
                label={t('common.confirmDelete')}
                variant="danger"
                loading={deleting}
                onPress={onDelete}
              />
            </View>
            <View style={styles.actionCol}>
              <Button
                size="sm"
                label={t('common.cancel')}
                variant="secondary"
                disabled={deleting}
                onPress={() => setConfirmingDelete(false)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.scheduleActions}>
            <DarActionButton
              flex={schedule.is_active ? 1 : 1.3}
              tone="neutral"
              label={
                schedule.is_active ? t('medications.deactivate') : t('medications.reactivate')
              }
              loading={toggling}
              disabled={toggling}
              onPress={onToggleActive}
            />
            <DarActionButton flex={1} tone="accent" Icon={Pencil} label={t('common.edit')} onPress={onEdit} />
            <DarActionButton
              flex={1}
              tone="danger"
              Icon={Trash2}
              label={t('common.delete')}
              onPress={() => setConfirmingDelete(true)}
            />
          </View>
        )
      ) : null}
    </Surface>
  );
}

/**
 * A Dar bordered action button matching the frame's schedule / add / delete rows:
 * a 2px border + `card` fill, a lucide glyph + label in the tone color. `neutral`
 * = `line` border + `ink` text, `accent` = `line` border + `acc` text, `danger` =
 * `err` border + `err` text. `size="row"` for the compact schedule actions (flex
 * cells), `size="block"` for a full-width primary/destructive button.
 */
function DarActionButton({
  label,
  tone,
  Icon,
  onPress,
  loading = false,
  disabled = false,
  flex,
  size = 'row',
}: {
  label: string;
  tone: 'neutral' | 'accent' | 'danger';
  Icon?: LucideIcon;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  flex?: number;
  size?: 'row' | 'block';
}) {
  const c = useTheme();
  const textColor = tone === 'accent' ? c.primaryText : tone === 'danger' ? c.errorFg : c.text;
  const borderColor = tone === 'danger' ? c.errorFg : c.border;
  const isDisabled = disabled || loading;
  const iconSize = size === 'block' ? 16 : 15;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.darBtn,
        size === 'block' ? styles.darBtnBlock : styles.darBtnRow,
        { backgroundColor: c.backgroundElement, borderColor, opacity: pressed && !isDisabled ? 0.8 : 1 },
        flex != null ? { flex } : styles.darBtnStretch,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.darBtnContent}>
          {Icon ? <Icon size={iconSize} color={textColor} strokeWidth={2} /> : null}
          <Text
            style={[
              size === 'block' ? styles.darBtnLabelBlock : styles.darBtnLabelRow,
              { color: textColor },
            ]}
            numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  footer: { gap: Spacing.two },
  statusText: { fontSize: 14, fontFamily: FontFamily.semibold, textAlign: 'center' },
  savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  savedText: { fontSize: 15, fontFamily: FontFamily.semibold },
  title: { fontSize: 18, fontFamily: FontFamily.bold },
  blockTitle: { fontSize: 16, fontFamily: FontFamily.bold },
  // Info rows: label on the start, value on the end (numbers/dates are LTR-isolated).
  infoGrid: { gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  rowLabel: { fontSize: 15, fontFamily: FontFamily.semibold, flexShrink: 0 },
  rowValue: { fontSize: 15, fontFamily: FontFamily.bold, flexShrink: 1 },
  divider: { height: BorderWidth.standard, alignSelf: 'stretch' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1, minWidth: 0, gap: 2 },
  switchLabel: { fontSize: 16, fontFamily: FontFamily.bold },
  switchHint: { fontSize: 14, fontFamily: FontFamily.medium },
  stateWord: { fontSize: 14, fontFamily: FontFamily.bold },
  activationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activationLabelGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  schedules: { gap: Spacing.three },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  scheduleActions: { flexDirection: 'row', gap: Spacing.two },
  deleteBlock: { gap: Spacing.two },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  actionCol: { flex: 1 },
  // Dar bordered action button
  darBtn: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darBtnRow: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 8 },
  darBtnBlock: { minHeight: 52, paddingVertical: 13, paddingHorizontal: 16 },
  darBtnStretch: { alignSelf: 'stretch' },
  darBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  darBtnLabelRow: { fontSize: 15, fontFamily: FontFamily.bold },
  darBtnLabelBlock: { fontSize: 16, fontFamily: FontFamily.bold },
});
