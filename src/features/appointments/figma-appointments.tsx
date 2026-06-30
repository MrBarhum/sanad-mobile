import { useRouter } from 'expo-router';
import { Calendar, Check, Clock, MapPin, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSegmentedTabs } from '@/components/figma/figma-segmented-tabs';
import { FigmaStatusPill } from '@/components/figma/figma-status-pill';
import { IconChip } from '@/components/figma/icon-chip';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import { useDoctors } from '@/features/doctors/hooks';
import { useAuth } from '@/providers';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import type { CareAppointment } from './api';
import { useUpcomingAppointments } from './hooks';

type ApptTab = 'upcoming' | 'completed';

/** Per-appointment Calendar-chip accent, cycled by index (Figma uses varied hues). */
const CHIP_COLORS = [
  FigmaCategory.blue,
  FigmaCategory.purple,
  FigmaCategory.green,
  FigmaCategory.gold,
] as const;

/**
 * The Figma Make Appointments screen, recreated as literally as possible in React
 * Native and wired to real Sanad data. Mirrors `AppointmentsScreen.tsx`: a
 * back/title/teal-"+" header, an upcoming/completed segmented control, and a list
 * of bordered cards — each a Calendar icon chip, the title, the doctor + type
 * line, an optional "completed" status pill, and Clock(date, time) + MapPin
 * (location) meta rows. Tapping a card opens the existing detail route. Reuses the
 * `AppointmentsCenter` hooks (`useUpcomingAppointments`, `useDoctors`) and its
 * status/type locale keys verbatim. Cairo + Figma tokens, RTL. No old Sanad
 * Screen/Surface/Section/Button/StatusBadge.
 *
 * Note: `useUpcomingAppointments` only returns items from local midnight today
 * onward, so the "completed" tab shows appointments completed today/later. Past
 * appointments are intentionally excluded by the data source (unchanged).
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
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  const appointmentsQuery = useUpcomingAppointments(circleId);
  const doctorsQuery = useDoctors(circleId);
  const [tab, setTab] = useState<ApptTab>('upcoming');

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
        <FigmaCard tone="card" radius={FigmaRadius.r16}>
          <Text style={[styles.errorText, { color: c.error }]}>{t('appointments.loadError')}</Text>
          <Pressable
            onPress={() => appointmentsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </FigmaCard>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Calendar size={40} color={c.muted} strokeWidth={1} />
          <Text style={[styles.emptyText, { color: c.muted }]}>
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
              chipColor={CHIP_COLORS[index % CHIP_COLORS.length]}
              scheme={scheme}
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
  scheme,
  onOpen,
}: {
  appointment: CareAppointment;
  doctorName: string | null;
  assigneeName: string | null;
  chipColor: string;
  scheme: FigmaScheme;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];

  const isCompleted = appointment.status === 'completed';
  // Date + time meta, LTR-isolated (the date/time is the scannable anchor).
  const date = ymdFromInstant(appointment.starts_at);
  const time = hmFromInstant(appointment.starts_at);
  const whenText = `${isolateLtr(date)}، ${isolateLtr(time)}`;

  return (
    <FigmaCard
      tone="card"
      radius={FigmaRadius.r24}
      padding={16}
      onPress={onOpen}
      accessibilityLabel={appointment.title}
      accessibilityHint={t('common.details')}>
      <View style={styles.cardTop}>
        <IconChip Icon={Calendar} color={chipColor} size={48} radius={FigmaRadius.r16} iconSize={22} />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {appointment.title}
          </Text>
          {doctorName ? (
            <Text style={[styles.cardDoctor, { color: c.text }]} numberOfLines={1}>
              {doctorName}
            </Text>
          ) : null}
          <Text style={[styles.cardType, { color: c.muted }]} numberOfLines={1}>
            {t(`appointments.type.${appointment.appointment_type}`)}
          </Text>
        </View>
        {isCompleted ? (
          <FigmaStatusPill
            label={t('appointments.status.completed')}
            color={c.success}
            Icon={Check}
          />
        ) : null}
      </View>

      <View style={styles.metaList}>
        <View style={styles.metaRow}>
          <Clock size={13} color={c.muted} />
          <Text style={[styles.metaText, { color: c.muted }]}>{whenText}</Text>
        </View>
        {appointment.location ? (
          <View style={styles.metaRow}>
            <MapPin size={13} color={c.muted} />
            <Text style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
              {appointment.location}
            </Text>
          </View>
        ) : null}
        {assigneeName ? (
          <View style={styles.metaRow}>
            <Users size={13} color={c.muted} />
            <Text style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
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
  errorText: { fontSize: 14, fontFamily: FigmaFont.medium, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: FigmaRadius.r12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 13, fontFamily: FigmaFont.semibold },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: FigmaFont.medium, textAlign: 'center' },
  list: { gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontFamily: FigmaFont.bold },
  cardDoctor: { fontSize: 14, fontFamily: FigmaFont.regular },
  cardType: { fontSize: 12, fontFamily: FigmaFont.regular },
  metaList: { gap: 6, marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13, fontFamily: FigmaFont.regular },
});
