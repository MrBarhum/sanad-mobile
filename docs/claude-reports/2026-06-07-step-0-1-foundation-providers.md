# Step 0.1 — Foundation Providers — Implementation Report

**Date:** 2026-06-07
**Phase:** 0 (UI/Auth foundation)
**Step:** 0.1 — Foundation providers only (no auth screens, no route split)
**Status:** Implemented, type-checked, **not committed**

---

## Summary

Wired the app-wide foundation substrate without changing the visible UI or routes.
Added TanStack Query, an Auth session provider (`getSession()` + `onAuthStateChange()`),
i18next initialization (Arabic default / English fallback), and `SafeAreaProvider`.
Also fixed a pre-existing syntax bug in the existing `lib/supabase.ts` that prevented
the project from compiling, and hardened its environment-variable handling.

Scope intentionally excluded: auth screens, route splitting (`(auth)`/`(app)`),
migration changes, secrets, and any RTL native-reload behavior.

---

## Files created

| File | Purpose |
|---|---|
| `src/providers/index.tsx` | `AppProviders` composer (SafeArea → Query → Auth); initializes i18n via a side-effect import; re-exports `useAuth`. |
| `src/providers/query-provider.tsx` | `QueryProvider` wrapping a single app-lifetime `QueryClient`. |
| `src/providers/auth-provider.tsx` | `AuthProvider` (`getSession()` + `onAuthStateChange()`, `AppState`-driven token auto-refresh) and the `useAuth()` hook. |
| `src/i18n/index.ts` | i18next initialization — Arabic default, English fallback, device-language detection via `expo-localization`. |
| `src/locales/ar.json` | Starter Arabic strings (`common` namespace). |
| `src/locales/en.json` | Starter English strings (fallback). |

## Files modified

| File | Change |
|---|---|
| `lib/supabase.ts` | **Fixed a syntax bug** — a literal `\n` had collapsed the `Database` import onto line 3, which broke compilation. Split the imports; env vars now **throw a clear error** when missing instead of constructing a client with empty credentials. Storage backend left unchanged (`expo-sqlite` `localStorage`). |
| `src/app/_layout.tsx` | Wrapped the tree in `<AppProviders>`; renamed `TabLayout` → `RootLayout`. Visible UI and routes unchanged. |

> No app code beyond the two files above was modified for this step. The current
> report file under `docs/claude-reports/` is documentation only.

---

## Commands run

- Consulted the **Expo SDK v56 docs** (per `AGENTS.md`) for `expo-localization`
  (`getLocales()` is synchronous) and `expo-sqlite` (`localStorage` is a synchronous,
  Web-Storage-compatible, persistent store; `expo-sqlite/localStorage/install` is a
  valid v56 subpath export).
- Verified installed package versions and confirmed the literal-`\n` defect in
  `lib/supabase.ts`.
- `npx tsc --noEmit`
  - **Baseline (before changes):** 4 errors, all from the `\n` defect in `lib/supabase.ts`.
  - **After changes:** 0 errors.
- `git status --short` / `git diff --stat`.

> **Lint not run.** The repo has no ESLint config, and `expo lint` would trigger an
> interactive first-time setup (risk of hanging in a non-interactive shell). Flagged
> rather than guessing at configuration.

---

## TypeScript result

```
npx tsc --noEmit  →  exit code 0  (no errors)
```

Baseline before this step failed with 4 errors, all originating from the
`lib/supabase.ts` literal-`\n` syntax defect:

```
lib/supabase.ts(3,54): error TS1127: Invalid character.
lib/supabase.ts(3,55): error TS1435: Unknown keyword or identifier. Did you mean 'import'?
lib/supabase.ts(3,68): error TS2457: Type alias name cannot be 'type'.
lib/supabase.ts(3,81): error TS1434: Unexpected keyword or identifier.
```

These are resolved.

---

## Git status summary

Code changes introduced by Step 0.1:

```
 M lib/supabase.ts
 M src/app/_layout.tsx
?? src/i18n/
?? src/locales/
?? src/providers/
```

- 2 files modified, 6 new source files.
- **Nothing committed.**
- Adding this report introduces one further untracked path: `docs/claude-reports/`.

---

## Functional changes

- The app now mounts three foundation providers above the existing tabs:
  - **SafeAreaProvider** (with `initialWindowMetrics`) — the existing screens already
    use `SafeAreaView` / `useSafeAreaInsets`, which now have a proper provider ancestor.
  - **TanStack Query** — single shared `QueryClient` (`retry: 2`, `staleTime: 30s`).
  - **Auth** — `useAuth()` exposes `{ session, user, isLoading }`, hydrated from the
    persisted session and kept live via `onAuthStateChange`; token auto-refresh is tied
    to app foreground state via `AppState`.
- **i18next** is initialized app-wide (Arabic default, English fallback). No screen text
  was translated and no RTL forcing was introduced — the visible UI is unchanged.
- `lib/supabase.ts` now compiles, and misconfiguration (missing env) fails fast with a
  clear message.

---

## How to test

1. `npm start` (or `npm run android` / `npm run ios`) → the app boots to the **same
   Home/Explore tabs** as before, with no errors in the Metro console.
2. **Auth wiring:** temporarily add `const { session, isLoading } = useAuth();` to
   `src/app/index.tsx` and log it — expect `isLoading: true` then `false`, with
   `session: null` (no user yet).
3. **i18n:** add `const { t } = useTranslation();` and render `t('appName')` → shows the
   Arabic app name; switch the device language to English → shows the English name.
4. **Query:** confirm there is no "No QueryClient set" error when a `useQuery` is used.
5. **Negative path:** blank out an `EXPO_PUBLIC_SUPABASE_*` value in `.env` → the app
   should fail fast with the explicit missing-env error.

---

## Risks and assumptions

- **Session storage is not encrypted at rest.** The existing `expo-sqlite` `localStorage`
  backend was kept per the "keep and improve `lib/supabase.ts`" instruction. For a
  health/caregiving app, auth tokens are sensitive; `expo-secure-store`
  (Keychain/Keystore, already installed) is the stronger option. No migration cost today
  (no users). Left as an explicit decision rather than swapped unilaterally.
- **Behavior change:** missing Supabase env now **throws at startup** instead of warning.
  Intentional, to prevent a silently broken client; can revert to a soft warning if
  preferred.
- **Language detection:** the device language is used only if it is `ar` or `en`,
  otherwise Arabic; English is the key-level fallback. Easily adjusted.
- `lib/supabase.ts` imports `Database` via the relative path `../src/types/supabase`
  (unchanged). A `@lib/*` path alias could tidy cross-folder imports later, but that is a
  config change omitted to stay minimal.
- Assumed `expo/tsconfig.base` enables `resolveJsonModule` — confirmed indirectly by the
  clean `tsc` run (JSON locale imports type-check).
- Verification was static (`tsc`). A runtime smoke test (booting Metro) is recommended
  before relying on the wiring.

---

## Recommended next step

**Step 0.2 — routing split + auth screens** (`(auth)` / `(app)` route groups,
sign-in / sign-up, a session route guard, and sign-out), using **email + password**.

Two small decisions to confirm before starting 0.2:

1. **Token storage:** keep `expo-sqlite` `localStorage`, or switch to encrypted
   `expo-secure-store` for the session? (Recommendation: switch, given health data.)
2. Confirm **email + password** as the Phase 0 auth method.
