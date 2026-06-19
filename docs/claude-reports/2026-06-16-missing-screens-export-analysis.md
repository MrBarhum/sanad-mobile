# New Figma Make "Missing Screens" Export — Analysis & Implementation Plan

**Date:** 2026-06-16
**Type:** Analysis / planning only. **No source changed. Not committed.**
**New export:** `docs/figma/make-export/missing-screens-2026-06-16/extracted`
**Original export (reference):** `docs/figma/make-export/extracted`
**Audit refs:** `docs/claude-reports/2026-06-16-unmigrated-screens-and-flows-audit.md`, `docs/figma/sanad-mobile-missing-screens-figma-make-prompt.md`, `docs/claude-reports/2026-06-16-figma-full-app-parity-pass.md`

> **Method:** 9 parallel read-only inspectors read the new export's `App.tsx` shell, every new screen component, `theme.css`/`fonts.css`, and cross-referenced the unmigrated-screens audit + the committed Sanad routes/hooks.

---

## 1. Executive summary

The new export **appended 15 new frames** (Splash, SignIn, SignUp, CreateCircle, JoinCircle, NotificationSettings, InviteMember, RecipientProfile, and six `Add*` forms — Medication, Task, Appointment, Visit, DailyLog, Vital) plus a re-exported `VisitsScreen`, on top of the 13 already-implemented centers (re-exported = duplicates). This **closes most of the audit's "missing-from-export" add-form + auth/onboarding + invite + settings + profile blueprints**.

**Three load-bearing caveats — the blueprints are usable for layout/structure/copy ONLY, never as a literal port:**

1. **They regressed to brand-BLUE + IBM Plex.** The export's `theme.css` is the correct teal+Cairo, but **all 14 generated screens ignore it and hardcode `primary: "#2F6FD0"` (blue) + `'IBM Plex Sans Arabic'`** (62 occurrences). The implemented app is **teal `#4BA898`/`#2E8A7B` + Cairo**. Every port must retint to teal + Cairo via `figma-tokens`.
2. **They use native web date/time inputs and omit validation.** Every date/time is a browser `<input type="date|time">` (calendar/clock), **not** Sanad's protected wheel picker. AddMedication has **no duplicate-time/conflict validation** (the P0 medical-safety guard); AddAppointment has **no end-before-start**; AddDailyLog has **no "غير محدّد" unset chip and no distinct pain-"none"**; AddVisit shows the **link-to-self toggle to everyone (RLS violation)**. The shipped Sanad forms are stricter and correct — porting must **keep the existing logic** and use the blueprint for visuals only.
3. **The target routes are functionally built but still OLD-UI.** Per the audit, the add forms / auth / onboarding / join / invite / recipient-profile / notification-settings routes work but render the **old Sanad visual layer** (the "partial seams"). So these blueprints are **reskin targets**, not redundant. The correct strategy is **reskin-in-place to the Figma language, preserving all protected logic, pickers, validation, gating, and RLS.**

**Still NOT generated (biggest open gaps, all P0/P1):** every `/[id]` **detail/edit** screen (medication/task/appointment/visit/log/vital), the **managed medication schedule editor + duplicate-time/conflict state**, **AddDoctor + doctor edit/delete**, the **emergency-contacts manager**, **invitations-list + revoke**, the **change-role modal**, **remove-member confirm**, **make-owner/leave/reactivate + inactive section**, the **standalone picker kit**, the **reminder-notice banner**, and the **Home loading/error/no-circle states**.

**Product-rule status:** Vitals non-diagnostic = **PASS**; notification opt-in honesty = **PASS (intent)**; emergency reference-only = **N/A** (no emergency editor generated). Violations are all theming/validation/RLS issues in the blueprints (above), plus invented data (hardcoded doctor/assignee names) — none should be ported.

---

## 2. New export file/component inventory

From `App.tsx` (state-stack navigator, `isDark` default, dark-toggle + a left-side "SCREENS جديدة" demo panel). New `ScreenId`s and their frames:

