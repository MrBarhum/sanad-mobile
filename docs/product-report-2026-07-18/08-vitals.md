# Vital Readings

The Vitals domain lets a family record and review **non-diagnostic** health measurements for the cared-for person — blood pressure, heart rate, temperature, blood sugar, oxygen saturation, weight, and a free "other" type. It is deliberately a *logbook*, not a monitor: the app **never** interprets a value, never labels anything normal/abnormal, and never color-codes by health status. The per-type colors on the grid are fixed **category accents** (a visual aid only). Every screen carries the same non-diagnostic disclaimer banner. There are three screens — a 2-column readings grid (`/vitals`), an add form (`/vitals/new`), and a per-reading detail that renders as an editable form for permitted users or a read-only card stack for viewers (`/vitals/[id]`). Data lives in the Supabase `vital_readings` table; visibility is transparent (every active member sees all readings) while mutation is role-gated.

Data model (`vital_readings` row, `api.ts:5`): `id`, `circle_id`, `reading_type` (enum), `reading_at` (ISO timestamp), `systolic` / `diastolic` (int, blood-pressure only), `numeric_value` (number, all other measured types), `unit` (string), `notes` (string), `recorded_by` (user id, set to the acting user on create).

## Role / permission gating (applies across all three screens)

Roles resolve through `CircleGate` → `ActiveCircle` (`circle-selection/permissions.ts:37`). Two booleans are passed into every vitals screen:

| Prop in vitals code | Source capability | Roles that get it |
| --- | --- | --- |
| `canManage` | `canManageCircle` (`permissions.ts:4`) | `admin`, `primary_caregiver` |
| `canCollaborate` (from `circle.canLogDoses`) | `canLogDoses` (`permissions.ts:9`) | `admin`, `primary_caregiver`, `family_member`, `caregiver` |

Derived rules:
- **Add a reading** — allowed when `canManage || canCollaborate` (i.e. any caregiving role; only a pure `viewer` is excluded). `new.tsx:17`.
- **Edit a reading** — allowed when `canManage || (canCollaborate && isOwner)`. A collaborator may edit **only readings they recorded**; a manager edits any. `vital-editor.tsx:65`.
- **Delete a reading** — surfaced only inside the edit screen, so it follows the same edit gate; server RLS additionally restricts delete to managers (any) or the author (own). `api.ts:69`.
- Anyone who can view (all active members) but cannot edit sees the **read-only** card layout.

---

## Screen 1 — Vitals grid (`/vitals`)

- **Route & how reached**: `src/app/(app)/vitals/index.tsx` → renders `FigmaVitals` (`features/vitals/figma-vitals.tsx`). Reached from the app's care-section navigation / Explore (canonical feature order places vitals after appointments). The nested stack (`_layout.tsx`) anchors back-navigation to this `index` route; native stack title is `t('vitals.title')` though `FigmaVitals` draws its own header on top.
- **Purpose**: Browse all of the circle's vital readings, newest first, and jump into add or a single reading.

### Layout, top to bottom
1. **Header** (`FigmaHeader`): round 44dp back pill (start; `ArrowRight` glyph = "back" in RTL, `accessibilityLabel` = `common.back` «رجوع» / "Back"), centered title `vitals.title` **«القياسات الحيوية» / "Vital readings"**, and — only when the user can add — a round **teal "+" add button** (end; `Plus` glyph, `accessibilityLabel` = `vitals.add` **«إضافة قياس» / "Add reading"**) that pushes `/vitals/new`. When the user cannot add, the trailing slot is an empty 44dp spacer. (`figma-vitals.tsx:68`)
2. **Disclaimer banner** (always present): a primary-tinted rounded well (`withAlpha(primary,0.08)` fill, `0.15` hairline border) containing `vitals.disclaimer`: **«قياسات تُدخلها العائلة للحفظ والمتابعة فقط، وليست تشخيصًا أو نصيحة طبية، ولا يُفسّر التطبيق القيم.»** / "Readings entered by the family for recording and tracking only. They are not a diagnosis or medical advice, and the app does not interpret the values." (`figma-vitals.tsx:76`)
3. **Content** — one of the states below.

