# VPA-3R — Exact Figma Repair (rejected VPA-3 → repaired)

**Date:** 2026-06-19
**Status:** The previous **VPA-3 pass was REJECTED** and is **repaired** here. The rejection: the auth primary CTA rendered faint/dark/grey instead of a large filled Figma rectangle; the sign-in/sign-up buttons didn't match Figma geometry; sign-up lacked a confirm-password field; and the work had "reskinned loosely." This pass copies the Figma source **literally** for each screen — the only intentional deviation being **Figma blue primary → Sanad teal**.
**Mode:** Edit. **No commit. No stage.** No EAS / prebuild / Supabase / backend / SQL / edge-function / env / dependency / Expo-config / route-path changes.
**Baseline:** HEAD `c99669e` (VPA-2b). The tree was already dirty with the rejected VPA-3 changes (the exact expected 5 files + the VPA-3 report) — verified no unrelated dirty files before editing — and those 5 files were rewritten in place.

---

## 1. Figma Make source used

| Field | Value |
|---|---|
| **Canonical link** | `https://www.figma.com/make/nIeplIvufiFjoJBZxC7zbX/Mobile-app-design-upload?t=Au75XfxmDZu83NM2-6` |
| **Screen source** | `--Copy-` file `MpgXzFWQpGYbO7x4S7HCgd` (the only Make file that contains these auth/onboarding screens) |
| **MCP read?** | **Yes — live this session**, treated as mandatory spec. |

### Exact Figma MCP resources inspected (live, `file://figma/make/source/MpgXzFWQpGYbO7x4S7HCgd/src/app/components/`)
- `AuthScreens.tsx` — `SignInScreen`, `SignUpScreen` (form + confirm steps), and the shared `FieldInput` (label, raised input, 1.5px border, radius 12, password eye toggle).
- `CreateCircleScreen.tsx`
- `JoinCircleScreen.tsx`
- `RecipientProfileScreen.tsx`

**Figma primary-button spec (every screen):** `width 100%`, blue→**teal** fill, `borderRadius 12`, `height 52–56`, white/onPrimary label, `fontSize 16–17`, `weight 600–700` — a large **filled** rectangle. Implemented with `FigmaFooterPrimaryButton` (the accepted full-width, 56dp, radius-12, teal, plain-`Pressable`, **loading-gated-only** CTA that has no faint/disabled state).

---

## 2. Files changed (8)

`git diff --stat` (8 files): `src/app/(auth)/sign-in.tsx`, `src/app/(auth)/sign-up.tsx`, `src/features/care-circle/onboarding-form.tsx`, `src/features/invitations/join-form.tsx`, `src/features/recipient-profile/profile-form.tsx`, `src/constants/icons.ts` (+`viewOff` eye-off icon), `src/locales/ar.json`, `src/locales/en.json` (additive keys only).

---

## 3. Per-screen before → after

### Sign-in (`sign-in.tsx`) — Figma `AuthScreens.SignInScreen`
- **Before (rejected):** fields + a faint legacy `Button` inside a card; lock icon; no brand mark.
- **After:** centered header = **56×56 teal circle** containing the Figma **brand care-ring SVG** (reproduced verbatim with `react-native-svg`; the inner divider is teal not blue) → **"سند" brand title** (28/700) → subtitle. A card (radius 20, padding 24/20) holds the email + password `AuthField`s — a literal port of Figma's `FieldInput` (label 14/600, raised/sunken fill, **1.5px border**, **radius 12**, padding 14/16, fontSize 16, teal focus, **password eye show/hide toggle**). Primary CTA is the large filled teal **`FigmaFooterPrimaryButton`**. Below the card: the centered "no account? / sign up" row. **Logic byte-preserved**: `credentialsSchema` (email + `min(6)`), `supabase.auth.signInWithPassword`, error mapping. The Figma **forgot-password** link is a blocker (no route) — omitted, see §7.

