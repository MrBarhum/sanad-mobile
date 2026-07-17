# Milestone 5 — Visual QA checklist (on-device)

Automated gates (tsc · mojibake · locale parity · `diff --check`) were green after every commit, but **the visual layer needs on-device eyes**. This is the manual matrix. The redesign is token-driven, so most theme correctness is structural — the real risks are **reflow from the 14pt type floor** (E1 raised ~132 sites) and a few flagged workarounds.

Legend: check each cell **light + dark**, at **OS font scale 100% / 130% / 200%**, in **RTL (Arabic, the default)**. Note any clip / overlap / truncation / horizontal scroll / off-brand color.

## Global (every screen)
- [ ] Text renders in **IBM Plex Sans Arabic** everywhere (no Cairo, no system-font fallback except the one flagged CTA below).
- [ ] No text smaller than 14 except the bell's unread-count badge (sanctioned).
- [ ] Grey-on-grey killed: metadata/timestamps (`textMuted`/`textSecondary`) legible on cards **and** in recessed wells, both themes.
- [ ] Primary teal button: white label clearly legible (light-mode fix — was 4.17, now 4.80).
- [ ] Status is never color-only (icon + text on every pill/badge).
- [ ] RTL: chevrons/back arrows point the right way; rows mirror; LTR runs (times, dates, phone, codes) stay isolated.
- [ ] **Font scale 130% / 200%:** no clipped labels, no overlapping rows, no horizontal page scroll. Cards grow, they don't crop.

## Per-screen matrix (canonical order)
For each: light/dark · 100/130/200% · RTL.

| # | Screen | Specific checks |
|---|---|---|
| 1 | **Home** (flagship) | Dose **ring** hero centered; ring inner label `جرعات اليوم` (now 14) fits at 200% — **flagged runtime QA**. **Completion moment**: when all doses logged, the calm `اكتملت جرعات اليوم` check pill shows in `successFg` (AA-safe), no score/streak. Emergency block reads calm-danger (soft, not alarm-red). Pulse strip rows legible. Bell unread badge (`9+`) intact. Quick-action labels (raised 10→14) don't wrap-break the grid. |
| 2 | **Medications** | Dose cards: status pill via StatusBadge (given=success/postponed=warning+clock/missed=error/unlogged=neutral); "given" pill now AA-safe green. today/all tabs. Dose-logging action chips (given/postponed/missed) still tappable ≥48dp. |
| 3 | **Tasks** | today/open/done + mine/all toggles; overdue→priority order; inline «أنا متكفّل» claim is a filled teal pill (visible in dark); confirm sheets. |
| 4 | **Activity Log** (سجل النشاط) + Home نبض | Row headlines `{name} · {masdar}`; times in circle tz; empty = quiet. |
| 5 | **Appointments** | upcoming/completed tabs; completed StatusBadge=success; retry on error. |
| 6 | **Vitals** | **NEW**: loading spinner + **error retry** (was missing). 2-col grid; reading time (raised 10→14) fits the cell at 200% — **flag if it wraps**. Non-diagnostic disclaimer. |
| 7 | **Visits** | upcoming/recent; StatusBadge completed=success / cancelled=error. |
| 8 | **Daily logs** | **NEW**: spinner loading + **card+retry error** (was bare text). Field rows + notes wells legible. |
| 9 | **Doctors** | call button; inline 2-step delete; manager actions ≥48dp. |
| 10 | **Members** | letter avatars; role legend; actions sheet; `·` separators. |
| 11 | **Available-to-claim** | claim CTA = filled Button with the new `claim` icon; feedback sheet (success/warning-amber/error). |
| 12 | **Notifications** | per-type icon+tint; unread tint; mark-all. |
| 13 | **Notification settings** | legacy-styled (theme.ts already); **flag** as the least-reskinned live screen (Phase-C candidate). |
| 14 | **Account** | sign-out = soft-danger Button + `signOut` icon; name-edit sheet; list rows. |
| 15 | **Explore** | quick-action grid; the old fixed-dark emergency color is fixed (adapts to light now). |
| 16 | **Auth** (sign-in/up/forgot/reset) | headings + the sign-in/sign-up/forgot **links render SemiBold** (regression fixed); AuthField inputs; the save CTA (see flag below). |
| 17 | **Join / Invite / Invitations** | code box (mono, raised to 14); role picker; invitations list. |
| 18 | **Emergency card** | calm-danger tone (soft red + shield icon), not alarm-red; medical rows. |

## Completion-state check (Phase D)
- [ ] Log every dose for today → the ring shows the quiet `اكتملت جرعات اليوم` treatment (check + `successFg`), **no** points/streak/score. Both themes.

## Emergency-block check (Phase A A3 / danger tone)
- [ ] Home emergency block + Emergency card use the **restrained** danger tone (soft `dangerSolid`/`errorFg` + icon), never a bright alarm red. Clearly visible, never alarming.

## Explicit runtime-QA flags (unresolvable without a device)
1. **`FigmaFooterPrimaryButton`** (the save CTA on every form) is a documented plain-Pressable Android render-workaround and renders in the **system font** by design. Verify it (a) appears on every form on the Samsung device, (b) reads acceptably vs the IBM Plex around it. Do **not** fold it into `Button` or add a `fontFamily` without re-confirming it stays visible.
2. **Bottom-tab labels** raised 13→14 — confirm the 3 Arabic labels don't truncate on a narrow device / at 200%.
3. **Care-ring inner label** raised 11→14 — confirm it fits inside the 144dp ring at 200%.
4. **E1 reflow** — the ~132 raised type sites enlarge cards; spot-check the densest screens (Home, Medications, Members, Emergency card) at 130% and 200% for overlap/clip.
5. **RTL first-launch** (pre-existing): native RTL applies next launch; verify a fresh install renders RTL.

## Deferred to Phase C (documented, not regressions)
Component dedups still pending (each a per-screen look call): `FigmaCard`→`Surface`, `FormField`←`FigmaField`/`FigmaFormField`, chip primitives→`OptionSelect`, `GlyphChip`←`icon-chip`, inline empties→`EmptyState`, sheet/header chrome. Hardcoded dose-status hex (`figma-medications` action chips, emergency-card red literals) still to tokenize. Warm-copy humanization (131 catalogued candidates) awaiting owner wording sign-off. Loading skeletons (pure-JS `Skeleton`) not yet added.
