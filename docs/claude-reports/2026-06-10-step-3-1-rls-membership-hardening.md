# Step 3.1 — RLS membership/ownership check hardening hotfix

**Date:** 2026-06-10
**Status:** Local migration written. Not committed. Apply manually in the Sanad Supabase Dashboard.

---

## 1. Summary

The Step 3.0 policies for `care_tasks`, `family_visits`, and `care_appointments` validate a foreign reference (task **assignee**, visit **visitor account**, appointment **doctor**) with an inline correlated subquery:

```sql
exists (
  select 1 from public.<inner> x
  where x.<key> = <outer_ref>
    and x.circle_id = circle_id   -- ← ambiguous
)
```

The unqualified `circle_id` on the right **binds to the inner table** (`circle_members` / `doctors`), which also has a `circle_id` column — so the predicate degenerates to `x.circle_id = x.circle_id`, a tautology. The intended cross-circle guard therefore never fires: an assignee/visitor/doctor from **another circle** would pass the check.

The Sanad app only ever references same-circle rows (assignee = self, visitor = self, doctor = a circle doctor offered by the form), so this was never exploited — but it is a latent cross-circle integrity gap. This hotfix closes it by moving each check into a SECURITY DEFINER helper that takes the circle and the referenced id as **explicit parameters**, eliminating the ambiguity. Roles and intended behavior are unchanged.

This is **SQL only** — no app code change is required (the client already passes only same-circle references).

---

## 2. Migration file created

- `supabase/migrations/20260610110000_harden_step_3_rls_membership_checks.sql`

It adds three helpers and drop/recreates the six affected manager INSERT/UPDATE policies. Nothing else is touched.

---

## 3. Exact SQL to run manually in the Sanad Dashboard

Open **Dashboard → SQL Editor**, paste the whole block, run. Safe to re-run.

```sql
-- Step 3.1 — RLS membership / ownership check hardening hotfix.

-- ── Helpers ──────────────────────────────────────────────────────────────────

create or replace function public.is_user_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
  );
$$;

revoke all on function public.is_user_circle_member(uuid, uuid) from public;
grant execute on function public.is_user_circle_member(uuid, uuid) to authenticated;

create or replace function public.is_active_user_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
      and cm.status = 'active'
  );
$$;

revoke all on function public.is_active_user_circle_member(uuid, uuid) from public;
grant execute on function public.is_active_user_circle_member(uuid, uuid) to authenticated;

create or replace function public.is_circle_doctor(p_circle_id uuid, p_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.doctors d
    where d.id = p_doctor_id
      and d.circle_id = p_circle_id
  );
$$;

revoke all on function public.is_circle_doctor(uuid, uuid) from public;
grant execute on function public.is_circle_doctor(uuid, uuid) to authenticated;

-- ── care_tasks: manager INSERT / UPDATE (assignee must be an active member) ───

drop policy if exists "Managers can add care tasks" on public.care_tasks;
create policy "Managers can add care tasks"
on public.care_tasks
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

drop policy if exists "Managers can update care tasks" on public.care_tasks;
create policy "Managers can update care tasks"
on public.care_tasks
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

-- ── family_visits: manager INSERT / UPDATE (visitor must be an active member) ──

drop policy if exists "Managers can add family visits" on public.family_visits;
create policy "Managers can add family visits"
on public.family_visits
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (visitor_user_id is null or public.is_active_user_circle_member(circle_id, visitor_user_id))
);

drop policy if exists "Managers can update family visits" on public.family_visits;
create policy "Managers can update family visits"
on public.family_visits
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (visitor_user_id is null or public.is_active_user_circle_member(circle_id, visitor_user_id))
);

-- ── care_appointments: manager INSERT / UPDATE (doctor must belong to circle) ──

drop policy if exists "Managers can add care appointments" on public.care_appointments;
create policy "Managers can add care appointments"
on public.care_appointments
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (doctor_id is null or public.is_circle_doctor(circle_id, doctor_id))
);

drop policy if exists "Managers can update care appointments" on public.care_appointments;
create policy "Managers can update care appointments"
on public.care_appointments
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (doctor_id is null or public.is_circle_doctor(circle_id, doctor_id))
);
```

> This block is the verbatim content of the migration file (the file is the source of truth).

---

## 4. Policies changed

Six policies — **names preserved**, only the ambiguous subquery replaced with a helper call; all role/`using`/`has_circle_role` clauses are identical to Step 3.0:

| Table | Policy | Check before | Check after |
| --- | --- | --- | --- |
| `care_tasks` | `Managers can add care tasks` (INSERT) | inline `circle_members` subquery | `assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to)` |
| `care_tasks` | `Managers can update care tasks` (UPDATE) | inline `circle_members` subquery | same helper call |
| `family_visits` | `Managers can add family visits` (INSERT) | inline `circle_members` subquery | `visitor_user_id is null or public.is_active_user_circle_member(circle_id, visitor_user_id)` |
| `family_visits` | `Managers can update family visits` (UPDATE) | inline `circle_members` subquery | same helper call |
| `care_appointments` | `Managers can add care appointments` (INSERT) | inline `doctors` subquery | `doctor_id is null or public.is_circle_doctor(circle_id, doctor_id)` |
| `care_appointments` | `Managers can update care appointments` (UPDATE) | inline `doctors` subquery | same helper call |

