import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    <Pressable
      onPress={() => router.push('/appointments')}
      accessibilityRole="button"
      accessibilityLabel={t('careCircle.dashboard.sections.appointments.title')}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {t('careCircle.dashboard.sections.appointments.title')}
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
