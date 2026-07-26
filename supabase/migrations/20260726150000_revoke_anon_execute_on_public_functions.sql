-- Milestone 7 · H1 — revoke EXECUTE from `anon` on every function in `public`.
--
-- ── WHY THE EXISTING `revoke all ... from public` DID NOT DO THIS ────────────
--
-- Almost every function in this repo already ends with a line like
--
--     revoke all on function public.is_user_circle_member(uuid, uuid) from public;
--     grant  execute on function public.is_user_circle_member(uuid, uuid) to authenticated;
--
-- (20260610110000_harden_step_3_rls_membership_checks.sql:57-58)
--
-- and that reads like it locks the function down. It does not. `PUBLIC` in that
-- statement is the SQL pseudo-role meaning "everyone", and revoking from it only
-- removes the implicit grant PostgreSQL hands out on CREATE FUNCTION. It does
-- nothing to an EXPLICIT grant held by a named role — and `anon` holds one.
--
-- The explicit grant comes from Supabase's default privileges. `pg_default_acl`
-- carries, for schema `public`, object type `f`, grantor `postgres`:
--
--     postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres
--
-- so the instant a migration runs `create function public.foo()` as `postgres`,
-- `anon` is granted EXECUTE on it — and a later `revoke ... from public` leaves
-- that grant untouched. Verified on production 2026-07-26: all 65 functions in
-- `public` were anon-executable.
--
-- ── AND SIX OF THEM WERE *ALSO* STILL GRANTED TO PUBLIC ──────────────────────
--
-- Revoking from `anon` alone is not sufficient. Six functions never received the
-- house `revoke all ... from public` line at all, so they still carry the
-- CREATE-FUNCTION default grant to the PUBLIC pseudo-role:
--
--     has_circle_role(uuid,circle_role[])        is_circle_member(uuid)
--     enforce_care_task_collaborator_scope()     enforce_family_visit_collaborator_scope()
--     set_updated_at()                           handle_new_user()
--
-- `anon` is a member of PUBLIC, so for those six `has_function_privilege('anon',
-- ..., 'EXECUTE')` stays TRUE no matter how many times you revoke anon's own
-- grant. This migration therefore revokes from BOTH `anon` and `public`, which
-- is also what finally makes the house pattern uniform across all 65.
--
-- Revoking PUBLIC is safe here, and both halves of that were checked rather than
-- assumed:
--   * All 65 functions hold an EXPLICIT `authenticated` and `service_role`
--     EXECUTE grant (verified: 0 would lose access), so nothing is relying on
--     PUBLIC to reach them.
--   * Four of the six are trigger functions (`set_updated_at`, both
--     `enforce_*_collaborator_scope`, and `handle_new_user`), and one of those
--     (`handle_new_user`) fires on `auth.users` as `supabase_auth_admin` — a role with NO explicit grant,
--     reaching it today only via PUBLIC. Probed empirically on this instance
--     inside a rolled-back transaction: with EXECUTE revoked from PUBLIC, anon,
--     authenticated AND service_role, an UPDATE performed as `authenticated`
--     still fired `set_updated_at()` and the row was touched. PostgreSQL checks
--     EXECUTE on a trigger function at CREATE TRIGGER time, not at fire time.
--     Sign-up is therefore unaffected.
--
-- ── WHAT THE EXPOSURE ACTUALLY WAS ───────────────────────────────────────────
--
-- Not exploitable, but the defence-in-depth those `revoke` lines were written to
-- provide was never engaged. Every one of these functions keys off `auth.uid()`,
-- which is NULL for `anon`, so an unauthenticated PostgREST call to
-- `/rest/v1/rpc/list_available_to_claim` returned an empty result rather than
-- data. The mutating ones raise instead. The hole is that this was the ONLY
-- thing standing between an anonymous caller and 65 SECURITY DEFINER functions:
-- one function written without an `auth.uid()` guard, at any point in the
-- future, would have been reachable by anybody holding the (public) anon key.
--
-- ── WHY THIS IS ONE REPO-WIDE PASS ───────────────────────────────────────────
--
-- Fixing only the newest function would leave 64 in the old state and make the
-- pattern impossible to reason about. This sweeps the whole schema in one shot
-- and closes the source, so the next `create function` does not silently
-- reopen it.
--
-- ── SAFETY ANALYSIS (verified before writing this) ───────────────────────────
--
--  * All 61 RLS policies in `public` are `TO authenticated`. No policy admits
--    `anon`, so no anon query ever evaluates a policy expression, so revoking
--    EXECUTE cannot turn an "empty result" into a "permission denied for
--    function" error on any table read.
--  * `authenticated` and `service_role` keep EXECUTE on all 65 functions. The
--    mobile client (always authenticated when it calls an RPC) and the edge
--    functions (service role) are unaffected.
--  * Trigger functions (`set_updated_at`, `enforce_care_task_collaborator_scope`,
--    `enforce_family_visit_collaborator_scope`, `handle_new_user`) are unaffected:
--    PostgreSQL checks EXECUTE on a trigger function when the trigger is CREATED,
--    not each time it fires. `handle_new_user` fires on `auth.users` as
--    `supabase_auth_admin` in any case.
--  * `generate_invitation_code()` / `hash_invitation_code()` /
--    `normalize_invitation_code()` are called from inside other SECURITY DEFINER
--    functions, which execute as their owner (`postgres`), not as the caller.
--
-- ── WHAT IS DELIBERATELY *NOT* CHANGED ───────────────────────────────────────
--
--  * `authenticated` EXECUTE is left in place on all 65, including the internal
--    plumbing (`enqueue_notification`, `fanout_due_notifications`,
--    `claim_push_deliveries`, `mark_delivery_*`, `set_updated_at`). Tightening
--    those is a separate, behaviour-affecting decision.
--  * `anon`'s TABLE-level grants on ~16 `public` tables are left in place. They
--    are inert today (no RLS policy admits anon) but they are a bigger and
--    separate question. Flagged, not touched here.
--  * The `supabase_admin` grantor row in `pg_default_acl` is left alone —
--    altering it requires membership in `supabase_admin`, which `postgres` does
--    not have. Migrations run as `postgres`, so the `postgres` row below is the
--    one that governs everything this repo creates.
--
-- Idempotent: revoking a privilege that is already absent is a no-op, and the
-- loop re-derives the function list from `pg_proc` every run. Safe to re-run.
--
-- Reversible — the exact undo is:
--     grant execute on all functions in schema public to anon;
--     alter default privileges for role postgres in schema public
--       grant execute on functions to anon;
-- (the PUBLIC grant on the six is deliberately NOT restored by that undo; it was
--  an oversight in their original migrations, not a design choice.)

