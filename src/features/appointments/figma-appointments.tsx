import { useRouter } from 'expo-router';
import { Calendar, ChevronLeft, Clock, MapPin, Stethoscope, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSegmentedTabs } from '@/components/figma/figma-segmented-tabs';
import { isolateLtr } from '@/components/ltr-text';
import { SkeletonList } from '@/components/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/states';
import { Surface } from '@/components/surface';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import { useDoctors } from '@/features/doctors/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import type { CareAppointment } from './api';
import { useCompletedAppointments, useUpcomingAppointments } from './hooks';

type ApptTab = 'upcoming' | 'completed';

/**
 * The Dar appointments list (frame 8f idiom, mirroring family-visits): a deep-green
 * sub-screen band (back + title + add), a القادمة/المنتهية segmented control, and a
 * list of bordered cards — each a tinted `primary` calendar-icon square, the
 * appointment title, its type label, a wrapping meta row (Clock + LTR date/time, the
 * doctor, the location, and an accent assignee tag), an optional «تمّ» completed
 * status pill, and a forward chevron. Tapping a card opens the existing detail route.
 * Reuses `useUpcomingAppointments` / `useCompletedAppointments` / `useDoctors` and
 * their status/type locale keys verbatim. Cairo + Dar tokens, both themes, RTL.
 *
 * The "upcoming" tab uses the future-only `useUpcomingAppointments`; the "completed"
 * tab uses `useCompletedAppointments`, which returns completed appointments across
 * ALL dates (newest first) so past history actually shows. Behaviour / data / routing
 * / scoping unchanged — only the visuals move to the Dar identity.
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
    <FigmaScreen gap={16}>
      <FigmaHeader
        title={t('figma.appointments.title')}
        onAdd={canManage ? () => router.push('/appointments/new') : undefined}
        addAccessibilityLabel={t('appointments.add')}
      />

      <FigmaSegmentedTabs tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as ApptTab)} />

      {appointmentsQuery.isLoading ? (
        <SkeletonList />
      ) : appointmentsQuery.isError ? (
        <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>{t('appointments.loadError')}</Text>
          <Pressable
            onPress={() => appointmentsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          iconName="appointment"
          title={
            tab === 'upcoming'
              ? t('figma.appointments.emptyUpcoming')
              : t('figma.appointments.emptyCompleted')
          }
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              doctorName={
                appointment.doctor_id ? (doctorNames.get(appointment.doctor_id) ?? null) : null
              }
              assigneeName={
                appointment.assigned_to ? (lookup(appointment.assigned_to)?.label ?? null) : null
              }
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
  onOpen,
}: {
  appointment: CareAppointment;
  doctorName: string | null;
  assigneeName: string | null;
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
    <Surface
      tone="card"
      padded={false}
      onPress={onOpen}
      accessibilityLabel={appointment.title}
      accessibilityHint={t('common.details')}
      style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.iconSquare, { backgroundColor: c.primaryBg, borderColor: c.border }]}>
          <Calendar size={18} color={c.primaryText} strokeWidth={2} />
        </View>

        <View style={styles.info}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {appointment.title}
          </Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
            {t(`appointments.type.${appointment.appointment_type}`)}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaGroup}>
              <Clock size={12} color={c.textSecondary} strokeWidth={2.2} />
              <Text style={[styles.whenText, { color: c.textSecondary }]}>{whenText}</Text>
            </View>

            {doctorName ? (
              <View style={styles.metaGroup}>
                <Stethoscope size={12} color={c.textSecondary} strokeWidth={2} />
                <Text style={[styles.metaText, { color: c.textSecondary }]} numberOfLines={1}>
                  {doctorName}
                </Text>
              </View>
            ) : null}

            {appointment.location ? (
              <View style={styles.metaGroup}>
                <MapPin size={12} color={c.textSecondary} strokeWidth={2} />
                <Text style={[styles.metaText, { color: c.textSecondary }]} numberOfLines={1}>
                  {appointment.location}
                </Text>
              </View>
            ) : null}

            {assigneeName ? (
              <View style={styles.metaGroup}>
                <Users size={12} color={c.primaryText} strokeWidth={2} />
                <Text style={[styles.tagText, { color: c.primaryText }]} numberOfLines={1}>
                  {assigneeName}
                </Text>
              </View>
            ) : null}

            {isCompleted ? (
              <StatusBadge tone="success" label={t('appointments.status.completed')} />
            ) : null}
          </View>
        </View>

        <View style={styles.chevron}>
          <ChevronLeft size={17} color={c.textSecondary} strokeWidth={2.2} />
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  // Error card (shared Dar system-state treatment)
  errorCard: { borderWidth: BorderWidth.standard, borderRadius: Radius.card, padding: 20 },
  errorText: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.control,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Appointment card
  card: { paddingVertical: 12, paddingHorizontal: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconSquare: {
    width: 40,
    height: 40,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  subtitle: { fontSize: 14, fontFamily: FontFamily.medium },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  metaGroup: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  whenText: { fontSize: 14, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  metaText: { fontSize: 14, fontFamily: FontFamily.medium, flexShrink: 1 },
  tagText: { fontSize: 14, fontFamily: FontFamily.bold, flexShrink: 1 },
  chevron: { marginTop: 4, flexShrink: 0 },
});
