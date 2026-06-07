create extension if not exists "pgcrypto";

create type public.circle_role as enum (
  'admin',
  'primary_caregiver',
  'family_member',
  'caregiver',
  'remote_member',
  'elder'
);

create type public.member_status as enum (
  'active',
  'invited',
  'removed'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  locale text not null default 'ar',
  dialect text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.care_circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.circle_role not null default 'family_member',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (circle_id, user_id)
);

create table public.care_recipients (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null unique references public.care_circles(id) on delete cascade,
  full_name text not null,
  birth_date date,
  photo_url text,
  dialect text,
  blood_type text,
  allergies text,
  chronic_conditions text,
  emergency_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger care_circles_set_updated_at
before update on public.care_circles
for each row execute function public.set_updated_at();

create trigger circle_members_set_updated_at
before update on public.circle_members
for each row execute function public.set_updated_at();

create trigger care_recipients_set_updated_at
before update on public.care_recipients
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_circle_member(target_circle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = target_circle_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

create or replace function public.has_circle_role(
  target_circle_id uuid,
  allowed_roles public.circle_role[]
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = target_circle_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.care_circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.care_recipients enable row level security;

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can view circles they belong to"
on public.care_circles
for select
to authenticated
using (public.is_circle_member(id));

create policy "Users can create their own circles"
on public.care_circles
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Circle admins can update circles"
on public.care_circles
for update
to authenticated
using (
  public.has_circle_role(id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(id, array['admin', 'primary_caregiver']::public.circle_role[])
);

create policy "Users can view members in their circles"
on public.circle_members
for select
to authenticated
using (public.is_circle_member(circle_id));

create policy "Circle owners can add initial membership"
on public.circle_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.care_circles cc
    where cc.id = circle_id
      and cc.owner_id = auth.uid()
  )
);

create policy "Circle admins can manage members"
on public.circle_members
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

create policy "Members can view care recipient"
on public.care_recipients
for select
to authenticated
using (public.is_circle_member(circle_id));

create policy "Circle admins can create care recipient"
on public.care_recipients
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

create policy "Circle admins can update care recipient"
on public.care_recipients
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);