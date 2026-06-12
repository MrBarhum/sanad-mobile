import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { StickyFormActions } from '@/components/form-actions';
import { FormField } from '@/components/form-field';
import { OptionSelect, type SelectOption } from '@/components/option-select';
import { Screen } from '@/components/screen';
import { TimeField } from '@/components/time-field';
import { ThemedText } from '@/components/themed-text';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';
import { fieldErrors } from '@/utils/form';

import type { TaskCategory, TaskPriority } from './api';
import { useCreateTask } from './hooks';
import { TASK_CATEGORIES, TASK_PRIORITIES, taskSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Add-task form. Title is required; everything else is optional. */
export function TaskForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const create = useCreateTask(circleId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('general');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [assignToMe, setAssignToMe] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { dirty } = useUnsavedChanges({
    title,
    description,
    category,
    priority,
    dueDate,
    dueTime,
    assignToMe,
    notes,
  });
  const submitting = create.isPending;

  useEffect(() => {
    if (submitted) router.back();
  }, [submitted, router]);

  const categoryOptions: SelectOption<TaskCategory>[] = TASK_CATEGORIES.map((value) => ({
    value,
    label: t(`tasks.category.${value}`),
  }));
  const priorityOptions: SelectOption<TaskPriority>[] = TASK_PRIORITIES.map((value) => ({
    value,
    label: t(`tasks.priority.${value}`),
  }));

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
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;

    setSubmitError(null);
    try {
      await create.mutateAsync({
        title: parsed.data.title,
        description: nullify(parsed.data.description),
        category,
        priority,
        due_date: nullify(parsed.data.due_date),
        due_time: nullify(parsed.data.due_time),
        assigned_to: assignToMe ? (user?.id ?? null) : null,
        notes: nullify(parsed.data.notes),
      });
      setSubmitted(true);
    } catch {
      setSubmitError(t('tasks.saveFailed'));
    }
  }

  return (
    <Screen
      maxWidth={MaxFormWidth}
      keyboardAvoiding
      footer={
        <StickyFormActions
          saveLabel={t('tasks.add')}
          onSave={onSubmit}
          saving={submitting}
          disabled={!dirty}
          status={submitError ? 'error' : 'idle'}
          errorLabel={submitError ?? undefined}
        />
      }>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('tasks.disclaimer')}
      </ThemedText>

      <FormField
        label={t('tasks.fields.title')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('tasks.placeholders.title')}
        error={fieldError(errors.title)}
      />
      <FormField
        label={t('tasks.fields.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('tasks.placeholders.description')}
        multiline
        error={fieldError(errors.description)}
      />

      <OptionSelect
        label={t('tasks.fields.category')}
        value={category}
        options={categoryOptions}
        onChange={setCategory}
      />
      <OptionSelect
        label={t('tasks.fields.priority')}
        value={priority}
        options={priorityOptions}
        onChange={setPriority}
      />

      <DateField
        label={t('tasks.fields.dueDate')}
        value={dueDate}
        onChange={setDueDate}
        clearable
        error={fieldError(errors.due_date)}
      />
      <TimeField
        label={t('tasks.fields.dueTime')}
        value={dueTime}
        onChange={setDueTime}
        clearable
        error={fieldError(errors.due_time)}
      />

      <View style={styles.switchRow}>
        <ThemedText type="smallBold">{t('tasks.fields.assignToMe')}</ThemedText>
        <Switch
          value={assignToMe}
          onValueChange={setAssignToMe}
          trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
          accessibilityLabel={t('tasks.fields.assignToMe')}
        />
      </View>

      <FormField
        label={t('tasks.fields.notes')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('tasks.placeholders.notes')}
        multiline
        error={fieldError(errors.notes)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
