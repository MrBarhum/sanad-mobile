# Phase 2F-10D - Cron smoke-test PREFLIGHT SQL REVIEW (review only; no execution)

**Status:** Review only. This report **reviews** the read-only preflight SQL pack authored in `2F-10C` against
the actual schema (migrations) and Edge source, verifies it is SELECT-only / non-exposing / correct, records
findings, and reproduces the pack in a **revised, final approved (still-not-run)** form. **Claude ran no SQL,
made no DB connection, ran no Supabase CLI, invoked no Edge Function, enabled/created no cron, sent no push, and
read no secret value.** The only filesystem write in this phase is this report; the only commands Claude runs
are the two local read-only checks in Section 10 and the read-only git status/diff in Section 12.

**Baseline commit:** `docs(product): plan cron smoke test execution` (current `master` HEAD, pushed).
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Owner user (recipient / token owner):** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.

**Sources inspected read-only (no file modified):** `2F-10C` execution plan, `2F-10B` orchestration plan,
`2F-10A` closeout/readiness; Edge source (`enqueue-due-reminders`, `process-notification-outbox`,
`check-push-receipts`) + shared (`config.ts`, `auth.ts`, `enqueue.ts`, `messages.ts`, `expo.ts`); migrations
`20260611120000_create_notifications_core.sql` (push_tokens / notifications / notification_outbox /
notification_push_deliveries + enums + RLS), `20260610090000_create_care_tasks.sql` (care_tasks columns +
status enum), `20260611120100_create_notification_functions.sql`,
`20260626164000_notifications_responsibility_resolvers.sql`,
`20260611120200_add_care_circle_timezone.sql` (`care_circles.timezone`); `supabase/config.toml`. Schema for
`circle_members` (`user_id`, `circle_id`, `role`, `status`) and `care_circles` (`id`, `timezone`) confirmed via
their use in the care-tasks RLS and the notification functions/resolvers.

**Cron-infrastructure finding (read-only, unchanged):** no `pg_cron` schedule and no cron migration exist in
the repo; only the `auth.ts` doc-comment and the `config.toml` `verify_jwt = false` block reference cron.

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **This is preflight SQL review only.** No SQL was run.
- **No DB connection was made.**
- **No Supabase CLI was run.**
- **No Edge Function was invoked.**
- **No cron was enabled or created.**
- **No push was sent.**
- **No secrets were read** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only).
- **Readiness verdict:** the preflight pack is **almost ready** for later manual execution review. **All table
  and column names are correct** against the migrations, every block is **SELECT-only**, and the token is
  always **masked**. **Two revisions are required** before use: (1) the eligible-`task_due` query selects
  `t.title` for **every** in-window row, which could surface a **non-QA** task's real title - it must redact the
  title for non-QA rows; (2) the pack covers only `task_due`, but the producer is **DB-wide** and also runs
  `task_overdue` + medication/appointment/visit - the "no unexpected eligible rows" gate must **mirror** those
  (at least informationally). Section 6 supplies the revised, final, still-not-run pack; with those applied the
  pack is ready for a **manual read-only preflight execution (no cron)** next.

---

## 2. Baseline

- **Latest commit:** `docs(product): plan cron smoke test execution` (current `master` HEAD).
- **Cron:** **off**. No cron migration / no `pg_cron` schedule known from the repo.
- **Known engine state (from prior reports):**
  - Outbox: `fanned = 2`, `skipped = 1`, `pending = 0`.
  - Deliveries: `sent` / `ok` = `1` (`60cd396b-...`); `sent` / `unchecked` = `1` (`0fef9576-...`).
  - QA fixtures (`[QA PUSH]`, `[QA RECEIPT]`): **completed**.
- **Future smoke target (unchanged):** circle `ae4721d8-bd65-4fa8-bc25-e10ea73f357c`, owner
  `a6dc7376-fd9d-461f-9d14-41eabcd3f538`, fixture title `[QA CRON] اختبار جدولة الإشعارات`.

