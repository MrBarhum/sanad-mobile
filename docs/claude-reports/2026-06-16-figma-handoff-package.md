# Figma Handoff Package — Build Report

**Date:** 2026-06-16
**Scope:** Author a complete, professional Figma design handoff package for Sanad Mobile.
**Type:** Documentation / design-brief only. **No app source code changed. Not committed.**

---

## Summary

Produced a five-document Figma handoff package (plus this report) that describes the
entire Sanad Mobile app in enough detail to paste into Figma / Figma Make / Figma AI
**and** hand to a human product designer — then later use the approved design as the
source of truth for a safe Claude Code implementation.

The current uncommitted "Today-first" Home prototype was treated as a **rejected
negative example** throughout (too list-like, too crowded, a wall of near-identical
rectangles, weak hierarchy, generic "AI SaaS grid" feel), and every document designs
*against* it while preserving the underlying product behavior, data, and constraints.

No file under `src/`, no package/config file, no backend, and no secrets were touched.

---

## Files created (6)

All new, all additive. Nothing overwritten.

| # | File | Lines | Purpose |
|---|---|---:|---|
| 1 | `docs/figma/sanad-mobile-figma-design-brief.md` | ~460 | Master brief — product, users, UX principles, mobile-frame rules, IA summary, home direction, full visual system (light+dark tokens), RTL/accessibility/medical-safety rules, copy/language. |
| 2 | `docs/figma/sanad-mobile-screen-inventory.md` | ~1008 | Every navigable screen with the full 15-field template, a 75-row interaction inventory, the prioritized Figma frame set, and a per-module data-states matrix. |
| 3 | `docs/figma/sanad-mobile-component-inventory.md` | ~577 | Every component (real props/variants/accessibility), the full Figma token tables, the semantic icon vocabulary, and the Today Care Ring signature spec. |
| 4 | `docs/figma/sanad-mobile-figma-ai-master-prompt.md` | ~265 | One standalone, paste-ready prompt for Figma / Figma Make / Figma AI, with all tokens, screens, home options, rules, and seed Arabic copy baked in, plus follow-up prompts. |
| 5 | `docs/figma/sanad-mobile-design-acceptance-criteria.md` | ~227 | How a future Claude Code run safely implements the approved design: golden rules, Figma→code mapping, likely/protected files, acceptance checklist, validation commands, commit boundaries. |
| 6 | `docs/claude-reports/2026-06-16-figma-handoff-package.md` | — | This report. |

---

## What was inspected

Read directly (this session) to ground the design facts:
- **Design tokens / icon system:** `src/constants/theme.ts`, `src/constants/icons.ts`, `src/constants/glyphs.ts`, `src/components/icon.tsx`, `src/components/themed-text.tsx`, `src/components/dashboard-tile.tsx`.
- **Product & design context:** `docs/product/sanad-product-and-design-review.md`, `.claude/skills/sanad-mobile-ui-ux-design/SKILL.md`.
- **Rejected-prototype reports:** `docs/claude-reports/2026-06-15-today-first-home.md`, `…-today-first-home-refinement.md`, `…-2026-06-15-design-system-icon-foundation.md`.
- **Encoding guard:** `scripts/check-mojibake.js`, `package.json` (confirmed the guard scans active source/config only, **not** `docs/`, so Arabic copy in these docs is safe).

Read via a multi-agent workflow (read-only analyst agents) for exhaustive coverage:
- **Routing / shell / gating:** `src/app/**` layouts + `(tabs)`, `app-tabs.tsx`, `screen.tsx`, `circle-gate.tsx`, circle-selection provider, auth provider.
- **Every feature directory** under `src/features/**` (care-circle/home, medications, tasks, appointments, visits, daily-logs, vitals, doctors, emergency, circle-members, invitations, recipient-profile, notifications) — screens, centers, editors, forms, fields, cards, schemas.
- **Every shared component** under `src/components/**`.
- **All user-facing copy:** `src/locales/ar.json` + `src/locales/en.json` in full, plus `src/i18n/*`.

**Orchestration:** a background Workflow ran **10 read-only mapper agents** (in parallel)
→ assembled a shared knowledge base → **5 author agents** (in parallel) wrote docs 1–5.
15 agents total. The mapper agents surfaced details deeper than the initial scout
(e.g. `schedule-validation.ts`, `confirm.ts`, `use-unsaved-changes.ts`, the splash
brand blue `#208AEF`, the channel-before-permission `ensureAndroidChannel` →
`requestPermissionsAsync` order, and a stray Eastern-Arabic digit `٦` in the password
copy) — each spot-verified against the codebase before finalizing.

