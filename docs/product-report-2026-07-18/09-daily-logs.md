# Daily Care Logs

The Daily Care Logs domain is where the family records **observational, non-diagnostic** notes about the care recipient — one log per calendar day per author. A single log bundles up to six structured "observation" fields (mood, sleep quality, appetite, hydration, an observed 0–10 pain level, and mobility) plus four free-text note wells (bathroom, food, activity, general). Every structured field is optional; only the log's **date** is required, and it defaults to today. The domain spans three routes — a list (`/daily-logs`), an add form (`/daily-logs/new`), and a combined detail/edit screen (`/daily-logs/[id]`) that renders either an editable form (managers, or the author) or a read-only view (everyone else). The whole domain leans hard on an **observational framing**: a gold "these are family notes, not a diagnosis" disclaimer appears on the list and on the add/edit screens, and the copy never implies clinical judgement.

A recurring design tension the designer should note: there are **two parallel fieldset implementations** in the codebase. The screens actually render `FigmaDailyLogFields` (`figma-daily-log-fields.tsx`) — the card-grouped, chip + stepper version. The older `DailyLogFieldset` in `log-fields.tsx` (plain `OptionSelect` groups + a row of pain buttons) is **not wired into any screen**; only its draft/validation helpers (`defaultDailyLogDraft`, `dailyLogDraftFromRow`, `prepareDailyLog`, `DailyLogDraft`) are imported. This document describes the live `FigmaDailyLogFields` UI and flags the dead component where relevant.

---

## Shared data model & vocabulary

Every log row (`daily_care_logs`, `api.ts:5`) carries these fields. The list card, detail view, and forms all draw from the same describe helpers (`describe.ts`), so the vocabulary is identical everywhere.

### Structured observation fields (all optional / nullable)

| Field | i18n label (AR / EN) | Type | Allowed values (in display order) | Value copy AR / EN |
|---|---|---|---|---|
| Mood | `dailyLogs.fields.mood` — «المزاج العام» / "General mood" | single-choice chip | great, good, okay, sad, anxious, angry, confused, tired | ممتاز/Great, جيد/Good, مقبول/Okay, حزين/Sad, قلِق/Anxious, غاضب/Angry, مشوّش/Confused, متعب/Tired |
| Sleep quality | `dailyLogs.fields.sleepQuality` — «نوعية النوم» / "Sleep quality" | single-choice chip | good, fair, poor, unknown | جيدة/Good, متوسطة/Fair, سيئة/Poor, غير معروفة/Unknown |
| Appetite | `dailyLogs.fields.appetite` — «الشهية» / "Appetite" | single-choice chip | good, normal, low, none, unknown | جيدة/Good, عادية/Normal, منخفضة/Low, منعدمة/None, غير معروفة/Unknown |
| Hydration | `dailyLogs.fields.hydration` — «ترطيب الجسم» / "Body hydration" | single-choice chip | good, normal, low, unknown | جيد/Good, عادي/Normal, منخفض/Low, غير معروف/Unknown |
| Pain level | `dailyLogs.fields.painLevel` — «مستوى الألم الملاحَظ» / "Observed pain level" | 0–10 stepper + scale chips + a distinct "None" | null (None) or 0..10 | «بدون»/"None"; a number shows as `dailyLogs.painValue` «{{value}} من 10» / "{{value}} of 10" |
| Mobility | `dailyLogs.fields.mobility` — «الحركة والقدرة الجسدية» / "Mobility and physical ability" | single-choice chip | normal, limited, needs_help, bedbound, unknown | طبيعية/Normal, محدودة/Limited, تحتاج مساعدة/Needs help, ملازم للسرير/Bedbound, غير معروفة/Unknown |

Enum orders come from `schema.ts:16-39`. Each chip group is prefixed with an **"unset" option** labelled `dailyLogs.unset` — «غير محدّد» / "Not set" — which maps to `null` on save (`log-fields.tsx:132-136`).

