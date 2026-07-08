# Phase 2F-9A - Expo receipt checker PLAN (no execution)

**Status:** Planning only. This report **designs** (does not run) the first `check-push-receipts` invocation
to confirm the Expo ticket -> receipt path for the already-`sent` positive-push delivery from 2F-8C. **Claude
ran no Supabase CLI, no SQL, made no DB connection, invoked no Edge Function, enabled no cron, processed no
outbox, sent no push, and read no `.env` / secret value.** Every SQL block and PowerShell command below is
**authored for later, separately approved manual use** and is explicitly marked read-only / future /
not-executed. The only filesystem write in this phase is this report; the only commands Claude runs are the two
local read-only checks in Section 11 and the read-only git status/diff in Section 13.

**Baseline (pushed) commit:** `9075522 docs(product): record positive push fixture cleanup`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).

**Sources inspected read-only (no file modified):**

- `docs/claude-reports/2026-07-07-phase-2f-8d-positive-push-fixture-cleanup-record.md`
- `docs/claude-reports/2026-07-07-phase-2f-8c-positive-push-smoke-test-results.md`
- `docs/claude-reports/2026-07-06-phase-2f-8c-positive-push-execution-pack.md`
- Edge receipt checker: `supabase/functions/check-push-receipts/index.ts`
- Shared modules it imports: `_shared/auth.ts` (`authorizeScheduledRequest` / `unauthorized`),
  `_shared/config.ts` (`REMINDER_CONFIG`), `_shared/expo.ts` (`getExpoReceipts` / `isUnregisteredError`),
  `_shared/db.ts` (`rpcChecked` / `queryChecked`), `_shared/log.ts` (`log` / `logError`),
  `_shared/supabase.ts` (`serviceClient`).
- `supabase/config.toml` (`[functions.check-push-receipts] verify_jwt = false`).
- Migrations: `20260611120000_create_notifications_core.sql` (delivery table + receipt columns + statuses),
  `20260611120100_create_notification_functions.sql` (`record_delivery_receipt`,
  `mark_stale_receipts_unchecked`, `deactivate_push_token_by_id`, `deactivate_push_token_value`).

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **This is planning only.** No receipt checker is invoked; no Edge Function is invoked; no DB mutation occurs;
  no push is sent; **cron remains off**.
- **Purpose of the next test:** confirm the Expo **ticket -> receipt** path for the existing `sent` delivery,
  i.e. drive `receipt_status` from `null` to a recorded outcome (ideally `ok`) by running `check-push-receipts`
  exactly once, under explicit approval, against the recorded ticket.
- **Target delivery:** `0fef9576-0854-4c6d-bb0f-6176711103ce`.
- **Target Expo ticket id:** `019f39e8-aadf-7733-848d-34e3c48a3e45`.
- **Current `receipt_status` is expected to be `null`** before the checker runs (recorded so in 2F-8C / 2F-8D).
- **Critical timing finding (source-derived):** `check-push-receipts` runs a **retention sweep first**
  (`mark_stale_receipts_unchecked`) that marks any `sent`, no-receipt, ticketed delivery **older than
  `receiptRetentionHours = 24h`** as `receipt_status = 'unchecked'` **before** it polls Expo. The target was
  `sent_at = 2026-07-07 00:09:37.358776+00`, so the receipt poll is only meaningful while the delivery is still
  **inside the 24h retention window** (roughly up to `2026-07-08 00:09 UTC`) and **older than
  `receiptMinAgeMinutes = 15m`**. Expo itself also retains receipts only ~24h. **Run the checker promptly, and
  confirm the retention-window precheck (Section 5, Block 1) passes immediately before invoking.**
- **This report authorizes nothing to run.** The single `check-push-receipts` invocation requires **separate,
  explicit approval** immediately before execution, after the Section 5 prechecks pass.

---

## 2. Current state from 2F-8C / 2F-8D

Recorded verbatim from the two prior reports (no re-query by Claude in this phase):

