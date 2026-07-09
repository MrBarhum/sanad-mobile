# Phase 2F-10L — SQL/Vault cron job creation approval (execution record, human-in-the-loop)

- **Date:** 2026-07-08
- **Phase:** 2F-10L — SQL/Vault cron job creation, explicitly approved
- **Status:** ✅ **PASS** — SQL/Vault cron substrate created and verified with no observed side effects. Fixture + push/receipt smoke test deferred to **2F-10M**.
- **Baseline commit (after 2F-10K):** `aca0815 docs(product): decide secure cron setup path`
- **Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`
- **QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (رعاية الوالد الغالي)
- **Owner / recipient user:** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`

---

## Execution model

- **Claude** guides the sequence, authors reviewed SQL, assesses pasted results, writes this report.
- **The human operator** runs every statement manually in the Supabase Dashboard.
- **Claude does NOT:** run Supabase CLI, run/connect SQL, invoke Edge Functions, run
  `CREATE EXTENSION` / `cron.schedule` / `cron.unschedule` / `net.http_post`, send push, deploy, read
  or print secret values, or modify app/Edge/migrations/types.
- **Secret discipline:** `NOTIFICATIONS_CRON_SECRET` is **only** referenced by name and read from
  **Vault at runtime**; its plaintext is never entered, printed, or stored in a job command. The
  stored `cron.job.command` is never selected/printed back.
- **Strict checkpoints:** Claude stops at each checkpoint and does not continue until the human pastes
  results and **explicitly approves**. Each risky action is approved separately.

---

## Checkpoint progress log

| CP | Action | Requires human | Status |
|----|--------|----------------|--------|
| 1 | Local baseline | no (Claude local) | ✅ PASS |
| 2 | Final read-only pre-job preflight | **approval + run + paste** | ✅ PASS |
| 3 | Author disable/rollback path first | confirm understanding | ✅ CONFIRMED |
| 4 | pg_cron enablement | **approval + run + paste** | ✅ PASS |
| 5 | Create 3 cron jobs | **approval + run** | ✅ PASS (3 jobs created) |
| 6 | Post-creation verification | **run + paste** | ✅ PASS |
| 7 | Decision after substrate creation | no | ✅ done |

---

## Checkpoint 1 — Local baseline ✅ PASS

```
$ npm run check:mojibake        → scanned 266 files; no mojibake (exit 0)
$ git -c core.autocrlf=false diff --check   → (no output; exit 0)
$ git --no-pager status -sb     → ## master...origin/master
$ git --no-pager log --oneline -5
aca0815 docs(product): decide secure cron setup path
5286182 docs(product): plan cron substrate availability
7337d33 docs(product): record blocked cron smoke test execution
7bcef43 docs(product): finalize cron smoke test approval plan
7433d82 docs(product): record med visit cron preflight results
```

**Assessment:** working tree clean, in sync with origin; HEAD is the expected 2F-10K baseline
`aca0815`. **PASS.**

---

## Checkpoint 2 — Final read-only pre-job preflight ✅ PASS

One combined **SELECT-only** statement returning a single labeled grid. It verifies the substrate
(pg_net installed + `net.http_post` visible; pg_cron available/not-installed or installed-with-no-Sanad-jobs),
Vault (schema + `vault.decrypted_secrets` + secret present **by name only**), and the notification
engine baseline (outbox / deliveries / tokens / task_due / task_overdue / **B/E/F**).

**Rules honored:** SELECT-only; no `CREATE`/`ALTER`/`cron.*`/`net.http_post`; the Expo token is masked;
**no secret value is selected** (only a by-name count of the Vault secret).

