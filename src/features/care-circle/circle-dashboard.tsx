import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlyphChip } from '@/components/glyph-chip';
import { NavCard } from '@/components/nav-card';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { Glyph } from '@/constants/glyphs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AppointmentsCard } from '@/features/appointments/appointments-card';
import { CircleSwitcher } from '@/features/circle-selection/circle-switcher';
import type { ActiveCircle } from '@/features/circle-selection/permissions';
import { DailyLogsCard } from '@/features/daily-logs/daily-logs-card';
import { useTodayDoseSummary } from '@/features/medications/hooks';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { TasksCard } from '@/features/tasks/tasks-card';
import { VisitsCard } from '@/features/visits/visits-card';
import { VitalsCard } from '@/features/vitals/vitals-card';

/**
 * People & settings rows on the dashboard — rendered as one grouped list (a
 * calm "settings group") rather than four more look-alike cards. Glyphs are
 * decorative non-emoji marks; the labels carry all meaning.
 */
const ACTIONS = [
  {
    key: 'members',
    href: '/circle-members',
    glyph: Glyph.members,
    titleKey: 'circleMembers.title',
    subtitleKey: 'circleMembers.subtitle',
  },
  {
    key: 'recipientProfile',
    href: '/recipient-profile',
    glyph: Glyph.profile,
    titleKey: 'careCircle.dashboard.sections.recipientProfile.title',
    subtitleKey: 'careCircle.dashboard.sections.recipientProfile.subtitle',
  },
  {
    key: 'emergencyContacts',
    href: '/emergency-contacts',
    glyph: Glyph.contact,
    titleKey: 'careCircle.dashboard.sections.emergencyContacts.title',
    subtitleKey: 'careCircle.dashboard.sections.emergencyContacts.subtitle',
  },
  {
    key: 'doctors',
    href: '/doctors',
    glyph: Glyph.doctor,
    titleKey: 'careCircle.dashboard.sections.doctors.title',
    subtitleKey: 'careCircle.dashboard.sections.doctors.subtitle',
  },
] as const satisfies readonly {
  key: string;
  href: Href;
  glyph: string;
  titleKey: string;
  subtitleKey: string;
}[];

/** Dashboard shown on Home once the user belongs to an active care circle. */
export function CareCircleDashboard({ circle }: { circle: ActiveCircle }) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();

  return (
    <Screen edges={{ top: true }}>
      <ThemedView style={styles.header}>
        <View style={styles.headerTop}>
          <ThemedText type="title" accessibilityRole="header" style={styles.headerTitle}>
            {t('home.greeting')}
          </ThemedText>
          <NotificationBell />
        </View>
        <ThemedText themeColor="textSecondary">{t('home.tagline')}</ThemedText>
      </ThemedView>

      <CircleSwitcher />

      <NavCard
        glyph={Glyph.emergency}
        glyphTone="error"
        tone="error"
        titleColor="errorFg"
        title={t('careCircle.dashboard.sections.emergency.title')}
        subtitle={t('careCircle.dashboard.sections.emergency.subtitle')}
        onPress={() => router.push('/emergency-card')}
      />

      <View style={styles.cards}>
        <MedicationsCard circleId={circle.circleId} />
        <DailyLogsCard circleId={circle.circleId} />
        <VitalsCard circleId={circle.circleId} />
        <TasksCard circleId={circle.circleId} />
        <AppointmentsCard circleId={circle.circleId} />
        <VisitsCard circleId={circle.circleId} />
      </View>

      <Surface padded={false}>
        {ACTIONS.map((section, index) => (
          <Pressable
            key={section.key}
            onPress={() => router.push(section.href)}
            accessibilityRole="button"
            accessibilityLabel={t(section.titleKey)}
            accessibilityHint={t(section.subtitleKey)}
            android_ripple={{ color: theme.backgroundSelected }}
            style={({ pressed }) => [
              styles.actionRow,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
              pressed && styles.pressed,
            ]}>
            <GlyphChip glyph={section.glyph} tone="neutral" size="sm" />
            <View style={styles.rowText}>
              <ThemedText type="cardTitle">{t(section.titleKey)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t(section.subtitleKey)}
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.chevron, { color: theme.textMuted }]}
              accessibilityElementsHidden>
              {Glyph.chevron}
            </ThemedText>
          </Pressable>
        ))}
      </Surface>
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
    <NavCard
      glyph={Glyph.medication}
      title={t('careCircle.dashboard.sections.medications.title')}
      subtitle={subtitle}
      onPress={() => router.push('/medications')}
    />
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
  cards: { gap: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
  chevron: { fontSize: 26, lineHeight: 30, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    minHeight: TouchTarget.comfortable + Spacing.three,
  },
  pressed: { opacity: 0.8 },
});
