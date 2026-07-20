# App Shell, Tab Navigation & Home (Today) Tab

This section documents the authenticated app shell — the bottom tab bar (three tabs: Home / Explore / Account), the shared screen chrome that wraps every tab and detail screen, and the Home ("Today") tab in full. Home is the care-loop dashboard for the active care circle: a header with the date, care-recipient/circle switcher, notification bell and emergency shortcut; a signature dose "care-loop" SVG ring; two today stat cards; the next appointment; a quick-action grid to every feature; an "available to claim" entry; today's doses with inline status logging; a "today's pulse" activity strip; and an emergency banner. Everything is Arabic-first RTL, gender-neutral, built on IBM Plex Sans Arabic and the `theme.ts` tokens. All copy below is quoted verbatim from `src/locales/ar.json` and `src/locales/en.json`.

---

## The App Shell & Navigation Structure

### Route group layout

- The authenticated area lives under the Expo Router `(app)` group. Inside it, `(app)/(tabs)/_layout.tsx` renders `<AppTabs />` (`src/app/(app)/(tabs)/_layout.tsx:8`). The tabs group sits in its own folder so the parent `(app)` layout is a **Stack** that pushes full-screen detail screens (recipient profile, emergency card, contacts, doctors, medications, tasks, etc.) **over** the tab bar (`_layout.tsx:3-6`).
- This means: the three tabs are the persistent bottom bar; every feature screen the Home quick-actions and cards navigate to is a **stacked full-screen push** that covers the tab bar (no bottom bar on detail screens).

### Bottom Tab Bar

**Component**: `AppTabs` (`src/components/app-tabs.tsx`) → renders Expo Router's JS `Tabs` with a fully custom `tabBar` = `FigmaTabBar` (`src/components/figma/figma-tab-bar.tsx`). `headerShown` is false for all tabs (`app-tabs.tsx:21`).

**Tabs, in navigator order** (`app-tabs.tsx:39-41`):

| Order | Route name | Label AR | Label EN | Icon (lucide) |
|---|---|---|---|---|
| 1 | `index` (Home) | «الرئيسية» | "Home" | `Home` |
| 2 | `explore` | «استكشاف» | "Explore" | `Compass` |
| 3 | `account` | «الحساب» | "Account" | `User` |

Labels come from `tabs.home` / `tabs.explore` / `tabs.account`. Icon + label mapping is in `TAB_META` (`figma-tab-bar.tsx:14-18`).

**RTL note**: Because the row mirrors under RTL, **Home sits at the right** (first in reading order). The custom bar preserves standard navigation: on press it emits the `tabPress` event and navigates if not already active and not prevented (`app-tabs.tsx:26-36`).

**Tab bar visual spec** (`figma-tab-bar.tsx:35-104`):
- Full-width row, `backgroundElement` fill, hairline top border (`c.border`), `space-around` distribution, bottom padding = `max(safe-area inset, 12)`.
- Each tab = a vertical stack: a **44×28 pill** (`Radius.md`) containing a **20px** lucide icon, then the label below (gap 4, `minHeight: 48`).
- **Active** tab: pill filled with `withAlpha(primary, 0.15 dark / 0.10 light)`; icon color `primary`, stroke width **2.5**; label uses `FontFamily.semibold`, color `primary`.
- **Idle** tab: no pill fill; icon color `textSecondary`, stroke width **2**; label `FontFamily.regular`, color `textSecondary`.
- Label size **14** (the content floor), `lineHeight: 18`.
- Accessibility: each tab is `accessibilityRole="button"`, `accessibilityState={{ selected }}`, `accessibilityLabel` = the localized label.

**Web variant** (`src/components/app-tabs.web.tsx`): a **different** shell used only on web. It is a top-anchored horizontal bar (absolute, full width) built on `expo-router/ui` `Tabs`/`TabList`/`TabTrigger`. It shows the brand text «سند» / "Sanad" (`appName`) at the start (pushed away with `marginEnd:'auto'`), then three text-only `TabButton`s: «الرئيسية» (href `/`), «استكشاف» (href `/explore`), «الحساب» (href `/account`). Focused button uses `backgroundSelected` tone + `text` color; idle uses `backgroundElement` + `textSecondary`. No icons on web. Pressed state dims to opacity 0.7. Column capped at `MaxContentWidth`.

### Shared Screen Chrome

Two container primitives wrap screen content; a designer should know which chrome each screen class uses.

