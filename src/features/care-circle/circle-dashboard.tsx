import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { AppointmentsCard } from '@/features/appointments/appointments-card';
import { CircleSwitcher } from '@/features/circle-selection/circle-switcher';
import type { ActiveCircle } from '@/features/circle-selection/permissions';
import { DailyLogsCard } from '@/features/daily-logs/daily-logs-card';
import { useTodayDoseSummary } from '@/features/medications/hooks';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { TasksCard } from '@/features/tasks/tasks-card';
import { VisitsCard } from '@/features/visits/visits-card';
import { VitalsCard } from '@/features/vitals/vitals-card';

/** Navigable feature cards on the dashboard. */
const ACTIONS = [
  {
    key: 'members',
    href: '/circle-members',
    titleKey: 'circleMembers.title',
    subtitleKey: 'circleMembers.subtitle',
  },
  {
    key: 'recipientProfile',
    href: '/recipient-profile',
    titleKey: 'careCircle.dashboard.sections.recipientProfile.title',
    subtitleKey: 'careCircle.dashboard.sections.recipientProfile.subtitle',
  },
  {
    key: 'emergencyContacts',
    href: '/emergency-contacts',
    titleKey: 'careCircle.dashboard.sections.emergencyContacts.title',
    subtitleKey: 'careCircle.dashboard.sections.emergencyContacts.subtitle',
  },
  {
    key: 'doctors',
    href: '/doctors',
    titleKey: 'careCircle.dashboard.sections.doctors.title',
    subtitleKey: 'careCircle.dashboard.sections.doctors.subtitle',
  },
] as const satisfies readonly { key: string; href: Href; titleKey: string; subtitleKey: string }[];

/** Dashboard shown on Home once the user belongs to an active care circle. */
export function CareCircleDashboard({ circle }: { circle: ActiveCircle }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen edges={{ top: true }}>
      <ThemedView style={styles.header}>
        <View style={styles.headerTop}>
          <ThemedText type="title" accessibilityRole="header" style={styles.headerTitle}>
            {t('home.greeting')}
          </ThemedText>
          <NotificationBell />
        </View>
        <ThemedText themeColor="textSecondary" style={styles.tagline}>
          {t('home.tagline')}
        </ThemedText>
      </ThemedView>

      <CircleSwitcher />

      <Surface
        tone="error"
        onPress={() => router.push('/emergency-card')}
        accessibilityLabel={t('careCircle.dashboard.sections.emergency.title')}
        style={styles.emergencyCard}>
        <View style={styles.emergencyRow}>
          <ThemedText style={styles.emergencyGlyph} accessibilityElementsHidden importantForAccessibility="no">
            🆘
          </ThemedText>
          <View style={styles.emergencyText}>
            <ThemedText type="sectionTitle" themeColor="errorFg">
              {t('careCircle.dashboard.sections.emergency.title')}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {t('careCircle.dashboard.sections.emergency.subtitle')}
            </ThemedText>
          </View>
        </View>
      </Surface>

      <View style={styles.cards}>
        <MedicationsCard circleId={circle.circleId} />
        <DailyLogsCard circleId={circle.circleId} />
        <VitalsCard circleId={circle.circleId} />
        <TasksCard circleId={circle.circleId} />
        <AppointmentsCard circleId={circle.circleId} />
        <VisitsCard circleId={circle.circleId} />

        {ACTIONS.map((section) => (
          <Surface
            key={section.key}
            onPress={() => router.push(section.href)}
            accessibilityLabel={t(section.titleKey)}
            style={styles.card}>
            <ThemedText type="cardTitle">{t(section.titleKey)}</ThemedText>
            <ThemedText themeColor="textSecondary">{t(section.subtitleKey)}</ThemedText>
          </Surface>
        ))}
      </View>
    </Screen>
  );
}

/** Navigable medications card showing today's dose summary. */
function MedicationsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayDoseSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.medications.subtitle')
    : summary.total === 0
      ? t('medications.summary.none')
      : t('medications.summary.counts', {
          total: summary.total,
          given: summary.given,
          remaining: summary.remaining,
        });

  return (
    <Surface
      onPress={() => router.push('/medications')}
      accessibilityLabel={t('careCircle.dashboard.sections.medications.title')}
      style={styles.card}>
      <ThemedText type="cardTitle">
        {t('careCircle.dashboard.sections.medications.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerTitle: { flexShrink: 1 },
  tagline: { fontSize: 18, lineHeight: 28 },
  emergencyCard: { minHeight: 96, justifyContent: 'center' },
  emergencyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  emergencyGlyph: { fontSize: 32, lineHeight: 38 },
  emergencyText: { flex: 1, gap: Spacing.two },
  cards: { gap: Spacing.three },
  card: { gap: Spacing.two, minHeight: 96, justifyContent: 'center' },
});