```sql
-- 2F-10L CHECKPOINT 2 — FINAL READ-ONLY PRE-JOB PREFLIGHT (SELECT-ONLY)
-- RUN IN SUPABASE DASHBOARD SQL EDITOR FOR PROJECT qccgshanmoeybagxwvcs, AFTER APPROVAL.
-- No CREATE/ALTER/cron.*/net.http_post. No secret VALUE selected. Returns ONE grid (order by ord).
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
select 1 as ord, 'pg_net_installed' as check_name,
       (select coalesce(string_agg('v' || extversion, '; '), '(not installed)') from pg_extension where extname = 'pg_net') as observed,
       'expect installed (e.g. v0.20.3)' as expected
union all
select 2, 'fn_net_http_post_visible',
       (select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'net' and p.proname = 'http_post') then 'yes' else 'no' end),
       'yes'
union all
select 3, 'pg_cron_available',
       (select coalesce(string_agg('default=' || default_version || ' installed=' || coalesce(installed_version, '(none)'), '; '), '(not listed)')
          from pg_available_extensions where name = 'pg_cron'),
       'listed (default=1.6.4)'
union all
select 4, 'pg_cron_installed',
       (select coalesce(string_agg('v' || extversion, '; '), '(not installed)') from pg_extension where extname = 'pg_cron'),
       '(not installed) OR installed with 0 Sanad jobs'
union all
select 5, 'cron_job_regclass',
       coalesce(to_regclass('cron.job')::text, '(null)'),
       '(null) now; if non-null run follow-up and confirm 0 Sanad jobs'
union all
select 6, 'schema_vault_exists',
       (select case when exists (select 1 from pg_namespace where nspname = 'vault') then 'yes' else 'no' end),
       'yes'
union all
select 7, 'vault_decrypted_secrets_regclass',
       coalesce(to_regclass('vault.decrypted_secrets')::text, '(null)'),
       'vault.decrypted_secrets'
union all
select 8, 'vault_secrets_regclass',
       coalesce(to_regclass('vault.secrets')::text, '(null)'),
       'vault.secrets'
union all
select 9, 'secret_count_by_name',
       (select count(*)::text from vault.secrets where name = 'NOTIFICATIONS_CRON_SECRET'),
       '1 (by name only; value never selected)'
union all
select 10, 'pending_outbox',
       (select count(*)::text from public.notification_outbox where status = 'pending'),
       '0'
union all
select 11, 'processing_total',
       (select count(*)::text from public.notification_push_deliveries where status = 'processing'),
       '0'
union all
select 12, 'stale_processing',
       (select count(*)::text from public.notification_push_deliveries
         where status = 'processing' and locked_at < now() - make_interval(secs => 600)),
       '0'
union all
select 13, 'failed_deliveries',
       (select count(*)::text from public.notification_push_deliveries where status = 'failed'),
       '0'
union all
select 14, 'owner_active_tokens',
       (select (count(*) filter (where is_active))::text || ' active / ' || count(*)::text || ' total'
          from public.push_tokens where user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid),
       '1 active / 1 total'
union all
select 15, 'owner_token_detail_masked',
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
       'android / family_member / active / ExponentPushToken[***]'
union all
select 16, 'existing_qa_cron_open',
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and title like '[QA CRON]%' and status = 'open'),
       '0'
union all
select 17, 'task_due_next_20m',
       (select coalesce(string_agg(
                 case when (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')
                      then 'QA:' || t.title else 'non-QA(redacted)' end, ' | '), '(none)')
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'),
       '(none)'
union all
select 18, 'non_qa_eligible_task_due',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'
           and not (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')),
       '0'
union all
select 19, 'task_overdue_in_window',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() - interval '24 hours' and now() - interval '60 minutes'),
       '0'
union all
select 20, 'B_med_plausible_next_20m', (select count(*)::text from med_win), '0'
union all
select 21, 'E_visits_plausible_window_60_80m', (select count(*)::text from vis_win), '0'
union all
select 22, 'F_appointments_firing_next_window',
       (select count(*)::text from public.care_appointments a
         where a.status = 'scheduled'
           and ( a.starts_at between now() + interval '1440 minutes' and now() + interval '1460 minutes'
              or a.starts_at between now() + interval '60 minutes'   and now() + interval '80 minutes' )),
       '0'
order by ord;
```

**Conditional follow-up — run ONLY if row 5 `cron_job_regclass` is NOT null** (do not print the
command, which could carry a secret):

```sql
-- RUN ONLY IF cron_job_regclass IS NOT NULL. SELECT-only. Detect pre-existing Sanad jobs.
select jobid, jobname, schedule, active,
       ( command ilike '%enqueue-due-reminders%' or command ilike '%process-notification-outbox%'
      or command ilike '%check-push-receipts%' or command ilike '%check-missed-doses%' or jobname ilike 'sanad-%' ) as targets_sanad
from cron.job order by jobid;
-- Expected: 0 rows / 0 targets_sanad. Any pre-existing Sanad job -> STOP.
```

### Results — operator verdict: PASS

Grid pasted by the operator (verbatim). No follow-up `cron.job` query was run because
`cron_job_regclass` is null.

