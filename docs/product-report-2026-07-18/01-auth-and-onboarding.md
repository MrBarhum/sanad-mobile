# Authentication, Onboarding & Circle Gate

This section documents the entire pre-app journey of Sanad — from the moment the native splash hands off to JavaScript, through sign-in / sign-up / password recovery, into the "you don't belong to a care circle yet" gate, and finally the two ways to get inside a circle: **creating** one (first-run onboarding) or **joining** one by invitation code (typed, deep-linked, or WhatsApp-shared and replayed across the auth gate). It also covers the app-wide **circle-selection context** — the layer that decides which of a user's circles is "active", persists that choice per user, and exposes the circle switcher. Every screen here is Arabic-first RTL, uses one typeface (IBM Plex Sans Arabic), and reads its copy from i18n (`ar.json` / `en.json` at exact key parity). All Arabic strings below are quoted verbatim from the locale files, with their English counterparts.

---

## Routing & gate architecture (how the pre-app flow is wired)

Three nested layouts and one root screen decide what an app launch shows. There is **no dedicated splash route** — the native splash is held during font load, then an `AnimatedSplashOverlay` plays over the first real screen.

### Root layout — `src/app/_layout.tsx`
- **Purpose**: bootstrap the app shell before any screen renders.
- Loads four IBM Plex Sans Arabic weights + the vector-icon glyph fonts via `useFonts`. While `!fontsLoaded && !fontsError` it returns `null`, keeping the native splash up (sub-100 ms) so text never flashes a fallback font (`_layout.tsx:59`).
- Calls `bootstrapNotifications()` once on mount (channel + notification action categories), before the auth gate, so a push arriving while signed out still renders its buttons.
- Wraps everything in `<AppProviders>`, then a react-navigation `ThemeProvider` matched to the Sanad canvas, then renders three things: `<PendingJoinLink />` (headless — see below), `<AnimatedSplashOverlay />`, and the root `<Stack screenOptions={{ headerShown: false }} />`.
- **Provider order** (outer→inner, `src/providers/index.tsx`): `SafeAreaProvider → QueryProvider → AuthProvider → CircleSelectionProvider`. i18next is initialized as a side-effect import before any component renders.

### Auth session provider — `src/providers/auth-provider.tsx`
- Resolves the persisted Supabase session once (`getSession`), then keeps it in sync via `onAuthStateChange`. Exposes `{ session, user, isLoading }`. `isLoading` is `true` only until the first session resolves.
- Ties Supabase token auto-refresh to app foreground state (`startAutoRefresh` when active, `stopAutoRefresh` when backgrounded).
- **This is the single source of "am I signed in?"** for both guards below.

### `(auth)` group layout — `src/app/(auth)/_layout.tsx`
- While `isLoading` → renders `null` (blank).
- If a `session` exists → `<Redirect href="/" />` (an authenticated user has no business on auth screens).
- Otherwise renders a headerless `Stack` containing `sign-in`, `sign-up`, `forgot-password`.

### `(app)` group layout — `src/app/(app)/_layout.tsx`
- While `isLoading` → `null`.
- If **no** `session` → `<Redirect href="/sign-in" />`. This is the gate that bounces a signed-out deep-link tap (and drops its query params — the reason `PendingJoinLink` exists).
- Otherwise renders `<NotificationObserver />` (headless) + a themed native `Stack`. The stack registers `join-circle` with header title `t('joinCircle.title')` = «الانضمام إلى دائرة رعاية» / "Join a care circle" (`_layout.tsx:46`). Native header chrome: background = `theme.background`, tint = `theme.text`, bold IBM Plex title at 18, no shadow.

### Root reset-password screen — `src/app/reset-password.tsx`
- Registered at the **root** stack (outside both `(auth)` and `(app)` guards) so the recovery deep link stays reachable even after the recovery token establishes a session (otherwise the auth guard would bounce the user mid-reset). Documented in full below.

### `CircleSelectionProvider` — `src/features/circle-selection/provider.tsx`
- Loads every **active** membership for the signed-in user (`fetchUserCircles`), resolves which circle is "active" (persisted choice if still valid, else the oldest membership), persists the choice per-user, and drops circle-scoped cache on a switch. Exposes `circles`, `activeCircle`, `activeCircleId`, `setActiveCircle`, `setPreferredCircleId`, `hasNoCircles`, `isLoading`, `isError`, `refetch`.
- `hasNoCircles` becomes `true` only once the list has loaded/hydrated **and** the user belongs to zero circles — this is the signal Home uses to show onboarding.

