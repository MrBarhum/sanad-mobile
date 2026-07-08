# Phase 2F-10E - Manual cron preflight EXECUTION SUPPORT + RESULT RECORD (no cron; no execution by Claude)

**Status:** Support + record phase. Claude prepared the concise **manual** read-only preflight pack (from the
already-reviewed 2F-10D Section 6 SQL) for the **human operator** to run in the Supabase Dashboard, and provides
a result-recording template. **Claude ran no SQL, made no DB connection, ran no Supabase CLI, invoked no Edge
Function, enabled/created no cron, created no QA fixture, sent no push, and read/requested no secret value.** As
of this writing **no human-provided SQL outputs are present in the conversation**, so the live-DB preflight is
**PENDING** (Section 4 is a paste-in template). The only filesystem write in this phase is this report; the only
commands Claude runs are the two local read-only checks in Section 8 and the read-only git status/diff in
Section 10.

**Baseline commit:** `docs(product): review cron preflight SQL` (current `master` HEAD, pushed).
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Owner user (recipient / token owner):** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.

**Sources inspected read-only (no file modified):** `2F-10D` preflight SQL review (the reviewed pack),
`2F-10C` execution plan, `2F-10B` orchestration plan, `2F-10A` closeout/readiness.

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **This phase is manual preflight only.** Claude prepares the pack and records results; the human runs the
  SELECT-only SQL in the Dashboard.
- **No cron was enabled** (and none created).
- **No QA fixture was created.**
- **No Edge Function was invoked.**
- **No push was sent.**
- **No secret was read or requested** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only).
- **Human-provided SQL outputs available?** **No - not yet.** No pasted outputs are present in the conversation.
- **Live-DB preflight status: PENDING.** It has not been run (by anyone) in this conversation. Section 4 holds a
  clearly-marked template for the operator to paste results; Sections 5-6 define pass/stop criteria to apply to
  those results.

---

## 2. Operator warning (read before running anything)

The human operator must:

- **Run SQL only in the Supabase Dashboard SQL editor for project `qccgshanmoeybagxwvcs`** (Sanad) - confirm the
  project ref shown in the Dashboard before running anything. Wrong project -> **STOP**.
