# Sanad Mobile — Design Acceptance Criteria

How future Claude Code (or any implementer) safely turns the approved Figma design into working code in this repo, without regressing Arabic/RTL, accessibility, the medical-safety boundary, the date/time picker fixes, the notification opt-in flow, or encoding integrity.

This is part of the **Sanad Figma handoff package**. Its sibling docs (cross-referenced throughout by filename):

- `docs/figma/sanad-mobile-figma-design-brief.md` — master design brief (product, users, principles, IA, visual system, copy/language).
- `docs/figma/sanad-mobile-screen-inventory.md` — every screen + interaction inventory + data states.
- `docs/figma/sanad-mobile-component-inventory.md` — every component (props/variants, Figma variants, accessibility) + primitives.
- `docs/figma/sanad-mobile-figma-ai-master-prompt.md` — the single paste-ready Figma / Figma Make / Figma AI prompt.
- `docs/claude-reports/2026-06-16-figma-handoff-package.md` — the run report (written by the orchestrator, not here).

> **Read order for an implementer.** Start with the brief for intent, the screen inventory for the target structure, and the component inventory to know which primitive already exists. Then come back here before writing a single line: this file is the gate between "the Figma looks approved" and "the code is allowed to change."

---

## 1. Golden rules (non-negotiable)

These apply to **every** implementation task derived from the Figma design. Violating any one is grounds to stop and re-plan, not "fix later."

1. **No backend changes unless separately approved.** Do not touch Supabase schema, migrations, RPCs, Edge Functions, RLS, cron, environment variables, or remote push delivery. The visual layer reads existing hooks/queries; it does not change what they fetch or write. A "redesign" never silently becomes a data-model change. (Folding Visits into a Schedule view, adding an activity-stream data source, or any IA/data change is its **own** approved task — see `sanad-mobile-screen-inventory.md` for the review-flag context.)

2. **No raw Unicode glyph icons in source — ever.** Icons are referenced by **meaning** through the single `<Icon name="…">` component (`src/components/icon.tsx` + the semantic map in `src/constants/icons.ts`), never as literal symbol characters (`✓ › ● ✚ ♡` etc.). This is the exact pattern that caused the historical mojibake bug. The ASCII-safe `src/constants/glyphs.ts` (code-point-built constants) remains the fallback for not-yet-migrated areas and for single-letter avatars (`initialFor`); **do not add new raw Unicode literals**, and do not opportunistically migrate the remaining `Glyph` consumers during a visual task (that is its own foundation task).

3. **No hardcoded colors, spacing, radii, sizes, or type values.** Every visual value comes from a token in `src/constants/theme.ts` (`Colors[scheme]`, `Spacing`, `Radius`, `IconSize`, `TouchTarget`, the typography scale, `Gutter`, `MaxContentWidth`, `MaxFormWidth`). If the Figma introduces a value that has no token, **add the token to `theme.ts` and reference it** — never inline a hex/number in a component. The only sanctioned hardcoded colors already in the tree are the notification badge red (`#D92D20` / dark `#E5564D` family) and the splash brand blue (`#208AEF`); do not add more, and do not "improve" those without explicit sign-off.

4. **Preserve the notification opt-in / channel-before-permission flow.** Permission is never requested on import or launch — only via the explicit user-driven "Enable notifications" control. On Android, `ensureAndroidChannel()` runs **before** `requestPermissionsAsync()`. Conservative defaults + Quiet Hours stay. Copy stays honest (local reminders are not guaranteed delivery; test vs. real vs. remote stay distinct). You may restyle `PushStatusCard` / notification settings, but you may not reorder or remove the opt-in sequence or surface push-token/project-id mechanics to normal users. See `sanad-mobile-screen-inventory.md` (notifications) and `sanad-mobile-component-inventory.md` (`PushStatusCard`).

