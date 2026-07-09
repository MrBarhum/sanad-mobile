# Phase 2F-10I — Cron smoke-test EXECUTION RECORD (explicitly-approved, human-in-the-loop)

- **Date:** 2026-07-08
- **Phase:** 2F-10I — cron smoke-test execution, explicitly approved (first controlled execution phase)
- **Status:** **STOPPED / BLOCKED BEFORE CRON ENABLEMENT** — `pg_cron` is not installed / not visible in `qccgshanmoeybagxwvcs`, so the cron smoke test could not proceed through cron in 2F-10I. Fixture cleaned up; baseline intact.
- **Baseline commit (after 2F-10H):** `7bcef43 docs(product): finalize cron smoke test approval plan`
- **Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`
- **QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (رعاية الوالد الغالي)
- **Owner / recipient user:** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`
- **Owner active push token id (from 2F-10F):** `93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8` (masked scheme only; raw never exposed)

---

## Execution model (how this phase runs)

- **Claude** guides the sequence, authors reviewed **SELECT-only** SQL blocks, assesses pasted
  outputs, and writes this report.
- **The human operator** runs all SQL manually in the Supabase Dashboard, creates/verifies the QA
  fixture in the app UI, enables/disables cron manually, and confirms the push on the Android device.
- **Claude does NOT:** run Supabase CLI, run/connect SQL, invoke Edge Functions, enable/create cron,
  send push, deploy, use EAS, read/paste secrets, or modify app/Edge/migrations/types.
- **Strict checkpoints:** Claude stops at each checkpoint and does **not** continue until the human
  pastes results and **explicitly approves** continuing. Each risky action is approved separately.

---

## Checkpoint progress log

| CP | Action | Requires human | Status |
|----|--------|----------------|--------|
| 1 | Local baseline (mojibake, diff-check, status, log) | no (Claude local) | ✅ PASS |
| 2 | Last-minute read-only preflight SQL | **approval + run + paste** | ✅ PASS (operator-confirmed) |
| 3 | QA fixture creation (app UI) + verify | **approval + create + paste** | ✅ PASS (fixture created) |
| 4 | Cron enablement | — | 🛑 **BLOCKED** — pg_cron not installed (STOP) |
| 5 | Producer / processor evidence | — | ⛔ N/A (cron never enabled) |
| 6 | Android push confirmation | — | ⛔ N/A |
| 7 | Receipt checker (≥15m) | — | ⛔ N/A |
| 8 | Cron disable | — | ⛔ N/A (nothing created) |
| 9 | Fixture cleanup (app UI) + verify | **approval + complete + paste** | ✅ PASS (cleanup verified) |
| 10 | Final report + validation | no (Claude local) | ✅ done |

---

## Checkpoint 1 — Local baseline ✅ PASS

Commands run locally by Claude (read-only):

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
7bcef43 docs(product): finalize cron smoke test approval plan
7433d82 docs(product): record med visit cron preflight results
b15ff69 docs(product): assess cron preflight results
3116907 docs(product): prepare manual cron preflight
bbdb1d6 docs(product): review cron preflight SQL
```

**Assessment:** Working tree **clean** and in sync with `origin/master`; HEAD is exactly the
expected 2F-10H baseline `7bcef43 docs(product): finalize cron smoke test approval plan`. No
mojibake, no whitespace/conflict errors. Git is **not** dirty → **PASS, continue.**

---

## Checkpoint 2 — Last-minute manual read-only preflight ✅ PASS (operator-confirmed)

**Reviewed SELECT-only preflight**, consolidated from the already-approved 2F-10E blocks 1–13 and
the 2F-10G-cleared deep-review B/E/F, into **one** combined statement that returns a single labeled
result grid. Table/column names and the med/visit window logic are reused verbatim from packs that
executed cleanly against this DB in 2F-10E→G.

**Rules honored:** SELECT-only; no `INSERT` / `UPDATE` / `DELETE` / `cron.schedule` /
`cron.unschedule` / `net.http_post`; the Expo token is masked to its scheme only; no secret is read
or output.

```sql
-- ============================================================================
-- 2F-10I CHECKPOINT 2 — LAST-MINUTE READ-ONLY PREFLIGHT (SELECT-ONLY)
-- RUN ONLY IN THE SUPABASE DASHBOARD SQL EDITOR FOR PROJECT qccgshanmoeybagxwvcs,
-- AND ONLY AFTER EXPLICIT HUMAN APPROVAL.
-- No INSERT/UPDATE/DELETE/cron.*/net.http_post. No raw Expo token (masked). No secrets.
-- Returns ONE result grid of labelled checks (order by ord). Paste the whole grid back.
-- ============================================================================
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
         ((d.dose_date + t.tm) at time zone d.tz) as dose_at,
         (d.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) as is_qa_circle
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
  select v.id as visit_id, v.circle_id, v.visit_date, v.start_time,
         (v.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) as is_qa_circle
  from public.family_visits v
  join public.care_circles cc on cc.id = v.circle_id
  where v.status = 'planned' and v.visit_date is not null
    and ((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone cc.timezone)
          between now() + interval '60 minutes' and now() + interval '80 minutes'
)
select 1 as ord, 'pending_outbox' as check_name,
       (select count(*)::text from public.notification_outbox where status = 'pending') as observed,
       '0' as expected, 'STOP if unexplained > 0' as note
