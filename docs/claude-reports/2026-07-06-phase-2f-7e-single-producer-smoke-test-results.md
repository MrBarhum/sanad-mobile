# Phase 2F-7E - Single-producer smoke-test results record (no outbox)

**Status:** Factual **record** of the user's manual, one-shot invocation of the `enqueue-due-reminders`
Edge producer, plus the read-only post-invocation inspection they ran. **Claude ran no Supabase CLI, no
SQL, made no DB connection, invoked no Edge Function, enabled no cron, processed no outbox, and sent no
push.** The single Edge invocation was performed by the **user**, not Claude. The only filesystem write in
this phase is this report; the only commands run are the two local read-only checks in Section 9. All
result values below are the user's, recorded verbatim.

**Baseline (pushed) commit:** `9c951a4 docs(product): prepare fixture shaping preview pack`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Target task:** `23bff3fa-130d-4e29-96ec-80bac0647060` (`مشي سريع`), owner
`a6dc7376-fd9d-461f-9d14-41eabcd3f538`.
**Sources inspected read-only:** 2F-7E-alt, 2F-7D, 2F-7C reports; `enqueue-due-reminders/index.ts`,
`_shared/enqueue.ts`.

---

## 1. Executive summary

- **The single-producer smoke test passed.**
- **Exactly one `task_due` notification was created** (id `5ba7fb2d-cd29-470a-b2fe-f41df75051fc`).
- **It targeted the expected owner and task** - `user_id = a6dc7376-...`, `data.itemId = 23bff3fa-...`,
  `deep_link = /tasks/23bff3fa-...`.
- **No other producer type fired** - the response counters `medication / taskOverdue / appointment /
  visit` were all `0`.
- **No notification outside the QA circle** (Q3: `new_notifications_outside_qa = 0`).
- **The outbox row exists but remains `pending`** (Q2: `outbox_rows_total = 1`,
  `outbox_rows_not_pending = 0`).
- **No delivery rows** (Q2: `delivery_rows_total = 0`).
- **No push sent. No cron. No outbox processor invoked.**
- **Do not re-run the producer now** - the target task can now enter the `task_overdue` window; an
  idempotency re-run is intentionally deferred (Section 6).

---

## 2. Pre-invocation gate

**Target task state (Block B, before invocation):**

| Field | Value |
| ----- | ----- |
| id | `23bff3fa-130d-4e29-96ec-80bac0647060` |
| title | `مشي سريع` |
| status | `open` |
| owner_id | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` |
| owner_is_expected | `true` |
| is_open | `true` |
| due_date | `2026-07-06` |
| due_time | `12:37:00` (circle-local; circle tz is UTC+3) |
| current_due_at | `2026-07-06 09:37:00+00` |
| in_task_due_window_now | `true` |

**Database-wide eligibility gate (Block P6, before invocation):**

| Field | Value |
| ----- | ----- |
| target_notifications | `1` |
| other_notifications_all_circles | `0` |
| total_notifications_if_invoked | `1` |
| status | `PASS_EXACTLY_ONE_TARGET_ELIGIBLE` |

**Why this allowed exactly one manual invocation:** the gate is database-wide (the producer scans every
circle). `PASS_EXACTLY_ONE_TARGET_ELIGIBLE` proved that, across the whole project, exactly one item - the
target task - would resolve to exactly one recipient (its owner), and **zero** other items in **any**
circle were in any producer window. Combined with the clean outbox baseline (2F-7C: 0 pending), a single
invocation could create **at most one** notification. That made a controlled one-shot invocation safe.

---

## 3. Invocation result

| Field | Value |
| ----- | ----- |
| Function | `enqueue-due-reminders` (producer only; no push) |
| Invoked by | the user (not Claude) |
| Invocation UTC timestamp | `2026-07-06T09:34:09.306Z` |
| Response `ok` | `true` |
| Response `medication` | `0` |
| Response `task` | `1` |
| Response `taskOverdue` | `0` |
| Response `appointment` | `0` |
| Response `visit` | `0` |

**Interpretation:** `task = 1` and every other counter `= 0`, with `ok = true`. These counters are summed
across the whole database (all circles), so they are the authoritative confirmation that **exactly one**
notification was created anywhere - a single `task_due`, matching the P6 prediction. No medication, task
overdue, appointment, or visit reminder fired.

---

## 4. Post-invocation inspection

### Q1 - per-row detail

| Field | Value |
| ----- | ----- |
| notification id | `5ba7fb2d-cd29-470a-b2fe-f41df75051fc` |
| user_id | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` |
| type | `task_due` |
| data.entity | `task` |
| data.itemId | `23bff3fa-130d-4e29-96ec-80bac0647060` |
| deep_link | `/tasks/23bff3fa-130d-4e29-96ec-80bac0647060` |
| dedupe_key | `task:23bff3fa-130d-4e29-96ec-80bac0647060:2026-07-06:12:37:00` |
| created_at | `2026-07-06 09:34:37.469933+00` |
| row_check | `MATCH_TARGET` |

