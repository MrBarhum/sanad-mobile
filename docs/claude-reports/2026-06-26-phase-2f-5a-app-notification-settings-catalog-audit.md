# Phase 2F-5A — App notification settings / catalog / types audit

**Status:** Audit / plan **only**. **No app code was changed** (this report is the sole filesystem
write). No SQL run, no Supabase CLI, no DB connection, no `supabase gen types`, no Edge deploy, no
migrations/generated-types/app-source/env touched, nothing committed or staged.
**Baseline commit:** `b145153 feat(notifications): make edge producers responsibility aware`.
**Inert SQL in place (not applied by this phase):** `20260626163000` (enum values + 4 pref columns +
widened `upsert_notification_preferences`) and `20260626164000` (resolver/validity functions).
**Edge producers:** already responsibility-aware (2F-4B) but **not deployed**; only `task_overdue` and
`visit_upcoming` have **live** producers — `item_assigned` / `item_claimed` / `item_completed` /
`item_cancelled` / `claim_digest` producers remain **deferred** (SQL producer migration `165000` is not
created; the digest producer does not exist).

---

## 1. Executive summary

**Current app notification readiness.** The app already ships a complete, working notification stack for
the **8 committed** enum types: an inbox center (`notifications-center.tsx`), a per-circle/global settings
screen (`notification-settings.tsx`) with 8 preference toggles + quiet hours + timezone, a typed
API/hooks layer, a catalog/route module, deep-link routing with circle-switch safety, push registration
(opt-in, Android channel, local self-test), and Arabic-first + English locale keys. It compiles cleanly
today because everything is aligned to the **stale** generated types (8-value enum, 8 pref columns,
13-arg `upsert`).

**What is missing before enabling delivery.** The app has **no awareness** of the 7 new enum types or the
4 new preference columns: the generated types are stale (§6), so there are no catalog labels, glyphs,
Arabic/English copy, settings toggles, or type→preference mappings for them (§3). A new-type notification
that arrived today would **degrade gracefully** to the generic `system` label/glyph (no crash), routing
via its explicit `deep_link`, but would read as "تحديث / Update" with no proper label. The settings screen
cannot display or edit the 4 new toggles, and `upsertPreferences` cannot send the 4 new params in a
type-safe way until types are regenerated.

**What should change in 2F-5B.** After the SQL migrations are applied to live and **types are
regenerated**: extend the local preference input/schema/API for the 4 new columns; add catalog labels +
glyphs + locale copy for the 7 new types; add settings toggles for the new columns whose producers are
live (chiefly `visit_reminders`; defer `assignment_alerts` / `activity_updates` /
`available_to_claim_digest` toggles until their producers exist — §4/§14); confirm deep-link fallbacks
(esp. `claim_digest` → `/available-to-claim`, never an item detail); optionally remove the
`callClaimRpc` cast once claim RPCs are in regenerated types. **Delivery/cron stays off** throughout.

**No app code was changed in this phase.**

## 2. Current app notification architecture

| Concern | File(s) |
|---|---|
| Settings screen | `src/features/notifications/notification-settings.tsx`; route `src/app/(app)/notification-settings.tsx` |
| Notification center / list | `src/features/notifications/notifications-center.tsx`; route `src/app/(app)/notifications.tsx`; Figma ref `figma-notifications.tsx`; bell `notification-bell.tsx`; in-app banner `reminder-notice.tsx` |
| API (reads + RPC writes) | `src/features/notifications/api.ts` |
| Hooks (queries, mutations, push lifecycle, deep-link open, observers) | `src/features/notifications/hooks.ts` |
| Schema / validation (toggle list, quiet-hours validity) | `src/features/notifications/schema.ts` |
| Catalog / type→route mapping | `src/features/notifications/catalog.ts` (per-type `NOTIFICATION_TYPE_META`, `notificationRoute`, `notificationData`) |
| Per-type glyph/tone (visual anchor) | `TYPE_GLYPH` inside `notifications-center.tsx` |
| Route / deep-link handling | `useOpenNotification` + `useNotificationObservers` in `hooks.ts`; `notificationRoute` in `catalog.ts` |
| Push registration / device plumbing | `push-registration.ts`, `device.ts`, `push-status-card.tsx`; lifecycle in `usePushRegistration` (`hooks.ts`); mounted via `notification-observer.tsx` |
| Locale keys | `src/locales/ar.json` + `src/locales/en.json` → `notifications.*` (L1093–1120), `notificationSettings.*` (L1121–1206), `figma.notifications.*` (L1248) |
| Account entry point | `src/app/(app)/(tabs)/account.tsx` (`notificationsSectionTitle`) |

