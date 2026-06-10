# Step 4.0 — Daily care logs + vital readings + system-wide date/time pickers

**Date:** 2026-06-10
**Status:** Implemented locally. Not committed. Remote SQL must be applied manually in the Sanad Supabase Dashboard.

---

## 1. Summary

This slice adds the **daily observation layer** to Sanad and standardizes date/time entry across the whole app:

- **Daily care logs** (`daily_care_logs`) — family/caregiver daily observations: mood, sleep quality, appetite, hydration, a 0–10 pain level, mobility, and four free-text note fields. Several members can log the same day; a single member can file only one log per date.
- **Vital readings** (`vital_readings`) — family-recorded measurements (blood pressure, heart rate, temperature, blood sugar, oxygen saturation, weight, other). The app **records and formats** values only — it never interprets, flags, or judges them as normal/abnormal.
- **Dashboard summaries** — new Home cards for today's daily-log count (+ latest mood) and today's/total vitals count.
- **System-wide date/time picker UX** — new reusable `DateField` / `TimeField` / `DateTimeField` components (web = native `<input type="date|time">`; native = a touch-friendly scrollable picker sheet). Every user-facing date/time field across the app now uses them — no more manual `YYYY-MM-DD` / `HH:MM` typing.

Roles mirror the existing RLS helpers (`is_circle_member`, `has_circle_role`). Data access uses the existing typed Supabase client and TanStack Query with proper invalidation.

A 4-agent adversarial review was run after implementation; the findings it surfaced were fixed (see §11) or documented as known minor items.

---

## 2. Files created

### Migrations (local only — apply manually)
- `supabase/migrations/20260610100000_create_daily_care_logs.sql`
- `supabase/migrations/20260610100100_create_vital_readings.sql`

### Reusable date/time components
- `src/components/date-time-shared.ts` — shared prop types + pure helpers (parse/format/clamp).
- `src/components/picker-sheet.tsx` — native modal chrome (`PickerSheet`) + scrollable `WheelColumn`.
- `src/components/date-field.tsx` (native) / `src/components/date-field.web.tsx` (web `<input type="date">`).
- `src/components/time-field.tsx` (native) / `src/components/time-field.web.tsx` (web `<input type="time">`).
- `src/components/date-time-field.tsx` — composes Date + Time for instant fields.

### Daily-logs feature
- `src/features/daily-logs/api.ts`, `hooks.ts`, `schema.ts`
- `src/features/daily-logs/log-fields.tsx` (shared fieldset + draft + `prepareDailyLog` + pain stepper)
- `src/features/daily-logs/describe.ts` (read-only label/value rows)
- `src/features/daily-logs/daily-logs-center.tsx`, `log-form.tsx`, `log-editor.tsx`, `daily-logs-card.tsx`
- Routes: `src/app/(app)/daily-logs/_layout.tsx`, `index.tsx`, `new.tsx`, `[id].tsx`

### Vitals feature
- `src/features/vitals/api.ts`, `hooks.ts`, `schema.ts`
- `src/features/vitals/vital-fields.tsx` (shared fieldset + draft + `prepareVital`)
- `src/features/vitals/describe.ts` (`formatVitalValue`)
- `src/features/vitals/vitals-center.tsx`, `vital-form.tsx`, `vital-editor.tsx`, `vitals-card.tsx`
- Routes: `src/app/(app)/vitals/_layout.tsx`, `index.tsx`, `new.tsx`, `[id].tsx`

### Report
- `docs/claude-reports/2026-06-10-step-4-0-daily-logs-vitals-date-time-pickers.md` (this file)

## 3. Files modified

