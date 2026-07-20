import { useRouter } from 'expo-router';
import { AlertCircle, Check, Clock, Users, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonList } from '@/components/skeleton';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSegmentedTabs } from '@/components/figma/figma-segmented-tabs';
import { GlyphChip } from '@/components/glyph-chip';
import { EmptyState } from '@/components/states';
import { isolateLtr } from '@/components/ltr-text';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { type IconName } from '@/constants/icons';
import { FontFamily, Radius, withAlpha, type ThemeColor } from '@/constants/theme';
import { useResponsibleLabel } from '@/features/circle-members/member-assignment';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { Medication, MedicationLogStatus, MedicationSchedule } from './api';
import { useActiveMedications, useActiveSchedules, useLogDose, useTodayDoses } from './hooks';
import { WEEKDAY_KEYS } from './schedule-fields';
import { summarizeDoses, type DoseItem } from './today';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Dose-status colors as theme tokens (AA-safe + mode-adaptive), resolved at render. */
const DOSE_STATUS: Record<MedicationLogStatus, { colorKey: ThemeColor; Icon: IconCmp }> = {
  given: { colorKey: 'successFg', Icon: Check },
  postponed: { colorKey: 'warningFg', Icon: Clock },
  missed: { colorKey: 'errorFg', Icon: X },
};
const DOSE_ACTIONS: MedicationLogStatus[] = ['given', 'postponed', 'missed'];

/** Dose status → StatusBadge tone (+ icon override where the tone icon isn't apt). */
const DOSE_TONE: Record<MedicationLogStatus, { tone: StatusTone; iconName?: IconName }> = {
  given: { tone: 'success' },
  postponed: { tone: 'warning', iconName: 'clock' },
  missed: { tone: 'error' },
};

/** Per-medication category tint, cycled by index (mirrors the Figma color field). */
const MED_COLORS = [
  'categoryBlue',
  'categoryGreen',
  'categoryGold',
  'categoryPurple',
  'categoryTeal',
] as const;

type TabKey = 'today' | 'all';

