-- Step 5.0 — Membership & invitation RPCs (the sensitive operations).
--
-- All functions here are SECURITY DEFINER with `set search_path = ''` and every
-- object schema-qualified, mirroring create_care_circle / the RLS helpers. As
-- definers owned by the privileged role they bypass RLS, so authorization is
-- enforced EXPLICITLY inside each function:
--   * auth.uid() must be present (no anonymous access),
--   * the caller's ACTIVE membership + role in the *target* circle is checked,
--   * a role hierarchy gates who may invite / promote / remove whom,
--   * the LAST active administrator can never be demoted, removed, or leave,
--   * cross-circle access is impossible (everything keys off the row's circle).
-- Execute is revoked from public and granted only to authenticated.
--
-- Role model (matches the existing circle_role enum and every RLS policy):
--   managers      = {admin, primary_caregiver}
--   admin         = circle owner / top role; only an admin may grant or change
--                   the admin role, and admin is never an invitable role.
--   primary_caregiver may invite / assign only collaboration roles
--                   {family_member, caregiver, remote_member, elder}; it may
--                   never grant admin or primary_caregiver.
-- Member statuses used: 'active' and 'removed' ('removed' == left/deactivated).
-- Self-leave IS supported (leave_care_circle), except for the final admin.
--
-- Idempotent / safe to re-run: every function is create-or-replace with
-- re-asserted revoke/grant. No table/enum/policy/data changes.

-- ── Caller's active role in a circle (null if not an active member) ───────────
create or replace function public.active_circle_member_role(p_circle_id uuid)
returns public.circle_role
language sql
stable
security definer
set search_path = ''
as $$
  select cm.role
  from public.circle_members cm
  where cm.circle_id = p_circle_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
  limit 1;
$$;

revoke all on function public.active_circle_member_role(uuid) from public;
grant execute on function public.active_circle_member_role(uuid) to authenticated;

-- ── create_circle_invitation ─────────────────────────────────────────────────
-- Manager-only. Generates a unique raw code, stores only its hash, and returns
-- the RAW code exactly once to the inviter. Enforces the role-grant hierarchy.
create or replace function public.create_circle_invitation(
  p_circle_id uuid,
  p_role public.circle_role,
  p_invited_name text default null,
  p_invited_email text default null
)
returns table (
  invitation_id uuid,
  code text,
  role public.circle_role,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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
  -- Least-privilege: caregiver / elder are NOT yet activated — their dedicated
  -- least-privilege RLS is deferred (see report §26). Reject them server-side so
  -- no hidden UI option or hand-crafted request can assign them. Allowed
  -- invitation roles: primary_caregiver (admin only), family_member, remote_member.
  if p_role in ('caregiver', 'elder') then
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
$$;

revoke all on function public.create_circle_invitation(uuid, public.circle_role, text, text) from public;
grant execute on function public.create_circle_invitation(uuid, public.circle_role, text, text) to authenticated;

-- ── accept_circle_invitation ─────────────────────────────────────────────────
-- Any authenticated user. Locks the matching pending invitation, validates it,
-- inserts or reactivates the caller's membership, and marks the invitation used
-- — all atomically, so a code can be accepted exactly once (replay/race safe).
create or replace function public.accept_circle_invitation(p_code text)
returns table (
  circle_id uuid,
  membership_id uuid,
  role public.circle_role
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_inv public.circle_invitations%rowtype;
  v_member_id uuid;
  v_member_status public.member_status;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  v_hash := public.hash_invitation_code(p_code);

  -- Lock the invitation row so two concurrent accepts serialize; the second one
  -- re-reads the row as 'accepted' and is rejected below.
  select * into v_inv
  from public.circle_invitations ci
  where ci.code_hash = v_hash
  for update;

  if not found then
    raise exception 'invalid invitation code' using errcode = 'P0002';
  end if;

  if v_inv.status = 'accepted' then
    raise exception 'this invitation has already been used' using errcode = '22023';
  end if;
  if v_inv.status = 'revoked' then
    raise exception 'this invitation has been revoked' using errcode = '22023';
  end if;
  if v_inv.status = 'expired' or v_inv.expires_at <= now() then
    -- (No status write here: the raise would roll it back anyway. Past-due
    -- 'pending' rows are surfaced as 'expired' by list_circle_invitations.)
    raise exception 'this invitation has expired' using errcode = '22023';
  end if;
  -- status is 'pending' and not expired from here.

  select cm.id, cm.status into v_member_id, v_member_status
  from public.circle_members cm
  where cm.circle_id = v_inv.circle_id
    and cm.user_id = v_uid
  limit 1;

  if v_member_id is not null and v_member_status = 'active' then
    -- Already an active member: reject cleanly WITHOUT consuming the invitation.
    raise exception 'you are already a member of this circle' using errcode = '23505';
  elsif v_member_id is not null then
    -- Re-joining (was removed/invited): reactivate with the invitation's role.
    update public.circle_members
      set status = 'active', role = v_inv.role
      where id = v_member_id;
  else
    insert into public.circle_members (circle_id, user_id, role, status)
    values (v_inv.circle_id, v_uid, v_inv.role, 'active')
    returning id into v_member_id;
  end if;

  update public.circle_invitations
    set status = 'accepted', accepted_by = v_uid, accepted_at = now()
    where id = v_inv.id;

  circle_id := v_inv.circle_id;
  membership_id := v_member_id;
  role := v_inv.role;
  return next;
end;
$$;

revoke all on function public.accept_circle_invitation(text) from public;
grant execute on function public.accept_circle_invitation(text) to authenticated;

-- ── revoke_circle_invitation ─────────────────────────────────────────────────
-- Manager-only; only a still-pending invitation can be revoked.
create or replace function public.revoke_circle_invitation(p_invitation_id uuid)
returns table (
  invitation_id uuid,
  status public.invitation_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.circle_invitations%rowtype;
  v_actor public.circle_role;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_inv
  from public.circle_invitations ci
  where ci.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  -- NB: a non-member yields NULL; the `is null` guard is REQUIRED because
  -- `NULL not in (...)` is NULL (not true) and would let a non-manager /
  -- cross-circle caller slip through.
  v_actor := public.active_circle_member_role(v_inv.circle_id);
  if v_actor is null or v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can revoke invitations' using errcode = '42501';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'only pending invitations can be revoked' using errcode = '22023';
  end if;

  update public.circle_invitations
    set status = 'revoked'
    where id = p_invitation_id;

  invitation_id := p_invitation_id;
  status := 'revoked';
  return next;
end;
$$;

revoke all on function public.revoke_circle_invitation(uuid) from public;
grant execute on function public.revoke_circle_invitation(uuid) to authenticated;

-- ── list_circle_invitations ──────────────────────────────────────────────────
-- Manager-only. Returns safe invitation columns for the manager UI — NEVER the
-- code_hash (the raw code is irrecoverable and is shown only at create time).
-- Marks past-due 'pending' rows as 'expired' in the returned status (display
-- only; the stored value is corrected lazily on accept).
create or replace function public.list_circle_invitations(p_circle_id uuid)
returns table (
  id uuid,
  role public.circle_role,
  status public.invitation_status,
  invited_name text,
  invited_email text,
  created_by uuid,
  created_by_name text,
  accepted_by uuid,
  accepted_by_name text,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor public.circle_role;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  -- `is null` guard required (NULL not in (...) is NULL, not true).
  v_actor := public.active_circle_member_role(p_circle_id);
  if v_actor is null or v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can view invitations' using errcode = '42501';
  end if;

  return query
  select
    ci.id,
    ci.role,
    case
      when ci.status = 'pending' and ci.expires_at <= now() then 'expired'::public.invitation_status
      else ci.status
    end,
    ci.invited_name,
    ci.invited_email,
    ci.created_by,
    cp.full_name,
    ci.accepted_by,
    ap.full_name,
    ci.accepted_at,
    ci.expires_at,
    ci.created_at
  from public.circle_invitations ci
  left join public.profiles cp on cp.id = ci.created_by
  left join public.profiles ap on ap.id = ci.accepted_by
  where ci.circle_id = p_circle_id
  order by ci.created_at desc;
end;
$$;

revoke all on function public.list_circle_invitations(uuid) from public;
grant execute on function public.list_circle_invitations(uuid) to authenticated;

-- ── list_circle_members ──────────────────────────────────────────────────────
-- Any ACTIVE member of the circle may view the roster (active + inactive) with
-- each member's display name, role and status, plus `is_self` / `is_owner` flags.
-- EMAIL PRIVACY: a member's email (from auth.users, which the client cannot read
-- directly) is returned only to managers and to the member themselves; for other
-- members it is NULL. `is_owner` marks the user the circle's owner_id points to.
create or replace function public.list_circle_members(p_circle_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  role public.circle_role,
  status public.member_status,
  full_name text,
  email text,
  is_self boolean,
  is_owner boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.circle_role;
  v_is_manager boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  v_role := public.active_circle_member_role(p_circle_id);
  if v_role is null then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  v_is_manager := v_role in ('admin', 'primary_caregiver');

  return query
  select
    cm.id,
    cm.user_id,
    cm.role,
    cm.status,
    p.full_name,
    -- Managers see every email; anyone sees their own; others get NULL.
    case when v_is_manager or cm.user_id = auth.uid() then u.email::text else null end,
    (cm.user_id = auth.uid()),
    (cm.user_id = cc.owner_id),
    cm.created_at
  from public.circle_members cm
  join public.care_circles cc on cc.id = cm.circle_id
  left join public.profiles p on p.id = cm.user_id
  left join auth.users u on u.id = cm.user_id
  where cm.circle_id = p_circle_id
  order by
    case cm.status when 'active' then 0 else 1 end,
    case cm.role
      when 'admin' then 0
      when 'primary_caregiver' then 1
      when 'caregiver' then 2
      when 'family_member' then 3
      when 'remote_member' then 4
      else 5
    end,
    cm.created_at asc;
end;
$$;

revoke all on function public.list_circle_members(uuid) from public;
grant execute on function public.list_circle_members(uuid) to authenticated;

-- ── update_circle_member_role ────────────────────────────────────────────────
-- Manager-only, with the full role hierarchy + last-admin protection.
create or replace function public.update_circle_member_role(
  p_member_id uuid,
  p_role public.circle_role
)
returns table (
  member_id uuid,
  role public.circle_role,
  status public.member_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.circle_role;
  v_target public.circle_members%rowtype;
  v_other_admins int;
  v_owner uuid;
  v_circle uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Resolve the target's circle WITHOUT locking the member, so the locks are
  -- taken in the canonical order (circle FIRST, then member). Locking the circle
  -- row serializes every admin/owner-affecting change on that circle and closes
  -- the concurrent last-admin race: without it, two admins each leaving / being
  -- demoted could each still count the other as active before either commits,
  -- leaving the circle with zero active admins.
  select cm.circle_id into v_circle
  from public.circle_members cm
  where cm.id = p_member_id;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  -- 1) Lock the circle row first (also yields owner_id for the owner guard).
  select cc.owner_id into v_owner
  from public.care_circles cc
  where cc.id = v_circle
  for update;

  -- 2) Lock + re-read the target membership UNDER the circle lock; revalidate it
  --    still exists and belongs to this circle.
  select * into v_target
  from public.circle_members cm
  where cm.id = p_member_id
  for update;
  if not found or v_target.circle_id <> v_circle then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  -- `is null` guard required: a non-member/cross-circle caller yields NULL and
  -- `NULL not in (...)` is NULL (not true), which would otherwise bypass this.
  v_actor := public.active_circle_member_role(v_target.circle_id);
  if v_actor is null or v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can change roles' using errcode = '42501';
  end if;

  -- Least-privilege: caregiver / elder are not yet activated; reject assigning
  -- them (mirrors create_circle_invitation, report §26). Deferred until their
  -- dedicated least-privilege RLS exists.
  if p_role in ('caregiver', 'elder') then
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
$$;

revoke all on function public.update_circle_member_role(uuid, public.circle_role) from public;
grant execute on function public.update_circle_member_role(uuid, public.circle_role) to authenticated;

-- ── update_circle_member_status ──────────────────────────────────────────────
-- Manager-only. Supports 'active' (reactivate) and 'removed' (deactivate/remove).
-- A primary caregiver cannot change a manager peer's status, and the final
-- active admin can never be removed/deactivated.
create or replace function public.update_circle_member_status(
  p_member_id uuid,
  p_status public.member_status
)
returns table (
  member_id uuid,
  role public.circle_role,
  status public.member_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.circle_role;
  v_target public.circle_members%rowtype;
  v_other_admins int;
  v_owner uuid;
  v_circle uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_status not in ('active', 'removed') then
    raise exception 'status must be active or removed' using errcode = '22023';
  end if;

  -- Resolve the target's circle WITHOUT locking the member, so the locks are
  -- taken in the canonical order (circle FIRST, then member). Locking the circle
  -- row serializes every admin/owner-affecting change on that circle and closes
  -- the concurrent last-admin race: without it, two admins each leaving / being
  -- demoted could each still count the other as active before either commits,
  -- leaving the circle with zero active admins.
  select cm.circle_id into v_circle
  from public.circle_members cm
  where cm.id = p_member_id;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  -- 1) Lock the circle row first (also yields owner_id for the owner guard).
  select cc.owner_id into v_owner
  from public.care_circles cc
  where cc.id = v_circle
  for update;

  -- 2) Lock + re-read the target membership UNDER the circle lock; revalidate it
  --    still exists and belongs to this circle.
  select * into v_target
  from public.circle_members cm
  where cm.id = p_member_id
  for update;
  if not found or v_target.circle_id <> v_circle then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  -- `is null` guard required (see update_circle_member_role).
  v_actor := public.active_circle_member_role(v_target.circle_id);
  if v_actor is null or v_actor not in ('admin', 'primary_caregiver') then
    raise exception 'only managers can change membership status' using errcode = '42501';
  end if;

  -- Only an admin may change an admin's status; a primary caregiver may not
  -- touch a manager peer (admin or primary_caregiver), except themselves.
  if v_target.role = 'admin' and v_actor <> 'admin' then
    raise exception 'only an admin can change an administrator''s status' using errcode = '42501';
  end if;
  if v_actor = 'primary_caregiver'
     and v_target.user_id <> v_uid
     and v_target.role in ('admin', 'primary_caregiver') then
    raise exception 'a primary caregiver cannot change another manager''s status' using errcode = '42501';
  end if;

  -- Owner guard: the owner may not be removed/deactivated until ownership moves.
  if v_target.user_id = v_owner and p_status <> 'active' then
    raise exception 'the circle owner cannot be removed; transfer ownership first'
      using errcode = '23514';
  end if;

  -- Last-admin protection: deactivating/removing an active admin requires
  -- another active admin to remain.
  if v_target.role = 'admin' and v_target.status = 'active' and p_status <> 'active' then
    select count(*) into v_other_admins
    from public.circle_members cm
    where cm.circle_id = v_target.circle_id
      and cm.role = 'admin'
      and cm.status = 'active'
      and cm.id <> p_member_id;
    if v_other_admins = 0 then
      raise exception 'cannot remove the last administrator' using errcode = '23514';
    end if;
  end if;

  update public.circle_members cm
    set status = p_status
    where cm.id = p_member_id;

  member_id := p_member_id;
  role := v_target.role;
  status := p_status;
  return next;
end;
$$;

revoke all on function public.update_circle_member_status(uuid, public.member_status) from public;
grant execute on function public.update_circle_member_status(uuid, public.member_status) to authenticated;

-- ── leave_care_circle ────────────────────────────────────────────────────────
-- Any active member may leave (sets their own membership to 'removed'). The
-- final active admin cannot leave without first transferring the admin role.
create or replace function public.leave_care_circle(p_circle_id uuid)
returns table (
  circle_id uuid,
  membership_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.circle_members%rowtype;
  v_other_admins int;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Canonical lock order: lock the circle row FIRST, then the caller's
  -- membership. This serializes leave against concurrent demote / remove /
  -- transfer on the same circle, closing the last-admin race.
  select cc.owner_id into v_owner
  from public.care_circles cc
  where cc.id = p_circle_id
  for update;
  if not found then
    raise exception 'circle not found' using errcode = 'P0002';
  end if;
  -- The circle owner cannot leave until ownership is transferred.
  if v_owner = v_uid then
    raise exception 'the circle owner cannot leave; transfer ownership first'
      using errcode = '23514';
  end if;

  select * into v_member
  from public.circle_members cm
  where cm.circle_id = p_circle_id
    and cm.user_id = v_uid
    and cm.status = 'active'
  for update;
  if not found then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;

  if v_member.role = 'admin' then
    select count(*) into v_other_admins
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.role = 'admin'
      and cm.status = 'active'
      and cm.id <> v_member.id;
    if v_other_admins = 0 then
      raise exception 'the last administrator cannot leave; transfer the admin role first'
        using errcode = '23514';
    end if;
  end if;

  update public.circle_members cm
    set status = 'removed'
    where cm.id = v_member.id;

  circle_id := p_circle_id;
  membership_id := v_member.id;
  return next;
end;
$$;

revoke all on function public.leave_care_circle(uuid) from public;
grant execute on function public.leave_care_circle(uuid) to authenticated;
