# Appointments

The Appointments domain lets a care circle coordinate medical and family appointments for the person receiving care: a doctor visit, a lab draw, a pharmacy run, physiotherapy, home care, a family gathering, or a general appointment. It is explicitly a **coordination** tool, not a medical one — every form and read-only screen carries a non-diagnostic disclaimer. The domain has three routes under a nested stack: a **center/list** (`/appointments`) with an Upcoming/Completed segmented control, an **add** form (`/appointments/new`, managers only), and a **detail/edit** screen (`/appointments/[id]`) that renders either a full editor (managers) or a read-only card with an optional outcome control (the assigned member). Appointments carry a title, a type, a start (required) and optional end time, a location, an optional linked doctor, an optional responsible member, notes, and a status (`scheduled` / `completed` / `cancelled`). All copy is i18n-driven; both the modern `appointments.*` namespace and a `figma.appointments.*` namespace (used only by the list) are quoted below in Arabic and English.

Everything renders RTL, IBM Plex Sans Arabic, and reads design tokens through `useTheme()`. Permission gating comes from the `CircleGate` render-prop, which supplies `circleId`, `canManage` (admin / primary caregiver), and `canLogDoses` (passed down as `canCollaborate`).

---

## Route stack & shared chrome

**`src/app/(app)/appointments/_layout.tsx`** defines a nested Expo Router `Stack` anchored to `index` (`unstable_settings.initialRouteName = 'index'`). Native header is themed (background = theme background, no shadow) and titled per screen:

| Route | Native title key | Arabic | English |
|---|---|---|---|
| `index` | `appointments.title` | «المواعيد» | "Appointments" |
| `new` | `appointments.addTitle` | «إضافة موعد» | "Add appointment" |
| `[id]` | `appointments.detailTitle` | «تفاصيل الموعد» | "Appointment details" |

Note: both the list and the two form screens set `Stack.Screen options={{ headerShown: false }}` and draw **their own** header (`FigmaHeader` / `FigmaFormScreen`), so the native title only ever shows for a brief moment / for the read-only detail is also replaced. The layout titles are effectively the fallback.

---

## Screen 1 — Appointments center (list)

- **Route & how reached**: `/appointments` (`src/app/(app)/appointments/index.tsx` → `CircleGate` → `FigmaAppointments`). Reached from the app's primary navigation / Home quick-actions (appointments is 3rd in the canonical feature order medications → tasks → appointments → …). It is the back-anchor of the nested stack.
- **Purpose**: Show the circle's upcoming appointments and its completed history, and let managers add a new one.
- **Component**: `src/features/appointments/figma-appointments.tsx` (`FigmaAppointments`).

### Layout, top to bottom

1. **Header** (`FigmaHeader`, `figma-header.tsx`): round 44dp back pill on the start edge (arrow, `common.back` = «رجوع» / "Back"), centered title `figma.appointments.title` = «المواعيد» / "Appointments", and — **only when `canManage`** — a round teal "+" add button on the end edge. Add button label `appointments.add` = «إضافة موعد» / "Add appointment"; tapping it navigates to `/appointments/new`. Non-managers see an empty spacer where the "+" would be.
2. **Segmented tabs** (`FigmaSegmentedTabs`): two equal-width, ≥44dp pills — active = filled teal, inactive = card + hairline.
   - `figma.appointments.tabs.upcoming` = «القادمة» / "Upcoming"
   - `figma.appointments.tabs.completed` = «المنتهية» / "Completed"
   - Default active tab: `upcoming`.
3. **Body** — one of: skeleton, error card, empty state, or the card list (below).

### Data sources & scoping

