# Phase 2F-10C - Cron smoke-test EXECUTION PLAN (no execution)

**Status:** Planning only - an **execution plan** for a single, tiny, QA-safe cron smoke test. **Nothing is
executed.** This report only reads existing reports, Edge source, shared modules, migrations, and `config.toml`,
and authors the plan, the read-only preflight SQL previews (marked DO NOT RUN), the future cron enable/disable
previews (marked DO NOT RUN), the execution sequence, success/stop criteria, and the evidence templates a later
approved phase would follow. **Claude ran no Supabase CLI, no SQL, made no DB connection, invoked no Edge
Function, enabled no cron, created no cron job, processed no outbox, checked no receipts, sent no push, and read
no secret value.** The only filesystem write in this phase is this report; the only commands Claude runs are the
two local read-only checks in Section 15 and the read-only git status/diff in Section 17.

**Baseline commit:** `docs(product): plan notification cron orchestration` (current `master` HEAD, pushed).
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Owner user (recipient / token owner):** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.
**Owner active push token id:** `93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8` (masked scheme only; raw token never exposed).

**Sources inspected read-only (no file modified):** `2F-10B` cron orchestration plan, `2F-10A` closeout/readiness,
`2F-9C` / `2F-9B` / `2F-9A` receipt reports, `2F-8C` positive-push results; Edge source
(`enqueue-due-reminders`, `process-notification-outbox`, `check-push-receipts`) + shared
(`config.ts` `REMINDER_CONFIG`, `auth.ts`, `enqueue.ts`, `messages.ts` `genericPushMessage`, `expo.ts`);
migrations `20260611120000_...notifications_core`, `20260611120100_...notification_functions`,
`20260626164000_...responsibility_resolvers`; `supabase/config.toml`.

**Cron-infrastructure finding (read-only, unchanged from 2F-10B):** there is **no `pg_cron` schedule and no cron
migration** in the repo. The only cron references are the `auth.ts` doc-comment and the `config.toml`
`verify_jwt = false` block for the four scheduled functions. Enabling cron is greenfield.

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **This is an execution plan only.** Nothing was executed.
- **Cron remains OFF** - no schedule exists; this report creates none.
- **No SQL was run.** Every SQL block below is a FUTURE / MANUAL preview marked **DO NOT RUN IN 2F-10C**.
- **No DB connection was made.**
- **No Edge Function was invoked** (`enqueue-due-reminders`, `process-notification-outbox`,
  `check-push-receipts`, `check-missed-doses` were not called).
- **No push was sent.**
- **No secrets were read** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only).
- **Readiness verdict:** the plan is **ready for a later, human-approved execution phase** (`2F-10D`), provided
  that phase honors every approval gate in Section 4, passes the Section 5 preflight, and keeps the cron window
  controlled and reversible (Sections 7-9). This report authorizes **nothing** to run.

---

## 2. Baseline

- **Latest commit:** `docs(product): plan notification cron orchestration` (current `master` HEAD).
- **No pending outbox** remains (per 2F-9C / 2F-10A / 2F-10B).
- **Outbox final state** (database-wide): `fanned = 2`, `skipped = 1`, `pending = 0`.
- **Deliveries final state:** `sent` / `receipt_status = 'ok'` = `1` (`60cd396b-...`); `sent` /
  `receipt_status = 'unchecked'` = `1` (`0fef9576-...`, `retention_window`).
- **QA fixtures:** `[QA PUSH]` (`08763a6a-...`) **completed**; `[QA RECEIPT]` (`5cfcdb5d-...`) **completed**.
- **Cron:** **off**.
- **No cron migration / no `pg_cron` schedule** currently in the repo.

---

## 3. Scope of the future smoke test

