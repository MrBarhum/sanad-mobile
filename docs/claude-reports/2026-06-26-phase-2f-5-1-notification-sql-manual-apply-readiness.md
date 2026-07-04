# Phase 2F-5.1 — Notification SQL manual apply readiness pack

**Status:** Readiness pack / report **only**. **No SQL was run, no Supabase CLI used, no DB connection
made, no Edge deployed, no code/migrations/generated-types/env changed, nothing committed or staged.**
This document lets you (the user) **review, copy, apply, and verify** the two inert notification
migrations **by hand in the Supabase Dashboard SQL Editor**. Claude does not execute anything here.
**Baseline commit:** `a6e05e9 docs(product): audit notification app surfaces`.

> ⚠️ **Reminder on the second project.** This machine has more than one Supabase project. Apply this
> **only** to the **Sanad** project, via **Dashboard → SQL Editor**. Do **not** use the Supabase CLI,
> and do **not** run `login/logout/link/db push` here.

---

## 1. Executive summary

**What this pack is for.** A safe, copy-paste, Dashboard-only procedure to apply the two **inert**
responsibility-aware notification migrations and verify them read-only, with preflight checks, per-step
verification, behavioral spot-checks, dependency-risk guidance, and a stop-and-report failure playbook.

**Migrations included (exactly two):**
1. `supabase/migrations/20260626163000_notifications_responsibility_types_preferences.sql`
2. `supabase/migrations/20260626164000_notifications_responsibility_resolvers.sql`

**Why `163000` must be applied before `164000`.** `163000` runs `ALTER TYPE … ADD VALUE` for 7 new
`notification_type` values. PostgreSQL will not let a newly added enum value be **used** in the same
transaction that adds it. `164000` **uses** those values (in `notification_recipient_eligible`,
`notification_recipients_for_item_event`, and `notification_source_validity`). Running them as **two
separate SQL Editor executions** guarantees `163000` commits first, so the values already exist when
`164000`'s functions are created. (Both files intentionally omit a `begin;/commit;` wrapper — see §13.)

**What becomes available after applying both.** The **capability layer** only:
- 7 new enum values (`item_assigned`, `task_overdue`, `visit_upcoming`, `item_claimed`,
  `item_completed`, `item_cancelled`, `claim_digest`).
- 4 new `notification_preferences` columns (`assignment_alerts`, `activity_updates`,
  `available_to_claim_digest`, `visit_reminders`) with safe defaults.
- Widened `upsert_notification_preferences` (4 new optional params; the app's current 13-arg call stays
  compatible because they default to `null`).
- Responsibility resolvers + updated validity: `notification_item_owner`, `notification_item_managers`,
  `notification_recipients_for_item_event`, `notification_recipient_current`, expanded
  `effective_notification_prefs`, updated `notification_recipient_eligible`, updated
  `notification_source_validity`.

**What does NOT become enabled by this pack:**
- ❌ **No Edge deploy** — the responsibility-aware producers stay undeployed.
- ❌ **No cron** — no schedule is created or enabled.
- ❌ **No notification delivery** — nothing is sent; the outbox/delivery pipeline is untouched.
- ❌ **No producer SQL triggers** — the deferred producer migration (`…165000…`) is not created and
  nothing in these two files enqueues a notification.
- ❌ **No app UI changes** — the settings/catalog/types work is a later phase (2F-5B), after type
  regeneration.

The two files are **inert**: they add capability only; nothing calls the resolvers until a producer
exists, and no producer exists.

---

## 2. Apply order

**Exact manual order (two separate SQL Editor executions):**

1. **APPLY 1 →** `supabase/migrations/20260626163000_notifications_responsibility_types_preferences.sql`
   *(adds enum values + preference columns + widened `upsert_notification_preferences`)*
2. **APPLY 2 →** `supabase/migrations/20260626164000_notifications_responsibility_resolvers.sql`
   *(references the new enum values; adds/updates the resolver + validity functions)*

Why the split matters:
- `163000` **adds** the enum values and (in the same file, safely) the preference columns + upsert —
  none of which *use* a new enum value.
- `164000` **references** the new enum values inside function bodies, so those values must already be
  **committed** first.
- Separate Dashboard executions are safer than one big paste because each SQL Editor run is its own
  transaction, so `163000` commits before `164000` begins — satisfying the enum-in-transaction rule
  and avoiding a `unsafe use of new value` error.

---

## 3. Preflight checklist (before running any SQL)

- [ ] **Correct project:** you are in the **Sanad** Supabase project (double-check the project name/ref
      in the Dashboard header) — not the other project on this machine.
- [ ] **SQL Editor, not CLI:** you are pasting into **Dashboard → SQL Editor**. You are **not** using
      the Supabase CLI, `db push`, or migrations tooling.
- [ ] **Delivery/cron still OFF:** no notification cron jobs are scheduled/enabled; delivery stays
      disabled through this whole procedure.
- [ ] **No Edge deploy:** you are not deploying any Edge Function as part of this step.
- [ ] **Optional backup/snapshot:** if your plan/tier offers a point-in-time backup or snapshot, taking
      one now is a reasonable precaution (this pack is additive and inert, but a snapshot costs nothing).
- [ ] **Keep the exact SQL:** keep the two migration files handy and paste them **verbatim** (this pack
      also embeds them in §5 and §7 for convenience — they are identical to the files).
- [ ] **Run PRECHECK first:** run the read-only §4 block and note the current state before applying.

---

## 4. Preflight SQL checks

### `PRECHECK — read-only`

Paste and run in the SQL Editor. **All statements are read-only catalog queries** — no writes. It is
fine (expected) if the "new" objects are absent before you apply anything.