- Upcoming tab reads `useUpcomingAppointments(circleId)` → `fetchUpcomingAppointments`: all `care_appointments` for the circle with `starts_at >= startOfTodayInstant()`, ordered `starts_at` ascending (soonest first). Then filtered to `status === 'scheduled'`.
- Completed tab reads `useCompletedAppointments(circleId, enabled = tab==='completed')` (lazy — only fetches once the tab is opened) → `fetchCompletedAppointments`: `status === 'completed'` across **all** dates, ordered `starts_at` descending (newest first). Filtered again to `status === 'completed'`.
- **Cancelled appointments are intentionally never shown in the list** (no tab).
- **"Mine / all" scoping** (`figma-appointments.tsx:84`): `scopeToMine = !canManage && canCollaborate`. A collaborating non-manager (family member) sees **only** appointments where `assigned_to === userId`; managers and read-only members see all. This is UI scoping only; RLS is unchanged. There is **no visible «مهامي / كل المهام» toggle** on this screen and **no inline «أنا متكفّل» claim** — scoping is implicit by role.

### States

- **Loading**: `<SkeletonList />` (`appointmentsQuery.isLoading`).
- **Error**: a `Surface` card (`tone="card"`, `Radius.lg`, padded 20) with `appointments.loadError` in `errorFg`, and a teal retry `Pressable` labeled `retry`.
  - `appointments.loadError` = «تعذّر تحميل المواعيد. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load appointments. Check your connection and try again."
  - `retry` = «إعادة المحاولة» / "Retry" (re-runs `appointmentsQuery.refetch()`).
- **Empty** (`filtered.length === 0`): `EmptyState` with `iconName="appointment"` and a title only (no subtitle):
  - Upcoming: `figma.appointments.emptyUpcoming` = «لا مواعيد قادمة — الجدول خالٍ الآن» / "No upcoming appointments — the calendar is clear for now".
  - Completed: `figma.appointments.emptyCompleted` = «لا مواعيد منتهية» / "No completed appointments".
- **Populated**: a vertical stack (gap 12) of `AppointmentCard`s.

### Appointment card (`AppointmentCard`)

A `Surface` (`tone="card"`, `Radius.xl`, padded 16) that is pressable — tapping opens `/appointments/${id}` (detail). Accessibility label = the appointment `title`, hint = `common.details` («التفاصيل» / "Details").

Top row:
- **`GlyphChip`** with `iconName="appointment"`, size `md`. Chip accent color cycles by list index through `categoryBlue → categoryPurple → categoryGreen → categoryGold` (purely decorative variety).
- **Title** (`appointment.title`, bold 16, up to 2 lines).
- **Doctor name** (only if `doctor_id` resolves via the doctors map; regular 14) — the resolved `Doctor.name`, not an id.
- **Type line** (`appointments.type.<appointment_type>`, secondary 14). Type labels:

| enum | Arabic | English |
|---|---|---|
| `doctor` | طبيب | Doctor |
| `lab` | تحاليل | Lab |
| `pharmacy` | صيدلية | Pharmacy |
| `therapy` | علاج طبيعي | Therapy |
| `home_care` | رعاية منزلية | Home care |
| `family` | عائلي | Family |
| `general` | عام | General |

- **Status pill** (end of top row) — shown **only when `status === 'completed'`**: `StatusBadge tone="success"` labeled `appointments.status.completed` = «تمّ» / "Completed". Scheduled cards show no pill in the list.

Meta rows (below, gap 6):
- **When** — `Clock` icon (13px) + `«{date}، {time}»`. Date is `ymdFromInstant(starts_at)` (YYYY-MM-DD), time is `hmFromInstant(starts_at)` (HH:MM), each LTR-isolated and joined by an Arabic comma. Always shown.
- **Location** — `MapPin` icon + `appointment.location` (1 line). Only if a location exists.
- **Assignee** — `Users` icon + the responsible member's display name (from `useMemberLookup`). Only if `assigned_to` is set. Self resolves to «أنا» / "Me"; others to full name (never a bare email).

### Components used

