# Milestone 6.1 — Section 10 screens (gap-fill) + theme selector

**Branch:** `milestone-6-1-section-10` (isolated worktree off `master` @ 501e9a2, which
already carries all of Milestone 6 + the Section-10 designs). **Reports live only in
this worktree.** No push, no PR. Dev server untouched.

Seven screens the original handoff never drew — Milestone 6 composed them from
archetypes — are now aligned to their **real** frames (`docs/design/design/New Screens
-Section 10-.dc.html`, the pixel source of truth), plus the handoff's persisted theme
choice. This was a **restyle**: no behaviour, routing, data, query, or permission
change on any screen (every restyle was adversarially verified for byte-equivalent
behaviour — see *Verification*).

**Quartet green after every commit:** `npx tsc --noEmit` = 0 · `npm run
check:mojibake` = clean · `git -c core.autocrlf=false diff --check` = clean · ar/en
locale parity = **1102 = 1102**.

## Screens (frame → screen → file → commit)
| Frame | Screen | File(s) | Commit |
|---|---|---|---|
| 10a | Medication detail (manager editor) | `medications/medication-editor.tsx`, `medications/schedule-summary.tsx` | `da6b141` |
| 10b | Add appointment | `appointments/appointment-form.tsx` | `a234c22` |
| 10c | Appointment manager editor | `appointments/appointment-editor.tsx` | `012b800` |
| 10d | Doctors directory | `doctors/figma-doctors.tsx` | `02d04f9` |
| 10e | Add-doctor sheet | `doctors/doctor-form-modal.tsx` | `4286630` |
| 10f | Log visit | `visits/visit-form.tsx` | `c5c69fe` |
| 10g | Visit manager editor | `visits/visit-editor.tsx` | `bb4fb45` |

Two support commits underpin them: **`820b2c4`** (shared foundation — StatusBadge
tint, sheet chrome, `delete` icon, i18n) and **`35f08e7`** (theme selector).

## How it was built
Two `implement → adversarially-verify` workflows (one agent per screen-group, each
reading its exact frame + the domain report + the current file, restyling, then a
second agent adversarially checking behaviour-preservation + frame fidelity + Dar
laws). Shared components, the theme selector, i18n reconciliation, and the cross-file
fixes were done centrally by hand. A third workflow adversarially verified the
shared-component + theme blast radius. Domain reports read per screen:
`04-medications`, `06-appointments`, `07-visits`, `12-emergency-doctors-recipient`.

## The one new component
- **`DarActionButton`** — a **local, in-file** bordered action pill inside
  `medication-editor.tsx` (10a). Tones: neutral (`line`+`ink`), accent (`line`+`acc`),
  danger (`err`+`err`); optional lucide glyph; `row`/`block` size. It exists because
  no existing `Button` variant produces the frame's **accent-text «تعديل»** button,
  and the frame's compact three-in-a-row schedule actions (`إيقاف/إعادة تفعيل` ·
  `تعديل` · `حذف`) + the `acc`/plus add-schedule button + the `err`/trash delete need
  one consistent bordered pill. It is a behaviour-neutral wrapper over `Pressable`,
  kept local to the one screen that needs it (not a second global button primitive).

## Shared-component changes (to match the frames + the Dar laws they surfaced)
These were **restyles of existing shared components** (no new/parallel components,
no behaviour change). They improve app-wide consistency, correcting latent M6 gaps
the Section-10 frames made explicit:
- **StatusBadge** — added the tone **tint fill** behind the stroke (`tok/twarn/terr/
  tacc/sunken`). The Dar status-pill law specifies a tint fill; M6's badge was
  border-only. Every status pill app-wide (dose/task/appointment/visit/invitation…)
  now shows its frame-correct tint.
- **Sheet chrome** — the canonical sheets moved from `Radius.card`(8)+hairline to
  `Radius.sheet`(16)+2px, per the 10e frame + the flat-2px law (M6's "one sheet
  chrome" clause still read `Radius.card`+hairline — an internal M6 contradiction the
  frame resolves): `FormModal` (+ the frame's 34dp bordered close-**X** square at the
  start + centered 18/800 title), `FigmaBottomSheet`, `PickerSheet` (which
  `DateField`/`TimeField` inherit).
- **`delete` icon** — new `ionicons trash-outline` in the semantic registry, wired on
  the danger delete buttons (visit + appointment; medication already used lucide
  `Trash2`).

## Theme selector (the "verify, then add" extra item)
No in-app selector existed (theme followed the OS only). Added as **one** mechanism,
not a second:
- `providers/theme-storage.ts` — persists `light`/`dark`/`system` in `SecureStore`
  (web: `localStorage`); device-level, best-effort.
- `providers/theme-provider.tsx` — a context high in the tree (default `system`, safe
  no-op default so `useTheme` never crashes outside it); loads the stored value once.
- `hooks/use-theme.ts` — now resolves **preference → scheme** at the single
  resolution point (`useResolvedScheme`), which **also** feeds the root navigation
  theme (`_layout` renders `ThemedNavigationRoot` inside the providers). No second
  theming path.
