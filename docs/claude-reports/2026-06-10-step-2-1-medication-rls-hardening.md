# Step 2.1 — Medication RLS ownership-check hardening hotfix

**Date:** 2026-06-10
**Status:** Local migration written. Not committed. Apply manually in the Sanad Supabase Dashboard.

---

## 1. Summary

The Step 2.0 INSERT/UPDATE policies for `medication_schedules` and `medication_logs` validate a foreign reference (the schedule's parent **medication**, the log's **medication** and **schedule**) with an inline correlated subquery:

```sql
exists (
  select 1 from public.<inner> x
  where x.<key> = <outer_ref>
    and x.circle_id = circle_id   -- ← ambiguous
)
```

The unqualified `circle_id` on the right **binds to the inner table** (`medications` / `medication_schedules`), which also has a `circle_id` column — so the predicate degenerates to `x.circle_id = x.circle_id`, a tautology. The intended **same-circle** guard never fires: a medication/schedule from **another circle** would pass the check.

The `medication_logs` schedule subquery has the problem **twice over** — both `s.circle_id = circle_id` *and* `s.medication_id = medication_id` bind to the inner `medication_schedules` row (it has both columns), so the schedule's circle ownership *and* its medication ownership both collapse to tautologies.

The Sanad app only ever submits same-circle references (the medication form derives `medication_id` / `schedule_id` from the active circle), so this was never exploited — but it is a latent cross-circle integrity gap. This hotfix closes it by moving each check into a SECURITY DEFINER helper that takes the circle and the referenced id(s) as **explicit parameters**, eliminating the ambiguity. Roles and intended behavior are unchanged.

This is the out-of-scope follow-up explicitly flagged by the Step 3.1 hotfix (`20260610110000`, report §10). It is **SQL only** — no app code change is required (the client already passes only same-circle references).

---

## 2. Migration file created

- `supabase/migrations/20260610120000_harden_medication_rls_ownership_checks.sql`

It adds three helpers and drop/recreates the four affected INSERT/UPDATE policies. Nothing else is touched.

---

## 3. Exact SQL to run manually in the Sanad Dashboard

Open **Dashboard → SQL Editor**, paste the whole block, run. Safe to re-run.

```sql
-- Step 2.1 — Medication RLS ownership-check hardening hotfix.

-- ── Helpers ──────────────────────────────────────────────────────────────────

create or replace function public.is_circle_medication(p_circle_id uuid, p_medication_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.medications m
    where m.id = p_medication_id
      and m.circle_id = p_circle_id
  );
$$;

revoke all on function public.is_circle_medication(uuid, uuid) from public;
grant execute on function public.is_circle_medication(uuid, uuid) to authenticated;

create or replace function public.is_circle_medication_schedule(p_circle_id uuid, p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.medication_schedules s
    where s.id = p_schedule_id
      and s.circle_id = p_circle_id
  );
$$;

revoke all on function public.is_circle_medication_schedule(uuid, uuid) from public;
grant execute on function public.is_circle_medication_schedule(uuid, uuid) to authenticated;

create or replace function public.is_circle_medication_schedule_for_medication(
  p_circle_id uuid,
  p_schedule_id uuid,
  p_medication_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.medication_schedules s
    where s.id = p_schedule_id
      and s.circle_id = p_circle_id
      and s.medication_id = p_medication_id
  );
$$;

revoke all on function public.is_circle_medication_schedule_for_medication(uuid, uuid, uuid) from public;
grant execute on function public.is_circle_medication_schedule_for_medication(uuid, uuid, uuid) to authenticated;

-- ── medication_schedules: manager INSERT / UPDATE (parent medication same circle) ─

drop policy if exists "Managers can add medication schedules" on public.medication_schedules;
create policy "Managers can add medication schedules"
on public.medication_schedules
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and public.is_circle_medication(circle_id, medication_id)
);

drop policy if exists "Managers can update medication schedules" on public.medication_schedules;
create policy "Managers can update medication schedules"
on public.medication_schedules
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and public.is_circle_medication(circle_id, medication_id)
);

-- ── medication_logs: caregiver INSERT / UPDATE (medication + schedule same circle) ─

drop policy if exists "Caregivers can add medication logs" on public.medication_logs;
create policy "Caregivers can add medication logs"
on public.medication_logs
for insert
to authenticated
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
);

drop policy if exists "Caregivers can update medication logs" on public.medication_logs;
create policy "Caregivers can update medication logs"
on public.medication_logs
for update
to authenticated
using (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
)
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
);
```

> This block is the verbatim content of the migration file (the file is the source of truth).

---

## 4. Policies changed

Four policies — **names preserved**, only the ambiguous subquery replaced with a helper call; all role / `using` / `has_circle_role` clauses are identical to Step 2.0:

| Table | Policy | Check before | Check after |
| --- | --- | --- | --- |
| `medication_schedules` | `Managers can add medication schedules` (INSERT) | inline `medications` subquery | `public.is_circle_medication(circle_id, medication_id)` |
| `medication_schedules` | `Managers can update medication schedules` (UPDATE) | inline `medications` subquery | same helper call |
| `medication_logs` | `Caregivers can add medication logs` (INSERT) | inline `medications` **and** `medication_schedules` subqueries | `public.is_circle_medication(circle_id, medication_id)` **and** `schedule_id is null or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)` |
| `medication_logs` | `Caregivers can update medication logs` (UPDATE) | inline `medications` **and** `medication_schedules` subqueries | same helper calls |

