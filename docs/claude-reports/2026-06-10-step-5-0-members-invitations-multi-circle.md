# Step 5.0 — Care-circle members, secure invitations & multi-circle switching

Date: 2026-06-10
Branch: `master` (not committed — see “Safe to commit?” below)

This step turns Sanad from a single-circle app into a real family-collaboration
system: secure one-time invitations, role-enforced membership management,
belonging to more than one care circle and switching between them, plus a
weekday-selector UX fix.

---

## 1. Existing schema / enum findings (inspection before implementation)

Confirmed from `supabase/migrations/20260607033000_initial_core_schema.sql` and
`src/types/supabase.ts` (no remote introspection was run):

- **`public.circle_role`** enum: `admin`, `primary_caregiver`, `family_member`,
  `caregiver`, `remote_member`, `elder`. **No new role values were added.**
- **`public.member_status`** enum: `active`, `invited`, `removed`. There is **no
  `inactive` value** — this step uses `removed` to mean “left / deactivated”.
- **`public.circle_members`**: `id, circle_id, user_id, role default
  'family_member', status default 'active', created_at, updated_at`,
  `unique (circle_id, user_id)`.
- **`public.care_circles`**: has `owner_id` (the bootstrapping admin).
- **`public.profiles`**: `id, full_name, avatar_url, phone, locale, dialect`.
  Email lives in `auth.users`, not `profiles`.
- **No `invitations` table existed** (clean slate — nothing to reconcile).
- Existing RLS helpers (all `SECURITY DEFINER`, schema-qualified):
  `is_circle_member`, `has_circle_role` (`search_path = public`);
  `is_user_circle_member`, `is_active_user_circle_member`, `is_circle_doctor`,
  `is_circle_medication*` (`search_path = ''`).
- **Manager set is consistently `{admin, primary_caregiver}`** in every existing
  policy — reused unchanged here.
- The atomic `create_care_circle` RPC (`SECURITY DEFINER`, `search_path = ''`)
  is the established template and was mirrored exactly.

**Recursion / ambiguity review of `circle_members` policies:** the existing
SELECT/INSERT/UPDATE policies rely on `is_circle_member` / `has_circle_role`,
which are `SECURITY DEFINER` and therefore do **not** recurse through RLS. No
recursion or ambiguity was found; **no changes were required** to existing
`circle_members` policies. All new sensitive membership writes go through
`SECURITY DEFINER` RPCs (which run as owner and bypass RLS), so no new permissive
INSERT/UPDATE policies were needed.

---

## 2. Summary

- New table `public.circle_invitations` storing only a **SHA-256 hash** of each
  one-time code; RLS enabled with **no policies** (RPC-only access).
- Code helpers using **core `pg_catalog` `sha256` + `gen_random_uuid()`** — no
  `pgcrypto` schema dependency, so everything resolves under `search_path = ''`.
- Eight `SECURITY DEFINER` RPCs for the sensitive operations
  (create/accept/revoke/list invitations; list/role/status/leave for members),
  each enforcing auth, active-membership, a role hierarchy, and **last-admin
  protection**.
- A `circle-selection` provider that loads **all** active memberships, persists
  the chosen circle (web `localStorage` / native `SecureStore`), validates it,
  refetches circle-scoped data on switch, and backs the existing
  `useActiveCircle()` / `CircleGate` so no per-screen changes were needed.
- New screens: `/circle-members`, `/circle-members/invite`,
  `/circle-members/invitations`, `/join-circle`, plus a circle switcher on Home
  and Account and a “join with code” entry on onboarding.
- Reusable `WeekdaySelector` with **opt-in** selection (new schedules start with
  zero days) and an explicit **Every day** toggle.
- Manual `src/types/supabase.ts` additions for the new table, enum and RPCs.

---

## 3. Files created

Migrations:
- `supabase/migrations/20260610130000_create_circle_invitations.sql`
- `supabase/migrations/20260610130100_create_membership_invitation_rpcs.sql`
- `supabase/migrations/20260610130200_lock_down_membership_and_ownership.sql` *(hardening pass)*

Dashboard SQL (complete, ready-to-paste concatenation):
- `docs/claude-reports/2026-06-10-step-5-0-dashboard-complete.sql` *(hardening pass)*

Client — circle selection / multi-circle:
- `src/features/circle-selection/api.ts`
- `src/features/circle-selection/permissions.ts`
- `src/features/circle-selection/storage.ts`
- `src/features/circle-selection/provider.tsx`
- `src/features/circle-selection/hooks.ts`
- `src/features/circle-selection/circle-switcher.tsx`

Client — members:
- `src/features/circle-members/api.ts`
- `src/features/circle-members/permissions.ts`
- `src/features/circle-members/hooks.ts`
- `src/features/circle-members/members-manager.tsx`

Client — invitations:
- `src/features/invitations/api.ts`
- `src/features/invitations/share.ts`
- `src/features/invitations/hooks.ts`
- `src/features/invitations/invite-form.tsx`
- `src/features/invitations/invitations-list.tsx`
- `src/features/invitations/join-form.tsx`

Routes:
- `src/app/(app)/circle-members/_layout.tsx`
- `src/app/(app)/circle-members/index.tsx`
- `src/app/(app)/circle-members/invite.tsx`
- `src/app/(app)/circle-members/invitations.tsx`
- `src/app/(app)/join-circle.tsx`

