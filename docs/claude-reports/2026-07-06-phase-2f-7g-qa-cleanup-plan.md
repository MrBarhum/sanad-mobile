# Phase 2F-7G - QA cleanup plan for the shaped smoke-test task (design only; no execution)

**Status:** No-execution **cleanup plan**. **Claude ran no Supabase CLI, no SQL, made no DB connection,
invoked no Edge Function, enabled no cron, processed no outbox, and sent no push.** Nothing was executed
against the database. Every SQL block below is **authored for later manual use** and is marked read-only /
future / not-executed. The only filesystem write in this phase is this report; the only commands run are
the two local read-only checks in Section 8 and the read-only git status/diff in Section 10.

**Baseline (pushed) commit:** `988203b docs(product): record app notification verification`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).

**Target QA task (shaped for smoke testing):**

| Field | Value |
| ----- | ----- |
| task id | `23bff3fa-130d-4e29-96ec-80bac0647060` |
| title | `مشي سريع` |
| shaped due_date | `2026-07-06` |
| shaped due_time | `12:37:00` (circle-local; circle tz is UTC+3) |
| owner (`assigned_to`) | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` |
| related notification | `5ba7fb2d-cd29-470a-b2fe-f41df75051fc` (`task_due`) |
| known pending outbox | one row, still `pending`, zero deliveries |

**Sources inspected read-only:** 2F-7F, 2F-7E, 2F-7D reports; `supabase/functions/_shared/enqueue.ts`;
`supabase/migrations/20260611120000_create_notifications_core.sql` (notification tables);
`supabase/migrations/20260611120100_create_notification_functions.sql` (the actual enqueue/processing
functions file - the task's cited `20260611120100_notification_enqueue_and_processing.sql` is this file
under its real name); `supabase/migrations/20260626164000_notifications_responsibility_resolvers.sql` (the
current committed `notification_source_validity` body); `supabase/migrations/20260610090000_create_care_tasks.sql`
(`care_task_status` enum + `care_tasks_collaborator_scope` trigger); `src/locales/ar.json` (`markComplete` =
`تم الإنجاز`). No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **This is a no-execution cleanup plan.** No SQL was run, no Edge Function invoked, no cron / outbox /
  push occurred, and no data was mutated.
- **Cleanup is recommended before any outbox / push work.** The shaped target task should be retired first
  so no producer re-scan can create a fresh notification while later outbox testing is designed.
- **The target task was shaped for smoke testing and can now become eligible for `task_overdue`.** Its due
  instant (`2026-07-06 09:37:00+00`) has passed; while it stays `open` it can fall inside the overdue window
  `[now-24h, now-60m]`.
- **The safest cleanup is to close the QA task through the app UI**, preferably `تم الإنجاز` (mark
  complete) if product QA allows; cancel is an acceptable alternative. A non-`open` task is excluded from
  every producer scan.
- **Do not use raw SQL for task content / status changes unless a later, separately approved plan proves it
  safe.** `care_tasks` carries the `care_tasks_collaborator_scope` `BEFORE UPDATE` trigger; in the Dashboard
  SQL Editor `auth.uid()` is null, so raw content edits are rejected and completion-bookkeeping checks
  reference the (null) actor - the app UI (authenticated manager or assigned owner) is the product-correct,
  safe path.
- **No Edge Functions, no cron, no outbox, no push in this phase.** Do **not** re-run `enqueue-due-reminders`;
  do **not** run `process-notification-outbox`.

---

## 2. Why cleanup is needed

- **The task's due time was intentionally moved to trigger `task_due`.** 2F-7E-alt shaped the target's due
  to `2026-07-06 12:37:00` local (`current_due_at 09:37:00+00`) to land it inside the 20-minute `task_due`
  window so the producer would create exactly one notification (2F-7E: `task = 1`, all other counters `0`).
- **After time passes, keeping it open can make it eligible for `task_overdue`.** The overdue scan keeps an
  open, dated task when `dueAt ∈ [now-24h, now-60m]` (`taskOverdueGraceMinutes = 60`,
  `taskOverdueMaxAgeHours = 24`). Once ~60 minutes past `09:37:00+00`, the shaped target enters that window.
- **Re-running `enqueue-due-reminders` now could create a NEW `task_overdue` notification.** The `task_due`
  window has closed, so a re-run would no longer match the `task_due` occurrence; the `task_overdue` scan
  would match instead and enqueue a **new** row with a **different** dedupe key
  (`task_overdue:23bff3fa-130d-4e29-96ec-80bac0647060:2026-07-06`) - an extra notification, not a suppressed
  duplicate. This is exactly why 2F-7E/2F-7F say do **not** re-run the producer now.
- **Closing the task removes it from producer scans.** Every task producer requires `status = 'open'`
  (`enqueueTaskDue` and `enqueueTaskOverdue` both filter open tasks); the `care_task_status` enum is
  `('open', 'completed', 'cancelled')`. Marking the task `completed` or `cancelled` makes it inert for
  **all** producer scans.
- **Bonus: closing also neutralizes the pending outbox row.** `notification_source_validity` folds
  `task_due`/`task_overdue` into one task branch; for a non-`open` task it returns `(valid = false, reason =
  'task_closed')`, and a changed due date/time returns `(false, 'occurrence_changed')`. Both
  `fanout_due_notifications` and the per-device claim/send path re-check source-validity and **skip** an
  invalid row (setting `status = 'skipped'`). So if the outbox were ever processed after cleanup, the
  pending row would be **skipped, not sent**. (This is a safety property to verify, **not** a reason to run
  the outbox now.)

---

## 3. Recommended cleanup path

**Recommended: retire the task through the app UI (no raw SQL).**

1. **Sign in** as a circle **manager** (`admin` / `primary_caregiver`) or as the **assigned owner**
   `a6dc7376-fd9d-461f-9d14-41eabcd3f538`. The collaborator-scope trigger lets a doer transition their own
   **open** task to completed / cancelled; a manager may do the same. (Completion in-app satisfies the
   trigger because it runs with the signed-in user's JWT, setting `completed_by = auth.uid()` honestly.)
2. **Open the QA circle** `رعاية الوالد الغالي` (`ae4721d8-bd65-4fa8-bc25-e10ea73f357c`).
3. **Open the task** `مشي سريع` (`23bff3fa-130d-4e29-96ec-80bac0647060`).
4. **Use `تم الإنجاز`** (mark complete) to complete the task, if product QA allows completion. Cancelling is
   an acceptable alternative; either makes the task non-`open` and inert for every producer.
5. **Do not delete the task.** **Do not delete the notification or outbox rows.** **Do not run the outbox
   processor.** **Do not rerun `enqueue-due-reminders`.**

**Alternative (only if product QA specifically wants the task left open):**

- **Restore the old due date/time** instead of closing the task. 2F-7F recorded the user-reported
  pre-shaping due as `2026-06-19 01:10:00`, but flagged that repeated shaping may have produced intermediate
  values - confirm the true original with the person who ran the shaping before restoring.
- **This is riskier than completion.** Restoring an old due (e.g. `2026-06-19 01:10:00`) leaves the task
  `open` and dated in the past, so it can be `task_overdue`-eligible; if the engine is ever run while that
  due is inside `[now-24h, now-60m]`, it fires a `task_overdue` notification. **Completion / cancellation is
  safer** because a non-`open` task is excluded from every scan regardless of its due values. Restoring the
  due is a manager-only edit (a doer may only complete / cancel, not reschedule).

---

## 4. Manual read-only verification SQL pack for after cleanup

**Do not run in 2F-7G.** These are `SELECT`-only blocks for the Supabase Dashboard SQL Editor to run
**after** the app-UI cleanup, to confirm the expected end state. They **read** only; none modifies data,
invokes a function that writes, processes the outbox, or sends a push. Each block begins with the required
read-only header. No `UPDATE` / `DELETE` / `INSERT` SQL is provided anywhere in this report.

### Block 1 - target task status check

```sql
-- READ ONLY. QA cleanup verification only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select
  t.id,
  t.title,
  t.status,
  t.assigned_to,
  t.due_date,
  t.due_time,
  t.completed_at,
  t.cancelled_at,
  (t.status <> 'open') as is_closed,
  case
    when t.status <> 'open' then 'PASS_TASK_CLOSED'
    else 'REVIEW_TASK_STILL_OPEN'
  end as cleanup_status
