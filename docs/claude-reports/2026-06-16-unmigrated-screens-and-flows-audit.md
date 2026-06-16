# Sanad Mobile — Unmigrated Screens & Flows Audit

**Date:** 2026-06-16
**Type:** Audit / report only. **No source changed. Not committed.**
**Purpose:** A complete, precise inventory of every screen / route / modal / form / detail page / picker / settings surface / secondary state that is **NOT** yet on the Figma Make visual language — so the list can be handed to Figma Make to generate the missing designs. Describes the app **as it currently exists**.

> **Method:** 10 parallel read-only inspectors walked the route tree (`src/app/**`), the migrated `figma-*` screens, every feature form/editor/modal/manager, the shared pickers/primitives, and the Figma Make export, then classified each surface. Sibling refs: `docs/claude-reports/2026-06-16-figma-full-app-parity-pass.md`, `docs/claude-reports/2026-06-16-figma-exact-copy-technical-plan.md`, `docs/figma/make-export/extracted/src/app/components/*`.

---

## 1. Executive summary

**Migrated (Figma language):** the bottom tab bar (`FigmaTabBar`) and **13 routes** — Home (`/`), Explore, Account, and the 11 **centers**: Medications, Emergency card, Notifications, Tasks, Appointments, Vitals, Doctors, Members, Daily Logs, Visits. These render `src/components/figma/*` + Cairo + lucide + figma-tokens and are confirmed **clean** of old visual imports.

**Everything a user does *inside* those centers is still old Sanad UI.** Every `+` add screen, every list-row → `/[id]` detail/edit screen, every modal/form/picker, plus auth, onboarding, join-circle, invite, invitations, role-change, notification-settings, recipient-profile, and emergency-contacts. The Figma Make export **never generated** these — it produced only the 13 centers + nav + a handful of shallow inline "add" sheets. So most missing surfaces have **no blueprint to copy** and must be designed fresh from the established Figma language.

### ⚠ The most important findings — capabilities that are now UNREACHABLE (orphaned)

When `FigmaHome`/`FigmaMembers`/`FigmaDoctors` replaced the old `CareCircleDashboard`/`MembersManager`/`DoctorsManager`, several entry points were dropped. These routes/flows still exist and work, but **no tap path in the live app reaches them** (deep-link only):

| Orphaned capability | Route/component | Why it's unreachable now |
|---|---|---|
| **Edit recipient profile** | `/recipient-profile` | Only link was in old `circle-dashboard.tsx` (no longer rendered); `FigmaHome`/Explore/Account don't link it. |
| **Manage emergency contacts** (add/edit/delete) | `/emergency-contacts` | Same — only the old dashboard linked it; the migrated read-only `/emergency-card` doesn't. |
| **Change member role** | `role-modal.tsx` (via `members-manager`) | `FigmaMembers` exposes only invite + remove; no role-change control; `MembersManager` is unmounted. |
| **Make owner / Leave circle / Reactivate** + inactive-members section | `members-manager.tsx` | All lived on the old member card; `FigmaMembers` filters to active-only and drops these actions. |
| **Invitations list + revoke** | `/circle-members/invitations` | Old roster's "manage invitations" button is gone from `FigmaMembers`. |
| **Edit / delete a doctor** | `DoctorsManager` `ItemActions` | `FigmaDoctors` cards have a call button only — no edit/delete/tap-through; doctors can be **created but never corrected or removed**. |

**Restoring these entry points is mandatory** when their Figma screens are designed (Member-management + Settings/onboarding passes). They are flagged P0/P1 below.

### Secondary findings
- **Home route leak:** `(tabs)/index.tsx` shows old `Screen`/`ErrorState`/`LoadingState`/`CareCircleOnboarding` on its **loading / error / no-circle** branches (the happy path is `FigmaHome`). The flagship screen falls back to old UI on first run.
- **Reachability narrowing:** `FigmaAppointments` hides `cancelled` + past appointments (only `scheduled`/`completed` tabs, today-onward data), so the appointment detail's **cancelled state + reopen action** can't be reached by normal navigation.
- **Remove-member lost its confirmation:** the migrated `FigmaMembers` removes on a single `UserMinus` tap (the old UI had a two-step confirm) — a destructive-action regression to fix.
- **Dead code:** `nav-card`, `dashboard-tile` + 6 `*-card.tsx`, `circle-dashboard`, `today-overview`, `today-care-ring`, 6 `*-center.tsx`, old `emergency-card`, `members-manager`, `doctors-manager`, `role-modal` are no longer routed (cleanup-pass deletions).

---

## 2. Summary table