| ord | check | observed | verdict |
| --- | ----- | -------- | ------- |
| 1 | pg_net_installed | `v0.20.3` | ✅ |
| 2 | fn_net_http_post_visible | `yes` | ✅ |
| 3 | pg_cron_available | `default=1.6.4 installed=(none)` | ✅ |
| 4 | pg_cron_installed | `(not installed)` | ✅ |
| 5 | cron_job_regclass | `(null)` | ✅ (no pre-existing cron; follow-up not needed) |
| 6 | schema_vault_exists | `yes` | ✅ |
| 7 | vault_decrypted_secrets_regclass | `vault.decrypted_secrets` | ✅ |
| 8 | vault_secrets_regclass | `vault.secrets` | ✅ |
| 9 | secret_count_by_name | `1` | ✅ (by name only; value never selected) |
| 10 | pending_outbox | `0` | ✅ |
| 11 | processing_total | `0` | ✅ |
| 12 | stale_processing | `0` | ✅ |
| 13 | failed_deliveries | `0` | ✅ |
| 14 | owner_active_tokens | `1 active / 1 total` | ✅ |
| 15 | owner_token_detail_masked | `platform=android active=true role=family_member membership=active token=ExponentPushToken[***]` | ✅ |
| 16 | existing_qa_cron_open | `0` | ✅ |
| 17 | task_due_next_20m | `(none)` | ✅ |
| 18 | non_qa_eligible_task_due | `0` | ✅ |
| 19 | task_overdue_in_window | `0` | ✅ |
| 20 | B_med_plausible_next_20m | `0` | ✅ |
| 21 | E_visits_plausible_window_60_80m | `0` | ✅ |
| 22 | F_appointments_firing_next_window | `0` | ✅ |

**Assessment:** substrate ready (pg_net installed, `net.http_post` visible, pg_cron available-but-not-installed,
no pre-existing cron), Vault confirmed (schema + decrypt view + the secret present **by name**), and
the notification engine baseline is clean including **B/E/F = 0**. **PASS.**

---

## Checkpoint 3 — Disable / rollback path ⏳ AWAITING CONFIRM

The rollback path is authored **before** any creation SQL. It targets **only** job names starting
`sanad-`, uses `cron.unschedule` by jobname, and never touches any non-Sanad job. `cron.unschedule`
**removes** the job row, so after running it the Sanad jobs are gone (a clean rollback).

> **DO NOT RUN UNTIL JOBS EXIST / DISABLE ONLY.** These require `pg_cron` (schema `cron`) to be
> installed, and are meant to be run to **stop/remove** the Sanad jobs — not during setup.

**Primary rollback — unschedule all `sanad-` jobs (safe, idempotent, Sanad-only):**

```sql
-- 2F-10L DISABLE / ROLLBACK — DO NOT RUN UNTIL JOBS EXIST / DISABLE ONLY.
-- Unschedules ONLY jobs whose jobname starts with 'sanad-'. Never matches a non-Sanad job.
-- Idempotent: a sanad- job that is absent is simply not matched (no error, no effect).
select jobname, cron.unschedule(jobname) as unscheduled
from cron.job
where jobname like 'sanad-%'
order by jobname;
-- Returns one row per removed sanad- job. 0 rows => nothing matched (already clean).
```

**Explicit per-name form (alternative — run individually only for jobs that exist):**

```sql
-- 2F-10L DISABLE / ROLLBACK (per-name) — DO NOT RUN UNTIL JOBS EXIST / DISABLE ONLY.
-- NOTE: cron.unschedule(<name>) errors if that job does not exist; prefer the set-based form above.
select cron.unschedule('sanad-enqueue-due-reminders');
select cron.unschedule('sanad-process-notification-outbox');
select cron.unschedule('sanad-check-push-receipts');
```

**Disable verification — SELECT-only, Sanad metadata only (no command, no secrets):**

```sql
-- 2F-10L DISABLE VERIFICATION — SELECT-only. Lists ONLY Sanad job metadata (never `command`).
select jobid, jobname, schedule, active
from cron.job
where jobname like 'sanad-%'
order by jobid;
-- After a full disable: expect 0 rows (all sanad- jobs removed).
```

**Optional pause-without-remove (if you want to halt but keep the definitions):**

```sql
-- 2F-10L PAUSE (optional) — DO NOT RUN UNTIL JOBS EXIST. Deactivates Sanad jobs without deleting.
update cron.job set active = false where jobname like 'sanad-%';
-- Re-enable later with active = true. (cron.unschedule above is the canonical, cleaner rollback.)
```

**Safety properties:** every statement is scoped by `jobname like 'sanad-%'`, so no non-Sanad job is
affected; the verification never selects `command` (which would carry the Vault-lookup / could carry a
secret); no secret value appears anywhere.

### Confirmation

**Operator confirmed understanding** of the disable/rollback path (Sanad-scoped `cron.unschedule`;
verification lists only `jobid` / `jobname` / `schedule` / `active`; `command` never printed; no
secrets; non-Sanad jobs untouched) and **explicitly approved Checkpoint 4 (pg_cron enablement +
verification) only**.

## Checkpoint 4 — pg_cron enablement ✅ PASS