### Sign-up (`sign-up.tsx`) — Figma `AuthScreens.SignUpScreen` (form step)
- **Before (rejected):** no confirm-password; faint legacy CTA.
- **After:** centered header (no icon, 26/700 + subtitle). Card with **email → password (hint) → confirm password**, all using the same `AuthField` (password fields have the eye toggle). **Confirm-password validation**: required + must equal password → inline `auth.errors.passwordMismatch` **before** any network call; **`supabase.auth.signUp` receives only `{ email, password }`** (confirm is never sent). The `!data.session` check-email **notice is preserved** (now shown as an `InfoBanner`). Primary CTA = `FigmaFooterPrimaryButton`. Password hint reads "6 characters" to track the **real** `min(6)` schema (Figma mock said 8). The Figma two-step check-email *screen* is a blocker (would change the real flow) — see §7.

### Create-circle (`onboarding-form.tsx`) — Figma `CreateCircleScreen`
- **After:** brand-mark row (40×40 teal circle + mini care-ring SVG + "سند") → title 24/700 → subtitle → **amber `InfoBanner`** (new `inviteHint` copy) → card [circle-name → hairline divider → **"معلومات المسنّ"** section label → recipient name with **required `*`** → birth date] → filled teal `FigmaFooterPrimaryButton` ("create") → outlined secondary join button. **`createCircle` mutation + `createCircleSchema` + data flow unchanged** (only single-error → per-field error mapping, presentational). Card/inputs use the shared `Surface` (radius 20) + `FigmaFormField`.

### Join-circle (`join-form.tsx`) — Figma `JoinCircleScreen`
- **After:** warning `InfoBanner` **first** → code in its own bordered **radius-16** card, centered monospace LTR (fontSize 20 / 700 / letter-spacing 3 — byte-matching Figma) → filled teal `FigmaFooterPrimaryButton` ("join"). Success step: centered **80×80 radius-24 success badge** (successBg + successFg border + check) → title → subtitle → teal `FigmaFooterPrimaryButton` ("continue"). **`accept.mutateAsync` + `setPreferredCircleId` + done flow unchanged.**

### Recipient-profile (`profile-form.tsx`) — Figma `RecipientProfileScreen`
- **After:** avatar card = **56×56 rounded-square (radius 18, primaryBg, 2px teal border, initial)** + name (18/700) + birth date → **Personal** card (radius 16) with **section label** + fullName / birth date / dialect separated by **hairline dividers** → **Medical** card (radius 16) with section label + blood type / allergies / chronic / emergency notes + dividers → `FormActions` save (manager only). **`canManage` gating, `recipientProfileSchema`, `update.mutateAsync`, field order, and `UnsavedChangesGuard` all unchanged.** The header edit/view toggle + the unsaved-changes bottom-sheet dialog are behavioral blockers (the app uses the `canManage` permission model) — see §7. Birth-date "· age سنة" omitted (Arabic pluralization) — a small declared deviation.

---

## 4. Sign-in / sign-up buttons match Figma geometry + Sanad teal

Confirmed: both auth primary CTAs are `FigmaFooterPrimaryButton` — a **full-width filled rectangle**, `minHeight 56`, `borderRadius 12`, fill `theme.primary` (**Sanad teal** `#2E8A7B` light / `#4BA898` dark, **not** Figma blue `#2F6FD0`), high-contrast `theme.onPrimary` label. This matches the Figma button geometry (full-width / radius 12 / ~56dp). The legacy `Button` import/usage was removed from both auth files for the primary action.

## 5. Sign-up confirm-password + local matching validation

Confirmed: a third **confirm password** field exists; `onSubmit` sets `auth.errors.passwordMismatch` inline when `password !== confirm` and returns **before** calling Supabase; `supabase.auth.signUp` is called with `{ email, password }` only (confirm never transmitted); password `min(6)` rule intact.

## 6. No grey/faint/invisible primary CTA state remains

