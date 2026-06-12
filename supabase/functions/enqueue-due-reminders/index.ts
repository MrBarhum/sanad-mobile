// enqueue-due-reminders — scheduled Edge Function.
//
// Scans active medication schedules, open tasks and scheduled appointments and
// idempotently enqueues notifications for what is coming due inside this run's
// window. Wall-clock medication/task schedules are resolved into ONE canonical
// absolute occurrence using the CARE-CIRCLE timezone (not each recipient's zone),
// so a remote member receives the same dose event as the local caregiver — just
// subject to their own preferences/quiet hours. Appointments use their absolute
// `starts_at`. Recipients + de-dup live in the DB. DEPLOY MANUALLY.

import { authorizeScheduledRequest, unauthorized } from '../_shared/auth.ts';
import { REMINDER_CONFIG } from '../_shared/config.ts';
import {
  enqueueForRecipient,
  fetchCircleTimezones,
  recipientsFor,
  type Recipient,
} from '../_shared/enqueue.ts';
import { log, logError } from '../_shared/log.ts';
import { appointmentMessage, medicationDueMessage, taskDueMessage } from '../_shared/messages.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { localWeekday, localYmd, parseHms, wallTimeToInstant, ymdInRange } from '../_shared/time.ts';

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (!authorizeScheduledRequest(req)) return unauthorized();

  const sb = serviceClient();
  const now = new Date();
  const counters = { medication: 0, task: 0, appointment: 0 };

  const recipientCache = new Map<string, Recipient[]>();
  async function getRecipients(circleId: string, type: Parameters<typeof recipientsFor>[2]) {
    const key = `${circleId}:${type}`;
    const cached = recipientCache.get(key);
    if (cached) return cached;
    const recipients = await recipientsFor(sb, circleId, type);
    recipientCache.set(key, recipients);
    return recipients;
  }

  try {
    const circleTz = await fetchCircleTimezones(sb);
    counters.medication = await enqueueMedicationDue(sb, now, circleTz, getRecipients);
    counters.task = await enqueueTaskDue(sb, now, circleTz, getRecipients);
    counters.appointment = await enqueueAppointmentUpcoming(sb, now, getRecipients);
  } catch (error) {
    logError('enqueue_due_reminders_failed', error);
    return json({ ok: false }, 500);
  }

  log('enqueue_due_reminders_done', counters);
  return json({ ok: true, ...counters });
});

type GetRecipients = (
  circleId: string,
  type: Parameters<typeof recipientsFor>[2],
) => Promise<Recipient[]>;

/** Today + tomorrow in the CIRCLE timezone, so a dose just after circle-local
 * midnight is not missed by the lookahead window. */
function candidateDays(now: Date, timezone: string): { ymd: string; weekday: number }[] {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return [
    { ymd: localYmd(now, timezone), weekday: localWeekday(now, timezone) },
    { ymd: localYmd(tomorrow, timezone), weekday: localWeekday(tomorrow, timezone) },
  ];
}

async function enqueueMedicationDue(
  sb: SupabaseClient,
  now: Date,
  circleTz: Map<string, string>,
  getRecipients: GetRecipients,
): Promise<number> {
  const windowEnd = new Date(now.getTime() + REMINDER_CONFIG.medicationLookaheadMinutes * 60000);

  const { data: schedules, error } = await sb
    .from('medication_schedules')
    .select(
      'id, circle_id, medication_id, days_of_week, times, start_date, end_date, medications!inner(name, is_active)',
    )
    .eq('is_active', true)
    .eq('medications.is_active', true)
    .limit(REMINDER_CONFIG.maxSchedulesPerRun);
  if (error) throw error;

  let count = 0;
  for (const s of schedules ?? []) {
    const tz = circleTz.get(s.circle_id) ?? 'UTC';
    const medName = (s.medications as { name: string }).name;

    // One canonical occurrence per (schedule, circle-local day, time).
    for (const day of candidateDays(now, tz)) {
      if (!s.days_of_week.includes(day.weekday)) continue;
      if (!ymdInRange(day.ymd, s.start_date, s.end_date)) continue;
      const [yy, mm, dd] = day.ymd.split('-').map(Number);

      for (const time of s.times as string[]) {
        const { hour, minute } = parseHms(time);
        const doseAt = wallTimeToInstant(yy, mm, dd, hour, minute, tz);
        if (doseAt < now || doseAt > windowEnd) continue;

        // Already recorded for this scheduled dose → no due reminder.
        const { count: logged, error: logErr } = await sb
          .from('medication_logs')
          .select('id', { count: 'exact', head: true })
          .eq('schedule_id', s.id)
          .eq('dose_date', day.ymd)
          .eq('scheduled_time', time);
        if (logErr) throw logErr;
        if ((logged ?? 0) > 0) continue;

        const recipients = await getRecipients(s.circle_id, 'medication_due');
        if (recipients.length === 0) continue;
        const msg = medicationDueMessage(medName, time);
        // A due reminder is only relevant until the missed-dose grace boundary.
        const expiresAt = new Date(
          doseAt.getTime() + REMINDER_CONFIG.missedDoseGraceMinutes * 60000,
        ).toISOString();
        for (const r of recipients) {
          const created = await enqueueForRecipient(sb, r, {
            type: 'medication_due',
            title: msg.title,
            body: msg.body,
            circleId: s.circle_id,
            deepLink: '/medications',
            dedupeKey: `med:${s.id}:${day.ymd}:${time}`,
            expiresAt,
            // Immutable occurrence context for source-validity (no names/values).
            data: {
              type: 'medication_due',
              circleId: s.circle_id,
              medicationId: s.medication_id,
              scheduleId: s.id,
              doseDate: day.ymd,
              scheduledTime: time,
            },
          });
          if (created) count++;
        }
      }
    }
  }
  return count;
}