**`FigmaScreen`** (`src/components/figma/figma-screen.tsx`) — the redesigned full-bleed container used by Home and the redesigned feature screens:
- Full-bleed RTL column, themed `background` fill, **no max-width centering** (phone layouts).
- Horizontal padding = `Gutter` (20px). Top padding = `safe-area top + 8`. Bottom padding = `safe-area bottom + 24`.
- Vertical `gap` between children configurable (Home passes `gap={16}`).
- Scrolls by default (`ScrollView`, hidden scroll indicator); `scroll={false}` gives a single static view.

**`Screen`** (`src/components/screen.tsx`) — the legacy/canonical responsive container still used by Home's loading/error branches and many other screens:
- Fills full width, an inner column capped at `MaxContentWidth` that centers on tablet/web.
- Configurable `maxWidth`, `gutter` (default `Gutter`), `gap` (default `Spacing.three`), `edges` (default bottom-inset only; tab screens pass `{ top: true }`), `center` (vertical centering for empty/error states), optional sticky `footer`, fixed `header`, `keyboardAvoiding`, and pull-to-refresh `refreshControl`.
- Home's `index.tsx` uses `<Screen scroll={false} center edges={{ top:true }}>` only for the error state.

---

## Home / "Today" Tab

### Route & how reached

- **Route**: `/` — the `index` tab (`src/app/(app)/(tabs)/index.tsx`), the default/right-most tab and app landing after auth.
- **Reached by**: launching the app while authenticated with a selected circle; tapping the Home tab; deep-links back to root.

### Purpose

The daily care dashboard for the **active** care circle — the care-loop dose ring, today's doses/tasks/appointments at a glance, quick access to every feature, recent circle activity, and an emergency shortcut.

### Top-level branching (what Home renders)

`HomeScreen` (`index.tsx:20-54`) is a router by auth/circle state:

1. **No user** → renders nothing (guarded upstream by the `(app)` auth guard) (`index.tsx:27`).
2. **Loading** (`isLoading`) → a centered large `ActivityIndicator` in `primary` on a themed view (`index.tsx:29-35`). No skeleton — a plain spinner.
3. **Error** (`isError`) → `<Screen scroll={false} center edges={{top:true}}>` wrapping `ErrorState` with:
   - message = `careCircle.loadError` (verify copy in the care-circle doc), retry label = `retry` → «إعادة المحاولة» / "Retry", `onRetry` calls `refetch()` (`index.tsx:37-47`).
4. **No circles** (`hasNoCircles || !activeCircle`) → `<CareCircleOnboarding userId={user.id} />` (the create-first-circle / join-with-code onboarding — documented in the care-circle section) (`index.tsx:49-51`).
5. **Has active circle** → `<FigmaHome circle={activeCircle} />` — the dashboard below (`index.tsx:53`).

### Role/permission scoping (applies to the whole dashboard)

Derived from `circle.canManage` / `circle.canLogDoses` (`permissions.ts:23-47`):
- `canManage` = true for **admin** / **primary_caregiver**.
- `canLogDoses` = true for admin, primary_caregiver, family_member, caregiver (any caregiving role). A **read-only / remote / elder** role has neither.
- **`scopeToMine = !canManage && canLogDoses`** (`figma-home.tsx:105`): a non-manager caregiver sees only **their own** doses, tasks and appointments; managers see the **whole circle**; read-only members see all (but get no action buttons).
  - Scoping is applied to: the care-loop ring & next-dose (`visibleDoses` filtered by `responsibleUserId === userId`, `figma-home.tsx:112-114`), the "tasks due today" stat (`useTodayTaskSummary(..., scopeToMine ? userId : null)`, `:124-128`), and appointments (`visibleAppts` filtered by `assigned_to === userId`, `:131-135`).

### Layout, top to bottom

Container: `FigmaScreen gap={16}` (`figma-home.tsx:227`). All within a vertical scroll.

#### 1. Header (`figma-home.tsx:229-278`)

A row: text block (start) + two circular action buttons (end).

