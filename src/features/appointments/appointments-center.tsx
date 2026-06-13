import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LtrText, isolateLtr } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDoctors } from '@/features/doctors/hooks';
import { ReminderNotice } from '@/features/notifications/reminder-notice';
import { hmFromInstant, todayYmd, ymdFromInstant } from '@/utils/date';

import type { AppointmentStatus, CareAppointment } from './api';
import { useSetAppointmentStatus, useUpcomingAppointments } from './hooks';

const STATUS_TONE: Record<Exclude<AppointmentStatus, 'scheduled'>, StatusTone> = {
  completed: 'success',
  cancelled: 'error',
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
    <Screen>
      <ThemedText type="small" themeColor="textMuted">
        {t('appointments.disclaimer')}
      </ThemedText>

      <ReminderNotice messageKey="appointments.reminderNotice" />

      {canManage ? (
        <Button
          glyph="ï¼‹"
          label={t('appointments.add')}
          onPress={() => router.push('/appointments/new')}
        />
      ) : null}

      <Section title={t('appointments.todayTitle')}>
        {todayAppointments.length === 0 ? (
          <EmptyState
            icon="â—·"
            title={t('appointments.noTodayTitle')}
            subtitle={t('appointments.noTodaySubtitle')}
          />
        ) : (
          <View style={styles.list}>{todayAppointments.map(renderCard)}</View>
        )}
      </Section>

      <Section title={t('appointments.upcomingTitle')}>
        {upcoming.length === 0 ? (
          <EmptyState
            icon="â—·"
            title={t('appointments.noUpcomingTitle')}
            subtitle={canManage ? t('appointments.noUpcomingSubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{upcoming.map(renderCard)}</View>
        )}
      </Section>
    </Screen>
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
  const theme = useTheme();

  const when = appointment.ends_at
    ? isolateLtr(
        `${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)} â€“ ${hmFromInstant(appointment.ends_at)}`,
      )
    : isolateLtr(`${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)}`);

  return (
    <Surface style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="cardTitle" style={styles.cardTitle}>
          {appointment.title}
        </ThemedText>
        {appointment.status !== 'scheduled' ? (
          <StatusBadge
            tone={STATUS_TONE[appointment.status]}
            label={t(`appointments.status.${appointment.status}`)}
          />
        ) : null}
      </View>

      {/* The scheduled date/time is the scannable anchor of the card. */}
      <View style={[styles.whenChip, { backgroundColor: theme.accentBg }]}>
        <LtrText style={[styles.whenText, { color: theme.accentFg }]}>{when}</LtrText>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {t(`appointments.type.${appointment.appointment_type}`)}
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

      <View style={[styles.actions, { borderTopColor: theme.divider }]}>
        {canManage && appointment.status === 'scheduled' ? (
          <>
            <Button
              size="sm"
              glyph="âœ“"
              label={t('appointments.markCompleted')}
              disabled={pending}
              onPress={onComplete}
              style={styles.action}
            />
            <Button
              size="sm"
              variant="secondary"
              glyph="âœ•"
              label={t('appointments.markCancelled')}
              disabled={pending}
              onPress={onCancel}
              style={styles.action}
            />
          </>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          glyph="â€º"
          label={t('common.details')}
          onPress={onOpen}
          style={styles.action}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  card: { gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { flexShrink: 1 },
  whenChip: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 40,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  whenText: { fontFamily: FontFamily.bold, fontSize: 18, lineHeight: 28, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  action: { flexGrow: 1, flexBasis: 96 },
});
