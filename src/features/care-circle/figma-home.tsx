import { useRouter } from 'expo-router';
import {
  Activity,
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  FileText,
  ListChecks,
  Phone,
  Pill,
  Stethoscope,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { CareLoopRing } from '@/components/figma/care-loop-ring';
import { IconChip } from '@/components/figma/icon-chip';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaLayout,
  FigmaRadius,
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { useTodayAppointmentSummary, useUpcomingAppointments } from '@/features/appointments/hooks';
import { useCircleSelection } from '@/features/circle-selection/provider';
import type { ActiveCircle } from '@/features/circle-selection/permissions';
import type { MedicationLogStatus } from '@/features/medications/api';
import { useLogDose, useTodayDoses } from '@/features/medications/hooks';
import { summarizeDoses, type DoseItem } from '@/features/medications/today';
import { useRecipient } from '@/features/recipient-profile/hooks';
import { useTodayTaskSummary } from '@/features/tasks/hooks';
import {
  approximateAgeYears,
  formatHm,
  formatLongDate,
  hmFromInstant,
  todayYmd,
  ymdFromInstant,
} from '@/utils/date';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Fixed Figma dose-status colors (constant across modes, as in the export). */
const DOSE_STATUS: Record<MedicationLogStatus, { color: string; Icon: IconCmp }> = {
  given: { color: '#5AAE85', Icon: Check },
  postponed: { color: '#C8904A', Icon: Clock },
  missed: { color: '#C45050', Icon: X },
};
const DOSE_ACTIONS: MedicationLogStatus[] = ['given', 'postponed', 'missed'];

/**
 * The Figma Make Home, recreated as literally as possible in React Native and
 * wired to real Sanad data. Mirrors `HomeScreen.tsx`: header (date + recipient +
 * dropdown + bell + emergency), the care-loop hero (SVG ring + next dose + status
 * strip), two today-summary stat cards, the next-appointment card, a 4-up
 * quick-action grid, the today doses list with inline status logging, and the
 * emergency banner. Cairo + Figma tokens, dark-first, RTL. No old Sanad
 * Screen/Surface/Section/CircleSwitcher/DashboardTile/View-ring.
 */
export function FigmaHome({ circle }: { circle: ActiveCircle }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
  const { width } = useWindowDimensions();
  const date = todayYmd();

  const { doses } = useTodayDoses(circle.circleId, date);
  const { total, given } = summarizeDoses(doses);
  const nextDose = doses.find((d) => d.status !== 'given') ?? null;

  const { summary: taskSummary } = useTodayTaskSummary(circle.circleId);
  const { count: apptCount } = useTodayAppointmentSummary(circle.circleId);
  const appointments = useUpcomingAppointments(circle.circleId);
  const nextAppt = (appointments.data ?? []).find((a) => a.status !== 'cancelled') ?? null;

  const recipient = useRecipient(circle.circleId).data ?? null;
  const { circles, activeCircleId, setActiveCircle } = useCircleSelection();

  const logDose = useLogDose(circle.circleId);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [openDoseKey, setOpenDoseKey] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  async function setStatus(dose: DoseItem, status: MedicationLogStatus) {
    setPendingKey(dose.key);
    try {
      await logDose.mutateAsync({ dose, status, date });
      setOpenDoseKey(null);
    } finally {
      setPendingKey(null);
    }
  }

  // Header subtitle from REAL recipient data (age + dialect); falls back to the
  // recipient name. Age/location aren't both stored, so we show what exists.
  const age = approximateAgeYears(recipient?.birth_date);
  const subtitleParts = [
    age != null ? t('careCircle.dashboard.today.ageYears', { age }) : null,
    recipient?.dialect || null,
  ].filter(Boolean) as string[];
  const headerSubtitle = subtitleParts.length
    ? subtitleParts.join('  ·  ')
    : (circle.recipientName ?? '');

  // Emergency banner subtitle from REAL recipient data (blood type / allergies).
  const allergyShort = recipient?.allergies ? recipient.allergies.trim().slice(0, 40) : '';
  const emergencyParts = [
    recipient?.blood_type
      ? t('careCircle.dashboard.today.emergencyBlood', { value: recipient.blood_type })
      : null,
    allergyShort
      ? t('careCircle.dashboard.today.emergencyAllergy', { value: allergyShort })
      : null,
  ].filter(Boolean) as string[];
  const emergencySubtitle = emergencyParts.length
    ? emergencyParts.join('  ·  ')
    : t('careCircle.dashboard.today.emergencySubtitle');

  const apptIsToday = nextAppt ? ymdFromInstant(nextAppt.starts_at) === date : false;
  const apptTime = nextAppt ? hmFromInstant(nextAppt.starts_at) : '';
  const apptWhen = nextAppt
    ? apptIsToday
      ? t('careCircle.dashboard.today.apptTodayAt', { time: apptTime })
      : `${isolateLtr(ymdFromInstant(nextAppt.starts_at))}  ${isolateLtr(apptTime)}`
    : '';

  // Quick access to every important reachable area (2 rows of 4). Order is the
  // natural RTL reading order; the wrap grid places the first item top-right.
  const quickActions: { id: string; route: string; label: string; color: string; Icon: IconCmp }[] = [
    { id: 'vitals', route: '/vitals', label: t('careCircle.dashboard.sections.vitals.title'), color: FigmaCategory.blue, Icon: Activity },
    { id: 'logs', route: '/daily-logs', label: t('careCircle.dashboard.sections.dailyLogs.title'), color: FigmaCategory.purple, Icon: FileText },
    { id: 'doctors', route: '/doctors', label: t('careCircle.dashboard.sections.doctors.title'), color: FigmaCategory.green, Icon: Stethoscope },
    { id: 'members', route: '/circle-members', label: t('circleMembers.title'), color: FigmaCategory.gold, Icon: Users },
    { id: 'medications', route: '/medications', label: t('careCircle.dashboard.sections.medications.title'), color: FigmaCategory.teal, Icon: Pill },
    { id: 'tasks', route: '/tasks', label: t('careCircle.dashboard.sections.tasks.title'), color: FigmaCategory.blue, Icon: ListChecks },
    { id: 'appointments', route: '/appointments', label: t('careCircle.dashboard.sections.appointments.title'), color: FigmaCategory.purple, Icon: Calendar },
    { id: 'visits', route: '/visits', label: t('careCircle.dashboard.sections.visits.title'), color: FigmaCategory.green, Icon: UserPlus },
  ];
  // Exact 4-up tile width (screen minus the FigmaScreen gutters minus 3 column gaps).
  const quickTileWidth = (width - FigmaLayout.gutter * 2 - 12 * 3) / 4;

  const muted = { color: c.muted, fontFamily: FigmaFont.regular };

  return (
    <FigmaScreen gap={16}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.date, muted]}>{formatLongDate(i18n.language)}</Text>
          <Pressable
            style={styles.nameRow}
            accessibilityRole="button"
            accessibilityHint={t('circleSwitcher.switch')}
            onPress={() => setSwitcherOpen((o) => !o)}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {circle.circleName}
            </Text>
            <ChevronDown size={16} color={c.muted} />
          </Pressable>
          {headerSubtitle ? (
            <Text style={[styles.subtitle, muted]} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.title')}
            style={[styles.action, { backgroundColor: c.elevated, borderColor: c.border }]}>
            <Bell size={20} color={c.muted} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/emergency-card')}
            accessibilityRole="button"
            accessibilityLabel={t('careCircle.dashboard.sections.emergency.title')}
            style={[
              styles.action,
              { backgroundColor: withAlpha(c.error, 0.12), borderColor: withAlpha(c.error, 0.2) },
            ]}>
            <Phone size={20} color={c.error} />
          </Pressable>
        </View>
      </View>

      {/* Compact circle dropdown (real circles + join) */}
      {switcherOpen ? (
        <FigmaCard tone="card" radius={FigmaRadius.r16} padding={0}>
          {circles.map((item, i) => {
            const isActive = item.circleId === activeCircleId;
            return (
              <Pressable
                key={item.circleId}
                onPress={() => {
                  setActiveCircle(item.circleId);
                  setSwitcherOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[styles.switchRow, i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.switchName, { color: c.text }]} numberOfLines={1}>
                  {item.circleName}
                </Text>
                {isActive ? <Check size={16} color={c.primary} /> : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              setSwitcherOpen(false);
              router.push('/join-circle');
            }}
            accessibilityRole="button"
            style={[styles.switchRow, { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.switchJoin, { color: c.primary }]}>
              {t('careCircle.dashboard.today.joinAnotherCircle')}
            </Text>
          </Pressable>
        </FigmaCard>
      ) : null}

      {/* Care-loop hero */}
      <FigmaCard radius={FigmaRadius.r24} padding={FigmaLayout.heroPadding}>
        <View style={styles.heroTop}>
          <Text style={[styles.eyebrow, muted]}>{t('careCircle.dashboard.today.medLoopEyebrow')}</Text>
          <Pressable onPress={() => router.push('/medications')} accessibilityRole="button">
            <Text style={[styles.link, { color: c.primary }]}>{t('careCircle.dashboard.today.viewAll')}</Text>
          </Pressable>
        </View>
        <View style={styles.heroBody}>
          <CareLoopRing given={given} total={total} />
          <View style={styles.heroRight}>
            {total === 0 ? (
              <Text style={[styles.heroMuted, muted]}>{t('careCircle.dashboard.today.loopNone')}</Text>
            ) : given >= total ? (
              <View style={[styles.allDone, { backgroundColor: withAlpha('#5AAE85', 0.12) }]}>
                <Check size={16} color="#5AAE85" />
                <Text style={styles.allDoneText}>{t('careCircle.dashboard.today.allDosesGiven')}</Text>
              </View>
            ) : nextDose ? (
              <View>
                <Text style={[styles.nextLabel, muted]}>{t('careCircle.dashboard.today.nextDoseLabel')}</Text>
                <View style={[styles.nextDose, { backgroundColor: c.elevated, borderColor: c.border }]}>
                  <View style={styles.nextDoseTop}>
                    <Text style={[styles.nextName, { color: c.text }]} numberOfLines={1}>
                      {nextDose.medicationName}
                    </Text>
                    <Text style={[styles.nextTime, { color: c.primary }]}>
                      {isolateLtr(formatHm(nextDose.scheduledTime))}
                    </Text>
                  </View>
                  {nextDose.dosage ? (
                    <Text style={[styles.nextDosage, muted]} numberOfLines={1}>
                      {nextDose.dosage}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {total > 0 ? (
              <View style={styles.strip}>
                {doses.slice(0, 5).map((d) => {
                  const cfg = d.status ? DOSE_STATUS[d.status] : null;
                  const color = cfg ? cfg.color : c.muted;
                  const StripIcon = cfg ? cfg.Icon : Clock;
                  // Pending/unlogged = a solid cream/elevated pill (Figma `--muted`),
                  // visibly lighter than the tinted given/postponed/missed pills.
                  const pillBg = cfg ? withAlpha(color, 0.12) : c.mutedSurface;
                  return (
                    <View key={d.key} style={[styles.stripPill, { backgroundColor: pillBg }]}>
                      <StripIcon size={12} color={color} />
                      <Text style={[styles.stripTime, { color }]}>{isolateLtr(formatHm(d.scheduledTime))}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      </FigmaCard>

      {/* Today summary — two stat cards */}
      <View style={styles.summaryRow}>
        <StatCard
          scheme={scheme}
          Icon={Check}
          iconColor={c.success}
          topLabel={t('careCircle.dashboard.sections.tasks.title')}
          value={String(taskSummary.dueToday)}
          subLabel={t('careCircle.dashboard.today.dueTodayShort')}
          onPress={() => router.push('/tasks')}
        />
        <StatCard
          scheme={scheme}
          Icon={Calendar}
          iconColor={FigmaCategory.blue}
          topLabel={t('careCircle.dashboard.sections.appointments.title')}
          value={String(apptCount)}
          subLabel={t('careCircle.dashboard.today.appointmentLabel')}
          onPress={() => router.push('/appointments')}
        />
      </View>

      {/* Next appointment (only when real data exists) */}
      {nextAppt ? (
        <FigmaCard radius={FigmaRadius.r24} padding={16} onPress={() => router.push('/appointments')}>
          <View style={styles.apptRow}>
            <IconChip Icon={Stethoscope} color={FigmaCategory.blue} size={48} radius={FigmaRadius.r16} iconSize={22} />
            <View style={styles.apptText}>
              <Text style={[styles.apptWhen, muted]}>{apptWhen}</Text>
              <Text style={[styles.apptTitle, { color: c.text }]} numberOfLines={1}>
                {nextAppt.title}
              </Text>
              {nextAppt.location ? (
                <Text style={[styles.apptLoc, muted]} numberOfLines={1}>
                  {nextAppt.location}
                </Text>
              ) : null}
            </View>
            <ChevronLeft size={18} color={c.muted} />
          </View>
        </FigmaCard>
      ) : null}

      {/* Quick actions — 4-up grid, wraps to a second row */}
      <View>
        <Text style={[styles.sectionLabel, muted]}>{t('careCircle.dashboard.today.quickActions')}</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((qa) => (
            <Pressable
              key={qa.id}
              onPress={() => router.push(qa.route as never)}
              accessibilityRole="button"
              accessibilityLabel={qa.label}
              style={[styles.quickTile, { width: quickTileWidth, backgroundColor: c.card, borderColor: c.border }]}>
              <IconChip Icon={qa.Icon} color={qa.color} size={40} radius={FigmaRadius.r12} iconSize={20} />
              <Text style={[styles.quickLabel, muted]} numberOfLines={2}>
                {qa.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Today's doses */}
      {total > 0 ? (
        <View>
          <View style={styles.dosesHeader}>
            <Text style={[styles.sectionLabel, muted]}>{t('medications.todayTitle')}</Text>
            <Pressable onPress={() => router.push('/medications')} accessibilityRole="button">
              <Text style={[styles.link, { color: c.primary }]}>{t('careCircle.dashboard.today.allMedications')}</Text>
            </Pressable>
          </View>
          <View style={styles.doseList}>
            {doses.map((dose) => (
              <DoseRow
                key={dose.key}
                dose={dose}
                scheme={scheme}
                canLog={circle.canLogDoses}
                open={openDoseKey === dose.key}
                pending={pendingKey === dose.key}
                onToggle={() => setOpenDoseKey((k) => (k === dose.key ? null : dose.key))}
                onSetStatus={(status) => setStatus(dose, status)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Emergency banner */}
      <Pressable
        onPress={() => router.push('/emergency-card')}
        accessibilityRole="button"
        accessibilityLabel={t('careCircle.dashboard.today.emergencyTitle')}
        style={[
          styles.emergency,
          { backgroundColor: withAlpha(c.error, 0.08), borderColor: withAlpha(c.error, 0.2) },
        ]}>
        <View style={[styles.emergencyChip, { backgroundColor: withAlpha(c.error, 0.15) }]}>
          <AlertCircle size={22} color={c.error} />
        </View>
        <View style={styles.emergencyText}>
          <Text style={[styles.emergencyTitle, { color: c.error }]}>
            {t('careCircle.dashboard.today.emergencyTitle')}
          </Text>
          <Text style={[styles.emergencySub, muted]} numberOfLines={1}>
            {emergencySubtitle}
          </Text>
        </View>
        <View style={[styles.emergencyBtn, { backgroundColor: c.error }]}>
          <Text style={styles.emergencyBtnText}>{t('careCircle.dashboard.today.emergencyView')}</Text>
        </View>
      </Pressable>
    </FigmaScreen>
  );
}

function StatCard({
  scheme,
  Icon,
  iconColor,
  topLabel,
  value,
  subLabel,
  onPress,
}: {
  scheme: FigmaScheme;
  Icon: IconCmp;
  iconColor: string;
  topLabel: string;
  value: string;
  subLabel: string;
  onPress: () => void;
}) {
  const c = FigmaColors[scheme];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${topLabel}: ${value} ${subLabel}`}
      style={[styles.stat, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.statTop}>
        <Icon size={16} color={iconColor} />
        <Text style={[styles.statTopLabel, { color: c.muted, fontFamily: FigmaFont.regular }]}>{topLabel}</Text>
      </View>
      <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.statSub, { color: c.muted, fontFamily: FigmaFont.regular }]}>{subLabel}</Text>
    </Pressable>
  );
}

function DoseRow({
  dose,
  scheme,
  canLog,
  open,
  pending,
  onToggle,
  onSetStatus,
}: {
  dose: DoseItem;
  scheme: FigmaScheme;
  canLog: boolean;
  open: boolean;
  pending: boolean;
  onToggle: () => void;
  onSetStatus: (status: MedicationLogStatus) => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];
  const status = dose.status;
  const cfg = status ? DOSE_STATUS[status] : null;
  const StatusIcon = cfg ? cfg.Icon : Clock;
  const statusColor = cfg ? cfg.color : c.muted;
  // Pending/unlogged = solid cream/elevated (Figma `--muted`); logged = a tint.
  const statusBg = cfg ? withAlpha(statusColor, 0.12) : c.mutedSurface;
  const statusLabel = status ? t(`medications.status.${status}`) : t('careCircle.dashboard.today.doseUnlogged');

  return (
    <View>
      <View style={[styles.doseRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={[styles.doseStatusCircle, { backgroundColor: statusBg }]}>
          <StatusIcon size={16} color={statusColor} />
        </View>
        <View style={styles.doseInfo}>
          <View style={styles.doseNameRow}>
            <Text style={[styles.doseName, { color: c.text }]} numberOfLines={1}>
              {dose.medicationName}
            </Text>
            {dose.dosage ? <Text style={[styles.doseDosage, { color: c.muted }]}>{dose.dosage}</Text> : null}
          </View>
          <View style={styles.doseMetaRow}>
            <Text style={[styles.doseTime, { color: c.muted }]}>{isolateLtr(formatHm(dose.scheduledTime))}</Text>
            <View style={[styles.doseTag, { backgroundColor: statusBg }]}>
              <Text style={[styles.doseTagText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
        {!status && canLog ? (
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={`${t('careCircle.dashboard.today.logAction')} ${dose.medicationName}`}
            style={[styles.logBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.logBtnText, { color: c.onPrimary }]}>{t('careCircle.dashboard.today.logAction')}</Text>
          </Pressable>
        ) : null}
      </View>
      {open && !status && canLog ? (
        <View style={[styles.doseActions, { backgroundColor: c.elevated, borderColor: c.border }]}>
          {DOSE_ACTIONS.map((s) => {
            const a = DOSE_STATUS[s];
            const ActionIcon = a.Icon;
            return (
              <Pressable
                key={s}
                disabled={pending}
                onPress={() => onSetStatus(s)}
                accessibilityRole="button"
                style={[styles.doseAction, { backgroundColor: withAlpha(a.color, 0.15), opacity: pending ? 0.5 : 1 }]}>
                <ActionIcon size={14} color={a.color} />
                <Text style={[styles.doseActionText, { color: a.color }]}>{t(`medications.status.${s}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerText: { flexShrink: 1, gap: 2 },
  date: { fontSize: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 20, fontFamily: FigmaFont.bold, flexShrink: 1 },
  subtitle: { fontSize: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: {
    width: FigmaLayout.headerActionSize,
    height: FigmaLayout.headerActionSize,
    borderRadius: FigmaRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Circle dropdown
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, minHeight: 48 },
  switchName: { fontSize: 15, fontFamily: FigmaFont.medium, flexShrink: 1 },
  switchJoin: { fontSize: 14, fontFamily: FigmaFont.medium },
  // Hero
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  eyebrow: { fontSize: 13, fontFamily: FigmaFont.semibold, letterSpacing: 0.3 },
  link: { fontSize: 13, fontFamily: FigmaFont.medium },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 12 },
  heroRight: { flex: 1, gap: 8 },
  heroMuted: { fontSize: 13 },
  allDone: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: FigmaRadius.r16, paddingHorizontal: 12, paddingVertical: 8 },
  allDoneText: { fontSize: 13, color: '#5AAE85', fontFamily: FigmaFont.semibold },
  nextLabel: { fontSize: 12 },
  nextDose: { marginTop: 6, borderRadius: FigmaRadius.r16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  nextDoseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nextName: { fontSize: 14, fontFamily: FigmaFont.semibold, flexShrink: 1 },
  nextTime: { fontSize: 12, fontFamily: FigmaFont.medium },
  nextDosage: { fontSize: 12, marginTop: 2 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  stripPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: FigmaRadius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  stripTime: { fontSize: 11, fontFamily: FigmaFont.medium },
  // Summary
  summaryRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: FigmaRadius.r16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 2 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statTopLabel: { fontSize: 12 },
  statValue: { fontSize: 22, fontFamily: FigmaFont.bold },
  statSub: { fontSize: 13 },
  // Next appointment
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptText: { flex: 1, gap: 2 },
  apptWhen: { fontSize: 11 },
  apptTitle: { fontSize: 15, fontFamily: FigmaFont.semibold },
  apptLoc: { fontSize: 12 },
  // Quick actions
  sectionLabel: { fontSize: 13, fontFamily: FigmaFont.semibold, marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 12 },
  quickTile: {
    alignItems: 'center',
    gap: 8,
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  quickLabel: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
  // Doses
  dosesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  doseList: { gap: 8 },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: FigmaRadius.r16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12 },
  doseStatusCircle: { width: 36, height: 36, borderRadius: FigmaRadius.pill, alignItems: 'center', justifyContent: 'center' },
  doseInfo: { flex: 1, gap: 2 },
  doseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseName: { fontSize: 14, fontFamily: FigmaFont.semibold, flexShrink: 1 },
  doseDosage: { fontSize: 12, fontFamily: FigmaFont.regular },
  doseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseTime: { fontSize: 12, fontFamily: FigmaFont.regular },
  doseTag: { borderRadius: FigmaRadius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  doseTagText: { fontSize: 10, fontFamily: FigmaFont.medium },
  logBtn: { borderRadius: FigmaRadius.pill, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  logBtnText: { fontSize: 12, fontFamily: FigmaFont.semibold },
  doseActions: { flexDirection: 'row', gap: 8, borderRadius: FigmaRadius.r16, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginTop: 4 },
  doseAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: FigmaRadius.r12, paddingVertical: 10, minHeight: 44 },
  doseActionText: { fontSize: 13, fontFamily: FigmaFont.semibold },
  // Emergency
  emergency: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: FigmaRadius.r24, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  emergencyChip: { width: 44, height: 44, borderRadius: FigmaRadius.pill, alignItems: 'center', justifyContent: 'center' },
  emergencyText: { flex: 1, gap: 2 },
  emergencyTitle: { fontSize: 14, fontFamily: FigmaFont.bold },
  emergencySub: { fontSize: 12 },
  emergencyBtn: { borderRadius: FigmaRadius.r12, paddingHorizontal: 14, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  emergencyBtnText: { fontSize: 13, color: '#FFFFFF', fontFamily: FigmaFont.semibold },
});
