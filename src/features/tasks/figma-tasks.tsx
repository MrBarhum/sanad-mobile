import { useRouter } from 'expo-router';
import { Check, Clock, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSegmentedTabs } from '@/components/figma/figma-segmented-tabs';
import {
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { CareTask } from './api';
import { useCancelTask, useCompleteTask, useTasks } from './hooks';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type TaskTab = 'today' | 'open' | 'done';

/** Sort key mirroring the center: due date, then due time, missing last. */
function dueSortKey(task: CareTask): string {
  return `${task.due_date ?? '9999-99-99'} ${task.due_time ?? '99:99:99'}`;
}

/**
 * The Figma Make Tasks screen, recreated as literally as possible in React Native
 * and wired to real Sanad data. Mirrors `TasksScreen.tsx`: a back/title/teal-"+"
 * header, a today/open/done segmented control, and a hairline-separated card of
 * task rows — round complete checkbox, title (strikethrough when done), note,
 * due time, assignee, and an X to cancel open tasks. Reuses the `TasksCenter`
 * hooks, filter logic, and permission gating verbatim. Cairo + Figma tokens, RTL.
 * No old Sanad Screen/Surface/Section/Button/StatusBadge.
 */
export function FigmaTasks({
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
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lookup = useMemberLookup(circleId);

  const tasksQuery = useTasks(circleId);
  const complete = useCompleteTask(circleId);
  const cancel = useCancelTask(circleId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TaskTab>('today');

  const tasks = tasksQuery.data ?? [];
  const today = todayYmd();
  const openTasks = tasks.filter((task) => task.status === 'open');
  // Filter logic mirrors the center: today = open & due today; open = all open;
  // done = completed/cancelled. Sorted by due date/time like the center.
  const filtered = (
    tab === 'today'
      ? openTasks.filter((task) => task.due_date === today)
      : tab === 'open'
        ? openTasks
        : tasks.filter((task) => task.status !== 'open')
  ).sort((a, b) => dueSortKey(a).localeCompare(dueSortKey(b)));

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

  const tabs: { key: TaskTab; label: string }[] = [
    { key: 'today', label: t('figma.tasks.tabs.today') },
    { key: 'open', label: t('figma.tasks.tabs.open') },
    { key: 'done', label: t('figma.tasks.tabs.done') },
  ];

  return (
    <FigmaScreen>
      <FigmaHeader
        title={t('figma.tasks.title')}
        onAdd={canManage ? () => router.push('/tasks/new') : undefined}
        addAccessibilityLabel={t('tasks.add')}
      />

      <FigmaSegmentedTabs tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as TaskTab)} />

      {tasksQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : tasksQuery.isError ? (
        <FigmaCard tone="card" radius={FigmaRadius.r16}>
          <Text style={[styles.errorText, { color: c.error }]}>{t('tasks.loadError')}</Text>
          <Pressable
            onPress={() => tasksQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </FigmaCard>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Check size={40} color={c.muted} strokeWidth={1} />
          <Text style={[styles.emptyText, { color: c.muted }]}>{t('figma.tasks.empty')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              scheme={scheme}
              mine={task.assigned_to !== null && task.assigned_to === userId}
              unassigned={task.assigned_to === null}
              assigneeName={
                task.assigned_to && task.assigned_to !== userId
                  ? (lookup(task.assigned_to)?.label ?? null)
                  : null
              }
              canAct={canActOn(task)}
              pending={pendingId === task.id}
              onComplete={() => act(task, 'complete')}
              onCancel={() => act(task, 'cancel')}
              onOpen={() => router.push(`/tasks/${task.id}`)}
            />
          ))}
        </View>
      )}
    </FigmaScreen>
  );
}

function TaskRow({
  task,
  scheme,
  mine,
  unassigned,
  assigneeName,
  canAct,
  pending,
  onComplete,
  onCancel,
  onOpen,
}: {
  task: CareTask;
  scheme: FigmaScheme;
  mine: boolean;
  unassigned: boolean;
  assigneeName: string | null;
  canAct: boolean;
  pending: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];

  const isDone = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const note = task.description?.trim() || null;
  // Due shown as the Figma "Clock · time/date" meta; LTR-isolated.
  const due = task.due_date
    ? task.due_time
      ? `${task.due_date} ${formatHm(task.due_time)}`
      : task.due_date
    : null;
  const assignText = mine
    ? t('tasks.assignedToMe')
    : unassigned
      ? t('tasks.unassigned')
      : (assigneeName ?? t('tasks.assignedToMember'));

  // Checkbox: done = success tint + check; open = hairline outline; cancelled = X.
  const checkColor = isDone ? c.success : isCancelled ? c.error : c.muted;
  const checkBg = isDone
    ? withAlpha(c.success, 0.12)
    : isCancelled
      ? withAlpha(c.error, 0.12)
      : 'transparent';
  const CheckIcon: IconCmp | null = isDone ? Check : isCancelled ? X : null;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityHint={t('common.details')}
      style={[
        styles.row,
        { backgroundColor: c.card, borderColor: c.border },
        isCancelled && styles.rowDim,
      ]}>
      <Pressable
        onPress={canAct ? onComplete : undefined}
        disabled={!canAct || pending}
        accessibilityRole={canAct ? 'button' : undefined}
        accessibilityLabel={canAct ? t('tasks.complete') : undefined}
        style={[
          styles.checkbox,
          { borderColor: isDone ? c.success : c.border, backgroundColor: checkBg },
        ]}>
        {CheckIcon ? <CheckIcon size={14} color={checkColor} /> : null}
      </Pressable>

      <View style={styles.info}>
        <Text
          style={[
            styles.title,
            { color: c.text },
            isDone && { textDecorationLine: 'line-through', opacity: 0.6 },
          ]}
          numberOfLines={2}>
          {task.title}
        </Text>
        {note ? (
          <Text style={[styles.note, { color: c.muted }]} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {due ? (
            <>
              <Clock size={12} color={c.muted} />
              <Text style={[styles.metaText, { color: c.muted }]}>{isolateLtr(due)}</Text>
            </>
          ) : null}
          {due ? <Text style={[styles.metaText, { color: c.muted }]}>·</Text> : null}
          <Text style={[styles.metaText, { color: c.primary }]}>{assignText}</Text>
        </View>
      </View>

      {task.status === 'open' && canAct ? (
        <Pressable
          onPress={onCancel}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.cancelTask')}
          style={[styles.cancelBtn, pending && styles.rowDim]}>
          <X size={18} color={c.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, fontFamily: FigmaFont.medium, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: FigmaRadius.r12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 13, fontFamily: FigmaFont.semibold },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: FigmaFont.medium },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowDim: { opacity: 0.5 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: FigmaRadius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontFamily: FigmaFont.semibold },
  note: { fontSize: 12, fontFamily: FigmaFont.regular },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaText: { fontSize: 12, fontFamily: FigmaFont.regular },
  cancelBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
