# Phase 2F-6D - Post-deploy Dashboard / manual verification plan (no invocation)

**Status:** Plan / checklist **only**. This report gives the user a safe, **read-only** Supabase Dashboard
verification procedure for the just-deployed Edge Functions - **without invoking any function and without
enabling cron**. **Claude ran no Supabase CLI, no SQL, made no DB connection, invoked nothing, deployed
nothing, and enabled no cron.** The only commands run in this phase are the two local read-only checks in
Section 9. The sole filesystem write is this report.

**Baseline (pushed) commit:** `dfb5dc8 docs(product): record edge deploy without cron`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**Deployed (2F-6C):** `enqueue-due-reminders`, `check-missed-doses`, `process-notification-outbox`,
`check-push-receipts` - with `--project-ref qccgshanmoeybagxwvcs --no-verify-jwt`. cron/delivery OFF.

---

## 1. Executive summary

- **Edge deploy has completed.** The four notification Edge Functions were uploaded to project
  `qccgshanmoeybagxwvcs` (2F-6C execution record).
- **This phase does not verify by invoking functions.** Verification is limited to **looking** at the
  Dashboard; nothing is triggered.
- **Dashboard verification should be read-only** - confirm the functions exist and look healthy; click no
  action buttons.
- **Cron remains OFF** - do not create any schedule while verifying.
- **No smoke test yet** - the controlled single-item test is a later, separately-approved phase.
- **No outbox processing** - `process-notification-outbox` must not be run.
- **No push delivery** - nothing is sent as part of verification.

## 2. Manual Dashboard verification checklist (read-only)

Perform these in the Supabase Dashboard for project `qccgshanmoeybagxwvcs`. **Look only - click no
Invoke/Test/Run/Schedule/Deploy button.**

1. **Confirm the project is Sanad.**
   - Open the project and check its **project ref equals `qccgshanmoeybagxwvcs`** (Project Settings ->
     General / the ref in the URL).
   - Confirm the **project name matches Sanad / sanad-mobile** (the local dev config names it
     `sanad-mobile`; the cloud project should be the Sanad project). If the ref or name does not match,
     **stop** - you are in the wrong project (see Risk 1).

2. **Edge Functions list - confirm these four exist:**
   - `enqueue-due-reminders`
   - `check-missed-doses`
   - `process-notification-outbox`
   - `check-push-receipts`

   (Open Edge Functions in the left nav and confirm all four are present by name.)

3. **Function status.**
   - Each appears **deployed / active** (a recent "last deployed" / updated timestamp consistent with the
     2F-6C deploy).
   - **No error indicator** is shown next to any of the four in the list.