Text block, stacked:
- **Date line** — `formatLongDate(i18n.language)` (a long localized date string), muted (`textSecondary`, regular), size 14 (`:231`).
- **Circle-name row** — a `Pressable` showing `circle.circleName` (size 20, bold, `text`) + a `ChevronDown` (16, `textSecondary`). Tap **toggles the circle switcher dropdown** (`setSwitcherOpen`). `accessibilityRole="button"`, hint = `circleSwitcher.switch` → «تبديل» / "Switch" (`:232-241`).
- **Subtitle line** (only if non-empty) — real recipient data: age + dialect, joined with `  ·  ` (`:242-246`). Age uses `careCircle.dashboard.today.ageYears` → «{{age}} سنة» / "{{age}} yrs"; dialect is `recipient.dialect` raw. Falls back to `circle.recipientName` when neither age nor dialect exists (`:175-182`).

Action buttons (end), each a 44×44 pill with hairline border:
- **Notification bell** — `Bell` icon (20, `textSecondary`) on a `backgroundSunken` fill. Navigates to `/notifications` (`:249-266`). Carries an **unread badge**: when `unreadCount > 0`, a small `dangerSolid` badge (bordered by `background`) top-end showing the count, capped at «9+» (`:259-265`). Accessibility label switches between `notifications.openCenterWithCount` → «فتح الإشعارات، {{count}} غير مقروءة» / "Open notifications, {{count}} unread" (when unread) and `notifications.title` → «الإشعارات» / "Notifications".
- **Emergency shortcut** — `Phone` icon (20, `errorFg`) on a soft `dangerSolid @ 0.12` fill with `dangerSolid @ 0.2` border. Navigates to `/emergency-card`. Accessibility label = `careCircle.dashboard.sections.emergency.title` → «بطاقة الطوارئ» / "Emergency card" (`:267-276`).

#### 2. Error / dose-log notice banner (conditional) (`figma-home.tsx:282-308`)

Mutually exclusive:
- **Today load error** (`dosesError || tasksError || appointments.isError`): a **tappable retry banner** — `AlertCircle` (16, `errorFg`) + message `careCircle.dashboard.today.loadError` → «تعذّر تحميل بيانات اليوم. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load today's data. Check your connection and try again." + the `retry` action word «إعادة المحاولة» / "Retry". Tapping calls `retryToday()` which refetches doses, tasks and appointments (`:166-171`). Soft `dangerSolid` tinted fill/border. This exists so a failed fetch never masquerades as an empty (clear) day.
- **Dose-log error** (`logError`, set when a dose write fails): a static `accessibilityRole="alert"` banner — `AlertCircle` + `careCircle.dashboard.today.logFailed` → «تعذّر تسجيل الجرعة. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't record the dose. Check your connection and try again." (`:297-307`).

#### 3. Circle switcher dropdown (conditional, when `switcherOpen`) (`figma-home.tsx:311-344`)

A `Surface tone="card"` (rounded `Radius.lg`, no inner padding) listing the user's circles:
- One `Pressable` row per circle: `circleName` (size 15, medium) + a `Check` (16, `primary`) when it is the active circle. Rows after the first carry a hairline top divider. Tapping calls `setActiveCircle(circleId)` and closes the dropdown (`:316-331`). `accessibilityState={{ selected }}`.
- A final row — `careCircle.dashboard.today.joinAnotherCircle` → «الانضمام إلى دائرة أخرى» / "Join another circle" (in `primary`) — closes the dropdown and navigates to `/join-circle` (`:332-342`).

#### 4. Care-loop hero (`figma-home.tsx:347-409`)

