-- Milestone 9 · A1 — revoke `authenticated` EXECUTE on the service-role-only
-- functions in `public`.
--
-- ── WHAT THIS CLOSES ─────────────────────────────────────────────────────────
--
-- Any signed-in user — including a hired caregiver, the least-privileged role in
-- the product — could call every SECURITY DEFINER function in `public`, because
-- `authenticated` held EXECUTE on all of them. The three that matter most:
--
--   * `claim_push_deliveries` returns delivery rows carrying RAW Expo push
--     tokens, for the WHOLE INSTANCE, across every circle. It is also the
--     send-time claim gate, so calling it repeatedly lets a caller claim and
--     abandon the queue — silently suppressing medication and EMERGENCY pushes
--     for every user.
--   * `enqueue_notification` writes an arbitrary notification to any account.
--     Its only membership guard is skipped when `p_circle_id` is null, and an
--     `emergency` row bypasses quiet hours.
--   * `circle_notification_recipients` / `notification_item_managers` /
--     `daily_summary_recipients` return a circle's full member list, defeating
--     both Milestone 8 roster guards (the RESTRICTIVE `circle_members` policy
--     and the 42501 that `list_circle_members` raises for a caregiver).
--
-- ── WHY IT WAS OPEN, AND WHY THIS IS NOT A SURPRISE ──────────────────────────
--
-- Milestone 7 H1 (20260726150000) revoked EXECUTE from `anon` and from PUBLIC on
-- all 65 functions and deliberately stopped there. Its own closing section says
-- so, and names almost exactly this list:
--
--     "`authenticated` EXECUTE is left in place on all 65, including the internal
--      plumbing (`enqueue_notification`, `fanout_due_notifications`,
--      `claim_push_deliveries`, `mark_delivery_*`, `set_updated_at`). Tightening
--      those is a separate, behaviour-affecting decision."
--
-- This file is that deferred decision. Note that `revoke ... from public` never
-- removed it: Supabase's `pg_default_acl` hands `authenticated` an EXPLICIT
-- grant on every function created in `public`, and revoking PUBLIC does not touch
-- an explicit named-role grant — the same mechanism H1 documented for `anon`.
--
-- ── HOW THE LIST WAS DERIVED (from callers, never from names) ────────────────
--
-- `scripts/analyze-function-grants.js` cross-references all 66 functions against
-- every route by which a caller could need EXECUTE, then each candidate was
-- independently re-checked by an adversarial pass instructed to prove the revoke
-- UNSAFE. All 30 survived; none was downgraded.
--
-- The routes that keep a function OUT of this list, and the traps in each:
--
--   1. A client `supabase.rpc()` in src/ or lib/. 25 functions qualify.
--      TRAP: `deactivate_push_token` (client) vs `deactivate_push_token_by_id` /
--      `_value` (edge-only). Nearly identical names, opposite classification.
--
--   2. A user-scoped call inside an edge function. `delete-account` calls
--      `account_deletion_preflight` on `userClient(req)`, which runs as
--      `authenticated`, NOT service_role — so it KEEPS the grant.
--      TRAP: the delivery pipeline is invoked as `rpcChecked(sb, 'name', ...)`,
--      where the name is the SECOND argument. A grep for `.rpc('name'` misses
--      every one of them. Verified: no `rpcChecked` anywhere uses a user client.
--
--   3. A reference in an RLS policy expression — evaluated as the QUERYING role.
--      TRAP: the dose-proof storage policies live in
--      `docs/deployment/dose-proof-storage.sql`, OUTSIDE supabase/migrations/,
--      and call `public.storage_path_uuid()`. Scanning only the migrations makes
--      it look unused; revoking it breaks every dose-photo read. It KEEPS the
--      grant, as do `can_view_all_operational`, `is_circle_member` and
--      `is_responsible_for_medication`, which those same policies call.
--
--   4. A CHECK constraint, DEFAULT, generated column, view or index expression —
--      all evaluated as the writing/querying role.
--
--   5. A call from inside a SECURITY INVOKER function, which runs as the caller.
--      A DEFINER body runs as its owner (`postgres`), so nested calls there do
--      NOT require the caller to hold EXECUTE. This is what makes group B safe.
--
--   6. Trigger use. This one is the reverse trap — it looks like a reason to keep
--      the grant and is not. PostgreSQL checks EXECUTE on a trigger function when
--      the trigger is CREATED, not when it fires. H1 probed this empirically on
--      this very instance inside a rolled-back transaction: with EXECUTE revoked
--      from PUBLIC, anon, authenticated AND service_role, an UPDATE as
--      `authenticated` still fired `set_updated_at()`. Group C relies on that.
--
-- ── WHAT THIS DOES NOT TOUCH ─────────────────────────────────────────────────
--
--   * `service_role` keeps EXECUTE everywhere. The edge functions and cron jobs
--     are unaffected, and the assertion block below proves it for every function
--     they actually call.
--   * No policy, table grant, or function BODY changes. This file moves function
--     privileges only, so no role's visible data may move by a single row — which
--     is exactly what the before/after read matrix in the runbook checks.
--
-- DEPLOY MANUALLY. See docs/deployment/milestone-9-tier-1-runbook.md for the
-- before/after probes and the stop-conditions.