**Approval:** granted (pg_cron enablement + verification only). This installs `pg_cron` and creates
the `cron` schema (`cron.job`, `cron.schedule`, `cron.unschedule`, `cron.job_run_details`). **It
creates NO jobs.** No secret is involved.

**Enablement SQL:**

```sql
-- 2F-10L CHECKPOINT 4 — pg_cron ENABLEMENT. RUN IN DASHBOARD FOR qccgshanmoeybagxwvcs.
-- Installs pg_cron and its `cron` schema objects. Creates NO cron jobs. No secret involved.
create extension if not exists pg_cron;
```

> On Supabase, `pg_cron` is pre-loaded at the platform level, so `create extension` succeeds. If this
> statement errors (e.g. a `shared_preload_libraries` message or a permissions error) → **STOP** and
> instead enable `pg_cron` via **Dashboard → Database → Extensions** (toggle `pg_cron` on), then run
> the verification below. Do **not** proceed to job creation until verification passes.

**Verification (SELECT-only) — run after enablement:**

```sql
-- 2F-10L CHECKPOINT 4 — pg_cron VERIFICATION (SELECT-only). Returns ONE grid.
select 1 as ord, 'pg_cron_installed' as check_name,
       (select coalesce(string_agg('v' || extversion, '; '), '(not installed)') from pg_extension where extname = 'pg_cron') as observed,
       'installed (e.g. v1.6)' as expected
union all
select 2, 'schema_cron_exists',
       (select case when exists (select 1 from pg_namespace where nspname = 'cron') then 'yes' else 'no' end), 'yes'
union all
select 3, 'cron_job_regclass', coalesce(to_regclass('cron.job')::text, '(null)'), 'cron.job'
union all
select 4, 'cron_job_run_details_regclass', coalesce(to_regclass('cron.job_run_details')::text, '(null)'), 'cron.job_run_details (if available)'
union all
select 5, 'fn_cron_schedule_visible',
       (select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'cron' and p.proname = 'schedule') then 'yes' else 'no' end), 'yes'
union all
select 6, 'fn_cron_unschedule_visible',
       (select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'cron' and p.proname = 'unschedule') then 'yes' else 'no' end), 'yes'
order by ord;
```

**Then confirm there are still no Sanad jobs (SELECT-only, run after the grid confirms `cron.job` exists):**

```sql
-- Expected: 0. Any Sanad job here before we create ours -> STOP.
select count(*) as existing_sanad_jobs from cron.job where jobname like 'sanad-%';
```

**Expected:** `pg_cron_installed = v1.6.x` · `schema_cron_exists = yes` · `cron_job_regclass = cron.job`
· `cron_job_run_details_regclass = cron.job_run_details` (if the platform exposes it) ·
`fn_cron_schedule_visible = yes` · `fn_cron_unschedule_visible = yes` · `existing_sanad_jobs = 0`.

If enablement fails or verification does not show `cron.schedule` / `cron.unschedule` visible →
**STOP** and record the blocker; **do not create jobs**.

### Results — operator verdict: PASS

Operator ran `create extension if not exists pg_cron;`. Verification (verbatim):

| check | observed | verdict |
| ----- | -------- | ------- |
| pg_cron_installed | `v1.6.4` | ✅ |
| schema_cron_exists | `yes` | ✅ |
| cron_job_regclass | `cron.job` | ✅ |
| cron_job_run_details_regclass | `cron.job_run_details` | ✅ |
| fn_cron_schedule_visible | `yes` | ✅ |
| fn_cron_unschedule_visible | `yes` | ✅ |
| existing_sanad_jobs | `0` | ✅ |

**Assessment:** `pg_cron` is installed and functional; the `cron.schedule` / `cron.unschedule`
functions (the create + disable path) are visible; `cron.job_run_details` is available for run
observability; no pre-existing Sanad jobs. **PASS.**

## Checkpoint 5 — Cron job creation ⏳ AWAITING (last-minute preflight)

Because creating the jobs on `*/5` / `*/15` schedules means the producer may run within minutes, a
**last-minute pre-creation preflight** must pass **immediately before** creation. `pg_cron` is now
installed, so `cron.job` is referenced directly here.

### 5a. Last-minute pre-creation preflight (SELECT-only)

