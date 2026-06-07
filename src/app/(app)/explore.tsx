import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Placeholder "Explore" screen. Each section is a non-interactive "coming soon"
 * card describing a future feature — there is no logic or data fetching here yet.
 */
const SECTIONS = [
  { key: 'guides', titleKey: 'explore.sections.guides.title', subtitleKey: 'explore.sections.guides.subtitle' },
  { key: 'resources', titleKey: 'explore.sections.resources.title', subtitleKey: 'explore.sections.resources.subtitle' },
  { key: 'community', titleKey: 'explore.sections.community.title', subtitleKey: 'explore.sections.community.subtitle' },
] as const;

export default function ExploreScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.header}>
            <ThemedText type="title" accessibilityRole="header">
              {t('explore.title')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {t('explore.subtitle')}
            </ThemedText>
          </ThemedView>

          <View style={styles.cards}>
            {SECTIONS.map((section) => (
              <ThemedView key={section.key} type="backgroundElement" style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle}>{t(section.titleKey)}</ThemedText>
                  <ThemedView type="backgroundSelected" style={styles.badge}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('explore.comingSoon')}
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
  subtitle: {
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
