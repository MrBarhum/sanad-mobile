// send-daily-summaries — scheduled Edge Function (Milestone 4 · B2).
//
// Runs HOURLY. For each circle whose CURRENT circle-local hour equals the digest
// hour (default 20:00), it composes a one-line Arabic summary of the day's
// activity (doses given, tasks completed, appointments, visits, vitals, daily
// logs — all for the circle-local day) and enqueues it for every remote member
// who opted into the daily digest (notification_preferences.remote_summary), via
// enqueue_notification → outbox. Idempotent per (circle, local date) through the
// dedupe key, so a re-run never double-sends. Tapping the push opens /pulse.
//
// Circle-local timing means each family gets its digest at ~20:00 THEIR time, not
// a single global instant. DEPLOY MANUALLY. Requires migration 20260715140000
// (adds the `daily_summary` type + daily_summary_recipients) applied first.

import { authorizeScheduledRequest, unauthorized } from '../_shared/auth.ts';
import { dailySummaryMessage, type DailyCounts } from '../_shared/digest.ts';
import { enqueueForRecipient, fetchCircleTimezones, type Recipient } from '../_shared/enqueue.ts';
import { log, logError } from '../_shared/log.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { localYmd, wallTimeToInstant, zonedParts } from '../_shared/time.ts';

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Circle-local hour (24h) at which the daily digest is sent. Named so it doesn't
 * fossilize as a magic number: this is the placeholder for a FUTURE per-circle
 * setting (a `care_circles` column + manager control, parallel to
 * `missed_dose_grace_minutes`). No per-circle UI/column this round — the digest
 * fires for every circle at its local 20:00.
 */
const DIGEST_HOUR = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (!authorizeScheduledRequest(req)) return unauthorized();

  const sb = serviceClient();
  const now = new Date();
  const counters = { circlesDue: 0, digestsEnqueued: 0 };

  try {
    const circleTz = await fetchCircleTimezones(sb);

    for (const [circleId, tz] of circleTz) {
      // Fire only in the one hourly run where this circle's local time is 20:xx.
      if (zonedParts(now, tz).hour !== DIGEST_HOUR) continue;
      counters.circlesDue++;

      const ymd = localYmd(now, tz);
      const recipients = await dailySummaryRecipients(sb, circleId);
      if (recipients.length === 0) continue; // nobody opted in → skip the count work

      const counts = await countDailyActivity(sb, circleId, ymd, tz);
      const msg = dailySummaryMessage(counts);

      for (const r of recipients) {
        const created = await enqueueForRecipient(sb, r, {
          type: 'daily_summary',
          title: msg.title,
          body: msg.body,
          circleId,
          deepLink: '/pulse',
          // One digest per recipient per circle-local day (per-user dedupe).
          dedupeKey: `digest:${circleId}:${ymd}`,
          data: { type: 'daily_summary', circleId, date: ymd },
        });
        if (created) counters.digestsEnqueued++;
      }
    }
  } catch (error) {
    logError('send_daily_summaries_failed', error);
    return json({ ok: false }, 500);
  }

  log('send_daily_summaries_done', counters);
  return json({ ok: true, ...counters });
});

async function dailySummaryRecipients(sb: SupabaseClient, circleId: string): Promise<Recipient[]> {
  const { data, error } = await sb.rpc('daily_summary_recipients', { p_circle_id: circleId });
  if (error) throw error;
  return (data ?? []) as Recipient[];
}

/**
 * Counts the day's activity for a circle in ITS local day. Date-keyed tables use
 * the local ymd directly; timestamp-keyed tables use the [00:00, 24:00) local-day
 * instant range. Uses head+count queries so no row data is fetched.
 */
async function countDailyActivity(
  sb: SupabaseClient,
  circleId: string,
  ymd: string,
  tz: string,
): Promise<DailyCounts> {
  const [yy, mm, dd] = ymd.split('-').map(Number);
  const dayStart = wallTimeToInstant(yy, mm, dd, 0, 0, tz).toISOString();
  const dayEnd = wallTimeToInstant(yy, mm, dd + 1, 0, 0, tz).toISOString();

  const take = (res: { count: number | null; error: unknown }): number => {
    if (res.error) throw res.error;
    return res.count ?? 0;
  };

  const dosesGiven = take(
    await sb
      .from('medication_logs')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('dose_date', ymd)
      .eq('status', 'given'),
  );
  const tasksCompleted = take(
    await sb
      .from('care_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('status', 'completed')
      .gte('completed_at', dayStart)
      .lt('completed_at', dayEnd),
  );
  const appointments = take(
    await sb
      .from('care_appointments')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .gte('starts_at', dayStart)
      .lt('starts_at', dayEnd),
  );
  const visits = take(
    await sb
      .from('family_visits')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('status', 'completed')
      .eq('visit_date', ymd),
  );
  const vitals = take(
    await sb
      .from('vital_readings')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .gte('reading_at', dayStart)
      .lt('reading_at', dayEnd),
  );
  const logs = take(
    await sb
      .from('daily_care_logs')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('log_date', ymd),
  );

  return { dosesGiven, tasksCompleted, appointments, visits, vitals, logs };
}
