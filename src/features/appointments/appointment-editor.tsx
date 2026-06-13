import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormActions } from '@/components/form-actions';
import { Screen } from '@/components/screen';
import { isolateLtr } from '@/components/ltr-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Spacing } from '@/constants/theme';
import type { Doctor } from '@/features/doctors/api';
import { useDoctors } from '@/features/doctors/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import type { AppointmentStatus, CareAppointment } from './api';
import {
  AppointmentFieldset,
  appointmentDraftFromRow,
  prepareAppointment,
  type AppointmentDraft,
} from './appointment-fields';
import {
  useAppointment,
  useDeleteAppointment,
  useSetAppointmentStatus,
  useUpdateAppointment,
} from './hooks';

const STATUS_TONE: Record<AppointmentStatus, StatusTone> = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'error',
};

/** Appointment status â†’ badge glyph (scheduled reads as "upcoming"). */
const STATUS_GLYPH: Record<AppointmentStatus, string> = {
  scheduled: 'â—·',
  completed: 'âœ“',
  cancelled: 'âœ•',
};

/** Loads an appointment, then renders the view/edit screen. */
export function AppointmentEditor({
  circleId,
  canManage,
  appointmentId,
}: {
  circleId: string;
  canManage: boolean;
  appointmentId: string;
}) {
  const { t } = useTranslation();
  const appointment = useAppointment(appointmentId);
  const doctorsQuery = useDoctors(circleId);

  if (appointment.isLoading) return <LoadingState />;
  if (appointment.isError) {
    return (
      <ErrorState
        message={t('appointments.loadError')}
        retryLabel={t('retry')}
        onRetry={() => appointment.refetch()}
      />
    );
  }
  if (!appointment.data) {
    return (
      <Screen scroll={false} center>
        <EmptyState icon="â—·" title={t('appointments.notFound')} />
      </Screen>
    );
  }

  const doctors = doctorsQuery.data ?? [];

  return (
    <Screen>
      {canManage ? (
        <AppointmentEditFields
          key={appointment.data.id}
          circleId={circleId}
          initial={appointment.data}
          doctors={doctors}
        />
      ) : (
        <ReadOnlyAppointment appointment={appointment.data} doctors={doctors} />
      )}

      <StatusSection circleId={circleId} appointment={appointment.data} canManage={canManage} />

      {canManage ? <DeleteAppointmentRow circleId={circleId} id={appointment.data.id} /> : null}
    </Screen>
  );
}

function AppointmentEditFields({
  circleId,
  initial,
  doctors,
}: {
  circleId: string;
  initial: CareAppointment;
  doctors: Doctor[];
}) {
  const { t } = useTranslation();
  const update = useUpdateAppointment(circleId);

  const [draft, setDraft] = useState<AppointmentDraft>(() => appointmentDraftFromRow(initial));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges(draft);
  const submitting = update.isPending;

  function patch(part: Partial<AppointmentDraft>) {
    setDraft((current) => ({ ...current, ...part }));
    if (status !== 'idle') setStatus('idle');
  }

  async function onSubmit() {
    const prepared = prepareAppointment(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) {
      setStatus('idle');
      return;
    }
    try {
      await update.mutateAsync({ id: initial.id, patch: prepared.input });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={styles.fields}>
      <UnsavedChangesGuard when={dirty} />
      <AppointmentFieldset draft={draft} onChange={patch} errors={errors} doctors={doctors} />

      <FormActions
        saveLabel={t('common.saveChanges')}
        onSave={onSubmit}
        saving={submitting}
        disabled={!dirty}
        status={status}
        savedLabel={t('appointments.saved')}
        errorLabel={t('appointments.saveFailed')}
      />
    </View>
  );
}

function ReadOnlyAppointment({
  appointment,
  doctors,
}: {
  appointment: CareAppointment;
  doctors: Doctor[];
}) {
  const { t } = useTranslation();
  const when = appointment.ends_at
    ? isolateLtr(
        `${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)} â€“ ${hmFromInstant(appointment.ends_at)}`,
      )
    : isolateLtr(`${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)}`);
  const doctorName = appointment.doctor_id
    ? (doctors.find((doctor) => doctor.id === appointment.doctor_id)?.name ?? null)
    : null;

  return (
    <View style={styles.fields}>
      <Surface tone="sunken">
        <ThemedText type="small" themeColor="textSecondary">
          {t('appointments.readOnly')}
        </ThemedText>
      </Surface>
      <ThemedText type="sectionTitle">{appointment.title}</ThemedText>
      <View style={styles.infoGroup}>
        <InfoRow
          label={t('appointments.fields.type')}
          value={t(`appointments.type.${appointment.appointment_type}`)}
        />
        <InfoRow label={t('appointments.whenLabel')} value={when} />
        {appointment.location ? (
          <InfoRow label={t('appointments.locationLabel')} value={appointment.location} />
        ) : null}
        {doctorName ? <InfoRow label={t('appointments.doctorLabel')} value={doctorName} /> : null}
        {appointment.notes ? (
          <InfoRow label={t('appointments.fields.notes')} value={appointment.notes} />
        ) : null}
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="default">{value}</ThemedText>
    </View>
  );
}

function StatusSection({
  circleId,
  appointment,
  canManage,
}: {
  circleId: string;
  appointment: CareAppointment;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const setStatus = useSetAppointmentStatus(circleId);
  const [pending, setPending] = useState(false);

  async function run(status: AppointmentStatus) {
    setPending(true);
    try {
      await setStatus.mutateAsync({ id: appointment.id, status });
    } finally {
      setPending(false);
    }
  }

  return (
    <Surface style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <ThemedText type="smallBold">{t('appointments.fields.status')}</ThemedText>
        <StatusBadge
          tone={STATUS_TONE[appointment.status]}
          glyph={STATUS_GLYPH[appointment.status]}
          label={t(`appointments.status.${appointment.status}`)}
        />
      </View>

      {canManage ? (
        <View style={[styles.actions, { borderTopColor: theme.divider }]}>
          {appointment.status === 'scheduled' ? (
            <>
              <Button
                size="sm"
                glyph="âœ“"
                label={t('appointments.markCompleted')}
                loading={pending}
                disabled={pending}
                onPress={() => run('completed')}
                style={styles.action}
              />
              <Button
                size="sm"
                variant="secondary"
                glyph="âœ•"
                label={t('appointments.markCancelled')}
                disabled={pending}
                onPress={() => run('cancelled')}
                style={styles.action}
              />
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              glyph="â—·"
              label={t('appointments.reopen')}
              loading={pending}
              disabled={pending}
              onPress={() => run('scheduled')}
              style={styles.action}
            />
          )}
        </View>
      ) : null}
    </Surface>
  );
}

function DeleteAppointmentRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const del = useDeleteAppointment(circleId);
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
        <Button
          variant="danger"
          label={t('common.confirmDelete')}
          loading={pending}
          onPress={onDelete}
        />
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
      label={t('appointments.deleteAppointment')}
      onPress={() => setConfirming(true)}
    />
  );
}

const styles = StyleSheet.create({
  fields: { gap: Spacing.three },
  infoGroup: { gap: Spacing.two },
  infoRow: { gap: Spacing.half },
  statusCard: { gap: Spacing.two },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  action: { flexGrow: 1, flexBasis: 96 },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
