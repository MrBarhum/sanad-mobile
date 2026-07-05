# Phase 2F-7B - Manual read-only notification resolver verification SQL pack

**Status:** SQL pack / report only. This document contains **copy-pasteable, read-only** SQL for the
operator to run **manually and later** in the Supabase Dashboard SQL Editor, under separate approval.
**No SQL was executed in this phase. No Supabase connection was made. No data was mutated.** Claude only
read the migrations / Edge sources / prior reports and authored this pack. The only filesystem write is
this report; the only commands run are the two local read-only checks in Section 16.

**Baseline (pushed) commit:** `8572f59 docs(product): plan notification smoke test`.
**Cloud project ref (Sanad):** `qccgshanmoeybagxwvcs`.
**QA circle id (from 2F-5.2):** `ae4721d8-bd65-4fa8-bc25-e10ea73f357c` (prior name `رعاية الوالد الغالي`).
**Rollout state:** deployed but idle (no cron, no invocation, no outbox, no push).
**Sources inspected read-only:** 2F-7A, 2F-6E, 2F-5.2, 2F-5B reports; migrations
`20260626163000` (types + preferences) and `20260626164000` (resolvers); base-schema migrations for the
item tables; `_shared/enqueue.ts`, `enqueue-due-reminders/index.ts`, `check-missed-doses/index.ts`.

---

## 1. Executive summary

- **This is a read-only SQL pack only.** Every block is a `SELECT` designed to return `PASS` / `FAIL` /
  `SKIP` rows. None mutate data.
- **The SQL is for manual Supabase Dashboard SQL Editor execution, later, under separate approval.**
- **No SQL was run in this phase.** No DB connection, no CLI, no invocation.
- **Purpose:** verify the responsibility-aware resolver *targeting* is correct **before any Edge producer
  is ever invoked** - i.e. prove owners, managers, exclusions, and no-recipient cases resolve exactly as
  designed on real QA data.
- **This pack must not invoke Edge Functions, process the outbox, enable cron, or send push.** It only
  calls the live `security definer` resolver functions and reads catalog rows.
- **The smoke test remains blocked** (2F-7A Stage 2 producer invocation) until these resolver checks pass.

### 1.1 How this pack maps to the live resolvers (verified against migration `20260626164000`)

| Check theme | Resolver / object exercised |
| --- | --- |
| Remote exclusion | `notification_recipient_eligible(user, circle, type)` -> `false` for remote |
| Owner-only targeting | `notification_recipients_for_item_event(circle, type, entity, item)` |
| Unassigned task -> nobody | same resolver, owner-only branch (no manager fallback for tasks) |
| Manager fallback | same resolver fallback branch vs `notification_item_managers(circle)` |
| Manager awareness (claim/outcome) | resolver manager-only branch (ignores entity/item) |
| Claim digest | resolver claim-capable branch, gated by `available_to_claim_digest` (default `false`) |

### 1.2 Two facts the operator must hold while reading results

- **`claim_digest` targets claim-capable members who opted in.** The preference
  `available_to_claim_digest` **defaults to `false`** (migration `20260626163000` A2). So on a fresh QA
  circle the *correct* `claim_digest` audience is **empty**. An empty result that equals the empty expected
  set is a **PASS** (correctly nobody), not a failure.
- **`item_claimed` / `item_completed` / `item_cancelled` / `claim_digest` / `item_assigned` have no
  producer yet** (2F-5.2 V2.3a/b; confirmed in 2F-7A). This pack verifies their *resolver capability*
  only; nothing produces them at runtime today.

---

## 2. Read-only safety rules (manual execution)

Follow these when the operator later runs the pack:

- Use the **Supabase Dashboard SQL Editor only**, and only when explicitly approved.
- **Confirm the project ref is `qccgshanmoeybagxwvcs`** (Sanad) before running anything.
- **Do not run in ThinkMate or any other Supabase project.**
- **Do not run any** `INSERT` / `UPDATE` / `DELETE` / `UPSERT` / `MERGE` / `TRUNCATE` / `ALTER` /
  `CREATE` / `DROP`. Every block here is `SELECT`-only.
- **Do not call Edge Functions.** (These blocks call SQL resolver functions only - never
  `enqueue-due-reminders`, `check-missed-doses`, `process-notification-outbox`, `check-push-receipts`.)
