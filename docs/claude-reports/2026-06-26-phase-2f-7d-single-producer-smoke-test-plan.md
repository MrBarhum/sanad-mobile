# Phase 2F-7D - Single-producer notification smoke-test execution plan / QA fixture-shaping plan (design only)

**Status:** Design-only plan. **Nothing was executed.** Claude ran no Supabase CLI, no SQL, made no DB
connection, invoked no Edge Function, created/updated no data, enabled no cron, processed no outbox, and
sent no push. The only filesystem write in this phase is this report; the only commands run are the two
local read-only checks in Section 13. Every SQL block below is **authored for later manual use** and is
marked read-only / future / not-executed.

**Baseline (pushed) commit:** `63db5b8 docs(product): record resolver verification results`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Chosen first target:** assigned open task `مشي سريع`, item_id
`23bff3fa-130d-4e29-96ec-80bac0647060`, owner `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.
**Sources inspected read-only:** 2F-7C / 2F-7B / 2F-7A / 2F-6E / 2F-6C reports;
`enqueue-due-reminders/index.ts`, `_shared/config.ts`, `_shared/enqueue.ts`, `_shared/time.ts`,
`_shared/auth.ts`; migrations `20260626164000` (resolvers), `20260611120100` (`enqueue_notification`),
`20260611120000` (notification tables), and the item-table / schedule migrations for column types.

---

## 1. Executive summary

- **This is a design-only execution plan.** No SQL was run, no Edge Function invoked, no cron / outbox /
  push occurred.
- **Resolver verification passed in 2F-7C** (owner-only targeting, remote exclusion, unassigned-task ->
  nobody, manager fallback, awareness, claim_digest), on this QA circle.
- **The first producer path is assigned `task_due` via `enqueue-due-reminders`**, targeting the one
  assigned task and its single owner.
- **The smoke test must not run until QA data is shaped so exactly one eligible item exists across ALL
  producer scans, DATABASE-WIDE.** One invocation of `enqueue-due-reminders` runs five scans across the
  whole **database (every circle on the project)**, not just the QA circle (Section 3); "exactly one
  notification" is a **database-wide** property, verified by the database-wide eligibility gate (Section 6
  Block P6) and confirmed by the invocation's global response counters (Section 8), not by the invocation
  itself.
- **Nothing in this phase mutates data.** Fixture shaping and invocation are future phases requiring
  separate approval (Sections 7-8, 12).

---

## 2. Why assigned `task_due` is the first path

- **An assigned task resolves exactly one owner** - proven in 2F-7C (Block 4: `assigned_task_due` ->
  `a6dc7376-fd9d-461f-9d14-41eabcd3f538`, exactly one recipient).
- **No manager fallback for assigned tasks** - the resolver's task branch is owner-only; an unassigned
  task resolves to nobody (2F-7C Block 5). So the assigned-task path cannot fan out to managers.
- **Unassigned tasks resolve nobody** - a mistake in shaping (clearing the assignee) fails safe to zero
  recipients rather than a broad send.
- **Lower risk than the alternatives:** no medication dose-log / schedule-occurrence complexity, no
  multi-lead multiplier (appointments fire per lead in `[24h, 60m]`), and no visit trigger-window math.
- **The app can render it:** `task_due` maps to deep link `/tasks/<task.id>` (2F-5B), so the created row
  is inspectable in the notification center.
- **Chosen task:** `23bff3fa-130d-4e29-96ec-80bac0647060` (`مشي سريع`).
- **Expected recipient:** `a6dc7376-fd9d-461f-9d14-41eabcd3f538` (the assigned doer).

---

## 3. Critical producer behavior (from `enqueue-due-reminders/index.ts`)

- **One invocation runs ALL producer scans - not only `task_due` - and the scans are DATABASE-WIDE (every
  circle).** The handler (after `authorizeScheduledRequest`) runs them sequentially, keyed off a single
  `now = new Date()`. **None of the five scans filters by `circle_id`** - each queries all rows in its
  table (bounded only by `is_active` / `status` / `due_date` / `starts_at` filters and the 2000-row cap)
  and resolves recipients per item using that item's own `circle_id`:
  1. `enqueueMedicationDue` -> `medication_due`
  2. `enqueueTaskDue` -> `task_due`
  3. `enqueueTaskOverdue` -> `task_overdue`
  4. `enqueueAppointmentUpcoming` -> `appointment_upcoming`
  5. `enqueueVisitUpcoming` -> `visit_upcoming`
- **Notification types this function can create:** `medication_due`, `task_due`, `task_overdue`,
  `appointment_upcoming`, `visit_upcoming`. It does **not** create `medication_missed` (that is
  `check-missed-doses`) and does **not** create `item_*` / `claim_digest` (no producer exists for those).
- **Recipients are resolved per item** via `recipientsForItem(...)` ->
  `notification_recipients_for_item_event(circle, type, entity, itemId)`, and one notification is created
  **per (item-occurrence, resolved recipient)**. An item resolving to N recipients yields up to N
  notifications; appointments additionally loop over both lead times.
- **Why fixture shaping must make exactly one item eligible across all scans (database-wide):** because
  one invocation scans medications, tasks (due + overdue), appointments and visits across the **entire
  database**, any *other* eligible item - in the QA circle **or any other circle on the project** - that
  falls in its window would also create a notification (+ pending outbox row). The overdue scan is the
  widest risk: its window is roughly `[now - 24h, now - 60m]` (Section 4), so any open dated task overdue
  within the last day, in any circle, would fire. This is why the authoritative gate (Section 6 Block P6)
  and the post-invocation guard (Section 9 Block Q3) are database-wide, not QA-circle-only.
- **`enqueue-due-reminders` does not send push itself.** It only calls `enqueue_notification` (SECURITY
  DEFINER), which inserts the `notifications` inbox row and a `notification_outbox` row with
  `status = 'pending'` (un-fanned). It does not bundle the Expo transport (2F-6C). No lock screen push.
- **Outbox processing is separate and blocked.** Turning a pending outbox row into a per-device push is
  `process-notification-outbox` (`fanout_due_notifications` then `claim_push_deliveries`), which is a
  later, separately-approved step and **must not** run in the smoke test's first stage.

---

## 4. Config / window extraction (exact, from `_shared/config.ts` + producer)

All lookaheads are minutes; times are resolved to an absolute instant using the **care-circle timezone**
(`care_circles.timezone`, default `'UTC'`) via `wallTimeToInstant` (Postgres equivalent:
`(<date> + <time>) at time zone <circle tz>`). `now` is captured once per run.

| Config field | Value | Where used |
| --- | --- | --- |
| `medicationLookaheadMinutes` | `20` | medication_due: keep dose if `now <= doseAt <= now + 20m` |
| `taskLookaheadMinutes` | `20` | task_due: keep if `now <= dueAt <= now + 20m` |
| `taskOverdueGraceMinutes` | `60` | task_overdue: keep if `dueAt <= now - 60m` |
| `taskOverdueMaxAgeHours` | `24` | task_overdue: keep if `dueAt >= now - 24h` (also expiry base) |
| `appointmentLeadMinutes` | `[1440, 60]` (24h, 60m) | appointment: a lead fires if `starts_at ∈ [now+lead, now+20m+lead]`; each lead dedupes alone |
| `appointmentLookaheadMinutes` | `20` | appointment window width |
| `visitLeadMinutes` | `60` | visit: fire if `(startAt - 60m) ∈ [now, now+20m]` |
| `visitLookaheadMinutes` | `20` | visit window width |
| `visitDateOnlyReminderHour` | `9` | date-only visit reminds at 09:00 circle-local |
| `taskReminderExpiryHours` | `6` | task_due `expires_at = dueAt + 6h` |
| `missedDoseGraceMinutes` | `60` | medication_due `expires_at = doseAt + 60m` (also missed-dose owner tier) |
| `missedDoseMaxAgeMinutes` | `720` (12h) | check-missed-doses only (not this function) |
| `missedDoseManagerEscalationMinutes` | `120` | check-missed-doses only |
| `maxSchedulesPerRun` / `maxTasksPerRun` / `maxAppointmentsPerRun` / `maxVisitsPerRun` | `2000` each | per-scan row cap |

**Date-only defaults:** a task or visit with no time reminds at **09:00 circle-local**
(`{hour:9, minute:0}`); medication doses use the schedule's `times` array.

**Timezone / date behavior:** `medication_schedules.days_of_week` is `int[]` with `0=Sunday .. 6=Saturday`
(matches Postgres `extract(dow ...)`), `times` is `time[]`, `start_date`/`end_date` are dates. Candidate
days for medication are **today and tomorrow in circle-local time**. The wall-clock->instant conversion is
exact except inside a DST transition gap (accepted edge case) - a caveat that also applies to the SQL
approximation in Section 6.

**Cron secret requirement (from `_shared/auth.ts`):** every handler calls `authorizeScheduledRequest`,
which requires the shared secret **`NOTIFICATIONS_CRON_SECRET`** presented in the **`x-cron-secret`**
header (or as a `Bearer` token), compared length-constant, and **fails closed** (401) if the secret is
unset or wrong. **The secret value must never be revealed** in any report, log, or chat. It is
environment-driven (`Deno.env.get('NOTIFICATIONS_CRON_SECRET')`) - a function secret configured in the
Supabase Dashboard, not stored in the repo.

**Dedupe key patterns (exact):**

| Type | Dedupe key |
| --- | --- |
| `medication_due` | `med:<schedule.id>:<dose_date YYYY-MM-DD>:<time>` |
| `task_due` | `task:<task.id>:<due_date>:<due_time or 'none'>` |
| `task_overdue` | `task_overdue:<task.id>:<due_date>` |
| `appointment_upcoming` | `appt:<appt.id>:<starts_at ISO>:<lead>` |
| `visit_upcoming` | `visit:<visit.id>:<visit_date>:<start_time or 'none'>` |

Uniqueness is enforced by the `notifications (user_id, dedupe_key)` partial unique index;
`enqueue_notification` does `on conflict (user_id, dedupe_key) do nothing` (returns null) so a repeat run
creates no duplicate.

---

## 5. Eligibility risk model (unintended rows if invoked without shaping)

For each scan: what makes an item eligible, what the resolver would do, why it could create extra
notifications, and the preflight check that must pass before invocation.

- **`medication_due`** - Eligible: an active schedule of an active medication whose candidate-day weekday
  is in `days_of_week`, within `start_date..end_date`, with a `times[]` entry whose `doseAt ∈ [now,
  now+20m]`, and **no** `medication_logs` row for `(schedule_id, dose_date, scheduled_time)`. Resolver:
  responsible owner, else managers (unassigned). Extra rows: a QA medication with a schedule time landing
  in the next 20 minutes. Preflight: Section 6 Block P5 must show zero medication occurrences with
  `in_window` and non-empty recipients.
- **`task_due`** - Eligible: open task, `due_date` set, `dueAt ∈ [now, now+20m]`. Resolver: assigned owner
  only; unassigned -> nobody. Extra rows: another open task also due in the next 20 minutes. Preflight:
  Block P1 must show exactly the target task `in_task_due_window = true` and no other.
- **`task_overdue`** - Eligible: open task, `due_date` set, `dueAt ∈ [now-24h, now-60m]`. Resolver:
  assigned owner only; unassigned -> nobody. Extra rows (**widest window - highest risk**): any open,
  assigned, dated task overdue within the last day. Preflight: Block P2 must show zero overdue-eligible
  tasks with recipients (including that the **target** is not overdue-eligible).
- **`appointment_upcoming`** - Eligible: `status='scheduled'` and `starts_at ∈ [now+lead, now+20m+lead]`
  for a lead in `{24h, 60m}`. Resolver: assigned member, else managers (unassigned). Extra rows: a QA
  appointment ~24h or ~1h ahead; a single appointment can fire under **both** leads (two rows). Preflight:
  Block P3 must show zero appointment-lead combinations `in_window_for_lead` with recipients.
- **`visit_upcoming`** - Eligible: `status='planned'`, `visit_date` set, `(startAt - 60m) ∈ [now,
  now+20m]` (date-only -> 09:00 circle-local). Resolver: linked visitor, else managers (unlinked). Extra
  rows: a planned visit whose start is ~60-80 minutes ahead. Preflight: Block P4 must show zero visits
  `in_window` with recipients.

**Aggregate preflight gate:** Blocks P1-P5 are **QA-circle detail** (for shaping the QA circle). The
**authoritative** gate is Section 6 Block P6, which combines all five scans **database-wide (every
circle)** and must return `PASS_EXACTLY_ONE_TARGET_ELIGIBLE` (the target task, exactly one recipient; zero
other would-create occurrences anywhere) before any invocation. The invocation's global response counters
(Section 8) are the final confirmation that exactly one notification was created across the whole database.

---

## 6. Future manual read-only SQL: eligibility preview pack

**Do not run in 2F-7D.** These are `SELECT`-only blocks for the Supabase Dashboard SQL Editor at
execution time. They mirror the producer windows using the care-circle timezone. Because each block is a
single statement, the SQL Editor shows its full result set. **Blocks P1-P5 are QA-circle detail** (for
shaping the QA circle); **Block P6 is the DATABASE-WIDE authoritative go/no-go gate** - since the producer
scans every circle, the gate must too. The resolver functions are `service_role`-granted and owned by
`postgres`; the Dashboard SQL Editor runs as `postgres` (the owner) and can execute them - if you hit
`permission denied for function`, the editor is running as a lesser role: stop and report rather than
escalating. **Caveat (conservative approximation):** the `... at time zone <tz>` conversion matches the
Edge `wallTimeToInstant` except inside a DST transition gap; if a circle's zone is mid-DST-change, manually
review the raw candidate rows rather than trusting only the P6 summary.

### Block P0 - context (timezone + now + window)

```sql
-- READ ONLY. Eligibility preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select
  cc.id as circle_id,
  cc.name as circle_name,
  cc.timezone as circle_tz,
  now() as now_utc,
  (now() at time zone cc.timezone) as now_circle_local,
  now() + interval '20 minutes' as task_med_visit_window_end,
  '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id
