# Phase 2F-8C - Positive push smoke-test RESULTS (executed by the user; recorded by Claude)

**Status:** Factual **record** of the user's manual positive-push smoke test - the first end-to-end
`enqueue-due-reminders` -> `process-notification-outbox` -> **real Expo push** run against a fresh, valid QA
fixture. **Claude ran no Supabase CLI, no SQL, made no DB connection, invoked no Edge Function, enabled no
cron, processed no outbox, and sent no push.** The fixture creation (app UI), every SQL precheck / post-check,
and both Edge invocations (`enqueue-due-reminders`, `process-notification-outbox`) were performed by the
**user**; this report only records their results verbatim. The only filesystem write in this phase is this
report; the only commands Claude runs are the two local read-only checks in Section 9 and the read-only git
status/diff in Section 11.

**Baseline (pushed) commit:** `2db9d47 docs(product): prepare positive push smoke test pack`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).

**Fresh QA fixture (the positive row):**

| Field | Value |
| ----- | ----- |
| task id | `08763a6a-24d6-4959-9634-cd768c3f1623` |
| title | `[QA PUSH] اختبار إشعار حقيقي` |
| status | `open` |
| assigned_to (owner / recipient) | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` |
| due_date / due_time | `2026-07-07` / `03:15:00` (circle-local) |
| circle timezone | `Asia/Riyadh` |
| due_at (UTC) | `2026-07-07 00:15:00+00` |
| created_at | `2026-07-06 23:59:42.524542+00` |

**Sources inspected read-only (no file modified):** `2F-8C` positive-push execution pack
(`2026-07-06-phase-2f-8c-positive-push-execution-pack.md`), `2F-8A` outbox-processor smoke-test plan, `2F-7H`
QA cleanup execution record. No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **The positive push smoke test PASSED.** The full producer -> processor -> Expo push chain ran once, end to
  end, against a fresh valid fixture, and delivered exactly one real push - with no collateral notifications
  and no cron.
- **A fresh `task_due` notification was created** for the owner (`a6dc7376-...`) pointing at the fresh QA task
  `08763a6a-...` (notification `c76bcdef-7e21-4f8b-ba94-8372f01f4e28`).
- **The fresh outbox row was fanned** (`3734547d-53f3-4223-9ab9-ccc068422cfd`: `pending -> fanned`).
- **Exactly one delivery row was created and marked `sent`** (`0fef9576-0854-4c6d-bb0f-6176711103ce`), mapped
  to the owner's single active token.
- **An Expo ticket id was recorded** on that delivery: `019f39e8-aadf-7733-848d-34e3c48a3e45`.
- **A real OS push arrived on the test Android device** (app `Sanad`), confirming external delivery, not just
  an in-app notification-center row.
- **The OS push copy was generic only** - title `سند`, body `لديك تذكير جديد`.
- **No private task details appeared in the OS push** - the task title and any care detail stayed out of the
  remote payload.
- **The old invalid row was safely skipped** (`945ed6ae-...`: `pending -> skipped`, `last_error = 'expired'`,
  zero deliveries, no push) - the expected co-processing behavior of the database-wide processor.
- **No notifications were created outside the QA circle** (`new_outside_qa = 0`).
- **No duplicate fresh notification** - exactly one `task_due` for the fresh task (`fresh_task_due_notifs =
  1`).
- **No cron** was enabled at any point; both Edge invocations were single, manual, user-approved calls.

---

## 2. Precheck summary

All prechecks passed before the fixture was created and before the producer ran. Recorded verbatim from the
user's read-only SQL.

- **Device-token gate - PASS.** The owner had **exactly one active push token on one device**: `total_tokens =
  1`, `active_tokens = 1`, `distinct_devices = 1`, `active_distinct_devices = 1`,
  `token_gate = 'PASS_ONE_ACTIVE_ONE_DEVICE'`. This is the only state that yields exactly one push.
- **Global pending-outbox gate (before fixture) - PASS.** `pending_total = 1`,
  `pending_expected_old_invalid = 1`, `pending_unexpected = 0`,
  `pending_gate = 'PASS_NO_UNEXPECTED_PENDING'` - the only pending row database-wide was the known old invalid
  one (`5ba7fb2d-...`); nothing unexpected the database-wide processor could co-process.
- **Fresh fixture is a valid, in-window target - PASS.** The `[QA PUSH]` task was `status = 'open'`,
  `assigned_to_owner = true`, and `in_task_due_window_now = true` (due `2026-07-07 00:15:00+00`, circle zone
  `Asia/Riyadh`, inside the producer's `[now, now + 20 min]` task-due window).
- **Resolver returned exactly the owner - PASS.** `resolved_recipients = 1`, `owner_is_recipient = true`,
  `recipient_user_ids = ["a6dc7376-fd9d-461f-9d14-41eabcd3f538"]`.
- **DB-wide task_due gate - PASS.** `task_due_in_window_total = 1`, `task_due_in_window_fresh_qa = 1`,
  `task_due_gate = 'PASS_EXACTLY_ONE_FRESH_VALID_TARGET'` - exactly one in-window open task DB-wide, and it was
  the fresh QA fixture.
- **DB-wide task_overdue gate - PASS.** `task_overdue_in_window_total = 0`,
  `task_overdue_gate = 'PASS_NO_OVERDUE'` - the fresh task is in the future, so nothing overdue.
- **Old completed task remained inert - PASS.** Task `23bff3fa-...` (`مشي سريع`) was `status = 'completed'`,
  `producer_eligible = false` - excluded from every producer scan.
- **Global pending-outbox gate (immediately before producer) - PASS.** Re-checked: `pending_total = 1`,
  `pending_expected_old_invalid = 1`, `pending_unexpected = 0`,
  `pending_gate = 'PASS_NO_UNEXPECTED_PENDING'` - unchanged; still exactly the one known old invalid row.

**Fresh-task discovery (verbatim):**

```json
[
  {
    "id": "08763a6a-24d6-4959-9634-cd768c3f1623",
    "title": "[QA PUSH] اختبار إشعار حقيقي",
    "status": "open",
    "assigned_to": "a6dc7376-fd9d-461f-9d14-41eabcd3f538",
    "assigned_to_owner": true,
    "due_date": "2026-07-07",
    "due_time": "03:15:00",
    "circle_tz": "Asia/Riyadh",
    "due_at_utc": "2026-07-07 00:15:00+00",
    "in_task_due_window_now": true,
    "created_at": "2026-07-06 23:59:42.524542+00"
  }
]
```

---

## 3. Producer result

The user manually invoked `enqueue-due-reminders` **once**.

| Field | Value |
| ----- | ----- |
| Producer invocation timestamp (UTC) | `2026-07-07T00:05:28.084Z` |
| Response `ok` | `true` |
| `medication` | `0` |
| `task` | `1` |
| `taskOverdue` | `0` |
| `appointment` | `0` |
| `visit` | `0` |

**Producer response (verbatim):**

```text
ok          : True
medication  : 0
task        : 1
taskOverdue : 0
appointment : 0
visit       : 0
```

**Notification / outbox created by the producer:**

| Field | Value |
| ----- | ----- |
| Fresh notification id | `c76bcdef-7e21-4f8b-ba94-8372f01f4e28` |
| Type | `task_due` |
| Recipient (owner) | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` |
| Fresh task id | `08763a6a-24d6-4959-9634-cd768c3f1623` |
| Dedupe key | `task:08763a6a-24d6-4959-9634-cd768c3f1623:2026-07-07:03:15:00` |
| Deep link | `/tasks/08763a6a-24d6-4959-9634-cd768c3f1623` |
| Notification created_at | `2026-07-07 00:06:07.356424+00` |
| Notification expires_at | `2026-07-07 06:15:00+00` |
| Outbox id | `3734547d-53f3-4223-9ab9-ccc068422cfd` |
| Outbox status (before processor) | `pending` |
| Outbox `available_at` / `outbox_due_now` | `2026-07-07 00:06:07.356424+00` / `true` |
| Outbox `attempt_count` / `last_error` | `0` / `null` |
| Delivery rows (before processor) | `0` |

