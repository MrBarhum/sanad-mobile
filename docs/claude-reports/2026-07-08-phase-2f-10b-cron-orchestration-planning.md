# Phase 2F-10B - Cron orchestration PLANNING (no execution)

**Status:** Planning only. This report **designs** (does not run) the scheduled orchestration of the
notification engine's three tested functions - `enqueue-due-reminders` (producer),
`process-notification-outbox` (processor), and `check-push-receipts` (receipt checker). **Claude ran no
Supabase CLI, no SQL, made no DB connection, invoked no Edge Function, enabled no cron, created no cron job,
processed no outbox, checked no receipts, and sent no push.** Every cadence, gate, and SQL preview below is
**authored for later, separately approved use** and is explicitly marked read-only / future / not-executed. The
only filesystem write in this phase is this report; the only commands Claude runs are the two local read-only
checks in Section 12 and the read-only git status/diff in Section 14.

**Baseline (local) commit:** `715cbed docs(product): record notification engine closeout readiness`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Owner user (recipient / token owner):** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.

**Sources inspected read-only (no file modified):**

- Reports: `2F-10A` closeout/readiness, `2F-9C` receipt-fixture cleanup, `2F-9B` receipt smoke-test results,
  `2F-9A` receipt-checker plan, `2F-8C` positive-push smoke-test results.
- Edge source: `enqueue-due-reminders/index.ts`, `process-notification-outbox/index.ts`,
  `check-push-receipts/index.ts`.
- Shared: `_shared/config.ts` (`REMINDER_CONFIG`), `_shared/auth.ts` (`authorizeScheduledRequest`,
  fail-closed), `_shared/enqueue.ts`, `_shared/messages.ts` (`genericPushMessage`), `_shared/expo.ts`.
- Migrations: `20260611120000_create_notifications_core.sql`, `20260611120100_create_notification_functions.sql`
  (RPCs: `fanout_due_notifications`, `claim_push_deliveries`, `mark_delivery_*`, `record_delivery_receipt`,
  `mark_stale_receipts_unchecked`, `deactivate_push_token_*`), `20260626164000_...responsibility_resolvers.sql`.
- `supabase/config.toml` (`[functions.*] verify_jwt = false` for the scheduled functions).

**Cron-infrastructure finding (read-only):** there is **no `pg_cron` schedule and no cron migration** in the
repo today. The only cron references are the `auth.ts` doc-comment and the `config.toml` block that disables
platform JWT verification for the four scheduled functions (`enqueue-due-reminders`, `check-missed-doses`,
`process-notification-outbox`, `check-push-receipts`) because they authenticate by the `x-cron-secret` header
instead. So enabling cron is **greenfield**: it will require a new, separately-approved migration or dashboard
action that does not exist yet.

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **This is planning only.** No cron is enabled, no cron job is created, no Edge Function is invoked, no SQL is
  run, no DB connection is made, and no push is sent in this phase.
- **Cron remains OFF.** No `pg_cron` schedule exists; this report designs one but authorizes nothing to run.
- **Purpose:** define the scheduled chain (producer -> processor -> receipt checker), a safe cadence, the
  auth/secret model, the DB-wide pre-enable gates, overlap/concurrency handling, privacy guardrails, failure
  handling, a rollback/disable plan, and the outline of a future `2F-10C` smoke-test.
- **Readiness verdict:** the proposed orchestration is **conceptually ready for a future smoke-test plan
  (`2F-10C`)**, provided that plan (a) uses a tiny QA-safe fixture, (b) requires explicit approval before any
  SQL / DB connection / Edge invocation / cron enablement / push, and (c) enables cron only in a controlled,
  reversible window. It is **not** ready for direct cron execution.

---

## 2. Current baseline

- **Latest local commit:** `715cbed docs(product): record notification engine closeout readiness`.
- **Notification engine proven state (from 2F-10A):**
  - The full `task_due` path is proven live twice: producer -> processor -> **real Android OS push** (generic
    payload) -> Expo ticket -> receipt `ok`; plus the retention sweep -> `unchecked` path and fixture cleanup
    -> source-validity `task_closed`.
  - **Untested:** cron/scheduled orchestration, the missed-dose producer, `task_overdue` positive, an
    idempotency re-run, appointment/visit pushes, and production observability.
  - **Verdict:** ready for cron **planning**, not cron **execution**.
