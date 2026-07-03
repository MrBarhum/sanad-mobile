# Phase 2F-1.5 — Live Schema Migration Backfill Audit

**Status:** Audit & design only. **No SQL, no migrations, no Supabase interaction, no code changes**
(other than this report).
**Purpose:** Measure the gap between the repo (`supabase/migrations/`, `src/types/supabase.ts`,
docs) and the **live‑applied** responsibility/claim schema, and propose a safe backfill strategy
**before** Phase 2F notification SQL is authored.
**Baseline commit:** `e3b38b3 docs(product): audit notification readiness`.
**Method:** repository files + existing reports only. Read‑only. No connection to the live DB was
made; every "live" fact below is sourced from a prior applied‑verification report, not from a fresh
introspection.

---

## 1. Executive summary

### 1.1 What is live‑only

The repo migration tree has **20 files and stops at `20260611120200`** (the notification‑engine
timezone migration). **There is no Phase 2A / 2D / 2E migration file at all.** The entire
responsibility + RLS‑hardening + claim‑flow layer was applied **manually via the Supabase Dashboard
SQL editor** and exists in the repo only as narrative reports (`docs/claude-reports/…`). Concretely,
these are **live‑only** (absent from `supabase/migrations/`):

- **2 columns:** `care_appointments.assigned_to`, `medications.responsible_user_id` (Phase 2A).
- **2 helper functions:** `can_view_all_operational(uuid)`, `is_responsible_for_medication(uuid,uuid,uuid)` (Phase 2D).
- **6 RPCs:** `list_available_to_claim`, `claim_care_task`, `claim_medication_responsibility`,
  `claim_care_appointment`, `claim_family_visit`, `set_assigned_appointment_outcome` (Phase 2E).
- **1 trigger + function:** `enforce_family_visit_collaborator_scope()` + trigger
  `family_visits_collaborator_scope` (Phase 2E).
- **1 body‑replacement:** `enforce_care_task_collaborator_scope()` gains a claim bypass via the GUC
  `sanad.in_claim` (Phase 2E) — the object exists in the committed migration but its **live body
  differs**.
