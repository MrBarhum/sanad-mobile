# Step 2.0 — Medications, Schedules, Today's Doses & Dose Logging

Date: 2026-06-08
Branch: `master`
Status: Implemented locally. **Requires manual SQL in the Sanad Supabase Dashboard before the medication screens work.** Not committed.

---

## Summary

This slice builds the medication core as a real functional feature:

1. **Medications** — manage the recipient's medications (name, dosage, form, instructions, with-food). Create with a first schedule, edit, and **deactivate** (preferred over delete; hard delete is available in the manager-only edit screen).
2. **Schedules** — weekday + multiple-times schedules per medication, with start/end dates and notes. Add / edit / deactivate / delete from the medication detail screen.
3. **Today's doses** — a deterministic, well-typed client computation combines active medications, active schedules, and the day's logs into a sorted dose list.
4. **Dose logging** — confirm a dose as **given**, **missed**, or **postponed**; changing a recorded dose updates the existing log. Available to any caregiving role.
5. **Home dashboard** — the medications card now navigates to `/medications` and shows a live today summary (total / given / remaining).

Everything is Arabic-first and RTL-friendly. Out of scope (not added): push notifications, AI extraction, inventory/refills, payments, OTP, invitations. The UI states clearly that the app records family-provided schedules/reminders only and gives no medical advice.

---

## Migration files created (local only — NOT pushed, idempotent)

- `supabase/migrations/20260608130000_create_medications.sql`
- `supabase/migrations/20260608130100_create_medication_schedules.sql`
- `supabase/migrations/20260608130200_create_medication_logs.sql`

No `supabase` CLI commands were run (no `db push`, `link`, `login`, `logout`, account change). Apply manually (SQL below).

---

## Exact SQL to run manually in the Sanad Supabase Dashboard → SQL Editor

Paste and run this whole block (concatenation of the three migration files). It reuses the existing `public.set_updated_at()` trigger function and the `public.is_circle_member` / `public.has_circle_role` helpers — **no existing objects are modified**.

**This SQL is idempotent and safe to re-run.** Tables/indexes use `create ... if not exists`; the enum is created inside a `duplicate_object`-guarded `DO` block (Postgres has no `create type if not exists`); every trigger/policy is dropped (`drop ... if exists`) before being recreated; and the `medication_schedules` CHECK constraints are added via `DO` blocks that first test `pg_constraint` (no bare, non-re-runnable `ALTER TABLE ADD CONSTRAINT`). Run order matters (schedules reference medications; logs reference both) — keep the blocks in the order below.

