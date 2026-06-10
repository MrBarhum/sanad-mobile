import { ymdFromInstant } from '@/utils/date';

import type { CareAppointment } from '@/features/appointments/api';
import type { DailyCareLog, DailyMood } from '@/features/daily-logs/api';
import type { CareTask } from '@/features/tasks/api';
import type { FamilyVisit } from '@/features/visits/api';
import type { VitalReading, VitalReadingType } from '@/features/vitals/api';

/**
 * Deterministic, client-side "today's activity" summaries shared by the
 * dashboard cards and the feature centers. All comparisons use the device's
 * local calendar (no timezone math), consistent with the medication today's-
 * doses feature and documented as an assumption in the step report.
 */

export type TaskTodaySummary = {
  /** Open tasks whose due date is today. */
  dueToday: number;
  /** Tasks completed today (by their completion timestamp). */
  completedToday: number;
  /** All still-open tasks, regardless of due date. */
  openTotal: number;
};

/** Counts for the tasks dashboard card / today section. */
export function summarizeTodayTasks(tasks: CareTask[], today: string): TaskTodaySummary {
  let dueToday = 0;
  let completedToday = 0;
  let openTotal = 0;

  for (const task of tasks) {
    if (task.status === 'open') {
      openTotal += 1;
      if (task.due_date === today) dueToday += 1;
    } else if (
      task.status === 'completed' &&
      task.completed_at &&
      ymdFromInstant(task.completed_at) === today
    ) {
      completedToday += 1;
    }
  }

  return { dueToday, completedToday, openTotal };
}

/** Number of non-cancelled appointments that start today. */
export function countAppointmentsToday(appointments: CareAppointment[], today: string): number {
  return appointments.filter(
    (appointment) =>
      appointment.status !== 'cancelled' && ymdFromInstant(appointment.starts_at) === today,
  ).length;
}

/** Number of non-cancelled visits scheduled for today. */
export function countVisitsToday(visits: FamilyVisit[], today: string): number {
  return visits.filter((visit) => visit.status !== 'cancelled' && visit.visit_date === today).length;
}

export type DailyLogTodaySummary = {
  /** Logs filed for today (across all members). */
  todayCount: number;
  /** Mood from the most-recently-recorded of today's logs, if any captured one. */
  latestMood: DailyMood | null;
};

/** Counts for the daily-logs dashboard card / today section. */
export function summarizeTodayLogs(logs: DailyCareLog[], today: string): DailyLogTodaySummary {
  let todayCount = 0;
  let latestMood: DailyMood | null = null;
  let latestMoodAt = '';

  for (const log of logs) {
    if (log.log_date !== today) continue;
    todayCount += 1;
    if (log.mood && log.created_at > latestMoodAt) {
      latestMood = log.mood;
      latestMoodAt = log.created_at;
    }
  }

  return { todayCount, latestMood };
}

export type VitalsTodaySummary = {
  /** Total readings recorded for the circle. */
  totalCount: number;
  /** Readings recorded today. */
  todayCount: number;
  /** The most-recent reading's type, if any. */
  latestType: VitalReadingType | null;
};

/** Counts for the vitals dashboard card / today section. */
export function summarizeVitals(readings: VitalReading[], today: string): VitalsTodaySummary {
  let todayCount = 0;
  let latestType: VitalReadingType | null = null;
  let latestAt = '';

  for (const reading of readings) {
    if (ymdFromInstant(reading.reading_at) === today) todayCount += 1;
    if (reading.reading_at > latestAt) {
      latestAt = reading.reading_at;
      latestType = reading.reading_type;
    }
  }

  return { totalCount: readings.length, todayCount, latestType };
}
