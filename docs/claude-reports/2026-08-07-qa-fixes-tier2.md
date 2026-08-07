# QA fixes — Tier 2 (and the D1 decision), from the 2026-08-07 verification pass

**Branches:** `qa-fixes-tier2` and `f1-rls-widen`, both worktrees off `master` @ `414a4d8`
**Date:** 2026-08-07
**Status:** **Tier 2 complete. Stopped before Tier 3 as instructed.** Nothing pushed, nothing applied to the database.

Source document: `docs/claude-reports/2026-08-07-qa-verification.md`.

**Validation after every commit:** `npx tsc --noEmit` = 0 · `node scripts/check-mojibake.js` ·
`node scripts/check-i18n-parity.js` · `git -c core.autocrlf=false diff --check`.
Plus, from this session on, `node scripts/check-confirms.js`.

**Final state:** tsc 0 · mojibake clean (280 files) · **parity 1256 = 1256** (7 plural families) ·
diff clean · confirms clean · NativeWind guard returns only the sanctioned `app-tabs.web.tsx`.

**Web bundle smoke-tested.** `npx expo export -p web` completes and static-renders every
route. That matters more than usual this session: static rendering actually executes the
provider tree, so the new `ConfirmProvider` — and any import cycle it might have introduced
between the provider and the sheet primitives — is exercised at build time, not just
type-checked.

---

## The two branches, and why they are separate

| Branch | Contains | State |
|---|---|---|
| `qa-fixes-tier2` | 12 commits — all client fixes, the confirm-sheet migration, the new guard | Quartet green after each commit |
| `f1-rls-widen` | 1 commit — the D1 migration, its rollback, a new probe, the runbook | **Written, not applied** |

D1 is on its own branch with nothing else bundled, as instructed. It is a hand-applied
backend change; the acceptance criteria are in `docs/deployment/milestone-9-d1-runbook.md`
and the before/after evidence is captured by the maintainer when it runs.

---

## `qa-fixes-tier2` — twelve commits

| # | Commit | What |
|---|---|---|
| 1 | `e4ed92d` | Layer 1 — the three false comments + the CLAUDE.md A1 reconciliation |
| 2 | `d828028` | **N1** — hired caregiver shown the claim card, then refused 42501 |
| 3 | `120616f` | **F3a/F3b/N3** — 48dp targets, disabled fall-through, `android_ripple` |
| 4 | `c094acb` | **F2** — «اليوم» hid overdue work behind an all-clear |
| 5 | `29c7f8a` | **D2** — managers default to «كل المهام» |
| 6 | `1dba948` | **F9** — a saved task now proves it was saved |
| 7 | `d7e961c` | **F7** — legend row for «مقدّم الرعاية الأساسي» |
| 8 | `23ea532` | **F15(a)** — the dose count now names its scope. Copy only |
| 9 | `192bbdb` | **F16** — the confirmation sheet infrastructure |
| 10 | `c070ba6` | **F16** — eleven call sites off the OS dialog |
| 11 | `8be2c57` | **F16** — the navigation guard, a second hidden OS dialog |
| 12 | `50b11e8` | **F16** — `check:confirms`, negative-tested |

### Layer 1 — landed first and separately, as asked

`tasks/api.ts`, `tasks/hooks.ts` and `figma-tasks.tsx` each asserted that RLS returns the
whole circle. It does not, and did not. All three now state the real policy and name D1 as
the pending change. CLAUDE.md A1 keeps its intent but loses the false claim that it mirrors
the server, and gains the reason `caregiver` must stay out of that array.

### N1 — bigger than reported

The verification pass found the Home gold card gated on `canLogDoses`, which admits
`caregiver`, while `list_available_to_claim` refuses her. Tracing it for the fix showed
Milestone 8 removed `caregiver` from **all five** claim RPCs
(`20260726160100:106,169,228,291,341`), not just the list — so every claim path errored for
her, not only the entry screen. Added `canClaimWork()` mirroring the RPC allow-list and
threaded it as `circle.canClaim` through the three derived gates. She now gets the screen's
own blocked state and the feed query is never issued.

### F3 — implemented differently from the report's first proposal, deliberately

The report's initial fix restructured the row (plain `View` container, press moved to the
text column). **Not done** — the adversarial pass was right that this is the wrong shape:
`caregiver/today.tsx` proves the 48/44 *sizes* are house standard but its row has no
detail navigation at all, so it does not prove "row-opens-detail + inner buttons" can be
built that way. Shrinking the open target to the text column would be an unacknowledged UX
regression on the screen's primary action, for the same users the finding protects.

Instead: `hitSlop` derived from `TouchTarget.min` lifts all three controls to 48 without
moving a pixel of the Dar layout; `disabled={claiming}` deleted (a disabled Pressable still
receives the touch and merely declines the responder, which is what let it bubble to the
row); `android_ripple` added to all four, which none of them had.

### F2 and D2 — and the disagreement they exposed