Components:
- `src/components/weekday-selector.tsx`

Report:
- `docs/claude-reports/2026-06-10-step-5-0-members-invitations-multi-circle.md`

---

## 4. Files modified

- `src/providers/index.tsx` — composed `CircleSelectionProvider` innermost.
- `src/features/care-circle/api.ts` — dropped the single-circle resolver; keeps
  `createCareCircle`; re-exports `CircleSummary` from circle-selection.
- `src/features/care-circle/hooks.ts` — `useActiveCircle` / `canManageCircle` /
  `canLogDoses` / `ActiveCircle` now re-exported from circle-selection;
  `useCreateCareCircle` invalidates the circle list.
- `src/features/care-circle/circle-dashboard.tsx` — takes `ActiveCircle`, renders
  the `CircleSwitcher`, adds a **Members** card.
- `src/features/care-circle/onboarding-form.tsx` — adds **Join with an
  invitation code**.
- `src/app/(app)/(tabs)/index.tsx` — Home driven by `useCircleSelection`.
- `src/app/(app)/(tabs)/account.tsx` — adds the switcher, **Members**, and
  **Join another circle**.
- `src/app/(app)/_layout.tsx` — registers `circle-members` and `join-circle`.
- `src/features/recipient-profile/hooks.ts` — invalidates the circle-selection
  list after a recipient edit (the switcher shows the recipient name).
- `src/features/medications/schedule-fields.tsx` — new schedule defaults to **no**
  weekdays; uses `WeekdaySelector`.
- `src/locales/en.json`, `src/locales/ar.json` — new keys (parity verified).
- `src/types/supabase.ts` — manual type additions (section 13).

---

## 5. Migration files (apply order)

Local idempotent migration files:

1. `supabase/migrations/20260610130000_create_circle_invitations.sql`
2. `supabase/migrations/20260610130100_create_membership_invitation_rpcs.sql`
3. `supabase/migrations/20260610130200_lock_down_membership_and_ownership.sql`

---

## 6. Exact SQL to run manually (Sanad Dashboard → SQL Editor)

Apply the single complete artifact:

**`docs/claude-reports/2026-06-10-step-5-0-dashboard-complete.sql`**

It is the **verbatim, in-order concatenation of all three migration files** above
(no summaries, no omissions, no placeholders, no “paste from repository”
instructions), followed by a trailing `notify pgrst, 'reload schema';`. Paste the
whole file into the SQL Editor and run it once. Ordered contents:

1. **Part 1** — `invitation_status` enum + `circle_invitations` table + RLS
   (enabled, **no policies** → RPC-only) + code helpers
   (`normalize_invitation_code`, `hash_invitation_code`,
   `generate_invitation_code`).
2. **Part 2** — all invitation/member RPCs: `active_circle_member_role`,
   `create_circle_invitation`, `accept_circle_invitation`,
   `revoke_circle_invitation`, `list_circle_invitations`, `list_circle_members`
   (email privacy + `is_owner`), `update_circle_member_role`,
   `update_circle_member_status`, `leave_care_circle` — all with the manager
   null-guard **and** the owner guards.
3. **Part 3** — `circle_members` / `care_circles` direct-mutation lockdown
   (section 22) and `transfer_circle_ownership`.
4. `notify pgrst, 'reload schema';`

Every statement is idempotent and safe to re-run (section 7). The three source
migration files under `supabase/migrations/` are the same SQL, split for the repo.

## 7. Idempotency / safe-to-re-run confirmation

- **Enum**: created only if absent (`pg_type`/`pg_namespace` guard).
- **Table**: `create table if not exists` + `add column if not exists` per column.
- **Indexes**: `create index if not exists` (incl. the unique code_hash index).
- **Trigger**: `drop trigger if exists` then `create trigger`.
- **RLS**: `enable row level security` is a no-op if already enabled.
- **Functions**: all `create or replace`, with `revoke`/`grant` re-asserted.
- **Policy lockdown (Part 3)**: `drop policy if exists` + idempotent `revoke
  update` — re-running yields the same end state.
- **No data writes**, no destructive `drop table`/`drop type`/`alter type`.

All three files (and the concatenated complete file) were authored to be
re-runnable any number of times with identical end state.

---

## 8. Invitation-code security design

- **One-time codes.** Raw code = 10 chars from a 31-char unambiguous alphabet
  (`ABCDEFGHJKMNPQRSTUVWXYZ23456789` — no `0/O/1/I/L`), grouped `XXXXX-XXXXX`
  (~49.5 bits of entropy). Randomness comes from core `gen_random_uuid()`.
- **Only the hash is stored.** `code_hash = encode(sha256(convert_to(normalized,
  'UTF8')),'hex')`, where `normalize_invitation_code` strips all non-alphanumerics
  and upper-cases. Comparison is therefore **case-insensitive and
  whitespace/dash-insensitive**. The DB never stores or can recover the raw code.
- **Raw code returned exactly once**, by `create_circle_invitation`, to the
  inviter; the UI shows it once with a “can’t be retrieved later” warning.
- **No pgcrypto dependency.** `sha256`, `convert_to`, `encode`, `decode`,
  `get_byte`, `gen_random_uuid` are all `pg_catalog`, so the functions are safe
  under `search_path = ''` regardless of which schema pgcrypto lives in.
