# Sanad Mobile — Screen & Interaction Inventory

Part of the **Sanad Mobile Figma design handoff package**. This document is the authoritative, per-screen inventory: every navigable screen, every important interaction, the prioritized Figma frame set, and the per-module data-states matrix. It is written so a human product designer **and** Figma AI can build from it directly.

Sibling docs in this package (cross-reference, do not duplicate):
- `sanad-mobile-figma-design-brief.md` — master brief (product, users, principles, IA, visual system, home direction, copy/language).
- `sanad-mobile-component-inventory.md` — every component + design-system primitives (props, variants, accessibility).
- `sanad-mobile-figma-ai-master-prompt.md` — single paste-ready Figma / Figma Make / Figma AI prompt.
- `sanad-mobile-design-acceptance-criteria.md` — how a future Claude Code run safely implements the approved Figma design.

Conventions used throughout: routes are Expo Router paths; file paths are under `src/`. Copy keys are quoted with their Arabic (source) and English values where load-bearing. The current uncommitted Today-first home is the **rejected negative example** — references to "Home" below describe the *behavior and data* that must be preserved, NOT the rejected layout (see the brief and §D for the required new direction). All numerals are Western/Latin (0-9); times are 24-hour `HH:MM`; dates are `YYYY-MM-DD`; LTR runs (phones, times, codes, emails, drug names) are bidi-isolated.

---

## A. App map / screen index

Expo Router file tree. Parenthesized segments `(auth)`, `(app)`, `(tabs)` are route groups (organizational, not part of the URL). `[id]` is a dynamic route. There is **no** `src/app/index.tsx`; entry resolves through group-layout redirects (session-less → `/sign-in`; session-ful → `/` → Home).

```
ROOT  src/app/_layout.tsx ............... RootLayout: fonts + icon fonts, providers, themed nav, animated splash overlay

(auth)  src/app/(auth)/_layout.tsx ...... guard: if session → redirect "/"
  1. sign-in ........ /(auth)/sign-in ........... src/app/(auth)/sign-in.tsx ......... Authenticate an existing user
  2. sign-up ........ /(auth)/sign-up ........... src/app/(auth)/sign-up.tsx ......... Create a new account (+ email-confirm notice)

(app)  src/app/(app)/_layout.tsx ........ guard: if !session → redirect "/sign-in"; renders headless NotificationObserver
  (tabs)  bottom tab bar (Home / Explore / Account)
  3. Home ........... / ........................ src/app/(app)/(tabs)/index.tsx ..... Today-first care dashboard / circle gate (onboarding | dashboard)
  4. Explore ........ /explore ................. src/app/(app)/(tabs)/explore.tsx ... DEV-ONLY "coming soon" placeholder tab
  5. Account ........ /account ................. src/app/(app)/(tabs)/account.tsx ... Account hub: identity, circles, notifications links, sign out

  — Flat detail screens pushed over the tab bar (native header) —
  6. Recipient profile ...... /recipient-profile ...... src/app/(app)/recipient-profile.tsx .... View/edit the care recipient's core + medical profile
  7. Emergency card ......... /emergency-card ......... src/app/(app)/emergency-card.tsx ....... Read-only "show-a-stranger" quick-reference card
  8. Emergency contacts ..... /emergency-contacts ..... src/app/(app)/emergency-contacts.tsx ... Maintain + one-tap-call emergency contacts
  9. Doctors ................ /doctors ................ src/app/(app)/doctors.tsx ............. Doctor directory + one-tap call
 10. Join circle ........... /join-circle ............ src/app/(app)/join-circle.tsx ......... Enter an invitation code to join a circle
 11. Notifications center ... /notifications .......... src/app/(app)/notifications.tsx ....... Recent-first cross-circle notification inbox
 12. Notification settings .. /notification-settings .. src/app/(app)/notification-settings.tsx Push enable + per-type prefs + quiet hours + local test

  — circle-members nested stack —
 13. Members ............... /circle-members ............... src/app/(app)/circle-members/index.tsx ....... Circle roster + manager controls
 14. Invite member ........ /circle-members/invite ........ src/app/(app)/circle-members/invite.tsx ...... Generate a single-use invitation code
 15. Pending invitations .. /circle-members/invitations ... src/app/(app)/circle-members/invitations.tsx . Review/revoke invitations

  — medications nested stack —
 16. Medications center ... /medications ......... src/app/(app)/medications/index.tsx .. Today's doses (dose loop) + medication list
 17. Add medication ...... /medications/new ..... src/app/(app)/medications/new.tsx .... Create a medication + its first dose schedule
 18. Medication detail ... /medications/:id ..... src/app/(app)/medications/[id].tsx ... View/edit a medication; manage schedules; activate/delete

  — tasks nested stack —
 19. Tasks center ........ /tasks ........ src/app/(app)/tasks/index.tsx .... Today/open/done care-task hub
 20. Add task ........... /tasks/new .... src/app/(app)/tasks/new.tsx ...... Create a care task
 21. Task detail ........ /tasks/:id .... src/app/(app)/tasks/[id].tsx ..... View/edit a task; complete/cancel; delete

  — appointments nested stack —
 22. Appointments center . /appointments ........ src/app/(app)/appointments/index.tsx .. Today/upcoming appointments
 23. Add appointment .... /appointments/new .... src/app/(app)/appointments/new.tsx .... Schedule a new appointment
 24. Appointment detail . /appointments/:id .... src/app/(app)/appointments/[id].tsx ... View/edit; done/cancel/reopen; delete

  — visits nested stack —
 25. Visits center ...... /visits ........ src/app/(app)/visits/index.tsx ... Today/upcoming/recent family visits
 26. Add visit ......... /visits/new .... src/app/(app)/visits/new.tsx ..... Record a family visit
 27. Visit detail ...... /visits/:id .... src/app/(app)/visits/[id].tsx .... View/edit; done/cancel/reopen; delete

  — daily-logs nested stack —
 28. Daily logs center .. /daily-logs ........ src/app/(app)/daily-logs/index.tsx . Today/recent daily condition observations
 29. Add daily log ..... /daily-logs/new .... src/app/(app)/daily-logs/new.tsx ... Capture one day's structured observations + notes
 30. Daily log detail .. /daily-logs/:id .... src/app/(app)/daily-logs/[id].tsx .. View/edit a log; delete

  — vitals nested stack —
 31. Vitals center ..... /vitals ........ src/app/(app)/vitals/index.tsx ... Today/recent readings (non-diagnostic)
 32. Add vital ........ /vitals/new .... src/app/(app)/vitals/new.tsx ..... Record one reading (value + unit + time)
 33. Vital detail ..... /vitals/:id .... src/app/(app)/vitals/[id].tsx .... View/edit a reading; delete
```

**Navigable screen count: 33 route screens** (excludes `_layout.tsx` infrastructure files). In addition there are **design states that are not separate routes** but MUST be designed as their own frames:
- **Splash / first-paint** (native splash held during font load + the branded blue `AnimatedSplashOverlay`) — a shell state, not a route.
- **Create-circle onboarding** — rendered *inside* Home (route `/`) when the user belongs to zero circles (`CareCircleOnboarding`); design it as its own frame.
- **No-active-circle gate** (`CircleGate` empty state) — shown on any care-detail screen when there is no active circle.
- **Modals / bottom sheets** that are not routes: circle switcher sheet, schedule add/edit modal, doctor/contact add/edit modal, role-change modal, date/time/timezone picker sheets, two-step inline delete confirms, unsaved-changes prompt.

So the Figma frame set spans **33 routes + ~7 non-route states**. The seven nested `_layout.tsx` files plus the four group/root `_layout.tsx` files are routing infrastructure and are not designed.

---

## B. Per-screen detail

> Template fields: **Screen name · Route/file · Purpose · Primary user job · Data shown · Primary CTA · Secondary actions · Destructive actions · Empty state · Loading state · Error state · Accessibility notes · RTL/LTR notes · Medical-safety notes · Figma design notes.** A field is omitted only when truly N/A.

### B.0 Splash / loading (shell state)

- **Screen name:** Splash / first-paint
- **Route/file:** Shell — `src/app/_layout.tsx` (RootLayout) + `src/components/animated-icon.tsx` (`AnimatedSplashOverlay`). No route.
- **Purpose:** Hold the native splash while fonts (IBM Plex Sans Arabic Regular/Medium/SemiBold/Bold + Ionicons + MaterialCommunityIcons glyph fonts) load, then fade a branded blue overlay away on first paint so the UI never flashes the fallback font.
- **Primary user job:** None — wait briefly while the app boots.
- **Data shown:** Nothing user-facing. The overlay is a full-screen solid `#208AEF` view running a 600ms Reanimated entering keyframe (starts large/opaque, fades to opacity 0 by 70%, settles at scale 1), then unmounts.
- **Loading state:** While `!fontsLoaded && !fontsError`, RootLayout returns `null` (native splash stays up). Font-load failure is tolerant: the app renders anyway and falls back to system font.
- **Error state:** No user-facing error; font error falls through to system font.
- **Accessibility notes:** Overlay is purely decorative (no a11y content). Respect reduced-motion: in Figma annotate that the fade must be skippable / honored by OS reduce-motion.
- **RTL/LTR notes:** Centered brand mark, direction-neutral.
- **Figma design notes:** One frame, dark-first (then light). The splash color `#208AEF` and the unused `AnimatedIcon` gradient (`#3C9FFE → #0274DF`) are hard-coded, NOT theme tokens — flag this for tokenization in the design. Keep it calm and minimal; the brand mark on a solid field, no spinner text. This is the only place a saturated brand blue fills the whole screen.

### B.1 Sign in

- **Screen name:** Sign in
- **Route/file:** `/(auth)/sign-in` — `src/app/(auth)/sign-in.tsx`
- **Purpose:** Authenticate an existing user (Supabase `signInWithPassword`).
- **Primary user job:** Enter email + password and sign in.
- **Data shown:** Title `auth.signInTitle` "تسجيل الدخول" / "Sign in"; subtitle `auth.signInSubtitle` "سجّل الدخول للمتابعة إلى سند"; email + password fields; footer link to sign-up.
- **Primary CTA:** `auth.signInButton` "تسجيل الدخول" / "Sign in" (`loading`/`disabled` while submitting).
- **Secondary actions:** `auth.noAccount` "ليس لديك حساب؟" + `Link` to `/sign-up` (`auth.signUpLink` "إنشاء حساب").
- **Empty state:** N/A (form).
- **Loading state:** Submit button shows spinner + disabled; validation runs synchronously before any network call.
- **Error state:** Single inline error line, `themeColor="errorFg"`, `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`. Keys: `auth.errors.email` "يرجى إدخال بريد إلكتروني صحيح", `auth.errors.password` "يجب أن تتكوّن كلمة المرور من ٦ أحرف على الأقل", `auth.errors.signInFailed` "بيانات الدخول غير صحيحة".
- **Accessibility notes:** Title `accessibilityRole="header"`. Fields are `FormField` (focus ring = brand 2dp border; `accessibilityLabel = label`). Layout `Screen center keyboardAvoiding gap=Spacing.five maxWidth=MaxFormWidth edges={{top:true}}` (tab/no-native-header screen → passes top inset). Touch targets ≥ comfortable.
- **RTL/LTR notes:** Arabic-first RTL; the email field value (Latin) reads naturally LTR within the input. Password placeholder uses Eastern-Arabic numeral ٦ — the single deviation from the app-wide Latin-digit rule; flag for review (consider "6").
- **Medical-safety notes:** N/A. No social login, no forgot-password, no remember-me.
- **Figma design notes:** Calm centered single-column form ≤ `MaxFormWidth` (480). Generous vertical rhythm (`Spacing.five`). Dark-first. Two fields + one primary button + one text link; no chrome. One-handed: keep the button low / within thumb arc.

### B.2 Sign up

- **Screen name:** Sign up
- **Route/file:** `/(auth)/sign-up` — `src/app/(auth)/sign-up.tsx`
- **Purpose:** Create a new account (Supabase `signUp`); handle the email-confirmation flow.
- **Primary user job:** Enter email + password and create the account.
- **Data shown:** Title `auth.signUpTitle` "إنشاء حساب"; subtitle `auth.signUpSubtitle` "أنشئ حسابك للبدء"; same two fields; footer link to sign-in.
- **Primary CTA:** `auth.signUpButton` "إنشاء حساب" / "Create account".
- **Secondary actions:** `auth.haveAccount` "لديك حساب بالفعل؟" + `Link` to `/sign-in` (`auth.signInLink`).
- **Loading state:** Button spinner + disabled while submitting.
- **Error state:** `error` slot (errorFg, alert, polite) → `auth.errors.signUpFailed` "تعذّر إنشاء الحساب" or field errors. A **separate** `notice` slot (textSecondary, polite) shows `auth.signUpCheckEmail` "تم إنشاء الحساب. تحقّق من بريدك الإلكتروني لتأكيد الحساب." when `!data.session` (confirmation required). Both clear at submit start.
- **Accessibility notes:** Title `accessibilityRole="header"`; password autofill hint differs from sign-in (`new-password`). Two distinct feedback slots (error vs notice) must be visually distinguishable (red alert vs neutral info).
- **RTL/LTR notes:** Same as sign-in (Eastern-Arabic ٦ in password placeholder noted).
- **Medical-safety notes:** N/A.
- **Figma design notes:** Mirror sign-in exactly for consistency; add the neutral "check your email" notice state as a variant. Dark-first.

