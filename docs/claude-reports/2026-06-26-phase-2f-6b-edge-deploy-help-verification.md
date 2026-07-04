# Phase 2F-6B - Supabase Edge deploy command help verification

**Status:** Report **only**, plus local CLI **help/version** output. **No deploy, no login, no link, no
token, no SQL, no DB/project-data connection, no cron, no function invocation, no push.** The only
Supabase CLI usage was `--version` and two `--help` commands (all local, no auth, no network to project
data). The sole filesystem write is this report.

**Baseline (pushed) commit:** `6146da0 docs(product): plan edge deploy safety`.
**SQL capability layer:** live and verified (2F-5.2). **App support:** committed (2F-5B). **Edge producer
code:** in repo, **not deployed**. **cron/delivery:** OFF.
**Cloud project ref (from the task):** `qccgshanmoeybagxwvcs`.
**Prior report:** `docs/claude-reports/2026-06-26-phase-2f-6a-edge-deploy-readiness-no-cron-plan.md`.

---

## 1. Executive summary

- **Nothing was deployed.** This phase only ran local CLI help/version (`npx supabase --version`,
  `npx supabase functions --help`, `npx supabase functions deploy --help`) plus the two local repo checks.
- **Only local CLI help/version was used** - no command authenticated, linked, logged in, listed remote
  resources, invoked a function, or deployed.
- **Exact deploy flags are now confirmed from real help output** (not assumed): the deploy usage is
  `supabase functions deploy [flags] <Function name...>`.
- **Project targeting flag is `--project-ref`** (exact spelling, confirmed): `--project-ref string
  Project ref of the Supabase project.` There is **no** `--project-id` on this subcommand.
- **`--no-verify-jwt` exists** (`Disable JWT verification for the Function.`). `supabase/config.toml`
  already declares `verify_jwt = false` for all four functions; to **guarantee** the intended behavior
  regardless of whether a targeted deploy re-reads config, the future deploy should **also pass
  `--no-verify-jwt`** (these endpoints are authorized by the `x-cron-secret` header, not a Supabase JWT).
- **Deploy still needs explicit approval later** because deploy is an outward-facing, hard-to-reverse
  action against the live project; this phase intentionally stops at command verification.
- **cron remains OFF** - deploying is not scheduling; cron is a separate, later approval.

## 2. Local CLI version

- **`npx supabase --version` ->** `2.105.0`
- **`package.json` devDependency:** `"supabase": "^2.105.0"` - so `npx supabase` runs the pinned local
  CLI (no global install), and the resolved version `2.105.0` **matches** the pinned dependency.
- **Newer-version notice:** none printed (the `--version` output was just the version string).
- **Does it matter for the plan?** No. The help output documented below is authoritative for `2.105.0`,
  which is exactly the version a future deploy would use via `npx`. If the dependency is later bumped,
  re-verify the help before deploying.

## 3. Help output findings

From `npx supabase functions --help` and `npx supabase functions deploy --help` (short snippets only):

- **Deploy command syntax.** `USAGE: supabase functions deploy [flags] <Function name...>`; description
  `Deploy a Function to the linked Supabase project.`
- **Positional argument for function name.** Yes - variadic:
  `Function name... string  Names of Functions to deploy. Deploys all if omitted.` So one or more function
  names are positional arguments.
- **Project targeting flag + exact spelling.** `--project-ref string    Project ref of the Supabase
  project.` (This is the flag to use; there is no `--project-id` on this subcommand.)
- **Multiple function names in one command?** **Yes** - the positional is `<Function name...>` (variadic),
  so several names can be passed to one `deploy`. **Caution:** with **no** names it "Deploys all if
  omitted", i.e. every function in the repo - so names must always be given explicitly.
- **`--no-verify-jwt` available?** **Yes** - `--no-verify-jwt    Disable JWT verification for the
  Function.`
- **`--use-api` / bundling flags?** Yes - `--use-api    Bundle functions server-side without using
  Docker.` (Relevant if Docker is unavailable locally; also `--import-map` and `--jobs, -j` are listed.)
- **Does it require being linked if a project ref is supplied?** The description says "the linked Supabase
  project", but the presence of `--project-ref` is the explicit way to target a project **by ref**. The
  help does **not** state that `link` is additionally required when `--project-ref` is supplied - so the
  plan uses `--project-ref` and does **not** run `supabase link`. (Authentication is separate - see the
  token note in Section 4.)
