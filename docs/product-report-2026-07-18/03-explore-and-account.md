# Explore Tab & Account / Settings Tab

This section documents the two "directory / self" tabs of Sanad's bottom navigation: **Explore** (a static, grouped navigation index of every care feature reachable in the app) and **Account** (the signed-in user's profile, circle membership, links to notification/recipient settings, and sign-out). Both are Arabic-first RTL screens that render on `FigmaScreen` with grouped `Surface` cards of `FigmaListRow`s. Neither tab holds a back or add affordance — they are top-level tab destinations. Copy below is quoted verbatim from `src/locales/ar.json` and `src/locales/en.json`; every user-facing string is i18n-driven (there is no hardcoded copy in these screens).

> Note on namespaces: the two screens read the **`figma.explore.*`** and **`figma.account.*`** namespaces plus cross-feature keys (`careCircle.dashboard.sections.*`, `pulse.*`, `circleMembers.*`, `recipientProfile.*`, `notificationSettings.*`, `account.*`, `common.*`). The legacy top-level **`explore.*`** namespace (`"استكشاف / ميزات قادمة…"`, `comingSoon`, `sections.guides/resources/community`) still exists in both locale files but is **not** referenced by the current `explore.tsx` — it is dead copy from an earlier "coming soon" concept. The `settings.*` and `profile.*` namespaces are **empty objects** in both locales.

---

## How both tabs are reached (shared navigation chrome)

Both screens are tabs in the bottom `Tabs` navigator (`src/components/app-tabs.tsx`), rendered with a custom `FigmaTabBar` (`src/components/figma/figma-tab-bar.tsx`). Three tabs, in navigator order `index → explore → account`; RTL mirrors the row so **Home sits at the right**.

| Tab | Route name | Label (AR / EN) | Icon (lucide) |
|---|---|---|---|
| Home | `index` | «الرئيسية» / "Home" | `Home` |
| Explore | `explore` | «استكشاف» / "Explore" | `Compass` |
| Account | `account` | «الحساب» / "Account" | `User` |

Tab-bar visual (figma-tab-bar.tsx:35–104): a hairline top border over `backgroundElement`; each tab is a 20px lucide icon inside a **44×28 teal active pill** (`primary` @ 10% light / 15% dark alpha) with a label below. Active state = `primary` color, `strokeWidth` 2.5, semibold label; idle = `textSecondary`, stroke 2, regular label. Label size 14, `minHeight` 48 touch target. `accessibilityState.selected` marks the active tab.

---

## Screen: Explore

- **Route & how reached**: `/(app)/(tabs)/explore` — the middle bottom-tab. Reached only by tapping the **Explore** tab. File: `src/app/(app)/(tabs)/explore.tsx`.
- **Purpose**: A static, grouped navigation index — the full menu of every care feature — where each row deep-links into that feature's real center (each destination resolves the active circle via its own `CircleGate`). No live counts are shown; sublabels describe each feature instead (explore.tsx:27–34).

### Layout, top to bottom

`FigmaScreen` with `gap={24}` (scrolling column, 20px gutter, safe-area top+8 / bottom+24).

1. **Title header** (no back, no add) — explore.tsx:152–158:
   - Title (26px bold, `text`, `accessibilityRole="header"`): `figma.explore.title` → «استكشاف» / "Explore".
   - Subtitle (14px regular, `textSecondary`): `figma.explore.subtitle` → «جميع أدوات الرعاية في مكان واحد» / "All your care tools in one place".
2. **Three grouped sections**, each: a `FigmaSectionLabel` eyebrow (14px bold, letter-spacing 0.5, `textSecondary`) above one `Surface tone="card"` `radius={Radius.xl}` `padded={0}` card holding hairline-separated `FigmaListRow`s. Each row after the first sets `topDivider` (hairline separator above).

