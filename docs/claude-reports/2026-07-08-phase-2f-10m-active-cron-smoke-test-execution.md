# Phase 2F-10M — Active cron smoke-test EXECUTION RECORD (explicitly-approved, human-in-the-loop)

- **Date:** 2026-07-09 (report filename carries the 2F-10 series date `2026-07-08`)
- **Phase:** 2F-10M — active cron smoke-test execution, explicitly approved (first end-to-end run over the LIVE cron jobs)
- **Status:** ✅ **COMPLETE — PASS. Active cron end-to-end smoke test succeeded; fixture retired; 3 Sanad jobs remain active. No commit / no stage.**
- **Fixture task id (2F-10M):** `78787ad2-fac4-4c19-91f1-385b3a4c6e85` (`[QA CRON] اختبار جدولة الإشعارات`, due 2026-07-09 17:28:00 Riyadh, assigned to owner)
- **Baseline commit (after 2F-10L):** `adfe2de docs(product): create secure cron substrate`
- **Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`
- **QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (رعاية الوالد الغالي)
- **Owner / recipient user:** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`
- **Owner active push token id (from 2F-10F/10L):** `93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8` (masked scheme only; raw never exposed)

---

## Execution model (how this phase runs)

- **Claude** guides the sequence, authors reviewed **SELECT-only** SQL, assesses pasted outputs, and writes this report.
- **The human operator** runs all SQL manually in the Supabase Dashboard SQL editor, creates/completes the QA
  fixture in the app UI, and confirms the push on the Android device.
- **Claude does NOT:** run Supabase CLI, run/connect SQL, invoke Edge Functions, manually call `net.http_post`,
  manually run the receipt checker, enable/disable/create cron, send push, deploy, read/paste secrets, print
  `cron.job.command`, or modify app/Edge/migrations/generated types.
- **Cron drives the chain.** The 3 live Sanad jobs (already active from 2F-10L) run the producer → processor →
  receipt checker on their own schedules. This phase adds a fixture and observes; it does not push anything along.
- **Strict gates.** Claude stops and does not continue until the operator pastes results and explicitly approves.

### Standing constraints honored (from the 2F-10M brief)

Fresh `[QA CRON] اختبار جدولة الإشعارات` fixture only · no manual Edge invocation · no manual `net.http_post` ·
no manual receipt-checker invocation · let cron drive the chain · no Supabase CLI · no deploy · no
source/migration/generated-type changes · no secret values · never print `cron.job.command` · do not commit or stage.

---

## Gate map (stop only at real gates)

1. **GATE 1 — before fixture creation, after preflight.** ← *current stop point*
2. **GATE 2 — after fixture creation, to wait for cron observation.**
3. **GATE 3 — before cleanup, only if something unexpected happens.**
4. **GATE 4 — final validation.**

## Checkpoint progress log

| CP | Action | Requires operator | Status |
|----|--------|-------------------|--------|
| A | Local baseline (mojibake, diff-check, status, log) | no (Claude local) | ✅ PASS |
| B | Combined read-only preflight (SELECT-only) | **approval + run + paste** | ✅ PASS (operator-confirmed; GATE 1 approved) |
| C | QA fixture creation (app UI) + verify | **approval + create + paste** | ✅ PASS (fixture `78787ad2-…`) |
| D | Timed observation (producer→processor→push→receipt) | **run + paste over time** | ✅ PASS (receipt=ok; one generic push) |
| E | Fixture cleanup (app UI) + verify | **approval + complete + paste** | ✅ PASS (completed; 3 jobs still active) |
| F | Final report + local validation | no (Claude local) | ✅ done — verdict PASS |

---

## Checkpoint A — Local baseline ✅ PASS

Commands run locally by Claude (read-only, no DB, no CLI):

```
$ npm run check:mojibake
> sanad-mobile@1.0.0 check:mojibake
> node ./scripts/check-mojibake.js
check:mojibake - scanned 266 active source/config file(s).
No strong mojibake signatures found in active source/config.
(exit 0)

$ git -c core.autocrlf=false diff --check
(no output; exit 0)

$ git --no-pager status -sb
## master...origin/master

$ git --no-pager log --oneline -5
adfe2de docs(product): create secure cron substrate
aca0815 docs(product): decide secure cron setup path
5286182 docs(product): plan cron substrate availability
7337d33 docs(product): record blocked cron smoke test execution
7bcef43 docs(product): finalize cron smoke test approval plan
```

**Assessment:** working tree **clean** and in sync with `origin/master`; HEAD is exactly the expected 2F-10L
baseline `adfe2de docs(product): create secure cron substrate`. No mojibake, no whitespace/conflict errors.
**PASS → continue.**

---

## Checkpoint B — Combined read-only preflight (SELECT-only) ⏳ ISSUED — AWAITING OPERATOR (GATE 1)

One combined **SELECT-only** grid plus two small metadata SELECTs. Table/column names and the med/visit window
logic are reused **verbatim** from the 2F-10L packs that executed cleanly against this DB. The only 10M
adaptations: the cron gate now expects **exactly 3 active Sanad jobs** (2F-10L expected 0), and a run-observability
check confirms the live jobs are **firing successfully** before we trust cron to drive the chain.

