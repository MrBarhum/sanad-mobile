# Phase 2F-11C — Android Action-Button Forensics (Native / Payload Pass)

**Type:** Read-only forensic investigation. **No code edits, no staging, no commits. No Supabase mutations. No deploy / SQL / cron / secrets. No raw push tokens, `SUPABASE_ACCESS_TOKEN`, or `cron.job.command` accessed or printed.**
**Preceded by:** 2F-11C read-only diagnostic (server/payload ruled out) → 2F-11C client hardening (registration moved before the auth gate + dev readback) → this pass, triggered because buttons are STILL absent even with categories proven-registered.

---

## Environment

- **cwd:** `E:\Projects\sanad-mobile-clean`
- **Branch:** `master`
- **HEAD:** `c6beb7a` — `fix(notifications): register action categories at startup`
- **Working tree:** clean (this pass makes no source changes)

---

## Observed retest evidence (the trigger)

On the current dev bundle (`npx expo start --dev-client --clear`), Android bundle loaded:

1. Dev log **proved category registration** at the JS layer:
   `[sanad][notifications] registered categories (5): [...]` including **`sanad_task_reminder[complete,snooze_5]`**.
2. A fresh **`task_due`** push then arrived while the app was **backgrounded** on a **Samsung Galaxy S24 (One UI)**:
   - **title:** `حان موعد المهمة`
   - **body:** `حان موعد مهمة [QA ACTION] اختبار أزرار الإشعار2`
3. The notification was **expanded** in the shade — **action buttons still did NOT render** (`تم` / `ذكرني بعد 5 دقائق` absent).

**Discriminator signature:** correct detailed title/body render, but action buttons are absent, **specifically while backgrounded**, with categories provably registered in the same session. This signature is the key to the diagnosis below.

---

## Root cause (CONFIRMED — documented + Expo-maintainer-quoted)

**The outbound push is an FCM _Notification Message_, and Android renders Notification Messages itself when the app is backgrounded/terminated — bypassing the expo-notifications code path that attaches the registered category's action buttons.**

Mechanism, step by step:

1. The Edge sender builds the Expo message with **top-level `title`, `body`, AND `channelId`** (`process-notification-outbox/index.ts:134-143`).
2. Per Expo's own delivery model, *"When you use the Expo Push Service, and specify `title`, `subtitle`, `body`, `icon`, or `channelId`, the resulting push notification request is a **Notification Message**."* — <https://docs.expo.dev/push-notifications/what-you-need-to-know/>
3. Expo's delivery-behavior table for a Notification Message:
   - App **Foreground** → `NotificationReceivedListener` and JS task (expo-notifications builds the notification → category actions applied).
   - App **Background** → **"OS shows notification."**
   - App **Terminated** → **"OS shows notification."**
4. When "OS shows notification," the Android system renders title/body straight from the FCM `notification` block. expo-notifications' notification-builder (the code that reads the registered `sanad_task_reminder` category from its native store and adds the `complete`/`snooze_5` buttons to the `NotificationCompat.Builder`) **never runs** — so **no action buttons**. Foreground would show them; backgrounded does not. This matches the observed signature exactly.

**Expo maintainer confirmation** — expo/expo#31503, *"[expo-notifications] category dont gets displayed when app is killed / in background"* (@vonovak, Oct 30 – Nov 1 2024), quotes verified verbatim via the GitHub API:

> **"Definitely do not send title and etc in the top-level notification object, because that will result in [a] notification message that won't contain action buttons (as defined by `categoryId`)."**

> "You can send a **data-only** notification which will display the buttons if you specify a `categoryId` in the `data` field ... However, when the app is killed and people press those action buttons without launching the app, you will never learn about that user action."

The Sanad payload sends top-level `title`/`body`/`channelId` (with `categoryId` top-level and duplicated in `data`) — **exactly the anti-pattern the maintainer warns against.** This is a structural expo-notifications Android behavior, not a Sanad payload bug, and it post-dates the older "actions not presented at all" fix (expo-notifications 0.28.18/0.29.x), so it applies to Sanad's `expo-notifications ~56.0.18`.