A `Surface` (rounded `Radius.xl`, padding 20).
- **Top row**: eyebrow `careCircle.dashboard.today.medLoopEyebrow` → «دورة الدواء · اليوم» / "Medication loop · Today" (semibold, muted, letter-spacing 0.3) + a `viewAll` link «عرض الكل» / "View all" (`primary`) that navigates to `/medications` (`:348-353`).
- **Body row** (icon left, content right, gap 20):
  - **`CareLoopRing`** (`src/components/figma/care-loop-ring.tsx`): a 144×144 SVG arc, radius 54, stroke 10, round caps, a 60° bottom gap (300° arc), start angle 120°. A faint full track (`ringTrack`) with a `primary` progress sweep proportional to `given/total` (clamped; total=0 safe, no progress arc). Centered inside: `given` count (bold 26, `text`) with `/total` appended (regular 15, `textSecondary`), kept in LTR order; below it the label `medications.todayTitle` → «جرعات اليوم» / "Today's doses". The SVG is decorative/hidden from screen readers; the wrapper carries one spoken label: `loopA11y` → «حلقة رعاية اليوم: {{given}} من {{total}} جرعة تم إعطاؤها» / "Today's care loop: {{given}} of {{total}} doses given", or `loopA11yNone` → «حلقة رعاية اليوم: لا جرعات مجدولة اليوم» / "Today's care loop: no doses scheduled today" when total=0.
  - **Right column** — three exclusive states:
    - **No doses today** (`total === 0`): muted text `careCircle.dashboard.today.loopNone` → «لا جرعات مجدولة اليوم» / "No doses scheduled today" (`:357-358`).
    - **All doses given** (`given >= total`): a **quiet moment of care** — a `successFg @ 0.12` pill with a `Check` (16) + `careCircle.dashboard.today.allDosesGiven` → «جميع الجرعات أُعطيت» / "All doses given" (`:359-367`). (No score/streak — see the "no gamification" standing decision.)
    - **Next dose pending** (`nextDose`): label `careCircle.dashboard.today.nextDoseLabel` → «الجرعة القادمة» / "Next dose", then a `backgroundSunken` bordered mini-card with the medication name (semibold) + its scheduled time (LTR-isolated `formatHm`, in `primary`), and the dosage on its own line if present (`:368-387`).
  - **Dose status strip** (when `total > 0`): a wrapping row of up to **5** pills (`visibleDoses.slice(0,5)`), one per dose — an icon + the LTR time. Icon/color by status via `DOSE_STATUS` (`figma-home.tsx:72-76`): given → `Check`/`successFg`, postponed → `Clock`/`warningFg`, missed → `X`/`errorFg`; unlogged → `Clock`/`textSecondary` on a solid `backgroundSunken` pill. Logged pills use a `withAlpha(color, 0.12)` tint (`:389-406`).

#### 5. Today summary — two stat cards (`figma-home.tsx:412-429`)

A row of two equal `StatCard`s (each a `backgroundElement` bordered card; local component `figma-home.tsx:552-582`), each: an icon + top label, a large value (bold 22), a sub-label (14). Accessibility label = `"{topLabel}: {value} {subLabel}"`.
- **Tasks card** — `Check` icon (`successFg`); top label `careCircle.dashboard.sections.tasks.title` → «المهام» / "Tasks"; value = `taskSummary.dueToday`; sub-label `careCircle.dashboard.today.dueTodayShort` → «مستحقّة اليوم» / "Due today". Taps to `/tasks`.
- **Appointments card** — `Calendar` icon (`categoryBlue`); top label `careCircle.dashboard.sections.appointments.title` → «المواعيد» / "Appointments"; value = `apptCount` (count of non-cancelled appointments starting today, via `countAppointmentsToday`, `today.ts:48-53`); sub-label `careCircle.dashboard.today.appointmentLabel` → «موعد اليوم» / "Today's appointment". Taps to `/appointments`.

#### 6. Next appointment card (conditional, when `nextAppt` exists) (`figma-home.tsx:432-450`)

A `Surface` (rounded `Radius.xl`, padding 16) that taps to `/appointments`. Row: `GlyphChip iconName="doctor" color="categoryBlue" size="md"` + text block + a `ChevronLeft` (18, RTL "forward" chevron).
- **When line** (`apptWhen`, muted): if the appointment is today → `careCircle.dashboard.today.apptTodayAt` → «اليوم، الساعة {{time}}» / "Today at {{time}}"; otherwise the LTR date + time joined (`:198-204`).
- **Title** (`nextAppt.title`, semibold 15, one line).
- **Location** (`nextAppt.location`, muted, one line) if present.

#### 7. Quick actions grid (`figma-home.tsx:452-470`)

- Section label `careCircle.dashboard.today.quickActions` → «وصول سريع» / "Quick access" (semibold, muted).
- A **4-up wrapping grid** (wraps to a second row — 8 tiles total). Tile width = `(screenWidth − Gutter*2 − 12*3) / 4`. Each tile: a `backgroundElement` bordered rounded box containing a `GlyphChip size="md"` in the feature color + a 2-line label. Whole tile is a `Pressable` (button, `accessibilityLabel` = the label) that pushes the route.
- **Order & content** (canonical A7 order; RTL grid places the first item top-right so medications leads) (`figma-home.tsx:211-220`):

