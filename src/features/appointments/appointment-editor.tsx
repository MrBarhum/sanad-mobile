import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { Doctor } from '@/features/doctors/api';
import { useDoctors } from '@/features/doctors/hooks';
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

const SUCCESS = '#16a34a';
const DANGER = '#dc2626';

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
      <ThemedView style={styles.centered}>
        <EmptyState title={t('appointments.notFound')} />
      </ThemedView>
    );
  }

  const doctors = doctorsQuery.data ?? [];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <StatusSection
          circleId={circleId}
          appointment={appointment.data}
          canManage={canManage}
        />

        {canManage ? <DeleteAppointmentRow circleId={circleId} id={appointment.data.id} /> : null}
      </ScrollView>
    </ThemedView>
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
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={styles.fields}>
      <AppointmentFieldset draft={draft} onChange={patch} errors={errors} doctors={doctors} />

      {status === 'saved' ? (
        <ThemedText style={[styles.statusText, { color: SUCCESS }]} accessibilityRole="alert">
          {t('appointments.saved')}
        </ThemedText>
      ) : null}
      {status === 'error' ? (
        <ThemedText style={[styles.statusText, { color: DANGER }]} accessibilityRole="alert">
          {t('appointments.saveFailed')}
        </ThemedText>
      ) : null}

      <Button
        label={t('appointments.saveAppointment')}
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
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
    ? `${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)} – ${hmFromInstant(appointment.ends_at)}`
    : `${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)}`;
  const doctorName = appointment.doctor_id
    ? (doctors.find((doctor) => doctor.id === appointment.doctor_id)?.name ?? null)
    : null;

  return (
    <View style={styles.fields}>
      <ThemedView type="backgroundElement" style={styles.notice}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('appointments.readOnly')}
        </ThemedText>
      </ThemedView>
      <ThemedText style={styles.readName}>{appointment.title}</ThemedText>
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
    <ThemedView type="backgroundElement" style={styles.statusCard}>
      <ThemedText type="smallBold">
        {t('appointments.fields.status')}: {t(`appointments.status.${appointment.status}`)}
      </ThemedText>

      {canManage ? (
        <View style={styles.actions}>
          {appointment.status === 'scheduled' ? (
            <>
              <Button
                size="sm"
                label={t('appointments.markCompleted')}
                loading={pending}
                disabled={pending}
                onPress={() => run('completed')}
              />
              <Button
                size="sm"
                variant="secondary"
                label={t('appointments.markCancelled')}
                disabled={pending}
                onPress={() => run('cancelled')}
              />
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              label={t('appointments.reopen')}
              loading={pending}
              disabled={pending}
              onPress={() => run('scheduled')}
            />
          )}
        </View>
      ) : null}
    </ThemedView>
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
  statusText: { fontSize: 14, fontWeight: '600' },
  statusCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
