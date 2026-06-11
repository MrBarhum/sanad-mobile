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