- **Current known DB engine state (carried from 2F-9B / 2F-9C):**
  - **Outbox:** `fanned = 2`, `skipped = 1`, **no `pending`**.
  - **Deliveries:** `sent` / `receipt_status = 'ok'` = `1` (`60cd396b-...`); `sent` / `receipt_status =
    'unchecked'` = `1` (`0fef9576-...`, `retention_window`).
  - **QA fixtures:** `[QA PUSH]` (`08763a6a-...`) and `[QA RECEIPT]` (`5cfcdb5d-...`) **both completed**.
- **Cron:** **off** (no schedule).

---

## 3. Cron orchestration design

### 3.1 The planned scheduled chain

Three functions, invoked in this logical order per cycle:

1. **`enqueue-due-reminders` (producer)** - scans all circles for due medication/task/appointment/visit
   occurrences inside each per-type lookahead window and **enqueues** notifications + `pending` outbox rows
   (deduped on `(user_id, dedupe_key)`). Creates no deliveries and sends no push.
2. **`process-notification-outbox` (processor)** - Phase A `fanout_due_notifications` revalidates each due
   outbox row and materializes one `pending` delivery per **current** active token; Phase B
   `claim_push_deliveries` re-validates authoritatively, claims under a `claim_token` lease, and sends the
   **generic** push via Expo, recording `sent` + `expo_ticket_id`.
3. **`check-push-receipts` (receipt checker)** - sweeps tickets past the 24h retention window to `unchecked`,
   then polls `sent` + ticketed + `receipt_status IS NULL` deliveries **≥ 15 min old** (oldest-first) and
   records `ok` / `error` receipts. Sends no push; never touches the outbox.

> **Note - a fourth scheduled function exists but is OUT OF SCOPE here.** `config.toml` also disables
> `verify_jwt` for `check-missed-doses`. The missed-dose producer is **untested** (2F-10A) and is **not** part
> of this initial three-function chain; it should be added only after its own smoke test (later phase).

### 3.2 Intended order and why not simultaneous

- **Order = producer -> processor -> receipt checker** because each stage consumes the previous stage's output:
  the processor can only fan out outbox rows the producer created; the receipt checker can only poll tickets
  the processor recorded.
- **They must NOT fire at the same instant:**
  - **Producer vs processor:** running the processor a short interval **after** the producer lets the same
    cycle deliver freshly-enqueued rows (lower latency). Firing them together doesn't corrupt anything (the
    processor is DB-wide and would catch the rows next cycle regardless, and all state transitions are atomic
    in SQL), but it wastes a cycle of latency and needlessly co-loads the DB.
  - **Processor vs receipt checker:** a ticket the processor **just** created is `< receiptMinAgeMinutes (15m)`
    old, so the receipt checker would poll **nothing** for it. Running the checker at the same instant as the
    processor is pure waste; it should run on its **own, slower** cadence so tickets age past 15 min first.
  - **DB / secret-endpoint contention:** staggering avoids three service-role functions hammering the same
    tables and the same `x-cron-secret` endpoint simultaneously, and keeps each function's `log(...)` lines
    cleanly separated for observability.

### 3.3 Safe cadence options (proposals - DO NOT EXECUTE)

Anchored to `REMINDER_CONFIG` (all lookahead windows are **20 min**; `receiptMinAgeMinutes = 15`;
`receiptRetentionHours = 24`; `deliveryLockTimeoutSeconds = 600` = 10 min).

**A. Conservative dev / QA cadence (supervised smoke window only):**

| Function | Proposed cadence | Rationale |
| -------- | ---------------- | --------- |
| producer | every ~15 min (or a single supervised run) | ≤ 20-min lookahead so nothing slips; slow enough to watch each run |
| processor | ~1-2 min **after** the producer | same-cycle delivery; well inside the 10-min lock window |
| receipt checker | every ~30 min (or hourly) | ≥ 15-min min-age so tickets are pollable; far inside 24h retention |

Keep the schedule **disabled** except during an approved smoke window; prefer a single supervised chain over a
free-running loop for the first cron test.

**B. Future production cadence (illustrative target, still requires its own approval):**