| Export frame | Reached in export | New vs original export |
|---|---|---|
| `SplashScreen` | boot → signin | **NEW** |
| `AuthScreens` → `SignInScreen` / `SignUpScreen` | splash → signin → signup → create-circle | **NEW** |
| `CreateCircleScreen` | after sign-in (no-circle) | **NEW** |
| `JoinCircleScreen` | create-circle → "join instead" | **NEW** |
| `NotificationSettingsScreen` | account → settings | **NEW** |
| `InviteMemberScreen` | members → invite | **NEW** |
| `RecipientProfileScreen` | (demo panel) | **NEW** |
| `AddMedicationScreen` | medications → + | **NEW** (orig. export had only a 3-field stub) |
| `AddTaskScreen` | tasks → + | **NEW** (orig. had a 1-field stub) |
| `AddAppointmentScreen` | appointments → + | **NEW** (orig. `+` was a dead button) |
| `AddVisitScreen` | visits → + (header + footer FAB) | **NEW** |
| `AddDailyLogScreen` | daily-logs → + | **NEW** (orig. had a chips-only stub) |
| `AddVitalScreen` | vitals → + | **NEW** (orig. had a 3-field stub) |
| `VisitsScreen` | visits tab (now wires `onNavigate→add-visit`) | re-export of an implemented center + adds the add entry |
| Home/Explore/Account/Medications/Emergency/Notifications/Tasks/Appointments/Vitals/Doctors/Members/DailyLogs/BottomNav | tabs/stack | **DUPLICATES** of implemented centers |
| `src/styles/theme.css` | — | teal+Cairo (correct) **but unused by the screens** |
| `ui/*` (≈60 shadcn primitives) | — | unused boilerplate; ignore |

---

## 3. Coverage matrix against the audit

| Audit surface | Priority | Old export | New export | Verdict |
|---|---|---|---|---|
| Sign in | P0 | missing | **generated** (blueprint) | reskin |
| Sign up + confirm-email | P0 | missing | **generated** (as a *separate* confirm screen) | reskin (keep inline notice per audit) |
| Create-circle onboarding | P0 | missing | **generated** | reskin (keep no-circle gate) |
| Join circle | P1 | missing | **generated** | reskin (keep RPC + error states) |
| Invite member + code reveal | P0 | partial sheet | **generated** | reskin |
| Notification settings + push + quiet hours + test | P1 | missing | **generated** | reskin (PROTECTED logic) |
| Recipient profile | P1 | missing | **generated** | reskin + **restore entry point** |
| Add medication (+ schedule) | P0 | shallow stub | **generated** (no validation) | reskin (keep duplicate-time guard) |
| Add task | P0 | 1-field stub | **generated** | reskin |
| Add appointment | P0 | dead `+` | **generated** | reskin (add end-before-start) |
| Add visit | P1 | missing | **generated** | reskin (fix RLS link-toggle) |
| Add daily log | P0 | chips stub | **generated** | reskin (add unset + pain-none) |
| Add vital | P0 | stub | **generated** (non-diagnostic ✓) | reskin (keep BP split, add `other`) |
| Splash | — | missing | **generated** (demo) | keep native splash; do not route |
| **Detail/edit `/[id]` (all 6 entities)** | P0/P1 | missing | **STILL MISSING** | design from scratch |
| **Medication schedule editor + dup-time/conflict state** | P0 | missing | **STILL MISSING** | design from scratch (safety) |
| **AddDoctor + doctor edit/delete** | P0 | missing | **STILL MISSING** | design from scratch |
| **Emergency-contacts manager** | P1 | missing | **STILL MISSING** | design from scratch |
| **Invitations list + revoke** | P1 | missing | **STILL MISSING** | design from scratch |
| **Change-role modal** | P0 | missing | **STILL MISSING** | design from scratch |
| **Remove-member confirm / make-owner / leave / reactivate / inactive** | P1/P2 | missing | **STILL MISSING** | design from scratch |
| **Standalone picker kit (date/time/weekday/timezone/option/sheet)** | P0 | missing | **STILL MISSING** | reskin existing primitives |
| **Reminder-notice banner** | P1 | missing | **STILL MISSING** | reskin existing |
| **Home loading/error/no-circle states** | P1 | missing | **STILL MISSING** | design from scratch |
| **Form-shell primitives (field/modal/actions/itemActions)** | P0 | missing | **STILL MISSING** | reskin existing |

