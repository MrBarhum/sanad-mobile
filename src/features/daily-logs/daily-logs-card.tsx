import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NavCard } from '@/components/nav-card';

import { useTodayLogSummary } from './hooks';

/** Navigable daily-logs card on the dashboard: today's log count + latest mood. */
export function DailyLogsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayLogSummary(circleId);

  const subtitle = isLoading
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
    <NavCard
      glyph="âœŽ"
      title={t('careCircle.dashboard.sections.dailyLogs.title')}
      subtitle={subtitle}
      onPress={() => router.push('/daily-logs')}
    />
  );
}