```sql
-- =========================================================
-- 1) medications
-- =========================================================
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null,
  dosage text,
  form text,
  instructions text,
  with_food boolean not null default false,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medications_circle_id_idx on public.medications (circle_id);
create index if not exists medications_circle_active_idx
  on public.medications (circle_id) where is_active;

drop trigger if exists medications_set_updated_at on public.medications;
create trigger medications_set_updated_at
before update on public.medications
for each row execute function public.set_updated_at();

alter table public.medications enable row level security;

drop policy if exists "Members can view medications" on public.medications;
create policy "Members can view medications"
on public.medications for select to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Managers can add medications" on public.medications;
create policy "Managers can add medications"
on public.medications for insert to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Managers can update medications" on public.medications;
create policy "Managers can update medications"
on public.medications for update to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Managers can delete medications" on public.medications;
create policy "Managers can delete medications"
on public.medications for delete to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- =========================================================
-- 2) medication_schedules
--    days_of_week: 0 = Sunday .. 6 = Saturday (JS Date.getDay()).
-- =========================================================
create table if not exists public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  days_of_week int[] not null default array[0, 1, 2, 3, 4, 5, 6],
  times time[] not null,
  start_date date not null default current_date,
  end_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medication_schedules_circle_id_idx
  on public.medication_schedules (circle_id);
create index if not exists medication_schedules_medication_id_idx
  on public.medication_schedules (medication_id);

-- Data-integrity CHECK constraints, added idempotently (guarded on pg_constraint).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and conname = 'medication_schedules_days_nonempty'
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_days_nonempty
      check (coalesce(array_length(days_of_week, 1), 0) >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and conname = 'medication_schedules_days_range'
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_days_range
      check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and conname = 'medication_schedules_times_nonempty'
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_times_nonempty
      check (coalesce(array_length(times, 1), 0) >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and conname = 'medication_schedules_date_range'
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_date_range
      check (end_date is null or end_date >= start_date);
  end if;
end
$$;

drop trigger if exists medication_schedules_set_updated_at on public.medication_schedules;
create trigger medication_schedules_set_updated_at
before update on public.medication_schedules
for each row execute function public.set_updated_at();

alter table public.medication_schedules enable row level security;

drop policy if exists "Members can view medication schedules" on public.medication_schedules;
create policy "Members can view medication schedules"
on public.medication_schedules for select to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Managers can add medication schedules" on public.medication_schedules;
create policy "Managers can add medication schedules"
on public.medication_schedules for insert to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and exists (
    select 1 from public.medications m
    where m.id = medication_id and m.circle_id = circle_id
  )
);

drop policy if exists "Managers can update medication schedules" on public.medication_schedules;
create policy "Managers can update medication schedules"
on public.medication_schedules for update to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and exists (
    select 1 from public.medications m
    where m.id = medication_id and m.circle_id = circle_id
  )
);

drop policy if exists "Managers can delete medication schedules" on public.medication_schedules;
create policy "Managers can delete medication schedules"
on public.medication_schedules for delete to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- =========================================================
-- 3) medication_logs (+ enum medication_log_status)
-- =========================================================
do $$
begin
  create type public.medication_log_status as enum ('given', 'missed', 'postponed');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  schedule_id uuid references public.medication_schedules(id) on delete set null,
  dose_date date not null,
  scheduled_time time not null,
  status public.medication_log_status not null,
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medication_logs_circle_id_idx on public.medication_logs (circle_id);
create index if not exists medication_logs_circle_date_idx
  on public.medication_logs (circle_id, dose_date);
create index if not exists medication_logs_medication_id_idx
  on public.medication_logs (medication_id);
create unique index if not exists medication_logs_scheduled_dose_unique
  on public.medication_logs (schedule_id, dose_date, scheduled_time)
  where schedule_id is not null;

drop trigger if exists medication_logs_set_updated_at on public.medication_logs;
create trigger medication_logs_set_updated_at
before update on public.medication_logs
for each row execute function public.set_updated_at();

alter table public.medication_logs enable row level security;

drop policy if exists "Members can view medication logs" on public.medication_logs;
create policy "Members can view medication logs"
on public.medication_logs for select to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Caregivers can add medication logs" on public.medication_logs;
create policy "Caregivers can add medication logs"
on public.medication_logs for insert to authenticated
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
  and exists (
    select 1 from public.medications m
    where m.id = medication_id and m.circle_id = circle_id
  )
  and (
    schedule_id is null
    or exists (
      select 1 from public.medication_schedules s
      where s.id = schedule_id and s.circle_id = circle_id and s.medication_id = medication_id
    )
  )
);

drop policy if exists "Caregivers can update medication logs" on public.medication_logs;
create policy "Caregivers can update medication logs"
on public.medication_logs for update to authenticated
using (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
)
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'family_member', 'caregiver']::public.circle_role[]
  )
  and exists (
    select 1 from public.medications m
    where m.id = medication_id and m.circle_id = circle_id
  )
  and (
    schedule_id is null
    or exists (
      select 1 from public.medication_schedules s
      where s.id = schedule_id and s.circle_id = circle_id and s.medication_id = medication_id
    )
  )
);

drop policy if exists "Managers can delete medication logs" on public.medication_logs;
create policy "Managers can delete medication logs"
on public.medication_logs for delete to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
```

---

## Tables / RLS policies added

| Table | SELECT | INSERT / UPDATE | DELETE |
| --- | --- | --- | --- |
| `medications` | active members | admin, primary_caregiver | admin, primary_caregiver |
| `medication_schedules` | active members | admin, primary_caregiver | admin, primary_caregiver |
| `medication_logs` | active members | admin, primary_caregiver, **family_member, caregiver** | admin, primary_caregiver |

