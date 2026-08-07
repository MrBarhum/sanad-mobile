# QA verification pass — 15 findings from the manual web QA, confirmed or refuted

**Branch:** `qa-verification` (worktree), based on `master` @ `414a4d8`
**Date:** 2026-08-07
**Status:** **VERIFICATION ONLY — no behaviour changed, no file under `src/` or `supabase/` touched.**

The manual pass was run against the Expo **web** build (localhost:8081) as three roles:
admin, نورة (`family_member`, sanad.qa.family2), خالد (`remote_member`, sanad.qa.remote1).
This document answers each finding against the code and the migration tree.

## Method, and what it cannot settle

Every verdict below is traced to a line of source. Fifteen findings were investigated
independently, then the four highest-stakes verdicts (F1, F2, F3, F15) were handed to
adversarial verifiers whose brief was to **refute** them, defaulting to "refuted" under
uncertainty. F1 got three independent lenses because it was the finding you most wanted
attacked. None of the six refutation passes overturned a verdict; several corrected the
severity, the blast radius, or the proposed fix — those corrections are folded in below
and are flagged where they materially change the recommendation.

Two limits worth stating plainly:

- **No live database access.** The Supabase MCP server is installed but unauthenticated,
  so every server claim here is derived from `supabase/migrations/*.sql` plus
  `docs/deployment/*.sql`. This matters most for F1: `20260626161000`'s own header
  (`:3-6`) records that the Phase 2D SQL was applied **by hand** and backfilled into the
  repo afterwards, so the file is a transcription rather than the applied artifact. Four
  independent in-repo restatements assert the narrow policy is live
  (`20260726160000:30-37`, `20260726160100:11`,
  `docs/deployment/milestone-8-role-probe-read.sql:17`,
  `docs/deployment/dose-proof-storage.sql:63-65`), and your own نورة-vs-خالد A/B is the
  empirical confirmation. F1 is settled by *migrations + your device A/B*, not by the
  migration text alone. If you want it closed against the live catalog, that is a
  read-only `pg_policies` query and I can prepare it for approval.
- **The QA accounts' roles are not recorded anywhere in the repo.** Nothing distinguishes
  whether نورة is `family_member` or `caregiver`. It does not change F1's symptom (both
  roles are outside `can_view_all_operational`, and both get `canCollaborate === true`),
  but it does change whether `/available-to-claim` is a working escape hatch for her —
  that RPC admits `family_member` and refuses `caregiver`.

---

## Verdict table

| # | Finding | Verdict | Severity | Your diagnosis |
|---|---|---|---|---|
| **F1** | «كل المهام» hides tasks from a family_member | **CONFIRMED** | **high** | Symptom right, **mechanism wrong** — it is RLS, not the client |
| **F2** | «اليوم» hides overdue tasks | **CONFIRMED** | med-high | Mechanism exactly right; wrong string quoted for the default path |
| **F3** | Nested Pressables in `figma-tasks.tsx` | **SPLIT** — see below | med | Console error **WEB-ONLY**; double-fire **REFUTED**; two real Android defects underneath |
| **F4** | Dose bead strip truncates at 5 | **REFUTED** | low | Intentional, documented, and the true total is on screen |
| **F5** | «٥٠ أعضاء» for 5 members | **REFUTED** | none | All four candidate mechanisms ruled out |
| **F6** | «20 جرعات» wrong Arabic | **CONFIRMED** | low | Both halves of the diagnosis wrong — it is not a plural key at all |
| **F7** | Legend omits «مقدّم الرعاية الأساسي» | **CONFIRMED** | med | Right; the `caregiver` half of the guess is refuted |
| **F8** | Inactive member row inverted | **REFUTED** | none | Structurally impossible; «غزال» is almost certainly «مُزال» |
| **F9** | Created task lands on an empty screen | **CONFIRMED** | med | Symptom right; "the view resets" and "Tasks has no toast" both refuted |
| **F10** | Circles list empty during refetch | **CONFIRMED** | low | Refetch theory **refuted**; it is a cold-load gap, and the web repro cannot occur on Android |
| **F11** | Explore blank with no loading state | **WEB-ONLY** | none | Both halves refuted — Explore has no loading branch at all |
| **F12** | Invitations permission-denied has no header | **CONFIRMED** | low | Accurate; also affects `/circle-members/invite` |
| **F13** | «مثال:» prefix app-wide | **CONFIRMED** | low | Right, and under-counted — 15 keys, not 5 |
| **F14** | Date input renders `dd-----yyyy` | **WEB-ONLY** | low | Your diagnosis is correct |
| **F15** | Dose-count scoping inconsistent | **CONFIRMED** | low-med | Symptom right; it is a **client filter**, not RLS |
| — | Confirmations freeze the web renderer | **Not a product bug** | none | Your judgement is correct |

Four of your fifteen do not survive as reported (F4, F5, F8, F11), and two more (F14 and
the confirm freeze) are web artifacts you had already called correctly. Of the nine that
stand, **five had the wrong root cause attached** — which matters, because in three of
those cases fixing what you diagnosed would not have fixed what you saw.

Verification also surfaced **three defects that were not in your list**, one of which is a
hard crash path. They are in "New defects found during verification" at the foot.

---

## 🔴 F1 — «كل المهام» does not show all tasks to a family_member

**Verdict: CONFIRMED (high).** Three independent refutation passes — one attacking the RLS
chain, one attacking the client path, one attacking the downstream consequences — all
failed to break it. But **your stated hypothesis is wrong**, and this is the case where
that distinction is most expensive.

### Your hypothesis is refuted

> "Is the scope pill actually bound to the query, or is a responsibility filter applied
> unconditionally for non-managers?"

Neither. The scope pill **is** correctly bound, and there is **no** client-side
responsibility filter:

- `src/features/tasks/api.ts:35-44` — `fetchTasks` is a bare
  `.from('care_tasks').select('*').eq('circle_id', circleId)`. No role argument, no
  `assigned_to` predicate, no `.or()`, no view, no RPC.
- `src/features/tasks/hooks.ts:41-47` — `useTasks` passes it straight through. No `select`
  transform.
- `src/features/tasks/figma-tasks.tsx:111` —
  `const visible = effectiveScope === 'mine' ? tasks.filter(isMine) : tasks`. In the
  `'all'` branch there is **literally no filter** — `visible === tasks`.
- `:101-102` — `useState<TaskScope>('mine')` and
  `effectiveScope = canBeAssigned ? scope : 'all'`; `:249` `onPress={() => setScope(key)}`.
  Nothing pins it; the only `useEffect` in the file (`:439-441`) is inside the confirm
  sheet and cannot touch `scope`.

Because the `'all'` branch applies no filter at all, the only way both pills can render
the same rows is if `tasks` **already contained nothing but her own rows**. The server
explanation is therefore not one candidate among several — it is *necessary*.

### The actual root cause

`supabase/migrations/20260626161000_backfill_phase_2d_responsibility_rls.sql:24-32`:

