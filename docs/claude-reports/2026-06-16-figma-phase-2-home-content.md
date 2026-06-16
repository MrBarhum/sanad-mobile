# Figma Exact-Copy — Phase 2: Home Content

**Date:** 2026-06-16
**Scope:** Recreate the Figma Make Home (`HomeScreen.tsx`) as literally as possible in React Native using the Phase 0/1 foundation, wired to **real** Sanad data. The logged-in/circle Home now renders the new `FigmaHome` instead of the old dashboard/today-overview. **Managed Expo — no `expo run:android`/prebuild/EAS/build. Not committed.**
**Source of truth:** `docs/figma/make-export/extracted/src/app/components/HomeScreen.tsx`.

---

## 1. Summary

`src/features/care-circle/figma-home.tsx` is a 1:1 translation of the Figma Home, built from the Phase 0/1 Figma primitives (`FigmaScreen`, `FigmaCard`, `CareLoopRing`, `IconChip`, `figma-tokens`, Cairo, lucide) — **not** through any old Sanad component. The Home entry (`(tabs)/index.tsx`) now renders `<FigmaHome circle={…} />` for the has-circle branch; the old `CareCircleDashboard` / `TodayOverview` are bypassed.

Every value is real: the care-loop ring + doses come from `useTodayDoses`/`summarizeDoses`, dose logging from `useLogDose` (gated by `canLogDoses`), the summary from `useTodayTaskSummary`/`useTodayAppointmentSummary`, the next-appointment from `useUpcomingAppointments`, the recipient context (age/dialect) and the emergency banner (blood type/allergies) from `useRecipient`, and circle switching from `useCircleSelection`. No mock arrays from the Figma export were used.

All four validations pass. **A dev-client rebuild is still required to render** (react-native-svg native module from Phase 0) — see §9.

---

## 2. Figma Home structures copied

Top → bottom, matching `HomeScreen.tsx`:

1. **Header** — date (12, muted) → recipient/circle name (20, bold) + `ChevronDown` → context subtitle (12, muted); round **44px** `Bell` (elevated + hairline) and round **44px** red `Phone` (emergency, `error@12%` bg + `error@20%` border). lucide icons, exact spacing.
2. **Compact circle dropdown** — toggled by the name row; lists real circles (active gets a teal `Check`) + a "join another circle" footer. The Figma inline `mx-5` dropdown idiom, **not** the old `CircleSwitcher` card.
3. **Care-loop hero** — `FigmaCard` rounded-3xl: eyebrow "دورة الدواء · اليوم" + "عرض الكل" link; the **SVG `CareLoopRing`** (given/total); the right column = the all-given chip / "الجرعة القادمة" next-dose chip / empty text; a wrap **status strip** of dose time-pills tinted by status.
4. **Today summary** — two stat cards (rounded-2xl, 22px number): tasks due today, appointments today, with icon + small label + sub-label.
5. **Next appointment** — rounded-3xl card: 48px blue `Stethoscope` chip + when/title/location + `ChevronLeft` (only when real data exists).
6. **Quick actions** — "وصول سريع" + a **4-up** grid of icon-chip tiles with the Figma category colors (vitals blue, logs purple, doctors green, members gold).
7. **Today's doses** — "جرعات اليوم" + "كل الأدوية"; compact rows (36px status circle + name/dosage + time + status tag) with an inline **"تسجيل"** that expands to أُعطيت / مؤجَّلة / لم تُعطَ.
8. **Emergency banner** — red-tinted rounded-3xl row (44px `AlertCircle` chip + title + subtitle + filled red "عرض" button), one tap to the emergency card; calm, no guaranteed-response copy.

---

## 3. Files changed

**New**
- `src/features/care-circle/figma-home.tsx` — the Figma Home composition + `StatCard` / `DoseRow` subcomponents.

**Modified**
- `src/app/(app)/(tabs)/index.tsx` — has-circle branch renders `FigmaHome` (was `CareCircleDashboard`).
- `src/locales/ar.json`, `src/locales/en.json` — **13 new keys** under `careCircle.dashboard.today` (`medLoopEyebrow`, `allDosesGiven`, `allMedications`, `quickActions`, `dueTodayShort`, `ageYears`, `apptTodayAt`, `joinAnotherCircle`, `emergencyTitle`, `emergencyView`, `emergencyBlood`, `emergencyAllergy`, `emergencySubtitle`); both files symmetric (38 `today` keys each).

**Report**
- `docs/claude-reports/2026-06-16-figma-phase-2-home-content.md`.

**Intentionally left in place (now unused by Home):** `circle-dashboard.tsx` and `today-overview.tsx` (+ the Phase-C `today-care-ring`/`dashboard-tile`/stat cards) are no longer imported by Home. They still compile; a later cleanup can delete them. Kept this change focused (4 source files + 2 locales) rather than ripping out the old tree.