- **Do not call producer functions** (`enqueue_notification`, `fanout_due_notifications`,
  `claim_push_deliveries`, `mark_delivery_*`). None appear in this pack.
- **Do not create notifications.**
- **Do not process the outbox.**
- **Do not enable cron.**
- **Do not reveal secrets** (`NOTIFICATIONS_CRON_SECRET`, service-role key, Expo credentials) in any
  pasted result.
- **If any query appears to modify data, stop** and do not run it.

---

## 3. SQL pack structure

- Every block below is a **single `SELECT`** (with CTEs / `UNION ALL` where needed) so the Supabase SQL
  Editor - which displays only the **last** statement's result set - shows **all** of a block's PASS/FAIL
  rows at once. Run one block at a time.
- Every block begins with the mandated header comment:
  `-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.`
- Blocks are read-only, self-contained (each re-declares the `qa` circle via a CTE), and safe for the SQL
  Editor.
- **No transaction wrapper.** `set transaction read only` is **not** relied upon (its behavior in the
  Dashboard is not guaranteed). Safety comes from the queries being strictly `SELECT`-only.
- **QA circle id** is inlined as `'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid`. If the QA circle differs,
  change only that literal (in the `qa` CTE of each block) - change nothing else.
- **Execution role note:** the resolvers are `security definer`, `revoke all from public`,
  `grant execute to service_role`. The Dashboard SQL Editor runs as `postgres` (the function **owner**),
  which can execute them. If you ever hit `permission denied for function ...`, the editor is running as a
  lesser role - **stop and report** rather than escalating; do not work around it with role changes as part
  of a "read-only" check.

---

## 4. Block 1 - QA target discovery

Confirms the QA circle exists and has a plausible role mix. Informational name comparison against the
prior name; does **not** hard-fail on a name difference.

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
)
select
  q.circle_id,
  (select cc.name from public.care_circles cc where cc.id = q.circle_id)                    as circle_name,
  (select cc.name = 'رعاية الوالد الغالي' from public.care_circles cc where cc.id = q.circle_id) as name_matches_prior,
  (select count(*) from public.circle_members m
     where m.circle_id = q.circle_id and m.status = 'active'
       and m.role in ('admin','primary_caregiver'))                                          as managers,
  (select count(*) from public.circle_members m
     where m.circle_id = q.circle_id and m.status = 'active'
       and m.role in ('family_member','caregiver'))                                          as doers,
  (select count(*) from public.circle_members m
     where m.circle_id = q.circle_id and m.status = 'active' and m.role = 'remote_member')   as remotes,
  (select count(*) from public.circle_members m
     where m.circle_id = q.circle_id and m.status = 'active' and m.role = 'elder')           as elders,
  case
    when not exists (select 1 from public.care_circles cc where cc.id = q.circle_id) then 'FAIL_NO_QA_CIRCLE'
    when (select count(*) from public.circle_members m
            where m.circle_id = q.circle_id and m.status='active' and m.role in ('admin','primary_caregiver')) >= 1
     and (select count(*) from public.circle_members m
            where m.circle_id = q.circle_id and m.status='active' and m.role in ('family_member','caregiver')) >= 1
      then 'PASS'
    else 'NEEDS_REVIEW'
  end as status