do $$
declare
  -- A. Invoked by an edge function on the SERVICE client (cron-driven pipeline).
  --    These must KEEP service_role; the assertion block proves they did.
  grp_a constant text[] := array[
    'circle_notification_recipients',
    'daily_summary_recipients',
    'notification_item_managers',
    'notification_recipients_for_item_event',
    'enqueue_notification',
    'fanout_due_notifications',
    'claim_push_deliveries',
    'mark_delivery_sent',
    'mark_delivery_failed',
    'mark_delivery_skipped',
    'mark_stale_receipts_unchecked',
    'record_delivery_receipt',
    'deactivate_push_token_by_id',
    'deactivate_push_token_value'
  ];

  -- B. Reached ONLY from inside another SECURITY DEFINER function, which executes
  --    as its owner — so no caller role needs EXECUTE at all.
  grp_b constant text[] := array[
    'effective_notification_prefs',
    'notification_recipient_eligible',
    'notification_recipient_current',
    'notification_item_owner',
    'notification_source_validity',
    'notification_defer_until',
    'active_circle_member_role',
    'generate_invitation_code',
    'hash_invitation_code',
    'normalize_invitation_code',
    'is_valid_timezone'
  ];

  -- C. Trigger functions. EXECUTE is checked at CREATE TRIGGER time, not at fire
  --    time (H1 probed this), so revoking is defence-in-depth with no behaviour
  --    change: it stops a signed-in user calling them directly.
  grp_c constant text[] := array[
    'set_updated_at',
    'handle_new_user',
    'enforce_care_task_collaborator_scope',
    'enforce_family_visit_collaborator_scope'
  ];

  -- D. Dead. No caller in ANY layer — no client rpc, no edge call, no policy, no
  --    function body, no trigger. Superseded by
  --    `is_circle_medication_schedule_for_medication`. Listed separately rather
  --    than blurred into the groups above so the intent stays legible; it should
  --    be DROPPED outright in a later pass, which is out of scope for Tier 1.
  grp_d constant text[] := array[
    'is_circle_medication_schedule'
  ];

  targets constant text[] := grp_a || grp_b || grp_c || grp_d;
  fname   text;
  r       record;
  n       integer;
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  foreach fname in array targets loop
    -- Resolve by name and assert the name is unambiguous. If someone later adds
    -- an overload, one of the two might legitimately need `authenticated`, so
    -- fail loudly here rather than revoke both.
    select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = fname;

    if n = 0 then
      raise exception 'M9 A1: function public.% does not exist', fname;
    elsif n > 1 then
      raise exception
        'M9 A1: public.% has % overloads; resolve them explicitly before revoking', fname, n;
    end if;

    for r in
      select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname = fname
    loop
      -- `service_role` is deliberately untouched.
      execute format('revoke execute on function %s from authenticated', r.sig);
      -- Belt and braces; H1 already cleared PUBLIC schema-wide, so this is a
      -- no-op today and keeps the file correct on a database that lacks H1.
      execute format('revoke execute on function %s from public', r.sig);
    end loop;
  end loop;
end;
$$;

-- ── Acceptance assertions ────────────────────────────────────────────────────
--
-- Proves the change in BOTH directions. The forward half (the named functions
-- lost `authenticated`) shows the revoke landed. The reverse half — a control set
-- of member-facing functions that MUST still be reachable — is the regression
-- guard, and is the half that would have caught this migration revoking one
-- function too many.
--
-- The control set is not exhaustive by design; the enumerating proof is
-- docs/deployment/milestone-9-execute-privilege-probe.sql, which reads pg_proc
-- itself and so also covers functions nobody remembered.