---

## 4. Real hooks / data used

| UI element | Hook / source | Notes |
|---|---|---|
| Care ring `given/total`, status strip, doses list | `useTodayDoses(circleId, todayYmd())` + `summarizeDoses` | Real dose items; sorted by time. |
| Next dose chip | earliest `doses.find(d => d.status !== 'given')` | Real; name + LTR time + dosage. |
| Dose logging (تسجيل → given/postponed/missed) | `useLogDose(circleId).mutateAsync` | Real write; gated by `circle.canLogDoses`. |
| Tasks stat | `useTodayTaskSummary(circleId).summary.dueToday` | Real. |
| Appointments stat | `useTodayAppointmentSummary(circleId).count` | Real today count. |
| Next-appointment card | `useUpcomingAppointments(circleId)` → first non-cancelled | Real title/time/location; today → "اليوم، الساعة HH:MM". |
| Header name + subtitle | `useCircleSelection().activeCircle.circleName` + `useRecipient(circleId)` (`approximateAgeYears(birth_date)`, `dialect`) | Real; falls back to `recipientName`. |
| Circle dropdown / switch | `useCircleSelection()` (`circles`, `activeCircleId`, `setActiveCircle`) | Real switch; "join another" → `/join-circle`. |
| Emergency banner subtitle | `useRecipient(circleId)` (`blood_type`, `allergies`) | Real; calm generic fallback if empty. |
| Date | `formatLongDate(i18n.language)` | Western digits. |

No backend queries added; no Supabase touched; React Query dedupes shared keys.

---

## 5. Old Home pieces bypassed / replaced

- **`CareCircleDashboard`** (the old header + `CircleSwitcher` card + `TodayOverview` + quick-access grid) → replaced as the Home render by `FigmaHome`.
- **`TodayOverview`** (Phase-C hero + tiles) → bypassed.
- **`CircleSwitcher` card** → replaced by the compact Figma header name + `ChevronDown` + inline dropdown (real switch logic reused via `useCircleSelection`).
- **`today-care-ring.tsx` (View ring)** → not used by Home; the SVG `CareLoopRing` is used instead.
- **`DashboardTile` / `StatTile` / Sanad `Surface`/`Section`/`Screen`** → not used by Home; replaced by `FigmaCard`/`FigmaScreen`/`IconChip` + bespoke Figma rows.
- **Sanad `<Icon>` (Ionicons/MCI)** → Home uses **lucide-react-native** directly.
- **IBM Plex on Home** → Home text uses **Cairo** (`FigmaFont`).

---

## 6. What differs from Figma, and why

- **Header subtitle** — Figma shows "82 سنة · مسقط، عُمان". The circle/recipient model stores **age (from `birth_date`)** and **dialect**, but **not a city/location**. So the subtitle shows age + dialect when present, else the recipient name. No mock location.
- **Next-appointment card** — Figma shows a doctor name + specialty + hospital. Sanad appointments store **title + time + location** (doctor is a `doctor_id` reference). To avoid an extra query/join this phase, the card shows **when + title + location** (real). Doctor-name enrichment is a later refinement. The card is **omitted entirely when there is no upcoming appointment** (no mock).
- **Tasks stat** — Figma shows "2 / 4 مكتملة" (completed/total). Sanad cleanly exposes **due-today**; showing a "total today" would be derived/ambiguous, so the stat shows **due today** + "مستحقّة اليوم". Honest over invented.
- **Quick actions** — copied the Figma **4** (vitals / daily logs / doctors / members) exactly. Visits, recipient profile, and emergency-contacts are **not** on the Figma Home (reachable via Explore / Account / the Emergency card) — kept literal rather than padding the grid.
- **Circle dropdown footer** — Figma says "+ إنشاء دائرة جديدة" (create). Sanad has no standalone create-circle route from Home (creation is the no-circle onboarding), so the footer is the real **"الانضمام إلى دائرة أخرى" → `/join-circle`**.
- **Ring** — a true SVG arc (300°, teal) per the Figma; the optional 0.6s fill animation is deferred (static for now).
- **Dose status wording** — uses Sanad's existing safe keys (أُعطيت / مؤجَّلة / لم تُعطَ) rather than the Figma's "فائتة / تأجيل", for app-wide consistency and medical-safety.
- **Type sizes** — copied the Figma's small sizes (10–22px) via `figma-tokens`; this is intentionally below Sanad's older-adult accessibility floor (the accepted exact-copy tradeoff from the plan).

---

## 7. Exact-match blockers left

