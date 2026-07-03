# Phase 2F-1.7 — Backfill migration files created

**Status:** Migration files created from the reviewed Phase 2F-1.6 proposal. **No SQL run, no
Supabase CLI, no connection, no migrations executed, no generated types changed, no historical
migrations edited, no app/native/Edge/config changes.** Nothing committed or staged.
**Baseline commit:** `744e427 docs(product): propose schema backfill migrations`.

---

## 1. Summary of files created

Three new migration files under `supabase/migrations/`, in the required order **A → B → C**
(each depends on the previous — 2D references the 2A columns; 2E depends on the 2A columns + post-2D
RLS):

| # | File | Contents (from proposal) |
|---|---|---|
| 1 | `supabase/migrations/20260626160000_backfill_phase_2a_assignment_columns.sql` | Apply-pack A — `care_appointments.assigned_to` + `medications.responsible_user_id` (+ indexes) and the manager INSERT/UPDATE active-member guard policies |
| 2 | `supabase/migrations/20260626161000_backfill_phase_2d_responsibility_rls.sql` | Apply-pack B — `can_view_all_operational` / `is_responsible_for_medication` helpers; responsibility-scoped SELECT on tasks/appointments/visits/medication_logs; `medication_logs` INSERT/UPDATE responsibility gates; removal of the `assigned_to is null` collaborator allowance |
| 3 | `supabase/migrations/20260626162000_backfill_phase_2e_claim_flow.sql` | Apply-pack C — `list_available_to_claim`; four `claim_*` RPCs; `set_assigned_appointment_outcome`; `enforce_family_visit_collaborator_scope` (+ trigger); `enforce_care_task_collaborator_scope` body with the `sanad.in_claim` bypass; drop of the own-visit DELETE policy |

Also created: this report,
`docs/claude-reports/2026-06-26-phase-2f-1-7-backfill-migration-files-created.md`.

**Transaction-wrapper decision (requirement 14).** Existing project migrations (e.g.
`20260611120200_add_care_circle_timezone.sql`, `20260611120000_create_notifications_core.sql`) do
**not** use an explicit outer `begin; … commit;` wrapper — they run bare statements and end with
`notify pgrst, 'reload schema';`. To match house style (and because the Supabase migration runner
wraps each file in its own transaction), the **outer `begin;`/`commit;` from the 2F-1.6 apply-packs
were omitted**; **no SQL semantics changed**. The trailing `notify pgrst, 'reload schema';` present in
each reviewed apply-pack is **preserved** in each file. A short house-style provenance header comment
was added to each file (comment only — no SQL change).

---

## 2. Source used

All SQL bodies were copied from the reviewed proposal:
**`docs/claude-reports/2026-06-26-phase-2f-1-6-migration-backfill-proposal.md`** — Apply-pack A (§3),
Apply-pack B (§4), Apply-pack C (§5). The SQL was copied carefully and **not redesigned**. No
notification SQL was added; no new enum values were added (the "unable" outcome continues to reuse
the existing `cancelled` status values).

---

## 3. Confirmation — no SQL run, no Supabase CLI

Confirmed. **No SQL was executed. No Supabase CLI command was run** (`supabase login/link/db
push/db reset/migration/functions deploy/gen types` — none). **No connection to Supabase was made.**
The migration files are inert text on disk; applying them remains a separate, later, manual step.

## 4. Confirmation — no historical migrations edited

Confirmed. Only the **three new files** were created. `git status --short` shows the three new files
as untracked (`??`) and **no existing migration marked modified (`M`)**. The 20 pre-existing files
under `supabase/migrations/` were not opened for editing or changed.

## 5. Confirmation — generated types not changed

Confirmed. **`src/types/supabase.ts` was not modified** and types were **not regenerated** (no
`supabase gen types`). No app source, dependencies, Expo config, native files, Edge Functions, or
backend code outside the three migration files were touched.

---

## 6. Security checklist