do $$
declare
  revoked constant text[] := array[
    'circle_notification_recipients','daily_summary_recipients','notification_item_managers',
    'notification_recipients_for_item_event','enqueue_notification','fanout_due_notifications',
    'claim_push_deliveries','mark_delivery_sent','mark_delivery_failed','mark_delivery_skipped',
    'mark_stale_receipts_unchecked','record_delivery_receipt','deactivate_push_token_by_id',
    'deactivate_push_token_value','effective_notification_prefs','notification_recipient_eligible',
    'notification_recipient_current','notification_item_owner','notification_source_validity',
    'notification_defer_until','active_circle_member_role','generate_invitation_code',
    'hash_invitation_code','normalize_invitation_code','is_valid_timezone','set_updated_at',
    'handle_new_user','enforce_care_task_collaborator_scope',
    'enforce_family_visit_collaborator_scope','is_circle_medication_schedule'
  ];

  -- Called by an edge function on the service client: losing service_role here
  -- would stop every reminder, digest and push receipt in the product.
  needs_service constant text[] := array[
    'circle_notification_recipients','daily_summary_recipients','notification_item_managers',
    'notification_recipients_for_item_event','enqueue_notification','fanout_due_notifications',
    'claim_push_deliveries','mark_delivery_sent','mark_delivery_failed','mark_delivery_skipped',
    'mark_stale_receipts_unchecked','record_delivery_receipt','deactivate_push_token_by_id',
    'deactivate_push_token_value'
  ];

  -- MUST still be executable by `authenticated`.
  --   * RLS + storage policy helpers — a revoke here breaks every read for every
  --     role, which is the exact regression this milestone is guarding against.
  --   * `account_deletion_preflight` — called on a USER-scoped client inside the
  --     delete-account edge function.
  --   * A representative slice of the client RPC surface.
  keep constant text[] := array[
    'has_circle_role','is_circle_member','is_active_user_circle_member',
    'can_view_all_operational','is_circle_caregiver','is_responsible_for_medication',
    'is_circle_medication','is_circle_medication_schedule_for_medication','is_circle_doctor',
    'is_user_circle_member','storage_path_uuid',
    'account_deletion_preflight',
    'create_care_circle','accept_circle_invitation','create_circle_invitation',
    'list_circle_members','list_care_activity','list_available_to_claim',
    'claim_care_task','claim_medication_responsibility','register_push_token',
    'deactivate_push_token','set_notification_read','mark_all_notifications_read',
    'upsert_notification_preferences','set_circle_timezone','set_missed_dose_grace_minutes',
    'update_circle_member_role','transfer_circle_ownership','leave_care_circle'
  ];

  fname text;
  oid_  oid;
  bad   text;
begin
  perform set_config('search_path', 'pg_catalog, public', true);

  foreach fname in array revoked loop
    select p.oid into oid_
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = fname;

    if has_function_privilege('authenticated', oid_, 'EXECUTE') then
      bad := coalesce(bad || ', ', '') || fname;
    end if;
    if has_function_privilege('anon', oid_, 'EXECUTE') then
      raise exception 'M9 A1 failed: public.% is anon-executable — the H1 rule regressed', fname;
    end if;
  end loop;
  if bad is not null then
    raise exception 'M9 A1 failed: authenticated still holds EXECUTE on: %', bad;
  end if;

  foreach fname in array needs_service loop
    select p.oid into oid_
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = fname;

    if not has_function_privilege('service_role', oid_, 'EXECUTE') then
      raise exception
        'M9 A1 failed: service_role lost EXECUTE on public.% — the notification pipeline would stop', fname;
    end if;
  end loop;

  bad := null;
  foreach fname in array keep loop
    select p.oid into oid_
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = fname;

    if oid_ is null then
      raise exception 'M9 A1 failed: control function public.% not found', fname;
    end if;
    if not has_function_privilege('authenticated', oid_, 'EXECUTE') then
      bad := coalesce(bad || ', ', '') || fname;
    end if;
  end loop;
  if bad is not null then
    raise exception
      'M9 A1 failed: authenticated LOST EXECUTE on member-facing function(s): % — this would break the app', bad;
  end if;

  raise notice
    'M9 A1 verified: % functions revoked from authenticated, % still service_role-executable, % control functions still authenticated-executable',
    array_length(revoked, 1), array_length(needs_service, 1), array_length(keep, 1);
end;
$$;

-- ── Undo (documentation, not executed) ───────────────────────────────────────
--
-- Restores the pre-migration state exactly. After applying it,
-- docs/deployment/milestone-9-execute-privilege-probe.sql should reproduce
-- before-exec.csv byte for byte.
--
--   do $$
--   declare fname text; r record;
--   begin
--     foreach fname in array array[
--       'circle_notification_recipients','daily_summary_recipients','notification_item_managers',
--       'notification_recipients_for_item_event','enqueue_notification','fanout_due_notifications',
--       'claim_push_deliveries','mark_delivery_sent','mark_delivery_failed','mark_delivery_skipped',
--       'mark_stale_receipts_unchecked','record_delivery_receipt','deactivate_push_token_by_id',
--       'deactivate_push_token_value','effective_notification_prefs','notification_recipient_eligible',
--       'notification_recipient_current','notification_item_owner','notification_source_validity',
--       'notification_defer_until','active_circle_member_role','generate_invitation_code',
--       'hash_invitation_code','normalize_invitation_code','is_valid_timezone','set_updated_at',
--       'handle_new_user','enforce_care_task_collaborator_scope',
--       'enforce_family_visit_collaborator_scope','is_circle_medication_schedule'
--     ] loop
--       for r in select p.oid::regprocedure as sig from pg_proc p
--                join pg_namespace ns on ns.oid = p.pronamespace
--                where ns.nspname = 'public' and p.proname = fname
--       loop
--         execute format('grant execute on function %s to authenticated', r.sig);
--       end loop;
--     end loop;
--   end $$;
