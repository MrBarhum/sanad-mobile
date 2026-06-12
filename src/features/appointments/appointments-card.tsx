import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { useTodayAppointmentSummary } from './hooks';

/** Navigable appointments card on the dashboard, showing today's count. */
export function AppointmentsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { count, isLoading } = useTodayAppointmentSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.appointments.subtitle')
    : count === 0
      ? t('appointments.summary.none')
      : t('appointments.summary.count', { count });

  return (
    <Surface
      onPress={() => router.push('/appointments')}
      accessibilityLabel={t('careCircle.dashboard.sections.appointments.title')}
      style={styles.card}>
      <ThemedText type="cardTitle">
        {t('careCircle.dashboard.sections.appointments.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
        {subtitle}
      </ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, minHeight: 96, justifyContent: 'center' },
  cardSubtitle: { fontSize: 16, lineHeight: 24 },
});
