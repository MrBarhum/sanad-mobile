# Phase 2F-11A — Smart, Actionable Push Notifications

Date: 2026-07-09
Scope: turn Sanad's generic push notifications into detailed, actionable reminders —
clear Arabic title/body by type, two action buttons (تم / ذكرني بعد 5 دقائق), and a
body-tap that still deep-links to the relevant detail screen.

No commits, no staging, no deploy. This report documents code changes + validation.

---

## 1. What changed

### Server / Edge (Supabase Edge Functions, Deno)

- **`supabase/functions/_shared/messages.ts`** — reworded the reminder copy to the
  target UX phrasing ("حان موعد دواء …", "حان موعد مهمة …", "حان موعد زيارة …",
  "حان موعد …" for appointments). This is the single source of the copy: the producer
  (`enqueue-due-reminders`) already writes these strings into each `notifications`
  row's `title`/`body`. Also updated the `genericPushMessage` docstring — it is now
  only a fallback, no longer the default remote payload.
- **`supabase/functions/_shared/notification-content.ts`** *(new)* — the centralized
  formatter `formatPushNotificationContent(type, row, routing)`. It returns
  `{ title, body, categoryId, data }`: the detailed title/body come from the stored
  row (robust fallback to `سند` / `لديك تذكير جديد` when the row can't be read), the
  `categoryId` is resolved from the type, and `data` merges the immutable occurrence
  context (entity, itemId, scheduleId, doseDate, scheduledTime, taskId, appointmentId…)
  with routing ids + `categoryId`. Exports `SANAD_PUSH_CATEGORY` and `pushCategoryId`.
- **`supabase/functions/_shared/expo.ts`** — added `categoryId?: string` to
  `ExpoMessage` (the Expo Push API field that maps to `categoryIdentifier` on device;
  Android + iOS).
- **`supabase/functions/process-notification-outbox/index.ts`** — the send phase now
  batch-reads the claimed notifications' stored `title/body/data` (one read-only
  `select … in(ids)`), and builds each Expo message via `formatPushNotificationContent`
  (detailed title/body + `categoryId` + occurrence `data`). A read failure is
  non-fatal (falls back to generic copy). Header/inline comments updated to document
  the product decision. **No token / title / body / health detail is logged.**

### Client (React Native, expo-notifications)

- **`src/features/notifications/push-registration.ts`** — added:
  - `SANAD_NOTIFICATION_CATEGORY` (5 ids) and `SANAD_NOTIFICATION_ACTION`
    (`complete`, `snooze_5`).
  - `ensureNotificationCategories()` — registers the action categories at startup
    (idempotent, no permission prompt, no-op on web).
  - `scheduleSnoozeNotification()` — schedules a local reminder ~5 min out reusing the
    same title/body/data/deep-link/category, with a deterministic id + cancel-first so
    re-snoozing never stacks duplicates.
- **`src/features/notifications/actions.ts`** *(new)* — `completeForNotification(type,
  data, userId)`: maps a notification type to its **existing** safe domain mutation and
  returns an outcome (`completed` / `needs-confirm` / `unauthenticated` / `error`). No
  new DB writes are invented. Plus `doneMessage(type)` for the confirmation copy.
- **`src/features/notifications/hooks.ts`** — the notification-response listener now
  branches on `actionIdentifier`: `snooze_5` → local snooze; `complete` → safe
  completion (then confirm, or open detail on failure/missing session); default tap →
  the existing deep-link behavior (unchanged). Categories are registered in the
  one-time config effect. Dedupe is now per `(notification, action)`.

---

## 2. Exact notification text matrix by type

The push now carries the reminder's **stored** title/body (authored by the producer
via `messages.ts`). `<…>` = the family-entered name/title; `HH:MM` = Western digits;
`X` = the lead ("ساعة"/"دقيقة").

| Type | Title | Body | Category |
|---|---|---|---|
| `medication_due` | `حان موعد الدواء` | `حان موعد دواء <name> — الساعة HH:MM` | `sanad_medication_reminder` |
| `medication_missed` | `جرعة لم تُسجَّل` | `لم يُسجَّل بعد تناول جرعة <name> المقررة الساعة HH:MM.` | `sanad_medication_reminder` |
| `task_due` | `حان موعد المهمة` | `حان موعد مهمة <title>` | `sanad_task_reminder` |
| `task_overdue` | `مهمة تجاوزت وقتها` | `ما زالت مهمة <title> مفتوحة.` | `sanad_task_reminder` |
| `appointment_upcoming` | `موعد قادم` | `حان موعد <title> — بعد X` | `sanad_appointment_reminder` |
| `visit_upcoming` | `زيارة قادمة` | `حان موعد زيارة <name> — بعد X` | `sanad_visit_reminder` |
| **Fallback** (source row unreadable) | `سند` | `لديك تذكير جديد` | (per type) |

