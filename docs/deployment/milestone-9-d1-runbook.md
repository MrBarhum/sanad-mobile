# Milestone 9 · D1 — runbook: widen `can_view_all_operational` to `family_member`

**Branch:** `f1-rls-widen` (worktree), based on `master` @ `414a4d8`
**Date written:** 2026-08-07
**Status:** **WRITTEN, NOT APPLIED.** Nothing in this document has been run.

Backend changes are hand-applied in this project. This is the ordered step list for
the maintainer. Do not run `supabase db push` or any SQL below without reading §6
(the acceptance criteria) first — the point of this change is that it is *observed*,
not assumed.

---

## 1. What this changes, and why it is a correction rather than a new grant

`public.can_view_all_operational()` has been `admin | primary_caregiver |
remote_member` since Phase 2D. CLAUDE.md standing decision A1 asserts the opposite —
that every active member sees all operational data, and that this "mirrors the server
`can_view_all_operational` posture."

It never mirrored it. It inverted it, with a result no reading defends: **a read-only
`remote_member` saw more of the circle than an active `family_member` doing the
care.** Two shipped affordances were dishonest as a direct consequence:

- the «كل المهام» scope pill returned a list byte-identical to «مهامي», because the
  client's `isMine` predicate is character-for-character the RLS predicate the server
  had already applied; and
- the inline «أنا متكفّل» claim pill could never render for the roles it was built
  for — an unassigned task (`assigned_to IS NULL`) can never satisfy
  `assigned_to = auth.uid()`, so those rows were invisible to `family_member`, while
  the three roles that *could* see them include `remote_member`, who the claim RPCs
  refuse.

D1 adds `'family_member'` to the array. Full analysis:
`docs/claude-reports/2026-08-07-qa-verification.md` (F1).

> ### Add `family_member`. Never `caregiver`.
>
> `care_tasks` and `medication_logs` are the only two gated tables with **no**
> restrictive Milestone-8 backstop — `20260726160000` narrows seven other tables and
> not these. This function is therefore the *only* thing holding them narrow for a
> hired caregiver. Adding `'caregiver'` would hand a paid worker the family's entire
> task list and complete dose history with no policy left to catch it. The migration
> asserts `caregiver` is absent and fails if it appears.

---

## 2. Five surfaces move, not one

Every gated policy **calls** the function; none inlines the array. Replacing the body
widens all five at once — including one outside `supabase/migrations/`, which is the
trap `20260729120000:60-65` warns about (a migrations-only scan finds four).

| | Surface | Defined at | Narrow branch a `family_member` was held to |
|---|---|---|---|
| S1 | `public.care_tasks` SELECT | `20260626161000:54-68` | `assigned_to = me OR completed_by = me` |
| S2 | `public.care_appointments` SELECT | `20260626161000:88-99` | `assigned_to = me` |
| S3 | `public.medication_logs` SELECT | `20260626161000:150-161` | responsible for that medication |
| S4 | `public.family_visits` SELECT | `20260626161000:164-175` | `visitor_user_id = me` |
| S5 | `storage.objects` SELECT, bucket `dose-proof` | `docs/deployment/dose-proof-storage.sql:67-85` | responsible for that medication |

### What a `family_member` newly gains, concretely

- **S1** — every task in the circle: unassigned open work (previously invisible), tasks
  assigned to a sibling, tasks completed or cancelled by anyone else. This is the one
  surface where the change is immediately visible on screen.
- **S2** — every appointment, including manager-created ones with no assignee.
- **S3** — every dose log: status, `recorded_at`, `recorded_by`, the correction
  columns, notes, `proof_object_path`. **This is the strongest correctness argument
  for D1.** `medications` and `medication_schedules` SELECT are both bare
  `is_circle_member(circle_id)`, so a family_member *already* sees every medication
  and schedule and therefore computes every dose slot for today — while seeing none of
  the logs. The result is a fabricated all-"not recorded" day, indistinguishable from
  genuine non-recording. That is the same defect class as commit `4ef5e57`
  *"stop an administered dose re-presenting as unlogged"*.
- **S4** — every visit, including `visitor_name` free text that may name a non-member.
- **S5** — signed-URL read on every dose-proof photo in the circle. Argued in §3.

