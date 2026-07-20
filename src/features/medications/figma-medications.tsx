import { useRouter } from 'expo-router';
import { AlertCircle, Check, ChevronRight, Clock, Pill, Plus, Users, X } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { SkeletonList } from '@/components/skeleton';
import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { useResponsibleLabel } from '@/features/circle-members/member-assignment';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { Medication, MedicationLogStatus, MedicationSchedule } from './api';
import { useActiveMedications, useActiveSchedules, useLogDose, useTodayDoses } from './hooks';
import { WEEKDAY_KEYS } from './schedule-fields';
import { summarizeDoses, type DoseItem } from './today';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Dose-status → status-square + pill treatment (fill · stroke/text · icon · stroke). */
const DOSE_STATUS: Record<MedicationLogStatus, { fg: ThemeColor; tint: ThemeColor; Icon: IconCmp }> = {
  given: { fg: 'successFg', tint: 'successBg', Icon: Check },
  postponed: { fg: 'warningFg', tint: 'warningBg', Icon: Clock },
  missed: { fg: 'errorFg', tint: 'errorBg', Icon: X },
};
const DOSE_ACTIONS: MedicationLogStatus[] = ['given', 'postponed', 'missed'];

type TabKey = 'today' | 'all';

/**
 * The Dar medications list (frames 6a): a deep-green sub-screen band (back + title
 * + add), a summary pill (doses given today · active count), a today/all segmented
 * control, the today doses as a grouped card of status-square rows with inline
 * given/postponed/missed logging (real `useLogDose`), the all-medications cards
 * (Pill chip + dosage + schedule chips + active badge → detail), and the quiet
 * empty state. Cairo + Dar tokens, both themes, RTL. Behaviour/data/routing unchanged.
 */
