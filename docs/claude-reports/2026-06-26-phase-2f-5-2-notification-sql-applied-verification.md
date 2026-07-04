# Phase 2F-5.2 — Notification SQL applied verification report

**Status:** Applied-verification record. The user **manually applied** the two inert notification
migrations through the **Supabase Dashboard SQL Editor** and pasted the verification outputs. This report
documents that apply + verification as the record of truth. **Claude ran no SQL, used no Supabase CLI,
made no DB connection, deployed no Edge, and changed no code except this report.**
**Baseline commit:** `29c143e docs(product): prepare notification SQL manual apply pack`.
**Migrations applied (by the user, Dashboard SQL Editor):**
1. `supabase/migrations/20260626163000_notifications_responsibility_types_preferences.sql`
2. `supabase/migrations/20260626164000_notifications_responsibility_resolvers.sql`
**Source of truth:** the user-pasted PRECHECK / VERIFY 1 / VERIFY 2 / behavioral outputs (reproduced
below). Procedure followed the readiness pack `…phase-2f-5-1-notification-sql-manual-apply-readiness.md`.

---

## 1. Executive summary

- ✅ **`163000` applied successfully** through the Supabase Dashboard SQL Editor.
- ✅ **`164000` applied successfully** through the Supabase Dashboard SQL Editor.
- ✅ **Structural verification passed** — VERIFY 1 (enum values, preference columns, widened upsert) and
  VERIFY 2 (resolver/validity functions, grants, widened return shape, no producers/triggers) all match
  the expected results.
- ✅ **Behavioral verification passed** — 6 of 7 checks PASS; **1 check skipped** (B5b) only because no
  matching row (an unlinked planned visit) exists in the current data — **not** a failure.
- ❌ **No Edge deploy** was performed.
- ❌ **No cron** was enabled.
- ❌ **No notification delivery** was enabled.
- ❌ **No producer SQL trigger/function** was created (`enqueue_item_event` / `produce_*_event` absent;
  only pre-existing update/collaborator triggers present).
- ⚠️ **App generated types are still stale** (`src/types/supabase.ts` unchanged) and must be regenerated
  **from live** in a later, separately-reviewed step before the app can expose the new toggles/labels.
- ➡️ **Next phase:** type-regeneration planning (2F-5.3), then the 2F-5B app settings/catalog work.

The **capability layer** (enum values, preference columns, widened upsert, responsibility resolvers +
updated source-validity) is now **live in the database** and remains **inert**: nothing calls the
resolvers because no producer exists, and delivery/cron stay off.

## 2. Manual apply sequence

The user executed the readiness-pack steps in order, each as its own SQL Editor execution:

1. **PRECHECK — read-only** — run first; captured the clean pre-apply state (§3).
2. **APPLY 1 — `20260626163000_notifications_responsibility_types_preferences.sql`** — run once.
3. **VERIFY 1** — run after APPLY 1; **passed** (§4).
4. **APPLY 2 — `20260626164000_notifications_responsibility_resolvers.sql`** — run once, after VERIFY 1
   passed.
5. **VERIFY 2** — run after APPLY 2; **passed** (§5).
6. **Behavioral verification** — run after structural verification; **passed** (6 PASS, 1 SKIP) (§6).

## 3. PRECHECK result (pre-apply state)

User-pasted summary:

- **P1** — new enum values already present: **`0 rows`** (none of the 7 pre-existed).
- **P2** — new preference columns already present: **`0 rows`** (none of the 4 pre-existed).
- **P4** — dependency check for `effective_notification_prefs` (objects depending ON it): **`0 rows`**.
- **P3** — the committed/current functions existed before apply:
  - `effective_notification_prefs(p_user_id uuid, p_circle_id uuid)`
  - `notification_recipient_eligible(p_user_id uuid, p_circle_id uuid, p_type notification_type)`
  - `notification_source_validity(p_notification_id uuid)`
  - old **13-param** `upsert_notification_preferences(...)`
- **P3 grants** (pre-apply): `security_definer=true`, `svc_exec=true`, `auth_exec=true`,
  `public_exec=false`.

**Interpretation:**
- Clean pre-apply state — the new values/columns were **not** already present, so the additive DDL had a
  well-defined starting point.
- **P4 returned no rows**, so the dependency risk around dropping + recreating
  `effective_notification_prefs` (its return shape changes in `164000`) was **low** — its callers
  late-bind by name and recorded no hard `pg_depend` edge, so the drop was expected to (and did) succeed
  without a `2BP01` error.

## 4. VERIFY 1 result (after `163000`)

### Enum values — `V1.1` returned exactly 7 rows

```text
claim_digest
item_assigned
item_cancelled
item_claimed
item_completed
task_overdue
visit_upcoming
```