**Bonus, positive:** `family_member` is already in the notification eligibility arrays
(`20260626164000:79,178,189`), so today a family_member can receive a reminder whose
deep link lands on an RLS-empty screen. D1 closes that gap.

### What every other role gains: nothing — and here is the proof, not the assertion

`has_circle_role` (`20260607033000:128-146`) is role-**exact** (`cm.role = any(...)`),
requires `status = 'active'`, and has no hierarchy or inheritance.

1. **Algebraic.** For sets, `r = any(A ∪ {f})` ≡ `(r = any(A)) OR (r = f)`. For any
   caller whose role `r ≠ 'family_member'`, the added disjunct is FALSE and the
   expression is bit-identical to before.
2. **Disjointness.** `unique (circle_id, user_id)` on `circle_members`
   (`20260607033000:45`) — one user holds at most one role per circle, so nobody can
   pick up the new disjunct through a second membership row. This is what makes (1)
   total rather than per-row.
3. **Status gate.** An `invited` or `removed` family_member gains nothing.

For `admin` / `primary_caregiver` / `remote_member` the first disjunct was already
TRUE, and TRUE OR anything is TRUE — their counts are already the circle maxima.
**Zero delta, upper-bounded.**

For `caregiver`, PostgreSQL evaluates `(OR of PERMISSIVE) AND (AND of RESTRICTIVE)`.
D1 touches only the permissive side. On `care_appointments` and `family_visits` the M8
restrictive policies (`20260726160000:244`, `:221`) evaluate FALSE for her, so those
stay at zero rows regardless. On `care_tasks` and `medication_logs` there is no
restrictive backstop, and her immunity rests entirely on (1)+(2) above — which is
exactly why `caregiver` must never be added to the array.

---

## 3. Dose-proof photos — the decision, stated out loud

**Decision: accept the widening. Do not add a counteracting narrow policy.**

### The mechanical fact first

The storage policy *calls* `public.can_view_all_operational(...)` at
`dose-proof-storage.sql:75`. Replacing the function body widens the bucket read
**automatically**, with no line about `storage.objects` in the migration and no
visibility from a migrations-only diff. The only decision actually available was
whether to *counteract* it.

The delta is **read-only, provably**: the function appears exactly once in that file.
INSERT (`:92-121`), UPDATE (`:125-174`) and DELETE (`:183-207`) use a different
predicate entirely and are untouched. A family_member gains no ability to upload,
replace or delete another member's photo.

### What is in the bucket

A private bucket (2 MiB cap, jpeg/png/webp), read only via `createSignedUrl` with a
**600-second TTL** (`src/features/caregiver/api.ts:15-16`), URL never persisted. The
content is a photograph taken at administration time — in practice by the hired
caregiver, proving she did her job. Photographs capture more than they intend: the
pill and blister, but also the recipient's hands or face, the room, a pill organiser
exposing the whole regimen, other people present.

### The argument against, at its strongest

1. A photograph is categorically different from a status enum. "`given` at 08:12" is a
   bounded fact; a photo is uncontrolled incidental capture.
2. The artifact's purpose is narrow and employment-shaped — it exists so a *hired
   worker* can prove her work and the family who *employs* her can check. The M8
   report frames the weekly summary built on these photos as the family's oversight
   view and manager-gates it.
3. The care recipient never consented; there is no consent surface for "photos of me
   are visible to all N members".
4. **Storage is the one surface with no revocation story.** A signed URL is a bearer
   token — forwardable, screenshot-able. A table read is revoked the instant you change
   a policy; a leaked photo is forever.

### Why we widen anyway

1. **The current line is not a privacy boundary; it is an accident of array
   membership.** `remote_member` — the most passive role in the product, read-only,
   typically not in the country — **already reads every dose-proof photo in the
   circle**. A `family_member` who is physically present and shares the care load does
   not. Defending the status quo requires defending that inversion.
2. **No new trust domain is crossed.** Every reader gained is already an active member
   who reads the recipient's profile, chronic conditions, allergies, emergency notes,
   every medication, every schedule, every vital and every daily log. Argument (1)
   above proves photos are *sensitive*; it does not prove this audience is *new*.
