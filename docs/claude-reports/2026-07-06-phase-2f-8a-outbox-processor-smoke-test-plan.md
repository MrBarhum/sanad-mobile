# Phase 2F-8A - Outbox processor smoke-test PLAN (design only; no execution)

**Status:** No-execution **planning** report for the first `process-notification-outbox` test. **Claude ran
no Supabase CLI, no SQL, made no DB connection, invoked no Edge Function, enabled no cron, processed no
outbox, and sent no push.** Nothing was executed against the database. Every SQL / invocation snippet below
is **authored for later, separately approved manual use** and is marked read-only / future / not-executed.
The only filesystem write in this phase is this report; the only commands run are the two local read-only
checks in Section 10 and the read-only git status/diff in Section 12.

**Baseline (pushed) commit:** `5ccb528 docs(product): record QA cleanup after notification smoke test`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).

**Sources inspected read-only (no file modified):**

- Edge processor: `supabase/functions/process-notification-outbox/index.ts`.
- Shared helpers imported by the processor: `_shared/auth.ts`, `_shared/config.ts`, `_shared/db.ts`,
  `_shared/expo.ts`, `_shared/messages.ts`, `_shared/supabase.ts`, `_shared/log.ts`; plus `_shared/enqueue.ts`
  (producer-side; not imported by the processor).
- Notification migrations: `supabase/migrations/20260611120000_create_notifications_core.sql` (core tables +
  enums + RLS), `supabase/migrations/20260611120100_create_notification_functions.sql`
  (`fanout_due_notifications`, `claim_push_deliveries`, the `mark_delivery_*` recorders,
  `deactivate_push_token_value`, `enqueue_notification`), and
  `supabase/migrations/20260626164000_notifications_responsibility_resolvers.sql` (the **current committed**
  `notification_source_validity` + `notification_recipient_current`, which supersede the 20260611120100
  bodies), with `supabase/migrations/20260626163000_notifications_responsibility_types_preferences.sql` for
  the enum/preference context.
- `supabase/config.toml` (the `[functions.process-notification-outbox] verify_jwt = false` block).
- Prior QA records: 2F-7H (cleanup execution), 2F-7G (cleanup plan), 2F-7E (single-producer smoke-test
  results).

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **This is planning only.** No outbox processor is invoked, no push is sent, no cron is enabled, no SQL is
  run, and no data is mutated in this phase.
- **The current pending outbox row is INVALID due to `task_closed`.** Its notification
  (`5ba7fb2d-...`, `task_due`) points at a task that is now `completed`, so
  `notification_source_validity` returns `(valid = false, reason = 'task_closed')`.
- **Therefore it is NOT suitable as a positive push-delivery test row.** If processed, the engine is
  designed to **skip** it (no fan-out, no delivery, no push), so it cannot demonstrate a successful send.
- **There are two possible future test paths:**
  1. **Skip-path processor smoke test** using the current invalid pending row - expecting a terminal
     `skipped` outbox status and **no push** (see Section 5, proposed `2F-8B`).
  2. **Positive push / fan-out smoke test** using a **fresh, valid** fixture and a **known test device
     token** - expecting one delivery row and one real Expo push (see Section 6, proposed `2F-8C`).
- **Recommendation:** run the **safer skip path first** (Section 5) only if the team wants to prove
  processor safety **without** sending push. Defer the positive push path until a live test device / token is
  proven.
- **Both paths require separate, explicit approval before execution.** This report authorizes nothing to
  run. Critically, invoking the processor is **not** read-only (see Sections 3-4): even the skip path mutates
  the outbox row `pending -> skipped`.

---

## 2. Current state (carried from 2F-7H, unchanged)

