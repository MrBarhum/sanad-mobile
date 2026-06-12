# Step 6.0 — Notification Center, Push Lifecycle, Reminder & Missed‑Dose Engine, Role‑Capability UX

Date: 2026‑06‑11 · Branch: `master` · Status: implemented locally, **not committed**, **not deployed**.

This is a full production‑oriented slice: the client, database schema, RLS,
SECURITY DEFINER functions, Edge Function source, scheduling design, deployment
guide, and a complete idempotent SQL artifact. Remote SQL is applied **manually
through the Sanad Supabase Dashboard**. No Supabase CLI auth/link/push/deploy was
performed (confirmed at the end).

> **A five‑issue production‑hardening pass (§0 below) supersedes the original
> design where they differ** — care‑circle‑timezone occurrences, send‑time
> revalidation, stale‑processing recovery, the per‑device delivery model, and
> generic remote payloads. The SQL was re‑authored to the cleanest final schema
> (Step 6.0 was never applied), so there is no duplicate/obsolete schema.

---

## 0. Production hardening pass (blocking, pre‑apply)

### 0.1 Care‑circle timezone — the canonical zone for scheduled care events
A medication dose at 08:00 or a task due at 14:00 is **one real event** at the
cared‑for person's local time — not a different event in each member's country.

- **Model / migration path:** new migration
  `20260611120200_add_care_circle_timezone.sql` adds
  `care_circles.timezone text not null default 'UTC'` (existing rows backfill to
  UTC) and a manager‑only `set_circle_timezone(p_circle_id, p_timezone)` RPC that
  validates the IANA name against `pg_timezone_names`. `care_circles` writes stay
  RPC‑only (Step 5.0 lockdown), so the timezone changes only through this RPC.
- **Client:** `CircleSummary`/`ActiveCircle` carry `timezone`; new circles are
  seeded from the creator's device zone in `createCareCircle`; the account
  **"Care circle timezone"** card shows the value, prompts a manager to confirm
  when it is still UTC, and lets a manager change it (type an IANA name or
  quick‑fill the device zone) with a confirmation. Arabic + English.
- **Semantics:** medication schedule dates/times and `care_tasks.due_*` resolve to
  ONE absolute occurrence using the **circle** timezone; appointments stay absolute
  (`starts_at`); the **user/recipient** timezone is used only for quiet hours /
  display. One occurrence → one canonical absolute timestamp → one stable dedupe
  key shared by all eligible recipients.

  **Occurrence‑time example** — circle `Asia/Riyadh` (UTC+3), dose at `08:00`,
  canonical instant `05:00Z` (`08:00` Riyadh):
  | member | device zone | gets the occurrence at | quiet hours computed in | dedupe key |
  |---|---|---|---|---|
  | local caregiver | Asia/Riyadh | 05:00Z (= 08:00 local) | Asia/Riyadh | `med:{sched}:2026-06-11:08:00:00` |
  | remote member | Europe/London | **05:00Z** (= 06:00 local) — same event | Europe/London | **same key** |

  The remote member does **not** get a separate 08:00‑London event; both get the
  one 05:00Z occurrence, each subject to their own preferences/quiet hours, and
  each de‑duped independently.

### 0.2 Send‑time revalidation
Enqueue‑time checks are insufficient because a push may be deferred for hours. The
server‑only `fanout_due_notifications` RE‑VALIDATES every due job at delivery time
(one place, no Edge duplication): notification not expired, recipient still exists,
still an **active member** of a circle‑linked notification, role still eligible,
preference still enabled, and quiet hours re‑evaluated (newly‑configured quiet
hours **re‑defer**; emergencies bypass as documented). A failed check marks the
logical outbox `skipped` with a safe reason and sends nothing; the inbox row is
retained. No other circle's information is ever exposed.

### 0.3 Stale `processing` recovery
Fan‑out is **atomic in SQL**, so the logical outbox can never get stuck. The
external send lives on per‑device deliveries: `claim_push_deliveries` reclaims due
`pending` rows **and** stale `processing` rows whose `locked_at` is older than the
configurable `deliveryLockTimeoutSeconds` (default 600s), via `FOR UPDATE SKIP
LOCKED`. attempt_count is incremented exactly once per claim; a delivery past the
cap becomes terminal `failed` instead of stuck. A `(status, locked_at)` index
supports the recovery scan.

### 0.4 Per‑device delivery tracking
New `notification_push_deliveries` (one row per `outbox_id` × active `push_token_id`,
`unique(outbox_id, push_token_id)`) holds per‑device status, ticket, receipt,
attempts, lock, and error. The raw token is **never** stored there (referenced by
id). Each Expo ticket/receipt maps to the exact device; `DeviceNotRegistered`
deactivates only that token (`deactivate_push_token_value` at send,
`deactivate_push_token_by_id` at receipt); one device's failure never affects
another's success; no active token → outbox `skipped: no_active_token`. RLS on,
no client policy, client DML revoked. The old single‑ticket
`notification_delivery_receipts` table was **removed** (receipts folded into the
delivery row).

**Logical‑outbox status meaning (issue 2):** `notification_outbox.status` is now a
dedicated enum `notification_outbox_status` = `pending → fanned | skipped | failed`.
**`fanned` means "materialized into per‑device deliveries", NOT "delivered".** The
actual delivery truth lives only in `notification_push_deliveries.status`
(`pending → processing → sent | failed | skipped`). Monitoring and any "delivered"
claim must read the per‑device deliveries, never the logical outbox status.

### 0.5 Generic remote push payload
The Expo payload is generic — title `سند`, body `لديك تذكير جديد` — with only
minimal routing ids in `data` (notification id, type, optional circle id,
deep‑link hint). **No** medication name, dosage, vital, note, diagnosis‑like text,
or recipient name leaves the device through Expo or onto a lock screen. The
detailed copy lives only in the in‑app `notifications` row; the app fetches it
after opening + re‑validating membership. Logs never contain titles/bodies/tokens.

