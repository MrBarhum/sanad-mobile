# Milestone 9 · Tier 1 — the pre-launch blockers

**Branch:** `milestone-9-audit-fixes` (worktree), based on `milestone-8-caregiver` @ `b1ac775`
**Date:** 2026-07-29
**Status:** **APPLIED AND VERIFIED** on `qccgshanmoeybagxwvcs` (Sanad-dev), 2026-07-29 ~15:42 UTC

> Applied under explicit instruction to do so. Evidence is in
> `docs/claude-reports/milestone-9-probes/` (before/after CSVs) and summarised in
> "Applied — verification results" at the foot of this document.

Tier 1 closes the three blockers from the pre-launch audit. Tier 2 has not been started
and is awaiting go-ahead.

---

## A1 · The CRITICAL EXECUTE gap

**Finding:** any signed-in user — including the hired caregiver, the least-privileged
role in the product — could execute every `SECURITY DEFINER` function in `public`.
`claim_push_deliveries` returns raw Expo push tokens for the whole instance and can be
used to claim-and-abandon the delivery queue, silently suppressing medication and
emergency pushes. `enqueue_notification` injects arbitrary notifications into any
account, bypassing quiet hours via `emergency` rows. Three recipient resolvers return a
circle's full roster, defeating both Milestone 8 roster guards.

**Root cause:** `revoke ... from public` does not remove an explicit named-role grant.
Supabase's `pg_default_acl` gives `authenticated` an explicit EXECUTE grant on every
function created in `public`. Milestone 7 H1 removed `anon` and `PUBLIC` and stopped
there — deliberately. Its own closing section says so, naming almost exactly this list:

> `authenticated` EXECUTE is left in place on all 65, including the internal plumbing
> (`enqueue_notification`, `fanout_due_notifications`, `claim_push_deliveries`,
> `mark_delivery_*`, `set_updated_at`). Tightening those is a separate,
> behaviour-affecting decision.

This migration is that deferred decision.

### How the list was derived

From **actual callers**, never from names. `scripts/analyze-function-grants.js` (new,
read-only, re-runnable) cross-references all 66 functions in `public` against every
route by which a caller could need EXECUTE, emitting
`docs/claude-reports/milestone-9-probes/function-caller-matrix.csv`.

Two traps that a name-based list walks straight into, both caught:

- **`storage_path_uuid` looked unused** — zero references in `supabase/migrations/`. It
  is called by five storage policies in `docs/deployment/dose-proof-storage.sql`,
  *outside* the migrations directory, and a storage policy is evaluated as the querying
  role. Revoking it would have broken every dose-photo read. It keeps the grant, as do
  `can_view_all_operational`, `is_circle_member` and `is_responsible_for_medication`,
  which those same policies call.
- **The delivery pipeline is invoked as `rpcChecked(sb, 'name', …)`** — the function
  name is the *second* argument, so a grep for `.rpc('name'` misses all twelve. Verified
  separately that no `rpcChecked` call anywhere uses a user-scoped client.

A third trap in the opposite direction: `deactivate_push_token` (client, keeps the
grant) versus `deactivate_push_token_by_id` / `_value` (edge-only, revoked). Nearly
identical names, opposite classification.

The analyzer is deliberately **strict about declarations and liberal about references**:
over-detecting a reference keeps a function *out* of the revoke list, which is the safe
direction. Stripping SQL comments is applied only when finding declarations — that alone
removed a phantom 67th function, `foo`, which is prose inside an H1 comment.

### Verification performed

| Check | Result |
|---|---|
| Adversarial pass: 30 agents, one per candidate, instructed to **prove the revoke unsafe** across all six routes | **30/30 safe, 0 unsafe, 0 low-confidence** |
| `scripts/check-execute-revoke-consistency.js` — the migration's two declarations agree, and no revoked function has a client / user-scoped-edge / policy / DEFAULT caller | **PASS** |
| Migration's own assertion block — forward and reverse | written; runs at apply time |

The migration asserts in **both** directions. Forward: the 30 named functions lost
`authenticated` and none is `anon`-executable. Reverse: a 30-function control set of
RLS/storage helpers and client RPCs **still** holds `authenticated` EXECUTE, and the 14
functions the edge functions call **still** hold `service_role`. The reverse half is the
regression guard — it is what would catch this migration revoking one function too many.

### What is revoked — 30 functions in four groups

| Group | Count | Rationale |
|---|---|---|
| **A** — invoked by an edge function on the **service** client | 14 | cron-driven pipeline; keeps `service_role` |
| **B** — reached only from inside another `SECURITY DEFINER` body | 11 | a DEFINER body executes as its owner, so no caller role needs EXECUTE |
| **C** — trigger functions | 4 | PostgreSQL checks EXECUTE at `CREATE TRIGGER` time, not at fire time — H1 probed this empirically on this instance |
| **D** — dead | 1 | `is_circle_medication_schedule` has no caller in any layer; superseded by `is_circle_medication_schedule_for_medication`. Listed separately rather than blurred into the others; it should be **dropped** outright in a later pass. |

