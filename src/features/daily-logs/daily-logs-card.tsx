import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DashboardTile } from '@/components/dashboard-tile';

import { useTodayLogSummary } from './hooks';

/** Navigable daily-logs tile on the dashboard: today's log count + latest mood. */
export function DailyLogsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayLogSummary(circleId);

  const meta = isLoading
    ? t('careCircle.dashboard.sections.dailyLogs.subtitle')
    : summary.todayCount === 0
      ? t('dailyLogs.summary.none')
      : summary.latestMood
        ? t('dailyLogs.summary.countsMood', {
            count: summary.todayCount,
            mood: t(`dailyLogs.mood.${summary.latestMood}`),
          })
        : t('dailyLogs.summary.counts', { count: summary.todayCount });

  return (
    <DashboardTile
      iconName="dailyLog"
      title={t('careCircle.dashboard.sections.dailyLogs.title')}
      meta={meta}
      onPress={() => router.push('/daily-logs')}
    />
  );
}
