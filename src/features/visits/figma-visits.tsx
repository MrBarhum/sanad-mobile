import { useRouter } from 'expo-router';
import { Clock, Home, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonList } from '@/components/skeleton';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSegmentedTabs } from '@/components/figma/figma-segmented-tabs';
import { IconChip } from '@/components/figma/icon-chip';
import { isolateLtr } from '@/components/ltr-text';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { FontFamily, Radius } from '@/constants/theme';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { FamilyVisit, VisitStatus } from './api';
import { useVisits } from './hooks';

type VisitTab = 'upcoming' | 'recent';

/** Per-visit chip accent, cycled by index (the Figma varies card hues). */
const CHIP_COLORS = [
  'categoryBlue',
  'categoryPurple',
  'categoryGreen',
  'categoryGold',
] as const;

/**
 * Non-planned visit statuses → an icon + color for the status pill. Status is
 * never color-only: each carries its own shape icon + label. Mirrors the
 * `VisitsCenter` STATUS_TONE mapping (completed = success/green, cancelled =
 * error/red).
 */
const VISIT_STATUS: Record<Exclude<VisitStatus, 'planned'>, { tone: StatusTone }> = {
  completed: { tone: 'success' },
  cancelled: { tone: 'error' },
};

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
 * field access + locale keys (`visits.status.*`) verbatim. IBM Plex + theme tokens,
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
  const c = useTheme();
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
        <SkeletonList />
      ) : visitsQuery.isError ? (
        <FigmaCard tone="card" radius={Radius.lg}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>{t('visits.loadError')}</Text>
          <Pressable
            onPress={() => visitsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </FigmaCard>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Users size={40} color={c.textSecondary} strokeWidth={1} />
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
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
              chipColor={c[CHIP_COLORS[index % CHIP_COLORS.length]]}
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
  onOpen,
}: {
  visit: FamilyVisit;
  mine: boolean;
  linkedName: string | null;
  chipColor: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

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
      radius={Radius.xl}
      padding={16}
      onPress={onOpen}
      accessibilityLabel={visit.visitor_name}
      accessibilityHint={t('common.details')}>
      <View style={styles.cardTop}>
        <IconChip Icon={Users} color={chipColor} size={48} radius={Radius.lg} iconSize={22} />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {visit.visitor_name}
          </Text>
          <Text style={[styles.cardType, { color: c.textSecondary }]} numberOfLines={1}>
            {t('figma.visits.visitorLabel')}
          </Text>
        </View>
        {statusConfig ? (
          <StatusBadge tone={statusConfig.tone} label={t(`visits.status.${visit.status}`)} />
        ) : null}
      </View>

      <View style={styles.metaList}>
        <View style={styles.metaRow}>
          <Clock size={13} color={c.textSecondary} />
          <Text style={[styles.metaText, { color: c.textSecondary }]}>{whenText}</Text>
        </View>
        {mine ? (
          <View style={styles.metaRow}>
            <Home size={13} color={c.textSecondary} />
            <Text style={[styles.metaText, { color: c.textSecondary }]} numberOfLines={1}>
              {t('visits.mineLabel')}
            </Text>
          </View>
        ) : linkedName ? (
          <View style={styles.metaRow}>
            <Users size={13} color={c.textSecondary} />
            <Text style={[styles.metaText, { color: c.textSecondary }]} numberOfLines={1}>
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
  retryText: { fontSize: 14, fontFamily: FontFamily.semibold },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: FontFamily.medium, textAlign: 'center' },
  list: { gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontFamily: FontFamily.bold },
  cardType: { fontSize: 14, fontFamily: FontFamily.regular },
  metaList: { gap: 6, marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 14, fontFamily: FontFamily.regular },
});
