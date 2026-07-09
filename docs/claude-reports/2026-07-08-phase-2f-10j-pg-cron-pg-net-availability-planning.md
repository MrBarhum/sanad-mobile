# Phase 2F-10J — pg_cron / pg_net availability planning (planning only, no execution)

- **Date:** 2026-07-08
- **Phase:** 2F-10J — pg_cron / pg_net availability planning
- **Type:** Planning artifact only — **NO execution** (no extension enablement, no cron job, no Edge invocation, no push, no secrets)
- **Baseline commit:** `7337d33 docs(product): record blocked cron smoke test execution`
- **Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`
- **DB major version (from `supabase/config.toml`):** Postgres **17**
- **Prior verdict (2F-10I):** `STOPPED / BLOCKED BEFORE CRON ENABLEMENT` — `cron_job_regclass = null` (pg_cron not installed / not visible)

---

## 1. Executive summary

This report is **planning only**. Its goal is to unblock the cron smoke test by planning the
**scheduling substrate** — nothing is enabled or executed here.

Phase 2F-10I was **blocked before cron enablement** because the last-minute preflight (and the
cleanup re-check) returned `cron_job_regclass = null`, meaning the **`pg_cron` extension is not
installed / not visible** in project `qccgshanmoeybagxwvcs` (and `pg_net`, which pg_cron would use to
call the Edge HTTPS endpoints, is not established). Without that substrate there is no way to
schedule the producer → processor → receipt-checker chain, so 2F-10I stopped at the gate.

The 2F-10I **cleanup completed and the baseline is intact:** QA fixture
`a72be14c-bed7-4cd3-866d-d64aa6512351` was completed (no longer open); no open `[QA CRON]` remains;
`pending_outbox = 0`; no new notifications / outbox / deliveries from the stopped run; no push was
sent; no cron job was created; nothing needed disabling.

During 2F-10J, Claude performed **read-only inspection only** and authored this single report. Claude
**ran no SQL**, made **no DB connection**, ran **no Supabase CLI**, enabled **no extension**
(`CREATE EXTENSION` was not run), created **no cron job**, invoked **no Edge Function**, sent **no
push**, polled **no receipts**, created **no QA fixture**, and read **no secrets**
(`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only).

---

## 2. Scheduling substrate requirement

The intended scheduled chain — `enqueue-due-reminders` (producer) → `process-notification-outbox`
(processor) → `check-push-receipts` (receipt checker) — needs a substrate that provides **all** of
the following:

1. **A scheduler** — a recurring time trigger (cron-style expressions) that can run the three
   functions on their cadences (producer ≤ 20 min to match the lookahead window; processor a minute
   or two after; receipt checker every ~15–30 min). Windowing constants come from
   `supabase/functions/_shared/config.ts` (`taskLookaheadMinutes = 20`, `receiptMinAgeMinutes = 15`,
   `receiptRetentionHours = 24`, `deliveryLockTimeoutSeconds = 600`).
2. **Ability to call the Supabase Edge Function HTTPS endpoints** — each run must issue an HTTPS
   `POST` to `https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/<function>`. In the pg_cron model
   this is done by `net.http_post` from `pg_net`. `verify_jwt = false` is already set for these four
   functions in `config.toml`, so no platform JWT is needed — **but the request is not public**: each
   handler calls `authorizeScheduledRequest()` and fails closed.
3. **Secure secret handling for `x-cron-secret`** — every call must present the shared secret
   `NOTIFICATIONS_CRON_SECRET` in the `x-cron-secret` header (or as a Bearer token). Per
   `_shared/auth.ts`, the comparison is timing-safe and **fails closed (401)** if the env var is not
   set. The secret must be sourced at call time from a secret store (Supabase **Vault**) so its
   plaintext is **never** inlined into a stored job definition (`cron.job.command`), printed, or
   committed.
4. **A disable / rollback path defined before enablement** — a paired, reviewed way to remove the
   schedule (`cron.unschedule` for pg_cron, or the Dashboard job toggle/delete) so any run can be
   stopped cleanly. This must exist and be reviewed **before** any job is created.
5. **Observability for job runs** — a place to see each run's outcome (`cron.job_run_details` for
   pg_cron, and/or Dashboard cron logs + the Edge Function logs), so failure counters, stale claims,
   invalid tokens, and durations can be inspected.

---

## 3. Supported paths to evaluate