Helpers added/asserted — all SECURITY DEFINER, `stable`, `set search_path = ''`, schema-qualified, `revoke all from public` + `grant execute to authenticated`:

- `public.is_circle_medication(p_circle_id, p_medication_id)` — medication belongs to circle.
- `public.is_circle_medication_schedule(p_circle_id, p_schedule_id)` — schedule belongs to circle (provided for completeness/reuse; not referenced by a policy yet).
- `public.is_circle_medication_schedule_for_medication(p_circle_id, p_schedule_id, p_medication_id)` — schedule belongs to the same circle **and** medication (used by both `medication_logs` policies).

**Not changed (item 4 review — confirmed no ambiguity, so left untouched):**

- `medications` — all four policies (`Members can view` SELECT, `Managers can add` INSERT, `Managers can update` UPDATE, `Managers can delete` DELETE) use only `is_circle_member(circle_id)` / `has_circle_role(circle_id, …)`. No foreign subquery → no ambiguity.
- `medication_schedules` — `Members can view …` (SELECT) and `Managers can delete …` (DELETE) use only `is_circle_member` / `has_circle_role`. Unchanged.
- `medication_logs` — `Members can view …` (SELECT) and `Managers can delete …` (DELETE) use only `is_circle_member` / `has_circle_role`. Unchanged.

Role behavior preserved exactly: active members read; admins / primary caregivers manage medications & schedules; the four caregiving roles insert/update logs; admins / primary caregivers delete logs.

---

## 5. Why this fixes the ambiguity

In a correlated subquery, an unqualified column name resolves to the **innermost** scope that has it. Because `medications` and `medication_schedules` each carry a `circle_id` column (and `medication_schedules` also a `medication_id`), `… and m.circle_id = circle_id` / `… and s.medication_id = medication_id` made the right-hand name refer to the *inner* table, not the policy's target row — so the comparison became `x.circle_id = x.circle_id` (always true for a matched row). The "same circle" / "same medication" requirement silently disappeared.

A SQL function receives the circle and the referenced id(s) as **named parameters** (`p_circle_id`, `p_medication_id`, `p_schedule_id`). Inside the body the predicate is `m.circle_id = p_circle_id` (or `s.medication_id = p_medication_id`) — a parameter cannot be shadowed by a table column, so the comparison is unambiguous and genuinely scopes to the caller-supplied values. The policy passes the target row's own `circle_id` / `medication_id` / `schedule_id` columns into the helper, evaluated in the policy's outer scope where no inner table can shadow them. SECURITY DEFINER + empty `search_path` lets the helper read the parent table above its RLS without recursion, consistent with the existing `is_circle_member` / `has_circle_role` / `is_circle_doctor` helpers.

---

## 6. Confirmation: SQL is idempotent / safe to re-run

- **Helper functions** — `create or replace function`, followed by re-asserted `revoke all … from public` and `grant execute … to authenticated`. Re-running redefines them identically; `create or replace` preserves the existing (already-restricted) ACL, and the revoke/grant re-assert it.
- **Policies** — each `drop policy if exists …` immediately precedes its `create policy …`, so re-running cleanly replaces them.
- **No** table/enum/constraint/trigger changes, **no** data writes, **no** destructive statements. The migration is purely a policy + helper redefinition and can be pasted repeatedly.

---

## 7. Commands run

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | **Pass** (exit 0) — no app code changed; run as a regression check |
| `git status --short` | `?? supabase/migrations/20260610120000_harden_medication_rls_ownership_checks.sql` (report file added after this snapshot) — **no commit made** |
| `git diff --stat` | empty (no tracked-file edits) |

- **TypeScript result:** clean (exit 0). This migration is SQL-only; no TypeScript was modified.

---

## 8. Manual test instructions

> Supabase is shared; nothing was pushed. **Apply the SQL manually first.**

1. **Apply SQL** — paste the §3 block into the Sanad Dashboard SQL Editor and run it.
2. **Refresh the app** (reload web / restart Metro).
3. **Add a medication schedule (as a manager — admin / primary caregiver):** open a medication → add a schedule (days + times) → Save → succeeds (the medication belongs to your circle).
4. **Confirm a dose as given:** on Today's doses, mark a scheduled dose **Given** → saves; the row reflects the new status.
5. **Mark a dose missed / postponed:** mark another dose **Missed**, and a third **Postponed** → both save.
6. **Edit a medication schedule (as a manager):** change a schedule's days/times/notes → Save → succeeds.
7. **Regression — existing data loads:** confirm the medication center still lists existing medications, schedules still render, and previously recorded dose logs still display unchanged.

Expected: everything that worked before continues to work. The only behavioral difference is that a cross-circle `medication_id` / `schedule_id` reference (not reachable through the UI) is now correctly rejected.

---

## 9. Git status summary

No commit made. Working tree change for this step:

- **New (untracked):** `supabase/migrations/20260610120000_harden_medication_rls_ownership_checks.sql`, `docs/claude-reports/2026-06-10-step-2-1-medication-rls-hardening.md`.
- `git diff --stat` is empty — there are **no edits to tracked files**; this hotfix is purely additive (one migration + this report).

---

## 10. Confirmation

- **No Supabase CLI `logout` / `login` / `link` / `db push` was run**, and the global Supabase CLI account was not changed. The other project on this machine is unaffected.
- A local idempotent migration file was created; **no commit was made**.
