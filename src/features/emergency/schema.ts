import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max, 'tooLong');

/**
 * Validation for an emergency contact. `name` and `phone` are required; the rest
 * are optional. Issue messages are short codes the contacts screen maps to
 * localized strings.
 */
export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1, 'name').max(120, 'tooLong'),
  relationship: optionalText(80),
  phone: z.string().trim().min(1, 'phone').max(40, 'tooLong'),
  is_primary: z.boolean(),
  notes: optionalText(500),
});

export type EmergencyContactValues = z.infer<typeof emergencyContactSchema>;