| Priority | Flow | Route / component | Current status | Why it matters | Figma design needed? |
|---|---|---|---|---|---|
| P0 | Pickers kit (date/time/weekday/timezone/option + sheet) | `picker-sheet`,`date-field`,`time-field`,`date-time-field`,`weekday-selector`,`timezone-picker`,`option-select` | Not migrated (shared primitives) | Blocks **every** add/edit form; holds protected Android picker fix | Yes (reskin) |
| P0 | Form shell + fields + save bar | `form-modal`,`form-field`,`form-actions` | Not migrated (shared primitives) | Chrome of every form | Yes (reskin) |
| P0 | Sign in | `/(auth)/sign-in` | Not migrated; **missing from export** | First screen for returning users | Yes |
| P0 | Sign up (+ confirm-email notice) | `/(auth)/sign-up` | Not migrated; missing from export | Account creation gate | Yes |
| P0 | Create-circle onboarding (no-circle) | `onboarding-form.tsx` (Home renders it) | Not migrated; missing from export | First authenticated screen for new users | Yes |
| P0 | Add medication | `/medications/new` (`medication-form`) | Partial (Figma center → old form); export stub too thin | Primary create path; bundles first schedule | Yes |
| P0 | Add/edit schedule modal | `schedule-modal-host` (+ `schedule-fields`) | Not migrated; missing from export | Only path to schedules; holds duplicate-time + conflict validation | Yes |
| P0 | Duplicate-time / conflict validation state | `schedule-validation.ts` + `schedule-fields` | Not migrated | **Medical-safety guard** (double-dose / reminder collision) | Yes |
| P0 | Medication detail / edit | `/medications/[id]` (`medication-editor`) | Partial; missing from export | Every "all"-tab row lands here; edit + activate + delete | Yes |
| P0 | Add task | `/tasks/new` (`task-form`) | Partial; export stub (1 field) | Core create path | Yes |
| P0 | Task detail / edit | `/tasks/[id]` (`task-editor`) | Partial; missing from export | Status/complete/cancel/delete + 3 role views | Yes |
| P0 | Add appointment | `/appointments/new` (`appointment-form`) | Not migrated; **export `+` is dead** | Only create path; date+time, end-before-start, doctor link | Yes |
| P0 | Appointment detail / edit | `/appointments/[id]` (`appointment-editor`) | Not migrated; missing from export | complete/cancel/reopen + delete | Yes |
| P0 | Add vital | `/vitals/new` (`vital-form`) | Partial; export stub lacks BP split & pickers | Non-diagnostic; conditional systolic/diastolic; date+time | Yes |
| P0 | Vital detail / edit | `/vitals/[id]` (`vital-editor`) | Not migrated; missing from export | Edit/delete; non-diagnostic | Yes |
| P0 | Add daily log | `/daily-logs/new` (`log-form`) | Partial; export sheet diverges from data model | Observational; duplicate-date error; pain stepper | Yes |
| P0 | Daily log detail / edit | `/daily-logs/[id]` (`log-editor`) | Not migrated; missing from export | Edit/delete; read-only + role logic | Yes |
| P0 | Add doctor (modal) | `DoctorFormModal` (opened by `figma-doctors`) | **Partial seam**; missing from export | Only way to create a doctor; breaks the migrated screen on "+" | Yes |
| P0 | **Edit / delete doctor** | `DoctorsManager` `ItemActions` | **Not migrated + ORPHANED** | Doctors can be created but never edited/deleted | Yes (+ restore entry) |
| P0 | Invite member | `/circle-members/invite` (`invite-form`) | Partial (Figma `+` → old form) | Sole way to add members | Yes |
| P0 | Invitation-created code reveal | `invite-form` `CreatedCard` | Partial; export sheet is a partial blueprint | One-time code reveal | Yes |
| P0 | **Change member role** | `role-modal.tsx` | **Not migrated + ORPHANED** | Core role management fully dropped from `FigmaMembers` | Yes (+ restore entry) |
| P1 | Add visit | `/visits/new` (`visit-form`) | Not migrated; missing from export | Create path open to collaborators; RLS link-to-self | Yes |
| P1 | Visit detail / edit | `/visits/[id]` (`visit-editor`) | Not migrated; missing from export | owner-edit gate, status, delete | Yes |
| P1 | Notification settings (toggles + quiet hours + tz) | `/notification-settings` | Not migrated; missing; seam from migrated Account | Protected opt-in/quiet-hours/medical-safety | Yes (reskin) |
| P1 | Push status / enable card | `push-status-card` | Not migrated; missing from export | Channel-before-permission opt-in honesty | Yes (reskin) |
| P1 | Reminder-notice banner | `reminder-notice.tsx` | Not migrated; embedded in 3 migrated centers (seam) | Old-styled banner visible inside migrated lists | Yes |
| P1 | **Recipient profile** (view/edit) | `/recipient-profile` (`profile-form`) | **Not migrated + ORPHANED** | Source of truth for emergency-card medical data | Yes (+ restore entry) |
| P1 | **Emergency contacts manager** | `/emergency-contacts` (`contacts-manager`) | **Not migrated + ORPHANED** | Add/edit/delete + primary + call; visually inconsistent | Yes (+ restore entry) |
| P1 | **Invitations list + revoke** | `/circle-members/invitations` | **Not migrated + ORPHANED** | Manager invite management | Yes (+ restore entry) |
| P1 | Join circle | `/join-circle` (`join-form`) | Not migrated; missing from export | Invite-code entry | Yes |
| P1 | Remove member (add confirm) | inline in `figma-members` | Migrated but no confirmation | Destructive action without confirm | Yes (add confirm) |
| P1 | Make owner / Leave circle | `members-manager` | **Not migrated + ORPHANED** | Ownership transfer / self-exit dropped | Yes (+ restore entry) |
| P1 | Home loading/error/no-circle states | `(tabs)/index.tsx` + `circle-gate` | **Leak** — migrated route falls back to old UI | Flagship screen shows old UI on first load | Yes |
| P0 | Schedule cards + weekly summary | `schedule-summary` + `medication-editor` | Not migrated | Core multi-schedule visualization | Yes |
| P1 | ItemActions (edit + inline delete) | `item-actions.tsx` | Not migrated (shared) | Every editable row's two-step confirm | Yes (reskin) |
| P2 | Reactivate member + inactive section | `members-manager` | Not migrated + ORPHANED | Needs inactive list restored first | Yes |
| P2 | Local test notification | inline in `notification-settings` | Not migrated; missing from export | "local ≠ guaranteed" honesty | Yes (reskin) |
| P2 | Circle timezone card | `circle-timezone-card.tsx` | Not migrated (settings widget) | Manager-only; governs reminder wall-clock | Yes (reskin) |
| P2 | Unsaved-changes guard | `unsaved-changes-guard.tsx` | **Pure logic (native dialog)** | Back-gesture safety | **No** (copy only) |
| — | Dead old home/centers/managers | `circle-dashboard`,`today-overview`,`*-center`×6, `nav-card`,`dashboard-tile`,`*-card`×6, old `emergency-card`,`members-manager`,`doctors-manager`,`role-modal` | Dead code | Not user-visible | No — delete in cleanup |

