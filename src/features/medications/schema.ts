import { z } from 'zod';

import { isValidYmd } from '@/utils/date';

const optionalText = (max: number) => z.string().trim().max(max, 'tooLong');

/** Strict 24-hour HH:MM. */
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Medication fields. Only `name` is required; the rest are optional free text.
 * Issue messages are short codes the form maps to localized strings.
 */
export const medicationSchema = z.object({
  name: z.string().trim().min(1, 'name').max(120, 'tooLong'),
  dosage: optionalText(80),
  form: optionalText(80),
  instructions: optionalText(500),
  with_food: z.boolean(),
});

export type MedicationValues = z.infer<typeof medicationSchema>;

/**
 * Schedule fields. Requires at least one weekday and one valid HH:MM time.
 * Dates are optional free text (empty allowed; the form defaults start_date to
 * today). `end_date` may not be before `start_date`.
 */
export const scheduleSchema = z
  .object({
    days_of_week: z.array(z.number().int().min(0).max(6)).min(1, 'days'),
    times: z.array(z.string().trim().regex(HM_RE, 'time')).min(1, 'times'),
    start_date: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidYmd(value), { message: 'startDate' }),
    end_date: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidYmd(value), { message: 'endDate' }),
    notes: optionalText(500),
  })
  .refine(
    (value) =>
      value.start_date === '' || value.end_date === '' || value.end_date >= value.start_date,
    { message: 'endBeforeStart', path: ['end_date'] },
  );

export type ScheduleValues = z.infer<typeof scheduleSchema>;
