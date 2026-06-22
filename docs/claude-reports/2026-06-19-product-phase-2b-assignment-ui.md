# Product Phase 2B — Assignment / Responsibility UI

**Date:** 2026-06-19
**Type:** Product feature implementation (frontend + minimal generated-type patch).
**Mode:** Edit. **No commit. No stage.** No Supabase CLI / SQL / RLS / backend / notification-engine / EAS / prebuild / dependency / Expo-config / `.env` changes.
**Baseline:** branch `master`, working tree **clean** at start (gate `git --no-pager status --short` → empty), HEAD `42696a8 docs(product): audit assignment responsibility model` (the Phase 2A audit).
**Predecessor:** `docs/claude-reports/2026-06-19-product-phase-2a-assignment-audit.md` (read & followed).

---

## 0. Headline

Phase 2A's plan is now wired into the UI. A **single shared component file** (`src/features/circle-members/member-assignment.tsx`) provides a reusable **`MemberSelect`** picker and a **`useMemberLookup`** name resolver; every entity now lets managers choose a responsible person and shows that person's name in lists / detail / read-only views. The **task-editor assignment-wipe bug is fixed.** All four validations are green (**tsc 0 · mojibake clean (261 files) · diff-check 0 · expo-doctor 21/21**). 19 files touched (18 modified + 1 new), `+284 / −40`.

---

## 1. Confirmation — user manually applied the Phase 2A SQL first

Confirmed per the task instructions: the user **manually applied** the Phase 2A migration SQL in the correct Sanad Supabase **Dashboard**, and both scripts ran without errors:
- `care_appointments.assigned_to` (uuid → profiles, `on delete set null`, indexed, manager INSERT/UPDATE active-member guard).
- `medications.responsible_user_id` (uuid → profiles, `on delete set null`, indexed, manager INSERT/UPDATE active-member guard).

This phase relies on those columns already existing in the live database. No verification query was run by me (no DB access used).

## 2. Confirmation — no Supabase CLI commands were run

Confirmed. **None** of the forbidden commands were run: `supabase login` / `logout` / `link` / `db push` / `migration` / `functions deploy` / `gen types` — nor any other Supabase CLI command. Generated types were **hand-patched** (next section) exactly as instructed, not regenerated via CLI. No `.env`/secret was inspected. No other project was touched.

## 3. Exact type patch made (`src/types/supabase.ts`)

