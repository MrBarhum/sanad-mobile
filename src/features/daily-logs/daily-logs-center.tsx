import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('dailyLogs.disclaimer')}
        </ThemedText>

        {canAdd ? (
          <Button label={t('dailyLogs.add')} onPress={() => router.push('/daily-logs/new')} />
        ) : null}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('dailyLogs.todayTitle')}
        </ThemedText>
        {todayLogs.length === 0 ? (
          <EmptyState
            title={t('dailyLogs.noTodayTitle')}
            subtitle={canAdd ? t('dailyLogs.noTodaySubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{todayLogs.map(renderRow)}</View>
        )}

        {recentLogs.length > 0 ? (
          <>
            <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
              {t('dailyLogs.recentTitle')}
            </ThemedText>
            <View style={styles.list}>{recentLogs.map(renderRow)}</View>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
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
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${log.log_date}`}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>{log.log_date}</ThemedText>
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
      </ThemedView>
    </Pressable>
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
  pressed: { opacity: 0.7 },
});