**Focused notification / outbox check (verbatim):**

```json
[
  {
    "notification_id": "c76bcdef-7e21-4f8b-ba94-8372f01f4e28",
    "type": "task_due",
    "user_id": "a6dc7376-fd9d-461f-9d14-41eabcd3f538",
    "is_task_due": true,
    "user_is_owner": true,
    "data_item_id": "08763a6a-24d6-4959-9634-cd768c3f1623",
    "item_is_fresh_task": true,
    "deep_link": "/tasks/08763a6a-24d6-4959-9634-cd768c3f1623",
    "dedupe_key": "task:08763a6a-24d6-4959-9634-cd768c3f1623:2026-07-07:03:15:00",
    "created_at": "2026-07-07 00:06:07.356424+00",
    "expires_at": "2026-07-07 06:15:00+00",
    "outbox_id": "3734547d-53f3-4223-9ab9-ccc068422cfd",
    "outbox_status": "pending",
    "available_at": "2026-07-07 00:06:07.356424+00",
    "outbox_due_now": true,
    "attempt_count": 0,
    "last_error": null,
    "delivery_rows": 0
  }
]
```

**Old invalid row before the processor (verbatim - still untouched `pending`):**

```json
[
  {
    "outbox_id": "945ed6ae-d1f0-4a1f-ad40-ff52e0f13dce",
    "notification_id": "5ba7fb2d-cd29-470a-b2fe-f41df75051fc",
    "outbox_status": "pending",
    "last_error": null,
    "attempt_count": 0,
    "updated_at": "2026-07-06 09:34:37.469933+00"
  }
]
```

