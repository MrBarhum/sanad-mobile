// check-push-receipts — optional scheduled Edge Function.
//
// Expo accepts tickets immediately; the final per-device outcome is read later via
// receipts (they settle minutes after send). This polls per-device deliveries that
// are 'sent' with a ticket and no receipt yet AND at least receiptMinAgeMinutes
// old, OLDEST-FIRST (so a steady stream of new tickets can't starve old ones),
// validates the Expo-ticket ↔ delivery relationship when recording, and — only on
// a definitive DeviceNotRegistered receipt — deactivates that exact token. A
// retention sweep marks tickets past Expo's retention window as 'unchecked' so they
// are not polled forever. Every Supabase call is error-checked. Optional: the
// engine works without it. DEPLOY MANUALLY.

import { authorizeScheduledRequest, unauthorized } from '../_shared/auth.ts';
import { REMINDER_CONFIG } from '../_shared/config.ts';
import { rpcChecked, queryChecked } from '../_shared/db.ts';
import { getExpoReceipts, isUnregisteredError } from '../_shared/expo.ts';
import { log, logError } from '../_shared/log.ts';
import { serviceClient } from '../_shared/supabase.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type PendingRow = { id: string; expo_ticket_id: string; push_token_id: string };

Deno.serve(async (req) => {
  if (!authorizeScheduledRequest(req)) return unauthorized();

  const sb = serviceClient();
  try {
    // Retention: stop polling tickets older than Expo keeps receipts for.
    const retentionCutoff = new Date(
      Date.now() - REMINDER_CONFIG.receiptRetentionHours * 3600_000,
    ).toISOString();
    const sweptUnchecked = await rpcChecked<number>(sb, 'mark_stale_receipts_unchecked', {
      p_cutoff: retentionCutoff,
      p_limit: REMINDER_CONFIG.receiptRetentionSweepLimit,
    });

    // Poll only tickets old enough to have a receipt, oldest-first, bounded.
    const minAgeCutoff = new Date(
      Date.now() - REMINDER_CONFIG.receiptMinAgeMinutes * 60_000,
    ).toISOString();
    const { data: pending } = await queryChecked(
      sb
        .from('notification_push_deliveries')
        .select('id, expo_ticket_id, push_token_id')
        .eq('status', 'sent')
        .not('expo_ticket_id', 'is', null)
        .is('receipt_status', null)
        .lte('sent_at', minAgeCutoff)
        .order('sent_at', { ascending: true })
        .limit(REMINDER_CONFIG.expoReceiptBatchSize),
      'receipts_pending',
    );

    const rows = (pending ?? []) as PendingRow[];
    if (rows.length === 0) {
      log('check_receipts_done', { checked: 0, swept_unchecked: sweptUnchecked });
      return json({ ok: true, checked: 0, swept_unchecked: sweptUnchecked });
    }

    const byTicket = new Map<string, { deliveryId: string; pushTokenId: string }>();
    for (const r of rows) byTicket.set(r.expo_ticket_id, { deliveryId: r.id, pushTokenId: r.push_token_id });

    const receipts = await getExpoReceipts([...byTicket.keys()]);

    let recorded = 0;
    let mismatched = 0;
    let recordErrors = 0;
    let invalidTokens = 0;
    for (const [ticketId, receipt] of Object.entries(receipts)) {
      const target = byTicket.get(ticketId);
      if (!target) continue;
      const errorCode = receipt.status === 'error' ? receipt.details?.error ?? null : null;
      try {
        const wrote = await rpcChecked<boolean>(sb, 'record_delivery_receipt', {
          p_delivery_id: target.deliveryId,
          p_expected_ticket: ticketId,
          p_receipt_id: ticketId,
          p_status: receipt.status,
          p_error_code: errorCode,
          p_details: receipt.status === 'error' ? receipt.message : null,
        });
        if (!wrote) {
          mismatched++;
          log('receipt_mismatch', { delivery_id: target.deliveryId });
          continue;
        }
        recorded++;
        if (isUnregisteredError(errorCode ?? undefined)) {
          invalidTokens++;
          try {
            await rpcChecked(sb, 'deactivate_push_token_by_id', { p_id: target.pushTokenId });
            log('token_invalidated', { push_token_id: target.pushTokenId, delivery_id: target.deliveryId });
          } catch (error) {
            logError('deactivate_failed', error, { push_token_id: target.pushTokenId });
          }
        }
      } catch (error) {
        recordErrors++;
        logError('record_receipt_failed', error, { delivery_id: target.deliveryId });
      }
    }

    log('check_receipts_done', {
      checked: rows.length,
      recorded,
      mismatched,
      record_errors: recordErrors,
      invalid_tokens: invalidTokens,
      swept_unchecked: sweptUnchecked,
    });
    return json({ ok: true, checked: rows.length, recorded, mismatched, recordErrors, invalidTokens });
  } catch (error) {
    logError('check_receipts_failed', error);
    return json({ ok: false }, 500);
  }
});