### 0.6 Re‑review (issue 6) — all audited, holds
stale‑processing recovery ✓ · multi‑worker concurrency (SKIP LOCKED) ✓ · multiple
devices per user ✓ · membership removal between enqueue and send (revalidated) ✓ ·
preference/quiet‑hour change between enqueue and send (revalidated/re‑deferred) ✓ ·
expired delivery (skipped) ✓ · token rotation/account switch ✓ · receipt→token
mapping (per delivery) ✓ · circle‑tz vs recipient‑tz ✓ · DST gap (accepted edge) ✓ ·
duplicate reminder (dedupe) ✓ · duplicate device send (per‑device unique + atomic
fan‑out) ✓ · generic payload ✓ · no sensitive logs ✓ · service‑role/cron‑secret not
exposed ✓.

### 0.7 Hardening manual tests (run on a real build after manual deploy)
1. **Circle timezone:** set the circle to `Asia/Riyadh`; with a local (Riyadh) and
   a remote (e.g. London) member, a dose at 08:00 fires ONE occurrence at 05:00Z
   for both; each member's quiet hours apply in their own zone; each gets exactly
   one notification.
2. **Membership removed after enqueue:** enqueue a reminder, remove the recipient
   from the circle, then run the processor → the delivery is `skipped` with
   `not_member`; no push is sent; no other circle's data is exposed.
3. **Preference disabled after enqueue:** enqueue, turn the type off, run the
   processor → `skipped: not_eligible`.
4. **Quiet hours changed after enqueue:** enqueue outside quiet hours, then enable
   quiet hours covering "now"; the processor **re‑defers** (outbox back to pending,
   `available_at` = quiet‑hours end) and only sends after it ends.
5. **Expired notification:** enqueue with a short `expires_at`; after it passes the
   processor marks `skipped: expired` and sends nothing.
6. **Stale processing recovery:** force a delivery to `status='processing'` with an
   old `locked_at` (simulate a crashed worker); run the processor → it is reclaimed
   exactly once and sent (no double send); at the attempt cap it becomes `failed`.
7. **Multiple devices:** register two devices for one user → one notification
   creates two `notification_push_deliveries`; both receive. Force
   `DeviceNotRegistered` on one → only that token is deactivated; the other
   delivery stays `sent`.
8. **Generic lock‑screen payload:** confirm the received push shows the generic
   `سند` / `لديك تذكير جديد` (no medication name); opening it shows full detail in
   the app after membership re‑validation.
9. **Token deactivated after fan‑out:** with two devices, fan out, then set one
   `push_tokens.is_active = false`; run the processor → that device's delivery is
   `skipped` (`token_inactive`) **at the claim**, the other device sends.
10. **Fail‑then‑retry with membership change:** let a delivery fail transiently
    (retry scheduled), remove the member, then run the processor again → the retry
    is re‑validated and `skipped` (`not_member`); it is not sent.

All of tests 2–5, 9 and 10 exercise the **authoritative send‑time revalidation in
`claim_push_deliveries`** — the row must be valid *at the moment of the claim*, not
merely at fan‑out.

### 0.8 Final Edge & deployment hardening

1. **`verify_jwt = false` + cron secret.** `supabase/config.toml` disables platform
   JWT verification for the four scheduled functions (pg_cron/pg_net send only
   `x-cron-secret`, not a JWT); the handler still **fails closed (401)** without the
   correct high‑entropy `NOTIFICATIONS_CRON_SECRET` (constant‑time compared) — so
   the endpoints are not public in practice.
2. **Every Supabase call checked.** Shared `rpcChecked` / `queryChecked`
   (`_shared/db.ts`) fail loud on any `{error}` (logging only the op name +
   SQLSTATE). **Success counters never increment after a failed write**; if Expo
   accepted a message but recording `sent` fails, the row stays `processing` (no
   false "sent") and is reclaimed later.
3. **Claim lease.** `notification_push_deliveries.claim_token` — each claim/reclaim
   stamps a fresh uuid; `mark_delivery_sent/_failed/_skipped` update only where
   `status='processing' AND claim_token=…` and **return a boolean**. A stale worker
   loses the lease → no‑op → logged `stale_claim`, never a false success; the lease
   is cleared on every terminal/retry/skip/defer transition.
   `record_delivery_receipt` validates the expected ticket↔delivery relationship
   (returns false on mismatch). **At‑least‑once** delivery is documented — a
   post‑accept timeout can still duplicate; the lease only prevents stale DB‑state
   corruption, not provider‑level exactly‑once.
4. **Receipt polling.** Oldest‑first, only deliveries ≥ `receiptMinAgeMinutes` (15)
   old, bounded; tickets past `receiptRetentionHours` (24) with no receipt are
   marked `receipt_status='unchecked'` (`mark_stale_receipts_unchecked`). Receipt‑
   record and token‑deactivation errors are checked.
5. **Explicit role allow‑list.** `notification_recipient_eligible` returns false for
   any role not in {admin, primary_caregiver, family_member, remote_member} —
   including caregiver/elder and null/unknown — so an OLD membership stays safe, not
   only newly‑assigned ones; then it applies the remote_member restriction.
6. **One active token per value.** A partial unique index
   `push_tokens (expo_push_token) where is_active` is the hard invariant;
   `register_push_token` takes a transaction‑level advisory lock on the token so
   concurrent registrations serialize and the prior user's row is deactivated before
   the new one activates. Prior‑user deliveries then fail the send‑time ownership
   check.
7. **Expo Enhanced Push Security.** Optional `EXPO_ACCESS_TOKEN` is sent as a Bearer
   token on send + receipt calls (never logged / in the app / in Git); if Expo
   rejects with 401/403 and the token is unset, the function throws a clear "set
   EXPO_ACCESS_TOKEN" error. Recommended for production.
8. **No token in logs.** The old `redactToken` (which logged the last 6 chars of the
   raw token) was **removed**; logs use `push_token_id` / `delivery_id` only.

#### 0.8 test plans

1. **Cron‑secret auth:** POST with no header → 401; wrong secret → 401; correct
   secret → 200/executes.