```sql
-- 2F-10L CHECKPOINT 5a — LAST-MINUTE PRE-CREATION PREFLIGHT (SELECT-ONLY)
-- RUN IN DASHBOARD FOR qccgshanmoeybagxwvcs IMMEDIATELY BEFORE creating the jobs.
-- No CREATE/ALTER/cron.schedule/cron.unschedule/net.http_post. No secret VALUE selected. ONE grid.
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
       'installed (v1.6.4)' as expected
union all
select 2, 'fn_cron_schedule_visible',
       (select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'cron' and p.proname = 'schedule') then 'yes' else 'no' end), 'yes'
union all
select 3, 'fn_cron_unschedule_visible',
       (select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'cron' and p.proname = 'unschedule') then 'yes' else 'no' end), 'yes'
union all
select 4, 'pg_net_installed',
       (select coalesce(string_agg('v' || extversion, '; '), '(not installed)') from pg_extension where extname = 'pg_net'), 'installed (v0.20.3)'
union all
select 5, 'fn_net_http_post_visible',
       (select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'net' and p.proname = 'http_post') then 'yes' else 'no' end), 'yes'
union all
select 6, 'existing_sanad_jobs',
       (select count(*)::text from cron.job where jobname like 'sanad-%'), '0'
union all
select 7, 'secret_count_by_name',
       (select count(*)::text from vault.secrets where name = 'NOTIFICATIONS_CRON_SECRET'), '1'
union all
select 8, 'pending_outbox',
       (select count(*)::text from public.notification_outbox where status = 'pending'), '0'
union all
select 9, 'processing_total',
       (select count(*)::text from public.notification_push_deliveries where status = 'processing'), '0'
union all
select 10, 'stale_processing',
       (select count(*)::text from public.notification_push_deliveries
         where status = 'processing' and locked_at < now() - make_interval(secs => 600)), '0'
union all
select 11, 'failed_deliveries',
       (select count(*)::text from public.notification_push_deliveries where status = 'failed'), '0'
union all
select 12, 'owner_active_tokens',
       (select (count(*) filter (where is_active))::text || ' active / ' || count(*)::text || ' total'
          from public.push_tokens where user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid), '1 active / 1 total'
union all
select 13, 'existing_qa_cron_open',
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and title like '[QA CRON]%' and status = 'open'), '0'
union all
select 14, 'task_due_next_20m',
       (select coalesce(string_agg(
                 case when (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')
                      then 'QA:' || t.title else 'non-QA(redacted)' end, ' | '), '(none)')
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'), '(none)'
union all
select 15, 'non_qa_eligible_task_due',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() and now() + interval '20 minutes'
           and not (t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and t.title like '[QA CRON]%')), '0'
union all
select 16, 'task_overdue_in_window',
       (select count(*)::text
          from public.care_tasks t
          join public.care_circles cc on cc.id = t.circle_id
         where t.status = 'open' and t.due_date is not null
           and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
                 between now() - interval '24 hours' and now() - interval '60 minutes'), '0'
union all
select 17, 'B_med_plausible_next_20m', (select count(*)::text from med_win), '0'
union all
select 18, 'E_visits_plausible_window_60_80m', (select count(*)::text from vis_win), '0'
union all
select 19, 'F_appointments_firing_next_window',
       (select count(*)::text from public.care_appointments a
         where a.status = 'scheduled'
           and ( a.starts_at between now() + interval '1440 minutes' and now() + interval '1460 minutes'
              or a.starts_at between now() + interval '60 minutes'   and now() + interval '80 minutes' )), '0'
order by ord;
```

**Expected (all must hold to create jobs):** `pg_cron_installed=v1.6.4` · `fn_cron_schedule_visible=yes`
· `fn_cron_unschedule_visible=yes` · `pg_net_installed=v0.20.3` · `fn_net_http_post_visible=yes` ·
`existing_sanad_jobs=0` · `secret_count_by_name=1` · `pending_outbox=0` · `processing_total=0` ·
`stale_processing=0` · `failed_deliveries=0` · `owner_active_tokens=1 active / 1 total` ·
`existing_qa_cron_open=0` · `task_due_next_20m=(none)` · `non_qa_eligible_task_due=0` ·
`task_overdue_in_window=0` · **`B=0` · `E=0` · `F=0`**. Any failure → **STOP**.

### 5a Results — operator verdict: PASS

All 19 gates matched expectations (verbatim): `pg_cron_installed=v1.6.4`,
`fn_cron_schedule_visible=yes`, `fn_cron_unschedule_visible=yes`, `pg_net_installed=v0.20.3`,
`fn_net_http_post_visible=yes`, `existing_sanad_jobs=0`, `secret_count_by_name=1`, `pending_outbox=0`,
`processing_total=0`, `stale_processing=0`, `failed_deliveries=0`,
`owner_active_tokens=1 active / 1 total`, `existing_qa_cron_open=0`, `task_due_next_20m=(none)`,
`non_qa_eligible_task_due=0`, `task_overdue_in_window=0`, **`B=0`, `E=0`, `F=0`**. Operator explicitly
approved **Checkpoint 5b job creation only**. **PASS.**