3. **The alternative creates drift.** A `storage.objects` predicate deliberately
   narrower than the row it mirrors — with a comment explaining the exception — is
   precisely the shape that `20260726160100:22-31` records four production function
   bodies having silently diverged into. The policy's own header says: *"If those row
   policies ever change, change these in the same migration."*
4. **Blast radius today is zero UI.** The only render site is
   `week-summary.tsx:577`, on a screen manager-gated in the client at `:66,108`. D1
   grants a capability no shipped screen exercises for a family_member — which is the
   right moment to take a widening: measurable, reversible, not yet load-bearing.

**If broadcast-to-all-members is uncomfortable as a product posture**, the correct
lever is a shorter TTL and/or an explicit "who can see dose photos" circle setting — a
product control with a UI, not an RLS array that contradicts A1 and lets
`remote_member` through anyway.

---

## 4. Before you run anything — capture the "before"

All four are read-only. Run from the repo root against the Sanad project.

```
1. docs/deployment/milestone-8-role-probe-read.sql
      → docs/claude-reports/milestone-9-probes/d1-before-read.csv
2. docs/deployment/milestone-9-d1-dose-proof-probe.sql        (new, this change)
      → docs/claude-reports/milestone-9-probes/d1-before-doseproof.csv
3. docs/deployment/milestone-8-caregiver-permission-proof.sql (expect OVERALL PASS)
      → docs/claude-reports/milestone-9-probes/d1-before-caregiver.txt
4. node scripts/check-execute-grants.js                        (expect green)
```

**Do not edit `milestone-8-role-probe-read.sql`.** It is the committed M8 acceptance
artifact and four historical CSVs are diffed against its exact output shape. Run it
unchanged; the new probes are new files.

---

## 5. Apply

Exactly one migration, nothing else bundled:

```
supabase/migrations/20260807120000_widen_can_view_all_operational_to_family_member.sql
```

> **`create or replace`, never `drop`.** All five policies hold a `pg_depend`
> dependency on this function's OID. `drop function` errors; **`drop ... cascade`
> silently drops all five policies**, leaving `care_tasks`, `care_appointments`,
> `medication_logs` and `family_visits` with no permissive SELECT policy at all —
> deny-all for every role, admins included. The migration is written as
> `create or replace` and must stay that way.

The migration asserts itself before it finishes: all four roles present (not just the
new one — checking only for the addition would pass even if the array had been
replaced by a single element), `caregiver` absent, still `SECURITY DEFINER`, `anon`
still revoked, `authenticated` still granted.

Get the maintainer's explicit approval of the exact command before running it.

---

## 6. Acceptance criteria — the change is rejected unless these hold

Re-run all four captures from §4 into `d1-after-*`.

### 6a. The read matrix: exactly ten changed lines

`diff d1-before-read.csv d1-after-read.csv`, with `grp = 'cron'` filtered out of both
sides (`grep -v '^cron,'` — five pg_cron jobs write those tables every 5–15 minutes).

Every changed line must have `role = family_member`, and there must be exactly ten of
them for a circle with two family members:

| line | expected |
|---|---|
| `core,1,family_member,{1,2},table,care_tasks` | → equals the `admin` value |
| `core,1,family_member,{1,2},table,care_appointments` | → equals the `admin` value |
| `core,1,family_member,{1,2},table,family_visits` | → equals the `admin` value |
| `core,1,family_member,{1,2},table,medication_logs` | → equals the `admin` value |
| `rpc,1,family_member,{1,2},rpc,can_view_all_operational` | `0 → 1` |

**Check equality with `admin`, not merely "it went up."** The former asserts the
widening is exactly *"sees what a manager sees"*; the latter would pass on a partial
or wrong widening. On the last committed matrix
(`docs/claude-reports/milestone-9-probes/b1-after-read.csv:2-11`) those admin values
are 34 / 12 / 7 / 21.

**Any** change on an `admin`, `primary_caregiver`, `remote_member` or `caregiver`
line is a **FAIL**. Any change on a family_member line for a table *other* than those
four is a **FAIL** — it would mean something inlines the role array somewhere this
analysis did not find. **Stop and roll back.**

### 6b. Dose-proof predicate

