# D1 client narrowing audit — where the server widening does and does not reach the UI

**Branch:** `f1-rls-widen` (worktree), on `master` @ `414a4d8` + D1
**Date:** 2026-08-09
**Status:** **AUDIT ONLY — nothing fixed. No behaviour changed anywhere in this batch.**

D1 was applied 2026-08-07. `can_view_all_operational` is now `admin |
primary_caregiver | family_member | remote_member`; `caregiver` remains excluded.
Server acceptance passed (`b97480a`). The live browser QA of 2026-08-08 then found
that the widening reaches the UI on three of four surfaces and **not** on
`family_visits`.

This report starts from that confirmed instance, treats it as a reference pattern, and
reports every other place in the client with the same shape.

---

## 1. The confirmed instance

**`src/features/visits/figma-visits.tsx:92`**

```js
const visits = scopeToMine ? all.filter((visit) => visit.visitor_user_id === userId) : all;
```

driven by `:89` — `const scopeToMine = !canManage && canCollaborate;`

The server returned 7 rows; the screen rendered 2; the discriminator was
`visitor_user_id === session.user.id` with zero exceptions in either direction. Not a
D1 regression — the filter pre-dates it and was invisible while RLS was already
returning only her own rows. D1 removed the server constraint, so **this line became
the binding one.**

---

## 2. The table

Deduplicated. Every line number below was re-read from source rather than trusted.

| # | file:line | table | predicate | class | off-switch |
|---|---|---|---|---|---|
| 1 | `visits/figma-visits.tsx:92` | family_visits | `all.filter((visit) => visit.visitor_user_id === userId)` | **REDUNDANT_DEFENSIVE** | none |
| 2 | `appointments/figma-appointments.tsx:76` | care_appointments | `appointments.filter((a) => a.assigned_to === userId)` | **REDUNDANT_DEFENSIVE** | none |
| 3 | `medications/figma-medications.tsx:79` | medication_logs | `today.doses.filter((d) => d.responsibleUserId === userId)` | **REDUNDANT_DEFENSIVE** | none |
| 4 | `care-circle/figma-home.tsx:139` | medication_logs | `doses.filter((d) => d.responsibleUserId === userId)` | **REDUNDANT_DEFENSIVE** | none |
| 5 | `care-circle/figma-home.tsx:155` | care_tasks | `useTodayTaskSummary(circle.circleId, scopeToMine ? userId : null)` | **REDUNDANT_DEFENSIVE** | none |
| 6 | `care-circle/figma-home.tsx:159` | care_appointments | `(appointments.data ?? []).filter((a) => a.assigned_to === userId)` | **REDUNDANT_DEFENSIVE** | none |
| 7 | `tasks/figma-tasks.tsx:120` | care_tasks | `effectiveScope === 'mine' ? tasks.filter(isMine) : tasks` | INTENTIONAL | «مهامي / كل المهام» pills, `:252-277` |
| 8 | `caregiver/hooks.ts:54` | care_tasks | `if (!userId \|\| task.assigned_to !== userId) return false;` | INTENTIONAL | none, correctly |

**Mechanism, not a separate finding:** `tasks/hooks.ts:77` —
`scopeToUserId ? all.filter((task) => task.assigned_to === scopeToUserId) : all`. This is
the filter that #5 operates; it has exactly one call site in `src/` (`figma-home.tsx:155`)
and defaults to no narrowing. Counting it separately double-counts one defect — and
invites two people to independently null the call site *and* delete the parameter.

**Out of scope, listed so nobody re-audits them:** `caregiver/week-api.ts:245`
(`.eq('responsible_user_id', caregiverUserId)`) and `:285`
(`.eq('completed_by', caregiverUserId)`). These are server-side `.eq` narrowings scoped to
a **subject the manager picks** from a roster (`week-summary.tsx:247`), never to
`session.user.id`. They are not viewer-identity narrowing at all. An earlier draft filed
them as INTENTIONAL, which would have sent a future auditor looking for an off-switch that
should not exist.

---

## 3. The six REDUNDANT_DEFENSIVE hits, in detail

### #1 `family_visits` — `figma-visits.tsx:92`

**Fix:** delete the `scopeToMine` branch and render `all`; or, if personal scope is wanted,
add the sanctioned «مهامي / كل …» pill pair copied from `figma-tasks.tsx:252-277`.

**Risk:** a family member's visits list jumps from 2 rows to 7, including visits recorded
by other members and by non-members (`visitor_name` is free text and may name someone with
no account). Nothing becomes editable — write gating is separate (`visit-editor.tsx:81`).
See §4 for the intent question, which must be answered before this is touched.

