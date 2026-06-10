import { z } from 'zod';

import { isValidHm, isValidYmd } from '@/utils/date';

import type { TaskCategory, TaskPriority } from './api';

const optionalText = (max: number) => z.string().trim().max(max, 'tooLong');

/** Category / priority choices, in display order, for the form selects. */
export const TASK_CATEGORIES: readonly TaskCategory[] = [
  'general',
  'medication',
  'meal',
  'hygiene',
  'movement',
  'errand',
  'appointment',
  'other',
];

export const TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

/**
 * Task text/date fields. Only `title` is required. `due_date` / `due_time` are
 * optional free text (empty allowed); a time is only meaningful with a date.
 * Category, priority, status and assignment are controlled selects handled
 * outside this schema. Issue messages are short codes the form localizes.
 */
export const taskSchema = z
  .object({
    title: z.string().trim().min(1, 'title').max(120, 'tooLong'),
    description: optionalText(1000),
    due_date: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidYmd(value), { message: 'dueDate' }),
    due_time: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidHm(value), { message: 'dueTime' }),
    notes: optionalText(1000),
  })
  .refine((value) => value.due_time === '' || value.due_date !== '', {
    message: 'dueTimeNeedsDate',
    path: ['due_time'],
  });

export type TaskValues = z.infer<typeof taskSchema>;