`«اليوم»` now means `due_date <= today`, matching `caregiver/hooks.ts:57`, which had the
rule right — two definitions of "today" were shipping in one app. The empty copy is chosen
per (tab, scope): «مكتملة» was making the same false all-clear claim in the other direction.
+4 keys, both locales.

D2 settles the disagreement the verification pass surfaced: CLAUDE.md said managers default
to `'all'`, the code defaulted everyone to `'mine'`, and a comment documented that as
deliberate. Code now follows the law, matching appointments and visits.

### F9 — the report's framing was wrong, and the fix follows the correction

"The view resets" was refuted: `/tasks` and `/tasks/new` are siblings in one stack, so the
list stays mounted and keeps its state. The real defect is that a task saved with the form's
own defaults (no due date, no assignee) matches neither default filter. D2 + F2 fix the
common cases; for the rest, `createTask` now returns the id and the form `replace`s itself
with the task's detail screen. No toast was added — silence after a create is the convention
across all six create forms.

### F15 — copy only, and the reason the toggle was not shipped

`summaryMine` names the scope. The «كل الجرعات» toggle is **not** shipped: `medication_logs`
SELECT is responsibility-scoped, so an unscoped list would render other members' doses as
«لم تُسجَّل» even when a sibling had administered them — the double-dose hazard named at
`today.ts:109-115`. **D1 widens exactly that policy for `family_member`, so the toggle
becomes safe for that role once D1 is applied.** It stays unsafe for `caregiver`.

---

## F16 — the sweep found more than the two you hit

You found sign-out and «أنا متكفّل» because they froze the browser. The sweep found **25
confirmations across two independent mechanisms**:

| Mechanism | Sites |
|---|---|
| `confirmAction()` | 8 |
| `confirmDiscard()` | 3 |
| **`useNavigationGuard` — its own `Alert.alert` / `window.confirm`, never touching `confirm.ts`** | **14 mount sites** |

The navigation guard is the one that matters. It hand-rolled a second, independent copy of
the same dialog with the **identical copy** `confirmDiscard` uses — so on a dirty form,
closing with the button gave one prompt and leaving with the back gesture gave another, one
tap apart, on the same screen. A sweep that only grepped `confirm.ts` would have missed all
14, and so would a guard written to look for `confirmAction`.

Also found and left alone: two **one-button notices** in `notifications/hooks.ts` — not
confirmations, and they fire from a notification-response handler where the cold-start
replay path may have no mounted React tree to host an in-app surface. They are the guard's
only allow-list entries, with the reason recorded in the script.

### What was built

`FigmaBottomSheet` is the confirm chrome and `Button` supplies the tones — no new primitive.
CLAUDE.md already names "bottom-sheet confirm" as sanctioned and already assigns
`FigmaBottomSheet` the backdrop-dismiss contract, which *is* a confirm's contract, so this is
the archetypal use rather than a stretched reuse. The destructive variant needed no
extension: `Button variant="danger"` already carries the restrained Dar danger treatment.

`useConfirm()` returns a function with the same shape `confirmAction` had, so each site
changed by two lines. The imperative→declarative gap was already bridged by the old API
taking a continuation rather than returning a boolean — which is also why there is no
stale-closure exposure: the closure is created at press time, over the values the user saw.

### `ConfirmOutlet` — the part that is not obvious

Four confirmations fire from **inside an already-open `Modal`**. A single root-mounted sheet
is broken there on two platforms:

- **iOS** presents a Modal from its nearest view controller. Root-mounted, that controller is
  already presenting the form; UIKit refuses and **the confirmation silently never appears**.
  For `dose-record`, whose own comment calls its confirm "the ONE exit", that would leave the
  sheet with no way out.
- **Web** appends the portal `div` to `body` at mount with **no z-index**, so stacking is DOM
  order — a root sheet is appended at boot and renders *underneath* the form.

So the sheet renders in the **last-registered outlet**, and `FormModal` and
`FigmaBottomSheet` each mount one. It lands inside whichever modal is on top, which is the
one arrangement iOS, web and Android all handle. Zero call-site changes for the four nested
cases. The sheet is itself a `FigmaBottomSheet`, so an `insideConfirm` context stops an
outlet hosting itself.

Two pre-existing a11y bugs fixed on the way, which improves the sheet's six existing
consumers too: the tap-swallowing `Pressable` defaulted to `accessible={true}`, which on
Android collapses the whole sheet into **one** TalkBack node announced as a button that does
nothing; and the backdrop had a label but no role.

### `check:confirms`, negative-tested

Wired next to `check:i18n` and `check:grants`. Bans `Alert.alert`, `Alert.prompt`,
`window.confirm`, `window.alert` under `src/`. Comments and string literals are blanked
(preserving line numbers) before matching — which was necessary immediately, since
`item-actions.tsx`, `use-navigation-guard.ts` and the guard's own header all name those calls
in prose.

Nine cases run:

| Case | Expected | Got |
|---|---|---|
| clean tree | pass | pass |
| real `Alert.alert` | **fail** | fail |
| `window.confirm` | **fail** | fail |
| `Alert . alert (` with spacing | **fail** | fail |
| comment naming all four | pass | pass |
| string/template literal containing them | pass | pass |
| violation removed | pass | pass |
| unrelated `window.confirm` **inside the allow-listed file** | **fail** | fail |
| restored | pass | pass |

The last case is the one worth noting: the allowance is per-call, not per-file.

---

## `f1-rls-widen` — D1, written and not applied

`supabase/migrations/20260807120000_widen_can_view_all_operational_to_family_member.sql`
plus `docs/deployment/milestone-9-d1-{runbook.md,rollback.sql,dose-proof-probe.sql}`.

**Five surfaces move, not one.** Every gated policy *calls* the function; none inlines the
array — `care_tasks`, `care_appointments`, `medication_logs`, `family_visits`, and the
`dose-proof` storage bucket, which lives **outside `supabase/migrations/`** and is invisible
to a migrations-only diff. That is the trap `20260729120000:60-65` warns about.

**Dose-proof photos — the argument you asked for, out loud.** The widening is accepted, not
counteracted. Reasoning in full in the runbook §3; the load-bearing points:

- The storage policy *calls* the function, so the bucket widens **automatically**. The only
  decision available was whether to counteract it.
- The delta is **read-only, provably** — INSERT/UPDATE/DELETE use a different predicate.
- **The current line is not a privacy boundary; it is an accident of array membership.**
  `remote_member` — read-only, typically not in the country — **already reads every
  dose-proof photo in the circle**. A `family_member` physically present and sharing the care
  load does not. Defending the status quo requires defending that inversion.
- The policy's own header says it mirrors the `medication_logs` row policy and that if the
  row policy changes, this must change with it. Freezing it narrow leaves the photo *less*
  visible than its own row, so the UI renders a photo slot whose signed URL 400s.
- Blast radius today is **zero UI**: the only render site is manager-gated in the client.

The strongest argument *against* is in the runbook too, not paraphrased away — a photograph
is categorically different from a status enum, its purpose is employment-shaped, the
recipient never consented, and a signed URL is a bearer token with no revocation story.

**`create or replace`, never `drop`.** Five policies hold a `pg_depend` dependency on the
function's OID. `drop … cascade` would **silently drop all five**, leaving four tables with
no permissive SELECT policy at all — deny-all for every role, admins included. Both the
forward migration and the rollback say so in their headers.

**The migration asserts itself**: all four roles present — not just the new one, since
checking only the addition would pass even if the array had been replaced by a single element
— `caregiver` absent, still `SECURITY DEFINER`, `anon` still revoked, `authenticated` still
granted.

**Acceptance criterion, stated exactly** (runbook §6): the read-matrix diff must show
**exactly ten changed lines**, all `role = family_member`, and each after-value must **equal
the corresponding `admin` value** — a stronger check than "it went up", because it asserts
the widening is precisely "sees what a manager sees". Any movement on an `admin`,
`primary_caregiver`, `remote_member` or `caregiver` line is a FAIL.

**A new probe was needed.** The committed matrix has no storage probe at all, so the
dose-proof widening would have been unmeasured. The new one evaluates the policy predicate
per role per medication rather than counting objects — deterministic even against an empty
bucket.

---

## What I could not verify here

- **Nothing was run against the database.** Per your instruction I did not run the read-only
  `pg_policies` check; D1's own probes are the intended evidence.
- **Two device-only risks in the confirm migration**, both flagged rather than discovered
  later:
  1. **Android hardware back through two layers.** With the outlet, a confirm fired from
     inside a `FormModal` is a nested dialog. Verify that back closes only the confirm and
     does not also pop the form or the route. This is the single most likely device
     regression.
  2. **iOS nested-modal presentation.** The outlet is designed to fix it; the app targets
     iOS, so it needs a device to confirm.
- **The slide-out animation is gone** on close. The sheet is mounted conditionally rather
  than toggled with `visible`, because on web a permanently-mounted modal claims the
  bottom-most DOM slot for the life of the app. Acceptable under "motion is subtle and
  short", but it is a visible change across ~25 flows — calling it out rather than letting
  it be found.
- `.env` was copied into the `qa-fixes-tier2` worktree (gitignored) so the web export could
  run. It is still there if you want to QA that branch in the browser.

---

## Left for Tier 3 — stopped here as instructed

F6 (the Arabic plural on `figma.medications.summary`, plus the identical bug on `loopA11y`
and the dead `loopDoses` key) · F12 (invitations/invite blocked branches with no header) ·
F10 (skeleton while the circles query loads) · F13 (15 «مثال: » keys) · N2 (`CircleGate`
blanking to a full-screen error on an offline refetch when cached data exists).

Two consolidations worth queuing separately, both standing-law drift rather than bugs:
`figma-tasks.tsx` still carries its own inline `BottomSheet` + `SheetButton` (a second sheet
chrome and a second button primitive in a feature file), and `timezone-picker.tsx` is a
fifth hand-rolled sheet chrome. Neither is an OS dialog, so neither was in F16's scope.
