-- Fix the care-circle creation bootstrap deadlock (see the step 1.0 debug report).
--
-- Root cause: `care_circles` had no SELECT policy for the owner, so a freshly
-- created circle was invisible to its own owner until they became a member. That
-- broke both the insert read-back and the `circle_members` bootstrap policy's
-- inline ownership subquery. This migration:
--   1. lets owners view their own circles, and
--   2. adds an atomic, security-definer RPC that creates the circle, the owner's
--      admin membership, and the care recipient in a single transaction, so the
--      client no longer issues three separate, RLS-fragile inserts.

-- 1. Owners can always view circles they own (in addition to circles they are an
--    active member of). Multiple permissive SELECT policies are OR-ed together.
drop policy if exists "Owners can view their own circles" on public.care_circles;
create policy "Owners can view their own circles"
on public.care_circles
for select
to authenticated
using (owner_id = auth.uid());

-- 2. Atomic creation RPC. SECURITY DEFINER so the three inserts run as the
--    function owner and are not blocked by the care-circle RLS bootstrap; the
--    rows are still scoped to the *caller* via auth.uid(). `search_path = ''`
--    forces every object reference to be schema-qualified (no search_path
--    hijacking).
create or replace function public.create_care_circle(
  circle_name text,
  recipient_full_name text,
  recipient_birth_date date default null
)
returns table (circle_id uuid, recipient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_circle_id uuid;
  v_recipient_id uuid;
begin
  if v_uid is null then
    raise exception 'create_care_circle: authentication required'
      using errcode = '28000';
  end if;

  insert into public.care_circles (name, owner_id)
  values (circle_name, v_uid)
  returning id into v_circle_id;

  insert into public.circle_members (circle_id, user_id, role, status)
  values (v_circle_id, v_uid, 'admin'::public.circle_role, 'active'::public.member_status);

  insert into public.care_recipients (circle_id, full_name, birth_date)
  values (v_circle_id, recipient_full_name, recipient_birth_date)
  returning id into v_recipient_id;

  circle_id := v_circle_id;
  recipient_id := v_recipient_id;
  return next;
end;
$$;

-- 3. Only authenticated users may create a circle; never anon. (Revoke the
--    implicit PUBLIC execute grant first, then grant to the authenticated role.)
revoke all on function public.create_care_circle(text, text, date) from public;
grant execute on function public.create_care_circle(text, text, date) to authenticated;
