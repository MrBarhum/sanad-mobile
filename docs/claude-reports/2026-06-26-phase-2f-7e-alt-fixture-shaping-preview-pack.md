# Phase 2F-7E-alt - QA fixture shaping + eligibility preview pack (no invocation)

**Status:** Operator pack only. This report gives the operator a manual sequence of **read-only SQL** and
**app-UI edits** to shape the QA fixture so the database-wide eligibility preview shows **exactly one**
target `task_due`, before any producer invocation. **Nothing was executed in this phase.** Claude ran no
Supabase CLI, no SQL, made no DB connection, invoked no Edge Function, mutated no data, enabled no cron,
processed no outbox, sent no push. The only filesystem write is this report; the only commands run are the
two local read-only checks in Section 8.

**Baseline (pushed) commit:** `0b2876c docs(product): plan single producer smoke test`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Target task:** `23bff3fa-130d-4e29-96ec-80bac0647060` (`مشي سريع`), expected owner
`a6dc7376-fd9d-461f-9d14-41eabcd3f538`.
**Sources inspected read-only:** 2F-7D plan, 2F-7C results record; `enqueue-due-reminders/index.ts`,
`_shared/config.ts`, `_shared/time.ts`, `_shared/auth.ts`.

---

## 1. Executive summary

- **This is no-invocation preparation only.** The operator runs approved read-only SQL and (if needed) one
  app-UI edit. No Edge Function is invoked in this phase.
- **Goal:** get the **database-wide** eligibility gate (Block P6) to return
  `PASS_EXACTLY_ONE_TARGET_ELIGIBLE` - the target task `task_due` resolving to exactly its one owner, and
  **zero** other would-create occurrences in **any** circle on the project.
- **No outbox, no push, no cron** at any point.
- **Why database-wide:** one invocation of `enqueue-due-reminders` scans every circle (none of its five
  scans filters by `circle_id`), so "exactly one notification" must be verified across the whole database,
  not just the QA circle (established in 2F-7D).
- The operator executes **only** the approved manual read-only SQL below and, if required, a single app-UI
  edit to the target task's due date/time (as a manager). Reserve the actual producer invocation for the
  next phase (2F-7E).

---

## 2. Operator sequence

1. **Confirm the correct project** in the Supabase Dashboard: project ref `qccgshanmoeybagxwvcs` (Sanad).
   Not ThinkMate or any other project.
2. **Run the read-only context SQL** (Block A) - confirm the QA circle, its timezone, and current time /
   window bounds.
3. **Run the read-only target-task SQL** (Block B) - confirm the target is `open`, assigned to
   `a6dc7376-...`, and see its current due time and whether it is already in the `task_due` window.
4. **Run the database-wide eligibility gate** (Block P6, Block D).
5. **If P6 already returns `PASS_EXACTLY_ONE_TARGET_ELIGIBLE`:** stop and report the results (Section 5).
   No edit needed.
6. **If the target is not eligible** (`FAIL_TARGET_NOT_ELIGIBLE`): run the suggested-due helper (Block C),
   then use the **app UI as a manager** (admin / primary_caregiver) to set the target task's due
   date/time to the suggested values ~10 minutes ahead (Section 4). Keep it `open` and keep the owner
   unchanged.
7. **Re-run P6 immediately** (Block D).
8. **If P6 returns `FAIL_EXTRA_ELIGIBLE_ITEMS`** (or `NEEDS_REVIEW`): stop and report; use the Block E
   detail queries to locate the extra eligible item(s) in any circle. Do not invoke.
9. **Do not invoke Edge Functions** in this phase under any outcome.

---

## 3. Manual read-only SQL blocks

Run one block at a time in the Supabase Dashboard SQL Editor. Every block is a single `SELECT` and starts
with the mandated header. **Block D (P6) is database-wide (all circles), not QA-only** - that is the
authoritative gate. The resolver functions are `service_role`-granted and owned by `postgres`; the SQL
Editor runs as `postgres` (the owner) and can execute them - if you hit `permission denied for function`,
stop and report rather than escalating.

### Block A - context (QA circle timezone + now + window)