Notes: writes go exclusively through SECURITY DEFINER RPCs (`set_notification_read`,
`mark_all_notifications_read`, `upsert_notification_preferences`, `register_push_token`,
`deactivate_push_token`). The inbox is read via RLS-scoped `select *` on `notifications`. Deep-link open
switches the active circle first **only if still an active member**, else routes to the inbox
(`useOpenNotification`, `hooks.ts:265`).

## 3. Notification type coverage audit

Legend: ✅ present · ❌ absent · ⚠️ degrades to `system` fallback.

**Committed (8) — fully covered:**

| Type | TS enum | Catalog label | Glyph/tone | AR copy | EN copy | Center render | Deep-link | Toggle mapping |
|---|---|---|---|---|---|---|---|---|
| `medication_due` | ✅ | ✅ `/medications` | ✅ medication/primary | ✅ | ✅ | ✅ | ✅ | `medicationReminders` |
| `medication_missed` | ✅ | ✅ `/medications` | ✅ medication/warning | ✅ | ✅ | ✅ | ✅ | `missedDoseAlerts` |
| `task_due` | ✅ | ✅ `/tasks` | ✅ task/primary | ✅ | ✅ | ✅ | ✅ | `taskReminders` |
| `appointment_upcoming` | ✅ | ✅ `/appointments` | ✅ appointment/primary | ✅ | ✅ | ✅ | ✅ | `appointmentReminders` |
| `visit_update` | ✅ | ✅ `/visits` | ✅ members/accent | ✅ | ✅ | ✅ | ✅ | `visitUpdates` |
| `care_update` | ✅ | ✅ `/daily-logs` | ✅ dailyLog/primary | ✅ | ✅ | ✅ | ✅ | `careUpdates` |
| `emergency` | ✅ | ✅ `/emergency-card` | ✅ emergency/error | ✅ | ✅ | ✅ | ✅ | `emergencyAlerts` |
| `system` | ✅ | ✅ null | ✅ system/neutral | ✅ | ✅ | ✅ | ✅ (always on) | — |

**New 2F-3 (7) — not covered (all degrade to `system`):**

| Type | TS enum | Catalog label | Glyph/tone | AR copy | EN copy | Center render | Deep-link | Toggle mapping | Fallback today |
|---|---|---|---|---|---|---|---|---|---|
| `item_assigned` | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | explicit `deep_link` only | `assignment_alerts` (missing) | system label + explicit deep link |
| `task_overdue` | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | explicit `deep_link` → `/tasks/{id}` | `task_reminders` (existing col) | system label; deep link works |
| `visit_upcoming` | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | explicit `deep_link` → `/visits/{id}` | `visit_reminders` (missing) | system label; deep link works |
| `item_claimed` | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | explicit `deep_link` only | `activity_updates` (missing) | system label + explicit deep link |
| `item_completed` | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | explicit `deep_link` only | `activity_updates` (missing) | system label + explicit deep link |
| `item_cancelled` | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | explicit `deep_link` only | `activity_updates` (missing) | system label + explicit deep link |
| `claim_digest` | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | must be `/available-to-claim` (no itemId) | `available_to_claim_digest` (missing) | system label; **needs digest route** |

**Graceful-degradation mechanics (why nothing crashes today):** `notificationMeta()` and `TYPE_GLYPH`
both `?? system`, and `NotificationType` is the generated enum union — a runtime row carrying a
not-yet-known type simply hits the `system` fallback (`catalog.ts:29`, `notifications-center.tsx:211`).
Producers set an explicit `deep_link`, so routing still works for `task_overdue`/`visit_upcoming`. Only
`task_overdue` and `visit_upcoming` are actually produced today; the other five await deferred producers.

