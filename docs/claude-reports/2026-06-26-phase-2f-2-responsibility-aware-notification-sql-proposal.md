# Phase 2F-2 — Responsibility-aware notification SQL proposal

**Status:** Proposal / draft SQL **for review only**. **No SQL was run, no Supabase CLI used, no
connection made, no migration files created, no app code / generated types changed.** All SQL below
is draft text inside this markdown report.
**Baseline commit:** `6680a35 chore(db): backfill responsibility claim migrations`.
**Predecessors followed:** Phase 2F notification readiness audit; Phase 2F-1.5 live-schema backfill
audit; Phase 2F-1.6 backfill proposal; Phase 2F-1.7 backfill files created; Phase 2D/2E reports.

> **Design boundary.** This phase produces the **SQL design** only. It does **not** wire app UI,
> deploy Edge Functions, run cron, implement native push testing, or enable production notification
> delivery. Producers (the code that actually creates notifications) are drafted but **deferred** —
> see §3.

---

## 1. Executive summary

**What this changes.** The Step 6.0 notification engine resolves recipients **circle-broad by
role + preference** (`circle_notification_recipients(circle_id, type)`), which predates and now
**conflicts** with the responsibility/claim model (Phase 2A/2D/2E). This proposal adds the SQL layer
that makes operational notifications **responsibility-aware**:

- A minimal set of new `notification_type` values (generic across entities via `data.entity`) and a
  few new preference columns.
- **Responsibility-aware recipient resolvers** that target the accountable person
  (`assigned_to` / `responsible_user_id` / `visitor_user_id`), with manager fallback only where
  appropriate, and manager-only awareness for claim/outcome events.
- **Send-time revalidation** extended so a queued reminder is skipped when the item is no longer
  due, was completed/cancelled, was reassigned/claimed away, or the recipient lost membership/role.
- **Deferred producer drafts** (triggers for claim/assignment/outcome; Edge changes for reminders).

**Why it's required.** Phase 2D RLS now **scopes** operational rows to the responsible member. So a
circle-broad reminder both (a) spams non-responsible members and (b) deep-links them to a detail
screen that RLS returns **empty** (for tasks/appointments/visits/`medication_logs`; the shared
`medications` catalog stays member-readable). Targeting the owner fixes both, and aligns notifications
with the claim flow (managers learn when an item is covered).

**Out of scope (this phase):** app settings UI, catalog labels/icons, Edge Function deployment,
cron, native push QA, enabling delivery, generated-types regeneration, and creating migration files.

**Explicit statement.** No SQL was executed. No migration files were created. No Supabase connection
or CLI command was made. No app source, generated types, dependencies, config, native files, or Edge
Functions were modified. The only filesystem write is this report.

---

## 2. Current notification engine audit summary (from repo)

| Aspect | Current state (repo) | Verdict for 2F-2 |
|---|---|---|
| `notification_type` enum (`20260611120000`) | `medication_due`, `medication_missed`, `task_due`, `appointment_upcoming`, `visit_update`, `care_update`, `emergency`, `system` (8 values) | **Reuse** the 4 reminders; **add** a minimal generic set (§4). `visit_update`/`care_update` have no producer (legacy). |
| Tables | `notifications` (inbox), `notification_outbox` (logical job), `notification_push_deliveries` (per-device), `push_tokens`, `notification_preferences` | **Reuse unchanged.** No new tables. |
| Outbox / delivery flow | `enqueue_notification` → `notification_outbox` → `fanout_due_notifications` (materialize per device) → `claim_push_deliveries` (authoritative send-time gate) → Expo → receipts | **Reuse unchanged.** New logic plugs into the existing revalidation hooks. |
| Preference model (`notification_preferences`) | 8 booleans (`medication_reminders`, `missed_dose_alerts`, `task_reminders`, `appointment_reminders`, `visit_updates`, `care_updates`, `emergency_alerts`, `remote_summary`) + quiet hours + timezone | **Extend** with 4 columns (§5); `effective_notification_prefs` + `upsert_notification_preferences` updated. |
| Resolver functions | `circle_notification_recipients(circle,type)` (circle-broad), `notification_recipient_eligible(user,circle,type)` (role+pref), `effective_notification_prefs(user,circle)` | **Add** responsibility resolvers (§6); **extend** `notification_recipient_eligible` (new types + remote exclusion). Keep `circle_notification_recipients` for legacy/broadcast types. |
| Source-validity | `notification_source_validity(id)` validates `medication_due/missed`, `task_due`, `appointment_upcoming` (status/occurrence/dose-recorded). **No visit coverage; no responsibility/ownership check.** | **Extend** (§7): add ownership-currency gate + visit branch. |
| Reminder producers | Edge `enqueue-due-reminders` (medication/task/appointment), `check-missed-doses`; both call `circle_notification_recipients` (circle-broad). **No visit producer.** No assignment/claim/outcome producers. | **Change later** (2F-4, §15). SQL helpers provided; Edge code not edited here. |
| Delivery Edge Functions | `process-notification-outbox`, `check-push-receipts` | **No change** — type-agnostic; they inherit the new SQL revalidation automatically (§15). |
| Reusable vs must-change | **Reuse:** all 5 tables, the two-level outbox, quiet hours, leases, receipts, `enqueue_notification`, `notification_defer_until`. **Change:** recipient resolution, `notification_recipient_eligible`, `effective_notification_prefs`, `notification_source_validity`, `upsert_notification_preferences`; **add** resolvers + enum + prefs; **later:** the two producer Edge Functions. | — |

---

## 3. Proposed migration grouping (do **not** create files yet)

| Order | Proposed file (future, 2F-3) | Contents | Runtime effect |
|---|---|---|---|
| 1 | `20260626163000_notifications_responsibility_types_preferences.sql` | New enum values (`ALTER TYPE … ADD VALUE IF NOT EXISTS`); new preference columns; `upsert_notification_preferences` signature update | **Inert** — no notification is produced by these alone |
| 2 | `20260626164000_notifications_responsibility_resolvers.sql` | `effective_notification_prefs` (expanded); `notification_recipient_eligible` (new types + remote exclusion); owner/managers/recipient resolvers; extended `notification_source_validity` + `notification_recipient_current` | **Inert** — nothing calls the resolvers until a producer exists |
| 3 | `20260626165000_notifications_responsibility_producers.sql` | **DEFERRED** — claim/assignment/outcome trigger producers (§8/§9) | **Activating** — this is what starts creating notifications |

**Recommendation: defer producers (file 3) to a later step in 2F-3, applied last.** Reasoning:

- Files **1 + 2 are inert**: adding enum values, preference columns, and resolver/validation functions
  changes **nothing at runtime** because no code enqueues using them yet. They can land early, be
  verified in isolation (§14), and carry **zero delivery risk**.
- File **3 (producers) is the activation switch** — triggers/Edge that call `enqueue_notification`
  begin creating inbox rows and (once delivery is on) pushes. It must be gated behind: (a) the app
  **settings UI** for the new toggles (§16) so users can control the new alerts, (b) the **Edge**
  producer changes for reminders (2F-4), and (c) a deliberate decision to enable delivery.
- Keeping capability (safe) separate from activation (gated) is the core safety story of this phase.

Enum values are **irreversible** (`ADD VALUE` cannot be dropped) — another reason to keep the type
set minimal (§4) and land it deliberately in file 1.

---

## 4. Event type / enum proposal

**Principle:** collapse the **entity** dimension into `data.entity` (one type covers task/medication/
appointment/visit), but keep distinct types per **event family** so the existing type→preference→
source-validity mapping stays 1:1 (the engine switches on `type`). This turns the audit's ~16
entity×event candidates into **7 new values**.

| Audit candidate(s) | Proposed | Rationale |
|---|---|---|
| `task_assigned`, `medication_assigned`, `appointment_assigned`, `visit_assigned` | **`item_assigned`** (`data.entity`) | One owner-targeted "assigned to you" type; entity in data |
| `item_claimed` (×4 entities) | **`item_claimed`** (`data.entity`) | One manager-awareness type |
| `item_completed` (×4) | **`item_completed`** (`data.entity`) | Manager awareness; kept distinct from cancelled for copy/tone |
| `item_cancelled` (×4) | **`item_cancelled`** (`data.entity`) | Covers "تعذّر / unable" (reuses existing `cancelled` status; **no** new status enum) |
| `task_overdue` | **`task_overdue`** | Distinct urgency/escalation + source-validity from `task_due` |
| `visit_upcoming` | **`visit_upcoming`** | Parallels `appointment_upcoming`; visits have no reminder type today |
| `claim_digest` | **`claim_digest`** | Opt-in digest of claimable items |
| (reminders) | reuse `medication_due`, `medication_missed`, `task_due`, `appointment_upcoming` | Unchanged |