---

## 3. Full navigation map

Legend: ✅ **migrated** · 🟠 **partial** (migrated screen opens old UI) · ❌ **old UI** · 👻 **orphaned** (no live entry point) · 🔒 **shared logic primitive** · 💀 **dead/unrouted**

```
ROOT  src/app/_layout.tsx ........................ ✅ (FigmaTabBar; loads Cairo)
(auth)/_layout.tsx ............................... infra (redirect guard)
 ├─ /(auth)/sign-in ............................... ❌ auth (missing from export)
 └─ /(auth)/sign-up ............................... ❌ auth (+ confirm-email notice)

(app)/_layout.tsx ................................ infra (auth guard + NotificationObserver)
 (tabs)/
 ├─ / (Home) ...................................... ✅ FigmaHome (🟠 error/loading/no-circle → old Screen/ErrorState + onboarding-form)
 ├─ /explore ...................................... ✅ rewritten in place (feature index)
 └─ /account ...................................... ✅ rewritten in place (→ /circle-members, /notification-settings, /join-circle, sign-out)

 medications/
 ├─ /medications .................................. ✅ FigmaMedications
 ├─ /medications/new .............................. 🟠 old MedicationForm (+ ScheduleFields)
 └─ /medications/[id] ............................. 🟠 old MedicationEditor (+ ScheduleModalHost 🔒, ScheduleSummary)
 tasks/
 ├─ /tasks ........................................ ✅ FigmaTasks
 ├─ /tasks/new .................................... 🟠 old TaskForm
 └─ /tasks/[id] ................................... 🟠 old TaskEditor
 appointments/
 ├─ /appointments ................................. ✅ FigmaAppointments (hides cancelled/past → those detail states unreachable)
 ├─ /appointments/new ............................. 🟠 old AppointmentForm
 └─ /appointments/[id] ............................ 🟠 old AppointmentEditor
 visits/
 ├─ /visits ....................................... ✅ FigmaVisits
 ├─ /visits/new ................................... 🟠 old VisitForm
 └─ /visits/[id] .................................. 🟠 old VisitEditor
 daily-logs/
 ├─ /daily-logs ................................... ✅ FigmaDailyLogs
 ├─ /daily-logs/new ............................... 🟠 old DailyLogForm
 └─ /daily-logs/[id] .............................. 🟠 old DailyLogEditor
 vitals/
 ├─ /vitals ....................................... ✅ FigmaVitals
 ├─ /vitals/new ................................... 🟠 old VitalForm
 └─ /vitals/[id] .................................. 🟠 old VitalEditor
 circle-members/
 ├─ /circle-members ............................... ✅ FigmaMembers (invite + remove only)
 ├─ /circle-members/invite ........................ 🟠 old InviteForm + CreatedCard
 └─ /circle-members/invitations ................... ❌👻 old InvitationsList (orphaned)
 /doctors ......................................... ✅ FigmaDoctors  → 🟠 old DoctorFormModal on "+"  | ❌👻 edit/delete orphaned
 /emergency-card .................................. ✅ FigmaEmergencyCard (read-only)
 /emergency-contacts .............................. ❌👻 old EmergencyContactsManager (orphaned)
 /recipient-profile ............................... ❌👻 old ProfileForm (orphaned)
 /notifications ................................... ✅ FigmaNotifications
 /notification-settings ........................... ❌ old NotificationSettings (+ PushStatusCard, test section) — reached from Account
 /join-circle ..................................... ❌ old JoinForm

Member actions orphaned (no live trigger): change-role (role-modal 👻), make-owner 👻, leave 👻, reactivate 👻 (inactive section gone)
Shared logic primitives 🔒 (reached only through old forms): picker-sheet, date/time/datetime fields, weekday-selector, timezone-picker, option-select, form-modal/field/actions, item-actions, info-banner, unsaved-changes-guard, circle-timezone-card, push-status-card
Dead/unrouted 💀: circle-dashboard, today-overview, today-care-ring, *-center ×6, old emergency-card, members-manager, doctors-manager, role-modal (👻), nav-card, dashboard-tile, *-card ×6
```

---

## 4. Per-surface inventory (A–I)

> Compact A–I per surface. **A** name · **B** route/component · **C** how reached · **D** status · **E** contents · **F** constraints to preserve · **G** Figma prompt · **H** priority · **I** phase.

### 4.1 Auth & onboarding *(all missing from export)*

**Sign in** · B `/(auth)/sign-in` · C app launch signed-out / from sign-up footer · D ❌ old (`Screen`,`FormField`,`Button`) · E title+subtitle, email (LTR) + password (`secureTextEntry`, ph "٦ أحرف على الأقل"), single inline alert (`auth.errors.*`, generic "بيانات الدخول غير صحيحة"), loading submit, footer link to sign-up · F zod email/min-6; keep generic auth error ambiguous; no forgot-password exists; LTR email · G "Design an Arabic RTL sign-in screen: brand header, email + masked password FigmaFields, one inline alert, full-width loading FigmaButton, footer link to sign-up." · H P0 · I Settings-onboarding.

**Sign up** · B `/(auth)/sign-up` · C sign-in → "إنشاء حساب" · D ❌ old · E email + new-password, error alert, **in-place "تحقّق من بريدك" notice that coexists with the form** (no navigation), loading submit, footer link to sign-in · F two outcomes (session→redirect / no-session→notice); notice ≠ separate success screen; LTR email · G "…mirror sign-in + an inline check-your-email notice above the still-visible form." · H P0 · I Settings-onboarding.

