# Phase 2F-8C - Positive outbox / push smoke-test EXECUTION PACK (no execution)

**Status:** No-execution **execution pack** for the first *positive* `enqueue-due-reminders` ->
`process-notification-outbox` -> real Expo push smoke test. **Claude ran no Supabase CLI, no SQL, made no DB
connection, invoked no Edge Function, enabled no cron, processed no outbox, and sent no push.** Nothing was
executed against the database or Expo. Every SQL block and every PowerShell command below is **authored for
later, separately approved manual use** and is explicitly marked read-only / future / not-executed. The only
filesystem write in this phase is this report; the only commands run are the two local read-only checks in
Section 14 and the read-only git status/diff in Section 16.

**Baseline (pushed) commit:** `ae32d58 docs(product): plan outbox processor smoke test`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).

**Sources inspected read-only (no file modified):**

- Producer: `supabase/functions/enqueue-due-reminders/index.ts` (task-due window = `taskLookaheadMinutes`).
- Processor: `supabase/functions/process-notification-outbox/index.ts` (two-phase fan-out + claim/send).
- Shared: `_shared/config.ts` (`REMINDER_CONFIG`), `_shared/auth.ts` (`authorizeScheduledRequest` /
  `NOTIFICATIONS_CRON_SECRET`, fail-closed), `_shared/messages.ts` (`genericPushMessage()` ->
  `سند` / `لديك تذكير جديد`), `_shared/expo.ts` (Expo send client), `_shared/enqueue.ts`
  (`recipientsForItem` -> `notification_recipients_for_item_event`).
- Migrations: `20260611120000_create_notifications_core.sql` (tables + enums + RLS for `push_tokens`,
  `notifications`, `notification_outbox`, `notification_push_deliveries`),
  `20260611120100_create_notification_functions.sql` (`enqueue_notification`, `fanout_due_notifications`,
  `claim_push_deliveries`, `mark_delivery_*`, `deactivate_push_token_value`),
  `20260626164000_notifications_responsibility_resolvers.sql` (**current committed**
  `notification_source_validity` + `notification_recipient_current` +
  `notification_recipients_for_item_event`), `20260626163000_...types_preferences.sql` (enum/preference
  context), `20260610090000_create_care_tasks.sql` (task columns + status enum + collaborator scope),
  `20260626160000_backfill_phase_2a_assignment_columns.sql` (assignment columns).
- Prior QA records: `2F-8A` (outbox processor smoke-test plan), `2F-7H` (QA cleanup execution record).

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **This is a positive push EXECUTION PACK - no execution.** No producer is invoked, no processor is invoked,
  no push is sent, no cron is enabled, no SQL is run, and no data is mutated in this phase. Every command is
  authored for a future, separately approved run and marked **DO NOT RUN**.
- **The current invalid row will NOT be used as the positive row.** The pending outbox row for notification
  `5ba7fb2d-cd29-470a-b2fe-f41df75051fc` (`task_due`) points at task `23bff3fa-...`, now `completed`, so
  `notification_source_validity` returns `(false, task_closed)` (and its 6h expiry has since passed, so
  `expired` fires first). It is designed to be **skipped**, never sent, and cannot demonstrate a delivery.
- **The positive test therefore requires a controlled fresh fixture:**
  - **one active known test device token** for the owner user `a6dc7376-fd9d-461f-9d14-41eabcd3f538`
    (exactly one active `push_tokens` row on one device - Section 3);
  - **a fresh, valid, open task fixture** (Section 5) with an in-window occurrence so source-validity returns
    `(true, ok)` at send time;
  - **exactly one new valid notification / outbox row** produced from that fixture (Sections 6-9);
  - **one manual producer invocation** (`enqueue-due-reminders`, Section 8);
  - **one manual outbox processor invocation** (`process-notification-outbox`, Section 10);
  - **no cron** at any point.
- **Expected outcome (when the future run is approved and executed):**
  - **one real Expo push arrives** on the test device (generic copy: title `سند`, body `لديك تذكير جديد`);
  - **one `notification_push_deliveries` row** is created and reaches `status = 'sent'` (Expo accepted the
    ticket); receipts are polled later by `check-push-receipts` (out of scope here);
  - the **old invalid row may become `skipped`** only because the processor is database-wide and will
    co-process it (terminal `skipped`, `last_error = 'expired'` or `'task_closed'`, **no push**) - this is
    expected and safe. This pack does **not** require clearing it first (see the note in Section 4).
  - **no real family data is touched** - the fixture lives in the QA circle only, and the DB-wide gates below
    prove nothing else is in a producer window.
