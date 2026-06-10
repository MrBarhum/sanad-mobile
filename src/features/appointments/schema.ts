import { z } from 'zod';

import { isValidHm, isValidYmd } from '@/utils/date';

import type { AppointmentType } from './api';

const optionalText = (max: number) => z.string().trim().max(max, 'tooLong');

/** Appointment type choices, in display order, for the form select. */
export const APPOINTMENT_TYPES: readonly AppointmentType[] = [
  'doctor',
  'lab',
  'pharmacy',
  'therapy',
  'home_care',
  'family',
  'general',
];

/**
 * Appointment form fields. The date and start time are required; the end time is
 * optional and may not be before the start time. The type, status, and doctor
 * are controlled selects handled outside this schema. The form combines `date`
 * and the times into ISO timestamps before saving.
 */
export const appointmentSchema = z
  .object({
    title: z.string().trim().min(1, 'title').max(120, 'tooLong'),
    date: z
      .string()
      .trim()
      .refine((value) => isValidYmd(value), { message: 'date' }),
    start_time: z
      .string()
      .trim()
      .refine((value) => isValidHm(value), { message: 'startTime' }),
    end_time: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidHm(value), { message: 'endTime' }),
    location: optionalText(160),
    notes: optionalText(1000),
  })
  .refine((value) => value.end_time === '' || value.end_time >= value.start_time, {
    message: 'endBeforeStart',
    path: ['end_time'],
  });

export type AppointmentValues = z.infer<typeof appointmentSchema>;
