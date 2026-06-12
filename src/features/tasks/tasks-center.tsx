import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ReminderNotice } from '@/features/notifications/reminder-notice';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { CareTask, TaskPriority, TaskStatus } from './api';
import { useCancelTask, useCompleteTask, useTasks } from './hooks';

/** Priority → badge tone (color + a distinct glyph, never color alone). */
const PRIORITY_TONE: Record<TaskPriority, StatusTone> = {
  low: 'neutral',
  normal: 'neutral',
  high: 'warning',
  urgent: 'error',
};

/** Done/cancelled status → badge tone. */
const DONE_TONE: Record<Exclude<TaskStatus, 'open'>, StatusTone> = {
  completed: 'success',
  cancelled: 'error',
};

function dueSortKey(task: CareTask): string {
  return `${task.due_date ?? '9999-99-99'} ${task.due_time ?? '99:99:99'}`;
}

/** Shared care tasks: today's tasks, open tasks, and a done/cancelled section. */
export function TasksCenter({
  circleId,
  canManage,
  canCollaborate,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const tasksQuery = useTasks(circleId);
  const complete = useCompleteTask(circleId);
  const cancel = useCancelTask(circleId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (tasksQuery.isLoading) return <LoadingState />;
  if (tasksQuery.isError) {
    return (
      <ErrorState
        message={t('tasks.loadError')}
        retryLabel={t('retry')}
        onRetry={() => tasksQuery.refetch()}
      />
    );
  }

  const tasks = tasksQuery.data ?? [];
  const today = todayYmd();
  const openTasks = tasks.filter((task) => task.status === 'open');
  const todayTasks = openTasks
    .filter((task) => task.due_date === today)
    .sort((a, b) => dueSortKey(a).localeCompare(dueSortKey(b)));
  const otherOpen = openTasks
    .filter((task) => task.due_date !== today)
    .sort((a, b) => dueSortKey(a).localeCompare(dueSortKey(b)));
  const doneTasks = tasks.filter((task) => task.status !== 'open');

  function canActOn(task: CareTask): boolean {
    if (task.status !== 'open') return false;
    if (canManage) return true;
    return canCollaborate && (task.assigned_to === null || task.assigned_to === userId);
  }

  async function act(task: CareTask, kind: 'complete' | 'cancel') {
    setPendingId(task.id);
    try {
      if (kind === 'complete') await complete.mutateAsync(task.id);
      else await cancel.mutateAsync(task.id);
    } finally {
      setPendingId(null);
    }
  }

  function renderRow(task: CareTask) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        mine={task.assigned_to !== null && task.assigned_to === userId}
        unassigned={task.assigned_to === null}
        canAct={canActOn(task)}
        pending={pendingId === task.id}
        onComplete={() => act(task, 'complete')}
        onCancel={() => act(task, 'cancel')}
        onOpen={() => router.push(`/tasks/${task.id}`)}
      />
    );
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {t('tasks.disclaimer')}
      </ThemedText>

      <ReminderNotice messageKey="tasks.reminderNotice" />

      {canManage ? (
        <Button label={t('tasks.add')} onPress={() => router.push('/tasks/new')} />
      ) : null}

      <Section title={t('tasks.todayTitle')}>
        {todayTasks.length === 0 ? (
          <EmptyState title={t('tasks.noTodayTitle')} subtitle={t('tasks.noTodaySubtitle')} />
        ) : (
          <View style={styles.list}>{todayTasks.map(renderRow)}</View>
        )}
      </Section>

      <Section title={t('tasks.openTitle')}>
        {otherOpen.length === 0 ? (
          <EmptyState
            title={t('tasks.noOpenTitle')}
            subtitle={canManage ? t('tasks.noOpenSubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{otherOpen.map(renderRow)}</View>
        )}
      </Section>

      {doneTasks.length > 0 ? (
        <Section title={t('tasks.doneTitle')}>
          <View style={styles.list}>{doneTasks.map(renderRow)}</View>
        </Section>
      ) : null}
    </Screen>
  );
}

function TaskRow({
  task,
  mine,
  unassigned,
  canAct,
  pending,
  onComplete,
  onCancel,
  onOpen,
}: {
  task: CareTask;
  mine: boolean;
  unassigned: boolean;
  canAct: boolean;
  pending: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  const meta = [t(`tasks.category.${task.category}`)];
  if (task.due_date) {
    const due = task.due_time ? `${task.due_date} ${formatHm(task.due_time)}` : task.due_date;
    meta.push(`${t('tasks.dueLabel')}: ${due}`);
  }
  const assignText = mine
    ? t('tasks.assignedToMe')
    : unassigned
      ? t('tasks.unassigned')
      : t('tasks.assignedToMember');
  const showPriority = task.priority === 'high' || task.priority === 'urgent';

  return (
    <Surface style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="cardTitle" style={styles.cardTitle}>
          {task.title}
        </ThemedText>
        {showPriority ? (
          <StatusBadge
            tone={PRIORITY_TONE[task.priority]}
            label={t(`tasks.priority.${task.priority}`)}
          />
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {meta.join(' • ')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {assignText}
      </ThemedText>

      {task.status !== 'open' ? (
        <StatusBadge tone={DONE_TONE[task.status]} label={t(`tasks.status.${task.status}`)} />
      ) : null}

      <View style={styles.actions}>
        {canAct ? (
          <>
            <Button
              size="sm"
              label={t('tasks.complete')}
              disabled={pending}
              onPress={onComplete}
            />
            <Button
              size="sm"
              variant="secondary"
              label={t('tasks.cancelTask')}
              disabled={pending}
              onPress={onCancel}
            />
          </>
        ) : null}
        <Button size="sm" variant="secondary" label={t('common.details')} onPress={onOpen} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  card: { gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