- **Warning relevant to not using `supabase link`.** None in the help text forbids it, but `--project-ref`
  makes `link` unnecessary. Separately, note the **dangerous** `--prune    Delete Functions that exist in
  Supabase project but not locally.` - this must **not** be used (it deletes remote functions).

*(Only short snippets are quoted above; nothing beyond the actual help output is asserted.)*

## 4. Future deploy command candidates (DO NOT RUN / APPROVAL REQUIRED)

Based strictly on the confirmed `2.105.0` help. **Do not run any of this now.**

**Temporary token setup (separate step; never paste a real token into source or chat).**
Generate a short-lived personal access token in the **Supabase Dashboard**, set it only in the deploy
shell session, and delete it right after:

```powershell
# Set for THIS session only (do not commit, do not log the value):
$env:SUPABASE_ACCESS_TOKEN = "<temporary-token>"

# ... run the deploy command(s) below ...

# Clear it from the session as soon as the deploy is done:
Remove-Item Env:\SUPABASE_ACCESS_TOKEN
```

The token should be **generated and later deleted from the Supabase Dashboard**, kept out of the repo,
`.env`, and any chat. Prefer this session-scoped env token over `supabase login` (the machine hosts a
second Supabase project; a global login could target the wrong one).

**Primary form - one command per function (maximum control; recommended):**

```powershell
# APPROVAL REQUIRED. DO NOT RUN in this phase. Run from E:\Projects\sanad-mobile only.
npx supabase functions deploy enqueue-due-reminders        --project-ref qccgshanmoeybagxwvcs --no-verify-jwt
npx supabase functions deploy check-missed-doses           --project-ref qccgshanmoeybagxwvcs --no-verify-jwt
npx supabase functions deploy process-notification-outbox  --project-ref qccgshanmoeybagxwvcs --no-verify-jwt
npx supabase functions deploy check-push-receipts          --project-ref qccgshanmoeybagxwvcs --no-verify-jwt
```

**Alternative form - single command, multiple names (help-confirmed):** the variadic positional supports
naming all four in one invocation. Still list every name explicitly (never the bare `deploy`):

```powershell
# APPROVAL REQUIRED. DO NOT RUN. Help confirms multiple <Function name...> are accepted.
npx supabase functions deploy enqueue-due-reminders check-missed-doses process-notification-outbox check-push-receipts --project-ref qccgshanmoeybagxwvcs --no-verify-jwt
```

**Why `--no-verify-jwt` is included.** `config.toml` sets `verify_jwt = false` for all four
`[functions.*]` blocks (these are called by pg_cron/pg_net with the `x-cron-secret` header, not a Supabase
JWT; the handlers enforce auth via `authorizeScheduledRequest()` and fail closed on the secret). Passing
`--no-verify-jwt` **guarantees** JWT verification stays off at deploy time even if a targeted deploy does
not re-read `config.toml`. If verification were left on, cron requests (which carry no JWT) would be
rejected at the platform layer before the handler runs. The flag applies to every function named in the
invocation, and all four intentionally have JWT off, so it is consistent in either form above.

**Rules honored:** no `supabase link`; no `db push`; no SQL/migration commands; no cron commands; no
function-invocation commands; every function named explicitly (never bare `deploy`, which would deploy
all); `--prune` deliberately omitted (it would delete remote-only functions). If Docker is unavailable
locally at execution time, `--use-api` (server-side bundling without Docker) is the documented option to
add - confirm need at execution, do not add speculatively.

## 5. No-cron / no-invocation boundary

- **Deploying functions is not the same as scheduling them.** A deployed function is dormant until
  invoked; `deploy` creates no schedule.
- **Do not create cron.** No pg_cron / pg_net schedule is part of deploy; scheduling is a separate, later
  approval.
- **Do not invoke functions.** Deploy does not run them; do not manually trigger any of the four.
- **Do not run the outbox processor manually.** `process-notification-outbox` is the only push sender; do
  not invoke it (queued rows would be sent).
- **No smoke test in this phase.** The controlled single-item test is a separate approval after deploy.
- **No push delivery.** Nothing in deploy sends a notification; delivery stays off until deliberately
  enabled much later.

## 6. Pre-deploy gate for the future execution phase (2F-6C)

Verify immediately before any actual deploy:

