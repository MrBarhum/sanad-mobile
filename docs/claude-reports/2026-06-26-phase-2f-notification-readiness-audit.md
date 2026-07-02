# Phase 2F — Notification Readiness Audit (Sanad Operational Workflows)

**Status:** Audit & design only. No code, SQL, deployment, or Supabase interaction performed.
**Scope:** Read‑only audit of the existing notification/reminder stack + the responsibility/claim
product model, and a design for how notifications must behave under that model. **No notifications
were implemented.**
**Baseline commit:** `ba2a92e feat(product): add available-to-claim workflow`.
**Prior phases folded in:** responsibility assignment UI (2B), strict operational scoping (2B),
responsibility‑based RLS hardening (2D), available‑to‑claim RPCs + UI (2E).

---

## 0. Executive summary (read this first)

The task brief frames Phase 2F as "design notification rules **before** implementing notification
code." That framing is only half right, because **a full notification & reminder engine already
exists in this repo** — it just predates the responsibility/claim model and is **not deployed yet.**

What already exists (Step 6.0, 2026‑06‑11):

- **Three committed migrations** (`20260611120000_create_notifications_core.sql`,
  `..._120100_create_notification_functions.sql`, `..._120200_add_care_circle_timezone.sql`) defining
  the inbox, a **two‑level outbox** (`notification_outbox` → `notification_push_deliveries`),
  `push_tokens`, `notification_preferences`, and ~20 `SECURITY DEFINER` functions with send‑time
  revalidation, quiet hours, per‑device leases, and receipts.
- **Four Deno Edge Functions** (`enqueue-due-reminders`, `process-notification-outbox`,
  `check-missed-doses`, `check-push-receipts`) — source complete, **not deployed**.
- **A complete client surface** (`src/features/notifications/*`): explicit opt‑in push registration,
  channel‑before‑permission on Android, an in‑app notification center, a settings screen with 8
  per‑type toggles + quiet hours + timezone, and honest web/simulator degradation.

The single most important finding of this audit:

> **The engine resolves recipients circle‑broad, by role + preference. The 2026‑06‑26 product model
> resolves responsibility per‑item (`assigned_to` / `responsible_user_id` / `visitor_user_id`), and
> Phase 2D RLS now *hides* those very rows from non‑responsible members. The two layers were never
> reconciled.** If the engine is deployed as‑is, a medication/task/appointment reminder fans out to
> **every** eligible `family_member` — not the responsible one — and each non‑responsible recipient
> who taps the reminder lands on a **detail screen that RLS now returns empty**. Phase 2F must close
> this gap **before** the engine is turned on.

Because the engine is not deployed, there is **no live notification spam today**; there is a
readiness gap, not a production incident. That gives us room to design correctly first.

---

## 1. Current notification infrastructure

### 1.1 What exists today — server (committed migrations)

| Object | Purpose | Notes |
| --- | --- | --- |
| `push_tokens` | Expo token registry, one active token per (user, token) | Hard invariant: a raw token is active for **at most one user** (advisory lock + partial unique index). Owner‑only `SELECT`; writes via RPC. |
| `notification_preferences` | Per‑user, per‑circle (or global `circle_id=null`) prefs | 8 booleans, quiet hours (start/end, can cross midnight), user timezone. Owner‑only `SELECT`; writes via `upsert_notification_preferences`. |
| `notifications` | User‑visible inbox row (title/body/data/deep_link) | May carry detail (for the authenticated in‑app center). `SELECT` = own **and** (`circle_id is null` or active member). No client writes. Dedupe on `(user_id, dedupe_key)`. |
| `notification_outbox` | **Logical** fan‑out job, one per (notification, channel) | Status `pending → fanned │ skipped │ failed`. `fanned` = *materialized into deliveries*, **not delivered**. Service‑only (RLS on, no policy). |
| `notification_push_deliveries` | **Per‑device** send unit | One row per (outbox, active token). Holds Expo ticket/receipt, `attempt_count`, `locked_at`, `claim_token` lease. Raw token never stored here. Service‑only. |

Key `SECURITY DEFINER` functions (grants: `authenticated` for own‑data RPCs, `service_role` for the
engine):

- **Client:** `register_push_token`, `deactivate_push_token`, `upsert_notification_preferences`,
  `set_notification_read`, `mark_all_notifications_read`.
- **Recipient resolution:** `effective_notification_prefs` (circle over global over default, per
  field), `notification_recipient_eligible` (role + preference matrix), `circle_notification_recipients`.
- **Delivery:** `enqueue_notification` (only creation path; dedupe + quiet‑hours‑aware
  `available_at`), `fanout_due_notifications` (Phase A, re‑validate + materialize), `claim_push_deliveries`
  (Phase B, **authoritative** send‑time gate, per‑device lease), `mark_delivery_sent/failed/skipped`,
  `record_delivery_receipt`, `mark_stale_receipts_unchecked`, `deactivate_push_token_value/_by_id`.
- **Quiet hours / tz:** `notification_defer_until` (recipient‑tz window, midnight‑crossing,
  emergency bypass), `is_valid_timezone`, `set_circle_timezone` (manager‑only), `notification_source_validity`.

### 1.2 What exists today — Expo push token registration (client)

