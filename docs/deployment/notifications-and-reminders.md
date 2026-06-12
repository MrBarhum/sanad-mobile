# Notifications & Reminder Engine — Deployment Guide

Operational guide for Step 6.0 (push notifications, the notification center, and
the reminder/missed-dose engine). Everything here is **manual**: the database SQL
is applied through the Sanad Supabase **Dashboard**, and the Edge Functions are
deployed by hand. **No secret values appear in this document or in any committed
migration.**

> ⚠️ This machine has a second Supabase project. Always target the **Sanad**
> project explicitly (`--project-ref <SANAD_PROJECT_REF>`) and never change the
> global CLI account. Do **not** run `supabase login/logout/link/db push` here.

---

## 1. Architecture

```mermaid
flowchart TD
  subgraph Client[Expo app]
    A[Push registration\n(explicit opt-in)] -->|register_push_token RPC| DB[(Postgres)]
    NC[Notification center\n/notifications] -->|RLS SELECT own| DB
    NS[/notification-settings/] -->|upsert_notification_preferences RPC| DB
  end

  subgraph Scheduler[pg_cron + pg_net]
    C1[every ~5 min] --> EF1
    C2[every ~1 min] --> EF2
    C3[every ~10-15 min] --> EF3
    C4[every ~15-30 min] --> EF4
  end

  subgraph Edge[Supabase Edge Functions - service role]
    EF1[enqueue-due-reminders\n(circle-tz occurrence)] -->|circle_notification_recipients\nenqueue_notification| DB
    EF3[check-missed-doses] -->|enqueue_notification| DB
    EF2[process-notification-outbox] -->|A: fanout_due_notifications\n(materialize + early filter)| DB
    EF2 -->|B: claim_push_deliveries\n(AUTHORITATIVE revalidation + crash recovery)| DB
    EF2 -->|generic payload| EXPO[(Expo push service)]
    EF4[check-push-receipts] -->|getReceipts| EXPO
  end

  EXPO -->|delivers| Device[Device]
  DB -->|outbox pending → fanned → deliveries| EF2
```

**Data flow:** schedules/tasks/appointments → `enqueue-due-reminders` resolves the
ONE canonical occurrence in the **care-circle timezone**, resolves recipients +
dedupes → writes `notifications` (inbox) + a logical `notification_outbox` job →
`process-notification-outbox` runs two phases: **(A) fan-out** —
`fanout_due_notifications` materializes one `notification_push_deliveries` row per
CURRENTLY active device token (early-filtering clearly-invalid jobs, re-deferring
for quiet hours), marking the outbox `fanned`; **(B) send** — `claim_push_deliveries`
is the **authoritative send-time gate**: every claim AND stale-lock reclaim
re-validates expiry, membership, role, preference, quiet hours and token (FOR UPDATE
SKIP LOCKED + lock-timeout crash recovery + bounded attempts) and returns ONLY
rows still authorized to send; the processor sends a **generic** payload via Expo
for exactly those and records the per-device result. Receipts are checked later per
delivery. The in-app inbox reads `notifications` directly through RLS; the outbox
and deliveries are never touched by clients.

---

## 2. Apply the database SQL (Dashboard only)

1. Open the **Sanad** project → **SQL Editor**.
2. Paste and run the entire artifact:
   `docs/claude-reports/2026-06-11-step-6-0-notifications-dashboard-complete.sql`
   (idempotent; safe to re-run). It also re-asserts the prerequisite
   `is_active_user_circle_member` helper, so it is self-contained.
3. The artifact ends with `notify pgrst, 'reload schema';` so PostgREST picks up
   the new tables/functions immediately.

The same statements live, split, in three migrations for version history:
`...120000_create_notifications_core.sql`,
`...120100_create_notification_functions.sql`, and
`...120200_add_care_circle_timezone.sql`.

### Care-circle timezone (set this per circle)

Scheduled medication/task **wall-clock** times are interpreted in the **care-
circle timezone** (`care_circles.timezone`) — the cared-for person's location —
so one 08:00 dose is one real event for every member, including remote ones.
(Appointments use their absolute `starts_at`; quiet hours use each member's own
device timezone.)

