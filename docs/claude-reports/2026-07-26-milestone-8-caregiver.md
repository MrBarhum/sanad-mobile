# Milestone 8 — The hired-caregiver role

**Branch:** `milestone-8-caregiver` (worktree `.claude/worktrees/milestone-8-caregiver`, off `milestone-7-prelaunch` @ `89fde5d`)
**Date:** 2026-07-26
**Project ref:** `qccgshanmoeybagxwvcs`

**Validation quartet, green after every commit:**
`npx tsc --noEmit` = 0 · `node scripts/check-mojibake.js` · `node scripts/check-i18n-parity.js` · `git -c core.autocrlf=false diff --check`

---

## 0. Read this first — the three things that matter

1. **The role was already half-built in the database, and the half that was supposed to be
   blocking it was never installed.** `caregiver` has been in the `circle_role` enum since
   the initial schema and is already named in five write policies. No `ALTER TYPE` was
   needed — the one genuinely dangerous, non-transactional operation is absent from this
   milestone entirely. But the server-side guard the repo has always claimed rejects
   `caregiver` and `elder` **does not exist in production**. See §2.

2. **The four existing roles are provably untouched.** 127 probes across five member
   accounts, twenty tables and five SECURITY DEFINER read paths, captured before and after,
   **byte-identical**. Not "no differences observed" — the files diff clean. See §4.

3. **Everything the milestone forbids is refused by the database, not hidden in the UI.**
   39 probes, 39 pass, 25 of them negative. See §5.

---

## 1. What was built

### Step 0 — the outstanding Milestone 7 work, committed first

The previous session finished H1/H2/H9 but committed nothing, while H1 was already applied
to production — code and database were out of step. Committed as four units on
`milestone-7-prelaunch` before this branch was cut, quartet green:

| Commit | Unit |
|---|---|
| `3dad3f9` | H1 — revoke `anon` EXECUTE on every function in schema `public` |
| `2399d76` | H2 — real Arabic plurals + the parity guard that stops them regressing |
| `7339d6e` | H9 — the stale invite-code format comment |
| `89fde5d` | the §9e record of all three |

The commit messages had to be rewritten once: a PowerShell here-string (`@'…'@`) was passed
to the Bash tool, which took the `@` literally and made it the first line of each message.
Trees verified identical before and after the rewrite.

### The milestone itself

Three migrations, **all applied to production and verified**, plus the client.

| Migration | What | Applied |
|---|---|---|
| `20260726160000_caregiver_least_privilege_rls.sql` | 9 `RESTRICTIVE` policies + `is_circle_caregiver()`. Purely additive. | ✅ |
| `20260726160100_caregiver_rpc_scope.sql` | 8 SECURITY DEFINER functions re-scoped. | ✅ |
| `20260726160200_enable_caregiver_role_assignment.sql` | `caregiver` invitable; `elder` blocked for the first time. | ✅ |

Migration history recorded (36 rows for 36 files), so `db push` stays safe.

---

## 2. ⚠️ Production finding — a guard the repo claims, that was never installed

This is the most important thing in this report and it is not what the milestone was about.

`supabase/migrations/20260610130100_create_membership_invitation_rpcs.sql` has carried, since
its **only** commit (`fa7ceaa`, 2026-06-11):

```sql
-- :93-95 in create_circle_invitation, :476-478 in update_circle_member_role
if p_role in ('caregiver', 'elder') then
  raise exception 'this role is not available yet' using errcode = '42501';
end if;
```

and `src/features/circle-members/role-capabilities.ts:17-21` stated as fact that "BOTH
`update_circle_member_role` and `create_circle_invitation` reject them".

**Neither function in production contained that guard.**

```
select proname, (prosrc like '%not available yet%') as has_guard from pg_proc … ;
  create_circle_invitation   f
  update_circle_member_role  f
  accept_circle_invitation   f
```

Until `20260726160200`, any manager could create a `caregiver` **or an `elder`** invitation,
or promote an existing member into either role, with a single direct PostgREST call. The
only thing in the way was a client-side array. Because the RLS already names `caregiver` in
five write policies and `circle_members` SELECT was role-blind, such a member would have
received real privileges — including the full roster — immediately.

Nothing was exploited: production has **zero** members in either role and the app never
offered them. But the defence was documentary, not actual.

### How it hid

`20260610130100` is recorded as applied and `supabase migration list --linked` reports
Local == Remote for it. The file has never been edited since its single commit, so this is
not a later repo change — the body installed simply came from somewhere else, almost
certainly an earlier draft pasted into the Dashboard SQL Editor before the file was
finalised. That is consistent with the Milestone 7 finding that the remote history had one
row and everything since was Dashboard-applied.

Milestone 7 backfilled that history by verifying each migration **"against a distinctive
object it creates (a table, a function, or a specific column)"**. That proves a function
**exists**. It cannot prove its **body** matches. This is precisely the gap.

