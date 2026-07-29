-- Milestone 9 · B1 — make `medication_logs` authorship and timing
-- server-authoritative, and give corrections their own attribution.
--
-- ── WHAT THIS CLOSES ─────────────────────────────────────────────────────────
--
-- `medication_logs` was the ONLY record-keeping table in the schema whose author
-- was client-supplied. Its sibling tables already pin it:
--
--   vital_readings  (20260610100100:183)  with check (... and recorded_by = auth.uid())
--   daily_care_logs (20260610100000:169)  same, with a SEPARATE manager-only
--                                         policy for deliberately anonymous rows
--   care_tasks      (20260726120000:92)   enforced by trigger:
--                                         `if new.completed_by is distinct from auth.uid() ... raise`
--
-- `medication_logs` had neither. Both `recorded_by` and `recorded_at` arrived
-- verbatim from the client (src/features/medications/api.ts:203/216,
-- src/features/caregiver/api.ts:63-64/82), so a hired caregiver could:
--
--   * backdate `recorded_at` so every late dose renders «في وقتها» in the
--     family's weekly summary — which grades on-time vs late from exactly that
--     column (src/features/caregiver/week-api.ts:287-297);
--   * file a dose as another member, or as nobody at all (the column is nullable
--     with no default);
--   * rewrite a log a family member authored, including flipping `missed` to
--     `given`.
--
-- That defeats the guarantee Milestone 8 exists to provide: that the family can
-- see, and trust, who gave which dose and when.
--
-- ── WHY A TRIGGER AND NOT ONLY A POLICY ──────────────────────────────────────
--
-- A `with check (recorded_by = auth.uid())` pins the AUTHOR — and that is added
-- below, mirroring the siblings — but a WITH CHECK cannot force a TIMESTAMP to
-- `now()`; it can only accept or reject what the client sent. `recorded_at` is
-- the column the weekly compliance summary judges a named worker on, so it has to
-- be assigned by the server, not merely validated. A BEFORE trigger is the only
-- mechanism that can do both, and the codebase already uses that shape
-- (`enforce_care_task_collaborator_scope`, `set_updated_at`).
--
-- Ordering is what makes belt-and-braces work: PostgreSQL runs BEFORE ROW
-- triggers, THEN evaluates RLS WITH CHECK on the resulting row. So the policy
-- sees the values the trigger forced. If the trigger were ever dropped, the
-- policy still refuses a forged author on INSERT.
--
-- ── THE AUTHORIZED CORRECTION PATH ───────────────────────────────────────────
--
-- A correction must remain possible — a manager fixing a mis-recorded dose is a
-- real and necessary workflow — WITHOUT letting anyone forge the original. So the
-- original is made immutable rather than protected by permission:
--
--   * `recorded_by` / `recorded_at` are assigned once, on INSERT, and are forced
--     back to their previous values on every UPDATE. Nobody, at any privilege
--     level, can rewrite who recorded a dose or when.
--   * `corrected_by` / `corrected_at` (new) capture WHO changed the outcome and
--     WHEN, stamped by the same trigger. A correction is therefore additive: it
--     records a second fact instead of destroying the first.
--
-- A useful side effect: because `recorded_at` no longer moves, a later correction
-- can no longer retroactively turn an on-time dose into «متأخّرة» in the weekly
-- summary. That column now means what the summary has always assumed it means.
--
-- ── WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────────
--
-- The UPDATE policy's USING clause stays row-blind: any member responsible for a
-- medication may still correct any log OF THAT MEDICATION, not only their own.
-- Narrowing it to own-rows would break the manager correction path this milestone
-- is required to preserve. The accountability gap that made row-blindness
-- dangerous is closed by attribution instead — every correction is now stamped
-- with its author. Residual, recorded rather than hidden: a responsible member can
-- still change a peer's dose outcome; they can no longer do it anonymously or
-- pass it off as the original record.
--
-- DEPLOY MANUALLY. Probes: docs/deployment/milestone-9-execute-privilege-probe.sql
-- and docs/deployment/milestone-8-role-probe-read.sql, before and after.

-- ── 1. Correction attribution columns ────────────────────────────────────────
alter table public.medication_logs
  add column if not exists corrected_by uuid references public.profiles(id) on delete set null;

alter table public.medication_logs
  add column if not exists corrected_at timestamptz;

comment on column public.medication_logs.corrected_by is
  'Who last changed this dose OUTCOME after it was first recorded. Null when the '
  'row still holds its original record. Assigned by trigger; never client-supplied.';

comment on column public.medication_logs.corrected_at is
  'When the outcome was last corrected. Null for an uncorrected record. Assigned '
  'by trigger; never client-supplied.';

comment on column public.medication_logs.recorded_by is
  'Who FIRST recorded this dose. Server-assigned from auth.uid() on INSERT and '
  'immutable thereafter — a correction writes corrected_by, it never rewrites this.';

comment on column public.medication_logs.recorded_at is
  'When the dose was FIRST recorded. Server-assigned from now() on INSERT and '
  'immutable thereafter. The weekly caregiver summary grades on-time vs late from '
  'this column, so it must never be client-supplied or restamped.';