2. **Stale vs newer claim:** Worker A claims (token X) and stalls; lock expires;
   Worker B reclaims (token Y) and records; Worker A's `mark_delivery_*` with token
   X returns false → logged `stale_claim`; B's result stands (A cannot overwrite B).
3. **Record failure ≠ false success:** force `mark_delivery_sent` to error after an
   OK ticket → counter not incremented, row stays `processing`, reclaimed next run.
4. **Receipt window:** a delivery sent 5 min ago is NOT polled; one sent 30 min ago
   is; with a backlog the oldest is selected first; a 25 h‑old unreceipted ticket
   becomes `receipt_status='unchecked'`.
5. **Old caregiver/elder membership:** a member whose stored role is caregiver or
   elder receives nothing (eligibility returns false).
6. **Concurrent token registration:** two users register the same token
   concurrently → exactly one active row remains; the other user's deliveries fail
   the ownership check at send.
7. **Expo access token on/off:** with `EXPO_ACCESS_TOKEN` set, send/receipts carry
   the Bearer header; with Enhanced Push Security on at Expo and the token unset,
   the function fails with the clear "set EXPO_ACCESS_TOKEN" error.
8. **Ambiguous send timeout:** a timeout after Expo accepted may duplicate
   (at‑least‑once); DB state stays consistent (the row is `sent` or reclaimed,
   never corrupted).

### 0.9 Privacy + source‑event validity

**Removed members can't read old circle notifications.** The notifications SELECT
policy now requires `user_id = auth.uid()` **AND** (`circle_id is null` **OR**
`is_active_user_circle_member(circle_id, auth.uid())`). A user removed from a circle
immediately loses read access to that circle's historical notifications (rows are
**kept**, not deleted); global/system rows (`circle_id is null`) stay visible;
rejoining/reactivation restores that user's own historical circle rows (an accepted,
documented trade‑off — the rows were always theirs). `set_notification_read` and
`mark_all_notifications_read` enforce the same predicate, so an invisible circle
notification can't be mutated through the definer either. No cross‑user access; the
SECURITY DEFINER membership helper avoids RLS recursion.

**Source‑event validity at send time.** A push can sit queued / quiet‑hours‑deferred
while its source changes. New authoritative, service‑only
`notification_source_validity(p_notification_id) → (valid, reason)` checks — from the
**immutable occurrence context in `notifications.data`** (no names/values) — that:
- `medication_due` / `medication_missed`: medication + schedule still active, the
  occurrence (weekday/time) still in the schedule and within start/end, and **no
  `medication_log`** for `schedule_id + dose_date + scheduled_time` (recorded → skip
  `dose_recorded`);
- `task_due`: task exists, `status='open'`, and current `due_date`/`due_time` still
  match the occurrence (completed/cancelled/rescheduled → skip);
- `appointment_upcoming`: appointment exists, `status='scheduled'`, current
  `starts_at` still matches (cancelled/rescheduled → skip);
- other types (visit/care/emergency/system): no concrete source id → unchanged.
It runs in **fan‑out** (early filter) and, **authoritatively**, in
`claim_push_deliveries`; an invalid row is `skipped` with a safe machine‑readable
reason (`dose_recorded`, `occurrence_changed`, `task_closed`, `appointment_closed`,
`schedule_inactive`, …), is **not** pushed, and **does not consume a send attempt**.
No source detail is logged.

**Immutable source context + occurrence‑aware dedupe + expiry.** Reminder `data` now
carries the exact occurrence (`scheduleId/doseDate/scheduledTime`;
`taskId/dueDate/dueTime/dueAt`; `appointmentId/startsAt/leadMinutes`) — DB‑only, never
in the generic Expo payload. Dedupe keys are occurrence‑aware:
`task:{id}:{dueDate}:{rawTimeOr'none'}` and `appt:{id}:{startsAt}:{lead}` (medication
keys were already occurrence‑aware), so a reschedule yields a NEW reminder while the
OLD queued occurrence fails source‑validity and is never pushed. `expires_at` is
bounded per type: medication_due → dose + grace boundary; medication_missed → dose +
max‑age backstop; task_due → due + `taskReminderExpiryHours` (6, still gated on
`open`); appointment_upcoming → the appointment start (never delivered after).
Historical inbox rows are **retained** (dedupe/expiry affect delivery, not history).

#### 0.9 test plans

1. Enqueue `medication_due`, record the dose before send → skipped `dose_recorded`,
   no push.
2. Enqueue `medication_missed`, record a late dose before send → skipped
   `dose_recorded`.
3. Enqueue `task_due`, complete/cancel before send → skipped `task_closed`, no push.
4. Reschedule a task → the old occurrence is skipped `occurrence_changed`; the new
   occurrence creates **exactly one** reminder (new dedupe key).
5. Cancel/reschedule an appointment → old occurrence skipped; the new occurrence
   produces the correct lead reminder.
6. User B receives a detailed circle notification; manager removes B; B refreshes →
   the circle notification is no longer selectable/readable, and `set_notification_read`
   can't mark it; B's **global** notifications remain visible.
7. A quiet‑hours‑deferred item is re‑validated (authorization **and** source) after
   quiet hours end, before sending.

---

## 1. Existing schema / package findings (pre‑work inspection)

**Packages already installed (no installs needed):** `expo@~56.0.9`,
`expo-notifications@~56.0.16`, `expo-device@~56.0.4`, `expo-constants@~56.0.17`,
`expo-localization@~56.0.6`, `expo-secure-store@~56.0.4`, `@supabase/supabase-js`,
`@tanstack/react-query`, `expo-router`, `zod`, `i18next`/`react-i18next`. **No new
dependency was required**; nothing was installed.

**Notification tables did not exist yet** — `push_tokens`,
`notification_preferences`, `notifications`, `notification_outbox` were all
absent, so they were created fresh (no conflicting duplicates).

**Reused existing primitives (verified in the migrations):**
- `public.set_updated_at()` trigger fn; `is_circle_member` / `has_circle_role` /
  `is_active_user_circle_member` / `active_circle_member_role` SECURITY DEFINER
  helpers (search_path‑hardened).
