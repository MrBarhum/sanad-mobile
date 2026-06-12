import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
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
    <Surface
      onPress={() => router.push('/vitals')}
      accessibilityLabel={t('careCircle.dashboard.sections.vitals.title')}
      style={styles.card}>
      <ThemedText type="cardTitle">
        {t('careCircle.dashboard.sections.vitals.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, minHeight: 96, justifyContent: 'center' },
});
