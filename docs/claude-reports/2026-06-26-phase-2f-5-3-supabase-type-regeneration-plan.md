# Phase 2F-5.3 - Supabase type regeneration plan / guarded execution plan

**Status:** Plan / report **only**. **This phase does not regenerate types.** No `supabase gen types`
was run, no Supabase CLI was used, no SQL was executed, no DB connection was made, no Edge was deployed,
and no code was changed except this report. The two validation commands in Section 9 (`check:mojibake`,
`git diff --check`) are the only commands run, and both are local, read-only, and require no typegen.

**Baseline commit:** `7af4e57 docs(product): verify notification SQL rollout`.

**Inputs inspected read-only (no writes):**
`package.json`; `src/types/supabase.ts`; `src/features/claiming/api.ts`;
`src/features/notifications/api.ts`; `src/features/notifications/schema.ts`;
`docs/claude-reports/2026-06-26-phase-2f-5-2-notification-sql-applied-verification.md`;
`docs/claude-reports/2026-06-26-phase-2f-5a-app-notification-settings-catalog-audit.md`;
`docs/claude-reports/2026-06-26-phase-2f-5-1-notification-sql-manual-apply-readiness.md`;
`supabase/migrations/20260626160000_backfill_phase_2a_assignment_columns.sql`;
`supabase/migrations/20260626161000_backfill_phase_2d_responsibility_rls.sql`;
`supabase/migrations/20260626162000_backfill_phase_2e_claim_flow.sql`;
`supabase/migrations/20260626163000_notifications_responsibility_types_preferences.sql`;
`supabase/migrations/20260626164000_notifications_responsibility_resolvers.sql`.
Also noted (existence only, contents not read): `supabase/config.toml` exists.

---

## 1. Executive summary

- **Why regeneration is now needed.** The live Sanad database has moved ahead of the committed
  `src/types/supabase.ts`. The user manually applied and verified the two inert notification migrations
  (`20260626163000` and `20260626164000`) per the 2F-5.2 applied-verification record, on top of the
  already-live Phase 2A columns, Phase 2D responsibility RLS/helpers, and Phase 2E claim RPCs (the
  `160000`/`161000`/`162000` files are repo *backfills* of objects already applied by hand). The
  generated types are a stale snapshot taken **after** the Phase 2A/2D columns were live but **before**
  the Phase 2E claim RPCs and the Phase 2F notification SQL. So the app's typed client no longer
  describes the true schema.

- **What new live schema items should appear after regeneration** (all confirmed absent today by direct
  grep of `src/types/supabase.ts`):
  - 7 new `notification_type` enum values: `item_assigned`, `task_overdue`, `visit_upcoming`,
    `item_claimed`, `item_completed`, `item_cancelled`, `claim_digest`.
  - 4 new `notification_preferences` columns: `assignment_alerts`, `activity_updates`,
    `available_to_claim_digest`, `visit_reminders`.
  - Widened `upsert_notification_preferences` (13 -> 17 args; +4 trailing optional args).
  - Widened `effective_notification_prefs` return shape (12 -> 16 fields; +4 preference booleans).
  - 6 Phase 2E claim RPCs: `list_available_to_claim`, `claim_care_task`,
    `claim_medication_responsibility`, `claim_care_appointment`, `claim_family_visit`,
    `set_assigned_appointment_outcome`.
  - 2 Phase 2D helper functions: `can_view_all_operational`, `is_responsible_for_medication`.
  - Likely also the 4 service_role-only resolvers from `164000`
    (`notification_item_owner`, `notification_item_managers`, `notification_recipients_for_item_event`,
    `notification_recipient_current`) - Edge-only; the app never calls them (see Section 2 note).
  - **Already present, so NOT added by regeneration:** `care_appointments.assigned_to`,
    `care_tasks.assigned_to`, `medications.responsible_user_id`.

