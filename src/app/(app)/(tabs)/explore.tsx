import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FigmaTabBand } from '@/components/figma/figma-header';
import { FigmaListRow } from '@/components/figma/figma-list-row';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { type GlyphChipTone } from '@/components/glyph-chip';
import { type IconName } from '@/constants/icons';
import { Radius } from '@/constants/theme';

type ExploreItem = {
  id: string;
  route: string;
  titleKey: string;
  subtitleKey: string;
  tone: GlyphChipTone;
  iconName: IconName;
};

type ExploreSection = {
  id: string;
  titleKey: string;
  items: ExploreItem[];
};

/**
 * The Dar "Explore" screen (frame 8a): a green tab-band header over three grouped
 * section cards. Each section = a `SectionHeader` (10×10 square + 16/800 title) +
 * a Surface holding 2px-separated `FigmaListRow`s — a 40dp toned icon square +
 * title + a describing subtitle + a back chevron that routes to the real feature
 * center (each resolves the active circle through its own CircleGate). A static
 * navigation index — no fabricated counts. Cairo + Dar tokens, both themes, RTL.
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
        tone: 'primary',
        iconName: 'medication',
      },
      {
        id: 'tasks',
        route: '/tasks',
        titleKey: 'careCircle.dashboard.sections.tasks.title',
        subtitleKey: 'figma.explore.items.tasks',
        tone: 'success',
        iconName: 'task',
      },
      {
        id: 'appointments',
        route: '/appointments',
        titleKey: 'careCircle.dashboard.sections.appointments.title',
        subtitleKey: 'figma.explore.items.appointments',
        tone: 'primary',
        iconName: 'appointment',
      },
      {
        id: 'visits',
        route: '/visits',
        titleKey: 'careCircle.dashboard.sections.visits.title',
        subtitleKey: 'figma.explore.items.visits',
        tone: 'warning',
        iconName: 'visit',
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
        tone: 'success',
        iconName: 'vital',
      },
      {
        id: 'dailyLogs',
        route: '/daily-logs',
        titleKey: 'careCircle.dashboard.sections.dailyLogs.title',
        subtitleKey: 'figma.explore.items.dailyLogs',
        tone: 'primary',
        iconName: 'dailyLog',
      },
      {
        id: 'doctors',
        route: '/doctors',
        titleKey: 'careCircle.dashboard.sections.doctors.title',
        subtitleKey: 'figma.explore.items.doctors',
        tone: 'warning',
        iconName: 'doctor',
      },
      {
        id: 'emergency',
        route: '/emergency-card',
        titleKey: 'careCircle.dashboard.sections.emergency.title',
        subtitleKey: 'figma.explore.items.emergency',
        tone: 'error',
        iconName: 'emergency',
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
        tone: 'success',
        iconName: 'activity',
      },
      {
        id: 'members',
        route: '/circle-members',
        titleKey: 'circleMembers.title',
        subtitleKey: 'figma.explore.items.members',
        tone: 'primary',
        iconName: 'member',
      },
      {
        id: 'recipientProfile',
        route: '/recipient-profile',
        titleKey: 'recipientProfile.title',
        subtitleKey: 'figma.explore.items.recipientProfile',
        tone: 'warning',
        iconName: 'profile',
      },
    ],
  },
];

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <FigmaScreen
      band={<FigmaTabBand title={t('figma.explore.title')} subtitle={t('figma.explore.subtitle')} />}
      contentGutter={14}
      gap={16}>
      {SECTIONS.map((section) => (
        <View key={section.id} style={{ gap: 8 }}>
          <SectionHeader title={t(section.titleKey)} />
          <Surface tone="card" radius={Radius.card} padded={0}>
            {section.items.map((item, i) => (
              <FigmaListRow
                key={item.id}
                iconName={item.iconName}
                tone={item.tone}
                title={t(item.titleKey)}
                subtitle={t(item.subtitleKey)}
                topDivider={i > 0}
                onPress={() => router.push(item.route as never)}
              />
            ))}
          </Surface>
        </View>
      ))}
    </FigmaScreen>
  );
}
