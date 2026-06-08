import { z } from 'zod';

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a real calendar date in strict YYYY-MM-DD form. */
function isValidYmd(value: string): boolean {
  if (!BIRTH_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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