from qa q;
```

**Expected:** one row. `PASS` when the QA circle exists with at least one active manager and one active
doer. `FAIL_NO_QA_CIRCLE` if the id is wrong. `NEEDS_REVIEW` otherwise (record what was found; do not
proceed until the role mix is understood). A `remotes` count of `0` means the remote-exclusion block
(Section 6) will `SKIP`.

---

## 5. Block 2 - candidate item discovery

Discovers one candidate per item shape for the resolver tests. Never creates or modifies items. Each
shape always returns exactly one row (`FOUND` or `MISSING`).

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
)
select 'assigned_medication' as item_kind, c.item_id, c.label, c.owner_id,
       case when c.item_id is not null then 'FOUND' else 'MISSING' end as candidate_status,
       'active medication with responsible_user_id set' as notes
from qa q left join lateral (
  select m.id as item_id, m.name as label, m.responsible_user_id as owner_id
  from public.medications m
  where m.circle_id = q.circle_id and m.is_active and m.responsible_user_id is not null
  order by m.created_at limit 1) c on true
union all
select 'unassigned_medication', c.item_id, c.label, c.owner_id,
       case when c.item_id is not null then 'FOUND' else 'MISSING' end,
       'active medication with responsible_user_id null (manager fallback)'
from qa q left join lateral (
  select m.id as item_id, m.name as label, m.responsible_user_id as owner_id
  from public.medications m
  where m.circle_id = q.circle_id and m.is_active and m.responsible_user_id is null
  order by m.created_at limit 1) c on true
union all
select 'assigned_open_task', c.item_id, c.label, c.owner_id,
       case when c.item_id is not null then 'FOUND' else 'MISSING' end,
       'open care_task with assigned_to set (owner-only)'
from qa q left join lateral (
  select t.id as item_id, t.title as label, t.assigned_to as owner_id
  from public.care_tasks t
  where t.circle_id = q.circle_id and t.status = 'open' and t.assigned_to is not null
  order by t.created_at limit 1) c on true
union all
select 'unassigned_open_task', c.item_id, c.label, c.owner_id,
       case when c.item_id is not null then 'FOUND' else 'MISSING' end,
       'open care_task with assigned_to null (must resolve nobody)'
from qa q left join lateral (
  select t.id as item_id, t.title as label, t.assigned_to as owner_id
  from public.care_tasks t
  where t.circle_id = q.circle_id and t.status = 'open' and t.assigned_to is null
  order by t.created_at limit 1) c on true
union all
select 'assigned_appointment', c.item_id, c.label, c.owner_id,
       case when c.item_id is not null then 'FOUND' else 'MISSING' end,
       'scheduled care_appointment with assigned_to set (owner-only)'
from qa q left join lateral (
  select a.id as item_id, a.title as label, a.assigned_to as owner_id
  from public.care_appointments a
  where a.circle_id = q.circle_id and a.status = 'scheduled' and a.assigned_to is not null
  order by a.starts_at limit 1) c on true
union all
select 'unassigned_appointment', c.item_id, c.label, c.owner_id,
       case when c.item_id is not null then 'FOUND' else 'MISSING' end,
       'scheduled care_appointment with assigned_to null (manager fallback)'
from qa q left join lateral (
  select a.id as item_id, a.title as label, a.assigned_to as owner_id
  from public.care_appointments a
  where a.circle_id = q.circle_id and a.status = 'scheduled' and a.assigned_to is null
  order by a.starts_at limit 1) c on true
union all
select 'linked_planned_visit', c.item_id, c.label, c.owner_id,
       case when c.item_id is not null then 'FOUND' else 'MISSING' end,
       'planned family_visit with visitor_user_id set (owner-only)'
from qa q left join lateral (
  select v.id as item_id, v.visitor_name as label, v.visitor_user_id as owner_id
  from public.family_visits v
  where v.circle_id = q.circle_id and v.status = 'planned' and v.visitor_user_id is not null
  order by v.visit_date limit 1) c on true
union all
select 'unlinked_planned_visit', c.item_id, c.label, c.owner_id,
       case when c.item_id is not null then 'FOUND' else 'MISSING' end,
       'planned family_visit with visitor_user_id null (manager fallback; 2F-5.2 B5b was SKIP)'
from qa q left join lateral (
  select v.id as item_id, v.visitor_name as label, v.visitor_user_id as owner_id
  from public.family_visits v
  where v.circle_id = q.circle_id and v.status = 'planned' and v.visitor_user_id is null
  order by v.visit_date limit 1) c on true;
```

**Expected:** eight rows. Any `MISSING` candidate means the matching resolver check below will `SKIP`; do
**not** create items now - record the gaps and route them to a **separate QA seed plan** (Section 15,
Phase 2F-7C-alt).

---

## 6. Block 3 - remote-member exclusion

Verifies `remote_member` is ineligible for the operational / awareness / digest types.

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
),
rm as (
  select cm.user_id
  from public.circle_members cm
  join qa on cm.circle_id = qa.circle_id
  where cm.status = 'active' and cm.role = 'remote_member'
  order by cm.created_at limit 1
)
select
  ty.type::text as notification_type,
  (select user_id from rm) as remote_user_id,
  case when (select user_id from rm) is null then null
       else public.notification_recipient_eligible((select user_id from rm), q.circle_id, ty.type)
  end as remote_eligible,
  case
    when (select user_id from rm) is null then 'SKIP_NO_REMOTE_MEMBER'
    when public.notification_recipient_eligible((select user_id from rm), q.circle_id, ty.type) = false then 'PASS'
    else 'FAIL'
  end as status
