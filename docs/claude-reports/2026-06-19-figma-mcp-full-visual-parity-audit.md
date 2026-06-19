# Sanad — Full Figma MCP Visual Parity Audit

**Date:** 2026-06-19
**Mode:** Audit only — no files modified, nothing staged, nothing committed.
**Method:** Figma MCP (live read of the connected Figma Make file) + repository inspection, cross-checked by a 55-agent deterministic compare→verify workflow (26 screen-pairs, each compared then adversarially re-verified, plus 3 cross-cutting sweeps).
**Health at audit time:** `tsc --noEmit` exit 0 · `npm run check:mojibake` clean (260 files) · `git -c core.autocrlf=false diff --check` exit 0.

> **How to read this report.** The Sanad "Figma design" is a **Figma Make** project — i.e. an actual React/Vite/Tailwind codebase, not a frame-based Figma file. Its screens are inline-styled `.tsx` files; their inline styles *are* the design spec. The app has already been ported toward this design in a dedicated `src/components/figma/*` + `src/features/*/figma-*.tsx` layer. This audit measures how faithfully each app route matches its Figma Make screen, applying the required Sanad token overrides (blue→teal, keep Cairo, keep warm theme).

---

## 1. Figma source inspected

| Field | Value |
|---|---|
| **Pasted link** | `https://www.figma.com/make/MpgXzFWQpGYbO7x4S7HCgd/Mobile-app-design-upload--Copy-?t=BWRP7F3pqWd0Rbi3-6` |
| **Link type** | Full **Figma Make** file link (`/make/<fileKey>/…`). Not a `/design/`, page, frame, or node-selection link. |
| **fileKey** | `MpgXzFWQpGYbO7x4S7HCgd` |
| **MCP read?** | **Yes — successfully.** Authenticated as `ibrahim khalifa` (pro). |
| **Authenticated user** | `ibrahim.khalifeh91@gmail.com` (via `whoami`). |

### What works and what does not for a Make link
Figma Make files are **not** readable by the frame-oriented MCP tools:

- `get_metadata` → **unsupported** for `/make/` URLs.
- `get_screenshot` → **unsupported** for `/make/` URLs.
- `get_variable_defs` → **unsupported** for `/make/` URLs.
- `get_design_context` (with `nodeId 0:1`) → **supported**. It returns the **source-file manifest** of the Make project as MCP resource links, which are then read individually with `ReadMcpResourceTool` (server `plugin:figma:figma`, uri `file://figma/make/source/MpgXzFWQpGYbO7x4S7HCgd/...`).

This means the audit is **richer than a screenshot diff**: we read the design's exact inline styles (px, radius, font size, gaps, colors, layout order), so every mismatch below cites concrete numbers rather than eyeballed pixels.

### Exact Figma file/page/node/frame names found
There are no Figma "pages/frames" — the manifest is a source tree. The screen-level "frames" are the component files under `src/app/components/`:

```
App.tsx (router/shell)   BottomNav.tsx
HomeScreen  ExploreScreen  AccountScreen
MedicationsScreen  TasksScreen  AppointmentsScreen  VisitsScreen  VitalsScreen
DoctorsScreen  MembersScreen  DailyLogsScreen  NotificationsScreen  EmergencyScreen
AddMedicationScreen  AddTaskScreen  AddAppointmentScreen  AddVisitScreen  AddDailyLogScreen  AddVitalScreen
AuthScreens (SignIn+SignUp)  SplashScreen  CreateCircleScreen  JoinCircleScreen
InviteMemberScreen  RecipientProfileScreen  NotificationSettingsScreen
components/ui/* (≈45 shadcn primitives: button, card, sheet, dialog, drawer, select, switch, input, badge, …)
styles/theme.css · styles/index.css · styles/fonts.css   (no globals.css — 404)
imports/pasted_text/sanad-app-design-direction.md · sanad-app-design-system.txt   (the two design briefs)
guidelines/Guidelines.md (empty template)   6× *.png image assets
```

### Access / scope issues
- No access problems. One file referenced in the design's own CSS chain, `src/styles/globals.css`, **404s** (`File not found`) — harmless; `theme.css` carries the tokens.
- The `components/ui/*` shadcn files are **default Make scaffolding** and are mostly *not* what the screens render — every screen styles itself inline. Where the shadcn boilerplate and the real screen inline styles disagree, **the screen inline styles win** (noted throughout §9 shared-primitives).

### Critical finding — the two briefs vs. the built design
Two prompt docs are embedded:
- `sanad-app-design-system.txt` (**strict**): demands **IBM Plex Sans Arabic** + **brand blue** `#2F6FD0` (dark) / `#1B5FBE` (light) + sand accent; S24-Ultra 412×917 dp; full token list. It is also marked **APPEND-ONLY** ("keep existing screens, only add new ones").
- `sanad-app-design-direction.md` (**open**): "invent the direction, free palette/type."

The **actually-built** Make output (`theme.css`, `App.tsx`, and the first-pass screens) **already resolved both Sanad overrides**: primary is **teal** `#2E8A7B` / `#4BA898` (not blue) and the font is **Cairo** (not IBM Plex). Therefore the realized design target is *already* teal+Cairo+warm. The brief's blue/IBM-Plex survive only inside the **appended** Add*/auth/onboarding screens' hard-coded local palettes (`T.primary = '#2F6FD0'`, font `"'IBM Plex Sans Arabic','Cairo'"`). Those are exactly the screens to which the override applies, and the app's figma-layer already converts them. This is the spine of the whole audit.

---

## 2. Figma screens/frames found → app mapping

`✅` = app route maps; component named is what the route **actually mounts** (verified, not assumed).