Confirmed across all five screens: every **primary** CTA is `FigmaFooterPrimaryButton`, which takes **no `disabled`/`variant`/`style`** prop and is gated **only** by `loading` (double-submit guard) — there is no validation-incomplete disabled state, no faint/grey/opacity-dimmed state, and it is body-rendered (never a footer prop, never sticky/KAV). Incomplete fields → the press runs validation and shows inline errors while the button stays a filled teal rectangle. (The create-circle *secondary* "join" is intentionally an outlined `Button` — not a primary CTA.)

## 7. No backend / infra changes — and blockers

Only the 5 screens + the icon registry (one additive `viewOff` entry) + the two locale files (additive keys only) changed. **No** Supabase / backend / schema / auth-business-logic / SQL / edge-function / hook / mutation / data-fetching / route-path / navigation / dependency / Expo-config / `.env` / EAS / prebuild changes.

**Blockers (reported, not silently changed):**
- **Sign-in forgot-password link** — no forgot-password route/handler exists; rendering a dead link or adding the flow is new navigation + backend. Omitted.
- **Sign-up two-step check-email screen** — the Figma `step==='confirm'` screen (resend/continue) is a mock step transition; the real flow is a single async `signUp` + the preserved inline check-email notice. Building the separate screen would change the auth flow.
- **Recipient-profile edit/view toggle + unsaved-changes bottom-sheet dialog** — behavioral; the app uses the `canManage` permission model (always-editable for managers) and the shared `UnsavedChangesGuard`. Implementing the manual toggle conflicts with `canManage` and is out of visual scope.
- **Recipient birth-date age figure** — omitted to avoid Arabic plural complexity (a small declared deviation).
- **Splash (from VPA-3)** still a coordinated `app.json` + asset blocker (not in this pass's scope).

## 8. Validation results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **clean** — 260 active files, no signatures (Arabic locale additions included) |
| `git -c core.autocrlf=false diff --check` | **exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| `npx expo-doctor` | **21/21 checks passed** |

**Adversarial review (5 agents, re-reading the live Figma source):** all five returned `matchesFigmaLayout`, `ctaFixed`, `confirmPasswordOk`, `logicPreserved`, `noForbiddenChange`, `rtlTeal` = **true** (4 severity `none`, 1 `low`). The one `low` note (info-card radius 20 vs Figma 16 on recipient-profile, plus the join code card) was **fixed** after the review (Personal/Medical + join code cards now radius 16; avatar card stays 20), then re-validated green.

## 9. Android QA checklist

**Sign-in** (dark + light, RTL):
1. Centered teal brand-circle (care-ring) + "سند" + subtitle.
2. Email (LTR) + password fields in a card; the password **eye toggle** shows/hides.
3. Primary CTA is a **large filled teal** rectangle — visible at idle, never grey; invalid creds → inline error, button stays filled; valid creds sign in.
4. "Sign up" link navigates.

**Sign-up:**
5. Centered title (no icon); email + password (hint "6 characters") + **confirm password** fields, each with eye toggle.
6. Mismatched confirm → inline "Passwords do not match"; the button stays filled teal and does **not** call the network.
7. Valid + matching → account created; check-email notice (InfoBanner) appears when no session; "Sign in" link navigates.

**Create-circle (first run):**
8. Brand mark + title + amber invite banner; card with circle name, divider, "معلومات المسنّ", required-marked recipient name, birth date.
9. Filled teal "create" CTA works (Home swaps to dashboard); outlined "join with code" pushes `/join-circle`; invalid → inline field errors.

**Join-circle:**
10. Warning banner first; centered monospace LTR code card; filled teal "join"; success → green check badge + title + subtitle + filled teal "continue" → Home.

**Recipient-profile (manager + non-manager):**
11. Rounded-square teal avatar + name + birth date; Personal + Medical cards (radius 16) with section labels + hairline dividers.
12. Manager edits save (success state) + unsaved-guard on back; non-manager sees read-only banner + disabled inputs + no save.

**Cross-cutting:** all primary CTAs filled teal (no blue, no faint state); RTL intact; email/code inputs LTR; no mojibake; no double headers.

**Stopping here per instructions: no commit, no stage.**