- `account.tsx` — an «المظهر» `FigmaSegmentedTabs` (فاتح / داكن / تلقائي). Default =
  follow the system.

## Invented values (neither the frame nor the spec covered them)
- `common.toggleOff` = «غير مفعّل» / "Off" — the frame only depicts the **on** state
  («مفعّل»); the off state must read as a word (status never colour-only). Chosen to
  parallel «مفعّل».
- `appointments.managerViewSubtitle` = `visits.managerEditSubtitle` = «عرض المدير —
  تعديل كامل» / "Manager view — full edit" — the 10c/10g form-band subtitle; no key
  existed.
- `appointments.deletePermanently` = «حذف هذا الموعد نهائيًا» / "Permanently delete
  this appointment" — the 10c delete-card prompt line (distinct from the button
  label «حذف الموعد»).
- `account.appearance.system` = «تلقائي» / "Automatic" — the follow-the-OS option.
- Sheet chrome radius/border chosen from the Dar radius scale (`Radius.sheet`=16,
  `BorderWidth.standard`=2) to match the 10e frame.

## Deferrals & recommended follow-ups (out of this milestone's scope)
- **App-wide «مثال:» sweep** — the bare-ghost-placeholder correction was applied to
  the in-scope Section-10 placeholders (doctors, appointments). The `«مثال:»` / "e.g."
  prefix still lives on out-of-scope placeholders (onboarding, invitations,
  joinCircle, recipientProfile, emergencyContacts, tasks, vitals, auth). A one-line
  i18n sweep would finish the correction app-wide.
- **`timezone-picker` sheet chrome** — its self-contained sheet was not unified to
  16+2px (out of scope; used by notification-settings). Recommend aligning it in a
  follow-up so all sheets match.
- **Phone-field LTR input** — no phone `TextInput` in the codebase applies `dir=ltr`
  (only read-only phone *displays* isolate). The 10e phone field matches that
  established pattern; a shared `FormField` direction prop would be needed to isolate
  the input itself.
- **10c/10g outcome actions** are stacked full-width (`FigmaFooterPrimaryButton` is
  full-width by contract, and matches the gold-standard `task-editor`) rather than the
  frame's side-by-side pair — a documented, defensible deviation. Colours/labels
  match.
- **Minor sub-token nits** (non-blocking): 10f pre-`ربط بعضو` divider bottom gap is 16
  vs the frame's 12 (no `Spacing.12` token); Surface inner padding is the shared 14 vs
  the frame's 12/14 (a primitive constant). `confirmBody` in the status sections is
  14/400 (pre-existing, not introduced here).

## Verification
Every screen restyle was adversarially verified (behaviour byte-equivalent + frame
fidelity). The 10a `flex` (active-toggle width) issue the verify pass caught was
fixed. A dedicated final workflow adversarially verified the shared-component + theme
blast radius (StatusBadge tint, sheet chrome, theme resolution/provider wiring, the
cross-file edits + i18n): StatusBadge, the theme selector, and the i18n/edits all
passed; it surfaced **one** real regression — the restyled FormModal close button had
shrunk its tap target to a hard 34dp — which was fixed (`d081557`) by restoring
`hitSlop` over the 44dp floor while keeping the 34dp visual. Runtime/visual
verification (light+dark, font-scale, RTL, and the theme-persistence flow) is the
owner's on-device review — see the QA checklist.

---

# Visual-QA checklist — Section 10

Per screen: **light + dark**, font scale **100 / 130 / 200 %**, **RTL** (numerics/dates
LTR-isolated, forward chevrons point left), plus the listed states. Tick on device.

## 10a — Medication detail (`/medications/[id]`, manager)
- [ ] Gold disclaimer; info fields (name*, dosage, form, instructions ghost «قبل الأكل أو بعده»); with-food toggle shows the **word** مفعّل/غير مفعّل (not colour-only).
- [ ] Neutral responsible chips (person icon + name, no gendered label); saved line + «حفظ التغييرات».
- [ ] Activation row «الدواء فعّال» + إيقاف (confirm). Weekly-summary card (tacc bg, header-row «عرض الجرعات لكل يوم» link, per-day expand).
- [ ] Schedule cards: **active** (فعّال pill, equal-width إيقاف·تعديل·حذف) and **stopped** (موقوف pill, wider إعادة تفعيل). Add-schedule + helper line. Two-step «حذف الدواء».
- [ ] Read-only member: «للعرض فقط…» + info rows (no editors). Loading / error+retry / empty.

## 10b — Add appointment (`/appointments/new`)
- [ ] Gold coordination disclaimer (banner, not grey note). Title* well; 7 type chips; date/time card (date* + start* + optional end «اختياري — HH:MM»); location; doctor chips (بدون طبيب first, only with doctors); neutral responsible chips (غير محدد); notes; «إضافة موعد».
- [ ] Validation errors; unsaved-changes guard; loading.

