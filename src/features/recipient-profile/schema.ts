import { z } from 'zod';

import { isValidYmd } from '@/utils/date';

/** Optional free-text field: trimmed, length-bounded, empty allowed. */
const optionalText = (max: number) => z.string().trim().max(max, 'tooLong');

/**
 * Validation for editing the care recipient. `full_name` is required; everything
 * else is optional. `birth_date` is free text that, when present, must be a real
 * YYYY-MM-DD date. Issue messages are short codes the form maps to localized
 * strings (see the recipient profile screen).
 */
export const recipientProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'full_name').max(120, 'tooLong'),
  birth_date: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidYmd(value), { message: 'birth_date' }),
  dialect: optionalText(60),
  blood_type: optionalText(20),
  allergies: optionalText(1000),
  chronic_conditions: optionalText(1000),
  emergency_notes: optionalText(2000),
});

export type RecipientProfileValues = z.infer<typeof recipientProfileSchema>;