| Function | Proposed cadence | Rationale |
| -------- | ---------------- | --------- |
| producer | every 5 min | comfortably ≤ 20-min lookahead; low reminder latency |
| processor | every 5 min, offset ~1-2 min from the producer | drains `pending` promptly; each run ends well before the next (10-min lock) |
| receipt checker | every 15-30 min | ≥ 15-min min-age to be useful; 30 min is ≪ 24h retention, so no ticket ages out |

### 3.4 Windowing constraints the cadence must respect

- **Task/med/appointment/visit lookahead = 20 min.** The producer cadence must be **≤ 20 min** or a due
  occurrence can fall between runs and be missed (the `config.ts` note: keep lookahead ≥ run cadence).
- **Receipt min age = 15 min.** The receipt checker gains nothing running more often than ~15 min; tickets
  younger than that are skipped.
- **Receipt retention = 24 h.** The receipt checker must run **at least once per 24h** per ticket, or the
  retention sweep marks it `unchecked` before it can be polled (exactly what happened to the aged 2F-8C
  delivery). Any production cadence ≤ a few hours satisfies this with wide margin.
- **Delivery lock timeout = 600 s (10 min).** A `processing` delivery locked longer than 10 min is treated as
  a crashed worker and reclaimed. Processor runs should complete well under 10 min (batch sizes below make this
  easy) so a healthy run is never mistaken for a crash.