Notes:
- The reminder cron (`enqueue-due-reminders`) currently emits `medication_due`,
  `task_due`, `task_overdue`, `appointment_upcoming`, `visit_upcoming`. The
  `medication_missed` / `visit_update` rows above are covered by the mapping for when
  they are produced.
- Copy stays medically neutral (names + times only; no interpretation), per the
  product's medical-safety boundary.

---

## 3. Action categories / actions registered

Registered at app startup via `setNotificationCategoryAsync` (ids use `_` only — no
`:` or `-`, per Expo's warning):

| Category id | Actions |
|---|---|
| `sanad_medication_reminder` | `complete` ("تم"), `snooze_5` ("ذكرني بعد 5 دقائق") |
| `sanad_task_reminder` | `complete`, `snooze_5` |
| `sanad_visit_reminder` | `complete`, `snooze_5` |
| `sanad_appointment_reminder` | `complete`, `snooze_5` |
| `sanad_generic_reminder` | `snooze_5` only |

Both actions use `opensAppToForeground: true` (see §6 for why). The server attaches
the category through the Expo Push API `categoryId` field; the device maps it to the
registered category and renders the buttons (Android + iOS).

---

## 4. What "تم" does per type

Handled by `completeForNotification`, using only **existing** app mutations:

| Type | Action | Idempotency |
|---|---|---|
| `task_due` / `task_overdue` | `completeTask(taskId, userId, now)` → `care_tasks.status = 'completed'` | Re-tap just re-sets completed (safe). |
| `visit_upcoming` / `visit_update` | `setVisitStatus(visitId, 'completed')` → `family_visits.status = 'completed'` | Re-tap re-sets completed (safe). |
| `appointment_upcoming` | `setAssignedAppointmentOutcome(appointmentId, 'completed')` (RPC: manager or assigned member, only from `scheduled`) | Second tap errors (not `scheduled`) → opens the detail screen. |
| `medication_due` / `medication_missed` | `insertLog({ …schedule occurrence…, status: 'given' })` | Unique index `(schedule_id, dose_date, scheduled_time)` → already-recorded dose is treated as done and **not** overwritten. |
| any other type | — | Opens the detail/inbox with a confirm intent. |

Fallbacks: if the session is missing (e.g. cold start before auth restores), or the
payload lacks the context to act safely, or the mutation fails, "تم" **opens the
relevant detail screen** (via the existing deep link) instead of failing silently.
After a successful completion it shows a brief Arabic confirmation and refreshes the
affected screens.

---

## 5. What "ذكرني بعد 5 دقائق" does

- Schedules a **local** notification ~5 minutes out (min 60s), reusing the original
  clear title/body, `data`, deep link and category — so the same text and buttons
  reappear and tapping it still routes correctly.
- Uses a deterministic id `sanad_snooze_<notificationId>` and cancels any prior snooze
  for that reminder first → **no duplicate snoozes** for the same notification.
- Adds `snoozed: true` to the data. **No server state is changed** (no `due_time`
  mutation) — a safe v1 snooze, since no existing safe server snooze API exists.
- Shows a brief confirmation ("سيصلك تذكير بعد 5 دقائق").

---

## 6. Unsupported / deferred, and why

- **Background completion without opening the app** — not implemented. Both actions
  use `opensAppToForeground: true`. Reason: the completion mutations run against the
  user's authenticated Supabase session (RLS); running headlessly would need a
  registered background task and would risk acting without a valid session. Opening to
  foreground gives reliable auth + lets us open the detail screen when a session is
  missing. (v1 trade-off: a quick app flash on "تم".)
- **Server-side snooze (moving the real reminder time)** — not implemented; no
  existing safe server snooze API. v1 uses a local snooze only.
- **Appointment "تم" idempotency** — the outcome RPC only transitions from
  `scheduled`, so a second "تم" opens the detail screen instead of being a silent
  no-op. Acceptable and non-destructive.
- **Local snooze action buttons on Android** — the remote push category
  (`categoryId`) is Android+iOS. For the *local* snooze, `content.categoryIdentifier`
  is documented iOS in the input type; on Android the buttons reappear because the
  category is registered, but this specific path is flagged for on-device
  verification.
- **`sanad_generic_reminder`** carries snooze only (no "تم") because completion
  semantics only apply to the four completable entities.

---

## 7. Validation results

Read-only checks (no login, deploy, or backend mutation):

| Check | Result |
|---|---|
| `npm run check:mojibake` | **PASS** — scanned 267 files, no mojibake signatures |
| `git -c core.autocrlf=false diff --check` | **PASS** — clean (no whitespace/encoding issues) |
| `npx tsc --noEmit` | **PASS** — exit 0, no type errors |
| `npm run lint` (`expo lint`) | Repo baseline is already red (`react-hooks/*` rules fail in untouched files, e.g. `use-unsaved-changes.ts`). **My changed files add zero new errors**: `actions.ts` and the `push-registration.ts` additions are clean; the 2 errors reported on `hooks.ts` are on **pre-existing** lines I did not add (`setPermission` in `usePushRegistration`, `openRef.current = open`) — confirmed by diffing added lines. `userIdRef` is synced in an effect to stay lint-clean. |

`supabase/functions` is excluded from the app `tsconfig` (Deno code), so it is not
type-checked by `tsc`; it was reviewed manually and by the adversarial review pass
below. Supabase CLI / Deno were not run (per constraints).

### Adversarial review

A multi-agent review of the diff (server / client / safety / edge-cases dimensions,
each finding independently verified by a skeptic) surfaced 11 candidate issues, of
which **5 were confirmed**. **4 are fixed** in this change; **1 (low) is documented**.
All post-fix checks above were re-run green. Details in §9.

---

## 8. Manual QA plan (S24 Ultra: Android, Arabic, RTL, dark mode)

Preconditions: signed in, push enabled, an active reminder for each type. (Cannot be
DB-seeded here — no test fixtures per constraints.)

1. **Detailed title/body** — trigger a task reminder; confirm the push shows
   "حان موعد المهمة" / "حان موعد مهمة `<title>`" (not the old generic text).
2. **Action buttons appear** — confirm "تم" and "ذكرني بعد 5 دقائق" render on the
   medication / task / visit / appointment reminders.
3. **Tap opens detail** — tap the body; confirm it deep-links to the entity detail
   (task/visit/appointment) or the medications screen, switching circle if needed.
4. **"ذكرني بعد 5 دقائق"** — press it; confirm the confirmation alert, and that a
   local reminder with the **same** text + buttons fires ~5 min later. Press it twice
   and confirm only **one** snooze fires (no duplicate).
5. **"تم" completes** —
   - Task: press "تم"; confirm the task becomes completed and the list refreshes.
   - Visit: press "تم"; confirm status → completed.
   - Appointment: press "تم"; confirm status → completed (and a second "تم" opens the
     detail screen, not an error).
   - Medication: press "تم"; confirm the dose is recorded as given; pressing "تم"
     again does not create a duplicate log and does not overwrite a prior outcome.
6. **Unauthenticated / cold start** — from a killed app, tap "تم"; confirm the app
   opens to the detail screen rather than failing silently.
7. **Accessibility / RTL** — verify Arabic reads right-to-left, times use Western
   digits and read correctly, and dark mode looks right.

---

## 9. Risks / known limitations

- **Privacy reversal (intentional, product-directed):** the lock-screen push now
  shows the medication/task/visit/appointment name. This is the explicit Phase 2F-11A
  product decision (documented in code comments), reversing the prior privacy-generic
  default. If privacy is later required per-user, gate detailed copy behind a
  preference and fall back to `genericPushMessage()`.
- **Deploy dependency:** the detailed push requires deploying **both** the reworded
  `enqueue-due-reminders` (writes target copy) and `process-notification-outbox`
  (reads + sends it). If only the processor ships, it still sends detailed text using
  whatever copy existing rows carry (forward-compatible, no breakage). *(Deploy is out
  of scope for this phase.)*
- **"تم" opens the app** (foreground) rather than acting purely in the background —
  see §6.
- **Appointment double-"تم"** opens the detail screen instead of being a pure no-op.
- **Local snooze buttons on Android** need on-device confirmation (§6).
- **Broad cache refresh:** a successful "تم" calls `queryClient.invalidateQueries()`
  (all active queries) for simplicity; correct but slightly broad.

### Adversarial-review findings & resolutions

| # | Sev | Finding | Resolution |
|---|---|---|---|
| 1 | high | Re-snoozing the same reminder was silently dropped from the 3rd snooze on: the session-long `handled` set deduped by `(id, action)`, and the local snooze reuses a deterministic id, so repeated deliveries collapsed to one key. | **Fixed** — dedupe key now includes `response.notification.date`, so the launch-double is still deduped but each fresh delivery is processed. |
| 2 | med | The native last-notification-response was never cleared, so on observer remount (logout→login same process) or a JS reload it replayed — re-navigating and (now) re-running "تم". | **Fixed** — `clearLastNotificationResponseAsync()` is called after the cold-start response is routed, consuming it once. |
| 3 & 4 | med | Medication "تم" caught the unique-violation and always showed "تم تسجيل الجرعة", even when a prior log stood as `missed`/`postponed` — false reassurance in a medical context. | **Fixed** — on unique violation it reads the existing dose status; reports success only if it was already `given`, otherwise returns `needs-confirm` and opens the medications screen to reconcile. |
| 5 | low | A manager re-tapping a stale "تم" for an already-completed **task** rewrites `completed_by`/`completed_at` (last-writer-wins attribution drift); the task stays completed. | **Documented (not fixed)** — the safe fix (guarding the shared `completeTask` with `.eq('status','open')`) is out of scope for this phase and affects other callers; fixing #1 and #2 removes the main replay trigger, leaving only a rare manual double-tap with cosmetic impact. Suggested follow-up: scope `completeTask` to open tasks. |

## 10. Final verdict

**Ready for review and on-device QA.** The change delivers the requested behavior:
detailed, medically-neutral Arabic push copy by type; two action buttons (تم / ذكرني
بعد 5 دقائق) via registered categories; body-tap deep-linking preserved; "تم" wired
only to existing safe domain mutations (no invented DB writes) with honest,
idempotent handling; and a safe local 5-minute snooze with duplicate protection. All
read-only checks pass (`tsc`, `check:mojibake`, `git diff --check`), lint adds no new
errors, and the adversarial review's confirmed issues are fixed or documented. It
respects every hard constraint (no secrets, no token/health logging, no SQL
mutations, no cron/edge/deploy actions, no new deps, no commit/stage).

**Not done here (by design):** no deploy — the detailed copy takes full effect once
both `enqueue-due-reminders` and `process-notification-outbox` are deployed; and the
remote/local action buttons need on-device confirmation on the S24 Ultra.

---

## Sanad UI/UX change report

### What changed
- Server copy (`messages.ts`) reworded to clear Arabic reminder phrasing; the push now
  sends the detailed stored title/body via a single formatter.
- Added notification action buttons ("تم" / "ذكرني بعد 5 دقائق") with type-specific,
  safe completion and a local 5-minute snooze; body-tap deep-linking unchanged.

### Why
- Caregivers get an at-a-glance, actionable reminder (clarity + calm), and can act in
  one tap without hunting through the app — while medical-safety wording and the
  deep-link behavior are preserved.

### Design rules honored
- RTL/Arabic: all copy Arabic-first; times use Western digits inside an Arabic body
  (matches existing `messages.ts` convention); no hardcoded left/right.
- Accessibility: text labels on both action buttons (not icon-only); clear
  confirmation copy; opens detail rather than failing silently.
- Icons/encoding: no new raw Unicode glyph literals; `check:mojibake` clean; UTF-8/LF
  intact; `git diff --check` clean.
- Tokens: no visual tokens touched (copy/behavior only).
- Medical safety: copy states the recorded fact (name + time) only — no
  interpretation; emergencies excluded from snooze.

### Preserved (no regressions)
- [x] Date/time picker fixes intact (untouched)
- [x] Notification opt-in / channel-before-permission intact (categories register
  without prompting; channel creation unchanged)
- [x] Validation passes (`tsc --noEmit`, `check:mojibake`, `git diff --check`); lint
  adds no new errors

### Needs real-device check (S24 Ultra, AR/RTL/dark)
- Action buttons render for remote push; local snooze buttons on Android; cold-start
  "تم" opens detail; medication dose idempotency.

### Constraints respected
- [x] No backend/secret/deploy actions; no SQL mutations; no cron changes; no Edge
  Function manual invocation; no Supabase CLI / EAS
- [x] No new dependencies
- [x] No `git add` / no commit / no push / no deploy
- [x] Stayed inside `E:\Projects\sanad-mobile`

### Open questions / suggested follow-ups
- Confirm the privacy reversal is the desired long-term default (vs a per-user toggle).
- Consider deep-linking `medication_due` to the medication detail (currently the list)
  in a later pass.
