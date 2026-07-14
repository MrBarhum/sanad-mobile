import { useRouter } from 'expo-router';
import {
  Activity,
  AlertCircle,
  Calendar,
  Check,
  FileText,
  HeartPulse,
  Pill,
  Stethoscope,
  Users,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaListRow, FigmaSectionLabel } from '@/components/figma/figma-list-row';
import { FigmaScreen } from '@/components/figma/figma-screen';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type ExploreItem = {
  id: string;
  route: string;
  titleKey: string;
  subtitleKey: string;
  color: string;
  Icon: IconCmp;
};

type ExploreSection = {
  id: string;
  titleKey: string;
  items: ExploreItem[];
};

/**
 * The Figma Make "Explore" screen, recreated literally in React Native: a plain
 * title header (no back / add) over grouped section lists. Each row is a tinted
 * icon chip + label + sublabel + a trailing chevron that navigates to the real
 * existing feature center (its own CircleGate resolves the active circle). This
 * is a static navigation index — no per-item counts are fabricated; the
 * sublabels describe each feature instead. Cairo + Figma tokens, dark-first, RTL.
 * No old Sanad Screen/Surface/GlyphChip.
 */
const SECTIONS: ExploreSection[] = [
  {
    id: 'dailyCare',
    titleKey: 'figma.explore.groups.dailyCare',
    items: [
      {
        id: 'medications',
        route: '/medications',
        titleKey: 'careCircle.dashboard.sections.medications.title',
        subtitleKey: 'figma.explore.items.medications',
        color: FigmaCategory.teal,
        Icon: Pill,
      },
      {
        id: 'tasks',
        route: '/tasks',
        titleKey: 'careCircle.dashboard.sections.tasks.title',
        subtitleKey: 'figma.explore.items.tasks',
        color: FigmaCategory.blue,
        Icon: Check,
      },
      {
        id: 'appointments',
        route: '/appointments',
        titleKey: 'careCircle.dashboard.sections.appointments.title',
        subtitleKey: 'figma.explore.items.appointments',
        color: FigmaCategory.purple,
        Icon: Calendar,
      },
      {
        id: 'visits',
        route: '/visits',
        titleKey: 'careCircle.dashboard.sections.visits.title',
        subtitleKey: 'figma.explore.items.visits',
        color: FigmaCategory.gold,
        Icon: Users,
      },
    ],
  },
  {
    id: 'healthFollowup',
    titleKey: 'figma.explore.groups.healthFollowup',
    items: [
      {
        id: 'vitals',
        route: '/vitals',
        titleKey: 'careCircle.dashboard.sections.vitals.title',
        subtitleKey: 'figma.explore.items.vitals',
        color: FigmaCategory.blue,
        Icon: Activity,
      },
      {
        id: 'dailyLogs',
        route: '/daily-logs',
        titleKey: 'careCircle.dashboard.sections.dailyLogs.title',
        subtitleKey: 'figma.explore.items.dailyLogs',
        color: FigmaCategory.green,
        Icon: FileText,
      },
      {
        id: 'doctors',
        route: '/doctors',
        titleKey: 'careCircle.dashboard.sections.doctors.title',
        subtitleKey: 'figma.explore.items.doctors',
        color: FigmaCategory.gold,
        Icon: Stethoscope,
      },
      {
        id: 'emergency',
        route: '/emergency-card',
        titleKey: 'careCircle.dashboard.sections.emergency.title',
        subtitleKey: 'figma.explore.items.emergency',
        color: FigmaColors.dark.error,
        Icon: AlertCircle,
      },
    ],
  },
  {
    id: 'careCircle',
    titleKey: 'figma.explore.groups.careCircle',
    items: [
      {
        id: 'members',
        route: '/circle-members',
        titleKey: 'circleMembers.title',
        subtitleKey: 'figma.explore.items.members',
        color: FigmaCategory.purple,
        Icon: Users,
      },
      {
        id: 'recipientProfile',
        route: '/recipient-profile',
        titleKey: 'recipientProfile.title',
        subtitleKey: 'figma.explore.items.recipientProfile',
        color: FigmaCategory.teal,
        Icon: HeartPulse,
      },
    ],
  },
];

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  return (
    <FigmaScreen gap={24}>
      {/* Title header (no back / add) */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {t('figma.explore.title')}
        </Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>{t('figma.explore.subtitle')}</Text>
      </View>

      {/* Grouped section lists */}
      {SECTIONS.map((section) => (
        <View key={section.id}>
          <FigmaSectionLabel label={t(section.titleKey)} />
          <FigmaCard tone="card" radius={FigmaRadius.r24} padding={0}>
            {section.items.map((item, i) => (
              <FigmaListRow
                key={item.id}
                Icon={item.Icon}
                color={item.color}
                title={t(item.titleKey)}
                subtitle={t(item.subtitleKey)}
                topDivider={i > 0}
                onPress={() => router.push(item.route as never)}
              />
            ))}
          </FigmaCard>
        </View>
      ))}
    </FigmaScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { fontSize: 26, fontFamily: FigmaFont.extrabold },
  subtitle: { fontSize: 14, fontFamily: FigmaFont.regular },
});