## 4. Settings preference audit

**Existing 8 booleans + quiet-hours + timezone** — fully wired: `NotificationPreferences` Row (generated),
`NotificationPreferencesInput` (hand-typed, `api.ts:10`), `preferencesToInput` (`api.ts:186`),
`upsertPreferences` (`api.ts:139`), `PREFERENCE_TOGGLES` (`schema.ts:31`), and the settings UI
(`notification-settings.tsx`) all know them.

**New 2F-3 columns** — `assignment_alerts`, `activity_updates`, `available_to_claim_digest`,
`visit_reminders`:

| Question | Answer |
|---|---|
| App types know these fields? | **No.** `notification_preferences` Row (generated, `supabase.ts:1027`) has only the 8 existing booleans. `NotificationPreferencesInput` (hand-typed) does not list them. Reading `row.assignment_alerts` in `preferencesToInput` would be a TS error until types regenerate. |
| API fetch/update knows them? | **No.** `fetchPreferences` returns the (stale) Row; `upsertPreferences` sends only the 13 existing params (`api.ts:145`). |
| Form schema validates them? | **No.** `BooleanPreferenceKey` + `PREFERENCE_TOGGLES` (`schema.ts:11/31`) list only the 8 existing keys. |
| UI can display/edit them? | **No.** The settings screen renders `PREFERENCE_TOGGLES` only. |

**Recommended grouping (older-adult UX).** Keep one calm grouped surface per heading, short labels:

- **التذكيرات / Reminders:** `medicationReminders`, `missedDoseAlerts`, `taskReminders`,
  `appointmentReminders`, `visitReminders` *(new)*.
- **مسؤولياتك / Your responsibilities:** `assignmentAlerts` *(new)* — and `availableToClaimDigest` *(new,
  opt-in)* only once its producer exists.
- **متابعة النشاط / Activity updates:** `activityUpdates` *(new; manager-oriented)*.
- **أخرى / Other:** `careUpdates`, `emergencyAlerts`, `remoteSummary` (and legacy `visitUpdates` — see
  note). Quiet hours + timezone stay as-is below.

> **Legacy `visit_updates` vs new `visit_reminders`:** `visit_updates` gates the legacy `visit_update`
> type, which has **no producer**; `visit_reminders` gates the new, **live** `visit_upcoming`. Two visit
> toggles risk confusing older users — recommend clarifying labels (e.g. "تذكيرات الزيارات" for the new
> reminder vs "تحديثات الزيارات" for legacy updates) or hiding the legacy toggle until/unless a
> `visit_update` producer lands. Flagged in §14.

**Default labels/copy (Arabic-first, calm, no medical interpretation):**

| Column | AR label / description | EN label / description |
|---|---|---|
| `assignment_alerts` | تنبيهات الإسناد / عند إسناد عنصر إليك. | Assignment alerts / When something is assigned to you. |
| `activity_updates` | تحديثات النشاط / عندما يتكفّل أحد بعنصر أو يُنجزه أو يتعذّر إنجازه. | Activity updates / When someone picks up, completes, or can't complete an item. |
| `available_to_claim_digest` | ملخّص العناصر المتاحة / ملخّص اختياري بالعناصر التي يمكنك التكفّل بها. | Available-to-help digest / Optional summary of items you can pick up. |
| `visit_reminders` | تذكيرات الزيارات / قبل زيارة عائلية قادمة. | Visit reminders / Before an upcoming family visit. |

**`available_to_claim_digest` default:** keep **opt-in / OFF by default** (matches the SQL column default
`false`). Recommend **hiding** the toggle until the digest producer exists so it is not a dead switch
(§14).

## 5. `upsert_notification_preferences` API audit

- **Current params sent (`api.ts:145`):** the 13 named args `p_circle_id`, `p_medication_reminders`,
  `p_missed_dose_alerts`, `p_task_reminders`, `p_appointment_reminders`, `p_visit_updates`,
  `p_care_updates`, `p_emergency_alerts`, `p_remote_summary`, `p_quiet_hours_enabled`,
  `p_quiet_hours_start`, `p_quiet_hours_end`, `p_timezone`.
