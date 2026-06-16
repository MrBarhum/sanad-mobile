# Figma Exact-Copy — Full-App Parity Pass

**Date:** 2026-06-16
**Scope:** Broad pass — fix the Home dose-pill mismatch, build the shared Figma primitives, and migrate the rest of the app's screens to the Figma Make visual language on real Sanad data. **No new dependencies. Managed Expo (no prebuild/run/EAS). Not committed.**
**Source of truth:** `docs/figma/make-export/extracted/src/app/components/*`.

---

## 1. Summary

Built **7 new shared Figma primitives** and migrated **12 screens** (Home dose-pill correction + Explore, Account, Medications, Emergency, Notifications, Tasks, Appointments, Vitals, Doctors, Members, Daily Logs, Visits) to the Figma look — Cairo + lucide + `react-native-svg` + the `src/components/figma/*` primitives + exact Figma tokens — each wired to the **existing real hooks** (no Figma mock data). Every target route now renders a Figma component. Old Sanad visuals (`Screen`/`Surface`/`Section`/`DashboardTile`/`NavCard`/`Button`/`StatusBadge`/`GlyphChip`) are bypassed on migrated screens; their data/logic hooks are reused unchanged.

**12/12 screens ported. Full-project `tsc`, mojibake, `diff --check`, and `expo-doctor` all pass.** No backend/validation/notification-registration/picker logic touched; add/edit forms keep their existing validated routes.

---

## 2. Home dose-pill correction

The Home care-loop hero strip and the dose list now distinguish **logged vs pending** exactly like the Figma `statusConfig`:
- **given** → teal-green `#5AAE85` + check, on a **12% tint**.
- **postponed** → gold `#C8904A` + clock, 12% tint. **missed** → red `#C45050` + X, 12% tint.
- **pending / unlogged / future** → **solid cream/elevated `mutedSurface`** (Figma `var(--muted)` = `#26231E` dark / `#EDE8DF` light) + clock + muted text — visibly **lighter/off-white**, not the dark/teal logged look.

Added a `mutedSurface` token (both palettes) + a `FigmaStatus` color map + an `overlay` token to `figma-tokens.ts`. Updated `figma-home.tsx` (`DoseStrip` pills, the dose-row status circle, and the status tag) to use `mutedSurface` for pending and `withAlpha(color, 0.12)` for logged. Status stays icon + text + color throughout (never color-only).

---

## 3. Shared Figma primitives built (priority B)

All under `src/components/figma/` (consumed by the screens; none route through old Sanad visuals):
- **FigmaHeader** — round back (ArrowRight) + centered title + round teal `+` (or a `trailing` action). RTL places back at the right.
- **FigmaButton** — primary (teal), secondary (elevated+hairline), danger (red); Cairo bold, ≥52dp, optional lucide icon, loading/disabled.
- **FigmaStatusPill** — rounded-full icon + label on a tint (or a solid `background` for pending); status never color-only.
- **FigmaSegmentedTabs** — today/all, today/open/done, upcoming/completed; active = filled teal.
- **FigmaListRow** + **FigmaSectionLabel** — grouped-list row (tinted icon chip or letter avatar + title + subtitle + chevron) for Explore/Account/Members; eyebrow label.
- **FigmaField** — labelled rounded RTL input (foundation for future form sheets).
- **FigmaBottomSheet** — rounded-top sheet over a scrim with a grab handle (foundation for future forms).

(Plus the Phase 0/1 `FigmaScreen`, `FigmaCard`, `IconChip`, `CareLoopRing`, `FigmaTabBar`, `figma-tokens`.)

---

## 4. Screens migrated — Figma structure, real data, and what was replaced

Every screen: outer `FigmaScreen`, Cairo, lucide, exact Figma tokens; old Sanad visual stack bypassed; existing hooks reused verbatim; add via the existing `/new` route (forms not rebuilt); detail `/[id]` screens unchanged.