### #2 `care_appointments` — `figma-appointments.tsx:76`

Same `scopeToMine = !canManage && canCollaborate` shape. The only control on the screen is
`FigmaSegmentedTabs` at `:97`, and both of its options are **statuses**, not scopes.

The live QA marked appointments PASS — but that was measuring the *request*, which is
narrowed by status only. The post-fetch filter at `:76` is downstream of the response and
was not exercised by that check. **This surface is not verified in the UI**; D1 widened it
5 → 12 server-side and this line decides how much of the 12 renders.

**Fix:** as #1. **Risk:** the upcoming list gains manager-created appointments with no
assignee, which is the A1 intent, but nothing on screen says whose appointments these are.

### #3 `medication_logs` — `figma-medications.tsx:79`

`scopeToMine = !canManage && canLog` (`:77`). The today|all tab at `:163` switches between
today's doses and the **medications** list — it is not a scope control.

**Risk, and it is the serious one:** widening this is now *safe where it was not before* —
D1 widened `medication_logs` SELECT for `family_member`, so an unscoped dose list would
render real statuses rather than fabricated «لم تُسجَّل». It stays **unsafe for
`caregiver`**, whose dose-log reads are still responsibility-scoped: for her an unscoped
list would show another member's administered dose as unlogged, which `today.ts:109-115`
names by name as a double-dose risk. Any fix here must keep the caregiver narrow.

### #4–#6 Home — `figma-home.tsx:139`, `:155`, `:159`

All three are driven by one line, `:132`:

```js
const scopeToMine = !circle.canManage && circle.canLogDoses;
```

A plain `const` derived from the role. There is no pill, tab, switch or sheet anywhere on
Home that can flip it. **These are one product decision and must be ruled on together** —
fixing one leaves Home internally inconsistent (e.g. a circle-wide task tile above a
personal dose strip).

**Risk:** every Home number rises for a family member, and none of the tiles says *whose*
count it is. The «مستحقّة اليوم» sub-label reads as personal. If these are widened, the
mitigation is copy, not re-filtering.

---

## 4. `family_visits` — is that screen intended to be personal or circle scope?

**Ibrahim decides. My belief, with the evidence, is that it is intended to be
CIRCLE-scope, and that the filter — not the title — is the defect.**

The evidence is unusually direct:

1. **The design spec describes a card variant that personal scope makes impossible.**
   `docs/design/SCREENS.md:26` (frame 8f) specifies visitor cards with
   *«زيارتك» home-icon meta **or** «مرتبطة بـ سارة» link meta*. A screen that only ever
   shows your own visits has no use for a "linked to Sarah" variant. The design assumes
   other people's visits are on screen.

2. **The code implements that variant, and line 92 makes it unreachable.**
   `figma-visits.tsx:146-150` computes `linkedName` only when
   `visit.visitor_user_id && visit.visitor_user_id !== userId`. After the `:92` filter that
   condition can never hold for a scoped role. So `visits.linkedToLabel` («مرتبطة بـ»,
   `ar.json:950`) and its render branch at `:224` are **dead code for exactly the role they
   were written for.** Dead code of that shape is strong evidence the filter was added
   later and not designed alongside the card.

3. **The copy frames the collective, not the individual.** Title «الزيارات العائلية»
   (`ar.json:922`), subtitle «نظّم زيارات العائلة» — organise *the family's* visits.

4. **The tabs are temporal, not personal** — القادمة / السابقة (`ar.json:1632-1635`).
   There is no scope vocabulary anywhere on the screen, unlike Tasks.

5. **A1 says visits are circle-visible**, and D1 was applied specifically to make that true
   on the server.

**If Ibrahim instead rules it personal-scope**, then the defect is the promise the title
makes, and the fix is copy/UX — rename toward «زياراتي», or add the mine/all pill so the
personal default is visible and reversible. In that case `linkedName` and
`visits.linkedToLabel` should be deleted as genuinely unreachable rather than left as a
trap.

---

## 5. Three row-dropping constraints that are not identity-shaped but bind the same way

Not REDUNDANT_DEFENSIVE by the brief's taxonomy — no identity comparison — but they produce
the same outcome: the server returns a row and the UI can never show it.

**A. `medications/today.ts:153-154`** (same guard at `:69-70`)

```js
const medication = medicationById.get(log.medication_id);
if (!medication) continue;
```

`medicationById` is built only from `useActiveMedications`, whose query is
`.eq('is_active', true)` (`medications/api.ts:62-68`). So a D1-widened `medication_logs`
row whose medication is **inactive** is silently dropped from *every* dose surface — Home
tiles, beads, list, and the medications «اليوم» tab alike. This is the join-level binding
constraint for `medication_logs`, and **it survives fixing #3 and #4.** Note `medications`
SELECT was not touched by D1.