| Path | What it is | Pros | Cons / risks | Role |
|------|------------|------|--------------|------|
| **A. Supabase Dashboard Cron / Jobs UI** | Supabase-managed Cron (Integrations → Cron), which provisions/uses `pg_cron` (+ `pg_net`) under the hood and exposes a Job UI that can target an **Edge Function** or an **HTTP request**, with headers and run logs. | Managed enablement (no hand-written extension SQL); native Edge-Function target; header support for `x-cron-secret`; built-in run history; simplest disable (toggle/delete). | Requires the Cron feature to be present/enabled for the project/plan; must still wire the secret from Vault, not inline. | **Preferred primary** (if available). |
| **B. SQL-based `pg_cron` + `pg_net`** | Enable both extensions via SQL, then `cron.schedule(...)` a job whose command is a `net.http_post(...)` to each Edge endpoint. | Fully self-contained in the DB; precise control of schedules/job names; `cron.job_run_details` observability. | Hand-written extension enablement + job SQL; secret must be read from Vault at call time (never inlined into `command`); disable path is `cron.unschedule`; more moving parts to review. | **Primary fallback** if Dashboard Cron UI is not exposed but the extensions are available. |
| **C. External scheduler (e.g. GitHub Actions or hosted cron)** | An external cron service issues the HTTPS `POST`s to the Edge endpoints on schedule, carrying `x-cron-secret`. | Works even if pg_cron/pg_net are unavailable; no DB extension needed. | Secret stored in the external system (new secret-management surface); runs outside Supabase observability; network egress/allow-listing considerations; another system to operate. | **Fallback only** (not preferred for production). |
| **D. One-shot supervised Edge invocation** | A single, human-supervised, immediately-reversible invocation of the endpoints (e.g. a manually-triggered authorized HTTPS call) to prove the chain end-to-end **without** standing cron. | Proves the smoke test without provisioning any scheduler; nothing left running. | Not a scheduler; not a production path; still needs the secret handled securely; must be its own explicitly-approved phase. | **Smoke-test fallback only**, never production cron. |

---

## 4. Recommended path

**Primary recommendation:** use **Supabase-managed Cron / Jobs (Path A)** if it is available in the
Dashboard for `qccgshanmoeybagxwvcs`.

- Prefer **Dashboard-managed** setup over hand-written extension SQL **if** the Dashboard exposes the
  required Job UI (schedule + Edge-Function/HTTP target + headers + run logs). It manages the
  `pg_cron`/`pg_net` enablement, gives a first-class Edge-Function target, and makes the disable path
  a single toggle/delete.
- If **Dashboard Cron is unavailable** but the extensions are present (Path B available), plan a
  **separate, explicitly-approved extension-enablement phase** (`2F-10K`) — do not enable anything
  here.
- If **neither** is available, fall back to **external scheduler planning (Path C)** — no production
  enablement — and keep **one-shot supervised invocation (Path D)** as the way to prove the chain for
  the smoke test only.
- **Do not enable anything in 2F-10J.** This phase only determines availability and the next path.

Regardless of path, the secret is always sourced from **Vault** at call time (never inlined), the
**disable path is reviewed first**, and a fresh last-minute preflight — including the `now()`-sensitive
**B/E/F** checks — is re-run immediately before any producer actually runs.

---

## 5. Dashboard inspection checklist (for the human — non-mutating)

Inspect the following in the Supabase Dashboard; **look only, change nothing**:

1. **Project ref** — confirm the Dashboard project ref is exactly **`qccgshanmoeybagxwvcs`** (Sanad).
   Wrong project → stop.
2. **Database → Extensions:**
   - Is **`pg_cron`** listed as **available**? Is it **enabled**?
   - Is **`pg_net`** listed as **available**? Is it **enabled**?
3. **Integrations / Cron / Jobs section:**
   - Is **Cron** available for this project?
   - Can a **job be created** from the UI?
   - Does the UI support an **HTTP request** target and/or an **Edge Function** target (so it can call
     `functions/v1/enqueue-due-reminders` etc.)?
   - Can it attach **custom headers** (needed for `x-cron-secret`)?
