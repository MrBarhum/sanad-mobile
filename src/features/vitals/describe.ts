import type { VitalReading } from './api';

/**
 * The human-readable measured value of a reading (no interpretation): e.g.
 * "120/80 mmHg" for blood pressure, "37.5 °C" for temperature, or just the unit /
 * empty string for a notes-only "other" reading.
 */
export function formatVitalValue(reading: VitalReading): string {
  const unitSuffix = reading.unit ? ` ${reading.unit}` : '';

  if (reading.reading_type === 'blood_pressure') {
    if (reading.systolic !== null && reading.diastolic !== null) {
      return `${reading.systolic}/${reading.diastolic}${unitSuffix}`;
    }
    return reading.unit ?? '';
  }

  if (reading.numeric_value !== null) {
    return `${reading.numeric_value}${unitSuffix}`;
  }

  return reading.unit ?? '';
}
