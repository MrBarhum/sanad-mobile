# Phase 2F-11B — Deploy Smart Actionable Push + Android QA

Date: 2026-07-09 · Finalized: 2026-07-11 (QA executed 2026-07-10)
Project ref (approved, deploy only): `qccgshanmoeybagxwvcs`
Owner id (confirmed for QA): `a6dc7376-fd9d-461f-9d14-41eabcd3f538`
Scope: deploy exactly two Edge Functions (`enqueue-due-reminders`,
`process-notification-outbox`), then Android device QA of the 2F-11A upgrade.

**Status: PARTIAL PASS.** The two Edge Functions were **deployed successfully** — the
operator unblocked the deploy manually and ran the two approved `functions deploy`
commands from `E:\Projects\sanad-mobile` with explicit `--project-ref qccgshanmoeybagxwvcs`
(Step B). Post-deploy preflight was **green** (Step D), the single `[QA SMART]` fixture
fired, and a **detailed Arabic remote push actually arrived on the Android device** —
proving the smart title/body works end-to-end after deploy (Step F). The notification
**action buttons did not render** on this device/session, so snooze/complete action QA is
**deferred** to phase **2F-11C**. Claude Code made no commits, no staging, and no
cron/SQL mutations; the deploy and all QA SQL were run by the operator.

---

## Step A — Local baseline (PASS)

| Check | Result |
|---|---|
| `npm run check:mojibake` | **PASS** — 267 files scanned, no signatures |
| `git -c core.autocrlf=false diff --check` | **PASS** — clean |
| `npx tsc --noEmit` | **PASS** — exit 0 |
| `git --no-pager status -sb` | `## master...origin/master` — **clean**, in sync |
| `git --no-pager log --oneline -6` | HEAD = `6b5fb38` (as expected), `815001f` present |

Working tree clean → Gate 1 cleared, proceeded to deploy.

Recent log:
```
6b5fb38 fix(notifications): include medication dose status lookup
815001f feat(notifications): add smart actionable push reminders
c498a9d docs(product): record active cron smoke test
adfe2de docs(product): create secure cron substrate
aca0815 docs(product): decide secure cron setup path
5286182 docs(product): plan cron substrate availability
```

---

## Step B — Deploy (DONE — manual by operator)

**Outcome: SUCCESS.** The operator unblocked the deploy manually and ran the two approved
commands from `E:\Projects\sanad-mobile` with the explicit project ref, exactly as scoped.

```
npx supabase functions deploy enqueue-due-reminders --project-ref qccgshanmoeybagxwvcs
→ succeeded. Output included:
  Deployed Functions on project qccgshanmoeybagxwvcs: enqueue-due-reminders

npx supabase functions deploy process-notification-outbox --project-ref qccgshanmoeybagxwvcs
→ succeeded. Output included:
  Deployed Functions on project qccgshanmoeybagxwvcs: process-notification-outbox
```

- A **Docker warning** appeared during deploy, but **both deploys succeeded**.
- **No other functions** were deployed — `check-push-receipts` and `check-missed-doses`
  were left untouched.
- No secrets were printed or inspected.