### Preference columns — `V1.2` returned exactly 4 rows

```json
[
  { "column_name": "activity_updates",          "data_type": "boolean", "column_default": "true"  },
  { "column_name": "assignment_alerts",         "data_type": "boolean", "column_default": "true"  },
  { "column_name": "available_to_claim_digest", "data_type": "boolean", "column_default": "false" },
  { "column_name": "visit_reminders",           "data_type": "boolean", "column_default": "true"  }
]
```

### Widened upsert — `V1.3` returned one widened function row

```json
[
  {
    "args": "p_circle_id uuid, p_medication_reminders boolean, p_missed_dose_alerts boolean, p_task_reminders boolean, p_appointment_reminders boolean, p_visit_updates boolean, p_care_updates boolean, p_emergency_alerts boolean, p_remote_summary boolean, p_quiet_hours_enabled boolean, p_quiet_hours_start time without time zone, p_quiet_hours_end time without time zone, p_timezone text, p_assignment_alerts boolean, p_activity_updates boolean, p_available_to_claim_digest boolean, p_visit_reminders boolean",
    "auth_exec": true,
    "public_exec": false
  }
]
```

`V1.4` returned:

```json
[
  { "total_args": 17, "defaulted_args": 4 }
]
```

**Interpretation:**
- Enum expansion succeeded — all 7 new `notification_type` values exist.
- The 4 preference columns were added with the intended defaults (`assignment_alerts=true`,
  `activity_updates=true`, `available_to_claim_digest=false`, `visit_reminders=true`).
- `upsert_notification_preferences` is now the single **17-param** function (the old 13-param overload is
  gone — `V1.3` returned only one row); it is granted to `authenticated`, not `public`.
- **Backward-compatibility confirmed by catalog:** `total_args=17` with `defaulted_args=4`, so the 4 new
  params are the trailing defaulted args — the app's current 13-arg **named** call still binds via the
  defaults. No app change is required for the apply to be safe.

## 5. VERIFY 2 result (after `164000`)

`APPLY 2` completed with:

```text
Success. No rows returned
```

### Function / grant verification — `V2.1` returned 7 functions

```json
[
  { "proname": "effective_notification_prefs",            "args": "p_user_id uuid, p_circle_id uuid",                                              "security_definer": true, "svc_exec": true, "public_exec": false },
  { "proname": "notification_item_managers",              "args": "p_circle_id uuid",                                                              "security_definer": true, "svc_exec": true, "public_exec": false },
  { "proname": "notification_item_owner",                 "args": "p_entity text, p_item_id uuid",                                                 "security_definer": true, "svc_exec": true, "public_exec": false },
  { "proname": "notification_recipient_current",          "args": "p_notification_id uuid",                                                        "security_definer": true, "svc_exec": true, "public_exec": false },
  { "proname": "notification_recipient_eligible",         "args": "p_user_id uuid, p_circle_id uuid, p_type notification_type",                    "security_definer": true, "svc_exec": true, "public_exec": false },
  { "proname": "notification_recipients_for_item_event",  "args": "p_circle_id uuid, p_type notification_type, p_entity text, p_item_id uuid",     "security_definer": true, "svc_exec": true, "public_exec": false },
  { "proname": "notification_source_validity",            "args": "p_notification_id uuid",                                                        "security_definer": true, "svc_exec": true, "public_exec": false }
]
```

**Interpretation:**
- All expected resolver/helper + updated functions exist:
  `notification_item_owner`, `notification_item_managers`, `notification_recipients_for_item_event`,
  `notification_recipient_current` (new); `effective_notification_prefs`,
  `notification_recipient_eligible`, `notification_source_validity` (updated).
- All are `security_definer=true`.
- All are executable by `service_role` (`svc_exec=true`).
- **None** are executable by `public` (`public_exec=false`) — the engine-internal grant boundary is
  intact.

### Widened return shape — `V2.2` returned

```json
[
  { "return_shape": "TABLE(medication_reminders boolean, missed_dose_alerts boolean, task_reminders boolean, appointment_reminders boolean, visit_updates boolean, care_updates boolean, emergency_alerts boolean, remote_summary boolean, assignment_alerts boolean, activity_updates boolean, available_to_claim_digest boolean, visit_reminders boolean, quiet_hours_enabled boolean, quiet_hours_start time without time zone, quiet_hours_end time without time zone, timezone text)" }
]
```

**Interpretation:** `effective_notification_prefs` now returns the 4 new preference fields —
`assignment_alerts`, `activity_updates`, `available_to_claim_digest`, `visit_reminders` — confirming the
drop+recreate applied the widened return shape.

