import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NavCard } from '@/components/nav-card';
import { Glyph } from '@/constants/glyphs';

import { useTodayTaskSummary } from './hooks';

/** Navigable tasks card on the dashboard, showing today's task counts. */
export function TasksCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { summary, isLoading } = useTodayTaskSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.tasks.subtitle')
    : summary.dueToday === 0 && summary.completedToday === 0
      ? t('tasks.summary.none')
      : t('tasks.summary.counts', { due: summary.dueToday, done: summary.completedToday });

  return (
    <NavCard
      glyph={Glyph.task}
      title={t('careCircle.dashboard.sections.tasks.title')}
      subtitle={subtitle}
      onPress={() => router.push('/tasks')}
    />
  );
}
