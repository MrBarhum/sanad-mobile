# Android Responsive Redesign & Date/Time Picker Hardening

**Date:** 2026-06-12
**Status:** Implemented locally. **Not committed.** No SQL, no deployment, no EAS build, no Firebase CLI action performed. The project owner will test on-device and commit.
**Scope:** App-wide UI/UX redesign + Android real-device hardening for Sanad (Arabic-first care coordination). All changes are JavaScript/TypeScript/styling only — **no new native module** — so they load on the **existing Development Build** via a Metro reload (no rebuild required to test).

---

## 1. Executive summary

Real-device testing on a Samsung Galaxy S24 Ultra exposed systemic UI failures (content clipped off-screen, narrow/awkward cards, wasted space) and two release-blocking functional bugs (the Android date and time pickers rendered as blank surfaces). The screenshots were treated as evidence of **systemic** failure, not isolated screen bugs.

Two root causes explained almost everything:

1. **App-wide clipping (Bug A)** — every screen re-rolled the same broken container: an outer `View { flex:1, alignItems:'center' }` wrapping a `ScrollView` whose `contentContainerStyle` was `{ width:'100%', maxWidth, alignSelf:'center' }`. Because the parent **centered** instead of stretching and the `ScrollView` was never width-constrained, the scroll view sized to its **intrinsic content**: wide content (a long unwrapped Arabic disclaimer, button rows) overflowed past the viewport (Medications), while narrow content collapsed into a too-narrow centered column (Doctors).

2. **Blank date/time picker (Bugs C & D)** — the native picker is a custom dependency-free wheel (`PickerSheet` + `WheelColumn`). Its wheel columns used `flex:1` inside a wrapper that had no width/flex, so they **collapsed to zero width** — an invisible body with only the title and action buttons showing. (Confirmed by the prior step report: the wheel was "verified by tsc + web export and code review, but **not run on a physical device**.")

The fix was to build a real design system, repair the two systemic root causes once in shared primitives, and migrate every screen onto them. A 6-color → semantic token system replaced scattered hex literals; the pure black/white "primary" buttons became a calm brand blue; status is never communicated by color alone; and LTR data (phones, emails, codes, times) is bidi-isolated for correct rendering inside the RTL layout.