### B.3 Create-circle onboarding (no-circle state of Home)

- **Screen name:** Create your care circle (onboarding)
- **Route/file:** Rendered inside Home `/` — `src/features/care-circle/onboarding-form.tsx` (`CareCircleOnboarding`), shown when `hasNoCircles || !activeCircle`.
- **Purpose:** First-run creation of the user's first care circle (or join via code).
- **Primary user job:** Name the circle + add the person they care for, then create it.
- **Data shown:** Title `careCircle.onboarding.title` "أنشئ دائرة الرعاية"; subtitle `careCircle.onboarding.subtitle` "ابدأ بإضافة الشخص الذي تعتني به"; fields: Circle name (default pre-filled `careCircle.onboarding.circleNameDefault` "رعاية الوالد"; placeholder "مثال: رعاية الوالد"), Recipient full name (placeholder "مثال: محمد عبدالله"), Birth date (optional, `DateField` wheel picker → `YYYY-MM-DD`, clearable).
- **Primary CTA:** `careCircle.onboarding.submit` "إنشاء دائرة الرعاية" (`loading`/`disabled` while submitting).
- **Secondary actions:** `careCircle.onboarding.joinWithCode` "الانضمام برمز دعوة" (`variant="plain"`) → `/join-circle`.
- **Destructive actions:** None.
- **Loading state:** Both buttons disabled while `createCircle.isPending`.
- **Error state:** First failing field maps to a localized error: `errors.circleName` "يرجى إدخال اسم دائرة الرعاية", `errors.recipientName`, `errors.birthDate` "أدخل التاريخ بصيغة YYYY-MM-DD", `errors.submitFailed` "تعذّر إنشاء دائرة الرعاية. حاول مرة أخرى." Rendered as `ThemedText` `accessibilityRole="alert"` + polite, `errorFg`.
- **Accessibility notes:** Title `accessibilityRole="header"`; `Screen maxWidth=MaxFormWidth edges={{top:true}} keyboardAvoiding`. Birth-date opens a wheel year/month/day `PickerSheet` (no manual typing).
- **RTL/LTR notes:** RTL form; date stored as `YYYY-MM-DD`.
- **Medical-safety notes:** None (identity only, no medical fields here).
- **Figma design notes:** This is the user's very first impression — warm, calm, welcoming, NOT a wall of inputs. Single-column ≤ 480. Lead with a friendly headline + supportive subtitle; the three fields below with generous spacing; one confident primary CTA + a quiet "join with a code" alternative. Design empty + filled + error + loading variants. Dark-first.

### B.4 Home — Today-first care dashboard

- **Screen name:** Home (Today-first dashboard)
- **Route/file:** `/` — `src/app/(app)/(tabs)/index.tsx` (`HomeScreen`) → branches to `CareCircleOnboarding` (B.3) or `CareCircleDashboard` (`src/features/care-circle/circle-dashboard.tsx`). Today logic in `today-overview.tsx`; signature ring in `today-care-ring.tsx`.
- **Purpose:** Answer the core promise — "Know what your parent needs today, and know whether it got done." Today-first, feature navigation demoted, emergency one tap away.
- **Primary user job:** See today's medication dose loop + the single next action, then act.
- **Data shown (preserve this data, redesign the layout):**
  - Header: greeting `home.greeting` "أهلاً بك في سند", today's long date `formatLongDate(i18n.language)` (e.g. "الأحد، 15 يونيو"), and the `NotificationBell` (labeled pill with unread badge).
  - **Today Care Ring** (signature element): `given`-of-`total` today's doses via `useTodayDoses` + `summarizeDoses`. States `loading | empty | progress | complete` with worded captions `careCircle.dashboard.today.loopDoses` "{{given}} من {{total}} جرعة اليوم", `loopAllDone` "اكتملت جرعات اليوم", `loopNone` "لا جرعات مجدولة اليوم", `loopLoading` "جارٍ تحميل جرعات اليوم…".
  - **Next dose / next action:** `today.nextDoseLabel` "الجرعة القادمة" + med name + LTR-isolated time, or `today.nextDoseAllGiven` "تم إعطاء جرعات اليوم" / `nextDoseNone` "لا جرعات اليوم".
  - Today snapshots (a *snapshot, not a feed*): next today appointment (`useUpcomingAppointments`), tasks due today (`useTodayTaskSummary` → `today.tileTasksValue` "{{count}} مستحقّة"), emergency quick-access.
  - Secondary feature destinations (demoted): medications, daily logs, vitals, tasks, appointments, visits; care team: members, recipient profile, emergency contacts, doctors. Per-feature live metas from each `useToday*Summary`.
