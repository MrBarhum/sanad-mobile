-- Milestone 8 · C1 — make `caregiver` an assignable role, and block `elder`.
--
-- Runs AFTER 20260726160000 (least-privilege RLS) and 20260726160100 (RPC
-- scope), deliberately: the restrictions must exist before the role that needs
-- them can be handed out.
--
-- ── A PRODUCTION FINDING THIS MIGRATION IS BUILT ON ──────────────────────────
--
-- The repo has always claimed the server refuses to assign `caregiver` and
-- `elder`. `supabase/migrations/20260610130100_create_membership_invitation_rpcs.sql`
-- carries the rejection at :93-95 and :476-478, and
-- `src/features/circle-members/role-capabilities.ts:17-21` states as fact that
-- "BOTH update_circle_member_role and create_circle_invitation reject them".
--
-- That is not true of the database. Verified 2026-07-26 against
-- `qccgshanmoeybagxwvcs`:
--
--     select proname, (prosrc like '%not available yet%') as has_guard
--     from pg_proc ... ;
--     -->  create_circle_invitation   f
--          update_circle_member_role  f
--
-- The guard has never been installed. Until this file, any manager could create
-- a `caregiver` OR an `elder` invitation — or promote an existing member into
-- either role — with one direct PostgREST call. The only thing standing in the
-- way was a client-side array. `circle_role` has contained both labels since the
-- initial schema, and the RLS policies already name `caregiver` in five write
-- paths, so such a member would have received real privileges immediately.
--
-- Nothing was exploited: production has zero `caregiver` and zero `elder`
-- members, and the app never offered either. But the defence was documentary,
-- not actual.
--
-- ── HOW THIS DRIFT HAPPENED, AND WHY THE LEDGER DID NOT CATCH IT ─────────────
--
-- `20260610130100` is recorded as applied in `supabase_migrations.schema_migrations`
-- and `supabase migration list --linked` reports Local == Remote for it. The
-- file has exactly one commit (fa7ceaa, 2026-06-11) and has never been edited
-- since, so the divergence is not a later repo change — the body installed in
-- production simply came from somewhere else, almost certainly an earlier draft
-- pasted into the Dashboard SQL Editor before the file was finalised.
--
-- Milestone 7 backfilled that history by verifying each migration "against a
-- distinctive object it creates (a table, a function, or a specific column)".
-- That check proves a function EXISTS. It cannot prove its BODY matches. A full
-- body-level audit run for this milestone found exactly four such functions out
-- of 65 — `create_circle_invitation`, `update_circle_member_role`,
-- `leave_care_circle` and `update_circle_member_status`, all from this one
-- migration. The other 61 match the repo verbatim.
--
-- ── WHAT THIS FILE DOES, AND POINTEDLY DOES NOT DO ──────────────────────────
--
-- Both bodies below were read out of PRODUCTION with `pg_get_functiondef` and
-- edited by a script that asserts its anchor matched exactly once. The ONLY
-- change to either function is the insertion of a four-line `elder` guard.
--
-- It does NOT apply the repo file's other unshipped change. Beyond the role
-- guard, the repo's `update_circle_member_role`, `leave_care_circle` and
-- `update_circle_member_status` also contain a canonical-lock-order rewrite
-- intended to close a concurrent last-admin race (lock the circle row first,
-- then the member, and re-validate under the lock). That hardening is ALSO not
-- in production. It is a real, unrelated concurrency fix, it changes behaviour
-- for admins and owners, and shipping it silently inside a role migration is
-- exactly the pattern that produced the Milestone 7 incident. It is flagged in
-- the milestone report for its own reviewed change, and left alone here.
--
-- ── RESULT ───────────────────────────────────────────────────────────────────
--
--   create_circle_invitation:  admin  -> refused (unchanged, pre-existing)
--                              elder  -> refused (NEW)
--                              caregiver, primary_caregiver, family_member,
--                              remote_member -> allowed, subject to the
--                              pre-existing manager checks (unchanged)
--   update_circle_member_role: elder  -> refused (NEW); everything else
--                              unchanged.
--
-- No other role's outcome changes. Reversible: re-running the generator against
-- the archived pre-edit bodies restores them exactly.

