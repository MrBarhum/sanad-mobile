# Phase 2F-11C — Test A: Local Action-Button Test (Dev-Only)

**Type:** Client-only, dev-only instrumentation. **No Supabase, no SQL, no deploy, no cron, no secrets. Nothing staged or committed.**
**Purpose:** Provide a dev-only local-notification path so the operator can verify whether Android renders the `تم` / `ذكرني بعد 5 دقائق` action buttons for a **locally-built** notification. Per the 2026-07-13 forensics report, a backgrounded **remote** push is an FCM *Notification Message* the OS renders directly (category actions bypassed); a **local** notification is always built by expo-notifications, so its category buttons should render. This test isolates the remote/background path from the category setup.

---

## Observed result — Local Test A: **PASS** ✅

Operator ran the dev-only test on the Samsung Galaxy S24:

- The local notification appeared — **title:** `اختبار الأزرار`, **body:** `محلي — يجب أن تظهر أزرار تم / ذكرني`.
- **Both action buttons rendered.** Screenshot evidence: the expanded notification showed the two actions.
  - as rendered: **left:** `تم`  ·  **right:** `ذكرني بعد 5 دقائق`
- **Confirms category/action registration works** — expo-notifications applies the `sanad_task_reminder` category (`complete` / `snooze_5`) to a locally-built notification exactly as designed.
- **Confirms the remote root cause** — since the identical category renders buttons locally, the reason **remote** backgrounded pushes show no buttons is the FCM **Notification Message / OS-rendered** path (the OS displays the push without invoking expo-notifications' category builder), **not** the category setup. This closes out the forensics conclusion (2026-07-13 forensics report, root cause #1).

### UX issue found + fixed this pass — RTL action order

The buttons rendered in the wrong order for Arabic: `تم` was on the **left** and `ذكرني بعد 5 دقائق` on the **right**. Android lays action buttons out left→right in **registration order**, and the entity categories were registered `[complete, snooze]`. This pass swaps the registration order to `[snooze, complete]` so the natural Arabic reading order is produced:

- desired (now): **right:** `تم`  ·  **left:** `ذكرني بعد 5 دقائق`

Action **ids** (`complete`, `snooze_5`) and **labels** (`تم`, `ذكرني بعد 5 دقائق`) are unchanged, and response handling keys off the action id (order-independent) — so only the rendered button position changes. The generic (snooze-only) category is unchanged.

---

## Environment

- **cwd:** `E:\Projects\sanad-mobile-clean`
- **Branch:** `master`
- **HEAD:** `d78e44d` — `test(notifications): add dev local action button check`

---

## Files changed

| File | Change |
|---|---|
| `src/features/notifications/push-registration.ts` | **(1)** In `ensureNotificationCategories`, swapped the entity-category action order from `[complete, snooze]` to `[snooze, complete]` so Android renders `تم` on the RIGHT and `ذكرني بعد 5 دقائق` on the LEFT (correct RTL order). Ids/labels/response handling unchanged; generic (snooze-only) category unchanged. **(2)** (prior step) Added the temporary, dev-only exported helper `scheduleLocalActionButtonTest(seconds = 5)` that schedules a LOCAL notification with `categoryIdentifier: 'sanad_task_reminder'` (via `SANAD_NOTIFICATION_CATEGORY.task`), channel `default`, 5s trigger, self-contained via `ensureAndroidChannel()` + `ensureNotificationCategories()`. Existing `scheduleLocalTestNotification` untouched. |
| `src/features/notifications/notification-settings.tsx` | (prior step) Added a `__DEV__`-guarded secondary button in the existing "Local test" section (`DEV · اختبار أزرار الإشعار (محلي)`) wired to a new `onActionButtonTest()` handler that calls the helper and reuses the existing `test.scheduled` / `test.failed` feedback strings. The button does not render in production. |

**No new i18n keys, no new dependencies, no native config changes.** The RTL order swap is the only change that affects a real (non-`__DEV__`) code path; it alters button position only.

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
| `git --no-pager status --short` | this pass: `M push-registration.ts` (RTL order swap) + `M` this report; nothing staged. (The prior-step Test A instrumentation — the helper + `__DEV__` button — was committed at HEAD `d78e44d`.) |
| `git --no-pager diff --stat` | this pass: 2 files changed, +29 / −4 (push-registration.ts +6/−1; report doc +23/−3) |

## Supabase commands run

**None.**

## Deploy / SQL / cron / secrets

**None of any kind.** No deploy, no SQL, no cron change, no secrets read or printed. No push tokens or access tokens accessed or emitted.

---

## Cleanup note

**Decision (2026-07-14): retained as a QA-only regression tool.** Per the 2F-11C closeout (Option A for MVP), the instrumentation is kept — not removed — and its markers were renamed from `TEMPORARY — Phase 2F-11C Test A` to **`QA-only — local notification action-button check`** in both `notification-settings.tsx` (the `__DEV__` button + `onActionButtonTest` handler) and `push-registration.ts` (the `scheduleLocalActionButtonTest` helper). It stays `__DEV__`-gated and native-only, so it is production-safe (compiled out of release builds) and creates no server rows. It exists to re-verify notification categories/actions in future notification work. The **MVP accepts the Android backgrounded-remote action-button limitation to preserve reminder delivery reliability** (see the 2F-11C closeout + 2F-11D decision brief).
