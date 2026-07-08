# Phase 2F-10F - Manual preflight RESULT ASSESSMENT + med/visit deep-review pack (no cron)

**Status:** Result-recording + review-planning phase. Claude records the human-operator's manual preflight
results, assesses them against the pass/stop criteria, reviews the producer branches from source, and authors a
new **future/manual** SELECT-only deep-review pack to narrow the one `REVIEW` check. **Claude ran no SQL, made
no DB connection, ran no Supabase CLI, invoked no Edge Function, enabled/created no cron, created no QA fixture,
sent no push, and read no secret value.** The manual preflight was run by the **human operator** in the Supabase
Dashboard; this report records their pasted results verbatim. The only filesystem write in this phase is this
report; the only commands Claude runs are the two local read-only checks in Section 8 and the read-only git
status/diff in Section 10.

**Baseline commit:** `3116907 docs(product): prepare manual cron preflight`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle:** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (`رعاية الوالد الغالي`).
**Owner user (recipient / token owner):** `a6dc7376-fd9d-461f-9d14-41eabcd3f538`.

**Sources inspected read-only (no file modified):** `2F-10E`/`2F-10D`/`2F-10C`/`2F-10B`/`2F-10A` reports; Edge
source (`enqueue-due-reminders`, `process-notification-outbox`, `check-push-receipts`) + shared (`config.ts`
`REMINDER_CONFIG`, `enqueue.ts`, `messages.ts`, `time.ts` behavior, `expo.ts`); migrations
`20260608130000_create_medications.sql`, `20260608130100_create_medication_schedules.sql`,
`20260608130200_create_medication_logs.sql`, `20260610090200_create_family_visits.sql`,
`20260610090100_create_care_appointments.sql`, `20260611120200_add_care_circle_timezone.sql`,
`20260626164000_...responsibility_resolvers.sql`, `20260611120100_...notification_functions.sql`.

No app source, Edge source, migration, or generated type was modified.

---

## 1. Executive summary

- **The manual preflight was run by the human operator, not Claude.** Claude ran no SQL and made no DB
  connection.
- **Cron remains off.** No QA fixture was created. No Edge Function was invoked. No push was sent.
- **Overall verdict: NEEDS REVIEW (not PASS for cron).**
  - **Checks 01-12 passed / baseline-accepted:** the core notification / outbox / delivery / cron-absence /
    `task_due` / `task_overdue` / token / fixture preflight is clean and matches the known baseline exactly
    (`pending=0`; outbox `fanned=2, skipped=1`; deliveries `sent/ok=1, sent/unchecked=1`; `processing=0`,
    `stale=0`, `failed=0`; one active owner token, active operational role; no non-QA `task_due`; no cron
    schema; no open `[QA CRON]`; `task_overdue=0`).
  - **Check 13 (broad med/appt/visit approximate scan) is `REVIEW`:** `active_med_schedules = 11` and
    `planned_visits_with_date = 7` are **non-zero** (`scheduled_appts_next_25h = 0`). Because
    `enqueue-due-reminders` is **database-wide** and runs **all** producer branches in one invocation, these
    non-zero counts must be **narrowed** (do any actually fall in a producer window?) before cron.
  - **Therefore cron must NOT proceed yet.** The safe next step is the med/visit deep-review pack in Section 5.

---

## 2. Recorded human-provided results (all 13 checks)

Recorded verbatim from the operator's pasted output. Classification: **PASS**, **BASELINE-ACCEPTED**
(matches the known baseline exactly), **REVIEW**, or **STOP**.

