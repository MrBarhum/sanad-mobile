# Notifications & Reminder Settings

This domain covers everything a caregiver sees and controls about being *told* things: the in-app **Notifications inbox** (a recent-first, cross-circle list of received notifications with read/unread state and tap-through deep links), the **Notification Settings** screen (per-category reminder toggles, quiet hours, timezone display, a manager-only missed-dose grace stepper, and a local self-test), the **push permission / registration status card**, and the invisible **notification observer** that wires up actionable push (the "تم" / "ذكرني بعد ٥ دقائق" buttons), foreground handling, token refresh, and tap routing. Everything is i18n-driven (`notifications.*`, `notificationSettings.*`, `figma.notifications.*`, `common.*`) at exact `ar`/`en` key parity. There is **no per-item reminder toggle** anywhere — preferences are user-level or per-circle, and screens link to the settings screen via a shared `ReminderNotice` banner.

A structural note the designer should know up front: the inbox route registers a **native stack header** (`title` = `notifications.title`) *and* the screen renders its **own in-screen `FigmaHeader`** (back arrow + centered title + "mark all read"). So the notifications screen currently shows two stacked title bars. The settings route uses only the native stack header.

---

## Screen: Notifications inbox

- **Route & how reached**: `/(app)/notifications` → `src/app/(app)/notifications.tsx`, which renders `FigmaNotifications` (`src/features/notifications/figma-notifications.tsx`).
  - Entry point: the **bell icon** in the Home header (`src/features/care-circle/figma-home.tsx:249-266`) — `router.push('/notifications')`. The bell carries an unread count badge (see States).
  - Also reached programmatically: `useOpenNotification` falls back to `router.push('/notifications')` when a tapped notification has no sensible deep link or when the user is no longer a member of the notification's circle (`hooks.ts:287,293`).
- **Purpose**: A recent-first inbox of the signed-in user's notifications across all circles, with read/unread state and tap-through to the relevant screen.

### Layout, top to bottom

1. **Native stack header** — centered title «الإشعارات» / "Notifications" (`notifications.title`), with the platform back button. (`(app)/_layout.tsx:47`.)
2. **In-screen `FigmaHeader`** (`figma-notifications.tsx:89-105`):
   - **Back button** (start): round 44dp pill, `backgroundElement` fill, hairline border, `ArrowRight` (lucide) glyph — RTL places it at the right. `accessibilityLabel` = «رجوع» / "Back" (`common.back`). Calls `router.back()`.
   - **Centered title**: «الإشعارات» / "Notifications" (`figma.notifications.title`).
   - **Trailing action** (end): a text button «قراءة الكل» / "Mark all read" (`figma.notifications.markAllRead`) rendered in the primary color — **only when `unreadCount > 0`**. Otherwise the trailing slot is empty. Disabled + dimmed (opacity 0.5) while the mutation is pending. Tapping calls `markAll.mutate(null)` (marks every notification read, no confirmation — a non-destructive state change).
3. **Unread banner** (`figma-notifications.tsx:107-117`) — only when `unreadCount > 0`. A tinted pill (primary at 10% fill, 15% border) with text «{{count}} إشعارات غير مقروءة» / "{{count}} unread notifications" (`figma.notifications.unreadBanner`).
4. **Body** — one of: loading skeleton, error card, empty state, or the list (see States).
5. **Load-more button** — at the list foot when `items.length >= limit` (`figma-notifications.tsx:143-150`): a full-width bordered `backgroundElement` button, «تحميل المزيد» / "Load more" (`figma.notifications.loadMore`), primary text. Tapping raises the page limit by `NOTIFICATIONS_PAGE_SIZE` (50) and refetches.

### Notification row (`NotificationRow`, `figma-notifications.tsx:157-202`)

Each row is a full-width `Pressable` card (rounded `Radius.lg`, hairline border, 16h/14v padding):

- **Icon chip** (start): a `GlyphChip` (size `sm`) whose icon + tone is chosen per notification `type` from the `TYPE_ICON` map (`figma-notifications.tsx:33-51`). The chip is decorative; meaning is always carried by the type label text below. Per-type icon + color:

  | type | icon | color tone |
  |---|---|---|
  | `medication_due` | medication | categoryTeal |
  | `medication_missed` | medication | errorFg |
  | `task_due` | success | categoryGold |
  | `appointment_upcoming` | appointment | categoryBlue |
  | `visit_update` | doctor | categoryGreen |
  | `care_update` | dailyLog | categoryPurple |
  | `emergency` | emergency | errorFg |
  | `system` | notification | categoryBlue |
  | `item_assigned` | member | categoryBlue |
  | `task_overdue` | clock | warningFg (amber) |
  | `visit_upcoming` | appointment | categoryGreen |
  | `item_claimed` | claim | categoryTeal |
  | `item_completed` | success | successFg |
  | `item_cancelled` | error | categoryPurple *(muted purple, deliberately NOT error red — "not completed" must not alarm)* |
  | `claim_digest` | sparkle | categoryGold |

