# Design System — Forms, Sheets, Pickers & List Chrome

This section documents the **composed interaction primitives** that every Sanad feature screen is built from — the form field, the single/multi-choice selectors, the three bottom-sheet chromes, the date & time pickers, the timezone picker, the list/row/tab chrome, the footer CTA, the two-step delete, and the unsaved-changes guard. These are not screens the user navigates to; they are the reusable building blocks a designer must spec once and then see reused everywhere. Every component reads its color/type/spacing from the single token system (`src/constants/theme.ts`, IBM Plex Sans Arabic) via `useTheme()`, is RTL-safe (Arabic-first — no hardcoded `textAlign`, side placement follows `I18nManager.isRTL`), and meets the older-adult accessibility floor: text ≥14dp, touch targets ≥48dp (`TouchTarget.min`) or ≥52dp (`TouchTarget.comfortable`). Copy is i18n-driven from the `common`, `pickers`, and `circleTimezone` namespaces (quoted below in both locales). All strings live in `ar.json` + `en.json` at exact key parity; no hardcoded Arabic.

Token reference used throughout (from `theme.ts`): `Spacing` = { half:2, one:4, two:8, three:16, four:24, five:32, section:40, six:64 } dp · `Radius` = { sm:8, md:12, lg:16, card:20, xl:24, pill:999 } · `TouchTarget` = { min:48, comfortable:52 } · `Gutter` = 20 · `MaxFormWidth` = 480.

---

## FormField — the text field

**File:** `src/components/form-field.tsx`
**Purpose:** The one labeled, themed text input for all care forms (name, dose amount, notes, email, etc.). Spreads all React Native `TextInputProps`.

### Layout, top to bottom
1. **Label** (optional) — `ThemedText type="smallBold"`. If `required`, a red `*` (`theme.errorFg`) is appended after the label text.
2. **Input box** — full-width `TextInput`, `Radius.md` (12) corners, 1dp border, `paddingHorizontal`/`paddingVertical` = `Spacing.three` (16), `fontSize: 16` (body floor), `minHeight: TouchTarget.comfortable` (52), background `theme.backgroundElement`, text `theme.text`, placeholder `theme.textMuted`.
3. **Hint line** (optional) — `ThemedText type="small" themeColor="textMuted"`, shown **only when there is no error**.
4. **Error line** (optional) — `ThemedText type="small"` in `theme.errorFg`, `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`. Replaces the hint when present.