- **One tiny QA-safe cron test only** - the minimum needed to prove the *scheduled* chain end-to-end once.
- **Target circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c`.
- **Target owner:** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.
- **Target fixture:** one fresh task titled `[QA CRON] اختبار جدولة الإشعارات`, assigned to the owner, `status =
  'open'`, due **~8-12 minutes ahead in the circle-local timezone** (`Asia/Riyadh`, UTC+3), created through the
  app UI, carrying **no real family data** and no sensitive note/body.
- **Only the `task_due` producer path is in scope.** No medication / appointment / visit fixtures are created,
  so no other producer type should fire.
- **`check-missed-doses` remains OUT OF SCOPE** - it is untested and not part of the initial cron chain.

---

## 4. Human approval gates (required before the later execution phase)

Each gate below must be **explicitly approved by a human immediately before** the corresponding action in the
execution phase. No gate implies the next.

| # | Gate | What will happen | Why needed | Risk it carries | Evidence to capture |
| - | ---- | ---------------- | ---------- | --------------- | ------------------- |
| G1 | **SQL (read-only)** | Run the Section 5 preflight SELECTs | Confirm a clean, understood baseline before any change | Minimal (reads only); risk is acting on a misread result | Full preflight output (Section 12.1) |
| G2 | **DB connection** | Open a Dashboard SQL / service connection | Preflight + post-checks need it | Connection to production data; must be the Sanad project only | Project ref confirmation `qccgshanmoeybagxwvcs` |
| G3 | **QA fixture creation** | Create `[QA CRON]` task via app UI | Provide exactly one intended eligible row | A mis-shaped fixture could miss the window or target the wrong user | Fixture row (Section 12.2) |
| G4 | **Edge invocation** | The scheduled functions call the endpoints | The test *is* the scheduled invocation | DB-wide functions co-process any other due row | Producer/processor/receipt responses (Section 12) |
| G5 | **Cron enablement** | Create + enable the schedule (or reviewed one-shot) | Prove the scheduled path, not just manual calls | New surface: cadence, overlap, secret handling | `cron.job` listing before/after (Section 12.3) |
| G6 | **Push delivery** | A real generic OS push is sent | Confirms external delivery | A real device notification is produced | Device push observation (Section 12.7) |
| G7 | **Receipt checker polling** | `check-push-receipts` polls the ticket | Drive `receipt_status` -> `ok` | Sweeps DB-wide; could mark aged tickets `unchecked` | Receipt response + delivery receipt row (Section 12.8) |
| G8 | **Cron disablement** | Unschedule/disable only Sanad jobs | Return to the reviewed off/steady state | Disabling the wrong job; leaving a job running | `cron.job` after disable (Section 12.9) |
| G9 | **Cleanup** | Complete `[QA CRON]` via app UI | Retire the fixture so it can't refire | Forgetting cleanup leaves an open QA task | Fixture `completed` + source-validity `task_closed` (Section 12.10) |

---

## 5. Future read-only preflight SQL pack

**Author-only previews. SELECT-only. No `INSERT` / `UPDATE` / `DELETE`. Run in the Dashboard SQL editor during
the later approved phase, not now.**

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Pending-outbox count.
select count(*) as pending_outbox from public.notification_outbox where status = 'pending';
-- Expected: 0 before the fixture (or exactly 1 = the [QA CRON] row after creation + producer).
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Outbox status summary.
select status::text as outbox_status, count(*) as rows
from public.notification_outbox group by status order by status;
-- Expected baseline: fanned=2, skipped=1, no pending.
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Delivery status + receipt summary.
select status::text as delivery_status,
       coalesce(receipt_status, '(null)') as receipt_status, count(*) as rows
from public.notification_push_deliveries group by status, receipt_status order by 1, 2;
-- Expected baseline: sent/ok=1, sent/unchecked=1.
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Processing / stale deliveries.
select count(*) as processing_total,
       count(*) filter (where locked_at < now() - make_interval(secs => 600)) as stale_processing
from public.notification_push_deliveries where status = 'processing';
-- Expected: 0 / 0. Any stale_processing > 0 -> STOP (crashed-worker rows must be understood first).
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Sent deliveries pending a receipt (>=15m old).
select id as delivery_id, expo_ticket_id, sent_at
from public.notification_push_deliveries
where status = 'sent' and receipt_status is null and expo_ticket_id is not null
  and sent_at < now() - interval '15 minutes'
order by sent_at asc;
-- Expected baseline: zero (the old ticket was already swept to 'unchecked'). New QA ticket appears only after
-- it ages past 15 minutes.
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Failed deliveries.
select count(*) as failed_deliveries from public.notification_push_deliveries where status = 'failed';
-- Expected: 0. A cluster of failures -> STOP (systemic send problem).
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Active push tokens for the owner, by circle
-- membership + role. NEVER selects the raw token (masked to its scheme only).
select
  pt.id as push_token_id, pt.platform, pt.device_id, pt.is_active,
  cm.role::text as circle_role, cm.status::text as membership_status,
  split_part(pt.expo_push_token, '[', 1) || '[***]' as token_scheme_masked
from public.push_tokens pt
left join public.circle_members cm
  on cm.user_id = pt.user_id and cm.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
where pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid
order by pt.is_active desc, pt.last_seen_at desc;
-- Expected: exactly one active token on one device, owner is an active operational member. Zero active -> STOP
-- (no push). Multiple active tokens/devices -> STOP unless intentional (would send multiple pushes).
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Everything the task_due producer WOULD enqueue
-- in the next 20 minutes, DB-wide, flagged QA vs non-QA.
select t.id, t.circle_id, t.title, t.due_date, t.due_time,
       (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
        and t.title like '[QA CRON]%') as is_qa_cron_fixture
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() and now() + interval '20 minutes'
order by is_qa_cron_fixture desc;
-- Expected during the smoke window: exactly one row, is_qa_cron_fixture=true.
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Unexpected non-QA eligible rows anywhere in the
-- next 20 minutes (task_due window; mirror for med/appt/visit if those producers are ever in scope).
select count(*) as non_qa_eligible_task_due
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() and now() + interval '20 minutes'
  and not (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%');
-- Expected: 0. Any > 0 -> STOP: the DB-wide producer/processor would co-process it.
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Cron job list, IF pg_cron is installed.
-- Safe existence probe first (null => pg_cron not installed => cron is off).
select to_regclass('cron.job') as cron_job_regclass;
-- Then, ONLY if non-null:
-- select jobid, jobname, schedule, active, command from cron.job
-- where command ilike '%enqueue-due-reminders%' or command ilike '%process-notification-outbox%'
--    or command ilike '%check-push-receipts%' order by jobid;
-- Expected before enablement: cron_job_regclass null OR zero Sanad notification jobs. Any pre-existing Sanad
-- notification job -> STOP (unexpected; investigate before proceeding).
```

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY. Confirm the QA fixture does NOT already exist
-- before creation (avoid duplicates).
select count(*) as existing_qa_cron_open
from public.care_tasks t
where t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
  and t.title like '[QA CRON]%' and t.status = 'open';
