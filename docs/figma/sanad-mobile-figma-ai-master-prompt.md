# Sanad Mobile — Figma AI Master Prompt

Part of the **Sanad Mobile Figma handoff package**. This file is the single, standalone, paste-ready prompt for **Figma / Figma Make / Figma AI** (or any AI design generator). Everything the generator needs — palette, type, spacing, the full screen list, the home-direction options, the signature Today Care Ring, and the medical-safety / RTL / accessibility rules — is baked directly into the prompt so it works **without** the other docs open.

Sibling docs in this package (read these for full per-screen / per-component detail; the prompt intentionally summarizes them):
- `sanad-mobile-figma-design-brief.md` — master design brief (product, users, principles, IA, visual system, copy/language).
- `sanad-mobile-screen-inventory.md` — every screen, full interaction inventory, frame set, data states.
- `sanad-mobile-component-inventory.md` — every component with props/variants/accessibility.
- `sanad-mobile-design-acceptance-criteria.md` — how engineering safely implements the approved Figma design.

---

## 1. How to use this prompt

1. **Copy the entire fenced block in section 2** (everything between the triple backticks) and paste it into Figma AI / Figma Make as one message. It is self-contained — do not edit it down before the first run.
2. **It also works for a human product designer.** Hand the same block to a designer as a written brief; it reads as a complete spec, not just an AI prompt.
3. **The prompt is deliberately long and specific.** Token cost is not a constraint here — specificity is what stops the generator from defaulting to a generic Apple/Google clone or an "AI SaaS card grid."
4. **Run order matters.** The prompt asks for the design tokens page and component library first, then the prioritized screens (Home, Medications, Emergency, Notifications, Forms), then the rest. If your tool truncates, use the follow-up prompts in section 3 to pull the remaining screens one at a time.
5. **Dark mode is the source of truth.** Generate dark first; request the light variant as a second pass (section 3).
6. If the generator asks clarifying questions, point it back to the baked values in the prompt — every color, token, and screen is already specified.

---

## 2. THE PROMPT (copy everything below this line)

