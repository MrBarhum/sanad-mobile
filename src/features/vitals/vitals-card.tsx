import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { useTodayVitalSummary } from './hooks';

/** Navigable vitals card on the dashboard: today's count + total readings. */
export function VitalsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayVitalSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.vitals.subtitle')
    : summary.totalCount === 0
      ? t('vitals.summary.none')
      : t('vitals.summary.counts', { today: summary.todayCount, total: summary.totalCount });

  return (
    <Pressable
      onPress={() => router.push('/vitals')}
      accessibilityRole="button"
      accessibilityLabel={t('careCircle.dashboard.sections.vitals.title')}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {t('careCircle.dashboard.sections.vitals.title')}
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
