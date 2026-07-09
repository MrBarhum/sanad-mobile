# Phase 2F-10K — Cron substrate setup path decision (no job creation)

- **Date:** 2026-07-08
- **Phase:** 2F-10K — cron substrate setup path decision
- **Type:** Path-decision + planning artifact only — **NO job creation, NO execution**
- **Baseline commit:** `5286182 docs(product): plan cron substrate availability`
- **Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`
- **DB major version (`supabase/config.toml`):** Postgres **17**

---

## 1. Executive summary

This report records a **path decision** about the cron scheduling substrate and plans the next
read-only diagnostic. **No cron job was created, no extension was enabled by Claude, no secret was
entered, no Edge Function was invoked, and no push was sent.**

New facts since 2F-10J (all performed by the **human** in the Dashboard):

- The human **manually enabled `pg_net`** via the Supabase Dashboard.
- **`pg_cron` remains available but not installed** (default `1.6.4`, `installed=(none)`); the `cron`
  schema and `cron.schedule` / `cron.unschedule` are **not** visible yet.
- The **Dashboard Cron UI exists**, and the **Edge Function target works** — it lists the four
  scheduled functions (`enqueue-due-reminders`, `process-notification-outbox`,
  `check-push-receipts`, `check-missed-doses`).
- Both the **HTTP Request** and **Supabase Edge Function** job targets support **custom headers**,
  **but the header value is a plain-text field with no visible Vault / Secret selector.**

Post-`pg_net` diagnostic (from the human, verbatim):

| check | observed |
|-------|----------|
| cron_job_regclass | `(null)` |
| pg_cron_available | `default=1.6.4 installed=(none)` |
| pg_net_available | `default=0.20.3 installed=0.20.3` |
| pg_cron_installed | `(not installed)` |
| pg_net_installed | `v0.20.3` |
| schema_cron_exists | `no` |
| schema_net_exists | `yes` |
| fn_cron_schedule_visible | `no` |
| fn_cron_unschedule_visible | `no` |
| fn_net_http_post_visible | `yes` |

**Verdict:** the **Dashboard Edge Function / HTTP UI target is NOT approved** for jobs that require
the `x-cron-secret` header, because that UI would store the secret as **plaintext in the job config**.
No cron jobs were created; no secret was entered; no Edge Function was invoked; no push was sent.

---

## 2. Decision

**Reject** the Dashboard **Edge Function / HTTP Request** job targets for secure scheduled Sanad jobs
**unless a secure secret-reference mechanism is confirmed** (a Vault/secret selector for the header
value, not a plain-text field).

Reasons:

- **`x-cron-secret` must not be stored as plaintext** in a job configuration. The Dashboard header
  field is free-text with no Vault/secret selector, so any value typed there would be persisted in
  the job definition — an unacceptable secret-at-rest exposure.
- **The Edge source requires `x-cron-secret`.** Per `supabase/functions/_shared/auth.ts`,
  `authorizeScheduledRequest()` reads `NOTIFICATIONS_CRON_SECRET` and compares it (timing-safe) to
  the `x-cron-secret` header (or Bearer), **failing closed (401)** if the env var is unset. So a
  scheduled call cannot omit the secret — it must present it, securely.
- **Supabase's recommended practice** for scheduled Edge Function calls is to keep the auth token in
  **Vault** and read it at call time, rather than embedding it in the job.

Because the UI cannot reference a secret securely, the secure route is a **SQL-Snippet cron job**
whose SQL reads the secret from Vault at runtime (so the stored `cron.job.command` contains only the
Vault-by-name lookup, never the plaintext).

---

## 3. Recommended path

**Use Supabase Cron "SQL Snippet" jobs — only if** the snippet can read `NOTIFICATIONS_CRON_SECRET`
from **Supabase Vault at runtime** and pass it to `net.http_post` **without printing or storing the
plaintext** in the job definition.

- The scheduled SQL would call `net.http_post(...)` with an `x-cron-secret` header whose value is a
  **subquery against the Vault decrypt view by secret name** — so the job command stores only the
  name/lookup, not the value. `pg_net` (`net.http_post`) is already installed and visible, so this
  half of the path is in place.
- `pg_cron` still needs to be installed (either explicitly in a later approved phase, or implicitly
  when the first Supabase Cron job is created). Nothing is installed here.
- **If the Vault runtime-read cannot be verified** (no Vault schema, no decrypt view, or the secret
  is not present by name), **STOP** and switch to an **external scheduler with secure secret storage**
  (or another approved path). Do not fall back to typing the secret into the Dashboard header field.

---

## 4. Required next diagnostic (Vault — SELECT-only, no secret values)

Run this read-only pack in the Dashboard SQL editor for `qccgshanmoeybagxwvcs`. It inspects Vault
support **by name/metadata only** — it never selects an encrypted or decrypted secret value.

```sql
-- 2F-10K READ-ONLY VAULT AVAILABILITY DIAGNOSTIC (SELECT-ONLY)
-- RUN IN SUPABASE DASHBOARD SQL EDITOR FOR PROJECT qccgshanmoeybagxwvcs.
-- No secret VALUE is selected/printed. No CREATE/ALTER/cron.*/net.http_post. Returns ONE grid.
select 1 as ord, 'schema_vault_exists' as check_name,
       (select case when exists (select 1 from pg_namespace where nspname = 'vault') then 'yes' else 'no' end) as observed,
       'yes => Supabase Vault schema present' as interpretation