- **Why this phase does not run typegen.** This project deliberately avoids the Supabase CLI unless
  explicitly approved (2F-5.1 / 2F-5.2). Type regeneration touches a large generated file, needs the
  correct project targeted (this machine hosts more than one Supabase project), and is a separate,
  reviewed step. Running it here would violate the phase guardrails and risk a wrong-project or
  encoding regression. This report only *plans* the run.

- **Why 2F-5B app changes should wait until types are regenerated.** The 2F-5A audit is explicit: adding
  the 4 new preference keys, the 7 new catalog labels/glyphs, and the widened `upsert` call against the
  stale types produces TypeScript errors (the 13-key Args type rejects the extra keys; reading the 4 new
  Row columns is a type error). Regeneration is a hard ordering dependency before 2F-5B.

- **Delivery / cron / Edge deploy remain OFF.** Nothing in this phase (or the type regeneration it plans)
  enables delivery, schedules cron, or deploys Edge. The SQL capability layer is live but inert; type
  regeneration only re-describes the schema to the app compiler.

## 2. Current generated types gap

Direct inspection of `src/types/supabase.ts` at baseline `7af4e57`. Legend: present = already in the
generated file; **ABSENT** = not in the file (stale); STALE-SHAPE = entry exists but is an outdated
signature/shape.

### Notification SQL (from `163000`)

| Item | In generated types today? | Evidence |
|---|---|---|
| enum `item_assigned` | **ABSENT** | grep of the 7 values -> no matches |
| enum `task_overdue` | **ABSENT** | grep -> no matches |
| enum `visit_upcoming` | **ABSENT** | grep -> no matches |
| enum `item_claimed` | **ABSENT** | grep -> no matches |
| enum `item_completed` | **ABSENT** | grep -> no matches |
| enum `item_cancelled` | **ABSENT** | grep -> no matches |
| enum `claim_digest` | **ABSENT** | grep -> no matches |
| `notification_type` union (Enums block) | STALE (8 values only) | L1572-1580: `medication_due, medication_missed, task_due, appointment_upcoming, visit_update, care_update, emergency, system` |
| `notification_type` array (Constants) | STALE (8 values only) | L1773-1782: same 8 values |
| pref col `assignment_alerts` | **ABSENT** | grep -> no matches (Row/Insert/Update all missing it) |
| pref col `activity_updates` | **ABSENT** | grep -> no matches |
| pref col `available_to_claim_digest` | **ABSENT** | grep -> no matches |
| pref col `visit_reminders` | **ABSENT** | grep -> no matches |
| `upsert_notification_preferences` args | STALE (13 args) | L1412-1429: `p_circle_id ... p_timezone` only |
| widened arg `p_assignment_alerts` | **ABSENT** | grep -> no matches |
| widened arg `p_activity_updates` | **ABSENT** | grep -> no matches |
| widened arg `p_available_to_claim_digest` | **ABSENT** | grep -> no matches |
| widened arg `p_visit_reminders` | **ABSENT** | grep -> no matches |
| `effective_notification_prefs` return | STALE (12 fields) | L1364-1380: returns the 8 legacy booleans + quiet-hours + timezone; missing the 4 new pref booleans |

### Claim / responsibility SQL (from `162000` and `161000`)

| Item | In generated types today? | Evidence |
|---|---|---|
| RPC `list_available_to_claim` | **ABSENT** | grep of the 6 claim RPCs -> no matches |
| RPC `claim_care_task` | **ABSENT** | grep -> no matches |
| RPC `claim_medication_responsibility` | **ABSENT** | grep -> no matches |
| RPC `claim_care_appointment` | **ABSENT** | grep -> no matches |
| RPC `claim_family_visit` | **ABSENT** | grep -> no matches |
| RPC `set_assigned_appointment_outcome` | **ABSENT** | grep -> no matches |
| helper `can_view_all_operational` | **ABSENT** | grep -> no matches |
| helper `is_responsible_for_medication` | **ABSENT** | grep -> no matches |
| col `care_appointments.assigned_to` | **PRESENT** | L20/36/52 (Row/Insert/Update) + FK L89-90 |
| col `care_tasks.assigned_to` | **PRESENT** | L187/206/225 + FK L252-253 |
| col `medications.responsible_user_id` | **PRESENT** | L758/772/786 + FK L799-800 |

