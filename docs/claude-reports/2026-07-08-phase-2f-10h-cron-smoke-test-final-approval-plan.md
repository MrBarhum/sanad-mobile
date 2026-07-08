# Phase 2F-10H — Cron smoke-test FINAL APPROVAL PLAN (planning only, no execution)

- **Date:** 2026-07-08
- **Phase:** 2F-10H — cron smoke-test final approval plan
- **Type:** Final approval planning artifact only — **NO execution**
- **Baseline commit (after 2F-10G):** `7433d82 docs(product): record med visit cron preflight results`
- **Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`
- **QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (رعاية الوالد الغالي)
- **Owner / recipient user:** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`
- **Owner active push token id:** `93b4e8b8-6fa1-409e-b64e-4a1f3453e3e8` (masked scheme only; raw never exposed)

---

## 1. Executive summary

This report is **final approval planning only**. It consolidates the cleared preflight
evidence from phases 2F-10A → 2F-10G into a single go/no-go plan and defines the gates,
outline, stop criteria, and approval sign-off required **before** any later, explicitly-approved
execution phase (`2F-10I`) may run. It does not authorize execution now.

During 2F-10H, Claude:

- **ran no SQL** — no query, read-only or otherwise, was executed against any database.
- **made no DB connection** — no connection to Supabase Postgres or any other database.
- **ran no Supabase CLI** command.
- **invoked no Edge Function** (no producer, processor, or receipt-checker call).
- **enabled or created no cron** — no `pg_cron` schedule, no cron migration, no cron job.
- **created no QA fixture** — no `[QA CRON]` task or any other row was created.
- **sent no push** — no notification/delivery was produced.
- **read no secrets** — `NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` were referenced by
  name only; no value was read, requested, printed, or committed.

Work performed was strictly read-only inspection of prior 2F-10 reports and the relevant Edge
source, plus writing this single report and running the two local read-only validation commands
in Section 8.

**Readiness verdict:** The project is **ready for a later, explicitly-approved execution phase
(`2F-10I`), not for execution now.** All twelve baseline preflight checks (01–12) are
clean/baseline-accepted, and the med/visit/appointment co-fire review (check 13) was narrowed to
**PASS** by the 2F-10G deep review (B/E/F = 0 rows). The single remaining hard condition is that
the three time-sensitive checks **B / E / F must be re-run immediately before execution**, because
their clearance depends on `now()` and a stale clearance is not sufficient to enable cron.

---

## 2. Evidence recap (2F-10A → 2F-10G)

### 2F-10A — Notification engine closeout / readiness

Consolidated the 2F-7 → 2F-9C QA arc. The full `task_due` path was demonstrated **live twice
end-to-end**: producer (`enqueue-due-reminders`) → outbox fan-out + claim/send
(`process-notification-outbox`) → **real Android OS push** (generic payload) → Expo ticket →
receipt `ok` (`check-push-receipts`), plus the retention-sweep → `unchecked` path, plus fixture
cleanup → source-validity `task_closed`. Verdict: engine **READY for cron PLANNING, NOT for cron
EXECUTION**. Key numbers: outbox fanned=2 / skipped=1 / pending=0; deliveries sent/ok=1
(`60cd396b-…`) and sent/unchecked=1 (`0fef9576-…`, `retention_window`); one active owner token
(`93b4e8b8-…`, invalidTokens=0 both runs); cron off. Generic privacy payload confirmed on device:
title `سند`, body `لديك تذكير جديد`, remote data limited to routing identifiers only.

### 2F-10B — Cron orchestration planning (no execution)

Designed the scheduled three-function chain (producer → processor → receipt checker) without
running anything. Established windowing constraints from engine config: lookahead **20 min**
(producer must run ≤20m or miss occurrences), receipt min age **15 min**, receipt retention
**24 h**, delivery lock timeout **600 s / 10 min**. Batch caps: fanout=200, delivery=200, expo
push=100, expo receipt=300, retention sweep=500. Auth model: each scheduled function calls
`authorizeScheduledRequest(req)` and requires `NOTIFICATIONS_CRON_SECRET` in the `x-cron-secret`
header (timing-safe compare, **fail-closed** if unset); platform JWT disabled for these functions.
Defined pre-enable gates (pending_outbox, stale processing, DB-wide eligibility enumeration, active
tokens, failed-delivery cluster, unpolled receipts, QA-only eligibility) and a paired **disable
path** requirement. Cron enablement declared **greenfield** and a distinct, separately-approved
step.

