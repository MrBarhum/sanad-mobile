import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { FamilyVisit, VisitStatus } from './api';
import { useSetVisitStatus, useVisits } from './hooks';

const RECENT_LIMIT = 10;

const DONE_COLORS: Record<Exclude<VisitStatus, 'planned'>, string> = {
  completed: '#16a34a',
  cancelled: '#dc2626',
};

function startSortKey(visit: FamilyVisit): string {
  return `${visit.visit_date} ${visit.start_time ?? '99:99:99'}`;
}

/** Family visits center: today's, upcoming, and recent visits. */
export function VisitsCenter({
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

  const visitsQuery = useVisits(circleId);
  const setStatus = useSetVisitStatus(circleId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (visitsQuery.isLoading) return <LoadingState />;
  if (visitsQuery.isError) {
    return (
      <ErrorState
        message={t('visits.loadError')}
        retryLabel={t('retry')}
        onRetry={() => visitsQuery.refetch()}
      />
    );
  }

  const visits = visitsQuery.data ?? [];
  const today = todayYmd();
  const todayVisits = visits
    .filter((visit) => visit.visit_date === today)
    .sort((a, b) => startSortKey(a).localeCompare(startSortKey(b)));
  const upcoming = visits
    .filter((visit) => visit.visit_date > today)
    .sort((a, b) => startSortKey(a).localeCompare(startSortKey(b)));
  const recent = visits.filter((visit) => visit.visit_date < today).slice(0, RECENT_LIMIT);

  const canAdd = canManage || canCollaborate;

  function canActOn(visit: FamilyVisit): boolean {
    if (visit.status !== 'planned') return false;
    if (canManage) return true;
    return canCollaborate && visit.visitor_user_id !== null && visit.visitor_user_id === userId;
  }

  async function changeStatus(visit: FamilyVisit, status: VisitStatus) {
    setPendingId(visit.id);
    try {
      await setStatus.mutateAsync({ id: visit.id, status });
    } finally {
      setPendingId(null);
    }
  }

  function renderCard(visit: FamilyVisit) {
    return (
      <VisitCard
        key={visit.id}
        visit={visit}
        mine={visit.visitor_user_id !== null && visit.visitor_user_id === userId}
        canAct={canActOn(visit)}
        pending={pendingId === visit.id}
        onComplete={() => changeStatus(visit, 'completed')}
        onCancel={() => changeStatus(visit, 'cancelled')}
        onOpen={() => router.push(`/visits/${visit.id}`)}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('visits.disclaimer')}
        </ThemedText>

        {canAdd ? (
          <Button label={t('visits.add')} onPress={() => router.push('/visits/new')} />
        ) : null}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('visits.todayTitle')}
        </ThemedText>
        {todayVisits.length === 0 ? (
          <EmptyState title={t('visits.noTodayTitle')} subtitle={t('visits.noTodaySubtitle')} />
        ) : (
          <View style={styles.list}>{todayVisits.map(renderCard)}</View>
        )}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('visits.upcomingTitle')}
        </ThemedText>
        {upcoming.length === 0 ? (
          <EmptyState
            title={t('visits.noUpcomingTitle')}
            subtitle={canAdd ? t('visits.noUpcomingSubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{upcoming.map(renderCard)}</View>
        )}

        {recent.length > 0 ? (
          <>
            <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
              {t('visits.recentTitle')}
            </ThemedText>
            <View style={styles.list}>{recent.map(renderCard)}</View>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function VisitCard({
  visit,
  mine,
  canAct,
  pending,
  onComplete,
  onCancel,
  onOpen,
}: {
  visit: FamilyVisit;
  mine: boolean;
  canAct: boolean;
  pending: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  const timeParts = [];
  if (visit.start_time) timeParts.push(formatHm(visit.start_time));
  if (visit.end_time) timeParts.push(formatHm(visit.end_time));
  const when = timeParts.length > 0 ? `${visit.visit_date} ${timeParts.join(' – ')}` : visit.visit_date;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{visit.visitor_name}</ThemedText>
        {visit.status !== 'planned' ? (
          <View style={[styles.badge, { borderColor: DONE_COLORS[visit.status] }]}>
            <ThemedText type="small" style={{ color: DONE_COLORS[visit.status] }}>
              {t(`visits.status.${visit.status}`)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {when}
      </ThemedText>
      {mine ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('visits.mineLabel')}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        {canAct ? (
          <>
            <Button
              size="sm"
              label={t('visits.markCompleted')}
              disabled={pending}
              onPress={onComplete}
            />
            <Button
              size="sm"
              variant="secondary"
              label={t('visits.markCancelled')}
              disabled={pending}
              onPress={onCancel}
            />
          </>
        ) : null}
        <Button size="sm" variant="secondary" label={t('common.details')} onPress={onOpen} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sectionTitle: { fontSize: 22, lineHeight: 30, marginTop: Spacing.two },
  list: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  badge: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    alignSelf: 'flex-start',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