async function enqueueTaskDue(
  sb: SupabaseClient,
  now: Date,
  circleTz: Map<string, string>,
  getRecipients: GetRecipients,
): Promise<number> {
  const windowEnd = new Date(now.getTime() + REMINDER_CONFIG.taskLookaheadMinutes * 60000);

  const { data: tasks, error } = await sb
    .from('care_tasks')
    .select('id, circle_id, title, due_date, due_time, status')
    .eq('status', 'open')
    .not('due_date', 'is', null)
    .limit(REMINDER_CONFIG.maxTasksPerRun);
  if (error) throw error;

  let count = 0;
  for (const task of tasks ?? []) {
    const tz = circleTz.get(task.circle_id) ?? 'UTC';
    const [yy, mm, dd] = (task.due_date as string).split('-').map(Number);
    // Date-only tasks remind at 09:00 circle-local.
    const { hour, minute } = task.due_time ? parseHms(task.due_time) : { hour: 9, minute: 0 };
    const dueAt = wallTimeToInstant(yy, mm, dd, hour, minute, tz);
    if (dueAt < now || dueAt > windowEnd) continue;

    const recipients = await getRecipients(task.circle_id, 'task_due');
    if (recipients.length === 0) continue;
    const msg = taskDueMessage(task.title);
    const dueAtIso = dueAt.toISOString();
    // Occurrence component uses the task's RAW due_time ('none' for date-only) so a
    // reschedule yields a NEW key (new reminder) and the old occurrence fails
    // source-validity. Task reminders expire a bounded window after the due time
    // (still gated on the task staying open by source-validity).
    const occurrence = task.due_time ?? 'none';
    const expiresAt = new Date(
      dueAt.getTime() + REMINDER_CONFIG.taskReminderExpiryHours * 3600000,
    ).toISOString();
    for (const r of recipients) {
      const created = await enqueueForRecipient(sb, r, {
        type: 'task_due',
        title: msg.title,
        body: msg.body,
        circleId: task.circle_id,
        deepLink: `/tasks/${task.id}`,
        dedupeKey: `task:${task.id}:${task.due_date}:${occurrence}`,
        expiresAt,
        data: {
          type: 'task_due',
          circleId: task.circle_id,
          taskId: task.id,
          dueDate: task.due_date,
          dueTime: task.due_time,
          dueAt: dueAtIso,
        },
      });
      if (created) count++;
    }
  }
  return count;
}

async function enqueueAppointmentUpcoming(
  sb: SupabaseClient,
  now: Date,
  getRecipients: GetRecipients,
): Promise<number> {
  const windowEnd = new Date(now.getTime() + REMINDER_CONFIG.appointmentLookaheadMinutes * 60000);
  let count = 0;

  for (const lead of REMINDER_CONFIG.appointmentLeadMinutes) {
    // starts_at is absolute, so the trigger is timezone-independent: a lead fires
    // when (starts_at - lead) ∈ [now, windowEnd] ⇔ starts_at ∈ [now+lead, windowEnd+lead].
    const lo = new Date(now.getTime() + lead * 60000).toISOString();
    const hi = new Date(windowEnd.getTime() + lead * 60000).toISOString();

    const { data: appts, error } = await sb
      .from('care_appointments')
      .select('id, circle_id, title, starts_at, status')
      .eq('status', 'scheduled')
      .gte('starts_at', lo)
      .lte('starts_at', hi)
      .limit(REMINDER_CONFIG.maxAppointmentsPerRun);
    if (error) throw error;

    for (const appt of appts ?? []) {
      const recipients = await getRecipients(appt.circle_id, 'appointment_upcoming');
      if (recipients.length === 0) continue;
      const msg = appointmentMessage(appt.title, lead);
      for (const r of recipients) {
        const created = await enqueueForRecipient(sb, r, {
          type: 'appointment_upcoming',
          title: msg.title,
          body: msg.body,
          circleId: appt.circle_id,
          deepLink: `/appointments/${appt.id}`,
          // Occurrence-aware: a reschedule (new starts_at) yields a new key + a
          // fresh lead reminder; the old occurrence fails source-validity. Never
          // deliver after the appointment starts.
          dedupeKey: `appt:${appt.id}:${appt.starts_at}:${lead}`,
          expiresAt: appt.starts_at,
          data: {
            type: 'appointment_upcoming',
            circleId: appt.circle_id,
            appointmentId: appt.id,
            startsAt: appt.starts_at,
            leadMinutes: lead,
          },
        });
        if (created) count++;
      }
    }
  }
  return count;
}
