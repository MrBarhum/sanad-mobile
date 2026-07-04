# Phase 2F-5B - App notification settings / catalog changes (post type-regeneration)

**Status:** Implementation complete. App-side TypeScript now compiles against the regenerated
`src/types/supabase.ts`, and the notification surfaces (settings preferences, catalog labels, center
glyphs, Figma icons, locale copy) are extended for the responsibility-aware notification types.
**Nothing enabling delivery was touched:** no Supabase CLI, no type regeneration, no SQL, no Edge deploy,
no cron/delivery, no migration/Edge changes, no generic push copy change.

**Baseline (pushed) commit:** `3d44862 docs(product): plan supabase type regeneration`.
**Working-tree input at phase start:** `M src/types/supabase.ts` (the user's live regeneration, project
ref `qccgshanmoeybagxwvcs`). Treated as **generated input** and **not** hand-edited in this phase.

---

## 1. Summary of files changed

App source changed by this phase (7 files):

| File | Change |
|---|---|
| `src/features/notifications/api.ts` | Extended `NotificationPreferencesInput` with 4 new booleans; `preferencesToInput` reads the 4 new generated columns with safe defaults; `upsertPreferences` sends the 4 new `p_*` params and applies a localized arg-level cast for the newly non-null `p_circle_id` / quiet-hours / timezone params. |
| `src/features/notifications/schema.ts` | Added `visitReminders` to `BooleanPreferenceKey` and to `PREFERENCE_TOGGLES` (the one newly *visible* toggle); documented why the other 3 new columns stay hidden. |
| `src/features/notifications/catalog.ts` | Added `NOTIFICATION_TYPE_META` entries for all 7 new types (label keys + fallback routes). |
| `src/features/notifications/notifications-center.tsx` | Added `TYPE_GLYPH` entries for all 7 new types (existing `Glyph` constants + calm tones). |
| `src/features/notifications/figma-notifications.tsx` | Added `TYPE_ICON` entries for all 7 new types; added 5 minimal Lucide imports. |
| `src/locales/en.json` | Added 7 `notifications.types.*` labels + `notificationSettings.toggles.visitReminders`. |
| `src/locales/ar.json` | Same keys, Arabic-first copy. |

Not changed (deliberately): `src/features/notifications/notification-settings.tsx` (renders/saves the
toggle list generically - no edit needed, see Section 6); `src/features/claiming/api.ts` (cast cleanup
deferred, Section 8); `src/types/supabase.ts` (generated input, Section 2). No Edge functions, no
migrations, no push-registration/device code.

## 2. `src/types/supabase.ts` treated as generated input (not hand-edited)

