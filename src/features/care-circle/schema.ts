import { z } from 'zod';

import { isValidYmd } from '@/utils/date';

/**
 * Form validation for creating the first care circle. `birthDate` is optional
 * free text; when present it must be a real YYYY-MM-DD date. The issue messages
 * are field "codes" that the screen maps to localized strings, mirroring the
 * existing auth screens.
 */
export const createCircleSchema = z.object({
  circleName: z.string().trim().min(1, 'circleName'),
  recipientName: z.string().trim().min(1, 'recipientName'),
  birthDate: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidYmd(value), { message: 'birthDate' }),
});

export type CreateCircleValues = z.infer<typeof createCircleSchema>;