- **Native render needs a dev-client rebuild** — `CareLoopRing` (svg) and the lucide icons won't render until the dev client includes `react-native-svg` (Phase 0). Not buildable in this task (managed, no prebuild/EAS allowed).
- **Doctor name on the appointment card** — needs a doctors lookup by `doctor_id` (deferred).
- **Location/city in the header** — not in the data model (shows age + dialect instead).
- **Ring fill animation** — deferred (static arc).
None are React-Native limitations; each is a data-enrichment or build step, not a rendering impossibility.

---

## 8. Protected files untouched — confirmation

Not modified: medication validation (`schedule-validation.ts`, `schema.ts`), `schedule-fields.tsx`, picker internals (`date-field`/`time-field`/`date-time-field`/`picker-sheet`/`weekday-selector`/`timezone-picker`/`option-select`), notification registration/push hooks (`push-registration.ts`, `notifications/hooks.ts`, `notification-settings.tsx`, `push-status-card.tsx`, `reminder-notice.tsx`), Supabase/backend (`**/api.ts` data fetchers consumed, not changed), `app.json`/`eas.json`, `package.json`/`package-lock.json`, `.env`. `useLogDose`/`useRecipient`/the summary hooks were **consumed, not modified**. No EAS/Firebase/Supabase/SQL/deploy. No `git add`/commit/reset/restore/clean.

---

## 9. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) — incl. recipient/appointment row fields, lucide, svg, router |
| `npm run check:mojibake` | **PASS** — 233 active files, no strong signatures |
| `git -c core.autocrlf=false diff --check` | **PASS** — clean (exit 0) |
| `npx expo-doctor` | **PASS** — 21/21 |
| locale JSON parse + ar/en `today` symmetry | **PASS** (38 keys each) |

No commit; no `git add`; no `git reset/restore/clean`.

---

## 10. Dev-client rebuild note

**Required before the new Home is visible.** `react-native-svg` (added in Phase 0) is a native module absent from the current dev-client binary, and lucide renders through it. This is a **managed Expo** project with no `android/` folder, so the rebuild is done with **`npx expo run:android`** (or a dev-client EAS build) — **explicitly out of scope here and not run**. Until then, the Home (ring + lucide icons) will not render / may error. Cairo + tokens load without a rebuild.

---

## 11. S24 Ultra QA checklist (Android, Arabic, RTL, dark — primary)

```
[ ] (Prereq) Dev client rebuilt with react-native-svg (npx expo run:android)
[ ] Home matches the Figma Home: header → hero → 2 stats → next appointment → 4 quick actions → doses → emergency banner
[ ] Header: date, circle name + chevron, age/dialect subtitle (real); 44px bell → notifications; 44px red phone → emergency card
[ ] Tapping the name opens the compact dropdown; real circles listed; active has a teal check; switching changes the active circle; "الانضمام إلى دائرة أخرى" → join
[ ] Care ring: SVG 300° arc, teal fill ∝ given/total, given/total + "جرعات اليوم" centered in Cairo; total=0 shows a neutral ring + "لا جرعات مجدولة اليوم"
[ ] All-given state shows the green "جميع الجرعات أُعطيت" chip; otherwise the "الجرعة القادمة" chip with name + LTR time
[ ] Status strip: time pills tinted by status, fill from the start (right) edge in RTL
[ ] Two stat cards show real tasks-due / appointments-today counts
[ ] Next appointment card appears only with real data (when/title/location); absent otherwise
[ ] Quick actions: 4 tiles (vitals/logs/doctors/members) with category colors; each navigates
[ ] Doses list: rows with status circle + name + dosage + time + status tag; "تسجيل" expands to أُعطيت/مؤجَّلة/لم تُعطَ; logging writes and updates the ring/strip
[ ] Viewer role (canLogDoses=false): no "تسجيل"/actions; shows "لم تُسجّل بعد"
[ ] Emergency banner: red-tinted, real blood type/allergies if present (else calm subtitle); "عرض" → emergency card; no guaranteed-response wording
[ ] Cairo renders across the screen; RTL correct; times LTR-isolated; Western digits
[ ] Dark mode primary; then sanity-check light mode
[ ] Font scale 130%/200%: wraps without clipping (note: Figma sizes are small by design)
[ ] No mojibake in any Arabic string
[ ] Regression: bottom tabs (Phase 1 FigmaTabBar) still navigate; medications/pickers/notifications unaffected
```

---

*Inspected (read-only): the Figma `HomeScreen.tsx`, `(tabs)/index.tsx`, circle-selection provider, recipient-profile hooks/schema, appointments api, `utils/date`. Changed only: `figma-home.tsx` (new), `(tabs)/index.tsx`, the two locale files, and this report. No backend/secrets/config/package/EAS; not committed.*