### States
- **Loading** (`figma-vitals.tsx:87`): header + disclaimer, then a centered teal `ActivityIndicator`.
- **Error** (`figma-vitals.tsx:99`): header + disclaimer, then a `Surface` card with error-toned title `vitals.loadError` **«تعذّر تحميل القياسات. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load readings. Check your connection and try again."** and a filled teal **retry** button labeled `retry` **«إعادة المحاولة» / "Retry"** that calls `refetch()`.
- **Empty** (no readings at all; `figma-vitals.tsx:117`): header + disclaimer, then `EmptyState` with feature icon `vital`, title `vitals.noTodayTitle` **«لا قياسات اليوم» / "No readings today"**, and — only when the user can add — subtitle `figma.vitals.emptySubtitle` **«اضغط + لتسجيل أول قياس» / "Tap + to record the first reading"**. (Note: the title says "today" but the list is actually **all** readings, not today-only — worth reconciling in a redesign.)
- **Populated**: a 2-column wrapping grid (`gap 12`, each cell `width 47%`, `flexGrow 1`) of **VitalCard**s, ordered by `reading_at` **descending** (newest first, from `fetchVitals`, `api.ts:34`).

There is **no** "mine / all" scope toggle and **no** "أنا متكفّل" claim on this screen — vitals are records, not assignable work, so all readings are always shown to every active member.

### VitalCard — data shown (`figma-vitals.tsx:151`)
Tappable `Surface` (`tone="card"`, `Radius.xl`, `padded 16`). Tapping opens `/vitals/[id]`. Top-to-bottom:
1. **GlyphChip** (`size="md"`) — the per-type category icon + color:

| Type | Icon (`iconName`) | Category color (`colorKey`) |
| --- | --- | --- |
| `blood_pressure` | `activity` | `categoryBlue` |
| `heart_rate` | `heart` | `categoryPurple` |
| `temperature` | `temperature` | `categoryGold` |
| `blood_sugar` | `drop` | `categoryPurple` |
| `oxygen_saturation` | `oxygen` | `categoryGreen` |
| `weight` | `weight` | `categoryGold` |
| `other` | `doctor` | `categoryTeal` |

2. **Type label** — `vitals.type.<type>` (secondary text). Values: **ضغط الدم / Blood pressure**, **النبض / Heart rate**, **الحرارة / Temperature**, **سكر الدم / Blood sugar**, **تشبّع الأكسجين / Oxygen saturation**, **الوزن / Weight**, **أخرى / Other**.
3. **Value + unit** (only if a value exists): a baseline-aligned pair — a large 22/bold **value** (LTR-isolated) and a small 14 **unit** beside it. The split comes from `formatVitalValue()` (`describe.ts`): the card strips the trailing unit off the formatted string so it can size value and unit separately. BP renders `120/80` + `mmHg`; measured types render e.g. `37.5` + `°C`.
4. **Timestamp line** (secondary): if the reading is **today**, `figma.vitals.today` **«اليوم» / "Today"** + LTR time (e.g. "اليوم 14:30"); otherwise LTR `YYYY-MM-DD HH:MM`. If the reading was recorded by the current user, a `· ` + `vitals.mineLabel` **«قياسك» / "Your reading"** suffix is appended.

Accessibility: card `accessibilityLabel` = `"<type>: <value> <unit>"`, `accessibilityHint` = the when-string.

### Components used
`FigmaScreen` (scroll shell + top inset), `FigmaHeader`, `Surface` (cards + error card), `GlyphChip`, `EmptyState`, `isolateLtr`, `useVitals` hook, `formatVitalValue`.

---

## Screen 2 — Add a reading (`/vitals/new`)

- **Route & how reached**: `src/app/(app)/vitals/new.tsx` → renders `VitalForm` (`features/vitals/vital-form.tsx`). Reached from the grid's teal "+" button. Native stack title `vitals.addTitle`, but the form hides the native header (`Stack.Screen headerShown:false`) and draws its own.
- **Purpose**: Record a new vital reading.
- **Permission wall**: If the user is a pure viewer (`!canManage && !canLogDoses`), the route renders a centered `EmptyState` titled `vitals.cannotAdd` **«إضافة القياسات متاحة لأعضاء دائرة الرعاية النشطين» / "Recording readings is available to active care circle members"** instead of the form. (`new.tsx:24`)

