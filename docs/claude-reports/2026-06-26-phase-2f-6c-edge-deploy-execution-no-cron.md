# Phase 2F-6C - Edge deploy execution (no cron, no invocation)

**Status:** Execution record. The **user deployed the four notification Edge Functions manually** from
`E:\Projects\sanad-mobile` and pasted the terminal output reproduced below; this report documents that
deploy. **In this report phase Claude ran no Supabase CLI, deployed nothing again, invoked no function,
enabled no cron, sent no push, ran no SQL, and made no DB connection.** The only commands run here are the
two local read-only checks in Section 8. The sole filesystem write is this report.

**Baseline (pushed) commit:** `c4f96a2 docs(product): verify edge deploy command flags`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**Prior phases:** 2F-6A readiness/no-cron plan; 2F-6B CLI help verification.

---

## 1. Executive summary

- **Edge deploy succeeded.** All four notification Edge Functions were deployed to project ref
  `qccgshanmoeybagxwvcs`.
- **Functions deployed:** `enqueue-due-reminders`, `check-missed-doses`, `process-notification-outbox`,
  `check-push-receipts`.
- **Flags used:** `--project-ref qccgshanmoeybagxwvcs` and `--no-verify-jwt` on every deploy (matching
  `config.toml`'s `verify_jwt = false` + the `x-cron-secret` auth model verified in 2F-6A/2F-6B).
- **No cron was created or enabled.** Deploying does not schedule anything.
- **No function was invoked.** Deploy only uploaded code; nothing ran.
- **No push was sent.** The only push sender (`process-notification-outbox`) was not invoked.
- **Working tree remained clean.** Pre- and post-deploy `git status -sb` both showed
  `## master...origin/master` with an empty `--short`; no local files changed by the deploy.
- **The Docker warning did not block deploy.** Each command printed `WARNING: Docker is not running` yet
  every function deployed successfully (the CLI bundled/uploaded without Docker).

## 2. Function deployment table

| Function | Deploy command used | Result | Uploaded shared assets (summary) | Classification | Creates/sends only if invoked? |
|---|---|---|---|---|---|
| `enqueue-due-reminders` | `npx supabase functions deploy enqueue-due-reminders --project-ref qccgshanmoeybagxwvcs --no-verify-jwt` | Deployed OK (Docker warning, non-blocking) | `index.ts` + `_shared/`: `auth`, `config`, `enqueue`, `log`, `messages`, `supabase`, `time` (**no** `expo`/`db`) | **Producer** | Creates `notifications` + outbox rows **only if invoked**; does **not** send push |
| `check-missed-doses` | `npx supabase functions deploy check-missed-doses --project-ref qccgshanmoeybagxwvcs --no-verify-jwt` | Deployed OK (Docker warning, non-blocking) | `index.ts` + `_shared/`: `auth`, `config`, `enqueue`, `log`, `messages`, `supabase`, `time` (**no** `expo`/`db`) | **Producer** | Creates `notifications` + outbox rows (owner + tier-2 manager) **only if invoked**; no push |
| `process-notification-outbox` | `npx supabase functions deploy process-notification-outbox --project-ref qccgshanmoeybagxwvcs --no-verify-jwt` | Deployed OK (Docker warning, non-blocking) | `index.ts` + `_shared/`: `auth`, `config`, `db`, `expo`, `log`, `messages`, `supabase` (**no** `enqueue`/`time`) | **Delivery processor** (only push sender) | Sends Expo push **only if invoked** and queued/claimable rows exist |
| `check-push-receipts` | `npx supabase functions deploy check-push-receipts --project-ref qccgshanmoeybagxwvcs --no-verify-jwt` | Deployed OK (Docker warning, non-blocking) | `index.ts` + `_shared/`: `auth`, `config`, `db`, `expo`, `log`, `supabase` (**no** `messages`/`enqueue`/`time`) | **Receipt checker** | Updates receipt/delivery state and may retire dead tokens **only if invoked**; no push, no notification created |

**Bundle-manifest cross-check (correctness signal).** Each function's uploaded asset list matches exactly
its import closure - and notably the two **producers did NOT bundle `_shared/expo.ts`**, so they are
structurally incapable of sending an Expo push, while only `process-notification-outbox` and
`check-push-receipts` bundle `expo.ts` (+ `db.ts`). The producers bundle `enqueue.ts` + `messages.ts` +
`time.ts` (which the delivery/receipt functions do not). This confirms the deployed bundles reflect the
intended per-function dependencies and reinforces the producer-vs-delivery boundary at the code level.

## 3. Safety boundary after deploy

- **Deploying functions does not run them.** The four functions are now uploaded but **dormant** - code
  at rest, invoked by nothing.
- **Cron is still OFF.** No pg_cron / pg_net schedule was created; deploy schedules nothing.
- **Manual invocation is still prohibited.** Do not trigger any of the four (dashboard invoke, curl with
  the cron secret, etc.).
- **`process-notification-outbox` must not be invoked until rows are verified** in a separate,
  approved smoke test - it is the only push sender, and any queued/claimable deliveries would be sent on
  first run.
- **Push delivery remains OFF** because no delivery-processor invocation occurred and none is scheduled.
- **Scheduled production behavior has not started.** Nothing recurring is running; the engine is deployed
  but idle.

## 4. Token handling

- A **temporary** Supabase personal access token was supplied to the deploy via the
  `SUPABASE_ACCESS_TOKEN` environment variable (session-scoped), not via `supabase login`.
- The deploy script **removed it from the shell after deploy** (cleared in a `finally` step), so it does
  not persist in the environment.
- **Action for the user:** delete the temporary token from the **Supabase Dashboard** now that the deploy
  is complete, so it cannot be reused.
- **No token value was written** to the repo, logs, this report, or chat. (This report references only the
  variable name, never a value.)

## 5. CLI / Docker notes

- **CLI version used:** `2.105.0` (the pinned `supabase` devDependency; run via `npx`).
- **Newer-version notice:** the CLI printed `A new version of Supabase CLI is available: v2.109.0
  (currently installed v2.105.0)`. It was **informational and non-blocking** - the deploy proceeded and
  succeeded on `2.105.0`. No upgrade is required for this rollout.
- **Docker warning:** every deploy printed `WARNING: Docker is not running`, yet each function **deployed
  successfully** - the CLI bundled/uploaded server-side without a local Docker daemon.
- **Do not re-run deploy just because the Docker warning appeared.** The warning is expected when Docker
  is off and did not affect the result; re-deploying would be redundant.
- **`--use-api`** (server-side bundling without Docker) is available and should be considered **only if a
  future deploy actually fails** due to Docker/bundling - it was **not** needed here since the deploy
  succeeded as-is.

## 6. What is now live vs still inactive

**Now live (deployed code, at rest):**
- Responsibility-aware **due reminders** (`enqueue-due-reminders`): owner-targeted medication/task/
  appointment/visit reminders + the `task_overdue` path, per-item resolver, `entity`/`itemId` payloads.
- **Missed-dose** owner targeting + tier-2 **manager escalation** (`check-missed-doses`).
- **Delivery processor** bundle refreshed (`process-notification-outbox`) - unchanged logic, current
  `_shared` bundle.
- **Receipt checker** bundle refreshed (`check-push-receipts`) - unchanged logic, current `_shared`
  bundle.

**Still inactive:**
- **No cron** - nothing is scheduled.
- **No production invocation** - no function has been triggered.
- **No smoke test** - not run in this phase.
- **No notification delivery** - no push sent.
- **No scheduled reminders** - producers are not running.
- **No outbox processing run** - the delivery processor has not executed.

## 7. Next recommended phase

- **Commit this report** (focused docs-only commit).
- **Then Phase 2F-6D - post-deploy dashboard / manual verification plan (no invocation):**
  - Verify the four functions **exist** in the Supabase Dashboard (Edge Functions list) and show the
    expected deployed version - **read-only**, no invoke.
  - Optionally verify **no cron jobs** exist (Dashboard, or a read-only `cron.job` check) **later, under
    separate approval**.
  - **Do not smoke test yet.**
  - **Do not enable cron yet.**
  - **Do not run the outbox processor.**

## 8. Validation for this report

Local, read-only checks only (no Supabase CLI, no deploy, no invocation, no SQL):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace/CRLF errors).

## 9. Final confirmation

- Report created (this file) - the only filesystem write.
- No app source changed (`src/**` untouched).
- No Edge source changed after deploy (`supabase/functions/**` untouched; deploy uploaded the already-
  committed code, and the working tree stayed clean).
- No migrations changed (`supabase/migrations/**` untouched).
- No generated types changed (`src/types/supabase.ts` untouched).
- No Supabase CLI run in this report phase.
- No SQL run.
- No DB connection.
- No additional deploy (the deploy was the user's separate, prior step).
- No Edge function invocation.
- No cron enabled/created.
- No notification delivery (no push sent).
- No env / secrets touched (token handled by the user; no value read/written here).
- No commit / no stage. No other project touched (ThinkMate untouched).

## 10. Final git state

Captured read-only at hand-off (`git --no-pager status --short` and `git --no-pager diff --stat`).
Expected: one **untracked** report file and an empty tracked `diff --stat`. Actual output:

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-06-26-phase-2f-6c-edge-deploy-execution-no-cron.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