5. **Preserve the date/time picker fixes.** Reuse `date-field.tsx`, `time-field.tsx`, `date-time-field.tsx`, `picker-sheet.tsx`, `weekday-selector.tsx`, `timezone-picker.tsx` and their `date-time-shared.ts` contracts (`'YYYY-MM-DD'`, 24-hour `'HH:MM'`, `''` when cleared). Do **not** swap the picker implementation — the Android blank-surface bug and the leap-aware day clamp / weekday behavior were specifically fixed here. Restyle within the existing components only.

6. **Preserve the duplicate-medication-time and schedule-conflict validation.** Keep `prepareSchedule`, `duplicateTimes` / `duplicateTimesInDraft`, and `findScheduleConflicts` (`src/features/medications/schedule-validation.ts` + `schema.ts`) intact, including the save-disabled-on-duplicate behavior and the first-conflict surfacing. These guard against double-counted doses and React-key collisions; a visual restyle must not weaken them.

7. **Preserve accessibility + RTL.** Status is always icon + text + color (never color-only, never glyph-only). Touch targets ≥48dp (primary ≥56dp), ≥8dp apart. Body text ≥17sp where possible, never below 14sp. Contrast ≥4.5:1 (≥3:1 large). LTR runs (phones, times, dose strengths like "500 mg", emails, codes, English drug names) stay isolated via `LtrText` / `isolateLtr` — never force a whole container LTR. Western Arabic digits (0–9) used consistently. Keep `accessibilityRole` / `accessibilityState` / `accessibilityLabel`, `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` on errors, and logical RTL focus order. Mirror only `chevron` (the one directional icon).

8. **No new dependencies without approval.** `@expo/vector-icons` is the one approved icon dependency and is already installed. `react-native-svg`, `lucide-react-native`, animation libs, chart libs, SVG ring libs, etc. all require explicit approval first. (The signature Today Care Ring is built from plain Views + tokens + `<Icon>` deliberately — no SVG, no animation, zero new deps. Keep it that way unless a dependency is separately approved.)

9. **No `git add .` / no commits / no push without instruction.** Stage specific files only. No `git reset/restore/clean`. No deploy, no EAS, no Supabase/Firebase CLI. Do not print or request secrets.

---

## 2. Figma → code mapping

Map each Figma component to the **existing** React Native source. The rule: **reuse the primitive, restyle via tokens** — do not create a one-off styled copy. New Figma components become **new primitives that follow the token conventions**, added once and reused, never inline styles scattered across screens.

Full prop/variant detail for each lives in `sanad-mobile-component-inventory.md`; this table is the lookup from Figma layer → file.