**Key finding:** the responsibility *columns* (`assigned_to`, `responsible_user_id`) are **already** in
the generated types - captured by an earlier typegen after the Phase 2A/2D backfill was live. But the
Phase 2E claim *RPCs* that write those columns, and the Phase 2D *helpers*, are **absent**. This
precisely matches the deliberate note in `src/features/claiming/api.ts` (the claim RPCs "are live in the
DB but not yet in the generated Supabase types"). Regeneration will therefore **not** re-add these
columns; it will add the missing functions/enum values/pref columns.

### Note on Edge-only resolver RPCs

The 4 resolvers added by `164000` (`notification_item_owner`, `notification_item_managers`,
`notification_recipients_for_item_event`, `notification_recipient_current`) are **service_role-only**
(revoke all from public; grant execute to service_role). They are **ABSENT** today. The current
generated file already contains several service_role-only functions (`effective_notification_prefs`,
`notification_recipient_eligible`, `notification_source_validity`, `fanout_due_notifications`,
`claim_push_deliveries`, `mark_delivery_*`, `record_delivery_receipt`), which proves the generator emits
service_role-granted functions. So regeneration will **likely add these 4 resolvers too** - and that is
fine: **the app does not need to call them** (they are Edge/service-role internals). Their appearance in
the generated `Functions` map is harmless surface area, not a call site.

## 3. Expected post-regeneration diff

After a successful typegen from live, `src/types/supabase.ts` should change in these bounded ways (no
hand edits - see the last bullet):

1. **New notification enum values.** `notification_type` gains the 7 new values in **both** places it
   appears: the `Enums` union (near L1572) and the `Constants` array (near L1773). Order follows the
   catalog (enum sort order), so the new values may interleave or append depending on how they were
   added; expect all 7 present in each list.

2. **New notification preference columns.** `notification_preferences` `Row`, `Insert`, and `Update`
   each gain `assignment_alerts: boolean`, `activity_updates: boolean`,
   `available_to_claim_digest: boolean`, `visit_reminders: boolean` (Insert/Update as optional `?`).

3. **Widened `upsert_notification_preferences` Args.** The `Args` object (near L1412) gains 4 optional
   params: `p_assignment_alerts?`, `p_activity_updates?`, `p_available_to_claim_digest?`,
   `p_visit_reminders?` (17 total; the 4 new are optional because they carry SQL defaults). `Returns`
   stays `notification_preferences` Row (which itself now has the 4 new columns).

4. **Widened `effective_notification_prefs` Returns.** Its `Returns[]` row shape (near L1364) gains the
   same 4 preference booleans (12 -> 16 fields). Signature/`Args` unchanged.

5. **Claim RPC function entries (6).** New `Functions` entries for `list_available_to_claim`,
   `claim_care_task`, `claim_medication_responsibility`, `claim_care_appointment`, `claim_family_visit`,
   `set_assigned_appointment_outcome`, with the argument/return shapes defined in `162000` (e.g.
   `list_available_to_claim` returns the discovery table; the claim RPCs return their entity Row;
   `set_assigned_appointment_outcome` takes `p_appointment_id` + `p_status care_appointment_status`).

6. **Responsibility helper function entries (2).** New `Functions` entries for
   `can_view_all_operational(p_circle_id) -> boolean` and
   `is_responsible_for_medication(p_circle_id, p_medication_id, p_user_id) -> boolean` (granted to
   `authenticated`).

7. **Possibly Edge-only resolver entries (4).** New `Functions` entries for `notification_item_owner`,
   `notification_item_managers`, `notification_recipients_for_item_event`,
   `notification_recipient_current` (service_role-only; the app must not call them).

8. **No expected change** to `notification_recipient_eligible` or `notification_source_validity` type
   entries (their SQL bodies changed in `164000` but their signatures/return types did not), and **no
   re-add** of `assigned_to` / `responsible_user_id` columns (already present).

**No manual hand edits should be made to `src/types/supabase.ts`.** The file is generated end-to-end; the
only acceptable change is the full regenerated output. If a diff appears that these 8 points do not
explain, treat it as unexpected drift and stop (see Sections 5 and 7).

## 4. Typegen command strategy options

**No command below is executed in this phase.** These are options for the user to approve later.

### Option A - existing repo script

- **Finding: there is NO typegen script in `package.json`.** The `scripts` block contains exactly:
  `start`, `reset-project`, `android`, `ios`, `web`, `lint` (`expo lint`), and
  `check:mojibake` (`node ./scripts/check-mojibake.js`). A repo-wide grep for
  `gen types` / `typegen` in `*.json` returned no matches.
- **Relevant dependency:** `supabase` (the CLI) is pinned as a **devDependency** at `^2.105.0`, and
  `@supabase/supabase-js` at `^2.107.0`. So `npx supabase ...` runs the pinned CLI without a global
  install.
- **Action:** none. There is no existing script to run. If desired, a script could be *added later*
  under user approval, but this phase writes no code.

### Option B - one-time Supabase CLI typegen (REQUIRES USER APPROVAL BEFORE RUNNING)

Likely command shape (do **not** run now; targets the Sanad project explicitly; output to the one file):

```
# APPROVAL REQUIRED. Run from E:\Projects\sanad-mobile only. <SANAD_PROJECT_REF> is a placeholder -
# the user provides/confirms it from the Supabase Dashboard (Project Settings), NOT from .env.
npx supabase gen types typescript --project-id <SANAD_PROJECT_REF> > src/types/supabase.ts
```

Constraints this command satisfies (and must keep satisfying):
- **Targets Sanad explicitly** via `--project-id <SANAD_PROJECT_REF>` (a value the user confirms from the
  Dashboard). This avoids the "second project on this machine" hazard called out in 2F-5.1.
- **Outputs only to `src/types/supabase.ts`** - nothing else is written.
- **Does NOT use** `supabase link`, `supabase db push`, `supabase db pull`, `supabase migration ...`,
  or any `deploy`. It is read-only introspection of the live schema; it does **not** modify the remote DB.
- **No secrets in the command.** `--project-id` is a project reference (not a password). It does **not**
  read `.env`. The CLI needs the user to be authenticated first (`supabase login` done by the user
  out-of-band, or a `SUPABASE_ACCESS_TOKEN` the user supplies) - do not paste tokens into the repo or
  this report.
- **Do NOT use `--db-url`** (it would require the DB connection string / password - a secret) and **do
  NOT use `--linked`** (it implies `supabase link`, which is forbidden here).

Windows / PowerShell encoding caveat (important - see Section 7): PowerShell's `>` redirection writes
**UTF-16LE**, which would corrupt the generated file and trip `check:mojibake` / CRLF checks. When the
run is approved, redirect through a UTF-8 path instead - e.g. run the redirect in **Git Bash**
(`bash -lc 'npx supabase gen types typescript --project-id <ref> > src/types/supabase.ts'`) so the file
is written UTF-8/LF like the current one. Confirm the result is UTF-8 with LF endings before proceeding.
The exact flags (e.g. whether `--schema public` was used originally) should be chosen to **reproduce the
current file's shape** so the diff stays minimal; the current file is a single-`public`-schema output.

### Option C - Dashboard / API-generated types (needs confirmation)

- There is **no** documented no-CLI typegen path in this repo (no script, no note in the inspected
  reports beyond "regenerate from live"). Supabase's Dashboard/Management-API *can* return generated
  types (the same content the CLI fetches with `--project-id`), but the exact in-repo procedure for this
  project is **not established**. **This needs user confirmation; do not invent steps.** If the user
  prefers a no-CLI path, capture the confirmed procedure in the next phase before running anything.

## 5. Guardrails for the eventual typegen run

When the run is later approved:

- **Run from `E:\Projects\sanad-mobile`** (the Sanad repo root) only.
- **Verify a clean git status first** (`git --no-pager status --short` shows nothing unexpected) so the
  only post-run change is the regenerated file.
- **Do NOT run in ThinkMate Chess or any other repo/project.** This machine hosts more than one Supabase
  project; targeting the wrong one is the top risk (Section 7).
- **Do NOT run `supabase link`.**
- **Do NOT run `supabase db push`** (or `db pull`, or any `migration` subcommand).
- **Do NOT run migrations.**
- **Do NOT deploy Edge functions.**
- **Do NOT inspect `.env`** or any secret; the project ref comes from the Dashboard, not from env/config.
- **The only expected modified file is `src/types/supabase.ts`.**
- **If any other file changes, STOP and report** - do not stage, commit, or "fix up" the extra changes.

## 6. Post-typegen verification plan

After the future (approved) typegen run, the user should run this sequence. **Do not run these now** -
they are listed for the post-regeneration step; the only exceptions run now are the two read-only checks
in Section 9.

1. `git --no-pager status --short` - confirm only `src/types/supabase.ts` is modified.
2. Targeted check for the **new enum values** (expect all 7 present), e.g. grep for
   `item_assigned|task_overdue|visit_upcoming|item_claimed|item_completed|item_cancelled|claim_digest`
   in `src/types/supabase.ts`.
3. Targeted check for the **new preference columns** (expect all 4 present), e.g. grep for
   `assignment_alerts|activity_updates|available_to_claim_digest|visit_reminders`.
4. Targeted check for the **claim RPCs** (expect all 6 present), e.g. grep for
   `list_available_to_claim|claim_care_task|claim_medication_responsibility|claim_care_appointment|claim_family_visit|set_assigned_appointment_outcome`.
5. `npm run check:mojibake` - confirm the regenerated file introduced no mojibake (guards the Windows
   UTF-16 redirection hazard).
6. `git -c core.autocrlf=false diff --check` - confirm no whitespace/CRLF damage in the regenerated file.
7. `npx tsc --noEmit` - typecheck (there is no dedicated TS script; use the Expo tsconfig). This should
   still pass with the *existing* app code because the additions are additive (new enum values, new
   optional columns/args); the app compiles against the widened types without changes. If it does not,
   investigate before any app edit.
8. `npm run lint` (`expo lint`).

## 7. Risk analysis

1. **Wrong Supabase project.** The single biggest risk: this machine has a second Supabase project.
   Regenerating against the wrong project would overwrite `src/types/supabase.ts` with a foreign schema.
   Mitigation: require the user to confirm `<SANAD_PROJECT_REF>` from the Dashboard and pass it
   explicitly via `--project-id`; verify a couple of Sanad-specific tables/enums appear in the output
   before accepting it.
2. **CLI login / project-context risk.** `--project-id` needs the user authenticated (login or access
   token). A stale/expired login, or an account without access to the Sanad project, fails or (worse)
   resolves a different accessible project. Mitigation: user confirms auth + project access out-of-band;
   never store a token in the repo.
3. **Large generated-file diff.** Even a correct regeneration produces a sizable diff (7 enum values in
   2 places, 4 columns x 3 shapes, widened `upsert`/`effective_notification_prefs`, 6-12 new function
   entries). Mitigation: expect the Section 3 changes; review the diff against that list; any change not
   explained by Section 3 is a stop-and-review signal (possible unrelated live drift or wrong project).
4. **Stale schema cache after SQL apply.** Both migrations end with `notify pgrst, 'reload schema'`, and
   VERIFY 1/2 in 2F-5.2 confirmed the objects live. If typegen somehow reads a cached/older shape,
   re-run after confirming the Dashboard shows the 17-arg `upsert` and 7 enum values. Mitigation: the
   post-typegen grep checks (Section 6) catch a stale pull immediately.
5. **Accidental remote DB modification.** Using the wrong subcommand (`db push`, `migration up`, `link`
   then `db ...`) could alter the remote DB. Mitigation: the run uses only `gen types` (introspection);
   the Section 5 guardrails forbid every mutating subcommand.
6. **App compile break until code is adapted.** The additions are additive, so the *existing* app should
   still compile (no app usage references the new keys yet). The break risk is the reverse: 2F-5B code
   that references new keys must land **after** regeneration. Mitigation: strict ordering (regenerate,
   then 2F-5B); run `npx tsc --noEmit` after regeneration to confirm the baseline still compiles.
7. **Generated types include service-role-only functions.** Regeneration will likely add the 4 Edge-only
   resolvers (and they sit beside existing service_role-only functions). **The app must not call them** -
   they are not app APIs. Mitigation: treat them as inert type surface; keep all Edge-only calls in Edge
   (service role), never in `src/**`.
8. **Preserve the localized cast in `claiming/api.ts` until types are regenerated.** `callClaimRpc`
   exists *because* the 6 claim RPCs are absent from the generated types. Removing or "cleaning up" that
   cast before regeneration would break typing. Mitigation: leave `src/features/claiming/api.ts`
   untouched this phase; only after regeneration exposes the claim RPCs can the cast be replaced with a
   typed `supabase.rpc(...)` (optional 2F-5B cleanup, per the 2F-5A audit Section 9).

## 8. Recommendation

Safest immediate next step:

1. **Do not run typegen automatically.** Keep it a separate, user-approved step.
2. **Prepare an exact, user-approved command next.** Use Option B's shape, run from
   `E:\Projects\sanad-mobile`, output only to `src/types/supabase.ts`, via a UTF-8/LF-safe redirection
   (Git Bash), with none of the forbidden subcommands.
3. **Require the user to provide/confirm the Sanad `--project-id`** from the Supabase Dashboard (Project
   Settings), not from `.env`/config. Confirm the user is logged in / has an access token out-of-band.
4. **After typegen, commit only `src/types/supabase.ts`** with a focused commit (e.g.
   `chore(types): regenerate supabase types from live (2F-5.3)`), after the Section 6 verification
   passes. No other file should be in that commit.
5. **Then proceed to 2F-5B** app notification settings/catalog work (new enum labels + glyphs, the 4 new
   preference columns in the input/API layer, exposed toggles limited to live producers per the 2F-5A
   audit, deep-link fallbacks incl. `claim_digest` -> `/available-to-claim`), keeping delivery/cron/Edge
   deploy OFF.

## 9. Report-only validation

Only the two read-only, no-typegen checks were run for this report:

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results are shown inline below (also echoed in the hand-off message).

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace/CRLF errors).

## 10. Confirmation

- No code changed except this report.
- No Supabase CLI used.
- No typegen (`supabase gen types`) run.
- No SQL run.
- No DB connection made.
- No Edge deploy.
- No app source changed (`src/**` untouched).
- No Edge source changed (`supabase/functions/**` untouched).
- No migrations changed (`supabase/migrations/**` read-only).
- No generated types changed (`src/types/supabase.ts` untouched).
- No env / secrets touched (`supabase/config.toml` contents not read; only its existence noted).
- No commit / no stage. No cron/delivery enabled. No other project touched (ThinkMate untouched).

## 11. Final git state

Captured read-only at hand-off (`git --no-pager status --short` and `git --no-pager diff --stat`).
Expected: one **untracked** file (`??`) - this report - and an empty tracked `diff --stat`. Actual output
is shown inline below and in the hand-off message.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-06-26-phase-2f-5-3-supabase-type-regeneration-plan.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
