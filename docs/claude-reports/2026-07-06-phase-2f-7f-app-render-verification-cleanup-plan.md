# Phase 2F-7F - App notification-center verification record + QA cleanup planning (no execution)

**Status:** Factual **record** of the user's manual in-app verification of the notification created by the
2F-7E producer smoke test, plus a **design-only** QA cleanup plan. **Claude ran no Supabase CLI, no SQL,
made no DB connection, invoked no Edge Function, enabled no cron, processed no outbox, and sent no push.**
The only filesystem write in this phase is this report; the only commands run are the two local read-only
checks in Section 8. All UI observations below are the user's, recorded verbatim (as text - no image
binaries).

**Baseline (pushed) commit:** `a5d22d4 docs(product): record producer smoke test results`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Notification under test:** id `5ba7fb2d-cd29-470a-b2fe-f41df75051fc`, `task_due`, owner
`a6dc7376-fd9d-461f-9d14-41eabcd3f538`, task `23bff3fa-130d-4e29-96ec-80bac0647060` (`مشي سريع`).
**Sources inspected read-only:** 2F-7E, 2F-7E-alt, 2F-7D reports; `src/features/notifications/catalog.ts`;
`supabase/functions/_shared/messages.ts`; `supabase/migrations/20260611120100` (source-validity /
fan-out).

---

## 1. Executive summary

- **App notification-center verification passed.** The `task_due` notification created by the producer
  test rendered in-app.
- **Opening the notification navigated to the correct task details** (the target task `مشي سريع`).
- **This validates the in-app notification-center + deep-link portion** of the smoke test (read + render +
  route), end to end for the owner recipient.
- **No push was sent.** **No outbox processor was run.** **Cron remains off.**
- **Do not re-run `enqueue-due-reminders`** (the target can now enter the `task_overdue` window - see
  2F-7E Section 6).

---

## 2. Evidence recorded (user-provided UI observations)

**Notification Center:**

| Observation | Value |
| ----------- | ----- |
| Unread notifications shown | one (1), unread |
| Notification title | `تذكير بمهمة` |
| Notification item / body | `مشي سريع` |
| List timestamp | `2026-07-06 12:34` |
| Tap action | navigated to task details |

**Task details screen (after tapping):**

| Observation | Value |
| ----------- | ----- |
| Page header | `تفاصيل المهمة` |
| Title | `مشي سريع` |
| Due date/time | `2026-07-06 12:37` |
| Responsible | `أنا` |
| Status | `مفتوحة` |

**Interpretation:** correct in-app rendering (Arabic title + body, unread state, localized timestamp) and
correct deep-link navigation to the target task. No outbox processor was invoked; no push delivery was
tested.

### 2.1 Cross-check consistency (strengthens the record)

- **Title matches the producer copy exactly.** `taskDueMessage(taskTitle)` in
  `supabase/functions/_shared/messages.ts` returns `{ title: 'تذكير بمهمة', body: taskTitle }`. The stored
  `notifications.title` / `.body` are therefore `تذكير بمهمة` / `مشي سريع` - exactly what the app showed.
  The displayed title/body come from the notification row (producer message builder), not the app catalog.
- **Timestamp is coherent.** The row's `created_at` was `2026-07-06 09:34:37+00` (UTC); shown in the QA
  circle's local zone (UTC+3) that is `12:34` - matching the observed `2026-07-06 12:34`.
- **Due time is coherent.** The task detail's `2026-07-06 12:37` is the shaped due (`due_time 12:37:00`
  local; `current_due_at 09:37:00+00`), matching 2F-7E's Q1/Block B.
- **`Responsible: أنا` confirms owner-scoped targeting end to end.** The viewer is the assigned owner
  `a6dc7376`; the notification reached that owner and the task detail shows the responsible person as
  "me" - the same owner-only resolution proven in 2F-7C and 2F-7E, now visible in-app.
- **Deep link resolved via the explicit column.** `notificationRoute()` (catalog.ts) prefers the explicit
  `deep_link` (`/tasks/23bff3fa-...`) over the `task_due` fallback route (`/tasks`); the tap opened the
  specific task detail (`تفاصيل المهمة`), confirming the explicit deep link worked.

---

## 3. What this validates

- **A DB-created notification can be read and rendered by the app** - the inbox fetched and displayed the
  producer-created row.
- **Arabic label / copy appears correctly** - title `تذكير بمهمة` and body `مشي سريع` render right-to-left
  and legibly.
- **Notification-center unread state works** - the new row appeared as one unread notification.
- **Deep link `/tasks/23bff3fa-130d-4e29-96ec-80bac0647060` resolves to the task-details screen** - via the
  explicit `deep_link` column (catalog.ts `notificationRoute` priority: explicit `deep_link` -> `data.deepLink`
  -> type fallback).
- **Responsibility scoping is consistent end to end** - the owner received the notification and, on the
  task detail, is shown as the responsible person (`أنا`); no other member was targeted.

---

## 4. What this does NOT validate

- **External push delivery is not validated** - nothing was sent to a device / lock screen. (When a push
  is eventually sent, its copy is the generic `genericPushMessage()` = title `سند`, body `لديك تذكير جديد`
  - no health detail - not the in-app title/body above.)
