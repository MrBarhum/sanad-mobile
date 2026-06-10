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
