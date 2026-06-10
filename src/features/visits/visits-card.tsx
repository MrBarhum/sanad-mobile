import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    <Pressable
      onPress={() => router.push('/visits')}
      accessibilityRole="button"
      accessibilityLabel={t('careCircle.dashboard.sections.visits.title')}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {t('careCircle.dashboard.sections.visits.title')}
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