---

## 3. Review goals

Review the 2F-10C preview pack for: **SELECT-only safety**; **no mutation**; **no secret exposure**; **no raw
Expo token exposure**; **correct table/column names** (checked against migrations/source); **correct `task_due`
window logic**; **correct timezone handling**; **correct QA / non-QA filtering**; **correct active-token review
without exposing the token**; **correct stale-delivery / receipt-pending logic**; **safe cron-job discovery**;
and **clear expected results + stop criteria**.

---

## 4. Preflight SQL pack review

Each row: purpose / tables touched / mutation risk / secret-token exposure risk / expected clean result / stop
condition / verdict.

| # | Query (purpose) | Tables touched | Mutation risk | Secret/token risk | Expected clean result | Stop condition | Verdict |
| - | --------------- | -------------- | ------------- | ----------------- | --------------------- | -------------- | ------- |
| 1 | Pending outbox count | `notification_outbox` | None (SELECT) | None | `0` (or the single QA row after producer) | any unexplained `> 0` | **Keep as-is** |
| 2 | Outbox status summary | `notification_outbox` | None | None | `fanned=2, skipped=1`, no pending | pending present | **Keep as-is** |
| 3 | Delivery status / receipt summary | `notification_push_deliveries` | None | None | `sent/ok=1, sent/unchecked=1` | new `failed`/`skipped` | **Keep as-is** |
| 4 | Processing / stale deliveries | `notification_push_deliveries` | None | None | `0 / 0` | `stale_processing > 0` | **Keep as-is** |
| 5 | Sent pending-receipt ≥15m | `notification_push_deliveries` | None | None (ticket id only) | none baseline; QA ticket after 15m | unexpected rows | **Keep as-is** |
| 6 | Failed deliveries | `notification_push_deliveries` | None | None | `0` | any cluster | **Keep as-is** |
| 7 | Active push tokens for owner (+role) | `push_tokens`, `circle_members` | None | **None - token masked** to scheme | exactly one active token, active operational member | zero / multiple active | **Keep as-is** |
| 8 | `task_due` rows in next 20m | `care_tasks`, `care_circles` | None | **Selects `t.title` for ALL rows** -> could expose a non-QA title | exactly one row, QA fixture | any non-QA row | **Revise before use** |
| 9 | Unexpected non-QA eligible rows | `care_tasks`, `care_circles` | None | None (count only) | `0` | any `> 0` | **Keep as-is** |
| 10 | Cron job list / schema existence | `cron.job` (guarded) | None | None | `regclass` null OR zero Sanad jobs | pre-existing Sanad job | **Keep as-is** |
| 11 | Pre-existing QA fixture check | `care_tasks` | None | None (count only) | `0` before creation | `> 0` (retire extras) | **Keep as-is** |
| + | **Missing:** `task_overdue` + med/appt/visit eligibility mirror | (various) | None | None | all zero outside QA | any non-QA eligible | **Revise (add)** |

**All eleven original blocks are SELECT-only with correct table/column names.** Nine are kept as-is; block 8
needs title redaction; and one **additive** set is needed to mirror the other DB-wide producer paths.

---

## 5. SQL correctness issues

- **Wrong table/column names:** **none found.** Every referenced object exists:
  `notification_outbox(status, available_at, notification_id, user_id)`,
  `notification_push_deliveries(status, locked_at, receipt_status, expo_ticket_id, sent_at, created_at)`,
  `push_tokens(id, user_id, expo_push_token, platform, device_id, is_active, last_seen_at)`,
  `circle_members(user_id, circle_id, role, status)`, `care_tasks(id, circle_id, title, due_date, due_time,
  status, assigned_to)`, `care_circles(id, timezone)`, `cron.job(jobid, jobname, schedule, active, command)`.