### How wide is it? — a full body-level audit

Every one of the 65 production function bodies was normalised (whitespace, case, comments
stripped) and searched for in the normalised concatenation of all 33 migration files plus
`docs/deployment/*.sql`.

**61 of 65 match the repo verbatim. Exactly 4 do not — all four from `20260610130100`:**

| Function | What production is missing |
|---|---|
| `create_circle_invitation` | the caregiver/elder guard **only** |
| `update_circle_member_role` | the caregiver/elder guard **and** the canonical-lock-order rewrite |
| `leave_care_circle` | the canonical-lock-order rewrite |
| `update_circle_member_status` | the canonical-lock-order rewrite |

So there are **two** independent unshipped changes in that one file, not one.

### ⚠️ Still open, deliberately not fixed here

**The last-admin race hardening is not in production.** The repo's versions of
`update_circle_member_role`, `update_circle_member_status` and `leave_care_circle` lock the
**circle row first**, then the member, and re-validate the membership under that lock. Their
own comment says why: *"without it, two admins each leaving / being demoted could each still
count the other as active before either commits, leaving the circle with zero active
admins."* Production still locks the member first and reads `care_circles` without
`FOR UPDATE`.

That is a real concurrency fix. It is **not** applied, and I deliberately did **not** bundle
it: it changes behaviour for admins and owners, it is unrelated to this milestone, and
shipping it silently inside a role migration is exactly the pattern that produced the
Milestone 7 incident. **It needs its own reviewed change.** Until then a circle can, in
principle, be left with zero active admins by two concurrent demotions.

### What this changes about how migrations are trusted

The generated-from-production technique used for `20260726160100` and `…160200` (see §3)
should become the default for any `create or replace` of an existing function. A hand-written
replacement copied from the repo file would have shipped the lock-ordering change
unreviewed, under a commit message about roles.

**Recommended follow-up:** run the body-level audit as a checked-in script, not a one-off.

---

## 3. The permission model, as built

Derived from the milestone's principle: *she sees the care work in front of her today, not
the family's coordination layer.*

### Reads

| Table | Caregiver sees | Mechanism |
|---|---|---|
| `care_circles` | her circle | pre-existing `is_circle_member` |
| `care_recipients` | full row | pre-existing — the milestone grants the basic profile |
| `doctors`, `emergency_contacts` | full | pre-existing — she is the person who would have to call |
| `medications` | **only where `responsible_user_id` = her** | **NEW** restrictive |
| `medication_schedules` | **only her responsible meds'** | **NEW** restrictive |
| `medication_logs` | only her responsible meds' | pre-existing (`can_view_all_operational` excludes her) |
| `care_tasks` | only `assigned_to` = her or `completed_by` = her | pre-existing |
| `daily_care_logs` | **only `recorded_by` = her** | **NEW** restrictive |
| `vital_readings` | **only `recorded_by` = her** | **NEW** restrictive |
| `circle_members` | **only her own row** | **NEW** restrictive |
| `care_appointments` | **nothing** | **NEW** restrictive |
| `family_visits` | **nothing** | **NEW** restrictive |
| `circle_invitations` | nothing | pre-existing (RLS on, zero policies) |

### Writes

| Action | Caregiver | Mechanism |
|---|---|---|
| log/correct a dose for a med she is responsible for | ✅ | pre-existing — already named her |
| complete or cancel a task assigned to her | ✅ | pre-existing — already named her |
| add / edit / delete her own daily log | ✅ | pre-existing |
| add / edit / delete her own vital reading | ✅ | pre-existing |
| create or edit a family visit | ❌ | **NEW** restrictive (was permitted) |
| create/edit/delete any medication, schedule, task, appointment | ❌ | pre-existing (managers only) |

### SECURITY DEFINER RPCs

| RPC | Caregiver | Change |
|---|---|---|
| `list_circle_members` | ❌ 42501 | **NEW** explicit guard |
| `list_care_activity` (Pulse) | ❌ 0 rows | **NEW** one conjunct |
| `list_available_to_claim` | ❌ 42501 | one-token removal |
| `claim_care_task` / `_appointment` / `_family_visit` / `_medication_responsibility` | ❌ 42501 | one-token removal |
| `set_assigned_appointment_outcome` | ❌ 42501 | one-token removal |
| `list_circle_invitations`, `set_circle_timezone`, `set_missed_dose_grace_minutes`, `create_circle_invitation`, `update_circle_member_role` | ❌ 42501 | pre-existing (managers only) |
| `notification_recipient_eligible`, `notification_recipients_for_item_event` | ✅ kept | she *should* get a reminder for her own dose |

### Why `RESTRICTIVE`, and why it is safe by construction

