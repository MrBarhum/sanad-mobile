-- Milestone 9 · A1 — EXECUTE-privilege matrix for every function in `public`.
--
-- READ-ONLY. Run it BEFORE the A1 migration and again AFTER; diff the two CSVs.
-- This is the direct evidence for "the revoke did exactly what it claimed and
-- nothing else".
--
--   npx supabase db query --linked -f docs/deployment/milestone-9-execute-privilege-probe.sql -o csv > before-exec.csv
--   ... apply supabase/migrations/20260729120000_revoke_authenticated_execute_service_role_functions.sql ...
--   npx supabase db query --linked -f docs/deployment/milestone-9-execute-privilege-probe.sql -o csv > after-exec.csv
--   diff before-exec.csv after-exec.csv
--
-- The ONLY lines that may differ are `authenticated` flipping true -> false on the
-- functions the migration names. Any other movement — a function appearing or
-- disappearing, `service_role` losing EXECUTE, `anon` gaining it, or
-- `authenticated` losing EXECUTE on a function NOT in that list — is a regression.
--
-- ── WHY THIS PROBE AND NOT JUST THE MIGRATION'S OWN ASSERTION ────────────────
--
--  * The migration asserts its post-state, which proves the intended change
--    landed. It cannot prove the ABSENCE of collateral damage, because it only
--    looks at the functions it knows about. This probe enumerates `pg_proc`
--    itself, so a function nobody remembered is still covered.
--
--  * It reads `pg_proc` rather than a hand-maintained list, so it cannot drift
--    from reality the way the Milestone 8 hard-coded `= 70` policy count did.
--
--  * `has_function_privilege(role, oid, 'EXECUTE')` resolves the EFFECTIVE
--    privilege — it accounts for the grant a role holds directly, the grant it
--    inherits via PUBLIC, and the `pg_default_acl` default privileges that
--    Milestone 7 H1 had to fight. A query over `proacl` text would miss all three
--    and is exactly how the original gap went unnoticed.
--
--  * Identity is (name, argument types). `public` carries overloads, and a
--    name-only key would silently collapse two functions with different grants
--    into one row.
--
-- NOTE ON SCOPE: this probe covers EXECUTE only. The read-surface matrix in
-- docs/deployment/milestone-8-role-probe-read.sql is the companion check that no
-- ROLE's visible data changed; run both.

select
  p.proname                                                as function_name,
  pg_get_function_identity_arguments(p.oid)                as args,
  case when p.prosecdef then 'definer' else 'invoker' end  as security,
  has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',  p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
order by p.proname, pg_get_function_identity_arguments(p.oid);
