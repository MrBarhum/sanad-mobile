# Phase 2F-11C — Android Notification Action-Button Investigation (Read-Only Diagnostic)

**Type:** Read-only local investigation. **No code changes, no staging, no commits, no Supabase actions.**
**Preceded by:** 2F-11B (PARTIAL PASS — Edge Functions deployed, remote Android push arrived with correct Arabic title/body, but action buttons did not render, so snooze/complete were not tested).

---

## Environment

- **cwd:** `E:\Projects\sanad-mobile-clean`
- **Branch:** `master`
- **Status:** clean (verified before report creation — `git status --porcelain` empty)
- **HEAD:** `9c5c927` — `docs(product): record smart push deploy partial QA`

---

## Files read

**Client (notifications feature)**
- `src/features/notifications/push-registration.ts`
- `src/features/notifications/hooks.ts`
- `src/features/notifications/actions.ts`
- `src/features/notifications/catalog.ts`
- `src/features/notifications/device.ts`
- `src/features/notifications/notification-observer.tsx`
- `src/features/notifications/api.ts`
- `src/features/notifications/schema.ts`

**Edge (push payload path)**
- `supabase/functions/process-notification-outbox/index.ts`
- `supabase/functions/_shared/expo.ts`
- `supabase/functions/_shared/notification-content.ts`
- `supabase/functions/_shared/messages.ts`
- `supabase/functions/_shared/enqueue.ts`

**Bootstrap / config**
- `package.json`
- `src/app/_layout.tsx`
- `src/app/(app)/_layout.tsx`
- `app.json`
- `eas.json`

**Project QA docs (pre-existing, referenced)**
- `docs/claude-reports/2026-07-09-phase-2f-11b-smart-actionable-push-deploy-qa.md`
- `docs/claude-reports/2026-07-09-phase-2f-11a-smart-actionable-push-notifications.md`

**External (Expo v56 docs, read-only)**
- `docs.expo.dev/versions/v56.0.0/sdk/notifications`
- `docs.expo.dev/versions/latest/sdk/notifications`
- `docs.expo.dev/push-notifications/sending-notifications`

---

## Files changed

- **Only this file:** `docs/claude-reports/2026-07-11-phase-2f-11c-android-action-buttons-diagnostic.md`

No source, config, Edge, or SQL files were modified. Nothing staged or committed.

---

## Commands run

Read-only only:
- `pwd`, `git rev-parse --abbrev-ref HEAD`, `git status --porcelain`, `git log` (read-only)
- `Glob` (file discovery), `Grep` for `ensureNotificationCategories|setNotificationCategoryAsync`
- `npm run check:mojibake`
- `npx tsc --noEmit`
- Read-only diagnostic sub-agents (Read / Grep / Glob / WebFetch only — no mutating commands)

---

## Checks / results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **PASS** — 267 files scanned, no mojibake signatures (Arabic strings clean) |
| `npx tsc --noEmit` | **PASS** — exit 0, no type errors |
| `git status` (before report creation) | **clean** — HEAD `9c5c927` |

---

## Supabase commands run

**None.** `npx supabase functions list` was allowed "only if needed" and was **not** needed (Edge code was fully inspectable locally).

---

## Deploy / SQL / cron / secrets

**None of any kind.** No deploy, no `functions invoke`, no SQL, no cron change, no secrets read or printed. No push tokens, `SUPABASE_ACCESS_TOKEN`, or `cron.job.command` were accessed or emitted.

---

## Bottom line

The **server / Edge payload path is correct.** Every payload-level explanation is ruled out. The action buttons likely did not render because the referenced **Android notification category was not registered in the device OS store at the moment the push was displayed** — a client / device-side registration problem, not a payload bug. Android attaches category action buttons only if the referenced category already exists in the OS store (written by `setNotificationCategoryAsync`) when the notification is presented.

---

## Correction to the 2F-11B record

The 2F-11B tested push was **`task_due`**, not medication. Evidence: delivered title `حان موعد المهمة`, body `حان موعد مهمة [QA SMART] اختبار إشعار ذكي`, and observation SQL filtering `n.type = 'task_due'`. `task_due` maps to category `sanad_task_reminder` (`notification-content.ts:42-44`), which is registered with the **same two buttons** as medication (`push-registration.ts:195`), so both `تم` and `ذكرني بعد 5 دقائق` were expected and absent. The correction does not change the conclusion.

---

## Cross-reference — everything matches (no mismatch)

| Layer | Value / field | Location |
|---|---|---|
| Client-registered category (task) | `sanad_task_reminder` | `push-registration.ts:154,195` |
| Edge payload field name | **`categoryId`** (top-level — correct Expo remote field; Expo maps it to `categoryIdentifier` on device) | `process-notification-outbox/index.ts:139`; `expo.ts:13-17` |
| Edge payload value (task) | `sanad_task_reminder` | `notification-content.ts:23,42-44` |
| Action ids registered | `complete`, `snooze_5` | `push-registration.ts:162-163,181,186` |
| Action ids the listener handles | `complete`, `snooze_5` | `hooks.ts:397,401` |
| Channel | `default` (registered) = `default` (payload) | `push-registration.ts:22,88` = `index.ts:138` |
| Char restriction (`:` / `-`) | none used (underscores only) | — |

