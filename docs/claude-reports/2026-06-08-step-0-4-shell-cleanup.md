# Step 0.4 — Shell cleanup: remove remaining Expo starter UI + polish app shell

**Date:** 2026-06-08
**Scope:** Replace remaining Expo-starter UI (Explore), polish Account and the auth screens (Arabic-first, RTL-friendly, accessible). No routing/migration/Supabase-logic changes.
**Status:** Implemented and validated. Not committed (per instructions).

---

## Summary

The last of the Expo starter UI is gone and the existing screens are polished to match the Arabic-first, RTL-ready shell from Step 0.3:

- **Explore** (`src/app/(app)/explore.tsx`) was a wall of Expo starter content (collapsibles about file-based routing, the Expo docs link, the Expo badge). It is now a simple Arabic **"استكشاف"** placeholder — a header plus three non-interactive "قريباً / Coming soon" cards for future features — mirroring the Home screen built in 0.3.
- **Account** is centered/width-capped for web, gets a header role and a localized email fallback, and its sign-out is now **failure-safe** (the button no longer hangs if `signOut` returns an error).
- **Sign-in / Sign-up** keep their auth logic **byte-for-byte**, but gain web width-capping/centering, grouped field spacing, header roles, and screen-reader-friendly error/notice announcements.
- The orphaned, Expo-branded **`web-badge.tsx`** component was deleted (its only consumer was Explore).

Validation: `npx tsc --noEmit` is clean and a full static **web export passed (exit 0)** with all 12 routes; the web JS bundle shrank ~3 MB → ~2.8 MB after dropping the starter content.

---

## Files created

| File | Purpose |
| --- | --- |
| `docs/claude-reports/2026-06-08-step-0-4-shell-cleanup.md` | This report. |

## Files modified

| File | Change |
| --- | --- |
| `src/app/(app)/explore.tsx` | Full rewrite: Expo starter content → Arabic "استكشاف" placeholder (header + three static "coming soon" cards). Removed all Expo imports (`Collapsible`, `ExternalLink`, `WebBadge`, `expo-image`, `expo-symbols`). |
| `src/app/(app)/account.tsx` | Centered + `MaxFormWidth`; title `accessibilityRole="header"`; email is `selectable` with a localized `account.noEmail` fallback; **robust sign-out** (handles the returned error, resets the spinner, shows `account.signOutError` via an `alert` live region); button `accessibilityState`. |
| `src/app/(auth)/sign-in.tsx` | Web width-cap/centering (`MaxFormWidth`, `alignSelf`); grouped label+input fields with clearer spacing; title header role; error as `accessibilityRole="alert"` + live region; `textContentType` on inputs; button `accessibilityState`. **Auth logic unchanged.** |
| `src/app/(auth)/sign-up.tsx` | Same polish as sign-in, plus a live-region on the "check your email" notice. **Auth logic unchanged.** |
| `src/constants/theme.ts` | Added `MaxFormWidth = 480` (shared by account + both auth screens). |
| `src/locales/ar.json` | Added `explore.*` block; added `account.noEmail` and `account.signOutError`. |
| `src/locales/en.json` | Added the matching English `explore.*`, `account.noEmail`, `account.signOutError` (fallback parity). |

## Files deleted

| File | Reason |
| --- | --- |
| `src/components/web-badge.tsx` | Expo-branded "v{expo version} + Expo badge" component. Its only consumer was Explore; now unused → removed to eliminate the last visible Expo branding. |

> Left in place intentionally: `external-link.tsx` and `ui/collapsible.tsx` are generic, reusable primitives (not Expo-branded) — kept for future use. `hint-row.tsx` was already orphaned in Step 0.3 and is out of this step's scope.

---

## Commands run

```bash
npx tsc --noEmit                                      # type-check (gate)
git status --short                                    # working-tree state
git diff --stat                                       # change summary
git log --oneline -6                                  # confirm 0.3 was committed
npx expo export --platform web --output-dir <temp>    # web smoke test (outside repo, then removed)
```

## TypeScript result

`npx tsc --noEmit` → **no output, no errors** (clean under `"strict": true`).

## Web smoke test result

`npx expo export --platform web` → **EXIT_CODE=0**. All **12 static routes** rendered, including `/explore`, `/account`, `/sign-in`, `/sign-up`. Web JS bundle ≈ **2.8 MB** (was ≈ 3.0 MB in Step 0.3 — the drop reflects removing the Expo collapsibles, badge, and tutorial images from Explore). Export was written to a temp dir outside the repo and deleted, so the working tree stayed clean.

---

## Functional changes