- `src/types/supabase.ts` — manually added `daily_care_logs` + `vital_readings` tables, 6 new enums, and `Constants` arrays.
- `src/features/care-activity/today.ts` — `summarizeTodayLogs`, `summarizeVitals` (+ types).
- `src/features/care-circle/circle-dashboard.tsx` — render `DailyLogsCard` + `VitalsCard`.
- `src/app/(app)/_layout.tsx` — register `daily-logs` + `vitals` stacks (`headerShown:false`).
- Date/time picker conversion (manual inputs → `DateField`/`TimeField`):
  - `src/features/tasks/task-form.tsx`, `src/features/tasks/task-editor.tsx`
  - `src/features/appointments/appointment-fields.tsx`
  - `src/features/visits/visit-fields.tsx`
  - `src/features/medications/schedule-fields.tsx` (dose times + start/end date)
  - `src/features/recipient-profile/profile-form.tsx` (birth date, read-only for non-managers)
  - `src/features/care-circle/onboarding-form.tsx` (optional birth date)
- `src/locales/ar.json`, `src/locales/en.json` — `dailyLogs`, `vitals`, `pickers` namespaces + dashboard card strings.

---

## 4. Migration files created

Two idempotent migrations (timestamps follow the existing `20260610090200` family). They were **not** applied via the CLI. Apply them manually (§5).

---

## 5. Exact SQL to run manually in the Sanad Supabase Dashboard

Open **Dashboard → SQL Editor**, paste each block, run. **Run A before B** (A defines the `circle_role`-based pattern that B mirrors; both depend only on the existing core schema). Both are safe to re-run.

### A) `daily_care_logs`

```sql
-- Daily care logs for a care circle (step 4.0).
do $$
begin
  create type public.daily_mood as enum (
    'great', 'good', 'okay', 'sad', 'anxious', 'angry', 'confused', 'tired'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.sleep_quality as enum ('good', 'fair', 'poor', 'unknown');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.appetite_level as enum ('good', 'normal', 'low', 'none', 'unknown');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.hydration_level as enum ('good', 'normal', 'low', 'unknown');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.mobility_level as enum (
    'normal', 'limited', 'needs_help', 'bedbound', 'unknown'
  );
exception
  when duplicate_object then null;
end
$$;

-- Membership helper: explicit params avoid the ambiguous-unqualified-column trap
-- an inline RLS subquery would hit (`cm.circle_id = circle_id` binding to the inner
-- circle_members table). SECURITY DEFINER + empty search_path; any-status membership.
create or replace function public.is_user_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
  );
$$;

revoke all on function public.is_user_circle_member(uuid, uuid) from public;
grant execute on function public.is_user_circle_member(uuid, uuid) to authenticated;

create table if not exists public.daily_care_logs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  log_date date not null default current_date,
  mood public.daily_mood,
  sleep_quality public.sleep_quality,
  appetite public.appetite_level,
  hydration public.hydration_level,
  pain_level int,
  mobility public.mobility_level,
  bathroom_notes text,
  food_notes text,
  activity_notes text,
  general_notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_care_logs_circle_id_idx on public.daily_care_logs (circle_id);
create index if not exists daily_care_logs_circle_date_idx
  on public.daily_care_logs (circle_id, log_date);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.daily_care_logs'::regclass
      and conname = 'daily_care_logs_pain_level_range'
  ) then
    alter table public.daily_care_logs
      add constraint daily_care_logs_pain_level_range
      check (pain_level is null or (pain_level >= 0 and pain_level <= 10));
  end if;
end
$$;

create unique index if not exists daily_care_logs_one_per_author_per_day
  on public.daily_care_logs (circle_id, log_date, recorded_by)
  where recorded_by is not null;

drop trigger if exists daily_care_logs_set_updated_at on public.daily_care_logs;
create trigger daily_care_logs_set_updated_at
before update on public.daily_care_logs
for each row execute function public.set_updated_at();

alter table public.daily_care_logs enable row level security;

drop policy if exists "Members can view daily logs" on public.daily_care_logs;
create policy "Members can view daily logs"
on public.daily_care_logs
for select
to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Members can add daily logs" on public.daily_care_logs;
create policy "Members can add daily logs"
on public.daily_care_logs
for insert
to authenticated
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
);

drop policy if exists "Managers can add anonymous daily logs" on public.daily_care_logs;
create policy "Managers can add anonymous daily logs"
on public.daily_care_logs
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and recorded_by is null
);

drop policy if exists "Managers can update daily logs" on public.daily_care_logs;
create policy "Managers can update daily logs"
on public.daily_care_logs
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (recorded_by is null or public.is_user_circle_member(circle_id, recorded_by))
);

drop policy if exists "Members can update own daily logs" on public.daily_care_logs;
create policy "Members can update own daily logs"
on public.daily_care_logs
for update
to authenticated
using (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
)
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
);

drop policy if exists "Managers can delete daily logs" on public.daily_care_logs;
create policy "Managers can delete daily logs"
on public.daily_care_logs
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Members can delete own daily logs" on public.daily_care_logs;
create policy "Members can delete own daily logs"
on public.daily_care_logs
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and recorded_by = auth.uid()
);
```