| Figma component / layer | Existing source file | Notes / constraints |
|---|---|---|
| Screen frame / safe-area container | `src/components/screen.tsx` | Every screen uses it. Tab screens (no native header) pass `edges={{ top: true }}`. Do not hand-roll padding/safe-area. |
| Themed surface background | `src/components/themed-view.tsx` | Background follows theme token. |
| Text (all type styles) | `src/components/themed-text.tsx` | `type` selects the scale step (title/subtitle/sectionTitle/cardTitle/body/small/…). The scale itself is in `theme.ts`. |
| Card / panel / titled group | `src/components/surface.tsx` (+ `Card`, `Section`) | The one card primitive. No card-in-card. `Section` title is `accessibilityRole="header"`. Tones via `SurfaceTone`. |
| Primary / secondary / danger / plain button | `src/components/button.tsx` | `variant` + `size`; loading shows spinner + disables. `md`→comfortable, `sm`→min touch floor. Leading icon via `iconName`. |
| Icon-only button | `src/components/icon-button.tsx` | Secondary actions only; `accessibilityLabel` required. Primary actions must use labeled `Button`. |
| Icon (any) | `src/components/icon.tsx` + `src/constants/icons.ts` | Reference by semantic name. `chevron` is the only directional icon (mirrors in RTL). |
| Status pill / badge | `src/components/status-badge.tsx` | Always tone + shape icon + text label. Never color-only. |
| Identity chip / avatar circle | `src/components/glyph-chip.tsx` | Vector icon or letterform avatar; tones + sizes (`36/44/64`). Decorative by default. |
| Inline notice / disclaimer banner | `src/components/info-banner.tsx` | Tones `info/warning/neutral/accent`. Replaces floating gray disclaimer paragraphs. |
| LTR-isolated value (phone/time/code/email) | `src/components/ltr-text.tsx` (`LtrText`, `isolateLtr`) | Bidi-isolate every LTR run inside Arabic. |
| Full-width nav/dashboard row | `src/components/nav-card.tsx` | Chip + title + subtitle + trailing mirrored chevron. `minHeight:88`. |
| Compact 2-column tile | `src/components/dashboard-tile.tsx` | The shared tile (chip + chevron + title + meta, `width:48%`, `minHeight:116`). **Note:** the *current* home overuses this (see negative example in the brief); the approved design demotes/limits it. |
| Doctor / emergency-contact card + call row | `src/components/contact-card.tsx` | One-tap call (`tel:` via `Linking`), phone via `LtrText selectable`, call row ≥ comfortable touch target. |
| Loading / error / empty states | `src/components/states.tsx` (`LoadingState`, `ErrorState`, `EmptyState`) | Reuse; empty states instruct + invite. |
| Text input + label + inline error | `src/components/form-field.tsx` | Label above input, RTL-correct (no hardcoded `textAlign`), focus ring, alert errors. |
| Add/edit bottom-sheet modal | `src/components/form-modal.tsx` | No backdrop-tap dismiss (avoids data loss); explicit close/cancel. |
| Save area (inline / sticky) | `src/components/form-actions.tsx` (`FormActions`, `StickyFormActions`) | Primary save + optional non-destructive secondary + alert status line. Destructive actions deliberately excluded here. |
| Segmented single-choice (category/priority/type/role/unit) | `src/components/option-select.tsx` | Radio chips; selected = tint + border + leading check + bold. Never color-only. |
| Weekday multi-select | `src/components/weekday-selector.tsx` | **PROTECTED** behavior (0=Sun..6=Sat, every-day toggle). Restyle only. |
| Date / time / datetime pickers | `date-field.tsx`, `time-field.tsx`, `date-time-field.tsx`, `picker-sheet.tsx` (+ `.web.tsx`) | **PROTECTED** (blank-surface fix). Reuse, do not replace. |
| Timezone picker | `src/components/timezone-picker.tsx` | Searchable IANA selector; returns id only, caller confirms. |
| Edit + delete row actions | `src/components/item-actions.tsx` | Inline two-step delete confirm (no `Alert.alert`, web-safe). The only delete affordance pattern. |
| Unsaved-changes guard | `src/components/unsaved-changes-guard.tsx` | Drop-in; centralized copy. Keep on all editors. |
| Tab bar | `src/components/app-tabs.tsx` (+ `.web.tsx`) | Native tabs. Account tab icon is a known placeholder (TODO) — flag, don't silently swap families. |
| Notification bell + unread badge | `src/features/notifications/notification-bell.tsx` | Deliberately a labeled pill, not icon-only. Fixed-red badge is intentional. |
| Push status / enable card | `src/features/notifications/push-status-card.tsx` | Honest per-outcome copy; opt-in only. **PROTECTED** behavior. |
| Signature "Today Care Ring" | `src/features/care-circle/today-care-ring.tsx` | The one signature element. Plain Views + tokens + `<Icon>`. Medical-safety: reflects recorded dose completion, never a clinical judgment; never color-only. |
| Five dashboard feature cards | `src/features/{tasks,appointments,daily-logs,vitals,visits}/*-card.tsx` | Thin wrappers over `DashboardTile`; loading→subtitle, zero→`*.summary.none`, else count. |