### A. First-pass "approved" center/list screens (Make uses `var(--sanad-primary)` = teal)
| Figma frame | Purpose | App route | App component mounted |
|---|---|---|---|
| `HomeScreen` | Today-first care dashboard (care-ring hero, doses, quick actions, emergency) | `(app)/(tabs)/index.tsx` | `FigmaHome` (`features/care-circle/figma-home.tsx`) ✅ |
| `ExploreScreen` | Feature directory (list rows by section) | `(app)/(tabs)/explore.tsx` | `ExploreScreen` (inline) ✅ |
| `AccountScreen` | Identity, circle section, links, sign-out | `(app)/(tabs)/account.tsx` | `AccountScreen` (figma primitives) ✅ |
| `MedicationsScreen` | Doses today / all meds, inline logging | `(app)/medications/index.tsx` | `FigmaMedications` ✅ |
| `TasksScreen` | today/open/done tabs, task rows | `(app)/tasks/index.tsx` | `FigmaTasks` ✅ |
| `AppointmentsScreen` | today/upcoming, "when" chip | `(app)/appointments/index.tsx` | `FigmaAppointments` ✅ |
| `VisitsScreen` | family visits list | `(app)/visits/index.tsx` | `FigmaVisits` ✅ |
| `VitalsScreen` | value+unit+timestamp grid | `(app)/vitals/index.tsx` | `FigmaVitals` ✅ |
| `DoctorsScreen` | doctor cards + call rows | `(app)/doctors.tsx` | `FigmaDoctors` ✅ |
| `MembersScreen` | roster, roles, change-role | `(app)/circle-members/index.tsx` | `FigmaMembers` ✅ |
| `DailyLogsScreen` | observational day cards | `(app)/daily-logs/index.tsx` | `FigmaDailyLogs` ✅ |
| `NotificationsScreen` | inbox, unread, mark-all | `(app)/notifications.tsx` | `FigmaNotifications` ✅ |
| `EmergencyScreen` | reference-only emergency card | `(app)/emergency-card.tsx` | `FigmaEmergencyCard` ✅ |
| `BottomNav` | 3-tab bar | `components/app-tabs.tsx` | `FigmaTabBar` ✅ (EXACT) |

### B. Second-pass "appended" Add/edit forms (Make hard-codes blue `#2F6FD0` + IBM Plex)
| Figma frame | App add route → component | App edit/detail route → component |
|---|---|---|
| `AddMedicationScreen` | `medications/new.tsx` → `MedicationForm` ✅ (figma) | `medications/[id].tsx` → `MedicationEditor` ⚠️ legacy |
| `AddTaskScreen` | `tasks/new.tsx` → `TaskForm` ✅ (figma) | `tasks/[id].tsx` → `TaskEditor` ⚠️ legacy |
| `AddAppointmentScreen` | `appointments/new.tsx` → `AppointmentForm` ✅ | `appointments/[id].tsx` → `AppointmentEditor` ⚠️ legacy |
| `AddVisitScreen` | `visits/new.tsx` → `VisitForm` ✅ | `visits/[id].tsx` → `VisitEditor` ⚠️ legacy |
| `AddDailyLogScreen` | `daily-logs/new.tsx` → `DailyLogForm` ✅ | `daily-logs/[id].tsx` → `DailyLogEditor` ✅ (figma) |
| `AddVitalScreen` | `vitals/new.tsx` → `VitalForm` ✅ | `vitals/[id].tsx` → `VitalEditor` ✅ (figma) |

### C. Appended shell / auth / settings / member / profile
| Figma frame | App route | App component | Note |
|---|---|---|---|
| `SplashScreen` | root `_layout.tsx` overlay | `AnimatedSplashOverlay` (`components/animated-icon.tsx`) | ⚠️ solid blue, no branding |
| `AuthScreens` (SignIn/SignUp) | `(auth)/sign-in.tsx`, `sign-up.tsx` | legacy screens | ⚠️ pre-Figma |
| `CreateCircleScreen` | `(app)/(tabs)/index.tsx` (no-circle) | `CareCircleOnboarding` (`features/care-circle/onboarding-form.tsx`) | ⚠️ legacy shell (IBM Plex) |
| `JoinCircleScreen` | `(app)/join-circle.tsx` | `JoinCircleForm` (`features/invitations/join-form.tsx`) | ⚠️ pre-Figma |
| `InviteMemberScreen` | `(app)/circle-members/invite.tsx` | `InviteForm` ✅ (figma) | invitations list (`invitations.tsx`) ⚠️ legacy |
| `RecipientProfileScreen` | `(app)/recipient-profile.tsx` | `RecipientProfileForm` (`profile-form.tsx`) | ⚠️ legacy flat form |
| `NotificationSettingsScreen` | `(app)/notification-settings.tsx` | `NotificationSettings` | ✅ richer than design; CLOSE |

**Design frames with no app counterpart (MISSING in app):** none material. The design's email-confirmation/verification state and a standalone circle-switcher modal are folded into existing app screens.
**App routes with no Figma frame (PRESENT in app, missing in Figma):** emergency-contacts management screen, invitations list, the separate "doctors" section on the emergency card, the notification-settings scope selector, and several app-added safety disclaimers / "mine" attributions. These are intentional Sanad enrichments — keep.

---

## 3. App routes / components inspected