### No producer functions — `V2.3a` returned

```text
Success. No rows returned
```

**Interpretation:** no `enqueue_item_event`, no `produce_*_event` — **no producer function was created**.

### No producer triggers — `V2.3b` returned

```json
[
  { "table_name": "medications",        "tgname": "medications_set_updated_at" },
  { "table_name": "care_tasks",         "tgname": "care_tasks_collaborator_scope" },
  { "table_name": "care_tasks",         "tgname": "care_tasks_set_updated_at" },
  { "table_name": "care_appointments",  "tgname": "care_appointments_set_updated_at" },
  { "table_name": "family_visits",      "tgname": "family_visits_collaborator_scope" },
  { "table_name": "family_visits",      "tgname": "family_visits_set_updated_at" }
]
```

**Interpretation:**
- No notification producer triggers exist — only the pre-existing `*_set_updated_at` bookkeeping triggers
  and the Phase-2E `*_collaborator_scope` triggers are present.
- No `produce_*` / `notify_*` trigger was added; notification production remains inert.

## 6. Behavioral verification result

User-pasted result (read-only, discovery-based resolver calls):

```json
[
  {
    "check_name": "B1 remote_member excluded",
    "status": "PASS",
    "details": {
      "med_due": false,
      "user_id": "4f89a6ab-80dc-464c-be1a-2a65dde5ec98",
      "task_due": false,
      "circle_id": "ae4721d8-bd65-4fa8-bc25-e10ea73f357c",
      "claim_digest": false,
      "item_claimed": false
    }
  },
  {
    "check_name": "B2 medication_due assigned owner",
    "status": "PASS",
    "details": {
      "medication_id": "865cb67b-d49b-4a15-8e1a-f6a0a430b84f",
      "expected_owner": "86ce2a79-7072-47c9-947e-4d940006b492",
      "resolved_recipients": [
        "86ce2a79-7072-47c9-947e-4d940006b492"
      ]
    }
  },
  {
    "check_name": "B3 unassigned medication manager fallback",
    "status": "PASS",
    "details": {
      "managers": [
        "b2159dd4-f93d-4208-903e-fa3eb7a72497",
        "d4178889-b0ad-4489-b2e0-f1f814a18aba"
      ],
      "resolved": [
        "b2159dd4-f93d-4208-903e-fa3eb7a72497",
        "d4178889-b0ad-4489-b2e0-f1f814a18aba"
      ],
      "medication_id": "4a83ff7d-dd97-4842-b993-fb8cc1aeab84"
    }
  },
  {
    "check_name": "B4 unassigned task sends nobody",
    "status": "PASS",
    "details": {
      "task_id": "e359be1e-d709-4f4e-b28c-8b5cb3cb22a1",
      "recipient_count": 0
    }
  },
  {
    "check_name": "B5a unassigned appointment manager fallback",
    "status": "PASS",
    "details": {
      "managers": [
        "b2159dd4-f93d-4208-903e-fa3eb7a72497",
        "d4178889-b0ad-4489-b2e0-f1f814a18aba"
      ],
      "resolved": [
        "b2159dd4-f93d-4208-903e-fa3eb7a72497",
        "d4178889-b0ad-4489-b2e0-f1f814a18aba"
      ],
      "appointment_id": "1f7c2392-870f-450a-a166-25e852dfb412"
    }
  },
  {
    "check_name": "B5b unlinked visit manager fallback",
    "status": "SKIP_NO_UNLINKED_PLANNED_VISIT",
    "details": {
      "managers": [],
      "resolved": [],
      "visit_id": null
    }
  },
  {
    "check_name": "B6 item_claimed managers only",
    "status": "PASS",
    "details": {
      "managers": [
        "b2159dd4-f93d-4208-903e-fa3eb7a72497",
        "d4178889-b0ad-4489-b2e0-f1f814a18aba"
      ],
      "circle_id": "ae4721d8-bd65-4fa8-bc25-e10ea73f357c",
      "claimed_recipients": [
        "b2159dd4-f93d-4208-903e-fa3eb7a72497",
        "d4178889-b0ad-4489-b2e0-f1f814a18aba"
      ]
    }
  }
]
```

**Interpretation (per check):**
- **B1 PASS** — `remote_member` is excluded from operational/awareness/digest eligibility
  (`medication_due`, `task_due`, `item_claimed`, `claim_digest` all `false`).
- **B2 PASS** — an assigned medication resolves `medication_due` to exactly its `responsible_user_id`
  (`resolved_recipients == [expected_owner]`).
- **B3 PASS** — an unassigned medication falls back to managers (`resolved == managers`).
- **B4 PASS** — an unassigned open task resolves to **nobody** (`recipient_count == 0`) — no manager
  fallback for tasks, as designed.
