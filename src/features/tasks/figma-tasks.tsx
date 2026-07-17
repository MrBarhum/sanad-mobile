import { useRouter } from 'expo-router';
import { Check, Clock, HandHelping, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SkeletonList } from '@/components/skeleton';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { Button } from '@/components/button';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSegmentedTabs } from '@/components/figma/figma-segmented-tabs';
import { isolateLtr } from '@/components/ltr-text';
import { Surface } from '@/components/surface';
import { FontFamily, Radius, withAlpha } from '@/constants/theme';
import { useClaimTask } from '@/features/claiming/hooks';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { confirmAction } from '@/utils/confirm';
import { formatHm, todayYmd } from '@/utils/date';

import type { CareTask } from './api';
import { useCancelTask, useCompleteTask, useTasks } from './hooks';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type TaskTab = 'today' | 'open' | 'done';
type TaskScope = 'mine' | 'all';
type QuickAction = 'complete' | 'cancel';
type QuickConfirm = { task: CareTask; kind: QuickAction };
/** Non-blocking claim result surfaced in a bottom sheet (race / failure only). */
type ClaimNote = { tone: 'warning' | 'error'; title: string; body: string | null };

/** Sort key mirroring the center: due date, then due time, missing last. */
function dueSortKey(task: CareTask): string {
  return `${task.due_date ?? '9999-99-99'} ${task.due_time ?? '99:99:99'}`;
}

/** Priority → weight (urgent surfaces first). Unknown priorities sort as normal. */
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/**
 * Open-task ordering (A7): overdue first, then by priority (urgent → low), then
 * chronological by due date/time. Surfaces what needs attention now instead of a
 * flat date sort that buries an urgent, overdue task under earlier calm ones.
 */
function compareOpenTasks(a: CareTask, b: CareTask, today: string): number {
  const aOverdue = a.due_date && a.due_date < today ? 0 : 1;
  const bOverdue = b.due_date && b.due_date < today ? 0 : 1;
  if (aOverdue !== bOverdue) return aOverdue - bOverdue;
  const aPriority = PRIORITY_WEIGHT[a.priority] ?? 2;
  const bPriority = PRIORITY_WEIGHT[b.priority] ?? 2;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return dueSortKey(a).localeCompare(dueSortKey(b));
}