## 10c — Appointment manager editor (`/appointments/[id]`)
- [ ] Prefilled fields; status card «الحالة» + مجدول **tint** pill (icon+text). «تم الموعد» (green) / «تعذّر الموعد» → two-step confirm.
- [ ] Delete card mid two-step: «حذف هذا الموعد نهائيًا» prompt + «حذف الموعد» (trash) → «تأكيد الحذف» + إلغاء. «حفظ التغييرات».
- [ ] Read-only (7b) view unaffected. Loading / error.

## 10d — Doctors directory (`/doctors`)
- [ ] Sub-header + manager «+». Cards: stethoscope square, 17/800 name, specialty·clinic, primary-tinted call circle, sunken centered **LTR** phone well, divider, manager تعديل + حذف.
- [ ] Second card shows the **two-step delete-confirm** state. Empty «لا يوجد أطباء بعد». Non-manager: no add/edit/delete. Loading / error+retry.

## 10e — Add-doctor sheet (`/doctors`, FormModal)
- [ ] Bottom sheet: 16-corner + 2px top, grab handle, **close-X square at start** + centered title. Fields: الاسم* (focused), التخصص (ghost «قلب، باطنية»), رقم الهاتف (LTR), العيادة (ghost «عيادة الشفاء»), ملاحظات. Stacked «إضافة طبيب» + «إلغاء».
- [ ] Edit mode: «تعديل بيانات الطبيب» + «حفظ التغييرات». Unsaved-guard; validation.

## 10f — Log visit (`/visits/new`)
- [ ] Gold disclaimer (banner). Visitor* well; date* well; start + end (optional, «اختياري — HH:MM»); notes «تفاصيل الزيارة...»; 2px divider; «ربط بعضو» neutral chips (غير محدد).
- [ ] Collaborator variant: picker replaced by «ستظهر هذه الزيارة في سجل حسابك». «إضافة زيارة». Validation; loading.

## 10g — Visit manager editor (`/visits/[id]`)
- [ ] Prefilled + relink chips. Status card «الحالة» + مخطّطة **tint** pill. «تمت الزيارة» (green) / «تعذّرت الزيارة» → two-step.
- [ ] Two-step «حذف الزيارة» (trash). Closed visit → «إعادة كمخطّطة» (manager only). Read-only (3b) view. Loading / error.

## Theme selector (Account → المظهر)
- [ ] فاتح / داكن / تلقائي switches the **whole app + nav chrome** immediately (both themes render every Section-10 screen).
- [ ] Choice **persists** across app restart; «تلقائي» follows an OS light↔dark change live. Default on a fresh install = follow system.


---

# Per-screen delta tables

From the implement→verify workflows. Every `no` row was fixed before commit; entries left as `no` are documented deviations (see *Deferrals*).

## 10a — Medication detail