| # | id | Route | Label AR | Label EN | GlyphChip icon | Color |
|---|---|---|---|---|---|---|
| 1 | medications | `/medications` | «الأدوية» | "Medications" | `medication` | categoryTeal |
| 2 | tasks | `/tasks` | «المهام» | "Tasks" | `task` | categoryBlue |
| 3 | appointments | `/appointments` | «المواعيد» | "Appointments" | `appointment` | categoryPurple |
| 4 | vitals | `/vitals` | «القياسات الحيوية» | "Vital readings" | `activity` | categoryBlue |
| 5 | visits | `/visits` | «الزيارات العائلية» | "Family visits" | `invite` | categoryGreen |
| 6 | logs | `/daily-logs` | «السجلات اليومية» | "Daily logs" | `dailyLog` | categoryPurple |
| 7 | doctors | `/doctors` | «الأطباء» | "Doctors" | `doctor` | categoryGreen |
| 8 | members | `/circle-members` | «الأعضاء» | "Members" | `member` | categoryGold |

(Labels 1–7 from `careCircle.dashboard.sections.*.title`; members from `circleMembers.title`.)

#### 8. "Available to claim" entry (conditional — claim-capable only) (`figma-home.tsx:472-493`)

Shown **only** when `canManage || canLogDoses` (i.e. never for read-only / remote / elder members). An `accentFg`-tinted (gold) bordered card: a gold chip with a `HandHelping` icon (22, `accentFg`), title `claiming.entryTitle` → «متاح للتكفّل» / "Available to claim" (bold), subtitle `claiming.entrySubtitle` → «عناصر بلا مسؤول — يمكنك التكفّل بها» / "Unassigned items you can take on" (one line), and a `ChevronLeft` (18). Taps to `/available-to-claim`.

#### 9. Today's doses list (conditional, when `total > 0`) (`figma-home.tsx:496-519`)

- Header row: label `medications.todayTitle` → «جرعات اليوم» / "Today's doses" + a link `careCircle.dashboard.today.allMedications` → «كل الأدوية» / "All medications" (`primary`) to `/medications`.
- A list of `DoseRow`s (local component, `figma-home.tsx:584-731`), ordered so **unlogged doses lead** (stable time order within groups, `:117-119`).

**Each dose row** shows:
- A 36×36 **status circle** with the status icon: given `Check`/`successFg`, postponed `Clock`/`warningFg`, missed `X`/`errorFg`, unlogged `Clock`/`textSecondary`. Logged uses a tinted (`@0.12`) fill; unlogged uses a solid `backgroundSunken`.
- **Medication name** (semibold, wraps to 2 lines, never truncated).
- **Dosage** on its own line if present.
- A meta row: **scheduled time** (LTR `formatHm`) + a **status tag pill** with `statusLabel` — for logged doses `medications.status.{status}` → given «أُعطيت»/"Given", postponed «مؤجَّلة»/"Postponed", missed «لم تُعطَ»/"Missed"; for unlogged, `careCircle.dashboard.today.doseUnlogged` → «لم تُسجّل بعد» / "Not logged yet".
- **Responsible member row** (managers only — `circle.canManage`): a `Users` icon (12) + the responsible member's display name via `responsibleLabel(...)` (`:509`, `:643-650`).
- **Action button** (only when `canLog` = `canLogDoses && (canManage || dose is mine)`, `:510`):
  - Unlogged → a filled `primary` "Log" button `careCircle.dashboard.today.logAction` → «تسجيل» / "Log".
  - Logged → an outlined "Edit status" button `medications.editStatus` → «تعديل الحالة» / "Edit status".
  - Tapping toggles the row's inline action tray (`onToggle`).

**Inline status tray** (expands under the row when open & `canLog`) (`figma-home.tsx:668-728`):
- **Fresh logging** (unlogged dose): three action chips — given / postponed / missed — each an icon + `medications.status.{s}` label in its status color. Tapping a chip fires the log immediately (`setStatus(dose, status)`), no extra confirm (this is the sanctioned first log).
- **Correction of an already-logged dose** (P2-4): tapping a **different** status opens an inline **two-step confirm** — a message `medications.confirmChangeStatus` → «تغيير الحالة إلى «{{status}}»؟» / "Change status to "{{status}}"?" (rendered as `accessibilityRole="alert"`), with a `primary` **Save** button (`common.save` → «حفظ» / "Save"; shows a spinner while `pending`) and an outlined **Cancel** (`common.cancel` → «إلغاء» / "Cancel"). Tapping the **same** status just closes the tray. This is the "confirm before overwrite" pattern.
- On any successful log the tray closes; a failure surfaces the `logError` alert banner at the top (never a silent revert).