from qa q
cross join (values
  ('medication_due'::public.notification_type),
  ('task_due'::public.notification_type),
  ('item_claimed'::public.notification_type),
  ('claim_digest'::public.notification_type)
) as ty(type);
```

**Expected:** four rows, all `PASS` (`remote_eligible = false`). Any `FAIL` (a `true`) is a **stop
condition**. `SKIP_NO_REMOTE_MEMBER` if the QA circle has no active remote member (add one via the seed
plan to exercise this properly).

---

## 7. Block 4 - owner-only resolver targeting

Verifies each assigned item resolves to **exactly** its owner.

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
)
select 'assigned_medication_due' as check_name, c.item_id, c.expected_owner, rr.resolved,
  case
    when c.item_id is null then 'SKIP_MISSING_CANDIDATE'
    when array_length(rr.resolved,1) = 1 and rr.resolved[1] = c.expected_owner then 'PASS'
    else 'FAIL'
  end as status
from qa q
left join lateral (
  select m.id as item_id, m.responsible_user_id as expected_owner
  from public.medications m
  where m.circle_id = q.circle_id and m.is_active and m.responsible_user_id is not null
  order by m.created_at limit 1) c on true
cross join lateral (
  select case when c.item_id is null then null::uuid[] else array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'medication_due'::public.notification_type,'medication',c.item_id) r
               order by r.user_id) end as resolved) rr
union all
select 'assigned_task_due', c.item_id, c.expected_owner, rr.resolved,
  case when c.item_id is null then 'SKIP_MISSING_CANDIDATE'
       when array_length(rr.resolved,1)=1 and rr.resolved[1]=c.expected_owner then 'PASS' else 'FAIL' end
from qa q
left join lateral (
  select t.id as item_id, t.assigned_to as expected_owner
  from public.care_tasks t
  where t.circle_id = q.circle_id and t.status='open' and t.assigned_to is not null
  order by t.created_at limit 1) c on true
cross join lateral (
  select case when c.item_id is null then null::uuid[] else array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'task_due'::public.notification_type,'task',c.item_id) r
               order by r.user_id) end as resolved) rr
union all
select 'assigned_appointment_upcoming', c.item_id, c.expected_owner, rr.resolved,
  case when c.item_id is null then 'SKIP_MISSING_CANDIDATE'
       when array_length(rr.resolved,1)=1 and rr.resolved[1]=c.expected_owner then 'PASS' else 'FAIL' end
from qa q
left join lateral (
  select a.id as item_id, a.assigned_to as expected_owner
  from public.care_appointments a
  where a.circle_id = q.circle_id and a.status='scheduled' and a.assigned_to is not null
  order by a.starts_at limit 1) c on true
cross join lateral (
  select case when c.item_id is null then null::uuid[] else array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'appointment_upcoming'::public.notification_type,'appointment',c.item_id) r
               order by r.user_id) end as resolved) rr
union all
select 'linked_visit_upcoming', c.item_id, c.expected_owner, rr.resolved,
  case when c.item_id is null then 'SKIP_MISSING_CANDIDATE'
       when array_length(rr.resolved,1)=1 and rr.resolved[1]=c.expected_owner then 'PASS' else 'FAIL' end
from qa q
left join lateral (
  select v.id as item_id, v.visitor_user_id as expected_owner
  from public.family_visits v
  where v.circle_id = q.circle_id and v.status='planned' and v.visitor_user_id is not null
  order by v.visit_date limit 1) c on true
cross join lateral (
  select case when c.item_id is null then null::uuid[] else array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'visit_upcoming'::public.notification_type,'visit',c.item_id) r
               order by r.user_id) end as resolved) rr;
```

