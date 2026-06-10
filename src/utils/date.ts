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

/**
 * Today's date as a local 'YYYY-MM-DD' string. Uses the device's local time (no
 * timezone handling) — the medication "today's doses" feature deliberately works
 * in local time for now; this is documented as an assumption.
 */
export function todayYmd(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Local day-of-week for a 'YYYY-MM-DD' date: 0 = Sunday .. 6 = Saturday, matching
 * the `days_of_week` convention stored on medication schedules. Returns null for
 * malformed input.
 */
export function dayOfWeekFromYmd(ymd: string): number | null {
  if (!isValidYmd(ymd)) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

/** Normalizes a Postgres `time` value ('HH:MM:SS' or 'HH:MM') to 'HH:MM'. */
export function formatHm(time: string): string {
  return time.slice(0, 5);
}

/** Strict 24-hour HH:MM. */
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True when `value` is a valid 24-hour HH:MM time string. */
export function isValidHm(value: string): boolean {
  return HM_RE.test(value);
}

/**
 * Local 'YYYY-MM-DD' for an ISO timestamp (e.g. a Postgres timestamptz string).
 * Like the rest of this module it works in the device's local calendar — see the
 * local-time assumption documented in the step report.
 */
export function ymdFromInstant(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local 'HH:MM' for an ISO timestamp. */
export function hmFromInstant(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** ISO timestamp for local midnight today — used to fetch upcoming items. */
export function startOfTodayInstant(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
}

/**
 * Combines a local 'YYYY-MM-DD' date and an 'HH:MM' time into an ISO timestamp,
 * or `null` when either part is malformed. Local-time based, consistent with the
 * rest of the app.
 */
export function combineDateTimeToInstant(ymd: string, hm: string): string | null {
  if (!isValidYmd(ymd) || !HM_RE.test(hm)) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  const [hours, minutes] = hm.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}
