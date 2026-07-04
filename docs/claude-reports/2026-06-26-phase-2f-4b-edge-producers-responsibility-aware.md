# Phase 2F-4B — Responsibility-aware Edge notification producers (implemented)

**Status:** Edge **producer source** made responsibility-aware. **Source-only, local; not deployed, not
run.** No SQL executed, no Supabase CLI, no DB connection, no cron/delivery enabled, no migrations /
generated types / app source / env touched, nothing committed or staged.
**Baseline commit:** `a4a72f4 docs(product): audit notification edge producers`.
**Depends on (must be applied to the target DB before deploy):**
`20260626163000_notifications_responsibility_types_preferences.sql` and
`20260626164000_notifications_responsibility_resolvers.sql` (enum values + resolver/validity functions).
**Preceding audit:** `docs/claude-reports/2026-06-26-phase-2f-4a-edge-notification-producer-audit.md`.

---

## 1. Summary of files changed

| File | Change |
|---|---|
| `supabase/functions/_shared/enqueue.ts` | Extended `NotificationTypeName` union (+7 responsibility types); added `ItemEntity` type; added `recipientsForItem(...)` (wraps `notification_recipients_for_item_event`) and `notificationManagers(...)` (wraps `notification_item_managers`); kept `recipientsFor(...)` (legacy/broadcast) and `enqueueForRecipient(...)` unchanged |
| `supabase/functions/_shared/config.ts` | Added `taskOverdueGraceMinutes` (60), `taskOverdueMaxAgeHours` (24), `missedDoseManagerEscalationMinutes` (120), `visitLeadMinutes` (60), `visitLookaheadMinutes` (20), `visitDateOnlyReminderHour` (9), `maxVisitsPerRun` (2000) |
| `supabase/functions/_shared/messages.ts` | Added neutral inbox copy helpers `taskOverdueMessage(...)` and `visitUpcomingMessage(...)` (Arabic-first, no medical interpretation) |
| `supabase/functions/enqueue-due-reminders/index.ts` | `medication_due` / `task_due` / `appointment_upcoming` re-targeted to owners via `recipientsForItem`; removed the circle-level recipient cache; added `entity`/`itemId` to every payload; added new **`visit_upcoming`** and **`task_overdue`** producer paths |
| `supabase/functions/check-missed-doses/index.ts` | `medication_missed` re-targeted to the responsible owner via `recipientsForItem`; added `entity`/`itemId`; added **tier-2 manager escalation** (`notification_item_managers` + `data.tier='manager'` + `med_missed_mgr` key) |

**Not modified (verified untouched):** `process-notification-outbox/index.ts`,
`check-push-receipts/index.ts` (type-agnostic; inherit the SQL revalidation automatically), all app
source, migrations, generated types, and config outside the four Edge files.

## 2. Exact behavior changes

- **Medication due → owner targeting.** Recipients now come from
  `notification_recipients_for_item_event(circle,'medication_due','medication', medicationId)` — the
  `responsible_user_id`, or **managers** when the medication is unassigned (resolver fallback). remote/elder
  excluded in SQL.
- **Task due → owner targeting.** `recipientsForItem(...,'task_due','task', taskId)` → the `assigned_to`
  owner only. **Unassigned task → resolver returns nobody**, and the existing
  `if (recipients.length === 0) continue;` makes that a clean no-op (no spam).
- **Appointment upcoming → owner targeting.** `recipientsForItem(...,'appointment_upcoming','appointment',
  appointmentId)` → the assigned member, or **managers** when unassigned (fallback). Both 24 h and 1 h
  leads preserved.
- **Visit upcoming → added.** New producer scans `family_visits` where `status='planned'` with a
  `visit_date`. Circle-tz occurrence; `start_time` when present, else `visitDateOnlyReminderHour` (09:00)
  circle-local (mirrors date-only tasks). Single lead `visitLeadMinutes` (60), lookahead
  `visitLookaheadMinutes` (20). Owner = `visitor_user_id`; unlinked visit → managers (resolver fallback);
  remote gets nothing (SQL eligibility). Deep link `/visits/{visitId}` (route
  `src/app/(app)/visits/[id].tsx` exists).
- **Task overdue → added.** New producer scans `care_tasks` where `status='open'` with `due_date` not
  null; enqueues `task_overdue` when the due datetime (same 09:00 date-only rule as `task_due`) is older
  than `now − taskOverdueGraceMinutes` (60) **and** newer than `now − taskOverdueMaxAgeHours` (24 h).
  Owner = `assigned_to`; **unassigned → nobody**. Source-validity's folded `task_due`/`task_overdue` branch
  skips it once the task is completed/cancelled/rescheduled.
- **Missed-dose → owner targeting.** `recipientsForItem(...,'medication_missed','medication', medicationId)`
  → responsible owner, or managers when unassigned (fallback).
