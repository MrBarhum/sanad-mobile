import { z } from 'zod';

import { isValidYmd } from '@/utils/date';

import type {
  AppetiteLevel,
  DailyMood,
  HydrationLevel,
  MobilityLevel,
  SleepQuality,
} from './api';

const optionalText = (max: number) => z.string().trim().max(max, 'tooLong');

/** Enum choices in display order, for the form selects. */
export const MOODS: readonly DailyMood[] = [
  'great',
  'good',
  'okay',
  'sad',
  'anxious',
  'angry',
  'confused',
  'tired',
];

export const SLEEP_QUALITIES: readonly SleepQuality[] = ['good', 'fair', 'poor', 'unknown'];
export const APPETITE_LEVELS: readonly AppetiteLevel[] = ['good', 'normal', 'low', 'none', 'unknown'];
export const HYDRATION_LEVELS: readonly HydrationLevel[] = ['good', 'normal', 'low', 'unknown'];
export const MOBILITY_LEVELS: readonly MobilityLevel[] = [
  'normal',
  'limited',
  'needs_help',
  'bedbound',
  'unknown',
];

/** Pain level is an optional 0–10 scale chosen from a stepper (never free text). */
export const PAIN_LEVELS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Daily log text + date fields. Only `log_date` is required (defaults to today in
 * the form). Mood / sleep / appetite / hydration / mobility / pain are controlled
 * selects handled outside this schema. Issue messages are short codes the form
 * localizes.
 */
export const dailyLogSchema = z.object({
  log_date: z
    .string()
    .trim()
    .refine((value) => isValidYmd(value), { message: 'logDate' }),
  bathroom_notes: optionalText(1000),
  food_notes: optionalText(1000),
  activity_notes: optionalText(1000),
  general_notes: optionalText(2000),
});

export type DailyLogValues = z.infer<typeof dailyLogSchema>;