**Routes (`src/app`)** — all `(app)` tab + stack routes, `(auth)` stack, root + group `_layout.tsx`.
**Center/list feature components** — `figma-home`, `figma-medications`, `figma-tasks`, `figma-appointments`, `figma-visits`, `figma-vitals`, `figma-doctors`, `figma-members`, `figma-daily-logs`, `figma-notifications`, `figma-emergency-card` (+ legacy `*-center.tsx`/`*-manager.tsx` confirmed **dead/unmounted**).
**Form components** — `*-form.tsx` (figma add path) and `*-editor.tsx` (edit path), `figma-schedule-fields`, `figma-appointment-fields`/`figma-visit-fields`/`figma-daily-log-fields` (new, untracked), `figma-vital-fields`, `schedule-modal-host`, `onboarding-form`, `join-form`, `invite-form`, `profile-form`, `notification-settings`, `push-status-card`.
**Shared Figma components** — `figma-form-screen` (+ `FigmaFormCard`/`FigmaFormField`/`FigmaSwitch`/`FigmaChipSelect`/`FigmaCardSelect`), `figma-footer-primary-button` (untracked), `figma-button`, `form-button`, `figma-list-row`, `icon-chip`, `figma-card`, `figma-status-pill`, `figma-segmented-tabs`, `figma-tab-bar`, `figma-bottom-sheet`, `figma-field`, `figma-header`, `care-loop-ring`, `figma-tokens.ts`.
**Shared form/picker/button** — `button.tsx` (legacy), `form-actions.tsx`, `form-modal.tsx`, `picker-sheet.tsx` (+`WheelColumn`), `option-select`, `weekday-selector`, `date-field`/`time-field`/`date-time-field`, `status-badge`.
**Tokens** — `src/constants/theme.ts` (app source of truth), `src/components/figma/figma-tokens.ts` (figma exact-copy layer).

---

## 4. Coverage matrix

Verified classification per screen/flow. `M` = confirmed visual-only mismatches after adversarial verification.

| Screen / flow | Classification | M | Top risk |
|---|---|---|---|
| Home | **CLOSE** | 2 | low |
| Explore | **CLOSE** | 4 | low |
| Account | **CLOSE** | 6 | medium (sign-out form) |
| Medications center | **CLOSE** | 7 | medium (kebab affordance) |
| Tasks center | **CLOSE** | 3 | low |
| Appointments center | **CLOSE** | 5 | low |
| Visits center | **CLOSE** | 12 | medium (section structure, missing footer CTA) |
| Vitals center | **CLOSE** | 5 | low |
| Doctors center | **CLOSE** | 2 | low |
| Members center | **CLOSE** | 5 | low |
| Daily Logs center | **CLOSE** | 3 | low |
| Notifications center | **CLOSE** | 4 | medium (timestamp format) |
| Emergency card (+contacts mgmt) | **CLOSE** | 8 | medium (notes block, full-bleed hero); contacts-mgmt route = **OLD_UI_LEAK** |
| Medication add | **CLOSE** | edit `[id]` = **OLD_UI_LEAK** | 8 | high (legacy editor + legacy schedule modal) |
| Task add | **CLOSE** | edit `[id]` = **OLD_UI_LEAK** | 8 | medium |
| Appointment add | **CLOSE** | edit `[id]` = **OLD_UI_LEAK** | 10 | medium |
| Visit add | **CLOSE** | edit `[id]` = **OLD_UI_LEAK** | 7 | medium |
| Daily-log add | **CLOSE** (edit ported ✅) | 6 | low |
| Vital add | **CLOSE** (edit ported ✅) | 9 | low |
| Splash | **OLD_UI_LEAK** | 5 | high (no branding; blue) |
| Auth (sign-in/up) | **OLD_UI_LEAK** | 8 | medium |
| Create-circle onboarding | **CLOSE** per agents → **re-graded legacy non-Figma shell** | 11 | medium (IBM-Plex + flat layout) |
| Join-circle | **OLD_UI_LEAK** | 6 | medium |
| Invite member | **CLOSE** (invitations list = PRESENT_IN_APP_MISSING_IN_FIGMA) | 10 | low |
| Recipient profile | **OLD_UI_LEAK** | 7 | high (no card grouping, no edit/view toggle) |
| Notification settings | **CLOSE** (richer than design) | 8 | low |

**Tally (agent verdicts):** 22 CLOSE · 4 OLD_UI_LEAK (splash, auth, join-circle, recipient-profile).
**Synthesis adjustment:** create-circle, though graded CLOSE, is a **legacy non-Figma shell** (uses legacy IBM-Plex `FontFamily`, no card grouping) — treat it with the OLD_UI_LEAK cluster. Additionally, **edit/`[id]` sub-paths** for medication/task/appointment/visit are legacy leaks behind a Figma add path, and the **emergency-contacts management** route and **invitations list** are un-ported legacy screens.
**No screen classified MISSING_IN_APP.** **No EXACT** (the BottomNav→FigmaTabBar primitive is the single EXACT match at component level).

---

## 5. Mismatch details

All findings below are **visual-only and touch no product logic** unless explicitly marked `LOGIC`. None weakens medical-safety copy, none alters validation/permissions/routes/schemas. Risk is the visual-regression/UX risk of the *fix*.

### 5.0 High-leverage shared-primitive deltas (fix once → corrects many screens)
These recur across the whole app; fixing the shared file resolves the per-screen instances.

