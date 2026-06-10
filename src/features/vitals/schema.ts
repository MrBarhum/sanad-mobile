import type { VitalReadingType } from './api';

/** Reading types in display order, for the form select. */
export const VITAL_READING_TYPES: readonly VitalReadingType[] = [
  'blood_pressure',
  'heart_rate',
  'temperature',
  'blood_sugar',
  'oxygen_saturation',
  'weight',
  'other',
];

/**
 * Suggested unit per reading type — prefilled into the editable unit field. These
 * are conventional labels only; the app never validates or interprets the value.
 */
export const DEFAULT_UNITS: Record<VitalReadingType, string> = {
  blood_pressure: 'mmHg',
  heart_rate: 'bpm',
  temperature: '°C',
  blood_sugar: 'mg/dL',
  oxygen_saturation: '%',
  weight: 'kg',
  other: '',
};

/** Postgres int4 upper bound — systolic / diastolic are int columns. */
const INT4_MAX = 2147483647;

/** Parses a positive integer field within int4 range, or null when empty / invalid. */
export function toPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n > 0 && n <= INT4_MAX ? n : null;
}

/** Parses a positive (possibly decimal) number field, or null when empty / invalid. */
export function toPositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}