/**
 * The Figma Make MedicationsScreen, recreated as literally as possible in React
 * Native and wired to real Sanad data. Mirrors `MedicationsScreen.tsx`: header
 * (back + title + teal add), a summary pill (doses given today + active meds), a
 * today/all segmented control, today = dose cards with inline given/postponed/
 * missed logging (via the real `useLogDose`), and all = medication rows with Pill
 * chip + dosage + schedule chips + active badge tapping through to the detail
 * screen. Cairo + theme tokens, RTL. No old Sanad Screen/Surface/Section/Button.
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

  // Stable per-medication accent color (by index in the alphabetical list).
  const colorByMedId = useMemo(() => {
    const map = new Map<string, ThemeColor>();
    meds.forEach((m, i) => map.set(m.id, MED_COLORS[i % MED_COLORS.length]));
    return map;
  }, [meds]);

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

  const muted = { color: c.textSecondary, fontFamily: FontFamily.regular };

  return (
    <FigmaScreen gap={16}>
      <FigmaHeader
        title={t('medications.title')}
        onAdd={canManage ? () => router.push('/medications/new') : undefined}
        addAccessibilityLabel={t('medications.add')}
      />

      {/* Summary pill — doses given today + active medication count */}
      <Surface tone="card" radius={Radius.card} padded={14}>
        <View style={styles.summaryRow}>
          <GlyphChip iconName="medication" color="primary" size="md" />
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: c.text }]} numberOfLines={1}>
              {t('figma.medications.summary', { given: String(given), total: String(total) })}
            </Text>
            <Text style={[styles.summarySub, muted]} numberOfLines={1}>
              {t('figma.medications.activeCount', { count: meds.length })}
            </Text>
          </View>
        </View>
      </Surface>

      {/* Tab switcher */}
      <FigmaSegmentedTabs
        tabs={[
          { key: 'today', label: t('figma.medications.tabToday') },
          { key: 'all', label: t('figma.medications.tabAll') },
        ]}
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
      />

      {logError ? (
        <View
          style={[
            styles.logErrorBanner,
            { backgroundColor: withAlpha(c.dangerSolid, 0.1), borderColor: withAlpha(c.dangerSolid, 0.25) },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          <AlertCircle size={16} color={c.errorFg} />
          <Text style={[styles.logErrorText, { color: c.errorFg }]}>{logError}</Text>
        </View>
      ) : null}

      {/* Content */}
      {today.isError ? (
        <Surface tone="card" radius={Radius.card} padded={20}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('medications.loadError')}</Text>
          <Pressable
            onPress={() => today.refetch()}
            accessibilityRole="button"
            style={[styles.retryBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </Surface>
      ) : today.isLoading ? (
        <SkeletonList />
      ) : tab === 'today' ? (
        visibleDoses.length === 0 ? (
          <EmptyCard
            title={t('medications.noDosesTitle')}
            subtitle={t('medications.noDosesSubtitle')}
          />
        ) : (
          <View style={styles.list}>
            {orderedDoses.map((dose) => (
              <DoseCard
                key={dose.key}
                dose={dose}
                color={colorByMedId.get(dose.medicationId) ?? 'categoryBlue'}
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
        <EmptyCard
          title={t('medications.noMedsTitle')}
          subtitle={canManage ? t('medications.noMedsSubtitle') : undefined}
        />
      ) : (
        <View style={styles.list}>
          {meds.map((medication) => (
            <MedicationRow
              key={medication.id}
              medication={medication}
              color={colorByMedId.get(medication.id) ?? 'categoryBlue'}
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

function EmptyCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return <EmptyState iconName="medication" title={title} subtitle={subtitle} />;
}

function DoseCard({
  dose,
  color,
  responsibleText,
  canLog,
  open,
  pending,
  onToggle,
  onSetStatus,
}: {
  dose: DoseItem;
  color: ThemeColor;
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
  // Logged doses use their status tone; an unlogged dose is a calm neutral pill
  // with a clock (still icon + text, never color-only).
  const pill = status ? DOSE_TONE[status] : { tone: 'neutral' as const, iconName: 'clock' as const };
  const statusLabel = status
    ? t(`medications.status.${status}`)
    : t('figma.medications.doseUnlogged');
  const isLogged = status !== null;

  // Correcting an already-logged dose asks for a confirm before overwriting the
  // record; the first log of an unlogged dose still applies on a single tap.
  const [confirmStatus, setConfirmStatus] = useState<MedicationLogStatus | null>(null);
  useEffect(() => {
    if (!open) setConfirmStatus(null);
  }, [open]);

  function pick(s: MedicationLogStatus) {
    if (!isLogged) {
      onSetStatus(s);
    } else if (s === status) {
      onToggle(); // same status chosen → nothing to change, just close the tray
    } else {
      setConfirmStatus(s);
    }
  }

  return (
    <View>
      <View style={[styles.doseCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <GlyphChip iconName="medication" color={color} size="md" />
        <View style={styles.doseInfo}>
          {/* Name wraps to two lines (never truncated); dosage on its own line. */}
          <Text style={[styles.doseName, { color: c.text }]} numberOfLines={2}>
            {dose.medicationName}
          </Text>
          {dose.dosage ? (
            <Text style={[styles.doseDosage, { color: c.textSecondary, fontFamily: FontFamily.regular }]} numberOfLines={1}>
              {dose.dosage}
            </Text>
          ) : null}
          <View style={styles.doseMetaRow}>
            <Clock size={12} color={c.textSecondary} />
            <Text style={[styles.doseTime, { color: c.textSecondary, fontFamily: FontFamily.regular }]}>
              {isolateLtr(formatHm(dose.scheduledTime))}
            </Text>
            <StatusBadge tone={pill.tone} iconName={pill.iconName} label={statusLabel} />
          </View>
          {responsibleText ? (
            <View style={styles.responsibleRow}>
              <Users size={12} color={c.textSecondary} />
              <Text
                style={[styles.responsibleText, { color: c.textSecondary, fontFamily: FontFamily.regular }]}
                numberOfLines={1}>
                {responsibleText}
              </Text>
            </View>
          ) : null}
        </View>
        {canLog ? (
          // Unlogged → filled "تسجيل"; already logged → quiet "تعديل الحالة" so a
          // mis-tapped or corrected dose can be fixed (P2-4).
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={`${isLogged ? t('medications.editStatus') : t('figma.medications.logAction')} ${dose.medicationName}`}
            style={
              isLogged
                ? [styles.editBtn, { borderColor: withAlpha(c.primary, 0.4) }]
                : [styles.logBtn, { backgroundColor: c.primary }]
            }>
            <Text
              style={[
                styles.logBtnText,
                { color: isLogged ? c.primary : c.onPrimary },
              ]}>
              {isLogged ? t('medications.editStatus') : t('figma.medications.logAction')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {open && canLog ? (
        <View style={[styles.doseActions, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
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
                      backgroundColor: withAlpha(color, selected ? 0.22 : 0.12),
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
 * Inline confirm shown inside the dose tray when a logged dose's status is being
 * changed — a correction overwrites a real record, so it never applies on a lone
 * tap. Reused visual language: teal confirm + quiet cancel, announced politely.
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
          <Text style={[styles.correctionCancelText, { color: c.textSecondary }]}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MedicationRow({
  medication,
  color,
  schedules,
  responsibleText,
  onPress,
}: {
  medication: Medication;
  color: ThemeColor;
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
        <GlyphChip iconName="medication" color={color} size="md" />
        <View style={styles.medText}>
          {/* Name wraps to two lines (never truncated); dosage already on its own line. */}
          <Text style={[styles.medName, { color: c.text }]} numberOfLines={2}>
            {medication.name}
          </Text>
          {medication.dosage ? (
            <Text style={[styles.medDosage, { color: c.textSecondary, fontFamily: FontFamily.regular }]} numberOfLines={1}>
              {medication.dosage}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.activeBadge,
            {
              backgroundColor: active ? withAlpha(c.successFg, 0.12) : c.backgroundSunken,
            },
          ]}>
          <Text
            style={[
              styles.activeBadgeText,
              { color: active ? c.successFg : c.textSecondary },
            ]}>
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
              <Clock size={12} color={c.primary} />
              <Text style={[styles.chipTime, { color: c.text }]}>{isolateLtr(formatHm(chip.time))}</Text>
              <Text style={[styles.chipDays, { color: c.textSecondary, fontFamily: FontFamily.regular }]} numberOfLines={1}>
                {chip.days}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {responsibleText ? (
        <View style={styles.responsibleRow}>
          <Users size={12} color={c.textSecondary} />
          <Text
            style={[styles.responsibleText, { color: c.textSecondary, fontFamily: FontFamily.regular }]}
            numberOfLines={1}>
            {responsibleText}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  logErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  logErrorText: { flex: 1, fontSize: 14, fontFamily: FontFamily.medium },
  // Summary pill
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { fontSize: 14, fontFamily: FontFamily.semibold },
  summarySub: { fontSize: 14 },
  // Empty / error
  emptyTitle: { fontSize: 15, fontFamily: FontFamily.semibold, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontFamily: FontFamily.semibold },
  // Dose card (today)
  doseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  doseInfo: { flex: 1, gap: 4 },
  doseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseName: { fontSize: 15, fontFamily: FontFamily.semibold, flexShrink: 1 },
  doseDosage: { fontSize: 14, flexShrink: 1 },
  doseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseTime: { fontSize: 14 },
  logBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  editBtn: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  logBtnText: { fontSize: 14, fontFamily: FontFamily.semibold },
  doseActions: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginTop: 6,
  },
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
  doseAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    paddingVertical: 12,
    minHeight: 44,
  },
  doseActionText: { fontSize: 14, fontFamily: FontFamily.semibold },
  // Medication row (all)
  medCard: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  medTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medText: { flex: 1, gap: 2 },
  medName: { fontSize: 16, fontFamily: FontFamily.bold },
  medDosage: { fontSize: 14 },
  activeBadge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { fontSize: 14, fontFamily: FontFamily.semibold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipTime: { fontSize: 14, fontFamily: FontFamily.medium },
  chipDays: { fontSize: 14 },
  responsibleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  responsibleText: { fontSize: 14 },
});
