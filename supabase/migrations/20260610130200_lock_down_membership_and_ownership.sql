-- Step 5.0 hardening — lock down direct membership/ownership mutation + ownership transfer.
--
-- The Step 5.0 RPCs enforce role hierarchy, primary-caregiver limits, last-admin
-- and owner protection. But those checks live INSIDE the SECURITY DEFINER RPCs;
-- they are bypassed if a client can still mutate `circle_members` (or
-- `care_circles.owner_id`) directly through PostgREST under the old permissive
-- policies. This migration removes those direct-write paths so EVERY membership
-- and ownership change must go through the audited RPCs:
--
--   create_care_circle, accept_circle_invitation        -> create / reactivate
--   update_circle_member_role, update_circle_member_status,
--   leave_care_circle, transfer_circle_ownership         -> role / status / owner
--
-- The client never writes circle_members or care_circles directly (verified: it
-- only SELECTs id/name/role), so this is a zero-regression lockdown. The
-- SECURITY DEFINER functions are owned by the table owner and so continue to
-- write above RLS / column privileges.
--
-- Idempotent / safe to re-run: drop-policy-if-exists, idempotent revoke, and a
-- create-or-replace function with re-asserted revoke/grant. No data writes.

-- ── 1. circle_members: RPC-only writes (keep SELECT) ──────────────────────────
-- BEFORE: three policies from the initial schema — a member SELECT, an owner-
-- bootstrap INSERT ("Circle owners can add initial membership") and a manager
-- UPDATE ("Circle admins can manage members"). The INSERT/UPDATE policies are
-- what allowed bypassing the RPC protections.
-- AFTER: only the SELECT policy remains; the base INSERT/UPDATE/DELETE privileges
-- are also revoked from clients (defense in depth — denied before RLS is even
-- evaluated). No DELETE policy ever existed, and the client has no
-- circle_members insert/update/delete path (verified — it only SELECTs), so this
-- is zero-regression.
drop policy if exists "Circle owners can add initial membership" on public.circle_members;
drop policy if exists "Circle admins can manage members" on public.circle_members;
revoke insert, update, delete on public.circle_members from anon, authenticated;
-- KEEP: "Users can view members in their circles" (SELECT) + the SELECT privilege.

-- ── 2. care_circles: create via RPC only; owner_id via transfer RPC only ───────
-- BEFORE: an INSERT policy ("Users can create their own circles", with check
-- owner_id = auth.uid()) and a manager UPDATE policy ("Circle admins can update
-- circles"). create_care_circle is a SECURITY DEFINER RPC and is the ONLY path
-- the client uses to create a circle (verified: the client only SELECTs
-- care_circles), so the direct INSERT policy is unnecessary; the UPDATE policy
-- let a manager rewrite owner_id directly (bypassing transfer_circle_ownership).
-- AFTER: drop both policies and revoke INSERT/UPDATE/DELETE from clients. Reads,
-- the create_care_circle INSERT and the transfer RPC's owner_id UPDATE run as the
-- table owner and are unaffected. No client DELETE path for care_circles exists.
drop policy if exists "Users can create their own circles" on public.care_circles;
drop policy if exists "Circle admins can update circles" on public.care_circles;
revoke insert, update, delete on public.care_circles from anon, authenticated;
-- KEEP: "Users can view circles they belong to" + "Owners can view their own
-- circles" (SELECT) + the SELECT privilege.

-- ── 3. transfer_circle_ownership ──────────────────────────────────────────────
-- Only the current owner may transfer. The new owner must be an active member of
-- the same circle and is promoted to admin; care_circles.owner_id is moved
-- atomically in the same transaction. The old owner keeps their admin role
-- (change it afterwards via update_circle_member_role if desired). Combined with
-- the owner guards in update_circle_member_role / _status / leave_care_circle,
-- this keeps owner_id pointing at an active admin at all times.
--
-- LOCK ORDER (canonical, shared with update_circle_member_role / _status /
-- leave_care_circle): lock the care_circles row FOR UPDATE first, then the
-- circle_members row. Same order everywhere => no deadlock, and every operation
-- that affects the active-admin count / owner is serialized on the circle row.
create or replace function public.transfer_circle_ownership(
  p_circle_id uuid,
  p_new_owner_user_id uuid
)
returns table (
  circle_id uuid,
  owner_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current_owner uuid;
  v_new_member public.circle_members%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Lock the circle row; only its current owner may transfer ownership.
  select cc.owner_id into v_current_owner
  from public.care_circles cc
  where cc.id = p_circle_id
  for update;
  if not found then
    raise exception 'circle not found' using errcode = 'P0002';
  end if;
  if v_current_owner is distinct from v_uid then
    raise exception 'only the circle owner can transfer ownership' using errcode = '42501';
  end if;
  if p_new_owner_user_id = v_uid then
    raise exception 'you are already the owner of this circle' using errcode = '22023';
  end if;

  -- The new owner must already be an ACTIVE member of this circle.
  select * into v_new_member
  from public.circle_members cm
  where cm.circle_id = p_circle_id
    and cm.user_id = p_new_owner_user_id
    and cm.status = 'active'
  for update;
  if not found then
    raise exception 'the new owner must be an active member of this circle'
      using errcode = '42501';
  end if;

  -- Promote the new owner to admin and move ownership, atomically.
  update public.circle_members cm
    set role = 'admin'
    where cm.id = v_new_member.id;

  update public.care_circles cc
    set owner_id = p_new_owner_user_id
    where cc.id = p_circle_id;

  circle_id := p_circle_id;
  owner_id := p_new_owner_user_id;
  return next;
end;
$$;

revoke all on function public.transfer_circle_ownership(uuid, uuid) from public;
grant execute on function public.transfer_circle_ownership(uuid, uuid) to authenticated;