### 2F-10C — Cron smoke-test execution plan (planning only)

Authored the controlled QA-safe smoke test for the `task_due` path only (medication / appointment /
visit fixtures out of scope; `check-missed-doses` out of scope). Target fixture:
`[QA CRON] اختبار جدولة الإشعارات` in the QA circle, assigned to the owner, status open, due
**8–12 min ahead** in Asia/Riyadh (UTC+3), created **via app UI** (so RLS/triggers/guards run).
Proposed `sanad-`-prefixed job names for targeted disable. Endpoint: HTTPS POST to
`https://qccgshanmoeybagxwvcs.supabase.co/functions/v1/<function>` with the `x-cron-secret` header,
secret from vault only. Defined success criteria (exactly one notification / outbox row / delivery /
Android push, receipt → `ok`, no collateral) and a full evidence template. Next step: 2F-10D
preflight SQL review; **do not enable cron directly from 2F-10C**.

### 2F-10D — Cron preflight SQL review (read-only)

Reviewed the preflight SQL pack: all blocks **SELECT-only**, correct table/column names (0 schema
errors), correct timezone math (window depends on `care_circles.timezone = Asia/Riyadh`), token
query correctly masked (scheme prefix only). Two revisions applied: (1) block 8 `task_due` query
redacts titles for **non-QA** rows to prevent exposure; (2) added block 12 to mirror the DB-wide
producer — exact `task_overdue` check plus an informational med/appt/visit approximate scan
(authoritative arbiter remains the producer response counters). Produced the **final approved
(still-not-run) 12-block pack**. Confirmed no `pg_cron` schedule and no cron migration exist in the
repo. No secret value read.

### 2F-10E — Manual cron preflight support + result record

Prepared the manual read-only preflight pack for a **human operator** to run in the Supabase
Dashboard (project `qccgshanmoeybagxwvcs`). Claude ran zero SQL / zero DB connection / zero CLI /
zero Edge / zero cron / zero fixture / zero push / zero secret read. At authoring time the live-DB
preflight was **PENDING** (all 13 result cells blank awaiting operator paste). Reaffirmed gates:
correct project ref, SELECT-only pack, never paste a secret, stop on any criterion violation.

### 2F-10F — Manual preflight result assessment + med/visit deep-review pack

Recorded the operator's preflight results. **Checks 01–12 = PASS / baseline-accepted** (10 PASS +
3 baseline-accepted; **0 hard STOP**). Check 13 = **REVIEW**: DB-wide non-window counts were
non-zero — `active_med_schedules = 11`, `planned_visits_with_date = 7`,
`scheduled_appts_next_25h = 0`. Authored the SELECT-only deep-review pack (queries A–G) to narrow
whether any medication/visit/appointment would plausibly co-fire in the smoke window, gating cron
enablement on B/E/F each returning 0 (or explicit acceptance/exclusion). Noted that
`enqueue-due-reminders` runs **all five branches DB-wide in one invocation** (medication_due,
task_due, task_overdue, appointment_upcoming, visit_upcoming) — enabling cron exercises all of them.

### 2F-10G — Med/visit preflight deep-review results

Recorded the operator's A–G deep-review results. **Immediate med/visit/appointment co-fire risk
RESOLVED for the checked window:**

- **B — `medication_due` next 20m = 0 rows → PASS** (`B_med_plausible_next_20m = PASS`)
- **E — `visit_upcoming` 60–80m start window = 0 rows → PASS** (`E_visits_plausible_window_60_80m = PASS`)
- **F — `appointment_upcoming` configured lead windows = 0 → PASS** (`F_appointments_firing_next_window = PASS`)

