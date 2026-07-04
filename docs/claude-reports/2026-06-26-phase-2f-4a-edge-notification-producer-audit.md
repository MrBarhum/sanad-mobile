# Phase 2F-4A — Edge notification producer audit (responsibility-aware delivery)

**Status:** Audit / plan **only**. **No code was changed** (this report is the sole filesystem write),
**no Edge Function was deployed**, no SQL was run, no Supabase CLI/connection was used, and no
migrations / app source / generated types / env were touched.
**Baseline commit:** `e5c5906 chore(db): add inert responsibility notification migrations`.
**Inert SQL in place (not yet applied to any DB by this phase):**
`20260626163000_notifications_responsibility_types_preferences.sql` (enum values + prefs + widened
`upsert_notification_preferences`) and `20260626164000_notifications_responsibility_resolvers.sql`
(`notification_recipients_for_item_event`, `notification_item_owner`, `notification_item_managers`,
`notification_recipient_current`, updated `notification_recipient_eligible` / `effective_notification_prefs`
/ `notification_source_validity`).
**Scope of this phase:** read-only inspection of the four Edge Functions + notification migrations,
and an implementation plan for 2F-4B. **Do not edit Edge source yet.**

---

## 1. Executive summary

**Current producer behavior.** Two scheduled Edge producers create operational reminders:

- `enqueue-due-reminders` (cron ~5 min) → `medication_due`, `task_due`, `appointment_upcoming`.
- `check-missed-doses` (cron ~10–15 min) → `medication_missed`.

Both resolve recipients through the **circle-broad** DB function
`circle_notification_recipients(circle_id, type)` (via `_shared/enqueue.ts → recipientsFor`) and enqueue
through `enqueue_notification(...)` (via `enqueueForRecipient`). Two delivery functions round out the
engine and are **type-agnostic**: `process-notification-outbox` (fan-out + authoritative send) and
`check-push-receipts` (receipt/cleanup). The remote Expo payload is **generic** (`سند` / `لديك تذكير
جديد`) and carries routing ids only; all detail stays in the RLS-guarded inbox row.

**Why it is not responsibility-aware.** `circle_notification_recipients` returns **every eligible active
member** of the circle (role + preference), with **no awareness of ownership**. After Phase 2A/2D/2E,
operational rows are **scoped to the responsible member** (task `assigned_to`, medication
`responsible_user_id`, appointment `assigned_to`, visit `visitor_user_id`), and Phase 2D RLS returns an
**empty** detail row to non-owners for tasks/appointments/visits/`medication_logs`. So today a reminder
(a) is sent circle-wide (spam to non-responsible members) and (b) can deep-link a non-owner to a screen
RLS renders empty. The producers also **do not** write `data.entity` / `data.itemId`, so the new
`notification_source_validity` ownership-currency gate (2F-2/2F-3) treats their rows as **legacy**
(passes them through un-checked). There is **no** visit reminder, **no** task-overdue producer, and
**no** missed-dose manager escalation.

**What Edge changes are needed later (2F-4B, not now).**

1. Swap `circle_notification_recipients(circle,type)` → `notification_recipients_for_item_event(circle,
   type,entity,itemId)` in both producers (owner-targeting + manager fallback/awareness live in SQL).
2. Add `data.entity` + `data.itemId` to every item notification (feeds the ownership-currency gate),
   **preserving** the existing occurrence keys the per-type source-validity branches still read.
3. Re-key (or drop) the in-run recipient cache — it is currently circle-level and would be **wrong** once
   recipients depend on the specific item's owner.
4. Add a **`visit_upcoming`** producer path and a **`task_overdue`** producer path.
5. Add **missed-dose manager escalation** (tier-2) with `data.tier = 'manager'` after a second grace
   window.
6. Keep the push body generic; no remote-member operational pushes (already guaranteed by the resolver +
   `notification_recipient_eligible`); no SQL/migration changes in the Edge phase.

`process-notification-outbox` and `check-push-receipts` need **no code change** — they inherit the new
SQL revalidation automatically through `fanout_due_notifications` / `claim_push_deliveries`.

**Explicit statement.** No Edge source was edited. No function was deployed. No SQL executed, no
Supabase CLI, no DB connection, no EAS/prebuild, no app code / generated types / migrations / env
touched. The only write is this report.

---

## 2. Function-by-function audit

### 2.1 `enqueue-due-reminders/index.ts`

**Reminders it currently produces**