- **Missing new params:** `p_assignment_alerts`, `p_activity_updates`, `p_available_to_claim_digest`,
  `p_visit_reminders`.
- **Compatibility:** **Yes — the current call still works.** The widened SQL function defaults the 4 new
  params to `null` (COALESCE-preserves the stored value), so a 13-named-arg call binds to the 17-param
  function. The **generated** Args type still lists exactly the 13 params (`supabase.ts:1413`), so the
  current call is also type-valid **today** with no regeneration.
- **What 2F-5B should add:** the 4 new params to the `.rpc(...)` call, the 4 new fields to
  `NotificationPreferencesInput`, `preferencesToInput`, and (where exposed) the toggle list — done **after**
  regeneration so the widened Args type accepts the new keys.
- **Type mismatch from stale types:** adding the 4 new keys to the `.rpc('upsert_notification_preferences',
  {...})` call **before** regeneration is a TS error (the 13-key Args type would reject the extra keys),
  and reading the 4 new columns off the Row is likewise an error. Both resolve on regeneration; a
  localized cast (à la `callClaimRpc`) is the only pre-regen workaround and is not recommended.

## 6. Generated types audit (`src/types/supabase.ts`) — do not edit / do not regenerate here

| Question | Finding |
|---|---|
| New enum values present? | **No.** `notification_type` (L1572) lists only the 8 committed values; the 7 new values are absent. |
| New preference columns present? | **No.** `notification_preferences` Row/Insert/Update (L1027–1083) have only the 8 booleans + quiet-hours + timezone. |
| Widened `upsert_notification_preferences` signature present? | **No.** Args (L1413) still shows the 13 params; the 4 new optional params are absent. |
| New resolver RPCs present? | **No.** `notification_recipients_for_item_event` / `notification_item_managers` are not in the file (grep: none). They are **service_role-only / Edge-only** — the app never calls them, so their absence is harmless. |
| Edge-only RPCs need app types? | **No.** The resolver/manager RPCs are used only by Edge (service role); no app type is needed. |
| Can the app compile before regeneration? | **Yes.** Every app usage matches the current stale types (8-enum, 8 columns, 13-arg upsert, fallback-to-`system` for unknown runtime types). The app compiles today. |
| When to regenerate types from live? | **After** migrations `163000` + `164000` are applied to the **live** DB (Dashboard), and **before** 2F-5B adds the new labels/toggles/params. Regeneration then adds the 7 enum values, the 4 columns, the 17-arg upsert, and the claim RPCs (§9). This is a hard ordering dependency (§13). |

**Do not run `supabase gen types`. Do not edit `src/types/supabase.ts`.** (This phase is read-only.)

## 7. Notification center / catalog audit

**How rows render.** `NotificationsCenter` maps each row to `<NotificationRow>` which shows: a
`GlyphChip` from `TYPE_GLYPH[n.type] ?? system`, the row `title` + `body` (server-written inbox detail),
and a meta line = `t(meta.labelKey)` + circle name + timestamp (`notifications-center.tsx:197`). The
type **label text** carries the meaning; the glyph is decorative. **No lock-screen copy is involved** —
this is inbox-only; the remote push stays generic (Edge `genericPushMessage`, unchanged).

**Recommended labels + glyphs for the 7 new types** (Arabic-first, short, calm, no medical
interpretation; glyphs from `src/constants/glyphs.ts`, tones from `GlyphChipTone` = primary/accent/
neutral/success/warning/error/info):

| Type | AR label | EN label | Glyph | Tone |
|---|---|---|---|---|
| `item_assigned` | مُسند إليك | Assigned to you | `Glyph.profile` (✦) | primary |
| `task_overdue` | مهمة متأخرة | Task overdue | `Glyph.clock` (◷) | warning |
| `visit_upcoming` | زيارة قادمة | Upcoming visit | `Glyph.visit` (⌂) | primary |
| `item_claimed` | تم التكفّل | Picked up | `Glyph.members` (❖) | accent |
| `item_completed` | تم الإنجاز | Completed | `Glyph.check` (✓) | success |
| `item_cancelled` | تعذّر الإنجاز | Not completed | `Glyph.cross` (✕) | neutral |
| `claim_digest` | عناصر متاحة | Available to help | `Glyph.diamond` (◈) | accent |