### Layout, top to bottom (`FigmaFormScreen` shell)
1. **Header**: round 44dp back pill (`ArrowRight`, `onBack` → `router.back()`) + stacked title/subtitle + hairline divider. Title `vitals.addTitle` **«تسجيل قياس حيوي» / "Record a vital reading"**, subtitle `vitals.addSubtitle` **«قياسات للمتابعة فقط» / "Readings for tracking only"**.
2. **Gold disclaimer banner** (`FigmaFormScreen` `disclaimer` prop → `accentBg` fill, `accentFg` text): the same `vitals.disclaimer` string as the grid.
3. **Scrolling card stack** = `FigmaVitalFields` (the four cards below), then the inline save footer as the last block.
4. **Unsaved-changes guard** (`UnsavedChangesGuard when={dirty && !submitted}`): warns on back-navigation if the draft was touched and not yet submitted.

### Form — `FigmaVitalFields` (`figma-vital-fields.tsx`)

Each field group is its own `Surface` card (`tone="card"`, `Radius.lg`, `padded 16`, `gap 16`). Field order:

| # | Card / label | Control | Type | Required | Placeholder | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `vitals.fields.type` **«نوع القياس» / "Measurement type"** | `OptionSelect` (chip variant) of all 7 types | single-choice chips | yes (defaults to `blood_pressure`) | — | Selecting a type also resets `unit` to that type's `DEFAULT_UNITS` value. |
| 2 | `vitals.valueLabel` **«القيمة» / "Value"** | see value-card variants below | number(s) + unit | conditional | — | Layout depends on selected type. |
| 3 | `vitals.fields.readingAt` **«التاريخ والوقت» / "Date and time"** | `DateField` (flex 2) + `TimeField` (flex 1) | wheel pickers | yes | — | Defaults to today + current time. |
| 4 | `vitals.fields.notes` **«ملاحظات» / "Notes"** | `FormField` multiline | textarea | optional | `vitals.placeholders.notes` **«مثال: بعد الطعام، في حالة الراحة...» / "e.g. after food, while resting..."** | Max 1000 chars. |

**Value card — blood pressure variant** (`draft.type === 'blood_pressure'`): a sub-label `"<typeLabel> (<unit or mmHg>)"`, then a row of two big centered LTR numeric inputs separated by a large `/` glyph:
- **Systolic** — label `vitals.fields.systolic` **«الانقباضي» / "Systolic"**, `BigValueInput`, `number-pad`, `maxLength 3`, placeholder `vitals.placeholders.systolic` **«مثال: 120» / "e.g. 120"**.
- **Diastolic** — label `vitals.fields.diastolic` **«الانبساطي» / "Diastolic"**, `BigValueInput`, `number-pad`, `maxLength 3`, placeholder `vitals.placeholders.diastolic` **«مثال: 80» / "e.g. 80"**.
- A combined error line renders below if either is invalid.

**Value card — measured / other variant** (any non-BP type): a sub-label (the type label, or `vitals.fields.valueOptional` **«القيمة (اختياري)» / "Value (optional)"** when type is `other`), then a row: a big centered LTR `BigValueInput` (`decimal-pad`, placeholder `vitals.placeholders.value` **«أدخل القيمة» / "Enter the value"**, flex 2) beside a small **unit box** `TextInput` (flex 1, centered, `autoCapitalize=none`, `autoCorrect=false`, `accessibilityLabel` = `vitals.fields.unit` **«الوحدة» / "Unit"**, placeholder `vitals.placeholders.unit` **«مثال: mmHg» / "e.g. mmHg"**). The unit is prefilled from `DEFAULT_UNITS` for the chosen type and stays editable.

**Date/time** use the app's protected **wheel pickers** (never native inputs): `DateField` opens a `PickerSheet` with year/month/day `WheelColumn`s (RTL orders them day→month→year), footer buttons `pickers.done` / `common.cancel` / `pickers.clear`; `TimeField` is the equivalent for hour/minute.

Per-type field/unit summary:

| Type | Value input(s) | Default unit (`DEFAULT_UNITS`) | Value required? |
| --- | --- | --- | --- |
| Blood pressure | systolic + diastolic (int, 1–3 digits) | `mmHg` | both required |
| Heart rate | single value (positive number) | `bpm` | required |
| Temperature | single value | `°C` | required |
| Blood sugar | single value | `mg/dL` | required |
| Oxygen saturation | single value | `%` | required |
| Weight | single value | `kg` | required |
| Other | single value (optional) | `` (empty) | optional — notes-only record allowed |