- **Atomic, replay-safe acceptance.** `accept_circle_invitation` does
  `SELECT … FOR UPDATE` on the invitation row, validates status + expiry, then
  inserts/reactivates membership and marks the invitation `accepted` in one
  transaction. Concurrent accepts serialize on the row lock; the loser re-reads
  `accepted` and is rejected. The `circle_members (circle_id,user_id)` unique
  constraint is the final backstop against duplicate membership.
- **Expiration**: default **7 days** (column default + RPC). `accept` rejects
  past-due invitations; `list_circle_invitations` shows past-due `pending` rows
  as `expired` at display time.
- **Codes are never logged** anywhere (no `console.log` of codes; `share.ts`
  doesn’t log).

---

## 9. RPCs and authorization rules

Managers = `{admin, primary_caregiver}`. Every RPC: requires `auth.uid()`,
resolves the caller’s **active** role in the *target row’s circle* via
`active_circle_member_role`, and is `SECURITY DEFINER, search_path=''`,
`revoke from public` + `grant to authenticated`.

| RPC | Who | Rules |
|---|---|---|
| `create_circle_invitation` | manager | `admin` never invitable; a `primary_caregiver` cannot grant `primary_caregiver`; an `admin` may grant any non-admin role. Returns raw code once. |
| `accept_circle_invitation` | any authed user | normalizes+hashes code; rejects invalid/expired/revoked/used; rejects an already-active member cleanly (without consuming the code); else inserts/reactivates membership and marks `accepted`. |
| `revoke_circle_invitation` | manager of that circle | only `pending` invitations. |
| `list_circle_invitations` | manager of that circle | safe columns only — **never** `code_hash`. |
| `list_circle_members` | any active member | roster (active+inactive) with name, role, status, `is_self`, `is_owner`; **email only to managers + self** (section 24). |
| `update_circle_member_role` | manager | only `admin` may grant `admin` or modify an admin; a `primary_caregiver` may not grant manager roles nor modify a manager peer; **cannot demote the last active admin**; **cannot demote the circle owner** until ownership is transferred. |
| `update_circle_member_status` | manager | statuses `active`/`removed`; only `admin` may change an admin’s status; a `primary_caregiver` may not change a manager peer’s status; **cannot remove the last active admin**; **cannot remove the circle owner** until ownership is transferred. |
| `leave_care_circle` | self (active member) | sets own status `removed`; the **last active admin cannot leave**; the **circle owner cannot leave** until ownership is transferred. |
| `transfer_circle_ownership` | current owner only | new owner must be an active member; they become `admin`; `care_circles.owner_id` is moved atomically (section 23). |

**Self-leave decision:** supported via `leave_care_circle` for any active
member, except the final administrator and the circle owner. Members can also be
removed by managers via `update_circle_member_status`.

> **Hardening passes (post-review):** the manager null-guard, the owner guards,
> `transfer_circle_ownership`, the `circle_members`/`care_circles` direct
> create/mutate lockdown, member-email privacy, the canonical circle-first lock
> order, and the caregiver/elder least-privilege deferral were added in follow-up
> hardening passes — see **sections 22–27** (those are the authoritative final
> state where they differ from earlier prose).

---

## 10. Tables / RLS policies added or changed (FINAL state)

- **Added** `public.circle_invitations` with **RLS enabled and no data policies**
  → all direct client access denied; access is exclusively through the
  `SECURITY DEFINER` RPCs (even a manager’s client never selects `code_hash`).
- **`circle_members` — locked down** (section 22): the initial-schema **INSERT**
  (`"Circle owners can add initial membership"`) and **UPDATE** (`"Circle admins
  can manage members"`) policies are **DROPPED**; only the **SELECT** policy
  (`"Users can view members in their circles"`) remains, and `insert/update/delete`
  are also **revoked** from `anon, authenticated`. All membership writes go
  through the RPCs.
- **`care_circles` — locked down** (section 22): the **INSERT** (`"Users can
  create their own circles"`) and **UPDATE** (`"Circle admins can update
  circles"`) policies are **DROPPED**; `insert/update/delete` **revoked** from
  `anon, authenticated`; the two **SELECT** policies are kept. Creation goes
  through `create_care_circle`; `owner_id` changes only through
  `transfer_circle_ownership`.
- **`profiles` RLS left unchanged.** Member identity (incl. email from
  `auth.users`) is exposed only through `list_circle_members`, scoped to active
  members of the circle, and **email is gated to managers + self** (section 24).

---

## 11. Final-admin protections (defense in depth)

Enforced server-side in `update_circle_member_role`, `update_circle_member_status`
and `leave_care_circle` by counting *other* active admins before a demote/remove/
leave; the UI also hides the role-change and remove controls for the last active
admin and shows an explanatory note. A circle therefore always retains ≥1 active
admin.

---

## 12. Multi-circle selection / persistence design

- `fetchUserCircles(userId)` returns **all active memberships** (circle +
  recipient names + role), three RLS-passing reads joined in memory.
- `CircleSelectionProvider` (inside Auth + Query providers) owns:
  `circles`, `activeCircle`, `activeCircleId`, `setActiveCircle`,
  `setPreferredCircleId`, `hasNoCircles`, `isLoading/isError/refetch`.