- **Unnecessary private-data exposure (block 8):** the eligible-`task_due` query selects `t.title` for **every**
  in-window task DB-wide, so a **non-QA** circle's real task title would be displayed. **Fix:** redact the title
  unless the row is the QA marker (show `t.title` only when `title like '[QA CRON]%'` in the QA circle;
  otherwise a placeholder). Applied in Section 6.
- **Safer masking:** the **token** query (block 7) is already correctly masked
  (`split_part(expo_push_token,'[',1) || '[***]'`) and never selects the raw column - **good, keep**. No other
  block selects sensitive values (the receipt/ticket ids are non-secret identifiers already published in prior
  reports).
- **Avoid selecting task title except the QA marker:** yes - block 8 (above). Blocks 9 and 11 already avoid it
  (count-only / filtered to the `[QA CRON]%` prefix).
- **Timezone ambiguity:** the window math `((t.due_date + coalesce(t.due_time, time '09:00')) at time zone
  cc.timezone)` correctly reproduces the producer's `wallTimeToInstant` (naive circle-local wall time -> UTC),
  and the `09:00` default matches the producer's date-only default. **Correct as written**, but it depends on
  `care_circles.timezone` being the real zone (QA circle = `Asia/Riyadh`); a circle left at the `'UTC'` default
  would shift its window. Note this dependency; do not change the SQL.
- **Role / membership ambiguity:** block 7's `left join circle_members ... on circle_id = <QA circle>` correctly
  scopes to the QA-circle membership only; confirm the owner shows an **active** operational role
  (`admin` / `primary_caregiver` / `family_member` / `caregiver`) - a `remote_member` / `elder` / non-member
  would not receive an operational `task_due` push (by `notification_recipient_eligible`).
- **Mirror `task_due` checks for medications / appointments / visits (even though out of scope):** **required.**
  The producer (`enqueue-due-reminders`) is DB-wide and, in one run, also executes `enqueueTaskOverdue`,
  `enqueueMedicationDue`, `enqueueAppointmentUpcoming`, and `enqueueVisitUpcoming`. Although the smoke test
  creates only a task fixture, an enabled producer could co-produce a med/appt/visit/overdue notification if any
  exists in its window. The preflight must therefore include a `task_overdue` window count and an
  informational medication/appointment/visit scan, with the **authoritative** arbiter being the producer
  response counters (`taskOverdue=0`, `medication=0`, `appointment=0`, `visit=0`). Added in Section 6. (The
  medication/appointment/visit windows are impractical to reproduce exactly in one SELECT - candidate-day /
  lead-time / dose-log logic - so those are **approximate informational** scans, explicitly labeled.)
- **Split broad queries into smaller safer ones:** only block 8 needed changing (redaction); no other block
  needs splitting. The token query stays a single scoped, masked SELECT.

---

## 6. Revised future / manual SQL pack (final approved form - still NOT run)

SELECT-only. No `INSERT` / `UPDATE` / `DELETE` / `cron.schedule` / `cron.unschedule` / `net.http_post`. No raw
token or secret output. Blocks 1-7, 9-11 are unchanged from 2F-10C (reproduced for a single reviewed pack);
block 8 is **revised** (title redacted); block 12 is **new** (DB-wide producer mirror).

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (1) Pending-outbox count.
select count(*) as pending_outbox from public.notification_outbox where status = 'pending';
-- Expected: 0 before the fixture (or exactly 1 = the [QA CRON] row after creation + producer). STOP if unexplained > 0.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (2) Outbox status summary.
select status::text as outbox_status, count(*) as rows
from public.notification_outbox group by status order by status;
-- Expected baseline: fanned=2, skipped=1, no pending. STOP if a 'pending' row is unexplained.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (3) Delivery status + receipt summary.
select status::text as delivery_status,
       coalesce(receipt_status, '(null)') as receipt_status, count(*) as rows
