import { z } from 'zod';

import { isValidHm, isValidYmd } from '@/utils/date';

const optionalText = (max: number) => z.string().trim().max(max, 'tooLong');

/**
 * Family visit form fields. `visitor_name` and `visit_date` are required; the
 * start / end times are optional, and an end time may not be before a start
 * time. Status is a controlled select handled outside this schema. Issue
 * messages are short codes the form localizes.
 */
export const visitSchema = z
  .object({
    visitor_name: z.string().trim().min(1, 'visitorName').max(120, 'tooLong'),
    visit_date: z
      .string()
      .trim()
      .refine((value) => isValidYmd(value), { message: 'visitDate' }),
    start_time: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidHm(value), { message: 'startTime' }),
    end_time: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidHm(value), { message: 'endTime' }),
    notes: optionalText(1000),
  })
  .refine(
    (value) => value.start_time === '' || value.end_time === '' || value.end_time >= value.start_time,
    { message: 'endBeforeStart', path: ['end_time'] },
  );

export type VisitValues = z.infer<typeof visitSchema>;
