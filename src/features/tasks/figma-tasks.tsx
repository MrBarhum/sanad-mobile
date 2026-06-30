import { useRouter } from 'expo-router';
import { Check, Clock, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { FigmaButton } from '@/components/figma/figma-button';
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
type QuickAction = 'complete' | 'cancel';
type QuickConfirm = { task: CareTask; kind: QuickAction };

/** Sort key mirroring the center: due date, then due time, missing last. */
function dueSortKey(task: CareTask): string {
  return `${task.due_date ?? '9999-99-99'} ${task.due_time ?? '99:99:99'}`;
}

/**
 * The Figma Make Tasks screen, recreated as literally as possible in React Native
 * and wired to real Sanad data. A back/title/teal-"+" header, a today/open/done
 * segmented control, and a hairline-separated card of task rows — round complete
 * checkbox, title (strikethrough when done), note, due time, assignee, and an X to
 * cancel open tasks. Cairo + Figma tokens, RTL.
 *
 * Role-aware visibility (UI filter only — RLS unchanged): managers (admin /
 * primary_caregiver) see and manage every task; an actionable non-manager
 * (family_member / caregiver) defaults to *their* tasks; read-only members
 * (remote_member / elder) keep the existing full read-only view with no action
 * affordances. Both row quick actions (complete / cancel) now go through a
 * confirmation sheet so a stray tap can no longer mutate a task.
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
  const [confirm, setConfirm] = useState<QuickConfirm | null>(null);
  const [acting, setActing] = useState(false);
  const [tab, setTab] = useState<TaskTab>('today');

  const tasks = tasksQuery.data ?? [];
  const today = todayYmd();

  // Actionable non-managers (family_member / caregiver) are scoped to their own
  // work so they don't default to the whole circle's task list. Managers see all;
  // read-only members (remote/elder) keep the existing full read-only view.
  const scopeToMine = !canManage && canCollaborate;

  /** A task is "mine" when it's assigned to me, or I completed it (history).
   * Unassigned tasks are manager-only this pass — a non-manager does NOT see them
   * by default (a later "available to claim" workflow may change this). */
  function isMine(task: CareTask): boolean {
    if (!userId) return false;
    if (task.assigned_to === userId) return true;
    return task.completed_by === userId;
  }

  const visible = scopeToMine ? tasks.filter(isMine) : tasks;
  const openTasks = visible.filter((task) => task.status === 'open');
  // today = open & due today; open = all open; done = completed/cancelled.
  const filtered = (
    tab === 'today'
      ? openTasks.filter((task) => task.due_date === today)
      : tab === 'open'
        ? openTasks
        : visible.filter((task) => task.status !== 'open')
  ).sort((a, b) => dueSortKey(a).localeCompare(dueSortKey(b)));

  function canActOn(task: CareTask): boolean {
    if (task.status !== 'open') return false;
    if (canManage) return true;
    // Non-managers act only on tasks assigned to them (not unassigned) this pass.
    return canCollaborate && task.assigned_to !== null && task.assigned_to === userId;
  }

  async function runConfirmed() {
    if (!confirm || acting) return;
    setActing(true);
    try {
      if (confirm.kind === 'complete') await complete.mutateAsync(confirm.task.id);
      else await cancel.mutateAsync(confirm.task.id);
      setConfirm(null);
    } catch {
      // Leave the sheet open so the user can retry; the row stays unchanged.
    } finally {
      setActing(false);
    }
  }

  const tabs: { key: TaskTab; label: string }[] = [
    { key: 'today', label: t('figma.tasks.tabs.today') },
    { key: 'open', label: t('figma.tasks.tabs.open') },
    { key: 'done', label: t('figma.tasks.tabs.done') },
  ];

  return (
    <>
      <FigmaScreen>
        <FigmaHeader
          title={t('figma.tasks.title')}
          onAdd={canManage ? () => router.push('/tasks/new') : undefined}
          addAccessibilityLabel={t('tasks.add')}
        />

        <FigmaSegmentedTabs tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as TaskTab)} />

        {scopeToMine ? (
          <Text style={[styles.scopeNote, { color: c.muted }]}>{t('figma.tasks.scopeNote')}</Text>
        ) : null}

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
            <Text style={[styles.emptyText, { color: c.muted }]}>
              {t(scopeToMine ? 'figma.tasks.emptyMine' : 'figma.tasks.empty')}
            </Text>
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
                onComplete={() => setConfirm({ task, kind: 'complete' })}
                onCancel={() => setConfirm({ task, kind: 'cancel' })}
                onOpen={() => router.push(`/tasks/${task.id}`)}
              />
            ))}
          </View>
        )}
      </FigmaScreen>

      <TaskConfirmSheet
        confirm={confirm}
        scheme={scheme}
        pending={acting}
        onConfirm={runConfirmed}
        onClose={() => {
          if (!acting) setConfirm(null);
        }}
      />
    </>
  );
}