```sql
-- ============================================================================
-- PRECHECK — read-only. Safe before applying anything. No writes, no DDL.
-- ============================================================================

-- (P1) Are the 7 new enum values already present? EXPECT 0 rows before apply.
select e.enumlabel
from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'notification_type'
  and e.enumlabel in ('item_assigned','task_overdue','visit_upcoming',
                      'item_claimed','item_completed','item_cancelled','claim_digest')
order by e.enumlabel;

-- (P2) Are the 4 new preference columns already present? EXPECT 0 rows before apply.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'notification_preferences'
  and column_name in ('assignment_alerts','activity_updates',
                      'available_to_claim_digest','visit_reminders')
order by column_name;

-- (P3) Snapshot of the relevant functions (signature + security + grants).
--      Before apply you should see the committed versions of
--      effective_notification_prefs / notification_recipient_eligible /
--      notification_source_validity / upsert_notification_preferences (13-arg),
--      and NOT yet the item_owner / item_managers / recipients_for_item_event /
--      recipient_current helpers.
select p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef                                          as security_definer,
       has_function_privilege('service_role',  p.oid, 'execute') as svc_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('public',         p.oid, 'execute') as public_exec
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('effective_notification_prefs','notification_recipient_eligible',
                    'notification_item_owner','notification_item_managers',
                    'notification_recipients_for_item_event','notification_recipient_current',
                    'notification_source_validity','upsert_notification_preferences')
order by p.proname, args;

-- (P4) Dependency check for effective_notification_prefs — what depends ON it?
--      164000 DROPs + recreates this function (its return shape changes). Function
--      bodies late-bind by name and normally do NOT record a hard pg_depend edge, so
--      this should return 0 rows and the drop will succeed. If it returns ANY rows,
--      STOP: do NOT use `drop ... cascade`; copy the list and report it before APPLY 2.
select
  pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid) as dependent_object,
  d.deptype
from pg_proc target
join pg_depend d on d.refobjid = target.oid
where target.pronamespace = 'public'::regnamespace
  and target.proname = 'effective_notification_prefs'
  and d.deptype in ('n','a')                 -- normal / auto dependencies
  and d.classid = 'pg_proc'::regclass;       -- only OTHER functions depending on it
-- EXPECT: 0 rows (type/columns are refs FROM the function, not dependents ON it).
```

---

## 5. Manual SQL apply block for `163000`

### `APPLY 1 — 20260626163000_notifications_responsibility_types_preferences.sql`

- Paste this **entire block as one SQL Editor execution** and run it once.
- The SQL is reproduced **verbatim** from the migration file (no edits). No typo was found.
- **Wait for a success result before moving to `164000`.** Then run **VERIFY 1** (§6).

```sql
-- Phase 2F-3 — Inert responsibility-aware notification SQL (1 of 2): types + preferences.
--
-- Adds the new notification_type enum values, the 4 new notification_preferences columns,
-- and the widened upsert_notification_preferences signature, exactly as reviewed in
-- docs/claude-reports/2026-06-26-phase-2f-2-responsibility-aware-notification-sql-proposal.md
-- (§13-A). INERT: nothing in this file produces a notification or enables delivery.
--
-- WHY ITS OWN FILE (enum-in-transaction rule): a newly added enum value cannot be USED in
-- the same transaction that adds it. The migration runner wraps each file in its own
-- transaction, so these ADD VALUE statements commit here — before the resolver functions in
-- 20260626164000_notifications_responsibility_resolvers.sql reference them at runtime. The
-- preference-column ADDs and the upsert recreate in this file do NOT reference any new enum
-- value, so they are safe alongside the ADD VALUEs.
--
-- The outer begin;/commit; wrapper is omitted to match house style (the migration runner
-- wraps each file in its own transaction). Idempotent (add value if not exists / add column
-- if not exists / drop+recreate the upsert). No producer, no delivery, no policy change, no
-- data change. The producer migration (…165000_…producers.sql) is DEFERRED and intentionally
-- NOT created in this phase.

-- A1. Enum values (own migration; a new value cannot be used in the same transaction).
alter type public.notification_type add value if not exists 'item_assigned';
alter type public.notification_type add value if not exists 'task_overdue';
alter type public.notification_type add value if not exists 'visit_upcoming';
alter type public.notification_type add value if not exists 'item_claimed';
alter type public.notification_type add value if not exists 'item_completed';
alter type public.notification_type add value if not exists 'item_cancelled';
alter type public.notification_type add value if not exists 'claim_digest';

-- A2. Preference columns (additive, defaulted).
alter table public.notification_preferences
  add column if not exists assignment_alerts         boolean not null default true,
  add column if not exists activity_updates          boolean not null default true,
  add column if not exists available_to_claim_digest boolean not null default false,
  add column if not exists visit_reminders           boolean not null default true;

-- A3. upsert_notification_preferences: +4 optional params. Drop old signature + recreate
--     (named-arg client calls remain compatible via the new defaults). Pairs with 2F-5 UI.
drop function if exists public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text);

create or replace function public.upsert_notification_preferences(
  p_circle_id uuid,
  p_medication_reminders boolean, p_missed_dose_alerts boolean, p_task_reminders boolean,
  p_appointment_reminders boolean, p_visit_updates boolean, p_care_updates boolean,
  p_emergency_alerts boolean, p_remote_summary boolean,
  p_quiet_hours_enabled boolean, p_quiet_hours_start time, p_quiet_hours_end time, p_timezone text,
  p_assignment_alerts boolean default null, p_activity_updates boolean default null,
  p_available_to_claim_digest boolean default null, p_visit_reminders boolean default null
) returns public.notification_preferences
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row public.notification_preferences;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_circle_id is not null and not public.is_active_user_circle_member(p_circle_id, v_uid) then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if p_timezone is not null and p_timezone <> '' and not public.is_valid_timezone(p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  if coalesce(p_quiet_hours_enabled,false) and (p_quiet_hours_start is null or p_quiet_hours_end is null) then
    raise exception 'quiet hours require a start and end' using errcode = '22023';
  end if;

  update public.notification_preferences np set
    medication_reminders      = coalesce(p_medication_reminders, np.medication_reminders),
    missed_dose_alerts        = coalesce(p_missed_dose_alerts, np.missed_dose_alerts),
    task_reminders            = coalesce(p_task_reminders, np.task_reminders),
    appointment_reminders     = coalesce(p_appointment_reminders, np.appointment_reminders),
    visit_updates             = coalesce(p_visit_updates, np.visit_updates),
    care_updates              = coalesce(p_care_updates, np.care_updates),
    emergency_alerts          = coalesce(p_emergency_alerts, np.emergency_alerts),
    remote_summary            = coalesce(p_remote_summary, np.remote_summary),
    assignment_alerts         = coalesce(p_assignment_alerts, np.assignment_alerts),
    activity_updates          = coalesce(p_activity_updates, np.activity_updates),
    available_to_claim_digest = coalesce(p_available_to_claim_digest, np.available_to_claim_digest),
    visit_reminders           = coalesce(p_visit_reminders, np.visit_reminders),
    quiet_hours_enabled       = coalesce(p_quiet_hours_enabled, np.quiet_hours_enabled),
    quiet_hours_start         = p_quiet_hours_start,
    quiet_hours_end           = p_quiet_hours_end,
    timezone                  = coalesce(nullif(p_timezone,''), np.timezone)
  where np.user_id = v_uid and np.circle_id is not distinct from p_circle_id
  returning * into v_row;

  if not found then
    insert into public.notification_preferences (
      user_id, circle_id, medication_reminders, missed_dose_alerts, task_reminders,
      appointment_reminders, visit_updates, care_updates, emergency_alerts, remote_summary,
      assignment_alerts, activity_updates, available_to_claim_digest, visit_reminders,
      quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone
    ) values (
      v_uid, p_circle_id,
      coalesce(p_medication_reminders,true), coalesce(p_missed_dose_alerts,true), coalesce(p_task_reminders,true),
      coalesce(p_appointment_reminders,true), coalesce(p_visit_updates,true), coalesce(p_care_updates,true),
      coalesce(p_emergency_alerts,true), coalesce(p_remote_summary,true),
      coalesce(p_assignment_alerts,true), coalesce(p_activity_updates,true),
      coalesce(p_available_to_claim_digest,false), coalesce(p_visit_reminders,true),
      coalesce(p_quiet_hours_enabled,false), p_quiet_hours_start, p_quiet_hours_end, nullif(p_timezone,'')
    ) returning * into v_row;
  end if;
  return v_row;
end; $$;
revoke all on function public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text,
  boolean, boolean, boolean, boolean) from public;
grant execute on function public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text,
  boolean, boolean, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
```