**B. `appointments/figma-appointments.tsx:80-82`**

```js
const filtered = visible.filter((a) =>
  tab === 'upcoming' ? a.status === 'scheduled' : a.status === 'completed',
);
```

with `// Cancelled appointments are intentionally hidden` at `:79`. Combined with
`fetchUpcomingAppointments`'s `.gte('starts_at', startOfTodayInstant())`
(`appointments/api.ts:41`), a **past appointment still in `scheduled`** — nobody recorded an
outcome — is reachable on neither tab. Cancelled ones are hidden deliberately; this class is
not.

**C. Dead but dangerous:** `visits/hooks.ts:47` `useTodayVisitSummary` and
`appointments/hooks.ts:72` `useTodayAppointmentSummary` both compute circle-wide counts with
**no** identity filter and have **zero call sites** in `src/`. They are correct-by-omission
today. Named here so nobody "fixes" them into agreement with `figma-home.tsx`.

---

## 6. Cleared — checked and clean

So these are not re-audited later: the Care Pulse feed (`pulse/api.ts:18-25`, the
`list_care_activity` RPC, member-gated server-side, no client filter); claiming
(`figma-available-to-claim.tsx:81` filters by `item_type` only); `care-activity/today.ts:26-58`
(`summarizeTodayTasks` / `countAppointmentsToday` / `countVisitsToday` contain no identity
predicate); `notifications/*` (narrows `notifications.user_id` — a different table);
`explore.tsx` (navigation index, no counts).

Also cleared: every identity comparison that gates a **write affordance or a label** rather
than row visibility — `task-editor.tsx:381-382,446`, `appointment-editor.tsx:101-102`,
`visit-editor.tsx:81,85`, `figma-tasks.tsx:135,302-308`, `figma-visits.tsx:145-150`,
`figma-medications.tsx:227`, `figma-home.tsx:532`, `vital-editor.tsx:64`,
`figma-vitals.tsx:142`, `figma-daily-logs.tsx:137`, `log-editor.tsx:63`.

**One correction to a safety argument that appears in several places:** it is *not* true
that a hired caregiver can never reach the family screens. `app/(app)/_layout.tsx:35`
bounces her only when `segments[1] === '(tabs)'` — deliberately, per the comment at `:28-33`
— so `/tasks`, `/visits` and `/appointments` remain registered stack routes (`:66-68`)
reachable by deep link. She has no tab entry point, so this is not a live gap, but
"caregiver can't get there" must not be used as the reason a filter is safe to remove.

---

## 7. Sequencing, if fixes are authorised later

