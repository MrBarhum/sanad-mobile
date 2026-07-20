# Emergency Card, Emergency Contacts, Doctors & Care-Recipient Profile

This domain covers the app's "critical info at a glance" surfaces and the screens that feed them. Four routes: a **read-only Emergency Card** (`/emergency-card`) that aggregates the care recipient's identity + medical facts, emergency contacts, and doctors into one red-tinted quick-reference with one-tap call buttons; the **Emergency Contacts manager** (`/emergency-contacts`) where managers add/edit/delete/flag contacts; the **Doctors list** (`/doctors`) with the same call-and-manage pattern; and the **Care-Recipient Profile form** (`/recipient-profile`) that stores the identity + medical background all three others read. Everything follows the M5 "calm, restrained danger" rule: emergency chrome uses the soft `dangerSolid` (#C45050) tint + a Siren/Shield/AlertCircle icon, never an alarm red; status is always icon + text; the whole card carries an explicit "for reference only — not an emergency service" disclaimer. All copy is i18n-driven (`emergencyCard`, `emergencyContacts`, `doctors`, `recipientProfile`, `figma.emergency`, `figma.doctors`, `common` namespaces), gender-neutral Arabic with an exact-parity English mirror.

Every screen is wrapped in `CircleGate` (`src/app/(app)/*.tsx`), which resolves the active circle and passes `circleId` + `canManage` (true for `admin` / `primary_caregiver`, false for other roles). **`canManage` is the single permission lever across this whole domain** — it gates every add/edit/delete affordance and the edit shortcuts; non-managers see read-only views. The server also enforces this via RLS (contacts/doctors/recipient mutations are restricted to admin / primary_caregiver), so a bypassed UI still fails server-side.

---

## 1. Emergency Card — `/emergency-card`

**Route & how reached**
- Route file: `src/app/(app)/emergency-card.tsx` → renders `FigmaEmergencyCard` (`src/features/emergency/figma-emergency-card.tsx`).
- Entry points:
  - **Home dashboard** header quick-action: a round pill with a `Phone` icon on a soft-danger tint (`figma-home.tsx:267`), accessibility label «بطاقة الطوارئ» / "Emergency card".
  - **Home dashboard** body (`figma-home.tsx:526`) — a second push to `/emergency-card`.
  - **Explore** tab, "care" group, item `emergency` (`explore.tsx:104`): title «بطاقة الطوارئ» / "Emergency card", subtitle «معلومات حيوية عند الحاجة» / "Vital info when it's needed", color `dangerSolid`, icon `error`.
- Registered in `_layout.tsx:61` with stack title `emergencyCard.title`.

**Purpose**: A strictly read-only, at-a-glance reference of the care recipient's critical medical facts plus one-tap calling for emergency contacts and doctors. Not an SOS dialer, no guaranteed-response copy.

**Data sources**: composes three live queries for the same circle — `useRecipient` (recipient profile), `useEmergencyContacts`, `useDoctors`. `isLoading`/`isError` are the OR of all three.

### Layout, top to bottom
1. **Header** (`FigmaHeader`): round back button (start), centered title «بطاقة الطوارئ» / "Emergency card" (`emergencyCard.title`), no add button. Back affordance = 44dp pill with `ArrowRight` (RTL-flipped back arrow).
2. **Red-tinted identity hero** (`heroBlock`, background = `dangerSolid` at 5% light / 8% dark):
   - **Shield note row**: `Shield` icon (14px, `errorFg`) + text «للاطلاع فقط — ليست خدمة طوارئ» / "For reference only — not an emergency service" (`figma.emergency.viewOnly`).
   - **Hero row**: a 56×56 round chip (`dangerSolid` @15%) holding a `Siren` icon (28px, `errorFg`); beside it a text stack:
     - Title «بطاقة الطوارئ» / "Emergency card" (`figma.emergency.title`), color `errorFg`, 24px bold.
     - Recipient name = `person.full_name`, or fallback «لم تتم إضافة البيانات بعد» / "No details added yet" (`emergencyCard.noRecipient`).
     - Identity subline (if any): approximate age «{{age}} سنة» / "{{age}} years" (`figma.emergency.ageYears`, computed by `approximateAgeYears(birth_date)`); if age can't be computed but a birth_date string exists, the raw `birth_date` is shown. Parts joined by `  ·  `.
3. **Medical information section**:
   - `SectionHeader` with label «معلومات طبية مهمة» / "Important medical information" (`figma.emergency.medicalTitle`). **Manager-only** trailing **edit shortcut**: `Pencil` (14px, primary) + «تعديل» / "Edit" (`common.edit`) that routes to `/recipient-profile`. Non-managers see label only.
   - One `Surface` card (`tone="card"`, danger-tinted border at 20%) with 4 stacked rows (hairline divider between them). Each row = a 36×36 tinted icon chip + label + value. When a value is empty/blank it renders «غير محدد» / "Not specified" (`emergencyCard.notSpecified`) in muted color; present values are `selectable`.

     | Row | Label (AR / EN) | Icon | Icon tint | Source field |
     |---|---|---|---|---|
     | bloodType | «فصيلة الدم» / "Blood type" | `Droplets` | `errorFg` | `blood_type` |
     | allergies | «الحساسية» / "Allergies" | `AlertTriangle` | `categoryGold` | `allergies` |
     | chronicConditions | «الأمراض المزمنة» / "Chronic conditions" | `Heart` | `errorFg` | `chronic_conditions` |
     | emergencyNotes | «ملاحظات الطوارئ» / "Emergency notes" | `FileText` | `categoryBlue` | `emergency_notes` |
     (labels come from the `recipientProfile.fields.*` namespace)
4. **Emergency contacts section**:
   - `SectionHeader` label «جهات اتصال الطوارئ» / "Emergency contacts" (`emergencyCard.contactsTitle`). **Manager-only** edit shortcut → routes to `/emergency-contacts`.
   - **Empty**: a `Surface` card with muted text «لا جهات اتصال بعد» / "No contacts yet" (`emergencyCard.noContacts`).
   - **Populated**: a list of `CallRow`s. Each contact row: a 44dp round avatar showing the name's initial letter (`initialFor()`), tinted by a 3-color ramp (`categoryTeal → categoryPurple → categoryBlue`, cycled by index); name; subtitle = relationship + (if primary) «مسؤول أساسي» / "Primary contact" (`figma.emergency.primaryContact`), joined by `  ·  `; the phone number LTR-isolated in primary color; and a **48dp round solid-danger call button** (`Phone` icon, white) that opens `tel:` via `Linking`. If no phone stored, the call button is omitted (row stays informational).
5. **Doctors section**:
   - Plain label «الأطباء» / "Doctors" (`emergencyCard.doctorsTitle`) — **no** edit shortcut here (doctors are edited on their own screen).
   - **Empty**: `Surface` card, muted «لا أطباء بعد» / "No doctors yet" (`emergencyCard.noDoctors`).
   - **Populated**: `CallRow`s using a `Stethoscope` icon avatar (tint `categoryGreen`), name = doctor name, subtitle = specialty + clinic joined by `  ·  `, phone + call button as above.
6. **Disclaimer footer**: a soft-danger card (`dangerSolid` @6% fill, @15% border) with `AlertCircle` (16px, `errorFg`) + text «هذه المعلومات مُدخلة من العائلة للعرض فقط، وليست نصيحة أو تشخيصًا طبيًا.» / "This information is entered by the family for reference only and is not medical advice or diagnosis." (`emergencyCard.disclaimer`).

### All states
- **Loading**: `FigmaHeader` + a centered `ActivityIndicator` (primary color).
- **Error** (any of the 3 queries failed): header + centered muted text «تعذّر تحميل بطاقة الطوارئ. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't load the emergency card. Check your connection and try again." (`emergencyCard.loadError`) + a primary «إعادة المحاولة» / "Retry" (`retry`) pill that refetches all three queries.
- **Populated / partial-empty**: renders every section; empty sub-sections show their own inline empty text.

### Interactive elements
| Element | Label (AR / EN) | Icon | Action | Gating |
|---|---|---|---|---|
| Back button | «رجوع» / "Back" (a11y) | `ArrowRight` | `router.back()` | always |
| Medical edit shortcut | «تعديل» / "Edit" | `Pencil` | push `/recipient-profile` | managers only |
| Contacts edit shortcut | «تعديل» / "Edit" | `Pencil` | push `/emergency-contacts` | managers only |
| Contact call button | «اتصال {name}» / "Call {name}" (a11y) | `Phone` | `Linking.openURL('tel:...')` | when phone present |
| Doctor call button | «اتصال {name}» / "Call {name}" (a11y) | `Phone` | `tel:` dial | when phone present |
| Retry (error) | «إعادة المحاولة» / "Retry" | — | refetch all | error state |

No mutations happen on this screen, so there are no confirmation patterns here — the call action fires directly (opens the OS dialer, which is itself the confirmation surface).

**Components used**: `FigmaScreen`, `FigmaHeader`, `Surface`, local `SectionHeader`, local `CallRow`. Icons from `lucide-react-native`. `isolateLtr` for phone numbers, `initialFor` for avatar letters.

**Cross-links**: `/recipient-profile`, `/emergency-contacts` (both via manager edit shortcuts).

---

## 2. Emergency Contacts — `/emergency-contacts`

**Route & how reached**
- Route file: `src/app/(app)/emergency-contacts.tsx` → `EmergencyContactsManager` (`src/features/emergency/contacts-manager.tsx`).
- Entry point: **only** from the Emergency Card's "Emergency contacts" section edit shortcut (manager-only). Not in Explore or Home directly. Registered `_layout.tsx:62`, stack title `emergencyContacts.title` («جهات اتصال الطوارئ» / "Emergency contacts").

**Purpose**: Manage the circle's emergency contacts — list, add, edit, delete, and flag one as primary.

### Layout, top to bottom
- Standard `Screen` (not `FigmaScreen`; the stack header provides the title/back).
- **Manager-only add button** at top: a `Button` with `Glyph.plus` and label «إضافة جهة اتصال» / "Add contact" (`emergencyContacts.add`) → opens the add modal.
- **List** of `ContactRow`s (built on the shared `ContactCard`), gap `Spacing.three`.

### Contact row (`ContactCard`)
- **Avatar**: `GlyphChip` with the name's initial letter, `tone="primary"`.
- **Name** (`cardTitle`) + **subtitle** = `relationship` (primary-text color).
- **Details/notes**: `notes` shown as a small secondary line if present.
- **Phone row**: a full-width tappable well (`primaryBg`) with a `call` icon + the phone number rendered LTR (`LtrText`, selectable, 18px bold). Tapping dials `tel:` (sanitized). Accessibility label «اتصال {name}» / "Call {name}" (`common.call` + name).
- **Primary badge**: if `is_primary`, a `StatusBadge tone="info"` with label «رئيسية» / "Primary" (`emergencyContacts.primaryBadge`).
- **Manager actions** (`ItemActions`, manager-only), separated by a top divider: edit + delete with **inline two-step delete confirm**:
  - Default: «تعديل» / "Edit" (`common.edit`) + danger «حذف» / "Delete" (`common.delete`).
  - After tapping delete: buttons swap in place to danger «تأكيد الحذف» / "Confirm delete" (`common.confirmDelete`, shows a spinner while deleting) + «إلغاء» / "Cancel" (`common.cancel`). Confirm calls `deleteContact.mutateAsync(id)`.

### States
- **Loading**: `LoadingState` — full-area centered large spinner (primary).
- **Error**: `ErrorState` — a `GlyphChip` warning icon + message «تعذّر تحميل جهات الاتصال. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't load the contacts. Check your connection and try again." (`emergencyContacts.loadError`) + a secondary «إعادة المحاولة» / "Retry" button (`retry`).
- **Empty** (`EmptyState`, icon `Glyph.contact`): title «لا جهات اتصال بعد» / "No contacts yet" (`emergencyContacts.emptyTitle`); subtitle **only for managers** «يمكن إضافة جهة اتصال للطوارئ لتكون في متناولك عند الحاجة.» / "Add an emergency contact so it's ready when you need it." (`emergencyContacts.emptySubtitle`).
- **Populated**: list of rows. Contacts are ordered **primary first, then oldest** (`fetchEmergencyContacts`: `order is_primary desc, created_at asc`).

### Add / Edit Contact Modal (`ContactFormModal`)
Opened by the add button (add mode) or a row's edit action (edit mode). Rendered in a `FormModal` bottom-sheet.
- **Title**: add = «إضافة جهة اتصال» / "Add contact" (`emergencyContacts.addTitle`); edit = «تعديل جهة الاتصال» / "Edit contact" (`emergencyContacts.editTitle`).
- **Submit button**: add = «إضافة جهة اتصال» / "Add contact" (`emergencyContacts.add`); edit = «حفظ التغييرات» / "Save changes" (`common.saveChanges`). Full-width filled teal, busy-gated (never disabled-greyed).
- **Cancel button**: «إلغاء» / "Cancel" (`common.cancel`). Header **close (✕)** button, a11y «إغلاق» / "Close" (`common.close`).
- **Close guard**: closing while dirty triggers `confirmDiscard` — title «تغييرات غير محفوظة» / "Unsaved changes", message «لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟» / "You have unsaved changes. Leave without saving?", confirm «تجاهل التغييرات» / "Discard changes", cancel «متابعة التعديل» / "Keep editing" (`common.*`). No backdrop-tap dismissal.
- **Submit error** (surfaced above the footer, `accessibilityRole="alert"`): «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't save. Check your connection and try again." (`emergencyContacts.saveFailed`).

**Fields** (in order):

| # | Field | Label (AR / EN) | Type | Required | Placeholder | Validation / error |
|---|---|---|---|---|---|---|
| 1 | name | «الاسم» / "Name" | text | **Yes** | — | non-empty → «يرجى إدخال الاسم» / "Please enter a name" (`emergencyContacts.errors.name`); ≤120 chars → else «النص طويل جدًا» / "This text is too long" |
| 2 | relationship | «صلة القرابة» / "Relationship" | text | No | «مثال: ابن، جار، طبيب» / "e.g. Son, neighbor, doctor" | ≤80 chars |
| 3 | phone | «رقم الهاتف» / "Phone number" | text (`keyboardType="phone-pad"`, `autoCapitalize=none`) | **Yes** | — | non-empty → «يرجى إدخال رقم الهاتف» / "Please enter a phone number" (`emergencyContacts.errors.phone`); ≤40 chars |
| 4 | isPrimary | «جهة اتصال رئيسية» / "Primary contact" | toggle (`FigmaSwitch`) in a labeled row (`ThemedText type="smallBold"` = «جهة اتصال رئيسية») | — | — | boolean; default false |
| 5 | notes | «ملاحظات» / "Notes" | textarea (`multiline`) | No | «ملاحظات إضافية» / "Additional notes" | ≤500 chars |

Validation is `emergencyContactSchema` (Zod). On invalid, inline field errors render (no submit). Trimmed empty optional fields are stored as `null`.

**Single-primary enforcement**: when `is_primary` is set true, the API (`clearOtherPrimaries`) demotes every other primary contact in the circle before insert/update — client-side, best-effort (no DB uniqueness). So only one contact is ever the primary.

**Components used**: `Screen`, `Button`, `ContactCard`, `StatusBadge`, `ItemActions`, `EmptyState`/`ErrorState`/`LoadingState`, `FormModal`, `FormField`, `FigmaSwitch`, `ThemedText`.

---

## 3. Doctors — `/doctors`

**Route & how reached**
- Route file: `src/app/(app)/doctors.tsx` → `FigmaDoctors` (`src/features/doctors/figma-doctors.tsx`).
- Entry points:
  - **Home dashboard** section `doctors` (`figma-home.tsx:218`): route `/doctors`, label from `careCircle.dashboard.sections.doctors.title` «الأطباء» / "Doctors", color `categoryGreen`, icon `doctor`.
  - **Explore** tab item `doctors` (`explore.tsx:96`): title «الأطباء» / "Doctors", subtitle «الأطباء المعالجون والعيادات» / "Treating doctors and clinics", color `categoryGold`, icon `doctor`.

**Purpose**: The circle's doctor directory — list with one-tap call; managers can add/edit/delete.

### Layout, top to bottom
1. **`FigmaHeader`**: back (start), centered title «الأطباء» / "Doctors" (`figma.doctors.title`). **Manager-only** round teal `+` add button, a11y «إضافة طبيب» / "Add doctor" (`doctors.add`) → opens add modal.
2. **Doctor cards** list (gap 12). Each `DoctorCard` is a `Surface` (`tone="card"`, `Radius.xl`, 16 padding):
   - **Top row**: a `GlyphChip` with `iconName="doctor"` (Stethoscope), color cycled per index from `categoryGreen → categoryBlue → categoryGold → categoryPurple → categoryTeal`. Beside it: doctor **name** (17px bold), optional **specialty** (secondary), optional **clinic/hospital** line (secondary). At the end, when a phone exists, a round primary-tinted **call button** (`Phone`, primary color) → `tel:` dial. A11y «اتصال {name}» / "Call {name}".
   - **Phone well** (if phone): a sunken bordered well with the number LTR-isolated (selectable, secondary color).
   - **Manager actions footer** (manager-only, top divider), **inline two-step delete confirm**:
     - Default: «تعديل» / "Edit" (`Pencil`, muted) + «حذف» / "Delete" (`Trash2`, danger tint).
     - Confirm state: filled danger «تأكيد الحذف» / "Confirm delete" (`Trash2`, white on `dangerSolid`, spinner while deleting) + muted «إلغاء» / "Cancel". Confirm calls `deleteDoctor.mutateAsync(id)`.

### States
- **Loading**: `SkeletonList` (skeleton placeholders, not a spinner).
- **Error**: a `Surface` card with `errorFg` text «تعذّر تحميل قائمة الأطباء. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't load the doctors. Check your connection and try again." (`doctors.loadError`) + a centered primary «إعادة المحاولة» / "Retry" pill (refetch).
- **Empty** (`EmptyState`, `iconName="doctor"`): title «لا يوجد أطباء بعد» / "No doctors yet" (`figma.doctors.emptyTitle`); subtitle **managers only** «أضف طبيبًا لحفظ تخصصه وعيادته ورقم هاتفه» / "Add a doctor to keep their specialty, clinic, and phone number" (`figma.doctors.emptySubtitle`). (Note the distinct `doctors.emptyTitle`/`emptySubtitle` strings exist but the live screen uses the `figma.doctors.*` variants.)
- **Delete error**: an `accessibilityRole="alert"` line above the list «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't save. Check your connection and try again." (`doctors.saveFailed`).
- **Populated**: cards ordered **oldest first** (`fetchDoctors`: `order created_at asc`).

### Add / Edit Doctor Modal (`DoctorFormModal`)
`FormModal` bottom-sheet, mounted for both add and edit (keyed by id / 'new').
- **Title**: add «إضافة طبيب» / "Add doctor" (`doctors.addTitle`); edit «تعديل بيانات الطبيب» / "Edit doctor" (`doctors.editTitle`).
- **Submit**: add «إضافة طبيب» / "Add doctor" (`doctors.add`); edit «حفظ التغييرات» / "Save changes" (`common.saveChanges`).
- **Cancel** «إلغاء» / "Cancel"; header close ✕ «إغلاق» / "Close". Same dirty-close `confirmDiscard` guard as contacts (identical `common.*` copy).
- **Submit error**: «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't save. …" (`doctors.saveFailed`).

**Fields** (in order):

| # | Field | Label (AR / EN) | Type | Required | Placeholder | Validation |
|---|---|---|---|---|---|---|
| 1 | name | «الاسم» / "Name" | text | **Yes** | — | non-empty → «يرجى إدخال اسم الطبيب» / "Please enter the doctor's name" (`doctors.errors.name`); ≤120 |
| 2 | specialty | «التخصص» / "Specialty" | text | No | «مثال: قلب، باطنية» / "e.g. Cardiology, internal medicine" | ≤80 → «النص طويل جدًا» |
| 3 | phone | «رقم الهاتف» / "Phone number" | text (`phone-pad`, `autoCapitalize=none`) | No | — | ≤40 |
| 4 | clinicName | «اسم العيادة أو المستشفى» / "Clinic or hospital" | text | No | «مثال: عيادة الشفاء» / "e.g. Al-Shifa Clinic" | ≤120 |
| 5 | notes | «ملاحظات» / "Notes" | textarea (`multiline`) | No | «ملاحظات إضافية» / "Additional notes" | ≤500 |

Validation `doctorSchema` (Zod) — only `name` required. Empty optionals stored `null`.

**Components used**: `FigmaScreen`, `FigmaHeader`, `Surface`, `GlyphChip`, `SkeletonList`, `EmptyState`, local `DoctorCard` + `ActionButton`, `FormModal`, `FormField`, `isolateLtr`.

---

## 4. Care-Recipient Profile — `/recipient-profile`

**Route & how reached**
- Route file: `src/app/(app)/recipient-profile.tsx` → `RecipientProfileForm` (`src/features/recipient-profile/profile-form.tsx`).
- Entry points:
  - **Emergency Card** "Medical information" edit shortcut (manager-only).
  - **Explore** tab item `recipientProfile` (`explore.tsx:134`): title «ملف من تعتني به» / "Care recipient profile" (`recipientProfile.title`), subtitle «المعلومات الطبية وبيانات الشخص الذي تتم رعايته» / "Medical details and the cared-for person's information", color `categoryTeal`, icon `vital`.
- Registered `_layout.tsx:60`, stack title `recipientProfile.title`.

**Purpose**: View / edit the single care recipient's identity and medical background — the source of truth the Emergency Card and dashboard read. One recipient per circle.

### Layout, top to bottom
`Screen` (`maxWidth=MaxFormWidth`, keyboard-avoiding). An `UnsavedChangesGuard` is active when `canManage && dirty`.
- **Read-only banner** (non-managers only): `InfoBanner tone="neutral"` with «للعرض فقط — لا تملك صلاحية التعديل» / "View only — you don't have permission to edit" (`recipientProfile.readOnly`).
- **Summary card** (`Surface`): a 56×56 rounded-square avatar (teal border, `primaryBg`) showing the first letter of `full_name`, or a `profile` icon if empty; beside it the full name (18px bold) and the birth date (small secondary) when set.
- **Personal info card** (`Surface`, `Radius.lg`): section label «المعلومات الشخصية» / "Personal information" (`recipientProfile.sections.personal`, muted small-bold), then fields with hairline `CardDivider`s between them.
- **Medical / emergency info card** (`Surface`, `Radius.lg`): section label «المعلومات الطبية للطوارئ» / "Medical & emergency information" (`recipientProfile.sections.medical`), then the medical fields.
- **Save actions** (managers only): `FormActions` — full-width teal save button + inline status.

### Fields (in order across both cards)

| # | Card | Field | Label (AR / EN) | Type | Required | Placeholder | Validation / error |
|---|---|---|---|---|---|---|---|
| 1 | Personal | fullName | «الاسم الكامل» / "Full name" | text | **Yes** | — | non-empty → «يرجى إدخال الاسم الكامل» / "Please enter the full name" (`recipientProfile.errors.fullName`); ≤120 |
| 2 | Personal | birthDate | «تاريخ الميلاد» / "Birth date" | `DateField` (wheel picker, clearable) | No | — | must be valid `YYYY-MM-DD` or empty → «أدخل التاريخ بصيغة YYYY-MM-DD» / "Enter the date as YYYY-MM-DD" (`recipientProfile.errors.birthDate`) |
| 3 | Personal | dialect | «اللهجة» / "Dialect" | text | No | «مثال: لهجة شامية» / "e.g. Levantine" | ≤60 |
| 4 | Medical | bloodType | «فصيلة الدم» / "Blood type" | text (`autoCapitalize="characters"`) | No | «مثال: O+» / "e.g. O+" | ≤20 |
| 5 | Medical | allergies | «الحساسية» / "Allergies" | textarea (`multiline`) | No | «مثال: حساسية من البنسلين» / "e.g. Penicillin allergy" | ≤1000 |
| 6 | Medical | chronicConditions | «الأمراض المزمنة» / "Chronic conditions" | textarea | No | «مثال: السكري، ضغط الدم» / "e.g. Diabetes, hypertension" | ≤1000 |
| 7 | Medical | emergencyNotes | «ملاحظات الطوارئ» / "Emergency notes" | textarea | No | «معلومات مهمة عند الطوارئ» / "Important information in an emergency" | ≤2000 |

Validation is `recipientProfileSchema` (Zod). Over-long → «النص طويل جدًا» / "This text is too long". For non-managers all fields are `editable={false}` / `disabled` (read-only), and the save actions are hidden.

**Birth date picker** (`DateField` → `PickerSheet`): tapping the field opens a bottom-sheet with three scroll wheels — day / month / year (RTL order), labels «اليوم/الشهر/السنة» / "Day/Month/Year". Footer: «تم» / "Done" (`pickers.done`), «إلغاء» / "Cancel", «مسح» / "Clear" (`pickers.clear`, since `clearable`). Trigger placeholder when unset = «اختر التاريخ» / "Choose date" (`pickers.setDate`). Stores/emits `YYYY-MM-DD` (or `''` when cleared).

### Save / footer
`FormActions` (managers only):
- **Save button**: «حفظ التغييرات» / "Save changes" (`recipientProfile.save`). Full-width teal, busy-gated by `saving`.
- **Inline status** (above the button, `accessibilityRole="alert"`):
  - saved → success-color «تم حفظ التغييرات» / "Changes saved" (`recipientProfile.saved`).
  - error → error-color «تعذّر حفظ التغييرات. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't save your changes. Check your connection and try again." (`recipientProfile.saveFailed`).
- Status resets to idle on any field edit.
- On success, `useUpdateRecipient` invalidates both the recipient query and the circle-selection query (the dashboard/switcher show the recipient name), so all surfaces refresh.

### States
- **Loading**: `LoadingState` (centered large spinner).
- **Error**: `ErrorState` — warning glyph + «تعذّر تحميل بيانات الملف. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't load the profile. Check your connection and try again." (`recipientProfile.loadError`) + «إعادة المحاولة» retry.
- **No recipient row**: `EmptyState` (icon `Glyph.profile`) with title «لا توجد بيانات بعد» / "No details yet" (`recipientProfile.empty`) — no subtitle, no form (a circle should always have a recipient; this is the degenerate case).
- **Populated**: the full form above.

**Components used**: `Screen`, `Surface`, `FormField`, `DateField` (+ `PickerSheet`/`WheelColumn`), `FormActions`, `Icon`, `InfoBanner`, `EmptyState`/`ErrorState`/`LoadingState`, `UnsavedChangesGuard`, `ThemedText`, local `CardDivider`.

---

## Shared behavior & permissions

- **Permission model**: every screen receives `canManage` from `CircleGate`. Managers (`admin` / `primary_caregiver`) get: the add button (contacts, doctors), per-row edit/delete (contacts, doctors), the emergency-card edit shortcuts, and the recipient-profile editable fields + save. Non-managers get read-only views (contacts/doctors lists with call buttons only; recipient profile with the read-only banner and disabled fields; emergency card with no edit shortcuts). RLS mirrors this server-side for all mutations.
- **Call pattern**: identical everywhere — sanitize to `[\d+]`, `Linking.openURL('tel:...')`, fail silently on unsupported devices. Phone numbers always rendered LTR (`isolateLtr` / `LtrText`) inside the RTL layout.
- **Delete confirmation**: contacts and doctors both use the **inline two-step confirm** (never a silent delete): tap Delete → buttons swap to «تأكيد الحذف» / "Confirm delete" + «إلغاء» / "Cancel" in place, with a spinner while the mutation runs.
- **Danger tone**: all emergency chrome uses the soft `dangerSolid` (#C45050) with tinted backgrounds (5–15%) and `errorFg` text, plus Siren/Shield/AlertCircle/Phone icons — restrained, never a bright alarm red. The disclaimer + "view only" note explicitly disclaim any emergency-service role.

---

## Workflows

### A. Look up critical info in an emergency and call someone
1. From Home, tap the red `Phone` quick-action (or Explore → "Emergency card").
2. Read the recipient's name/age, blood type, allergies, chronic conditions, and emergency notes on the red-tinted card.
3. Scroll to Emergency contacts (primary first) or Doctors.
4. Tap the round red/teal `Phone` call button on a row → the OS dialer opens with the number.

### B. Add an emergency contact (manager)
1. Open the Emergency Card → tap «تعديل» / "Edit" next to "Emergency contacts" (routes to `/emergency-contacts`).
2. Tap «إضافة جهة اتصال» / "Add contact".
3. Fill Name (required), Relationship, Phone (required), toggle «جهة اتصال رئيسية» if this is the primary, add Notes.
4. Tap «إضافة جهة اتصال». If another primary existed, it is auto-demoted. Modal closes; list refreshes (primary first). On failure the sheet shows «تعذّر الحفظ…» and stays open.

### C. Edit / delete an emergency contact (manager)
1. On `/emergency-contacts`, tap «تعديل» / "Edit" on a row → edit modal (submit becomes «حفظ التغييرات»).
2. To delete: tap «حذف» / "Delete" → tap «تأكيد الحذف» / "Confirm delete" (or «إلغاء» to back out). Row disappears on success.

### D. Add a doctor and call them (manager)
1. Home dashboard → "Doctors" (or Explore → "Doctors").
2. Tap the teal `+` → fill Name (required), Specialty, Phone, Clinic/hospital, Notes → «إضافة طبيب».
3. The new card appears with a call button; tap it to dial. Edit via «تعديل», delete via the two-step «حذف» → «تأكيد الحذف».

### E. Fill in / update the care recipient's medical background (manager)
1. Explore → "Care recipient profile" (or Emergency Card → "Edit" on Medical information).
2. Edit Full name (required), tap Birth date to pick a date (day/month/year wheels → «تم»), set Dialect, Blood type, Allergies, Chronic conditions, Emergency notes.
3. Tap «حفظ التغييرات». Inline «تم حفظ التغييرات» confirms; the Emergency Card and dashboard now reflect the new values. Leaving with unsaved edits prompts the discard guard.

### F. Non-manager view
1. A collaborator opening any of these screens sees: contacts/doctors lists with **call buttons only** (no add/edit/delete), the recipient profile with a «للعرض فقط…» banner and **disabled fields / no save**, and the Emergency Card with **no edit shortcuts**. They can still call any contact or doctor.
