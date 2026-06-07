# Step 0.3 — Arabic-first polish + RTL readiness + minimal Sanad identity

**Date:** 2026-06-07
**Scope:** Substeps A + B + C (Arabic default, safe RTL readiness, Sanad Home placeholder, shell rebrand)
**Status:** Implemented and validated. Not committed (per instructions).

---

## Summary

The app now starts in **Arabic by default**, regardless of the device/browser language, while **English remains fully loaded** as the i18next fallback (and can be switched to later). **RTL readiness** is wired in a deliberately safe way — no `Updates.reloadAsync`, no reload loops:

- **Native:** the documented static flag `expo.extra.supportsRTL: true` plus a **guarded, one-shot** `I18nManager.forceRTL` that takes effect on the next app launch (restart caveat documented).
- **Web:** `<html dir="rtl" lang="ar">` is set imperatively (outside React's tree), so it cannot cause a hydration mismatch with the statically rendered HTML.

The Expo Starter Home screen was replaced with a minimal **Arabic Sanad landing/dashboard placeholder** (static "coming soon" cards, no logic, no data fetching), and the visible **"Expo Starter"** web shell branding plus its **Expo Docs link** were replaced with the localized `appName` / removed.

A full **static web export smoke test passed (exit 0)**, rendering all 12 routes including the new Home and both auth screens.

---

## Files created

| File | Purpose |
| --- | --- |
| `src/i18n/rtl.ts` | Native RTL bootstrap. Guarded `allowRTL`/`forceRTL` (no reload). Resolved by Metro on iOS/Android. |
| `src/i18n/rtl.web.ts` | Web RTL bootstrap. Sets `document.documentElement.dir = 'rtl'` / `lang = 'ar'` with a `typeof document` SSR guard. Resolved by Metro on web. |
| `docs/claude-reports/2026-06-07-step-0-3-arabic-rtl-polish.md` | This report. |

## Files modified

| File | Change |
| --- | --- |
| `src/i18n/index.ts` | Initial language hard-set to `'ar'` (was device-derived); `fallbackLng: 'en'` kept; calls `applyRTL()` after init. |
| `src/app/(app)/index.tsx` | Replaced Expo starter Home with the Arabic Sanad placeholder (header + three static "coming soon" cards). |
| `src/components/app-tabs.web.tsx` | Brand text `"Expo Starter"` → `t('appName')`; removed the Expo Docs `ExternalLink` (and now-unused imports); `brandText` margin switched to the logical `marginEnd` for RTL. |
| `src/locales/ar.json` | Added the `home.*` block (greeting, tagline, comingSoon, three sections). |
| `src/locales/en.json` | Added the matching English `home.*` block (fallback parity). |
| `app.json` | `name`: `"sanad-mobile"` → `"Sanad"`; added `extra.supportsRTL: true`. |

> Note: `expo-localization` is still listed as a plugin in `app.json`; `src/i18n/index.ts` no longer imports `getLocales()` because the initial language is now fixed to Arabic.

---

## Commands run

```bash
npx tsc --noEmit                                   # type-check (gate)
git status --short                                 # working-tree state
git diff --stat                                    # change summary
npx expo export --platform web --output-dir <temp> # web smoke test (exported outside repo, then removed)
```

## TypeScript result

`npx tsc --noEmit` → **no output, no errors** (clean under `"strict": true`).

## Web smoke test result

`npx expo export --platform web` → **EXIT_CODE=0**. Static rendering enabled; bundled successfully and produced all **12 static routes**, including:

- `/` (new Sanad Home)
- `/sign-in`, `/sign-up` (auth screens still build — routing unchanged)
- `/account`, `/explore`, `/(app)/*`, `/(auth)/*`

This confirms the web RTL module resolves correctly and that **server-side static rendering does not crash** — i.e. the `typeof document` guard in `rtl.web.ts` works. The export was written to a temp directory outside the repo and deleted afterward, so the working tree stayed clean.

---

## Functional changes

1. **Arabic is the default language** on every launch, independent of device/browser locale. English strings are still bundled and used as the per-key fallback.
2. **RTL layout direction** is requested app-wide (see caveats below for native timing).
3. **Home screen** is now a Sanad-branded Arabic placeholder: a large greeting (`home.greeting`), a tagline (`home.tagline`), and three non-interactive cards — Care circle, Tasks & appointments, Reminders — each tagged "قريباً / Coming soon". No navigation, no care-circle logic, no Supabase calls.
4. **Web app shell** shows the localized app name ("سند") instead of "Expo Starter", and the Expo Docs link is gone.
5. **Native app display name** is now "Sanad".

### Accessibility

- Greeting uses `accessibilityRole="header"`.
- Readable type sizes: greeting 48, card titles 20, body/tagline 16–18 with generous line-height.
- Cards have `minHeight: 96` and ample padding; content is centered with `maxWidth` for large screens/tablets/web.

---

## RTL behavior and caveats

**Native (iOS/Android)** — `src/i18n/rtl.ts`:
- Sets `extra.supportsRTL: true` (static, the v56-documented enablement) and calls `allowRTL(true)` + `forceRTL(true)` **only when** `I18nManager.isRTL` does not already match. This is a one-shot guard → **no reload loop**, and we **never call `Updates.reloadAsync()`**.
- **Restart caveat:** because we don't force a reload, on a device whose system language is LTR (e.g. an English phone) the **first session** renders with an **LTR layout** (Arabic *text* still displays correctly). The layout flips to RTL on the **next manual app restart**. On an Arabic device, `isRTL` is already true, so this is a no-op.
- **Expo Go caveat:** Expo Go resets RTL preferences when returning to the launcher, so verify native RTL in a **dev client or a build**, not Expo Go.

**Web** — `src/i18n/rtl.web.ts`:
- Sets `<html dir="rtl" lang="ar">` imperatively after load. Because it is applied to the document element (not a React-rendered node) and guarded by `typeof document !== 'undefined'`, it is safe under static rendering and does not trigger a hydration mismatch. Effective immediately on page load.

---

## How to test manually

**Web (fastest):**
```bash
npm run web   # expo start --web
```
- Confirm the page is **right-to-left**: inspect `<html>` → it should have `dir="rtl" lang="ar"`.
- Home shows "أهلاً بك في سند", the tagline, and three cards each with "قريباً".
- The top web tab bar shows the brand "سند" (not "Expo Starter") and **no Docs link**.
- Tabs (الرئيسية / استكشاف / الحساب) navigate; sign-out from الحساب returns you to the sign-in screen.

**Native (iOS/Android) — use a dev client or build, not Expo Go:**
```bash
npm run ios    # or: npm run android
```
- On an Arabic-locale device/simulator: layout is RTL immediately; Home + tabs are Arabic.
- On an English-locale device: text is Arabic immediately; the **layout** becomes RTL after you fully **close and reopen** the app once (documented restart caveat).

**Auth regression check:** sign out → you land on `/sign-in` (Arabic). Sign in / sign up still work; routing is unchanged.

---

## Known risks / assumptions

- **First-launch LTR layout on LTR-locale native devices** until one restart — an intentional trade-off to avoid `reloadAsync`/reload loops (see caveats). Acceptable for "readiness"; a later step can add an explicit, user-initiated restart prompt if desired.
- **`extra.supportsRTL` fully applies after prebuild/EAS build** for standalone apps; it is honored in dev. No native rebuild was run here.
- **Partial mirroring of untouched screens.** `explore.tsx` is still Expo-starter content (English) and other screens use some physical-direction styles; under RTL they mirror but were **out of scope** for this step. Only the touched files were adjusted (e.g. `brandText` → `marginEnd`).
- **`name` change to "Sanad"** affects the native display name only; `slug` (`sanad-mobile`) and the EAS identity are unchanged.
- Assumed it is acceptable to drop the device-language detection now (Arabic-only default for this phase); the machinery to switch to English later is still present (`en` resources + `fallbackLng`).
- No changes to Supabase migrations, auth logic, AI, notifications, payments, phone OTP, or care-circle logic, per scope.

---

## Git status summary

8 code/config paths changed (6 modified, 2 new), plus this report:

```
 M app.json
 M src/app/(app)/index.tsx
 M src/components/app-tabs.web.tsx
 M src/i18n/index.ts
 M src/locales/ar.json
 M src/locales/en.json
?? src/i18n/rtl.ts
?? src/i18n/rtl.web.ts
?? docs/claude-reports/2026-06-07-step-0-3-arabic-rtl-polish.md
```

`git diff --stat` (tracked files only): **6 files changed, 142 insertions(+), 106 deletions(-)**. Not committed.

> Cosmetic: Git warned `LF will be replaced by CRLF` on the edited files (Windows line-ending normalization) — no content impact.

---

## Recommended next step

**Step 0.4 — Language toggle + finish RTL polish on remaining screens.** Concretely:
1. Add a small Arabic⇄English switcher (e.g. on the Account screen) using `i18n.changeLanguage`, and persist the choice (the toggle is the natural place to surface a "restart to apply layout direction" prompt on native).
2. Sweep `explore.tsx` and shared components for physical-direction styles (`marginLeft/Right`, `textAlign`, `left/right`) → logical (`marginStart/End`, `start/end`) so the remaining screens mirror cleanly.
3. Localize/replace the remaining Expo-starter content on `explore.tsx`.
