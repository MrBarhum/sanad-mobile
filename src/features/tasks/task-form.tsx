import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { OptionSelect, type SelectOption } from '@/components/option-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { fieldErrors } from '@/utils/form';

import type { TaskCategory, TaskPriority } from './api';
import { useCreateTask } from './hooks';
import { TASK_CATEGORIES, TASK_PRIORITIES, taskSchema } from './schema';

const DANGER = '#dc2626';
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

  const submitting = create.isPending;

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
      router.back();
    } catch {
      setSubmitError(t('tasks.saveFailed'));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
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

          <FormField
            label={t('tasks.fields.dueDate')}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder={t('tasks.placeholders.dueDate')}
            autoCapitalize="none"
            error={fieldError(errors.due_date)}
          />
          <FormField
            label={t('tasks.fields.dueTime')}
            value={dueTime}
            onChangeText={setDueTime}
            placeholder={t('tasks.placeholders.dueTime')}
            autoCapitalize="none"
            error={fieldError(errors.due_time)}
          />

          <View style={styles.switchRow}>
            <ThemedText type="smallBold">{t('tasks.fields.assignToMe')}</ThemedText>
            <Switch
              value={assignToMe}
              onValueChange={setAssignToMe}
              trackColor={{ true: theme.text, false: theme.backgroundSelected }}
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

          {submitError ? (
            <ThemedText style={styles.submitError} accessibilityRole="alert">
              {submitError}
            </ThemedText>
          ) : null}

          <Button
            label={t('tasks.saveTask')}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.save}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  flex: { flex: 1, width: '100%' },
  content: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  submitError: { color: DANGER },
  save: { marginTop: Spacing.two },
});