Supporting: A = 11 active med schedules (none occurring in the next 20 min); D = 7 planned visits,
**all on historical dates** (2026-06-20, 2026-06-29, 2026-06-30 ×4, 2026-07-01) relative to
2026-07-08; C = 3 recent `task_due` notifications in 48h (latest
`2026-07-08T03:47:06.925685+00`), no medication/visit; G = recent outbox `task_due` fanned=2 /
skipped=1, no new pending. **No STOP condition** across A–G. Critically, 2F-10G states that **B / E /
F are time-sensitive** (they depend on `now()`) and **must be re-run immediately before any future
cron/producer execution** — stale clearance is not sufficient. It explicitly says cron execution
may **not** begin directly from 2F-10G, and the safe next step is 2F-10H (this report).

### Key known facts carried into 2F-10H

- **Cron off.** No `pg_cron` schedule exists (`cron_job_regclass = null`); `pg_cron` not installed /
  not visible; no cron migration in repo.
- **No pending outbox** in the known baseline.
- **Outbox:** fanned=2, skipped=1, pending=0.
- **Deliveries:** sent/ok=1 (`60cd396b-…`), sent/unchecked=1 (`0fef9576-…`, `retention_window`).
- **One active owner token** (`93b4e8b8-…`, role `family_member` (operational), device `android`,
  membership `active`, masked `ExponentPushToken[***]`).
- **No non-QA `task_due`** in window; `non_qa_eligible_task_due = 0`.
- **No `task_overdue`** in window (`task_overdue_in_window = 0`).
- **No plausible med/visit/appointment co-fire** in the checked window (B/E/F = 0).
- **B / E / F must be re-run immediately before future execution** (time-sensitive hard gate).

### Engine behavior anchors (from read-only Edge source)

- **Producer** (`enqueue-due-reminders`): scans active med schedules, open tasks (due + overdue),
  scheduled appointments, and planned visits DB-wide; idempotently enqueues items due within the
  20-min lookahead; resolves recipients per item (responsibility-aware); authorizes via
  `NOTIFICATIONS_CRON_SECRET`.
- **Processor** (`process-notification-outbox`): Phase A fan-out (`fanout_due_notifications`) →
  one delivery per active token; Phase B send (`claim_push_deliveries` re-validates expiry,
  membership, role, preference, quiet hours, token) → Expo push with **generic** title/body and
  routing-only data; at-least-once (rare duplicate on network timeout is by design).
- **Receipt checker** (`check-push-receipts`): polls `sent` deliveries with a ticket, no receipt
  yet, and `sent_at` older than **15 min** (oldest-first); records `ok`/error; only
  `DeviceNotRegistered` deactivates that exact token; retention sweep marks tickets older than
  **24 h** as `unchecked`.
- **Generic push (verbatim in source):** title `سند`, body `لديك تذكير جديد`; remote `data`
  carries only `type`, `notificationId`, `circleId`, `deepLink` — no medication/task/vital/name.
- **Auth (verbatim in source):** `NOTIFICATIONS_CRON_SECRET` presented via `x-cron-secret` header
  (or `Authorization: Bearer`), timing-safe constant-time compare, **returns false / fail-closed if
  the env var is not set**.

---

## 3. Final approval gates (go / no-go)

Every gate below must hold **immediately before** the later execution phase (`2F-10I`) proceeds.
Any unmet gate is a **no-go**. Gates marked **(time-sensitive)** must be re-evaluated live at
execution time — earlier clearance does not carry.