```
You are designing a high-fidelity, production-ready mobile app UI in Figma for "Sanad" (سند) — an Arabic-first, RTL family care-coordination app for older adults. Produce a complete, premium, accessible design system AND all screens. Follow every instruction below exactly. Do not simplify, do not substitute your own palette or type, and do not copy the look of any existing Apple or Google stock app.

=== 0. WHAT SANAD IS (so your decisions are grounded) ===
Sanad helps stressed, mostly-untrained family caregivers (usually adult children) coordinate care for an elderly parent who is aging in place at home — and it serves the older adult too (reduced vision and dexterity). The product promise is: "Know what your parent needs today, and know whether it got done." The core daily loop is medication doses and their VISIBLE closure (given / postponed / missed). Everything is in Arabic, right-to-left.
Design priorities, in strict order: (1) clarity, (2) calm, (3) trust, (4) accessibility.
The strategic risk is too many features/concepts, so the Home must be Today-first and feature navigation must be demoted. The visual direction is "Warm Care OS": warm porcelain/graphite surfaces, one confident brand blue, and a single sand accent that means "today / now / attention" (NOT decoration). Restraint is the premium signal.

=== 1. PLATFORM, ORIENTATION, THEME ===
- Target: Android-first, large phone. Primary frame = Samsung Galaxy S24 Ultra class, design at 1440 x 3120 px (19.5:9), or work at a 1x logical frame of 412 x 917 dp and scale up. Must stay responsive down to a 360 dp wide small Android phone.
- Respect Android safe areas: status bar at top, a 3-button/gesture nav area at the bottom, and a bottom tab bar. Keep primary actions LOW and within the one-handed thumb arc.
- Build DARK MODE FIRST (this is the canonical theme), then produce a LIGHT variant of every screen.
- Right-to-left (RTL) is the default for the whole UI. Mirror layout, alignment, and directional icons. The reading order is right→left, top→bottom.

=== 2. EXACT DESIGN TOKENS (use these literal values; create a Figma "Design Tokens" page documenting them) ===

COLOR — DARK ("warm graphite", a full peer of light, never pure black):
  text #F4F2EC; textSecondary #ACA89D; textMuted #8B877C
  background #151412; card (backgroundElement) #201F1B; backgroundRaised #26241F; backgroundSelected #2C2A25; backgroundSunken #1B1A17
  border #353329; divider #272520
  primary #2F6FD0; primaryPressed #275FB4; primaryBg #1D2B42; primaryText #96BEF5; onPrimary #FFFFFF
  accentFg #DDAF63; accentBg #352A17; accentSolid #C8923C; accentText #E2B872; onAccent #1A1408
  successFg #4DC07D / successBg #152F20; warningFg #E2A23E / warningBg #332813; errorFg #EF6F6B / errorBg #3A1D1B; infoFg #96BEF5 / infoBg #1D2B42
  dangerSolid #E5564D (also the notification bell badge red); overlay rgba(0,0,0,0.55)

COLOR — LIGHT ("warm porcelain"):
  text #1D1B16; textSecondary #5C594F; textMuted #767266
  background #F6F4EF; card #FFFFFF; backgroundSelected #ECE9E1; backgroundSunken #F3F1EB
  border #E2DFD6; divider #ECE9E2
  primary #1B5FBE; primaryPressed #164E9D; primaryBg #E8EFFA; primaryText #17549F; onPrimary #FFFFFF
  accentFg #8A5A17; accentBg #F5EBD8; accentSolid #B97A1E; accentText #7A4E12; onAccent #FFFFFF
  successFg #1A7A43 / successBg #E3F2E7; warningFg #9A5B00 / warningBg #F8EDD8; errorFg #BE2E2E / errorBg #FAE7E4; infoFg #17549F / infoBg #E8EFFA
  dangerSolid #D92D20; overlay rgba(29,27,22,0.45)

TYPOGRAPHY — ONE family for Arabic AND Latin: "IBM Plex Sans Arabic" (weights Regular 400 / Medium 500 / SemiBold 600 / Bold 700). Type scale (name — size / lineHeight / weight):
  display 34/46/700; title 30/42/700 (screen heading); subtitle 22/32/700; sectionTitle 19/30/700; cardTitle 17/27/600; body 16/26/400 (RAISE the base body floor to 17sp wherever possible for older-adult readability); link 15/28/500; small 14/22/400; smallBold 14/22/600; eyebrow 13/18/600 with +0.5 letter-spacing — eyebrow letter-spacing is LATIN-ONLY (letter-spacing breaks Arabic letter-joining, never apply it to Arabic); code 13 mono.
  Never set body below 14sp. Prefer a 17sp floor for primary reading text.

SPACING (4pt scale): half 2; one 4; two 8; three 16; four 24; five 32; section 40; six 64. Phone horizontal gutter = 24. 
RADIUS: sm 8; md 12; lg 16; card 20; xl 24; pill 999.
ICON SIZE: sm 16; md 20; lg 28; xl 40.
TOUCH TARGET: minimum 48dp; comfortable 52dp; PRIMARY actions >= 56dp; keep interactive targets >= 8dp apart.
ELEVATION: LIGHT mode only — one whisper-soft shadow (x0 y2 blur10, color rgba(40,36,26,0.06), opacity <= 0.07). DARK mode uses NO shadows — separate surfaces with a lifted background color + a 1px hairline border instead.
LAYOUT MAX WIDTHS: max content width 720; max form width 480 (used for centering on large/tablet; phone uses full width minus the 24 gutter).

=== 3. ICON SYSTEM (semantic, never decorative glyphs/emoji) ===
Use a clean line/duotone vector icon set referenced by MEANING, not by a raw character. Default family is Ionicons-style; use a heart-pulse / pill / stethoscope style only for medication(pill), doctor, and vital(heart-pulse). Create one reusable "Icon" component with a semantic name property.
Semantic icon names to define: chevron (the ONLY directional icon — it mirrors in RTL, pointing the natural back direction), add, close, dot, success, warning, error, info, clock, calendar, medication, task (checklist), appointment (calendar), visit (home), dailyLog (pencil), vital (heart-pulse), doctor, emergency (medkit/cross), member, profile, notification, settings, system, call.
RULES: never use a raw Unicode symbol or emoji as an icon. Status is ALWAYS communicated as icon + text + color together — never color alone, never an icon alone, never just a colored dot. Decorative chips/avatars may hold an icon or a single letterform (the person's initial), but anything that carries meaning must also have a visible text label.

=== 4. HARD RULES — MEDICAL SAFETY, RTL/BIDI, ACCESSIBILITY, NOTIFICATIONS ===

MEDICAL SAFETY (non-negotiable — Sanad organizes and reminds; it does NOT give medical judgment):
- Never diagnose, never interpret a value, never label anything normal / abnormal / good / bad / healthy / high / low (clinically).
- Never color-code vitals or doses by health (no red-is-bad-blood-pressure). Dose status colors are about the LOGGING action (given/postponed/missed), not the patient's health.
- Show vitals and doses as value + unit + an optional neutral timestamp/trend only. Example vitals row: "120/80 mmHg" + time. No ranges, no thresholds, no sparkline that implies judgment.
- Never claim guaranteed emergency response or guaranteed notification delivery; never imply Sanad replaces a doctor, pharmacist, or emergency service.
- Put a quiet, muted disclaimer at the top of every health surface, e.g. medications, vitals, daily logs, the emergency card. Seed copy (Arabic): "قياسات تُدخلها العائلة للحفظ والمتابعة فقط، وليست تشخيصًا أو نصيحة طبية، ولا يُفسّر التطبيق القيم." (vitals) and "يسجّل التطبيق مواعيد الأدوية التي تُدخلها العائلة وتذكيرات بها فقط، ولا يقدّم أي نصيحة طبية." (medications).

RTL / BIDI:
- The whole UI is RTL. Text aligns to the right (the logical start). Lists, cards, rows, headers all mirror.
- Mirror only the chevron/back direction. Do NOT mirror logos, the care-ring, the medkit, the pill, the heart, or numerals.
- Use Western/Arabic digits 0-9 (Latin numerals) consistently for ALL times, doses, phone numbers, dates, and codes — even in Arabic UI.
- Isolate LTR runs inside Arabic: phone numbers, times (24-hour HH:MM), dose strengths ("500 mg"), emails, invitation codes, English drug names, and IANA timezone ids must keep their internal left-to-right order and sit at the start of their container. Never force a whole RTL container to LTR — isolate just the run.

ACCESSIBILITY (older-adult-first):
- Touch targets >= 48dp (primary >= 56dp), spaced >= 8dp apart.
- Body text >= 17sp where possible, never below 14sp.
- Contrast >= 4.5:1 for normal text, >= 3:1 for large text. Verify every text/background pair in both themes.
- Status = icon + text + color (see icon rules). Prefer visible text labels over icon-only controls; the one icon-only control allowed is a clearly-labeled (for screen readers) secondary action.
- Destructive actions get a confirm step + a way to undo or cancel. There is always a clear way back / home.
- Provide clear focus/selected states (brand border + check mark + bold weight, never just a tint).
- Respect reduced motion: any animation must be subtle and optional.

NOTIFICATIONS (honest, calm):
- Honest copy: local reminders are NOT guaranteed delivery; a "test notification" is clearly distinct from a real reminder and from remote push.
- Conservative defaults with a Quiet Hours feature. Human-readable toggles (e.g. "Medication reminders", "Missed dose alerts"). Hide push-token / channel mechanics behind an "Advanced"-style affordance — never show a raw device token, permission enum, or project id to the user.
- Seed Quiet Hours note (Arabic): "يمكن أن تمتد ساعات الهدوء بعد منتصف الليل. تُسلّم التذكيرات العادية بعد انتهاء ساعات الهدوء؛ وقد تصل تنبيهات الطوارئ رغم ذلك."

=== 5. WHAT NOT TO DO (a previous Home was REJECTED — design AGAINST this) ===
The earlier Today-first Home failed because it was:
- too list-like — a long stack of stacked rectangles that read like a report;
- too crowded — a Today hero, then a 2x2 quick-tile grid, then a 6-tile "all care sections" grid, then a 4-tile "care team" grid = four stacked grids of near-identical generic blocks;
- weak hierarchy — every tile looked identical (icon chip + chevron + title + meta, ~48% width, ~116dp tall), so nothing led the eye;
- generic, templated "AI SaaS card grid" — not premium, not warm, not distinctly Sanad;
- redundant — medications/tasks/appointments appeared twice (once as a Today tile, once as a care-section tile).
DO NOT reproduce any of that. The new design MUST feel premium, warm, calm, modern-mobile, Arabic-native, trustworthy, and accessible for older adults: ONE clear hero, generous breathing room, demoted feature navigation, emergency always reachable in one tap, and NO wall of identical rectangles. Use 2-column tiles ONLY where they genuinely help; use a single-column hero where readability matters. Never show fake medical status. Avoid over-decoration.

=== 6. THE SANAD SIGNATURE ELEMENT — "Today Care Ring" ===
Design a calm, distinctive "Today Care Ring" that shows the day's medication-dose loop as "given of total" — it is the one differentiated motif in the app and should anchor the Home hero.
- It reflects RECORDED dose completion (a task loop), NEVER a clinical/health interpretation. Its colors are accent (in progress) / success (complete) / neutral (none) — NOT health colors.
- States (always worded, never color-only): 
  loading — neutral ring + pill icon inside + caption "جارٍ تحميل جرعات اليوم…";
  empty (0 scheduled) — neutral ring + pill icon + caption "لا جرعات مجدولة اليوم";
  progress (given < total) — accent ring + a large "given/total" count inside (Latin digits) + a segmented strip + caption "{given} من {total} جرعة اليوم";
  complete (given >= total) — success ring + a check icon inside + caption "اكتملت جرعات اليوم".
- The ring graphic is decorative for screen readers; the surrounding hero card carries a spoken label like "حلقة رعاية اليوم: {given} من {total} جرعة تم إعطاؤها".
- A segmented strip (up to 8 segments; proportional above 8 doses) sits under or beside the ring. Keep it elegant and minimal — this is a premium signature, not a dashboard gauge.

=== 7. HOME — GENERATE 2-3 ALTERNATIVES, THEN RECOMMEND ONE ===
Produce two to three distinct Home concepts as separate frames, then explicitly recommend ONE (lean toward Option 1 or Option 2 — calmer hierarchy). All options must be Today-first, demote feature navigation, keep Emergency one tap away, avoid a long stack of rectangles, avoid crowding, and breathe.
- Option 1 — Today-first hero: a care-recipient context card at top + the signature Today Care Ring + ONE strong "next action" card (the next dose, with med name and time); below it, a small, quiet set of secondary entries (not a giant grid). Recommended default.
- Option 2 — Calm timeline / daily schedule: one strong "now" card on a vertical day timeline of today's events, with a few compact secondary tiles; reads like a calm agenda.
- Option 3 — Family care command center: a top daily status, the next action, a family handoff strip ("who is on duty"), and a compact (small!) feature grid.
For each option include the dark version. After presenting them, write 3-5 sentences recommending one and why, in terms of clarity/calm/hierarchy for a stressed caregiver.

=== 8. SCREENS / FRAMES TO PRODUCE (Arabic copy on each; dark first, then light) ===
PRIORITIZE these five clusters first and make them the most polished: HOME, MEDICATIONS, EMERGENCY, NOTIFICATIONS, and FORMS (the add/edit pattern). Then produce the rest.

A. App shell & entry
  1. Splash / branded loading (brand-blue overlay that fades; logo lockup "سند").
  2. Sign in (email + password, "تسجيل الدخول", link to sign up).
  3. Sign up (email + password, email-confirmation notice state).
  4. Create-circle onboarding (no circle yet): "أنشئ دائرة الرعاية", circle name + recipient full name + optional birth date, primary CTA "إنشاء دائرة الرعاية", secondary "الانضمام برمز دعوة".
  5. Bottom tab bar component: tabs الرئيسية (Home), استكشاف (Explore), الحساب (Account) — active tab uses a brand-tinted pill + brand label color.

B. HOME (priority) — the 2-3 alternatives from section 7, the recommended one fully built, plus its states: loading, error ("تعذّر تحميل بيانات دائرة الرعاية" + retry), and the no-circle onboarding state.

C. MEDICATIONS (priority)
  6. Medications center: muted disclaimer at top; an info "reminder notice" banner; (managers) "إضافة دواء" primary button; section "جرعات اليوم" = a list of Dose Cards; section "الأدوية" = medication rows. Empty states for both.
  7. Dose Card (the core loop): an accent time chip (HH:MM, LTR-isolated, large/bold) + med name + "dosage • form" + optional "يؤخذ مع الطعام"; a status badge (given=success/check "أُعطيت", postponed=warning/clock "مؤجَّلة", missed=error/cross "لم تُعطَ"); and three action buttons (given / postponed / missed) where the current status is the primary-filled one. Show given, postponed, missed, and not-yet-recorded variants.
  8. Add medication form: name (required) + dosage ("مثال: 500 ملغ") + form ("مثال: حبة، شراب، حقنة") + instructions + a "يؤخذ مع الطعام" switch; then a Dose Schedule editor: a weekday selector (RTL, week starts Sunday, "كل الأيام" select-all), one or more time rows (24h HH:MM picker), start date + optional end date, notes. Sticky bottom save "إضافة دواء".
  9. Medication detail/editor: editable fields (managers) OR a read-only view ("للعرض فقط — لا تملك صلاحية التعديل"); an activate/deactivate row; a "Dose schedules" manager with schedule cards (days / times / date range / active badge) and a weekly summary; inline Edit/Delete with a two-step delete confirm; a "حذف الدواء" destructive row.

D. EMERGENCY (priority — safety-critical, distinct and prominent, NOT a small grid tile)
  10. Emergency card (the "show-a-stranger" read-only screen): a prominent error-toned identity block (recipient name, birth date, approx age as informational only); a medical info section (blood type, allergies, chronic conditions, emergency notes — each value selectable; "غير محدد" when empty); an emergency-contacts section and a doctors section, each with one-tap CALL rows; a muted disclaimer "هذه المعلومات مُدخلة من العائلة للعرض فقط، وليست نصيحة أو تشخيصًا طبيًا." NO SOS / dial-emergency-services button and no "guaranteed response" claim.
  11. Emergency contacts manager: contact cards (name, relationship, phone) with a large one-tap CALL row (phone LTR-isolated, "اتصال {name}"), a "رئيسية" primary badge, managers get add/edit/delete (two-step delete). 
  12. Doctors manager: doctor cards (name, specialty, clinic, optional phone) with an optional one-tap CALL row; managers add/edit via a bottom-sheet form modal.
  13. The CALL affordance component: a wide, high-contrast button row using primaryBg, the "call" icon, the phone number in LTR isolation, min height 52dp.

E. NOTIFICATIONS (priority)
  14. Notifications center: recent-first inbox; per-row type chip + title + body + a meta line (type label • circle name • timestamp, timestamp LTR-isolated); unread rows are bordered with a leading dot + bolder title, read rows are sunken/unbordered; "تحديد الكل كمقروء"; per-circle filter chips when >1 circle; an "enable notifications" info banner; "تحميل المزيد"; empty state "لا توجد إشعارات".
  15. Notification settings: a Push Status card (plain-language "why" + a single "تفعيل الإشعارات" button; honest states for web-unsupported / no-device / granted / denied — NEVER raw diagnostics); a scope selector (all circles vs this circle); 8 human toggles (medication reminders, missed dose alerts, task reminders, appointment reminders, visit updates, care updates, emergency alerts, follow-up summaries) each with a one-line description; Quiet Hours (master toggle + from/to time fields + the honest note); a read-only device-timezone card; Save; and a clearly-separated local "test notification" section labeled as device-only.
  16. Notification bell component: a LABELED pill (icon + "الإشعارات"), NOT an icon-only bell, with an unread count badge (fixed saturated red #D92D20, white text, "99+" cap).

F. FORMS pattern (priority — these recur across the app; design them as a reusable system)
  17. The canonical add/edit form: screen with max form width 480 centered, a sticky bottom save area (primary save + inline saved/error status, no destructive action in the footer), keyboard-avoiding. Show: text field (label + focus ring = 2dp brand border + inline error in errorFg with alert styling), multiline field, switch row, segmented OptionSelect (radio chips — selected = brand tint + brand border + leading check + bold), weekday selector, date field + time field triggers (open a wheel picker bottom sheet — year/month/day or hour/minute, no manual typing), and a date-time pair. Include the unsaved-changes confirm dialog ("تغييرات غير محفوظة" / "تجاهل التغييرات" / "متابعة التعديل").
  18. Bottom-sheet form modal (used for doctors/contacts/schedule add-edit): header with title + close, body fields, footer submit + cancel, NO backdrop-tap dismissal (explicit close only).
  19. Wheel picker sheet: date (year/month/day) and time (hour/minute) columns, Done / Cancel / optional Clear, large 48dp rows, selected row = check + tint + bold.

G. Tasks, Appointments, Visits, Daily logs, Vitals (each: center/list, add form, detail/edit — reuse the Forms pattern; build at least the center + one form + one detail per domain)
  20-22. Tasks: center (today / open / done sections; per-row complete & cancel for permitted users; priority badge only when high/urgent), add task form, task detail with a status section (open/completed/cancelled) and a two-step delete.
  23-25. Appointments: center (today / upcoming; "When" accent chip = date + time, LTR-isolated; type + location + doctor lines), add appointment form (date + start time required, optional end time, optional doctor select), appointment detail with status (scheduled/completed/cancelled + reopen) and delete.
  26-28. Visits (family visits): center (today / upcoming / recent; status planned/completed/cancelled; "link to my account" switch), add, detail.
  29-31. Daily logs: center (today / recent; a structured summary line of mood/sleep/appetite/hydration/pain/mobility — observational, never clinical; "ملاحظات فقط" when none), add (OptionSelect enums + a 0-10 pain stepper + multiline notes; values are observational, no normal/abnormal labels), detail.
  32-34. Vitals: center (today / recent; each row = type + "value unit" + timestamp, NO interpretation), add (type select, date-time, conditional value inputs incl. systolic/diastolic for blood pressure, editable unit suggestion), detail. STRONGEST medical-safety disclaimer here.

H. Care circle & account
  35. Care circle members roster: active / inactive sections; member cards (avatar initial, name, owner/you badges, role • status); managers get invite + manage-invitations + per-member change-role / remove (two-step) / reactivate / make-owner (two-step) / leave; last-admin and owner protection notes.
  36. Change-role modal: a two-step radio picker with plain-language capability bullets (can do / cannot do) per role, then a confirm step that states whether access increases / decreases / stays lateral.
  37. Invite member: a security warning banner, role select, optional reference name, "إنشاء دعوة"; then a created-code card (large LTR code, copy + share + create-another, one-time warning).
  38. Invitations list: status-badged invitation cards (pending/accepted/revoked/expired); revoke = two-step.
  39. Join circle (open to any signed-in user): code field, trust warning, "انضمام", success state.
  40. Recipient profile: read or (managers) edit — full name, birth date, dialect, blood type, allergies, chronic conditions, emergency notes; read-only banner for non-managers; unsaved-changes guard.
  41. Account: signed-in identity (email LTR-isolated, selectable), care-circles section (circle switcher + members link + circle timezone card), notifications links, "الانضمام إلى دائرة أخرى", and a "تسجيل الخروج" danger button.
  42. Circle switcher modal: a bottom sheet listing circles; the current one carries a "الحالية" success badge.

For every screen, include its empty / loading / error states where applicable, and label which theme (dark/light) each frame is.

=== 9. COMPONENT LIBRARY (produce a dedicated "Components" page with variants & states) ===
Build these as Figma components with the listed variants/states (define both dark and light, and interaction states: default / pressed / disabled / focused / selected):
- Screen container (safe-area aware, max-width centered column, 24 gutter).
- Surface / Card (tones: card, sunken, selected, primary, accent, success, warning, error, info; optional pressable).
- Section (titled group with optional action).
- Button (variants: primary, secondary, danger, plain; sizes: md, sm; states: default/pressed/disabled/loading; optional leading icon). Primary >= 56dp.
- IconButton (icon-only secondary; always has an accessibility label; 48dp).
- Icon (semantic-name property; chevron mirrors in RTL).
- StatusBadge (tones success/warning/error/info/neutral; always icon + label; never color-only).
- GlyphChip (tinted circle holding an icon OR a letterform avatar; tones primary/accent/neutral/success/warning/error/info; sizes 36/44/64).
- InfoBanner (tones info/warning/neutral/accent; chip + message + optional action line).
- LtrText (a wrapper marking a run as LTR-isolated; document where it's used: phones, times, codes, emails, IANA ids).
- NavCard (full-width nav row: chip + title + live subtitle + trailing chevron; min height 88).
- DashboardTile (compact 2-col tile: chip + chevron top, title + 1 meta line; min height 116) — use SPARINGLY per the anti-grid rule.
- ContactCard (avatar + name + qualifier + detail lines + one-tap CALL row + actions slot).
- LoadingState / ErrorState / EmptyState.
- FormField (label + input + focus ring + inline error).
- FormModal (bottom sheet; no backdrop dismiss).
- FormActions / StickyFormActions (save + inline status; no destructive action in footer).
- OptionSelect (segmented radio chips; selected = tint + border + check + bold).
- WeekdaySelector (multi-select day chips + "every day"; week starts Sunday).
- DateField / TimeField / DateTimeField / PickerSheet / WheelColumn (wheel pickers; Latin digits; 48dp rows).
- TimezonePicker (searchable IANA list; IANA id shown LTR).
- ItemActions (edit + two-step inline delete confirm).
- UnsavedChangesGuard dialog.
- StatusBadge + Dose status chips for the medication loop.
- TodayCareRing (the signature element; all four states from section 6).
- NotificationBell (labeled pill + unread badge).
- PushStatusCard (honest push enrollment states).
- Tab bar (3 tabs; active = brand-tinted pill).

=== 10. SEED ARABIC COPY (use real Arabic; here are anchors — extend naturally, keep it calm and plain) ===
appName "سند"; greeting "أهلاً بك في سند"; Today "اليوم"; "حلقة رعاية اليوم"; "الجرعة القادمة"; "جرعات اليوم"; medications "الأدوية"; "إضافة دواء"; dose statuses "أُعطيت / مؤجَّلة / لم تُعطَ"; tasks "المهام"; appointments "المواعيد"; visits "الزيارات العائلية"; "السجلات اليومية"; vitals "القياسات الحيوية"; emergency card "بطاقة الطوارئ"; "وصول سريع"; call "اتصال"; notifications "الإشعارات"; "تحديد الكل كمقروء"; settings save "حفظ الإعدادات"; common "حفظ التغييرات / إلغاء / حذف / تأكيد الحذف / تعديل / التفاصيل"; read-only "للعرض فقط — لا تملك صلاحية التعديل"; sign in "تسجيل الدخول"; account "الحساب"; sign out "تسجيل الخروج". Always use Latin digits 0-9 in Arabic copy for numbers, times (e.g. 08:00, 23:00), doses (500 ملغ), dates (YYYY-MM-DD), and phones.

=== 11. DEVELOPER HANDOFF ANNOTATIONS (add to a "Handoff" page and annotate key screens) ===
- Annotate spacing using the token names + values (e.g. "gap = Spacing.three (16)", "gutter 24", "card radius 20").
- Annotate every color with its token NAME, not just the hex (e.g. "card = #201F1B (dark) / #FFFFFF (light)").
- Annotate type styles by scale name (e.g. "cardTitle 17/27/600").
- Mark touch-target sizes on interactive elements (e.g. "primary button height 56", "row min 48").
- Note RTL mirroring on directional icons, and mark every LTR-isolated run (phones, times, codes, emails).
- Note which role sees each control (manager-only vs collaborator vs read-only) where it matters.
- For each status, note the icon + label + tone token used.

=== 12. STYLE GUARDRAILS (read again before generating) ===
- Premium, warm, calm, restrained. The sand accent appears rarely and means "today/now/attention". One confident brand blue. Lots of negative space.
- Do NOT clone Apple Health, Google stock, or a generic SaaS dashboard. Do NOT produce a wall of identical rectangular tiles. Do NOT crowd. Establish ONE clear hero per screen and a strong visual hierarchy beneath it.
- No emoji, no raw glyph icons, no fake medical readouts, no health-color coding, no over-decoration, no drop shadows in dark mode.
- Everything in Arabic, RTL, accessible for older adults, honest about what the app does and does not do.

DELIVERABLE ORDER: (1) Design Tokens page; (2) Components page; (3) the prioritized screens — Home (2-3 alternatives + recommendation), Medications, Emergency, Notifications, Forms; (4) the remaining screens grouped as above; (5) the Handoff annotations page. Produce dark mode for all, then a light variant of each. Use the exact tokens and copy above.
```

