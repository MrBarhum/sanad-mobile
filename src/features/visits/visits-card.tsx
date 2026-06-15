import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NavCard } from '@/components/nav-card';

import { useTodayVisitSummary } from './hooks';

/** Navigable family-visits card on the dashboard, showing today's count. */
export function VisitsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { count, isLoading } = useTodayVisitSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.visits.subtitle')
    : count === 0
      ? t('visits.summary.none')
      : t('visits.summary.count', { count });

  return (
    <NavCard
      iconName="visit"
      title={t('careCircle.dashboard.sections.visits.title')}
      subtitle={subtitle}
      onPress={() => router.push('/visits')}
    />
  );
}