| Type | Source scan | Notes |
|---|---|---|
| `medication_due` | active `medication_schedules` (+ active `medications`); one canonical occurrence per (schedule, circle-local day, time) inside `medicationLookaheadMinutes` (20); skipped if a `medication_logs` row already exists | circle-tz occurrence |
| `task_due` | `care_tasks` where `status='open'` and `due_date` not null, within `taskLookaheadMinutes` (20); date-only tasks fire at **09:00 circle-local** | — |
| `appointment_upcoming` | `care_appointments` where `status='scheduled'`, per lead in `appointmentLeadMinutes` `[1440, 60]`, within `appointmentLookaheadMinutes` (20) | absolute `starts_at` |
| anything else | **none** — no `visit_upcoming`, no `task_overdue` | gaps to add in 2F-4B |

**Exact RPCs/functions called**
- `circle_notification_recipients(p_circle_id, p_type)` via `recipientsFor(sb, circleId, type)`
  (`_shared/enqueue.ts`).
- `enqueue_notification(...)` via `enqueueForRecipient(sb, recipient, args)` (`_shared/enqueue.ts`).
- Table reads (service role): `care_circles(id,timezone)`, `medication_schedules(+medications!inner)`,
  `medication_logs` (existence head-count), `care_tasks`, `care_appointments`.

**Does it call `circle_notification_recipients`?** **Yes** — indirectly, for all three types
(`getRecipients` → `recipientsFor` → `rpc('circle_notification_recipients', …)`).

**Recipient caching now** — an in-run `Map<string, Recipient[]>` keyed **`${circleId}:${type}`**
(`getRecipients`, lines 37–45). Correct today because the resolver is circle-broad (all items of a
circle+type share one recipient list); cache lives for one run only.

**Current dedupe keys**
- medication: `med:${scheduleId}:${ymd}:${time}` (`med:${s.id}:${day.ymd}:${time}`)
- task: `task:${taskId}:${dueDate}:${occurrence}` where `occurrence = due_time ?? 'none'`
- appointment: `appt:${appointmentId}:${startsAt}:${lead}`

**Current notification `data` payload shape**
- `medication_due`: `{ type:'medication_due', circleId, medicationId, scheduleId, doseDate, scheduledTime }`
- `task_due`: `{ type:'task_due', circleId, taskId, dueDate, dueTime, dueAt }`
- `appointment_upcoming`: `{ type:'appointment_upcoming', circleId, appointmentId, startsAt, leadMinutes }`
- **No `entity` / `itemId` on any of them.**

**Current deep link shape**
- `medication_due` → `'/medications'` (catalog list, not item-specific — the `medications` row is
  member-readable, so this is safe)
- `task_due` → `/tasks/${task.id}`
- `appointment_upcoming` → `/appointments/${appt.id}`

**Current timing / lead windows**
- Lookaheads: medication 20, task 20, appointment 20 (min).
- Appointment leads: `[1440, 60]` (24 h and 1 h); each lead dedupes independently.
- Date-only task reminder time: **09:00 circle-local**.
- `expires_at`: medication_due → `doseAt + missedDoseGraceMinutes(60)`; task_due →
  `dueAt + taskReminderExpiryHours(6h)`; appointment_upcoming → the appointment `starts_at`.

**Where it should later call `notification_recipients_for_item_event`** — inside the per-item enqueue
loops, replacing `getRecipients(circleId, type)` with a per-item resolve
`notification_recipients_for_item_event(circleId, type, entity, itemId)`:
- medication loop → `(circleId, 'medication_due', 'medication', s.medication_id)`
- task loop → `(circleId, 'task_due', 'task', task.id)`
- appointment loop → `(circleId, 'appointment_upcoming', 'appointment', appt.id)`

**Where it must later add** (`data`):
- `data.entity` — `'medication' | 'task' | 'appointment'` (and `'visit'` for the new path)
- `data.itemId` — the entity **row id**: `medications.id` (= `medicationId`), `care_tasks.id` (=`taskId`),
  `care_appointments.id` (=`appointmentId`), `family_visits.id`
- occurrence fields expected by `notification_source_validity` — **keep the existing ones**
  (`scheduleId/doseDate/scheduledTime`; `taskId/dueDate/dueTime`; `appointmentId/startsAt`) **in
  addition to** `entity/itemId`. The per-type validity branch still reads the type-specific id, while the
  new currency gate reads `entity/itemId` (see §8).