| # | Check | Observed | Expected | Classification |
| - | ----- | -------- | -------- | -------------- |
| 01 | pending_outbox | `pending_outbox = 0` | `0` | **PASS** |
| 02 | outbox summary | `fanned=2, skipped=1` (no pending) | baseline `fanned=2, skipped=1, pending=0` | **BASELINE-ACCEPTED** (exact match) |
| 03 | delivery/receipt summary | `sent/ok=1, sent/unchecked=1` | baseline `sent/ok=1, sent/unchecked=1` | **BASELINE-ACCEPTED** (exact match) |
| 04 | processing / stale | `processing_total=0, stale_processing=0` | `0 / 0` | **PASS** |
| 05 | sent pending-receipt ≥15m | `[]` (none) | none | **PASS** |
| 06 | failed_deliveries | `0` | `0` | **PASS** |
| 07 | owner active tokens | `total=1, active=1`; android; role `family_member`; membership `active`; token id `93b4e8b8-...`; `ExponentPushToken[***]` | one active token, active operational role, masked | **PASS** |
| 08 | task_due next 20m | `[]` (none) | `0` rows (no fixture) | **PASS** |
| 09 | non_qa_eligible_task_due | `0` | `0` | **PASS** |
| 10 | cron schema probe | `cron_job_regclass = null` | null OR zero Sanad jobs | **PASS** (pg_cron not installed → cron off) |
| 11 | existing_qa_cron_open | `0` | `0` | **PASS** |
| 12 | task_overdue_in_window | `0` | `0` | **PASS** |
| 13 | med/appt/visit approx scan | `active_med_schedules=11`, `planned_visits_with_date=7`, `scheduled_appts_next_25h=0` | ideally all `0`; nonzero → review | **REVIEW** |

**Explicit marking:** checks **01-12** are **passing or baseline-accepted**; check **13** is **REVIEW** because
`active_med_schedules` (11) and `planned_visits_with_date` (7) are non-zero. No check is a hard STOP.

**Note on check 07:** the owner's QA-circle role is `family_member`, which **is** an operational role eligible
for `task_due` (only `remote_member` / `elder` / inactive / missing would be a STOP). One active token on one
device is exactly the single-push precondition. PASS.

**Note on check 10:** `to_regclass('cron.job') = null` means the `pg_cron` extension is **not installed /
visible**, which independently confirms **cron is off** and there are no Sanad cron jobs to worry about yet.

---

## 3. Interpretation of check 13

- **`active_med_schedules = 11` does NOT mean a medication notification is due now.** This count is every
  active schedule whose medication is also active, **database-wide**, with **no** time-window, weekday,
  date-range, dose-log, or recipient filter. A schedule fires a `medication_due` reminder **only** for a
  specific occurrence that lands inside the 20-minute lookahead **and** is not already logged **and** resolves
  to an eligible recipient. Most of 11 active schedules are almost certainly **not** in the next window.
- **`planned_visits_with_date = 7` does NOT mean a visit notification is due now.** This count is every planned
  visit with a date, **database-wide**, with **no** lead-time window filter. A visit fires a `visit_upcoming`
  reminder **only** when `(start - 60m)` lands inside the 20-minute lookahead — i.e. the visit starts **60-80
  minutes from now**. Most of 7 planned visits are on other days / times.
