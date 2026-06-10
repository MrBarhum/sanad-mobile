import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { OptionSelect, type SelectOption } from '@/components/option-select';
import { TimeField } from '@/components/time-field';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { formatHm, hmFromInstant, ymdFromInstant } from '@/utils/date';
import { fieldErrors } from '@/utils/form';

import type { CareTask, TaskCategory, TaskPriority } from './api';
import {
  useCancelTask,
  useCompleteTask,
  useDeleteTask,
  useTask,
  useUpdateTask,
} from './hooks';
import { TASK_CATEGORIES, TASK_PRIORITIES, taskSchema } from './schema';

const SUCCESS = '#16a34a';
const DANGER = '#dc2626';
const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Loads a task, then renders the view/edit screen with status + delete actions. */
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
      <ErrorState
        message={t('tasks.loadError')}
        retryLabel={t('retry')}
        onRetry={() => task.refetch()}
      />
    );
  }
  if (!task.data) {
    return (
      <ThemedView style={styles.centered}>
        <EmptyState title={t('tasks.notFound')} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {canManage ? (
          <TaskFields key={task.data.id} circleId={circleId} initial={task.data} />
        ) : (
          <ReadOnlyTask task={task.data} />
        )}

        <StatusSection
          circleId={circleId}
          task={task.data}
          canManage={canManage}
          canCollaborate={canCollaborate}
        />

        {canManage ? <DeleteTaskRow circleId={circleId} id={task.data.id} /> : null}
      </ScrollView>
    </ThemedView>
  );
}

function TaskFields({ circleId, initial }: { circleId: string; initial: CareTask }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const update = useUpdateTask(circleId);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [category, setCategory] = useState<TaskCategory>(initial.category);
  const [priority, setPriority] = useState<TaskPriority>(initial.priority);
  const [dueDate, setDueDate] = useState(initial.due_date ?? '');
  const [dueTime, setDueTime] = useState(initial.due_time ? formatHm(initial.due_time) : '');
  const [assignToMe, setAssignToMe] = useState(
    initial.assigned_to !== null && initial.assigned_to === userId,
  );
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const submitting = update.isPending;

  const categoryOptions: SelectOption<TaskCategory>[] = TASK_CATEGORIES.map((value) => ({
    value,
    label: t(`tasks.category.${value}`),
  }));
  const priorityOptions: SelectOption<TaskPriority>[] = TASK_PRIORITIES.map((value) => ({
    value,
    label: t(`tasks.priority.${value}`),
  }));

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
          assigned_to: assignToMe ? userId : null,
          notes: nullify(parsed.data.notes),
        },
      });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={styles.fields}>
      <FormField
        label={t('tasks.fields.title')}
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          touch();
        }}
        error={fieldError(errors.title)}
      />
      <FormField
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

      <OptionSelect
        label={t('tasks.fields.category')}
        value={category}
        options={categoryOptions}
        onChange={(v) => {
          setCategory(v);
          touch();
        }}
      />
      <OptionSelect
        label={t('tasks.fields.priority')}
        value={priority}
        options={priorityOptions}
        onChange={(v) => {
          setPriority(v);
          touch();
        }}
      />

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

      <View style={styles.switchRow}>
        <ThemedText type="smallBold">{t('tasks.fields.assignToMe')}</ThemedText>
        <Switch
          value={assignToMe}
          onValueChange={(v) => {
            setAssignToMe(v);
            touch();
          }}
          trackColor={{ true: theme.text, false: theme.backgroundSelected }}
          accessibilityLabel={t('tasks.fields.assignToMe')}
        />
      </View>

      <FormField
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

      {status === 'saved' ? (
        <ThemedText style={[styles.statusText, { color: SUCCESS }]} accessibilityRole="alert">
          {t('tasks.saved')}
        </ThemedText>
      ) : null}
      {status === 'error' ? (
        <ThemedText style={[styles.statusText, { color: DANGER }]} accessibilityRole="alert">
          {t('tasks.saveFailed')}
        </ThemedText>
      ) : null}

      <Button
        label={t('tasks.saveTask')}
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
      />
    </View>
  );
}

function ReadOnlyTask({ task }: { task: CareTask }) {
  const { t } = useTranslation();
  const due = task.due_date
    ? task.due_time
      ? `${task.due_date} ${formatHm(task.due_time)}`
      : task.due_date
    : t('tasks.noDueDate');

  return (
    <View style={styles.fields}>
      <ThemedView type="backgroundElement" style={styles.notice}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('tasks.readOnly')}
        </ThemedText>
      </ThemedView>
      <ThemedText style={styles.readName}>{task.title}</ThemedText>
      <InfoRow label={t('tasks.fields.category')} value={t(`tasks.category.${task.category}`)} />
      <InfoRow label={t('tasks.fields.priority')} value={t(`tasks.priority.${task.priority}`)} />
      <InfoRow label={t('tasks.dueLabel')} value={due} />
      {task.description ? (
        <InfoRow label={t('tasks.fields.description')} value={task.description} />
      ) : null}
      {task.notes ? <InfoRow label={t('tasks.fields.notes')} value={task.notes} /> : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const complete = useCompleteTask(circleId);
  const cancel = useCancelTask(circleId);
  const [pending, setPending] = useState(false);

  const canAct =
    task.status === 'open' &&
    (canManage || (canCollaborate && (task.assigned_to === null || task.assigned_to === userId)));

  async function run(kind: 'complete' | 'cancel') {
    setPending(true);
    try {
      if (kind === 'complete') await complete.mutateAsync(task.id);
      else await cancel.mutateAsync(task.id);
    } finally {
      setPending(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.statusCard}>
      <ThemedText type="smallBold">
        {t('tasks.fields.status')}: {t(`tasks.status.${task.status}`)}
      </ThemedText>
      {task.status === 'completed' && task.completed_at ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('tasks.completedAt')}: {ymdFromInstant(task.completed_at)}{' '}
          {hmFromInstant(task.completed_at)}
        </ThemedText>
      ) : null}
      {task.status === 'cancelled' && task.cancelled_at ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('tasks.cancelledAt')}: {ymdFromInstant(task.cancelled_at)}{' '}
          {hmFromInstant(task.cancelled_at)}
        </ThemedText>
      ) : null}

      {canAct ? (
        <View style={styles.actions}>
          <Button
            size="sm"
            label={t('tasks.complete')}
            loading={pending}
            disabled={pending}
            onPress={() => run('complete')}
          />
          <Button
            size="sm"
            variant="secondary"
            label={t('tasks.cancelTask')}
            disabled={pending}
            onPress={() => run('cancel')}
          />
        </View>
      ) : null}
    </ThemedView>
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

  if (confirming) {
    return (
      <View style={styles.confirmRow}>
        <Button
          variant="danger"
          label={t('common.confirmDelete')}
          loading={pending}
          onPress={onDelete}
        />
        <Button
          variant="secondary"
          label={t('common.cancel')}
          disabled={pending}
          onPress={() => setConfirming(false)}
        />
      </View>
    );
  }

  return (
    <Button variant="danger" label={t('tasks.deleteTask')} onPress={() => setConfirming(true)} />
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
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  fields: { gap: Spacing.three },
  notice: { borderRadius: Spacing.two, padding: Spacing.three },
  readName: { fontSize: 22, fontWeight: '700' },
  infoRow: { gap: Spacing.half },
  infoValue: { fontSize: 16, lineHeight: 24 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  statusText: { fontSize: 14, fontWeight: '600' },
  statusCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