**Expected:** four rows. `PASS` when `resolved` is exactly `[expected_owner]`. `SKIP_MISSING_CANDIDATE`
when no candidate (the `resolved` column is `null` on a SKIP row and should be ignored). **Notes on
`FAIL`:** (a) a `FAIL` where `resolved` is **empty** can mean the owner opted out of that type's
preference (the resolver respects opt-out and returns empty) - check that owner's
`effective_notification_prefs` before treating it as a defect; (b) a `FAIL` where `resolved` is
**non-empty but not the owner** (e.g. a manager set) usually means the candidate item was mis-assigned to
a `remote_member` / `elder` (assignment RLS checks membership, not role), so the resolver skipped the
non-operational owner and fell back to managers (medication / appointment / visit only) - verify the
candidate owner's active circle role before treating it as a resolver defect.

---

## 8. Block 5 - unassigned task resolves nobody

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
),
cand as (
  select t.id as item_id
  from public.care_tasks t
  join qa on t.circle_id = qa.circle_id
  where t.status = 'open' and t.assigned_to is null
  order by t.created_at limit 1
)
select
  ty.type::text as check_type,
  cand.item_id,
  count(r.user_id) as recipient_count,
  case
    when cand.item_id is null then 'SKIP_NO_UNASSIGNED_OPEN_TASK'
    when count(r.user_id) = 0 then 'PASS'
    else 'FAIL'
  end as status
from (values
  ('task_due'::public.notification_type),
  ('task_overdue'::public.notification_type)
) as ty(type)
cross join qa q
left join cand on true
left join lateral public.notification_recipients_for_item_event(
  q.circle_id, ty.type, 'task', cand.item_id) r on true
group by ty.type, cand.item_id;
```

**Expected:** two rows (`task_due`, `task_overdue`), each `PASS` with `recipient_count = 0`. Any `FAIL`
(recipient_count > 0) is a **stop condition** - an unassigned task must reach nobody (no manager fallback
for tasks). `SKIP_NO_UNASSIGNED_OPEN_TASK` if no candidate.

---

## 9. Block 6 - manager fallback (unassigned med / appointment / unlinked visit)

Verifies the resolver's fallback branch returns exactly the active, eligible managers.

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
)
select 'unassigned_medication_due' as check_name, c.item_id, ee.expected as expected_managers, rr.resolved,
  case
    when c.item_id is null then 'SKIP_NO_UNASSIGNED_ACTIVE_MEDICATION'
    when array_length(ee.expected,1) is null then 'SKIP_NO_ELIGIBLE_MANAGERS'
    when rr.resolved = ee.expected then 'PASS'
    else 'FAIL'
  end as status
from qa q
left join lateral (
  select m.id as item_id from public.medications m
  where m.circle_id = q.circle_id and m.is_active and m.responsible_user_id is null
  order by m.created_at limit 1) c on true
cross join lateral (
  select case when c.item_id is null then null::uuid[] else array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'medication_due'::public.notification_type,'medication',c.item_id) r
               order by r.user_id) end as resolved) rr
cross join lateral (
  select array(select m.user_id
               from public.notification_item_managers(q.circle_id) m
               where public.notification_recipient_eligible(m.user_id,q.circle_id,'medication_due'::public.notification_type)
               order by m.user_id) as expected) ee
union all
select 'unassigned_appointment_upcoming', c.item_id, ee.expected, rr.resolved,
  case when c.item_id is null then 'SKIP_NO_UNASSIGNED_SCHEDULED_APPOINTMENT'
       when array_length(ee.expected,1) is null then 'SKIP_NO_ELIGIBLE_MANAGERS'
       when rr.resolved = ee.expected then 'PASS' else 'FAIL' end
from qa q
left join lateral (
  select a.id as item_id from public.care_appointments a
  where a.circle_id = q.circle_id and a.status='scheduled' and a.assigned_to is null
  order by a.starts_at limit 1) c on true
cross join lateral (
  select case when c.item_id is null then null::uuid[] else array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'appointment_upcoming'::public.notification_type,'appointment',c.item_id) r
               order by r.user_id) end as resolved) rr
cross join lateral (
  select array(select m.user_id
               from public.notification_item_managers(q.circle_id) m
               where public.notification_recipient_eligible(m.user_id,q.circle_id,'appointment_upcoming'::public.notification_type)
               order by m.user_id) as expected) ee
union all
select 'unlinked_visit_upcoming', c.item_id, ee.expected, rr.resolved,
  case when c.item_id is null then 'SKIP_NO_UNLINKED_PLANNED_VISIT'
       when array_length(ee.expected,1) is null then 'SKIP_NO_ELIGIBLE_MANAGERS'
       when rr.resolved = ee.expected then 'PASS' else 'FAIL' end
from qa q
left join lateral (
  select v.id as item_id from public.family_visits v
  where v.circle_id = q.circle_id and v.status='planned' and v.visitor_user_id is null
  order by v.visit_date limit 1) c on true
cross join lateral (
  select case when c.item_id is null then null::uuid[] else array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'visit_upcoming'::public.notification_type,'visit',c.item_id) r
               order by r.user_id) end as resolved) rr
cross join lateral (
  select array(select m.user_id
               from public.notification_item_managers(q.circle_id) m
               where public.notification_recipient_eligible(m.user_id,q.circle_id,'visit_upcoming'::public.notification_type)
               order by m.user_id) as expected) ee;
```