- **Active resolution**: persisted id **if still an active membership**, else the
  oldest membership (`circles[0]`, ordered by join date — deterministic), else
  none. A stale stored id is **ignored, never rewritten**, so a just-joined
  circle preference is honored as soon as it appears (no clobbering race).
- **Persistence**: namespaced per user (`sanad_active_circle_<uid>`) — web
  `localStorage`, native `SecureStore`; all best-effort (failure → in-memory).
- **Switching** invalidates **all** queries; every circle-scoped query key
  already includes `circle_id`, so no data bleeds across circles.
- `useActiveCircle()` and `CircleGate` are unchanged in shape and now read the
  selected circle — the ~25 existing detail screens picked up multi-circle
  support with **zero call-site changes**.

---

## 13. Manual Supabase type changes (`src/types/supabase.ts`)

- Added `Tables.circle_invitations` (`Row`/`Insert`/`Update`/`Relationships` for
  `circle_id`→`care_circles`, `created_by`/`accepted_by`→`profiles`).
- Added `Enums.invitation_status` (`"pending" | "accepted" | "revoked" |
  "expired"`) and the matching `Constants.public.Enums.invitation_status` array.
- Added `Functions` entries (Args + Returns) for all ten RPCs:
  `accept_circle_invitation`, `active_circle_member_role`,
  `create_circle_invitation`, `leave_care_circle`, `list_circle_invitations`,
  `list_circle_members`, `revoke_circle_invitation`,
  **`transfer_circle_ownership`**, `update_circle_member_role`,
  `update_circle_member_status`.
- `list_circle_members` Returns reflects the final hardened shape: **`email:
  string | null`** (nullable — managers/self only) and **`is_owner: boolean`**
  (plus `is_self: boolean`).

These were hand-written to match the migration shapes (remote type generation
was **not** run). Verified present & consistent: the typed `supabase.rpc(...)`
calls compile with no casts hiding missing RPC types (`tsc --noEmit` → exit 0).

---

## 14. Existing-screen permission changes

Permission awareness flows through the role-aware `ActiveCircle`
(`canManage` = admin/primary_caregiver, `canLogDoses` = any caregiving role),
which now reflects the **selected** circle’s role:

- **Members / invitations**: roster viewable by any active member; invite,
  invitations management, role/status changes shown only to managers and only
  where the RPC would allow them (last-admin controls hidden + explained).
- **Recipient profile, emergency contacts, doctors, medications & schedules**:
  unchanged gating via `circle.canManage` (now per active circle).
- **Tasks / appointments / visits / daily logs / vitals**: unchanged gating via
  `circle.canManage` / `circle.canLogDoses`.

RLS/RPCs remain authoritative; the UI only hides what the server would reject.

---

## 15. Weekday-selector changes & audit result

- New reusable `src/components/weekday-selector.tsx`:
  1. New schedule starts with **no** days selected (`defaultScheduleDraft` →
     `days_of_week: []`).
  2. Tapping a day **selects** it; selected = filled + “✓”, unselected = neutral.
  3. Explicit **Every day / كل الأيام** control: selects all 7 when not all are
     selected; clears all when all are.
  4. Days stored `0` (Sun) … `6` (Sat); Arabic ordering/labels preserved (RTL).
  5. ≥1 day required to save (enforced by the existing `scheduleSchema`
     `min(1,'days')`); validation text shown when none selected.
  6. Editing preserves stored days (`scheduleToDraft` unchanged).
- **Audit result**: a project-wide search (`days_of_week`, array toggles,
  `new Set(`, `.includes(index)`) found the **medication weekday selector was the
  only multi-select with deselect-by-default semantics**. `OptionSelect`
  (category/priority/type/mood/doctor/role) is single-choice and was **not**
  touched; boolean `Switch`es default off and are correct. No other inverted
  control exists.

---

## 16. Commands run

- Locale parse + key parity (node script): **624 = 624 keys, PARITY OK**.
- `npx tsc --noEmit`: **exit 0** (no errors).
- `npx expo export --platform web`: **exit 0** (`Exported: dist`); new routes
  `/circle-members`, `/circle-members/invite`, `/circle-members/invitations`,
  `/join-circle` all present in the output.
- `git status --short`, `git diff --stat` (see section 20).

No Supabase CLI command was run (see section 21).

---

## 17. Adversarial review — findings & fixes

1. **CRITICAL (fixed): authorization bypass via NULL role.** Manager gates of the
   form `if active_circle_member_role(...) not in ('admin','primary_caregiver')
   then raise` are unsafe: a non-member / cross-circle caller gets `NULL`, and
   `NULL not in (...)` is `NULL` (not `true`), so the `raise` is **skipped**.
   This would have let a non-member revoke/list/role/status across circles. **Fixed**
   in `revoke_circle_invitation`, `list_circle_invitations`,
   `update_circle_member_role`, `update_circle_member_status` by capturing the
   role and guarding `if v_actor is null or v_actor not in (...)`.
   (`create_circle_invitation` and `list_circle_members` already had explicit
   `is null` checks; `leave_care_circle` relies on a `status='active'` lookup.)
2. **Privilege escalation** — none: `admin` is never invitable; only an `admin`
   may grant/modify `admin`; a `primary_caregiver` can’t grant manager roles or
   modify a manager peer; verified for self-promotion too.
