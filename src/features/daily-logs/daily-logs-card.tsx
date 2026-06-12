import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { useTodayLogSummary } from './hooks';

/** Navigable daily-logs card on the dashboard: today's log count + latest mood. */
export function DailyLogsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayLogSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.dailyLogs.subtitle')
    : summary.todayCount === 0
      ? t('dailyLogs.summary.none')
      : summary.latestMood
        ? t('dailyLogs.summary.countsMood', {
            count: summary.todayCount,
            mood: t(`dailyLogs.mood.${summary.latestMood}`),
          })
        : t('dailyLogs.summary.counts', { count: summary.todayCount });

  return (
    <Surface
      onPress={() => router.push('/daily-logs')}
      accessibilityLabel={t('careCircle.dashboard.sections.dailyLogs.title')}
      style={styles.card}>
      <ThemedText type="cardTitle">
        {t('careCircle.dashboard.sections.dailyLogs.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
        {subtitle}
      </ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    minHeight: 96,
    justifyContent: 'center',
  },
  cardSubtitle: { fontSize: 16, lineHeight: 24 },
});