- **This report authorizes nothing to run.** Both the producer and the processor invocations require
  **separate, explicit approval** immediately before execution, after the prechecks in this pack pass.

---

## 2. Required target user / QA circle

| Field | Value | Role in this test |
| ----- | ----- | ----------------- |
| QA circle | `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` | the only circle any fixture / notification may touch |
| Owner user (recipient) | `a6dc7376-fd9d-461f-9d14-41eabcd3f538` | task assignee + push recipient + push-token owner |
| Old invalid notification | `5ba7fb2d-cd29-470a-b2fe-f41df75051fc` | **must NOT be the positive row**; co-processed -> skipped only |
| Old completed task | `23bff3fa-130d-4e29-96ec-80bac0647060` | closed; inert for every producer scan; **not** the fixture |

- The **positive fixture is a NEW task** created in Section 5, never the old completed task and never the old
  invalid notification.
- Every SQL block below is scoped to the QA circle and/or the owner user; the DB-wide gates (Sections 4, 7)
  exist to prove nothing *outside* the QA fixture is eligible.

---

## 3. Device-token precheck (SELECT-only)

**Do not run until the positive test is approved.** Confirms the owner has **exactly one active push token on
one device** so the run produces exactly one push. Full Expo tokens are sensitive and are **never** selected;
the optional listing masks the token to its scheme prefix only.

```sql
-- READ ONLY. 2F-8C positive-push precheck. No mutation, no Edge invocation, no cron. COUNT ONLY.
-- Never selects the raw expo_push_token value.
select
  count(*)                                                  as total_tokens,
  count(*) filter (where pt.is_active)                      as active_tokens,
  count(distinct pt.device_id)                              as distinct_devices,
  count(distinct pt.device_id) filter (where pt.is_active)  as active_distinct_devices,
  case
    when count(*) filter (where pt.is_active) = 1
     and count(distinct pt.device_id) filter (where pt.is_active) = 1
      then 'PASS_ONE_ACTIVE_ONE_DEVICE'
    when count(*) filter (where pt.is_active) = 0
      then 'REVIEW_ZERO_ACTIVE_TOKENS'
    else 'REVIEW_MULTIPLE_ACTIVE_TOKENS'
  end as token_gate
from public.push_tokens pt
where pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid;
```

```sql
-- READ ONLY. OPTIONAL masked listing (only if you must eyeball the device). NEVER exposes token entropy:
-- split_part(...,'[',1) yields only the scheme (ExponentPushToken / ExpoPushToken); the '[***]' hides the value.
-- Do NOT remove the masking and do NOT select the raw column.
select
  pt.id                                              as push_token_id,
  pt.platform,
  pt.device_id,
  pt.is_active,
  split_part(pt.expo_push_token, '[', 1) || '[***]'  as token_scheme_masked,
  length(pt.expo_push_token)                         as token_len,
  pt.last_seen_at
from public.push_tokens pt
where pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid
order by pt.is_active desc, pt.last_seen_at desc;
```

**Interpretation:**

- **PASS** = `token_gate = 'PASS_ONE_ACTIVE_ONE_DEVICE'` (exactly one active token, one distinct active
  device). This is the only state that yields exactly one push.
- **REVIEW / STOP** = `REVIEW_ZERO_ACTIVE_TOKENS` (fan-out will skip `no_active_token`, no push -> nothing to
  observe) or `REVIEW_MULTIPLE_ACTIVE_TOKENS` (fan-out materializes one delivery per active token -> multiple
  pushes; only proceed if that is intentional). Resolve to a single active token before running.
- **Note (quiet hours):** if the owner has quiet hours enabled, the outbox / delivery can be deferred instead
  of sent now. This pack assumes the default (disabled). Section 9 surfaces any deferral via the outbox
  `available_at`.

---

## 4. Global pending-outbox precheck (SELECT-only)

**Do not run until approved.** The processor is **database-wide** (`fanout_due_notifications` /
`claim_push_deliveries` scan all circles), so before the positive test there must be **no unexpected pending
outbox rows**. The one known old invalid row is **expected** and marked `EXPECTED_OLD_INVALID`.