---

## 4. Screens/components to implement (with mapping, data, strategy, risks)

> All of these are **reskin blueprints** for routes that are functionally built but still old-UI. **Strategy = reskin the existing component to the Figma language (teal `figma-tokens` + Cairo + `FigmaScreen`/`FigmaHeader`/`FigmaCard`/`FigmaButton`/`FigmaField`/`FigmaBottomSheet`/`IconChip`/`FigmaSegmentedTabs`), preserving ALL existing logic, pickers, validation, gating, and RLS. Use the blueprint for layout/structure/copy only; do NOT adopt its blue, IBM Plex, web pickers, or weaker validation.**

| Figma frame | Maps to (route → existing files) | Real data/hooks to keep | Strategy | Key risks (do NOT port) |
|---|---|---|---|---|
| `AddMedicationScreen` | `/medications/new` → `medication-form.tsx` + `schedule-fields.tsx` + `schedule-validation.ts` | `useCreateMedication`, `prepareSchedule`, `duplicateTimesInDraft`, `findScheduleConflicts`, `WeekdaySelector`, `TimeField`/`DateField` (wheel), `StickyFormActions`, `UnsavedChangesGuard`; `canManage` gate | reskin existing | **No duplicate-time guard** in blueprint; web date/time inputs; default-all-7-days (Sanad is opt-in empty); blue/IBM Plex |
| `AddTaskScreen` | `/tasks/new` → `task-form.tsx` | `useCreateTask`, `taskSchema`, `TASK_CATEGORIES` (8), `TASK_PRIORITIES` (4), assign-to-me Switch (`user.id`), `OptionSelect`, `DateField`/`TimeField` | reskin existing | Omits **category**; only 3 priorities; **invents assignee names** (real = assign-to-me boolean); web pickers; blue |
| `AddAppointmentScreen` | `/appointments/new` → `appointment-form.tsx` + `appointment-fields.tsx` | `useCreateAppointment`, `useDoctors` (data-driven doctor picker), `appointmentSchema` (+ `endBeforeStart`), `APPOINTMENT_TYPES` (7 enum) | reskin existing | **Missing end-before-start**; **hardcoded doctor names**; type chips keyed by Arabic labels not enum; web pickers; blue |
| `AddVisitScreen` | `/visits/new` → `visit-form.tsx` + `visit-fields.tsx` | `useCreateVisit`, `visitSchema` (+ `endBeforeStart`), manager-only link toggle vs collaborator static note (RLS), `DateField`/`TimeField` | reskin existing | **Link-toggle shown to all + default OFF (RLS violation)**; no end time; start wrongly required; web pickers; blue |
| `AddDailyLogScreen` | `/daily-logs/new` → `log-form.tsx` + `log-fields.tsx` | `useCreateDailyLog`, `prepareDailyLog`, `MOODS/SLEEP/APPETITE/HYDRATION/MOBILITY` with `UNSET`, nullable `pain_level` + `painNone`, duplicate-date (`23505`→`alreadyLoggedToday`) | reskin existing | **No "غير محدّد" unset chip**; **pain defaults 0, no distinct "none"**; **no duplicate-date error**; web date input; blue; vitals-worded disclaimer (use `dailyLogs.disclaimer`) |
| `AddVitalScreen` | `/vitals/new` → `vital-form.tsx` + `vital-fields.tsx` | `useCreateVital`, `prepareVital` (BP needs both; `other` notes-only), `VITAL_READING_TYPES` (7), `DEFAULT_UNITS`, `DateTimeField` (wheel) | reskin existing | **Drops `other` type**; web date/time inputs; blue. Non-diagnostic = PASS. |
| `SignInScreen` | `/(auth)/sign-in` → existing | `supabase.auth.signInWithPassword`, `useAuth`, zod `credentialsSchema` (min-6), `auth.*` i18n | reskin existing | **Invents forgot-password link** (no reset flow — do not add); blue/IBM Plex; weaker validation; missing loading/error |
| `SignUpScreen` (+ confirm) | `/(auth)/sign-up` → existing | `supabase.auth.signUp`, `auth.signUpCheckEmail` | reskin existing; optionally promote the inline notice to a fuller success block | **8-char vs committed 6** (coordinated change only); **confirm-password field** (new — product decision); **resend link** (no wiring); **demo-bypass button**; blue |
| `CreateCircleScreen` | no-circle onboarding → `onboarding-form.tsx` (Home `hasNoCircles` gate) | `useCreateCareCircle`, `createCircleSchema`, `DateField` | reskin existing; **keep the Home gate** (no standalone route) | Web date input (keep `DateField`); drops prefilled circle-name default; blue |
| `JoinCircleScreen` | `/join-circle` → `join-form.tsx` | `useAcceptInvitation`, `acceptErrorKey` (invalid/expired/revoked/used/already-member), `useCircleSelection.setPreferredCircleId`, `InfoBanner` warning | reskin existing | **Fakes success, no RPC, only length≥5** (drops all real error states); blue |
| `InviteMemberScreen` (+ code reveal) | `/circle-members/invite` → `invite-form.tsx` (+ `CreatedCard`) | `useCreateInvitation`, `invitableRoles(actorRole)`, `copyInviteCode`/`shareInviteMessage`, `CircleGate`→`canManage` | reskin existing | **Wrong/invented role set** (real = `family_member`/`remote_member`/`primary_caregiver` allowlist); **no manager gate**; **omits expiry**; hardcoded code; blue |
| `RecipientProfileScreen` | `/recipient-profile` → `profile-form.tsx` | `useRecipient`/`useUpdateRecipient`, `recipientProfileSchema`, `DateField`, `FormActions`, `UnsavedChangesGuard`, `canManage` read-only gate | reskin existing **+ restore entry point** | **Read-only gate dead-coded (`{false &&}`)**; **birth date as free-text input** (keep `DateField`); blue |
| `NotificationSettingsScreen` | `/notification-settings` → `notification-settings.tsx` + `push-status-card.tsx` | `usePushRegistration` (honest multi-state), `useNotificationPreferences`/`useUpsertPreferences`, `PREFERENCE_TOGGLES` (8), `quietHoursValid`, `TimeField` (wheel), `getDeviceTimezone`, `scheduleLocalTestNotification` | reskin existing (**PROTECTED** push logic) | **Collapses honest multi-state push card to one boolean**; **no scope selector**; **no quiet-hours validation**; save always enabled; web time inputs; blue |

