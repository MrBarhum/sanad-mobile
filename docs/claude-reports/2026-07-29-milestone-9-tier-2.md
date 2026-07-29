# Milestone 9 · Tier 2 + the standing guard

**Branch:** `milestone-9-audit-fixes` (worktree), based on `milestone-8-caregiver` @ `b1ac775`
**Date:** 2026-07-29
**Status:** **APPLIED AND VERIFIED** on `qccgshanmoeybagxwvcs` (Sanad-dev)

Tier 1 is in `2026-07-29-milestone-9-tier-1.md`. Tier 3 was **not** started.

Two migrations were applied, **one at a time**, each with its own before/after probes:
`20260729120000` (Tier 1 A1) then `20260729130000` (Tier 2 B1).

---

## B1 · `medication_logs` authorship is now server-authoritative

**Finding:** `medication_logs` was the only record-keeping table whose author was
client-supplied. `vital_readings:183` and `daily_care_logs:169` both pin
`recorded_by = auth.uid()`; `care_tasks` enforces the same idea with a trigger.
`medication_logs` had neither, and the client sent both `recorded_by` and
`recorded_at` verbatim. A hired caregiver could backdate `recorded_at` so late
doses render «في وقتها» in the weekly summary, file a dose as another member or as
nobody, and rewrite a family member's log including flipping `missed` → `given`.

### Why a trigger, not only a policy

A `with check (recorded_by = auth.uid())` pins the author — and that is added,
mirroring the siblings — but a WITH CHECK cannot force a timestamp to `now()`; it
can only accept or reject what arrived. `recorded_at` is the column the weekly
compliance summary judges a named worker on, so it must be *assigned* by the
server, not merely validated.

Ordering makes the belt-and-braces real: PostgreSQL runs BEFORE ROW triggers, then
evaluates RLS WITH CHECK on the resulting row. The policy sees what the trigger
forced, so if the trigger were ever dropped the policy still refuses a forged
author on INSERT.

### The authorized correction path

A correction had to stay possible without letting anyone forge the original, so
the original was made **immutable** rather than merely permissioned:

- `recorded_by` / `recorded_at` — assigned once on INSERT, forced back to their
  previous values on every UPDATE. Nobody, at any privilege level, can rewrite who
  recorded a dose or when.
- `corrected_by` / `corrected_at` (new columns) — stamped by the same trigger when
  a dose **outcome** changes. A correction is additive: it records a second fact
  instead of destroying the first.

Stamping is deliberately gated on `status` changing. Attaching a dose photo must
not manufacture a "corrected by" that misrepresents someone as having altered a
medical record.

Side effect worth having: because `recorded_at` no longer moves, a later
correction can no longer retroactively turn an on-time dose into «متأخّرة».

### Verification

**Structural** — the migration's own assertions passed at apply time:

```
NOTICE (00000): M9 B1 verified: authorship trigger installed,
                correction columns present, INSERT policy pinned
```

They check the columns exist, the trigger is registered for **both** INSERT and
UPDATE (a trigger registered only for INSERT would leave every correction free to
rewrite the original), the INSERT policy carries the pin, and the new trigger
function is not `authenticated`-executable.

**Privilege** — `b1-before-exec.csv` → `b1-after-exec.csv`, exactly one line added:

```
> enforce_medication_log_authorship,,invoker,false,false,true
```

`anon=false`, `authenticated=false`, `service_role=true`. The new function arrives
closed, so it does not reopen the A1 gap. No other line moved.

**Read matrix** — `b1-before-read.csv` → `b1-after-read.csv`: **byte-identical**,
`core` identical, `42501` unchanged at 14.

**Behavioural** — `docs/deployment/milestone-9-authorship-forgery-probe.sql`
performs the attack the audit described, as `authenticated` with a real member's
JWT claims, inside a transaction that rolls back. All six checks PASS:

| # | Attack | Result |
|---|---|---|
| 01 | INSERT claiming another member recorded it | rewritten to the caller |
| 02 | INSERT backdated to 1990 | rewritten to `now()` |
| 03 | UPDATE rewriting `recorded_by` | refused — original held |
| 04 | UPDATE rewriting `recorded_at` | refused — original held |
| 05 | correction attributed | stamped with the real corrector |
| 06 | correction timestamped | stamped |

Privileges are not behaviour; only an attempted forgery settles it. Re-run any
time — it writes nothing.

### Residual, recorded rather than hidden

The UPDATE policy's `USING` clause stays row-blind: a member responsible for a
medication may still correct any log *of that medication*, not only their own.
Narrowing it would break the manager correction path this milestone had to
preserve. The accountability gap is closed by attribution instead — a responsible
member can still change a peer's dose outcome, but no longer anonymously or
disguised as the original record.

**Client aligned:** `insertLog`, `updateLogStatus` and `recordDose` no longer send
`recorded_by` / `recorded_at`. An older app build that still sends them keeps
working — the values are simply discarded.

---

## B2 · Arabic-Indic digits

**Finding:** `\d` in a JavaScript regex matches **only ASCII 0–9**, and `Number()`
does not understand Arabic-Indic digits. Both bugs shipped in an Arabic-first app:

```js
Number('١٢٠')                        // NaN  -> vitals could not be recorded
'٠٥٥١٢٣٤٥٦٧'.replace(/[^\d+]/g, '')  // ''   -> tel: with NOTHING after it
```