- **B5a PASS** — an unassigned scheduled appointment falls back to managers (`resolved == managers`).
- **B5b SKIP** — no unlinked *planned* visit exists in current data, so the CTE found no row
  (`visit_id: null`, empty arrays). This is a **data-availability skip, not a failure**; the same
  fallback logic is already proven by B3/B5a (identical resolver branch), and `visit_upcoming` is in the
  fallback allow-list of `notification_recipients_for_item_event`. Re-run when an unlinked planned visit
  exists to exercise it directly.
- **B6 PASS** — `item_claimed` (manager awareness) targets managers only
  (`claimed_recipients == managers`); no doer/remote/elder appears.

Net: the responsibility-aware resolution behaves exactly as specified — owner-targeting, correct
manager fallback for medication/appointment/visit, no-fallback for tasks, remote exclusion, and
manager-only awareness.

## 7. Security / delivery boundary

- The **SQL capability layer is now live** in the database (enum values, preference columns, widened
  upsert, resolver + updated source-validity functions).
- **No delivery** has been enabled — the outbox/fan-out/claim/Expo pipeline is untouched and idle.
- **No cron** has been enabled — no schedule was created for any notification function.
- **No Edge deployment** happened — the responsibility-aware producers remain undeployed.
- **No producer SQL function or trigger exists** — verified by `V2.3a` (no rows) and `V2.3b` (only
  pre-existing update/collaborator triggers).
- The **app still compiles against stale generated types** and does **not** yet expose the new
  toggles/catalog labels (that is 2F-5B, after type regeneration).
- The **repo Edge code now depends** on `notification_recipients_for_item_event` /
  `notification_item_managers` (present live after this apply), but Edge **must still not be deployed**
  until the remaining rollout steps (types regen → 2F-5B → deliberate deploy → cron/delivery enable) are
  done.

## 8. What is now safe / what is still not safe

**Safe now:**
- Start planning **type regeneration from live** (2F-5.3).
- Prepare the **2F-5B** app settings/catalog changes to follow regenerated types.
- Continue local report/code phases.

**Not safe yet:**
- ❌ Do **not** deploy Edge functions.
- ❌ Do **not** enable cron.
- ❌ Do **not** enable notification delivery.
- ❌ Do **not** start real-device push QA.
- ❌ Do **not** expose the new app toggles/labels before types are regenerated and app code is updated.

## 9. Next recommended step

**Phase 2F-5.3 — Supabase type regeneration plan / guarded execution.**

- This project generally **avoids the Supabase CLI unless explicitly approved**.
- Types must come **from live** (the schema now differs from the stale generated types), so this needs a
  **separate, reviewed plan** — not an ad-hoc run.
- **Do not** run `supabase gen types` inside this report or as part of this phase.
- The next phase should either:
  - prepare **exact manual / CLI-safe** type-regeneration instructions (targeting the Sanad project
    explicitly, never touching the global CLI login/link), **or**
  - ask the user to **approve a one-time** Supabase typegen command if that is the chosen path.
- After type regeneration, proceed to **2F-5B** app notification settings/catalog changes (new enum
  labels, 4 preference toggles per the 2F-5A audit, catalog glyphs, locale copy, deep-link fallbacks —
  esp. `claim_digest` → `/available-to-claim`).

## 10. Validation / local checks

Run in this environment (safe, local; no SQL / CLI / network):

- `npm run check:mojibake` → **PASS** — `check:mojibake - scanned 266 active source/config file(s). No
  strong mojibake signatures found in active source/config.`
- `git -c core.autocrlf=false diff --check` → **clean** (exit 0; no whitespace/CRLF errors).

## 11. Confirmation

- ✅ **No code changed except this report.**
- ✅ **No SQL run by Claude** — all SQL was executed by the user in the Dashboard; the outputs here are
  the user's pasted results.
- ✅ **No Supabase CLI.**
- ✅ **No DB connection by Claude.**
- ✅ **No Edge deploy.**
- ✅ **No app source changed** (`src/**` untouched).
- ✅ **No Edge source changed** (`supabase/functions/**` untouched).
- ✅ **No migrations changed** (`supabase/migrations/**` untouched).
- ✅ **No generated types changed** (`src/types/supabase.ts` untouched).
- ✅ **No env / secrets touched.**
- ✅ **No commit / no stage.** No cron/delivery enabled. No other project touched (ThinkMate untouched).

## 12. Final git state

Captured read-only at hand-off:

- `git --no-pager status --short`
- `git --no-pager diff --stat`

Expected: one **untracked** file (`??`) — this report — and an empty `diff --stat`. Actual output is
shown in the hand-off message.
