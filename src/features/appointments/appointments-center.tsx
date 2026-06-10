import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDoctors } from '@/features/doctors/hooks';
import { hmFromInstant, todayYmd, ymdFromInstant } from '@/utils/date';

import type { AppointmentStatus, CareAppointment } from './api';
import { useSetAppointmentStatus, useUpcomingAppointments } from './hooks';

const DONE_COLORS: Record<Exclude<AppointmentStatus, 'scheduled'>, string> = {
  completed: '#16a34a',
  cancelled: '#dc2626',
};

/** Appointment center: today's and upcoming appointments. */
export function AppointmentsCenter({
  circleId,
  canManage,
}: {
  circleId: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const appointmentsQuery = useUpcomingAppointments(circleId);
  const doctorsQuery = useDoctors(circleId);
  const setStatus = useSetAppointmentStatus(circleId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const doctorNames = useMemo(
    () => new Map((doctorsQuery.data ?? []).map((doctor) => [doctor.id, doctor.name])),
    [doctorsQuery.data],
  );

  if (appointmentsQuery.isLoading) return <LoadingState />;
  if (appointmentsQuery.isError) {
    return (
      <ErrorState
        message={t('appointments.loadError')}
        retryLabel={t('retry')}
        onRetry={() => appointmentsQuery.refetch()}
      />
    );
  }

  const appointments = appointmentsQuery.data ?? [];
  const today = todayYmd();
  const todayAppointments = appointments.filter((a) => ymdFromInstant(a.starts_at) === today);
  const upcoming = appointments.filter((a) => ymdFromInstant(a.starts_at) !== today);

  async function changeStatus(appointment: CareAppointment, status: AppointmentStatus) {
    setPendingId(appointment.id);
    try {
      await setStatus.mutateAsync({ id: appointment.id, status });
    } finally {
      setPendingId(null);
    }
  }

  function renderCard(appointment: CareAppointment) {
    return (
      <AppointmentCard
        key={appointment.id}
        appointment={appointment}
        doctorName={appointment.doctor_id ? (doctorNames.get(appointment.doctor_id) ?? null) : null}
        canManage={canManage}
        pending={pendingId === appointment.id}
        onComplete={() => changeStatus(appointment, 'completed')}
        onCancel={() => changeStatus(appointment, 'cancelled')}
        onOpen={() => router.push(`/appointments/${appointment.id}`)}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('appointments.disclaimer')}
        </ThemedText>

        {canManage ? (
          <Button label={t('appointments.add')} onPress={() => router.push('/appointments/new')} />
        ) : null}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('appointments.todayTitle')}
        </ThemedText>
        {todayAppointments.length === 0 ? (
          <EmptyState
            title={t('appointments.noTodayTitle')}
            subtitle={t('appointments.noTodaySubtitle')}
          />
        ) : (
          <View style={styles.list}>{todayAppointments.map(renderCard)}</View>
        )}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('appointments.upcomingTitle')}
        </ThemedText>
        {upcoming.length === 0 ? (
          <EmptyState
            title={t('appointments.noUpcomingTitle')}
            subtitle={canManage ? t('appointments.noUpcomingSubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{upcoming.map(renderCard)}</View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function AppointmentCard({
  appointment,
  doctorName,
  canManage,
  pending,
  onComplete,
  onCancel,
  onOpen,
}: {
  appointment: CareAppointment;
  doctorName: string | null;
  canManage: boolean;
  pending: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  const when = appointment.ends_at
    ? `${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)} – ${hmFromInstant(appointment.ends_at)}`
    : `${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)}`;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{appointment.title}</ThemedText>
        {appointment.status !== 'scheduled' ? (
          <View style={[styles.badge, { borderColor: DONE_COLORS[appointment.status] }]}>
            <ThemedText type="small" style={{ color: DONE_COLORS[appointment.status] }}>
              {t(`appointments.status.${appointment.status}`)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {t(`appointments.type.${appointment.appointment_type}`)} • {when}
      </ThemedText>
      {appointment.location ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('appointments.locationLabel')}: {appointment.location}
        </ThemedText>
      ) : null}
      {doctorName ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('appointments.doctorLabel')}: {doctorName}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        {canManage && appointment.status === 'scheduled' ? (
          <>
            <Button
              size="sm"
              label={t('appointments.markCompleted')}
              disabled={pending}
              onPress={onComplete}
            />
            <Button
              size="sm"
              variant="secondary"
              label={t('appointments.markCancelled')}
              disabled={pending}
              onPress={onCancel}
            />
          </>
        ) : null}
        <Button size="sm" variant="secondary" label={t('common.details')} onPress={onOpen} />
      </View>
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
  sectionTitle: { fontSize: 22, lineHeight: 30, marginTop: Spacing.two },
  list: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  badge: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    alignSelf: 'flex-start',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
