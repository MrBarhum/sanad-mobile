import { useRouter } from 'expo-router';
import { Check, Clock, Home, Users, X } from 'lucide-react-native';
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
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { FamilyVisit, VisitStatus } from './api';
import { useVisits } from './hooks';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type VisitTab = 'upcoming' | 'recent';

/** Per-visit chip accent, cycled by index (the Figma varies card hues). */
const CHIP_COLORS = [
  FigmaCategory.blue,
  FigmaCategory.purple,
  FigmaCategory.green,
  FigmaCategory.gold,
] as const;

/**
 * Non-planned visit statuses → an icon + color for the status pill. Status is
 * never color-only: each carries its own shape icon + label. Mirrors the
 * `VisitsCenter` STATUS_TONE mapping (completed = success/green, cancelled =
 * error/red).
 */
const VISIT_STATUS: Record<Exclude<VisitStatus, 'planned'>, { color: keyof FigmaPalette; Icon: IconCmp }> = {
  completed: { color: 'success', Icon: Check },
  cancelled: { color: 'error', Icon: X },
};

type FigmaPalette = (typeof FigmaColors)['dark'];

/** `${date} ${start}` sort key, matching the center's `startSortKey`. */
function startSortKey(visit: FamilyVisit): string {
  return `${visit.visit_date} ${visit.start_time ?? '99:99:99'}`;
}

/**
 * The Figma Make Appointments screen visual language, reused for Family Visits and
 * recreated as literally as possible in React Native on real Sanad data. Mirrors
 * `AppointmentsScreen.tsx`: a back/title/teal-"+" header, an upcoming/recent
 * segmented control, and a list of bordered cards — each a Users/Home icon chip,
 * the visitor name as the title, a planned/completed/cancelled status pill, and
 * Clock(date, time) + (optional Home) meta rows. Tapping a card opens the existing
 * detail route. Reuses the `VisitsCenter` hook (`useVisits`) and its date/status
 * field access + locale keys (`visits.status.*`) verbatim. Cairo + Figma tokens,
 * RTL. No old Sanad Screen/Surface/Section/Button/StatusBadge.
 */
export function FigmaVisits({
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
  const lookup = useMemberLookup(circleId);

  const visitsQuery = useVisits(circleId);
  const [tab, setTab] = useState<VisitTab>('upcoming');

  const canAdd = canManage || canCollaborate;

  // Family members (non-managers who can collaborate) see only visits linked to
  // them; managers see all; read-only members see all (no action affordances). UI
  // scoping only — RLS is unchanged. Then split today+future vs. past, matching the
  // center's buckets (the Figma has two tabs, so today + upcoming collapse).
  const scopeToMine = !canManage && canCollaborate;
  const { upcoming, recent } = useMemo(() => {
    const all = visitsQuery.data ?? [];
    const visits = scopeToMine ? all.filter((visit) => visit.visitor_user_id === userId) : all;
    const today = todayYmd();
    const upcomingList = visits
      .filter((visit) => visit.visit_date >= today)
      .sort((a, b) => startSortKey(a).localeCompare(startSortKey(b)));
    const recentList = visits
      .filter((visit) => visit.visit_date < today)
      .sort((a, b) => startSortKey(b).localeCompare(startSortKey(a)));
    return { upcoming: upcomingList, recent: recentList };
  }, [visitsQuery.data, scopeToMine, userId]);

  const filtered = tab === 'upcoming' ? upcoming : recent;

  const tabs: { key: VisitTab; label: string }[] = [
    { key: 'upcoming', label: t('figma.visits.tabs.upcoming') },
    { key: 'recent', label: t('figma.visits.tabs.recent') },
  ];

  return (
    <FigmaScreen>
      <FigmaHeader
        title={t('figma.visits.title')}
        onAdd={canAdd ? () => router.push('/visits/new') : undefined}
        addAccessibilityLabel={t('visits.add')}
      />

      <FigmaSegmentedTabs tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as VisitTab)} />

      {visitsQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : visitsQuery.isError ? (
        <FigmaCard tone="card" radius={FigmaRadius.r16}>
          <Text style={[styles.errorText, { color: c.error }]}>{t('visits.loadError')}</Text>
          <Pressable
            onPress={() => visitsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </FigmaCard>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Users size={40} color={c.muted} strokeWidth={1} />
          <Text style={[styles.emptyText, { color: c.muted }]}>
            {tab === 'upcoming'
              ? t('figma.visits.emptyUpcoming')
              : t('figma.visits.emptyRecent')}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((visit, index) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              mine={visit.visitor_user_id !== null && visit.visitor_user_id === userId}
              linkedName={
                visit.visitor_user_id && visit.visitor_user_id !== userId
                  ? (lookup(visit.visitor_user_id)?.label ?? null)
                  : null
              }
              chipColor={CHIP_COLORS[index % CHIP_COLORS.length]}
              scheme={scheme}
              onOpen={() => router.push(`/visits/${visit.id}`)}
            />
          ))}
        </View>
      )}
    </FigmaScreen>
  );
}

function VisitCard({
  visit,
  mine,
  linkedName,
  chipColor,
  scheme,
  onOpen,
}: {
  visit: FamilyVisit;
  mine: boolean;
  linkedName: string | null;
  chipColor: string;
  scheme: FigmaScheme;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];

  // Date + time meta, LTR-isolated (the visit date/time is the scannable anchor).
  const timeParts: string[] = [];
  if (visit.start_time) timeParts.push(isolateLtr(formatHm(visit.start_time)));
  if (visit.end_time) timeParts.push(isolateLtr(formatHm(visit.end_time)));
  const whenText =
    timeParts.length > 0
      ? `${isolateLtr(visit.visit_date)}، ${timeParts.join(' – ')}`
      : isolateLtr(visit.visit_date);

  const statusConfig = visit.status !== 'planned' ? VISIT_STATUS[visit.status] : null;

  return (
    <FigmaCard
      tone="card"
      radius={FigmaRadius.r24}
      padding={16}
      onPress={onOpen}
      accessibilityLabel={visit.visitor_name}
      accessibilityHint={t('common.details')}>
      <View style={styles.cardTop}>
        <IconChip Icon={Users} color={chipColor} size={48} radius={FigmaRadius.r16} iconSize={22} />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {visit.visitor_name}
          </Text>
          <Text style={[styles.cardType, { color: c.muted }]} numberOfLines={1}>
            {t('figma.visits.visitorLabel')}
          </Text>
        </View>
        {statusConfig ? (
          <FigmaStatusPill
            label={t(`visits.status.${visit.status}`)}
            color={c[statusConfig.color]}
            Icon={statusConfig.Icon}
          />
        ) : null}
      </View>

      <View style={styles.metaList}>
        <View style={styles.metaRow}>
          <Clock size={13} color={c.muted} />
          <Text style={[styles.metaText, { color: c.muted }]}>{whenText}</Text>
        </View>
        {mine ? (
          <View style={styles.metaRow}>
            <Home size={13} color={c.muted} />
            <Text style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
              {t('visits.mineLabel')}
            </Text>
          </View>
        ) : linkedName ? (
          <View style={styles.metaRow}>
            <Users size={13} color={c.muted} />
            <Text style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
              {linkedName}
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
  cardType: { fontSize: 12, fontFamily: FigmaFont.regular },
  metaList: { gap: 6, marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13, fontFamily: FigmaFont.regular },
});
