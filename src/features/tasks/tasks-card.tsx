import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { StatTile } from '@/components/dashboard-tile';

import { useTodayTaskSummary } from './hooks';

/**
 * Compact "today summary" stat for Home: tasks still due today. A small secondary
 * tile (not a hero), navigating into the tasks center.
 */
export function TasksCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayTaskSummary(circleId);

  return (
    <StatTile
      iconName="task"
      value={isLoading ? '—' : String(summary.dueToday)}
      label={t('careCircle.dashboard.today.tasksLabel')}
      onPress={() => router.push('/tasks')}
      accessibilityHint={t('careCircle.dashboard.sections.tasks.title')}
    />
  );
}
