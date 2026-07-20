import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Clock,
  DoorOpen,
  HandHelping,
  Heart,
  Phone,
  Pill,
  Share2,
  SquareCheck,
  Stethoscope,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DoseBeadStrip, type DoseBead } from '@/components/dose-bead-strip';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { type IconName } from '@/constants/icons';
import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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

/** Dose-status → the icon + color-token pair used on the dose rows / status pills. */
const DOSE_STATUS: Record<MedicationLogStatus, { fg: ThemeColor; tint: ThemeColor; Icon: IconCmp }> = {
  given: { fg: 'successFg', tint: 'successBg', Icon: Check },
  postponed: { fg: 'warningFg', tint: 'warningBg', Icon: Clock },
  missed: { fg: 'errorFg', tint: 'errorBg', Icon: X },
};
const DOSE_ACTIONS: MedicationLogStatus[] = ['given', 'postponed', 'missed'];

/** Pulse event icon → lucide glyph + Dar tint pair (dose/task done = green success,
 *  cancelled = amber, the rest = accent). Feature identity is the glyph, not hue.
 *  Keyed only by the icons `pulseEventVisual` emits; the fallback covers any other. */
type PulseVisual = { Icon: IconCmp; fg: ThemeColor; tint: ThemeColor };
const PULSE_FALLBACK: PulseVisual = { Icon: Clock, fg: 'primaryText', tint: 'primaryBg' };
const PULSE_VISUAL: Partial<Record<IconName, PulseVisual>> = {
  medication: { Icon: Pill, fg: 'successFg', tint: 'successBg' },
  success: { Icon: Check, fg: 'successFg', tint: 'successBg' },
  close: { Icon: X, fg: 'warningFg', tint: 'warningBg' },
  appointment: { Icon: Calendar, fg: 'primaryText', tint: 'primaryBg' },
  visit: { Icon: DoorOpen, fg: 'primaryText', tint: 'primaryBg' },
  vital: { Icon: Heart, fg: 'primaryText', tint: 'primaryBg' },
  dailyLog: { Icon: ClipboardList, fg: 'primaryText', tint: 'primaryBg' },
  member: { Icon: Users, fg: 'primaryText', tint: 'primaryBg' },
};

/** Home Care-Pulse strip: fetch a small buffer, then filter-to-today and cap at 5. */
const HOME_PULSE_FETCH = 20;
const HOME_PULSE_MAX = 5;
/** Content gutter of the Dar home (matches FigmaScreen's contentGutter below). */
const CONTENT_PAD = 16;
const GRID_GAP = 8;

/**
 * The Dar home (frame 5a): a deep-green header band (date + circle switcher +
 * recipient + bell + emergency), the medication-loop section (dose-count tile +
 * next-dose tile + the 5-cell dose bead strip that replaced the SVG ring), two
 * stat tiles, the next-appointment card, a 4×2 quick-action grid, the gold
 * available-to-claim banner, today's doses with inline status logging, the pulse
 * strip, and the emergency banner. Cairo + Dar tokens, both themes, RTL. All
 * behaviour, data, scoping and routing are unchanged from the prior home.
 */
