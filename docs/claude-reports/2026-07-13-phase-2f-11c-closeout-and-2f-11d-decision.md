# Phase 2F-11C Closeout + 2F-11D Decision Brief

**Type:** Report only — decision brief. **No code edits. No Supabase, no SQL, no deploy, no cron, no secrets. Nothing staged or committed.**
**Scope of the investigation it closes:** why Android does not render the `تم` / `ذكرني بعد 5 دقائق` action buttons on a **backgrounded remote push**, and what to do about it.

> **PRODUCT DECISION (2026-07-14) — Option A for MVP.** The **MVP accepts the Android backgrounded-remote action-button limitation to preserve reminder delivery reliability.** Sanad keeps the reliable remote **Notification Message** path (detailed text + tap-to-open + working in-app complete/snooze); it does **not** implement the data-only / background-task approach now. The dev-only local action-button test is **retained as a QA-only** regression tool. Lock-screen action buttons remain a possible future **2F-11D prototype**, pursued only behind a QA flag with a Samsung reliability gate.

---

## Environment

- **cwd:** `E:\Projects\sanad-mobile-clean`
- **Branch:** `master`
- **HEAD:** `9c1d12c` — `fix(notifications): align android action order for Arabic`
- **Working tree:** clean (this pass makes no source changes)

**Prior passes in this chain**
- `2026-07-11-phase-2f-11c-android-action-buttons-diagnostic.md` — server/payload ruled out.
- `2026-07-11-phase-2f-11c-action-buttons-client-hardening.md` — registration moved before the auth gate + dev readback.
- `2026-07-13-phase-2f-11c-android-action-buttons-forensics.md` — root cause: backgrounded remote push is an FCM *Notification Message*.
- `2026-07-13-phase-2f-11c-local-action-button-test.md` — Test A: local buttons render; RTL order fixed.

---

## 1. Final 2F-11C status

| Item | Status | Evidence |
|---|---|---|
| **Category registration** | ✅ WORKS | Dev readback logged `sanad_task_reminder[complete,snooze_5]` (+4 others). |
| **Action ids** | ✅ WORKS | `complete` / `snooze_5` handled by the response listener (`hooks.ts`). |
| **Local notification buttons** | ✅ **PASS** | Test A on Samsung S24: local notification with `categoryIdentifier: 'sanad_task_reminder'` rendered **both** buttons. |
| **RTL action order** | ✅ **PASS** | Registration order swapped to `[snooze, complete]` → **right: `تم`**, **left: `ذكرني بعد 5 دقائق`** (committed `9c1d12c`). |
| **Remote *backgrounded* push buttons** | ❌ **NOT SUPPORTED** with the current Notification-Message approach | Backgrounded remote `task_due` push renders correct title/body but no buttons; the OS renders the notification and never applies the category. |

**Diagnosis, settled:** the missing remote buttons are **not** a Sanad category/registration/id/label bug — all of those are proven-correct by Test A. They are the documented behavior of a backgrounded FCM **Notification Message** on Android (see §2), confirmed by an Expo maintainer (expo/expo#31503) and by the forensics report.

**Current production-safe behavior (unchanged, reliable):**
- Remote reminders deliver the **detailed Arabic title/body** (e.g. `حان موعد المهمة` / `حان موعد مهمة …`).
- **Tap-to-open** deep-links into the relevant screen; the in-app **complete / snooze** flows already work there.
- Action **buttons** render reliably for **local** notifications (e.g. the snooze reschedule) and are expected for **foreground** remote pushes (expo builds those). The only gap is action buttons on **backgrounded/terminated remote** pushes.

---

## 2. Why many apps can do this (and why Expo's path differs on Android background)

Android delivers two FCM message shapes, and they behave differently when the app is **not foregrounded**:

- **Data-only message** → always routed to the app's `FirebaseMessagingService.onMessageReceived` (even backgrounded/killed*). The app builds the notification itself with `NotificationCompat.Builder` + `addAction(...)`, so **action buttons render in every state**. Apps with a **native / direct FCM** integration (or a data-only push + a background task) take this path — that is how they show lock-screen action buttons reliably.
- **Notification message** (carries `title` / `body` / `icon` / `channelId` at the top level) → when the app is backgrounded/terminated, the **Android OS renders it directly** from the FCM payload. The app's (and expo-notifications') notification-builder never runs, so a registered category's action buttons are **not attached**.

**Sanad's path:** the Edge sender sets top-level `title`, `body`, and `channelId`, so per Expo's own delivery model the push is a **Notification Message**. Expo's docs delivery table states plainly: Notification Message + app Background/Terminated → *"OS shows notification."* That is exactly why the correct text appears but the buttons do not — while a **local** notification (Test A), always built by expo-notifications, does show them.

> Expo maintainer @vonovak, expo/expo#31503: *"Definitely do not send title and etc in the top-level notification object, because that will result in [a] notification message that won't contain action buttons (as defined by `categoryId`). You can send a **data-only** notification which will display the buttons if you specify a `categoryId` in the `data` field … However, when the app is killed and people press those action buttons without launching the app, you will never learn about that user action."*

\* *Data-only delivery when the app is **killed** is still subject to Android Doze / OEM battery policies — see §4.*

---

## 3. Options

**Option A — Accept the limitation; keep the reliable Notification Message.**
Ship the current behavior: detailed remote text + tap-to-open + in-app actions; action buttons on local/foreground only. Zero delivery-reliability risk. No new code, no native rebuild.

