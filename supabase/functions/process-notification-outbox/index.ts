// process-notification-outbox — scheduled Edge Function.
//
// Two phases per run:
//   A. fan-out  — calls fanout_due_notifications, which materializes one delivery
//      per CURRENT active device token (early-filtering clearly-invalid jobs and
//      re-deferring for quiet hours). Atomic in SQL → no stuck 'fanned' outbox.
//   B. send     — claim_push_deliveries is the AUTHORITATIVE send-time gate: every
//      claim AND stale-lock reclaim RE-VALIDATES expiry, membership, role,
//      preference, quiet hours and token state, stamps a fresh claim_token (lease),
//      and returns ONLY rows still authorized to send. For those rows we read the
//      stored notification content and send a DETAILED, ACTIONABLE payload
//      (Phase 2F-11A: clear title/body + action-category), then record the result
//      PRESENTING THE LEASE — a stale worker whose lock expired loses the lease and
//      is logged `stale_claim`, never recorded as a false success over a newer worker.
//
// PRODUCT DECISION (2F-11A): the push now carries the reminder's real title/body
// (e.g. "حان موعد دواء …") instead of a privacy-generic string, so the lock-screen
// notification says what it is for. The generic copy remains only as a fallback when
// the source row cannot be read. formatPushNotificationContent is the single place
// that builds the payload.
//
// External push is AT-LEAST-ONCE: a network timeout after Expo accepts a request
// can still cause a rare duplicate, and a stale-claim row is reclaimed + resent.
// The lease only prevents stale DB-state corruption; it cannot make an external
// provider exactly-once. Every Supabase call is error-checked; no token (raw or
// partial), title/body, health value, or secret is ever logged. DEPLOY MANUALLY.

import { authorizeScheduledRequest, unauthorized } from '../_shared/auth.ts';
import { REMINDER_CONFIG } from '../_shared/config.ts';
import { rpcChecked } from '../_shared/db.ts';
import {
  isExpoPushToken,
  isUnregisteredError,
  sendExpoPush,
  type ExpoMessage,
  type ExpoTicket,
} from '../_shared/expo.ts';
import { log, logError } from '../_shared/log.ts';
import {
  formatPushNotificationContent,
  type NotificationContentRow,
} from '../_shared/notification-content.ts';
import { serviceClient } from '../_shared/supabase.ts';

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type Claimed = {
  delivery_id: string;
  claim_token: string;
  token: string;
  push_token_id: string;
  notification_id: string;
  circle_id: string | null;
  type: string;
  deep_link: string | null;
  attempt_count: number;
};

type Outgoing = {
  deliveryId: string;
  claimToken: string;
  pushTokenId: string;
  token: string;
  attempt: number;
  message: ExpoMessage;
};

type Counters = { sent: number; failed: number; skipped: number; stale: number; recordErrors: number; invalidTokens: number };

Deno.serve(async (req) => {
  if (!authorizeScheduledRequest(req)) return unauthorized();

  const sb = serviceClient();
  try {
    // Phase A — fan-out + materialize.
    const fan = await rpcChecked<{ fanned: number; skipped: number; deferred: number }[]>(
      sb,
      'fanout_due_notifications',
      { p_limit: REMINDER_CONFIG.fanoutBatchSize, p_max_attempts: REMINDER_CONFIG.fanoutMaxAttempts },
    );
    const fanRow = (fan ?? [])[0] ?? { fanned: 0, skipped: 0, deferred: 0 };

    // Phase B — authoritative claim + send.
    const claimed = await rpcChecked<Claimed[]>(sb, 'claim_push_deliveries', {
      p_limit: REMINDER_CONFIG.deliveryBatchSize,
      p_lock_timeout_seconds: REMINDER_CONFIG.deliveryLockTimeoutSeconds,
      p_max_attempts: REMINDER_CONFIG.deliveryMaxAttempts,
    });
    const result = await deliver(sb, claimed ?? []);

    log('process_outbox_done', { fanout: fanRow, claimed: (claimed ?? []).length, ...result });
    return json({ ok: true, fanout: fanRow, claimed: (claimed ?? []).length, ...result });
  } catch (error) {
    logError('process_outbox_failed', error);
    return json({ ok: false }, 500);
  }
});

