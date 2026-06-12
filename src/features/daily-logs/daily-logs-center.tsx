import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LtrText } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { Section, Surface } from '@/components/surface';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import type { DailyCareLog } from './api';
import { describeDailyLog } from './describe';
import { useDailyLogs } from './hooks';

/** Daily care logs center: today's logs, recent logs, and an add button. */
export function DailyLogsCenter({
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

  const logsQuery = useDailyLogs(circleId);

  if (logsQuery.isLoading) return <LoadingState />;
  if (logsQuery.isError) {
    return (
      <ErrorState
        message={t('dailyLogs.loadError')}
        retryLabel={t('retry')}
        onRetry={() => logsQuery.refetch()}
      />
    );
  }

  const logs = logsQuery.data ?? [];
  const today = todayYmd();
  const todayLogs = logs.filter((log) => log.log_date === today);
  const recentLogs = logs.filter((log) => log.log_date !== today);
  const canAdd = canManage || canCollaborate;

  function renderRow(log: DailyCareLog) {
    return (
      <LogRow
        key={log.id}
        log={log}
        mine={log.recorded_by !== null && log.recorded_by === userId}
        onOpen={() => router.push(`/daily-logs/${log.id}`)}
      />
    );
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {t('dailyLogs.disclaimer')}
      </ThemedText>

      {canAdd ? (
        <Button label={t('dailyLogs.add')} onPress={() => router.push('/daily-logs/new')} />
      ) : null}

      <Section title={t('dailyLogs.todayTitle')}>
        {todayLogs.length === 0 ? (
          <EmptyState
            title={t('dailyLogs.noTodayTitle')}
            subtitle={canAdd ? t('dailyLogs.noTodaySubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{todayLogs.map(renderRow)}</View>
        )}
      </Section>

      {recentLogs.length > 0 ? (
        <Section title={t('dailyLogs.recentTitle')}>
          <View style={styles.list}>{recentLogs.map(renderRow)}</View>
        </Section>
      ) : null}
    </Screen>
  );
}

function LogRow({
  log,
  mine,
  onOpen,
}: {
  log: DailyCareLog;
  mine: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const details = describeDailyLog(log, t);
  const noteCount =
    (log.bathroom_notes ? 1 : 0) +
    (log.food_notes ? 1 : 0) +
    (log.activity_notes ? 1 : 0) +
    (log.general_notes ? 1 : 0);

  return (
    <Surface
      onPress={onOpen}
      accessibilityLabel={`${log.log_date}`}
      style={styles.card}>
      <View style={styles.cardHeader}>
        <LtrText type="cardTitle" style={styles.cardTitle}>
          {log.log_date}
        </LtrText>
        {mine ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('dailyLogs.mineLabel')}
          </ThemedText>
        ) : null}
      </View>

      {details.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {details.map((detail) => `${detail.label}: ${detail.value}`).join(' • ')}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('dailyLogs.notesOnly')}
        </ThemedText>
      )}

      {noteCount > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('dailyLogs.noteCount', { count: noteCount })}
        </ThemedText>
      ) : null}
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
});
