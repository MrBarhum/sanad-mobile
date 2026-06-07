import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Static landing/dashboard placeholder. Each section is a non-interactive
 * "coming soon" card — there is intentionally no care-circle logic, navigation,
 * or Supabase data fetching here yet (that arrives in a later step).
 */
const SECTIONS = [
  { key: 'careCircle', titleKey: 'home.sections.careCircle.title', subtitleKey: 'home.sections.careCircle.subtitle' },
  { key: 'tasks', titleKey: 'home.sections.tasks.title', subtitleKey: 'home.sections.tasks.subtitle' },
  { key: 'reminders', titleKey: 'home.sections.reminders.title', subtitleKey: 'home.sections.reminders.subtitle' },
] as const;

export default function HomeScreen() {
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

          <View style={styles.cards}>
            {SECTIONS.map((section) => (
              <ThemedView key={section.key} type="backgroundElement" style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle}>{t(section.titleKey)}</ThemedText>
                  <ThemedView type="backgroundSelected" style={styles.badge}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('home.comingSoon')}
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
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.two,
  },
  tagline: {
    fontSize: 18,
    lineHeight: 28,
  },
  cards: {
    gap: Spacing.three,
  },
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
  cardTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 600,
    flexShrink: 1,
  },
  badge: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  cardSubtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
});