- **Title line**: `n.title` (the server-composed notification title, up to 2 lines). Font is **bold** when unread, **medium** when read. To the right, an **unread dot** (8dp, primary color) shows only when unread.
- **Body**: `n.body` (server-composed body text), `textSecondary`.
- **Meta line**: the type's short label (`notificationMeta(n.type).labelKey`, see the `notifications.types.*` table below) followed by a two-space gap and the LTR-isolated timestamp `«YYYY-MM-DD HH:MM»` derived from `n.created_at` (`ymdFromInstant` + `hmFromInstant`).

**Row tint**: unread rows use a faint primary wash (8% dark / 6% light) with a 15% primary border; read rows use `backgroundElement` with the standard border.

**Row tap** (`onOpen`, `figma-notifications.tsx:82-85`): if unread, marks it read (`markRead.mutate({ id, read: true })`), then calls `useOpenNotification` which resolves the deep link, switches the active circle if needed (only if the user is still a member — otherwise routes to the inbox), and navigates. There is no per-row "mark unread", swipe, or long-press action on this screen.

### Notification type labels (`notifications.types.*`)

Used for the row meta line and referenced by `catalog.ts`. Each type also has a fallback route (where a tap goes when there is no explicit `deep_link`).

| type | AR label | EN label | fallback route |
|---|---|---|---|
| `medication_due` | دواء | Medication | `/medications` |
| `medication_missed` | جرعة فائتة | Missed dose | `/medications` |
| `task_due` | مهمة | Task | `/tasks` |
| `appointment_upcoming` | موعد | Appointment | `/appointments` |
| `visit_update` | زيارة | Visit | `/visits` |
| `care_update` | تحديث رعاية | Care update | `/daily-logs` |
| `emergency` | طارئ | Emergency | `/emergency-card` |
| `system` | تحديث | Update | (none → inbox) |
| `item_assigned` | مُسند إليك | Assigned to you | (none → inbox) |
| `task_overdue` | مهمة متأخرة | Task overdue | `/tasks` |
| `visit_upcoming` | زيارة قادمة | Upcoming visit | `/visits` |
| `item_claimed` | تم التكفّل | Picked up | (none → inbox) |
| `item_completed` | تم الإنجاز | Completed | (none → inbox) |
| `item_cancelled` | تعذّر الإنجاز | Not completed | (none → inbox) |
| `claim_digest` | عناصر متاحة | Available to help | `/available-to-claim` |

Deep-link resolution order (`catalog.ts:61-67`): explicit `deep_link` column → `data.deepLink` → the type's fallback route → null (opens inbox).

### States

- **Loading**: `<SkeletonList />` placeholder (`figma-notifications.tsx:120`).
- **Error**: a `Surface` card (`figma-notifications.tsx:122-130`) with a centered `GlyphChip` (icon `error`, tone `errorFg`), the message «تعذّر تحميل الإشعارات» / "Could not load notifications" (`figma.notifications.loadError`), and a primary-colored retry link «إعادة المحاولة» / "Retry" (`figma.notifications.retry`) that calls `list.refetch()`.
- **Empty**: the shared `EmptyState` (`figma-notifications.tsx:132-136`) with the feature icon `notification`:
  - Title: «لا توجد إشعارات» / "No notifications" (`figma.notifications.emptyTitle`).
  - Subtitle: «ستظهر هنا التذكيرات والتحديثات.» / "Reminders and updates will appear here." (`figma.notifications.emptySubtitle`).
- **Populated**: the list of rows (8dp gap), optionally followed by the Load-more button.
- **Bell badge (on Home, not this screen)**: when `useUnreadCount() > 0`, a `dangerSolid` badge on the bell shows the count, capped at «9+» (`figma-home.tsx:259-264`). The bell's own accessibility label is «فتح الإشعارات، {{count}} غير مقروءة» / "Open notifications, {{count}} unread" (`notifications.openCenterWithCount`) when there are unread, else «الإشعارات» / "Notifications".

There is **no "mine / all" scope toggle** and **no "أنا متكفّل" claim** on the notifications inbox — those belong to the operational list screens, not here. The inbox is global across circles by design (the per-circle filter chips exist in the data layer but are intentionally not part of this screen — `figma-notifications.tsx:71-74`).