- **These were broad, approximate scans** (2F-10D authored block 13 explicitly as "APPROXIMATE ... NOT an exact
  window reproduction; authoritative arbiter is the producer response"). They are a deliberately **wide net**:
  any non-zero result is a prompt to look closer, not evidence that anything will fire.
- **Why review is still required before cron:** `enqueue-due-reminders` is **database-wide** and runs **five**
  producer branches in **one** invocation (`medication_due`, `task_due`, `task_overdue`, `appointment_upcoming`,
  `visit_upcoming`). So enabling cron would exercise the medication and visit branches too — not only the
  `task_due` path the smoke test intends. If any of those 11 schedules or 7 visits actually fall in a producer
  window during the smoke run, cron would deliver **unintended** medication/visit pushes to real recipients.
  The `REVIEW` must be narrowed to a confident "nothing else will fire in the smoke window" (or the extra
  branches must be explicitly accepted / excluded) before cron is safe.

---

## 4. Source-based producer branch review (read-only; nothing executed)

From `enqueue-due-reminders/index.ts` + `_shared/config.ts` (`REMINDER_CONFIG`).

**What runs in ONE producer invocation** (sequentially, all DB-wide):
`enqueueMedicationDue` → `enqueueTaskDue` → `enqueueTaskOverdue` → `enqueueAppointmentUpcoming` →
`enqueueVisitUpcoming`. (The **missed-dose** branch is **not** here — it lives in the separate
`check-missed-doses` function, which is **out of scope** for the initial cron chain.)

| Branch | Type | Fire condition (exact / approx) | Window / lead (config) |
| ------ | ---- | ------------------------------- | ---------------------- |
| `enqueueMedicationDue` | `medication_due` | active schedule + active medication; occurrence on today/tomorrow (circle-local) where `weekday ∈ days_of_week` and `start_date ≤ day ≤ end_date`; a `time ∈ times` whose `doseAt ∈ [now, now+20m]`; **not** already in `medication_logs(schedule_id,dose_date,scheduled_time)`; resolves to an eligible recipient | `medicationLookaheadMinutes = 20` |
| `enqueueTaskDue` | `task_due` | `status='open'`, `due_date not null`, `dueAt ∈ [now, now+20m]`, resolves to owner | `taskLookaheadMinutes = 20` |
| `enqueueTaskOverdue` | `task_overdue` | `status='open'`, `dueAt ∈ [now-24h, now-60m]`, resolves to owner | `taskOverdueGraceMinutes=60`, `taskOverdueMaxAgeHours=24` |
| `enqueueAppointmentUpcoming` | `appointment_upcoming` | `status='scheduled'`; for each lead, `starts_at ∈ [now+lead, now+20m+lead]` | `appointmentLeadMinutes=[1440,60]`, `appointmentLookaheadMinutes=20` |
| `enqueueVisitUpcoming` | `visit_upcoming` | `status='planned'`, `visit_date not null`; `startAt=(visit_date + start_time|09:00)@circle-tz`; `triggerAt=startAt-60m ∈ [now, now+20m]` ⇔ `startAt ∈ [now+60m, now+80m]` | `visitLeadMinutes=60`, `visitLookaheadMinutes=20`, `visitDateOnlyReminderHour=9` |

**Timezone:** medication/task/visit wall-clock times resolve in the **care-circle** timezone
(`care_circles.timezone`) via `wallTimeToInstant` (naive local → UTC); appointments use absolute `starts_at`
(timezone-independent). `days_of_week` and `extract(dow …)` share the `0=Sunday … 6=Saturday` convention.

**What exact data is needed to know if meds/visits are truly eligible:**

- **Medication:** each active schedule's `days_of_week`, `times`, `start_date`/`end_date`, the circle timezone,
  the current time, **and** the `medication_logs` rows for the candidate occurrence — plus whether the
  occurrence resolves to an eligible recipient (owner or manager fallback, role/pref/remote gates).
- **Visit:** each planned visit's `visit_date`, `start_time` (or the 09:00 default), the circle timezone, and
  the current time (to test the `[now+60m, now+80m]` start window) — plus recipient resolution.

**Branch too complex for exact SQL reproduction:** the **medication** branch (candidate-day expansion ×
`times[]` unnest × weekday/date-range × per-occurrence dose-log check × recipient resolution) is the hardest;
Section 5 reproduces it **approximately** (window + weekday + date-range + dose-log), which **over-approximates**
(it does not re-apply recipient eligibility / preferences), so a schedule can appear "in window" yet resolve to
nobody — the safe (superset) direction. The **recipient-resolution + preferences** step and the separate
**missed-dose** function are not reproduced here; the **authoritative** arbiter for all branches remains the
producer response counters at execution time.

---

## 5. Deep-review SQL pack (future/manual - narrows the check-13 REVIEW)

**Author-only previews. SELECT-only. No `INSERT` / `UPDATE` / `DELETE` / `cron.*` / `net.http_post`. No raw
token, no secret, no medication name / visitor name / notes / private title (QA marker excepted). Prefer counts
+ redacted identifiers.** Run in the Dashboard during a later approved phase, not now.

```sql
-- DO NOT RUN IN 2F-10F — FUTURE MANUAL MED/VISIT REVIEW ONLY. READ ONLY. (A) Active medication schedules by
-- circle (redacted — NO medication names). Explains the '11' distribution.
select ms.circle_id,
       (ms.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) as is_qa_circle,
       count(*) as active_schedules
from public.medication_schedules ms
join public.medications m on m.id = ms.medication_id
where ms.is_active and m.is_active
group by ms.circle_id
order by is_qa_circle desc, active_schedules desc;
-- Expected: the 11 spread across circles. REVIEW any that sit in the QA circle before enabling cron.
```

```sql
-- DO NOT RUN IN 2F-10F — FUTURE MANUAL MED/VISIT REVIEW ONLY. READ ONLY. (B) Medication schedules that could
-- PLAUSIBLY fire in the next 20-minute producer window, per source/config. Reproduces the medication_due
-- occurrence logic (today+tomorrow circle-local, weekday ∈ days_of_week, date range, time ∈ times, doseAt in
-- [now, now+20m], NOT already logged). Redacted: schedule_id (uuid) + dose_date + scheduled_time only — NO med
-- name/notes. This OVER-approximates (does not re-apply recipient eligibility/prefs) — the safe direction.
with sched as (
  select ms.id as schedule_id, ms.circle_id, ms.days_of_week, ms.times,
         ms.start_date, ms.end_date, cc.timezone as tz
  from public.medication_schedules ms
  join public.medications m on m.id = ms.medication_id
  join public.care_circles cc on cc.id = ms.circle_id
  where ms.is_active and m.is_active
),
days as (
  select s.*, d.ymd as dose_date
  from sched s
  cross join lateral (values
    ((now() at time zone s.tz)::date),
    (((now() + interval '1 day') at time zone s.tz)::date)
  ) as d(ymd)
),
occ as (
  select d.schedule_id, d.circle_id, d.dose_date, t.tm as scheduled_time,
         ((d.dose_date + t.tm) at time zone d.tz) as dose_at
  from days d
  cross join lateral unnest(d.times) as t(tm)
  where extract(dow from d.dose_date)::int = any (d.days_of_week)
    and d.dose_date >= d.start_date
    and (d.end_date is null or d.dose_date <= d.end_date)
)
select o.schedule_id, o.circle_id,
       (o.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) as is_qa_circle,
       o.dose_date, o.scheduled_time
from occ o
where o.dose_at between now() and now() + interval '20 minutes'
  and not exists (
    select 1 from public.medication_logs ml
    where ml.schedule_id = o.schedule_id
      and ml.dose_date = o.dose_date
      and ml.scheduled_time = o.scheduled_time
  )
order by is_qa_circle desc, o.dose_at;
-- Expected during a clean smoke window: 0 rows. Any row -> STOP/REVIEW: a medication_due would co-fire on cron.
```

```sql
-- DO NOT RUN IN 2F-10F — FUTURE MANUAL MED/VISIT REVIEW ONLY. READ ONLY. (C) Recently-created producer
-- notifications by TYPE (dedupe / recent-fire evidence), no private content. If a med_due for an upcoming
-- occurrence already exists, enqueue_notification's (user_id,dedupe_key) guard would dedupe it.
select n.type::text as notif_type, count(*) as rows,
       max(n.created_at) as latest_created_at
from public.notifications n
where n.created_at > now() - interval '48 hours'
group by n.type
order by rows desc;
-- Expected: only the known manual QA task_due activity; NO unexplained recent medication_due / visit_upcoming
-- (cron is off). Any unexplained recent producer notification -> REVIEW.
```

```sql
-- DO NOT RUN IN 2F-10F — FUTURE MANUAL MED/VISIT REVIEW ONLY. READ ONLY. (D) Planned visits grouped by circle +
-- date (redacted — NO visitor names/notes). Explains the '7' distribution.
select v.circle_id,
       (v.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) as is_qa_circle,
       v.visit_date, count(*) as planned_visits
from public.family_visits v
where v.status = 'planned' and v.visit_date is not null
group by v.circle_id, v.visit_date
order by v.visit_date, is_qa_circle desc;
-- Expected: the 7 spread across dates. REVIEW any dated today/near-now, especially in the QA circle.
```

```sql
-- DO NOT RUN IN 2F-10F — FUTURE MANUAL MED/VISIT REVIEW ONLY. READ ONLY. (E) Planned visits that could
-- PLAUSIBLY fire in the visit-reminder window, per source/config: startAt = (visit_date + start_time|09:00)
-- @circle-tz; fires when startAt ∈ [now+60m, now+80m]. Redacted: visit_id (uuid) + date/time only.
select v.id as visit_id, v.circle_id,
       (v.circle_id = 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid) as is_qa_circle,
       v.visit_date, v.start_time
from public.family_visits v
join public.care_circles cc on cc.id = v.circle_id
where v.status = 'planned' and v.visit_date is not null
  and ((v.visit_date + coalesce(v.start_time, time '09:00')) at time zone cc.timezone)
        between now() + interval '60 minutes' and now() + interval '80 minutes'
order by is_qa_circle desc;
-- Expected during a clean smoke window: 0 rows. Any row -> STOP/REVIEW: a visit_upcoming would co-fire on cron.
```

```sql
-- DO NOT RUN IN 2F-10F — FUTURE MANUAL MED/VISIT REVIEW ONLY. READ ONLY. (F) Appointments that could fire in the
-- next producer window (leads 1440 & 60 min). Confirms the '0' scheduled-next-25h scan holds at window edges.
select count(*) as appts_firing_next_window
from public.care_appointments a
where a.status = 'scheduled'
  and ( a.starts_at between now() + interval '1440 minutes' and now() + interval '1460 minutes'
     or a.starts_at between now() + interval '60 minutes'   and now() + interval '80 minutes' );
-- Expected: 0 (consistent with scheduled_appts_next_25h = 0). Any > 0 -> REVIEW.
```

```sql
-- DO NOT RUN IN 2F-10F — FUTURE MANUAL MED/VISIT REVIEW ONLY. READ ONLY. (G) Recent outbox rows by notification
-- TYPE (no private content) — confirms nothing new is queued beyond the known baseline.
select n.type::text as notif_type, o.status::text as outbox_status, count(*) as rows
from public.notification_outbox o
join public.notifications n on n.id = o.notification_id
where o.created_at > now() - interval '48 hours'
group by n.type, o.status
order by rows desc;
-- Expected: only the known baseline rows; NO new pending outbox of any type. Any unexplained row -> REVIEW.
```

No `INSERT` / `UPDATE` / `DELETE` / `cron.schedule` / `cron.unschedule` / `net.http_post` appears in this pack.

---

## 6. Risk decision

- **Can cron proceed now?** **No.** Checks 01-12 are clean, but check 13 (`REVIEW`) leaves it **unknown**
  whether any of the 11 active medication schedules or 7 planned visits would fall inside a producer window
  during the smoke run. Because `enqueue-due-reminders` runs all five branches DB-wide in one invocation,
  enabling cron before resolving this could deliver **unintended** medication/visit pushes to real recipients.
- **What would make cron safe (any one, explicitly recorded):**
  - Deep-review queries **B**, **E**, and **F** each return **0 rows** for the intended smoke window (no
    plausible medication/visit/appointment occurrence is in any producer window during the test), **or**
  - Any in-window medication/visit rows are **explicitly accepted** (understood, QA-owned, or their recipients
    consent to a real reminder), **or**
  - The medication/visit branches are **explicitly excluded** from the smoke run (e.g. a one-shot scheduled
    test constrained so only the `task_due` fixture is in-window, with a supervised, immediately-reversible
    window), **or**
  - Those branches are declared **out of scope** and the smoke run is timed to a window when queries B/E/F are
    empty.
- **In all cases**, the exact future execution plan (fixture creation, cron enable/disable, push, receipt) must
  still be **reviewed and approved separately** before anything runs. This report changes nothing operationally.

---

## 7. Recommendation

**Recommend `2F-10G - med/visit preflight deep-review manual SQL (no cron)`** - the human operator runs the
Section 5 deep-review pack read-only in the Dashboard and pastes the results, so this REVIEW can be resolved to
a confident "nothing else will fire in the smoke window" (or the extra branches are explicitly accepted /
excluded).

- **Do not create a QA fixture.**
- **Do not enable cron.**
- **Do not invoke any Edge Function.**
- **Do not send any push.**

Only after `2F-10G` resolves check 13 should a later, separately-approved execution phase be considered.

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
- **No SQL run by Claude** (the human operator ran the preflight; the Section 5 pack is authored for later
  manual use; Claude executed nothing).
- **No DB connection by Claude.**
- **No deploy.**
- **No Edge invocation** (`enqueue-due-reminders`, `process-notification-outbox`, `check-push-receipts`,
  `check-missed-doses` were not run).
- **No cron enabled / created.**
- **No QA fixture created.**
- **No notification delivery / push.**
- **No env / secrets touched** (`NOTIFICATIONS_CRON_SECRET` / `EXPO_ACCESS_TOKEN` referenced by name only; no
  value read or requested; all UUIDs are user / circle / task / schedule / visit / notification / outbox /
  delivery / token identifiers, not secrets).
- **No raw Expo token exposed** (the token appears only masked as `ExponentPushToken[***]`; `push_token_id` is
  an internal uuid).
- **No commit / no stage.** No other project touched (ThinkMate Chess untouched).

---

## 10. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-07-08-phase-2f-10f-manual-preflight-result-assessment.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```
