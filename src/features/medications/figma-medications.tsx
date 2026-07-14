import { useRouter } from 'expo-router';
import { AlertCircle, Check, Clock, Pill, Users, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
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
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { useResponsibleLabel } from '@/features/circle-members/member-assignment';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { Medication, MedicationLogStatus, MedicationSchedule } from './api';
import { useActiveMedications, useActiveSchedules, useLogDose, useTodayDoses } from './hooks';
import { WEEKDAY_KEYS } from './schedule-fields';
import { summarizeDoses, type DoseItem } from './today';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Fixed Figma dose-status colors (constant across modes, as in the export). */
const DOSE_STATUS: Record<MedicationLogStatus, { color: string; Icon: IconCmp }> = {
  given: { color: '#5AAE85', Icon: Check },
  postponed: { color: '#C8904A', Icon: Clock },
  missed: { color: '#C45050', Icon: X },
};
const DOSE_ACTIONS: MedicationLogStatus[] = ['given', 'postponed', 'missed'];

/** Per-medication category tint, cycled by index (mirrors the Figma color field). */
const MED_COLORS = [
  FigmaCategory.blue,
  FigmaCategory.green,
  FigmaCategory.gold,
  FigmaCategory.purple,
  FigmaCategory.teal,
];

type TabKey = 'today' | 'all';

/**
 * The Figma Make MedicationsScreen, recreated as literally as possible in React
 * Native and wired to real Sanad data. Mirrors `MedicationsScreen.tsx`: header
 * (back + title + teal add), a summary pill (doses given today + active meds), a
 * today/all segmented control, today = dose cards with inline given/postponed/
 * missed logging (via the real `useLogDose`), and all = medication rows with Pill
 * chip + dosage + schedule chips + active badge tapping through to the detail
 * screen. Cairo + Figma tokens, RTL. No old Sanad Screen/Surface/Section/Button.
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
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
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

  // Stable per-medication accent color (by index in the alphabetical list).
  const colorByMedId = useMemo(() => {
    const map = new Map<string, string>();
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

  const muted = { color: c.muted, fontFamily: FigmaFont.regular };

  return (
    <FigmaScreen gap={16}>
      <FigmaHeader
        title={t('medications.title')}
        onAdd={canManage ? () => router.push('/medications/new') : undefined}
        addAccessibilityLabel={t('medications.add')}
      />

      {/* Summary pill — doses given today + active medication count */}
      <FigmaCard tone="card" radius={FigmaRadius.r20} padding={14}>
        <View style={styles.summaryRow}>
          <IconChip Icon={Pill} color={c.primary} size={40} radius={FigmaRadius.pill} iconSize={18} />
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: c.text }]} numberOfLines={1}>
              {t('figma.medications.summary', { given: String(given), total: String(total) })}
            </Text>
            <Text style={[styles.summarySub, muted]} numberOfLines={1}>
              {t('figma.medications.activeCount', { count: meds.length })}
            </Text>
          </View>
        </View>
      </FigmaCard>

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
            { backgroundColor: withAlpha(c.error, 0.1), borderColor: withAlpha(c.error, 0.25) },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          <AlertCircle size={16} color={c.error} />
          <Text style={[styles.logErrorText, { color: c.error }]}>{logError}</Text>
        </View>
      ) : null}

      {/* Content */}
      {today.isError ? (
        <FigmaCard tone="card" radius={FigmaRadius.r20} padding={20}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('medications.loadError')}</Text>
          <Pressable
            onPress={() => today.refetch()}
            accessibilityRole="button"
            style={[styles.retryBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </FigmaCard>
      ) : today.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : tab === 'today' ? (
        visibleDoses.length === 0 ? (
          <EmptyCard
            scheme={scheme}
            title={t('medications.noDosesTitle')}
            subtitle={t('medications.noDosesSubtitle')}
          />
        ) : (
          <View style={styles.list}>
            {visibleDoses.map((dose) => (
              <DoseCard
                key={dose.key}
                dose={dose}
                scheme={scheme}
                color={colorByMedId.get(dose.medicationId) ?? FigmaCategory.blue}
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
          scheme={scheme}
          title={t('medications.noMedsTitle')}
          subtitle={canManage ? t('medications.noMedsSubtitle') : undefined}
        />
      ) : (
        <View style={styles.list}>
          {meds.map((medication) => (
            <MedicationRow
              key={medication.id}
              medication={medication}
              scheme={scheme}
              color={colorByMedId.get(medication.id) ?? FigmaCategory.blue}
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

function EmptyCard({ scheme, title, subtitle }: { scheme: FigmaScheme; title: string; subtitle?: string }) {
  const c = FigmaColors[scheme];
  return (
    <FigmaCard tone="card" radius={FigmaRadius.r20} padding={24}>
      <View style={styles.empty}>
        <IconChip Icon={Pill} color={c.muted} size={48} radius={FigmaRadius.pill} iconSize={22} />
        <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.emptySub, { color: c.muted, fontFamily: FigmaFont.regular }]}>{subtitle}</Text>
        ) : null}
      </View>
    </FigmaCard>
  );
}

function DoseCard({
  dose,
  scheme,
  color,
  responsibleText,
  canLog,
  open,
  pending,
  onToggle,
  onSetStatus,
}: {
  dose: DoseItem;
  scheme: FigmaScheme;
  color: string;
  responsibleText: string | null;
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
  // Pending/unlogged = solid cream/elevated (mutedSurface); logged = a 12% tint.
  const statusBg = cfg ? withAlpha(statusColor, 0.12) : c.mutedSurface;
  const statusLabel = status
    ? t(`medications.status.${status}`)
    : t('figma.medications.doseUnlogged');
  const isPending = !status;

  return (
    <View>
      <View style={[styles.doseCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <IconChip Icon={Pill} color={color} size={44} radius={FigmaRadius.pill} iconSize={20} tintOpacity={0.12} />
        <View style={styles.doseInfo}>
          <View style={styles.doseNameRow}>
            <Text style={[styles.doseName, { color: c.text }]} numberOfLines={1}>
              {dose.medicationName}
            </Text>
            {dose.dosage ? (
              <Text style={[styles.doseDosage, { color: c.muted, fontFamily: FigmaFont.regular }]} numberOfLines={1}>
                {dose.dosage}
              </Text>
            ) : null}
          </View>
          <View style={styles.doseMetaRow}>
            <Clock size={12} color={c.muted} />
            <Text style={[styles.doseTime, { color: c.muted, fontFamily: FigmaFont.regular }]}>
              {isolateLtr(formatHm(dose.scheduledTime))}
            </Text>
            <FigmaStatusPill
              label={statusLabel}
              color={statusColor}
              Icon={StatusIcon}
              background={statusBg}
            />
          </View>
          {responsibleText ? (
            <View style={styles.responsibleRow}>
              <Users size={12} color={c.muted} />
              <Text
                style={[styles.responsibleText, { color: c.muted, fontFamily: FigmaFont.regular }]}
                numberOfLines={1}>
                {responsibleText}
              </Text>
            </View>
          ) : null}
        </View>
        {isPending && canLog ? (
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={`${t('figma.medications.logAction')} ${dose.medicationName}`}
            style={[styles.logBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.logBtnText, { color: c.onPrimary }]}>{t('figma.medications.logAction')}</Text>
          </Pressable>
        ) : null}
      </View>
      {open && isPending && canLog ? (
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
                style={[
                  styles.doseAction,
                  { backgroundColor: withAlpha(a.color, 0.12), opacity: pending ? 0.5 : 1 },
                ]}>
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

function MedicationRow({
  medication,
  scheme,
  color,
  schedules,
  responsibleText,
  onPress,
}: {
  medication: Medication;
  scheme: FigmaScheme;
  color: string;
  schedules: MedicationSchedule[];
  responsibleText: string | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];

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
      style={[styles.medCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.medTop}>
        <IconChip Icon={Pill} color={color} size={48} radius={FigmaRadius.r16} iconSize={22} tintOpacity={0.12} />
        <View style={styles.medText}>
          <Text style={[styles.medName, { color: c.text }]} numberOfLines={1}>
            {medication.name}
          </Text>
          {medication.dosage ? (
            <Text style={[styles.medDosage, { color: c.muted, fontFamily: FigmaFont.regular }]} numberOfLines={1}>
              {medication.dosage}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.activeBadge,
            {
              backgroundColor: active ? withAlpha('#5AAE85', 0.12) : c.mutedSurface,
            },
          ]}>
          <Text
            style={[
              styles.activeBadgeText,
              { color: active ? '#5AAE85' : c.muted },
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
              style={[styles.scheduleChip, { backgroundColor: c.elevated, borderColor: c.border }]}>
              <Clock size={12} color={c.primary} />
              <Text style={[styles.chipTime, { color: c.text }]}>{isolateLtr(formatHm(chip.time))}</Text>
              <Text style={[styles.chipDays, { color: c.muted, fontFamily: FigmaFont.regular }]} numberOfLines={1}>
                {chip.days}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {responsibleText ? (
        <View style={styles.responsibleRow}>
          <Users size={12} color={c.muted} />
          <Text
            style={[styles.responsibleText, { color: c.muted, fontFamily: FigmaFont.regular }]}
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
    borderRadius: FigmaRadius.r12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  logErrorText: { flex: 1, fontSize: 14, fontFamily: FigmaFont.medium },
  // Summary pill
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { fontSize: 14, fontFamily: FigmaFont.semibold },
  summarySub: { fontSize: 12 },
  // Empty / error
  empty: { alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 15, fontFamily: FigmaFont.semibold, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: FigmaRadius.r12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontFamily: FigmaFont.semibold },
  // Dose card (today)
  doseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: FigmaRadius.r20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  doseInfo: { flex: 1, gap: 4 },
  doseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseName: { fontSize: 15, fontFamily: FigmaFont.semibold, flexShrink: 1 },
  doseDosage: { fontSize: 12, flexShrink: 1 },
  doseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseTime: { fontSize: 12 },
  logBtn: {
    borderRadius: FigmaRadius.r12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  logBtnText: { fontSize: 13, fontFamily: FigmaFont.semibold },
  doseActions: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: FigmaRadius.r20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginTop: 6,
  },
  doseAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: FigmaRadius.r12,
    paddingVertical: 12,
    minHeight: 44,
  },
  doseActionText: { fontSize: 12, fontFamily: FigmaFont.semibold },
  // Medication row (all)
  medCard: {
    borderRadius: FigmaRadius.r20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  medTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medText: { flex: 1, gap: 2 },
  medName: { fontSize: 16, fontFamily: FigmaFont.bold },
  medDosage: { fontSize: 14 },
  activeBadge: { borderRadius: FigmaRadius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { fontSize: 11, fontFamily: FigmaFont.semibold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: FigmaRadius.r12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipTime: { fontSize: 12, fontFamily: FigmaFont.medium },
  chipDays: { fontSize: 11 },
  responsibleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  responsibleText: { fontSize: 12 },
});