| Block | Frame | Implemented | Match |
|---|---|---|---|
| Header band | green band, 44dp bordered back square (ChevronRight, RTL), 20/800 «تفاصيل الدواء», 44dp spacer | FigmaFormScreen title=detailTitle (unchanged) | ✓ |
| Gold disclaimer | goldFill bg + 2px line border, info icon (goldInk), 15/700 text | FigmaFormScreen disclaimer prop (unchanged) | ✓ |
| Info card container | 2px line border, card bg, radius 8, padding 14 | Surface tone=card radius=Radius.card padded=16 gap=16 | ✓ |
| Info section header «معلومات الدواء» | 10x10 solid btn square + 16/800 title | FigmaSectionLabel (unchanged) | ✓ |
| Name field (required) | label 15/700 + err «*», sunken value box 16/800 | FormField required (label 15/700, sunken input, err marker) | ✓ |
| Dosage / Form / Instructions fields | label 15/700, sunken value 16/700, instructions min-height 48 | FormField x3 (instructions multiline) | ✓ |
| Info divider | 2px solid sunken, margin 14/12 | View height=BorderWidth.standard(2) backgroundColor=backgroundSunken | ✓ |
| With-food label | 16/800 ink | switchLabel 16 / FontFamily.bold ink | ✓ |
| With-food hint | 14/600 mut «تذكير بتناوله مع الأكل» | switchHint 14 / FontFamily.medium textSecondary | ✓ |
| With-food state word | «مفعّل» 14/800 acc (never color-only) | Text t(common.toggleOn/off) 14/bold, primaryText when on / textSecondary when off | ✓ |
| With-food switch | 48-52x28-30 pill, 2px border, btn fill on, card thumb | FigmaSwitch (unchanged) | ✓ |
| Responsible card + label «المسؤول» | plain 15/700 label (no square) + neutral chips | MemberSelect label=assignment.responsible (groupLabel 14/700) + OptionSelect chips | ✓ |
| Responsible chips (neutral) | غير محدد / أنا / names; selected btn+btnInk 800, others card+mut 700 | OptionSelect (shared Dar chips) — no gendered word | ✓ |
| Saved line | centered check(ok) + «تم حفظ التغييرات» 15/700 ok | savedRow: lucide Check(successFg) + Text 15/semibold successFg | ✓ |
| Save CTA | btn fill + btnInk, 17/800 «حفظ التغييرات» | FigmaFooterPrimaryButton label=common.saveChanges (unchanged) | ✓ |
| Activation row | horizontal card: check(ok)+«الدواء فعّال» 16/800 (flex1) + compact bordered «إيقاف» ink on end | activationRow: Check(successFg when active)+blockTitle 16/800 flex1 + Button size=sm variant=secondary on end | ✓ |
| Doses section header «جداول الجرعات» | standalone 10x10 green square + 16/800 | SectionHeader title=dosesSectionTitle | ✓ |
| Schedule help line | 14/600 mut, LTR 08:00/23:00 | FigmaMutedNote scheduleGroupsHelp (unchanged) | ✓ |
| Weekly summary card «ملخّص أسبوعي» | tacc bg card, header row title 16/800 + «عرض الجرعات لكل يوم» 14/800 acc-underline link, summary line | ScheduleSummary (unchanged: default card bg, title, per-day toggle below) | ✗ |
| Schedule card container | card + 2px line border, radius 8, padding 12/14 | Surface tone=card radius=Radius.card padded=16 gap=12 | ✓ |
| Schedule card header | «الجدول N» 16/800 + status pill (فعّال ok / موقوف neutral, 1.5px stroke, icon+text) | blockTitle 16/800 + StatusBadge tone success/neutral | ✓ |
| Schedule info rows | horizontal: label 15/700 mut (start), value 15/800 (end); times & dates LTR | InfoRow now flexDirection row space-between (label textSecondary 15/700, value 15/800); times & start-date wrapped in isolateLtr | ✓ |
| Schedule action row | single row: toggle neutral (flex1.3 when reactivate) + «تعديل» acc+pencil + «حذف» err+trash, all flex | scheduleActions row: DarActionButton neutral(flex1.3) + accent+Pencil(flex1) + danger+Trash2(flex1); delete -> inline two-step [confirmDelete danger][cancel secondary] | ✓ |
| Add-schedule button | bordered card, acc text + plus icon, 16/800 «إضافة جدول جرعات جديد» | DarActionButton size=block tone=accent Icon=Plus label=addScheduleAtMed | ✓ |
| Add-schedule helper | 14/600 mut «أنشئ جدولاً جديدًا عندما تختلف الأيام» | FigmaMutedNote helpDifferentDays (unchanged) | ✓ |
| Delete medication | standalone bordered err button (card bg, err border+text), trash icon, 16/800, two-step | DarActionButton size=block tone=danger Icon=Trash2 (no Surface wrapper); two-step [confirmDelete danger][cancel secondary] | ✓ |
| Read-only (non-manager) variant | not depicted; «للعرض فقط…» + info rows | FigmaMutedNote(readOnly) + Surface with FigmaSectionLabel + name title + horizontal InfoRows | ✓ |

## 10a — Weekly-summary card

| Block | Frame | Implemented | Match |
|---|---|---|---|
| Card container | border:2px solid --line; radius 8; background:--tacc; padding 12/14; flat (no shadow) | Surface tone="info" (infoBg = tacc/primaryBg) with default 2px border, Radius.card=8, default 14 padding, flat | ✓ |
| Header row layout | display:flex; justify-content:space-between; align-items:baseline — title and per-day link on ONE row | View flexDirection:row, justifyContent:'space-between', alignItems:'baseline', gap Spacing.three | ✓ |
| Title | «ملخّص أسبوعي» 16px / 800, ink | Text fontSize:16, FontFamily.bold (Cairo 800), color c.text | ✓ |
| Per-day link | «عرض الجرعات لكل يوم» 14px / 800, --acc, underlined, role=button | Pressable→Text fontSize:14, FontFamily.bold, color c.primaryText (acc), textDecorationLine:'underline', accessibilityRole button (toggles expanded/collapsed label) | ✓ |
| Summary lines | «كل الأيام: 18:00» 15px / 700, ink, times LTR, margin-top 4 | Text fontSize:15, FontFamily.semibold (Cairo 700), color c.text, times wrapped via isolateLtr, lines container marginTop Spacing.one | ✓ |
| Per-day expand/collapse | not depicted in frame (link is the affordance) | Existing per-day breakdown behaviour preserved unchanged; restyled to 15/700 weekday label + LTR muted times to sit inside the info card | ✓ |

## 10b — Add appointment