**Rules honored:** SELECT-only; no `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`cron.schedule`/`cron.unschedule`/
`net.http_post`; **`cron.job.command` is never selected**; the Vault secret is checked **by name only** (its value
is never selected); the Expo token is masked to its scheme.

### B.1 — Combined preflight grid (paste the whole grid back)

```sql
-- 2F-10M CHECKPOINT B.1 — LAST-MINUTE READ-ONLY PREFLIGHT (SELECT-ONLY)
-- RUN IN THE SUPABASE DASHBOARD SQL EDITOR FOR PROJECT qccgshanmoeybagxwvcs, ONLY AFTER EXPLICIT APPROVAL.
-- No INSERT/UPDATE/DELETE/CREATE/ALTER/cron.schedule/cron.unschedule/net.http_post.
-- Never selects cron.job.command. No secret VALUE selected (Vault secret checked BY NAME only).
-- Expo token masked to scheme only. Returns ONE labelled grid (order by ord). Paste the whole grid back.
with
sched as (
  select ms.id as schedule_id, ms.circle_id, ms.days_of_week, ms.times,
         ms.start_date, ms.end_date, cc.timezone as tz
  from public.medication_schedules ms
  join public.medications m on m.id = ms.medication_id
  join public.care_circles cc on cc.id = ms.circle_id
  where ms.is_active and m.is_active
),
days as (
  select s.*, d.ymd as dose_date
  from sched s
  cross join lateral (values
    ((now() at time zone s.tz)::date),
    (((now() + interval '1 day') at time zone s.tz)::date)
  ) as d(ymd)
),
med_occ as (
  select d.schedule_id, d.circle_id, d.dose_date, t.tm as scheduled_time,
         ((d.dose_date + t.tm) at time zone d.tz) as dose_at
  from days d
  cross join lateral unnest(d.times) as t(tm)
  where extract(dow from d.dose_date)::int = any (d.days_of_week)
    and d.dose_date >= d.start_date
    and (d.end_date is null or d.dose_date <= d.end_date)
),
med_win as (
  select o.* from med_occ o
  where o.dose_at between now() and now() + interval '20 minutes'
    and not exists (
      select 1 from public.medication_logs ml
      where ml.schedule_id = o.schedule_id
        and ml.dose_date = o.dose_date
        and ml.scheduled_time = o.scheduled_time
    )
),
vis_win as (
  select v.id as visit_id
  from public.family_visits v
  join public.care_circles cc on cc.id = v.circle_id
  where v.status = 'planned' and v.visit_date is not null
    and ((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone cc.timezone)
          between now() + interval '60 minutes' and now() + interval '80 minutes'
)
select 1 as ord, 'pg_cron_installed' as check_name,
       (select coalesce(string_agg('v' || extversion, '; '), '(not installed)') from pg_extension where extname = 'pg_cron') as observed,
       'installed (v1.6.4)' as expected, 'substrate must be intact' as note
union all
select 2, 'pg_net_installed',
       (select coalesce(string_agg('v' || extversion, '; '), '(not installed)') from pg_extension where extname = 'pg_net'),
       'installed (v0.20.3)', 'substrate must be intact'
union all
select 3, 'fn_net_http_post_visible',
       (select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'net' and p.proname = 'http_post') then 'yes' else 'no' end),
       'yes', 'jobs call net.http_post'
union all
select 4, 'sanad_active_job_count',
       (select (count(*) filter (where active))::text || ' active / ' || count(*)::text || ' total'
          from cron.job where jobname like 'sanad-%'),
       '3 active / 3 total', 'STOP if != 3 active'
union all
select 5, 'sanad_jobs_summary',
       (select coalesce(string_agg(jobname || ' ' || schedule || ' active=' || active::text, ' | ' order by jobname), '(none)')
          from cron.job where jobname like 'sanad-%'),
       'sanad-check-push-receipts */15 * * * * active=true | sanad-enqueue-due-reminders */5 * * * * active=true | sanad-process-notification-outbox */5 * * * * active=true',
       'STOP if any schedule differs or any job inactive (command never selected)'
union all
select 6, 'secret_count_by_name',
       (select count(*)::text from vault.secrets where name = 'NOTIFICATIONS_CRON_SECRET'),
       '1', 'by name only; value never selected; STOP if != 1'
union all
select 7, 'pending_outbox',
       (select count(*)::text from public.notification_outbox where status = 'pending'),
       '0', 'STOP if unexplained > 0'
union all
select 8, 'processing_total',
       (select count(*)::text from public.notification_push_deliveries where status = 'processing'),
       '0', 'STOP if > 0'
union all
select 9, 'stale_processing',
       (select count(*)::text from public.notification_push_deliveries
         where status = 'processing' and locked_at < now() - make_interval(secs => 600)),
       '0', 'STOP if > 0'
union all
select 10, 'failed_deliveries',
       (select count(*)::text from public.notification_push_deliveries where status = 'failed'),
       '0', 'STOP if cluster / any new failure'
union all
select 11, 'outbox_summary_info',
       (select coalesce(string_agg(status::text || '=' || c::text, ', ' order by status), '(none)')
          from (select status, count(*) c from public.notification_outbox group by status) s),
       'baseline fanned=2, skipped=1 (informational)', 'STOP only on NEW pending (row 7 governs)'
union all
select 12, 'delivery_receipt_summary_info',
       (select coalesce(string_agg(status::text || '/' || coalesce(receipt_status, '(null)') || '=' || c::text, ', '
                 order by status, coalesce(receipt_status, '(null)')), '(none)')
          from (select status, receipt_status, count(*) c
                  from public.notification_push_deliveries group by status, receipt_status) s),
       'baseline sent/ok=1, sent/unchecked=1 (informational; old unchecked ticket may have changed benignly)',
       'STOP only on a NEW failed/skipped delivery'
union all
select 13, 'owner_active_tokens',
       (select (count(*) filter (where is_active))::text || ' active / ' || count(*)::text || ' total'
          from public.push_tokens where user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid),
       '1 active / 1 total', 'STOP if 0 or >1 (unless explicitly accepted)'
union all
select 14, 'owner_token_detail_masked',
       (select coalesce(string_agg(
                 'platform=' || coalesce(pt.platform, '?') ||
                 ' active=' || pt.is_active::text ||
                 ' role=' || coalesce(cm.role::text, '(none)') ||
                 ' membership=' || coalesce(cm.status::text, '(none)') ||
                 ' token=' || split_part(pt.expo_push_token, '[', 1) || '[***]',
                 ' | ' order by pt.is_active desc), '(no tokens)')
          from public.push_tokens pt
          left join public.circle_members cm
            on cm.user_id = pt.user_id and cm.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
         where pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid),
       'android / family_member / active / ExponentPushToken[***]',
       'STOP if remote_member/elder/inactive/missing'
union all
select 15, 'existing_qa_cron_open',
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and title like '[QA CRON]%' and status = 'open'),
       '0', 'STOP if > 0 (retire before creating new fixture)'