union all
select 2, 'outbox_summary',
       (select coalesce(string_agg(status::text || '=' || c::text, ', ' order by status), '(none)')
          from (select status, count(*) c from public.notification_outbox group by status) s),
       'fanned=2, skipped=1, pending=0', 'baseline match; STOP on unexplained pending'
union all
select 3, 'delivery_receipt_summary',
       (select coalesce(string_agg(status::text || '/' || coalesce(receipt_status, '(null)') || '=' || c::text, ', '
                 order by status, coalesce(receipt_status, '(null)')), '(none)')
          from (select status, receipt_status, count(*) c
                  from public.notification_push_deliveries group by status, receipt_status) s),
       'sent/ok=1, sent/unchecked=1', 'baseline match; STOP on new failed/skipped'
union all
select 4, 'processing_total',
       (select count(*)::text from public.notification_push_deliveries where status = 'processing'),
       '0', 'STOP if > 0'
union all
select 5, 'stale_processing',
       (select count(*)::text from public.notification_push_deliveries
         where status = 'processing' and locked_at < now() - make_interval(secs => 600)),
       '0', 'STOP if > 0'
union all
select 6, 'failed_deliveries',
       (select count(*)::text from public.notification_push_deliveries where status = 'failed'),
       '0', 'STOP if cluster'
union all
select 7, 'sent_pending_receipt_ge_15m',
       (select count(*)::text from public.notification_push_deliveries
         where status = 'sent' and receipt_status is null and expo_ticket_id is not null
           and sent_at < now() - interval '15 minutes'),
       '0 (baseline)', 'REVIEW if > 0'
union all
select 8, 'owner_active_tokens',
       (select (count(*) filter (where is_active))::text || ' active / ' || count(*)::text || ' total'
          from public.push_tokens where user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid),
       'exactly 1 active', 'STOP if 0 or >1 (unless explicitly accepted)'
union all
select 9, 'owner_token_detail_masked',
       (select coalesce(string_agg(
                 'platform=' || coalesce(pt.platform, '?') ||
                 ' active=' || pt.is_active::text ||
                 ' role=' || coalesce(cm.role::text, '(none)') ||
                 ' membership=' || coalesce(cm.status::text, '(none)') ||
                 ' token=' || split_part(pt.expo_push_token, '[', 1) || '[***]',
                 ' | ' order by pt.is_active desc), '(no tokens)')
          from public.push_tokens pt
          left join public.circle_members cm
            on cm.user_id = pt.user_id
           and cm.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
         where pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid),
       'active operational role (admin/primary_caregiver/family_member/caregiver)',
       'STOP if remote_member/elder/inactive/missing'
