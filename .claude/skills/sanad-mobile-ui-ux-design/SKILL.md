---
name: sanad-mobile-ui-ux-design
description: >-
  Guides all UI/UX work on the Sanad Mobile app (an Arabic-first family
  elderly-care coordination app built with Expo / React Native). Use this skill
  whenever a Sanad task touches the interface in any way — building or restyling
  a screen, card, form, list, modal, or component; editing theme tokens, fonts,
  colors, spacing, or typography; working on icons, glyphs, or status
  indicators; adjusting RTL/Arabic layout or bidi handling; touching date/time
  pickers or notification UI; writing user-facing copy; or doing an
  accessibility or responsive-layout pass. Apply it even when the request
  doesn't say "design" but will change how anything looks or reads. This skill
  enforces Arabic-first RTL, older-adult accessibility, a mojibake-proof icon
  system, medical-safety wording, and the project's hard backend/secret
  constraints, so changes improve the app without regressions.
---

# Sanad Mobile — UI/UX Design Skill

You are working on **Sanad**, an Arabic-first mobile app that helps families coordinate care for older adults (medications, schedule, tasks, visits, vitals, doctors, emergency info, the care circle, and notifications). The users are non-technical Arabic-speaking family caregivers and older adults, often under stress, sometimes with reduced vision or dexterity. Every UI decision serves *clarity, calm, trust, and accessibility* — in that order, in Arabic, right-to-left.

## Purpose

Make Sanad's interface clearer, calmer, more accessible, and more premium **without** regressing Arabic/RTL, accessibility, the date/time picker fixes, notification behavior, or the encoding integrity of the codebase — and **without** touching backend logic, secrets, or deployment.

## When to use

Use this skill for any task that changes how Sanad looks or reads: screens, components (cards, forms, lists, modals, buttons, chips, badges), theme tokens, typography, color, spacing, icons/glyphs, status indicators, RTL/bidi layout, date/time pickers, notification UI, empty states, error states, onboarding, or user-facing copy. Use it even if the request is phrased as a bug fix or refactor but will alter the UI.

## When NOT to use

