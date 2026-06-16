# Sanad Mobile — Figma Make Prompt: Missing Screens

This is a **ready-to-paste prompt for Figma Make**. It asks Figma Make to extend the existing Sanad design (which already covers the main center screens) with **all the missing add/edit/detail/modal/settings/onboarding/auth/picker surfaces**, in the same visual language.

**How to use:** paste Section 2 (the fenced block) into Figma Make as one message. It is self-contained. If your tool truncates, use the per-group follow-up prompts in Section 3 to generate one group at a time. Generate **dark mode first**, then a light variant. Full per-screen detail (fields, validation, permissions, states) lives in `docs/claude-reports/2026-06-16-unmigrated-screens-and-flows-audit.md` — keep it open while reviewing the output.

---

## 1. Why this prompt exists

The current Figma Make design covers the **13 center/list screens** (Home, Explore, Account, Medications, Emergency card, Notifications, Tasks, Appointments, Vitals, Doctors, Members, Daily Logs, Visits) + the bottom tab bar. It does **not** cover any of the inner surfaces a user actually reaches from those centers: add forms, detail/edit screens, the medication schedule editor, pickers, role-change, invitations, notification settings, push opt-in, recipient profile, emergency-contacts editor, auth, and onboarding. Those are still the old app UI. This prompt generates the missing pieces **in the same visual language** so the whole app matches.

---

## 2. THE PROMPT (copy everything below this line)