**Option B — Prototype data-only push + background notification task, behind a QA-only feature flag.**
Change the Edge payload to **data-only** (move title/body/categoryId/channel into `data`, drop the top-level notification fields) and add a client **background notification task** (`Notifications.registerTaskAsync` + `expo-task-manager`) that presents the notification locally with `categoryIdentifier` — so buttons render in all states. Gate it to QA devices only until reliability is proven on Samsung.

**Option C — Long-term native / direct FCM path.**
Own the `FirebaseMessagingService` (custom native module or a bare workflow) and build notifications natively with `addAction`. Maximum control and reliability for buttons, but the largest engineering + maintenance cost and the biggest departure from the managed Expo push pipeline.

---

## 4. Risks of Option B (data-only + background task)

1. **Delivery reliability under Android Doze / OEM restrictions.** Data-only messages are **not** guaranteed to wake a Dozing or battery-restricted app. Samsung One UI is among the most aggressive OEMs; a data-only reminder can be **delayed or dropped** when the device is idle or the app was swiped away — a direct hit to the core promise of a care/reminder app.
2. **App killed / background behavior.** Presenting a data-only notification requires the JS/native background task to actually run. On a killed app with OEM restrictions, the task may not fire → **no notification at all** (worse than "notification without buttons"). basti4557 in #31503 hit exactly this before adding `registerTaskAsync`.
3. **Duplicate notifications.** Mixing data + presentation logic, plus Expo's at-least-once send + any local mirror, can produce **double notifications** if not carefully de-duplicated (the outbox is already at-least-once by design).
4. **Changed receipt / delivery semantics.** Today an Expo **"ok" receipt** correlates closely with the OS showing the notification. With data-only, "delivered to FCM/app" no longer implies "displayed" — the display now depends on the background task, so **delivery telemetry weakens** and success is harder to confirm.
5. **More QA, specifically on Samsung.** Requires a test matrix across app states (foreground / background / killed), Doze on/off, battery-optimization on/off, and One UI versions — a meaningful QA investment before it could be trusted for reminders.

---

## 5. Recommendation

**For a care/reminder product, delivery reliability outranks lock-screen button convenience.** Do **not** replace the reliable Notification Message path immediately.

- **Recommended for MVP:** **Option A** — accept the limitation. Keep detailed remote text + tap-to-open + in-app complete/snooze (all working). Action buttons remain available on local + foreground notifications.
- **If lock-screen buttons are later validated as a real user need:** open **2F-11D as a scoped, time-boxed prototype only** (Option B) behind a **QA-only feature flag**, with an explicit **reliability gate**: it graduates to production **only if** a Samsung test matrix shows data-only delivery (foreground/background/killed, Doze on) is as reliable as the current Notification Message. If it isn't, keep Option A. Defer Option C unless C-level control is required.

### Suggested 2F-11D scope (prototype only — not this pass)
- **Edge:** add a data-only payload variant in `process-notification-outbox` + `_shared/expo.ts` + `_shared/notification-content.ts`, selected by a QA flag (never default).
- **Client:** register a background notification task (`registerTaskAsync` + `expo-task-manager`) that presents locally with `categoryIdentifier`; de-dupe against any remote path.
- **Flag:** QA-device allowlist / env flag; production continues on the Notification Message path.
- **Test matrix:** Samsung S24 × {foreground, background, killed} × {Doze on/off, battery-opt on/off}; measure **display rate** and **latency**, compare to Notification Message baseline.
- **Exit criteria:** documented reliability parity, or revert to Option A.

---

## 6. Cleanup — the dev-only local action test (DECIDED: keep as QA-only)

The Test A instrumentation (`scheduleLocalActionButtonTest` in `push-registration.ts` + the `__DEV__`-guarded button in `notification-settings.tsx`, committed at `d78e44d`) was originally marked `TEMPORARY — Phase 2F-11C Test A`.

- It is **`__DEV__`-gated and native-only**, so it is **production-safe** (compiled out of release builds) and creates no server rows.
- **Decision (2026-07-14): KEEP it as a QA-only regression tool.** The `TEMPORARY — Phase 2F-11C Test A` markers were renamed to **`QA-only — local notification action-button check`** in both files. It is a cheap, reusable check for notification categories/actions (useful again in any future notification work, including a possible 2F-11D prototype).

---

## 7. Commands run / checks

Report-only pass — read-only:

| Check | Result |
|---|---|
| `npm run check:mojibake` | **PASS** — 267 files scanned, no strong signatures |
| `git -c core.autocrlf=false diff --check` | **PASS** — no whitespace errors |
| `npx tsc --noEmit` | **PASS** — exit 0 |
| `git --no-pager status --short` | only this new untracked report; nothing staged |
| `git --no-pager diff --stat` | no tracked source changes (report-only pass) |

**Supabase commands:** none. **Deploy / SQL / cron / secrets:** none of any kind. No push tokens or access tokens accessed or printed.

---

## Bottom line

2F-11C is **closed**: category/action setup and RTL order are correct and proven (local Test A PASS); the remaining "no buttons on backgrounded remote push" is a **documented Android/Expo Notification-Message limitation**, not a Sanad bug. The reliable remote path stays. Lock-screen action buttons are a **2F-11D prototype decision** — pursue only behind a QA flag with a reliability gate, and never at the cost of reminder delivery on Samsung.