`service_role` is untouched everywhere. No policy, table grant, or function body changes
— this migration moves function privileges only, which is why the read matrix must come
back byte-identical.

**Files:** `supabase/migrations/20260729120000_revoke_authenticated_execute_service_role_functions.sql`,
`docs/deployment/milestone-9-execute-privilege-probe.sql`,
`scripts/analyze-function-grants.js`, `scripts/check-execute-revoke-consistency.js`

---

## A2 · The Milestone 8 policy-count assertion

**Finding:** `20260726160000` hard-asserted exactly 70 policies in `public` ("61 before +
9 new"). Replaying the repo from scratch yields 69, so the migration aborted and took the
entire caregiver lockdown with it.

**Fix:** the absolute count is replaced by a snapshot taken **before** the first
`create policy` (new section 1b) and two environment-independent assertions in 7c:

1. **No pre-existing policy disappeared** — compared as a **set**, not a count. Dropping
   one policy while adding another leaves a total unchanged but destroys access; a
   count-only test waves that through.
2. **The net change equals `array_length(expected, 1)`** — the same array section 7b
   already loops over, so the assertion can no longer drift from the policy list it is
   meant to check.

Two implementation details worth recording:

- A temp table, not a session GUC, because the check compares the *set* of policies.
- Deliberately **not** `on commit drop`. That is only correct if the file is applied
  inside an explicit transaction block; applied without one, each statement commits on
  its own, the table would vanish the instant it was created, and the assertion would
  fail against a perfectly good database. A plain session-scoped temp table works either
  way and is dropped explicitly after the assertion.

**Editing an already-applied migration is safe here.** The Supabase CLI tracks applied
migrations by version and does not checksum contents, so this does not re-run and does
not change production. It only affects a database built from scratch — which is exactly
the failure being fixed.

> **Not proven empirically.** The real proof is replaying all 36 migrations into a
> scratch database, and that was not possible: Docker is not running on this machine, so
> `supabase db start` / `db reset` cannot bring up a local stack. The change is argued
> statically in the migration's own comments. The exact replay commands are in the
> runbook appendix for when Docker is available.

**File:** `supabase/migrations/20260726160000_caregiver_least_privilege_rls.sql`

---

## A3 · `ios.bundleIdentifier`

Added as `com.mrbarhum.sanadcare`, matching the Android `package`. Verified through
Expo's own resolver — `npx expo config --type public` now emits both:

```
bundleIdentifier: 'com.mrbarhum.sanadcare',
package: 'com.mrbarhum.sanadcare',
```

**File:** `app.json`

---

## Repo checks after the change

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `expo lint` | 31 problems — **identical to baseline**; the two new scripts add none |
| `check:i18n` | exact parity, 1247 keys |
| `check:mojibake` | clean (274 files) |
| `expo config --type public` | resolves |

No TypeScript source was modified in Tier 1.

---

## What the maintainer must run

See **`docs/deployment/milestone-9-tier-1-runbook.md`**. In short: capture the two
before-probes, `db push`, capture the two after-probes, diff.

Stop conditions, restated because they matter:

- `before-exec.csv` → `after-exec.csv`: the only changed lines may be
  `authenticated_execute` flipping `t` → `f`, on exactly the 30 named functions. No row
  may appear or disappear; nothing may gain `anon`; nothing may lose `service_role`.
- `before-read.csv` → `after-read.csv`: **byte-identical for the `core` group.** The
  `cron` group is a moving target (five pg_cron jobs write every 5–15 minutes) and is
  labelled so it can be excluded — but it must not be allowed to mask a `core` change. A
  `sqlstate` of `42501` appearing anywhere in `core` is a regression, not drift.

Rollback is documented at the foot of the migration; applying it should reproduce
`before-exec.csv` byte for byte.

---

## Notes carried forward

- **The gap can silently reopen.** `pg_default_acl` grants `authenticated` EXECUTE on
  every *newly created* function in `public`. Any future service-role-only function will
  arrive open unless it is explicitly revoked. The privilege probe is the guard; running
  it in CI, or as a periodic check, would turn this from a one-off fix into an invariant.
- **`is_circle_medication_schedule` should be dropped**, not merely revoked. Out of
  scope for Tier 1.
- **This worktree has its own real `node_modules`** (631 packages, resolves locally),
  unlike `milestone-8-caregiver`, whose `node_modules` is a symlink into the
  `milestone-7-prelaunch` worktree. That symlink was flagged in the audit as a
  release-build integrity risk; it does not affect this branch.

---

# Applied — verification results

Applied to `qccgshanmoeybagxwvcs` (Sanad-dev) on 2026-07-29 at ~15:42 UTC via
`npx supabase db push --linked`. `supabase migration list --linked` beforehand
confirmed **exactly one** migration was pending — `20260729120000` — and that
`20260726160000` was already applied remotely, so the A2 edit did not re-run.

## Migration self-assertion (at apply time)

```
NOTICE (00000): M9 A1 verified: 30 functions revoked from authenticated,
                14 still service_role-executable,
                30 control functions still authenticated-executable
```

Both directions passed: the revoke landed, **and** the control set of RLS/storage
helpers and client RPCs kept `authenticated`.

## Probe 1 — EXECUTE privilege matrix

`before-exec.csv` → `after-exec.csv`, judged by `scripts/compare-execute-probe.js`:

| Acceptance criterion | Result |
|---|---|
| Only `authenticated_execute` changed, `true` → `false` | ✅ |
| Changed on exactly the 30 named functions | ✅ 30/30 |
| No untargeted function lost `authenticated_execute` | ✅ |
| No row added or removed | ✅ 66 / 66 |
| Nothing gained `anon_execute` | ✅ |
| Nothing lost `service_role_execute` | ✅ |
| All 30 targets closed after apply | ✅ |

**Pre-apply state confirmed the finding:** all 30 targets were open to
`authenticated`, and 36 non-target functions were legitimately
authenticated-executable (30 + 36 = 66).

> **A parsing error worth recording.** The first pass at reading this CSV used a
> naive `split(',')` and reported that only 15 of 30 targets were open.
> `pg_get_function_identity_arguments` emits comma-separated argument lists, which
> the CLI correctly quotes; the naive split shifted every column for
> multi-argument functions and produced confident nonsense. `compare-execute-probe.js`
> now carries a real CSV parser, and the note above it, so the mistake cannot recur.

## Probe 2 — role × read-surface matrix (collateral damage)

`before-read.csv` → `after-read.csv`:

- **`diff` returned zero differences across the ENTIRE file** — not merely the
  `core` group. 126 rows, byte-identical.
- `core` group isolated: 55 rows, byte-identical.
- `42501` count unchanged at **14 → 14** (pre-existing expected refusals, e.g.
  `remote_member` refused the claim feed, plus the Milestone 8 caregiver refusals).

No role's visible data moved by a single row, which is what A1 promised: it changes
function privileges only.

## Functional check — the notification pipeline

A1 touches the notification functions more than anything else, so the probes alone
are not sufficient.

`supabase functions invoke` was **not** used: `enqueue-due-reminders` and
`process-notification-outbox` authorize on the shared secret
`NOTIFICATIONS_CRON_SECRET` and fail closed without it, and handling that secret was
avoided deliberately. The scheduled path was observed instead
(`docs/deployment/milestone-9-pipeline-health-probe.sql`), which needs no secret and
is stronger evidence — it exercises the path that actually runs in production.

- All 5 pg_cron jobs **active**.
- `sanad-enqueue-due-reminders` and `sanad-process-notification-outbox`: **24/24
  succeeded** in the preceding 2 hours, latest 15:45:00 — post-revoke.
- **`net._http_response`: 33 responses in 60 minutes, every one `200`**, spanning
  14:50 → 15:45. Not one non-200. This is the real check — pg_cron reports
  "succeeded" when the *SQL statement* dispatching via `pg_net` succeeds, which
  says nothing about what the edge function returned.
- `process-notification-outbox` calls **`fanout_due_notifications` and
  `claim_push_deliveries` unconditionally at the top of every run**, through
  `rpcChecked`, which throws on error. Both are in the revoke list, and
  `claim_push_deliveries` is the push-token leak itself. An HTTP 200 therefore
  proves both still execute as `service_role`. Same for `enqueue-due-reminders`,
  which calls `circle_notification_recipients`,
  `notification_recipients_for_item_event`, `notification_item_managers` and
  `enqueue_notification` — four more revoked functions.

### What this does NOT prove

The pipeline produced **zero rows** in the window (most recent: `notifications` and
`notification_outbox` at 12:00, `push_deliveries` at 12:05). Nothing was due, so
"still enqueues" is **not** directly demonstrated — only "still runs, still reaches
every revoked function without a permission error, still returns 200".

To close that gap properly, either wait for a real due dose on the dev circle, or
create a schedule due within the next 5 minutes and re-run the health probe. That
would be a data mutation on a shared database and was not done unprompted.

## Rollback

Not needed — no criterion failed. The undo block at the foot of the migration
remains the documented path, and re-running the privilege probe after it should
reproduce `before-exec.csv` byte for byte.