-- ── 1. Sweep every existing function in `public` ─────────────────────────────
--
-- A loop rather than 65 hand-written `revoke` lines: the list is re-derived from
-- the catalog at run time, so it cannot drift out of sync with a renamed or
-- re-signatured function, and it cannot silently miss one.
do $$
declare
  fn      record;
  swept   integer := 0;
begin
  -- Pin the search path for the duration of THIS block only.
  --
  -- The sweep renders each signature with `oid::regprocedure`, whose text form is
  -- search_path-relative: with `public` on the path it emits `is_circle_member(uuid)`,
  -- without it `public.is_circle_member(uuid)`. Each is correct for the path that
  -- produced it, so the two must not be allowed to disagree — and this repo's own
  -- functions are all declared `set search_path = ''`, so the ambient value cannot
  -- be assumed.
  --
  -- `set_config(..., is_local => true)` rather than a file-level `SET`: a bare SET
  -- survives COMMIT and would silently persist for every later migration applied
  -- over the same connection by `supabase db push`. `pg_catalog` leads so nothing
  -- in `public` can shadow a catalog name while this runs.
  perform set_config('search_path', 'pg_catalog, public', true);

  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by 1
  loop
    -- BOTH grantees, every time. `anon` alone leaves the six PUBLIC-granted
    -- functions reachable; `public` alone leaves the other 59 reachable via
    -- anon's own explicit grant from the default privileges.
    execute format('revoke execute on function %s from anon', fn.sig);
    execute format('revoke execute on function %s from public', fn.sig);
    swept := swept + 1;
  end loop;

  raise notice 'H1: revoked anon + PUBLIC EXECUTE on % function(s) in schema public', swept;
end;
$$;

-- ── 2. Close the source, so the next `create function` does not reopen it ────
--
-- Without this, the very next migration that creates a function in `public`
-- gets `anon=X/postgres` back from Supabase's default privileges and the sweep
-- above rots immediately. This is the line that makes the fix hold.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

-- ── 3. Assert the outcome, both directions ───────────────────────────────────
--
-- A revoke that silently did nothing is exactly the failure mode this whole
-- migration exists to correct, so it asserts rather than trusts. It checks BOTH
-- that anon lost access and that authenticated/service_role kept it — a
-- migration that locked out the app would be far worse than the hole it closes.
do $$
declare
  still_anon integer;
  anon_names text;
  lost_auth  integer;
  auth_names text;
  lost_svc   integer;
begin
  select count(*), coalesce(string_agg(p.oid::regprocedure::text, ', '), '')
    into still_anon, anon_names
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if still_anon > 0 then
    raise exception 'H1 failed: % public function(s) still anon-executable: %', still_anon, anon_names;
  end if;

  select count(*), coalesce(string_agg(p.oid::regprocedure::text, ', '), '')
    into lost_auth, auth_names
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if lost_auth > 0 then
    raise exception 'H1 failed: % public function(s) no longer executable by authenticated: %', lost_auth, auth_names;
  end if;

  select count(*) into lost_svc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not has_function_privilege('service_role', p.oid, 'EXECUTE');

  if lost_svc > 0 then
    raise exception 'H1 failed: % public function(s) no longer executable by service_role', lost_svc;
  end if;

  raise notice 'H1 verified: 0 anon-executable, authenticated and service_role intact';
end;
$$;