from public.care_tasks t
where t.id = '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid
  and t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid;
```

**Expected after cleanup:** exactly one row; `status` is **not** `open` (`completed` or `cancelled`);
`assigned_to` unchanged (`a6dc7376-...`). **PASS** if `status <> 'open'` (`PASS_TASK_CLOSED`);
**REVIEW** if `status` is still `open` (`REVIEW_TASK_STILL_OPEN`).

### Block 2 - notification row check

```sql
-- READ ONLY. QA cleanup verification only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select
  n.id,
  n.type::text as type,
  n.user_id,
  n.data->>'entity' as data_entity,
  n.data->>'itemId' as data_item_id,
  n.deep_link,
  n.dedupe_key,
  n.created_at,
  case
    when n.type = 'task_due'
     and n.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid
     and n.data->>'entity' = 'task'
     and n.data->>'itemId' = '23bff3fa-130d-4e29-96ec-80bac0647060'
     and n.deep_link = '/tasks/23bff3fa-130d-4e29-96ec-80bac0647060'
      then 'PASS_NOTIFICATION_PRESENT_UNCHANGED'
    else 'REVIEW'
  end as notification_status
from public.notifications n
where n.id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid;
```

**Expected:** exactly one row, still present and unchanged - cleanup targets the **task**, not the
notification history, so the `task_due` row must remain (type, `user_id`, `data.entity` / `data.itemId`,
`deep_link` all as recorded in 2F-7E Q1 / 2F-7F). **PASS** if present and unchanged
(`PASS_NOTIFICATION_PRESENT_UNCHANGED`); **REVIEW** (or zero rows) means the notification was unexpectedly
altered / deleted.

> **Data-shape note (why `entity` / `itemId` here):** the `enqueue-due-reminders` producer writes **both**
> key sets into a task notification's `data` - the ownership-currency keys `entity` (`'task'`) + `itemId`
> (the task id), **and** the source-validity occurrence keys `taskId` + `dueDate` + `dueTime`
> (`enqueue-due-reminders/index.ts` task_due block). Block 2 checks `entity` / `itemId` / `deep_link`
> because those are the values empirically confirmed `MATCH_TARGET` in 2F-7E Q1; Block 4's source-validity
> layer instead reads `taskId` / `dueDate` / `dueTime`. Both are present - they are not alternatives.

### Block 3 - outbox / delivery check

```sql
-- READ ONLY. QA cleanup verification only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select
  (select count(*) from public.notification_outbox o
     where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid) as outbox_rows_total,
  (select count(*) from public.notification_outbox o
     where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid
       and o.status = 'pending') as outbox_rows_pending,
  (select count(*) from public.notification_outbox o
     where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid
       and o.status <> 'pending') as outbox_rows_not_pending,
  (select coalesce(json_agg(o.status::text order by o.status::text), '[]'::json)
     from public.notification_outbox o
     where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid) as outbox_status_values,
  (select count(*) from public.notification_push_deliveries d
     join public.notification_outbox o on o.id = d.outbox_id
     where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid) as delivery_rows_total,
  case
    when (select count(*) from public.notification_outbox o
            where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid) = 1
     and (select count(*) from public.notification_outbox o
            where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid
              and o.status <> 'pending') = 0
     and (select count(*) from public.notification_push_deliveries d
            join public.notification_outbox o on o.id = d.outbox_id
            where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid) = 0
      then 'PASS_OUTBOX_PENDING_NO_DELIVERIES'
    else 'REVIEW'
  end as outbox_status;
