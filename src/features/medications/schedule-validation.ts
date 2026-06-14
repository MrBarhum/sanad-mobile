import { formatHm } from '@/utils/date';

import type { MedicationSchedule } from './api';
import type { ScheduleDraft } from './schedule-fields';

/** Normalizes 'HH:MM[:SS]' to a trimmed 'HH:MM'. */
function normTime(time: string): string {
  return formatHm(time.trim());
}

/**
 * Times that appear more than once in `times` (normalized to HH:MM). A schedule
 * should never list the same time twice — it would double-count a dose and make
 * the dose list emit two items with the same `${scheduleId}|${time}` React key.
 * Empty rows are ignored (the schema rejects those separately).
 */
export function duplicateTimes(times: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const raw of times) {
    const time = normTime(raw);
    if (time === '') continue;
    if (seen.has(time)) dups.add(time);
    else seen.add(time);
  }
  return [...dups];
}

/** Duplicate times within a single schedule draft (see {@link duplicateTimes}). */
export function duplicateTimesInDraft(draft: ScheduleDraft): string[] {
  return duplicateTimes(draft.times);
}

/** A weekday + time slot that collides with another active schedule. */
export type ScheduleConflict = { day: number; time: string };

/**
 * Finds weekday+time slots in `draft` that already exist in another ACTIVE
 * schedule for the same medication. `excludeId` skips the schedule currently
 * being edited so it never conflicts with itself.
 *
 * Only the exact same weekday AND time counts as a conflict. Two schedules that
 * share days but run at different times (every day at 08:00, plus Sun/Tue/Thu at
 * 23:00) are perfectly valid and never flagged. Stopped (inactive) schedules are
 * ignored, since they don't generate reminders.
 */
export function findScheduleConflicts(
  draft: ScheduleDraft,
  existing: MedicationSchedule[],
  excludeId?: string,
): ScheduleConflict[] {
  const taken = new Set<string>();
  for (const schedule of existing) {
    if (!schedule.is_active) continue;
    if (excludeId && schedule.id === excludeId) continue;
    for (const day of schedule.days_of_week) {
      for (const time of schedule.times) taken.add(`${day}|${normTime(time)}`);
    }
  }

  const draftTimes = [...new Set(draft.times.map(normTime).filter((time) => time !== ''))];
  const conflicts: ScheduleConflict[] = [];
  for (const day of [...draft.days_of_week].sort((a, b) => a - b)) {
    for (const time of draftTimes) {
      if (taken.has(`${day}|${time}`)) conflicts.push({ day, time });
    }
  }
  return conflicts;
}