| Field | Value |
| ----- | ----- |
| notification id | `c76bcdef-7e21-4f8b-ba94-8372f01f4e28` (`task_due`) |
| outbox id | `3734547d-53f3-4223-9ab9-ccc068422cfd` |
| outbox status | `fanned` |
| delivery id | `0fef9576-0854-4c6d-bb0f-6176711103ce` |
| delivery status | `sent` |
| delivery `sent_at` | `2026-07-07 00:09:37.358776+00` |
| Expo ticket id | `019f39e8-aadf-7733-848d-34e3c48a3e45` |
| `receipt_status` | `null` |
| `delivery_error` (`last_error`) | `null` |
| push_token_id | `93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8` (owner's single active token) |
| owner / recipient | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` |

Additional recorded state:

- **No pending outbox rows** database-wide: `fanned = 1` (the positive row), `skipped = 1` (old invalid
  `945ed6ae-...`), **no `pending`**.
- **Fresh QA task completed** through the app UI (`08763a6a-...` -> `status = 'completed'`,
  `completed_at = 2026-07-07 14:05:34.154+00`).
- **Source-validity now returns `valid = false`, `reason = task_closed`** for the historical notification
  (expected post-cleanup; the recorded `sent` delivery is a historical fact, unaffected).
- **Cron off** - no schedule exists.
- **No additional producer / processor / receipt-checker runs** since 2F-8C's single producer + single
  processor invocation. `check-push-receipts` has **never** run.

---

## 3. Receipt checker behavior audit

From `supabase/functions/check-push-receipts/index.ts` and its imports / migrations. Exact names used.

**Auth / secret / header:**

- Handler first calls `authorizeScheduledRequest(req)` (`_shared/auth.ts`); on failure returns
  `unauthorized()` (HTTP `401`, body `{ "error": "unauthorized" }`).
- `authorizeScheduledRequest` reads **`NOTIFICATIONS_CRON_SECRET`** from the function env and **fails closed**
  (returns `false`) if the secret is not configured. It accepts the secret in the **`x-cron-secret`** header
  **or** as an `Authorization: Bearer <secret>` token, compared **length-constant** (`timingSafeEqual`).
- **`verify_jwt` is OFF** for this function: `supabase/config.toml` has `[functions.check-push-receipts]
  verify_jwt = false`. So the `x-cron-secret` header is the only credential; no Supabase JWT is required.
- It uses `serviceClient()` (`_shared/supabase.ts`) - a **service-role** client (bypasses RLS), reading
  `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from the function env.

**What it does, in order:**

1. **Retention sweep (runs first, before polling):** `retentionCutoff = now - REMINDER_CONFIG.receiptRetentionHours (24h)`;
   calls RPC **`mark_stale_receipts_unchecked(p_cutoff, p_limit = receiptRetentionSweepLimit (500))`**. That
   SQL marks `sent` deliveries with `receipt_status IS NULL`, `expo_ticket_id IS NOT NULL`, and
   `sent_at < cutoff` as **`receipt_status = 'unchecked'`, `error_code = 'retention_window'`** (oldest-first,
   bounded by `p_limit`). Returns the count as `sweptUnchecked`.
2. **Select deliveries to poll:** a PostgREST query on `notification_push_deliveries` (via `queryChecked`,
   label `receipts_pending`) selecting `id, expo_ticket_id, push_token_id` where:
   - `status = 'sent'`,
   - `expo_ticket_id IS NOT NULL`,
   - `receipt_status IS NULL`,
   - `sent_at <= (now - REMINDER_CONFIG.receiptMinAgeMinutes (15m))`,
   - ordered `sent_at ASC` (**oldest-first**, so a stream of new tickets can't starve old ones),
   - `limit REMINDER_CONFIG.expoReceiptBatchSize (300)`.
3. **If zero rows:** logs `check_receipts_done { checked: 0 }` and returns
   `{ ok: true, checked: 0, swept_unchecked: <n> }`.
4. Builds `byTicket: Map<expo_ticket_id, { deliveryId, pushTokenId }>` from the selected rows.
5. **Calls Expo receipts API:** `getExpoReceipts([...ticketIds])` (`_shared/expo.ts`) - `POST
   https://exp.host/--/api/v2/push/getReceipts` with body `{ ids: [...] }`. Auth to Expo is optional: if
   `EXPO_ACCESS_TOKEN` is set it is sent as `Authorization: Bearer` (Enhanced Push Security); otherwise no
   token. Returns `Record<ticketId, ExpoReceipt>` (only tickets Expo actually returns).
6. **For each returned receipt** (`Object.entries(receipts)`): looks up `target = byTicket.get(ticketId)`
   (skips unknown ids); computes `errorCode = receipt.status === 'error' ? receipt.details?.error : null`; then
   calls RPC **`record_delivery_receipt(p_delivery_id, p_expected_ticket = ticketId, p_receipt_id = ticketId,
   p_status = receipt.status, p_error_code = errorCode, p_details = receipt.status === 'error' ?
   receipt.message : null)`**.
   - If it returns `false` -> `mismatched++`, logs `receipt_mismatch`, continue (no write happened).
   - If it returns `true` -> `recorded++`; and **only if `isUnregisteredError(errorCode)`** (i.e. `errorCode ===
     'DeviceNotRegistered'`) -> `invalidTokens++` and calls RPC
     **`deactivate_push_token_by_id(p_id = pushTokenId)`** (logs `token_invalidated`; a failure there logs
     `deactivate_failed` and is swallowed).
   - Any throw from `record_delivery_receipt` -> `recordErrors++`, logs `record_receipt_failed`.
7. Logs `check_receipts_done { checked, recorded, mismatched, record_errors, invalid_tokens, swept_unchecked }`
   and returns `{ ok: true, checked: rows.length, recorded, mismatched, recordErrors, invalidTokens }`.
8. **Any thrown error** in the outer try -> logs `check_receipts_failed` and returns `{ ok: false }` (HTTP
   `500`).

**Which deliveries it selects:** database-wide `notification_push_deliveries` with `status = 'sent'` +
`expo_ticket_id IS NOT NULL` + `receipt_status IS NULL` + `sent_at` at least 15m old; oldest-first; up to 300.

**Required delivery status before receipt check:** `sent` (both the poll query and the
`record_delivery_receipt` guard require `status = 'sent'`).

**Required Expo ticket fields:** a non-null `expo_ticket_id`; `record_delivery_receipt` additionally writes
**only** when `expo_ticket_id IS NOT DISTINCT FROM p_expected_ticket` (the ticket the receipt is for still
matches the row) - otherwise it is a no-op (`false`).

**Batch size / limits (from `REMINDER_CONFIG`):** `expoReceiptBatchSize = 300` (poll cap),
`receiptRetentionSweepLimit = 500` (sweep cap), `receiptMinAgeMinutes = 15`, `receiptRetentionHours = 24`.

**DB functions / RPCs it calls:** `mark_stale_receipts_unchecked`, `record_delivery_receipt`,
`deactivate_push_token_by_id` (all `service_role`-granted, `security definer`).

**Possible receipt outcomes and the exact status values written:**

- **ok / delivered** -> Expo returns `{ status: 'ok' }`; `record_delivery_receipt` sets
  `receipt_status = 'ok'`, `receipt_id = ticketId`, `error_code = null`. (Delivery `status` stays `sent`.)
- **error** -> Expo returns `{ status: 'error', message, details?: { error? } }`; sets
  `receipt_status = 'error'`, `error_code = details.error` (e.g. `DeviceNotRegistered`, `MessageTooBig`,
  `MessageRateExceeded`, `MismatchSenderId`, `InvalidCredentials`, ...), `last_error = message`.
- **device not registered** -> the specific `error` case where `error_code = 'DeviceNotRegistered'`; in
  addition to recording the error receipt, the checker deactivates that exact token (Section 4.A).
- **receipt not ready** -> Expo returns **no entry** for that ticket yet; the checker simply doesn't process it,
  so `receipt_status` **stays `null`** and the row is re-polled on a later run. (No status value is written.)
- **retention / unchecked** -> not a receipt outcome but the sweep: `receipt_status = 'unchecked'`,
  `error_code = 'retention_window'` for `sent` no-receipt tickets older than 24h.
- **Exact `receipt_status` values** (it is a `text` column, **not** an enum): `null` (never checked / not
  ready), `'ok'`, `'error'`, `'unchecked'`. There is no `'delivered'`/`'retry'` literal - "delivered" maps to
  `'ok'`; "not ready" stays `null` (retryable next run).

**Can it deactivate push tokens?** **Yes, but narrowly:** only when a receipt is `error` **and**
`error_code === 'DeviceNotRegistered'` (`isUnregisteredError`), via `deactivate_push_token_by_id(pushTokenId)`
-> sets `push_tokens.is_active = false` for that token id only. No other receipt outcome touches tokens.

**Can it mutate delivery rows?** **Yes, receipt fields only:** `record_delivery_receipt` writes `receipt_id`,
`receipt_status`, `error_code`, and (on error) `last_error`; `mark_stale_receipts_unchecked` writes
`receipt_status = 'unchecked'` + `error_code = 'retention_window'`. **It never changes delivery `status`**
(stays `sent`), never touches `sent_at` / `expo_ticket_id` / `push_token_id`, and **never creates delivery
rows**. (`updated_at` bumps via the `set_updated_at` trigger on any write.)

**Can it send push notifications?** **No.** It only calls `getExpoReceipts` (read). It never calls
`sendExpoPush`; there is no send path in this function.

**Does it touch outbox rows?** **No.** It never references `notification_outbox` or `notifications`. It reads
`notification_push_deliveries` and (on `DeviceNotRegistered`) writes `push_tokens.is_active`.

**Is it database-wide?** **Yes.** Both the retention sweep and the poll query scan `notification_push_deliveries`
with no circle/user filter. It will consider **every** `sent`, ticketed, no-receipt delivery DB-wide (bounded
by the batch limits).

**Note on columns that do NOT exist:** there is **no `receipt_checked_at` column** and **no separate
`receipt_error` column** on `notification_push_deliveries`. Receipt "when" is only observable via `updated_at`;
receipt "error" is `error_code` + `last_error`. The SQL packs below account for this.

---

## 4. Risk classification

**A. Receipt checker invocation (`check-push-receipts`):**

- **Does not send a new push** - no `sendExpoPush` path exists; it only reads receipts from Expo.
- **Can mutate delivery receipt fields** - `receipt_id`, `receipt_status`, `error_code`, `last_error` via
  `record_delivery_receipt`; and `receipt_status = 'unchecked'` / `error_code = 'retention_window'` via the
  retention sweep. It does **not** change the delivery `status` (stays `sent`).
- **Can deactivate a token** - **only** if Expo returns `error` with `error_code = 'DeviceNotRegistered'`
  (`deactivate_push_token_by_id`). No other outcome deactivates a token.
- **Is database-wide** - source confirms no circle/user scoping; it processes every eligible `sent` delivery
  DB-wide (up to 300 polled + 500 swept per run).
- **Requires explicit approval** - one-time, manual, after Section 5 prechecks pass.

**B. Existing target delivery (`0fef9576-...`):**

- **Safe target** - it has `status = 'sent'` and a recorded `expo_ticket_id` (`019f39e8-...`), exactly what the
  poll query and `record_delivery_receipt` require.
- **`receipt_status = null`** - eligible for the poll (not yet checked).
- **No pending outbox rows** - nothing queued to co-process.
- **May already have a receipt ready** - time has passed since send, so Expo may return `{ status: 'ok' }` (or
  an `error`) immediately. **Retention caveat:** if the delivery is already **older than 24h** at invocation,
  the retention sweep marks it `unchecked` first and it is never polled - confirm the retention-window
  precheck (Section 5, Block 1) before running.

**C. Cron:**

- **Not needed** - the test is a single manual invocation.
- **Must remain off** - do not create any `pg_cron` schedule.

**D. Producer / processor:**

- **Not needed** - `enqueue-due-reminders` and `process-notification-outbox` play no part in the receipt path.
- **Must remain off** - do not invoke either; the receipt checker touches only deliveries + tokens.

---

## 5. Manual read-only SQL pack for pre-checks (SELECT-only; do not execute)

Author-only. Run in the Supabase Dashboard SQL editor **before** any receipt-checker invocation. No block
mutates data.

**Block 1 - target delivery receipt baseline (+ retention-window gate):**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- Target delivery 0fef9576-... baseline. There is NO receipt_checked_at column (use updated_at as a proxy);
-- receipt error fields are error_code + last_error (no separate receipt_error column). Never selects the raw token.
select
  n.id            as notification_id,
  o.id            as outbox_id,
  d.id            as delivery_id,
  o.status::text  as outbox_status,
  d.status::text  as delivery_status,
  d.expo_ticket_id,
  d.receipt_status,
  d.receipt_id,
  d.error_code    as receipt_error_code,      -- receipt "error" field (no separate receipt_error column)
  d.last_error    as delivery_last_error,
  d.sent_at,
  d.updated_at    as delivery_updated_at,      -- proxy for "receipt_checked_at" (no such column exists)
  (now() - d.sent_at)                          as age_since_sent,
  (d.sent_at <= now() - interval '15 minutes') as past_min_age_15m,     -- receiptMinAgeMinutes gate
  (d.sent_at >  now() - interval '24 hours')   as within_retention_24h, -- receiptRetentionHours gate
  case
    when d.status = 'sent'
     and d.expo_ticket_id is not null
     and d.receipt_status is null
      then 'PASS_SENT_TICKETED_RECEIPT_NULL'
    else 'REVIEW_UNEXPECTED_BASELINE'
  end as receipt_baseline_gate
from public.notification_push_deliveries d
join public.notification_outbox o on o.id = d.outbox_id
join public.notifications      n on n.id = o.notification_id
where d.id = '0fef9576-0854-4c6d-bb0f-6176711103ce'::uuid;
-- Expected PASS: delivery_status='sent', expo_ticket_id='019f39e8-aadf-7733-848d-34e3c48a3e45',
-- receipt_status=null, receipt_baseline_gate='PASS_SENT_TICKETED_RECEIPT_NULL', past_min_age_15m=true.
-- TIMING GATE: within_retention_24h MUST be true, else the retention sweep will mark it 'unchecked'
-- BEFORE polling and the ticket->receipt path cannot be exercised on this row. If false, STOP (Section 9).
```

**Block 2 - outbox summary (no pending):**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select o.status::text as outbox_status, count(*) as rows
from public.notification_outbox o
group by o.status
order by o.status;
-- PASS: NO 'pending' row (expected: fanned=1, skipped=1). Any 'pending' -> investigate before proceeding
-- (though the receipt checker itself never reads the outbox, a pending row signals unfinished processor work).
```

**Block 3 - delivery summary + confirm the only receipt-pending sent delivery is the target:**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- 3a. Counts by delivery status and receipt_status.
select d.status::text as delivery_status,
       coalesce(d.receipt_status, '(null)') as receipt_status,
       count(*) as rows
from public.notification_push_deliveries d
group by d.status, d.receipt_status
order by 1, 2;
```

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- 3b. Every delivery the checker WOULD poll (status='sent', ticketed, receipt_status null). The checker is
-- database-wide, so document ALL such rows. PASS when the ONLY row is the target delivery.
select d.id as delivery_id, d.outbox_id, d.push_token_id, d.expo_ticket_id, d.sent_at,
       (d.sent_at <= now() - interval '15 minutes') as past_min_age_15m,
       (d.sent_at >  now() - interval '24 hours')   as within_retention_24h,
       (d.id = '0fef9576-0854-4c6d-bb0f-6176711103ce'::uuid) as is_target
from public.notification_push_deliveries d
where d.status = 'sent'
  and d.expo_ticket_id is not null
  and d.receipt_status is null
order by d.sent_at asc;
-- PASS: exactly one row, is_target=true. If more rows exist, DOCUMENT them all before invoking - the
-- checker will poll every such row (oldest-first, up to 300). Multiple unplanned rows -> STOP (Section 9).
```

**Block 4 - token state for the target delivery:**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- Confirm the target delivery's token is still active and owned by the owner. Never selects the raw token
-- (masked to its scheme prefix only). This is the token the checker could deactivate on a DeviceNotRegistered receipt.
select
  pt.id                                              as push_token_id,
  pt.is_active,
  pt.platform,
  pt.device_id,
  (pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid) as owned_by_owner,
  split_part(pt.expo_push_token, '[', 1) || '[***]'  as token_scheme_masked
from public.notification_push_deliveries d
join public.push_tokens pt on pt.id = d.push_token_id
where d.id = '0fef9576-0854-4c6d-bb0f-6176711103ce'::uuid;
-- Expected: push_token_id='93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8', is_active=true, owned_by_owner=true.
-- (Capture the active state now so any post-run deactivation is detectable in Section 7.)
```

**Block 5 - optional cron absence check:**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- 5a. Safe existence probe: null => pg_cron not installed/visible => cron is off.
select to_regclass('cron.job') as cron_job_regclass;
```

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- 5b. Run ONLY if 5a returned a non-null regclass. List any schedule touching notification functions.
select jobid, jobname, schedule, active, command
from cron.job
where command ilike '%check-push-receipts%'
   or command ilike '%process-notification-outbox%'
   or command ilike '%enqueue-due-reminders%'
   or command ilike '%check-missed-doses%'
order by jobid;
-- Expected: zero rows (cron remains off). Any row -> STOP (Section 9): cron must not be enabled.
```

No `UPDATE` / `DELETE` / `INSERT` appears in this pack.

---

## 6. Future receipt checker invocation command

**`DO NOT RUN UNTIL PRECHECKS PASS AND USER EXPLICITLY APPROVES`**

Authored for a future, explicitly approved `2F-9B` receipt-checker step only. Calls **only**
`check-push-receipts`, **once**. Reads `NOTIFICATIONS_CRON_SECRET` with `Read-Host -AsSecureString`; **never
echoes** the secret (marshalled straight into the header, zeroed in `finally`). Prints the invocation
timestamp first. Does **not** call the producer or processor. Does **not** enable cron. `verify_jwt = false`
for this function, so the `x-cron-secret` header is the only credential.

```powershell
# DO NOT RUN UNTIL PRECHECKS PASS AND USER EXPLICITLY APPROVES (2F-9B receipt-checker step).
# Calls ONLY check-push-receipts, once. Re-run the Section 5 prechecks FIRST and confirm the target
# delivery is status='sent', receipt_status=null, past_min_age_15m=true, within_retention_24h=true.
# Sends NO push (receipt read only). The secret is read hidden and never echoed.
$ref = 'qccgshanmoeybagxwvcs'
$uri = "https://$ref.supabase.co/functions/v1/check-push-receipts"

# Stamp the invocation moment (UTC ISO-8601) BEFORE calling, for the Section 7 post-checks (created_at > this).
$invokedAt = (Get-Date).ToUniversalTime().ToString('o')
Write-Host "check-push-receipts invoked_at (UTC): $invokedAt"

$sec  = Read-Host -Prompt 'Paste NOTIFICATIONS_CRON_SECRET (input hidden; never echoed)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
  $header = @{ 'x-cron-secret' = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  $resp   = Invoke-RestMethod -Method Post -Uri $uri -Headers $header -Body '{}' -ContentType 'application/json'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable header -ErrorAction SilentlyContinue
}
# Capture the FULL response verbatim (do not infer shape).
$resp | ConvertTo-Json -Depth 6
```

**Expected response shape (known from source):**

- **When rows are polled** (the target case): `{ "ok": true, "checked": <n>, "recorded": <n>,
  "mismatched": <n>, "recordErrors": <n>, "invalidTokens": <n> }`. Note: `swept_unchecked` is **not** included
  on this path.
- **When zero rows are polled** (e.g. the target was already swept to `unchecked`, or is <15m old, or already
  has a receipt): `{ "ok": true, "checked": 0, "swept_unchecked": <n> }`.
- **On internal error:** HTTP `500`, body `{ "ok": false }`.

**Ideal target-case values:** `ok=true`, `checked=1` (only the target eligible), `recorded=1`, `mismatched=0`,
`recordErrors=0`, `invalidTokens=0` (Expo returned `{ status: 'ok' }`). Any `invalidTokens > 0` means Expo
returned `DeviceNotRegistered` and the token was deactivated - REVIEW (Section 8). **Capture the full response
verbatim; do not infer any field not returned.**

---

## 7. Post-receipt SQL checks (SELECT-only; do not execute)

Author-only. Run after the (approved) invocation. Substitute the printed `invoked_at` for
`<CHECKER_INVOKED_AT_UTC>`.

**Block 1 - target delivery after the checker:**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- Target delivery after the checker. receipt_status may be 'ok' (delivered), 'error' (provider error),
-- still null (Expo had no receipt ready -> re-pollable), or 'unchecked' (retention sweep, if it was >24h old).
select
  d.id            as delivery_id,
  d.status::text  as delivery_status,          -- expected still 'sent' (checker never changes delivery status)
  d.expo_ticket_id,
  d.receipt_status,
  d.receipt_id,
  d.error_code    as receipt_error_code,
  d.last_error    as delivery_last_error,
  d.sent_at,
  d.updated_at    as delivery_updated_at,       -- proxy for receipt-check time (no receipt_checked_at column)
  pt.is_active    as token_still_active,
  (pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid) as token_owned_by_owner
from public.notification_push_deliveries d
join public.push_tokens pt on pt.id = d.push_token_id
where d.id = '0fef9576-0854-4c6d-bb0f-6176711103ce'::uuid;
-- Ideal PASS: receipt_status='ok', receipt_id='019f39e8-...', receipt_error_code=null, delivery_status='sent',
-- token_still_active=true. Acceptable: receipt_status still null (receipt not ready) -> re-pollable.
-- REVIEW: receipt_status='error'. HARD STOP: token_still_active=false with error_code<>'DeviceNotRegistered'.
```

**Block 2 - delivery summary after the checker:**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select d.status::text as delivery_status,
       coalesce(d.receipt_status, '(null)') as receipt_status,
       count(*) as rows
from public.notification_push_deliveries d
group by d.status, d.receipt_status
order by 1, 2;
-- Expected: no NEW 'failed'/'skipped' delivery rows appeared (the checker cannot create or fail deliveries);
-- the target row is accounted for under status='sent' with its new receipt_status.
```

**Block 3 - outbox status unchanged:**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select o.status::text as outbox_status, count(*) as rows
from public.notification_outbox o
group by o.status
order by o.status;
-- Expected UNCHANGED: fanned=1, skipped=1, NO pending. The checker never touches outbox rows.
```

**Block 4 - no new notifications after the invocation:**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select count(*) as notifications_created_after_checker
from public.notifications n
where n.created_at > '<CHECKER_INVOKED_AT_UTC>'::timestamptz;
-- Expected: 0. The receipt checker never creates notifications. Any > 0 -> HARD STOP (Section 9).
```

**Block 5 - no new deliveries after the invocation:**

```sql
-- READ ONLY. Receipt checker planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select count(*) as deliveries_created_after_checker
from public.notification_push_deliveries d
where d.created_at > '<CHECKER_INVOKED_AT_UTC>'::timestamptz;
-- Expected: 0. The receipt checker only UPDATEs receipt fields; it never inserts delivery rows. Any > 0 -> HARD STOP.
```

---

## 8. Expected outcomes

Defined from source behavior:

- **Ideal PASS** - Expo receipt is available and `ok`: `record_delivery_receipt` returns `true`,
  `receipt_status = 'ok'`, `receipt_id = 019f39e8-...`, `error_code = null`, delivery `status` still `sent`,
  token still active. Response `checked=1, recorded=1, mismatched=0, recordErrors=0, invalidTokens=0`.
- **Acceptable pending / not-ready** - Expo has no receipt for the ticket yet: the checker doesn't process it,
  `receipt_status` **stays `null`**, and it is re-pollable on a later approved run. Response typically
  `checked=1, recorded=0` (or `checked=0` if it was <15m old at query time). Not a failure.
- **REVIEW** - Expo returns `{ status: 'error' }`: `receipt_status = 'error'`, `error_code` populated (e.g.
  `MessageRateExceeded`, `MessageTooBig`, `MismatchSenderId`), `last_error` set. Delivery still `sent`. Inspect
  the `error_code` before deciding next steps.
- **HARD STOP** - a device token is deactivated **unexpectedly** (`token_still_active = false`) **unless** the
  receipt `error_code` is exactly `DeviceNotRegistered` (the one code the source acts on). A `DeviceNotRegistered`
  deactivation is expected behavior, not a failure - but must be recorded and reviewed.
- **HARD STOP** - any new `notifications` or `notification_push_deliveries` rows appear after the invocation
  (Section 7 Blocks 4-5 non-zero). The checker must not create either.
- **HARD STOP** - any push is received on a device during the receipt-checker test. The checker sends no push;
  a push would mean an unintended send path fired.

---

## 9. Stop conditions

Halt immediately and report if any occur:

- **Wrong project** (anything other than Sanad `qccgshanmoeybagxwvcs`).
- **Target delivery missing** (`0fef9576-...` not found).
- **Target delivery has no Expo ticket id** (`expo_ticket_id IS NULL`) - nothing to poll.
- **Target delivery not `sent`** (any status other than `sent`) - it will not be selected / recorded.
- **`receipt_status` already terminal before the test** (`'ok'`, `'error'`, or `'unchecked'`) - the
  ticket->receipt path is already resolved; do not re-run expecting a fresh transition.
- **Target already outside the retention window** (Section 5 Block 1 `within_retention_24h = false`) - the
  retention sweep would mark it `unchecked` before polling; the receipt is likely gone from Expo too.
- **Multiple unplanned receipt-pending deliveries** (Section 5 Block 3b returns rows other than the target) -
  document all before any run; the checker is database-wide.
- **Any pending outbox rows** (Section 5 Block 2 shows `pending > 0`).
- **Raw Expo token exposed** anywhere (only masked scheme / internal ids are permitted).
- **Any secret pasted** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN`) into a report, log, or chat.
- **Cron enabled** or any schedule created.
- **Producer or processor invoked** (`enqueue-due-reminders` / `process-notification-outbox`).
- **Any push received** during the receipt-checker test.
- **Token deactivated unexpectedly** (token `is_active` flips to `false` without a `DeviceNotRegistered`
  receipt).

---

## 10. Recommended next phase

1. **Commit this planning report first** (docs-only; nothing executed).
2. **Then proceed to `2F-9B - Expo receipt checker smoke test, explicit approval required`** - run
   `check-push-receipts` **exactly once**, manually, after re-running the Section 5 prechecks and confirming the
   retention-window gate passes, to drive the target delivery's `receipt_status` from `null` to `ok`.
3. **No cron yet** - the engine stays manual.
4. **No producer / processor reruns** - they play no part in the receipt path.
5. **The receipt-checker invocation must be one-time and manually approved** - no automation, no repeat runs.

---

## 11. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results are recorded in Section 13's hand-off. No other command is run in this phase.

---

## 12. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run** (every SQL block is authored for later, separately approved manual use; no `INSERT` /
  `UPDATE` / `DELETE` appears anywhere in this report).
- **No DB connection.**
- **No deploy.**
- **No Edge invocation** (the PowerShell command is marked `DO NOT RUN` and was not executed).
- **No cron enabled / created.**
- **No producer / processor / receipt-checker invocation** (`enqueue-due-reminders`,
  `process-notification-outbox`, `check-push-receipts` were not run).
- **No notification delivery / push** (nothing sent).
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only; no
  value read or requested; all UUIDs are user / circle / task / notification / outbox / delivery / token /
  ticket identifiers, not secrets).
- **No raw Expo token exposed** (listings are masked to the scheme prefix only; only internal ids and the
  recorded ticket id appear).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 13. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-07-phase-2f-9a-expo-receipt-checker-plan.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