3. **Final-admin protection** — verified for demote, remove/deactivate, and
   self-leave; counts *other* active admins excluding the target.
4. **Invitation replay / race** — `FOR UPDATE` lock + status check + single
   transition to `accepted`; unique `(circle_id,user_id)` backstop. Verified the
   loser of a concurrent accept re-reads `accepted` and is rejected.
5. **Code hashing / expiration** — only SHA-256 hash stored; raw code returned
   once; 7-day expiry enforced; ~49.5-bit entropy; codes never logged.
6. **Cross-circle access** — every RPC keys off the row’s circle and checks the
   caller’s membership there; `circle_invitations` is RPC-only (RLS, no policies).
7. **Query-cache mixing** — all circle-scoped keys include `circle_id`; switch
   invalidates all queries; no per-circle bleed.
8. **Permissions/UI mismatch** — UI mirrors the RPC rules and degrades to a clear
   message if the server rejects; RPC remains authoritative.
9. **Weekday selector new/edit** — verified empty-on-new, preserve-on-edit,
   Every-day toggle, zero-day save rejected.
10. **Dead code removed** — a rolled-back `status='expired'` write inside `accept`
    (the subsequent `raise` discards it) was removed; expiry is surfaced at list
    time instead.

---

## 18. Manual test plan (two authenticated accounts)

Apply the complete SQL file first (section 6). Then, with **Account A** (circle owner =
admin) and **Account B** (separate user):

1. **A** → Account/Home → Members → **Invite member**, pick a collaboration role
   (e.g. Family member), create. The raw code is shown once.
2. **A** copies/shares the code (Copy on web; Share sheet on native).
3. **B** → onboarding “Join with an invitation code” **or** Account → “Join
   another circle” → enter the code → **Join**. B lands on the new circle.
4. **B** tries the **same code again** → rejected (“already been used”).
5. **B** can view permitted circle data (medications, tasks, logs, members…).
6. **B** sees **no** manager-only actions (no add/edit/delete on managed data; no
   invite/role/status controls on Members).
7. **A** → Members → change B’s role / deactivate-reactivate B → succeeds; B’s
   view updates.
8. Try to remove/deactivate/demote the **only admin (A)** → blocked with the
   last-admin message (control hidden in UI; RPC also rejects).
9. **B** creates or is invited to a **second** circle; the **switcher** (Home /
   Account) lets B switch between circles.
10. After switching, confirm data shown is only the selected circle’s (no mixing).
11. **Medication schedule** (manager): open Add medication →
    - initially **no** weekdays selected,
    - tap specific days → they select (filled + ✓),
    - **Every day** selects all 7; tapping it again clears all,
    - saving with **zero** days is rejected (“Choose at least one day”),
    - edit an existing schedule → its saved days are preserved.

---

## 19. Known risks / assumptions

- **pgcrypto avoided on purpose** — hashing/randomness use only `pg_catalog`
  builtins (PostgreSQL 11+ `sha256`; `gen_random_uuid`). Supabase (PG 15+)
  satisfies this.
- **Member email visibility (final)**: `list_circle_members` returns a
  co-member’s email **only to managers and to the member themselves**; other
  members receive `null` (section 24). Name/role/status stay visible to active
  members.
- **caregiver / elder roles deferred**: they remain in the `circle_role` enum but
  **cannot be assigned** — `create_circle_invitation` and
  `update_circle_member_role` reject them and the UI hides them — until their
  dedicated least-privilege RLS is implemented (section 26). Active roles:
  `admin`, `primary_caregiver`, `family_member`, `remote_member`.
- **No DB-level rate limiting** on `accept` guesses; entropy (~49.5 bits) +
  expiry + one-time use make brute force infeasible, and Supabase’s API gateway
  applies request limits. Add an attempt cap later if needed.
- **Local-time** date handling for expiry display is consistent with the rest of
  the app.
- The `add column if not exists` lines are belt-and-suspenders for a partial
  prior run; on a fresh create they are all no-ops.
- The dashboard/account switcher assumes a small number of circles (family
  scale); no pagination.

---

## 20. Git status summary

`git status --short` (nothing committed):

```
 M src/app/(app)/(tabs)/account.tsx
 M src/app/(app)/(tabs)/index.tsx
 M src/app/(app)/_layout.tsx
 M src/features/care-circle/api.ts
 M src/features/care-circle/circle-dashboard.tsx
 M src/features/care-circle/hooks.ts
 M src/features/care-circle/onboarding-form.tsx
 M src/features/medications/schedule-fields.tsx
 M src/features/recipient-profile/hooks.ts
 M src/locales/ar.json
 M src/locales/en.json
 M src/providers/index.tsx
 M src/types/supabase.ts
?? docs/claude-reports/2026-06-10-step-5-0-dashboard-complete.sql
?? docs/claude-reports/2026-06-10-step-5-0-members-invitations-multi-circle.md
?? src/app/(app)/circle-members/
?? src/app/(app)/join-circle.tsx
?? src/components/weekday-selector.tsx
?? src/features/circle-members/
?? src/features/circle-selection/
?? src/features/invitations/
?? supabase/migrations/20260610130000_create_circle_invitations.sql
?? supabase/migrations/20260610130100_create_membership_invitation_rpcs.sql
?? supabase/migrations/20260610130200_lock_down_membership_and_ownership.sql
```

