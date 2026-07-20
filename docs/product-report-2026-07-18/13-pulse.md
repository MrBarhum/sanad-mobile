# The Pulse (Care Activity Feed / Sharing)

The Pulse («سجل النشاط» / "Activity Log", internally styled «نبض اليوم» / "Today's pulse") is a **read-only, chronological narrative of everything that has happened across a care circle** — every dose logged, task completed or cancelled, appointment outcome, family visit, vital reading, daily-log entry, and new member joining. It is the shared "what has the family been doing for the person we care for" story. Any **active** circle member may view it (the underlying `list_care_activity` RPC is member-gated server-side; there is **no** role branching and **no** actions that mutate anything from this screen — see `pulse.tsx:5-7`). Each row shows a per-type semantic icon, the actor's resolved display name, a gender-neutral verbal-noun (masdar) description, and a bidi-isolated time; tapping a row deep-links to the source item. The screen also offers a single **share** affordance that composes a plain-text "today's summary" for WhatsApp / the OS share sheet. The same feed data drives a compact 5-row strip on the Home dashboard.

---

## Screen: Care Pulse / Activity Log

- **Route & how reached**: `/pulse` (file `src/app/(app)/pulse.tsx`; registered header-less in `src/app/(app)/_layout.tsx:57`). Entry points:
  1. **Home dashboard** — the «نبض اليوم» strip's **«عرض الكل» / "View all"** link (`figma-home.tsx:789-791`, `router.push('/pulse')`).
  2. **Explore tab** — the "Care circle" group's first row, id `pulse`, titled `pulse.title` with subtitle `pulse.subtitle`, teal (`categoryTeal`) `activity` icon (`explore.tsx:117-124`).
- **Purpose**: A read-only, member-gated activity feed of what's happening across the care circle, newest first, with deep-links and a share-summary action.
- **Component composition**: `PulseScreen` wraps `FigmaPulse` in a `CircleGate` that resolves the active circle and passes `circleId` + `timezone`; `FigmaPulse` composes `FigmaScreen` (scrolling RTL container), `FigmaHeader` (back affordance), `SkeletonList` (loading), `Surface` (error card), `EmptyState` (empty), `GlyphChip` (per-row icon), plus bespoke share / row / load-more pressables.

### CircleGate wrapper (pre-screen gate)

Before `FigmaPulse` renders, `CircleGate` (`circle-gate.tsx`) resolves the active circle and renders one of:

| State | What shows | Copy (AR / EN) |
| --- | --- | --- |
| Loading | `LoadingState` — centered large spinner, no label | — |
| Error | `ErrorState` — `warning` GlyphChip (error tone) + message + a secondary **retry** button | message `careCircle.loadError`; button `retry` = «إعادة المحاولة» / "Retry" |
| No active circle | `EmptyState` with `members` glyph | `careCircle.noActiveCircle` |
| Resolved | `FigmaPulse` with the circle's id + timezone | — |

### Layout, top to bottom (`FigmaPulse`)

1. **Header** (`FigmaHeader`, `figma-pulse.tsx:75`): a round 44dp back pill on the start side (RTL: right) holding an `ArrowRight` glyph, accessibility label `common.back` = «رجوع» / "Back"; a centered title `pulse.title` = **«سجل النشاط» / "Activity Log"**; the trailing slot is an empty 44dp spacer (no add button — this screen creates nothing).
2. **Subtitle row** (`figma-pulse.tsx:76-88`): a horizontal row, space-between.
   - **Subtitle text** (secondary color): `pulse.subtitle` = **«آخر تحديثات دائرة الرعاية» / "Recent care circle activity"**.
   - **Share button** — *only rendered when there is at least one event* (`events.length > 0`). A pill (hairline border tinted from `primary` at 40% alpha) containing a `Share2` (14px, primary color) icon + label `pulse.share` = **«مشاركة ملخص اليوم» / "Share today's summary"**. `accessibilityRole="button"`, `accessibilityLabel` = same share string. Tapping composes and opens the share sheet (see below).
3. **Body** — one of five mutually-exclusive branches (loading / error / RPC-not-enabled / empty / populated), described under **All states**.

### Every interactive element