| Block | Frame | Implemented | Match |
|---|---|---|---|
| Header band — bordered back square + «إضافة موعد» title | band bg, 44×44 bordered back (chevron points LEFT/RIGHT in RTL), 20/800 title | FigmaFormScreen title={t('appointments.addTitle')} onBack — already canonical | ✓ |
| Gold coordination disclaimer | goldFill bg + goldInk text + Info icon, 2px border, first card: «تنظيم مواعيد الرعاية...دون أي نصيحة طبية.» | Moved from inline grey FigmaMutedNote to FigmaFormScreen disclaimer={t('appointments.disclaimer')} prop → renders the gold banner | ✓ |
| Title well* + نوع الموعد 7 type chips | عنوان الموعد* sunken well; 7 chips طبيب/تحاليل/صيدلية/علاج طبيعي/رعاية منزلية/عائلي/عام, selected btn/btnInk 800 | FormField required + OptionSelect over APPOINTMENT_TYPES (figma-appointment-fields, unchanged) | ✓ |
| التاريخ والوقت card | 10×10 square section header; date* well w/ calendar icon + LTR date + chevron; start* + optional end side-by-side; end placeholder «اختياري — HH:MM» | FigmaSectionLabel + DateField + two TimeField cols; end clearable; placeholder already appointments.placeholders.endTime = «اختياري — HH:MM» | ✓ |
| المكان well + الطبيب chips | location sunken well; doctor chips with «بدون طبيب» first, only when circle has doctors | FormField location + OptionSelect (noDoctor first) gated on doctors.length > 0 | ✓ |
| المسؤول chips (neutral, «غير محدد» default) | responsible chips, neutral, غير محدد selected default | MemberSelect label={t('assignment.responsible')} — neutral, assignment.none first | ✓ |
| ملاحظات | notes sunken well, multiline ghost «تعليمات أو معلومات إضافية...» | FormField multiline with appointments.placeholders.notes | ✓ |
| «إضافة موعد» CTA | full-width btn/btnInk 17/800 bordered save button | FigmaFooterPrimaryButton label={t('appointments.add')} loading — body-rendered with inline submitError alert | ✓ |

## 10c — Appointment manager editor (+ shared fields)

| Block | Frame | Implemented | Match |
|---|---|---|---|
| 10c header band — title + subtitle | band; back square 44×44 border bandInk r8; title «تفاصيل الموعد» 20/800; subtitle «عرض المدير — تعديل كامل» 14/600 opacity .85; 44 end spacer | Added subtitle={t('appointments.managerViewSubtitle')} to FigmaFormScreen (which already renders the exact band: bandInk back square, ChevronRight=RTL-back, 20/800 title, 14/600 subtitle @.85, 44 spacer) | ✓ |
| 10c disclaimer slot | NONE — frame 10c goes header → title card directly (no gold banner, no muted note) | Removed the <FigmaMutedNote>{appointments.disclaimer}</FigmaMutedNote> line and its import from the manager editor | ✓ |
| 10c field cards (title/type/date-time/location/responsible/notes) | prefilled fields; 10c mock compresses them into ONE card with a 3-up date/start/end row and no doctor picker | Reused the canonical shared FigmaAppointmentFields (5 bordered Surface cards; sunken wells; type/doctor/responsible OptionSelect chips; DateField/TimeField; «اختياري — HH:MM» end placeholder) | ✗ |
| 10c status card — header row | «الحالة» 16/800 + «مجدول» pill: clock icon + text, 1.5px acc stroke, r4, tacc tint fill, 14/700 | statusLabel 16/800 (theme.text) + StatusBadge tone='info' glyph=clock label=status.scheduled (1.5px infoFg stroke, r4=Radius.tiny, 14/700 label + ◷ clock glyph) | ✗ |
| 10c status card — outcome actions | «تم الموعد» filled btn + «تعذّر الموعد» outline card, side-by-side flex:1 each, compact 15/800 | Left unchanged: FigmaFooterPrimaryButton «تم الموعد» stacked above Button variant='secondary' «تعذّر الموعد»; either enters the inline two-step confirm (body + primary/danger confirm + cancel) | ✗ |
| 10c delete card — prompt line | «حذف هذا الموعد نهائيًا» 14/700 in mut, above the buttons | Added a muted prompt Text (14/FontFamily.semibold=700, theme.textSecondary) shown in the confirming state | ✓ |
| 10c delete card — confirm/cancel | «تأكيد الحذف» FILLED err (background:err / color:bg), 2px line border, r8, flex:1.3, 15/800 + «إلغاء» outline card, flex:1 | Local Pressable: backgroundColor=dangerSolid, text=onError (the sanctioned solid-danger pairing), 2px border, r8=Radius.card, flex:1.3, minHeight 52, 16/800; beside Button variant='secondary' «إلغاء» in a flex:1 col | ✓ |
| 10c save footer | «حفظ التغييرات» filled btn full-width, 2px line border, r8, 14px pad, 17/800 | Unchanged FigmaFooterPrimaryButton label=common.saveChanges (theme.primary fill + onPrimary + 2px border + r8 + 17/800), with saved/failed status lines above | ✓ |
| Cards / borders / elevation / radii | 2px solid line borders, r8, flat (no shadow), sunken wells, both themes token-swapped | All via Surface (2px border both themes, flat, Radius.card=8) + theme tokens through useTheme() | ✓ |
| 10b add form (shared) — gold coordination disclaimer | gold banner: goldFill bg + goldInk text, Info icon, 2px line border, r8, 15/700 | Not in my file — 10b is appointment-form.tsx, which currently uses a grey FigmaMutedNote, not the gold banner | ✗ |

## 10d — Doctors directory