**Expected:** three rows. `PASS` when `resolved` equals `expected_managers` (a non-empty active-manager
set). `SKIP_NO_ELIGIBLE_MANAGERS` if a candidate exists but every active manager is ineligible/opted-out
(a correctly-empty resolver result, distinguished from a genuine mismatch - not a failure; expected not to
occur since Block 1 requires >=1 active manager and reminder prefs default `true`). For the unlinked
visit, `SKIP_NO_UNLINKED_PLANNED_VISIT` is expected if no candidate exists (2F-5.2 B5b skipped for this
same reason) - **treat that SKIP as not a failure**, and add an unlinked planned visit to the QA seed plan
so it can be confirmed directly.

---

## 10. Block 7 - manager-awareness resolver (claim / outcome types)

`item_claimed` / `item_completed` / `item_cancelled` resolve **managers only**. The resolver's
manager-awareness branch ignores `entity`/`item_id`, so a placeholder `('task', null)` is passed.

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
)
select 'item_claimed_managers_only' as check_name, ee.expected as expected_managers, rr.resolved,
  case
    when array_length(ee.expected,1) is null then 'SKIP_NO_ELIGIBLE_MANAGERS'
    when rr.resolved = ee.expected then 'PASS'
    else 'FAIL'
  end as status
from qa q
cross join lateral (
  select array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'item_claimed'::public.notification_type,'task',null::uuid) r
               order by r.user_id) as resolved) rr
cross join lateral (
  select array(select m.user_id
               from public.notification_item_managers(q.circle_id) m
               where public.notification_recipient_eligible(m.user_id,q.circle_id,'item_claimed'::public.notification_type)
               order by m.user_id) as expected) ee
union all
select 'item_completed_managers_only', ee.expected, rr.resolved,
  case when array_length(ee.expected,1) is null then 'SKIP_NO_ELIGIBLE_MANAGERS'
       when rr.resolved = ee.expected then 'PASS' else 'FAIL' end
from qa q
cross join lateral (
  select array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'item_completed'::public.notification_type,'task',null::uuid) r
               order by r.user_id) as resolved) rr
cross join lateral (
  select array(select m.user_id
               from public.notification_item_managers(q.circle_id) m
               where public.notification_recipient_eligible(m.user_id,q.circle_id,'item_completed'::public.notification_type)
               order by m.user_id) as expected) ee
union all
select 'item_cancelled_managers_only', ee.expected, rr.resolved,
  case when array_length(ee.expected,1) is null then 'SKIP_NO_ELIGIBLE_MANAGERS'
       when rr.resolved = ee.expected then 'PASS' else 'FAIL' end
from qa q
cross join lateral (
  select array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'item_cancelled'::public.notification_type,'task',null::uuid) r
               order by r.user_id) as resolved) rr
cross join lateral (
  select array(select m.user_id
               from public.notification_item_managers(q.circle_id) m
               where public.notification_recipient_eligible(m.user_id,q.circle_id,'item_cancelled'::public.notification_type)
               order by m.user_id) as expected) ee;