```sql
-- READ ONLY. Fixture preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select
  cc.id as circle_id,
  cc.name as circle_name,
  cc.timezone as circle_tz,
  now() as now_utc,
  (now() at time zone cc.timezone) as now_circle_local,
  now() + interval '20 minutes' as task_due_window_end,
  '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id
from public.care_circles cc
where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid;
```

### Block B - target task current values + current eligibility

```sql
-- READ ONLY. Fixture preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with ctx as (
  select cc.id as circle_id, cc.timezone as tz, now() as now_ts
  from public.care_circles cc
  where cc.id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid
)
select
  t.id, t.title, t.status, t.assigned_to as owner_id,
  (t.assigned_to = 'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid) as owner_is_expected,
  (t.status = 'open') as is_open,
  t.due_date, t.due_time, t.updated_at,
  ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone ctx.tz) as current_due_at,
  (((t.due_date + coalesce(t.due_time, time '09:00')) at time zone ctx.tz)
     between ctx.now_ts and ctx.now_ts + interval '20 minutes') as in_task_due_window_now
from public.care_tasks t cross join ctx
where t.id = '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid and t.circle_id = ctx.circle_id;
```

### Block C - suggested due date/time (~10 minutes ahead, circle-local)

```sql
-- READ ONLY. Fixture preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
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

Use these values in the app-UI edit (Section 4). They land the target inside the `task_due` window
`[now, now+20m]`; re-run P6 promptly after saving (within ~10 minutes) so the target is still in-window.

### Block D - database-wide eligibility gate (P6, authoritative)

```sql
-- READ ONLY. Fixture preview only (DATABASE-WIDE). Do not modify data. Do not invoke Edge Functions. Do not enable cron.
-- The producer scans EVERY circle, so this gate is NOT restricted to the QA circle: each scan joins the
-- item's own care_circles row for its timezone and resolves recipients with that item's circle_id.
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
`other_notifications_all_circles = 0`). `FAIL_TARGET_NOT_ELIGIBLE` -> shape the target (Section 4).
`FAIL_EXTRA_ELIGIBLE_ITEMS` -> another item (in any circle) is in a window; locate it with Block E and move
it out / wait. `NEEDS_REVIEW` -> ambiguous; inspect Block E.

P6 reports **pre-dedup would-create** counts: it does not model `enqueue_notification`'s dedupe
suppression, so `target_notifications = 1` assumes the clean-outbox baseline already required by Section 6.
If a `task_due` row for the target were already queued, a real invoke would create 0 new (dedupe collapse);
this is why "any pending outbox before invocation" is a hard stop - confirm the outbox is clean first.

### Block E - detail queries to locate extra eligible items (database-wide; run only if P6 fails)

Each of these lists **only the occurrences that would actually fire** (all producer filters applied),
across **all circles**, with the resolved recipients - so an offending item in any circle is visible.
`is_qa_circle` marks whether the row is in the QA circle; `is_target` marks the intended target. (These
queries intentionally omit the producer's 2000-row-per-scan cap, so they return a **superset** of what the
producer would fire - an offending item can never be hidden.)

**E1 - task_due detail**

```sql
-- READ ONLY. Fixture preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with tgt as (
  select '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id,
         'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as qa_circle
)
select
  t.id as item_id, t.circle_id, (t.circle_id = tgt.qa_circle) as is_qa_circle,
  (t.id = tgt.target_task_id) as is_target,
  t.title, t.assigned_to as owner_id, t.due_date, t.due_time,
  ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) as due_at,
  array(select r.user_id
        from public.notification_recipients_for_item_event(t.circle_id,'task_due'::public.notification_type,'task',t.id) r
        order by r.user_id) as expected_recipients
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
cross join tgt
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() and now() + interval '20 minutes'
order by is_target desc, is_qa_circle desc, due_at;
```

**E2 - task_overdue detail**

