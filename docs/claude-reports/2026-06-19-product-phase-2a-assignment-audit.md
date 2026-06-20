# Product Phase 2A — Assignment / Responsibility Model: Audit & Implementation Plan

**Date:** 2026-06-19
**Type:** Product / architecture audit (NOT a visual pass).
**Mode:** Read-only audit. **No code changed. Nothing committed or staged. No Supabase CLI command run. No backend / EAS / prebuild / dependency / env changes.**
**Baseline:** branch `master`, working tree **clean** at start (gate `git --no-pager status --short` → empty), HEAD `cb8810e style(ui): apply final Figma copy polish`.
**Goal:** Make "who is responsible" (**المسؤول**) a first-class concept for tasks, appointments, visits, and (if feasible) medications — auditing what already exists, what must change in Supabase (drafted **MANUAL ONLY**), and the safe order to build it.

---

## 0. Headline (TL;DR)

The assignment model is **already half-built and the foundations are excellent.** This is much less work than a greenfield feature.

| Entity | DB assignee column | Set in UI? | Shown to family? | DB change needed? |
|---|---|---|---|---|
| **Tasks** | ✅ `care_tasks.assigned_to` (+ `created_by`, `completed_by`) | ⚠️ **Add form: yes** (real member picker). **Edit screen: self-toggle only** (can't reassign; **wipes** others' assignment — bug). | ⚠️ List shows *me / unassigned / "a member"* (no name). Detail: not shown. | **No** |
| **Visits** | ✅ `family_visits.visitor_user_id` (+ `created_by`) | ⚠️ Self "link to me" toggle only (no member picker). | ⚠️ Shows free-text `visitor_name`, not the linked member. | **No** |
| **Appointments** | ❌ none (only `created_by`) | ❌ none | ❌ none | **Yes — add `assigned_to`** |
| **Medications** | ❌ none (dose logs have `recorded_by` = who acted, not who's responsible) | ❌ none | ❌ none | **Yes — add `responsible_user_id`** (feasible, low risk) |

The **notification & reminder engine already exists end-to-end** (Step 6.0: outbox, per-device push deliveries, prefs, quiet hours, source-revalidation) — including the types `task_due`, `appointment_upcoming`, `visit_update`, `medication_due/missed`. What it lacks is (a) an **event producer** (nothing calls `enqueue_notification` yet) and (b) **assignee-targeted routing** (recipient resolution is currently circle-wide). Assignment is exactly the data foundation those later phases need.

**Two DB changes only** are proposed for Phase 2A, both purely additive/idempotent and **MANUAL ONLY**: `care_appointments.assigned_to` and `medications.responsible_user_id`. Everything else is frontend wiring that can follow.

---

## 1. Current data model findings

### 1.1 Roles & membership (the backbone — `20260607033000_initial_core_schema.sql`)

- Enum `public.circle_role`: `admin`, `primary_caregiver`, `family_member`, `caregiver`, `remote_member`, `elder`.
- Enum `public.member_status`: `active`, `invited`, `removed`.
- `circle_members (id, circle_id, user_id, role, status, …)`, unique `(circle_id, user_id)`. A member references `profiles(id)` → `auth.users(id)`.
- **Security-definer permission helpers** (reused by every table's RLS, no recursion):
  - `is_circle_member(circle_id)` — caller is an active member.
  - `has_circle_role(circle_id, roles[])` — caller is active **and** has one of `roles`.
  - `is_active_user_circle_member(p_circle_id, p_user_id)` and `is_user_circle_member(...)` (any status) — added in the Step 3.1 hotfix (`20260610110000`) to validate a *referenced* user (assignee/visitor) is in the row's circle, fixing an ambiguous-`circle_id` tautology.
  - `active_circle_member_role(circle_id)` — caller's role (or null).

**Critical role nuance (drives everything below):** although the enum has 6 values, the Step 5.0 RPCs (`create_circle_invitation`, `update_circle_member_role`) **hard-reject `caregiver` and `elder`** ("this role is not available yet"). So the **only assignable/active roles today are: `admin`, `primary_caregiver`, `family_member`, `remote_member`.** This is mirrored in TS (`invitableRoles`, `ASSIGNABLE_ROLE_ORDER`, `ROLE_CAPABILITIES`).

- **Managers** = `admin` + `primary_caregiver` (full CRUD everywhere).
- **`family_member`** = the active "collaborator/doer" role (the `caregiver` collaborator role appears in some RLS but is never assignable, so `family_member` is the effective collaborator).
- **`remote_member`** = read/follow-up only; explicitly **excluded from operational reminders** (`medication_due`, `task_due`) in `notification_recipient_eligible`.

### 1.2 Assignment-relevant columns that **already exist**

**`care_tasks` (`20260610090000`)** — the model is complete:
```
assigned_to    uuid references profiles(id) on delete set null   -- the responsible person
created_by     uuid references profiles(id) on delete set null
completed_by   uuid references profiles(id) on delete set null
completed_at / cancelled_at timestamptz
+ index care_tasks_assigned_to_idx
```
RLS: members read; **managers** full CRUD; **collaborators (`caregiver`/`family_member`) may act on a task `assigned_to` them OR unassigned** — but only to complete/cancel, enforced by the `enforce_care_task_collaborator_scope` trigger (which **blocks any content change incl. reassigning `assigned_to`**, and forbids spoofing `completed_by`). Manager INSERT/UPDATE validate the assignee is an active member of the circle (`is_active_user_circle_member`). **No DB change required.**

**`family_visits` (`20260610090200`)** — the visitor is the de-facto responsible person:
```
visitor_name    text not null
visitor_user_id uuid references profiles(id) on delete set null   -- links visit to a member account
created_by      uuid references profiles(id) on delete set null
+ index family_visits_visitor_user_id_idx
```
RLS: members read; managers manage any visitor; **collaborators may insert/update/delete their OWN visits** (`visitor_user_id = auth.uid()`). Manager writes validate a non-null visitor is an active member. **No DB change required.**

**`care_appointments` (`20260610090100`)** — **no assignee**:
```
created_by uuid references profiles(id) on delete set null   -- present
-- NO assigned_to / responsible_user_id
doctor_id  uuid references doctors(id) on delete set null
```
RLS: members read; **managers only** create/update/delete; non-null `doctor_id` must belong to the circle. **Needs a column.**

**`medications` / `medication_schedules` (`20260608130000/130100`)** — **no responsibility**:
```
medications: name, dosage, form, instructions, with_food, photo_url, is_active   -- no person
medication_schedules: days_of_week[], times[], start_date, end_date, notes, is_active   -- no person
```
RLS: members read; **managers only** mutate medications + schedules. **Needs a column** for a default responsible person.

**`medication_logs` (`20260608130200`)** — has `recorded_by uuid references profiles` = **who confirmed a dose** (not who is responsible). RLS: any caregiving role (`admin/primary_caregiver/family_member/caregiver`) may insert/update; managers delete. This is the "who did it" audit trail, complementary to (not a substitute for) a responsible-person field.

**`daily_care_logs` / `vital_readings` (`20260610100000/100100`)** — have `recorded_by` (author), self-or-manager edit. Out of the Phase 2A assignment scope (they are observations, not assignable to-dos), but the `recorded_by` pattern is the precedent for "who acted."

### 1.3 Notifications/reminders (already built — Step 6.0)

`20260611120000_create_notifications_core.sql` + `…120100_create_notification_functions.sql` + `…120200_add_care_circle_timezone.sql` define a complete engine:
- Tables: `push_tokens`, `notification_preferences` (per-user, per-circle, with `task_reminders`, `appointment_reminders`, `visit_updates`, `medication_reminders`, `missed_dose_alerts`, quiet hours), `notifications` (in-app inbox), service-only `notification_outbox` + `notification_push_deliveries` (two-level fan-out, per-device tickets/receipts, retries, crash recovery, claim leases).
- Types incl. `task_due`, `appointment_upcoming`, `visit_update`, `medication_due`, `medication_missed`, `care_update`, `emergency`, `system`.
- Functions: `enqueue_notification(p_user_id, p_type, …)` (creates a **per-user** inbox row + outbox job, dedupe + quiet-hours aware), `circle_notification_recipients(circle_id, type)` (**circle-wide** recipient resolution with role+pref gating), `notification_source_validity` (re-checks the task/appointment/dose is still due at delivery time — already aware of `care_tasks.status/due_date`, `care_appointments.status/starts_at`), plus the full fan-out/claim/receipt pipeline.

**Two gaps for our purposes:** (1) there is **no event producer** — nothing in the repo calls `enqueue_notification` for these care types yet (no DB trigger, no cron/Edge invocation found); (2) recipient resolution is **circle-broadcast**, not assignee-targeted. Assignment unlocks targeted routing later (see §8).

---

## 2. Current UI findings

### 2.1 Tasks — assignment is partially wired

- **Add form `tasks/task-form.tsx`:** ✅ a **real member picker.** `FigmaChipSelect` with options `بدون تعيين` (none) → `''`, `أنا` (self) → `user.id`, then **every active, non-self member by real name/email** (`membersQuery = useCircleMembers(circleId)`). Submits `assigned_to: assignedTo === '' ? null : assignedTo`. Labels: `tasks.fields.assignedTo`, `tasks.assignNone`, `tasks.assignMe`.
- **Edit screen `tasks/task-editor.tsx` (`TaskEditScreen`):** ⚠️ **downgraded** to a **self-only toggle** (`FigmaToggleRow` `tasks.fields.assignToMe`), with `assigned_to: assignToMe ? userId : null`. Two problems: (a) a manager **cannot reassign** to another member here; (b) **opening a task assigned to member B and saving wipes it to `null`** (the toggle initialises false unless it's assigned to *me*). This is an existing **data-loss bug** the moment assignment matters. The comment explicitly notes it preserves the old toggle "to preserve behavior."
- **Read-only view `TaskViewScreen` (non-managers):** ⚠️ shows category/priority/due/description/notes — **does not show the assignee at all.**
- **List `tasks/figma-tasks.tsx` (`TaskRow`):** ⚠️ shows a **3-state generic label**, not a name: `mine → tasks.assignedToMe`, `unassigned → tasks.unassigned`, else `tasks.assignedToMember` ("assigned to a member"). So when it's someone else, the family sees *"assigned to a member"* — **not who.** (The row only has `assigned_to` as a user-id and never resolves it to a name.)
- **Permissions already keyed off assignment:** both `TaskEditor.StatusSection` and `figma-tasks.canActOn` gate collaborator complete/cancel with `task.assigned_to === null || task.assigned_to === userId`. So assignment **already drives "can I act on this."**
- **Home `tasks/tasks-card.tsx`:** just a count tile ("due today"), no assignee.

### 2.2 Visits — self-link only

- **Add form `visits/visit-form.tsx`:** the visitor is `visitor_name` (free text via `FigmaVisitFields`) + a **self-link toggle** shown only to managers (`canManage`); collaborators always link to self. `visitor_user_id = (canManage ? linkToSelf : true) ? user.id : null`. **No member picker** — a manager cannot link a visit to *another* member's account from the UI (RLS would allow it).
- **Editor `visits/visit-editor.tsx`:** edit **preserves** `visitor_user_id` (passes `initial.visitor_user_id` back unchanged); read-only view shows `visitor_name`, when, notes, status — **does not surface who the linked member is.**

### 2.3 Appointments / Medications — no assignment UI

- **Appointments** (`appointment-form.tsx` / `appointment-editor.tsx`): title, type, start/end, location, doctor, notes, status. No assignee (matches the missing column).
- **Medications** (`medication-form.tsx` / `medication-editor.tsx`): name/dosage/form/instructions/with-food + schedule(s) + dose logging. No responsibility field.

### 2.4 Reusable building blocks that already exist

- **`FigmaChipSelect<T>`** (`components/figma/figma-form-screen.tsx`): single-choice pill group `{value,label}[]` — already used for the task assignee picker; good for ~2–6 members.
- **`FigmaCardSelect<T>`**: stacked title+description cards (used for role selection in invite).
- **`FigmaToggleRow` / `FigmaSwitch`**: the self-link toggle.
- **`useCircleMembers(circleId)`** (`circle-members/hooks.ts`, backed by `list_circle_members` RPC) → `CircleMember { memberId, userId, role, status, fullName, email, isSelf, isOwner, createdAt }`. This is the **roster the assignee/member picker needs**, and how a `userId → name` resolver should be built.
- **`circle-members/figma-members.tsx` / `members-manager.tsx` / `role-modal.tsx`**: already render members with name + role + status chips (display precedent for showing a responsible person).
- **No dedicated reusable "member/assignee picker" component or `userId → display name` resolver exists yet** — the task add form inlines that logic. Phase 2B should extract it.

### 2.5 Permission model in the UI

- `circle-selection/permissions.ts`: `canManageCircle(role)` = `admin|primary_caregiver`; `canLogDoses(role)` = `admin|primary_caregiver|family_member|caregiver`. `toActiveCircle()` packs `{ role, canManage, canLogDoses, timezone, … }`.
- `useActiveCircle()` (re-exported via `care-circle/hooks.ts`) is the single source screens consume; `CircleGate` injects it (e.g. `tasks/[id].tsx` passes `canManage = circle.canManage`, `canCollaborate = circle.canLogDoses`).
- `circle-members/permissions.ts`: `isManagerRole`, `assignableRolesFor`, `canChangeStatus`; `role-capabilities.ts`: `ASSIGNABLE_ROLE_ORDER`, `ROLE_CAPABILITIES` (caregiver/elder `assignable:false`).

---

## 3. Which entities already support assignment, and how

- **Tasks — fully (DB + RLS + add-form picker + permission gating).** `assigned_to` is a member user-id; null = unassigned (visible to all, actionable by managers and any collaborator). Collaborators may act on their own/unassigned tasks but **cannot reassign** (trigger-enforced). Gaps are UI-only: editor uses a self-toggle (+ wipe bug), and lists/detail don't show *who*.
- **Visits — partially.** `visitor_user_id` links the visit to a member = the responsible visitor. UI only supports linking to **self**; display shows the free-text name, not the member. RLS already supports a manager linking any active member.
- **Appointments — not at all** (no column, no UI).
- **Medications — not at all** for a responsible person; `medication_logs.recorded_by` only records *who confirmed a dose* after the fact.

---

## 4. Which entities need database changes

Only **two**, both additive, nullable, `on delete set null`, idempotent:

1. **`care_appointments`** → add `assigned_to uuid` (mirror `care_tasks.assigned_to`) + index + extend the two **manager** INSERT/UPDATE policies with the active-member guard. Mutation rights stay manager-only for now (matches the current appointment model); the assignee is informational + a future reminder target.
2. **`medications`** → add `responsible_user_id uuid` (default responsible person for the med's doses) + index + extend the two manager INSERT/UPDATE policies with the active-member guard. **Dose-logging RLS is untouched** — any caregiving member can still record a dose.

**No change** to `care_tasks` (already complete) or `family_visits` (visitor_user_id is sufficient). **No new enum, table, or data backfill.**

> Naming: appointments use `assigned_to` to match tasks (a one-off responsible person). Medications use `responsible_user_id` because it's a standing "owner" of an ongoing medication rather than a single to-do. Both are defensible; if you prefer perfect uniformity, name both `assigned_to` — but the distinct names read better in the data and in notifications.

---

## 5. Proposed Supabase SQL migration — ⚠️ MANUAL ONLY (do **not** apply via CLI)

> **APPLY THESE BY HAND** in the correct Sanad project via the **Supabase Dashboard → SQL editor**, in order. Do **not** run `supabase db push` / `supabase link` / any CLI command (shared account; manual-apply rule). Both scripts follow the repo's house style: additive `add column if not exists`, guarded index, `drop policy … / create policy …`, reuse of existing security-definer helpers, and a trailing `notify pgrst, 'reload schema';`. They are **idempotent / safe to re-run**. Save each as a new file under `supabase/migrations/` (suggested names below) *for repo history only* — applying is manual.

### 5.1 `supabase/migrations/2026XXXXXXXXXX_add_appointment_assignee.sql`

```sql
-- Phase 2A — responsible person for care_appointments. MANUAL ONLY (Dashboard SQL).
-- Mirrors care_tasks.assigned_to: nullable FK to profiles, on delete set null,
-- indexed, with the same cross-circle integrity guard added to the existing
-- manager INSERT/UPDATE policies (is_active_user_circle_member). Mutation rights
-- are UNCHANGED (admins / primary caregivers only). The assignee is informational
-- and a future notification target; no collaborator action policy is added here.
-- Idempotent / safe to re-run.

alter table public.care_appointments
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists care_appointments_assigned_to_idx
  on public.care_appointments (assigned_to);

-- INSERT: managers only; doctor must belong to the circle AND a non-null assignee
-- must be an active member of the same circle (blocks cross-circle assignment).
drop policy if exists "Managers can add care appointments" on public.care_appointments;
create policy "Managers can add care appointments"
on public.care_appointments
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (doctor_id is null or public.is_circle_doctor(circle_id, doctor_id))
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

-- UPDATE: managers only; post-update doctor + assignee must satisfy the same guards.
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
  and (assigned_to is null or public.is_active_user_circle_member(circle_id, assigned_to))
);

notify pgrst, 'reload schema';
```

### 5.2 `supabase/migrations/2026XXXXXXXXXX_add_medication_responsible.sql`

```sql
-- Phase 2A — default responsible person for a medication. MANUAL ONLY (Dashboard).
-- responsible_user_id names the family member primarily responsible for this
-- medication's doses (informational + a future reminder target). It does NOT
-- change who may LOG a dose: medication_logs RLS already lets any caregiving
-- member record/confirm a dose, and that is intentionally left untouched.
-- Mirrors the manager-only medication mutation model, with the active-member
-- guard. Idempotent / safe to re-run.

alter table public.medications
  add column if not exists responsible_user_id uuid references public.profiles(id) on delete set null;

create index if not exists medications_responsible_user_id_idx
  on public.medications (responsible_user_id);

drop policy if exists "Managers can add medications" on public.medications;
create policy "Managers can add medications"
on public.medications
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (responsible_user_id is null or public.is_active_user_circle_member(circle_id, responsible_user_id))
);

drop policy if exists "Managers can update medications" on public.medications;
create policy "Managers can update medications"
on public.medications
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (responsible_user_id is null or public.is_active_user_circle_member(circle_id, responsible_user_id))
);

notify pgrst, 'reload schema';
```

**After manual apply:** the PostgREST schema cache reloads via `notify pgrst`; then regenerate `src/types/supabase.ts` (see §6 + §11). No data migration is required (both columns default to `null`).

---

## 6. RLS / policy implications (described — **not applied**)

- **Cross-circle safety is the only real RLS concern, and it's handled.** Without the added `is_active_user_circle_member(circle_id, <assignee>)` guard, a manager could set `assigned_to` / `responsible_user_id` to a profile from another circle. The drafted policies replicate the exact pattern already proven for `care_tasks.assigned_to` and `family_visits.visitor_user_id` (Step 3.1 hotfix), so the guard is unambiguous (explicit-parameter helper, not an inline subquery).
- **`on delete set null`** keeps referential integrity: removing/deleting a member's profile clears the assignment rather than orphaning or cascading. (Note: `circle_members.status = 'removed'` does **not** delete the `profiles` row, so a removed member's name still resolves — see §11 risk on stale assignees.)
- **No widening of who can do what.** Appointments stay manager-managed; medication mutation stays manager-only; dose logging stays open to caregiving roles. Read access for all four entities is already "any active member," so **every member can already see assignments** once the UI shows them — no SELECT policy change needed.
- **`family_visits` already supports** a manager assigning *another* active member as `visitor_user_id` (the manager INSERT/UPDATE policy validates an active member). So the visit "assign another member" UI in §7 needs **no DB change**.
- **`care_tasks` collaborator trigger blocks reassignment.** `enforce_care_task_collaborator_scope` raises on any `assigned_to` change by a non-manager. This is correct for editing, but it means **"أنا متكفل" (self-claim) by a `family_member` is currently impossible via a normal UPDATE** — it needs a dedicated RPC (see §9). Do not relax the trigger ad-hoc.
- **Types are generated, not hand-authored.** `src/types/supabase.ts` is the generated `Database` type the whole data layer keys off (`Database['public']['Tables']['care_appointments']['Row']`, etc.). It must be regenerated after the manual apply; per the task's constraint it is **not** edited in this phase. (If CLI type-gen is unavailable, a minimal reviewed hand-patch of just the two new columns in the relevant `Row`/`Insert`/`Update` blocks is the fallback — call it out explicitly in the 2B PR.)

---

## 7. UI implementation plan, by screen (Phase 2B — after the manual migration)

Shared prerequisites (build once, reuse):
- **`MemberSelect` component** — extract the task add-form's inline logic into a reusable assignee picker over `useCircleMembers`: options = `بدون تعيين` (null) + `أنا` (self) + active members. For the **assignable "doer" set**, offer roles where work makes sense — `admin`, `primary_caregiver`, `family_member` (mirror `canLogDoses`) — and **exclude `remote_member`/`elder`** (they aren't doers and `remote_member` won't receive operational reminders anyway). Use `FigmaChipSelect` for small circles; consider a `picker-sheet`-based variant when a circle has many members.
- **`useMemberName(circleId, userId)` / `resolveMemberName` resolver** — map a stored user-id to a display name (`fullName ?? email ?? "عضو"`) from the roster, with an "أنا" special-case for self. Needed by every list/detail that shows a responsible person.
- **i18n:** add `*.fields.responsible` / `*.assignNone` / `*.assignedTo` / a generic "المسؤول" + "غير محدد" set in `ar.json` + `en.json` (line-parallel), reusing existing `tasks.assignMe/assignNone` patterns.

| Screen | Change |
|---|---|
| **Tasks — add form** | ✅ Already has the member picker. No change (optionally swap to shared `MemberSelect`). |
| **Tasks — editor** | **Replace the self-only `FigmaToggleRow` with the `MemberSelect` member picker** initialised from `initial.assigned_to`. **This fixes the wipe bug** (currently saving wipes a non-self assignment to null). Managers reassign freely; the `with-check` + trigger keep collaborators safe. |
| **Tasks — read-only view + list rows + detail** | Show the **resolved responsible name** ("المسؤول: نورة" / "أنا" / "غير معيَّن") instead of the generic "assigned to a member" label in `figma-tasks.TaskRow`, and add a responsible row to `TaskViewScreen`. |
| **Appointments — add form + editor** | Add `assigned_to` to `AppointmentInput`/`CreateAppointmentInput` and an `assigned_to` `MemberSelect` card. Show the responsible person in `appointment-editor` read-only view, `appointments-card`, and the appointments list/detail. |
| **Medications — add form + editor** | Add `responsible_user_id` to `MedicationInput` and a `MemberSelect` ("المسؤول عن هذا الدواء"). Show it in the medication detail + list. Keep dose-logging UI unchanged. |
| **Visits — add form** | For **managers**, offer a `MemberSelect` to link the visit to *another* member (sets `visitor_user_id`), in addition to the existing self toggle (RLS already allows it). Collaborators keep self-link. |
| **Visits — detail/list** | When `visitor_user_id` is set, show "مرتبطة بـ <name>" alongside the free-text `visitor_name`. |
| **Home / Today (later)** | A "مهامي / المسند إليّ" (assigned-to-me) surface filtering tasks/appointments/visits where the responsible person is the current user — natural once names resolve. |

No data-flow/validation rewrites — these are additive fields threaded through the existing `*Input` types, mutations, and Figma form cards.

---

## 8. Notification implications (for later phases — **do not build now**)

The engine is ready; assignment makes it *targeted*:

- **Targeted routing.** Today `circle_notification_recipients(circle_id, type)` resolves the **whole circle**. With an assignee, a future event producer can call `enqueue_notification(p_user_id => <assigned_to/responsible_user_id>, p_type => 'task_due' | 'appointment_upcoming' | 'medication_due', …)` to notify **the responsible person first/primarily**, with the circle (or managers) as a fallback/escalation tier (§10). `enqueue_notification` is already **per-user**, so no engine change is needed — only a producer that reads the assignee.
- **Eligibility still applies.** `notification_recipient_eligible` gates by role + preference; a `remote_member` assignee would be filtered out of `task_due`/`medication_due` — another reason the assignee picker should offer "doer" roles only (§7).
- **Source re-validation already understands these entities.** `notification_source_validity` re-checks `care_tasks.status/due_date/due_time` and `care_appointments.status/starts_at` at delivery, so an assignee reminder auto-skips if the task is completed/closed or rescheduled. Adding assignment changes *who* is targeted, not *whether* it's still due.
- **What's still missing (future):** an **event producer** — a scheduled scan (cron/Edge Function) or DB triggers that detect "due soon / overdue / dose missed" and call `enqueue_notification`. None exists yet. Carry `taskId`/`appointmentId`/`scheduleId` + the occurrence (`dueDate`, `startsAt`, `doseDate/scheduledTime`) in `notifications.data` so the existing validity check works (it already expects exactly these keys).
- **Phase 2A does NOT implement notifications.**

---

## 9. "أنا متكفل" (self-claim) design recommendation

**Intent:** a one-tap "I'll take responsibility" on an *unassigned* task/appointment/visit that sets the responsible person to the current user — the emotional core of turning Sanad into a coordination app.

**Findings that shape the design:**
- For **tasks**, a `family_member` **cannot** simply UPDATE `assigned_to` from null→self: the `enforce_care_task_collaborator_scope` trigger blocks all content/assignee changes by non-managers (by design). Managers can, but the product wants *any* doer to be able to claim.
- For **visits**, a collaborator self-claim already exists implicitly (they record their own visit with `visitor_user_id = auth.uid()`).
- For **appointments/medications**, mutation is manager-only today.

**Recommendation — a dedicated SECURITY DEFINER claim RPC** (mirrors the Step 5.0 membership RPC pattern: explicit auth, active-member check, schema-qualified, `search_path=''`, `revoke from public` + `grant to authenticated`). Sketch (a **future** migration — *not part of the 2A apply*):

```sql
-- FUTURE (Phase 2C) — claim an OPEN, UNASSIGNED task for yourself. MANUAL ONLY.
create or replace function public.claim_care_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_task public.care_tasks%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select * into v_task from public.care_tasks t where t.id = p_task_id for update;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  -- Active doer in the task's circle only.
  if not public.has_circle_role(
       v_task.circle_id,
       array['admin','primary_caregiver','family_member']::public.circle_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_task.status <> 'open' then raise exception 'task is not open' using errcode = '22023'; end if;
  if v_task.assigned_to is not null then raise exception 'task already assigned' using errcode = '22023'; end if;
  update public.care_tasks set assigned_to = v_uid where id = p_task_id;
end;
$$;
revoke all on function public.claim_care_task(uuid) from public;
grant execute on function public.claim_care_task(uuid) to authenticated;
```
(An analogous `claim_care_appointment` would be added when appointment self-action is wanted; for visits, "claim" = the existing own-visit insert.)

**UI:** a single teal "أنا متكفل" button on unassigned items (list + detail). When already assigned, show "المسؤول: <name>" with a manager-only "إعادة التعيين". **Do not build the RPC or the button in Phase 2A** — only the data foundation (the assignee columns) lands now. The RPC approach is preferred over relaxing the collaborator trigger because it keeps the "collaborators can't silently rewrite tasks" invariant intact while allowing exactly one safe transition (null→self).

---

## 10. Escalation / overdue — future model (design only)

Building blocks already present: `care_tasks.status/due_date/due_time`, `care_appointments.status/starts_at`, `family_visits.status/visit_date`, `medication_logs` (dose recorded?), the notification engine, and `care_circles.timezone` for wall-clock resolution.

Recommended future shape (post-2B):
1. **Overdue detection** = a scheduled scan (cron/Edge Function on `service_role`): task `open` and `due` in the past; appointment `scheduled` and `starts_at` past with no outcome; visit `planned` past `visit_date`; scheduled dose with no `medication_logs` row (the "missed" signal — `notification_source_validity` already detects "dose recorded").
2. **Tiered escalation:** reminder window → notify **the responsible person**; if still unactioned after a grace window → escalate to **managers** (`has_circle_role(... admin/primary_caregiver)`) and/or the wider circle. Assignment is what makes "responsible-person-first" possible.
3. **State (new, future):** either lightweight columns (e.g. `reminder_count int`, `last_reminded_at`, `escalated_at` on each entity) or a dedicated `care_reminders`/`escalations` table keyed to the source row — so escalations are idempotent and auditable. (`notification_outbox.attempt_count` is *delivery* retry, **not** business escalation — keep them separate.)
4. **Dedupe** via `notifications.dedupe_key` (already supported) so a given occurrence escalates once per tier.

**Out of scope for 2A and 2B.**

---

## 11. Risks & safest implementation order

**Risks**
- **R1 — Existing task-editor wipe bug (highest priority).** The editor's self-toggle saves `assigned_to = null` for any task assigned to someone else. The moment assignment is meaningful, normal manager edits silently unassign. **Fix in 2B** by swapping to the member picker initialised from `initial.assigned_to`.
- **R2 — Name resolution / privacy.** Lists/detail must resolve `user_id → name` via the roster. The roster RPC already restricts emails (managers/self only) and is members-only, so showing names inside a circle is consistent with current exposure; still prefer `fullName`, fall back to a neutral "عضو" rather than email where possible.
- **R3 — Stale assignee display.** A member set to `status='removed'` keeps their `profiles` row, so `assigned_to` still resolves to a name but they can no longer act (and won't be notified — eligibility checks active membership). UI should mark such assignees (e.g. "(غير نشط)") and let managers reassign.
- **R4 — Type drift.** Frontend must not reference the new columns until `src/types/supabase.ts` is regenerated post-apply; otherwise `tsc` fails. Gate 2B coding behind the manual apply + type regen.
- **R5 — Role/notification mismatch.** Assigning a `remote_member` as a "doer" is misleading (no operational reminders). Mitigate by restricting the assignee picker to doer roles (§7).
- **R6 — Manual-apply ordering.** Both scripts are independent and idempotent, but apply appointments + medications **before** shipping the 2B UI that reads the columns.

**Safest order**
1. **(Manual, user)** Apply §5.1 + §5.2 in the Dashboard. Verify columns/policies exist.
2. **(2B)** Regenerate `src/types/supabase.ts`.
3. **(2B)** Ship **read-only display first** — resolve and show the responsible person everywhere (tasks list/detail, appointment/medication/visit detail). Lowest risk, immediately delivers "family can see who is responsible."
4. **(2B)** Ship **editable assignment**: appointment + medication pickers; **fix the task editor (R1)**; visit "link another member" for managers.
5. **(2C+)** `claim_*` RPC + "أنا متكفل" button.
6. **(later)** Event producer + targeted reminders, then overdue/escalation.

---

## 12. Recommended Phase 2B coding scope (after the manual migration)

A self-contained frontend slice, no further DB changes:
1. **Regenerate Supabase types** for the two new columns (no hand-edits beyond that).
2. **Data layer:** add `assigned_to` to `appointments/api.ts` (`AppointmentInput`, `CreateAppointmentInput`, insert/update payloads); add `responsible_user_id` to `medications/api.ts` (`MedicationInput`, insert/update).
3. **Shared UI:** extract a reusable **`MemberSelect`** (assignee picker over `useCircleMembers`, doer-roles only, "بدون تعيين"/"أنا"/members) and a **`useMemberName`/resolver**.
4. **Tasks:** swap the editor's self-toggle for `MemberSelect` (**fixes R1**); show the resolved responsible name in `figma-tasks.TaskRow` + `TaskViewScreen`.
5. **Appointments & Medications:** add the picker to add-form + editor; show responsible in detail/list/cards.
6. **Visits:** manager "link another member" picker; show linked member in detail/list.
7. **i18n:** `ar.json`/`en.json` keys for "المسؤول"/responsible, assign-none, inactive-assignee, etc. (line-parallel, no mojibake).
8. **Validation:** `check:mojibake`, `diff --check`, `tsc --noEmit`, `expo-doctor`; Android RTL QA in light + dark.

**Explicitly NOT in 2B:** notifications/event producers, escalation/overdue, `claim_*` RPC + "أنا متكفل" button, WhatsApp/contact import, prayer-time logic.

---

## 13. Confirmation — no Supabase CLI commands were run

Confirmed. **No `supabase link`, `supabase db push`, `supabase functions deploy`, `supabase migration`, `supabase gen types`, or any other Supabase CLI command was executed.** The SQL in §5 / §9 is **draft text only**, clearly marked **MANUAL ONLY**, to be applied by the user in the Dashboard. No migration was applied; no PostgREST reload was triggered.

## 14. Confirmation — no backend / Supabase / EAS / prebuild / dependency changes

Confirmed. This was a read-only audit. **No** schema/data/RLS/RPC/edge-function applied, **no** EAS build/submit, **no** `prebuild`, **no** `package.json`/lockfile/dependency change, **no** `app.json`/Expo-config change, **no** `.env`/secret read or change, and **no** other project (ThinkMate Chess, etc.) touched. The only filesystem change is this report.

## 15. Validation results

**No source/code/config files were changed**, so no build/type validation is required beyond version-control status. The only change is the addition of this report under `docs/claude-reports/`. Status + diff shown below.

---

**Stopping here per instructions: report created; `git status --short` and `git diff --stat` shown next. No commit, no stage.**