**Pain is special** (`figma-daily-log-fields.tsx:138-219`): `null` ("None"/«بدون») is deliberately distinct from an observed `0`. The scale hint is `dailyLogs.painScaleHint` — «0 = لا ألم ملاحظ، 10 = ألم شديد ملاحظ» / "0 = no observed pain, 10 = severe observed pain". The "of 10" caption is `dailyLogs.painOutOf` — «من 10» / "of 10".

### Free-text note fields (all optional, trimmed, mapped to null when blank)

| Field | Label AR / EN | Max length | Placeholder AR / EN |
|---|---|---|---|
| Bathroom notes | `dailyLogs.fields.bathroomNotes` — «ملاحظات دورة المياه» / "Bathroom notes" | 1000 | «ملاحظات إضافية» / "Additional notes" |
| Food notes | `dailyLogs.fields.foodNotes` — «ملاحظات الطعام» / "Food notes" | 1000 | «ملاحظات إضافية» / "Additional notes" |
| Activity notes | `dailyLogs.fields.activityNotes` — «ملاحظات النشاط» / "Activity notes" | 1000 | «ملاحظات إضافية» / "Additional notes" |
| General notes | `dailyLogs.fields.generalNotes` — «ملاحظات عامة» / "General notes" | 2000 | «ملاحظات إضافية» / "Additional notes" |

Max lengths and the required-date validation live in `schema.ts:47-56`. `log_date` must pass `isValidYmd`; failure yields code `logDate` → `dailyLogs.errors.logDate` «اختر تاريخًا صحيحًا» / "Choose a valid date". Over-length text yields code `tooLong` → `validation.tooLong` «النص طويل جدًا» / "This text is too long". Any other schema issue → `validation.generic` «قيمة غير صحيحة» / "Invalid value".

### Permissions (from `CircleGate` → `ActiveCircle`)
- `canManage` = circle managers.
- `canCollaborate` = `circle.canLogDoses` = caregiving roles (members who may log care).
- **Add** allowed when `canManage || canCollaborate` (`figma-daily-logs.tsx:82`, `new.tsx:17`).
- **Edit** a specific log allowed when `canManage || (canCollaborate && isOwner)`, where `isOwner` = `recorded_by === current user` (`log-editor.tsx:63-64`). Otherwise the log opens read-only.
- **Delete** is offered inside the edit screen only; server RLS restricts it to managers (any log) or the author (own) (`api.ts:75-79`).
- One-log-per-author-per-date is enforced by a DB partial unique index; a `23505` unique-violation on create is surfaced with a specific message (see the add form).

---

## Screen 1 — Daily Logs list

**Route:** `/daily-logs` (`src/app/(app)/daily-logs/index.tsx`). Nested stack anchored at `index` (`_layout.tsx:8`). The native stack header title for this route is `dailyLogs.title` «السجلات اليومية» / "Daily logs" (`_layout.tsx:25`), **but** the rendered `FigmaDailyLogs` draws its own in-body header, so the visible title is `figma.dailylogs.title` «السجل اليومي» / "Daily logs".

**How reached:** the daily-logs entry from Home quick-actions / Explore (canonical feature order places daily logs after visits), and any deep link to `/daily-logs`. `index.tsx` wraps the screen in `CircleGate`, so a missing/loading/errored circle shows the shared circle states first.

**Purpose:** browse all of the circle's daily logs, newest day first, and enter the add flow.

### Layout, top to bottom (`figma-daily-logs.tsx:88-138`)
1. **Header** (`FigmaHeader`): round back button (start, ArrowRight — RTL "back"), centered title «السجل اليومي» / "Daily logs", and — only when the member can add — a round teal **"+"** add button (end) that pushes `/daily-logs/new`. The add button's accessibility label is `dailyLogs.add` «إضافة سجل» / "Add log". If the member cannot add, the trailing slot is an empty 44dp spacer.
2. **Observational disclaimer banner**: a soft primary-tinted rounded box (8% primary fill, 15% primary border) containing `figma.dailylogs.disclaimer` — «هذه ملاحظات عائلية شخصية لمتابعة الحالة فقط. ليست تشخيصاً ولا تقييماً طبياً.» / "These are personal family notes to follow the condition only. They are not a diagnosis or a medical assessment."
3. **Body** — one of: skeleton, error card, empty state, or the list of log cards.

