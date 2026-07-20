# Data Model & Domain Objects (backend context)

This section is a **backend reference** for the designer, not a screen walkthrough. Sanad is a family elderly-care coordination app: every piece of data hangs off a **care circle** (one family's coordination space around one care recipient). Members join a circle with a **role** that decides what they may mutate, but — by the app's "transparent circle" posture — every *active* member may *see* all of a circle's operational data. This document lists each database entity, its key fields and enums, its relationships, the row-level-security (RLS) posture that governs who can read/write it, the RPC functions the app calls, and the scheduled background jobs (edge functions) that generate reminders and digests. Use it to understand what each screen is backed by, which fields exist to display or edit, and which controls should be role-gated. All schema is from `supabase/migrations/*.sql` and the generated `src/types/supabase.ts`.

---

## The circle spine (how everything connects)

```
auth.users ──1:1──> profiles ──owns──> care_circles ──1:1──> care_recipients
                        │                    │
                        │                    ├── circle_members (role + status per user)
                        │                    ├── circle_invitations (one-time codes)
                        │                    ├── medications ──< medication_schedules ──< medication_logs
                        │                    ├── care_tasks
                        │                    ├── care_appointments ──> doctors
                        │                    ├── family_visits
                        │                    ├── daily_care_logs
                        │                    ├── vital_readings
                        │                    ├── doctors
                        │                    └── emergency_contacts
                        │
                        ├── push_tokens (per device)
                        ├── notification_preferences (global row + per-circle rows)
                        └── notifications ──< notification_outbox ──< notification_push_deliveries
```

Almost every operational table carries a `circle_id` FK (`on delete cascade`) and is indexed by it. RLS is enabled on **every** table; the gate is one of two security-definer helpers defined in the initial schema:
- `is_circle_member(circle_id)` — is the caller an **active** member of this circle? (drives all SELECT/read access).
- `has_circle_role(circle_id, roles[])` — is the caller an active member **with one of these roles**? (drives writes).

Throughout this doc, **"managers" = `admin` + `primary_caregiver`**; **"collaborators" / "caregiving members" = `caregiver` + `family_member`**. `remote_member` and `elder` are read-only observer roles (they pass `is_circle_member` for reads but appear in no write policy).

---

## Identity & circle entities

### `profiles`
The app-level user record, 1:1 with `auth.users` (auto-created by the `handle_new_user` trigger on signup). `initial_core_schema.sql:18`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `full_name` | text | nullable; source for `memberDisplayName()` |
| `avatar_url` | text | nullable |
| `phone` | text | nullable |
| `locale` | text | default `'ar'` |
| `dialect` | text | nullable |
| `created_at` / `updated_at` | timestamptz | |

**RLS:** a user may SELECT and UPDATE **only their own** profile row (`id = auth.uid()`). No cross-user profile read via the table (member names for lists come through the `list_circle_members` / `list_care_activity` RPCs instead).

### `care_circles`
One family's coordination space. `initial_core_schema.sql:29`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | circle name |
| `owner_id` | uuid FK → profiles | the creator/owner |
| `timezone` | text | default set by migration `20260611120200`; the **circle's** canonical zone used to resolve all wall-clock schedules (doses/tasks/visits) into one absolute instant — so a remote member and a local caregiver resolve the same event. Set via `set_circle_timezone` RPC. |
| `missed_dose_grace_minutes` | int | default **30**, constrained **5–240**; wait after a scheduled dose time before the "not recorded" alert (tier-3 manager escalation fires at 2×). Set via `set_missed_dose_grace_minutes` RPC. `20260715150000`. |
| `created_at` / `updated_at` | timestamptz | |

**RLS:** members SELECT; managers UPDATE; a user may INSERT a circle they own (but circles are actually created via the `create_care_circle` RPC). Direct writes to `timezone` / `missed_dose_grace_minutes` are revoked — only the setter RPCs touch them.

### `care_recipients`
The person being cared for — **1:1 with a circle** (`circle_id` is `unique`). `initial_core_schema.sql:48`. Standing decision: always spoken of with dignity, never a clinical label.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK, **unique** | one recipient per circle |
| `full_name` | text | required |
| `birth_date` | date | nullable |
| `photo_url` | text | nullable |
| `dialect` | text | nullable |
| `blood_type` | text | nullable, free text |
| `allergies` | text | nullable, free text |
| `chronic_conditions` | text | nullable, free text |
| `emergency_notes` | text | nullable, free text |

**RLS:** members SELECT; managers INSERT/UPDATE (no delete policy — recipient lives with the circle).

### `circle_members`
Membership join row: which user is in which circle, with what role and status. `initial_core_schema.sql:37`. Unique on `(circle_id, user_id)`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | the "member_id" used across RPCs |
| `circle_id` | uuid FK | |
| `user_id` | uuid FK → profiles | |
| `role` | enum `circle_role` | default `family_member` |
| `status` | enum `member_status` | default `active` |

**Enum `circle_role`:** `admin` · `primary_caregiver` · `family_member` · `caregiver` · `remote_member` · `elder`.
**Enum `member_status`:** `active` · `invited` · `removed`.

**RLS:** members SELECT; the circle owner may insert their own initial membership; managers UPDATE members. Role/status changes actually go through `update_circle_member_role` / `update_circle_member_status` RPCs. The members list a screen renders comes from `list_circle_members` (returns `member_id, user_id, full_name, email, role, status, is_owner, is_self`).

### `circle_invitations`
One-time invite codes so a manager can add family/caregivers. `20260610130000`. **Security-critical:** RLS is ON with **no data policies** — no client can read/write the table directly; only the SECURITY DEFINER RPCs touch it, and **only a SHA-256 hash of the code** (`code_hash`) is stored. The raw code is returned to the inviter exactly once by `create_circle_invitation`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `role` | enum `circle_role` | the role the invitee will get |
| `code_hash` | text, unique | SHA-256 of the normalized code; raw code never stored |
| `status` | enum `invitation_status` | default `pending` |
| `invited_name` / `invited_email` | text | optional labels for the inviter's list |
| `created_by` / `accepted_by` | uuid FK → profiles | |
| `accepted_at` | timestamptz | |
| `expires_at` | timestamptz | default **now + 7 days** |

**Enum `invitation_status`:** `pending` · `accepted` · `revoked` · `expired`.
Codes are 10 chars grouped `XXXXX-XXXXX` from a 31-char unambiguous alphabet (`ABCDEFGHJKMNPQRSTUVWXYZ23456789` — no 0/O/1/I/L). Normalization strips non-alphanumerics and upper-cases before hashing, so dashes/spaces/case don't matter. RPCs: `create_circle_invitation`, `accept_circle_invitation`, `list_circle_invitations`, `revoke_circle_invitation`.

---

## Medications domain

### `medications`
The medicines the family records for the recipient. `20260608130000` (+ `responsible_user_id` added by `20260626160000`).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `name` | text | required |
| `dosage` | text | nullable free text (e.g. "500mg") |
| `form` | text | nullable free text (tablet/syrup/…) |
| `instructions` | text | nullable |
| `with_food` | boolean | default false |
| `photo_url` | text | nullable |
| `responsible_user_id` | uuid FK → profiles | nullable; the accountable owner for this medication's dosing (Phase 2A). Drives responsibility-aware reminders. |
| `is_active` | boolean | default true; the UI **deactivates** rather than deletes («فعّال» / «غير فعّال») |

**RLS:** members SELECT; **managers only** INSERT/UPDATE/DELETE (a non-null `responsible_user_id` must be an active member). The "claim responsibility" path uses the `claim_medication_responsibility` RPC.

### `medication_schedules`
When a medication should be taken. `20260608130100`. One medication → many schedules.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` / `medication_id` | uuid FK | |
| `days_of_week` | int[] | **0=Sunday … 6=Saturday** (JS `Date.getDay()`); default all 7; must be non-empty and within 0–6 |
| `times` | time[] | array of clock times; must be non-empty |
| `start_date` | date | default today |
| `end_date` | date | nullable; must be ≥ start_date |
| `notes` | text | nullable |
| `is_active` | boolean | default true |

The client computes "today's doses" by matching the device/circle weekday against `days_of_week` and expanding `times`. **RLS:** members SELECT; managers INSERT/UPDATE/DELETE (referenced medication must be in the same circle).

### `medication_logs`
The outcome of a single scheduled dose. `20260608130200`. This is what the dose-ring / "log a dose" flow writes.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` / `medication_id` | uuid FK | |
| `schedule_id` | uuid FK, nullable | `on delete set null`; null = ad-hoc log not tied to a schedule |
| `dose_date` | date | required |
| `scheduled_time` | time | required |
| `status` | enum `medication_log_status` | required |
| `note` | text | nullable |
| `recorded_by` | uuid FK → profiles | `on delete set null` |
| `recorded_at` | timestamptz | default now |

**Enum `medication_log_status`:** `given` · `missed` · `postponed`.
A **partial unique index** on `(schedule_id, dose_date, scheduled_time)` (where `schedule_id` is not null) prevents duplicate logs for the same scheduled dose; ad-hoc logs are exempt. **RLS:** members SELECT; **any caregiving member** (managers + collaborators) INSERT/UPDATE a dose outcome; **managers only** DELETE.

---

## Coordination domain (tasks, appointments, visits)

### `care_tasks`
The shared to-do list (errands, meals, hygiene, movement, appointments-to-attend…). `20260610090000` (+ `cancelled_by` from `20260715120000`).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `title` | text | required |
| `description` | text | nullable |
| `category` | enum `care_task_category` | default `general` |
| `priority` | enum `care_task_priority` | default `normal` |
| `status` | enum `care_task_status` | default `open` («مفتوحة») |
| `due_date` / `due_time` | date / time | both nullable |
| `assigned_to` | uuid FK → profiles | nullable; `on delete set null` |
| `created_by` / `completed_by` / `cancelled_by` | uuid FK → profiles | bookkeeping |
| `completed_at` / `cancelled_at` | timestamptz | kept consistent with status by CHECK constraints |
| `notes` | text | nullable |

**Enum `care_task_category`:** `general` · `medication` · `meal` · `hygiene` · `movement` · `errand` · `appointment` · `other`.
**Enum `care_task_priority`:** `low` · `normal` · `high` · `urgent`.
**Enum `care_task_status`:** `open` · `completed` · `cancelled`.

CHECK constraints keep `status`↔timestamp honest (completed ⟺ `completed_at` set; cancelled ⟺ `cancelled_at` set; `completed_by` only when completed). **RLS + trigger:** members SELECT; **managers** fully manage (create/edit/delete/reassign, assignee must be an active circle member). **Collaborators** (`caregiver`/`family_member`) may act on a task **assigned to them or unassigned**, but a DB trigger (`enforce_care_task_collaborator_scope`) restricts them to transitioning an **open** task to **completed/cancelled** only — they cannot edit content, reassign, or spoof `completed_by`. Claim-an-unassigned-task uses `claim_care_task` RPC.

### `care_appointments`
Calendar items around the recipient. `20260610090100` (+ `assigned_to` from `20260626160000`).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `title` | text | required |
| `appointment_type` | enum `care_appointment_type` | default `general` |
| `starts_at` | timestamptz | required (absolute instant) |
| `ends_at` | timestamptz | nullable; must be ≥ starts_at |
| `location` | text | nullable |
| `doctor_id` | uuid FK → doctors | nullable; must belong to same circle |
| `assigned_to` | uuid FK → profiles | nullable; the member responsible to attend |
| `notes` | text | nullable |
| `status` | enum `care_appointment_status` | default `scheduled` |
| `created_by` | uuid FK → profiles | |

**Enum `care_appointment_type`:** `doctor` · `lab` · `pharmacy` · `therapy` · `home_care` · `family` · `general`.
**Enum `care_appointment_status`:** `scheduled` · `completed` · `cancelled`.
**RLS:** members SELECT; **managers only** INSERT/UPDATE/DELETE (doctor + assignee must be same-circle). Assigned member records an outcome via `set_assigned_appointment_outcome`; unassigned appointments can be claimed via `claim_care_appointment`.

### `family_visits`
A light log of who is visiting and when. `20260610090200`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `visitor_name` | text | required (free text — a visitor need not have an account) |
| `visitor_user_id` | uuid FK → profiles | nullable; links the visit to a member's account |
| `visit_date` | date | required |
| `start_time` / `end_time` | time | both nullable; end ≥ start when both given |
| `status` | enum `family_visit_status` | default `planned` |
| `notes` | text | nullable |
| `created_by` | uuid FK → profiles | |

**Enum `family_visit_status`:** `planned` · `completed` · `cancelled`.
**RLS:** members SELECT; **managers** manage any visit; **collaborators** may add/update/cancel/delete **their own** visits (`visitor_user_id = auth.uid()`). Claim path: `claim_family_visit`.

---

## Observation domain (daily logs, vitals)

### `daily_care_logs`
Free-form daily wellbeing observations. `20260610100000`. Several members may each log the same day, but one member cannot file two logs for the same date (partial unique index on `(circle_id, log_date, recorded_by)`).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `log_date` | date | default today |
| `mood` | enum `daily_mood` | nullable |
| `sleep_quality` | enum `sleep_quality` | nullable |
| `appetite` | enum `appetite_level` | nullable |
| `hydration` | enum `hydration_level` | nullable |
| `pain_level` | int | nullable; **0–10** scale (CHECK) |
| `mobility` | enum `mobility_level` | nullable |
| `bathroom_notes` / `food_notes` / `activity_notes` / `general_notes` | text | all nullable free text |
| `recorded_by` | uuid FK → profiles | nullable (managers may file anonymous) |

**Enum `daily_mood`:** `great` · `good` · `okay` · `sad` · `anxious` · `angry` · `confused` · `tired`.
**Enum `sleep_quality`:** `good` · `fair` · `poor` · `unknown`.
**Enum `appetite_level`:** `good` · `normal` · `low` · `none` · `unknown`.
**Enum `hydration_level`:** `good` · `normal` · `low` · `unknown`.
**Enum `mobility_level`:** `normal` · `limited` · `needs_help` · `bedbound` · `unknown`.
**RLS:** members SELECT; any caregiving role may add a log **attributed to themselves**; managers may additionally add **anonymous** logs and edit/delete **any** log; members may edit/delete **their own**. No medical interpretation is ever applied.

### `vital_readings`
Family-recorded measurements. The app **never interprets, flags, or advises** on a value; constraints only check presence/positivity, never "normal" ranges. `20260610100100`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `reading_at` | timestamptz | default now |
| `reading_type` | enum `vital_reading_type` | required |
| `systolic` / `diastolic` | int | for blood pressure (both required when type=`blood_pressure`); each > 0 if present |
| `numeric_value` | numeric | the value for non-BP measured types (required unless type is `blood_pressure` or `other`); > 0 if present |
| `unit` | text | nullable free text |
| `notes` | text | nullable |
| `recorded_by` | uuid FK → profiles | nullable |

**Enum `vital_reading_type`:** `blood_pressure` · `heart_rate` · `temperature` · `blood_sugar` · `oxygen_saturation` · `weight` · `other`.
**RLS:** identical pattern to daily logs (self-attributed adds; managers manage all + anonymous; members manage own).

---

## Directory domain (doctors, emergency contacts)

### `doctors`
The recipient's treating doctors/clinics. `20260608120100`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `name` | text | required |
| `specialty` | text | nullable |
| `phone` | text | nullable |
| `clinic_name` | text | nullable |
| `notes` | text | nullable |

**RLS:** members SELECT; **managers only** mutate. Referenced by `care_appointments.doctor_id`.

### `emergency_contacts`
People to call in an emergency. `20260608120000`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `circle_id` | uuid FK | |
| `name` | text | required |
| `relationship` | text | nullable free text |
| `phone` | text | required |
| `is_primary` | boolean | default false |
| `notes` | text | nullable |

**RLS:** members SELECT; **managers only** mutate.

---

## Notifications & delivery domain

A **two-level** delivery pipeline keeps a multi-device user tracked correctly and health detail off any provider/lock-screen until the send step. `20260611120000`.

### `push_tokens`
Per-device Expo push token registry. Unique on `(user_id, expo_push_token)`; a **partial unique index** guarantees a raw token is ACTIVE for **at most one user** (device handover safety).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | referenced by deliveries (raw token never stored downstream) |
| `user_id` | uuid FK → profiles | |
| `expo_push_token` | text | |
| `platform` | text | must be `ios`/`android`/`web` |
| `device_id` / `app_version` | text | nullable |
| `is_active` | boolean | default true |
| `last_seen_at` | timestamptz | |

**RLS:** owner-only SELECT; **all client writes revoked** — registration/deactivation only via `register_push_token`, `deactivate_push_token*` RPCs.

### `notification_preferences`
Per-user preferences; a row with `circle_id = null` is the **global default**, per-circle rows override it. `20260611120000` (+ extra toggles from `20260626163000`). Unique on `(user_id, circle_id)`.

Boolean toggles (all default **true** unless noted): `medication_reminders`, `missed_dose_alerts`, `task_reminders`, `appointment_reminders`, `visit_reminders`, `visit_updates`, `care_updates`, `activity_updates`, `assignment_alerts`, `available_to_claim_digest`, `emergency_alerts`, `remote_summary`. Quiet hours: `quiet_hours_enabled` (default false), `quiet_hours_start`, `quiet_hours_end` (both required when enabled — CHECK). `timezone` = the **user's device** zone (quiet-hours/display only, distinct from the circle zone).

**RLS:** owner-only SELECT; writes revoked → only via `upsert_notification_preferences`. The effective (global⊕circle) merge is read via `effective_notification_prefs`.

### `notifications` (the in-app inbox)
The user-visible notification row; may carry detailed `title`/`body`/`data`/`deep_link` for the authenticated in-app center. `20260611120000`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | recipient |
| `circle_id` | uuid FK | nullable (global/system rows) |
| `type` | enum `notification_type` | |
| `title` / `body` | text | required |
| `data` | jsonb | default `{}`; carries `entity` + `itemId` + occurrence keys for the send-time ownership gate |
| `deep_link` | text | where a tap navigates |
| `read_at` | timestamptz | null = unread |
| `expires_at` | timestamptz | nullable |
| `dedupe_key` | text | nullable; partial-unique per user for idempotency |

**Enum `notification_type`:** `medication_due` · `medication_missed` · `task_due` · `appointment_upcoming` · `visit_update` · `care_update` · `emergency` · `system` · `item_assigned` · `task_overdue` · `visit_upcoming` · `item_claimed` · `item_completed` · `item_cancelled` · `claim_digest` · `daily_summary`.

**RLS:** a row is visible only to its recipient **and**, for circle-linked rows, only while they're an **active** member of that circle (removed members lose visibility but rows are kept). All client writes revoked; read-state changes via `set_notification_read` / `mark_all_notifications_read`.

### `notification_outbox` (service-only)
One logical fan-out job per `(notification, channel)`. **Enum `notification_outbox_status`:** `pending` · `fanned` · `skipped` · `failed` (`fanned` = materialized into per-device deliveries, **not** delivered). **Enum `notification_channel`:** `push` (only value). RLS on, **no policy**, all client DML revoked — service-side only.

### `notification_push_deliveries` (service-only)
One row per `(outbox job, active device token)` — the unit actually sent to Expo, with per-device tickets/receipts, a `claim_token` lease, and bounded retries. **Enum `notification_delivery_status`:** `pending` · `processing` · `sent` · `failed` · `skipped`. Raw token not stored here (references `push_tokens.id`). Service-side only.

---

## RPC functions (what the client calls)

The app never mutates sensitive tables directly; it calls these SECURITY DEFINER functions (all in `src/types/supabase.ts` `Functions`). Grouped by purpose:

| RPC | Purpose |
|---|---|
| `create_care_circle(circle_name, recipient_full_name, recipient_birth_date?)` | Creates a circle + its care_recipient + owner membership atomically. Returns `{circle_id, recipient_id}`. |
| `create_circle_invitation(circle_id, role, invited_name?, invited_email?)` | Manager creates an invite; returns the raw **code** (once), `expires_at`, `role`. |
| `accept_circle_invitation(code)` | Invitee redeems a code → becomes a member. Returns `{circle_id, membership_id, role}`. |
| `list_circle_invitations(circle_id)` / `revoke_circle_invitation(invitation_id)` | Manager views/revokes pending invites (includes `created_by_name`, `accepted_by_name`). |
| `list_circle_members(circle_id)` | Members list with `full_name, email, role, status, is_owner, is_self`. |
| `update_circle_member_role` / `update_circle_member_status` | Manager changes a member's role/status. |
| `transfer_circle_ownership(circle_id, new_owner_user_id)` | Hand over ownership. |
| `leave_care_circle(circle_id)` | Member leaves. |
| `claim_care_task` / `claim_care_appointment` / `claim_family_visit` / `claim_medication_responsibility` | "أنا متكفّل" — a claim-capable member takes an **unassigned** item; returns the updated row. |
| `set_assigned_appointment_outcome(appointment_id, status)` | Assigned member marks their appointment completed/cancelled. |
| `list_available_to_claim(circle_id)` | Feeds the unassigned-open-work list (returns item_type/id, title, subtitle, category, priority, dates, status). |
| `list_care_activity(circle_id, limit?, before?)` | **Care Pulse feed** — UNIONs recent dose logs, task completions/cancels, appointment outcomes, completed visits, vitals, daily logs, and member-joins into one paginated event shape (`event_type, occurred_at, actor_name, title, subtitle, item_type, status`). `20260715130000`. |
| `can_view_all_operational(circle_id)` | Backs the «مهامي / كل المهام» scope default (managers → all). |
| `set_circle_timezone(circle_id, timezone)` / `is_valid_timezone(tz)` | Circle zone management (manager only). |
| `set_missed_dose_grace_minutes(circle_id, minutes)` | Manager sets the missed-dose grace (clamped 5–240). `20260715150000`. |
| `register_push_token` / `deactivate_push_token(_by_id/_value)` | Device token lifecycle. |
| `upsert_notification_preferences(...)` / `effective_notification_prefs(circle_id, user_id)` | Read/write notification prefs (global ⊕ per-circle merge). |
| `set_notification_read(id, read)` / `mark_all_notifications_read(circle_id?)` | Inbox read-state. |
| `enqueue_notification(...)` | Server-side: create a notification + its outbox job (used by edge functions). |
| `fanout_due_notifications` / `claim_push_deliveries` / `mark_delivery_sent`/`_failed`/`_skipped` / `record_delivery_receipt` / `mark_stale_receipts_unchecked` | Delivery-pipeline internals (service_role). |
| `daily_summary_recipients(circle_id)` | Active remote members opted into the digest (service_role only). `20260715140000`. |
| Helper predicates | `is_circle_member`, `has_circle_role`, `is_active_user_circle_member`, `is_user_circle_member`, `is_circle_doctor`, `is_circle_medication(_schedule[_for_medication])`, `is_responsible_for_medication`, `active_circle_member_role`, plus invitation-code helpers `normalize/hash/generate_invitation_code`, and notification resolvers (`notification_recipients_for_item_event`, `notification_item_managers`, `notification_item_owner`, `circle_notification_recipients`, `notification_recipient_eligible/current`, `notification_source_validity`, `notification_defer_until`). |

---

## Background jobs (scheduled edge functions)

All are **deployed and cron-scheduled by hand** (never auto-applied), authorize a scheduled-request secret, run as service_role, and never log a raw token/health value/secret. `supabase/functions/*`.

| Function | What it does |
|---|---|
| **enqueue-due-reminders** | Scans active medication schedules, due + overdue open tasks, scheduled appointments, and planned visits; resolves each wall-clock schedule into one canonical instant using the **circle** timezone; enqueues per-item notifications to the **responsible owner** (unassigned task → nobody; unassigned med/appt/visit → managers). Types: `medication_due`, `task_due`, `task_overdue`, `appointment_upcoming`, `visit_upcoming`. |
| **check-missed-doses** | For each scheduled dose whose circle-local time passed more than `missed_dose_grace_minutes` ago with **still no log**, enqueues one neutral `medication_missed` "not recorded" alert to the responsible owner; if still unaddressed by 2× grace, a tier-2 escalation to managers (`data.tier='manager'`). Re-checks log existence at run time (no false positives); idempotent via per-dose dedupe keys. Never interprets the miss medically. |
| **send-daily-summaries** | Runs **hourly**; for each circle whose current circle-local hour = 20:00, composes a one-line Arabic day summary (doses given, tasks completed, appointments, visits, vitals, daily logs) and enqueues a `daily_summary` to each remote member who opted in (`remote_summary`). Tap opens `/pulse`. Idempotent per `(circle, local date)`. |
| **process-notification-outbox** | Two phases: (A) `fanout_due_notifications` materializes one delivery per current active device token; (B) `claim_push_deliveries` is the authoritative send-time gate (re-validates expiry/membership/role/preference/quiet-hours/token, stamps a lease), then sends the detailed Expo payload and records the result under the lease. External push is at-least-once. |
| **check-push-receipts** | Optional. Polls sent-but-unreceipted deliveries oldest-first, validates ticket↔delivery, and on a definitive `DeviceNotRegistered` receipt deactivates that exact token; sweeps tickets past Expo's retention as `unchecked`. |

---

## Workflows

These are the **data-level** journeys behind the screens (which tables/RPCs each step touches).

1. **Create a circle (onboarding).** User signs up → `handle_new_user` trigger creates their `profiles` row → app calls `create_care_circle(name, recipient_name, birth_date?)` → inserts `care_circles` + `care_recipients` (1:1) + owner `circle_members` row (role `admin`) atomically.

2. **Invite a member and accept.** Manager calls `create_circle_invitation(circle_id, role, name?, email?)` → a `circle_invitations` row is stored with only `code_hash`; the raw code is returned once and shared out-of-band. Invitee opens the app and calls `accept_circle_invitation(code)` → the code is normalized+hashed, matched, marked `accepted`, and a new `circle_members` row (given the invitation's role, status `active`) is created. Manager can `list_circle_invitations` / `revoke_circle_invitation` before acceptance (7-day expiry).

3. **Add a medication with a schedule.** Manager inserts `medications` (name, dosage, form, with_food, optional `responsible_user_id`). Then inserts one or more `medication_schedules` (`days_of_week` 0–6, `times[]`, start/end dates). The client derives "today's doses" by matching the weekday against `days_of_week` and expanding `times`.

4. **Log a dose.** Any caregiving member records the outcome → inserts a `medication_logs` row (`schedule_id`, `dose_date`, `scheduled_time`, `status` = given/missed/postponed, `recorded_by`). The partial unique index blocks a duplicate log for the same scheduled dose. Correcting a status = UPDATE of the same row.

5. **Missed-dose escalation (automatic).** `check-missed-doses` finds a scheduled dose whose circle-local time passed > `missed_dose_grace_minutes` ago with no `medication_logs` row → enqueues a `medication_missed` alert to the responsible owner; at 2× grace, escalates to managers. Recording a late dose before the run cancels the alert.

6. **Create and complete/reassign a task.** Manager inserts `care_tasks` (title, category, priority, due_date/time, optional `assigned_to`). A collaborator assigned or unassigned may transition an **open** task to completed/cancelled (trigger-enforced; sets `completed_by`/`completed_at` or `cancelled_by`/`cancelled_at`). Only a manager may edit content or **reassign** (`assigned_to`). An unassigned task is claimed with `claim_care_task` (sets `assigned_to = self`).

7. **Claim unassigned work («أنا متكفّل»).** `list_available_to_claim(circle_id)` surfaces unassigned open items across tasks/appointments/visits/medications. The member calls the matching `claim_*` RPC to set the owner to themselves.

8. **Schedule and close out an appointment.** Manager inserts `care_appointments` (title, type, `starts_at`, optional `doctor_id`, optional `assigned_to`). The assigned member calls `set_assigned_appointment_outcome(id, completed|cancelled)`; unassigned ones can be claimed via `claim_care_appointment`.

9. **Record a family visit.** A collaborator adds a `family_visits` row for themselves (`visitor_user_id = self`, date, times); managers can record any visitor (free-text `visitor_name`, no account needed). Status flows planned → completed/cancelled.

10. **File a daily log / vital reading.** A caregiving member inserts `daily_care_logs` (one per member per date) or `vital_readings`, attributed to themselves. Managers may additionally file anonymous rows and edit/delete any. No value is ever interpreted or range-flagged.

11. **Reminder delivery (automatic pipeline).** `enqueue-due-reminders` (and the item/missed/digest jobs) call `enqueue_notification` → creates a `notifications` row + a `notification_outbox` job. `process-notification-outbox` fans the job out into `notification_push_deliveries` (one per active `push_tokens` row), re-validates authorization at send, sends via Expo, and records tickets. `check-push-receipts` later reconciles receipts and deactivates dead tokens.

12. **Daily family digest.** Hourly, `send-daily-summaries` finds circles at their local 20:00, tallies the day's activity, and enqueues a `daily_summary` to each opted-in remote member (`daily_summary_recipients`). The push deep-links to `/pulse`.

13. **Manage notification preferences.** User reads merged prefs via `effective_notification_prefs(circle_id, user_id)` and writes via `upsert_notification_preferences(...)` (per-circle row overriding the global `circle_id = null` row), including per-type toggles and quiet hours. In-app inbox read-state via `set_notification_read` / `mark_all_notifications_read`.