PostgreSQL ORs the PERMISSIVE policies together and then ANDs the result with every
RESTRICTIVE one. You cannot subtract a privilege with another permissive policy — but a
restrictive one narrows **without touching what is already there**. Every predicate reads:

```sql
not public.is_circle_caregiver(circle_id) or <her scope>
```

For an admin, primary caregiver, family member or remote member the first disjunct is TRUE,
so the policy short-circuits to TRUE. Their access is unchanged **by construction**, not by
intention — and §4 is the empirical confirmation.

`is_circle_caregiver` is `SECURITY DEFINER` for the same reason `is_circle_member` is: it
reads `circle_members` and is called from a policy **on** `circle_members`. Running as the
owner (which is `rolbypassrls`) is what stops that recursing.

### How the RPC replacements were produced

Not hand-written. Each body was read out of production with `pg_get_functiondef` and edited
by a script that **asserts its pattern matched exactly once**, aborting otherwise. It did
abort once, correctly — `set_assigned_appointment_outcome` states its collaborator set as a
`circle_role[]` literal rather than an `in (…)` list, so the generic pattern refused to
guess and it got its own. Every generated diff was reviewed line by line; each is one
intended edit and nothing else.

---

## 4. Before/after role probes — the four existing roles are unaffected

`docs/deployment/milestone-8-role-probe-read.sql`, run before and after.
Artefacts: `docs/claude-reports/milestone-8-probes/role-matrix-{before,after}.csv`.

```
diff before-read.csv after-read.csv   →   (no output)
```

**127 probes × 5 member accounts, byte-identical.** Re-run a third time after the permission
proof: still identical.

| group | probe | admin | primary_cg | family_1 | family_2 | remote |
|---|---|---|---|---|---|---|
| core | `care_appointments` | 12 | 12 | 5 | 4 | 12 |
| core | `care_recipients` | 1 | 1 | 1 | 1 | 1 |
| core | `care_tasks` | 34 | 34 | 10 | 14 | 34 |
| core | `daily_care_logs` | 3 | 3 | 3 | 3 | 3 |
| core | `doctors` | 1 | 1 | 1 | 1 | 1 |
| core | `emergency_contacts` | 1 | 1 | 1 | 1 | 1 |
| core | `family_visits` | 7 | 7 | 3 | 2 | 7 |
| core | `medication_logs` | 21 | 21 | 11 | 6 | 21 |
| core | `medication_schedules` | 10 | 10 | 10 | 10 | 10 |
| core | `medications` | 9 | 9 | 9 | 9 | 9 |
| core | `vital_readings` | 1 | 1 | 1 | 1 | 1 |
| rpc | `can_view_all_operational` | 1 | 1 | 0 | 0 | 1 |
| rpc | `list_available_to_claim` | 5 | 5 | 5 | 5 | **42501** |
| rpc | `list_care_activity` | 45 | 45 | 45 | 45 | 45 |
| rpc | `list_circle_invitations` | 3 | 3 | **42501** | **42501** | **42501** |
| rpc | `list_circle_members` | 6 | 6 | 6 | 6 | 6 |
| struct | `care_circles` | 1 | 1 | 1 | 1 | 1 |
| struct | `circle_invitations` | 0 | 0 | 0 | 0 | 0 |
| struct | `circle_members` | 6 | 6 | 6 | 6 | 6 |
| struct | `profiles` | 1 | 1 | 1 | 1 | 1 |

The `cron` group (notifications, outbox, deliveries, push tokens) is probed and labelled but
excluded from the strict diff — five `pg_cron` jobs write to those tables every 5–15 minutes,
so they are a moving target that would make the comparison lie.

**Design notes on the probe that are worth keeping:**
- It records **SQLSTATE** next to every count. An RLS filter yields 0 rows silently; a
  missing GRANT raises 42501. A count-only matrix would score `remote_member`'s claim-feed
  refusal turning into a success as ordinary data drift.
- It **asserts `current_user = 'authenticated'`** before counting. `postgres` is
  `rolbypassrls` and no table has FORCE ROW LEVEL SECURITY, so a failed role switch would
  return full counts for every role and the matrix would "pass" while testing nothing.
- Identity is (circle ordinal, role, per-role ordinal) — no uid, name or email — and the
  ordinal is partitioned **by role** so adding a caregiver cannot renumber `family_member`.

**The two known limits of this evidence**, stated plainly:
- There is exactly **one** `care_circles` row in production, so every probe tests
  *intra*-circle RLS only. A policy that accidentally omitted its `circle_id` predicate would
  produce an identical matrix today and leak the moment a second circle exists. All nine new
  policies carry `circle_id` explicitly, but that is review, not proof.
- `admin`, `primary_caregiver` and `remote_member` each have a sample size of **one**.

---

## 5. The new role — positive and negative proof at the database