---

## 3. Tips / follow-up prompts

Run these one at a time **after** the first generation if your tool truncates or you want to iterate. Each is paste-ready.

- **Home alternatives, one at a time** (if all three came out thin):
  > "Re-do Home Option 1 (Today-first hero) only, at full polish, dark mode. Anchor it with the Today Care Ring in its 'progress' state (e.g. 2 of 5 doses today, Latin digits), one strong 'next dose' card under it, the recipient context card above it, and just 3-4 quiet secondary entries below — no grid wall. Keep Emergency reachable in one tap. Annotate spacing and color tokens."

- **Light variant after dark:**
  > "Now produce the LIGHT ('warm porcelain') variant of every screen you already built in dark, using the light token values exactly (background #F6F4EF, card #FFFFFF, primary #1B5FBE, accent #B97A1E, etc.). Add the whisper-soft light-mode shadow (x0 y2 blur10 rgba(40,36,26,0.06)); keep dark mode shadow-free."

- **Component library page (if it was skipped):**
  > "Build the dedicated Components page now: each component as a Figma component set with variants and states (default/pressed/disabled/focused/selected) in both themes. Include the TodayCareRing (4 states), the Dose Card (4 statuses), StatusBadge (5 tones), OptionSelect, WeekdaySelector, the wheel PickerSheet, ContactCard with the CALL row, NotificationBell pill, and the StickyFormActions footer."