```sql
-- READ ONLY. Fixture preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with tgt as (
  select '23bff3fa-130d-4e29-96ec-80bac0647060'::uuid as target_task_id,
         'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as qa_circle
)
select
  t.id as item_id, t.circle_id, (t.circle_id = tgt.qa_circle) as is_qa_circle,
  (t.id = tgt.target_task_id) as is_target,
  t.title, t.assigned_to as owner_id, t.due_date, t.due_time,
  ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone) as due_at,
  array(select r.user_id
        from public.notification_recipients_for_item_event(t.circle_id,'task_overdue'::public.notification_type,'task',t.id) r
        order by r.user_id) as expected_recipients
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
cross join tgt
where t.status = 'open' and t.due_date is not null
  and ((t.due_date + coalesce(t.due_time, time '09:00')) at time zone cc.timezone)
        between now() - interval '24 hours' and now() - interval '60 minutes'
order by is_qa_circle desc, due_at;
```

**E3 - medication_due detail**

```sql
-- READ ONLY. Fixture preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as qa_circle
)
select
  s.medication_id as item_id, s.id as schedule_id, s.circle_id, (s.circle_id = qa.qa_circle) as is_qa_circle,
  m.name as medication_name, cd.dose_date, tm.scheduled_time,
  ((cd.dose_date + tm.scheduled_time) at time zone cc.timezone) as dose_at,
  array(select r.user_id
        from public.notification_recipients_for_item_event(s.circle_id,'medication_due'::public.notification_type,'medication',s.medication_id) r
        order by r.user_id) as expected_recipients
from public.medication_schedules s
join public.medications m on m.id = s.medication_id and m.is_active
join public.care_circles cc on cc.id = s.circle_id
cross join qa
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
order by is_qa_circle desc, dose_at;
```

**E4 - appointment_upcoming detail (both leads)**

```sql
-- READ ONLY. Fixture preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as qa_circle
)
select
  a.id as item_id, a.circle_id, (a.circle_id = qa.qa_circle) as is_qa_circle,
  a.title, a.assigned_to as owner_id, a.starts_at, lead.lead_min,
  array(select r.user_id
        from public.notification_recipients_for_item_event(a.circle_id,'appointment_upcoming'::public.notification_type,'appointment',a.id) r
        order by r.user_id) as expected_recipients
from public.care_appointments a
cross join qa
cross join (values (1440),(60)) as lead(lead_min)
where a.status = 'scheduled'
  and a.starts_at between now() + (lead.lead_min * interval '1 minute')
                      and now() + interval '20 minutes' + (lead.lead_min * interval '1 minute')
order by is_qa_circle desc, a.starts_at, lead.lead_min;
```

**E5 - visit_upcoming detail**

```sql
-- READ ONLY. Fixture preview only. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as qa_circle
)
select
  v.id as item_id, v.circle_id, (v.circle_id = qa.qa_circle) as is_qa_circle,
  v.visitor_name, v.visitor_user_id as owner_id, v.visit_date, v.start_time,
  ((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone cc.timezone) as start_at,
  array(select r.user_id
        from public.notification_recipients_for_item_event(v.circle_id,'visit_upcoming'::public.notification_type,'visit',v.id) r
        order by r.user_id) as expected_recipients
from public.family_visits v
join public.care_circles cc on cc.id = v.circle_id
cross join qa
where v.status = 'planned' and v.visit_date is not null
  and (((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone cc.timezone) - interval '60 minutes')
        between now() and now() + interval '20 minutes'
order by is_qa_circle desc, start_at;
```

Each detail query returning **zero rows** (for E2-E5) and E1 returning **only the target** is the shape
that makes P6 pass.

---

## 4. App-UI shaping instructions

**Change the target task's due date/time through the app UI as a manager - not raw SQL.**

> **Why not raw SQL:** `care_tasks` has a `BEFORE UPDATE` trigger `care_tasks_collaborator_scope`
> (function `enforce_care_task_collaborator_scope`). In the Dashboard SQL Editor `auth.uid()` is null, so
> the trigger treats the actor as a non-manager collaborator and **rejects any content change** (including
> `due_date` / `due_time`) on an open task, raising `collaborators may only complete or cancel a task`. The
> app UI, signed in as a manager, carries a JWT that satisfies `has_circle_role`, so the manager-exempt
> path allows the edit. (The assigned owner `a6dc7376` is a doer and may only complete/cancel - a manager
> must perform the reschedule.)

