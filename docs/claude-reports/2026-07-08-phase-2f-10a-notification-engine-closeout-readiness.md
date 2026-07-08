# Phase 2F-10A - Notification engine CLOSEOUT / READINESS ASSESSMENT (analysis only; no execution)

**Status:** Read-only **closeout and readiness assessment** consolidating the 2F-7 -> 2F-9C notification-engine
QA arc. This report only reads existing reports, Edge source, shared modules, and migrations, and synthesizes
what is **proven**, what **remains**, and what the **risks** are before any scheduled (cron) execution.
**Claude ran no Supabase CLI, no SQL, made no DB connection, invoked no Edge Function, enabled no cron,
processed no outbox, checked no receipts, and sent no push.** The only filesystem write in this phase is this
report; the only commands Claude runs are the two local read-only checks in Section 8 and the read-only git
status/diff in Section 10.

**Baseline (pushed) commit:** `678e196 docs(product): record fresh receipt fixture cleanup` (`## master...origin/master`, clean/synced).
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Owner user (recipient / token owner):** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.

**Sources inspected read-only (no file modified):**

- Reports: `2F-9C` (`2026-07-08-...-fresh-receipt-fixture-cleanup-record.md`), `2F-9B`
  (`2026-07-08-...-expo-receipt-checker-smoke-test-results.md`), `2F-9A`
  (`2026-07-07-...-expo-receipt-checker-plan.md`), `2F-8D`
  (`2026-07-07-...-positive-push-fixture-cleanup-record.md`), `2F-8C` results
  (`2026-07-07-...-positive-push-smoke-test-results.md`) and execution pack
  (`2026-07-06-...-positive-push-execution-pack.md`); plus the 2F-7 series (see Section 2).
- Edge source: `supabase/functions/enqueue-due-reminders/index.ts`,
  `supabase/functions/process-notification-outbox/index.ts`, `supabase/functions/check-push-receipts/index.ts`.
- Shared: `_shared/config.ts` (`REMINDER_CONFIG`), `_shared/auth.ts` (`authorizeScheduledRequest`, fail-closed),
  `_shared/enqueue.ts` (`recipientsForItem` / `enqueueForRecipient`), `_shared/messages.ts`
  (`genericPushMessage` -> `سند` / `لديك تذكير جديد`), `_shared/expo.ts` (`sendExpoPush` / `getExpoReceipts` /
  `isUnregisteredError`).
- Migrations: `20260611120000_create_notifications_core.sql` (tables/enums/RLS),
  `20260611120100_create_notification_functions.sql` (`enqueue_notification`, `fanout_due_notifications`,
  `claim_push_deliveries`, `mark_delivery_*`, `record_delivery_receipt`, `mark_stale_receipts_unchecked`,
  `deactivate_push_token_*`, `notification_source_validity`, `register_push_token`),
  `20260626164000_notifications_responsibility_resolvers.sql`
  (`notification_recipient_eligible`, `notification_item_owner/managers`,
  `notification_recipients_for_item_event`, `notification_recipient_current`, source-validity 2F-2 branches),
  `20260626163000_notifications_responsibility_types_preferences.sql` (enum + preference context).

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **What is proven (end to end, on real hardware).** The full **`task_due`** path is demonstrated live twice:
  **producer (`enqueue-due-reminders`) -> outbox fan-out + claim/send (`process-notification-outbox`) ->
  real Android OS push (generic payload) -> Expo ticket -> receipt `ok`** (`check-push-receipts`), plus the
  **retention sweep -> `unchecked`** path and **fixture cleanup -> source-validity `task_closed`**.
  Responsibility routing resolved to exactly the owner; no push carried private detail; no collateral
  notifications, deliveries, or token changes occurred.
- **Current engine state (database-wide):**
  - **Outbox:** `fanned = 2`, `skipped = 1`, **no `pending`**.
  - **Deliveries:** `sent` / `receipt_status = 'ok'` = `1` (2F-9B `60cd396b-...`); `sent` /
    `receipt_status = 'unchecked'` = `1` (2F-8C `0fef9576-...`, `retention_window`).
  - **QA fixtures:** **both completed** - `[QA PUSH]` (`08763a6a-...`, closed in 2F-8D) and `[QA RECEIPT]`
    (`5cfcdb5d-...`, closed in 2F-9C at `2026-07-08 04:40:06.116+00`).