- `acquireExpoPushToken()` (`push-registration.ts`): short‑circuits via `pushSupport()` (returns
  `web-unsupported` on web, `no-device` on simulators, else `supported`); resolves the EAS
  `projectId` from `Constants.expoConfig.extra.eas.projectId` (never hardcoded; throws
  `ProjectIdMissingError` if absent); calls `ensureAndroidChannel()`; then
  `Notifications.getExpoPushTokenAsync({ projectId })`. **The raw token is never logged.**
- Server registration: `registerPushToken()` → RPC `register_push_token(p_token, p_platform,
  p_device_id, p_app_version)`; `deactivatePushToken()` → `deactivate_push_token(p_token)`.
- A persisted, non‑hardware **device id** (`device.ts`, SecureStore on native / `localStorage` on
  web) lets re‑registration update the same `push_tokens` row instead of duplicating.
- Lifecycle (`usePushRegistration`): `enable()` is the **only** prompt path; `refresh()` re‑registers
  silently only when permission is already `granted`; `disable()` deactivates. `useNotificationObservers`
  calls `refresh()` on mount and on `AppState 'active'` — **never** prompting.

### 1.3 What exists today — permission opt‑in & Android channel

- **Opt‑in is strictly explicit / user‑driven.** No permission is requested as a side effect of
  import or launch. One `enable()` path, wired to one button in `push-status-card.tsx`. Order inside
  `enable()`: `ensureAndroidChannel()` → `requestPermission()` → register — i.e.
  **channel‑before‑permission** on Android. `EnableResult` honestly surfaces every outcome
  (`enabled | denied | unsupported | no-device | project-id-missing | error`).
- **One Android channel**, id `default`, name **"Sanad reminders"**, importance `DEFAULT`,
  `enableVibrate: true`. Created at runtime (idempotent). **No** high‑importance channel for
  emergencies or time‑sensitive alerts; **no** per‑channel sound/lockscreen config.
- `app.json` adds the `expo-notifications` plugin as a **bare string with no config block** — no
  build‑time notification icon, color, default sounds, or `defaultChannel`. The channel exists only
  via the runtime call.

### 1.4 What exists today — notification tables / functions

Covered in §1.1. The engine is a **three‑table pipeline** (inbox → logical outbox → per‑device
deliveries) with send‑time revalidation and per‑device leases. (The Step 6.0 report calls it
"two‑level"; precisely, the two *delivery* levels are the logical outbox `fanned` state and the
per‑device deliveries — the inbox is a third table.)

### 1.5 Deployment state

**Not deployed.** All rollout is manual via the Sanad Supabase Dashboard:

- **DB:** applied by pasting the idempotent artifact
  `docs/claude-reports/2026-06-11-step-6-0-notifications-dashboard-complete.sql` (mirrors the three
  committed migrations).
- **Edge Functions:** `supabase functions deploy {…} --project-ref <SANAD_PROJECT_REF>` (run by the
  user, never from this environment).
- **Scheduling:** `pg_cron` + `pg_net` `net.http_post` with an `x-cron-secret` header. Documented
  cadence: outbox **every 1 min**, due‑reminders **every 5 min**, missed‑doses **every 10–15 min**,
  receipts **every 15–30 min**. `config.toml` sets `verify_jwt=false` for all four; each handler
  fails **closed** (401) unless `NOTIFICATIONS_CRON_SECRET` matches (constant‑time).
