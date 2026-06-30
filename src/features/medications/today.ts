import { dayOfWeekFromYmd, formatHm } from '@/utils/date';

import type { Medication, MedicationLog, MedicationLogStatus, MedicationSchedule } from './api';

/** One scheduled dose for a given date, with its current logged status. */
export type DoseItem = {
  /** Stable React key: `${scheduleId}|${scheduledTime}`. */
  key: string;
  medicationId: string;
  scheduleId: string;
  medicationName: string;
  dosage: string | null;
  form: string | null;
  instructions: string | null;
  withFood: boolean;
  /** Postgres time string, 'HH:MM:SS'. */
  scheduledTime: string;
  status: MedicationLogStatus | null;
  /** Existing log id, when this dose has already been recorded. */
  logId: string | null;
  /** Responsible member for this dose's medication (medications.responsible_user_id).
   * Threaded through so operational lists can scope by responsibility (UI-only). */
  responsibleUserId: string | null;
};

export type DoseSummary = { total: number; given: number; remaining: number };

/**
 * Pure, deterministic computation of the dose list for `date`. Combines active
 * medications, their active schedules, and the logs already recorded for that
 * date. A schedule contributes a dose item for each of its `times` when:
 *   - its medication is in the active set,
 *   - `date` is within [start_date, end_date], and
 *   - the date's weekday is in `days_of_week` (0 = Sun .. 6 = Sat).
 * Date/time comparisons use the device's local calendar (no timezone math) —
 * see the local-time assumption documented in the step report. Items are sorted
 * by time, then medication name.
 */
export function computeDoseItems(params: {
  date: string;
  medications: Medication[];
  schedules: MedicationSchedule[];
  logs: MedicationLog[];
}): DoseItem[] {
  const { date, medications, schedules, logs } = params;
  const dow = dayOfWeekFromYmd(date);
  if (dow === null) return [];

  const medicationById = new Map(medications.map((medication) => [medication.id, medication]));

  const logByKey = new Map<string, MedicationLog>();
  for (const log of logs) {
    if (log.schedule_id) {
      logByKey.set(`${log.schedule_id}|${log.scheduled_time}`, log);
    }
  }

  const items: DoseItem[] = [];
  for (const schedule of schedules) {
    if (!schedule.is_active) continue;
    const medication = medicationById.get(schedule.medication_id);
    if (!medication) continue;
    if (schedule.start_date > date) continue;
    if (schedule.end_date && schedule.end_date < date) continue;
    if (!schedule.days_of_week.includes(dow)) continue;

    // Defensively collapse duplicate times within a schedule (e.g. legacy rows
    // written before client-side duplicate validation). Each distinct time must
    // appear once, or the dose list would render two items with the same
    // `${schedule.id}|${time}` React key.
    const seenTimes = new Set<string>();
    for (const time of schedule.times) {
      const normalized = formatHm(time);
      if (seenTimes.has(normalized)) continue;
      seenTimes.add(normalized);

      const log = logByKey.get(`${schedule.id}|${time}`) ?? null;
      items.push({
        key: `${schedule.id}|${time}`,
        medicationId: medication.id,
        scheduleId: schedule.id,
        medicationName: medication.name,
        dosage: medication.dosage,
        form: medication.form,
        instructions: medication.instructions,
        withFood: medication.with_food,
        scheduledTime: time,
        status: log?.status ?? null,
        logId: log?.id ?? null,
        responsibleUserId: medication.responsible_user_id,
      });
    }
  }

  items.sort((a, b) => {
    if (a.scheduledTime !== b.scheduledTime) return a.scheduledTime < b.scheduledTime ? -1 : 1;
    return a.medicationName.localeCompare(b.medicationName);
  });
  return items;
}

/** Counts for the dashboard summary: total scheduled, given, and remaining. */
export function summarizeDoses(items: DoseItem[]): DoseSummary {
  const total = items.length;
  const given = items.filter((item) => item.status === 'given').length;
  return { total, given, remaining: total - given };
}
