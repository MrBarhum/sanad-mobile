# Sanad — Milestone 4: "The Pulse" — Implementation Record

**Branch:** `master` · **Working tree:** all changes UNCOMMITTED (per the session rule, nothing staged/committed).
**Validation:** `npx tsc --noEmit` ✅ · `npm run check:mojibake` ✅ (268 files) · `git -c core.autocrlf=false diff --check` ✅ · locale parity **1093/1093** keys, ar == en.
**Scope of this doc:** every A/B item with what changed, the decisions taken, deferrals, and the migration/function files it produced. Backend (migrations + edge functions) is **written, not applied/deployed** — see the runbook.

> Two companion docs: **`2026-07-14-milestone-4-runbook.md`** (the ordered owner steps to apply the backend) and **`2026-07-14-milestone-4-device-qa-checklist.md`** (what must be verified on-device).

---

## Track A — hardening

### A1 — Visibility & roles model
- **Transparent-circle posture**: replaced the implicit "assigned-to-me" hard filter in the tasks list with an explicit **«مهامي / كل المهام»** scope toggle. Collaborators default to "mine", managers to "all", pure followers (remote/elder) see "all" only. `src/features/tasks/figma-tasks.tsx`.
- **Inline «أنا متكفّل» claim** on unassigned open tasks for any claim-capable member (`useClaimTask` added to `src/features/claiming/hooks.ts`); race → `alreadyClaimed` sheet.
- **Assignment consistency (P2-7)**: the create form now uses the shared `MemberSelect` (`src/features/tasks/task-form.tsx`), so create and edit offer the SAME choices (active doer roles), one «no assignee» copy (`assignment.none`), and one «أنا» chip.
- **Role labels**: the roster already shows the specific role + a 3-bucket legend, caregiver/elder hidden from assignable sets — left as-is, verified consistent.
- **Decision**: the toggle (not a hard filter) is the standing visibility rule — recorded in CLAUDE.md.

### A2 — Member display names
- **No migration** — `profiles.full_name`, the `handle_new_user` trigger (copies `full_name` from signup metadata), and self-update RLS already exist.
- Required **full name on sign-up** → passed as `options.data.full_name` (`src/app/(auth)/sign-up.tsx`).
- **Editable name** in Account via a bottom-sheet editor writing `profiles.full_name` (`src/app/(app)/(tabs)/account.tsx`; `src/features/profile/{api,hooks}.ts`).
- **Shared `memberDisplayName()`** (`src/features/circle-members/display-name.ts`): full name → email local-part → neutral fallback, never a bare «عضو» or a raw email inline. Wired into the roster + assignment pickers (and the Care Pulse in B1).

### A3 — Dose-log correction (P2-4)
- A logged dose is now re-tappable via an **«تعديل الحالة»** tray; changing an already-logged status requires an inline confirm. On **Home** (`figma-home.tsx` `DoseRow`) and the **medications** Today list (`figma-medications.tsx` `DoseCard`). `useLogDose` already updated existing logs, so no API change.

### A4 — One-tap confirms + silent failures (P2-6)
- New canonical `confirmAction()` (`src/utils/confirm.ts`; `confirmDiscard` now delegates to it). Confirms added for: **sign-out** (account), **claim** (tasks inline + available-to-claim), **medication deactivate/reactivate**, **schedule deactivate/reactivate**.
- **Error surfacing** added: medication activation toggle, medication delete, schedule actions (`medication-editor.tsx`), daily-log delete (`log-editor.tsx`), vital delete (`vital-editor.tsx`).

### A5 — Medication card readability
- Medication names **wrap to two lines** (never truncate), dosage on its own line — Home dose rows, meds Today cards, meds list cards. Layout only.