**Create-circle onboarding (no-circle)** · B `onboarding-form.tsx` (rendered by `(tabs)/index.tsx` when `hasNoCircles`) · C sign-in → land on `/` with zero circles → form replaces `FigmaHome` (inside the migrated tab shell) · D ❌ old (`Screen`, raw `TextInput`, `DateField`) · E circle name, recipient full name, optional birth date; create button; "join with code" link to `/join-circle`; create-failed error · F create-circle RPC; first authenticated screen; RTL · G "Design an Arabic RTL no-circle onboarding: create a circle (recipient name + optional birth date) or join with an invite code." · H P0 · I Settings-onboarding.

**Join circle** · B `/join-circle` (`join-form`) · C onboarding "join with code" / Account "الانضمام لدائرة أخرى" · D ❌ old (`Screen`,`InfoBanner`,`FormField`) · E invite-code input (LTR), trust warning, join button, invalid/expired/used errors, success · F code LTR; honest error copy; RTL · G "Design an Arabic RTL join-circle screen: LTR invite-code field, validation for invalid/expired/used, join confirmation." · H P1 · I Settings-onboarding.

**No-active-circle gate** · B `circle-gate.tsx` empty branch · C any care detail screen with no active circle · D ❌ old (`Screen`,`EmptyState`) · E icon + "لا توجد دائرة رعاية نشطة" · F shared gate wraps every center · G "Design the empty 'no active circle' state." · H P2 · I Cleanup/Settings.

### 4.2 Medications inner

**Add medication** · B `/medications/new` (`medication-form`) · C Medications center → header "+" (managers) · D 🟠 old form (export add-sheet is a 3-field stub, no schedule) · E disclaimer; name (required)/dosage/form/instructions/with-food switch; inline **first-schedule** (`ScheduleFields`: weekdays + time rows + start/end date + notes); sticky save "إضافة دواء" disabled until dirty & **blocked on duplicate times**; managers-only `EmptyState` · F duplicate-time validation blocks save; unsaved guard; `canManage`; LTR times/dates · G see §4 prompt — add form + inline schedule editor with duplicate-time block · H P0 · I Forms.

**Add/edit schedule modal** · B `schedule-modal-host` + `schedule-fields` · C `/medications/[id]` → "إضافة جدول جرعات" / schedule card edit (managers) · D ❌ old `FormModal` · E weekday selector (+ "كل الأيام"), repeatable HH:MM time rows (add/remove), start + clearable end date, notes; submit disabled until dirty/no-dupes; **conflict error** "{{day}} الساعة {{time}} موجود بالفعل…"; discard confirm · F **duplicate-time + cross-schedule conflict validation (both medical-safety)**; ≥1 weekday, ≥1 valid HH:MM; LTR times · G see §4 prompt — schedule bottom-sheet with red duplicate rows + conflict banner · H P0 · I Forms.

**Duplicate-time / conflict validation state** · B `schedule-validation.ts` + `schedule-fields` · C live while editing times · D ❌ old error styling · E duplicate row → red border/bg + alert "هذا الوقت مُدرج بالفعل…"; save disabled; conflict banner · F **safety-critical** (double-counts doses, collides on `${scheduleId}|${time}` key); inline highlight + alert + disabled-save must survive · G "Design the duplicate-time red row + conflict banner states." · H P0 · I Forms.

**Medication detail / edit** · B `/medications/[id]` (`medication-editor`) · C Medications "all" tab → row tap · D 🟠 old; missing from export · E loading/error/not-found; med-info editable (managers) or read-only notice; activate/deactivate; **SchedulesManager** (weekly `ScheduleSummary` + per-`ScheduleCard` with stop/edit/delete); danger delete-medication w/ inline confirm · F role-gated edit; per-schedule active toggle; destructive delete confirm; states · G see §4 prompt — two-zone detail (med info + schedules) · H P0 · I Detail.

**Schedule cards + weekly summary** · B `schedule-summary` + `ScheduleCard` · C inside `/medications/[id]` · D ❌ old · E weekly summary card (day-set lines + per-day expand) + numbered schedule cards (status pill, days, LTR times, date range, notes, stop/edit/delete) · F stopped excluded; LTR times; multi-schedule core · G "Design the weekly summary + schedule cards." · H P1 · I Detail.

### 4.3 Tasks / Appointments / Visits inner

**Add task** · B `/tasks/new` (`task-form`) · C Tasks center → "+" (managers) · D 🟠 old (export = 1-field stub) · E disclaimer; title (req)/description/category(8)/priority(4)/due-date/due-time/assign-to-me switch/notes; save "إضافة مهمة"; managers-only gate · F due-time needs due-date; `assignToMe`→`assigned_to`; unsaved guard; LTR date/time · G see table — task add with category/priority/due pickers + assign toggle · H P0 · I Forms.

**Task detail / edit** · B `/tasks/[id]` (`task-editor`) · C Tasks row tap · D 🟠 old; missing from export · E states; 3 role views (manager edit / collaborator act-on-own / read-only); status block (open/completed/cancelled + timestamps) with complete/cancel when `canAct`; managers-only delete · F `canAct` gating; status icon+text+color; no reopen for tasks; delete confirm · G see table · H P0 · I Detail.

**Add appointment** · B `/appointments/new` (`appointment-form`+`appointment-fields`) · C Appointments "+" (managers; **export `+` is dead**) · D ❌ old; missing from export · E disclaimer; title(req)/type(7)/date(req)/start(req)/end(opt)/location/doctor select (only if doctors exist, "بدون طبيب")/notes; save "إضافة موعد" · F date+start required; end-not-before-start; combine to ISO; doctor picker conditional; LTR date/time · G see table · H P0 · I Forms.