### Validation (`prepareVital`, `vital-fields.tsx:71`)
- `date` invalid → `vitals.errors.date` **«اختر تاريخًا صحيحًا» / "Choose a valid date"**.
- `time` invalid (or date+time won't combine to an instant) → `vitals.errors.time` **«اختر وقتًا صحيحًا» / "Choose a valid time"**.
- Blood pressure: `systolic`/`diastolic` must each be a positive integer ≤ int4 max → `vitals.errors.systolic` **«أدخل قيمة انقباضي صحيحة» / "Enter a valid systolic value"** and `vitals.errors.diastolic` **«أدخل قيمة انبساطي صحيحة» / "Enter a valid diastolic value"**.
- Other measured types: `value` must be a positive number → `vitals.errors.value` **«أدخل قيمة صحيحة» / "Enter a valid value"**. For `other`, an empty value is allowed (skips the check); a non-empty non-numeric value still errors.
- `unit` > 40 chars → `validation.tooLong` **«النص طويل جدًا» / "This text is too long"**.
- `notes` > 1000 chars → `validation.tooLong`.
- Any other code falls back to `validation.generic` **«قيمة غير صحيحة» / "Invalid value"**.

### Submit / footer (`vital-form.tsx:61`)
Rendered inline as the last body block (not a pinned bar — pinned footers proved invisible on Android). Above the button, on failure, an `accessibilityRole="alert"` line shows `vitals.saveFailed` **«تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't save. Check your connection and try again."**. The CTA is a full-width 56dp filled teal `FigmaFooterPrimaryButton` labeled `vitals.add` **«إضافة قياس» / "Add reading"**; there is no disabled state — an invalid press runs validation and surfaces inline errors. On success it creates the reading (`useCreateVital`, which also stamps `recorded_by` and refreshes the Care Pulse feed) and `router.back()`s to the grid.

### Components used
`FigmaFormScreen`, `FigmaVitalFields` (→ `Surface`, `OptionSelect`, `BigValueInput`, `FigmaFieldLabel`, `FigmaSectionLabel`, `DateField`, `TimeField`, `FormField`), `FigmaFooterPrimaryButton`, `UnsavedChangesGuard`.

---

## Screen 3 — Reading detail / edit (`/vitals/[id]`)

- **Route & how reached**: `src/app/(app)/vitals/[id].tsx` → renders `VitalEditor` (`features/vitals/vital-editor.tsx`) with the `id` param. Reached by tapping any VitalCard on the grid. Native stack title `vitals.detailTitle`, but the component hides the native header and draws its own.
- **Purpose**: View a single reading; edit or delete it when permitted.

### Load states (`vital-editor.tsx:50`)
- **Loading** → `LoadingState` (centered large teal spinner).
- **Error** → `ErrorState` with a warning `GlyphChip`, message `vitals.loadError` (same as grid), and a secondary retry button `retry` calling `refetch()`.
- **Not found** (query resolved but no row) → centered `EmptyState` titled `vitals.notFound` **«تعذّر العثور على هذا القياس. ربما حُذف.» / "Couldn't find this reading. It may have been removed."**
- Once loaded, it branches on the edit gate into the **edit** screen or the **read-only view** screen.

### 3a — Editable form (`VitalEditScreen`, `vital-editor.tsx:80`)
Shown when `canManage || (canCollaborate && isOwner)`. Same `FigmaFormScreen` shell as Add, but:
- Header title `vitals.detailTitle` **«تفاصيل القياس» / "Reading details"**, no subtitle. Same gold `vitals.disclaimer` banner.
- Draft is pre-filled from the row (`vitalDraftFromRow`) and the same `FigmaVitalFields` + validation are used.
- `UnsavedChangesGuard when={dirty}` guards navigation.

**Delete card** (destructive, kept separate from save; sits above the save CTA). It is a `Surface` card holding a two-step inline confirm:
- Initial: a full-width **danger** `Button` labeled `vitals.deleteReading` **«حذف القياس» / "Delete reading"** → tapping sets `confirming`.
- Confirm state: a row of two buttons — **danger** `common.confirmDelete` **«تأكيد الحذف» / "Confirm delete"** (shows a spinner while deleting) and **secondary** `common.cancel` **«إلغاء» / "Cancel"** (returns to the initial state).
- On delete success → `router.back()`. On failure, an `accessibilityRole="alert"` line shows `vitals.deleteFailed` **«تعذّر حذف القياس. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't delete the reading. Check your connection and try again."** and the confirm stays (never silently reverts).

**Save footer** (last body block): on success an `accessibilityLiveRegion` line shows success-toned `vitals.saved` **«تم حفظ التغييرات» / "Changes saved"**; on error an alert line shows `vitals.saveFailed`. CTA is the teal `FigmaFooterPrimaryButton` labeled `common.saveChanges` **«حفظ التغييرات» / "Save changes"**. Save runs the same `prepareVital` validation, then `useUpdateVital`; the screen stays on the form (does not navigate away) and clears the dirty state.

### 3b — Read-only view (`VitalViewScreen`, `vital-editor.tsx:193`)
Shown to anyone who can view but not edit (a viewer, or a collaborator looking at someone else's reading). `FigmaFormScreen` shell (title `vitals.detailTitle`, gold `vitals.disclaimer` banner), no save footer, no delete. Top note `FigmaMutedNote` = `vitals.readOnly` **«للعرض فقط — لا تملك صلاحية التعديل» / "View only — you don't have permission to edit"**. Then a stack of labeled `Surface` cards (each a `FigmaSectionLabel` + a 16/regular value):
- `vitals.fields.type` → the type label.
- `vitals.valueLabel` **«القيمة» / "Value"** → `formatVitalValue()` (only if a value exists).
- `vitals.fields.readingAt` → LTR `YYYY-MM-DD HH:MM`.
- `vitals.fields.notes` → the notes text (only if present).

### Components used
`FigmaFormScreen`, `FigmaVitalFields`, `FigmaMutedNote`, `FigmaSectionLabel`, `Surface`, `Button` (danger + secondary for delete), `FigmaFooterPrimaryButton`, `UnsavedChangesGuard`, `LoadingState` / `ErrorState` / `EmptyState`.

---

## Notes for the redesigner

- **Two fieldset implementations exist.** `FigmaVitalFields` (`figma-vital-fields.tsx`) is what all three live screens render — big centered LTR value inputs, card-per-group, a dedicated BP `/` layout. A second component, `VitalFieldset` (`vital-fields.tsx:121`), is a plainer `FormField`/`DateTimeField` version that is **not** wired into any current screen (only its exported helpers `prepareVital`, `defaultVitalDraft`, `vitalDraftFromRow`, `VitalDraft` are used). Treat `FigmaVitalFields` as the source of truth.
- The grid's empty-state **title** (`vitals.noTodayTitle` "No readings today") describes today, but the grid actually lists **all** readings — a copy/scope mismatch to resolve.
- Category colors are decorative only and must **never** be repurposed to encode a value judgement (project non-diagnostic rule).

---

## Workflows

### Record a new reading
1. On the vitals grid (`/vitals`), tap the teal **"+"** (`vitals.add`). (Visible only to caregiving roles; a pure viewer sees the `vitals.cannotAdd` wall if they reach the route.)
2. On `/vitals/new`, pick a **measurement type** chip — the unit field auto-fills with that type's default (e.g. `mmHg`, `bpm`, `°C`).
3. Enter the value: for **blood pressure**, fill both systolic and diastolic; for other types, fill the single value (editable unit beside it); for **other**, the value is optional.
4. Adjust **date** and **time** via the wheel pickers (default = now). Optionally add **notes**.
5. Tap **«إضافة قياس» / "Add reading"**. Validation runs; on failure inline field errors and/or a `saveFailed` alert appear. On success the reading is created (stamped with your user id) and you return to the grid, now showing the new card at the top.

### Review a reading
1. On the grid, tap any **VitalCard**.
2. `/vitals/[id]` loads. If you can edit it (manager, or the collaborator who recorded it) you get the editable form; otherwise you get the read-only card stack with the `readOnly` note.

### Edit a reading
1. Open a reading you may edit (workflow above).
2. Change any field(s) — the unsaved-changes guard now arms.
3. Tap **«حفظ التغييرات» / "Save changes"**. On success a `saved` confirmation appears and the dirty state clears (you stay on the screen); on failure a `saveFailed` alert appears.

### Delete a reading
1. Open a reading you may edit; scroll to the **delete** card above the save button.
2. Tap **«حذف القياس» / "Delete reading"**.
3. In the two-button confirm row, tap **«تأكيد الحذف» / "Confirm delete"** (or **«إلغاء» / "Cancel"** to back out).
4. On success you return to the grid; on failure a `deleteFailed` alert appears and the confirm remains so you can retry.
