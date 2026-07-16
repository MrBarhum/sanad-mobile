-- Milestone 4 · B2 — Daily family digest. Adds the `daily_summary` notification
-- type and a recipient resolver that returns the remote members who opted into
-- the daily digest (notification_preferences.remote_summary). NOT auto-applied —
-- see docs/claude-reports/2026-07-14-milestone-4-runbook.md; deploy the
-- send-daily-summaries edge function and schedule its hourly cron after this.
--
-- Note: `daily_summary` is added but intentionally NOT wired into
-- notification_recipient_eligible — the digest's audience is gated ONLY by
-- remote_summary via daily_summary_recipients below, and the send-time eligibility
-- check falls through to its `else true` branch for this type (so a remote member
-- with, say, care_updates off still receives the digest they opted into).

alter type public.notification_type add value if not exists 'daily_summary';

-- Active remote members of a circle who opted into the daily digest, with their
-- resolved timezone + quiet-hours window (for per-recipient deferral). This does
-- NOT reference the new enum value, so it is safe in the same migration. Reserved
-- to service_role (called only by the send-daily-summaries edge function).
create or replace function public.daily_summary_recipients(p_circle_id uuid)
returns table (
  user_id uuid,
  timezone text,
  quiet_hours_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cm.user_id,
    ep.timezone,
    ep.quiet_hours_enabled,
    ep.quiet_hours_start,
    ep.quiet_hours_end
  from public.circle_members cm
  cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
  where cm.circle_id = p_circle_id
    and cm.status = 'active'
    and cm.role = 'remote_member'
    and ep.remote_summary is true;
$$;

revoke all on function public.daily_summary_recipients(uuid) from public;
grant execute on function public.daily_summary_recipients(uuid) to service_role;