### History — why the earlier automated attempts were blocked first
Earlier attempts from the Claude Code tool shells exited 1 with `Access token not
provided`, because `SUPABASE_ACCESS_TOKEN` was not visible to the tool subprocesses (they
start from a fresh environment and do not inherit a variable exported only in the
operator's interactive session), and this phase forbids `supabase login`. The operator
therefore ran the two `functions deploy` commands directly from their own authenticated
terminal. The token value was never printed or inspected.

---

## Step C — Device readiness note (operator, before QA fixture)

The **detailed title/body** ships with the **Edge deploy** — it will appear on remote
push as soon as `process-notification-outbox` is live, on the current app build.

The **action buttons (تم / ذكرني بعد 5 دقائق)** require the **updated app JS** (the
2F-11A client that registers the categories). Before creating the fixture, ensure the
S24 Ultra:
1. Is running the updated app (Metro/OTA JS with the 2F-11A `push-registration.ts`
   + `hooks.ts`), and
2. Has been **opened at least once after the update** so `ensureNotificationCategories()`
   has registered the five `sanad_*_reminder` categories, and
3. Has push enabled with an active token for the owner.

If the device cannot run the updated app code yet: still QA the **detailed title/body
and body-tap deep-link** after the Edge deploy, but the **action buttons may not
appear** until the updated app is installed/opened → in that case record a
**PARTIAL** (see §12).

---

## Step D — Preflight SQL packet (SELECT-only) — run before creating the fixture

Run in the Supabase SQL editor. **All gates must hold or STOP (Gate 2).** No `command`
column is selected; no token/secret values are read.

```sql
-- 2F-11B preflight. SELECT-only. Set/verify the two ids in params.
with params as (
  select
    'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id,
    'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid as owner_id,   -- CONFIRMED owner id (used for QA)
    'Asia/Riyadh'::text                          as zone
),
cron_active as (
  select count(*) as n from cron.job where jobname like 'sanad-%' and active
),
recent_runs as (
  select d.status,
         row_number() over (partition by d.jobid order by d.start_time desc) as rn
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
  where j.jobname like 'sanad-%'
),
recent_failed as (
  select count(*) as n from recent_runs
  where rn <= 3 and status is distinct from 'succeeded'
),
outbox as (
  select count(*) filter (where status = 'pending') as pending,
         count(*) filter (where status = 'failed')  as failed
  from public.notification_outbox
),
deliveries as (
  select count(*) filter (where status = 'processing') as processing,
         count(*) filter (where status = 'failed')     as failed,
         count(*) filter (where status = 'processing'
                          and locked_at < now() - interval '10 minutes') as stale
  from public.notification_push_deliveries
),
qa_open as (
  select count(*) as n from public.care_tasks
  where status = 'open' and (title like '[QA SMART]%' or title like '[QA CRON]%')
),
task_due_nonqa as (
  select count(*) as n
  from public.care_tasks t, params p
  where t.status = 'open' and t.due_date is not null and t.title not like '[QA %'
    and ((t.due_date::timestamp + coalesce(t.due_time,'09:00')::time)
          at time zone p.zone) between now() and now() + interval '20 minutes'
),
task_overdue_window as (
  select count(*) as n
  from public.care_tasks t, params p
  where t.status = 'open' and t.due_date is not null
    and ((t.due_date::timestamp + coalesce(t.due_time,'09:00')::time)
          at time zone p.zone) between now() - interval '3 hours' and now()
),
med_next as (
  select count(*) as n
  from public.medication_schedules s
  join public.medications m on m.id = s.medication_id and m.is_active
  , params p
  where s.is_active
    and extract(dow from (now() at time zone p.zone))::int = any(s.days_of_week)
    and exists (
      select 1 from unnest(s.times) tt
      where ((current_date::timestamp + tt::time) at time zone p.zone)
            between now() and now() + interval '20 minutes')
),
visits_window as (
  select count(*) as n
  from public.family_visits v, params p
  where v.status = 'planned' and v.visit_date is not null
    and ((v.visit_date::timestamp + coalesce(v.start_time,'09:00')::time)
          at time zone p.zone)
        between now() + interval '60 minutes' and now() + interval '80 minutes'
),
appts_window as (
  select count(*) as n
  from public.care_appointments a
  where a.status = 'scheduled'
    and ( a.starts_at between now() + interval '55 minutes'  and now() + interval '75 minutes'
       or a.starts_at between now() + interval '1435 minutes' and now() + interval '1455 minutes')
),
owner_token as (
  select count(*) as n from public.push_tokens t, params p
  where t.user_id = p.owner_id and t.is_active
),
vault_bad as (
  select count(*) as n from (
    select name, count(*) c from vault.secrets group by name
  ) s where c <> 1
)
select
  (select n from cron_active)          as sanad_active_jobs,          -- expect 3
  (select n from recent_failed)        as recent_run_failures,        -- expect 0
  (select pending from outbox)         as pending_outbox,             -- expect 0
  (select failed  from outbox)         as failed_outbox,              -- expect 0
  (select processing from deliveries)  as processing_deliveries,      -- expect 0
  (select stale from deliveries)       as stale_deliveries,           -- expect 0
  (select failed from deliveries)      as failed_deliveries,          -- expect 0
  (select n from qa_open)              as open_qa_tasks,              -- expect 0
  (select n from task_due_nonqa)       as nonqa_task_due_20m,         -- expect 0
  (select n from task_overdue_window)  as task_overdue_in_window,     -- expect 0
  (select n from med_next)             as b_med_plausible_next_20m,   -- expect 0
  (select n from visits_window)        as e_visits_plausible_60_80m,  -- expect 0
  (select n from appts_window)         as f_appointments_next_window, -- expect 0
  (select n from owner_token)          as owner_active_token,         -- expect 1
  (select n from vault_bad)            as vault_names_not_singleton;  -- expect 0

-- Schedules unchanged (NO command column). Expect: enqueue */5, process */5, receipts */15.
select jobname, schedule, active
from cron.job where jobname like 'sanad-%' order by jobname;
```

**Gate 2:** proceed only if `sanad_active_jobs = 3`, all the "expect 0" columns are 0,
`owner_active_token = 1`, schedules unchanged. Otherwise STOP.

> Note: the B/E/F and task-due window checks resolve wall-clock schedules in
> `Asia/Riyadh` as a plausibility guard (matching the prior smoke-test intent); adjust
> the zone if the circle's timezone differs.

### Preflight results after deploy — **PASS (Gate 2 cleared)**

| Check | Result | Expected |
|---|---|---|
| `sanad_active_jobs` | **3 active / 3 total** | 3 |
| `recent_job_failures` | **0** | 0 |
| `pending_outbox_global` | **0** | 0 |
| `processing / stale / failed` (deliveries) | **0 / 0 / 0** | 0 / 0 / 0 |
| `open_qa_smart_or_cron` | **0** | 0 |
| `non_qa_task_due_next_20m` | **0** | 0 |
| `task_overdue_in_window` | **0** | 0 |
| `B_med_plausible_next_20m` | **0** | 0 |
| `E_visits_plausible_60_80m` | **0** | 0 |
| `F_appointments_next_window` | **0** | 0 |
| `owner_active_token` | **1** | 1 |
| `secret_count_by_name` (per-name) | **1** | 1 (singleton) |

Schedules unchanged (SELECT-only, no `command` column):

```
sanad-check-push-receipts        */15   active=true
sanad-enqueue-due-reminders      */5    active=true
sanad-process-notification-outbox */5   active=true
```

All gates held → proceeded to the single fixture.

---

## Step E — One-fixture Android QA (operator, via app UI)

Create **exactly one** task (do not create multiples):

- **Title:** `[QA SMART] اختبار إشعار ذكي`
- **Circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c`
- **Assigned to (owner):** `a6dc7376-fd9d-461f-9d14-41eabcd3f538` *(verified)*
- **Due:** ~**11 minutes** ahead, Riyadh local time (inside the 20-minute lookahead so
  `enqueue-due-reminders` picks it up on the next `*/5` tick).

### Fixture verification SQL (SELECT-only)
```sql
with params as (
  select
    'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id,
    'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid as owner_id,
    'Asia/Riyadh'::text as zone
),
fx as (
  select t.*
  from public.care_tasks t, params p
  where t.circle_id = p.circle_id and t.status = 'open'
    and t.title like '[QA SMART]%'
)
select
  (select count(*) from fx)                                     as open_qa_smart,          -- expect 1
  (select bool_and(assigned_to = p.owner_id) from fx, params p) as assigned_to_owner,      -- expect true
  (select bool_and(
      ((due_date::timestamp + coalesce(due_time,'09:00')::time) at time zone p.zone)
      between now() and now() + interval '20 minutes') from fx, params p) as in_20m_window, -- expect true
  (select id from fx order by created_at desc limit 1)         as fixture_id,             -- RECORD THIS
  (select count(*) from public.care_tasks t, params p
     where t.status='open' and t.due_date is not null and t.title not like '[QA %'
       and ((t.due_date::timestamp + coalesce(t.due_time,'09:00')::time) at time zone p.zone)
           between now() and now() + interval '20 minutes')     as nonqa_task_due_20m;     -- expect 0
-- Re-run the B/E/F blocks from Step D and confirm they are still 0 before observing.
```

### Fixture created — verified

| Field | Value |
|---|---|
| `fixture_id` | `ca83a08e-a9eb-494b-9229-1288e1cc962f` |
| `title` | `[QA SMART] اختبار إشعار ذكي` |
| `assigned_to_owner` | **true** |
| initial `status` | `open` |
| `due` | `2026-07-10 08:45:00` |
| `mins_to_due` | **10** |
| `in_20m_window` | **true** |
| `non_qa_task_due_next_20m` | **0** |
| deliveries `processing / stale / failed` | **0 / 0 / 0** |

> `pending_outbox_global` read **1** at fixture-verification time. Interpreted as the
> **expected transient**: the producer (`enqueue-due-reminders`) had already enqueued the
> reminder row and the processor (`process-notification-outbox`) had not yet run its next
> `*/5` cycle to fan it out. Not a fault — it drains on the next processor tick.

---

## Step F — Observe remote push (operator; cron-driven, no manual invoke)

Let the `*/5` cron drive it (do **not** run `functions invoke` or `net.http_post`).

**Expected remote push**
- Title: `حان موعد المهمة`
- Body includes: `حان موعد مهمة [QA SMART] اختبار إشعار ذكي`
- Action buttons (where supported): `تم` , `ذكرني بعد 5 دقائق`

**Body-tap test:** tap the notification body → Sanad opens deep-linked to the task
detail (`/tasks/<fixture_id>`).

**Action test (one fixture):**
1. On the first remote push, press **ذكرني بعد 5 دقائق**.
2. Confirm the app shows the snooze confirmation ("سيصلك تذكير بعد 5 دقائق").
3. Wait ~5 minutes for the **local** notification (same title/body + buttons).
4. On the local notification, press **تم**.
5. Confirm the task becomes **completed**.

**If the buttons do not appear:** record a device/build registration blocker, still
verify detailed title/body + body-tap, and do **not** mark action QA as PASS (→ PARTIAL).

### Observed on device — remote push arrived (detailed text PASS)

A remote push **actually arrived** on the Android device (cron-driven, no manual invoke).
Actual visible notification:

| Field | Actual value |
|---|---|
| App label | `Sanad` |
| Title | `حان موعد المهمة` |
| Body | `حان موعد مهمة [QA SMART] اختبار إشعار ذكي` |

This proves the **detailed smart push text works end-to-end after deploy** (Edge
`process-notification-outbox` produced the correct Arabic title/body and Expo delivered it
to the device).

### Action buttons — did NOT render → **PARTIAL** (not FAIL)

The notification action buttons (`تم` / `ذكرني بعد 5 دقائق`) **did not appear** on this
remote push. Verdict for this session is **PARTIAL**, not FAIL:

- **Detailed text → PASS.**
- **Remote push delivery → PASS.**
- **Action buttons → PENDING** — needs device/app-build / notification-category
  registration investigation (2F-11C).
- **Snooze + complete actions → NOT TESTED** — the buttons did not render, so there was
  nothing to press; body-tap deep-link and the action flows were not exercised this session.

---

## Step G — Observation SQL packet (SELECT-only) — run after the action

No raw push token, no `cron.job.command` selected.

```sql
with params as (
  select
    'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id,
    'a6dc7376-fd9d-461f-9d14-41eabcd3f538'::uuid as owner_id,
    '<FIXTURE_TASK_ID>'::uuid as fixture_id      -- from Step E
),
notif as (
  select n.*
  from public.notifications n, params p
  where n.user_id = p.owner_id
    and n.type = 'task_due'
    and (n.data->>'itemId' = p.fixture_id::text or n.data->>'taskId' = p.fixture_id::text)
  order by n.created_at desc
  limit 1
)
select
  (select title from notif)                                    as stored_title,   -- expect حان موعد المهمة
  (select body  from notif)                                    as stored_body,    -- expect includes [QA SMART]…
  (select ob.status from public.notification_outbox ob
     where ob.notification_id = (select id from notif))        as outbox_status,  -- terminal (fanned/skipped)
  (select d.status from public.notification_push_deliveries d
     join public.notification_outbox ob on ob.id = d.outbox_id
     where ob.notification_id = (select id from notif)
     order by d.updated_at desc limit 1)                       as delivery_status,     -- expect sent
  (select (d.expo_ticket_id is not null) from public.notification_push_deliveries d
     join public.notification_outbox ob on ob.id = d.outbox_id
     where ob.notification_id = (select id from notif)
     order by d.updated_at desc limit 1)                       as has_expo_ticket,     -- expect true
  (select d.receipt_status from public.notification_push_deliveries d
     join public.notification_outbox ob on ob.id = d.outbox_id
     where ob.notification_id = (select id from notif)
     order by d.updated_at desc limit 1)                       as receipt_status,      -- expect ok (after receipts run)
  (select count(*) from public.notification_outbox where status = 'pending')      as pending_outbox_global, -- expect 0
  (select count(*) from public.notification_push_deliveries
     where status = 'processing')                              as processing_deliveries, -- expect 0
  (select count(*) from public.notification_push_deliveries
     where status = 'processing' and locked_at < now() - interval '10 minutes')   as stale_deliveries,    -- expect 0
  (select count(*) from public.notification_push_deliveries where status='failed') as failed_deliveries,  -- expect 0
  (select status from public.care_tasks, params p where id = p.fixture_id)         as fixture_status,      -- expect completed
  (select completed_by from public.care_tasks, params p where id = p.fixture_id)   as fixture_completed_by,-- expect owner
  (select count(*) from public.care_tasks
     where status='open' and title like '[QA SMART]%')         as open_qa_smart_after, -- expect 0
  (select count(*) from cron.job where jobname like 'sanad-%' and active)          as sanad_active_jobs;   -- expect 3

-- Guard: no unexpected notifications for the owner in the QA window (title is QA data, not a secret).
select n.type, n.title, n.created_at
from public.notifications n, params p
where n.user_id = p.owner_id and n.created_at > now() - interval '30 minutes'
order by n.created_at desc;
```

---

## Steps H results

| # | Item | Result |
|---|---|---|
| 1 | Deploy `enqueue-due-reminders` / `process-notification-outbox` | **DONE — both succeeded** (operator, manual, explicit `--project-ref`; Docker warning only) |
| 2 | Device/app readiness | Detailed push worked; action categories **not** registered/rendering on this build |
| 3 | Fixture id + due time | `ca83a08e-a9eb-494b-9229-1288e1cc962f`, due `2026-07-10 08:45:00` (`mins_to_due=10`, in-window) |
| 4 | Actual remote push title/body | `حان موعد المهمة` / `حان موعد مهمة [QA SMART] اختبار إشعار ذكي` — **PASS** |
| 5 | Action buttons appeared? | **NO** — deferred to 2F-11C |
| 6 | Body-tap result | Not tested this session (deferred with buttons) |
| 7 | Snooze action result | **Not tested** — buttons did not render |
| 8 | Local reminder result | Not tested (depends on snooze) |
| 9 | "تم" (complete) action result | **Not tested** — buttons did not render |
| 10 | SQL evidence | Preflight green; `pending_outbox`=1 transient at fixture, drains on processor tick; `processing/stale/failed`=0 |
| 11 | Blocker | Action buttons not rendered on this device/session (device/build / category registration) |

## 12. Final verdict

**PARTIAL PASS.**

- **Edge deploy succeeded** — both `enqueue-due-reminders` and `process-notification-outbox`
  deployed to `qccgshanmoeybagxwvcs` (operator, manual, explicit `--project-ref`).
- **Detailed Arabic push title/body succeeded** — a real remote push arrived on the Android
  device: `حان موعد المهمة` / `حان موعد مهمة [QA SMART] اختبار إشعار ذكي`.
- **Cron remained healthy** — 3/3 sanad jobs active, schedules unchanged, 0 recent failures,
  0 pending/processing/stale/failed at steady state.
- **Action buttons were not rendered** on this device/session, so **snooze/complete action
  QA is deferred**.

### Session end
The operator stopped here because the **Claude Code usage limit was reached** and plans to
continue Sanad work on the **laptop**. Final action-button QA is therefore **deferred** to
the next phase (2F-11C).

### Cleanup note
The operator should **complete the `[QA SMART]` fixture** (`ca83a08e-a9eb-494b-9229-1288e1cc962f`)
from the **app UI** if it is not already completed. **No SQL cleanup** — do not mutate the row
directly.

## 13. Recommendation — next phase on laptop: **2F-11C** (Android action-button investigation)

Focus of 2F-11C — Android action button investigation / updated app-build verification:

1. Ensure the device is running the **updated JS/native app** (the 2F-11A client).
2. Verify the **notification categories are registered**
   (`ensureNotificationCategories()` → the five `sanad_*_reminder` categories).
3. Test **action buttons** for both **remote** and **local** notifications.
4. Then test the **snooze** (`ذكرني بعد 5 دقائق`) and **complete** (`تم`) actions end-to-end.

---

## Constraints respected
- No `supabase login` / `link` / `db push` / `secrets` / `functions invoke` by Claude Code.
- The two `functions deploy` commands were run **by the operator** from their own
  authenticated terminal; Claude Code only recorded the results.
- No SQL mutations, no cron changes, no Edge manual invocation, no EAS.
- No secrets, no raw push tokens, no `cron.job.command` printed.
- No commit, no staging. Only this report file was edited.
