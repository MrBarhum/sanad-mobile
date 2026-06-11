-- ============================================================================
-- Sanad — Step 5.0 COMPLETE Dashboard SQL (members, invitations, multi-circle,
-- and the authorization/ownership/concurrency hardening passes).
--
-- HOW TO APPLY: paste this entire file into the Sanad Supabase Dashboard SQL
-- Editor and run it once. It is the single, complete, ordered set of executable
-- statements — no omissions, no placeholders. Every statement is idempotent and
-- safe to re-run.
--
-- This file is the verbatim concatenation, in dependency order, of:
--   1. 20260610130000_create_circle_invitations.sql
--        invitation enum + table + RLS (RPC-only) + code helpers
--   2. 20260610130100_create_membership_invitation_rpcs.sql
--        all invitation + membership RPCs — with the manager null-guard, owner
--        guards, caregiver/elder least-privilege rejection, and the canonical
--        circle-first lock order that serializes admin/owner changes
--   3. 20260610130200_lock_down_membership_and_ownership.sql
--        circle_members / care_circles direct create/mutate lockdown +
--        ownership transfer
-- followed by a PostgREST schema reload so the new RPCs are exposed immediately.
--
-- NO Supabase CLI login/logout/link/db push was used to produce or apply this.
-- ============================================================================


-- ============================================================================
-- PART 1 of 3 — 20260610130000_create_circle_invitations.sql
-- ============================================================================

-- Step 5.0 — Care-circle invitations: schema + code helpers.
--
-- Adds a secure, one-time invitation mechanism so a manager (admin /
-- primary_caregiver) can invite family / caregivers into their circle by a
-- short human-usable code. SECURITY:
--   * Only a SHA-256 HASH of the normalized code is ever stored (code_hash).
--     A database leak never exposes a usable code; the raw code is returned to
--     the inviter exactly once, by the create RPC (next migration).
--   * Codes are generated from a 31-char alphabet with no ambiguous glyphs
--     (no 0/O/1/I/L) so they are easy to read/type.
--   * Hashing uses the CORE pg_catalog sha256(bytea) (PostgreSQL 11+) and
--     gen_random_uuid() for randomness, so NO pgcrypto schema dependency is
--     required — every object resolves under `search_path = ''`.
--   * The table itself has RLS ENABLED with NO data policies: all client access
--     is denied. Every read/write goes through the SECURITY DEFINER RPCs in the
--     companion migration, which enforce authorization explicitly. This keeps
--     code_hash entirely off the client and prevents cross-circle access.
--
-- Idempotent / safe to re-run (apply manually via the Sanad Dashboard SQL
-- Editor): enum guarded by a catalog check; table via create-if-not-exists plus
-- add-column-if-not-exists; indexes if-not-exists; functions create-or-replace
-- with re-asserted revoke/grant. No data writes.

-- ── invitation_status enum ────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'invitation_status' and n.nspname = 'public'
  ) then
    create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
end$$;

-- ── circle_invitations table ──────────────────────────────────────────────────
create table if not exists public.circle_invitations (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  role public.circle_role not null,
  code_hash text not null,
  status public.invitation_status not null default 'pending',
  invited_name text,
  invited_email text,
  created_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resilient column adds (no-op when the table already has them) so a partially
-- created table from an earlier run converges to the full shape.
alter table public.circle_invitations add column if not exists circle_id uuid;
alter table public.circle_invitations add column if not exists role public.circle_role;
alter table public.circle_invitations add column if not exists code_hash text;
alter table public.circle_invitations add column if not exists status public.invitation_status not null default 'pending';
alter table public.circle_invitations add column if not exists invited_name text;
alter table public.circle_invitations add column if not exists invited_email text;
alter table public.circle_invitations add column if not exists created_by uuid;
alter table public.circle_invitations add column if not exists accepted_by uuid;
alter table public.circle_invitations add column if not exists accepted_at timestamptz;
alter table public.circle_invitations add column if not exists expires_at timestamptz;
alter table public.circle_invitations add column if not exists created_at timestamptz not null default now();
alter table public.circle_invitations add column if not exists updated_at timestamptz not null default now();

-- One code_hash maps to at most one invitation (also the lookup key on accept).
create unique index if not exists circle_invitations_code_hash_key
  on public.circle_invitations (code_hash);
create index if not exists circle_invitations_circle_id_idx
  on public.circle_invitations (circle_id);
create index if not exists circle_invitations_status_idx
  on public.circle_invitations (status);
create index if not exists circle_invitations_expires_at_idx
  on public.circle_invitations (expires_at);

-- Keep updated_at fresh (reuses the shared trigger fn from the initial schema).
drop trigger if exists circle_invitations_set_updated_at on public.circle_invitations;
create trigger circle_invitations_set_updated_at
before update on public.circle_invitations
for each row execute function public.set_updated_at();

-- RLS on, NO policies: every direct client read/write is denied. All access is
-- via the SECURITY DEFINER RPCs (companion migration), which never expose
-- code_hash and enforce circle/role authorization.
alter table public.circle_invitations enable row level security;

-- ── Code helpers ──────────────────────────────────────────────────────────────

-- Normalize a code for comparison: strip every non-alphanumeric character
-- (whitespace, dashes, separators) and upper-case. So 'a1b2c-d3e4f', ' A1B2C
-- D3E4F ' and 'a1b2cd3e4f' all hash identically. Pure / immutable.
create or replace function public.normalize_invitation_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

revoke all on function public.normalize_invitation_code(text) from public;

-- SHA-256 (hex) of the normalized code. Core pg_catalog sha256(bytea) — no
-- pgcrypto. Only ever the hash is persisted / compared.
create or replace function public.hash_invitation_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    sha256(convert_to(public.normalize_invitation_code(p_code), 'UTF8')),
    'hex'
  );
$$;

revoke all on function public.hash_invitation_code(text) from public;

-- Generate a fresh, human-usable raw code: 10 chars from a 31-char unambiguous
-- alphabet, grouped as XXXXX-XXXXX. Randomness from core gen_random_uuid()
-- (122 random bits / 16 bytes) — no pgcrypto. The dash is cosmetic; it is
-- stripped by normalization before hashing.
create or replace function public.generate_invitation_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31, no 0/O/1/I/L
  raw bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex'); -- 16 bytes
  code text := '';
  i int;
begin
  for i in 0..9 loop
    code := code || substr(alphabet, 1 + (get_byte(raw, i) % 31), 1);
  end loop;
  return substr(code, 1, 5) || '-' || substr(code, 6, 5);
end;
$$;

revoke all on function public.generate_invitation_code() from public;


-- ============================================================================
-- PART 2 of 3 — 20260610130100_create_membership_invitation_rpcs.sql
-- ============================================================================

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


-- ============================================================================
-- PART 3 of 3 — 20260610130200_lock_down_membership_and_ownership.sql
-- ============================================================================

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


-- ============================================================================
-- PostgREST: reload the schema cache so the new RPCs are callable immediately.
-- ============================================================================
notify pgrst, 'reload schema';