4. **Vault / Secrets:**
   - Can the **presence** of `NOTIFICATIONS_CRON_SECRET` be verified **without exposing the value**
     (name/metadata only)? (Also confirm the Edge Functions' env has it — presence only.)
5. **Logs / monitoring:**
   - Where do **job run details** appear (Dashboard Cron logs and/or `cron.job_run_details`), and
     where do the **Edge Function logs** appear, so each run can be inspected after the fact?

---

## 6. Read-only SQL diagnostic pack (human runs manually)

**SELECT-only.** No `CREATE EXTENSION`, no `ALTER`, no `cron.schedule`, no `cron.unschedule`, no
`net.http_post`, no secrets. Run in the Dashboard SQL editor for `qccgshanmoeybagxwvcs`; it returns
**one** labeled result grid.

```sql
-- 2F-10J READ-ONLY pg_cron / pg_net AVAILABILITY DIAGNOSTIC (SELECT-ONLY)
-- RUN IN SUPABASE DASHBOARD SQL EDITOR FOR PROJECT qccgshanmoeybagxwvcs.
-- No CREATE EXTENSION / ALTER / cron.schedule / cron.unschedule / net.http_post. No secrets.
-- Returns ONE labelled result grid (order by ord).
select 1 as ord, 'cron_job_regclass' as check_name,
       coalesce(to_regclass('cron.job')::text, '(null)') as observed,
       'null => pg_cron not installed/visible' as interpretation
union all
select 2, 'pg_cron_available',
       (select coalesce(string_agg('default=' || default_version || ' installed=' || coalesce(installed_version, '(none)'), '; '), '(not listed)')
          from pg_available_extensions where name = 'pg_cron'),
       'listed => extension available to install'
union all
select 3, 'pg_net_available',
       (select coalesce(string_agg('default=' || default_version || ' installed=' || coalesce(installed_version, '(none)'), '; '), '(not listed)')
          from pg_available_extensions where name = 'pg_net'),
       'listed => extension available to install'
union all
select 4, 'pg_cron_installed',
       (select coalesce(string_agg('v' || extversion, '; '), '(not installed)')
          from pg_extension where extname = 'pg_cron'),
       'row => already installed'
union all
select 5, 'pg_net_installed',
       (select coalesce(string_agg('v' || extversion, '; '), '(not installed)')
          from pg_extension where extname = 'pg_net'),
       'row => already installed'
union all
select 6, 'schema_cron_exists',
       (select case when exists (select 1 from pg_namespace where nspname = 'cron') then 'yes' else 'no' end),
       'yes => cron schema present'
union all
select 7, 'schema_net_exists',
       (select case when exists (select 1 from pg_namespace where nspname = 'net') then 'yes' else 'no' end),
       'yes => net schema present'
union all
select 8, 'fn_cron_schedule_visible',
       (select case when exists (
          select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'cron' and p.proname = 'schedule') then 'yes' else 'no' end),
       'yes => cron.schedule callable'
union all
select 9, 'fn_cron_unschedule_visible',
       (select case when exists (
          select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'cron' and p.proname = 'unschedule') then 'yes' else 'no' end),
       'yes => cron.unschedule callable (disable path exists)'
union all
select 10, 'fn_net_http_post_visible',
       (select case when exists (
          select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'net' and p.proname = 'http_post') then 'yes' else 'no' end),
       'yes => net.http_post callable (Edge-call path exists)'
order by ord;
```

**Conditional follow-up — run ONLY if row 1 `cron_job_regclass` is NOT null** (directly querying
`cron.job` errors when the schema is absent). The raw `command` is **not** selected, because a job's
command can embed the `x-cron-secret` value; instead it only flags whether a job targets a Sanad
function:

```sql
-- RUN ONLY IF cron_job_regclass IS NOT NULL. SELECT-only. Detects any PRE-EXISTING Sanad cron jobs
-- WITHOUT printing the command (which could contain the x-cron-secret).
select jobid, jobname, schedule, active,
       ( command ilike '%enqueue-due-reminders%'
      or command ilike '%process-notification-outbox%'
      or command ilike '%check-push-receipts%'
      or command ilike '%check-missed-doses%'
      or jobname ilike 'sanad-%' ) as targets_sanad
from cron.job
order by jobid;
-- Expected: 0 rows (or 0 targets_sanad). Any pre-existing Sanad job -> STOP and review before any smoke test.
```

**Expected (given the 2F-10I finding):** `cron_job_regclass = (null)`, both extensions likely
**available but not installed** (`(none)` / `(not installed)`), schemas/functions **not** visible.
The diagnostic confirms which path is open.

---

## 7. Go / no-go interpretation

Read the diagnostic + Dashboard checklist together and pick the next phase:

- **pg_cron and pg_net available but NOT enabled** (rows 2–3 listed with `installed=(none)`; rows
  4–5 `(not installed)`; row 1 `null`): the substrate can be provisioned by SQL. → next phase
  **`2F-10K — pg_cron / pg_net enablement approval, explicitly approved`**.
- **Supabase Dashboard Cron is available and can target Edge Functions securely** (checklist §3 yes,
  with header support for `x-cron-secret`): prefer the managed route. → next phase
  **`2F-10K — Dashboard Cron setup approval, explicitly approved`**.
- **Neither is available** (extensions not listed and no Dashboard Cron): → **external scheduler
  planning (Path C), no production enablement** (with one-shot supervised invocation, Path D, only to
  prove the smoke test).
- **Extensions already enabled unexpectedly** (row 1 non-null, or rows 4–5 show installed): **STOP** —
  run the conditional follow-up and **review any existing jobs** (especially any `targets_sanad`)
  before considering any smoke test.

---

## 8. Future 2F-10K requirements

Whichever path is chosen, the later `2F-10K` phase **must**:

1. **Ask explicit human approval before any extension enablement or job creation** (nothing is
   enabled or scheduled without a separate, in-the-moment approval).
2. **Define the exact rollback / disable path first** — the reviewed `cron.unschedule` (or Dashboard
   toggle/delete) must be written and understood **before** any job is created.
3. **Verify no pre-existing Sanad jobs** — re-run the §6 follow-up and confirm zero `targets_sanad`
   jobs before creating anything.
4. **Verify secret handling without exposing the secret value** — confirm `NOTIFICATIONS_CRON_SECRET`
   presence in Vault / function env by name only; wire the cron call to read it from Vault at call
   time (never inline the plaintext into `cron.job.command`, logs, chat, or Git).
5. **Not send push** unless the later smoke-test phase explicitly approves it — enablement of the
   substrate and the actual smoke-test push delivery remain separate, separately-approved steps, each
   preceded by a fresh last-minute preflight (including the `now()`-sensitive **B/E/F** re-checks).

---

## 9. Recommendation

Next steps after 2F-10J (all read-only / inspection until a later approved phase):

1. **Human runs the §6 SELECT-only diagnostic** in the Dashboard for `qccgshanmoeybagxwvcs` and
   pastes the grid.
2. **Human checks Dashboard availability** using the §5 checklist (Extensions, Cron/Jobs UI, Vault,
   Logs).
3. **Choose the `2F-10K` path** per §7:
   - Dashboard Cron available → `2F-10K — Dashboard Cron setup approval, explicitly approved`.
   - Extensions available but not enabled → `2F-10K — pg_cron / pg_net enablement approval, explicitly approved`.
   - Neither → external scheduler planning (no production enablement).

Do **not** enable anything as part of 2F-10J. Enablement is a distinct, explicitly-approved step.

---

## 10. Validation

Only the two local, read-only validation commands were run (no Supabase CLI, no SQL, no DB, no
deploy, no invocation):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results:

```
$ npm run check:mojibake
> sanad-mobile@1.0.0 check:mojibake
> node ./scripts/check-mojibake.js
check:mojibake - scanned 266 active source/config file(s).
No strong mojibake signatures found in active source/config.
(exit 0)

$ git -c core.autocrlf=false diff --check
(no output; exit 0)
```

Both validation commands passed: no mojibake signatures, and no whitespace/conflict errors.

---

## 11. Final confirmation

- [x] Report created (`docs/claude-reports/2026-07-08-phase-2f-10j-pg-cron-pg-net-availability-planning.md`).
- [x] No app source changed.
- [x] No Edge source changed.
- [x] No migrations changed.
- [x] No generated types changed.
- [x] No Supabase CLI run.
- [x] No SQL run by Claude.
- [x] No DB connection by Claude.
- [x] No extension enabled (`CREATE EXTENSION` not run).
- [x] No cron job created.
- [x] No Edge invocation.
- [x] No push.
- [x] No secrets touched (referenced by name only).
- [x] No commit / no stage.

---

## 12. Final git state

```
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10j-pg-cron-pg-net-availability-planning.md

$ git --no-pager diff --stat
(empty — no tracked-file changes)
```

Exactly one untracked file (this report). No tracked files modified, staged, or committed.