---

## 6. Verification SQL after `163000`

### `VERIFY 1 — after 163000`

Read-only. **All checks should pass before you run APPLY 2.**

```sql
-- ============================================================================
-- VERIFY 1 — after 163000. Read-only.
-- ============================================================================

-- (V1.1) 7 new enum values exist. EXPECT exactly 7 rows.
select e.enumlabel
from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'notification_type'
  and e.enumlabel in ('item_assigned','task_overdue','visit_upcoming',
                      'item_claimed','item_completed','item_cancelled','claim_digest')
order by e.enumlabel;

-- (V1.2) 4 preference columns exist with the expected defaults.
--        EXPECT: assignment_alerts=true, activity_updates=true,
--                available_to_claim_digest=false, visit_reminders=true.
select column_name, data_type, column_default
from information_schema.columns
where table_schema='public' and table_name='notification_preferences'
  and column_name in ('assignment_alerts','activity_updates',
                      'available_to_claim_digest','visit_reminders')
order by column_name;

-- (V1.3) Widened upsert exists with the 4 new params — and the OLD 13-arg overload
--        is gone. EXPECT exactly ONE row whose args include p_assignment_alerts,
--        p_activity_updates, p_available_to_claim_digest, p_visit_reminders;
--        auth_exec=true, public_exec=false.
select pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('public',         p.oid, 'execute') as public_exec
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.proname='upsert_notification_preferences'
order by args;

-- (V1.4) Backward-compat evidence via catalog defaults: the 4 new params are the
--        trailing DEFAULTED args, so the app's existing 13-arg call still binds.
--        EXPECT total_args=17 and defaulted_args=4.
select p.pronargs        as total_args,
       p.pronargdefaults as defaulted_args
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.proname='upsert_notification_preferences';
```

If **V1.1** does not return 7, or **V1.3** returns two rows (a leftover 13-arg overload), **stop** and
re-read the APPLY 1 result before continuing.

---

## 7. Manual SQL apply block for `164000`

### `APPLY 2 — 20260626164000_notifications_responsibility_resolvers.sql`

- Run this **only after VERIFY 1 passes**.
- Paste this **entire block as one SQL Editor execution** and run it once.
- The SQL is reproduced **verbatim** from the migration file (no edits). No typo was found.
- Then run **VERIFY 2** (§8).