**Rejected:** dedicated per-entity assignment/claim/outcome types (noisy, 4× enum churn, all
irreversible); reusing `care_update`/`visit_update` as generic buckets (would force `data.event`-aware
eligibility, fighting the engine's type-switch architecture). **No** new status enum values for
operational entities; "unable" = existing `cancelled`.

**Idempotent enum SQL (file 1 — must be its own migration; see §13/§18 transaction note):**

```sql
-- ALTER TYPE ... ADD VALUE is idempotent with IF NOT EXISTS. Must live in FILE 1, a SEPARATE
-- migration from FILE 2 (the §13-B resolvers that reference these values at runtime) — a new enum
-- value cannot be USED in the same transaction it is added, and cannot be dropped. It IS safe
-- alongside file 1's preference-column ADDs and the upsert recreate (neither references a new value).
alter type public.notification_type add value if not exists 'item_assigned';
alter type public.notification_type add value if not exists 'task_overdue';
alter type public.notification_type add value if not exists 'visit_upcoming';
alter type public.notification_type add value if not exists 'item_claimed';
alter type public.notification_type add value if not exists 'item_completed';
alter type public.notification_type add value if not exists 'item_cancelled';
alter type public.notification_type add value if not exists 'claim_digest';
```

---

## 5. Preference model proposal

Add **4** columns (keeps the toggle set small; older-adult UX groups them in UI later). Existing
`medication_reminders` / `missed_dose_alerts` / `task_reminders` / `appointment_reminders` /
`visit_updates` / `care_updates` / `emergency_alerts` / `remote_summary` are **preserved**.

| New column | Default | Gates types | Notes |
|---|---|---|---|
| `assignment_alerts` | `true` | `item_assigned` | "You were made responsible for X" (owner) |
| `activity_updates` | `true` | `item_claimed`, `item_completed`, `item_cancelled` | Manager awareness. Candidate for a future digest instead of instant (§18). |
| `available_to_claim_digest` | `false` | `claim_digest` | **Opt-in** — off by default to avoid noise |
| `visit_reminders` | `true` | `visit_upcoming` | Parallels other reminders; `visit_updates` stays for legacy `visit_update` |

Reminder-type mapping (unchanged toggles): `medication_due`→`medication_reminders`,
`medication_missed`→`missed_dose_alerts`, `task_due`/`task_overdue`→`task_reminders`,
`appointment_upcoming`→`appointment_reminders`, `visit_upcoming`→`visit_reminders`.

```sql
-- file 1 (types_preferences)
alter table public.notification_preferences
  add column if not exists assignment_alerts         boolean not null default true,
  add column if not exists activity_updates          boolean not null default true,
  add column if not exists available_to_claim_digest boolean not null default false,
  add column if not exists visit_reminders           boolean not null default true;
```

**Function signature updates** (also file 1). `upsert_notification_preferences` grows by 4 optional
params; because it is called with **named** params by the client (`p_*`), adding
defaulted params is backward-compatible — but a signature change requires **drop + recreate** (a
different arg list is a new overload, not a replace). The client's current 13-named-arg call binds to
the new function via the 4 defaults, so **no app change is required to apply this** (the app can't
*set* the new prefs until its UI lands in 2F-5; until then the column defaults hold). Full SQL in §13.

> App settings UI for the new toggles is **out of scope** (2F-5, §16).

---

## 6. Responsibility-aware recipient resolution

Three additive functions (all `security definer`, `set search_path = ''`, `service_role`-only — they
are engine/producer internals, never client-callable). They mirror the shape of the existing
`circle_notification_recipients` so a producer swaps one call for another.

**6.1 Owner of an item**

```sql
create or replace function public.notification_item_owner(p_entity text, p_item_id uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid;
begin
  case p_entity
    when 'task'        then select assigned_to         into v_owner from public.care_tasks         where id = p_item_id;
    when 'medication'  then select responsible_user_id into v_owner from public.medications        where id = p_item_id;
    when 'appointment' then select assigned_to         into v_owner from public.care_appointments  where id = p_item_id;
    when 'visit'       then select visitor_user_id     into v_owner from public.family_visits       where id = p_item_id;
    else v_owner := null;
  end case;
  return v_owner;  -- null = unassigned/unlinked
end; $$;
revoke all on function public.notification_item_owner(text, uuid) from public;
grant execute on function public.notification_item_owner(text, uuid) to service_role;
```

**6.2 Active managers of a circle** (for fallback + awareness + escalation), with tz/quiet-hours:

```sql
create or replace function public.notification_item_managers(p_circle_id uuid)
returns table (user_id uuid, timezone text, quiet_hours_enabled boolean,
               quiet_hours_start time, quiet_hours_end time)
language sql stable security definer set search_path = '' as $$
  select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
  from public.circle_members cm
  cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
  where cm.circle_id = p_circle_id and cm.status = 'active'
    and cm.role in ('admin','primary_caregiver');
$$;
revoke all on function public.notification_item_managers(uuid) from public;
grant execute on function public.notification_item_managers(uuid) to service_role;
```

**6.3 The unified resolver** (the drop-in replacement for `circle_notification_recipients` on
item events). Audience class is derived from `p_type`; every branch is filtered by active membership
**and** `notification_recipient_eligible` (role + preference + remote/elder exclusion):

```sql
create or replace function public.notification_recipients_for_item_event(
  p_circle_id uuid, p_type public.notification_type, p_entity text, p_item_id uuid
)
returns table (user_id uuid, timezone text, quiet_hours_enabled boolean,
               quiet_hours_start time, quiet_hours_end time)
language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid;
begin
  -- Manager-awareness → managers only.
  if p_type in ('item_claimed','item_completed','item_cancelled') then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver')
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Claim digest → claim-capable members who opted in.
  if p_type = 'claim_digest' then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver','family_member','caregiver')
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Owner-targeted reminders / assignment. Notify the owner ONLY when they hold a valid
  -- operational role (manager or doer). If the owner opted out (eligible=false) this returns
  -- empty and does NOT escalate — the opt-out is respected.
  v_owner := public.notification_item_owner(p_entity, p_item_id);
  if v_owner is not null and exists (
       select 1 from public.circle_members cm
       where cm.circle_id = p_circle_id and cm.user_id = v_owner and cm.status = 'active'
         and cm.role in ('admin','primary_caregiver','family_member','caregiver')
     ) then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.user_id = v_owner
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Unassigned OR owner has a non-operational role (a manager mis-assigned a remote_member/elder,
  -- which the assignment RLS permits — it checks membership, not role): manager fallback ONLY for
  -- medication/appointment/visit reminders. task_due / task_overdue / item_assigned → NOBODY
  -- (no spam; the claim feed + the manager UI cover unassigned/mis-assigned tasks).
  if p_type in ('medication_due','medication_missed','appointment_upcoming','visit_upcoming') then
    return query
      select m.user_id, m.timezone, m.quiet_hours_enabled, m.quiet_hours_start, m.quiet_hours_end
      from public.notification_item_managers(p_circle_id) m
      where public.notification_recipient_eligible(m.user_id, p_circle_id, p_type);
    return;
  end if;
  return;  -- no recipients
end; $$;
revoke all on function public.notification_recipients_for_item_event(uuid, public.notification_type, text, uuid) from public;
grant execute on function public.notification_recipients_for_item_event(uuid, public.notification_type, text, uuid) to service_role;
```

**Requirements satisfied:** operational reminders → owner only; unassigned → manager fallback only
for med/appt/visit (never for tasks); manager-awareness → managers only; other family members are
**never** recipients of someone else's assigned/claimed item; `remote_member` is excluded from every
operational/assignment/awareness/digest type by `notification_recipient_eligible` (§13); `elder` is
excluded by the same allow-list; preferences + quiet hours are preserved (each row carries tz +
quiet-hours for `notification_defer_until`); the delivery pipeline is untouched.

**`notification_recipient_eligible` extension** (new type→preference map + full remote exclusion) is
in §13. **`caregiver`** is added to the eligibility allow-list (§13-B2) — the committed engine omits
it, but Phase 2E makes `caregiver` a claim-capable owner, so a caregiver owner must be able to receive
its own reminders (harmless today; no active caregiver members). **Mis-assignment safety:** the
assignment RLS only checks membership, not role, so a manager *could* set an owner to a
`remote_member`/`elder`; the owner branch requires a valid operational role, so such a row falls
through to the **manager fallback** (med/appt/visit) or to **nobody** (tasks) rather than being
silently black-holed. An owner who simply turned their preference off is respected (empty, **no**
escalation).

---

## 7. Source validity / send-time revalidation

The engine already re-validates at delivery (`notification_source_validity` is called by
`fanout_due_notifications` and, authoritatively, `claim_push_deliveries`). Two additions make it
**responsibility-aware**, with **no** change to its `(valid boolean, reason text)` signature or its
call sites:

1. **Ownership-currency gate (generic).** If the notification carries `data.entity` + `data.itemId`,
   the recipient must still be a valid recipient for that item+type — i.e. still the owner (not
   reassigned/claimed away), or still a manager for awareness/fallback, and still an active member
   with the preference on. This reuses the §6 resolver, so reassignment, claim, unassignment, role
   change, and membership loss are all handled in **one** place. A row without `entity`/`itemId`
   (legacy) skips the gate (treated valid, as today).
2. **Visit branch.** `visit_upcoming` is validated (visit still `planned`; occurrence unchanged),
   closing the current visit coverage gap.
3. **`task_overdue` branch.** Folded into the existing task branch (`n.type in ('task_due',
   'task_overdue')`) so an overdue reminder is skipped once the task is completed, cancelled, or
   rescheduled — the generic ownership gate alone does **not** catch this, because completing a task
   leaves `assigned_to` unchanged (the collaborator trigger sets `completed_by`, not `assigned_to`),
   so the resolver would still return the same owner.

Helper (keeps the `notification_source_validity` diff minimal):

```sql
create or replace function public.notification_recipient_current(p_notification_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare n public.notifications%rowtype; v_entity text; v_item uuid;
begin
  select * into n from public.notifications where id = p_notification_id;
  if not found then return false; end if;

  -- Manager-escalation rows (producer sets data.tier='manager'; e.g. tier-2 medication_missed /
  -- task_overdue after the owner failed to act). These are NOT owner-targeted — the owner exists
  -- but did not act — so validate a CURRENT active manager instead of item ownership. Without this
  -- branch the resolver (owner-only for an assigned item) would drop every escalation as
  -- 'not_current_recipient'.
  if (n.data ->> 'tier') = 'manager' then
    return exists (
      select 1 from public.circle_members cm
      where cm.circle_id = n.circle_id and cm.user_id = n.user_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver')
    ) and public.notification_recipient_eligible(n.user_id, n.circle_id, n.type);
  end if;

  v_entity := nullif(n.data ->> 'entity', '');
  v_item   := nullif(n.data ->> 'itemId', '')::uuid;
  if v_entity is null or v_item is null then
    return true;  -- legacy / no item context → do not block
  end if;
  return exists (
    select 1 from public.notification_recipients_for_item_event(n.circle_id, n.type, v_entity, v_item) r
    where r.user_id = n.user_id
  );
end; $$;
revoke all on function public.notification_recipient_current(uuid) from public;
grant execute on function public.notification_recipient_current(uuid) to service_role;
```

Then `notification_source_validity` is re-created (create-or-replace, same signature) with **three
insertions**: (a) near the top, after loading the notification, return `(false,'not_current_recipient')`
when `not notification_recipient_current(id)`; (b) folding `task_overdue` into the `task_due` branch;
(c) a `visit_upcoming` branch. Full body in §13.

**Requirements satisfied:** medication reminders validate `responsible_user_id`, appointment
`assigned_to`, visit `visitor_user_id`, task/overdue `assigned_to` — all via the resolver's owner
check; reassignment-after-enqueue is skipped (owner check), and completed/cancelled/rescheduled are
skipped by the per-type status/occurrence branches (incl. the new `task_overdue` fold and `visit`
branch); membership loss and manager-role loss are re-checked (resolver requires active membership +
role); remote/elder are ineligible (resolver + eligible); manager-escalation rows revalidate a current
manager (the `data.tier='manager'` branch of `notification_recipient_current`). Because a stale
recipient is skipped at send time, **for owner- and manager-targeted types a deep link is never
delivered to a row the recipient cannot read** (the recipient is, by construction, the current owner
or a manager). Two read-model caveats: (1) the `medications` row itself is member-wide readable (its
base SELECT policy is unchanged by Phase 2D — the responsibility scoping for medication reminders
lives on `medication_logs`), so a medication deep link is safe for any active member and *more*
permissive than the task/appointment/visit rows; (2) **`claim_digest` is excluded from this guarantee**
— its recipients are claim-capable doers who are neither owner nor manager and cannot read an
*unassigned* row via table RLS, so a digest must deep-link to the **`list_available_to_claim`
RPC-backed feed** (aggregate, no per-row `itemId`), never to an item detail.

---

## 8. Claim-flow notification SQL proposal

When a member claims an item, **managers** should learn it is covered. Producers are **deferred to
2F-3** (clearly marked below). The claim RPCs already run server-side and atomically fill the owner
column — the natural producer hook.

- Recipient: **managers only** (`item_claimed` → resolver's manager-awareness branch).
- Claimer confirmation: **in-app only** by default (the existing success sheet `تم التكفّل بهذا
  العنصر`). No push to the claimer.
- **No** notification for the already-claimed race (that path raises `23505` and is in-app only).
- **No** notification to other family members.
- Dedupe key: **`claim:{entity}:{itemId}`** (one claim notice per item; claimer id lives in `data`).

**Recommended producer shape: `AFTER UPDATE` triggers** on each entity, firing when the owner column
transitions `null → set` (fires regardless of code path — claim RPC, manager assign, or future
routes — and can't be skipped by an offline client). A shared helper enqueues to the resolved
recipients.

> The following is **future 2F-3 producer draft SQL** — not part of the inert files 1–2, not to be
> applied until Edge + app + delivery are aligned (§3).

```sql
-- ===== FUTURE 2F-3 PRODUCER DRAFT (do not apply in 2F-2) =====================
-- Shared enqueue helper: fan an item event out to its resolved recipients, each
-- with quiet-hours deferral, reusing the existing enqueue_notification pipeline.
create or replace function public.enqueue_item_event(
  p_circle_id uuid, p_type public.notification_type, p_entity text, p_item_id uuid,
  p_title text, p_body text, p_deep_link text, p_dedupe_key text,
  p_data jsonb default '{}'::jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_count integer := 0; v_data jsonb;
begin
  for r in select * from public.notification_recipients_for_item_event(p_circle_id, p_type, p_entity, p_item_id)
  loop
    v_data := coalesce(p_data,'{}'::jsonb)
              || jsonb_build_object('entity', p_entity, 'itemId', p_item_id, 'circleId', p_circle_id);
    perform public.enqueue_notification(
      r.user_id, p_type, p_title, p_body, p_circle_id, v_data, p_deep_link,
      -- shared dedupe key; uniqueness is scoped per recipient by the (user_id, dedupe_key) index
      p_dedupe_key, null,
      coalesce(r.timezone,'UTC'), coalesce(r.quiet_hours_enabled,false),
      r.quiet_hours_start, r.quiet_hours_end
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.enqueue_item_event(uuid, public.notification_type, text, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.enqueue_item_event(uuid, public.notification_type, text, uuid, text, text, text, text, jsonb) to service_role;

-- Claim/assignment producer trigger on care_tasks (analogous fns for the other 3 entities).
create or replace function public.produce_task_owner_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to then
    -- item_claimed vs item_assigned is disambiguated by who set it; both notify per §6 rules.
    -- Managers get item_claimed awareness; the new owner gets item_assigned. Producers may
    -- emit both with distinct dedupe keys (claim:{...} for managers, assigned:{...}:{owner}).
    perform public.enqueue_item_event(
      new.circle_id, 'item_claimed', 'task', new.id,
      'تم التكفّل', 'تم التكفّل بمهمة.', '/tasks/'||new.id::text,
      'claim:task:'||new.id::text, jsonb_build_object('actorId', new.assigned_to));
  end if;
  return new;
end; $$;
-- (trigger creation deferred; see §17.)
-- ============================================================================
```

*(Manager-only recipients are guaranteed by the resolver's `item_claimed` branch — the producer never
lists other family members. The claimer's in-app confirmation is unchanged and unrelated to this. The
trigger functions `produce_*_owner_event` are `security definer` + `set search_path=''` and, per the
existing house convention for trigger functions — matching `enforce_care_task_collaborator_scope` /
`enforce_family_visit_collaborator_scope` in `20260626162000` — are left at default grants (they
return `trigger`, so they are non-invokable directly and unexposed by PostgREST).)*

---

## 9. Assignment / reassignment notification proposal

Manager assignment/reassignment should notify **only the new responsible person** (`item_assigned`,
resolver owner branch → the single new owner). Belongs in **2F-3 producers** (same trigger family
as §8).

- **No spam to all family** — resolver returns only the new owner.
- **Old owner:** **no push** by default. Optional in-app-only courtesy row ("لم تعد مسؤولًا عن …")
  can be added later if product wants it — not recommended by default (avoids churn).
- **Reassignment invalidates old pending reminders automatically** via the §7 ownership-currency
  gate: a queued `medication_due`/`task_due`/`appointment_upcoming`/`visit_upcoming`/`task_overdue`
  for the *previous* owner is skipped at send time because that recipient is no longer the current
  owner. No explicit cancellation needed.
- Dedupe key: **`assigned:{entity}:{itemId}:{ownerId}`** (owner-aware — a genuine new assignee
  produces a new notification; re-saving the same assignee dedupes). Since the notifications unique
  index is `(user_id, dedupe_key)`, the `ownerId` component mainly documents intent and stabilizes
  cross-retry behavior.

---

## 10. Scheduled reminder proposal

The reminder producers are the **Edge Functions** (`enqueue-due-reminders`, `check-missed-doses`).
This phase provides the SQL helper (`notification_recipients_for_item_event`) and defines the
targeting; **Edge code is not edited here** (2F-4, §15).

| Reminder | Target (via resolver) | Unassigned behavior |
|---|---|---|
| `medication_due` | `responsible_user_id` | managers only |
| `medication_missed` | `responsible_user_id` (tier 1), then **managers** after grace (tier 2) | managers only |
| `task_due` / `task_overdue` | `assigned_to` | **nobody** (no spam; claim feed) |
| `appointment_upcoming` | `assigned_to` | managers only |
| `visit_upcoming` (new producer) | `visitor_user_id` | managers only |

**Manager escalation logic (proposal level).** The resolver returns the **primary** audience (the
owner). Escalation is a **producer-tiered** second enqueue:

- **Missed dose:** dose slot passes → 60-min grace → `check-missed-doses` enqueues `medication_missed`
  to the **responsible** person (tier 1, key `med_missed:{scheduleId}:{ymd}:{time}`). If still
  unrecorded after a second grace window, it enqueues a tier-2 `medication_missed` to
  `notification_item_managers(circle)` (key `med_missed_mgr:{scheduleId}:{ymd}:{time}` — independent
  dedupe so both tiers can fire once).
- **Overdue task:** due passes → `enqueue-due-reminders` (or a new overdue scan) enqueues
  `task_overdue` to `assigned_to` (key `task_overdue:{taskId}:{dueDate}`); optional tier-2 to managers
  (`task_overdue_mgr:{taskId}:{dueDate}`).

> **Producer contract for escalation (required).** Every tier-2 **manager** escalation row must set
> `data.tier = 'manager'`. The send-time ownership-currency gate (§7) treats such rows as
> manager-targeted (validating a *current* active manager) instead of owner-targeted — otherwise the
> resolver, which returns owner-only for an *assigned* item, would drop the escalation as
> `not_current_recipient`. This is the reconciliation between §7 and the escalation tiers.

Escalation cadence (second-grace duration) is an **open product decision** (§18).

---

## 11. Deduplication keys

Exact formats (the `notifications` unique index is `(user_id, dedupe_key)` — keys are already
per-recipient; occurrence/owner components make them stable across cron retries and prevent
duplicate pushes):

| Family | Key format | Notes |
|---|---|---|
| Assignment | `assigned:{entity}:{itemId}:{ownerId}` | Owner-aware; new assignee → new key |
| Claim (manager awareness) | `claim:{entity}:{itemId}` | One per item; claimer in `data` |
| Due reminder — medication | `med:{scheduleId}:{ymd}:{time}` | Existing; occurrence-aware (circle-tz `ymd`) |
| Due reminder — task | `task:{taskId}:{dueDate}:{dueTimeOr'none'}` | Existing |
| Due reminder — appointment | `appt:{appointmentId}:{startsAt}:{lead}` | Existing; per lead (1440/60) |
| Due reminder — visit (new) | `visit:{visitId}:{visitDate}:{startTimeOr'none'}` | New producer |
| Missed dose | `med_missed:{scheduleId}:{ymd}:{time}` (owner) · `med_missed_mgr:{scheduleId}:{ymd}:{time}` (escalation) | Existing owner key; new manager tier |
| Overdue task | `task_overdue:{taskId}:{dueDate}` (owner) · `task_overdue_mgr:{taskId}:{dueDate}` (escalation) | New |
| Outcome (completed/cancelled) | `outcome:{entity}:{itemId}:{status}` | One per terminal transition |
| Digest | `claim_digest:{circleLocalYmd}` | Per user (index scoped) per circle-local day |

---

## 12. Privacy and copy safety

**Data contract (what goes where):**

- **Inbox row (`notifications`)** — detailed, RLS-guarded (recipient is the owner or a manager, who
  can read the target row under Phase 2D RLS for tasks/appointments/visits/`medication_logs`; the
  `medications` catalog row is member-wide readable — see §7): `title`, `body` (item name + time), and
  `data = { entity, itemId, circleId, deepLink, occurrence-keys, tier?, actorId? }`. `claim_digest`
  rows carry **no** `itemId` and deep-link to the `list_available_to_claim` feed (§7).
- **Push payload `data`** — routing only: `{ type, notificationId, circleId, entity, itemId, deepLink }`.
  **No** names, doses, or diagnoses.
- **Remote push title/body** — **generic**, unchanged: `genericPushMessage` (title `سند` / body
  `لديك تذكير جديد`). **Medication lock-screen text stays generic** unless a later explicit product
  decision changes it. Optionally, non-medical events (task/visit/appointment) *may* later use a
  category-generic push body (e.g. `لديك مهمة بحاجة إلى متابعة`) — deferred; default stays generic.

**Copy safety:** Arabic-first, short, non-alarming, **no medical interpretation** (state the recorded
fact only), no detail to unauthorized recipients (guaranteed by generic push + RLS-guarded inbox).
Representative inbox copy (full set in the 2F readiness audit §7):

| Event | AR (title / body) | EN (optional) |
|---|---|---|
| `item_assigned` (task) | `مهمة جديدة لك` / `أُسندت إليك مهمة: {العنوان}.` | *A task for you* |
| `item_claimed` (managers) | `تم التكفّل` / `{العضو} تكفّل بـ {العنصر}.` | *Someone stepped in* |
| `task_overdue` | `مهمة تجاوزت وقتها` / `ما زالت مهمة {العنوان} مفتوحة.` | *A task is past its time* |
| `medication_missed` | `جرعة لم تُسجَّل` / `لم تُسجَّل بعد جرعة {الدواء} المقررة الساعة {الوقت}.` | *A dose isn't recorded* |
| `item_completed` | `تم تسجيل الإتمام` / `سُجّل إتمام {العنصر}.` | *Marked complete* |
| `item_cancelled` (unable) | `تعذّر إنجاز عنصر` / `لم يتم إنجاز {العنصر}.` | *Couldn't be completed* |
| `visit_upcoming` | `زيارة قادمة` / `{العنوان} — {الوقت}.` | *Upcoming visit* |

Times/counts use Western digits; names/times are LTR-isolated at render.

---

## 13. SQL apply-pack draft (review only — do **not** execute)

Split to match the migration grouping (§3). Idempotent where possible; every function
`security definer` + `set search_path = ''` + `revoke all from public` + narrow grant; no policy
broadening; no destructive data change; no delivery enablement.

### A. Types + preferences (file 1 — inert)

```sql
-- A1. Enum values (own migration; a new value cannot be used in the same transaction).
alter type public.notification_type add value if not exists 'item_assigned';
alter type public.notification_type add value if not exists 'task_overdue';
alter type public.notification_type add value if not exists 'visit_upcoming';
alter type public.notification_type add value if not exists 'item_claimed';
alter type public.notification_type add value if not exists 'item_completed';
alter type public.notification_type add value if not exists 'item_cancelled';
alter type public.notification_type add value if not exists 'claim_digest';

-- A2. Preference columns (additive, defaulted).
alter table public.notification_preferences
  add column if not exists assignment_alerts         boolean not null default true,
  add column if not exists activity_updates          boolean not null default true,
  add column if not exists available_to_claim_digest boolean not null default false,
  add column if not exists visit_reminders           boolean not null default true;

-- A3. upsert_notification_preferences: +4 optional params. Drop old signature + recreate
--     (named-arg client calls remain compatible via the new defaults). Pairs with 2F-5 UI.
drop function if exists public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text);

create or replace function public.upsert_notification_preferences(
  p_circle_id uuid,
  p_medication_reminders boolean, p_missed_dose_alerts boolean, p_task_reminders boolean,
  p_appointment_reminders boolean, p_visit_updates boolean, p_care_updates boolean,
  p_emergency_alerts boolean, p_remote_summary boolean,
  p_quiet_hours_enabled boolean, p_quiet_hours_start time, p_quiet_hours_end time, p_timezone text,
  p_assignment_alerts boolean default null, p_activity_updates boolean default null,
  p_available_to_claim_digest boolean default null, p_visit_reminders boolean default null
) returns public.notification_preferences
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row public.notification_preferences;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_circle_id is not null and not public.is_active_user_circle_member(p_circle_id, v_uid) then
    raise exception 'not an active member of this circle' using errcode = '42501';
  end if;
  if p_timezone is not null and p_timezone <> '' and not public.is_valid_timezone(p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  if coalesce(p_quiet_hours_enabled,false) and (p_quiet_hours_start is null or p_quiet_hours_end is null) then
    raise exception 'quiet hours require a start and end' using errcode = '22023';
  end if;

  update public.notification_preferences np set
    medication_reminders      = coalesce(p_medication_reminders, np.medication_reminders),
    missed_dose_alerts        = coalesce(p_missed_dose_alerts, np.missed_dose_alerts),
    task_reminders            = coalesce(p_task_reminders, np.task_reminders),
    appointment_reminders     = coalesce(p_appointment_reminders, np.appointment_reminders),
    visit_updates             = coalesce(p_visit_updates, np.visit_updates),
    care_updates              = coalesce(p_care_updates, np.care_updates),
    emergency_alerts          = coalesce(p_emergency_alerts, np.emergency_alerts),
    remote_summary            = coalesce(p_remote_summary, np.remote_summary),
    assignment_alerts         = coalesce(p_assignment_alerts, np.assignment_alerts),
    activity_updates          = coalesce(p_activity_updates, np.activity_updates),
    available_to_claim_digest = coalesce(p_available_to_claim_digest, np.available_to_claim_digest),
    visit_reminders           = coalesce(p_visit_reminders, np.visit_reminders),
    quiet_hours_enabled       = coalesce(p_quiet_hours_enabled, np.quiet_hours_enabled),
    quiet_hours_start         = p_quiet_hours_start,
    quiet_hours_end           = p_quiet_hours_end,
    timezone                  = coalesce(nullif(p_timezone,''), np.timezone)
  where np.user_id = v_uid and np.circle_id is not distinct from p_circle_id
  returning * into v_row;

  if not found then
    insert into public.notification_preferences (
      user_id, circle_id, medication_reminders, missed_dose_alerts, task_reminders,
      appointment_reminders, visit_updates, care_updates, emergency_alerts, remote_summary,
      assignment_alerts, activity_updates, available_to_claim_digest, visit_reminders,
      quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone
    ) values (
      v_uid, p_circle_id,
      coalesce(p_medication_reminders,true), coalesce(p_missed_dose_alerts,true), coalesce(p_task_reminders,true),
      coalesce(p_appointment_reminders,true), coalesce(p_visit_updates,true), coalesce(p_care_updates,true),
      coalesce(p_emergency_alerts,true), coalesce(p_remote_summary,true),
      coalesce(p_assignment_alerts,true), coalesce(p_activity_updates,true),
      coalesce(p_available_to_claim_digest,false), coalesce(p_visit_reminders,true),
      coalesce(p_quiet_hours_enabled,false), p_quiet_hours_start, p_quiet_hours_end, nullif(p_timezone,'')
    ) returning * into v_row;
  end if;
  return v_row;
end; $$;
revoke all on function public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text,
  boolean, boolean, boolean, boolean) from public;
grant execute on function public.upsert_notification_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text,
  boolean, boolean, boolean, boolean) to authenticated;
```

### B. Resolvers + source validity (file 2 — inert)

```sql
-- B1. effective_notification_prefs: expand return (drop + recreate; PL/pgSQL callers late-bind).
drop function if exists public.effective_notification_prefs(uuid, uuid);
create function public.effective_notification_prefs(p_user_id uuid, p_circle_id uuid)
returns table (
  medication_reminders boolean, missed_dose_alerts boolean, task_reminders boolean,
  appointment_reminders boolean, visit_updates boolean, care_updates boolean,
  emergency_alerts boolean, remote_summary boolean,
  assignment_alerts boolean, activity_updates boolean,
  available_to_claim_digest boolean, visit_reminders boolean,
  quiet_hours_enabled boolean, quiet_hours_start time, quiet_hours_end time, timezone text
) language plpgsql stable security definer set search_path = '' as $$
declare c public.notification_preferences%rowtype; g public.notification_preferences%rowtype;
begin
  if p_circle_id is not null then
    select * into c from public.notification_preferences np where np.user_id=p_user_id and np.circle_id=p_circle_id;
  end if;
  select * into g from public.notification_preferences np where np.user_id=p_user_id and np.circle_id is null;
  return query select
    coalesce(c.medication_reminders,  g.medication_reminders,  true),
    coalesce(c.missed_dose_alerts,    g.missed_dose_alerts,    true),
    coalesce(c.task_reminders,        g.task_reminders,        true),
    coalesce(c.appointment_reminders, g.appointment_reminders, true),
    coalesce(c.visit_updates,         g.visit_updates,         true),
    coalesce(c.care_updates,          g.care_updates,          true),
    coalesce(c.emergency_alerts,      g.emergency_alerts,      true),
    coalesce(c.remote_summary,        g.remote_summary,        true),
    coalesce(c.assignment_alerts,     g.assignment_alerts,     true),
    coalesce(c.activity_updates,      g.activity_updates,      true),
    coalesce(c.available_to_claim_digest, g.available_to_claim_digest, false),
    coalesce(c.visit_reminders,       g.visit_reminders,       true),
    coalesce(c.quiet_hours_enabled,   g.quiet_hours_enabled,   false),
    coalesce(c.quiet_hours_start,     g.quiet_hours_start),
    coalesce(c.quiet_hours_end,       g.quiet_hours_end),
    coalesce(nullif(c.timezone,''),   nullif(g.timezone,''),   'UTC');
end; $$;
revoke all on function public.effective_notification_prefs(uuid, uuid) from public;
grant execute on function public.effective_notification_prefs(uuid, uuid) to service_role;

-- B2. notification_recipient_eligible: map new types + full remote exclusion (create or replace).
create or replace function public.notification_recipient_eligible(
  p_user_id uuid, p_circle_id uuid, p_type public.notification_type
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.circle_role; prefs record; v_pref boolean;
begin
  if p_circle_id is not null then
    select cm.role into v_role from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.user_id = p_user_id and cm.status = 'active';
    if v_role is null
       or v_role not in ('admin','primary_caregiver','family_member','caregiver','remote_member') then
      return false;  -- elder / null / removed
    end if;
    -- NOTE: `caregiver` is ADDED to the allow-list here (the committed engine omits it). Phase 2E
    -- makes caregiver a claim-capable owner, so a caregiver owner must be able to receive its own
    -- reminders. Harmless today (no active caregiver members); flag for product sign-off (§18).
    if v_role = 'remote_member' and p_type in (
      'medication_due','medication_missed','task_due','task_overdue',
      'appointment_upcoming','visit_upcoming','item_assigned',
      'item_claimed','item_completed','item_cancelled','claim_digest'
    ) then
      return false;  -- remote is a read-only observer: no operational/assignment/awareness pushes
    end if;
  end if;

  select * into prefs from public.effective_notification_prefs(p_user_id, p_circle_id);
  v_pref := case p_type
    when 'medication_due'      then prefs.medication_reminders
    when 'medication_missed'   then prefs.missed_dose_alerts
    when 'task_due'            then prefs.task_reminders
    when 'task_overdue'        then prefs.task_reminders
    when 'appointment_upcoming' then prefs.appointment_reminders
    when 'visit_upcoming'      then prefs.visit_reminders
    when 'visit_update'        then prefs.visit_updates
    when 'care_update'         then prefs.care_updates
    when 'item_assigned'       then prefs.assignment_alerts
    when 'item_claimed'        then prefs.activity_updates
    when 'item_completed'      then prefs.activity_updates
    when 'item_cancelled'      then prefs.activity_updates
    when 'claim_digest'        then prefs.available_to_claim_digest
    when 'emergency'           then prefs.emergency_alerts
    when 'system'              then true
    else true
  end;
  return coalesce(v_pref, true);
end; $$;
revoke all on function public.notification_recipient_eligible(uuid, uuid, public.notification_type) from public;
grant execute on function public.notification_recipient_eligible(uuid, uuid, public.notification_type) to service_role;

-- B3.1 notification_item_owner — the responsibility column for an entity (null = unowned).
create or replace function public.notification_item_owner(p_entity text, p_item_id uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid;
begin
  case p_entity
    when 'task'        then select assigned_to         into v_owner from public.care_tasks         where id = p_item_id;
    when 'medication'  then select responsible_user_id into v_owner from public.medications        where id = p_item_id;
    when 'appointment' then select assigned_to         into v_owner from public.care_appointments  where id = p_item_id;
    when 'visit'       then select visitor_user_id     into v_owner from public.family_visits       where id = p_item_id;
    else v_owner := null;
  end case;
  return v_owner;
end; $$;
revoke all on function public.notification_item_owner(text, uuid) from public;
grant execute on function public.notification_item_owner(text, uuid) to service_role;

-- B3.2 notification_item_managers — active managers with tz/quiet-hours (fallback/awareness/escalation).
create or replace function public.notification_item_managers(p_circle_id uuid)
returns table (user_id uuid, timezone text, quiet_hours_enabled boolean,
               quiet_hours_start time, quiet_hours_end time)
language sql stable security definer set search_path = '' as $$
  select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
  from public.circle_members cm
  cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
  where cm.circle_id = p_circle_id and cm.status = 'active'
    and cm.role in ('admin','primary_caregiver');
$$;
revoke all on function public.notification_item_managers(uuid) from public;
grant execute on function public.notification_item_managers(uuid) to service_role;

-- B3.3 notification_recipients_for_item_event — audience class derived from p_type; every branch
--       filtered by active membership + notification_recipient_eligible (role/pref/remote/elder).
create or replace function public.notification_recipients_for_item_event(
  p_circle_id uuid, p_type public.notification_type, p_entity text, p_item_id uuid
)
returns table (user_id uuid, timezone text, quiet_hours_enabled boolean,
               quiet_hours_start time, quiet_hours_end time)
language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid;
begin
  -- Manager-awareness → managers only.
  if p_type in ('item_claimed','item_completed','item_cancelled') then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver')
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Claim digest → claim-capable members who opted in.
  if p_type = 'claim_digest' then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver','family_member','caregiver')
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Owner-targeted reminders / assignment. Notify the owner ONLY when they hold a valid operational
  -- role (manager or doer); an owner who opted out returns empty (no escalation — opt-out respected).
  v_owner := public.notification_item_owner(p_entity, p_item_id);
  if v_owner is not null and exists (
       select 1 from public.circle_members cm
       where cm.circle_id = p_circle_id and cm.user_id = v_owner and cm.status = 'active'
         and cm.role in ('admin','primary_caregiver','family_member','caregiver')
     ) then
    return query
      select cm.user_id, ep.timezone, ep.quiet_hours_enabled, ep.quiet_hours_start, ep.quiet_hours_end
      from public.circle_members cm
      cross join lateral public.effective_notification_prefs(cm.user_id, p_circle_id) ep
      where cm.circle_id = p_circle_id and cm.status = 'active'
        and cm.user_id = v_owner
        and public.notification_recipient_eligible(cm.user_id, p_circle_id, p_type);
    return;
  end if;

  -- Unassigned OR owner has a non-operational role (a manager mis-assigned a remote_member/elder,
  -- which the assignment RLS permits — it checks membership, not role): manager fallback ONLY for
  -- medication/appointment/visit reminders. task_due / task_overdue / item_assigned → NOBODY
  -- (no spam; the claim feed + the manager UI cover unassigned/mis-assigned tasks).
  if p_type in ('medication_due','medication_missed','appointment_upcoming','visit_upcoming') then
    return query
      select m.user_id, m.timezone, m.quiet_hours_enabled, m.quiet_hours_start, m.quiet_hours_end
      from public.notification_item_managers(p_circle_id) m
      where public.notification_recipient_eligible(m.user_id, p_circle_id, p_type);
    return;
  end if;
  return;  -- no recipients
end; $$;
revoke all on function public.notification_recipients_for_item_event(uuid, public.notification_type, text, uuid) from public;
grant execute on function public.notification_recipients_for_item_event(uuid, public.notification_type, text, uuid) to service_role;

-- B4. notification_recipient_current — send-time recipient-currency gate (used by B5).
create or replace function public.notification_recipient_current(p_notification_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare n public.notifications%rowtype; v_entity text; v_item uuid;
begin
  select * into n from public.notifications where id = p_notification_id;
  if not found then return false; end if;

  -- Manager-escalation rows (producer sets data.tier='manager'; e.g. tier-2 medication_missed /
  -- task_overdue after the owner failed to act) validate a CURRENT active manager, NOT item
  -- ownership — otherwise the owner-only resolver would drop them as 'not_current_recipient'.
  if (n.data ->> 'tier') = 'manager' then
    return exists (
      select 1 from public.circle_members cm
      where cm.circle_id = n.circle_id and cm.user_id = n.user_id and cm.status = 'active'
        and cm.role in ('admin','primary_caregiver')
    ) and public.notification_recipient_eligible(n.user_id, n.circle_id, n.type);
  end if;

  v_entity := nullif(n.data ->> 'entity', '');
  v_item   := nullif(n.data ->> 'itemId', '')::uuid;
  if v_entity is null or v_item is null then
    return true;  -- legacy / no item context → do not block
  end if;
  return exists (
    select 1 from public.notification_recipients_for_item_event(n.circle_id, n.type, v_entity, v_item) r
    where r.user_id = n.user_id
  );
end; $$;
revoke all on function public.notification_recipient_current(uuid) from public;
grant execute on function public.notification_recipient_current(uuid) to service_role;

-- B5. notification_source_validity — FULL body = the current committed body (20260611120100) with
--     the three 2F-2 insertions integrated (marked NEW). Signature/return + grants UNCHANGED, so
--     create-or-replace (no drop) is valid and the fanout/claim call sites are untouched.
create or replace function public.notification_source_validity(p_notification_id uuid)
returns table (valid boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n public.notifications%rowtype;
  v_schedule_id uuid;
  v_dose_date date;
  v_scheduled_time time;
  v_sched public.medication_schedules%rowtype;
  v_med_active boolean;
  v_weekday integer;
  v_task public.care_tasks%rowtype;
  v_due_date date;
  v_due_time time;
  v_appt public.care_appointments%rowtype;
  v_starts_at timestamptz;
  v_visit public.family_visits%rowtype;   -- NEW (2F-2)
  v_visit_date date;                       -- NEW (2F-2)
  v_visit_start time;                      -- NEW (2F-2)
begin
  select * into n from public.notifications nn where nn.id = p_notification_id;
  if not found then
    return query select false, 'no_notification'; return;
  end if;

  -- NEW (2F-2): recipient-currency gate. Skip a queued notification whose recipient is no longer the
  -- correct target — reassigned/claimed away, role or membership lost, or a manager-escalation row
  -- whose recipient is no longer a manager. Legacy rows (no data.entity/itemId and non-'manager'
  -- tier) are treated valid by notification_recipient_current, preserving prior behavior.
  if not public.notification_recipient_current(p_notification_id) then
    return query select false, 'not_current_recipient'; return;
  end if;

  if n.type in ('medication_due', 'medication_missed') then
    v_schedule_id := nullif(n.data ->> 'scheduleId', '')::uuid;
    v_dose_date := nullif(n.data ->> 'doseDate', '')::date;
    v_scheduled_time := nullif(n.data ->> 'scheduledTime', '')::time;
    if v_schedule_id is null or v_dose_date is null or v_scheduled_time is null then
      return query select true, 'no_source_context'; return;
    end if;

    select * into v_sched from public.medication_schedules ms where ms.id = v_schedule_id;
    if not found or not v_sched.is_active then
      return query select false, 'schedule_inactive'; return;
    end if;
    select m.is_active into v_med_active from public.medications m where m.id = v_sched.medication_id;
    if v_med_active is null or not v_med_active then
      return query select false, 'medication_inactive'; return;
    end if;

    -- Occurrence must still be a real slot of the (possibly edited) schedule.
    -- extract(dow) is 0=Sunday..6=Saturday, matching days_of_week (JS getDay()).
    v_weekday := extract(dow from v_dose_date)::integer;
    if not (v_weekday = any (v_sched.days_of_week))
       or not (v_scheduled_time = any (v_sched.times))
       or v_dose_date < v_sched.start_date
       or (v_sched.end_date is not null and v_dose_date > v_sched.end_date) then
      return query select false, 'occurrence_changed'; return;
    end if;

    -- Recorded since enqueue? (true for a due reminder AND for a late missed dose.)
    if exists (
      select 1 from public.medication_logs ml
      where ml.schedule_id = v_schedule_id
        and ml.dose_date = v_dose_date
        and ml.scheduled_time = v_scheduled_time
    ) then
      return query select false, 'dose_recorded'; return;
    end if;

    return query select true, 'ok'; return;

  -- NEW (2F-2): task_overdue folded into the task branch (was `n.type = 'task_due'`), so a completed,
  -- cancelled, or rescheduled task also invalidates its overdue reminder.
  elsif n.type in ('task_due', 'task_overdue') then
    if nullif(n.data ->> 'taskId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_task from public.care_tasks t where t.id = (n.data ->> 'taskId')::uuid;
    if not found then
      return query select false, 'task_missing'; return;
    end if;
    if v_task.status <> 'open' then
      return query select false, 'task_closed'; return;
    end if;
    -- Rescheduled? Compare the CURRENT due date/time to the occurrence that
    -- produced this notification (dueTime is the task's raw time, null = date-only).
    v_due_date := nullif(n.data ->> 'dueDate', '')::date;
    v_due_time := nullif(n.data ->> 'dueTime', '')::time;
    if v_task.due_date is distinct from v_due_date
       or v_task.due_time is distinct from v_due_time then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  elsif n.type = 'appointment_upcoming' then
    if nullif(n.data ->> 'appointmentId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_appt from public.care_appointments a where a.id = (n.data ->> 'appointmentId')::uuid;
    if not found then
      return query select false, 'appointment_missing'; return;
    end if;
    if v_appt.status <> 'scheduled' then
      return query select false, 'appointment_closed'; return;
    end if;
    v_starts_at := nullif(n.data ->> 'startsAt', '')::timestamptz;
    if v_appt.starts_at is distinct from v_starts_at then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  -- NEW (2F-2): visit_upcoming branch — visit still planned + occurrence (visit_date/start_time)
  -- unchanged. Uses the generic data.itemId (the new visit producer stores entity='visit'+itemId).
  elsif n.type = 'visit_upcoming' then
    if nullif(n.data ->> 'itemId', '') is null then
      return query select true, 'no_source_context'; return;
    end if;
    select * into v_visit from public.family_visits v where v.id = (n.data ->> 'itemId')::uuid;
    if not found then
      return query select false, 'visit_missing'; return;
    end if;
    if v_visit.status <> 'planned' then
      return query select false, 'visit_closed'; return;
    end if;
    v_visit_date := nullif(n.data ->> 'visitDate', '')::date;
    v_visit_start := nullif(n.data ->> 'startTime', '')::time;
    if v_visit.visit_date is distinct from v_visit_date
       or v_visit.start_time is distinct from v_visit_start then
      return query select false, 'occurrence_changed'; return;
    end if;
    return query select true, 'ok'; return;

  else
    -- No concrete validatable source identifier — keep existing behavior.
    return query select true, 'ok'; return;
  end if;
end;
$$;
revoke all on function public.notification_source_validity(uuid) from public;
grant execute on function public.notification_source_validity(uuid) to service_role;
```

> **Dependency / recreation caveat (B1).** `effective_notification_prefs` is `drop`+recreated because
> its **return shape changes** (adding 4 columns; `create or replace` cannot alter a function's return
> type). Its PL/pgSQL callers (`notification_recipient_eligible`, `circle_notification_recipients`, the
> new resolvers, `fanout_due_notifications`, `claim_push_deliveries`) late-bind by name, so a plain
> `drop function` normally succeeds. **But** if any object holds a hard dependency, Postgres raises a
> dependency error (`2BP01 … other objects depend on it`) on the `drop`. In that case the dependents
> must be dropped/recreated in order — do **not** blindly `drop … cascade`. **Verify this on a
> scratch/staging DB before turning the proposal into real 2F-3 migrations:** run the `drop
> effective_notification_prefs` and confirm no dependency error, or capture the dependency list and
> recreate those functions immediately after the expanded `effective_notification_prefs`. The same
> caveat applies to the `upsert_notification_preferences` drop+recreate (§13-A3), though nothing
> depends on it.

### C. Producer drafts (file 3 — DEFERRED to 2F-3; do **not** apply in 2F-2)

`enqueue_item_event` + `produce_*_owner_event` triggers (claim/assignment) and outcome producers, as
sketched in §8/§9. **Marked future** — applied only when Edge (2F-4), app settings (2F-5), and a
delivery decision (2F-6) are aligned. Reminder producers live in the Edge Functions (§15), not here.

---

## 14. Verification SQL (read-only — run manually in a **future** phase; do **not** run now)

```sql
-- (1) New enum values present.
select enumlabel from pg_enum
where enumtypid = 'public.notification_type'::regtype
  and enumlabel in ('item_assigned','task_overdue','visit_upcoming','item_claimed',
                    'item_completed','item_cancelled','claim_digest')
order by enumlabel;
-- EXPECT: 7 rows.

-- (2) Preference columns + defaults.
select column_name, data_type, column_default
from information_schema.columns
where table_schema='public' and table_name='notification_preferences'
  and column_name in ('assignment_alerts','activity_updates','available_to_claim_digest','visit_reminders')
order by column_name;
-- EXPECT: 4 boolean rows; defaults true/true/false/true.

-- (3) Resolver + validity functions exist with correct grants (service_role, not public).
select p.proname, p.prosecdef as security_definer,
       has_function_privilege('service_role', p.oid, 'execute') as svc_exec,
       has_function_privilege('public',       p.oid, 'execute') as public_exec
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.proname in ('notification_item_owner','notification_item_managers',
                    'notification_recipients_for_item_event','notification_recipient_current',
                    'notification_recipient_eligible','notification_source_validity',
                    'effective_notification_prefs')
order by p.proname;
-- EXPECT: security_definer=true; svc_exec=true; public_exec=false for all.

-- (4) Remote NOT eligible for operational reminders (rolled-back simulation; resolve [QA] UUIDs).
--     remote1 in circle 'رعاية الوالد الغالي'.
select public.notification_recipient_eligible('<REMOTE1_UUID>','<CIRCLE_UUID>','task_due')          as remote_task_due,   -- EXPECT false
       public.notification_recipient_eligible('<REMOTE1_UUID>','<CIRCLE_UUID>','medication_due')    as remote_med_due,    -- EXPECT false
       public.notification_recipient_eligible('<REMOTE1_UUID>','<CIRCLE_UUID>','item_claimed')      as remote_claimed,    -- EXPECT false
       public.notification_recipient_eligible('<REMOTE1_UUID>','<CIRCLE_UUID>','claim_digest')      as remote_digest;     -- EXPECT false

-- (5) Owner-only resolver: a task assigned to family1 resolves to family1 only.
select r.user_id
from public.notification_recipients_for_item_event('<CIRCLE_UUID>','task_due','task','<FAMILY1_TASK_ID>') r;
-- EXPECT: exactly one row = family1's user_id (no other members).

-- (6) Manager-only claim awareness.
select count(*) as non_manager_recipients
from public.notification_recipients_for_item_event('<CIRCLE_UUID>','item_claimed','task','<ANY_TASK_ID>') r
join public.circle_members cm on cm.circle_id='<CIRCLE_UUID>' and cm.user_id=r.user_id
where cm.role not in ('admin','primary_caregiver');
-- EXPECT: 0.

-- (7) Unassigned task → nobody; unassigned appointment → managers only.
select count(*) from public.notification_recipients_for_item_event('<CIRCLE_UUID>','task_due','task','<UNASSIGNED_TASK_ID>');
-- EXPECT: 0.
select bool_and(cm.role in ('admin','primary_caregiver'))
from public.notification_recipients_for_item_event('<CIRCLE_UUID>','appointment_upcoming','appointment','<UNASSIGNED_APPT_ID>') r
join public.circle_members cm on cm.circle_id='<CIRCLE_UUID>' and cm.user_id=r.user_id;
-- EXPECT: true (all managers) or NULL if none.

-- (8) Duplicate dedupe keys (post-producer, after enqueue exists) — should be impossible per
--     the (user_id, dedupe_key) unique index; spot-check any accidental collisions:
select user_id, dedupe_key, count(*) from public.notifications
where dedupe_key is not null group by 1,2 having count(*) > 1;
-- EXPECT: 0 rows.
```

---

## 15. Edge Function impact

| Edge Function | Change needed? | Why |
|---|---|---|
| `enqueue-due-reminders` | **Yes (2F-4)** | Swap `circle_notification_recipients(circle,type)` → `notification_recipients_for_item_event(circle,type,entity,itemId)`; add `entity`+`itemId` (and occurrence keys) to `data`; **add** a `visit_upcoming` producer; **add** a `task_overdue` path |
| `check-missed-doses` | **Yes (2F-4)** | Target `responsible_user_id` (tier 1) via the resolver; add the **manager escalation** tier + its dedupe key |
| `process-notification-outbox` | **No** | Type-agnostic; it calls `fanout_due_notifications` + `claim_push_deliveries`, which call `notification_source_validity` + `notification_recipient_eligible` — both inherit the new SQL logic automatically |
| `check-push-receipts` | **No** | Pure receipt/retention sweep; unaffected by targeting |

So only the **two producer** Edge Functions become responsibility-aware; the **delivery/receipt**
functions are untouched — the responsibility logic lives entirely in SQL (resolver + source-validity)
and flows through the unchanged delivery pipeline.

> **Cache caveat (2F-4).** The current producers memoize recipients by circle: `enqueue-due-reminders`
> keys its cache `${circleId}:${type}` and `check-missed-doses` keys by circle only. Because
> `notification_recipients_for_item_event` resolves the owner of a **specific item**, the 2F-4 swap
> must **re-key the recipient cache per item** (e.g. `${circleId}:${type}:${itemId}`) or drop the
> memoization — otherwise two items in the same circle+type would incorrectly share one owner list.

---

## 16. App impact (later; do not implement)

- **Settings UI (2F-5):** toggles for `assignment_alerts`, `activity_updates`, `visit_reminders`, and
  the opt-in `available_to_claim_digest`; wire the 4 new params of `upsert_notification_preferences`
  (`src/features/notifications/api.ts` + `schema.ts` + settings screen). Group under a few plain
  headings (older-adult UX).
- **Catalog (2F-5):** `catalog.ts` labels + deep-link fallbacks + `notifications-center.tsx` glyphs
  for the 7 new types (`item_assigned`, `task_overdue`, `visit_upcoming`, `item_claimed`,
  `item_completed`, `item_cancelled`, `claim_digest`); a claim/assignment deep-link target.
- **In-app center copy (2F-5):** Arabic-first labels per §12.
- **Generated types:** regenerate `src/types/supabase.ts` **from live** after the SQL is applied
  (adds the new enum values + prefs columns + the upsert signature) — timing in the rollout (§17).
- **`callClaimRpc` cast:** once types are regenerated, the claim RPCs become typed; the
  `as unknown as` cast in `src/features/claiming/api.ts` can be removed later (optional cleanup, not
  required).

---

## 17. Rollout plan

| Phase | Scope | Delivery |
|---|---|---|
| **2F-2** *(this)* | SQL proposal only | off |
| **2F-3** | Create the SQL migration files: **file 1 + file 2 (inert)** first (verify the `effective_notification_prefs` drop has **no dependency error** on a scratch DB first — §13-B / §18.15); **file 3 (producers)** authored but applied last | off |
| **2F-4** | Edge Function responsibility-aware producer changes (`enqueue-due-reminders`, `check-missed-doses`) | off |
| **2F-5** | App settings/catalog/copy + regenerate types from live | off |
| **2F-6** | Manual Dashboard apply (files 1→2→3) + §14 verification | staged on |
| **2F-7** | Real-device Android push QA ([QA] users; owner-only, manager awareness, remote silence, no dup pushes) | on |

**Keep delivery disabled until SQL + Edge + app settings are aligned.** Files 1–2 are safe to apply
anytime (inert); producers (file 3) + Edge (2F-4) are the activation and must land with the app
settings (2F-5) and a deliberate enable.

---

## 18. Risks / open questions

1. **Enum-in-transaction / irreversibility.** `ALTER TYPE … ADD VALUE` cannot be *used* in the same
   transaction it is added, and values cannot be dropped. Mitigation: put enum adds in **file 1**
   alone; keep the set minimal (generic `item_*` types). Confirm PG version supports transactional
   `ADD VALUE` (PG12+); if applying via Dashboard, run file 1 first and separately.
2. **Existing engine assumptions.** `notification_source_validity` reads specific `data` keys
   (`scheduleId`/`taskId`/`appointmentId`); the new gate needs `data.entity`+`data.itemId`. Legacy
   rows without them skip the ownership gate (treated valid) — acceptable, but producers **must**
   populate the new keys.
3. **Cron frequency.** Outbox 1 min / due 5 min / missed 10–15 min / receipts 15–30 min (documented).
   The new `visit_upcoming` + `task_overdue` scans reuse the due/missed cadence; confirm no new cron.
4. **Manager instant vs digest.** `activity_updates` defaults to instant; product may prefer a
   batched manager digest to reduce noise. Left as a default with a flag (§5).
5. **Medication push privacy.** Remote push stays generic; do not add med names to the lock screen
   without an explicit product decision.
6. **Remote summaries later.** `remote_summary` exists but is unused; a remote summary surface is a
   separate future design (not 2F-2).
7. **Escalation grace timing.** The second-grace window (owner→manager escalation) for missed-dose /
   overdue is an open product number.
8. **Schema / app type drift.** After applying, regenerate types from live (2F-5) so the client sees
   the new enum values + prefs columns; until then the client simply can't set the new toggles.
9. **Applying migrations that may already be live.** The engine objects already exist live; every
   change here is `create or replace` / `add … if not exists` / `add value if not exists`, so
   re-applying is a safe no-op. The `drop function` steps (upsert / effective_prefs) are guarded and
   immediately recreated.
10. **Keep notification SQL separate from producer SQL.** Recommended: yes — capability (files 1–2,
    inert) separate from activation (file 3 + Edge), so the safe layer can land and be verified before
    anything starts creating notifications.
11. **Remote exclusion is a behavior change — product sign-off.** The committed engine keeps
    `remote_member` eligible (per prefs) for `medication_missed` and `appointment_upcoming`; §13-B2
    **silences** those for remote (in line with the read-only-observer model). This removes alerts
    remote members receive today — confirm with product before applying.
12. **`caregiver` added to the eligibility allow-list.** Also a change vs the committed engine
    (harmless now — no active caregiver members) — sign off alongside item 11.
13. **Escalation producer contract.** Tier-2 manager escalations **must** set `data.tier='manager'`
    or the §7 ownership gate drops them (§10). This is a hard requirement on the 2F-3/2F-4 producers.
14. **Edge recipient-cache re-keying.** The 2F-4 Edge swap must re-key/drop the circle-level recipient
    cache to be per-item (§15), or per-item owner resolution is wrong.
15. **`effective_notification_prefs` return-shape change may surface a `drop` dependency error.** See
    the §13-B dependency caveat — verify on a scratch DB that the `drop function` succeeds (no
    `2BP01` dependent-object error) before creating the real 2F-3 migrations; if it errors, recreate
    the named dependents in order after the expanded function (never `drop … cascade`).

---

## 19. Confirmation

- ✅ **No SQL run.** All SQL is draft text; nothing executed.
- ✅ **No Supabase CLI / connection.** No `supabase` command, no `gen types`, no DB access.
- ✅ **No app code changed.** No source, generated types, dependencies, Expo config, native files, or
  Edge Functions modified.
- ✅ **No migration files created.** Nothing written under `supabase/migrations/`; the three file
  names are proposals only.
- ✅ **No generated types changed.** `src/types/supabase.ts` untouched.
- ✅ **No env / secrets touched.** No `.env` read; no tokens/keys inspected.
- ✅ **No commit / no stage / no EAS / no prebuild.** The only filesystem write is this report. No
  other project touched (ThinkMate untouched).

## 20. `git` status & diff

Shown at hand-off (read-only):

- `git --no-pager status --short`
- `git --no-pager diff --stat`

The only expected change is the addition of this untracked file:
`docs/claude-reports/2026-06-26-phase-2f-2-responsibility-aware-notification-sql-proposal.md`.
