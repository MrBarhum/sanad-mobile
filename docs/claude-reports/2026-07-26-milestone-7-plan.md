# Milestone 7 — Pre-launch: implementation plan, decisions needed, and Track A record

**Branch:** `milestone-7-prelaunch` (worktree `.claude/worktrees/milestone-7-prelaunch`, based on `master` @ `88a44aa`)
**Date:** 2026-07-26
**Status:** plan complete · Track A in progress (running record in §9)

**Baseline validation quartet (before any change):**
`npx tsc --noEmit` = 0 · `node scripts/check-mojibake.js` = clean (257 files) · `git -c core.autocrlf=false diff --check` = clean · ar/en locale parity = **1102 = 1102**.

**Companion deliverable:** `docs/design/DESIGN_BRIEF_MILESTONE_7.md` (Tracks B + C screen specs for the designer).

---

## 0. How to read this

- §1 — the five things that changed the shape of the milestone, up front.
- §2 — decisions I need from you (blocking vs. non-blocking).
- §3 — the rule-change ledger: every new dependency, with its justification.
- §4 — Track A, item by item.
- §5 — Track B plans (build after designs land).
- §6 — Track C plan (no build).
- §7 — scope I am adding, and why.
- §8 — build order, dependencies, risk register, estimates.
- §9 — Track A running record (updated as I go).
- §10 — the maintainer runbook (nothing here is auto-applied).

---

## 1. Five findings that reshape the milestone

### 1.1 A1's root cause is *two* bugs, and the OTP is the right answer

The recovery flow fails for two independent reasons, and both are confirmed in installed source, not inferred:

**Bug A — the app never reads the warm-start URL.** `src/app/reset-password.tsx:37` uses `Linking.useURL()`, which returns `null` on the first render *unconditionally* (`node_modules/expo-linking/build/Linking.js:126-137` — `useState(null)`, populated only inside `useEffect`). So line 53's `linkingUrl ?? (await Linking.getInitialURL())` **always** takes the right branch. And on Android, `getInitialURL()` reads the activity's *launch* intent, which is never refreshed on `onNewIntent` (`grep -rn "setIntent" node_modules/react-native/ReactAndroid/.../react/` → 0 hits). Net: **app already open + tap link → `getInitialURL()` returns null or a stale URL → "invalid or expired"** on a link issued ten seconds ago. The correct URL *does* arrive milliseconds later via the `url` event, but the `[]` deps + `processedRef` latch (`:38-39, 49-51`) discard it forever. `useURL` is even marked `@deprecated Use useLinkingURL instead` in the installed build.

**Bug B — the emailed link is single-use and email scanners burn it.** Supabase's own troubleshooting page names this ("email prefetching"; Safe Links in Microsoft Defender for Office 365) and lists *"an OTP flow that relies solely on users manually copying a code from the email"* as a fix. Open upstream issues: `supabase/auth#1214` (unresolved since 2023), `supabase/discussions#41618` (explicitly covers password reset in hospital/university environments, no official response). This is structural and **not fixable in the app**.

**Recommendation: implement the 6-digit OTP, and also repair the deep-link screen.** The OTP path is immune to both bugs — `verifyOtp({ email, token, type: 'recovery' })` is a plain `POST /verify` with no URL, no deep link, no allow-list, and no PKCE (verified in `node_modules/@supabase/auth-js/.../GoTrueClient.js`, which emits `PASSWORD_RECOVERY` and persists the session). The deep-link screen still gets repaired because recovery emails already in flight will keep arriving for an hour.

**Not recommended: switching to PKCE.** It does not stop a scanner (the scanner still burns the flow state) and it *adds* a failure mode: the `code_verifier` lives in this app's SecureStore, so opening the link in Gmail's in-app browser, on a laptop, or after a reinstall fails with `bad_code_verifier`. Confirmed in `GoTrueClient.js` + `lib/helpers.js`.

> ⚠️ **Blocking on a maintainer action:** `resetPasswordForEmail` hits `/auth/v1/recover`, which is under Supabase's **project-wide 2-emails-per-hour cap on the built-in email provider**. That is 2 password resets per hour *for the whole app*. **Custom SMTP is a hard launch prerequisite** regardless of which path we take. See §2, D6.

### 1.2 The claim flow is broken by an already-written migration (verified)

`supabase/migrations/20260715120000_add_cancelled_by_to_care_tasks.sql:35` does `create or replace function public.enforce_care_task_collaborator_scope()` using the *pre-Phase-2E* body, and **silently drops the `sanad.in_claim` bypass** that `20260626162000_backfill_phase_2e_claim_flow.sql:416` added. I verified this directly: `in_claim` appears 6× in `20260626162000` and **0×** in `20260715120000`. Because `20260715120000` sorts last, the deployed trigger has no bypass, while `claim_care_task` still sets `sanad.in_claim='on'` (`:124`) and updates `assigned_to` while `status='open'`.

**Effect:** once that migration is applied, a `family_member` claiming a task hits `raise exception 'collaborators may only complete or cancel a task'`. `claim_family_visit` is unaffected (different trigger function, untouched), so the failure is *partial and confusing* — visits claim fine, tasks don't. «أنا متكفّل» is a headline Milestone-4 feature.

**I am adding a one-migration fix to Track A** (A8). Whether it is already live in production depends on D3.

### 1.3 The missed-dose grace value is honoured by only half the pipeline (verified, new)

- `supabase/functions/enqueue-due-reminders/index.ts:126` expires a due reminder at `doseAt + REMINDER_CONFIG.missedDoseGraceMinutes` — a **hardcoded global 60** (`_shared/config.ts:20`).
- `supabase/functions/check-missed-doses/index.ts:81,208-213` reads the **per-circle** `care_circles.missed_dose_grace_minutes` (default 30, CHECK 5–240).

A circle that sets grace to 240 has its due reminder dropped ~3 hours before the "not recorded" alert fires. A circle that sets 5 gets the missed alert while a still-valid due reminder is queued. The manager-facing stepper (`notification-settings.tsx:309-412`) presents the setting as authoritative; it is half-honoured. **Adding to Track A as A9** — it's a small change to one function, but it needs the circle-grace map threaded into `enqueue-due-reminders`.

### 1.4 There is no in-app account deletion — this is a hard Play Store blocker

Verified: `grep` for `deleteUser|delete_account|deleteAccount|حذف الحساب` across `src/` and `supabase/migrations/` returns **zero**. The `account` i18n namespace has 18 keys, none about deletion. `leaveCircle` leaves a *circle*, not the account.

Google Play requires in-app account deletion **and** a publicly reachable web deletion URL for any app that allows account creation. This is not optional and it is not a nice-to-have — it will fail review. It is outside the brief you gave me, so **I am not building it unilaterally**; see §2, D7. I recommend it becomes A10.

### 1.5 A3 is bigger than the "~8 packages" you saw, and A2 is bigger than 11 moderate

- `npx expo install --check` (run against the live Expo version service, the authoritative source) reports **10** packages behind: `@expo/ui`, `expo`, `expo-constants`, `expo-dev-client`, `expo-linking`, `expo-notifications`, `expo-router`, `expo-splash-screen`, `expo-web-browser`, `react-native-screens`.
  *(Correction to a sub-agent finding: comparing against the locally bundled `node_modules/expo/bundledNativeModules.json` shows only one drift. That file is the snapshot shipped inside `expo@56.0.12` and is stale by construction. The live `--check` output is authoritative.)*
- `npm audit` reports **15**, not 11: 4 **high** (`brace-expansion`, `js-yaml`, `postcss`, `shell-quote`) + 11 moderate (all one `uuid` chain).

---

## 2. Decisions — ANSWERED 2026-07-26

All eleven are settled. Recorded here because several change the plan below; the original framing is kept so the reasoning stays auditable.

| # | Answer | Consequence |
|---|---|---|
| **D1** | **Not published on Play** — never, not even internal testing. Name not yet chosen. | The package rename is free *right now* and never will be again. Keep A7 as the plan; **rename nothing** until the name is chosen. Add `ios.bundleIdentifier` in the same pass. |
| **D2** | **Free plan.** | A5 is client-side compression only. No Supabase image transformations. Global storage ceiling is 50 MB — the 2 MiB bucket cap sits well inside it. |
| **D3** | **All four `20260715*` migrations were applied 2026-07-16 via `supabase db push`.** Five cron jobs live and active. `check-missed-doses` and `send-daily-summaries` were 401ing until 2026-07-24, fixed by adding `verify_jwt = false` for both and redeploying. | ⚠️ **A8 is not hypothetical — task claiming is broken in production right now.** Promoted to the top of the runbook. Also: **A6's regen is unblocked** (R3), and since `db push` *is* in use, keeping A5's storage SQL outside `supabase/migrations/` is now load-bearing rather than merely tidy. |
| **D4** | OTP primary + deep-link repair. | As shipped in `57ea47c`. |
| **D5** | On-device PDF. | Confirmed by the spike. |
| **D6** | **Custom SMTP will be configured before launch.** | **Hard prerequisite.** Until it is, password reset is capped at 2 emails/hour project-wide — roughly unusable on day one. |
| **D7** | **Build A10.** | Done (`159f2a1`). The public web deletion URL is runbook R8.4. |
| **D8** | Both A8 and A9. | Done. |
| **D9** | PDF scope as proposed; keep the "current schedule only" caveat **visible on the page**. | Carried into the A4 build. |
| **D10** | `medication_id` in the object path; mirror the live predicate; do not widen. | As shipped in `ba6edac`. |
| **D11** | **Tagalog + Indonesian first.** Hindi/Amharic and the second-font question deferred with C1. | The design brief's C1 section already scopes it this way. |

Also confirmed as the maintainer's own: **§7.3** (app icon and splash are still the Expo template) and **§7.7** (privacy policy + Play Data Safety). Both stay flagged; neither is built.

### The original framing (kept for the record)

### Blocking — I cannot finish the affected item without an answer

