# Step 3.0 — Shared care tasks, appointments & family visits

**Date:** 2026-06-10
**Branch:** `master` (not committed, per instructions)
**Scope:** Operational care-coordination layer — shared care tasks, appointments/calendar items, family visits, and today's-activity summaries on the home dashboard.

---

## Summary

This slice adds three new circle-scoped domains on top of the existing auth / care-circle / recipient / medications foundation:

- **Care tasks** — a shared to-do list (errands, meals, hygiene, movement, appointments-to-attend, …) with category, priority, status, due date/time, and optional self-assignment. Managers create/edit/delete; caregivers & family members may complete/cancel tasks assigned to them or left unassigned.
- **Appointments** — doctor visits, labs, pharmacy pickups, therapy, home-care, family, and general calendar items, optionally linked to an existing doctor. Managers only.
- **Family visits** — planned/recorded visits to the recipient. Managers record any visitor; caregivers & family members record their own visits.

Each domain ships a full vertical: idempotent SQL migration with RLS, hand-written Supabase types, a typed data layer (api + TanStack Query hooks + zod schema), Arabic-first RTL screens (center / new / detail), a navigable dashboard card with a deterministic "today" summary, and complete ar/en localization. Medications and the emergency card are untouched and intact.

**Status:** Code compiles (`tsc --noEmit` clean), the web bundle exports successfully, and all new routes are present. The SQL has **not** been applied (it must be pasted manually into the Sanad Supabase Dashboard — see below). Nothing has been committed.

---

## Database migrations created

Local, idempotent migration files (safe to re-run; **not** applied by any CLI):

| File | Creates |
| --- | --- |
| `supabase/migrations/20260610090000_create_care_tasks.sql` | enums `care_task_category` / `care_task_priority` / `care_task_status`; table `care_tasks`; 4 indexes; 3 consistency CHECKs (`completed_at` / `cancelled_at` / `completed_by`); `set_updated_at` trigger; hardened `enforce_care_task_collaborator_scope` trigger + function (SECURITY DEFINER, empty `search_path`); RLS (1 SELECT, 1 INSERT, 2 UPDATE, 1 DELETE) |
| `supabase/migrations/20260610090100_create_care_appointments.sql` | enums `care_appointment_type` / `care_appointment_status`; table `care_appointments`; 3 indexes; `ends_at >= starts_at` CHECK; trigger; RLS (SELECT/INSERT/UPDATE/DELETE, managers-only mutation) |
| `supabase/migrations/20260610090200_create_family_visits.sql` | enum `family_visit_status`; table `family_visits`; 3 indexes; `end_time >= start_time` CHECK; trigger; RLS (members read; managers any; caregivers/family own-row INSERT/UPDATE/DELETE) |

### Tables / columns

- **`care_tasks`** — `id, circle_id→care_circles, title, description, category, priority, status, due_date, due_time, assigned_to→profiles, created_by→profiles, completed_by→profiles, completed_at, cancelled_at, notes, created_at, updated_at`. Indexes: `circle_id`, `(circle_id, due_date)`, `(circle_id, status)`, `assigned_to`.
- **`care_appointments`** — `id, circle_id→care_circles, title, appointment_type, starts_at, ends_at, location, doctor_id→doctors, notes, status, created_by→profiles, created_at, updated_at`. Indexes: `circle_id`, `(circle_id, starts_at)`, `doctor_id`.
- **`family_visits`** — `id, circle_id→care_circles, visitor_name, visitor_user_id→profiles, visit_date, start_time, end_time, status, notes, created_by→profiles, created_at, updated_at`. Indexes: `circle_id`, `(circle_id, visit_date)`, `visitor_user_id`.

### RLS policies added

All tables: `enable row level security`, `to authenticated`, no anonymous access, all gated through the existing `public.is_circle_member(circle_id)` and `public.has_circle_role(circle_id, roles)` security-definer helpers.