---

## What the package found

### Screen count
- **33 route screens** (Expo Router files, excluding the 11 `_layout.tsx` infrastructure files).
- **+ ~7 non-route design states** that still need their own Figma frames: splash/first-paint, create-circle onboarding (rendered inside Home at `/`), the no-active-circle gate, and the modal/bottom-sheet family (circle switcher, schedule add/edit, doctor/contact add/edit, role-change, picker sheets, two-step delete confirm, unsaved-changes prompt).
- The Figma frame set to request is **31 prioritized frames**, with **Home, Medications, Emergency, Notifications, and Forms** as the P1 priority cluster.

### Component count
- **39 distinct components exported** across **30 source modules** in `src/components/` (ignoring 4 `*.web.tsx` platform variants); **34** if you count only the canonical top-level component per module.
- **+ 8 reusable feature components** outside `src/components/`: `TodayCareRing`, the five dashboard cards (`TasksCard`/`AppointmentsCard`/`DailyLogsCard`/`VitalsCard`/`VisitsCard`), `NotificationBell`, `PushStatusCard`.
- Plus **3 NEW/proposed** compositions the home redesign needs (`TodayHero`, `CareRecipientCard`, `FeatureTile`) — flagged as proposed, described as compositions of existing primitives so they can be added without re-deriving the system.

---

## Important product / design constraints (carried into every doc)

- **Arabic-first, RTL by default.** Mirror only the `chevron`; isolate LTR runs (phones, times, dose strengths, emails, codes, English drug names) via `LtrText`/`isolateLtr`; Western/Latin digits 0–9 consistently.
- **Older-adult accessibility is the product.** Targets ≥48dp (primary ≥56dp, ≥8dp apart); body ≥17sp where possible (never <14sp); contrast ≥4.5:1 (≥3:1 large); status = icon + text + color (never color-only or glyph-only); confirm + undo destructive actions; TalkBack labels + sane RTL focus order.
- **Medical-safety boundary.** Sanad organizes and reminds; it does **not** diagnose or interpret. No normal/abnormal/good/bad/healthy labels, no color-by-health, vitals/doses = value + unit + optional neutral trend, no guaranteed emergency response, no guaranteed notification delivery.
- **Notification honesty + opt-in.** Local reminders ≠ guaranteed delivery; test vs. real vs. remote stay distinct; channel-before-permission on Android; conservative defaults + Quiet Hours; push mechanics hidden behind plain settings.
- **Icon system.** Semantic vector icons via the single `<Icon>` (Ionicons default; MaterialCommunityIcons for `medication`/`doctor`/`vital`); **never** raw Unicode symbol literals as icons.
- **Tokens only.** All visual values from `src/constants/theme.ts` (Warm Care OS: warm porcelain/graphite surfaces, one brand blue, sand accent = "today/now/attention"). Dark and light are full peers; light-only soft shadow, dark separates by lifted surface + hairline.

---

## ⚠ Rejected-home warning (read before designing or implementing)

The **current uncommitted Today-first Home is REJECTED by the user.** Do **not** treat it
as the target. Its faults, to design against:
- too list-like — a long stack of rectangles that reads like a report;
- too crowded — a Today hero, then a 2×2 quick-tile grid, then a 6-tile "all care
  sections" grid, then a 4-tile "care team" grid (four stacked grids of near-identical blocks);
- weak hierarchy — every `DashboardTile` looks the same (icon chip + chevron + title +
  meta, ~48% width, ~116dp), so nothing leads the eye;
- generic, templated "AI SaaS card grid" — not premium, not warm, not distinctly Sanad;
- redundant — medications/tasks/appointments appear twice (Today tile **and** care-section tile).

The new design must instead be **Today-first with ONE clear hero**, generous breathing
room, demoted feature navigation, emergency always one tap away, and **no wall of
identical rectangles**. The package asks Figma for **2–3 premium home alternatives**, then
recommends **Option 1 (Today-first hero: recipient card + Today Care Ring + one strong
next-action card)**.

---

## How to use the package