- **Missed-dose → manager escalation (tier-2).** For an **assigned** medication (`responsible_user_id`
  not null) whose dose is still unrecorded and whose dose time is older than
  `missedDoseManagerEscalationMinutes` (120), a second alert is enqueued to
  `notification_item_managers(circle)` with `data.tier='manager'` and the `med_missed_mgr:...` key.
  Unassigned medications are **not** escalated (they already reach managers via the owner-tier fallback —
  see §8 double-notify avoidance).

## 3. Recipient-cache decision

- **`enqueue-due-reminders`: circle-level cache removed entirely.** Recipients are resolved **per item**
  (`recipientsForItem` per medication/task/appointment/visit). The old `${circleId}:${type}` cache is gone
  because `notification_recipients_for_item_event` returns the **specific item's owner**, so two items of
  the same circle+type generally have different recipients — a circle-level cache would deliver item A's
  owner list for item B. Per-run resolution cost is bounded (each occurrence resolves once; the two
  appointment leads fall in disjoint time windows, so no item double-resolves within a run).
- **`check-missed-doses`: circle-level owner cache replaced with a per-item cache.** Owner recipients are
  cached by **`${circleId}:${medicationId}`** (owner varies by medication, so a medication's several doses
  reuse one resolve). The tier-2 **manager** audience is genuinely circle-level
  (`notification_item_managers(circle)` is item-independent), so it keeps a **per-circle** cache — this is
  **not** an owner-targeted cache and is correct by construction.
- **No circle-level recipient cache remains for any owner-targeted item reminder.**

## 4. Payload contract

- **`entity` + `itemId` added everywhere.** Every item notification now carries `entity` ∈
  {`medication`,`task`,`appointment`,`visit`} and `itemId` = the entity row id
  (`medications.id`/`care_tasks.id`/`care_appointments.id`/`family_visits.id`), feeding the send-time
  ownership-currency gate in `notification_source_validity` / `notification_recipient_current`.
- **Occurrence keys preserved** (so the per-type validity branch still validates):
  - medication due/missed: `medicationId`, `scheduleId`, `doseDate`, `scheduledTime`
  - task due/overdue: `taskId`, `dueDate`, `dueTime` (task_due also keeps `dueAt`)
  - appointment: `appointmentId`, `startsAt`, `leadMinutes`
  - visit: `visitDate`, `startTime` (the visit branch keys occurrence off `itemId` + these)
- **`tier:'manager'` only on manager escalation** — set exclusively on the `med_missed_mgr` tier-2 rows;
  never on any owner-tier row.

## 5. Dedupe keys

**Existing keys preserved (unchanged formats):**
- `med:{scheduleId}:{ymd}:{time}` (medication due)
- `med_missed:{scheduleId}:{ymd}:{time}` (missed dose, owner)
- `task:{taskId}:{dueDate}:{dueTimeOr'none'}` (task due)
- `appt:{appointmentId}:{startsAt}:{lead}` (appointment)

**New keys:**
- `task_overdue:{taskId}:{dueDate}` (task overdue, owner)
- `visit:{visitId}:{visitDate}:{startTimeOr'none'}` (visit upcoming)
- `med_missed_mgr:{scheduleId}:{ymd}:{time}` (missed dose, manager tier — independent of the owner key so
  both tiers fire exactly once)

All keys remain per-recipient via the `notifications (user_id, dedupe_key)` unique index; a duplicate cron
run cannot duplicate a notification.

## 6. Privacy

- **Generic push copy unchanged.** `process-notification-outbox` was **not** modified: it still builds
  every Expo message from `genericPushMessage()` (title `سند` / body `لديك تذكير جديد`) with routing-only
  `data` (`{ type, notificationId, circleId, deepLink }`).
- **No medication names/doses in the Expo payload.** New inbox copy (`taskOverdueMessage`,
  `visitUpcomingMessage`, and the existing medication/task/appointment messages) is written **only** to
  the RLS-guarded `notifications` inbox row; producer `data` carries **ids/dates/times only** — no name,
  dose, vital, note, or diagnosis. Visit copy uses `visitor_name` (family-entered, non-medical) in the
  **inbox body only**. The generic push is unaffected by the new types.

## 7. Delivery boundary

- **No deploy.** No function was deployed or invoked; no Supabase CLI used.
- **No cron enablement / no delivery.** Nothing was scheduled; delivery stays off.
- **Apply-before-deploy ordering (hard requirement).** These producers call
  `notification_recipients_for_item_event` and `notification_item_managers`, which exist only in the inert
  migrations **`20260626163000`** and **`20260626164000`**. They must be **applied to the target DB
  first**; deploying the Edge before that would fail at runtime (unknown function / unknown enum value).
  Rollout order: apply `163000`→`164000` → (2F-5) regenerate app types + settings → deploy 2F-4B Edge →
  (2F-6) enable cron / stage delivery on.