```sql
-- READ ONLY. 2F-8C precheck. Enumerate EVERY pending outbox row database-wide with its source context.
select
  o.id                as outbox_id,
  o.notification_id,
  n.type::text        as notif_type,
  o.user_id,
  n.circle_id,
  n.data ->> 'entity' as data_entity,
  n.data ->> 'itemId' as data_item_id,
  o.status::text      as outbox_status,
  o.available_at,
  (o.available_at <= now()) as due_now,
  o.attempt_count,
  o.last_error,
  n.created_at        as notif_created_at,
  n.expires_at        as notif_expires_at,
  case
    when o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid then 'EXPECTED_OLD_INVALID'
    else 'REVIEW_UNEXPECTED_PENDING'
  end as row_class
from public.notification_outbox o
join public.notifications n on n.id = o.notification_id
where o.status = 'pending'
order by o.available_at asc;
```

```sql
-- READ ONLY. Gate aggregate: the ONLY pending row before the positive test must be the known old invalid one.
select
  count(*)                                                                                   as pending_total,
  count(*) filter (where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid)   as pending_expected_old_invalid,
  count(*) filter (where o.notification_id <> '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid)  as pending_unexpected,
  case
    when count(*) filter (where o.notification_id <> '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid) = 0
      then 'PASS_NO_UNEXPECTED_PENDING'
    else 'STOP_UNEXPECTED_PENDING_ROWS'
  end as pending_gate
from public.notification_outbox o
where o.status = 'pending';
```

**Interpretation:**

- **PASS** (run this BEFORE creating the fixture / running the producer) = `pending_total = 1`,
  `pending_expected_old_invalid = 1`, `pending_unexpected = 0`, `pending_gate = 'PASS_NO_UNEXPECTED_PENDING'`.
- **STOP** on any `REVIEW_UNEXPECTED_PENDING` row - the processor would co-process it. Document it before
  proceeding.
- **Note on the old invalid row (intentional, not cleared here):** this pack does **not** require clearing
  `5ba7fb2d-...` first. When the processor runs (Section 10) it will co-process that row and skip it (terminal
  `skipped`, `last_error = 'expired'` or `'task_closed'`, no delivery, no push) - a harmless bonus that also
  exercises the skip path. If the team instead wants a perfectly isolated positive run, retire it first under
  a separately approved `2F-8B` skip-path run; that is optional and **out of scope** for this pack.

---

## 5. Fresh fixture creation - through the app UI (NO SQL mutation)

**Operator action (app UI only; no SQL insert/update).** Create the positive fixture as a normal task so
every RLS, trigger, and assignment guard runs exactly as in production:

1. **Sign in on the test device** as a circle **manager** (`admin` / `primary_caregiver`) of the QA circle
   `ae4721d8-...`. (If the owner user `a6dc7376-...` is themselves a manager, they may create it directly;
   otherwise a manager creates it and assigns it to the owner - a task assignee must be an active member of
   the circle.)
2. **Create a new QA task** in the QA circle with:
   - **Title:** `[QA PUSH] اختبار إشعار حقيقي`
   - **Assigned to / responsible:** the owner user `a6dc7376-fd9d-461f-9d14-41eabcd3f538` (task_due resolves
     to the assignee only; an unassigned task resolves to NOBODY and produces no notification).
   - **Status:** open (default for a new task).
   - **Due date:** today.
   - **Due time:** **~8-12 minutes in the future**, measured on the **circle-local clock** (circle timezone;
     UTC+3 per 2F-7H - confirm with the `circle_tz` column in Section 6). The producer's task-due window is
     `[now, now + 20 min]` (`taskLookaheadMinutes = 20`), so 8-12 minutes ahead is comfortably in-window with
     slack to run the producer before the due instant passes.
3. **Keep the app open / logged in** on the test device with **notification permission enabled** and the push
   token registered (Section 3 must show one active token for the owner).

**Timing caveat (critical):** a task-due notification is created only while `due_at` is in
`[now, now + 20 min]`. Once `due_at` is in the **past**, `enqueue-due-reminders` no longer produces `task_due`
for it, and `task_overdue` does **not** fire until `due_at <= now - 60 min` - so between the due instant and
+60 min the task is in a **dead zone** that produces nothing. Therefore: run the producer **promptly**, and
re-confirm `in_task_due_window_now = true` (Section 6) **immediately before** invoking. If the window is
missed, a manager can **edit the task's due time forward** (app UI) to re-enter the window rather than waiting
for overdue.