Rationale: `item_cancelled` uses a **calm neutral** tone (not error) — "couldn't be completed" must not
alarm. `task_overdue` uses `clock`+`warning` (past its time), distinct from `task_due`'s `check`+`primary`.
All labels are generic enough for older-adult family use and carry **no** medical wording. Detail (item
name/time) stays in the inbox `title`/`body` written by the producer — the catalog only supplies the short
type label + glyph.

## 8. Deep-link audit

**Route support (all present):**

| Deep link | Route file | Exists |
|---|---|---|
| `/medications` | `src/app/(app)/medications/index.tsx` | ✅ |
| `/tasks/{id}` | `src/app/(app)/tasks/[id].tsx` | ✅ |
| `/appointments/{id}` | `src/app/(app)/appointments/[id].tsx` | ✅ |
| `/visits/{id}` | `src/app/(app)/visits/[id].tsx` | ✅ |
| `/available-to-claim` | `src/app/(app)/available-to-claim.tsx` | ✅ |

Catalog fallback routes (`/tasks`, `/appointments`, `/visits`, `/daily-logs`, `/emergency-card`) all
have index routes too. **No route is missing.**

**Gaps / safety expectations:**
- **RLS-hidden rows after ownership change.** Task/appointment/visit detail rows are Phase-2D-scoped to
  the owner/manager. The Edge send-time currency gate ensures the recipient **is** the current owner (or a
  manager) at delivery, so a freshly delivered deep link opens a readable row. But an **inbox row persists**;
  if the item is later reassigned/claimed away, tapping an old notification could open a detail screen RLS
  now returns empty. 2F-5B should confirm each detail screen shows a graceful "not found / no longer
  available" state rather than an error. (`medications` list is member-readable, so `/medications` is
  always safe.)
- **Manager-awareness types** (`item_claimed`/`item_completed`/`item_cancelled`) go to managers, who have
  `can_view_all_operational`, so their entity deep links are readable.
- **`claim_digest` must link to the feed, not an item.** Its recipients are claim-capable doers who are
  neither owner nor manager and **cannot** read an unassigned item's detail via RLS; and the digest row
  carries **no `itemId`**. So `claim_digest` must deep-link to **`/available-to-claim`** (the
  `list_available_to_claim` RPC-backed feed), never an item detail. Recommend
  `NOTIFICATION_TYPE_META.claim_digest.fallbackRoute = '/available-to-claim'` and that the producer set
  `deep_link` to the same feed.
- **Remote members** are excluded from every operational/assignment/awareness/digest type by SQL
  eligibility, so they never receive these deep links.