```

**Expected:** three rows, each `PASS` (`resolved` equals the active-manager set; no doer / remote / elder
present). `SKIP_NO_ELIGIBLE_MANAGERS` only if the circle has no eligible managers. **These types are
resolver-capability-only for now - no producer emits them yet** (2F-5.2; 2F-7A).

---

## 11. Block 8 - claim_digest resolver

`claim_digest` resolves active claim-capable members (`admin` / `primary_caregiver` / `family_member` /
`caregiver`) who opted in (`available_to_claim_digest`, **default `false`**), excluding `remote_member`
and `elder`, and excluding removed members. The expected audience is computed from the same live rule and
compared to the resolver output; the number of active remote members that must be absent is reported.

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
)
select
  'claim_digest_audience' as check_name,
  rr.resolved,
  ee.expected as expected_claim_capable_optedin,
  (select count(*) from public.circle_members cm
     where cm.circle_id = q.circle_id and cm.status='active' and cm.role='remote_member') as active_remote_members,
  (select count(*) from public.circle_members cm
     where cm.circle_id = q.circle_id and cm.status='active' and cm.role='remote_member'
       and cm.user_id = any(rr.resolved)) as remote_in_resolved,
  case
    when rr.resolved = ee.expected
     and not exists (select 1 from public.circle_members cm
                       where cm.circle_id = q.circle_id and cm.status='active' and cm.role='remote_member'
                         and cm.user_id = any(rr.resolved))
      then 'PASS'
    else 'FAIL'
  end as status
from qa q
cross join lateral (
  select array(select r.user_id
               from public.notification_recipients_for_item_event(
                 q.circle_id,'claim_digest'::public.notification_type,'task',null::uuid) r
               order by r.user_id) as resolved) rr
cross join lateral (
  select array(select cm.user_id
               from public.circle_members cm
               where cm.circle_id = q.circle_id and cm.status='active'
                 and cm.role in ('admin','primary_caregiver','family_member','caregiver')
                 and public.notification_recipient_eligible(cm.user_id,q.circle_id,'claim_digest'::public.notification_type)
               order by cm.user_id) as expected) ee;
```