---

## 5. Screens/components to ignore as duplicates (do not port)

- **`VisitsScreen` + all 13 re-exported centers** (Home/Explore/Account/Medications/Emergency/Notifications/Tasks/Appointments/Vitals/Doctors/Members/DailyLogs/BottomNav) — already migrated and committed. The only useful signal: `VisitsScreen` confirms an add-visit entry (`onNavigate→add-visit`), which the live center already wires to `/visits/new`. No change.
- **`SplashScreen`** — boot is already handled by the native splash + `AnimatedSplashOverlay` (`animated-icon.tsx`) + `useAuth().isLoading`. Do **not** add a routed `/splash` screen or the demo "ابدأ التجربة" button (boot must auto-resolve). The logo/tagline copy is a brand reference only.
- **`theme.css` / `ui/*`** — `theme.css` is correct teal but unused by the screens; `ui/*` is unused shadcn boilerplate. Ignore both.

---

## 6. Missing screens still NOT generated by Figma (design these from scratch in the established Figma language)

- **Detail/edit `/[id]` for every entity** (medication, task, appointment, visit, daily-log, vital) — incl. status transitions (complete/cancel/reopen), read-only/role views, and **two-step delete**. **P0/P1.** *(The export is "add-only"; no edit/detail frame exists.)*
- **Managed medication schedule editor** (`schedule-modal-host` / `ScheduleCard` / weekly `ScheduleSummary`) **with the duplicate-time + cross-schedule conflict validation state** — **P0 medical-safety**.
- **AddDoctor form + doctor edit/delete** (re-attach to `FigmaDoctors`) — **P0** (doctors can be added but not edited/deleted today).
- **Emergency-contacts manager** (list + add/edit sheet + required phone + "رئيسية" + two-step delete) — **P1** (orphaned).
- **Invitations list + revoke** — **P1** (orphaned). **Change-role modal** (two-step) — **P0** (orphaned). **Remove-member confirm**, **make-owner**, **leave**, **reactivate + inactive section** — **P1/P2** (orphaned).
- **Standalone picker kit** (date/time wheel sheet, weekday, timezone, option-select) — **P0**; the export drew only native web inputs.
- **Reminder-notice banner**, **Home loading/error/no-circle states**, **form-shell primitives** (field/modal/actions/itemActions), **no-active-circle gate** — **P0/P1/P2**.

