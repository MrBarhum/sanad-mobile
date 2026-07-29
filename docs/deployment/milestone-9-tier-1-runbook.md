# Milestone 9 · Tier 1 runbook — the pre-launch blockers

Every step here is run **by the maintainer**. Nothing in this milestone was applied,
deployed, or executed against any database by the agent, per the standing rule that
backend changes are hand-applied.

Project ref: `qccgshanmoeybagxwvcs`.

---

## What Tier 1 changes

| # | Item | Kind | Files |
|---|---|---|---|
| A1 | Revoke `authenticated` EXECUTE on service-role-only functions | migration | `supabase/migrations/20260729120000_revoke_authenticated_execute_service_role_functions.sql` |
| A2 | Make the Milestone 8 policy assertion environment-independent | migration edit | `supabase/migrations/20260726160000_caregiver_least_privilege_rls.sql` |
| A3 | Add `ios.bundleIdentifier` | app config | `app.json` |

A3 needs no database step and is already verified — `npx expo config --type public`
resolves `bundleIdentifier: com.mrbarhum.sanadcare`, matching the Android `package`.

---

## A2 first — it needs no action on an existing database

The Milestone 8 migration is **already applied** in production, so editing its file
does **not** re-run it and does **not** change the production database. The Supabase
CLI tracks applied migrations by version and does not checksum their contents, so the
edit is inert for any database that has already run it.

The edit only matters for a database built **from scratch** out of this repo, where
the old absolute assertion (`= 70` policies) aborted the migration and took the whole
caregiver lockdown with it. Nothing to run. Verify at the next fresh replay.

> **Not verified empirically.** Replaying all 36 migrations into a scratch database
> would be the real proof, and it was not possible here: Docker is not running on this
> machine, so `supabase db start` cannot bring up a local stack. The change is argued
> statically in the migration's own comments (sections 1b and 7c). If you want the
> empirical proof, start Docker Desktop and run the replay in the appendix below.

---

## A1 — the CRITICAL EXECUTE gap

### Why this is not a "just revoke it" change

`revoke ... from public` does **not** remove an explicit grant held by a named role.
Supabase's `pg_default_acl` grants `anon`, `authenticated` and `service_role` EXECUTE
on every function created in `public`. Milestone 7 H1 removed `anon` and `PUBLIC` and
**deliberately left `authenticated` in place on all 65 functions** — correct for the
member-facing helpers, wrong for the service-role-only ones.

The danger in fixing it is the mirror image: revoking EXECUTE from a function that
`authenticated` genuinely needs breaks the app for every real user. Three routes make
a function need the grant even though nothing in the client calls it by name:

1. **An RLS policy expression** — evaluated as the querying role. The storage policies
   for the dose-proof bucket live in `docs/deployment/dose-proof-storage.sql`, *outside*
   `supabase/migrations/`, and call `public.storage_path_uuid()`. Revoking that one
   would break every dose-photo read while every migration-only search says it is unused.
2. **A user-scoped call inside an edge function** — `delete-account` calls
   `account_deletion_preflight` on `userClient(req)`, which runs as `authenticated`,
   not `service_role`.
3. **A call from inside a `SECURITY INVOKER` function** — an INVOKER body runs as the
   caller, so nested calls are checked against the caller. A `DEFINER` body runs as the
   owner and does not need the caller to hold EXECUTE.

Trigger functions are the opposite trap in the safe direction: PostgreSQL does **not**
check EXECUTE on a trigger function, so trigger use alone never justifies a grant.

The candidate list was derived from actual callers, not names, by
`scripts/analyze-function-grants.js` (read-only; run `node scripts/analyze-function-grants.js`
to regenerate `docs/claude-reports/milestone-9-probes/function-caller-matrix.csv`), then
each candidate was independently re-checked by an adversarial pass whose instruction was
to prove the revoke unsafe.

### Steps

**1. Capture the BEFORE evidence.** Both probes are read-only; the role matrix runs
inside a transaction it rolls back.

```
npx supabase db query --linked -f docs/deployment/milestone-9-execute-privilege-probe.sql -o csv > before-exec.csv
npx supabase db query --linked -f docs/deployment/milestone-8-role-probe-read.sql       -o csv > before-read.csv
```

**2. Apply the migration.**

```
npx supabase db push --linked
```

**3. Capture the AFTER evidence.**

```
npx supabase db query --linked -f docs/deployment/milestone-9-execute-privilege-probe.sql -o csv > after-exec.csv
npx supabase db query --linked -f docs/deployment/milestone-8-role-probe-read.sql       -o csv > after-read.csv
```

**4. Diff, and read the diffs against these acceptance criteria.**

```
diff before-exec.csv after-exec.csv
diff before-read.csv after-read.csv
```

### Acceptance criteria — stop if any of these fails

**`diff before-exec.csv after-exec.csv`**

- The only changed lines are `authenticated_execute` flipping `t` → `f`.
- Those lines are exactly the functions the migration names — no more, no fewer.
- No function gained `anon_execute`.
- No function lost `service_role_execute`.
- No row appeared or disappeared.

**`diff before-read.csv after-read.csv`**

- **Byte-identical for the `core` group.** This is the whole point: the five roles'
  visible data must not move by a single row. A1 changes function privileges only; if
  any count in the `core` group moves, something is wrong and the migration must be
  rolled back.
- The `cron` group may differ. Five pg_cron jobs write to notifications / outbox /
  deliveries / push tokens every 5–15 minutes, so those rows are a moving target — this
  is why the probe labels the group rather than omitting it. Exclude it from the strict
  comparison; do not let it mask a `core` change.
- A `sqlstate` moving to `42501` anywhere in the `core` group is a regression, not drift.

The migration also asserts its own post-state in both directions (the named functions
lost `authenticated`, and a named control set kept it) and will refuse to commit if
either is wrong. The probes exist because that assertion can only see functions it
already knows about; the probes enumerate `pg_proc` itself.

### Rollback

The migration ends with a commented `-- Undo` block listing the exact `grant execute`
statements to restore every revoked function. Applying it restores the previous state
exactly; re-running `milestone-9-execute-privilege-probe.sql` should then reproduce
`before-exec.csv` byte for byte.

### End-to-end check after applying

Beyond the probes, exercise one signed-in path per role — the probes prove *data
visibility* is unchanged, not that no screen throws. Worth covering:

- **admin / primary_caregiver** — open Home, log a dose, open Members, send an invite.
- **family_member** — Home, log a dose on a medication they are responsible for, complete a task.
- **caregiver (hired)** — her Today screen, record a dose.
- **remote_member** — Home and the Care Pulse feed.
- **Push** — confirm a reminder still arrives. A1 touches the notification functions
  more than anything else, so this is the highest-value single check: `enqueue-due-reminders`
  and `process-notification-outbox` run as `service_role` and must be unaffected.

---

## Appendix — empirical replay of A2 (optional, needs Docker)

```
# Docker Desktop must be running.
npx supabase db start                 # local stack from scratch
npx supabase db reset                 # replays every migration in supabase/migrations/
```

`db reset` replays all 36 migrations in filename order against an empty database. Before
the A2 edit this aborted inside `20260726160000` with
`M8 failed: expected 70 policies in public ... found 69`. After it, the run should
complete and emit the notice
`M8 verified: is_circle_caregiver present, 9 restrictive policies added, N total (was M)`.