from public.care_circles cc
where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid;
```

### Block P1 - task_due preview

```sql
-- READ ONLY. Eligibility preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with ctx as (
  select cc.id as circle_id, cc.timezone as tz, now() as now_ts,
         '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id
  from public.care_circles cc
  where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
)
select
  t.id as item_id, t.title, t.assigned_to as owner_id, t.due_date, t.due_time,
  ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone ctx.tz) as due_at,
  (((t.due_date + coalesce(t.due_time, time '09:00')) at time zone ctx.tz)
     between ctx.now_ts and ctx.now_ts + interval '20 minutes') as in_task_due_window,
  (t.id = ctx.target_task_id) as is_target,
  array(select r.user_id
        from public.notification_recipients_for_item_event(ctx.circle_id,'task_due'::public.notification_type,'task',t.id) r
        order by r.user_id) as expected_recipients
from public.care_tasks t cross join ctx
where t.circle_id = ctx.circle_id and t.status = 'open' and t.due_date is not null
order by is_target desc, due_at;
```

### Block P2 - task_overdue preview

```sql
-- READ ONLY. Eligibility preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with ctx as (
  select cc.id as circle_id, cc.timezone as tz, now() as now_ts,
         '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id
  from public.care_circles cc
  where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
)
select
  t.id as item_id, t.title, t.assigned_to as owner_id, t.due_date, t.due_time,
  ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone ctx.tz) as due_at,
  (((t.due_date + coalesce(t.due_time, time '09:00')) at time zone ctx.tz)
     between ctx.now_ts - interval '24 hours' and ctx.now_ts - interval '60 minutes') as in_task_overdue_window,
  (t.id = ctx.target_task_id) as is_target,
  array(select r.user_id
        from public.notification_recipients_for_item_event(ctx.circle_id,'task_overdue'::public.notification_type,'task',t.id) r
        order by r.user_id) as expected_recipients
