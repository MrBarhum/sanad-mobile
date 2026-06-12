import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { useTodayVisitSummary } from './hooks';

/** Navigable family-visits card on the dashboard, showing today's count. */
export function VisitsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { count, isLoading } = useTodayVisitSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.visits.subtitle')
    : count === 0
      ? t('visits.summary.none')
      : t('visits.summary.count', { count });

  return (
    <Surface
      onPress={() => router.push('/visits')}
      accessibilityLabel={t('careCircle.dashboard.sections.visits.title')}
      style={styles.card}>
      <ThemedText type="cardTitle" style={styles.cardTitle}>
        {t('careCircle.dashboard.sections.visits.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
        {subtitle}
      </ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, minHeight: 96, justifyContent: 'center' },
  cardTitle: { flexShrink: 1 },
  cardSubtitle: { fontSize: 16, lineHeight: 24 },
});