### B) `vital_readings`

```sql
-- Vital readings for a care circle (step 4.0).
do $$
begin
  create type public.vital_reading_type as enum (
    'blood_pressure', 'heart_rate', 'temperature', 'blood_sugar',
    'oxygen_saturation', 'weight', 'other'
  );
exception
  when duplicate_object then null;
end
$$;

-- Same membership helper as block A (create or replace is idempotent; defined here
-- too so block B is self-contained). Explicit params avoid the ambiguous-column trap.
create or replace function public.is_user_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
  );
$$;

revoke all on function public.is_user_circle_member(uuid, uuid) from public;
grant execute on function public.is_user_circle_member(uuid, uuid) to authenticated;

create table if not exists public.vital_readings (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  reading_at timestamptz not null default now(),
  reading_type public.vital_reading_type not null,
  systolic int,
  diastolic int,
  numeric_value numeric,
  unit text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vital_readings_circle_id_idx on public.vital_readings (circle_id);
create index if not exists vital_readings_circle_reading_at_idx
  on public.vital_readings (circle_id, reading_at);
create index if not exists vital_readings_reading_type_idx on public.vital_readings (reading_type);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_bp_pair'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_bp_pair
      check (
        reading_type <> 'blood_pressure'
        or (systolic is not null and diastolic is not null)
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_measured_value'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_measured_value
      check (
        reading_type in ('blood_pressure', 'other')
        or numeric_value is not null
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_systolic_positive'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_systolic_positive
      check (systolic is null or systolic > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_diastolic_positive'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_diastolic_positive
      check (diastolic is null or diastolic > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vital_readings'::regclass
      and conname = 'vital_readings_numeric_value_positive'
  ) then
    alter table public.vital_readings
      add constraint vital_readings_numeric_value_positive
      check (numeric_value is null or numeric_value > 0);
  end if;
end
$$;

drop trigger if exists vital_readings_set_updated_at on public.vital_readings;
create trigger vital_readings_set_updated_at
before update on public.vital_readings
for each row execute function public.set_updated_at();

alter table public.vital_readings enable row level security;

drop policy if exists "Members can view vital readings" on public.vital_readings;
create policy "Members can view vital readings"
on public.vital_readings
for select
to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Members can add vital readings" on public.vital_readings;
create policy "Members can add vital readings"
on public.vital_readings
for insert
to authenticated
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
);

drop policy if exists "Managers can add anonymous vital readings" on public.vital_readings;
create policy "Managers can add anonymous vital readings"
on public.vital_readings
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and recorded_by is null
);

drop policy if exists "Managers can update vital readings" on public.vital_readings;
create policy "Managers can update vital readings"
on public.vital_readings
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (recorded_by is null or public.is_user_circle_member(circle_id, recorded_by))
);

drop policy if exists "Members can update own vital readings" on public.vital_readings;
create policy "Members can update own vital readings"
on public.vital_readings
for update
to authenticated
using (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
)
with check (
  public.has_circle_role(
    circle_id,
    array['admin', 'primary_caregiver', 'caregiver', 'family_member']::public.circle_role[]
  )
  and recorded_by = auth.uid()
);

drop policy if exists "Managers can delete vital readings" on public.vital_readings;
create policy "Managers can delete vital readings"
on public.vital_readings
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Members can delete own vital readings" on public.vital_readings;
create policy "Members can delete own vital readings"
on public.vital_readings
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and recorded_by = auth.uid()
);
```

