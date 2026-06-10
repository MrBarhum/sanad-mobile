import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    <Pressable
      onPress={() => router.push('/tasks')}
      accessibilityRole="button"
      accessibilityLabel={t('careCircle.dashboard.sections.tasks.title')}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {t('careCircle.dashboard.sections.tasks.title')}
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