- **Medications deep pass:**
  > "Expand the Medications cluster: the center (today's doses + medication list with empty states), the Dose Card in all four statuses, the Add medication form with the full dose-schedule editor (RTL weekday selector starting Sunday, multiple 24h time rows, start/end dates), and the medication detail with the schedules manager and two-step delete. Disclaimer at top of each. Latin digits for all times and doses."

- **Emergency deep pass:**
  > "Make the Emergency card the most distinct, calm, high-trust screen — not a grid tile. Prominent recipient identity block (error tone), selectable medical info, one-tap CALL rows for contacts and doctors, the family-entered disclaimer. No SOS button, no guaranteed-response claim."

- **Dev-handoff annotations:**
  > "Add a Handoff page and annotate the 5 priority screens with token names + values for spacing, color, and type; mark touch-target sizes (primary 56, rows 48); flag RTL-mirrored chevrons and every LTR-isolated run (phones, times, codes); and note manager-only vs read-only controls."

- **Accessibility / contrast audit:**
  > "Run an accessibility pass: verify every text/background pair meets >=4.5:1 (>=3:1 large) in both themes, confirm body text is >=17sp where possible (never <14sp), confirm all status uses icon+text+color, and confirm targets are >=48dp (primary >=56) and >=8dp apart. List any failures and propose token-safe fixes."

- **Keep it on-brand (if output drifts generic):**
  > "This looks too much like a generic SaaS dashboard / Apple Health. Redo with more negative space, ONE clear hero per screen, warmer porcelain/graphite surfaces, the sand accent used sparingly for 'today/now', and remove any wall of identical rectangular tiles. Restraint is the premium signal."