| Screen | Figma structure copied | Real data (existing hooks) |
|---|---|---|
| **Explore** *(route rewritten)* | 26px title + subtitle, 3 `FigmaSectionLabel` groups of hairline-separated `FigmaListRow`s (icon chip + label + sublabel + chevron), category-tinted chips | Static feature index → `router.push` to existing routes (each resolves its own circle via CircleGate). No mock counts. |
| **Account** *(route rewritten)* | Profile chip + email, grouped care-circle/settings list rows, full-width danger sign-out | `useAuth().user.email`, `useCircleSelection().activeCircle` (name/role/recipient); **exact existing sign-out logic kept** (deactivatePushToken + supabase.auth.signOut + error state) |
| **Medications** | Header + summary pill + `FigmaSegmentedTabs` today/all; dose cards (Pill chip, name+dose, time, status pill, inline "تسجيل"→given/postponed/missed); med rows + schedule chips + active badge | `useTodayDoses`, `useActiveMedications`, `useActiveSchedules`, `useLogDose`, `summarizeDoses` — gated by `canLog`/`canManage` |
| **Emergency card** | Red-tinted identity header (Siren + name/age) + "للاطلاع فقط" note, medical-info list, contacts + doctors one-tap CALL rows, disclaimer | `useRecipient`, `useEmergencyContacts`, `useDoctors`; `Linking` `tel:` (existing pattern); `approximateAgeYears`. No SOS / guaranteed-response copy. |
| **Notifications** | Header + "قراءة الكل" trailing action, unread banner, per-type icon-chip rows (unread tinted + dot/bold), empty/load-more | `useNotifications`, `useMarkAllRead`, `useMarkNotificationRead`, `useOpenNotification`; `read_at` semantics reused |
| **Tasks** | Header + `FigmaSegmentedTabs` today/open/done; rows = checkbox (complete) + title (strike when done) + note + due + assignee + cancel X | `useTasks`, `useCompleteTask`, `useCancelTask`; exact filter/sort + `canActOn` permission copied from the center |
| **Appointments** | Header + upcoming/completed tabs; cards = Calendar chip + title + doctor/type + completed pill + date/time/location meta | `useUpcomingAppointments`, `useDoctors` (doctor-name map); type/status labels reused |
| **Vitals** | Header + strong non-diagnostic disclaimer + 2-col cards (type chip + value+unit + timestamp) | `useVitals`, `formatVitalValue`; **value + unit + time only, no normal/abnormal, no health-color** |
| **Doctors** | Header + doctor cards (Stethoscope chip + name/specialty/clinic + one-tap CALL row) | `useDoctors`; `Linking` `tel:`; add via the reused `DoctorFormModal` (exported from the manager) |
| **Members** | Header + summary line + member rows (letter avatar + name + you-badge + role icon/label + email + remove) + plain-language role legend | `useCircleMembers`, `useUpdateMemberStatus`; real permission gating (`canChangeStatus`/`isLastActiveAdmin`/owner) copied verbatim |
| **Daily Logs** | Header + "ملاحظات عائلية… ليست تقييمات طبية" note + log cards (date + observation rows: mood/sleep/appetite/hydration/mobility + notes wells) | `useDailyLogs`, `describeDailyLog`/`describeDailyLogNotes`; observational only |
| **Visits** | Appointments visual language applied to visits: header + upcoming/recent tabs + cards (Users chip + visitor + status pill + date/time meta) | `useVisits`; status `planned/completed/cancelled`; "your visit" marker reused |

---

## 5. Real hooks / data used

Every screen reuses the **exact hooks the existing center/manager already used** (verified by each porting agent reading the center first), so the data layer is unchanged: `useTodayDoses`/`useActiveMedications`/`useActiveSchedules`/`useLogDose`/`summarizeDoses`, `useTasks`/`useCompleteTask`/`useCancelTask`, `useUpcomingAppointments`/`useDoctors`, `useVisits`, `useVitals`/`formatVitalValue`, `useDailyLogs`/`describeDailyLog*`, `useRecipient`/`useEmergencyContacts`, `useNotifications`/`useMarkAllRead`/`useMarkNotificationRead`/`useOpenNotification`, `useCircleMembers`/`useUpdateMemberStatus` + permission helpers, `useAuth`, `useCircleSelection`. Routes keep `CircleGate` and its `circleId`/`canManage`/`canLog` props where present. No new queries, no backend/schema/RPC changes.

---

## 6. What old Sanad visuals were replaced