---

## 6. Fresh-task discovery (SELECT-only)

**Run after creating the task, before the producer.** Finds the `[QA PUSH]` task and computes its producer
window using the **circle** timezone (matching `wallTimeToInstant` in the producer: `date + time` interpreted
in the circle zone).

```sql
-- READ ONLY. Locate the freshly created [QA PUSH] task and evaluate the task_due window now.
select
  t.id,
  t.title,
  t.status::text as status,
  t.assigned_to,
  (t.assigned_to = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid) as assigned_to_owner,
  t.due_date,
  t.due_time,
  cc.timezone as circle_tz,
  ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) as due_at_utc,
  (
    ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) >= now()
    and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) <= now() + interval '20 minutes'
  ) as in_task_due_window_now,
  t.created_at
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
where t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
  and t.title like '[QA PUSH]%'
  and t.status = 'open'
order by t.created_at desc;
```

```sql
-- READ ONLY. OPTIONAL - expected recipient count by the resolver (service_role function; runs as owner in the
-- Dashboard SQL editor). Expect exactly 1 recipient = the owner. If "permission denied for function", STOP and
-- rely on the structural gate (Section 7) + the producer response (task=1). Do NOT escalate roles.
select
  count(*) as resolved_recipients,
  bool_or(r.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid) as owner_is_recipient
from public.care_tasks t
cross join lateral public.notification_recipients_for_item_event(
  t.circle_id, 'task_due'::public.notification_type, 'task', t.id
) r
where t.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
  and t.title like '[QA PUSH]%'
  and t.status = 'open';
```

**Interpretation / capture:** record the single returned `id` as `<FRESH_TASK_ID>` (used in Sections 9 and
11). Expected: `status = 'open'`, `assigned_to_owner = true`, `in_task_due_window_now = true`,
`resolved_recipients = 1`, `owner_is_recipient = true`. If more than one `[QA PUSH]` row returns, you created
duplicates - retire the extras (app UI) so exactly one open fixture remains.

---

## 7. Producer eligibility gate (SELECT-only)

**Run immediately before the producer.** Proves that `enqueue-due-reminders` will create **exactly one** fresh
`task_due` notification (the fixture) and nothing else. The task producers scan **all circles**, so these
gates are DB-wide. The medication / appointment / visit producers use per-source windows (candidate-day
resolution, lead-time arrays) that are impractical to reproduce exactly in one SQL block; the authoritative
guarantees for those are (a) the **producer response counters** (`medication=0`, `taskOverdue=0`,
`appointment=0`, `visit=0`) and (b) the **`created_at` scan** in Section 9. The strongest feasible per-source
gates and an informational scan are below, with those caveats stated explicitly.

**7.1 - task_due window, DB-wide (strong gate):**

```sql
-- READ ONLY. Reproduces enqueueTaskDue's window (status='open', due_date not null, due_at in [now, now+20m]).
-- Assert EXACTLY ONE in-window open task DB-wide, and it is the fresh [QA PUSH] task in the QA circle.
with due_tasks as (
  select t.id, t.title, t.circle_id, t.assigned_to,
         ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) as due_at
  from public.care_tasks t
  join public.care_circles cc on cc.id = t.circle_id
  where t.status = 'open' and t.due_date is not null
),
in_window as (
  select * from due_tasks
  where due_at >= now() and due_at <= now() + interval '20 minutes'
)
select
  (select count(*) from in_window)                                                    as task_due_in_window_total,
  (select count(*) from in_window
    where title like '[QA PUSH]%'
      and circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid)                    as task_due_in_window_fresh_qa,
  case
    when (select count(*) from in_window) = 1
     and (select count(*) from in_window
           where title like '[QA PUSH]%'
             and circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) = 1
      then 'PASS_EXACTLY_ONE_FRESH_VALID_TARGET'
    else 'REVIEW_TASK_DUE_WINDOW'
  end as task_due_gate;
```

**7.2 - task_overdue window, DB-wide (must be empty of our fixture):**