Steps (only if Block D returned `FAIL_TARGET_NOT_ELIGIBLE`):

1. **Sign in** to the app as an **admin** or **primary caregiver** (a manager) of the QA circle.
2. **Open the QA circle** `رعاية الوالد الغالي`.
3. **Open the task** `مشي سريع` (`23bff3fa-130d-4e29-96ec-80bac0647060`).
4. **Keep it `open`** (do not complete or cancel it).
5. **Keep the assigned owner unchanged** (`a6dc7376-fd9d-461f-9d14-41eabcd3f538`).
6. **Set the due date/time** to the `suggested_due_date` / `suggested_due_time` from Block C.
7. **Save.**
8. **Immediately re-run Block D (P6).**
9. **If P6 returns `PASS_EXACTLY_ONE_TARGET_ELIGIBLE`:** stop and report (Section 5).

No destructive SQL update is provided or needed; shaping is a single reversible app-UI field change (the
original due date/time can be restored later the same way).

---

## 5. Result reporting template

Report back (paste values / statuses; **never paste secrets**):

- **Context (Block A):** `circle_id`, `circle_name`, `circle_tz`, `now_utc`, `now_circle_local`.
- **Target current values (Block B):** `status`, `owner_id`, `owner_is_expected`, `is_open`, `due_date`,
  `due_time`, `current_due_at`, `in_task_due_window_now`.
- **Suggested due values (Block C):** `suggested_due_date`, `suggested_due_time` (and `circle_tz`).
- **P6 result BEFORE edit (Block D):** `status`, `target_notifications`,
  `other_notifications_all_circles`, `total_notifications_if_invoked`.
- **App-UI edit:** whether it was performed, and the new due date/time set.
- **P6 result AFTER edit (Block D re-run):** same fields.
- **Extra-eligible detail (Blocks E1-E5):** any rows returned, **only if P6 failed** - include `item_id`,
  `circle_id`, `is_qa_circle`, `is_target`, and `expected_recipients` for each.

---

## 6. Stop conditions (hard stops)

Halt and report (do not invoke) if any occur:

- **Wrong project** (anything other than Sanad `qccgshanmoeybagxwvcs`).
- **P6 is not `PASS_EXACTLY_ONE_TARGET_ELIGIBLE`** (`target_notifications != 1`).
- **Any extra eligible item anywhere in the database** (`other_notifications_all_circles > 0`, or any
  Block E row that is not the target).
- **Target is not assigned to the expected owner** (`owner_is_expected = false` in Block B).
- **Target is not `open`** (`is_open = false` in Block B).
- **`remote_member` appears** as a recipient (`4f89a6ab-...` in any resolved list).
- **Any pending outbox** for the QA circle before invocation (an unclean baseline).
- **Any accidental invocation** of an Edge Function.
- **Cron enabled** / any schedule found.
- **Any push sent.**
- **Any secret pasted** (`NOTIFICATIONS_CRON_SECRET`, service-role key, Expo credentials).

---

## 7. Recommended next phase

- **If P6 passes** (`PASS_EXACTLY_ONE_TARGET_ELIGIBLE`) and the outbox baseline is still clean:
  **`2F-7E - execute one producer smoke test`** (manual invocation of `enqueue-due-reminders`, inspect
  with the 2F-7D Section 9 blocks, **no outbox, no push, no cron**).
- **If P6 fails:** diagnose with the Block E detail queries, correct the QA data (shape the target, or move
  the extra item out of its window), re-run P6 - **no invocation** until P6 passes.

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
- **No SQL run** (all SQL is authored for later manual use).
- **No DB connection.**
- **No additional deploy.**
- **No Edge invocation.**
- **No cron enabled/created.**
- **No notification delivery** (no push sent).
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` referenced by name only; no value).
- **No commit / no stage.** No other project touched (ThinkMate untouched).

---

## 10. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-06-26-phase-2f-7e-alt-fixture-shaping-preview-pack.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