| # | Gate | Required condition | Source check |
|---|------|--------------------|--------------|
| 1 | Clean git | Working tree clean; no unexpected staged/unstaged changes | local |
| 2 | Correct project | Supabase project ref is exactly `qccgshanmoeybagxwvcs` | operator confirm |
| 3 | Device ready + owner signed in | Physical Android test device online/charged; QA owner signed in | operator confirm |
| 4 | Notification permission | OS notification permission enabled for the Sanad app | device confirm |
| 5 | One active owner token | Exactly **1** active token for the owner (unless multiple explicitly accepted) | Block 7 |
| 6 | Cron currently off | No pre-existing Sanad cron jobs; `cron_job_regclass = null` or 0 Sanad jobs | Block 10 |
| 7 | pending_outbox = 0 | No pending outbox before fixture creation | Block 1 |
| 8 | No processing/stale deliveries | `processing_total = 0`, `stale_processing = 0` | Block 4 |
| 9 | failed_deliveries = 0 | No failed-delivery cluster | Block 6 |
| 10 | No non-QA `task_due` next 20m | `non_qa_eligible_task_due = 0`; any window row is the QA fixture only | Blocks 8/9 |
| 11 | task_overdue_in_window = 0 | No overdue task in `[now-24h, now-60m]` | Block 12a |
| 12 | **B = 0 (time-sensitive)** | `B_med_plausible_next_20m = 0 rows` **immediately before execution** | 2F-10G B |
| 13 | **E = 0 (time-sensitive)** | `E_visits_plausible_window_60_80m = 0 rows` **immediately before execution** | 2F-10G E |
| 14 | **F = 0 (time-sensitive)** | `F_appointments_firing_next_window = 0` **immediately before execution** | 2F-10G F |
| 15 | No open `[QA CRON]` fixture | `existing_qa_cron_open = 0` before creating the new one | Block 11 |
| 16 | Disable path ready | Cron disable/unschedule path reviewed and ready **before** enablement | 2F-10B/C |
| 17 | Secret present, unexposed | `NOTIFICATIONS_CRON_SECRET` presence verified **safely** (name only, never value) | operator confirm |
| 18 | No secret leakage | No secret pasted / printed / committed anywhere | operator confirm |
| 19 | Commands reviewed separately | Exact execution SQL + cron enable + cron disable commands reviewed **before** use | 2F-10I |

**Note on gate 5 (multiple tokens):** the baseline is exactly one active owner token. If more than
one active token/device exists at execution time, execution must **stop** unless the additional
tokens are explicitly reviewed and accepted (they would each receive the generic push).

---

## 4. Final execution outline for later phase (outline only — not executable now)

The following is the ordered outline the later `2F-10I` phase would follow. It is **outline only**;
nothing here may run during 2F-10H. Each step that touches SQL, DB, fixtures, cron, Edge, push,
receipts, or cleanup requires explicit human approval at that moment (see Section 6).

1. **Confirm clean repo** — `git status` clean; on expected baseline commit.
2. **Confirm device / app / token** — Android device online, owner signed in, notification
   permission on, exactly one active owner token (or accepted multi-token).
3. **Run last-minute read-only preflight** — execute the finalized SELECT-only pack (Blocks 1–12)
   in the Dashboard for `qccgshanmoeybagxwvcs`; **re-run B / E / F** and confirm each = 0 rows.
4. **Create the QA fixture through the app UI** — `[QA CRON] اختبار جدولة الإشعارات` in circle
   `ae4721d8-…`, assigned to owner `a6dc7376-…`, status open, due **8–12 min ahead** (Asia/Riyadh),
   no sensitive data.
5. **Re-run `task_due` window check** — confirm **exactly one** eligible row and it is the QA
   fixture (`is_qa_cron_fixture = true`), `non_qa_eligible_task_due = 0`.
6. **Enable cron only through separately-reviewed commands** — via the reviewed enable SQL (or an
   approved one-shot supervised schedule); enable only the `sanad-`-prefixed jobs; record the
   `cron.job` listing before/after.
7. **Observe producer evidence** — `enqueue-due-reminders` enqueues exactly one `task_due`
   notification for the fixture; every other producer counter = 0.
8. **Observe processor evidence** — one pending → fanned outbox row; one claimed → sent delivery
   with a non-null Expo ticket id; no collateral.
9. **Confirm one generic Android push** — exactly one OS push on the owner device:
   - title `سند`
   - body `لديك تذكير جديد`
   - no private detail in title, body, or visible payload.
10. **Wait until the Expo ticket is receipt-eligible** — `sent_at` ages **≥ 15 min** (and remains
    **< 24 h**) before polling.
11. **Observe receipt-checker evidence** — `check-push-receipts` records `receipt_status = 'ok'`
    (checked=1, recorded=1, mismatched=0, recordErrors=0, invalidTokens=0).
12. **Disable cron / leave only in a reviewed state** — unschedule/disable the `sanad-*` jobs via
    the reviewed disable path; confirm none remain.
13. **Cleanup the fixture through the app UI** — complete `[QA CRON]`; confirm source-validity flips
    to `task_closed`.
14. **Final read-only evidence** — re-run summary SELECTs: no collateral notifications/deliveries,
    `pending_outbox = 0`, no leftover Sanad cron jobs.
