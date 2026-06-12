/**
 * Timezone helpers for resolving wall-clock schedule data (medication times,
 * task due times) into absolute instants in a recipient's IANA timezone. Uses
 * Intl only (no external date lib). The wall-time→instant conversion is the
 * standard two-step offset correction; it is exact except inside a DST
 * transition gap, which is an accepted edge case for reminder timing.
 */

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** The local civil parts of an instant in a timezone. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset (ms) of a timezone at a given instant: local - UTC. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - instant.getTime();
}

/** The absolute instant for a wall-clock time in a timezone. */
export function wallTimeToInstant(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

/** Local 'YYYY-MM-DD' for an instant in a timezone. */
export function localYmd(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Local weekday (0=Sunday .. 6=Saturday) for an instant in a timezone — matches
 * the medication_schedules.days_of_week convention. */
export function localWeekday(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Parses 'HH:MM' or 'HH:MM:SS' into {hour, minute}. */
export function parseHms(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':');
  return { hour: Number(h), minute: Number(m) };
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** True when a 'YYYY-MM-DD' date is within [start, end] (end nullable). */
export function ymdInRange(ymd: string, start: string, end: string | null): boolean {
  if (ymd < start) return false;
  if (end && ymd > end) return false;
  return true;
}
