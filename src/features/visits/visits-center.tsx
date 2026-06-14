import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LtrText, isolateLtr } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Glyph } from '@/constants/glyphs';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { FamilyVisit, VisitStatus } from './api';
import { useSetVisitStatus, useVisits } from './hooks';

const RECENT_LIMIT = 10;

const STATUS_TONE: Record<Exclude<VisitStatus, 'planned'>, StatusTone> = {
  completed: 'success',
  cancelled: 'error',
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
    <Screen>
      <ThemedText type="small" themeColor="textMuted">
        {t('visits.disclaimer')}
      </ThemedText>

      {canAdd ? (
        <Button glyph={Glyph.plus} label={t('visits.add')} onPress={() => router.push('/visits/new')} />
      ) : null}

      <Section title={t('visits.todayTitle')}>
        {todayVisits.length === 0 ? (
          <EmptyState
            icon={Glyph.visit}
            title={t('visits.noTodayTitle')}
            subtitle={t('visits.noTodaySubtitle')}
          />
        ) : (
          <View style={styles.list}>{todayVisits.map(renderCard)}</View>
        )}
      </Section>

      <Section title={t('visits.upcomingTitle')}>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={Glyph.visit}
            title={t('visits.noUpcomingTitle')}
            subtitle={canAdd ? t('visits.noUpcomingSubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{upcoming.map(renderCard)}</View>
        )}
      </Section>

      {recent.length > 0 ? (
        <Section title={t('visits.recentTitle')}>
          <View style={styles.list}>{recent.map(renderCard)}</View>
        </Section>
      ) : null}
    </Screen>
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
  const theme = useTheme();

  const timeParts = [];
  if (visit.start_time) timeParts.push(isolateLtr(formatHm(visit.start_time)));
  if (visit.end_time) timeParts.push(isolateLtr(formatHm(visit.end_time)));
  const when =
    timeParts.length > 0 ? `${visit.visit_date} ${timeParts.join(' – ')}` : visit.visit_date;

  return (
    <Surface style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="cardTitle" style={styles.cardTitle}>
          {visit.visitor_name}
        </ThemedText>
        {visit.status !== 'planned' ? (
          <StatusBadge
            tone={STATUS_TONE[visit.status]}
            label={t(`visits.status.${visit.status}`)}
          />
        ) : null}
      </View>

      {/* The visit date/time is the scannable anchor of the card. */}
      <View style={[styles.whenChip, { backgroundColor: theme.accentBg }]}>
        <LtrText style={[styles.whenText, { color: theme.accentFg }]}>{when}</LtrText>
      </View>
      {mine ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('visits.mineLabel')}
        </ThemedText>
      ) : null}

      <View style={[styles.actions, { borderTopColor: theme.divider }]}>
        {canAct ? (
          <>
            <Button
              size="sm"
              glyph={Glyph.check}
              label={t('visits.markCompleted')}
              disabled={pending}
              onPress={onComplete}
              style={styles.action}
            />
            <Button
              size="sm"
              variant="secondary"
              glyph={Glyph.cross}
              label={t('visits.markCancelled')}
              disabled={pending}
              onPress={onCancel}
              style={styles.action}
            />
          </>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          glyph={Glyph.chevron}
          label={t('common.details')}
          onPress={onOpen}
          style={styles.action}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  card: { gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { flexShrink: 1 },
  whenChip: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 40,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  whenText: { fontFamily: FontFamily.bold, fontSize: 18, lineHeight: 28, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  action: { flexGrow: 1, flexBasis: 96 },
});