- **Max batch sizes:** `fanoutBatchSize = 200`, `deliveryBatchSize = 200`, `expoPushBatchSize = 100`
  (Expo's per-request cap), `expoReceiptBatchSize = 300`, `receiptRetentionSweepLimit = 500`,
  `maxTasksPerRun / maxSchedulesPerRun / ... = 2000`. At QA scale (1 device, ≤ a handful of rows) every run is
  far below these caps; they matter only at production fan-out volume and bound each run's work so a single run
  can't stampede.

---

## 4. Auth and secret handling

- **Model (high level).** Each scheduled function first calls `authorizeScheduledRequest(req)` (`_shared/auth.ts`).
  The scheduler (pg_cron + pg_net, or an external cron) must present the shared secret
  **`NOTIFICATIONS_CRON_SECRET`** in the **`x-cron-secret`** header (or as `Authorization: Bearer <secret>`),
  compared **length-constant** (timing-safe). Platform JWT verification is **off** for these functions
  (`config.toml [functions.*] verify_jwt = false`), so the secret header is the sole credential; there is no
  end-user path to these endpoints.
- **No secret values are read or requested here.** This report references the secret **by name only**; Claude
  did not read, request, print, or store any secret value (and never will in a planning phase).
- **Fail-closed behavior.** If `NOTIFICATIONS_CRON_SECRET` is **unset** in the function environment,
  `authorizeScheduledRequest` returns `false` and the handler returns `401 { "error": "unauthorized" }` -
  the function refuses to run unauthenticated. A **wrong/missing** header likewise yields `401`. So a
  misconfigured schedule fails **safe** (no send), not open.
- **What must be reviewed before enabling cron:**
  1. `NOTIFICATIONS_CRON_SECRET` is configured in the deployed function environment (presence only - never its
     value) and is **high-entropy**.
  2. The scheduler stores/sends the secret **only** via a secure channel (pg_net header from a secret store, or
     an external secret manager) - never inline in committed SQL/migration text or logs.
  3. A rotation plan exists (rotate the secret + update the scheduler atomically) so a leaked secret can be
     retired without downtime.
  4. `EXPO_ACCESS_TOKEN` (if Expo Enhanced Push Security is on) is present in the function env and unexposed;
     `expo.ts` throws a clear, non-echoing error if a send/receipt call is rejected `401/403` without it.
  5. `verify_jwt = false` remains scoped to exactly these scheduled functions and no others.

---

## 5. DB-wide safety gates before any future cron execution

The producers and the processor/receipt functions are **database-wide** (no circle scoping). Before enabling
any schedule - even for a smoke test - the following must be **checked read-only and reviewed**. These are
**FUTURE / MANUAL preview** SELECTs, authored for a later approved phase and **NOT run here**; none mutates
data.

**Gate checklist (each must pass / be explained before enabling cron):**

- **Pending outbox count** - should be `0` (or exactly the intended smoke-test row), so cron doesn't
  immediately fan out a backlog.
- **Processing / stale deliveries** - no `processing` rows with `locked_at` older than
  `deliveryLockTimeoutSeconds`, i.e. no crashed-worker rows waiting to be reclaimed unexpectedly.
- **Eligible due tasks / meds / appointments / visits** - enumerate what is currently inside each producer's
  window DB-wide, so an enabled producer won't fire unexpected real notifications.
- **Active push tokens** - confirm which users have active tokens (at QA scale: exactly the one owner device),
  so fan-out volume is understood.
- **Recent failed deliveries** - no cluster of `failed` deliveries indicating a systemic send problem before
  adding cadence.
- **`receipt_status` null older than a threshold** - no large backlog of unpolled tickets that a first
  receipt-checker run would sweep to `unchecked`.
- **Unexpected non-QA eligible rows during the smoke test** - during the smoke window, assert the ONLY eligible
  row is the QA fixture (the DB-wide functions will co-process anything else).

**FUTURE / MANUAL preview - DO NOT RUN (SELECT-only; illustrative shapes for the later phase):**

```sql
-- DO NOT RUN. 2F-10B pre-enable gate PREVIEW (authored for a later approved phase). READ ONLY. No mutation.
-- 1. Pending outbox + any stale processing deliveries.
select
  (select count(*) from public.notification_outbox where status = 'pending')              as pending_outbox,
  (select count(*) from public.notification_push_deliveries
     where status = 'processing'
       and locked_at < now() - make_interval(secs => 600))                                as stale_processing,
  (select count(*) from public.notification_push_deliveries
     where status = 'sent' and receipt_status is null
       and sent_at < now() - interval '15 minutes')                                        as receipts_pending_ge_15m,
  (select count(*) from public.notification_push_deliveries where status = 'failed')       as failed_deliveries;
-- Expected before a clean smoke test: pending_outbox=0 (or the single QA row), stale_processing=0,
-- failed_deliveries=0; receipts_pending_ge_15m only from the intended fixture. Any surprise -> STOP.
```

```sql
-- DO NOT RUN. READ ONLY. 2. Everything the producer WOULD enqueue right now, DB-wide (task_due window shown;
-- mirror for med/appt/visit in the later phase). Confirms no unexpected non-QA eligible rows.
select t.id, t.circle_id, t.title, t.due_date, t.due_time,
       (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) as is_qa_circle
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() and now() + interval '20 minutes'
order by is_qa_circle desc;
-- Expected during the smoke window: exactly one row, is_qa_circle=true. Any other row -> STOP (Section 11).
```

No `INSERT` / `UPDATE` / `DELETE` / `cron.schedule` appears in this section.

---

## 6. Overlap and concurrency risk

- **Overlapping cron runs.** If a run of the same function starts before the previous finishes (slow DB, large
  batch), two workers process concurrently. This is **tolerated by design** but should be minimized.
- **Claim-token / lock behavior (why overlap is safe).** `fanout_due_notifications` and `claim_push_deliveries`
  select `FOR UPDATE SKIP LOCKED`, so concurrent workers grab **disjoint** rows - they never double-fan or
  double-claim the same row. A claimed delivery goes `processing` with `locked_at = now()` and a fresh
  `claim_token` (a lease).
- **Stale-claim behavior.** Result recorders (`mark_delivery_sent/failed/skipped`) write **only** when the row
  is still `processing` **and** the presented `claim_token` matches. If a slow/overlapping worker's lease was
  superseded (its row reclaimed after `deliveryLockTimeoutSeconds` with a new `claim_token`), its write matches
  **zero rows** and the Edge Function logs `stale_claim` instead of recording a false success. So overlap
  causes at worst a redundant Expo send (external push is explicitly **at-least-once**), never DB corruption or
  a false `sent`.
- **Recommended non-overlap spacing.** Space each function's runs comfortably longer than its typical run
  duration and keep processor spacing under the 10-min lock window's intent (a healthy run finishes in
  seconds at QA scale). Concretely: don't schedule the processor more often than it can finish; the 5-min
  production cadence with ~1-2 min producer offset (Section 3.3) leaves wide margin. Avoid firing all three at
  the same minute.
- **Future observability for overlap detection.** Track, per run: `fanout` counts, `claimed`, `sent`,
  `stale`, `failed`, `recordErrors`, `invalidTokens`, plus run duration. A rising `stale` count or runs whose
  duration approaches `deliveryLockTimeoutSeconds` signals overlap/slowness - alert on it before it becomes
  duplicate-push pressure.

