import type { ZodError } from 'zod';

/**
 * Collapses a Zod error into a `{ field: messageCode }` map (first issue per
 * field wins). The message codes are the short strings set in each schema; the
 * form maps them to localized Arabic/English strings, mirroring the pattern used
 * on the auth screens.
 */
export function fieldErrors<TField extends string>(
  error: ZodError,
): Partial<Record<TField, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) {
      out[key] = issue.message;
    }
  }
  return out;
}
