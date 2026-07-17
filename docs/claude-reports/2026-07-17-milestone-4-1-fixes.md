# Sanad — Milestone 4.1: QA fixes (Pulse polish, password reset, contrast) + follow-ups

**Branch:** `milestone-4.1-fixes` (off `master`) · one conventional commit per item.
**Validation quartet — green after every commit and at the end:**
`npx tsc --noEmit` ✅ · `npm run check:mojibake` ✅ (270 files) ·
`git -c core.autocrlf=false diff --check` ✅ · locale parity **1087/1087**, ar == en.

Standing rules honored: zero new native deps (F1 reuses the already-installed
`expo-secure-store`); no `.env`/secrets, no Supabase CLI/SQL/deploy/cron run from
here; **no new migrations** (every fix is client-side except the D4 dashboard note
and the F3 comment); all user-facing strings via i18next in both locales at key
parity; house a11y/RTL rules preserved; existing confirm/no-optimistic patterns kept.

Companion doc: **`2026-07-17-milestone-4-1-runbook-addendum.md`** (D4 dashboard steps).

---

## D1 — Home Pulse strip stayed stale after a mutation
**Root cause.** The activity-producing mutations invalidated only their own feature
queries; the pulse query (`list_care_activity`) was never invalidated, so the Home
«نبض اليوم» strip and the log only refreshed on remount.
**Fix.** Each activity-producing mutation now also invalidates `pulseKeys.all`, and
both pulse surfaces refetch on focus (`useFocusEffect`, matching the
available-to-claim convention).
- `src/features/medications/hooks.ts:224` — `useLogDose` (dose log/correct).
- `src/features/tasks/hooks.ts:32` — new `invalidateWithPulse` used by
  `useCompleteTask` / `useCancelTask` / `useReopenTask`.
- `src/features/appointments/hooks.ts:33` — `invalidateWithPulse` used by
  `useSetAppointmentStatus` + `useSetAppointmentOutcome`.
- `src/features/visits/hooks.ts:82` — `useSetVisitStatus` (visit complete).
- `src/features/vitals/hooks.ts:64` — `useCreateVital` (vital add).
- `src/features/daily-logs/hooks.ts:64` — `useCreateDailyLog` (daily log add).
- **member join** already refreshes pulse: `useAcceptInvitation` calls
  `queryClient.invalidateQueries()` (all keys) — verified, left unchanged.
- Focus refetch: `src/features/pulse/figma-pulse.tsx:56` and the Home
  `PulseSection` `src/features/care-circle/figma-home.tsx:770`.

## D2 — Pulse scope + naming (product decision, implemented as specified)
**Root cause.** `list_care_activity` returns full history; the full view was
mislabeled «نبض اليوم».
**Fix.**
- **Home «نبض اليوم» is now scoped to TODAY** in the **circle's local day**. New
  `Intl`-based helpers `ymdInTimeZone` / `todayYmdInTimeZone`
  (`src/utils/date.ts:119`,`:141`) with a device-local fallback; the Home
  `PulseSection` filters the fetched events to the circle-local today
  (`src/features/care-circle/figma-home.tsx:779`). Because the RPC returns newest
  first and today's events are always the most recent, filtering the fetched page
  yields today's most-recent events (5-item cap + «عرض الكل» kept). No events today
  → the existing quiet/empty state (renders nothing).
- **Full `/pulse` page renamed «سجل النشاط»** via `pulse.title` (shared by the
  in-screen `FigmaHeader` and the Explore entry — both updated at once). The Home
  section keeps `pulse.sectionTitle` = «نبض اليوم». The `/pulse` route is now
  registered `headerShown:false` (`src/app/(app)/_layout.tsx:57`) so the in-screen
  header is the sole title — it otherwise fell through to a native "pulse" title
  (latent double-header). Internal route path stays `/pulse`.
- **No migration** — today-scoping is client-side.

**D2 naming decision (recorded):** `pulse.title` → «سجل النشاط» / "Activity Log"
(the full paginated log). `pulse.sectionTitle` → «نبض اليوم» / "Today's pulse" (the
today-scoped Home strip). `pulse.viewAll` («عرض الكل») and `pulse.subtitle` kept.

