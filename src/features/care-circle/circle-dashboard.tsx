import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';

import type { CircleSummary } from './api';

/** Placeholder feature cards shown on the dashboard (no logic yet). */
const SECTIONS = [
  {
    key: 'medications',
    titleKey: 'careCircle.dashboard.sections.medications.title',
    subtitleKey: 'careCircle.dashboard.sections.medications.subtitle',
  },
  {
    key: 'tasks',
    titleKey: 'careCircle.dashboard.sections.tasks.title',
    subtitleKey: 'careCircle.dashboard.sections.tasks.subtitle',
  },
  {
    key: 'emergency',
    titleKey: 'careCircle.dashboard.sections.emergency.title',
    subtitleKey: 'careCircle.dashboard.sections.emergency.subtitle',
  },
] as const;

/** Dashboard shown on Home once the user belongs to an active care circle. */
export function CareCircleDashboard({ summary }: { summary: CircleSummary }) {
  const { t } = useTranslation();

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

          <View style={styles.cards}>
            {SECTIONS.map((section) => (
              <ThemedView key={section.key} type="backgroundElement" style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle}>{t(section.titleKey)}</ThemedText>
                  <ThemedView type="backgroundSelected" style={styles.badge}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('careCircle.dashboard.comingSoon')}
                    </ThemedText>
                  </ThemedView>
                </View>
                <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
                  {t(section.subtitleKey)}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  circleName: { fontSize: 22, lineHeight: 30, fontWeight: 600 },
  recipientName: { fontSize: 20, lineHeight: 28, fontWeight: 600 },
  cards: { gap: Spacing.three },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    minHeight: 96,
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 20, lineHeight: 28, fontWeight: 600, flexShrink: 1 },
  badge: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  cardSubtitle: { fontSize: 16, lineHeight: 24 },
});