union all
select 16, 'task_due_next_20m',
       (select coalesce(string_agg(
                 case when (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')
                      then 'QA:' || t.title else 'non-QA(redacted)' end, ' | '), '(none)')
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'),
       '(none) before fixture', 'STOP if any non-QA row'
union all
select 17, 'non_qa_eligible_task_due',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'
           and not (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')),
       '0', 'STOP if > 0'
union all
select 18, 'task_overdue_in_window',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() - interval '24 hours' and now() - interval '60 minutes'),
       '0', 'STOP if > 0 (review)'
union all
select 19, 'B_med_plausible_next_20m', (select count(*)::text from med_win), '0', 'STOP/REVIEW if > 0 (medication_due would co-fire)'
union all
select 20, 'E_visits_plausible_window_60_80m', (select count(*)::text from vis_win), '0', 'STOP/REVIEW if > 0 (visit_upcoming would co-fire)'
union all
select 21, 'F_appointments_firing_next_window',
       (select count(*)::text from public.care_appointments a
         where a.status = 'scheduled'
           and ( a.starts_at between now() + interval '1440 minutes' and now() + interval '1460 minutes'
              or a.starts_at between now() + interval '60 minutes'   and now() + interval '80 minutes' )),
       '0', 'REVIEW if > 0'
order by ord;
```

### B.2 — Live Sanad jobs metadata (exactly 3; command never selected)

```sql
-- 2F-10M CHECKPOINT B.2 — SANAD JOBS METADATA (SELECT-only; jobid/jobname/schedule/active only; NO command).
select jobid, jobname, schedule, active
from cron.job
where jobname like 'sanad-%'
order by jobname;
```

Expected — exactly 3 rows:

| jobname | schedule | active |
|---|---|---|
| sanad-check-push-receipts | `*/15 * * * *` | true |
| sanad-enqueue-due-reminders | `*/5 * * * *` | true |
| sanad-process-notification-outbox | `*/5 * * * *` | true |

### B.3 — Live-job run health (confirm the jobs are firing cleanly BEFORE we rely on them)

```sql
-- 2F-10M CHECKPOINT B.3 — RECENT SANAD JOB RUNS (SELECT-only; jobname/status/start_time only; NO command, NO return_message).
select j.jobname, d.status, d.start_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname like 'sanad-%'
order by d.start_time desc
limit 15;
```

Expected: recent runs for `sanad-enqueue-due-reminders` and `sanad-process-notification-outbox` within the last
~10 min and for `sanad-check-push-receipts` within the last ~15 min, all `status = succeeded`. **STOP** if the jobs
show `failed` (the chain would never complete — investigate before creating a fixture). If `return_message` is
needed later for a failure, we will fetch it with a guarded query that cannot echo the command/secret.

### B — Expected values (PASS requires all)

| ord/id | check | expected | STOP if |
|---|---|---|---|
| 1 | pg_cron_installed | `v1.6.4` | not installed |
| 2 | pg_net_installed | `v0.20.3` | not installed |
| 3 | fn_net_http_post_visible | `yes` | `no` |
| 4 | sanad_active_job_count | `3 active / 3 total` | `!= 3 active` |
| 5 | sanad_jobs_summary | the 3 names with `*/15`, `*/5`, `*/5`, all `active=true` | any schedule differs / any inactive |
| 6 | secret_count_by_name | `1` | `!= 1` |
| 7 | pending_outbox | `0` | unexplained > 0 |
| 8 | processing_total | `0` | > 0 |
| 9 | stale_processing | `0` | > 0 |
| 10 | failed_deliveries | `0` | any new failure |
| 11 | outbox_summary_info | `fanned=2, skipped=1` (info) | new `pending` |
| 12 | delivery_receipt_summary_info | `sent/ok=1, sent/unchecked=1` (info; unchecked may drift) | new `failed`/`skipped` |
| 13 | owner_active_tokens | `1 active / 1 total` | 0 or >1 |
| 14 | owner_token_detail_masked | android, `family_member`, active, `ExponentPushToken[***]` | remote_member/elder/inactive |
| 15 | existing_qa_cron_open | `0` | > 0 |
| 16 | task_due_next_20m | `(none)` | any non-QA row |
| 17 | non_qa_eligible_task_due | `0` | > 0 |
| 18 | task_overdue_in_window | `0` | > 0 |
| 19 | B_med_plausible_next_20m | `0` | > 0 |
| 20 | E_visits_plausible_window_60_80m | `0` | > 0 |
| 21 | F_appointments_firing_next_window | `0` | > 0 |
| B.2 | jobs metadata | exactly 3 rows, schedules `*/15`,`*/5`,`*/5`, all active | any mismatch |
| B.3 | job run health | recent `succeeded` runs for all 3 | any `failed` |

### B — Results

**Operator verdict: PASS (GATE 1 approved).** The operator ran B.1 + B.2 + B.3 in the Dashboard for
`qccgshanmoeybagxwvcs` and confirmed all gates met expectations:

- **B.2 / rows 4–5:** exactly **3 active** Sanad jobs, schedules correct (`sanad-check-push-receipts */15`,
  `sanad-enqueue-due-reminders */5`, `sanad-process-notification-outbox */5`), all `active=true`.
- **B.3:** all recent Sanad job runs `succeeded` (jobs are firing cleanly — safe to let cron drive the chain).
- **Engine baseline clean:** `pending_outbox=0`; `processing=0` / `stale=0` / `failed=0`.
- **Nothing else eligible:** no open `[QA CRON]`; no non-QA `task_due` in next 20 min; **`B=0`, `E=0`, `F=0`**.

Operator explicitly **approved Checkpoint C** (fixture creation only), with fixture timing **~11 min ahead** of Riyadh
local time, and **no** manual Edge invocation / no `net.http_post` / no cleanup yet.

> Recording note: the operator confirmed PASS by summary rather than pasting the verbatim cell-by-cell grid. Because
> the `now()`-sensitive gates (task_due window, B/E/F) are re-validated in C.2 immediately after fixture creation, the
> go/no-go for letting cron fire rests on that fresh C.2 snapshot.

---

## Pattern provenance & schema notes (cross-validated)

A read-only extraction pass over the prior 2F-7/8/9/10 reports cross-validated every packet below. Confirmed facts:

- **Fixture path (safest):** app-UI creation, **NO SQL mutation**. A raw `INSERT`/`UPDATE` into `public.care_tasks`
  is blocked by the `care_tasks_collaborator_scope` trigger when `auth.uid()` is null in the SQL editor. All prior
  QA fixtures (`[QA PUSH]`, `[QA RECEIPT]`, `[QA CRON]`) were app-UI created from a **manager** account and assigned
  to the owner. The fixture id is captured by a read-only discovery SELECT (`order by created_at desc`), never `RETURNING`.
- **Cleanup path (established):** RETIRE BY **COMPLETION** (app-UI "تم الإنجاز" → `status='completed'`), **never** a raw
  `UPDATE`/`DELETE`, and **never** delete the notification/outbox/delivery rows (that chain is the evidence).
- **Chain schema (authoritative):** `public.notifications` (id, type, user_id, circle_id, **title/body** [in-app inbox
  only], `data` jsonb {entity,itemId,taskId,dueDate,dueTime}, deep_link, dedupe_key) → `public.notification_outbox`
  (id, notification_id, **status: pending/fanned/skipped/failed**; terminal-success = **`fanned`**) →
  `public.notification_push_deliveries` (id, **outbox_id**, **status: pending/processing/sent/failed/skipped**,
  push_token_id, locked_at, sent_at, **expo_ticket_id**, **receipt_status** [null/ok/error/unchecked], last_error).
  Links: `outbox.notification_id = notifications.id`, `deliveries.outbox_id = outbox.id`,
  `notifications.data->>'itemId' = <fixture task id>`, `dedupe_key = task:<task_id>:<due_date>:<due_time>`.
- **No private content in the push:** the delivery row has **no title/body columns** — the OS push is generic
  (`genericPushMessage` → title `سند`, body `لديك تذكير جديد`). The task title exists only in `notifications.body`.
- **"stale"** is not an enum value; it means a `processing` delivery whose `locked_at` is older than
  `deliveryLockTimeoutSeconds=600`. Windowing: `taskLookaheadMinutes=20`, `receiptMinAgeMinutes=15`,
  `receiptRetentionHours=24`. Producer+processor both `*/5` (no offset) → up to ~5 min enqueue→send latency.

---

## Checkpoint C — QA fixture creation ✅ PASS (fixture created & verified)

_GATE 1 passed and the operator approved fixture creation (~11 min ahead). One fresh fixture only._

### C.1 — Create via app UI (NO SQL — the safe established path)

From a **manager** account of the QA circle (RLS: `care_tasks` INSERT is `admin`/`primary_caregiver` only; the owner
is `family_member` and cannot self-create), create one task and assign it to the owner:

| Field | Value |
|-------|-------|
| Title (exact) | `[QA CRON] اختبار جدولة الإشعارات` |
| Circle | `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (رعاية الوالد الغالي) |
| Assigned to | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` (owner / push-recipient device) |
| Status | open (default) |
| Due date | **today**, circle-local (Asia/Riyadh, UTC+3) |
| Due time | **set explicitly ~11 min ahead** of current Riyadh local time |
| Description / notes | leave empty (no sensitive content) |

Then run C.2 to capture the fixture id and confirm it is in-window and correctly targeted.

### C.2 — Fixture verification (SELECT-only; run right after creating it)

```sql
-- 2F-10M CHECKPOINT C.2 — QA FIXTURE VERIFICATION (SELECT-ONLY). Returns ONE grid (order by ord).
with
sched as (
  select ms.id as schedule_id, ms.circle_id, ms.days_of_week, ms.times,
         ms.start_date, ms.end_date, cc.timezone as tz
  from public.medication_schedules ms
  join public.medications m on m.id = ms.medication_id
  join public.care_circles cc on cc.id = ms.circle_id
  where ms.is_active and m.is_active
),
days as (
  select s.*, d.ymd as dose_date
  from sched s
  cross join lateral (values ((now() at time zone s.tz)::date), (((now() + interval '1 day') at time zone s.tz)::date)) as d(ymd)
),
med_occ as (
  select d.schedule_id, d.circle_id, d.dose_date, t.tm as scheduled_time, ((d.dose_date + t.tm) at time zone d.tz) as dose_at
  from days d cross join lateral unnest(d.times) as t(tm)
  where extract(dow from d.dose_date)::int = any (d.days_of_week)
    and d.dose_date >= d.start_date and (d.end_date is null or d.dose_date <= d.end_date)
),
med_win as (
  select o.* from med_occ o
  where o.dose_at between now() and now() + interval '20 minutes'
    and not exists (select 1 from public.medication_logs ml
      where ml.schedule_id = o.schedule_id and ml.dose_date = o.dose_date and ml.scheduled_time = o.scheduled_time)
),
vis_win as (
  select v.id as visit_id from public.family_visits v join public.care_circles cc on cc.id = v.circle_id
  where v.status = 'planned' and v.visit_date is not null
    and ((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone cc.timezone)
          between now() + interval '60 minutes' and now() + interval '80 minutes'
)
select 1 as ord, 'qa_cron_open_count' as check_name,
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and title like '[QA CRON]%' and status = 'open') as observed,
       '1' as expected, 'STOP if != 1' as note
union all
select 2, 'qa_cron_fixture_detail',
       (select coalesce(string_agg(
                 'id=' || t.id::text
                 || ' assigned_to_owner=' || (t.assigned_to = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid)::text
                 || ' status=' || t.status::text
                 || ' due=' || t.due_date::text || coalesce(' ' || t.due_time::text, ' (NO TIME!)')
                 || ' mins_to_due=' || round(extract(epoch from (((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) - now())) / 60.0)::text
                 || ' in_20m_window=' || ((((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)) between now() and now() + interval '20 minutes')::text,
                 ' | ' order by t.created_at desc), '(no open QA fixture)')
          from public.care_tasks t join public.care_circles cc on cc.id = t.circle_id
         where t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%' and t.status = 'open'),
       'assigned_to_owner=true, in_20m_window=true, mins_to_due~9-12', 'RECORD the id; STOP if not owner or not in window'
union all
select 3, 'task_due_next_20m_total',
       (select count(*)::text from public.care_tasks t join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) between now() and now() + interval '20 minutes'),
       '1', 'STOP if != 1 (exactly the QA fixture)'
union all
select 4, 'non_qa_eligible_task_due',
       (select count(*)::text from public.care_tasks t join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) between now() and now() + interval '20 minutes'
           and not (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')),
       '0', 'STOP if > 0'
union all
select 5, 'B_med_plausible_next_20m', (select count(*)::text from med_win), '0', 'STOP/REVIEW if > 0'
union all
select 6, 'E_visits_plausible_window_60_80m', (select count(*)::text from vis_win), '0', 'STOP/REVIEW if > 0'
union all
select 7, 'F_appointments_firing_next_window',
       (select count(*)::text from public.care_appointments a
         where a.status = 'scheduled'
           and ( a.starts_at between now() + interval '1440 minutes' and now() + interval '1460 minutes'
              or a.starts_at between now() + interval '60 minutes'   and now() + interval '80 minutes' )),
       '0', 'REVIEW if > 0'
order by ord;
```

**PASS (all must hold):** `qa_cron_open_count=1` · `assigned_to_owner=true` · `in_20m_window=true` · `mins_to_due~9-12`
· `task_due_next_20m_total=1` · `non_qa_eligible_task_due=0` · `B=0` · `E=0` · `F=0`. **Record the fixture `id`** (the
`<FIXTURE_TASK_ID>` used in Checkpoints D and E). If it drifts out of window, nudge the due time forward in the app UI.

### C — Results

**Operator verdict: PASS.** Fixture created via app UI and verified (C.2 grid, verbatim):

| ord | check | observed | expected | verdict |
|-----|-------|----------|----------|---------|
| 1 | qa_cron_open_count | `1` | `1` | ✅ |
| 2 | qa_cron_fixture_detail | `id=78787ad2-fac4-4c19-91f1-385b3a4c6e85 assigned_to_owner=true status=open due=2026-07-09 17:28:00 mins_to_due=9 in_20m_window=true` | owner=true, in-window, ~9–12 | ✅ |
| 3 | task_due_next_20m_total | `1` | `1` | ✅ |
| 4 | non_qa_eligible_task_due | `0` | `0` | ✅ |
| 5 | B_med_plausible_next_20m | `0` | `0` | ✅ |
| 6 | E_visits_plausible_window_60_80m | `0` | `0` | ✅ |
| 7 | F_appointments_firing_next_window | `0` | `0` | ✅ |

- **Fixture task id:** `78787ad2-fac4-4c19-91f1-385b3a4c6e85`
- **Title:** `[QA CRON] اختبار جدولة الإشعارات` · **due** `2026-07-09 17:28:00` Riyadh · assigned to owner `a6dc7376-…`.
- **Exactly one** eligible `task_due` DB-wide (the QA fixture); no non-QA rows; **B/E/F=0**. Single-producer target confirmed.

---

## Checkpoint D — Timed observation ✅ PASS (full chain: producer→processor→push→receipt=ok)

_Fixture id `78787ad2-fac4-4c19-91f1-385b3a4c6e85` is wired in below. Re-run this ONE grid on a cadence:_
_every ~3 min for the first ~15 min (watch stages 2→3→4 appear), then every ~10–15 min until receipt (stage 6) flips_
_to `ok`. Cron drives everything — no manual Edge call, no manual `net.http_post`, no manual receipt run._

**Expected timeline (cron-driven):** producer notification + `pending` outbox within ~5 min → processor `fanned`
outbox + `sent` delivery with `expo_ticket_id` within another ~5 min → generic Android push on the device → after the
ticket is ≥15 min old, the `*/15` receipt checker sets `receipt_status='ok'` (≈17–18 min after send in 2F-9B).

```sql
-- 2F-10M CHECKPOINT D — CHAIN OBSERVATION (SELECT-ONLY). Fixture 78787ad2-fac4-4c19-91f1-385b3a4c6e85. ONE grid (order by ord).
with params as (
  select '78787ad2-fac4-4c19-91f1-385b3a4c6e85'::uuid as task_id,
         'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid as owner_id,
         'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
),
notif as (
  select n.* from public.notifications n, params p
  where n.type = 'task_due' and n.user_id = p.owner_id and n.data->>'itemId' = p.task_id::text
),
ob as (
  select o.* from public.notification_outbox o where o.notification_id in (select id from notif)
),
del as (
  select d.* from public.notification_push_deliveries d where d.outbox_id in (select id from ob)
)
select 1 as ord, 'fixture_open' as stage,
       (select coalesce(string_agg('status=' || t.status::text
                 || ' in_window=' || ((((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                       between now() and now() + interval '20 minutes')::text), ' | '), '(not found)')
          from public.care_tasks t join public.care_circles cc on cc.id = t.circle_id, params p where t.id = p.task_id) as observed,
       'status=open until cleanup' as note
union all
select 2, 'producer_notification',
       (select coalesce(string_agg('id=' || n.id::text || ' type=' || n.type::text
                 || ' dedupe=' || coalesce(n.dedupe_key, '-') || ' created=' || n.created_at::text, ' | '), '(none yet)') from notif n),
       'exactly 1 task_due notification for the fixture (~<=5 min after due enters window)'
union all
select 3, 'producer_outbox',
       (select coalesce(string_agg('id=' || o.id::text || ' status=' || o.status::text
                 || ' attempts=' || o.attempt_count::text || ' err=' || coalesce(o.last_error, '-'), ' | '), '(none yet)') from ob o),
       'pending -> fanned (fanned = terminal success; outbox never shows sent)'
union all
select 4, 'processor_delivery',
       (select coalesce(string_agg('id=' || d.id::text || ' status=' || d.status::text
                 || ' ticket=' || coalesce(d.expo_ticket_id, '-') || ' sent_at=' || coalesce(d.sent_at::text, '-')
                 || ' receipt=' || coalesce(d.receipt_status, '(null)'), ' | '), '(none yet)') from del d),
       'exactly 1 delivery -> sent with expo_ticket_id; receipt null pre-check'
union all
select 5, 'push_has_no_private_content',
       'delivery row exposes only ticket/status/receipt — NO title/body column exists; OS push is generic (سند / لديك تذكير جديد)',
       'structural proof the push record carries no private care detail'
union all
select 6, 'receipt_ok',
       (select coalesce(string_agg('status=' || d.status::text || ' receipt=' || coalesce(d.receipt_status, '(null)')
                 || ' ticket=' || coalesce(d.expo_ticket_id, '-')
                 || ' sent_age_min=' || coalesce(round(extract(epoch from (now() - d.sent_at)) / 60.0)::text, '-'), ' | '), '(none yet)') from del d),
       'once ticket >=15m old, receipt checker (*/15) sets receipt_status=ok'
union all
select 7, 'unexpected_notifications_2h',
       (select count(*)::text from public.notifications n, params p
         where n.created_at > now() - interval '2 hours'
           and not (n.type = 'task_due' and n.user_id = p.owner_id and n.data->>'itemId' = p.task_id::text)),
       '0 (only the QA fixture notification; STOP if > 0)'
union all
select 8, 'pending_outbox_global',
       (select count(*)::text from public.notification_outbox where status = 'pending'),
       '0 after processing (a transient 1 between producer and processor cycles is fine)'
union all
select 9, 'processing_stale_failed_global',
       (select 'processing=' || (count(*) filter (where status = 'processing'))::text
             || ' stale=' || (count(*) filter (where status = 'processing' and locked_at < now() - make_interval(secs => 600)))::text
             || ' failed=' || (count(*) filter (where status = 'failed'))::text
          from public.notification_push_deliveries),
       'processing=0 / stale=0 / failed=0 (a brief processing during a send cycle is ok)'
order by ord;
```

**PASS at completion:** the invariant is **exactly one push delivered** (any stale occurrence correctly skipped as
`occurrence_changed`) · stage 3 current-occurrence outbox = `fanned` · stage 4 delivery = `sent` with a non-null
`expo_ticket_id` · device shows the generic push (`سند` / `لديك تذكير جديد`) · stage 6 `receipt_status=ok` · stage 7
`unexpected=0` · stage 8 `pending_outbox=0` · stage 9 all zero.

### D — Observation log

**Round 1 — ~17:23 Riyadh (14:23Z), sent_age_min=3.** Producer→processor→push **PASS**; awaiting receipt.

- **Device push (operator-confirmed):** title `سند`, body `لديك تذكير جديد`, **no private task title/detail**. Generic copy ✅.
- **stage 1 fixture_open:** `status=open in_window=true` ✅
- **stage 2 producer_notification — TWO occurrences (see deviation):**
  - occ A (stale): dedupe due `2026-07-09:17:21:00`, created `14:15:01Z`
  - occ B (current): dedupe due `2026-07-09:17:28:00`, created `14:20:01Z`
- **stage 3 producer_outbox:** one `fanned` (current occ B) · one `skipped` `err=occurrence_changed` (stale occ A) ✅
- **stage 4 processor_delivery:** one delivery, `status=sent`, `expo_ticket_id=019f473f-f564-717b-be64-8240d2ac076a`,
  `sent_at=2026-07-09 14:20:01.884355+00`, `receipt=(null)` ✅
- **stage 5 push_has_no_private_content:** structural (delivery row has no title/body) ✅
- **stage 6 receipt_ok:** `sent_age_min=3` — ticket too young (<15m); receipt pending (expected)
- **stage 7 unexpected_notifications_2h:** `0` ✅ · **stage 8 pending_outbox_global:** `0` ✅ ·
  **stage 9 processing_stale_failed_global:** `processing=0 stale=0 failed=0` ✅

**Deviation (benign, correctly handled): two `task_due` notifications instead of one.** The fixture's due_time was
adjusted `17:21 → 17:28` *after* the 14:15Z producer run had already enqueued the 17:21 occurrence. Each distinct
`(due_date, due_time)` yields a distinct `dedupe_key`, so the two occurrences did not collapse. When the processor
revalidated the stale 17:21 occurrence it correctly returned `occurrence_changed` and **skipped** it — so **exactly one
push** (the current 17:28 occurrence) was delivered. This is **not** a duplicate (distinct occurrences; one skipped) and
**not** a GATE 3 trigger; it is a live demonstration that the `occurrence_changed` reschedule guard works under cron.

**Cleanup-timing note:** the fixture becomes `task_overdue`-eligible at ~**18:28 Riyadh (15:28Z)** (due + 60 min). Complete
the fixture before then so the overdue path cannot fire a second notification/push. Receipt is expected ~17:45 Riyadh
(the `*/15` checker's first run after the ticket passes 15 min old), leaving comfortable margin.

**Round 2 (FINAL) — ~17:46 Riyadh (14:46Z), sent_age_min=26.** Chain **COMPLETE — PASS**.

- **stage 1 fixture_open:** `status=open in_window=false` — the 17:28 due has passed (task now out of the 20-min window;
  still `open`, in the pre-overdue dead zone → clean up before 18:28). Expected.
- **stage 2 producer_notification:** unchanged — stale 17:21 + current 17:28 occurrences.
- **stage 3 producer_outbox:** stale `skipped occurrence_changed` · current `fanned`.
- **stage 4 processor_delivery:** one delivery `sent`, `expo_ticket_id=019f473f-f564-717b-be64-8240d2ac076a`.
- **stage 6 receipt_ok:** `status=sent receipt=ok ticket=019f473f-… sent_age_min=26` ✅ ← **chain complete**.
- **Device push (re-confirmed):** title `سند`, body `لديك تذكير جديد`, no private detail ✅.
- **stage 7 unexpected_notifications_2h:** `0` · **stage 8 pending_outbox_global:** `0` ·
  **stage 9 processing_stale_failed_global:** `processing=0 stale=0 failed=0` ✅.

**Checkpoint D verdict: PASS.** Cron-only chain proven end-to-end: **producer** created the `task_due` notification +
outbox (current occurrence `fanned`, stale occurrence `skipped occurrence_changed`); **processor** sent **exactly one**
push (delivery `sent`, ticket `019f473f-…`) rendering as the **generic** OS copy with no private content; **receipt
checker** recorded `receipt_status=ok`. No collateral notifications, no pending outbox, no processing/stale/failed —
**no side effects**.

---

## Checkpoint E — Fixture cleanup ✅ PASS (fixture completed via app UI; baseline intact; 3 jobs active)

### E.1 — Retire the fixture (app UI only)

Mark the `[QA CRON]` task **completed** ("تم الإنجاز") in the app UI — the established cleanup path. **Do not** delete
it, **do not** run a raw SQL `UPDATE`/`DELETE`, and **do not** delete the notification/outbox/delivery rows (that chain
is the smoke-test evidence). Completing it flips producers to skip it (`status<>'open'`) and source-validity to
`task_closed`. Cron jobs stay **active** (the brief keeps 3 jobs live unless explicitly disabled).

### E.2 — Cleanup verification (SELECT-only; run after completing the fixture)

```sql
-- 2F-10M CHECKPOINT E.2 — CLEANUP VERIFICATION (SELECT-ONLY). Fixture 78787ad2-fac4-4c19-91f1-385b3a4c6e85 wired in. ONE grid.
with params as (
  select '78787ad2-fac4-4c19-91f1-385b3a4c6e85'::uuid as task_id,
         'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid as owner_id,
         'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
),
notif as (
  select n.* from public.notifications n, params p
  where n.type = 'task_due' and n.user_id = p.owner_id and n.data->>'itemId' = p.task_id::text
),
ob as (
  select o.* from public.notification_outbox o where o.notification_id in (select id from notif)
),
del as (
  select d.* from public.notification_push_deliveries d where d.outbox_id in (select id from ob)
)
select 1 as ord, 'fixture_status' as check_name,
       (select coalesce(string_agg('status=' || t.status::text
                 || ' completed_at=' || coalesce(t.completed_at::text, '-')
                 || ' cancelled_at=' || coalesce(t.cancelled_at::text, '-'), ' | '), '(not found)')
          from public.care_tasks t, params p where t.id = p.task_id and t.circle_id = p.circle_id) as observed,
       'status=completed (or cancelled), NOT open' as expected
union all
select 2, 'open_qa_cron_count',
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and title like '[QA CRON]%' and status = 'open'),
       '0'
union all
select 3, 'pending_outbox_global',
       (select count(*)::text from public.notification_outbox where status = 'pending'), '0'
union all
select 4, 'processing_stale_failed_global',
       (select 'processing=' || (count(*) filter (where status = 'processing'))::text
             || ' stale=' || (count(*) filter (where status = 'processing' and locked_at < now() - make_interval(secs => 600)))::text
             || ' failed=' || (count(*) filter (where status = 'failed'))::text
          from public.notification_push_deliveries),
       'processing=0 stale=0 failed=0'
union all
select 5, 'fixture_outbox_terminal',
       (select coalesce(string_agg('status=' || o.status::text, ' | '), '(none)') from ob o),
       'fanned (terminal success; not pending)'
union all
select 6, 'fixture_delivery_final',
       (select coalesce(string_agg('status=' || d.status::text || ' receipt=' || coalesce(d.receipt_status, '(null)')
                 || ' ticket=' || coalesce(d.expo_ticket_id, '-'), ' | '), '(none)') from del d),
       'sent / receipt_status=ok (final delivery+receipt state recorded)'
union all
select 7, 'source_validity_optional',
       (select coalesce(string_agg('valid=' || sv.valid::text || ' reason=' || coalesce(sv.reason, '-'), ' | '), '(n/a)')
          from notif n cross join lateral public.notification_source_validity(n.id) sv),
       'valid=false reason=task_closed (OPTIONAL; if "permission denied for function", skip — row 1 already proves closure)'
union all
select 8, 'sanad_jobs_still_active',
       (select (count(*) filter (where active))::text || ' active / ' || count(*)::text || ' total'
          from cron.job where jobname like 'sanad-%'),
       '3 active / 3 total (jobs left active per brief)'
order by ord;
```

**PASS:** `fixture_status=completed` · `open_qa_cron_count=0` · `pending_outbox_global=0` ·
`processing_stale_failed_global` all 0 · `fixture_outbox_terminal` = `fanned` + `skipped` (both terminal, **no pending** —
the two occurrences) · `fixture_delivery_final=sent / receipt=ok / ticket=019f473f-…` ·
(optional) `source_validity=false/task_closed` · `sanad_jobs_still_active=3 active / 3 total`.

> **GATE 3 note:** if anything unexpected appears during observation (collateral notifications, a non-QA eligible row,
> a `failed`/stale delivery, a push to the wrong device, private content on the device, or an unexplained pending
> backlog), **STOP before cleanup**, capture the evidence, and we resolve it before retiring the fixture. The reviewed
> Sanad-scoped disable path (`select jobname, cron.unschedule(jobname) from cron.job where jobname like 'sanad-%';`) is
> available if the jobs must be halted — but is **not** run in the normal happy path.

### E — Results

**Operator verdict: PASS.** Fixture **completed** via the app UI (no SQL mutation; no evidence rows deleted). E.2 grid (verbatim):

| ord | check | observed | expected | verdict |
|-----|-------|----------|----------|---------|
| 1 | fixture_status | `status=completed completed_at=2026-07-09 14:47:22.62+00 cancelled_at=-` | completed, NOT open | ✅ |
| 2 | open_qa_cron_count | `0` | `0` | ✅ |
| 3 | pending_outbox_global | `0` | `0` | ✅ |
| 4 | processing_stale_failed_global | `processing=0 stale=0 failed=0` | all 0 | ✅ |
| 5 | fixture_outbox_terminal | `status=fanned` \| `status=skipped err=occurrence_changed` | fanned+skipped, no pending | ✅ |
| 6 | fixture_delivery_final | `status=sent receipt=ok ticket=019f473f-f564-717b-be64-8240d2ac076a` | sent / ok | ✅ |
| 8 | sanad_jobs_still_active | `3 active / 3 total` | 3 active | ✅ |

(Row 7 `source_validity_optional` not returned — it is optional; row 1 `status=completed` already proves closure.)

**Assessment:** fixture retired (`completed`, `completed_at=2026-07-09 14:47:22.62+00`); no open `[QA CRON]`; baseline
clean (`pending_outbox=0`, no processing/stale/failed); notification/outbox/delivery evidence **preserved**; **3 Sanad
jobs remain active**. **Cleanup PASS.**

---

## Checkpoint F — Final report + validation ✅ done — verdict PASS

### 1. Executive summary

Phase 2F-10M ran the first end-to-end **active cron** smoke test of the `task_due` notification chain against the
LIVE Sanad jobs created in 2F-10L. One fresh `[QA CRON] اختبار جدولة الإشعارات` fixture was created via the app UI
(assigned to the owner, due ~11 min ahead in Asia/Riyadh) and the **active** `pg_cron` jobs drove the entire chain
with **no manual Edge invocation, no manual `net.http_post`, and no manual receipt-checker run**. Producer →
processor → one generic Android push → receipt `ok` all completed cleanly; the fixture was then retired via the app
UI with the baseline intact. **Verdict: PASS.**

### 2. Evidence chain (what cron did, unaided)

- **Producer (`sanad-enqueue-due-reminders`, `*/5`)** created the `task_due` notification + outbox row for the
  current occurrence (due 17:28). The due_time had been adjusted 17:21→17:28 mid-window, so an earlier 17:21
  occurrence also existed; it was **safely skipped** by the processor with `occurrence_changed` (source-validity
  guard) — exactly one occurrence proceeded.
- **Processor (`sanad-process-notification-outbox`, `*/5`)** fanned the current occurrence and sent **exactly one**
  Android push — delivery `sent`, `expo_ticket_id=019f473f-f564-717b-be64-8240d2ac076a`, `sent_at=2026-07-09
  14:20:01.884355+00`.
- **OS push (device-confirmed, twice):** generic copy only — **title `سند`, body `لديك تذكير جديد`**, no private task
  title or detail. Structurally the delivery row carries no title/body column.
- **Receipt checker (`sanad-check-push-receipts`, `*/15`)** recorded `receipt_status=ok` (ticket ~26 min old at
  observation).
- **Cleanup:** fixture completed via app UI (`status=completed`, `completed_at=2026-07-09 14:47:22.62+00`); no rows
  deleted (evidence preserved).

### 3. Success criteria — all met

| Criterion | Result |
|---|---|
| cron producer created the QA `task_due` notification + outbox | ✅ current occurrence `fanned` |
| stale occurrence handled safely (no stale push) | ✅ `skipped occurrence_changed` |
| cron processor sent exactly one push (expected path) | ✅ one delivery `sent`, ticket `019f473f-…` |
| OS push generic, no private content | ✅ `سند` / `لديك تذكير جديد`, no task title/detail |
| receipt checker recorded ok | ✅ `receipt_status=ok` |
| no collateral notifications | ✅ `unexpected_notifications_2h=0` |
| no pending outbox | ✅ `pending_outbox=0` |
| no processing/stale/failed deliveries | ✅ `processing=0 stale=0 failed=0` |
| fixture cleaned up | ✅ `completed`, `open_qa_cron_count=0` |
| three Sanad cron jobs remain active | ✅ `3 active / 3 total` |
| no manual Edge / `net.http_post` / receipt run | ✅ cron-only |
| no secret exposure / `cron.job.command` never printed | ✅ |

### 4. Deviations / incidents

- **Two `task_due` occurrences (benign, correctly handled).** The fixture due_time was edited 17:21→17:28 after the
  first producer run, yielding two occurrences with distinct `dedupe_key`s. The processor sent only the current one
  and skipped the stale one via `occurrence_changed`. Exactly one push reached the device — the reschedule guard
  working as designed, **not** a duplicate and **not** a side effect. No other incidents.

### 5. Final verdict

**PASS — active cron end-to-end smoke test succeeded.** The scheduled chain, driven entirely by the live `pg_cron`
jobs (secret read from Vault by name at runtime; `cron.job.command` never printed), produced exactly one correct
generic Android push and a confirmed `ok` receipt, with no side effects, and cleaned up cleanly.

### 6. Recommendation

**The notification cron chain is production-ready, with the three Sanad cron jobs active**
(`sanad-enqueue-due-reminders */5`, `sanad-process-notification-outbox */5`, `sanad-check-push-receipts */15`). This
run additionally proved the `occurrence_changed` guard prevents stale-reminder pushes after a task is rescheduled.

### 7. Validation & final git state

_Local, read-only checks only (no Supabase CLI, no SQL, no DB, no deploy, no invocation). Captured at hand-off:_

```text
$ npm run check:mojibake
> sanad-mobile@1.0.0 check:mojibake
> node ./scripts/check-mojibake.js
check:mojibake - scanned 266 active source/config file(s).
No strong mojibake signatures found in active source/config.
(exit 0)

$ git -c core.autocrlf=false diff --check
(no output; exit 0)

$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10m-active-cron-smoke-test-execution.md

$ git --no-pager diff --stat
(empty — no tracked-file changes)
```

**All four checks pass:** no mojibake, no whitespace/conflict errors, and the only change is the single **untracked**
2F-10M report — **no** app/Edge/migration/generated-type changes, **no** SQL run by Claude, **no** DB connection by
Claude, **no** Supabase CLI, **no** deploy, **no** secret read/printed, **no** `cron.job.command` printed, and **no
commit / no stage.** The three Sanad cron jobs remain **active** (not disabled).