### States
- **Loading:** `<SkeletonList />` (`figma-daily-logs.tsx:106`).
- **Error:** a `Surface` card with `dailyLogs.loadError` «تعذّر تحميل السجلات. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load logs. Check your connection and try again." in error color, and a teal **retry** button labelled `retry` «إعادة المحاولة» / "Retry" that refetches (`figma-daily-logs.tsx:108-116`).
- **Empty:** `EmptyState` with the `dailyLog` feature icon, title `dailyLogs.noTodayTitle` «لا سجلات لهذا اليوم» / "No logs for today". Subtitle depends on permission: if the member can add → `dailyLogs.noTodaySubtitle` «يمكن إضافة سجل لمتابعة حال اليوم» / "Add a log to note how today is going"; if not → `dailyLogs.cannotAdd` «إضافة السجلات متاحة لأعضاء دائرة الرعاية النشطين» / "Recording logs is available to active care circle members" (`figma-daily-logs.tsx:117-122`).
- **Populated:** a vertical stack of **LogCards**, ordered newest log_date first, then newest created_at (`api.ts:44-46`).

### LogCard (`figma-daily-logs.tsx:141-215`)
Each card is a tappable `Surface` (radius xl, 16dp padding). Tapping opens `/daily-logs/{id}`; its accessibility hint is `figma.dailylogs.openHint` «عرض تفاصيل السجل» / "Open log details".