`FigmaScreen`, `FigmaHeader`, `FigmaSegmentedTabs`, `SkeletonList`, `Surface`, `EmptyState`, `GlyphChip`, `StatusBadge`, `isolateLtr`. Hooks: `useUpcomingAppointments`, `useCompletedAppointments`, `useDoctors`, `useMemberLookup`.

### Cross-links

- "+" → `/appointments/new` (managers only).
- Card tap → `/appointments/[id]`.

---

## Screen 2 — Add appointment (form)

- **Route & how reached**: `/appointments/new` (`src/app/(app)/appointments/new.tsx`). Reached from the list header "+" (managers only).
- **Purpose**: Create a new appointment for the circle.
- **Gating**: `CircleGate` → if **not** `canManage`, the screen renders a centered `EmptyState` titled `appointments.managersOnly` = «إضافة المواعيد متاحة للمشرف ومقدّم الرعاية الأساسي فقط» / "Only the admin and primary caregiver can add appointments" (no form). If `canManage`, the native header is hidden and `AppointmentForm` renders.
- **Component**: `src/features/appointments/appointment-form.tsx` (`AppointmentForm`) → composes `FigmaFormScreen` + `FigmaAppointmentFields`.

### Layout, top to bottom (`FigmaFormScreen`)

1. **Header** (form-style): round 44dp back pill (arrow) that calls `router.back()`, stacked title (`appointments.addTitle` = «إضافة موعد» / "Add appointment"), hairline divider under it.
2. **Muted note** (`FigmaMutedNote`): `appointments.disclaimer` = «تنظيم مواعيد الرعاية وتنسيقها بين أفراد العائلة فقط، دون أي نصيحة طبية.» / "For organizing and coordinating care appointments among the family only. It does not provide medical advice."
3. **Field cards** (`FigmaAppointmentFields`, grouped into 5 Surface cards — see the field table below).
4. **Footer block** (rendered inline as the last scroll child, not pinned): an optional error line then the primary CTA `FigmaFooterPrimaryButton` labeled `appointments.add` = «إضافة موعد» / "Add appointment".
5. **UnsavedChangesGuard** — active while the draft is dirty and not yet submitted; warns on back-navigation with unsaved edits.

### Form fields (create) — order & spec

Grouped into Surface cards in this order (`figma-appointment-fields.tsx`):

**Card 1 — Main info**

| # | Field | Label (ar / en) | Type | Req | Placeholder (ar / en) | Notes |
|---|---|---|---|---|---|---|
| 1 | Title | `appointments.fields.title` عنوان الموعد / Appointment title | text (`FormField`) | **Yes** (`required` mark) | `appointments.placeholders.title` «مثال: مراجعة طبيب القلب» / "e.g. Cardiology follow-up" | 1–120 chars |
| 2 | Type | `appointments.fields.type` نوع الموعد / Appointment type | single-choice chips (`OptionSelect`) | — | — | 7 options in schema order: doctor, lab, pharmacy, therapy, home_care, family, general. Default `general`. Label rendered as a muted group label above the chips. |

**Card 2 — Date & time** (`FigmaSectionLabel` = `appointments.dateTimeTitle` «التاريخ والوقت» / "Date & time")

| # | Field | Label | Type | Req | Notes |
|---|---|---|---|---|---|
| 3 | Date | `appointments.fields.date` التاريخ / Date | `DateField` wheel picker (year/month/day) | **Yes** (`*`) | No manual typing; opens a `PickerSheet` with Done/Cancel/Clear. Stores `YYYY-MM-DD`. |
| 4 | Start time | `appointments.fields.startTime` وقت البدء / Start time | `TimeField` wheel picker (12h + صباحًا/مساءً) | **Yes** (`*`) | Stores 24h `HH:MM`. Shown side-by-side with End time. |
| 5 | End time | `appointments.fields.endTime` وقت الانتهاء / End time | `TimeField`, `clearable` | Optional | May not be before start. |

**Card 3 — Location & doctor**