Each row = tinted `GlyphChip` (`size="md"`, 44px, icon on a 14%-alpha tint of the row's category color) + title (16px semibold) + subtitle (14px regular, `textSecondary`) + a trailing **`ChevronLeft`** chevron (18px, `textSecondary` — RTL "forward"). Row min-height 68, tap gives `android_ripple` + 0.85 pressed opacity; `accessibilityRole="button"`, label = title, hint = subtitle.

### Every interactive element (all are row-taps that `router.push` a route)

**Section 1 — «الرعاية اليومية» / "Daily care"** (`figma.explore.groups.dailyCare`):

| Row | Icon / chip color | Title (AR / EN) | Subtitle (AR / EN) | Navigates to |
|---|---|---|---|---|
| medications | `medication` / `categoryTeal` | «الأدوية» / "Medications" | «الجرعات والمواعيد» / "Doses and timings" | `/medications` |
| tasks | `success` / `categoryBlue` | «المهام» / "Tasks" | «مهام الرعاية اليومية» / "Daily care tasks" | `/tasks` |
| appointments | `appointment` / `categoryPurple` | «المواعيد» / "Appointments" | «زيارات ومواعيد الأطباء» / "Doctor visits and appointments" | `/appointments` |
| visits | `member` / `categoryGold` | «الزيارات العائلية» / "Family visits" | «تنسيق زيارات العائلة» / "Coordinate family visits" | `/visits` |

**Section 2 — «الصحة والمتابعة» / "Health & follow-up"** (`figma.explore.groups.healthFollowup`):

| Row | Icon / chip color | Title (AR / EN) | Subtitle (AR / EN) | Navigates to |
|---|---|---|---|---|
| vitals | `activity` / `categoryBlue` | «القياسات الحيوية» / "Vital readings" | «الضغط والسكر والحرارة» / "Blood pressure, sugar and temperature" | `/vitals` |
| dailyLogs | `dailyLog` / `categoryGreen` | «السجلات اليومية» / "Daily logs" | «ملاحظات الحالة اليومية» / "Daily condition notes" | `/daily-logs` |
| doctors | `doctor` / `categoryGold` | «الأطباء» / "Doctors" | «الأطباء المعالجون والعيادات» / "Treating doctors and clinics" | `/doctors` |
| emergency | `error` / `dangerSolid` | «بطاقة الطوارئ» / "Emergency card" | «معلومات حيوية عند الحاجة» / "Vital info when it's needed" | `/emergency-card` |

**Section 3 — «دائرة الرعاية» / "Care circle"** (`figma.explore.groups.careCircle`):

| Row | Icon / chip color | Title (AR / EN) | Subtitle (AR / EN) | Navigates to |
|---|---|---|---|---|
| pulse | `activity` / `categoryTeal` | «سجل النشاط» / "Activity Log" | «آخر تحديثات دائرة الرعاية» / "Recent care circle activity" | `/pulse` |
| members | `member` / `categoryPurple` | «الأعضاء» / "Members" | «العائلة ومقدمو الرعاية» / "Family and caregivers" | `/circle-members` |
| recipientProfile | `vital` / `categoryTeal` | «ملف من تعتني به» / "Care recipient profile" | «المعلومات الطبية وبيانات الشخص الذي تتم رعايته» / "Medical details and the cared-for person's information" | `/recipient-profile` |

> Note the canonical feature order (medications → tasks → appointments → vitals → visits → daily logs → doctors → members) is loosely followed but re-grouped by theme; visits sits in "Daily care" and emergency/pulse/recipient-profile are added.

### States

Explore is **fully static** — the section list is a hardcoded `SECTIONS` constant (explore.tsx:36–143). There is **no loading, empty, or error state**, no data fetch, no scope toggle, and no «أنا متكفّل» claim. Every device/role sees the same 11 rows; there is **no role/permission gating** on Explore (the destination screens do their own gating).

### Data shown

None dynamic — titles and subtitles are all i18n strings; chip colors and icons are constants.

### Components used

`FigmaScreen`, `Surface` (tone `card`), `FigmaListRow`, `FigmaSectionLabel`, `GlyphChip` (via the row), `Icon` (via chip). No forms, sheets, or pickers.

### Cross-links

Deep-links to eleven feature centers: `/medications`, `/tasks`, `/appointments`, `/visits`, `/vitals`, `/daily-logs`, `/doctors`, `/emergency-card`, `/pulse`, `/circle-members`, `/recipient-profile`.

---

## Screen: Account

- **Route & how reached**: `/(app)/(tabs)/account` — the rightmost bottom-tab (Home sits at the right in RTL, so Account is at the left edge). Reached by tapping the **Account** tab. File: `src/app/(app)/(tabs)/account.tsx`.
- **Purpose**: The signed-in user's self screen — shows identity (name + email), lets them edit their display name, links to their active circle / notification settings / joining another circle, and ends the session with a guarded sign-out.

### Layout, top to bottom

`FigmaScreen` with `gap={24}`.

1. **Profile header card** (`Surface radius={Radius.xl} padded={20}`, account.tsx:106–129):
   - A row of: a `GlyphChip iconName="member" color="primary" size="lg"` (64px), a text column, and a trailing edit button.
   - Text column: label (14px, `textSecondary`) `account.signedInAs` → «تم تسجيل الدخول باسم» / "Signed in as"; the **display name** (18px bold, `text`, `numberOfLines={1}`); and — when present — the email (14px, `textSecondary`, rendered in `LtrText`, `selectable`, forced LTR direction).
   - **Display-name resolution** (account.tsx:50–51): `profile.fullName` (trimmed) → else `emailLocalPart(user.email)` → else `account.noName` → «أضف اسمك» / "Add your name". Never a bare email, never blank.
   - **Edit button** (trailing): a 40px pill, `primary` @ 10% alpha background, holding a lucide `Edit3` (18px, `primary`). `accessibilityLabel` = `account.editName` → «تعديل الاسم» / "Edit name". Tapping **opens the Name-edit bottom-sheet** (`setEditingName(true)`).

2. **«دوائر الرعاية» / "Care circles"** section (`FigmaSectionLabel` = `account.circleSectionTitle`) over one `Surface tone="card" padded={0}` card of rows (account.tsx:132–161):

| Row | Shown when | Icon / color | Title (AR / EN) | Subtitle (AR / EN) | Navigates to |
|---|---|---|---|---|---|
| Active circle | only if `activeCircle` exists | `member` / `primary` | `activeCircle.circleName` — else `circleMembers.title` «الأعضاء» / "Members" | the circle subtitle (see below) — else `circleMembers.subtitle` «العائلة ومقدّمو الرعاية في هذه الدائرة» / "Family and caregivers in this circle" | `/circle-members` |
| Notification settings | always (`topDivider` when a circle row precedes) | `notification` / `categoryPurple` | `notificationSettings.title` «إعدادات الإشعارات» / "Notification settings" | `notificationSettings.subtitle` «اختر ما تريد أن تُشعَر به» / "Choose what you're notified about" | `/notification-settings` |
| Join another circle | always (`topDivider`) | `add` / `categoryGold` | `account.joinAnother` «الانضمام إلى دائرة أخرى» / "Join another circle" | `account.joinAnotherSubtitle` «أدخل رمز دعوة للانضمام» / "Enter an invitation code to join" | `/join-circle` |

   - **Circle subtitle** (account.tsx:95–99): joins the user's role label in this circle and the recipient's name with `"  ·  "`. Role label = `circleMembers.roles.{role}` — one of «مشرف» admin, «مقدّم الرعاية الأساسي» primary_caregiver, «فرد من العائلة» family_member, «مقدّم رعاية» caregiver, «عضو عن بُعد» remote_member, «الشخص الذي تتم رعايته» elder (EN: Administrator / Primary caregiver / Family member / Caregiver / Remote member / Care recipient). Recipient name = `activeCircle.recipientName` when stored. No member count is shown (not available client-side, account.tsx:93–94).

3. **Danger sign-out block** (`gap: 12`, account.tsx:164–186):
   - An **error message** (14px medium, `errorFg`, `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`) shown only after a failed sign-out — `account.signOutError` → «تعذّر تسجيل الخروج. حاول مرة أخرى.» / "Could not sign out. Please try again."
   - A **`Button variant="danger"`** with `iconName="signOut"`, label `account.signOut` → «تسجيل الخروج» / "Sign out". Shows `loading` spinner + is `disabled` while `signingOut`.
   - A **version line** (14px, centered, `textSecondary`): `figma.account.version` with `{{version}}` = `Constants.expoConfig.version` (fallback `"1.0.0"`) → «سند · الإصدار {{version}}» / "Sanad · Version {{version}}".

### Interactive elements & confirmations

| Element | Type | Label (AR / EN) | Action | Confirm |
|---|---|---|---|---|
| Edit-name pill | icon button (`Edit3`) | (a11y) «تعديل الاسم» / "Edit name" | opens Name-edit bottom-sheet | — |
| Active-circle row | row-tap | circle name / «الأعضاء» | `router.push('/circle-members')` | — |
| Notification-settings row | row-tap | «إعدادات الإشعارات» / "Notification settings" | `router.push('/notification-settings')` | — |
| Join-another row | row-tap | «الانضمام إلى دائرة أخرى» / "Join another circle" | `router.push('/join-circle')` | — |
| Sign out | danger button | «تسجيل الخروج» / "Sign out" | `confirmAction` → `doSignOut()` | **confirmAction (destructive)**, see below |

**Sign-out confirmation** (account.tsx:55–68) uses `confirmAction()` (the lightweight cross-platform prompt, `src/utils/confirm.ts` — native two-button `Alert` with a red destructive confirm; web `window.confirm`):
- Title: `account.confirmSignOutTitle` → «تسجيل الخروج؟» / "Sign out?"
- Message: `account.confirmSignOutMessage` → «سيتوقّف هذا الجهاز عن تلقّي التذكيرات حتى تسجّل الدخول مجدداً.» / "This device will stop receiving reminders until you sign in again."
- Confirm: `account.signOut` «تسجيل الخروج»; Cancel: `common.cancel` «إلغاء» / "Cancel".

On confirm, `doSignOut()` (account.tsx:70–90): best-effort `deactivatePushToken(getRememberedToken())` **before** `supabase.auth.signOut()` (the RPC needs the auth context); on success the auth-state change triggers the `(app)` guard redirect (screen unmounts); on failure it surfaces the alert error and re-enables the button.

### States

- **Loading**: no full-screen skeleton — the profile query (`useMyProfile`) resolves the name, but the header renders immediately with the email-local-part fallback while it loads (no spinner shown for the profile).
- **Signing out**: sign-out button shows spinner + disabled.
- **Error**: sign-out failure → the `errorFg` alert line above the button (copy above). No other error surface.
- **Empty**: no true empty state — the active-circle row is simply omitted when there is no `activeCircle` (the notification + join rows always remain).
- **No scope toggle / no «أنا متكفّل» claim** on this screen.

### Data shown

Display name; signed-in email (`user.email`, LTR, selectable); the active circle's name, the user's role label, the recipient name; app version. No dates or status pills.

### Components used

`FigmaScreen`, `Surface`, `GlyphChip`, `LtrText`, `FigmaListRow`, `FigmaSectionLabel`, `Button` (danger + secondary), `FigmaBottomSheet` (the name-edit sheet), lucide `Edit3`. Data: `useAuth` (user), `useCircleSelection` (activeCircle), `useMyProfile` / `useUpdateMyName` (`src/features/profile/hooks.ts` + `api.ts`).

### Cross-links

`/circle-members`, `/notification-settings`, `/join-circle`. Opens the in-screen **Name-edit bottom-sheet** (below).

---

## Bottom-sheet: Name-edit (`NameEditSheet`)

- **How reached**: tapping the edit pill on the Account profile header. Rendered inline in `account.tsx:203–264` via `FigmaBottomSheet`.
- **Purpose**: Edit the signed-in user's display name (`profiles.full_name`, RLS = own row only).
- **Chrome**: the canonical bottom-sheet chrome (`FigmaBottomSheet`) — a `backgroundElement` card sliding over the `overlay` scrim, `Radius.card` top corners, hairline border, a 48×8 `backgroundSelected` grab handle, centered `sectionTitle` title, `MaxFormWidth`, dismisses on backdrop tap (a11y label `common.close` «إغلاق»). Title = `account.editName` → «تعديل الاسم» / "Edit name".

### Form

| Field | Label (AR / EN) | Type | Required | Placeholder | Default | Validation / notes |
|---|---|---|---|---|---|---|
| Name | `account.nameLabel` «الاسم» / "Name" | single-line text | optional | `account.namePlaceholder` «اكتب اسمك» / "Enter your name" | current `fullName` (re-seeded each open) | `autoCapitalize="words"`; a whitespace-only value is stored as **NULL** (fallback chain resumes), not a blank string (api.ts:28–34). No inline required/format validation. |

- The input is a raw `TextInput` (minHeight 52, 1.5px border, `backgroundSunken` fill, 16px), `accessibilityLabel` = the name label, `placeholderTextColor` = `textMuted`.
- **Error line** (14px medium, `errorFg`, `accessibilityRole="alert"`) shown on save failure: `account.nameError` → «تعذّر حفظ الاسم. حاول مرة أخرى.» / "Could not save your name. Please try again."

### Footer (two stacked buttons)

- **Save** — `Button label={common.save}` → «حفظ» / "Save"; shows `loading` while the mutation is pending. Calls `update.mutateAsync(name)`; on success closes the sheet, on failure sets the error line. On success the hook invalidates `profile.me` **and** the `circle-members` roster so the new name propagates to roster / assignment pickers / Care Pulse (hooks.ts:24–33).
- **Cancel** — `Button variant="secondary" label={common.cancel}` → «إلغاء» / "Cancel"; disabled while pending; just closes.

There is no separate `account.nameSaved` toast wired in this screen (the key «تم حفظ الاسم» / "Name saved" exists but the sheet simply closes on success). No discard-changes guard on this sheet.

---

## Workflows

### 1. Navigate to a feature from Explore
1. Tap the **Explore** tab (`Compass` icon, «استكشاف»).
2. Scroll the three grouped cards (Daily care / Health & follow-up / Care circle).
3. Tap any row (e.g. «الأدوية» / "Medications").
4. `router.push` deep-links to that feature center (e.g. `/medications`); the destination's own `CircleGate` resolves the active circle. Back returns to Explore.

### 2. Edit your display name
1. Tap the **Account** tab («الحساب»).
2. Tap the **edit pill** (`Edit3`) on the profile header → the Name-edit bottom-sheet slides up.
3. Field pre-fills with the current name; type a new name.
4. Tap **حفظ / Save** → `updateMyName` writes `profiles.full_name` (whitespace → NULL). On success the sheet closes and the name updates everywhere (header, roster, pickers, Pulse). On failure the «تعذّر حفظ الاسم…» error line appears; the sheet stays open.
5. (Or tap **إلغاء / Cancel** / the backdrop to dismiss without saving.)

### 3. Open your circle's members / notification settings / join another circle
1. Account tab → "Care circles" section.
2. Tap the **active-circle row** → `/circle-members`; or the **notification row** → `/notification-settings`; or the **join-another row** → `/join-circle` (enter an invite code).

### 4. Sign out
1. Account tab → scroll to the danger block.
2. Tap **تسجيل الخروج / Sign out** (danger button, `signOut` icon).
3. A `confirmAction` prompt appears — title «تسجيل الخروج؟», message «سيتوقّف هذا الجهاز عن تلقّي التذكيرات حتى تسجّل الدخول مجدداً.», confirm «تسجيل الخروج» (destructive/red), cancel «إلغاء».
4. On confirm: the button spins; the device's push token is deactivated (best-effort) then the Supabase session ends; the `(app)` guard redirects to auth. On failure the button re-enables and «تعذّر تسجيل الخروج. حاول مرة أخرى.» shows as an alert.