A minimal, surgical patch to the two tables only — Row / Insert / Update + the matching FK `Relationships` entry (mirroring the generator's own output). Nothing else was reordered or rewritten.

**`care_appointments`** — added in alphabetical position (after `appointment_type`):
- `Row`: `assigned_to: string | null`
- `Insert`: `assigned_to?: string | null`
- `Update`: `assigned_to?: string | null`
- `Relationships`: `{ foreignKeyName: "care_appointments_assigned_to_fkey", columns: ["assigned_to"], isOneToOne: false, referencedRelation: "profiles", referencedColumns: ["id"] }`

**`medications`** — added in alphabetical position (after `photo_url`):
- `Row`: `responsible_user_id: string | null`
- `Insert`: `responsible_user_id?: string | null`
- `Update`: `responsible_user_id?: string | null`
- `Relationships`: `{ foreignKeyName: "medications_responsible_user_id_fkey", columns: ["responsible_user_id"], isOneToOne: false, referencedRelation: "profiles", referencedColumns: ["id"] }`

(`care_tasks.assigned_to` and `family_visits.visitor_user_id` were already present in the generated types — no patch needed.)

## 4. Exact files changed (19)

**New (1)**
- `src/features/circle-members/member-assignment.tsx` — shared `MemberSelect` picker, `useMemberLookup` resolver, `NO_ASSIGNEE` sentinel, `ResolvedMember` type, `DOER_ROLES` allow-list.

**Type (1)**
- `src/types/supabase.ts` — the §3 patch.

**Locale (2)** — line-parallel
- `src/locales/ar.json`, `src/locales/en.json` — new top-level `assignment` block (`responsible`, `label`, `none`, `me`, `assignedToMe`, `inactiveMember`, `unknownMember`) + `visits.linkedToLabel` + `visits.fields.linkToMember`.

**Tasks (2)**
- `src/features/tasks/task-editor.tsx` — wipe-bug fix (toggle → `MemberSelect`) + responsible row in read-only view.
- `src/features/tasks/figma-tasks.tsx` — list row shows the real assignee name.

**Appointments (5)**
- `src/features/appointments/api.ts` — `AppointmentInput.assigned_to`.
- `src/features/appointments/appointment-fields.tsx` — draft `assignedTo` (default / fromRow / `prepareAppointment` output).
- `src/features/appointments/figma-appointment-fields.tsx` — `circleId` prop + responsible `MemberSelect` card.
- `src/features/appointments/appointment-form.tsx` — passes `circleId`.
- `src/features/appointments/figma-appointments.tsx` — responsible name on list cards + editor view (via editor file below).
- `src/features/appointments/appointment-editor.tsx` — passes `circleId` to the fields; responsible row in read-only view.

**Medications (4)**
- `src/features/medications/api.ts` — `MedicationInput.responsible_user_id`.
- `src/features/medications/medication-form.tsx` — responsible `MemberSelect` + payload.
- `src/features/medications/medication-editor.tsx` — manager `MemberSelect` + read-only responsible row.
- `src/features/medications/figma-medications.tsx` — responsible name on the "all" medication rows.

**Visits (3)**
- `src/features/visits/visit-form.tsx` — managers get a `MemberSelect` link (any active doer); collaborators keep forced self-link.
- `src/features/visits/visit-editor.tsx` — managers can relink via `MemberSelect`; read-only view shows the linked member.
- `src/features/visits/figma-visits.tsx` — list shows the linked member when it isn't the current user.

## 5. Task-editor wipe-bug fix (explanation)

**The bug (Phase 2A finding R1):** `TaskEditScreen` represented assignment as a single **"assign to me" toggle**, initialised `assignToMe = (assigned_to === userId)` and saved `assigned_to: assignToMe ? userId : null`. So opening a task that was assigned to **another member** initialised the toggle to **off**, and saving any edit **silently overwrote that member's assignment with `null`** — destroying coordination data the moment assignment became meaningful.

**The fix:** the toggle is replaced with the shared `MemberSelect`, seeded from the task's real assignee:
```tsx
const [assignedTo, setAssignedTo] = useState(initial.assigned_to ?? '');
// …
assigned_to: assignedTo === '' ? null : assignedTo,
```
Now the editor shows and preserves whoever is actually assigned; a manager can reassign to any active doer, or clear it — no silent data loss. `useUnsavedChanges` tracks `assignedTo` (was `assignToMe`); the now-unused self-`userId` derivation and `FigmaToggleRow` import were removed. Save / status / delete logic is otherwise untouched. (RLS still authoritative: the manager UPDATE policy validates a non-null assignee is an active circle member.)

## 6. Per-entity assignment UI implementation summary

**Shared (`MemberSelect`)** — a single-choice teal chip group over `useCircleMembers(circleId)`. Options: **Unassigned** (`''`) → **Me** (only when the current user is an active doer) → every other **active doer** by name. "Doer" = `admin | primary_caregiver | family_member`; `remote_member`/`elder`/`caregiver` are excluded (follow-up / server-unassignable). If the stored value is a member who is no longer an active doer (role changed / left), it is still appended (with a "former member" suffix) so the assignment **never disappears from the picker**. Email is used only as a last-resort label, matching the pre-existing task picker.

- **Tasks** — *Add form:* unchanged (kept its existing real-member picker, per the task). *Editor:* now the shared `MemberSelect` (§5). *Permissions:* the existing collaborator complete/cancel gating (`assigned_to === me || null`) is preserved.
- **Appointments** — `assigned_to` threaded through `AppointmentInput` → draft (`assignedTo`) → `prepareAppointment`. A "Responsible person" `MemberSelect` card was added to the shared `FigmaAppointmentFields` (so it appears in **both** the add form and the editor). Mutation rights unchanged (managers only).
- **Medications** — `responsible_user_id` added to `MedicationInput`. A "Responsible person" `MemberSelect` card was added to the add form and to the editor's info section. **Schedule editing and dose logging are untouched.**
- **Visits** — uses the existing `visitor_user_id` as the responsible/linked member. *Managers:* the old self-only toggle became a `MemberSelect` that can link the visit to **any active doer** (or no one). *Collaborators:* unchanged — still forced to self-link (`visitor_user_id = auth.uid()`), which is what their RLS requires. The editor preserves a collaborator's own link and lets managers relink.

## 7. Responsible-name display summary (`useMemberLookup`)

A resolver maps a stored user id → a **safe display name**: self → **"أنا / Me"**, an active member → **full name**, an unknown / since-removed id → a neutral **"عضو / Member"** (never an email — avoids leaking it on broadcast surfaces). Returns `null` for an unassigned id.

- **Tasks list** (`figma-tasks`): the row's assignment line now shows the real assignee name (self still reads "assigned to you"; unassigned unchanged) instead of the generic "assigned to a member".
- **Task read-only detail**: a "Responsible" row (name or "Unassigned").
- **Appointments**: list cards show a `Users`-icon responsible row; the read-only detail shows a "Responsible" row when assigned.
- **Medications**: the "all" tab rows show a `Users`-icon responsible line; the read-only info shows a "Responsible" row when set.
- **Visits**: list cards show the linked member's name when it isn't the current user (self still shows "Your visit"); read-only detail shows a "Linked to" row.

## 8. Confirmation — save / delete / status / schedule behavior preserved

Confirmed. No mutation, query, validation schema, or status/delete flow was altered:
- **Tasks:** `taskSchema` validation, complete/cancel transitions, two-step delete, and the collaborator action gating are unchanged; only how `assigned_to` is chosen in the editor changed.
- **Appointments:** `prepareAppointment`/`appointmentSchema`, status transitions, doctor/type/date handling, and delete are unchanged; `assigned_to` is an added optional field on the existing input.
- **Medications:** `medicationSchema`, the create-medication-with-schedule flow, **schedule add/edit/activate/delete**, **dose logging** (`useLogDose`), activation toggle, and delete are all unchanged; `responsible_user_id` is an added optional field on the existing medication input only.
- **Visits:** `prepareVisit`/`visitSchema`, status transitions, and delete are unchanged; only the visitor-account selection UI changed (and a collaborator's own-link behavior is preserved).

No `*.add` / `common.saveChanges` CTA keys were changed; every save CTA is still the body-rendered filled-teal `FigmaFooterPrimaryButton`.

## 9. Confirmation — out-of-scope items NOT implemented

Confirmed not implemented in this phase (as required):
- **Notifications** — no event producer, no `enqueue_notification` call, no engine change.
- **Escalation / overdue** — none.
- **"أنا متكفل" self-claim** — no `claim_*` RPC, no claim button.
- **WhatsApp / contact import** — none.
- **Prayer-time logic** — none.

No SQL / RLS / migration / Supabase-function / schema / navigation-path / dependency / Expo-config change was made.

## 10. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** — the type patch + all new fields/props typecheck cleanly |
| `npm run check:mojibake` | **clean** — 261 active files, no signatures (incl. the new Arabic `assignment` strings) |
| `git -c core.autocrlf=false diff --check` | **exit 0** |
| `npx expo-doctor` | **21/21 checks passed** |

`git diff --stat`: **18 files changed, +284 / −40** (plus the 1 new untracked component). `git status --short`: 18 ` M` + `?? src/features/circle-members/member-assignment.tsx`.

## 11. Android QA checklist

Test in **dark + light**, RTL/Arabic, as **manager** and as **collaborator (family_member)**:

1. **Tasks — add**: assignee picker shows Unassigned / Me / active members; "إضافة مهمة" CTA still teal/visible; saving sets the assignee.
2. **Tasks — edit (the bug fix)**: open a task assigned to **another** member → the picker shows **that member** (not "off"); save without touching it → assignment is **preserved** (previously wiped). Reassign to someone else → persists. Clear → becomes Unassigned.
3. **Tasks — list**: rows show the real assignee name; your own tasks read "assigned to you"; unassigned reads "Unassigned".
4. **Tasks — read-only (non-manager)**: a "Responsible" row appears.
5. **Appointments — add & edit**: a "Responsible" picker card appears; saving persists `assigned_to`; status (complete/cancel/reopen), doctor, type, date, and delete all still work.
6. **Appointments — list/detail**: a `Users`-icon responsible line shows when assigned.
7. **Medications — add & edit**: a "Responsible" picker appears; **schedules** (add/edit/activate/delete) and **dose logging** behave exactly as before; saving persists `responsible_user_id`.
8. **Medications — list ("all" tab) / read-only**: responsible name shows when set.
9. **Visits — add as manager**: the member link selector can link to me **or another active member**, or no one; the visit saves with the right `visitor_user_id`.
10. **Visits — add as collaborator**: no selector; the visit is still auto-linked to self (own-visit RLS holds).
11. **Visits — edit**: managers can relink; a collaborator editing their own visit keeps their link; read-only detail shows "Linked to <name>" and the free-text visitor name is still shown.
12. **Inactive/unknown assignee**: a member removed after assignment still shows their name (resolver) with a "former member" suffix in the picker; lists fall back to a neutral "Member" for unknown ids — no email leakage.
13. **Cross-cutting**: all primary CTAs filled teal; RTL intact; no mojibake.

## 12. No commit / no stage

Confirmed: **nothing was committed or staged.** The working tree holds only the changes above. Stopping here per instructions (report + status + diffs shown).
