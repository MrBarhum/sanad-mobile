# Phase 2F-11C — Android Action-Button Client Hardening (Implementation Pass)

**Type:** Client-side code change. **No Supabase actions, no SQL, no deploy, no cron, no secrets. Nothing staged or committed.**
**Preceded by:** 2F-11C read-only diagnostic (`docs/claude-reports/2026-07-11-phase-2f-11c-android-action-buttons-diagnostic.md`), which ruled out the server / Edge payload path and pointed at client-side category registration + observability.

---

## Environment

- **cwd:** `E:\Projects\sanad-mobile-clean`
- **Branch:** `master`
- **HEAD at start:** `dca577b` — `docs(product): diagnose android notification action buttons`
- **Working tree at start:** clean

---

## Retest evidence (the trigger for this pass)

Device retest on **Android / Samsung S24**:

1. App opened **signed-in** on the current laptop dev bundle.
2. App **backgrounded**.
3. A **fresh `task_due` push arrived** with the correct, detailed Arabic text:
   - **title:** `حان موعد المهمة`
   - **body:** `حان موعد مهمة [QA ACTION] اختبار أزرار الإشعار`
4. The notification was **expanded**, but the **action buttons did NOT render** (`تم` / `ذكرني بعد 5 دقائق` absent).

**Interpretation.** Detailed title/body arriving proves the delivery + payload path is healthy (consistent with the 2F-11C diagnostic, which had already ruled out the server/Edge payload). The remaining gap is that the referenced Android action **category was not present in the OS category store at the moment the push was presented**, or its registration silently failed. Because the app was already signed-in, this is now treated as a **client-side category-registration robustness + observability** problem, exactly the hardening the diagnostic flagged as "optional future work."

---

## Root cause (now treated as client-side)

Before this pass, category/channel registration had these weaknesses:

1. **Registration ran only after the auth gate.** `ensureNotificationCategories()` had a single call site — inside `<NotificationObserver/>` (`hooks.ts`), which mounts only in `src/app/(app)/_layout.tsx` **after** `if (!session) return <Redirect href="/sign-in" />`. Any push arriving before the first signed-in foreground mount (first launch, post-update, signed-out window) hit an unpopulated OS category store → no buttons. (Diagnostic candidate #2, CONFIRMED.)
2. **Optimistic "done" flag.** `categoriesConfigured` was set to `true` **before** the `await Promise.all(...)`, so a registration that never completed (or partially failed) could still be recorded as "configured," and a concurrent caller would early-return while registration was still pending. (Diagnostic candidate #3.)
3. **Silent failure.** The `catch {}` swallowed errors with **no telemetry**, so a real `setNotificationCategoryAsync` failure would be invisible — no way to tell registration from a device-side failure on retest. (Diagnostic candidate #4.)

The Edge payload was **not** changed — the prior diagnostic proved field name (`categoryId`), value (`sanad_task_reminder`), channel (`default`), and action ids (`complete`, `snooze_5`) all match. No concrete server mismatch was found, so per scope, the server side is untouched.

---

## Files changed

| File | Change |
|---|---|
| `src/features/notifications/push-registration.ts` | Rewrote `ensureNotificationCategories` with an in-flight-promise guard + success-gated flag + awaited registration + dev-safe failure logging; added `logRegisteredCategories()` (dev diagnostic) and `bootstrapNotifications()` (single idempotent startup entry point). |
| `src/app/_layout.tsx` | Added a root-layout `useEffect` that calls `bootstrapNotifications()` **before the auth gate**, so channel + categories are registered at the earliest bootstrap point. Never prompts. |
| `src/features/notifications/hooks.ts` | Routed the signed-in `<NotificationObserver/>` one-time effect through the same `bootstrapNotifications()` (defense-in-depth backstop); removed the now-unused `configureForegroundHandler` / `ensureNotificationCategories` imports (kept `ensureAndroidChannel`, still used by `enable()`). |

No Edge, config, native, or SQL files were touched.

---

## Exact explanation of the fix

### 1. Register earlier than the signed-in gate (`src/app/_layout.tsx`)

`RootLayout` now runs `void bootstrapNotifications()` in an empty-deps `useEffect`, placed **before** the `if (!fontsLoaded && !fontsError) return null;` font gate (so hook order is stable / rules-of-hooks safe). `RootLayout` sits **above** `AppProviders` and the auth gate, so the OS channel + category store is populated at first launch — even before sign-in — closing the pre-auth exposure window. `bootstrapNotifications()` touches no React context, so running it above the providers is safe.

### 2. Robust, observable `ensureNotificationCategories` (`push-registration.ts`)

- **In-flight guard:** a module-level `categoriesInFlight: Promise<void> | null` coalesces concurrent/repeated startup calls (root layout + observer) onto **one** registration. The outer `async` function assigns `categoriesInFlight` synchronously before returning it, so overlapping callers share the same promise — no duplicate `setNotificationCategoryAsync` batches, no flag race.
- **Success-gated flag:** `categoriesConfigured = true` is set **only after** `await Promise.all([...])` resolves. A failed/partial batch leaves it `false`, and `categoriesInFlight` is reset to `null` in `finally`, so the **next** startup call retries.
- **Awaited registration:** all five `setNotificationCategoryAsync` calls are awaited (via `Promise.all`) before anything is marked done.
- **Dev-safe failure logging:** on failure, a clear, secret-free `console.warn` (`[sanad][notifications] action-category registration failed; buttons may not render`) fires under `__DEV__` only. No tokens/PII — categories carry only static button ids/titles.

### 3. Dev diagnostic (`logRegisteredCategories`)

After a successful registration (and only under `__DEV__`), the app reads the categories back via `Notifications.getNotificationCategoriesAsync()` and logs `id[action,action]` per category, e.g.:

```
[sanad][notifications] registered categories (5): [
  'sanad_appointment_reminder[complete,snooze_5]',
  'sanad_generic_reminder[snooze_5]',
  'sanad_medication_reminder[complete,snooze_5]',
  'sanad_task_reminder[complete,snooze_5]',
  'sanad_visit_reminder[complete,snooze_5]'
]
```

This makes the next retest self-diagnosing: if this line prints `sanad_task_reminder[complete,snooze_5]` yet the S24 still shows no buttons, the problem is provably below the JS layer (native/device), not registration. Logs only non-secret category/action ids.

### 4. Preserved ids (unchanged, verbatim)

- **Categories:** `sanad_task_reminder`, `sanad_medication_reminder`, `sanad_visit_reminder`, `sanad_appointment_reminder`, `sanad_generic_reminder`
- **Actions:** `complete`, `snooze_5` (generic carries `snooze_5` only)
- **Button titles:** `تم`, `ذكرني بعد 5 دقائق` (byte-identical to before)

### 5. Edge payload — unchanged

No mismatch was found; per scope the server side was not modified.

---

## Commands run

Client-side, read-only / check commands only:

- `git log -1`, `git rev-parse --abbrev-ref HEAD` (read-only)
- `Read` / `Grep` / `Glob` for file discovery
- `WebFetch` of the Expo **v56** notifications docs (verify `setNotificationCategoryAsync` / `getNotificationCategoriesAsync` signatures + `NotificationCategory` shape)
- `npm run check:mojibake`
- `git -c core.autocrlf=false diff --check`
- `npx tsc --noEmit`
- `git --no-pager status --short`
- `git --no-pager diff --stat` / `git --no-pager diff`
- One background review workflow of the diff (Read/analysis sub-agents only — no mutating commands)

---

## Checks / results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **PASS** — 267 files scanned, no strong mojibake signatures |
| `git -c core.autocrlf=false diff --check` | **PASS** — no whitespace errors (no output) |
| `npx tsc --noEmit` | **PASS** — exit 0, no type errors |
| `git --no-pager status --short` | 3 modified source files + this untracked report; nothing staged |
| `git --no-pager diff --stat` | `_layout.tsx +11`, `hooks.ts +6/-9`, `push-registration.ts +73/-12` (3 files, +91 / -20) |

```
 M src/app/_layout.tsx
 M src/features/notifications/hooks.ts
 M src/features/notifications/push-registration.ts
?? docs/claude-reports/2026-07-11-phase-2f-11c-action-buttons-client-hardening.md
```

---

## Adversarial review of the diff

A 4-dimension review workflow was run over the diff, each finding independently verified with a refute-first pass:

| Dimension | Focus | Result |
|---|---|---|
| Concurrency | In-flight-promise guard / `categoriesConfigured` state machine — races, lost retry, stuck-forever | **No findings** |
| Hooks lifecycle | Root `useEffect` before the font gate (rules-of-hooks), running above providers/auth | **No findings** |
| Behavior parity | DRY refactor to `bootstrapNotifications()` — dropped calls, unused imports, ordering | **No findings** |
| Secrets / safety | `__DEV__` gating, token/PII leakage in logs, unsupported-platform crash | **No findings** |

**0 confirmed, 0 uncertain** findings across all four dimensions.

---

## Supabase commands run

**None.**

---

## Deploy / SQL / cron / secrets

**None of any kind.** No deploy, no `functions invoke`, no SQL, no cron change, no secrets read or printed. No push tokens or access tokens accessed or emitted. All new logging is `__DEV__`-gated and prints only static category/action ids.

---

## Recommended retest steps

1. Ensure the S24 runs the **current JS bundle** (at/after these changes). Reload the dev-client bundle (Metro reload) or reinstall the current dev build.
2. **Cold-start the app** and watch the Metro / dev-client console for:
   `[sanad][notifications] registered categories (5): [...]`
   Confirm `sanad_task_reminder[complete,snooze_5]` is present. (This now runs **before** sign-in — you should see it even on the sign-in screen.)
3. Sign in, then **background** the app.
4. **Send a fresh `task_due` QA push.**
5. **Expand** the notification. **Expect buttons:** `تم` and `ذكرني بعد 5 دقائق`.
6. Tap each: `تم` → completion + "تم" alert; `ذكرني بعد 5 دقائق` → local reschedule + "سيصلك تذكير بعد 5 دقائق".

**If step 2 prints all 5 categories but step 5 still shows no buttons:** registration is proven-good at the JS layer, so escalate to native/device inspection (adb logcat / dev-client native logs, Android notification-channel settings, small-icon config) — the failure is below JS, not in this code.

**Negative-control note:** because registration now runs at the root before the auth gate, the previous "signed-out device shows no buttons" control no longer applies — that window is closed by design.
