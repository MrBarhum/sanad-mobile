import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max, 'tooLong');

/**
 * Validation for a doctor. Only `name` is required; everything else (including
 * phone) is optional. Issue messages are short codes the doctors screen maps to
 * localized strings.
 */
export const doctorSchema = z.object({
  name: z.string().trim().min(1, 'name').max(120, 'tooLong'),
  specialty: optionalText(80),
  phone: optionalText(40),
  clinic_name: optionalText(120),
  notes: optionalText(500),
});

export type DoctorValues = z.infer<typeof doctorSchema>;