- **Not paste any secret** anywhere (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` must never be entered
  into SQL, the Dashboard, this report, or chat).
- **Not run `INSERT` / `UPDATE` / `DELETE`** - this pack is strictly read-only.
- **Not run `cron.schedule` / `cron.unschedule`** - no cron is created or removed in this phase.
- **Not run `net.http_post`** - no function is invoked; no push is triggered.
- **Stop immediately if any result violates the Section 6 stop criteria** (e.g. a non-QA task_due row in the
  window, stale/failed deliveries, a pre-existing Sanad cron job, an already-open `[QA CRON]` fixture, or any
  secret/raw token appearing in output).

This phase creates **no fixture** and enables **no cron** - it only reads current state to confirm a clean
baseline before any later, separately-approved execution phase.

---

## 3. Manual preflight SQL pack

Reproduced from the reviewed **2F-10D Section 6** pack (final approved form), re-marked for manual execution.
SELECT-only; no `INSERT` / `UPDATE` / `DELETE` / `cron.schedule` / `cron.unschedule` / `net.http_post`; token
always masked; no secret output; no broad private-data dump.

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (1) Pending-outbox count.
select count(*) as pending_outbox from public.notification_outbox where status = 'pending';
-- Expected: 0 (no fixture created in this phase). STOP if unexplained > 0.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (2) Outbox status summary.
select status::text as outbox_status, count(*) as rows
from public.notification_outbox group by status order by status;
-- Expected baseline: fanned=2, skipped=1, no pending. STOP if a 'pending' row is unexplained.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (3) Delivery status + receipt summary.
select status::text as delivery_status,
       coalesce(receipt_status, '(null)') as receipt_status, count(*) as rows
from public.notification_push_deliveries group by status, receipt_status order by 1, 2;
-- Expected baseline: sent/ok=1, sent/unchecked=1. STOP on unexplained new failed/skipped rows.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (4) Processing / stale deliveries.
select count(*) as processing_total,
       count(*) filter (where locked_at < now() - make_interval(secs => 600)) as stale_processing
from public.notification_push_deliveries where status = 'processing';
-- Expected: 0 / 0. STOP if stale_processing > 0 (crashed-worker rows must be understood first).
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (5) Sent deliveries pending a receipt (>=15m).
select id as delivery_id, expo_ticket_id, sent_at
from public.notification_push_deliveries
where status = 'sent' and receipt_status is null and expo_ticket_id is not null
  and sent_at < now() - interval '15 minutes'
order by sent_at asc;
-- Expected baseline: none (the old ticket was already swept to 'unchecked'). STOP on unexpected rows.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (6) Failed deliveries.
select count(*) as failed_deliveries from public.notification_push_deliveries where status = 'failed';
-- Expected: 0. STOP on a cluster (systemic send problem).
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (7) Owner active push tokens
-- + QA-circle role. NEVER selects the raw token (masked to its scheme only).
select
  pt.id as push_token_id, pt.platform, pt.device_id, pt.is_active,
  cm.role::text as circle_role, cm.status::text as membership_status,
  split_part(pt.expo_push_token, '[', 1) || '[***]' as token_scheme_masked
from public.push_tokens pt
left join public.circle_members cm
  on cm.user_id = pt.user_id and cm.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
where pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid
order by pt.is_active desc, pt.last_seen_at desc;
-- Expected: exactly one active token on one device; circle_role in (admin,primary_caregiver,family_member,caregiver),
-- membership_status='active'. STOP if zero active (no push), multiple active (multiple pushes), or remote_member/elder.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (8) task_due rows in the next
-- 20 minutes, DB-wide. Title is REDACTED for non-QA rows so no other circle's task title is exposed.
select
  t.id, t.circle_id, t.due_date, t.due_time,
  (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%') as is_qa_cron_fixture,
  case when (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')
       then t.title else '(non-QA — redacted)' end as title_or_redacted
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() and now() + interval '20 minutes'
order by is_qa_cron_fixture desc;
-- Expected in THIS phase (no fixture created): 0 rows. If any row -> review; a non-QA row -> STOP.
-- NOTE: superset gate (window only; does not re-check assignment/eligibility) — intentionally conservative.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (9) Unexpected non-QA task_due (count only).
select count(*) as non_qa_eligible_task_due
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() and now() + interval '20 minutes'
  and not (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%');
-- Expected: 0. Any > 0 -> STOP (the DB-wide producer/processor would co-process it).
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (10) Cron schema existence probe.
select to_regclass('cron.job') as cron_job_regclass;
-- If non-null, THEN list only Sanad notification jobs:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname like 'sanad-%' or command ilike '%enqueue-due-reminders%'
--    or command ilike '%process-notification-outbox%' or command ilike '%check-push-receipts%' order by jobid;
-- Expected: null OR zero Sanad jobs. Any pre-existing Sanad notification job -> STOP.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (11) Pre-existing QA fixture check.
select count(*) as existing_qa_cron_open
from public.care_tasks
where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
  and title like '[QA CRON]%' and status = 'open';
-- Expected: 0. If > 0, an old fixture exists -> retire it via app UI (later phase) so exactly one open remains then.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (12) task_overdue window
-- [now-24h, now-60m], DB-wide (exact). The DB-wide producer runs enqueueTaskOverdue in the same pass.
select count(*) as task_overdue_in_window
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() - interval '24 hours' and now() - interval '60 minutes';
-- Expected: 0. Any > 0 -> review before any later enablement.
```

```sql
-- MANUAL READ-ONLY PREFLIGHT — RUN ONLY IN SUPABASE DASHBOARD AFTER HUMAN APPROVAL. (13) APPROXIMATE
-- medication / appointment / visit scan (NOT an exact window reproduction). Authoritative arbiter for these is
-- the producer response (medication=0, appointment=0, visit=0) at execution time, not this scan.
select 'active_med_schedules' as source, count(*) as rows
  from public.medication_schedules ms
  join public.medications m on m.id = ms.medication_id
  where ms.is_active and m.is_active
union all
select 'scheduled_appts_next_25h', count(*)
  from public.care_appointments a
  where a.status = 'scheduled' and a.starts_at between now() and now() + interval '25 hours'
union all
select 'planned_visits_with_date', count(*)
  from public.family_visits v
  where v.status = 'planned' and v.visit_date is not null;
-- Informational: if any source is non-zero, treat as REVIEW and rely on the producer response as the arbiter.
```

No `INSERT` / `UPDATE` / `DELETE` / `cron.schedule` / `cron.unschedule` / `net.http_post` appears anywhere in
this pack.

---

## 4. Results recording section

**Status: PENDING - no human-provided outputs yet.** When the operator runs the Section 3 pack in the Dashboard,
paste each result here. Record: **observed** / **expected** / **pass / stop / needs review** / **notes**. (Do
**not** paste tokens or secrets - the token query already masks the token; paste only the masked value.)

| # | Query | Observed | Expected | Verdict | Notes |
| - | ----- | -------- | -------- | ------- | ----- |
| 1 | pending_outbox | `____` | `0` | ⬜ pass / ⬜ stop / ⬜ review | |
| 2 | outbox summary | `fanned=__ skipped=__ pending=__` | `fanned=2, skipped=1, pending=0` | ⬜ | difference must be understood |
| 3 | delivery/receipt summary | `sent/ok=__ sent/unchecked=__` | `sent/ok=1, sent/unchecked=1` | ⬜ | difference must be understood |
| 4 | processing / stale | `processing=__ stale=__` | `0 / 0` | ⬜ | |
| 5 | sent pending-receipt ≥15m | `____` | none (baseline) | ⬜ | |
| 6 | failed_deliveries | `____` | `0` | ⬜ | |
| 7 | owner active tokens | `active=__ device=__ role=__ token=ExponentPushToken[***]` | one active, active operational role | ⬜ | masked token only |
| 8 | task_due next 20m | `rows=__ is_qa=__` | `0` rows (no fixture this phase) | ⬜ | non-QA titles redacted |
| 9 | non_qa_eligible_task_due | `____` | `0` | ⬜ | |
| 10 | cron schema / Sanad jobs | `regclass=__ sanad_jobs=__` | null OR 0 Sanad jobs | ⬜ | |
| 11 | existing_qa_cron_open | `____` | `0` | ⬜ | |
| 12 | task_overdue_in_window | `____` | `0` | ⬜ | |
| 13 | med/appt/visit scan | `med=__ appt=__ visit=__` | `0 / 0 / 0` or reviewed | ⬜ | informational |

**Overall preflight verdict (fill after all rows):** ⬜ PASS ⬜ STOP ⬜ NEEDS REVIEW.

---

## 5. Pass criteria

The manual preflight **passes** only if **all** hold:

- `pending_outbox = 0`.
- Outbox summary matches the known baseline (`fanned=2, skipped=1, pending=0`) **or** any difference is
  understood and documented.
- Delivery summary matches the known baseline (`sent/ok=1, sent/unchecked=1`) **or** any difference is
  understood and documented.
- `processing_total = 0`.
- `stale_processing = 0`.
- No unexpected `sent` deliveries pending a receipt ≥ 15 min old.
- `failed_deliveries = 0`.
- Exactly **one** active QA-owner push token (unless multiple are explicitly intended).
- The QA owner has an **active operational role** (`admin` / `primary_caregiver` / `family_member` /
  `caregiver`) in the QA circle.
- No unexpected non-QA `task_due` rows in the 20-minute window (`non_qa_eligible_task_due = 0`).
- No pre-existing Sanad notification cron jobs.
- No open existing `[QA CRON]` fixture (`existing_qa_cron_open = 0`).
- `task_overdue` / medication / appointment / visit mirror results are **zero**, or explicitly reviewed and
  accepted.
- No secrets or raw tokens appear in any output.

---

## 6. Stop criteria

**Stop** (do not proceed to any fixture/cron phase) if any occur:

- Wrong Supabase project (anything other than `qccgshanmoeybagxwvcs`).
- Any query fails due to a schema mismatch (unexpected - 2F-10D verified the names against the migrations).
- `pending_outbox` is non-zero and unexplained.
- Stale `processing` deliveries exist (`stale_processing > 0`).
- Failed deliveries exist and are unexplained.
- No active QA-owner token (fan-out would skip `no_active_token`; nothing to observe later).
- Unexpected active tokens/devices that would cause multiple pushes.
- Owner role is `remote_member` / `elder` / inactive / missing in the QA circle.
- Non-QA `task_due` rows are in the window (`non_qa_eligible_task_due > 0`).
- A pre-existing Sanad cron job exists unexpectedly.
- An open `[QA CRON]` fixture already exists.
- `task_overdue` / medication / appointment / visit mirror shows possible producer activity that is not
  understood.
- Any secret or raw Expo token appears in output.

Any stop -> capture the offending result, halt, and stay in preflight review until resolved.

---

## 7. Recommendation

- **Because the manual preflight has NOT been run yet (no pasted outputs):** recommend the **human operator run
  the reviewed SELECT-only pack (Section 3) manually in the Dashboard for `qccgshanmoeybagxwvcs`, then paste the
  outputs** so this report's Section 4 can be completed and a PASS / STOP / NEEDS-REVIEW verdict recorded.
- **If (once run) the manual preflight PASSES:** recommend
  **`2F-10F - cron smoke-test execution plan final approval (no execution)`** - a final review/sign-off gate
  before any fixture creation or cron enablement.
- **If it FAILS or needs review:** stay in preflight review and resolve every flagged issue before any fixture
  or cron step.

**Do not enable cron directly from this phase.** No fixture is created and no cron is enabled here; enablement
remains a later, explicitly-approved step.

---

## 8. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results are recorded in Section 10's hand-off. No other command is run in this phase.

---

## 9. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run by Claude** (the Section 3 pack is authored for the human operator to run manually in the
  Dashboard; Claude executed nothing).
- **No DB connection by Claude.**
- **No deploy.**
- **No Edge invocation** (`enqueue-due-reminders`, `process-notification-outbox`, `check-push-receipts`,
  `check-missed-doses` were not run).
- **No cron enabled / created.**
- **No QA fixture created.**
- **No notification delivery / push.**
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only; no
  value read or requested; all UUIDs are user / circle / task / notification / outbox / delivery / token /
  ticket identifiers, not secrets).
- **No raw Expo token exposed** (the token query masks to the scheme prefix only).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 10. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10e-manual-cron-preflight-results.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