export function FigmaHome({ circle }: { circle: ActiveCircle }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const date = todayYmd();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Family members (non-managers who can log) see only doses/appointments they are
  // responsible for; managers see all; read-only members see all (no actions). The
  // dose loop, next-dose, dose list, next-appointment and today's-appointment count
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

  // Quick access to every important reachable area (2 rows of 4). Canonical Sanad
  // ordering (meds → tasks → appointments → vitals → visits → daily logs → doctors
  // → members). The RTL wrap grid places the first item top-right, so medications —
  // the highest-stakes surface — leads (A7). Feature identity is the glyph (all one
  // green accent — the Dar monochrome-icon rule).
  const quickActions: { id: string; route: string; label: string; Icon: IconCmp }[] = [
    { id: 'medications', route: '/medications', label: t('careCircle.dashboard.sections.medications.title'), Icon: Pill },
    { id: 'tasks', route: '/tasks', label: t('careCircle.dashboard.sections.tasks.title'), Icon: SquareCheck },
    { id: 'appointments', route: '/appointments', label: t('careCircle.dashboard.sections.appointments.title'), Icon: Calendar },
    { id: 'vitals', route: '/vitals', label: t('careCircle.dashboard.sections.vitals.title'), Icon: Heart },
    { id: 'visits', route: '/visits', label: t('careCircle.dashboard.sections.visits.title'), Icon: DoorOpen },
    { id: 'logs', route: '/daily-logs', label: t('careCircle.dashboard.sections.dailyLogs.title'), Icon: ClipboardList },
    { id: 'doctors', route: '/doctors', label: t('careCircle.dashboard.sections.doctors.title'), Icon: Stethoscope },
    { id: 'members', route: '/circle-members', label: t('circleMembers.title'), Icon: Users },
  ];
  // Exact 4-up tile width (content width minus the 16px gutters minus 3 column gaps).
  const quickTileWidth = (width - CONTENT_PAD * 2 - GRID_GAP * 3) / 4;

  // Dose bead strip: up to 5 cells + one spoken summary (the retired ring's a11y).
  const beads: DoseBead[] = visibleDoses.slice(0, 5).map((d) => ({
    key: d.key,
    status: d.status,
    time: formatHm(d.scheduledTime),
  }));
  const beadsA11y =
    total > 0
      ? t('careCircle.dashboard.today.loopA11y', { given, total })
      : t('careCircle.dashboard.today.loopA11yNone');

  const band = (
    <View style={[styles.band, { backgroundColor: c.band, paddingTop: insets.top + 22 }]}>
      <View style={styles.bandRow}>
        <View style={styles.bandText}>
          <Text style={[styles.bandDate, { color: c.bandInk }]}>{formatLongDate(i18n.language)}</Text>
          <Pressable
            style={styles.nameRow}
            accessibilityRole="button"
            accessibilityHint={t('circleSwitcher.switch')}
            onPress={() => setSwitcherOpen((o) => !o)}>
            <Text style={[styles.bandName, { color: c.bandInk }]} numberOfLines={1}>
              {circle.circleName}
            </Text>
            <ChevronDown size={17} color={c.bandInk} strokeWidth={2.4} style={styles.bandChevron} />
          </Pressable>
          {headerSubtitle ? (
            <Text style={[styles.bandSubtitle, { color: c.bandInk }]} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.bandActions}>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? t('notifications.openCenterWithCount', { count: unreadCount })
                : t('notifications.title')
            }
            style={[styles.bandActionBordered, { borderColor: c.bandInk }]}>
            <Bell size={20} color={c.bandInk} strokeWidth={2} />
            {unreadCount > 0 ? (
              <View style={[styles.bandBadge, { backgroundColor: c.goldFill }]}>
                <Text style={[styles.bandBadgeText, { color: c.goldInk }]} numberOfLines={1}>
                  {isolateLtr(unreadCount > 9 ? '9+' : String(unreadCount))}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => router.push('/emergency-card')}
            accessibilityRole="button"
            accessibilityLabel={t('careCircle.dashboard.sections.emergency.title')}
            style={[styles.bandActionFilled, { backgroundColor: c.bandInk }]}>
            <Phone size={19} color={c.band} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <FigmaScreen band={band} contentGutter={CONTENT_PAD}>
      <View>
        {/* Today's-data load failure — a retryable banner so a failed fetch never
            masquerades as an empty day. */}
        {todayLoadError ? (
          <Pressable
            onPress={retryToday}
            accessibilityRole="button"
            accessibilityLabel={t('retry')}
            style={[styles.notice, { backgroundColor: c.errorBg, borderColor: c.errorFg }]}>
            <AlertCircle size={18} color={c.errorFg} strokeWidth={2.2} />
            <Text style={[styles.noticeText, { color: c.errorFg }]}>
              {t('careCircle.dashboard.today.loadError')}
            </Text>
            <Text style={[styles.noticeAction, { color: c.errorFg }]}>{t('retry')}</Text>
          </Pressable>
        ) : logError ? (
          <View
            style={[styles.notice, { backgroundColor: c.errorBg, borderColor: c.errorFg }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            <AlertCircle size={18} color={c.errorFg} strokeWidth={2.2} />
            <Text style={[styles.noticeText, { color: c.errorFg }]}>{logError}</Text>
          </View>
        ) : null}

        {/* Compact circle dropdown (real circles + join) */}
        {switcherOpen ? (
          <Surface tone="card" padded={0} style={styles.switcher}>
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
                  style={[styles.switchRow, i > 0 && { borderTopColor: c.border, borderTopWidth: BorderWidth.standard }]}>
                  <Text style={[styles.switchName, { color: c.text }]} numberOfLines={1}>
                    {item.circleName}
                  </Text>
                  {isActive ? <Check size={18} color={c.primaryText} strokeWidth={2.6} /> : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setSwitcherOpen(false);
                router.push('/join-circle');
              }}
              accessibilityRole="button"
              style={[styles.switchRow, { borderTopColor: c.border, borderTopWidth: BorderWidth.standard }]}>
              <Text style={[styles.switchJoin, { color: c.primaryText }]}>
                {t('careCircle.dashboard.today.joinAnotherCircle')}
              </Text>
            </Pressable>
          </Surface>
        ) : null}

        {/* Medication-loop section: count tile + next-dose tile + bead strip */}
        <SectionHeader
          title={t('careCircle.dashboard.today.medLoopEyebrow')}
          linkLabel={t('careCircle.dashboard.today.viewAll')}
          onLinkPress={() => router.push('/medications')}
          style={styles.sectionHeadGap}
        />
        {total === 0 ? (
          <Text style={[styles.loopNone, { color: c.textSecondary }]}>
            {t('careCircle.dashboard.today.loopNone')}
          </Text>
        ) : (
          <>
            <View style={styles.tileRow}>
              <View
                style={[styles.countTile, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden>
                <Text style={[styles.tileLabel, { color: c.textSecondary }]}>{t('medications.todayTitle')}</Text>
                <Text style={[styles.countBig, { color: c.text }]}>
                  {`${given}`}<Text style={[styles.countTotal, { color: c.textSecondary }]}>{`/${total}`}</Text>
                </Text>
                <Text style={[styles.tileSub, { color: c.textSecondary }]}>
                  {t('careCircle.dashboard.today.dosesGivenSoFar')}
                </Text>
              </View>
              <View style={[styles.nextTile, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
                <Text style={[styles.tileLabel, { color: c.textSecondary }]}>
                  {t('careCircle.dashboard.today.nextDoseLabel')}
                </Text>
                {nextDose ? (
                  <>
                    <Text style={[styles.nextName, { color: c.text }]}>
                      {nextDose.medicationName}
                    </Text>
                    <Text style={[styles.nextMeta, { color: c.primaryText }]} numberOfLines={1}>
                      {isolateLtr(formatHm(nextDose.scheduledTime))}
                      {nextDose.dosage ? ` · ${nextDose.dosage}` : ''}
                    </Text>
                  </>
                ) : (
                  <View style={styles.nextDone}>
                    <Check size={16} color={c.successFg} strokeWidth={2.6} />
                    <Text style={[styles.nextDoneText, { color: c.successFg }]} numberOfLines={2}>
                      {t('careCircle.dashboard.today.allDosesGiven')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <DoseBeadStrip beads={beads} accessibilityLabel={beadsA11y} style={styles.beadStripGap} />
          </>
        )}

        {/* Today summary — two stat tiles */}
        <View style={[styles.tileRow, styles.statsGap]}>
          <StatTile
            Icon={Check}
            iconColor={c.successFg}
            tint={c.successBg}
            topLabel={t('careCircle.dashboard.sections.tasks.title')}
            value={String(taskSummary.dueToday)}
            subLabel={t('careCircle.dashboard.today.dueTodayShort')}
            onPress={() => router.push('/tasks')}
          />
          <StatTile
            Icon={Calendar}
            iconColor={c.primaryText}
            tint={c.primaryBg}
            topLabel={t('careCircle.dashboard.sections.appointments.title')}
            value={String(apptCount)}
            subLabel={t('careCircle.dashboard.today.appointmentLabel')}
            onPress={() => router.push('/appointments')}
          />
        </View>

        {/* Next appointment (only when real data exists) */}
        {nextAppt ? (
          <Pressable
            onPress={() => router.push('/appointments')}
            accessibilityRole="button"
            style={[styles.apptCard, styles.nextApptGap, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
            <View style={[styles.apptIcon, { backgroundColor: c.primaryBg, borderColor: c.border }]}>
              <Calendar size={20} color={c.primaryText} strokeWidth={2.2} />
            </View>
            <View style={styles.apptText}>
              <Text style={[styles.apptWhen, { color: c.textSecondary }]}>{apptWhen}</Text>
              <Text style={[styles.apptTitle, { color: c.text }]} numberOfLines={1}>
                {nextAppt.title}
              </Text>
              {nextAppt.location ? (
                <Text style={[styles.apptLoc, { color: c.textSecondary }]} numberOfLines={1}>
                  {nextAppt.location}
                </Text>
              ) : null}
            </View>
            <ChevronLeft size={18} color={c.text} strokeWidth={2.4} />
          </Pressable>
        ) : null}

        {/* Quick actions — 4-up grid, wraps to a second row */}
        <SectionHeader title={t('careCircle.dashboard.today.quickActions')} style={styles.quickHeadGap} />
        <View style={styles.quickGrid}>
          {quickActions.map((qa) => {
            const Icon = qa.Icon;
            return (
              <Pressable
                key={qa.id}
                onPress={() => router.push(qa.route as never)}
                accessibilityRole="button"
                accessibilityLabel={qa.label}
                style={[styles.quickTile, { width: quickTileWidth, backgroundColor: c.backgroundElement, borderColor: c.border }]}>
                <Icon size={20} color={c.primaryText} strokeWidth={2} />
                <Text style={[styles.quickLabel, { color: c.text }]} numberOfLines={2}>
                  {qa.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Available to claim — claim-capable members only (never remote/elder) */}
        {circle.canManage || circle.canLogDoses ? (
          <Pressable
            onPress={() => router.push('/available-to-claim')}
            accessibilityRole="button"
            accessibilityLabel={t('claiming.entryTitle')}
            style={[styles.claimCard, styles.claimGap, { backgroundColor: c.goldFill, borderColor: c.border }]}>
            <HandHelping size={24} color={c.goldInk} strokeWidth={2} />
            <View style={styles.claimText}>
              <Text style={[styles.claimTitle, { color: c.goldInk }]}>{t('claiming.entryTitle')}</Text>
              <Text style={[styles.claimSub, { color: c.goldInk }]} numberOfLines={1}>
                {t('claiming.entrySubtitle')}
              </Text>
            </View>
            <ChevronLeft size={17} color={c.goldInk} strokeWidth={2.4} />
          </Pressable>
        ) : null}

        {/* Today's doses */}
        {total > 0 ? (
          <>
            <SectionHeader
              title={t('medications.todayTitle')}
              linkLabel={t('careCircle.dashboard.today.allMedications')}
              onLinkPress={() => router.push('/medications')}
              style={styles.doseHeadGap}
            />
            <View style={[styles.groupCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
              {orderedDoses.map((dose, i) => (
                <DoseRow
                  key={dose.key}
                  dose={dose}
                  first={i === 0}
                  responsibleText={circle.canManage ? responsibleLabel(dose.responsibleUserId) : null}
                  canLog={circle.canLogDoses && (circle.canManage || dose.responsibleUserId === userId)}
                  open={openDoseKey === dose.key}
                  pending={pendingKey === dose.key}
                  onToggle={() => setOpenDoseKey((k) => (k === dose.key ? null : dose.key))}
                  onSetStatus={(status) => setStatus(dose, status)}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Care Pulse — today's most-recent circle events, tap through to the log */}
        <PulseSection circleId={circle.circleId} timezone={circle.timezone} />

        {/* Emergency banner */}
        <Pressable
          onPress={() => router.push('/emergency-card')}
          accessibilityRole="button"
          accessibilityLabel={t('careCircle.dashboard.today.emergencyTitle')}
          style={[styles.emergency, { backgroundColor: c.errorBg, borderColor: c.errorFg }]}>
          <AlertCircle size={24} color={c.errorFg} strokeWidth={2.2} />
          <View style={styles.emergencyText}>
            <Text style={[styles.emergencyTitle, { color: c.errorFg }]}>
              {t('careCircle.dashboard.today.emergencyTitle')}
            </Text>
            <Text style={[styles.emergencySub, { color: c.text }]} numberOfLines={1}>
              {emergencySubtitle}
            </Text>
          </View>
          <View style={[styles.emergencyBtn, { backgroundColor: c.errorFg }]}>
            <Text style={[styles.emergencyBtnText, { color: c.onError }]}>
              {t('careCircle.dashboard.today.emergencyView')}
            </Text>
          </View>
        </Pressable>
      </View>
    </FigmaScreen>
  );
}

function StatTile({
  Icon,
  iconColor,
  tint,
  topLabel,
  value,
  subLabel,
  onPress,
}: {
  Icon: IconCmp;
  iconColor: string;
  tint: string;
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
      style={[styles.statTile, { backgroundColor: tint, borderColor: c.border }]}>
      <View style={styles.statTop}>
        <Icon size={16} color={iconColor} strokeWidth={2.4} />
        <Text style={[styles.statTopLabel, { color: c.text }]}>{topLabel}</Text>
      </View>
      <Text style={[styles.statValue, { color: c.text }]}>{isolateLtr(value)}</Text>
      <Text style={[styles.statSub, { color: c.textSecondary }]}>{subLabel}</Text>
    </Pressable>
  );
}

function DoseRow({
  dose,
  first,
  responsibleText,
  canLog,
  open,
  pending,
  onToggle,
  onSetStatus,
}: {
  dose: DoseItem;
  first: boolean;
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
  const statusColor = cfg ? c[cfg.fg] : c.textSecondary;
  // Logged = the status tint fill; unlogged/due = a solid sunken well.
  const statusBg = cfg ? c[cfg.tint] : c.backgroundSunken;
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
    <View style={!first && { borderTopWidth: BorderWidth.standard, borderTopColor: c.border }}>
      <View style={styles.doseRow}>
        <View style={[styles.doseSquare, { backgroundColor: statusBg, borderColor: c.border }]}>
          <StatusIcon size={17} color={statusColor} strokeWidth={cfg?.Icon === Check ? 2.8 : 2.4} />
        </View>
        <View style={styles.doseInfo}>
          {/* Name wraps to two lines (never truncated); dosage on its own line. */}
          <Text style={[styles.doseName, { color: c.text }]} numberOfLines={2}>
            {dose.medicationName}
          </Text>
          {dose.dosage ? <Text style={[styles.doseDosage, { color: c.textSecondary }]}>{dose.dosage}</Text> : null}
          <View style={styles.doseMetaRow}>
            <Text style={[styles.doseTime, { color: c.text }]}>{isolateLtr(formatHm(dose.scheduledTime))}</Text>
            <View style={[styles.doseTag, { borderColor: statusColor }]}>
              <StatusIcon size={12} color={statusColor} strokeWidth={cfg?.Icon === Check ? 2.8 : 2.4} />
              <Text style={[styles.doseTagText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            {responsibleText ? (
              <View style={styles.doseResponsible}>
                <Users size={12} color={c.textSecondary} strokeWidth={2} />
                <Text style={[styles.doseResponsibleText, { color: c.textSecondary }]} numberOfLines={1}>
                  {responsibleText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {canLog ? (
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={`${isLogged ? t('medications.editStatus') : t('careCircle.dashboard.today.logAction')} ${dose.medicationName}`}
            style={
              isLogged
                ? [styles.editBtn, { borderColor: c.border }]
                : [styles.logBtn, { backgroundColor: c.primary }]
            }>
            <Text style={[styles.logBtnText, { color: isLogged ? c.text : c.onPrimary }]}>
              {isLogged ? t('medications.editStatus') : t('careCircle.dashboard.today.logAction')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {open && canLog ? (
        <View style={[styles.doseActions, { backgroundColor: c.backgroundSunken, borderTopColor: c.border }]}>
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
                  <Text style={[styles.correctionCancelText, { color: c.text }]}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            DOSE_ACTIONS.map((s) => {
              const a = DOSE_STATUS[s];
              const ActionIcon = a.Icon;
              const color = c[a.fg];
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
                    { backgroundColor: c[a.tint], borderColor: selected ? color : c.border, opacity: pending ? 0.5 : 1 },
                  ]}>
                  <ActionIcon size={14} color={color} strokeWidth={a.Icon === Check ? 2.8 : 2.4} />
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
function PulseSection({ circleId, timezone }: { circleId: string; timezone: string }) {
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
    <>
      <SectionHeader
        title={t('pulse.sectionTitle')}
        style={styles.pulseHeadGap}
        trailing={
          <View style={styles.pulseHeaderActions}>
            <Pressable
              onPress={() => sharePulseSummary(composePulseShareText(events, t, actorLabel, timezone))}
              accessibilityRole="button"
              accessibilityLabel={t('pulse.share')}
              hitSlop={8}>
              <Share2 size={17} color={c.text} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={() => router.push('/pulse')} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.pulseLink, { color: c.primaryText }]}>{t('pulse.viewAll')}</Text>
            </Pressable>
          </View>
        }
      />
      <View style={[styles.groupCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        {events.map((event, i) => {
          const { iconName } = pulseEventVisual(event);
          const visual = PULSE_VISUAL[iconName] ?? PULSE_FALLBACK;
          const PulseIcon = visual.Icon;
          return (
            <Pressable
              key={`${event.event_type}:${event.event_id}`}
              onPress={() => router.push(pulseRouteFor(event.item_type, event.item_id))}
              accessibilityRole="button"
              accessibilityHint={t('common.details')}
              style={({ pressed }) => [
                styles.pulseRow,
                i > 0 && { borderTopWidth: BorderWidth.standard, borderTopColor: c.border },
                pressed && { opacity: 0.7 },
              ]}>
              <View style={[styles.pulseIcon, { backgroundColor: c[visual.tint], borderColor: c.border }]}>
                <PulseIcon size={14} color={c[visual.fg]} strokeWidth={2.2} />
              </View>
              <Text style={[styles.pulseDesc, { color: c.text }]} numberOfLines={2}>
                {pulseDescription(event, t, actorLabel)}
              </Text>
              <Text style={[styles.pulseTime, { color: c.textSecondary }]}>
                {isolateLtr(hmInTimeZone(event.occurred_at, timezone))}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Header band
  band: { paddingHorizontal: 18, paddingBottom: 18 },
  bandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  bandText: { flexShrink: 1, gap: 1 },
  bandDate: { fontSize: 14, fontFamily: FontFamily.medium, opacity: 0.8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bandName: { fontSize: 24, fontFamily: FontFamily.bold, lineHeight: 34, flexShrink: 1 },
  bandChevron: { opacity: 0.8 },
  bandSubtitle: { fontSize: 16, opacity: 0.85 },
  bandActions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  bandActionBordered: {
    width: 44,
    height: 44,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandActionFilled: {
    width: 44,
    height: 44,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandBadge: {
    position: 'absolute',
    top: -8,
    insetInlineStart: -8,
    minWidth: 21,
    height: 21,
    borderRadius: Radius.control,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandBadgeText: { fontSize: 13, fontFamily: FontFamily.bold },
  // Notice banner
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    marginBottom: 12,
  },
  noticeText: { flex: 1, fontSize: 14, fontFamily: FontFamily.medium },
  noticeAction: { fontSize: 14, fontFamily: FontFamily.bold },
  // Circle switcher dropdown
  switcher: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  switchName: { fontSize: 16, fontFamily: FontFamily.medium, flexShrink: 1 },
  switchJoin: { fontSize: 15, fontFamily: FontFamily.semibold },
  // Section header spacing
  sectionHeadGap: { marginBottom: 8 },
  quickHeadGap: { marginTop: 16, marginBottom: 8 },
  doseHeadGap: { marginTop: 16, marginBottom: 8 },
  pulseHeadGap: { marginTop: 16, marginBottom: 8 },
  // Med-loop tiles
  tileRow: { flexDirection: 'row', gap: 8 },
  // Detach the bead strip from the tiles above it (they read as glued otherwise).
  beadStripGap: { marginTop: 12 },
  loopNone: { fontSize: 16, fontFamily: FontFamily.medium, paddingVertical: 4 },
  countTile: { flex: 1.05, borderWidth: BorderWidth.standard, borderRadius: Radius.card, paddingVertical: 12, paddingHorizontal: 14 },
  tileLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  countBig: { fontSize: 46, fontFamily: FontFamily.black, lineHeight: 53, textAlign: 'right', writingDirection: 'ltr' },
  countTotal: { fontSize: 22, fontFamily: FontFamily.semibold },
  tileSub: { fontSize: 15, fontFamily: FontFamily.medium },
  nextTile: { flex: 1, borderWidth: BorderWidth.standard, borderRadius: Radius.card, paddingVertical: 12, paddingHorizontal: 14 },
  nextName: { fontSize: 17, fontFamily: FontFamily.bold, lineHeight: 26, marginTop: 2 },
  nextMeta: { fontSize: 16, fontFamily: FontFamily.bold },
  nextDone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  nextDoneText: { fontSize: 15, fontFamily: FontFamily.semibold, flexShrink: 1 },
  // Stat tiles
  statsGap: { marginTop: 14 },
  statTile: { flex: 1, borderWidth: BorderWidth.standard, borderRadius: Radius.card, paddingVertical: 12, paddingHorizontal: 14 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statTopLabel: { fontSize: 15, fontFamily: FontFamily.bold },
  statValue: { fontSize: 38, fontFamily: FontFamily.black, lineHeight: 46 },
  statSub: { fontSize: 15, fontFamily: FontFamily.medium },
  // Next appointment
  nextApptGap: { marginTop: 8 },
  apptCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: BorderWidth.standard, borderRadius: Radius.card, paddingVertical: 12, paddingHorizontal: 14 },
  apptIcon: { width: 44, height: 44, borderWidth: BorderWidth.standard, borderRadius: Radius.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  apptText: { flex: 1, minWidth: 0 },
  apptWhen: { fontSize: 14, fontFamily: FontFamily.semibold },
  apptTitle: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  apptLoc: { fontSize: 14, fontFamily: FontFamily.medium },
  // Quick actions
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, rowGap: GRID_GAP },
  quickTile: { alignItems: 'center', gap: 5, borderWidth: BorderWidth.standard, borderRadius: Radius.card, paddingVertical: 10, paddingHorizontal: 4 },
  quickLabel: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 19, textAlign: 'center' },
  // Claim banner
  claimGap: { marginTop: 14 },
  claimCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: BorderWidth.standard, borderRadius: Radius.card, paddingVertical: 12, paddingHorizontal: 14 },
  claimText: { flex: 1, minWidth: 0 },
  claimTitle: { fontSize: 16, fontFamily: FontFamily.bold },
  claimSub: { fontSize: 14, fontFamily: FontFamily.medium },
  // Grouped list card (doses + pulse)
  groupCard: { borderWidth: BorderWidth.standard, borderRadius: Radius.card, overflow: 'hidden' },
  // Dose rows
  doseRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14 },
  doseSquare: { width: 40, height: 40, borderWidth: BorderWidth.standard, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  doseInfo: { flex: 1, minWidth: 0 },
  doseName: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  doseDosage: { fontSize: 14, fontFamily: FontFamily.medium, marginTop: 1 },
  doseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  doseTime: { fontSize: 14, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  doseTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: BorderWidth.thin, borderRadius: Radius.tiny, paddingHorizontal: 9, paddingVertical: 2 },
  doseTagText: { fontSize: 14, fontFamily: FontFamily.semibold },
  doseResponsible: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  doseResponsibleText: { fontSize: 14, fontFamily: FontFamily.medium, flexShrink: 1 },
  logBtn: { borderRadius: Radius.control, paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', flexShrink: 0 },
  editBtn: { borderWidth: BorderWidth.standard, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center', flexShrink: 0 },
  logBtnText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Dose action tray
  doseActions: { flexDirection: 'row', gap: 8, borderTopWidth: BorderWidth.standard, padding: 12 },
  doseAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: BorderWidth.thin, borderRadius: Radius.control, paddingVertical: 10, minHeight: 44 },
  doseActionText: { fontSize: 14, fontFamily: FontFamily.semibold },
  correctionRow: { flex: 1, gap: 10 },
  correctionText: { fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 22 },
  correctionActions: { flexDirection: 'row', gap: 8 },
  correctionConfirm: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, minHeight: 44 },
  correctionConfirmText: { fontSize: 15, fontFamily: FontFamily.bold },
  correctionCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: BorderWidth.standard, borderRadius: Radius.control, minHeight: 44 },
  correctionCancelText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Pulse
  pulseHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pulseLink: { fontSize: 15, fontFamily: FontFamily.semibold, textDecorationLine: 'underline' },
  pulseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  pulseIcon: { width: 34, height: 34, borderWidth: BorderWidth.standard, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pulseDesc: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium, lineHeight: 23 },
  pulseTime: { fontSize: 14, fontFamily: FontFamily.medium, writingDirection: 'ltr', marginTop: 6 },
  // Emergency banner
  emergency: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: BorderWidth.standard, borderRadius: Radius.card, paddingVertical: 12, paddingHorizontal: 14, marginTop: 14, marginBottom: 18 },
  emergencyText: { flex: 1, minWidth: 0 },
  emergencyTitle: { fontSize: 16, fontFamily: FontFamily.bold },
  emergencySub: { fontSize: 14, fontFamily: FontFamily.medium },
  emergencyBtn: { borderRadius: Radius.control, paddingHorizontal: 18, paddingVertical: 7, justifyContent: 'center', flexShrink: 0 },
  emergencyBtnText: { fontSize: 16, fontFamily: FontFamily.bold },
});