### 5b. Creation SQL

Creates exactly **three** Sanad SQL-Snippet jobs. Each job's stored `command` reads `x-cron-secret`
from **Vault by name at runtime** — the secret plaintext is never inlined, printed, or stored. **No
`check-missed-doses` job.** No fixture is created; no Edge Function is invoked manually.

```sql
-- 2F-10L CHECKPOINT 5b — CRON JOB CREATION. RUN IN DASHBOARD FOR qccgshanmoeybagxwvcs.
-- Creates exactly 3 Sanad SQL-Snippet jobs. x-cron-secret is read from Vault BY NAME at runtime;
-- plaintext is never inlined. Do NOT create a check-missed-doses job.

-- (1) Producer — every 5 minutes
select cron.schedule(
  'sanad-enqueue-due-reminders',
  '*/5 * * * *',
  $sanad$
    select net.http_post(
      url     := 'https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/enqueue-due-reminders',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                                       where name = 'NOTIFICATIONS_CRON_SECRET')
                 ),
      body    := '{}'::jsonb
    );
  $sanad$
);

-- (2) Processor — every 5 minutes
select cron.schedule(
  'sanad-process-notification-outbox',
  '*/5 * * * *',
  $sanad$
    select net.http_post(
      url     := 'https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/process-notification-outbox',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                                       where name = 'NOTIFICATIONS_CRON_SECRET')
                 ),
      body    := '{}'::jsonb
    );
  $sanad$
);

-- (3) Receipt checker — every 15 minutes
select cron.schedule(
  'sanad-check-push-receipts',
  '*/15 * * * *',
  $sanad$
    select net.http_post(
      url     := 'https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/check-push-receipts',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                                       where name = 'NOTIFICATIONS_CRON_SECRET')
                 ),
      body    := '{}'::jsonb
    );
  $sanad$
);
```

**Secret handling:** the only reference to the secret is the Vault subquery `... where name =
'NOTIFICATIONS_CRON_SECRET'`. `cron.schedule` stores that subquery text (by name) in
`cron.job.command`; the plaintext is resolved only at each run and is never stored, printed, or
inlined. Verification never selects `cron.job.command`.

## Checkpoint 6 — Post-creation verification ⏳ AWAITING OPERATOR

Run after the creation SQL. All SELECT-only; **`command` is never selected**.

**(A) Jobs metadata — exactly 3 Sanad jobs (jobid / jobname / schedule / active only):**

```sql
-- 2F-10L CHECKPOINT 6A — SANAD JOBS METADATA (SELECT-only; no command).
select jobid, jobname, schedule, active
from cron.job
where jobname like 'sanad-%'
order by jobname;
```

Expected 3 rows: `sanad-check-push-receipts` `*/15 * * * *` `active=t`;
`sanad-enqueue-due-reminders` `*/5 * * * *` `active=t`; `sanad-process-notification-outbox`
`*/5 * * * *` `active=t`.

**(B) Side-effect checks — no notifications/outbox/deliveries from creation, no fixture:**

```sql
-- 2F-10L CHECKPOINT 6B — SIDE-EFFECT CHECKS (SELECT-only). Returns ONE grid.
select 1 as ord, 'sanad_job_count' as check_name,
       (select count(*)::text from cron.job where jobname like 'sanad-%') as observed, '3' as expected
union all
select 2, 'sanad_jobs_all_active',
       (select case when bool_and(active) then 'yes' else 'no' end from cron.job where jobname like 'sanad-%'), 'yes'
union all
select 3, 'pending_outbox',
       (select count(*)::text from public.notification_outbox where status = 'pending'), '0'
union all
select 4, 'recent_notifications_20m',
       (select count(*)::text from public.notifications where created_at > now() - interval '20 minutes'), '0'
union all
select 5, 'recent_outbox_20m',
       (select count(*)::text from public.notification_outbox where created_at > now() - interval '20 minutes'), '0'
union all
select 6, 'recent_deliveries_20m',
       (select count(*)::text from public.notification_push_deliveries where created_at > now() - interval '20 minutes'), '0'
union all
select 7, 'existing_qa_cron_open',
       (select count(*)::text from public.care_tasks
         where circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid and title like '[QA CRON]%' and status = 'open'), '0'
order by ord;
```

Expected: `sanad_job_count=3` · `sanad_jobs_all_active=yes` · `pending_outbox=0` ·
`recent_notifications_20m=0` · `recent_outbox_20m=0` · `recent_deliveries_20m=0` ·
`existing_qa_cron_open=0`. (The producer has nothing eligible — B/E/F/task_due all 0 — so even once
the jobs fire, they enqueue/deliver nothing.)