- The file was **already modified** in the working tree at phase start (the user's live regeneration).
  This phase **read** it to learn the new shapes and **adapted the app code to it**. It was **not**
  hand-edited, re-generated, or reformatted here.
- Verified shapes the app now depends on (line refs in the regenerated file):
  - `notification_type` enum widened to 15 values (adds the 7 new types).
  - `notification_preferences` `Row`/`Insert`/`Update` gain `assignment_alerts`, `activity_updates`,
    `available_to_claim_digest`, `visit_reminders` (booleans) - L863-930.
  - `upsert_notification_preferences.Args` widened to 17 params; the 4 new params are optional
    (`?: boolean`); `p_circle_id`, `p_quiet_hours_start`, `p_quiet_hours_end`, `p_timezone` are typed as
    **non-null `string`** - L1739-1758.
- The `M src/types/supabase.ts` entry in the final status is that pre-existing regeneration, carried
  through unchanged.

## 3. TypeScript errors fixed

`npx tsc --noEmit` at phase start reported (now all resolved):

1. **`api.ts(146,156,157,158)` - `Type 'string | null' is not assignable to type 'string'`.** The
   regenerated `upsert_notification_preferences.Args` narrowed `p_circle_id`, `p_quiet_hours_start`,
   `p_quiet_hours_end`, and `p_timezone` from `string | null` to non-null `string`. The SQL function
   still accepts NULL for all four (global scope = null circle; quiet-hours/timezone optional). Fixed
   with a **localized, arg-level** `as string` assertion on exactly those four fields - not a client-wide
   cast, and no runtime change (the real nullable values are still passed).
2. **`catalog.ts(17,14)` - `NOTIFICATION_TYPE_META` missing 7 keys.** Added entries for
   `item_assigned`, `task_overdue`, `visit_upcoming`, `item_claimed`, `item_completed`, `item_cancelled`,
   `claim_digest`.
3. **`figma-notifications.tsx(49,7)` - `TYPE_ICON` missing the same 7 keys.** Added.
4. **`notifications-center.tsx(35,7)` - `TYPE_GLYPH` missing the same 7 keys.** Added.

Final: **`npx tsc --noEmit` exits 0** (no errors).

## 4. New notification type coverage added

All 7 new `notification_type` values are now fully mapped in the three per-type maps. Since these maps are
`Record<NotificationType, ...>`, TypeScript now *enforces* completeness - a future enum value cannot
silently fall through.

| Type | Catalog label key | Center glyph / tone | Figma icon / tint |
|---|---|---|---|
| `item_assigned` | `notifications.types.itemAssigned` | `Glyph.profile` / primary | `UserCheck` / blue |
| `task_overdue` | `notifications.types.taskOverdue` | `Glyph.clock` / warning | `Clock` / warning |
| `visit_upcoming` | `notifications.types.visitUpcoming` | `Glyph.visit` / primary | `Calendar` / green |
| `item_claimed` | `notifications.types.itemClaimed` | `Glyph.members` / accent | `Hand` / teal |
| `item_completed` | `notifications.types.itemCompleted` | `Glyph.check` / success | `Check` / success |
| `item_cancelled` | `notifications.types.itemCancelled` | `Glyph.cross` / **neutral** | `XCircle` / **purple** |
| `claim_digest` | `notifications.types.claimDigest` | `Glyph.diamond` / accent | `Sparkles` / gold |

Notes:
- **`item_cancelled` is deliberately calm** - `neutral` tone in the center and a muted purple (not error
  red) in the Figma screen: "couldn't be completed" must not alarm an older-adult family user.
- **All glyphs reuse existing `Glyph` constants** (`profile`, `clock`, `visit`, `members`, `check`,
  `cross`, `diamond`) - no new glyph constants invented.
- **Figma icons** reuse `Calendar`/`Check` (already imported) and add 5 minimal Lucide imports
  (`Clock`, `Hand`, `Sparkles`, `UserCheck`, `XCircle`), kept alphabetical and lint-clean. Icons are
  decorative; the type label text carries the meaning.
- Locale copy for the 7 labels added to both `en.json` and `ar.json` (Arabic-first, calm, non-medical):
  Assigned to you / مُسند إليك · Task overdue / مهمة متأخرة · Upcoming visit / زيارة قادمة ·
  Picked up / تم التكفّل · Completed / تم الإنجاز · Not completed / تعذّر الإنجاز ·
  Available to help / عناصر متاحة.

## 5. New preference fields - API support added

`NotificationPreferencesInput` now carries all 4 new booleans, and the API layer round-trips them fully:

- **Read (`preferencesToInput`)** maps the generated columns with safe defaults matching the SQL column
  defaults: `assignmentAlerts: true`, `activityUpdates: true`, `availableToClaimDigest: false`,
  `visitReminders: true`.
- **Write (`upsertPreferences`)** always sends `p_assignment_alerts`, `p_activity_updates`,
  `p_available_to_claim_digest`, `p_visit_reminders`. Because every save sends all four, a **stored DB
  value is preserved even for columns whose UI toggle is not yet exposed** (the value is loaded into the
  input and written straight back).
- The 4 new params are optional in the generated Args (SQL defaults), so no cast is needed for them; only
  the pre-existing nullable params required the localized `as string` assertion (Section 3).

## 6. Settings toggles - visible now vs hidden/deferred

Decision follows the 2F-5A audit and hard boundary #10 (no dead/confusing toggles for producers that do
not exist yet):

| New column | Gated notification type | Producer status | UI toggle | Rationale |
|---|---|---|---|---|
| `visit_reminders` | `visit_upcoming` | **Live** (Edge producer exists) | **Visible now** | Real effect today, so a real toggle. |
| `assignment_alerts` | `item_assigned` | Deferred | Hidden (data-supported) | Producer not built; visible toggle would be a dead switch. |
| `activity_updates` | `item_claimed`/`item_completed`/`item_cancelled` | Deferred | Hidden (data-supported) | Same. |
| `available_to_claim_digest` | `claim_digest` | None (no digest producer) | Hidden (data-supported) | Explicitly kept hidden; default `false`. |

- Only **`visitReminders`** was added to `PREFERENCE_TOGGLES` (placed with the other reminders, right
  after `appointmentReminders` and before the legacy `visitUpdates`). Its label/description distinguish
  it from the legacy `visitUpdates` toggle ("Visit reminders / Before an upcoming family visit" vs
  "Visit updates / Updates about family visits"; تذكيرات الزيارات vs تحديثات الزيارات).
- `notification-settings.tsx` needed **no change**: it renders `PREFERENCE_TOGGLES.map(...)` and saves
  `{ ...input, timezone }`, so the new visible toggle appears automatically and the 3 hidden columns are
  still persisted through `input`. No redesign, no grouping headings added (kept the existing single calm
  surface to avoid a large UI change).
- Locale labels/descriptions were added **only** for the visible `visitReminders` toggle. No
  `assignmentAlerts` / `activityUpdates` / `availableToClaimDigest` toggle copy was added, so no hidden
  label implies a switch that does not exist.

## 7. Deep-link fallback behavior

