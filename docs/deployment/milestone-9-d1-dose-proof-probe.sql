-- Milestone 9 · D1 — dose-proof storage read probe (before / after).
--
-- WHY THIS FILE EXISTS. The committed read matrix
-- (docs/deployment/milestone-8-role-probe-read.sql) probes tables and RPCs. It has
-- NO storage probe. D1 widens a fifth surface that lives outside supabase/migrations
-- entirely — the `dose-proof` bucket SELECT policy at
-- docs/deployment/dose-proof-storage.sql:67-85 — because that policy calls
-- public.can_view_all_operational() and D1 replaces the function body. Without this
-- file that widening would be entirely unmeasured, which is exactly the "assumed,
-- not observed" posture this milestone exists to end.
--
-- WHY IT EVALUATES THE PREDICATE RATHER THAN COUNTING OBJECTS. Counting rows in
-- storage.objects proves nothing if the production bucket is empty or holds one
-- photo — every role would return 0 before and after. So the probe evaluates the
-- policy's own predicate directly, per impersonated role, for every medication in
-- the circle. That is deterministic, needs no object to exist, and is precisely what
-- the storage policy computes. The real object count is emitted too (free, and it
-- catches a missing `storage` grant, which is a different fact from "0 rows").
--
-- READ-ONLY. Wrapped in begin/rollback like every probe in this directory. Identity
-- is (circle ordinal, role, per-role ordinal, medication ordinal) — never a uid, a
-- name, an email, or a medication name.
--
-- ── HOW TO RUN ───────────────────────────────────────────────────────────────
--   Before D1:  ... > docs/claude-reports/milestone-9-probes/d1-before-doseproof.csv
--   After  D1:  ... > docs/claude-reports/milestone-9-probes/d1-after-doseproof.csv
--   Compare:    diff the two.
--
-- ── EXPECTED DIFF ────────────────────────────────────────────────────────────
--   family_member      : `readable` 0 → 1 for every medication they are NOT
--                        responsible for; 1 → 1 for the ones they are.
--   admin / primary_caregiver / remote_member : all 1 before AND after (they are
--                        already inside can_view_all_operational). Any movement here
--                        is a FAIL.
--   caregiver          : unchanged. Any movement here is a FAIL.
--
-- Any change on a non-family_member row means the role array was replaced rather
-- than extended — stop and roll back.

begin;

do $$
declare
  m         record;
  med       record;
  flag      int;
  n         bigint;
  st        text;
  acc       jsonb := '[]'::jsonb;
  members   jsonb;
  meds      jsonb;
begin
  -- Transaction-local: a bare SET would survive COMMIT and leak into every later
  -- statement on the same pooled connection.
  perform set_config('search_path', 'pg_catalog, public', true);

  -- Materialise the member population and the medication list as `postgres`,
  -- BEFORE the first role switch — once impersonation starts, RLS would hide the
  -- very rows the probe needs to iterate.
  select coalesce(jsonb_agg(jsonb_build_object(
           'circle', s.circle_ord, 'role', s.role, 'ord', s.ord,
           'uid', s.user_id, 'cid', s.circle_id)
           order by s.circle_ord, s.role, s.ord), '[]'::jsonb)
    into members
  from (
    select dense_rank() over (order by c.created_at, c.id)  as circle_ord,
           cm.circle_id,
           cm.role::text                                    as role,
           row_number() over (partition by cm.circle_id, cm.role
                              order by cm.created_at, cm.id) as ord,
           cm.user_id
    from public.circle_members cm
    join public.care_circles  c on c.id = cm.circle_id
    where cm.status = 'active'
  ) s;

  select coalesce(jsonb_agg(jsonb_build_object(
           'cid', t.circle_id, 'mid', t.id, 'mord', t.med_ord)
           order by t.circle_id, t.med_ord), '[]'::jsonb)
    into meds
  from (
    select md.id, md.circle_id,
           row_number() over (partition by md.circle_id order by md.created_at, md.id) as med_ord
    from public.medications md
  ) t;

  for m in select * from jsonb_to_recordset(members)
                    as x(circle int, role text, ord int, uid uuid, cid uuid)
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', m.uid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- Without this the whole matrix is postgres's bypassrls view and proves
    -- nothing. Fail loudly rather than record a passing lie.
    if current_user <> 'authenticated' then
      raise exception 'probe aborted: role switch did not take (current_user=%)', current_user;
    end if;

    -- ── the storage SELECT predicate, per medication ─────────────────────────
    -- Mirrors dose-proof-storage.sql:73-84 exactly. The bucket path is
    -- <circle_id>/<medication_id>/<log_id>.<ext>, so segment 1 is the circle and
    -- segment 2 is the medication; here we pass those ids directly instead of
    -- parsing a name, which is what makes the probe independent of object existence.
    for med in select * from jsonb_to_recordset(meds) as y(cid uuid, mid uuid, mord int)
    loop
      if med.cid = m.cid then
        begin
          select (public.can_view_all_operational(med.cid)
                  or (public.is_circle_member(med.cid)
                      and public.is_responsible_for_medication(med.cid, med.mid, auth.uid())))::int
            into flag;
          st := 'ok';
        exception when others then flag := -1; st := sqlstate;
        end;
        acc := acc || jsonb_build_object('grp','doseproof','circle',m.circle,
                 'role',m.role,'ord',m.ord,'kind','predicate',
                 'probe','med#' || med.mord, 'readable',flag,'sqlstate',st);
      end if;
    end loop;

    -- ── the real object count ────────────────────────────────────────────────
    -- Fully qualified: search_path is pg_catalog, public — `storage` is not on it.
    -- A -1 with SQLSTATE 42501 here means a missing grant, which is a different
    -- security fact from a legitimate 0.
    begin
      execute 'select count(*) from storage.objects where bucket_id = ''dose-proof''' into n;
      st := 'ok';
    exception when others then n := -1; st := sqlstate;
    end;
    acc := acc || jsonb_build_object('grp','doseproof','circle',m.circle,
             'role',m.role,'ord',m.ord,'kind','objects',
             'probe','dose-proof','readable',n,'sqlstate',st);

    execute 'reset role';
  end loop;

  perform set_config('probe.doseproof', acc::text, true);
end
$$;

-- The --linked transport returns only the LAST result set, so the whole matrix is
-- emitted here. Deterministic ordering means `diff` is the whole comparison.
select x.grp, x.circle, x.role, x.ord, x.kind, x.probe, x.readable, x.sqlstate
from jsonb_to_recordset(current_setting('probe.doseproof')::jsonb)
       as x(grp text, circle int, role text, ord int, kind text,
            probe text, readable bigint, sqlstate text)
order by x.grp, x.circle, x.role, x.ord, x.kind, x.probe;

rollback;