- **Secrets:** `NOTIFICATIONS_CRON_SECRET` (required, all four), `EXPO_ACCESS_TOKEN` (optional,
  recommended), plus device‑push prerequisites: EAS `projectId` in `app.json` and APNs/FCM v1
  credentials uploaded to Expo. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` auto‑injected.

### 1.6 What is missing (the Phase 2F gap)

1. **Responsibility‑aware recipient resolution.** Recipients are resolved circle‑broad
   (`circle_notification_recipients(p_circle_id, p_type)` → *every* active role‑eligible member).
   Nothing references `assigned_to` / `responsible_user_id` / `visitor_user_id`.
2. **No lifecycle / claim / assignment event types.** The `notification_type` enum has **8** values
   (reminder‑centric). No `*_assigned`, `*_claimed`, `*_completed`, `*_cancelled`, `task_overdue`,
   `visit_upcoming`, or a claim digest.
3. **No producers for claim/assignment/outcome.** The Phase 2E claim RPCs emit nothing; no trigger or
   job fires on assignment, completion, cancellation, reassignment, or claim.
4. **Family visits have no server reminders.** `enqueue-due-reminders` covers medication/task/
   appointment only; `visit_update` has a preference toggle but **no producer**, and
   `notification_source_validity` does **not** validate visits.
5. **No responsibility check in source‑validity or send‑time revalidation.** A reminder for an item
   since claimed/reassigned to someone else is not suppressed for the now‑irrelevant recipient.
6. **`remote_member` semantics diverge** (see §3).
7. **Deep links may now be RLS‑invisible** to non‑responsible recipients (see §0 and §9).
8. **Schema‑replay drift:** the responsibility/claim layer (two live‑only columns, all 2D policies/
   helpers, all 2E RPCs/triggers) has **no migration files** — it lives only in dashboard‑applied
   apply‑packs. A `supabase db reset` would **not** reproduce the live schema. Any Phase 2F SQL must
   be authored against the **live** schema, not the committed migrations.
9. **Copy is Arabic‑only** server‑side; no per‑recipient locale.

---

## 2. Notification event taxonomy

### 2.1 Events that already exist (produced today, once deployed)

| Existing `notification_type` | Producer | Meaning |
| --- | --- | --- |
| `medication_due` | `enqueue-due-reminders` | Scheduled dose in `[now, +20m]` (circle tz); skipped if a `medication_logs` row exists |
| `medication_missed` | `check-missed-doses` | Neutral "not recorded yet" after 60‑min grace (12h backstop) |
| `task_due` | `enqueue-due-reminders` | Open task with a due date (date‑only → 09:00 circle‑local) |
| `appointment_upcoming` | `enqueue-due-reminders` | 24h + 1h leads on absolute `starts_at` |
| `visit_update` | *(none — orphan type)* | Defined + preference‑gated, **no producer** |
| `care_update` | *(none — orphan type)* | Defined + preference‑gated, **no producer** |
| `emergency` | *(none yet)* | Bypasses quiet hours; honors `emergency_alerts` |
| `system` | *(none yet)* | Ignores preferences |

### 2.2 Events needed for the responsibility/claim model (proposed)

Design choice: **do not explode the enum into ~24 values.** Keep the 4 reminder types as‑is, add a
small set of new lifecycle/claim/awareness types, and carry a fine‑grained `event` discriminator in
`notifications.data` where a single type covers several sub‑events. This keeps preference toggles
few (older‑adult UX) and keeps per‑type routing/glyph/source‑validity manageable.

| Proposed event | Backing `notification_type` | New? | Primary recipient | Push vs in‑app |
| --- | --- | --- | --- | --- |
| `task_assigned` | `task_assigned` (new) | ✅ | assignee | in‑app + optional push |
| `task_claimed` | `item_claimed` (new, `data.entity=task`) | ✅ | managers | in‑app + optional push |
| `task_due_soon` | `task_due` (existing) | — | assignee | push |
| `task_overdue` | `task_overdue` (new) | ✅ | assignee, then managers (escalation) | push |
| `task_completed` | `item_completed` (new, `data.entity=task`) | ✅ | managers / creator | in‑app (push optional) |
| `task_cancelled` | `item_cancelled` (new, `data.entity=task`) | ✅ | managers / creator | in‑app (push optional) |
| `medication_responsible_assigned` | `medication_assigned` (new) | ✅ | responsible member | in‑app + optional push |
| `medication_claimed` | `item_claimed` (`entity=medication`) | ✅ | managers | in‑app + optional push |
| `medication_dose_due` | `medication_due` (existing) | — | responsible member | push |
| `medication_dose_missed` | `medication_missed` (existing) | — | responsible member, then managers (escalation) | push |
| `appointment_assigned` | `appointment_assigned` (new) | ✅ | assignee | in‑app + optional push |
| `appointment_claimed` | `item_claimed` (`entity=appointment`) | ✅ | managers | in‑app + optional push |
| `appointment_upcoming` | `appointment_upcoming` (existing) | — | assignee | push |
| `appointment_completed` | `item_completed` (`entity=appointment`) | ✅ | managers / creator | in‑app |
| `appointment_cancelled` | `item_cancelled` (`entity=appointment`) | ✅ | managers / creator | in‑app |
| `visit_assigned` | `visit_assigned` (new) | ✅ | visitor | in‑app + optional push |
| `visit_claimed` | `item_claimed` (`entity=visit`) | ✅ | managers | in‑app + optional push |
| `visit_upcoming` | `visit_upcoming` (new) | ✅ | visitor | push |
| `visit_completed` | `item_completed` (`entity=visit`) | ✅ | managers / creator | in‑app |
| `visit_cancelled` | `item_cancelled` (`entity=visit`) | ✅ | managers / creator | in‑app |
| `available_to_claim_digest` | `claim_digest` (new) | ✅ | claim‑capable doers (opt‑in) | one push/day max |

**Net new enum values (proposed, 8):** `task_assigned`, `task_overdue`, `medication_assigned`,
`appointment_assigned`, `visit_assigned`, `visit_upcoming`, `item_claimed`, `item_completed`,
`item_cancelled`, `claim_digest`. (An alternative "one generic `activity` type +
`data.event`" design is noted in §8.3.) Each new type needs a client `catalog.ts` entry (label,
glyph, deep‑link fallback) and a preference bucket (see §5).

> **"Unable" is not a new state.** Per Phase 2E, "unable/تعذّر" maps to the existing `cancelled`
> enum value on every entity. So `*_cancelled` copy must cover both a manager cancelling and a doer
> being unable to complete — the wording distinguishes intent, the data model does not.

---

## 3. Recipient rules

The governing principle for Phase 2F: **operational reminders follow responsibility (per‑item),
awareness/outcome notifications follow management (role).** The current engine does the opposite for
reminders (broadcasts by role). Below, "responsible" = the item's `assigned_to` /
`responsible_user_id` / `visitor_user_id`; "managers" = `{admin, primary_caregiver}`.

### 3.1 Tasks (`care_tasks.assigned_to`)

- **`assigned_to`** → `task_due_soon`, `task_overdue`, `task_assigned` (when set), and action
  reminders. This is the change: today `task_due` goes to *all* eligible members.
- **Managers** → `task_claimed`, `task_completed`, `task_cancelled` (awareness of coverage/outcome).
- **Unassigned open tasks** → **do not** spam all family members by default. They surface only in the
  in‑app *"متاح للتكفّل"* feed (pull), plus the optional opt‑in `available_to_claim_digest` (§4).

### 3.2 Medications (`medications.responsible_user_id`)

- **`responsible_user_id`** → `medication_dose_due`, `medication_dose_missed`,
  `medication_responsible_assigned`.
- **Managers** → missed‑dose **escalation** (after the responsible member's grace lapses) and
  `medication_claimed`. Prefer a targeted escalation ladder over a broadcast (§5).
- **Unassigned meds** (no responsible person) → notify **managers only** (so a dose isn't silently
  dropped); never spam remote/family. Surfaces in the claim feed + digest.

### 3.3 Appointments (`care_appointments.assigned_to` — live‑only column)

- **`assigned_to`** → `appointment_upcoming` (24h + 1h), `appointment_assigned`.
- **Managers** → `appointment_claimed`, and outcome awareness (`appointment_completed/cancelled`,
  including the assignee‑recorded outcome via `set_assigned_appointment_outcome`).
- **Unassigned scheduled appointments** → managers still get the upcoming reminder (nobody else is
  accountable yet); appears in the claim feed.

### 3.4 Visits (`family_visits.visitor_user_id`)

- **`visitor_user_id`** → `visit_upcoming` (**new producer required**), `visit_assigned`.
- **Managers** → `visit_claimed`, outcome awareness.
- **Unlinked planned visits** → managers only; claim feed.

### 3.5 Remote members (`remote_member`)

- **No operational action reminders.** No due/overdue/dose reminders and no "you must act" pushes —
  `remote_member` has **no** operational responsibility and cannot claim (2E rejects with `42501`).
- Today the engine still pushes `medication_missed`, `appointment_upcoming`, `visit_update`,
  `care_update` to remote by role. Under the new model, **remote should default to read‑only /
  summary‑only.** Recommendation: exclude `remote_member` from *all* operational reminder + outcome
  types by default, and reserve for it a future **summary/digest** surface (`remote_summary` toggle
  already exists). Do **not** overload `remote_member` for a future clinical viewer — that is a
  separate role.

### 3.6 Admin / primary caregiver (managers)

- Operational **manager alerts** (claims, completions, cancellations, missed‑dose escalations,
  unassigned‑item awareness) and **summaries/digests**. Managers may also receive reminders for items
  they personally own (a manager can claim from the feed).

### 3.7 Elder

- **No assumptions.** `elder` is defined but **not activated**; there are no elder members. Emit
  nothing to elders until the role is activated and a deliberate design exists.

### 3.8 Recipient matrix (target state)

| Event | Assignee/Responsible | Managers | Other doers | Remote | Elder |
| --- | :---: | :---: | :---: | :---: | :---: |
| `*_due` / `*_upcoming` | ✅ | own items only | ❌ | ❌ | ❌ |
| `task_overdue` / `dose_missed` | ✅ first | ✅ escalation | ❌ | ❌ | ❌ |
| `*_assigned` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `*_claimed` | (confirm, optional) | ✅ | ❌ | ❌ | ❌ |
| `*_completed` / `*_cancelled` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `available_to_claim_digest` | — | opt‑in | opt‑in | ❌ | ❌ |
| `emergency` | ✅ | ✅ | ✅ | ✅ (per pref) | ❌ |

---

## 4. Claim‑flow notification rules

The Phase 2E claim flow is: unassigned items appear in *"متاح للتكفّل"* (`list_available_to_claim`);
a claim is an **immediate** atomic `UPDATE … SET <owner col> = auth.uid() WHERE <col> IS NULL`; the
already‑claimed race raises `23505` and is surfaced **in‑app only**; the claimer owns
outcome/status only. Notification rules:

1. **On claim, notify managers.** Emit `item_claimed` (`data.entity`, `data.itemId`,
   `data.claimedBy`) to `{admin, primary_caregiver}` so managers know the item is now covered and by
   whom. This is the "future manager notification" the 2E reports explicitly deferred; the claim RPCs
   (`claim_care_task`, `claim_medication_responsibility`, `claim_care_appointment`,
   `claim_family_visit`) are the natural producer hook (server‑side, so it can't be skipped by an
   offline client). Tone: neutral/appreciative, not alarming (§7).
2. **Claimer confirmation — in‑app is enough.** The claimer already gets the in‑app success sheet
   (`تم التكفّل بهذا العنصر`). A push confirmation to the claimer is **optional and off by default**;
   only send one if the claimer's device wasn't foreground at claim time (edge case, low value).
3. **Other family members get nothing on claim.** No broadcast. A claim is not their concern and
   would be pure noise. (This also prevents "someone claimed the thing I was about to claim" churn.)
4. **The already‑claimed race is in‑app only — never a notification.** Losing a race is handled by
   the `23505` → warning sheet + refetch. It must **not** generate a push or inbox row.
5. **Claiming suppresses the broadcast problem at the source.** Once responsibility‑scoped recipient
   resolution (§3) is in place, a claimed item's future `*_due`/`*_upcoming` reminders go to the new
   owner only — so claiming an item *narrows* who is reminded, exactly as intended. Reassignment by a
   manager must re‑target pending reminders too (§8.4).

---

## 5. Urgency & escalation model

| Level | Meaning | Delivery | Example events |
| --- | --- | --- | --- |
| **Immediate** | Happening now, must reach the owner | Push (respect quiet hours unless emergency) | `emergency`; a same‑day `*_assigned` to the owner |
| **Scheduled reminder** | Time‑based, ahead of the event | Push at lead time | `medication_dose_due`, `task_due_soon`, `appointment_upcoming` (24h+1h), `visit_upcoming` |
| **Overdue / missed** | The window passed without action | Push to owner, then escalate | `task_overdue`, `medication_dose_missed` |
| **Daily digest** | Batched, low‑urgency awareness | ≤1 push/day, opt‑in | `available_to_claim_digest`; a future remote summary |
| **Manager escalation** | Owner didn't act; a manager should know | Push to managers after a grace ladder | missed‑dose escalation, overdue escalation |

**Push vs in‑app guidance:**

- **Push‑worthy:** owner reminders (`*_due`, `*_upcoming`), `*_missed`/`*_overdue`, `emergency`, and
  (optionally) `*_assigned` to the owner and `*_claimed` to managers.
- **In‑app only by default:** `*_completed`, `*_cancelled` (managers can read them in the center;
  push is opt‑in), the claimer's own success, and every already‑claimed race.
- **Escalation ladder (recommended, medication missed):** dose slot passes → 60‑min grace → notify
  **responsible member** (`medication_dose_missed`) → if still unrecorded after a second grace,
  escalate to **managers**. Today `check-missed-doses` broadcasts one neutral alert to all eligible
  members at once with **no accountable owner** — the ladder replaces that.

Emergency remains the only type that **bypasses quiet hours** (`notification_defer_until` returns
`now()` for `emergency`), and `system` ignores preferences. Keep those two invariants.

---

## 6. Quiet hours / older‑adult UX considerations

The existing engine already embodies most of this; keep it and extend carefully.

- **Avoid spam by default.** Reminders are conservative and preference‑gated; quiet hours exist and
  are recipient‑tz aware. New event types must default to **restrained** — outcome/claim events
  in‑app‑only, digest ≤1/day. Do **not** add a push per lifecycle transition.
- **One push per item, not many.** Dedupe is `(user_id, dedupe_key)` with occurrence‑aware keys
  (`med:{sched}:{ymd}:{time}`, `task:{id}:{dueDate}:{occ}`, `appt:{id}:{startsAt}:{lead}`,
  `med_missed:{sched}:{ymd}:{time}`). New events must define equally strict keys, e.g.
  `claim:{entity}:{itemId}` (one claim notice per item), `assigned:{entity}:{itemId}:{assigneeId}`,
  `overdue:{taskId}:{dueDate}`. **Never** re‑notify the same occurrence.
- **Clear, non‑alarming wording.** No panic language. A missed dose is *"جرعة لم تُسجَّل"* ("a dose
  isn't recorded"), never *"you missed a dose / danger"*. An "unable" outcome is *"تعذّر"*, framed
  neutrally.
- **Urgent missed‑dose may override the digest but must stay calm.** A missed‑dose escalation is a
  standalone push (not batched away), yet keeps neutral, non‑diagnostic language and **no medical
  interpretation** (Sanad records/reminds; it does not judge).
- **Arabic‑first copy.** Every event needs Arabic first, then English. Use **Western digits** (0–9)
  for all times/counts, and isolate LTR runs (medication/English names, times, `500 mg`) at render
  (`LtrText`/bidi isolation) — never force a whole container LTR. Remote push copy stays **generic**
  (see §7).
- **Honesty.** Local reminders are not guaranteed; copy must not promise delivery reliability. Keep
  the existing distinction between the local **test** notification, real reminders, and remote push.

---

## 7. Suggested notification copy

Two‑layer copy model (matches the current design and privacy posture):

- **Remote push payload stays generic** — today it is a single `genericPushMessage`
  (title **سند** / body **لديك تذكير جديد**), carrying **no health detail** to a lock screen. For
  Phase 2F, at most add a **category‑level generic** push body for *non‑medical* events (a task/visit
  isn't sensitive), while **medication** events stay fully generic. Example category push bodies:
  *"لديك تذكير جديد"* (medication — unchanged), *"لديك مهمة بحاجة إلى متابعة"* (task), *"لديك موعد
  قادم"* (appointment). No names, doses, or diagnoses ever leave the device in the push.
- **The in‑app inbox row carries the detail** (below). `{braces}` are LTR‑isolated at render;
  times/counts use Western digits.

| Group | AR (inbox title / body) | EN (inbox title / body) |
| --- | --- | --- |
| **Assignment — task** | `مهمة جديدة لك` / `أُسندت إليك مهمة: {عنوان المهمة}.` | `A task for you` / `You've been asked to handle: {task title}.` |
| **Assignment — medication** | `دواء بعهدتك` / `أصبحت مسؤولًا عن متابعة دواء {اسم الدواء}.` | `A medication in your care` / `You're now responsible for {medication name}.` |
| **Assignment — appointment** | `موعد بعهدتك` / `أُسند إليك موعد: {عنوان الموعد}.` | `An appointment for you` / `You've been asked to handle: {appointment title}.` |
| **Assignment — visit** | `زيارة باسمك` / `سُجّلت زيارة باسمك: {عنوان الزيارة}.` | `A visit under your name` / `A visit is recorded for you: {visit title}.` |
| **Claim (to managers)** | `تم التكفّل` / `{اسم العضو} تكفّل بـ {اسم العنصر}.` | `Someone stepped in` / `{member} is now handling {item}.` |
| **Due soon — medication** | `تذكير بالدواء` / `{اسم الدواء} — الساعة {الوقت}.` *(existing)* | `Medication reminder` / `{medication name} — at {time}.` |
| **Due soon — task** | `تذكير بمهمة` / `{عنوان المهمة}.` *(existing)* | `Task reminder` / `{task title}.` |
| **Due soon — appointment** | `موعد قادم` / `{عنوان الموعد} — بعد {المدة}.` *(existing)* | `Upcoming appointment` / `{appointment title} — in {lead}.` |
| **Due soon — visit** *(new)* | `زيارة قادمة` / `{عنوان الزيارة} — {الوقت}.` | `Upcoming visit` / `{visit title} — {time}.` |
| **Missed — dose** | `جرعة لم تُسجَّل` / `لم تُسجَّل بعد جرعة {اسم الدواء} المقررة الساعة {الوقت}.` *(existing, neutral)* | `A dose isn't recorded` / `{medication name}'s dose for {time} isn't recorded yet.` |
| **Overdue — task** *(new)* | `مهمة تجاوزت وقتها` / `ما زالت مهمة {عنوان المهمة} مفتوحة.` | `A task is past its time` / `Still open: {task title}.` |
| **Completed — task** | `تم إنجاز مهمة` / `{اسم العضو} أنجز مهمة: {عنوان المهمة}.` | `A task is done` / `{member} completed: {task title}.` |
| **Completed — appointment/visit** | `تم تسجيل الإتمام` / `سُجّل إتمام {عنوان العنصر}.` | `Marked complete` / `{item} was marked complete.` |
| **Cancelled / unable — task** | `تعذّر إنجاز مهمة` / `لم يتم إنجاز مهمة {عنوان المهمة}.` | `A task couldn't be done` / `{task title} wasn't completed.` |
| **Cancelled — appointment/visit** | `أُلغي عنصر` / `أُلغي {عنوان العنصر}.` | `Cancelled` / `{item} was cancelled.` |
| **Claim digest** *(new)* | `عناصر بانتظار التكفّل` / `هناك {العدد} عنصر بحاجة إلى من يتكفّل بها.` | `Items waiting for an owner` / `{count} items need someone to take them on.` |