| # | Shared file | Delta (app → design) | Visual-only | Risk | Direction |
|---|---|---|---|---|---|
| S1 | `figma/icon-chip.tsx` | default `tintOpacity` **0.14 → ~0.082** (design tint = hex `15` = 21/255) | yes | low | Chips across Explore/Appointments/Doctors/Members/Medications are over-saturated. Lower the default. |
| S2 | `figma/figma-form-screen.tsx` | back-btn radius **12→10**; back-btn & card border **hairline→1px**; header gap **16→12**; header padding-bottom **16→12**; footer padding-top **16→12**; input radius **12→10** | yes | low | One edit fixes geometry on **every** add form (medication/task/appointment/visit/log/vital/invite). |
| S3 | `figma/figma-footer-primary-button.tsx` | CTA radius **16→12** (adopt); CTA height **56 vs design 52** (**KEEP 56** — Sanad primary ≥56dp rule) | yes | low | Adopt radius 12; keep 56dp height as a documented accessibility deviation (see §6). |
| S4 | `figma/figma-status-pill.tsx` | label weight **500→600**; check icon **12→11** | yes | low | Affects all status pills. |
| S5 | `figma/figma-segmented-tabs.tsx` | inactive label weight **500→600**; size **14→13**; minHeight **44→48** (Sanad floor) | yes | low | Affects Tasks/Medications tab strips. Keep ≥48dp. |
| S6 | `figma/figma-list-row.tsx` | needs a **size prop** — Explore wants 48×48/iconSize 24, Account wants 40×40/r12, current fixed 44×44/r16; title size **16→15** | yes | low | A single value can't satisfy both; parameterize chip size/radius per usage. |
| S7 | `figma/figma-card.tsx` usages | card radius **r20/r24 → r16** where design = `rounded-2xl` (16): Medications, Visits, Vitals cards, Members legend, Emergency contact rows (hero/add-sheet correctly 24) | yes | low | Set radius prop per-context to r16. |
| S8 | `figma/figma-bottom-sheet.tsx` | grab handle **48×4 → ~100×8** | yes | low | Match BottomNav/design drawer handle. |
| S9 | `figma/figma-field.tsx` | no teal focus-ring on focus | yes | low | Add border-color→teal on focus (RN has no CSS ring). |

### 5.1 Centers / lists (selected concrete items; full list available in the workflow output)
- **Home** (`figma-home.tsx`): (a) quick-actions grid is **8 tiles / 2 rows** vs design's **4 / 1 row** — *product decision* (trim to 4 or document the expansion); (b) dose-status icon `size=16` inside the 36px chip vs design `12`.
- **Explore**: list-row chip 44/iconSize22 → 48/24 (S6); tint opacity (S1); tasks row uses `Check` → design `CheckSquare`.
- **Account**: sign-out is a **filled red `FigmaButton`** vs design's **row-in-bordered-card** treatment (medium, visual-only); notifications row grouped under "دائرة الرعاية" instead of a separate "الإعدادات" section; profile header wrapped in a rounded `FigmaCard` vs design's flat top bar with bottom hairline; profile email `16` → `13`; list-row title `16` → `15` (S6).
- **Medications**: today-tab list gap `12→8`; summary pill padding `14` → `16/12`; dose action-strip margin-top `6→4`; log-btn padding-h `14→12`; **all-tab rows missing trailing `MoreHorizontal` affordance** (medium); dose card padding-v `14→16`; systematic card radius `r20→16` (S7).
- **Tasks**: segmented-tab weight/size (S5); meta row shows a teal assignee label + dot **even for unassigned** tasks (design only renders them when assignee is set) — visual-only.
- **Appointments**: tint (S1); status-pill weight/icon (S4); meta block missing `pr-1` 4px start indent; calendar chip missing `mt-0.5` 2px nudge.
- **Visits** (most divergent center, 12): app uses a **two-tab segmented control** vs design's **three stacked labeled sections** (incl. gold "زيارات اليوم" header); cards carry an icon chip + visitor-type subtitle the design omits; **design has a sticky "تسجيل زيارة جديدة" footer CTA the app lacks**; missing notes block; linked-account shown as plain row vs accent chip; card radius `r24→16`; planned status pill absent; empty-state lacks the 64×64 icon container.
- **Vitals**: card radius `r24→16`; heart-rate chip color purple → design red `#C45050` + `Activity` glyph (design uses Activity for heart-rate and weight); app adds a "mine" timestamp suffix not in design (keep — product).
- **Doctors**: stethoscope chip `48→52`; tint (S1).
- **Members**: row padding-v `14→16`; legend card radius `r24→16`; avatar tint (S1); remove button `36→44dp` (accessibility); section spacing 16 vs design's 24 between list and legend. `LOGIC` note: invite is a separate full screen vs design's inline sheet (product decision).
- **Daily Logs**: notes well has an extra label row + body in foreground color vs design's single muted span; field-label width `84→80`.
- **Notifications**: row padding-v `14→16`; **timestamp** shows type-label + absolute ISO vs design's **relative human string** ("منذ 10 دقائق") (medium, visual-only formatting); unread banner border hairline→1px; header-to-banner gap `8→16`.
- **Emergency card** (safety-critical — all fixes preserve reference-only framing): extract emergency-notes into a standalone red-tinted block between medical card and contacts; hero should be **full-bleed (no radius)** with the back button inside the red header row; combine name+age into one muted line; disclaimer icon `AlertCircle`→`AlertTriangle`; contact-row radius `20→16`. `LOGIC`/product: the app's **separate doctors section** has no design counterpart (design merges doctors into contacts) — keep or merge is a product call. The **`/emergency-contacts` management route is a full OLD_UI_LEAK** (no Figma styling).