- **Cron is OFF.** No `pg_cron` schedule exists; every producer / processor / receipt-checker invocation across
  the whole arc was a single, manual, user-approved call.
- **No pending outbox remains** - nothing is queued waiting to process.
- **All QA fixtures are completed** - no open QA task can re-enter a producer window.
- **Readiness verdict: the engine is READY for cron *planning* (2F-10B), NOT for cron *execution*.** The
  positive `task_due` path and the safety/idempotency machinery are proven for a single manual cadence, but
  scheduled orchestration, the missed-dose and `task_overdue` producers, an idempotency re-run, and production
  observability are **untested** (Section 4). Cron must be **designed and reviewed** before it is enabled.

---

## 2. Evidence inventory

### 2.1 Report arc (what each proved / produced)

| Report | What it established |
| ------ | ------------------- |
| `2F-7A` notification smoke-test planning pack | Planned the first producer smoke test (no execution). |
| `2F-7B` read-only resolver verification SQL pack | Authored read-only SQL to verify the responsibility resolvers (no execution). |
| `2F-7C` resolver verification results record | Recorded the resolver / eligibility behavior verified read-only (routing + role gates). |
| `2F-7D` single-producer smoke-test plan | Planned a single `enqueue-due-reminders` run against a shaped fixture. |
| `2F-7E` alt-fixture shaping preview + single-producer results | Producer created exactly the intended in-app notification / outbox row from a shaped fixture (no push yet). |
| `2F-7F` app-render verification / cleanup plan | Planned in-app render verification and fixture cleanup. |
| `2F-7G` / `2F-7H` QA cleanup plan / execution record | Retired the 2F-7 fixtures; established the clean pre-push baseline. |
| `2F-8A` outbox-processor smoke-test plan | Planned the processor (fan-out + claim/send) smoke test (no execution). |
| `2F-8C` positive-push execution pack + results | **PASSED:** producer -> processor -> **real Android OS push** with generic payload; one `sent` delivery + Expo ticket; old invalid row safely co-processed to `skipped`. |
| `2F-8D` positive-push fixture cleanup record | **PASSED:** `[QA PUSH]` task completed via app UI; delivery evidence intact; source-validity -> `task_closed`. |
| `2F-9A` Expo receipt-checker plan | Audited `check-push-receipts` behavior; designed the ticket -> receipt test (no execution). |
| `2F-9B` Expo receipt-checker smoke-test results | **PASSED:** fresh in-window target -> `check-push-receipts` recorded `receipt_status = 'ok'`; old expired row swept to `unchecked`; no collateral writes. |
| `2F-9C` fresh receipt fixture cleanup record | **PASSED:** `[QA RECEIPT]` task completed via app UI; receipt evidence intact; source-validity -> `task_closed`; no pending outbox. |

### 2.2 Key identifiers