## D3 — Gender-neutral, named event headlines (+ WhatsApp share)
**Root cause.** Headlines were conjugated verbs that depended on the actor's gender
and used «أنا» / a bare «عضو» («أنا أكمل مهمة»).
**Fix (`src/features/pulse/present.ts`).**
- `pulseDescription` (`:77`) rewritten to `«{actor} · {masdar phrase}»` — a
  gender-neutral verbal noun with the resolved name first. Dose status shifts the
  noun (تسجيل / تأجيل جرعة, جرعة فائتة); appointment branches completed/cancelled
  (نتيجة / إلغاء موعد); vital type localized via the shared `vitals.type.*` labels;
  visit → «زيارة عائلية»; log → «إضافة سجل يومي»; member → «انضمام إلى الدائرة».
  Field mapping verified against the RPC (`20260715130000_create_list_care_activity.sql`:
  dose `title`=med name & `status`=given/postponed/missed; vital `title`=reading_type).
- `usePulseActorLabel` (`:126`) resolves EVERY actor (incl. the current user) by
  real name via the roster + shared `memberDisplayName()` — never «أنا»; a
  since-removed actor falls back to their stored name, else «عضو سابق» — never a
  bare «عضو».
- `composePulseShareText` (`:150`) takes a `timezone` and scopes "today" to the
  circle's local day, reusing the corrected masdar+name headlines — so the WhatsApp
  «مشاركة ملخص اليوم» text is named, gender-neutral, and matches the Home scope.
  Threaded from `(app)/pulse.tsx` and the Home strip.
- i18n: replaced `pulse.events.doseLogged` with `doseGiven`/`dosePostponed`/
  `doseMissed`; reworded the rest; `vitalRecorded` now takes `{{vital}}`. ar+en at
  parity. No RPC change.

## D4 — Password-reset link opened `http://localhost:3000`
**Root cause.** `http://localhost:3000` is Supabase's default **Site URL**, used as
the fallback when the `redirect_to` isn't in the Auth Redirect-URLs allow-list. The
app built the native `redirectTo` with `Linking.createURL('/reset-password')`, which
resolves to a dev-client-flavoured URL during on-device QA — not allow-listed, so
Supabase fell back to the Site URL.
**Fix.** `passwordResetRedirectTo()` now returns the exact literal
`sanadmobile://reset-password` on native (`src/features/auth/password-reset.ts:12`
`RESET_PASSWORD_DEEP_LINK`); web keeps the origin-relative path. The scheme is
registered in `app.json` (`sanadmobile`) and `/reset-password` is a root route
outside the auth guard. **Dashboard steps (Redirect URLs + native-first Site URL)
are in the runbook addendum — not applied from here.**

## D5 — «أنا متكفّل» claim control near-invisible in dark mode
**Root cause.** The inline claim affordance on the tasks list was an outlined/tinted
pill that read as near-invisible on the dark surface.
**Fix.** Give it the same filled-teal primary treatment other primary inline actions
use (e.g. the Home dose "log" button): full-opacity `c.primary` fill with
`c.onPrimary` icon+label (`src/features/tasks/figma-tasks.tsx`, the `showClaim`
Pressable + `claimBtn` style). Contrast/visibility fix only — nothing else restyled.
The available-to-claim CTA already uses a filled primary `FigmaButton` (verified —
unchanged).

---

## Standing follow-ups

### F1 — Preserve the join code across the auth gate ✅
**Root cause.** `sanadmobile://join-circle?code=…` tapped while signed out hit the
(app) session guard → redirect to `/sign-in`, dropping `?code`.
**Fix.** New headless `PendingJoinLink` (`src/features/invitations/pending-join-link.tsx:27`)
mounted above the guard in `src/app/_layout.tsx:82`. It captures the code from the
incoming link (cold start via `getInitialURL`, warm app via `Linking.useURL`),
stashes it in-memory + `SecureStore` (the store the app already uses;
`src/features/invitations/pending-join.ts`), and once a session exists replays it
into `/join-circle` with the code pre-filled, clearing the stash so it's consumed
once. Covered: cold-start-via-link (signed out → sign in → prefilled), warm-app tap
(idempotent replay to the same route), force-quit-then-sign-in (restored from
SecureStore), and normal no-link launch (no stash → no redirect, no stale leak).
`joinCodeFromUrl` ignores non-join links (e.g. the reset deep link).