4. **JWT verification / auth mode.**
   - If the Dashboard exposes a per-function "Verify JWT" / "Enforce JWT" setting, confirm it reads
     **disabled/off** for each of the four (matching the deploy's `--no-verify-jwt` and
     `config.toml`'s `verify_jwt = false`).
   - If the Dashboard does **not** clearly expose this, **do not guess** - rely on the fact that the
     deploy used `--no-verify-jwt` and `config.toml` declares `verify_jwt = false` for all four. Record
     "not shown in Dashboard" rather than inferring a value. (Reminder: these endpoints are authorized by
     the `x-cron-secret` header via `authorizeScheduledRequest()`, which fails closed - JWT-off is
     intended.)

5. **Do NOT use the Dashboard "Invoke" / "Test" / "Run" button.**
   - Do not click any run/test/invoke control on **any** function.
   - **Especially do not invoke `process-notification-outbox`** - it is the only push sender; invoking it
     could send real Expo pushes if any queued/claimable deliveries exist.

6. **Do NOT create schedules or cron jobs from the Dashboard.**
   - Do not add a schedule, cron expression, or scheduled trigger to any function. Cron stays OFF.

7. **Do NOT edit environment variables in this phase.**
   - If any expected function env var appears **missing** (e.g. the cron secret / service-role / Expo
     access), **record that it is missing for a later phase - do not change it now**.
   - **Do not reveal or copy any secret value** into notes, screenshots, the report, or chat.

8. **Confirm no accidental local changes.**
   - After the Dashboard-only checks, your **local git status should still be clean**
     (`git --no-pager status --short` empty; branch `## master...origin/master`). Dashboard viewing does
     not touch the repo, so anything unexpected there means something else changed - investigate before
     proceeding.

## 3. What NOT to click / do (safety section)

- **Do not** click **Invoke / Test / Run** on any function.
- **Do not** create a **schedule** / cron job.
- **Do not** run **SQL** (SQL Editor stays closed for this phase).
- **Do not** open or reveal **secrets** (env vars, service-role key, tokens).
- **Do not** edit **function config** (name, verify-JWT, env, import map).
- **Do not** delete any function.
- **Do not** redeploy.
- **Do not** run a smoke test.
- **Do not** run the **outbox processor** (`process-notification-outbox`).

## 4. Expected safe outcomes

If the phase is done correctly, you should see:
- **Four functions visible** in the Dashboard Edge Functions list (all named above).
- **No invocation logs** produced by this phase (because nothing was invoked).
- **No notification rows** created by this phase.
- **No outbox rows** processed.
- **No Expo pushes** sent.
- **Repo remains clean** (`status --short` empty; `## master...origin/master`).

## 5. Optional later cron-absence verification (design only; do NOT run)

A later, **separately-approved** check can confirm no notification cron exists:
- **Dashboard route:** if the project exposes scheduled functions / cron in the UI, confirm there is **no
  schedule** attached to any of the four functions (and no notification job under any Integrations /
  Cron / Scheduler view).
- **Read-only SQL route (later / manual only):** a read-only inspection of `cron.job` (the pg_cron table)
  would show whether any notification schedule exists. **This requires separate approval** because it
  connects to the DB / uses SQL - it is **not** part of this phase and **must not be run now**. No
  runnable SQL is included here; if such a check is later authorized, it must be explicitly marked
  manual/read-only and executed only under that approval.
- **No cron changes now** - this is verification-of-absence only, and only later.

## 6. Optional later smoke-test plan pointer

The smoke test is **not** re-designed here - see **2F-6A Section 7** (full smoke-test design) and
**2F-6C Section 3/7** (post-deploy boundary). Key reminders carried forward:
- The smoke test is a **separate, explicitly-approved** step - not part of Dashboard verification.
- **Verify resolver output first** (read-only `notification_recipients_for_item_event` /
  `notification_item_managers` spot-checks) before invoking any producer.
- **Avoid real family data** - use a QA circle / test accounts.
- **Do not run the outbox** until the queued row(s) are inspected and confirmed correctly targeted.
- **Push delivery needs separate explicit approval** plus a known test device/token.

## 7. Risk notes

1. **Wrong Supabase project in the Dashboard.** This machine has a second project; verifying (or worse,
   acting) in the wrong one is misleading. Mitigation: confirm ref `qccgshanmoeybagxwvcs` + the Sanad
   name before anything else; stop if it does not match.
2. **Accidental function invocation.** The Dashboard's Invoke/Test/Run button would actually run a
   function. Mitigation: do not click it on any function.
3. **Accidental outbox-processor run.** Invoking `process-notification-outbox` could send real pushes if
   queued rows exist. Mitigation: never invoke it; treat it as the highest-risk button.
4. **Accidentally enabling a schedule / cron.** Adding a schedule would start recurring production
   behavior. Mitigation: create no schedule; cron is a separate, later approval.
5. **Editing env secrets by mistake.** Changing/removing a function env var could break auth or delivery.
   Mitigation: view only; record missing vars for later; change nothing; reveal nothing.
6. **Assuming "deployed" means "scheduled".** Deployed functions are dormant until invoked; deploy created
   no schedule. Mitigation: treat the engine as idle until a deliberate cron/smoke-test approval.
7. **Interpreting the Docker warning as a failure.** 2F-6C showed `WARNING: Docker is not running` on
   every deploy, yet all four deployed successfully. Mitigation: do **not** redeploy because of that
   warning; the functions are present.
8. **Stale Dashboard view / cache.** A cached list might not show a function or its latest status.
   Mitigation: refresh the page; if a function still looks absent after a refresh, record it (do not
   redeploy reflexively).
9. **Deleting the temporary access token.** The deploy used a temporary `SUPABASE_ACCESS_TOKEN` (cleared
   from the shell in 2F-6C). Mitigation: **delete that temporary token from the Supabase Dashboard now**
   so it cannot be reused; never paste its value anywhere.

## 8. Recommendation

- **Commit this report** (focused docs-only commit).
- **User performs the Dashboard-only checklist manually** (Section 2), clicking no action buttons.
- **User reports back only:**
  - whether all **four functions are visible**,
  - whether the **project ref matched** (`qccgshanmoeybagxwvcs`),
  - whether **any error indicator** appeared,
  - whether they **deleted the temporary token**.
- **No screenshots containing secrets** (env values, tokens, keys).
- **Then proceed to Phase 2F-6E:** a manual Dashboard **verification record** (capturing the above) -
  still **no invocation, no cron, no smoke test**.

## 9. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace/CRLF errors).

## 10. Final confirmation

- Report created (this file) - the only filesystem write.
- No app source changed (`src/**` untouched).
- No Edge source changed (`supabase/functions/**` untouched - read-only).
- No migrations changed (`supabase/migrations/**` untouched).
- No generated types changed (`src/types/supabase.ts` untouched).
- No Supabase CLI run.
- No SQL run.
- No DB connection.
- No additional deploy.
- No Edge function invocation.
- No cron enabled/created.
- No notification delivery (no push sent).
- No env / secrets touched or revealed.
- No commit / no stage. No other project touched (ThinkMate untouched).

## 11. Final git state

Captured read-only at hand-off (`git --no-pager status --short` and `git --no-pager diff --stat`).
Expected: one **untracked** report file and an empty tracked `diff --stat`. Actual output:

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-06-26-phase-2f-6d-post-deploy-dashboard-verification-plan.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