**New Figma components (no existing match):** add them as **new primitives in `src/components/`** that consume tokens exactly like the existing ones (theme colors, `Spacing`/`Radius`/`TouchTarget`, the type scale, RTL-logical layout, the accessibility patterns above). Document the new primitive in `sanad-mobile-component-inventory.md`. Do **not** implement a new Figma element as inline one-off styles inside a screen — that breaks consistency and re-introduces magic numbers.

---

## 3. Likely files to change (and what is PROTECTED)

### Likely-to-change for a home/IA + visual implementation

Tokens & type scale:
- `src/constants/theme.ts` — any new/updated color, spacing, radius, icon-size, touch-target, gutter (the brief recommends gutter 20→24), or typography token. The recommended base-body floor (16→17) lands here. **Single source of truth — all visual values come from here.**
- `src/components/themed-text.tsx` — the type-scale step definitions if the approved scale changes (e.g. raising the body floor).
- `src/constants/icons.ts` — only if the approved design needs a new **semantic** icon name (add the mapping; never a raw glyph).

Home / today-first IA (the core of the approved redesign):
- `src/app/(app)/(tabs)/index.tsx` — `HomeScreen` branch logic (loading / error / no-circle / dashboard). Structure stays; rendering of the dashboard changes.
- `src/features/care-circle/circle-dashboard.tsx` — the section order. The approved design replaces the "three stacked identical grids" structure with one clear hero + a quiet, demoted feature set (see the negative example + home direction in `sanad-mobile-figma-design-brief.md`).
- `src/features/care-circle/today-overview.tsx` — the Today hero + next-action card.
- `src/features/care-circle/today-care-ring.tsx` — the signature ring (visual refinement only; keep the no-deps, no-color-only, non-diagnostic discipline).
- `src/components/dashboard-tile.tsx` — the shared tile; likely de-emphasized / used more sparingly.
- `src/features/circle-selection/circle-switcher.tsx` — circle context card, if restyled.
- The five feature cards: `src/features/{tasks,appointments,daily-logs,vitals,visits}/*-card.tsx`.

Shared visual primitives (restyle via tokens, keep APIs stable):
- `src/components/surface.tsx`, `button.tsx`, `status-badge.tsx`, `nav-card.tsx`, `glyph-chip.tsx`, `info-banner.tsx`, `screen.tsx`.

