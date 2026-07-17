import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  HandHelping,
  Phone,
  Share2,
  Users,
  X,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Surface } from '@/components/surface';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { CareLoopRing } from '@/components/figma/care-loop-ring';
import { GlyphChip } from '@/components/glyph-chip';
import { type IconName } from '@/constants/icons';
import { FontFamily, Gutter, Radius, withAlpha, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isolateLtr } from '@/components/ltr-text';
import { useUpcomingAppointments } from '@/features/appointments/hooks';
import { countAppointmentsToday } from '@/features/care-activity/today';
import { useResponsibleLabel } from '@/features/circle-members/member-assignment';
import { useCircleSelection } from '@/features/circle-selection/provider';
import type { ActiveCircle } from '@/features/circle-selection/permissions';
import type { MedicationLogStatus } from '@/features/medications/api';
import { useLogDose, useTodayDoses } from '@/features/medications/hooks';
import { summarizeDoses, type DoseItem } from '@/features/medications/today';
import { useUnreadCount } from '@/features/notifications/hooks';
import { useCareActivity } from '@/features/pulse/hooks';
import {
  composePulseShareText,
  pulseDescription,
  pulseEventVisual,
  pulseRouteFor,
  sharePulseSummary,
  usePulseActorLabel,
} from '@/features/pulse/present';
import { useRecipient } from '@/features/recipient-profile/hooks';
import { useTodayTaskSummary } from '@/features/tasks/hooks';
import { useAuth } from '@/providers';
import {
  approximateAgeYears,
  formatHm,
  formatLongDate,
  hmFromInstant,
  hmInTimeZone,
  todayYmd,
  todayYmdInTimeZone,
  ymdFromInstant,
  ymdInTimeZone,
} from '@/utils/date';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Fixed Figma dose-status colors (constant across modes, as in the export). */
const DOSE_STATUS: Record<MedicationLogStatus, { colorKey: ThemeColor; Icon: IconCmp }> = {
  given: { colorKey: 'successFg', Icon: Check },
  postponed: { colorKey: 'warningFg', Icon: Clock },
  missed: { colorKey: 'errorFg', Icon: X },
};
const DOSE_ACTIONS: MedicationLogStatus[] = ['given', 'postponed', 'missed'];

/** Home Care-Pulse strip: fetch a small buffer, then filter-to-today and cap at 5. */
const HOME_PULSE_FETCH = 20;
const HOME_PULSE_MAX = 5;

/**
 * The Figma Make Home, recreated as literally as possible in React Native and
 * wired to real Sanad data. Mirrors `HomeScreen.tsx`: header (date + recipient +
 * dropdown + bell + emergency), the care-loop hero (SVG ring + next dose + status
 * strip), two today-summary stat cards, the next-appointment card, a 4-up
 * quick-action grid, the today doses list with inline status logging, and the
 * emergency banner. IBM Plex + theme tokens, dark-first, RTL. No old Sanad
 * Screen/Surface/Section/CircleSwitcher/DashboardTile/View-ring.
 */