### 5.2 Add / edit / detail forms
- **Add paths** (all CLOSE, figma shell correct): the deltas are entirely the shared S2/S3 geometry tokens, plus per-form items: AddTask priority chips should be **fixed-width r10/h40 rectangles** not stadium pills; AddVital chip leading-check glyph vs design's fill-only selection; AddDailyLog pain-scale chips `26/r8 → 24/r6`; AddAppointment doctor field is a **chip group** vs design `<select>` (product — chips are an accessibility improvement, acceptable).
- **Edit/`[id]` paths** (`OLD_UI_LEAK` behind a good add path): `MedicationEditor`, `TaskEditor`, `AppointmentEditor`, `VisitEditor` still use the **legacy `Screen` shell** (system nav header, in-scroll `FormActions`, flat fields, no `FigmaFormScreen`, no gold banner, no card grouping). Medication's **schedule add/edit modal** still uses legacy `ScheduleFields` (no Figma day-chips/time-rows). Daily-log and vital edit are **already ported** (good reference pattern). `high` risk only in the sense of visible inconsistency between add and edit of the same entity.

### 5.3 Shell / auth / settings (the OLD_UI_LEAK cluster)
- **Splash** (`high`): `AnimatedSplashOverlay` is a single solid `#208AEF` **blue** `Animated.View` with **no content**. Design = warm near-black `#151412` bg + 96×96 teal brand circle with care-ring SVG + "سند" 42px wordmark + tagline + 3-dot loader. Also update `app.json` splash `backgroundColor` away from blue.
- **Auth**: flat pre-Figma form; design wraps fields+CTA in a raised bordered card (r20, p24/20), adds a 56×56 teal icon circle above the sign-in title, password show/hide (`Eye/EyeOff`) toggle, CTA height 56/fontSize 17. (Sign-up has no icon circle in design.)
- **Create-circle**: legacy `CareCircleOnboarding` — **still IBM Plex** (not Cairo), no brand mark, no amber info banner, no card grouping, inputs r8/border1 vs r12/1.5, single shared error vs per-field, CTA 52/16 vs 56/17, secondary should be outlined `secondary` not `plain`.
- **Join-circle** (`OLD_UI_LEAK`): missing custom in-screen header; warning banner placed **after** the code field vs **before**; code input missing its card wrapper + monospace/20px/letter-spacing/centered styling; success state missing the 80×80 check badge.
- **Recipient profile** (`high`): flat ungrouped field list; design = avatar/name card (r20, 56×56 chip) + grouped Personal/Medical cards with section labels + hairline dividers + a header edit/view toggle (read-only display mode) + gated save. `LOGIC`: the edit/view toggle is a behavior change — treat the read-only-display-mode as a product decision; the card grouping is pure visual.
- **Invite member** (CLOSE): warning banner should be amber (warning tone) + rounded floating card not full-bleed; code card should be 2px teal border/r20 with code directly inside (drop inner box); copy+share **side-by-side** row; code letter-spacing `2→4`. Invitations **list** screen is legacy (no Figma counterpart).
- **Notification settings** (CLOSE, richer than design): optional polish — semantic-tinted push card with Bell/BellOff; three named toggle-group cards vs one flat surface; quiet-hours note in a sunken pill with clock icon **and gated to enabled state** (currently always rendered); timezone card horizontal; save success color-morph. All optional; the app's extra scope selector + honest push states are **kept** (better than design).

---

## 6. Special investigation — bottom primary CTA

**Background:** the recurring failure was bottom CTA labels ("إضافة مهمة", "إضافة موعد") rendering as **faint text instead of a filled teal rectangle**. The fix introduced a forced component.

**The forced component:** `src/components/figma/figma-footer-primary-button.tsx` → `FigmaFooterPrimaryButton`. It is a full-width, ~56dp, filled-teal `Pressable` (radius 16, `overflow:hidden` to clip fill to corners), Cairo-bold label in `theme.onPrimary`, with **no `disabled`/`variant`/`style` props** — so no caller can collapse it to faint text (the exact previous failure mode). Its only state is `loading`. Colors come from `useTheme()`.

**Is it actually in the app path?** **Yes.** It is wired into **all 17** add/edit/save flows, either:
- **Directly** as the `footer` of `FigmaFormScreen`: medication/task/appointment/visit/log/vital `new`, invite, and the ported vital/daily-log edit screens; or
- **Indirectly** via `FormActions`/`StickyFormActions` (`form-actions.tsx`) and `FormModal` (`form-modal.tsx`): the legacy medication/task/appointment/visit **editors**, recipient-profile, the doctors & emergency-contacts form modals, and the medication schedule modal.

`tsc --noEmit` passes, confirming the (untracked) component and its imports resolve — no broken-import path behind the old "faint" symptom.

**Routes that still BYPASS the forced CTA** (use the legacy `Button` primary instead):
1. `/sign-in` (`(auth)/sign-in.tsx`)
2. `/sign-up` (`(auth)/sign-up.tsx`)
3. `/join-circle` (`features/invitations/join-form.tsx`)
4. Home first-run onboarding / create-circle (`features/care-circle/onboarding-form.tsx`)

These **do not reproduce the faint bug** — the legacy `Button`'s `fadedDisabled` guard excludes the `primary` variant, so a primary stays a filled teal rectangle even while `disabled`. But they diverge: radius **12 vs 16**, height **52 vs 56**, and they set `accessibilityState.disabled=true` while submitting (screen readers announce "disabled" though it looks active). Recommendation: route these four through `FigmaFooterPrimaryButton` as their screens get ported (Phase VPA-4).

**Can any footer hide/clip/cover it?** No structural clipping found:
- `FigmaFooterPrimaryButton`'s own `overflow:'hidden'` clips the *fill to its rounded corners* — the button is the clip root, not a parent — **not** a hide risk.
- **No** parent with `height:0`, `opacity:0`, `position:absolute`, or `overflow:hidden` wraps the CTA in any audited form/editor.
- **One UX note (not the faint bug):** in `FormModal`, the CTA is rendered **inside** the `ScrollView` (it scrolls with form content) rather than pinned at the sheet bottom; with `maxHeight:'92%'` on a short viewport the user may need to scroll to reach it. Consider moving it outside the scroll as a pinned footer.

