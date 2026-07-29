import { dayOfWeekFromYmd, formatHm } from '@/utils/date';

import type { Medication, MedicationLog, MedicationLogStatus, MedicationSchedule } from './api';

/** One scheduled dose for a given date, with its current logged status. */
export type DoseItem = {
  /** Stable React key: `${scheduleId}|${scheduledTime}`. */
  key: string;
  medicationId: string;
  /**
   * Null only for a dose surfaced from a log whose schedule is gone (pass 3 in
   * `computeDoseItems`) and whose own `schedule_id` was already cleared by the
   * `on delete set null` on `medication_logs.schedule_id`.
   */
  scheduleId: string | null;
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

  /** Logs already attached to an expanded slot — drives passes 2 and 3 below. */
  const matchedLogIds = new Set<string>();

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
      if (log) matchedLogIds.add(log.id);
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

  const byTimeThenName = (a: DoseItem, b: DoseItem) => {
    if (a.scheduledTime !== b.scheduledTime) return a.scheduledTime < b.scheduledTime ? -1 : 1;
    return a.medicationName.localeCompare(b.medicationName);
  };

  // ── Pass 2 · reunite a MOVED dose with its slot ─────────────────────────────
  //
  // A log is bound to the `(schedule_id, scheduled_time)` it was recorded against.
  // Editing a schedule's time — 08:00 to 09:00 — leaves the log on 08:00 while the
  // expansion now yields 09:00, so pass 1 finds nothing and the dose re-presents as
  // UNLOGGED. That is a double-dose risk: the caregiver is shown an outstanding
  // dose that was already administered.
  //
  // So any still-unmatched log is re-attached to the earliest not-yet-logged slot
  // of the SAME medication on this date. Scoped to one medication and one day, and
  // only ever filling an EMPTY slot, so it cannot move a dose between medications
  // or overwrite an explicitly recorded outcome. Deterministic: logs are consumed
  // in time order (id as the tiebreak) against slots already in time order, so the
  // same inputs always produce the same pairing.
  items.sort(byTimeThenName);

  const unmatched = logs
    .filter((log) => !matchedLogIds.has(log.id))
    .sort((a, b) => {
      if (a.scheduled_time !== b.scheduled_time) return a.scheduled_time < b.scheduled_time ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

  for (const log of unmatched) {
    const slot = items.find(
      (item) => item.logId === null && item.medicationId === log.medication_id,
    );
    if (!slot) continue;
    slot.status = log.status;
    slot.logId = log.id;
    matchedLogIds.add(log.id);
  }

  // ── Pass 3 · a recorded dose is never silently dropped ──────────────────────
  //
  // Whatever is still unmatched has no slot to return to at all: its schedule was
  // deleted, or deactivated, or its window no longer covers this date. It is still
  // a RECORDED FACT about a medication, so it is surfaced as its own row rather
  // than disappearing — the same rule the caregiver weekly summary already
  // applies. Logs whose medication is not in the supplied set are skipped: without
  // the medication there is no name to show, and a nameless dose row would be
  // worse than the omission.
  for (const log of logs) {
    if (matchedLogIds.has(log.id)) continue;
    const medication = medicationById.get(log.medication_id);
    if (!medication) continue;
    items.push({
      key: `logged|${log.id}`,
      medicationId: medication.id,
      scheduleId: log.schedule_id,
      medicationName: medication.name,
      dosage: medication.dosage,
      form: medication.form,
      instructions: medication.instructions,
      withFood: medication.with_food,
      scheduledTime: log.scheduled_time,
      status: log.status,
      logId: log.id,
      responsibleUserId: medication.responsible_user_id,
    });
  }

  items.sort(byTimeThenName);
  return items;
}

/** Counts for the dashboard summary: total scheduled, given, and remaining. */
export function summarizeDoses(items: DoseItem[]): DoseSummary {
  const total = items.length;
  const given = items.filter((item) => item.status === 'given').length;
  return { total, given, remaining: total - given };
}