export function FigmaHome({ circle }: { circle: ActiveCircle }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const { width } = useWindowDimensions();
  const date = todayYmd();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Family members (non-managers who can log) see only doses/appointments they are
  // responsible for; managers see all; read-only members see all (no actions). The
  // care-loop, next-dose, dose list, next-appointment and today's-appointment count
  // all reflect this scope so a family member's home shows THEIR day, not everyone's.
  const scopeToMine = !circle.canManage && circle.canLogDoses;

  const {
    doses,
    isError: dosesError,
    refetch: refetchDoses,
  } = useTodayDoses(circle.circleId, date);
  const visibleDoses = scopeToMine ? doses.filter((d) => d.responsibleUserId === userId) : doses;
  const { total, given } = summarizeDoses(visibleDoses);
  const nextDose = visibleDoses.find((d) => d.status !== 'given') ?? null;
  // Display order (A7): unlogged doses lead; time order preserved within groups
  // (stable). Summary + "next dose" above keep the chronological list.
  const orderedDoses = [...visibleDoses].sort(
    (a, b) => (a.status === null ? 0 : 1) - (b.status === null ? 0 : 1),
  );

  // Scope the "tasks due today" stat the same way the doses/appointments above
  // are scoped: a family member counts only their own assigned tasks; managers
  // count the whole circle. Without this the stat showed the circle-wide count.
  const {
    summary: taskSummary,
    isError: tasksError,
    refetch: refetchTasks,
  } = useTodayTaskSummary(circle.circleId, scopeToMine ? userId : null);
  const responsibleLabel = useResponsibleLabel(circle.circleId);
  const appointments = useUpcomingAppointments(circle.circleId);
  const visibleAppts = scopeToMine
    ? (appointments.data ?? []).filter((a) => a.assigned_to === userId)
    : (appointments.data ?? []);
  const apptCount = countAppointmentsToday(visibleAppts, date);
  const nextAppt = visibleAppts.find((a) => a.status !== 'cancelled') ?? null;

  const recipient = useRecipient(circle.circleId).data ?? null;
  const { circles, activeCircleId, setActiveCircle } = useCircleSelection();

  const logDose = useLogDose(circle.circleId);
  const unread = useUnreadCount();
  const unreadCount = unread.data ?? 0;
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [openDoseKey, setOpenDoseKey] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  async function setStatus(dose: DoseItem, status: MedicationLogStatus) {
    setPendingKey(dose.key);
    setLogError(null);
    try {
      await logDose.mutateAsync({ dose, status, date });
      setOpenDoseKey(null);
    } catch {
      // A failed dose log used to disappear silently — the row just reverted,
      // which reads as "nothing happened." Surface it so the caregiver retries.
      setLogError(t('careCircle.dashboard.today.logFailed'));
    } finally {
      setPendingKey(null);
    }
  }

  // Today's sub-queries (doses / tasks / appointments) each fail independently. If
  // any errored, an empty dashboard would be indistinguishable from a genuinely
  // clear day — so show one retry banner rather than silently hiding the failure.
  const todayLoadError = dosesError || tasksError || appointments.isError;
  function retryToday() {
    refetchDoses();
    refetchTasks();
    appointments.refetch();
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
  // Canonical Sanad ordering (meds → tasks → appointments → vitals → visits →
  // daily logs → doctors → members). The RTL wrap grid places the first item
  // top-right, so medications — the highest-stakes surface — leads (A7).
  const quickActions: { id: string; route: string; label: string; color: ThemeColor; iconName: IconName }[] = [
    { id: 'medications', route: '/medications', label: t('careCircle.dashboard.sections.medications.title'), color: 'categoryTeal', iconName: 'medication' },
    { id: 'tasks', route: '/tasks', label: t('careCircle.dashboard.sections.tasks.title'), color: 'categoryBlue', iconName: 'task' },
    { id: 'appointments', route: '/appointments', label: t('careCircle.dashboard.sections.appointments.title'), color: 'categoryPurple', iconName: 'appointment' },
    { id: 'vitals', route: '/vitals', label: t('careCircle.dashboard.sections.vitals.title'), color: 'categoryBlue', iconName: 'activity' },
    { id: 'visits', route: '/visits', label: t('careCircle.dashboard.sections.visits.title'), color: 'categoryGreen', iconName: 'invite' },
    { id: 'logs', route: '/daily-logs', label: t('careCircle.dashboard.sections.dailyLogs.title'), color: 'categoryPurple', iconName: 'dailyLog' },
    { id: 'doctors', route: '/doctors', label: t('careCircle.dashboard.sections.doctors.title'), color: 'categoryGreen', iconName: 'doctor' },
    { id: 'members', route: '/circle-members', label: t('circleMembers.title'), color: 'categoryGold', iconName: 'member' },
  ];
  // Exact 4-up tile width (screen minus the FigmaScreen gutters minus 3 column gaps).
  const quickTileWidth = (width - Gutter * 2 - 12 * 3) / 4;

  const muted = { color: c.textSecondary, fontFamily: FontFamily.regular };

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
            <ChevronDown size={16} color={c.textSecondary} />
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
            accessibilityLabel={
              unreadCount > 0
                ? t('notifications.openCenterWithCount', { count: unreadCount })
                : t('notifications.title')
            }
            style={[styles.action, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
            <Bell size={20} color={c.textSecondary} />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.dangerSolid, borderColor: c.background }]}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {isolateLtr(unreadCount > 9 ? '9+' : String(unreadCount))}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => router.push('/emergency-card')}
            accessibilityRole="button"
            accessibilityLabel={t('careCircle.dashboard.sections.emergency.title')}
            style={[
              styles.action,
              { backgroundColor: withAlpha(c.dangerSolid, 0.12), borderColor: withAlpha(c.dangerSolid, 0.2) },
            ]}>
            <Phone size={20} color={c.errorFg} />
          </Pressable>
        </View>
      </View>

      {/* Today's-data load failure — a retryable banner so a failed fetch never
          masquerades as an empty day. */}
      {todayLoadError ? (
        <Pressable
          onPress={retryToday}
          accessibilityRole="button"
          accessibilityLabel={t('retry')}
          style={[
            styles.notice,
            { backgroundColor: withAlpha(c.dangerSolid, 0.1), borderColor: withAlpha(c.dangerSolid, 0.25) },
          ]}>
          <AlertCircle size={16} color={c.errorFg} />
          <Text style={[styles.noticeText, { color: c.errorFg }]}>
            {t('careCircle.dashboard.today.loadError')}
          </Text>
          <Text style={[styles.noticeAction, { color: c.errorFg }]}>{t('retry')}</Text>
        </Pressable>
      ) : logError ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: withAlpha(c.dangerSolid, 0.1), borderColor: withAlpha(c.dangerSolid, 0.25) },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          <AlertCircle size={16} color={c.errorFg} />
          <Text style={[styles.noticeText, { color: c.errorFg }]}>{logError}</Text>
        </View>
      ) : null}

      {/* Compact circle dropdown (real circles + join) */}
      {switcherOpen ? (
        <Surface tone="card" radius={Radius.lg} padded={0}>
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
        </Surface>
      ) : null}

      {/* Care-loop hero */}
      <Surface radius={Radius.xl} padded={20}>
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
              // Moment of care: a quiet "today's doses are complete" — a calm check
              // + reassurance on the ring, never a score or streak (no gamification).
              <View style={[styles.allDone, { backgroundColor: withAlpha(c.successFg, 0.12) }]}>
                <Check size={16} color={c.successFg} />
                <Text style={[styles.allDoneText, { color: c.successFg }]}>
                  {t('careCircle.dashboard.today.allDosesGiven')}
                </Text>
              </View>
            ) : nextDose ? (
              <View>
                <Text style={[styles.nextLabel, muted]}>{t('careCircle.dashboard.today.nextDoseLabel')}</Text>
                <View style={[styles.nextDose, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
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
                {visibleDoses.slice(0, 5).map((d) => {
                  const cfg = d.status ? DOSE_STATUS[d.status] : null;
                  const color = cfg ? c[cfg.colorKey] : c.textSecondary;
                  const StripIcon = cfg ? cfg.Icon : Clock;
                  // Pending/unlogged = a solid cream/elevated pill (Figma `--muted`),
                  // visibly lighter than the tinted given/postponed/missed pills.
                  const pillBg = cfg ? withAlpha(color, 0.12) : c.backgroundSunken;
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
      </Surface>

      {/* Today summary — two stat cards */}
      <View style={styles.summaryRow}>
        <StatCard
          Icon={Check}
          iconColor={c.successFg}
          topLabel={t('careCircle.dashboard.sections.tasks.title')}
          value={String(taskSummary.dueToday)}
          subLabel={t('careCircle.dashboard.today.dueTodayShort')}
          onPress={() => router.push('/tasks')}
        />
        <StatCard
          Icon={Calendar}
          iconColor={c.categoryBlue}
          topLabel={t('careCircle.dashboard.sections.appointments.title')}
          value={String(apptCount)}
          subLabel={t('careCircle.dashboard.today.appointmentLabel')}
          onPress={() => router.push('/appointments')}
        />
      </View>

      {/* Next appointment (only when real data exists) */}
      {nextAppt ? (
        <Surface radius={Radius.xl} padded={16} onPress={() => router.push('/appointments')}>
          <View style={styles.apptRow}>
            <GlyphChip iconName="doctor" color="categoryBlue" size="md" />
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
            <ChevronLeft size={18} color={c.textSecondary} />
          </View>
        </Surface>
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
              style={[styles.quickTile, { width: quickTileWidth, backgroundColor: c.backgroundElement, borderColor: c.border }]}>
              <GlyphChip iconName={qa.iconName} color={qa.color} size="md" />
              <Text style={[styles.quickLabel, muted]} numberOfLines={2}>
                {qa.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Available to claim — claim-capable members only (never remote/elder) */}
      {circle.canManage || circle.canLogDoses ? (
        <Pressable
          onPress={() => router.push('/available-to-claim')}
          accessibilityRole="button"
          accessibilityLabel={t('claiming.entryTitle')}
          style={[
            styles.claimCard,
            { backgroundColor: withAlpha(c.accentFg, 0.1), borderColor: withAlpha(c.accentFg, 0.22) },
          ]}>
          <View style={[styles.claimChip, { backgroundColor: withAlpha(c.accentFg, 0.15) }]}>
            <HandHelping size={22} color={c.accentFg} />
          </View>
          <View style={styles.claimText}>
            <Text style={[styles.claimTitle, { color: c.text }]}>{t('claiming.entryTitle')}</Text>
            <Text style={[styles.claimSub, muted]} numberOfLines={1}>
              {t('claiming.entrySubtitle')}
            </Text>
          </View>
          <ChevronLeft size={18} color={c.textSecondary} />
        </Pressable>
      ) : null}

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
            {orderedDoses.map((dose) => (
              <DoseRow
                key={dose.key}
                dose={dose}
                responsibleText={circle.canManage ? responsibleLabel(dose.responsibleUserId) : null}
                canLog={circle.canLogDoses && (circle.canManage || dose.responsibleUserId === userId)}
                open={openDoseKey === dose.key}
                pending={pendingKey === dose.key}
                onToggle={() => setOpenDoseKey((k) => (k === dose.key ? null : dose.key))}
                onSetStatus={(status) => setStatus(dose, status)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Care Pulse — today's most-recent circle events, tap through to the log */}
      <PulseSection circleId={circle.circleId} timezone={circle.timezone} />

      {/* Emergency banner */}
      <Pressable
        onPress={() => router.push('/emergency-card')}
        accessibilityRole="button"
        accessibilityLabel={t('careCircle.dashboard.today.emergencyTitle')}
        style={[
          styles.emergency,
          { backgroundColor: withAlpha(c.dangerSolid, 0.08), borderColor: withAlpha(c.dangerSolid, 0.2) },
        ]}>
        <View style={[styles.emergencyChip, { backgroundColor: withAlpha(c.dangerSolid, 0.15) }]}>
          <AlertCircle size={22} color={c.errorFg} />
        </View>
        <View style={styles.emergencyText}>
          <Text style={[styles.emergencyTitle, { color: c.errorFg }]}>
            {t('careCircle.dashboard.today.emergencyTitle')}
          </Text>
          <Text style={[styles.emergencySub, muted]} numberOfLines={1}>
            {emergencySubtitle}
          </Text>
        </View>
        <View style={[styles.emergencyBtn, { backgroundColor: c.dangerSolid }]}>
          <Text style={styles.emergencyBtnText}>{t('careCircle.dashboard.today.emergencyView')}</Text>
        </View>
      </Pressable>
    </FigmaScreen>
  );
}

function StatCard({
  Icon,
  iconColor,
  topLabel,
  value,
  subLabel,
  onPress,
}: {
  Icon: IconCmp;
  iconColor: string;
  topLabel: string;
  value: string;
  subLabel: string;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${topLabel}: ${value} ${subLabel}`}
      style={[styles.stat, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <View style={styles.statTop}>
        <Icon size={16} color={iconColor} />
        <Text style={[styles.statTopLabel, { color: c.textSecondary, fontFamily: FontFamily.regular }]}>{topLabel}</Text>
      </View>
      <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.statSub, { color: c.textSecondary, fontFamily: FontFamily.regular }]}>{subLabel}</Text>
    </Pressable>
  );
}

function DoseRow({
  dose,
  responsibleText,
  canLog,
  open,
  pending,
  onToggle,
  onSetStatus,
}: {
  dose: DoseItem;
  responsibleText: string | null;
  canLog: boolean;
  open: boolean;
  pending: boolean;
  onToggle: () => void;
  onSetStatus: (status: MedicationLogStatus) => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const status = dose.status;
  const cfg = status ? DOSE_STATUS[status] : null;
  const StatusIcon = cfg ? cfg.Icon : Clock;
  const statusColor = cfg ? c[cfg.colorKey] : c.textSecondary;
  // Pending/unlogged = solid cream/elevated (Figma `--muted`); logged = a tint.
  const statusBg = cfg ? withAlpha(statusColor, 0.12) : c.backgroundSunken;
  const statusLabel = status ? t(`medications.status.${status}`) : t('careCircle.dashboard.today.doseUnlogged');
  const isLogged = status !== null;

  // A logged dose stays correctable (P2-4): the tray reopens for a manager /
  // responsible logger and a status change is confirmed before it overwrites.
  const [confirmStatus, setConfirmStatus] = useState<MedicationLogStatus | null>(null);
  useEffect(() => {
    if (!open) setConfirmStatus(null);
  }, [open]);

  function pick(s: MedicationLogStatus) {
    if (!isLogged) onSetStatus(s);
    else if (s === status) onToggle();
    else setConfirmStatus(s);
  }

  return (
    <View>
      <View style={[styles.doseRow, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.doseStatusCircle, { backgroundColor: statusBg }]}>
          <StatusIcon size={16} color={statusColor} />
        </View>
        <View style={styles.doseInfo}>
          {/* Name wraps to two lines (never truncated); dosage on its own line. */}
          <Text style={[styles.doseName, { color: c.text }]} numberOfLines={2}>
            {dose.medicationName}
          </Text>
          {dose.dosage ? <Text style={[styles.doseDosage, { color: c.textSecondary }]}>{dose.dosage}</Text> : null}
          <View style={styles.doseMetaRow}>
            <Text style={[styles.doseTime, { color: c.textSecondary }]}>{isolateLtr(formatHm(dose.scheduledTime))}</Text>
            <View style={[styles.doseTag, { backgroundColor: statusBg }]}>
              <Text style={[styles.doseTagText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          {responsibleText ? (
            <View style={styles.doseResponsibleRow}>
              <Users size={12} color={c.textSecondary} />
              <Text style={[styles.doseResponsibleText, { color: c.textSecondary }]} numberOfLines={1}>
                {responsibleText}
              </Text>
            </View>
          ) : null}
        </View>
        {canLog ? (
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={`${isLogged ? t('medications.editStatus') : t('careCircle.dashboard.today.logAction')} ${dose.medicationName}`}
            style={
              isLogged
                ? [styles.editBtn, { borderColor: withAlpha(c.primary, 0.4) }]
                : [styles.logBtn, { backgroundColor: c.primary }]
            }>
            <Text style={[styles.logBtnText, { color: isLogged ? c.primary : c.onPrimary }]}>
              {isLogged ? t('medications.editStatus') : t('careCircle.dashboard.today.logAction')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {open && canLog ? (
        <View style={[styles.doseActions, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
          {confirmStatus ? (
            <View style={styles.correctionRow}>
              <Text
                style={[styles.correctionText, { color: c.text }]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                {t('medications.confirmChangeStatus', {
                  status: t(`medications.status.${confirmStatus}`),
                })}
              </Text>
              <View style={styles.correctionActions}>
                <Pressable
                  onPress={() => onSetStatus(confirmStatus)}
                  disabled={pending}
                  accessibilityRole="button"
                  style={[styles.correctionConfirm, { backgroundColor: c.primary, opacity: pending ? 0.6 : 1 }]}>
                  {pending ? (
                    <ActivityIndicator size="small" color={c.onPrimary} />
                  ) : (
                    <Text style={[styles.correctionConfirmText, { color: c.onPrimary }]}>{t('common.save')}</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setConfirmStatus(null)}
                  disabled={pending}
                  accessibilityRole="button"
                  style={[styles.correctionCancel, { borderColor: c.border }]}>
                  <Text style={[styles.correctionCancelText, { color: c.textSecondary }]}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            DOSE_ACTIONS.map((s) => {
              const a = DOSE_STATUS[s];
              const ActionIcon = a.Icon;
              const color = c[a.colorKey];
              const selected = s === status;
              return (
                <Pressable
                  key={s}
                  disabled={pending}
                  onPress={() => pick(s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.doseAction,
                    {
                      backgroundColor: withAlpha(color, selected ? 0.24 : 0.15),
                      opacity: pending ? 0.5 : 1,
                    },
                  ]}>
                  <ActionIcon size={14} color={color} />
                  <Text style={[styles.doseActionText, { color }]}>{t(`medications.status.${s}`)}</Text>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Home's compact «نبض اليوم» strip: TODAY's most-recent circle events (scoped to
 * the circle's local day) with a «عرض الكل» link into the full activity log
 * (/pulse). Kept quiet on Home — it renders nothing while loading, on error, or
 * when there's no activity today (or the RPC isn't enabled yet), so a quiet day —
 * or a not-yet-migrated backend — never shows an error here.
 */
function PulseSection({
  circleId,
  timezone,
}: {
  circleId: string;
  timezone: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  // Fetch a small buffer (not just 5): a deliberately future-dated event sorts
  // ahead of today's by occurred_at and would otherwise squeeze a real today event
  // out of a 5-row page. We filter to today and cap at 5 below.
  const activity = useCareActivity(circleId, HOME_PULSE_FETCH);
  const actorLabel = usePulseActorLabel(circleId);

  // Refresh the strip when Home regains focus so an action taken on another screen
  // (and the pulse-key invalidation those mutations now fire) is reflected without
  // leaving and re-entering Home (D1).
  const refetch = activity.refetch;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // Scope to TODAY in the CIRCLE's local day (D2), then cap at 5. No events today
  // → quiet (renders nothing).
  const today = todayYmdInTimeZone(timezone);
  const events = (activity.data ?? [])
    .filter((e) => ymdInTimeZone(e.occurred_at, timezone) === today)
    .slice(0, HOME_PULSE_MAX);

  if (activity.isLoading || activity.isError || events.length === 0) return null;

  return (
    <View>
      <View style={styles.dosesHeader}>
        <Text style={[styles.sectionLabel, { color: c.textSecondary, fontFamily: FontFamily.regular, marginBottom: 0 }]}>
          {t('pulse.sectionTitle')}
        </Text>
        <View style={styles.pulseHeaderActions}>
          <Pressable
            onPress={() => sharePulseSummary(composePulseShareText(events, t, actorLabel, timezone))}
            accessibilityRole="button"
            accessibilityLabel={t('pulse.share')}
            hitSlop={8}>
            <Share2 size={16} color={c.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/pulse')} accessibilityRole="button">
            <Text style={[styles.link, { color: c.primary }]}>{t('pulse.viewAll')}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.pulseList}>
        {events.map((event) => {
          const { iconName, colorKey } = pulseEventVisual(event);
          return (
            <Pressable
              key={`${event.event_type}:${event.event_id}`}
              onPress={() => router.push(pulseRouteFor(event.item_type, event.item_id))}
              accessibilityRole="button"
              accessibilityHint={t('common.details')}
              style={({ pressed }) => [
                styles.pulseRow,
                { backgroundColor: c.backgroundElement, borderColor: c.border },
                pressed && { opacity: 0.7 },
              ]}>
              <GlyphChip iconName={iconName} color={colorKey} size="md" />
              <View style={styles.pulseInfo}>
                <Text style={[styles.pulseDesc, { color: c.text }]} numberOfLines={2}>
                  {pulseDescription(event, t, actorLabel)}
                </Text>
                <Text style={[styles.pulseTime, { color: c.textSecondary }]}>
                  {isolateLtr(hmInTimeZone(event.occurred_at, timezone))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerText: { flexShrink: 1, gap: 2 },
  date: { fontSize: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 20, fontFamily: FontFamily.bold, flexShrink: 1 },
  subtitle: { fontSize: 14 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Unread badge on the bell (app-wide unread indicator)
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontFamily: FontFamily.bold, color: '#FFFFFF' },
  // Today's-data error / dose-log error banner
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  noticeText: { flex: 1, fontSize: 14, fontFamily: FontFamily.medium },
  noticeAction: { fontSize: 14, fontFamily: FontFamily.bold },
  // Circle dropdown
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, minHeight: 48 },
  switchName: { fontSize: 15, fontFamily: FontFamily.medium, flexShrink: 1 },
  switchJoin: { fontSize: 14, fontFamily: FontFamily.medium },
  // Hero
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  eyebrow: { fontSize: 14, fontFamily: FontFamily.semibold, letterSpacing: 0.3 },
  link: { fontSize: 14, fontFamily: FontFamily.medium },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 12 },
  heroRight: { flex: 1, gap: 8 },
  heroMuted: { fontSize: 14 },
  allDone: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  allDoneText: { fontSize: 14, fontFamily: FontFamily.semibold },
  nextLabel: { fontSize: 14 },
  nextDose: { marginTop: 6, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  nextDoseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nextName: { fontSize: 14, fontFamily: FontFamily.semibold, flexShrink: 1 },
  nextTime: { fontSize: 14, fontFamily: FontFamily.medium },
  nextDosage: { fontSize: 14, marginTop: 2 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  stripPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  stripTime: { fontSize: 14, fontFamily: FontFamily.medium },
  // Summary
  summaryRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 2 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statTopLabel: { fontSize: 14 },
  statValue: { fontSize: 22, fontFamily: FontFamily.bold },
  statSub: { fontSize: 14 },
  // Next appointment
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptText: { flex: 1, gap: 2 },
  apptWhen: { fontSize: 14 },
  apptTitle: { fontSize: 15, fontFamily: FontFamily.semibold },
  apptLoc: { fontSize: 14 },
  // Quick actions
  sectionLabel: { fontSize: 14, fontFamily: FontFamily.semibold, marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 12 },
  quickTile: {
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  quickLabel: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  // Care Pulse (Home strip)
  pulseHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pulseList: { gap: 8 },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pulseInfo: { flex: 1, gap: 2 },
  pulseDesc: { fontSize: 14, fontFamily: FontFamily.medium, lineHeight: 19 },
  pulseTime: { fontSize: 14, fontFamily: FontFamily.regular },
  // Doses
  dosesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  doseList: { gap: 8 },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12 },
  doseStatusCircle: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  doseInfo: { flex: 1, gap: 2 },
  doseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseName: { fontSize: 14, fontFamily: FontFamily.semibold, flexShrink: 1 },
  doseDosage: { fontSize: 14, fontFamily: FontFamily.regular },
  doseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseTime: { fontSize: 14, fontFamily: FontFamily.regular },
  doseResponsibleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  doseResponsibleText: { fontSize: 14, fontFamily: FontFamily.regular, flexShrink: 1 },
  doseTag: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  doseTagText: { fontSize: 14, fontFamily: FontFamily.medium },
  logBtn: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  editBtn: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  logBtnText: { fontSize: 14, fontFamily: FontFamily.semibold },
  doseActions: { flexDirection: 'row', gap: 8, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginTop: 4 },
  doseAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.md, paddingVertical: 10, minHeight: 44 },
  doseActionText: { fontSize: 14, fontFamily: FontFamily.semibold },
  // Dose correction confirm (inside the tray)
  correctionRow: { flex: 1, gap: 10 },
  correctionText: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 20 },
  correctionActions: { flexDirection: 'row', gap: 8 },
  correctionConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    minHeight: 44,
  },
  correctionConfirmText: { fontSize: 14, fontFamily: FontFamily.semibold },
  correctionCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  correctionCancelText: { fontSize: 14, fontFamily: FontFamily.semibold },
  // Available to claim
  claimCard: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  claimChip: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  claimText: { flex: 1, gap: 2 },
  claimTitle: { fontSize: 15, fontFamily: FontFamily.bold },
  claimSub: { fontSize: 14 },
  // Emergency
  emergency: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  emergencyChip: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  emergencyText: { flex: 1, gap: 2 },
  emergencyTitle: { fontSize: 14, fontFamily: FontFamily.bold },
  emergencySub: { fontSize: 14 },
  emergencyBtn: { borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  emergencyBtnText: { fontSize: 14, color: '#FFFFFF', fontFamily: FontFamily.semibold },
});