**CTA-height tension (decision needed):** the design footer button is **52px**; the app forces **56px**. Sanad's own accessibility rule (and the strict brief) require **primary actions ≥56dp**. Recommendation: **keep 56dp** (document it as a deliberate accessibility deviation from the Make spec) and only adopt the radius `16→12` change for parity.

---

## 7. Special investigation — Figma blue → Sanad teal/green

**Where the design uses blue:** every **appended** screen (`Add*Screen`, `AuthScreens`, `CreateCircleScreen`, `JoinCircleScreen`, `InviteMemberScreen`, `RecipientProfileScreen`, `NotificationSettingsScreen`, `SplashScreen`) defines a local palette with `T.primary = '#2F6FD0'` (blue), `T.primaryBg = '#1D2B42'` (navy), `T.primaryText = '#96BEF5'`. Blue is used for: the save/CTA fill, selected-chip border/background, and input focus-ring border. (The first-pass center screens already use `var(--sanad-primary)` = teal.)

**App conversion status — complete and correct:**
- **Zero** Figma blue primary/accent values (`#2F6FD0`, `#1B5FBE`, `#96BEF5`, `#1D2B42`, `rgba(47,111,208)`) appear anywhere in app `src/`. Every figma-layer screen renders teal `#2E8A7B`/`#4BA898` from `theme.ts`.
- **Legitimately-kept blue-family** (do **not** convert — these are category/semantic, not primary/accent): `categoryBlue` `#5A8ABF` (light) / `#6A9ACC` (dark) and `FigmaCategory.blue`/`FigmaStatus.info` `#5A8ABF` — the per-feature chart-ramp tint used for vitals/appointment/medication icon chips (matches design's own `--chart-5`); and `infoFg`/`infoBg` (`#3E6FA0`/`#E7EEF7` light, `#7FA8D8`/`#1B2738` dark) — the semantic info-state status color.
- **The one real blue leak:** the **splash** screen — native `app.json` splash and `AnimatedSplashOverlay` both use **`#208AEF`** (bright blue). This should become the warm Sanad dark background `#151412`/teal brand (Phase VPA-4 / splash rebuild).

**Font override (related):** **no IBM Plex leaks in the figma layer** — all migrated screens use Cairo (`FigmaFont.*`). However the **un-ported legacy screens** (auth, create-circle, join-circle, recipient-profile) still render in legacy IBM Plex (`constants/theme.ts → FontFamily`). Porting them to the figma shell (Cairo) is part of the OLD_UI_LEAK remediation, not a separate font task.

---

## 8. Prioritized implementation plan (proposed — not executed)

Ordering rationale: fix **shared primitives first** (one change corrects many screens and de-risks everything downstream), then the **forms** that already sit on the shared shell (mechanical), then **centers** (mostly token deltas), then the **legacy leaks** (largest, most behavioral), then a **QA pass**.

### Phase VPA-1 — Global primitives / buttons / sheets / pickers
- **Covers:** §5.0 S1–S9. `icon-chip.tsx` tint default; `figma-form-screen.tsx` geometry (back-btn radius/border, header gap/pad, footer pad, input radius, card border); `figma-footer-primary-button.tsx` radius 12 (keep height 56); `figma-status-pill.tsx` weight/icon; `figma-segmented-tabs.tsx` weight/size/min48; `figma-list-row.tsx` size prop + title 15; `figma-card.tsx` per-context r16; `figma-bottom-sheet.tsx` handle; `figma-field.tsx` focus border.
- **Files:** the 9 shared files above only.
- **Risk:** **low** (pure constants/props; no logic; `tsc` already green). The only judgment call is the CTA-height decision (keep 56).
- **Why first:** every form and center inherits these; fixing them shrinks Phases 2–3 to per-screen leftovers and avoids re-touching screens twice.
- **S24 Ultra QA:** dark+light; open every add form and confirm back-button corner/border, header rhythm, input radius, CTA radius/height; verify chips look less saturated; verify segmented tabs ≥48dp and bold; verify bottom-sheet handle; verify list-row chip sizes on Explore (48) vs Account (40).

### Phase VPA-2 — Add/edit/detail form parity
- **Covers:** per-form leftovers (AddTask rectangle priority chips, AddVital check-glyph, AddDailyLog pain-scale chip size) **and** porting the 4 legacy editors (`MedicationEditor`, `TaskEditor`, `AppointmentEditor`, `VisitEditor`) + medication **schedule modal** onto `FigmaFormScreen`/`FigmaScheduleFields` to match their already-figma add paths (use the ported vital/daily-log editors as the template).
- **Files:** `*-editor.tsx` (4), `schedule-modal-host.tsx`, `figma-schedule-fields.tsx`, `task-form.tsx`, `figma-vital-fields.tsx`, `figma-daily-log-fields.tsx`.
- **Risk:** **medium** — editors carry status/delete sections and validation; keep all logic/validation/delete-confirm untouched, swap only the shell/fields.
- **Why second:** the add shell is already correct; bringing edit to parity removes the most jarring inconsistency (same entity, two different looks).
- **S24 QA:** add vs edit of each entity look identical; two-step delete still confirms; read-only states unchanged; schedule duplicate-time validation still fires.

### Phase VPA-3 — Center / list parity
- **Covers:** Home (icon size; quick-grid product decision), Visits (3-section structure + footer CTA + card restructure — largest), Medications (kebab affordance, gaps, radii), Account (sign-out card treatment, section split), Notifications (relative timestamps — formatting only), Vitals (heart-rate color/glyph), Explore/Appointments/Doctors/Members token deltas (mostly absorbed by Phase 1).
- **Files:** `figma-home`, `figma-visits`, `figma-medications`, `account.tsx`, `figma-notifications`, `figma-vitals`, `figma-appointments`, `figma-doctors`, `figma-members`, `explore.tsx`.
- **Risk:** **low–medium** (Visits restructure is the only sizeable layout change; notifications timestamp is presentational only — must not change stored data).
- **Why third:** depends on Phase-1 primitives; otherwise pure per-screen polish.
- **S24 QA:** Visits three sections scroll correctly in RTL with the footer CTA reachable; notification relative times render in Arabic; emergency/medication/vitals safety copy intact; no health color-coding introduced on vitals.

### Phase VPA-4 — Auth / onboarding / settings / profile / member / emergency-mgmt parity
- **Covers:** the OLD_UI_LEAK cluster — **Splash** rebuild (warm bg + teal brand + wordmark; remove `#208AEF`/`app.json` blue), **Auth** (card wrapper, icon circle, password toggle, Cairo), **Create-circle** (card grouping, amber banner, brand mark, Cairo), **Join-circle** (header, banner order, code card, success badge), **Recipient profile** (avatar card, section grouping, edit/view toggle), **Invite** code-card polish, **Emergency-contacts management** + **invitations list** figma reskin, route the 4 CTA bypasses through `FigmaFooterPrimaryButton`.
- **Files:** `animated-icon.tsx` + `app.json`, `(auth)/sign-in.tsx`/`sign-up.tsx` (+ `FormField` password variant), `onboarding-form.tsx`, `join-form.tsx`, `profile-form.tsx`, `invite-form.tsx`, `contacts-manager.tsx`, `invitations-list.tsx`.
- **Risk:** **medium–high** — these are real rewrites (and the recipient-profile edit/view toggle is behavioral); migrate font to Cairo, preserve all auth/validation/permission/RLS logic, keep destructive confirms.
- **Why fourth:** largest effort, lowest reuse; best done after the shared shell is final so these screens adopt it directly.
- **S24 QA:** splash shows branding in both themes and no blue flash; auth password toggle works; create/join circle flows still create/join (logic unchanged); recipient profile read-only for non-managers; emergency stays reference-only.

### Phase VPA-5 — Polish & visual QA
- **Covers:** notification-settings optional polish (semantic push card, grouped toggles, quiet-hours gating), `FormModal` pin-CTA-outside-scroll, residual 1–2px/hairline deltas, full dark+light RTL sweep, Western-digit + LTR-isolation spot checks, touch-target audit (≥48 / primary ≥56), screenshot diff vs each Make screen.
- **Risk:** **low.**
- **S24 QA:** side-by-side every screen vs its Make render in both themes; confirm no mojibake (`npm run check:mojibake`), `tsc --noEmit` green, `diff --check` clean.

---

## 9. First implementation prompt (recommended — do NOT execute here)

> **Phase VPA-1a — Align the shared Figma form-shell, footer CTA, and chip tint tokens (visual-only, no logic).**
>
> Scope: edit **only** these shared primitives — do not touch any screen/route/feature file, any hook, API, schema, validation, or copy:
> - `src/components/figma/icon-chip.tsx`: change the default `tintOpacity` from `0.14` to `0.082` (the design's hex-`15` = 21/255 chip tint).
> - `src/components/figma/figma-form-screen.tsx`: set back-button `borderRadius` 12→**10** and `borderWidth` hairline→**1**; set `FigmaFormCard` `borderWidth` hairline→**1**; set header `gap` 16→**12**, header `paddingBottom` 16→**12**, footer `paddingTop` 16→**12**; set `FigmaFormField` input `borderRadius` 12→**10**.
> - `src/components/figma/figma-footer-primary-button.tsx`: change `borderRadius` from `Radius.lg` (16) to `Radius.md` (12). **Keep `CTA_HEIGHT = 56`** (Sanad primary-action accessibility floor; the Make spec's 52 is intentionally overridden — leave a one-line comment saying so).
> - `src/components/figma/figma-status-pill.tsx`: label `fontFamily` → `FigmaFont.semibold`; check `Icon size` 12→**11**.
> - `src/components/figma/figma-segmented-tabs.tsx`: inactive label `fontFamily` → `FigmaFont.semibold`; label `fontSize` 14→**13**; `minHeight` 44→**48**.
>
> Hard constraints: no backend/Supabase/schema/hook/API/validation/permission/route/notification/medication-conflict/picker-behavior changes; keep teal primary, Cairo font, warm theme; keep all medical-safety copy and destructive confirmations; keep Western digits and LTR isolation. This is a pure token/geometry pass.
>
> Verify: `npx tsc --noEmit` (expect exit 0), `npm run check:mojibake` (expect clean), `git -c core.autocrlf=false diff --check` (expect exit 0). Then S24-Ultra QA in **both** dark and light: open one add form (e.g. `tasks/new`) and confirm the back button, header rhythm, input corners, and the filled-teal CTA (still ≥56dp, now radius 12); open Explore + Account and confirm list-row chips look less saturated; open Tasks and confirm segmented tabs are bold/≥48dp. Report the diff stat and a before/after note per screen. Do not proceed to other phases.

---

## Appendix — required command output (audit-time snapshot)

`git --no-pager status --short` (M = modified working tree, ?? = untracked):
```
 M src/app/(app)/appointments/new.tsx
 M src/app/(app)/circle-members/invite.tsx
 M src/app/(app)/daily-logs/new.tsx
 M src/app/(app)/tasks/new.tsx
 M src/app/(app)/visits/new.tsx
 M src/components/button.tsx
 M src/components/date-field.tsx
 M src/components/figma/figma-button.tsx
 M src/components/figma/figma-form-screen.tsx
 M src/components/figma/form-button.tsx
 M src/components/form-actions.tsx
 M src/components/form-modal.tsx
 M src/components/picker-sheet.tsx
 M src/features/appointments/appointment-editor.tsx
 M src/features/appointments/appointment-form.tsx
 M src/features/appointments/appointments-card.tsx
 M src/features/care-circle/circle-dashboard.tsx
 M src/features/care-circle/figma-home.tsx
 M src/features/care-circle/today-overview.tsx
 M src/features/daily-logs/daily-logs-card.tsx
 M src/features/daily-logs/log-editor.tsx
 M src/features/daily-logs/log-form.tsx
 M src/features/doctors/doctors-manager.tsx
 M src/features/emergency/contacts-manager.tsx
 M src/features/invitations/invite-form.tsx
 M src/features/medications/medication-editor.tsx
 M src/features/medications/medication-form.tsx
 M src/features/medications/schedule-modal-host.tsx
 M src/features/recipient-profile/profile-form.tsx
 M src/features/tasks/task-editor.tsx
 M src/features/tasks/task-form.tsx
 M src/features/tasks/tasks-card.tsx
 M src/features/visits/visit-editor.tsx
 M src/features/visits/visit-form.tsx
 M src/features/visits/visits-card.tsx
 M src/features/vitals/vital-editor.tsx
 M src/features/vitals/vital-form.tsx
 M src/features/vitals/vitals-card.tsx
 M src/locales/ar.json
 M src/locales/en.json
?? docs/claude-reports/2026-06-15-today-first-home-refinement.md
?? docs/claude-reports/2026-06-16-figma-home-parity-implementation.md
?? docs/claude-reports/2026-06-16-missing-screens-export-analysis.md
?? docs/claude-reports/2026-06-17-final-cta-actual-render-bugfix.md
?? docs/claude-reports/2026-06-17-final-cta-green-visible-validation-patch.md
?? docs/claude-reports/2026-06-17-force-actual-bottom-cta-green-button.md
?? docs/claude-reports/2026-06-17-ms-1b-exact-add-task-appointment-visit-log.md
?? docs/claude-reports/2026-06-17-ms-1b-qa-patch-2-invite-picker-vital-log-detail.md
?? docs/claude-reports/2026-06-17-ms-1b-qa-patch-3-invite-cards-picker-actions-primary-buttons.md
?? docs/claude-reports/2026-06-17-ms-1b-qa-patch-pickers-home-assignee.md
?? eslint.config.js
?? src/components/dashboard-tile.tsx
?? src/components/figma/figma-footer-primary-button.tsx
?? src/features/appointments/figma-appointment-fields.tsx
?? src/features/daily-logs/figma-daily-log-fields.tsx
?? src/features/visits/figma-visit-fields.tsx
```

`git --no-pager diff --stat`:
```
 src/app/(app)/appointments/new.tsx               |   7 +-
 src/app/(app)/circle-members/invite.tsx          |   7 +-
 src/app/(app)/daily-logs/new.tsx                 |   7 +-
 src/app/(app)/tasks/new.tsx                      |   7 +-
 src/app/(app)/visits/new.tsx                     |   7 +-
 src/components/button.tsx                        |  11 +-
 src/components/date-field.tsx                    |  69 ++--
 src/components/figma/figma-button.tsx            |  18 +-
 src/components/figma/figma-form-screen.tsx       | 178 ++++++++--
 src/components/figma/form-button.tsx             |  10 +-
 src/components/form-actions.tsx                  |  10 +-
 src/components/form-modal.tsx                    |  12 +-
 src/components/picker-sheet.tsx                  |  54 ++-
 src/features/appointments/appointment-editor.tsx |   1 -
 src/features/appointments/appointment-form.tsx   |  58 ++--
 src/features/appointments/appointments-card.tsx  |  21 +-
 src/features/care-circle/circle-dashboard.tsx    | 162 ++++-----
 src/features/care-circle/figma-home.tsx          |  21 +-
 src/features/care-circle/today-overview.tsx      | 401 +++++++++++++++--------
 src/features/daily-logs/daily-logs-card.tsx      |  10 +-
 src/features/daily-logs/log-editor.tsx           | 255 +++++++-------
 src/features/daily-logs/log-form.tsx             |  72 ++--
 src/features/doctors/doctors-manager.tsx         |   1 -
 src/features/emergency/contacts-manager.tsx      |   1 -
 src/features/invitations/invite-form.tsx         | 197 +++++------
 src/features/medications/medication-editor.tsx   |   1 -
 src/features/medications/medication-form.tsx     |  22 +-
 src/features/medications/schedule-modal-host.tsx |   4 +-
 src/features/recipient-profile/profile-form.tsx  |   1 -
 src/features/tasks/task-editor.tsx               |   1 -
 src/features/tasks/task-form.tsx                 | 233 +++++++------
 src/features/tasks/tasks-card.tsx                |  20 +-
 src/features/visits/visit-editor.tsx             |   1 -
 src/features/visits/visit-form.tsx               |  95 +++---
 src/features/visits/visits-card.tsx              |  10 +-
 src/features/vitals/vital-editor.tsx             | 235 +++++++------
 src/features/vitals/vital-form.tsx               |   9 +-
 src/features/vitals/vitals-card.tsx              |  10 +-
 src/locales/ar.json                              |  17 +
 src/locales/en.json                              |  17 +
 40 files changed, 1374 insertions(+), 899 deletions(-)
```

*Audit produced read-only. No files in `src/` were modified, staged, or committed; the only file written is this report.*
