// check-missed-doses — scheduled Edge Function.
//
// For each scheduled dose whose time (in the CARE-CIRCLE timezone) passed more than
// the configured grace period ago — and is not older than the max-age backstop —
// with STILL no medication_log, enqueues ONE neutral "not recorded" alert to the
// RESPONSIBLE owner (an unassigned medication → managers, via the responsibility
// resolver). If an ASSIGNED medication's owner still hasn't acted by the manager-
// escalation threshold, a second TIER-2 alert (data.tier='manager') is enqueued to
// the circle's managers. The message never interprets the missed dose medically.
//
// RESPONSIBILITY-AWARE (Phase 2F-4B): owner tier via
// notification_recipients_for_item_event(circle,'medication_missed','medication',
// medicationId); manager tier via notification_item_managers(circle). Every row
// carries data.entity + data.itemId + the occurrence keys; escalation rows also set
// data.tier='manager'. remote_member/elder exclusion + preferences are enforced in
// SQL (owner tier by the resolver; manager tier by the send-time currency gate's
// data.tier='manager' branch). Owner recipients are resolved PER MEDICATION (the
// owner varies by item); managers are circle-level by nature.
//
// False-positive safety: log existence is re-checked at run time, so a dose recorded
// after the grace period never produces a missed alert. Idempotent via stable
// per-dose dedupe keys (owner + manager tiers dedupe independently).
//
// REQUIRES migrations 20260626163000 + 20260626164000 applied first. DEPLOY MANUALLY.

import { authorizeScheduledRequest, unauthorized } from '../_shared/auth.ts';
import { REMINDER_CONFIG } from '../_shared/config.ts';
import {
  enqueueForRecipient,
  fetchCircleTimezones,
  notificationManagers,
  recipientsForItem,
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
  // Managers are notified once the dose is this many minutes past its time (tier-2).
  const escalationEnd = new Date(
    now.getTime() - REMINDER_CONFIG.missedDoseManagerEscalationMinutes * 60000,
  );

  // Owner recipients vary by MEDICATION (not per circle), so they are cached per item.
  const ownerCache = new Map<string, Recipient[]>();
  async function ownerRecipients(circleId: string, medicationId: string): Promise<Recipient[]> {
    const key = `${circleId}:${medicationId}`;
    const cached = ownerCache.get(key);
    if (cached) return cached;
    const r = await recipientsForItem(sb, circleId, 'medication_missed', 'medication', medicationId);
    ownerCache.set(key, r);
    return r;
  }
  // Managers are circle-level (tier-2 escalation audience), so they are cached per circle.
  const managerCache = new Map<string, Recipient[]>();
  async function managerRecipients(circleId: string): Promise<Recipient[]> {
    const cached = managerCache.get(circleId);
    if (cached) return cached;
    const r = await notificationManagers(sb, circleId);
    managerCache.set(circleId, r);
    return r;
  }

  let count = 0;
  let escalated = 0;
  try {
    const circleTz = await fetchCircleTimezones(sb);
    const { data: schedules, error } = await sb
      .from('medication_schedules')
      .select(
        'id, circle_id, medication_id, days_of_week, times, start_date, end_date, medications!inner(name, is_active, responsible_user_id)',
      )
      .eq('is_active', true)
      .eq('medications.is_active', true)
      .limit(REMINDER_CONFIG.maxSchedulesPerRun);
    if (error) throw error;

    for (const s of schedules ?? []) {
      const tz = circleTz.get(s.circle_id) ?? 'UTC';
      const med = s.medications as { name: string; is_active: boolean; responsible_user_id: string | null };

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

          const msg = medicationMissedMessage(med.name, time);
          // Bounded follow-up window: a missed-dose alert is only relevant up to the
          // max-age backstop after the dose time.
          const expiresAt = new Date(
            doseAt.getTime() + REMINDER_CONFIG.missedDoseMaxAgeMinutes * 60000,
          ).toISOString();

          // ── Owner tier: the responsible owner (an unassigned medication → managers). ──
          const owners = await ownerRecipients(s.circle_id, s.medication_id);
          for (const r of owners) {
            const created = await enqueueForRecipient(sb, r, {
              type: 'medication_missed',
              title: msg.title,
              body: msg.body,
              circleId: s.circle_id,
              deepLink: '/medications',
              dedupeKey: `med_missed:${s.id}:${day.ymd}:${time}`,
              expiresAt,
              // Immutable occurrence context for source-validity (no names/values) +
              // entity/itemId for the ownership-currency gate.
              data: {
                type: 'medication_missed',
                circleId: s.circle_id,
                entity: 'medication',
                itemId: s.medication_id,
                medicationId: s.medication_id,
                scheduleId: s.id,
                doseDate: day.ymd,
                scheduledTime: time,
              },
            });
            if (created) count++;
          }

          // ── Tier-2 manager escalation ──────────────────────────────────────────────
          // ONLY for an ASSIGNED medication whose owner did not act by the escalation
          // threshold. An UNASSIGNED medication already reaches managers in the owner
          // tier (resolver fallback), so escalating it too would double-notify — hence
          // the responsible_user_id guard. Managers are resolved via
          // notification_item_managers; preference/remote eligibility for these rows is
          // enforced at send time by notification_recipient_current (data.tier='manager'
          // branch), so no producer-side filtering bypasses SQL.
          if (med.responsible_user_id && doseAt <= escalationEnd) {
            const managers = await managerRecipients(s.circle_id);
            for (const m of managers) {
              const created = await enqueueForRecipient(sb, m, {
                type: 'medication_missed',
                title: msg.title,
                body: msg.body,
                circleId: s.circle_id,
                deepLink: '/medications',
                dedupeKey: `med_missed_mgr:${s.id}:${day.ymd}:${time}`,
                expiresAt,
                data: {
                  type: 'medication_missed',
                  circleId: s.circle_id,
                  entity: 'medication',
                  itemId: s.medication_id,
                  medicationId: s.medication_id,
                  scheduleId: s.id,
                  doseDate: day.ymd,
                  scheduledTime: time,
                  tier: 'manager',
                },
              });
              if (created) escalated++;
            }
          }
        }
      }
    }
  } catch (error) {
    logError('check_missed_doses_failed', error);
    return json({ ok: false }, 500);
  }

  log('check_missed_doses_done', { missed: count, escalated });
  return json({ ok: true, missed: count, escalated });
});