```sql
-- READ ONLY. Reproduces enqueueTaskOverdue's window (due_at in [now-24h, now-60m]). The fresh task is in the
-- FUTURE, so it must NOT appear here. Expect zero overdue candidates (or review any that surface).
with od as (
  select t.id, t.title, t.circle_id,
         ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) as due_at
  from public.care_tasks t
  join public.care_circles cc on cc.id = t.circle_id
  where t.status = 'open' and t.due_date is not null
)
select
  count(*) filter (where od.due_at <= now() - interval '60 minutes'
                     and od.due_at >= now() - interval '24 hours') as task_overdue_in_window_total,
  case
    when count(*) filter (where od.due_at <= now() - interval '60 minutes'
                            and od.due_at >= now() - interval '24 hours') = 0
      then 'PASS_NO_OVERDUE'
    else 'REVIEW_OVERDUE_CANDIDATES'
  end as task_overdue_gate
from od;
```

**7.3 - old completed task is inert:**

```sql
-- READ ONLY. The old completed task must be closed (status<>'open' excludes it from every producer scan).
select t.id, t.title, t.status::text as status, (t.status = 'open') as producer_eligible
from public.care_tasks t
where t.id = '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid;
-- Expected: status='completed', producer_eligible=false.
```

**7.4 - owner is an operational recipient; no remote_member targeted:**

```sql
-- READ ONLY. Owner holds an OPERATIONAL role (not remote_member / elder) so task_due resolves to them.
select cm.user_id, cm.role::text as role, cm.status::text as membership_status,
       (cm.status = 'active'
        and cm.role in ('admin','primary_caregiver','family_member','caregiver')) as operational_owner
from public.circle_members cm
where cm.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
  and cm.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid;
-- Expected: operational_owner = true. (The resolver already excludes remote_member for task_due; this confirms
-- the owner is not a remote/elder role that would resolve to nobody.)
```

**7.5 - informational scan of other producer sources (approximate; NOT a full window reproduction):**

```sql
-- READ ONLY. Broad, APPROXIMATE counts of other producer sources so you can eyeball anything that could be in a
-- window. These are NOT exact reproductions of the medication candidate-day / appointment-lead / visit-lead
-- logic. Authoritative gates: the producer response (medication=0, appointment=0, visit=0, taskOverdue=0) and
-- the Section 9 created_at scan (exactly one new notification).
select 'active_med_schedules'      as source, count(*) as rows
  from public.medication_schedules ms
  join public.medications m on m.id = ms.medication_id
  where ms.is_active and m.is_active
union all
select 'scheduled_appts_next_25h', count(*)
  from public.care_appointments a
  where a.status = 'scheduled' and a.starts_at between now() and now() + interval '25 hours'
union all
select 'planned_visits_with_date', count(*)
  from public.family_visits v
  where v.status = 'planned' and v.visit_date is not null;
```

**Interpretation:** the pack's producer-gate status is **`PASS_EXACTLY_ONE_FRESH_VALID_TARGET`** only when
7.1 = `PASS_EXACTLY_ONE_FRESH_VALID_TARGET`, 7.2 = `PASS_NO_OVERDUE`, 7.3 shows the old task closed, and 7.4
shows `operational_owner = true`. 7.5 is informational: if any counted source looks like it could fire, treat
it as **REVIEW** and lean on the producer response + Section 9 scan as the final arbiter. **STOP** on any
non-PASS.

---

## 8. Future producer invocation command

**`DO NOT RUN UNTIL PRECHECKS PASS AND USER EXPLICITLY APPROVES`**

Authored for a future, explicitly approved `2F-8C` producer step only. Calls **only** `enqueue-due-reminders`,
**once**; reads `NOTIFICATIONS_CRON_SECRET` with `Read-Host -AsSecureString`; **never echoes** the secret (it
is marshalled straight into the header and zeroed in `finally`); prints the invocation timestamp first (used by
the Section 9 post-checks). `verify_jwt = false` for this function, so the `x-cron-secret` header is the only
credential; no Supabase JWT is required.

```powershell
# DO NOT RUN UNTIL PRECHECKS PASS AND USER EXPLICITLY APPROVES (2F-8C producer step).
# Calls ONLY enqueue-due-reminders, once. Re-run the Section 3/4/6/7 prechecks FIRST and confirm
# in_task_due_window_now = true. The secret is read hidden and never echoed.
$ref = 'qccgshanmoeybagxwvcs'
$uri = "https://$ref.supabase.co/functions/v1/enqueue-due-reminders"

# Stamp the invocation moment (UTC ISO-8601) BEFORE calling, for the Section 9 post-checks (created_at > this).
$invokedAt = (Get-Date).ToUniversalTime().ToString('o')
Write-Host "producer invoked_at (UTC): $invokedAt"

$sec  = Read-Host -Prompt 'Paste NOTIFICATIONS_CRON_SECRET (input hidden; never echoed)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
  $header = @{ 'x-cron-secret' = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  $resp   = Invoke-RestMethod -Method Post -Uri $uri -Headers $header -Body '{}' -ContentType 'application/json'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable header -ErrorAction SilentlyContinue
}
# Expected: ok=true, task=1, medication=0, taskOverdue=0, appointment=0, visit=0.
$resp | ConvertTo-Json -Depth 6
```