-- ── 2. The trigger ───────────────────────────────────────────────────────────
create or replace function public.enforce_medication_log_authorship()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Server-authoritative. Whatever the client sent is discarded, so an older
    -- app build that still posts these columns keeps working and simply cannot
    -- influence them.
    new.recorded_by := (select auth.uid());
    new.recorded_at := now();
    new.corrected_by := null;
    new.corrected_at := null;
    return new;
  end if;

  -- UPDATE — the original record is immutable at every privilege level.
  new.recorded_by := old.recorded_by;
  new.recorded_at := old.recorded_at;

  -- Stamp a correction only when the OUTCOME actually changed. Touching an
  -- unrelated column (attaching a dose photo, say) must not manufacture a
  -- "corrected by" that misrepresents someone as having altered a medical record.
  if new.status is distinct from old.status then
    new.corrected_by := (select auth.uid());
    new.corrected_at := now();
  else
    new.corrected_by := old.corrected_by;
    new.corrected_at := old.corrected_at;
  end if;

  return new;
end;
$$;

comment on function public.enforce_medication_log_authorship() is
  'Makes medication_logs authorship server-authoritative: assigns recorded_by / '
  'recorded_at on INSERT, holds them immutable on UPDATE, and stamps corrected_by / '
  'corrected_at when a dose OUTCOME changes.';

-- House pattern: CREATE FUNCTION implicitly grants EXECUTE to PUBLIC. This is a
-- trigger function — PostgreSQL checks EXECUTE at CREATE TRIGGER time, not at fire
-- time (probed empirically in 20260726150000), so it needs no role grant at all.
-- Milestone 9 A1 revoked `authenticated` from every function of this class; a new
-- one must not silently reopen the gap, which is what the CI guard now enforces.
revoke all on function public.enforce_medication_log_authorship() from public;
revoke all on function public.enforce_medication_log_authorship() from authenticated;
revoke all on function public.enforce_medication_log_authorship() from anon;

drop trigger if exists medication_logs_enforce_authorship on public.medication_logs;
create trigger medication_logs_enforce_authorship
before insert or update on public.medication_logs
for each row execute function public.enforce_medication_log_authorship();

-- ── 3. Mirror the sibling tables' INSERT pin ─────────────────────────────────
--
-- Redundant while the trigger exists — and that is the point. Two independent
-- mechanisms must both fail before a forged author can land.
--
-- Added to INSERT only. On UPDATE, `recorded_by` is the ORIGINAL author, who is
-- usually NOT the person making an authorized correction; requiring it to equal
-- auth.uid() there would break the correction path this migration must preserve.
drop policy if exists "Caregivers can add medication logs" on public.medication_logs;
create policy "Caregivers can add medication logs"
on public.medication_logs
for insert
to authenticated
with check (
  (
    public.has_circle_role(circle_id, array['admin','primary_caregiver']::public.circle_role[])
    or (
      public.has_circle_role(circle_id, array['family_member','caregiver']::public.circle_role[])
      and public.is_responsible_for_medication(circle_id, medication_id, (select auth.uid()))
    )
  )
  and public.is_circle_medication(circle_id, medication_id)
  and (
    schedule_id is null
    or public.is_circle_medication_schedule_for_medication(circle_id, schedule_id, medication_id)
  )
  -- Milestone 9 B1: the author is the caller. Mirrors vital_readings:183 and
  -- daily_care_logs:169. Unlike daily_care_logs there is NO anonymous variant —
  -- an unattributed dose record has no legitimate use in this product.
  and recorded_by = (select auth.uid())
);

-- ── 4. Acceptance assertions ─────────────────────────────────────────────────
do $$
declare
  n integer;
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  -- 4a. both attribution columns exist, and are nullable (existing rows have none)
  select count(*) into n
  from information_schema.columns
  where table_schema = 'public' and table_name = 'medication_logs'
    and column_name in ('corrected_by', 'corrected_at');
  if n <> 2 then
    raise exception 'M9 B1 failed: expected corrected_by + corrected_at on medication_logs, found %', n;
  end if;

  -- 4b. the trigger is installed, and fires BEFORE both INSERT and UPDATE. A
  --     trigger registered only for INSERT would leave every correction free to
  --     rewrite the original, which is the whole point of this file.
  select count(*) into n
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relname = 'medication_logs'
    and t.tgname = 'medication_logs_enforce_authorship'
    and not t.tgisinternal
    and (t.tgtype & 2) = 2      -- BEFORE
    and (t.tgtype & 4) = 4      -- INSERT
    and (t.tgtype & 16) = 16;   -- UPDATE
  if n <> 1 then
    raise exception
      'M9 B1 failed: medication_logs_enforce_authorship missing or not BEFORE INSERT OR UPDATE (found %)', n;
  end if;

  -- 4c. the INSERT policy carries the author pin
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and tablename = 'medication_logs'
    and policyname = 'Caregivers can add medication logs'
    and with_check like '%recorded_by%';
  if n <> 1 then
    raise exception 'M9 B1 failed: INSERT policy is missing the recorded_by pin';
  end if;

  -- 4d. the trigger function is not reachable by a signed-in user (M9 A1 rule)
  if has_function_privilege('authenticated', 'public.enforce_medication_log_authorship()', 'EXECUTE') then
    raise exception 'M9 B1 failed: enforce_medication_log_authorship is authenticated-executable';
  end if;

  raise notice 'M9 B1 verified: authorship trigger installed, correction columns present, INSERT policy pinned';
end;
$$;

-- ── Undo (documentation, not executed) ───────────────────────────────────────
--
--   drop trigger if exists medication_logs_enforce_authorship on public.medication_logs;
--   drop function if exists public.enforce_medication_log_authorship();
--   alter table public.medication_logs drop column if exists corrected_at;
--   alter table public.medication_logs drop column if exists corrected_by;
--   -- then restore the pre-B1 INSERT policy from 20260626161000:102-120
--   -- (identical minus the trailing `and recorded_by = (select auth.uid())`).
