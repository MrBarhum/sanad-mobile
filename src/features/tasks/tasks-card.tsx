import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { useTodayTaskSummary } from './hooks';

/** Navigable tasks card on the dashboard, showing today's task counts. */
export function TasksCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayTaskSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.tasks.subtitle')
    : summary.dueToday === 0 && summary.completedToday === 0
      ? t('tasks.summary.none')
      : t('tasks.summary.counts', { due: summary.dueToday, done: summary.completedToday });

  return (
    <Surface
      onPress={() => router.push('/tasks')}
      accessibilityLabel={t('careCircle.dashboard.sections.tasks.title')}
      style={styles.card}>
      <ThemedText type="cardTitle">
        {t('careCircle.dashboard.sections.tasks.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, minHeight: 96, justifyContent: 'center' },
});