union all
select 10, 'task_due_next_20m',
       (select coalesce(string_agg(
                 case when (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')
                      then 'QA:' || t.title else 'non-QA(redacted)' end
                 || ' due=' || t.due_date::text || coalesce(' ' || t.due_time::text, ''),
                 ' | ' order by (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%') desc),
               '(none)')
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'),
       '0 rows before fixture', 'STOP if any non-QA row'
union all
select 11, 'non_qa_eligible_task_due',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'
           and not (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')),
       '0', 'STOP if > 0'
union all
select 12, 'existing_qa_cron_open',
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
           and title like '[QA CRON]%' and status = 'open'),
       '0', 'STOP if > 0 (retire before creating new fixture)'
union all
select 13, 'task_overdue_in_window',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() - interval '24 hours' and now() - interval '60 minutes'),
       '0', 'STOP if > 0 (review)'
union all
select 14, 'B_med_plausible_next_20m',
       (select count(*)::text from med_win),
       '0 rows', 'STOP/REVIEW if > 0 (medication_due would co-fire)'
union all
select 15, 'B_detail_redacted',
       (select coalesce(string_agg(schedule_id::text || ' ' || dose_date::text || ' ' || scheduled_time::text
                 || case when is_qa_circle then ' [QA]' else '' end, ' | ' order by dose_at), '(none)')
          from med_win),
       '(none)', 'lists any in-window med occurrences (redacted; no med name)'
union all
select 16, 'E_visits_plausible_window_60_80m',
       (select count(*)::text from vis_win),
       '0 rows', 'STOP/REVIEW if > 0 (visit_upcoming would co-fire)'
union all
select 17, 'E_detail_redacted',
       (select coalesce(string_agg(visit_id::text || ' ' || visit_date::text || ' '
                 || coalesce(start_time::text, '09:00') || case when is_qa_circle then ' [QA]' else '' end, ' | '), '(none)')
          from vis_win),
       '(none)', 'lists any in-window planned visits (redacted; no visitor name)'
union all
select 18, 'F_appointments_firing_next_window',
       (select count(*)::text from public.care_appointments a
         where a.status = 'scheduled'
           and ( a.starts_at between now() + interval '1440 minutes' and now() + interval '1460 minutes'
              or a.starts_at between now() + interval '60 minutes'   and now() + interval '80 minutes' )),
       '0', 'REVIEW if > 0'
union all
select 19, 'cron_job_regclass',
       coalesce(to_regclass('cron.job')::text, '(null: pg_cron not installed -> cron off)'),
       'null OR 0 Sanad jobs', 'STOP if pre-existing Sanad job'
order by ord;
```

**Conditional follow-up — run ONLY if row 19 `cron_job_regclass` is NOT null** (directly querying
`cron.job` errors when `pg_cron` is absent, so it is kept out of the main block):

```sql
-- CHECKPOINT 2 FOLLOW-UP — RUN ONLY IF cron_job_regclass IS NOT NULL. SELECT-only.
select jobid, jobname, schedule, active
from cron.job
where jobname like 'sanad-%'
   or command ilike '%enqueue-due-reminders%'
   or command ilike '%process-notification-outbox%'
   or command ilike '%check-push-receipts%'
order by jobid;
-- Expected: 0 rows. Any pre-existing Sanad notification job -> STOP.
```

### Expected values (PASS requires all)

| ord | check | expected | STOP if |
|-----|-------|----------|---------|
| 1 | pending_outbox | `0` | unexplained > 0 |
| 2 | outbox_summary | `fanned=2, skipped=1` (no pending) | unexplained pending |
| 3 | delivery_receipt_summary | `sent/ok=1, sent/unchecked=1` | new failed/skipped |
| 4 | processing_total | `0` | > 0 |
| 5 | stale_processing | `0` | > 0 |
| 6 | failed_deliveries | `0` | cluster |
| 7 | sent_pending_receipt_ge_15m | `0` | unexpected > 0 |
| 8 | owner_active_tokens | `1 active / 1 total` | 0 or >1 (unless accepted) |
| 9 | owner_token_detail_masked | android, `family_member`, active, `ExponentPushToken[***]` | remote_member/elder/inactive |
| 10 | task_due_next_20m | `(none)` | any non-QA row |
| 11 | non_qa_eligible_task_due | `0` | > 0 |
| 12 | existing_qa_cron_open | `0` | > 0 |
| 13 | task_overdue_in_window | `0` | > 0 |
| 14 | B_med_plausible_next_20m | `0 rows` | > 0 |
| 15 | B_detail_redacted | `(none)` | any row |
| 16 | E_visits_plausible_window_60_80m | `0 rows` | > 0 |
| 17 | E_detail_redacted | `(none)` | any row |
| 18 | F_appointments_firing_next_window | `0` | > 0 |
| 19 | cron_job_regclass | `null` | pre-existing Sanad job |

### Results

**Operator verdict: PASS.** The human operator ran the combined preflight in the Dashboard for
`qccgshanmoeybagxwvcs` and confirmed all gates met expectations — `pending_outbox=0`; outbox
`fanned=2, skipped=1`; deliveries `sent/ok=1, sent/unchecked=1`; `processing=0`; `stale=0`;
`failed=0`; one active owner token; no non-QA `task_due`; `existing_qa_cron_open=0`;
`task_overdue_in_window=0`; **`B=0`, `E=0`, `F=0`**; `cron_job_regclass=null`. The operator then
explicitly approved proceeding to **Checkpoint 3 (fixture creation only)** — with no cron, no Edge
invocation, no push, no receipt polling, no cron SQL, and no secrets.

> **Recording note (deviation — see §13):** the operator asserted PASS but did not paste the
> verbatim result grid into this record. The gate values above are as confirmed by the operator, not
> captured cell-by-cell. Since B/E/F are `now()`-sensitive, this preflight will be re-run
> immediately before cron enablement (Checkpoint 4) so the go/no-go rests on a fresh, captured snapshot.

---

## Checkpoint 3 — QA fixture creation ⏳ AWAITING OPERATOR

**Approval:** granted by operator (fixture creation via app UI only).

### Fixture to create (via app UI — Claude does not create it)

| Field | Value |
|-------|-------|
| Title (exact) | `[QA CRON] اختبار جدولة الإشعارات` |
| Circle | `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (رعاية الوالد الغالي) |
| Assigned to | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` (the owner / push recipient device) |
| Status | open (default for a new task) |
| Due date | **today**, circle-local (Asia/Riyadh, UTC+3) |
| Due time | **set explicitly** to ~10–12 min ahead of current Riyadh local time |
| Description / notes | leave empty / no sensitive content |

**Two important constraints:**

1. **RLS (who creates it):** `care_tasks` INSERT is restricted to `admin` / `primary_caregiver` of
   the circle. The owner (`a6dc7376…`, role `family_member`) **cannot self-create** the task. Create
   it from a **manager** account and **assign it to the owner** — exactly how `[QA PUSH]` /
   `[QA RECEIPT]` were made. The assignee must be an active member (the owner qualifies).
2. **Window (must set a due_time):** the producer raises `task_due` only when
   `dueAt ∈ [now, now+20m]`. A **date-only** task (no `due_time`) would instead fire at **09:00**
   circle-local — outside our window — so a `due_time` ~10–12 min ahead is required. Because cron is
   still off, after you create + verify we move to Checkpoint 4 (cron-enable approval); set the lead
   toward ~12 min and be ready to approve promptly so the due instant hasn't passed when the producer
   first runs. If it drifts out of window, we recreate the fixture.

### Verification SQL (SELECT-only — run AFTER creating the fixture)

```sql
-- 2F-10I CHECKPOINT 3 — QA FIXTURE VERIFICATION (SELECT-ONLY)
-- RUN IN SUPABASE DASHBOARD FOR PROJECT qccgshanmoeybagxwvcs, AFTER creating the fixture in the app UI.
-- No INSERT/UPDATE/DELETE/cron.*/net.http_post. No secrets. Returns ONE result grid (order by ord).
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
select 1 as ord, 'qa_cron_open_count' as check_name,
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
           and title like '[QA CRON]%' and status = 'open') as observed,
       '1' as expected, 'STOP if != 1' as note
union all
select 2, 'qa_cron_fixture_detail',
       (select coalesce(string_agg(
                 'assigned_to_owner=' || (t.assigned_to = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid)::text
                 || ' status=' || t.status::text
                 || ' due=' || t.due_date::text || coalesce(' ' || t.due_time::text, ' (NO TIME!)')
                 || ' mins_to_due=' || round(extract(epoch from (((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) - now())) / 60.0)::text
                 || ' in_20m_window=' || ((((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)) between now() and now() + interval '20 minutes')::text,
                 ' | ' order by t.created_at desc), '(no open QA fixture)')
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
           and t.title like '[QA CRON]%' and t.status = 'open'),
       'assigned_to_owner=true, in_20m_window=true, mins_to_due~8-12', 'STOP if not owner or not in window'
union all
select 3, 'task_due_next_20m_total',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'),
       '1', 'STOP if != 1 (exactly the QA fixture)'
union all
select 4, 'task_due_next_20m_qa',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'
           and t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
           and t.title like '[QA CRON]%'),
       '1', 'STOP if != 1'
union all
select 5, 'non_qa_eligible_task_due',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'
           and not (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')),
       '0', 'STOP if > 0'
union all
select 6, 'B_med_plausible_next_20m', (select count(*)::text from med_win), '0', 'STOP/REVIEW if > 0'
union all
select 7, 'E_visits_plausible_window_60_80m', (select count(*)::text from vis_win), '0', 'STOP/REVIEW if > 0'
union all
select 8, 'F_appointments_firing_next_window',
       (select count(*)::text from public.care_appointments a
         where a.status = 'scheduled'
           and ( a.starts_at between now() + interval '1440 minutes' and now() + interval '1460 minutes'
              or a.starts_at between now() + interval '60 minutes'   and now() + interval '80 minutes' )),
       '0', 'REVIEW if > 0'
order by ord;
```

### Expected (all must hold to continue)

| ord | check | expected |
|-----|-------|----------|
| 1 | qa_cron_open_count | `1` |
| 2 | qa_cron_fixture_detail | `assigned_to_owner=true`, `in_20m_window=true`, `mins_to_due` ~8–12 |
| 3 | task_due_next_20m_total | `1` |
| 4 | task_due_next_20m_qa | `1` |
| 5 | non_qa_eligible_task_due | `0` |
| 6 | B_med_plausible_next_20m | `0` |
| 7 | E_visits_plausible_window_60_80m | `0` |
| 8 | F_appointments_firing_next_window | `0` |

### Results

**Operator verdict: PASS.** The fixture was created in the app UI and the verification confirmed
exactly one open `[QA CRON]` fixture, in-window, assigned to the owner, with no non-QA `task_due`
and B/E/F still empty.

- **Fixture task id:** `a72be14c-bed7-4cd3-866d-d64aa6512351`
- **Title:** `[QA CRON] اختبار جدولة الإشعارات`

---

## Checkpoint 4 — Cron enablement 🛑 BLOCKED (STOP)

**Outcome: BLOCKED — the cron smoke-test cannot proceed through cron in this phase.**

Checkpoint 2 established `cron_job_regclass = null`: the **`pg_cron` extension is not installed / not
visible** in project `qccgshanmoeybagxwvcs`, and `pg_net` (which pg_cron would use to call the Edge
endpoints) is likewise not established. The 2F-10I execution plan states: **if pg_cron / pg_net are
not available, STOP and record that execution cannot proceed through cron.**

Per that gate, execution halts **before** any cron enablement. Consistent with the standing
constraints, Claude did **not** (and will not): enable cron, create the `pg_cron` or `pg_net`
extension, run `cron.schedule` / `cron.unschedule`, invoke any Edge Function, send any push, or poll
receipts. **No enable SQL was authored** — authoring was gated behind approval **and** availability,
and availability is not met.

**Decision:** proceed to a controlled safe-stop + cleanup (Checkpoint 9), then close this phase as
**STOPPED / BLOCKED BEFORE CRON ENABLEMENT**.

---

## Checkpoint 5 — Producer / processor evidence ⛔ N/A
Not reached — the producer/processor were never triggered (cron blocked; no Edge invocation).

## Checkpoint 6 — Android push confirmation ⛔ N/A
Not reached — no push was ever sent.

## Checkpoint 7 — Receipt checker (≥15m) ⛔ N/A
Not reached — no delivery/ticket exists to poll.

## Checkpoint 8 — Cron disable ⛔ N/A
Nothing to disable — no cron job was ever created.

---

## Checkpoint 9 — Fixture cleanup (safe stop) ✅ PASS (cleanup verified)

**QA fixture created in Checkpoint 3 (to be retired):**

- task id: `a72be14c-bed7-4cd3-866d-d64aa6512351`
- title: `[QA CRON] اختبار جدولة الإشعارات`

**Action requested of operator:** complete (mark done) — or cancel — the fixture **through the app
UI** so it is no longer `open` and can never fire a `task_due` later. Completing it (status
`completed`) matches the prior QA cleanup path.

### Cleanup verification SQL (SELECT-only — run AFTER retiring the fixture)

```sql
-- 2F-10I CHECKPOINT 9 — SAFE-STOP CLEANUP VERIFICATION (SELECT-ONLY)
-- RUN IN SUPABASE DASHBOARD FOR PROJECT qccgshanmoeybagxwvcs, AFTER completing/cancelling the
-- [QA CRON] fixture (task a72be14c-bed7-4cd3-866d-d64aa6512351) in the app UI.
-- No INSERT/UPDATE/DELETE/cron.*/net.http_post. No secrets. Returns ONE result grid (order by ord).
select 1 as ord, 'qa_fixture_status' as check_name,
       (select coalesce(string_agg('status=' || status::text
                 || ' completed_at=' || coalesce(completed_at::text, '-')
                 || ' cancelled_at=' || coalesce(cancelled_at::text, '-'), ' | '), '(task not found)')
          from public.care_tasks where id = 'a72be14c-bed7-4cd3-866d-d64aa6512351'::uuid) as observed,
       'status=completed or cancelled (NOT open)' as expected, 'STOP if still open' as note
union all
select 2, 'existing_qa_cron_open',
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
           and title like '[QA CRON]%' and status = 'open'),
       '0', 'STOP if > 0'
union all
select 3, 'pending_outbox',
       (select count(*)::text from public.notification_outbox where status = 'pending'),
       '0', 'STOP if > 0'
union all
select 4, 'outbox_summary',
       (select coalesce(string_agg(status::text || '=' || c::text, ', ' order by status), '(none)')
          from (select status, count(*) c from public.notification_outbox group by status) s),
       'fanned=2, skipped=1 (unchanged baseline)', 'STOP if changed'
union all
select 5, 'delivery_receipt_summary',
       (select coalesce(string_agg(status::text || '/' || coalesce(receipt_status, '(null)') || '=' || c::text, ', '
                 order by status, coalesce(receipt_status, '(null)')), '(none)')
          from (select status, receipt_status, count(*) c
                  from public.notification_push_deliveries group by status, receipt_status) s),
       'sent/ok=1, sent/unchecked=1 (unchanged baseline)', 'STOP if changed'
union all
select 6, 'notifs_referencing_fixture',
       (select count(*)::text from public.notifications n
         where n.data::text ilike '%a72be14c-bed7-4cd3-866d-d64aa6512351%'
            or coalesce(n.dedupe_key, '') ilike '%a72be14c-bed7-4cd3-866d-d64aa6512351%'),
       '0', 'STOP if > 0 (a notification was produced from the fixture)'
union all
select 7, 'recent_task_due_notifs_3h',
       (select count(*)::text from public.notifications
         where type = 'task_due' and created_at > now() - interval '3 hours'),
       '0', 'STOP if > 0'
union all
select 8, 'outbox_rows_referencing_fixture',
       (select count(*)::text from public.notification_outbox o
          join public.notifications n on n.id = o.notification_id
         where n.data::text ilike '%a72be14c-bed7-4cd3-866d-d64aa6512351%'
            or coalesce(n.dedupe_key, '') ilike '%a72be14c-bed7-4cd3-866d-d64aa6512351%'),
       '0', 'STOP if > 0'
union all
select 9, 'deliveries_created_last_3h',
       (select count(*)::text from public.notification_push_deliveries
         where created_at > now() - interval '3 hours'),
       '0', 'STOP if > 0 (a push delivery was created)'
union all
select 10, 'cron_job_regclass',
       coalesce(to_regclass('cron.job')::text, '(null: pg_cron not installed -> cron off)'),
       'null (cron off; no Sanad jobs)', 'STOP if non-null with a Sanad job'
order by ord;
```

### Expected (all must hold)

| ord | check | expected |
|-----|-------|----------|
| 1 | qa_fixture_status | `status=completed` (or `cancelled`), NOT `open` |
| 2 | existing_qa_cron_open | `0` |
| 3 | pending_outbox | `0` |
| 4 | outbox_summary | `fanned=2, skipped=1` (unchanged) |
| 5 | delivery_receipt_summary | `sent/ok=1, sent/unchecked=1` (unchanged) |
| 6 | notifs_referencing_fixture | `0` |
| 7 | recent_task_due_notifs_3h | `0` |
| 8 | outbox_rows_referencing_fixture | `0` |
| 9 | deliveries_created_last_3h | `0` |
| 10 | cron_job_regclass | `null` |

### Results

**Operator verdict: PASS.** The fixture `a72be14c-…` was **completed** via the app UI and a
SELECT-only cleanup verification (v2) confirmed the safe stop.

> **Note (v1 SQL failed safely — see §13):** the operator's first cleanup query errored because it
> referenced a non-existent column `notifications.source_id`. A failed `SELECT` performs **no
> mutation**, so nothing changed. It was replaced by a SELECT-only **v2** cleanup verification, which
> passed. (In this schema the notification→entity linkage is via `notifications.data` / `dedupe_key`,
> not a `source_id` column.)

Recorded v2 results (verbatim from operator):

| ord | check | observed | expected | verdict |
| --- | ----- | -------- | -------- | ------- |
| 1 | target_task_status | `id=a72be14c-bed7-4cd3-866d-d64aa6512351 status=completed title_is_qa=true assigned_to=a6dc7376-fd9d-461f-9d14-41eabcd3f538 updated_at=2026-07-09 03:26:59.800354+00` | status not open, preferably completed | ✅ |
| 2 | target_task_is_still_open | `NO` | `NO` | ✅ |
| 3 | open_qa_cron_count | `0` | `0` | ✅ |
| 4 | pending_outbox | `0` | `0` | ✅ |
| 5 | processing_deliveries | `0` | `0` | ✅ |
| 6 | recent_notifications_last_2h_by_type | `(none)` | `(none)` for stopped run | ✅ |
| 7 | recent_outbox_last_2h_by_type_status | `(none)` | `(none)` for stopped run | ✅ |
| 8 | recent_deliveries_last_2h_by_status | `(none)` | `(none)` for stopped run | ✅ |
| 9 | cron_job_regclass | `(null: pg_cron not installed -> cron off)` | null OR 0 Sanad jobs | ✅ |

**Assessment:** the fixture is retired (`completed`, no longer open); no open `[QA CRON]` remains;
`pending_outbox=0`; no processing deliveries; **no new notifications / outbox / deliveries in the
last 2h** (nothing was produced from the stopped run); cron remains off. **Cleanup PASS.**

---

## Checkpoint 10 — Final report ✅

### 1. Executive summary

Phase 2F-10I was the first controlled, human-in-the-loop attempt at the cron smoke test of the
`task_due` notification chain. Checkpoints 1–3 passed: clean local baseline; clean last-minute
read-only preflight (including the `now()`-sensitive **B/E/F = 0**); and a QA fixture created + verified
in the 20-minute producer window. At **Checkpoint 4 the run was BLOCKED before cron enablement**: the
preflight (and the cleanup re-check) showed `cron_job_regclass = null` — `pg_cron` is not installed /
not visible in project `qccgshanmoeybagxwvcs`, and `pg_net` (which pg_cron would use to call the Edge
endpoints) is not established — so there is no mechanism to schedule the producer/processor/receipt
Edge calls. Per the 2F-10I plan's explicit gate, execution stopped and moved to a controlled
safe-stop: the QA fixture was completed via the app UI and a SELECT-only verification confirmed
nothing was produced from the run and the baseline is intact. **No cron was created, no Edge Function
invoked, no push sent, no receipts polled, no secrets touched.**

### 2. Exact approvals obtained

- **CP2 (SQL / read-only preflight):** operator approved, ran it in the Dashboard, confirmed PASS.
- **CP3 (QA fixture creation via app UI):** operator explicitly approved; created and verified.
- **CP4 (cron enablement):** **not approved / not reached** — operator invoked the STOP gate on
  `pg_cron` absence and directed a safe stop.
- **CP9 (cleanup):** operator approved, completed the fixture via app UI, ran the SELECT-only v2
  verification, confirmed PASS.
- No approval was given or requested for cron enablement, Edge invocation, push, or receipt polling
  (all N/A).

### 3. Preflight results (Checkpoint 2)

Operator-confirmed **PASS**: `pending_outbox=0`; outbox `fanned=2, skipped=1`; deliveries
`sent/ok=1, sent/unchecked=1`; `processing=0`; `stale=0`; `failed=0`; one active owner token
(android / `family_member` / active); no non-QA `task_due`; `existing_qa_cron_open=0`;
`task_overdue=0`; **`B=0`, `E=0`, `F=0`**; `cron_job_regclass=null`. (Verbatim grid not captured —
see §13.)

### 4. Fixture evidence (Checkpoint 3)

Created via app UI — task `a72be14c-bed7-4cd3-866d-d64aa6512351`, title
`[QA CRON] اختبار جدولة الإشعارات`, QA circle `ae4721d8-…`, assigned to owner `a6dc7376-…`, status
open, due within the 20-minute producer window. Verification confirmed **exactly one** open
`[QA CRON]`, in-window, assigned to the owner, `non_qa_eligible_task_due=0`, and **B/E/F still 0**.

### 5. Cron enable evidence

**N/A — cron was never enabled.** `cron_job_regclass=null` (pg_cron / pg_net unavailable). No enable
SQL was authored, no `cron.schedule` was run, no job was created.

### 6. Producer evidence

**N/A** — `enqueue-due-reminders` was never triggered.

### 7. Processor / delivery evidence

**N/A** — `process-notification-outbox` was never triggered; no outbox row or delivery was produced
from the fixture (confirmed by the CP9 cleanup checks).

### 8. OS push evidence

**N/A** — no push was sent; there was nothing to confirm on the device.

### 9. Receipt evidence

**N/A** — no ticket/delivery existed to poll; `check-push-receipts` was never triggered.

### 10. Disable evidence

**N/A** — nothing to disable; no cron job ever existed.

### 11. Cleanup evidence (Checkpoint 9)

Fixture `a72be14c-…` **completed** via the app UI (`status=completed`,
`updated_at=2026-07-09 03:26:59.800354+00`). SELECT-only **v2** cleanup verification **PASS**: task no
longer open; `open_qa_cron_count=0`; `pending_outbox=0`; `processing_deliveries=0`; **no new
notifications / outbox / deliveries in the last 2h**; `cron_job_regclass=null`. (The v1 cleanup query
failed safely on a non-existent `notifications.source_id` column — a failed `SELECT` mutates nothing
— and was replaced by the v2 query, which passed.)

### 12. Final state

- **Checkpoint 1 PASS · 2 PASS · 3 PASS · 4 BLOCKED (before cron enablement) · 5–8 N/A · 9 PASS.**
- **No cron job was created;** nothing needed disabling.
- **Fixture completed** (retired; no longer open).
- `pending_outbox=0`; outbox `fanned=2, skipped=1`; deliveries `sent/ok=1, sent/unchecked=1` —
  **baseline unchanged**.
- **No new notifications / outbox / deliveries** from the stopped run; **no push sent**.
- **No secrets touched;** no Edge invocation; no Supabase CLI; no SQL run by Claude; no DB connection
  by Claude.
- Repo: only this 2F-10I report was written (untracked); **no** app / Edge / migration / generated-type
  changes; **no commit / no stage**.

### 13. Deviations / incidents

1. **CP2 grid not captured verbatim.** The operator asserted PASS without pasting the raw result
   grid. Mitigated by: (a) the CP9 cleanup re-check showing the baseline intact, and (b) the fact
   that the `now()`-sensitive B/E/F gates are always re-validated immediately before any enable step
   (which was never reached).
2. **Blocking condition (designed gate, not a defect).** `pg_cron` / `pg_net` are not installed /
   not visible in `qccgshanmoeybagxwvcs`, so cron cannot be scheduled. This is exactly the plan's
   pre-defined STOP for "pg_cron/pg_net not available."
3. **v1 cleanup SQL error (safe).** The operator's first cleanup query referenced a non-existent
   `notifications.source_id` column and errored. Being a `SELECT`, it performed **no mutation**; it
   was replaced by the SELECT-only v2 query, which passed.

### 14. Final verdict

**STOPPED / BLOCKED BEFORE CRON ENABLEMENT.**

**Reason:** `pg_cron` is not installed / not visible in `qccgshanmoeybagxwvcs`, so the cron smoke test
could not proceed through cron in 2F-10I. The safe stop and cleanup completed cleanly with the
baseline intact and no side effects.

**Recommendation (do NOT create now):** a later planning phase
**`2F-10J — pg_cron / pg_net availability planning, no execution`** to determine whether and how to
establish the `pg_cron` + `pg_net` scheduling substrate (or an approved alternative scheduler /
one-shot supervised invocation path) before re-attempting the smoke test. When that path exists, the
smoke test resumes from a fresh last-minute preflight (re-running B/E/F immediately before enable).

### 15. Validation results

Local, read-only checks only (no Supabase CLI, no SQL, no DB, no deploy, no invocation):

```
$ npm run check:mojibake
> sanad-mobile@1.0.0 check:mojibake
> node ./scripts/check-mojibake.js
check:mojibake - scanned 266 active source/config file(s).
No strong mojibake signatures found in active source/config.
(exit 0)

$ git -c core.autocrlf=false diff --check
(no output; exit 0)

$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10i-cron-smoke-test-execution-record.md

$ git --no-pager diff --stat
(empty — no tracked-file changes)
```

All four checks pass: no mojibake, no whitespace/conflict errors, and the only change is the single
untracked 2F-10I report (no tracked files modified, staged, or committed).
