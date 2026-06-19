import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import {
  FigmaChipSelect,
  FigmaFormCard,
  FigmaFormField,
  FigmaFormScreen,
  FigmaMutedNote,
} from '@/components/figma/figma-form-screen';
import { FigmaFont } from '@/components/figma/figma-tokens';
import { TimeField } from '@/components/time-field';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Spacing } from '@/constants/theme';
import { useCircleMembers } from '@/features/circle-members/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';
import { fieldErrors } from '@/utils/form';

import type { TaskCategory, TaskPriority } from './api';
import { useCreateTask } from './hooks';
import { TASK_CATEGORIES, TASK_PRIORITIES, taskSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Add-task form — an exact-copy rebuild of the Figma `AddTaskScreen` (header +
 * main-info card with priority chips + due-date card + assignee card), wired to
 * Sanad's real create flow + schema. Figma's blue/IBM-Plex become teal/Cairo, its
 * native date/time inputs become the protected wheel pickers, and its invented
 * assignee dropdown becomes a "تعيين إلى" selector of REAL circle members (no fake
 * names) — "أنا", any active member, or "بدون تعيين". Sanad also keeps the category
 * selector + a notes field the export omits.
 */
export function TaskForm({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const create = useCreateTask(circleId);
  const membersQuery = useCircleMembers(circleId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('general');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  // '' = "بدون تعيين"; otherwise a real member's user id (the self id for "أنا").
  const [assignedTo, setAssignedTo] = useState('');
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
    assignedTo,
    notes,
  });
  const submitting = create.isPending;

  useEffect(() => {
    if (submitted) router.back();
  }, [submitted, router]);

  const categoryOptions = TASK_CATEGORIES.map((value) => ({
    value,
    label: t(`tasks.category.${value}`),
  }));
  const priorityOptions = TASK_PRIORITIES.map((value) => ({
    value,
    label: t(`tasks.priority.${value}`),
  }));
  // "تعيين إلى" options: no-assignment, the current user ("أنا"), and every other
  // ACTIVE circle member by their REAL name/email — no invented names. "أنا" sets
  // the same self id the old toggle did; assigned_to already accepts a user id.
  const assigneeOptions = [
    { value: '', label: t('tasks.assignNone') },
    ...(user ? [{ value: user.id, label: t('tasks.assignMe') }] : []),
    ...(membersQuery.data ?? [])
      .filter((member) => member.status === 'active' && !member.isSelf && (member.fullName || member.email))
      .map((member) => ({ value: member.userId, label: member.fullName ?? member.email ?? '' })),
  ];

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
        assigned_to: assignedTo === '' ? null : assignedTo,
        notes: nullify(parsed.data.notes),
      });
      setSubmitted(true);
    } catch {
      setSubmitError(t('tasks.saveFailed'));
    }
  }

  return (
    <FigmaFormScreen title={t('tasks.addTitle')} onBack={() => router.back()}>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <FigmaMutedNote>{t('tasks.disclaimer')}</FigmaMutedNote>

      {/* Main info */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('tasks.fields.title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('tasks.placeholders.title')}
          required
          error={fieldError(errors.title)}
        />
        <FigmaFormField
          label={t('tasks.fields.description')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('tasks.placeholders.description')}
          multiline
          error={fieldError(errors.description)}
        />
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{t('tasks.fields.category')}</Text>
          <FigmaChipSelect value={category} options={categoryOptions} onChange={setCategory} />
        </View>
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{t('tasks.fields.priority')}</Text>
          <FigmaChipSelect value={priority} options={priorityOptions} onChange={setPriority} />
        </View>
      </FigmaFormCard>

      {/* Due date / time */}
      <FigmaFormCard label={t('tasks.dueTitle')}>
        <View style={styles.row}>
          <View style={styles.dateCol}>
            <DateField
              label={t('tasks.fields.dueDate')}
              value={dueDate}
              onChange={setDueDate}
              clearable
              error={fieldError(errors.due_date)}
            />
          </View>
          <View style={styles.timeCol}>
            <TimeField
              label={t('tasks.fields.dueTime')}
              value={dueTime}
              onChange={setDueTime}
              clearable
              error={fieldError(errors.due_time)}
            />
          </View>
        </View>
      </FigmaFormCard>

      {/* Assignee — real circle members only */}
      <FigmaFormCard>
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>
            {t('tasks.fields.assignedTo')}
          </Text>
          <FigmaChipSelect value={assignedTo} options={assigneeOptions} onChange={setAssignedTo} />
        </View>
      </FigmaFormCard>

      {/* Notes */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('tasks.fields.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('tasks.placeholders.notes')}
          multiline
          error={fieldError(errors.notes)}
        />
      </FigmaFormCard>

      {/* Primary CTA — rendered directly in the body (not the FigmaFormScreen footer
          prop). Always a filled teal button; an invalid press runs validation
          (onSubmit) and shows inline field errors instead of submitting. */}
      <View style={styles.footer}>
        {submitError ? (
          <Text
            style={[styles.footerError, { color: theme.errorFg }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {submitError}
          </Text>
        ) : null}
        <FigmaFooterPrimaryButton label={t('tasks.add')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: Spacing.two },
  footerError: { fontSize: 13, fontFamily: FigmaFont.regular, textAlign: 'center' },
  group: { gap: Spacing.two },
  groupLabel: { fontSize: 14, fontFamily: FigmaFont.semibold },
  row: { flexDirection: 'row', gap: Spacing.three },
  dateCol: { flex: 2 },
  timeCol: { flex: 1 },
});
