# Phase 2F-11C — Test A: Local Action-Button Test (Dev-Only)

**Type:** Client-only, dev-only instrumentation. **No Supabase, no SQL, no deploy, no cron, no secrets. Nothing staged or committed.**
**Purpose:** Provide a dev-only local-notification path so the operator can verify whether Android renders the `تم` / `ذكرني بعد 5 دقائق` action buttons for a **locally-built** notification. Per the 2026-07-13 forensics report, a backgrounded **remote** push is an FCM *Notification Message* the OS renders directly (category actions bypassed); a **local** notification is always built by expo-notifications, so its category buttons should render. This test isolates the remote/background path from the category setup.

---

## Environment

- **cwd:** `E:\Projects\sanad-mobile-clean`
- **Branch:** `master`
- **HEAD:** `2a90fa1` — `docs(product): explain android remote action button limitation`

---

## Files changed

| File | Change |
|---|---|
| `src/features/notifications/push-registration.ts` | Added a temporary, dev-only exported helper `scheduleLocalActionButtonTest(seconds = 5)` that schedules a LOCAL notification with `categoryIdentifier: 'sanad_task_reminder'` (via the existing `SANAD_NOTIFICATION_CATEGORY.task` constant), channel `default`, 5s trigger. It first calls `ensureAndroidChannel()` + `ensureNotificationCategories()` so it is self-contained. Existing `scheduleLocalTestNotification` is untouched. |
| `src/features/notifications/notification-settings.tsx` | Added a `__DEV__`-guarded secondary button in the existing "Local test" section (`DEV · اختبار أزرار الإشعار (محلي)`) wired to a new `onActionButtonTest()` handler that calls the helper and reuses the existing `test.scheduled` / `test.failed` feedback strings. The button does not render in production. |

**No new i18n keys, no new dependencies, no native config changes, no production-path changes.** Total: 2 files, +62 / −1.

### Why this placement is safe
- The button lives inside the section already gated by `pushSupport() !== 'web-unsupported'` (native only) **and** an additional `__DEV__` guard — so it appears only on native **dev** builds and is compiled out of production behavior.
- The existing `scheduleLocalTestNotification` (which intentionally omits a category) is unchanged, so the normal "Send test notification" button behaves exactly as before.
- The helper creates **no** server row and notifies **no** other member — it is a pure local device notification.

### Exact notification content scheduled
```
title:            اختبار الأزرار
body:             محلي — يجب أن تظهر أزرار تم / ذكرني
categoryIdentifier: sanad_task_reminder   (actions: complete, snooze_5)
channelId:        default
trigger:          TIME_INTERVAL, 5 seconds
data:             { test: true, actionButtonTest: true }
```

---

## Exact test steps (operator)

1. Run the current dev bundle on the Samsung S24: `npx expo start --dev-client` and open the app **signed in**.
2. Navigate to **Notification settings** (`/notification-settings`).
3. Scroll to the **"اختبار على هذا الجهاز"** (Local test) section. In this dev build a second button appears: **`DEV · اختبار أزرار الإشعار (محلي)`**.
4. Tap it. Feedback shows **"تمت جدولة الإشعار التجريبي."** (scheduled).
5. **Immediately background the app** (Home button) — the notification fires ~5s later.
6. In the notification shade, **expand** the notification (`اختبار الأزرار` / `محلي — يجب أن تظهر أزرار تم / ذكرني`).
7. Observe whether the two action buttons **`تم`** and **`ذكرني بعد 5 دقائق`** render.
8. (Optional) Tap `تم` → app opens and runs the completion handler; tap `ذكرني بعد 5 دقائق` → a local snooze reschedules ~5 min out (both handled by the existing response listener in `hooks.ts`).

---

## Expected result & interpretation

| Outcome | Meaning | Next step |
|---|---|---|
| **Buttons DO render** (expected) | Categories are correct and expo-notifications renders them for a locally-built notification. Confirms the missing-buttons cause is the **remote / backgrounded Notification-Message** path (forensics root cause #1), not the category setup. | Decide the real fix as a separate pass: Option 1 (data-only push + `registerTaskAsync` background task — buttons everywhere, with Samsung delivery-reliability risk) vs Option 2 (accept the documented Android limitation). |
| **Buttons do NOT render** | The problem is deeper than the remote path — category definition or a device/OEM factor also suppresses locally-built buttons. | Escalate to native inspection (adb logcat), re-examine the action/category definition and channel; the remote data-only fix would not help alone. |

Note: because `complete`/`snooze_5` both use `opensAppToForeground: true`, tapping either from this local test should launch/foreground the app cleanly.

---

## Commands run

Client-only, read-only checks + edits:
- `Read` / `Grep` / `Glob` (locate the safe insertion point and existing i18n keys)
- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`
- `npx tsc --noEmit`
- `git --no-pager status --short`, `git --no-pager diff --stat`, `git --no-pager diff`

## Checks / results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **PASS** — 267 files scanned, no strong signatures (new Arabic strings clean) |
| `git -c core.autocrlf=false diff --check` | **PASS** — no whitespace errors |
| `npx tsc --noEmit` | **PASS** — exit 0 |
| `git --no-pager status --short` | 2 modified source files + this untracked report; nothing staged |
| `git --no-pager diff --stat` | 2 files changed, +62 / −1 |

## Supabase commands run

**None.**

## Deploy / SQL / cron / secrets

**None of any kind.** No deploy, no SQL, no cron change, no secrets read or printed. No push tokens or access tokens accessed or emitted.

---

## Cleanup note

This is temporary instrumentation, marked in both files with `TEMPORARY — Phase 2F-11C Test A`. Once the test concludes, remove the `__DEV__` button block in `notification-settings.tsx` (and its `onActionButtonTest` handler + import) and the `scheduleLocalActionButtonTest` helper in `push-registration.ts`.