1. **Decide §4 first.** Everything about `family_visits` depends on it.
2. **Rule on the Home triple (#4–#6) as one decision**, not three.
3. **`tasks/hooks.ts:77`: change the call site OR delete the parameter — never both in one
   change.** Do the call site first so the behaviour change is isolated and revertable.
4. **Keep `caregiver` narrow in every fix**, especially #3.
5. Constraint **A** should be fixed with, not after, #3/#4 — otherwise the dose surfaces
   still drop rows and the fix will look like it failed.

---

## 8. Task D — the 36 vs 34 count delta

**Answer: the two rows are almost certainly `cancelled` tasks, and they are on screen.**

`figma-tasks.tsx:123-125` renders the «مكتملة» tab as `visible.filter((task) => task.status !== 'open')`
— **not** `=== 'completed'`. So that tab shows completed **and** cancelled rows.
`care_task_status` is exactly `"open" | "completed" | "cancelled"` (`src/types/supabase.ts:1871`,
runtime array `:2082`) — there is no archived or soft-deleted state.

`status === 'open'` and `status !== 'open'` are exact complements, so «مفتوحة» ∪ «مكتملة»
must render 100% of the query result; nothing in that file can drop a row. Cancelled rows
are visually distinct — dimmed to 60% opacity (`:545`, `rowDim` at `:675`), an errorFg X
instead of a check (`:533-536`), and a «ملغاة» pill (`STATUS_PILL` `:480`) — so a count of
"completed" naturally excludes them while the tab still shows them.

**20 open + 14 completed + 2 cancelled = 36. Exact.**

Alternatives ruled out from evidence:

- **A second circle** — ruled out. The probe counts `select count(*) from public.care_tasks`
  with no circle filter, so a second circle *would* inflate it. But every row of
  `d1-after-read.csv` carries circle ordinal `1`: there is exactly one circle with active
  members in the database. (This one could not be ruled out from source alone; it needed the
  probe CSV.)
- **A date-window cutoff** — ruled out. The «مكتملة» arm sorts but does not filter by date;
  the only date predicate is on «اليوم» (`:128`), a strict subset of «مفتوحة».
- **A status outside the tabs** — ruled out by the enum.

**Not verified:** that exactly 2 rows carry `status = 'cancelled'`. Confirming it needs
either a query (out of scope for this batch — no Supabase access permitted) or a re-bucket of
the QA's own intercepted response body by `status`, which the capture already contains.

---

## 9. Task B — stale comment sweep, every file edited

| file:line | was | now |
|---|---|---|
| `src/features/tasks/api.ts:34` | "(RLS: active members)" | full post-D1 policy, and why `caregiver` is the one narrow role |
| `src/features/tasks/hooks.ts:65-66` | "RLS still returns the full circle set" | true since D1 for four roles; the filter is now load-bearing rather than a no-op; caregiver excepted |
| `src/features/tasks/figma-tasks.tsx:95-98` | "everyone SEES the whole circle's tasks" | true on the server since D1; records that it was a silent no-op before, and that caregiver still sees both pills identical |
| `src/features/caregiver/week-api.ts:224-226` | "a viewer without `can_view_all_operational`…" | the set is now just `caregiver`; the manager gate's **reason** changed while the gate did not — keep it, don't re-derive it from RLS reachability |
| `docs/deployment/milestone-8-role-probe-read.sql:12-20` | "a `family_member` whose `can_view_all_operational` is FALSE" | reworded, with a historical note. **Header comment only — no SQL touched, so the output shape and every historical CSV comparison are unaffected.** |

**Deliberately NOT edited — applied migrations, per the standing rule against editing them
in place.** All three now describe the pre-D1 array as current and are landmines for the next
reader:

- `supabase/migrations/20260726160000_caregiver_least_privilege_rls.sql:30` — "`can_view_all_operational()` deliberately does NOT include it (admin / primary_caregiver / remote_member only)"
- `supabase/migrations/20260726160100_caregiver_rpc_scope.sql:11` — "a `family_member` whose `can_view_all_operational()` is FALSE"
- `supabase/migrations/20260726130000_dose_proof_helpers.sql:16` — the same argument, restated

The D1 migration's own header and the A1 block in `CLAUDE.md` both carry the correction, which
is where a reader arrives from.

**Checked and NOT stale:** `src/features/circle-members/role-capabilities.ts:91` — "a remote
member can view every operational row (`can_view_all_operational` includes them) but can write
nothing" is still exactly true post-D1. `scripts/analyze-function-grants.js:40` mentions the
function only in a list of grant-keeping helpers; unaffected.

---

## 10. Task E — hygiene

| check | exit | result |
|---|---|---|
| `npx tsc --noEmit` | **0** | 0 errors |
| `node scripts/check-mojibake.js` | **0** | 280 files scanned, no strong signatures |
| `git -c core.autocrlf=false diff --check` | **0** | clean |
| ar/en parity + `check:i18n` | **0** | exact parity, 1251 leaf keys, 7 plural families |
| `node scripts/check-execute-grants.js` | **0** | 36 allowed / 31 denied / 67 functions, no drift |
| `check:confirms` | **N/A** | **script absent on this branch** — added on `qa-fixes-tier2`, not merged here |
| `grep -rnE "style=\{\(\{\s*pressed" src/` | 0 | **only** `src/components/app-tabs.web.tsx:42` ✅ |

Parity is 1251 here, not the 1256 reported earlier; the extra 5 keys live on `qa-fixes-tier2`,
which is not merged into this branch.

---

## 11. Branch divergence — read this before merging

`qa-fixes-tier2` is **not** merged into `f1-rls-widen`, so the two branches hold different
versions of the same comments and of the A1 block. On merge:

- **`CLAUDE.md` A1 will conflict.** `qa-fixes-tier2` carries a "Correction (2026-08-07)"
  block written when D1 was still *pending*. **This branch's version wins** — it records D1 as
  applied, with the five surfaces, the predicate-only dose-proof caveat, and the
  server-passes-UI-fails lesson.
- **`tasks/api.ts`, `tasks/hooks.ts`, `figma-tasks.tsx` will conflict.** `qa-fixes-tier2`
  describes the narrow posture as current and D1 as pending; this branch's post-D1 wording
  supersedes it. The tier2 behavioural changes in those files (`canClaim` prop, hitSlop,
  `due_date <= today`, default scope, `emptyKeyFor`) are unrelated to the comments and must be
  kept.
- `caregiver/week-api.ts` and `milestone-8-role-probe-read.sql` are edited only here.