| Element | Label (AR / EN) | Icon | Behavior | Confirmation |
| --- | --- | --- | --- | --- |
| Back pill (header) | a11y «رجوع» / "Back" | `ArrowRight` (20px) | `router.back()` | none (navigation) |
| Share button (subtitle row) | «مشاركة ملخص اليوم» / "Share today's summary" | `Share2` (14px) | Composes today's summary text and opens OS share sheet / Web Share / clipboard | none (share, non-mutating) |
| Activity row (each event) | dynamic description (see Data shown) | per-type `GlyphChip` | `router.push(pulseRouteFor(item_type, item_id))` — deep-links to the source detail; a11y hint `common.details` = «التفاصيل» / "Details" | none (navigation) |
| Retry button (generic-error branch only) | «إعادة المحاولة» / "Retry" | none | `activity.refetch()` — solid `primary` fill, `onPrimary` text | none |
| Load-more button (when `events.length >= limit`) | «تحميل المزيد» / "Load more" | none (shows a small `ActivityIndicator` while fetching) | Increases the query limit by `PAGE` (20), refetching a larger page | none |

There are **no toggles, switches, chips, segmented controls, scope toggles («مهامي / كل المهام»), inline claim («أنا متكفّل»), form fields, or long-press/swipe actions** on this screen — it is purely a read + navigate + share surface. There is no period/date grouping control either (see Data shown for the implicit today-vs-earlier time formatting).

### All states

- **Loading** (`activity.isLoading`, `figma-pulse.tsx:90-91`): `SkeletonList` — 4 card-shaped skeletons, each a 44px pulsing circle + two text lines (70% then 45% width). Announced once as a progressbar/busy for screen readers; honors OS reduce-motion (holds a static 0.6 opacity instead of pulsing).
- **Generic error** (`activity.isError` and NOT a missing-RPC error, `figma-pulse.tsx:92-105`): a `Surface` card (tone `card`, `Radius.lg`, 20dp padding) with centered `errorFg` text `pulse.loadError` = **«تعذّر تحميل النشاط. حاول مرة أخرى.» / "Could not load activity. Please try again."** plus the **Retry** button.
- **RPC-not-enabled error** (`isMissingPulseRpc(error)` true — Postgres codes `PGRST202` / `42883`, or a message containing "does not exist" / "could not find the function", `present.ts:179-189`): same `Surface` card but text `pulse.notEnabled` = **«لم يتم تفعيل موجز النشاط بعد.» / "The activity feed isn't enabled yet."** and **no retry button** (retrying a missing migration would not help).
- **Empty** (no error, `events.length === 0`, `figma-pulse.tsx:106-107`): `EmptyState` with the feature icon `iconName="activity"` (neutral-tone GlyphChip, `lg`), title `pulse.empty` = **«يوم هادئ — لا جديد حتى الآن» / "A calm day — nothing new yet"**. No subtitle is passed. (Note: because the empty branch requires `events.length === 0`, the share button in the subtitle row is hidden in this state.)
- **Populated** (`figma-pulse.tsx:108-149`): the vertical list of activity rows (8dp gap), followed by the load-more button when more may exist.

**North-star copy note:** `pulse.shareEmpty` = **«يوم هادئ، لا جديد يُذكر اليوم.» / "A calm day — nothing to report today."** is the calm-day line used inside the **share text** (not the on-screen empty state). It appears when the share summary is generated on a day with no events (`present.ts:152-154`). The on-screen empty state uses the sibling `pulse.empty`.

### Data shown (per activity row)

Each row (`figma-pulse.tsx:110-134`) renders, in RTL order:

1. **A `GlyphChip`** (size `md`, 44dp) tinted with a per-type category color, holding the per-type icon. Mapping (`present.ts:15-34`):