- `circle_role` enum (`admin, primary_caregiver, family_member, caregiver,
  remote_member, elder`); `member_status`; membership/ownership RPC pattern.
- `medication_schedules` (`days_of_week int[]` 0=Sun..6=Sat, `times time[]`,
  `start_date/end_date`, `is_active`), `medication_logs` (partial unique on
  `schedule_id,dose_date,scheduled_time`), `care_tasks` (`status open/…`,
  `due_date/due_time`), `care_appointments` (`status scheduled/…`, `starts_at`).
- Client conventions: typed `supabase` client at repo‑root `lib/supabase.ts`,
  per‑feature `api.ts`/`hooks.ts`/`schema.ts`, query keys including `circleId`,
  `CircleSelectionProvider`, Arabic‑first i18n with full en/ar parity, themed
  components, system date/time pickers (`TimeField`).

**Expo SDK 56 notification APIs confirmed against the versioned docs**
(`setNotificationHandler` with `shouldShowBanner`/`shouldShowList`,
`getPermissionsAsync`/`requestPermissionsAsync`, `getExpoPushTokenAsync({projectId})`,
`setNotificationChannelAsync` + `AndroidImportance`, received/response listeners
returning `EventSubscription`, `scheduleNotificationAsync` with
`SchedulableTriggerInputTypes.TIME_INTERVAL`).

---

## 2. Summary

- A **notification inbox** (`/notifications`) and **settings** (`/notification-settings`)
  screen, a bell with an unread badge in the dashboard + account, and a headless
  observer that handles the foreground handler, listeners, launch/resume token
  refresh, and deep‑link routing.
- An **explicit, Arabic‑first push opt‑in** — permission is never requested at
  launch. Token registration is RPC‑based and de‑duplicated, with device‑takeover
  and logout handling.
- A **service‑owned, two‑level delivery pipeline**: `notifications` (inbox) +
  `notification_outbox` (logical fan‑out job) + `notification_push_deliveries`
  (per‑device send), all behind RLS/grants that make cross‑user and cross‑circle
  access impossible. **Authorization is revalidated at the per‑device send claim**,
  not only at fan‑out.
- Four **Edge Functions** (source only): `enqueue-due-reminders`,
  `check-missed-doses`, `process-notification-outbox`, `check-push-receipts`, with
  deterministic dedupe, quiet‑hours deferral, a configurable missed‑dose grace
  period, and bounded retries.
- A reworked **role‑capability UX**: a central capability module, an explanatory
  two‑step role picker (browse → explicit Save → confirmation), and a separate
  Owner badge.

---

## 3. Role‑capability UX changes (Section A)

- **New `src/features/circle-members/role-capabilities.ts`** — the single source of
  truth for *currently implemented* capabilities. `ASSIGNABLE_ROLE_ORDER =
  [admin, primary_caregiver, family_member, remote_member]`. `caregiver`/`elder`
  are documented as **deferred** (excluded from assignable, with an explicit code
  comment) — they remain server‑rejected by `update_circle_member_role` and
  `create_circle_invitation`. `roleChangeDirection(from,to)` classifies a change as
  increase/decrease/lateral for the confirmation copy.
- **New `src/features/circle-members/role-modal.tsx`** — two‑step picker. Step 1:
  each role shows title + capability summary + an expandable **"Can do / Cannot
  do"** list, with the **current** role marked and a selected check. Selecting does
  **not** mutate the server. An explicit **"Save role change"** (disabled when
  unchanged) advances to Step 2: a **confirmation** summarizing `old → new` and the
  privilege direction, with **Confirm** and **Back** separate from **Cancel**.
- **`members-manager.tsx`** now uses the new modal; on RPC failure the modal stays
  open with its error so the manager can retry. The **Owner** badge is shown
  separately from role; owner/last‑admin actions stay disabled with an explanatory
  note. The RPC remains authoritative.
- **Label audit:** role titles everywhere resolve to `circleMembers.roles.*`
  (members manager, role modal, invite form, created‑invitation card), so wording
  is consistent across the app. Capability copy is provided in Arabic + English.

---

## 4. Files created / modified

**Created — client (notifications feature):**
`src/features/notifications/{api,schema,catalog,device,push-registration,hooks}.ts`,
`{notification-bell,notification-observer,push-status-card,notifications-center,notification-settings,reminder-notice}.tsx`;
routes `src/app/(app)/notifications.tsx`, `src/app/(app)/notification-settings.tsx`.

**Created — role UX:** `src/features/circle-members/role-capabilities.ts`,
`src/features/circle-members/role-modal.tsx`.

**Created — database:**
`supabase/migrations/20260611120000_create_notifications_core.sql`,
`supabase/migrations/20260611120100_create_notification_functions.sql`.

**Created — Edge Functions (Deno/TS):** `supabase/functions/_shared/{config,supabase,auth,log,time,expo,enqueue,messages}.ts`,
`supabase/functions/enqueue-due-reminders/index.ts`,
`supabase/functions/check-missed-doses/index.ts`,
`supabase/functions/process-notification-outbox/index.ts`,
`supabase/functions/check-push-receipts/index.ts`.

**Created — docs:** the complete SQL artifact (below), this report, and
`docs/deployment/notifications-and-reminders.md`.

**Modified:** `src/app/(app)/_layout.tsx` (routes + observer),
`src/app/(app)/(tabs)/account.tsx` (bell, settings link, logout token cleanup),
`src/features/care-circle/circle-dashboard.tsx` (bell),
`src/features/circle-members/members-manager.tsx` (new role modal),
`src/features/{medications,tasks,appointments}/*-center.tsx` (reminder notice),
`src/types/supabase.ts` (types), `src/locales/{en,ar}.json` (i18n), `tsconfig.json`
(exclude Deno function sources from app `tsc`).

---

## 5. Migrations & complete SQL artifact

- `20260611120000_create_notifications_core.sql` — tables, enums, indexes,
  constraints, `updated_at` triggers, RLS, grants.
