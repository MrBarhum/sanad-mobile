# QA seed — operational scoping test data (MANUAL ONLY SQL)

**Baseline commit:** `daed1ef feat(product): add assignment responsibility UI`
**Scope of this report:** A **manual-only**, idempotent SQL seed (+ verification + cleanup) for role-aware operational-scoping QA. **No** code, SQL execution, migration, Supabase CLI, EAS, prebuild, env, dependency, or backend change was made by producing this report — it only **documents** SQL for a human to paste into the Sanad Supabase Dashboard SQL editor.

> ⚠️ **Run nothing automatically.** Every SQL block below is to be **copied and run by hand** in the **correct Sanad project's Supabase Dashboard → SQL editor**, signed in as a privileged Dashboard role (the SQL editor bypasses RLS — that is why manual seeding works). Do **not** run via Supabase CLI. All seed rows carry the `[QA]` prefix so they can be removed with the cleanup script.

---

## 1. Schema findings relevant to seed data

All columns below were taken from the repo migrations **and** `src/types/supabase.ts` (the generated types, which mirror the live DB). Two scoping columns exist in the **live DB / generated types but not** in the committed `create_*` migrations — they were added by a manually-applied migration (the migrations themselves note "applied manually via the Sanad Dashboard, so the CLI migration history may not record it"):

- `care_appointments.assigned_to uuid` → `profiles(id)` — **present in `supabase.ts`** (`care_appointments_assigned_to_fkey`), **absent** from `20260610090100_create_care_appointments.sql`.
- `medications.responsible_user_id uuid` → `profiles(id)` — **present in `supabase.ts`** (`medications_responsible_user_id_fkey`), **absent** from `20260608130000_create_medications.sql`.

Both are relied on by the Phase 2B scoping UI, so the live schema definitely has them. The seed uses them.

### Core identity / membership

| Table | Relevant columns | Notes |
| --- | --- | --- |
| `care_circles` | `id`, `name`, `owner_id`, **`timezone text not null default 'UTC'`** | Circle is selected by `name = 'رعاية الوالد الغالي'`. Scheduled wall-clock times (tasks/doses) are interpreted in **this `timezone`**; appointments are absolute `timestamptz`. |
| `circle_members` | `circle_id`, `user_id`, `role`, `status` | `role` enum `circle_role` = `admin, primary_caregiver, family_member, caregiver, remote_member, elder`. Dummy users already added by the user. |
| `profiles` | `id` (= `auth.users.id`) | All FK assignee/responsible/visitor/created_by columns point at **`profiles(id)`**, created by the `on_auth_user_created` trigger when the auth user was made. |
| `auth.users` | `id`, `email` | Used only to resolve dummy users by email. |

### Operational tables (the ones under test)