`docs/deployment/milestone-8-caregiver-permission-proof.sql`.
Artefact: `docs/claude-reports/milestone-8-probes/caregiver-permission-proof.csv`.

**39 probes · 39 pass · 0 fail.**

Run inside a **rolled-back transaction** that borrows an existing member as the test
caregiver, gives her one responsible medication and one assigned task, probes everything,
and rolls back. No `caregiver` row ever exists in production, so §4's before/after matrix
stays comparable. Residue verified afterwards: 0 caregivers, 6 members, 21 medication_logs,
3 daily logs, 1 vital, 7 visits — all exactly as before.

### Positive — 14/14

`care_circles` 1 · `care_recipients` 1 · `doctors` 1 · `emergency_contacts` 1 ·
`medications` **1 of 9** · `medication_schedules` 1 · `medication_logs` 5 ·
`care_tasks` **2 of 34** · INSERT `medication_log` for her responsible med ✅ ·
UPDATE her assigned task to completed ✅ (1 row) · INSERT `daily_care_log` ✅ ·
INSERT `vital_reading` ✅ · reads back **only her own** daily log (1, not the family's 3) ·
reads back only her own vital.

### Negative — 25/25, every one refused by the DATABASE

| Probe | Result |
|---|---|
| read `circle_members` (roster) | **1 row — her own — not 6** |
| read `care_appointments` | 0 |
| read `family_visits` | 0 |
| read `circle_invitations` | 0 |
| RPC `list_circle_members` | **42501** |
| RPC `list_care_activity` (Pulse) | **0 rows** (admin sees 45) |
| RPC `list_available_to_claim` | **42501** |
| RPC `list_circle_invitations` | **42501** |
| RPC `claim_care_task` | **42501** |
| RPC `claim_medication_responsibility` | **42501** |
| RPC `set_assigned_appointment_outcome` | **42501** |
| RPC `create_circle_invitation` | **42501** |
| RPC `update_circle_member_role` | **42501** |
| RPC `set_missed_dose_grace_minutes` | **42501** |
| RPC `set_circle_timezone` | **42501** |
| INSERT `family_visit` (her own) | **42501** |
| INSERT `medication_log` for a med she is NOT responsible for | **42501** |
| INSERT `care_task` | **42501** |
| INSERT `medication` | **42501** |
| UPDATE her own responsible medication | 0 rows |
| DELETE a medication | 0 rows |
| UPDATE a task NOT assigned to her | 0 rows |
| UPDATE `care_recipient` | 0 rows |
| UPDATE `emergency_contacts` | 0 rows |
| **self-promote via `circle_members` UPDATE** | **0 rows** |

`list_care_activity` returns an **empty set** rather than raising, because it is
`language sql` and converting it to plpgsql to raise would mean rewriting all 130 lines —
a far larger blast radius than the guard is worth. The probe therefore asserts 0 rows for
her against 45 for an admin in the same circle, which is unambiguous.

### Two things the proof itself uncovered

1. **`enforce_care_task_collaborator_scope` treats bare `postgres` as a collaborator.** Its
   manager bypass is `has_circle_role(old.circle_id, ['admin','primary_caregiver'])`, which
   keys off `auth.uid()`. With no JWT claim `auth.uid()` is NULL, the bypass fails, and the
   superuser is refused with *"collaborators may only complete or cancel a task"*. The probe
   now performs its manager-side setup with the admin's claim set. Worth knowing before
   anyone writes a maintenance script that touches `care_tasks` directly.
2. **A temp table is not writable by `authenticated`.** The first draft accumulated results
   in `create temporary table`; owned by `postgres`, it raised 42501 the moment the probe
   switched role. Switched to a jsonb accumulator in a transaction-local GUC.

---

## 6. The client

Four commits. `git log --oneline 89fde5d..HEAD`:

| Commit | Unit |
|---|---|
| `4f913ce` | the three migrations + both probe scripts + the probe artefacts |
| `48f136a` | role plumbing (assignability, the scoped assignee picker) + the whole `caregiver.*` i18n namespace |
| `ca2ec03` | roster identity + the invite disclosure |
| `fc790a8` | her Today shell, dose photo proof, and the family weekly summary |

### 6.1 Invitation — one more card, and a disclosure behind it

A manager invites her through the **existing** flow: same screen, same codes, same expiry,
same WhatsApp share. `invitableRoles()` and `assignableRolesFor()` gained `'caregiver'`,
listed last so the four family roles keep their order.

When — and only when — that card is selected, three disclosure cards appear: what she will
see, what she will not see, and what the app does not record (location first). The
mutual-visibility note closes them. On success the code reveal gains one row saying the code
opens the caregiver view, not the family view — again only for a caregiver invitation.

### 6.2 Her interface — one screen

`/caregiver` → «اليوم». The doses she is responsible for and the tasks assigned to her, in
time order, large targets, one tap each. Plus the emergency card (she is the person who
would have to call), quiet entries for a daily note and a vital reading, and sign-out.

`src/app/(app)/_layout.tsx` bounces a member whose active-circle role is `caregiver` out of
the tab group. **The bounce is scoped to the tab group only**, so the secondary routes she
is allowed to open — the emergency card, the daily-log and vital add forms — still work.
No tab was added to `FigmaTabBar`; its `TAB_META` is a closed three-entry map that returns
`null` for unknown routes, so a fourth tab would have rendered nothing.

Sign-out lives on her screen because she has no Account tab — without it she could not leave.

Empty states are a calm green «لا شيء مجدول اليوم» / «اكتمل كل شيء لليوم». **No streak,
score, badge, confetti or congratulation** — the no-gamification law applies to her shell in
full.

### 6.3 Photo proof — built on A5, capture gated

The Milestone 7 A5 server half is applied and was **reused, not rebuilt**: the private
`dose-proof` bucket (2 MiB, three image mime types), its four `storage.objects` policies,
`public.storage_path_uuid()`, and `medication_logs.proof_object_path`.

A CHECK constraint binds a row to `<circle_id>/<medication_id>/<log_id>.<ext>`, so the order
is forced: **insert the log first**, upload under the returned id, then update the path.

**The dose saves even if the upload fails, and the copy says so.** That is not politeness —
a worker who believes her dose record was lost because a photo failed will re-dose.

### 6.4 The family's weekly summary

One new screen: doses **on time / late / not recorded** over a chosen week, per caregiver.
Postponed and missed are shown as their **own** facts, never folded into "not recorded".

No percentage, no score, no grade, no rank, no trend, no chart, no progress bar — counts and
records only, closing on «هذه سجلّات وأرقام فقط، دون تقييم». The late threshold is read from
the circle's own missed-dose grace and stated to the reader, so "late" is never an
unexplained accusation.

**It refuses a `family_member` rather than misleading one.** `medication_logs` SELECT is
`can_view_all_operational() OR own-responsibility`, and `family_member` is **not** in
`can_view_all_operational` — such a viewer would see the schedule but none of the logs, i.e.
a fabricated all-"not recorded" week, indistinguishable from genuine non-recording. Both the
Explore row and the screen itself are manager-gated.

### 6.5 Two blockers caught in integration — worth recording

The parallel build added `expo-image-picker` to `package.json` **and** `app.json` without
running an install. Both halves were wrong, and each broke something outright:

- `npm ci --dry-run` → `EUSAGE … Missing: expo-image-picker@56.0.22 from lock file`. Any
  clean checkout or CI run would have failed.
- `npx expo config --type prebuild` → `PluginError: Failed to resolve plugin for module
  "expo-image-picker"`. That same config resolution backs `expo start`, `expo prebuild` and
  `eas build` — **the app could not be started or built at all.**

Both were reverted; `package.json`, `package-lock.json` and `app.json` are byte-identical to
`HEAD` and no longer appear in the diff. The capture path stays in the code behind a guarded
optional `require`. **To light it up later you must do both halves together** —
`npx expo install expo-image-picker` *and* the `app.json` plugin entry *and* an EAS build.
Adding either half alone re-breaks the repo. That instruction is now in the source at
`src/features/caregiver/dose-photo.tsx`.

An earlier draft of §8 of this very report described the broken combination as an
intentional, safe state. It was wrong and has been corrected.

### 6.6 The one accepted violation of "invisible when unused"

`invitableRoles()` and `assignableRolesFor()` return `'caregiver'` for **every** circle, so
the invite screen shows a fifth role card and the role-change sheet a fifth option even in a
circle that never hired anyone. That is, strictly, a visible change to a circle that never
uses the feature.

It is also **logically unavoidable**: a role only offered once you already have one can
never be granted a first time, and the milestone states she is invited through the existing
flow by picking the new role. Flagged rather than silently reverted — but it is the one
place the letter of product rule 1 is not met, and it is the maintainer's call.

Everything else on the family side is conditional and was verified by reading the actual
render conditions: the Explore row (`isManager && hasCaregiver`), the legend row
(`active ∪ inactive` contains a caregiver), the row badge (active caregiver rows only), the
shell-change callout (only when the change crosses the caregiver boundary), and every
disclosure block (`role === 'caregiver'`).

### 6.7 Two behaviour deltas that are invisible but real

1. **Explore fires one extra query for a manager.** It now calls `useCircleMembers` to
   decide whether to append the summary row. The query is disabled for non-managers (so a
   caregiver never triggers the RPC that refuses her with 42501) and it shares a cache key
   with the members screen, so it is usually warm — but it is a read that did not happen
   before.
2. **A caregiver sees the family tab bar for a frame on a cold start.** The route gate reads
   `activeCircle?.role` without waiting on `isLoading`. No family *data* is exposed — the
   home tab shows only a spinner while loading, and the database refuses her everything
   regardless — but the three-tab bar is briefly visible. It was left alone deliberately:
   gating on `isLoading` too would block the first render for **every** family user, which is
   a worse regression than the wart.

---

## 7. Design decisions I had to make

§C1 of the design brief specifies these screens but they have **not** been drawn in the Dar
identity. Everything below was a judgement call; all of it is cheap to reskin.

### 7.1 Where §C1 and the Milestone 8 brief disagree — and which won

The design brief predates this milestone's scope and contradicts it in three places. **The
Milestone 8 brief won every time**, and the i18n values were rewritten to match, because the
old strings would have been a **false statement to the family** about what the worker can see.

| §C1 says | Milestone 8 says | Resolution |
|---|---|---|
| `caregiver.invite.hidden.medical` = «القياسات الحيوية والسجلات اليومية **وبطاقة الطوارئ**» — she sees none of them | she **can** view the emergency card and **can** record a daily log and a vital reading | Rewritten. She now has `sees.emergency` («بطاقة الطوارئ وبيانات الشخص الذي تعتني به الأساسية») and `sees.own`; the hidden list gains `hidden.schedule` (appointments + visits) and `hidden.others` (other people's notes and readings). |
| Shift log, rest breaks, shift export, shift counts (C1-3 block 6, C1-4b, C1-8) | **no shift, attendance, clock-in or location tracking** | Not built. All shift copy dropped from the key set. |
| Worker language picker, Tagalog / Indonesian artboards (C1-5) | **Arabic and English only** | Not built. No language picker, no `tl.json`/`id.json`. |

**One more correction I made on my own initiative:** §C1's `caregiver.invite.mutualNote`
promised «مقدّم الرعاية يرى عن نفسه ما تراه العائلة عنه، بلا استثناء» — *the caregiver sees
about herself exactly what the family sees*. That promise depends on screen **C1-9**, the
transparency mirror, which is **not in this milestone's scope**. Shipping the sentence
without the screen would make the app lie in its most load-bearing line. Rewritten to
something that is true today: «لا يُسجَّل عن مقدّم الرعاية شيء غير ما يضغط عليه بنفسه» —
*nothing is recorded about the caregiver except what she taps herself*. **C1-9 is my #1
recommended follow-up** (§10).

### 7.2 Permission judgements the brief did not settle

Three surfaces were in neither the "can" nor the "cannot" list. I resolved them from the
stated principle and flag them for review:

| Surface | Decision | Reasoning |
|---|---|---|
| Reading **other people's** daily logs and vitals | **Denied** (own rows only) | She may *record* both. Reading the family's own observations and the recipient's longitudinal vitals is the coordination layer. Denying it also keeps a longitudinal medical record away from a hired worker who has no remit for it — while still letting her see everything she recorded, which is the "proves she did her job" protection. |
| Reading the **full medication list** | **Denied** (her responsible meds only) | A hired worker does not need the family's whole medication list to give the three doses she is responsible for, and that list is a medical history. It also makes `medications`, `medication_schedules` and `medication_logs` agree — previously the log was tighter than the medication it pointed at. |
| Being **assigned** an appointment or a family visit | **Left possible, made inert** | The manager's INSERT check is `is_active_user_circle_member`, which is role-blind. Narrowing it would change a manager's behaviour, which this milestone must not do. So the assignment stays possible and she simply cannot see it; the client also stops offering her in those two pickers. |

### 7.3 `ROLE_RANK`

`caregiver` ranks **equal to** `remote_member` (1), so a change between the two reads as
«lateral» rather than a promotion or demotion. They are genuinely incomparable: a remote
member can view every operational row but write nothing; a caregiver can write in her lane
but see almost nothing. Calling either direction an "increase" would be false. The
shell-change warning carries the part that actually matters.

### 7.4 `MemberSelect` gained an opt-in rather than a wider `DOER_ROLES`

`caregiver` is a **scoped** doer, not a general one. Offering her in the appointment or
visit picker would let a manager create an assignment that is invisible and unusable to the
assignee — silently broken rather than merely useless. So `SCOPED_DOER_ROLES` is separate
and callers opt in with `includeCaregiver`; only the task and medication forms do. The
default of `false` also keeps the promise that a circle which never hires anyone behaves
exactly as before.

---

## 8. What is gated on the EAS rebuild

**Only the photo *capture*.** Everything else works on the current build.

`expo-image-picker` is **not** a dependency of this project and is **not** referenced from
`package.json` or `app.json`. It is reached only through a **guarded dynamic require that
returns null when the native module is absent**, so photo capture is inert in every build
shipped today.

> **Correction (integration pass, 2026-07-26).** The build agent had added
> `expo-image-picker` to both `package.json` and `app.json` while deliberately not running
> `npm install`. That combination broke the repo in two ways — `npm ci` failed
> (`Missing: expo-image-picker@56.0.22 from lock file`) and `npx expo config --type prebuild`
> failed (`Failed to resolve plugin for module "expo-image-picker"`), which also takes down
> `expo start`, `expo prebuild` and `eas build`. It was also a new native dependency, which
> the milestone forbids. Both entries were reverted; the guarded require and every calm
> `caregiver.photo.unavailable` state are unchanged. To light capture up later, run
> `npx expo install expo-image-picker` (updates the lockfile), add the plugin to `app.json`,
> and make a new EAS build — both halves together, never one alone.

| Works today | Needs the rebuild |
|---|---|
| Everything in §3–§5 (all permissions) | Attaching a photo to a dose |
| Her Today screen, dose logging, task completion, daily log, vital reading, emergency card | — |
| **Viewing** an existing dose photo (uses `expo-image`, already installed and in `app.json` plugins) | — |
| The family weekly summary | — |

Until the rebuild, the photo affordance shows `caregiver.photo.unavailable` calmly — not as
an error. **After the rebuild it lights up with no code change.**

---

## 9. What I could NOT verify

Stated plainly, because an unattended session is worth exactly as much as its honesty about
what it did not touch.

1. **Nothing was run on a device or an emulator.** No screen in this milestone has been seen
   rendering. `tsc`, the mojibake scan, i18n parity and `diff --check` are all static. In
   particular the **NativeWind function-form `Pressable` bug is device-only** — it passes
   every static check and only shows on Android. The grep guard was run and is clean, but
   that is the guard, not the device.
2. **RTL and bidi were not eyeballed.** Every numeral is LTR-isolated in code, but Arabic
   line-breaking around isolated runs needs eyes.
3. **200% font scale** was not tested anywhere, and the caregiver screens use larger tap
   targets than the rest of the app.
4. **Photo capture end-to-end is unproven** — the native module is not in this build. The
   upload path, the signed-URL read and the `proof_object_path` round-trip are written
   against the applied A5 policies but have never executed.
5. **Cross-circle isolation is unprovable against production** — there is exactly one circle.
6. **No real caregiver has ever signed in.** The role is proven at the database with a
   borrowed account inside a rolled-back transaction; the *sign-in → join by code → land on
   the caregiver shell* path has not been walked end to end by a human.
7. The **last-admin race** described in §2 is still live and was not fixed.
8. **The adversarial review did not complete** — it hit the session limit with 74 of 78
   agents dead, and its two most important lenses (permissions, device) never ran at all. Its
   findings were triaged by hand instead. See §11; do not read its `confirmed: []` as a pass.

---

## 10. If I finish and you are still away — what I would do next

In priority order. **I did not start any of these.**

1. **Re-run the adversarial review** (§11). It never finished, and the permissions and device
   lenses — the two that matter most here — produced nothing. Everything else on this list is
   less urgent than knowing what that review would have found.
2. **Surface `recorded_by` on the weekly summary's dose sheet.** Doses are attributed by
   `medications.responsible_user_id`, so a dose someone else recorded currently lands in her
   column. It is the cheapest real fairness fix available and it is on the one screen that
   makes factual claims about a named worker.
3. **C1-9, the transparency screen.** The design brief calls it the ethical spine, and §7.1
   explains why its absence forced me to weaken the mutual-visibility copy. Building family
   oversight without her mirror is the surveillance framing the milestone forbids. This is
   the single most important follow-up.
4. **Apply the last-admin lock-ordering fix** (§2) as its own reviewed change.
5. **Check in the function-body drift audit as a script** so "the ledger says applied" can
   never again mean "the body matches".
6. **Device pass** on everything in §9 — the visual-QA checklist has a Milestone 8 section
   appended, and its FIRST group is the no-caregiver regression check. Then the EAS rebuild
   to light up photo capture.
7. Work through the "real but not fixed" table in §11.
8. Delete the six dead `{{count}}` i18n keys H2 identified.
9. Decide `elder`: it is now genuinely blocked, and has no design.

---

## 11. The adversarial review — and why its verdict cannot be trusted

I ran the adversarial review workflow over `89fde5d..HEAD`: six lenses finding, then three
independent refuters per finding, majority-kills.

**It returned `confirmed: []`. That result is worthless and I am not reporting it as a pass.**

The run hit the session limit. **74 of its 78 agents died.** Every finding therefore shows
`0/3 refuted` — meaning *no refuter voted at all*, not that three refuters cleared it. My
script's survival test was `votes.length > 0 && kills < 2`, so zero votes marked everything
as "not surviving" and swept all 24 findings into the refuted bucket. It is a false negative
across the board.

Worse, **two of the six lenses never ran**: `permissions` and `device` — the two most
important ones, covering exactly the defect classes this milestone is most exposed to.

So I triaged the 24 raw findings by hand instead.

### Fixed (commit `1c0507b`) — all three were the app asserting something untrue

| # | Finding | Why it mattered |
|---|---|---|
| 1 | **Future doses counted as «لم تُسجَّل»** — `classify()` returned `notRecorded` for any dose with no log, so opening the CURRENT week counted every remaining dose of today and of the rest of the week against her | The single worst defect in the milestone. A punitive misstatement about a named worker on the one screen that must be a record, not a verdict |
| 2 | **An unread grace presented as the circle's setting** — a failed read fell back to 30 minutes, classified doses «متأخّرة» against it, *and* rendered the note telling the reader 30 minutes was this circle's threshold | Asserting lateness from a number never read, then attributing that number to the family |
| 3 | **Four strings misdescribed her access** (role-picker description, roster legend, invite disclosure, photo ownership note) | These are what the family reads while deciding whether to hire someone. §7.1 exists because C1's originals were false; three of my own replacements were false in the other direction |

Finding 3 in detail — each was a real contradiction with the permission model actually built:
- the role description said she sees doses and tasks **«فقط»** while the milestone grants her
  the full emergency card and the recipient's medical details;
- the roster legend said she records **"only"** doses and tasks while the same commit gives
  her daily-note and vital-reading entries;
- the invite disclosure listed *"the other members and their contact details"* as hidden from
  her while the emergency card hands her callable phone numbers for those same people;
- the photo note promised **only she** can replace the image — a capability her UI does not
  offer at all while capture is gated.

### Triaged as real but NOT fixed — recorded, not dismissed

These need a decision or a device, and I did not want to make either call unattended.

| Finding | Assessment |
|---|---|
| **Doses attributed by `medications.responsible_user_id`, never by `medication_logs.recorded_by`** | Real fairness gap, and a consequence of the spec I wrote. A dose recorded by *someone else* on a medication she is responsible for lands in her late/not-recorded column; a dose *she* recorded on a medication she is not responsible for is not counted. Cheap fix: surface `recorded_by` in the dose sheet. **Recommended next.** |
| **A later status correction restamps `recorded_at`**, retroactively turning an on-time dose «متأخّرة» | Real. Needs a product decision: does the *first* record or the *current* record define timeliness? |
| **On-time/late computed in the DEVICE timezone, not the circle's** | Real, but pre-existing and app-wide (`computeDoseItems` is not zone-aware). It matters more here because "late" is a statement about a person. Fixing it means making the shared helper zone-aware — out of scope for a role milestone |
| **Deactivating a schedule or deleting a medication silently rewrites closed weeks** | Real. The DB keeps no schedule history, so a proper fix needs a schema change. Mitigated already: a log matching no expanded dose is still shown, so a *recorded* fact never vanishes |
| **`medications.is_active` ignored → a discontinued medication may keep generating rows** | Same root cause as above |
| **Two schedules at the same time may double-count one dose** | Plausible; in `computeDoseItems`, shared with the rest of the app. Not verified |
| **Nine RESTRICTIVE policies add a per-row SECURITY DEFINER call to seven tables for every role** | Real cost. `is_circle_caregiver` is `STABLE` so PostgreSQL caches per distinct `circle_id` within a statement, and the existing policies already call `is_circle_member` the same way — but it is a new cost paid by circles that will never have a caregiver |
| **Promoting an existing member to caregiver shows no disclosure cards** | Real gap. The disclosure lives only on the invite path; the role-change sheet gets the shell-change warning but not the "what she will see" cards |
| **Multi-sentence body copy at 14–15px on the new screens** | Real, minor — the ≥16 body rule. Left for the reskin |
| **A failed task mutation renders its alert behind the still-open sheet scrim** | Real, minor UX. Needs a device to judge |
| **Her Today task list orders by time, not A7's overdue → priority → due** | Deliberate: the milestone says "in time order" explicitly. Noting the tension with the standing A7 law |
| **`today.tsx` re-implements the band; the week picker re-implements chip select; `taskTimeKey` duplicates `dueSortKey`** | Duplication, low severity. The band re-implementation was instructed (`FigmaTabBand` takes only title/subtitle) |
| **Caregiver shares the manager's accent tone in the roster** | Flagged by the builder itself. Status is icon + text + label so it is never colour-only, but the legend's colour key is no longer unique. A reskin call |

### What this means for confidence

The DB layer is strongly verified (§4, §5): 127 before/after probes byte-identical, 39
permission probes green including 25 negatives, all against production. **The client layer is
not** — it has had one integration pass and a hand triage of a review that did not finish.
Re-run the adversarial review when limits allow; the workflow script is saved at
`.claude/…/workflows/scripts/m8-adversarial-review-wf_e7c81c80-006.js` and can be resumed.