/**
 * The Figma Make Tasks screen, recreated as literally as possible in React Native
 * and wired to real Sanad data. A back/title/teal-"+" header, a today/open/done
 * segmented control, and a hairline-separated card of task rows — round complete
 * checkbox, title (strikethrough when done), note, due time, assignee, and an X to
 * cancel open tasks. IBM Plex + theme tokens, RTL.
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
  const c = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lookup = useMemberLookup(circleId);

  const tasksQuery = useTasks(circleId);
  const complete = useCompleteTask(circleId);
  const cancel = useCancelTask(circleId);
  const claim = useClaimTask();
  const [confirm, setConfirm] = useState<QuickConfirm | null>(null);
  const [acting, setActing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimNote, setClaimNote] = useState<ClaimNote | null>(null);
  const [tab, setTab] = useState<TaskTab>('today');

  const tasks = tasksQuery.data ?? [];
  const today = todayYmd();

  // Transparent-circle visibility: every active member can SEE the whole circle's
  // tasks (mirrors the server `can_view_all_operational` posture). Instead of
  // hiding others' work from non-managers, we offer an explicit «مهامي» / «كل
  // المهام» scope toggle. Anyone who can be assigned work (managers + collaborators)
  // gets the toggle and defaults to their own tasks; managers default to «all»;
  // pure followers (remote/elder) have no "mine" set, so they only ever see «all».
  const canBeAssigned = canManage || canCollaborate;
  const canClaim = canManage || canCollaborate;
  const [scope, setScope] = useState<TaskScope>(canManage ? 'all' : 'mine');
  const effectiveScope: TaskScope = canBeAssigned ? scope : 'all';

  /** A task is "mine" when it's assigned to me, or I completed it (history). */
  function isMine(task: CareTask): boolean {
    if (!userId) return false;
    if (task.assigned_to === userId) return true;
    return task.completed_by === userId;
  }

  const visible = effectiveScope === 'mine' ? tasks.filter(isMine) : tasks;
  const openTasks = visible.filter((task) => task.status === 'open');
  // today = open & due today; open = all open; done = completed/cancelled.
  // Open tabs use the priority-aware sort (urgent/overdue first); the done tab
  // stays chronological.
  const filtered =
    tab === 'done'
      ? visible
          .filter((task) => task.status !== 'open')
          .sort((a, b) => dueSortKey(a).localeCompare(dueSortKey(b)))
      : (tab === 'today'
          ? openTasks.filter((task) => task.due_date === today)
          : openTasks
        ).sort((a, b) => compareOpenTasks(a, b, today));

  function canActOn(task: CareTask): boolean {
    if (task.status !== 'open') return false;
    if (canManage) return true;
    // Non-managers act only on tasks assigned to them (not unassigned) this pass.
    return canCollaborate && task.assigned_to !== null && task.assigned_to === userId;
  }

  function onClaim(task: CareTask) {
    if (claimingId) return;
    // Taking responsibility is a real commitment — confirm before the one tap
    // assigns the task to me (A4).
    confirmAction(
      {
        title: t('claiming.confirmTitle'),
        message: t('claiming.confirmMessage', { title: task.title }),
        confirm: t('claiming.cta'),
        cancel: t('common.cancel'),
      },
      () => {
        void runClaim(task);
      },
    );
  }

  async function runClaim(task: CareTask) {
    setClaimingId(task.id);
    setClaimNote(null);
    try {
      await claim.mutateAsync(task.id);
      // Success needs no sheet — the row re-renders as "assigned to me" (or moves
      // into «مهامي») once the tasks query invalidates.
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === '23505') {
        setClaimNote({
          tone: 'warning',
          title: t('claiming.alreadyClaimed'),
          body: t('claiming.alreadyClaimedBody'),
        });
      } else {
        setClaimNote({ tone: 'error', title: t('claiming.claimFailed'), body: null });
      }
    } finally {
      setClaimingId(null);
    }
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

  const scopeTabs: { key: TaskScope; label: string }[] = [
    { key: 'mine', label: t('figma.tasks.scope.mine') },
    { key: 'all', label: t('figma.tasks.scope.all') },
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

        {/* «مهامي / كل المهام» — an explicit scope choice replaces the old implicit
            role-based filter, so every member can reach the full circle list. */}
        {canBeAssigned ? (
          <View style={styles.scopeRow}>
            <FigmaSegmentedTabs
              tabs={scopeTabs}
              activeKey={effectiveScope}
              onChange={(key) => setScope(key as TaskScope)}
            />
          </View>
        ) : null}

        {tasksQuery.isLoading ? (
          <SkeletonList />
        ) : tasksQuery.isError ? (
          <Surface tone="card" radius={Radius.lg} padded={20}>
            <Text style={[styles.errorText, { color: c.errorFg }]}>{t('tasks.loadError')}</Text>
            <Pressable
              onPress={() => tasksQuery.refetch()}
              accessibilityRole="button"
              style={[styles.retry, { backgroundColor: c.primary }]}>
              <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
            </Pressable>
          </Surface>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Check size={40} color={c.textSecondary} strokeWidth={1} />
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>
              {t(effectiveScope === 'mine' ? 'figma.tasks.emptyMine' : 'figma.tasks.empty')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                mine={task.assigned_to !== null && task.assigned_to === userId}
                unassigned={task.assigned_to === null}
                assigneeName={
                  task.assigned_to && task.assigned_to !== userId
                    ? (lookup(task.assigned_to)?.label ?? null)
                    : null
                }
                canAct={canActOn(task)}
                canClaim={canClaim}
                claiming={claimingId === task.id}
                onClaim={() => onClaim(task)}
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
        pending={acting}
        onConfirm={runConfirmed}
        onClose={() => {
          if (!acting) setConfirm(null);
        }}
      />

      <ClaimNoteSheet note={claimNote} onClose={() => setClaimNote(null)} />
    </>
  );
}

/**
 * Bottom-anchored notice for a failed / raced inline claim (a successful claim
 * needs none — the row simply becomes "assigned to me"). Status is icon + text +
 * color and announced as an alert, matching the claim-feed feedback sheet.
 */
function ClaimNoteSheet({
  note,
  onClose,
}: {
  note: ClaimNote | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const color = note?.tone === 'warning' ? c.warningFg : c.errorFg;

  return (
    <FigmaBottomSheet visible={note !== null} onClose={onClose} title={note?.title ?? ''}>
      {note?.body ? (
        <Text
          style={[styles.confirmBody, { color: c.textSecondary }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive">
          {note.body}
        </Text>
      ) : null}
      <Button label={t('common.ok')} variant="secondary" onPress={onClose} />
    </FigmaBottomSheet>
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
  pending,
  onConfirm,
  onClose,
}: {
  confirm: QuickConfirm | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
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
      <Text style={[styles.confirmBody, { color: c.textSecondary }]}>
        {t(isComplete ? 'tasks.confirmCompleteBody' : 'tasks.confirmUnableBody')}
      </Text>
      <Text style={[styles.confirmTask, { color: c.text }]} numberOfLines={3}>
        {shown?.task.title}
      </Text>
      <Button
        label={t(isComplete ? 'tasks.markComplete' : 'tasks.markUnable')}
        variant={isComplete ? 'primary' : 'danger'}
        loading={pending}
        onPress={onConfirm}
      />
      <Button
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
  mine,
  unassigned,
  assigneeName,
  canAct,
  canClaim,
  claiming,
  onClaim,
  onComplete,
  onCancel,
  onOpen,
}: {
  task: CareTask;
  mine: boolean;
  unassigned: boolean;
  assigneeName: string | null;
  canAct: boolean;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  // An unassigned open task can be picked up inline by any claim-capable member.
  const showClaim = canClaim && unassigned && task.status === 'open';

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
  const checkColor = isDone ? c.successFg : isCancelled ? c.errorFg : c.textSecondary;
  const checkBg = isDone
    ? withAlpha(c.successFg, 0.12)
    : isCancelled
      ? withAlpha(c.errorFg, 0.12)
      : 'transparent';
  const CheckIcon: IconCmp | null = isDone ? Check : isCancelled ? X : null;
  const checkboxStyle = [
    styles.checkbox,
    { borderColor: isDone ? c.successFg : c.border, backgroundColor: checkBg },
  ];

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityHint={t('common.details')}
      style={[
        styles.row,
        { backgroundColor: c.backgroundElement, borderColor: c.border },
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
          <Text style={[styles.note, { color: c.textSecondary }]} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {due ? (
            <>
              <Clock size={12} color={c.textSecondary} />
              <Text style={[styles.metaText, { color: c.textSecondary }]}>{isolateLtr(due)}</Text>
            </>
          ) : null}
          {due ? <Text style={[styles.metaText, { color: c.textSecondary }]}>·</Text> : null}
          <Text style={[styles.metaText, { color: c.primary }]}>{assignText}</Text>
        </View>

        {/* Inline "أنا متكفّل" — a claim-capable member takes an unassigned task
            without leaving the list. Hidden once the task has an owner. */}
        {showClaim ? (
          <Pressable
            onPress={onClaim}
            disabled={claiming}
            accessibilityRole="button"
            accessibilityLabel={t('claiming.cta')}
            accessibilityHint={t('claiming.ctaHint')}
            // Filled teal pill — the same treatment other primary inline actions use
            // (e.g. the Home dose "log" button). An outlined/tinted variant read as
            // near-invisible on the dark surface; a full-opacity fill is legible.
            style={[styles.claimBtn, { backgroundColor: c.primary }]}>
            {claiming ? (
              <ActivityIndicator size="small" color={c.onPrimary} />
            ) : (
              <>
                <HandHelping size={14} color={c.onPrimary} />
                <Text style={[styles.claimText, { color: c.onPrimary }]}>{t('claiming.cta')}</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {task.status === 'open' && canAct ? (
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.markUnable')}
          accessibilityHint={t('tasks.confirmUnableTitle')}
          style={styles.cancelBtn}>
          <X size={18} color={c.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, fontFamily: FontFamily.medium, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontFamily: FontFamily.semibold },
  scopeRow: { marginTop: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: FontFamily.medium },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowDim: { opacity: 0.5 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontFamily: FontFamily.semibold },
  note: { fontSize: 14, fontFamily: FontFamily.regular },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaText: { fontSize: 14, fontFamily: FontFamily.regular },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
  },
  claimText: { fontSize: 14, fontFamily: FontFamily.semibold },
  cancelBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  confirmBody: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular },
  confirmTask: { fontSize: 16, lineHeight: 24, fontFamily: FontFamily.semibold },
});
