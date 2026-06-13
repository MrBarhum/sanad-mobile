import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlyphChip } from '@/components/glyph-chip';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

/**
 * Placeholder "Explore" screen. Each section is a non-interactive "coming soon"
 * card describing a future feature â€” there is no logic or data fetching here yet.
 * Glyph anchors are decorative non-emoji marks; the labels carry all meaning.
 */
const SECTIONS = [
  { key: 'guides', glyph: 'â—ˆ', titleKey: 'explore.sections.guides.title', subtitleKey: 'explore.sections.guides.subtitle' },
  { key: 'resources', glyph: 'â—Ž', titleKey: 'explore.sections.resources.title', subtitleKey: 'explore.sections.resources.subtitle' },
  { key: 'community', glyph: 'âŠ™', titleKey: 'explore.sections.community.title', subtitleKey: 'explore.sections.community.subtitle' },
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
            <ThemedText themeColor="textSecondary">{t('explore.subtitle')}</ThemedText>
          </ThemedView>

          <View style={styles.cards}>
            {SECTIONS.map((section) => (
              <Surface key={section.key} style={styles.card}>
                <View style={styles.cardHeader}>
                  <GlyphChip glyph={section.glyph} tone="neutral" size="sm" />
                  <ThemedText type="cardTitle" style={styles.cardTitle}>
                    {t(section.titleKey)}
                  </ThemedText>
                  <ThemedView type="backgroundSelected" style={styles.badge}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('explore.comingSoon')}
                    </ThemedText>
                  </ThemedView>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(section.subtitleKey)}
                </ThemedText>
              </Surface>
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
  cards: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    minHeight: 96,
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardTitle: {
    flex: 1,
  },
  badge: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