**What must change per requirement**
- **medication due → responsible owner only:** resolver returns `responsible_user_id`; **unassigned →
  managers** (medication is in the resolver's fallback set). Add `entity='medication'`,
  `itemId=medicationId`.
- **task due → assigned owner only; unassigned → nobody:** resolver returns the single `assigned_to`
  owner, or **empty** when unassigned; the existing `if (recipients.length === 0) continue;` already makes
  "nobody" a clean no-op. Add `entity='task'`, `itemId=taskId`.
- **task overdue → new producer path:** add a scan for open tasks whose due time passed by a product
  threshold, enqueue `task_overdue` to `assigned_to` (nobody if unassigned), optional tier-2 to managers
  (`data.tier='manager'`). New dedupe keys (§5). Threshold is an open product number (§12).
- **appointment upcoming → assigned owner; unassigned → managers:** resolver handles both (appointment is
  in the fallback set). Add `entity='appointment'`, `itemId=appointmentId`.
- **visit upcoming → new producer path:** scan `family_visits` where `status='planned'` with
  `visit_date`/`start_time` (circle-tz occurrence, mirroring tasks), enqueue `visit_upcoming` to
  `visitor_user_id`; **unassigned → managers**. `data`: `entity='visit'`, `itemId=visit.id`, `visitDate`,
  `startTime`. Deep link `/visits/${visit.id}` (route `src/app/(app)/visits/[id].tsx` exists). New lead
  window is an open product number (§12).

### 2.2 `check-missed-doses/index.ts`

**How it currently finds missed doses** — scans active `medication_schedules` (+ active `medications`);
for today and yesterday (circle-local) it computes each dose occurrence, keeps those whose `doseAt` is
**older than** `graceEnd = now − missedDoseGraceMinutes(60)` and **newer than**
`oldest = now − missedDoseMaxAgeMinutes(12h)`, and re-checks `medication_logs` at run time — a dose
recorded after grace is never a false positive.

**How it currently resolves recipients** — `getRecipients(circleId)` →
`recipientsFor(sb, circleId, 'medication_missed')` → `circle_notification_recipients` → **circle-broad**.

**Does it notify circle-wide now?** **Yes** — every eligible active member of the circle (per prefs),
with no ownership targeting and no manager escalation tier.

**Current dedupe keys** — `med_missed:${scheduleId}:${ymd}:${time}` (`med_missed:${s.id}:${day.ymd}:${time}`).

**Current `data` payload shape** — `{ type:'medication_missed', circleId, medicationId, scheduleId,
doseDate, scheduledTime }`. **No `entity` / `itemId`; no `tier`.**

**Schedule/date/time fields expected by source-validity?** **Yes** — `scheduleId`, `doseDate`,
`scheduledTime` are all present, so the medication occurrence branch already validates. **Missing** only
`entity`/`itemId` (for the new currency gate) and, for escalation rows, `tier`.

**How it should later target `responsible_user_id`** — swap to
`notification_recipients_for_item_event(circleId, 'medication_missed', 'medication', s.medication_id)`
(**tier-1 owner**); the resolver returns the responsible owner, or **managers** when the medication is
**unassigned** (fallback). Add `entity='medication'`, `itemId=s.medication_id`.

**What manager escalation should look like later** — a **producer-tiered second enqueue**. When an
**assigned** dose is still unrecorded after a **second grace window** (owner failed to act), enqueue a
tier-2 `medication_missed` to `notification_item_managers(circleId)` with:
- dedupe key `med_missed_mgr:${scheduleId}:${ymd}:${time}` (independent of the owner key, so both tiers
  fire once),
- `data.tier = 'manager'` (required — see below),
- the **same** occurrence keys (`scheduleId/doseDate/scheduledTime`) so the medication branch of
  source-validity still passes (dose still not recorded), plus `entity='medication'`,
  `itemId=medicationId`.

> This escalation is **distinct** from the resolver's unassigned→managers fallback: fallback fires when
> `responsible_user_id is null`; escalation fires when an **owner exists but did not act** within the
> second grace window.

**Where `data.tier='manager'` must be set** — **only** on the tier-2 escalation enqueue (never on the
tier-1 owner row). The `notification_recipient_current` gate short-circuits `tier='manager'` rows to
validate a **current active manager** instead of item ownership; without `tier`, the owner-only resolver
would drop the manager escalation as `not_current_recipient`.

**Escalation grace windows currently hardcoded or missing** — `missedDoseGraceMinutes=60` (tier-1
trigger) and `missedDoseMaxAgeMinutes=12h` (backstop) exist in `_shared/config.ts`. There is **no**
second-grace / manager-tier window today — it must be **added** (open product number, §12).

### 2.3 `process-notification-outbox/index.ts`

**Needs code changes?** **No.**

**Type-agnostic?** **Yes.** It fans out and sends a **generic** payload for every claimed delivery; the
only type-sensitive line is `priority: d.type === 'emergency' ? 'high' : 'default'`, and all new types
correctly fall to `'default'`. The Expo `data` is routing-only: `{ type, notificationId, circleId,
deepLink }`.

**Relies on SQL revalidation via `fanout_due_notifications` / `claim_push_deliveries`?** **Yes.** Phase A
calls `fanout_due_notifications` (early filter) and Phase B calls `claim_push_deliveries` (authoritative
send-time gate). Both call `notification_source_validity` + `notification_recipient_eligible`, which the
inert 2F-3 migrations updated — so this function inherits the ownership-currency gate, the
`task_overdue`/`visit_upcoming` branches, and the remote exclusion **automatically**, with no code edit.

**Risks around new types / payload / copy / Expo payload** — low:
- New enum values pass through as opaque `d.type` strings → no branch breaks (default priority).
- Generic push copy is unchanged and independent of type.
- New deep links (e.g. `/visits/{id}`) are plain strings in the payload; the **app's** deep-link
  router/catalog must recognize the new types/routes (a 2F-5 app concern, **not** an Edge concern).
- No health detail can leak: payload stays routing-only regardless of type.

### 2.4 `check-push-receipts/index.ts`

**Needs code changes?** **No.**

**Receipt/cleanup only?** **Yes** — it polls `sent` deliveries missing a receipt, records Expo receipts,
retires definitively-dead tokens (`DeviceNotRegistered`), and sweeps stale tickets to `unchecked`. It
never reads `notifications.type` or `data`.

**Risks around new types** — **none.** It operates purely on delivery/ticket rows and is fully
type-agnostic.

---

## 3. Current recipient-cache risk

**Existing cache key strategy**
- `enqueue-due-reminders`: `Map` keyed **`${circleId}:${type}`** (per run).
- `check-missed-doses`: `Map` keyed **`${circleId}`** (type is always `medication_missed`, per run).

**Why circle-level cache is wrong after per-item ownership** — `notification_recipients_for_item_event`
resolves the recipients of a **specific item** (its owner, or managers on fallback/awareness). Two items
of the same `circle+type` generally have **different owners**. A `${circleId}:${type}` cache would return
**item A's owner** for **item B** — delivering B's reminder to the wrong person (or to A's owner instead
of nobody). The circle-level cache must not survive the resolver swap.

**Proposed new cache key (or remove cache)**
- Owner-resolved types → key **`${circleId}:${type}:${itemId}`**. Because each occurrence is resolved
  once per run, this mostly *defeats* the cache — the meaningful reuse is **appointments** (the same
  appointment is processed once per lead in `[1440,60]`; a per-item key lets the 2nd lead reuse the 1st
  lead's owner list). Examples:
  - `${circleId}:appointment_upcoming:${appointmentId}` (reused across the two lead passes)
  - `${circleId}:medication_due:${medicationId}`
  - `${circleId}:task_due:${taskId}`
  - `check-missed-doses` owner tier → `${circleId}:medication_missed:${medicationId}`
- Manager-tier / manager-fallback recipients are **item-independent** (`notification_item_managers(circle)`
  is per-circle), so they *may* keep a per-circle key, e.g. `${circleId}:managers` for the escalation
  fan-out.
- **Simplest correct option: remove the recipient cache entirely** and resolve per item. Given per-run
  volumes are bounded (row caps in `_shared/config.ts`) and each item is enqueued once, the only cost is
  the appointment double-lead double-resolve — acceptable. **Recommendation:** remove the cache, or, if
  kept, key it **`${circleId}:${type}:${itemId}`** (never `${circleId}:${type}`).

**Which functions need cache changes** — **both producers**: `enqueue-due-reminders` (re-key to
per-item, or drop) and `check-missed-doses` (re-key owner tier per-medication; a per-circle key is still
valid for the manager escalation tier). The delivery functions have no recipient cache.

---

## 4. Data payload contract (future Edge producers)

Common keys on **every** item notification:

| Key | Value |
|---|---|
| `entity` | `'task' | 'medication' | 'appointment' | 'visit'` |
| `itemId` | the entity **row id** (`care_tasks.id` / `medications.id` / `care_appointments.id` / `family_visits.id`) |
| `circleId` | the circle id |

Per-event required `data` (type-specific occurrence keys are **in addition to** the common keys):

| Event | `entity` | `itemId` | Source-validity occurrence keys | `tier` | Notes |
|---|---|---|---|---|---|
| `medication_due` | `medication` | `medications.id` | `scheduleId`, `doseDate`, `scheduledTime` | — | keep `medicationId` = `itemId` |
| `medication_missed` (owner tier) | `medication` | `medications.id` | `scheduleId`, `doseDate`, `scheduledTime` | — | tier-1 owner |
| `medication_missed` (manager tier) | `medication` | `medications.id` | `scheduleId`, `doseDate`, `scheduledTime` | `"manager"` | tier-2 escalation; separate dedupe key |
| `task_due` | `task` | `care_tasks.id` | `taskId`, `dueDate`, `dueTime` | — | `taskId` = `itemId` (branch reads `taskId`) |
| `task_overdue` (owner tier) | `task` | `care_tasks.id` | `taskId`, `dueDate`, `dueTime` | — | validated via the folded task branch |
| `task_overdue` (manager tier) | `task` | `care_tasks.id` | `taskId`, `dueDate`, `dueTime` | `"manager"` | tier-2 escalation |
| `appointment_upcoming` | `appointment` | `care_appointments.id` | `appointmentId`, `startsAt` | — | `appointmentId` = `itemId` (branch reads `appointmentId`) |
| `visit_upcoming` | `visit` | `family_visits.id` | `visitDate`, `startTime` | — | visit branch reads **`itemId`** + `visitDate`/`startTime` |

**Contract notes.**
- The occurrence keys are **duplicated intent** for existing types: `medicationId`/`taskId`/`appointmentId`
  already exist and equal `itemId`; the branch reads the type-specific key while the currency gate reads
  `itemId`. Producers must write **both** (they already write the type-specific id; only `entity`+`itemId`
  are new).
- **Visits are the exception**: `notification_source_validity`'s visit branch reads `data.itemId`
  directly (there is no `visitId` key), plus `visitDate` + `startTime`.
- Manager-tier rows may technically omit `entity`/`itemId` (the currency gate short-circuits on
  `tier='manager'`), **but** must still carry the occurrence keys (the med/task branch runs afterward);
  include `entity`/`itemId` anyway for consistent app routing.
- Nothing in `data` may contain a name/dose/vital/note — only ids/dates/times (privacy, §9).

---

## 5. Dedupe key audit and proposed final formats

| Family | Current key (repo) | Proposed final (2F-2 §11) | Verdict |
|---|---|---|---|
| Medication due | `med:${scheduleId}:${ymd}:${time}` | `med:{scheduleId}:{ymd}:{time}` | **Match — no change** |
| Missed dose (owner) | `med_missed:${scheduleId}:${ymd}:${time}` | `med_missed:{scheduleId}:{ymd}:{time}` | **Match — no change** |
| Missed dose (manager) | *(none — no escalation today)* | `med_missed_mgr:{scheduleId}:{ymd}:{time}` | **New** |
| Task due | `task:${taskId}:${dueDate}:${due_time ?? 'none'}` | `task:{taskId}:{dueDate}:{dueTimeOr'none'}` | **Match — no change** |
| Task overdue (owner) | *(none — no producer today)* | `task_overdue:{taskId}:{dueDate}` | **New** |
| Task overdue (manager) | *(none)* | `task_overdue_mgr:{taskId}:{dueDate}` | **New** |
| Appointment upcoming | `appt:${appointmentId}:${startsAt}:${lead}` | `appt:{appointmentId}:{startsAt}:{lead}` | **Match — no change** |
| Visit upcoming | *(none — no producer today)* | `visit:{visitId}:{visitDate}:{startTimeOr'none'}` | **New** |

**Mismatches:** none among the three existing reminders — the committed keys already match the proposal
verbatim, so the resolver swap does **not** invalidate in-flight dedupe. The four additions
(`med_missed_mgr`, `task_overdue`, `task_overdue_mgr`, `visit`) are net-new and collide with nothing. The
`notifications` unique index is `(user_id, dedupe_key)`, so keys are already per-recipient; the separate
owner/manager key families let both tiers fire exactly once.

---

## 6. Responsibility-aware implementation plan (2F-4B checklist — do **not** implement now)

1. Replace `circle_notification_recipients(circle,type)` with
   `notification_recipients_for_item_event(circle,type,entity,itemId)` in `enqueue-due-reminders` and
   `check-missed-doses` (introduce a `recipientsForItem(...)` helper in `_shared/enqueue.ts` returning the
   same `Recipient[]`; keep `recipientsFor` for any legacy/broadcast use).
2. Add an item-aware recipient cache keyed `${circleId}:${type}:${itemId}` **or remove the cache**
   entirely (recommended); keep a per-circle cache only for the manager escalation fan-out.
3. Include `entity` + `itemId` in **every** item notification `data` (all four entities).
4. **Preserve** the existing occurrence keys (`scheduleId/doseDate/scheduledTime`, `taskId/dueDate/dueTime`,
   `appointmentId/startsAt`); add `visitDate/startTime` for visits.
5. Add a **`visit_upcoming`** producer (planned visits, circle-tz occurrence, owner=`visitor_user_id`,
   unassigned→managers, deep link `/visits/{id}`) with dedupe `visit:{visitId}:{visitDate}:{startTimeOr'none'}`.
6. Add a **`task_overdue`** producer (open tasks past due by the product threshold, owner=`assigned_to`,
   unassigned→nobody) with dedupe `task_overdue:{taskId}:{dueDate}`; optional tier-2 manager escalation.
7. Add **missed-dose manager escalation** (tier-2) after the second grace window, to
   `notification_item_managers(circle)`, with `data.tier = 'manager'` and dedupe
   `med_missed_mgr:{scheduleId}:{ymd}:{time}` (mirror the pattern for `task_overdue_mgr`).
8. Keep the **push body generic** (no producer touches `process-notification-outbox`'s generic payload).
9. **No remote operational pushes** — already guaranteed by the resolver + `notification_recipient_eligible`
   (remote is excluded from every operational/assignment/awareness/digest type); do not re-introduce a
   circle-broad path.
10. **No SQL or migration changes** in this Edge phase; the resolvers/validity already exist in the inert
    migrations and must simply be **applied to the target DB before** the new Edge is deployed (§12).
11. Add config knobs to `_shared/config.ts` for the new windows (task-overdue threshold, missed-dose
    second grace, visit lead time) — values are open product decisions (§12).

---

## 7. Query / RPC call shapes for later implementation (reference only — do **not** modify code)

**Resolver (owner / manager / awareness audience for ONE item):**

```ts
// service role (serviceClient()); resolver is granted to service_role, like circle_notification_recipients.
const { data, error } = await sb.rpc('notification_recipients_for_item_event', {
  p_circle_id: circleId,   // uuid
  p_type: type,            // public.notification_type, e.g. 'medication_due' | 'task_due' | 'visit_upcoming' | …
  p_entity: entity,        // 'task' | 'medication' | 'appointment' | 'visit'
  p_item_id: itemId,       // the entity row id
});
if (error) throw error;
const recipients = (data ?? []) as Recipient[];
```

**Manager escalation audience (tier-2):**

```ts
const { data, error } = await sb.rpc('notification_item_managers', { p_circle_id: circleId });
if (error) throw error;
const managers = (data ?? []) as Recipient[]; // enqueue each with data.tier='manager' + occurrence keys
```

**Existing `enqueue_notification` (unchanged — via `enqueueForRecipient`):**

```ts
await enqueueForRecipient(sb, recipient, {
  type,                    // NotificationTypeName (extend the union to include the new values)
  title, body,            // detail lives ONLY in the inbox row
  circleId,
  deepLink,               // '/medications' | `/tasks/${id}` | `/appointments/${id}` | `/visits/${id}`
  dedupeKey,              // §5
  expiresAt,
  data: {                 // §4 contract
    type, circleId,
    entity, itemId,       // NEW — feeds the ownership-currency gate
    /* + occurrence keys, + tier:'manager' on escalation rows */
  },
});
// enqueue_notification(p_user_id, p_type, p_title, p_body, p_circle_id, p_data, p_deep_link,
//                      p_dedupe_key, p_expires_at, p_timezone, p_quiet_hours_enabled,
//                      p_quiet_hours_start, p_quiet_hours_end) → uuid | null (null = deduped/not-a-member)
```

**Expected result shape (identical for both resolver RPCs, matching `_shared/enqueue.ts → Recipient`):**

| Field | Type |
|---|---|
| `user_id` | `string` (uuid) |
| `timezone` | `string` (IANA; drives quiet-hours deferral) |
| `quiet_hours_enabled` | `boolean` |
| `quiet_hours_start` | `string | null` (`time`) |
| `quiet_hours_end` | `string | null` (`time`) |

Because the shape is identical to `circle_notification_recipients`, the swap is a drop-in: only the RPC
name + the added `p_entity`/`p_item_id` args change.

---

## 8. Source-validity compatibility checklist

For each future event, can `notification_source_validity` (2F-2/2F-3 body) validate it with the §4
payload?

| Event | Validatable? | Keys read | Gap / note |
|---|---|---|---|
| `medication_due` | ✅ | currency gate (`entity`,`itemId`,`type`) → owner check; med branch (`scheduleId`,`doseDate`,`scheduledTime`) → schedule active + occurrence + dose-not-recorded | producer must add `entity='medication'`,`itemId=medicationId` |
| `medication_missed` (owner) | ✅ | same as above | same |
| `medication_missed` (manager) | ✅ | currency gate short-circuits on `tier='manager'` (current-manager check); med branch still runs on `scheduleId/doseDate/scheduledTime` | **must** carry both `tier='manager'` **and** the occurrence keys |
| `task_due` | ✅ | currency gate (`entity`,`itemId`); task branch reads **`taskId`** + `dueDate`/`dueTime` | **`taskId` required** — the branch does not read `itemId`; keep `taskId` **and** add `entity`/`itemId` |
| `task_overdue` (owner) | ✅ | folded into the task branch (`n.type in ('task_due','task_overdue')`) | same `taskId`/`dueDate`/`dueTime` requirement |
| `task_overdue` (manager) | ✅ | `tier='manager'` currency + task branch | needs `taskId`/`dueDate`/`dueTime` **and** `tier='manager'` |
| `appointment_upcoming` | ✅ | currency gate (`entity`,`itemId`); appt branch reads **`appointmentId`** + `startsAt` | **`appointmentId` required** — branch does not read `itemId`; keep `appointmentId` **and** add `entity`/`itemId` |
| `visit_upcoming` | ✅ | currency gate; visit branch reads **`itemId`** + `visitDate` + `startTime` | visits key occurrence off **`itemId`** (no `visitId` key); set `itemId=visit.id`, `visitDate`, `startTime` |

**Gaps identified.**
- The **dual-key** requirement is the one real footgun: existing types validate occurrence off their
  **type-specific id** (`taskId`/`appointmentId`/`scheduleId`), while the new currency gate keys off
  **`entity`/`itemId`**. Producers must write **both** or one of the two checks fails
  (`not_current_recipient` or `no_source_context`). Visits are the lone type that keys occurrence off
  `itemId`.
- **Manager escalation** rows **require** `data.tier='manager'`; without it the owner-only resolver drops
  them (`not_current_recipient`). Escalation rows still need the occurrence keys so the med/task branch can
  confirm the underlying event is still open/unrecorded.
- **Legacy in-flight rows** (enqueued before 2F-4B) have no `entity`/`itemId`; the currency gate treats
  them as legacy (returns `true`, un-checked) — they deliver under the old circle-broad semantics until
  they expire. Acceptable for a bounded rollout window (§12).

No change to `notification_source_validity`'s signature/return or its call sites is needed — the Edge
producers only need to populate the payload the existing branches already expect.

---

## 9. Privacy / push copy audit

**Current push copy behavior.** `process-notification-outbox` builds **every** outgoing Expo message from
`genericPushMessage()` — title `سند`, body `لديك تذكير جديد` — with `data` limited to routing ids
(`{ type, notificationId, circleId, deepLink }`). Detailed, item-named copy (e.g.
`medicationDueMessage` / `taskDueMessage` / `appointmentMessage` / `medicationMissedMessage`) is stored
**only** in the RLS-guarded inbox `notifications` row; it is never sent through Expo.

**Is the remote push title/body generic?** **Yes** — unconditionally, for all types, including the new
ones (the outbox processor is type-agnostic).

**Recommendation: keep medication lock-screen copy generic.** No producer should ever place a medication
name, dose, vital, note, or recipient name in the **Expo payload** (title/body **or** `data`). The
deployment guide's privacy contract (§10) and the messages module both codify this; 2F-4B must preserve
it for `visit_upcoming` / `task_overdue` / missed-dose escalation as well (item titles go to the **inbox
body**, never to the push).

**Risk if Edge producers put medication names in the push payload instead of the inbox body** — a med
name (or any health detail) in the Expo `title`/`body`/`data` would surface on the **lock screen** and be
visible to the push provider / OS, breaking the medical-privacy guarantee. Mitigation: the outbox
processor already discards producer copy and re-derives a generic payload, so as long as producers keep
detail in the **inbox** `title/body` and only ids/dates/times in `data`, no name can leak. **Do not change
copy now.**

---

## 10. Testing plan for 2F-4B (after code changes)

**Local / static (no deploy, no DB):**
- **TypeScript / Deno check** *(if available)* — the Edge functions are Deno modules (`jsr:@supabase/...`
  imports), so `deno check supabase/functions/**/*.ts` is the accurate checker (repo `tsc` targets the
  Expo app, not the Deno functions). Run app-side `npx tsc --noEmit` only for shared TS the app consumes.
- **Lint** — `npm run lint` (expo lint) for any app-touching TS.
- **Mojibake** — `npm run check:mojibake` (Arabic copy must stay well-encoded).
- **Diff/whitespace** — `git -c core.autocrlf=false diff --check`.

**Manual QA (later, on staging, delivery staged-on):**
- `family1` receives its **own** medication / task / appointment / visit reminders.
- `family2` does **not** receive `family1`'s assigned-item reminders.
- `remote` receives **none** of the operational/assignment/awareness/digest pushes.
- Managers receive the **unassigned** appointment / medication / visit **fallback** (and **not** an
  unassigned task — that goes to nobody).
- **Unassigned task** sends **nobody**.
- **Missed-dose manager escalation** fires **only** after the tier-2 condition (owner still hasn't recorded
  after the second grace window) and only to managers, with `data.tier='manager'`.
- A **duplicate cron run** does not duplicate notifications (dedupe keys + `(user_id, dedupe_key)` index).
- Reassign/claim/complete/cancel **after** enqueue → the queued reminder is **skipped** at send
  (source-validity currency gate + per-type status branch).

---

## 11. Edge deployment boundary

- **2F-4A (this phase):** **do not deploy** anything; report only.
- **2F-4B:** may **edit** the Edge source (producers + `_shared`), but **still must not deploy** unless the
  user explicitly requests it. Local/static checks only.
- **Deploy only** after the SQL (163000/164000) is applied to the target DB, app settings/catalog/types are
  aligned (2F-5), and a deliberate delivery decision is made (2F-6). Deploying producers that call
  `notification_recipients_for_item_event` **before** the migrations are applied would fail at runtime
  (unknown function). Keep cron unscheduled / delivery disabled until the deliberate enable.

---

## 12. Risks / open questions

1. **Exact cron windows.** Documented cadence (`docs/deployment/notifications-and-reminders.md` §6):
   outbox **1 min**, enqueue-due **5 min** (lookahead 20), missed-doses **10–15 min** (grace 60),
   receipts **15–30 min**. The new `visit_upcoming` + `task_overdue` scans should **fold into
   `enqueue-due-reminders`** (reuse the 5-min/20-min window), and the missed-dose manager tier into
   `check-missed-doses` — confirm **no new cron job** is introduced.
2. **Old queued notifications lacking `entity`/`itemId`.** In-flight pre-2F-4B rows bypass the ownership
   gate (legacy pass-through) and deliver under old circle-broad semantics until they expire; drain or
   accept a short overlap window at rollout.
3. **Can producer code call the new SQL before migrations are applied?** **No** — the resolver/managers
   RPCs must exist in the target DB first. Enforce apply-before-deploy ordering.
4. **Staging apply order.** (a) apply `163000` → `164000`; (b) verify the `effective_notification_prefs`
   drop raised no dependency error (per the 2F-3 report); (c) 2F-5 regenerate app types (Edge does not use
   generated types); (d) deploy 2F-4B Edge; (e) 2F-6 schedule cron / stage delivery on.
5. **Task-overdue product threshold.** How long after `due` before `task_overdue` fires (and whether a
   tier-2 manager escalation applies) — **open**; add `taskOverdue*` config.
6. **Missed-dose escalation grace.** The second grace window (owner→manager) is undefined today — **open**;
   add a `missedDoseManagerGraceMinutes`-style config.
7. **Visit reminder lead time.** Which lead(s) for `visit_upcoming` (single lead like tasks, or multi-lead
   like appointments) — **open**; add `visitLeadMinutes` / lookahead config.
8. **Cache invalidation.** Caches are per-run only; the correctness fix is the per-item (or removed) key —
   no cross-run cache exists, so nothing to invalidate beyond the key change.
9. **Delivery disabled/enabled state.** Cron stays **unscheduled** until 2F-6; producers may be deployed
   with delivery off (nothing runs without cron). Keep delivery disabled until SQL + Edge + app settings +
   types + real-device QA are aligned.

---

## 13. Confirmation

- ✅ **No code changed except this report** — no Edge source, no `_shared`, no app source edited.
- ✅ **No SQL run** — nothing executed against any database.
- ✅ **No Supabase CLI** — no `supabase` command; no `functions deploy`, no `db`, no `gen types`.
- ✅ **No DB connection** — inspection was file-read + text-search only.
- ✅ **No Edge deploy** — no function deployed or invoked.
- ✅ **No app code changed** — `src/**` untouched.
- ✅ **No migrations changed** — `supabase/migrations/**` unchanged.
- ✅ **No generated types changed** — `src/types/supabase.ts` untouched.
- ✅ **No env / secrets touched** — no `.env` read; no tokens/keys inspected.
- ✅ **No commit / no stage** — working tree only; no EAS, no prebuild.
- ✅ **No other project touched** — ThinkMate Chess and everything outside this repo untouched.

## 14. `git` status & diff

Captured read-only at hand-off:

- `git --no-pager status --short`
- `git --no-pager diff --stat`

Expected: one **untracked** file (`??`) — this report — and an empty `diff --stat` (an untracked file
does not appear in a tracked diff). Actual output is shown in the hand-off message.