- New circles are seeded from the creator's device timezone automatically.
- Existing circles start at **'UTC'**; the **account → "Care circle timezone"**
  card prompts a manager to confirm/set the correct zone. Managers can type an
  IANA name or quick-fill the current device's zone; the value is validated
  server-side (`set_circle_timezone`, manager-only). Direct client writes to
  `care_circles` remain revoked.

---

## 3. Expo / EAS configuration (required for device push)

Device push tokens require an **EAS project id**. Add it to `app.json` and ensure
the project is linked to your EAS account:

```jsonc
{
  "expo": {
    "owner": "<your-eas-account>",
    "extra": {
      "supportsRTL": true,
      "eas": { "projectId": "<EAS_PROJECT_ID>" }
    }
  }
}
```

- The client resolves the id via `Constants.expoConfig.extra.eas.projectId`
  (fallback `Constants.easConfig.projectId`). If it is missing, enabling
  notifications surfaces a clear "not fully configured yet" message instead of
  crashing — fill in the id and rebuild.
- iOS additionally needs an **APNs key** and Android an **FCM v1 service account**
  uploaded to Expo (`eas credentials`) before real delivery works. The Android
  channel (`default`) is created at runtime by the app.
- Web has **no device push** — the in-app center still works; the app says so
  plainly.

No server secrets ship in the app bundle.

---

## 4. Edge Function secrets

Set these on the **Sanad** project (Dashboard → Edge Functions → Secrets, or
`supabase secrets set --project-ref <SANAD_PROJECT_REF> KEY=VALUE`). Never commit
them.

| Secret | Used by | Notes |
| --- | --- | --- |
| `NOTIFICATIONS_CRON_SECRET` | all functions | Shared secret the scheduler sends as `x-cron-secret`. Functions **fail closed** if it is unset. Generate a long, high-entropy random value. |
| `EXPO_ACCESS_TOKEN` | outbox + receipts | **Optional but recommended.** Required when Expo **Enhanced Push Security** is enabled. Create at expo.dev → Account → Access Tokens; the function sends it as `Authorization: Bearer …` on send + receipt calls. Never logged, never in the app/Git. If Enhanced Push Security is on at Expo and this is unset, the function fails with a clear "set EXPO_ACCESS_TOKEN" error. |
| `SUPABASE_URL` | all functions | **Auto-injected** by the Functions runtime — do not set manually. |
| `SUPABASE_SERVICE_ROLE_KEY` | all functions | **Auto-injected** — do not set manually, never log, never put in the app. |

**Recommended for production:** enable **Enhanced Push Security** in your Expo
account and set `EXPO_ACCESS_TOKEN`, so only your server can send pushes for your
project.

### Endpoint auth (verify_jwt = false + cron secret)

`supabase/config.toml` sets `verify_jwt = false` for the four scheduled functions.
This is required because the scheduler (pg_cron + pg_net) sends only the
`x-cron-secret` header — **not** a Supabase JWT — so platform JWT verification
would reject the request before the handler runs. The endpoints are **not public
in practice**: every handler calls `authorizeScheduledRequest()` and **fails closed
(401)** unless the request presents the correct high-entropy `NOTIFICATIONS_CRON_SECRET`
(constant-time compared). Keep this config when deploying (deploying from this repo
preserves it).

**Auth test (run after deploy):**
- `curl -s -o /dev/null -w "%{http_code}" -X POST <FUNCTIONS_BASE_URL>/process-notification-outbox` → **401** (no secret)
- `... -H "x-cron-secret: wrong"` → **401** (incorrect secret)
- `... -H "x-cron-secret: <NOTIFICATIONS_CRON_SECRET>"` → **200** (executes)

---

## 5. Deploy the Edge Functions (manual — do NOT run from this environment)

```bash
# Run these yourself, targeting the Sanad project explicitly.
supabase functions deploy enqueue-due-reminders      --project-ref <SANAD_PROJECT_REF>
supabase functions deploy check-missed-doses         --project-ref <SANAD_PROJECT_REF>
supabase functions deploy process-notification-outbox --project-ref <SANAD_PROJECT_REF>
supabase functions deploy check-push-receipts        --project-ref <SANAD_PROJECT_REF>
```

These functions are server-only and authenticate via `NOTIFICATIONS_CRON_SECRET`;
they are not meant to be called by end users. Deploying from this repo preserves
the `verify_jwt = false` settings in `supabase/config.toml` (required so the cron
requests reach the handler — see §4). If you deploy a single function, ensure its
`[functions.<name>] verify_jwt = false` block is present.