15. **Write the execution report and commit only after validation** — record all evidence; commit
    docs only after `npm run check:mojibake` and `git diff --check` pass.

---

## 5. Stop criteria (halt immediately)

If any of the following is observed at or before execution, **STOP** and do not proceed (or halt an
in-flight run) until it is understood and resolved:

- Wrong project (ref ≠ `qccgshanmoeybagxwvcs`).
- Dirty git unexpectedly.
- No active owner token.
- Multiple active tokens **not** explicitly accepted.
- Any pending outbox before fixture creation.
- Stale processing deliveries (`stale_processing > 0`).
- Failed deliveries (cluster / any unexplained failed row).
- Non-QA `task_due` in window.
- `task_overdue` in window.
- Nonzero **B / E / F** last-minute checks (any of `medication_due`, `visit_upcoming`,
  `appointment_upcoming` plausibly firing in the window).
- Pre-existing Sanad cron jobs.
- Existing open `[QA CRON]` fixture.
- Secret cannot be verified safely (would require exposing its value).
- Cron disable path not ready.
- Private detail appears in the OS push.
- Push received on the wrong user / device.
- Duplicate notification / delivery that is **not understood** (a rare at-least-once duplicate is by
  design and must be noted, not silently accepted).
- Receipt error that is **not understood**.
- Cron cannot be disabled cleanly.

---

## 6. Final approval statement

- **2F-10H does NOT authorize execution.** This report is a planning/approval artifact only. No SQL,
  DB connection, fixture, cron, Edge invocation, push, receipt polling, disablement, or cleanup is
  authorized by this phase.
- **A later `2F-10I — cron smoke-test execution, explicitly approved` phase is required** before any
  execution may occur.
- **2F-10I must obtain explicit human approval immediately before each of the following actions**
  (each is a separate approval, not covered by this plan):
  - running SQL,
  - opening a DB connection,
  - creating the QA fixture,
  - enabling cron,
  - invoking any Edge Function via cron,
  - delivering any push,
  - polling receipts (receipt checker),
  - disabling cron,
  - performing cleanup.

---

## 7. Recommendation

**Recommended next phase:** `2F-10I — cron smoke-test execution, explicitly approved`.

Proceed to 2F-10I **only if**:

- the user is ready to **supervise** the full window end-to-end (fixture → producer → processor →
  push → receipt aging ≥15 min → receipt checker → disable → cleanup), **and**
- the **last-minute preflight gates are re-run** — in particular the time-sensitive
  **B / E / F** checks confirmed at 0 rows immediately before execution, alongside gates 1–11 and
  15–19 in Section 3.

**Otherwise, pause here.** The cleared preflight is valid only for the window checked on
2026-07-08; a stale clearance must not be used to enable cron. If supervision or a fresh B/E/F
snapshot is not available, remain in planning.

---

## 8. Validation

Only the two local, read-only validation commands were run (no network, no DB, no CLI):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results:

```
$ npm run check:mojibake
> sanad-mobile@1.0.0 check:mojibake
> node ./scripts/check-mojibake.js

check:mojibake - scanned 266 active source/config file(s).

No strong mojibake signatures found in active source/config.
(exit 0)

$ git -c core.autocrlf=false diff --check
(no output; exit 0)
```

Both validation commands passed: no mojibake signatures, and no whitespace/conflict errors.

---

## 9. Final confirmation

- [x] Report created (`docs/claude-reports/2026-07-08-phase-2f-10h-cron-smoke-test-final-approval-plan.md`).
- [x] No app source changed.
- [x] No Edge source changed.
- [x] No migrations changed.
- [x] No generated types changed.
- [x] No Supabase CLI run.
- [x] No SQL run by Claude.
- [x] No DB connection by Claude.
- [x] No deploy.
- [x] No Edge invocation.
- [x] No cron enabled / created.
- [x] No QA fixture created.
- [x] No notification delivery / push.
- [x] No secrets touched (referenced by name only).
- [x] No commit / no stage.

---

## 10. Final git state

```
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10h-cron-smoke-test-final-approval-plan.md

$ git --no-pager diff --stat
(empty — no tracked-file changes)
```

Exactly one untracked file (this report). No tracked files modified, staged, or committed.