- Enum `public.medication_log_status` = `given | missed | postponed`.
- `updated_at` triggers on all three (reusing `set_updated_at()`).
- Indexes: `circle_id` on all; partial active index on medications; `medication_id` on schedules/logs; `(circle_id, dose_date)` on logs; **partial unique** `(schedule_id, dose_date, scheduled_time) where schedule_id is not null` to prevent duplicate scheduled-dose logs.
- No anonymous access (all policies are `to authenticated`); existing helpers used; no RLS bypass.
- **Cross-circle integrity (RLS `with check`):** `medication_schedules` INSERT/UPDATE require the referenced `medication_id` to be in the same `circle_id`; `medication_logs` INSERT/UPDATE require `medication_id` in the same circle and, when `schedule_id` is not null, that schedule to be in the same circle **and** belong to the same medication. These are plain `exists(...)` subqueries (RLS-applied, not bypassed). SELECT stays active-members; DELETE stays manager-only.
- **CHECK constraints on `medication_schedules`** (added via idempotent `pg_constraint`-guarded `DO` blocks): `days_nonempty` (≥1 weekday), `days_range` (`days_of_week <@ array[0..6]`), `times_nonempty` (≥1 time), `date_range` (`end_date is null or end_date >= start_date`).

---

## Client / data-access changes

New feature module `src/features/medications/`:
- `api.ts` — typed reads (`fetchActiveMedications`, `fetchMedication`, `fetchActiveSchedules`, `fetchSchedulesByMedication`, `fetchLogsForDate`) and writes (`createMedicationWithSchedule`, `updateMedication`, `setMedicationActive`, `deleteMedication`, `createSchedule`, `updateSchedule`, `setScheduleActive`, `deleteSchedule`, `insertLog`, `updateLogStatus`, `deleteLog`). `createMedicationWithSchedule` deletes the new medication if the schedule insert fails (no client transaction).
- `today.ts` — pure `computeDoseItems(...)` and `summarizeDoses(...)`.
- `schema.ts` — zod `medicationSchema` and `scheduleSchema` (HH:MM time regex, ≥1 day, ≥1 time, end ≥ start).
- `hooks.ts` — TanStack Query hooks + `useTodayDoses`, `useTodayDoseSummary`, `useLogDose`. Medication/schedule mutations invalidate all medication queries; dose logging invalidates only that date's logs.
- `schedule-fields.tsx` (+ `prepareSchedule`, drafts), `medication-form.tsx`, `medications-center.tsx`, `medication-editor.tsx`, `schedule-modal-host.tsx`.

Shared/care-circle changes:
- `src/features/care-circle/hooks.ts` — added `canLogDoses(role)` helper + `canLogDoses` on `ActiveCircle`.
- `src/utils/date.ts` — added `todayYmd()`, `dayOfWeekFromYmd()`, `formatHm()`.
- `src/components/form-field.tsx` — `label` is now optional (so it can back inline rows like the times list).

### Manual type changes (no gen types run)
`src/types/supabase.ts` was hand-edited to add the `medications`, `medication_schedules`, `medication_logs` tables (Row/Insert/Update/Relationships), the `medication_log_status` enum, and its `Constants.public.Enums` entry. Notable shapes (matching expected generated output): `days_of_week: number[]`, `times: string[]`, dates/times as `string`, `status` referencing the enum. Re-run `supabase gen types` later to confirm parity.

---

## UI / screens added

Nested stack `src/app/(app)/medications/` (registered in `(app)/_layout.tsx` with its header hidden so the nested stack owns headers):
- `/medications` — center: family-data disclaimer, "add medication" (managers), **today's doses** (each dose shows time, name, dosage/form, with-food, instructions, status badge, and given/postponed/missed buttons for caregiving roles), and the **active medication list** (tap → detail). Empty states for no doses / no medications.
- `/medications/new` — add medication + first schedule (managers only; others see a notice).
- `/medications/[id]` — edit medication, activate/deactivate, manage schedules (add/edit/deactivate/delete), and delete medication (inline confirm). Read-only for non-managers.

Home dashboard: medications card is now navigable and shows today's total/given/remaining (or "no doses today").

---

## Commands run

| Command | Result |
| --- | --- |
| `node -e "JSON.parse(ar.json/en.json)"` | OK — both locales parse |
| idempotency `grep` audit of the 3 migrations | All `create table/index` guarded; enum in `DO` block; trigger/policy drops == creates |
| `npx tsc --noEmit` | **Exit 0 — no type errors** |
| `npx expo export --platform web` | **Exit 0 — 32 static routes** incl. `/medications`, `/medications/new`, `/medications/[id]` |
| `git status --short` / `git diff --stat` | See below |

No `supabase` CLI commands; no commit.