| Scope | Field | Value |
| ----- | ----- | ----- |
| Common | QA circle | `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`) |
| Common | Owner user (recipient) | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` |
| Common | Owner active push token id | `93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8` (masked scheme only; raw token never exposed) |
| **2F-8C** | task | `08763a6a-24d6-4959-9634-cd768c3f1623` (`[QA PUSH] اختبار إشعار حقيقي`, now `completed`) |
| **2F-8C** | notification | `c76bcdef-7e21-4f8b-ba94-8372f01f4e28` (`task_due`) |
| **2F-8C** | outbox | `3734547d-53f3-4223-9ab9-ccc068422cfd` (`fanned`) |
| **2F-8C** | delivery | `0fef9576-0854-4c6d-bb0f-6176711103ce` (`sent`, receipt `unchecked` / `retention_window`) |
| **2F-8C** | Expo ticket | `019f39e8-aadf-7733-848d-34e3c48a3e45` |
| **2F-9B** | task | `5cfcdb5d-9739-4a63-8488-ec61ea577a1f` (`[QA RECEIPT] اختبار إيصال Expo`, now `completed`) |
| **2F-9B** | notification | `9562be5c-c045-4aac-87cd-a924253a4e93` (`task_due`) |
| **2F-9B** | outbox | `e0732d00-4e02-4683-8b90-88d92bf67085` (`fanned`) |
| **2F-9B** | delivery | `60cd396b-3bad-45f5-ab2a-d43af6bf1be2` (`sent`, receipt `ok`) |
| **2F-9B** | Expo ticket | `019f3fd8-6bdc-76f5-abc2-fe660dedda3b` |
| Legacy | old invalid outbox / notification | `945ed6ae-d1f0-4a1f-ad40-ff52e0f13dce` (`skipped`, `expired`) / `5ba7fb2d-cd29-470a-b2fe-f41df75051fc` |

### 2.3 Final statuses (database-wide, carried from 2F-9B / 2F-9C)

| Dimension | State |
| --------- | ----- |
| Outbox | `fanned = 2`, `skipped = 1`, **no `pending`** |
| Deliveries | `sent` / `ok` = `1`; `sent` / `unchecked` = `1` |
| QA fixtures | `[QA PUSH]` **completed**; `[QA RECEIPT]` **completed** |
| Cron | **off** (no schedule) |

---

## 3. Proven behavior (with source anchors)

Each item is anchored to the exact function that implements it, plus the report that exercised it live.

1. **`task_due` producer.** `enqueueTaskDue` (`enqueue-due-reminders/index.ts`) scans `status = 'open'` tasks
   with a due date, resolves the occurrence in the **circle** timezone, and fires when `dueAt ∈ [now, now +
   taskLookaheadMinutes (20m)]`. **Proven** by 2F-8C and 2F-9B (`task = 1`, every other producer counter `0`).
2. **Responsibility routing to the owner.** `recipientsForItem` -> `notification_recipients_for_item_event`
   owner branch resolves `task_due` to the **assigned owner only** (unassigned task -> NOBODY). **Proven** in
   2F-8C (`resolved_recipients = 1`, `owner_is_recipient = true`) and by the delivery mapping to the owner's
   token in both runs.
3. **`remote_member` excluded from operational push.** `notification_recipient_eligible`
   (`20260626164000_...`) returns `false` for `remote_member` on `medication_due`, `medication_missed`,
   `task_due`, `task_overdue`, `appointment_upcoming`, `visit_upcoming`, and all `item_*` / `claim_digest`
   types; `elder` / null / removed roles are rejected outright. **Source-audited (not push-tested):** every QA
   run targeted the operational owner, so exclusion is guaranteed by construction, not yet demonstrated with a
   remote-role recipient on device.
4. **Outbox processor fan-out + authoritative send gate.** `process-notification-outbox` runs Phase A
   `fanout_due_notifications` (revalidate expiry / membership / role / preference / source-validity / quiet
   hours, then materialize one delivery per **current** active token) and Phase B `claim_push_deliveries` (the
   **authoritative** re-validation + `claim_token` lease) before `sendExpoPush`. **Proven** in 2F-8C / 2F-9B
   (`fanout.fanned = 1`, `claimed = 1`, `sent = 1`, all error counters `0`).
5. **Real Android OS push.** Both runs delivered an external OS push under the `Sanad` app (2F-8C ~3:09 AM
   Jul 7; 2F-9B ~6:50 AM Jul 8) - not merely an in-app inbox row.
6. **Generic privacy payload.** The processor sends `genericPushMessage()` -> title `سند`, body
   `لديك تذكير جديد`, and remote `data` carries only routing identifiers (`type`, `notificationId`, `circleId`,
   `deepLink`) - **no medication name, task title, vital, note, or recipient name**. Detailed copy lives only
   in the in-app `notifications` row. **Proven** on device in both runs (generic copy; no private detail).
7. **Receipt checker `ok` path.** `check-push-receipts` polls `sent` + ticketed + `receipt_status IS NULL` +
   `>= receiptMinAgeMinutes (15m)` deliveries oldest-first, and `record_delivery_receipt` writes
   `receipt_status = 'ok'` only when the row is still `sent` and the ticket matches. **Proven** in 2F-9B
   (`checked = 1`, `recorded = 1`, `mismatched = 0`; delivery `60cd396b-...` -> `receipt_status = 'ok'`).
8. **Retention sweep -> `unchecked`.** `mark_stale_receipts_unchecked` marks `sent`, ticketed, no-receipt
   deliveries older than `receiptRetentionHours (24h)` as `receipt_status = 'unchecked'`,
   `error_code = 'retention_window'` **before** polling. **Proven** in 2F-9B on the aged 2F-8C delivery
   (`0fef9576-...`).
9. **Fixture cleanup -> source invalidation.** Completing a task via the app UI flips
   `notification_source_validity` to `valid = false`, `reason = 'task_closed'` (task branch,
   `20260626164000_...`), so a future pass would **skip** (never resend). **Proven** in 2F-8D and 2F-9C; the
   recorded delivery evidence stayed intact.
10. **Idempotency / dedupe (single-run).** `enqueue_notification` inserts `on conflict (user_id, dedupe_key) do
    nothing`, and delivery materialization is `on conflict (outbox_id, push_token_id) do nothing`. **Proven for
    one run** in 2F-8C (`fresh_task_due_notifs = 1`); a true **re-run** dedupe test is still deferred (Section 4).

---

## 4. Remaining gaps

- **Cron not enabled / tested.** No `pg_cron` schedule exists; the engine has only ever run under single manual
  invocations. Scheduled cadence, overlap, and secret handling under cron are unproven.
- **Missed-dose producer not tested.** `enqueueMedicationDue` / the missed-dose tier-2 manager escalation
  (`missedDoseGraceMinutes = 60`, `missedDoseManagerEscalationMinutes = 120`, `data.tier = 'manager'`) has not
  produced a delivered notification.
- **`task_overdue` positive not tested.** `enqueueTaskOverdue` (window `[now - taskOverdueMaxAgeHours (24h)`,
  `now - taskOverdueGraceMinutes (60m)]`) has never fired a real overdue push (needs its own shaped fixture).
- **Idempotency re-run deferred.** A second producer pass against a still-open, in-window fixture (to prove the
  `(user_id, dedupe_key)` guard collapses the duplicate) has not been run.
- **Full scheduled end-to-end orchestration untested.** producer -> processor -> receipt-checker has never run
  as a chained schedule; only hand-sequenced single calls.
- **Production monitoring / observability still needed.** Structured logs exist
  (`enqueue_due_reminders_done`, `process_outbox_done`, `check_receipts_done`, `stale_claim`,
  `token_invalidated`), but no dashboards / alerting on failure counters, stale claims, invalid tokens, or
  retention sweeps.
- **EAS / release readiness is separate.** Build/signing, store submission, and app-side notification UX
  polish are out of scope for the engine QA and remain their own track.
- **Other producer types (appointment / visit) not push-tested.** Their source paths are audited but no real
  push has been delivered for `appointment_upcoming` / `visit_upcoming`.

---

## 5. Risk assessment

- **Database-wide functions (MEDIUM, mitigated).** Producers scan **all circles**; `fanout_due_notifications`,
  `claim_push_deliveries`, and the receipt sweep/poll are **unscoped** by circle. Any eligible row DB-wide is
  processed (bounded by `fanoutBatchSize / deliveryBatchSize = 200`, `expoReceiptBatchSize = 300`,
  `receiptRetentionSweepLimit = 500`, `maxTasksPerRun = 2000`, etc.). **Mitigation:** the QA runs proved only
  the intended QA-circle rows were eligible; before cron, the pre-run gates must confirm no unexpected eligible
  rows exist DB-wide.
- **Co-processing risk (LOW, proven safe).** Because the processor is DB-wide, a manual run co-processes any
  other due row. 2F-8C proved this is safe: the old invalid row (`945ed6ae-...`) was fanned-skipped
  (`last_error = 'expired'`, zero deliveries, **no push**). Under cron this becomes routine and desirable, not a
  hazard - but it means a cron run is never "just the QA row."
- **Stale / crashed-worker rows (LOW, handled).** `claim_push_deliveries` reclaims `processing` rows whose
  `locked_at` is older than `deliveryLockTimeoutSeconds (600s)`; the `claim_token` lease means a revived stale
  worker matches zero rows in `mark_delivery_*` and is logged `stale_claim` rather than recording a false
  success. Poison rows are isolated per-row and terminal-fail at `deliveryMaxAttempts (5)`.
- **Token invalidation behavior (LOW, narrow).** A token is deactivated **only** on a definitive
  `DeviceNotRegistered` - `deactivate_push_token_value` (processor, send path) or `deactivate_push_token_by_id`
  (receipt checker). No other outcome touches tokens; 2F-9B saw `invalidTokens = 0` and the owner token stayed
  active. Residual risk is limited to a genuinely dead token being correctly retired.
- **Cron risk (MEDIUM, gating).** Enabling `pg_cron` + `pg_net` introduces cadence, overlapping runs, and the
  `NOTIFICATIONS_CRON_SECRET` handling as new surface. `authorizeScheduledRequest` **fails closed** if the
  secret is unset (good), but scheduling frequency, run overlap, and secret rotation are unproven. This is the
  primary reason cron stays **planned, not executed**.
- **Privacy risk (LOW).** The remote payload is generic by construction (`genericPushMessage`), health detail
  is never sent through Expo, and no function logs a token / title / body / value. Proven generic on device in
  both runs. Residual risk is a future code change reintroducing detail into the payload - guard with a test.
- **Duplicate / dedupe risk (LOW-MEDIUM).** In-DB dedupe is enforced by `(user_id, dedupe_key)` and
  `(outbox_id, push_token_id)`; **but external push is explicitly at-least-once** (a network timeout after Expo
  accepts can resend; a stale-claim row is reclaimed + resent). A rare duplicate OS push is possible by design;
  the DB never double-records `sent`. A re-run idempotency test (Section 4) should confirm no duplicate
  notification row is created.
- **Role-scope regression risk (MEDIUM, watch).** Eligibility is centralized in
  `notification_recipient_eligible` and the resolvers, and re-validated at both fan-out and claim time - strong.
  One documented nuance: the resolver migration **adds `caregiver`** to the eligibility allow-list (the base
  engine omitted it), flagged for product sign-off; harmless today (no active `caregiver` members). Any future
  role change must be validated against both the enqueue-side resolver and the send-time re-validation so they
  cannot drift.

---

## 6. Recommended next phase

1. **First, commit this report** (docs-only; nothing executed).
2. **Then proceed to `2F-10B - cron orchestration planning (no execution)`** - design (do not run) the
   scheduled `enqueue-due-reminders -> process-notification-outbox -> check-push-receipts` orchestration:
   cadence vs. the 20-minute lookahead windows, overlap avoidance, `NOTIFICATIONS_CRON_SECRET` handling under
   `pg_cron` + `pg_net`, DB-wide pre-enable gates, and a rollback/disable path.

**Conservative guidance:**

- **No cron execution yet** - `2F-10B` authorizes nothing to run; enabling a schedule is a later, separately
  approved step.
- **No producer / processor / receipt reruns without a new purpose-shaped fixture and an explicit approved
  plan** - the positive path is proven; further ad-hoc runs only risk unintended state.

---

## 7. Launch roadmap

An ordered path from here to a release candidate (each step separately approved; nothing here is executed now):

1. **Notification engine completion** - close the `2F-10A` assessment (this report) and lock the proven
   baseline.
2. **Cron orchestration planning (`2F-10B`)** - design the scheduled chain and enable-gates (no execution).
3. **Cron tests** - enable a schedule in a controlled window, verify cadence + non-overlap + fail-closed auth,
   then confirm a scheduled positive push end to end.
4. **Missed-dose tests** - exercise `medication_due` / missed-dose owner alert and the tier-2 manager
   escalation (`data.tier = 'manager'`).
5. **`task_overdue` tests** - shape an overdue fixture and confirm a real overdue push + source-validity
   invalidation on completion.
6. **Broader QA** - `appointment_upcoming` / `visit_upcoming` pushes, quiet-hours deferral, multi-token /
   multi-device fan-out, and the idempotency re-run.
7. **Build / EAS readiness** - app build, signing, and store-submission track (separate from engine QA).
8. **Privacy / security review** - confirm generic-payload guarantees, secret handling, RLS, and least-privilege
   grants under the final config.
9. **Production monitoring** - dashboards / alerting on producer + processor + receipt counters, `stale_claim`,
   `token_invalidated`, retention sweeps, and failure rates.
10. **Release candidate** - cut once the above are green and signed off.

---

## 8. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results are recorded in Section 10's hand-off. No other command is run in this phase.

---

## 9. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched - read only).
- **No migrations changed** (`supabase/migrations/**` untouched - read only).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run by Claude.**
- **No DB connection by Claude.**
- **No deploy.**
- **No Edge invocation by Claude** (`enqueue-due-reminders`, `process-notification-outbox`,
  `check-push-receipts` were not run).
- **No cron enabled / created.**
- **No notification delivery / push by Claude** (nothing sent).
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only; no
  value read or requested; all UUIDs are user / circle / task / notification / outbox / delivery / token /
  ticket identifiers, not secrets).
- **No raw Expo token exposed** (only internal uuids and recorded ticket ids appear).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 10. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10a-notification-engine-closeout-readiness.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