| # | Decision | Why it blocks | My recommendation |
|---|---|---|---|
| **D1** | **Is the app published on Google Play yet?** | Decides whether A7's rename is cheap or catastrophic. The Android package `com.mrbarhum.sanadcare` **cannot be changed on a published listing** — a rename would mean a new listing and manual user migration. Pre-launch, it's free. | If unpublished, change the package name in the same pass as everything else. I'll write the runbook both ways. |
| **D2** | **Supabase plan — Free or Pro?** | A5's "thumbnail rendering" deliverable depends on it. Supabase image transformations (server-side resize on read) are **Pro-only** (`supabase/config.toml:131` already notes this). On Free, "thumbnail" means client-side compression + `expo-image` downscaling one ~1280px asset. | Assume **Free** and design for it. The Free approach works on Pro too; the reverse isn't true. Tell me if you're on Pro and I'll add transform-on-read as an enhancement. |
| **D3** | **Which cron jobs are actually live, and are the `20260715*` migrations applied?** Run: `select jobname, schedule, active from cron.job;` (never `select command`) and `select 1 from information_schema.columns where table_name='care_tasks' and column_name='cancelled_by';` | Three repo documents disagree about whether `check-missed-doses` and `send-daily-summaries` are scheduled. And A6 + A8 both hinge on whether `20260715120000` is applied — if it is, task claiming is **broken in production right now**. | Run both queries and paste the output. It's 10 seconds and it de-risks three items. |

### Non-blocking — I'll proceed on a stated assumption; correct me if wrong

| # | Decision | My assumption | Change it by saying… |
|---|---|---|---|
| **D4** | **A1 approach** | Ship the **6-digit OTP** as the primary path, *and* repair the deep-link screen as a fallback for in-flight emails. Keep `flowType` implicit (unchanged). | "link only" or "OTP only, delete the deep-link route" |
| **D5** | **A4 on-device vs server-side PDF** | **On-device** (`expo-print` + `expo-sharing`). Reasoning in §4.4 — it's not close. | — |
| **D6** | **Custom SMTP** | You will configure custom SMTP before launch. Without it, password reset is capped at **2 emails/hour project-wide**. | "not yet" — then A1 ships but is unusable at any real volume, and I'll say so in the report |
| **D7** | **Account deletion (§1.4)** | You want it in Track A as **A10** (Play blocker). I have *not* started it. | "defer it" / "yes, add it" |
| **D8** | **The claim regression (§1.2) and grace mismatch (§1.3)** | Both go into Track A as **A8** and **A9**. | "defer" |
| **D9** | **A4 PDF scope** | One page, current state: recipient name + age, active medications with dose + schedule, 30-day adherence summary, latest reading per vital type with date, conditions/allergies/blood type, upcoming appointments (next 60 days), disclaimer. No history, no charts. | tell me a different window or section list |
| **D10** | **A5 storage bucket policy** | The bucket SELECT policy must **mirror the live `medication_logs` read policy**, not the transparent-circle posture — see §4.5. This makes the object path `<circle_id>/<medication_id>/<log_id>.jpg`. | — |
| **D11** | **Worker languages for C1** | Plan for Tagalog + Indonesian first (Latin script, covered by Cairo). Hindi and Amharic need a **second font family**, which breaks the M6 one-typeface law — flagged as a product decision, not built. | name a different first pair |

### Things I decided myself and am telling you rather than asking

- **`npm audit fix` yes, `--force` never.** `--force` proposes downgrading `expo-splash-screen` 56→55 *and* `expo` 56→46. Rejected outright.
- **The uuid chain (11 moderate) stays.** Full reachability analysis in §4.2 — it is not exploitable here, and the only offered fix breaks the SDK.
- **No `expo-location` for B2.** A bundled ~120-city table gives prayer times with no native module and no location permission. Details in §5.2.
- **No `expo-camera` for A5.** `expo-image-picker` provides both camera and gallery in one module.
- **I replaced the worktree's `node_modules` junction with a real isolated install** before A3, so upgrading packages here cannot desync your `master` checkout.

---

## 3. Rule-change ledger — every dependency, justified

The Milestone 5/6 "zero new native dependencies" rule is lifted for this milestone. Here is the complete list, so the EAS rebuild is one cycle, not four.

### Requires a native rebuild (batch into ONE EAS build)

| Package | Version (SDK 56) | For | Justification | `app.json` plugin |
|---|---|---|---|---|
| `expo-print` | `~56.0.4` | A4 | The **only** way to get correct Arabic shaping + bidi in a PDF. Android renders through Chromium/HarfBuzz, iOS through WebKit/CoreText — real browser engines. Every Deno-side alternative (pdf-lib, @react-pdf/renderer) has broken or absent Arabic shaping; pdf-lib's maintainer says RTL requires "drawing each character individually", and react-pdf's bidi PR is still open in 2026 with a documented lam-alef ligature that "may disappear entirely". A doctor summary cannot ship on that. | none needed |
| `expo-sharing` | `~56.0.18` | A4, B1 | The only package that can share a `file://` PDF on Android. RN's `Share` is text-only on Android (verified in `react-native/Libraries/Share/Share.d.ts`). expo-sharing ships its own FileProvider + `<queries>` manifest entries — zero manual config. | none for outgoing shares |
| `expo-image-picker` | `~56.0.18` | A5, B1 | There is no pure-JS way to open a camera or gallery in RN. Provides both `launchCameraAsync` and `launchImageLibraryAsync` in one module, so `expo-camera` is unnecessary. | **yes** — with `microphonePermission: false` (strips Android `RECORD_AUDIO`; a care app asking for the mic to attach a photo is a store-review flag) |
| `expo-image-manipulator` | `~56.0.19` | A5, B1 | Picker `quality` alone does **not** resize; a 12 MP Android photo stays 4000×3000 and lands unpredictably between 600 KB and 1.5 MB. `resize({width:1280}) + compress 0.7` gives a predictable 150–300 KB. Marginal build cost is **zero** — we're already paying for one rebuild. | none needed |

### No rebuild (pure JS / already in the binary)

| Package | Version | For | Justification |
|---|---|---|---|
| `expo-file-system` | `~56.0.8` | A4, A5 | **Already installed and already autolinked** — it is a direct dependency of the `expo` package itself. Adding it to `package.json` is a declaration only, so `expo-doctor` stops complaining. Gives `File#bytes()` for the Supabase upload and `File#move()` for a readable PDF filename. |
| `adhan` | `4.4.4` | B2 | Pure JS, zero deps, MIT, ~4.5 KB gzipped, 23k weekly downloads, still maintained (4.4.4 shipped 2026-06). Has all six Gulf/Levant calculation methods (UmmAlQura, Dubai, Qatar, Kuwait, MuslimWorldLeague, Egyptian). **Do not confuse with `react-native-adhan`, which is native — reject it.** |
| `@internationalized/date` | `3.12.2` | B2 | For `IslamicUmalquraCalendar`. Its only dependency, `@babel/runtime`, is already in the lockfile at 7.29.7 → **effectively zero new packages**. Its Hijri data is a bundled lookup table (Hijri 1300–1600) that calls neither `Intl` nor ICU — which matters, because `Intl.DateTimeFormat` with `calendar:'islamic-umalqura'` is **not reliable on Hermes/iOS** (`facebook/hermes#1716` open; `formatToParts` regressed to `undefined` on RN 0.77/iOS). This repo already distrusts `Intl` — `src/utils/date.ts:122-136` wraps it in try/catch. **Import discipline: use only `CalendarDate` + `toCalendar` + the calendar classes; never `now()`/`today()`/`getLocalTimeZone()`, which do use `Intl`.** |

### Explicitly rejected

| Package | Why |
|---|---|
| `expo-camera` | Redundant with `expo-image-picker` for A5's needs; a second native module and a second permission surface for no gain. |
| `expo-location` | Native rebuild **and** a runtime location permission **and** a privacy-posture regression — all avoidable. A ~120-city bundled table (~11 KB raw / ~5 KB gzipped) is smaller than the adhan library. Deriving coordinates from the circle *timezone* alone does not work: Riyadh and Jeddah share `Asia/Riyadh` but their Fajr differs by **38 minutes** — a wrong Suhoor cutoff. |
| `react-native-adhan` | Native wrapper around adhan-cpp. Buys nothing over the pure-JS `adhan` for 5 timestamps a day. |
| `base64-arraybuffer` | Unnecessary — `expo-file-system`'s `File#bytes()` returns a `Uint8Array` directly, and `base64()` inflates memory 1.33×. |
| `@anthropic-ai/sdk` (in the edge function) | Supabase's own edge-function guidance says prefer `fetch` over an HTTP client. The request body is five fields. The repo's one existing third-party HTTP client (`_shared/expo.ts`) is raw `fetch` — match it. |
| `puppeteer` / any headless browser | Impossible on Supabase Edge: 256 MB memory, 2 s CPU, 20 MB bundle, no workers, no child processes. |
| Any third-party PDF service | Would mean a vendor receiving PHI-adjacent care data. Non-starter. |
| Sentry / any crash reporter | Would be a native dependency and a data-flow decision I'm not making unilaterally. **But note §7.4** — we are launching completely blind, with zero client telemetry. |

---

## 4. Track A — build now

### A1 · Password reset — 6-digit OTP + deep-link repair

**Reuse:** `src/app/(auth)/forgot-password.tsx` (email input → submit → `sent` state); the two-password-field block from `reset-password.tsx:137-167`; `FormField` (full `TextInputProps` passthrough, `error`, `secureToggle`, `accessibilityRole="alert"` error row); `AuthHeader`/`AuthError`; `FigmaFooterPrimaryButton`; `Surface`; `Screen keyboardAvoiding`; `LtrText`/`isolateLtr`. **The 6-digit input style already exists** at `src/features/invitations/join-form.tsx:120-127` (`Fonts.mono`, 20px, `letterSpacing: 3`, centered, `writingDirection:'ltr'`) — lift it and add `keyboardType="number-pad"`, `maxLength={6}`, `textContentType="oneTimeCode"`. zod is installed. Server config is already correct: `otp_length = 6`, `otp_expiry = 3600`.