- **Suggested fallback routes for new types:** `task_overdue` → `/tasks`; `visit_upcoming` → `/visits`;
  `claim_digest` → `/available-to-claim`; `item_assigned`/`item_claimed`/`item_completed`/`item_cancelled`
  → `null` (entity varies; rely on the producer's explicit `deep_link`, else open the inbox).

## 9. Claim-flow cast cleanup audit (`src/features/claiming/api.ts`)

- **Casts exist because the claim RPCs are missing from generated types.** `callClaimRpc` (`api.ts:13`)
  casts the client to an untyped `.rpc(...)` shape, deliberately localized to this one file, because
  `list_available_to_claim`, `claim_care_task`, `claim_medication_responsibility`,
  `claim_care_appointment`, `claim_family_visit`, and `set_assigned_appointment_outcome` are live in the DB
  but **not** in `src/types/supabase.ts` (confirmed absent). The wrapper also preserves `error.code`
  branching (esp. `23505` already-claimed).
- **Removable only after types are regenerated from live** — once the Phase 2E claim RPCs appear in the
  generated `Functions` map, the cast can be replaced with a normal typed `supabase.rpc(...)`.
- **Belongs in 2F-5B or later?** It is **optional cleanup**, appropriate for 2F-5B **if** types are
  regenerated in that phase (regeneration also picks up the 2E claim RPCs), otherwise defer. Low priority;
  no behavior change. **Do not edit now.**

## 10. Push registration / settings audit

- **New permission flow needed?** **No.** The existing single opt-in flow (`usePushRegistration.enable()`
  → `requestPermission()` → `registerPushToken`) covers all types; new notification types reuse the same
  device permission + token. No per-type OS permission exists.
- **Android channel behavior OK?** **Yes.** A single `'default'` channel at `DEFAULT` importance
  (`push-registration.ts:22/86`) serves all types; the generic remote payload is unchanged. No new channel
  is required. (A future product choice could add a higher-importance channel for `medication_missed`
  escalation, but that is out of scope and would need its own privacy review.)
- **Should settings UI explain the new categories?** Yes — lightly. The push explainer
  (`notificationSettings.push.explainBody`) already lists example categories; 2F-5B may add a brief mention
  of assignment/activity so users understand the new groups, keeping copy calm and non-medical.
- **Delivery disabled until later?** **Yes.** No cron, no delivery; the app changes only prepare the
  surfaces. Enabling delivery is a deliberate 2F-6 step after real-device QA.

## 11. Implementation plan for 2F-5B (file-by-file checklist — do NOT implement now)

Prerequisite: migrations `163000` + `164000` applied to live, **then** regenerate `src/types/supabase.ts`
from live (§13).

1. **`src/features/notifications/api.ts`** — add `assignmentAlerts`, `activityUpdates`,
   `availableToClaimDigest`, `visitReminders` to `NotificationPreferencesInput`; read them in
   `preferencesToInput` (defaults `true/true/false/true`); send the 4 new `p_*` params in
   `upsertPreferences`.
2. **`src/features/notifications/schema.ts`** — extend `BooleanPreferenceKey` + `PREFERENCE_TOGGLES` for
   the newly **exposed** toggles (at minimum `visitReminders`; add `assignmentAlerts`/`activityUpdates`/
   `availableToClaimDigest` only when their producers are live — §14), grouped per §4.
2b. **`src/features/notifications/notification-settings.tsx`** — render the new grouping/headings if the
   toggle set changes.
3. **`src/features/notifications/catalog.ts`** — add `NOTIFICATION_TYPE_META` entries for the 7 new types
   with the fallback routes from §8 (`claim_digest` → `/available-to-claim`).
4. **`notifications-center.tsx`** — add `TYPE_GLYPH` entries (glyph + tone) for the 7 new types (§7).
5. **`src/locales/ar.json` + `src/locales/en.json`** — add `notifications.types.*` labels (7) and any new
   `notificationSettings.toggles.*` (labels + descriptions, §4/§7). Keep both locales in parity.
6. **Deep-link fallback behavior** — confirm detail screens (`tasks/[id]`, `appointments/[id]`,
   `visits/[id]`) degrade gracefully when RLS now hides the row; confirm `claim_digest` routes to the feed.
7. **`src/features/claiming/api.ts`** *(optional)* — remove the `callClaimRpc` cast and use typed
   `supabase.rpc(...)` **only after** regeneration exposes the claim RPCs.
8. **Do not touch** Edge functions or migrations in 2F-5B unless a concrete gap is found.

Type-safety note: steps 1/3/4/5 depend on the regenerated enum/columns/args; attempting them against stale
types produces the TS errors described in §4–§6.

## 12. Validation plan for 2F-5B

- `npm run check:mojibake` — Arabic copy encoding (new labels/toggles).
- `git -c core.autocrlf=false diff --check` — whitespace/CRLF.
- **TypeScript:** no dedicated script in `package.json` (scripts: `lint`, `check:mojibake`).
  `typescript ~6.0.3` is a dev dep, so use **`npx tsc --noEmit`** (Expo tsconfig) to typecheck — this is
  the check that surfaces the stale-types errors if the ordering is wrong.
- **Lint:** `npm run lint` (`expo lint`).
- **Expo/web smoke (optional, manual):** `npm run web` (or `expo start`) to open the settings + center
  screens and eyeball the new toggles/labels/RTL — no build required.
- **No EAS, no prebuild, no Supabase CLI.**

## 13. Rollout dependency reminder

- **App changes alone do not enable delivery.** The settings/catalog/types work only prepares the app
  surfaces; nothing is delivered without the Edge producers + cron + a deliberate enable.
- **Migrations `163000` and `164000` must be applied to the target DB before Edge deploy** — the 2F-4B
  producers call `notification_recipients_for_item_event` / `notification_item_managers`, which exist only
  in those migrations.
- **Edge functions must not deploy before the SQL exists in the target DB** (unknown function / unknown
  enum value at runtime otherwise).
- **Regenerate `src/types/supabase.ts` from live after the SQL is applied** — this unlocks the 2F-5B app
  changes (new enum, columns, widened upsert, claim RPCs) type-safely.
- **Real-device Android push QA comes later** (2F-7): owner-only targeting, manager awareness, remote
  silence, no duplicate pushes.
- **Delivery / cron stays OFF** until a deliberate 2F-6 enable.

Ordering: apply SQL (`163000`→`164000`) → regenerate types → 2F-5B app changes → deploy Edge (2F-4B code)
→ enable cron/stage delivery (2F-6) → device QA (2F-7).

## 14. Risks / open questions

1. **Stale generated types.** Until regeneration, the app cannot type-safely reference the new enum/
   columns/params; doing 2F-5B before regen would force casts. Mitigation: strict ordering (§13).
2. **Toggles before backend fields exist.** If the settings UI exposes toggles for columns that only exist
   after the migration, saving would fail. Mitigation: expose new toggles **only after** the migration is
   applied + types regenerated.
3. **Toggles for types with no producer.** `assignment_alerts`, `activity_updates`,
   `available_to_claim_digest` gate types whose producers are **deferred** (SQL `165000` + digest). A
   visible toggle that changes nothing yet confuses older-adult users. **Recommendation:** in 2F-5B expose
   only `visit_reminders` (live producer); keep the data layer (input/API) complete for all 4 columns, but
   defer the *UI toggles* for assignment/activity/digest until their producers land.
4. **Deep links to RLS-hidden rows.** Post-reassignment taps on old inbox rows may open empty detail
   screens — ensure graceful "no longer available" states (§8).
5. **Claim-digest route choice.** Must link to `/available-to-claim` (feed), never an item detail (no
   `itemId`; RLS can't show an unassigned item to a doer). Confirm in catalog + producer.
6. **Remote-member notification policy.** SQL already excludes remote from all operational/assignment/
   awareness/digest types; the app must not add any client path that resurrects circle-broad targeting.
7. **Manager activity: instant vs digest.** `activity_updates` defaults to **instant** per the SQL design;
   product may prefer a batched manager digest to cut noise. Open decision; affects whether/how the toggle
   is framed.
8. **Expose `available_to_claim_digest` now or hide?** Recommend **hide** the toggle until the digest
   producer exists (keep the column + default `false`), so it is not a dead opt-in switch.
9. **Arabic copy sensitivity.** New labels must stay calm and non-medical (esp. `item_cancelled` =
   "تعذّر الإنجاز", `task_overdue` = "مهمة متأخرة") and Western-digit/LTR-isolate any embedded
   names/times at render (the center already isolates timestamps). Run mojibake after adding copy.
10. **Android push testing later.** Real-device QA (channel behavior, generic lock-screen copy, no
    duplicates, quiet-hours deferral) is deferred to 2F-7; not part of 2F-5B.

## 15. Confirmation

- ✅ **No code changed except this report.**
- ✅ **No SQL run.**
- ✅ **No Supabase CLI** (no `gen types`, no deploy, no db).
- ✅ **No DB connection** — audit was file-read + text-search only.
- ✅ **No Edge deploy.**
- ✅ **No app source changed** — `src/**` untouched.
- ✅ **No migrations changed** — `supabase/migrations/**` untouched.
- ✅ **No generated types changed** — `src/types/supabase.ts` untouched.
- ✅ **No env / secrets touched.**
- ✅ **No commit / no stage.** No cron/delivery enabled. No other project touched (ThinkMate untouched).

## 16. `git` status & diff

Captured read-only at hand-off:

- `git --no-pager status --short`
- `git --no-pager diff --stat`

Expected: one **untracked** file (`??`) — this report — and an empty `diff --stat` (an untracked file
does not appear in a tracked diff). Actual output is shown in the hand-off message.
