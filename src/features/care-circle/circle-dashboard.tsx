import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DashboardTile } from '@/components/dashboard-tile';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { Section } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type IconName } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { formatLongDate } from '@/utils/date';
import { CircleSwitcher } from '@/features/circle-selection/circle-switcher';
import type { ActiveCircle } from '@/features/circle-selection/permissions';
import { DailyLogsCard } from '@/features/daily-logs/daily-logs-card';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { VisitsCard } from '@/features/visits/visits-card';
import { VitalsCard } from '@/features/vitals/vitals-card';

import { TodayOverview } from './today-overview';

/**
 * Demoted quick-access destinations (the rest of the app), shown as a single
 * light 3-up grid below the Today hero — never the rejected "wall of two-column
 * rectangles". Medications is the hero, tasks/appointments are the Today summary,
 * and emergency is one tap from the header, so they are intentionally absent here.
 */
const QUICK_NAV = [
  {
    key: 'doctors',
    href: '/doctors',
    iconName: 'doctor',
    titleKey: 'careCircle.dashboard.sections.doctors.title',
    subtitleKey: 'careCircle.dashboard.sections.doctors.subtitle',
  },
  {
    key: 'members',
    href: '/circle-members',
    iconName: 'member',
    titleKey: 'circleMembers.title',
    subtitleKey: 'circleMembers.subtitle',
  },
  {
    key: 'recipientProfile',
    href: '/recipient-profile',
    iconName: 'profile',
    titleKey: 'careCircle.dashboard.sections.recipientProfile.title',
    subtitleKey: 'careCircle.dashboard.sections.recipientProfile.subtitle',
  },
  {
    key: 'emergencyContacts',
    href: '/emergency-contacts',
    iconName: 'call',
    titleKey: 'careCircle.dashboard.sections.emergencyContacts.title',
    subtitleKey: 'careCircle.dashboard.sections.emergencyContacts.subtitle',
  },
] as const satisfies readonly {
  key: string;
  href: Href;
  iconName: IconName;
  titleKey: string;
  subtitleKey: string;
}[];

/** Dashboard shown on Home once the user belongs to an active care circle. */
export function CareCircleDashboard({ circle }: { circle: ActiveCircle }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  return (
    <Screen edges={{ top: true }}>
      <ThemedView style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText
            type="title"
            accessibilityRole="header"
            numberOfLines={1}
            style={styles.headerTitle}>
            {t('home.greeting')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatLongDate(i18n.language)}
          </ThemedText>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell />
          <IconButton
            iconName="emergency"
            color="errorFg"
            accessibilityLabel={t('careCircle.dashboard.sections.emergency.title')}
            accessibilityHint={t('careCircle.dashboard.sections.emergency.subtitle')}
            onPress={() => router.push('/emergency-card')}
          />
        </View>
      </ThemedView>

      <CircleSwitcher />

      <TodayOverview circle={circle} />

      <Section title={t('careCircle.dashboard.quickAccessTitle')}>
        <View style={styles.grid}>
          <DailyLogsCard circleId={circle.circleId} />
          <VitalsCard circleId={circle.circleId} />
          <VisitsCard circleId={circle.circleId} />
          {QUICK_NAV.map((item) => (
            <DashboardTile
              key={item.key}
              iconName={item.iconName}
              title={t(item.titleKey)}
              meta={t(item.subtitleKey)}
              onPress={() => router.push(item.href)}
            />
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerText: { flexShrink: 1, gap: Spacing.half },
  headerTitle: { flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
});
