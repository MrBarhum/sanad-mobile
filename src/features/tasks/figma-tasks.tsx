import { useRouter } from 'expo-router';
import { Check, ChevronRight, Clock, HandHelping, Plus, X } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { SkeletonList } from '@/components/skeleton';
import { BorderWidth, FontFamily, MaxFormWidth, Radius } from '@/constants/theme';
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

const R8 = Radius.card;
const R6 = Radius.control;

/** Sort key mirroring the center: due date, then due time, missing last. */
function dueSortKey(task: CareTask): string {
  return `${task.due_date ?? '9999-99-99'} ${task.due_time ?? '99:99:99'}`;
}

/** Priority → weight (urgent surfaces first). Unknown priorities sort as normal. */
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/**
 * Open-task ordering (A7): overdue first, then by priority (urgent → low), then
 * chronological by due date/time.
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
 * The Dar tasks screen (frame 8c): a green sub-screen band, an اليوم/مفتوحة/مكتملة
 * status segmented control, a مهامي/كل المهام scope pill row, and a grouped card of
 * task rows — a 28px complete checkbox, title (strikethrough + status pill when done),
 * note, due (LTR), assignee, the inline «أنا متكفّل» claim pill, and a «تعذّر الإنجاز»
 * square. Complete / could-not-complete go through a Dar bottom-sheet confirm. Cairo +
 * Dar tokens, both themes, RTL. All behaviour, scoping, permissions unchanged.
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
  const insets = useSafeAreaInsets();
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

  // Transparent-circle visibility: everyone SEES the whole circle's tasks; an
  // explicit مهامي/كل المهام scope replaces role-hiding. Assignable members default
  // to their own; managers default to all; pure followers only ever see all.
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
    return canCollaborate && task.assigned_to !== null && task.assigned_to === userId;
  }

  function onClaim(task: CareTask) {
    if (claimingId) return;
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

  const statusTabs: { key: TaskTab; label: string }[] = [
    { key: 'today', label: t('figma.tasks.tabs.today') },
    { key: 'open', label: t('figma.tasks.tabs.open') },
    { key: 'done', label: t('figma.tasks.tabs.done') },
  ];

  const band = (
    <View style={[styles.band, { backgroundColor: c.band, paddingTop: insets.top + 18 }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={[styles.bandBack, { borderColor: c.bandInk }]}>
        <ChevronRight size={20} color={c.bandInk} strokeWidth={2.4} />
      </Pressable>
      <Text style={[styles.bandTitle, { color: c.bandInk }]} numberOfLines={1}>
        {t('figma.tasks.title')}
      </Text>
      {canManage ? (
        <Pressable
          onPress={() => router.push('/tasks/new')}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.add')}
          style={[styles.bandAdd, { backgroundColor: c.bandInk }]}>
          <Plus size={20} color={c.band} strokeWidth={2.6} />
        </Pressable>
      ) : (
        <View style={styles.bandSpacer} />
      )}
    </View>
  );

  return (
    <>
      <FigmaScreen band={band} contentGutter={16}>
        <View>
          {/* Status tabs */}
          <View style={[styles.tabs, { borderColor: c.border }]}>
            {statusTabs.map((tb, i) => {
              const active = tab === tb.key;
              return (
                <Pressable
                  key={tb.key}
                  onPress={() => setTab(tb.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.tab,
                    { backgroundColor: active ? c.primary : c.backgroundElement },
                    i > 0 && { borderStartWidth: BorderWidth.standard, borderStartColor: c.border },
                  ]}>
                  <Text
                    style={[
                      active ? styles.tabActiveLabel : styles.tabLabel,
                      { color: active ? c.onPrimary : c.textSecondary },
                    ]}>
                    {tb.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Scope pills — an explicit choice replaces role-based hiding. */}
          {canBeAssigned ? (
            <View style={styles.scopeRow}>
              {(['mine', 'all'] as TaskScope[]).map((key) => {
                const active = effectiveScope === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setScope(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.scopePill,
                      { backgroundColor: active ? c.primary : c.backgroundElement, borderColor: c.border },
                    ]}>
                    <Text
                      style={[
                        styles.scopePillText,
                        { color: active ? c.onPrimary : c.textSecondary, fontFamily: active ? FontFamily.bold : FontFamily.semibold },
                      ]}>
                      {t(key === 'mine' ? 'figma.tasks.scope.mine' : 'figma.tasks.scope.all')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Content */}
          <View style={styles.content}>
            {tasksQuery.isLoading ? (
              <SkeletonList />
            ) : tasksQuery.isError ? (
              <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
                <Text style={[styles.errorText, { color: c.errorFg }]}>{t('tasks.loadError')}</Text>
                <Pressable
                  onPress={() => tasksQuery.refetch()}
                  accessibilityRole="button"
                  style={[styles.retry, { backgroundColor: c.primary }]}>
                  <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
                </Pressable>
              </View>
            ) : filtered.length === 0 ? (
              <TasksEmpty title={t(effectiveScope === 'mine' ? 'figma.tasks.emptyMine' : 'figma.tasks.empty')} />
            ) : (
              <View style={[styles.groupCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
                {filtered.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    first={i === 0}
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
          </View>
        </View>
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

/** The Dar bottom-sheet chrome: scrim + card sheet with a sunken grab handle and a
 *  centered title. Backdrop-dismiss (blocked while an action is pending upstream). */
function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: c.overlay }]}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: c.backgroundElement, borderColor: c.border, paddingBottom: insets.bottom + 18 }]}
          onPress={() => {}}>
          <View style={[styles.grab, { backgroundColor: c.backgroundSelected }]} />
          <Text style={[styles.sheetTitle, { color: c.text }]}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Inline Dar sheet button: primary (btn fill), danger (card + err border/text), or
 *  secondary (card + line border). */
function SheetButton({
  label,
  tone,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  tone: 'primary' | 'danger' | 'secondary';
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  const bg = tone === 'primary' ? c.primary : c.backgroundElement;
  const border = tone === 'danger' ? c.errorFg : c.border;
  const color = tone === 'primary' ? c.onPrimary : tone === 'danger' ? c.errorFg : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.sheetBtn,
        { backgroundColor: bg, borderColor: border, paddingVertical: tone === 'secondary' ? 11 : 13, opacity: disabled ? 0.6 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={tone === 'primary' ? c.onPrimary : c.errorFg} />
      ) : (
        <Text style={[styles.sheetBtnText, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Bottom-anchored notice for a failed / raced inline claim. */
function ClaimNoteSheet({ note, onClose }: { note: ClaimNote | null; onClose: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <BottomSheet visible={note !== null} onClose={onClose} title={note?.title ?? ''}>
      {note?.body ? (
        <Text
          style={[styles.sheetBody, { color: c.textSecondary }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive">
          {note.body}
        </Text>
      ) : null}
      <View style={styles.sheetActions}>
        <SheetButton label={t('common.ok')} tone="secondary" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

/** Confirmation sheet for a row quick action (complete = green CTA; not-completed =
 *  danger CTA). A retained snapshot keeps the copy correct during slide-out. */
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
    <BottomSheet
      visible={confirm !== null}
      onClose={onClose}
      title={t(isComplete ? 'tasks.confirmCompleteTitle' : 'tasks.confirmUnableTitle')}>
      <Text style={[styles.sheetBody, { color: c.textSecondary }]}>
        {t(isComplete ? 'tasks.confirmCompleteBody' : 'tasks.confirmUnableBody')}
      </Text>
      <View style={[styles.sheetTaskChip, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
        <Text style={[styles.sheetTaskText, { color: c.text }]} numberOfLines={3}>
          {shown?.task.title}
        </Text>
      </View>
      <View style={styles.sheetActions}>
        <SheetButton
          label={t(isComplete ? 'tasks.markComplete' : 'tasks.markUnable')}
          tone={isComplete ? 'primary' : 'danger'}
          loading={pending}
          onPress={onConfirm}
        />
        <SheetButton label={t('common.cancel')} tone="secondary" disabled={pending} onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

/** The Dar task status pill (icon + label, 1.5px stroke, r4). */
const STATUS_PILL: Record<'completed' | 'cancelled', { fg: 'successFg' | 'errorFg'; Icon: IconCmp; key: string }> = {
  completed: { fg: 'successFg', Icon: Check, key: 'tasks.status.completed' },
  cancelled: { fg: 'errorFg', Icon: X, key: 'tasks.status.cancelled' },
};

function TaskRow({
  task,
  first,
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
  first: boolean;
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

  const showClaim = canClaim && unassigned && task.status === 'open';
  const isDone = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const isTerminal = isDone || isCancelled;
  const note = task.description?.trim() || null;
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

  // Checkbox: done = ok border + tok fill + check; cancelled = err border + terr + X;
  // open = line outline, empty.
  const checkBorder = isDone ? c.successFg : isCancelled ? c.errorFg : c.border;
  const checkBg = isDone ? c.successBg : isCancelled ? c.errorBg : c.backgroundElement;
  const CheckIcon: IconCmp | null = isDone ? Check : isCancelled ? X : null;
  const checkColor = isDone ? c.successFg : c.errorFg;
  const checkboxStyle = [styles.checkbox, { borderColor: checkBorder, backgroundColor: checkBg }];
  const pill = isDone ? STATUS_PILL.completed : isCancelled ? STATUS_PILL.cancelled : null;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityHint={t('common.details')}
      style={[styles.row, !first && { borderTopWidth: BorderWidth.standard, borderTopColor: c.border }, isCancelled && styles.rowDim]}>
      {canAct ? (
        <Pressable
          onPress={onComplete}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.complete')}
          accessibilityHint={t('tasks.confirmCompleteTitle')}
          style={checkboxStyle}>
          {CheckIcon ? <CheckIcon size={14} color={checkColor} strokeWidth={2.8} /> : null}
        </Pressable>
      ) : (
        <View style={checkboxStyle} pointerEvents="none">
          {CheckIcon ? <CheckIcon size={14} color={checkColor} strokeWidth={2.8} /> : null}
        </View>
      )}

      <View style={styles.info}>
        <Text
          style={[styles.title, { color: c.text }, isDone && styles.titleDone]}
          numberOfLines={2}>
          {task.title}
        </Text>
        {note ? (
          <Text style={[styles.note, { color: c.textSecondary }]} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {isTerminal && pill ? (
            <View style={[styles.statusPill, { borderColor: c[pill.fg] }]}>
              <pill.Icon size={12} color={c[pill.fg]} strokeWidth={2.8} />
              <Text style={[styles.statusPillText, { color: c[pill.fg] }]}>{t(pill.key)}</Text>
            </View>
          ) : due ? (
            <View style={styles.dueGroup}>
              <Clock size={12} color={c.textSecondary} strokeWidth={2.2} />
              <Text style={[styles.metaText, { color: c.textSecondary }]}>{isolateLtr(due)}</Text>
            </View>
          ) : null}
          <Text style={[styles.assignText, { color: c.primaryText }]}>{assignText}</Text>
        </View>

        {showClaim ? (
          <Pressable
            onPress={onClaim}
            disabled={claiming}
            accessibilityRole="button"
            accessibilityLabel={t('claiming.cta')}
            accessibilityHint={t('claiming.ctaHint')}
            style={[styles.claimBtn, { backgroundColor: c.primary }]}>
            {claiming ? (
              <ActivityIndicator size="small" color={c.onPrimary} />
            ) : (
              <>
                <HandHelping size={15} color={c.onPrimary} strokeWidth={2} />
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
          style={[styles.cancelSquare, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
          <X size={14} color={c.errorFg} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** The Dar quiet empty for tasks — a tinted circle + ok check + title. */
function TasksEmpty({ title }: { title: string }) {
  const c = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <View style={[styles.emptyCircle, { backgroundColor: c.successBg, borderColor: c.border }]}>
        <Check size={28} color={c.successFg} strokeWidth={2} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header band
  band: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 18 },
  bandBack: {
    width: 44,
    height: 44,
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bandTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: FontFamily.bold },
  bandAdd: { width: 44, height: 44, borderRadius: R8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bandSpacer: { width: 44, flexShrink: 0 },
  // Status tabs
  tabs: { flexDirection: 'row', borderWidth: BorderWidth.standard, borderRadius: R8, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  tabActiveLabel: { fontSize: 16, fontFamily: FontFamily.bold },
  tabLabel: { fontSize: 16, fontFamily: FontFamily.semibold },
  // Scope pills
  scopeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  scopePill: { borderWidth: BorderWidth.standard, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 6 },
  scopePillText: { fontSize: 15 },
  content: { marginTop: 12 },
  // Error card
  errorCard: { borderWidth: BorderWidth.standard, borderRadius: R8, padding: 20 },
  errorText: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: R6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Task list
  groupCard: { borderWidth: BorderWidth.standard, borderRadius: R8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowDim: { opacity: 0.6 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  titleDone: { textDecorationLine: 'line-through', opacity: 0.65, fontFamily: FontFamily.semibold },
  note: { fontSize: 14, fontFamily: FontFamily.medium, lineHeight: 22, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  dueGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 14, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  assignText: { fontSize: 14, fontFamily: FontFamily.bold },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: BorderWidth.thin,
    borderRadius: Radius.tiny,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  statusPillText: { fontSize: 14, fontFamily: FontFamily.semibold },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: 8,
    minHeight: 34,
    paddingHorizontal: 16,
    borderRadius: R6,
  },
  claimText: { fontSize: 15, fontFamily: FontFamily.bold },
  cancelSquare: {
    width: 34,
    height: 34,
    borderWidth: BorderWidth.standard,
    borderRadius: R6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  // Empty
  empty: { borderWidth: BorderWidth.standard, borderRadius: R8, paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center' },
  emptyCircle: {
    width: 68,
    height: 68,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontFamily: FontFamily.bold, marginTop: 16, textAlign: 'center', lineHeight: 30 },
  // Bottom sheet
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderTopWidth: BorderWidth.standard,
    borderLeftWidth: BorderWidth.standard,
    borderRightWidth: BorderWidth.standard,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  grab: { width: 48, height: 8, borderRadius: Radius.pill, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 18, fontFamily: FontFamily.bold, textAlign: 'center' },
  sheetBody: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 27, textAlign: 'center', marginTop: 4 },
  sheetTaskChip: { borderWidth: BorderWidth.standard, borderRadius: R8, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  sheetTaskText: { fontSize: 16, fontFamily: FontFamily.bold, textAlign: 'center' },
  sheetActions: { gap: 8, marginTop: 12 },
  sheetBtn: {
    borderWidth: BorderWidth.standard,
    borderRadius: R8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sheetBtnText: { fontSize: 17, fontFamily: FontFamily.bold },
});