| Block | Frame | Implemented | Match |
|---|---|---|---|
| Screen shell / header | green band, 44 bordered back square + centered 20/800 «الأطباء» + 44 filled add square (bandInk fill, plus stroke band) | FigmaScreen + FigmaHeader title=t('figma.doctors.title'), onAdd gated by canManage | ✓ |
| List spacing | cards gap 10 (outer margin 14/14/18) | list gap 10 (was 12); outer padding from FigmaScreen | ✓ |
| Card container | 2px line border, radius 8, card fill, padding 12v/14h | Surface tone=card radius=Radius.card padded={12} + style paddingHorizontal:14 (padding wins for T/B, paddingHorizontal for L/R) | ✓ |
| Icon square | 44×44, 2px line, radius 6, tok fill + ok stethoscope stroke, glyph 20 (card 1) | GlyphChip iconName=doctor tone=success size=md, style width/height 44 (glyph stays 20) | ✓ |
| Doctor name | 17px / 800 / line-height 1.5 | fontSize 17, lineHeight 26, FontFamily.bold (800) | ✓ |
| Meta line | one line «التخصص · العيادة», 14px / 600 / mut, «·» separator | [specialty, clinic].filter.join('  ·  '), fontSize 14, FontFamily.medium (600), color textSecondary, numberOfLines 1 | ✓ |
| Call circle | 46×46, 2px line, radius 999, tacc fill, acc phone icon 19 strokeWidth 2.2 | 46×46, Radius.pill, BorderWidth.standard, backgroundColor primaryBg(tacc), Phone size 19 color primaryText(acc) strokeWidth 2.2 | ✓ |
| Phone well | dir=ltr, 2px line, radius 8, sunken fill, padding 9v/14h, margin-top 10, 15px/800, centered, ink text | phoneWell marginTop 10, Radius.card, border standard, paddingHorizontal 14, paddingVertical 9; phoneText 15/FontFamily.bold(800), textAlign center, color text(ink), isolateLtr | ✓ |
| Divider | 2px tall bar, background sunken (NOT line), margin 12 top / 10 bottom | View height 2, backgroundColor backgroundSunken, marginTop 12 / marginBottom 10 | ✓ |
| Footer actions container | flex row, gap 8 | actions flexDirection row, gap 8 | ✓ |
| Edit button | flex 1, card fill, 2px line border, ink text, radius 8, padding 8v/0, 15/800, pencil icon 14 strokeWidth 2 | ActionButton tone=muted → bg backgroundElement(card), border line, fg text; flex 1; label 15/800; icon 14 strokeWidth 2; radius Radius.card | ✓ |
| Delete button (idle) | flex 1, card fill, 2px err border, err text, 15/800, trash icon 14 | ActionButton tone=danger (not filled) → bg card, border errorFg, fg errorFg; icon 14; label 15/800 | ✓ |
| Confirm-delete (two-step) | flex 1.3, err fill, bg-colored text, 2px LINE border, «تأكيد الحذف» + trash 14 | ActionButton filled flex={1.3} → bg dangerSolid(err), fg onError(bg), border c.border(line); loading spinner while deleting | ✓ |
| Cancel button | flex 1, card fill, 2px line, ink text, «إلغاء» (no icon) | ActionButton tone=muted, no Icon → bg card, border line, fg ink, flex 1 | ✓ |
| Touch target height | padding 8v ≈ 31px tall buttons | actionBtn minHeight 48 (TouchTarget.min) retained | ✗ |
| Empty state | «لا يوجد أطباء بعد» | EmptyState iconName=doctor title=t('figma.doctors.emptyTitle') (=«لا يوجد أطباء بعد»), subtitle only when canManage | ✓ |
| Loading / error+retry / delete-error | not in frame (behaviour states) | SkeletonList loading; errorCard(2px line) + primary retry pill; deleteError as accessibilityRole=alert live region above list | ✓ |
| Read-only / non-manager | cards without footer + no header add | canManage=false hides add button, divider, and the edit/delete footer; call + phone well still render | ✓ |
| Dark theme | token values swap only (band/card/line/sunken/tacc/tok/err…) | every color via useTheme(); no hardcoded hex | ✓ |

## 10e — Add-doctor sheet