> The blocks above are verbatim copies of the two migration files (sans the leading documentation comments). The files remain the source of truth.

---

## 6. Confirmation: SQL is idempotent / safe to re-run

Both migrations follow the established Sanad pattern and can be pasted repeatedly with no error and no duplicate objects:

- **Enums** — created inside `do $$ … exception when duplicate_object then null; end $$;` guards (Postgres has no `create type if not exists`).
- **Tables / indexes** — `create table if not exists`, `create index if not exists`, `create unique index if not exists`.
- **CHECK constraints** — added only inside `pg_constraint`-guarded `DO` blocks (`if not exists (select 1 from pg_constraint where conname = …)`).
- **Triggers / policies** — `drop … if exists` immediately before each `create`.
- **Helper function** — `public.is_user_circle_member(uuid, uuid)` uses `create or replace function` with re-asserted `revoke all … from public` / `grant execute … to authenticated`, so re-running redefines it identically. It is defined in both migration blocks so each is self-contained / order-independent.
- **No data writes**, no `drop table`, no destructive statements. Re-running only re-asserts schema, the helper function, and policies.

Helpers reused (already present in `20260607033000_initial_core_schema`): `public.set_updated_at()`, `public.is_circle_member(circle_id)`, `public.has_circle_role(circle_id, roles[])`.

---

## 7. Tables / RLS policies added

### `daily_care_logs`
- Columns per spec; `pain_level` CHECK `null or 0..10`; **partial unique index** `(circle_id, log_date, recorded_by) where recorded_by is not null` (multiple members may log the same day; a single member may not duplicate their own date). Indexes on `circle_id` and `(circle_id, log_date)`. `updated_at` trigger.
- Policies (all `TO authenticated`, **7 per table**): **SELECT** active members; **INSERT (members)** `admin/primary_caregiver/caregiver/family_member` with `recorded_by = auth.uid()` (self only); **INSERT (managers, anonymous)** admin/primary with `recorded_by is null`; **UPDATE (managers)** admin/primary on any row, author validated via `public.is_user_circle_member(circle_id, recorded_by)`; **UPDATE (own)** caregiving roles where `recorded_by = auth.uid()`; **DELETE (managers)** admin/primary; **DELETE (own)** caregiver/family where `recorded_by = auth.uid()`.

### `vital_readings`
- Columns per spec; CHECKs: BP requires `systolic`+`diastolic`; non-BP/non-`other` requires `numeric_value`; positivity guards on `systolic`/`diastolic`/`numeric_value` (no upper bounds — no medical-range judgement). Indexes on `circle_id`, `(circle_id, reading_at)`, `reading_type`. `updated_at` trigger.
- Policies mirror `daily_care_logs` exactly (**7 policies**, same role gating).

### Helper
- `public.is_user_circle_member(p_circle_id, p_user_id)` — SECURITY DEFINER, `stable`, `search_path = ''`, `revoke all from public` + `grant execute to authenticated`. Any-status membership test used by the manager-UPDATE author check on both tables (see §8).

No anonymous (unauthenticated) access anywhere; RLS enabled on both tables. (Only admins / primary caregivers may insert a row with `recorded_by null` — an *unattributed* record, still authenticated.)

---

## 8. Cross-circle integrity checks