---

## 7. Privacy and payload safety

- **Generic OS payload requirement (restated).** Every remote push carries only `genericPushMessage()` -> title
  `سند`, body `لديك تذكير جديد`; the outgoing `data` carries only routing identifiers (`type`,
  `notificationId`, `circleId`, `deepLink`). **No** medication name, task title, vital, note, or recipient name
  leaves in the remote payload. Detailed copy lives only in the in-app `notifications` row, fetched after
  authentication. Proven generic on device in 2F-8C and 2F-9B.
- **Guardrails to keep it that way:**
  - The processor builds the outgoing message **only** from `genericPushMessage()` and the fixed routing
    fields - it never reads the notification's detailed `title` / `body` into the Expo message. Any change here
    must preserve that.
  - No function logs a token (raw or partial), title, body, health value, or secret (documented in the
    processor header and enforced in the `log`/`logError` call sites).
- **Recommended future test / assertion (regression guard).** Add an automated check (unit/integration) that
  asserts the Expo message payload equals the generic title/body and that its `data` keys are a fixed
  allow-list (`type`, `notificationId`, `circleId`, `deepLink`) - failing CI if any care-detail field ever
  appears in the remote payload. This should be in place **before** cron runs unattended.

---

## 8. Failure handling

Behavior is already implemented; cron only changes cadence. Summary of what a scheduled run does on failure:

- **Processor errors (whole run).** Any thrown error in `process-notification-outbox` is caught -> logs
  `process_outbox_failed`, returns `{ ok: false }` (HTTP 500). No partial false state: SQL transitions are
  atomic; the next scheduled run retries.
- **Expo send batch failure.** If a whole batch never reaches Expo, each message is `failDelivery`'d with a
  bounded, lease-checked retry (`retry_at = now + deliveryBackoffBaseSeconds (120s) * attempt`) until the
  `deliveryMaxAttempts (5)` cap, then terminal `failed`.
- **Expo ticket errors (per message).** A ticket `status = 'error'` (not `DeviceNotRegistered`) is
  `failDelivery`'d with the provider's error code as the reason (retry/backoff, then terminal `failed`).
- **Receipt errors.** `check-push-receipts` records `receipt_status = 'error'` with the provider `error_code`
  and (on error) `last_error`; delivery `status` stays `sent`. Mismatched/stale receipts are no-ops
  (`record_delivery_receipt` returns false -> `mismatched`).
- **`DeviceNotRegistered` (invalid token).** The **only** token-deactivation trigger: the processor calls
  `deactivate_push_token_value` and marks the delivery `skipped` (`device_not_registered`); the receipt checker
  calls `deactivate_push_token_by_id`. `invalidTokens` is counted. No other outcome touches tokens. A future
  re-registration by the app reactivates the token.
- **Retention-window `unchecked`.** Tickets older than `receiptRetentionHours (24h)` with no receipt are marked
  `receipt_status = 'unchecked'`, `error_code = 'retention_window'` (never polled again). Expected, benign - a
  correctly-cadenced receipt checker keeps this rare.
- **Retry / terminal failure.** Every retry consumes exactly one attempt (lease-guarded); at the cap the row is
  terminal `failed`. Poison rows are isolated per-row in both `fanout_due_notifications` and
  `claim_push_deliveries` (sub-transaction; terminal-fail at the cap) so one bad row can't stall a run.

---

## 9. Rollback / disable plan (conceptual)

- **How a future cron schedule should be disabled (conceptual).** Whatever mechanism creates the schedule
  (a `pg_cron` job via `cron.schedule`, or a Dashboard/Integrations schedule) must have a **paired disable
  path**: `cron.unschedule(<jobid|jobname>)` for pg_cron, or toggling the schedule off in the Dashboard. The
  disable action must target **only** the notification jobs by name and leave any unrelated schedules
  untouched.
- **Exact SQL/CLI must be reviewed later.** This report does **not** author runnable `cron.schedule` /
  `cron.unschedule` statements. The exact enable and disable SQL/CLI (job names, schedule expressions, the
  pg_net call carrying the secret header) must be authored and **reviewed in a later phase (`2F-10C`)** before
  any use, under explicit approval - consistent with the "do not create cron jobs" constraint here.