```sql
create or replace function public.can_view_all_operational(p_circle_id uuid)
...
  select public.has_circle_role(
    p_circle_id,
    array['admin','primary_caregiver','remote_member']::public.circle_role[]);
```

`family_member` is not in that array. And `:55-68`:

```sql
create policy "Members can view care tasks" on public.care_tasks for select to authenticated
using (
  public.can_view_all_operational(circle_id)
  or (public.is_circle_member(circle_id)
      and (assigned_to = (select auth.uid()) or completed_by = (select auth.uid())))
);
```

This is the **final effective** policy, not the first one found. Every migration that names
`care_tasks` was checked in timestamp order: policy statements appear in only three files
(`20260610090000:205-279`, `20260610110000:106-118` — INSERT/UPDATE only, and
`20260626161000:54`/`:73`). The only SELECT policy is `"Members can view care tasks"`,
created at `20260610090000:205` and replaced once at `20260626161000:54`. Nothing later
touches it — `20260726160000` adds nine RESTRICTIVE policies and **none is on
`care_tasks`**; `20260726160100` replaces function bodies only; `20260729120000` moves
EXECUTE grants only. `can_view_all_operational` is defined exactly once and never
redefined. Since PostgreSQL ORs permissive policies, a second permissive SELECT would
relax this — there is none.

The client predicate at `figma-tasks.tsx:105-109` (`assigned_to === userId ||
completed_by === userId`) is **character-for-character** the RLS disjunct at
`20260626161000:64-65`. Filtering a set by a predicate every element already satisfies is
the identity function. Hence "byte-identical", exactly as you observed.

*(One unstated precondition: `isMine` returns `false` when `userId` is null, so during a
brief window before `useAuth()` resolves the two pills would differ. Transient only.)*

### Why خالد sees everything and نورة does not — reproduced from source

`src/features/circle-selection/permissions.ts:4-6` `canManageCircle` = admin |
primary_caregiver; `:9-16` `canLogDoses` = admin | primary_caregiver | family_member |
caregiver. `remote_member` is in **neither**. `src/app/(app)/tasks/index.tsx:11-12` passes
these as `canManage` / `canCollaborate`.

- **خالد (remote_member):** `canBeAssigned` is false (`figma-tasks.tsx:99`), so
  `effectiveScope` is forced to `'all'` (`:102`) and the pill row is **not rendered at all**
  (`:243`) — while RLS hands him the whole circle, because `remote_member` *is* inside
  `can_view_all_operational`.
- **نورة (family_member):** `canBeAssigned` is true, so the pills render — and RLS hands
  her only her own rows.

That distinction is what rules out the alternative hypothesis: you saw *two pills that do
nothing*, not *missing pills*. Only this explanation predicts that.

### The claim affordance is dead — and worse than you described

`:100` `canClaim = canManage || canCollaborate`; `:294` `unassigned = task.assigned_to === null`;
`:506` `showClaim = canClaim && unassigned && task.status === 'open'`.

A row with `assigned_to IS NULL` can never satisfy `assigned_to = auth.uid()`, and
`completed_by` is NULL on an open task — so unassigned tasks are invisible to
family_member **and** caregiver. Of the three roles that *can* see them, `remote_member`
has `canClaim === false`. The two conditions are **mutually exclusive by role**: the
«أنا متكفّل» pill at `:578-595` renders only for admin and primary_caregiver — the two
roles that could simply assign the task instead. It is unreachable by every role it was
built for.

`/available-to-claim` still works because `list_available_to_claim` is
`STABLE SECURITY DEFINER` (`20260726160100:324-329`), which runs as the owner
(`rolbypassrls`) and bypasses RLS entirely. Its in-body gate (`:341`) is
`if v_role not in ('admin','primary_caregiver','family_member')` — family_member passes —
and `:350-351` reads `care_tasks … assigned_to is null` with no row restriction. The claim
*write* (`claim_care_task`, `:80-84`, `:106`) is likewise SECURITY DEFINER, which is how
she can claim a row she cannot `SELECT`. **Caveat:** if نورة is actually a `caregiver`,
`:341` refuses her with 42501 and this escape hatch does not exist for her either.

The repo's own deployment SQL treats this as settled fact —
`docs/deployment/dose-proof-storage.sql:63-65`: *"a plain-membership check here would let
**a family_member who cannot see the ROW** still fetch a signed URL for its PHOTO."*

### This contradicts a standing law, in four places

CLAUDE.md A1 asserts: *"Every active member may see all of a circle's operational data …
this mirrors the server `can_view_all_operational` posture. The UI never hides other
members' work from a non-manager."* Both halves are false as shipped — A1 does not mirror
that function, it inverts it. Three in-code comments repeat the same false claim:

- `figma-tasks.tsx:95-96` — "everyone SEES the whole circle's tasks"
- `tasks/hooks.ts:65-66` — "RLS still returns the full circle set"
- `tasks/api.ts:34` — "(RLS: active members)"

**However** — and one refuter was right to push on this — the narrow array was **deliberate
at authoring time**. `20260626161000:20-23` says so: *"'Sees every operational row' =
managers + (for now) remote read-only. SINGLE SWITCH POINT for the remote decision."* So
the defect is properly stated as: **the UI ships a scope control and a claim affordance
that the server contract cannot satisfy, and four documents assert a posture that was
never implemented.** Whether to widen RLS is a product decision for you, not a bug fix.

### Real-world impact on Android

A family_member sees two prominent pills, taps «كل المهام», and nothing changes — the
control silently lies. She cannot see that a sibling already took a task, so duplicated or
dropped work is invisible to her. **No data is leaked** — this is over-restriction, not
over-exposure, and any fix moves in the *permissive* direction, which deserves an explicit
security sign-off rather than a routine patch.

### Smallest correct fix — and the blast radius is 5×, not 1×

**Layer 1 (no risk, do this regardless):** correct the three false comments and reconcile
CLAUDE.md A1 with the actual role array. This is the unambiguous part.

**Layer 2 (product decision, backend):** if A1 is to remain law, a **new** migration
(never edit the applied `20260626161000`; per CLAUDE.md it ships as a runbook step you
hand-run) re-creating `can_view_all_operational` with `'family_member'` added.

> **The fix is not care_tasks-scoped.** `can_view_all_operational` is the first disjunct of
> **five** read surfaces:
> `care_tasks` (`20260626161000:60`), `care_appointments` (`:94`), `medication_logs`
> (`:156`), `family_visits` (`:170`) — **and** the dose-proof storage read policy at
> `docs/deployment/dose-proof-storage.sql:74`, which lives **outside** the migrations tree
> and is invisible to a migrations-only scan (`20260729120000:60-65` warns about exactly
> this).
>
> Adding `'family_member'` therefore also grants every family_member the circle's full dose-log
> history, every appointment, every family visit, **and signed-URL read on every dose-proof
> photo**. That may well be what A1 intends — but it must be a stated decision in the
> runbook step with a before/after read matrix
> (`docs/deployment/milestone-8-role-probe-read.sql`), not a side effect. Unflagged, four
> extra tables moving reads as a failed acceptance check.
>
> **Add only `'family_member'`. Never `'caregiver'`.** `care_tasks` and `medication_logs`
> are the two tables with *no* restrictive M8 backstop (`20260726160000` covers
> circle_members, medications, medication_schedules, daily_care_logs, vital_readings,
> family_visits and care_appointments — and nothing else), so `can_view_all_operational`
> is the only thing holding them narrow for the hired caregiver.

