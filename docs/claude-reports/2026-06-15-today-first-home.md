# Today-first Home — Implementation Report

**Date:** 2026-06-15
**Scope:** First Today-first home/dashboard redesign for Sanad.
**Status:** Implemented and validated. **Not committed** (per instructions).

---

## Summary

The care-circle dashboard is now **today-first**: it opens with the recipient
context, the date, and a calm **Today** section that answers "what does this care
recipient need today, and what is the current care status?" — then the full
feature navigation continues below, intact but demoted.

The Today section leads with the **Sanad signature "Today Care Ring"** (the
medication dose loop for today: given of total), followed by a few high-value,
one-tap highlights (next dose, today's appointment, tasks due today). Everything
is built from data the dashboard already fetched — no backend work, no new
dependencies, no new queries — and shows calm empty states rather than inventing
data. Feature cards and the people/settings group are preserved beneath a new
"All care sections" heading so they read as secondary to the daily loop.

---

## Files changed

### New (2 components, both local to care-circle)
- `src/features/care-circle/today-care-ring.tsx` — the no-dependency signature care-loop element.
- `src/features/care-circle/today-overview.tsx` — the Today section (ring + highlights), composing existing hooks.

### Modified (4)
- `src/features/care-circle/circle-dashboard.tsx` — header gains the date; `TodayOverview` inserted at the top; feature nav wrapped in a demoted `Section`; tagline line replaced by the date.
- `src/utils/date.ts` — added `formatLongDate(language)` (Intl-based, Western digits, YMD fallback).
- `src/locales/ar.json`, `src/locales/en.json` — added `careCircle.dashboard.today.*` + `manageTitle`. (Both were CRLF in the working tree; normalized to LF to honor the encoding guard.)

### Report (1)
- `docs/claude-reports/2026-06-15-today-first-home.md` (this file).

**Diff stat (tracked):** 4 files changed, +102 / −38, plus 2 new component files. **No protected files, no backend, no dependencies.**

---

## What data was reused (no new backend)

All Today data comes from hooks that already power the dashboard cards; React
Query dedupes the shared query keys, so nothing extra is fetched:

- **Medication dose loop** — `useTodayDoses(circleId, today)` (already used by the medications card) returns the full, time-sorted `DoseItem[]`; `summarizeDoses` gives `{ total, given }` for the ring, and the earliest not-yet-given dose is the "next dose".
- **Today's appointment** — `useUpcomingAppointments(circleId)` (already used by the appointments card); the first non-cancelled appointment whose `starts_at` is today is surfaced with its time.
- **Tasks due today** — `useTodayTaskSummary(circleId).dueToday` (already used by the tasks card).
- **Recipient / circle context** — `ActiveCircle.recipientName` is shown by the existing `CircleSwitcher` card (kept directly under the header).
- **Emergency access** — the existing red emergency `NavCard` is kept prominently, directly under the Today section.

No new tables, columns, queries, or schema. Local-time semantics match the rest
of the app (documented assumption in `utils/date.ts`).

---

## Today-first sections added

**A. Header / greeting** — Arabic-first greeting (`home.greeting`) plus today's
date via `formatLongDate(i18n.language)` (e.g. "الأحد، 15 يونيو"), with Western
digits. The notification bell stays in the header. Recipient/circle context
remains in the `CircleSwitcher` immediately below.

**B. Today summary / care loop** — a `Section` titled "اليوم / Today" containing:
- the **Today Care Ring** card (tappable → Medications), and
- a grouped, divider-separated highlight list, each row one-tap into its feature:
  - **Next dose** — medication name + time (time isolated LTR, accent-tinted), or "All of today's doses given" / "No doses today".
  - **Today's appointment** — title + time, or "No appointments today".
  - **Tasks due today** — the count, or "No tasks due today".

**C. Signature element** — see next section.

**D. Feature navigation preserved** — the six feature cards (medications, daily
logs, vitals, tasks, appointments, visits) and the people/settings group are
unchanged in behavior, now wrapped in a `Section` titled "All care sections"
("كل أقسام الرعاية") so they sit clearly below and secondary to Today. Nothing
was deleted.

---

## How the Sanad signature element was implemented

**"Today Care Ring"** (`today-care-ring.tsx`) — a calm, **no-dependency** care-loop
motif built only from React Native `View`s, theme tokens, `<Icon>`, and text:

- A **bordered ring badge** (circular `View`, `borderRadius: pill`, thick border) whose **state** is shown by tone — neutral (nothing scheduled), accent "today/now" (in progress), success (loop closed) — using the additive `accentSolid` / `successFg` tokens from the icon-foundation phase.
- **Inside the ring:** the `given/total` count (in progress), a success `<Icon>` check (complete), or a muted medication `<Icon>` (empty/loading).
- A short **segmented loop strip** beneath the caption: one segment per dose (filled = given), or a proportional 8-segment bar when there are many doses.
- A **caption that always states the meaning in words** ("3 of 5 doses today" / "Today's doses are complete" / "No doses scheduled today"), so meaning never relies on color or shape alone.

Discipline honored: never color-only (count + caption + icon carry it); no
animation, no SVG, no new dependency; RTL-safe (logical flex mirrors the row and
the strip fills from the start edge); fully theme-tokenized for dark mode. The
ring graphic and strip are marked decorative; the parent surface carries one
coherent spoken label. It is intentionally reusable as the home/activity-feed
signature in later phases.

The ring reflects **today's medication dose loop only** — the one data source
that genuinely represents loop closure — rather than a blended all-care number,
which would be muddier and risk implying judgment.

---

## What was deliberately deferred

- **No Activity Feed** — there is no existing per-event activity data source, so none was invented. (The highlight rows are a today summary, not a feed.)
- **Next *visit* highlight** — visits have no guaranteed time field surfaced here; visits stay in their existing nav card. Only appointments (which have `starts_at`) appear as the timed "today's appointment".
- **No remote push / reminders work** — untouched; copy makes no delivery promises.
- **No new tokens or theme changes** — reused the accent/elevation tokens already added in the icon-foundation phase; no restyle of other screens.
- **No timezone math** — kept the app's existing local-time model; the long date degrades to `YYYY-MM-DD` if `Intl` locale data is unavailable.
- **No removal of feature cards** — including the medications card, which now mildly overlaps the Today dose info by design (Today = the loop; the card = the entry point).

---

## Accessibility / RTL / dark mode notes

- **Touch targets:** Today highlight rows use `minHeight: TouchTarget.comfortable + Spacing.three` (well over 48dp); the ring card is a full-surface button. Spacing between rows preserved.
- **Status = icon + text + color:** the ring pairs tone with a count/icon and an explicit text caption; highlight rows pair an `<Icon>` chip with label + value text.
- **Labels visible; readable text:** row labels use `small` (14sp), values `cardTitle` (17sp), the greeting `title` (30sp); no text below 14sp introduced.
- **RTL:** all rows/strips use logical flex (no hardcoded left/right); the chevron mirrors centrally via `<Icon name="chevron">`; times are wrapped in `LtrText` (bidi-isolated) so they read correctly inside Arabic; date uses Western digits.
- **Screen readers:** the ring card and each highlight row are single button nodes with composed `accessibilityLabel`s (e.g. "Next dose: <name> <time>"); decorative graphics are hidden.
- **Dark mode:** every color resolves through `useTheme()` tokens (accent/success/border/sunken/divider); no hardcoded colors added.

---

## Medical-safety notes

- The care ring and highlights present **recorded scheduling facts only** — doses given vs. scheduled, the next dose time, today's appointment, tasks due. No interpretation, no "good/bad", no color-by-health.
- The ring's tones mean **task-loop state** ("today/now", "loop closed", "nothing scheduled"), explicitly not health status; this is stated in the component's documentation and reinforced by the worded caption.
- No copy implies notification/reminder delivery guarantees.
- Existing medical-safety disclaimers on the feature screens are untouched.

---

## Regression risks and how they were avoided

- **Protected recent-fix files:** none touched (pickers, selectors, schedule validation, notification opt-in/hooks, etc.). Confirmed via `git status` — only `circle-dashboard.tsx`, `date.ts`, the two locale files, and two new files changed.
- **Existing navigation:** preserved — all feature cards and the settings group remain and navigate as before; they are only re-grouped under a heading.
- **Shared queries:** reused existing hooks; React Query dedup means no duplicate network calls and no new loading behavior on the cards.
- **Notification bell / badge:** untouched.
- **Encoding:** the two locale files were CRLF in the working tree (pre-existing); normalized to LF so `git diff --check` is clean and the LF guard is honored. New `.tsx` files were written as LF.
- **Type safety / icons:** `tsc --noEmit` clean; all icons go through the semantic `<Icon>`; no icon family imported outside `icon.tsx`; `glyphs.ts` untouched and still the fallback.
- **Date formatting:** `Intl` is wrapped in try/catch with a `YYYY-MM-DD` fallback, so a missing-locale-data runtime cannot crash the header.

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **Pass** (exit 0) |
| `npm run check:mojibake` | **Pass** — 225 files, no signatures |
| `git -c core.autocrlf=false diff --check` | **Pass** (clean, no CRLF warnings after LF normalization) |
| `npx expo-doctor` | **Pass** — 21/21 checks |
| `git status --short` | 4 modified + 2 untracked components (+ this report) |
| `git diff --stat` | 4 files, +102 / −38 |

No commit was made.

---

## Real-device QA checklist (S24 Ultra: Android, Arabic, RTL, dark mode)

```
[ ] Home opens today-first: header + date, recipient context, then the Today section; feature nav is clearly below
[ ] Care ring shows correct state: empty (no doses), in-progress (X/Y + accent), complete (check + success)
[ ] Ring caption text matches the ring (never color-only); segments fill from the start (right) edge in RTL
[ ] Next dose row shows the earliest not-given dose with its time (LTR-isolated); taps into Medications
[ ] Today's appointment row shows today's first appointment + time, or a calm empty state; taps into Appointments
[ ] Tasks-due row shows the count or empty state; taps into Tasks
[ ] Date renders in Arabic with Western digits (or degrades to YYYY-MM-DD) — no crash
[ ] Feature cards + settings group still present and navigate correctly under "All care sections"
[ ] Emergency card still prominent and one tap from home
[ ] Touch targets >= 48dp; rows comfortably tappable with a thumb
[ ] Dark mode: ring, segments, captions, rows all legible; no hardcoded colors
[ ] Font scaling 130% / ~200%: ring caption and rows wrap without clipping
[ ] TalkBack: ring card and each row announce a single coherent label; decorative graphics skipped
[ ] No mojibake anywhere in the new Arabic strings
[ ] Pickers / weekday selector / option-select / schedule validation / notifications all still behave (regression guard)
```

---

## Open follow-ups

1. **Activity Feed** — when a per-event activity/log source exists, add a real "recent activity" strip below Today (e.g. "Ahmad gave the 8:00 dose — 20 min ago"). Deferred: no data source today.
2. **Animated ring** — optionally animate the loop fill / segments later (reduced-motion aware); the current static version is the agreed phase-1 form.
3. **Timezone-aware "today"** — align the dashboard's local-time "today" with each circle's timezone when the scheduling timezone work lands.
4. **Next visit + handoff** — surface today's visits (and "who's on duty") in Today once a timed/owned data shape is available.
5. **Greeting personalization** — optionally fold the recipient's name into the greeting once copy is decided (kept generic for now).
6. **Eyebrow token** — the `eyebrow` type token (added in the icon-foundation phase) is intentionally unused here because letter-spacing can break Arabic letter joining; revisit for Latin-only contexts.
```