/**
 * Confirmation sheet for a row quick action. Completing shows a teal "تم الإنجاز"
 * CTA; marking a task as not completed shows a clear danger CTA — never an instant,
 * unconfirmed mutation. A retained snapshot keeps the correct copy during the
 * slide-out animation after `confirm` clears.
 */
function TaskConfirmSheet({
  confirm,
  scheme,
  pending,
  onConfirm,
  onClose,
}: {
  confirm: QuickConfirm | null;
  scheme: FigmaScheme;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];
  const [shown, setShown] = useState<QuickConfirm | null>(confirm);

  useEffect(() => {
    if (confirm) setShown(confirm);
  }, [confirm]);

  const isComplete = shown?.kind === 'complete';

  return (
    <FigmaBottomSheet
      visible={confirm !== null}
      onClose={onClose}
      title={t(isComplete ? 'tasks.confirmCompleteTitle' : 'tasks.confirmUnableTitle')}>
      <Text style={[styles.confirmBody, { color: c.muted }]}>
        {t(isComplete ? 'tasks.confirmCompleteBody' : 'tasks.confirmUnableBody')}
      </Text>
      <Text style={[styles.confirmTask, { color: c.text }]} numberOfLines={3}>
        {shown?.task.title}
      </Text>
      <FigmaButton
        label={t(isComplete ? 'tasks.markComplete' : 'tasks.markUnable')}
        variant={isComplete ? 'primary' : 'danger'}
        loading={pending}
        onPress={onConfirm}
      />
      <FigmaButton
        label={t('common.cancel')}
        variant="secondary"
        disabled={pending}
        onPress={onClose}
      />
    </FigmaBottomSheet>
  );
}

function TaskRow({
  task,
  scheme,
  mine,
  unassigned,
  assigneeName,
  canAct,
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
  const checkboxStyle = [
    styles.checkbox,
    { borderColor: isDone ? c.success : c.border, backgroundColor: checkBg },
  ];

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
      {canAct ? (
        // Quick-complete affordance — opens a confirmation sheet (never an instant
        // mutation). Only rendered when the current user can actually act.
        <Pressable
          onPress={onComplete}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.complete')}
          accessibilityHint={t('tasks.confirmCompleteTitle')}
          style={checkboxStyle}>
          {CheckIcon ? <CheckIcon size={14} color={checkColor} /> : null}
        </Pressable>
      ) : (
        // Not actionable: a non-interactive status dot. `pointerEvents="none"` lets
        // the tap fall through to the row so it opens detail (never a silent no-op).
        <View style={checkboxStyle} pointerEvents="none">
          {CheckIcon ? <CheckIcon size={14} color={checkColor} /> : null}
        </View>
      )}

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
          accessibilityRole="button"
          accessibilityLabel={t('tasks.markUnable')}
          accessibilityHint={t('tasks.confirmUnableTitle')}
          style={styles.cancelBtn}>
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
  scopeNote: { fontSize: 12, lineHeight: 18, fontFamily: FigmaFont.regular },
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
  confirmBody: { fontSize: 14, lineHeight: 20, fontFamily: FigmaFont.regular },
  confirmTask: { fontSize: 16, lineHeight: 24, fontFamily: FigmaFont.semibold },
});