-- Expected before creation: 0. If > 0, an old fixture exists -> retire it (app UI) so exactly one open remains.
```

No `INSERT` / `UPDATE` / `DELETE` appears in this preflight section.

---

## 6. Future QA fixture creation plan

- **Prefer app-UI creation** (as in 2F-8C / 2F-9B), so every RLS, trigger, and assignment guard runs exactly as
  in production. A manager of the QA circle creates the task and assigns it to the owner (or the owner creates
  it directly if they are a manager).
- **Exact fixture requirements:**
  - **Title:** `[QA CRON] اختبار جدولة الإشعارات`
  - **Circle id:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c`
  - **Assigned owner:** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`
  - **Status:** `open`
  - **Due date/time:** **8-12 minutes ahead** in the circle-local timezone (`Asia/Riyadh`), so it is inside the
    producer's `[now, now + taskLookaheadMinutes (20m)]` window with slack to run the producer before the due
    instant passes.
  - **No sensitive note/body** - the title is a neutral QA marker; no health/care detail.
  - **Easy to identify and clean up** - the `[QA CRON]` prefix makes it unambiguous to find and retire.
- **If SQL fixture creation is ever discussed** (not preferred): it is **future / manual / not-run** and
  requires its **own separate approval**; this report authors no `INSERT`. App-UI creation is the default.

---

## 7. Future cron enablement design (preview only)

> **DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY.** The exact enablement (job names, schedules, and the
> pg_net call carrying the secret) must be **reviewed before use** in the approved execution phase. Secrets must
> come from a secret store (e.g. Supabase Vault), **never** hardcoded, printed, or committed.

- **Proposed job names:** `sanad-enqueue-due-reminders`, `sanad-process-notification-outbox`,
  `sanad-check-push-receipts` (a stable `sanad-` prefix so disablement can target only these).
- **Proposed schedule offsets** (production-shaped; a supervised one-shot/short window is preferred for the
  first test):
  - **producer:** every 5 min - `*/5 * * * *` (≤ the 20-min lookahead so nothing slips).
  - **processor:** ~2 min after the producer - `2-59/5 * * * *` (drains `pending` same-cycle; each run finishes
    well under the 10-min `deliveryLockTimeoutSeconds`).
  - **receipt checker:** every 30 min - `*/30 * * * *` (≥ the 15-min `receiptMinAgeMinutes` to be useful; ≪ the
    24h `receiptRetentionHours` so no ticket ages out).
- **Endpoint invocation model (`x-cron-secret`):** each job issues an HTTPS POST to
  `https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/<function>` with header
  `x-cron-secret: <NOTIFICATIONS_CRON_SECRET>`; `verify_jwt = false` for these functions, so the secret header
  is the only credential and `authorizeScheduledRequest` fails closed on a wrong/absent secret.

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. ILLUSTRATIVE cron enablement (pg_cron + pg_net). The secret
-- MUST be read from a secret store at call time (placeholder shown as :cron_secret) — do NOT inline, print, or
-- commit the value. Exact form (job names, schedules, header wiring, URL) to be REVIEWED before use.
-- select cron.schedule('sanad-enqueue-due-reminders', '*/5 * * * *', $$
--   select net.http_post(
--     url    => 'https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/enqueue-due-reminders',
--     headers => jsonb_build_object('Content-Type','application/json','x-cron-secret', :cron_secret),
--     body   => '{}'::jsonb) $$);
-- select cron.schedule('sanad-process-notification-outbox', '2-59/5 * * * *', $$ ...process-notification-outbox... $$);
-- select cron.schedule('sanad-check-push-receipts', '*/30 * * * *', $$ ...check-push-receipts... $$);
-- WARNING: never hardcode/print the secret; never commit it; keep it only in the secret store / function env.
```

