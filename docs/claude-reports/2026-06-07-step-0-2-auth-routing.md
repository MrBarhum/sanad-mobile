# Step 0.2 — Auth Routing + Email/Password Screens — Implementation Report

**Date:** 2026-06-07
**Phase:** 0 (UI/Auth foundation)
**Step:** 0.2 — Routing split (`(auth)` / `(app)`) + email/password auth screens
**Status:** Implemented, type-checked, **not committed**
**Baseline:** commit `e72b2c8` (`feat(auth): use secure session storage` — Step 0.1.1, committed; on top of Step 0.1 `9efb4e5`)

---

## Summary

Split the app into a public `(auth)` group and a guarded `(app)` group. Added
email + password **sign-in** and **sign-up** screens (zod-validated, Arabic-first copy via
i18n), a session **route guard** (logged-out → `/sign-in`, logged-in → `/`), and a
temporary **Account** tab exposing **sign-out**. The existing Home/Explore screens were
moved under `(app)` unchanged. Uses the existing `useAuth()` provider throughout.

> **Deviation flag (please review):** the project's Expo Router **typed-routes generation
> is malfunctioning** (details under Risks). To get a clean `tsc` it was necessary to
> disable the `typedRoutes` experiment in `app.json` and delete the stale generated
> `.expo/types/router.d.ts`. This is reversible; see Risks for the alternative.

---

## Files created

| File | Purpose |
|---|---|
| `src/app/(auth)/_layout.tsx` | Auth Stack + guard: redirect to `/` when a session exists. |
| `src/app/(auth)/sign-in.tsx` | Email+password sign-in (zod validation, Arabic copy). |
| `src/app/(auth)/sign-up.tsx` | Email+password sign-up; shows "check your email" when confirmation is required. |
| `src/app/(app)/_layout.tsx` | Guard: redirect to `/sign-in` when no session, else render the tabs. |
| `src/app/(app)/account.tsx` | Temporary Account tab — shows current email + sign-out. |

## Files modified / moved

**Moved** (content byte-identical; originals deleted)

| From | To |
|---|---|
| `src/app/index.tsx` | `src/app/(app)/index.tsx` |
| `src/app/explore.tsx` | `src/app/(app)/explore.tsx` |

**Modified**

| File | Change |
|---|---|
| `src/app/_layout.tsx` | Render `<Stack>` (groups as stack routes) instead of `<AppTabs>` directly. |
| `src/components/app-tabs.tsx` | Native tab bar: added `account` trigger; localized labels via i18n (placeholder icon — see Risks). |
| `src/components/app-tabs.web.tsx` | Web tab bar parity: added `account` trigger; localized labels. |
| `src/locales/ar.json` / `src/locales/en.json` | Added `tabs`, `auth`, `account` keys. |
| `app.json` | `experiments.typedRoutes: true → false` (deviation — see Risks). |

**Deleted (non-source / generated)**

| File | Why |
|---|---|
| `.expo/types/router.d.ts` | Stale, malfunctioning generated types (gitignored). With `typedRoutes` off it is no longer regenerated. |

---

## Commands run

- Inspected `src/app`, the generated `.expo/types/router.d.ts`, the NativeTabs `Icon` API,
  `expo-router` `Href` fallback type, and the themed components.
- Probed the installed zod's email API (`z.string().email` and `z.email` both present in 4.4.3).
- Removed the moved originals and the stale generated types.
- `npx tsc --noEmit`
- `git status --short`
- `git diff --stat`
- Checked for a running Node/Expo dev server (confirmed the route-type file is regenerated
  only on route-file changes, not continuously — so the delete is stable for typechecking).

---

## TypeScript result

```
npx tsc --noEmit  →  exit code 0  (no errors)
```

---

## Functional change

- **Routing:** root layout is now a `<Stack>` over two groups. `(app)` holds the
  authenticated tabs (Home `/`, Explore `/explore`, Account `/account`); `(auth)` holds the
  public Stack (`/sign-in`, `/sign-up`).
- **Guards (uses `useAuth()`):**
  - `(app)/_layout` → `<Redirect href="/sign-in" />` when there is no session.
  - `(auth)/_layout` → `<Redirect href="/" />` when a session exists.
  - Both render `null` while `isLoading` (initial session resolve).
- **Auth screens:** email + password only. Inputs validated with zod (valid email,
  password ≥ 6). On success, `onAuthStateChange` propagates and the guard redirects
  automatically (no manual navigation). Sign-up surfaces a "check your email" notice when
  no session is returned (email-confirmation flow).
- **Sign-out:** Account tab calls `supabase.auth.signOut()`; the `(app)` guard then
  redirects to `/sign-in`.