```sql
-- Phase 2F-3 — Inert responsibility-aware notification SQL (2 of 2): resolvers + source validity.
--
-- Expands effective_notification_prefs, updates notification_recipient_eligible, adds the
-- responsibility resolvers (notification_item_owner, notification_item_managers,
-- notification_recipients_for_item_event), adds notification_recipient_current, and re-creates
-- notification_source_validity with the recipient-currency gate + visit / task_overdue branches —
-- exactly as reviewed in
-- docs/claude-reports/2026-06-26-phase-2f-2-responsibility-aware-notification-sql-proposal.md (§13-B).
-- INERT: these functions add capability only; nothing calls the resolvers until a producer exists,
-- and the producer migration (…165000_…producers.sql) is DEFERRED / intentionally NOT created here.
--
-- ORDERING: depends on the enum values + preference columns added in
-- 20260626163000_notifications_responsibility_types_preferences.sql. The new enum values are USED
-- here (notification_recipient_eligible / notification_recipients_for_item_event /
-- notification_source_validity reference item_assigned/task_overdue/visit_upcoming/item_claimed/…),
-- so they must already be committed. Run 20260626163000 first (enum-in-transaction rule).
--
-- DEPENDENCY CAVEAT (B1): effective_notification_prefs is DROP+recreated because its return shape
-- gains 4 columns (create-or-replace cannot change a function's return type). Its callers
-- (notification_recipient_eligible, circle_notification_recipients, fanout_due_notifications,
-- claim_push_deliveries) late-bind by name, so the drop is expected to succeed. If Postgres instead
-- raises a dependency error (2BP01 "other objects depend on it") on the drop, do NOT use
-- `drop ... cascade`; recreate the named dependents in order after the expanded function. Verify on a
-- scratch/staging DB before applying (see the Phase 2F-3 report).
--
-- The outer begin;/commit; wrapper is omitted to match house style (the migration runner wraps each
-- file in its own transaction). security definer + set search_path = '' + revoke all from public +
-- service_role-only grants are preserved on every function. No producer, no trigger, no delivery, no
-- policy change, no data change.

-- B1. effective_notification_prefs: expand return (drop + recreate; PL/pgSQL callers late-bind).
drop function if exists public.effective_notification_prefs(uuid, uuid);
create function public.effective_notification_prefs(p_user_id uuid, p_circle_id uuid)
returns table (
  medication_reminders boolean, missed_dose_alerts boolean, task_reminders boolean,
  appointment_reminders boolean, visit_updates boolean, care_updates boolean,
  emergency_alerts boolean, remote_summary boolean,
  assignment_alerts boolean, activity_updates boolean,
  available_to_claim_digest boolean, visit_reminders boolean,
  quiet_hours_enabled boolean, quiet_hours_start time, quiet_hours_end time, timezone text
) language plpgsql stable security definer set search_path = '' as $$
declare c public.notification_preferences%rowtype; g public.notification_preferences%rowtype;
begin
  if p_circle_id is not null then
    select * into c from public.notification_preferences np where np.user_id=p_user_id and np.circle_id=p_circle_id;
  end if;
  select * into g from public.notification_preferences np where np.user_id=p_user_id and np.circle_id is null;
  return query select
    coalesce(c.medication_reminders,  g.medication_reminders,  true),
    coalesce(c.missed_dose_alerts,    g.missed_dose_alerts,    true),
    coalesce(c.task_reminders,        g.task_reminders,        true),
    coalesce(c.appointment_reminders, g.appointment_reminders, true),
    coalesce(c.visit_updates,         g.visit_updates,         true),
    coalesce(c.care_updates,          g.care_updates,          true),
    coalesce(c.emergency_alerts,      g.emergency_alerts,      true),
    coalesce(c.remote_summary,        g.remote_summary,        true),
    coalesce(c.assignment_alerts,     g.assignment_alerts,     true),
    coalesce(c.activity_updates,      g.activity_updates,      true),
    coalesce(c.available_to_claim_digest, g.available_to_claim_digest, false),
    coalesce(c.visit_reminders,       g.visit_reminders,       true),
    coalesce(c.quiet_hours_enabled,   g.quiet_hours_enabled,   false),
    coalesce(c.quiet_hours_start,     g.quiet_hours_start),
    coalesce(c.quiet_hours_end,       g.quiet_hours_end),
    coalesce(nullif(c.timezone,''),   nullif(g.timezone,''),   'UTC');
end; $$;
revoke all on function public.effective_notification_prefs(uuid, uuid) from public;
grant execute on function public.effective_notification_prefs(uuid, uuid) to service_role;

-- B2. notification_recipient_eligible: map new types + full remote exclusion (create or replace).
create or replace function public.notification_recipient_eligible(
  p_user_id uuid, p_circle_id uuid, p_type public.notification_type
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.circle_role; prefs record; v_pref boolean;
begin
  if p_circle_id is not null then
    select cm.role into v_role from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.user_id = p_user_id and cm.status = 'active';
    if v_role is null
       or v_role not in ('admin','primary_caregiver','family_member','caregiver','remote_member') then
      return false;  -- elder / null / removed
    end if;
    -- NOTE: `caregiver` is ADDED to the allow-list here (the committed engine omits it). Phase 2E
    -- makes caregiver a claim-capable owner, so a caregiver owner must be able to receive its own
    -- reminders. Harmless today (no active caregiver members); flag for product sign-off (§18).
    if v_role = 'remote_member' and p_type in (
      'medication_due','medication_missed','task_due','task_overdue',
      'appointment_upcoming','visit_upcoming','item_assigned',
      'item_claimed','item_completed','item_cancelled','claim_digest'
    ) then
      return false;  -- remote is a read-only observer: no operational/assignment/awareness pushes
    end if;
  end if;

  select * into prefs from public.effective_notification_prefs(p_user_id, p_circle_id);
  v_pref := case p_type
    when 'medication_due'      then prefs.medication_reminders
    when 'medication_missed'   then prefs.missed_dose_alerts
    when 'task_due'            then prefs.task_reminders
    when 'task_overdue'        then prefs.task_reminders
    when 'appointment_upcoming' then prefs.appointment_reminders
    when 'visit_upcoming'      then prefs.visit_reminders
    when 'visit_update'        then prefs.visit_updates
    when 'care_update'         then prefs.care_updates
    when 'item_assigned'       then prefs.assignment_alerts
    when 'item_claimed'        then prefs.activity_updates
    when 'item_completed'      then prefs.activity_updates
    when 'item_cancelled'      then prefs.activity_updates
    when 'claim_digest'        then prefs.available_to_claim_digest
    when 'emergency'           then prefs.emergency_alerts
    when 'system'              then true
    else true
  end;
  return coalesce(v_pref, true);
end; $$;
revoke all on function public.notification_recipient_eligible(uuid, uuid, public.notification_type) from public;
grant execute on function public.notification_recipient_eligible(uuid, uuid, public.notification_type) to service_role;

-- B3.1 notification_item_owner — the responsibility column for an entity (null = unowned).
create or replace function public.notification_item_owner(p_entity text, p_item_id uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid;
begin
  case p_entity
    when 'task'        then select assigned_to         into v_owner from public.care_tasks         where id = p_item_id;
    when 'medication'  then select responsible_user_id into v_owner from public.medications        where id = p_item_id;
    when 'appointment' then select assigned_to         into v_owner from public.care_appointments  where id = p_item_id;
    when 'visit'       then select visitor_user_id     into v_owner from public.family_visits       where id = p_item_id;
    else v_owner := null;
  end case;
  return v_owner;
end; $$;
revoke all on function public.notification_item_owner(text, uuid) from public;
grant execute on function public.notification_item_owner(text, uuid) to service_role;

-- B3.2 notification_item_managers — active managers with tz/quiet-hours (fallback/awareness/escalation).
create or replace function public.notification_item_managers(p_circle_id uuid)
returns table (user_id uuid, timezone text, quiet_hours_enabled boolean,
               quiet_hours_start time, quiet_hours_end time)
language sql stable security definer set search_path = '' as $$
  select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
  from public.circle_members cm
  cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
  where cm.circle_id = p_circle_id and cm.status = 'active'
    and cm.role in ('admin','primary_caregiver');
$$;
revoke all on function public.notification_item_managers(uuid) from public;
grant execute on function public.notification_item_managers(uuid) to service_role;

-- B3.3 notification_recipients_for_item_event — audience class derived from p_type; every branch
--       filtered by active membership + notification_recipient_eligible (role/pref/remote/elder).
create or replace function public.notification_recipients_for_item_event(
  p_circle_id uuid, p_type public.notification_type, p_entity text, p_item_id uuid
)
returns table (user_id uuid, timezone text, quiet_hours_enabled boolean,
               quiet_hours_start time, quiet_hours_end time)
language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid;
begin
  -- Manager-awareness → managers only.
  if p_type in ('item_claimed','item_completed','item_cancelled') then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver')
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Claim digest → claim-capable members who opted in.
  if p_type = 'claim_digest' then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver','family_member','caregiver')
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Owner-targeted reminders / assignment. Notify the owner ONLY when they hold a valid operational
  -- role (manager or doer); an owner who opted out returns empty (no escalation — opt-out respected).
  v_owner := public.notification_item_owner(p_entity, p_item_id);
  if v_owner is not null and exists (
       select 1 from public.circle_members cm
       where cm.circle_id = p_circle_id and cm.user_id = v_owner and cm.status = 'active'
         and cm.role in ('admin','primary_caregiver','family_member','caregiver')
     ) then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.user_id = v_owner
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Unassigned OR owner has a non-operational role (a manager mis-assigned a remote_member/elder,
  -- which the assignment RLS permits — it checks membership, not role): manager fallback ONLY for
  -- medication/appointment/visit reminders. task_due / task_overdue / item_assigned → NOBODY
  -- (no spam; the claim feed + the manager UI cover unassigned/mis-assigned tasks).
  if p_type in ('medication_due','medication_missed','appointment_upcoming','visit_upcoming') then
    return query
      select m.user_id, m.timezone, m.quiet_hours_enabled, m.quiet_hours_start, m.quiet_hours_end
      from public.notification_item_managers(p_circle_id) m
      where public.notification_recipient_eligible(m.user_id, p_circle_id, p_type);
    return;
  end if;
  return;  -- no recipients
end; $$;
revoke all on function public.notification_recipients_for_item_event(uuid, public.notification_type, text, uuid) from public;
grant execute on function public.notification_recipients_for_item_event(uuid, public.notification_type, text, uuid) to service_role;

-- B4. notification_recipient_current — send-time recipient-currency gate (used by B5).
create or replace function public.notification_recipient_current(p_notification_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare n public.notifications%rowtype; v_entity text; v_item uuid;
begin
  select * into n from public.notifications where id = p_notification_id;
  if not found then return false; end if;

  -- Manager-escalation rows (producer sets data.tier='manager'; e.g. tier-2 medication_missed /
  -- task_overdue after the owner failed to act) validate a CURRENT active manager, NOT item
  -- ownership — otherwise the owner-only resolver would drop them as 'not_current_recipient'.
  if (n.data ->> 'tier') = 'manager' then
    return exists (
      select 1 from public.circle_members cm
      where cm.circle_id = n.circle_id and cm.user_id = n.user_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver')
    ) and public.notification_recipient_eligible(n.user_id, n.circle_id, n.type);
  end if;

  v_entity := nullif(n.data ->> 'entity', '');
  v_item   := nullif(n.data ->> 'itemId', '')::uuid;
  if v_entity is null or v_item is null then
    return true;  -- legacy / no item context → do not block
  end if;
  return exists (
    select 1 from public.notification_recipients_for_item_event(n.circle_id, n.type, v_entity, v_item) r
    where r.user_id = n.user_id
  );
end; $$;
revoke all on function public.notification_recipient_current(uuid) from public;
grant execute on function public.notification_recipient_current(uuid) to service_role;

-- B5. notification_source_validity — FULL body = the current committed body (20260611120100) with
--     the three 2F-2 insertions integrated (marked NEW). Signature/return + grants UNCHANGED, so
--     create-or-replace (no drop) is valid and the fanout/claim call sites are untouched.
create or replace function public.notification_source_validity(p_notification_id uuid)
returns table (valid boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n public.notifications%rowtype;
  v_schedule_id uuid;
  v_dose_date date;
  v_scheduled_time time;
  v_sched public.medication_schedules%rowtype;
  v_med_active boolean;
  v_weekday integer;
  v_task public.care_tasks%rowtype;
  v_due_date date;
  v_due_time time;
  v_appt public.care_appointments%rowtype;
  v_starts_at timestamptz;
  v_visit public.family_visits%rowtype;   -- NEW (2F-2)
  v_visit_date date;                       -- NEW (2F-2)
  v_visit_start time;                      -- NEW (2F-2)
begin
  select * into n from public.notifications nn where nn.id = p_notification_id;
  if not found then
    return query select false, 'no_notification'; return;
  end if;

  -- NEW (2F-2): recipient-currency gate. Skip a queued notification whose recipient is no longer the
  -- correct target — reassigned/claimed away, role or membership lost, or a manager-escalation row
  -- whose recipient is no longer a manager. Legacy rows (no data.entity/itemId and non-'manager'
  -- tier) are treated valid by notification_recipient_current, preserving prior behavior.
  if not public.notification_recipient_current(p_notification_id) then
    return query select false, 'not_current_recipient'; return;
  end if;

  if n.type in ('medication_due', 'medication_missed') then
    v_schedule_id := nullif(n.data ->> 'scheduleId', '')::uuid;
    v_dose_date := nullif(n.data ->> 'doseDate', '')::date;
    v_scheduled_time := nullif(n.data ->> 'scheduledTime', '')::time;
    if v_schedule_id is null or v_dose_date is null or v_scheduled_time is null then
      return query select true, 'no_source_context'; return;
    end if;

    select * into v_sched from public.medication_schedules ms where ms.id = v_schedule_id;
    if not found or not v_sched.is_active then
      return query select false, 'schedule_inactive'; return;
    end if;
    select m.is_active into v_med_active from public.medications m where m.id = v_sched.medication_id;
    if v_med_active is null or not v_med_active then
      return query select false, 'medication_inactive'; return;
    end if;

    -- Occurrence must still be a real slot of the (possibly edited) schedule.
    -- extract(dow) is 0=Sunday..6=Saturday, matching days_of_week (JS getDay()).
    v_weekday := extract(dow from v_dose_date)::integer;
    if not (v_weekday = any (v_sched.days_of_week))
       or not (v_scheduled_time = any (v_sched.times))
       or v_dose_date < v_sched.start_date
       or (v_sched.end_date is not null and v_dose_date > v_sched.end_date) then
      return query select false, 'occurrence_changed'; return;
    end if;

    -- Recorded since enqueue? (true for a due reminder AND for a late missed dose.)
    if exists (
      select 1 from public.medication_logs ml
      where ml.schedule_id = v_schedule_id
        and ml.dose_date = v_dose_date
        and ml.scheduled_time = v_scheduled_time
    ) then
      return query select false, 'dose_recorded'; return;
    end if;

    return query select true, 'ok'; return;

  -- NEW (2F-2): task_overdue folded into the task branch (was `n.type = 'task_due'`), so a completed,
  -- cancelled, or rescheduled task also invalidates its overdue reminder.
  elsif n.type in ('task_due', 'task_overdue') then
    if nullif(n.data ->> 'taskId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_task from public.care_tasks t where t.id = (n.data ->> 'taskId')::uuid;
    if not found then
      return query select false, 'task_missing'; return;
    end if;
    if v_task.status <> 'open' then
      return query select false, 'task_closed'; return;
    end if;
    -- Rescheduled? Compare the CURRENT due date/time to the occurrence that
    -- produced this notification (dueTime is the task's raw time, null = date-only).
    v_due_date := nullif(n.data ->> 'dueDate', '')::date;
    v_due_time := nullif(n.data ->> 'dueTime', '')::time;
    if v_task.due_date is distinct from v_due_date
       or v_task.due_time is distinct from v_due_time then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  elsif n.type = 'appointment_upcoming' then
    if nullif(n.data ->> 'appointmentId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_appt from public.care_appointments a where a.id = (n.data ->> 'appointmentId')::uuid;
    if not found then
      return query select false, 'appointment_missing'; return;
    end if;
    if v_appt.status <> 'scheduled' then
      return query select false, 'appointment_closed'; return;
    end if;
    v_starts_at := nullif(n.data ->> 'startsAt', '')::timestamptz;
    if v_appt.starts_at is distinct from v_starts_at then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  -- NEW (2F-2): visit_upcoming branch — visit still planned + occurrence (visit_date/start_time)
  -- unchanged. Uses the generic data.itemId (the new visit producer stores entity='visit'+itemId).
  elsif n.type = 'visit_upcoming' then
    if nullif(n.data ->> 'itemId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_visit from public.family_visits v where v.id = (n.data ->> 'itemId')::uuid;
    if not found then
      return query select false, 'visit_missing'; return;
    end if;
    if v_visit.status <> 'planned' then
      return query select false, 'visit_closed'; return;
    end if;
    v_visit_date := nullif(n.data ->> 'visitDate', '')::date;
    v_visit_start := nullif(n.data ->> 'startTime', '')::time;
    if v_visit.visit_date is distinct from v_visit_date
       or v_visit.start_time is distinct from v_visit_start then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  else
    -- No concrete validatable source identifier — keep existing behavior.
    return query select true, 'ok'; return;
  end if;
end;
$$;
revoke all on function public.notification_source_validity(uuid) from public;
grant execute on function public.notification_source_validity(uuid) to service_role;

notify pgrst, 'reload schema';
```