`diff d1-before-doseproof.csv d1-after-doseproof.csv` — `readable` goes `0 → 1` for
family_member on every medication they are not responsible for, `1 → 1` on the ones
they are. All other roles unchanged.

### 6c. The caregiver is provably unaffected

`milestone-8-caregiver-permission-proof.sql` must produce **identical verdicts** and
`OVERALL PASS`, before and after. It promotes an existing member to `caregiver` inside
a transaction and rolls back, so it needs no real caregiver in the roster — which
matters, because the production circle has none and
`milestone-8-caregiver-permission-proof.sql:7-16` records that one must not be added
(a real member would move `circle_members` counts for every other role and destroy the
matrix's comparability).

*Confirmed rather than assumed:* that proof borrows an active `remote_member` and
re-roles them to `caregiver` for the transaction. Since `has_circle_role` is
role-exact, the borrowed member reads as `caregiver` throughout — so D1 cannot reach
them by either disjunct, and the proof stays valid post-D1.

### 6d. Grants byte-identical

`node scripts/check-execute-grants.js` green, and the execute-privilege probe
unchanged. `create or replace` preserves privileges, so `can_view_all_operational`
stays in `authenticated-execute-allowlist.json` with no edit. No regeneration of
`src/types/supabase.ts` is needed either — the signature is unchanged.

---

## 7. Rollback

`docs/deployment/milestone-9-d1-rollback.sql` restores the pre-D1 body character for
character, with the same `create or replace` warning and its own assertion block.

Verified to restore the before matrix exactly, because: the function is pure and
nothing stores a materialisation of it; no policy is created, dropped or altered in
either direction (all five reference it by OID and `create or replace` preserves the
OID, so the policies are not even invalidated); and grants survive.

**Two residuals the rollback does not undo.** Both small; know about them rather than
discover them:

- **Signed URLs already minted.** TTL is 600 seconds, so a family_member who fetched a
  dose-proof URL during the widened window keeps a working bearer URL for up to ten
  more minutes. A tail, not a hole.
- **Client React Query caches** on devices that fetched wide rows. Client-only, cleared
  on refetch or restart; RLS is re-enforced on every new request.

---

## 8. After it lands — what is now stale, and what it unlocks

### Comments that become false the moment D1 applies

None is a code path; all are landmines for the next reader.

- `src/features/tasks/api.ts` and `src/features/tasks/figma-tasks.tsx` — both were
  written on branch `qa-fixes-tier2` to describe the *narrow* posture as current, and
  both name D1 as the pending change. Update them when D1 applies.
- `src/features/caregiver/week-api.ts:223-226` — the sentence's *reason* changes; its
  *conclusion* does not. The client manager-gate at `week-summary.tsx:66,108` remains
  and is unaffected.
- `supabase/migrations/20260726130000_dose_proof_helpers.sql:16-25` repeats the
  "family_member who cannot see the ROW" argument. **Deliberately not edited** — it is
  an applied migration and this project does not edit those in place. The equivalent
  comment in `docs/deployment/dose-proof-storage.sql` (a re-runnable deployment
  script, not a tracked migration) **has** been updated in this change.
- `CLAUDE.md` A1 carries a correction block noting the gap; flip its status once D1 is
  live.

### D1 is server-first — three screens stay unchanged

`figma-appointments.tsx:74`, `figma-visits.tsx:89` and `figma-medications.tsx:77` all
apply an **unconditional** `scopeToMine` filter with no toggle, so D1 widens the wire
and changes nothing on screen there. Only Tasks has a real pill pair and will visibly
change. That is deliberate; do not treat the three quiet screens as a failed
migration.

### What D1 unlocks

The medications «جرعاتي / كل الجرعات» toggle (finding F15, option b) was explicitly
**blocked** before D1: `medication_logs` SELECT was responsibility-scoped, so an
unscoped dose list would have rendered other members' doses as «لم تُسجَّل» even when a
sibling had already administered them — the double-dose hazard named at
`today.ts:109-115`. **D1 widens exactly that policy for `family_member`, so the toggle
becomes safe for that role once D1 is live.** It remains unsafe for `caregiver`, whose
`medication_logs` reads stay responsibility-scoped. Ship the toggle only after D1 is
applied and verified.
