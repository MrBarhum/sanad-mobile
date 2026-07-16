-- Milestone 4 · B1 — Care Pulse feed. A single read-only RPC that UNIONs recent
-- activity across the operational tables into one event shape, member-gated and
-- paginated. Read-only (no writes), SECURITY DEFINER with an empty search_path so
-- the visibility gate can't be bypassed by RLS or a caller-set search_path.
--
-- NOT auto-applied. Apply AFTER 20260715120000_add_cancelled_by_to_care_tasks.sql
-- (this RPC reads care_tasks.cancelled_by). `supabase db push` applies both in
-- filename order. See docs/claude-reports/2026-07-14-milestone-4-runbook.md.

create or replace function public.list_care_activity(
  p_circle_id uuid,
  p_limit int default 30,
  p_before timestamptz default null
)
returns table (
  event_type text,
  event_id uuid,
  occurred_at timestamptz,
  actor_user_id uuid,
  actor_name text,
  title text,
  subtitle text,
  item_type text,
  item_id uuid,
  status text
)
language sql
security definer
set search_path = ''
stable
as $$
  with events as (
    -- A dose was logged (given / postponed / missed).
    select
      'dose_logged'::text as event_type,
      ml.id as event_id,
      coalesce(ml.recorded_at, ml.created_at) as occurred_at,
      ml.recorded_by as actor_user_id,
      m.name as title,
      ml.status::text as subtitle,
      'medication'::text as item_type,
      ml.medication_id as item_id,
      ml.status::text as status
    from public.medication_logs ml
    join public.medications m on m.id = ml.medication_id
    where ml.circle_id = p_circle_id

    union all
    -- A task was completed or marked couldn't-complete.
    select
      case when t.status = 'completed' then 'task_completed' else 'task_cancelled' end,
      t.id,
      coalesce(t.completed_at, t.cancelled_at),
      coalesce(t.completed_by, t.cancelled_by),
      t.title,
      null::text,
      'task'::text,
      t.id,
      t.status::text
    from public.care_tasks t
    where t.circle_id = p_circle_id and t.status in ('completed', 'cancelled')

    union all
    -- An appointment outcome was recorded.
    select
      'appointment_outcome'::text,
      a.id,
      a.updated_at,
      a.assigned_to,
      a.title,
      a.status::text,
      'appointment'::text,
      a.id,
      a.status::text
    from public.care_appointments a
    where a.circle_id = p_circle_id and a.status in ('completed', 'cancelled')

    union all
    -- A visit was completed.
    select
      'visit_completed'::text,
      v.id,
      v.updated_at,
      v.visitor_user_id,
      v.visitor_name,
      null::text,
      'visit'::text,
      v.id,
      v.status::text
    from public.family_visits v
    where v.circle_id = p_circle_id and v.status = 'completed'

    union all
    -- A vital reading was recorded.
    select
      'vital_recorded'::text,
      vr.id,
      coalesce(vr.reading_at, vr.created_at),
      vr.recorded_by,
      vr.reading_type::text,
      null::text,
      'vital'::text,
      vr.id,
      null::text
    from public.vital_readings vr
    where vr.circle_id = p_circle_id

    union all
    -- A daily wellbeing log was added.
    select
      'daily_log_added'::text,
      d.id,
      d.created_at,
      d.recorded_by,
      d.log_date::text,
      null::text,
      'daily_log'::text,
      d.id,
      null::text
    from public.daily_care_logs d
    where d.circle_id = p_circle_id

    union all
    -- A member joined the circle.
    select
      'member_joined'::text,
      cm.id,
      cm.created_at,
      cm.user_id,
      null::text,
      cm.role::text,
      'member'::text,
      cm.id,
      cm.status::text
    from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.status = 'active'
  )
  select
    e.event_type,
    e.event_id,
    e.occurred_at,
    e.actor_user_id,
    p.full_name as actor_name,
    e.title,
    e.subtitle,
    e.item_type,
    e.item_id,
    e.status
  from events e
  left join public.profiles p on p.id = e.actor_user_id
  -- Visibility gate: only an active member of the circle sees its pulse. This
  -- SECURITY DEFINER function bypasses RLS, so this check is load-bearing.
  where public.is_circle_member(p_circle_id)
    and e.occurred_at is not null
    and (p_before is null or e.occurred_at < p_before)
  order by e.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.list_care_activity(uuid, int, timestamptz) from public;
grant execute on function public.list_care_activity(uuid, int, timestamptz) to authenticated;
