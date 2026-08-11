import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { CircleMember } from '@/features/circle-members/api';
import type { Medication, MedicationLog, MedicationSchedule } from '@/features/medications/api';
import { computeDoseItems } from '@/features/medications/today';
import {
  combineDateTimeToInstant,
  dayOfWeekFromYmd,
  formatHm,
  hmFromInstant,
  ymdFromInstant,
} from '@/utils/date';

import { supabase } from '../../../lib/supabase';

/**
 * The family's weekly compliance summary — the READ side.
 *
 * This module answers one question and nothing else: for ONE hired caregiver, over
 * ONE chosen week, what happened to the doses she is responsible for and how many
 * tasks did she complete. It is deliberately a RECORD, not a verdict: there is no
 * ratio, no score, no trend and no derived "performance" value anywhere in the
 * returned shape — only counts and the individual rows behind them.
 *
 * ── HOW A SCHEDULED DOSE IS DEFINED ─────────────────────────────────────────
 * It is NOT redefined here. The expansion is `computeDoseItems()` from
 * `@/features/medications/today` — the same pure function the Home dose strip and
 * the medications screen use — called once per day of the week. Writing a second
 * expansion is exactly how two screens start disagreeing about what was scheduled,
 * so the only thing this file adds is the per-day loop and the responsibility scope.
 *
 * ── ON TIME vs LATE vs NOT RECORDED ─────────────────────────────────────────
 *   on time      — a log with status 'given' whose `recorded_at` is at most the
 *                  circle's missed-dose grace AFTER the scheduled datetime
 *                  (recording early is on time; the delta may be negative).
 *   late         — a log with status 'given' beyond that grace.
 *   not recorded — no log row at all for that scheduled dose.
 *   postponed / missed — their OWN facts, kept separate. They are explicitly NOT
 *                  folded into "not recorded": somebody DID record something, and
 *                  erasing that would misrepresent the worker.
 *   recorded by
 *   another member — the dose was hers to give, but the LOG is someone else's.
 *                  Graded as nothing: see the attribution note on `classify`.
 * The grace is read per circle from `care_circles.missed_dose_grace_minutes` (via
 * `useMissedDoseGrace`) and is never hardcoded here — the caller passes it in.
 *
 * ── TWO DIFFERENT QUESTIONS ─────────────────────────────────────────────────
 * "What was hers to give" is `medications.responsible_user_id` — it selects the
 * rows. "Did she give it" is `medication_logs.recorded_by` — it decides whether a
 * row says anything about her. Conflating the two let a dose a family member
 * covered be graded, on time or late, as the caregiver's work.
 *
 * ── TIME FRAME ──────────────────────────────────────────────────────────────
 * Dates and times are resolved in the DEVICE's local calendar, matching the
 * documented local-time assumption of `computeDoseItems` / `combineDateTimeToInstant`
 * that the whole medication feature already runs on. A viewer in a different zone
 * from the circle can therefore see a dose land on a neighbouring day; that is a
 * pre-existing, app-wide property, not something introduced here.
 */

// ---------------------------------------------------------------------------
// Week arithmetic (local calendar, Sunday-start — matches WEEKDAY_KEYS / getDay)
// ---------------------------------------------------------------------------

export type WeekBounds = {
  /** First day of the week, 'YYYY-MM-DD' (Sunday). */
  start: string;
  /** Last day of the week, 'YYYY-MM-DD' (Saturday). */
  end: string;
  /** All seven days, ascending. */
  days: string[];
  /** 0 = the week containing the anchor date, -1 = the one before it, … */
  offset: number;
};