- **Primary CTA:** The single strong "next action" (open medications / mark the next dose). Today hero is one pressable → `/medications`.
- **Secondary actions:** NotificationBell → `/notifications`; circle switcher (only if >1 circle); navigate to each feature center; emergency → `/emergency-card`.
- **Destructive actions:** None on Home.
- **Empty state:** Onboarding (B.3) when no circle. When a circle exists but there are no doses today: ring `empty` state with worded caption; next-dose shows "لا جرعات اليوم".
- **Loading state:** Full-screen centered `ActivityIndicator` (`color=theme.primary`, `size="large"`) while circle resolves; ring shows its own `loading` caption while doses load (NOT a bare spinner — keep a calm placeholder caption).
- **Error state:** `Screen scroll={false} center` with `ErrorState` message `careCircle.loadError` "تعذّر تحميل بيانات دائرة الرعاية", retry `retry`, onRetry `refetch`.
- **Accessibility notes:** Hero + each tile are single button nodes with composed `accessibilityLabel` ("title. meta"). The ring is decorative (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`); the parent surface carries the spoken label `careCircle.dashboard.today.loopA11y` "حلقة رعاية اليوم: {{given}} من {{total}} جرعة تم إعطاؤها" / `loopA11yNone`. Section titles `accessibilityRole="header"`.
- **RTL/LTR notes:** RTL throughout; times LTR-isolated (`LtrText` / `isolateLtr`). Chevrons mirror centrally. Tab screen → `edges={{top:true}}`.
- **Medical-safety notes:** The ring reflects **recorded dose completion (a task loop), never a clinical judgment**; tones are accent/success/neutral, NOT health colors; captions always state meaning in words (never color-only). No fake medical status. "Missed/overdue" framing must be neutral ("not yet given"), never blaming.
- **Figma design notes (CRITICAL — this is the rejected screen's replacement):** Do NOT reproduce the rejected layout (four stacked near-identical 2-column tile grids; ~15 identical `DashboardTile`s; data-dense bullet metric metas; medications/tasks/appointments duplicated; emergency demoted to a peer tile). Instead, per the brief's HOME DIRECTION, produce **2-3 premium alternatives** (lean Option 1 or 2):
  - **Option 1 — Today-first hero:** care-recipient card + the **Today Care Ring** + ONE strong next-action card; a small, quiet set of secondary features below. ONE clear hero, generous breathing room, distinct premium/warm feel.
  - **Option 2 — Calm timeline / daily schedule:** one strong "now" card on a vertical day timeline with compact secondary tiles; reads like a calm agenda.
  - **Option 3 — Family care command center:** top daily status + next action + a "who is on duty" handoff strip + a compact feature grid.
  - All options: Today-first; feature nav demoted; emergency always one tap away (distinct, prominent affordance — not a 48% tile); NO long stack of identical rectangles; not crowded; 2-column tiles ONLY where they genuinely help; single-column hero where readability needs it. Design Home in four data variants (see frames §D): no-data, active day (progress), completed day, overdue/missed (medical-safe wording). Dark-first, then light. Recommend ONE option explicitly.

### B.5 Explore (DEV-ONLY)

- **Screen name:** Explore (placeholder)
- **Route/file:** `/explore` — `src/app/(app)/(tabs)/explore.tsx`
- **Purpose:** **Dev-only placeholder tab.** Three non-interactive "coming soon" cards describing future features (guides, resources, community). No logic, no data fetching.
- **Primary user job:** None — informational placeholder.
- **Data shown:** Title `explore.title` "استكشاف"; subtitle `explore.subtitle` "ميزات قادمة لمساعدتك في رحلة الرعاية"; three `Surface` cards each with a decorative glyph chip, a title, a `explore.comingSoon` "قريباً" pill, and a subtitle.
- **Accessibility notes:** Title `accessibilityRole="header"`; cards are non-interactive. NOTE: this screen does NOT use the `Screen` primitive (it rolls its own `ThemedView` + `SafeAreaView` + `ScrollView`) — an inconsistency to flag.
- **RTL/LTR notes:** RTL; `MaxContentWidth` cap; `BottomTabInset` bottom padding.
- **Figma design notes:** Low priority. Either design a single "Explore — coming soon" frame OR recommend hiding the tab for production (it reuses the home PNG as a placeholder icon — `account` tab also reuses home.png, flagged TODO). Do not invent feature content; keep it honest "coming soon".

### B.6 Recipient profile

- **Screen name:** Care recipient profile
- **Route/file:** `/recipient-profile` — `src/app/(app)/recipient-profile.tsx` (inside `CircleGate`) → `src/features/recipient-profile/profile-form.tsx`.
- **Purpose:** View and (managers only) edit the care recipient's core + medical profile.
- **Primary user job:** Read or update the recipient's identity and medical-safety fields.
- **Data shown:** Title `recipientProfile.title` "ملف من تعتني به". Fields: Full name (required), Birth date (`DateField`, clearable), Dialect "اللهجة", Blood type "فصيلة الدم", Allergies "الحساسية" (multiline), Chronic conditions "الأمراض المزمنة" (multiline), Emergency notes "ملاحظات الطوارئ" (multiline). `photo_url` is out of scope.
- **Primary CTA:** `FormActions` save `recipientProfile.save` "حفظ التغييرات", `disabled={!dirty}`, `saving={update.isPending}` (managers only).
- **Secondary actions:** None beyond field editing.
- **Destructive actions:** None (no delete-recipient).
- **Empty state:** No recipient row → centered `EmptyState` icon `Glyph.profile`, title `recipientProfile.empty` "لم تتم إضافة بيانات بعد" (no create CTA — read/edit only).
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `recipientProfile.loadError` "تعذّر تحميل بيانات الملف" + retry. Save: success `recipientProfile.saved` "تم حفظ التغييرات" (successFg, alert+polite); failure `recipientProfile.saveFailed` "تعذّر حفظ التغييرات. حاول مرة أخرى." (errorFg).
- **Accessibility notes:** Non-managers see `InfoBanner tone="neutral"` `recipientProfile.readOnly` "للعرض فقط — لا تملك صلاحية التعديل"; all fields `editable={false}`. `UnsavedChangesGuard when={canManage && dirty}` (confirm `common.discardChanges` / `common.keepEditing`). Editing resets a shown saved/error status to idle.
- **RTL/LTR notes:** RTL; birth date `YYYY-MM-DD`. No hardcoded textAlign.
- **Medical-safety notes:** Allergies / chronic conditions / emergency notes are free-text the family enters — the app never interprets them. No diagnosis, no normal/abnormal labeling.
- **Figma design notes:** Two variants — manager (editable, sticky/inline save) and read-only (neutral banner at top, fields disabled). Group medical-safety fields visually under a clear "medical info" subhead. Multiline fields roomy. Dark-first.

### B.7 Emergency card

- **Screen name:** Emergency card ("show-a-stranger")
- **Route/file:** `/emergency-card` — `src/app/(app)/emergency-card.tsx` → `src/features/emergency/emergency-card.tsx`.
- **Purpose:** A single read-only screen a caregiver can hand to a stranger / first responder — recipient identity + medical info + emergency contacts + doctors, aggregated.
- **Primary user job:** In an emergency, show or read out key info and call a contact in one tap.
- **Data shown:** Identity `Surface` (`GlyphChip` emergency/error tone; `emergencyCard.recipientLabel` "الشخص الذي تعتني به"; name or `emergencyCard.noRecipient` "لم تتم إضافة البيانات بعد"; birth date + `emergencyCard.approxAge` "العمر التقريبي" via `approximateAgeYears`, informational). Medical section `emergencyCard.medicalTitle` "معلومات طبية": blood type, allergies, chronic conditions, emergency notes (each falls back to `emergencyCard.notSpecified` "غير محدد"; values `selectable`). Contacts `emergencyCard.contactsTitle` "جهات اتصال الطوارئ" (or `noContacts`). Doctors `emergencyCard.doctorsTitle` "الأطباء" (or `noDoctors`). Bottom disclaimer.
- **Primary CTA:** Tap any phone row to call (`tel:` via `ContactCard`). There is **no SOS / dial-emergency-services button** and no guaranteed-response claim.
- **Secondary actions:** Select/copy medical values.
- **Destructive actions:** None (read-only).
- **Empty state:** Per-section fallbacks (`notSpecified`, `noContacts`, `noDoctors`).
- **Loading state:** `LoadingState` if any of the three queries load.
- **Error state:** `ErrorState` `emergencyCard.loadError` "تعذّر تحميل بطاقة الطوارئ" + retry (refetches all three).
- **Accessibility notes:** Call rows are `Pressable` `accessibilityRole="button"`, `accessibilityLabel` = "اتصال {name}" (falls back to phone), `minHeight=TouchTarget.comfortable`. Values selectable. High contrast required (responder may be a stranger, possibly low light).
- **RTL/LTR notes:** Phones LTR-isolated + `selectable`; age/dates Latin digits.
- **Medical-safety notes:** Bottom disclaimer `emergencyCard.disclaimer` "هذه المعلومات مُدخلة من العائلة للعرض فقط، وليست نصيحة أو تشخيصًا طبيًا." Strictly informational; family-entered; no diagnosis; no claim of replacing emergency services.
- **Figma design notes:** **Priority frame.** Must be maximally legible at a glance: large name, large blood type, clearly labeled allergies/conditions, big tappable call rows. Calm but high-contrast; design for being read by someone who has never seen the app. Reachable from Home in one tap. Dark-first AND a high-legibility light variant (likely used in bright/outdoor conditions). No alarming red wash — emergency/error tone used sparingly on the identity chip only.

### B.8 Emergency contacts

- **Screen name:** Emergency contacts
- **Route/file:** `/emergency-contacts` — `src/app/(app)/emergency-contacts.tsx` → `src/features/emergency/contacts-manager.tsx`.
- **Purpose:** Maintain the emergency-contact list and call a contact in one tap; mark one primary.
- **Primary user job:** Add/edit contacts and call them.
- **Data shown:** Ordered primary-first. Each `ContactCard`: name, relationship subtitle, phone (required), `StatusBadge tone="info"` `emergencyContacts.primaryBadge` "رئيسية" when primary, notes.
- **Primary CTA:** `emergencyContacts.add` "إضافة جهة اتصال" (managers only) → opens add modal. Per-card primary action = one-tap call (phone required, so the call row always renders).
- **Secondary actions:** Per-card `ItemActions` Edit / Delete (managers only).
- **Destructive actions:** Delete — inline two-step confirm: Delete → `common.confirmDelete` "تأكيد الحذف" (danger, loading) + `common.cancel`. No system alert.
- **Empty state:** `EmptyState` icon `Glyph.contact`, title `emergencyContacts.emptyTitle` "لا توجد جهات اتصال", subtitle `emptySubtitle` "أضف جهة اتصال للطوارئ" (managers only).
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `emergencyContacts.loadError` "تعذّر تحميل جهات الاتصال" + retry.
- **Accessibility notes:** Call row labeled "اتصال {name}"; primary indicated by badge text+tone (never color-only). Add/edit modal fields validated (name + phone required).
- **RTL/LTR notes:** Phones LTR-isolated. Relationship/notes RTL.
- **Medical-safety notes:** No emergency phone numbers are hard-coded (no 911/999) — contacts are user-entered. The call fails quietly on tablets/emulators (no telephony) — no "guaranteed response" wording.
- **Figma design notes:** Card list with a prominent call affordance per card; primary contact visually surfaced first (badge). Add/edit modal = bottom sheet (no backdrop-tap dismiss). Dark-first.

### B.9 Doctors

- **Screen name:** Doctors
- **Route/file:** `/doctors` — `src/app/(app)/doctors.tsx` → `src/features/doctors/doctors-manager.tsx`.
- **Purpose:** Keep the circle's doctor directory and call a doctor in one tap.
- **Primary user job:** Add/edit doctors and call them.
- **Data shown:** Oldest-first. Each `DoctorCard` → `ContactCard`: name, specialty subtitle, clinic detail, phone (optional), notes.
- **Primary CTA:** `doctors.add` "إضافة طبيب" (managers only). Per-card call row only when a phone exists (`callLabel` = "اتصال {name}").
- **Secondary actions:** `ItemActions` Edit / Delete (managers only).
- **Destructive actions:** Delete — inline two-step confirm (same pattern as contacts).
- **Empty state:** `EmptyState` icon `Glyph.doctor`, title `doctors.emptyTitle` "لا يوجد أطباء", subtitle `doctors.emptySubtitle` "أضف طبيبًا لمن تعتني به" (managers only).
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `doctors.loadError` "تعذّر تحميل قائمة الأطباء" + retry.
- **Accessibility notes:** Call row labeled per name. Add/edit modal: only `name` required.
- **RTL/LTR notes:** Phone LTR-isolated; specialty/clinic RTL.
- **Medical-safety notes:** Directory only — no clinical content. A doctor may have no phone (call row absent) — design the no-phone card variant.
- **Figma design notes:** Same `ContactCard` language as emergency contacts but with specialty/clinic lines. Design both with-phone and without-phone card variants. Dark-first.

### B.10 Members (care circle roster)

- **Screen name:** Members
- **Route/file:** `/circle-members` — `src/app/(app)/circle-members/index.tsx` → `src/features/circle-members/members-manager.tsx`.
- **Purpose:** View the people in the circle; managers manage roles, status, and ownership.
- **Primary user job:** See who's in the circle; adjust membership.
- **Data shown:** Header `circleMembers.title` "الأعضاء". Two sections: Active "الأعضاء النشطون" and (if any) Inactive "غير نشطين". Each `MemberCard`: `GlyphChip` initial, display name (full name | email | `circleMembers.unnamed` "عضو"), badges `circleMembers.owner` "المالك" (info) / `circleMembers.you` "أنت" (neutral), email via `LtrText` (when both email + name present), a `role • status` meta line.
- **Primary CTA:** `invitations.invite` "دعوة عضو" → `/circle-members/invite` (managers only).
- **Secondary actions:** `invitations.manageTitle` "الدعوات" → `/circle-members/invitations`; per-member Change role (opens `RoleModal`), Reactivate `circleMembers.reactivate` "إعادة تفعيل".
- **Destructive actions:** Remove — two-step inline confirm `circleMembers.remove` "إزالة" → `circleMembers.confirmRemove` "تأكيد الإزالة" + cancel (status → removed). Leave circle `circleMembers.leave` "مغادرة الدائرة" (danger, **fires immediately, no confirm** → calls leave then `/`). Make owner `circleMembers.makeOwner` "تعيين كمالك" → `confirmMakeOwner` "تأكيد النقل" (two-step; ownership transfer).
- **Empty state:** No explicit empty (the viewer is always a member); Inactive section hidden when empty.
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `circleMembers.loadError` "تعذّر تحميل الأعضاء" + retry. Action errors: `ThemedText` alert+polite, errorFg, mapped to `circleMembers.errors.{lastAdmin|owner|notAllowed|generic}`.
- **Accessibility notes:** Owner note `circleMembers.ownerNote` and last-admin note `lastAdminNote` (italic, continuity protection) shown when applicable. Role/status are text (never color-only). Alerts use live region.
- **RTL/LTR notes:** RTL cards; email LTR-isolated; `role • status` joined by bullet.
- **Medical-safety notes:** N/A (membership/continuity, not medical). Owner/last-admin protections prevent orphaning the circle.
- **Figma design notes:** Roster of member cards with clear role/status text + badges; manager actions revealed contextually (not on every card for every viewer). Design owner card (non-removable), last-admin protected state, self card (Leave), inactive member card. Dark-first.

### B.11 Change role (modal)

- **Screen name:** Change role
- **Route/file:** Modal from Members — `src/features/circle-members/role-modal.tsx` (`RoleModal`).
- **Purpose:** Pick a new role with plain-language capabilities, then explicitly confirm raise/lower of access before mutating.
- **Primary user job:** Choose + confirm a member's new role.
- **Data shown:** Step 1 (pick): hint `circleMembers.changeRoleHint` "اختر الدور الجديد لهذا العضو." + one `RoleOption` per assignable role (radio; leading `Glyph.check`; role title; `circleMembers.current` "الحالي" badge; one-line summary; expandable Can do "يستطيع" / Cannot do "لا يستطيع" bullet lists). Step 2 (confirm): `circleMembers.roleChangeSummary` ("{{from}} ← {{to}}" AR / "→" EN) + a direction sentence `circleMembers.direction.{increase|decrease|lateral}`.
- **Primary CTA:** Step 1 `circleMembers.saveRole` "حفظ تغيير الدور" (disabled until selection differs) → step 2 `circleMembers.confirmChange` "تأكيد التغيير" (loading while submitting).
- **Secondary actions:** Step 1 `common.cancel`; Step 2 `circleMembers.back` "رجوع".
- **Destructive actions:** None (reversible role change), but a decrease is highlighted by the direction sentence.
- **Loading state:** Confirm shows loading + disabled.
- **Error state:** Modal-local alert (errorFg, polite); on failure the modal stays open with `roleError`.
- **Accessibility notes:** Title `accessibilityRole="header"` (step-aware); `RoleOption` `accessibilityRole="radio"` + `accessibilityState.selected`; details toggle `circleMembers.showDetails`/`hideDetails`; close button labeled `common.close`; touch floor 48dp.
- **RTL/LTR notes:** Direction arrow mirrored in copy (← in Arabic, → in English).
- **Figma design notes:** Bottom-sheet, two-step (pick → confirm). Make the increase/decrease/lateral framing visually distinct (the confirm is the safety moment). Dark-first.

### B.12 Invite member

- **Screen name:** Invite member
- **Route/file:** `/circle-members/invite` — `src/app/(app)/circle-members/invite.tsx` → `src/features/invitations/invite-form.tsx`.
- **Purpose:** Generate a single-use invitation code for a chosen role and share it.
- **Primary user job:** Pick a role, create the code, copy/share it.
- **Data shown:** Top warning `InfoBanner tone="warning"` `invitations.warning` "أي شخص يملك هذا الرمز يمكنه الانضمام إلى الدائرة والاطّلاع على معلومات رعاية حسّاسة. شاركه فقط مع من تثق بهم." Fields: Role (`OptionSelect` of invitable roles; admin never invitable), Invited name (optional, reference-only). Success `CreatedCard`: large LTR code in a sunken surface, role + expiry lines, a one-time warning `invitations.codeOnceWarning`.
- **Primary CTA:** `invitations.create` "إنشاء دعوة"; in success state, `invitations.copy` "نسخ الرمز".
- **Secondary actions:** Success: `invitations.share` "مشاركة", `invitations.createAnother` "إنشاء دعوة أخرى".
- **Destructive actions:** None.
- **Loading state:** Create button loading/disabled while pending.
- **Error state:** `invitations.createFailed` "تعذّر إنشاء الدعوة. حاول مرة أخرى." as alert. Copy/share feedback `invitations.copied`/`invitations.shared` (polite live region).
- **Accessibility notes:** Code rendered with `LtrText` `selectable`, `accessibilityLabel={code}`; managers-only screen (else `EmptyState` `invitations.managersOnly`). Success header `accessibilityRole="header"`.
- **RTL/LTR notes:** Code LTR-isolated, large `letterSpacing`. Share message `invitations.shareMessage` "انضم إلى دائرة الرعاية في سند بهذا الرمز: {{code}}".
- **Medical-safety/trust notes:** Two security warnings (sharing-grants-sensitive-access + code-shown-once). Code is hashed server-side, never re-shown.
- **Figma design notes:** Two distinct states: the form (with the warning banner) and the success/code card (with copy/share, one-time warning). Make the code unmissable and copyable. Dark-first.

### B.13 Pending invitations

- **Screen name:** Pending invitations
- **Route/file:** `/circle-members/invitations` — `src/app/(app)/circle-members/invitations.tsx` → `src/features/invitations/invitations-list.tsx`.
- **Purpose:** Review all invitations and revoke pending ones.
- **Primary user job:** See invitation lifecycle and revoke when needed.
- **Data shown:** Per `InvitationCard`: `GlyphChip` members; title = invited name or role; `StatusBadge` colored by status (pending→info, accepted→success, revoked→error, expired→warning) with label `invitations.status.*`; role line; expiry (pending); accepted-by / created-by lines.
- **Primary CTA:** `invitations.invite` "دعوة عضو" → `/circle-members/invite`.
- **Secondary actions:** None beyond revoke.
- **Destructive actions:** Revoke (pending only) — two-step inline confirm `invitations.revoke` "إلغاء" → `confirmRevoke` "تأكيد الإلغاء" + cancel.
- **Empty state:** `EmptyState` icon `Glyph.members`, title `invitations.emptyTitle` "لا توجد دعوات", subtitle `emptySubtitle` "أنشئ دعوة لإضافة فرد من العائلة أو مقدّم رعاية."
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `invitations.loadError` "تعذّر تحميل الدعوات" + retry. Revoke failure `invitations.revokeFailed` "تعذّر الإلغاء. حاول مرة أخرى." (alert).
- **Accessibility notes:** Status communicated by badge shape + text. Managers-only (else `managersOnly`).
- **RTL/LTR notes:** Dates `YYYY-MM-DD`; RTL layout.
- **Figma design notes:** Status-badged card list. Design all four status variants. No resend/extend (lifecycle is create → revoke|accept|expire). Dark-first.

### B.14 Join circle

- **Screen name:** Join a care circle
- **Route/file:** `/join-circle` — `src/app/(app)/join-circle.tsx` → `src/features/invitations/join-form.tsx`. NOT behind `CircleGate` (open to any authenticated user).
- **Purpose:** Enter a received invitation code to join a circle; on success it becomes the preferred active circle.
- **Primary user job:** Type/paste the code and join.
- **Data shown:** Title `joinCircle.title` "الانضمام إلى دائرة رعاية"; subtitle `joinCircle.subtitle`; code field (placeholder "مثال: ABCDE-FGHJK", `autoCapitalize="characters"`); warning `InfoBanner tone="warning"` `joinCircle.warning`. Success: `joinCircle.successTitle` "تم انضمامك" + subtitle.
- **Primary CTA:** `joinCircle.submit` "انضمام"; success → `joinCircle.continue` "متابعة" → `/`.
- **Destructive actions:** None.
- **Loading state:** Submit loading/disabled while accepting.
- **Error state:** Inline error mapped: `errors.required`, `alreadyMember` "أنت عضو في هذه الدائرة بالفعل.", `expired`, `revoked`, `used` "تم استخدام هذه الدعوة من قبل.", `invalid` "رمز الدعوة غير صحيح.", `generic`.
- **Accessibility notes:** Title `accessibilityRole="header"`; inline error under the field.
- **RTL/LTR notes:** Code field reads LTR-ish (characters); warning RTL.
- **Medical-safety/trust notes:** Warning that a code grants sensitive-care access — only enter codes from trusted people.
- **Figma design notes:** Simple single-field form + warning + success state. Mirror the auth visual language for consistency (reachable from onboarding and Account). Dark-first.

### B.15 Medications center (today's doses + list)

- **Screen name:** Medications center
- **Route/file:** `/medications` — `src/app/(app)/medications/index.tsx` → `src/features/medications/medications-center.tsx`.
- **Purpose:** The dose loop home — today's scheduled doses + the active medication list.
- **Primary user job:** Mark each of today's doses given / postponed / missed.
- **Data shown:** Top: disclaimer `medications.disclaimer`; `ReminderNotice` (`medications.reminderNotice`, info banner → `/notification-settings`). Section A `medications.todayTitle` "جرعات اليوم": `DoseCard`s. Section B `medications.listTitle` "الأدوية": `MedicationRow`s. Each `DoseCard`: accent LTR time chip (`formatHm`, 20px bold), med name (cardTitle), `dosage • form`, `withFoodHint` "يؤخذ مع الطعام", instructions, and a `StatusBadge` once set.
- **Primary CTA:** `medications.add` "إضافة دواء" (managers only) → `/medications/new`. The core action is the per-dose status loop.
- **Secondary actions:** Tap a `MedicationRow` → `/medications/:id` (a11y hint `medications.tapToEdit`).
- **Dose-status actions (canLog):** Three buttons in fixed order Given / Postponed / Missed — `medications.status.given` "أُعطيت", `postponed` "مؤجَّلة", `missed` "لم تُعطَ". The button matching current status is `primary`, others `secondary`. No separate undo/clear; re-tap a different status to correct.
- **Destructive actions:** None here (delete lives on detail).
- **Empty state:** Section A empty → `EmptyState` med icon, `medications.noDosesTitle` "لا توجد جرعات اليوم", subtitle `noDosesSubtitle`. Section B empty → `noMedsTitle` "لا توجد أدوية بعد", subtitle `noMedsSubtitle` (managers only).
- **Loading state:** `LoadingState` while the composed today query loads (the med-list query has no separate loading branch).
- **Error state:** `ErrorState` `medications.loadError` "تعذّر تحميل الأدوية" + retry (refetches all three). Dose-status mutation has **no error toast / no optimistic update** — a failed change silently re-enables buttons (design must not imply success on failure).
- **Accessibility notes:** Each dose card is a node; while a dose is pending all three buttons are `disabled` (no per-button spinner). `StatusBadge` = tone + shape icon + label (given→check, postponed→clock, missed→cross). Status changes apply immediately (no confirm; reversible).
- **RTL/LTR notes:** Time chip LTR-isolated; `dosage • form` joined by bullet; English drug names isolated.
- **Medical-safety notes:** Disclaimer "…ولا يقدّم أي نصيحة طبية." Statuses are neutral facts (given/postponed/"not given") — never blaming, never color-as-health. `withFood` is a plain hint, not app-generated instruction.
- **Figma design notes:** **Priority module.** The DoseCard is the heart of the product — make the time anchor scannable, the three status actions large (≥48dp, ≥8dp apart) and unmistakable, and the set/unset states clearly different. Design dose card in: unset, given, postponed, missed, pending/disabled. Keep the two sections distinct but calm. Dark-first.

### B.16 Add medication

- **Screen name:** Add medication
- **Route/file:** `/medications/new` — `src/app/(app)/medications/new.tsx` → `src/features/medications/medication-form.tsx`. Managers only (else `EmptyState` `medications.managersOnly`).
- **Purpose:** Create a medication + its first dose schedule in one submit.
- **Primary user job:** Enter the medication and at least one valid time/day so today's doses start generating.
- **Data shown:** Disclaimer at top. Fields: Name (required), Dosage (placeholder "مثال: 500 ملغ"), Form (placeholder "مثال: حبة، شراب، حقنة"), Instructions (multiline, "مثال: بعد الأكل"), With-food `Switch` "يؤخذ مع الطعام". Divider, then section `medications.firstScheduleTitle` "جدول الجرعات" with `ScheduleFields` (weekday selector, times list, start/end dates, notes).
- **Primary CTA:** `StickyFormActions` save `medications.add` "إضافة دواء"; `disabled={!dirty || hasDuplicateTimes}`, `saving` spinner.
- **Destructive actions:** None.
- **Loading state:** Save shows `ActivityIndicator`.
- **Error state:** Field errors mapped (`medications.errors.name` "يرجى إدخال اسم الدواء"; schedule errors below). Submit failure `medications.saveFailed` "تعذّر الحفظ. حاول مرة أخرى." in footer.
- **Accessibility notes:** `UnsavedChangesGuard when={dirty && !submitted}`. Switch carries `accessibilityLabel`. Live duplicate-time indicator; daysRequired error.
- **RTL/LTR notes:** RTL form; times `HH:MM`, dates `YYYY-MM-DD`, both via wheel pickers (no typing).
- **Medical-safety notes:** Only `name` is required; everything else is free text. No drug database, no interaction/dosage checks.
- **Figma design notes:** Long single-column form ≤ 480 with a sticky footer save. The schedule editor (weekdays + times list + dates) is the complex part — design it inline here and reuse for the modal (§B.18 schedule picker). Dark-first.

### B.17 Medication detail / editor

- **Screen name:** Medication detail
- **Route/file:** `/medications/:id` — `src/app/(app)/medications/[id].tsx` → `src/features/medications/medication-editor.tsx`.
- **Purpose:** View/edit one medication's fields, manage its dose schedules, activate/deactivate, delete. (No per-medication "today's doses" view — those live only on the center.)
- **Primary user job:** Maintain the medication and its schedules.
- **Data shown:** Section A `medications.medicationInfoTitle` "معلومات الدواء" (editable `MedicationFields` for managers / `ReadOnlyMedication` info rows otherwise; `ActivationRow` with `medications.activeLabel`/`inactiveLabel`). Section B Dose schedules: `ScheduleSummary` weekly read-out + `ScheduleCard`s (each numbered, with active/stopped badge, days, times, range, notes).
- **Primary CTA:** Inline `FormActions` save `common.saveChanges`; managers add schedule `medications.addScheduleAtMed` "إضافة جدول جرعات جديد".
- **Secondary actions:** Activate/deactivate (med + per schedule), Edit schedule (opens modal), `ScheduleSummary` per-day expand toggle.
- **Destructive actions:** Delete medication `DeleteMedicationRow` `medications.deleteMedication` "حذف الدواء" → inline confirm `common.confirmDelete` + cancel → `router.back()`. Per-schedule delete via `ItemActions` (inline two-step). No native alerts.
- **Empty state:** No schedules → `EmptyState` `medications.noSchedules`. Not found → `EmptyState` med icon `medications.notFound` "لم يتم العثور على الدواء".
- **Loading state:** `LoadingState` while either query loads.
- **Error state:** `ErrorState` `medications.loadError` + retry. Save: `medications.saved` "تم حفظ التغييرات" / `saveFailed`.
- **Accessibility notes:** `medications.scheduleGroupsHelp` explains multiple schedules; section headers `accessibilityRole="header"`; `UnsavedChangesGuard when={dirty}`.
- **RTL/LTR notes:** Times/dates LTR-isolated in summaries (joined with Arabic comma "، ").
- **Medical-safety notes:** Same boundary as add; deactivate stops dose generation (neutral, no health implication).
- **Figma design notes:** Two render modes (manager editable / read-only). The schedules manager (summary + numbered cards + per-card actions) is dense — give it clear hierarchy. Design schedule card active vs stopped. Dark-first.

### B.18 Schedule picker (add/edit schedule modal state)

- **Screen name:** Dose schedule (add/edit)
- **Route/file:** Modal — `src/features/medications/schedule-modal-host.tsx` (`ScheduleModalHost` in a `FormModal`) wrapping `ScheduleFields`. Managers only.
- **Purpose:** Add or edit one dose schedule (weekdays + times + date range + notes) without leaving the medication.
- **Primary user job:** Set which days and times a dose occurs.
- **Data shown:** `WeekdaySelector` (`medications.fields.days` "أيام الأسبوع"; short chips أحد/إثنين/…; "كل الأيام" select-all); Times list (`TimeField` rows + add `medications.addTimeToSchedule`; live duplicate indicator); Start/End `DateField`s (end clearable); Notes multiline.
- **Primary CTA:** Add → `medications.addScheduleSubmit` "إضافة جدول جرعات"; Edit → `medications.saveScheduleChanges`. `submitDisabled = !dirty || hasDuplicateTimes`.
- **Secondary actions:** `common.cancel`; close button.
- **Loading state:** Submit `ActivityIndicator` while pending.
- **Error state:** Field codes → `medications.errors.{timeFormat|timesRequired|daysRequired|dateFormat|endBeforeStart|duplicateTime|conflict}`. Conflict (same weekday+time in another active schedule) → `medications.errors.conflict` "{{day}} الساعة {{time}} موجود بالفعل في جدول نشط آخر." Duplicate rows show an errorFg box.
- **Accessibility notes:** Weekday chips `accessibilityRole="checkbox"` + checked + full-name label + `Glyph.check` when selected; times rows labeled by index. **No backdrop-tap dismiss** (explicit close/cancel); dirty close → `confirmDiscard`.
- **RTL/LTR notes:** Times in `TimeField` are 24h `HH:MM`; pickers are wheels.
- **Medical-safety notes:** Pure scheduling; conflict guard is to avoid double-counting a dose, not a health rule.
- **Figma design notes:** Bottom-sheet modal hosting the schedule editor. Show the weekday multi-select (selected = tint + border + check + bold, never color-only), the dynamic times list with remove + add, the duplicate/conflict error states, and the date range. Dark-first.

### B.19 Tasks center

- **Screen name:** Tasks center
- **Route/file:** `/tasks` — `src/app/(app)/tasks/index.tsx` → `src/features/tasks/tasks-center.tsx`.
- **Purpose:** Shared care-task hub for the circle.
- **Primary user job:** See what's due today, then complete/cancel or open details.
- **Data shown:** Disclaimer + `ReminderNotice`. Three sections: `tasks.todayTitle` "مهام اليوم", `tasks.openTitle` "المهام المفتوحة", `tasks.doneTitle` "منجزة وملغاة" (only if any). Each `TaskRow`: title, priority badge if high/urgent, category line, due chip (accent, LTR), assignment line (`assignedToMe`/`unassigned`/`assignedToMember`), status badge if not open.
- **Primary CTA:** `tasks.add` "إضافة مهمة" (managers only) → `/tasks/new`.
- **Secondary actions:** `common.details` → `/tasks/:id`. When `canActOn`: `tasks.complete` "إنجاز" (primary) + `tasks.cancelTask` "إلغاء" (secondary) — immediate, no confirm.
- **Destructive actions:** None inline (cancel = status change; delete on detail).
- **Empty state:** Today → `EmptyState` task icon `tasks.noTodayTitle` "لا مهام لهذا اليوم". Open → `noOpenTitle`, subtitle `noOpenSubtitle` (managers only).
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `tasks.loadError` "تعذّر تحميل المهام" + retry. Per-row pending disables Complete/Cancel.
- **Accessibility notes:** Due chip LTR; status badge shape+label; `canActOn` = open AND (manage OR (collaborate AND unassigned/assigned-to-me)).
- **RTL/LTR notes:** Due `date + HH:MM` LTR-isolated; RTL layout.
- **Medical-safety notes:** Disclaimer "…دون أي نصيحة طبية." Coordination only. "urgent" is task urgency, not a medical alert.
- **Figma design notes:** Three-section list with a clear "today" emphasis. Design row variants: open, with-priority, assigned-to-me, completed, cancelled. Inline complete/cancel actions. Dark-first.

### B.20 Add task

- **Screen name:** Add task
- **Route/file:** `/tasks/new` — `src/app/(app)/tasks/new.tsx` → `src/features/tasks/task-form.tsx`. Managers only (else `tasks.managersOnly`).
- **Purpose:** Create a care task (only `title` required).
- **Primary user job:** Enter a task and optional due/assignment.
- **Data shown:** Disclaimer. Fields: Title (required, "مثال: شراء الدواء"), Description (multiline), Category (`OptionSelect`, default general), Priority (`OptionSelect`, default normal), Due date (`DateField`, clearable), Due time (`TimeField`, clearable), Assign-to-me `Switch`, Notes (multiline).
- **Primary CTA:** `StickyFormActions` save `tasks.add` "إضافة مهمة"; `disabled={!dirty}`.
- **Loading state:** Save spinner.
- **Error state:** `tasks.errors.{title|dueDate|dueTime|dueTimeNeedsDate}` (e.g. "حدّد تاريخ الاستحقاق أولاً"); submit failure `tasks.saveFailed` "تعذّر الحفظ. حاول مرة أخرى."
- **Accessibility notes:** `UnsavedChangesGuard when={dirty && !submitted}`; Switch labeled; OptionSelect chips radio.
- **RTL/LTR notes:** Date/time via wheel pickers; RTL.
- **Medical-safety notes:** Coordination only.
- **Figma design notes:** Single-column form with two `OptionSelect` segmented groups (category, priority) and a date/time pair. Dark-first.

### B.21 Task detail / editor

- **Screen name:** Task detail
- **Route/file:** `/tasks/:id` — `src/app/(app)/tasks/[id].tsx` → `src/features/tasks/task-editor.tsx`.
- **Purpose:** View a task; managers edit; change status; managers delete.
- **Primary user job:** Update the task or change its status.
- **Data shown:** Manager → `TaskFields` (same as create). Non-manager → `ReadOnlyTask` (info banner `tasks.readOnly` + info rows). Status section: `StatusBadge` (open=info/clock, completed=success/check, cancelled=error/cross) + completed-at / cancelled-at timestamps.
- **Primary CTA:** Inline `FormActions` save `common.saveChanges` (managers). Status: `tasks.complete` + `tasks.cancelTask` when `canAct`.
- **Secondary actions:** None beyond status + edit.
- **Destructive actions:** `DeleteTaskRow` `tasks.deleteTask` "حذف المهمة" → inline confirm. NOTE: there is **no reopen for tasks** (update patch excludes status) — once completed/cancelled, no in-UI path back to open.
- **Empty state:** Not found → `EmptyState` task icon `tasks.notFound` "لم يتم العثور على المهمة".
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `tasks.loadError` + retry. Save `tasks.saved` / `saveFailed`.
- **Accessibility notes:** Timestamps LTR; status never color-only; complete/cancel immediate (no confirm).
- **RTL/LTR notes:** `completedAt`/`cancelledAt` LTR.
- **Medical-safety notes:** Neutral status wording.
- **Figma design notes:** Editable + read-only variants; status section with badge + timestamps + actions. Design completed and cancelled terminal states (no reopen). Dark-first.

### B.22 Appointments center

- **Screen name:** Appointments center
- **Route/file:** `/appointments` — `src/app/(app)/appointments/index.tsx` → `src/features/appointments/appointments-center.tsx`.
- **Purpose:** See today's + upcoming appointments and (managers) mark done/cancelled.
- **Primary user job:** Track upcoming appointments.
- **Data shown:** Disclaimer + `ReminderNotice`. Two sections: `appointments.todayTitle` "مواعيد اليوم", `upcomingTitle` "المواعيد القادمة". Each `AppointmentCard`: title, status badge if not scheduled, accent "when" chip (date + start, `– end` if present, LTR 18px bold), type line, location, doctor name (from `useDoctors`).
- **Primary CTA:** `appointments.add` "إضافة موعد" (managers only) → `/appointments/new`.
- **Secondary actions:** `common.details` → `/appointments/:id`. Managers + scheduled: `appointments.markCompleted` "تمّ" + `markCancelled` "إلغاء" (immediate). Collaborators get NO inline status actions (manager-only).
- **Destructive actions:** None inline (delete on detail).
- **Empty state:** Today → `noTodayTitle` "لا مواعيد اليوم". Upcoming → `noUpcomingTitle`, subtitle (managers only).
- **Loading state:** `LoadingState` (doctors query best-effort, defaults to []).
- **Error state:** `ErrorState` `appointments.loadError` "تعذّر تحميل المواعيد" + retry.
- **Accessibility notes:** "When" LTR-isolated; status badge shape+label.
- **RTL/LTR notes:** Date/time range LTR; past appointments excluded from center (today-onward).
- **Medical-safety notes:** Coordination only; no end-date (same-day assumption).
- **Figma design notes:** Today + upcoming list; prominent "when" anchor per card. Design scheduled / completed / cancelled card variants. Dark-first.

### B.23 Add appointment

- **Screen name:** Add appointment
- **Route/file:** `/appointments/new` — `src/app/(app)/appointments/new.tsx` → `src/features/appointments/appointment-form.tsx` (shared `AppointmentFieldset`). Managers only (else `appointments.managersOnly`).
- **Purpose:** Schedule a new appointment.
- **Primary user job:** Set title + date + start time (required); optionally end/location/doctor/notes.
- **Data shown:** Disclaimer. Fields: Title (required, "مثال: مراجعة طبيب القلب"), Type (`OptionSelect`), Date (required), Start time (required), End time (clearable, "اختياري — HH:MM"), Location ("مثال: مستشفى الملك فهد"), Doctor (`OptionSelect`, only if doctors exist; first option `appointments.noDoctor` "بدون طبيب"), Notes.
- **Primary CTA:** `StickyFormActions` save `appointments.add` "إضافة موعد"; `disabled={!dirty}`.
- **Loading state:** Save spinner.
- **Error state:** `appointments.errors.{title|date|startTime|endTime|endBeforeStart}` "تاريخ/وقت…"; submit failure `appointments.saveFailed`.
- **Accessibility notes:** `UnsavedChangesGuard`; date/time wheels.
- **RTL/LTR notes:** Date/time `YYYY-MM-DD` / `HH:MM`.
- **Medical-safety notes:** Coordination only.
- **Figma design notes:** Form with a date + start/end time triad and an optional doctor selector. Dark-first.

### B.24 Appointment detail / editor

- **Screen name:** Appointment detail
- **Route/file:** `/appointments/:id` — `src/app/(app)/appointments/[id].tsx` → `src/features/appointments/appointment-editor.tsx`.
- **Purpose:** View; managers edit, change status (incl. reopen), delete.
- **Primary user job:** Update or change status.
- **Data shown:** Manager → `AppointmentEditFields`. Non-manager → `ReadOnlyAppointment` (sunken banner + info rows; `appointments.whenLabel` "الموعد"). Status section: badge (scheduled/info, completed/success, cancelled/error).
- **Primary CTA:** Inline `FormActions` save `common.saveChanges`. Status (managers only): scheduled → `markCompleted` + `markCancelled`; else single `appointments.reopen` "إعادة كمجدول".
- **Destructive actions:** `DeleteAppointmentRow` `appointments.deleteAppointment` "حذف الموعد" → inline confirm.
- **Empty state:** Not found → `EmptyState` appointment icon `appointments.notFound`.
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `appointments.loadError` + retry. Save `appointments.saved` / `saveFailed`.
- **Accessibility notes:** Status buttons managers-only; no confirm on status changes; reopen exists (unlike tasks).
- **RTL/LTR notes:** "When" LTR-isolated.
- **Medical-safety notes:** Neutral status.
- **Figma design notes:** Editable + read-only variants; status section with reopen. Dark-first.

### B.25 Visits center

- **Screen name:** Visits center
- **Route/file:** `/visits` — `src/app/(app)/visits/index.tsx` → `src/features/visits/visits-center.tsx`.
- **Purpose:** Coordinate family visits — today / upcoming / recent.
- **Primary user job:** See and act on planned visits.
- **Data shown:** Disclaimer. Three sections: Today, Upcoming, Recent (cap 10). Each `VisitCard`: visitor name, status badge if not planned, accent "when" chip (date + start–end, LTR), `visits.mineLabel` "زيارتك" if linked to the user.
- **Primary CTA:** `visits.add` "إضافة زيارة" (canAdd) → `/visits/new`.
- **Secondary actions:** `common.details` → `/visits/:id`. When `canActOn` (planned + manage|own): `visits.markCompleted` "تمّت" + `markCancelled` "إلغاء" (status, no confirm).
- **Destructive actions:** None inline (delete on detail).
- **Empty state:** Today → `noTodayTitle` "لا زيارات اليوم"; Upcoming → `noUpcomingTitle`, subtitle (canAdd).
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `visits.loadError` "تعذّر تحميل الزيارات" + retry.
- **Accessibility notes:** Status badge shape+label; per-row pending disables actions.
- **RTL/LTR notes:** "When" LTR-isolated.
- **Medical-safety notes:** Disclaimer "…دون أي نصيحة طبية." Coordination only.
- **Figma design notes:** Three-section visit list (status-like, overlaps Appointments conceptually — flagged as a future "Schedule" merge candidate). Dark-first.

### B.26 Add visit

- **Screen name:** Add visit
- **Route/file:** `/visits/new` — `src/app/(app)/visits/new.tsx` → `src/features/visits/visit-form.tsx`. Active members only (else `visits.cannotAdd`).
- **Purpose:** Record a planned family visit.
- **Primary user job:** Enter visitor + date (+ optional times/notes).
- **Data shown:** Disclaimer. Fields: Visitor name (required, "مثال: أحمد"), Visit date (required), Start time (clearable), End time (clearable), Notes. Account-link: managers see a `Switch` `visits.fields.linkToMe` "ربط الزيارة بحسابي"; collaborators get a static note `visits.ownVisitNote` and are forced to self.
- **Primary CTA:** `StickyFormActions` save `visits.add` "إضافة زيارة"; `disabled={!dirty}`.
- **Error state:** `visits.errors.{visitorName|visitDate|startTime|endBeforeStart}`; submit failure `visits.saveFailed`.
- **Accessibility notes:** Switch labeled; `UnsavedChangesGuard`.
- **RTL/LTR notes:** Times/dates pickers.
- **Medical-safety notes:** Coordination only; status defaults planned (not in schema).
- **Figma design notes:** Form with a date + start/end time pair and a role-aware account-link control. Dark-first.

### B.27 Visit detail / editor

- **Screen name:** Visit detail
- **Route/file:** `/visits/:id` — `src/app/(app)/visits/[id].tsx` → `src/features/visits/visit-editor.tsx`.
- **Purpose:** View; edit/status/delete if permitted (manager or own visit).
- **Primary user job:** Update or change status.
- **Data shown:** Editable `VisitEditFields` or `ReadOnlyVisit` (sunken banner + when + notes). Status section: badge (planned/info/clock, completed/success/check, cancelled/error/cross).
- **Primary CTA:** `FormActions` save `common.saveChanges`. Status: planned → `markCompleted`/`markCancelled`; else `visits.reopen` "إعادة كمخطّطة".
- **Destructive actions:** `DeleteVisitRow` `visits.deleteVisit` "حذف الزيارة" → inline confirm.
- **Empty state:** Not found → `EmptyState` visit icon `visits.notFound`.
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `visits.loadError` + retry. Save `visits.saved`/`saveFailed`.
- **Accessibility notes:** `visitor_user_id` preserved on edit (RLS); status reopen present.
- **RTL/LTR notes:** "When" LTR.
- **Medical-safety notes:** Neutral.
- **Figma design notes:** Editable + read-only + status (with reopen). Dark-first.

### B.28 Daily logs center

- **Screen name:** Daily logs center
- **Route/file:** `/daily-logs` — `src/app/(app)/daily-logs/index.tsx` → `src/features/daily-logs/daily-logs-center.tsx`.
- **Purpose:** Record/review the family's daily condition observations.
- **Primary user job:** See today's logs; open or add.
- **Data shown:** Disclaimer. Two sections: Today, Recent. Each `LogRow`: `Glyph.dailyLog` chip, `log_date` (LTR), `dailyLogs.mineLabel` "سجلك" if authored, a structured summary line (mood/sleep/appetite/hydration/pain/mobility via `describeDailyLog`, joined by bullet, or `dailyLogs.notesOnly` "ملاحظات فقط"), note count `dailyLogs.noteCount` "ملاحظات: {{count}}".
- **Primary CTA:** `dailyLogs.add` "إضافة سجل" (canAdd) → `/daily-logs/new`.
- **Secondary actions:** Tap a row → `/daily-logs/:id`.
- **Destructive actions:** None here.
- **Empty state:** Today → `EmptyState` dailyLog icon `noTodayTitle` "لا سجلات لهذا اليوم", subtitle (canAdd).
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `dailyLogs.loadError` "تعذّر تحميل السجلات" + retry.
- **Accessibility notes:** `LogRow` `accessibilityLabel = log_date` only (summary not in label); chevron decorative.
- **RTL/LTR notes:** Date LTR; summary RTL with bullets.
- **Medical-safety notes:** Disclaimer "…وليست تشخيصًا أو نصيحة طبية." Observations are self-described states, never medical assessments.
- **Figma design notes:** Stream-like list (flagged as a future activity-stream candidate). Design the structured-summary row + notes-only row. Dark-first.

### B.29 Add daily log

- **Screen name:** Add daily log
- **Route/file:** `/daily-logs/new` — `src/app/(app)/daily-logs/new.tsx` → `src/features/daily-logs/log-form.tsx`. Active members only (else `dailyLogs.cannotAdd`).
- **Purpose:** Capture one day's structured observations + notes.
- **Primary user job:** Record mood/sleep/appetite/hydration/pain/mobility + free-text notes for a date.
- **Data shown:** Disclaimer. Fields: Date (required, default today), Mood (`OptionSelect`, "Not set" + 8 moods), Sleep quality, Appetite, Hydration, Pain level (stepper: `dailyLogs.painNone` "بدون" + 0–10), Mobility, plus four multiline note fields (bathroom/food/activity/general).
- **Primary CTA:** `StickyFormActions` save `dailyLogs.add` "إضافة سجل"; `disabled={!dirty}`.
- **Loading state:** Save spinner.
- **Error state:** `dailyLogs.errors.logDate` "اختر تاريخًا صحيحًا"; unique-violation 23505 → `dailyLogs.errors.alreadyLoggedToday` "لديك سجل لهذا التاريخ بالفعل. عدّل السجل الموجود…"; else `dailyLogs.saveFailed`.
- **Accessibility notes:** OptionSelect chips radio; pain stepper buttons (selected = primary); `UnsavedChangesGuard`.
- **RTL/LTR notes:** Date picker; RTL chips.
- **Medical-safety notes:** Enumerated values are observational (مزاج/مزاج, مقبول, etc.) — NEVER "normal/abnormal" medical labels; "طبيعية/عادية" appear only as self-described states. Pain is a recorded number, not interpreted.
- **Figma design notes:** Several `OptionSelect` groups + a 0–10 pain stepper + multiline notes. Keep it scannable (group structured observations vs notes). Design the "already logged today" error path. Dark-first.

### B.30 Daily log detail / editor

- **Screen name:** Daily log detail
- **Route/file:** `/daily-logs/:id` — `src/app/(app)/daily-logs/[id].tsx` → `src/features/daily-logs/log-editor.tsx`.
- **Purpose:** View; edit/delete if permitted (manager or own log).
- **Primary user job:** Update or delete the log.
- **Data shown:** Editable `DailyLogEditFields` or `ReadOnlyLog` (sunken banner + log_date + structured/notes info rows; `notesOnly` if empty). No status section (logs have no status).
- **Primary CTA:** `FormActions` save `common.saveChanges`.
- **Destructive actions:** `DeleteLogRow` `dailyLogs.deleteLog` "حذف السجل" → inline confirm.
- **Empty state:** Not found → `EmptyState` `dailyLogs.notFound` (no icon).
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `dailyLogs.loadError` + retry. Save `dailyLogs.saved`/`saveFailed`.
- **Accessibility notes:** `log_date` editable here.
- **RTL/LTR notes:** Date LTR.
- **Medical-safety notes:** Observational only.
- **Figma design notes:** Editable + read-only variants. Dark-first.

### B.31 Vitals center

- **Screen name:** Vitals center
- **Route/file:** `/vitals` — `src/app/(app)/vitals/index.tsx` → `src/features/vitals/vitals-center.tsx`.
- **Purpose:** See today's + recent readings; add a reading. **Strictly non-diagnostic.**
- **Primary user job:** Record/review readings as value + unit + timestamp.
- **Data shown:** Disclaimer (strongest). Two sections: `vitals.todayTitle` "قياسات اليوم", `recentTitle` "قياسات سابقة". Each `VitalRow`: `Glyph.vital` chip, reading type label, formatted value (`formatVitalValue` — value + unit only), timestamp (LTR-isolated `ymd hm`), `vitals.mineLabel` "قياسك" if authored, optional notes, chevron.
- **Primary CTA:** `vitals.add` "إضافة قياس" (canAdd) → `/vitals/new`.
- **Secondary actions:** Tap a row → `/vitals/:id`.
- **Destructive actions:** None here.
- **Empty state:** Today empty → `EmptyState` vital icon `noTodayTitle` "لا قياسات اليوم", subtitle (canAdd).
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `vitals.loadError` "تعذّر تحميل القياسات" + retry.
- **Accessibility notes:** Row `accessibilityLabel` = reading type; timestamp LTR.
- **RTL/LTR notes:** Value + unit + timestamp LTR-isolated.
- **Medical-safety notes:** **Most explicit non-interpretation:** `vitals.disclaimer` "…وليست تشخيصًا أو نصيحة طبية، ولا يُفسّر التطبيق القيم." NO normal/abnormal, NO color-by-health, NO thresholds, NO trend/sparkline (the brief's optional "neutral trend" is NOT implemented — do not add one). Readings are discrete value + unit + time only.
- **Figma design notes:** **Important medical-safety frame.** Reading rows must look neutral and factual — value + unit + timestamp, no green/red "good/bad" coloring, no ranges, no trend arrows. Use the brand/neutral palette only. Dark-first.

### B.32 Add vital

- **Screen name:** Add vital reading
- **Route/file:** `/vitals/new` — `src/app/(app)/vitals/new.tsx` → `src/features/vitals/vital-form.tsx`. Active members only (else `vitals.cannotAdd`).
- **Purpose:** Record one reading.
- **Primary user job:** Pick type, enter value(s) + unit + time.
- **Data shown:** Disclaimer. `VitalFieldset`: Type `OptionSelect` (blood_pressure/heart_rate/temperature/blood_sugar/oxygen_saturation/weight/other); `DateTimeField` reading time; conditional value inputs (BP → systolic "الانقباضي" + diastolic "الانبساطي"; else single value "القيمة"); Unit (editable suggestion from `DEFAULT_UNITS`); Notes.
- **Primary CTA:** `StickyFormActions` save `vitals.add` "إضافة قياس"; `disabled={!dirty}`.
- **Error state:** `vitals.errors.{date|time|systolic|diastolic|value}` (e.g. "أدخل قيمة انقباضي صحيحة"); submit failure `vitals.saveFailed`.
- **Accessibility notes:** `UnsavedChangesGuard`; number pads for values; unit is a free suggestion.
- **RTL/LTR notes:** Numeric inputs Latin; unit e.g. "mmHg".
- **Medical-safety notes:** Schema validates only positivity + int bounds; "other" allows notes-only. App never validates/interprets the value. `other` value optional.
- **Figma design notes:** Conditional layout (BP shows two inputs side-by-side; others show one). Unit prefilled but editable. No interpretation UI. Dark-first.

### B.33 Vital detail / editor

- **Screen name:** Vital detail
- **Route/file:** `/vitals/:id` — `src/app/(app)/vitals/[id].tsx` → `src/features/vitals/vital-editor.tsx`.
- **Purpose:** View one reading; edit/delete if permitted (manager or own).
- **Primary user job:** Correct or delete a reading.
- **Data shown:** Editable `VitalEditFields` or `ReadOnlyVital` (sunken banner + reading type subtitle + info rows: readingAt LTR, value, notes).
- **Primary CTA:** `FormActions` save `common.saveChanges`.
- **Destructive actions:** `DeleteVitalRow` `vitals.deleteReading` "حذف القياس" → inline confirm.
- **Empty state:** Not found → `EmptyState` `vitals.notFound` "لم يتم العثور على القياس".
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `vitals.loadError` + retry. Save `vitals.saved`/`saveFailed`.
- **Accessibility notes:** readingAt LTR.
- **RTL/LTR notes:** Value + unit + time LTR.
- **Medical-safety notes:** Same non-interpretation boundary.
- **Figma design notes:** Editable + read-only variants; no interpretation. Dark-first.

### B.34 Notifications center

- **Screen name:** Notifications center
- **Route/file:** `/notifications` — `src/app/(app)/notifications.tsx` → `src/features/notifications/notifications-center.tsx`.
- **Purpose:** Recent-first cross-circle inbox; open the relevant item (deep-links) and clear unread.
- **Primary user job:** Scan recent notifications, open them, mark read.
- **Data shown:** Per `NotificationRow`: type chip (per-type glyph + tone), title, body, meta line (type label `notifications.types.*` + circle name + LTR timestamp, separated by middot). Unread = bordered card + leading dot + bolder title; read = sunken, unbordered. Optional enable-prompt banner; per-circle filter chips (only if >1 circle); "Load more".
- **Primary CTA:** Tap a row → marks read (if unread) + deep-links via `useOpenNotification`. Global `notifications.markAllRead` "تحديد الكل كمقروء" (shown only when unread exist).
- **Secondary actions:** Per-row read toggle `notifications.markRead` "تحديد كمقروء" / `markUnread`; filter chips (`filters.all` "كل الدوائر" + per circle); enable-prompt `notifications.enableAction` → `/notification-settings`; `notifications.loadMore` "تحميل المزيد".
- **Destructive actions:** None (read/unread reversible; no delete).
- **Empty state:** `EmptyState` icon `Glyph.system`, title `notifications.emptyTitle` "لا توجد إشعارات", subtitle `emptySubtitle` "ستظهر هنا التذكيرات والتحديثات."
- **Loading state:** `LoadingState`.
- **Error state:** `ErrorState` `notifications.loadError` "تعذّر تحميل الإشعارات" + retry. Pull-to-refresh via `RefreshControl`.
- **Accessibility notes:** Rows `accessibilityRole="button"`; unread dot hidden; filter chips `accessibilityState.selected`; mark-all loading.
- **RTL/LTR notes:** Timestamp `YYYY-MM-DD HH:MM` LTR-isolated; header right-aligns mark-all.
- **Medical-safety notes:** Type labels are neutral; deep-link safety: if the user left a circle, routes to the inbox instead of exposing it.
- **Figma design notes:** **Priority module.** Strong unread/read visual distinction (border + dot + weight, never color-only). Filter chips, mark-all, load-more, empty, and the enable-prompt banner. Design unread row, read row, and the emergency-type row. Dark-first.

### B.35 Notification settings

- **Screen name:** Notification settings
- **Route/file:** `/notification-settings` — `src/app/(app)/notification-settings.tsx` → `src/features/notifications/notification-settings.tsx`.
- **Purpose:** Push enable/status, per-type preferences, quiet hours, timezone display, a safe local self-test.
- **Primary user job:** Decide which reminders this account receives, set quiet hours, confirm the device can show a notification.
- **Data shown:** `PushStatusCard` (explain title/body/privacy + a single Enable/Disable control; honest web/no-device/denied states). Scope selector (global vs per-circle). 8 toggles (medication/missed-dose/task/appointment/visit/care/emergency/remote-summary) each label + description, all default ON. Quiet hours (master toggle + start/end `TimeField`s + the cross-midnight note). Timezone (display-only). Save. Local test section.
- **Primary CTA:** `notificationSettings.save` "حفظ الإعدادات".
- **Secondary actions:** `PushStatusCard` enable/disable; scope chips; `test.action` "إرسال إشعار تجريبي" (local-only).
- **Destructive actions:** None (disable push is recoverable).
- **Loading state:** Save / enable / disable show loading; test has no spinner.
- **Error state:** Quiet-hours invalid → `quietHours.invalid`; save failure `saveError` "تعذّر حفظ الإعدادات. حاول مرة أخرى."; saved confirmation `notificationSettings.saved`. Push results mapped to `push.results.{denied|unsupported|no-device|project-id-missing|error}` (user-friendly, never raw diagnostics).
- **Accessibility notes:** Toggles `Switch` with `accessibilityLabel`; status/results live region; scope chips `accessibilityState.selected`; timezone via `LtrText`.
- **RTL/LTR notes:** Timezone IDs + times LTR-isolated.
- **Medical-safety / honesty notes:** Copy is honest: local reminders are NOT guaranteed delivery; quiet-hours note warns emergency alerts may still arrive; test is clearly local-only ("يظهر على هذا الجهاز فقط ولا يُشعِر أي شخص آخر"); privacy line promises no token sharing / no health detail in notifications. Hide push-token/channel mechanics behind the user-friendly card (no raw token/permission enum/project id).
- **Figma design notes:** **Priority (forms) module.** Top status card (4 states: web-unsupported, no-device, enabled, default/enable), scope chips, a clean toggle list (label + description rows), quiet-hours reveal, timezone well, save, and the local-test section. Conservative defaults visible. Dark-first.

### B.36 Account / profile / settings

- **Screen name:** Account
- **Route/file:** `/account` — `src/app/(app)/(tabs)/account.tsx`.
- **Purpose:** Account hub — identity, switch/link circles, notification links, sign out.
- **Primary user job:** See who's signed in, manage circles, reach settings, sign out.
- **Data shown:** Header `account.title` "الحساب" + `NotificationBell`. Identity surface: `account.signedInAs` + email via `LtrText selectable` (or `noEmail`). Care circles section: `CircleSwitcher`, a `LinkRow` to circle members, `CircleTimezoneCard` (where the circle timezone is actually editable). Notifications section: `LinkRow`s to notification settings and `account.joinAnother` "الانضمام إلى دائرة أخرى" → `/join-circle`.
- **Primary CTA:** None primary; the screen is navigational.
- **Secondary actions:** Each `LinkRow` (members, notification settings, join another), circle switcher.
- **Destructive actions:** `account.signOut` "تسجيل الخروج" (danger) — **no confirmation** (recoverable); best-effort push-token deactivation, then `signOut`; on error `account.signOutError`.
- **Empty state:** N/A.
- **Loading state:** Sign-out button loading/disabled.
- **Error state:** Sign-out error (errorFg, alert, polite) above the button.
- **Accessibility notes:** Header `accessibilityRole="header"`; `LinkRow` `accessibilityRole="button"` + label + hint; email LTR + selectable; chevron decorative.
- **RTL/LTR notes:** Email LTR-isolated; RTL rows.
- **Medical-safety notes:** N/A.
- **Figma design notes:** Calm settings hub of grouped link rows + identity surface + a danger sign-out at the bottom. No name/avatar/password editing, no theme/language toggle (out of scope — do NOT design those). Dark-first.

### B.37 Explore (dev tab) — see B.5

Covered in B.5. Mark as dev-only; low Figma priority.

### B.38 No-active-circle gate (shared state)

- **Screen name:** No active circle (CircleGate empty)
- **Route/file:** `src/features/care-circle/circle-gate.tsx` — wraps care-detail screens.
- **Purpose:** Fallback when a care-detail screen loads with no active circle.
- **Data shown:** `Screen scroll={false} center` with `EmptyState` icon `Glyph.members`, title `careCircle.noActiveCircle` "لا توجد دائرة رعاية نشطة".
- **Loading state:** `LoadingState` while resolving.
- **Error state:** `ErrorState` `careCircle.loadError` + retry.
- **Figma design notes:** One shared empty/loading/error frame reused across all care-detail screens (consistency). Dark-first.

---

## C. Full interaction inventory

Roles referenced: **Manager** = admin or primary_caregiver; **Collaborator** = `canLogDoses` (family_member/caregiver). Confirmation column = whether the action requires an extra confirm step. All inline confirms are two-step (no native `Alert.alert`) except where noted. Status changes apply immediately with no confirm. "(R)" = the standard `accessibilityRole`.

| # | Action | Arabic label | English label | Expected result | Disabled / loading / error | Confirmation | A11y role / label guidance |
|---|---|---|---|---|---|---|---|
| 1 | Sign in | تسجيل الدخول | Sign in | Authenticates; auth guard redirects to `/` | Disabled+spinner while submitting; inline alert on bad creds (`signInFailed`) | None | button (R); label = "تسجيل الدخول" |
| 2 | Create account | إنشاء حساب | Create account | Creates account; redirect or "check email" notice | Spinner; alert `signUpFailed`; notice `signUpCheckEmail` | None | button (R) |
| 3 | Create care circle | إنشاء دائرة الرعاية | Create care circle | Creates first circle; Home swaps to dashboard | Both buttons disabled while pending; field errors (alert+polite) | None | button (R); header on title |
| 4 | Join with code | الانضمام برمز دعوة / انضمام | Join with code / Join circle | Joins circle, sets it preferred active → `/` | Spinner; inline error (`invalid`/`expired`/`used`…) | None | button (R) |
| 5 | Switch active circle | تبديل / اختر دائرة الرعاية | Switch / Choose circle | Sets active circle, invalidates circle-scoped cache | Disabled when only 1 circle | None | button (R) on switch; rows `accessibilityState.selected` |
| 6 | Open notifications | الإشعارات / فتح الإشعارات | Open notifications | Navigates `/notifications` | — | None | button (R); label `openCenterWithCount` "{{count}} غير مقروءة" or `openCenter` |
| 7 | Mark dose given | أُعطيت | Given | Records/updates dose log status=given | All 3 buttons disabled while pending; no error toast on failure | None (reversible by re-tap) | button (R) in `STATUS_ORDER`; given button = primary |
| 8 | Mark dose postponed | مؤجَّلة | Postponed | Records status=postponed | Same pending lockout | None | button (R); clock glyph |
| 9 | Mark dose missed | لم تُعطَ | Missed | Records status=missed (neutral "not given") | Same | None | button (R); cross glyph |
| 10 | Add medication | إضافة دواء | Add medication | Opens `/medications/new` (managers) | Hidden for non-managers | None | button (R) |
| 11 | Save medication | حفظ الدواء / حفظ التغييرات | Save / Save changes | Creates med+schedule or updates med | Disabled `!dirty \|\| hasDuplicateTimes`; spinner; `saveFailed` | None | button (R); status line alert+polite |
| 12 | Add/edit schedule | إضافة جدول جرعات / حفظ تغييرات جدول الجرعات | Add/Save schedule | Adds/updates a schedule | `submitDisabled = !dirty \|\| hasDuplicateTimes`; spinner; conflict/duplicate errors | Dirty-close → confirmDiscard | button (R); modal title header |
| 13 | Pick weekday(s) | (أحد/إثنين/…) / كل الأيام | weekdays / Every day | Toggles day in schedule | — | None | checkbox (R) + checked; full day name as label |
| 14 | Pick a time | اختر الوقت | Set time | Opens wheel `HH:MM` picker; commits on Done | Commit only on Done; backdrop=cancel | None | button (R) on trigger; chevron hidden |
| 15 | Pick a date | اختر التاريخ | Set date | Opens wheel Y/M/D picker; commits on Done | Same | None | button (R) |
| 16 | Toggle medication active | إيقاف / إعادة تفعيل | Deactivate / Reactivate | Stops/starts dose generation | Local pending disables+loads | None | button (R) |
| 17 | Delete medication | حذف الدواء → تأكيد الحذف | Delete medication → Confirm delete | Deletes med → back | Inline confirm; loading on confirm | Two-step inline | button (R); confirm = danger |
| 18 | Add task | إضافة مهمة | Add task | Opens `/tasks/new` (managers) | Hidden non-managers | None | button (R) |
| 19 | Complete task | إنجاز | Complete | Sets status=completed (+timestamp) | Per-row pending disables both | None (immediate) | button (R); primary; check glyph |
| 20 | Cancel task | إلغاء | Cancel | Sets status=cancelled (+timestamp) | Same | None | button (R); cross glyph |
| 21 | Save task | حفظ المهمة / حفظ التغييرات | Save | Creates/updates task | Disabled `!dirty`; spinner; `saveFailed` | None | button (R) |
| 22 | Delete task | حذف المهمة → تأكيد الحذف | Delete task → Confirm | Deletes task → back | Inline confirm; loading | Two-step inline | button (R); danger |
| 23 | Add appointment | إضافة موعد | Add appointment | Opens `/appointments/new` (managers) | Hidden non-managers | None | button (R) |
| 24 | Mark appointment done | تمّ | Done | status=completed (managers) | Per-card pending disables | None | button (R); check |
| 25 | Cancel appointment | إلغاء | Cancel | status=cancelled (managers) | Same | None | button (R); cross |
| 26 | Reopen appointment | إعادة كمجدول | Mark as scheduled | status=scheduled (managers) | Pending disables | None | button (R); clock |
| 27 | Delete appointment | حذف الموعد → تأكيد الحذف | Delete → Confirm | Deletes → back | Inline confirm; loading | Two-step inline | button (R); danger |
| 28 | Add visit | إضافة زيارة | Add visit | Opens `/visits/new` (active members) | Hidden if cannot add | None | button (R) |
| 29 | Mark visit done | تمّت | Done | status=completed | Per-card pending | None | button (R); check |
| 30 | Cancel visit | إلغاء | Cancel | status=cancelled | Same | None | button (R); cross |
| 31 | Reopen visit | إعادة كمخطّطة | Mark as planned | status=planned | Pending | None | button (R); clock |
| 32 | Delete visit | حذف الزيارة → تأكيد الحذف | Delete → Confirm | Deletes → back | Inline confirm; loading | Two-step inline | button (R); danger |
| 33 | Add daily log | إضافة سجل | Add log | Opens `/daily-logs/new` | Hidden if cannot add | None | button (R) |
| 34 | Save daily log | حفظ السجل / حفظ التغييرات | Save | Creates/updates log | Disabled `!dirty`; `alreadyLoggedToday` (23505) error | None | button (R) |
| 35 | Delete daily log | حذف السجل → تأكيد الحذف | Delete → Confirm | Deletes → back | Inline confirm | Two-step inline | button (R); danger |
| 36 | Add vital | إضافة قياس | Add reading | Opens `/vitals/new` | Hidden if cannot add | None | button (R) |
| 37 | Save vital | حفظ القياس / حفظ التغييرات | Save | Creates/updates reading | Disabled `!dirty`; value errors | None | button (R) |
| 38 | Delete vital | حذف القياس → تأكيد الحذف | Delete reading → Confirm | Deletes → back | Inline confirm | Two-step inline | button (R); danger |
| 39 | Call doctor / contact | اتصال {name} | Call {name} | Opens OS dialer (`tel:`); fails quietly on no-telephony | No loading/disabled; silent catch | None | button (R); label "اتصال {name}" (or phone) |
| 40 | Open emergency card | بطاقة الطوارئ | Emergency card | Navigates `/emergency-card` | — | None | button (R) |
| 41 | Add doctor | إضافة طبيب | Add doctor | Opens add modal (managers) | Hidden non-managers | None | button (R) |
| 42 | Add emergency contact | إضافة جهة اتصال | Add contact | Opens add modal (managers) | Hidden non-managers | None | button (R) |
| 43 | Edit doctor/contact | تعديل | Edit | Opens edit modal | Managers only | None | button (R) |
| 44 | Delete doctor/contact | حذف → تأكيد الحذف | Delete → Confirm | Deletes the row | Inline confirm; per-row loading | Two-step inline | button (R); danger |
| 45 | Save doctor/contact | إضافة … / حفظ التغييرات | Add / Save changes | Creates/updates | Disabled `!dirty`; `saveFailed` | Dirty-close → confirmDiscard | button (R) |
| 46 | Invite member | دعوة عضو | Invite member | Opens `/circle-members/invite` (managers) | Else `managersOnly` empty | None | button (R) |
| 47 | Create invitation | إنشاء دعوة | Create invitation | Generates single-use code → success card | Spinner; `createFailed` | None | button (R); header on success |
| 48 | Copy invite code | نسخ الرمز | Copy code | Copies code; feedback `copied` | Live-region feedback | None | button (R) |
| 49 | Share invite | مشاركة | Share | Opens share sheet; feedback `shared` | — | None | button (R) |
| 50 | Revoke invitation | إلغاء → تأكيد الإلغاء | Revoke → Confirm | Revokes pending invite | Inline confirm; loading; `revokeFailed` | Two-step inline | button (R); danger |
| 51 | Change member role | تغيير الدور | Change role | Opens role modal | Hidden when not assignable / last admin / owner | None | button (R) |
| 52 | Save role change | حفظ تغيير الدور → تأكيد التغيير | Save role change → Confirm change | Updates role after confirm step | Step1 disabled until changed; confirm loading; modal-local error | Two-step (pick→confirm) | button (R); radios `accessibilityState.selected` |
| 53 | Remove member | إزالة → تأكيد الإزالة | Remove → Confirm removal | Sets status=removed | Inline confirm; busy disables others | Two-step inline | button (R); danger |
| 54 | Make owner | تعيين كمالك → تأكيد النقل | Make owner → Confirm transfer | Transfers ownership | Inline confirm; loading | Two-step inline | button (R) |
| 55 | Reactivate member | إعادة تفعيل | Reactivate | status=active | Busy disables | None | button (R) |
| 56 | Leave circle | مغادرة الدائرة | Leave circle | Leaves circle → `/` | Busy disables; **fires immediately** | None (no confirm) | button (R); danger |
| 57 | Recipient profile save | حفظ التغييرات | Save changes | Updates recipient profile | Disabled `!dirty`; `saved`/`saveFailed`; unsaved guard | None | button (R) |
| 58 | Enable notifications | تفعيل الإشعارات | Enable notifications | Android: channel BEFORE permission, then token register | `loading=isWorking`; result line (`denied`/`no-device`/…) | None | button (R); results live-region |
| 59 | Disable notifications | إيقافها على هذا الجهاز | Turn off on this device | Deactivates device token | `loading`; success badge state | None | button (R) |
| 60 | Save notification settings | حفظ الإعدادات | Save settings | Upserts prefs (+ timezone) | `loading`; `quietHours.invalid`; `saved`/`saveError` | None | button (R); status alert+polite |
| 61 | Send test notification | إرسال إشعار تجريبي | Send a test notification | Schedules a LOCAL test (5s, this device only) | No spinner; `scheduled`/`failed` polite | None | button (R); honest "local only" copy nearby |
| 62 | Toggle a notification type | (per-toggle label) | (per-toggle) | Flips a preference (saved on Save) | — | None | Switch with `accessibilityLabel` |
| 63 | Toggle quiet hours | ساعات الهدوء | Quiet hours | Reveals start/end times | — | None | Switch labeled |
| 64 | Mark notification read | تحديد كمقروء | Mark read | Sets `read_at` | — | None | button (R) |
| 65 | Mark notification unread | تحديد كغير مقروء | Mark unread | Clears `read_at` | — | None | button (R) |
| 66 | Mark all read | تحديد الكل كمقروء | Mark all read | Marks all (respects filter) | Shown only if unread; `loading` | None | button (R) |
| 67 | Open a notification | (tap row) | (tap row) | Marks read + deep-links to target | Safe-routes to inbox if circle left | None | button (R); reads title/body/meta |
| 68 | Load more notifications | تحميل المزيد | Load more | Increases page size | Shown when `items ≥ limit` | None | button (R) |
| 69 | Filter notifications by circle | كل الدوائر / (circle) | All circles / (circle) | Filters inbox | Only if >1 circle | None | button (R); chips `accessibilityState.selected` |
| 70 | Open notification settings | إعدادات الإشعارات | Notification settings | Navigates `/notification-settings` | — | None | button (R) (LinkRow) |
| 71 | Navigate to a feature | (section title) | (section title) | Navigates to the feature center | — | None | button (R); label = "title. meta" |
| 72 | Sign out | تسجيل الخروج | Sign out | Deactivates token, signs out → auth | `loading`; error `signOutError` | None (recoverable) | button (R); danger |
| 73 | Save/cancel a form | حفظ … / إلغاء | Save / Cancel | Persists or discards | Save disabled `!dirty`; spinner | Cancel-with-edits → discard prompt | button (R); status alert+polite |
| 74 | Dismiss a modal / sheet | إغلاق / إلغاء | Close / Cancel | Closes the sheet | FormModal/TimezonePicker: NO backdrop dismiss; PickerSheet: backdrop=cancel | Dirty form → confirmDiscard | button (R); label `common.close` |
| 75 | Confirm leaving unsaved edits | تجاهل التغييرات / متابعة التعديل | Discard changes / Keep editing | Leaves or stays | — | This IS the confirmation | dialog buttons |

---

## D. Figma screen/frame set to request (prioritized)

Produce high-fidelity frames at the mobile target (Android-first, Samsung Galaxy S24 Ultra ~1440×3120, 19.5:9; responsive down to smaller Android phones). **Dark mode FIRST, then a light variant** for each. Respect safe areas + bottom tab bar + Android nav bar; keep primary actions within the one-handed thumb arc.

**PRIORITY SET (build these first):** Home (all four data variants), Medications (list + dose card + add/edit + schedule picker), Emergency card, Notifications center, and the Forms group (notification settings + a representative add/edit form). These carry the core promise and the highest medical-safety + accessibility stakes.

| # | Frame | Priority | Notes |
|---|---|---|---|
| 1 | Splash | P2 | Branded blue fade; tokenize the hard-coded `#208AEF`. |
| 2 | Sign in | P2 | Calm centered form; flag Eastern-Arabic ٦ in password copy. |
| 3 | Sign up | P2 | Mirror sign-in + "check email" notice state. |
| 4 | Onboarding (create circle) | P2 | Warm first impression; empty/filled/error/loading. |
| 5 | **Home — no-data** | **P1** | Ring empty state; no doses; calm. |
| 6 | **Home — active day (progress)** | **P1** | Ring `given/total`, next-action card present. |
| 7 | **Home — completed day** | **P1** | Ring complete (success) + "اكتملت جرعات اليوم". |
| 8 | **Home — overdue/missed (medical-safe)** | **P1** | Neutral "not yet given" framing; NO blame/health color. |
| 9 | **Medications list (today doses)** | **P1** | DoseCard set + medication list; reminder notice. |
| 10 | **Medication detail / today doses** | **P1** | Info + schedules manager (active vs stopped). |
| 11 | **Add/edit medication** | **P1** | Long form + inline schedule editor + sticky save. |
| 12 | **Schedule picker (modal)** | **P1** | Weekdays + times list + dates; duplicate/conflict errors. |
| 13 | Tasks list | P2 | Today/open/done; row variants. |
| 14 | Add/edit task | P2 | Category/priority OptionSelects + due date/time. |
| 15 | Appointments list | P2 | Today/upcoming; "when" anchor. |
| 16 | Add/edit appointment | P2 | Date + start/end + doctor selector. |
| 17 | Visits list | P3 | Today/upcoming/recent. |
| 18 | Daily logs list/create | P3 | Stream row + structured-observations form. |
| 19 | **Vitals list/create (non-diagnostic)** | **P2** | Neutral value+unit+time only; NO ranges/trends/health color. |
| 20 | Doctors list | P3 | Cards with/without phone. |
| 21 | **Doctor/contact detail with call** | **P2** | Large tappable call row; LTR phone. |
| 22 | **Emergency card** | **P1** | Show-a-stranger legibility; high contrast; one-tap call. |
| 23 | Members / care circle | P2 | Roster + manager actions + role modal. |
| 24 | Invite member | P2 | Warning banner form + success/code card. |
| 25 | **Notifications center** | **P1** | Unread/read distinction; filters; mark-all; empty. |
| 26 | **Notification settings** | **P1** | Push status card (4 states) + toggles + quiet hours + test. |
| 27 | Account / profile | P2 | Link rows + identity + danger sign-out. |
| 28 | Common modal / bottom sheet | P2 | The shared sheet chrome (grabber, header, actions, no-backdrop-dismiss). |
| 29 | Common error / empty / loading states | P2 | The shared `LoadingState`/`ErrorState`/`EmptyState` + no-active-circle gate. |
| 30 | Component library page | P1 | All primitives + variants (see component-inventory doc). |
| 31 | Design tokens page | P1 | Colors (light+dark), type scale, spacing, radius, icon sizes, touch targets, elevation. |

Additional supporting frames to include if time allows: Pending invitations (status variants), Join circle, Recipient profile (manager + read-only), Vitals/Task/Appointment/Visit/Log detail editors, Explore "coming soon" (or recommend hiding in production).

---

## E. Data states matrix

Each module must be designed across these states. "Medical-safe" cells mean: neutral worded status (icon + text + tone), never health-color, never diagnosis. Mixed AR/EN = Arabic UI with LTR-isolated Latin runs (drug names, phones, times, codes). Western/Latin digits everywhere.

### E.1 Home (Today)
| State | What to show |
|---|---|
| Empty (no circle) | Onboarding (B.3) |
| Loading | Centered large spinner (circle resolving); ring shows `loopLoading` caption |
| Error | ErrorState `careCircle.loadError` + retry |
| Populated — active day | Ring `progress` ({{given}}/{{total}}) + next-action card |
| Populated — completed day | Ring `complete` (success) + "اكتملت جرعات اليوم" |
| No doses today | Ring `empty` + "لا جرعات اليوم"; next-dose absent |
| Overdue/missed (medical-safe) | Next dose still pending; neutral "not yet given" wording; NO red-as-danger, NO blame |
| Long content | Long recipient/circle name truncates gracefully; hero stays readable |
| Mixed AR/EN | Arabic UI; med name + time LTR-isolated inside the Arabic hero |

### E.2 Medications
| State | What to show |
|---|---|
| Empty | Section A `noDosesTitle`; Section B `noMedsTitle` (subtitle managers only) |
| Loading | LoadingState (composed today query) |
| Error | ErrorState `medications.loadError` + retry; mutation failure silently re-enables buttons (no false success) |
| Populated | DoseCards + medication rows |
| Long medication name | cardTitle wraps; time chip stays fixed; English name LTR-isolated |
| Many doses | Long scroll of DoseCards; keep the time anchor scannable |
| No doses today | Section A empty state |
| Overdue/missed (medical-safe) | Dose with status=missed "لم تُعطَ" (neutral fact, cross glyph, error *tone* not health judgment) |
| Completed dose | Status=given "أُعطيت" (success tone + check) |
| Mixed AR/EN | Dose name (e.g. English drug) + "500 mg" + `HH:MM` all LTR-isolated |

### E.3 Tasks
| State | What to show |
|---|---|
| Empty | `noTodayTitle` / `noOpenTitle` |
| Loading / Error | LoadingState / ErrorState `tasks.loadError` |
| Task count 0 | Empty states |
| Task count 1 | Single row in Today |
| Task count many | Three sections populated; priority badges only on high/urgent |
| Populated row variants | open, assigned-to-me, with-priority, completed, cancelled |
| Long content | Long title wraps; due chip LTR |
| Mixed AR/EN | Due `date HH:MM` LTR-isolated |

### E.4 Appointments
| State | What to show |
|---|---|
| Empty | `noTodayTitle` / `noUpcomingTitle` |
| Loading / Error | LoadingState / ErrorState |
| No appointments | Both empty states |
| Populated | Today + upcoming cards |
| Card variants | scheduled, completed, cancelled (+ reopen on detail) |
| Long content | Title + location wrap; "when" range LTR |
| Mixed AR/EN | Date/time range + doctor name (may be Latin) isolated |

### E.5 Visits
| State | What to show |
|---|---|
| Empty | `noTodayTitle` / `noUpcomingTitle` |
| Loading / Error | LoadingState / ErrorState `visits.loadError` |
| Populated | Today / Upcoming / Recent (cap 10) |
| Card variants | planned, completed, cancelled (+ reopen) |
| Mine | `visits.mineLabel` "زيارتك" marker |
| Mixed AR/EN | "when" LTR-isolated |

### E.6 Daily logs
| State | What to show |
|---|---|
| Empty | `noTodayTitle` "لا سجلات لهذا اليوم" |
| Loading / Error | LoadingState / ErrorState `dailyLogs.loadError` |
| Populated | Structured-summary rows + notes-only rows |
| Already-logged-today | Create error `alreadyLoggedToday` (edit existing) |
| Long content | Many observations join with bullets; note count line |
| Medical-safe | Enum values are observational, never normal/abnormal medical labels |
| Mixed AR/EN | `log_date` LTR; Arabic enum labels |

### E.7 Vitals (NON-DIAGNOSTIC)
| State | What to show |
|---|---|
| Empty | `noTodayTitle` "لا قياسات اليوم" |
| Loading / Error | LoadingState / ErrorState `vitals.loadError` |
| Populated | Value + unit + timestamp rows ONLY — no ranges, no trend, no health color |
| Long content | Notes wrap; BP shows `120/80 mmHg` LTR-isolated |
| Many readings | Today + recent sections |
| Medical-safe (enforced) | NEVER green/red "good/bad"; strongest disclaimer present |
| Mixed AR/EN | Value/unit/timestamp LTR-isolated within Arabic |

### E.8 Doctors / Contacts (call)
| State | What to show |
|---|---|
| Empty | `doctors.emptyTitle` / `emergencyContacts.emptyTitle` |
| Loading / Error | LoadingState / ErrorState |
| Populated | ContactCards |
| Doctor WITH phone | Call row present (LTR phone, "اتصال {name}") |
| Doctor WITHOUT phone | No call row (doctor phone optional) — design this variant |
| Contact (phone required) | Call row always present; primary badge variant |
| Mixed AR/EN | Phone LTR-isolated + selectable |
| Offline/no-telephony | Call fails quietly (no toast) — do NOT design a fake success |

### E.9 Notifications
| State | What to show |
|---|---|
| Empty | `emptyTitle` "لا توجد إشعارات" |
| Loading / Error | LoadingState / ErrorState `notifications.loadError`; pull-to-refresh |
| Unread | Bordered card + leading dot + bolder title |
| Read | Sunken, unbordered, default weight |
| Many | Filter chips (>1 circle) + Load more |
| Type variants | medication / missed-dose / task / appointment / visit / care / emergency / system (per-type glyph + tone; meaning in text) |
| Enable prompt | Info banner when push not yet enabled |
| Mixed AR/EN | Timestamp `YYYY-MM-DD HH:MM` LTR-isolated |

### E.10 Notification settings / Push
| State | What to show |
|---|---|
| Push: web-unsupported | Plain honest text (in-app center works, device push needs the phone) |
| Push: no-device | "needs a physical device" |
| Push: enabled | Success badge + Disable control |
| Push: default/denied | Enable CTA; denied → "enable in device settings" |
| Toggles | 8 rows, all default ON; conservative |
| Quiet hours off/on | Master toggle; on reveals start/end + cross-midnight note |
| Timezone | Display-only well (LTR ID) |
| Saved / error | `saved` confirmation / `saveError` / `quietHours.invalid` |
| Local test | Clearly local-only; `scheduled`/`failed` feedback |

### E.11 Members / Invitations
| State | What to show |
|---|---|
| Empty (invitations) | `invitations.emptyTitle` |
| Loading / Error | LoadingState / ErrorState (`circleMembers.loadError` / `invitations.loadError`) |
| Member variants | owner (non-removable), last-admin (protected), self (Leave), inactive |
| Role modal | pick step + confirm step (increase/decrease/lateral) |
| Invitation status | pending (info) / accepted (success) / revoked (error) / expired (warning) |
| Invite success | Code card (large LTR code, one-time warning) |
| Mixed AR/EN | Email + invite code LTR-isolated |

### E.12 Recipient profile / Account / Auth
| State | What to show |
|---|---|
| Profile empty | `recipientProfile.empty` (no create CTA) |
| Profile manager vs read-only | editable + sticky save / neutral banner + disabled fields |
| Profile saved/error | `saved` / `saveFailed`; unsaved guard |
| Account | identity (email LTR), link rows, danger sign-out (no confirm) |
| Sign-out error | `signOutError` alert |
| Auth errors | per-field + `signInFailed`/`signUpFailed`; sign-up "check email" notice |
| Mixed AR/EN | Email LTR-isolated and selectable |

---