| # | Field | Label | Type | Req | Placeholder | Notes |
|---|---|---|---|---|---|---|
| 6 | Location | `appointments.fields.location` المكان / Location | text (`FormField`) | Optional | `appointments.placeholders.location` «مثال: مستشفى الملك فهد» / "e.g. King Fahd Hospital" | max 160 |
| 7 | Doctor | `appointments.fields.doctor` الطبيب / Doctor | single-choice chips (`OptionSelect`) | Optional | — | **Only rendered when the circle has ≥1 doctor.** First option `appointments.noDoctor` = «بدون طبيب» / "No doctor" (value `''`), then each real `Doctor.name`. Default `''`. Muted group label above chips. |

**Card 4 — Responsible person** (`MemberSelect`)

| # | Field | Label | Type | Req | Notes |
|---|---|---|---|---|---|
| 8 | Responsible | `assignment.responsible` المسؤول / Responsible | single-choice chips over the circle roster | Optional | Options: `assignment.none` «غير محدد» / "Unassigned" (default), then `assignment.me` «أنا» / "Me" (if the current user is an active doer), then other active doer members by display name. Only active admin / primary_caregiver / family_member are offered. Default unassigned (`''`). |

**Card 5 — Notes**

| # | Field | Label | Type | Req | Placeholder | Notes |
|---|---|---|---|---|---|---|
| 9 | Notes | `appointments.fields.notes` ملاحظات / Notes | multiline text (`FormField multiline`) | Optional | `appointments.placeholders.notes` «تعليمات أو معلومات إضافية...» / "Instructions or additional information..." | max 1000 |

### Validation & error copy

Validation runs on submit via `prepareAppointment` → `appointmentSchema` (zod). Errors render inline under each field:

| Code | Rule | Error key | Arabic | English |
|---|---|---|---|---|
| `title` | title trimmed length ≥ 1 | `appointments.errors.title` | يرجى إدخال عنوان الموعد | Please enter an appointment title |
| `tooLong` | title > 120, location > 160, notes > 1000 | `validation.tooLong` | النص طويل جدًا | This text is too long |
| `date` | must match valid `YYYY-MM-DD` | `appointments.errors.date` | أدخل التاريخ بصيغة YYYY-MM-DD | Enter the date as YYYY-MM-DD |
| `startTime` | must be valid `HH:MM` (also when date+time can't combine) | `appointments.errors.startTime` | أدخل وقت البدء بصيغة HH:MM | Enter the start time as HH:MM |
| `endTime` | end must be `''` or valid `HH:MM` | `appointments.errors.endTime` | أدخل الوقت بصيغة HH:MM | Enter the time as HH:MM |
| `endBeforeStart` | end (if set) must be ≥ start (string compare) | `appointments.errors.endBeforeStart` | وقت الانتهاء قبل وقت البدء | End time is before the start time |
| any other | fallback | `validation.generic` | قيمة غير صحيحة | Invalid value |

On save success the form sets `submitted` and `router.back()`s to the list (no toast). On save failure, an inline `accessibilityRole="alert"` error line shows above the CTA: `appointments.saveFailed` = «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't save your changes. Check your connection and try again."

### Data written

`createAppointment` inserts into `care_appointments` with `circle_id`, all prepared fields, and `created_by = user.id`. Status defaults server-side to `scheduled`. `combineDateTimeToInstant(date, startTime)` → `starts_at` (ISO); end time (if any) → `ends_at`; empty location/notes are nulled. On success invalidates all appointment queries.

### Components used

`FigmaFormScreen`, `FigmaMutedNote`, `FigmaSectionLabel`, `FigmaFieldLabel`, `FigmaFooterPrimaryButton`, `FormField`, `OptionSelect`, `DateField`, `TimeField`, `MemberSelect`, `Surface`, `UnsavedChangesGuard`. Hooks: `useCreateAppointment`, `useDoctors`.

> Note: `appointment-fields.tsx` also exports a parallel `AppointmentFieldset` (labels via `FormField`/`OptionSelect` `label` prop, doctor label via `OptionSelect label`). The screens in scope render **`FigmaAppointmentFields`**, not `AppointmentFieldset`; the latter is the older single-card layout kept for the shared validation helpers (`prepareAppointment`, `defaultAppointmentDraft`, `appointmentDraftFromRow`) it lives alongside.

---

## Screen 3 — Appointment detail / edit

- **Route & how reached**: `/appointments/[id]` (`src/app/(app)/appointments/[id].tsx` → `CircleGate` → `AppointmentEditor`). Reached by tapping any card in the list.
- **Purpose**: View one appointment; managers edit every field + status + delete; the assigned member records its outcome; everyone else views read-only.
- **Component**: `src/features/appointments/appointment-editor.tsx` (`AppointmentEditor` dispatches to `AppointmentEditScreen` for managers or `AppointmentViewScreen` otherwise). The native header is hidden; both variants use `FigmaFormScreen`.

### Load / not-found states

- **Loading**: `<LoadingState />`.
- **Error**: `<ErrorState message={appointments.loadError} retryLabel={retry} onRetry=…/>` — same load-error copy as the list.
- **Not found** (`appointment.data` is null): centered `EmptyState icon={appointment}` titled `appointments.notFound` = «تعذّر العثور على هذا الموعد. ربما حُذف.» / "This appointment couldn't be found. It may have been removed."

### Variant A — Manager editor (`AppointmentEditScreen`, `canManage`)

`FigmaFormScreen` titled `appointments.detailTitle` = «تفاصيل الموعد» / "Appointment details", back → `router.back()`. Layout, top to bottom:

1. **UnsavedChangesGuard** (active while draft dirty).
2. **Muted note**: `appointments.disclaimer` (same non-diagnostic line as the add form).
3. **`FigmaAppointmentFields`** — the exact same 5-card field set as Add, pre-filled from the row via `appointmentDraftFromRow` (splits `starts_at`/`ends_at` back into date + times). Same labels, placeholders, validation, and error copy as the Add form above.
4. **Status card** (`StatusSection`, `canMarkOutcome` + `canReopen` both true here).
5. **Delete card** (`DeleteAppointmentRow`).
6. **Footer block**: an optional status line then `FigmaFooterPrimaryButton` labeled `common.saveChanges` = «حفظ التغييرات» / "Save changes".
   - On success: `appointments.saved` = «تم حفظ التغييرات» / "Changes saved" (green, `accessibilityLiveRegion="polite"`). Marks the draft saved (guard clears).
   - On failure: `appointments.saveFailed` (red, `accessibilityRole="alert"`).

Saving calls `useUpdateAppointment` → `updateAppointment(id, patch)` (updates editable fields only, **not** status).

#### Status card (`StatusSection`)

Header row: label `appointments.fields.status` = «الحالة» / "Status" + a `StatusBadge` reflecting the current status with an icon + text (status is never color-only):

| status | tone | glyph | label key | Arabic | English |
|---|---|---|---|---|---|
| `scheduled` | info | clock | `appointments.status.scheduled` | مجدول | Scheduled |
| `completed` | success | check | `appointments.status.completed` | تمّ | Completed |
| `cancelled` | error | cross | `appointments.status.cancelled` | ملغى | Cancelled |

Actions depend on current status:
- **When `scheduled`** (manager can mark outcome): two side-by-side buttons —
  - `appointments.markCompleted` = «تم الموعد» / "Mark completed" (primary)
  - `appointments.markCancelled` = «تعذّر الموعد» / "Couldn't attend" (secondary)
  - Tapping either enters an **inline two-step confirm** (replaces the buttons): a confirm body, the confirm button (primary for completed, danger for cancelled), and a `common.cancel` = «إلغاء» / "Cancel" button.
    - Completed body: `appointments.confirmCompletedBody` = «هل تريد تعليم هذا الموعد كمكتمل؟» / "Mark this appointment as completed?"
    - Cancelled body: `appointments.confirmCancelledBody` = «هل تريد تعليم هذا الموعد كمتعذّر؟» / "Mark this appointment as not attended?"
  - Confirm calls `useSetAppointmentOutcome` → `set_assigned_appointment_outcome` RPC (writes status only; also refreshes the Care Pulse feed). On error, an inline `accessibilityRole="alert"` line shows `appointments.saveFailed`.
- **When not `scheduled`** (manager, `canReopen`): a single secondary button `appointments.reopen` = «إعادة كمجدول» / "Mark as scheduled" → `useSetAppointmentStatus(status: 'scheduled')` (the manager-only direct update; the outcome RPC deliberately cannot reopen).

#### Delete card (`DeleteAppointmentRow`)

A single danger button `appointments.deleteAppointment` = «حذف الموعد» / "Delete appointment". Tapping enters an **inline two-step confirm**: side-by-side `common.confirmDelete` = «تأكيد الحذف» / "Confirm delete" (danger) and `common.cancel` = «إلغاء» / "Cancel". Confirming calls `useDeleteAppointment` → `deleteAppointment(id)` then `router.back()`. (RLS restricts delete to admin / primary caregiver.)

### Variant B — Read-only view (`AppointmentViewScreen`, non-managers)

`FigmaFormScreen` titled `appointments.detailTitle`, back → `router.back()`. Layout:

1. **Muted note**: depends on whether the viewer is the assigned member —
   - assigned member (`canMarkOutcome`): `appointments.statusOnly` = «يمكنك تحديث حالة الموعد فقط» / "You can update the appointment status only".
   - otherwise: `appointments.readOnly` = «للعرض فقط — لا تملك صلاحية التعديل» / "View only — you don't have permission to edit".
2. **Details card** (`Surface`, read-only rows) — title (bold 18), then label/value rows, each rendered only if it has a value:
   - Type — `appointments.fields.type` / the localized type label.
   - When — `appointments.whenLabel` = «الموعد» / "When" / a single LTR-isolated line: `YYYY-MM-DD HH:MM` or `YYYY-MM-DD HH:MM – HH:MM` when an end time exists.
   - Location — `appointments.locationLabel` = «المكان» / "Location" (only if set).
   - Doctor — `appointments.doctorLabel` = «الطبيب» / "Doctor" / the resolved doctor name (only if a doctor is linked).
   - Responsible — `assignment.responsible` = «المسؤول» / "Responsible" / the member display name (only if assigned).
   - Notes — `appointments.fields.notes` = «ملاحظات» / "Notes" (only if set).
3. **Status card** (`StatusSection`, `canReopen=false`). If the viewer is the assigned member and the appointment is `scheduled`, they get the same mark-completed / couldn't-attend two-step outcome controls (via the outcome RPC). Otherwise the card shows only the status badge (no actions).

`canMarkOutcome = canCollaborate && appointment.assigned_to === user.id`. A read-only member who is not the assignee sees just the status badge — no delete, no edit, no outcome buttons.

### Components used

`FigmaFormScreen`, `FigmaMutedNote`, `FigmaAppointmentFields` (manager), `Surface` read-only rows (viewer), `StatusBadge`, `Button` (status/delete actions), `FigmaFooterPrimaryButton`, `UnsavedChangesGuard`, `LoadingState`/`ErrorState`/`EmptyState`. Hooks: `useAppointment`, `useDoctors`, `useUpdateAppointment`, `useSetAppointmentOutcome`, `useSetAppointmentStatus`, `useDeleteAppointment`, `useMemberLookup`.

### Cross-links

Back → `/appointments` list. No further sub-screens; doctor is shown as a name only (no navigation to the doctor record from here).

---

## Permission matrix (who sees / can do what)

| Capability | Manager (`canManage`) | Assigned collaborator | Other collaborator | Read-only member |
|---|---|---|---|---|
| See list | all appointments | only own (`assigned_to === me`) | only own | all |
| "+" add button / `/new` form | Yes | No (managersOnly gate) | No | No |
| Open detail | full editor | read-only view | read-only view | read-only view |
| Edit fields / save | Yes | No | No | No |
| Mark completed / couldn't attend (scheduled) | Yes | Yes (own only) | No | No |
| Reopen (→ scheduled) | Yes | No | No | No |
| Delete | Yes | No | No | No |

`canCollaborate` is supplied as `circle.canLogDoses` from `CircleGate`. Scoping and affordances are UI-level; the server RLS + the `set_assigned_appointment_outcome` RPC are authoritative.

---

## Workflows

### 1. Browse upcoming vs. completed appointments
1. Open `/appointments`. The **Upcoming** tab (default) loads future `scheduled` appointments, soonest first.
2. A manager / read-only member sees all; a collaborating family member sees only appointments assigned to them.
3. Tap **المنتهية / Completed** to lazily load completed history (all dates, newest first).
4. Empty tabs show the calm empty copy («لا مواعيد قادمة — الجدول خالٍ الآن» / «لا مواعيد منتهية»).

### 2. Add an appointment (manager)
1. On the list, tap the teal **+** (managers only) → `/appointments/new`.
2. Read the non-diagnostic disclaimer note.
3. Enter **title** (required), pick a **type** (default General), pick a **date** and **start time** via wheel pickers (both required); optionally set an **end time** (not before start).
4. Optionally add a **location**, link a **doctor** (only offered if the circle has doctors; "No doctor" = default), choose a **responsible** member (default Unassigned), and add **notes**.
5. Tap **إضافة موعد / Add appointment**. Invalid fields show inline errors and block save; on success the screen returns to the list. A network failure shows «تعذّر الحفظ…» above the button.
6. Backing out with unsaved edits triggers the UnsavedChangesGuard prompt.

### 3. Edit an appointment (manager)
1. Tap a card → `/appointments/[id]` → the full editor (pre-filled).
2. Change any field; validation matches the add form.
3. Tap **حفظ التغييرات / Save changes**. Success shows «تم حفظ التغييرات»; failure shows the save-failed alert. (Saving does not change status.)

### 4. Mark an appointment completed / not attended
1. Open a **scheduled** appointment's detail (manager, or the assigned collaborator).
2. In the Status card tap **تم الموعد / Mark completed** or **تعذّر الموعد / Couldn't attend**.
3. Confirm in the inline two-step («هل تريد تعليم هذا الموعد كمكتمل؟» / «… كمتعذّر؟») or tap Cancel to back out.
4. Confirming records the outcome via the `set_assigned_appointment_outcome` RPC (status only) and refreshes the appointment lists + the Home Care Pulse feed. The badge updates to «تمّ» / «ملغى». Errors surface inline.

### 5. Reopen a closed appointment (manager)
1. Open a completed or cancelled appointment's detail as a manager.
2. In the Status card tap **إعادة كمجدول / Mark as scheduled** → the manager-only direct status update sets it back to `scheduled`.

### 6. Delete an appointment (manager)
1. Open the appointment's detail as a manager.
2. In the Delete card tap **حذف الموعد / Delete appointment**.
3. Confirm the inline two-step (**تأكيد الحذف / Confirm delete**) or Cancel.
4. On confirm the row is deleted and the screen returns to the list.

### 7. View an appointment (read-only member / non-assigned collaborator)
1. Tap a card → the read-only detail card with title, type, when, location, doctor, responsible, notes (each shown only if present).
2. The muted note explains the permission level («للعرض فقط…» or, for the assignee, «يمكنك تحديث حالة الموعد فقط»).
3. The assigned collaborator additionally gets the mark-completed / couldn't-attend controls; everyone else sees only the status badge.
