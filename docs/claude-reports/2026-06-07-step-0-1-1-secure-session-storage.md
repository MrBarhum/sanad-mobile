# Step 0.1.1 — Encrypted Session Storage (expo-secure-store) — Implementation Report

**Date:** 2026-06-07
**Phase:** 0 (UI/Auth foundation)
**Step:** 0.1.1 — Switch Supabase auth session persistence from `expo-sqlite` localStorage to encrypted `expo-secure-store`
**Status:** Implemented, type-checked, **not committed**
**Baseline:** commit `9efb4e5 feat(app): add foundation providers` (Step 0.1)

---

## Summary

Replaced the Supabase auth session store. Previously the session was persisted via
`expo-sqlite`'s synchronous `localStorage` polyfill (not encrypted at rest). It now uses
`expo-secure-store`, which stores values in the iOS Keychain / Android Keystore (encrypted
at rest) — the appropriate choice for sensitive health/caregiving auth tokens.

Because SecureStore can reject values larger than ~2048 bytes (and Supabase session
payloads routinely exceed that), the change includes a **byte-bounded chunked storage
adapter** that transparently splits/reassembles values. All changes are contained to the
single existing file `lib/supabase.ts`, per scope.

No auth screens, no route changes, no migration changes, no visible UI change.

---

## Files modified / created

**Modified**

| File | Change |
|---|---|
| `lib/supabase.ts` | Removed `import 'expo-sqlite/localStorage/install'` and `storage: localStorage`. Added a chunked SecureStore adapter (`ChunkedSecureStore`) and wired it as `auth.storage` on native; web falls back to default browser storage (SecureStore is unsupported on web). `createClient<Database>()` typing preserved. Env-var fail-fast guard retained from Step 0.1. |

**Created**

| File | Purpose |
|---|---|
| `docs/claude-reports/2026-06-07-step-0-1-1-secure-session-storage.md` | This report. |

> No other files were touched. No new runtime dependency was added — `expo-secure-store`
> was already installed and already registered as a config plugin in `app.json`.

---

## Commands run

- Consulted the **Expo SDK v56 `expo-secure-store` docs** (per `AGENTS.md`) to confirm:
  the async API (`getItemAsync` / `setItemAsync` / `deleteItemAsync`), the ~2048-byte
  platform value limit, allowed key characters (alphanumeric plus `.`, `-`, `_`), and that
  **SecureStore has no web support**.
- `npx tsc --noEmit`
- `git status --short`
- `git diff --stat`
- `git log --oneline -5` (to confirm the Step 0.1 baseline commit).

---

## TypeScript result

```
npx tsc --noEmit  →  exit code 0  (no errors)
```

The chunked adapter is structurally compatible with Supabase's expected storage interface
(async `getItem`/`setItem`/`removeItem`), and `createClient<Database>()` remains typed.

---

## Functional change

- **Native (iOS/Android):** the Supabase session is now persisted in the Keychain/Keystore
  (encrypted at rest) instead of the unencrypted SQLite-backed `localStorage`.
- **Chunking:** values are split into ≤ 2000-byte slices (safely below the ~2048-byte
  limit). Splitting is done by Unicode code point so multi-byte characters (e.g. Arabic in
  user metadata) are never split mid-sequence. Layout per logical key:
  - `key` → `{"__sb_chunks__": N}` (manifest)
  - `key.0 … key.N-1` → ordered value slices
  - `setItem` cleans up stale chunks from a previous longer value; `removeItem` deletes the
    manifest and all chunks; `getItem` returns `null` if any chunk is missing (forces a
    clean re-auth rather than feeding a truncated token to Supabase).
- **Web:** SecureStore is unavailable, so `auth.storage` is left undefined and Supabase
  falls back to the browser's `localStorage`. This preserves the previous web behavior.
- **No visible UI change.** Token auto-refresh wiring (`AppState`) from Step 0.1 is
  unaffected.

---

## Risks and assumptions

- **Existing local sessions are not migrated.** Any session previously stored in the
  `expo-sqlite` localStorage will not be read by the new store, so a logged-in dev session
  will require a one-time re-login. No production users exist, so impact is nil.
- **Multiple Keychain/Keystore entries per logical key** (1 manifest + N chunks). Auth
  writes are infrequent, so the extra entries and the additional async round-trips per
  read/write are negligible in practice.
- **Chunk size 2000 bytes** was chosen as a conservative margin under the documented
  ~2048-byte limit; Expo does not hard-enforce a limit, but staying under it avoids
  platform rejection and the historical large-value warning.
- **Web fallback** relies on Supabase defaulting to `globalThis.localStorage` when no
  storage adapter is provided; valid in a browser context.
- **SecureStore options left at defaults** — `keychainAccessible: WHEN_UNLOCKED` (session
  readable while the device is unlocked) and `requireAuthentication` not enabled (no
  per-read biometric prompt). Reasonable for a session token; can be revisited if a
  biometric gate is desired.
- **Key-character compliance:** Supabase storage keys (`sb-<ref>-auth-token` and the PKCE
  `…-code-verifier`) and the `.<index>` chunk suffix use only allowed characters.
- Verification was static (`tsc`). The app was not booted this step.

---

## How to test

1. **Type check:** `npx tsc --noEmit` → exit 0 (done).
2. **Cold-start persistence (end-to-end, after Step 0.2 adds a sign-in screen):**
   sign in, fully kill the app, relaunch → `useAuth().session` should be non-null
   (session restored from the encrypted store).
3. **Interim manual check (before auth screens exist):** from a temporary dev button call
   `supabase.auth.signInWithPassword({ email, password })` with a test user, then kill and
   relaunch the app and confirm the session restores. Confirm **no** "value larger than
   2048 bytes" warning appears in the logs (the purpose of chunking).
4. **Large-value round-trip:** store and read back a >2 KB string through the adapter and
   assert equality (chunk reassembly).
5. **Web:** `npm run web` → app boots with no SecureStore error (uses browser storage).

---

## Git status summary

- **HEAD:** `9efb4e5 feat(app): add foundation providers` (Step 0.1 was committed between
  steps).
- **`git status --short`** (before adding this report):
  ```
   M lib/supabase.ts
  ```
- **`git diff --stat`:**
  ```
   lib/supabase.ts | 121 +++++++++++++++++++++++++++++++++++++++++--
   1 file changed, 117 insertions(+), 4 deletions(-)
  ```
- Adding this report introduces one further untracked file:
  `docs/claude-reports/2026-06-07-step-0-1-1-secure-session-storage.md`.
- **Nothing committed.**

---

## Recommended next step

**Step 0.2 — routing split + auth screens** (`(auth)` / `(app)` route groups,
sign-in / sign-up, session route guard, sign-out), using **email + password**.

This is also the point at which the encrypted-storage change can be validated end-to-end
via the cold-start persistence test above.