-- ── create_circle_invitation — allow 'caregiver', block 'elder' ───────────────────
CREATE OR REPLACE FUNCTION public.create_circle_invitation(p_circle_id uuid, p_role circle_role, p_invited_name text DEFAULT NULL::text, p_invited_email text DEFAULT NULL::text)
 RETURNS TABLE(invitation_id uuid, code text, role circle_role, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_actor public.circle_role;
  v_code text;
  v_hash text;
  v_expires timestamptz := now() + interval '7 days';
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  v_actor := public.active_circle_member_role(p_circle_id);
  if v_actor is null then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can create invitations' using errcode = '42501';
  end if;

  -- admin is the owner/top role and is never invitable.
  if p_role = 'admin' then
    raise exception 'the admin role cannot be granted by invitation' using errcode = '42501';
  end if;
  -- Milestone 8: `caregiver` is now a real role with its own least-privilege
  -- RLS (20260726160000) and RPC scope (20260726160100), so it IS invitable.
  -- `elder` is NOT: no dedicated policy set exists for it, and enabling it by
  -- omission would hand the care recipient a family-member-shaped account.
  --
  -- This guard is NEW to production. The repo's 20260610130100:93-95 has always
  -- carried an `in (caregiver, elder)` rejection, but the body actually
  -- installed never did — verified 2026-07-26 with pg_get_functiondef.
  -- Until this migration, ANY manager could create an `elder` OR `caregiver`
  -- invitation with a direct PostgREST call; only the client's role list stood
  -- in the way.
  if p_role = 'elder' then
    raise exception 'this role is not available yet' using errcode = '42501';
  end if;
  -- a primary caregiver may not grant any manager role.
  if v_actor = 'primary_caregiver' and p_role = 'primary_caregiver' then
    raise exception 'a primary caregiver cannot grant a manager role' using errcode = '42501';
  end if;

  -- Generate a code whose hash is not already in use.
  loop
    v_code := public.generate_invitation_code();
    v_hash := public.hash_invitation_code(v_code);
    exit when not exists (
      select 1 from public.circle_invitations ci where ci.code_hash = v_hash
    );
  end loop;

  insert into public.circle_invitations (
    circle_id, role, code_hash, status, invited_name, invited_email, created_by, expires_at
  )
  values (
    p_circle_id,
    p_role,
    v_hash,
    'pending',
    nullif(btrim(coalesce(p_invited_name, '')), ''),
    nullif(lower(btrim(coalesce(p_invited_email, ''))), ''),
    v_uid,
    v_expires
  )
  returning id into v_id;

  invitation_id := v_id;
  code := v_code;
  role := p_role;
  expires_at := v_expires;
  return next;
end;
$function$
;

-- ── update_circle_member_role — allow 'caregiver', block 'elder' ───────────────────
CREATE OR REPLACE FUNCTION public.update_circle_member_role(p_member_id uuid, p_role circle_role)
 RETURNS TABLE(member_id uuid, role circle_role, status member_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_actor public.circle_role;
  v_target public.circle_members%rowtype;
  v_other_admins int;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_target
  from public.circle_members cm
  where cm.id = p_member_id
  for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  -- The circle owner must remain an active admin; ownership moves only via
  -- transfer_circle_ownership. Fetch it for the owner guards below.
  select cc.owner_id into v_owner
  from public.care_circles cc
  where cc.id = v_target.circle_id;

  -- `is null` guard required: a non-member/cross-circle caller yields NULL and
  -- `NULL not in (...)` is NULL (not true), which would otherwise bypass this.
  v_actor := public.active_circle_member_role(v_target.circle_id);
  if v_actor is null or v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can change roles' using errcode = '42501';
  end if;

  -- Milestone 8: see create_circle_invitation. `caregiver` is assignable now;
  -- `elder` remains blocked, and this is the first time that block has actually
  -- existed in production.
  if p_role = 'elder' then
    raise exception 'this role is not available yet' using errcode = '42501';
  end if;

  -- Only an admin may grant the admin role or modify an existing admin.
  if p_role = 'admin' and v_actor <> 'admin' then
    raise exception 'only an admin can grant the admin role' using errcode = '42501';
  end if;
  if v_target.role = 'admin' and v_actor <> 'admin' then
    raise exception 'only an admin can change an administrator''s role' using errcode = '42501';
  end if;
  -- A primary caregiver may neither grant manager roles nor modify a manager peer.
  if v_actor = 'primary_caregiver'
     and v_target.user_id <> v_uid
     and v_target.role in ('admin', 'primary_caregiver') then
    raise exception 'a primary caregiver cannot modify another manager' using errcode = '42501';
  end if;
  if v_actor = 'primary_caregiver' and p_role = 'primary_caregiver' then
    raise exception 'a primary caregiver cannot grant a manager role' using errcode = '42501';
  end if;

  -- Owner guard: the owner may not be demoted out of admin until ownership moves.
  if v_target.user_id = v_owner and p_role <> 'admin' then
    raise exception 'the circle owner must remain an admin; transfer ownership first'
      using errcode = '23514';
  end if;

  -- Last-admin protection: demoting an admin requires another active admin.
  if v_target.role = 'admin' and p_role <> 'admin' then
    select count(*) into v_other_admins
    from public.circle_members cm
    where cm.circle_id = v_target.circle_id
      and cm.role = 'admin'
      and cm.status = 'active'
      and cm.id <> p_member_id;
    if v_other_admins = 0 then
      raise exception 'cannot demote the last administrator' using errcode = '23514';
    end if;
  end if;

  update public.circle_members cm
    set role = p_role
    where cm.id = p_member_id;

  member_id := p_member_id;
  role := p_role;
  status := v_target.status;
  return next;
end;
$function$
;

-- ── Assert the outcome ───────────────────────────────────────────────────────
do $$
declare
  n integer;
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  -- The elder guard is now installed in BOTH functions...
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('create_circle_invitation', 'update_circle_member_role')
    and p.prosrc like '%p_role = ''elder''%'
    and p.prosrc like '%not available yet%';
  if n <> 2 then
    raise exception 'M8 assign failed: elder guard present in % of 2 functions', n;
  end if;

  -- ...and it is an `elder`-only guard. If a stray `p_role in ('caregiver',...)`
  -- survived, caregiver invitations would still be refused and the entire
  -- milestone would be dead on arrival while every structural check passed.
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('create_circle_invitation', 'update_circle_member_role')
    and p.prosrc like '%''caregiver''%';
  if n <> 0 then
    raise exception
      'M8 assign failed: % function(s) still reference the caregiver literal - caregiver may still be rejected', n;
  end if;

  -- The pre-existing manager guards were not collateral damage.
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'create_circle_invitation'
    and p.prosrc like '%the admin role cannot be granted by invitation%'
    and p.prosrc like '%a primary caregiver cannot grant a manager role%'
    and p.prosrc like '%only managers can create invitations%';
  if n <> 1 then
    raise exception 'M8 assign failed: create_circle_invitation lost a pre-existing guard';
  end if;

  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'update_circle_member_role'
    and p.prosrc like '%only managers can change roles%'
    and p.prosrc like '%only an admin can grant the admin role%';
  if n <> 1 then
    raise exception 'M8 assign failed: update_circle_member_role lost a pre-existing guard';
  end if;

  -- Grant posture intact (H1 standing rule).
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n <> 0 then
    raise exception 'M8 assign failed: % public function(s) became anon-executable', n;
  end if;

  raise notice 'M8 assign verified: caregiver invitable, elder blocked, manager guards intact';
end;
$$;
