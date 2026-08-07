-- Milestone 9 · D1 — ROLLBACK.
--
-- Restores public.can_view_all_operational() to its pre-D1 body, character for
-- character as it stood at
-- 20260626161000_backfill_phase_2d_responsibility_rls.sql:24-34.
--
-- NOT a migration. Run by hand only if D1 must be reverted; it deliberately does
-- not live in supabase/migrations/ so a fresh replay does not undo D1.
--
-- ── `create or replace`, NEVER `drop` ────────────────────────────────────────
--
-- Same trap as the forward migration, and it is the most dangerous way to write
-- this file. Five policies hold a pg_depend dependency on this function's OID —
-- care_tasks, care_appointments, medication_logs and family_visits SELECT
-- (20260626161000:54, :88, :150, :164) plus the dose-proof storage SELECT
-- (dose-proof-storage.sql:67-85). `drop function` errors on that dependency;
-- `drop ... cascade` SILENTLY DROPS ALL FIVE, leaving four tables with no
-- permissive SELECT policy at all — deny-all for everyone, admins included.
--
-- ── Why this restores the before matrix exactly ──────────────────────────────
--
--  1. The function is pure: `stable`, a single select over circle_members via
--     has_circle_role. Nothing anywhere stores a materialisation of its value.
--  2. No policy is created, dropped or altered by D1 or by this file. All five
--     reference the function by OID and `create or replace` preserves the OID, so
--     there is no policy state to restore because none was disturbed.
--  3. Grants survive `create or replace` (asserted below), so
--     docs/deployment/authenticated-execute-allowlist.json needs no edit either way.
--  4. Replacing a `language sql` body sends a proc invalidation; cached plans
--     rebuild automatically. The verification probe opens its own connection, so a
--     fresh session is free — use one anyway.
--
-- ── Two residuals this does NOT undo. Both small; know about them. ───────────
--
--  * Signed URLs already minted. PROOF_URL_TTL_SECONDS = 600
--    (src/features/caregiver/api.ts:16), so a family_member who fetched a
--    dose-proof URL during the widened window keeps a working bearer URL for up to
--    ten more minutes. A tail, not a hole.
--  * Client React Query caches on devices that fetched wide rows. Client-only,
--    cleared on refetch or restart; RLS is re-enforced on every new request.
--
-- ── Verification after running this ──────────────────────────────────────────
--
--   1. docs/deployment/milestone-8-role-probe-read.sql
--      → diff against the PRE-D1 before-read.csv, excluding `grp = 'cron'`.
--        Expect ZERO differences.
--   2. docs/deployment/milestone-9-d1-dose-proof-probe.sql
--      → every family_member readable flag back to its pre-D1 value.
--   3. docs/deployment/milestone-8-caregiver-permission-proof.sql → OVERALL PASS.
--   4. node scripts/check-execute-grants.js → green, unchanged.

create or replace function public.can_view_all_operational(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_circle_role(
    p_circle_id,
    array['admin','primary_caregiver','remote_member']::public.circle_role[]
  );
$$;

comment on function public.can_view_all_operational(uuid) is
  'True when the CALLER sees every operational row in this circle: admin, '
  'primary_caregiver and remote_member. SINGLE SWITCH POINT for the read posture.';

revoke all on function public.can_view_all_operational(uuid) from public;
grant execute on function public.can_view_all_operational(uuid) to authenticated;

do $$
declare
  body text;
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  select p.prosrc into body
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'can_view_all_operational';

  if body is null then
    raise exception 'D1 rollback failed: public.can_view_all_operational is missing';
  end if;
  if position('''family_member''' in body) > 0 then
    raise exception 'D1 rollback failed: family_member still present in the role array';
  end if;
  if position('''admin''' in body) = 0
     or position('''primary_caregiver''' in body) = 0
     or position('''remote_member''' in body) = 0 then
    raise exception 'D1 rollback failed: an original role is missing from the array';
  end if;
  if has_function_privilege('anon', 'public.can_view_all_operational(uuid)', 'EXECUTE') then
    raise exception 'D1 rollback failed: can_view_all_operational became anon-executable';
  end if;
  if not has_function_privilege('authenticated', 'public.can_view_all_operational(uuid)', 'EXECUTE') then
    raise exception 'D1 rollback failed: authenticated lost EXECUTE';
  end if;

  raise notice 'D1 rolled back: can_view_all_operational = admin, primary_caregiver, remote_member';
end;
$$;

notify pgrst, 'reload schema';