**Appointment detail / edit** · B `/appointments/[id]` (`appointment-editor`) · C Appointments card tap · D ❌ old; missing from export · E states; manager edit / read-only; status (scheduled/completed/cancelled) with mark-completed/cancelled + **reopen**; managers delete · F status transitions; re-derive ISO; **cancelled/past detail unreachable via migrated center (today-onward, no cancelled tab)**; delete confirm · G see table · H P0 · I Detail.

**Add visit** · B `/visits/new` (`visit-form`+`visit-fields`) · C Visits "+" (managers|collaborators) · D ❌ old; missing from export · E disclaimer; visitor name(req)/date(req)/start/end/notes; **manager-only "link to my account" switch** (collaborators get a static "recorded under your account" note); save "إضافة زيارة" · F **RLS: collaborators' visits must link to own account**; end-not-before-start; unsaved guard · G see table · H P1 · I Forms.

**Visit detail / edit** · B `/visits/[id]` (`visit-editor`) · C Visits card tap · D ❌ old; missing from export · E states; 3-way gate (manager / collaborator-owner / read-only); status (planned/completed/cancelled) + reopen; delete · F **edit preserves `visitor_user_id` (RLS)**; status; delete confirm · G see table · H P1 · I Detail.

### 4.4 Daily logs / Vitals inner

**Add daily log** · B `/daily-logs/new` (`log-form`+`log-fields`) · C Daily-logs "+" (managers|collaborators) · D 🟠 old (export sheet diverges from data model) · E observational disclaimer; date; option groups mood/sleep/appetite/hydration/mobility (each w/ explicit "غير محدّد"); **pain 0–10 stepper with a distinct "بدون"** state; 4 multiline notes; save "إضافة سجل" · F **one-log-per-author-per-date** → show "alreadyLoggedToday" (not generic); "غير محدّد"→null; pain none-vs-0 distinct; observational tone · G see table · H P0 · I Forms.

**Daily log detail / edit** · B `/daily-logs/[id]` (`log-editor`) · C Daily-logs card tap · D ❌ old; missing from export · E states; edit (manager / collaborator-owner) vs read-only banner + observation/notes rows ("ملاحظات فقط" when only notes); delete · F `isOwner` edit gate; same field rules; LTR date · G see table · H P0 · I Detail.

**Add vital** · B `/vitals/new` (`vital-form`+`vital-fields`) · C Vitals "+" (managers|collaborators) · D 🟠 old (export sheet lacks BP split + pickers) · E **strong non-diagnostic disclaimer**; type selector (7 types, auto-fills unit); date+time (`DateTimeField`, defaults now); **conditional value** (BP → systolic/diastolic pair; others → single; "أخرى" → optional); editable unit; notes; save "إضافة قياس" · F **strictly non-diagnostic (value+unit+time only, no normal/abnormal, no health color)**; conditional inputs swap on type; combine date+time to ISO; LTR numerics · G see table · H P0 · I Forms.

**Vital detail / edit** · B `/vitals/[id]` (`vital-editor`) · C Vitals card tap · D ❌ old; missing from export · E states; edit vs read-only; `formatVitalValue` (value+unit, hides when none); LTR timestamp; delete · F non-diagnostic; `isOwner` gate; BP-vs-single preserved · G see table · H P0 · I Detail.

### 4.5 Doctors / Emergency contacts

**Add doctor (modal)** · B `DoctorFormModal` (in `doctors-manager`, opened by `figma-doctors`) · C `/doctors` → "+" (managers) · D 🟠 **seam** — migrated list opens OLD `FormModal`; missing from export · E name(req)/specialty/phone(phone-pad)/clinic/notes; save disabled until dirty; validation; save-failure banner; discard confirm · F only `name` required; `canManage`; phone LTR; dirty-gated + discard · G "Design an Arabic RTL doctor add/edit FigmaBottomSheet (name req, specialty, LTR phone, clinic, notes) with dirty-gated save + discard confirm." · H P0 · I Forms.

**Edit / delete doctor** · B `DoctorsManager` `ItemActions` + `DoctorFormModal(edit)` · C **ORPHANED — no entry point** (FigmaDoctors cards have only a call button; `DoctorsManager` unmounted) · D ❌👻 old + orphaned · E edit ("تعديل بيانات الطبيب") / two-step inline delete (web-safe, per-row loading) · F `canManage`; web-safe confirm; same fields prefilled · G "Extend the migrated doctor card with manager-only edit (opens the doctor sheet) + inline two-step delete; hidden for non-managers." · H P0 (data dead-end) · I Detail (+ re-attach to Figma card).