```
You are extending an existing Figma Make design for "Sanad" (سند) — an Arabic-first, RTL family elderly-care app. The existing design ALREADY covers these center/list screens and the bottom tab bar: Home, Explore, Account, Medications, Emergency card, Notifications, Tasks, Appointments, Vitals, Doctors, Members, Daily Logs, Visits. DO NOT redesign those. Instead, design ALL of the MISSING inner screens, forms, detail pages, modals, settings, onboarding, auth, and pickers listed below — reusing the EXACT same visual language you already established.

=== KEEP THE EXISTING VISUAL LANGUAGE (do not invent a new one) ===
- Dark mode FIRST (then a light variant of each frame). Arabic, fully RTL: text right-aligned, layouts mirrored, the back affordance points right; only directional icons mirror.
- Typeface: Cairo (weights 400/500/600/700/800). Same calm, warm-graphite + teal palette as the existing screens: dark bg #0F0E0C, card #1A1916, elevated #232019, text #EDE8DF, muted #8A837A, hairline border rgba(237,232,223,0.07); teal primary #4BA898 (dark) / #2E8A7B (light); gold accent #C8904A; soft error/emergency #C45050; success #5AAE85. Light mode: bg #F7F3EE, card #FFFFFF, primary #2E8A7B. Per-feature category colors: blue #5A8ABF, purple #8B6FA8, green #4A9A75, gold #C8904A, teal #4BA898.
- Radii 8/12/16/20/24 + pill; large soft cards with a 1px hairline (no heavy shadows in dark). lucide icon style. Generous, older-adult-friendly touch targets (≥48dp; primary ≥56dp). Numbers, times, phone numbers, codes and emails are LTR-isolated even inside Arabic.
- Status is ALWAYS icon + text + color, never color alone. Pending/unlogged/neutral chips use a SOLID light cream/elevated surface (not a colored tint); logged/active states use a soft tint of the status color.
- Reuse the established components: the screen container, the header (round back + centered title + round teal "+"), cards, the icon chip, the status pill, segmented tabs, list rows, buttons (primary/secondary/danger), and a bottom-sheet shell.

=== FOR EVERY SCREEN, DESIGN THESE STATES ===
default, loading, empty, error-with-retry, read-only (for members without manage rights), and destructive-confirmation. Show validation/error text inline (in Arabic). Where an action is permission-gated, show both the allowed and the locked/empty-permission variant.

=== HARD PRODUCT RULES (must hold in every design) ===
- Medical safety: never diagnose or interpret. Vitals = value + unit + timestamp ONLY, with a persistent non-diagnostic disclaimer ("قياسات للحفظ والمتابعة فقط، ليست تشخيصًا، ولا يُفسّر التطبيق القيم") and NO normal/abnormal labels or health-color coding. Daily logs are family observations ("ليست تقييمات طبية"), never clinical.
- Emergency screens are reference only — no SOS dialing, no "guaranteed response". Keep "للاطلاع فقط — ليست خدمة طوارئ".
- Notifications: honest opt-in. A single explicit "enable" action (never auto-on); show distinct states (enabled / not-enabled / web-unsupported / no-device / permission-denied / not-configured). Local test ≠ guaranteed delivery. Quiet hours may still let emergency alerts through. Scheduled reminder times follow the CARE CIRCLE's timezone (the device timezone is display-only).
- Destructive actions (delete medication/task/visit/log/vital/doctor/contact, remove member, revoke invite, transfer ownership) use an inline two-step confirm, never a silent action.
- Forms: labels above inputs, sticky Save that is DISABLED until something changes, an unsaved-changes confirmation when leaving, and Save is NEVER mixed with Delete. Pickers are wheels/sheets (no manual typing) with Western digits.

=== GROUP A — PICKERS & FORM SHELL (design first; every form depends on these) ===
1. Date picker bottom-sheet: three wheel columns (year / month / day), 48dp rows, selected row filled teal + leading check + bold, full-width columns, Done / Clear (optional) / Cancel.
2. Time picker bottom-sheet: hour (00–23) / minute wheels, 24-hour, LTR HH:MM, same chrome.
3. Date+time pair: a labeled date field next to a time field (wraps on narrow screens).
4. Weekday selector: a full-width "كل الأيام" (every day) chip above seven day chips (Sun–Sat), selected = teal fill + check + bold; opt-in selection; error line.
5. Single-choice option chips (category / priority / type / unit / role): a wrapping row of pill chips with hairline outlines, selected filled teal + check; radio semantics.
6. Searchable timezone picker sheet: search field, "this device" shortcut, scrollable "City، Country" rows with the IANA id as an LTR sub-line, selected row checked, "الحالية" tag, empty "no matches".
7. Form text field: Cairo label above a rounded elevated input with a teal focus ring + a multiline notes variant + a red error line (direction follows the app — do NOT force right-align, so LTR phone/email/codes read correctly).
8. Add/edit bottom-sheet shell: rounded top, grab handle, title, X close, scrollable fields slot, inline error line, sticky Save (loading/disabled) + Cancel; explicit dismissal only.
9. Sticky save bar: full-width primary Save (loading/disabled) + optional secondary, an inline saved/error status line above, pinned to the bottom (safe-area) — never contains a delete.
10. Row actions: an Edit + Delete pair that, on Delete, swaps in place to a red "تأكيد الحذف" (with loading) + "إلغاء".

=== GROUP B — AUTH & ONBOARDING ===
11. Sign in: brand header, email (LTR) + masked password fields, one inline alert line (validation/auth error, deliberately generic "بيانات الدخول غير صحيحة"), full-width loading "تسجيل الدخول", footer link to sign-up.
12. Sign up: same layout with email + new-password, plus an inline "تم إنشاء الحساب. تحقّق من بريدك لتأكيده" notice that appears ABOVE the still-visible form (not a separate success screen), footer link to sign-in.
13. Create-circle onboarding (no circle yet): welcoming header, circle name + care-recipient full name + optional birth-date (date picker), primary "إنشاء دائرة الرعاية", and a secondary "الانضمام برمز دعوة".
14. Join circle: an LTR invite-code input, a trust warning, "انضمام", validation for invalid/expired/used codes, and a success confirmation.

=== GROUP C — ADD & EDIT FORMS (opened from the migrated centers' "+" and rows) ===
15. Add / edit medication: non-diagnostic disclaimer; name (required), dosage, dose form, instructions, "يؤخذ مع الطعام" toggle; THEN an inline dose-schedule editor — weekday chips (+ every-day), a repeatable list of HH:MM time rows (add/remove) that highlight DUPLICATE times in red with an inline "هذا الوقت مُدرج بالفعل" error and DISABLE Save, optional start/end dates, notes. Sticky "إضافة دواء" / "حفظ التغييرات".
16. Add / edit dose-schedule bottom-sheet (also used standalone from the medication detail): the same schedule editor, plus a sheet-level conflict banner "{{day}} الساعة {{time}} موجود بالفعل في جدول نشط آخر." Submit disabled until edited / on duplicates.
17. Medication detail: a med-info card (editable for managers, read-only "للعرض فقط" for others) + an active/stopped toggle; a "جداول الجرعات" zone with a weekly summary card and a list of schedule cards (active/stopped pill, days, LTR times, date range, notes, stop/edit/delete) + "إضافة جدول جرعات"; a destructive "حذف الدواء". On the today view, dose cards offer mark أُعطيت / مؤجَّلة / لم تُعطَ inline (gated by permission), with pending doses on the light cream pill.
18. Add / edit task: title (required), description, category chips, priority chips, due-date + due-time pickers, "أسندها إليّ" toggle (or an assignee picker from circle members), notes. Managers-only locked state.
19. Task detail: status block (open / completed / cancelled pill + completed/cancelled timestamp) with complete + cancel actions (for permitted users), three role variants (manager edit / collaborator act-on-own / read-only), managers-only delete.
20. Add / edit appointment: title (required), type chips (doctor/lab/pharmacy/therapy/home-care/family/general), required date + start time, optional end time (must not be before start), location, an optional linked-doctor picker (shown only when doctors exist, with "بدون طبيب"), notes.
21. Appointment detail: status (scheduled/completed/cancelled) with mark-completed / mark-cancelled / reopen; manager edit vs read-only; delete. (Include the cancelled + reopen states explicitly.)
22. Add / edit visit: visitor name (required), date (required), optional start/end times, notes; a manager-only "اربطها بحسابي" toggle and a static "ستُسجَّل الزيارة باسم حسابك" note for caregivers.
23. Visit detail: status (planned/completed/cancelled) + reopen; manager/owner edit vs read-only; delete.
24. Add / edit daily log: observational disclaimer; date picker; single-choice chip groups for المزاج / جودة النوم / الشهية / الترطيب / الحركة (each with an explicit "غير محدّد"); a pain-level control 0–10 with a DISTINCT "بدون" state (none ≠ 0); four optional multiline note wells; "إضافة سجل". Include an inline "لديك سجل لهذا التاريخ بالفعل" duplicate-date error.
25. Daily log detail: editable vs read-only ("ملاحظات فقط" when only notes), delete; observational tone.
26. Add / edit vital: STRONG non-diagnostic disclaimer; measurement-type chips (ضغط الدم / النبض / الحرارة / سكر الدم / الأكسجين / الوزن / أخرى) that auto-fill the unit; a date+time picker (defaults to now); a CONDITIONAL value area — two LTR numeric fields (الانقباضي / الانبساطي) for blood pressure, a single numeric field otherwise, optional for "أخرى"; editable unit; notes. No normal/abnormal anything.
27. Vital detail: read-only (type chip + LTR timestamp + value+unit, hidden when none) vs editable; delete; strictly non-diagnostic.
28. Add / edit doctor (bottom-sheet): name (required), specialty, LTR phone, clinic/hospital, notes; dirty-gated save; discard confirm. AND extend the migrated doctor card with manager-only edit + inline delete (currently a doctor can be created but never edited/deleted — fix this).

=== GROUP D — MEMBER MANAGEMENT (several of these are currently UNREACHABLE — design them AND give them a clear entry point on the members screen) ===
29. Invite member: a sensitive-data warning banner, a role picker limited to roles the inviter can grant, an optional invited-name field, "إنشاء دعوة".
30. Invitation-created code reveal: a large LTR selectable invite code, role + expiry lines, a prominent "يظهر هذا الرمز الآن فقط ولا يمكن استرجاعه" warning, Copy / Share / "إنشاء دعوة أخرى".
31. Invitations list: status-pill cards (pending/accepted/revoked/expired) with role, expiry, accepted-by, created-by; a two-step "إلغاء" (revoke) on pending; empty state. (Give it an entry point from the members screen.)
32. Change member role (two-step bottom-sheet): step 1 = a radio list of assignable roles, each with a one-line capability summary and an expandable "يستطيع / لا يستطيع" detail, with a "الحالي" badge; step 2 = confirm "{{from}} ← {{to}}" with a plain-language note saying whether access rises or falls. (Add a per-member action that opens this — manager only.)
33. Remove member: add a destructive confirmation step (the current screen removes on a single tap).
34. Member actions surface: make-owner (owner-only, irreversible, two-step confirm), leave circle (self), reactivate (for inactive members) — plus an inactive-members section and owner / last-admin protection notes.

=== GROUP E — SETTINGS, PROFILE & EMERGENCY EDITORS (currently unreachable or old — design them AND restore their entry points) ===
35. Recipient profile: a calm form (full name, birth date picker, dialect, blood type, allergies, chronic conditions, emergency notes) with editable + read-only modes; this feeds the emergency card, so keep it clinical but non-diagnostic. (Add an entry point — most naturally from Home, Account, or an "edit medical info" affordance on the emergency card.)
36. Emergency-contacts manager: a manager "+", a list of cards (avatar, name, relationship, LTR phone, a "رئيسية" pill for the primary, sorted first, a one-tap call, manager edit/delete); an add/edit sheet with name (required), relationship, phone (REQUIRED, LTR phone-pad), a "جهة اتصال رئيسية" toggle, notes. A contact list, NOT a dialing service. (Restore an entry point — e.g. from the emergency card.)
37. Notification settings: a push-enable card at top; a scope selector (your global default vs each care circle, with a hint that circle settings override the default); a grouped card of eight labeled on/off rows (medication reminders, missed-dose alerts, task reminders, appointment reminders, visit updates, care updates, emergency alerts, follow-up summaries) each with a one-line description; a quiet-hours card (enable toggle revealing from/to time pickers + an honest note that emergency alerts may still arrive); a read-only device-timezone card (LTR) clarifying scheduled times follow the circle's timezone; inline save with saved/error; and a separate "اختبار على هذا الجهاز" local-test section (honest: a local self-test, not proof of delivery).
38. Push status / enable card: icon + short why + a privacy line (token tied to this device only, no health details shared) + a SINGLE explicit enable button; honest states — not-enabled (primary "تفعيل الإشعارات"), enabled (success pill + "إيقافها على هذا الجهاز"), web-unsupported, simulator/no-device, permission-denied (point to OS settings), not-configured.
39. Reminder-notice banner: a soft info strip used at the top of the medications / tasks / appointments lists that explains reminders are managed centrally, with a "manage" chevron (RTL-aware) opening notification settings. Informational, not a per-item toggle.
40. Home loading / error / no-circle states: design the Home screen's first-load spinner, an error-with-retry state, and the no-circle state (which currently shows old UI) so the flagship screen matches even before data arrives.

=== DELIVERABLE ORDER ===
First Group A (pickers + form shell — everything else reuses them), then Group C (the add/edit/detail forms — highest user value), then Group D (member management), then Group B (auth + onboarding), then Group E (settings/profile/emergency). For each: dark first, then light; Arabic RTL; realistic Arabic copy; all states (default/loading/empty/error/read-only/destructive-confirm); and developer-handoff annotations (token names, spacing, target sizes, which controls are manager-only, and every LTR-isolated run).
```