---

## 7. Product-rule violations / risks in the new export

**Must NOT be ported (blueprint defects):**
- **Brand-blue `#2F6FD0` + IBM Plex** on all 14 screens (the `theme.css` teal/Cairo is ignored) → retint to teal + Cairo on every port.
- **Native web date/time inputs** everywhere → must use the protected wheel `PickerSheet`/`DateField`/`TimeField` (Android blank-surface fix).
- **AddMedication: no duplicate-time / conflict validation** → P0 medical-safety guard must be preserved from `schedule-validation.ts`.
- **AddVisit: link-to-self toggle shown to all + default OFF** → RLS requires collaborators link to their own account (manager-only toggle).
- **AddAppointment: no end-before-start**; **AddDailyLog: no unset chip + pain defaults 0, no duplicate-date error**; **AddVital: drops `other`** → keep the existing schemas.
- **Invented data:** hardcoded doctor names (AddAppointment), assignee names (AddTask), invite code + wrong role set (InviteMember) → keep data-driven hooks + the real role allowlist.
- **Auth:** forgot-password link, resend link, demo-bypass, 8-char password, confirm-password field → do not adopt without an explicit product decision (committed flow is 6-char, Supabase-wired, no reset).
- **JoinCircle:** fakes success with no RPC → keep `acceptInvitation` + all error states.
- **NotificationSettings:** collapses the honest multi-state push card to one boolean → keep `push-status-card.tsx`'s web/no-device/denied/not-configured states; **opt-in stays explicit + honest**.
- **RecipientProfile:** read-only gate dead-coded → keep `canManage` gating.

**PASS (compliant in the blueprint):** vitals non-diagnostic (value+unit+time only, no normal/abnormal, no health color), notification opt-in honesty (explicit enable, "local ≠ guaranteed", no raw token), LTR isolation of emails/codes/times/dates.

---

## 8. Recommended implementation phases

> Each phase: reskin to the Figma language; **preserve all protected logic**; teal `figma-tokens` + Cairo + wheel pickers; device screenshot-compare; the four validations (§10) per slice.

- **Phase MS-0 — Shared form & picker primitives (foundation; do first).** Reskin in place (style/tokens only, APIs + logic unchanged) to the Figma language: `form-field` (→ match `FigmaField`, but keep direction-following, NOT forced right-align), `form-modal` (→ `FigmaBottomSheet` + submit/cancel/error/submitting wiring), `form-actions`/`StickyFormActions`, `option-select`, `picker-sheet` + `date-field`/`time-field`/`date-time-field` (**keep the protected Android wheel + `date-time-shared` math**), `weekday-selector` (keep opt-in + 0=Sun..6=Sat), `item-actions` (keep two-step inline delete). No blueprint exists for pickers — design them in the committed Figma language. **Unblocks every form.**
- **Phase MS-1 — P0 add forms + detail/edit screens.** Using the MS-0 primitives + the new `Add*` blueprints (layout/copy only): reskin the 6 add forms (medication+schedule **with the duplicate-time/conflict state**, task, appointment, vital, daily-log, visit), then **build the `/[id]` detail/edit screens** (no blueprint — extrapolate: editable/read-only modes, status sections, two-step delete) + the **managed schedule editor**. Keep all validation/RLS/gating.
- **Phase MS-2 — Member management + orphaned entry points.** Build (no blueprints) the change-role modal, invitations-list+revoke, remove-member confirm, make-owner/leave/reactivate + inactive section; **AddDoctor + doctor edit/delete** (re-attach to `FigmaDoctors`); **restore entry points** for `/recipient-profile`, `/emergency-contacts`, and the member actions.
- **Phase MS-3 — Auth / onboarding / settings / profile / emergency editors.** Reskin sign-in/up (keep 6-char + real Supabase + no forgot-pw), create-circle (keep Home gate), join-circle (keep RPC + errors), notification-settings (keep honest multi-state push + scope + validation), recipient-profile (keep `DateField` + `canManage`), **emergency-contacts manager** (no blueprint).
- **Phase MS-4 — Cleanup.** Fix Home loading/error/no-circle states + reminder-notice banner; delete dead old files (`circle-dashboard`, `today-overview`, `today-care-ring`, `*-center` ×6, `*-card` ×6, `dashboard-tile`, `nav-card`, old `emergency-card`/`members-manager`/`doctors-manager`/`role-modal` once re-homed).