`git diff --stat` (tracked files): 13 files changed, +585 / −265 (untracked new
files/dirs not shown by `--stat`). This count is after the hardening pass.

---

## 21. Safe to commit?

**Not yet.** Per the workflow: this code is **safe to commit after** (a) the
complete SQL file (the three migrations, section 6) is applied manually in the
Sanad Supabase Dashboard SQL Editor and (b) the two-account manual test plan
(sections 18 + 25) passes — especially join, reuse-fails, cross-circle isolation,
last-admin protection, **direct-REST mutation denial, owner-leave/remove/demote
denial, ownership transfer, and member-email privacy**, plus the weekday
new/edit behavior. TypeScript and the web export are green. As instructed, **no
commit was made.**

**Supabase CLI confirmation:** no `supabase login`, `supabase logout`,
`supabase link`, or `supabase db push` was run. No global Supabase CLI account
was touched. Only local idempotent migration files were created, with the exact
SQL provided here for manual application. The developer’s other Supabase project
on this machine is unaffected.

---

## 22. Hardening pass — `circle_members` / `care_circles` direct-mutation lockdown

### 22.1 Exact `circle_members` policies found BEFORE hardening

From `20260607033000_initial_core_schema.sql` (the only place circle_members
policies are defined; no later migration changed them). RLS is enabled; three
policies existed, **no DELETE policy**:

```sql
-- SELECT (kept)
create policy "Users can view members in their circles"
on public.circle_members for select to authenticated
using (public.is_circle_member(circle_id));

-- INSERT (DROPPED)
create policy "Circle owners can add initial membership"
on public.circle_members for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.care_circles cc
              where cc.id = circle_id and cc.owner_id = auth.uid())
);

-- UPDATE (DROPPED)
create policy "Circle admins can manage members"
on public.circle_members for update to authenticated
using      (public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[]))
with check (public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[]));
```

The INSERT/UPDATE policies were the bypass: a manager could `update circle_members
set role='admin'` or `set status='removed'` directly via PostgREST, skipping the
RPCs’ role hierarchy, primary-caregiver limits, last-admin and owner protection.

### 22.2 Exact `circle_members` policies AFTER hardening

Only the SELECT policy remains, and base write privileges are revoked:

```sql
-- KEPT (unchanged)
create policy "Users can view members in their circles"
on public.circle_members for select to authenticated
using (public.is_circle_member(circle_id));

-- INSERT/UPDATE policies dropped; no DELETE policy ever existed; plus:
revoke insert, update, delete on public.circle_members from anon, authenticated;
-- → direct INSERT/UPDATE/DELETE all denied (revoked before RLS is even evaluated).
```

`care_circles` — direct **creation** AND owner_id mutation both closed:

```sql
-- BEFORE:
--   "Users can create their own circles"  (INSERT, check owner_id = auth.uid())  -- DROPPED
--   "Circle admins can update circles"    (UPDATE)                               -- DROPPED
-- AFTER:
drop policy if exists "Users can create their own circles" on public.care_circles;
drop policy if exists "Circle admins can update circles"   on public.care_circles;
revoke insert, update, delete on public.care_circles from anon, authenticated;
-- SELECT policies ("Users can view circles they belong to", "Owners can view
-- their own circles") kept. Creation → create_care_circle RPC; owner_id →
-- transfer_circle_ownership RPC only.
```

### 22.3 How the direct create/mutation bypass is prevented

- **Verified the client never writes these tables** (grep over `src/`: the only
  `circle_members` / `care_circles` calls are `select`s of `id/name/role`; all
  `insert`/`update`/`delete` calls target other feature tables), so the lockdown
  is zero-regression.
- **Direct circle creation is closed too:** `create_care_circle` (definer) is the
  only creation path the client uses, so the INSERT policy + INSERT privilege were
  removed. **No direct client DELETE route** exists for `care_circles` or
  `circle_members` (no DELETE policy, and DELETE privilege revoked).
- After the drops, **every** membership/ownership change must go through a
  `SECURITY DEFINER` RPC — `create_care_circle`, `accept_circle_invitation`,
  `update_circle_member_role`, `update_circle_member_status`,
  `leave_care_circle`, `transfer_circle_ownership` — each of which re-checks
  auth, active membership, role hierarchy, last-admin and owner invariants.
- The RPCs are owned by the table owner, so they continue to write **above** RLS
  and the `care_circles` UPDATE revoke (function owner has full privileges).
- **`create_care_circle` compatibility:** it is `SECURITY DEFINER` and never
  depended on the dropped client policies (it inserts circle/membership/recipient
  as the function owner). Dropping the bootstrap INSERT policy does not affect it.
  Same for `accept_circle_invitation` (definer insert/reactivate).

---

## 23. owner_id invariant and transfer behavior

**Evidence `owner_id` is used for authorization (not purely historical):**
`care_circles` INSERT check `owner_id = auth.uid()` (initial schema) and the
SELECT policy `"Owners can view their own circles" using (owner_id = auth.uid())`
(`20260607224314_create_care_circle_rpc.sql`). So the owner must remain a valid
member — the invariant matters.

**Invariant chosen & enforced:** `care_circles.owner_id` always points at an
**active admin** of the circle. Enforced by:

- `update_circle_member_role`: the owner cannot be demoted out of `admin`
  (`23514` → “transfer ownership first”).