Do not use this skill (or do, but it won't be the relevant guide) for: pure backend work, Supabase schema/Edge Functions, push-delivery server logic, build/release configuration, or non-visual logic that doesn't affect the interface. For those, defer to the project's backend/ops constraints and **do not** apply visual changes opportunistically.

## Scope discipline (read before acting)

Separate **standing guardrails** (always apply, every task) from **scheduled initiatives** (apply only when that initiative is the explicit task). **Never let a small fix expand into a redesign or a migration.**

**Standing guardrails — always enforce:**
- No backend / secrets / deploy actions; no `git reset/restore/clean`; no `git add .`; no commits (see Forbidden actions).
- No **new** raw decorative Unicode glyph literals in source, ever. Encoding integrity (UTF-8 / LF) is always protected.
- Arabic-first RTL, older-adult accessibility, and medical-safety boundaries always apply.
- Reuse existing primitives and theme tokens; never hardcode visual values.

**Scheduled initiatives — only when the task explicitly asks for them:**
- **Today-first home.** The strategic direction for the home screen, built in a *dedicated home/IA redesign task*. Do **not** restructure the home during unrelated work; the only standing rule is "don't regress the home into a worse/grid layout."
- **Vector-icon migration.** The centralized `<Icon>` (on `@expo/vector-icons`) is now the icon direction. `@expo/vector-icons` is **not** bundled by Expo in this repo — it is installed explicitly (`npx expo install @expo/vector-icons`) and is Sanad's one approved icon dependency. The foundation exists (`src/components/icon.tsx` + the semantic map in `src/constants/icons.ts`); shared primitives and the dashboard already use it. Do **not** continue migrating the remaining `Glyph` consumers during unrelated work — that is its own task. The ASCII-safe `glyphs.ts` remains the fallback for not-yet-migrated areas; add no new raw Unicode literals.
- **Merging feature areas** (e.g., Visits into Schedule) or any IA/data-model change: only as its own explicit task.

---

## Project context

- **Stack:** Expo SDK 56, React Native, Expo Router, TypeScript (strict), NativeWind / RN styling, Supabase (backend — do not modify here), Expo Notifications, EAS, FCM for Android push. Development Build via `expo-dev-client`; current changes are JS/TS/styling/assets that reload through Metro (no native rebuild unless a native dep is added).
- **Design system lives in:** `src/constants/theme.ts` (color, spacing, radius, typography, semantic tokens, font families). **All visual values come from tokens here — never hardcode.**
- **Shared primitives** (reuse, don't reinvent): `screen.tsx`, `surface.tsx`, `button.tsx`, `themed-text.tsx`, `form-field.tsx`, `form-modal.tsx`, `form-actions.tsx`, `picker-sheet.tsx`, `status-badge.tsx`, `contact-card.tsx`, `icon-button.tsx`, `ltr-text.tsx`, `glyph-chip.tsx`, `info-banner.tsx`, `nav-card.tsx`, `date-field.tsx`, `time-field.tsx`, `date-time-field.tsx`, `timezone-picker.tsx`, `weekday-selector.tsx`.
- **Design direction:** "Warm Care OS" — warm porcelain/graphite surfaces, brand blue, sand accent for "today/now." Keep it *calm and disciplined* (calm competence), not clinical-cold and not over-soft. Spend boldness on one signature element; keep everything else quiet.
- **Product priority:** the strategic direction for the home screen is **today-first** (the daily care loop: doses due, today's schedule, open tasks, recent activity), with feature navigation demoted below it. Build this only in a *dedicated home/IA redesign task* (see Scope discipline) — do not restructure the home during unrelated work, and never regress it into a grid of feature buttons.

---

## Sanad product boundaries (never violate)

Sanad **organizes and reminds; it does not provide medical judgment.** In UI and copy it must **never**:

- Diagnose, interpret medical values, or label data normal/abnormal/good/bad.
- Recommend treatment or make medication-safety decisions.
- Color-code vitals or doses by "healthiness."
- Claim emergency reliability or guarantee notification delivery.
- Imply it replaces a doctor, pharmacist, emergency service, or clinical system.

When showing vitals or doses, present the recorded value + unit + (optional) a neutral trend line. No interpretation layer. If a screen risks implying medical judgment, soften the copy and add a brief neutral disclaimer.

---

## Arabic-first RTL rules

- **RTL is the default**, not an afterthought. Lay out, align, and read right-to-left. Use logical direction (`start`/`end`, logical margins/padding, `flex-direction: row` with RTL awareness) — **never** hardcode `left`/`right`.
- **Mirror directional icons** (chevrons, back/forward arrows, progress) in RTL. A chevron must point the correct way.
- **Isolate LTR runs** inside Arabic text — phone numbers, emails, codes, times, dose strengths (e.g., "500 mg"), URLs, and English medication names — using the existing `LtrText` / `isolateLtr` (bidi isolation: FSI…PDI or `unicodeBidi: 'isolate'` + `writingDirection`). Do **not** force a whole container to LTR to "fix" one number; that breaks Arabic flow.
- **Numerals:** use Western Arabic digits (0–9) consistently for times, doses, phone numbers, and codes — they read clearly for Gulf app users and avoid mixed-numeral confusion. Be consistent app-wide; never mix Western and Eastern digits in the same context.
- **Never bake text into images.** It can't be translated, scaled, or mirrored, and it breaks for screen readers.
- **Test the whole flow in RTL** on a device, not just LTR with a flipped flag.

---

## Older-adult accessibility rules

These are not optional polish; they are the product. The two transversal rules from the research are **Simplify** and **Increase the size of, and spacing between, interactive elements.**

- **Touch targets:** minimum **48×48 dp**; **primary actions ≥56 dp**; minimum **8 dp** spacing between adjacent targets. Treat any "recommended minimum" as a floor, not a target.
- **Text size:** base body **≥17 sp**; primary content can be larger; **never below 14 sp** for meaningful text; avoid 12 sp entirely. Let text scale with the OS font setting and verify at **130%** and **~200%** with no clipping or overlap.
- **Contrast:** WCAG AA — **≥4.5:1** for normal text, **≥3:1** for large text (≥18.66 px bold / ≥24 px). Re-check brand blue on porcelain: blue desaturates for aging eyes, so verify the ratio rather than assuming.
- **Status is never color-only.** Always pair color with an icon **and** a text label. (Red alone is invisible to color-blind and low-vision users.)
- **Prefer text labels over icons** for actions and status. If an icon is used for a primary action, it carries a visible label too.
- **Make touchability obvious.** Tappable elements look tappable (clear affordance, adequate padding, visible pressed state); non-tappable elements don't masquerade as buttons.
- **Error tolerance:** confirm destructive actions and offer undo; never lose data silently.
- **Every screen has a clear way back/home.**
- **Provide accessibility labels** (`accessibilityLabel`, `accessibilityRole`, `accessibilityState`) so TalkBack announces controls and status meaningfully; keep focus order logical in RTL.
- **Respect reduced-motion**; keep motion gentle and minimal.

---

## Visual design principles

- **One job per element.** A card communicates one thing; a button performs one clearly-named action.
- **Hierarchy via size + weight + whitespace**, not heavy borders or nested boxes. Avoid card-in-card.
- **Restraint is the premium signal.** Spend boldness on one signature element; keep everything else quiet. Cut decoration that doesn't aid understanding. (Chanel's mirror rule: remove one accessory before shipping.)
- **Accent = meaning.** The sand accent means "today / now / needs attention," not decoration. Brand blue for primary actions. Neutral surfaces for everything else.
- **Consistency is the brand.** Same action ⇒ same label + same icon + same placement, everywhere. Same spacing rhythm, everywhere.
- **Motion is deliberate and minimal.** A gentle transition, not scattered effects (over-animation reads as generic/AI-made).
- Match the calm-competence direction: warm and human in tone, precise and disciplined in execution.

---

## Responsive mobile rules

- **Use the shared `Screen` primitive** for every screen; it handles safe-area, padding, and width. Do not hand-roll screen padding.
- **Respect safe areas and the Android nav bar**; content never clips at edges (a past bug — guard against regressing it).
- **Use full available width sensibly:** no content clipped off the (RTL) edge, no awkward narrow cards, no huge dead space. Cards should breathe but not float in emptiness.
- **Design for one-handed thumb reach** on large phones (the test device is a 6.8" S24 Ultra): anchor primary actions toward the bottom and within thumb arc.
- **Keyboard-aware forms:** the active field scrolls into view and the primary button stays reachable; nothing hides behind the keyboard.
- Test on the real device, in dark mode, in Arabic, before declaring done.

---

## Component design rules

- **Reuse existing primitives** before creating new ones. If a new primitive is truly needed, match the existing token/spacing/typography conventions and document it.
- **Cards/lists:** most important info first in reading order (RTL); generous tap area; status as icon+text+color; no nested cards.
- **Buttons:** name by what happens ("احفظ" / "Save", not "Submit"); keep the same name through the whole flow (the button that says "احفظ" produces a "تم الحفظ" confirmation). One primary + at most one secondary per view.
- **Forms (`FormField`, `FormModal`, `FormActions`):** labels **above** inputs; correct keyboard types (email, phone, number); inline errors in plain Arabic placed at the problem; preserve existing validation and email/secure behavior; generous field height.
- **Status (`StatusBadge`):** icon + text + color, always.
- **Empty states:** instruct and invite action ("أضف أول دواء" / "Add the first medication"), never blank, never a mood.
- **Error/failure copy:** explain what happened and how to fix it, in the interface's voice; errors don't apologize and are never vague.

---

## Date/time picker rules

The Android date/time pickers previously rendered as **blank surfaces**; that was fixed. Protect the fix.

- **Reuse** `date-field.tsx`, `time-field.tsx`, `date-time-field.tsx`, `picker-sheet.tsx`, `weekday-selector.tsx`, `timezone-picker.tsx`. Do not swap the picker implementation casually.
- After any change near scheduling, **verify on the S24 Ultra** that pickers actually render and return values (don't regress the blank-surface bug).
- Display dates/times with Western digits, isolated as LTR runs inside Arabic, formatted for the user's locale/timezone.
- Keep weekday selection behavior intact (it was specifically fixed).

---

## Notification UI rules

- **Honesty first.** Local reminders are **not** guaranteed delivery. Copy must not promise reliability or imply the app is a safety-critical alarm. Clearly distinguish a **"test notification"** from **real reminders** and from **remote push** (these are different things and users confuse them).
- **Restraint by default.** Caregivers are overwhelmed and abandon over-notifying apps. Default to conservative reminders; offer **Quiet Hours**; prefer a clear daily digest over many pings.
- **Human settings, hidden mechanics.** Surface a few plain choices ("Remind me about: medications / appointments / tasks", "Quiet hours"). Hide push-token / project-ID / channel mechanics behind an "Advanced" disclosure; the push-status card must not read like developer diagnostics to a normal user.
- **Preserve the opt-in flow:** explicit, user-driven permission enablement (no auto-prompt on launch), and **channel-before-permission** on Android. Keep remote notification content generic for privacy.
- **Notification center:** clear empty / read / unread states; make the local-test button discoverable but clearly labeled as a test.

---

## Medical-safety wording rules

- Describe what Sanad **does** (records, reminds, organizes, shares) — never what a clinician does.
- No interpretation words: avoid "normal/abnormal," "healthy/unhealthy," "good/bad," "safe dose," "you should…". State the recorded fact only.
- For vitals/doses: value + unit + neutral trend. No judgment, no color-by-health.
- Keep a brief, calm non-diagnostic note where a screen could be misread as medical advice.
- Emergency screens: present saved info clearly; **never** imply guaranteed emergency response. Encourage calling real emergency services.
- Write from the user's side of the screen: name things by what people recognize and control, never by how the system is built ("notifications," not "webhook/push config").

---

## Icon / glyph rules (mojibake-proof)

The mojibake bug (`â€º âœ… â— â„¢ â€œ â€‌`) came from **raw Unicode symbol literals embedded in source** (UTF-8 decoded as Windows-1252). Repairing bytes alone is not the fix — remove the fragile pattern.

- **Never embed decorative symbol characters as iconography** in source (no ✅ › ● ™ smart-quotes etc. as icons).
- **Long-term icon direction: a vector icon set via a single `Icon` component.** Use **`@expo/vector-icons`**. **Install it with `npx expo install @expo/vector-icons` — in this repo it is *not* bundled by Expo and must be installed explicitly.** It is the one approved icon dependency for Sanad; it is JS + bundled-font based and loads through the already-installed `expo-font` path, so it does **not** require a native rebuild in the current Development Build. Choose one family (e.g., Ionicons or MaterialCommunityIcons) and use it consistently. **Perform this migration only in a dedicated icon/design-foundation task** (see Scope discipline); the current accepted fallback is centralized ASCII-safe constants in `glyphs.ts`.
- **Centralize icons:** reference named icons (`<Icon name="check" size={…} color={…} accessibilityLabel="…" />`), never literal characters. One component = one place to enforce size/color tokens and accessibility labels, and one place to swap families.
- **`@expo/vector-icons` is the default. `lucide-react-native` is allowed only with explicit approval** (it pulls in `react-native-svg`, a new dependency — even though Expo provides the native side).
- For genuine single-character chips (e.g., an Arabic initial like "د" for doctor), keep those strings in **one UTF-8 constants module** — never scatter them.
- **Always pair an actionable/status icon with a visible text label** (accessibility + clarity).
- When fixing existing mojibake, search broadly: `â  Â  Ã  �  â€  âœ  â—  â„  â†  ï»`, replace with icon components or correct text, **preserve all Arabic text and RTL**, and re-validate.

---

## Font & encoding rules

- **Font:** IBM Plex Sans Arabic (bundled). Use only weights that are actually bundled — missing weights fall back silently and break the look. Set a clear type scale; use weight deliberately (regular/medium body, heavier for headings only). Avoid all-caps, italics, and underline for emphasis; use weight/size/color instead. Load fonts via `expo-font` before rendering text that depends on them.
- **Encoding (prevent re-corruption):**
  - All source files are **UTF-8**.
  - Add/keep an **`.editorconfig`** with `charset = utf-8` and `end_of_line = lf`.
  - Add/keep **`.gitattributes`** normalizing line endings so Windows/PowerShell tooling can't silently re-corrupt files.
  - Keep the `git diff --check` discipline; expect it clean after LF normalization.
  - Do not introduce raw exotic Unicode into source as a UI element (see icon rules).

---

## Design-token rules

- **Single source of truth:** `src/constants/theme.ts`. All color, spacing, radius, typography, and semantic values come from tokens. **No magic numbers, no hardcoded hex, no inline ad-hoc spacing** in components.
- **Semantic tokens over raw values:** reference `accent` / `surface` / `textPrimary` / `danger` etc., not literal colors, so theming and dark mode stay consistent.
- **Spacing scale:** use the defined scale consistently (don't invent one-off paddings that break the rhythm — a known source of past clutter).
- If a needed token is missing, **add it to the theme** and reference it; don't bypass the system.
- Verify every change in **dark mode** (the test device runs dark mode).

---

## Anti-patterns (do not do these)

- Home screen as a grid of feature buttons (it must be today-first).
- Raw Unicode symbol literals as icons; icon-only primary actions; color-only status.
- Hardcoded colors/spacing/sizes; bypassing theme tokens.
- Hardcoded `left`/`right`; forcing whole containers LTR to fix one number; un-isolated LTR runs inside Arabic.
- Body text < 14 sp; touch targets < 48 dp; targets crammed together.
- Contrast below AA; relying on brand blue without checking its ratio.
- Card-in-card, heavy borders, random gradients, decorative flourish, childish colors, trendy gimmicks.
- Text baked into images.
- Medical interpretation (normal/abnormal, good/bad) anywhere in UI/copy.
- Over-notifying defaults; developer-jargon notification settings.
- Swapping the date/time picker implementation and regressing the blank-surface fix.
- Web/desktop layout squeezed into mobile; ignoring safe areas / Android nav bar.
- Adding new dependencies, or doing native-rebuild work, without explicit approval.

---

## Real-device QA checklist (S24 Ultra: Android, Arabic, RTL, dark mode)

```
[ ] No mojibake anywhere — feeds, chips, chevrons, status marks, every screen
[ ] All icons from one vector set via the single <Icon> component (no literals)
[ ] Home is today-first (daily loop); feature nav demoted
[ ] Every status = icon + text + color (never color-only, never glyph-only)
[ ] Touch targets ≥48 dp (primary ≥56 dp), ≥8 dp apart, real-thumb tested
[ ] Body ≥17 sp; scales to 130% and ~200% with no clipping/overlap
[ ] Contrast ≥4.5:1 (≥3:1 large); brand blue re-checked on porcelain
[ ] RTL intact end-to-end; LTR runs isolated; directional icons mirrored
[ ] Western digits used consistently for times/doses/phones/codes
[ ] Date/time pickers render and return values (blank-surface fix intact)
[ ] Weekday selector behaves correctly
[ ] Destructive actions confirm + undo; no silent data loss
[ ] Empty states instruct + invite; error copy clear, specific, non-apologetic
[ ] Forms: labels above, plain-Arabic inline errors, correct keyboards, no keyboard clipping
[ ] Notification copy honest (local ≠ guaranteed); test vs real vs remote distinct
[ ] No medical interpretation in any UI/copy
[ ] TalkBack: home + medication actions announce labels; focus order sane
[ ] Dark mode verified for all changed screens
[ ] No content clipped at edges; safe-area/nav-bar respected
```

---

## Required validation commands (run after changes)

Run these and confirm they pass before considering UI work done. (They are read-only checks — they do not log in, deploy, or modify backend.)

```bash
npx tsc --noEmit       # expect: no type errors
npx expo-doctor        # expect: all checks pass (was 21/21)
git diff --check       # expect: clean (no whitespace/encoding issues)
```

If web export is relevant to the change: `npx expo export --platform web` (verify it still builds). Re-run after the mojibake/icon fix specifically.

---

## Forbidden actions (hard constraints — never do without explicit review)

- **No backend/deploy/credential operations of any kind**, including (non-exhaustive): `supabase login/logout/link/db push/functions deploy`, `eas login/logout/init/build/submit`, any `firebase` CLI command, `git reset/restore/clean`, or automatic git commits.
- **No `git add .` / `git add -A`.** Stage specific files only. **No push, no deploy.**
- **No new dependencies without explicit approval.** (`@expo/vector-icons` is the approved icon dependency and is now installed via `npx expo install @expo/vector-icons`; it was **not** bundled by Expo in this repo. `react-native-svg`/`lucide-react-native` still require approval.)
- **No native-rebuild-triggering work** unless explicitly planned and approved.
- **Do not print, request, or inspect secrets** — no `.env` values, no service-account keys, no tokens. The Firebase Admin SDK key is on EAS and was deleted locally; never request or recreate it.
- **Do not modify backend logic**, Supabase schema/migrations, Edge Functions, cron, environment variables, or remote push delivery as part of UI work.
- **Stay inside the Sanad project** (`E:\Projects\sanad-mobile`). Do not inspect or modify other projects (e.g., ThinkMate).
- **Do not enable remote notification delivery casually**; that path is reviewed separately.

---

## Final report template (ALWAYS end a UI/UX task with this)

```markdown
## Sanad UI/UX change report

### What changed
- <files touched and, in one line each, what changed>

### Why
- <the UX/product reason, tied to clarity / calm / trust / accessibility>

### Design rules honored
- RTL/Arabic: <how LTR runs were isolated, mirroring, numerals>
- Accessibility: <touch sizes, text sizes, contrast, labels, status pattern>
- Icons/encoding: <vector-icon usage; no literals; UTF-8/encoding intact>
- Tokens: <theme tokens used; no hardcoded values>
- Medical safety: <no interpretation; honest reminder/emergency copy>

### Preserved (no regressions)
- [ ] Date/time picker fixes intact
- [ ] Notification opt-in / channel-before-permission intact
- [ ] Validation passes (tsc --noEmit, expo-doctor, git diff --check)

### Needs real-device check (S24 Ultra, AR/RTL/dark)
- <specific things to verify on device>

### Constraints respected
- [ ] No backend/secret/deploy actions
- [ ] No new dependencies (or: approval requested for <dep> and why)
- [ ] No `git add .` / no push / no deploy
- [ ] Stayed inside E:\Projects\sanad-mobile

### Open questions / suggested follow-ups
- <anything for the human to decide>
```

Use this skill as the standing guide for Sanad's interface. When in doubt, choose the calmer, simpler, more legible, more Arabic-native option — and never trade away accessibility, RTL integrity, encoding safety, or the product's medical boundaries for visual flair.