All copy is short, non‑diagnostic, and non‑alarming. Medication copy states the recorded fact only
(name + time), never an interpretation ("late", "dangerous", "you missed"). English strings are for
the future per‑recipient‑locale enhancement; Arabic is the shipping default.

---

## 8. Data model / backend readiness

### 8.1 Already present (reuse — do not rebuild)

- Inbox + two‑level outbox + per‑device deliveries; `enqueue_notification` (dedupe + quiet hours);
  `fanout_due_notifications` and `claim_push_deliveries` (send‑time revalidation + leases);
  receipts + token invalidation; `notification_preferences` (+ `effective_notification_prefs`);
  per‑circle timezone (`care_circles.timezone`, `set_circle_timezone`); recipient‑tz quiet hours
  (`notification_defer_until`); `is_active_user_circle_member` recipient‑validity gate.

### 8.2 Needed — event source / outbox

- **`enqueue_notification` is the only creation path** and is already service‑role‑only and
  dedupe‑guarded. **Reuse it** for every new event — no second outbox. The gap is *producers*, not
  the outbox.

### 8.3 Needed — new types + preferences

- Add the new `notification_type` enum values (§2.2) **or** adopt a single generic `activity` type
  discriminated by `data.event` (fewer enum values, but the client `catalog.ts`, glyphs, labels, and
  `notification_source_validity` must switch on `data.event`). **Recommendation:** explicit enum
  values for anything push‑worthy or preference‑gated (`task_assigned`, `task_overdue`,
  `medication_assigned`, `appointment_assigned`, `visit_assigned`, `visit_upcoming`); a generic
  `item_claimed` / `item_completed` / `item_cancelled` with `data.entity` for the awareness family
  (keeps managers' toggles to one bucket).
- **Preferences — keep the toggle count low** (older‑adult UX). Proposed additions to
  `notification_preferences` and `upsert_notification_preferences`: `assignment_alerts`
  (owner: "assigned to me / I claimed"), `activity_updates` (managers: claims + outcomes),
  `available_to_claim_digest`. Reuse existing `medication_reminders` / `task_reminders` /
  `appointment_reminders` / `missed_dose_alerts` for the reminder family; add a `visit_reminders`
  toggle (visits currently only have `visit_updates`).

### 8.4 Needed — responsibility‑aware recipient resolution (the core change)

- Extend recipient resolution so operational reminders target the **owner**, not the circle. Options:
  1. **Producer passes the recipient** — `enqueue-due-reminders` selects the item's `assigned_to` /
     `responsible_user_id` / `visitor_user_id` and enqueues to that single user (falling back to
     managers when the owner is null). Simplest; keeps `enqueue_notification`'s per‑user shape.
  2. **New resolver** `circle_notification_recipients_for_item(circle_id, type, entity, item_id)`
     that returns the owner (or managers if unowned) — parallels the existing role‑based resolver.
- **Add a responsibility gate to `notification_source_validity`** (or a sibling) so a queued
  `*_due`/`*_upcoming` for an item that has since been **claimed/reassigned to a different user** is
  skipped for the stale recipient at fan‑out **and** at `claim_push_deliveries` (the authoritative
  send‑time gate). This closes the "reassigned between enqueue and send" gap and the RLS‑invisible
  deep‑link problem (§9).
- **Extend `notification_source_validity` to cover visits** (`family_visits` status/occurrence),
  currently unvalidated.

### 8.5 Needed — deduplication keys

Occurrence‑ and owner‑scoped keys for the new events (examples): `assigned:{entity}:{itemId}:{ownerId}`,
`claim:{entity}:{itemId}`, `overdue:{taskId}:{dueDate}`, `visit_due:{visitId}:{date}:{time}`,
`completed:{entity}:{itemId}`, `cancelled:{entity}:{itemId}`, `claim_digest:{userId}:{localYmd}`.

### 8.6 Needed — delivery status / retry / per‑user prefs / tz / cron

- **Delivery status / retry** — already complete (per‑device statuses, backoff, leases, receipts).
  No change.
- **Per‑user preferences** — extend as §8.3.
- **Per‑circle timezone** — already present and canonical for schedule wall‑clock; reuse for the new
  `visit_upcoming` producer.
- **Scheduled jobs / cron** — the reminder + missed + outbox + receipts crons already cover the
  reminder families. **New cron needs:** a **digest** job (once/day per circle‑local morning) for
  `available_to_claim_digest`, and (if overdue escalation is time‑based) reuse `check-missed-doses`'s
  pattern for `task_overdue`. Claim/assignment/outcome events are **event‑driven** (producer at the
  RPC/trigger), not cron.
- **Edge Function vs trigger** — reminders stay in the existing Edge Functions. Claim/assignment/
  outcome events are best emitted **server‑side** (inside the claim RPCs and/or `AFTER` triggers on
  `care_tasks`/`care_appointments`/`family_visits`/`medications`/`medication_logs`), because clients
  can go offline mid‑write and the claim/outcome logic already runs in the DB. Producers call
  `enqueue_notification` (service‑role) — they must run as `SECURITY DEFINER` with a service‑role‑
  equivalent grant, or the RPC must itself enqueue.

### 8.7 Locale (future)

- `messages.ts` is Arabic‑only. A `profiles.locale` per‑recipient enhancement is already noted as
  planned; new copy should be authored with the EN/AR pairs in §7 so the locale switch is drop‑in.

---

## 9. Security / RLS considerations

- **The producer must respect the responsibility RLS model.** Post‑2D, detail rows are scoped:
  - `care_tasks` SELECT: managers/remote (`can_view_all_operational`) **or** `assigned_to = me` **or**
    `completed_by = me`.
  - `care_appointments` SELECT: managers/remote **or** `assigned_to = me`.
  - `family_visits` SELECT: managers/remote **or** `visitor_user_id = me`.
  - `medication_logs` SELECT: managers/remote **or** responsible‑for‑that‑med.
  - `medications` / `medication_schedules` SELECT: **broad** (shared catalog).

  Therefore a reminder's **recipient must be someone who can actually read the item**, or the
  deep‑link lands on an empty screen. Targeting the owner (§3, §8.4) satisfies this automatically;
  broadcasting by role does not.
- **Never leak medication/appointment/visit detail to an unauthorized user.** Two safeguards already
  hold and must be preserved: (a) the **remote push payload is generic** (no names/doses/diagnoses);
  (b) the **inbox row** is RLS‑guarded (own row + active member). A producer must **not** put
  sensitive detail into a notification whose recipient can't read the underlying row — so an
  `item_claimed`/outcome notice to **managers** may name the item (managers can read it), but such a
  notice must not go to a non‑owner family member.
- **`remote_member` rules.** Broad read‑only, no operational reminders, cannot claim/own. Default it
  **out** of operational reminder + outcome push; reserve summary/digest for later. Keep it a family
  observer — a clinical viewer is a separate future role.
- **Service‑role boundaries.** All engine functions are `revoke all from public; grant execute to
  service_role`. Edge Functions run with the service‑role client and fail **closed** on a missing/
  wrong `NOTIFICATIONS_CRON_SECRET`. New producers/jobs must keep the same posture: service‑role or
  `SECURITY DEFINER` with `set search_path = ''`, and **never** widen a grant to `authenticated`.
- **Push tokens & privacy.** One active token per user (hard invariant); raw token never stored in
  deliveries and never logged; `DeviceNotRegistered` deactivates the token. Preserve all of this.
  Member **display names** for `{member}` in claim/outcome copy come from the
  `list_circle_members` `SECURITY DEFINER` RPC (profiles RLS is own‑row only) — not from direct
  `profiles` reads.

---

## 10. Implementation plan proposal (future phases)

- **2F‑1 — Audit / report only *(this document)*.** No SQL, no code, no deploy.
- **2F‑2 — Data‑model / outbox SQL proposal.** New enum values, new preference columns +
  `upsert_notification_preferences` signature, responsibility‑aware recipient resolver, a
  responsibility gate + visit coverage in `notification_source_validity`. **Authored against the live
  schema** (mind the migration drift, §1.6.8). Proposal + apply‑pack only — no execution.
- **2F‑3 — Event producers for claim / assignment / outcome.** Server‑side producers in the claim
  RPCs and `AFTER` triggers → `enqueue_notification`. Deliberately conservative (in‑app‑first).
- **2F‑4 — Scheduled reminders for due / missed / overdue, responsibility‑targeted.** Rework
  `enqueue-due-reminders` + `check-missed-doses` to target owners with manager escalation; add the
  `visit_upcoming` producer and the `task_overdue` path.
- **2F‑5 — Preferences / quiet hours for the new families.** New toggles wired through client
  `schema.ts` / `catalog.ts` / settings UI + i18n (AR/EN), digest opt‑in.
- **2F‑6 — QA + real‑device push testing.** §11, on the S24 Ultra (Arabic/RTL/dark), plus the digest
  cron and escalation ladder.

Each phase is independently shippable and gated: **do not deploy the reminder engine to production
until 2F‑2/2F‑4 land**, or reminders will broadcast to non‑responsible members and deep‑link into
RLS‑empty screens.

---

## 11. QA plan (manual, with `[QA]` users)

Using the seeded `[QA]` circle members (`family1` = a family_member doer; managers; a remote member):

- [ ] **family1 gets only their own task reminders** — a `task_due` for a task assigned to family1
  arrives; a `task_due` for a task assigned to someone else does **not**.
- [ ] **family1 gets only their own medication reminders** — `medication_dose_due`/`_missed` only for
  meds where `responsible_user_id = family1`.
- [ ] **Managers get claim / outcome awareness** — when family1 claims an item, managers receive
  `item_claimed`; on complete/cancel, managers receive the outcome notice.
- [ ] **Remote member gets no operational action reminders** — no `*_due`/`*_upcoming`/`*_missed`
  pushes; (later) only summaries.
- [ ] **No duplicate pushes** — a dose/occurrence produces exactly one push; re‑runs of the cron do
  not re‑notify (dedupe key holds); an already‑claimed race produces **zero** notifications.
- [ ] **Android channel still works** — `default` channel "Sanad reminders" present; reminders land;
  emergency (if a high‑importance channel is added) is distinguishable.
- [ ] **Web does not falsely test native push** — on web the settings screen hides the local‑test
  section and shows the "device push isn't available" copy; no fake token.
- [ ] **Deep links resolve for the recipient** — tapping a reminder opens a detail screen the
  recipient can actually read (no RLS‑empty screen).
- [ ] **Quiet hours** — a non‑emergency push during quiet hours is deferred to the window end in the
  recipient's tz; an emergency is not.
- [ ] **Copy** — Arabic‑first, Western digits, neutral/non‑alarming, no medical interpretation; remote
  push stays generic (no names/doses on the lock screen).

---

## 12. Risks / open questions

1. **Reminder cadence** — is the documented 1/5/10/15‑min cron cadence right for the user base, or
   should due‑reminders run more/less often? (Cost vs. latency trade‑off; outbox‑every‑1‑min is the
   main cost driver.)
2. **Managers: instant vs digest** — do managers want an instant push per claim/outcome, or a batched
   manager digest? (Instant is simplest but noisier; digest is calmer.)
3. **Remote summaries** — should `remote_member` get periodic read‑only summaries later, and at what
   cadence? (The `remote_summary` toggle exists but is unused.)
4. **Medication names in push text** — confirm the policy: **generic remote push** (recommended,
   current design) vs. named push. Recommendation: keep medication remote push fully generic; detail
   stays in the inbox.
5. **Multiple caregivers for the same elder** — the model supports many doers; responsibility is
   **per‑item** (exactly one owner per row). Confirm that "notify the owner + escalate to managers" is
   the desired accountability model (vs. notifying all doers of unassigned items).
6. **Notification fatigue** — the new lifecycle/claim families risk over‑notifying. Recommendation:
   ship them **in‑app‑first**, push opt‑in, digest for the low‑urgency ones; measure before enabling
   more pushes.
7. **Escalation timing** — how long after a missed dose / overdue task before managers are escalated?
   (Needs a product decision; suggest a second grace window mirroring the 60‑min dose grace.)
8. **Schema drift** — the responsibility/claim layer has no migration files. Before 2F‑2 SQL, decide
   whether to first **backfill migrations** for the live‑only columns/policies/RPCs so the notification
   changes build on a reproducible schema (recommended) or continue dashboard‑apply‑pack‑only.
9. **A high‑importance Android channel** for emergencies/time‑sensitive alerts is not defined; adding
   one is a native‑config change (`app.json` / channel setup) and needs explicit approval.

---

## 13. Confirmation

- ✅ **No SQL run.** No migrations, apply‑packs, or queries executed.
- ✅ **No Supabase CLI / connection.** No `supabase` command, no login/link/db push/functions deploy,
  no remote DB access, no schema introspection against the live project.
- ✅ **No app code changed except this report.** No source, dependencies, Expo config, native files,
  backend functions, generated types, or migrations were modified. The only new file is this
  markdown report.
- ✅ **No env / secrets touched.** No `.env` read, no tokens/keys inspected or printed.
- ✅ **No commit / no stage / no EAS / no prebuild.** Nothing committed, staged, or built. No other
  project touched (ThinkMate untouched).

## 14. `git` status & diff

See the command output appended by the operator below (run at hand‑off):

- `git --no-pager status --short`
- `git --no-pager diff --stat`

The only expected change is the addition of this untracked file:
`docs/claude-reports/2026-06-26-phase-2f-notification-readiness-audit.md`.