| Block | Frame | Implemented | Match |
|---|---|---|---|
| Scrim | rgba(8,18,14,.55) light / rgba(0,0,0,.6) dark | FormModal backdrop backgroundColor = theme.overlay (same values) | ✓ |
| Sheet container | card bg, border-top 2px solid line, border-radius 16 16 0 0, padding 10/16/18 | FormModal ThemedView type=backgroundElement, borderWidth=StyleSheet.hairlineWidth (all sides), borderTopRadius=Radius.card(8) | ✗ |
| Grab handle | 48x8 pill, sunken fill, centered, 8px below | FormModal grabber 48x8, Radius.pill, backgroundSelected(=sunken) | ✓ |
| Sheet header | close-X SQUARE 34x34 (2px line border, radius6, card bg, X ink 2.6) at START + centered title + spacer at END | FormModal header = title at start + text-glyph close (Glyph.cross, 20px) at end, justify space-between | ✗ |
| Sheet title | 18px / 800, centered | FormModal ThemedText type=sectionTitle (20px/800), start-aligned | ✗ |
| Field label | 15px / 700, ink color | FormField label 15px / FontFamily.semibold(700), color=text | ✓ |
| Name required marker | «الاسم» + red «*» (var --err) | Added required prop → FormField appends « (مطلوب)» in errorFg (canonical Dar required marker; asterisk is the mock's shorthand — matches medication-form/task-editor) | ✓ |
| Input box | 2px solid line border, radius 8, sunken bg, 16px text, padding 11/14 | FormField input BorderWidth.standard(2), Radius.card(8), backgroundSunken, fontSize 16, padV 11 / padH 14, minHeight 48 | ✓ |
| Focused field border | name field border = var(--acc) | FormField focused borderColor = primaryText(=acc) — runtime focus state | ✓ |
| Placeholder tone | mut color, weight 600 | FormField placeholderTextColor = textSecondary(=mut) | ✓ |
| Specialty placeholder copy | «مثال: قلب، باطنية» (shown with prefix) | t('doctors.placeholders.specialty') — current value «مثال: قلب، باطنية» | ✗ |
| Clinic placeholder copy | «مثال: عيادة الشفاء» | t('doctors.placeholders.clinicName') — current value «مثال: عيادة الشفاء» | ✗ |
| Notes placeholder copy | «ملاحظات إضافية» | t('doctors.placeholders.notes') = «ملاحظات إضافية» | ✓ |
| Phone field | dir=ltr, weight 800, +966 12 345 6789 | FormField keyboardType=phone-pad, autoCapitalize=none, follows app direction (no LTR override) — identical to sibling contacts-manager phone field | ✓ |
| Primary CTA | «إضافة طبيب» btn fill + btnInk, 2px line border, radius 8, 17px/800, pad 13 | FormModal FigmaFooterPrimaryButton (canonical forced green CTA) with label=t('doctors.add') | ✓ |
| Secondary CTA | «إلغاء» card bg, 2px line border, radius 8, 16px/800, pad 11 | FormModal Button variant=secondary, label=t('common.cancel') | ✓ |
| Buttons stacked | primary then cancel, stacked full-width | FormModal actions View, column, gap Spacing.two | ✓ |
| Add-mode titles | header «إضافة طبيب», CTA «إضافة طبيب» | title=t('doctors.addTitle'), submitLabel=t('doctors.add') | ✓ |
| Edit-mode titles | header «تعديل بيانات الطبيب», CTA «حفظ التغييرات» | title=t('doctors.editTitle'), submitLabel=t('common.saveChanges') | ✓ |
| Submit error | validation / save-failure surfaced (not silent) | FormModal error slot (accessibilityRole=alert, errorFg) = t('doctors.saveFailed'); inline FormField errors via fieldError() | ✓ |

## 10f — Log visit

| Block | Frame | Implemented | Match |
|---|---|---|---|
| Header band — bordered back square + «تسجيل زيارة» title | band bg, 44×44 bordered back square (chevron pointing forward/left in RTL), 20/800 title, no subtitle | FigmaFormScreen title={t('visits.addTitle')} onBack — already the canonical Dar band; unchanged | ✓ |
| Gold non-diagnostic disclaimer banner | goldFill bg + goldInk text + Info circle icon, 2px border, «تنظيم زيارات العائلة وتنسيقها فقط، دون أي نصيحة طبية.» | Now passed via FigmaFormScreen `disclaimer={t('visits.disclaimer')}` (gold banner); replaced the prior inline grey FigmaMutedNote | ✓ |
| Visitor name* well | label «اسم الزائر» 15/700 + red *, sunken 2px well | FigmaVisitFields → FormField required (already Dar sunken well); unchanged | ✓ |
| Visit date* date well | label «تاريخ الزيارة» 15/700 + red *, sunken well w/ calendar icon + LTR date + chevron | FigmaVisitFields → DateField via FigmaFieldLabel required; unchanged | ✓ |
| Start/end time pair (both optional) | two-col row: «وقت البدء» / «وقت الانتهاء», sunken wells w/ clock icon + LTR time | FigmaVisitFields → TimeField row, both clearable/optional; unchanged | ✓ |
| Notes well | «ملاحظات» + min-height sunken well, ghost «تفاصيل الزيارة...» | FigmaVisitFields → FormField multiline, placeholder t('visits.placeholders.notes'); unchanged | ✓ |
| 2px sunken divider before «ربط بعضو» | height:2px background:var(--sunken), margin 14/12 | styles.divider height BorderWidth.standard (2), backgroundColor theme.backgroundSunken (was hairline + theme.divider), marginBottom Spacing.three | ✓ |
| «ربط بعضو» chips, «غير محدد» default (NEUTRAL) | label «ربط بعضو», chips: غير محدد (selected btn fill) · أنا · names | MemberSelect (manager only) → OptionSelect Dar chips; none label = assignment.none «غير محدد», neutral; unchanged | ✓ |
| Collaborator variant note replaces picker | muted «ستظهر هذه الزيارة في سجل حسابك» instead of chips, same divider above | !canManage branch: same 2px sunken divider + FigmaMutedNote t('visits.ownVisitNote'); unchanged | ✓ |
| CTA «إضافة زيارة» | full-width btn fill, 2px border, 17/800 | FigmaFooterPrimaryButton label={t('visits.add')}; unchanged | ✓ |
| Card container | card fill, 2px border, radius 8, padding 14 | Surface tone=card radius={Radius.card} padded={14} gap={14} (was Radius.lg / padded 16 / gap 16) | ✓ |

## 10g — Visit manager editor (+ shared fields)

| Block | Frame | Implemented | Match |
|---|---|---|---|
| Header band (10g) | Green band, 44dp bordered back square (ChevronRight in RTL), 20/800 title «تفاصيل الزيارة» + 14/600 opacity .85 subtitle «عرض المدير — تعديل كامل» | FigmaFormScreen title=visits.detailTitle + new subtitle=visits.managerEditSubtitle; canonical band renders back square + 20/800 title + 14/medium/0.85 subtitle | ✓ |
| Non-diagnostic disclaimer (10f/10g) | Gold banner: 2px line border, r8, goldFill bg, goldInk text, Info circle icon, 15/700, line-height 1.65 — «تنظيم زيارات العائلة وتنسيقها فقط، دون أي نصيحة طبية.» | Moved visits.disclaimer from an inline FigmaMutedNote to FigmaFormScreen's `disclaimer` prop → renders the canonical gold banner (goldFill/goldInk, Info icon, 15/semibold, lh 25) | ✓ |
| Fields card | 2px line border, r8, card bg, padding 14; visitor-name well, date well, start/end time wells, notes well | Surface tone=card radius=Radius.lg(=8) padded=16 wrapping shared FigmaVisitFields (FormField/DateField/TimeField Dar wells) | ✓ |
| Field layout (10g 3-col date/start/end) | 10g packs date(flex1.2)+start(flex1)+end(flex1) into ONE row; end shows «اختياري» | Shared FigmaVisitFields renders date full-width then a start/end 2-col row (which matches the 10f frame exactly) | ✗ |
| «ربط بعضو» divider | 2px solid var(--sunken) rule, margin 14 0 12 | styles.divider = height BorderWidth.standard(2), backgroundColor c.backgroundSunken, marginTop Spacing.half(2)+card gap ≈14 top, marginBottom 12 | ✓ |
| «ربط بعضو» chips | Chip group, «غير محدد» neutral default selected (btn fill), then أنا / member names (card bg, mut text); 2px line, r8 | Shared MemberSelect with label=visits.fields.linkToMember; renders assignment.none neutral chip first + me + members | ✓ |
| Status card — «الحالة» label | 16px / 800 weight | styles.statusLabel → fontSize 16, FontFamily.bold | ✓ |
| Status card — badge «مخطّطة» | 1.5px acc border, tacc bg tint, acc text, r4, clock icon 12px, 14/700 | StatusBadge tone=info (infoFg=acc), clock glyph, 14/700, 1.5px border, r4 | ✓ |
| Status card — outcome buttons (planned) | Two side-by-side buttons (gap 8): «تمت الزيارة» btn/btnInk 2px line r8 15/800 + «تعذّرت الزيارة» card/ink 2px line r8 15/800 | New statusActionsRow (flexDirection row, gap Spacing.two=8) with two flex-1 cols: FigmaFooterPrimaryButton (primary) + Button variant=secondary | ✓ |
| Status card — outcome (closed → reopen) | Not shown in frame (frame is planned) | Single Button variant=secondary «إعادة كمخطّطة» (manager only), unchanged | ✓ |
| Two-step outcome confirm | Not shown in frame | Vertical confirmStack: body text + confirm CTA (primary complete / danger cancel) + secondary cancel — kept from gold-standard task-editor | ✓ |
| Delete affordance (10g) | Single element: 2px var(--err) border, card bg, err text+trash icon, r8, padding 12 0, centered, 16/800 — NOT wrapped in a separate card | Unwrapped DeleteVisitRow from its Surface; renders Button variant=danger (card bg + 2px errorFg border + errorFg text + r8 + 16/800) directly in the scroll flow | ✓ |
| Delete two-step confirm | Not shown in frame | actionRow (row, gap 8) of «تأكيد الحذف» danger + «إلغاء» secondary, rendered flat (no card) | ✓ |
| Save footer (10g) | btn fill, btnInk, 2px line, r8, padding 14 0, 17/800 — «حفظ التغييرات» | FigmaFooterPrimaryButton label=common.saveChanges (unchanged) + optional saved/error status line above | ✓ |
| Read-only / collaborator view | No dedicated frame (10f/10g are form + manager editor) | VisitViewScreen kept: FigmaMutedNote permission note (statusOnly/readOnly) + details Surface + StatusSection (inherits 16/800 label + side-by-side outcome buttons for the linked visitor) | ✓ |
| Both themes | Light + dark shots swap only token values | All colors via useTheme() (c.backgroundSunken, theme.text, theme.errorFg, band/gold from FigmaFormScreen); no hardcoded hex/font | ✓ |