Per-feature screen restyles (only the named feature's task):
- `medications-center.tsx` / `medication-editor.tsx` / `medication-form.tsx`, the tasks/appointments/visits/daily-logs/vitals centers + editors + forms, `doctors-manager.tsx`, `emergency-card.tsx`, `contacts-manager.tsx`, the circle-members / invitations / join / recipient-profile screens, `account.tsx`, `sign-in.tsx` / `sign-up.tsx`. Restyle within the existing structure; do not change data flow.

Copy:
- `src/locales/ar.json` and `src/locales/en.json` — **must stay key-for-key identical** in structure (both files are one flat `common` namespace). Arabic is the source; English mirrors it. Any copy change updates both, preserves Western digits (the lone Eastern-Arabic ٦ in the auth password strings is a known deviation — leave it unless explicitly assigned to fix). Never add medical-interpretation wording.

### PROTECTED — change only with explicit verification

Touch these only when that subsystem is the explicit task, and re-verify on device (S24 Ultra, Arabic, RTL, dark) afterward:

- **Pickers / selectors:** `date-field.tsx`, `time-field.tsx`, `date-time-field.tsx`, `picker-sheet.tsx`, `weekday-selector.tsx`, `timezone-picker.tsx`, `date-time-shared.ts`, `src/utils/date.ts`. (Blank-surface fix, leap-aware clamp, weekday behavior, `'YYYY-MM-DD'` / `'HH:MM'` contracts.)
- **Schedule validation:** `src/features/medications/schedule-validation.ts`, `schema.ts`, `today.ts`. (Duplicate-time + conflict logic, dose computation, React-key safety.)
- **Notification opt-in / hooks:** `src/features/notifications/push-registration.ts`, `hooks.ts`, `notification-observer.tsx`, `push-status-card.tsx`, `schema.ts`, `device.ts`. (Channel-before-permission, no auto-prompt, honest copy, Quiet Hours.)
- **Auth + circle gating:** `src/app/(app)/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `src/providers/*`, `src/features/care-circle/circle-gate.tsx`, `src/features/circle-selection/*`. (Redirect guards, active-circle resolution.)
- **Destructive-action + unsaved-changes machinery:** `src/components/item-actions.tsx`, `unsaved-changes-guard.tsx`, `src/utils/confirm.ts`, `src/hooks/use-unsaved-changes.ts`. (Two-step confirm, leave-guard copy.)
- **Encoding guards:** `scripts/check-mojibake.js`, `.editorconfig`, `.gitattributes`. Do not weaken.

If a visual task *seems* to require editing a protected file, stop and confirm scope first — almost always the restyle can happen in the consuming screen/primitive instead.

---

## 4. Acceptance checklist

The implementation is acceptable only when **all** of the following hold. These are concrete and checkable; tie each PR back to them.

**Home / IA**
- [ ] Home is **today-first**: one clear hero (care-recipient context + the Today Care Ring + a single strong next-action), feature navigation demoted to a small quiet set below.
- [ ] Home is **not a wall of identical rectangles** — no three-stacked-identical-grids layout; no feature (medications/tasks/appointments) appearing twice as duplicate navigation.
- [ ] Emergency is reachable in one tap and is visually distinct, not a peer tile buried in a grid.
- [ ] Generous breathing room; one signature element (the ring) leads; everything else is quiet.

**Tokens & visual system**
- [ ] Zero hardcoded colors/spacing/radii/sizes in changed files — all from `theme.ts` tokens (verify by reading the diff).
- [ ] Any new value was added as a token, not inlined.
- [ ] Dark mode AND light mode both verified for every changed screen (dark is the primary test theme).

**Icons & encoding**
- [ ] Every icon is a semantic `<Icon name="…">`; no new raw Unicode symbol literals in source.
- [ ] No mojibake anywhere on changed screens (chips, chevrons, status marks, feeds).

**Arabic / RTL**
- [ ] RTL intact end-to-end; layout uses logical direction (no hardcoded `left`/`right`).
- [ ] `chevron` mirrors correctly; no other icon is directionally mirrored.
- [ ] Every LTR run (phone, time, dose strength, email, code, English drug name) is isolated via `LtrText` / `isolateLtr`; no whole container forced LTR.
- [ ] Western Arabic digits used consistently for times/doses/phones/codes.

**Accessibility**
- [ ] Touch targets ≥48dp (primary ≥56dp), ≥8dp apart.
- [ ] Body text ≥17sp where possible, never below 14sp; verified at 130% and ~200% OS font scale with no clipping/overlap.
- [ ] Contrast ≥4.5:1 normal / ≥3:1 large; brand blue re-checked on porcelain.
- [ ] **Status = icon + text + color** everywhere (never color-only, never glyph-only).
- [ ] Visible text labels over icon-only actions; `accessibilityLabel`/`Role`/`State` present; errors use `accessibilityRole="alert"` + live region; RTL focus order sane.
- [ ] Destructive actions confirm (two-step) and don't lose data silently; every screen has a clear way back/home.

**Medical safety**
- [ ] No diagnosis/interpretation anywhere; no normal/abnormal/good/bad/healthy labels; vitals/doses shown as value + unit (+ optional neutral trend) only; no color-by-health.
- [ ] The non-diagnostic disclaimers are preserved on each health surface (medications/tasks/appointments/visits/daily-logs/vitals/emergency card); the strongest one (vitals: "does not interpret the values") stays.
- [ ] Emergency screens never imply guaranteed response; no SOS/guaranteed-delivery claims added.

**Notifications**
- [ ] Opt-in is explicit and user-driven; channel-before-permission on Android intact; no launch auto-prompt.
- [ ] Copy honest: local reminders not presented as guaranteed; test vs. real reminder vs. remote push remain clearly distinct; Quiet Hours + conservative defaults intact; push mechanics hidden behind plain settings.

**Pickers & validation**
- [ ] Date/time pickers render and return values on Android (blank-surface fix intact); weekday selector behavior intact.
- [ ] Duplicate-medication-time and schedule-conflict validation intact (save disabled on duplicate; conflict surfaced).

**Behavior preserved**
- [ ] No data flow changed; hooks/queries untouched; no backend edits.
- [ ] No new dependencies (or approval requested and recorded).

---

## 5. Validation commands

Run all of these after changes and confirm the expected result before declaring the work done. They are read-only — they do not log in, deploy, or modify the backend.

```bash
npx tsc --noEmit
# Expect: no type errors (clean exit). TypeScript is strict.

npx expo-doctor
# Expect: all checks pass (baseline was 21/21). Catches dependency/config drift —
# e.g. an unapproved new dependency would surface here.

npm run check:mojibake
# Expect: exit 0, no STRONG signatures. Scans ACTIVE source/config only
# (src, lib, scripts, root config) — it deliberately does NOT scan docs/ or
# .claude/. So this guards the code you changed, and this very doc is out of scope.

git -c core.autocrlf=false diff --check
# Expect: clean (no whitespace/LF/encoding warnings). Combined with .editorconfig
# (charset=utf-8, eol=lf) and .gitattributes, this protects encoding integrity.
```

If the change affects the web target (web overrides, shared primitives used on web, anything near `*.web.tsx`):

```bash
npx expo export --platform web
# Expect: builds successfully. Run this especially after any icon/glyph or
# date/time picker change (the native and web picker variants share a prop contract).
```

Linting (optional, project script): `npm run lint` (`expo lint`) — expect clean or only pre-existing warnings; do not mass-fix unrelated lint as part of a visual task.

> **Device QA is still required** beyond these commands. Static checks cannot confirm RTL flow, contrast, touch sizes, picker rendering, or dark-mode appearance. Verify changed screens on the S24 Ultra in Arabic, RTL, dark mode (the real-device QA checklist lives in the design skill and the brief).

---

## 6. Commit boundaries

Implement in independently-reviewable slices. **Stage specific files only** (never `git add .` / `-A`), and **do not commit or push unless the human explicitly asks.** When asked to commit, branch first if on the default branch. Suggested slices, in dependency order:

1. **Tokens + type scale.** `src/constants/theme.ts` (+ `src/components/themed-text.tsx` if the scale steps change; `src/constants/icons.ts` only if a new semantic icon name is needed). Smallest, highest-leverage, reviewed first because everything else consumes it. Verify `tsc` + `expo-doctor` here.

2. **New / updated shared primitives.** `src/components/{surface,button,status-badge,nav-card,glyph-chip,info-banner,dashboard-tile,screen}.tsx` and any genuinely new primitive (documented in `sanad-mobile-component-inventory.md`). Keep public props stable so screens don't need lock-step edits.

3. **Home / IA.** `src/app/(app)/(tabs)/index.tsx`, `src/features/care-circle/{circle-dashboard,today-overview,today-care-ring}.tsx`, `src/features/circle-selection/circle-switcher.tsx`, and the five `*-card.tsx`. This is the today-first restructure; review it on its own against the home-direction acceptance items.

4. **Per-feature screen restyles.** One slice per feature area (medications; tasks; appointments; visits; daily-logs; vitals; doctors/emergency; circle-members/invitations/profile; account/auth; notifications). Each is self-contained and independently reviewable; never bundle multiple feature areas in one commit.

5. **Copy.** `src/locales/ar.json` + `src/locales/en.json` together (they must stay structurally identical). Isolate copy from layout changes so wording is reviewable on its own and the diff is readable.

Each slice should pass the §5 validation commands before it is considered done. Keep slices small enough that a reviewer can hold the whole change in their head; if a slice grows beyond one cohesive concern, split it.
