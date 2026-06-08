const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a real calendar date in strict YYYY-MM-DD form. */
export function isValidYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Approximate age in completed years for a YYYY-MM-DD birth date, or `null` when
 * the input is missing/invalid or the result is implausible. Used only to show a
 * rough age on the emergency card — it is informational, never a medical figure.
 */
export function approximateAgeYears(birthDateYmd: string | null | undefined): number | null {
  if (!birthDateYmd || !isValidYmd(birthDateYmd)) return null;
  const [year, month, day] = birthDateYmd.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const hadBirthdayThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hadBirthdayThisYear) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}
