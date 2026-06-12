import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ReminderNotice } from '@/features/notifications/reminder-notice';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { CareTask, TaskPriority, TaskStatus } from './api';
import { useCancelTask, useCompleteTask, useTasks } from './hooks';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#60646C',
  normal: '#60646C',
  high: '#d97706',
  urgent: '#dc2626',
};

const DONE_COLORS: Record<Exclude<TaskStatus, 'open'>, string> = {
  completed: '#16a34a',
  cancelled: '#dc2626',
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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('tasks.disclaimer')}
        </ThemedText>

        <ReminderNotice messageKey="tasks.reminderNotice" />

        {canManage ? (
          <Button label={t('tasks.add')} onPress={() => router.push('/tasks/new')} />
        ) : null}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('tasks.todayTitle')}
        </ThemedText>
        {todayTasks.length === 0 ? (
          <EmptyState title={t('tasks.noTodayTitle')} subtitle={t('tasks.noTodaySubtitle')} />
        ) : (
          <View style={styles.list}>{todayTasks.map(renderRow)}</View>
        )}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('tasks.openTitle')}
        </ThemedText>
        {otherOpen.length === 0 ? (
          <EmptyState
            title={t('tasks.noOpenTitle')}
            subtitle={canManage ? t('tasks.noOpenSubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{otherOpen.map(renderRow)}</View>
        )}

        {doneTasks.length > 0 ? (
          <>
            <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
              {t('tasks.doneTitle')}
            </ThemedText>
            <View style={styles.list}>{doneTasks.map(renderRow)}</View>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
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
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{task.title}</ThemedText>
        {showPriority ? (
          <View style={[styles.badge, { borderColor: PRIORITY_COLORS[task.priority] }]}>
            <ThemedText type="small" style={{ color: PRIORITY_COLORS[task.priority] }}>
              {t(`tasks.priority.${task.priority}`)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {meta.join(' • ')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {assignText}
      </ThemedText>

      {task.status !== 'open' ? (
        <View style={[styles.badge, { borderColor: DONE_COLORS[task.status] }]}>
          <ThemedText type="small" style={{ color: DONE_COLORS[task.status] }}>
            {t(`tasks.status.${task.status}`)}
          </ThemedText>
        </View>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sectionTitle: { fontSize: 22, lineHeight: 30, marginTop: Spacing.two },
  list: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  badge: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    alignSelf: 'flex-start',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