#### 10. Care Pulse strip (conditional) (`figma-home.tsx:521-522`, `740-823`)

`PulseSection` — today's most-recent circle events, scoped to the circle's **local** day (via the circle timezone), capped at **5**. It stays **quiet**: renders **nothing** while loading, on error, when the backend RPC isn't enabled, or when there is no activity today (so a quiet day / not-yet-migrated backend never shows an error). Refetches when Home regains focus (`useFocusEffect`, `:760-764`).
- Header: label `pulse.sectionTitle` → «نبض اليوم» / "Today's pulse" + two actions: a `Share2` icon-button (shares a composed text summary; a11y label `pulse.share` → «مشاركة ملخص اليوم» / "Share today's summary") and a `pulse.viewAll` → «عرض الكل» / "View all" link to `/pulse`.
- Each event = a `backgroundElement` bordered `Pressable` row: a `GlyphChip` (icon/color from `pulseEventVisual`) + a 2-line description (`pulseDescription`) + the LTR event time (`hmInTimeZone`). Tapping routes to the underlying item (`pulseRouteFor(item_type, item_id)`); a11y hint = `common.details` → «التفاصيل» / "Details".
- The empty/share fallback copy `pulse.shareEmpty` → «يوم هادئ، لا جديد يُذكر اليوم.» / "A calm day — nothing to report today." is the app's "warm empty" north star (used by the share composer when there's nothing).

#### 11. Emergency banner (always shown) (`figma-home.tsx:525-547`)

A `dangerSolid`-tinted (soft, `@0.08` fill, `@0.2` border) `Pressable` card that taps to `/emergency-card`:
- A chip with an `AlertCircle` icon (22, `errorFg`).
- Title `careCircle.dashboard.today.emergencyTitle` → «معلومات الطوارئ» / "Emergency info" (bold, `errorFg`).
- Subtitle (`emergencySubtitle`, one line): built from real recipient data — blood type `careCircle.dashboard.today.emergencyBlood` → «فصيلة الدم: {{value}}» / "Blood type: {{value}}" and/or a truncated (40-char) allergy `emergencyAllergy` → «تحسّس: {{value}}» / "Allergies: {{value}}", joined with `  ·  `; falls back to `emergencySubtitle` → «اطّلع على بطاقة الطوارئ» / "View the emergency card" (`:184-196`).
- A solid `dangerSolid` "View" button `careCircle.dashboard.today.emergencyView` → «عرض» / "View".

The danger tone here is the restrained `dangerSolid` (`#C45050`), never a bright alarm-red, per the standing "calm danger" decision.

### Data sources (how Home is computed)

- **Doses**: `useTodayDoses(circleId, date)` → `DoseItem[]` computed purely client-side by `computeDoseItems` (`src/features/medications/today.ts:39-100`) from active meds + active schedules + logs, filtered to the date's weekday and `[start_date, end_date]` window, sorted by time then name; each item carries `medicationName`, `dosage`, `scheduledTime` (HH:MM:SS), `status` (given/postponed/missed or null), `logId`, and `responsibleUserId`. `summarizeDoses` (`today.ts:103-107`) gives `{total, given, remaining}`.
- **Tasks stat**: `useTodayTaskSummary(circleId, userId|null)` → `TaskTodaySummary` (`src/features/care-activity/today.ts:26-45`): `dueToday`, `completedToday`, `openTotal`. Home shows `dueToday`.
- **Appointments**: `useUpcomingAppointments` → `countAppointmentsToday` (non-cancelled, starting today) and `nextAppt` (first non-cancelled).
- **Recipient**: `useRecipient(circleId)` supplies birth_date (→ age), dialect, blood_type, allergies for the header subtitle and emergency banner.
- **Unread**: `useUnreadCount()` for the bell badge.
- **Pulse**: `useCareActivity(circleId, 20)` then filter-to-today + cap at 5.
- Dose logging mutation: `useLogDose(circleId)` → `logDose.mutateAsync({dose, status, date})`.

### Components used (design-system mapping)