- **Clean git status** - no unexpected working-tree changes (deploy bundles the working tree).
- **Latest commit pushed** - deployed code should match a pushed commit.
- **Current branch `master` tracking `origin/master`** - deploying from the intended branch.
- **Project ref confirmed in the Dashboard** - `qccgshanmoeybagxwvcs` is the Sanad project.
- **Temporary access token ready** - `SUPABASE_ACCESS_TOKEN` set for the session only; deleted after.
- **No other-project / ThinkMate path** - run from `E:\Projects\sanad-mobile` only; never another repo.
- **No uncommitted Edge changes** - `supabase/functions/**` matches the intended commit.
- **No cron creation** - confirm none is added as part of deploy.
- **No function invocation** - deploy only; do not trigger any function.
- **`npm run check:mojibake`** - Arabic inbox copy stays well-encoded.
- **`git -c core.autocrlf=false diff --check`** - no whitespace/CRLF damage.
- **Optional Deno check if available** - `deno check supabase/functions/enqueue-due-reminders/index.ts`
  and `.../check-missed-doses/index.ts` (the accurate typecheck for the Deno functions; repo `tsc` covers
  only the Expo app). Deno was unavailable in earlier phases - if still unavailable, document the skip.

## 7. Risk notes (updated from real help output)

1. **Wrong project-flag misuse.** The flag is `--project-ref` (confirmed) - **not** `--project-id`. A
   typo'd ref, or omitting the flag entirely, would target the wrong/linked/default project. Mitigation:
   always pass `--project-ref qccgshanmoeybagxwvcs` and confirm the ref in the Dashboard first.
2. **Using `supabase link` by mistake.** Unnecessary - `--project-ref` targets the project explicitly.
   Do not run `link`.
3. **Global login / token context.** A global `supabase login` could point at the second project on this
   machine. Mitigation: session-scoped `SUPABASE_ACCESS_TOKEN`, removed right after; no persistent login.
4. **`verify_jwt` mismatch if a targeted deploy ignores config.** `--no-verify-jwt` exists; include it so
   JWT stays off (matching `config.toml` and the cron-secret auth model). Omitting it risks JWT being on,
   which would reject cron requests (no JWT) at the platform layer.
5. **Deploying all functions blindly.** `deploy` with no names "Deploys all if omitted", and `--prune`
   deletes remote-only functions. Mitigation: always name exactly the four target functions; never use
   `--prune`.
6. **Accidental invocation vs deploy.** Deploy does not run a function; do not confuse it with invoking
   one. No invocation in this rollout step.
7. **cron still separate.** Deploy schedules nothing; enabling cron is a distinct, later, separately-
   approved action. Keep it OFF.
8. **Queued outbox still dangerous if the processor is invoked.** Any pre-existing queued/claimable
   deliveries would be sent the moment `process-notification-outbox` runs. Mitigation: do not invoke it;
   before any future run, confirm the outbox is empty/expected.

## 8. Recommendation

**Conservative recommendation:** proceed to **Phase 2F-6C (deploy execution) only with explicit user
approval**, using the **per-function** commands in Section 4 (`--project-ref qccgshanmoeybagxwvcs
--no-verify-jwt`, session-scoped `SUPABASE_ACCESS_TOKEN`, no `link`, no `db push`, no `--prune`, names
listed explicitly). The help output **resolved** the earlier flag uncertainties (project flag, JWT flag,
multi-name support), so no further help phase is needed.

Two residual, non-blocking items to handle at execution rather than now:
- **Optional Deno static check first.** If a Deno-capable environment is available, run
  `deno check` on the two producers as a cheap pre-deploy gate (the repo `tsc` does not cover the Deno
  functions; Deno was unavailable in earlier phases). If unavailable, note the skip and proceed.
- **Docker vs `--use-api`.** If the deploy machine lacks Docker for bundling, add `--use-api`; confirm at
  execution, do not add speculatively.

**Do not enable cron**, do not invoke functions, and do not run a smoke test as part of 2F-6C - each is a
separate, later approval after the deploy is confirmed.

## 9. Validation

Local, read-only checks for this report:

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
- No Supabase deploy (no function deployed).
- No SQL run.
- No DB / project-data connection (CLI used for `--version` / `--help` only).
- No `supabase login` / no `supabase link`.
- No access token used or requested.
- No Edge function invocation.
- No cron enabled/created.
- No notification delivery (no push sent).
- No env / secrets touched (no `.env`, no tokens).
- No commit / no stage. No other project touched (ThinkMate untouched).

## 11. Final git state

Captured read-only at hand-off (`git --no-pager status --short` and `git --no-pager diff --stat`).
Expected: one **untracked** report file and an empty tracked `diff --stat`. Actual output:

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-06-26-phase-2f-6b-edge-deploy-help-verification.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