- **`circle_id` gates every row** — all reads/writes are scoped by `is_circle_member` / `has_circle_role(circle_id, …)`, and the client always supplies `circle_id` from the resolved active circle (`CircleGate`), never from user input.
- **`recorded_by` cannot cross circles** — the member INSERT `with check` requires `recorded_by = auth.uid()`, and `auth.uid()` only passes `has_circle_role` for the row's own circle, so a member can attribute a record only to themselves within their circle. A separate admin/primary-only policy permits anonymous (`recorded_by null`) inserts.
- **Manager edits** — `with check` requires `recorded_by` to be null or, via `public.is_user_circle_member(circle_id, recorded_by)`, a member of the row's circle (any status, so a record authored by a since-removed member is still editable; cross-circle authors stay blocked). Passing the circle + user as **explicit function parameters** avoids the ambiguous-unqualified-column hazard an inline subquery would have: in `cm.circle_id = circle_id`, the bare `circle_id` binds to the inner `circle_members` table (which has that column), silently turning the guard into a near-tautology. The helper's parameter names make the predicate unambiguous.
- **FK `on delete set null`** on `recorded_by → profiles` keeps history intact if a profile is deleted; `on delete cascade` on `circle_id → care_circles` removes a circle's records with it.

---

## 9. Client / data-access changes

- New feature modules `src/features/daily-logs` and `src/features/vitals` follow the existing `api.ts` / `hooks.ts` / `schema.ts` + UI convention, using the typed `supabase` client and TanStack Query.
- **Daily logs:** list (newest day first), today's logs, create (sets `recorded_by = user.id`), update own, delete; `useTodayLogSummary` for the dashboard. Enum selects map "unset" → `null`; pain via a 0–10 stepper; `log_date` validated as a real `YYYY-MM-DD`.
- **Vitals:** list (newest first), today's readings, create/update/delete; `useTodayVitalSummary`. Validation matches the DB CHECKs — BP requires positive-int systolic+diastolic (capped to int4 / 3 digits) and stores `numeric_value = null`; other measured types require a positive numeric value; `other` allows a notes-only record. `reading_at` is a combined date+time ISO instant.
- Every mutation invalidates the feature's root query key; detail/list keys are consistent. The dashboard summaries reuse the list queries, so they refresh on mutation.
- `src/features/care-activity/today.ts` gained `summarizeTodayLogs` and `summarizeVitals` (pure, deterministic, local-calendar — consistent with the existing today/medication assumption).

---

## 10. UI / screens added & date/time picker changes