- **Warnings (must be honored):** do **not** hardcode or print `NOTIFICATIONS_CRON_SECRET`; do **not** commit
  it; source it only from the secret store; and confirm `pg_cron` + `pg_net` are available before authoring the
  real statements.

---

## 8. Future cron disable / rollback plan (preview only)

> **DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY.** Exact disable SQL/CLI to be **reviewed before use**.

- **Identify only Sanad notification jobs:** filter `cron.job` by the `sanad-` name prefix (and/or by
  `command ilike '%<function>%'`) so unrelated schedules are never touched.
- **Disable/unschedule only those jobs:** `cron.unschedule('<jobname>')` for each of the three, or toggle
  `active = false` in the Dashboard for exactly those jobs.

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY identification, then targeted unschedule.
-- select jobid, jobname, schedule, active from cron.job where jobname like 'sanad-%' order by jobname;
-- Then, for each Sanad notification job ONLY:
-- select cron.unschedule('sanad-enqueue-due-reminders');
-- select cron.unschedule('sanad-process-notification-outbox');
-- select cron.unschedule('sanad-check-push-receipts');
-- Confirm none remain:
-- select count(*) as sanad_jobs_remaining from cron.job where jobname like 'sanad-%';  -- expect 0
```

- **Evidence to capture BEFORE disabling:** the active `cron.job` list (names/schedules/active), the current
  outbox summary, the delivery status/receipt summary, and any `pending` / `processing` rows in flight.
- **Evidence to capture AFTER disabling:** the `cron.job` list shows the Sanad jobs **absent/inactive**; a
  timestamped count confirms **no new notifications** (`created_at > disable_ts`) and **no new deliveries**
  (`created_at > disable_ts`); and the outbox shows **no `pending`** remains.

```sql
-- DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY. READ ONLY post-disable verification.
-- select count(*) as notifs_after_disable from public.notifications where created_at > '<DISABLE_TS_UTC>'::timestamptz;   -- expect 0
-- select count(*) as deliveries_after_disable from public.notification_push_deliveries where created_at > '<DISABLE_TS_UTC>'::timestamptz;  -- expect 0
-- select count(*) as pending_outbox from public.notification_outbox where status = 'pending';  -- expect 0
```

---

## 9. Future execution sequence (for the later approved phase - NOT executed now)

1. **Confirm clean git** - working tree clean/synced; the plan (`2F-10C`) committed and pushed.
2. **Confirm app/device ready** - the owner is signed in on the physical Android test device, notification
   permission enabled, exactly one active push token registered (Section 5 token gate).
3. **Run read-only preflight** (G1/G2) - execute the Section 5 pack; confirm the clean baseline (no pending, no
   stale, no failed cluster, no unexpected eligible rows, no pre-existing Sanad cron job).
4. **Create the QA fixture** (G3) - app UI, `[QA CRON] اختبار جدولة الإشعارات`, due 8-12 min ahead
   (Section 6).
5. **Re-run read-only preflight** - confirm **exactly one** eligible `task_due` row and it is the `[QA CRON]`
   fixture (`is_qa_cron_fixture = true`, `non_qa_eligible_task_due = 0`).
6. **Enable cron for a controlled window** (G5) - create the three `sanad-` jobs per the **reviewed** Section 7
   statements (or run the reviewed one-shot scheduled-test method). Record the `cron.job` listing.
7. **Watch producer evidence** (G4) - the producer run creates exactly one `task_due` notification + one
   `pending` outbox row for the fixture (response `task = 1`, all others `0`).
8. **Watch processor evidence** (G4) - fan-out `fanned = 1`, `claimed = 1`, `sent = 1`, all error counters `0`;
   one `sent` delivery with an `expo_ticket_id`.
9. **Confirm the Android OS push** (G6) - a real generic push arrives: **title `سند`, body `لديك تذكير جديد`**,
   under the `Sanad` app, no private detail.
10. **Wait until the receipt is old enough** - the ticket must be `≥ receiptMinAgeMinutes (15m)` old and within
    `receiptRetentionHours (24h)`.
11. **Run / wait for the receipt checker** (G7) - per the reviewed schedule; response `checked = 1`,
    `recorded = 1`, `mismatched = 0`, `recordErrors = 0`, `invalidTokens = 0`.
12. **Verify `receipt_status = 'ok'`** - the fixture delivery shows `receipt_status = 'ok'`, `receipt_id` =
    the ticket, delivery still `sent`, token still active.
13. **Disable cron or leave in the reviewed state** (G8) - unschedule the three `sanad-` jobs (Section 8);
    capture before/after evidence.
14. **Cleanup the fixture** (G9) - complete `[QA CRON]` through the app UI; confirm source-validity flips to
    `task_closed`.
15. **Final read-only evidence** - re-run the summary SELECTs; confirm no collateral rows, no pending outbox.
16. **Final report / commit only after validation** - write the `2F-10D` execution record, run
    `npm run check:mojibake` + `git diff --check`, then commit (docs-only) under approval.

---

## 10. Success criteria (exact pass conditions)

- Exactly **one** intended `task_due` notification for `[QA CRON]` (deduped on `(user_id, dedupe_key)`).
- Exactly **one** intended outbox row for it.
- The outbox row reaches **`fanned`**.
- Exactly **one** intended push delivery.
- The delivery reaches **`sent`** with a non-null **Expo ticket id**.
- Exactly **one** Android OS push arrives.
- The OS push is **generic** (title `سند`, body `لديك تذكير جديد`) and contains **no private detail**.
- The receipt later becomes **`ok`** (`receipt_status = 'ok'`, `receipt_id` = the ticket).
- **No collateral notifications** (nothing outside the QA fixture).
- **No collateral deliveries.**
- **No `remote_member` operational push** (no operational reminder delivered to a remote-role member).
- **No `pending` outbox** remains after processing.
- Cron is **disabled** or left **only** in an explicitly reviewed state.
- The fixture is **completed / cleaned up**.
- **No secrets exposed** (no token/secret value in any log, report, or chat).

---

## 11. Stop / fail criteria (halt the execution phase immediately)

- **Unexpected non-QA eligible rows** in any producer window (`non_qa_eligible_task_due > 0`, etc.).
- **Pending outbox backlog** that is not understood (`pending_outbox` beyond the intended fixture row).
- **Stale `processing` deliveries** not understood (`stale_processing > 0`).
- **A cluster of failed deliveries** (systemic send problem).
- **No active QA push token** for the owner (fan-out would skip `no_active_token`; nothing to observe).
- **Unexpected active tokens / devices** for the owner (would send multiple pushes).
- **A Sanad cron job already exists** unexpectedly before enablement.
- **Secret presence cannot be verified safely** (can't confirm `NOTIFICATIONS_CRON_SECRET` is configured without
  risking exposure).
- **App / device not ready** (not signed in, permission off, or token unregistered).
- **A duplicate notification** appears for the fixture.
- **Private detail appears in the OS push** (any care/health/title detail in the remote payload).
- **A push arrives for the wrong user / device.**
- **A receipt `error`** that is not understood (unexpected `error_code`).
- **Cron cannot be disabled cleanly** (a `sanad-` job remains after unschedule).

Any of these -> **STOP**, capture evidence, and do not proceed until resolved.

---

## 12. Evidence template (copy-paste for the later execution report)

```text
### 12.1 Preflight evidence (before fixture)
pending_outbox: ____        outbox summary: fanned=__ skipped=__ pending=__
delivery/receipt summary: sent/ok=__ sent/unchecked=__
processing=__ stale_processing=__   failed_deliveries=__
receipts_pending_ge_15m: ____
owner active tokens: ____ (device: ____, role: ____)
task_due eligible next 20m: ____ (is_qa_cron_fixture: ____)   non_qa_eligible: ____
cron_job_regclass: ____   pre-existing sanad jobs: ____
existing_qa_cron_open: ____