## 8. Open product decisions

- **Visit lead time.** Chose a single conservative `visitLeadMinutes = 60` (+ `visitLookaheadMinutes = 20`,
  `visitDateOnlyReminderHour = 9`). Whether visits should use multi-lead (like appointments: 24 h + 1 h) is
  an open product call.
- **Task-overdue grace / max age.** Chose `taskOverdueGraceMinutes = 60`, `taskOverdueMaxAgeHours = 24`.
  Product may want a longer grace (e.g. next-morning) or a different backstop.
- **Missed-dose manager escalation timing.** Chose `missedDoseManagerEscalationMinutes = 120` (managers 60
  min after the owner tier). Open product number.
- **Deferred: task-overdue manager escalation.** **Not implemented** — `task_overdue` currently notifies
  the assigned owner only (unassigned → nobody). A tier-2 manager escalation for overdue tasks
  (`task_overdue_mgr:{taskId}:{dueDate}` + `data.tier='manager'`, mirroring missed-dose) is deferred to a
  later phase to keep this change focused; the resolver/validity already support it, so it is a small
  additive follow-up.
- **Minor edge — owner-is-manager.** If a medication's `responsible_user_id` is itself an admin/primary
  caregiver, that person can receive **both** the owner-tier `med_missed` and the tier-2 `med_missed_mgr`
  (distinct dedupe keys). Acceptable (they are the owner *and* a manager); flagged for product if
  de-duplication across tiers is later desired.
- **Manager-tier inbox rows vs preference.** `notification_item_managers` does not pre-filter by
  preference/eligibility; tier-2 escalation therefore creates an inbox row for every active manager, while
  the **push** is suppressed at send time for managers who opted out or are ineligible (the
  `data.tier='manager'` branch of `notification_recipient_current` re-applies
  `notification_recipient_eligible`). Pre-filtering inbox creation is a possible future refinement;
  deliberately not added here to avoid a producer-side path that bypasses/duplicates SQL logic.

## 9. Validation results

- `npm run check:mojibake` — **PASS** (266 files scanned; no mojibake signatures; new Arabic copy is
  well-encoded).
- `git -c core.autocrlf=false diff --check` — **clean** (exit 0; no whitespace/CRLF errors).
- **Deno typecheck — could not run.** `where.exe deno` returned "Could not find files" (Deno is **not
  installed** in this environment). Per the task, no install was attempted. A **static review** was done
  instead: imports match usage (no unused/dangling imports after the cache removal — `recipientsFor`/`Recipient`
  dropped from `enqueue-due-reminders`; `type Recipient` retained in `check-missed-doses` for the cache
  maps); the new producers reuse the existing, already-typed occurrence/enqueue patterns verbatim; the
  Supabase client is untyped (`data` rows are `any`, as in the pre-existing code), so the new field
  accesses introduce no new type obligations. Recommend running `deno check
  supabase/functions/enqueue-due-reminders/index.ts` and `.../check-missed-doses/index.ts` on a machine
  with Deno before 2F-6 deploy.

## 10. Confirmation

- ✅ **No SQL run.**
- ✅ **No Supabase CLI.**
- ✅ **No DB connection.**
- ✅ **No Edge deploy** (no function deployed or invoked).
- ✅ **No migrations changed** — `supabase/migrations/**` untouched.
- ✅ **No generated types changed** — `src/types/supabase.ts` untouched.
- ✅ **No app source changed** — only `supabase/functions/**` edited (Edge-only shared code + two
  producers); no `src/**`, no app screens/settings.
- ✅ **No env / secrets touched.**
- ✅ **No cron / no delivery enabled.**
- ✅ **Generic push copy unchanged** — `process-notification-outbox` not modified.
- ✅ **No SQL producer triggers created.**
- ✅ **No commit / no stage.** No other project touched.

## 11. `git` status & diff

**`git --no-pager status --short`:**
```
 M supabase/functions/_shared/config.ts
 M supabase/functions/_shared/enqueue.ts
 M supabase/functions/_shared/messages.ts
 M supabase/functions/check-missed-doses/index.ts
 M supabase/functions/enqueue-due-reminders/index.ts
```
(plus this untracked report:
`?? docs/claude-reports/2026-06-26-phase-2f-4b-edge-producers-responsibility-aware.md`)

**`git --no-pager diff --stat`:**
```
 supabase/functions/_shared/config.ts              |  20 ++
 supabase/functions/_shared/enqueue.ts             |  61 +++++-
 supabase/functions/_shared/messages.ts            |  10 +
 supabase/functions/check-missed-doses/index.ts    | 118 +++++++++---
 supabase/functions/enqueue-due-reminders/index.ts | 215 +++++++++++++++++-----
 5 files changed, 357 insertions(+), 67 deletions(-)
```
