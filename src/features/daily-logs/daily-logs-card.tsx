import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    <Pressable
      onPress={() => router.push('/daily-logs')}
      accessibilityRole="button"
      accessibilityLabel={t('careCircle.dashboard.sections.dailyLogs.title')}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {t('careCircle.dashboard.sections.dailyLogs.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
          {subtitle}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    minHeight: 96,
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 20, lineHeight: 28, fontWeight: '600', flexShrink: 1 },
  cardSubtitle: { fontSize: 16, lineHeight: 24 },
  pressed: { opacity: 0.7 },
});
