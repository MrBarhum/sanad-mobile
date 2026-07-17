import { useRouter } from 'expo-router';
import { Calendar, Check, Clock, MapPin, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSegmentedTabs } from '@/components/figma/figma-segmented-tabs';
import { FigmaStatusPill } from '@/components/figma/figma-status-pill';
import { IconChip } from '@/components/figma/icon-chip';
import { isolateLtr } from '@/components/ltr-text';
import { FontFamily, Radius } from '@/constants/theme';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import { useDoctors } from '@/features/doctors/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import type { CareAppointment } from './api';
import { useCompletedAppointments, useUpcomingAppointments } from './hooks';

type ApptTab = 'upcoming' | 'completed';

/** Per-appointment Calendar-chip accent, cycled by index (Figma uses varied hues). */
const CHIP_COLORS = [
  'categoryBlue',
  'categoryPurple',
  'categoryGreen',
  'categoryGold',
] as const;

/**
 * The Figma Make Appointments screen, recreated as literally as possible in React
 * Native and wired to real Sanad data. Mirrors `AppointmentsScreen.tsx`: a
 * back/title/teal-"+" header, an upcoming/completed segmented control, and a list
 * of bordered cards — each a Calendar icon chip, the title, the doctor + type
 * line, an optional "completed" status pill, and Clock(date, time) + MapPin
 * (location) meta rows. Tapping a card opens the existing detail route. Reuses the
 * `AppointmentsCenter` hooks (`useUpcomingAppointments`, `useDoctors`) and its
 * status/type locale keys verbatim. IBM Plex + theme tokens, RTL. No old Sanad
 * Screen/Surface/Section/Button/StatusBadge.
 *
 * The "upcoming" tab uses the future-only `useUpcomingAppointments`; the
 * "completed" tab uses `useCompletedAppointments`, which returns completed
 * appointments across ALL dates (newest first) so past history actually shows
 * (the future-only source could never populate it).
 */
export function FigmaAppointments({
  circleId,
  canManage,
  canCollaborate,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const c = useTheme();

  const [tab, setTab] = useState<ApptTab>('upcoming');
  const upcomingQuery = useUpcomingAppointments(circleId);
  // Completed history only loads once the user opens that tab (lazy).
  const completedQuery = useCompletedAppointments(circleId, tab === 'completed');
  const appointmentsQuery = tab === 'completed' ? completedQuery : upcomingQuery;
  const doctorsQuery = useDoctors(circleId);

  const doctorNames = useMemo(
    () => new Map((doctorsQuery.data ?? []).map((doctor) => [doctor.id, doctor.name])),
    [doctorsQuery.data],
  );
  const lookup = useMemberLookup(circleId);

  const appointments = appointmentsQuery.data ?? [];
  // Family members (non-managers who can collaborate) see only appointments assigned
  // to them; managers see all; read-only members see all (no action affordances).
  // UI scoping only — RLS is unchanged.
  const scopeToMine = !canManage && canCollaborate;
  const visible = scopeToMine
    ? appointments.filter((a) => a.assigned_to === userId)
    : appointments;
  // Tabs split by status, mirroring the center's scheduled vs. completed handling.
  // Cancelled appointments are intentionally hidden (the Figma has no such tab).
  const filtered = visible.filter((a) =>
    tab === 'upcoming' ? a.status === 'scheduled' : a.status === 'completed',
  );

  const tabs: { key: ApptTab; label: string }[] = [
    { key: 'upcoming', label: t('figma.appointments.tabs.upcoming') },
    { key: 'completed', label: t('figma.appointments.tabs.completed') },
  ];

  return (
    <FigmaScreen>
      <FigmaHeader
        title={t('figma.appointments.title')}
        onAdd={canManage ? () => router.push('/appointments/new') : undefined}
        addAccessibilityLabel={t('appointments.add')}
      />

      <FigmaSegmentedTabs tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as ApptTab)} />

      {appointmentsQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : appointmentsQuery.isError ? (
        <FigmaCard tone="card" radius={Radius.lg}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>{t('appointments.loadError')}</Text>
          <Pressable
            onPress={() => appointmentsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </FigmaCard>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Calendar size={40} color={c.textSecondary} strokeWidth={1} />
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            {tab === 'upcoming'
              ? t('figma.appointments.emptyUpcoming')
              : t('figma.appointments.emptyCompleted')}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((appointment, index) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              doctorName={
                appointment.doctor_id ? (doctorNames.get(appointment.doctor_id) ?? null) : null
              }
              assigneeName={
                appointment.assigned_to ? (lookup(appointment.assigned_to)?.label ?? null) : null
              }
              chipColor={c[CHIP_COLORS[index % CHIP_COLORS.length]]}
              onOpen={() => router.push(`/appointments/${appointment.id}`)}
            />
          ))}
        </View>
      )}
    </FigmaScreen>
  );
}

function AppointmentCard({
  appointment,
  doctorName,
  assigneeName,
  chipColor,
  onOpen,
}: {
  appointment: CareAppointment;
  doctorName: string | null;
  assigneeName: string | null;
  chipColor: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  const isCompleted = appointment.status === 'completed';
  // Date + time meta, LTR-isolated (the date/time is the scannable anchor).
  const date = ymdFromInstant(appointment.starts_at);
  const time = hmFromInstant(appointment.starts_at);
  const whenText = `${isolateLtr(date)}، ${isolateLtr(time)}`;

  return (
    <FigmaCard
      tone="card"
      radius={Radius.xl}
      padding={16}
      onPress={onOpen}
      accessibilityLabel={appointment.title}
      accessibilityHint={t('common.details')}>
      <View style={styles.cardTop}>
        <IconChip Icon={Calendar} color={chipColor} size={48} radius={Radius.lg} iconSize={22} />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {appointment.title}
          </Text>
          {doctorName ? (
            <Text style={[styles.cardDoctor, { color: c.text }]} numberOfLines={1}>
              {doctorName}
            </Text>
          ) : null}
          <Text style={[styles.cardType, { color: c.textSecondary }]} numberOfLines={1}>
            {t(`appointments.type.${appointment.appointment_type}`)}
          </Text>
        </View>
        {isCompleted ? (
          <FigmaStatusPill
            label={t('appointments.status.completed')}
            color={c.successFg}
            Icon={Check}
          />
        ) : null}
      </View>

      <View style={styles.metaList}>
        <View style={styles.metaRow}>
          <Clock size={13} color={c.textSecondary} />
          <Text style={[styles.metaText, { color: c.textSecondary }]}>{whenText}</Text>
        </View>
        {appointment.location ? (
          <View style={styles.metaRow}>
            <MapPin size={13} color={c.textSecondary} />
            <Text style={[styles.metaText, { color: c.textSecondary }]} numberOfLines={1}>
              {appointment.location}
            </Text>
          </View>
        ) : null}
        {assigneeName ? (
          <View style={styles.metaRow}>
            <Users size={13} color={c.textSecondary} />
            <Text style={[styles.metaText, { color: c.textSecondary }]} numberOfLines={1}>
              {assigneeName}
            </Text>
          </View>
        ) : null}
      </View>
    </FigmaCard>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, fontFamily: FontFamily.medium, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 13, fontFamily: FontFamily.semibold },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: FontFamily.medium, textAlign: 'center' },
  list: { gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontFamily: FontFamily.bold },
  cardDoctor: { fontSize: 14, fontFamily: FontFamily.regular },
  cardType: { fontSize: 12, fontFamily: FontFamily.regular },
  metaList: { gap: 6, marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13, fontFamily: FontFamily.regular },
});