---

## 8. Verification SQL after `164000`

### `VERIFY 2 — after 164000`

Read-only.

```sql
-- ============================================================================
-- VERIFY 2 — after 164000. Read-only.
-- ============================================================================

-- (V2.1) Resolver/helper + updated functions exist, are SECURITY DEFINER, and are
--         granted to service_role (not public). EXPECT one row each; security_definer=true;
--         svc_exec=true; public_exec=false for all seven.
select p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef                                          as security_definer,
       has_function_privilege('service_role', p.oid, 'execute') as svc_exec,
       has_function_privilege('public',        p.oid, 'execute') as public_exec
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.proname in ('notification_item_owner','notification_item_managers',
                    'notification_recipients_for_item_event','notification_recipient_current',
                    'effective_notification_prefs','notification_recipient_eligible',
                    'notification_source_validity')
order by p.proname;

-- (V2.2) effective_notification_prefs now returns the widened shape. EXPECT the
--         result text to include assignment_alerts, activity_updates,
--         available_to_claim_digest, visit_reminders.
select pg_catalog.pg_get_function_result(p.oid) as return_shape
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.proname='effective_notification_prefs';

-- (V2.3a) NO producer function was created by this pack. EXPECT 0 rows.
select p.proname
from pg_proc p
where p.pronamespace='public'::regnamespace
  and (p.proname = 'enqueue_item_event' or p.proname like 'produce\_%\_event' escape '\');

-- (V2.3b) NO new producer TRIGGER on the 4 entity tables. EXPECT to see ONLY the
--          pre-existing collaborator-scope triggers (care_tasks_collaborator_scope,
--          family_visits_collaborator_scope) — and NO produce_* / notify_* trigger.
select tgrelid::regclass as table_name, tgname
from pg_trigger
where not tgisinternal
  and tgrelid in ('public.care_tasks'::regclass,'public.medications'::regclass,
                  'public.care_appointments'::regclass,'public.family_visits'::regclass)
order by table_name, tgname;

-- (V2.4) NO cron job was enabled by this pack. If the pg_cron extension is installed,
--         EXPECT no notification cron job (ideally none until 2F-6). If this errors with
--         'schema "cron" does not exist', that is FINE — it confirms no cron. Skip it then.
select jobname, schedule, command from cron.job order by jobname;
```