| Table | Key columns | Enums / constraints that affect the seed | **Scoping field (family_member)** |
| --- | --- | --- | --- |
| `care_tasks` | `circle_id`, `title`, `description`, `category`, `priority`, `status`, `due_date date`, `due_time time`, `assigned_to`, `created_by`, `completed_by`, `completed_at`, `cancelled_at`, `notes` | `category` = `general,medication,meal,hygiene,movement,errand,appointment,other`; `priority` = `low,normal,high,urgent`; `status` = `open,completed,cancelled`. **CHECK:** `(status='completed') = (completed_at is not null)`; `(status='cancelled') = (cancelled_at is not null)`; `completed_by is null or status='completed'`. (UPDATE trigger `enforce_care_task_collaborator_scope` is **BEFORE UPDATE only** — does not affect INSERT.) | **`assigned_to`** (+ `completed_by` for own history) |
| `care_appointments` | `circle_id`, `title`, `appointment_type`, `starts_at timestamptz not null`, `ends_at timestamptz`, `location`, `doctor_id`, `notes`, `status`, **`assigned_to`**, `created_by` | `appointment_type` = `doctor,lab,pharmacy,therapy,home_care,family,general`; `status` = `scheduled,completed,cancelled`. **CHECK:** `ends_at is null or ends_at >= starts_at`. `doctor_id` left **null** to avoid the cross-circle doctor FK requirement. | **`assigned_to`** |
| `medications` | `circle_id`, `name`, `dosage`, `form`, `instructions`, `with_food bool`, `is_active bool`, **`responsible_user_id`** | No status enum. | **`responsible_user_id`** |
| `medication_schedules` | `circle_id`, `medication_id`, `days_of_week int[]` (0=Sun..6=Sat), `times time[]`, `start_date date`, `end_date date`, `is_active bool`, `notes` | **CHECK:** days non-empty & ⊆ {0..6}; times non-empty; `end_date is null or end_date >= start_date`. Dose surfaces appear only when schedule `is_active`, `start_date <= today`, `end_date` null/≥today, and today's weekday ∈ `days_of_week`. Seed uses **all 7 weekdays** + 3 times so doses always render. | (inherits med's `responsible_user_id`) |
| `medication_logs` | `circle_id`, `medication_id`, `schedule_id`, `dose_date date`, `scheduled_time time`, `status`, `note`, `recorded_by`, `recorded_at` | `status` = `given,missed,postponed`. **Partial UNIQUE** `(schedule_id, dose_date, scheduled_time) where schedule_id is not null`. One "already given" log only. | (the dose's med scoping) |
| `family_visits` | `circle_id`, `visitor_name text not null`, **`visitor_user_id`**, `visit_date date not null`, `start_time time`, `end_time time`, `status`, `notes`, `created_by` | `status` = `planned,completed,cancelled`. **CHECK:** `end_time is null or start_time is null or end_time >= start_time`. | **`visitor_user_id`** |

### How "today" is decided (so seed dates surface correctly)

- **Tasks / visits:** date-only (`due_date` / `visit_date`) compared as calendar dates → seed uses the circle-timezone "today", no ambiguity.
- **Medication doses:** computed client-side from schedules using the **device's local calendar weekday** (`src/features/medications/today.ts`, "no timezone math"). Seed schedules cover **all 7 weekdays**, so a dose always exists for "today" on any device.
- **Appointments:** absolute `timestamptz`. Seed anchors each at **09:00–17:00 in the circle's `timezone`** (a wide margin around local noon). If QA is run on a device whose timezone differs from the circle's by more than a few hours, a near-midnight item's *local date* could shift — run QA on a device near the circle timezone (MENA), which is the intended case.

### Scoping model the seed targets (from the Phase 2B reports)

`scopeToMine = !canManage && canCollaborate`. When true (family_member / activated caregiver), each operational list is filtered to `responsibilityField === auth user id`:

- tasks → `assigned_to` (+ `completed_by` shows own completed history)
- medication doses → `medications.responsible_user_id`
- appointments → `assigned_to`
- visits → `visitor_user_id`

Managers (`admin`, `primary_caregiver`) see/act on everything. Remote (`remote_member`) has `canCollaborate=false` ⇒ **not scoped, sees full read-only lists, zero action affordances** — and is **never** an assignee/responsible/visitor in this seed (product policy: no operational doer items for remote).

> **Note (from report §9):** this scoping is currently **UI-only** (client `Array.filter`). The seed exercises the **UI** behavior. A user calling the API directly would still receive all circle rows until the RLS-hardening pass lands. QA via the app is unaffected.

---

## 2. Exact dummy users used

| Role under test | Email | Used as |
| --- | --- | --- |
| `admin` (circle owner, manager) | `ibrahim.khalifeh91@gmail.com` | `created_by` for all seed rows; sees all |
| `primary_caregiver` (manager) | `sanad.qa.primary1@example.com` | assignee/responsible/visitor on the "primary1" rows; sees all |
| `family_member` (doer) | `sanad.qa.family1@example.com` | assignee/responsible/visitor/completer on the "family1" rows |
| `family_member` (doer) | `sanad.qa.family2@example.com` | assignee/responsible/visitor on the "family2" rows (also the "someone else" negative case for family1) |
| `remote_member` (read-only) | `sanad.qa.remote1@example.com` | **never referenced by any operational row**; verified present so QA can log in |

Password for all dummy users is `123456` (already set on the existing auth users — **not** part of any SQL here).

Circle: **`رعاية الوالد الغالي`**.

---

## 3. Exact manual seed SQL

Paste and run the whole block once. It is **idempotent**: it first deletes any existing `[QA]` rows in this circle, then re-inserts. It **raises and rolls back** if the circle or any required dummy user/profile is missing (so it never silently mis-assigns). It touches **only** `[QA]` rows in the named circle.

```sql
-- =====================================================================
-- Sanad QA seed — operational scoping test data  (MANUAL ONLY)
-- Circle: رعاية الوالد الغالي
-- All rows carry the [QA] prefix. Re-runnable (deletes [QA] rows first).
-- Run in the Sanad Supabase Dashboard SQL editor. DO NOT run via CLI.
-- =====================================================================
do $$
declare
  v_circle_id uuid;
  v_timezone  text;
  v_today     date;
  v_admin     uuid;
  v_primary1  uuid;
  v_family1   uuid;
  v_family2   uuid;
  v_remote1   uuid;
begin
  -- ---- Resolve circle + its timezone-local "today" -------------------
  select cc.id, cc.timezone
    into v_circle_id, v_timezone
  from public.care_circles cc
  where cc.name = 'رعاية الوالد الغالي'
  order by cc.created_at asc
  limit 1;

  if v_circle_id is null then
    raise exception 'QA seed aborted: care circle % not found', 'رعاية الوالد الغالي';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  -- ---- Resolve dummy users (must have BOTH auth row AND profile) -----
  select p.id into v_admin
    from public.profiles p join auth.users u on u.id = p.id
    where lower(u.email) = lower('ibrahim.khalifeh91@gmail.com');
  select p.id into v_primary1
    from public.profiles p join auth.users u on u.id = p.id
    where lower(u.email) = lower('sanad.qa.primary1@example.com');
  select p.id into v_family1
    from public.profiles p join auth.users u on u.id = p.id
    where lower(u.email) = lower('sanad.qa.family1@example.com');
  select p.id into v_family2
    from public.profiles p join auth.users u on u.id = p.id
    where lower(u.email) = lower('sanad.qa.family2@example.com');
  select p.id into v_remote1
    from public.profiles p join auth.users u on u.id = p.id
    where lower(u.email) = lower('sanad.qa.remote1@example.com');

  if v_admin    is null then raise exception 'QA seed aborted: missing profile for %', 'ibrahim.khalifeh91@gmail.com'; end if;
  if v_primary1 is null then raise exception 'QA seed aborted: missing profile for %', 'sanad.qa.primary1@example.com'; end if;
  if v_family1  is null then raise exception 'QA seed aborted: missing profile for %', 'sanad.qa.family1@example.com'; end if;
  if v_family2  is null then raise exception 'QA seed aborted: missing profile for %', 'sanad.qa.family2@example.com'; end if;
  if v_remote1  is null then raise exception 'QA seed aborted: missing profile for %', 'sanad.qa.remote1@example.com'; end if;

  -- ---- Idempotency: remove existing [QA] rows for THIS circle only ---
  delete from public.medication_logs ml
    using public.medications m
   where ml.medication_id = m.id
     and m.circle_id = v_circle_id
     and m.name like '[QA]%';
  delete from public.medication_schedules ms
    using public.medications m
   where ms.medication_id = m.id
     and m.circle_id = v_circle_id
     and m.name like '[QA]%';
  delete from public.medications      where circle_id = v_circle_id and name        like '[QA]%';
  delete from public.care_tasks        where circle_id = v_circle_id and title       like '[QA]%';
  delete from public.care_appointments where circle_id = v_circle_id and title       like '[QA]%';
  delete from public.family_visits     where circle_id = v_circle_id and visitor_name like '[QA]%';

  -- =================================================================
  -- 1) TASKS  (due_date = today, varied time/priority/category)
  -- =================================================================
  insert into public.care_tasks
    (circle_id, title, description, category, priority, status,
     due_date, due_time, assigned_to, created_by, completed_by, completed_at, notes)
  select
    v_circle_id, t.title, t.description,
    t.category::public.care_task_category,
    t.priority::public.care_task_priority,
    t.status::public.care_task_status,
    v_today, t.due_time::time,
    case t.assignee
      when 'family1'  then v_family1
      when 'family2'  then v_family2
      when 'primary1' then v_primary1
      else null end,
    v_admin,
    case when t.status = 'completed' then v_family1 else null end,
    case when t.status = 'completed' then (now() - interval '2 hours') else null end,
    t.notes
  from (values
    -- family1 — multiple open
    ('[QA] إعطاء دواء الصباح للوالد', 'مهمة QA مُسندة إلى family1', 'medication','high',  'open','08:30','family1','[QA] scope:family1'),
    ('[QA] تحضير وجبة الغداء',        'مهمة QA مُسندة إلى family1', 'meal',      'normal','open','12:30','family1','[QA] scope:family1'),
    ('[QA] مرافقة الوالد للمشي',      'مهمة QA مُسندة إلى family1', 'movement',  'low',   'open','17:00','family1','[QA] scope:family1'),
    -- family2 — multiple open (also the negative "someone else" case for family1)
    ('[QA] قياس الضغط مساءً',         'مهمة QA مُسندة إلى family2', 'general',   'normal','open','19:00','family2','[QA] scope:family2'),
    ('[QA] شراء مستلزمات الصيدلية',   'مهمة QA مُسندة إلى family2', 'errand',    'high',  'open','11:00','family2','[QA] scope:family2'),
    ('[QA] ترتيب غرفة النوم',         'مهمة QA مُسندة إلى family2', 'hygiene',   'low',   'open','15:30','family2','[QA] scope:family2'),
    -- primary1 — one or two
    ('[QA] حجز موعد المختبر',         'مهمة QA مُسندة إلى primary1','appointment','normal','open','10:00','primary1','[QA] scope:primary1'),
    ('[QA] مراجعة قائمة الأدوية',     'مهمة QA مُسندة إلى primary1','other',     'high',  'open','09:00','primary1','[QA] scope:primary1'),
    -- unassigned — manager-only visibility
    ('[QA] تنظيف الكرسي المتحرك',     'مهمة QA غير مُسندة',         'hygiene',   'normal','open','13:00', null,    '[QA] scope:unassigned'),
    ('[QA] فحص مخزون الحفاضات',       'مهمة QA غير مُسندة',         'errand',    'low',   'open','14:00', null,    '[QA] scope:unassigned'),
    ('[QA] متابعة فاتورة الرعاية',    'مهمة QA غير مُسندة',         'other',     'normal','open','16:00', null,    '[QA] scope:unassigned'),
    -- completed by family1 (own-history case)
    ('[QA] إعطاء جرعة الإفطار (منجزة)','مهمة QA منجزة بواسطة family1','medication','normal','completed','07:30','family1','[QA] scope:family1 completed')
  ) as t(title, description, category, priority, status, due_time, assignee, notes);

  -- =================================================================
  -- 2) APPOINTMENTS  (absolute timestamptz; anchored to circle tz)
  -- =================================================================
  insert into public.care_appointments
    (circle_id, title, appointment_type, starts_at, ends_at, location, doctor_id, notes, status, assigned_to, created_by)
  select
    v_circle_id, a.title,
    a.appointment_type::public.care_appointment_type,
    (((v_today + a.day_offset) + a.start_time::time) at time zone v_timezone),
    (((v_today + a.day_offset) + a.start_time::time + interval '1 hour') at time zone v_timezone),
    a.location, null, a.notes,
    a.status::public.care_appointment_status,
    case a.assignee
      when 'family1'  then v_family1
      when 'family2'  then v_family2
      when 'primary1' then v_primary1
      else null end,
    v_admin
  from (values
    ('[QA] موعد طبيب القلب',        'doctor',  0,'09:00','عيادة القلب', '[QA] scope:family1',           'scheduled','family1'),
    ('[QA] تحليل دم دوري',          'lab',     0,'13:30','مختبر الرعاية','[QA] scope:family1',           'scheduled','family1'),
    ('[QA] جلسة علاج طبيعي',        'therapy', 0,'10:00','مركز التأهيل', '[QA] scope:family2',           'scheduled','family2'),
    ('[QA] استلام الأدوية (منجز)',  'pharmacy',0,'15:00','الصيدلية',     '[QA] scope:family2 completed', 'completed','family2'),
    ('[QA] زيارة الممرضة المنزلية', 'general', 0,'11:00','المنزل',       '[QA] scope:primary1',          'scheduled','primary1'),
    ('[QA] موعد عام غير مُسند',     'home_care',0,'17:00','المنزل',      '[QA] scope:unassigned',        'scheduled', null),
    ('[QA] لقاء عائلي (غدًا)',      'family',  1,'12:00','المنزل',       '[QA] scope:family1 tomorrow',  'scheduled','family1')
  ) as a(title, appointment_type, day_offset, start_time, location, notes, status, assignee);

  -- =================================================================
  -- 3a) MEDICATIONS  (responsible_user_id scoping)
  -- =================================================================
  insert into public.medications
    (circle_id, name, dosage, form, instructions, with_food, is_active, responsible_user_id)
  select
    v_circle_id, m.name, m.dosage, m.form, m.instructions, m.with_food, true,
    case m.responsible
      when 'family1'  then v_family1
      when 'family2'  then v_family2
      when 'primary1' then v_primary1
      else null end
  from (values
    ('[QA] دواء ميتفورمين',              '500 مجم','قرص',   'مع الطعام صباحًا ومساءً', true,  'family1'),
    ('[QA] دواء أملوديبين',              '5 مجم',  'قرص',   'مرة واحدة صباحًا',         false, 'family1'),
    ('[QA] دواء أتورفاستاتين',           '20 مجم', 'قرص',   'مساءً قبل النوم',          false, 'family2'),
    ('[QA] دواء أسبرين',                 '81 مجم', 'قرص',   'مع الطعام',                true,  'primary1'),
    ('[QA] دواء فيتامين د (غير مُسند)',  '1000 وحدة','كبسولة','يوميًا صباحًا',           false,  null)
  ) as m(name, dosage, form, instructions, with_food, responsible);

  -- 3b) SCHEDULES — one per [QA] med: active, all 7 weekdays, 3 times today.
  insert into public.medication_schedules
    (circle_id, medication_id, days_of_week, times, start_date, end_date, notes, is_active)
  select
    v_circle_id, m.id,
    array[0,1,2,3,4,5,6],
    array['08:00','14:00','20:00']::time[],
    v_today, null, '[QA] جدول جرعات يومي', true
  from public.medications m
  where m.circle_id = v_circle_id
    and m.name like '[QA]%';

  -- 3c) DOSE LOG — single "already given" case for a family1 med (08:00 dose).
  insert into public.medication_logs
    (circle_id, medication_id, schedule_id, dose_date, scheduled_time, status, note, recorded_by, recorded_at)
  select
    v_circle_id, m.id, s.id, v_today, time '08:00', 'given',
    '[QA] جرعة مسجلة مسبقًا', v_family1, now()
  from public.medications m
  join public.medication_schedules s
    on s.medication_id = m.id and s.circle_id = v_circle_id
  where m.circle_id = v_circle_id
    and m.name = '[QA] دواء ميتفورمين'
  limit 1;

  -- =================================================================
  -- 4) VISITS  (visitor_user_id linking)
  -- =================================================================
  insert into public.family_visits
    (circle_id, visitor_name, visitor_user_id, visit_date, start_time, end_time, status, notes, created_by)
  select
    v_circle_id, vi.visitor_name,
    case vi.visitor
      when 'family1'  then v_family1
      when 'family2'  then v_family2
      when 'primary1' then v_primary1
      else null end,
    (v_today + vi.day_offset), vi.start_time::time, vi.end_time::time,
    vi.status::public.family_visit_status, vi.notes, v_admin
  from (values
    ('[QA] زيارة فاميلي1',               'family1', 0,'16:00','17:00','planned','[QA] scope:family1'),
    ('[QA] زيارة فاميلي2',               'family2', 0,'18:00','19:00','planned','[QA] scope:family2'),
    ('[QA] زيارة بريمري1',               'primary1',0,'11:00','12:00','planned','[QA] scope:primary1'),
    ('[QA] زيارة بدون حساب (غير مرتبطة)', null,      0,'14:00','15:00','planned','[QA] scope:unlinked'),
    ('[QA] زيارة فاميلي1 (غدًا)',         'family1', 1,'10:00','11:00','planned','[QA] scope:family1 tomorrow')
  ) as vi(visitor_name, visitor, day_offset, start_time, end_time, status, notes);

  raise notice 'QA seed complete. circle=% tz=% today=% | tasks=12 appts=7 meds=5 schedules=5 dose_logs=1 visits=5',
    v_circle_id, v_timezone, v_today;
end
$$;
```

**Seed totals:** 12 tasks · 7 appointments · 5 medications (+ 5 daily 3-time schedules ⇒ 15 dose cards/day) · 1 dose log (given) · 5 visits.

---

## 4. Exact manual verification SQL

Run **after** the seed. Each query returns a result set grouped by the responsible user (joined to `auth.users.email`). `(unassigned)` / `(unlinked)` = the manager-only rows.

```sql
-- 0) Preflight / sanity: circle resolves, timezone, local "today", and all 5 users.
select cc.id as circle_id, cc.name, cc.timezone,
       (now() at time zone cc.timezone)::date as today_local
from public.care_circles cc
where cc.name = 'رعاية الوالد الغالي';

select u.email, p.id as profile_id, cm.role, cm.status
from auth.users u
join public.profiles p on p.id = u.id
left join public.circle_members cm
  on cm.user_id = u.id
 and cm.circle_id = (select id from public.care_circles
                     where name = 'رعاية الوالد الغالي' order by created_at limit 1)
where lower(u.email) in (
  'ibrahim.khalifeh91@gmail.com','sanad.qa.primary1@example.com',
  'sanad.qa.family1@example.com','sanad.qa.family2@example.com','sanad.qa.remote1@example.com')
order by u.email;

-- 1) TASKS by assignee + status
select coalesce(u.email,'(unassigned)') as assignee, t.status, count(*) as n
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
left join auth.users u on u.id = t.assigned_to
where cc.name = 'رعاية الوالد الغالي' and t.title like '[QA]%'
group by 1,2 order by 1,2;

-- 1b) TASKS — completed_by (own-history case should show family1)
select u.email as completed_by, t.title, t.status, t.completed_at
from public.care_tasks t
join public.care_circles cc on cc.id = t.circle_id
left join auth.users u on u.id = t.completed_by
where cc.name = 'رعاية الوالد الغالي' and t.title like '[QA]%' and t.status = 'completed';

-- 2) APPOINTMENTS by assignee (with local start time)
select coalesce(u.email,'(unassigned)') as assignee, a.status,
       (a.starts_at at time zone cc.timezone) as starts_local, a.title
from public.care_appointments a
join public.care_circles cc on cc.id = a.circle_id
left join auth.users u on u.id = a.assigned_to
where cc.name = 'رعاية الوالد الغالي' and a.title like '[QA]%'
order by 1, a.starts_at;

-- 3) MEDICATIONS by responsible
select coalesce(u.email,'(unassigned)') as responsible, m.name, m.is_active
from public.medications m
join public.care_circles cc on cc.id = m.circle_id
left join auth.users u on u.id = m.responsible_user_id
where cc.name = 'رعاية الوالد الغالي' and m.name like '[QA]%'
order by 1,2;

-- 3b) Today's dose surface = active [QA] schedules × times, by responsible
select coalesce(u.email,'(unassigned)') as responsible, m.name,
       s.times, s.days_of_week, s.start_date, s.is_active
from public.medication_schedules s
join public.medications m on m.id = s.medication_id
join public.care_circles cc on cc.id = m.circle_id
left join auth.users u on u.id = m.responsible_user_id
where cc.name = 'رعاية الوالد الغالي' and m.name like '[QA]%'
order by 1,2;

-- 3c) Dose logs (the single "given" case)
select u.email as recorded_by, m.name, ml.dose_date, ml.scheduled_time, ml.status
from public.medication_logs ml
join public.medications m on m.id = ml.medication_id
join public.care_circles cc on cc.id = ml.circle_id
left join auth.users u on u.id = ml.recorded_by
where cc.name = 'رعاية الوالد الغالي' and m.name like '[QA]%'
order by m.name, ml.scheduled_time;

-- 4) VISITS by visitor link
select coalesce(u.email,'(unlinked)') as visitor, v.visit_date, v.status, v.visitor_name
from public.family_visits v
join public.care_circles cc on cc.id = v.circle_id
left join auth.users u on u.id = v.visitor_user_id
where cc.name = 'رعاية الوالد الغالي' and v.visitor_name like '[QA]%'
order by 1, v.visit_date;

-- 5) Grand totals per entity (sanity vs. expected 12/7/5/5/1/5)
select '[QA] tasks'        as entity, count(*) from public.care_tasks t
  join public.care_circles cc on cc.id=t.circle_id
  where cc.name='رعاية الوالد الغالي' and t.title like '[QA]%'
union all
select '[QA] appointments', count(*) from public.care_appointments a
  join public.care_circles cc on cc.id=a.circle_id
  where cc.name='رعاية الوالد الغالي' and a.title like '[QA]%'
union all
select '[QA] medications', count(*) from public.medications m
  join public.care_circles cc on cc.id=m.circle_id
  where cc.name='رعاية الوالد الغالي' and m.name like '[QA]%'
union all
select '[QA] schedules', count(*) from public.medication_schedules s
  join public.medications m on m.id=s.medication_id
  join public.care_circles cc on cc.id=m.circle_id
  where cc.name='رعاية الوالد الغالي' and m.name like '[QA]%'
union all
select '[QA] dose_logs', count(*) from public.medication_logs ml
  join public.medications m on m.id=ml.medication_id
  join public.care_circles cc on cc.id=ml.circle_id
  where cc.name='رعاية الوالد الغالي' and m.name like '[QA]%'
union all
select '[QA] visits', count(*) from public.family_visits v
  join public.care_circles cc on cc.id=v.circle_id
  where cc.name='رعاية الوالد الغالي' and v.visitor_name like '[QA]%';
```

Expected totals: tasks **12**, appointments **7**, medications **5**, schedules **5**, dose_logs **1**, visits **5**.

---

## 5. Exact manual cleanup SQL

Removes **only** `[QA]`-prefixed rows in the named circle. Non-QA / real care data is never matched. Safe to run repeatedly.

```sql
-- =====================================================================
-- Sanad QA cleanup — removes ONLY [QA] seed rows in رعاية الوالد الغالي
-- =====================================================================
do $$
declare
  v_circle_id uuid;
begin
  select cc.id into v_circle_id
  from public.care_circles cc
  where cc.name = 'رعاية الوالد الغالي'
  order by cc.created_at asc
  limit 1;

  if v_circle_id is null then
    raise exception 'QA cleanup aborted: care circle % not found', 'رعاية الوالد الغالي';
  end if;

  -- children first (also covered by ON DELETE CASCADE from medications, explicit for clarity)
  delete from public.medication_logs ml
    using public.medications m
   where ml.medication_id = m.id
     and m.circle_id = v_circle_id
     and m.name like '[QA]%';
  delete from public.medication_schedules ms
    using public.medications m
   where ms.medication_id = m.id
     and m.circle_id = v_circle_id
     and m.name like '[QA]%';

  delete from public.medications      where circle_id = v_circle_id and name         like '[QA]%';
  delete from public.care_tasks        where circle_id = v_circle_id and title        like '[QA]%';
  delete from public.care_appointments where circle_id = v_circle_id and title        like '[QA]%';
  delete from public.family_visits     where circle_id = v_circle_id and visitor_name like '[QA]%';

  raise notice 'QA cleanup complete for circle %.', v_circle_id;
end
$$;
```

---

## 6. What each role should see after seeding

> All "seen" numbers are the **app-list** (scoped UI) view. The catalog **"كل الأدوية" / All-medications** tab is reference data and stays visible to everyone (report §6) — only the operational **dose** surface is scoped.

### `admin` (`ibrahim.khalifeh91@gmail.com`) — manager, sees & acts on all
- **Tasks:** all **12** (3 family1 + 3 family2 + 2 primary1 + 3 unassigned + 1 completed). Full add/edit/status/delete.
- **Appointments:** all **7** (incl. unassigned + tomorrow + the completed one).
- **Medications/doses:** all **5** meds; **15** dose cards today (incl. the unassigned vitamin D); the metformin 08:00 shows **given**; can register any.
- **Visits:** all **5** (incl. the unlinked one).

### `primary_caregiver` (`sanad.qa.primary1@example.com`) — manager, identical to admin
- Sees & can act on **everything** above. (Also happens to be the assignee/responsible/visitor on the "primary1" rows, but that does not restrict the manager view.)

### `family_member` (`sanad.qa.family1@example.com`) — doer, scoped to self
- **Tasks:** **4** → 3 open assigned to family1 **+** 1 completed-by-family1 (history). **Must NOT** see family2's, primary1's, or any unassigned task. Can complete/cancel only their own assigned tasks.
- **Medication doses:** only meds where `responsible_user_id = family1` → **ميتفورمين + أملوديبين** → **6** dose cards today; **ميتفورمين 08:00 = given**. **No** register button on others; the unassigned vitamin D and family2/primary1 doses are **not shown**.
- **Appointments:** **2** today (طبيب القلب 09:00, تحليل دم 13:30) + **1** tomorrow (لقاء عائلي). Home today-count = **2**.
- **Visits:** **2** linked (زيارة فاميلي1 today + tomorrow).
- **Negative checks:** `[QA] قياس الضغط مساءً` (task, family2), `[QA] جلسة علاج طبيعي` (appt, family2), `[QA] دواء أتورفاستاتين` doses (family2), `[QA] زيارة فاميلي2` (visit, family2) **must not appear**.

### `family_member` (`sanad.qa.family2@example.com`) — doer, scoped to self
- **Tasks:** **3** open assigned to family2. No completed-history row (none completed by them).
- **Medication doses:** only **أتورفاستاتين** → **3** dose cards today; none given.
- **Appointments:** **1** scheduled today (علاج طبيعي 10:00) + **1** completed (استلام الأدوية 15:00, shows on the completed tab). Home today scheduled-count = **1**.
- **Visits:** **1** linked (زيارة فاميلي2 today).
- **Negative checks:** all family1 / primary1 / unassigned items **must not appear**.

### `remote_member` (`sanad.qa.remote1@example.com`) — read-only
- **Not scoped** (current behavior, report §3/§7/§8): sees the **full read-only lists** — all 12 tasks, 7 appointments, 15 dose cards, 5 visits — but with **zero action affordances**: no task complete/cancel circle, no dose register button, no appointment/visit add/edit/status.
- **Never an operational doer:** no `[QA]` row has remote1 as `assigned_to` / `responsible_user_id` / `visitor_user_id` (product policy). Verify by scanning the verification queries — remote1's email must not appear in any "by assignee/responsible/visitor" grouping.

---

## 7. Warnings

- **Run manually only**, in the **correct Sanad project's Supabase Dashboard → SQL editor**. Double-check you are on the intended project (the live one with these dummy users) before running.
- **Do NOT run the Supabase CLI**, do not run migrations, do not `db push`, do not prebuild, do not run EAS. These scripts are paste-and-run in the Dashboard.
- All seed rows use the **`[QA]`** prefix (`title` / `name` / `visitor_name`, plus `[QA]` in notes). The cleanup script keys off exactly that prefix + the circle id, so it can never remove real care data.
- The seed is **scoped to the circle `رعاية الوالد الغالي`** and **rolls back** (raises) if the circle or any dummy user/profile is missing — it will not silently mis-assign or create orphan rows.
- The dose surface depends on the **device local weekday**; schedules cover all 7 days, so this is robust. **Appointments** are anchored to **09:00–17:00 in the circle timezone** — run QA on a device near that timezone (MENA) so "today" matches.
- This scoping is currently **UI-only** (report §9); the seed validates the **app** behavior, not server-side RLS. A direct API caller would still receive all circle rows until the RLS-hardening pass lands.
- The SQL editor runs with RLS bypassed, so inserts succeed regardless of the policies — that is expected for manual seeding and does **not** change any policy.

---

## 8. Confirmation — no code / Supabase / backend / env / dependency / EAS changes

Producing this report:
- **Did NOT** modify any app source code, types, locales, or config. The only filesystem write is **this markdown report** under `docs/claude-reports/`.
- **Did NOT** run any SQL, connect to Supabase, or use the Supabase CLI; **did NOT** create/alter/apply any migration, RLS policy, function, or Edge Function.
- **Did NOT** read or modify `.env` / secrets; **did NOT** touch `package.json` / dependencies / native / Expo config.
- **Did NOT** run EAS or prebuild; **did NOT** build, stage, or commit anything.
- **Did NOT** touch ThinkMate Chess or any project other than `E:\Projects\sanad-mobile`. The uncommitted Phase 2B hotfix / strict-scoping working-tree changes and their two reports were **left untouched**.

---

## 9. Git status & diff (after writing this report)

The only delta vs. the pre-existing working tree is this new untracked report file. Nothing staged, nothing committed.

`git --no-pager status --short`:

```
 M src/app/(app)/appointments/index.tsx
 M src/features/appointments/figma-appointments.tsx
 M src/features/care-circle/figma-home.tsx
 M src/features/medications/figma-medications.tsx
 M src/features/medications/today.ts
 M src/features/tasks/figma-tasks.tsx
 M src/features/tasks/task-editor.tsx
 M src/features/visits/figma-visits.tsx
 M src/locales/ar.json
 M src/locales/en.json
?? docs/claude-reports/2026-06-26-phase-2b-strict-operational-scoping.md
?? docs/claude-reports/2026-06-26-phase-2b-task-action-ux-hotfix.md
?? docs/claude-reports/2026-06-26-qa-seed-operational-data-sql.md
```

`git --no-pager diff --stat` (the pre-existing Phase 2B working-tree changes only — **none of these were touched by this report**; new untracked files do not appear in `diff --stat`):

```
 src/app/(app)/appointments/index.tsx             |   6 +-
 src/features/appointments/figma-appointments.tsx |  14 +-
 src/features/care-circle/figma-home.tsx          |  30 ++-
 src/features/medications/figma-medications.tsx   |  21 +-
 src/features/medications/today.ts                |   4 +
 src/features/tasks/figma-tasks.tsx               | 281 ++++++++++++++++-------
 src/features/tasks/task-editor.tsx               |  54 +++--
 src/features/visits/figma-visits.tsx             |  12 +-
 src/locales/ar.json                              |  11 +-
 src/locales/en.json                              |  11 +-
 10 files changed, 322 insertions(+), 122 deletions(-)
```