union all
select 2, 'vault_secrets_relation',
       coalesce(to_regclass('vault.secrets')::text, '(null)'),
       'non-null => vault.secrets exists (stores ENCRYPTED secrets)'
union all
select 3, 'vault_decrypted_secrets_view',
       coalesce(to_regclass('vault.decrypted_secrets')::text, '(null)'),
       'non-null => runtime-decrypt view exists (read BY NAME at call time)'
union all
select 4, 'vault_secrets_metadata_columns',
       (select coalesce(string_agg(column_name, ', ' order by ordinal_position), '(none)')
          from information_schema.columns
          where table_schema = 'vault' and table_name = 'secrets'
            and column_name in ('id','name','description','created_at','updated_at')),
       'metadata columns only — NOT the encrypted secret column'
order by ord;
```

**Conditional follow-up — run ONLY if `vault_secrets_relation` is NON-NULL.** Confirms the secret
exists **by name only**; it selects **no** secret value:

```sql
-- RUN ONLY IF vault.secrets EXISTS. SELECT-only. Confirms the secret is present BY NAME.
-- NEVER select vault.secrets.secret or vault.decrypted_secrets.decrypted_secret.
select name, description, created_at, updated_at
from vault.secrets
where name = 'NOTIFICATIONS_CRON_SECRET';
-- Expected: exactly one row (by name). 0 rows => secret not in Vault under that name -> STOP.
```

Do **not** select `vault.secrets.secret` or `vault.decrypted_secrets.decrypted_secret`. Paste only
the name/metadata (no value).

---

## 5. Required pre-job-creation plan

Before **any** job is created (in a later, explicitly-approved phase), all of the following must
hold:

1. **`pg_cron` enabled** — explicitly (approved `CREATE EXTENSION` step) or implicitly by the first
   Supabase Cron SQL-Snippet job creation. (Not done here.)
2. **Disable path known first** — the exact `cron.unschedule('<job-name>')` (or Dashboard
   toggle/delete) is written and reviewed **before** any job exists.
3. **No existing Sanad jobs** — re-run the job-listing probe and confirm zero `sanad-*` /
   Sanad-targeting jobs (without printing the command, which could carry the secret).
4. **Last-minute notification preflight passes** — the full read-only preflight, including the
   `now()`-sensitive **B / E / F** checks = 0, immediately before any producer runs.
5. **No fixture exists** — `existing_qa_cron_open = 0` before creating the smoke-test fixture.
6. **No secret plaintext anywhere** — not in chat, this report, or any `cron.job.command`.
7. **Job command references Vault by secret name only** — the `x-cron-secret` value is a runtime
   Vault lookup (`... where name = 'NOTIFICATIONS_CRON_SECRET'`), never the resolved value.

---

## 6. Job strategy if the Vault path is verified

If (and only if) the §4 diagnostic confirms Vault + the secret-by-name, plan **three SQL-Snippet
cron jobs**:

- `sanad-enqueue-due-reminders`
- `sanad-process-notification-outbox`
- `sanad-check-push-receipts`

Each job's scheduled SQL would issue a `net.http_post` to its function URL
(`https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/<function>`) with:

- **method:** POST (via `net.http_post`)
- **headers (jsonb):** `Content-Type: application/json` **and** `x-cron-secret: <read from Vault at
  runtime>`
- **body:** `{}`

**Illustrative shape only — NOT authored as runnable here** (final runnable SQL, exact cron
expressions, and the `cron.schedule(...)` wrappers are authored in the later approved phase, once
Vault is confirmed). The secret is read from Vault **by name** at runtime; its plaintext is never
written into the command, this report, or chat:

```text
-- ILLUSTRATIVE ONLY — DO NOT RUN IN 2F-10K. Shape of each SQL-Snippet cron job body:
--
--   select net.http_post(
--     url     => 'https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/<function>',
--     headers => jsonb_build_object(
--                  'Content-Type',  'application/json',
--                  'x-cron-secret', (select decrypted_secret
--                                      from vault.decrypted_secrets
--                                      where name = 'NOTIFICATIONS_CRON_SECRET')
--                ),
--     body    => '{}'::jsonb
--   );
--
-- scheduled via: cron.schedule('<sanad-job-name>', '<cron-expr>', $$ <the select above> $$);
-- <function> ∈ { enqueue-due-reminders, process-notification-outbox, check-push-receipts }.
-- NOT AUTHORED AS RUNNABLE HERE — deferred to the later explicitly-approved phase.
```

Cadence (from `_shared/config.ts`, to be finalized later): producer ≤ 20 min (match
`taskLookaheadMinutes = 20`), processor ~1–2 min after, receipt checker ~15–30 min
(`receiptMinAgeMinutes = 15`).

---

## 7. Stop criteria

**STOP** (do not proceed to job creation) if any of these hold:

- **Vault unavailable** (no `vault` schema / no `vault.decrypted_secrets` view).
- **Secret not present by name** (`NOTIFICATIONS_CRON_SECRET` not found in `vault.secrets`).
- **Secret can only be entered as plaintext** (no secure runtime reference — e.g. only the Dashboard
  free-text header field).
- **`pg_cron` cannot be disabled / unscheduled cleanly** (no reviewed `cron.unschedule` or
  toggle/delete path).
- **UI creates active jobs immediately** before the last-minute preflight can run (a job would fire
  before it is safe).
- **Any existing Sanad job** is present.
- **Any preflight STOP condition** (non-QA `task_due`, stale/failed deliveries, nonzero B/E/F, etc.).

---

## 8. Recommendation

**Next immediate human action:** run the **§4 Vault SELECT-only diagnostic** (and the conditional
follow-up) in the Dashboard and paste the results.

Then choose the next phase:

- If Vault + the secret-by-name are confirmed and `net.http_post` can read it at runtime →
  **`2F-10L — SQL/Vault cron job creation approval, explicitly approved`** (authors the runnable
  SQL-Snippet jobs + disable path, under explicit approval, still gated on a fresh last-minute
  preflight).
- If Vault is unavailable or the secret cannot be referenced securely →
  **external scheduler planning** (secure secret storage), no production enablement.

Do **not** create any cron job, enable `pg_cron`, or enter any secret in 2F-10K.

---

## 9. Validation

Only local, read-only checks were run (no Supabase CLI, no SQL, no DB, no deploy, no invocation):

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

## Final confirmation

- [x] Report created (`docs/claude-reports/2026-07-08-phase-2f-10k-dashboard-cron-setup-approval.md`).
- [x] No cron jobs created.
- [x] No `pg_cron` enabled; no `CREATE EXTENSION` run.
- [x] No `cron.schedule` / `cron.unschedule` / `net.http_post` run.
- [x] No Edge invocation; no push; no receipts polled.
- [x] No QA fixture created.
- [x] No `.env` inspected; no secret values asked for, entered, or printed.
- [x] No Supabase CLI; no deploy.
- [x] No app / Edge / migration / generated-type changes.
- [x] No commit / no stage.

## Final git state

```
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10k-dashboard-cron-setup-approval.md

$ git --no-pager diff --stat
(empty — no tracked-file changes)
```

Exactly one untracked file (this report). No tracked files modified, staged, or committed.