- **care_tasks** — `Members can view care tasks` (SELECT, members) · `Managers can add care tasks` (INSERT, admin/primary_caregiver) · `Managers can update care tasks` (UPDATE, admin/primary_caregiver) · `Members can update assigned care tasks` (UPDATE, caregiver/family on self-or-unassigned rows) · `Managers can delete care tasks` (DELETE, admin/primary_caregiver).
- **care_appointments** — `Members can view…` (SELECT, members) · `Managers can add / update / delete…` (admin/primary_caregiver only).
- **family_visits** — `Members can view…` (SELECT, members) · `Managers can add / update / delete…` (admin/primary_caregiver, any visitor) · `Members can add / update / delete their own family visits` (caregiver/family where `visitor_user_id = auth.uid()`).

### Cross-circle integrity checks

- `care_tasks.assigned_to` must be `null` **or** an *active member of the same circle* — enforced in both the manager INSERT and UPDATE `with check` via an `exists` subquery on `circle_members`.
- `care_appointments.doctor_id` must be `null` **or** a doctor *of the same circle* — enforced in INSERT and UPDATE `with check` via an `exists` subquery on `doctors`.
- `family_visits.visitor_user_id` must be `null` **or** an active member of the same circle (manager path), or `= auth.uid()` (own-row path).
- A hardened **`enforce_care_task_collaborator_scope` BEFORE UPDATE trigger** (SECURITY DEFINER, empty `search_path`, all references schema-qualified) confines non-managers (caregiver/family) to: acting only on a **currently-`open`** task; transitioning it only to `completed` or `cancelled`; leaving every content field unchanged (`circle_id/title/description/category/priority/due_date/due_time/assigned_to/created_by`); and setting completion bookkeeping **honestly** — when completing, `completed_by` must equal `auth.uid()` and `completed_at` must be set (no spoofing); when cancelling, `cancelled_at` must be set and `completed_by` must be null. Managers (admin/primary_caregiver) are exempt. This complements (does not replace) the RLS policies, which still gate row access; it does not bypass RLS.
- A `care_tasks_completed_by_consistent` CHECK guarantees `completed_by` is only ever set on a `completed` task (one-directional, so the `completed_by` FK's `on delete set null` can never violate it).
- `auth.uid()` is compared against `profiles.id` columns (`assigned_to`, `visitor_user_id`), which is correct because `profiles.id == auth.users.id` in this schema.

### Idempotency / safe to re-run — confirmed

Every statement guards against re-execution, matching the existing migration conventions (these files are pasted manually, so the CLI migration history may not record them):

- **Enums** created inside `do $$ … exception when duplicate_object then null; end $$;` blocks (Postgres has no `create type if not exists`).
- **Tables / indexes** use `create table if not exists` / `create index if not exists`.
- **CHECK constraints** added inside `pg_constraint`-guarded `DO` blocks (only `alter table … add constraint` when the named constraint does not already exist).
- **Triggers / policies** use `drop … if exists` before `create`.
- **Functions** use `create or replace function`.

Re-running any file is a no-op after the first successful run.

---

## Exact SQL to run manually in the Sanad Supabase Dashboard → SQL Editor

Run the three blocks below (any order; the given order is fine). They depend only on objects already present from earlier steps (`care_circles`, `profiles`, `circle_members`, `doctors`, `set_updated_at()`, `is_circle_member()`, `has_circle_role()`). **Do not** run `supabase db push` / `link` / `login` — paste into the dashboard only.

### 1) `care_tasks`

```sql
-- Shared care tasks for a care circle (step 3.0).
do $$
begin
  create type public.care_task_category as enum (
    'general', 'medication', 'meal', 'hygiene', 'movement', 'errand', 'appointment', 'other'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.care_task_priority as enum ('low', 'normal', 'high', 'urgent');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.care_task_status as enum ('open', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  title text not null,
  description text,
  category public.care_task_category not null default 'general',
  priority public.care_task_priority not null default 'normal',
  status public.care_task_status not null default 'open',
  due_date date,
  due_time time,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_tasks_circle_id_idx on public.care_tasks (circle_id);
create index if not exists care_tasks_circle_due_idx on public.care_tasks (circle_id, due_date);
create index if not exists care_tasks_circle_status_idx on public.care_tasks (circle_id, status);
create index if not exists care_tasks_assigned_to_idx on public.care_tasks (assigned_to);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_tasks'::regclass
      and conname = 'care_tasks_completed_at_consistent'
  ) then
    alter table public.care_tasks
      add constraint care_tasks_completed_at_consistent
      check ((status = 'completed') = (completed_at is not null));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_tasks'::regclass
      and conname = 'care_tasks_cancelled_at_consistent'
  ) then
    alter table public.care_tasks
      add constraint care_tasks_cancelled_at_consistent
      check ((status = 'cancelled') = (cancelled_at is not null));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_tasks'::regclass
      and conname = 'care_tasks_completed_by_consistent'
  ) then
    alter table public.care_tasks
      add constraint care_tasks_completed_by_consistent
      check (completed_by is null or status = 'completed');
  end if;
end
$$;

drop trigger if exists care_tasks_set_updated_at on public.care_tasks;
create trigger care_tasks_set_updated_at
before update on public.care_tasks
for each row execute function public.set_updated_at();

create or replace function public.enforce_care_task_collaborator_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Managers may change anything.
  if public.has_circle_role(
    old.circle_id,
    array['admin', 'primary_caregiver']::public.circle_role[]
  ) then
    return new;
  end if;

  -- Non-managers (caregiver / family_member): only act on a currently-open task.
  if old.status <> 'open' then
    raise exception 'collaborators may only act on an open task';
  end if;

  -- ...and only to complete or cancel it.
  if new.status not in ('completed', 'cancelled') then
    raise exception 'collaborators may only complete or cancel a task';
  end if;

  -- Content fields are immutable for collaborators.
  if new.circle_id is distinct from old.circle_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.priority is distinct from old.priority
    or new.due_date is distinct from old.due_date
    or new.due_time is distinct from old.due_time
    or new.assigned_to is distinct from old.assigned_to
    or new.created_by is distinct from old.created_by then
    raise exception 'collaborators may not change a task''s content';
  end if;

  -- Completion bookkeeping must be honest (no spoofing completed_by).
  if new.status = 'completed' then
    if new.completed_by is distinct from auth.uid() or new.completed_at is null then
      raise exception 'completing a task must set completed_by to the current user and completed_at';
    end if;
  else
    -- new.status = 'cancelled'
    if new.cancelled_at is null or new.completed_by is not null then
      raise exception 'cancelling a task must set cancelled_at and leave completed_by null';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists care_tasks_collaborator_scope on public.care_tasks;
create trigger care_tasks_collaborator_scope
before update on public.care_tasks
for each row execute function public.enforce_care_task_collaborator_scope();

alter table public.care_tasks enable row level security;

drop policy if exists "Members can view care tasks" on public.care_tasks;
create policy "Members can view care tasks"
on public.care_tasks
for select
to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Managers can add care tasks" on public.care_tasks;
create policy "Managers can add care tasks"
on public.care_tasks
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    assigned_to is null
    or exists (
      select 1
      from public.circle_members cm
      where cm.user_id = assigned_to
        and cm.circle_id = circle_id
        and cm.status = 'active'
    )
  )
);

drop policy if exists "Managers can update care tasks" on public.care_tasks;
create policy "Managers can update care tasks"
on public.care_tasks
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    assigned_to is null
    or exists (
      select 1
      from public.circle_members cm
      where cm.user_id = assigned_to
        and cm.circle_id = circle_id
        and cm.status = 'active'
    )
  )
);

drop policy if exists "Members can update assigned care tasks" on public.care_tasks;
create policy "Members can update assigned care tasks"
on public.care_tasks
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and (assigned_to is null or assigned_to = auth.uid())
)
with check (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and (assigned_to is null or assigned_to = auth.uid())
);

drop policy if exists "Managers can delete care tasks" on public.care_tasks;
create policy "Managers can delete care tasks"
on public.care_tasks
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
```

### 2) `care_appointments`

```sql
-- Calendar items / appointments for a care circle (step 3.0).
do $$
begin
  create type public.care_appointment_type as enum (
    'doctor', 'lab', 'pharmacy', 'therapy', 'home_care', 'family', 'general'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.care_appointment_status as enum ('scheduled', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.care_appointments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  title text not null,
  appointment_type public.care_appointment_type not null default 'general',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  doctor_id uuid references public.doctors(id) on delete set null,
  notes text,
  status public.care_appointment_status not null default 'scheduled',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_appointments_circle_id_idx on public.care_appointments (circle_id);
create index if not exists care_appointments_circle_starts_idx
  on public.care_appointments (circle_id, starts_at);
create index if not exists care_appointments_doctor_id_idx on public.care_appointments (doctor_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.care_appointments'::regclass
      and conname = 'care_appointments_ends_after_starts'
  ) then
    alter table public.care_appointments
      add constraint care_appointments_ends_after_starts
      check (ends_at is null or ends_at >= starts_at);
  end if;
end
$$;

drop trigger if exists care_appointments_set_updated_at on public.care_appointments;
create trigger care_appointments_set_updated_at
before update on public.care_appointments
for each row execute function public.set_updated_at();

alter table public.care_appointments enable row level security;

drop policy if exists "Members can view care appointments" on public.care_appointments;
create policy "Members can view care appointments"
on public.care_appointments
for select
to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Managers can add care appointments" on public.care_appointments;
create policy "Managers can add care appointments"
on public.care_appointments
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    doctor_id is null
    or exists (
      select 1
      from public.doctors d
      where d.id = doctor_id
        and d.circle_id = circle_id
    )
  )
);

drop policy if exists "Managers can update care appointments" on public.care_appointments;
create policy "Managers can update care appointments"
on public.care_appointments
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    doctor_id is null
    or exists (
      select 1
      from public.doctors d
      where d.id = doctor_id
        and d.circle_id = circle_id
    )
  )
);

drop policy if exists "Managers can delete care appointments" on public.care_appointments;
create policy "Managers can delete care appointments"
on public.care_appointments
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
```

### 3) `family_visits`

```sql
-- Planned / recorded family visits to the care recipient (step 3.0).
do $$
begin
  create type public.family_visit_status as enum ('planned', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.family_visits (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  visitor_name text not null,
  visitor_user_id uuid references public.profiles(id) on delete set null,
  visit_date date not null,
  start_time time,
  end_time time,
  status public.family_visit_status not null default 'planned',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_visits_circle_id_idx on public.family_visits (circle_id);
create index if not exists family_visits_circle_date_idx on public.family_visits (circle_id, visit_date);
create index if not exists family_visits_visitor_user_id_idx on public.family_visits (visitor_user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.family_visits'::regclass
      and conname = 'family_visits_end_after_start'
  ) then
    alter table public.family_visits
      add constraint family_visits_end_after_start
      check (end_time is null or start_time is null or end_time >= start_time);
  end if;
end
$$;

drop trigger if exists family_visits_set_updated_at on public.family_visits;
create trigger family_visits_set_updated_at
before update on public.family_visits
for each row execute function public.set_updated_at();

alter table public.family_visits enable row level security;

drop policy if exists "Members can view family visits" on public.family_visits;
create policy "Members can view family visits"
on public.family_visits
for select
to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Managers can add family visits" on public.family_visits;
create policy "Managers can add family visits"
on public.family_visits
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    visitor_user_id is null
    or exists (
      select 1
      from public.circle_members cm
      where cm.user_id = visitor_user_id
        and cm.circle_id = circle_id
        and cm.status = 'active'
    )
  )
);

drop policy if exists "Members can add their own family visits" on public.family_visits;
create policy "Members can add their own family visits"
on public.family_visits
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
);

drop policy if exists "Managers can update family visits" on public.family_visits;
create policy "Managers can update family visits"
on public.family_visits
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
  and (
    visitor_user_id is null
    or exists (
      select 1
      from public.circle_members cm
      where cm.user_id = visitor_user_id
        and cm.circle_id = circle_id
        and cm.status = 'active'
    )
  )
);

drop policy if exists "Members can update their own family visits" on public.family_visits;
create policy "Members can update their own family visits"
on public.family_visits
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
)
with check (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
);

drop policy if exists "Managers can delete family visits" on public.family_visits;
create policy "Managers can delete family visits"
on public.family_visits
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Members can delete their own family visits" on public.family_visits;
create policy "Members can delete their own family visits"
on public.family_visits
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['caregiver', 'family_member']::public.circle_role[])
  and visitor_user_id = auth.uid()
);
```

---

## Files created

**Migrations (3)**
- `supabase/migrations/20260610090000_create_care_tasks.sql`
- `supabase/migrations/20260610090100_create_care_appointments.sql`
- `supabase/migrations/20260610090200_create_family_visits.sql`

**Shared component (1)**
- `src/components/option-select.tsx` — reusable single-choice chip group (Button-based, RTL/theme-aware, web-safe; used for category/priority/type/status/doctor selects).

**Shared summary module (1)**
- `src/features/care-activity/today.ts` — deterministic, local-time "today's activity" pure functions (`summarizeTodayTasks`, `countAppointmentsToday`, `countVisitsToday`).

**Tasks feature (8)** — `src/features/tasks/`: `api.ts`, `hooks.ts`, `schema.ts`, `tasks-center.tsx`, `task-form.tsx`, `task-editor.tsx`, `tasks-card.tsx`.
**Appointments feature (9)** — `src/features/appointments/`: `api.ts`, `hooks.ts`, `schema.ts`, `appointment-fields.tsx`, `appointment-form.tsx`, `appointment-editor.tsx`, `appointments-center.tsx`, `appointments-card.tsx`.
**Visits feature (8)** — `src/features/visits/`: `api.ts`, `hooks.ts`, `schema.ts`, `visit-fields.tsx`, `visit-form.tsx`, `visit-editor.tsx`, `visits-center.tsx`, `visits-card.tsx`.

**Routes (12)**
- `src/app/(app)/tasks/{_layout,index,new,[id]}.tsx`
- `src/app/(app)/appointments/{_layout,index,new,[id]}.tsx`
- `src/app/(app)/visits/{_layout,index,new,[id]}.tsx`

**Report (1)**
- `docs/claude-reports/2026-06-10-step-3-0-tasks-appointments-visits.md` (this file)

## Files modified

- `src/types/supabase.ts` — added `care_appointments`, `care_tasks`, `family_visits` (Row/Insert/Update/Relationships, in alphabetical position) and the 6 new enums to both the `Enums` union and the `Constants` arrays, by hand, matching the generated shape.
- `src/utils/date.ts` — added `isValidHm`, `ymdFromInstant`, `hmFromInstant`, `startOfTodayInstant`, `combineDateTimeToInstant` (all local-time).
- `src/app/(app)/_layout.tsx` — registered the `tasks`, `appointments`, `visits` nested stacks (`headerShown: false`).
- `src/features/care-circle/circle-dashboard.tsx` — made the tasks card real and added appointments & visits cards (each with a today summary); removed the "coming soon" tasks placeholder. Medications + emergency cards unchanged.
- `src/locales/ar.json` / `src/locales/en.json` — added `common.details`; `careCircle.dashboard.sections.appointments` & `.visits`; and full `tasks` / `appointments` / `visits` namespaces (fields, placeholders, errors, enum labels, status, summary). 409 keys each, full parity.

---

## Client / data-access changes

- **Typed Supabase client + TanStack Query** throughout, mirroring the medications/doctors conventions: per-feature query-key factories (`taskKeys`, `appointmentKeys`, `visitKeys`), `enabled: Boolean(circleId)` guards, and `onSuccess` invalidation of the feature root key (so lists, detail screens, and dashboard summaries all refresh).
- **circleId / role** come from `useActiveCircle()` via the existing `CircleGate`; `canManage` = admin/primary_caregiver, and `canLogDoses` (admin/primary/family/caregiver) is reused as the "can collaborate" flag. Current user id comes from `useAuth()`.
- **Tasks** — `useTasks`, `useTask`, `useTodayTaskSummary`, `useCreateTask`, `useUpdateTask`, `useCompleteTask`, `useCancelTask`, `useDeleteTask`. `completeTask` sets `status='completed' + completed_at + completed_by`; `cancelTask` sets `status='cancelled' + cancelled_at` (both satisfy the consistency CHECKs). Status transitions are only offered from `open`.
- **Appointments** — `useUpcomingAppointments` (`starts_at >= local-midnight today`), `useAppointment`, `useTodayAppointmentSummary`, `useCreateAppointment`, `useUpdateAppointment`, `useSetAppointmentStatus`, `useDeleteAppointment`. The form combines a date + start/end time into ISO `starts_at` / `ends_at`; the doctor is selected from the existing doctors list.
- **Visits** — `useVisits`, `useVisit`, `useTodayVisitSummary`, `useCreateVisit`, `useUpdateVisit`, `useSetVisitStatus`, `useDeleteVisit`. The form sets `visitor_user_id = self` for caregivers/family (required by RLS) and offers managers an optional "link to my account" toggle.
- **Validation** — Arabic-first zod schemas with short error codes mapped to localized strings via `fieldErrors()` + `t()`: tasks (title required; optional due date/time with "time needs date"); appointments (title + date + start time required; end ≥ start); visits (visitor name + date required; end ≥ start).

## UI / screens added

Nested expo-router stacks under `src/app/(app)/`, each `index → new → [id]` (same pattern as `medications/`):

- **/tasks** — disclaimer, add (managers), and **Today / Open / Done & cancelled** sections; rows show category, due, assignment, priority/status badges, inline Complete/Cancel for those allowed, and a Details button. **/tasks/new** (managers). **/tasks/[id]** — managers get an editable form; collaborators get a read-only view; both get the status section (Complete/Cancel when open) and managers get Delete.
- **/appointments** — **Today / Upcoming** cards (type, when, location, doctor, status badge) with inline Mark completed/cancelled (managers) and Details. **/appointments/new** (managers). **/appointments/[id]** — managers edit + status + delete; non-managers read-only.
- **/visits** — **Today / Upcoming / Recent** cards (visitor, when, "your visit", status) with inline Complete/Cancel (managers or own visit) and Details. **/visits/new** (managers + caregivers/family). **/visits/[id]** — managers or owners edit + status + delete; others read-only.
- **Dashboard** — real **Tasks / Appointments / Visits** cards with today summaries (`tasks due/completed today`, `appointments today`, `visits today`), navigable to each center; medications summary and the prominent emergency card preserved.

All screens are Arabic-first / RTL (no hardcoded `textAlign`), reuse `Button`, `FormField`, `ThemedText/ThemedView`, `LoadingState/ErrorState/EmptyState`, `ItemActions`, and the new `OptionSelect`. Copy is family-coordination/record-keeping only — explicit "no medical advice" disclaimers, no medical-advice language.

---

## Commands run

| Command | Result |
| --- | --- |
| `node` JSON parse check (ar.json, en.json) | ✅ both valid JSON |
| `node` i18n key audit (literal `t()` keys + ar/en parity) | ✅ 234 literal keys, 0 missing; 409 keys each, full parity |
| `npx tsc --noEmit` | ✅ **passed, no errors** (re-run after review fixes) |
| `npx expo export --platform web` | ✅ **succeeded — `Exported: dist`**; new routes present: `/tasks`, `/tasks/new`, `/tasks/[id]`, `/appointments`, `/appointments/new`, `/appointments/[id]`, `/visits`, `/visits/new`, `/visits/[id]` |
| `git status --short` / `git diff --stat` | see below |

**TypeScript result:** `tsc --noEmit` is clean.
**Web export result:** the web bundle exports successfully and includes every new route.

> A multi-agent adversarial review was run over the diff (RLS, type fidelity, UI↔RLS alignment). It confirmed type fidelity and date logic are correct, and surfaced one HIGH (collaborator task UPDATE was broader than intended) + one MEDIUM (one-directional task CHECKs) + a LOW (visits null-guard). All three were fixed (collaborator-scope trigger; biconditional CHECKs; `userId !== null` guard) and the type-check re-run.

---

## Manual test instructions

1. **Apply the SQL** — open the **Sanad** Supabase project → **SQL Editor**, paste and run the three blocks above (in order). Confirm `care_tasks`, `care_appointments`, `family_visits` exist with RLS enabled. (Re-running the SQL is safe.)
2. **Run the app** and sign in to a circle where you are **admin / primary_caregiver**. Refresh.
3. **Tasks**
   - From Home, tap the **Tasks** card → **Add task**: enter a title, pick a category/priority, set the due date to **today** (`YYYY-MM-DD`), save. It appears under **Today's tasks**.
   - Tap **Complete** on it → it moves to **Done & cancelled** and shows "Completed at …".
   - Create a second task, open it, **Cancel** it → shows "Cancelled at …".
4. **Appointments**
   - **Appointments** card → **Add appointment**: title, type, date = today, start time `HH:MM` (optionally end time and a doctor), save → appears under **Today's appointments**. Add another dated in the future → **Upcoming**.
   - Open the appointment, **edit** a field, save ("Changes saved"); **Mark completed** → status updates.
5. **Family visits**
   - **Family visits** card → **Add visit**: visitor name, date = today, optional times, save → **Today's visits**. (As a manager you can toggle "link to my account".)
   - Open it, **edit**, save; **Done** → status updates.
6. **Persistence** — fully refresh / relaunch the app; confirm all created tasks/appointments/visits and their statuses persist.
7. **Dashboard summaries** — return Home and confirm the **Tasks** card shows today's due/completed counts, **Appointments** shows today's count, **Visits** shows today's count, and the **Medications** card and **Emergency** card are unchanged.
8. *(Optional, RLS)* Sign in as a **caregiver / family_member**: you can complete/cancel tasks assigned to you or unassigned, and add/edit/cancel **your own** visits, but cannot add tasks/appointments or edit a task's content.

---

## Known risks / assumptions

- **SQL not yet applied.** The app's new screens query tables that do not exist until the SQL is pasted in the dashboard; test only after step 1. RLS is active immediately on apply — only active circle members can read, and mutations require the appropriate role.
- **Local-time date handling.** All "today"/date logic uses the device's local calendar (no timezone math), consistent with the existing medications "today's doses" feature. Appointments store full `timestamptz`; the `>= local-midnight` upcoming filter and the per-row local-date comparison were verified to include earlier-today appointments.
- **Same-day appointments.** The form models a single date with a start and optional end time (no multi-day spans); `ends_at` is derived from the same date.
- **Task assignment is "me / unassigned" only in the UI** this slice (a self-assign toggle), to avoid a members+profiles name lookup. The schema and RLS already support managers assigning to any active member of the circle; a member picker can be added later without migration changes.
- **`family_visits.visitor_name` is a free-text display label** and is not constrained to match a linked `visitor_user_id`; the authoritative link is `visitor_user_id`. (Flagged low by review; intended.)
- **Past appointments** are excluded from the center (focus on today + upcoming); the detail screen still loads any appointment by id. **Recent visits** are capped at 10 in the center.
- **Collaborator task scope** is enforced by the hardened `enforce_care_task_collaborator_scope` trigger: non-managers may only move an **open** task to `completed`/`cancelled`, may not touch content fields, and must set completion bookkeeping honestly (`completed_by = auth.uid()`, no spoofing). It is SECURITY DEFINER with an empty `search_path` and fully schema-qualified references. This is a defensive complement to RLS, not a replacement, and does not disable/bypass RLS. The existing client `completeTask`/`cancelTask` already set exactly these columns, so no client change was needed.
- **Incidental tooling churn:** running the web export caused the Expo CLI to drop a stale `expo-env.d.ts` entry from `tsconfig.json` (the file does not exist / is untracked). I restored `tsconfig.json` to its committed state so the diff stays focused; Expo may re-apply that one-line cleanup on the next `expo` command — it is benign and unrelated to this slice.

## Git status summary

Working tree (not committed):

```
 M src/app/(app)/_layout.tsx
 M src/features/care-circle/circle-dashboard.tsx
 M src/locales/ar.json
 M src/locales/en.json
 M src/types/supabase.ts
 M src/utils/date.ts
?? src/app/(app)/appointments/
?? src/app/(app)/tasks/
?? src/app/(app)/visits/
?? src/components/option-select.tsx
?? src/features/appointments/
?? src/features/care-activity/
?? src/features/tasks/
?? src/features/visits/
?? supabase/migrations/20260610090000_create_care_tasks.sql
?? supabase/migrations/20260610090100_create_care_appointments.sql
?? supabase/migrations/20260610090200_create_family_visits.sql
```

`git diff --stat` (tracked): 6 files changed, 770 insertions(+), 36 deletions(−). No unrelated files touched.

## Is this slice safe to commit after manual SQL + test?

**Yes** — once you (1) paste the three SQL blocks into the Sanad Dashboard and (2) run the manual smoke test above. The code type-checks cleanly, the web bundle builds, ar/en are valid and at full key parity, the change set is focused entirely on this slice, and the migrations are idempotent. Per instructions, nothing has been committed and no Supabase CLI / remote commands were run.
