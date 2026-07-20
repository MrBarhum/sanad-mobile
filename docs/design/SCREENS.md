# Screen inventory — every frame in design/Sanad Home Directions.dc.html

Open the HTML in a browser and pan/zoom. Frames are grouped in numbered sections (newest at top); each frame's badge id below. Every frame exists in LIGHT and DARK (identical layout, token swap only). All frames are 390px wide.

**Canonical palette = section 5 badge 5a («دار · الأخضر والرمل»).** Sections 5b/5c (indigo, clay) and any earlier direction explorations that remain in the file are alternates — DO NOT implement them.

## Section 5 — Foundation
- **5a الرئيسية / Home (Today)** — report 02. Header band: date, circle switcher (chevron), recipient line (74 سنة · حجازيّة), bell + unread badge (3), emergency square. Medication loop: "جرعات اليوم 3/5" tile + next-dose tile, 5-cell dose bead strip. Two stat tiles (2 مهام، 1 موعد). Next-appointment row. وصول سريع 4x2 tile grid (8 destinations). Gold «متاح للتكفّل» banner. جرعات اليوم dose list (log CTA on due dose, «تعديل الحالة» on postponed, done rows with pills). نبض اليوم 3-event feed + share icon. Emergency info banner. Tab bar (الرئيسية active).

## Section 6 — Medications (report 04)
- **6a قائمة الأدوية / Medications list** — sub-screen header with + action; segmented tabs (جرعات اليوم / كل الأدوية); dose cards: name 16/800, dose instruction, time LTR, status pill (icon+text), responsible person, tsjeel button on due doses. SECOND FRAME: the **quiet/empty state** («لا جرعات اليوم») — calm tok-tinted check circle, reassuring title + line; NOT an error.
- **6b إضافة دواء / Add-edit medication form** — text input (اسم الدواء), dosage value + unit picker row, schedule time picker rows (add/remove), responsible-person selector (member chips), notes, primary save. Includes the **inline validation error state**: err 2px border on the invalid field + err icon + 15px message; save stays enabled.

## Section 7 — Auth, appointment detail, notifications, system states
- **7a تسجيل الدخول / Sign in** — report 01. Logo tile, welcome title, email + password wells, primary sign-in, create-account secondary, forgot-password link.
- **7b تفاصيل الموعد / Appointment detail** — report 06. Band + edit action; hero card (title, doctor, clinic); info rows (date/time LTR, location, responsible member); notes well; actions (confirm attendance style primary, directions secondary); status pill icon+text.
- **7c الإشعارات / Notifications** — report 14. Unread rows (acc dot + bolder title + tint icon square) vs read rows; per-row domain icon; times LTR; mark-all-read pill; empty-quiet variant may reuse 6a pattern.
- **7d حالات النظام / System states** — report 15. ERROR frame: تعذّر التحميل card (warn icon square, title 16/800, muted line, bordered «إعادة المحاولة»). SKELETON frame: جارٍ التحميل — sunken pulsing blocks mirroring the home layout.

## Section 8 — Explore, account, tasks, vitals, daily logs, visits
- **8a استكشاف / Explore** — report 03. Band title + subtitle; 3 grouped cards: الرعاية اليومية (4 rows), الصحة والمتابعة (4 rows), دائرة الرعاية (3 rows); each row = tinted icon square + title + meta + left chevron. Tab bar (استكشاف active).
- **8b الحساب / Account** — report 03. Profile card (avatar square, "signed in as", name, email LTR, edit square); دوائر الرعاية rows (circle, notification settings, join another); danger sign-out; «سند · الإصدار 1.0.0». PLUS sheet frame: تعديل الاسم bottom sheet (grab handle, focused input, save/cancel).
- **8c المهام / Tasks** — report 05. Sub-header + add; segmented status tabs (اليوم/مفتوحة/مكتملة) + scope pills (مهامي/كل المهام); rows: 28px checkbox circle, title, due LTR, assignment meta («مُسندة إليك» / «غير مُسندة»), err X square = تعذّر الإنجاز; unassigned rows carry «أنا متكفّل» claim pill; done row struck-through + pill. PLUS sheet frame: complete-confirm sheet.
- **8d القياسات الحيوية / Vitals** — report 08. Non-diagnostic banner; 2-col grid of reading cards (icon square, label, value 24/900 LTR + unit, when + who). PLUS form frame: type chips, BP double input (128 / 82), date+time wells LTR, notes, save. Gold non-diagnostic banner on form.
- **8e السجل اليومي / Daily logs** — report 09. Banner; day cards (date title, icon+label+value rows: مزاج/نوم/شهية/ألم, note wells). PLUS form frame: date well, chip groups (مزاج/نوم/شهية/حركة each with غير محدّد), pain control: «بدون» pill + stepper + 0-10 scale row, notes, save.
- **8f الزيارات العائلية / Visits** — report 07. Tabs القادمة/السابقة; visitor cards (tinted person square, name, «زيارة عائلية», datetime LTR nowrap, «زيارتك» home-icon meta or «مرتبطة بـ سارة» link meta, chevron). Planned visits have NO status pill (pills only on closed visits).

## Section 9 — Members, roles, invites, claiming, emergency, pulse
- **9a دائرة الرعاية / Members** — report 10. Summary pill (5 أعضاء); «إدارة الدعوات» button; member rows: letter avatar, name + «أنت» badge, role icon + role label + email meta, ⋯ menu; «غير نشطين» section at 60% opacity with «مُزال» meta; role legend card (3 dot rows).
- **9b تغيير الدور / Change-role sheet** — report 10. Radio cards (selected = acc border + tacc fill + filled radio), role descriptions, warn direction note («هذا يقلّل صلاحيات العضو»), save/cancel.
- **9c رمز الدعوة / Invite code** — report 10. Gold shown-once warning; code well SND-7K4M (28/900, LTR, letter-spaced); role + expiry rows; WhatsApp primary, copy/share pair, create-another; ok «تم نسخ الرمز» feedback line (icon+text).
- **9d متاح للتكفّل / Claim feed** — report 11. Groups مهام(2) → أدوية(1) → مواعيد(1) with icon+count headers; cards with title, due/meta, «أنا متكفّل» pill.
- **9e بطاقة الطوارئ / Emergency card** — report 12. «للاطلاع فقط — ليست خدمة طوارئ» shield note in bordered terr hero (siren circle, name, age); معلومات طبية rows (blood type LTR, allergies, chronic, notes = «غير محدد» when empty) + تعديل links; contact rows with err call circles (bg-colored phone icon), phone LTR; doctors row; footer disclaimer.
- **9f سجل النشاط / Pulse** — report 13. Share-summary pill; rows: domain icon square + «actor · masdar action» + time (today = time only, older = date · time LTR); «تحميل المزيد».

## Not drawn — compose from archetypes
- Onboarding / create-circle wizard (report 01): 7a canvas + 6b form patterns + 9c code patterns.
- Appointments list (06): 8f card/tab pattern with 7b fields.
- Medication detail (04): 7b detail pattern.
- Task detail / manager edit (05): 7b + 6b patterns.
- Doctors list & recipient profile (12): 9a row pattern + 9e info rows.
- Manage invitations list (10): 9a rows + status pills (نشطة/مستخدمة/منتهية — icon+text).
- Join circle (10): single code input (9c well style) + primary button.
- Notification settings (14): grouped card + toggle rows (toggle spec in README).