---

## 3. Follow-up prompts (paste one at a time if the tool truncates)

- **Pickers first:** "Generate only Group A — the date, time, date+time, weekday, option-chip, and timezone pickers plus the form text field, add/edit bottom-sheet shell, sticky save bar, and row-actions cluster — dark + light, Arabic RTL, Cairo, teal/warm-graphite, ≥48dp rows, Western LTR digits for time. These are reused by every other screen."
- **Medications deep pass:** "Generate the medication add form (with the inline schedule editor + duplicate-time red rows that disable Save), the standalone add/edit schedule bottom-sheet (with the cross-schedule conflict banner), and the medication detail screen (editable/read-only med info, active toggle, weekly summary + schedule cards with stop/edit/delete, delete-medication confirm, and today's dose cards with inline أُعطيت/مؤجَّلة/لم تُعطَ where pending uses the light cream pill)."
- **Detail screens:** "Generate the detail/edit screens for task, appointment, visit, daily log, and vital — each with editable + read-only modes, a status block (with the right transitions incl. appointment/visit reopen and the cancelled state), a managers/owner-gated delete with inline confirm, and loading/error/not-found states."
- **Member management (fix the dropped capabilities):** "Generate the invite form, the one-time invite-code reveal, the invitations list with two-step revoke, the two-step change-role sheet (capability lists + raise/lower-access confirm), a remove-member confirmation, and a member-actions surface (make-owner irreversible confirm, leave, reactivate) with an inactive-members section and owner/last-admin notes — and add the per-member action entry points + a 'manage invitations' entry on the members screen."
- **Auth + onboarding:** "Generate sign-in, sign-up (with the inline check-email notice), create-circle onboarding (no-circle), and join-circle — Arabic RTL, LTR email/code fields, loading/submit + validation states."
- **Settings + profile + emergency editors:** "Generate notification settings (scope + 8 toggles + quiet hours + read-only device timezone + local-test), the push status/enable card with all honest states, the reminder-notice banner, the recipient-profile form (editable/read-only), the emergency-contacts manager (list + add/edit sheet with required LTR phone + primary toggle), and the Home loading/error/no-circle states — and restore entry points to recipient profile and emergency contacts."
- **Light variants + handoff:** "Now produce the light-mode variant of every frame above using the light tokens (bg #F7F3EE, card #FFFFFF, primary #2E8A7B), and add a handoff page annotating token names, spacing, target sizes, manager-only controls, and every LTR-isolated run."

---

*Companion to `docs/claude-reports/2026-06-16-unmigrated-screens-and-flows-audit.md`, which has the exhaustive per-screen field/validation/permission/state detail for implementation.*