**(C) Optional run observability — confirms the jobs fire (no command printed):**

```sql
-- OPTIONAL — recent Sanad job runs (jobname / status / start_time only; NO command).
select j.jobname, d.status, d.start_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname like 'sanad-%'
order by d.start_time desc
limit 10;
```

### Results — operator verdict: PASS

Creation SQL returned 3 scheduled jobs.

**6A — jobs metadata (verbatim):**

| jobid | jobname | schedule | active |
| ----- | ------- | -------- | ------ |
| 1 | sanad-enqueue-due-reminders | `*/5 * * * *` | true |
| 2 | sanad-process-notification-outbox | `*/5 * * * *` | true |
| 3 | sanad-check-push-receipts | `*/15 * * * *` | true |

**6B — side-effect checks:** `sanad_job_count=3` · `sanad_jobs_all_active=yes` · `pending_outbox=0`
· `recent_notifications_20m=0` · `recent_outbox_20m=0` · `recent_deliveries_20m=0` ·
`existing_qa_cron_open=0`.

**Assessment:** exactly three Sanad jobs exist with the expected names, schedules, and `active=true`;
creation produced **no** notifications / outbox / deliveries; no open `[QA CRON]`. **PASS.**

## Checkpoint 7 — Decision after substrate creation ✅

The secure cron substrate is in place: `pg_cron` + `pg_net` installed; three **active** Sanad
SQL-Snippet jobs (`sanad-enqueue-due-reminders` `*/5`, `sanad-process-notification-outbox` `*/5`,
`sanad-check-push-receipts` `*/15`), each reading `x-cron-secret` from Vault **by name** at runtime; a
reviewed Sanad-scoped disable path (`cron.unschedule`); and **no side effects**.

**Not done in 2F-10L (deferred to a later explicitly-approved phase):**

- No QA fixture created.
- No smoke-test push; no Edge Function invoked manually; no receipt-checker run forced.

The jobs are active on `*/5` / `*/15`, so they run continuously but — with nothing eligible
(B/E/F/task_due/task_overdue all 0 at creation) — the producer enqueues nothing and the chain stays
idle. The end-to-end push/receipt proof needs a fresh `[QA CRON]` fixture and belongs to **2F-10M**,
which must re-run the last-minute preflight (including B/E/F) immediately before creating the fixture.
If preferred, the operator may keep the jobs dormant between phases using the reviewed disable/pause
path (Checkpoint 3); leaving them active is also safe (harmless no-op runs).

---

# Final report (12 parts) ✅

## 1. Executive summary

Phase 2F-10L created the **secure cron scheduling substrate** for the notification chain using
**SQL-Snippet `pg_cron` jobs** that read `NOTIFICATIONS_CRON_SECRET` from **Supabase Vault at
runtime**. All seven checkpoints passed with an explicit human approval at each risky step; the human
ran every statement in the Dashboard (Claude authored SQL and assessed results only). Outcome:
`pg_cron` + `pg_net` installed; **three active Sanad jobs** created and verified; **no side effects**
(no notifications / outbox / deliveries produced, no fixture, no push, no manual Edge invocation). No
secret value was ever pasted or printed, and `cron.job.command` was never selected. **Verdict: PASS.**
The fixture + push/receipt smoke test is deferred to **2F-10M**.

## 2. Human-provided Vault diagnostic result

Confirmed in 2F-10K and re-verified at Checkpoint 2: `schema_vault_exists = yes`;
`vault.decrypted_secrets` present; `vault.secrets` present; the secret `NOTIFICATIONS_CRON_SECRET`
present **by name only** (`secret_count_by_name = 1`). The secret **value** was never selected.

## 3. Dashboard UI rejection reason

The Supabase Dashboard Cron **Edge Function / HTTP Request** job targets expose the header value as a
**plain-text field with no Vault/secret selector**. Using them for `x-cron-secret` would persist the
secret as plaintext in the job config — rejected. The secure route is a **SQL-Snippet** job whose SQL
reads the secret from Vault at runtime, so only the by-name lookup is stored.

## 4. Pre-job preflight result

Two passes, both clean: **Checkpoint 2** (full preflight) and **Checkpoint 5a** (last-minute, after
pg_cron install). Substrate (pg_net installed, `net.http_post` visible; pg_cron available then
installed), Vault (schema + decrypt view + secret by name), and the notification-engine baseline
(`pending_outbox=0`, `processing=0`, `stale=0`, `failed=0`, one active owner token, no non-QA
`task_due`, `task_overdue=0`, **B/E/F=0**, no open `[QA CRON]`, no pre-existing Sanad jobs) all as
expected.

