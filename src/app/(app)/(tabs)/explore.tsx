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
  Waves,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaListRow, FigmaSectionLabel } from '@/components/figma/figma-list-row';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type ExploreItem = {
  id: string;
  route: string;
  titleKey: string;
  subtitleKey: string;
  colorKey: ThemeColor;
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
 * sublabels describe each feature instead. IBM Plex + theme tokens, dark-first, RTL.
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
        colorKey: 'categoryTeal',
        Icon: Pill,
      },
      {
        id: 'tasks',
        route: '/tasks',
        titleKey: 'careCircle.dashboard.sections.tasks.title',
        subtitleKey: 'figma.explore.items.tasks',
        colorKey: 'categoryBlue',
        Icon: Check,
      },
      {
        id: 'appointments',
        route: '/appointments',
        titleKey: 'careCircle.dashboard.sections.appointments.title',
        subtitleKey: 'figma.explore.items.appointments',
        colorKey: 'categoryPurple',
        Icon: Calendar,
      },
      {
        id: 'visits',
        route: '/visits',
        titleKey: 'careCircle.dashboard.sections.visits.title',
        subtitleKey: 'figma.explore.items.visits',
        colorKey: 'categoryGold',
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
        colorKey: 'categoryBlue',
        Icon: Activity,
      },
      {
        id: 'dailyLogs',
        route: '/daily-logs',
        titleKey: 'careCircle.dashboard.sections.dailyLogs.title',
        subtitleKey: 'figma.explore.items.dailyLogs',
        colorKey: 'categoryGreen',
        Icon: FileText,
      },
      {
        id: 'doctors',
        route: '/doctors',
        titleKey: 'careCircle.dashboard.sections.doctors.title',
        subtitleKey: 'figma.explore.items.doctors',
        colorKey: 'categoryGold',
        Icon: Stethoscope,
      },
      {
        id: 'emergency',
        route: '/emergency-card',
        titleKey: 'careCircle.dashboard.sections.emergency.title',
        subtitleKey: 'figma.explore.items.emergency',
        colorKey: 'dangerSolid',
        Icon: AlertCircle,
      },
    ],
  },
  {
    id: 'careCircle',
    titleKey: 'figma.explore.groups.careCircle',
    items: [
      {
        id: 'pulse',
        route: '/pulse',
        titleKey: 'pulse.title',
        subtitleKey: 'pulse.subtitle',
        colorKey: 'categoryTeal',
        Icon: Waves,
      },
      {
        id: 'members',
        route: '/circle-members',
        titleKey: 'circleMembers.title',
        subtitleKey: 'figma.explore.items.members',
        colorKey: 'categoryPurple',
        Icon: Users,
      },
      {
        id: 'recipientProfile',
        route: '/recipient-profile',
        titleKey: 'recipientProfile.title',
        subtitleKey: 'figma.explore.items.recipientProfile',
        colorKey: 'categoryTeal',
        Icon: HeartPulse,
      },
    ],
  },
];

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();

  return (
    <FigmaScreen gap={24}>
      {/* Title header (no back / add) */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {t('figma.explore.title')}
        </Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>{t('figma.explore.subtitle')}</Text>
      </View>

      {/* Grouped section lists */}
      {SECTIONS.map((section) => (
        <View key={section.id}>
          <FigmaSectionLabel label={t(section.titleKey)} />
          <FigmaCard tone="card" radius={Radius.xl} padding={0}>
            {section.items.map((item, i) => (
              <FigmaListRow
                key={item.id}
                Icon={item.Icon}
                color={c[item.colorKey]}
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
  title: { fontSize: 26, fontFamily: FontFamily.bold },
  subtitle: { fontSize: 14, fontFamily: FontFamily.regular },
});