---

## 9. Behavioral verification SQL (read-only, discovery-based)

These **SELECT-only** checks call the resolver functions directly with **discovered** live IDs (via
`LIMIT 1` CTEs) — no fixed QA UUIDs, no writes, no `set role` / auth simulation (the resolvers take
explicit params and do not read `auth.uid()`, so calling them directly is reliable). In the Dashboard
SQL Editor these run as the project owner, which can execute the `service_role`-granted functions.

> **Adapt / optional:** each check needs at least one matching live row (an active `remote_member`, an
> assigned medication, an unassigned task, etc.). If a CTE finds no row, the check simply returns
> nothing — that is not a failure, just "no data to exercise this path." For owner checks, remember an
> owner who has the relevant preference **off** correctly resolves to empty (opt-out respected).

```sql
-- (B1) remote_member is EXCLUDED from operational/awareness/digest types.
with r as (
  select cm.user_id, cm.circle_id
  from public.circle_members cm
  where cm.status='active' and cm.role='remote_member'
  limit 1
)
select r.user_id, r.circle_id,
       public.notification_recipient_eligible(r.user_id, r.circle_id, 'medication_due') as med_due,
       public.notification_recipient_eligible(r.user_id, r.circle_id, 'task_due')        as task_due,
       public.notification_recipient_eligible(r.user_id, r.circle_id, 'item_claimed')    as item_claimed,
       public.notification_recipient_eligible(r.user_id, r.circle_id, 'claim_digest')    as claim_digest
from r;
-- EXPECT: med_due, task_due, item_claimed, claim_digest all = false.

-- (B2) medication_due resolves to the medication's responsible_user_id (owner).
with m as (
  select id, circle_id, responsible_user_id
  from public.medications
  where responsible_user_id is not null and is_active = true
  limit 1
)
select m.id as medication_id, m.responsible_user_id as expected_owner,
       array(select r.user_id
             from public.notification_recipients_for_item_event(m.circle_id,'medication_due','medication',m.id) r
            ) as resolved_recipients
from m;
-- EXPECT: resolved_recipients = {responsible_user_id}  (empty only if that owner opted out).

-- (B3) UNASSIGNED medication falls back to managers.
with m as (
  select id, circle_id from public.medications
  where responsible_user_id is null and is_active = true
  limit 1
)
select m.id as medication_id,
       array(select r.user_id from public.notification_recipients_for_item_event(m.circle_id,'medication_due','medication',m.id) r) as resolved,
       array(select mm.user_id from public.notification_item_managers(m.circle_id) mm) as managers
from m;
-- EXPECT: resolved is a subset of managers (managers who have the pref on).

-- (B4) task_due for an UNASSIGNED open task returns NOBODY.
with t as (
  select id, circle_id from public.care_tasks
  where assigned_to is null and status='open'
  limit 1
)
select t.id as task_id,
       (select count(*) from public.notification_recipients_for_item_event(t.circle_id,'task_due','task',t.id)) as recipient_count
from t;
-- EXPECT: recipient_count = 0. (task_overdue behaves the same — swap the type to confirm.)

-- (B5a) UNASSIGNED appointment falls back to managers.
with a as (
  select id, circle_id from public.care_appointments
  where assigned_to is null and status='scheduled'
  limit 1
)
select a.id as appointment_id,
       array(select r.user_id from public.notification_recipients_for_item_event(a.circle_id,'appointment_upcoming','appointment',a.id) r) as resolved,
       array(select mm.user_id from public.notification_item_managers(a.circle_id) mm) as managers
from a;
-- EXPECT: resolved is a subset of managers.

-- (B5b) UNLINKED planned visit falls back to managers.
with v as (
  select id, circle_id from public.family_visits
  where visitor_user_id is null and status='planned'
  limit 1
)
select v.id as visit_id,
       array(select r.user_id from public.notification_recipients_for_item_event(v.circle_id,'visit_upcoming','visit',v.id) r) as resolved,
       array(select mm.user_id from public.notification_item_managers(v.circle_id) mm) as managers
from v;
-- EXPECT: resolved is a subset of managers.

-- (B6) Manager-awareness (item_claimed) targets MANAGERS ONLY (owner ignored).
--       Any existing task id is fine — the item_claimed branch is circle-manager-scoped.
with at as (select id, circle_id from public.care_tasks limit 1)
select at.circle_id,
       array(select r.user_id from public.notification_recipients_for_item_event(at.circle_id,'item_claimed','task',at.id) r) as claimed_recipients,
       array(select cm.user_id from public.circle_members cm
             where cm.circle_id=at.circle_id and cm.status='active'
               and cm.role in ('admin','primary_caregiver')) as managers
from at;
-- EXPECT: claimed_recipients is a subset of managers (those with activity_updates on);
--         it never includes family_member / caregiver / remote_member / elder.
```