### Where `/` resolves
`/` → `(app)` guard. Signed out → `/sign-in`. Signed in → `(tabs)/index` = **HomeScreen** (`src/app/(app)/(tabs)/index.tsx`), which branches:
- `isLoading` → full-screen large spinner.
- `isError` → `ErrorState` with «تعذّر تحميل بيانات دائرة الرعاية…» / "Couldn't load your care circle…" and a retry.
- `hasNoCircles || !activeCircle` → **`CareCircleOnboarding`** (create-or-join).
- else → the `FigmaHome` dashboard (out of this section's scope; its **circle switcher dropdown** is documented below as it belongs to the selection context).

---

## Screen: Sign in

- **Route & how reached**: `/sign-in` (inside `(auth)`). Reached as the redirect target of the `(app)` guard when signed out, from the sign-up screen's "Sign in" footer link, from the forgot-password "Back to sign in" links, and as the default auth screen.
- **Purpose**: authenticate an existing user with email + password.
- **File**: `src/app/(auth)/sign-in.tsx`.

### Layout, top to bottom
1. **Brand header** (centered): a 56×56 teal (`theme.primary`) pill containing the `BrandMark` SVG (a care-ring: outer ring + arc + small rounded bar, drawn inline in white; `sign-in.tsx:25–35`). Below it the brand title `t('auth.brand')` = **«سند» / "Sanad"** (bold, 28/38). Below that the subtitle `t('auth.signInSubtitle')` = **«سجّل الدخول للمتابعة إلى سند» / "Sign in to continue to Sanad"** (secondary text, 15).
2. **Card** (`Surface`, `padded={false}`, custom vertical/horizontal padding) containing, with `Gutter` gaps:
   - Email field (`AuthField`).
   - Password field (`AuthField`, with show/hide eye).
   - "Forgot password?" link, right-aligned.
   - Inline error line (only when set).
   - Primary submit button.
3. **Footer row** (centered): «ليس لديك حساب؟» / "Don't have an account?" + a "Sign up" link.

### Interactive elements
| Element | Label (AR / EN) | Icon | Behavior |
|---|---|---|---|
| Email field | «البريد الإلكتروني» / "Email" | — | Forced LTR (`ltr`), email keyboard, placeholder `name@example.com` (`auth.emailPlaceholder`). |
| Password field | «كلمة المرور» / "Password" | eye toggle (`view`/`viewOff`) | `secureTextEntry` unless revealed; placeholder «٦ أحرف على الأقل» / "At least 6 characters". Eye button `accessibilityLabel` = «إظهار/إخفاء كلمة المرور» / "Show/Hide password". |
| Forgot-password link | «نسيت كلمة المرور؟» / "Forgot password?" (`auth.forgotPassword`) | — | `<Link href="/forgot-password">`. |
| Submit button | «تسجيل الدخول» / "Sign in" (`auth.signInButton`) | spinner when loading | Validates, calls `supabase.auth.signInWithPassword`. On success the auth-state change propagates and the `(auth)` guard redirects to `/`. This is the shared `FigmaFooterPrimaryButton` (full-width, 56dp, teal, no disabled state). |
| Sign-up link | «إنشاء حساب» / "Sign up" (`auth.signUpLink`) | — | `<Link href="/sign-up">`. |

### Validation & error copy
Zod schema: `email` must be a valid email, `password` min 6 (`sign-in.tsx:19–22`). On the **first** failing issue it shows one error line (`themeColor="errorFg"`, `accessibilityRole="alert"`):
- password issue → «يجب أن تتكوّن كلمة المرور من ٦ أحرف على الأقل» / "Password must be at least 6 characters" (`auth.errors.password`).
- email issue → «يرجى إدخال بريد إلكتروني صحيح» / "Please enter a valid email" (`auth.errors.email`).
- otherwise → «تعذّر إكمال العملية. حاول مرة أخرى.» / "Could not complete the request. Please try again." (`auth.errors.generic`).
- Supabase sign-in failure → «بيانات الدخول غير صحيحة» / "Invalid login credentials" (`auth.errors.signInFailed`).

### States
- **Idle / populated**: as above.
- **Submitting**: button shows a spinner and blocks re-press (`loading`); no field disabling.
- **Error**: one inline alert line above the button.
- No loading skeleton or empty state (single form).

### Components used
`Screen` (keyboard-avoiding, `maxWidth=MaxFormWidth`), `Surface`, `AuthField` ×2, `FigmaFooterPrimaryButton`, `ThemedText`, `ThemedView`, `Link`, inline `BrandMark` SVG.

---

## Screen: Sign up

- **Route & how reached**: `/sign-up` (inside `(auth)`). Reached from the sign-in footer "Sign up" link.
- **Purpose**: create a new account (full name + email + password).
- **File**: `src/app/(auth)/sign-up.tsx`.

### Layout, top to bottom
1. **Header** (centered): title `t('auth.signUpTitle')` = **«إنشاء حساب» / "Create account"** (bold, 26/36); subtitle `t('auth.signUpSubtitle')` = **«أنشئ حسابك للبدء» / "Create your account to get started"**.
2. **Card** (`Surface`) with four fields + error/notice + submit, `Gutter` gaps.
3. **Footer row**: «لديك حساب بالفعل؟» / "Already have an account?" + "Sign in" link.

### Form fields (in order)
| # | Field | Label (AR / EN) | Type | Required | Placeholder | Hint | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Full name | «الاسم الكامل» / "Full name" | text | Yes (1–120 chars) | «مثال: فاطمة الأحمد» / "e.g. Fatima Al-Ahmad" | — | `autoCapitalize="words"`. Required so every member reads with a name across the app instead of a bare «عضو». |
| 2 | Email | «البريد الإلكتروني» / "Email" | email (LTR) | Yes (valid email) | `name@example.com` | — | — |
| 3 | Password | «كلمة المرور» / "Password" | password + eye | Yes (min 6) | «٦ أحرف على الأقل» | hint «٦ أحرف على الأقل» / "At least 6 characters" (`auth.passwordHint`) | — |
| 4 | Confirm password | «تأكيد كلمة المرور» / "Confirm password" (`auth.confirmPassword`) | password + eye | Yes (must match) | «٦ أحرف على الأقل» | — | Validated **locally only**; never sent to Supabase. |

### Validation & error copy (per-field, all shown at once)
- Full name empty or >120 → «يرجى إدخال الاسم» / "Please enter your name" (`auth.errors.fullName`).
- Email invalid → «يرجى إدخال بريد إلكتروني صحيح» / "Please enter a valid email".
- Password <6 → «يجب أن تتكوّن كلمة المرور من ٦ أحرف على الأقل» / "Password must be at least 6 characters".
- Confirm ≠ password → «كلمتا المرور غير متطابقتين» / "Passwords do not match" (`auth.errors.passwordMismatch`).
- Supabase sign-up failure → submit-level alert «تعذّر إنشاء الحساب. حاول مرة أخرى.» / "Could not create the account. Please try again." (`auth.errors.signUpFailed`).

### Submit behavior
On valid submit calls `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`. Only email + password reach auth; `full_name` rides in user metadata and a DB trigger (`handle_new_user`) copies it to `public.profiles.full_name`.
- If a session is returned → the `(auth)` guard auto-redirects to `/`.
- If **no** session (email confirmation required) → shows an `InfoBanner` (`tone="info"`) with `t('auth.signUpCheckEmail')` = **«تم إنشاء الحساب. تحقّق من بريدك الإلكتروني لتأكيد الحساب.» / "Account created. Check your email to confirm your account."**

### Submit / footer copy
Primary button `t('auth.signUpButton')` = «إنشاء حساب» / "Create account".

### Components used
`Screen`, `Surface`, `AuthField` ×4, `InfoBanner`, `FigmaFooterPrimaryButton`, `ThemedText`, `ThemedView`, `Link`.

---

## Screen: Forgot password

- **Route & how reached**: `/forgot-password` (inside `(auth)`). Reached from the sign-in "Forgot password?" link. Reachable only when signed out (guard bounces authed users to `/`).
- **Purpose**: request a password-recovery email (deep-links back to `/reset-password`).
- **File**: `src/app/(auth)/forgot-password.tsx`.

### Layout, top to bottom
1. **Header**: title `t('auth.forgotTitle')` = **«استعادة كلمة المرور» / "Reset password"** (bold 26/36); subtitle `t('auth.forgotSubtitle')` = **«أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.» / "Enter your email and we'll send you a link to reset your password."**
2. **Card** (`Surface`): before send → email field + send button; after send → an info banner + a "Back to sign in" primary button.
3. **Footer**: a plain "Back to sign in" link (always visible).

### Interactive elements & states
| State | Content |
|---|---|
| **Idle** | Email field (LTR, `name@example.com`) + button «إرسال رابط الاستعادة» / "Send reset link" (`auth.forgotSend`). |
| **Submitting** | Button spinner. |
| **Sent** | Info banner (`tone="info"`) `t('auth.forgotSent')` = «إذا كان هناك حساب بهذا البريد، فسيصلك رابط لإعادة تعيين كلمة المرور.» / "If an account exists for this email, a reset link is on its way." + primary button «العودة لتسجيل الدخول» / "Back to sign in" (`auth.backToSignIn`) → `router.replace('/sign-in')`. |
| **Invalid email** | Inline field error «يرجى إدخال بريد إلكتروني صحيح» / "Please enter a valid email". |

### Privacy note
The screen shows the **same** "sent" confirmation whether or not the account exists — it intentionally ignores the `resetPasswordForEmail` result and never reveals account existence (`forgot-password.tsx:45–52`). The redirect URL passed is `passwordResetRedirectTo()` (native: `sanadmobile://reset-password`; web: `<origin>/reset-password`).

### Components used
`Screen`, `Surface`, `AuthField`, `InfoBanner`, `FigmaFooterPrimaryButton`, `ThemedText`, `ThemedView`, `Link`.

---

## Screen: Reset password (recovery deep link)

- **Route & how reached**: `/reset-password` at the **root** stack. Opened by tapping the recovery link in the email → the OS deep-links `sanadmobile://reset-password#access_token=…` (or `?code=…`) into the app. Also reachable on web at `<origin>/reset-password`.
- **Purpose**: exchange a recovery token for a session and let the user set a new password.
- **File**: `src/app/reset-password.tsx`; token parsing in `src/features/auth/password-reset.ts`.

### Token resolution
On mount (once), it resolves the URL (cold-start `getInitialURL` → reactive `Linking.useURL` → web `window.location.href`), then `parseRecoveryParams()` extracts credentials from **either** the URL fragment (implicit: `#access_token&refresh_token&type=recovery`) **or** the `?code=` query (PKCE), plus any `error`/`error_description`. It then:
- `error` present → phase `invalid`.
- `accessToken`+`refreshToken` → `supabase.auth.setSession(...)` → phase `ready`.
- `code` → `supabase.auth.exchangeCodeForSession(...)` → phase `ready`.
- No token but an existing session → `ready`; else `invalid`.

### Layout, top to bottom
1. **Header** (centered): title `t('auth.resetTitle')` = **«تعيين كلمة مرور جديدة» / "Set a new password"**; subtitle `t('auth.resetSubtitle')` = **«اختر كلمة مرور جديدة لحسابك.» / "Choose a new password for your account."**
2. **Card** whose body depends on phase:

| Phase | Body |
|---|---|
| **checking** | Centered spinner + `t('auth.resetChecking')` = «جارٍ التحقّق من الرابط…» / "Checking your link…". |
| **invalid** | Warning `InfoBanner` `t('auth.resetInvalid')` = «هذا الرابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.» / "This link is invalid or has expired. Request a new one." + button «طلب رابط جديد» / "Request a new link" (`auth.requestNewLink`) → `router.replace('/forgot-password')`. |
| **ready** | Two password fields + submit (see below). |
| **done** | Info `InfoBanner` `t('auth.resetSuccess')` = «تم تحديث كلمة المرور بنجاح.» / "Your password has been updated." + button «متابعة» / "Continue" (`auth.continue`) → `router.replace('/')`. |

### Form (ready phase)
| Field | Label (AR / EN) | Type | Placeholder |
|---|---|---|---|
| New password | «كلمة المرور الجديدة» / "New password" (`auth.newPassword`) | password + eye | «٦ أحرف على الأقل» |
| Confirm new password | «تأكيد كلمة المرور الجديدة» / "Confirm new password" (`auth.confirmNewPassword`) | password + eye (carries the inline error) | «٦ أحرف على الأقل» |

Submit button «حفظ كلمة المرور» / "Save password" (`auth.resetSubmit`).

### Validation & error copy
- Password <6 → «يجب أن تتكوّن كلمة المرور من ٦ أحرف على الأقل».
- Mismatch → «كلمتا المرور غير متطابقتين».
- `updateUser` failure → «تعذّر تحديث كلمة المرور. حاول مرة أخرى.» / "Could not update your password. Please try again." (`auth.resetFailed`).
On success sets `done`.

### Components used
`Screen`, `Surface`, `AuthField` ×2, `InfoBanner`, `FigmaFooterPrimaryButton`, `ThemedText`, plain `ActivityIndicator`.

---

## Component: `AuthField` (shared auth input)

- **File**: `src/components/auth-field.tsx`. Used by all four auth screens.
- **Structure**: `smallBold` label above a raised input row (`backgroundSunken` fill, 1.5px border radius `Radius.md`, min-height 52). Border color: error → `errorFg`, focused → `primary`, else `border`.
- **Password variant** (`isPassword`): renders an eye `Pressable` at the end toggling `secureTextEntry`; icon `view`/`viewOff`; label «إظهار/إخفاء كلمة المرور».
- **`ltr` prop**: forces `writingDirection:'ltr'` + left align (used for email).
- **Below the input**: an inline error (`errorFg`, `role="alert"`, `aria-live="polite"`) OR a muted hint (mutually exclusive; error wins).

---

## Screen: Care-circle onboarding (create the first circle)

- **Route & how reached**: rendered **in place** at Home (`/`) whenever the signed-in user has no active circle (`hasNoCircles || !activeCircle`; `(tabs)/index.tsx:49`). It is not a distinct route — it replaces the dashboard.
- **Purpose**: create the user's first care circle + its care recipient in one step (or bail out to join an existing circle).
- **File**: `src/features/care-circle/onboarding-form.tsx`.

### Layout, top to bottom
1. **Brand row**: a 40×40 teal pill with a small care-ring SVG + the brand name `t('auth.brand')` = «سند» / "Sanad" (bold 18).
2. **Title** `t('careCircle.onboarding.title')` = **«أنشئ دائرة الرعاية» / "Create your care circle"** (bold 24/34) + subtitle `t('careCircle.onboarding.subtitle')` = **«ابدأ بإضافة الشخص الذي تعتني به» / "Start by adding the person you care for"**.
3. **Invite hint banner** (`InfoBanner tone="accent"` — gold accent) `t('careCircle.onboarding.inviteHint')` = **«ستتمكن من دعوة بقية أفراد العائلة بعد إنشاء الدائرة مباشرةً» / "You can invite the rest of the family right after creating the circle."**
4. **One grouped card** (`Surface`, `gap=Gutter`):
   - Circle-name field.
   - A hairline divider.
   - Section label `t('careCircle.onboarding.recipientSection')` = «معلومات المسنّ» / "Care recipient details" (`smallBold`, `textMuted`).
   - Recipient-name field (required `*`).
   - Birth-date field (`DateField`, clearable).
5. **Submit-level error** (only on failure), then the primary create button, then the outlined join button.

### Form fields (in order)
| # | Field | Label (AR / EN) | Type | Required | Default / Placeholder |
|---|---|---|---|---|---|
| 1 | Circle name | «اسم دائرة الرعاية» / "Care circle name" (`circleNameLabel`) | text | Yes | **Default value** «رعاية الوالد» / "Dad's care" (`circleNameDefault`); placeholder «مثال: رعاية الوالد» / "e.g. Dad's care". |
| 2 | Recipient full name | «الاسم الكامل لمن تعتني به» / "Full name of the person you care for" (`recipientNameLabel`) | text | Yes (marked `*`) | placeholder «مثال: محمد عبدالله» / "e.g. Mohammed Abdullah". |
| 3 | Birth date | «تاريخ الميلاد (اختياري)» / "Birth date (optional)" (`birthDateLabel`) | date picker (wheel), clearable | No | Stored/emitted `YYYY-MM-DD` or `''`; empty→`null` on submit. |

### Validation & error copy (Zod `createCircleSchema`, per-field)
- Circle name empty → «يرجى إدخال اسم دائرة الرعاية» / "Please enter a care circle name" (`errors.circleName`).
- Recipient name empty → «يرجى إدخال الاسم الكامل لمن تعتني به» / "Please enter the full name" (`errors.recipientName`).
- Birth date present but not a valid `YYYY-MM-DD` → «أدخل التاريخ بصيغة YYYY-MM-DD» / "Enter the date as YYYY-MM-DD" (`errors.birthDate`). (Birth date is optional: `''` passes.)
- Create RPC failure → submit-level alert «تعذّر إنشاء دائرة الرعاية. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't create your care circle. Check your connection and try again." (`errors.submitFailed`).

### Buttons
| Button | Label (AR / EN) | Variant | Behavior |
|---|---|---|---|
| Create | «إنشاء دائرة الرعاية» / "Create care circle" (`onboarding.submit`) | `FigmaFooterPrimaryButton` (teal, loading) | Calls `useCreateCareCircle(userId).mutateAsync(...)`. |
| Join with code | «الانضمام برمز دعوة» / "Join with an invitation code" (`onboarding.joinWithCode`) | `Button variant="secondary"` (outlined), disabled while submitting | `router.push('/join-circle')`. |

### What "create" does (data flow)
`createCareCircle` calls the security-definer RPC `create_care_circle(circle_name, recipient_full_name, recipient_birth_date)` — creating the circle + the owner **admin** membership + the care recipient in one transaction (caller identity from `auth.uid()`, no user id sent from client). It then best-effort calls `set_circle_timezone(circle_id, deviceTimezone)` to anchor scheduled times (a failure defaults the circle to `'UTC'` and never fails creation). On success `useCreateCareCircle` invalidates `circleSelectionKeys.list(userId)`, the circle list refetches, `hasNoCircles` flips false, and Home swaps to the dashboard.

### States
- No loading/empty/error placeholder screens — it is a form. Submit button shows a spinner; the join button disables during submit; failure surfaces the inline `errors.submitFailed` alert.

### Components used
`Screen` (keyboard-avoiding, `MaxFormWidth`), `Surface`, `FormField` ×2, `DateField`, `InfoBanner` (accent), `FigmaFooterPrimaryButton`, `Button` (secondary), `ThemedText`, inline care-ring SVG.

---

## Screen: Join a care circle (invitation code)

- **Route & how reached**: `/join-circle` (registered in `(app)` stack with native header title «الانضمام إلى دائرة رعاية» / "Join a care circle"). Entry points:
  1. The onboarding "Join with an invitation code" button.
  2. The **circle switcher** dropdown "Join another circle" row on the dashboard.
  3. A WhatsApp/deep-link `sanadmobile://join-circle?code=…` — signed-in taps route here directly (code pre-filled); signed-out taps are captured, stashed, and **replayed** here after auth by `PendingJoinLink`.
- **Purpose**: join an existing circle by entering (or confirming a pre-filled) invitation code.
- **File**: `src/features/invitations/join-form.tsx` (thin route wrapper `src/app/(app)/join-circle.tsx`).

### Layout, top to bottom (idle)
1. **Trust warning banner** (`InfoBanner tone="warning"`, sits **before** the field) `t('joinCircle.warning')` = **«أدخل فقط رمزًا استلمته من شخص تثق به. فهو يمنح الوصول إلى معلومات رعاية حسّاسة.» / "Only enter a code you received from someone you trust. It gives access to sensitive care information."**
2. **Code card** (`Surface`, `radius=Radius.lg`) wrapping a single `FormField`:
   - Label «رمز الدعوة» / "Invitation code" (`joinCircle.codeLabel`).
   - Placeholder «مثال: ABCDE-FGHJK» / "e.g. ABCDE-FGHJK" (`codePlaceholder`).
   - Input styled **centered monospace LTR**, bold, 20, letter-spacing 3 (so `SANAD-XXXXX` reads cleanly regardless of app RTL); `autoCapitalize="characters"`, `autoCorrect=false`.
3. **Join button** (primary).

### Layout (success step)
Replaces the whole body: an 80×80 success badge (`successBg` fill, `successFg` 2px border, `success` icon at 36), then a centered `sectionTitle` `t('joinCircle.successTitle')` = **«تم انضمامك» / "You're in"**, then centered secondary text `t('joinCircle.successSubtitle')` = **«انضممت إلى دائرة الرعاية وتم اختيارها الآن.» / "You've joined the care circle and it's now selected."**, then a «متابعة» / "Continue" (`joinCircle.continue`) button → `router.replace('/')`.

### Interactive elements
| Element | Label (AR / EN) | Behavior |
|---|---|---|
| Code field | «رمز الدعوة» / "Invitation code" | Seeded once from a `?code=` deep-link param (without clobbering typed input). |
| Join button | «انضمام» / "Join circle" (`joinCircle.submit`) | Validates non-empty, calls `useAcceptInvitation().mutateAsync(code)`; on success `setPreferredCircleId(result.circleId)` then success step. |
| Continue button | «متابعة» / "Continue" | `router.replace('/')` (lands on the newly-active circle's dashboard). |

### Validation & error copy (mapped from RPC errors via `acceptErrorKey`)
Errors render inline under the code field (`FormField error`):
- Empty code → «يرجى إدخال رمز الدعوة» / "Please enter the invitation code" (`errors.required`).
- Already a member (code `23505` / "already a member") → «أنت عضو في هذه الدائرة بالفعل.» / "You're already a member of this circle." (`errors.alreadyMember`).
- Expired → «انتهت صلاحية هذه الدعوة.» / "This invitation has expired." (`errors.expired`).
- Revoked → «تم إلغاء هذه الدعوة.» / "This invitation has been revoked." (`errors.revoked`).
- Already used → «تم استخدام هذه الدعوة من قبل.» / "This invitation has already been used." (`errors.used`).
- Invalid (code `P0002` / "invalid invitation") → «رمز الدعوة غير صحيح.» / "This invitation code is not valid." (`errors.invalid`).
- Anything else → «تعذّر الانضمام. تحقّق من الرمز وحاول مرة أخرى.» / "Could not join. Please check the code and try again." (`errors.generic`).

### What "join" does (data flow)
`acceptInvitation(code)` → RPC `accept_circle_invitation(p_code)` (normalized + hashed server-side) returns `{ circleId, membershipId, role }`. On success `useAcceptInvitation` broadly invalidates the query cache (the user now belongs to a new circle); the form sets the joined circle as the **preferred** selection so it becomes active as soon as the membership list refetches (`setPreferredCircleId` persists it even before the list contains it).

### Role note
Joining is available to **any authenticated user** (the route wrapper comment: "any authenticated user"). The granted role comes from the invitation itself — an inviter can grant `primary_caregiver` (admins only), `family_member`, or `remote_member`; `admin`, `caregiver`, `elder` are never invitable (`invitations/api.ts:48–53`).

### Components used
`Screen` (keyboard-avoiding, `MaxFormWidth`), `Surface`, `FormField`, `InfoBanner` (warning), `Icon` (success), `FigmaFooterPrimaryButton`, `ThemedText`.

---

## Feature: Pending-join persistence (WhatsApp invite across the auth gate)

- **Files**: `src/features/invitations/pending-join-link.tsx` (headless bridge, mounted at root above the auth gate), `src/features/invitations/pending-join.ts` (storage helpers).
- **Problem it solves**: a `sanadmobile://join-circle?code=…` link tapped **while signed out** hits the `(app)` session guard, which redirects to `/sign-in` and drops the `?code`.
- **How it works**:
  1. `PendingJoinLink` captures the code from the incoming link — cold start via `Linking.getInitialURL()`, warm app via `Linking.useURL()` — using `joinCodeFromUrl()` (tolerant of any scheme / dev-server prefix).
  2. It stashes the code **in memory** (live session) **and** in `expo-secure-store` (survives a cold start / force-quit mid sign-up). The code is not a secret; SecureStore is just the persistent store already used for the session. Web skips SecureStore.
  3. Once a `session` exists and a pending code is held, it `router.replace({ pathname: '/join-circle', params: { code } })` and clears the stash so the code is consumed exactly once.
- A signed-in tap already routes to `/join-circle` via expo-router; the replay is idempotent. With no link and no stash, nothing happens (a normal launch never leaks a stale code). Renders nothing.

---

## Feature: Circle selection context (active circle + switcher)

- **Files**: `provider.tsx`, `api.ts`, `storage.ts`, `hooks.ts`, `permissions.ts` (all under `src/features/circle-selection/`).
- **Purpose**: own which of the user's circles is "active", persist it per-user, and expose it app-wide.

### Data model
`fetchUserCircles(userId)` reads all **active** memberships (oldest first), then the circle names/timezones and recipients, joined in memory into `CircleSummary { circleId, circleName, recipientName, recipientBirthDate, role, circleTimezone }`. `toActiveCircle()` derives the role flags the screens consume: `canManage` (admin / primary_caregiver) and `canLogDoses` (admin / primary_caregiver / family_member / caregiver) — see `permissions.ts`.

### Active-circle resolution
`activeCircleId` = the persisted choice **if** it is still an active membership, otherwise `circles[0]` (oldest membership, deterministic). A stale stored id is ignored but **never rewritten**, so a just-joined circle preference is honored the moment it appears in the list. Persistence is per-user (`sanad_active_circle_<userId>`) in SecureStore (native) / localStorage (web), best-effort (degrades to in-memory for the session).

### Circle switcher (rendered on the dashboard header)
Although the full dashboard is out of this section's scope, the switcher belongs to this context. On `FigmaHome` the header shows the active `circle.circleName` with a `ChevronDown`; tapping it (`accessibilityHint` = `t('circleSwitcher.switch')` = «تبديل» / "Switch") toggles an inline `Surface` dropdown listing every circle:
- Each row shows the circle name; the active one shows a teal `Check`. Tapping a row calls `setActiveCircle(id)` (drops circle-scoped cache and refetches) and closes the dropdown.
- A final row «الانضمام إلى دائرة أخرى» / "Join another circle" (`careCircle.dashboard.today.joinAnotherCircle`, teal) → `router.push('/join-circle')`.

`setActiveCircle` no-ops if the id is already active or not in the list, else persists it and `queryClient.invalidateQueries()` (every circle-scoped key includes `circle_id`, so a broad invalidate is safe). Related copy `circleSwitcher.chooseTitle` = «اختر دائرة الرعاية» / "Choose a care circle" and `circleSwitcher.current` = «الحالية» / "Current" exist in the namespace (used by other switcher surfaces).

---

## Component: `CircleGate` (per-detail-screen no-circle guard)

- **File**: `src/features/care-circle/circle-gate.tsx`. Wraps the four care detail screens (not the auth flow) and renders shared loading / error / no-circle states, handing the resolved `ActiveCircle` to `children` only once available.
- **Loading** → `LoadingState` (centered large spinner).
- **Error** → `ErrorState` with `t('careCircle.loadError')` = «تعذّر تحميل بيانات دائرة الرعاية. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load your care circle. Check your connection and try again." + retry «إعادة المحاولة» / "Retry".
- **No circle** → a centered `EmptyState` with the `members` glyph and title `t('careCircle.noActiveCircle')` = **«لا توجد دائرة رعاية نشطة» / "No active care circle"** (no subtitle).

---

## Workflows

### 1. Sign in
1. App launches → root layout holds native splash for font load → `(app)` guard sees no session → redirects to `/sign-in`.
2. User enters email + password; taps «تسجيل الدخول» / "Sign in".
3. Client-side Zod validation; on failure an inline alert appears and submission stops.
4. `signInWithPassword` runs (button spinner). On invalid credentials → «بيانات الدخول غير صحيحة».
5. On success the auth-state change fires; `(auth)` guard redirects to `/`; Home resolves the user's circles.

### 2. Sign up (new account)
1. From sign-in tap «إنشاء حساب» / "Sign up" → `/sign-up`.
2. Fill full name, email, password, confirm password; tap «إنشاء حساب».
3. All fields validate together; per-field errors show inline.
4. `signUp` sends email/password + `full_name` metadata.
5. If email confirmation is required → info banner «تم إنشاء الحساب. تحقّق من بريدك الإلكتروني…» and the user stays put until they confirm and sign in. If a session is returned → auto-redirect to `/`.

### 3. Reset a forgotten password (deep-link round trip)
1. On sign-in tap «نسيت كلمة المرور؟» → `/forgot-password`.
2. Enter email; tap «إرسال رابط الاستعادة». The same confirmation «إذا كان هناك حساب بهذا البريد…» shows regardless of whether the account exists.
3. Supabase emails a recovery link pointing at `sanadmobile://reset-password` (native) / `<origin>/reset-password` (web).
4. Tapping it opens the root `/reset-password` screen; it resolves the token (`setSession` or `exchangeCodeForSession`) → phase `ready` (or `invalid` on an expired/bad link → «هذا الرابط غير صالح أو منتهي الصلاحية…» + «طلب رابط جديد»).
5. Enter new password + confirm; tap «حفظ كلمة المرور». On success → «تم تحديث كلمة المرور بنجاح.» + «متابعة» → `/`.

### 4. Create the first care circle (first-run onboarding)
1. A newly signed-in user with no circle lands on Home, which renders `CareCircleOnboarding`.
2. Circle name is pre-filled («رعاية الوالد»); user adjusts it, enters the recipient's full name (required), optionally picks a birth date.
3. Tap «إنشاء دائرة الرعاية». Zod validates; field errors show inline; RPC failure shows «تعذّر إنشاء دائرة الرعاية. تحقّق من الاتصال وحاول مجددًا.»
4. `create_care_circle` creates circle + owner admin membership + recipient; device timezone is set best-effort.
5. Circle list invalidates/refetches → `hasNoCircles` flips false → Home swaps to the dashboard for the new circle (creator is **admin** → `canManage`).

### 5. Join a circle by typed code
1. From onboarding tap «الانضمام برمز دعوة», or from the dashboard switcher tap «الانضمام إلى دائرة أخرى» → `/join-circle`.
2. Read the trust warning; enter the code (centered monospace); tap «انضمام».
3. `accept_circle_invitation` runs; specific errors map to inline messages (expired / revoked / used / already-member / invalid).
4. On success the joined circle is set as preferred and becomes active; the success step shows «تم انضمامك» / «انضممت إلى دائرة الرعاية وتم اختيارها الآن.»; tap «متابعة» → `/` (its dashboard).

### 6. Join via a WhatsApp invite link while signed out
1. User taps `sanadmobile://join-circle?code=…` while not signed in.
2. `PendingJoinLink` (mounted above the auth gate) captures the code and stashes it (memory + SecureStore); the `(app)` guard redirects to `/sign-in`.
3. User signs in (or completes sign-up, even across a force-quit — the code survives in SecureStore).
4. Once a session exists, `PendingJoinLink` replays the code into `/join-circle` (pre-filled) and clears the stash.
5. User confirms the code and joins as in workflow 5.

### 7. Switch the active circle
1. On the dashboard, tap the circle-name row (chevron) in the header.
2. The inline dropdown lists all circles (active one check-marked); tap a different circle.
3. `setActiveCircle` persists the choice and invalidates circle-scoped queries; the dashboard reloads for the newly selected circle. The choice persists per-user across app launches.