**Expected response:** `{ "ok": true, "medication": 0, "task": 1, "taskOverdue": 0, "appointment": 0,
"visit": 0 }`. **Any other shape is a STOP** (Section 13): `task <> 1` or any other counter `> 0` means an
unintended source fired - do not proceed to the processor.

---

## 9. Post-producer SQL checks (SELECT-only)

**Run after the producer, before the processor.** Substitute the producer `invoked_at` (UTC, printed by the
Section 8 command) for `<PRODUCER_INVOKED_AT_UTC>` and the fixture id (Section 6) for `<FRESH_TASK_ID>`.

```sql
-- READ ONLY. All notifications created since the producer invocation (expect exactly one: the fresh task_due).
select n.id, n.type::text as type, n.user_id, n.circle_id,
       n.data ->> 'entity' as data_entity, n.data ->> 'itemId' as data_item_id,
       n.dedupe_key, n.created_at, n.expires_at
from public.notifications n
where n.created_at > '<PRODUCER_INVOKED_AT_UTC>'::timestamptz
order by n.created_at asc;
-- Expected: exactly one row, type='task_due', user_id=owner, data_item_id=<FRESH_TASK_ID>.
```

```sql
-- READ ONLY. Focused confirmation: the new notification is task_due for the owner, points at the fresh task,
-- has exactly one PENDING outbox row (not yet deferred / processed), and zero deliveries so far.
select
  n.id as notification_id, n.type::text as type, n.user_id,
  (n.type = 'task_due')                                              as is_task_due,
  (n.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid)          as user_is_owner,
  (n.data ->> 'itemId')                                              as data_item_id,
  ((n.data ->> 'itemId') = '<FRESH_TASK_ID>')                        as item_is_fresh_task,
  o.id as outbox_id, o.status::text as outbox_status,
  o.available_at, (o.available_at <= now())                          as outbox_due_now,
  (select count(*) from public.notification_push_deliveries d where d.outbox_id = o.id) as delivery_rows
from public.notifications n
join public.notification_outbox o on o.notification_id = n.id
where n.type = 'task_due'
  and n.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid
  and (n.data ->> 'itemId') = '<FRESH_TASK_ID>';
-- Expected: is_task_due=true, user_is_owner=true, item_is_fresh_task=true, outbox_status='pending',
-- outbox_due_now=true (if false, quiet hours deferred it - resolve before the processor), delivery_rows=0.
```

```sql
-- READ ONLY. The old invalid row must still be untouched (pending) - the producer never mutates existing outbox rows.
select o.id as outbox_id, o.status::text as outbox_status, o.last_error
from public.notification_outbox o
where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid;
-- Expected: outbox_status='pending', last_error=null (it will be co-processed -> skipped only in Section 10/11).
```

```sql
-- READ ONLY. No deliveries exist anywhere yet (the processor has not run).
select count(*) as delivery_rows_total from public.notification_push_deliveries;
-- Expected: 0. If > 0, a prior processor run created rows - investigate before proceeding.
```

**STOP** if the created-notification count is not exactly one, the fresh row is not `task_due` for the owner
pointing at `<FRESH_TASK_ID>`, its outbox is not a single `pending` row, `outbox_due_now = false` (quiet-hours
deferral), the old invalid row already changed status, or any delivery row exists.

---

## 10. Future outbox processor invocation command

**`DO NOT RUN UNTIL POST-PRODUCER CHECKS PASS AND USER EXPLICITLY APPROVES`**

Authored for a future, explicitly approved `2F-8C` processor step only. Calls **only**
`process-notification-outbox`, **once**; reads `NOTIFICATIONS_CRON_SECRET` with `Read-Host -AsSecureString`;
**never echoes** the secret. This invocation **sends a real Expo push** for the fresh valid row. It is
database-wide: it will also co-process the old invalid row and skip it (no push). No cron.