On migrated screens, bypassed: `Screen`, `Surface`/`Card`/`Section`, `Button`, `StatusBadge`, `GlyphChip`, `NavCard`, `ContactCard`, `InfoBanner`, `EmptyState`/`ErrorState`/`LoadingState`, `ThemedText`/`ThemedView`, `CircleSwitcher`/`CircleTimezoneCard` (Account), `NotificationBell` (Account header), `ReminderNotice`, the `Glyph`/Ionicons icon set, and the `constants/theme` scale — replaced by the Figma primitives + Cairo + lucide + Figma tokens. The old `*-center.tsx`/`*-manager.tsx` files remain on disk (now unused by their routes; safe to delete in a later cleanup) so nothing else that might import them breaks. `doctors-manager.tsx` was lightly edited to **export** its existing `DoctorFormModal` (reused by the Figma doctors screen for add) — no logic change.

---

## 7. What differs from Figma, and why (honest)

- **Mock data dropped everywhere** — all Figma hardcoded arrays/names/counts/phones replaced with real data or calm empty states.
- **Recipient name in headers/subtitles** — Figma hardcodes "أحمد"/"والدي أحمد". Explore (no circle context) uses a generic subtitle; Account shows only the real email (no fabricated display name/phone); Members uses the real recipient/circle name.
- **Per-item colors** — Figma assigns a fixed hue per med/appt/doctor/vital; with no color field, screens cycle the `FigmaCategory` ramp by index (vitals/daily-logs use a fixed per-type accent — decorative only, never health coding).
- **Add forms not rebuilt** — the Figma in-screen add sheets are replaced by navigation to the existing validated `/new` routes (Doctors reuses the existing `DoctorFormModal`). Preserves schedule/medication/etc. validation.
- **Account theme toggle dropped** — the app follows the OS scheme (no theme store); a toggle would be non-functional. Notification-settings folded into the care-circle group; every real destination preserved.
- **Loading/empty/error states added** — the static Figma had none; real async data needs them (calm, tokenized).
- **Emergency** — omits the Figma "current medications" block (no meds source in the emergency data layer; meds live on `/medications`) and any SOS/guaranteed-response copy.
- **Counts not shown where unavailable** — e.g. Account "3 members", Explore per-item counts (no member-count field / static screen) → omitted rather than faked.
- **Notifications** — real `created_at` timestamp instead of the Figma relative-time strings (no relative-time source); per-circle filter + push opt-in banner omitted (not on the Figma notifications screen; push logic untouched and still reachable via settings).
- **Visits** — tabs are upcoming/recent (status-safe) and the location row is omitted (no location column); "your visit" marker shown instead.

---

## 8. Exact blockers left

- **Type sizes are Figma-small** (10–22px) by design — below Sanad's older-adult accessibility floor (the accepted exact-copy tradeoff; an opt-in larger-text scale remains a future option).
- **Add/edit & detail screens not yet Figma-ported** — they keep the existing Sanad visuals; this pass covered the centers/lists/cards. (Doctors add reuses the existing modal.)
- **Doctor name on appointments** uses the doctor-id→name map; **specialty/location** shown where stored.
- **Care-ring fill animation** still static (deferred).
- **Old `*-center.tsx`/`*-manager.tsx`** remain as orphaned files (cleanup deferred).

---

## 9. Protected files untouched — confirmation

Not modified: Supabase/backend, `**/api.ts` + `**/hooks.ts` (consumed only — no logic change), auth providers, medication validation (`schedule-validation.ts`, `schema.ts`), schedule fields, picker internals (`date-field`/`time-field`/`date-time-field`/`picker-sheet`/`weekday-selector`/`timezone-picker`/`option-select`), notification registration/push-token/channel (`push-registration.ts`, `notifications/hooks.ts` consumed only, `notification-settings.tsx`, `push-status-card.tsx`, `reminder-notice.tsx`), `package.json`/`package-lock.json`, `app.json`/`eas.json`, `.env`, SQL/migrations/Edge Functions. **No new dependencies installed; `npm install`/EAS/prebuild/run not executed.** No `git add`/commit/reset/restore/clean.

---

## 10. Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) — full project, all 12 ports + primitives + locales |
| `npm run check:mojibake` | **PASS** — 251 active files, no strong signatures |
| `git -c core.autocrlf=false diff --check` | **PASS** — clean (exit 0) |
| `npx expo-doctor` | **PASS** — 21/21 |
| locale `figma.*` ar/en symmetry | **PASS** — 72 leaf keys each, identical structure |

No commit; no `git add`; no `git reset/restore/clean`.