The second is the worse one: the **emergency call button silently did nothing** on
a number typed with an Arabic keyboard.

**Fix:** one shared `src/utils/digits.ts`.

- `normalizeDigits()` — maps Arabic-Indic (U+0660–0669) *and* Extended
  Arabic-Indic (U+06F0–06F9) digits to ASCII, the Arabic decimal separator `٫` to
  `.`, and drops the Arabic thousands separator `٬`. It normalizes; it does not
  validate.
- `toDialableNumber()` — normalizes **first**, then strips to digits and a leading
  `+`. Returns **null** when nothing dialable remains, rather than an empty
  string, so a caller can say so instead of opening the dialer on a blank field.

Applied to `toPositiveInt` / `toPositiveNumber` in `vitals/schema.ts` and to all
**four** duplicated `tel:` sanitizers (`contact-card`, `figma-doctors`,
`contacts-manager`, `figma-emergency-card`), which are now one implementation.

**Verified** — 13/13 assertions against the real compiled module, including
Extended Arabic-Indic, the decimal separator (`٣٦٫٥` → `36.5`), ASCII passthrough,
and null for input with no digits.

---

## B3 · The schedule-time ↔ dose-log mismatch

**Finding:** a log is bound to the `(schedule_id, scheduled_time)` it was recorded
against. Editing a schedule's time — 08:00 → 09:00 — left the log on 08:00 while
the expansion yielded 09:00, so the match failed and an **already-administered
dose re-presented as unlogged**. Double-dose risk. The same defect made the weekly
summary count one dose twice: a fabricated «لم تُسجَّل» plus the real dose.

**Fix:** three passes in `computeDoseItems`.

1. Exact `(schedule_id, scheduled_time)` — unchanged.
2. **Reunite** — any still-unmatched log attaches to the earliest not-yet-logged
   slot of the **same medication on the same date**. Scoped to one medication and
   one day, only ever filling an *empty* slot, so it cannot move a dose between
   medications or overwrite a recorded outcome. Deterministic: logs consumed in
   time order (id as tiebreak) against slots already in time order.
3. **Never drop a recorded fact** — anything still unmatched (schedule deleted or
   deactivated) surfaces as its own row, the rule the weekly summary already used.

Because `week-api.ts` calls `computeDoseItems`, its double-count is fixed at the
same point rather than separately.

**Verified** — `npm run check:doses`, 8/8, checked into the repo:

| Case | Asserts |
|---|---|
| baseline | no regression on the normal path |
| moved time 08:00→09:00 | dose stays recorded; **no phantom unlogged slot** |
| schedule deleted | recorded dose still surfaces |
| twice-daily | the reunite pass does not steal the evening slot |
| cross-medication | a log never migrates to another medication |
| explicit outcome | a moved dose cannot overwrite `missed` |
| determinism | pairing independent of input order |
| summary | moved dose counts as given, 0 remaining |

The test transpiles the **real module** with the TypeScript compiler (already a
devDependency — nothing new installed), so it tests shipping code, not a copy.

---

## Step 4 · The EXECUTE gap can no longer reopen silently

`pg_default_acl` grants `authenticated` EXECUTE on every function created in
`public`, so the next service-role-only function arrives open exactly as the 30
did. A migration cannot prevent recurrence; only a standing check can.

**`npm run check:grants`** — two halves:

- **Static** (no database, no secrets): the allow-list is coherent with the caller
  matrix — nothing denied has a real `authenticated` caller. This catches an
  allow-list edited to silence the live half.
- **Live** (linked project): the database's actual grants match the allow-list in
  both directions — a denied function holding EXECUTE (**gap reopened**), an
  allowed function that lost it (**over-revoked, app breaks**), or a function in
  neither list (**new and unreviewed**). Only `has_function_privilege` can see
  this; the repo's SQL text cannot, which is precisely how the gap hid.

The reviewed state is checked in at
`docs/deployment/authenticated-execute-allowlist.json` — **36 allowed, 31 denied**.

**Negative-tested**, because a guard that cannot fail is worthless:

| Simulation | Result |
|---|---|
| a denied function moved to allowed | **exit 1**, named the function |
| an allowed function dropped from both lists | **exit 1**, "in NEITHER list … the gap has reopened" |
| restored | exit 0 |

Exit codes: `0` pass · `1` drift · `2` could not reach the database. `--offline`
runs the static half only, so local work without link state is not blocked.

---

## Check suite

| Command | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `expo lint` | 31 problems — **identical to baseline** |
| `npm run check:i18n` | parity, 1247 keys |
| `npm run check:mojibake` | clean |
| `npm run check:grants` | 67 live functions, no drift |
| `npm run check:doses` | 8/8 |

`check:grants` and `check:doses` are new and wired into `package.json` beside
`check:i18n`.

---

## Not done, deliberately

- **Tier 3** — not started, as instructed.
- **`is_circle_medication_schedule`** is dead (no caller in any layer) and is now
  revoked but not dropped. Dropping it is a separate change.
- **`src/types/supabase.ts` has not been regenerated** since B1 added
  `corrected_by` / `corrected_at`. Nothing breaks — extra database columns do not
  invalidate existing selects — but the generated types no longer describe the
  full row, so `corrected_by` is invisible to TypeScript. Regenerate before any
  feature work that wants to display who corrected a dose.
- **Nothing committed or staged.**