- `20260611120100_create_notification_functions.sql` — all SECURITY DEFINER
  functions, with `revoke from public` + narrow `grant`.

**Complete executable artifact (apply once, idempotent, Dashboard‑only):**
`docs/claude-reports/2026-06-11-step-6-0-notifications-dashboard-complete.sql`
(1040 lines; re‑asserts the prerequisite `is_active_user_circle_member`, ends with
`notify pgrst, 'reload schema';`, no secrets/placeholders).

---

## 6. Tables / enums / RLS

**Enums:** `notification_type` (medication_due, medication_missed, task_due,
appointment_upcoming, visit_update, care_update, emergency, system),
`notification_channel` (push), `notification_outbox_status` (pending, processing,
sent, failed, skipped).

**Tables (all RLS‑enabled):**
- `push_tokens` — unique `(user_id, expo_push_token)`, `is_active`, `last_seen_at`,
  platform CHECK. **SELECT own only; client INSERT/UPDATE/DELETE revoked** (writes
  via RPC). Indexes: active‑per‑user, token‑value.
- `notification_preferences` — per‑type booleans, quiet hours, IANA `timezone`;
  `unique(user_id, circle_id)` **plus a partial unique index enforcing one global
  (`circle_id is null`) row per user**; quiet‑hours completeness CHECK. SELECT own;
  writes via RPC.
- `notifications` — inbox; `data jsonb`, `deep_link`, `read_at`, `expires_at`,
  `dedupe_key` with **partial unique `(user_id, dedupe_key)`**. **SELECT = own AND
  (global OR active member of `circle_id`)** — a removed member loses read access to
  that circle's rows (rows kept); all client writes revoked (server creates;
  read‑state via the membership‑checked RPCs). Indexes: `(user_id, created_at desc)`,
  `(circle_id, created_at desc)`, partial unread. (See §0.9.)
- `notification_outbox` — logical fan‑out job; `unique(notification_id, channel)`,
  status, `available_at`, `attempt_count`, `last_error`. **RLS on, no policy, all
  client DML revoked**. Index `(status, available_at)`. (See §0.4 — the old
  single‑ticket columns moved to per‑device deliveries.)
- `notification_push_deliveries` — per‑device send; `unique(outbox_id, push_token_id)`;
  status, `expo_ticket_id`, `receipt_status`, `error_code`, attempts, `locked_at`.
  **RLS on, no policy, client DML revoked**; the raw token is never stored (FK to
  `push_tokens`). Indexes: `(status, available_at)`, `(status, locked_at)`,
  `(push_token_id)`, partial receipt‑pending.

---

## 7. RPCs / functions (Section G)

All are `SECURITY DEFINER`, `set search_path = ''`, schema‑qualified, `revoke from
public`, then granted to the **narrowest** role:

**Client (`authenticated`):** `register_push_token`, `deactivate_push_token`,
`upsert_notification_preferences`, `set_notification_read`,
`mark_all_notifications_read`, `is_valid_timezone`.

**Server‑only (`service_role`, never `authenticated`):** `enqueue_notification`
(the only creation path — validates active membership, dedupes, enqueues),
`circle_notification_recipients`, `notification_recipient_eligible`,
`notification_source_validity` (is the source care event still due?),
`effective_notification_prefs`, `notification_defer_until`,
`fanout_due_notifications` (materialize per‑device deliveries + early filter),
`claim_push_deliveries` (FOR UPDATE SKIP LOCKED — **authoritative send‑time
revalidation, incl. source‑event validity,** + crash recovery),
`mark_delivery_sent/_failed/_skipped`, `record_delivery_receipt` (per delivery),
`mark_stale_receipts_unchecked`, `deactivate_push_token_value`,
`deactivate_push_token_by_id`. Plus `set_circle_timezone` (manager‑only,
`authenticated`).

A normal member therefore **cannot** send a notification to an arbitrary
recipient/title/body — `enqueue_notification` is not granted to them.

---

## 8. Push‑token lifecycle (Section D)

- **No auto‑prompt:** launch only *refreshes* a token when permission is already
  granted; the permission prompt fires only from the explicit **Enable** action on
  the Arabic‑first explanation card (`push-status-card.tsx`).
- `register_push_token` upserts the caller's `(user_id, expo_push_token)` row
  (refreshing platform/device/version, bumping `last_seen_at`) and **deactivates
  the same raw token under other users** (device account switch).
- Project id is resolved from `expo.extra.eas.projectId` / `easConfig`; if missing,
  the UI shows a clear "not fully configured" message (typed `ProjectIdMissingError`).
- Android `default` channel created at runtime; restrained foreground handler
  (banner + list, no sound/badge); listeners registered with cleanup; **cold‑start
  taps** handled via `getLastNotificationResponseAsync` (deduped against the
  response listener).
- **Logout** deactivates this device's token *before* `signOut` (RPC needs auth).
- **Web**: `pushSupport()` returns `web-unsupported`; no fake token — the in‑app
  center still works and the UI says device push isn't available on web.
- The raw token is never logged (client or server).

---

## 9. Notification center & settings UI (Sections E, K, L)

- **`/notifications`** — recent‑first inbox (global across circles, optional
  per‑circle filter chips when >1 circle), type icon + label, timestamp, circle
  name, unread styling + dot, tap → mark read + deep link, per‑item mark
  read/unread, **mark all read** (respects the active filter), empty/error/loading
  states, **load more** paging, pull‑to‑refresh.
- **`/notification-settings`** — push status/enable/retry/disable, **scope** selector
  (global default or a specific circle), all 8 per‑type toggles, quiet hours
  (enable + From/To time fields), timezone display, and a **local test
  notification** (native only, clearly labelled, server‑free).
- **Entry points:** bell with unread badge on the dashboard header and the account
  header; a notification‑settings link card on the account screen; reminder‑status
  notices on the medications/tasks/appointments centers (user/circle‑level, not
  per row).