function ymdToLocalDate(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function localDateToYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `ymd` shifted by whole days in the local calendar (handles month/DST edges). */
export function addDaysYmd(ymd: string, days: number): string {
  const date = ymdToLocalDate(ymd);
  date.setDate(date.getDate() + days);
  return localDateToYmd(date);
}

/**
 * The Sunday→Saturday week `offset` weeks away from the week containing
 * `anchorYmd`. Sunday-start mirrors the DB `days_of_week` convention (0 = Sunday)
 * and `WEEKDAY_KEYS`, so a day index here indexes the existing weekday labels
 * without a second mapping.
 */
export function weekBoundsFor(anchorYmd: string, offset: number): WeekBounds {
  const anchorDow = ymdToLocalDate(anchorYmd).getDay();
  const start = addDaysYmd(anchorYmd, -anchorDow + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
  return { start, end: days[6], days, offset };
}

// ---------------------------------------------------------------------------
// Roster helper — who is a hired caregiver in this circle
// ---------------------------------------------------------------------------

/**
 * The circle's ACTIVE hired caregivers ('caregiver' — the paid worker role, never
 * the 'primary_caregiver' family role). An empty result is what keeps the whole
 * feature invisible for a circle that never hired anyone.
 */
export function activeCaregivers(members: CircleMember[] | undefined): CircleMember[] {
  return (members ?? [])
    .filter((member) => member.role === 'caregiver' && member.status === 'active')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** What happened to one scheduled dose. Facts, with no ranking between them. */
export type DoseOutcome =
  | 'onTime'
  | 'late'
  | 'notRecorded'
  | 'postponed'
  | 'missed'
  | 'notDueYet'
  /**
   * The dose was recorded — by SOMEONE ELSE. It was hers to give, so it belongs
   * on her page; the record is not hers, so nothing about her timing is asserted
   * from it. See the attribution note on {@link classify}.
   */
  | 'recordedByOther';

export type CaregiverWeekDose = {
  /** Stable React key. */
  key: string;
  /** 'YYYY-MM-DD' the dose belongs to. */
  date: string;
  /** Postgres time string as stored ('HH:MM:SS'); format with `formatHm`. */
  scheduledTime: string;
  medicationName: string;
  dosage: string | null;
  outcome: DoseOutcome;
  /** Null when nothing was recorded — the row is then not openable. */
  logId: string | null;
  /** Local 'HH:MM' the record was written, when there is a record. */
  recordedTime: string | null;
  /**
   * Local 'YYYY-MM-DD' the record was written. Carried SEPARATELY from `date`
   * because they genuinely differ: a 23:30 dose recorded at 00:12 belongs to one
   * day and was written on the next, and pairing the dose's date with the
   * record's clock time prints a moment that never happened — on the one line a
   * family reads to judge lateness.
   */
  recordedDate: string | null;
  /**
   * Signed minutes between the scheduled datetime and `recorded_at` for a 'given'
   * log (negative = recorded early). Null when it cannot be computed honestly.
   */
  minutesFromSchedule: number | null;
  note: string | null;
  proofObjectPath: string | null;
};

export type CaregiverWeekDay = {
  date: string;
  /** 0 = Sunday .. 6 = Saturday — indexes WEEKDAY_KEYS directly. */
  weekdayIndex: number;
  doses: CaregiverWeekDose[];
};

export type CaregiverWeekSummary = {
  counts: Record<DoseOutcome, number>;
  /** Only days that carry at least one scheduled or recorded dose, ascending. */
  days: CaregiverWeekDay[];
  tasksCompleted: number;
  /**
   * The grace the on-time/late split was computed with, shown to the reader.
   * NULL when the circle's setting could not be read — in which case no dose is
   * classified «متأخّرة» at all and the explanatory note is not drawn. Stating a
   * threshold we never read, next to a judgement about a person's work, would be
   * the worst of both.
   */
  graceMinutes: number | null;
  /** True when the week holds no dose row and no completed task at all. */
  isEmpty: boolean;
};

export type CaregiverWeekRaw = {
  medications: Medication[];
  schedules: MedicationSchedule[];
  logs: MedicationLog[];
  tasksCompleted: number;
};

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export const caregiverWeekKeys = {
  all: ['caregiver-week'] as const,
  week: (circleId: string | undefined, caregiverUserId: string | undefined, weekStart: string) =>
    ['caregiver-week', circleId, caregiverUserId, weekStart] as const,
};

/**
 * Everything the week needs, scoped to ONE caregiver:
 *  - medications she is `responsible_user_id` for (active AND inactive — a
 *    discontinued medication must not silently erase the week it was given in),
 *  - every schedule of those medications (`computeDoseItems` applies `is_active`
 *    and the start/end window itself),
 *  - the medication_logs for those medications inside the week,
 *  - a count of care_tasks she completed inside the week.
 *
 * Reads only. RLS remains authoritative — a viewer without
 * `can_view_all_operational` sees only the log rows they are themselves
 * responsible for.
 *
 * Since D1 (2026-08-07) that set is just the hired `caregiver`: admin,
 * primary_caregiver, family_member and remote_member are all inside the function now.
 * So the REASON for the manager gate changed even though the gate itself did not — it
 * is no longer "otherwise a family_member would render a half-empty week from rows she
 * cannot read", it is the Milestone-8 product decision that the weekly caregiver
 * summary is the family's oversight view and belongs to managers. Keep the gate at
 * `week-summary.tsx`; do not re-derive it from RLS reachability.
 */
export async function fetchCaregiverWeekRaw(
  circleId: string,
  caregiverUserId: string,
  week: WeekBounds,
): Promise<CaregiverWeekRaw> {
  const { data: medicationRows, error: medicationError } = await supabase
    .from('medications')
    .select('*')
    .eq('circle_id', circleId)
    .eq('responsible_user_id', caregiverUserId)
    .order('name', { ascending: true });
  if (medicationError) throw medicationError;

  const medications = medicationRows ?? [];
  const medicationIds = medications.map((medication) => medication.id);

  let schedules: MedicationSchedule[] = [];
  let logs: MedicationLog[] = [];
  if (medicationIds.length > 0) {
    const [scheduleResult, logResult] = await Promise.all([
      supabase
        .from('medication_schedules')
        .select('*')
        .eq('circle_id', circleId)
        .in('medication_id', medicationIds),
      supabase
        .from('medication_logs')
        .select('*')
        .eq('circle_id', circleId)
        .in('medication_id', medicationIds)
        .gte('dose_date', week.start)
        .lte('dose_date', week.end),
    ]);
    if (scheduleResult.error) throw scheduleResult.error;
    if (logResult.error) throw logResult.error;
    schedules = scheduleResult.data ?? [];
    logs = logResult.data ?? [];
  }

  // Tasks are counted by completion INSTANT, so a task created long before the
  // week still counts in the week it was finished in.
  const fromInstant = combineDateTimeToInstant(week.start, '00:00');
  const toInstant = combineDateTimeToInstant(addDaysYmd(week.end, 1), '00:00');
  let tasksCompleted = 0;
  if (fromInstant && toInstant) {
    const { count, error } = await supabase
      .from('care_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('completed_by', caregiverUserId)
      .eq('status', 'completed')
      .gte('completed_at', fromInstant)
      .lt('completed_at', toInstant);
    if (error) throw error;
    tasksCompleted = count ?? 0;
  }

  return { medications, schedules, logs, tasksCompleted };
}

// ---------------------------------------------------------------------------
// The computation (pure)
// ---------------------------------------------------------------------------

/**
 * Classifies one scheduled dose. When the scheduled datetime cannot be resolved
 * we deliberately fall back to 'onTime' with a null delta rather than 'late':
 * "late" is a statement about a person's work and must never be asserted from a
 * value we could not actually compute.
 *
 * ── WHOSE RECORD IS IT ──────────────────────────────────────────────────────
 * The doses on this page are selected by `medications.responsible_user_id` —
 * i.e. what was HERS TO GIVE. Whether SHE gave it is a different question, and
 * the answer is `medication_logs.recorded_by`, which Milestone 9 B1 made
 * server-authoritative (a BEFORE trigger assigns it from `auth.uid()` and holds
 * it immutable; the client cannot send it). Before this check the two questions
 * were conflated: a daughter who covered a dose one evening produced a log that
 * filled the caregiver's slot and was then graded — on time, or LATE — as the
 * caregiver's work. That is the same class of misjudgement the grace note and
 * the neutral «متأخّرة» tone exist to prevent, and it was the one place the page
 * could state something about her that simply was not true.
 *
 * A record by anyone else therefore short-circuits BEFORE any timing or status
 * is read: nothing is asserted about her from a record she did not make.
 *
 * `recorded_by` is nullable, and a null means the author is unknown (rows that
 * predate the trigger). Unknown is not "someone else": diverting those would
 * blank out historical weeks on a guess. They keep the previous behaviour.
 */
function classify(
  log: MedicationLog | null,
  date: string,
  scheduledTime: string,
  graceMinutes: number | null,
  nowMs: number,
  caregiverUserId: string,
): { outcome: DoseOutcome; minutesFromSchedule: number | null } {
  const scheduledIso = combineDateTimeToInstant(date, formatHm(scheduledTime));
  const scheduledMs = scheduledIso ? new Date(scheduledIso).getTime() : NaN;

  if (!log) {
    // A dose whose time has NOT ARRIVED cannot be "not recorded" — nobody was
    // late for something that has not happened. Without this, opening the CURRENT
    // week counts every remaining dose of today and of the days after it against
    // a named worker, which is precisely the punitive misreading this feature
    // exists to avoid. Past-but-unlogged stays `notRecorded`; that is a fact.
    if (!Number.isNaN(scheduledMs) && scheduledMs > nowMs) {
      return { outcome: 'notDueYet', minutesFromSchedule: null };
    }
    return { outcome: 'notRecorded', minutesFromSchedule: null };
  }
  // Not her record — say so, and assert nothing else about it.
  if (log.recorded_by !== null && log.recorded_by !== caregiverUserId) {
    return { outcome: 'recordedByOther', minutesFromSchedule: null };
  }
  if (log.status === 'postponed') return { outcome: 'postponed', minutesFromSchedule: null };
  if (log.status === 'missed') return { outcome: 'missed', minutesFromSchedule: null };

  const recordedMs = new Date(log.recorded_at).getTime();
  if (Number.isNaN(scheduledMs) || Number.isNaN(recordedMs)) {
    return { outcome: 'onTime', minutesFromSchedule: null };
  }
  const delta = Math.round((recordedMs - scheduledMs) / 60_000);
  // A null grace means the circle's setting could not be read. Asserting «متأخّرة»
  // against a number we invented would be stating something about this person's
  // work that we never actually computed — the same principle the block above
  // applies to an unresolvable schedule.
  if (graceMinutes === null) return { outcome: 'onTime', minutesFromSchedule: delta };
  return { outcome: delta > graceMinutes ? 'late' : 'onTime', minutesFromSchedule: delta };
}

function toDose(params: {
  key: string;
  date: string;
  scheduledTime: string;
  medicationName: string;
  dosage: string | null;
  log: MedicationLog | null;
  graceMinutes: number | null;
  nowMs: number;
  caregiverUserId: string;
}): CaregiverWeekDose {
  const { key, date, scheduledTime, medicationName, dosage, log, graceMinutes, nowMs, caregiverUserId } =
    params;
  const { outcome, minutesFromSchedule } = classify(
    log,
    date,
    scheduledTime,
    graceMinutes,
    nowMs,
    caregiverUserId,
  );
  return {
    key,
    date,
    scheduledTime,
    medicationName,
    dosage,
    outcome,
    logId: log?.id ?? null,
    recordedTime: log ? hmFromInstant(log.recorded_at) || null : null,
    recordedDate: log ? ymdFromInstant(log.recorded_at) || null : null,
    minutesFromSchedule,
    note: log?.note ?? null,
    proofObjectPath: log?.proof_object_path ?? null,
  };
}

/**
 * Folds the raw rows into the week's record. Expands each day through the shared
 * `computeDoseItems`, then adds any log in that day which matched NO expanded dose
 * (its schedule was since deactivated or deleted) as its own row — a recorded fact
 * must never disappear because the schedule behind it changed later.
 */
export function summarizeCaregiverWeek(
  raw: CaregiverWeekRaw,
  week: WeekBounds,
  graceMinutes: number | null,
  caregiverUserId: string,
): CaregiverWeekSummary {
  const medicationById = new Map(raw.medications.map((medication) => [medication.id, medication]));
  const logById = new Map(raw.logs.map((log) => [log.id, log]));

  const logsByDate = new Map<string, MedicationLog[]>();
  for (const log of raw.logs) {
    const bucket = logsByDate.get(log.dose_date);
    if (bucket) bucket.push(log);
    else logsByDate.set(log.dose_date, [log]);
  }

  const counts: Record<DoseOutcome, number> = {
    onTime: 0,
    late: 0,
    notRecorded: 0,
    postponed: 0,
    missed: 0,
    notDueYet: 0,
    recordedByOther: 0,
  };
  const days: CaregiverWeekDay[] = [];

  // Read the clock ONCE for the whole summary. Reading it per dose would let a
  // dose flip from notDueYet to notRecorded midway through building one week,
  // producing a page that does not agree with itself.
  const nowMs = Date.now();

  for (const date of week.days) {
    const dayLogs = logsByDate.get(date) ?? [];
    const items = computeDoseItems({
      date,
      medications: raw.medications,
      schedules: raw.schedules,
      logs: dayLogs,
    });

    const matchedLogIds = new Set<string>();
    const doses: CaregiverWeekDose[] = items.map((item) => {
      const log = item.logId ? logById.get(item.logId) ?? null : null;
      if (log) matchedLogIds.add(log.id);
      return toDose({
        key: `${date}|${item.key}`,
        date,
        scheduledTime: item.scheduledTime,
        medicationName: item.medicationName,
        dosage: item.dosage,
        log,
        graceMinutes,
        nowMs,
        caregiverUserId,
      });
    });

    for (const log of dayLogs) {
      if (matchedLogIds.has(log.id)) continue;
      const medication = medicationById.get(log.medication_id);
      doses.push(
        toDose({
          key: `${date}|orphan|${log.id}`,
          date,
          scheduledTime: log.scheduled_time,
          medicationName: medication?.name ?? '',
          dosage: medication?.dosage ?? null,
          log,
          graceMinutes,
          nowMs,
          caregiverUserId,
        }),
      );
    }

    doses.sort((a, b) => {
      if (a.scheduledTime !== b.scheduledTime) return a.scheduledTime < b.scheduledTime ? -1 : 1;
      return a.medicationName.localeCompare(b.medicationName);
    });

    for (const dose of doses) counts[dose.outcome] += 1;
    if (doses.length > 0) {
      days.push({ date, weekdayIndex: dayOfWeekFromYmd(date) ?? 0, doses });
    }
  }

  return {
    counts,
    days,
    tasksCompleted: raw.tasksCompleted,
    graceMinutes,
    isEmpty: days.length === 0 && raw.tasksCompleted === 0,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * The week's record for one caregiver. The network read is keyed by circle +
 * caregiver + week start only; the grace is applied in a pure `useMemo`, so
 * changing the circle's grace re-splits on-time/late without refetching anything.
 */
export function useCaregiverWeek(params: {
  circleId: string | undefined;
  caregiverUserId: string | undefined;
  week: WeekBounds;
  graceMinutes: number | null;
  enabled?: boolean;
}) {
  const { circleId, caregiverUserId, week, graceMinutes, enabled = true } = params;

  const query = useQuery({
    queryKey: caregiverWeekKeys.week(circleId, caregiverUserId, week.start),
    queryFn: () => fetchCaregiverWeekRaw(circleId as string, caregiverUserId as string, week),
    enabled: enabled && Boolean(circleId) && Boolean(caregiverUserId),
  });

  const summary = useMemo<CaregiverWeekSummary | null>(
    () =>
      query.data && caregiverUserId
        ? summarizeCaregiverWeek(query.data, week, graceMinutes, caregiverUserId)
        : null,
    [query.data, week, graceMinutes, caregiverUserId],
  );

  return {
    summary,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