---

## 9. Exact first implementation prompt (Phase MS-0 — safest start)

MS-0 is the safest start: it's reskin-only (style/tokens, no logic change), it preserves the protected behaviors, and it unblocks every later form. Suggested prompt:

> **"Phase MS-0 — Reskin the shared form & picker primitives to the Figma language (style only, logic untouched).**
> In `E:\Projects\sanad-mobile`, do NOT change any component's props/API/behavior — only restyle to the committed Figma language (`src/components/figma/figma-tokens.ts` teal `#4BA898`/`#2E8A7B`, Cairo via `FigmaFont`, radii/spacing tokens) so every form that consumes them inherits the new look. Reskin: `src/components/form-field.tsx` (keep direction-following text align — do NOT force right-align, so LTR phone/email/codes still read correctly; keep the focus ring + inline error), `src/components/form-modal.tsx`, `src/components/form-actions.tsx` (+ `StickyFormActions`), `src/components/option-select.tsx`, `src/components/picker-sheet.tsx` + `src/components/date-field.tsx` + `src/components/time-field.tsx` + `src/components/date-time-field.tsx` (**PRESERVE the protected Android wheel-picker behavior and `date-time-shared.ts` math — no native/web calendar, no manual typing, leap-safe day clamp**), `src/components/weekday-selector.tsx` (keep opt-in selection + 0=Sun..6=Sat + the every-day toggle), and `src/components/item-actions.tsx` (keep the two-step inline delete, no native Alert). Status stays icon+text+color; selected stays check+fill+bold (never color-only). Do NOT touch any schema/validation/hook, the medication duplicate-time logic, or any backend. Do NOT add dependencies. Reuse `src/components/figma/*` primitives where they fit. After: run `npx tsc --noEmit`, `npm run check:mojibake`, `git -c core.autocrlf=false diff --check`, `npx expo-doctor`; screenshot-compare one consuming form (e.g. `/vitals/new`) on the S24 Ultra (dark+light, RTL) to confirm the pickers still open and validation still blocks. Do not commit."**

*(If a vertical proof-slice is preferred over the broad primitive reskin, the safest single screen is `/vitals/new` — non-diagnostic-PASS, self-contained, exercises pickers + option chips + conditional inputs — but it depends on MS-0 primitives, so MS-0 should still land first.)*

---

## 10. Validation commands (run after each implementation slice)

```bash
npx tsc --noEmit                              # no type errors
npm run check:mojibake                        # no encoding corruption
git -c core.autocrlf=false diff --check       # clean whitespace/LF
npx expo-doctor                               # 21/21
```
Plus **device QA on the S24 Ultra** (Android, Arabic, RTL, dark): confirm pickers open as wheels (not calendars), duplicate-time still blocks save, destructive actions still confirm, vitals show no normal/abnormal coloring, push stays explicit opt-in, and times/phones/codes stay LTR-isolated. (`expo run:android`/EAS/prebuild are out of scope for analysis — needed only when a native dep changes, which MS-0 does not.)

---

*Analysis only — no app/source/config/package changed except this report; no installs, no EAS, not committed. The new export is a useful blueprint set for the still-old-UI forms + auth/onboarding/settings, but must be reskinned to teal+Cairo with the protected logic/pickers/validation preserved; the detail/edit screens, schedule-validation state, doctor/emergency-contacts/member-management surfaces, and the picker kit remain to be designed.*