### Screens / routes
- `/daily-logs` (center), `/daily-logs/new`, `/daily-logs/[id]` (view/edit/delete).
- `/vitals` (center), `/vitals/new`, `/vitals/[id]` (view/edit/delete).
- Dashboard: `DailyLogsCard` (today's log count + latest mood) and `VitalsCard` (today / total) added alongside the existing medications/tasks/appointments/visits/emergency cards — all of which are unchanged.
- Empty states, clear errors, Arabic-first RTL, touch-friendly. **Disclaimers** on both centers and both forms state that entries are family-recorded records, not diagnosis or medical advice (vitals additionally: the app does not interpret values). **No** value is ever colored or labeled normal/abnormal.

### System-wide date/time pickers
- New `DateField` / `TimeField` / `DateTimeField` with one consistent API. They **store/emit the exact formats the app + DB already expect** (`YYYY-MM-DD`, 24-hour `HH:MM`, or `''` when cleared), so all existing zod schemas (`isValidYmd` / `isValidHm`) keep validating unchanged.
  - **Web:** real `<input type="date">` / `<input type="time">` → the browser's native, accessible picker; value format already matches storage (no conversion).
  - **Native:** a tap-to-open modal sheet with scrollable Year/Month/Day and Hour/Minute columns (auto-scrolls to the current value; day column clamps to days-in-month). No new dependency. `@expo/ui`'s `community/datetime-picker` was evaluated and rejected — its web build is a no-op (`return null`), which would break the web picker requirement.
- Manual text inputs replaced everywhere: **tasks** due date/time, **appointments** date/start/end, **visits** date/start/end, **medication schedule** dose times + start/end date, **recipient** birth date (read-only for non-managers), **onboarding** birth date, plus the new **daily-log** date and **vitals** date/time. Required fields are not clearable; optional ones expose a Clear action.

---

## 11. Adversarial review & fixes applied

A 4-agent review (DB/RLS, client↔RLS alignment, picker correctness, spec/i18n completeness) ran post-implementation. DB/RLS and spec/i18n came back clean. Fixes applied:

1. **(medium) Duplicate same-day log → confusing error.** The partial unique index rejects a second log by the same author for a date (Postgres `23505`). The create form now detects `23505` and shows a specific message (`dailyLogs.errors.alreadyLoggedToday`, ar+en) instead of the generic "save failed".
2. **(low) Manager edit of a since-removed author's record.** The manager-UPDATE `with check` author test was relaxed from "active member" to "member of this circle (any status)" on both tables — still cross-circle safe, but no longer rejects a manager editing a record whose author was later removed.
3. **(low) int4 overflow on systolic/diastolic.** `toPositiveInt` now rejects values above `2147483647`, and the BP inputs have `maxLength={3}`, so an out-of-range entry is caught client-side instead of failing as a server `22003`.

**Documented, not fixed (cosmetic):** some now-unused locale strings (e.g. `*.placeholders.dueDate = "YYYY-MM-DD"`) remain in `ar.json`/`en.json`. They are no longer referenced by any component (the pickers don't use them), so they are dead config — left in place to avoid churn/parity risk; safe to prune later.

### 11.1 RLS hardening pass (pre-apply)

A final RLS hardening pass on the two migrations before manual apply (SQL only — no app code change required, since the client already always inserts `recorded_by = the current user`):

- **Ambiguous-column fix.** Added `public.is_user_circle_member(p_circle_id uuid, p_user_id uuid)` (SECURITY DEFINER, `language sql`, `stable`, `set search_path = ''`, `revoke all … from public`, `grant execute … to authenticated`, any-status membership) and use it for the manager-UPDATE author check on both tables. The previous **inline** subquery `… where cm.user_id = recorded_by and cm.circle_id = circle_id` was subtly wrong: the bare `circle_id` resolves to the inner `circle_members` column, so the cross-circle author guard degenerated to a near-tautology. Passing the circle + user as explicit parameters removes the ambiguity. (The first-pass review had mis-read this as correct; this pass corrects it.)
- **Hardened INSERT.** Normal caregiving members may now insert **only self-attributed** rows (`recorded_by = auth.uid()`). A separate admin/primary-only policy (`Managers can add anonymous …`) permits `recorded_by null` inserts. Previously any caregiving role could insert an anonymous row.
- **`is_active_user_circle_member` not added.** No policy needs an active-only membership test of an arbitrary user: the existing `has_circle_role` already gates the *caller* as active, and only the *author* check is needed (which must be any-status, so a removed author's record stays editable). The helper is easy to add later if a future policy requires it.
- Policy count went 6 → **7 per table** (the added manager-anonymous INSERT). Still re-runnable: function via `create or replace`, policies dropped-then-created.

---

## 12. Commands run

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | **Pass** (exit 0), before and after review fixes |
| locale JSON parse + ar/en key-parity check (node) | **Pass** — `ar 541 / en 541`, no missing keys either side |
| `npx expo export --platform web` | **Success** (exit 0); route tree includes `/daily-logs`, `/daily-logs/new`, `/daily-logs/[id]`, `/vitals`, `/vitals/new`, `/vitals/[id]`. Build artifacts (`dist/`) were removed afterward. |
| `git status --short` / `git diff --stat` | Captured (§14). **No commit made.** |

- **TypeScript result:** clean (`tsc --noEmit` exit 0), including the hand-written `supabase.ts` types and the web `<input>` variants (`lib: ["DOM","ESNext"]` from `expo/tsconfig.base`).
- **Web export result:** clean — confirms all new components and routes bundle, and the web date/time variants compile.

---

## 13. Manual test instructions

> Supabase is shared; nothing was pushed. **First apply the SQL manually.**

1. **Apply SQL** — paste §5 block A then block B into the Sanad Dashboard SQL Editor and run each.
2. **Refresh the app** (restart Metro / reload web).
3. **Daily log — create:** open **Daily logs** card → **Add log**. The date defaults to today via the picker. Set mood/sleep/appetite/hydration, tap a pain number, set mobility, add notes. Save → appears under "Today's logs".
4. **Daily log — edit:** open the log → change a field → Save (shows "Changes saved").
5. **Daily log — duplicate guard:** as the same user, try **Add log** for today again → you should see "You already have a log for this date…" (not a generic error).
6. **Vitals — create two readings:**
   - **Blood pressure:** type = Blood pressure → enter systolic + diastolic (unit prefilled `mmHg`) → set date/time via pickers → Save. Card shows e.g. `120/80 mmHg`.
   - **Temperature** (or **Blood sugar**): type = Temperature → enter value (e.g. `37.5`), unit prefilled `°C` → Save.
7. **Vitals — edit:** open a reading → change the value or time → Save.
8. **Delete:** delete one of your own readings/logs (two-step confirm) → it disappears.
9. **Dashboard summaries:** return Home → the **Daily logs** card shows today's count (+ latest mood) and the **Vitals** card shows today/total.
10. **Date/time pickers everywhere** — confirm a calendar/scroll date picker and a time picker appear (no manual `YYYY-MM-DD`/`HH:MM` typing) in: **tasks** (due date/time), **appointments** (date/start/end), **visits** (date/start/end), **medications** (schedule dose times + start/end date), **daily logs** (date), **vitals** (date/time), and **recipient profile** birth date. On web these are the browser's native date/time inputs; on native they are the scrollable picker sheet.

---

## 14. Git status summary

No commit made. Working tree:

**Modified (13):** `src/app/(app)/_layout.tsx`, `src/features/appointments/appointment-fields.tsx`, `src/features/care-activity/today.ts`, `src/features/care-circle/circle-dashboard.tsx`, `src/features/care-circle/onboarding-form.tsx`, `src/features/medications/schedule-fields.tsx`, `src/features/recipient-profile/profile-form.tsx`, `src/features/tasks/task-editor.tsx`, `src/features/tasks/task-form.tsx`, `src/features/visits/visit-fields.tsx`, `src/locales/ar.json`, `src/locales/en.json`, `src/types/supabase.ts`.

**New (untracked):** `supabase/migrations/20260610100000_create_daily_care_logs.sql`, `supabase/migrations/20260610100100_create_vital_readings.sql`, `src/components/{date-time-shared.ts, picker-sheet.tsx, date-field.tsx, date-field.web.tsx, time-field.tsx, time-field.web.tsx, date-time-field.tsx}`, `src/features/daily-logs/*`, `src/features/vitals/*`, `src/app/(app)/daily-logs/*`, `src/app/(app)/vitals/*`, and this report.

---

## 15. Known risks / assumptions

- **Local-time calendar.** All date/time math uses the device's local calendar (no timezone conversion), consistent with the existing medication/today assumption. `reading_at` is stored as a `timestamptz` instant.
- **Manual SQL is required.** The TypeScript types in `supabase.ts` were hand-written to match the migrations; if you later regenerate types, confirm parity. The app will throw on queries to `daily_care_logs` / `vital_readings` until the SQL is applied.
- **Native picker is custom (dependency-free).** It was verified by `tsc` + web export and by code review, but **not run on a physical iOS/Android device** in this session. The web inputs were exercised via the web export. Recommend a quick device smoke test of the scroll picker before release.
- **Vitals constraints are intentionally loose** (presence + positivity only). The app records and formats values; it never interprets ranges — by design and per spec.
- **Dead locale strings** (§11) remain; cosmetic only.

---

## 16. Is this slice safe to commit?

**Yes — after applying the SQL (§5) and running the manual tests (§13).** Code-side it is self-contained, type-checks, exports for web, and keeps existing validation intact; the new tables are additive and RLS-gated. Recommended commit boundary: the two migration files + the new components/features/routes + the modified files listed in §14. Per instructions, **no commit was made.**