### Data shown per row

`n.title`, `n.body`, type label, `created_at` timestamp (date + time), read/unread (via bold title + dot + tint). All row content is server-composed; the client never builds notification copy.

### Components used

`FigmaScreen`, `FigmaHeader`, `GlyphChip`, `EmptyState`, `Surface`, `SkeletonList`, `isolateLtr`. Hooks: `useNotifications`, `useMarkNotificationRead`, `useMarkAllRead`, `useOpenNotification`.

### Cross-links

Row taps deep-link into `/medications`, `/tasks`, `/appointments`, `/visits`, `/daily-logs`, `/emergency-card`, `/available-to-claim`, or an explicit entity route carried by the notification.

---

## Screen: Notification Settings

- **Route & how reached**: `/(app)/notification-settings` → `src/app/(app)/notification-settings.tsx` → `NotificationSettings` (`src/features/notifications/notification-settings.tsx`).
  - Entry point 1: the **Account** tab, a `FigmaListRow` titled «إعدادات الإشعارات» / "Notification settings" with subtitle «اختر ما تريد أن تُشعَر به» / "Choose what you're notified about" (`account.tsx:147-151`).
  - Entry point 2: the **`ReminderNotice`** banner on the medications / tasks / appointments centers (see the ReminderNotice section) — its action line «إدارة إعدادات الإشعارات ›» / "Manage notification settings ›" (`notifications.manageLink`) pushes here.
- **Purpose**: Configure which reminders you receive (per-category), when to stay quiet, and the timezone context; plus push enablement, circle timezone, and (managers) missed-dose grace.
- **Header**: native stack header only, title «إعدادات الإشعارات» / "Notification settings" (`notificationSettings.title`, `(app)/_layout.tsx:48-51`). No in-screen `FigmaHeader`.
- **Screen container**: `Screen` with `maxWidth={MaxFormWidth}`, `Spacing.four` gap. An `UnsavedChangesGuard` warns before navigating away with unsaved preference edits (`notification-settings.tsx:131`).

### Layout, top to bottom

#### 1. Push status card (`PushStatusCard`, `push-status-card.tsx`)

A `Surface` explaining why Sanad asks for push and giving a single explicit enable control (permission is **never** requested automatically).

- **Header row**: a `GlyphChip` (glyph `system`, tone `info` when enabled else `neutral`), then:
  - Title «ابقَ على اطّلاع بالرعاية» / "Stay on top of care" (`notificationSettings.push.explainTitle`).
  - Body «يمكن لسند تذكيرك بجرعات الأدوية ومهام الرعاية والمواعيد القادمة حتى لا يفوتك شيء.» / "Sanad can remind you about medication doses, care tasks and upcoming appointments so nothing is missed." (`...push.explainBody`).
  - Privacy line «ترتبط الإشعارات بحسابك على هذا الجهاز فقط. لا نشارك رمز جهازك ولا نُضمّن أي تفاصيل صحية حسّاسة فيها.» / "Notifications are tied to your account on this device only. We never share your device token or include sensitive health details in them." (`...push.privacy`).