| `event_type` | Icon | Color key | Description key (AR / EN) |
| --- | --- | --- | --- |
| `dose_logged` (status `given`/default) | `medication` | `categoryTeal` | `pulse.events.doseGiven` = «{{actor}} · تسجيل جرعة {{title}}» / "{{actor}} · Dose recorded: {{title}}" |
| `dose_logged` (status `postponed`) | `medication` | `categoryTeal` | `pulse.events.dosePostponed` = «{{actor}} · تأجيل جرعة {{title}}» / "{{actor}} · Dose postponed: {{title}}" |
| `dose_logged` (status `missed`) | `medication` | `categoryTeal` | `pulse.events.doseMissed` = «{{actor}} · جرعة فائتة: {{title}}» / "{{actor}} · Missed dose: {{title}}" |
| `task_completed` | `success` | `categoryGreen` | `pulse.events.taskCompleted` = «{{actor}} · إكمال مهمة: {{title}}» / "{{actor}} · Task completed: {{title}}" |
| `task_cancelled` | `close` | `categoryGold` | `pulse.events.taskCancelled` = «{{actor}} · تعذّر إكمال مهمة: {{title}}» / "{{actor}} · Task not completed: {{title}}" |
| `appointment_outcome` (default) | `appointment` | `categoryPurple` | `pulse.events.appointmentCompleted` = «{{actor}} · نتيجة موعد: {{title}}» / "{{actor}} · Appointment outcome: {{title}}" |
| `appointment_outcome` (status `cancelled`) | `appointment` | `categoryPurple` | `pulse.events.appointmentCancelled` = «{{actor}} · إلغاء موعد: {{title}}» / "{{actor}} · Appointment cancelled: {{title}}" |
| `visit_completed` | `visit` | `categoryGreen` | `pulse.events.visitCompleted` = «{{actor}} · زيارة عائلية» / "{{actor}} · Family visit" |
| `vital_recorded` | `vital` | `categoryBlue` | `pulse.events.vitalRecorded` = «{{actor}} · تسجيل {{vital}}» / "{{actor}} · Recorded {{vital}}" |
| `daily_log_added` | `dailyLog` | `categoryGreen` | `pulse.events.dailyLogAdded` = «{{actor}} · إضافة سجل يومي» / "{{actor}} · Daily log added" |
| `member_joined` | `member` | `categoryGold` | `pulse.events.memberJoined` = «{{actor}} · انضمام إلى الدائرة» / "{{actor}} · Joined the circle" |

2. **Description text** (`text` color, semibold, 2-line clamp): the localized `{{actor}} · {phrase}` line (`pulseDescription`, `present.ts:65-109`). Key resolution details a designer should know:
   - `{{actor}}` is resolved via `usePulseActorLabel` (`present.ts:119-134`): looks the `actor_user_id` up in the circle roster and formats with `memberDisplayName()` (full name → email local-part → neutral). If there is **no** actor id → `pulse.someone` = **«أحد الأعضاء» / "A member"**. If the actor left the roster → their stored `actor_name`, else `assignment.inactiveMember` = **«عضو سابق» / "Former member"**. It **never** returns first-person «أنا» — even the current user reads by their real name, keeping headlines gender/person-neutral.
   - `{{title}}` comes from the event's `title` (medication / task / appointment name).
   - **Visit** rows: when the visitor has no linked account, the visitor's name is carried in `title` and used as the actor; a linked visitor keeps their roster name (`present.ts:90-96`).
   - **Vital** rows: `{{vital}}` is the reading type localized through the shared `vitals.type.*` labels (e.g. `blood_pressure` → «ضغط الدم» / "Blood pressure", `heart_rate` → «النبض» / "Heart rate", `temperature` → «الحرارة» / "Temperature", `blood_sugar` → «سكر الدم» / "Blood sugar", `oxygen_saturation` → «تشبّع الأكسجين» / "Oxygen saturation", `weight` → «الوزن» / "Weight", `other` → «أخرى» / "Other"), falling back to the raw type for an unknown value.
3. **Time text** (`textSecondary`, regular): `whenLabel(occurred_at)` (`figma-pulse.tsx:61-67`) — computed in the **circle's** timezone. If the event's date equals today's circle-local date → just the LTR-isolated `HH:MM`. Otherwise → `«{ymd} · {hm}»` (LTR-isolated date, a «·» meta separator, LTR-isolated time). This date-vs-time formatting is the only implicit "grouping"; there are no explicit period headers or section dividers.

Status is conveyed as **icon + text + color together** (never color alone) — the dose/appointment/task status shifts both the icon color tone and the verbal noun, per the standing "status is never color-only" decision.

### Cross-links (deep-links opened on row tap)

`pulseRouteFor(item_type, item_id)` (`present.ts:37-54`):

| `item_type` | Route |
| --- | --- |
| `medication` | `/medications/{id}` |
| `task` | `/tasks/{id}` |
| `appointment` | `/appointments/{id}` |
| `visit` | `/visits/{id}` |
| `vital` | `/vitals/{id}` |
| `daily_log` | `/daily-logs/{id}` |
| `member` | `/circle-members` (list, not a per-id detail) |

### Data source & paging behavior