- `FigmaScreen` (container), `Surface` (hero, next-appt, switcher dropdown), `GlyphChip` (quick-action tiles, next-appt, pulse rows, claim/emergency chips are custom `View`s not GlyphChip), `CareLoopRing` (SVG ring), lucide icons (`Bell`, `Phone`, `ChevronDown/Left`, `Check`, `Clock`, `X`, `Calendar`, `AlertCircle`, `HandHelping`, `Users`, `Share2`). Local sub-components: `StatCard`, `DoseRow`, `PulseSection`.
- **Not used by Home** but available in the shell: `DashboardTile` / `StatTile` (`src/components/dashboard-tile.tsx`) — a lighter quick-access tile and a 2-up stat tile built on `Surface` + `GlyphChip`; the current `FigmaHome` re-implements its own `StatCard` and quick tiles inline rather than composing these. A redesign could consolidate onto them.

### Cross-links (screens Home opens)

`/notifications`, `/emergency-card`, `/join-circle`, `/medications`, `/tasks`, `/appointments`, `/vitals`, `/visits`, `/daily-logs`, `/doctors`, `/circle-members`, `/available-to-claim`, `/pulse`, plus per-item pulse routes. All are stacked full-screen pushes over the tab bar.

---

## Workflows

### 1. Land on Home and read the day at a glance
1. Authenticate; the app opens the Home (`/`) tab (right-most under RTL).
2. Home resolves circle state → shows the dashboard for the active circle.
3. The care-loop ring shows `given/total` doses; the two stat cards show tasks due today and today's appointment count; the next-appointment card and today's-doses list fill in from real data. A non-manager caregiver sees only their own scoped data.

### 2. Log a dose from Home
1. Scroll to **Today's doses** (visible only when there are doses today).
2. On an unlogged dose row, tap **«تسجيل» / "Log"** (button appears only if you may log this dose: a manager, or the responsible member).
3. The inline tray expands with three chips: **«أُعطيت» / Given**, **«مؤجَّلة» / Postponed**, **«لم تُعطَ» / Missed**.
4. Tap one → the dose is recorded immediately; the ring, strip and status tag update. On failure a top banner «تعذّر تسجيل الجرعة…» appears; retry.

### 3. Correct an already-logged dose
1. On a logged dose row tap **«تعديل الحالة» / "Edit status"**.
2. Tap a **different** status chip → an inline confirm appears: «تغيير الحالة إلى «…»؟» / "Change status to "…"?".
3. Tap **«حفظ» / "Save"** to overwrite (spinner while saving) or **«إلغاء» / "Cancel"** to abort. (Tapping the current status just closes the tray.)

### 4. Switch the active care circle
1. Tap the circle-name row (with the down chevron) in the header.
2. The dropdown lists your circles (active one marked with a check). Tap another → it becomes active and the dashboard reloads for it.
3. Or tap **«الانضمام إلى دائرة أخرى» / "Join another circle"** → navigates to `/join-circle`.

### 5. Jump to a feature via Quick Access
1. Scroll to **«وصول سريع» / "Quick access"**.
2. Tap any of the 8 tiles (medications, tasks, appointments, vitals, visits, daily logs, doctors, members) → pushes that feature screen over the tab bar.

### 6. Reach emergency info fast
1. Tap the red **phone** button in the header, **or** the **«معلومات الطوارئ» / "Emergency info"** banner at the bottom (its **«عرض» / "View"** button).
2. Navigates to `/emergency-card`.

### 7. Open notifications
1. Tap the **bell** in the header (badge shows unread count, capped at «9+»).
2. Navigates to `/notifications`.

### 8. Claim unassigned work
1. (Claim-capable members only — manager or any caregiver.) Tap the gold **«متاح للتكفّل» / "Available to claim"** card.
2. Navigates to `/available-to-claim` to take on unassigned items.

### 9. Review and share today's activity (Care Pulse)
1. If there was circle activity today, the **«نبض اليوم» / "Today's pulse"** strip appears with up to 5 recent events.
2. Tap an event row → opens the underlying item; tap **«عرض الكل» / "View all"** → `/pulse`.
3. Tap the share icon → shares a text summary of today (or the calm-day fallback «يوم هادئ، لا جديد يُذكر اليوم.»).

### 10. Recover from a failed today-data load
1. If doses/tasks/appointments failed to load, a red banner «تعذّر تحميل بيانات اليوم…» appears near the top.
2. Tap it (or its **«إعادة المحاولة» / "Retry"** word) → refetches all three today queries.

### 11. Switch tabs
1. Tap **Home / Explore / Account** in the bottom bar (Home right-most under RTL). The active tab gets the teal pill + bold label.