- **Multi‑circle safety:** query keys include `userId` + `circle_id`; the inbox is
  global but filterable; a notification tap switches the active circle **only after
  verifying the user is still an active member** — otherwise it routes to the inbox
  rather than exposing a circle they left.

---

## 10. Preference & quiet‑hour behavior

- `effective_notification_prefs` merges **circle‑specific over global over
  defaults**, per field; timezone falls back to UTC.
- Quiet hours defer **push delivery** (the inbox row is created immediately).
  `notification_defer_until` computes, in the recipient's timezone, the next
  delivery time and **correctly handles windows crossing midnight**
  (`start > end`). **Emergency** notifications bypass quiet hours (and the settings
  copy says so — which is true because the function returns `now()` for emergencies).
- Timezone is captured from the device (`expo-localization`) and stored on the
  global preferences on enable; it is validated server‑side against
  `pg_timezone_names`.

---

## 11. Recipient‑role matrix (`circle_notification_recipients`)

A member receives a type only when **role‑eligible AND** the matching preference is
on (defaults true). `remote_member` is a follow‑up role: **excluded from
`medication_due` and `task_due`** (operational reminders for the people doing care)
but eligible — per their preferences — for `medication_missed`,
`appointment_upcoming`, `visit_update`, `care_update`, `emergency`. `caregiver`/
`elder` are not special‑cased (and are unassignable), so they never distort
recipients. `emergency` honors `emergency_alerts`; `system` ignores prefs.

| type | medication_due | medication_missed | task_due | appointment | visit/care | emergency |
|---|---|---|---|---|---|---|
| admin / primary_caregiver / family_member | ✅ pref | ✅ pref | ✅ pref | ✅ pref | ✅ pref | ✅ pref |
| remote_member | ❌ | ✅ pref | ❌ | ✅ pref | ✅ pref | ✅ pref |

---

## 12. Reminder / dedupe logic & missed‑dose grace (Sections F, H)