export function FigmaMedications({
  circleId,
  canManage,
  canLog,
}: {
  circleId: string;
  canManage: boolean;
  canLog: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const date = todayYmd();

  const { user } = useAuth();
  const userId = user?.id ?? null;

  const today = useTodayDoses(circleId, date);
  const medications = useActiveMedications(circleId);
  const schedules = useActiveSchedules(circleId);
  const logDose = useLogDose(circleId);
  const responsibleLabel = useResponsibleLabel(circleId);

  const [tab, setTab] = useState<TabKey>('today');
  const [openDoseKey, setOpenDoseKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const meds = useMemo(() => medications.data ?? [], [medications.data]);

  // Family members (non-managers who can log) only see/register doses for meds
  // they are responsible for; managers see all; read-only members see all (and
  // never get a register button). UI scoping only — RLS is unchanged.
  const scopeToMine = !canManage && canLog;
  const visibleDoses = useMemo(
    () => (scopeToMine ? today.doses.filter((d) => d.responsibleUserId === userId) : today.doses),
    [scopeToMine, today.doses, userId],
  );
  const { total, given } = summarizeDoses(visibleDoses);
  // Display order (A7): unlogged doses first so what still needs action leads;
  // chronological order is preserved within each group (stable sort). Summaries
  // and counts keep using the time-ordered list above.
  const orderedDoses = useMemo(
    () => [...visibleDoses].sort((a, b) => (a.status === null ? 0 : 1) - (b.status === null ? 0 : 1)),
    [visibleDoses],
  );

  // Active schedules grouped by medication, for the "all" tab's time chips.
  const schedulesByMedId = useMemo(() => {
    const map = new Map<string, MedicationSchedule[]>();
    for (const s of schedules.data ?? []) {
      const list = map.get(s.medication_id) ?? [];
      list.push(s);
      map.set(s.medication_id, list);
    }
    return map;
  }, [schedules.data]);

  async function setStatus(dose: DoseItem, status: MedicationLogStatus) {
    setPendingKey(dose.key);
    setLogError(null);
    try {
      await logDose.mutateAsync({ dose, status, date });
      setOpenDoseKey(null);
    } catch {
      // Surface a failed dose log instead of silently reverting the row.
      setLogError(t('careCircle.dashboard.today.logFailed'));
    } finally {
      setPendingKey(null);
    }
  }

  const band = (
    <View style={[styles.band, { backgroundColor: c.band, paddingTop: insets.top + 18 }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={[styles.bandBack, { borderColor: c.bandInk }]}>
        <ChevronRight size={20} color={c.bandInk} strokeWidth={2.4} />
      </Pressable>
      <Text style={[styles.bandTitle, { color: c.bandInk }]} numberOfLines={1}>
        {t('medications.title')}
      </Text>
      {canManage ? (
        <Pressable
          onPress={() => router.push('/medications/new')}
          accessibilityRole="button"
          accessibilityLabel={t('medications.add')}
          style={[styles.bandAdd, { backgroundColor: c.bandInk }]}>
          <Plus size={20} color={c.band} strokeWidth={2.6} />
        </Pressable>
      ) : (
        <View style={styles.bandSpacer} />
      )}
    </View>
  );

  return (
    <FigmaScreen band={band} contentGutter={16} gap={12}>
      {/* Summary pill — doses given today + active medication count */}
      <View style={[styles.summary, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.summaryIcon, { backgroundColor: c.successBg, borderColor: c.border }]}>
          <Pill size={20} color={c.successFg} strokeWidth={2} />
        </View>
        <View style={styles.summaryText}>
          <Text style={[styles.summaryTitle, { color: c.text }]} numberOfLines={1}>
            {total > 0
              ? t('figma.medications.summary', { given: String(given), total: String(total) })
              : t('figma.medications.summaryEmpty')}
          </Text>
          <Text style={[styles.summarySub, { color: c.textSecondary }]} numberOfLines={1}>
            {t('figma.medications.activeCount', { count: meds.length })}
          </Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabs, { borderColor: c.border }]}>
        {(['today', 'all'] as TabKey[]).map((key, i) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.tab,
                { backgroundColor: active ? c.primary : c.backgroundElement },
                i > 0 && { borderStartWidth: BorderWidth.standard, borderStartColor: c.border },
              ]}>
              <Text
                style={[
                  active ? styles.tabActiveLabel : styles.tabLabel,
                  { color: active ? c.onPrimary : c.textSecondary },
                ]}>
                {t(key === 'today' ? 'figma.medications.tabToday' : 'figma.medications.tabAll')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {logError ? (
        <View
          style={[styles.logErrorBanner, { backgroundColor: c.errorBg, borderColor: c.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          <AlertCircle size={18} color={c.errorFg} strokeWidth={2.2} />
          <Text style={[styles.logErrorText, { color: c.errorFg }]}>{logError}</Text>
        </View>
      ) : null}

      {/* Content */}
      {today.isError ? (
        <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
          <Text style={[styles.errorTitle, { color: c.text }]}>{t('medications.loadError')}</Text>
          <Pressable
            onPress={() => today.refetch()}
            accessibilityRole="button"
            style={[styles.retryBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : today.isLoading ? (
        <SkeletonList />
      ) : tab === 'today' ? (
        visibleDoses.length === 0 ? (
          <MedEmpty
            title={t('medications.noDosesTitle')}
            subtitle={t('medications.noDosesSubtitle')}
            actionLabel={t('figma.medications.browseAll')}
            onAction={() => setTab('all')}
          />
        ) : (
          <View style={[styles.groupCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
            {orderedDoses.map((dose, i) => (
              <DoseCard
                key={dose.key}
                dose={dose}
                first={i === 0}
                responsibleText={canManage ? responsibleLabel(dose.responsibleUserId) : null}
                canLog={canLog && (canManage || dose.responsibleUserId === userId)}
                open={openDoseKey === dose.key}
                pending={pendingKey === dose.key}
                onToggle={() => setOpenDoseKey((k) => (k === dose.key ? null : dose.key))}
                onSetStatus={(status) => setStatus(dose, status)}
              />
            ))}
          </View>
        )
      ) : meds.length === 0 ? (
        <MedEmpty title={t('medications.noMedsTitle')} subtitle={canManage ? t('medications.noMedsSubtitle') : undefined} />
      ) : (
        <View style={styles.list}>
          {meds.map((medication) => (
            <MedicationRow
              key={medication.id}
              medication={medication}
              schedules={schedulesByMedId.get(medication.id) ?? []}
              responsibleText={canManage ? responsibleLabel(medication.responsible_user_id) : null}
              onPress={() => router.push(`/medications/${medication.id}`)}
            />
          ))}
        </View>
      )}
    </FigmaScreen>
  );
}

/** A dose-status square + pill pair, shared by the row and its status tag. */
function statusVisual(status: MedicationLogStatus | null) {
  return status ? DOSE_STATUS[status] : null;
}

function DoseCard({
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
  const cfg = statusVisual(status);
  const StatusIcon = cfg ? cfg.Icon : Clock;
  const statusColor = cfg ? c[cfg.fg] : c.textSecondary;
  const statusBg = cfg ? c[cfg.tint] : c.backgroundSunken;
  const statusLabel = status ? t(`medications.status.${status}`) : t('figma.medications.doseUnlogged');
  const isLogged = status !== null;
  const strokeFor = (Icon: IconCmp) => (Icon === Check ? 2.8 : 2.4);

  // Correcting an already-logged dose asks for a confirm before overwriting the
  // record; the first log of an unlogged dose still applies on a single tap.
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
          <StatusIcon size={17} color={statusColor} strokeWidth={strokeFor(StatusIcon)} />
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
              <StatusIcon size={12} color={statusColor} strokeWidth={strokeFor(StatusIcon)} />
              <Text style={[styles.doseTagText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            {responsibleText ? (
              <View style={styles.responsibleRow}>
                <Users size={12} color={c.textSecondary} strokeWidth={2} />
                <Text style={[styles.responsibleText, { color: c.textSecondary }]} numberOfLines={1}>
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
            accessibilityLabel={`${isLogged ? t('medications.editStatus') : t('figma.medications.logAction')} ${dose.medicationName}`}
            style={isLogged ? [styles.editBtn, { borderColor: c.border }] : [styles.logBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.logBtnText, { color: isLogged ? c.text : c.onPrimary }]}>
              {isLogged ? t('medications.editStatus') : t('figma.medications.logAction')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {open && canLog ? (
        <View style={[styles.doseActions, { backgroundColor: c.backgroundSunken, borderTopColor: c.border }]}>
          {confirmStatus ? (
            <DoseCorrectionConfirm
              nextStatus={confirmStatus}
              pending={pending}
              onConfirm={() => onSetStatus(confirmStatus)}
              onCancel={() => setConfirmStatus(null)}
            />
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
                  <ActionIcon size={14} color={color} strokeWidth={strokeFor(ActionIcon)} />
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
 * Inline confirm shown inside the dose tray when a logged dose's status is being
 * changed — a correction overwrites a real record, so it never applies on a lone
 * tap. Reused visual language: green confirm + quiet cancel, announced politely.
 */
function DoseCorrectionConfirm({
  nextStatus,
  pending,
  onConfirm,
  onCancel,
}: {
  nextStatus: MedicationLogStatus;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <View style={styles.correctionRow}>
      <Text
        style={[styles.correctionText, { color: c.text }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite">
        {t('medications.confirmChangeStatus', { status: t(`medications.status.${nextStatus}`) })}
      </Text>
      <View style={styles.correctionActions}>
        <Pressable
          onPress={onConfirm}
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
          onPress={onCancel}
          disabled={pending}
          accessibilityRole="button"
          style={[styles.correctionCancel, { borderColor: c.border }]}>
          <Text style={[styles.correctionCancelText, { color: c.text }]}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MedicationRow({
  medication,
  schedules,
  responsibleText,
  onPress,
}: {
  medication: Medication;
  schedules: MedicationSchedule[];
  responsibleText: string | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  // One chip per distinct (time, day-set) across the medication's active
  // schedules: shows the time + a short days label (everyDay or short weekdays).
  const chips = useMemo(() => {
    const seen = new Set<string>();
    const result: { time: string; days: string }[] = [];
    for (const s of schedules) {
      if (!s.is_active) continue;
      const daysSorted = [...s.days_of_week].sort((a, b) => a - b);
      const daysLabel =
        daysSorted.length >= 7
          ? t('medications.everyDay')
          : daysSorted.map((d) => t(`medications.weekdaysShort.${WEEKDAY_KEYS[d]}`)).join('، ');
      const times = [...new Set(s.times.map(formatHm))].sort();
      for (const time of times) {
        const key = `${time}|${daysLabel}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ time, days: daysLabel });
      }
    }
    return result.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }, [schedules, t]);

  const active = medication.is_active;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={medication.name}
      accessibilityHint={t('medications.tapToEdit')}
      style={[styles.medCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <View style={styles.medTop}>
        <View style={[styles.medIcon, { backgroundColor: c.primaryBg, borderColor: c.border }]}>
          <Pill size={20} color={c.primaryText} strokeWidth={2} />
        </View>
        <View style={styles.medText}>
          {/* Name wraps to two lines (never truncated); dosage on its own line. */}
          <Text style={[styles.medName, { color: c.text }]} numberOfLines={2}>
            {medication.name}
          </Text>
          {medication.dosage ? (
            <Text style={[styles.medDosage, { color: c.textSecondary }]} numberOfLines={1}>
              {medication.dosage}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.activeBadge,
            active
              ? { backgroundColor: c.successBg, borderColor: c.successFg }
              : { backgroundColor: c.backgroundSunken, borderColor: c.border },
          ]}>
          <Text style={[styles.activeBadgeText, { color: active ? c.successFg : c.textSecondary }]}>
            {active ? t('figma.medications.active') : t('figma.medications.inactive')}
          </Text>
        </View>
      </View>

      {chips.length > 0 ? (
        <View style={styles.chipRow}>
          {chips.map((chip, i) => (
            <View
              key={`${chip.time}-${i}`}
              style={[styles.scheduleChip, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
              <Clock size={12} color={c.primaryText} strokeWidth={2.2} />
              <Text style={[styles.chipTime, { color: c.text }]}>{isolateLtr(formatHm(chip.time))}</Text>
              <Text style={[styles.chipDays, { color: c.textSecondary }]} numberOfLines={1}>
                {chip.days}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {responsibleText ? (
        <View style={styles.responsibleRow}>
          <Users size={12} color={c.textSecondary} strokeWidth={2} />
          <Text style={[styles.responsibleText, { color: c.textSecondary }]} numberOfLines={1}>
            {responsibleText}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The Dar quiet empty: a tinted 68px circle + ok check, title, reassuring line,
 *  an optional gold-diamond divider + a bordered browse action. */
function MedEmpty({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}): ReactNode {
  const c = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <View style={[styles.emptyCircle, { backgroundColor: c.successBg, borderColor: c.border }]}>
        <Check size={28} color={c.successFg} strokeWidth={2} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptySub, { color: c.textSecondary }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <>
          <View style={styles.emptyDivider}>
            <View style={[styles.emptyRule, { backgroundColor: c.backgroundSunken }]} />
            <View style={[styles.emptyDiamond, { backgroundColor: c.goldFill }]} />
            <View style={[styles.emptyRule, { backgroundColor: c.backgroundSunken }]} />
          </View>
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            style={[styles.emptyAction, { borderColor: c.border }]}>
            <Text style={[styles.emptyActionText, { color: c.text }]}>{actionLabel}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const R8 = Radius.card; // 8
const R6 = Radius.control; // 6

const styles = StyleSheet.create({
  // Header band
  band: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 18 },
  bandBack: {
    width: 44,
    height: 44,
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bandTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: FontFamily.bold },
  bandAdd: { width: 44, height: 44, borderRadius: R8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bandSpacer: { width: 44, flexShrink: 0 },
  // Summary pill
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryText: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  summarySub: { fontSize: 14, fontFamily: FontFamily.medium },
  // Segmented tabs
  tabs: { flexDirection: 'row', borderWidth: BorderWidth.standard, borderRadius: R8, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  tabActiveLabel: { fontSize: 16, fontFamily: FontFamily.bold },
  tabLabel: { fontSize: 16, fontFamily: FontFamily.semibold },
  // Log-error banner
  logErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: R8,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  logErrorText: { flex: 1, fontSize: 14, fontFamily: FontFamily.medium },
  // Error card
  errorCard: { borderWidth: BorderWidth.standard, borderRadius: R8, padding: 20 },
  errorTitle: { fontSize: 16, fontFamily: FontFamily.bold, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: R6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Lists
  list: { gap: 12 },
  groupCard: { borderWidth: BorderWidth.standard, borderRadius: R8, overflow: 'hidden' },
  // Dose rows
  doseRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14 },
  doseSquare: {
    width: 40,
    height: 40,
    borderWidth: BorderWidth.standard,
    borderRadius: R6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doseInfo: { flex: 1, minWidth: 0 },
  doseName: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  doseDosage: { fontSize: 14, fontFamily: FontFamily.medium, marginTop: 1 },
  doseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  doseTime: { fontSize: 14, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  doseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: BorderWidth.thin,
    borderRadius: Radius.tiny,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  doseTagText: { fontSize: 14, fontFamily: FontFamily.semibold },
  logBtn: { borderRadius: R6, paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', flexShrink: 0 },
  editBtn: {
    borderWidth: BorderWidth.standard,
    borderRadius: R6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    flexShrink: 0,
  },
  logBtnText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Dose action tray
  doseActions: { flexDirection: 'row', gap: 8, borderTopWidth: BorderWidth.standard, padding: 12 },
  doseAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: BorderWidth.thin,
    borderRadius: R6,
    paddingVertical: 10,
    minHeight: 44,
  },
  doseActionText: { fontSize: 14, fontFamily: FontFamily.semibold },
  correctionRow: { flex: 1, gap: 10 },
  correctionText: { fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 22 },
  correctionActions: { flexDirection: 'row', gap: 8 },
  correctionConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R6,
    minHeight: 44,
  },
  correctionConfirmText: { fontSize: 15, fontFamily: FontFamily.bold },
  correctionCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BorderWidth.standard,
    borderRadius: R6,
    minHeight: 44,
  },
  correctionCancelText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Medication row (all)
  medCard: { borderWidth: BorderWidth.standard, borderRadius: R8, padding: 14, gap: 12 },
  medTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medIcon: {
    width: 40,
    height: 40,
    borderWidth: BorderWidth.standard,
    borderRadius: R6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  medText: { flex: 1, minWidth: 0 },
  medName: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  medDosage: { fontSize: 14, fontFamily: FontFamily.medium },
  activeBadge: { borderWidth: BorderWidth.thin, borderRadius: Radius.tiny, paddingHorizontal: 9, paddingVertical: 2, flexShrink: 0 },
  activeBadgeText: { fontSize: 14, fontFamily: FontFamily.semibold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: BorderWidth.standard,
    borderRadius: R6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipTime: { fontSize: 14, fontFamily: FontFamily.medium, writingDirection: 'ltr' },
  chipDays: { fontSize: 14, fontFamily: FontFamily.medium },
  responsibleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  responsibleText: { fontSize: 14, fontFamily: FontFamily.medium, flexShrink: 1 },
  // Empty state
  empty: { borderWidth: BorderWidth.standard, borderRadius: R8, paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center' },
  emptyCircle: {
    width: 68,
    height: 68,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontFamily: FontFamily.bold, marginTop: 16, textAlign: 'center' },
  emptySub: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 28, marginTop: 4, textAlign: 'center' },
  emptyDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginVertical: 18, marginHorizontal: 8 },
  emptyRule: { flex: 1, height: 1.5 },
  emptyDiamond: { width: 7, height: 7, transform: [{ rotate: '45deg' }] },
  emptyAction: { borderWidth: BorderWidth.standard, borderRadius: R6, paddingHorizontal: 24, paddingVertical: 9 },
  emptyActionText: { fontSize: 16, fontFamily: FontFamily.bold },
});
