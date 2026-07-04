# Phase 2F-3 — Inert responsibility-aware notification migrations created

**Status:** Two **inert** notification SQL migration files created from the reviewed Phase 2F-2
proposal. **No SQL was run, no Supabase CLI used, no DB connection made, no app source / generated
types / Edge Functions / historical migrations / env changed, and nothing was committed or staged.**
The **producer** migration was intentionally **NOT** created (deferred).
**Baseline commit:** `7cb8491 docs(product): propose responsibility-aware notification SQL`.
**Source proposal:** `docs/claude-reports/2026-06-26-phase-2f-2-responsibility-aware-notification-sql-proposal.md`.

---

## 1. Summary of files created

| # | File | Contents | Runtime effect |
|---|---|---|---|
| 1 | `supabase/migrations/20260626163000_notifications_responsibility_types_preferences.sql` | 7 new `notification_type` enum values (`add value if not exists`); 4 new `notification_preferences` columns; drop old 13-arg `upsert_notification_preferences` + recreate widened 17-arg signature | **Inert** — produces no notification |
| 2 | `supabase/migrations/20260626164000_notifications_responsibility_resolvers.sql` | `effective_notification_prefs` (drop+recreate, expanded return); `notification_recipient_eligible` (new types + remote exclusion); `notification_item_owner`; `notification_item_managers`; `notification_recipients_for_item_event`; `notification_recipient_current`; `notification_source_validity` (create-or-replace with recipient-currency gate + `task_overdue` fold + `visit_upcoming` branch) | **Inert** — nothing calls the resolvers until a producer exists |
| — | `docs/claude-reports/2026-06-26-phase-2f-3-inert-notification-migrations-created.md` | This report | n/a |

Both migrations were transcribed **verbatim** from the polished Phase 2F-2 proposal — file 1 from
§13-A (A1/A2/A3), file 2 from §13-B (B1/B2/B3.1/B3.2/B3.3/B4/B5) — with **full SQL bodies** (no
placeholders such as "body exactly as above"). Each file carries a house-style header (no
`begin;/commit;` wrapper; the runner wraps each file in its own transaction) and ends with
`notify pgrst, 'reload schema';`, consistent with the three existing backfill migrations
(`20260626160000/161000/162000`).

## 2. Confirmation: only inert migration files were created

Both new files are **inert** by construction:

- **File 1** adds enum values, adds defaulted preference columns, and re-creates a client RPC's
  signature. None of these creates or delivers a notification. The 4 new columns default to
  `true/true/false/true`; no existing behavior changes.
- **File 2** adds/updates recipient-resolution and send-time-validation functions. **Nothing enqueues
  or delivers** through them: there is no `enqueue_notification` call, no trigger, no cron, and no
  Edge change. The resolvers are only reachable once a producer (deferred) calls them.

No RLS policy is created or altered; no data is written; no delivery is enabled.

## 3. Confirmation: producer migration was NOT created

`supabase/migrations/20260626165000_notifications_responsibility_producers.sql` was **not created**.
Directory listing of `supabase/migrations/` after this phase ends at `20260626164000` — the producer
file does not exist. It stays deferred until Edge Functions (2F-4), app settings + generated types
(2F-5), and a deliberate delivery decision (2F-6) are aligned, per proposal §3/§17. Creating it now
would be the **activation switch** (it would begin creating notification rows), which this phase
explicitly avoids.

## 4. Source report used

`docs/claude-reports/2026-06-26-phase-2f-2-responsibility-aware-notification-sql-proposal.md`
— apply-pack §13 (A = file 1; B = file 2; C = deferred producers, not created).

## 5. Transaction / enum-ordering note

- **File 1 (`…163000…`) adds the enum values** via `alter type public.notification_type add value if
  not exists '…'` (×7). A newly added enum value **cannot be USED in the same transaction that adds
  it** (PostgreSQL restriction), and enum values **cannot be dropped** (irreversible).
- **File 2 (`…164000…`) references those values** — `notification_recipient_eligible`,
  `notification_recipients_for_item_event`, and `notification_source_validity` all switch on
  `item_assigned` / `task_overdue` / `visit_upcoming` / `item_claimed` / `item_completed` /
  `item_cancelled` / `claim_digest`.
- Because the migration runner **wraps each file in its own transaction**, file 1's `ADD VALUE`
  statements **commit before** file 2 runs, so the new values are already usable when file 2's
  functions are created. Keeping the enum adds in a **separate, earlier** file is what prevents the
  same-transaction enum-use error. File 1's own preference-column ADDs and upsert recreate do **not**
  reference any new enum value, so they are safe to co-locate with the `ADD VALUE`s.
- Apply order is therefore fixed: **`…163000…` first, then `…164000…`** (their lexicographic
  timestamp order already enforces this).

## 6. Static dependency review (repo text search only)

