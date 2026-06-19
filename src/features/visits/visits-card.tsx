import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DashboardTile } from '@/components/dashboard-tile';

import { useTodayVisitSummary } from './hooks';

/** Navigable family-visits tile on the dashboard, showing today's count. */
export function VisitsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { count, isLoading } = useTodayVisitSummary(circleId);

  const meta = isLoading
    ? t('careCircle.dashboard.sections.visits.subtitle')
    : count === 0
      ? t('visits.summary.none')
      : t('visits.summary.count', { count });

  return (
    <DashboardTile
      iconName="visit"
      title={t('careCircle.dashboard.sections.visits.title')}
      meta={meta}
      onPress={() => router.push('/visits')}
    />
  );
}