`notificationRoute()` is unchanged: it prefers the explicit `deep_link` column, then `data.deepLink`,
then the type's `fallbackRoute`. New `fallbackRoute` values:

- **`claim_digest -> /available-to-claim`.** The digest carries **no `itemId`**, and its recipients
  (claim-capable doers) cannot open an unassigned item's detail via RLS - so it falls back to the
  `/available-to-claim` feed, **never** an entity detail screen. This is the key routing rule for the new
  types.
- **`task_overdue -> /tasks`** and **`visit_upcoming -> /visits`** - the producers set an explicit
  `deep_link` to the specific item (`/tasks/{id}`, `/visits/{id}`); these list routes are only the
  no-deep-link fallback.
- **`item_assigned` / `item_claimed` / `item_completed` / `item_cancelled` -> `null`.** The entity
  varies per event, so there is no safe generic fallback; these rely on the producer's explicit
  `deep_link`, and a tap without one simply opens the inbox (no crash).
- All fallback routes (`/tasks`, `/visits`, `/available-to-claim`) are existing, type-valid `Href`
  routes (confirmed by `tsc` passing). Graceful "no longer available" states for RLS-hidden rows on old
  inbox taps remain a later QA item (2F-5A Section 8) - not a code change here.

## 8. Claim RPC cast cleanup - DEFERRED

Inspected `src/features/claiming/api.ts` and the regenerated claim RPC types. **Deferred** (kept the
existing localized `callClaimRpc` cast), because removing it is **not** a clean net improvement:

- The regenerated `list_available_to_claim.Returns` types every column as **non-null `string`** and
  `item_type` as a bare `string` (not the `ClaimItemType` union). The hand-written `AvailableClaimItem`
  in `claiming/types.ts` is **more accurate** (it correctly marks `subtitle`/`category`/`priority`/
  `scheduled_at`/`date_value`/`time_value` as nullable and narrows `item_type`). Switching to the typed
  RPC would therefore either **lose nullability accuracy** or require a **new** narrowing cast for
  `item_type` - trading one localized cast for another with worse fidelity.
- The existing `callClaimRpc` is already confined to one file, preserves the raw PostgREST error so
  callers keep branching on `error.code` (notably `23505` already-claimed), and is documented.
- Per the task's guidance ("do this only if straightforward... otherwise leave it for a later cleanup and
  mention in the report"), the cleanup is deferred. No behavior change, no new casts introduced, and the
  `23505` handling is untouched.

## 9. Validation results

- `npx tsc --noEmit` -> **exit 0** (no type errors; the phase's key gate).
- `npm run check:mojibake` -> **PASS**:

  ```text
  check:mojibake - scanned 266 active source/config file(s).

  No strong mojibake signatures found in active source/config.
  ```

- `git -c core.autocrlf=false diff --check` -> **clean** (exit code `0`; no whitespace/CRLF errors).
- `npm run lint` was **not** run: per the task, earlier lint is known to fail on pre-existing
  React Compiler rules unrelated to this work, so TypeScript is the gate here. No new lint-risky patterns
  were introduced (imports kept alphabetical/minimal; only additive record entries + typed object keys).

## 10. Delivery boundary

- **No Edge deploy** - `supabase/functions/**` untouched; producers remain undeployed.
- **No cron** - no schedule created or enabled.
- **No delivery** - the outbox/fan-out/claim/Expo pipeline is untouched and idle; this phase only
  prepares app surfaces.
- **No SQL** - no statements run; no DB connection.
- **No Supabase CLI** - no `gen types`, no `link`, no `db push/pull`, no `migration`, no `deploy`.
- **No generic push copy change** - the remote push message is unchanged (this work is inbox/settings
  UI + types only).
- **No `.env`/secrets touched**; no migrations changed; generated types not hand-edited; ThinkMate and
  other projects untouched.

## 11. Final git status / diff

```text
$ git --no-pager status --short
 M src/features/notifications/api.ts
 M src/features/notifications/catalog.ts
 M src/features/notifications/figma-notifications.tsx
 M src/features/notifications/notifications-center.tsx
 M src/features/notifications/schema.ts
 M src/locales/ar.json
 M src/locales/en.json
 M src/types/supabase.ts

$ git --no-pager diff --stat
 src/features/notifications/api.ts                  |   32 +-
 src/features/notifications/catalog.ts              |   12 +
 src/features/notifications/figma-notifications.tsx |   14 +
 src/features/notifications/notifications-center.tsx |    9 +
 src/features/notifications/schema.ts               |   11 +
 src/locales/ar.json                                |   13 +-
 src/locales/en.json                                |   13 +-
 src/types/supabase.ts                              | 1165 +++++++++++--------
 8 files changed, 826 insertions(+), 443 deletions(-)
```

- 7 app-source files changed by this phase + `src/types/supabase.ts` (the pre-existing generated input,
  not modified here). The report file is a new untracked doc.
- Nothing staged, nothing committed.