**Emergency contacts manager** · B `/emergency-contacts` (`contacts-manager`, `ContactFormModal`) · C **ORPHANED** (only the old dashboard linked it; `/emergency-card` is read-only and doesn't) · D ❌👻 old + orphaned · E add button (managers); list rows (name, relationship, LTR phone, one-tap call, notes, **"رئيسية" pill**, primaries sorted first); edit + inline delete; add/edit modal (name req, relationship, **phone REQUIRED**, is-primary switch, notes) · F phone required (stricter than doctors); `is_primary` drives pill + ordering (multiple primaries allowed — not radio); `canManage`; `tel:` LTR; **not an emergency dialing service** — honest copy; delete confirm · G "Design an Arabic RTL emergency-contacts screen: manager '+', FigmaCard rows w/ avatar + relationship + LTR phone + 'رئيسية' pill + call + manager edit/delete; add/edit FigmaBottomSheet (name req, relationship, phone req, primary toggle, notes). A contact list, not a dialing service." · H P1 (+ restore entry) · I Forms + Detail.

### 4.6 Member management

**Members roster** · B `/circle-members` (`figma-members`) · C Explore → "العائلة ومقدمو الرعاية" · D ✅ migrated · E header + invite "+" (managers); summary; active-member rows (avatar, role icon/label Crown/Edit3/Eye, "أنت", email, **single-tap remove**); role legend; **no inactive section, no role-change, no make-owner/leave/reactivate, no manage-invitations** · F `isManagerRole` gates "+"; remove gated by `canChangeStatus`/`!lastAdmin`/`!isOwner`/`!isSelf` · H done (roster) · I — (re-expose dropped actions).

**Invite member** · B `/circle-members/invite` (`invite-form`) · C roster "+" (only surviving path) · D 🟠 old · E managers gate; sensitive-data warning; role picker (`invitableRoles`); optional name; "إنشاء دعوة" → CreatedCard · F invitable-role allowlist; managers-only; warning mandatory · G "Design an Arabic RTL invite screen: warning banner, role picker (limited to grantable roles), optional name, 'إنشاء دعوة'." · H P0 · I Forms.

**Invitation-created code reveal** · B `invite-form` `CreatedCard` · C after "إنشاء دعوة" · D 🟠 old (export invite sheet is a partial blueprint) · E large LTR code (selectable), role + expiry lines, **one-time/irretrievable warning**, copy/share/create-another, "نسخ"/"مشاركة" feedback · F code shown ONCE; LTR code; 48h single-use · G "Design the one-time invite-code reveal: large LTR code chip, copy/share, role+expiry, 'shown once' warning, create-another." · H P0 · I Forms.

**Invitations list + revoke** · B `/circle-members/invitations` (`invitations-list`) · C **ORPHANED** (roster's "manage invitations" button gone) · D ❌👻 old; missing from export · E managers gate; invite button; invitation cards (status pill pending/accepted/revoked/expired, role, expiry, accepted-by, created-by); revoke pending w/ confirm; empty state · F managers-only; revoke pending only; status icon+text+color; dates; confirm · G "Design an Arabic RTL invitations list: status-pill cards (pending/accepted/revoked/expired) w/ role+expiry+accepted-by, two-step revoke on pending, empty state, 'دعوة عضو' entry." · H P1 (+ restore entry) · I Member-management.

**Change member role** · B `role-modal.tsx` · C **ORPHANED** (no change-role control on FigmaMembers) · D ❌👻 old; missing from export · E 2-step: radio role list w/ "الحالي" badge + expandable "يستطيع/لا يستطيع" capabilities → confirm "{{from}} ← {{to}}" + raise/lower-access note + confirm/back; in-modal errors · F assignable roles depend on actor+target; no mutation until confirm; RPC authoritative; raise/lower explanation required · G "Design an Arabic RTL two-step role-change FigmaBottomSheet: role radios w/ capability detail + current badge, then a confirm step stating old→new and whether access rises/falls." · H P0 (+ restore entry) · I Member-management.

**Remove member (add confirm)** · B inline in `figma-members` · C roster row `UserMinus` · D ✅ migrated but **no confirmation** (regression vs old two-step) · E single-tap remove + busy spinner · F gated; destructive — should reintroduce confirm · G "Add a destructive confirm step before removing a member from the roster row." · H P1 · I Member-management.

**Make owner / Leave / Reactivate** · B `members-manager` `MemberCard` · C **ORPHANED** (all dropped from FigmaMembers; no inactive section for reactivate) · D ❌👻 old; missing from export · E make-owner ("تعيين كمالك" → "تأكيد النقل"); leave ("مغادرة الدائرة" → `router.replace('/')`); reactivate ("إعادة تفعيل"); + owner/last-admin protection notes + inactive section · F owner-only transfer (irreversible, confirm); leave forbidden for owner/last-admin; reactivate needs inactive list; RPCs authoritative · G "Design a member-detail/action surface: role change, remove, reactivate (inactive), make-owner (owner-only irreversible confirm), self leave; + owner/last-admin notes + inactive-members section." · H Make-owner P1 / Leave P1 / Reactivate P2 · I Member-management.

### 4.7 Recipient profile, notification settings & push

**Recipient profile** · B `/recipient-profile` (`profile-form`) · C **ORPHANED** (old dashboard link dropped) · D ❌👻 old; missing from export · E states; read-only role banner; fields full-name(req)/birth-date(DateField)/dialect/blood-type/allergies/chronic/emergency-notes; sticky save disabled until dirty + saved/failed feedback; validation · F caps per schema; birth-date valid YMD or null; `canManage` honest read-only; **feeds the Emergency Card medical data** — clinical, non-diagnostic; LTR blood type/date; unsaved guard · G "Design an Arabic RTL recipient profile form (name/birth-date/dialect/blood-type/allergies/chronic/emergency-notes) with editable + read-only modes, sticky save, loading/error/empty states." · H P1 (+ restore entry) · I Forms + Home/Detail (entry).

**Notification settings** · B `/notification-settings` (`notification-settings`) · C Account → "إعدادات الإشعارات" (seam: migrated Account → old screen); also via reminder banners · D ❌ old; missing from export · E PushStatusCard; scope selector (global vs per-circle, override hint); **8 per-type toggles** (medication/missed-dose/task/appointment/visit/care/emergency/summaries) w/ descriptions; quiet-hours toggle + from/to TimeFields + honest note; **display-only device timezone** (LTR) w/ "scheduled times follow the circle's tz" hint; inline saved/error; save · F **PROTECTED logic — restyle only**; per-circle overrides global; quiet-hours both-required HH:MM, may wrap midnight, emergency may still arrive; tz display-only; LTR times · G "Design an Arabic RTL notification-settings screen: push-enable card, scope pills, 8 labeled toggle rows, quiet-hours w/ time pickers + honest note, read-only device-tz card, save; preserve protected logic." · H P1 · I Settings-onboarding.

**Push status / enable card** · B `push-status-card` · C top of notification-settings · D ❌ old; missing from export · E icon + why + privacy line; branched states: web-unsupported / no-device / **enabled (success pill + disable)** / **enable button**; per-`EnableResult` messages (denied→OS settings, project-id-missing, error) · F **PROTECTED**: opt-in never auto-prompts; channel-before-permission; honest per-state; privacy (token tied to device, no health data); **no emergency guarantee** · G "Design an Arabic RTL push card: icon + why + privacy + single explicit enable, with honest states (not-enabled / enabled+disable / web / simulator / denied / not-configured). Restyle only — never imply notifications work before granted." · H P1 · I Settings-onboarding.

**Local test notification** · B inline in `notification-settings` · C bottom of notification-settings (hidden on web) · D ❌ old; missing from export · E section title + "schedules a local test in ~5s, this device only, notifies no one" + secondary button + scheduled/failed feedback · F **local ≠ guaranteed**; native-only · G "Design a 'test on this device' section: label + honest one-liner + secondary button + feedback." · H P2 · I Settings-onboarding.

**Reminder-notice banner** · B `reminder-notice.tsx` · C inside Medications/Tasks/Appointments centers (seam) · D ❌ old `InfoBanner` embedded in migrated centers · E info strip + "إدارة" + chevron → `/notification-settings` · F informational only (reminders configured centrally); variable body per screen; RTL chevron · G "Design an Arabic RTL inline info banner (reminders are managed centrally) with a 'manage' chevron → notification settings; accepts per-screen body text." · H P1 · I Detail/Forms (with the centers).

### 4.8 Shared pickers & form primitives (🔒 reskin, don't rebuild logic) *(all missing from export)*

| Surface | Component | What it is / preserve | Pri | Phase |
|---|---|---|---|---|
| **PickerSheet** (date/time wheel sheet) | `picker-sheet.tsx` | The slide-up wheel sheet (Done/Clear/Cancel). **PROTECTED Android blank-surface fix** (full-width column block, "do NOT make a row"); draft commit on Done; check+bold selected (not color-only); 48dp rows | P0 | Forms |
| **DateField** | `date-field.tsx` | Y/M/D trigger + wheel; leap-safe day clamp; emits `YYYY-MM-DD` | P0 | Forms |
| **TimeField** | `time-field.tsx` | Hour/minute wheel; 24h; emits `HH:MM` (feeds med duplicate-time); LTR | P0 | Forms |
| **DateTimeField** | `date-time-field.tsx` | Date+time pair → caller combines to ISO (keep split) | P1 | Forms |
| **WeekdaySelector** | `weekday-selector.tsx` | "Every day" + 7 day chips; **opt-in selection**, 0=Sun..6=Sat; checkbox a11y | P1 | Forms |
| **TimezonePicker** | `timezone-picker.tsx` | Searchable IANA sheet (City،Country + LTR id); returns id, caller persists | P2 | Settings |
| **OptionSelect** | `option-select.tsx` | Single-choice enum chips (radio); check+fill not color-only; 48dp; not the `Button secondary` look | P0 | Forms |
| **FormModal** | `form-modal.tsx` | Add/edit sheet shell; explicit-close-only; submit/cancel/error/submitting wiring (richer than `FigmaBottomSheet`) | P0 | Forms |
| **FormField** | `form-field.tsx` | Labeled input + focus ring + error; **must NOT hardcode `textAlign`** (FigmaField currently force-rights — would break LTR phone/email) | P0 | Forms |
| **FormActions / StickyFormActions** | `form-actions.tsx` | Sticky save bar + saved/error line; **delete never mixed in**; sticky sibling after ScrollView | P0 | Forms |
| **ItemActions** | `item-actions.tsx` | Edit + **inline two-step delete (no native Alert — web-safe)** | P1 | Detail |
| **UnsavedChangesGuard** | `unsaved-changes-guard.tsx` | **Pure logic — native Alert/web confirm; keep as-is** (intercepts `beforeRemove`); copy only | P2 | Cleanup (or skip) |
| **CircleTimezoneCard** | `circle-timezone-card.tsx` | Manager-only tz settings card → opens TimezonePicker; confirm-on-change w/ impact note; UTC nudge | P2 | Settings |

---

## 5. Old visual component usage map

Importer-file counts (excluding each component's own file), with classification: **(a)** screen needing Figma redesign · **(b)** shared logic/form primitive — keep, reskin · **(c)** leak into a migrated surface.

| Component | Importers | Where / classification |
|---|---|---|
| `Screen` | 34 | (a) auth + all old forms/editors/managers + `notifications-center` + `notification-settings`; (b) `circle-gate` (empty/loading/error for every center); (c) **`(tabs)/index.tsx`** error/no-circle branch |
| `Surface`/`Card`/`Section` | 26 | (a) old centers ×6, editors ×6, forms, `role-modal`, `invitations-list`; (b) `circle-switcher`, `circle-timezone-card`, `push-status-card`; 💀 `circle-dashboard`, `today-overview`. No figma leak |
| `Button` | 29 | (a) old forms/editors/centers/managers + auth; (b) field bundles, `push-status-card`. No figma leak (they use `FigmaButton`) |
| `StatusBadge` | 15 | (a) old editors/centers/`members-manager`/`role-modal`/`invitations-list`/`contacts-manager`; (b) `push-status-card`,`circle-switcher`. No leak |
| `GlyphChip` | 9 | (a) all old surfaces. No leak (figma uses `IconChip`+lucide) |
| `NavCard` | **0** | 💀 dead — delete in cleanup |
| `DashboardTile` | 6 | 💀 all 6 `*-card.tsx` + `circle-dashboard` — old dead home only |
| `ThemedText`/`ThemedView` | 41 / 18 | (b) foundational; dies as old screens are replaced; (c) `(tabs)/index.tsx` imports `ThemedView` (loading branch only) |
| `FormModal` | 3 | (b) shell; **`DoctorFormModal` imported LIVE by `figma-doctors` = partial seam** |
| `FormField`/`FormActions` | 16 / 13 | (b) primitives / (a) the screens composing them |
| `OptionSelect` | 6 | (b) primitive (`*-fields`, `task-form/editor`, `invite-form`) |
| `PickerSheet` | 0 direct | (b) sub-primitive of date/time fields |
| `DateField`(8)/`TimeField`(6)/`DateTimeField`(1)/`WeekdaySelector`(1)/`TimezonePicker`(1) | — | (b) shared form primitives; no leak |
| `InfoBanner` | 5 | (b) `invite-form`,`join-form`,`notifications-center`,`reminder-notice`,`profile-form` |
| `ContactCard` | 3 | (a) `contacts-manager` (live), 💀 old `emergency-card`/`doctors-manager` |
| `states` (Empty/Error/Loading) | 29 | (b) `circle-gate` + the `/new`+`invite`+`invitations` route wrappers (permission-denied `EmptyState`); (a) old screens; (c) `(tabs)/index.tsx` error branch |
| `ItemActions` | 3 | (b) `contacts-manager`, `medication-editor`; 💀 `doctors-manager` |
| `UnsavedChangesGuard` | 13 | (b) every old form/editor + `profile-form` — keep (behavioral) |

**Interpretation:** Only **one genuine leak** — `(tabs)/index.tsx` (Home route) renders old `Screen`/`ErrorState`/`LoadingState`/`ThemedView` + `CareCircleOnboarding` on its loading/error/no-circle branches; the 11 `figma-*` screens + `explore`/`account` are 100% clean. Everything else in bucket **(a)** is an old screen reachable only through a seam (a `+`/row tap from a migrated center) — those are the redesign targets. Bucket **(b)** primitives are correct to keep and reskin in the Forms pass (they carry validation, the picker fix, and the unsaved-guard). `UnsavedChangesGuard` needs **no Figma design** (native OS dialog) — only watch that migrated back controls still trigger `beforeRemove`.

---

## 6. Figma Make export coverage matrix

The export (`docs/figma/make-export/extracted/src/app/components/`) = `App.tsx` shell + **13 center/list frames** + `BottomNav` + 60 unused shadcn primitives. **Zero** standalone detail/edit/auth/onboarding/settings/picker frames.

| Sanad surface category | Export status |
|---|---|
| Center/list screens (×12) + bottom nav | **Generated** (already migrated) |
| Add SHEET — medications / tasks / vitals / daily-logs | **Generated but shallow** (text inputs / chips; no schedule, no pickers, no validation, no role gating) |
| Invite SHEET — members | **Generated** (code-share only) |
| Add — appointments / doctors | **Missing** (the `+` is a dead button in the export) |
| Add — visits | **Missing** (no Visits frame; reuses Appointments) |
| Detail `/[id]` — all (meds/tasks/appts/visits/logs/vitals) | **Missing entirely** |
| Edit forms / medication schedule editor | **Missing entirely** |
| Role-change modal · Remove-member confirm · Invitations list | **Missing** (roles read-only; `UserMinus` has no handler) |
| Notification settings · push opt-in / permission | **Missing** (only the feed exists; Account conflates settings with feed) |
| Recipient-profile editor · Emergency-contacts editor | **Missing** (only the read-only emergency card exists) |
| Auth (sign-in/up) · Onboarding/no-circle/create-circle · Join-circle | **Missing entirely** (export boots into a signed-in, circle-present state) |
| Pickers (date/time/weekday/timezone/option) | **Missing entirely** |

**Net:** almost every unmigrated surface must be designed **fresh** in Figma Make from the established visual language; the only partial blueprints are four shallow add sheets + one invite sheet, all of which diverge from the real data model.

---

## 7. Recommended implementation phases (after Figma designs land)

1. **Forms pass (P0 first):** the picker kit + form primitives (PickerSheet/Date/Time/Option/FormField/FormModal/FormActions) → then the add forms (medication+schedule editor incl. duplicate-time/conflict states, task, appointment, vital, daily-log, visit) + the doctor/contact/invite sheets. Preserve all validation + unsaved guard.
2. **Detail screens pass:** all `/[id]` editors (meds/tasks/appts/visits/logs/vitals) + medication schedules manager + ItemActions; **re-attach doctor edit/delete** to the Figma doctor card.
3. **Member-management pass:** re-expose change-role (role-modal), invitations list, make-owner/leave/reactivate + inactive section + owner/last-admin notes; add remove-member confirmation.
4. **Settings/onboarding pass:** auth (sign-in/up), create-circle onboarding + no-circle gate, join-circle, notification-settings + push-status + test section, recipient-profile, emergency-contacts; **restore the dropped entry points** to recipient-profile & emergency-contacts (from Home/Account/Emergency card); fix the Home loading/error/no-circle branches.
5. **Cleanup pass:** delete dead code (`circle-dashboard`, `today-overview`, `today-care-ring`, `*-center`×6, old `emergency-card`, `members-manager`, `doctors-manager`, `role-modal` once re-homed, `nav-card`, `dashboard-tile`, `*-card`×6).

---

*Inventory current as of 2026-06-16. Report only — no source/config/package changed; not committed. Hand the companion prompt `docs/figma/sanad-mobile-missing-screens-figma-make-prompt.md` to Figma Make to generate the missing designs.*