- **All Phase 2D RLS rewrites:** responsibility‑scoped `SELECT` on `care_tasks` /
  `care_appointments` / `family_visits` / `medication_logs`; `medication_logs` INSERT/UPDATE
  responsibility gates; the **DROP** of the pre‑2D `care_tasks` collaborator‑UPDATE "`assigned_to is
  null`" allowance; and the **DROP** of the own‑visit DELETE policy.

Two important non‑drift facts (control group): `care_tasks.assigned_to` and
`family_visits.visitor_user_id` **were** in committed `create_*` migrations
(`20260610090000` / `20260610090200`) and match live — so not everything is drift.

**Generated types (`src/types/supabase.ts`) are drifted in a split way:** the two live‑only
**columns are present** (hand‑patched in, per Phase 2B §3), but **all 6 claim RPCs and both helper
functions are absent** from the `Functions` type. The app reaches the six RPCs through **one
`as unknown as` cast** in `src/features/claiming/api.ts` (`callClaimRpc`).

### 1.2 Why it matters before notification SQL

Phase 2F's notification work must resolve recipients by **responsibility** (`assigned_to` /
`responsible_user_id` / `visitor_user_id`) and re‑use the **claim** semantics and the **2D RLS**
scoping (a reminder may only target someone who can read the row). All of that machinery is
**live‑only**. Therefore:

- The Phase 2F notification SQL **cannot be authored against `supabase/migrations/`** — those files
  describe a *pre‑responsibility* schema. It must be authored against the **live** schema (or against
  a backfilled repo that mirrors live).
- A fresh `supabase db reset` / new environment built from `supabase/migrations/` would reproduce the
  **pre‑2D** schema: no assignee columns, no claim RPCs, open `is_circle_member` SELECT policies, and
  the *self‑visit DELETE* + *unassigned‑task UPDATE* allowances that 2D/2E deliberately removed. Any
  notification producer validated on that DB would behave differently (and less safely) than in
  production.

### 1.3 Should notifications wait until the drift is resolved?

**Yes — resolve the drift first (backfill migrations), then author Phase 2F‑2 notification SQL.**
Not because the live DB is wrong (it is correct and verified), but because:

1. Phase 2F recipient logic **depends on** the live‑only columns/helpers/RPCs; authoring it against
   stale migrations risks referencing objects the repo doesn't know exist, or re‑introducing dropped
   allowances.
2. The notification‑engine SQL *does* have committed migrations (`…120000/120100/120200`). Adding a
   *second* set of Dashboard‑only notification changes on top of an already‑drifted base compounds the
   reproducibility problem and makes future review harder.
3. The cost is low: the backfill is **additive and idempotent** and can be authored entirely from the
   existing apply‑packs and applied‑verification reports (no live introspection strictly required,
   though a live inventory is the safest confirmation — see §9).

This is a **soft gate**, not a hard blocker: it is safe to *design* the Phase 2F notification SQL now
(§5 shows exactly what it depends on), but the notification **apply‑pack** should land **after** the
backfill so it builds on a reproducible schema.

---

## 2. Inventory of live‑only / drifted schema elements

Legend — **In mig?** = present in `supabase/migrations/`. **In types?** = present in
`src/types/supabase.ts`. **App dep?** = does app code depend on it (and how). Line numbers are from
the audited files.

| # | Element | Kind | In mig? | In types? | App dep? | Provenance (manual apply) |
|---|---|---|:--:|:--:|---|---|
| 1 | `care_tasks.assigned_to` | column | ✅ `20260610090000:58` | ✅ Row L187 (+FK) | ✅ typed (`tasks/api.ts`) | **Original, not drift** — 2A §1.2 "No DB change required" |
| 2 | `family_visits.visitor_user_id` | column | ✅ `20260610090200:33` | ✅ Row L562 (+FK) | ✅ typed (`visits/api.ts`) | **Original, not drift** — 2A §1.2 |
| 3 | `care_appointments.assigned_to` | column | ❌ | ✅ Row L20 (+FK) *hand‑patched* | ✅ typed (`appointments/api.ts` `AppointmentInput`) | 2B §1 — Phase 2A manual Dashboard apply |
| 4 | `medications.responsible_user_id` | column | ❌ | ✅ Row L758 (+FK) *hand‑patched* | ✅ typed (`medications/api.ts` `MedicationInput`) | 2B §1 — Phase 2A manual Dashboard apply |
| 5 | `can_view_all_operational(uuid)` | helper function | ❌ | ❌ (not exposed as RPC) | ▲ indirect (RLS only; no direct call in `src`) | 2D applied‑verification §2 |
| 6 | `is_responsible_for_medication(uuid,uuid,uuid)` | helper function | ❌ | ❌ | ▲ indirect (RLS only) | 2D applied‑verification §2 |
| 7 | `list_available_to_claim(uuid)` | RPC | ❌ | ❌ **absent** | ✅ via cast (`claiming/api.ts:42`) | 2E applied‑verification §3 |
| 8 | `claim_care_task(uuid)` | RPC | ❌ | ❌ **absent** | ✅ via cast (`claiming/api.ts:53`) | 2E applied‑verification §3/§4 (7/7) |
| 9 | `claim_medication_responsibility(uuid)` | RPC | ❌ | ❌ **absent** | ✅ via cast (`claiming/api.ts:57`) | 2E applied‑verification §3 |
| 10 | `claim_care_appointment(uuid)` | RPC | ❌ | ❌ **absent** | ✅ via cast (`claiming/api.ts:61`) | 2E applied‑verification §3 |
| 11 | `claim_family_visit(uuid)` | RPC | ❌ | ❌ **absent** | ✅ via cast (`claiming/api.ts:65`) | 2E applied‑verification §3 |
| 12 | `set_assigned_appointment_outcome(uuid, care_appointment_status)` | RPC | ❌ | ❌ **absent** | ✅ via cast (`claiming/api.ts:98` → `appointments/hooks.ts` `useSetAppointmentOutcome`) | 2E applied‑verification §3 |
| 13 | `enforce_family_visit_collaborator_scope()` + trigger `family_visits_collaborator_scope` | trigger/function | ❌ | n/a | ▲ indirect (server enforces; `visits/api.ts` relies on it) | 2E applied‑verification §3/§4 (2 triggers) |
| 14 | `enforce_care_task_collaborator_scope()` **body** (GUC `sanad.in_claim` bypass) | trigger/function | ⚠️ **partial** (object at `090000:143‑195`, body drifted) | n/a | ▲ indirect (server) | 2E applied‑verification §3; apply‑pack §2 step 4 |
| 15 | Phase 2D scoped `SELECT` policies (`care_tasks`/`care_appointments`/`family_visits`/`medication_logs`) | RLS policy | ❌ (committed = open `is_circle_member`) | n/a | ▲ indirect (app relies on RLS scoping; deep‑links assume it) | 2D applied‑verification §1/§3 |
| 16 | `medication_logs` INSERT/UPDATE responsibility gates | RLS policy | ❌ (committed = role‑only) | n/a | ▲ indirect | 2D applied‑verification §1/§3 |
| 17 | **DROP** of `care_tasks` collaborator‑UPDATE "`assigned_to is null`" allowance | RLS policy (removal) | ❌ (still live in `090000:262‑274`) | n/a | ▲ indirect | 2D applied‑verification §1/§3 |
| 18 | **DROP** of own‑visit DELETE policy "Members can delete their own family visits" | RLS policy (removal) | ❌ (still live in `090200:163‑171`) | n/a | ▲ indirect | 2E applied‑verification §3/§4 (count 0) |
| 19 | `src/types/supabase.ts` state (columns patched, RPCs missing) | app generated type | — | — | build‑time type‑check | 2B §3 (columns hand‑patched, not CLI‑regenerated) |
| 20 | New enum/type for claim/outcome | enum/type | **none needed** | — | — | 2E — "unable" maps to existing `*_status = cancelled`; **no new enum added** |

**Positive findings that shrink the backfill scope:**

- **No new enum/type** was introduced by 2A/2D/2E (row 20). "Unable/تعذّر" reuses the existing
  `care_task_status` / `care_appointment_status` / `family_visit_status` `cancelled` value. Backfill
  need not touch enums.
- The two **original** columns (rows 1–2) and `set_circle_timezone` (Phase 2D circle‑tz RPC, present
  in both `20260611120200` and types L1515) are already reconciled — not part of the backfill.
- The notification engine is fully reconciled: tables, enums, and client RPCs are committed **and**
  in the generated types.

---

## 3. Repo migration coverage

### 3.1 What migrations currently include

The 20 committed migrations cover: core schema + circle RPCs; emergency contacts; doctors;
medications / schedules / logs; care tasks / appointments / family visits; daily logs / vitals; the
Step‑3 membership‑check hardening (`20260610110000`); the medication ownership hardening
(`20260610120000`); circle invitations + RPCs; the Step‑5 membership/ownership lockdown
(`20260610130200`); and the **notification engine** (`20260611120000` core, `…120100` functions,
`…120200` circle timezone + `set_circle_timezone`). The tree **ends at `20260611120200`**.

### 3.2 Which live changes are missing from migrations

Everything in §2 rows 3–18 (and the `sanad.in_claim` body of row 14). A grep of the whole
`supabase/migrations/` tree returns **"No matches found"** for `responsible_user_id`,
`can_view_all_operational`, `is_responsible_for_medication`, and all six claim/outcome RPC names;
`assigned_to` matches **only** `care_tasks` (`090000`) and the Step‑3 hardening (`110000`), never
`care_appointments`. A fresh replay of `supabase/migrations/` would produce the **pre‑2D** schema.

> The word `claim` *does* appear in `20260611120000`/`…120100`, but every hit is the unrelated
> **push‑delivery lease** (`claim_push_deliveries`, `claim_token`) — not the responsibility claim
> RPCs. Do not conflate them when backfilling.

### 3.3 Committed migrations that now conflict with live policies

These committed policy/function definitions **still describe the pre‑2D state** and therefore diverge
from the live DB — a replay would *re‑introduce* behavior 2D/2E deliberately removed:

1. **`care_tasks` collaborator UPDATE (the `assigned_to is null` allowance).**
   `20260610090000:262‑274`, policy *"Members can update assigned care tasks"* —
   `using ( has_circle_role(circle_id, array['caregiver','family_member']) and (assigned_to is null or
   assigned_to = auth.uid()) )` (same `with check`). Live **dropped** this and replaced it with an
   `assigned_to = auth.uid()`‑only form (2D). **A replay re‑opens unassigned‑task action to any
   caregiver/family member** — the exact loophole 2D closed.
2. **Own‑visit DELETE policy.** `20260610090200:163‑171`, *"Members can delete their own family
   visits"* — `using ( has_circle_role(circle_id, array['caregiver','family_member']) and
   visitor_user_id = auth.uid() )`. Live **dropped** this (2E, "closes the claim→delete escalation").
   **A replay lets a claimer delete a manager‑authored visit.**
3. **Pre‑2D open SELECT policies.** `care_tasks` (`090000:205‑210`), `care_appointments`
   (`090100:83‑88`), `family_visits` (`090200:72‑77`), `medication_logs` (`20260608130200:60‑65`) —
   all `using (is_circle_member(circle_id))`. Live rewrote each to responsibility‑scoped
   (`can_view_all_operational(...) OR owner = auth.uid()`). **A replay broadens read visibility**,
   leaking unassigned/other‑member operational rows the app now assumes are hidden.
4. **`medication_logs` INSERT/UPDATE role‑gate policies.** `20260608130200:71‑96` / `101‑132` — gate
   on role array only. Live added the `is_responsible_for_medication(...)` responsibility gate (2D).
5. **`enforce_care_task_collaborator_scope()` body.** `20260610090000:143‑195` — committed body has
   **no** `sanad.in_claim` bypass; the live body does (2E). A replay would make the claim RPC's
   status‑preserving update path behave differently.

`20260610110000_harden_step_3_rls_membership_checks.sql` only rewrote the **six manager INSERT/UPDATE
policies** (its own header §Scope note, lines 24‑28); it explicitly left SELECT, DELETE, and the
collaborator‑UPDATE policies untouched — which is why the pre‑2D allowances above are still the last
committed word.

---

## 4. Generated types coverage

### 4.1 Columns present

All four responsibility columns are in `src/types/supabase.ts` with `Row`/`Insert`/`Update` +
foreign‑key entries: `care_appointments.assigned_to` (L20/36/52, FK L89‑90),
`medications.responsible_user_id` (L758/772/786, FK L799‑800), `care_tasks.assigned_to`
(L187/206/225, FK L252‑253), `family_visits.visitor_user_id` (L562/576/590, FK L601‑602). For the two
**drifted** columns this means the **types are *ahead* of the migrations** — they were hand‑patched in
(Phase 2B §3: "already present in the generated types … no patch needed" for the originals; the two
new columns were patched into the types artifact, not CLI‑regenerated).

### 4.2 RPCs missing from generated types (handled via local casts)

Under `Database['public']['Functions']`, **all six claim/outcome RPCs and both helper functions are
ABSENT**: `list_available_to_claim`, `claim_care_task`, `claim_medication_responsibility`,
`claim_care_appointment`, `claim_family_visit`, `set_assigned_appointment_outcome`,
`can_view_all_operational`, `is_responsible_for_medication` — none appear. (`set_circle_timezone` L1515
**is** present; the notification RPCs are all present.)

The app compensates with **one** workaround in `src/features/claiming/api.ts`:

```ts
// callClaimRpc<T>(fn, args)  (lines ~20‑28)
const client = supabase as unknown as {
  rpc: (name: string, params?: Record<string, unknown>)
    => PromiseLike<{ data: unknown; error: unknown }>;
};
const { data, error } = await client.rpc(fn, args);
if (error) throw error;
return data as T;
```

`claiming/types.ts` declares a **local** `AvailableClaimItem` / `ClaimItemType` to describe the
`list_available_to_claim` `RETURNS TABLE` shape that the generated types lack (its header notes "the
only cast lives in `./api`"). No `as any` / `@ts-expect-error` / `@ts-ignore` / `eslint-disable`
appears in the claiming/tasks/appointments/visits/medications/notifications API files (only the one
`as unknown as` wrapper above, plus an unrelated Expo push‑payload cast in `notifications/hooks.ts:339`).

### 4.3 Risks of not regenerating types

- **Silent RPC drift.** Because the six RPCs are called by string through an untyped cast, a
  signature change (param name/type, return shape) or a **missing** RPC on a given environment is
  **not** caught at compile time — it surfaces only at runtime (`PGRST202 function not found` /
  argument errors). The cast trades type safety for the ability to call an unlisted function.
- **False confidence on a fresh DB.** The two drifted columns are declared in the types, so
  `createAppointment(assigned_to)` / `createMedication(responsible_user_id)` **type‑check even against
  an environment where the columns don't exist** — the failure (`PGRST204 column not found`) is
  deferred to runtime (see §5/§10 scenario C).
- **Review blind spot.** A future `supabase gen types` run against the **live** DB would suddenly add
  the six RPCs and change nothing about columns — a large, correct diff that is easy to mistake for
  noise if the drift isn't understood first.

### 4.4 Recommended timing for type generation (do not run now)

Regenerate `src/types/supabase.ts` **from the live DB, once the migration backfill is authored and
(ideally) applied to a scratch environment that matches live** — i.e. **after 2F‑1.6, before 2F‑2**.
Regenerating against the live DB now would *work* (it would add the six RPCs and make the cast
redundant), but doing it **after** the backfill keeps a single reconciliation point and avoids a
second "why did the types change" diff. **Do not** regenerate against a fresh migrations‑only DB —
that would *delete* the two drifted columns from the types and break the build (§10 scenario B).

---

## 5. Notification dependency analysis (what Phase 2F needs from the live schema)

| Phase 2F notification need | Depends on (live‑only unless noted) | Why |
|---|---|---|
| Target reminders to the responsible task owner | `care_tasks.assigned_to` *(committed)* | Recipient = assignee, not the whole circle |
| Target medication dose reminders to the responsible person | `medications.responsible_user_id` *(live‑only, row 4)* | Recipient = responsible member |
| Target appointment reminders to the assignee | `care_appointments.assigned_to` *(live‑only, row 3)* | Recipient = assignee |
| Target visit reminders to the visitor | `family_visits.visitor_user_id` *(committed)* | Recipient = visitor |
| Emit "someone claimed X" to managers; suppress duplicate reminders after claim | claim RPCs `claim_care_task` / `claim_medication_responsibility` / `claim_care_appointment` / `claim_family_visit` *(live‑only, rows 8‑11)* | The RPCs are the natural producer hook (2F audit §4) |
| "Unassigned items need an owner" digest | `list_available_to_claim` *(live‑only, row 7)* | Source of the claimable set |
| Appointment outcome awareness to managers | `set_assigned_appointment_outcome` *(live‑only, row 12)* | Assignee‑recorded outcome producer hook |
| Only notify recipients who can *read* the item (deep‑link safety) | Phase 2D scoped SELECT + `can_view_all_operational` + `is_responsible_for_medication` *(live‑only, rows 5‑6, 15‑16)* | A reminder to a non‑owner lands on an RLS‑empty screen (2F audit §0/§9) |
| Suppress a reminder once a visit is completed/cancelled by its owner | `family_visits_collaborator_scope` trigger *(live‑only, row 13)* + a future visit source‑validity check | Keeps status‑only transitions honest server‑side |
| Reuse the delivery pipeline unchanged | `notifications` / `notification_outbox` / `notification_push_deliveries` / `enqueue_notification` / `fanout_due_notifications` / `claim_push_deliveries` / `notification_source_validity` / `notification_preferences` / `push_tokens` *(committed + in types)* | The engine already exists; Phase 2F adds producers + a responsibility‑aware resolver on top |

**Conclusion:** Phase 2F recipient resolution and claim‑aware producers depend on **live‑only** rows
3–13. The **delivery engine** it plugs into is fully committed. So the *only* thing standing between
Phase 2F and a reproducible base is the **responsibility/claim backfill** — which is exactly this
report's subject.

---

## 6. Backfill strategy options

### Option A — Continue Dashboard‑only apply‑packs; document drift
- **How:** Keep authoring SQL as `docs/claude-reports/*apply-pack.md` + applied‑verification, never as
  migration files. Backfill nothing.
- **Pros:** Zero new work; matches the established, verified workflow; production is already correct
  and proven (2D/2E verification).
- **Cons:** Drift **grows** with every phase; `supabase db reset` / new env is permanently broken;
  generated types stay partly hand‑maintained; onboarding + review get harder; the Phase 2F
  notification SQL would add a *second* Dashboard‑only layer on top of an already‑drifted base.
- **Risk:** **High long‑term.** Each additional live‑only change increases the "replay ≠ production"
  blast radius. Not sustainable through Phase 2F+.

### Option B — Add additive/idempotent migration **backfill files** for all manually applied changes
- **How:** Author new, forward‑dated migration files (e.g. `20260626…_backfill_phase_2a_assignment_columns.sql`,
  `…_backfill_phase_2d_responsibility_rls.sql`, `…_backfill_phase_2e_claim_flow.sql`) that recreate the
  live objects **idempotently** (`add column if not exists`, `create or replace function`,
  `drop policy if exists` + `create policy`, guarded `create trigger`). Do **not** edit historical
  migrations. Then regenerate types from live.
- **Pros:** `supabase/migrations/` replay reproduces the live schema; `db reset` / new env works;
  types can be CLI‑regenerated; Phase 2F builds on a reproducible base; matches the notification
  engine's own pattern (committed migrations *plus* a Dashboard artifact). Idempotent files are safe
  to run against the live DB (no‑op) if ever needed.
- **Cons:** Requires careful authoring so the backfill **exactly** matches live (esp. the dropped
  policies and the `sanad.in_claim` body); a modest one‑time effort; ordering must respect
  dependencies (columns → helpers → policies → RPCs/triggers).
- **Risk:** **Low‑to‑medium**, and controllable: additive + idempotent + verified against the §9
  inventory. The main hazard is *inexact* reproduction, which the verification plan (§9) is designed
  to catch.

### Option C — Pause and **rebuild** migrations from the live schema (squash/dump)
- **How:** `supabase db dump` (or introspect) the live schema and replace/rebase the migration
  history with a regenerated baseline.
- **Pros:** Guarantees repo == live in one shot; cleanest possible end state.
- **Cons:** Rewrites migration history (risky, review‑heavy, easy to lose intent/comments); a dump
  captures *effective* state but not the carefully‑commented, idempotent, guarded style the repo uses;
  higher chance of an accidental behavioral change; **requires** touching the live DB / CLI to dump
  (against this phase's constraints and the project's manual‑only posture).
- **Risk:** **High.** Large, hard‑to‑review change; discards history; needs CLI/DB access this phase
  forbids. Overkill for ~16 well‑documented objects.

---

## 7. Recommended strategy

**Adopt Option B — additive, idempotent migration backfill files — authored in a later step, not
now.**

Specifically:

1. **Create additive/idempotent migration backfill files** for the manually‑applied assignment / RLS
   / claim objects (§2 rows 3–18 + the row‑14 body), grouped by phase:
   - **2A backfill:** `care_appointments.assigned_to`, `medications.responsible_user_id` (+ their
     indexes and the Phase 2A manager INSERT/UPDATE guards applied in the same step).
   - **2D backfill:** `can_view_all_operational`, `is_responsible_for_medication`; the responsibility‑
     scoped SELECT policies; `medication_logs` INSERT/UPDATE gates; **DROP** of the `care_tasks`
     unassigned‑UPDATE allowance.
   - **2E backfill:** the six RPCs; `enforce_family_visit_collaborator_scope` + trigger; the
     `enforce_care_task_collaborator_scope` body with the `sanad.in_claim` bypass; **DROP** of the
     own‑visit DELETE policy.
2. **Do not rewrite historical migrations.** Leave `20260610090000` / `090100` / `090200` /
   `20260608130200` as‑is; the backfill files supersede their now‑stale policies via
   `drop policy if exists` + recreate. (Accept that a *strict* linear read of history shows the
   pre‑2D policy then its later drop — this is normal, honest migration history.)
3. **Keep the Dashboard as the source of truth for current production**, but **bring repo migrations
   forward** so replay/new‑env matches live. The backfill files should be **idempotent** so they are a
   safe no‑op against the already‑live production DB.
4. **Generate types only after** the migrations/schema are reconciled (regenerate from live, §4.4) —
   which then makes the `callClaimRpc` cast redundant (it can stay or be removed later; not required).
5. **Only then design/apply the Phase 2F notification SQL** (2F‑2), on top of a reproducible base.

Rationale: Option B is the lowest‑risk way to make the repo reproducible without touching production
or discarding history, and it mirrors the pattern the notification engine already follows (committed
migrations + a Dashboard artifact). Everything needed to author it already exists in the apply‑packs
and applied‑verification reports.

---

## 8. Proposed safe sequencing

1. **2F‑1.5 — this audit** (report‑only). ✅ *(this document)*
2. **2F‑1.6 — migration backfill proposal / apply‑pack report.** Author the three backfill migration
   **bodies** as a *report/apply‑pack* (SQL shown, **not** executed, **no** files under
   `supabase/migrations/` yet), each additive + idempotent, transcribed from the 2A/2D/2E apply‑packs
   and applied‑verification. Report‑only.
3. **Manual review.** Human reviews the backfill SQL against §3.3 (conflicts) and §9 (inventory) —
   confirms it matches live exactly and broadens nothing.
4. **Optional migration files creation in repo.** With approval, add the reviewed backfill `.sql`
   files under `supabase/migrations/` (a normal committed change — outside this report‑only phase).
5. **Local / static validation.** `npx tsc --noEmit`, `npx expo-doctor`, `git diff --check`; if
   feasible, apply the backfill to a **scratch** Supabase project and `supabase db reset` to prove
   replay reproduces live (user‑run; not from this environment). Then regenerate types from live.
6. **2F‑2 — notification SQL proposal**, authored against the now‑reconciled schema (responsibility‑
   aware recipient resolver, new event types/producers per the 2F readiness audit).

**Do not implement steps 2–6 here.** This report stops at step 1.

---

## 9. Verification plan (if backfill migrations are created later)

Everything below is **user‑run** SQL in the Dashboard (or against a scratch DB); this report neither
runs nor connects.

**What to compare:** the backfill SQL vs. the live DB objects, using the same inventory the 2D/2E
reports used (the 2D audit §7.1 policy inventory + the 2E preflight §2 checks).

**Inventory queries the user would run manually (read‑only):**

- **Columns exist:** `information_schema.columns` for `care_appointments.assigned_to`,
  `medications.responsible_user_id` (type `uuid`, nullable, FK → `profiles`).
- **Helpers + RPCs exist with correct signatures:** `pg_proc` / `pg_get_functiondef` for
  `can_view_all_operational`, `is_responsible_for_medication`, the six claim/outcome RPCs — confirm
  `SECURITY DEFINER`, `search_path=''`, and grants (`authenticated` for client RPCs; `service_role`
  where applicable). Expect the **2E count = 7** (6 RPCs + `enforce_family_visit_collaborator_scope`).
- **Triggers exist:** `pg_trigger` for `family_visits_collaborator_scope` and
  `care_tasks_collaborator_scope` (**count = 2**); confirm `enforce_care_task_collaborator_scope`
  body contains the `sanad.in_claim` bypass (`pg_get_functiondef`).
- **Policies match, no broadening:** `pg_policies` for `care_tasks` / `care_appointments` /
  `family_visits` / `medication_logs` — each SELECT must be the **scoped** predicate
  (`can_view_all_operational(...) OR owner = auth.uid()`), **not** bare `is_circle_member`.
- **Removals confirmed:** own‑visit DELETE policy **count = 0**; the `care_tasks` collaborator UPDATE
  policy has **no** `assigned_to is null` branch.

**How to verify no policy broadening:** diff the live `pg_policies.qual` / `with_check` text against
the backfill's policy bodies; assert every SELECT is responsibility‑scoped and that the two dropped
policies are **absent**. Re‑run the **Family1 RLS simulation** from 2D §4 (set‑local authenticated
role + `sub=family1`, rolled‑back tx) and confirm the same counts: **Tasks 4, Appointments 3,
Visits 2, Medication logs 1** — proving scoping is unchanged.

**How to verify RPCs/triggers exist & behave:** confirm `list_available_to_claim` returns only
unowned + eligible‑status rows; confirm a `remote_member` is rejected with **`42501`** on both the
feed and a claim (2E §4); confirm a double‑claim raises **`23505`**.

**How to verify the app still passes QA:** run the app against the DB post‑backfill and exercise the
claim flow end‑to‑end (list → claim task/med/appointment/visit → outcome), plus the assignment UI and
the scoped operational lists, on the S24 Ultra (Arabic/RTL/dark). Expect **no** behavioral change vs.
today (the backfill only makes the repo reproduce what's already live). Static gates:
`npx tsc --noEmit`, `npx expo-doctor`, `git diff --check`.

---

## 10. Risks / open questions

1. **Live DB vs. migrations.** `supabase/migrations/` reproduces the **pre‑2D** schema; production is
   two feature layers ahead. Until backfilled, replay ≠ production.
2. **Reset / new‑environment drift.** A `db reset` or new env built from migrations would silently
   **re‑introduce** the dropped unassigned‑task UPDATE allowance and own‑visit DELETE policy, broaden
   all four SELECT policies, and lack the assignee columns + claim RPCs — a security‑relevant
   regression, not just a missing feature.
3. **Generated‑types drift.** Types are *ahead* for two columns (hand‑patched) and *behind* for six
   RPCs (absent). Regenerating against the **wrong** base (migrations‑only) would delete the columns
   and break the build; regenerating against live is safe but should follow the backfill (§4.4).
4. **Security‑trigger edits.** The `enforce_care_task_collaborator_scope` body was **replaced live**
   (claim bypass) and `enforce_family_visit_collaborator_scope` added live. Backfill SQL must
   reproduce these **exactly** (the `sanad.in_claim` GUC, `is_local=true`, early‑return) — an
   inexact copy could weaken a status‑only guard. This is the highest‑care item in the backfill.
5. **Notification engine depending on the stale recipient model.** The committed engine resolves
   recipients circle‑broad (2F readiness audit); Phase 2F‑2 will add responsibility‑aware resolution
   that **requires** the live‑only columns/helpers. Backfill must land first so 2F‑2 references real,
   committed objects.
6. **Do existing notification migrations need patching, or new migrations?** **New migrations.** The
   three notification migrations (`…120000/120100/120200`) are correct and should **not** be edited.
   Phase 2F‑2's notification changes (new enum values, responsibility‑aware resolver, producers) go in
   **new** additive migration files, authored *after* the responsibility/claim backfill — never by
   rewriting the committed engine files.
7. **Open — backfill grouping & dating.** One combined backfill file vs. three per‑phase files (2A /
   2D / 2E)? Recommendation: **three**, mirroring the apply‑packs, for reviewability. Date them
   *after* the last committed migration (`20260611120200`) so history stays linear.
8. **Open — keep or remove the `callClaimRpc` cast after regenerating types?** Once the RPCs are
   typed, the cast is redundant. Removing it gains type safety but is a code change for a later phase;
   leaving it is harmless. Defer to 2F‑2+.
9. **Open — should the backfill also capture the Phase 2A manager INSERT/UPDATE guards** that were
   applied alongside the two columns (2B §1, 2A §5.1/§5.2)? Recommendation: **yes** — include them in
   the 2A backfill so the reproduced schema matches live authorization exactly.

---

## 11. Confirmation

- ✅ **No SQL run.** No migrations, apply‑packs, or queries executed; no SQL files written.
- ✅ **No Supabase CLI / connection.** No `supabase` command, no login/link/db push/pull/dump, no
  `gen types`, no remote DB access or introspection. All "live" facts are quoted from prior reports.
- ✅ **No app code changed except this report.** No source, dependencies, Expo config, native files,
  backend functions, generated types, or migrations were modified. The only new file is this markdown
  report.
- ✅ **No env / secrets touched.** No `.env` read; no tokens/keys inspected or printed (the audit
  confirmed `src/types/supabase.ts` contains no secret‑looking value and did not quote any).
- ✅ **No commit / no stage / no EAS / no prebuild.** Nothing committed, staged, or built. No other
  project touched (ThinkMate untouched).

## 12. `git` status & diff

Run at hand‑off (read‑only):

- `git --no-pager status --short`
- `git --no-pager diff --stat`

The only expected change is the addition of this untracked file:
`docs/claude-reports/2026-06-26-phase-2f-1-5-live-schema-backfill-audit.md`.