Three client screens then need a scope control they do not have, because they apply an
unconditional mine-only filter with no toggle: `figma-appointments.tsx:74`,
`figma-visits.tsx:89`, `figma-medications.tsx:77`. Without that, the migration would widen
the wire while changing nothing user-visible on those three screens.

**If instead you decide A1 was wrong** and the narrow posture is intended, the client fix
is smaller: hide the scope pills for roles outside `can_view_all_operational`
(`figma-tasks.tsx:243`) and drop the unreachable claim pill (`:506`).

---

## 🟠 F2 — «اليوم» hides overdue tasks and reassures the user

**Verdict: CONFIRMED (medium-high).** Your mechanism is exactly right.

`figma-tasks.tsx:118-119` — `tab === 'today' ? openTasks.filter((task) => task.due_date === today)`.
Strict `===`, as you suspected. The data is genuinely present client-side and discarded
here: `fetchTasks` applies no date predicate and no `.limit()`, so this is not a query
artifact. Two refinements you did not mention:

- It also silently drops **undated** open tasks (`due_date === null`), which is the larger
  class in practice.
- The A7 overdue-first sort is **dead code** under this tab: `compareOpenTasks:48-49` keys
  overdue off `due_date < today`, and every survivor of the «اليوم» filter satisfies
  `due_date === today`.

**One correction to your account.** You quoted «لا مهام الآن — كل شيء على ما يُرام». That
string is real (`ar.json:1584`) — but it is **not** what the default path renders.
`figma-tasks.tsx:284-285` branches on `effectiveScope` only, never on `tab`, and
`:101` defaults **everyone including managers** to `'mine'`. So the default resolves
`figma.tasks.emptyMine` → «لا مهام مُسندة إليك حالياً» (`ar.json:1585`). The
«كل شيء على ما يُرام» string is reached only via the «كل المهام» pill, or by a pure
follower forced to `'all'`.

The defect survives intact — "no tasks assigned to you right now" is equally an
affirmatively false statement when the user has overdue assigned tasks, and `TasksEmpty`
renders the success-green `Check` circle (`:617-618`) either way.

**Why you probably mis-stated it, and it is worth fixing separately:** CLAUDE.md says the
toggle defaults *"collaborators to 'mine' and managers to 'all'"*. The code defaults
everyone to `'mine'` (`:101`), and the comment at `:96-98` documents that as deliberate —
but CLAUDE.md was never updated. You appear to have reasoned from the law rather than the
code. **Settle this before landing the fix**, because it determines which empty string the
fix must reword.

Is the copy defensible for a care app? No. It is not merely uninformative — it is an
affirmative false reassurance, which is not what the "an empty day is good news" copy law
was meant to license. Mitigations: the «مفتوحة» tab is one tap away and *does* sort
overdue-first; and the server does emit a `task_overdue` push
(`supabase/functions/enqueue-due-reminders/index.ts:270-286`) whose deep link opens the
task **detail**, so "nothing tells the user" is slightly too strong.

**Smallest fix — two independent changes, both local to `figma-tasks.tsx`:**

