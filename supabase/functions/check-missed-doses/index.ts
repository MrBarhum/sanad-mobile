// check-missed-doses — scheduled Edge Function.
//
// For each scheduled dose whose time (in the CARE-CIRCLE timezone) passed more
// than the configured grace period ago — and is not older than the max-age
// backstop — with STILL no medication_log, enqueues ONE neutral "not recorded"
// alert. The message never interprets the missed dose medically. The dose is one
// canonical occurrence in the circle's zone, so every eligible recipient sees the
// same event (per their preferences). DEPLOY MANUALLY.
//
// False-positive safety: log existence is re-checked at run time, so a dose
// recorded after the grace period never produces a missed alert. Idempotent via a
// stable per-dose dedupe key.

import { authorizeScheduledRequest, unauthorized } from '../_shared/auth.ts';
import { REMINDER_CONFIG } from '../_shared/config.ts';
import {
  enqueueForRecipient,
  fetchCircleTimezones,
  recipientsFor,
  type Recipient,
} from '../_shared/enqueue.ts';
import { log, logError } from '../_shared/log.ts';
import { medicationMissedMessage } from '../_shared/messages.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { localWeekday, localYmd, parseHms, wallTimeToInstant, ymdInRange } from '../_shared/time.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (!authorizeScheduledRequest(req)) return unauthorized();

  const sb = serviceClient();
  const now = new Date();
  const graceEnd = new Date(now.getTime() - REMINDER_CONFIG.missedDoseGraceMinutes * 60000);
  const oldest = new Date(now.getTime() - REMINDER_CONFIG.missedDoseMaxAgeMinutes * 60000);

  const recipientCache = new Map<string, Recipient[]>();
  async function getRecipients(circleId: string) {
    const cached = recipientCache.get(circleId);
    if (cached) return cached;
    const recipients = await recipientsFor(sb, circleId, 'medication_missed');
    recipientCache.set(circleId, recipients);
    return recipients;
  }

  let count = 0;
  try {
    const circleTz = await fetchCircleTimezones(sb);
    const { data: schedules, error } = await sb
      .from('medication_schedules')
      .select(
        'id, circle_id, medication_id, days_of_week, times, start_date, end_date, medications!inner(name, is_active)',
      )
      .eq('is_active', true)
      .eq('medications.is_active', true)
      .limit(REMINDER_CONFIG.maxSchedulesPerRun);
    if (error) throw error;

    for (const s of schedules ?? []) {
      const tz = circleTz.get(s.circle_id) ?? 'UTC';
      const medName = (s.medications as { name: string }).name;

      // A dose past grace could be earlier today or late yesterday (circle-local).
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const days = [
        { ymd: localYmd(now, tz), weekday: localWeekday(now, tz) },
        { ymd: localYmd(yesterday, tz), weekday: localWeekday(yesterday, tz) },
      ];

      for (const day of days) {
        if (!s.days_of_week.includes(day.weekday)) continue;
        if (!ymdInRange(day.ymd, s.start_date, s.end_date)) continue;
        const [yy, mm, dd] = day.ymd.split('-').map(Number);

        for (const time of s.times as string[]) {
          const { hour, minute } = parseHms(time);
          const doseAt = wallTimeToInstant(yy, mm, dd, hour, minute, tz);
          if (doseAt > graceEnd || doseAt < oldest) continue;

          const { count: logged, error: logErr } = await sb
            .from('medication_logs')
            .select('id', { count: 'exact', head: true })
            .eq('schedule_id', s.id)
            .eq('dose_date', day.ymd)
            .eq('scheduled_time', time);
          if (logErr) throw logErr;
          if ((logged ?? 0) > 0) continue; // recorded — never a false positive

          const recipients = await getRecipients(s.circle_id);
          if (recipients.length === 0) continue;
          const msg = medicationMissedMessage(medName, time);
          // Bounded follow-up window: a missed-dose alert is only relevant up to the
          // max-age backstop after the dose time.
          const expiresAt = new Date(
            doseAt.getTime() + REMINDER_CONFIG.missedDoseMaxAgeMinutes * 60000,
          ).toISOString();
          for (const r of recipients) {
            const created = await enqueueForRecipient(sb, r, {
              type: 'medication_missed',
              title: msg.title,
              body: msg.body,
              circleId: s.circle_id,
              deepLink: '/medications',
              dedupeKey: `med_missed:${s.id}:${day.ymd}:${time}`,
              expiresAt,
              // Immutable occurrence context for source-validity (no names/values).
              data: {
                type: 'medication_missed',
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
  } catch (error) {
    logError('check_missed_doses_failed', error);
    return json({ ok: false }, 500);
  }

  log('check_missed_doses_done', { missed: count });
  return json({ ok: true, missed: count });
});