**New:**
- A code-entry phase inside the forgot-password flow (`enterCode → setPassword → done`), replacing the terminal `sent` banner.
- `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` — no new dependency; already in the installed `auth-js`.
- Arabic-Indic digit normalisation (٠-٩ / ۰-۹ → ASCII) + bidi-mark stripping before sending. Supabase compares the string exactly.
- A **resend countdown** — nothing to reuse; `grep` for `cooldown|throttle|countdown` in `src/` returns 0. 60 s, matching Supabase's per-user OTP window.
- A client attempt cap on wrong codes (Supabase documents no per-user brute-force lockout on `/verify`; the 10⁶ space at 360 req/hr/IP is fine, but a cap is cheap).
- Distinct error copy for `otp_expired`, `over_email_send_rate_limit`, `same_password`, `weak_password` — today every failure collapses to one string. `error.code` carries these; the repo currently discards the send result entirely (`forgot-password.tsx:46`).
- **Deep-link repair** in `src/app/reset-password.tsx`: swap `Linking.useURL()` → `Linking.useLinkingURL()` (returns the URL synchronously on first render and updates on `onNewIntent`), give the effect a `[linkingUrl]` dep, replace the `processedRef` boolean with a **processed-URL-string** ref (the pattern `pending-join-link.tsx:50` already uses correctly), and add a `params.type === 'recovery'` guard so an already-signed-in user's `getSession()` fallback can't silently change the *current* account's password (`reset-password.tsx:85-88` today).
- New i18n pairs (ar + en at parity): code label, code placeholder, "enter the 6-digit code we emailed", wrong-code, expired-code, resend, resend-cooldown, rate-limited. Structural precedent: the `joinCircle.code*` keys.

**Maintainer runbook (§10, R1):** the Reset Password email template must be edited in the Dashboard to render `{{ .Token }}` and **remove `{{ .ConfirmationURL }}`**. Removing it is not cosmetic: `{{ .Token }}` and `{{ .TokenHash }}` are the *same secret*, so leaving the URL in means a scanner GET still burns the printed code.

**Risk:** device-only verification. There is no test infrastructure in this repo (§7.5) and `tsc`/web prove nothing about deep links.
**Estimate:** M (the largest Track A item).

### A2 · Dependency vulnerabilities

**Do:** `npm audit fix` (no `--force`). Clears all 4 highs via patch bumps: `brace-expansion` 5.0.6→5.0.7, `js-yaml` 4.2.0→4.3.0, `postcss` 8.5.15→8.5.18, `shell-quote` 1.8.4→1.9.0. All are dev/build-time only — eslint tooling, Tailwind CSS compilation, and `react-devtools-core`. Then re-verify with `npx expo install --check`, `npx expo-doctor`, `npm run lint`, `npx tsc --noEmit`.

**Deliberately leave: the 11 moderate `uuid` findings (GHSA-w5hq-g745-h8pq).** Reachability analysis:
1. **Wrong function.** The only consumer is `xcode@3.0.1`, whose entire uuid surface is one line: `node_modules/xcode/lib/pbxProject.js:90` → `uuid.v4()`. The advisory covers **v3/v5/v6**, and explicitly notes v1/v4/v7 validate correctly.
2. **No `buf` argument.** The advisory's precondition is a caller-supplied output buffer. The call takes zero arguments.
3. **v6 doesn't exist** in the installed uuid 7.0.3 (introduced in uuid 9).
4. **Build-time only, on a code path this repo never runs.** `@expo/config-plugins` uses `xcode` to mutate an Xcode `.pbxproj` during **iOS prebuild**. There is no `ios/` directory (CNG + EAS), no untrusted input, and nothing reaches a device.

The only offered remediation downgrades `expo-splash-screen` to 55.x inside an SDK-56 app. Rejected. If you ever need a zero-moderate audit for an external gate, `"overrides": { "uuid": "^11.1.1" }` works (uuid 11 still ships a CJS `v4` named export, which is all `xcode` uses) — but it's a global pin that becomes dead weight the moment Expo patches `xcode`, so I'd rather document the finding than carry the maintenance.

**Estimate:** S.

### A3 · Expo SDK patch updates

`npx expo install @expo/ui expo expo-constants expo-dev-client expo-linking expo-notifications expo-router expo-splash-screen expo-web-browser react-native-screens` — 10 packages to their SDK-56 pins. Then `npx expo install --check` (clean) + `npx expo-doctor` + the full quartet. Must land **before** the EAS build.

Prerequisite I already handled: the worktree's `node_modules` was a junction into your `master` checkout, so an install here would have desynced it. Replaced with a real isolated install.

**Risk:** low, but `expo-router 56.2.11 → 56.2.16` and `expo-notifications 56.0.18 → 56.0.22` are the two worth a device smoke test.
**Estimate:** S.

### A4 · Doctor summary PDF

**Recommendation: on-device (`expo-print` + `expo-sharing`). Not server-side.** The reasoning, ranked:

1. **Arabic correctness is engine-grade on-device and provably broken server-side.** expo-print renders through a real browser engine on both platforms — Android `WebView` → Chromium's PDF backend (HarfBuzz shaping, ICU bidi); iOS `WKWebView` → `UIPrintPageRenderer` (CoreText). `dir="rtl"` works exactly as in a browser. Every Deno-viable library would require hand-implementing the Unicode Bidi Algorithm and Arabic contextual shaping. In a document a doctor reads, a silently-dropped لا ligature or a reversed blood-pressure reading is a safety problem.
2. **Graceful degradation.** Worst case with no custom font is *correct Arabic in the system typeface* (Android ships Noto Naskh Arabic, iOS ships Geeza Pro/SF Arabic) — never tofu, never disjointed letters.
3. **Zero PHI leaves the device.** No new server surface, no new runbook step.
4. **Supabase Edge cannot host a browser.** 2 s CPU, 256 MB RAM, 20 MB bundle, no Web Workers, no child processes.

**Reuse:** every data hook already exists — `useRecipient`, `useVitals`, `useEmergencyContacts`, `useDoctors`, `useUpcomingAppointments`, `useActiveMedications` + schedules, `useCircleMembers`. `formatVitalValue()` (`vitals/describe.ts:8`), `approximateAgeYears()` (`utils/date.ts:20`), `describeDailyLog()`, and the whole `src/utils/date.ts` formatter set. The **share affordance to copy** is the Pulse header share pill (`src/features/pulse/figma-pulse.tsx:90-106` — a bordered pill with a `Share2` icon), and the existing text-export precedent is `composePulseShareText()` (`pulse/present.ts:143-156`).

**New:**
- `src/features/doctor-summary/` — an HTML template builder that composes from `t()` calls (never inline Arabic), a `buildSummaryHtml()`, and a `shareSummaryPdf()`.
- **Adherence over a range does not exist anywhere.** Verified: every dose query is `.eq('dose_date', …)`, never a range. `summarizeDoses()` (`medications/today.ts:103`) is single-day and doesn't even separate missed from postponed. A 30-day figure must re-derive expected doses from `medication_schedules` × calendar days and diff against logged rows. **Caveat to state on the PDF: schedules have no history** — `times`/`is_active` are current-state only, so a window spanning a schedule edit is not faithfully reconstructable. I'll label the figure «آخر ٣٠ يومًا حسب الجدول الحالي» and keep it a count, never a percentage-with-a-judgement.
- **RLS constraint:** `medication_logs` SELECT is responsibility-scoped (`20260626161000:150-161`) — a `family_member` who isn't responsible for a medication cannot read its logs. So a circle-wide adherence number is only correct for managers. The PDF action is **manager-gated** (`circle.canManage`), consistent with how `medications/new.tsx:16-28` gates.
- **Cairo embedded as base64 `@font-face`.** Two weights (400 + 700) ≈ 252 KB of inline HTML; a build-time subset would cut that to ~15–30 KB. `@expo-google-fonts/cairo` is `MIT AND OFL-1.1` and OFL explicitly permits PDF embedding. **Never reference Google Fonts by URL** — `expo/expo#29064` documents a blank first print, and Android passes `baseURL = null` so the WebView origin is `about:blank` and CORS blocks it.
- A4 geometry: `printToFileAsync({ html, width: 595, height: 842 })`. **Never set `useMarkupFormatter`** — it bypasses the WebView entirely, drops images, and won't honour `@font-face`.
- Set margins **both** ways: `@page { margin: … }` (Android) and the `margins` option (iOS).