Card contents, top to bottom:
- **Card header row:** the log date as a long localized label (weekday + day + month; Western digits in Arabic via `ar-u-nu-latn`, `figma-daily-logs.tsx:40-52`). If the log is for today, it is prefixed with `figma.dailylogs.todayPrefix` «اليوم، » / "Today, ". On the trailing side, if the current user authored the log, a muted marker `dailyLogs.mineLabel` «سجلك» / "Your log".
- **Structured field rows** (only fields the family actually recorded, from `describeDailyLog`): each row is an **icon + label + value**. Icons/colors per field (`FIELD_VISUAL`, `figma-daily-logs.tsx:30-37`): mood → smile (teal), sleep → moon (purple), appetite → utensils (gold), hydration → droplets (blue), pain → activity (green), mobility → activity (green). The label is the field name (muted), the value is the localized value. Pain renders as «{{value}} من 10» / "{{value}} of 10".
- **Notes-only fallback:** if there are **no** structured fields, the card shows `dailyLogs.notesOnly` «ملاحظات فقط» / "Notes only" (`figma-daily-logs.tsx:198`).
- **Notes wells:** each non-empty free-text note (`describeDailyLogNotes`) renders as a sunken bordered well with a bold label (the note's field name) and the text below.

**Components used:** `FigmaScreen`, `FigmaHeader`, `Surface`, `EmptyState`, `SkeletonList`, lucide icons (Smile/Moon/Utensils/Droplets/Activity), `isolateLtr`. Data via `useDailyLogs(circleId)`.

**Cross-links:** `/daily-logs/new` (add), `/daily-logs/{id}` (detail/edit).

---

## Screen 2 — Add daily log

**Route:** `/daily-logs/new` (`src/app/(app)/daily-logs/new.tsx`). Native stack title `dailyLogs.addTitle` «إضافة سجل يومي» / "Add daily log" (`_layout.tsx:26`), but the screen sets `headerShown: false` and draws its own header (`new.tsx:20`).

**How reached:** the teal "+" in the list header (`figma-daily-logs.tsx:92`).

**Purpose:** create a new observational log for a chosen date.

**Permission gate:** `new.tsx:17` — only `canManage || canLogDoses`. If the member lacks both, the screen shows a centered `EmptyState` with title `dailyLogs.cannotAdd` «إضافة السجلات متاحة لأعضاء دائرة الرعاية النشطين» / "Recording logs is available to active care circle members" (no form).

### Layout (`log-form.tsx` → `FigmaFormScreen` + `FigmaDailyLogFields`)
`FigmaFormScreen` shell (`figma-form-screen.tsx:26-106`):
1. **Header:** round back button (ArrowRight, 44dp pill) + stacked title/subtitle + hairline divider. Title `dailyLogs.addTitle` «إضافة سجل يومي» / "Add daily log"; subtitle `dailyLogs.addSubtitle` «ملاحظات مشاهَدة فقط — ليست تشخيصًا» / "Observations only — not a diagnosis". Back → `router.back()`.
2. **Gold disclaimer banner** (accent bg + accent fg): `dailyLogs.disclaimer` «ملاحظات يومية تُدخلها العائلة لمتابعة الحالة فقط، وليست تشخيصًا أو نصيحة طبية.» / "Daily observations recorded by the family to follow the condition only. They are not a diagnosis or medical advice."
3. **Scrolling card stack** = `FigmaDailyLogFields` (see below).
4. **Inline footer CTA** (rendered as the last block in the scroll flow, not pinned — an Android rendering workaround, `log-form.tsx:76-89`): an error line (when present) above a full-width teal primary button labelled `dailyLogs.add` «إضافة سجل» / "Add log".

An `UnsavedChangesGuard` is armed whenever the draft is dirty and not yet submitted (`log-form.tsx:73`).

### FigmaDailyLogFields — the form cards (`figma-daily-log-fields.tsx`)
Rendered as four `Surface` cards (tone `card`, radius lg, 16dp padding, 16dp inner gap):

**Card A — Date**
- `dailyLogs.fields.logDate` «التاريخ» / "Date" label + a `DateField` (protected wheel date picker). **Required**; default = today (`defaultDailyLogDraft`, `log-fields.tsx:51-53`). Invalid → `dailyLogs.errors.logDate` «اختر تاريخًا صحيحًا» / "Choose a valid date".

**Card B — Daily observations** (`dailyLogs.dailyTitle` «الملاحظات اليومية» / "Daily observations" section label)
Five chip groups separated by hairline dividers, each an `OptionSelect` with a leading «غير محدّد» / "Not set" option:
1. Mood, 2. Sleep quality, 3. Appetite, 4. Hydration, 5. Mobility (labels/values per the shared data-model table above). All default to unset.

**Card C — Observed pain** (`dailyLogs.fields.painLevel` «مستوى الألم الملاحَظ» / "Observed pain level" section label)
- Hint line: `dailyLogs.painScaleHint`.
- A pill "None" chip (`dailyLogs.painNone` «بدون» / "None"), selected by default; when selected it shows a leading check glyph and highlights in primary. Selecting it sets pain = null.
- A **stepper row**: a "−" button, a large center value (`—` when null, else the number) with the caption `dailyLogs.painOutOf` «من 10» / "of 10", and a "+" button. From null, "−"/"+" jump to 0; otherwise clamp to 0..10.
- A **scale row** of 11 small chips 0–10; tapping one sets that exact value and highlights it.
- Pain (0–10, or None) has no separate validation — it is a controlled stepper only.

**Card D — Notes**
Four multiline `FormField`s in order: bathroom, food, activity, general notes (labels/placeholders/max-lengths per the data-model table). All optional; each surfaces `tooLong`/`generic` errors inline.

**Field order (top to bottom):** date → mood → sleep quality → appetite → hydration → mobility → pain → bathroom notes → food notes → activity notes → general notes.

### Submit behaviour (`log-form.tsx:47-65`)
- Validates via `prepareDailyLog`. On validation failure, inline field errors show and submission stops.
- On success, invalidates daily-log queries + the Pulse feed (`hooks.ts:61-66`; a new log is a Care Pulse event), then `router.back()` to the list.
- **Duplicate-date error:** a `23505` unique violation shows `dailyLogs.errors.alreadyLoggedToday` «لديك سجل لهذا التاريخ بالفعل. عدّل السجل الموجود بدلاً من إنشاء سجل جديد.» / "You already have a log for this date. Edit the existing log instead of creating a new one." Any other failure → `dailyLogs.saveFailed` «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't save. Check your connection and try again." The error renders with `accessibilityRole="alert"`.

**Confirmation pattern:** none for create (a plain submit; no destructive action). Cancel = the back button / unsaved-changes guard.

**Components used:** `FigmaFormScreen`, `FigmaSectionLabel`, `FigmaFieldLabel`, `FigmaFooterPrimaryButton`, `Surface`, `OptionSelect`, `FormField`, `DateField`, `Glyph.check`, lucide Minus/Plus, `UnsavedChangesGuard`.

---

## Screen 3 — Daily log detail / edit

**Route:** `/daily-logs/[id]` (`src/app/(app)/daily-logs/[id].tsx`). Native stack title `dailyLogs.detailTitle` «تفاصيل السجل» / "Log details" (`_layout.tsx:27`); the rendered editor/view sets `headerShown: false` and draws its own (`log-editor.tsx:69`).

**How reached:** tapping any LogCard in the list (`figma-daily-logs.tsx:133`).

**Purpose:** view a single log; if permitted, edit or delete it.

### Gate & branching (`log-editor.tsx:33-77`)
- Loading → `LoadingState` (centered spinner).
- Error → `ErrorState` with `dailyLogs.loadError` + retry `retry` «إعادة المحاولة» / "Retry".
- Not found (`log.data` null) → centered `EmptyState`, title `dailyLogs.notFound` «تعذّر العثور على هذا السجل. ربما حُذف.» / "Couldn't find this log. It may have been removed."
- If `canEdit` (`canManage || (canCollaborate && isOwner)`) → **Edit screen**. Otherwise → **View screen**.

### 3a — Edit screen (`DailyLogEditScreen`, `log-editor.tsx:79-190`)
Same `FigmaFormScreen` shell as Add, with:
- Title `dailyLogs.detailTitle` «تفاصيل السجل» / "Log details" (no subtitle).
- Gold disclaimer banner `dailyLogs.disclaimer` (same copy as add).
- The identical `FigmaDailyLogFields` cards, pre-filled from the row (`dailyLogDraftFromRow`, `log-fields.tsx:67-81`).
- **Delete card** (a `Surface`, separate from save): a full-width **danger** button `dailyLogs.deleteLog` «حذف السجل» / "Delete log". Tapping it swaps in an **inline two-step confirm** — two buttons side by side: `common.confirmDelete` «تأكيد الحذف» / "Confirm delete" (danger) and `common.cancel` «إلغاء» / "Cancel" (secondary). Confirming calls delete then `router.back()`. On delete failure the confirm does **not** silently reset; instead `dailyLogs.deleteFailed` «تعذّر حذف السجل. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't delete the log. Check your connection and try again." shows with `accessibilityRole="alert"`.
- **Save footer:** a success line `dailyLogs.saved` «تم حفظ التغييرات» / "Changes saved" or an error line `dailyLogs.saveFailed` (same copy as add), above the full-width teal `common.saveChanges` «حفظ التغييرات» / "Save changes" button. Save validates, updates, and calls `markSaved()` (clears the unsaved-changes guard) but stays on the screen.
- `UnsavedChangesGuard` armed while dirty.

**Confirmation patterns present:** inline two-step confirm (delete); save is a plain submit surfacing success/failure.

### 3b — View screen (read-only, `DailyLogViewScreen`, `log-editor.tsx:202-242`)
Shown to members who cannot edit. `FigmaFormScreen` with title `dailyLogs.detailTitle`, **no gold banner** (calm), and no footer. Body:
- Two muted notes: `dailyLogs.disclaimer` and `dailyLogs.readOnly` «للعرض فقط — لا تملك صلاحية التعديل» / "View only — you don't have permission to edit".
- **Date card:** section label `dailyLogs.fields.logDate` «التاريخ» / "Date" + the raw `log_date` (LTR-isolated).
- **Observations card** (only if any structured fields): section label `dailyLogs.dailyTitle` «الملاحظات اليومية» / "Daily observations" + one read-only label/value row per recorded field (`describeDailyLog`).
- **Notes card** (only if any notes): one read-only label/value row per note (`describeDailyLogNotes`).
- If **both** are empty: a muted note `dailyLogs.notesOnly` «ملاحظات فقط» / "Notes only".

**Components used:** `FigmaFormScreen`, `FigmaSectionLabel`, `FigmaMutedNote`, `FigmaFooterPrimaryButton`, `Surface`, `Button` (delete/confirm), `FigmaDailyLogFields`, `UnsavedChangesGuard`, `isolateLtr`.

---

## describe.ts — how a log is turned into rows

`describe.ts` is the single source for rendering a log's contents on the list card and the read-only view; both call the same two helpers so vocabulary never diverges.
- `describeDailyLog(log, t)` → structured rows, **skipping unset fields**, in fixed order: mood, sleep, appetite, hydration, pain, mobility. Each row = `{ key, label (dailyLogs.fields.*), value (localized enum, or dailyLogs.painValue for pain) }` (`describe.ts:10-51`). Pain is included whenever `pain_level !== null` (so an observed `0` shows as «0 من 10»).
- `describeDailyLogNotes(log, t)` → note rows, skipping empty, in order: bathroom, food, activity, general (`describe.ts:54-69`). Value is the raw note text.

---

## Workflows

### 1. Add a daily log
1. On `/daily-logs`, a manager or caregiving member taps the teal **"+"** («إضافة سجل» / "Add log") in the header → navigates to `/daily-logs/new`.
2. (If the member lacked permission the "+" would not appear; a direct navigation shows the `dailyLogs.cannotAdd` empty state instead.)
3. The date defaults to today; the member optionally sets mood, sleep, appetite, hydration, mobility (chips), an observed pain value (None / stepper / scale chip), and any of the four note fields.
4. Tap **«إضافة سجل» / "Add log"**. Validation runs; invalid date shows «اختر تاريخًا صحيحًا», over-long text shows «النص طويل جدًا».
5. On success the app returns to the list (new card appears newest-first) and the Pulse feed refreshes.
6. If a log already exists for that date/author, the form shows «لديك سجل لهذا التاريخ بالفعل. عدّل السجل الموجود…» — the member should instead edit the existing log.

### 2. View a log (read-only member)
1. On `/daily-logs`, tap any log card → `/daily-logs/{id}`.
2. Because the member can't edit (not a manager and not the author), the read-only view renders: date, observation rows, note rows, plus the «للعرض فقط…» notice. No edit or delete controls.

### 3. Edit a log (manager, or the author)
1. Tap the log card → `/daily-logs/{id}`; the editable form loads pre-filled.
2. Change any fields, then tap **«حفظ التغييرات» / "Save changes"**. Success shows «تم حفظ التغييرات» inline; the screen stays open. Failure shows «تعذّر الحفظ…».
3. If unsaved changes exist and the member backs out, the unsaved-changes guard intervenes.

### 4. Delete a log
1. In the edit screen, tap **«حذف السجل» / "Delete log"** (danger).
2. The button row swaps to a two-step confirm: **«تأكيد الحذف» / "Confirm delete"** + **«إلغاء» / "Cancel"**.
3. Confirming deletes the log and returns to the list. Cancelling restores the single delete button. A delete failure shows «تعذّر حذف السجل…» without collapsing the confirm.