async function deliver(sb: SupabaseClient, claimed: Claimed[]): Promise<Counters> {
  const c: Counters = { sent: 0, failed: 0, skipped: 0, stale: 0, recordErrors: 0, invalidTokens: 0 };
  const outgoing: Outgoing[] = [];

  // Read the stored content for every claimed notification once (read-only). The
  // detailed title/body live on the notifications row; the claim RPC returns only
  // routing ids. A read failure is non-fatal — the formatter falls back to generic
  // copy so a reminder still goes out.
  const content = await fetchNotificationContent(sb, claimed);

  for (const d of claimed) {
    // The claim already guarantees an active token owned by the recipient; this
    // is only a format sanity check before handing the value to Expo.
    if (!isExpoPushToken(d.token)) {
      await markSkipped(sb, d.delivery_id, d.claim_token, 'token_format', c);
      continue;
    }
    // Detailed, actionable payload (2F-11A): the real title/body + action category
    // resolved from the stored row, plus the occurrence context the app needs to
    // run the "تم" / snooze actions and deep-link.
    const push = formatPushNotificationContent(d.type, content.get(d.notification_id) ?? null, {
      notificationId: d.notification_id,
      circleId: d.circle_id,
      deepLink: d.deep_link,
    });
    outgoing.push({
      deliveryId: d.delivery_id,
      claimToken: d.claim_token,
      pushTokenId: d.push_token_id,
      token: d.token,
      attempt: d.attempt_count,
      message: {
        to: d.token,
        title: push.title,
        body: push.body,
        channelId: 'default',
        categoryId: push.categoryId,
        sound: 'default',
        priority: d.type === 'emergency' ? 'high' : 'default',
        data: push.data,
      },
    });
  }

  const batchSize = REMINDER_CONFIG.expoPushBatchSize;
  for (let i = 0; i < outgoing.length; i += batchSize) {
    const batch = outgoing.slice(i, i + batchSize);
    let tickets: ExpoTicket[];
    try {
      tickets = await sendExpoPush(batch.map((b) => b.message));
    } catch (error) {
      // Whole batch never reached Expo → retry each (bounded), lease-checked.
      logError('expo_send_batch_failed', error, { size: batch.length });
      for (const b of batch) await failDelivery(sb, b, 'transient_send_error', c);
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const b = batch[j];
      const ticket = tickets[j];
      if (ticket && ticket.status === 'ok') {
        // Expo ACCEPTED the message. Record sent under the lease; if recording
        // fails or the lease was lost, the row stays 'processing' and is reclaimed
        // later (at-least-once) — we never falsely report sent.
        try {
          const owned = await rpcChecked<boolean>(sb, 'mark_delivery_sent', {
            p_delivery_id: b.deliveryId,
            p_claim_token: b.claimToken,
            p_ticket_id: ticket.id,
          });
          if (owned) c.sent++;
          else {
            c.stale++;
            log('stale_claim', { op: 'sent', delivery_id: b.deliveryId });
          }
        } catch (error) {
          c.recordErrors++;
          logError('record_sent_failed', error, { delivery_id: b.deliveryId });
        }
        continue;
      }

      const detail = ticket && ticket.status === 'error' ? ticket.details?.error : undefined;
      if (isUnregisteredError(detail)) {
        c.invalidTokens++;
        try {
          await rpcChecked(sb, 'deactivate_push_token_value', { p_token: b.token });
        } catch (error) {
          logError('deactivate_failed', error, { push_token_id: b.pushTokenId });
        }
        await markSkipped(sb, b.deliveryId, b.claimToken, 'device_not_registered', c);
        log('token_invalidated', { push_token_id: b.pushTokenId, delivery_id: b.deliveryId });
      } else {
        await failDelivery(sb, b, detail ?? 'send_error', c);
      }
    }
  }

  return c;
}

/**
 * Batch-reads the stored content for the claimed notifications (read-only, service
 * role). Returns a map notification_id → row. On error, returns an empty map so the
 * formatter falls back to generic copy. Never logs title/body/health detail.
 */
async function fetchNotificationContent(
  sb: SupabaseClient,
  claimed: Claimed[],
): Promise<Map<string, NotificationContentRow>> {
  const ids = [...new Set(claimed.map((d) => d.notification_id))];
  const map = new Map<string, NotificationContentRow>();
  if (ids.length === 0) return map;
  const { data, error } = await sb
    .from('notifications')
    .select('id, type, title, body, data')
    .in('id', ids);
  if (error) {
    logError('fetch_notification_content_failed', error, { count: ids.length });
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.id as string, {
      type: row.type as string,
      title: (row.title as string | null) ?? null,
      body: (row.body as string | null) ?? null,
      data: (row.data as Record<string, unknown> | null) ?? null,
    });
  }
  return map;
}

async function markSkipped(
  sb: SupabaseClient,
  deliveryId: string,
  claimToken: string,
  reason: string,
  c: Counters,
): Promise<void> {
  try {
    const owned = await rpcChecked<boolean>(sb, 'mark_delivery_skipped', {
      p_delivery_id: deliveryId,
      p_claim_token: claimToken,
      p_reason: reason,
    });
    if (owned) c.skipped++;
    else {
      c.stale++;
      log('stale_claim', { op: 'skipped', delivery_id: deliveryId });
    }
  } catch (error) {
    c.recordErrors++;
    logError('mark_skipped_failed', error, { delivery_id: deliveryId });
  }
}

/** Retry with bounded backoff (lease-checked), or terminal-fail at the cap. */
async function failDelivery(sb: SupabaseClient, b: Outgoing, reason: string, c: Counters): Promise<void> {
  const retryAt =
    b.attempt >= REMINDER_CONFIG.deliveryMaxAttempts
      ? null
      : new Date(Date.now() + REMINDER_CONFIG.deliveryBackoffBaseSeconds * b.attempt * 1000).toISOString();
  try {
    const owned = await rpcChecked<boolean>(sb, 'mark_delivery_failed', {
      p_delivery_id: b.deliveryId,
      p_claim_token: b.claimToken,
      p_error: reason,
      p_retry_at: retryAt ?? undefined,
    });
    if (owned) c.failed++;
    else {
      c.stale++;
      log('stale_claim', { op: 'failed', delivery_id: b.deliveryId });
    }
  } catch (error) {
    c.recordErrors++;
    logError('mark_failed_failed', error, { delivery_id: b.deliveryId });
  }
}