```powershell
# DO NOT RUN UNTIL POST-PRODUCER CHECKS PASS AND USER EXPLICITLY APPROVES (2F-8C processor step).
# Calls ONLY process-notification-outbox, once. Sends a REAL push for the fresh valid row. The secret is read
# hidden and never echoed. Re-run the Section 9 post-producer checks FIRST.
$ref = 'qccgshanmoeybagxwvcs'
$uri = "https://$ref.supabase.co/functions/v1/process-notification-outbox"
$sec  = Read-Host -Prompt 'Paste NOTIFICATIONS_CRON_SECRET (input hidden; never echoed)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
  $header = @{ 'x-cron-secret' = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  $resp   = Invoke-RestMethod -Method Post -Uri $uri -Headers $header -Body '{}' -ContentType 'application/json'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable header -ErrorAction SilentlyContinue
}
# Expected: ok=true; fanout.fanned=1 (fresh valid), fanout.skipped=1 (old invalid 5ba7fb2d), fanout.deferred=0;
# claimed=1; sent=1; failed=0; skipped=0; stale=0; recordErrors=0; invalidTokens=0.
$resp | ConvertTo-Json -Depth 6
```

**Expected response:** `ok=true`; `fanout = { fanned: 1, skipped: 1, deferred: 0 }` (the **fresh** row is
fanned; the **old invalid** row is the `skipped` one); `claimed = 1`; `sent = 1`; `failed = 0`; top-level
`skipped = 0`, `stale = 0`, `recordErrors = 0`, `invalidTokens = 0`. If the old invalid row was already
retired separately, `fanout.skipped` will be `0` instead - still acceptable. **STOP** on `sent <> 1`,
`failed > 0`, `stale > 0`, `recordErrors > 0`, or `invalidTokens > 0`.

---

## 11. Post-processor SQL checks (SELECT-only)

**Run after the processor.** Substitute `<FRESH_TASK_ID>` (Section 6) and `<PRODUCER_INVOKED_AT_UTC>`
(Section 8).

```sql
-- READ ONLY. Fresh notification: outbox 'fanned', exactly one delivery, delivery 'sent'. The token is NEVER
-- selected here - only push_token_id (an internal uuid) appears.
select
  n.id as notification_id, o.id as outbox_id, o.status::text as outbox_status, o.last_error,
  d.id as delivery_id, d.status::text as delivery_status,
  d.push_token_id, d.attempt_count, d.sent_at, d.expo_ticket_id, d.receipt_status,
  d.last_error as delivery_error
from public.notifications n
join public.notification_outbox o on o.notification_id = n.id
left join public.notification_push_deliveries d on d.outbox_id = o.id
where n.type = 'task_due'
  and n.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid
  and (n.data ->> 'itemId') = '<FRESH_TASK_ID>';
-- Expected: outbox_status='fanned' (the outbox never becomes 'sent' - delivery truth lives in the delivery row);
-- exactly ONE delivery row; delivery_status='sent'; expo_ticket_id not null; receipt_status null (receipts are
-- polled later by check-push-receipts, out of scope here).
```

```sql
-- READ ONLY. Exactly one delivery for the fresh notification, mapping to the owner's single active token,
-- WITHOUT exposing the token (masked to its scheme only).
select
  d.id as delivery_id, d.status::text as delivery_status, d.push_token_id, pt.is_active,
  (pt.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid)  as token_owned_by_owner,
  split_part(pt.expo_push_token, '[', 1) || '[***]'            as token_scheme_masked
from public.notification_push_deliveries d
join public.notification_outbox o  on o.id = d.outbox_id
join public.notifications n        on n.id = o.notification_id
join public.push_tokens pt         on pt.id = d.push_token_id
where n.type = 'task_due'
  and (n.data ->> 'itemId') = '<FRESH_TASK_ID>';
-- Expected: exactly one row, delivery_status='sent', is_active=true, token_owned_by_owner=true.
```

```sql
-- READ ONLY. Old invalid row is co-processed database-wide -> terminal 'skipped', no delivery, no push.
select o.id as outbox_id, o.status::text as outbox_status, o.last_error,
       (select count(*) from public.notification_push_deliveries d where d.outbox_id = o.id) as delivery_rows
from public.notification_outbox o
where o.notification_id = '5ba7fb2d-cd29-470a-b2fe-f41df75051fc'::uuid;
-- Expected: outbox_status='skipped'; last_error='expired' (past its 6h expiry) OR 'task_closed'; delivery_rows=0.
```

