# Medications, Schedules & Dose Logging

This is Sanad's most complex domain. It is built from **three routed screens** — the medication center (`/medications`), the add-medication form (`/medications/new`), and the medication detail/editor (`/medications/[id]`) — plus one **bottom-sheet modal** for adding/editing a single dose schedule. The center screen has two segmented tabs: **«جرعات اليوم / Today's doses»** (a per-dose log/correct surface computed live from active meds + active schedules + today's logs) and **«كل الأدوية / All medications»** (the medication list with inline schedule chips and an active/stopped badge). The detail screen is a multi-section manager: medication info (editable inline with its own save CTA), an activation toggle, a schedule manager (weekly summary + one card per schedule with activate/deactivate + inline delete + edit-via-modal), and a two-step delete. Everything is Arabic-first RTL, gender-neutral, i18n-driven, and gated by two role capabilities: **`canManage`** (admin / primary_caregiver) may mutate; **`canLog`** (admin / primary_caregiver / family_member / caregiver) may record doses. A calm non-diagnostic disclaimer banner sits on both the add and detail screens: the app records medication times and reminders only, never medical advice.

Dose status is a **3-value enum** — `given` / `postponed` / `missed` — always rendered as **icon + text** (never color-only). An unlogged dose is a calm neutral pill, never framed as a failure.

---

## Role & capability gating (applies throughout)

Resolved by `CircleGate` → `ActiveCircle` (`src/features/circle-selection/permissions.ts`):

| Capability | Roles | Grants |
|---|---|---|
| `canManage` (`canManageCircle`) | `admin`, `primary_caregiver` | Add/edit/delete medications & schedules, activate/deactivate, see the add "+" button, see every dose (unscoped), see the responsible-person line on cards. |
| `canLog` (`canLogDoses`) | `admin`, `primary_caregiver`, `family_member`, `caregiver` | Record/correct a dose status. A non-manager who can log only sees & logs doses for meds they are **responsible for** (`responsible_user_id === userId`). |
| read-only (`remote_member`, etc.) | — | Sees all doses & meds, never gets a Log/Register button; detail screen shows a read-only info card («للعرض فقط — لا تملك صلاحية التعديل» / "View only — you don't have permission to edit"). |

**Visibility posture (transparent circle):** managers see all doses; a logging non-manager is scoped to their own responsibilities (`scopeToMine = !canManage && canLog`, `figma-medications.tsx:99`). This is UI-only scoping; RLS is unchanged. Note: unlike other domains, the "today" tab does **not** render a «مهامي / كل المهام» toggle — the scope is fixed by role.

---

## Screen 1 — Medication center

- **Route:** `/medications` (`src/app/(app)/medications/index.tsx` → `FigmaMedications`, `src/features/medications/figma-medications.tsx`).
- **Reached from:** Home quick-actions / Explore (canonical feature order puts medications first); the app tab/stack. `_layout.tsx` anchors back-navigation here (`initialRouteName: 'index'`).
- **Purpose:** The medication hub — today's doses with inline logging, plus the full medication list.

### Layout, top to bottom

1. **Header** (`FigmaHeader`): round back button (start, `ArrowRight` — RTL "back"), centered title **«الأدوية» / "Medications"** (`medications.title`), and — **managers only** — a round teal **"+"** add button (end) that navigates to `/medications/new`. Its accessibility label is **«إضافة دواء» / "Add medication"** (`medications.add`). Non-managers see an empty 44dp spacer in place of "+".
2. **Summary pill** (`Surface`, card tone): a `GlyphChip` (medication icon, primary tint) + two lines:
   - Title: **«{{given}} من {{total}} جرعات أُعطيت اليوم» / "{{given}} of {{total}} doses given today"** (`figma.medications.summary`). Counts come from `summarizeDoses(visibleDoses)`.
   - Subtitle: **«{{count}} أدوية نشطة» / "{{count}} active medications"** (`figma.medications.activeCount`) — count of active meds.
3. **Segmented tabs** (`FigmaSegmentedTabs`), equal-width, ≥44dp: **«جرعات اليوم» / "Today's doses"** (`figma.medications.tabToday`) and **«كل الأدوية» / "All medications"** (`figma.medications.tabAll`). Active = filled teal; default tab = `today`.
4. **Log-error banner** (conditional): a soft danger-tinted row with an `AlertCircle` icon and text **«تعذّر تسجيل الجرعة. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't record the dose. Check your connection and try again."** (`careCircle.dashboard.today.logFailed`). `accessibilityRole="alert"`.
5. **Content** — depends on tab & state (below).

### States

- **Loading:** `SkeletonList` (skeleton rows) while any of active meds / active schedules / today's logs is loading.
- **Error:** if today's data errors, a `Surface` card with **«تعذّر تحميل الأدوية. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load medications. Check your connection and try again."** (`medications.loadError`) and a teal **«إعادة المحاولة» / "Retry"** button (`retry`).
- **Empty — Today tab:** `EmptyState` card (medication `GlyphChip`) with title **«لا جرعات اليوم» / "No doses today"** (`medications.noDosesTitle`) and subtitle **«يوم هادئ — لا مواعيد دواء مجدولة لهذا اليوم» / "A calm day — no medication times scheduled for today"** (`medications.noDosesSubtitle`).
- **Empty — All tab:** `EmptyState` with title **«لا أدوية بعد» / "No medications yet"** (`medications.noMedsTitle`); subtitle **«يمكن إضافة دواء وموعده للبدء» / "Add a medication and its schedule to get started"** (`medications.noMedsSubtitle`) shown **only to managers**.
- **Populated:** list of dose cards (today) or medication rows (all).

### Today tab — Dose card (`DoseCard`)

Doses are ordered **unlogged first** (stable sort, chronological within group; `figma-medications.tsx:108`). Each card (`backgroundElement`, hairline border):

- **GlyphChip** — medication icon, per-medication accent color (cycled by index through `categoryBlue → categoryGreen → categoryGold → categoryPurple → categoryTeal`).
- **Name** (`dose.medicationName`, wraps to 2 lines, never truncated).
- **Dosage** (`dose.dosage`, own line, if present).
- **Meta row:** a `Clock` icon + scheduled time (`formatHm`, wrapped LTR via `isolateLtr`) + a **`StatusBadge`**:
  - logged → tone from `DOSE_TONE` (given=success, postponed=warning w/ clock icon, missed=error) with label from `medications.status.*` (**«أُعطيت» / "Given"**, **«مؤجَّلة» / "Postponed"**, **«لم تُعطَ» / "Missed"**).
  - unlogged → neutral pill + clock icon, label **«لم تُسجَّل» / "Not logged"** (`figma.medications.doseUnlogged`).
- **Responsible line** (`Users` icon + text), **managers only**: **«المسؤول: {{value}}» / "Responsible: {{value}}"** (`assignment.responsibleValue`; value = «أنا»/"Me", or «name - role», or «غير مسند»/"Unassigned").
- **Action button** (only when `canLog` and (manager **or** the dose is the user's responsibility)):
  - unlogged → filled teal **«تسجيل» / "Log"** (`figma.medications.logAction`).
  - logged → quiet outlined **«تعديل الحالة» / "Edit status"** (`medications.editStatus`).
  - Tapping toggles the inline **dose-action tray** open/closed.

**Dose-action tray** (expands below the card, `backgroundSunken`): three status buttons in order `given → postponed → missed`, each tinted (given=`successFg`, postponed=`warningFg`, missed=`errorFg`) with icon (`Check` / `Clock` / `X`) + label (`medications.status.*`). The currently-selected status is emphasized (higher alpha).

- **First log of an unlogged dose:** a single tap on a status applies immediately (inserts a log).
- **Correcting an already-logged dose:** picking a *different* status shows the **inline bottom-sheet-style confirm** `DoseCorrectionConfirm` (this is the sanctioned "bottom-sheet confirm" pattern for dose-status correction): text **«تغيير الحالة إلى «{{status}}»؟» / "Change status to \"{{status}}\"?"** (`medications.confirmChangeStatus`) + a teal **«حفظ» / "Save"** (`common.save`, shows spinner while pending) and an outlined **«إلغاء» / "Cancel"** (`common.cancel`). Picking the *same* status just closes the tray.
- A failed log surfaces the top-of-screen alert banner (never silently reverts).

**Data written:** `useLogDose` — inserts a `medication_logs` row (circle_id, medication_id, schedule_id, dose_date, scheduled_time, status, recorded_by) when unlogged, or updates the existing log's status + recorded_by + recorded_at when a `logId` exists. On success it also invalidates the Care Pulse feed.

### All tab — Medication row (`MedicationRow`)

One `Pressable` card per active medication (RLS returns active meds only, alphabetical). Tapping opens `/medications/{id}` (accessibility hint **«اضغط للعرض أو التعديل» / "Tap to view or edit"**, `medications.tapToEdit`).

- **Top row:** `GlyphChip` (medication icon, accent color) + name (2-line wrap, bold) + dosage (own line) + **active badge**:
  - active → soft green pill, text **«فعّال» / "Active"** (`figma.medications.active`).
  - inactive → sunken grey pill, text **«غير فعّال» / "Stopped"** (`figma.medications.inactive`).
- **Schedule chips** (wrap row): one chip per distinct (time, day-set) across the med's active schedules. Each chip = `Clock` (primary) + time (LTR) + a short days label: **«كل الأيام» / "Every day"** (`medications.everyDay`) when ≥7 days, else short weekday names joined by «، » (`medications.weekdaysShort.*`: أحد/إثنين/ثلاثاء/أربعاء/خميس/جمعة/سبت).
- **Responsible line** (managers only), same as dose card.

### Components used
`FigmaScreen`, `FigmaHeader`, `Surface`, `GlyphChip`, `FigmaSegmentedTabs`, `StatusBadge`, `SkeletonList`, `EmptyState`, `isolateLtr`/`LtrText`.

### Dose-status enum reference

| Enum | AR label | EN label | Tone / icon (badge) | Tray icon |
|---|---|---|---|---|
| `given` | أُعطيت | Given | success (check) | `Check` / `successFg` |
| `postponed` | مؤجَّلة | Postponed | warning (clock) | `Clock` / `warningFg` |
| `missed` | لم تُعطَ | Missed | error (X) | `X` / `errorFg` |
| _(unlogged)_ | لم تُسجَّل | Not logged | neutral (clock) | — |

---

## Screen 2 — Add medication

- **Route:** `/medications/new` (`src/app/(app)/medications/new.tsx` → `MedicationForm`, `src/features/medications/medication-form.tsx`).
- **Reached from:** the teal "+" in the medication center header (managers only).
- **Purpose:** Create a medication **and its first dose schedule** in one submit.
- **Gating:** managers only. A non-manager who reaches this route sees a centered `EmptyState` with title **«إضافة الأدوية متاحة للمشرف ومقدّم الرعاية الأساسي فقط» / "Only the admin and primary caregiver can add medications"** (`medications.managersOnly`).

### Layout (`FigmaFormScreen` shell)

- **Header:** round back button (start) + stacked title/subtitle: title **«إضافة دواء» / "Add medication"** (`medications.addTitle`), subtitle **«يسجّل التطبيق مواعيد الأدوية فقط» / "The app records medication times only"** (`medications.addSubtitle`) + hairline divider.
- **Gold disclaimer banner:** **«يسجّل التطبيق مواعيد الأدوية التي تُدخلها العائلة وتذكيرات بها فقط، ولا يقدّم أي نصيحة طبية.» / "The app only records the medication schedules and reminders your family enters. It does not provide medical advice."** (`medications.disclaimer`).
- Four `Surface` cards, then the CTA.

### Card 1 — Medication information (`FigmaSectionLabel` «معلومات الدواء» / "Medication information")

| # | Field (`medications.fields.*`) | Type | Req | Placeholder (`medications.placeholders.*`) | Validation / error |
|---|---|---|---|---|---|
| 1 | **اسم الدواء / Medication name** (`name`) | text | **Yes** | «مثال: ميتفورمين» / "e.g. Metformin" | required + ≤120 chars. Empty → **«يرجى إدخال اسم الدواء» / "Please enter the medication name"** (`medications.errors.name`); too long → `validation.tooLong`. |
| 2 | **الجرعة / Dosage** (`dosage`) | text | No | «مثال: 500 ملغ» / "e.g. 500 mg" | ≤80 chars → `validation.tooLong`. |
| 3 | **الشكل الدوائي / Form** (`form`) | text | No | «مثال: حبة، شراب، حقنة» / "e.g. tablet, syrup, injection" | ≤80 chars. |
| 4 | **تعليمات الاستخدام / Usage instructions** (`instructions`) | textarea (multiline) | No | «مثال: تناوَل مع الماء» / "e.g. take with water" | ≤500 chars. |
| — | divider | | | | |
| 5 | **يؤخذ مع الطعام / Take with food** (`fields.withFood`) | `FigmaSwitch` toggle | No | hint **«تذكير بتناوله مع الأكل» / "A reminder to take it with food"** (`medications.withFoodReminder`) | default **off**. |

### Card 2 — Responsible person (`MemberSelect`)

Group label **«المسؤول» / "Responsible"** (`assignment.responsible`) + a single-choice chip group (`OptionSelect`). Options: **«غير محدد» / "Unassigned"** (`assignment.none`, first), then **«أنا» / "Me"** (if the current user is an active doer), then each active doer (admin / primary_caregiver / family_member) by display name. Default = unassigned (`''`).

### Card 3 — Dose schedule (`FigmaSectionLabel` «جدول الجرعات» / "Dose schedule", via `FigmaScheduleFields`)

- **Days of the week** (`FigmaFieldLabel` «أيام الأسبوع» / "Days of the week"): a row of 7 chips, index 0=Sunday..6=Saturday, short labels (أحد…سبت). **Opt-in**: none selected by default; tapping toggles a day (`accessibilityRole="checkbox"`). Below, a toggle link that reads **«كل الأيام» / "Every day"** (`medications.everyDay`) when not all selected, and **«إلغاء تحديد الكل» / "Clear all"** (`medications.clearDays`) when all 7 are selected. Error (needs ≥1 day) → **«اختر يومًا واحدًا على الأقل» / "Choose at least one day"** (`medications.errors.daysRequired`).
- **Dose times** (`FigmaFieldLabel` «أوقات الجرعات» / "Dose times"): a list of `TimeField` wheel-picker rows (default one row at `08:00`). Each row after the first has a round destructive **X** remove button (`common.delete` a11y label). A dashed **«إضافة موعد جرعة» / "Add dose time"** (`medications.addTime`, `Plus` icon) appends an empty row. Help line **«أضف وقتًا آخر إلى الجدول عندما تكون الأيام نفسها.» / "Add another time to a schedule when the days are the same."** (`medications.helpSameDays`).
  - Live **duplicate detection**: repeated HH:MM rows get an error-tinted border/background and show **«هذا الوقت مُدرج بالفعل في هذا الجدول.» / "This time is already in this schedule."** (`medications.errors.duplicateTime`). Save is blocked.
  - Missing times → **«أضف وقتًا واحدًا على الأقل» / "Add at least one time"** (`medications.errors.timesRequired`); bad format → **«أدخل الوقت بصيغة HH:MM» / "Enter the time as HH:MM"** (`medications.errors.timeFormat`).
- **Medication period** (`FigmaFieldLabel` «فترة الدواء» / "Medication period"): two side-by-side `DateField` wheel pickers:
  - **تاريخ البدء / Start date** (`fields.startDate`) — `minDate = today`; default = today. Past → **«لا يمكن اختيار تاريخ في الماضي» / "The date can't be in the past"** (`medications.errors.dateInPast`). Changing start past the current end clears end.
  - **تاريخ الانتهاء / End date** (`fields.endDate`) — clearable, optional; `minDate` = max(today, start). Errors: past → `dateInPast`; before start → **«تاريخ الانتهاء قبل تاريخ البدء» / "End date is before the start date"** (`medications.errors.endBeforeStart`).

### Card 4 — Notes

**ملاحظات إضافية / Additional notes** (`fields.scheduleNotes`), multiline, placeholder **«أي تعليمات خاصة...» / "Any special instructions..."** (`placeholders.scheduleNotes`), ≤500 chars → `validation.tooLong`. (This is the schedule's `notes`, not the medication's.)

### Footer CTA

An error line (if the create fails) **«تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't save. Check your connection and try again."** (`medications.saveFailed`, `role="alert"`), then a full-width filled teal **«إضافة دواء» / "Add medication"** (`medications.add`, `FigmaFooterPrimaryButton`, shows spinner while submitting). The button is never disabled-greyed: an invalid press runs validation and reveals inline errors. On success the screen navigates back (after the unsaved-changes guard releases).

Submit runs `medicationSchema` + `prepareSchedule` (rejects duplicate times, sorts weekdays, defaults start to today, maps empties to null) + add-flow date checks, then `useCreateMedication` → `createMedicationWithSchedule` (inserts the medication, then its first schedule; deletes the medication if the schedule insert fails, since the client can't transact).

### Guards & components
`UnsavedChangesGuard` (prompts on leave when dirty & unsubmitted). Components: `FigmaFormScreen`, `FigmaSectionLabel`, `FigmaFieldLabel`, `FigmaSwitch`, `FormField`, `Surface`, `MemberSelect`/`OptionSelect`, `FigmaScheduleFields`, `TimeField`, `DateField`, `FigmaFooterPrimaryButton`.

---

## Screen 3 — Medication detail / editor

- **Route:** `/medications/[id]` (`src/app/(app)/medications/[id].tsx` → `MedicationEditor`, `src/features/medications/medication-editor.tsx`).
- **Reached from:** tapping a medication row in the "All medications" tab.
- **Purpose:** View / edit one medication, manage its dose schedules, activate/deactivate, delete.

### States
- **Loading:** `LoadingState` (centered spinner) while medication or schedules load.
- **Error:** `ErrorState` — **«تعذّر تحميل الأدوية…»** (`medications.loadError`) + **«إعادة المحاولة»** retry.
- **Not found:** `EmptyState` (medication glyph) **«تعذّر العثور على هذا الدواء. ربما حُذف.» / "Couldn't find this medication. It may have been removed."** (`medications.notFound`).

### Layout (`FigmaFormScreen` shell)
- **Header:** round back + title **«تفاصيل الدواء» / "Medication details"** (`medications.detailTitle`), no subtitle.
- **Gold disclaimer banner** (same `medications.disclaimer` as add).
- Sections vary by role (below).

### Section A — Medication info

**Managers (`MedicationInfoFields`)** — editable, same four fields + the with-food toggle as the add form (card 1), pre-filled from the medication. `FigmaSectionLabel` **«معلومات الدواء» / "Medication information"**. Below it a second `Surface` with the **Responsible person** `MemberSelect`. Then a **footer save block**:
- status line: on success **«تم حفظ التغييرات» / "Changes saved"** (`medications.saved`, `successFg`, polite); on failure **«تعذّر الحفظ…» / "Couldn't save…"** (`medications.saveFailed`, `errorFg`, `role="alert"`).
- CTA: full-width teal **«حفظ التغييرات» / "Save changes"** (`common.saveChanges`, `FigmaFooterPrimaryButton`). Saves via `useUpdateMedication` (updates name/dosage/form/instructions/with_food/responsible_user_id). Guarded by `UnsavedChangesGuard` on dirty.
- **Note:** unlike the add form, there is **no schedule editing here** — the info save belongs to the info section; schedules are managed live below.

**Read-only members (`ReadOnlyMedicationInfo`)** — a muted note **«للعرض فقط — لا تملك صلاحية التعديل» / "View only — you don't have permission to edit"** (`medications.readOnly`), then a `Surface` card listing: name (title), and `InfoRow`s for **الجرعة/Dosage**, **الشكل الدوائي/Form**, **يؤخذ مع الطعام/Take with food** (value «نعم»/"Yes" or «لا»/"No"), **المسؤول/Responsible** (resolved name), **تعليمات الاستخدام/Usage instructions** — each only when present.

### Section B — Activation toggle (`ActivationRow`, managers only)

A `Surface` card:
- status label: **«الدواء فعّال» / "Active"** (`medications.activeLabel`) or **«غير فعّال» / "Inactive"** (`medications.inactiveLabel`).
- error line (if toggle fails): **«تعذّر تغيير حالة الدواء…» / "Couldn't change the medication status…"** (`medications.toggleFailed`, `role="alert"`).
- a secondary `Button`: **«إيقاف» / "Deactivate"** (`medications.deactivate`) when active, else **«إعادة تفعيل» / "Reactivate"** (`medications.reactivate`).

**Confirmation (`confirmAction`):** deactivating shows title **«إيقاف الدواء؟» / "Deactivate medication?"** (`confirmDeactivateTitle`), message **«ستتوقّف تذكيرات هذا الدواء حتى تعيد تفعيله.» / "Reminders for this medication will stop until you reactivate it."** (`confirmDeactivateMessage`), confirm **«إيقاف» / "Deactivate"**, cancel **«إلغاء» / "Cancel"**, `destructive`. Reactivating: title **«إعادة تفعيل الدواء؟» / "Reactivate medication?"**, message **«ستُستأنف تذكيرات هذا الدواء وفق جداوله.» / "Reminders for this medication will resume on its schedules."**, confirm **«إعادة تفعيل»**. Runs `useSetMedicationActive`.

### Section C — Dose schedules manager (`SchedulesManager`)

- Section heading **«جداول الجرعات» / "Dose schedules"** (`medications.dosesSectionTitle`, `role="header"`).
- Muted help **«يمكن أن يكون للدواء أكثر من جدول — مثلاً كل يوم الساعة 08:00، بالإضافة إلى الأحد والثلاثاء والخميس الساعة 23:00.» / "A medication can have more than one schedule — for example every day at 08:00, plus Sunday, Tuesday and Thursday at 23:00."** (`medications.scheduleGroupsHelp`).
- Action-error line (if delete/toggle fails): **«تعذّر تحديث جدول الجرعات…» / "Couldn't update the dose schedule…"** (`medications.scheduleActionFailed`, `role="alert"`).
- **Weekly summary** (`ScheduleSummary`) when ≥1 schedule — see below.
- **Empty:** `EmptyState` **«لا جداول جرعات بعد. يمكن إضافة جدول للبدء.» / "No dose schedules yet. Add one to get started."** (`medications.noSchedules`).
- Otherwise, one **`ScheduleCard`** per schedule (all schedules, active + inactive, oldest first).
- **Managers:** a secondary **«إضافة جدول جرعات جديد» / "Add a new dose schedule"** button (`medications.addScheduleAtMed`) opening the schedule modal, plus muted help **«أنشئ جدولاً جديدًا عندما تختلف الأيام.» / "Create a new schedule when the days are different."** (`medications.helpDifferentDays`).

**Weekly summary card (`ScheduleSummary`)** — `Surface` titled **«ملخّص أسبوعي» / "Weekly summary"** (`medications.summary.weeklyTitle`). One line per distinct day-set unioning its times, formatted **«{{days}}: {{times}}»** (`medications.summary.line`; e.g. "كل الأيام: 08:00"). A toggle link **«عرض الجرعات لكل يوم» / "Show doses per day"** (`summary.showPerDay`) ↔ **«إخفاء الجرعات لكل يوم» / "Hide doses per day"** (`summary.hidePerDay`) expands a per-weekday breakdown (each weekday full name + its unique sorted times, or «—» `summary.perDayNone`). Only **active** schedules are summarized.

**Schedule card (`ScheduleCard`)** — `Surface`:
- header: **«الجدول {{number}}» / "Schedule {{number}}"** (`medications.scheduleNumber`) + a `StatusBadge`: active → success **«فعّال» / "Active"** (`medications.scheduleActiveLabel`); inactive → neutral **«موقوف» / "Stopped"** (`medications.scheduleStoppedLabel`).
- `InfoRow`s: **أيام الأسبوع/Days of the week** (`fields.days`; «كل الأيام» or short weekdays joined «، »), **أوقات الجرعات/Dose times** (`fields.times`; times joined «، »), **تاريخ البدء/Start date** (`fields.startDate`; shows `start — end` when an end exists, else **«من {{start}}» / "From {{start}}"** via `medications.fromDate`), and **ملاحظات إضافية/Additional notes** (`fields.scheduleNotes`) if present.
- **Managers** get a row of actions:
  - secondary **«إيقاف»/«إعادة تفعيل»** (deactivate/reactivate) — same `confirmAction` pattern, schedule-specific copy: **«إيقاف جدول الجرعات؟» / "Deactivate dose schedule?"** (`confirmScheduleDeactivateTitle`) / message **«ستتوقّف تذكيرات هذا الجدول حتى تعيد تفعيله.» / "Reminders for this schedule will stop until you reactivate it."** (`confirmScheduleDeactivateMessage`); reactivate: **«إعادة تفعيل جدول الجرعات؟» / "Reactivate dose schedule?"** + **«ستُستأنف تذكيرات هذا الجدول.» / "Reminders for this schedule will resume."**. Runs `useSetScheduleActive`.
  - **`ItemActions`** — inline **edit** (`common.edit` «تعديل») opens the schedule modal in edit mode; **delete** (`common.delete` «حذف») uses the **inline two-step confirm** (swaps to **«تأكيد الحذف» / "Confirm delete"** `common.confirmDelete` + **«إلغاء» / "Cancel"** in place). Runs `useDeleteSchedule`.

### Section D — Delete medication (`DeleteMedicationRow`, managers only)

A `Surface` with an **inline two-step** delete: initial danger `Button` **«حذف الدواء» / "Delete medication"** (`medications.deleteMedication`); tapping swaps to a danger **«تأكيد الحذف» / "Confirm delete"** (`common.confirmDelete`) + secondary **«إلغاء» / "Cancel"** pair. On confirm `useDeleteMedication` runs and navigates back; failure surfaces **«تعذّر حذف الدواء…» / "Couldn't delete the medication…"** (`medications.deleteFailed`, `role="alert"`).

### Components used
`FigmaFormScreen`, `FigmaSectionLabel`, `FigmaMutedNote`, `FigmaSwitch`, `FormField`, `Surface`, `MemberSelect`, `Button`, `StatusBadge`, `ItemActions`, `EmptyState`/`ErrorState`/`LoadingState`, `ScheduleSummary`, `ScheduleModalHost`, `UnsavedChangesGuard`, `FigmaFooterPrimaryButton`.

---

## Modal — Add / edit a dose schedule (`ScheduleModalHost` + `FormModal`)

- **Opened from:** the medication detail's "Add a new dose schedule" button (add mode) or a schedule card's edit (edit mode). Managers only.
- **Chrome (`FormModal`):** bottom-sheet with `backgroundElement` card, top-rounded corners, hairline border, an 8dp grab handle, a `sectionTitle`, a header **close** button (`Glyph.cross`, a11y `common.close` «إغلاق»), a scrollable body, and a footer of a forced full-width teal submit + a secondary cancel. **No backdrop-tap dismissal** — closing is explicit.
- **Title:** add → **«إضافة جدول جرعات» / "Add dose schedule"** (`medications.addScheduleTitle`); edit → **«تعديل جدول الجرعات» / "Edit dose schedule"** (`medications.editScheduleTitle`).
- **Submit label:** add → **«إضافة جدول جرعات» / "Add dose schedule"** (`medications.addScheduleSubmit`); edit → **«حفظ تغييرات جدول الجرعات» / "Save schedule changes"** (`medications.saveScheduleChanges`). Cancel = **«إلغاء» / "Cancel"** (`common.cancel`).

### Body (`ScheduleFields` — the classic, non-Figma variant)

Note: the modal uses `ScheduleFields` (`schedule-fields.tsx`), a slightly different rendering than the add-form's `FigmaScheduleFields`, though field logic matches:
- **Days** via the shared **`WeekdaySelector`** (multi-select checkboxes): a full-width **«كل الأيام» / "Every day"** chip (selects all / clears all), then 7 short-label chips; a selected chip shows a leading check glyph. Opt-in (none selected by default in add). Error → `medications.errors.daysRequired`.
- **Dose times** (`fields.times`): `TimeField` rows; each extra row has a secondary **«حذف» / "Delete"** button; a secondary **«إضافة وقت آخر لهذا الجدول» / "Add another time to this schedule"** (`medications.addTimeToSchedule`) appends. Help **«أضف وقتًا آخر…»** (`helpSameDays`). Duplicate rows highlight + show `medications.errors.duplicateTime`.
- **Start date** (`DateField`) and **End date** (`DateField`, clearable). Errors: format → `medications.errors.dateFormat`; end-before-start → `medications.errors.endBeforeStart`. (The modal variant does not apply the add-flow "no past dates" min-date constraint — it's edit-tolerant so historical schedules keep working.)
- **Notes** (`FormField`, multiline, `placeholders.scheduleNotes`).

### Submit behavior
`prepareSchedule` validates/normalizes. Then `findScheduleConflicts` blocks a weekday+time slot that already exists in **another active** schedule of the same medication (self excluded); the first conflict shows **«{{day}} الساعة {{time}} موجود بالفعل في جدول نشط آخر.» / "{{day}} at {{time}} is already in another active schedule."** (`medications.errors.conflict`). Overlapping days at *different* times are allowed. On success, `useCreateSchedule` (add) or `useUpdateSchedule` (edit) runs and the modal closes; failure shows **«تعذّر الحفظ…» / "Couldn't save…"** (`medications.saveFailed`).

### Discard guard
If the draft is dirty, closing prompts `confirmDiscard`: title **«تغييرات غير محفوظة» / "Unsaved changes"** (`common.unsavedTitle`), message **«لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟» / "You have unsaved changes. Leave without saving?"** (`common.unsavedMessage`), confirm **«تجاهل التغييرات» / "Discard changes"** (`common.discardChanges`), cancel **«متابعة التعديل» / "Keep editing"** (`common.keepEditing`).

---

## Data model & computations

**`medications`** row: `name`, `dosage`, `form`, `instructions`, `with_food` (bool), `responsible_user_id`, `is_active`, `circle_id`. **`medication_schedules`** row: `days_of_week` (int[], 0=Sun..6=Sat), `times` (`HH:MM[:SS]`[]), `start_date`, `end_date` (nullable), `notes`, `is_active`, `medication_id`, `circle_id`. **`medication_logs`** row: `medication_id`, `schedule_id`, `dose_date`, `scheduled_time`, `status` (enum given/postponed/missed), `recorded_by`, `recorded_at`.

**Today's doses** (`computeDoseItems`, `today.ts`): pure/deterministic. A schedule contributes one dose per distinct `time` when its medication is active, `date` ∈ [start_date, end_date], and the date's weekday ∈ `days_of_week`. Duplicate times within a schedule are collapsed (legacy defense). A dose's status comes from a matching log keyed `${schedule_id}|${scheduled_time}`. Items sort by time, then medication name. Date/time math uses the device's **local** calendar (no timezone conversion). `summarizeDoses` yields `{ total, given, remaining }`.

**Validation rules** (`schema.ts` + `schedule-validation.ts`): name required ≤120; dosage/form ≤80; instructions/notes ≤500; times strict `HH:MM` (24h) ≥1; days ≥1; dates valid `YYYY-MM-DD` and end ≥ start; no duplicate times within a schedule; no weekday+time conflict with another active schedule.

---

## Workflows

### 1. Log a dose (first time)
1. Open `/medications` → **Today's doses** tab (default).
2. Find the dose card (unlogged doses are listed first, neutral "لم تُسجَّل" pill).
3. Tap the teal **«تسجيل» / "Log"** button → the status tray expands.
4. Tap one of **أُعطيت / مؤجَّلة / لم تُعطَ** → applies immediately (inserts a `medication_logs` row); tray closes; the card's pill and summary count update. A failure shows the top alert banner.

### 2. Correct a logged dose
1. On a logged dose card, tap the outlined **«تعديل الحالة» / "Edit status"**.
2. Pick a *different* status → an inline confirm appears: **«تغيير الحالة إلى «…»؟»**.
3. Tap **«حفظ» / "Save"** → updates the existing log (recorded_by/recorded_at refreshed). Tap **«إلغاء»** to abort. Picking the same status just closes the tray.

### 3. Add a medication (with first schedule) — managers
1. `/medications` → tap the teal **"+"** → `/medications/new`.
2. Fill **اسم الدواء** (required); optionally dosage/form/instructions; toggle **يؤخذ مع الطعام**.
3. Optionally pick a **Responsible** person.
4. In **جدول الجرعات**: select day chips (or **كل الأيام**), set dose time(s) (add more with **إضافة موعد جرعة**), set the start date (defaults today) and optional end date.
5. Optionally add schedule **notes**.
6. Tap **«إضافة دواء» / "Add medication"**. Invalid input reveals inline errors; a valid submit creates the med + first schedule and returns to the center.

### 4. Add another schedule to an existing medication — managers
1. Open the medication (`/medications/[id]`).
2. Scroll to **جداول الجرعات** → tap **«إضافة جدول جرعات جديد»** → the schedule bottom-sheet opens.
3. Set days, times, dates, notes → tap **«إضافة جدول جرعات»**. A weekday+time collision with another active schedule blocks with the conflict message; otherwise it saves and closes.

### 5. Edit a schedule — managers
1. On a schedule card, tap **«تعديل» (edit)** in `ItemActions` → the sheet opens pre-filled.
2. Change fields → **«حفظ تغييرات جدول الجرعات»**. Closing with unsaved edits prompts the discard dialog.

### 6. Deactivate / reactivate a medication or schedule — managers
1. Medication: on `/medications/[id]`, tap **«إيقاف»/«إعادة تفعيل»** in the activation card → confirm the `confirmAction` dialog (reminders stop/resume). Schedule: tap the same button on a schedule card → confirm its schedule-specific dialog.
2. A deactivated medication drops out of the active list & today's doses; a stopped schedule stops generating doses and is excluded from the weekly summary.

### 7. Delete a schedule — managers
1. On a schedule card, tap **«حذف»** in `ItemActions` → buttons swap to **«تأكيد الحذف» / «إلغاء»** in place.
2. Tap **«تأكيد الحذف»** → the schedule is removed. Failure shows the schedule action-error line.

### 8. Delete a medication — managers
1. On `/medications/[id]`, scroll to the bottom → tap danger **«حذف الدواء»** → it swaps to **«تأكيد الحذف» / «إلغاء»**.
2. Tap **«تأكيد الحذف»** → the medication is deleted and the app navigates back. Failure surfaces **«تعذّر حذف الدواء…»**.

### 9. Read-only view — non-managers
1. Open a medication → see the **«للعرض فقط…»** note and a read-only info card; no edit/toggle/delete/schedule-add controls. Logging non-managers can still log doses (only for meds they're responsible for) back on the center's Today tab.