### TypeScript result
`npx tsc --noEmit` → exit 0 (clean).

### Web export result
`npx expo export --platform web` → exit 0. Static rendering produced all routes, including the dynamic `/medications/[id]`. (`dist/` is git-ignored and was removed after validation.)

---

## Manual test instructions

1. **Apply the SQL** above in the Sanad Dashboard → SQL Editor (one-time).
2. **Refresh the web app** (`npm run web`, signed in as the circle owner = admin).
3. Open **Home → Medications** card.
4. Tap **add medication** (إضافة دواء): name + dosage, pick weekdays, add **at least two times** (e.g. `08:00`, `20:00`), save.
5. In **today's doses**, **confirm one dose** as given (أُعطيت) → green badge appears.
6. **Mark another dose** as postponed (مؤجَّلة) or missed (لم تُعطَ).
7. Open the medication (tap its list row) and **edit** a field; save.
8. **Deactivate** the medication (إيقاف) → it leaves the active list and today's doses.
9. **Reload** the page → confirm the data persists.
10. In Supabase, check rows exist in `medications`, `medication_schedules`, `medication_logs` (one log per confirmed dose; re-confirming the same dose updates the same row).

Before the SQL is applied, the medication screens render but show a load error; auth, onboarding, and the other care features are unaffected.

---

## Known risks / assumptions

- **SQL must be applied first.** Without it the medication screens show "تعذّر تحميل الأدوية"; nothing crashes.
- **Local-time assumption (documented).** Today's date and weekday come from the device's local clock; there is no timezone handling. A dose's "today" follows the device, and dates are compared as `YYYY-MM-DD` strings.
- **Hand-written types.** Re-run `supabase gen types` when convenient to confirm parity with the migration.
- **Dose logging is insert-or-update by the matched log id** from the day's logs query; the partial unique index is the server-side safety net. Two devices confirming the *same* dose at the exact same moment could rarely hit a unique violation on insert (surfaces as a generic save error) — acceptable for a family app.
- **Create medication + schedule is two inserts** (no client transaction) with best-effort cleanup. If the cleanup delete itself failed after a schedule-insert failure, a medication without a schedule could remain; it's editable from the detail screen.
- **Time storage:** times entered as `HH:MM` are stored as `HH:MM:00`; the dose computation and log matching use the DB string form consistently. Editing a schedule's time does not rewrite that day's already-recorded logs (old log keyed to the previous time stays).
- **`recorded_by`** is set by the client to the current user; RLS does not force it to `auth.uid()`.
- **Deactivation** hides medications/schedules from the active list and today's doses; historical logs are retained.
- **Static export** includes `/medications/[id]` as a client-rendered dynamic route (no `generateStaticParams`); deep-linking a specific id on static hosting needs SPA fallback. Fine for runtime/SPA.

---

## Git status summary

Modified (tracked):
```
 src/app/(app)/_layout.tsx                     (register medications group)
 src/components/form-field.tsx                 (optional label)
 src/features/care-circle/circle-dashboard.tsx (medications card + today summary)
 src/features/care-circle/hooks.ts             (canLogDoses + ActiveCircle field)
 src/locales/ar.json, src/locales/en.json      (medications keys + common.yes/no)
 src/types/supabase.ts                         (3 tables + enum + Constants)
 src/utils/date.ts                             (todayYmd, dayOfWeekFromYmd, formatHm)
```
New (untracked):
```
 supabase/migrations/20260608130000_create_medications.sql
 supabase/migrations/20260608130100_create_medication_schedules.sql
 supabase/migrations/20260608130200_create_medication_logs.sql
 src/features/medications/ (api, today, schema, hooks, schedule-fields,
   medication-form, medications-center, medication-editor, schedule-modal-host)
 src/app/(app)/medications/ (_layout, index, new, [id])
```
`git diff --stat`: 8 tracked files changed, 449 insertions(+), 9 deletions(-) (excludes new untracked files).

---

## Is this slice safe to commit after manual SQL + test?

**Yes.** It compiles (`tsc` clean), the web build succeeds, and it is self-contained: existing auth/onboarding/care features are untouched, and the only hard dependency is the manual SQL (without which the new screens degrade to a load-error state). Recommended order: apply the SQL in the Dashboard, run the manual tests above, then commit migrations + app code together. Per instructions, I did **not** commit.