```sql
-- READ ONLY. No notifications were created outside the QA circle by this run.
select count(*) as new_outside_qa
from public.notifications n
where n.created_at > '<PRODUCER_INVOKED_AT_UTC>'::timestamptz
  and n.circle_id is distinct from 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid;
-- Expected: 0.
```

```sql
-- READ ONLY. No duplicate: exactly one task_due notification for the fresh task (dedupe on (user_id,dedupe_key) held).
select count(*) as fresh_task_due_notifs
from public.notifications n
where n.type = 'task_due'
  and n.user_id = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid
  and (n.data ->> 'itemId') = '<FRESH_TASK_ID>';
-- Expected: 1.
```

**Interpretation:** PASS = fresh outbox `fanned`; exactly one delivery row `sent` with a non-null
`expo_ticket_id`, owned by the owner's active token (masked); old invalid row terminal `skipped` with zero
deliveries; `new_outside_qa = 0`; `fresh_task_due_notifs = 1`; token never exposed (only ids / masked scheme).

---

## 12. Manual device observation checklist

On the physical test device, confirm:

- [ ] **A real push notification is received** on the device (lock screen / notification tray).
- [ ] **Title / body are the generic copy only** - title `سند`, body `لديك تذكير جديد` (no medication name,
      task title, vital, note, or recipient name in the remote payload).
- [ ] **Tapping the push opens the app** (and follows the `deepLink` route `/tasks/<FRESH_TASK_ID>` if deep
      linking is wired for this build).
- [ ] **The in-app notification center shows the fresh task notification** (the authenticated inbox row may
      carry the task-specific title `تذكير بمهمة` / body).
- [ ] **No health or private detail appears in the push body** - the remote payload stays generic; any detail
      is only visible in-app after authentication.

---

## 13. Stop conditions (hard stops)

Halt immediately and report if any occur:

- **Zero active push tokens** for the owner (Section 3 -> `REVIEW_ZERO_ACTIVE_TOKENS`; fan-out would skip
  `no_active_token`, no push).
- **Multiple active tokens / devices** for the owner when not intentional (Section 3 ->
  `REVIEW_MULTIPLE_ACTIVE_TOKENS`; would send multiple pushes).
- **Any unexpected pending outbox row** database-wide (Section 4 -> `STOP_UNEXPECTED_PENDING_ROWS`).
- **Any real (non-QA) family data** appears in a pending outbox row or in a produced notification.
- **Producer eligibility not exactly one fresh valid target** (Section 7.1 not
  `PASS_EXACTLY_ONE_FRESH_VALID_TARGET`, or 7.2 overdue candidates, or 7.3/7.4 unexpected).
- **Producer response not `task=1` with all other counters `0`** (Section 8).
- **Post-producer checks fail** (Section 9): not exactly one new notification, wrong type/recipient/item, not a
  single `pending` outbox row, `outbox_due_now=false` (quiet-hours deferral), old invalid row already changed,
  or any delivery already exists.
- **Processor response unexpected** (Section 10): `sent <> 1`, `failed > 0`, `stale > 0`, `recordErrors > 0`,
  or `invalidTokens > 0`.
- **Any push delivered to the wrong device / user.**
- **Any secret pasted** (e.g. `NOTIFICATIONS_CRON_SECRET`) into a report, log, or chat.
- **Cron enabled** or any schedule created.
- **Wrong project** (anything other than Sanad `qccgshanmoeybagxwvcs`).

---

## 14. Validation for this pack

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`

Results are recorded in Section 16's hand-off. No other command is run in this phase.

---

## 15. Final confirmation

- **Report / pack created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run** (all SQL is authored for later, separately approved manual use; no `INSERT` / `UPDATE` /
  `DELETE` appears anywhere in this pack).
- **No DB connection.**
- **No deploy.**
- **No Edge invocation** (both PowerShell commands are marked `DO NOT RUN` and were not executed).
- **No cron enabled / created.**
- **No outbox processing** (no fan-out, no claim/send performed).
- **No push sent.**
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only; no
  value read or requested; all UUIDs are user / circle / task / notification identifiers, not secrets; no raw
  Expo push token value appears - listings are masked to the scheme prefix only).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 16. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report/pack file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-06-phase-2f-8c-positive-push-execution-pack.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