### States / behavior
- **Focus ring:** border color = `theme.primary` when focused, `theme.errorFg` when `error` set, else `theme.border`. On focus the border thickens to 2dp (padding compensates by −1dp so the box doesn't jump) — a deliberately obvious active-field cue for keyboard nav and older users.
- **Multiline:** pass `multiline` → `minHeight: 112`, `textAlignVertical: 'top'` (the notes-field shape).
- Direction follows the app RTL/LTR setting automatically (no hardcoded `textAlign`), so Arabic aligns to the start.

### Props
| Prop | Type | Notes |
|---|---|---|
| `label` | string? | Rendered as `smallBold`; also the `accessibilityLabel` of the input. |
| `error` | string \| null | Shows the alert line + red border; hides the hint. |
| `required` | boolean? | Appends red ` *`. |
| `hint` | string? | Quiet helper under the input (hidden while error shows). |
| `multiline` | boolean? | Textarea shape (112 min-height). |
| …rest | `TextInputProps` | `placeholder`, `value`, `onChangeText`, `keyboardType`, `secureTextEntry`, `onFocus`/`onBlur`, etc. all pass through. |

**Related field labels for the Figma form shell:** `FigmaFieldLabel` (in `figma-form-screen.tsx`, 14/600/`textSecondary` + optional red `*`) and `FigmaSectionLabel` (14/600/`textMuted`) are the non-input label atoms used inside `Surface` cards on the Figma-era add/edit screens.

---

## OptionSelect — single-choice selector (chip vs card)

**File:** `src/components/option-select.tsx`
**Purpose:** The ONE single-choice primitive for category / priority / type / unit / role enums. Generic over a string union `T`. Absorbs the deleted FigmaChipSelect + FigmaCardSelect.

### Two variants
- **`chip` (default)** — a horizontal wrap of compact segmented pills. Each pill: `Radius.pill`, 1.5dp border, `paddingHorizontal: Spacing.three` (16) / `paddingVertical: Spacing.two` (8), `minHeight: TouchTarget.min` (48). Selected pill prepends a leading check glyph: `${Glyph.check} label`.
- **`card`** — full-width stacked rows, each with a **radio circle** (22×22, 2dp border; filled `theme.primary` + `Glyph.check` in `onPrimary` when selected) + a title + an optional **`description`** second line (`themeColor="textSecondary"`). `Radius.md`, 1.5dp border. This is the "pick one, with explanation" idiom (e.g. a role picker).

### Selection styling (both variants — never color-only)
- **Unselected:** background `theme.backgroundSelected`, border `theme.border`, label `type="small"` / `themeColor="text"`.
- **Selected:** background `theme.primaryBg` (brand tint), border `theme.primary`, label **bold** (`type="smallBold"`) + `themeColor="primaryText"` + a **leading check** — so choice is carried by shape + weight + check, not hue alone.
- Each option is a full-area `Pressable` with `accessibilityRole="radio"` and `accessibilityState={{ selected, disabled }}`; `pressed` → 0.7 opacity; `disabled` → 0.5 opacity.

### Props
| Prop | Type | Notes |
|---|---|---|
| `label` | string? | Rendered as `smallBold` above the group. |
| `value` | `T` | Currently selected value. |
| `options` | `readonly SelectOption<T>[]` | `SelectOption = { value, label, description? }`; `description` renders only in `card`. |
| `onChange` | `(value: T) => void` | |
| `disabled` | boolean? | Whole group disabled (0.5 opacity). |
| `variant` | `'chip' \| 'card'` | Default `'chip'`. |

---

## WeekdaySelector — multi-select weekdays

**File:** `src/components/weekday-selector.tsx`
**Purpose:** Explicit **multi-select** for a schedule's days of week (0 = Sunday … 6 = Saturday, matching the DB convention). Kept separate from OptionSelect because it is multi-select (checkbox semantics), but its chip visuals match OptionSelect.

### Layout
1. **Label** (optional, `smallBold`).
2. **"Every day" full-width chip** — `fullWidth` chip that selects all seven when not all are selected, and clears all when all seven are selected. Caller passes its label via `everyDayLabel`.
3. **7 day chips** — a wrap of square-ish chips (`minWidth`/`minHeight: TouchTarget.min` = 48, `Radius.pill`, 1.5dp border), labelled by `dayLabels[0..6]`.
4. **Error line** (optional) — red `theme.errorFg`, `accessibilityRole="alert"`.

### Behavior
- Selection is **opt-in**: a fresh schedule starts with NO days selected; tapping a day toggles it. Selected days sort ascending in the emitted array.
- Each chip: `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`. Selected = `theme.primaryBg` fill + `theme.primary` border + bold + leading `Glyph.check`; unselected = `theme.backgroundSelected` + `theme.border`. `pressed` → 0.7 opacity.
- The "at least one day chosen" validation lives in the parent schema; its message is passed via `error`.

### Props
| Prop | Type | Notes |
|---|---|---|
| `value` | `number[]` | Selected day numbers 0–6; empty = none. |
| `onChange` | `(next: number[]) => void` | Emits sorted array. |
| `dayLabels` | `readonly string[]` | Short chip labels, index 0 (Sun)…6 (Sat). |
| `accessibilityDayLabels` | `readonly string[]?` | Full names for a11y. |
| `everyDayLabel` | string | The select-all / clear-all chip label. |
| `label` | string? | |
| `error` | string? | Alert line. |

---

## FormModal — the add/edit form sheet (behavior contract #1)

**File:** `src/components/form-modal.tsx`
**Purpose:** Bottom-sheet modal hosting an add/edit form; the caller owns the fields (`children`) and validation, this provides chrome + footer.

### Canonical sheet chrome (shared by all three sheets)
Centered `backgroundElement` card, `maxWidth: MaxFormWidth` (480), `borderTopLeftRadius`/`Right: Radius.card` (20), a **hairline border** (`StyleSheet.hairlineWidth`, `theme.border`), and a centered **grab handle** = 48×8dp, `Radius.pill`, `theme.backgroundSelected`. Slides up (`animationType="slide"`) over `theme.overlay` scrim. `maxHeight: 92%`.

### Layout
1. Grab handle.
2. **Header row:** `sectionTitle` title (start, `accessibilityRole="header"`) + a **close icon-button** (end) = `Glyph.cross`, ≥48dp target, `accessibilityLabel={closeLabel}`.
3. **Scrollable content:** the caller's form `children`, then an inline **error** line (`theme.errorFg`, `accessibilityRole="alert"`) when `error` set.
4. **Footer actions:**
   - **Primary CTA** — `FigmaFooterPrimaryButton` labelled `submitLabel` (full-width teal, only busy-gated by `submitting`, never greyed).
   - **Secondary** — `Button variant="secondary"` labelled `cancelLabel`, disabled while submitting.

### Behavior contract (distinct from the other two sheets)
- **Explicit close only** — NO backdrop-tap dismissal (prevents losing typed input by accident); dismiss via the header close button or Cancel.
- **Keyboard-avoidance** — wraps content in `KeyboardAvoidingView` (`padding` on iOS).
- **Submit/cancel footer** — validation lives in the caller's `onSubmit` (an invalid press shows inline field errors, not a submit).

### Props
`visible`, `title`, `submitLabel`, `cancelLabel`, `closeLabel`, `submitting?`, `error?`, `onSubmit`, `onClose`, `children`.

Typical footer copy from `common`: Cancel «إلغاء» / "Cancel", Close «إغلاق» / "Close", Save «حفظ» / "Save", Save changes «حفظ التغييرات» / "Save changes".

---

## PickerSheet — the date/time wheel sheet (behavior contract #2)

**File:** `src/components/picker-sheet.tsx`
**Purpose:** Bottom-sheet chrome for the native date / time wheel pickers. Holds a title, close affordance, the wheel body (`children`), and Done / Clear / Cancel actions. Only the **native** date/time field variants import it (web uses real HTML inputs).

### Layout
1. Same canonical chrome (grab handle 48×8, `Radius.card` top, hairline border, `MaxFormWidth`, `theme.overlay` scrim). Honors bottom safe-area inset so actions stay reachable; `maxHeight: 92%`.
2. **Header:** `sectionTitle` title + `Glyph.cross` close button (≥48dp).
3. **Body:** the `children` — a row of `WheelColumn`s.
4. **Actions — centered, vertically stacked text buttons** (each ≥48dp, `Radius.md`, `pressed` → `theme.backgroundSelected` fill):
   - **Done** — high-contrast `theme.primary`, `FontFamily.bold`. Commits the selection.
   - **Clear** (only if `onClear` provided) — `theme.text`. Clears the field (for optional fields).
   - **Cancel** — `theme.text`. Discards the in-progress selection.

### Behavior contract
- **Backdrop-cancel** — tapping the backdrop OR the close icon cancels (discards). Inner taps are swallowed so they don't reach the backdrop.
- Caller commits **only on Done**. Done/Clear/Cancel = the three-verb footer.

### WheelColumn (sub-component, same file)
A single scrollable selection column (year/month/day/hour/minute/period). Row height = 48 (`TouchTarget.min`), 5 visible rows. Selected row = `theme.primaryBg` fill + bold + leading `Glyph.check` (never color-only). On mount it scrolls the selected value ~2 rows from top into view, once. Values are numbers; `formatValue` handles display (zero-pad, AM/PM label). `accessibilityRole="button"` + `accessibilityState={{ selected }}` per row. Column border `theme.divider`, background `theme.backgroundSunken`.

### Props (PickerSheet)
`visible`, `title`, `doneLabel`, `cancelLabel`, `clearLabel`, `closeLabel?` (defaults to cancel label), `onDone`, `onCancel`, `onClear?` (presence shows the Clear action), `children`.

Picker copy from `pickers`: Done «تم» / "Done", Clear «مسح» / "Clear", Cancel (from `common.cancel`) «إلغاء» / "Cancel".

---

## FigmaBottomSheet — the action sheet (behavior contract #3)

**File:** `src/components/figma/figma-bottom-sheet.tsx`
**Purpose:** The action bottom sheet — a rounded-top card with a grab handle + title; the caller supplies the action rows as `children`. No submit/close footer (it's the action-sheet variant).

### Layout
Same canonical chrome: grab handle 48×8 `theme.backgroundSelected`, `Radius.card` top, hairline `theme.border`, `MaxFormWidth`, `theme.overlay` scrim, `maxHeight: 85%`, honors bottom safe-area. Header = `sectionTitle` title (`accessibilityRole="header"`). Body = a scroll of the caller's action `children` (gap `Spacing.three`).

### Behavior contract
- **Backdrop-dismiss** — tapping the scrim closes (`onClose`); inner taps are swallowed. Its backdrop carries `accessibilityLabel={t('common.close')}` = «إغلاق» / "Close".
- No footer, no keyboard-avoidance. Pure action sheet.

### Props
`visible`, `onClose`, `title`, `children`.

> **The three-sheet ruling:** FormModal, PickerSheet, and FigmaBottomSheet **share the exact chrome** (centered `backgroundElement` card, `Radius.card` corners, hairline border, 8dp grab handle) but stay three components because each encodes a different behavior contract — FormModal: explicit-close + keyboard-avoidance + submit/cancel footer; PickerSheet: backdrop-cancel + Done/Clear/Cancel; FigmaBottomSheet: backdrop-dismiss, no footer. Match the chrome; never merge the behaviors.

---

## FigmaHeader — list/detail header + the 44dp back pill

**File:** `src/components/figma/figma-header.tsx`
**Purpose:** The screen header for list/detail screens: a round back button (start), a centered title, and an optional round teal "+" add button (end). Used as the first child inside `FigmaScreen`.

### Layout (row, space-between)
- **Back button (start)** — `SIZE` 44×44 round pill (`Radius.pill`), `theme.backgroundElement` fill + hairline `theme.border`, an **`ArrowRight` (lucide, 20dp)** icon in `theme.text`. `ArrowRight` = "back" in RTL (points to the start edge). `accessibilityLabel={t('common.back')}` = «رجوع» / "Back". Defaults to `router.back()`; override via `onBack`.
- **Title (center)** — `flex:1`, centered, 18dp `FontFamily.bold`, single line.
- **Trailing (end)** — if `trailing` node given, render it; else if `onAdd` given, a **round teal add button** = 44×44 `theme.primary` fill + `Plus` (lucide, 20dp) in `theme.onPrimary`, `accessibilityLabel={addAccessibilityLabel ?? t('common.add')}` = «إضافة» / "Add"; else an empty 44dp spacer (keeps the title centered).

**This 44dp back pill is the canonical back affordance** across the app; `FigmaFormScreen`'s header reuses the same atom.

### Props
`title`, `onAdd?`, `addAccessibilityLabel?`, `onBack?`, `trailing?`.

---

## FigmaScreen — the list/detail screen container

**File:** `src/components/figma/figma-screen.tsx`
**Purpose:** Full-bleed, RTL-aware column with themed background, the 20dp `Gutter`, and device top/bottom safe-area insets. The container for redesigned feature list/detail screens (replaces the legacy `Screen`).

### Behavior / props
- `scroll` (default `true`) — wraps children in a `ScrollView`; `false` renders a single non-scrolling `View`.
- `gap` (default 16) — vertical gap between direct children.
- Padding: `paddingHorizontal: Gutter` (20), `paddingTop: insets.top + 8`, `paddingBottom: insets.bottom + 24`. No max-width centering — these are full-bleed phone layouts.

---

## FigmaFormScreen — the add/edit screen shell

**File:** `src/components/figma/figma-form-screen.tsx`
**Purpose:** The "add screen" shell: a fixed header, an optional gold disclaimer banner, a scrolling stack of cards, and the save footer.

### Layout, top to bottom
1. **Fixed header** — `paddingTop: insets.top + Spacing.two`, hairline bottom divider (`theme.divider`). Contains the **44dp back pill** (matches FigmaHeader: `ArrowRight` 20dp, `theme.backgroundElement` + `theme.border`) + a stacked **title (18/bold) / subtitle (14/regular, `textSecondary`)** text block. Back button `accessibilityLabel` = the screen `title`.
2. **Disclaimer banner (optional)** — full-bleed **gold** strip (`theme.accentBg` bg, `theme.accentFg` text, 14/21 line-height). Only rendered when `disclaimer` is passed (medical/non-diagnostic screens); omit on non-medical screens.
3. **Scrolling content** — the form cards (`children`), gap `Spacing.three`, `keyboardShouldPersistTaps="handled"`.
4. **Footer** — the caller's save button (`footer`), rendered as the **last block inside** the ScrollView (not pinned — a pinned/KAV-sibling footer proved invisible on the Android device), with its own bottom safe-area padding. Omit for read-only screens.
- Wrapped in `KeyboardAvoidingView` (`padding` on iOS).

### Props
`title`, `subtitle?`, `onBack`, `disclaimer?`, `footer?`, `children`.

### Companion atoms exported from the same file
- **`FigmaSectionLabel`** — muted card section label (14/600/`textMuted`).
- **`FigmaFieldLabel`** — field label (14/600/`textSecondary`) + optional red required `*`.
- **`FigmaSwitch`** — the brand pill toggle (see below).
- **`FigmaMutedNote`** — small muted explanatory line (14/21, `textSecondary`).
- **`FigmaToggleRow`** — a label (+ optional hint) on the start, a `FigmaSwitch` on the end; optional `topDivider`. The "with food" / "link to my account" row.

### FigmaSwitch — the canonical toggle
The 48×28 brand pill: track `Radius` 14, 1.5dp border, a 20×20 **white thumb** that slides via flexbox (`justifyContent: flex-end` when on — RTL-aware). On = `theme.primary` track+border; off = `theme.backgroundSunken` track + `theme.border`. `accessibilityRole="switch"` + `accessibilityState={{ checked }}`. **This is the ONLY toggle** — never the platform `Switch`. Caller owns the boolean.

---

## FigmaSegmentedTabs — the mine/all style in-screen tabs

**File:** `src/components/figma/figma-segmented-tabs.tsx`
**Purpose:** The in-screen segmented control (today/all, today/open/done, upcoming/completed, and the «مهامي / كل المهام» mine/all scope toggle).

### Layout / behavior
- A row of **equal-width tabs** (`flex:1`), each `minHeight: 44`, `Radius.md`, hairline border, `paddingVertical: 10`, 8dp gap.
- **Active tab:** `theme.primary` fill + `theme.primary` border, label `theme.onPrimary` in `FontFamily.semibold`.
- **Inactive tab:** `theme.backgroundElement` fill + `theme.border`, label `theme.textSecondary` in `FontFamily.medium`.
- Label 14dp. Each tab `accessibilityRole="button"` + `accessibilityState={{ selected }}`.

### Props
`tabs: { key, label }[]`, `activeKey`, `onChange(key)`.

---

## FigmaListRow — the grouped-list row

**File:** `src/components/figma/figma-list-row.tsx`
**Purpose:** A grouped-list row (Explore / Account / Members idiom): a tinted identity chip (or letter avatar) + title + optional subtitle + trailing chevron. Designed to sit inside a `Surface` (padding 0) as a hairline-separated group.

### Layout (row)
- **Leading:** a `GlyphChip` — either `iconName` (semantic icon, `size="md"`) or `avatarText` (a letterform, e.g. a member initial). Tint via `color` (a theme key; default `primary`).
- **Text block:** title (16/`semibold`/`theme.text`, single line) + optional subtitle (14/regular/`theme.textSecondary`, single line).
- **Trailing:** the `trailing` node if given; else if `onPress` set, a `ChevronLeft` (lucide, 18dp, `theme.textSecondary`) forward chevron; else nothing.
- Row: gap 16, padding 16, `minHeight: 68`. `topDivider` adds a hairline top border (used on every row but the first in a group). Pressable rows get `android_ripple` + 0.85 pressed opacity, `accessibilityRole="button"`, `accessibilityLabel={title}`, `accessibilityHint={subtitle}`.
- Also exports a `FigmaSectionLabel` eyebrow (14/bold/`textSecondary`, letterSpacing 0.5) for above a group.

### Props
`iconName?`, `color?` (ThemeColor), `avatarText?`, `title`, `subtitle?`, `onPress?`, `trailing?`, `topDivider?`.

---

## FigmaFooterPrimaryButton — the one form CTA

**File:** `src/components/figma/figma-footer-primary-button.tsx`
**Purpose:** THE single primary CTA for every add / save / create form.

### Visual / behavior
- A **plain RN `Pressable`** (deliberately minimal — a raw shape that proved reliably visible on the Android device). Full-width, `minHeight: 56` (Sanad primary-action floor), `Radius` 12, `paddingHorizontal: 20`, filled `theme.primary`, centered label 16/700 in `theme.onPrimary`.
- **No `variant`, `disabled`, or `style` prop** — a caller cannot collapse it to faint/grey text, and there is **no disabled state** for validation-incomplete forms (the caller's submit handler validates and shows inline errors while this stays a visible teal button).
- The **only** state is `loading`: a high-contrast `ActivityIndicator` (in `onPrimary`) that also blocks double-submit (`disabled={loading}`, `accessibilityState={{ busy }}`).

### Props
`label`, `onPress`, `loading?`, `accessibilityHint?`.

---

## FormActions / StickyFormActions — inline form footer

**File:** `src/components/form-actions.tsx`
**Purpose:** Inline (or sticky) form action block: the primary save button (+ optional non-destructive secondary), with an inline saved/error status line. Destructive actions (delete) deliberately live elsewhere so save is never mixed with them.

### Layout
1. **Status line** (optional) — when `status='saved'` shows `savedLabel` in `theme.successFg`; when `status='error'` shows `errorLabel` in `theme.errorFg`. Both `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`, 14/`semibold`.
2. **Primary save** — `FigmaFooterPrimaryButton` labelled `saveLabel` (busy-gated by `saving`).
3. **Secondary** (optional) — `Button variant="secondary"` labelled `secondaryLabel`, disabled while saving.

- **`FormActions`** — inline variant (render at the logical end of a form; `marginTop: Spacing.two`).
- **`StickyFormActions`** — sticky bottom container for long forms: render as a **sibling AFTER** the ScrollView (not inside it) so it stays reachable; adds a hairline top divider (`theme.divider`) and respects the bottom safe-area inset; inner content capped to `MaxFormWidth`.

### Props (shared)
`saveLabel`, `onSave`, `saving?`, `status?` (`'idle' | 'saved' | 'error'`), `savedLabel?`, `errorLabel?`, `secondaryLabel?`, `onSecondary?`, `saveAccessibilityHint?`. (`FormActions` also takes `style`.)

---

## ItemActions — the two-step inline delete

**File:** `src/components/item-actions.tsx`
**Purpose:** Edit + delete actions for a list row, with an **inline two-step delete confirm** (sanctioned confirmation pattern #2). Deliberately avoids `Alert.alert` (unreliable on react-native-web) so it behaves identically on web and native.

### Behavior / states
- **Default state:** two small buttons in a row — **Edit** (`Button size="sm" variant="secondary"`, label `labels.edit`) and **Delete** (`Button size="sm" variant="danger"`, label `labels.delete`). Both disabled when `disabled`.
- **Tapping Delete** swaps the pair in place for a **confirm/cancel** pair: **Confirm** (`variant="danger"`, label `labels.confirm`, shows `loading` while `deleting`) and **Cancel** (`variant="secondary"`, label `labels.cancel`, returns to default). No modal — an in-place two-step.

### Props
`onEdit`, `onDelete`, `deleting?`, `disabled?`, `labels: { edit, delete, confirm, cancel }`.

Typical labels from `common`: Edit «تعديل» / "Edit", Delete «حذف» / "Delete", Confirm delete «تأكيد الحذف» / "Confirm delete", Cancel «إلغاء» / "Cancel".

---

## DateField — the date picker (native)

**File:** `src/components/date-field.tsx` (native; `date-field.web.tsx` uses `<input type="date">`)
**Purpose:** Labeled date field that opens a touch-friendly scrollable wheel picker (year / month / day) — no manual `YYYY-MM-DD` typing. Stores/emits `'YYYY-MM-DD'` (or `''` when cleared).

### Layout
1. **Label** (optional, `smallBold`).
2. **Trigger** — a `Pressable` styled like a field: `theme.backgroundSunken` fill, 1.5dp border (`theme.errorFg` when `error`, else `theme.border`), `Radius.md`, `minHeight: TouchTarget.comfortable` (52). Shows the value (or `placeholder`, or `t('pickers.setDate')` = «اختر التاريخ» / "Choose date") in `theme.text` / `theme.textMuted`, plus a trailing `Glyph.chevron`.
3. **Error line** (optional) — `theme.errorFg`, `accessibilityRole="alert"`.
4. Opens a **PickerSheet** (title = label or `t('pickers.selectDate')` = «اختيار التاريخ» / "Select date") containing the wheel columns.

### Wheel & behavior
- Three `WheelColumn`s labelled Year «السنة» / "Year", Month «الشهر» / "Month", Day «اليوم» / "Day". Month/day zero-padded (`pad2`).
- **RTL column order:** day → month → year (so Arabic reads d-m-y from the right); LTR order year → month → day. Stored value unaffected.
- **Year range:** default `thisYear − 120` … `thisYear + 5` (birth dates reach 120 years back). If `minDate` set, the wheel cannot scroll earlier than it (past dates unreachable) and month/day columns clamp to the min within the min year.
- **Done** commits (`onChange` the clamped `YYYY-MM-DD`); **Cancel/backdrop** discards; **Clear** (only when `clearable`) emits `''`.

### Props
`label?`, `value` (`'YYYY-MM-DD'|''`), `onChange`, `error?`, `placeholder?`, `disabled?`, `clearable?` (default false — shows the Clear action), `minDate?` (`'YYYY-MM-DD'`, inclusive floor), `accessibilityLabel?`.

---

## TimeField — the time picker (12-hour UX, 24-hour storage)

**File:** `src/components/time-field.tsx` (native; `time-field.web.tsx` uses `<input type="time">`)
**Purpose:** Labeled time field opening a touch-friendly wheel. Shows a **12-hour Arabic UX** (hour 1–12, minutes, صباحًا / مساءً period) but **stores/emits 24-hour `'HH:MM'`** (or `''`), so duplicate-time checks, schedules and notifications are unchanged.

### Layout
- Same trigger shape as DateField (`theme.backgroundElement` fill, 1dp border, `Radius.md`, `minHeight: 52`) with a trailing `Glyph.chevron`. Displays the value formatted as 12-hour (`formatHm12`, e.g. `8:00 صباحًا`), or `placeholder` / `t('pickers.setTime')` = «اختر الوقت» / "Choose time".
- Opens a **PickerSheet** (title = label or `t('pickers.selectTime')` = «اختيار الوقت» / "Select time").

### Wheel columns
- **Hour** «الساعة» / "Hour" — values 1–12.
- **Minute** «الدقيقة» / "Minute" — 0–59 (or stepped by `minuteStep`, always includes 0), zero-padded.
- **Period** «الفترة» / "Period" — a 2-value column: AM «صباحًا» / "AM", PM «مساءً» / "PM".
- Done commits (converts 12h→24h via `from12h`, emits `HH:MM`); Cancel discards; Clear (if `clearable`) emits `''`.

### Props
`label?`, `value` (`'HH:MM'|''`), `onChange`, `error?`, `placeholder?`, `disabled?`, `clearable?`, `minuteStep?` (default 1), `accessibilityLabel?`.

---

## DateTimeField — a date + time pair

**File:** `src/components/date-time-field.tsx`
**Purpose:** A date + time pair for editing a single instant (e.g. a vital reading's time). Composes the platform-aware `DateField` + `TimeField` side by side (wrapping row; each column `flexBasis: 160`). The caller keeps the two parts as `'YYYY-MM-DD'` + `'HH:MM'` and combines them into an ISO timestamp at save time.

### Props
`label?` (section heading, `smallBold`), `dateValue`, `timeValue`, `onChangeDate`, `onChangeTime`, `dateLabel?`, `timeLabel?`, `dateError?`, `timeError?`, `disabled?`.

### date-time-shared.ts (pure helpers + shared prop contracts)
`src/components/date-time-shared.ts` holds the `DateFieldProps` / `TimeFieldProps` contracts (native + web implement the same props so callers are platform-agnostic) and pure helpers: `pad2`, `rangeInclusive`, `daysInMonth` (leap-aware), `parseYmd`/`formatYmd`, `parseHm`/`formatHmParts`, `to12h`/`from12h`, `formatHm12`. Storage formats are always `'YYYY-MM-DD'` (dates) and 24-hour `'HH:MM'` (times), or `''` when unset.

---

## TimezonePicker — searchable timezone sheet

**File:** `src/components/timezone-picker.tsx`
**Purpose:** Searchable, touch-friendly timezone selector. Returns only the IANA `id`; the caller confirms + persists.

### Layout
1. Bottom-sheet chrome (`MaxFormWidth`, `Radius.xl` (24) top corners, hairline border, `theme.overlay` scrim). Grab handle here is 44×5dp. Honors bottom safe-area.
2. **Header:** title `t('circleTimezone.pickerTitle')` = «اختيار المنطقة الزمنية» / "Choose timezone" + `Glyph.cross` close (`t('common.close')`). **No backdrop dismissal — close is explicit.**
3. **Search box** — `TextInput`, placeholder `t('circleTimezone.searchPlaceholder')` = «ابحث بالمدينة أو الدولة» / "Search by city or country". Matches city or country in either language, or the raw IANA id.
4. **List:**
   - **"This device" section** — label `t('circleTimezone.deviceSection')` = «هذا الجهاز» / "This device"; one row `t('circleTimezone.useDevice', {tz})` = «استخدام منطقة هذا الجهاز ({{tz}})» / "Use this device's timezone ({{tz}})".
   - **"All timezones" section** — label `t('circleTimezone.otherSection')` = «كل المناطق الزمنية» / "All timezones". Each row: a localized **"City, Country"** primary line + the **IANA id** as an LTR secondary line. The currently-set row shows a trailing badge `t('circleTimezone.currentLabel')` = «الحالية» / "Current".
   - **Empty search:** `t('circleTimezone.noResults')` = «لا توجد مناطق زمنية مطابقة» / "No matching timezones".

### Row states
Selected row = `theme.primaryBg` fill + transparent border + bold primary line + leading `Glyph.check`; unselected = `theme.backgroundSelected` + `theme.border`. `minHeight: 56`. `accessibilityRole="button"` + `accessibilityState={{ selected }}`, 0.7 pressed opacity.

### Props
`visible`, `currentId`, `deviceTz`, `onSelect(id)`, `onClose`.

> Note: selecting a row only reports the id; the surrounding circle-timezone screen owns the **confirm** step — `t('circleTimezone.confirm')` = «تأكيد التغيير» / "Confirm change" with body `confirmChange` «تغيير من {{from}} إلى {{to}}؟» / "Change from {{from}} to {{to}}?", and the failure copy `error` «تعذّر تحديث المنطقة الزمنية. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't update the timezone. Check your connection and try again."

---

## InfoBanner — the tinted notice row

**File:** `src/components/info-banner.tsx`
**Purpose:** A contained, tinted notice row (small tone chip + message + optional action line) — replaces floating gray disclaimer paragraphs / emoji hint rows with one calm treatment. Built on `Surface` + `GlyphChip`.

### Layout
A `Surface` (padding `Spacing.three`, `bordered={false}`, tone-tinted) with a leading `GlyphChip` (`size="sm"`, tone icon) + a text block: the `text` message (`type="small"`) and an optional `actionText` link/hint line (`type="smallBold"`, e.g. "Manage settings ›").

### Tones
`info`, `warning`, `neutral`, `accent`. `neutral` → `sunken` Surface + `textSecondary` text; others → matching tinted Surface + `${tone}Fg` text. The chip icon is `warning` for the warning tone, else `info`. **The gold `accent` tone is reserved for celebratory/empty moments; caution uses `warning` (amber), never gold** — per the M5 danger/accent ruling.

### Props
`text`, `actionText?`, `tone?` (default `info`), `onPress?` (whole banner tappable), `accessibilityLabel?`.

---

## UnsavedChangesGuard — leave-confirmation for dirty forms

**File:** `src/components/unsaved-changes-guard.tsx` (uses `src/hooks/use-navigation-guard.ts`)
**Purpose:** Drop-in guard for create/edit forms with unsaved edits. Renders nothing; render it inside the form and pass `when={dirty}`.

### Behavior
- Intercepts the navigator's `beforeRemove` (hardware/gesture/header back) while `when` is true, and prompts before leaving. A no-op when `when` is false (clean forms navigate normally).
- **Native:** `Alert.alert` with two buttons — Cancel (`style:'cancel'`) and a destructive Confirm. **Web:** `window.confirm` (title + message).
- Copy (centralized under `common` so every form warns the same):
  | Key | Arabic | English |
  |---|---|---|
  | `common.unsavedTitle` | «تغييرات غير محفوظة» | "Unsaved changes" |
  | `common.unsavedMessage` | «لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟» | "You have unsaved changes. Leave without saving?" |
  | `common.discardChanges` (confirm) | «تجاهل التغييرات» | "Discard changes" |
  | `common.keepEditing` (cancel) | «متابعة التعديل» | "Keep editing" |

### Props
`when: boolean`.

---

## Copy reference — `common` namespace (both locales)

| Key | Arabic | English |
|---|---|---|
| `edit` | تعديل | Edit |
| `details` | التفاصيل | Details |
| `delete` | حذف | Delete |
| `call` | اتصال | Call |
| `confirmDelete` | تأكيد الحذف | Confirm delete |
| `cancel` | إلغاء | Cancel |
| `save` | حفظ | Save |
| `saveChanges` | حفظ التغييرات | Save changes |
| `close` | إغلاق | Close |
| `back` | رجوع | Back |
| `add` | إضافة | Add |
| `ok` | حسنًا | OK |
| `yes` | نعم | Yes |
| `no` | لا | No |
| `unsavedTitle` | تغييرات غير محفوظة | Unsaved changes |
| `unsavedMessage` | لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟ | You have unsaved changes. Leave without saving? |
| `discardChanges` | تجاهل التغييرات | Discard changes |
| `keepEditing` | متابعة التعديل | Keep editing |

## Copy reference — `pickers` namespace (both locales)

| Key | Arabic | English |
|---|---|---|
| `setDate` | اختر التاريخ | Choose date |
| `setTime` | اختر الوقت | Choose time |
| `selectDate` | اختيار التاريخ | Select date |
| `selectTime` | اختيار الوقت | Select time |
| `year` | السنة | Year |
| `month` | الشهر | Month |
| `day` | اليوم | Day |
| `hour` | الساعة | Hour |
| `minute` | الدقيقة | Minute |
| `period` | الفترة | Period |
| `am` | صباحًا | AM |
| `pm` | مساءً | PM |
| `done` | تم | Done |
| `clear` | مسح | Clear |

---

## Workflows

### 1. Fill and submit a text field with validation
1. Screen renders a `FormField` with `label`, `required`, `placeholder`, and optionally a `hint`.
2. User focuses the field → border thickens to 2dp in `theme.primary` (clear active cue).
3. User types; the caller updates `value` via `onChangeText`.
4. User taps the primary CTA (`FigmaFooterPrimaryButton` / `FormActions`). The caller's submit validates.
5. If invalid, the caller sets `error` on the offending `FormField` → the hint is replaced by a red `accessibilityRole="alert"` line and the border turns `errorFg`. The CTA stays a visible teal button (no disabled/grey state).
6. If valid, submit proceeds; on save the form may show `FormActions` `status='saved'` (`savedLabel` in green) or `status='error'` (`errorLabel` in red).

### 2. Pick a single option (chip)
1. `OptionSelect variant="chip"` renders the enum as a wrap of pills, current `value` shown selected (brand tint + bold + leading check).
2. User taps a pill → `onChange(value)`; the newly-selected pill gains the tint + check, the old one reverts.

### 3. Pick a role/type with explanation (card)
1. `OptionSelect variant="card"` renders full-width rows, each with a radio + title + `description`.
2. User taps a row → radio fills `theme.primary` with a check, title goes bold `primaryText`; `onChange(value)`.

### 4. Choose the days of a recurring schedule
1. `WeekdaySelector` renders with no days selected (opt-in).
2. User taps individual day chips to select them (each toggles; selected = filled + check), or taps the full-width "Every day" chip to select all seven (tap again to clear all).
3. Parent schema validates "≥1 day"; if none, the caller passes an `error` string → red alert line.

### 5. Add/edit an item in a form modal (FormModal)
1. Caller opens `FormModal` (`visible=true`) — sheet slides up over the scrim with the grab handle, `sectionTitle`, and a close (×) icon.
2. User fills the `children` fields (keyboard-avoidance keeps them visible).
3. To dismiss without saving, user taps the × or Cancel «إلغاء» (backdrop tap does NOT dismiss).
4. User taps the primary CTA (`submitLabel`) → `onSubmit`; while submitting the CTA shows a spinner and Cancel is disabled. On failure the caller sets `error` → a red alert line above the footer.

### 6. Pick a date (native wheel)
1. User taps the DateField trigger → `PickerSheet` slides up with three wheels (RTL: day / month / year).
2. User scrolls each wheel; the selected row is filled + bold + checked.
3. User taps **Done «تم»** → the field commits `YYYY-MM-DD`. Or **Cancel «إلغاء»** / backdrop → discards. Or **Clear «مسح»** (if `clearable`) → empties the field.

### 7. Pick a time (12-hour UX)
1. User taps the TimeField trigger → `PickerSheet` with Hour (1–12), Minute, Period (صباحًا / مساءً) wheels.
2. User selects; **Done** converts to 24-hour and commits `HH:MM` (display shows e.g. `8:00 صباحًا`). Cancel discards; Clear empties.

### 8. Choose a care-circle timezone
1. Caller opens `TimezonePicker` (`visible=true`).
2. User optionally types in the search box (matches city/country in either language or the IANA id).
3. User taps the "This device" shortcut row or any "City, Country" row → `onSelect(id)` fires; the picker reports only the id.
4. The surrounding screen shows the confirm step (`confirmChange` «تغيير من {{from}} إلى {{to}}؟») and persists; on failure it shows `circleTimezone.error`.

### 9. Delete a list item (two-step inline)
1. Row shows `ItemActions` with Edit + Delete.
2. User taps **Delete «حذف»** → the buttons swap in place to **Confirm delete «تأكيد الحذف»** + **Cancel «إلغاء»** (no modal).
3. User taps Confirm → `onDelete` runs (button shows loading); or Cancel → returns to Edit/Delete.

### 10. Leave a form with unsaved edits
1. `UnsavedChangesGuard when={dirty}` is mounted inside the form.
2. User triggers back (gesture / header back pill / hardware back) while dirty → the navigator's `beforeRemove` is intercepted.
3. Native: an Alert «تغييرات غير محفوظة» / «لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟» with **متابعة التعديل** (stay) and **تجاهل التغييرات** (leave). Web: `window.confirm`.
4. Choosing discard dispatches the original navigation; choosing keep-editing stays on the form.

### 11. Switch a list scope (mine / all) or view tab
1. A screen renders `FigmaSegmentedTabs` with e.g. «مهامي / كل المهام» (mine/all) or today/open/done tabs.
2. User taps a tab → `onChange(key)`; the tapped tab fills `theme.primary` with `onPrimary` label, the others revert to card + hairline. The list re-queries for that scope/filter.