Field name, value, action ids, and channel are all consistent. The category string is additionally duplicated harmlessly at `data.categoryId` (`notification-content.ts:107`; also reused for local snooze reschedule at `hooks.ts:374`).

---

## Ranked root-cause candidates (after adversarial verification)

**#1 — Stale JS bundle, or app not opened / signed-in after the 2F-11A update** · *PLAUSIBLE (medium)*
If the test device (S24 Ultra) ran a JS bundle predating commit `815001f` (2F-11A), or was never foreground-opened while signed in after that update, `ensureNotificationCategories()` never ran → no category in the OS store → plain notification with no buttons. The 2F-11B QA doc predicted exactly this PARTIAL. Rated PLAUSIBLE (not confirmed) because the physical device's on-device state cannot be proven from the repo.

**#2 — `ensureNotificationCategories()` is only invoked from `NotificationObserver` after a signed-in mount** · *CONFIRMED (high)*
Category registration has exactly **one** call site: `hooks.ts:330`, inside a `useEffect(…, [])` hosted by `<NotificationObserver/>`, which mounts only at `src/app/(app)/_layout.tsx:32` — **after** the auth gate `if (!session) return <Redirect href="/sign-in" />` (`(app)/_layout.tsx:27`). It never runs at module load and never while signed out. So any push arriving before the first signed-in foreground mount renders with no buttons. **Scope caveat:** once the observer has mounted once while signed in, categories persist in the native OS store across launches — so this fully explains the *first-run / post-update / signed-out* window, but would not by itself explain a failure that reproduces on an already-opened, signed-in device (that would point back to #1's stale-bundle case).

**#3 — Optimistic `categoriesConfigured` flag / fire-and-forget race** · *REFUTED (high)*
Real code pattern (`push-registration.ts:178` sets the flag before the `await Promise.all` at `:193-199`), but not the cause: no concurrent caller exists, the JS flag does not gate *native* presentation, and the window is sub-second at launch while a manually-timed QA push arrives long after.

**#4 — Silent `catch` on registration failure** · *PLAUSIBLE / speculative (low)*
`push-registration.ts:200-204` swallows errors with no telemetry (a genuine anti-pattern), but there is no evidence `setNotificationCategoryAsync` ever rejected, and `Promise.all` does not un-register siblings. Speculative — no supporting device signal.

---

## Ruled out (all CONFIRMED not-the-cause)

- **Wrong category id** — client `sanad_task_reminder` is byte-identical to the server value.
- **Wrong field name** — Edge correctly uses top-level `categoryId`, not `categoryIdentifier` (`index.ts:139`, `expo.ts:13-17`).
- **Expo Go limitation** — this is a **dev build** (`expo-dev-client`, EAS `development` profile, `google-services.json`); a remote push arriving on Android SDK 56 proves it is not Expo Go.
- **Missing Android channel** — the notification displayed, so channel `default` exists; channel governs delivery/importance, category governs buttons.
- **Invalid id characters** — all ids use underscores only; no `:` or `-`.
- **Server payload bug** — payload field, value, channel, and action ids are all correct and consistent.

**Secondary observation (not the cause):** `expo-notifications` is a bare string in `app.json:44` (no icon/color) — minor Android small-icon "white square" risk, unrelated to action buttons.

---

## Retest plan (no code change needed to retest)

1. Ensure the device runs the **current dev-client JS bundle** (at/after commit `815001f`). If unsure, reload the dev-client bundle (Metro reload) or reinstall the current dev build.
2. **Open the app signed in** so `<NotificationObserver/>` mounts and `ensureNotificationCategories()` runs.
3. **Background the app.**
4. **Create / send a fresh `task_due` QA push.**
5. **Expect buttons:** `تم` and `ذكرني بعد 5 دقائق`.

*Negative control:* send the same push to a device not opened-signed-in since the update → expect no buttons (confirms #1 / #2).

**Build/reload note:** No native rebuild required — category registration is pure JS (`setNotificationCategoryAsync`); no `app.json` / native notification config changed. A JS bundle refresh is required only if the device is on a bundle older than `815001f`. One signed-in foreground open is required so the registration effect runs; after that, categories persist across cold starts.

---

## Optional future hardening (requires code edits — separate pass, not now)

- Move category registration (and the Android channel setup) **earlier than the auth gate** — e.g. at module load or in `src/app/_layout.tsx` — so the OS category store is populated even before sign-in / on first launch. The code comment at `push-registration.ts:170` already states it is safe to call at startup. This closes the real-user exposure window (#2).
- `await` `ensureNotificationCategories()` and set `categoriesConfigured` only on success; **add telemetry / error logging** in the `catch` (`push-registration.ts:200-204`) to remove the silent-failure blind spot (#4).

---

## Recommendation

**Do the device retest first, before any code changes.** The retest (current bundle → signed-in open → background → fresh `task_due` push → check for both buttons) discriminates #1 / #2 (device-side, most likely) from anything deeper. The server / Edge side is already proven correct, so no Edge or payload work is warranted before that result. If buttons still fail on a confirmed-current, signed-in device, escalate to on-device inspection (adb / dev-client logs).