### 12.2 Fixture evidence
task id: ____   title: [QA CRON] اختبار جدولة الإشعارات
assigned_to: a6dc7376-...  assigned_to_owner: ____  status: open
due_date: ____  due_time: ____  circle_tz: Asia/Riyadh  due_at_utc: ____
in_task_due_window_now: ____

### 12.3 Cron job evidence (before)
jobname / schedule / active:
  sanad-enqueue-due-reminders   ____   ____
  sanad-process-notification-outbox   ____   ____
  sanad-check-push-receipts   ____   ____

### 12.4 Notification evidence
notification_id: ____  type: task_due  user_id: a6dc7376-...
data_item_id: <fixture task id>  dedupe_key: task:<id>:<date>:<time>

### 12.5 Outbox evidence
outbox_id: ____  status: pending -> fanned  last_error: null

### 12.6 Delivery evidence
delivery_id: ____  status: sent  push_token_id: 93b4e8b8-...
sent_at: ____  expo_ticket_id: ____  receipt_status: null (pre-receipt)

### 12.7 OS push evidence
push received: yes/no   app: Sanad   title: سند   body: لديك تذكير جديد
device time: ____   private detail present: NO

### 12.8 Receipt evidence
receipt response: checked=__ recorded=__ mismatched=__ recordErrors=__ invalidTokens=__
delivery after: receipt_status=ok  receipt_id=<ticket>  delivery_status=sent  token_active=true