| Field | Value |
| ----- | ----- |
| Latest pushed commit | `5ccb528 docs(product): record QA cleanup after notification smoke test` |
| Notification id | `5ba7fb2d-cd29-470a-b2fe-f41df75051fc` |
| Original notification type | `task_due` |
| Target task id | `23bff3fa-130d-4e29-96ec-80bac0647060` (`مشي سريع`) |
| Task status now | `completed` (`completed_at = 2026-07-06 16:22:01.781+00`, `cancelled_at = null`) |
| Recipient / owner (unchanged) | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` |
| Source-validity now | `valid = false`, `reason = task_closed` |
| Outbox rows | `1`, `status = 'pending'`, un-fanned |
| Delivery rows | `0` |
| Notification `created_at` | `2026-07-06 09:34:37.469933+00` |
| Dedupe key | `task:23bff3fa-130d-4e29-96ec-80bac0647060:2026-07-06:12:37:00` |
| Producer invocation timestamp (2F-7E) | `2026-07-06T09:34:09.306Z` |

- **No push, no cron, no outbox processing, and no Edge invocation** have occurred since the 2F-7E producer
  smoke test. Edge functions remain deployed but idle; cron remains off.

---

## 3. Processor behavior audit (from source)

`process-notification-outbox` runs **two phases per invocation** (see the header comment and `Deno.serve`
handler in `supabase/functions/process-notification-outbox/index.ts`).

### 3.1 Required secret / header behavior

- The handler's first line is `if (!authorizeScheduledRequest(req)) return unauthorized();`
  (`process-notification-outbox/index.ts`).
- `authorizeScheduledRequest` (`_shared/auth.ts`) reads `NOTIFICATIONS_CRON_SECRET` from the function
  environment. **If the secret is unset it FAILS CLOSED** (`if (!expected) return false;`). Otherwise it
  compares the request's `x-cron-secret` header (or a `Bearer` token in `authorization`) against the secret
  with a **length-constant** compare. A missing / wrong secret yields **HTTP 401** (`unauthorized()`).
- `supabase/config.toml` sets `[functions.process-notification-outbox] verify_jwt = false`, so the Supabase
  Functions gateway does **not** require a Supabase JWT; the function's own `x-cron-secret` check is the only
  gate. The secret lives only in the function environment (never in Git; never to be pasted into chat / this
  report).

### 3.2 Client + service role

- The function builds a **service-role** Supabase client (`serviceClient()` in `_shared/supabase.ts`), which
  bypasses RLS; the outbox / delivery functions are granted to `service_role` only. Every RPC goes through
  `rpcChecked` (`_shared/db.ts`), which throws on any Supabase error (fail-loud; no args / tokens / titles /
  health values / secrets in the error text). Structured logs (`_shared/log.ts`) carry only counts, ids, and
  statuses - never a token, secret, title/body, or health value.

### 3.3 Phase A - fan-out (`fanout_due_notifications`)

- The handler calls `rpcChecked(sb, 'fanout_due_notifications', { p_limit: 200, p_max_attempts: 5 })`
  (`REMINDER_CONFIG.fanoutBatchSize / fanoutMaxAttempts` in `_shared/config.ts`).
- `fanout_due_notifications` (migration `20260611120100`) selects **database-wide** pending outbox jobs
  (`where o.status = 'pending' and o.available_at <= now()`), ordered by `available_at`,
  `for update skip locked`, `limit p_limit`. **It is not scoped to a single circle / user / notification.**
- For each job it **re-validates at delivery time**, in this order: notification exists -> not expired
  (`n.expires_at <= now()` -> `skipped/expired`) -> recipient (profile) exists -> still an active circle
  member -> `notification_recipient_eligible` (role + preference) -> **`notification_source_validity`** ->
  quiet-hours deferral. Any failed gate sets the outbox row `status = 'skipped'` with a safe
  machine-readable `last_error` (e.g. `expired`, `not_member`, `not_eligible`, or the source-validity reason
  such as `task_closed`) and consumes **no** delivery.
- Only if all gates pass does it **materialize one `notification_push_deliveries` row per CURRENTLY active
  device token** (`insert ... select ... from push_tokens where user_id = ... and is_active`,
  `on conflict (outbox_id, push_token_id) do nothing`) and set the outbox row `status = 'fanned'`. If the
  recipient has **zero** active tokens, the row is `skipped/no_active_token`. A per-row sub-transaction
  isolates a poison row (increments `attempt_count`; terminal `failed` at the cap). Returns
  `{ fanned, skipped, deferred }`.

### 3.4 Phase B - claim + send (`claim_push_deliveries` -> Expo)

- The handler calls `rpcChecked(sb, 'claim_push_deliveries', { p_limit: 200, p_lock_timeout_seconds: 600,
  p_max_attempts: 5 })`, then `deliver(sb, claimed)`.
- `claim_push_deliveries` (migration `20260611120100`) is the **authoritative send-time gate**. It selects
  **database-wide** due `pending` deliveries **or** stale `processing` deliveries (lock older than
  `p_lock_timeout_seconds`), `for update skip locked`, `limit p_limit`. For each it **re-checks the same
  authorization chain** (outbox / notification present, not expired, recipient present, active member,
  `notification_recipient_eligible`, **`notification_source_validity`**, token still active + owned by the
  recipient) and re-applies quiet-hours deferral. A failed gate sets the delivery `status = 'skipped'`
  (source-invalid rows are skipped **without** consuming a send attempt) or re-defers it back to `pending`.
  Only rows that pass are **claimed** (`status = 'processing'`, `locked_at = now()`, `attempt_count += 1`, a
  fresh `claim_token` lease) and **returned**.
- `deliver()` (`process-notification-outbox/index.ts`) sends **only the returned rows** to Expo via
  `sendExpoPush` (`_shared/expo.ts`), in batches of `expoPushBatchSize` (100). The push payload is
  **generic** (`genericPushMessage()` in `_shared/messages.ts` -> title `سند`, body `لديك تذكير جديد`) with
  only minimal routing identifiers in `data` (type, notificationId, circleId, deepLink) - **no health
  detail** ever leaves in the remote payload. Results are recorded under the claim lease via
  `mark_delivery_sent` / `mark_delivery_failed` / `mark_delivery_skipped` (each writes only while the row is
  still `processing` **and** the `claim_token` matches; a lost lease logs `stale_claim`). A `DeviceNot
  Registered` provider error calls `deactivate_push_token_value` and marks the delivery
  `skipped/device_not_registered`.
- External push is **at-least-once** by design (a network timeout after Expo accepts can rarely duplicate; a
  stale-claim row is reclaimed + resent). The lease only prevents stale DB-state corruption.

### 3.5 Does the processor check source-validity before fan-out / send?

**Yes, in BOTH phases.** `notification_source_validity` is called inside `fanout_due_notifications` (before
materializing deliveries) **and** inside `claim_push_deliveries` (before returning a row to be sent). The
**current committed** body is in migration `20260626164000` (it supersedes the 20260611120100 body via
`create or replace`): it first runs a **recipient-currency gate** (`notification_recipient_current`) and then,
for `task_due` / `task_overdue`, returns `(false, 'task_closed')` when the task's `status <> 'open'` and
`(false, 'occurrence_changed')` when the current due date/time differs from the stored occurrence.

### 3.6 Status transitions (exact enum values from source)

- **`notification_outbox.status`** (enum in `20260611120000`): `pending`, `fanned`, `skipped`, `failed`.
  There is **deliberately no `processing` / `sent`** on the logical job, so the outbox is never mistaken for
  a delivered push. Transitions the processor can drive: `pending -> fanned` (materialized),
  `pending -> skipped` (any revalidation gate fails, including source-invalid), `pending -> failed` (poison
  row at the attempt cap); a quiet-hours defer bumps `available_at` and leaves it `pending`.
- **`notification_push_deliveries.status`** (enum in `20260611120000`): `pending`, `processing`, `sent`,
  `failed`, `skipped`. Transitions: `pending -> processing` (claimed), `processing -> sent` (Expo accepted),
  `processing -> failed` (terminal at cap) or back to `pending` (bounded retry / re-defer),
  `processing -> skipped` (bad token format, `device_not_registered`, or a send-time gate failure).

### 3.7 Can running the processor mutate DB state even if no push is sent?

**Yes.** Even when nothing is sent, a run can: flip outbox rows `pending -> skipped / fanned / failed`, write
`last_error`, bump `updated_at` (via the `set_updated_at` triggers), insert `notification_push_deliveries`
rows, stamp `claim_token` / `locked_at`, increment `attempt_count`, and (on a definitive provider error)
deactivate a push token. **Invoking the processor is therefore a mutation, not a read-only inspection** - even
the skip path (Section 5) writes `pending -> skipped` on the current row.

---

## 4. Risk classification

### A. Current invalid pending row (`5ba7fb2d-...`)

- **Source invalid:** `task_closed` (task `completed`). (If the notification is already past its `expires_at`
  when processed, `fanout_due_notifications` would skip it as `expired` first, since the expiry check
  precedes the source-validity check - either way it is a terminal `skipped`.)
- **Expected safe behavior if processed:** the fan-out gate **skips** it - no delivery materialized, no push.
- **Still mutates state:** the outbox row transitions `pending -> skipped` (with `last_error`), `updated_at`
  bumped. **Not read-only.**
- **Only run with explicit approval** (proposed `2F-8B`, Section 5).

### B. Positive push test

- Requires a **fresh, valid** notification with a **pending** outbox row (open in-window source).
- Requires **exactly one known test device / token** for the intended QA user.
- **Can send a real Expo push.**
- Must be planned **separately** and approved explicitly (proposed `2F-8C`, Section 6).
- **Must NOT reuse the current invalid row** - it is designed to be skipped and cannot demonstrate a send.

### C. Cron

- **Not needed** for either path (both invoke the function once, manually).
- **Must remain OFF.** No schedule is committed (`config.toml` documents cron-driven invocation but installs
  no schedule); do not create one.

### D. Producer re-run (`enqueue-due-reminders`)

- **Not needed.** **Must remain off** unless a future, separately shaped fixture exists. Re-running it now
  would match the `task_overdue` scan for the still-dated (but now closed) task's neighbors and risk an extra
  notification; it is closed, so it is inert, but do not re-run the producer in this phase regardless.

---

## 5. Recommended `2F-8B` path: skip-path processor smoke test (no push expected)

**Design only - do not execute in this phase; requires separate explicit approval.**

**Goal:** invoke `process-notification-outbox` **once** against the existing invalid pending row and confirm
the safe skip.

**Expected result:**

- The outbox row for `5ba7fb2d-...` becomes terminal **`skipped`** with `last_error = 'task_closed'`
  (or `'expired'` if past its expiry - both terminal, both no-push).
- **Zero `notification_push_deliveries`** created for it.
- **Zero Expo push** sent.
- **No other outbox rows affected** (pre-gate proves ours is the only pending row database-wide).

**This tests:** the processor **auth / secret path**, the **fan-out source-validity enforcement**, and
**no-push safety on an invalid source**.
**This does NOT test:** fan-out to per-device deliveries, Expo send, or receipts (the row is skipped before
any delivery is materialized, so `claim_push_deliveries` never even sees it).

### 5.1 Pre-gates (all must hold before invoking)

- **Current pending outbox count is exactly 1** for notification `5ba7fb2d-...` (Section 7, Block 2).
- **Delivery rows are exactly 0** for that notification (Section 7, Block 4).
- **Source-validity is still `false / task_closed`** (Section 7, Block 3).
- **No other pending outbox rows exist anywhere** (Section 7, Block 1) - because the processor is
  **database-wide**, any other `pending`, due row would also be processed. If any other pending row exists,
  **STOP** and document it before proceeding.
- **Cron is off** if verifiable (Section 7, Block 7); if the `cron` schema is inaccessible, treat as optional
  and rely on the standing "no schedule committed" fact.
- The operator has `NOTIFICATIONS_CRON_SECRET` ready **but must never paste it into chat or this report**.

### 5.2 Post-check expectations

- Outbox row status changed to **`skipped`** (`last_error` = `task_closed` or `expired`).
- **No deliveries** created (`notification_push_deliveries` still 0 for this notification).
- **No push received** on any device / lock screen.
- **No new notifications** created (Section 7, Block 5 still shows only the one pre-existing target row).
- **No rows outside QA** affected.

### 5.3 Future invocation command - **DO NOT RUN UNTIL APPROVED**

Provided for a future, explicitly approved `2F-8B` only. It calls **only** `process-notification-outbox`,
**once**, reads the secret with `Read-Host -AsSecureString`, and **never echoes** the secret (it is marshalled
straight into the header and zeroed in `finally`; only the response JSON of counts is printed).

```powershell
# DO NOT RUN UNTIL APPROVED (2F-8B). Calls ONLY process-notification-outbox, once. No push is expected
# because the single pending row is source-invalid (task_closed). Re-run the Section 7 pre-gates FIRST.
$ref = 'qccgshanmoeybagxwvcs'
$uri = "https://$ref.supabase.co/functions/v1/process-notification-outbox"
$sec = Read-Host -Prompt 'Paste NOTIFICATIONS_CRON_SECRET (input hidden; never echoed)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
  $header = @{ 'x-cron-secret' = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  $resp = Invoke-RestMethod -Method Post -Uri $uri -Headers $header -Body '{}' -ContentType 'application/json'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable header -ErrorAction SilentlyContinue
}
# Expected for the skip path: fanout.skipped = 1, fanout.fanned = 0, claimed = 0, sent = 0.
$resp | ConvertTo-Json -Depth 6
```

`verify_jwt = false` for this function (`config.toml`), so **no** Supabase `apikey` / `Authorization` header
is required; the `x-cron-secret` header is the only credential. If a live check ever shows the gateway
demanding a JWT, mirror exactly how `enqueue-due-reminders` was invoked in 2F-7E rather than improvising.

---

## 6. Alternative `2F-8C` path: positive outbox / push test (high-level planning only)

**Design only - do not execute in this phase; requires separate fixture shaping + explicit approval.**

- **Create or shape a FRESH valid notification** with a **pending** outbox row: an **open** task (or other
  source) with an **in-window** occurrence, so `notification_source_validity` returns `(true, 'ok')` at
  processing time. **Do not reuse `5ba7fb2d-...`.**
- **Exactly one test recipient** (a QA user, not real family data).
- **Exactly one registered Expo push token** for a **known test device** (verify against `push_tokens`;
  confirm the token is `is_active` and owned by the test recipient - Section 7, Block 6, count-only).
- **Generic push copy only** (the code already sends `genericPushMessage()`; do not add health detail).
- **Run `process-notification-outbox` once** - expect **one delivery row** and **one push**.
- **Then run the receipt checker later** (`check-push-receipts`) to confirm the ticket -> receipt path.
- **Requires separate fixture shaping and approval**, and may require verifying the device-token table first.
- **Do not execute in this phase.**

---

## 7. Manual read-only SQL pack for future pre-checks

**Do not run in 2F-8A.** `SELECT`-only blocks for the Supabase Dashboard SQL Editor, authored for a future,
separately approved pre-check. None modifies data, invokes a writing function, processes the outbox, or sends
a push. **No `UPDATE` / `DELETE` / `INSERT` SQL appears anywhere in this report.**

### Block 1 - Outbox baseline by status across all circles

```sql
-- READ ONLY. Outbox processor planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select o.status::text as outbox_status, count(*) as rows
from public.notification_outbox o
group by o.status::text
order by o.status::text;

