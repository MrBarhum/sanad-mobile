import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DashboardTile } from '@/components/dashboard-tile';

import { useTodayVitalSummary } from './hooks';

/** Navigable vitals tile on the dashboard: today's count + total readings. */
export function VitalsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayVitalSummary(circleId);

  const meta = isLoading
    ? t('careCircle.dashboard.sections.vitals.subtitle')
    : summary.totalCount === 0
      ? t('vitals.summary.none')
      : t('vitals.summary.counts', { today: summary.todayCount, total: summary.totalCount });

  return (
    <DashboardTile
      iconName="vital"
      title={t('careCircle.dashboard.sections.vitals.title')}
      meta={meta}
      onPress={() => router.push('/vitals')}
    />
  );
}
