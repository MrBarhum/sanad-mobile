import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Button } from '@/components/button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import {
  FigmaChipSelect,
  FigmaFormCard,
  FigmaFormField,
  FigmaFormScreen,
  FigmaMutedNote,
} from '@/components/figma/figma-form-screen';
import { isolateLtr } from '@/components/ltr-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { ThemedView } from '@/components/themed-view';
import { TimeField } from '@/components/time-field';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Glyph } from '@/constants/glyphs';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { MemberSelect, useMemberLookup } from '@/features/circle-members/member-assignment';
import { useAuth } from '@/providers';
import { formatHm, hmFromInstant, ymdFromInstant } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import type { CareTask, TaskCategory, TaskPriority, TaskStatus } from './api';
import {
  useCancelTask,
  useCompleteTask,
  useDeleteTask,
  useReopenTask,
  useTask,
  useUpdateTask,
} from './hooks';
import { TASK_CATEGORIES, TASK_PRIORITIES, taskSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Task status → badge tone (color + a distinct glyph, never color alone). */
const STATUS_TONE: Record<TaskStatus, StatusTone> = {
  open: 'info',
  completed: 'success',
  cancelled: 'error',
};

/** Task status → badge glyph (open reads as "pending"). */
const STATUS_GLYPH: Record<TaskStatus, string> = {
  open: Glyph.clock,
  completed: Glyph.check,
  cancelled: Glyph.cross,
};

/**
 * View / edit a single task — rebuilt in the Figma editor language (FigmaFormScreen
 * header + grouped FigmaFormCards + body-rendered teal save CTA) to match the
 * Add-Task form's section order (main info → due date/time → assignee → notes).
 * Managers get editable fields + a status card + a two-step delete; others get a
 * read-only layout (collaborators may still complete/cancel via the status card).
 * Validation (taskSchema), the assign-to-me data flow, status transitions, delete,
 * and permissions are all preserved unchanged.
 */
export function TaskEditor({
  circleId,
  canManage,
  canCollaborate,
  taskId,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
  taskId: string;
}) {
  const { t } = useTranslation();
  const task = useTask(taskId);

  if (task.isLoading) return <LoadingState />;
  if (task.isError) {
    return (
      <ErrorState message={t('tasks.loadError')} retryLabel={t('retry')} onRetry={() => task.refetch()} />
    );
  }
  if (!task.data) {
    return (
      <ThemedView style={styles.centered}>
        <EmptyState icon={Glyph.task} title={t('tasks.notFound')} />
      </ThemedView>
    );
  }

  return (
    <>
      {/* The Figma editor draws its own header; hide the native one. */}
      <Stack.Screen options={{ headerShown: false }} />
      {canManage ? (
        <TaskEditScreen
          key={task.data.id}
          circleId={circleId}
          initial={task.data}
          canCollaborate={canCollaborate}
        />
      ) : (
        <TaskViewScreen circleId={circleId} task={task.data} canCollaborate={canCollaborate} />
      )}
    </>
  );
}

function TaskEditScreen({
  circleId,
  initial,
  canCollaborate,
}: {
  circleId: string;
  initial: CareTask;
  canCollaborate: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateTask(circleId);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [category, setCategory] = useState<TaskCategory>(initial.category);
  const [priority, setPriority] = useState<TaskPriority>(initial.priority);
  const [dueDate, setDueDate] = useState(initial.due_date ?? '');
  const [dueTime, setDueTime] = useState(initial.due_time ? formatHm(initial.due_time) : '');
  const [assignedTo, setAssignedTo] = useState(initial.assigned_to ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges({
    title,
    description,
    category,
    priority,
    dueDate,
    dueTime,
    assignedTo,
    notes,
  });
  const submitting = update.isPending;

  const categoryOptions = TASK_CATEGORIES.map((value) => ({ value, label: t(`tasks.category.${value}`) }));
  const priorityOptions = TASK_PRIORITIES.map((value) => ({ value, label: t(`tasks.priority.${value}`) }));

  function touch() {
    if (status !== 'idle') setStatus('idle');
  }

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'title':
        return t('tasks.errors.title');
      case 'dueDate':
        return t('tasks.errors.dueDate');
      case 'dueTime':
        return t('tasks.errors.dueTime');
      case 'dueTimeNeedsDate':
        return t('tasks.errors.dueTimeNeedsDate');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  async function onSubmit() {
    const parsed = taskSchema.safeParse({
      title,
      description,
      due_date: dueDate,
      due_time: dueTime,
      notes,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus('idle');
      return;
    }
    setErrors({});
    try {
      await update.mutateAsync({
        id: initial.id,
        patch: {
          title: parsed.data.title,
          description: nullify(parsed.data.description),
          category,
          priority,
          due_date: nullify(parsed.data.due_date),
          due_time: nullify(parsed.data.due_time),
          assigned_to: assignedTo === '' ? null : assignedTo,
          notes: nullify(parsed.data.notes),
        },
      });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <FigmaFormScreen title={t('tasks.detailTitle')} onBack={() => router.back()}>
      <UnsavedChangesGuard when={dirty} />
      <FigmaMutedNote>{t('tasks.disclaimer')}</FigmaMutedNote>

      {/* Main info */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('tasks.fields.title')}
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            touch();
          }}
          required
          error={fieldError(errors.title)}
        />
        <FigmaFormField
          label={t('tasks.fields.description')}
          value={description}
          onChangeText={(v) => {
            setDescription(v);
            touch();
          }}
          placeholder={t('tasks.placeholders.description')}
          multiline
          error={fieldError(errors.description)}
        />
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{t('tasks.fields.category')}</Text>
          <FigmaChipSelect
            value={category}
            options={categoryOptions}
            onChange={(v) => {
              setCategory(v);
              touch();
            }}
          />
        </View>
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{t('tasks.fields.priority')}</Text>
          <FigmaChipSelect
            value={priority}
            options={priorityOptions}
            onChange={(v) => {
              setPriority(v);
              touch();
            }}
          />
        </View>
      </FigmaFormCard>

      {/* Due date / time */}
      <FigmaFormCard label={t('tasks.dueTitle')}>
        <View style={styles.row}>
          <View style={styles.dateCol}>
            <DateField
              label={t('tasks.fields.dueDate')}
              value={dueDate}
              onChange={(v) => {
                setDueDate(v);
                touch();
              }}
              clearable
              error={fieldError(errors.due_date)}
            />
          </View>
          <View style={styles.timeCol}>
            <TimeField
              label={t('tasks.fields.dueTime')}
              value={dueTime}
              onChange={(v) => {
                setDueTime(v);
                touch();
              }}
              clearable
              error={fieldError(errors.due_time)}
            />
          </View>
        </View>
      </FigmaFormCard>

      {/* Assignee — full member picker (Phase 2B), seeded from the task's current
          assignee. Replaces the old self-only toggle, which silently wiped another
          member's assignment whenever a manager saved an edit. */}
      <FigmaFormCard>
        <MemberSelect
          circleId={circleId}
          value={assignedTo}
          label={t('tasks.fields.assignedTo')}
          onChange={(v) => {
            setAssignedTo(v);
            touch();
          }}
        />
      </FigmaFormCard>

      {/* Notes */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('tasks.fields.notes')}
          value={notes}
          onChangeText={(v) => {
            setNotes(v);
            touch();
          }}
          placeholder={t('tasks.placeholders.notes')}
          multiline
          error={fieldError(errors.notes)}
        />
      </FigmaFormCard>

      <StatusSection circleId={circleId} task={initial} canManage canCollaborate={canCollaborate} />

      <DeleteTaskRow circleId={circleId} id={initial.id} />

      {/* Save CTA — body-rendered (not the footer prop, which did not render on
          Android). Final block, below the status + destructive delete cards. */}
      <View style={styles.footer}>
        {status === 'saved' ? (
          <Text style={[styles.statusText, { color: theme.successFg }]} accessibilityLiveRegion="polite">
            {t('tasks.saved')}
          </Text>
        ) : null}
        {status === 'error' ? (
          <Text style={[styles.statusText, { color: theme.errorFg }]} accessibilityRole="alert">
            {t('tasks.saveFailed')}
          </Text>
        ) : null}
        <FigmaFooterPrimaryButton
          label={t('common.saveChanges')}
          onPress={onSubmit}
          loading={submitting}
        />
      </View>
    </FigmaFormScreen>
  );
}

function TaskViewScreen({
  circleId,
  task,
  canCollaborate,
}: {
  circleId: string;
  task: CareTask;
  canCollaborate: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lookup = useMemberLookup(circleId);
  const responsible = lookup(task.assigned_to);
  const due = task.due_date
    ? task.due_time
      ? `${task.due_date} ${formatHm(task.due_time)}`
      : task.due_date
    : t('tasks.noDueDate');

  // A non-manager can't edit the task's fields, but the assignee can still update
  // its status — so the banner must not claim "view only / no permission" then.
  // Only the assignee (not unassigned) qualifies this pass.
  const canUpdateStatus =
    task.status === 'open' &&
    canCollaborate &&
    task.assigned_to !== null &&
    task.assigned_to === userId;

  return (
    <FigmaFormScreen title={t('tasks.detailTitle')} onBack={() => router.back()}>
      <FigmaMutedNote>{canUpdateStatus ? t('tasks.statusOnly') : t('tasks.readOnly')}</FigmaMutedNote>

      <FigmaFormCard>
        <Text style={[styles.title, { color: theme.text }]}>{task.title}</Text>
        <ReadOnlyRow label={t('tasks.fields.category')} value={t(`tasks.category.${task.category}`)} />
        <ReadOnlyRow label={t('tasks.fields.priority')} value={t(`tasks.priority.${task.priority}`)} />
        <ReadOnlyRow label={t('tasks.dueLabel')} value={due} />
        <ReadOnlyRow
          label={t('assignment.responsible')}
          value={responsible ? responsible.label : t('assignment.none')}
        />
        {task.description ? (
          <ReadOnlyRow label={t('tasks.fields.description')} value={task.description} />
        ) : null}
        {task.notes ? <ReadOnlyRow label={t('tasks.fields.notes')} value={task.notes} /> : null}
      </FigmaFormCard>

      <StatusSection circleId={circleId} task={task} canManage={false} canCollaborate={canCollaborate} />
    </FigmaFormScreen>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row2}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function StatusSection({
  circleId,
  task,
  canManage,
  canCollaborate,
}: {
  circleId: string;
  task: CareTask;
  canManage: boolean;
  canCollaborate: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const complete = useCompleteTask(circleId);
  const cancel = useCancelTask(circleId);
  const reopen = useReopenTask(circleId);
  const [pending, setPending] = useState(false);
  // Two-step confirm for the outcome actions — a stray tap must not irreversibly
  // complete/cancel a care task (matches the list's confirm sheet).
  const [confirm, setConfirm] = useState<'complete' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Managers act on any task; a non-manager only on a task assigned to them
  // (unassigned tasks are manager-only this pass — no family pick-up here).
  const canAct =
    task.status === 'open' &&
    (canManage || (canCollaborate && task.assigned_to !== null && task.assigned_to === userId));
  // Managers can undo a mistaken completion/cancellation (tasks were terminal
  // with no reopen; appointments/visits already allow it). RLS keeps it managers-only.
  const canReopen = canManage && task.status !== 'open';

  async function run(kind: 'complete' | 'cancel') {
    setPending(true);
    setError(null);
    try {
      if (kind === 'complete') await complete.mutateAsync(task.id);
      else await cancel.mutateAsync(task.id);
      setConfirm(null);
    } catch {
      setError(t('tasks.saveFailed'));
    } finally {
      setPending(false);
    }
  }

  async function doReopen() {
    setPending(true);
    setError(null);
    try {
      await reopen.mutateAsync(task.id);
    } catch {
      setError(t('tasks.saveFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <FigmaFormCard>
      <View style={styles.statusHeader}>
        <Text style={[styles.statusLabel, { color: theme.text }]}>{t('tasks.fields.status')}</Text>
        <StatusBadge
          tone={STATUS_TONE[task.status]}
          glyph={STATUS_GLYPH[task.status]}
          label={t(`tasks.status.${task.status}`)}
        />
      </View>
      {task.status === 'completed' && task.completed_at ? (
        <Text style={[styles.statusMeta, { color: theme.textSecondary }]}>
          {t('tasks.completedAt')}:{' '}
          {isolateLtr(`${ymdFromInstant(task.completed_at)} ${hmFromInstant(task.completed_at)}`)}
        </Text>
      ) : null}
      {task.status === 'cancelled' && task.cancelled_at ? (
        <Text style={[styles.statusMeta, { color: theme.textSecondary }]}>
          {t('tasks.cancelledAt')}:{' '}
          {isolateLtr(`${ymdFromInstant(task.cancelled_at)} ${hmFromInstant(task.cancelled_at)}`)}
        </Text>
      ) : null}

      {error ? (
        <Text
          style={[styles.statusMeta, { color: theme.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {canAct ? (
        confirm ? (
          <View style={styles.statusActions}>
            <Text style={[styles.statusMeta, { color: theme.textSecondary }]}>
              {t(confirm === 'complete' ? 'tasks.confirmCompleteBody' : 'tasks.confirmUnableBody')}
            </Text>
            {/* The confirm CTA mirrors the list sheet: complete = teal primary,
                cancel = red danger. Complete uses the proven body-rendered CTA
                (Button variant="primary" renders dark in this nested form). */}
            {confirm === 'complete' ? (
              <FigmaFooterPrimaryButton
                label={t('tasks.markComplete')}
                onPress={() => run('complete')}
                loading={pending}
              />
            ) : (
              <Button
                label={t('tasks.markUnable')}
                variant="danger"
                loading={pending}
                onPress={() => run('cancel')}
              />
            )}
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={pending}
              onPress={() => setConfirm(null)}
            />
          </View>
        ) : (
          <View style={styles.statusActions}>
            <FigmaFooterPrimaryButton
              label={t('tasks.markComplete')}
              onPress={() => setConfirm('complete')}
            />
            <Button
              label={t('tasks.markUnable')}
              variant="secondary"
              onPress={() => setConfirm('cancel')}
            />
          </View>
        )
      ) : canReopen ? (
        <View style={styles.statusActions}>
          <Button
            label={t('tasks.reopen')}
            variant="secondary"
            loading={pending}
            disabled={pending}
            onPress={doReopen}
          />
        </View>
      ) : null}
    </FigmaFormCard>
  );
}

function DeleteTaskRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const del = useDeleteTask(circleId);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    try {
      await del.mutateAsync(id);
      router.back();
    } catch {
      setPending(false);
    }
  }

  return (
    <FigmaFormCard>
      {confirming ? (
        <View style={styles.actionRow}>
          <View style={styles.actionCol}>
            <Button
              label={t('common.confirmDelete')}
              variant="danger"
              loading={pending}
              onPress={onDelete}
            />
          </View>
          <View style={styles.actionCol}>
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={pending}
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      ) : (
        <Button label={t('tasks.deleteTask')} variant="danger" onPress={() => setConfirming(true)} />
      )}
    </FigmaFormCard>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  footer: { gap: Spacing.two },
  statusText: { fontSize: 13, fontFamily: FontFamily.semibold, textAlign: 'center' },
  title: { fontSize: 18, fontFamily: FontFamily.bold },
  group: { gap: Spacing.two },
  groupLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  row: { flexDirection: 'row', gap: Spacing.three },
  dateCol: { flex: 2 },
  timeCol: { flex: 1 },
  row2: { gap: 2 },
  rowLabel: { fontSize: 13, fontFamily: FontFamily.semibold },
  rowValue: { fontSize: 16, fontFamily: FontFamily.regular },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  statusMeta: { fontSize: 13, fontFamily: FontFamily.regular },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  actionCol: { flex: 1 },
  // Status actions stack vertically: full-width filled-teal complete CTA on top,
  // quiet secondary below — primary gets full prominence and thumb width.
  statusActions: { gap: Spacing.two },
});