```

**Expected:** `outbox_rows_total = 1`, `outbox_rows_pending = 1`, `outbox_rows_not_pending = 0`,
`outbox_status_values = ["pending"]`, `delivery_rows_total = 0`. **PASS** when the outbox row remains
`pending` / unprocessed and the delivery count is zero (`PASS_OUTBOX_PENDING_NO_DELIVERIES`). Note: app-UI
cleanup does **not** touch the outbox, so the row is expected to stay exactly as recorded in 2F-7E Q2
(`outbox_rows_total = 1`, `outbox_rows_not_pending = 0`, `delivery_rows_total = 0`). Any
`outbox_rows_not_pending > 0` or `delivery_rows_total > 0` is a **hard stop** (Section 6).

### Block 4 - optional source-validity check (read-only)

**Primary (no function call): manual interpretation from source.** From
`notification_source_validity` (current body, migration `20260626164000`), the `task_due` / `task_overdue`
branch returns `(valid = false, reason = 'task_closed')` when the task's `status <> 'open'`, and
`(false, 'occurrence_changed')` when the current due date/time differs from the occurrence stored in the
notification. Both `fanout_due_notifications` and the claim/send path re-check this and **skip** an invalid
row. **Therefore, after completing / cancelling the task, the pending outbox row for
`5ba7fb2d-...` would be SKIPPED (not sent) if the outbox were ever processed.** This is derived from source
and needs no query.

**Optional (live confirmation only):** `notification_source_validity(uuid)` is `STABLE` (performs no
writes; read-only), returns `table (valid boolean, reason text)`, and is granted to `service_role` while
owned by `postgres`; the Dashboard SQL Editor runs as `postgres` (the owner) and can execute it. If the
exact grant context is uncertain, **skip this block and rely on the manual interpretation above** - do not
escalate privileges.

```sql
-- READ ONLY. QA cleanup verification only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- OPTIONAL. notification_source_validity is STABLE (read-only; performs no writes). It only inspects
-- validity; it does NOT process the outbox and sends nothing. If you get "permission denied for function",
-- the editor is running as a lesser role: STOP and report - do not escalate. Then rely on the manual
-- source interpretation instead.
select sv.valid, sv.reason
from public.notification_source_validity('5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid) sv;
```

**Expected after cleanup (task completed / cancelled, owner unchanged):** `valid = false`,
`reason = 'task_closed'` - confirming the pending outbox row would be skipped, not sent, at any future
processing. **Before cleanup (task still `open`, due unchanged):** `valid = true`, `reason = 'ok'`.
(If the recipient had changed, the earlier currency gate would instead return `not_current_recipient`; that
is not expected here since the owner is unchanged.) **This block confirms a skip property only - it does not
authorize running the outbox.**

---

## 5. Result reporting template

After the app-UI cleanup, the operator should report:

| Item | Report |
| ---- | ------ |
| App-UI cleanup performed? | yes / no |
| Which action | `تم الإنجاز` (completed) / cancelled / (restored due - alternative) |
| Signed in as | manager / assigned owner (`a6dc7376-...`) |
| Target task status verification (Block 1) | `PASS_TASK_CLOSED` / `REVIEW_TASK_STILL_OPEN` + observed `status` |
| Notification row verification (Block 2) | `PASS_NOTIFICATION_PRESENT_UNCHANGED` / `REVIEW` |
| Outbox / delivery verification (Block 3) | `PASS_OUTBOX_PENDING_NO_DELIVERIES` / `REVIEW` + the four counts |
| Optional source-validity (Block 4), if run | `valid` + `reason` (expected `false` / `task_closed`) |
| Any unexpected push / notification? | none / describe (any push is a hard stop) |

---

## 6. Stop conditions (hard stops)

Halt immediately and report if any occur:

- **Wrong project** (anything other than Sanad `qccgshanmoeybagxwvcs`).
- **Task not found** (Block 1 returns zero rows).
- **Task belongs to the wrong circle** (`circle_id` is not `ae4721d8-...`).
- **Task owner changed unexpectedly** (`assigned_to` is no longer `a6dc7376-...`).
- **Notification row missing unexpectedly** (Block 2 returns zero rows / altered row).
- **Outbox already processed** (`outbox_rows_not_pending > 0`, i.e. a row is `fanned` / `skipped` / `failed`).
- **Any delivery rows exist** (`delivery_rows_total > 0` in Block 3).
- **Any push received** on any device / lock screen.
- **Cron enabled** / any schedule found.
- **Any Edge Function invoked** (`enqueue-due-reminders`, `process-notification-outbox`, `check-missed-doses`,
  `check-push-receipts`, or any other).
- **Any secret pasted** (e.g. `NOTIFICATIONS_CRON_SECRET`) into a report, log, or chat.
- **Any real (non-QA) family data** touched, or any `remote_member` (`4f89a6ab-...`) row appears.

---

## 7. Recommended next phase

If the cleanup verification (Section 4) passes:

- **`2F-7H - QA cleanup execution record`** - record the app-UI cleanup that was performed (completed /
  cancelled), capture Block 1 / Block 2 / Block 3 (and optional Block 4) results, and re-confirm the outbox
  baseline is unchanged.

Then, later and separately:

- **`2F-8A - outbox processor smoke-test planning (no execution)`** - design (not run) the first
  `process-notification-outbox` test, gated on a known test device / token, generic push copy, and separate
  explicit approval.

**Do not recommend or perform immediate outbox processing in this phase.** No cron, no outbox, no push until
a separately approved plan exists.

---

## 8. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace / CRLF errors).

---

## 9. Final confirmation

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

## 10. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-06-phase-2f-7g-qa-cleanup-plan.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