The picker repair is deliberately **JS-only** (fix the wheel, don't add a native module): adding `@react-native-community/datetimepicker` would have required an EAS rebuild that this slice is forbidden from doing — and would have *blocked* the very on-device reminder testing the task aims to unblock. The fixed wheel is a genuinely usable, large-target, RTL-aware picker that runs on the current build.

---

## 2. Screenshot findings (S24 Ultra, dark theme)

| # | Screen | Observed | Diagnosis |
|---|--------|----------|-----------|
| 1 | Medications (`الأدوية`) | Disclaimer text, the white "إضافة دواء" button, and dose cards all spill **off the left edge**; content is wider than the viewport, anchored right (RTL) | Container clipping antipattern — content sized to intrinsic width, not constrained to the screen |
| 2 | Doctors (`الأطباء`) | A single **narrow, floating** card with huge empty space; weak hierarchy; awkward phone presentation; Edit/Delete poorly separated | Same container, opposite symptom: narrow content collapses to a too-narrow centered column |
| 3 | Schedule editor / time picker (`اختيار الوقت`) | Weekday chips fine, then a **blank** area where the time wheel should be; only "تم"/"إلغاء" show | `WheelColumn`s collapsed to zero width inside the picker sheet |
| 4 | Task details / date picker (`تاريخ الاستحقاق`) | **Blank** picker body; only "تم"/"مسح"/"إلغاء" show | Same zero-width wheel collapse (date variant, clearable → "مسح") |

Secondary issues seen across the set: stark pure-white primary buttons in dark mode; status conveyed by color only; phone numbers/emails without LTR isolation; inconsistent gutters and card widths.

---

## 3. Root causes

1. **No shared screen primitive.** ~25 screens duplicated the `alignItems:'center'` + unconstrained-`ScrollView` pattern, so the clipping/collapse bug was everywhere and drifted per screen.
2. **Picker wheel zero-width collapse.** `flex:1` children in a shrink-to-fit (`auto`-width) row parent resolve to width 0; the wheels rendered but were invisible.
3. **Impoverished tokens.** Only 5 colors (text/background/backgroundElement/backgroundSelected/textSecondary). No brand, border, or semantic colors → hardcoded `#dc2626`/`#16a34a`/`#d97706`/`#208AEF` scattered across ~30 files, and the "primary" button was a pure black/white inversion.
4. **Color-only status.** Medication dose status, task/appointment/visit status, the emergency card, and the notification bell communicated meaning with color alone.
5. **RTL/BiDi gaps.** Phone numbers, emails, invitation codes, IANA ids and times were rendered without LTR isolation; the notification badge used a physical `right` offset.

---

## 4. Design-system decisions

### Tokens (`src/constants/theme.ts`)
- **Brand:** `primary` (calm blue `#1B63C5` light / `#2768CC` dark), `onPrimary`, `primaryBg` (soft tint), `primaryText` (brand text on normal surfaces).
- **Structure:** `border` (hairline definition for cards on both canvases).
- **Semantic (fg + soft bg):** `successFg/Bg`, `warningFg/Bg`, `errorFg/Bg`, `infoFg/Bg` — used by `StatusBadge`, error/success text, tinted surfaces.
- **Retuned base palette** for a calm, premium feel: light canvas `#F4F6F9` with white cards; dark canvas `#0B0C0F` with lifted `#191B20` cards; cards carry a hairline border so they read on both.
- **Scales:** `Radius` (sm/md/lg/xl/pill), `TouchTarget` (min 48 / comfortable 52), `Gutter` (20). `MaxContentWidth` 720, `MaxFormWidth` 480.
- All existing token keys preserved → every prior consumer keeps working; the rest is additive.

### Primitives
New (`src/components/`): **`Screen`**, **`Surface`/`Card`/`Section`**, **`StatusBadge`**, **`ContactCard`**, **`IconButton`**, **`LtrText`/`isolateLtr`**.
Refined: **`Button`** (brand primary, `plain` variant, 48dp), `ThemedText` (`sectionTitle`/`cardTitle`), `FormField`, `FormModal`, `states`, `weekday-selector`, `form-actions`, `picker-sheet`, `timezone-picker`, `reminder-notice`. APIs kept backward-compatible.

---

## 5. The `Screen` primitive — how the clipping fix works

```
<ThemedView flex:1>
  [KeyboardAvoidingView?]
    <ScrollView style={flex:1}                 ← fills the FULL width (no alignItems:center anywhere)
      contentContainerStyle={flexGrow:1, paddingHorizontal:gutter, padTop, padBottom}>
      <View width:'100%' maxWidth alignSelf:'center'>   ← one column: full width on phones, capped+centered on tablet/web
        {children}                              ← stretch to the column width → text wraps, cards use full width
      </View>
    </ScrollView>
  [footer? — sticky, OUTSIDE the scroll]
</ThemedView>
```

Key correctness points: the `ScrollView` has `style={{flex:1}}` so it fills the available width; a single inner column caps at `maxWidth` and centers; children stretch to that column so long Arabic text wraps and cards use the full phone width. Safe-area insets are applied as padding (`edges` defaults to bottom-only because most screens sit under a native Stack header; tab/auth screens pass `edges={{top:true}}`); the bottom inset + generous padding keep the last item clear of the Android navigation bar. No directional (left/right) padding — RTL-agnostic. Optional `keyboardAvoiding`, sticky `footer`, `refreshControl`, and vertical `center` (for empty/error states).

---

## 6. Date/time picker solution (release-blocking)

**Root cause:** in `PickerSheet`, the body wrapped the field's `columns` row, and the `WheelColumn`s used `flex:1` with no defined parent width → **zero-width collapse** → blank picker.

**Fix (`src/components/picker-sheet.tsx`):**
- The sheet `body` is now a plain **full-width block** (column direction), so the field's `columns` row stretches to the full sheet width and the `flex:1` wheels fill their thirds. (One-line structural root-cause fix.)
- Polished into a real, usable native-feeling picker: bottom safe-area inset so actions are always reachable; `maxHeight 92%`; **48dp** wheel rows; a visible header **close** affordance; the selected row marked with a **check glyph + bold + brand tint** (not color-only); hairline-bordered columns; auto-scroll to the current value preserved.
- **Web is unchanged** — `date-field.web.tsx` / `time-field.web.tsx` still use native `<input type="date|time">`.
- **No new dependency, no native rebuild** — works on the current Development Build via JS reload.

Values still flow in the exact formats the app + Supabase expect (`YYYY-MM-DD`, 24-hour `HH:MM`, `''` when cleared), so all zod validation (`isValidYmd`/`isValidHm`) is untouched. Cancel discards, Done commits, reopening shows the saved value, Clear empties optional fields, Android back dismisses, day-of-month clamps to month length. Every date/time field across the app (medications schedule times + start/end, tasks, appointments, visits, daily logs, vitals date+time, recipient/onboarding birth date, quiet-hours via notification settings, timezone selection) shares this one implementation.

---

## 7. Files created

| File | Purpose |
|------|---------|
| `src/components/screen.tsx` | Responsive screen container — fixes app-wide clipping; safe-area, sticky footer, keyboard avoidance, pull-to-refresh, max-width centering |
| `src/components/surface.tsx` | `Surface`/`Card` (themed panel, hairline border, tones, pressable) + `Section` (accessible heading + spacing) |
| `src/components/status-badge.tsx` | Soft-tinted badge with a tone **glyph** + label — status is never color-only |
| `src/components/contact-card.tsx` | Doctor/emergency-contact card; LTR phone with **one-tap call** |
| `src/components/icon-button.tsx` | 48dp accessible icon button for secondary actions |
| `src/components/ltr-text.tsx` | `LtrText` + `isolateLtr` — bidi-isolate LTR values (phone/email/code/time/id) inside RTL |
| `docs/claude-reports/2026-06-12-android-responsive-redesign-and-picker-hardening.md` | This report |

## 8. Files modified (shared chrome & tokens)

`src/constants/theme.ts` (tokens), `src/components/themed-text.tsx` (sectionTitle/cardTitle), `button.tsx`, `form-field.tsx`, `form-modal.tsx`, `states.tsx`, `weekday-selector.tsx`, `form-actions.tsx`, `picker-sheet.tsx`, `timezone-picker.tsx`, `src/features/notifications/reminder-notice.tsx`.

## 9. Every major screen migrated

**Auth/onboarding:** sign-in, sign-up, care-circle onboarding. **Home/dashboard:** home index (error branch), circle-dashboard, circle-gate. **Care-circle selection:** circle-switcher, circle-timezone-card. **Recipient profile.** **Emergency:** contacts-manager (→ `ContactCard`), emergency-card. **Doctors** (→ `ContactCard`). **Medications:** center, form, editor, schedule-summary (schedule editor via `ScheduleFields` + fixed picker). **Tasks:** center, form, editor, card. **Appointments / Visits / Daily-logs / Vitals:** centers, forms, fieldsets, editors, dashboard cards. **Members & invitations:** members-manager, role-modal, invitations-list, invite-form, join-form. **Notifications:** center, settings, push-status-card, bell. **Account.** All list/center screens use `Screen` + `Surface`/`Section`; all forms use `Screen` (+ keyboard avoidance / sticky `StickyFormActions` where they had them); all cards use `Surface`; status uses `StatusBadge`.

---

## 10. Android-specific fixes
- Blank date/time pickers repaired (§6) — the headline Android defect.
- Content no longer clips off the left edge; full phone width with consistent gutters (§5).
- Scroll content clears the Android navigation bar (bottom safe-area inset + generous padding).
- Tab/auth screens honor the top safe-area inset via `edges={{top:true}}`.
- Notification permission channel-before-prompt behavior preserved (it lives in `push-registration`/`hooks.ts`, untouched).

## 11. RTL / BiDi fixes
- Phone numbers, emails, invitation codes, IANA timezone ids, and times now render via `LtrText` / `isolateLtr` so their internal order is correct and they never flip the surrounding Arabic layout.
- `ContactCard` renders phones LTR and offers a one-tap call.
- The notification bell badge moved from a physical `right:2` to the logical `end:2` (RTL-correct corner).
- Layouts use `flexDirection:'row'` + `justifyContent:'space-between'` and `gap` (mirror-safe) rather than `row-reverse`/`marginLeft/Right` hacks. Headings remain start-aligned via inherited RTL direction (no hardcoded `textAlign`).

## 12. Accessibility improvements
- Touch targets ≥ 48dp (buttons, icon buttons, picker rows, weekday chips, modal close).
- Status is never color-only — `StatusBadge` pairs a tone glyph + text label; selection states add a check + bold + tone, not just color.
- `Section` emits `accessibilityRole="header"`; pressable `Surface`/`IconButton`/`ContactCard` carry roles/labels/hints/state (incl. `selected`).
- Primary actions are always labeled `Button`s (no tiny icon-only primary actions); larger, calmer brand-blue primary replaces the stark white/black inversion.
- `EmptyState`/`ErrorState`/`LoadingState` upgraded with clearer icons and tokenized colors.

## 13. Notification settings verification
- The opt-in/permission/privacy logic (`usePushRegistration`, `push-registration.ts`, `hooks.ts`) was **not changed** — only presentation. Verified preserved: `enable()` is the **only** permission-prompting path (explicit, user-initiated); `ensureAndroidChannel()` runs **before** `requestPermission()`; `refresh()` re-registers on launch/resume **without** prompting; web is reported unsupported; the device-token/permission state drives the settings UI accurately; the "push enabled" state now shows as a `StatusBadge` (not color-only).
- No Edge Function deployed, no cron enabled, no remote scheduling attempted.

---

## 14. Validation commands & results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **Pass** — 0 errors (strict TS) |
| `npx expo-doctor` | **21/21 checks passed** |
| `npx expo export --platform web` | **Success (exit 0)** — every route bundled, incl. the web date/time `<input>` variants; `dist/` removed afterward |
| locale ar/en parity (node) | **787 / 787**, no missing keys either side |
| `git --no-pager diff --check` | **Clean** (no whitespace errors) |

Resolved Expo config confirmed intact: `owner: mrbarhum`, `android.package: com.mrbarhum.sanadcare`, `android.googleServicesFile: ./google-services.json`, `extra.eas.projectId: 64d5dd55-2fc6-4f15-805b-534a3444b410`, `expo-notifications` plugin, `expo-dev-client` dependency. The pre-existing intentional changes (EAS ownership/projectId, Android package, Firebase, notifications plugin, dev-client, SDK patch alignment, channel hardening) were **not** touched.

### 14.1 Adversarial review & fixes applied

After the migration, every changed file was diffed against `HEAD` by an independent adversarial review pass looking for behavior changes, layout/RTL/a11y regressions, and lost functionality. **Result: behavior was preserved everywhere** — no logic, validation, permission gating, query keys, mutations, navigation, data formats, unsaved-changes guards, notification opt-in/privacy, or `t()` keys changed. Issues it surfaced were fixed:

- **(high ×2) Partial bidi isolation in Vitals.** `vitals-center` / `vital-editor` isolated only the time, leaving the date in the RTL run (date/time could reorder). Fixed to isolate the whole `YYYY-MM-DD HH:MM` as one LTR unit (matching the appointments pattern).
- **(a11y) Notification badge contrast.** The unread count used `errorFg`, which is intentionally lighter in dark mode (weak white-on-fill contrast). Switched to a fixed saturated badge red (`#D92D20`) so the white count is legible in both themes (white passes ≈4.8:1).
- **(a11y) Circle row announcement.** The single `accessibilityLabel={circleName}` suppressed the recipient/role/current context; rebuilt as a composite label. Added a `selected` accessibility state to `Surface` (the migration had dropped the original `selected` flag).
- **(consistency) Completed the token migration.** Tokenized the last `#dc2626` literals in the native + web date/time fields and the medication schedule fields (`errorFg`/`border`); restored pull-to-refresh on the notifications inbox via a new `Screen.refreshControl` prop; restored `EmptyState` to a raised card so it stays visible on the canvas; replaced one raw `gap:8` literal with `Spacing.two`.

The only review item intentionally left as-is is `src/components/animated-icon.tsx` (an unused Expo-template demo file).

---

## 15. Remaining known limitations

- **Device picker smoke test pending.** The picker fix is verified by code review, `tsc`, and web export; it must still be exercised on the S24 Ultra (it should now render a full, scrollable wheel rather than a blank surface).
- **Custom wheel, not the OS Material picker.** By design for this slice (JS-only, no rebuild). If the OS-native calendar/clock is later preferred, `@react-native-community/datetimepicker` can be added via `npx expo install` — but that requires a new Development Build.
- **`emergency-card` free-text values** (allergies/conditions) are not LTR-isolated because they are Arabic; only inherently-LTR values are isolated.
- **Light theme** retuned but, like the picker, validated by build + review rather than on-device.

---

## 16. Manual Android QA checklist (S24 Ultra)

1. S24 Ultra Development Build, reload JS (no rebuild needed).
2. Android **light** theme — every screen.
3. Android **dark** theme — every screen.
4. **Increased system font size** — labels/cards don't clip; text wraps.
5. **Arabic** locale (default) — RTL correct, nothing clips off the left edge.
6. **English** locale.
7. **Medications** list + dose actions (given/postponed/missed) — full width, status badge with glyph, buttons distinct.
8. **Medication schedule** weekday selection — opt-in rules intact (new = none selected; tap toggles; Every day selects all → tap again clears; cannot save with none).
9. **Android time picker** — opens to a **visible wheel**, select & persist; reopen shows the saved time.
10. **Task due-date** picker — visible calendar wheel; select & persist.
11. **Task due-time** picker.
12. **Appointment** date/time.
13. **Visit** date/time.
14. **Quiet-hours** time picker (notification settings).
15. **Notification permission** state shown accurately; no auto-prompt at launch.
16. **Local notification test** — easy to locate; fires.
17. **Android hardware back** — dismisses pickers/modals predictably.
18. **Unsaved-changes** prompts still trigger on dirty forms.
19. **Keyboard** doesn't hide focused fields / sticky save bar (forms use keyboard avoidance).
20. **Long Arabic** titles/notes wrap cleanly.
21. **English medication names** render LTR inside Arabic cards.
22. **Phone numbers & emails** render LTR; doctor/contact phone one-tap call works.
23. **Small-width web** (320–412) — no clipping.
24. **Desktop web** — content caps and centers.
25. **Circle switching** + cache isolation still correct.
26. **Removed-member deep-link** protection (notification tap routes to inbox, not a circle you left) — unchanged.

---

## 17. Compliance confirmation

No SQL was applied. No Supabase CLI/login/link/push, no Edge Function deploy, no cron. No EAS login/init/build/submit. No Firebase CLI action. No secrets printed. **No commit was made.** No database types, RPC contracts, or backend schemas were changed (none were needed). All existing business rules, RLS assumptions, data contracts, notification privacy, and care-circle isolation were preserved — the migration changed presentation only.