- **Evidence to capture BEFORE disablement:** the active job list (`cron.job` names/schedules/active flags),
  the current outbox status summary, delivery status/receipt summary, and any `pending`/`processing` rows in
  flight - so the pre-disable state is recorded.
- **Evidence to capture AFTER disablement:** the job list shows the notification jobs **absent/inactive**, no
  new notifications/deliveries are created after the disable timestamp, no `pending` outbox remains (or the
  remaining rows are understood), and no push arrives on the device thereafter. Both snapshots (before/after)
  should be recorded read-only in the disabling phase's report.

---

## 10. Future smoke-test plan outline (`2F-10C` - to be planned, NOT executed here)

**Goal:** prove the *scheduled* chain end-to-end once, in a controlled, reversible window, with the same clean
result the manual runs achieved.

- **Tiny QA-safe fixture:** one fresh `[QA CRON]`-style task in the QA circle
  (`ae4721d8-...`), assigned to the owner (`a6dc7376-...`), due ~8-12 min ahead (circle-local), created through
  the app UI - exactly the shape proven in 2F-8C / 2F-9B. No real family data involved.
- **Explicit approval required before EACH of:**
  - any **SQL** (even read-only prechecks),
  - any **DB connection**,
  - any **Edge invocation**,
  - any **cron enablement** (creating/enabling the schedule),
  - any **push delivery** (the processor step sends a real push).
- **Controlled window:** enable the schedule only for a short supervised window (or run a single supervised
  chain), then **disable** it per Section 9.
- **Success criteria (all must hold):**
  - exactly **one** intended `task_due` notification (deduped),
  - exactly **one** intended `pending -> fanned` outbox row,
  - exactly **one** intended `sent` delivery with an Expo ticket,
  - exactly **one** generic Android OS push (title `سند`, body `لديك تذكير جديد`; no private detail),
  - the receipt **checked later** (`receipt_status = 'ok'`) once the ticket is ≥ 15 min old and within 24h,
  - **no collateral** notifications/deliveries outside the QA fixture,
  - **no `pending`** outbox remains after processing,
  - cron **disabled or left in the reviewed state** the plan specifies, with before/after evidence captured.
- **Then:** clean up the `[QA CRON]` fixture through the app UI (as in 2F-8D / 2F-9C).

---

## 11. Recommended next phase

1. **First, commit this planning report** (docs-only; nothing executed).
2. **Then proceed to `2F-10C - cron smoke-test EXECUTION PLAN (no execution)`** - author the tiny-fixture
   smoke-test plan, the read-only pre-enable gate SQL pack (marked not-run), the exact (still-not-run) enable
   and disable SQL/CLI for review, and the before/after evidence templates. `2F-10C` still **executes nothing**;
   it is the reviewed plan that a later, separately-approved execution phase would follow.
3. **If risk is judged too high to schedule at all yet,** stay in planning: first add the **preflight SQL packs**
   (Section 5 gates) and the **privacy regression assertion** (Section 7) as their own reviewed deliverables,
   and defer any cron enablement until those exist.
4. **Do not enable cron immediately.** No schedule is created in `2F-10B` or `2F-10C`; enablement is a distinct,
   explicitly-approved step after the smoke-test plan is reviewed.

---

## 12. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results are recorded in Section 14's hand-off. No other command is run in this phase.

---

## 13. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched - read only).
- **No migrations changed** (`supabase/migrations/**` untouched - read only).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run** (every SQL block is a FUTURE / MANUAL preview, SELECT-only, marked DO NOT RUN; no
  `INSERT` / `UPDATE` / `DELETE` / `cron.schedule` appears).
- **No DB connection.**
- **No deploy.**
- **No Edge invocation** (`enqueue-due-reminders`, `process-notification-outbox`, `check-push-receipts`,
  `check-missed-doses` were not run).
- **No cron enabled / created** (no schedule, no `cron.schedule` / `cron.unschedule` executed).
- **No notification delivery / push** (nothing sent).
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only; no
  value read or requested; all UUIDs are user / circle / task / notification / outbox / delivery / token /
  ticket identifiers, not secrets).
- **No raw Expo token exposed** (only internal uuids and recorded ticket ids appear).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 14. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10b-cron-orchestration-planning.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