## 5. Disable path

Authored **before** creation (Checkpoint 3) and confirmed understood by the operator. Primary
rollback unschedules **only** `sanad-` jobs (set-based, idempotent):
`select jobname, cron.unschedule(jobname) from cron.job where jobname like 'sanad-%';`. Verification
lists only `jobid / jobname / schedule / active` (never `command`); an optional
`update cron.job set active=false where jobname like 'sanad-%'` pauses without deleting. No non-Sanad
job is ever affected; no secret appears.

## 6. pg_cron enablement result

`create extension if not exists pg_cron;` → `pg_cron v1.6.4`; `cron` schema present with `cron.job`,
`cron.schedule`, `cron.unschedule`, `cron.job_run_details`; `existing_sanad_jobs = 0`. **PASS.**

## 7. Job-creation SQL summary (no secret exposure)

Three `cron.schedule` SQL-Snippet jobs, each calling
`net.http_post(url := 'https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/<function>', headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'NOTIFICATIONS_CRON_SECRET')), body := '{}'::jsonb)`:

- `sanad-enqueue-due-reminders` — `*/5 * * * *`
- `sanad-process-notification-outbox` — `*/5 * * * *`
- `sanad-check-push-receipts` — `*/15 * * * *`

The secret is referenced **by name only**; its plaintext is never inlined, printed, or stored (it is
resolved at each run). `cron.job.command` is never selected in any verification. No `check-missed-doses`
job was created.

## 8. Post-creation verification result

`sanad_job_count=3` (jobids 1/2/3, names + schedules as authored, all `active=true`);
`pending_outbox=0`; `recent_notifications_20m=0`; `recent_outbox_20m=0`; `recent_deliveries_20m=0`;
`existing_qa_cron_open=0`. Creation caused **no** notifications / outbox / deliveries. **PASS.**

## 9. Final state

- **Substrate live:** `pg_cron v1.6.4` + `pg_net v0.20.3`; three active Sanad SQL-Snippet jobs on
  `*/5` / `*/5` / `*/15`.
- **Secret:** read from Vault by name at runtime; never inlined / printed / stored; `cron.job.command`
  never selected.
- **Disable path:** reviewed, Sanad-scoped, ready.
- **No side effects:** no fixture, no push, no manual Edge invocation, no forced receipt run;
  `pending_outbox=0`; no recent notifications / outbox / deliveries; no open `[QA CRON]`.
- **Repo:** only this 2F-10L report was written (untracked); no app / Edge / migration / generated-type
  changes; no Supabase CLI; no SQL run by Claude; no DB connection by Claude; no commit / no stage.

## 10. Deviations / incidents

- **Producer and processor both on `*/5` (no offset)** — per the explicit Checkpoint 5 schedule. A row
  the producer enqueues may be fanned/sent on the next cycle (≤ ~5 min latency) rather than the same
  minute. Non-blocking and acceptable for the substrate; an offset (e.g. `1-59/5`) could be adopted
  later if lower latency is wanted.
- **Jobs left ACTIVE at end of phase** — by design (substrate creation). They idle harmlessly (nothing
  eligible) until 2F-10M; the reviewed disable/pause path is available if the operator prefers them
  dormant between phases.
- No unexpected incidents. No secret exposure. No collateral notifications/deliveries.

## 11. Final verdict

**PASS — SQL/Vault cron substrate created and verified with no observed side effects.**

## 12. Recommendation

**Next phase: `2F-10M — active cron smoke-test execution, explicitly approved`.** It must:

- re-run the last-minute preflight (including the `now()`-sensitive **B / E / F**) immediately before
  creating a fresh `[QA CRON]` fixture;
- create the `[QA CRON] اختبار جدولة الإشعارات` fixture (app UI, assigned to the owner, due ~10–12 min
  ahead) and let the **active** jobs drive producer → processor → **one generic Android push**
  (title `سند`, body `لديك تذكير جديد`) → receipt (`ok`);
- observe evidence at each stage with SELECT-only SQL, and clean up the fixture afterward;
- keep the reviewed Sanad-scoped disable path ready throughout.

No fixture, push, manual Edge invocation, commit, or stage occurs in 2F-10L.

---

## Validation & final git state

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
?? docs/claude-reports/2026-07-08-phase-2f-10l-sql-vault-cron-job-creation-approval.md

$ git --no-pager diff --stat
(empty — no tracked-file changes)
```

All checks pass: no mojibake, no whitespace/conflict errors, and the only change is the single
untracked 2F-10L report (no tracked files modified, staged, or committed).
