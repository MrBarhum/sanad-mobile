import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { AppointmentsCard } from '@/features/appointments/appointments-card';
import { DailyLogsCard } from '@/features/daily-logs/daily-logs-card';
import { useTodayDoseSummary } from '@/features/medications/hooks';
import { TasksCard } from '@/features/tasks/tasks-card';
import { VisitsCard } from '@/features/visits/visits-card';
import { VitalsCard } from '@/features/vitals/vitals-card';

import type { CircleSummary } from './api';

const EMERGENCY = '#dc2626';

/** Navigable feature cards on the dashboard. */
const ACTIONS = [
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
export function CareCircleDashboard({ summary }: { summary: CircleSummary }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.header}>
            <ThemedText type="title" accessibilityRole="header">
              {t('home.greeting')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.tagline}>
              {t('home.tagline')}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.circleCard}>
            <View style={styles.row}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('careCircle.dashboard.circleLabel')}
              </ThemedText>
              <ThemedText style={styles.circleName}>{summary.circleName}</ThemedText>
            </View>
            <ThemedView type="backgroundSelected" style={styles.divider} />
            <View style={styles.row}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('careCircle.dashboard.recipientLabel')}
              </ThemedText>
              <ThemedText style={styles.recipientName}>
                {summary.recipientName ?? t('careCircle.dashboard.noRecipient')}
              </ThemedText>
            </View>
          </ThemedView>

          <Pressable
            onPress={() => router.push('/emergency-card')}
            accessibilityRole="button"
            accessibilityLabel={t('careCircle.dashboard.sections.emergency.title')}
            style={({ pressed }) => [styles.emergencyCard, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.emergencyInner}>
              <ThemedText style={styles.emergencyTitle}>
                {t('careCircle.dashboard.sections.emergency.title')}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
                {t('careCircle.dashboard.sections.emergency.subtitle')}
              </ThemedText>
            </ThemedView>
          </Pressable>

          <View style={styles.cards}>
            <MedicationsCard circleId={summary.circleId} />
            <DailyLogsCard circleId={summary.circleId} />
            <VitalsCard circleId={summary.circleId} />
            <TasksCard circleId={summary.circleId} />
            <AppointmentsCard circleId={summary.circleId} />
            <VisitsCard circleId={summary.circleId} />

            {ACTIONS.map((section) => (
              <Pressable
                key={section.key}
                onPress={() => router.push(section.href)}
                accessibilityRole="button"
                accessibilityLabel={t(section.titleKey)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText style={styles.cardTitle}>{t(section.titleKey)}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
                    {t(section.subtitleKey)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
    <Pressable
      onPress={() => router.push('/medications')}
      accessibilityRole="button"
      accessibilityLabel={t('careCircle.dashboard.sections.medications.title')}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {t('careCircle.dashboard.sections.medications.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
          {subtitle}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: TopTabInset + Spacing.five,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.five,
  },
  header: { gap: Spacing.two },
  tagline: { fontSize: 18, lineHeight: 28 },
  circleCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: { gap: Spacing.one },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  circleName: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  recipientName: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  emergencyCard: { borderRadius: Spacing.four },
  emergencyInner: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    borderWidth: 2,
    borderColor: EMERGENCY,
    minHeight: 96,
    justifyContent: 'center',
  },
  emergencyTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: EMERGENCY },
  cards: { gap: Spacing.three },
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