- **i18n / Arabic-first:** all new copy and tab labels come from the `common` namespace in
  `ar.json` (default) / `en.json` (fallback). No RTL forcing was added (deferred); Arabic
  text renders correctly without it.
- **Out of scope, untouched:** migrations, phone OTP, OAuth, AI, notifications, care-circle
  logic.

---

## How to test manually

1. **Type check:** `npx tsc --noEmit` → exit 0 (done).
2. **Restart the dev server** if one is running (so it picks up `typedRoutes: false`), then
   `npm start` / `npm run ios` / `npm run android`.
3. **Logged-out:** cold start → you should land on **Sign in** (guard redirect from `/`).
4. **Validation:** submit an invalid email or a < 6-char password → localized inline error;
   no network call.
5. **Sign-up:** create an account. If the Supabase project requires email confirmation
   (default), you'll see the "check your email" notice and remain signed out until
   confirmed. (For quick local testing, disable email confirmation in the Supabase
   dashboard, or confirm via the emailed link.)
6. **Sign-in:** with confirmed credentials → redirected into the tabs (Home/Explore/Account).
7. **Persistence (validates Step 0.1.1):** kill and relaunch the app → still signed in.
8. **Sign-out:** Account tab → Sign out → redirected back to Sign in.

---

## Known risks / assumptions

- **`typedRoutes` disabled (primary deviation).** The generated `.expo/types/router.d.ts`
  is malfunctioning for this project: it emits **non-route entries** (`/../types/supabase`,
  `/../i18n/index`, `/../providers/*` — these are `src` files that are not routes) and maps
  the grouped `(app)/index.tsx` to `/index` instead of the canonical `/`, which dropped `/`
  from the `Href` union and broke both the new redirect and the pre-existing
  `app-tabs.web.tsx`. Rather than hack around a broken artifact, I disabled the experiment
  so `Href` falls back to `string | HrefObject`. **Runtime routing is unaffected**
  (the experiment only controls type generation). **Recommendation:** investigate why the
  typed-routes generator scans `src/**` instead of `src/app/**` (looks like a routes-root
  misconfiguration), fix it, then re-enable `typedRoutes`. *Alternative if you'd prefer to
  keep `typedRoutes` now:* restructure to a top-level `index.tsx` redirector with Home at
  `/home` (avoids referencing bare `/`); I can switch to that on request.
- **Email confirmation.** The hosted project most likely requires email confirmation, so
  sign-up will not produce an active session until the email is confirmed; sign-in fails
  until then. Handled gracefully with a notice. Decide whether to disable confirmation for
  dev.
- **Account tab icon is a placeholder** (reuses `home.png`) — there's no dedicated asset
  yet. Labels distinguish the tabs. Marked with a TODO in `app-tabs.tsx`.
- **Brief blank during initial auth resolve.** Guards render `null` while `isLoading`; the
  existing splash overlay covers cold start. Acceptable; can add a dedicated loading view
  later.
- **Web storage.** Per Step 0.1.1, SecureStore is native-only; on web the session uses the
  default browser storage. Web tab bar now has Account parity.
- **No RTL forcing** (deferred to Step 0.3); Arabic copy added.
- Verification was static (`tsc`); the app was not booted this step.
- **Web smoke test (manual):**
  - Reached `/sign-in` successfully.
  - The visible copy appeared in English because browser/device language detection selected
    English; the Arabic-first default behavior should be reviewed in Step 0.3.

---

## Git status summary

```
 M app.json
 M src/app/_layout.tsx
 D src/app/explore.tsx
 D src/app/index.tsx
 M src/components/app-tabs.tsx
 M src/components/app-tabs.web.tsx
 M src/locales/ar.json
 M src/locales/en.json
?? src/app/(app)/
?? src/app/(auth)/
```

`git diff --stat` (tracked files): `app.json (+1/-1)`, `_layout.tsx`, `app-tabs.tsx`,
`app-tabs.web.tsx`, `ar.json`, `en.json` modified; `index.tsx` / `explore.tsx` deleted
(moved). New untracked groups `src/app/(app)/` and `src/app/(auth)/`. `.expo/` is gitignored
so the deleted route-types file does not appear. Adding this report introduces
`docs/claude-reports/2026-06-07-step-0-2-auth-routing.md`. **Nothing committed.**

---

## Recommended next step

**Step 0.3 — Arabic-first polish + RTL**: enable RTL safely, localize the moved Home/Explore
shells, and add accessibility-minded primitives (type scale, ≥44px touch targets,
high-contrast tokens) for older adults.

Two follow-ups to schedule independently:
1. **Fix typed-routes generation** (routes-root misconfiguration) and re-enable `typedRoutes`.
2. **Decide the email-confirmation policy** for development so the sign-in flow is testable end-to-end.
