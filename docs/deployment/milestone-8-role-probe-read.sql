-- Milestone 8 · role × read-surface visibility matrix.
--
-- READ-ONLY and ROLLED BACK. Run it BEFORE the caregiver migrations and again
-- AFTER; every BEFORE row must appear unchanged in AFTER. This file is the
-- acceptance evidence for "prove the four existing roles are unaffected".
--
--   npx supabase db query --linked -f docs/deployment/milestone-8-role-probe-read.sql -o csv > before-read.csv
--   ... apply migrations ...
--   npx supabase db query --linked -f docs/deployment/milestone-8-role-probe-read.sql -o csv > after-read.csv
--   diff before-read.csv after-read.csv
--
-- ── WHY IT LOOKS LIKE THIS ───────────────────────────────────────────────────
--
--  * A TABLE-ONLY matrix would miss the real regression surface. Part of this app's
--    "transparent circle" posture is delivered through SECURITY DEFINER RPCs that
--    bypass RLS entirely — `list_care_activity` returns every row regardless of the
--    caller's `can_view_all_operational`. A migration could change what the existing
--    roles see with ZERO change to any table policy, so the RPC read paths are
--    probed too.
--
--    (Historical note: this paragraph used to cite "a `family_member` whose
--    `can_view_all_operational` is FALSE" as the example. Since D1, applied
--    2026-08-07, family_member is INSIDE that function; the roles it excludes are
--    now `caregiver` and `elder`. The reasoning is unchanged — only the example
--    role was.)
--
--  * It records SQLSTATE alongside every count. A missing GRANT (42501) and an
--    RLS filter (0 rows) both produce a small number, but only one of them is a
--    security regression. `remote_member` is currently REFUSED the claim feed
--    outright; a count-only matrix would record that refusal turning into a
--    success as ordinary data drift.
--
--  * Identity is (circle ordinal, role, per-role ordinal) — never a uid, name or
--    email. The ordinal is partitioned BY ROLE so that adding a caregiver member
--    cannot renumber any existing role's members and make the diff lie.
--
--  * The probe population is materialised as `postgres` BEFORE the first role
--    switch. A plpgsql FOR cursor fetches lazily, and `authenticated` cannot
--    read `circle_members` freely, so a lazily-fetched cursor would come up
--    empty half way through.
--
--  * `postgres` is `rolbypassrls = true` and no table has FORCE ROW LEVEL
--    SECURITY, so forgetting the role switch would return full row counts for
--    every role and the matrix would "pass" while testing nothing. The script
--    therefore ASSERTS `current_user = 'authenticated'` before it counts.
--
--  * The `cron` group (notifications / outbox / deliveries / push tokens) is a
--    MOVING TARGET — five pg_cron jobs write to those tables every 5–15 minutes.
--    They are probed and labelled so they can be excluded from the strict diff
--    rather than silently omitted.

begin;

do $$
declare
  m       record;
  probe   text;
  grp     text;
  arr     text[];
  n       bigint;
  st      text;
  acc     jsonb := '[]'::jsonb;
  members jsonb;
  -- The 11 circle-operational tables: what the milestone is actually about.
  core    text[] := array['care_recipients','medications','medication_schedules',
                          'medication_logs','care_tasks','care_appointments',
                          'vital_readings','family_visits','daily_care_logs',
                          'doctors','emergency_contacts'];
  -- Structure + identity.
  struc   text[] := array['care_circles','circle_members','circle_invitations','profiles'];
  -- Cron-driven, counts move on their own — labelled, not trusted.
  cron    text[] := array['notifications','notification_preferences','push_tokens',
                          'notification_outbox','notification_push_deliveries'];
begin
  -- Transaction-local only: a bare SET would survive COMMIT and leak into every
  -- later statement on the same pooled connection.
  perform set_config('search_path', 'pg_catalog, public', true);

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

    -- ── table layer ──────────────────────────────────────────────────────────
    foreach grp in array array['core','struct','cron'] loop
      if    grp = 'core'   then arr := core;
      elsif grp = 'struct' then arr := struc;
      else                      arr := cron;
      end if;

      foreach probe in array arr loop
        begin
          execute format('select count(*) from public.%I', probe) into n;
          st := 'ok';
        exception when others then n := -1; st := sqlstate;
        end;
        acc := acc || jsonb_build_object('grp', grp, 'circle', m.circle,
                 'role', m.role, 'ord', m.ord, 'kind', 'table',
                 'probe', probe, 'visible', n, 'sqlstate', st);
      end loop;
    end loop;

    -- ── SECURITY DEFINER read paths — where the transparency actually lives ──
    begin
      execute format('select count(*) from public.list_available_to_claim(%L)', m.cid) into n;
      st := 'ok';
    exception when others then n := -1; st := sqlstate;
    end;
    acc := acc || jsonb_build_object('grp','rpc','circle',m.circle,'role',m.role,
             'ord',m.ord,'kind','rpc','probe','list_available_to_claim',
             'visible',n,'sqlstate',st);

    begin
      execute format('select count(*) from public.list_care_activity(%L, 500, null)', m.cid) into n;
      st := 'ok';
    exception when others then n := -1; st := sqlstate;
    end;
    acc := acc || jsonb_build_object('grp','rpc','circle',m.circle,'role',m.role,
             'ord',m.ord,'kind','rpc','probe','list_care_activity',
             'visible',n,'sqlstate',st);

    begin
      execute format('select count(*) from public.list_circle_members(%L)', m.cid) into n;
      st := 'ok';
    exception when others then n := -1; st := sqlstate;
    end;
    acc := acc || jsonb_build_object('grp','rpc','circle',m.circle,'role',m.role,
             'ord',m.ord,'kind','rpc','probe','list_circle_members',
             'visible',n,'sqlstate',st);

    begin
      execute format('select count(*) from public.list_circle_invitations(%L)', m.cid) into n;
      st := 'ok';
    exception when others then n := -1; st := sqlstate;
    end;
    acc := acc || jsonb_build_object('grp','rpc','circle',m.circle,'role',m.role,
             'ord',m.ord,'kind','rpc','probe','list_circle_invitations',
             'visible',n,'sqlstate',st);

    begin
      execute format('select (public.can_view_all_operational(%L))::int', m.cid) into n;
      st := 'ok';
    exception when others then n := -1; st := sqlstate;
    end;
    acc := acc || jsonb_build_object('grp','rpc','circle',m.circle,'role',m.role,
             'ord',m.ord,'kind','rpc','probe','can_view_all_operational',
             'visible',n,'sqlstate',st);

    execute 'reset role';
  end loop;

  perform set_config('probe.matrix', acc::text, true);
end
$$;

-- The --linked transport returns only the LAST result set, so the whole matrix
-- is emitted here. Deterministic ordering means `diff` is the whole comparison.
select x.grp, x.circle, x.role, x.ord, x.kind, x.probe, x.visible, x.sqlstate
from jsonb_to_recordset(current_setting('probe.matrix')::jsonb)
       as x(grp text, circle int, role text, ord int, kind text,
            probe text, visible bigint, sqlstate text)
order by x.grp, x.circle, x.role, x.ord, x.kind, x.probe;

rollback;
