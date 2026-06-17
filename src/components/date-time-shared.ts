import { isValidHm, isValidYmd } from '@/utils/date';

/**
 * Shared prop contracts + pure helpers for the date / time picker family
 * (date-field, time-field, date-time-field). The native and web variants of each
 * component implement the same props so callers are platform-agnostic. Values are
 * always exchanged in the formats the rest of the app + Supabase expect:
 *   - dates: 'YYYY-MM-DD' (or '' when unset)
 *   - times: 'HH:MM' 24-hour (or '' when unset)
 */

export type DateFieldProps = {
  label?: string;
  /** 'YYYY-MM-DD', or '' when unset. */
  value: string;
  /** Receives 'YYYY-MM-DD', or '' when cleared. */
  onChange: (value: string) => void;
  error?: string | null;
  /** Friendly hint shown on the trigger when empty (never asks for a manual format). */
  placeholder?: string;
  disabled?: boolean;
  /** Show a "clear" action so an optional date can be emptied (default false). */
  clearable?: boolean;
  /**
   * Earliest selectable date as 'YYYY-MM-DD' (inclusive). Optional — when omitted
   * the field keeps its full range (e.g. birth dates reach 120 years back). When
   * set, the wheel cannot scroll to earlier dates. Existing callers that don't
   * pass it are unaffected.
   */
  minDate?: string;
  accessibilityLabel?: string;
};

export type TimeFieldProps = {
  label?: string;
  /** 'HH:MM' 24-hour, or '' when unset. */
  value: string;
  /** Receives 'HH:MM', or '' when cleared. */
  onChange: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** Minute granularity for the native picker column (default 1). */
  minuteStep?: number;
  accessibilityLabel?: string;
};

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Inclusive integer range [start, end]. */
export function rangeInclusive(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/** Days in a given 1-based month of a year (handles leap Februaries). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export type Ymd = { year: number; month: number; day: number };

/** Parses a strict 'YYYY-MM-DD' string, or null when missing / malformed. */
export function parseYmd(value: string): Ymd | null {
  if (!value || !isValidYmd(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export type Hm = { hour: number; minute: number };

/** Parses a strict 'HH:MM' string, or null when missing / malformed. */
export function parseHm(value: string): Hm | null {
  if (!value || !isValidHm(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

export function formatHmParts(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/**
 * 12-hour clock parts for the Arabic-friendly picker UX. Storage stays 24-hour
 * 'HH:MM' everywhere — these helpers only translate the wheel display.
 */
export type Period = 'am' | 'pm';
export type Hm12 = { hour12: number; minute: number; period: Period };

/** 24-hour (hour, minute) -> 12-hour parts. 0->12am, 12->12pm, 13->1pm. */
export function to12h(hour: number, minute: number): Hm12 {
  const period: Period = hour < 12 ? 'am' : 'pm';
  const mod = hour % 12;
  return { hour12: mod === 0 ? 12 : mod, minute, period };
}

/** 12-hour parts -> 24-hour (hour, minute). 12am->0, 12pm->12, 1pm->13. */
export function from12h(hour12: number, minute: number, period: Period): Hm {
  let hour: number;
  if (period === 'am') hour = hour12 === 12 ? 0 : hour12;
  else hour = hour12 === 12 ? 12 : hour12 + 12;
  return { hour, minute };
}

/**
 * Renders a stored 24-hour 'HH:MM' as a friendly 12-hour string (e.g.
 * '8:00 صباحًا'), using caller-supplied AM/PM labels so the format stays
 * localized. Returns the raw value unchanged if it can't be parsed.
 */
export function formatHm12(value: string, amLabel: string, pmLabel: string): string {
  const parsed = parseHm(value);
  if (!parsed) return value;
  const { hour12, minute, period } = to12h(parsed.hour, parsed.minute);
  return `${hour12}:${pad2(minute)} ${period === 'am' ? amLabel : pmLabel}`;
}