---

## 6. Scheduling (pg_cron + pg_net)

Run in the Dashboard SQL Editor **after** deploying the functions and setting the
secret. Replace the placeholders. Keep this snippet **out of committed migrations**
(it contains your project URL + cron secret).

```sql
-- Enable once:
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper to POST to a function with the cron secret header.
-- Placeholders: <SANAD_FUNCTIONS_BASE_URL> e.g. https://<ref>.supabase.co/functions/v1
--               <NOTIFICATIONS_CRON_SECRET>
select cron.schedule('sanad-outbox', '* * * * *', $$
  select net.http_post(
    url := '<SANAD_FUNCTIONS_BASE_URL>/process-notification-outbox',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<NOTIFICATIONS_CRON_SECRET>'),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('sanad-due', '*/5 * * * *', $$
  select net.http_post(
    url := '<SANAD_FUNCTIONS_BASE_URL>/enqueue-due-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<NOTIFICATIONS_CRON_SECRET>'),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('sanad-missed', '*/10 * * * *', $$
  select net.http_post(
    url := '<SANAD_FUNCTIONS_BASE_URL>/check-missed-doses',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<NOTIFICATIONS_CRON_SECRET>'),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('sanad-receipts', '*/15 * * * *', $$
  select net.http_post(
    url := '<SANAD_FUNCTIONS_BASE_URL>/check-push-receipts',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<NOTIFICATIONS_CRON_SECRET>'),
    body := '{}'::jsonb
  );
$$);
```

**Recommended cadence & cost assumptions** (tune to your volume):

| Function | Cadence | Why |
| --- | --- | --- |
| `process-notification-outbox` | every 1 min | Keeps push latency ≤ ~1 min; the window/lookahead config assumes ≤5 min. |
| `enqueue-due-reminders` | every 5 min | Lookahead is 20 min, so a 5-min cadence never misses a dose between runs. |
| `check-missed-doses` | every 10–15 min | Grace period is 60 min, so coarse cadence is fine. |
| `check-push-receipts` | every 15–30 min | Receipts settle minutes after send. |

Each run is bounded (batch sizes + row caps in `_shared/config.ts`). The 1-minute
outbox run is the main cost driver; raise its interval if you have low volume.

Verify the official Supabase docs for the current pg_cron/pg_net + Edge Function
invocation pattern for your project tier before finalizing.

---

## 7. Token invalidation & per-device delivery

- **Multiple devices:** a notification fans out to one `notification_push_deliveries`
  row per active device token. Each device's send, ticket, receipt, retry, and
  failure are tracked independently — one device failing never marks another's
  success as failed.
- **Re-used device:** `register_push_token` deactivates the same raw token under
  any *other* user, so a device that switches accounts never delivers to the old
  one.
- **Logout:** the app calls `deactivate_push_token` (with auth) *before* signing
  out.
- **Dead token:** on the **definitive** `DeviceNotRegistered` error (at send, via
  `deactivate_push_token_value`; or in a receipt, via `deactivate_push_token_by_id`)
  only that exact token is retired. Transient errors retry with bounded backoff up
  to the attempt cap, then the delivery becomes terminal `failed`.
- **Crash recovery + claim lease:** a delivery left `processing` by a crashed
  worker is reclaimed once its `locked_at` is older than `deliveryLockTimeoutSeconds`
  (default 600s). Each claim/reclaim stamps a fresh `claim_token`; the result
  recorders write only while that lease holds, so a stalled worker that resumes
  late cannot overwrite a newer worker's result — its write is a no-op logged
  `stale_claim`. The attempt is counted on claim; at the cap the delivery becomes
  `failed`. Fan-out is atomic in SQL, so the logical outbox can never get stuck.
- **At-least-once delivery:** external push is at-least-once, not exactly-once. A
  network timeout after Expo has accepted a request (or a stale-claim reclaim) can
  cause a rare duplicate. The lease prevents stale **database-state** corruption but
  cannot make an external provider exactly-once. If recording a `sent` result
  fails, the row stays `processing` and is reclaimed/resent later rather than being
  falsely reported delivered.

---

## 8. Monitoring (tickets / receipts)