from public.notification_push_deliveries group by status, receipt_status order by 1, 2;
-- Expected baseline: sent/ok=1, sent/unchecked=1. STOP on unexplained new failed/skipped rows.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (4) Processing / stale deliveries.
select count(*) as processing_total,
       count(*) filter (where locked_at < now() - make_interval(secs => 600)) as stale_processing
from public.notification_push_deliveries where status = 'processing';
-- Expected: 0 / 0. STOP if stale_processing > 0 (crashed-worker rows must be understood first).
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (5) Sent deliveries pending a receipt (>=15m).
select id as delivery_id, expo_ticket_id, sent_at
from public.notification_push_deliveries
where status = 'sent' and receipt_status is null and expo_ticket_id is not null
  and sent_at < now() - interval '15 minutes'
order by sent_at asc;
-- Expected baseline: none (old ticket already swept to 'unchecked'). QA ticket appears only after it ages >15m.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (6) Failed deliveries.
select count(*) as failed_deliveries from public.notification_push_deliveries where status = 'failed';
-- Expected: 0. STOP on a cluster (systemic send problem).
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (7) Owner active push tokens + QA-circle
-- role. NEVER selects the raw token (masked to its scheme only).
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
-- membership_status='active'. STOP if zero active (no push) or multiple active (multiple pushes) or remote_member/elder.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (8, REVISED) task_due rows in the next
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
-- Expected during the smoke window: exactly one row, is_qa_cron_fixture=true. Any non-QA row -> STOP.
-- NOTE: this is a SUPERSET gate (window only; it does not re-check assignment/eligibility), so it is intentionally
-- conservative — a windowed-but-unassigned task the producer would skip may still list here for review.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (9) Unexpected non-QA task_due rows (count only).
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
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (10) Cron schema existence probe.
select to_regclass('cron.job') as cron_job_regclass;
-- If non-null, THEN list only Sanad notification jobs:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname like 'sanad-%' or command ilike '%enqueue-due-reminders%'
--    or command ilike '%process-notification-outbox%' or command ilike '%check-push-receipts%' order by jobid;
-- Expected before enablement: null OR zero Sanad jobs. Any pre-existing Sanad notification job -> STOP.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (11) Pre-existing QA fixture check.
select count(*) as existing_qa_cron_open
from public.care_tasks
where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
  and title like '[QA CRON]%' and status = 'open';