### A6 — Password reset (code ships; end-to-end **Needs device QA**)
- Extracted the duplicated auth field into `src/components/auth-field.tsx` (sign-in + sign-up refactored to it).
- **«نسيت كلمة المرور؟»** on sign-in → `/forgot-password` (`resetPasswordForEmail` with a native/web `redirectTo`).
- `/reset-password` at the **root** (outside auth guards, so the recovery session doesn't bounce it): parses the recovery token (implicit fragment OR PKCE `?code=`), `setSession`/`exchangeCodeForSession`, then `updateUser({ password })`. `src/features/auth/password-reset.ts`, `src/app/reset-password.tsx`, `src/app/(auth)/forgot-password.tsx`.
- **Deferred/needs**: the Supabase Auth redirect-URL allow-list must include the reset URLs (runbook), and the full round-trip needs on-device verification.

### A7 — Canonical priority ordering
- Canonical order **meds → tasks → appointments → vitals → visits → daily logs → doctors → members** applied to the Home quick-actions grid (`figma-home.tsx`). Explore was already canonical within its groups (no change, noted).
- **In-list sorting**: tasks = overdue → priority (urgent→low) → chronological (`compareOpenTasks`); doses = unlogged-first stable sort on Home + meds lists (chronological preserved within groups; summaries/next-dose unaffected).

### A8 — i18n & terminology hygiene
- **Notification strings migrated to i18n** (`notifications.actions.*`): action-button titles (`push-registration.ts`), done/snooze Alerts (`hooks.ts`), and `doneMessage` (`actions.ts`) now call `i18n.t(...)`. (The `__DEV__`-only action-button test strings are left; compiled out of release.)
- **Terminology canonicalized**: task open «معلقة»→**«مفتوحة»**; medication/schedule active «نشط»→**«فعّال»**, inactive «موقوف»→**«غير فعّال»**.
- **Deleted 5 orphan keys**: `tasks.assignNone`, `tasks.assignMe`, `tasks.fields.assignToMe`, `appointments.saveAppointment`, `visits.saveVisit` (verified 0 code refs). `visits.fields.linkToMe` was kept (in use).

### A9 — Correctness & cleanup
- **cancelled_by (P3-2)**: `care_tasks` lacked the column → migration `20260715120000_add_cancelled_by_to_care_tasks.sql` adds it + a consistency constraint + extends the collaborator-scope trigger to record an honest `cancelled_by`. Client `cancelTask`/`reopenTask` now write/clear it (localized cast, types not regenerated) and `useCancelTask` passes the user id. **Requires that migration applied before the client build ships** (runbook).
- **Single-primary emergency contacts (P2-12)**: `clearOtherPrimaries()` demotes other primaries on create/update (`emergency/api.ts`, `hooks.ts`).
- **Dead code removed**: `nav-card.tsx`, `hint-row.tsx`, `ui/collapsible.tsx` (0 importers), and the dead `doctors-manager.tsx` wrapper. The live `DoctorFormModal` was extracted to its own file `src/features/doctors/doctor-form-modal.tsx`.
- Verified the DEV action-button test is `__DEV__`-gated.

### A10 — Standing decisions
- Recorded in **CLAUDE.md**: transparent-circle visibility, canonical feature order, canonical terminology, the three sanctioned confirmation patterns, the zero-new-native-deps rule, and the hand-applied-backend rule.

---

## Track B — features

### B1 — Care Pulse feed «نبض اليوم»
- **Migration** `20260715130000_create_list_care_activity.sql`: a read-only, member-gated, paginated RPC UNION-ing dose logs, task completions/cancellations, appointment outcomes, completed visits, vitals, daily logs, and member-joins into one event shape. (Reads `care_tasks.cancelled_by` → apply AFTER the A9 migration.)
- **Client feature** `src/features/pulse/*`: `types.ts`, `api.ts` (localized RPC cast), `hooks.ts` (grow-limit paging), `present.ts` (shared visual/route/description/actor helpers), `figma-pulse.tsx` (feed: icons, resolved actor, bidi time, deep-link tap, loading / generic-error / **RPC-not-enabled** / empty / load-more).
- **Route** `/pulse` (`src/app/(app)/pulse.tsx`); **Home** compact strip (5 recent + «عرض الكل», hidden on error/empty so a not-yet-migrated backend shows nothing); **Explore** entry.

### B2 — Daily family digest (edge function, **not deployed**)
- **Edge function** `supabase/functions/send-daily-summaries/index.ts` (hourly): for each circle whose **local hour == 20**, composes an Arabic one-line day summary and enqueues it (`enqueue_notification` → outbox, dedupe `digest:{circle}:{ymd}`, deep-link `/pulse`) to remote members who opted in.
- **Composer** `supabase/functions/_shared/digest.ts` (`dailySummaryMessage`, `isCalmDay`).
- **Migration** `20260715140000_create_daily_summary_recipients.sql`: adds the `daily_summary` notification type + a `daily_summary_recipients(circle)` resolver gated on `remote_summary`.
- **Decision**: audience is gated **only** by `remote_summary` (via the resolver); the type intentionally falls through the send-time eligibility `else true` branch so an opted-in remote member isn't dropped by an unrelated preference. Digest sends every day (even "calm day") to opted-in members.

### B3 — Missed-dose escalation chain
- The two-tier structure already existed but used global constants. Made the grace **per-circle**: migration `20260715150000_add_missed_dose_grace.sql` adds `care_circles.missed_dose_grace_minutes` (default 30, 5–240) + a manager-only `set_missed_dose_grace_minutes` RPC.
- **Edge function** `check-missed-doses/index.ts` now reads per-circle grace: **tier-2** (responsible) at dose + grace, **tier-3** (managers) at dose + 2×grace. Still revalidates the dose is unlogged before sending and respects `missed_dose_alerts` + quiet hours.
- **Client**: managers-only **grace stepper** on notification-settings (`missed-dose-grace.ts` + `notification-settings.tsx`).
- **Resolves P1-9** once the runbook schedules the (previously unscheduled) `check-missed-doses` cron.

### B4 — WhatsApp invites + share
- **Invite**: a rich Arabic message (circle, inviter, code, join steps, deep link `sanadmobile://join-circle?code=…`) shared via `whatsapp://send?text=` with fallback to the OS share sheet (`shareViaWhatsApp` in `invitations/share.ts`); copy-code kept.
- **Join deep link**: `/join-circle` reads `?code=` and pre-fills (`join-form.tsx`).
- **Share today's summary**: «مشاركة ملخص اليوم» on `/pulse` and the Home Pulse header composes the digest **client-side** from loaded events → OS share (`present.ts` `composePulseShareText`/`sharePulseSummary`).
- **Out of scope (noted)**: universal `https` links — the `sanadmobile://` scheme only opens for people who already have the app; a signed-out tap loses the code at the auth gate.

### B5 — Home bell unread badge
- App-wide unread indicator restored: a count badge on the Home bell driven by the existing `useUnreadCount()` query (`figma-home.tsx`), "9+" cap, count woven into the a11y label. No new keys.

---

## Deferrals / follow-ups
- **A6** password-reset round-trip, **B2/B3** push delivery, and the **B1** RPC all need the backend applied + on-device QA (see the other two docs).
- Client casts (`cancelled_by`, `list_care_activity`, `set_missed_dose_grace_minutes`) are localized because the generated Supabase types are deliberately **not** regenerated this phase; regenerate types in a later pass to remove the casts.
- Edge functions were **not** run through `deno check` here (Deno not installed in this environment); they are validated at `supabase functions deploy`.

## New backend files (apply/deploy via the runbook)
- Migrations: `20260715120000_add_cancelled_by_to_care_tasks.sql`, `20260715130000_create_list_care_activity.sql`, `20260715140000_create_daily_summary_recipients.sql`, `20260715150000_add_missed_dose_grace.sql`.
- Functions: `send-daily-summaries/` (new); `check-missed-doses/` (modified); `_shared/digest.ts` (new); `_shared/enqueue.ts` (type added).