- `notification_outbox.status` ∈ {pending, **fanned**, skipped, failed} — the
  logical fan-out job. **`fanned` means materialized into deliveries, NOT
  delivered** — never read it as a delivery confirmation. `last_error` carries the
  skip reason: authorization (`not_member`, `not_eligible`, `expired`,
  `no_active_token`) or **source-event** (`dose_recorded`, `occurrence_changed`,
  `task_closed`, `appointment_closed`, `schedule_inactive`, `medication_inactive`).
  The same reasons appear on a per-device `notification_push_deliveries.last_error`
  when caught authoritatively at the claim.
- `notification_push_deliveries` is the per-device record (the **delivery truth**):
  `status`, `attempt_count`, `claim_token` (active lease), `expo_ticket_id`,
  `receipt_status`, `error_code`, `last_error`.
- **Receipts** are polled oldest-first, only for deliveries ≥ `receiptMinAgeMinutes`
  (15) old, and tickets past `receiptRetentionHours` (24) with no receipt are marked
  `receipt_status = 'unchecked'` (`error_code = 'retention_window'`) so they are not
  polled forever.
- Useful queries (Dashboard):
  ```sql
  select status, last_error, count(*) from public.notification_outbox group by 1, 2;
  select status, count(*) from public.notification_push_deliveries group by 1;
  select error_code, count(*) from public.notification_push_deliveries
    where receipt_status = 'error' group by 1;
  -- deliveries that lost their lease to a newer worker show up as res/retry rows,
  -- and `stale_claim` appears in the function logs.
  ```
- Function logs are structured JSON with **counts and ids only** (e.g.
  `delivery_id`, `push_token_id`) — never a token (not even a slice of one),
  message bodies/titles, secrets, or health values.

---

## 9. Rollback / disable procedure

- **Pause delivery without code changes:** `select cron.unschedule('sanad-outbox');`
  (and the other jobs). Notifications keep queuing; nothing sends.
- **Stop generation:** unschedule `sanad-due` and `sanad-missed`.
- **Full disable:** unschedule all jobs. The app keeps working; the inbox simply
  stops receiving new server notifications. Local test notifications still work.
- **Data:** the tables are additive and isolated; dropping them (if ever needed)
  affects only notifications, never care data. Prefer pausing the cron jobs over
  dropping tables.

---

## 10. Privacy & logging rules

- **Lock-screen privacy:** the REMOTE Expo payload is **generic** — title `سند`,
  body `لديك تذكير جديد` — and carries only minimal routing ids (notification id,
  type, optional circle id, deep-link hint). No medication name, dosage, vital,
  note, diagnosis-like text, or recipient name is ever sent through Expo or shown
  on a lock screen. The detailed copy and the immutable occurrence context
  (`scheduleId/doseDate/scheduledTime`, `taskId/dueDate/dueTime`, `appointmentId/
  startsAt/leadMinutes`) live only in the in-app `notifications` row; the app
  fetches it after the user opens the notification (re-validating membership first).
- **Membership-scoped reads:** a notification row is readable (and its read-state
  mutable) only by its recipient **and**, for circle-linked rows, only while they
  are an active member. A removed member can no longer read that circle's historical
  notifications (rows are kept, not deleted; rejoining restores their own rows).
- **Time-bounded delivery:** reminders carry an `expires_at` (medication_due → grace
  boundary; medication_missed → max-age; task_due → +6 h, still gated on open;
  appointment_upcoming → the appointment start) and are re-checked against the live
  source event at send, so a recorded dose / completed task / cancelled appointment
  is never pushed.
- Raw push tokens are returned only to their owning user (RLS) and are **never**
  logged — not the value and not any slice of it. To correlate a token in logs we
  log its `push_token_id` / `delivery_id` instead.
- The service-role key and `EXPO_ACCESS_TOKEN` live only in the Functions runtime;
  they are never in the app bundle, never in Git, and never logged.
- Logs carry only counts and ids — never message titles/bodies or health values.
  No medical interpretation is ever produced.
- One user can never read another user's notifications or tokens (RLS + RPCs).

---

## 11. Physical-device remote-push test plan

See the step report (§ Manual test plan) for the full numbered checklist. In
short: build a dev/EAS build with the `eas.projectId` set, register a real device,
fire a local test, then drive a real medication-due reminder end-to-end and verify
no duplicates, correct quiet-hours deferral, neutral missed-dose copy, and that a
removed member cannot deep-link into a circle they left.