**Risks:**
- **Font-ready race** (same mechanism as #29064) — data URIs avoid the network but font installation is still async relative to `load`. Mitigations in order: put the `@font-face` block first in `<head>`, keep the HTML small, and accept system-Arabic fallback if flaky.
- **Android WebView print regressions are real and device-dependent** (crbug 1334127: blank normal-weight text on OnePlus/Galaxy/Oppo/Pixel 5-6, but not Pixel 4a). WebView version is not controlled by the app.
- **Extra trailing blank page** (`expo/expo#7435`) — Android over-counts pages. Keep content well under 842 pt.

**De-risking gate:** before spending the EAS rebuild, build a **throwaway Expo Go / Snack spike** (both packages are Expo-Go-supported) with base64 Cairo, `dir="rtl"` Arabic, and A4 geometry. Check on a real Android device *and* an iPhone: do glyphs join, is it Cairo or system Arabic, is it exactly one page, and does the text select out as real Unicode (proof the font is embedded, not rasterised). **This is a separate throwaway app — it does not mean this project switches to Expo Go.**

**Estimate:** M–L.

### A5 · Dose photo infrastructure

**Reuse:** `medication_logs` (the write path is `insertLog`/`updateLogStatus` at `medications/api.ts:195-219`, hook `useLogDose` at `hooks.ts:199`); `expo-image` (already a dependency and already in `app.json` plugins); the 40×40 bordered `Radius.control` status square in `DoseCard` (`figma-medications.tsx:306-308`) and `DoseRow` (`figma-home.tsx:652-654`) — both are fixed-size `flexShrink:0` boxes, i.e. drop-in thumbnail slots with no reflow; the Pulse row icon square (`figma-pulse.tsx:146-148`); RLS helpers `is_circle_member` / `has_circle_role` / `is_responsible_for_medication` / `can_view_all_operational`.

**New:**
- Column: `medication_logs.proof_object_path text` (path only, never a URL). `medication_logs.note` exists and is unused, but overloading it would be wrong.
- Bucket `dose-proof`: **private**, `file_size_limit = 2097152` (2 MB), `allowed_mime_types = ['image/jpeg','image/png','image/webp']`.
- **Object path: `<circle_id>/<medication_id>/<log_id>.jpg`.** This is the correction flagged in D10 — a research agent proposed `<circle_id>/<log_id>.jpg` with a SELECT policy of `is_circle_member(circle_id)`, citing the *original* `medication_logs` read policy. **That policy was replaced.** The live one (`20260626161000:148-161`) is `can_view_all_operational(circle_id) OR (is_circle_member(circle_id) AND is_responsible_for_medication(circle_id, medication_id, auth.uid()))`. Using the broader predicate would mean a `family_member` who *cannot see the dose-log row* could still fetch a signed URL for its photo — a privacy regression introduced by this feature. The medication id must be in the path so the policy can express the real predicate.
- A `public.storage_path_circle_id(text)` / `storage_path_medication_id(text)` helper pair that returns `null` (never raises) on a malformed path — a naked `(storage.foldername(name))[1]::uuid` inside a policy **raises 22P02** rather than denying.
- Upload path: `new File(asset.uri).bytes()` → `Uint8Array` → `supabase.storage.from('dose-proof').upload(path, bytes, { contentType })`. **`contentType` is mandatory** — omit it and storage-js defaults to `text/plain;charset=UTF-8` (`DEFAULT_FILE_OPTIONS`) and the object won't render. Do **not** pass a `Blob`/`FormData`/the `File` object — all are broken in RN (documented in the installed `StorageFileApi.ts:217`).
- Display: `<Image source={{ uri: signedUrl, cacheKey: objectPath }} cachePolicy="memory-disk" recyclingKey={objectPath} />`. The `cacheKey` matters — a Supabase signed URL's token rotates on every `createSignedUrl`, so without a stable cache key every render is a cache miss.
- `exif: false` on the picker, so the care recipient's home GPS never ships.
- Storage cleanup: there is **no ON DELETE CASCADE** from `medication_logs` to `storage.objects`. Delete the object client-side in the same mutation.

**Migration split (this matters):** `storage.objects` is owned by `supabase_storage_admin`, not `postgres`, so `CREATE POLICY` on it can fail with `42501 must be owner of table objects` via `db push` while succeeding in the Dashboard SQL Editor. And `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` **always** fails and is unnecessary (RLS is on by default) — it must never appear in a file. So:
- `supabase/migrations/<ts>_dose_proof_helpers.sql` — `public.*` only (the two path helpers + the column). Normal migration flow.
- `docs/deployment/dose-proof-storage.sql` — the bucket insert + the four `storage.*` policies, flagged **Dashboard SQL Editor only**, kept *out* of `supabase/migrations/` so a future `db push` can't pick it up and fail.

**Estimate:** M.

### A6 · Regenerate Supabase types — **SKIP, with the command for you**

**Verified stale.** `src/types/supabase.ts` was last committed `2026-07-04` (`31dc56d`) and contains **zero** occurrences of `cancelled_by`, `list_care_activity`, or `set_missed_dose_grace_minutes`. It predates the `20260715*` migrations by 12 days. The localized casts must stay.

The six casts, and what each is waiting for:

| # | File:line | Waiting on | Still needed after regen? |
|---|---|---|---|
| 1 | `tasks/api.ts:87-91` | `care_tasks.cancelled_by` | no — remove |
| 2 | `tasks/api.ts:106-112` | same | no — remove |
| 3 | `pulse/api.ts:14-20` | RPC `list_care_activity` | no — remove |
| 4 | `circle-selection/missed-dose-grace.ts:36-45` | RPC `set_missed_dose_grace_minutes` | no — remove |
| 5 | `circle-selection/missed-dose-grace.ts:26,30` | column `care_circles.missed_dose_grace_minutes` | no — remove |
| 6 | `claiming/api.ts:20-26` | Phase-2E claim RPCs | **already unnecessary today** — all six RPCs *are* fully typed in the current file (`:1254`–`:1676`). The comment at `:5-12` is out of date. |

**Cast #6 is removable right now**, with no regeneration. I'll do that as part of A6 and leave 1–5 in place with a pointer to this section. Also missing and worth knowing: `notification_type = 'daily_summary'` (added by `20260715140000:13`) is absent from the generated enum.

**Your command** (needs `supabase login`, which I will not run):
```
npx supabase gen types typescript --project-id qccgshanmoeybagxwvcs > src/types/supabase.ts
```
Run it after confirming D3, then tell me and I'll clear casts 1–5 in one commit.

**Estimate:** XS (cast #6 only).

### A7 · Rename readiness audit — inventory only, no rename

Raw scale: `sanad` (case-insensitive) = **1049 hits / 190 files**; Arabic `سند` = **153 hits / 50 files**. But ~95% is documentation. The load-bearing surface is ~121 occurrences across 40 files.

**Clean already (zero occurrences):** `eas.json`, `.env.example`, `README.md`, `scripts/`, `assets/`, `tailwind.config.js`, `metro.config.js`, `babel.config.js`, `eslint.config.js`, `.vscode/`. There is no `app.config.js` — `app.json` is the only Expo config.

**The 11 breaking items:**

| # | Thing | Blast radius |
|---|---|---|
| B1 | `app.json:21` Android package `com.mrbarhum.sanadcare` | **The expensive one.** New Play listing (irreversible if published — see D1) + a new Firebase Android app + **every push token dead** + SecureStore wiped (users signed out, theme + active-circle prefs reset). |
| B2 | `google-services.json` | Must be **re-downloaded** from Firebase, never hand-edited. `package_name` must byte-match B1. `project_id` (`sanad-care-4dbbc`) is immutable. |
| B3 | `app.json:8` scheme + `src/features/auth/password-reset.ts:12` + the Supabase Auth Redirect-URL allow-list | **Must land as one atomic change across three places.** Miss the allow-list and recovery links silently 302 to the Site URL — the documented `localhost:3000` failure. All previously-sent recovery emails and WhatsApp invite links break permanently. |
| B4 | `app.json:4` slug `sanad-mobile` | `eas build`/`eas update` fail until the expo.dev project slug matches. **Do not touch `extra.eas.projectId`** — push tokens are minted against it. |
| B5 | `push-registration.ts:154-159` ↔ `_shared/notification-content.ts:22-27` category **id values** | A one-sided change silently removes notification action buttons for every user on the other build. **Recommendation: keep `sanad_*_reminder` permanently as opaque internal ids** and add a comment saying so. |
| B6 | `device.ts:12` `sanad_device_id` | Duplicate push-token rows + duplicate pushes. |
| B7 | `theme-storage.ts:13`, `circle-selection/storage.ts:14` | Silent per-user preference reset on upgrade. **Recommendation: leave unchanged** — unless B1 happens, in which case storage is wiped anyway and the rename is free at that exact moment and never again. |
| B8 | GUC `sanad.in_claim` — 6 sites in `20260626162000` | Already-live functions; a partial rename breaks the claim RPC's guard. **Recommendation: skip** — invisible internal identifier, real breakage risk, zero user benefit. |
| B9 | `_shared/messages.ts:51` fallback push title `'سند'` | Ships from the server — needs a `functions deploy`, not an app release. |
| B10 | Live pg_cron job names `sanad-*` | Cosmetic to the system, but every documented rollback query filters `jobname like 'sanad-%'`. Rename only if you also update the runbooks. |
| B11 | `.claude/skills/sanad-mobile-ui-ux-design/` dir + `SKILL.md:2 name:` | The directory name *is* the skill's invocation name. |

**Two traps in the i18n sweep:**
- **7 Arabic false positives — do not touch.** `سند` is a substring of مُسنَد ("assigned"): `ar.json` lines 611, 627, 665, 666, 667, 1233, 1404 (`assignment.unassigned`, `tasks.assignedToMe`, …).
- **The prefixed form «لسند»** appears at `ar.json:1326` and `:1334`. A naive find/replace corrupts it.

**Zero asset filenames contain the name** — but the icons are still the Expo defaults, which is a separate blocker (§7.3).

**Also: `ios.bundleIdentifier` is missing entirely** (`app.json:10-12` is just `{"icon": …}`). iOS cannot be built today. The rename is the moment to **add** it for the first time.

The full 6-phase ordered runbook (dashboards first, then server, then app config, then app code, then docs, then verify) is in the audit deliverable. The invite-code note: real codes are `XXXXX-XXXXX` from a 31-char alphabet — there is **no `SND-` prefix anywhere in the product**, only in mockups. A stale comment at `join-form.tsx:22` claims otherwise.

**Estimate:** S (audit is done; it's a write-up).

### A8 · (added) Restore the claim-flow trigger bypass — see §1.2

One migration re-creating `enforce_care_task_collaborator_scope()` with **both** the `sanad.in_claim` bypass from `20260626162000:416` **and** the `cancelled_by` completion bookkeeping from `20260715120000`. Written as a file, hand-applied. **Estimate:** S.

### A9 · (added) Missed-dose grace coherence — see §1.3

Thread the per-circle grace map into `enqueue-due-reminders` and use it for `expiresAt` instead of the hardcoded 60. `check-missed-doses` already has `fetchCircleGrace()` — lift it into `_shared/`. Requires a `functions deploy` of `enqueue-due-reminders`. **Estimate:** S.

### A10 · (proposed, awaiting D7) In-app account deletion — see §1.4

Needs: an edge function or `security definer` soft-delete RPC (deleting an `auth.users` row requires service-role), a settings row in `account.tsx:142-171`, ar/en copy, a confirm pattern (`confirmAction` with `destructive: true`, mirroring sign-out at `account.tsx:61-73`), and a public web deletion URL. **Estimate:** M. **Not started.**

---

## 5. Track B — plan + design brief now, build after designs

### B1 · Document vault

**Reuse:** everything A5 builds — the Storage upload pattern, the RLS path-helper approach, `expo-image-picker`, `expo-image-manipulator`, `expo-sharing`. Plus `FigmaScreen`+`FigmaHeader`, `Surface(padded=0)` grouped list, `FigmaListRow`, `FigmaSegmentedTabs` (category filter), `EmptyState`, `ItemActions` (inline two-step delete), `StatusBadge`.

**New:** a `care_documents` table (circle_id, category enum, title, object_path, mime_type, size_bytes, uploaded_by, created_at) following the canonical 4-policy RLS template; a second bucket `care-documents`; a category taxonomy; **and a real gap — there is no document/PDF viewing component and no `expo-document-picker`.** A non-image document (a PDF lab result) can be uploaded and shared but not previewed in-app without either `expo-document-picker` (to select it) and an out-of-app open via `expo-sharing`/`WebBrowser`. Called out in the design brief.

**The hard constraint, structurally enforced:** *zero* interpretation of any value. No OCR, no parsing, no extraction, no "your last A1c was…". The table stores a title the user typed and a file. Nothing reads inside the file. This is what keeps the app out of medical-device classification, and it must be visible in the schema, not just the UI.

**Open decision for you later:** retention/quota. Free-plan Supabase storage is 1 GB total.

### B2 · Ramadan & prayer-time mode

**Stack (§3):** `adhan@4.4.4` + `@internationalized/date@3.12.2` (`IslamicUmalquraCalendar` only) + a bundled ~120-city table. **≈20 KB gzipped, zero native modules, zero new permissions, fully offline, no coordinate ever leaves the device.**

**Reuse:** `src/constants/timezones.ts` already has 43 entries each carrying `city{en,ar}` + `country{en,ar}` — the picker chrome, search, and Arabic labels are solved; the city table is a sibling of the same shape. `care_circles.timezone` seeds the default city. `todayYmdInTimeZone()` / `hmInTimeZone()` already exist. Notification quiet hours already exists as the closest analogue (`notification_defer_until`).

**The critical scoping call — the app surfaces anchors, it does not reschedule.** Reassigning a dose from 08:00 to "Iftar" changes fasting-state pharmacokinetics and hypoglycaemia risk. That is a clinical decision. Per the standing «دون أي نصيحة طبية» law, the correct scope is: show today's Fajr and Maghrib, let the caregiver *see* which doses fall inside the fasting window, and prompt them to raise it with the doctor. **The app proposes nothing.**

That choice also collapses the engineering cost enormously. The "actually shift the dose time" version has **23 identified touch points** (T1–T23) across the schema, both edge producers, the SQL delivery-time validator, and six client files — and the hardest one is a genuine blocker: `notification_source_validity` (`20260626164000:310`) validates a reminder by checking `v_scheduled_time = any (v_sched.times)`, so a *computed* time is not in `times` and **every anchored reminder would be dropped as `occurrence_changed`** at both fan-out and send. Plus the dedupe keys embed the resolved clock time, so a ±1-minute daily drift in Iftar mints a new key and duplicates the reminder.

**The suppression-only version** (don't ping during fasting hours) is a `notification_suppress_until()` sibling of `notification_defer_until` called at the same three sites, backed by a per-circle window — **zero** changes to `medication_schedules`, `medication_logs`, dedupe keys, source-validity, or any client file.

**Note:** suppression must be **server-side**. There is no client-side scheduling of real reminders anywhere — every reminder is a remote Expo push, rendered by the OS without running JS.

**The 6–8 week guidance is diabetes-specific.** IDF-DAR Practical Guidelines 2021 recommend a pre-Ramadan assessment 6–8 weeks ahead **for people with diabetes who intend to fast**, reviewing medication among 12 other factors. It is **not** a general "review all medications" recommendation, and presenting it as universal would itself be medical advice. Copy must attribute (who recommends it, for whom) and route to the doctor — never "adjust the dose", never "it is safe to fast".

**And: never state Ramadan's start as certain.** Umm al-Qura is *predictive*; the actual start is declared by moon sighting and varies ±1 day by country. Phrase approximately («يبدأ رمضان تقريبًا…») and never hard-gate behaviour on the computed boundary.

**New:** a settings surface (per-circle: enable, city, calculation method), a per-medication or per-schedule fasting attribute, the city table, and the suppression window. **Needs designs before I build.**

### B3 · Arabic AI narrator

**Security posture, non-negotiable and satisfied by construction:**
- Key in `ANTHROPIC_API_KEY` via `supabase secrets set`, read with `Deno.env.get` inside the function, **fail closed** if absent (matching `_shared/supabase.ts:12-14`). Verified: no server secret is readable from the client bundle today — the only client credentials are `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `grep` for `SERVICE_ROLE|NOTIFICATIONS_CRON_SECRET|EXPO_ACCESS_TOKEN` across `src/`, `lib/`, `app.json` returns zero.
- `verify_jwt = true` (all five existing functions use `false` because they're cron-invoked with a shared secret — **this one must not copy that**).
- **The data read uses the caller's JWT-scoped client, never service-role.** With a service client, any authenticated user could pass any `circle_id` and get an LLM-authored prose summary of another family's medications and vitals — a cross-tenant PHI leak with the model as the exfiltration channel, and *narrative* output is worse than a row dump because it's directly readable. Using the user's JWT makes the already-hardened RLS the enforcement point; no new authorization logic is needed.
- Plus an explicit `is_circle_member` probe before reading, returning an **identical 403 body** for "not a member" and "circle doesn't exist" so the endpoint isn't an existence oracle. (RLS alone can't distinguish "filtered everything out" from "genuinely a calm day".)
- Per-circle rate limit: a `narrator_rate_limits(circle_id, window_start, call_count)` table + an atomic `INSERT … ON CONFLICT DO UPDATE … WHERE call_count < limit` — one statement, so a concurrent burst can't overshoot. Consume the quota **before** calling the model. Table has RLS on with **zero policies** (deny-all); only the `security definer` function writes it.

**Non-diagnostic, in three layers — only one of which is the model:**
1. System prompt (soft, model-enforced).
2. Structured output schema (hard, API-enforced) — forces `{summary_ar, refused, refusal_reason, cited_values}`.
3. **A deterministic post-generation guard in the edge function (the real gate).** Checks a diagnostic/interpretive lexicon, a directive lexicon, numeric grounding (every digit-run in the output must exist in the input facts), comparator-adjacency, voice invariants (no `!`, no emoji, ≤60 words), and script (≥80% Arabic codepoints). Any failure → **discard the model text entirely** and return a machine code. Never patch or partially redact.
   - Scope the lexicon checks to tokens **not** present in the input facts, or a recorded note legitimately containing «مرتفع» false-positives.
   - Log only the failing category, never the text — it contains PHI.

**This is why the response must be buffered, not streamed.** A streamed sentence that interprets a blood-pressure reading is already on the caregiver's screen before the guard sees it. (Note: the usual RN objection is stale — Expo SDK 56 ships `expo/fetch` with real streaming support. The reason is the guard, not the transport.) Buffering also makes the output storable, so two family members see the *same* summary and a re-open costs zero tokens.

**Model:** `claude-haiku-4-5` — the workload is ~1–3K input tokens of structured facts → 150–300 output tokens, ≈$0.003–0.005/call. Put the model id in a config secret so it can be raised to `claude-sonnet-5` without a code deploy if Arabic instruction-following proves weak. Haiku 4.5 constraints: no adaptive thinking, no `output_config.effort`; structured outputs **are** supported (load-bearing for the guard).

**Data goes in the user turn as delimited structured data, never in the system prompt** — a caregiver can type anything into a daily-log note, which would otherwise be a prompt-injection surface. Strip `<`/`>` from free text before serialising.

**One law gets an explicit, flagged exception:** the generated `summary_ar` is model-authored at runtime and cannot come from i18n. It will be **the first user-facing Arabic in the app that is not an i18n value.** Everything else — every error, refusal, and the non-diagnostic disclaimer — is a machine code from the function rendered by the client from i18n. **The disclaimer is pinned by the UI below the narration, never emitted by the model** (if the model can write it, it can drop it).

**A first for this codebase:** there is **zero** `supabase.functions.invoke` in `src/` today, and no edge function parses a request body, handles CORS, or authenticates a user. That scaffolding is its own work item, not free.

**Open for you:** a monthly cost ceiling and a billing alert. I have a per-call cost but no per-circle/month projection; the 20/hour/circle limit is a starting guess.

---

## 6. Track C — plan only, build nothing

### C1 · Hired-caregiver supervision + worker companion

**The first work item is a blocker nobody has named:** the `caregiver` role **cannot be assigned today**. It is rejected server-side by `create_circle_invitation` (`20260610130100:93-95`) and `update_circle_member_role` (`:476-478`) with "this role is not available yet", excluded client-side from `ASSIGNABLE_ROLE_ORDER` (`role-capabilities.ts:23-28`), and blocked at delivery time by `notification_recipient_eligible`. C1's persona has no assignable role. Unblocking it is one migration + three client files, and it must come first.

**What already exists and works in C1's favour:**
- `canLogDoses()` already includes `caregiver` (`circle-selection/permissions.ts:9-16`).
- `medication_logs` RLS already permits a `caregiver` who is the medication's `responsible_user_id` to insert and update (`20260626161000:102-147`) — the exact permission a worker needs, already written.
- `notification_recipient_eligible` already allow-lists `caregiver` (`20260626164000:78-91`).
- A5's dose-photo infrastructure **is** the photo-proof mechanism. That is the deliberate overlap.

**What is genuinely new:** a shift/attendance model; a radically simplified single-purpose UI; and **multi-language support that the i18n layer cannot do today.**

**The i18n blocker is real and has four independent parts:**
1. `src/i18n/rtl.ts:7` is `const SHOULD_BE_RTL = true` — **not derived from language.** All four candidate worker languages are LTR. With `forceRTL` fixed on, a Tagalog UI would render entirely mirrored: `start`/`end` props flip, `flexDirection:'row'` runs right-to-left, and the two `I18nManager.isRTL` consumers actively invert (directional icons, date-picker column order). The text itself would shape fine; the chrome would be a mirror image. **And it can't be fixed live** — `forceRTL` only takes effect on the next launch by design, and the file deliberately refuses `Updates.reloadAsync()`.
2. **Cairo covers `arabic`, `latin`, `latin-ext` only** (verified in its `metadata.json`). Tagalog and Indonesian are fine. **Hindi (Devanagari) and Amharic (Ethiopic) are not covered** → tofu or a mismatched system fallback. Supporting them requires Noto Sans Devanagari / Noto Sans Ethiopic and a language-conditional `FontFamily` — which **violates the M6 "one typeface, never a second family" law.** That is a product decision, not an engineering one. Hence D11.
3. **All server-side push copy is hardcoded Arabic, outside i18next** (`_shared/messages.ts:12-52`, `_shared/digest.ts:30-56`). `profiles.locale` exists (default `'ar'`) but is **never read by any edge function**. A Filipino caregiver would get an app in Tagalog and *all notifications in Arabic*.
4. A second bilingual `{en, ar}` store exists in `src/constants/timezones.ts:12-13` — the type itself is a closed two-language shape.

Plus: 1102 keys in one flat namespace, all statically bundled — a fifth locale ships in every binary with no lazy loading. And **Arabic plurals are already wrong today**: 11 keys use `{{count}}`, six call sites pass `{count}`, and **zero** keys have plural suffixes, so «1 أدوية نشطة» renders where «دواء واحد نشط» belongs. That's a pre-existing defect worth fixing regardless of C1.

**The design constraint is the whole point.** This must read as shared work coordination that *protects* the worker — proof of good work, instructions in her language, rest and shift records — never as covert surveillance. Gulf domestic-worker law is tightening, and a surveillance framing is both an ethical and a legal problem. Concretely, in the design brief: the worker sees exactly what the family sees about her; there is no hidden tracking, no location, no silent capture; the shift log is *hers* as much as the family's; and photo-proof is framed as "your record that this was done", not "evidence for them". No location tracking, ever — that alone would recast the whole product.

**Estimate:** L+. Do not start before customer validation.

---

## 7. Scope I am adding or flagging

| # | Item | Status |
|---|---|---|
| 7.1 | **A8** — claim-flow trigger regression (§1.2) | Adding to Track A. Verified broken. |
| 7.2 | **A9** — missed-dose grace coherence (§1.3) | Adding to Track A. Verified. |
| 7.3 | **App icon + splash are still the Expo template.** `assets/images/` is stock; `app.json:11` iOS icon is `./assets/expo.icon` (the Expo symbol); the splash background is `#208AEF` — not a Dar colour. `AnimatedSplashOverlay` renders `expo-logo.png`. **Cannot ship.** Not in my brief; a visual work item for you. | Flagged, not built. |
| 7.4 | **Zero client telemetry.** No logger, no analytics, no crash reporter. Only four bare `console.*` calls exist, none in any auth file — every `catch` in the reset flow is silent. This is exactly why A1's failure modes were field-indistinguishable. Any real fix (Sentry) is a native dependency and a data-flow decision. | Flagged. Launching blind is a decision, not a default. |
| 7.5 | **Zero test infrastructure and zero CI.** No `jest`, no testing-library, no detox/maestro, no `.github/`, no `test` script. `package.json` scripts are `start / reset-project / android / ios / web / lint / check:mojibake`. Every Track A item is device-verify-or-nothing. | Flagged. §10 has the device QA checklist. |
| 7.6 | **No i18n parity guard.** Parity is convention only. Track A adds OTP + PDF + photo keys. | I'll add `scripts/check-i18n-parity.js` + an npm script alongside `check:mojibake`. Cheap and it pays for itself immediately. |
| 7.7 | **Privacy policy + Play Data Safety.** A5 adds camera/photos; B3 sends care data to a third-party model. All declarable. No privacy policy exists in-repo. | Flagged for you. |
| 7.8 | **No offline behaviour.** React Query is memory-only (`{retry:2, staleTime:30_000}`, no persister, no `networkMode`), mutations aren't queued, `expo-sqlite` is installed but has **zero imports** — dead weight forcing a native module into every build. A photo upload or PDF generation on a poor connection has no defined behaviour. | Flagged. Consider dropping `expo-sqlite` from `app.json` plugins. |
| 7.9 | **Posture discrepancy.** CLAUDE.md's A1 "transparent circle" says every active member sees all operational data. The actual RLS since `20260626161000` scopes `care_tasks`, `care_appointments`, `medication_logs`, and `family_visits` SELECT to `can_view_all_operational` (admin/primary_caregiver/**remote_member** only) OR own-row. Transparency is delivered only through the SECURITY DEFINER RPCs. Worth reconciling the doc with the code. | Flagged. |

---

## 8. Build order, risk, estimates

### Order and dependencies

```
A2 (audit fix) ─┐
A3 (SDK patch) ─┴─▶ must both land BEFORE the EAS rebuild
                     │
A6 (cast #6)         │   independent, do anytime
A7 (rename audit)    │   independent, doc only
A8 (claim trigger)   │   independent migration FILE
A9 (grace)           │   independent function change
A1 (OTP)             │   independent — no native dep
                     ▼
              ┌──────────────────────────────┐
              │ A4 SPIKE (throwaway Expo Go) │  ← GATE: verify Cairo + RTL on device
              └──────────────┬───────────────┘
                             ▼
      install expo-print, expo-sharing, expo-image-picker,
      expo-image-manipulator, expo-file-system  +  app.json plugin entry
                             │
                    ONE EAS development build
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
          A4 (PDF)                  A5 (dose photo)
```

**A4 and A5 are gated on the same decision and the same rebuild — batch them.** Everything else is independent and ships first.

### Estimates

| Item | Size | Note |
|---|---|---|
| A2 | S | one command + verification |
| A3 | S | ten packages + verification |
| A6 | XS | one cast; the rest waits on D3 |
| A7 | S | audit done; write-up only |
| A8 | S | one migration file |
| A9 | S | one function + a shared helper |
| A1 | **M** | biggest client item; new screen phase + copy + deep-link repair |
| A4 | **M–L** | spike + template + adherence derivation |
| A5 | **M** | migrations + upload path + thumbnails in 3 surfaces |
| A10 | M | *if you approve D7* |
| B1/B2/B3 | — | design brief only this milestone |
| C1 | — | plan only |

### Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Cairo doesn't embed in the PDF on a real device | High → A4 | The Expo Go spike **before** the rebuild. Degrades to system Arabic, never to broken text. |
| Android WebView print regression on a specific device | Med → A4 | Test on ≥2 physical Android devices. Not controllable from the app. |
| OTP path blocked by the 2-emails/hour cap | **High → A1** | Custom SMTP (D6) is a hard prerequisite. |
| The email template edit is missed or partial | High → A1 | Runbook R1 is explicit that `{{ .ConfirmationURL }}` must be **removed**, not just supplemented. |
| Storage policies fail via `db push` (`42501`) | Med → A5 | Split into two files; storage SQL lives in `docs/deployment/`, Dashboard-only, never in `supabase/migrations/`. |
| A5 leaks photos to non-responsible members | **High → A5** | Path carries `medication_id`; policy mirrors the live `medication_logs` predicate exactly. Called out as D10. |
| Occurrence math already lives in 4 unshared places | Med → B2 | Consolidate into `_shared/` before any anchor work, or the drift is 4-way. |
| Everything is device-only verifiable | Med → all | §10 QA checklist; §7.6 adds the parity guard. |

---

## 9. Track A — running record

Updated as each item lands. Quartet = `tsc` · mojibake · `diff --check` · ar/en parity.

| Item | Commit | Quartet | Notes |
|---|---|---|---|
| Setup | — | ✅ baseline: tsc 0 · mojibake clean (257) · diff clean · parity 1102=1102 | Worktree created off `master` @ `88a44aa`; branch renamed `milestone-7-prelaunch`; `node_modules` de-junctioned to an isolated `npm ci` so A2/A3 cannot desync the main checkout. |
| Plan | `d49853b` | n/a | This document. |
| **A1** | `57ea47c` | ✅ tsc 0 · mojibake clean (257) · diff clean · **parity 1118=1118** | Shipped all three fixes. Found a **third** bug during implementation: `PendingJoinLink` (root-mounted) replaces the route to `/join-circle` the instant a session exists — which is exactly when a recovery completes — so it would yank the user off `/reset-password` with the token already spent. Guarded on `usePathname()`. Also closed the security smell where the no-token fallback accepted any existing session as "ready". +17 i18n keys, −1 (`auth.forgotSent`, now unused). **Lint note:** master's baseline is 32 problems / 28 errors; this branch is 31 / 27. The one error inside a file I touched (`pending-join-link.tsx` setState-in-effect) is pre-existing — same statement, shifted line. Lint is not in the quartet and was already failing on `master`. |
| **A2** | `91f93e1` | ✅ tsc 0 · lint unchanged · quartet unaffected (no source change) | See the A2 addendum below — the raw count rose while the actual posture improved. |
| **A3** | `672958c` | ✅ tsc 0 · mojibake clean · diff clean · parity 1118=1118 · lint 31/27 (unchanged) | All 10 packages now at their SDK-56 targets; `npx expo install --check` = **"Dependencies are up to date"**; `npx expo-doctor` = **21/21 checks passed**. See the A3 addendum below — only 7 declarations moved, and `--fix` also edited `app.json`. |
| **A6** (partial) | `8f7f180` | ✅ tsc 0 · mojibake clean · parity 1118=1118 | Removed cast #6 only. Verified all six Phase-2E claim RPCs **are** in the current generated file (`:1254`–`:1674`), so the `supabase as unknown as { rpc }` wrapper was already unnecessary and its "not yet in the generated types" comment was stale. One narrowing cast remains — on the **result**, not the client — because `supabase gen types` emits every `RETURNS TABLE` column as non-nullable `string`. **Casts 1–5 still stand**; they need the regen (runbook R3). |
| **A7** | `7b1b67d` | n/a (doc) | Full inventory at `docs/claude-reports/2026-07-26-rename-readiness-audit.md`. **Nothing renamed.** Line numbers re-verified *after* A1 and A3 shifted them. |
| **A8** | `3ccb3a2` | n/a (migration file, not applied) | `supabase/migrations/20260726120000_restore_claim_bypass_in_care_task_trigger.sql`. Runbook R4. |
| **A9** | `d832677` | ✅ tsc 0 (edge functions are outside tsconfig — every symbol verified by hand instead) | `fetchCircleGrace()` lifted into `_shared/enqueue.ts`; `enqueue-due-reminders` now expires a due reminder on the **circle's own** grace. `REMINDER_CONFIG.missedDoseGraceMinutes` (60) → `missedDoseGraceFallbackMinutes` (30, matching the DB default); it had exactly one consumer, which was the bug. Needs a redeploy — runbook R5. |
| **A5** (server half) | `ba6edac` | n/a (files only, not applied) | `supabase/migrations/20260726130000_dose_proof_helpers.sql` + `docs/deployment/dose-proof-storage.sql`. Runbook R6. **Client half not started** — needs the rebuild. |
| **+ i18n parity guard** | `15254a4` | ✅ passes at 1118 leaf keys | §7.6. `npm run check:i18n`. Negative-tested against all four defect classes; each fails, the clean control passes. |
| **+ Design brief** | `46b7b56` | n/a (doc) | `docs/design/DESIGN_BRIEF_MILESTONE_7.md` — **33 frames** across B1/B2/B3/C1, written and then passed through a consistency review (20 defects corrected, including a cream-on-cream token pairing and six gendered imperatives). |
| **A10** | `159f2a1` | ✅ tsc 0 · mojibake clean · **parity 1138=1138** · diff clean · lint 31/27 | In-app account deletion. Found the real hazard while building it: `care_circles.owner_id → profiles(id) ON DELETE CASCADE` and `profiles.id → auth.users(id) ON DELETE CASCADE`, so deleting an account destroys **every circle the user owns and everything in it** — other members' data included. Gated behind a server-authoritative preflight that blocks that case. First user-invoked edge function in the project; adds `userClient()` and `_shared/http.ts` (CORS), which B3 inherits. Runbook R8. |
| **A4 spike** | `7ccf7b1` | n/a (investigation) | **PASSED — proceed with the rebuild.** Full findings + the device spike snippet: `docs/claude-reports/2026-07-26-a4-pdf-font-spike.md`. |
| A4 (build) | **not started** | | Spike cleared it; now gated only on the EAS rebuild. |
| A5 (client half) | **not started** | | Gated on the EAS rebuild. |

### A4 spike result — Cairo embeds, Arabic shapes, one page

Android's `expo-print` renders through `WebView` → `createPrintDocumentAdapter` → **Chromium's Skia PDF backend**, which is the same backend and the same HarfBuzz shaper desktop headless Chrome uses for `--print-to-pdf`. So the decisive questions were answerable here, without a device and without spending the rebuild first.

Rendered the real HTML shape (both Cairo weights inlined as base64 `@font-face`, `dir="rtl"`, A4 geometry, real summary content) through **Chrome 150**, then inspected the PDF:

- **Cairo is embedded** — `/BaseFont /AAAAAA+Cairo-Bold` and `/BAAAAA+Cairo-Regular`, subsetted CIDFontType2 with `/FontFile2` programs. The 68 KB PDF is *smaller* than the 246 KB of font that went in, which only happens if Chrome parsed and subsetted it.
- **The text is real Unicode** — `/ToUnicode` maps present, so it selects and copies out. Not outlines.
- **Shaping is correct** — lam-alef ligature (`لا · للأسف · إلا · الآن`), all four contextual forms of ع, and tashkeel all render. This is exactly what `@react-pdf/renderer` gets wrong (its open issue #3197: the ligature "may disappear entirely").
- **Exactly one page**, disclaimer clearing the bottom margin. `expo/expo#7435`'s phantom trailing page does not bite at this volume.
- **The negative control worked** — a deliberately-broken `font-family:'DoesNotExist',serif` line fell back to Times while the Arabic body stayed Cairo. Had Cairo failed, the whole document would look like that line.

**Residual risk, all device-specific and all benign:** the font-ready race (`onPageFinished` vs async `data:` font install — no network involved, but the ordering stands), Android WebView version variance (crbug 1334127), and iOS's entirely separate WKWebView/CoreText path. **In every case the failure mode is correct joined Arabic in the system typeface — never tofu, never broken text.** That is what makes the rebuild a reasonable bet.

| A10 follow-up | | | The **publicly reachable web deletion URL** is still required by Play and is not code — runbook R8. |

### A2 addendum — why the vulnerability count went UP

`npm audit fix` (no `--force`) took the report from **15 (11 moderate, 4 high)** to **20 (11 moderate, 9 high)**. That reads like a regression. It isn't — npm re-classified one finding and then enumerated its dependents.

**Genuinely fixed — 3 of the 4 high advisories are gone:**

| Package | Before | After | Advisory cleared |
|---|---|---|---|
| `js-yaml` | 4.2.0 | **4.3.0** | GHSA-52cp-r559-cp3m |
| `postcss` | 8.5.15 | **8.5.23** | GHSA-r28c-9q8g-f849 |
| `shell-quote` | 1.8.4 | **1.10.0** | GHSA-395f-4hp3-45gv |
| `brace-expansion` (root) | 5.0.6 | **5.0.8** (latest published) | GHSA-3jxr-9vmj-r5cp — and `node_modules/brace-expansion` no longer appears in the flagged path list at all |

**What remains:** five *nested* `brace-expansion@1.1.16` copies under eslint tooling (`eslint`, `@eslint/config-array`, `@eslint/eslintrc`, `eslint-plugin-import`, `eslint-plugin-react`), flagged by **GHSA-mh99-v99m-4gvg** — for which npm reports **"No fix available"** on the 1.x line (5.0.8 is the newest published version overall and is already installed at the root). Before the fix npm collapsed these under "fix available via `npm audit fix`"; now that no fix exists it enumerates the whole chain — brace-expansion → minimatch → @eslint/config-array → eslint → eslint-plugin-expo → eslint-config-expo, plus @eslint/eslintrc, eslint-plugin-import, eslint-plugin-react = **9 entries**. Nine report lines, one underlying advisory, zero new exposure.

**Deliberately left, with reasons:**
1. **The `brace-expansion` chain.** An `overrides` pin to `^5.0.8` would clear it, but it forces a 1.x→5.x major into `minimatch@3.x`, which declares `^1.1.7`. That risks breaking `expo lint` — the only automated quality gate this repo has (§7.5) — to silence a DoS-via-crafted-brace-pattern in a linter that only ever parses this repo's own glob patterns. Not worth it.
2. **The `uuid` chain (11 moderate).** Reachability analysis in §4.2. Unchanged.
3. **`npm audit fix --force`.** Re-confirmed on the live tree: it still proposes `expo@46.0.21`. Never run it here.

Verification after the fix: `tsc --noEmit` = 0; `expo lint` = 31 problems / 27 errors, **identical** to before the fix (and one fewer than master's 32/28). Only `package-lock.json` changed; `package.json` is untouched.

### A3 addendum — 10 packages moved, 7 declarations changed, and `app.json` was edited

Ran `npx expo install --fix`. All ten packages reached their SDK-56 targets:

| Package | Before | After | `package.json` changed? |
|---|---|---|---|
| `expo` | 56.0.12 | **56.0.17** | no — `~56.0.12` already permitted it |
| `expo-constants` | 56.0.18 | **56.0.22** | no — `~56.0.17` already permitted it |
| `expo-splash-screen` | 56.0.10 | **56.0.14** | no — `~56.0.10` already permitted it |
| `@expo/ui` | 56.0.18 | **56.0.23** | yes |
| `expo-dev-client` | 56.0.20 | **56.0.24** | yes |
| `expo-linking` | 56.0.14 | **56.0.16** | yes |
| `expo-notifications` | 56.0.18 | **56.0.22** | yes |
| `expo-router` | 56.2.11 | **56.2.16** | yes |
| `expo-web-browser` | 56.0.5 | **56.0.6** | yes |
| `react-native-screens` | 4.25.2 | **4.26.2** | yes (`4.25.2` → `~4.26.0`) |

Three packages upgraded *inside* their existing `~` ranges, so only seven declarations moved — which is why `--fix` reported "Installing 7 SDK 56.0.0 compatible native modules" for a ten-package drift.

**`--fix` also modified `app.json` on its own**, appending `"expo-web-browser"` to `expo.plugins`. I verified this is legitimate rather than noise: `node_modules/expo-web-browser/app.plugin.js` exists in 56.0.6, so the package now ships a required config plugin and Expo's tooling adds the entry. **Consequence: it needs a native rebuild to take effect** — folded into the A4/A5 rebuild batch, so it costs nothing extra. (`expo-web-browser` is used only by `src/components/external-link.tsx`, which currently has zero call sites.)

**A1 cross-check:** `expo-linking` moved 56.0.14 → 56.0.16, and A1 depends on its API. Re-verified in the bumped build: `useLinkingURL()` is still exported, and `useURL()` still carries `@deprecated Use useLinkingURL hook instead`. The A1 fix stands.

Post-verification: `npx expo install --check` = "Dependencies are up to date"; `npx expo-doctor` = **21/21 checks passed, no issues detected**; `tsc --noEmit` = 0; parity 1118=1118; lint unchanged at 31/27.

---

## 9b. APPLIED TO PRODUCTION — 2026-07-26

Authorized batch, executed against `qccgshanmoeybagxwvcs` via `supabase db query --linked` (Management API, access token — **no DB password was needed or used**) and `supabase functions deploy --use-api`.

| Step | What | Result |
|---|---|---|
| **R0** | A8 claim-trigger fix | **Applied.** Pre-check confirmed the bug live: `enforce_care_task_collaborator_scope` had `has_bypass=false, has_cancelled_by=true`, while the untouched visit trigger had `true/false` — exactly the predicted partial failure. After: **`true/true`**. |
| **R5** | `enqueue-due-reminders` (A9 grace fix) | **Deployed v3 → v4.** Unauthenticated POST still returns **401**, so `authorizeScheduledRequest` fails closed and cron is unaffected. |
| **R8** | A10 preflight migration + `delete-account` | **Applied + deployed v1 ACTIVE.** RPC is SECURITY DEFINER, returns TABLE, `authenticated` can execute. Auth gate: unauthenticated **401**, garbage bearer **401**. |
| **R6** | A5 storage | **Smoke test passed** (create/drop policy on `storage.objects` succeeded, zero leftovers) → **R6.1** column + CHECK + helper, with `storage_path_uuid('not-a-uuid/…')` confirmed returning **null rather than raising** → **R6.2** private bucket (2 MiB, jpeg/png/webp) + **all four policies**. SELECT verified to carry **both** the `can_view_all_operational` arm and the `is_responsible_for_medication` arm; INSERT verified responsibility-scoped **and** `is_circle_medication`-guarded. |
| **R3** | Regenerate types, clear casts | **Done.** All 8 missing symbols present. Every Supabase client cast removed. Caught a latent bug — see below. |

Final state: `a8_bypass_restored=true` · `a8_cancelled_by_kept=true` · `a10_rpc=1` · `a5_column=1` · `a5_helper=1` · `a5_private_bucket=1` · `a5_policies=4` · `leftover_throwaways=0` · `m7_versions_recorded=3` · existing data untouched (`medication_logs=21`, `care_circles=1`).

### Three findings from doing it for real

1. **The remote migration history had exactly ONE row** (`20260607033000`). Everything since was applied via the Dashboard, which records nothing. So **`supabase db push` would have tried to replay ~27 migrations** — I used `db query -f` per file instead and recorded this milestone's three versions explicitly. The history is still incomplete for everything between; worth backfilling before anyone runs `db push` again.
2. **`revoke all … from public` does not remove `anon` EXECUTE.** Verified repo-wide: `is_circle_member`, `has_circle_role`, `can_view_all_operational`, `claim_care_task`, `list_available_to_claim` and the new `account_deletion_preflight` are **all** anon-executable, because Supabase's default privileges on `public` grant EXECUTE to `anon` and the house `revoke … from public` only revokes the PUBLIC pseudo-role. Not exploitable — every one of them keys off `auth.uid()`, which is NULL for anon, so they return nothing — but the defence-in-depth those `revoke` lines were meant to provide is not actually engaged. A one-line `revoke execute … from anon;` per function would close it. **Not changed here** — it is a pre-existing, repo-wide pattern and changing only the new function would create an inconsistency.
3. **The type regeneration caught a live bug.** `daily_summary` became a real union member and `tsc` failed on two `Record<NotificationType, …>` maps missing it. Both read through a `?? …system` fallback, which is why it went unnoticed: **the nightly digest has been rendering with the generic bell and the label «تحديث» since it went live.** Fixed. The new i18n parity guard also earned itself, failing the ar-only first pass before tsc could.

## 10. Maintainer runbook (nothing here is auto-applied)

Project ref: `qccgshanmoeybagxwvcs`. **I will not run any of these.** Each needs your explicit approval of the exact command.

### R0 — ⚠️ URGENT, do this first: A8, the live claim regression
`20260715120000` **is applied in production** (confirmed 2026-07-16), so
`enforce_care_task_collaborator_scope()` currently has no `sanad.in_claim` bypass and
**no `family_member` or `caregiver` can claim a task today.** Visit claiming still works,
so the symptom looks like a task-specific bug rather than a regression.

Apply `supabase/migrations/20260726120000_restore_claim_bypass_in_care_task_trigger.sql`,
then run the verification query in its footer (expects `has_bypass = t` **and**
`has_cancelled_by = t`), then confirm on device that a `family_member` can claim a task.

This supersedes the old R4; nothing else in Milestone 7 needs to land first.

### R1 — A1: Reset Password email template (Dashboard → Authentication → Emails → Templates)
Replace the body so it renders `{{ .Token }}` and **remove the `{{ .ConfirmationURL }}` line entirely.** Leaving it in keeps a prefetchable URL alive, and a scanner GET on it burns the same `recovery_token` that the printed 6-digit code uses — invalidating the code too.

Then: Authentication → Sign In / Providers → Email → confirm **Email OTP Expiration = 3600** and OTP length = 6. (Note: that expiry is *shared* with signup/invite/email-change.)

### R2 — A1: custom SMTP (hard prerequisite)
The built-in provider caps `/auth/v1/recover` at **2 emails per hour, project-wide**. Configure custom SMTP before launch.

### R3 — A6: regenerate types
```
npx supabase gen types typescript --project-id qccgshanmoeybagxwvcs > src/types/supabase.ts
```
Run after R0 confirms the migrations are applied, then tell me and I'll clear casts 1–5.

### R4 — A8: apply the claim-trigger fix
Apply `supabase/migrations/<ts>_restore_claim_trigger_bypass.sql` via the Dashboard SQL Editor, then verify a `family_member` can claim a task.

### R5 — A9: redeploy the reminder producer
```
supabase functions deploy enqueue-due-reminders --project-ref qccgshanmoeybagxwvcs
```

### R6 — A5: storage (strictly in this order)
1. **Smoke test first.** In the Dashboard SQL Editor, run the throwaway pair at the top of `docs/deployment/dose-proof-storage.sql`:
   `create policy "zz_throwaway" on storage.objects for select to authenticated using (false);` then `drop policy "zz_throwaway" on storage.objects;`
   If that succeeds, the real policies will. If it raises `42501`, stop and create them from Storage → Policies instead (the predicates paste in unchanged).
2. **R6.1** — Dashboard SQL Editor: `supabase/migrations/20260726130000_dose_proof_helpers.sql` (public schema: the column, its scoping CHECK, and `storage_path_uuid`).
3. **R6.2** — Dashboard SQL Editor: `docs/deployment/dose-proof-storage.sql` (bucket + the four `storage.objects` policies). **Never `db push` this file** — it is deliberately outside `supabase/migrations/`.
   Order matters: every policy calls `public.storage_path_uuid()`, so R6.2 before R6.1 fails with "function does not exist".
4. Run the read-only verification queries at the bottom of that file, then the three-account device check (manager · responsible member · **a family_member who is NOT responsible for that medication — their `createSignedUrl` must fail**).

### R8 — A10: account deletion (Play blocker)
1. Apply `supabase/migrations/20260726140000_account_deletion_preflight.sql`.
2. Deploy the function — note it is the **only** one that must keep JWT verification ON:
   ```
   supabase functions deploy delete-account --project-ref qccgshanmoeybagxwvcs
   ```
   Deploying from this repo preserves `supabase/config.toml`, where `[functions.delete-account] verify_jwt = true` is set **explicitly** rather than left to the default, so a neighbouring `verify_jwt = false` block can never be copied onto it by accident.
3. **Verify the auth gate before trusting it** — an unauthenticated call must be rejected:
   ```
   curl -s -o /dev/null -w "%{http_code}" -X POST <FUNCTIONS_BASE_URL>/delete-account     # expect 401
   ```
4. **Host the public web deletion URL.** Play requires a publicly reachable page — not behind a login — that explains how to request account deletion and what data is removed. This is a hosting task, not code. It must be listed in the Play Console Data Safety form.
5. Device check with a throwaway account: (a) an account owning a circle **with another active member** must be **refused** and shown the transfer-ownership path; (b) after transferring ownership, deletion succeeds; (c) a solo account deletes and lands on sign-in; (d) confirm the circle's data is actually gone.

### R7 — the EAS rebuild (after A2, A3, and the A4 spike)
```
eas build --profile development --platform android
```
Then distribute the new dev client to every device — the existing binary does not contain the new native modules, and a Metro reload will not pick them up.

### Device QA checklist (nothing below is provable by `tsc` or on web)
- **A1:** forgot password → 6-digit code arrives → correct code works → wrong code shows the distinct error → expired code shows the distinct error → resend respects the countdown → new password signs in. Then the **legacy link path**: cold start *and* app-already-open.
- **A3:** cold start, tab navigation, one push notification with action buttons still rendering.
- **A4:** generate on ≥2 Android devices + one iPhone. Arabic glyphs join; it's Cairo not system Arabic; exactly one page; text selects out as real Unicode; the share sheet offers the PDF.
- **A5:** attach a photo from camera *and* gallery; thumbnail renders in the dose row, on Home, and in the Pulse; a non-member cannot fetch the signed URL; a `family_member` who is not responsible for that medication cannot either.
- **A8:** a `family_member` claims a task successfully.
- **Standing guard:** `grep -rnE "style=\{\(\{\s*pressed" src/` must return **only** `app-tabs.web.tsx`.