-- Expected before creation: 0. If > 0, retire the extra(s) via app UI so exactly one open [QA CRON] remains.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (12, NEW) DB-wide producer mirror: the
-- producer also runs task_overdue + medication/appointment/visit in ONE pass. This confirms nothing else is
-- poised to fire. (a) task_overdue window is exact; (b) med/appt/visit are APPROXIMATE informational counts —
-- the AUTHORITATIVE arbiter is the producer response (taskOverdue=0, medication=0, appointment=0, visit=0).
-- 12a. task_overdue window [now-24h, now-60m], DB-wide (exact).
select count(*) as task_overdue_in_window
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() - interval '24 hours' and now() - interval '60 minutes';
-- Expected: 0 (the QA fixture is in the FUTURE, not overdue). Any > 0 -> review before enabling.
```

```sql
-- DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY. READ ONLY. (12b) APPROXIMATE med/appt/visit scan
-- (NOT an exact window reproduction). Authoritative check remains the producer response counters.
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
-- Informational: if any source is non-zero, treat as REVIEW and rely on the producer response (all 0) as the arbiter.
```

No `INSERT` / `UPDATE` / `DELETE` / `cron.schedule` / `cron.unschedule` / `net.http_post` appears anywhere in
this section.

---

## 7. Cron enable / disable preview review

Reviewing the `2F-10C` §7-§8 previews only (no runnable final commands authored here):

- **Job names clearly scoped with `sanad-`:** ✅ `sanad-enqueue-due-reminders`,
  `sanad-process-notification-outbox`, `sanad-check-push-receipts` - a stable prefix that lets disablement
  target exactly these jobs.
- **Function endpoints correct conceptually:** ✅ `https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/<fn>`
  for the three chain functions; `verify_jwt = false` for them in `config.toml`, so the `x-cron-secret` header
  is the credential.
- **Secret must come from secure storage:** ✅ the preview sources the secret as a placeholder
  (`:cron_secret`) intended to be read from a secret store (e.g. Supabase Vault) at call time.
- **Secret must never be hardcoded / printed / pasted / committed:** ✅ stated explicitly; **reaffirmed here** -
  no secret value may appear in SQL text, logs, reports, or chat.
- **Disable targets only Sanad notification jobs:** ✅ the disable preview filters `cron.job` by the `sanad-`
  prefix and unschedules only those, leaving unrelated schedules untouched.
- **Exact enable/disable SQL still requires separate approval:** ✅ confirmed - the previews are **illustrative
  only**; the exact `cron.schedule` / `cron.unschedule` + `net.http_post` wiring must be authored and reviewed
  again in the approved execution phase before any run. **This report authors no runnable cron command.**

---

## 8. Human execution checklist (confirm ALL before any future SQL run)

Before the later phase runs even the **read-only** preflight, the operator must confirm:

- [ ] The Supabase Dashboard shows the **correct project ref** `qccgshanmoeybagxwvcs` (Sanad), not another project.
- [ ] The operator understands the pack is **read-only** (SELECT-only; no mutation).
- [ ] **No secrets** are pasted anywhere (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` never entered into SQL/chat).
- [ ] The physical **test device is ready** (charged, online).
- [ ] The device's **app notification permission is enabled**.
- [ ] The **QA owner is signed in** on that device with an active push token.
- [ ] **Cron is still off** before starting (Section 6 block 10 shows no Sanad job).
- [ ] The operator has **time to supervise the full test window** (fixture -> producer -> processor -> push ->
      ~15 min wait -> receipt -> disable -> cleanup).
- [ ] The **stop / fail criteria** (2F-10C Section 11) are visible and understood.

---

## 9. Recommendation

**Conservative recommendation: `2F-10E - manual preflight execution only (no cron)`.**

Rationale: the pack required revisions (Section 5), which Section 6 now supplies, so it is **not** the case that
the original pack was "clearly ready with low risk." The safer next step is to run the **revised, read-only**
preflight (Section 6) against the real database under explicit approval - **with no fixture creation, no Edge
invocation, no cron, and no push** - to confirm the queries execute cleanly and the baseline matches
expectations on live data. Only **after** that clean manual preflight should a distinct, separately-approved
`2F-10E`/`2F-10F - cron smoke-test execution` phase proceed.

- **Do not enable cron immediately** from this report - cron enablement remains a later, explicitly-approved step.
- If the manual preflight surfaces anything unexpected (non-QA eligible rows, stale/failed deliveries, a
  pre-existing cron job), **stop and stay in review** until it is understood.

---

## 10. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results are recorded in Section 12's hand-off. No other command is run in this phase.

---

## 11. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched - read only).
- **No migrations changed** (`supabase/migrations/**` untouched - read only).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run** (every SQL block is marked `DO NOT RUN IN 2F-10D — FUTURE MANUAL REVIEWED PREVIEW ONLY`;
  SELECT-only; no `INSERT` / `UPDATE` / `DELETE` / executed `cron.*` / `net.http_post`).
- **No DB connection.**
- **No deploy.**
- **No Edge invocation** (`enqueue-due-reminders`, `process-notification-outbox`, `check-push-receipts`,
  `check-missed-doses` were not run).
- **No cron enabled / created.**
- **No notification delivery / push.**
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only; no
  value read or requested; all UUIDs are user / circle / task / notification / outbox / delivery / token /
  ticket identifiers, not secrets).
- **No raw Expo token exposed** (token listings masked to the scheme prefix only).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 12. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10d-cron-preflight-sql-review.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