### 12.9 Disable evidence
disable_ts_utc: ____
cron jobs after: sanad-* remaining = 0
notifs_after_disable: 0   deliveries_after_disable: 0   pending_outbox: 0

### 12.10 Cleanup evidence
fixture status: completed   completed_at: ____   cancelled_at: null
source-validity: valid=false reason=task_closed

### 12.11 Final state
outbox: fanned=__ skipped=__ pending=0
deliveries: sent/ok=__ sent/unchecked=__
cron: disabled/reviewed   secrets exposed: NO
```

---

## 13. Risk assessment

- **DB-wide cron processing (MEDIUM, gated).** Producers/processor/receipt functions are unscoped by circle;
  once scheduled they process every eligible row DB-wide (bounded by the batch caps: fanout/delivery 200, expo
  push 100, receipt 300, sweep 500). Mitigated by the Section 5 gates (assert only the QA fixture is eligible)
  and a short controlled window.
- **Cron overlap (LOW-MEDIUM, handled).** Overlapping runs grab disjoint rows via `FOR UPDATE SKIP LOCKED`;
  spacing (Section 7) keeps runs from stacking. Watch run duration vs the 10-min lock.
- **Stale claims (LOW).** The `claim_token` lease means a superseded worker's result write matches zero rows and
  is logged `stale_claim`, never a false `sent`. Rising `stale` counts signal overlap/slowness.
- **Duplicate OS push possibility (LOW, by design).** External push is **at-least-once**: a network timeout
  after Expo accepts, or a reclaimed stale row, can resend. The DB never double-records `sent`; a rare duplicate
  device push is acceptable and must be noted, not treated as failure.
- **Secret handling (MEDIUM, gating).** `NOTIFICATIONS_CRON_SECRET` must live only in the secret store /
  function env, sourced by pg_net at call time - never inline in SQL, never printed, never committed. Fail-closed
  auth protects against a missing/wrong secret. Verifying presence must not expose the value.
- **Token invalidation (LOW, narrow).** Only a definitive `DeviceNotRegistered` deactivates a token
  (`deactivate_push_token_value` / `_by_id`); no other outcome. Expect `invalidTokens = 0`.
- **Privacy regression (LOW, guard recommended).** The payload is generic by construction
  (`genericPushMessage`); a future code change could regress it. Recommend the Section 7 (2F-10B) payload
  assertion in CI before unattended cron.
- **Missed-dose out-of-scope risk (LOW).** `check-missed-doses` is deliberately excluded from the chain and the
  fixture; enabling only the three `sanad-` jobs keeps it dormant. Do not schedule it in this test.
- **Cleanup / source-validity risk (LOW).** Completing the fixture flips source-validity to `task_closed`, so a
  later pass skips it. Forgetting cleanup leaves an open QA task that could refire - the Section 4 G9 gate and
  Section 9 step 14 enforce it.

---

## 14. Recommended next phase

**Conservative recommendation: `2F-10D - preflight SQL review only`** as the immediate next step - review and
finalize the Section 5 read-only preflight pack (and, separately, the Section 7/8 enable/disable statements) as
authored, still-not-run artifacts, and confirm the secret-store wiring for `NOTIFICATIONS_CRON_SECRET` is
understood. Only **after** that review is signed off should a distinct, explicitly-approved
**`2F-10D - cron smoke-test execution`** phase run the plan.

- **Do not enable cron immediately** from this report - enablement remains a later, separately-approved step.
- If any Section 13 risk is judged too high at review time, **stay in planning** and add the missing guardrail
  (e.g. the CI payload assertion) before scheduling anything.

---

## 15. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results are recorded in Section 17's hand-off. No other command is run in this phase.

---

## 16. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched - read only).
- **No migrations changed** (`supabase/migrations/**` untouched - read only).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run** (every SQL block is marked `DO NOT RUN IN 2F-10C — FUTURE MANUAL PREVIEW ONLY`; the preflight
  section is SELECT-only; no `INSERT` / `UPDATE` / `DELETE` / executed `cron.schedule` appears).
- **No DB connection.**
- **No deploy.**
- **No Edge invocation** (`enqueue-due-reminders`, `process-notification-outbox`, `check-push-receipts`,
  `check-missed-doses` were not run).
- **No cron enabled / created** (no schedule; no `cron.schedule` / `cron.unschedule` executed).
- **No notification delivery / push** (nothing sent).
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only; no
  value read or requested; all UUIDs are user / circle / task / notification / outbox / delivery / token /
  ticket identifiers, not secrets).
- **No raw Expo token exposed** (only internal uuids and recorded ticket ids appear; token listings masked).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 17. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10c-cron-smoke-test-execution-plan.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