-- Enumerate every PENDING, currently-due row database-wide (must be exactly one: our target).
select o.id as outbox_id, o.notification_id, o.user_id, o.available_at, o.attempt_count,
       (o.available_at <= now()) as due_now
from public.notification_outbox o
where o.status = 'pending'
order by o.available_at asc;
```

**Expected:** the only `pending` row is `notification_id = 5ba7fb2d-...` (`available_at <= now()` -> `due_now
= true`). **Any other pending row is a hard stop** (Section 8) - the processor is database-wide.

### Block 2 - Current notification / outbox row detail for `5ba7fb2d-...`

```sql
-- READ ONLY. Outbox processor planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select
  n.id            as notification_id,
  n.type::text    as type,
  n.user_id,
  n.circle_id,
  n.data->>'entity'  as data_entity,
  n.data->>'itemId'  as data_item_id,
  n.data->>'taskId'  as data_task_id,
  n.data->>'dueDate' as data_due_date,
  n.data->>'dueTime' as data_due_time,
  n.deep_link,
  n.dedupe_key,
  n.created_at,
  n.expires_at,
  o.id            as outbox_id,
  o.status::text  as outbox_status,
  o.available_at,
  o.attempt_count,
  o.last_error,
  o.updated_at
from public.notifications n
left join public.notification_outbox o on o.notification_id = n.id
where n.id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid;
```

**Expected:** exactly one row; `type = task_due`, `user_id = a6dc7376-...`, one linked outbox row with
`outbox_status = 'pending'`, `attempt_count = 0`, `last_error = null`. If `outbox_status <> 'pending'`, the
outbox was already processed - **hard stop**.

### Block 3 - Source-validity for the current notification (OPTIONAL, read-only)

```sql
-- READ ONLY. Outbox processor planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- OPTIONAL. notification_source_validity is STABLE (performs no writes; read-only). It only inspects
-- validity; it does NOT process the outbox and sends nothing. If you get "permission denied for function",
-- the editor is running as a lesser role: STOP and report - do not escalate. Then rely on the source
-- interpretation in Section 3 (task closed -> false / task_closed).
select sv.valid, sv.reason
from public.notification_source_validity('5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid) sv;
```

**Expected:** `valid = false`, `reason = 'task_closed'` (the task is `completed`). Note: this function does
**not** evaluate `expires_at`; the fan-out path checks expiry separately and earlier, so the eventual skip
reason recorded on the outbox row may be `expired` if the notification has passed its expiry.

### Block 4 - Delivery rows for the current notification

```sql
-- READ ONLY. Outbox processor planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select d.id, d.status::text as delivery_status, d.push_token_id, d.attempt_count,
       d.available_at, d.locked_at, d.sent_at, d.expo_ticket_id, d.receipt_status, d.last_error
from public.notification_push_deliveries d
join public.notification_outbox o on o.id = d.outbox_id
where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid;
```

**Expected:** **zero rows** (the outbox was never fanned out). **Any delivery row is a hard stop** (Section 8).

### Block 5 - New notifications created after the original producer timestamp

```sql
-- READ ONLY. Outbox processor planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select n.id, n.type::text as type, n.user_id, n.circle_id, n.created_at
from public.notifications n
where n.created_at > '2026-07-06T09:34:09.306Z'::timestamptz
order by n.created_at asc;

-- Guard: how many are outside the QA circle (must be 0).
select
  count(*)                                                                          as new_total,
  count(*) filter (where n.circle_id is distinct from 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) as new_outside_qa
from public.notifications n
where n.created_at > '2026-07-06T09:34:09.306Z'::timestamptz;
```

**Expected:** only the single pre-existing target row (`5ba7fb2d-...`, created `2026-07-06
09:34:37.469933+00`); `new_outside_qa = 0`. Any additional / outside-QA row means something else fired -
**hard stop**.

### Block 6 - Registered push token / device count for the owner (OPTIONAL, count-only; tokens masked)

```sql
-- READ ONLY. Outbox processor planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- COUNT ONLY - do NOT select raw expo_push_token values. Full Expo tokens are sensitive; never expose them.
select
  count(*)                                  as total_tokens,
  count(*) filter (where pt.is_active)      as active_tokens,
  count(distinct pt.device_id)              as distinct_devices
from public.push_tokens pt
where pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid;
```

**Interpretation for the skip path (`2F-8B`):** the count is informational only; the skip happens before
fan-out, so token count does not change the expected result. **For a future positive push test (`2F-8C`)** it
must be exactly one active token on one known test device. Do **not** print raw token values (if masking is
ever needed, expose at most a non-entropy prefix such as `left(pt.expo_push_token, 18) || '...'`, never the
full value).

### Block 7 - Cron absence check (OPTIONAL; only if the `cron` schema is accessible)

```sql
-- READ ONLY. Outbox processor planning/precheck only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- OPTIONAL. First confirm the cron catalog exists; if this returns NULL, pg_cron is not installed/accessible
-- here - treat cron as "no schedule" per the committed config and SKIP the second query.
select to_regclass('cron.job') as cron_job_relation;

-- Only if the above is non-null: list any schedule touching the notification functions (expected: 0 rows).
select j.jobid, j.jobname, j.schedule, j.active
from cron.job j
where j.command ilike '%process-notification-outbox%'
   or j.command ilike '%enqueue-due-reminders%'
   or j.command ilike '%check-missed-doses%'
   or j.command ilike '%check-push-receipts%';
```

**Expected:** `cron_job_relation` is `null` (no accessible cron catalog) **or** the second query returns
**zero rows** (no schedule). Any active schedule touching these functions is a **hard stop**.

---

## 8. Stop conditions (hard stops)

Halt immediately and report if any occur:

- **Wrong project** (anything other than Sanad `qccgshanmoeybagxwvcs`).
- **More than the intended pending outbox row** anywhere (Block 1 shows any pending row other than
  `5ba7fb2d-...`).
- **Source-validity is not as expected** (Block 3 is not `false / task_closed`).
- **Delivery rows already exist** for the notification (Block 4 returns any row).
- **Outbox status already changed** (Block 2 shows `outbox_status <> 'pending'`).
- **Any push received** on any device / lock screen.
- **Cron enabled** / any schedule found (Block 7).
- **Any Edge Function invoked unexpectedly** (`process-notification-outbox`, `enqueue-due-reminders`,
  `check-missed-doses`, `check-push-receipts`, or any other).
- **Any secret pasted** (e.g. `NOTIFICATIONS_CRON_SECRET`) into a report, log, or chat.
- **Any real (non-QA) family data** appears in a pending outbox row.
- **The current invalid row is accidentally selected for the positive push test** (`2F-8C` must use a fresh,
  valid fixture, never `5ba7fb2d-...`).

---

## 9. Recommended next phase

1. **Commit this planning report first.**
2. **Then choose one** (each under separate, explicit approval):
   - **`2F-8B - skip-path outbox processor smoke test`** (Section 5) - **explicit approval required**; or
   - **`2F-8C - positive outbox / push smoke-test fixture planning`** (Section 6) - no execution until a fresh
     valid fixture and a proven test device / token exist.

**Conservative guidance:**

- **`2F-8B` (skip path) is the safer first step** - it exercises the auth path and source-validity
  enforcement with **no push**, though it still mutates the one outbox row (`pending -> skipped`).
- **The positive push path (`2F-8C`) should wait** until the test-device / token conditions are proven.
- **No cron** in either path.

---

## 10. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace / CRLF errors).

---

## 11. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run** (all SQL is authored for later manual use).
- **No DB connection.**
- **No additional deploy.**
- **No Edge invocation.**
- **No cron enabled / created.**
- **No outbox processing** (the outbox row remains `pending`, un-fanned).
- **No notification delivery / push** (zero delivery rows; nothing sent).
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` referenced by name only; no value; all UUIDs are
  user / circle / item / notification identifiers from prior recorded results, not secrets).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 12. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-06-phase-2f-8a-outbox-processor-smoke-test-plan.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