### How to use the Figma prompt
1. Open `docs/figma/sanad-mobile-figma-ai-master-prompt.md`.
2. Copy the **entire fenced block in section 2** (everything between the triple backticks) and paste it into Figma AI / Figma Make as one message — it is self-contained.
3. Generate **dark mode first** (the canonical theme), then request the **light variant** as a second pass.
4. If the tool truncates, use the **section-3 follow-up prompts** to pull screens one at a time (Home alternatives, Medications deep pass, Emergency deep pass, component library, light variant, accessibility/contrast audit, "keep it on-brand").

### What to give Figma / a human designer
- **Primary:** the master prompt (doc 4) — paste-ready, stands alone.
- **Supporting depth:** the design brief (doc 1) for intent and the visual system, the screen inventory (doc 2) for exact per-screen structure + the frame set + data states, and the component inventory (doc 3) for the component library + tokens.
- Prioritize **Home → Medications → Emergency → Notifications → Forms**.

### What to give Claude Code *after* Figma is approved
- The **approved Figma** (links/exports/screenshots) **plus** `docs/figma/sanad-mobile-design-acceptance-criteria.md` (doc 5).
- Doc 5 is the gate between "the Figma looks approved" and "the code may change": golden
  rules (no backend, no raw glyphs, tokens-only, preserve picker/validation/notification
  fixes, preserve RTL/accessibility/medical-safety), a Figma→code component map, the
  likely-to-change vs. **PROTECTED** file lists, an acceptance checklist, the validation
  commands, and suggested commit slices (tokens → primitives → home/IA → per-feature →
  copy). Pair it with the `sanad-mobile-ui-ux-design` skill, which still governs.

---

## Validation

This was a **docs-only** task, so source build checks (`tsc`, `expo-doctor`) were not
required. Ran the encoding/whitespace guards:

| Check | Result |
|---|---|
| `npm run check:mojibake` | **Pass** — scanned 226 active source/config files; no strong signatures. (The guard does not scan `docs/`; the Arabic copy in the new docs is correct UTF-8 and not mojibake.) |
| `git -c core.autocrlf=false diff --check` | **Pass** — clean, exit 0 (no whitespace/LF/encoding issues). |
| Mojibake grep over `docs/figma/*` | **Clean** — 0 occurrences of any artifact signature. |

No commit was made. No `git add`. No push.

---

## No source code changed — confirmation

- The **only** additions from this task are `docs/figma/` (5 files) and this report under `docs/claude-reports/`.
- The pre-existing uncommitted changes shown in `git status` — the modified `src/features/**/*-card.tsx`, `src/features/care-circle/{circle-dashboard,today-overview}.tsx`, `src/locales/{ar,en}.json`, and the untracked `src/components/dashboard-tile.tsx` + `docs/claude-reports/2026-06-15-today-first-home-refinement.md` — were **already present before this task** (the rejected Today-first prototype). **This task did not create, modify, or revert any of them.**
- No `src/`, `package.json`/`package-lock.json`, `app.json`/`eas.json`, `.env`, backend, Supabase, Firebase, or EAS files were touched.

### `git --no-pager status --short`
```
 M src/features/appointments/appointments-card.tsx     (pre-existing)
 M src/features/care-circle/circle-dashboard.tsx        (pre-existing)
 M src/features/care-circle/today-overview.tsx          (pre-existing)
 M src/features/daily-logs/daily-logs-card.tsx          (pre-existing)
 M src/features/tasks/tasks-card.tsx                    (pre-existing)
 M src/features/visits/visits-card.tsx                  (pre-existing)
 M src/features/vitals/vitals-card.tsx                  (pre-existing)
 M src/locales/ar.json                                  (pre-existing)
 M src/locales/en.json                                  (pre-existing)
?? docs/claude-reports/2026-06-15-today-first-home-refinement.md  (pre-existing)
?? docs/claude-reports/2026-06-16-figma-handoff-package.md        (THIS TASK)
?? docs/figma/                                          (THIS TASK — 5 files)
?? src/components/dashboard-tile.tsx                    (pre-existing)
```

---

## Open follow-ups (for the human)

1. **Run the Figma prompt** (doc 4), generate the home alternatives, and pick a direction.
2. **The rejected prototype is still uncommitted** — decide whether to keep it as a functional reference, revert it, or let the approved Figma replace it. (Out of scope here; this task only documented.)
3. After Figma is approved, **start implementation from doc 5** in the suggested commit slices, with device QA on the S24 Ultra (Arabic, RTL, dark).