---

## Answers to the eight investigation items

1. **Outbound payload shape** (`process-notification-outbox/index.ts:134-143`, sent by `_shared/expo.ts` via `JSON.stringify` to `https://exp.host/--/api/v2/push/send`):
   ```
   { to, title, body, channelId: 'default', categoryId: <push.categoryId>,
     sound: 'default', priority: 'default'|'high', data: {...} }
   ```
2. **`categoryId` is TOP-LEVEL** (`index.ts:139`) — **and** additionally duplicated inside `data.categoryId` (`notification-content.ts:107`). Correct placement per Expo docs; not the failure.
3. **The `task_due` record → categoryId:** `categoryId` is **not stored** on the notification row — it is derived deterministically at send time from `type` by `pushCategoryId()` (`notification-content.ts:37-55`): `task_due`/`task_overdue` → `sanad_task_reminder`. The delivered title `حان موعد المهمة` (from `taskDueMessage`, `_shared/messages.ts:24`) proves `type='task_due'`, so top-level `categoryId='sanad_task_reminder'` is **guaranteed by code** for this push. A read-only SELECT to independently confirm the record is prepared for the operator below (not run).
4. **Does `categoryId` map for Android in SDK 56?** Yes — documented for **"Android and iOS"** (<https://docs.expo.dev/push-notifications/sending-notifications/>). But the mapping only produces buttons when expo-notifications builds the notification (foreground / local); it is **bypassed for backgrounded Notification Messages** (root cause).
5. **Android-specific action options:** None missing. `isAuthenticationRequired` / `isDestructive` are **iOS-only**; `opensAppToForeground: true` is set and appropriate. No Android action option is required for a button to render — the button title alone suffices. The gap is not in the action definitions.
6. **Samsung / channel suppression:** **Ruled out.** Channel `default` importance = `AndroidImportance.DEFAULT` governs heads-up peek/sound only, **not** the actions row on an expanded notification (verified against Android channel docs). Samsung One UI is a **red herring** — the foreground-works/background-fails signature reproduces across many devices; no One UI-specific button-stripping bug exists.
7. **Remote notification rendered by a system-created object where the category is ignored:** **YES — this is the root cause** (see above). The OS-rendered Notification Message carries no expo category actions when backgrounded.
8. **Would a LOCAL notification with the same category show buttons?** **Expected YES** — a local notification is always built by expo-notifications (it sets `content.categoryIdentifier` and constructs the `NotificationCompat.Builder`), so the registered category actions attach in all app states. This is the single most decisive next test (Test A). Note: the existing `scheduleLocalTestNotification` (`push-registration.ts:129-140`) does **NOT** set `categoryIdentifier`, so today's in-app "test" button would never show buttons; `scheduleSnoozeNotification` (`push-registration.ts:295`) **does** set it. **Not scheduled — see the test plan below.**

---

## Ranked root-cause candidates (after the new evidence)

| # | Candidate | Verdict |
|---|---|---|
| **1** | **Backgrounded remote push is a Notification Message → OS renders it → expo category actions bypassed → no buttons** | **CONFIRMED (high).** Verbatim Expo docs delivery table + maintainer quote (#31503) + exact symptom match. |
| 2 | Category not registered at presentation time | **ELIMINATED.** Dev readback proved `sanad_task_reminder[complete,snooze_5]` registered this session. |
| 3 | Wrong payload field name / `categoryId` placement | **ELIMINATED.** `categoryId` top-level is documented-valid Android+iOS; also duplicated in `data`. |
| 4 | Channel importance (`DEFAULT`) hides buttons | **ELIMINATED.** Importance governs heads-up only; buttons render on expand regardless. |
| 5 | `POST_NOTIFICATIONS` not granted | **ELIMINATED.** Binary permission; title/body rendered ⇒ granted; no per-element granularity. |
| 6 | `app.json` bare-string `expo-notifications` plugin (no icon/color) | **ELIMINATED.** Plugin options touch only small-icon/tint/sound/channel-default resources, never the action row. |
| 7 | Missing/incorrect Android action options | **ELIMINATED.** `isDestructive`/`isAuthenticationRequired` are iOS-only; `opensAppToForeground` set; nothing required is missing. |
| 8 | Samsung One UI quirk | **ELIMINATED.** Not device-specific; reproduces broadly. |

**Alternative-mechanism note (does not change the conclusion):** one adversarial verifier stressed that on Android expo-notifications emulates categories in its own native store (ROOM/SharedPreferences, PR #2557) and *can* attach actions from its native FCM service. That is true **in the foreground / for data-only messages**; for a backgrounded **Notification Message** the OS shows the notification and that native builder is not invoked. Both framings converge on the same documented limitation (#31503) and the same decisive local test.

---

## Files read

**Edge / payload path**
- `supabase/functions/process-notification-outbox/index.ts`
- `supabase/functions/_shared/expo.ts`
- `supabase/functions/_shared/notification-content.ts`
- `supabase/functions/_shared/messages.ts`

**Client (notifications feature)**
- `src/features/notifications/push-registration.ts`
- `src/features/notifications/hooks.ts`
- `src/features/notifications/notification-observer.tsx`
- `src/features/notifications/notification-settings.tsx`
- `src/app/_layout.tsx`, `src/app/(app)/_layout.tsx`, `src/providers/index.tsx`

**Config / prior reports**
- `app.json`, `package.json`, `scripts/check-mojibake.js`
- `docs/claude-reports/2026-07-11-phase-2f-11c-android-action-buttons-diagnostic.md`
- `docs/claude-reports/2026-07-11-phase-2f-11c-action-buttons-client-hardening.md`

**External (read-only, Expo v56 + GitHub)**
- <https://docs.expo.dev/push-notifications/what-you-need-to-know/> (delivery-behavior table — decisive)
- <https://docs.expo.dev/push-notifications/sending-notifications/> (`categoryId` = Android and iOS)
- <https://docs.expo.dev/versions/v56.0.0/sdk/notifications/> (categories, action options)
- <https://github.com/expo/expo/issues/31503> (maintainer @vonovak — root cause + fix); corroborating: #36282, #31710, PR #2557, PR #32531, PR #35295

---

## Commands run

Read-only only:
- `git log`, `git rev-parse`, `git status`, `git diff` (read-only)
- `Read` / `Grep` / `Glob` (file discovery)
- `WebFetch` / `WebSearch` (Expo v56 docs + expo/expo issues) via read-only forensic sub-agents
- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`
- `npx tsc --noEmit`
- `git --no-pager status --short`, `git --no-pager diff --stat`

## Supabase commands run

**None.** No Supabase CLI invocation, no `functions invoke`, no query executed. A SELECT-only diagnostic is **prepared for operator review** (below) but was **not run**.

## Deploy / SQL / cron / secrets

**None of any kind.** No deploy, no SQL executed, no cron change, no secrets read or printed. No raw push tokens, `SUPABASE_ACCESS_TOKEN`, or `cron.job.command` accessed or emitted.

## Checks / results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **PASS** — 267 files scanned, no strong signatures |
| `git -c core.autocrlf=false diff --check` | **PASS** — no whitespace errors |
| `npx tsc --noEmit` | **PASS** — exit 0 |
| `git --no-pager status --short` | only this new untracked report; nothing staged |
| `git --no-pager diff --stat` | no tracked changes (read-only pass) |

---

## Exact next recommended tests (in priority order)

### A) LOCAL notification action-button test — DECISIVE (run first)

**Purpose:** discriminate "remote/Notification-Message/background path" (root cause #1) from "category/device problem." A local notification is built by expo-notifications, so a registered category's buttons must attach.

**Shape (do NOT run until approved):** schedule a local notification whose content sets `categoryIdentifier: 'sanad_task_reminder'` (the current `scheduleLocalTestNotification` omits it, so a dev-only variant/flag is needed):
```ts
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'اختبار الأزرار',
    body: 'محلي — يجب أن تظهر أزرار تم / ذكرني',
    categoryIdentifier: 'sanad_task_reminder',
    data: { test: true },
  },
  trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: 'default' },
});
```
Then **background the app** and expand the notification.
- **Buttons appear** → confirms root cause #1 (remote background path is the culprit; category setup is fine). Proceed to decide on a fix.
- **Buttons absent** → deeper category/device issue; escalate to native inspection (Test C) before any payload work.

### B) Remote payload inspection (SELECT-only — prepared for operator)

The payload is deterministic from code, but to independently confirm the stored record for the latest `[QA ACTION]` push (no tokens/secrets selected):
```sql
-- Operator to run (read-only). Confirms type → category derivation; no PII/tokens.
select id, type, title, left(body, 80) as body_preview, (data ? 'categoryId') as data_has_categoryid, created_at
from public.notifications
where type = 'task_due' and body like '%[QA ACTION]%'
order by created_at desc
limit 5;
```
Expected: `type='task_due'` ⇒ send-time `categoryId='sanad_task_reminder'` (top-level). Confirms item #3.

### C) dev-client / native log inspection (adb)

While the app is **backgrounded**, capture logs and send a fresh `task_due` push:
```
adb logcat -v time | grep -iE "expo.*notification|FirebaseMessaging|onMessageReceived|categoryId"
```
Expected under root cause #1: expo-notifications' `onMessageReceived` does **not** fire while backgrounded (the OS renders the notification message), confirming the JS/native builder is bypassed. If it *does* fire yet buttons are absent, re-open the category-attach path.

---

## Proposed code change (do NOT implement yet — for a separate scoped pass)

Two directions; both are cross-cutting and warrant their own QA pass. **No change made now.**

**Option 1 — Data-only push + background notification task (the maintainer's canonical fix).**
- *Edge:* stop sending top-level `title`/`body`/`channelId`; send a **data-only** message carrying title/body/categoryId/channel inside `data` (touches `process-notification-outbox/index.ts` + `_shared/expo.ts` + `_shared/notification-content.ts`).
- *Client:* register a background notification task (`Notifications.registerTaskAsync` + `expo-task-manager`, per PR #32531/#35295) that presents the notification locally with `categoryIdentifier`, so buttons render in **all** app states.
- **Trade-offs / risk:** data-only FCM messages are subject to Doze / Samsung OEM battery restrictions when the app is killed, so **delivery reliability can drop** — a serious concern for a care-coordination app whose reminders must arrive. Requires a new dependency (`expo-task-manager`) and likely a native rebuild. This is a substantial change, not a one-liner.

**Option 2 — Accept the documented Android limitation (lowest risk).**
Keep the current Notification Message: reliable delivery + correct detailed title/body + deep-link-on-tap. Action buttons appear only when foreground; users still act by tapping into the app (the existing `complete`/`snooze` in-app flows already work). This matches Expo's documented behavior and preserves delivery guarantees.

**Recommendation:** run **Test A** to confirm, then choose between Option 1 (buttons everywhere, at a delivery-reliability cost that must be QA'd on Samsung) and Option 2 (reliable delivery, foreground-only buttons). Decide in a dedicated implementation pass — **not in this forensic pass.**

---

## Bottom line

Category registration is correct and proven at the JS layer. The missing buttons are **not** a Sanad payload or registration bug — they are the **documented expo-notifications Android behavior** for backgrounded **Notification Messages** (top-level `title`/`body`/`channelId`), where the OS renders the notification and the expo category actions are never attached (expo/expo#31503, maintainer-confirmed). The decisive confirmation is a **local notification with `categoryIdentifier` set** (Test A); a real fix (data-only + background task) is a separate, reliability-sensitive pass, deliberately not implemented here.
