# Sanad — Product Map, Workflows & UI Inventory (Master QA Checklist)

**Date:** 2026-07-14
**Repo:** `E:\Projects\sanad-mobile-clean`
**Branch:** `master` · **HEAD:** `ced8554` (`chore(notifications): mark local action test qa-only`)
**Working tree at report time:** clean
**Method:** code-only, read-only inspection (Read / Grep / Glob + git read-only). No source changed, no Supabase/SQL/deploy/cron/secret access. `.env` values not opened; no tokens/secrets/`cron.job.command` bodies read.

> **How to read this report.** Every claim is grounded in source and cited as `path:line`. Uncertainty is tagged **Needs runtime QA** (can't be proven from code) or **Inferred** (strong code signal, not executed). Findings verified by direct grep during this pass are marked **CONFIRMED (code-verified)**. Arabic UI labels are quoted from `src/locales/ar.json`; English from `src/locales/en.json`. This document is intended as a product-QA master checklist — sections C, D, F, G, and L are the actionable cores.

---

## Table of contents

- [A. Executive summary](#a-executive-summary)
- [B. Architecture overview](#b-architecture-overview)
- [C. Route / page map](#c-route--page-map)
- [D. UI action inventory](#d-ui-action-inventory)
- [E. Workflow catalog](#e-workflow-catalog)
- [F. Role & permission matrix](#f-role--permission-matrix)
- [G. Forms & validation matrix](#g-forms--validation-matrix)
- [H. Notifications & cron summary](#h-notifications--cron-summary)
- [I. Data model / API interaction map](#i-data-model--api-interaction-map)
- [J. Accessibility / Arabic / RTL / elder-friendly UX](#j-accessibility--arabic--rtl--elder-friendly-ux)
- [K. Web / native parity](#k-web--native-parity)
- [L. Known issues / bugs / polish backlog](#l-known-issues--bugs--polish-backlog)
- [M. Suggested next phases](#m-suggested-next-phases)
- [N. Evidence appendix](#n-evidence-appendix)

---

## A. Executive summary

### What Sanad is
Sanad ("سند" — *support*) is an **Arabic-first, RTL, family elderly-care coordination app** built with **Expo Router / React Native (Expo SDK 56, React 19, RN 0.85)** on a **Supabase** backend (Postgres + RLS + RPCs + Edge Functions + pg_cron). A family creates a **care circle** around one **care recipient** (the elder), invites other members with roles, and coordinates care: **medications & dose schedules, tasks, doctor appointments, family visits, daily wellbeing logs, vital readings, doctors, emergency contacts, and an emergency card**. A **responsibility-aware notification engine** sends detailed Arabic push reminders and an in-app notification center. The product is bilingual-capable (ar/en with full key parity) but hard-defaults to Arabic.

### Target users
- **Primary caregivers / family managers** (admin, primary_caregiver) who set up the circle and manage all care data.
- **Collaborating family members** (family_member) who take responsibility for specific tasks/doses/visits.
- **Remote family** (remote_member) who follow along and receive follow-up summaries.
- The **elder** is a data subject (a `care_recipients` row), not necessarily an app user; the `elder` role exists in the enum but is deferred/unassignable.
- Users are assumed to be **older, Arabic-reading adults on modest Android hardware** — the design system encodes elder-accessibility mandates (large touch targets, status-by-icon-not-color, medical-safety disclaimers).

### Current maturity
**Late-beta / MVP-candidate.** The backend, data model, RLS, responsibility/claim model, and the notification+cron engine are **deep and production-deployed** (3 active cron jobs, end-to-end push proven — see §H). The client is feature-complete across 9 care domains with a polished "Figma exact-copy" visual layer. **However, the app is visibly mid-migration between a legacy "Sanad" UI system and the newer "Figma" system, and that migration left several fully-built management screens unrouted** — the single most important product risk in this report (see below and §L).

### Main workflows that appear complete
- Sign up / sign in / sign out (email+password Supabase auth).
- Create a care circle (onboarding) and join a circle by one-time invite code.
- Create/edit/complete/cancel/delete **tasks, appointments, visits**; create/edit **medications + multi-time schedules** and log dose status; create/edit **daily logs & vitals**.
- Invite members (create + revoke one-time codes) and view the roster.
- Claim unassigned work ("متاح للتكفّل" / Available to claim).
- Notification permission/registration, per-scope notification settings, in-app notification center with tap-to-deep-link and in-app complete/snooze.
- Detailed Arabic remote push reminders via the deployed cron+edge pipeline.

### Major known limitations (headline)
1. **P0 — Member management is unreachable.** Only `FigmaMembers` (view roster + remove member + invite shortcut) is routed. The fully-built `MembersManager` + `RoleModal` (change role, reactivate a removed member, leave circle, transfer ownership, in-screen invite/manage-invitations) **is imported by nothing** — **CONFIRMED (code-verified)**. Change-role / leave / transfer-ownership are effectively missing from the shipped app. Additionally, **remove member on the live screen has no confirmation dialog** (single tap removes).
2. **P1 — Recipient medical profile & emergency contacts are effectively read-only in shipped navigation.** `/recipient-profile` and `/emergency-contacts` are linked **only** from the dead `CareCircleDashboard` (**CONFIRMED**); the live Home (`FigmaHome`), Explore, and Account expose neither. Onboarding captures only recipient name + birth date, so **blood type, allergies, chronic conditions, emergency notes, and all emergency contacts cannot be entered in-app** — yet the Emergency Card renders exactly those fields.
3. **P1 — Doctors can be added & called but not edited or deleted** (edit/delete live only in the unrouted legacy `DoctorsManager`).
4. **P1 — The circle-timezone change UI is unreachable.** `CircleTimezoneCard` has **no importer at all** (**CONFIRMED**); timezone is only set best-effort from device tz at circle creation. Wrong timezone → reminders fire at the wrong local time with no in-app fix.
5. **Android backgrounded-remote notification action buttons are not delivered** (accepted MVP limitation, documented — see §H). Detailed remote text + tap-to-open + in-app complete/snooze all work reliably.
6. **Detail-screen status mutations (complete/cancel) fire instantly with no confirmation** across tasks/appointments/visits, and there is **no reopen/undo for completed/cancelled tasks**.
7. **Two parallel design systems + several dead legacy components** (`*Center`, legacy fieldsets, dashboard) ship together — drift and bundle risk.

### MVP recommendation
**Do not ship without closing the navigation/reachability gaps (P0/P1 cluster) — they are the difference between "feature built" and "feature usable."** Concretely: (a) route member management (or graft change-role/leave/transfer/reactivate into `FigmaMembers`) and add a remove confirmation; (b) add in-app entry points to `/recipient-profile` and `/emergency-contacts` (and mount the timezone control); (c) surface doctor edit/delete. These are wiring/UX fixes on already-built, already-RLS-protected features — low backend risk, high product impact. Everything else (status-confirm dialogs, dead-code cleanup, elder-type-scale) is P1/P2 polish. The notification decision (2F-11C/2F-11D) is settled and correct for MVP.

---

## B. Architecture overview

### Stack (`package.json`)
Expo `~56.0.12`, expo-router `~56.2.11`, React `19.2.3`, React Native `0.85.3`, `@tanstack/react-query ^5`, `@supabase/supabase-js ^2.107`, `nativewind ^4` + Tailwind, `zod ^4`, `i18next`/`react-i18next`, `lucide-react-native`, `@expo/vector-icons`, Cairo + IBM Plex Sans Arabic fonts, `react-native-reanimated 4`, `expo-notifications ~56`, `expo-secure-store`, `expo-sqlite`, `expo-localization`. `experiments.reactCompiler: true`, `typedRoutes: false` (`app.json:54-57`). Scheme `sanadmobile`; Android package `com.mrbarhum.sanadcare`; EAS projectId present in `app.json`. **No test runner** — validation is `tsc --noEmit` + `npm run check:mojibake` + `git diff --check`.

### Provider composition (`src/providers/index.tsx:18-28`, `src/app/_layout.tsx`)
Outer → inner: **`SafeAreaProvider` → `QueryProvider` (single QueryClient, retry 2, staleTime 30s) → `AuthProvider` → `CircleSelectionProvider`**. i18next is imported for its side effect before any provider (`providers/index.tsx:2`), applying RTL at module load. Root layout gates first paint on font load (IBM Plex Sans Arabic + Cairo + icon glyph fonts, `_layout.tsx:44-61`), calls `bootstrapNotifications()` unconditionally **before the auth gate** so OS notification channels + action categories exist on cold/signed-out launch (`_layout.tsx:68-70`), and renders `<AnimatedSplashOverlay/>` + a headerless `<Stack>`.

- **`AuthProvider`** (`auth-provider.tsx`): resolves persisted session once via `supabase.auth.getSession()`, subscribes to `onAuthStateChange`, ties token auto-refresh to `AppState` foreground. Exposes `{ session, user, isLoading }`.
- **`CircleSelectionProvider`** (`circle-selection/provider.tsx`): loads all **active** memberships (`fetchUserCircles`), persists a per-user selected circle id (`sanad_active_circle_<uid>` in SecureStore/localStorage), exposes `activeCircle` (with derived `role`, `canManage`, `canLogDoses`), `hasNoCircles`, `setActiveCircle` (broad `invalidateQueries()` on switch).
- **Supabase client** (`lib/supabase.ts`): fails fast if `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` missing (no bundled fallback). Native uses a custom **`ChunkedSecureStore`** (Keychain/Keystore, 2000-byte chunked because Supabase sessions exceed SecureStore's ~2048-byte limit); web uses default browser storage. `autoRefreshToken/persistSession: true`, `detectSessionInUrl: false`.

### Routing (Expo Router, file-based)
Root Stack (headerless) → two groups + a deep authenticated stack. **Two mirror-imaged auth gates** are the only redirect points: `(app)/_layout.tsx:25-27` (`!session → /sign-in`), `(auth)/_layout.tsx:8-10` (`session → /`). `NotificationObserver` mounts only inside the authed shell. `unstable_settings.initialRouteName='(tabs)'` anchors back-navigation for deep links. There is no top-level index redirect — `/` resolves to Home which itself branches loading/error/onboarding/dashboard. Native headers are themed in `(app)/_layout.tsx` but most feature screens hide them and draw their own Figma header.

### Data layer
TanStack Query throughout; each feature folder is `api.ts` (Supabase calls / RPCs) + `hooks.ts` (queries/mutations) + `schema.ts` (zod) + screens. **No optimistic updates anywhere** — every mutation `onSuccess` invalidates query roots and refetches (correct, coarse, slight latency). Query-key roots include the circle id, so `setActiveCircle` does a broad invalidate. Generated types in `src/types/supabase.ts`; claim-flow RPCs are deliberately untyped (localized cast in `claiming/api.ts`).

### Feature modules (`src/features/*`)
`auth` (in `app/(auth)`), `care-circle` (onboarding, gate, dead dashboard), `circle-selection` (active-circle provider, permissions, timezone card, switcher), `circle-members` (roster + dead manager), `invitations`, `claiming`, `care-activity` (today summaries), `medications`, `tasks`, `appointments`, `visits`, `daily-logs`, `vitals`, `doctors`, `emergency`, `recipient-profile`, `notifications`. Most modules ship a **legacy** component and a **Figma** rebuild; the router renders the Figma variant (see the dead-code list in §L).

### Localization
Single i18next namespace `common`; `ar.json` + `en.json` mounted whole. **986 leaf keys each, zero diff** (perfect parity — no fallback leaks). `lng:'ar'` hard-coded regardless of device language; `fallbackLng:'en'`. A parallel `figma.*` namespace re-states many labels with drifting Arabic wording. RTL: native `I18nManager.forceRTL(true)` one-shot (takes effect next launch, no reload); web sets `<html dir="rtl" lang="ar">`. Bidi isolation via `LtrText`/`isolateLtr` (LRI…PDI) for phone/email/time/date/numbers. Numerals forced to Latin digits in dates (`date.ts` `ar-u-nu-latn`), except `auth` copy which uses Arabic-Indic.

### Platform differences (web / native)
`DateField`/`TimeField` use scrollable wheel `PickerSheet` on native, native `<input type=date/time>` on web (`.web.tsx` variants). Tab bar: custom bottom `FigmaTabBar` on native vs a top floating pill `TabList` on web (`app-tabs.web.tsx`). `use-color-scheme.web.ts` is hydration-guarded, but Figma components call RN `useColorScheme` directly and bypass that guard. **Push notifications: native only** — web reports `web-unsupported`; the in-app notification center still works on web.

---

## C. Route / page map

**Reachability legend:** ✅ reachable via an in-app control · 🔗 deep-link/stack-registered but **no in-app entry** in the live UI · (all routes are behind the `(app)` session gate unless in the `(auth)` group).

### Auth group (`src/app/(auth)`) — visible only when signed out
| Route | File | Page | Purpose | Access | Main components | Data | States | Nav targets |
|---|---|---|---|---|---|---|---|---|
| `/sign-in` | `(auth)/sign-in.tsx` | Sign in | Email+password login | signed-out only (guard bounces authed → `/`) | `Screen`, `AuthField`, `FigmaFooterPrimaryButton`, `Link` | none | inline field errors; `role=alert` submit error | → `/sign-up`; success → `/` (via auth state) |
| `/sign-up` | `(auth)/sign-up.tsx` | Create account | Register + optional email-confirm | signed-out only | same + confirm-password field, `InfoBanner` | none | inline errors; email-confirm info banner | → `/sign-in`; success+session → `/` |

### Tabs (`src/app/(app)/(tabs)`) — the three bottom tabs
| Route | File | Page | Purpose | Role gate | Main components | Data loaded | States | Nav targets |
|---|---|---|---|---|---|---|---|---|
| `/` | `(tabs)/index.tsx` → `FigmaHome` | Home / Today | Today-first dashboard | dose/claim controls role-scoped | `FigmaHome`, `CareLoopRing`, stat tiles, inline circle switcher | `useTodayDoses`, `useTodayTaskSummary`, `useUpcomingAppointments`, `useRecipient`, `useCircleSelection` | loading spinner; `ErrorState`+retry; onboarding when no circle; **swallows sub-query errors** (P2) | `/notifications`, `/emergency-card`, `/medications`, `/tasks`, `/appointments`, `/vitals`, `/daily-logs`, `/doctors`, `/circle-members`, `/visits`, `/available-to-claim`, `/join-circle` |
| `/explore` | `(tabs)/explore.tsx` | Explore | Static feature index | none | `FigmaScreen`, `FigmaListRow` | none (static `SECTIONS`) | none (no fetch) | `/medications`, `/tasks`, `/appointments`, `/visits`, `/vitals`, `/daily-logs`, `/doctors`, `/emergency-card`, `/circle-members` |
| `/account` | `(tabs)/account.tsx` | Account | Profile header + circles + sign-out | none | profile header, `FigmaListRow`, danger `FigmaButton` | `useAuth`, `useCircleSelection` | sign-out `role=alert` error | `/circle-members`, `/notification-settings`, `/join-circle`; sign-out |

### Care-circle / membership stack
| Route | File | Page | Purpose | Role gate | Renders | Data | States | Reach |
|---|---|---|---|---|---|---|---|---|
| `/circle-members` | `circle-members/index.tsx` | Members roster | View members; remove; invite shortcut | view: any active member; controls: managers | **`FigmaMembers`** (remove-only) | `useCircleMembers` → `list_circle_members` RPC | spinner; error+retry; role legend | ✅ (Account A1, Explore, Home) → `/circle-members/invite` |
| `/circle-members/invite` | `circle-members/invite.tsx` | Create invite | Generate one-time invite code | `canManage` (else `managersOnly` empty) | `InviteForm` + `CreatedCard` | `invitableRoles` | inline errors; created-code card | ✅ from roster "+"; → copy/share |
| `/circle-members/invitations` | `circle-members/invitations.tsx` | Invitations list | List + revoke pending invites | `canManage` (else `managersOnly` empty) | `InvitationsList` | `useCircleInvitations` → `list_circle_invitations` | `LoadingState`/`ErrorState`/`EmptyState` | 🔗 **only linked from dead `MembersManager`** → `/circle-members/invite` |
| `/join-circle` | `join-circle.tsx` | Join circle | Accept invite by code | any authed user | `JoinCircleForm` | none | trust banner; inline error; success step | ✅ (Account A3, Home dropdown, onboarding) → `/` |
| `/available-to-claim` | `available-to-claim.tsx` | Available to claim | Claim unassigned items | `canManage \|\| canLogDoses` (remote/elder blocked) | `FigmaAvailableToClaim` | `useAvailableToClaim` → `list_available_to_claim` | notAllowed / spinner / error+retry / empty; refetch on focus | ✅ (Home claim card) |

### Recipient info stack
| Route | File | Page | Purpose | Role gate | Renders | Data | States | Reach |
|---|---|---|---|---|---|---|---|---|
| `/recipient-profile` | `recipient-profile.tsx` | Recipient profile | View/edit elder identity + medical | edit: `canManage`; else read-only | `RecipientProfileForm` (legacy style) | `useRecipient` (`care_recipients`) | `LoadingState`/`ErrorState`/`EmptyState`; read-only banner | 🔗 **no in-app entry** (only dead dashboard) |
| `/emergency-card` | `emergency-card.tsx` | Emergency card | Read-only quick-reference | none (read-only) | `FigmaEmergencyCard` | `useRecipient`+`useEmergencyContacts`+`useDoctors` | header+spinner; error+retry-all; per-list empties | ✅ (Home phone icon, Explore) |
| `/emergency-contacts` | `emergency-contacts.tsx` | Emergency contacts | CRUD contacts | edit: `canManage` | `EmergencyContactsManager` (legacy) | `useEmergencyContacts` | `LoadingState`/`ErrorState`/`EmptyState` | 🔗 **no in-app entry** (only dead dashboard) |
| `/doctors` | `doctors.tsx` | Doctors | List + add + call (no edit/delete live) | add: `canManage` | `FigmaDoctors` | `useDoctors` | spinner; error+retry; empty | ✅ (Explore, Home quick-action) |

### Notifications stack
| Route | File | Page | Purpose | Role gate | Renders | Data | States | Reach |
|---|---|---|---|---|---|---|---|---|
| `/notifications` | `notifications.tsx` | Notification center | In-app inbox, tap-to-deep-link | none | **`FigmaNotifications`** | `useNotifications(null,limit)` (`notifications`) | spinner; error+retry; empty; load-more | ✅ (Home bell) |
| `/notification-settings` | `notification-settings.tsx` | Notification settings | Push enable + 9 toggles + quiet hours | none | `NotificationSettings`, `PushStatusCard` | `useNotificationPreferences(scope)` | hidden until loaded; `role=alert` save error | ✅ (Account A2) |

### Operational feature stacks (each: `index` / `new` / `[id]` under a nested `_layout` with `initialRouteName:'index'`)
| Base route | Index renders | `new` gate | `[id]` behavior | List data | Reach |
|---|---|---|---|---|---|
| `/medications` | `FigmaMedications` (Today doses / All meds tabs) | `canManage` (else `managersOnly`) | `MedicationEditor`: manager→edit, else read-only | `useTodayDoses` + `useActiveMedications` | ✅ |
| `/tasks` | `FigmaTasks` (Today/Open/Done) | `canManage` (else `managersOnly`) | `TaskEditor`: manager→edit, else view (+assignee status) | `useTasks` | ✅ |
| `/appointments` | `FigmaAppointments` (Upcoming/Completed) | `canManage` | `AppointmentEditor` | `useUpcomingAppointments` (**past excluded at query layer**) | ✅ |
| `/visits` | `FigmaVisits` (Upcoming/Recent) | `canManage \|\| canLogDoses` (else `cannotAdd`) | `VisitEditor` | `useVisits` (full history) | ✅ |
| `/daily-logs` | `FigmaDailyLogs` | `canManage \|\| canLogDoses` (else `cannotAdd`) | `DailyLogEditor`: manager or author→edit | `useDailyLogs` | ✅ |
| `/vitals` | `FigmaVitals` (2-col grid) | `canManage \|\| canLogDoses` (else `cannotAdd`) | `VitalEditor`: manager or author→edit | `useVitals` | ✅ |

All six use the shared **`CircleGate`** (`care-circle/circle-gate.tsx:16`) which renders loading / error+retry (`careCircle.loadError`) / no-circle (`careCircle.noActiveCircle`) before the screen.

---

## D. UI action inventory

Side-effect classes: **nav** (navigation-only) · **local** (local state) · **db** (Supabase mutation) · **notif** (schedules/registers a notification) · **destructive** · **external** (dialer/share/clipboard).

### D.1 Auth screens
| Screen | Control (AR / EN) | File:line | Handler | Side-effect | Enabled / who | Confirm |
|---|---|---|---|---|---|---|
| Sign-in | Email field — البريد الإلكتروني / Email | `sign-in.tsx` | `setEmail` | local | all | — |
| Sign-in | Password + eye toggle — كلمة المرور / Password | `sign-in.tsx` | `setPassword`/`setShow` | local | all | — |
| Sign-in | تسجيل الدخول / Sign in | `sign-in.tsx:123` | `onSubmit`→`signInWithPassword` | db (auth) | all; loading-gated | none |
| Sign-in | إنشاء حساب / Sign up (link) | footer | `Link href="/sign-up"` | nav | all | — |
| Sign-up | + confirm password — تأكيد كلمة المرور / Confirm password | `sign-up.tsx` | `setConfirm` (local match only, never sent) | local | all | — |
| Sign-up | إنشاء حساب / Create account | `sign-up.tsx:114` | `onSubmit`→`signUp` | db (auth) | all | none; email-confirm banner if `!session` |
| Sign-up | تسجيل الدخول / Sign in (link) | footer | `Link href="/sign-in"` | nav | all | — |

### D.2 Home (`figma-home.tsx`)
| # | Control (AR / EN) | Line | Handler | Side-effect | Who | Confirm |
|---|---|---|---|---|---|---|
| H1 | Circle name + chevron | `:189` | `setSwitcherOpen` | local | all | — |
| H2 | Bell — الإشعارات | `:206` | `router.push('/notifications')` | nav | all | — |
| H3 | Phone (red) — بطاقة الطوارئ | `:213` | `router.push('/emergency-card')` | nav | all | — |
| H4 | Circle row (switch) | `:229` | `setActiveCircle` | local + **broad invalidate** | all | — |
| H5 | الانضمام إلى دائرة أخرى / Join another circle | `:248` | `router.push('/join-circle')` | nav | all | — |
| H6 | عرض الكل / View all (meds) | `:266` | `router.push('/medications')` | nav | all | — |
| H7 | Tasks stat tile | `:325` | `router.push('/tasks')` | nav | all | — |
| H8 | Appointments stat tile | `:334` | `router.push('/appointments')` | nav | all | — |
| H9 | Next-appointment card | `:346` | `router.push('/appointments')` | nav | all (if next appt) | — |
| H10 | Quick-actions grid ×8 | `:370` | `router.push(route)` | nav | all | — |
| H11 | متاح للتكفّل / Available to claim | `:387` | `router.push('/available-to-claim')` | nav | `canManage\|\|canLogDoses` only | — |
| H12 | كل الأدوية / All medications | `:414` | `router.push('/medications')` | nav | all (if doses) | — |
| H13 | تسجيل / Log (dose) | `:555` | `onToggle` (expand tray) | local | `canLog && (canManage \|\| responsible===me)` and unlogged | — |
| H14 | أُعطيت / مؤجَّلة / لم تُعطَ (Given/Postponed/Missed) | `:566` | `onSetStatus`→`logDose` | **db (`medication_logs`)** | same as H13 | **none — instant, no undo** |
| H15 | Emergency banner + عرض / View | `:437` | `router.push('/emergency-card')` | nav | all | — |

### D.3 Explore & Account
| Screen | Control | Handler | Side-effect | Who | Confirm |
|---|---|---|---|---|---|
| Explore | 9 static rows (Daily care / Health / Care circle groups) | `router.push(item.route)` | nav | all | — |
| Account | A1 active circle → `/circle-members` | `router.push` | nav | if active circle | — |
| Account | A2 إعدادات الإشعارات → `/notification-settings` | `router.push` | nav | all | — |
| Account | A3 الانضمام إلى دائرة أخرى → `/join-circle` | `router.push` | nav | all | — |
| Account | A4 **تسجيل الخروج / Sign out** | `onSignOut` | **destructive + db(auth) + notif** (best-effort `deactivate_push_token` then `signOut`) | all | **none — no dialog** |

### D.4 Tasks (`figma-tasks.tsx`, `task-editor.tsx`)
| Location | Control (AR / EN) | Handler → mutation | Side-effect | Who | Confirm |
|---|---|---|---|---|---|
| List header | + / إضافة مهمة | `router.push('/tasks/new')` | nav | `canManage` only | — |
| List row | card tap | `router.push('/tasks/{id}')` | nav | all | — |
| List row | checkbox — إنجاز / Complete | `setConfirm({task,'complete'})` → sheet → `completeTask` | db | manager or assignee (`canActOn`) | **yes — `TaskConfirmSheet`** |
| List row | X — تعذّر الإنجاز / Couldn't complete | `setConfirm({task,'cancel'})` → sheet → `cancelTask` | destructive/db | same | **yes** |
| Detail | تم الإنجاز / Mark complete | `run('complete')`→`completeTask` | db (`status=completed`,`completed_by/at`) | manager or assignee | **none — instant** ⚠ (inconsistent with list) |
| Detail | تعذّر الإنجاز / Couldn't complete | `run('cancel')`→`cancelTask` | destructive/db (`cancelled_at`; no `cancelled_by`) | same | **none — instant** ⚠ |
| Detail | حفظ التغييرات / Save changes | `onSubmit`→`updateTask` | db | `canManage` (edit screen) | inline validation |
| Detail | حذف المهمة → تأكيد الحذف / Delete → Confirm | `useDeleteTask`→`router.back()` | destructive (hard delete) | `canManage` | **yes — inline 2-step** |

**No reopen/undo for completed/cancelled tasks** anywhere.

### D.5 Medications (`figma-medications.tsx`, `medication-editor.tsx`, schedule editors)
| Location | Control (AR / EN) | Handler → mutation | Side-effect | Who | Confirm |
|---|---|---|---|---|---|
| List | + / إضافة دواء | `router.push('/medications/new')` | nav | `canManage` only | — |
| List | tabs جرعات اليوم / كل الأدوية | `setTab` | local | all | — |
| List | تسجيل / Log → أُعطيت/مؤجَّلة/لم تُعطَ | `setStatus`→`logDose` (insert/update `medication_logs`) | db | `canLog && (manager \|\| responsible===me)`; only when **unlogged** | **none — instant; can't correct once logged** |
| List | med row | `router.push('/medications/{id}')` | nav | all | — |
| Editor | حفظ التغييرات / Save changes | `onSubmit`→`updateMedication` | db | managers | inline validation |
| Editor | إيقاف / إعادة تفعيل (Deactivate/Reactivate) | `setMedicationActive` | db | managers | **none — instant** |
| Editor | حذف الدواء → تأكيد الحذف | `deleteMedication`→`router.back()` | destructive (cascades schedules/logs) | managers | **yes — inline 2-step** |
| Schedules | إضافة جدول جرعات جديد / Add schedule | opens `ScheduleModalHost` | local→modal | managers | — |
| Schedule card | إيقاف/إعادة تفعيل | `setScheduleActive` | db | managers | **none** |
| Schedule card | تعديل (Edit) | `setEditing(schedule)` → modal | local | managers | — |
| Schedule card | حذف → تأكيد الحذف | `deleteSchedule` | destructive | managers | **yes — inline 2-step** |
| Schedule modal | Add/Save schedule | `createSchedule`/`updateSchedule` (conflict-checked) | db | managers | discard-guard on close |

### D.6 Appointments & Visits (`*-editor.tsx`, `figma-*.tsx`)
| Vertical | Control (AR / EN) | Handler → mutation | Side-effect | Who | Confirm |
|---|---|---|---|---|---|
| Appt | + / إضافة موعد | `router.push('/appointments/new')` | nav | `canManage` | — |
| Appt | تم الموعد / Mark completed | `set_assigned_appointment_outcome` (RPC) | db | manager or assignee; only `scheduled` | **none — instant** |
| Appt | تعذّر الموعد / Couldn't attend | same RPC (`cancelled`) | db | same | **none** |
| Appt | إعادة كمجدول / Mark as scheduled (reopen) | `setAppointmentStatus` (direct update) | db | **managers only** | **none** |
| Appt | حفظ التغييرات; حذف→تأكيد | `updateAppointment`; `deleteAppointment` | db; destructive | managers | delete: inline 2-step |
| Visit | + / إضافة زيارة | `router.push('/visits/new')` | nav | `canManage\|\|canLogDoses` | — |
| Visit | تمت الزيارة / تعذّرت الزيارة | `setVisitStatus` (direct update) | db | manager or linked owner; only `planned` | **none — instant** |
| Visit | إعادة كمخطّطة (reopen) | `setVisitStatus('planned')` | db | **managers only** | **none** |
| Visit | حفظ التغييرات; حذف→تأكيد | `updateVisit`; `deleteVisit` | db; destructive | managers | delete: inline 2-step |

### D.7 Daily logs & Vitals (`log-editor.tsx`, `vital-editor.tsx`)
| Vertical | Control (AR / EN) | Handler → mutation | Side-effect | Who | Confirm |
|---|---|---|---|---|---|
| Both | + / إضافة سجل / إضافة قياس | `router.push('/{feature}/new')` | nav | `canManage\|\|canLogDoses` | — |
| Both | card tap | `router.push('/{feature}/{id}')` | nav | all | — |
| Both | حفظ التغييرات / Save changes | `update*` | db | manager or author | inline |
| Both | حذف السجل / حذف القياس → تأكيد الحذف | `delete*`→`router.back()` | destructive (hard delete) | manager or author | **yes — inline 2-step** |

### D.8 Recipient / Doctors / Emergency (`profile-form.tsx`, `figma-doctors.tsx`, `contacts-manager.tsx`, `figma-emergency-card.tsx`)
| Screen | Control (AR / EN) | Handler → mutation | Side-effect | Who | Confirm |
|---|---|---|---|---|---|
| Recipient profile | حفظ التغييرات / Save changes | `updateRecipient` | db (`care_recipients`) | `canManage` (read-only banner otherwise) | nav-level unsaved guard |
| Doctors | + / إضافة طبيب → `DoctorFormModal` | `createDoctor` | db | `canManage` | discard-guard |
| Doctors | Call / اتصال {name} | `Linking.openURL('tel:…')` | **external (dialer)** | if phone | **none — dials immediately** |
| Doctors | **edit/delete** | — | — | **not present on live screen (P1)** | — |
| Emergency contacts | إضافة جهة اتصال / Add contact | `createEmergencyContact` | db | `canManage` | discard-guard |
| Emergency contacts | Edit / تعديل | `setEditing` → modal | local | `canManage` | — |
| Emergency contacts | حذف → تأكيد الحذف | `deleteContact` | destructive | `canManage` | **yes — inline 2-step** |
| Emergency contacts | Call / اتصال {name} | `tel:` | external | if phone | none |
| Emergency card | Call rows / Back / Retry | `tel:` / `router.back()` / refetch-all | external / nav / local | all | — |

### D.9 Members / Invites / Claim
| Screen | Control (AR / EN) | Handler → RPC | Side-effect | Who | Confirm |
|---|---|---|---|---|---|
| Members (live) | + / دعوة عضو | `router.push('/circle-members/invite')` | nav | `canManage` | — |
| Members (live) | Remove / إزالة {name} | `update_circle_member_status('removed')` | **destructive/db** | manager, not self/owner/last-admin | **none — single tap (P0)** |
| Invite | إنشاء دعوة / Create invitation | `create_circle_invitation` | db (returns one-time code) | `canManage` | — |
| Invite created | نسخ الرمز / Copy code | web clipboard / native Share | external | manager | — |
| Invite created | مشاركة / Share | `navigator.share`/`Share.share` | external | manager | — |
| Invitations list | إلغاء → تأكيد الإلغاء / Revoke → Confirm | `revoke_circle_invitation` | destructive | manager; pending only | **yes — inline 2-step** |
| Join circle | انضمام / Join circle | `accept_circle_invitation` | db (creates membership) | any authed | none |
| Available-to-claim | أنا متكفّل / I'll take it | `claim_*` RPC | db (sets responsibility to self) | claim-capable | **none — instant** (race → `alreadyClaimed` sheet) |

### D.10 Members management (built, **NOT routed — unreachable, CONFIRMED**)
The following exist in `members-manager.tsx` + `role-modal.tsx` but no route imports them: change role (`update_circle_member_role`), reactivate (`update_circle_member_status('active')`), leave circle (`leave_care_circle`), make owner / transfer ownership (`transfer_circle_ownership`), in-screen invite & manage-invitations shortcuts. Documented here so the intended model is on record; see §L-P0.

### D.11 Notification settings (`notification-settings.tsx`)
| Control (AR / EN) | Handler | Side-effect | Notes |
|---|---|---|---|
| تفعيل الإشعارات / Enable notifications | `enable()` | **notif (permission prompt) + db(`register_push_token`)** | only when supported & not enabled |
| إيقافها على هذا الجهاز / Turn off on this device | `disable()` | db (`deactivate_push_token`) | when enabled |
| Scope chip (global / per-circle) | `setScope` | local (reloads prefs) | — |
| 9 toggle switches (see §H.3) | `update(key,v)` | local (dirties form) | — |
| Quiet-hours toggle + from/to `TimeField` | `update(...)` | local | validated on save |
| حفظ الإعدادات / Save settings | `onSave`→`upsert_notification_preferences` | db | disabled while pending |
| إرسال إشعار تجريبي / Send test | `scheduleLocalTestNotification` | notif (local, no server row) | native only |
| **DEV · اختبار أزرار الإشعار (محلي)** | `scheduleLocalActionButtonTest` | notif (local) | `__DEV__` only; QA regression tool |

---

## E. Workflow catalog

Each workflow is end-to-end with the exact mutations/RPCs and the reachability status.

**E.1 Onboarding / sign in / sign out**
- **Sign up:** `/sign-up` → zod (email, password ≥6, confirm match) → `supabase.auth.signUp` → if email-confirm required, info banner; if session returned, `(auth)` guard redirects to `/`. No password-reset flow exists anywhere (gap).
- **Sign in:** `/sign-in` → `signInWithPassword` → auth state change → `(app)` guard renders Home. All failures collapse to one generic "Invalid login credentials" message.
- **Sign out:** Account A4 → best-effort `deactivate_push_token(rememberedToken)` (needs auth context, runs first) → `supabase.auth.signOut()` → guard redirects to `/sign-in`. **No confirmation.**

**E.2 Create a care circle (first run)** — reachable ✅
Home detects `hasNoCircles` → `CareCircleOnboarding` → form (circle name [default "رعاية الوالد"], recipient full name [required], birth date [optional]) → `create_care_circle` RPC (circle + owner admin membership + recipient, single txn) → best-effort `set_circle_timezone(deviceTz)` → invalidate circle list → Home swaps to dashboard.

**E.3 Join a care circle** — reachable ✅
`/join-circle` (from onboarding, Home dropdown, or Account A3) → enter one-time code → `accept_circle_invitation(p_code)` → `setPreferredCircleId(circleId)` → success step → `Continue` → `/`. Typed errors: alreadyMember / expired / revoked / used / invalid.

**E.4 Manage circle members & roles** — **partially unreachable (P0)**
- **Reachable:** view roster (`FigmaMembers`), remove a member (no confirm), open invite screen.
- **NOT reachable in live UI (built but unrouted):** change role (`update_circle_member_role`), reactivate a removed member, leave circle (`leave_care_circle`), transfer ownership (`transfer_circle_ownership`), and the in-screen "manage invitations" shortcut. Server RPCs + guardrails (last-admin, owner-protected) all exist and are correct.

**E.5 Assign responsibility** — reachable ✅ (within create/edit forms)
- **Assign at create/edit:** each operational form has a `MemberSelect` (tasks/appointments: `assigned_to`; medications: `responsible_user_id`; visits: `visitor_user_id`). Doer roles offered = admin / primary_caregiver / family_member. "أنا / Me" chip self-assigns.
- **Claim (self-assign unowned work):** `/available-to-claim` → "أنا متكفّل" → `claim_*` RPC sets responsibility to self; race-safe (`23505` → alreadyClaimed). Note: unassigned tasks are invisible to non-managers in `/tasks` and cannot be claimed there — only via the claim screen.

**E.6 Tasks: create / edit / view / complete / cancel / delete / assign** — reachable ✅
Create (`/tasks/new`, managers) → `createTask`. Edit (`/tasks/{id}`, managers) → `updateTask`. Complete/cancel: managers or the assignee — **list uses a confirm sheet; detail is instant (inconsistent)**. Delete: managers, inline 2-step. Lifecycle `open → completed | cancelled`, terminal, **no reopen**. `cancelled_by` is not recorded.

**E.7 Medications: create / edit / schedule / dose status** — reachable ✅
Create med + first schedule (`/medications/new`, managers) → `createMedicationWithSchedule` (non-transactional; compensating delete if schedule insert fails). Multi-schedule editor with weekday/time builder, conflict detection (same weekday+time in another active schedule), duplicate-time rejection. Dose logging (given/postponed/missed) from Home or the med list — instant, **cannot be corrected once logged**. "Missed" is only set by manual tap client-side; server `check-missed-doses` handles missed-dose alerts (deployed; not among the 3 active cron jobs — see §H).

**E.8 Visits: create / edit / view / complete / cancel / delete** — reachable ✅
Create (`/visits/new`, any caregiving role; non-managers auto-linked to self). Outcome (completed/cancelled) via direct `family_visits.status` update by manager or linked owner (relies on a server status-only trigger — **Needs runtime QA**). Reopen managers-only. Delete managers, inline 2-step.

**E.9 Appointments: create / edit / view / complete / cancel / delete** — reachable ✅
Create (`/appointments/new`, managers). Date+time combined into absolute `starts_at`/`ends_at`. Outcome via **RPC `set_assigned_appointment_outcome`** (manager or assignee, scheduled→completed/cancelled). Reopen managers-only. Delete managers, inline 2-step. **"Completed" tab structurally cannot show past appointments** (list query filters `starts_at >= today`).

**E.10 Daily logs & vitals** — reachable ✅
Create/edit/delete by manager or author. Daily log enforces one-per-author-per-date (`23505` → "already logged today" on create). Vitals: type-specific fields (BP=systolic/diastolic, others=numeric value + unit, `other`=notes-only allowed).

**E.11 Notification permission / registration / settings** — reachable ✅
`bootstrapNotifications()` at startup registers channel + action categories (no prompt). User taps "تفعيل الإشعارات" on `PushStatusCard` → `requestPermissionsAsync` → `register_push_token` RPC (stores in `push_tokens`; raw token never logged). Settings screen writes `notification_preferences` via `upsert_notification_preferences` (global or per-circle scope).

**E.12 Reminder push flow (server)** — deployed ✅
`enqueue-due-reminders` (cron */5) → `enqueue_notification` → `notification_outbox` → `process-notification-outbox` (cron */5): `fanout_due_notifications` (per-token) → `claim_push_deliveries` (authoritative send-time re-validation + lease) → detailed Expo push via `_shared/expo.ts` → `check-push-receipts` (cron */15). Responsibility-aware targeting resolves recipients per item (unassigned task → nobody; manager fallback for med/appt/visit).

**E.13 Notification center / deep-link flow** — reachable ✅
`/notifications` (`FigmaNotifications`) → tap row → mark read (`set_notification_read`) → `useOpenNotification`: switch active circle if the notification's circle differs and the user is still a member (else route to inbox) → `router.push(route)` from `notificationRoute()` (explicit deep_link → data.deepLink → per-type fallback). Notification *interaction* actions ("تم"/snooze) are handled in the observer, not list rows.

**E.14 QA-only local action-button test** — `__DEV__` only
`scheduleLocalActionButtonTest` (behind the DEV button in settings) schedules a local notification referencing `sanad_task_reminder` so its action buttons render — isolating the Android limitation to backgrounded remote pushes. Native-only, no server rows, compiled out of release. Retained as a regression tool (commits `d78e44d`, `ced8554`).

---

## F. Role & permission matrix

### F.0 Roles the app actually models (`circle_role` enum, `supabase.ts:1812`)
| Role | AR label | Status | Manager? | canLogDoses | Assignable as doer | Invitable by | Claim? |
|---|---|---|---|---|---|---|---|
| `admin` | مدير | Active (owner's role) | ✅ | ✅ | ✅ | — (never) | ✅ |
| `primary_caregiver` | مقدّم رعاية رئيسي | Active | ✅ | ✅ | ✅ | admin | ✅ |
| `family_member` | فرد من العائلة | Active (collaborator) | ✘ | ✅ | ✅ | admin, primary_caregiver | ✅ |
| `remote_member` | عضو عن بُعد | Active (follow-only) | ✘ | ✘ | ✘ | admin, primary_caregiver | ✘ |
| `caregiver` | مقدّم رعاية | **Deferred** (server-rejected `42501`) | ✘ | ✅ (flag) | ✘ | ✘ | ✅ (flag) |
| `elder` | مُتلقّي الرعاية | **Deferred** (server-rejected) | ✘ | ✘ | ✘ | ✘ | ✘ |

- **"Owner"** is not a role — it is `care_circles.owner_id`, surfaced per member as `is_owner`; the owner is always `admin` and is protected from demote/remove/leave until ownership is transferred.
- **"Manager"** = derived `{admin, primary_caregiver}` (`canManageCircle`). The Figma members legend simplifies the 6 roles into 3 buckets (manager / editor / viewer), which do not map 1:1 to the row role labels.

### F.1 Capability matrix (client gate → server enforcement)
| Capability | admin | primary_caregiver | family_member | remote_member | Client gate | Server (RLS/RPC) |
|---|---|---|---|---|---|---|
| View all screens / roster | ✅ | ✅ | ✅ | ✅ | `CircleGate` | `is_circle_member` |
| Add/edit/delete med, task, appointment | ✅ | ✅ | ✘ | ✘ | `canManage` | manager-only policies |
| Add visit / daily log / vital | ✅ | ✅ | ✅ | ✘ | `canManage\|\|canLogDoses` | role-set INSERT + `recorded_by=self` |
| Log a dose | ✅ | ✅ | scoped (if responsible) | ✘ | `canLog && (manager \|\| responsible===me)` | manager OR `is_responsible_for_medication` |
| Complete/cancel task | ✅ | ✅ | scoped (if `assigned_to=me`) | ✘ | `canActOn` | collaborator UPDATE requires `assigned_to=auth.uid()` + immutability trigger |
| Appointment outcome | ✅ | ✅ | scoped (assignee, **no clear UI**) | ✘ | manager path only in UI | `set_assigned_appointment_outcome` (manager or assignee) |
| Visit outcome | ✅ | ✅ | scoped (linked owner) | ✘ | manager or owner | status-only trigger |
| Edit/delete own log/vital | ✅ | ✅ | own only | ✘ | `canManage\|\|(canCollaborate&&isOwner)` | manager OR own-row |
| Claim unowned item | ✅ | ✅ | ✅ | ✘ | `canManage\|\|canLogDoses` | claim RPC rejects remote/elder `42501` |
| Invite member | ✅ (grants PC/FM/RM) | ✅ (grants FM/RM) | ✘ | ✘ | `invitableRoles` | `create_circle_invitation` |
| Change role | ✅ (any) | ✅ (non-managers only) | ✘ | ✘ | `assignableRolesFor` | `update_circle_member_role` | **⚠ UI unreachable (P0)** |
| Remove / reactivate member | ✅ | ✅ (not manager peers) | ✘ | ✘ | `canChangeStatus` | `update_circle_member_status` | remove reachable (no confirm); reactivate unreachable |
| Leave circle | ✅ (unless last admin/owner) | ✅ | ✅ | ✅ | `showLeave` | `leave_care_circle` | **⚠ UI unreachable (P0)** |
| Transfer ownership | owner only | ✘ | ✘ | ✘ | `canMakeOwner` | `transfer_circle_ownership` | **⚠ UI unreachable (P0)** |
| Set circle timezone | ✅ | ✅ | ✘ | ✘ | `CircleTimezoneCard` | `set_circle_timezone` (manager-only, **Inferred**) | **⚠ UI unreachable (no importer)** |
| Manage recipient profile / emergency contacts | edit | edit | view | view | `canManage` | RLS manager-only | **⚠ no in-app nav entry (P1)** |

### F.2 Guardrails (client + server)
Last-active-admin cannot be demoted/removed/leave (`23514`); owner cannot be demoted/removed/leave until transfer; direct client writes to `circle_members`/`care_circles` are **revoked** (all membership/ownership changes go through SECURITY DEFINER RPCs); `list_circle_members` masks emails to non-managers/non-self.

### F.3 Uncertain areas — **Needs runtime QA**
| # | Concern |
|---|---|
| Q1 | `remote_member` can **read all operational data server-side** (`can_view_all_operational` includes remote), while the UI presents them as pure followers. The migration flags this as the deliberate "single switch point" to tighten later. Confirm intended posture. |
| Q2 | **Appointment outcome by a non-manager assignee** has server support (`set_assigned_appointment_outcome`) but **no obvious client entry** (center gate is `canManage && scheduled`) — likely an RLS-allows / client-hides gap; assignees may have no way to record an appointment outcome in-app. |
| Q3 | Dose-log gate vs RLS agreement for a family_member who isn't the med's responsible person (client hides + RLS should block). |
| Q4 | `set_circle_timezone` server role check (RPC body not read this pass). |
| Q5 | `caregiver`/`elder` residual capability rendering if a legacy membership already holds one. |

---

## G. Forms & validation matrix

All forms: **submit CTA is never disabled** (validation runs on press → inline errors, `role=alert`); empty optional strings → `null` via `nullify`; unsaved-changes guard via `useUnsavedChanges` + `UnsavedChangesGuard`/`confirmDiscard`; back = `router.back()` (guarded). Zod schemas live in each feature's `schema.ts`.

### G.1 Auth
| Form | Fields | Required | Validation | Submit | Notes |
|---|---|---|---|---|---|
| Sign-in | email, password | both | `z.email()`, `min(6)` | `signInWithPassword` | LTR email; generic failure copy |
| Sign-up | email, password, confirm | all | + `password===confirm` (local, confirm never sent) | `signUp` | email-confirm banner if no session |

### G.2 Care circle / invites
| Form | Fields (required*) | Defaults | Validation | Submit |
|---|---|---|---|---|
| Onboarding | circleName*, recipientName*, birthDate | circleName="رعاية الوالد" | min1 each; birthDate `''`\|YYYY-MM-DD | `create_care_circle` (+ best-effort tz) |
| Join circle | code* | — | non-empty | `accept_circle_invitation` |
| Invite | role* (`FigmaCardSelect`), invitedName | role=family_member if allowed | server-validated role | `create_circle_invitation` (one-time code) |

### G.3 Recipient / doctors / emergency contacts
| Form | Fields (required*) | Validation | Submit | Notes |
|---|---|---|---|---|
| Recipient profile | fullName*, birthDate, dialect, bloodType, allergies, chronicConditions, emergencyNotes | fullName min1/max120; birthDate `''`\|ymd; text max limits | `updateRecipient` | read-only banner if !canManage; **screen unreachable in-app (P1)** |
| Doctor (modal) | name*, specialty, phone, clinicName, notes | name min1/max120; maxes | create/update doctor | edit/delete unreachable on live screen (P1) |
| Emergency contact (modal) | name*, relationship, phone*, isPrimary(switch), notes | name+phone required | create/update contact | **no single-primary enforcement client-side (Needs QA)**; **screen unreachable in-app (P1)** |

### G.4 Tasks
| Field | Required | Default | Validation | Error key |
|---|---|---|---|---|
| title | ✅ | '' | trim min1/max120 | `tasks.errors.title` |
| description | — | '' | max1000 | `validation.tooLong` |
| category | — | 'general' | select (8 values) | — |
| priority | — | 'normal' | select (low/normal/high/urgent) | — |
| due_date | — | '' | `''`\|ymd | `tasks.errors.dueDate` |
| due_time | — | '' | `''`\|hm; **requires date** | `dueTime`/`dueTimeNeedsDate` |
| assigned_to | — | '' | `''`→null | — |
| notes | — | '' | max1000 | `tooLong` |
Submit: create→`createTask`+`router.back()`; edit→`updateTask` (stays). **Create vs edit assignee pickers differ** (create: all active members; edit: DOER_ROLES only) — inconsistency.

### G.5 Medications (med + schedule)
| Med field | Required | Validation |
|---|---|---|
| name | ✅ | min1/max120 |
| dosage/form | — | max80 |
| instructions | — | max500 |
| withFood (switch) | — | boolean |
| responsible_user_id | — | `''`→null (not in schema) |

| Schedule field | Required | Validation |
|---|---|---|
| days_of_week | ✅ | ints 0–6, min1 (`daysRequired`) |
| times[] | ✅ | each `HH:MM`, min1; duplicates rejected |
| start_date | — | `''`→today; ymd |
| end_date | — | `''`→null; ymd; ≥ start (`endBeforeStart`) |
| notes | — | max500 |
Conflict check: same weekday+time in another **active** schedule → `conflict`. Add-flow (`FigmaScheduleFields`) additionally blocks past dates; edit modal allows past dates (historical schedules).

### G.6 Appointments / Visits
| Appointment field | Required | Validation |
|---|---|---|
| title | ✅ | min1/max120 |
| appointment_type | ✅ (default general) | 7 types |
| date | ✅ | ymd |
| start_time | ✅ | hm |
| end_time | — | `''`\|hm; ≥ start |
| location/doctor_id/assigned_to/notes | — | maxes; doctor card hidden if 0 doctors |

| Visit field | Required | Validation |
|---|---|---|
| visitor_name | ✅ | min1/max120 |
| visit_date | ✅ | ymd |
| start_time/end_time | — | `''`\|hm; end≥start |
| notes | — | max1000 |
| link (visitor_user_id) | — | managers pick; collaborators forced self |
Key diff: appointment start_time required + date/time combined to `timestamptz`; visit times optional + stored as separate date/time strings (no tz math).

### G.7 Daily logs / Vitals
| Daily-log field | Required | Notes |
|---|---|---|
| log_date | ✅ | ymd; unique per author/date (23505 → alreadyLoggedToday on create only) |
| mood/sleep/appetite/hydration/mobility | — | enum chips + "unset" |
| pain_level | — | null ("بدون") vs 0; stepper + 0–10 chips |
| bathroom/food/activity notes | — | max1000 |
| general_notes | — | max2000 |

| Vital field | Required | Notes |
|---|---|---|
| reading_type | ✅ | 7 types; changing type overwrites unit with default |
| systolic/diastolic | ✅ iff BP | positive int (maxlen 3) |
| value | ✅ non-BP except `other` | positive number |
| unit | — | free text, default per type |
| date/time | ✅ | ymd/hm → `reading_at` instant |
| notes | — | max1000 |

### G.8 Notification settings
9 boolean toggles + quiet-hours (both bounds required + `HH:MM` when enabled) + display-only timezone. Submit `upsert_notification_preferences`. **No unsaved-changes guard** (leaving discards edits — Needs QA).

---

## H. Notifications & cron summary

### H.1 Current production decision (Android background action buttons) — settled
Per `docs/claude-reports/2026-07-13-phase-2f-11c-closeout-and-2f-11d-decision.md` (PRODUCT DECISION 2026-07-14, "Option A for MVP"):
- **Backgrounded/terminated remote pushes render NO action buttons on Android.** The Edge sender sets top-level `title`/`body`/`channelId`, so Android renders it as an FCM **Notification Message** directly — expo-notifications' category builder never runs, so the registered `تم` / `ذكرني بعد 5 دقائق` buttons are not attached. Root cause confirmed (Expo delivery table + expo/expo#31503 + exact symptom match). **This is a documented Android/Expo limitation, not a Sanad bug.**
- **MVP accepts it** to preserve reminder delivery reliability (delivery > lock-screen button convenience for a care product).
- **The reliable remote path is kept:** detailed Arabic title/body (`_shared/messages.ts`) + tap-to-open deep-link + in-app complete/snooze. This is fully working and deployed (2F-11B: detailed text arrived on-device, PASS).
- **Local + foreground action buttons work** (local Test A PASS on Samsung S24; RTL order fixed to right=`تم`, left=`ذكرني بعد 5 دقائق`, commit `9c1d12c`).
- **2F-11D (data-only + background-task push) is deferred, QA-only** — a future prototype only behind a QA feature flag with a Samsung reliability gate (foreground/background/killed × Doze × battery-opt must match the Notification-Message display rate/latency, or revert). Option C (native/direct FCM) deferred further.
- **Dev-only local action-button test is a retained QA regression tool** (`scheduleLocalActionButtonTest` + `__DEV__` button; native-only; compiled out of release; no server rows).

### H.2 Reliable remote path & client plumbing
- Startup `bootstrapNotifications()` (root layout, before auth gate): foreground handler (banner+list, no sound/badge), Android channel `default` ("Sanad reminders", DEFAULT importance), 5 action categories (`sanad_{medication,task,visit,appointment}_reminder` = [snooze, complete]; `sanad_generic_reminder` = [snooze]). Idempotent, coalesced, never prompts.
- Permission prompt only on explicit tap → `register_push_token` RPC → `push_tokens`. Raw token never logged. Web/simulator honestly report unsupported.
- Snooze = local reschedule ~5 min (deterministic id, cancels prior, no server state). "تم" completion maps to safe existing mutations only (task complete / visit-appointment outcome / dose `given` log); missing context → open detail.

### H.3 Notification-settings toggle catalog (writes `notification_preferences` via `upsert_notification_preferences`; all default true)
| Toggle (AR / EN) | Controls | Column |
|---|---|---|
| تذكيرات الأدوية / Medication reminders | `medication_due` | `medication_reminders` |
| تنبيهات الجرعات الفائتة / Missed dose alerts | `medication_missed` | `missed_dose_alerts` |
| تذكيرات المهام / Task reminders | `task_due`(+overdue) | `task_reminders` |
| تذكيرات المواعيد / Appointment reminders | `appointment_upcoming` | `appointment_reminders` |
| تذكيرات الزيارات / Visit reminders | `visit_upcoming` | `visit_reminders` |
| تحديثات الزيارات / Visit updates | `visit_update` | `visit_updates` |
| تحديثات الرعاية / Care updates | `care_update` | `care_updates` |
| تنبيهات الطوارئ / Emergency alerts | `emergency` (never snoozable) | `emergency_alerts` |
| ملخّصات المتابعة / Follow-up summaries | remote-member summaries | `remote_summary` |
Plus **quiet hours** (start/end `HH:MM`, crosses midnight, emergency may still arrive) and a display-only device timezone. Three columns (`assignment_alerts`, `activity_updates`, `available_to_claim_digest`) are persisted but have **no visible toggle** (deferred producers).

### H.4 Server pipeline & cron state (from reports — NOT queried live)
Per `docs/claude-reports/2026-07-08-phase-2f-10m-active-cron-smoke-test-execution.md` (COMPLETE — PASS), **three cron jobs are active** on the cloud project:
| Job | Schedule |
|---|---|
| `sanad-enqueue-due-reminders` | `*/5 * * * *` |
| `sanad-process-notification-outbox` | `*/5 * * * *` |
| `sanad-check-push-receipts` | `*/15 * * * *` |
- Pipeline: `enqueue-due-reminders` → `enqueue_notification` → `notification_outbox` → `process-notification-outbox` (`fanout_due_notifications` then authoritative `claim_push_deliveries` lease + re-validation) → Expo push → `check-push-receipts`. Occurrence resolution uses the **care-circle timezone**; send-time gates re-check expiry, membership, role, preference, quiet hours, token state, and source validity. Delivery is **at-least-once** (rare duplicates possible).
- **`check-missed-doses` is deployed but NOT among the 3 active cron jobs** → the tier-2 missed-dose escalation may not fire in production. **Flag for product / needs cron re-inspection.**
- Cron runs on `pg_cron` + `pg_net`; the cron secret is pulled from Supabase Vault by name at call time (never inlined). If either extension is disabled, the reminder chain silently stops.
- 2F-10M proved end-to-end: producer → processor → one Android push (generic OS text at the transport layer; detailed content added in 2F-11A) → `receipt_status=ok`, with a mid-window reschedule correctly `skipped occurrence_changed`.

### H.5 Remaining notification risks / polish
- `notifications-center.tsx` (per-circle filter, per-row mark-unread, RefreshControl) is **dead** — route renders `FigmaNotifications` which drops those features.
- Notification settings has **no unsaved-changes guard**.
- Single Android channel for all types (emergency shares DEFAULT importance; priority bumped only at send time).
- `NotificationBell` (unread badge) is mounted only in the dead dashboard → no app-wide unread indicator.
- Snooze/completion confirmation strings are **hardcoded Arabic** (bypass i18next).

---

## I. Data model / API interaction map

### I.1 Tables (all `circle_id`-scoped except `profiles`; `src/types/supabase.ts`)
| Table | Purpose | Read by | Mutated by (screen → op) |
|---|---|---|---|
| `profiles` | auth-user display data | member/invite RPC joins | — (no feature writes) |
| `care_circles` | the care unit (+`owner_id`, `timezone`) | circle-selection, edge | `create_care_circle`, `set_circle_timezone` |
| `care_recipients` | the elder (1:1 w/ circle) | recipient-profile, home, emergency card | recipient-profile → `updateRecipient`; created by `create_care_circle` |
| `circle_members` | membership + role/status | circle-selection, RPCs | membership RPCs only (direct writes revoked) |
| `circle_invitations` | one-time invite codes | invitations list RPC | invitation RPCs only |
| `medications` | meds (+`responsible_user_id`,`is_active`) | med list/detail, edge | med CRUD; `claim_medication_responsibility` |
| `medication_schedules` | recurrence (`days_of_week[]`,`times[]`) | med detail, edge | schedule CRUD |
| `medication_logs` | dose outcomes (given/missed/postponed) | home, med list, edge | `useLogDose` insert/update; notification "تم" |
| `care_tasks` | tasks (assignable, open/completed/cancelled) | task list/detail, edge | task CRUD/complete/cancel; `claim_care_task` |
| `care_appointments` | appointments (absolute `starts_at`) | appt list/detail | appt CRUD; `set_assigned_appointment_outcome`; `claim_care_appointment` |
| `family_visits` | planned/logged visits | visit list/detail | visit CRUD/status; `claim_family_visit` |
| `daily_care_logs` | daily wellbeing (mood/sleep/…/pain) | daily-logs | daily-log CRUD |
| `vital_readings` | vitals (typed values + unit) | vitals | vital CRUD |
| `doctors` | doctor directory | doctors, appt picker, emergency card | doctor CRUD (edit/delete UI unreachable) |
| `emergency_contacts` | emergency numbers (+`is_primary`) | contacts, emergency card | contact CRUD (screen unreachable) |
| `notifications` | in-app inbox + real title/body | notification center | `set_notification_read`, `mark_all_notifications_read`; created only by `enqueue_notification` |
| `notification_outbox` | logical send job | — | service RPCs |
| `notification_push_deliveries` | per-device delivery + receipt | receipts edge | service RPCs |
| `notification_preferences` | per-user/per-circle toggles + quiet hours | settings | `upsert_notification_preferences` |
| `push_tokens` | Expo device tokens | own-device query | `register_push_token`, `deactivate_push_token*` |

### I.2 Relationships
`profiles` owns `care_circles`; each circle 1:1 `care_recipients` and has many `circle_members` / `circle_invitations` / `medications` (→ `medication_schedules` → `medication_logs`) / `care_tasks` / `care_appointments` (→ `doctors`) / `family_visits` / `daily_care_logs` / `vital_readings` / `doctors` / `emergency_contacts` / `notifications` (→ `notification_outbox` → `notification_push_deliveries` → `push_tokens`). Responsibility columns (`assigned_to`, `responsible_user_id`, `visitor_user_id`) are resolved centrally by `notification_item_owner`.

### I.3 Mutation behavior & risk
- **No optimistic updates** — every mutation invalidates query roots on success. Slight latency; safe.
- **Hard deletes (irreversible)**: medication (cascades schedules+logs), schedule, task, appointment, visit, daily log, vital, doctor, emergency contact. API layer does not enforce a confirmation — confirmation lives in UI (present for list/editor deletes via inline 2-step; **Needs runtime QA** that every path has one). Highest blast radius: `deleteMedication`.
- **Member removal/demotion** is server-protected (cannot orphan a circle / last admin / owner) — DB safe even if UI bypassed.
- **Claim** race → `23505` surfaced as "alreadyClaimed"; `createMedicationWithSchedule` is non-transactional with a best-effort compensating delete.
- Claim-flow RPCs are untyped in generated types (localized cast).

---

## J. Accessibility / Arabic / RTL / elder-friendly UX

### Strengths (code-verified)
- **Status is never color-only** — `StatusBadge`/status pills carry a distinct icon per tone; every selected chip/row adds a `✓` glyph + bold.
- **Mojibake-safe glyph system** — decorative glyphs built via `String.fromCodePoint` (pure-ASCII source); vector icons referenced by ASCII semantic name; `LtrText`/`isolateLtr` bidi-isolate phone/email/time/date/numbers via LRI…PDI code points. No emoji in user-facing copy.
- **48dp touch floor** enforced on buttons, chips, picker rows, modal close; `IconButton.accessibilityLabel` is a required prop; decorative icons hidden from screen readers.
- **Errors/status** use `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` consistently.
- **Medical-safety wording** — every health surface carries a "not medical advice/diagnosis" disclaimer; vitals "does not interpret values"; emergency card "not an emergency service"; pain framed as "observed."
- **986/986 locale key parity** — no English fallback leaks.
- **Directional icons + RTL date-wheel column order** centralized; Latin digits forced in dates for numeral consistency.

### Concerns
| # | Concern | Severity |
|---|---|---|
| J1 | **Figma type scale below the older-adult 14pt floor** — tab labels 11px, status pills 11px, list subtitles 12px, section labels 13px, field 15px; directly conflicts with the design system's own elder mandate. | **P1** |
| J2 | **Icon-only actions that dial/mutate with no confirmation** — `tel:` call rows dial immediately (silent fail on non-telephony devices, no feedback); dose status/appointment-visit outcomes fire on a single tap. | P1/P2 |
| J3 | **Opaque format tokens** (`YYYY-MM-DD`, `HH:MM`) shown to elders as placeholders/errors app-wide. | P2 |
| J4 | **Hardcoded Arabic notification strings** bypass i18next (won't localize; most mojibake-exposed literals). | P2 |
| J5 | **`figma.*` terminology drift** — same status/action reads with different Arabic wording on different screens (e.g. مفتوحة vs معلقة for task "open"; فعّال vs نشط for medication active). | P2 |
| J6 | **RTL directional icons are hardcoded pre-mirrored glyphs** in Figma components (correct only because the app is RTL-locked; breaks if LTR is ever enabled). | P2 |
| J7 | **Native RTL takes effect only on next launch** (no reload) — first run on an LTR-system device / Expo Go renders LTR layout (Arabic text still correct). **Needs runtime QA.** | P2 |
| J8 | Numeral inconsistency — Arabic-Indic `٦` in `auth` copy vs forced-Latin digits elsewhere. | P3 |
| J9 | Muted-on-sunken contrast for metadata/placeholders likely near AA-large only. **Needs runtime QA.** | P3 |

---

## K. Web / native parity

| Concern | Native | Web | Risk |
|---|---|---|---|
| Push notifications | full (channel, categories, token) | **unsupported** (in-app center only; screen says so) | expected |
| Date/Time input | wheel `PickerSheet` (12h Arabic time UX, RTL column order) | native `<input type=date/time>` (browser locale, 24h) | divergent UX, same stored value contract |
| Tab bar | custom bottom `FigmaTabBar` | top floating `TabList` pill w/ brand text, no icons | **significantly divergent**; parity unverified |
| Color scheme | RN `useColorScheme` | hydration-guarded `use-color-scheme.web.ts` — **but Figma comps call RN directly and bypass the guard** | possible light/dark flash on web SSR |
| RTL | `I18nManager.forceRTL` (next launch) | `<html dir=rtl lang=ar>` (immediate) | first-launch LTR flash on native only |
| Clipboard/share (invites) | OS Share sheet | `navigator.share` → clipboard fallback | ok |
| Splash / animated icon | Reanimated keyframe, gradient | CSS-module, shorter, no overlay | off-brand scaffold both |
| Confirmations | native `Alert` (nav guard) / in-place swap / sheets | `window.confirm` / in-place swap / sheets | 3 visual forms, no single identity |

Documented web notes from reports: "on the web the in-app notification center works, but device push isn't available." No other web-specific errors documented; broad web parity is **Needs runtime QA** (the web tab bar and Figma-component web hydration are the main unknowns).

---

## L. Known issues / bugs / polish backlog

### P0 — Critical (block MVP)
| # | Title | Evidence | Impact | Suggested fix | Needs |
|---|---|---|---|---|---|
| P0-1 | **Member management unreachable** — change role, reactivate, leave circle, transfer ownership, in-screen invite/manage-invites are built (`members-manager.tsx`, `role-modal.tsx`) but **no route imports them** (CONFIRMED). | grep: `MembersManager`/`RoleModal` self-referenced only; `circle-members/index.tsx` renders `FigmaMembers` | Core social-graph management missing from shipped app; a member can't change a role, recover a removed member, leave, or hand off ownership. | Route `MembersManager` (or graft its actions into `FigmaMembers`); keep the roster's design. | QA (RLS already enforces) |
| P0-2 | **Remove member has no confirmation** — live `FigmaMembers` removes on a single tap (`figma-members.tsx:219`). | `figma-members.tsx:219`; contrast dead `MembersManager` 2-tap confirm | Accidental irreversible removal of a caregiver. | Add inline 2-step confirm (pattern already exists). | none |

### P1 — Before MVP
| # | Title | Evidence | Impact | Fix | Needs |
|---|---|---|---|---|---|
| P1-1 | **Recipient profile & emergency contacts have no in-app entry** — linked only from dead `CareCircleDashboard` (CONFIRMED). | grep: `/recipient-profile` & `/emergency-contacts` only in `circle-dashboard.tsx` | Blood type / allergies / chronic conditions / emergency notes / all emergency contacts can't be entered — yet the Emergency Card displays them; onboarding captures only name+birthdate. | Add entries (Account rows, Home quick-actions, or an emergency-card "Edit" affordance for managers). | QA |
| P1-2 | **Doctors edit/delete unreachable** — live `FigmaDoctors` only adds + calls. | `figma-doctors.tsx`; edit/delete only in unrouted `DoctorsManager` | Managers can't correct or remove a doctor. | Add `ItemActions` (edit/delete) to `DoctorCard`, or route the manager. | QA |
| P1-3 | **Circle-timezone change UI unreachable** — `CircleTimezoneCard` has no importer (CONFIRMED); tz only set best-effort at creation. | grep: `CircleTimezoneCard` definition only | Wrong tz → reminders fire at wrong local time with no in-app fix. | Mount `CircleTimezoneCard` in a reachable settings surface (managers). | QA |
| P1-4 | **Appointments "Completed" tab can't show past appointments** — list query filters `starts_at >= today`. | `figma-appointments.tsx:50`, `appointments/api.ts:35` | Completed history appears missing. | Fetch completed separately (drop the future-only filter for the completed tab). | none |
| P1-5 | **Detail-screen status mutations are instant, no confirm; list uses a confirm sheet** — inconsistent + no undo. | `task-editor.tsx:434`, `appointment-editor.tsx`, `visit-editor.tsx` | Stray tap irreversibly completes/cancels a care item. | Unify on the confirm sheet for detail complete/cancel; consider a short undo. | none |
| P1-6 | **No reopen/undo for completed/cancelled tasks** (appointments/visits can reopen; tasks can't). | tasks lifecycle; `en.json` has no task reopen key | An assignee's mistaken "completed" can't be corrected by them. | Add a manager (or author) reopen path. | QA |
| P1-7 | **Appointment outcome by non-manager assignee has server support but no clear UI** (RLS-allows / client-hides). | `set_assigned_appointment_outcome` vs `appointments-center.tsx:191` | Assignees may have no way to record an appointment outcome in-app. | Surface the outcome action to assignees on the detail screen. | QA |
| P1-8 | **Figma type scale below elder 14pt floor.** | `figma-tokens.ts:98` | Small text for the target older audience. | Raise the Figma min scale to the 14pt floor. | design + QA |
| P1-9 | **`check-missed-doses` deployed but not scheduled** among the 3 active cron jobs. | `2026-07-08-phase-2f-10m...md` | Tier-2 missed-dose family escalation may never fire in prod. | Add the cron job (or confirm it's intentionally off). | cron/product (no DB access here) |
| P1-10 | **Home swallows sub-query errors** — failed doses/appointments/tasks fetch shows an empty dashboard indistinguishable from "nothing today." | `figma-home.tsx:95-115` | Caregiver may believe there are no doses when the load failed. | Surface per-section error/retry. | none |

### P2 — Polish
| # | Title | Evidence |
|---|---|---|
| P2-1 | **Dead legacy components ship** — `MedicationsCenter`, `TasksCenter`, `AppointmentsCenter`, `VisitsCenter`, `NotificationsCenter`, `DoctorsManager`, legacy `EmergencyCard`, legacy fieldsets, `CareCircleDashboard`, `CircleSwitcher`, `NotificationBell`, `CircleTimezoneCard`, `NavCard`, `HintRow`, `Collapsible`, `FigmaToggleRow`, `FigmaField`, splash scaffold (all CONFIRMED unrouted/0-consumer). | greps above |
| P2-2 | **Two token systems** (`Colors` vs `FigmaColors`) + **4 primary-button implementations** maintained in parallel → drift. | `figma-tokens.ts` |
| P2-3 | **Figma icons bypass the semantic `ICONS` registry** (raw lucide imports) → no central RTL mirroring/collision control for migrated screens. | `figma/*` |
| P2-4 | **Dose-log correction impossible from Today list** — actions only render when unlogged; a mis-tapped status is stuck unless server-edited. | `figma-medications.tsx:317` |
| P2-5 | **Silent mutation failures** — dose-log, medication delete, activation toggle, log/vital delete show no error UI on failure. | feature editors |
| P2-6 | **No confirmation on claim / deactivate / activation toggle** (medication reminders stop on one tap). | `figma-available-to-claim.tsx:279`, `medication-editor.tsx` |
| P2-7 | **Assignment inconsistencies** — create offers all active members, edit restricts to DOER_ROLES; `caregiver` can act on own but isn't assignable via edit; no-assignment copy differs (بدون تعيين vs غير محدد). | `task-form.tsx`, `member-assignment.ts` |
| P2-8 | **No unsaved-changes guard on notification settings**; also none on auth forms; **no password-reset flow anywhere**. | `notification-settings.tsx`, `(auth)/*` |
| P2-9 | **`remote_member` can read all operational data server-side** while presented as followers (migration flags this as the tighten-later switch). | `backfill_2d:24-34` |
| P2-10 | **`figma.*` label drift** + hardcoded Arabic notification strings bypass i18next. | `en.json` `figma.*`, `notifications/*.ts` |
| P2-11 | **Vitals list has no explicit loading state**; **daily-log vs vital view-mode disclaimer inconsistency**; **CTA pinned-footer workaround** (Save is last scroll child on Android). | `figma-vitals.tsx`, editors, `figma-form-screen.tsx` |
| P2-12 | **`is_primary` emergency contact not single-primary-enforced client-side.** | `contacts-manager.tsx` |
| P2-13 | **Figma comps bypass web hydration guard** (`useColorScheme` directly). | `figma/figma-card.tsx:35` |
| P2-14 | **Confirmations have 3 visual forms** (Alert/confirm, in-place swap, sheets) with no unified identity; **modal dismissal rules differ** (FormModal no-backdrop vs FigmaBottomSheet backdrop-closes). | components |

### P3 — Later
| # | Title | Evidence |
|---|---|---|
| P3-1 | Version string hardcoded `'1.0.0'` in Account (not from app config). | `account.tsx:156` |
| P3-2 | `cancelTask` records `cancelled_at` but no `cancelled_by` (completion records `completed_by`). | `tasks/api.ts` |
| P3-3 | `medications.photo_url` / `medication_logs.note` columns exist but never surfaced. | `supabase.ts` |
| P3-4 | Orphan/dead locale keys (`tasks.fields.assignToMe`, `appointments.saveAppointment`, `visits.saveVisit`, `visits.fields.linkToMe`). | locales |
| P3-5 | No SMS/`sms:` or share affordance for contacts/doctors (call only); `tel:` fails silently on tablets. | contact/doctor screens |
| P3-6 | Pain stepper −/+ a11y labels non-localized; `Collapsible` uses physical `marginLeft` (RTL bug). | `figma-daily-log-fields.tsx`, `ui/collapsible.tsx` |
| P3-7 | Coarse cache strategy (invalidate-all, no optimistic UI) — visible latency on complete/claim. | feature hooks |
| P3-8 | Local-time assumption for "today's doses" ignores circle timezone (documented). | `medications/today.ts`, `date.ts` |

---

## M. Suggested next phases

**Phase 1 — MVP reachability fix (highest priority; wiring/UX on already-built, RLS-protected features).**
- Route member management or graft change-role / reactivate / leave / transfer-ownership into `FigmaMembers`; add a remove-member confirmation (P0-1, P0-2).
- Add in-app entry to `/recipient-profile` and `/emergency-contacts`, and mount `CircleTimezoneCard` in a reachable managers-only surface (P1-1, P1-3).
- Surface doctor edit/delete on `FigmaDoctors` (P1-2).
- Surface appointment-outcome to assignees (P1-7).
- Verify each fix against RLS on device (Needs QA).

**Phase 2 — MVP safety & correctness polish.**
- Unify detail complete/cancel behind the confirm sheet; add task reopen/undo (P1-5, P1-6).
- Fix the appointments "Completed" tab query (P1-4).
- Surface per-section error/retry on Home (P1-10) and error feedback on silent mutation failures (P2-5).
- Raise the Figma type scale to the 14pt elder floor (P1-8).

**Phase 3 — Role QA pass.** Execute the §F.3 checklist on device with real accounts for each active role (admin, primary_caregiver, family_member, remote_member): verify every client gate matches RLS (dose logging, appointment outcome, remote read posture, vitals/logs authorship, claim eligibility). Special attention to Q1 (remote read) and Q2 (assignee appointment outcome).

**Phase 4 — Notification QA pass.** Device matrix (Samsung + one other Android) × foreground/background/killed × Doze/battery-opt: confirm detailed remote text + tap-to-open + in-app complete/snooze; confirm local/foreground action buttons; confirm quiet-hours and per-scope preferences; resolve whether `check-missed-doses` should be scheduled (P1-9). Add an unsaved-changes guard to settings (P2-8).

**Phase 5 — Release-readiness / cleanup / EAS.** Delete or wire the dead-code set (P2-1); consolidate the two token systems and button implementations (P2-2); move hardcoded Arabic notification strings + `figma.*` drift into canonical i18n keys (P2-10); pull the version string from app config (P3-1); build/verify web tab-bar parity and hydration (K); run `expo-doctor` and an EAS build; confirm APNs/FCM credentials.

**Phase 6 — Future (only if justified).** 2F-11D data-only/background-task push **only** behind a QA flag with the Samsung reliability gate; product-review roadmap (activity feed / medication-loop closure, missed-dose family nudge, visits→schedule merge, data export, per-recipient locale, user theme toggle, password reset).

---

## N. Evidence appendix

### N.1 Method
14 parallel read-only inspection agents (workflow `wf_c387378d-bdb`, 0 errors, ~1.57M subagent tokens, 571 tool calls) each mapped one vertical; the main author independently read `en.json`, `push-registration.ts`, the architectural spine, and ran verification greps for every load-bearing P0/P1 claim. Every claim is cited `path:line`; uncertainty tagged Needs runtime QA / Inferred; verified claims marked CONFIRMED.

### N.2 Source files read (representative — not exhaustive)
- **Shell/providers:** `src/app/_layout.tsx`, `src/app/(app)/_layout.tsx`, `(app)/(tabs)/_layout.tsx`, `(auth)/_layout.tsx`, `src/providers/{index,auth-provider,query-provider}.tsx`, `lib/supabase.ts`, `src/i18n/{index,rtl,rtl.web}.ts`, `app.json`, `package.json`, `eas.json` (listing).
- **Screens:** all 44 route files under `src/app/**`.
- **Features:** all of `src/features/{auth(via app),care-circle,circle-selection,circle-members,invitations,claiming,care-activity,medications,tasks,appointments,visits,daily-logs,vitals,doctors,emergency,recipient-profile,notifications}/**`.
- **Components/design system:** all of `src/components/**` incl. `figma/**`, `ui/**`; `src/constants/{theme,icons,glyphs,timezones}.ts`; `src/hooks/**`; `src/utils/{confirm,form,date}.ts`.
- **Localization:** `src/locales/{ar,en}.json` (986 keys each, verified parity).
- **Data/back-end (read-only, no execution):** `src/types/supabase.ts`; `supabase/functions/**` (4 edge functions + `_shared/*`); `supabase/migrations/**` (schema, RLS, RPCs); `supabase/config.toml`.
- **Scripts:** `scripts/check-mojibake.js`.

### N.3 Docs read
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/product/sanad-product-and-design-review.md`, `docs/deployment/notifications-and-reminders.md`, `docs/figma/*` (skim).
- `docs/claude-reports/*` phase history, with deep reads of the notification arc: `2026-06-11-step-6-0-...`, the 2026-06-26 → 07-08 `phase-2f-*` series (readiness → responsibility SQL → edge deploy → smoke tests → active cron 2F-10M), `2026-07-09-phase-2f-11a/11b-*`, `2026-07-11/13-phase-2f-11c-*`, and `2026-07-13-phase-2f-11c-closeout-and-2f-11d-decision.md`; plus assignment `2026-06-19-product-phase-2a/2b`, RLS `phase-2d`, claim `phase-2e`, members `2026-06-10-step-5-0`.

### N.4 Verification greps run (this pass)
- `MembersManager|RoleModal|CareCircleDashboard|CircleTimezoneCard|DoctorsManager|circle-switcher|NotificationBell` → confirmed all unrouted / self-referenced only.
- `/recipient-profile|/emergency-contacts` across `src` → only in `circle-dashboard.tsx` (dead) → confirmed no live nav entry.
- `import { CareCircleDashboard|CircleSwitcher|NotificationBell|CircleTimezoneCard }` → confirmed `CareCircleDashboard` has no importer; `CircleTimezoneCard` referenced only at its definition.
- `*Center` components → confirmed dead (self/comment references only).
- Baseline: `git rev-parse HEAD` = `ced8554`; `git status --short` clean at start.

### N.5 Final checks (see run log appended by the session)
`npm run check:mojibake` (scans `src/lib/scripts/app/components/features` + root config only — **does not scan `docs/`**, so this report is out of its scope by design), `git -c core.autocrlf=false diff --check`, `npx tsc --noEmit`, `git --no-pager status --short`, `git --no-pager diff --stat`.

### N.6 Constraints honored
No Supabase command, SQL, deploy, cron change, or network call was run. `.env` values were not opened. No secrets, raw Expo push tokens, `SUPABASE_ACCESS_TOKEN`, or `cron.job.command` bodies were printed. No source code was changed; nothing was staged or committed.

### N.7 Limitations of code-only inspection
Cron active-state, applied-SQL, and deploy claims are taken **from the phase reports as written** (not verified against the live DB). All RLS "who can" rows are the **client mirror** of server rules per code comments, not server-executed. RTL first-launch behavior, contrast ratios, double-submit, web tab-bar parity, and every "instant mutation" safety concern require **device runtime QA**. Dead-code determinations are grep-based on the current tree (file-based routing means a new importer would change them).

---

*End of report.*
