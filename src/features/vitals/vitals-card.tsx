import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NavCard } from '@/components/nav-card';
import { Glyph } from '@/constants/glyphs';

import { useTodayVitalSummary } from './hooks';

/** Navigable vitals card on the dashboard: today's count + total readings. */
export function VitalsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayVitalSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.vitals.subtitle')
    : summary.totalCount === 0
      ? t('vitals.summary.none')
      : t('vitals.summary.counts', { today: summary.todayCount, total: summary.totalCount });

  return (
    <NavCard
      glyph={Glyph.vital}
      title={t('careCircle.dashboard.sections.vitals.title')}
      subtitle={subtitle}
      onPress={() => router.push('/vitals')}
    />
  );
}