- Data comes from the `list_care_activity` RPC (`api.ts`), member-gated server-side, returning the newest `limit` events first. The migration (`20260715130000`) is applied in the DB but intentionally **not** in the generated Supabase types this phase, so `api.ts` is the single place that casts around the typed client (`api.ts:11-23`).
- The screen starts at `limit = PAGE = 20` (`figma-pulse.tsx:29,44`). "Load more" raises the limit by 20 each tap; `keepPreviousData` (via the query hook) avoids a spinner flash while the larger page loads. `canLoadMore` is `events.length >= limit` (`figma-pulse.tsx:59`) — a heuristic that shows the button whenever the last page was full.
- **Refetch on focus**: returning to the screen refetches (`useFocusEffect`, `figma-pulse.tsx:52-56`) so acting elsewhere reconciles the feed; mutations across the app also invalidate the `['pulse']` query key so an in-place action appears immediately. There is **no** pull-to-refresh.

---

## Related surface: Home «نبض اليوم» strip (entry point, not a separate screen)

A compact preview of this feed lives on the Home dashboard (`figma-home.tsx:733-816`, component doc at `:734`). It is documented here because it is the primary entry point and shares all the Pulse presenters.

- **Header row**: section label `pulse.sectionTitle` = **«نبض اليوم» / "Today's pulse"** (secondary color, regular). Trailing actions:
  - A **share icon** — bare `Share2` (16px, primary), a11y label `pulse.share`; composes and shares the same today-summary text.
  - A **«عرض الكل» / "View all"** (`pulse.viewAll`) link → `router.push('/pulse')`.
- **Rows**: up to **5** events, scoped to **today** in the circle's local day. It fetches a 20-row buffer (`HOME_PULSE_FETCH = 20`), filters to today, then `slice(0, 5)` (`HOME_PULSE_MAX = 5`) — a future-dated event can't squeeze out a real today event (`figma-home.tsx:750-771`). Each row reuses `pulseEventVisual` + `pulseDescription` + `pulseRouteFor`; the time shows just the LTR-isolated `HH:MM` (all rows are today). Row description font here is **medium** (vs semibold on the full screen).
- **Quiet by design**: the strip renders **nothing** while loading, on error, when the RPC isn't enabled, or when there are no events today (`figma-home.tsx:773`) — a calm day, or a not-yet-migrated backend, never shows an error on Home.

---

## Workflows

### 1. View the full care activity feed
1. From Home, tap **«عرض الكل» / "View all"** on the «نبض اليوم» strip — OR open the **Explore** tab and tap the **«سجل النشاط» / "Activity Log"** row in the "Care circle" group.
2. `CircleGate` resolves the active circle (spinner → feed, or a circle error/empty).
3. The feed loads newest-first (skeleton → rows). Read each row: icon + actor name + what they did + when.
4. Scroll to the bottom and tap **«تحميل المزيد» / "Load more"** to fetch the next 20 events (button hidden once a short page returns).

### 2. Open the source of an activity event
1. In the feed (or the Home strip), tap any activity row.
2. The app deep-links to that item's detail: a medication, task, appointment, visit, vital, daily log, or (for a member-joined event) the circle-members list.
3. Act on it there if you wish; on returning to the Pulse the feed refetches on focus and reflects any change.

### 3. Share today's care summary (WhatsApp / OS share sheet)
1. On the Pulse screen (with at least one event present) tap **«مشاركة ملخص اليوم» / "Share today's summary"** — or on Home tap the small **share icon** in the «نبض اليوم» header.
2. The app builds a plain-text summary client-side from the already-loaded events (`composePulseShareText`, `present.ts:143-157`): a dated header `pulse.shareHeader` = «نبض اليوم — {{date}}» / "Today's pulse — {{date}}", then one **bullet line per today event** using the same named, gender-neutral masdar descriptions.
3. If there are no events for today, the body is the calm north-star line `pulse.shareEmpty` = **«يوم هادئ، لا جديد يُذكر اليوم.» / "A calm day — nothing to report today."**
4. The OS share sheet opens (native `Share.share`) — or on web, the Web Share API, falling back to copying the text to the clipboard (`sharePulseSummary`, `present.ts:160-176`). Pick WhatsApp (or any target) and send.

### 4. Recover from a load error
1. If the feed shows **«تعذّر تحميل النشاط. حاول مرة أخرى.» / "Could not load activity. Please try again."**, tap **«إعادة المحاولة» / "Retry"** to refetch.
2. If instead it shows **«لم يتم تفعيل موجز النشاط بعد.» / "The activity feed isn't enabled yet."**, there is no retry — the backend RPC/migration hasn't been applied; this is a maintainer/runbook step, not a user action.