**Expected:** one row, `PASS` when `resolved` equals `expected_claim_capable_optedin` **and**
`remote_in_resolved = 0`. **Because `available_to_claim_digest` defaults to `false`, both sets are
commonly empty on a fresh QA circle - an empty-equals-empty result is a valid PASS** ("correctly nobody by
default"). To exercise a non-empty audience, have a claim-capable QA member opt in via the app settings
(seed plan), then re-run. Any `remote_in_resolved > 0` is a **stop condition**.

---

## 12. Block 9 - cron absence (optional)

Optional: only if `cron.job` (pg_cron) is accessible in this database. `SELECT`-only; creates / drops /
alters nothing.

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
select
  case when count(*) = 0 then 'PASS_NO_NOTIFICATION_CRON' else 'FAIL_CRON_EXISTS' end as status,
  count(*) as matching_jobs
from cron.job
where command ilike '%enqueue-due-reminders%'
   or command ilike '%check-missed-doses%'
   or command ilike '%process-notification-outbox%'
   or command ilike '%check-push-receipts%'
   or jobname ilike '%enqueue-due-reminders%'
   or jobname ilike '%check-missed-doses%'
   or jobname ilike '%process-notification-outbox%'
   or jobname ilike '%check-push-receipts%';
```

**Expected:** one row, `PASS_NO_NOTIFICATION_CRON` with `matching_jobs = 0`. `FAIL_CRON_EXISTS` (any
match) is a **stop condition**. If the query errors with `relation "cron.job" does not exist` / permission
denied, pg_cron is not exposed here - mark this block **optional / not-run** and rely on the 2F-6E
Dashboard confirmation that no schedule exists.

---

## 13. Block 10 - outbox / delivery pre-smoke baseline (optional)

Counts queued work in the QA circle so a later outbox run cannot be surprised by pre-existing rows.
`SELECT`-only; deletes / cleans nothing. Table names verified against migration `20260611120000`.

```sql
-- READ ONLY. Do not modify data. Do not invoke Edge Functions. Do not enable cron.
with qa as (
  select 'ae4721d8-bd65-4fa8-bc25-e10ea73f357c'::uuid as circle_id
)
select
  (select count(*) from public.notifications n where n.circle_id = q.circle_id)                         as notifications_in_circle,
  (select count(*) from public.notification_outbox o
     join public.notifications n on n.id = o.notification_id
     where n.circle_id = q.circle_id and o.status = 'pending')                                          as outbox_pending,
  (select count(*) from public.notification_push_deliveries d
     join public.notification_outbox o on o.id = d.outbox_id
     join public.notifications n on n.id = o.notification_id
     where n.circle_id = q.circle_id and d.status in ('pending','processing'))                          as deliveries_pending_or_processing,
  case
    when (select count(*) from public.notification_outbox o
            join public.notifications n on n.id = o.notification_id
            where n.circle_id = q.circle_id and o.status = 'pending')
       + (select count(*) from public.notification_push_deliveries d
            join public.notification_outbox o on o.id = d.outbox_id
            join public.notifications n on n.id = o.notification_id
            where n.circle_id = q.circle_id and d.status in ('pending','processing')) = 0
      then 'PASS_NO_PENDING'
    else 'NEEDS_REVIEW_BEFORE_OUTBOX'
  end as status
from qa q;
```

**Expected:** one row. `PASS_NO_PENDING` when no pending outbox jobs and no pending/processing deliveries
exist for the QA circle. A nonzero count is **not an automatic failure** - mark
`NEEDS_REVIEW_BEFORE_OUTBOX` and inspect those rows (do not delete) before any future outbox processing.

---

## 14. Interpretation guide

How the operator should report results back:

- **Paste result rows as table text or JSON.** Do **not** paste any secret.
- **`PASS` rows are good.**
- **`SKIP`** means a missing QA fixture (or no remote member / no managers / no unlinked visit), **not
  necessarily a failure** - it means the check could not be exercised. Record which fixtures are missing.
- **`FAIL`** means **stop** and do not invoke any function - diagnose first.
- **Hard stop conditions (any one -> halt):**
  - Any **cron** row (`FAIL_CRON_EXISTS`).
  - Any **`remote_member`** appearing as a recipient (remote-exclusion `FAIL`, or `remote_in_resolved > 0`
    in the digest block).
  - Any **unassigned task** resolving a recipient (`recipient_count > 0` in Block 5).
  - Any owner-only check resolving **more than one** recipient or the **wrong** user.
  - Manager fallback resolving **anyone who is not an active manager**.
- **`NEEDS_REVIEW`** (Block 1 role mix, Block 10 pending rows) means pause and understand before
  proceeding - not an automatic pass or fail.

---

## 15. Next phase after results

- **If all required checks `PASS` and only allowed `SKIP`s occur** (e.g.
  `SKIP_NO_UNLINKED_PLANNED_VISIT`): proceed to **Phase 2F-7C - resolver verification results record**
  (capture the pasted PASS/FAIL/SKIP rows as a factual record; still no invocation).
- **If required QA fixtures are missing** (`MISSING` candidates, `SKIP_NO_REMOTE_MEMBER`, no unlinked
  visit, no opted-in digest member): go to **Phase 2F-7C-alt - QA fixture seed plan (design only, no
  execution)** to specify the exact QA rows to add, then re-run this pack.
- **If any check `FAIL`s:** **stop and diagnose** the SQL / app / Edge cause before any invocation.
- **No producer invocation in this phase**, and none until the resolver checks pass.

---

## 16. Validation for this report

Local, read-only checks only (no Supabase CLI, no SQL, no deploy, no invocation):

- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace/CRLF errors).

---

## 17. Final confirmation

- **Report created** (this file) - the only filesystem write.
- **No app source changed** (`src/**` untouched).
- **No Edge source changed** (`supabase/functions/**` untouched).
- **No migrations changed** (`supabase/migrations/**` untouched).
- **No generated types changed** (`src/types/supabase.ts` untouched).
- **No Supabase CLI run.**
- **No SQL run** (the pack is authored, not executed).
- **No DB connection.**
- **No additional deploy.**
- **No Edge invocation.**
- **No cron enabled/created.**
- **No notification delivery** (no push sent).
- **No env / secrets touched** (secrets referenced by name only - no values).
- **No commit / no stage.** No other project touched (ThinkMate untouched).

---

## 18. Final git state

Captured read-only at hand-off. Expected: exactly one **untracked** report file and an empty tracked
`diff --stat`.

```text
$ git --no-pager status --short
?? docs/claude-reports/2026-06-26-phase-2f-7b-readonly-resolver-verification-sql-pack.md

$ git --no-pager diff --stat
(empty - no tracked changes)
```

Matches expectation: exactly one untracked report file, and an empty tracked diff.