- `update_circle_member_status`: the owner cannot be removed/deactivated.
- `leave_care_circle`: the owner cannot leave.
- `care_circles.owner_id` cannot be changed directly by clients (section 22.2).

**`transfer_circle_ownership(p_circle_id, p_new_owner_user_id)`:**
only the **current owner** may call it; the new owner must already be an **active
member** of the same circle; they are promoted to `admin`; `owner_id` is moved in
the **same transaction** (`SELECT … FOR UPDATE` on the circle row). The old owner
keeps their `admin` role (change it afterwards via `update_circle_member_role`).
After transfer the old owner is an ordinary admin and may then be
demoted/removed/leave (subject to last-admin protection).

**UI:** the members screen shows an **Owner** badge, hides
remove/demote/leave for the owner with an explanatory note
(`circleMembers.ownerNote`), and — for the current owner only — offers a
two-step **Make owner** action on other active members (calls the transfer RPC).

---

## 24. Member email-visibility behavior

`list_circle_members` now gates email per row:

- **Managers** (`admin` / `primary_caregiver`) see every member’s email.
- **Any user** sees **their own** email.
- **Other normal members** receive `null` for another member’s email.
- **Full name, role and status remain visible** to all active members.

Implemented as `case when v_is_manager or cm.user_id = auth.uid() then
u.email::text else null end`. The members UI already only renders the email line
when present, so non-managers simply don’t see co-members’ emails (display name
falls back to name, else a neutral “Member” label). This was tightened from the
original “all active members see all emails”.

---

## 25. Hardening pass — adversarial re-verification & validation

**Re-review (all re-checked after the changes):**

1. **Direct REST mutation bypass** — closed: `circle_members` INSERT/UPDATE
   policies dropped (no DELETE ever existed); `care_circles` client UPDATE
   revoked. All writes go through the audited RPCs.
2. **Final-admin protection** — intact in role/status/leave (counts other active
   admins).
3. **Owner removal/demotion/leave** — newly blocked in role/status/leave; only
   `transfer_circle_ownership` (owner-only) moves ownership; verified the guard
   lands in exactly those three functions and **not** in `accept`.
4. **Privilege escalation** — `admin` not invitable; only `admin` grants/edits
   `admin`; pc cannot grant manager roles or touch manager peers; the NULL-role
   manager-gate bypass (from the first pass) remains fixed with `is null` guards.
5. **Invitation replay/race** — `FOR UPDATE` + status transition + unique
   `(circle_id,user_id)`; unchanged.
6. **Cross-circle access** — every RPC keys off the row’s circle and the caller’s
   active role there; `circle_invitations` is RPC-only.
7. **Normal-member email exposure** — closed (section 24).
8. **`create_care_circle` compatibility** — unaffected (definer; never used the
   dropped policies).
9. **`accept_circle_invitation` compatibility** — unaffected (definer
   insert/reactivate; no owner lookup added to it — verified).
10. **Multi-circle query isolation** — unchanged; keys include `circle_id`,
    switch invalidates.

**Commands run this pass (no commit):**

- Locale parse + key parity: **629 = 629 keys, PARITY OK**.
- `npx tsc --noEmit`: **exit 0**.
- `npx expo export --platform web`: **exit 0** (`Exported: dist`); members/invite/
  invitations/join routes present.
- Completeness check on the concatenated file: all 13 functions + every lockdown/
  owner/email statement present exactly once; `accept` has no owner lookup.

**Complete SQL file:** `docs/claude-reports/2026-06-10-step-5-0-dashboard-complete.sql`
(1035 lines; Parts 1–3 verbatim + `notify pgrst, 'reload schema';`). Re-run after
the third hardening pass (lock order, role deferral, creation lockdown) — see
sections 26–27.

**Added manual tests (run with two accounts after applying the SQL):**

- A direct PostgREST `update circle_members set role='admin'` / `set
  status='removed'` is **rejected** (no policy) — confirm via the REST API or
  that the app has no path to it.
- A direct `update care_circles set owner_id=…` is **rejected** (no UPDATE
  privilege).
- The **owner** cannot leave, be removed, or be demoted (UI hides the actions and
  shows the owner note; the RPC also rejects).
- Owner taps **Make owner** on an active member → ownership transfers, the new
  owner becomes admin, the badge moves; the old owner can then be managed.
- A **non-manager** member viewing the roster sees co-members’ names/roles but
  **null emails**; a **manager** sees emails.

**Supabase CLI confirmation (this pass):** no `supabase login` / `logout` /
`link` / `db push` was run; the global CLI account was not changed; only local
idempotent migration files + the complete SQL artifact were produced. **No commit
was made.**

---

## 26. Role least-privilege decision (caregiver / elder deferred)

**Decision: the safe fallback.** A complete, table-by-table least-privilege RLS
matrix for `caregiver` (limited operational access) and `elder` (simplified
self-care view) is **too risky to land in this pass** — it would touch the
SELECT/INSERT/UPDATE/DELETE policies of every feature table (recipient, emergency
contacts, doctors, medications/schedules/logs, tasks, appointments, visits, daily
logs, vitals) and the member roster, and the current model keys broad read/log
access off `is_circle_member` / `canManage` / `canLogDoses` — which would give
`caregiver`/`elder` more than intended.