### F2 — Regenerated Supabase types ⏭️ SKIPPED (precondition not met)
The working tree is clean and `src/types/supabase.ts` does **not** contain
`list_care_activity` / `set_missed_dose_grace_minutes` (grep = 0), i.e. types were
**not** regenerated. Per the task's conditional, the M4 localized casts
(`cancelled_by`, `list_care_activity`, `set_missed_dose_grace_minutes`) are left in
place. Re-run this item after the owner regenerates types.

### F3 — Digest hour as a named constant ✅
`send-daily-summaries` already used a named `DIGEST_HOUR = 20`; expanded its comment
to flag it as the placeholder for a future per-circle setting (a `care_circles`
column + manager control, parallel to `missed_dose_grace_minutes`) so it doesn't
read as a frozen magic number. Behaviour unchanged (still circle-local 20:00); no
UI/column this round; **no redeploy required for correctness.**

---

## Device-QA line updates (behaviour changed this pass)
Additive to `2026-07-14-milestone-4-device-qa-checklist.md`:

- **D2 — Pulse today-scope & rename.** Home «نبض اليوم» shows only **today's**
  events (circle-local); a day with no activity shows nothing on Home. «عرض الكل»
  opens the full log now titled **«سجل النشاط»** (single header, no native "pulse"
  bar); the Explore → Care-circle entry reads **«سجل النشاط»**.
- **D1 — In-place refresh.** Log a dose / complete-cancel-reopen a task / record an
  appointment outcome / complete a visit / add a vital or daily log, then confirm
  the Home strip and «سجل النشاط» update **without** leaving and re-entering.
- **D3 — Headlines & share.** Every row reads «{اسم العضو} · {اسم فعل}» with the
  actor's real name (yours included — never «أنا», never a bare «عضو»); a removed
  member shows their name or «عضو سابق». «مشاركة ملخص اليوم» shares **today's** named
  summary. Verify no gendered verb and no mojibake.
- **D4 — Password reset.** The recovery email link opens the app at
  `/reset-password` (test cold start + app open) — it must **not** open
  `http://localhost:3000` (needs the runbook-addendum dashboard steps applied).
- **D5 — Claim contrast.** The inline **«أنا متكفّل»** on an unassigned open task is
  a clearly-visible filled teal pill in dark mode.
- **F1 — Join code.** Signed out, tap a WhatsApp invite link → sign in / sign up →
  you land on Join-circle with the code pre-filled; cold-start and warm-app both
  work; a normal launch never pre-fills a stale code.

## Adversarial review pass (multi-agent) + follow-up fixes
The diff was run through an adversarial multi-agent review (parallel reviewers per
dimension → independent refute-first verification). It refuted the F1
race/SecureStore concerns (F1 verified sound) and found no i18n-parity or auth
issues, but **confirmed three real Pulse defects**, all fixed in a follow-up commit:
1. **[medium] Visit events lost the visitor's name** — the RPC ties a visit to
   `visitor_user_id` (null for an account-less external relative) and carries the
   name in `title`; the reworded «{actor} · زيارة عائلية» rendered anonymous
   «أحد الأعضاء» for them. `present.ts` now prefers the stored visitor name when
   there's no linked account (linked visitors keep their roster name).
2. **[low] Home strip time was device-local while the day was circle-local** — a
   diaspora caregiver could see a row under «نبض اليوم» with a clock from a
   different local day. Added `hmInTimeZone` (`src/utils/date.ts`) and render both
   the Home strip and the `/pulse` log times in the circle frame.
3. **[low] A future-dated event could push a real today event out of the 5-row
   fetch** — the Home strip now fetches a 20-event buffer, filters to today, caps
   at 5 (no migration; the full log is unaffected and shows dates).

## Notes / deliberate departures
- D3 keeps the completed/cancelled distinction for appointments (نتيجة موعد vs إلغاء
  موعد) rather than the single form in the brief — more informative and still nominal
  / gender-neutral.
- D2/D3 introduce the app's first **client-side** circle-timezone date math
  (`Intl.DateTimeFormat` with `timeZone`, supported by Expo SDK 56 Hermes) with a
  device-local fallback, so a runtime without IANA-zone support degrades to the
  app's existing device-local assumption rather than crashing.
