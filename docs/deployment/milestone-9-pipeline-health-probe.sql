-- Milestone 9 · A1 — notification pipeline health, around the EXECUTE revoke.
--
-- READ-ONLY. This is the functional check the privilege probes cannot give: A1
-- touches the notification functions more than anything else, so the question is
-- not just "did the grants move" but "does the cron-driven pipeline still run".
--
-- WHY NOT `supabase functions invoke`: `enqueue-due-reminders` and
-- `process-notification-outbox` authorize on the shared secret
-- NOTIFICATIONS_CRON_SECRET and FAIL CLOSED without it. Invoking them by hand
-- means handling that secret. Observing the SCHEDULED path instead needs no
-- secret and is stronger evidence anyway — it proves the path that actually runs
-- in production still works, not that a hand-crafted request does.
--
-- DELIBERATELY NEVER SELECTS `cron.job.command` OR `return_message`: the cron
-- command embeds the shared secret in a header, and a failure message can echo
-- request detail. Job identity, status and timing answer the question, and none
-- of that is sensitive.
--
-- Emitted as ONE labelled result set because `supabase db query` returns a single
-- relation and does not support psql meta-commands.

with jobs as (
  select
    'A. cron job'::text                          as section,
    jobid::text                                  as a,
    coalesce(jobname, '(unnamed)')               as b,
    schedule                                     as c,
    case when active then 'active' else 'INACTIVE' end as d,
    ''::text                                     as e
  from cron.job
),
runs as (
  select
    'B. runs (2h)'::text                         as section,
    d.jobid::text                                as a,
    coalesce(j.jobname, '(unnamed)')             as b,
    d.status                                     as c,
    count(*)::text                               as d,
    to_char(max(d.start_time), 'YYYY-MM-DD HH24:MI:SS') as e
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
  where d.start_time > now() - interval '2 hours'
  group by d.jobid, j.jobname, d.status
),
volume as (
  select 'C. volume'::text as section,
         t.tbl             as a,
         t.last_30m::text  as b,
         t.last_2h::text   as c,
         ''::text          as d,
         coalesce(to_char(t.most_recent, 'YYYY-MM-DD HH24:MI:SS'), '(none)') as e
  from (
    select 'notifications' as tbl,
           count(*) filter (where created_at > now() - interval '30 minutes') as last_30m,
           count(*) filter (where created_at > now() - interval '2 hours')    as last_2h,
           max(created_at) as most_recent
    from public.notifications
    union all
    select 'notification_outbox',
           count(*) filter (where created_at > now() - interval '30 minutes'),
           count(*) filter (where created_at > now() - interval '2 hours'),
           max(created_at)
    from public.notification_outbox
    union all
    select 'notification_push_deliveries',
           count(*) filter (where created_at > now() - interval '30 minutes'),
           count(*) filter (where created_at > now() - interval '2 hours'),
           max(created_at)
    from public.notification_push_deliveries
  ) t
),
backlog as (
  select 'D. outbox backlog'::text as section,
         status::text              as a,
         count(*)::text            as b,
         to_char(min(created_at), 'YYYY-MM-DD HH24:MI') as c,
         to_char(max(created_at), 'YYYY-MM-DD HH24:MI') as d,
         ''::text                  as e
  from public.notification_outbox
  group by status
  union all
  select 'E. delivery backlog',
         status::text,
         count(*)::text,
         to_char(min(created_at), 'YYYY-MM-DD HH24:MI'),
         to_char(max(created_at), 'YYYY-MM-DD HH24:MI'),
         ''
  from public.notification_push_deliveries
  group by status
)
select section, a, b, c, d, e from jobs
union all select section, a, b, c, d, e from runs
union all select section, a, b, c, d, e from volume
union all select section, a, b, c, d, e from backlog
order by section, a;