1. **Explore** is now a clean Arabic placeholder ("استكشاف" + subtitle + three "قريباً" cards: أدلة ونصائح / مصادر مفيدة / مجتمع الدعم). No navigation, no logic, no data fetching.
2. **Account**:
   - Shows the signed-in email (`selectable`), or a localized "لا يوجد بريد إلكتروني" when absent.
   - Sign-out still triggers `supabase.auth.signOut()`; on the success path the `(app)` guard redirects as before. **New:** if `signOut` returns an error, the spinner resets and an error message is announced (previously the button could spin forever).
   - Centered and width-capped on web/tablet; title is a screen-reader header.
3. **Sign-in / Sign-up**: identical validation/auth flow; improved layout (centered, capped width, grouped fields), header roles, `textContentType` for better autofill, and error/notice text announced to screen readers.
4. **De-branding**: no Expo badge, Expo docs links, or starter copy remain on any app screen; `web-badge.tsx` removed.

### Accessibility highlights
- Screen titles use `accessibilityRole="header"`.
- Error messages use `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`; the sign-up email notice uses a live region.
- Buttons expose `accessibilityState={{ disabled, busy }}`.
- Inputs keep `accessibilityLabel`s; touch targets remain ≥ 52px; body text 16–20px.

---

## How to test

**Web (fastest):**
```bash
npm run web   # expo start --web
```
- `<html>` has `dir="rtl" lang="ar"` (from Step 0.3); UI reads right-to-left.
- **Explore tab** ("استكشاف"): header + three "قريباً" cards. No Expo content/badge/links anywhere.
- **Account tab** ("الحساب"): shows your email; tap "تسجيل الخروج" → returns to the sign-in screen. (To exercise the new error path, sign out while offline — the button recovers and shows "تعذّر تسجيل الخروج…".)
- **Auth screens**: forms are centered and width-capped on wide windows; labels right-aligned (RTL); validation messages appear in red and are announced.

**Native (dev client or build — not Expo Go, which resets RTL):**
```bash
npm run ios   # or: npm run android
```
- Tabs, Explore, Account, and auth render Arabic + RTL (full layout mirroring applies per the Step 0.3 restart caveat on LTR-locale devices).
- Sign in → land on tabs; Account → sign out → back to sign-in. Sign-up with a new email shows the confirmation notice.

**Regression checks:** routing unchanged (12 routes still export); auth guards still redirect; sign-in/sign-up logic untouched.

---

## Known risks / assumptions

- **Sign-out behavior change is intentional and additive.** It still calls `supabase.auth.signOut()`; it only adds error handling around the existing call (treated as the "clear bug" the scope allows — a stuck spinner on failure). The happy path is unchanged.
- **`textContentType`** is an iOS-oriented prop (no-op elsewhere); harmless and improves iOS autofill.
- **Email field alignment under RTL:** email/password content is Latin/LTR inside an RTL-aligned field. This is standard for RTL apps and was left as-is; forcing per-field LTR is a possible future refinement.
- **Generic starter components kept:** `external-link.tsx`, `ui/collapsible.tsx` remain (reusable, unbranded). `hint-row.tsx` remains orphaned from 0.3. None are rendered; no Expo branding is visible.
- **No native rebuild** was performed; web export is the smoke test. Native RTL/visuals should be confirmed on a device/simulator in a dev client.
- Per scope: **no** routing changes, **no** migration changes, **no** care-circle logic, **no** AI/notifications/payments/phone-OTP/subscriptions.

---

## Git status summary

Step 0.3 was committed between turns (`6fb97e3 feat(app): add arabic rtl polish`), so the working tree contains **only** Step 0.4 changes — 7 modified, 1 deleted, plus this untracked report:

```
 M src/app/(app)/account.tsx
 M src/app/(app)/explore.tsx
 M src/app/(auth)/sign-in.tsx
 M src/app/(auth)/sign-up.tsx
 D src/components/web-badge.tsx
 M src/constants/theme.ts
 M src/locales/ar.json
 M src/locales/en.json
?? docs/claude-reports/2026-06-08-step-0-4-shell-cleanup.md
```

`git diff --stat`: **8 files changed, 271 insertions(+), 271 deletions(-)**. Not committed.

> Cosmetic: Git warned `LF will be replaced by CRLF` on the edited files (Windows line-ending normalization) — no content impact.

---

## Recommended next step

**Step 0.5 — Language toggle + RTL/a11y verification pass.** Concretely:
1. Add an Arabic⇄English switcher on the Account screen (`i18n.changeLanguage` + persist via `expo-secure-store`/`AsyncStorage`), and surface the native "restart to apply layout direction" prompt there.
2. Quick device/simulator pass to confirm RTL mirroring and tab bar on native (dev client), since only web has been smoke-tested so far.
3. Optional cleanup: remove the now-unused `hint-row.tsx` (and decide whether to keep `collapsible.tsx`/`external-link.tsx`) once a direction for Explore's real content is chosen.
