# NEW screens only — Section 10 (gap fill)

These 7 screens are ADDITIONS to an app already implemented from the previous handoff (design_handoff_sanad). Same design system, same tokens, same components — nothing else changed.

Open design/New Screens -Section 10-.dc.html in a browser (keep support.js next to it). All frames light + dark, 390px wide.

## Section 10 — Gap fill: medication detail, appointment add/edit, doctors, visit add/edit
- **10a تفاصيل الدواء / Medication detail (manager)** — report 04 screen 3. Gold disclaimer; editable info fields (name required, dosage, form, instructions) + with-food toggle (state word مفعّل — never color-only); responsible chips; saved line + «حفظ التغييرات»; activation row («الدواء فعّال» + إيقاف); جداول الجرعات: help line, weekly summary card (ملخّص أسبوعي + «عرض الجرعات لكل يوم»), schedule cards (الجدول N + فعّال/موقوف badge, info rows, إيقاف/إعادة تفعيل + تعديل + حذف), add-schedule button + «أنشئ جدولاً جديدًا عندما تختلف الأيام», two-step danger «حذف الدواء». Read-only members instead get «للعرض فقط…» + info rows (compose from 7b).
- **10b إضافة موعد / Add appointment** — report 06 screen 2. Gold coordination disclaimer; title* well; 7 type chips (طبيب/تحاليل/صيدلية/علاج طبيعي/رعاية منزلية/عائلي/عام); التاريخ والوقت card (date* well, start* + optional end side-by-side, «اختياري — HH:MM» placeholder); المكان well; الطبيب chips (بدون طبيب first, only when circle has doctors); المسؤول chips (غير محدد default); ملاحظات; «إضافة موعد» CTA.
- **10c تفاصيل الموعد / Appointment manager editor** — report 06 screen 3 variant A (complements 7b's read-only view). Same fields prefilled; status card («الحالة» + مجدول badge icon+text, actions «تم الموعد» primary / «تعذّر الموعد» secondary → inline two-step confirm); delete card shown mid two-step («تأكيد الحذف» filled err + إلغاء); «حفظ التغييرات» footer.
- **10d الأطباء / Doctors directory** — report 12 §3. Sub-header + manager «+»; doctor cards: stethoscope icon square, name 17/800, specialty · clinic meta, primary-tinted call circle (tacc fill + acc phone), LTR phone well (sunken, centered), divider, manager footer تعديل + حذف — second card shows the two-step delete state. Empty state: «لا يوجد أطباء بعد».
- **10e إضافة طبيب / Add-doctor sheet** — report 12 §3 FormModal. Scrim + bottom sheet: grab handle, close X square + centered title; fields الاسم* (focused), التخصص, رقم الهاتف (LTR), اسم العيادة أو المستشفى, ملاحظات; stacked «إضافة طبيب» + «إلغاء». Edit mode = same sheet titled «تعديل بيانات الطبيب» with «حفظ التغييرات».
- **10f تسجيل زيارة / Add visit** — report 07 screen 2 (manager variant). Gold disclaimer; اسم الزائر* well; تاريخ الزيارة* date well; وقت البدء + وقت الانتهاء pair (both optional, end placeholder «اختياري — HH:MM»); ملاحظات («تفاصيل الزيارة...»); divider + «ربط بعضو» chips (غير محدد default). Collaborator variant: replace the picker with the muted note «ستظهر هذه الزيارة في سجل حسابك». CTA «إضافة زيارة».
- **10g تفاصيل الزيارة / Visit manager editor** — report 07 screen 3a. Prefilled fields + relink chips; status card («الحالة» + مخطّطة badge, «تمت الزيارة» primary / «تعذّرت الزيارة» secondary → two-step confirm); danger «حذف الزيارة» (two-step); «حفظ التغييرات». Closed visits swap actions for «إعادة كمخطّطة» (manager only). Read-only view (3b) composes from 7b's rows.


## Not drawn — compose from archetypes
- Onboarding / create-circle wizard (report 01): 7a canvas + 6b form patterns + 9c code patterns.
- Appointments list (06): 8f card/tab pattern + 10b fields; completed cards get the «تمّ» success pill.
- Task detail / manager edit (05): 10c editor pattern with 8c row fields.
- Recipient profile (12): 8b profile card + 10a editable-field pattern + 9e info rows.
- Manage invitations list (10): 9a rows + status pills (نشطة/مستخدمة/منتهية — icon+text).
- Join circle (10): single code input (9c well style) + primary button.
- Notification settings (14): grouped card + toggle rows (toggle spec in README; state word مفعّل/متوقف).
- Schedule add/edit sheet (04): 10e sheet chrome + 6b day-chips/time-rows fields.