### Q2 - summary counts (QA circle)

| Field | Value |
| ----- | ----- |
| total_notifications | `1` |
| target_task_due_rows | `1` |
| non_task_due_rows | `0` |
| remote_rows | `0` |
| outbox_rows_total | `1` |
| outbox_rows_not_pending | `0` |
| delivery_rows_total | `0` |
| status | `PASS_ONE_TARGET_ONLY_NO_PROCESSING` |

### Q3 - database-wide guard

| Field | Value |
| ----- | ----- |
| new_notifications_all_circles | `1` |
| new_notifications_outside_qa | `0` |
| status | `PASS_ONE_TOTAL_NONE_OUTSIDE_QA` |

**Interpretation:**

- **The notification row matched the target** exactly (`MATCH_TARGET`): correct recipient, type,
  `data.entity`/`data.itemId`, deep link, and dedupe key.
- **No `remote_member` row** (`remote_rows = 0`) - the read-only observer received nothing.
- **The outbox holds exactly one row, still `pending`** (`outbox_rows_total = 1`,
  `outbox_rows_not_pending = 0`) - un-fanned, not processed.
- **Zero delivery rows** (`delivery_rows_total = 0`) - no fan-out into per-device deliveries occurred.
- **No notifications outside the QA circle** (`new_notifications_outside_qa = 0`) - the database-wide scan
  created nothing anywhere else.

### 4.1 Cross-check consistency (strengthens the record)

- **The `dedupe_key` matches the producer formula exactly.** `enqueue-due-reminders` builds
  `task:<task.id>:<due_date>:<due_time or 'none'>`; with `due_date = 2026-07-06` and raw
  `due_time = 12:37:00`, the recorded key `task:23bff3fa-...:2026-07-06:12:37:00` is exactly what the code
  produces.
- **Timing is coherent:** invoked at `09:34:09Z`, the row was created at `09:34:37Z` (~28 s later), and
  `current_due_at` was `09:37:00Z` - about 2.85 minutes ahead, inside the `task_due` window
  `[now, now+20m]`.
- **`enqueue_notification` behaved as documented:** one `notifications` row + one `notification_outbox`
  row (`status = 'pending'`) + zero `notification_push_deliveries` - exactly the producer-only,
  no-processing shape predicted in 2F-7D.
- **The global response counters (`task:1`, others `0`) agree with Q1/Q2/Q3** - one notification total,
  in the QA circle, to the expected owner.

---

## 5. Safety conclusions

- **The producer path works** end-to-end under a real Edge invocation: `enqueue-due-reminders` created the
  intended `task_due` notification.
- **Responsibility-aware recipient resolution worked under a live invocation** - the assigned `task_due`
  resolved to exactly the one owner (owner-only, no manager fallback), and `remote_member` was excluded -
  matching the resolver behavior proven read-only in 2F-7C, now confirmed through the producer.
- **The broad, database-wide scan did not create extra notifications** - despite scanning every circle,
  only the single shaped target fired (Q3 confirms nothing outside QA).
- **The outbox remained unprocessed** - one `pending` row, zero deliveries; the logical job was created
  but never fanned out.