Helpers added/asserted: `public.is_user_circle_member` (any-status, re-asserted), `public.is_active_user_circle_member` (active-only, new), `public.is_circle_doctor` (circle ownership, new) — all SECURITY DEFINER, `stable`, `set search_path = ''`, schema-qualified, `revoke all from public` + `grant execute to authenticated`.

**Not changed:** the collaborator/own policies on these tables (`assigned_to = auth.uid()`, `visitor_user_id = auth.uid()`) contain no subquery, and the SELECT/DELETE manager policies use `is_circle_member` / `has_circle_role` only — none are ambiguous.

### `care_appointments` decision (per task item 5)
`care_appointments` **was** modified, because its doctor reference check (`from public.doctors d where d.id = doctor_id and d.circle_id = circle_id`) has the **same** ambiguity (`circle_id` binds to `doctors`, not the appointment row). It is replaced with `public.is_circle_doctor(circle_id, doctor_id)`. A definer helper was chosen over an inline rewrite so the check is decoupled from `doctors`' own RLS and is consistent with the membership helpers.

---

## 5. Why this fixes the ambiguity

In a correlated subquery, an unqualified column name resolves to the **innermost** scope that has it. Because `circle_members` and `doctors` both have a `circle_id` column, `… and x.circle_id = circle_id` made the right-hand `circle_id` refer to the *inner* table, not the policy's target row — so the comparison was `x.circle_id = x.circle_id` (always true for a matched row). The "same circle" requirement silently disappeared.

A SQL function receives the circle and the referenced id as **named parameters** (`p_circle_id`, `p_user_id` / `p_doctor_id`). Inside the function body the predicate is `cm.circle_id = p_circle_id` (or `d.circle_id = p_circle_id`) — the parameter cannot be shadowed by a table column, so the comparison is unambiguous and genuinely scopes to the caller-supplied circle. The policy passes the target row's own `circle_id` column into the helper, which is evaluated in the policy's outer scope where no inner table can shadow it.

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
| `git status --short` | Captured (§9) — **no commit made** |
| `git diff --stat` | Captured (§9) |

- **TypeScript result:** clean (exit 0). This migration is SQL-only; no TypeScript was modified.

---

## 8. Manual test instructions

> Supabase is shared; nothing was pushed. **Apply the SQL manually first.**

1. **Apply SQL** — paste the §3 block into the Sanad Dashboard SQL Editor and run it.
2. **Refresh the app** (reload web / restart Metro).
3. **Tasks (as a manager — admin / primary caregiver):**
   - Create a task with **Assign to me** on → saves (you are an active member of the circle).
   - Create a task with no assignee → saves.
   - Open an existing task → edit a field → Save → succeeds.
4. **Family visits (as a manager):**
   - Add a visit with **Link to me** on → saves.
   - Add a visit with no linked account → saves.
   - Edit an existing visit → Save → succeeds.
5. **Appointments (as a manager):**
   - Add an appointment with a doctor selected (from the circle's doctors) → saves.
   - Add an appointment with **No doctor** → saves.
   - Edit an existing appointment → Save → succeeds.
6. **Regression:** confirm existing tasks / visits / appointments still load and that collaborator (caregiver/family) flows — completing/cancelling a task, recording an own visit — still work unchanged.

Expected: everything that worked before continues to work. The only behavioral difference is that a cross-circle assignee/visitor/doctor reference (not reachable through the UI) is now correctly rejected.

---

## 9. Git status summary

No commit made. Working tree change for this step:

- **New (untracked):** `supabase/migrations/20260610110000_harden_step_3_rls_membership_checks.sql`, `docs/claude-reports/2026-06-10-step-3-1-rls-membership-hardening.md`.
- All other modified/untracked entries are pre-existing from Step 4.0 (not part of this hotfix). `git diff --stat` shows the Step 4.0 tracked-file edits only; the Step 3.1 migration + report are untracked.

---

## 10. Out-of-scope finding (recommended follow-up)

The **same ambiguous pattern** exists in the Step 2.x medication policies, which are **out of scope** for this Step 3.0 hotfix and were left unchanged:

- `supabase/migrations/20260608130100_create_medication_schedules.sql` (lines 109, 129) — `from public.medications m where m.id = medication_id and m.circle_id = circle_id` (the `medications` ownership check degenerates to a tautology).
- `supabase/migrations/20260608130200_create_medication_logs.sql` (lines 84, 120 for `medications`; 92, 128 for `medication_schedules`).

These deserve the same treatment (a `public.is_circle_medication(circle_id, medication_id)` and `public.is_circle_schedule(circle_id, schedule_id)` helper, or fully-qualified outer references) in a follow-up pass. I did not touch them here to keep this hotfix scoped to Step 3.0 as requested.

---

## 11. Confirmation

- **No Supabase CLI `logout` / `login` / `link` / `db push` was run**, and the global Supabase CLI account was not changed. The other project on this machine is unaffected.
- A local idempotent migration file was created; **no commit was made**.