**Delivery baseline before the processor (verbatim):** `delivery_rows_total = 0`.

**Interpretation - PASS.** The producer created **exactly one intended row**: response `task = 1` with every
other counter `0`, one `task_due` notification for the owner pointing at the fresh task, and one `pending`,
due, un-fanned outbox row (`attempt_count = 0`, `last_error = null`). No deliveries existed yet, and the old
invalid row was left exactly as it was - the producer never mutates existing outbox rows.

---

## 4. Processor result

The user manually invoked `process-notification-outbox` **once**.

| Field | Value |
| ----- | ----- |
| Processor invocation timestamp (UTC) | `2026-07-07T00:09:11.601Z` |
| Response `ok` | `true` |
| `fanout.fanned` | `1` (the fresh valid row) |
| `fanout.skipped` | `1` (the old invalid row `5ba7fb2d-...`) |
| `fanout.deferred` | `0` |
| `claimed` | `1` |
| `sent` | `1` |
| `failed` | `0` |
| top-level `skipped` | `0` |
| `stale` | `0` |
| `recordErrors` | `0` |
| `invalidTokens` | `0` |

**Processor response (verbatim):**

```text
ok            : True
fanout        : @{fanned=1; skipped=1; deferred=0}
claimed       : 1
sent          : 1
failed        : 0
skipped       : 0
stale         : 0
recordErrors  : 0
invalidTokens : 0
```

**Fresh notification delivery status after the processor (verbatim):**

```json
[
  {
    "notification_id": "c76bcdef-7e21-4f8b-ba94-8372f01f4e28",
    "outbox_id": "3734547d-53f3-4223-9ab9-ccc068422cfd",
    "outbox_status": "fanned",
    "last_error": null,
    "delivery_id": "0fef9576-0854-4c6d-bb0f-6176711103ce",
    "delivery_status": "sent",
    "push_token_id": "93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8",
    "attempt_count": 1,
    "sent_at": "2026-07-07 00:09:37.358776+00",
    "expo_ticket_id": "019f39e8-aadf-7733-848d-34e3c48a3e45",
    "receipt_status": null,
    "delivery_error": null
  }
]
```

- **Fresh outbox fanned:** `3734547d-...` moved `pending -> fanned` (`last_error = null`). The outbox is never
  itself marked `sent` - delivery truth lives on the delivery row.
- **Fresh delivery sent:** exactly one `notification_push_deliveries` row (`0fef9576-...`),
  `delivery_status = 'sent'`, `attempt_count = 1`, `sent_at = 2026-07-07 00:09:37.358776+00`.
- **Expo ticket id recorded:** `019f39e8-aadf-7733-848d-34e3c48a3e45` (`receipt_status` still `null` -
  receipts are polled later by `check-push-receipts`, out of scope here).

**Old invalid row after the processor (verbatim - safely skipped):**

```json
[
  {
    "outbox_id": "945ed6ae-d1f0-4a1f-ad40-ff52e0f13dce",
    "outbox_status": "skipped",
    "last_error": "expired",
    "delivery_rows": 0
  }
]
```

**Interpretation - PASS.** The processor **successfully fanned and sent the fresh valid row** (`fanout.fanned =
1`, `claimed = 1`, `sent = 1`) and **safely skipped the old expired/invalid row** (`fanout.skipped = 1`;
`945ed6ae-...` -> `skipped`, `last_error = 'expired'`, zero deliveries, no push). There were **no invalid
tokens and no record errors** (`invalidTokens = 0`, `recordErrors = 0`, `failed = 0`, `stale = 0`, top-level
`skipped = 0`) - a clean single-send run with the expected harmless co-processing of the stale row.

---

## 5. Device observation

Recorded from the physical test device (user observation):

- **A real OS push notification arrived** on the test **Android** device - external push delivery, not merely
  an in-app notification-center row.