1. Widen line 119 to `task.due_date !== null && task.due_date <= today`, matching the
   already-blessed rule at `src/features/caregiver/hooks.ts:57` ("Today's, anything already
   overdue, and undated work she still owns"). Two different definitions of "today" ship in
   one app today. This also makes the overdue-first sort live.
2. Make the empty state tab-aware — add `figma.tasks.emptyToday` / `emptyTodayMine` (ar +
   en at exact parity) so the «اليوم» empty does not assert an all-clear. Pass `tab` into
   the branch at `:285`.

**Blast radius:** one expression + 2 key pairs. Do **not** change
`care-activity/today.ts:34` in the same edit — `dueToday` is labelled «مستحقّة اليوم» and
is literally correct; Home and Tasks currently agree, and widening only the tab will make
the Home tile legitimately show a smaller number than the list's row count. Also consider
whether `TasksEmpty`'s success-green check should stay for a non-reassuring empty.

---

## 🟠 F3 — Nested Pressables in `figma-tasks.tsx`

**Verdict: SPLIT.** Your hypothesis was the thing most worth testing here, and testing it
changed the answer. Verified against the actually-installed **React Native 0.85.3**
(`package.json:37`), reading the responder source directly.

### The reported symptom is WEB-ONLY

`validateDOMNesting` fires because `accessibilityRole="button"` maps to a real `<button>`
element on RNW (`propsToAccessibilityComponent.js:15`). On Android there is no DOM; that
error class cannot occur. Developer-visible noise only. *(There are three inner Pressables,
not two: checkbox `:538`, claim pill `:579`, × square `:599`.)*

### Your native hypothesis is REFUTED — both halves

> "a tap on the inner «×» or the completion circle may ALSO fire the row's `onPress`"

**It cannot.** `Pressability.js:448-450` registers only the **bubbling**
`onStartShouldSetResponder`; `ReactFabric-dev.js:992-996` builds the dispatch path
target→root and dispatches captured root→target then bubbled target→root, so with
bubble-only listeners the **deepest** Pressable is evaluated first; `:16400-16416` breaks
on the first listener returning true. The row's handler is never invoked. RN grants the
responder to exactly one view.

> "button-inside-button confuses screen readers"

True as a concern, **but not by the mechanism you implied for Android.** RN does not prune
the subtree there: `ReactViewManager.kt:98-101` sets only `isFocusable`, and
`ReactViewGroup.kt`'s pruning branches are gated on an `accessibility_order_parent` tag
that nothing in this codebase sets, so control falls through to the platform default. The
inner controls **stay reachable**; the row becomes a *redundant extra focus stop*, not a
wall. The pruning you feared is the **iOS** behaviour (`RCTViewComponentView.mm:350`) — so
if iOS ever ships, this escalates to "VoiceOver cannot reach the checkbox, claim, or ×
at all."

### What is actually wrong on Android — three real defects underneath

**F3a — undersized touch targets inside a pressable row (CONFIRMED, medium).** The
checkbox is 28dp (`styles:667-676`) and the × square 34dp (`:707-716`), with **no
`hitSlop`**, against `TouchTarget.min = 48` (`theme.ts:332-335`). Because they sit inside a
row that is itself a button, a near-miss does not fail harmlessly — **it navigates away to
the task detail.** For an older user with imprecise touch that is the difference between
"nothing happened" and "the screen changed under me". The sibling screen
`src/features/caregiver/today.tsx` sizes the same two controls at **48** (`:499`) and
**44** (`:509`). This defect is independent of the nesting and carries the medium severity.

**F3b — disabled-claim fall-through (CONFIRMED, low, native-only).** `!true ?? true` is
`false`, and `Pressable.js:249-252` never derives `pointerEvents`/`focusable:false` from
`disabled` — so the disabled claim pill still *receives* the touch, merely declines the
responder, and it bubbles to the row, which fires `onOpen`. Tapping «أنا متكفّل» while its
spinner shows navigates to the task detail mid-claim. This is the **inverse** of the
double-fire you predicted, and it is the only fall-through that exists.

**F3c — no press feedback at all (NEW, not in your list).** None of the four Pressables in
`TaskRow` (`:532`, `:538`, `:579`, `:599`) sets `android_ripple`. Under this project's own
standing NativeWind law, `android_ripple` is the *only* sanctioned press feedback — and the
sibling `today.tsx` uses it at `:377` and `:413`. So all four controls are inert to the
touch on Android. Web gives them `:hover`/`:active`, which is why the web QA could not
have seen it.

### Smallest correct fix

Two one-liners, not a restructure:

1. **Delete `disabled={claiming}` at `:581`.** `onClaim` already guards re-entry at `:130`
   (`if (claimingId) return;`). With `disabled` gone the inner Pressable always wins the
   responder and the touch can never reach the row. Closes F3b with no restructuring.
2. **Add `hitSlop` to `:538`, `:579`, `:599`** to reach the 48dp floor, and
   **`android_ripple`** to all four.

> An earlier draft of this fix proposed demoting the row to a plain `View` and moving
> `onPress` onto the text column only — mirroring `today.tsx`. **That is the wrong shape.**
> `today.tsx:365-369` is a plain View with no row-level press and *no detail navigation at
> all*, so it proves the 48/44 sizes are house standard but not that "row-opens-detail +
> inner buttons" can be built that way. Shrinking the open target from the whole row to the
> text column is an unacknowledged UX regression on the primary action of the screen —
> worse for exactly the population the finding protects.

### The app-wide sweep

The same pressable-inside-pressable pattern appears in **10 places**, reproduced
independently with a JSX tag-depth scanner over all `src/**/*.tsx`. Most are the sanctioned
bottom-sheet idiom (scrim Pressable + tap-swallowing inner Pressable) — `picker-sheet.tsx:59`,
`figma-bottom-sheet.tsx:41`, `figma-tasks.tsx:347/352` — and should be left alone. Worth
queuing separately: those swallow-wrappers default to `accessible={true}` and add phantom
focusable no-op nodes on Android.

**The NativeWind guard is clean.** `grep -rnE "style=\{\(\{\s*pressed" src/` returns exactly
one hit — `app-tabs.web.tsx:42`, the sanctioned web-only exception. The law is not
regressed.

---

## 🟠 F4 — Dose bead strip truncates at 5

**Verdict: REFUTED (low).** Both parts of the framing are wrong.

**It is not a truncation bug — it is a documented contract.** The cap is at
`src/features/care-circle/figma-home.tsx:252`, `visibleDoses.slice(0, 5)`, with the comment
"up to 5 cells". `src/components/dose-bead-strip.tsx:35` declares the prop as *"The visible
doses (caller slices to ≤5 in scheduled order)"*. `docs/design/SCREENS.md:8` describes the
Home frame as a **"5-cell dose bead strip"**, and the M6 report spec line reads
"5× 40px r6 2px cells". It is a layout constraint: each bead is `flex: 1` in a row
(`dose-bead-strip.tsx:78-79`) with a 40px cell and a 14px LTR time label, so past ~5 columns
on a 360dp screen the label clips.

**Nothing is hidden.** The 46px/900 count tile immediately *above* the strip renders
`given/total` from the **full unsliced** set, and the **full 21-row dose list renders
uncapped** further down the same screen. So the medication-safety reading — "16 of 21 doses
silently hidden" — is false. Screen-reader users hear the true «0 من 21».

**The residual point that is real, and narrower than reported:** the strip has no overflow
affordance, and it takes the first five **chronologically** rather than attention-first — so
on a busy morning all five beads can read green while most of the day is unlogged. A user
who glances only at the bead row and ignores the much larger number directly above it could
misread the day. That is a legibility weakness, not a data defect.

If you want it addressed anyway, the cheapest correct change is confined to
`figma-home.tsx:252` plus one key pair: keep 4 beads and append a 5th `flex: 1` cell
rendering «+{{n}}», **or** switch the slice source from `visibleDoses` to `orderedDoses`
(already computed at `:144`) so the window shows what needs attention. Do **not** make the
strip wrap on Home — a 21-bead block would dominate the fold. The second option changes the
strip's meaning enough that `SCREENS.md:8` and the M6 visual-QA checklist would need
amending.

*Unrelated cosmetic bug found while tracing:* because `beadCol` is `flex: 1`, the final
partial row in `week-summary.tsx:456` stretches its beads — a 6-dose day draws one
full-width bead on row 2.

---

## 🟡 F5 — Member count renders «٥٠ أعضاء» for 5 active members

**Verdict: REFUTED (none).** The code cannot emit a doubled number, and I verified the call
site myself.

`src/features/circle-members/figma-members.tsx:148`:
`t('figma.members.summary', { name: summaryName, count: active.length })` — **one** value,
and the string has exactly **one** `{{count}}` placeholder. With `count = 5`, Arabic CLDR
selects `few` → `ar.json:1614` «دائرة رعاية {{name}} · {{count}} أعضاء» → «… · 5 أعضاء».

All four of your candidate mechanisms are ruled out:

- **(a) bidi reordering** — there is only one numeric run in the string; there is nothing to
  reorder against.
- **(b) two numbers colliding** — `active.length` is the only value passed.
- **(c) i18next doubling** — it is a plural set; exactly one member is ever selected.
- **(d) an RNW-vs-Android bidi difference** — both run the full UBA over the identical
  string with an RTL paragraph direction and the same first strong character.

**The decisive point:** you reported Arabic-Indic «٥٠», and the app has **no Arabic-Indic
output path at all**. `src/utils/digits.ts:38-57` only normalizes Arabic-Indic *input* to
ASCII, and a repo-wide grep for `Intl.NumberFormat` / `toLocaleString` / `numberingSystem`
returns zero hits in `src/`. Section 11j settled this explicitly
(`docs/claude-reports/2026-07-31-section-11.md:186-193`: *"decision: Western digits"*).

**Most likely explanation of what you saw:** the string places the «·» separator
immediately *before* the count, so under RTL the separator lands to the **right** of the
digit in visual order — and U+0660 ARABIC-INDIC ZERO is itself a dot glyph. A reader
scanning the digit region left-to-right sees `5` then a dot, which reads as «٥٠». That is a
hypothesis about the reading, not about the render; the render is provably «5 أعضاء».

**Recommend no change.** Swapping the «·» would fix the ambiguity but that separator is a
repo-wide convention CLAUDE.md sanctions as decorative chrome, including in this screen's
own `role · status · email` chain at `:197-208`.

---

## 🟡 F6 — «20 جرعات» is wrong Arabic

**Verdict: CONFIRMED (low)** — but **both halves of your diagnosis are wrong**, and the
distinction determines the fix.

You asked: *"Is the plural keyed off the wrong variable, or is the `many` category
missing?"* Neither. **`figma.medications.summary` is not a plural key at all.**
`src/locales/ar.json:1539` is a single flat string:

```json
"summary": "{{given}} من {{total}} جرعات أُعطيت اليوم"
```

Zero `_zero`/`_one`/`_two`/`_few`/`_many`/`_other` siblings. The broken plural «جرعات» is
**baked into the literal** and renders identically for total = 1, 2, 20 or 200. The sibling
`activeCount` on the very next lines (`:1540-1545`) *is* a proper six-form family, which is
exactly why «10 أدوية فعّالة» reads correctly.

**And adding plural suffixes alone would not fix it.** `figma-medications.tsx:152` passes
`{ given: String(given), total: String(total) }` — **no `count` key**, so i18next never
enters plural resolution regardless of what the JSON contains. (The resolver itself is
fine: `src/i18n/index.ts:1-22` polyfills `intl-pluralrules` before `init` precisely because
Hermes lacks `Intl.PluralRules`, and the comment documents that omitting it silently
collapses Arabic's six categories to two.)

**It was not "missed by H2".** H2 scoped itself to keys interpolating `{{count}}`, and its
regression guard `scripts/check-i18n-parity.js:355-366` only fires on keys whose token set
contains `count`. This key interpolates `{{given}}`/`{{total}}`, so it was **structurally
invisible** to both the audit and the guard — never covered, rather than covered-and-missed.

One more correction: «{{total}} جرعات» is grammatically **correct** for 3–10 (plural
genitive, «٥ جرعات»). It is wrong for 1, 2, and 11+. Your 20-dose screenshot happened to
land in the wrong band; a 3–10-dose day reads correctly, which is likely why it survived
earlier passes.

**Smallest fix (three files):**

1. `ar.json:1539` → a six-form family (`summary_zero/_one/_two/_few/_many/_other`), keeping
   `{{given}}` present in **every** form or check 8 of the parity script
   (`check-i18n-parity.js:372-398`) will fail on the dropped token.
2. `en.json:1527` → the matching `_one`/`_other` pair; the guard holds each locale to its
   own category set.
3. `figma-medications.tsx:152` → pass `count: total` as a **number**, not `String(total)`,
   or plural resolution is skipped.

`figma.members.summary` (`ar.json:1611-1616`) is the exact precedent to copy — it already
carries an extra non-count token across all six forms.

**Do the same to `careCircle.dashboard.today.loopA11y`** (`ar.json:130` + `figma-home.tsx:259`)
in the same change — it has the identical bug and is heard only by TalkBack users. And
delete the dead `loopDoses` (`ar.json:126`) rather than fixing it. Worth considering:
widen the parity guard to flag any key whose Arabic value places an interpolation
immediately before an Arabic noun — the current `{{count}}`-only census is what let this
through.

---

## 🟡 F7 — Roles legend omits «مقدّم الرعاية الأساسي»

**Verdict: CONFIRMED (medium).** Your first guess is right; your second is refuted.

`LEGEND` is a hardcoded three-entry constant (admin, family_member, remote_member) at
`figma-members.tsx:76-80`. `primary_caregiver` is a **fully assignable** role
(`role-capabilities.ts:36-42`, `permissions.ts:28`) whose rows render the label
«مقدّم الرعاية الأساسي» — with no legend line.

**Worse than a gap:** `roleVisual` collapses `primary_caregiver` onto the **same Crown** as
`admin`, so the only line a reader can map that Crown to is the «مشرف» line, whose body
claims «صلاحية كاملة — يدير الدائرة والأعضاء وكل بيانات الرعاية». That is **false** for a
primary caregiver. In a permissions-explaining surface that is a wrong answer, not just an
omission.

**Your `caregiver` guess is REFUTED.** `caregiver` *is* in the legend, presence-gated —
`figma-members.tsx:155-157`:

```js
const hasCaregiver = active.some(m => m.role === 'caregiver') || inactive.some(...);
const legend = hasCaregiver ? [...LEGEND, CAREGIVER_LEGEND] : LEGEND;
```

That gate is precisely the pattern that should have been applied to `primary_caregiver` and
was not.

**Smallest fix:** mirror the existing `hasCaregiver` pattern — build the legend from the
distinct roles actually present across `active` + `inactive`, ordered by the existing
privilege order, falling back to the current three. **Zero new i18n keys**:
`circleMembers.roles.primary_caregiver` and `circleMembers.roleDescriptions.primary_caregiver`
already exist in both locales, so parity is untouched.

**One decision to make alongside it:** with `roleVisual` unchanged (`:41-52`), the admin and
primary_caregiver legend rows would carry the *same Crown* — re-creating the same-mark
ambiguity that commit `791e722` set out to kill. Either give `primary_caregiver` its own
glyph (which also changes every primary-caregiver **row** icon, since `roleVisual` is shared)
or accept that the distinct Arabic labels carry the distinction — which still satisfies the
never-colour-only law, since the differentiator is text.

---

## 🟡 F8 — Inactive member row looks inverted

**Verdict: REFUTED (none).** The code forecloses this rather than merely contradicting it. I
verified the decisive line myself.

`figma-members.tsx:169`:

```js
const emailLine = member.email && member.fullName ? member.email : null;
```

The email line is emitted **only when `fullName` is non-null**. So the pairing you describe
cannot exist: if the primary line shows an email local-part, then `fullName` was null, which
forces `emailLine = null` and means **no email is rendered on that row at all**. Conversely,
if an email *is* on the secondary line, the primary line is the real `fullName`.

There is also no RTL transposition available — `nameRow` and `metaRow` are **vertically
stacked** children of a column `View` (`:177-190`), so RTL mirrors them horizontally but can
never swap which is on top. And there is no inactive-specific branch: `renderRow` (`:159`) is
the single function used for both lists; `dim` (`:161`) only changes opacity, the avatar
tone, and **appends a status segment** (`:195-202`).

**What you almost certainly saw:** a member with no `profiles.full_name`, so the primary
line correctly falls back to the email local-part `ibrahim.khalifah91` exactly as the A8
contract prescribes — and the secondary line is `[glyph] {role} · مُزال`, where the status
label «مُزال» sits precisely where an email would sit in that meta chain. «مُزال» and
«غزال» are one letter apart in skeleton: an initial meem carrying a damma renders as a loop
with a mark above it, visually near-identical to a dotted ghain at 14px.

**No fix warranted.** If «مُزال» is judged hard to read at 14px that would be a copy change
to `circleMembers.status.removed` — but that is a canonical status enum label, which the
copy-voice law says to leave and flag rather than reword.

---

## 🟡 F9 — Creating a task lands you on an empty screen

**Verdict: CONFIRMED (medium)** — symptom real, but **two parts of your account are wrong**,
and the fix follows from the correction rather than from the report.

**"The view resets to «اليوم» + «مهامي»" — refuted.** Nothing resets. `/tasks` and
`/tasks/new` are sibling screens in the same nested stack
(`src/app/(app)/tasks/_layout.tsx:17-28`, `initialRouteName: 'index'`), so the list stays
**mounted** while the form is pushed, and `router.back()` pops back to the still-mounted
component with its `tab`/`scope` `useState` exactly as you left it. Had you switched to
«كل المهام» before tapping «+», the new task **would** have been visible on «مفتوحة». The
symptom is that the defaults were never anything else.

**"No toast" framed as a Tasks bug — refuted.** Silence after a create is the **app-wide
convention** across all six create forms. Fixing it in Tasks alone would make Tasks the
inconsistent one.

**The genuine, Tasks-specific defect** is the destination filter combination: the list's two
defaults — tab «اليوم» (`due_date === today`) and scope «مهامي» (`assigned_to === me`) —
**both reject a task created with the form's own defaults** (`dueDate=''` → null,
`assignedTo=''` → null). The new row satisfies neither filter, so the screen shows the same
empty card it showed before the save. Home's «مستحقّة اليوم» tile also stays put. The user's
only reasonable inference is that the save failed — and the likely behaviour is to create
the task again, i.e. duplicate care work in a coordination app.

**Smallest fix — fix the destination, not the toast:**

1. `figma-tasks.tsx:101` → `useState<TaskScope>(canManage ? 'all' : 'mine')`, bringing it in
   line with CLAUDE.md A1 and with its own siblings (`figma-appointments.tsx:74`,
   `figma-visits.tsx:89`). On its own this makes the new task visible on «مفتوحة».
2. Apply the F2 fix (widen `:119`). Combined with (1), an overdue-or-today task is visible
   immediately with no taps.
3. If it still cannot match the active view (a future due date), land the user on the task
   itself: capture the created id and `router.replace('/tasks/' + id)` instead of
   `router.back()`. **Verify `createTask` returns the inserted row first** — `api.ts:54-57`
   currently does not — and note that `submitted` must still be set before navigating or
   `UnsavedChangesGuard` (`task-form.tsx:133`) will fire.

Change (1) is one line but is a deliberate behaviour change to a documented default — record
it as closing the code/CLAUDE.md A1 gap, not as a silent tweak. Do **not** bolt a bespoke
toast onto Tasks alone; if success feedback is wanted it belongs as one shared primitive
across all six create forms (`tasks.saved` already exists at `ar.json:763`).

---

## 🟡 F10 — Circles list renders EMPTY during refetch

**Verdict: CONFIRMED (low)** — but **your refetch theory is refuted, and the repro you saw
cannot happen on Android.**

**"Rendering an empty array during a refetch instead of holding previous data" is false.**
React Query v5 holds `data` across invalidation, refetch, and refetch *failure*; the
provider's query is never unmounted or reset; and there is **no** `removeQueries` /
`resetQueries` / `clear()` anywhere in `src/`. No code path in the app can drop the cached
circle list. What you saw was a **cold render** (initial fetch), not a refetch — the
delete-account round trip triggers it only on web, because a URL-entered route makes the
in-screen back a full page load.

**The real defect is narrower and does exist on device.** `account.tsx` renders the circle
row as `activeCircle ? <FigmaListRow/> : null` and never reads the `isLoading` the same
provider already exposes — so **"circles not loaded yet" and "you belong to no circle"
render identically**. On a cold launch (or right after sign-in) on a slow network, tapping
Account before the query resolves shows «دوائر الرعاية» with only «إعدادات الإشعارات» +
«الانضمام», reading as *"you have no circle"* rather than *"loading"*.

**Smallest fix (~6 lines, one file):** pull `isLoading` from `useCircleSelection()` at
`account.tsx:46` and render `<SkeletonList count={1}/>` in the circles Surface
(`:144-153`) while loading, keeping `null` only for the genuinely-no-circle case. No i18n
change if you use the skeleton-only variant. `useCircleSelection().isLoading` is already
consumed at `(tabs)/index.tsx:24` and `circle-selection/hooks.ts:13`, so no provider change
is needed.

**Do not wire `isError` here.** `provider.tsx:132` surfaces `isError` even when `data` is
still cached, which is why every `CircleGate` screen blanks to a full-screen `ErrorState` on
an offline refetch (`circle-gate.tsx:39-48`). That is a separate and larger issue — worth
filing on its own.

---

## 🟡 F11 — Explore renders fully blank with no loading state

**Verdict: WEB-ONLY (none).** Both halves of the diagnosis are wrong.

Explore does **not** "gate the entire screen behind a loading check that returns null" — it
contains **no loading check whatsoever**. `ExploreScreen` renders its band and all three
section cards unconditionally from a static constant, so it cannot render blank on device.

And the treatment is not inconsistent with `/circle-members`: that screen was mid-**data**
load, Explore was mid-**boot**. The blank canvas is the **root layout** returning `null`
until the Cairo + icon fonts resolve — which is why **no header and no tab bar were visible
either**. A screen-level bug could not have hidden the tab bar; that detail is the tell.

On Android that gate is covered by the native splash (`app.json:36-45`) and the fonts ship in
the bundle. The ~3s white page is confined to the react-native-web dev server (Metro bundle +
HTTP font fetch).

**No fix warranted.** Two optional polish items if you want them: give
`(tabs)/index.tsx:29-35` the band + `SkeletonList` treatment the rest of the app uses (Home's
chrome-less spinner is the real outlier, not Explore); and if the web build is ever shipped,
`src/app/_layout.tsx:69` should render a themed background instead of `null` so the boot
window is Dar-sand rather than white.

---

## 🟡 F12 — Permission-denied screen for invitations has no header/back

**Verdict: CONFIRMED (low).** Your description is accurate; only the scope needs widening.

The permission branch returns a bare centred `ThemedView` + `EmptyState` instead of a
`FigmaScreen` + `FigmaHeader`, and the circle-members nested stack sets
`headerShown: false` for every screen in the group — so no native header backstops it. The
*manager* branch (`InvitationsList`) draws its own `FigmaHeader`, which is why the trap
exists only on the denied path.

**It is not unique to `invitations`** — `/circle-members/invite` has the byte-identical
defect. It is **not** a general codebase pattern: the three `*/new` managers-only branches
keep their native header, and `/available-to-claim` and `/caregiver-week` deliberately
render the band *before* the block, exactly as you observed.

**Reachability on a device is narrow but real:** the «إدارة الدعوات» button is gated on
`canManage` (`figma-members.tsx:291-297`) as is the invite «+» (`:265`), and no notification
deep link resolves there. The realistic paths are (a) a crafted
`sanadmobile://circle-members/invitations` link, or (b) **a manager sitting on the screen who
is demoted**, whose role flips on the next circles refetch (staleTime 30s) and re-renders the
denied branch under them.

Android hardware/gesture back **does** still pop the stack (`app.json:21` disables only the
*predictive* back animation). But hardware back is not a sufficient affordance for the target
user: Dar law makes the 44dp bordered back square the canonical, always-visible exit on every
sub-screen, and an older caregiver facing a lone card with no visible way out reads it as the
app being stuck.

**Smallest fix (two route files, zero new i18n keys):** wrap both denied branches in the
standard chrome — `invitations.tsx:19-21` and `invite.tsx:24-26` →
`<FigmaScreen><FigmaHeader title={…}/><EmptyState …/></FigmaScreen>`, using
`invitations.manageTitle` / `invitations.inviteTitle`, which already exist in both locales.
The now-dead `styles.centered` blocks can go. `FigmaHeader` uses a static `style` array so
the NativeWind law is not at risk.

---

## 🟡 F13 — «مثال:» placeholder prefix still app-wide

**Verdict: CONFIRMED (low).** Right, and **under-counted**: **15 keys**, not the 5 you cited.

All 15 are live `placeholder` props. You found vitals (4) and the task form (1); the other 10
are on onboarding, invite, join-circle, recipient-profile (×4), emergency-contacts and
sign-up.

*One correction to your wording:* the vitals form has **five** placeholder keys, but
`vitals.placeholders.value` (`ar.json:1117`, «أدخل القيمة») is already bare and is not part of
this finding — so vitals contributes 4 offenders, not 5.

**Why it survived:** the M6 correction was executed as a per-screen restyle, not a locale
sweep. Commit `1f9eb3b` rewrote `medications.placeholders.*` to bare examples but left
`vitals.placeholders.*` on the old wording and never touched the seven other namespaces.

**Smallest fix:** strip the prefix from 15 `ar.json` values and the matching "e.g. " from 15
`en.json` values — `ar.json:60,62,357,373,411,412,413,414,440,805,1115,1116,1118,1119,1188`
and `en.json:60,62,354,370,408,409,410,411,437,802,1112,1113,1115,1116,1185`.
**Locale-files only** — no component changes, no keys added or removed, so
`scripts/check-i18n-parity.js` stays green untouched.

**Two judgement calls to make deliberately rather than mechanically:**

- `joinCircle.codePlaceholder` («مثال: ABCDE-FGHJK») — a bare code in a code field may read as
  *prefilled input*. Consider keeping a prefix or switching to a mask.
- `vitals.placeholders.notes` and `medications.placeholders.scheduleNotes` end in «...», a
  different and already-inconsistent idiom. Settle it in the same pass.

Nine screens change visually in a text-only way, so any screenshot baselines covering them
need re-baselining.

*Dead code found in the same area:* `src/features/vitals/vital-fields.tsx:121` `VitalFieldset`
is unreferenced.

---

## 🟡 F14 — Date input renders `dd-----yyyy`

**Verdict: WEB-ONLY (low).** Your diagnosis is essentially correct.

The web-only `DateField` renders a raw `<input type="date">`
(`src/components/date-field.web.tsx:30-31`). The mangled text is the **browser's own
user-agent shadow-DOM placeholder** (`::-webkit-datetime-edit`), which inherits
`direction: rtl` from `document.documentElement.dir` (`src/i18n/rtl.web.ts:11`) while the
component's inline style never sets `direction` (`:37-54`) — so the neutral separator
characters bidi-reorder into `dd-----yyyy`.

**The one refinement:** it is not merely "a web artifact the app trips over" — it is the UA
shadow DOM, which **no React Native Web inline style can rewrite**. A web-only mitigation
exists (add `direction: 'ltr'` at `date-field.web.tsx:37`, and the same at
`time-field.web.tsx:36`), but nothing about it reaches Android.

**On Android: nothing.** The native `DateField` renders no text input at all — the user taps
the due-date field and gets a Dar-styled bottom sheet with three scroll wheels labelled
«السنة / الشهر / اليوم», with «اختر التاريخ» as the empty-state trigger text. The string
`dd-----yyyy` is unreachable. Metro never bundles `.web.tsx` for `platform=android`, so any
web fix is incapable of regressing the device build.

---

## 🟡 F15 — Dose-count scoping is inconsistent across roles

**Verdict: CONFIRMED (low-medium).** Your observation is right; **the mechanism is a client
filter, not RLS** — and that changes the fix substantially.

`src/features/medications/figma-medications.tsx:77`:

```js
const scopeToMine = !canManage && canLog;
```

`canLog` is a **write** capability (`permissions.ts:9-16`), and `remote_member` fails it — so
the read-only observer **skips the filter entirely** and sees all 21, while the family_member
who actually gives the doses sees 7. The «X أدوية فعالة» line directly beneath is computed
from a different, unfiltered array (`meds.length`, `:156`), so one card states an unscoped
household number and a scoped personal number in adjacent lines.

**Neither number is produced by RLS.** `medications` SELECT is role-blind
`using (is_circle_member(circle_id))` (`20260608130000:41-46`) and `medication_schedules` is
identical (`20260608130100:89-94`); the only narrowing is RESTRICTIVE and **caregiver-only**
(`20260726160000:179-197`). The server hands نورة all 10 medications *and* all 21 dose
occurrences. RLS cannot produce 21→7.

**Corrections to my own first pass, one of which is safety-critical:**

- **The defect is `family_member`-only.** `canLogDoses` also returns true for `caregiver` —
  but for her, `medications` and `medication_schedules` are *both* restrictively narrowed, so
  `meds.length` and `total` are computed over the same data and **agree**. The 10-vs-7
  mismatch cannot occur for a hired caregiver.
- **"Arithmetically odd" is wrong — which makes it worse.** `computeDoseItems` skips
  schedules whose window excludes today (`today.ts:71-72`) or whose `days_of_week` omits
  today's weekday (`:73`), so 7 doses across 10 active meds is a perfectly legitimate reading
  for a real household. **There is no tell.** She can only detect it by tapping «كل الأدوية»
  and counting the time chips herself — which she *can* do, since `meds` and
  `schedulesByMedId` are both full. The same screen shows her the scoped 7 in the summary and
  the material for the unscoped 21 one tab away.

**Smallest fix — copy first. A scope toggle here is NOT safe without a backend change.**

> **(a) Copy — the recommendation.** Add `figma.medications.summaryMine`
> («{{given}} من {{total}} من جرعاتك اليوم») and a matching `activeCountMine`, ar + en at
> exact parity, selected at `:151-156` when `scopeToMine`. Removes the misreading, costs
> nothing, touches no server.
>
> **(b) A «جرعاتي / كل الجرعات» toggle — do NOT ship this client-only.**
> `medication_logs` SELECT *is* responsibility-scoped (`20260626161000:150-161`). So the
> server serves نورة the 21 **slots** but only her 7 slots' **logs**. On «كل الجرعات» the
> other 14 would render `status === null` → «لم تُسجَّل» **even for doses a sibling already
> administered.** That is precisely the failure this codebase names at `today.ts:109-115`:
> *"the dose re-presents as UNLOGGED. That is a double-dose risk."* Option (b) is only safe
> if `medication_logs` SELECT is widened in the same change — which is a backend change
> subject to the hand-applied-migrations law.

Whichever you choose, decide the same way for appointments (`figma-appointments.tsx:74`) and
visits (`figma-visits.tsx:89`) in the same pass — three screens with three postures is how
this drifted.

**On A1:** full A1 compliance on this screen is **impossible client-side** — the client
cannot show a family_member the true status of 14 doses whose log rows do not exist for her.
The honest framing is *"A1 is unimplementable for doses without an RLS change, and A1's
stated rationale is stale"*, not *"the screen breaks a law it could simply obey."*

---

## The confirm-freeze question — your judgement is correct

**Not a product bug.** `src/utils/confirm.ts:21-26` branches on platform:

```js
if (Platform.OS === 'web') {
  if (typeof window !== 'undefined' && window.confirm(`${copy.title}\n\n${copy.message}`)) { … }
  return;
}
Alert.alert(copy.title, copy.message, [ … ]);   // :27-34
```

`window.confirm` is synchronous and blocks the JS thread — exactly the freeze you saw. On
Android the same call produces a proper native two-button `AlertDialog`. Sign-out and
«أنا متكفّل» (`figma-tasks.tsx:131-141`) both route through `confirmAction`, which is one of
the three patterns CLAUDE.md sanctions, so this is correct by the standing decision.

Worth logging at cosmetic severity only: the Dar law says overlays use an in-app scrim sheet,
and the redesign moved most confirms to bottom sheets — so these two going through a
*platform* dialog is a small inconsistency. It does not affect Android correctness.

---

## New defects found during verification (not in your list)

**N1 — the gold «متاح للتكفّل» card is shown to a hired caregiver, and the screen then
throws (high).** `figma-home.tsx:499` gates the card on
`circle.canManage || circle.canLogDoses`, and `canLogDoses` **includes `caregiver`**
(`permissions.ts:9-16`). But `list_available_to_claim` refuses `caregiver` with SQLSTATE
42501 (`20260726160100:341` — the M8 edit deleted `,'caregiver'` from the allow-list). So a
hired caregiver sees a prominent gold card, taps it, is routed with `canClaim={true}`
(`available-to-claim.tsx:16`), and gets a hard RPC error. Correctly hidden for
`remote_member` and `elder` only. **Fix:** gate the card on the RPC's actual allow-list
(admin | primary_caregiver | family_member), not on `canLogDoses`.

**N2 — `CircleGate` blanks to a full-screen error on any offline refetch (medium).**
`provider.tsx:132` surfaces `isError` even when `data` is still cached, and
`circle-gate.tsx:39-48` renders a full-screen `ErrorState` on it. A momentary network blip
therefore replaces a working screen with an error page even though the data is in hand. Found
while refuting F10; larger than F10 itself.

**N3 — `TaskRow` has no `android_ripple` on any of its four Pressables (low).** See F3c
above. Under the standing NativeWind law, `android_ripple` is the only sanctioned press
feedback, and the sibling `caregiver/today.tsx` uses it. All four controls are inert to the
touch on Android; the web QA could not have seen this because RNW supplies `:hover`/`:active`.

Minor, non-blocking: `week-summary.tsx:456` stretches the final partial bead row (F4);
`vital-fields.tsx:121` `VitalFieldset` is dead code (F13); `ar.json:126` `loopDoses` is a dead
key and `loopA11y` (`:130`) carries the same plural bug as F6.

---

## Prioritised fix list — CONFIRMED only

Ordered by user harm per unit of risk. Nothing here has been implemented.

### Tier 1 — decide before coding

1. **F1 — the A1 posture.** This is a **product decision**, not a patch: either widen
   `can_view_all_operational` (a hand-applied migration whose blast radius is **five read
   surfaces including dose-proof photos**, requiring a stated runbook step and a before/after
   read matrix), **or** accept the narrow posture and remove the controls that lie about it.
   Either way, **Layer 1 is free and should land now**: fix the three false comments
   (`figma-tasks.tsx:95-96`, `hooks.ts:66`, `api.ts:34`) and reconcile CLAUDE.md A1.
2. **F2 default-scope contradiction.** CLAUDE.md says managers default to `'all'`; the code
   defaults everyone to `'mine'`. Settle which is right — it determines the F2 and F9 fixes.

### Tier 2 — real user harm, low risk, client-only

3. **F2** — widen `figma-tasks.tsx:119` to `due_date <= today`, and make the empty state
   tab-aware (2 key pairs). *Overdue care work is currently hidden behind an all-clear.*
4. **N1** — gate the gold claim card on the RPC's real allow-list. *Hard error path for a
   live role.*
5. **F9** — default managers to `'all'` (`:101`); optionally `router.replace` to the created
   task. *Users are re-creating tasks they already saved.*
6. **F3a/F3b/F3c** — add `hitSlop` + `android_ripple` to the three inner controls, and
   **delete `disabled={claiming}` at `:581`**. Three one-liners; no restructure.
7. **F7** — presence-gate a `primary_caregiver` legend row. Zero new i18n keys.

### Tier 3 — correctness and polish

8. **F6** — convert `figma.medications.summary` to a six-form family **and pass `count` as a
   number**; same treatment for `loopA11y`; delete dead `loopDoses`.
9. **F15** — ship the copy fix (a) only. **Do not ship the toggle (b) without widening
   `medication_logs` SELECT** — it would re-present administered doses as unlogged.
10. **F12** — wrap the two denied branches in `FigmaScreen` + `FigmaHeader`.
11. **F10** — render a skeleton while `isLoading` in the Account circles group.
12. **F13** — strip «مثال: » from 15 ar keys + 15 en keys, after deciding the two edge cases.
13. **N2** — stop `CircleGate` blanking when cached data exists.

### Not to be fixed

F4, F5, F8, F11, F14, and the confirm freeze. F4 and F14 carry optional polish noted in their
sections; F5 and F8 warrant no change at all.

---

## Suggested next step

The one thing that would close the remaining uncertainty cheaply is a **read-only** check of
the live policy catalog, which would convert F1 from "settled by migrations + your A/B" to
"settled against production":

```sql
select tablename, policyname, permissive, roles, qual
from pg_policies
where schemaname = 'public' and tablename in ('care_tasks','medication_logs')
order by tablename, policyname;

select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'can_view_all_operational';
```

Both are pure reads and mutate nothing, but per the standing Supabase guardrail I have not
run them — say the word and I will, or paste the output here.