| Invariant | Status | Evidence in files |
|---|:--:|---|
| Assignment columns added idempotently (`add column if not exists`) + idempotent indexes (`create index if not exists`) | ✅ | File A: `alter table … add column if not exists assigned_to / responsible_user_id`; `create index if not exists care_appointments_assigned_to_idx / medications_responsible_user_id_idx` |
| Responsibility-scoped SELECT policies (never bare `is_circle_member`) | ✅ | File B: all four SELECT policies are `can_view_all_operational(circle_id) OR (is_circle_member(circle_id) AND owner = (select auth.uid()))` — `is_circle_member` only ever appears as the OR'd owner branch, never as a standalone SELECT |
| Medication-log responsibility gates on INSERT/UPDATE (and scoped SELECT) | ✅ | File B: `medication_logs` INSERT/UPDATE use `is_responsible_for_medication(...)`; dose-log SELECT scoped the same way |
| Claim RPCs block `remote_member` / `elder` | ✅ | File C: `list_available_to_claim` + every `claim_*` reject any role not in `('admin','primary_caregiver','family_member','caregiver')` with `42501` (remote/elder excluded); already-claimed race → `23505`; ineligible → `22023` |
| Visit DELETE remains manager-only (own-visit delete removed) | ✅ | File C: `drop policy if exists "Members can delete their own family visits" on public.family_visits;` (no recreate) |
| Task unassigned collaborator UPDATE allowance removed (`assigned_to = auth.uid()` only) | ✅ | File B: collaborator UPDATE policy is `has_circle_role([caregiver,family_member]) AND assigned_to = (select auth.uid())` — **no `assigned_to is null` branch** in any policy predicate |
| `sanad.in_claim` bypass present **only** in the trigger functions | ✅ | File C: `current_setting('sanad.in_claim', true) = 'on'` early-return in `enforce_care_task_collaborator_scope` and `enforce_family_visit_collaborator_scope`; the `set_config('sanad.in_claim', 'on'/'off', true)` toggles live inside the SECURITY DEFINER claim RPCs and are transaction-local |
| Idempotency preserved throughout | ✅ | `create or replace function`; `drop policy if exists` → `create policy`; `drop trigger if exists` → `create trigger`; `add column if not exists`; `create index if not exists` |
| `remote_member` stays read-only via `can_view_all_operational`; no remote write policy | ✅ | File B: remote is inside `can_view_all_operational` (read) but appears in **no** write array (INSERT/UPDATE stay manager or `[family_member,caregiver]+owner`) |
| No new enum values; existing status enums preserved | ✅ | No `create type` / `alter type … add value` anywhere; "unable" = existing `cancelled` |
| `notify pgrst, 'reload schema';` preserved | ✅ | Present at the end of all three files |

> Note on the `assigned_to is null` strings in File C: they appear only in the **claim-eligibility
> predicates** (`list_available_to_claim` WHERE clauses and each claim RPC's `UPDATE … WHERE …
> assigned_to is null`), which is the intended "claim only an unowned item" logic — **not** the
> removed collaborator-UPDATE allowance (that lives in File B and was dropped).

---

## 7. Validation results

Safe local/static checks only (no Supabase/SQL/EAS/prebuild/type-gen):

| Check | Command | Result |
|---|---|---|
| Mojibake / encoding | `npm run check:mojibake` | **PASS** — "scanned 266 active source/config file(s). No strong mojibake signatures found." (Arabic `أنا متكفّل` and the `──` section separators in File C verified intact.) |
| Whitespace / line-ending | `git -c core.autocrlf=false diff --check` | **PASS** — exit 0, no whitespace/encoding errors. |

**Deliberately not run** (per constraints): Supabase CLI, SQL execution, migration apply, EAS,
prebuild, `src/types/supabase.ts` regeneration.

---

## 8. `git --no-pager status --short`

```
?? docs/claude-reports/2026-06-26-phase-2f-1-7-backfill-migration-files-created.md
?? supabase/migrations/20260626160000_backfill_phase_2a_assignment_columns.sql
?? supabase/migrations/20260626161000_backfill_phase_2d_responsibility_rls.sql
?? supabase/migrations/20260626162000_backfill_phase_2e_claim_flow.sql
```

*(Only new untracked files — this report + the three migration files. No existing file modified.)*

## 9. `git --no-pager diff --stat`

```
(no output — no tracked files modified; the only changes are the untracked files above)
```

*(`git diff --stat` shows tracked changes only; the new files are untracked, so it is empty. Nothing
staged, nothing committed.)*