> **Scope disclaimer.** This is a **static repository review only** — `Grep`/`Select-String` over
> repo files. **No database connection or catalog query was made.** Actual dependency behavior
> (`pg_depend`) must still be **verified on a scratch/staging DB before applying**. In particular, if
> Postgres raises a dependency error (`2BP01 … other objects depend on it`) when dropping
> `effective_notification_prefs`, **do NOT use `drop … cascade`** — recreate the named dependents in
> order after the expanded function instead.

Legend: **engine** = `supabase/migrations/20260611120100_create_notification_functions.sql` (the
committed notification engine); **types** = `src/types/supabase.ts` (generated — reflection only, not
a runtime dependency); **snapshot/docs** = `docs/claude-reports/*.sql` (historical Dashboard
snapshots, **not applied migrations**) and `docs/**/*.md` prose. The two new files below are the ones
created in this phase.

### 6.1 `effective_notification_prefs` (drop + recreate in file 2 — return shape changes)

Repo references / callers found:

- **engine** L90 definition; L140–141 revoke/grant.
- **engine** L186 — called inside `notification_recipient_eligible`.
- **engine** L232 — called inside `circle_notification_recipients` (`language sql`, `cross join
  lateral`).
- **engine** L738 — called inside `fanout_due_notifications`.
- **engine** L916 — called inside `claim_push_deliveries`.
- **new file 2** — additionally called by `notification_item_managers` and
  `notification_recipients_for_item_event` (and re-created `notification_recipient_eligible`).
- **types** L1364; **snapshot** `2026-06-11-step-6-0-notifications-dashboard-complete.sql`
  (507/557/558/603/649/1155/1333); **docs** prose.

Interpretation: every caller is a **function body** that references the function **by name**.
PostgreSQL does **not** record `pg_depend` edges for function→function references in either
`plpgsql` or `sql` bodies, so the plain `drop function` is **expected to succeed** and the callers
re-resolve to the new definition at next call. This is the drop that most warrants scratch-DB
verification (see disclaimer) because its return shape changes.

### 6.2 `notification_recipient_eligible` (create-or-replace in file 2 — signature unchanged)

Repo references / callers found:

- **engine** L152 definition; L202–203 revoke/grant.
- **engine** L235 — called inside `circle_notification_recipients`.
- **engine** L720 — called inside `fanout_due_notifications`.
- **engine** L883 — called inside `claim_push_deliveries`.
- **new file 2** — additionally called by `notification_recipients_for_item_event` and
  `notification_recipient_current`.
- **types** L1438 (service_role-only grant → not client-exposed despite appearing in types);
  **snapshot** (569/619/620/652/1137/1300); **docs** prose.

Interpretation: change is `create or replace` with the **same signature** (`uuid, uuid,
public.notification_type`) — **no drop**, so no dependency risk; call sites are untouched and inherit
the new type→preference map + remote exclusion automatically.

### 6.3 `notification_source_validity` (create-or-replace in file 2 — signature/return unchanged)

Repo references / callers found:

- **engine** L547 definition; L657–658 revoke/grant.
- **engine** L729 — called inside `fanout_due_notifications` (early filter).
- **engine** L896 — called inside `claim_push_deliveries` (authoritative send-time gate).
- **new file 2** — gains a call to the new `notification_recipient_current`.
- **types** L1446; **snapshot** (964/1074/1075/1146/1313); **docs** prose.

Interpretation: change is `create or replace` with the **same return** (`table(valid boolean, reason
text)`) — **no drop**; both call sites (fanout + claim) are unchanged and inherit the new
recipient-currency gate + `task_overdue`/`visit_upcoming` branches.

### 6.4 `upsert_notification_preferences` (drop old 13-arg + recreate 17-arg in file 1)

Repo references / callers found:

- **engine** L392 definition; L475/478 revoke/grant.
- **app** `src/features/notifications/api.ts` L145 — the **only runtime caller**:
  `supabase.rpc('upsert_notification_preferences', { … })` with **13 named params**
  (`p_circle_id … p_timezone`). The 4 new params (`p_assignment_alerts`, `p_activity_updates`,
  `p_available_to_claim_digest`, `p_visit_reminders`) default to `null`, so the existing 13-named-arg
  call **still binds** to the new 17-param function — **no app change is required to apply this**.
  (The app cannot *set* the new prefs until its 2F-5 UI lands; until then the column defaults hold.)
- **types** L1412; **docs** `docs/deployment/notifications-and-reminders.md` L22 (diagram);
  **snapshot** (809/892/895); **docs** prose.

Interpretation: the drop targets the **old** 13-arg overload only, immediately replaced by the 17-arg
version. Nothing else depends on it. The app's positional-but-named call is unaffected.

### 6.5 Remaining DB-level dependency uncertainty

Static text search sees **repo files only**. The **live database is the source of truth for
`pg_depend`**, and — per the Phase 2E/2D/2A history — several objects were originally applied **by
hand in the Supabase Dashboard** and only later backfilled into repo migrations. So a live object
could, in principle, reference `effective_notification_prefs` (or `upsert_notification_preferences`)
without appearing in any repo file. Therefore:

- The **drop-safety** of `effective_notification_prefs` and `upsert_notification_preferences` must be
  confirmed on a **scratch/staging DB** (run the plain `drop function`; confirm no `2BP01`) **before**
  a real apply.
- If a `2BP01` dependency error occurs, **recreate the named dependents in order** after the expanded
  function — **never `drop … cascade`** (which would silently drop dependent engine functions).

## 7. Security checklist

| Requirement | Status | Where enforced |
|---|---|---|
| `remote_member` excluded from operational reminders | ✅ | file 2 B2 — `remote_member` returns `false` for every operational/assignment/awareness/digest type (`medication_due`, `medication_missed`, `task_due`, `task_overdue`, `appointment_upcoming`, `visit_upcoming`, `item_assigned`, `item_claimed`, `item_completed`, `item_cancelled`, `claim_digest`) |
| Owner-only operational reminders | ✅ | file 2 B3.3 owner branch resolves to `v_owner` only; unassigned → manager fallback **only** for med/appt/visit; tasks (`task_due`/`task_overdue`) / `item_assigned` when unassigned → **nobody** |
| Manager-only claim / outcome awareness | ✅ | file 2 B3.3 first branch (`item_claimed`/`item_completed`/`item_cancelled`) restricts to `role in ('admin','primary_caregiver')` |
| No producer triggers | ✅ | Neither file creates a trigger or trigger function; producer file not created |
| No notification delivery enabled | ✅ | No `enqueue_notification` call, no cron, no Edge change; delivery pipeline untouched |
| No policy broadening | ✅ | Neither file contains any `create policy` / `alter policy` / RLS statement |
| Grants are narrow | ✅ | file 1 `upsert_notification_preferences` → `authenticated` only; **all** file-2 functions → `revoke all from public` + `grant execute … to service_role` (engine-internal). `security definer` + `set search_path = ''` preserved on every function |

Additional safety preserved from the proposal: an owner who opted out returns empty (no escalation);
mis-assigned `remote_member`/`elder` owners fall through to manager fallback (med/appt/visit) or
nobody (tasks) rather than being black-holed; manager-escalation rows (`data.tier='manager'`)
revalidate a *current* manager via `notification_recipient_current`.

## 8. Validation results

Only **safe, local/static** checks were run — no SQL, no CLI, no DB, no EAS, no prebuild, no type
generation.

- `npm run check:mojibake` — **PASS** (no mojibake in the new files; the migrations are pure ASCII).
- `git -c core.autocrlf=false diff --check` — **clean** (no whitespace/CRLF errors). Note: the three
  new files are **untracked**, so the plain `diff --check` reports nothing for them; a read-only
  `git diff --no-index --check` pass over each new file (no staging) was also **clean**.
- SQL sanity (visual, static): every function preserves `security definer` + `set search_path = ''`;
  every `$$` body is balanced and terminated with `end; $$;` (or `end;` + `$$;` for
  `notification_source_validity`); every function has matching `revoke all … from public` +
  `grant execute … to <role>`; file 1 ends before any function that references a new enum value; both
  files end with `notify pgrst, 'reload schema';`.

No design change was made to the proposal SQL. No copy/paste defect was found during transcription;
the SQL is faithful to the polished Phase 2F-2 proposal. The single documented uncertainty is the
`effective_notification_prefs` (and `upsert_notification_preferences`) drop-dependency behavior, which
is a **DB-catalog** question that cannot be settled by static review (see §6.5) and must be verified
on scratch/staging before applying.

## 9. Confirmation

- ✅ **No SQL run** — all SQL is inside the two new migration files; nothing executed.
- ✅ **No Supabase CLI** — no `supabase` command of any kind; no `db reset`, no `gen types`.
- ✅ **No connection** — no DB connection or catalog query; dependency review was text-search only.
- ✅ **No app code changed** — `src/**` untouched.
- ✅ **No generated types changed** — `src/types/supabase.ts` untouched.
- ✅ **No Edge Functions changed** — `supabase/functions/**` untouched.
- ✅ **No historical migrations edited** — only two **new** files were added under
  `supabase/migrations/`; existing migrations are unchanged.
- ✅ **No env / secrets touched** — no `.env` read; no tokens/keys inspected.
- ✅ **No commit / no stage** — working tree only; nothing added to the index; no EAS, no prebuild.
- ✅ **Producer migration NOT created** — `…165000_…producers.sql` does not exist.
- ✅ **No other project touched** — ThinkMate Chess and everything outside this repo untouched.

## 10. `git` status & diff

Captured read-only at hand-off:

- `git --no-pager status --short`
- `git --no-pager diff --stat`

Expected: three **untracked** files (`??`) — the two new migrations and this report — and an empty
`diff --stat` (untracked files do not appear in a tracked diff). Actual output is shown in the
hand-off message accompanying this report.