So, **server-authoritatively**, these two roles are **not assignable** until that
RLS exists:

- `create_circle_invitation` **rejects** `p_role in ('caregiver','elder')`
  (errcode `42501`, “this role is not available yet”).
- `update_circle_member_role` **rejects** the same.
- The UI hides them: `invitableRoles()` and `assignableRolesFor()` now return only
  `{primary_caregiver (admin-only), family_member, remote_member}` (+ `admin` for
  an admin assigning roles). **This is not UI-only — the RPC enforces it.**
- No member can hold `caregiver`/`elder` (nothing creates them — `create_care_circle`
  only makes an `admin` owner), so their latent access level is moot.

**Active roles and their access (current model, unchanged):** `admin` /
`primary_caregiver` = full control (`canManage`); `family_member` = broad family
access incl. recording care activity (`canLogDoses`); `remote_member` = broad
read access (active membership), not a dose/activity recorder. The enum values
`caregiver`/`elder` are retained for the future; activating them requires a
dedicated least-privilege RLS pass (documented as deferred in the migration and
`src/features/.../permissions.ts`).

---

## 27. Concurrency hardening — serialized admin/owner mutations

### 27.1 The race (before this pass)

`update_circle_member_role` / `_status` / `leave_care_circle` each locked **only
their own `circle_members` row** with `FOR UPDATE`, then counted *other* active
admins. Two concurrent transactions — e.g. demote/remove/leave admin A in T1 and
admin B in T2 — could **each** read the other as still active (neither lock
blocks the other, and the count query takes no locks), both pass the “another
admin exists” check, and both commit → **zero active admins**. The owner guards
had the same shape.

### 27.2 The fix — one canonical lock order

All four owner/admin-count-affecting RPCs now take locks in the **same** order:

1. **Lock the `public.care_circles` row `FOR UPDATE` first.**
   - `leave_care_circle` / `transfer_circle_ownership`: the circle id is supplied.
   - `update_circle_member_role` / `_status`: read the target’s `circle_id`
     *without* locking the member, then lock that circle row.
2. **Then lock / re-read the `public.circle_members` row `FOR UPDATE`**, and
   re-validate it still exists and belongs to that circle (and, for status, the
   expected status).
3. **Run the last-admin and owner checks only while holding the circle lock**, then
   write.

Because every such operation must first acquire the **single** `care_circles` row
lock, they are **serialized per circle**: while T1 holds it, T2 blocks; when T2
proceeds it re-reads a now-accurate admin count (A already demoted) and is
correctly rejected. `transfer_circle_ownership` already used circle-first order
and is unchanged in order.

### 27.3 Why this closes the race and avoids deadlock

- **Serialization:** the admin count / owner status can only change under the
  circle-row lock, so no two admin/owner mutations on the same circle overlap —
  the “both see the other as active” window is gone.
- **No deadlock:** every path locks **circle first, then member** (at most one
  member row), so there is a single global lock order — no lock-ordering cycle.
- **`accept_circle_invitation` is unaffected** and intentionally does **not** take
  the circle lock: it can only add a non-admin member (admin is not invitable, and
  caregiver/elder are rejected), so it never changes the active-admin count.
- **`create_care_circle`** creates a brand-new circle (no concurrency with
  existing admin mutations).

### 27.4 Two-session concurrency test plan (after applying the SQL)

Set up a circle with **two admins** A and B (invite A2 as `family_member`, then —
as the owner — `transfer_circle_ownership` is **not** needed; instead promote a
second member to `admin` via `update_circle_member_role` so there are two
non-owner-independent admins; note the **owner** can’t be the one demoted). Use
two SQL sessions (e.g. two Dashboard SQL tabs, or `psql`) with `BEGIN;` to hold
transactions open:

1. **Concurrent demote of two admins**
   - Session 1: `begin; select public.update_circle_member_role('<adminA_member_id>','family_member');`
     (leave the transaction open — it holds the circle lock).
   - Session 2: `begin; select public.update_circle_member_role('<adminB_member_id>','family_member');`
     → **blocks** on the circle-row lock.
   - Session 1: `commit;`. Session 2 unblocks and **fails** with *“cannot demote
     the last administrator”* (it re-reads the count after A is demoted).
   - Expected end state: exactly one demotion succeeded; ≥1 active admin remains.
2. **Concurrent remove of two admins** — same as (1) using
   `update_circle_member_status(..., 'removed')`; the second errors with *“cannot
   remove the last administrator.”*
3. **Concurrent leave of two admins** — both call `leave_care_circle('<circle>')`
   in open transactions; the second to commit is rejected.
4. **Transfer vs demote** — Session 1 `begin; transfer_circle_ownership('<circle>','<newOwner>')`
   (holds circle lock); Session 2 `update_circle_member_role` on any admin →
   blocks until Session 1 commits, then re-evaluates against the new owner/admin
   set. Confirm the circle always ends with a valid active-admin owner.
5. **Deadlock check** — run (1)–(4) repeatedly with the two sessions started in the
   opposite order; confirm **no** `deadlock detected` error (single lock order).

> Direct-REST checks (no SQL session needed): a PostgREST
> `PATCH /circle_members?id=eq.<id>` (set role/status) and
> `POST /care_circles` (create) and `DELETE` on either table all return a
> permission/RLS error — only the RPCs mutate these tables.