from public.care_tasks t cross join ctx
where t.circle_id = ctx.circle_id and t.status = 'open' and t.due_date is not null
order by due_at;
```

### Block P3 - appointment_upcoming preview (both leads)

```sql
-- READ ONLY. Eligibility preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with ctx as (
  select cc.id as circle_id, cc.timezone as tz, now() as now_ts
  from public.care_circles cc
  where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
)
select
  a.id as item_id, a.title, a.assigned_to as owner_id, a.starts_at, lead.lead_min,
  (a.starts_at between ctx.now_ts + (lead.lead_min * interval '1 minute')
                   and ctx.now_ts + interval '20 minutes' + (lead.lead_min * interval '1 minute')) as in_window_for_lead,
  array(select r.user_id
        from public.notification_recipients_for_item_event(ctx.circle_id,'appointment_upcoming'::public.notification_type,'appointment',a.id) r
        order by r.user_id) as expected_recipients
from public.care_appointments a
cross join ctx
cross join (values (1440),(60)) as lead(lead_min)
where a.circle_id = ctx.circle_id and a.status = 'scheduled'
order by a.starts_at, lead.lead_min;
```

### Block P4 - visit_upcoming preview

```sql
-- READ ONLY. Eligibility preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with ctx as (
  select cc.id as circle_id, cc.timezone as tz, now() as now_ts
  from public.care_circles cc
  where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
)
select
  v.id as item_id, v.visitor_name, v.visitor_user_id as owner_id, v.visit_date, v.start_time,
  ((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone ctx.tz) as start_at,
  (((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone ctx.tz) - interval '60 minutes') as trigger_at,
  ((((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone ctx.tz) - interval '60 minutes')
     between ctx.now_ts and ctx.now_ts + interval '20 minutes') as in_window,
  array(select r.user_id
        from public.notification_recipients_for_item_event(ctx.circle_id,'visit_upcoming'::public.notification_type,'visit',v.id) r
        order by r.user_id) as expected_recipients
from public.family_visits v cross join ctx
where v.circle_id = ctx.circle_id and v.status = 'planned' and v.visit_date is not null
order by start_at;
```

### Block P5 - medication_due preview (conservative; expands today+tomorrow x times)

```sql
-- READ ONLY. Eligibility preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with ctx as (
  select cc.id as circle_id, cc.timezone as tz, now() as now_ts
  from public.care_circles cc
  where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
)
select
  s.id as schedule_id, s.medication_id, m.name as medication_name,
  cd.dose_date, tm.scheduled_time,
  ((cd.dose_date + tm.scheduled_time) at time zone ctx.tz) as dose_at,
  (extract(dow from cd.dose_date)::int = any(s.days_of_week)) as weekday_ok,
  (cd.dose_date >= s.start_date and (s.end_date is null or cd.dose_date <= s.end_date)) as in_date_range,
  (((cd.dose_date + tm.scheduled_time) at time zone ctx.tz)
     between ctx.now_ts and ctx.now_ts + interval '20 minutes') as in_window,
  (not exists (select 1 from public.medication_logs ml
               where ml.schedule_id = s.id and ml.dose_date = cd.dose_date and ml.scheduled_time = tm.scheduled_time)) as not_yet_logged,
  array(select r.user_id
        from public.notification_recipients_for_item_event(ctx.circle_id,'medication_due'::public.notification_type,'medication',s.medication_id) r
        order by r.user_id) as expected_recipients
from public.medication_schedules s
join public.medications m on m.id = s.medication_id and m.is_active
cross join ctx
cross join lateral (select (ctx.now_ts at time zone ctx.tz)::date + g.off as dose_date
                    from generate_series(0,1) as g(off)) cd
cross join lateral unnest(s.times) as tm(scheduled_time)
where s.circle_id = ctx.circle_id and s.is_active
order by dose_at;
```

A medication occurrence **would fire** only when `weekday_ok AND in_date_range AND in_window AND
not_yet_logged AND cardinality(expected_recipients) >= 1`.

### Block P6 - aggregate go/no-go summary (all five scans, DATABASE-WIDE - authoritative gate)

```sql
-- READ ONLY. Eligibility preview only (DATABASE-WIDE). Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- The producer scans EVERY circle, so this authoritative gate is NOT restricted to the QA circle: each
-- scan joins the item's own care_circles row for its timezone and resolves recipients with its circle_id.
with tgt as (
  select '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id
),
occ as (
  select 'task_due'::text as scan, 'task'::text as entity, t.id as item_id, t.circle_id,
         (t.id = (select target_task_id from tgt)) as is_target, 'task_due'::public.notification_type as ntype
  from public.care_tasks t
  join public.care_circles cc on cc.id = t.circle_id
  where t.status = 'open' and t.due_date is not null
    and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
          between now() and now() + interval '20 minutes'
  union all
  select 'task_overdue','task', t.id, t.circle_id, false, 'task_overdue'::public.notification_type
  from public.care_tasks t
  join public.care_circles cc on cc.id = t.circle_id
  where t.status = 'open' and t.due_date is not null
    and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
          between now() - interval '24 hours' and now() - interval '60 minutes'
  union all
  select 'appointment_upcoming','appointment', a.id, a.circle_id, false, 'appointment_upcoming'::public.notification_type
  from public.care_appointments a
  cross join (values (1440),(60)) as lead(lead_min)
  where a.status = 'scheduled'
    and a.starts_at between now() + (lead.lead_min * interval '1 minute')
                        and now() + interval '20 minutes' + (lead.lead_min * interval '1 minute')
  union all
  select 'visit_upcoming','visit', v.id, v.circle_id, false, 'visit_upcoming'::public.notification_type
  from public.family_visits v
  join public.care_circles cc on cc.id = v.circle_id
  where v.status = 'planned' and v.visit_date is not null
    and (((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone cc.timezone) - interval '60 minutes')
          between now() and now() + interval '20 minutes'
  union all
  select 'medication_due','medication', s.medication_id, s.circle_id, false, 'medication_due'::public.notification_type
  from public.medication_schedules s
  join public.medications m on m.id = s.medication_id and m.is_active
  join public.care_circles cc on cc.id = s.circle_id
  cross join lateral (select (now() at time zone cc.timezone)::date + g.off as dose_date
                      from generate_series(0,1) as g(off)) cd
  cross join lateral unnest(s.times) as tm(scheduled_time)
  where s.is_active
    and extract(dow from cd.dose_date)::int = any(s.days_of_week)
    and cd.dose_date >= s.start_date and (s.end_date is null or cd.dose_date <= s.end_date)
    and ((cd.dose_date + tm.scheduled_time) at time zone cc.timezone)
          between now() and now() + interval '20 minutes'
    and not exists (select 1 from public.medication_logs ml
                    where ml.schedule_id = s.id and ml.dose_date = cd.dose_date and ml.scheduled_time = tm.scheduled_time)
),
scored as (
  select o.is_target,
         (select count(*) from public.notification_recipients_for_item_event(
            o.circle_id, o.ntype, o.entity, o.item_id) r) as recipient_count
  from occ o
)
select
  coalesce(sum(case when is_target then recipient_count else 0 end), 0) as target_notifications,
  coalesce(sum(case when not is_target then recipient_count else 0 end), 0) as other_notifications_all_circles,
  coalesce(sum(recipient_count), 0) as total_notifications_if_invoked,
  case
    when coalesce(sum(case when is_target then recipient_count else 0 end),0) = 0 then 'FAIL_TARGET_NOT_ELIGIBLE'
    when coalesce(sum(case when not is_target then recipient_count else 0 end),0) > 0 then 'FAIL_EXTRA_ELIGIBLE_ITEMS'
    when coalesce(sum(case when is_target then recipient_count else 0 end),0) = 1
     and coalesce(sum(case when not is_target then recipient_count else 0 end),0) = 0
      then 'PASS_EXACTLY_ONE_TARGET_ELIGIBLE'
    else 'NEEDS_REVIEW'
  end as status
from scored;
```

**Interpretation:** proceed only on `PASS_EXACTLY_ONE_TARGET_ELIGIBLE` (`target_notifications = 1`,
`other_notifications_all_circles = 0`). `FAIL_TARGET_NOT_ELIGIBLE` -> shape the target into the window
(Section 7). `FAIL_EXTRA_ELIGIBLE_ITEMS` -> another item (in **any** circle) is in a window; move it out
or wait, and use Blocks P1-P5 to locate the QA-circle one. `NEEDS_REVIEW` -> an ambiguous case; inspect the
occurrences. Because this gate is database-wide, `other_notifications_all_circles` counts eligible items in
every circle on the project - which is exactly what the producer would create.

---

## 7. Future fixture-shaping strategy

**Design only. Do not execute. Do not mutate data in 2F-7D.** Goal: make exactly one notification
(`task_due` for the target) creatable, by placing the target task's due time inside the task_due window
and keeping every other item out of every window.

**Safest approach - shape via the app UI, signed in as a manager.**

> **Critical constraint (verified in `care_tasks` migration):** `care_tasks` has a `BEFORE UPDATE`
> trigger `care_tasks_collaborator_scope` that runs the function `enforce_care_task_collaborator_scope`.
> When `auth.uid()` is null - which is the case in the
> Supabase Dashboard SQL Editor - the trigger treats the actor as a non-manager collaborator and
> **rejects any content change** (including `due_date` / `due_time`) on an open task, raising
> `collaborators may only complete or cancel a task`. **Therefore a raw SQL `UPDATE` of the due date will
> fail in the SQL Editor.** The fixture must be changed through the **app UI while signed in as a manager
> (`admin` / `primary_caregiver`)**, whose JWT satisfies `has_circle_role` and takes the trigger's
> manager-exempt path. (The assigned owner `a6dc7376` is a doer and may only complete/cancel, not
> reschedule - a manager must perform the edit.)

**Steps (future, separate approval):**

1. **Compute the suggested due values (read-only).** Run this helper to get a circle-local date/time about
   10 minutes ahead (inside the `[now, now+20m]` task_due window):

   ```sql
   -- READ ONLY. Fixture-shaping helper (suggested values only). Do not modify data. Do not invoke Edge Functions. Do not enable cron.
   with ctx as (
     select cc.timezone as tz, now() as now_ts
     from public.care_circles cc
     where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
   )
   select
     ctx.tz as circle_tz,
     ((ctx.now_ts + interval '10 minutes') at time zone ctx.tz)::date as suggested_due_date,
     ((ctx.now_ts + interval '10 minutes') at time zone ctx.tz)::time(0) as suggested_due_time
   from ctx;
   ```

2. **Record old values first (read-only), for reversibility:**

   ```sql
   -- READ ONLY. Capture-before-change. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
   select id, title, status, assigned_to, due_date, due_time, updated_at
   from public.care_tasks
   where id = '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid
     and circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid;
   ```

3. **Edit in the app as a manager:** open the task `مشي سريع`, set its due date/time to the suggested
   values, keep it `open` and assigned to `a6dc7376`, save. Confirm no other QA item is due/overdue/near a
   window (re-run Section 6 P6 -> `PASS_EXACTLY_ONE_TARGET_ELIGIBLE`).
4. **Timing:** the task_due window is only 20 minutes wide and is evaluated at invocation. Shape ~10-15
   minutes ahead, re-run P6 immediately before invoking, and invoke promptly (Section 8).

### FUTURE MUTATION PLAN - DO NOT RUN IN 2F-7D

*This SQL is documented for completeness only. It is expected to be **blocked** by the collaborator-scope
trigger in the SQL Editor (see the constraint above), so the app-UI path is preferred. If a manager-auth
SQL context is ever used, this is the minimal, reversible change. Requires separate approval. QA circle
only. Do not run in this phase.*

```sql
-- FUTURE MUTATION PLAN — DO NOT RUN IN 2F-7D. Separate approval required. QA circle only.
-- Reversible: restore the due_date/due_time captured in Step 2 to undo. No row is deleted.
-- Expected to FAIL in the plain Dashboard SQL Editor (auth.uid() is null -> collaborator-scope trigger
-- rejects a content change). Prefer the app-UI manager edit in Step 3.
update public.care_tasks
set due_date = '<NEW_DUE_DATE>',   -- from suggested_due_date (Step 1)
    due_time = '<NEW_DUE_TIME>'    -- from suggested_due_time (Step 1)
where id = '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid
  and circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
  and status = 'open';
```

**Mutation policy:** QA circle only; alter only `due_date` / `due_time`; record old values first; never
delete rows; prefer reversible updates; never touch real family data; separate approval before any
mutation.

---

## 8. Future producer invocation plan

**Design only. Do not execute. Separate approval required.**

**Preconditions (all must hold immediately before invoking):**

- Resolver verification passed (2F-7C).
- Section 6 Block P6 returns `PASS_EXACTLY_ONE_TARGET_ELIGIBLE` (re-run right before invocation).
- Outbox baseline clean for the QA circle (2F-7C Block 10: 0 notifications / 0 outbox / 0 deliveries), or
  at least no unexpected pending outbox/delivery rows.
- No cron / schedule exists.
- Correct project: Sanad `qccgshanmoeybagxwvcs` (not ThinkMate or any other).
- The operator has the `NOTIFICATIONS_CRON_SECRET` available to send the `x-cron-secret` header - **never
  revealed** in any report/log/chat.

**Function:** `enqueue-due-reminders` (producer only; no push).

**Expected result:**

- Exactly **one** `task_due` notification created.
- Recipient `user_id`: `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.
- `data.entity`: `task`; `data.itemId`: `23bff3fa-130d-4e29-96ec-80bac0647060`.
- `deep_link`: `/tasks/23bff3fa-130d-4e29-96ec-80bac0647060`.
- `dedupe_key`: `task:23bff3fa-130d-4e29-96ec-80bac0647060:<due_date>:<due_time or 'none'>`.
- One `notification_outbox` row `status = 'pending'` (un-fanned); **zero** `notification_push_deliveries`.
- **No** `remote_member` (`4f89a6ab-...`) row.
- **No** manager-fallback row (assigned task is owner-only).
- **No** push sent.

**Explicitly do NOT (during this stage):**

- Do **not** run `process-notification-outbox` (the only push sender).
- Do **not** run `check-missed-doses`.
- Do **not** run `check-push-receipts`.
- Do **not** enable cron / create any schedule.

**Invocation skeleton (FUTURE / MANUAL - NOT FOR THIS PHASE; placeholder secret only):**

```bash
# FUTURE / MANUAL — not for 2F-7D. Placeholder secret; never paste the real value.
# curl -X POST "https://qccgshanmoeybagxwvcs.functions.supabase.co/enqueue-due-reminders" \
#   -H "x-cron-secret: <NOTIFICATIONS_CRON_SECRET>" \
#   -H "content-type: application/json" -d '{}'
```

Expected HTTP response body: `{"ok":true,"medication":0,"task":1,"taskOverdue":0,"appointment":0,"visit":0}`
(the `task` counter = 1, all others 0). **These counters are summed across the whole database (all
circles), so they are the authoritative confirmation that exactly one notification was created anywhere.**
Any non-`task` counter > 0, or `task` != 1, means an item elsewhere fired or shaping was wrong - stop and
inspect (Section 9 Block Q3).

---

## 9. Future post-invocation inspection SQL

**Do not run in 2F-7D. `SELECT`-only, for after a later approved invocation.** Blocks Q1-Q2 inspect the QA
circle; **Block Q3 is the database-wide guard** confirming the producer created nothing in any other circle
(needed because the scans are database-wide, Section 3).

### Block Q1 - per-row detail

```sql
-- READ ONLY. Post-invocation inspection only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with ctx as (
  select
    'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id,
    '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id,
    'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid as expected_owner,
    '4f89a6ab-80dc-464c-be1a-2a65dde5ec98'::uuid as remote_user_id
)
select
  n.id, n.user_id, n.type::text as type,
  n.data->>'entity' as data_entity, n.data->>'itemId' as data_item_id,
  n.deep_link, n.dedupe_key, n.created_at,
  case
    when n.user_id = ctx.expected_owner and n.type = 'task_due'
     and n.data->>'entity' = 'task' and n.data->>'itemId' = ctx.target_task_id::text
     and n.deep_link = '/tasks/' || ctx.target_task_id::text
     and n.dedupe_key like 'task:' || ctx.target_task_id::text || ':%'
      then 'MATCH_TARGET'
    when n.user_id = ctx.remote_user_id then 'UNEXPECTED_REMOTE'
    else 'REVIEW'
  end as row_check
from public.notifications n cross join ctx
where n.circle_id = ctx.circle_id
order by n.created_at desc;
```

### Block Q2 - summary counts

```sql
-- READ ONLY. Post-invocation inspection only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with ctx as (
  select
    'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id,
    '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id,
    'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid as expected_owner,
    '4f89a6ab-80dc-464c-be1a-2a65dde5ec98'::uuid as remote_user_id
)
select
  (select count(*) from public.notifications n where n.circle_id = ctx.circle_id) as total_notifications,
  (select count(*) from public.notifications n where n.circle_id = ctx.circle_id
     and n.type = 'task_due' and n.user_id = ctx.expected_owner
     and n.data->>'itemId' = ctx.target_task_id::text) as target_task_due_rows,
  (select count(*) from public.notifications n where n.circle_id = ctx.circle_id and n.type <> 'task_due') as non_task_due_rows,
  (select count(*) from public.notifications n where n.circle_id = ctx.circle_id and n.user_id = ctx.remote_user_id) as remote_rows,
  (select count(*) from public.notification_outbox o
     join public.notifications n on n.id = o.notification_id
     where n.circle_id = ctx.circle_id) as outbox_rows_total,
  (select count(*) from public.notification_outbox o
     join public.notifications n on n.id = o.notification_id
     where n.circle_id = ctx.circle_id and o.status <> 'pending') as outbox_rows_not_pending,
  (select count(*) from public.notification_push_deliveries d
     join public.notification_outbox o on o.id = d.outbox_id
     join public.notifications n on n.id = o.notification_id
     where n.circle_id = ctx.circle_id) as delivery_rows_total,
  case
    when (select count(*) from public.notifications n where n.circle_id = ctx.circle_id) = 1
     and (select count(*) from public.notifications n where n.circle_id = ctx.circle_id
            and n.type = 'task_due' and n.user_id = ctx.expected_owner
            and n.data->>'itemId' = ctx.target_task_id::text) = 1
     and (select count(*) from public.notifications n where n.circle_id = ctx.circle_id
            and n.user_id = ctx.remote_user_id) = 0
     and (select count(*) from public.notification_outbox o
            join public.notifications n on n.id = o.notification_id
            where n.circle_id = ctx.circle_id and o.status <> 'pending') = 0
     and (select count(*) from public.notification_push_deliveries d
            join public.notification_outbox o on o.id = d.outbox_id
            join public.notifications n on n.id = o.notification_id
            where n.circle_id = ctx.circle_id) = 0
      then 'PASS_ONE_TARGET_ONLY_NO_PROCESSING'
    else 'REVIEW'
  end as status
from ctx;
```

**Expected:** `total_notifications = 1`; `target_task_due_rows = 1`; `non_task_due_rows = 0`;
`remote_rows = 0`; `outbox_rows_total = 1` and `outbox_rows_not_pending = 0` (the one outbox row must stay
`pending` / un-fanned); `delivery_rows_total = 0` (no processing) -> `PASS_ONE_TARGET_ONLY_NO_PROCESSING`.
Also confirm the app notification center renders the row (`task_due`, `/tasks/<id>`) before any push.
**Q1/Q2 are QA-circle-scoped**; pair them with Block Q3 (below) and the Section 8 response counters to
confirm nothing was created in any other circle.

### Block Q3 - database-wide guard (nothing created outside the QA circle)

```sql
-- READ ONLY. Post-invocation DB-wide guard. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with p as (
  select
    '<INVOCATION_UTC_TIMESTAMP>'::timestamptz as t0,   -- the UTC moment you invoked enqueue-due-reminders
    'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as qa_circle
)
select
  (select count(*) from public.notifications n, p where n.created_at >= p.t0) as new_notifications_all_circles,
  (select count(*) from public.notifications n, p
     where n.created_at >= p.t0 and n.circle_id is distinct from p.qa_circle) as new_notifications_outside_qa,
  case
    when (select count(*) from public.notifications n, p where n.created_at >= p.t0) = 1
     and (select count(*) from public.notifications n, p
            where n.created_at >= p.t0 and n.circle_id is distinct from p.qa_circle) = 0
      then 'PASS_ONE_TOTAL_NONE_OUTSIDE_QA'
    else 'REVIEW'
  end as status;
```

**Expected:** `new_notifications_all_circles = 1` and `new_notifications_outside_qa = 0` ->
`PASS_ONE_TOTAL_NONE_OUTSIDE_QA`. Fill `<INVOCATION_UTC_TIMESTAMP>` with the UTC instant you sent the
request (a few seconds before is safe). `REVIEW` means the producer created a row in another circle - stop
and reconcile against the Section 8 counters.

---

## 10. Future idempotency check plan

**Do not run in 2F-7D.**

- After the first invocation + Block Q2 `PASS`, invoke `enqueue-due-reminders` **once more** under
  approval (same shaped data, unchanged).
- **Expect no duplicate:** `enqueue_notification` does `on conflict (user_id, dedupe_key) do nothing`, so
  the repeat run returns null for the target and creates no new row (response `task` counter may read 0 on
  the second run).
- **Verify counts stay stable:** re-run Block Q2 -> `total_notifications` remains `1`,
  `delivery_rows_total` remains `0`.
- **Do not run the outbox.**

---

## 11. Stop conditions (hard stops)

Halt immediately if any occur:

- **Wrong project** (anything other than Sanad `qccgshanmoeybagxwvcs`).
- **Eligibility preview (P6) is not `PASS_EXACTLY_ONE_TARGET_ELIGIBLE`** (`target_notifications != 1` or
  `other_notifications > 0`).
- **Any real (non-QA) family data** is involved.
- **Any `remote_member` recipient** appears (`4f89a6ab-...` in P1-P6 or post-invocation).
- **Any unassigned task resolves a recipient** (must be zero).
- **Any non-target item is eligible** in P6 (in the QA circle **or any other circle** -
  `other_notifications_all_circles > 0`).
- **Any notification created outside the QA circle** after invocation (Block Q3
  `new_notifications_outside_qa > 0`, or the HTTP response shows any non-`task` counter > 0).
- **Any existing pending outbox / delivery** for the QA circle before invocation (beyond the expected
  clean baseline).
- **Any manager-fallback row** in the assigned-task path (assigned `task_due` must be owner-only).
- **Missing or ambiguous cron-secret handling** (or any risk of revealing it).
- **Accidental outbox invocation** (`process-notification-outbox` run).
- **Cron enabled** / any schedule found.
- **Any push sent** before the outbox stage is separately approved.

---

## 12. Recommended next phase

Be conservative - prefer shaping/preview before invocation:

- **If no mutation is needed and the eligibility preview (P6) already returns
  `PASS_EXACTLY_ONE_TARGET_ELIGIBLE`:** proceed to **`2F-7E - execute one producer smoke test`** (manual
  invocation of `enqueue-due-reminders`, inspect with Section 9, **no outbox**).
- **If fixture shaping is needed** (P6 shows `FAIL_TARGET_NOT_ELIGIBLE` or `FAIL_EXTRA_ELIGIBLE_ITEMS`, or
  a candidate must be moved): do **`2F-7E-alt - QA fixture-shaping pack`** first (the app-UI manager edit
  from Section 7, re-run P6), manual review, **no invocation**, then re-enter 2F-7E.

Given the QA circle currently holds several assigned/unassigned items (2F-7C Block 2) and the target task's
current due time is unknown relative to the window, **`2F-7E-alt` (shaping + preview) is the expected next
step** before any invocation.

---

## 13. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace/CRLF errors).

---

## 14. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run** (all SQL is authored for later manual use).
- **No DB connection.**
- **No additional deploy.**
- **No Edge invocation.**
- **No cron enabled/created.**
- **No notification delivery** (no push sent).
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` referenced by name only; no value).
- **No commit / no stage.** No other project touched (ThinkMate untouched).

---

## 15. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-06-26-phase-2f-7d-single-producer-smoke-test-plan.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