- **Expo delivery / receipts are not validated** - no Expo ticket or receipt exists.
- **Outbox fan-out is not validated** - the logical outbox row was never materialized into per-device
  deliveries.
- **Cron is not validated** - no schedule exists; invocation was manual and one-shot.
- **`check-missed-doses` is not validated** - the missed-dose producer and its manager escalation are
  untested.
- **`task_overdue` is not validated** - the overdue path has not produced a notification.
- **The idempotency re-run is not validated and remains deferred** - re-running now would exercise
  `task_overdue`, not dedupe (2F-7E Section 6).

---

## 5. QA cleanup planning (design only; do not execute)

The target task was **shaped** for the smoke test and should be cleaned up later, under separate approval,
**through the app UI** (not raw SQL - the `care_tasks_collaborator_scope` trigger blocks raw content
edits when `auth.uid()` is null in the SQL Editor; see 2F-7D/2F-7E-alt).

**Target task:**

| Field | Value |
| ----- | ----- |
| task id | `23bff3fa-130d-4e29-96ec-80bac0647060` |
| title | `مشي سريع` |
| due_date after shaping | `2026-07-06` |
| due_time after shaping | `12:37:00` |
| due_date before first edit (user-reported) | `2026-06-19` |
| due_time before first edit (user-reported) | `01:10:00` |

**Caveats:**

- **There may have been intermediate suggested values** during repeated shaping (the Block C helper in
  2F-7E-alt suggests a value ~10 minutes ahead each run). Before restoring, confirm the true original
  values with the person who ran the shaping; do not assume `2026-06-19 01:10:00` is the only prior state.
- **Restoring the original due (`2026-06-19 01:10:00`) makes the task old / overdue again.** If the task
  stays `open` and the engine is ever run (manually or via cron) while the due is in the overdue window
  (`[now-24h, now-60m]`), it would fire a **`task_overdue`** notification. So restoring the old due does
  **not** make the task inert.
- **Alternative cleanup: mark the QA task `completed` or `cancelled`** (if product QA allows). A non-`open`
  task is excluded from **every** producer scan (all scans filter `status = 'open'`), so this is the
  cleanest way to make the task inert. The assigned owner (`a6dc7376`) may complete/cancel their own open
  task in-app, or a manager may; either satisfies the collaborator-scope trigger.
- **Do not delete notifications or outbox rows casually.** Cleanup targets the task's state, not the
  notification history.
- **Cleanup is a separate, explicitly-approved step** (recommended phase 2F-7G).

**Interaction with the pending outbox row (verified in source):** the outbox processor's fan-out
(`fanout_due_notifications`) and its send path both call `notification_source_validity` and **skip** a row
whose source is no longer valid. For a `task_due` row, source-validity returns `task_closed` when the task
is completed/cancelled, and `occurrence_changed` when the due date/time is changed. So **either cleanup
option (restore original due, or complete/cancel) would cause the pending outbox row to be SKIPPED - not
sent - if the outbox is ever processed.** Leaving the task exactly as shaped keeps the row eligible only
until the notification's `expires_at` (`dueAt + 6h`) passes.

---

## 6. Pending outbox risk

- **There is exactly one pending outbox row** from the producer test (2F-7E Q2:
  `outbox_rows_total = 1`, `outbox_rows_not_pending = 0`, `delivery_rows_total = 0`).
- **Do not run `process-notification-outbox` until explicitly approved.** It is the only push sender.
- **Before any future outbox test, re-check pending rows** and confirm exactly the one intended test row
  exists (rerun the 2F-7D Section 9 / 2F-7E outbox-baseline count) - no unexpected queued rows.
- **If cleanup does not delete the notification, the outbox row remains `pending` by design** - it is not
  auto-removed. As noted in Section 5, if cleanup changes the task's status or due, that pending row would
  be **skipped** (not sent) at processing time via source-validity; if the task is left as-is, the row
  stays eligible until `expires_at` (`dueAt + 6h`).

---

## 7. Current recommended next step

1. **First, commit this report.**
2. **Then choose one path** (be conservative - cleanup-first is safer before any push / outbox work):
   - **`2F-7G - QA cleanup plan / execution record (no notification processing)`** - restore or retire the
     shaped target task through the app UI (recommend complete/cancel to make it inert, or restore the
     confirmed original due), record the result, and re-confirm the outbox baseline. **Preferred first.**
   - **`2F-8A - outbox processor smoke-test planning (no execution)`** - design (not run) the first
     `process-notification-outbox` test, gated on a known test device/token, generic push copy, and
     separate explicit approval.

**Guardrails for either path:** no cron; no outbox processing yet; no re-run of `enqueue-due-reminders`;
verify the in-app row first (done, this phase).

---

## 8. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace/CRLF errors).

---

## 9. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run.**
- **No DB connection.**
- **No additional deploy.**
- **No Edge invocation.**
- **No cron enabled/created.**
- **No outbox processing** (the outbox row remains `pending`, un-fanned).
- **No notification delivery / push.**
- **No env / secrets touched.**
- **No commit / no stage.** No other project touched (ThinkMate untouched).

---

## 10. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-06-phase-2f-7f-app-render-verification-cleanup-plan.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