- **Action area** (divider above), one of four states:
  - **web-unsupported**: text «على الويب يعمل مركز الإشعارات داخل التطبيق، لكن إشعارات الجهاز غير متاحة — افتح سند على هاتفك لتفعيلها.» / "On the web the in-app notification center works, but device push notifications aren't available — open Sanad on your phone to enable them." (`...push.web`).
  - **no-device** (simulator): «تحتاج إشعارات الجهاز إلى جهاز فعلي. جرّب ذلك على هاتفك.» / "Push notifications need a physical device. Try this on your phone." (`...push.noDevice`).
  - **enabled** (supported + granted + active device token): a `StatusBadge` tone `success` «الإشعارات مفعّلة على هذا الجهاز.» / "Notifications are on for this device." (`...push.granted`) beside a small secondary button «إيقافها على هذا الجهاز» / "Turn off on this device" (`...push.disable`) that calls `disable()` (deactivates this device's server token; no confirm prompt).
  - **otherwise**: a primary button «تفعيل الإشعارات» / "Enable notifications" (`...push.enable`) that calls `enable()` → prompts OS permission → registers token.
  - **Result line** (after enable, when result ≠ 'enabled'), `accessibilityLiveRegion="polite"`, from `notificationSettings.push.results.*`:
    - `denied`: «الإشعارات مُعطّلة. يمكنك تفعيلها لسند من إعدادات جهازك.» / "Notifications are turned off. You can enable them for Sanad in your device settings."
    - `unsupported`: «إشعارات الجهاز غير متاحة هنا.» / "Push notifications aren't available here."
    - `no-device`: «تحتاج إشعارات الجهاز إلى جهاز فعلي.» / "Push notifications need a physical device."
    - `project-id-missing`: «لم تُضبط الإشعارات بالكامل في هذه النسخة بعد. حاول مرة أخرى بعد التحديث القادم.» / "Notifications aren't fully configured in this build yet. Please try again after the next update."
    - `error`: «تعذّر تفعيل الإشعارات. حاول مرة أخرى.» / "Could not enable notifications. Please try again."

#### 2. Scope section (`Section`, `notification-settings.tsx:135-156`)

- Title «تنطبق هذه الإعدادات على» / "These settings apply to" (`notificationSettings.scope.title`).
- **Scope chips** (pill selector, wrap): a «كل الدوائر (افتراضي)» / "All circles (default)" chip (`...scope.global`) plus one chip per circle (labeled with the circle's name). The active chip is filled `primaryBg`, prefixed with a check glyph, `primaryText`; inactive chips are `backgroundSelected` with a border. Selecting a chip switches which preference row is being edited (global default vs a specific circle). Default selection = the active circle.
- **Hint** below (`textSecondary`, `small`):
  - global: «إعدادك الافتراضي لكل دائرة، ما لم يكن لدائرة إعدادات خاصة.» / "Your default for every circle, unless a circle has its own settings." (`...scope.globalHint`).
  - circle: «إعدادات خاصة بـ {{circle}}. تتجاوز إعداداتك الافتراضية لهذه الدائرة.» / "Settings just for {{circle}}. They override your defaults for this circle." (`...scope.circleHint`).

#### 3. Per-category toggle group (`Surface`, `padded={false}`)

Renders `PREFERENCE_TOGGLES` (`schema.ts:32-83`) as a single grouped `Surface`, each a `ToggleRow` (label + description on the left, a `FigmaSwitch` 48×28 brand pill on the right, hairline divider between rows). Editing a toggle updates local form state (not saved until the Save button). The catalog and its exact copy:

| order | key | AR label / description | EN label / description |
|---|---|---|---|
| 1 | `medicationReminders` | تذكيرات الأدوية / عند حلول موعد جرعة مجدولة. | Medication reminders / When a scheduled dose is due. |
| 2 | `missedDoseAlerts` | تنبيهات الجرعات الفائتة / عند عدم تسجيل جرعة مجدولة. | Missed dose alerts / When a scheduled dose hasn't been recorded. |
| 3 | `taskReminders` | تذكيرات المهام / عند حلول موعد مهمة رعاية. | Task reminders / When a care task is due. |
| 4 | `appointmentReminders` | تذكيرات المواعيد / قبل موعد قادم. | Appointment reminders / Before an upcoming appointment. |
| 5 | `visitReminders` | تذكيرات الزيارات / قبل زيارة عائلية قادمة. | Visit reminders / Before an upcoming family visit. |
| 6 | `visitUpdates` | تحديثات الزيارات / تحديثات عن زيارات العائلة. | Visit updates / Updates about family visits. |
| 7 | `careUpdates` | تحديثات الرعاية / السجلات اليومية وملاحظات الرعاية الأخرى. | Care updates / Daily logs and other care notes. |
| 8 | `emergencyAlerts` | تنبيهات الطوارئ / إشعارات الطوارئ المهمة. | Emergency alerts / Important emergency notifications. |
| 9 | `remoteSummary` | ملخّصات المتابعة / ملخّصات للأعضاء عن بُعد الذين يتابعون. | Follow-up summaries / Summaries for remote members following along. |

**Not shown as toggles** (deliberate — their producers are deferred, so a visible switch would be a dead control; `schema.ts:53-62` audit note): `assignmentAlerts`, `activityUpdates`, `availableToClaimDigest`. These are still carried in the form input and sent on every save so any stored value persists (`api.ts:167-169`). Server defaults: all reminders default **on** except `availableToClaimDigest` which defaults **off** (`api.ts:205-223`).

#### 4. Quiet hours (`Surface`, `padded={false}`, `notification-settings.tsx:175-207`)

- A `ToggleRow`: label «ساعات الهدوء» / "Quiet hours" (`...quietHours.label`), description «إيقاف الإشعارات غير العاجلة خلال هذه الساعات.» / "Pause non-urgent notifications during these hours." (`...quietHours.description`), with a `FigmaSwitch`.
- **When enabled**, a two-column time-field row appears (divider above):
  - «من» / "From" (`...quietHours.start`) — a `TimeField` bound to `quietHoursStart`.
  - «إلى» / "To" (`...quietHours.end`) — a `TimeField` bound to `quietHoursEnd`.
- **Note** (always shown, divider above, `textSecondary`): «يمكن أن تمتد ساعات الهدوء بعد منتصف الليل. تُسلّم التذكيرات العادية بعد انتهاء ساعات الهدوء؛ وقد تصل تنبيهات الطوارئ رغم ذلك.» / "Quiet hours can cross midnight. Normal reminders are delivered after quiet hours end; emergency alerts may still arrive." (`...quietHours.note`).
- **Validation** (`schema.ts:86-94` + `notification-settings.tsx:88-91`): when quiet hours are enabled, both start and end must be present and valid `HH:MM` (24-hour, regex `^([01]\d|2[0-3]):[0-5]\d$`). Otherwise Save is blocked and shows «حدّد وقت بداية ونهاية لساعات الهدوء.» / "Set both a start and end time for quiet hours." (`...quietHours.invalid`).

#### 5. Timezone card (display only, `notification-settings.tsx:210-220`)

- Label «المنطقة الزمنية» / "Timezone" (`...timezone.label`).
- A sunken well showing the current timezone string (LTR-isolated). Value = the saved preference timezone, else the device timezone (`getDeviceTimezone()`).
- Hint «منطقة جهازك، تُستخدم لساعات الهدوء والعرض لديك. أما مواعيد الأدوية والمهام المجدولة فتتبع المنطقة الزمنية لدائرة الرعاية.» / "Your device timezone, used for your quiet hours and display. Scheduled medication and task times follow the care circle's timezone." (`...timezone.hint`). This field is **not editable** here — the device timezone is captured automatically on registration.

#### 6. Save feedback + button

- **Error** (`accessibilityRole="alert"`, polite): shows `notificationSettings.saveError` «تعذّر حفظ الإعدادات. حاول مرة أخرى.» / "Could not save settings. Please try again." (or the quiet-hours invalid message).
- **Saved** (polite, `successFg`): «تم حفظ الإعدادات» / "Settings saved" (`...saved`).
- **Save button** (primary, `notification-settings.tsx:236-241`): «حفظ الإعدادات» / "Save settings" (`notificationSettings.save`). Shows a spinner while pending. Persists all toggles + quiet hours + timezone via `upsertPreferences`.

#### 7. Circle timezone card (`CircleTimezoneCard`, `circle-timezone-card.tsx`)

The canonical zone that governs *when* scheduled reminders fire (distinct from the per-user display timezone above).

- Title «المنطقة الزمنية للدائرة» region — `circleTimezone.title`; shows the current zone with a friendly city/country label (e.g. "الرياض، السعودية") and the raw IANA id beneath when they differ.
- Explanation `circleTimezone.explain`.
- **Manager-only editing**: non-managers see a read-only note (`circleTimezone.managerOnly`). Managers see a button «تغيير»/«اختيار» (`circleTimezone.change` / `.select`) that opens a searchable `TimezonePicker`. Picking a new zone shows a confirm-change summary (`circleTimezone.confirmChange`, `circleTimezone.impact`) with a primary confirm (`circleTimezone.confirm`) and secondary «إلغاء» / "Cancel" (`common.cancel`).
- When the circle is still on the default `UTC`, managers see a warning prompt (`circleTimezone.confirmPrompt`, `warningFg`) asking them to confirm the real zone.
- Errors: `circleTimezone.invalid` / `circleTimezone.error` (`accessibilityRole="alert"`).

*(Full circle-timezone copy lives in the `circleTimezone.*` namespace, outside this domain's assigned namespaces — flagged as a cross-domain dependency below.)*

#### 8. Missed-dose grace card — managers only (`MissedDoseGraceCard`, `notification-settings.tsx:296-399`)

Rendered only when `activeCircle.canManage` is true. A per-circle stepper for the wait after a dose time before the responsible person is alerted.

- Title «مهلة الجرعة الفائتة» / "Missed-dose grace" (`...missedDoseGrace.title`).
- Description «الوقت بعد موعد الجرعة قبل تنبيه المسؤول عنها.» / "How long after a dose time before the responsible person is alerted." (`...missedDoseGrace.description`).
- **Stepper row**: a minus button (`Glyph.minus`, accessibilityLabel «إنقاص المهلة» / "Decrease grace"), a center value well «{{count}} دقيقة» / "{{count}} min" (`...missedDoseGrace.minutes`), and a plus button (`Glyph.plus`, accessibilityLabel «زيادة المهلة» / "Increase grace"). Steps of `MISSED_DOSE_GRACE_STEP` (±5 min), clamped between `MISSED_DOSE_GRACE_MIN` and `MISSED_DOSE_GRACE_MAX`; the minus/plus dim (opacity 0.4) at the bounds.
- **Tier hint**: «يُنبَّه المسؤول بعد {{tier2}} دقيقة، ويُنبَّه المديرون بعد {{tier3}} دقيقة.» / "The responsible person is alerted after {{tier2}} min, and managers after {{tier3}} min." (`...missedDoseGrace.tierHint`), where tier3 = 2× the grace.
- **Feedback**: saved «تم حفظ المهلة» / "Grace saved" (`...missedDoseGrace.saved`, `successFg`, polite); error «تعذّر حفظ المهلة. حاول مرة أخرى.» / "Could not save the grace. Please try again." (`...missedDoseGrace.saveError`, `alert`).
- **Save button** (secondary): «حفظ الإعدادات» / "Save settings" (`notificationSettings.save`), disabled unless the value changed; commits via a manager-only RPC.

#### 9. Local test section (`notification-settings.tsx:257-285`) — native only (hidden on web)

- Section title «اختبار على هذا الجهاز» / "Test on this device" (`...test.sectionTitle`).
- Description «جدوِل إشعارًا محليًا تجريبيًا بعد ثوانٍ. يظهر على هذا الجهاز فقط ولا يُشعِر أي شخص آخر.» / "Schedule a local test notification a few seconds from now. It shows only on this device and doesn't notify anyone else." (`...test.description`).
- **Secondary button** «إرسال إشعار تجريبي» / "Send a test notification" (`...test.action`): schedules a local notification 5s out with title «اختبار سند» / "Sanad test" (`...test.title`) and body «هذا إشعار تجريبي محلي.» / "This is a local test notification." (`...test.body`).
- **`__DEV__`-only** second button (hardcoded QA string, the sole sanctioned hardcoded-Arabic exception): "DEV · اختبار أزرار الإشعار (محلي)" — schedules a local notification carrying the `sanad_task_reminder` category to verify the "تم"/"ذكرني" action buttons render.
- **Feedback line** (polite): scheduled «تمت جدولة الإشعار التجريبي.» / "Test notification scheduled." (`...test.scheduled`); failed «تعذّرت جدولة الإشعار التجريبي. حاول مرة أخرى.» / "Could not schedule the test notification. Please try again." (`...test.failed`).

### Forms — Notification Settings preference form

| Field | Label (AR / EN) | Type | Required | Default | Validation / notes |
|---|---|---|---|---|---|
| Scope | (chip selector) | single-choice pill | — | active circle | switches which row is edited |
| medicationReminders | تذكيرات الأدوية / Medication reminders | toggle | — | on | — |
| missedDoseAlerts | تنبيهات الجرعات الفائتة / Missed dose alerts | toggle | — | on | — |
| taskReminders | تذكيرات المهام / Task reminders | toggle | — | on | — |
| appointmentReminders | تذكيرات المواعيد / Appointment reminders | toggle | — | on | — |
| visitReminders | تذكيرات الزيارات / Visit reminders | toggle | — | on | — |
| visitUpdates | تحديثات الزيارات / Visit updates | toggle | — | on | — |
| careUpdates | تحديثات الرعاية / Care updates | toggle | — | on | — |
| emergencyAlerts | تنبيهات الطوارئ / Emergency alerts | toggle | — | on | — |
| remoteSummary | ملخّصات المتابعة / Follow-up summaries | toggle | — | on | — |
| quietHoursEnabled | ساعات الهدوء / Quiet hours | toggle | — | off | reveals the two time fields |
| quietHoursStart | من / From | time (HH:MM) | required when quiet hours on | null | 24h regex; both bounds required |
| quietHoursEnd | إلى / To | time (HH:MM) | required when quiet hours on | null | 24h regex; both bounds required |
| timezone | المنطقة الزمنية / Timezone | read-only display | — | device tz | not editable here |

Footer: single **Save settings** button (no cancel — `UnsavedChangesGuard` handles leaving with unsaved edits). Dirty state is computed by comparing the current input JSON against a baseline snapshot.

### Components used

`Screen`, `Section`, `Surface`, `FigmaSwitch`, `TimeField`, `Button`, `StatusBadge`, `GlyphChip`, `ThemedText`, `LtrText`, `UnsavedChangesGuard`, `PushStatusCard`, `CircleTimezoneCard`, `TimezonePicker`. Hooks: `useNotificationPreferences`, `useUpsertPreferences`, `usePushRegistration`, `useMissedDoseGrace`, `useSetMissedDoseGrace`, `useCircleSelection`.

### Role / permission gating

- **Push status, scope, per-category toggles, quiet hours, timezone display, local test, personal Save**: available to every signed-in member.
- **Circle timezone editing**: managers only (`activeCircle.canManage`); others read-only.
- **Missed-dose grace card**: rendered only for managers (`activeCircle && activeCircle.canManage`); collaborators never see it.
- **Local test section**: hidden on web (`pushSupport() !== 'web-unsupported'`). The DEV action-button test is `__DEV__`-only.

---

## Shared component: ReminderNotice (`reminder-notice.tsx`)

Not a screen — a tappable hint banner placed on the medications / tasks / appointments centers to explain that reminders come from settings (preferences are user/circle-level, not per row).

- Renders an `InfoBanner` (tone `info`): a tone chip + the caller-supplied message (`messageKey`) + an action line «إدارة إعدادات الإشعارات ›» / "Manage notification settings ›" (`notifications.manageLink` + chevron glyph).
- Tapping the whole banner pushes `/notification-settings`. `accessibilityLabel` = `notifications.manageLink`.

## Shared component: InfoBanner (`info-banner.tsx`)

The calm tinted notice primitive used by `ReminderNotice` (and elsewhere). A `Surface` toned to `info`/`warning`/`neutral`/`accent` (neutral → `sunken`, `textSecondary` text), no border, with a small `GlyphChip` + `small` message text and an optional bold action line. Tappable when `onPress` is given.

---

## The notification action / push model (background, no dedicated screen)

The `NotificationObserver` (`notification-observer.tsx`, mounted once in the authenticated shell via `(app)/_layout.tsx:32`) is headless — it installs the foreground handler, received/response listeners, launch/resume token refresh, and tap routing (`hooks.ts` `useNotificationObservers`). Designers should understand the behaviors it drives, since they define the notification's OS-level appearance:

### Actionable push buttons

Registered categories (`push-registration.ts:154-235`) attach up to two action buttons to reminder pushes. **RTL order**: snooze is registered first (renders LEFT), complete second (renders RIGHT — the primary action at the start/right for Arabic).

- **«تم» / "Done"** (`notifications.actions.completeButton`) — action id `complete`. Opens the app and runs the safe, type-specific completion (`actions.ts` `completeForNotification`): completes a task, records a dose as "given", marks a visit/appointment completed. Only attached to the four completable categories (medication, task, visit, appointment). If the payload lacks the context to act safely (or the type isn't completable), it falls back to opening the detail screen instead of guessing.
  - On success it shows a native alert titled «تم» / "Done" (`notifications.actions.doneTitle`) with a per-type message: task «تم إكمال المهمة» / "Task completed"; dose «تم تسجيل الجرعة» / "Dose recorded"; visit «تم تسجيل الزيارة» / "Visit recorded"; appointment «تم تسجيل الموعد» / "Appointment recorded"; generic «تم» / "Done" (`notifications.actions.done.*`).
- **«ذكرني بعد ٥ دقائق» / "Remind me in 5 min"** (`notifications.actions.snoozeButton`) — action id `snooze_5`. Reschedules the same reminder locally 5 minutes out (reusing title/body/deep-link/category), then shows an alert «تم» / "Done" + «سيصلك تذكير بعد ٥ دقائق» / "We'll remind you in 5 minutes" (`notifications.actions.snoozeConfirm`). The generic category carries snooze only. Fallback title/body if the source had none: «سند» / "Sanad" and «حان موعد تذكير جديد» / "A new reminder is due" (`notifications.actions.fallbackTitle` / `fallbackBody`).
- **Body tap** (default / unknown action): the existing deep-link routing via `useOpenNotification`.

Category ids (device ↔ server): `sanad_medication_reminder`, `sanad_task_reminder`, `sanad_visit_reminder`, `sanad_appointment_reminder`, `sanad_generic_reminder`.

**Known limitation** documented in code: a *backgrounded remote* push is rendered by Android as an FCM notification message without applying the category, so its action buttons may not render — the MVP accepts this to keep reminder delivery reliable. Locally-built notifications (snooze, test) always render buttons.

### Foreground behavior

While the app is open, a received reminder shows a banner + is added to the list, but plays **no sound** and churns **no badge** (`push-registration.ts:45-56`). The inbox live-refreshes on receipt.

### Registration lifecycle

- Permission is prompted **only** on the explicit "Enable notifications" tap (`enable()` → `requestPermission()`). Launch/resume `refresh()` re-registers quietly **only if already granted** — never prompts.
- Device token is registered via `register_push_token` RPC; disable deactivates it. The raw token is never logged. The device also stores its IANA timezone on the user's global preferences (best-effort) so quiet hours use the right local time.
- Support states: `supported` (real iOS/Android device), `web-unsupported`, `no-device` (simulator). Enable results feed the push card status line.

---

## Workflows

### 1. Open a notification and act on it (in-app)
1. From Home, tap the **bell** (badge shows unread count, capped at «9+»). → `/notifications`.
2. The inbox lists notifications recent-first; unread rows are tinted/bold with a dot, and an unread banner + "mark all read" appear.
3. Tap a row → it is marked read, the active circle is switched if the notification belongs to another circle you still belong to (else you stay in the inbox), and you deep-link to the relevant screen (medication/task/appointment/visit/daily-log/emergency/claim feed).
4. If more than one page exists, tap **«تحميل المزيد» / "Load more"** to extend the list.

### 2. Mark all notifications read
1. On `/notifications` with at least one unread, tap **«قراءة الكل» / "Mark all read"** (header trailing).
2. All notifications are marked read (no confirmation); the unread banner and the Home bell badge clear.

### 3. Turn on push notifications
1. Open Account → **Notification settings**, or tap the **ReminderNotice** banner on a center screen.
2. In the **push status card**, tap **«تفعيل الإشعارات» / "Enable notifications"**.
3. The OS permission prompt appears; on grant, the device token registers and the card flips to the success badge «الإشعارات مفعّلة على هذا الجهاز.». On deny/unsupported, the corresponding result line explains what to do.

### 4. Choose which reminders to receive
1. On **Notification settings**, pick a **scope** chip (global default or a specific circle).
2. Toggle any of the nine categories (e.g. turn off «تحديثات الرعاية»).
3. Tap **«حفظ الإعدادات» / "Save settings"**. A polite «تم حفظ الإعدادات» confirms; leaving with unsaved edits triggers the unsaved-changes guard.

### 5. Set quiet hours
1. On **Notification settings**, enable **«ساعات الهدوء» / "Quiet hours"**.
2. Set **«من» / "From"** and **«إلى» / "To"** times (24-hour). Quiet hours may cross midnight.
3. Save. If either bound is missing/invalid, «حدّد وقت بداية ونهاية لساعات الهدوء.» blocks the save until fixed.

### 6. Adjust missed-dose grace (managers only)
1. On **Notification settings** (as a manager of the active circle), scroll to **«مهلة الجرعة الفائتة»**.
2. Use minus/plus to set the grace in 5-minute steps; the tier hint shows when the responsible person and managers are alerted.
3. Tap **«حفظ الإعدادات»** (enabled only when changed); «تم حفظ المهلة» confirms.

### 7. Complete a reminder from the notification (actionable push)
1. A reminder push arrives (e.g. a medication dose). It shows «ذكرني بعد ٥ دقائق» (left) and «تم» (right).
2. Tap **«تم»** → the app opens and records the safe domain outcome (dose given / task complete / visit or appointment completed). A «تم» alert confirms the specific outcome.
3. If the payload can't be acted on safely, you land on the item's detail screen to finish manually instead.
4. Or tap **«ذكرني بعد ٥ دقائق»** → the same reminder is rescheduled locally 5 minutes out, confirmed with «سيصلك تذكير بعد ٥ دقائق».

### 8. Send a local test notification
1. On **Notification settings** (native device), under **«اختبار على هذا الجهاز»**, tap **«إرسال إشعار تجريبي»**.
2. A local notification («اختبار سند» / "Sanad test") arrives in ~5 seconds, on this device only; the feedback line reads «تمت جدولة الإشعار التجريبي.».

---

## Gaps / cross-domain notes

- **Double header on the inbox**: the notifications route shows both a native stack title and the in-screen `FigmaHeader`. Flagged as a likely redesign target; documented as-is.
- **`circleTimezone.*` copy** (Circle timezone card) and the **`missedDoseGrace` min/max/step constants** live outside the four assigned namespaces (`circle-selection` feature). Exact numeric bounds (`MISSED_DOSE_GRACE_MIN/MAX/STEP`) were not opened; step is ±5 min per the UI. Full circleTimezone strings belong to the circle-settings domain.
- **Three preference columns without UI toggles** (`assignmentAlerts`, `activityUpdates`, `availableToClaimDigest`): intentionally hidden (deferred producers), but persisted. A future redesign may surface them once their producers ship.
- The server composes each notification's `title`/`body`; this domain never generates that copy, so those exact strings are not in the client i18n files.