---

## 10. Dependency risk section

**The key risk:** `164000` **drops and recreates** `effective_notification_prefs` (its return shape
gains 4 columns; `create or replace` cannot change a function's return type). Its callers
(`notification_recipient_eligible`, `circle_notification_recipients`, `fanout_due_notifications`,
`claim_push_deliveries`) reference it **by name** (late binding), which normally records **no** hard
`pg_depend` edge — so the drop is expected to succeed. The `PRECHECK` **P4** query verifies this ahead
of time; run it and confirm **0 rows** before APPLY 2.

**The strategy must match the file.** `164000` performs the drop as a plain
`drop function if exists public.effective_notification_prefs(uuid, uuid);` followed by a fresh
`create`. **Do not** rewrite it to `drop … cascade`. If a real dependency exists, the correct fix is to
recreate the named dependents in order **after** the expanded function — not to cascade-drop them.

**If `164000` fails: stop.** Copy the **exact** Dashboard error text (message + SQLSTATE) and report it.
**Do not** proceed to type regeneration or Edge deploy while either migration is in a failed/partial
state.

**Common failure patterns:**

| Symptom (Dashboard error) | Likely meaning | What to do |
|---|---|---|
| `invalid input value for enum notification_type` / `unsafe use of new value "…"` | A new enum value was used before it committed — usually APPLY 2 was run **without** APPLY 1 first, or both were pasted into one execution. | **Stop.** Confirm VERIFY 1 shows all 7 values, then run APPLY 2 as its own separate execution. Do not merge the two files into one run. |
| `cannot drop function effective_notification_prefs(...) because other objects depend on it` (SQLSTATE `2BP01`) | A hard dependency on the function exists (unexpected for late-bound callers). | **Stop.** Copy the full "depends on it" list. Do **not** `drop … cascade`. Report the list so a reviewed recreate-in-order plan can be written. |
| `cannot change return type of existing function` / `return type mismatch` | The `drop` of `effective_notification_prefs` did not happen before the `create` (e.g. edited SQL, or the drop matched a different signature). | **Stop.** Verify the old function was dropped; re-run APPLY 2 verbatim from this pack. Report if it persists. |
| `permission denied for function …` / grant errors | Running as a role that cannot create/grant in `public`. | **Stop.** Confirm you are the project owner in the Dashboard SQL Editor (not a restricted role). Report. |
| `type "notification_type" already has value …` **without** `if not exists` / `duplicate_object` / "already exists" | A partial re-run or a hand-edited statement. | The pack's statements are idempotent (`add value if not exists`, `add column if not exists`, `create or replace`); re-running the **verbatim** file is safe. Do **not** paste random partial fragments. Report if a non-idempotent error appears. |

**General rule on any error:** stop, copy the exact error, do **not** rerun random partial SQL, and
report back before continuing.

---

## 11. Post-apply next steps (after both VERIFY blocks pass)

1. **Do not deploy Edge yet** — the responsibility-aware producers stay undeployed.
2. **Do not enable cron yet** — no schedule is created/enabled.
3. **Next: regenerate app types from live** — likely a refresh of `src/types/supabase.ts` so the app
   sees the 7 enum values, the 4 preference columns, and the widened `upsert_notification_preferences`.
   *(Do not run `supabase gen types` as part of this report; that is its own reviewed step.)*
4. **Then: 2F-5B app changes** — settings toggles, catalog labels/glyphs, locale copy, notification-center
   rendering for the new types (report `…phase-2f-5a…`).
5. **Then: deliberate Edge deploy** — deploy the 2F-4B producers only after the SQL above is confirmed in
   the target DB.
6. **Then: controlled cron/delivery enable** — schedule the functions and turn delivery on deliberately.
7. **Then: real-device Android push QA** — owner-only targeting, manager awareness, remote silence, no
   duplicate pushes, quiet-hours deferral.

---

## 12. Rollback / recovery guidance

**No destructive rollback SQL is provided** (none is needed — the pack is additive and inert, and
delivery stays off, so a failed apply cannot reach users through push).

- If **`163000`** fails before completing: **stop**, copy the exact error, report. Do not hand-edit.
- If **`164000`** fails: **stop**, copy the exact error, report. Do not proceed to types/Edge.
- **Do not run any rollback** unless a reviewed rollback plan is written first.
- **Enum values cannot be removed** cleanly in PostgreSQL — do **not** attempt to remove
  `item_assigned` / `task_overdue` / … by hand. They are harmless if unused.
- **Do not drop the new preference columns** casually — the 2F-5B app + the resolvers expect them.
- Because **delivery remains off**, a failed/partial apply does not affect users through push delivery;
  the safe path is always: stop, capture the error, report, and wait for a reviewed next step.

---

## 13. Appendix: source file metadata (local inspection only)

Gathered with safe local read-only inspection (`wc -l`, content grep) — no SQL executed.

| Fact | `20260626163000_…types_preferences.sql` | `20260626164000_…resolvers.sql` |
|---|---|---|
| Path | `supabase/migrations/20260626163000_notifications_responsibility_types_preferences.sql` | `supabase/migrations/20260626164000_notifications_responsibility_resolvers.sql` |
| Line count (`wc -l`) | 110 | 398 |
| Ends with `notify pgrst, 'reload schema';` | ✅ yes | ✅ yes |
| Contains a `begin;` / `commit;` transaction wrapper | ❌ no (house style; runner/SQL-Editor wraps each execution) | ❌ no |
| Contains producer triggers (`create trigger` / `returns trigger`) | ❌ no | ❌ no |
| Contains `enqueue_notification` / producer enqueue calls | ❌ no | ❌ no |
| Contains Edge-deploy / EAS / prebuild content | ❌ no | ❌ no |
| Contains cron (`cron.schedule` / `pg_cron` / `net.http_post`) | ❌ no | ❌ no |

Both files are inert capability SQL: enum/columns/upsert (file 1) and resolver/validity functions
(file 2). Neither creates a producer, a trigger, a cron job, or any delivery path.

---

## 14. Validation / local checks

Run in this environment (safe, local, no SQL / CLI / network):

- `npm run check:mojibake` → **PASS** — `check:mojibake - scanned 266 active source/config file(s).
  No strong mojibake signatures found in active source/config.`
- `git -c core.autocrlf=false diff --check` → **clean** (exit 0; no whitespace/CRLF errors).

*(The embedded SQL blocks and enum labels in this report are ASCII; the mojibake scan covers active
source/config and reports clean.)*

---

## 15. Confirmation

- ✅ **No code changed except this report.**
- ✅ **No SQL run** — the SQL here is copy-for-the-user; Claude executed none.
- ✅ **No Supabase CLI.**
- ✅ **No DB connection.**
- ✅ **No Edge deploy.**
- ✅ **No app source changed** (`src/**` untouched).
- ✅ **No Edge source changed** (`supabase/functions/**` untouched).
- ✅ **No migrations changed** (`supabase/migrations/**` untouched — read-only).
- ✅ **No generated types changed** (`src/types/supabase.ts` untouched).
- ✅ **No env / secrets touched.**
- ✅ **No commit / no stage.** No cron/delivery enabled. No other project touched (ThinkMate untouched).

## 16. Final git state

Captured read-only at hand-off:

- `git --no-pager status --short`
- `git --no-pager diff --stat`

Expected: one **untracked** file (`??`) — this report — and an empty `diff --stat` (an untracked file
does not appear in a tracked diff). Actual output is shown in the hand-off message.