---

## 11. New dev build required?

**No new dev build required — Metro reload is sufficient.** This pass added **no new native dependencies**: `react-native-svg`, `lucide-react-native`, and Cairo were already installed and built into the current EAS dev client in Phase 0/1 (the app already opens on it). Everything here is JS/TS + locale JSON, which the running dev client picks up via Metro fast-refresh/reload. (A rebuild is only needed if a *new* native module is added — none was.)

---

## 12. S24 Ultra QA checklist (per migrated screen — Android, Arabic, RTL, dark primary)

```
GLOBAL
[ ] Reload Metro on the existing dev client (no rebuild). Cairo + lucide + ring render across all screens
[ ] FigmaTabBar (Phase 1) still navigates Home/Explore/Account; RTL order (Home at right)

HOME (dose-pill fix)
[ ] Pending/unlogged dose pills are LIGHT cream/elevated (mutedSurface) with a clock — clearly lighter than given (teal+check) / postponed (gold) / missed (red); never color-only

EXPLORE
[ ] Title + subtitle; 3 grouped sections of list rows with category-tinted chips; each row navigates to its feature; no fake counts

ACCOUNT
[ ] Real email shown; care-circle row (name + role/recipient) → members; notification settings + join links; sign-out works (deactivate token + signOut + error recovery)

MEDICATIONS
[ ] Summary pill; today/all tabs; dose cards with status pills; "تسجيل" expands given/postponed/missed (writes via useLogDose, gated by canLog); med rows + schedule chips; "+" → /medications/new (canManage); row → /medications/[id]

EMERGENCY
[ ] Red identity header + "للاطلاع فقط" note; real blood type/allergies/chronic/notes (or "غير محدد"); contacts + doctors CALL rows dial (tel:); disclaimer; NO SOS/guaranteed-response

NOTIFICATIONS
[ ] Unread banner + tinted/bold unread rows + dot; "قراءة الكل" marks all read; opening a row marks read + routes; empty/load-more

TASKS
[ ] today/open/done tabs; checkbox completes (gated); cancel X; done = strike + check; row → /tasks/[id]; "+" → /tasks/new

APPOINTMENTS
[ ] upcoming/completed tabs; cards with Calendar chip + title + doctor/type + completed pill + date/time/location (LTR times); row → detail; "+" → /appointments/new

VITALS
[ ] Strong non-diagnostic disclaimer; 2-col cards value+unit+time only; NO normal/abnormal, no health-color; "+" → /vitals/new

DOCTORS
[ ] Doctor cards (specialty/clinic when present) + CALL row dials; "+" opens the reused add modal (canManage)

MEMBERS
[ ] Summary line; member rows (avatar + name + you-badge + role icon/label + email); remove only when permitted; role legend; "+" → /circle-members/invite

DAILY LOGS
[ ] Family-notes disclaimer; log cards with observation rows (mood/sleep/appetite/hydration/mobility) + notes wells; "your log" marker; "+" → /daily-logs/new; row → detail

VISITS
[ ] upcoming/recent tabs; visit cards (Users chip + visitor + status pill + date/time); "your visit" marker; "+" → /visits/new; row → detail

CROSS-CUTTING
[ ] RTL correct; Western digits; times/phones LTR-isolated; dark primary + light coherent; font scale 130/200% wraps (note: Figma sizes are small); no mojibake; pickers/medication-validation/notifications unaffected
```

---

## 13. Open follow-ups

1. Device screenshot-compare each screen against the Figma on the S24 Ultra.
2. Port the **add/edit forms + detail screens** to Figma (this pass covered centers/lists).
3. Delete the now-orphaned `*-center.tsx`/`*-manager.tsx` once confirmed unreferenced.
4. Optional: per-feature category colors as real tokens; care-ring animation; an opt-in larger-text accessibility scale.

---

*Implemented via a 12-agent parallel port (each read its Figma source + the existing center to reuse real hooks verbatim, wrote the Figma component, and rewired the route); locale keys were collected and added centrally (72 `figma.*` keys, ar/en symmetric). Changed: `figma-tokens.ts`, `figma-home.tsx`, 7 new primitives, 10 new screen components, 12 rewired routes, `doctors-manager.tsx` (export only), 2 locale files, this report. No backend/secrets/config/package/EAS; not committed.*