- **Medication due:** per active schedule × candidate **circle‑local** day
  (today+tomorrow, so a just‑after‑midnight dose isn't missed) × time; the ONE
  canonical occurrence fires when the dose instant (**circle tz**) lands in
  `[now, now+20m]`; **skipped if a `medication_log` already exists** for that
  scheduled dose; then enqueued for each eligible recipient (their own quiet hours
  apply). Dedupe key `med:{schedule}:{circleYmd}:{time}` — identical for all
  recipients (each de‑duped per user).
- **Task due:** open tasks with a due date; date‑only tasks default to 09:00 local.
  Dedupe `task:{id}` (one reminder per task). Completed/cancelled tasks are
  excluded (status filter).
- **Appointment upcoming:** lead times 24h + 1h, each deduped `appt:{id}:{lead}`;
  uses absolute `starts_at` (tz‑independent trigger). Completed/cancelled excluded.
- **Missed dose:** `check-missed-doses` raises one **neutral** alert per dose whose
  time passed > the **60‑minute grace period** (configurable in `_shared/config.ts`,
  not a scattered magic number) and is not older than the 12h backstop, **only when
  no log exists at run time** (re‑checked → no false positive after a late record).
  Dedupe `med_missed:{schedule}:{localYmd}:{time}`. The message only states the
  family‑entered dose has not been recorded — no medical interpretation.
- All idempotency rests on the **`(user_id, dedupe_key)` unique** + `ON CONFLICT DO
  NOTHING` in `enqueue_notification`, so retries/overlaps never duplicate.

---

## 13. Edge Functions (Section H) & deployment (I, O)

`enqueue-due-reminders` (circle‑tz occurrences), `check-missed-doses`,
`process-notification-outbox`, `check-push-receipts` — TypeScript/Deno,
service‑role only, authorized by a constant‑time `NOTIFICATIONS_CRON_SECRET` check
(**fail‑closed** if unset), bounded batch sizes, structured logs without
tokens/secrets/health values, no user‑controlled message relay, no medical advice.
The outbox processor runs **two phases**: (A) `fanout_due_notifications`
materializes per‑device deliveries; (B) `claim_push_deliveries` is the
**authoritative send‑time gate** (re‑validates membership/role/pref/quiet/expiry/
token **and source‑event validity** at every claim + stale reclaim, stamping a
`claim_token` lease) and the
processor sends a **generic** payload only for returned rows, records the per‑device
result **under the lease** (a lost lease → `stale_claim`, never a false success;
**every** Supabase call goes through `rpcChecked`/`queryChecked`), retries transient
failures with bounded backoff, and deactivates a token only on the **definitive**
`DeviceNotRegistered` error. `check-push-receipts` polls oldest‑first / ≥15 min old,
validates the ticket↔delivery relationship, marks tickets past the 24 h retention
window `unchecked`, and retires a token via `deactivate_push_token_by_id` on a
definitive receipt error. The four functions set `verify_jwt = false` in
`config.toml` (cron‑secret auth in the handler) and support an optional
`EXPO_ACCESS_TOKEN` for Expo Enhanced Push Security. **Not deployed.** Manual deploy
commands, secrets, and the pg_cron + pg_net cron design (placeholders kept out of
committed migrations) are in `docs/deployment/notifications-and-reminders.md`.

---

## 14. Deep‑link behavior (Section K, L)

`notificationRoute()` prefers `deep_link`, then `data.deepLink`, then a per‑type
fallback: medication → `/medications`, task → `/tasks/{id}`, appointment →
`/appointments/{id}`, missed dose → `/medications`, emergency → `/emergency-card`.
Detail screens already fail gracefully (maybeSingle) if the referenced record was
deleted. A tap switches circle only if the user is still an active member; else it
opens the inbox.

---

## 15. Type changes (Section M — every manual addition reported)

`src/types/supabase.ts` (final objects only — no stale entries):
- **Tables added:** `push_tokens`, `notification_preferences`, `notifications`,
  `notification_outbox`, `notification_push_deliveries` (incl. the new
  `claim_token` lease column) + Relationships; plus `care_circles.timezone`.
- **Enums added:** `notification_channel`, `notification_type`,
  `notification_outbox_status` (`pending/fanned/skipped/failed`), and
  `notification_delivery_status` (`pending/processing/sent/failed/skipped`)
  (type union + `Constants` arrays).
- **Functions added:** `register_push_token`, `deactivate_push_token`,
  `deactivate_push_token_value`, `deactivate_push_token_by_id`, `is_valid_timezone`,
  `notification_defer_until`, `effective_notification_prefs`,
  `notification_recipient_eligible`, `notification_source_validity`,
  `circle_notification_recipients`,
  `enqueue_notification`, `upsert_notification_preferences`, `set_notification_read`,
  `mark_all_notifications_read`, `fanout_due_notifications`, `claim_push_deliveries`
  (returns `claim_token` + `push_token_id`), `mark_delivery_sent` / `_failed` /
  `_skipped` (take `p_claim_token`, **return boolean**), `record_delivery_receipt`
  (takes `p_expected_ticket`, returns boolean), `mark_stale_receipts_unchecked`,
  `set_circle_timezone`.
- The removed single‑delivery objects (`notification_delivery_receipts`,
  `claim_notification_outbox`, `mark_outbox_*`) and the obsolete `token_active` /
  `p_outbox_id` shapes are **absent** from the types — no stale entries, no broad
  casts to conceal missing types.

---

## 16. Commands run & results (Section P)

| Command | Result |
| --- | --- |
| locale JSON parse + **en/ar key parity** | ✅ both parse; **751 keys each, 0 missing** either side |
| `npx tsc --noEmit` | ✅ **exit 0** (no type errors) — re‑run after every pass |
| `npx expo export --platform web` | ✅ **exit 0**; `/notifications` and `/notification-settings` present — re‑run after the Edge/deployment hardening |
| SQL artifact static checks | ✅ 3 ordered parts, 3 `notify pgrst` reloads, **balanced `$$`**, **24 functions = 24 grants**, 5 tables/RLS, **no** `<…>`/secrets, **no** removed objects (`notification_delivery_receipts`, `claim_notification_outbox`, `mark_outbox_*`, `token_active`, `p_outbox_id`) |
| `verify_jwt = false` for all 4 functions | ✅ static grep of `config.toml` → 4 blocks |
| unchecked `sb.rpc(` in Edge Functions | ✅ none — only inside `rpcChecked` (db.ts) or with inline `if (error) throw` (enqueue.ts) |
| raw/partial token logging (`redactToken` / `token.slice`) | ✅ none — logs use `push_token_id` / `delivery_id` |
| notifications SELECT requires active membership (circle‑linked) | ✅ policy + read‑state RPCs use `is_active_user_circle_member(circle_id, …)` |
| `notification_source_validity` called from fan‑out **and** claim | ✅ both call sites present (fan‑out early filter; claim authoritative) |
| task/appointment dedupe keys include the occurrence | ✅ `task:{id}:{dueDate}:{rawTime}` / `appt:{id}:{startsAt}:{lead}` |
| medication reminder `data` includes schedule/date/time | ✅ `scheduleId` + `doseDate` + `scheduledTime` (due + missed) |
| unit/helper tests | n/a — the project defines no test runner (`package.json` scripts: start/android/ios/web/lint only); test scenarios are in §0.7 / §0.8 / §0.9 |
| `git status --short` / `git diff --stat` | captured below |

No `git commit` was run. `dist/` (web export output) is gitignored and does not
appear in `git status`.

---

## 17. Adversarial review — findings & fixes

Reviewed every item on the threat list; the design holds. Two robustness fixes were
applied during review:

1. **Multiple active tokens per device** (token rotation before deactivation) could
   make `fetchDeviceToken().maybeSingle()` throw → **fixed** to `order(last_seen_at
   desc).limit(1)`.
2. **Cold‑start tap** (app launched from a killed state) is not delivered by the
   response listener → **added** `getLastNotificationResponseAsync` handling, deduped
   by request identifier so a tap never routes twice.

Verified safe (no change needed):
- **Cross‑user read** — `notifications`/`push_tokens`/`preferences` SELECT own only;
  all client writes revoked; read‑state via user‑scoped RPCs.
- **Token leakage** — owner‑only SELECT; never returned to managers; never logged.
- **Cross‑circle delivery** — recipients resolved from active members only;
  `enqueue_notification` checks membership, and `claim_push_deliveries`
  **re‑checks active membership at send time** (skips `not_member`).
- **Auth/pref/quiet/expiry change after fan‑out** — `claim_push_deliveries`
  re‑validates expiry, membership, role, preference, quiet hours and token at every
  claim/reclaim; failures `skip` (no attempt consumed), quiet hours `re‑defer`.
- **Duplicate reminders / replay** — stable dedupe keys + `(user_id, dedupe_key)`
  unique + `ON CONFLICT DO NOTHING`; outbox `unique(notification_id, channel)`;
  deliveries `unique(outbox_id, push_token_id)`.
- **Concurrent send / double‑send** — `claim_push_deliveries` claims per‑device rows
  with `FOR UPDATE SKIP LOCKED` and flips them to `processing`; fan‑out is atomic,
  so no double send.
- **Arbitrary‑message abuse** — `enqueue_notification` granted to `service_role`
  only.
- **Invalid/stale tokens** — deactivated only on definitive `DeviceNotRegistered`;
  transient errors retry with bounded backoff and an attempt cap.
- **Quiet hours crossing midnight** — handled in `notification_defer_until`.
- **Timezone/date boundary** — **circle‑tz** occurrence math with today±1 candidate
  days; quiet hours computed in the recipient zone; DST gap is the one accepted
  edge case.
- **Missed‑dose false positive after a log** — log existence re‑checked at run time.
- **Role/recipient mismatch** — encoded in `circle_notification_recipients`.
- **Tap into a left circle** — membership re‑checked before switching.
- **Secret exposure** — service‑role key only in the Functions runtime; cron secret
  in env, not in migrations; nothing in the bundle or logs.

---

## 18. Manual test plan (run on a physical device build with `eas.projectId` set)

1. Open a member's role → verify capability descriptions, the explicit **Save role
   change**, and the **confirmation** dialog (old → new + direction); Cancel/Back
   are separate; Owner shows as a badge.
2. From the explanation card, tap **Enable notifications** and grant permission.
3. Re‑install / deny permission → confirm the app still works and shows the "turned
   off" hint; the inbox still loads.
4. Register one physical device → a `push_tokens` row appears active for that
   device.
5. Settings → **Send a test notification** → it appears on the device only (no
   server row, no other member affected).
6. Notification center → open an item (marks read + deep links), toggle
   read/unread, **mark all read**; verify empty/error/load‑more.
7. Change per‑circle preferences (toggle a type off) and save; re‑open to confirm
   persistence; verify global vs circle scope override.
8. Set quiet hours crossing midnight (e.g., 22:00 → 07:00); enqueue a non‑urgent
   reminder during the window → the inbox shows it immediately but the push is
   deferred until 07:00 local.
9. Create a medication due in the next few minutes; run `enqueue-due-reminders` →
   exactly one due reminder/push.
10. Re‑run `enqueue-due-reminders` / `process-notification-outbox` → **no
    duplicate** (same `notification_outbox` row, no new notification).
11. Record the dose, then re‑run `check-missed-doses` → **no** missed‑dose alert.
12. Leave a dose unrecorded past the 60‑min grace → exactly one **neutral**
    missed‑dose alert (states only "not recorded yet").
13. Complete/cancel a task → no stale task reminder is generated.
14. Create an appointment ~24h / ~1h out → one reminder per lead, no duplicates.
15. Belong to two circles → confirm the inbox filter and that data/notifications
    never mix across circles.
16. Remove yourself from circle B, then tap a B notification → it does **not**
    switch into B; it routes to the inbox safely.
17. Inspect function logs / outbox rows → confirm **no raw tokens, secrets, or
    health values** appear anywhere.

### Physical‑device remote‑push test plan (delivery)
Build a dev/EAS build with `eas.projectId` (+ APNs key / FCM v1 credentials in
Expo). Register a real device, deploy the four functions to the **Sanad** project,
set `NOTIFICATIONS_CRON_SECRET`, schedule the cron jobs, then drive a real
medication‑due reminder end‑to‑end and monitor **per device** in
`notification_push_deliveries` (`status` pending→processing→sent, `expo_ticket_id`,
`receipt_status`, `error_code`); the logical `notification_outbox.status` shows
`fanned` (materialized — not a delivery confirmation). Force a bad token to confirm
`DeviceNotRegistered` deactivates only that token. Then run the §0.7 send‑claim
revalidation and multi‑device tests.

---

## 19. Known risks / assumptions

- **EAS project id** must be added to `app.json` for real device push; until then
  the UI degrades gracefully (clear message). Real delivery also needs APNs/FCM
  credentials in Expo.
- **Care‑circle timezone** (`care_circles.timezone`) is the canonical zone for
  wall‑clock medication/task schedules (see §0.1); the recipient/user timezone is
  used only for quiet hours / display. DST transition gaps remain an accepted edge
  case for reminder timing.
- **Notification copy is Arabic‑first** (generated server‑side); per‑recipient
  locale (`profiles.locale`) localization is a planned enhancement.
- Edge Functions and the SQL were **not executed** here — they are written to the
  established patterns and `tsc`/web‑export validate the app side, but end‑to‑end
  remote push must be verified on a physical device after manual deployment.
- The 1‑minute outbox cron is the main recurring cost; tune cadence to volume.

---

## 20. Git status & safe‑to‑commit

`git status --short` (untracked dirs collapsed):
```
 M src/app/(app)/(tabs)/account.tsx
 M src/app/(app)/_layout.tsx
 M src/features/appointments/appointments-center.tsx
 M src/features/care-circle/api.ts
 M src/features/care-circle/circle-dashboard.tsx
 M src/features/circle-members/members-manager.tsx
 M src/features/circle-selection/api.ts
 M src/features/circle-selection/hooks.ts
 M src/features/circle-selection/permissions.ts
 M src/features/medications/medications-center.tsx
 M src/features/tasks/tasks-center.tsx
 M src/locales/ar.json
 M src/locales/en.json
 M src/types/supabase.ts
 M supabase/config.toml
 M tsconfig.json
?? docs/claude-reports/2026-06-11-step-6-0-notifications-dashboard-complete.sql
?? docs/claude-reports/2026-06-11-step-6-0-notifications-reminder-engine.md
?? docs/deployment/
?? src/app/(app)/notification-settings.tsx
?? src/app/(app)/notifications.tsx
?? src/features/circle-members/role-capabilities.ts
?? src/features/circle-members/role-modal.tsx
?? src/features/circle-selection/circle-timezone-card.tsx
?? src/features/notifications/
?? supabase/functions/
?? supabase/migrations/20260611120000_create_notifications_core.sql
?? supabase/migrations/20260611120100_create_notification_functions.sql
?? supabase/migrations/20260611120200_add_care_circle_timezone.sql
```

`git diff --stat`: 16 tracked files changed, **+1133 / −109**, plus the new files
above (notifications feature, Edge Functions + `_shared/db.ts`, 3 migrations, docs).

> Note: `docs/claude-reports/step-6-functions.zip` also appears as untracked but was
> **not created by this work** (it predates / is external to this pass); it was left
> untouched.

**Safe‑to‑commit:** Yes — additive and isolated; `tsc` and the web export pass;
locales are at parity; no secrets are committed; the cron snippet with real
URLs/secrets and the Expo/cron secrets are documented only (not in any migration).
**Per instructions, nothing was committed.**

---

## 21. Confirmation — no Supabase CLI account changes

No `supabase login`, `supabase logout`, `supabase link`, `supabase db push`, or
`supabase functions deploy` was run. No remote SQL was applied. Only local
migration files, Edge Function source, client code, types, i18n, the complete SQL
artifact, the deployment guide, and this report were created/modified. The global
Supabase CLI account was not touched.