- **No push happened** - `enqueue-due-reminders` does not send push, and the outbox processor was not
  invoked.
- **This validates the producer-only stage, not push delivery.** Fan-out and external Expo delivery remain
  untested (Section 7).

---

## 6. Idempotency decision

- **An idempotency re-run was planned in 2F-7D** (re-invoke the same producer, expect no duplicate via the
  `(user_id, dedupe_key)` unique index / `on conflict do nothing`).
- **It should NOT be performed now.** Time has passed since the due instant (`09:37:00Z`), and a later
  preview showed the target task can now enter the **`task_overdue`** window (`[now-24h, now-60m]`) while it
  remains `open`.
- **Re-running `enqueue-due-reminders` now would exercise a different producer path, not pure dedupe.** The
  `task_due` window (`[now, now+20m]`) has closed, so the `task_due` scan would no longer match the target;
  instead the `task_overdue` scan would match it and enqueue a **new** notification with a **different
  dedupe key** (`task_overdue:23bff3fa-...:2026-07-06`) - an extra row, not a suppressed duplicate. That
  would test overdue, not idempotency.
- **Defer idempotency to a separately shaped fixture** where the same `task_due` dedupe key is still
  in-window (i.e., the target's due time is again within `[now, now+20m]`) **and** no `task_overdue`
  window is active for it - so a re-run genuinely tests dedupe suppression on the identical key.

---

## 7. Remaining gaps / next risks

- **Outbox processor untested** - `process-notification-outbox` (fan-out + claim/send) has never run; the
  one outbox row is still `pending`.
- **Push delivery untested** - no `notification_push_deliveries`, no Expo send, no receipts.
- **Cron still disabled** - no schedule exists; the engine is still invoked only manually.
- **`check-missed-doses` untested** - the missed-dose producer (and its tier-2 manager escalation) has not
  been exercised.
- **`task_overdue` path untested** - the overdue scan has not produced a notification yet (and must be
  tested with its own shaped fixture, not by an accidental re-run here).
- **App notification-center rendering should be manually checked** (if not already) - confirm the new
  `task_due` row renders with the correct label / glyph and resolves `/tasks/<id>` in-app **before** any
  push stage.
- **The target task's due date may need QA cleanup / restoration** - it was shaped to `2026-07-06 12:37`
  local for this test; a separate QA cleanup plan should restore or retire it (do not delete casually).

---

## 8. Recommended next phase

Be conservative - do **not** enable cron, do **not** process the outbox, and do **not** re-run
`enqueue-due-reminders` until a properly shaped fixture and explicit approval exist. Recommended next,
either:

- **`2F-7F - producer smoke-test results commit / QA cleanup planning`** - record/commit this result and
  plan the reversible cleanup of the shaped target task (restore its original due date), plus a re-shaped
  fixture for a true idempotency re-run; **or**
- **`2F-8A - outbox processor smoke-test planning (no execution)`** - design (not run) the first
  `process-notification-outbox` test, gated on: first verifying the in-app notification-center row renders
  correctly, using a known test device/token, keeping generic push copy, and requiring separate explicit
  approval before any fan-out or send.

Guardrails for whichever is chosen: verify the in-app notification-center row first if possible; do not
enable cron; do not process the outbox until explicit approval; do not re-run `enqueue-due-reminders`.

---

## 9. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace/CRLF errors).

---

## 10. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run in this report phase** (the user ran the read-only inspection earlier; this phase only
  records the results).
- **No DB connection.**
- **No additional deploy.**
- **No Edge invocation by Claude** (the single producer invocation was performed by the user).
- **No cron enabled/created.**
- **No outbox processing** (the outbox row remains `pending`, un-fanned).
- **No notification delivery / push** (zero delivery rows; nothing sent).
- **No env / secrets touched** (identifiers recorded are user/circle/item/notification UUIDs from the
  user's results; no secret values).
- **No commit / no stage.** No other project touched (ThinkMate untouched).

---

## 11. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-06-phase-2f-7e-single-producer-smoke-test-results.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