- **App name shown:** `Sanad`.
- **Push title shown:** `سند`.
- **Push body shown:** `لديك تذكير جديد`.
- **Time shown by the device:** about `3:09 AM`, Tuesday July 7 (consistent with the delivery `sent_at` of
  `2026-07-07 00:09:37+00` in the `Asia/Riyadh` UTC+3 circle zone).
- **No task title or private care detail appeared** in the OS push - the remote payload stayed generic.

**Interpretation - PASS.** This validates **external push delivery through Expo to the device**, not only the
creation of an in-app notification row: the generic copy rendered natively under the `Sanad` app, and no
private detail leaked into the OS-level payload.

---

## 6. Safety and privacy conclusion

- **Push-payload privacy behavior PASSED.** The delivered OS push carried only the generic copy (title `سند`,
  body `لديك تذكير جديد`); the task title and any care detail never left in the remote payload. Any specific
  detail is visible only in-app after authentication.
- **Responsibility routing PASSED.** The `task_due` source resolved to exactly the owner
  (`resolved_recipients = 1`, `owner_is_recipient = true`), and the single delivery targeted that owner's
  device.
- **Token-ownership check PASSED.** The delivery mapped to the owner's active token
  (`push_token_id = 93b4e8b8-...`, `is_active = true`, `token_owned_by_owner = true`); the raw Expo token was
  never exposed (masked to `ExponentPushToken[***]`).

  ```json
  [
    {
      "delivery_id": "0fef9576-0854-4c6d-bb0f-6176711103ce",
      "delivery_status": "sent",
      "push_token_id": "93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8",
      "is_active": true,
      "token_owned_by_owner": true,
      "token_scheme_masked": "ExponentPushToken[***]"
    }
  ]
  ```

- **No notification outside QA.** `new_outside_qa = 0` - the database-wide run created nothing beyond the QA
  circle.
- **No duplicate notification.** `fresh_task_due_notifs = 1` - the `(user_id, dedupe_key)` guard held; exactly
  one `task_due` for the fresh task.
- **Cron remains disabled.** No schedule was created; both invocations were single, manual, user-approved
  calls.
- **Do not re-run the producer or the processor now.** The positive path is proven; a further producer or
  processor run without a fresh fixture would only risk unintended state.

---

## 7. Remaining gaps

- **Expo receipt checker not tested yet** - `receipt_status` on the delivery is still `null`; the ticket ->
  receipt confirmation path has not been exercised.
- **`check-push-receipts` still pending** - the receipt-polling function has never run.
- **Cron not enabled / tested** - the engine is still invoked only manually.
- **Missed-dose producer not tested** - `check-missed-doses` and its manager escalation remain untested.
- **`task_overdue` positive producer not tested** - the overdue scan has not produced a delivered
  notification (needs its own shaped overdue fixture).
- **Positive test fixture cleanup still needed** - the fresh QA task `[QA PUSH] اختبار إشعار حقيقي`
  (`08763a6a-...`) is still `open` and should be retired so it cannot re-enter a producer window.
- **Idempotency re-run still deferred** - a true dedupe re-run against a fresh, still-open, in-window fixture
  has not been performed.

---

## 8. Recommended next phase

1. **First, commit this report.**
2. **Then choose one** (each under separate, explicit approval):
   - **`2F-8D - positive push fixture cleanup` (plan / execution)** - retire the fresh QA fixture; or
   - **`2F-9A - Expo receipt checker planning` (no execution)** - design (not run) the first
     `check-push-receipts` test to confirm the ticket -> receipt path.

**Conservative guidance:**

- **Clean up the fresh fixture first.** Prefer marking `[QA PUSH] اختبار إشعار حقيقي` (`08763a6a-...`)
  **completed through the app UI** before any further producer run, so it cannot fire again.
- **Do not enable cron yet.**
- **Do not re-run the producer or processor** until a purpose-shaped fixture and an approved plan exist.

---

## 9. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace / CRLF errors).

---

## 10. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run by Claude** (the user ran every precheck / post-check; this phase only records the results).
- **No DB connection by Claude.**
- **No additional deploy.**
- **No Edge invocation by Claude** (the user invoked `enqueue-due-reminders` and `process-notification-outbox`
  once each; Claude invoked nothing).
- **No cron enabled / created.**
- **No additional outbox processing** (Claude performed no fan-out / claim / send).
- **No additional notification delivery / push** by Claude (nothing sent).
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` not read or requested; all
  UUIDs are user / circle / task / notification / outbox / delivery / token identifiers, not secrets).
- **No raw Expo token exposed** (the token appears only masked as `ExponentPushToken[***]`; push_token_id is an
  internal uuid).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 11. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-07-phase-2f-8c-positive-push-smoke-test-results.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
