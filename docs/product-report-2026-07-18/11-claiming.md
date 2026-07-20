# Claiming & Available-to-Claim

Sanad follows a **transparent-visibility posture**: every *active* member can *see* all of a circle's operational work (tasks, doses/medications, appointments, visits), mirroring the server's `can_view_all_operational` policy. Visibility is never hidden by role — only *mutation* is gated by role + RLS. On top of that transparency sits **claiming**: any *claim-capable* member (a manager or a caregiving "doer") can take responsibility for a piece of **unowned** open work with one tap («أنا متكفّل» / "I'll take it"). Claiming atomically fills the item's responsibility/assignee column with the caller's user id server-side, so the item leaves the shared "available" pool and moves into that person's own screens. This section documents the dedicated **Available-to-Claim** screen, the **inline claim** affordance that lives on the tasks list, the **assignment picker** used to (re)assign work, and the system-level mine/all scope model that makes transparency workable.

---

## System model: transparent visibility, scope, and who can claim

**Roles (`src/features/circle-selection/permissions.ts`).** Two derived capability flags carried on the `ActiveCircle` object drive every claim gate:

| Flag | True for roles | Meaning |
| --- | --- | --- |
| `canManage` | `admin`, `primary_caregiver` | May mutate circle data (mirrors every RLS manager check). |
| `canLogDoses` | `admin`, `primary_caregiver`, `family_member`, `caregiver` | May record/confirm care activity. |

- **Claim-capable = `canManage || canLogDoses`** (`available-to-claim.tsx:16`). In practice this is admin, primary_caregiver, family_member, or caregiver. `remote_member` and `elder` are **read-only followers**: they can *see* work (transparent posture) but never claim it. The Home entry point is hidden for them (`figma-home.tsx:473`), the screen shows a "not allowed" empty state if reached, and the RPC rejects them server-side (SQLSTATE `42501`).
- **Assignable "doers" (`member-assignment.tsx:28`)** — a *narrower* set than claim-capable — are the only members offered as assignees in the picker: `admin`, `primary_caregiver`, `family_member`. `caregiver`, `remote_member`, and `elder` are intentionally excluded from being *assigned to* (a caregiver can *claim* but is not offered in the assignee chip list; the two lists differ by design).

**Scope model (mine / all).** Because everyone can see everything, lists don't hide other members' work — they offer an explicit **«مهامي» / «كل المهام»** (mine / all) toggle. Managers default to «all»; collaborators default to «mine»; pure followers have no "mine" set and only ever see «all». Unowned open items surface an inline **«أنا متكفّل»** claim for any claim-capable member. The tasks list is the canonical implementation (`figma-tasks.tsx:109-127`); the Available-to-Claim screen is the cross-feature aggregation of *only* the unowned slice.

**`assignment` copy** (`ar.json` / `en.json` lines 599–610), shared by every assignee display across features:

| Key | Arabic | English |
| --- | --- | --- |
| `assignment.responsible` | المسؤول | Responsible |
| `assignment.label` | تعيين إلى | Assign to |
| `assignment.none` | غير محدد | Unassigned |
| `assignment.me` | أنا | Me |
| `assignment.assignedToMe` | معيّن لي | Assigned to you |
| `assignment.inactiveMember` | عضو سابق | Former member |
| `assignment.unknownMember` | عضو | Member |
| `assignment.unassigned` | غير مسند | Unassigned |
| `assignment.responsibleValue` | المسؤول: {{value}} | Responsible: {{value}} |
| `assignment.nameWithRole` | {{name}} - {{role}} | {{name}} - {{role}} |

---

## Screen: Available to Claim («متاح للتكفّل»)

- **Route & how reached:** `/available-to-claim` (`src/app/(app)/available-to-claim.tsx`). Reached from the **Home dashboard** via a dedicated "Available to claim" card (`figma-home.tsx:472-493`), which is rendered **only** when `circle.canManage || circle.canLogDoses`. Read-only followers never see the entry.
- **Wrapper:** The route wraps `FigmaAvailableToClaim` in `<CircleGate>` (`circle-gate.tsx`), which resolves the active circle and renders shared loading/error/no-circle states before handing `circleId` + `canClaim` to the screen.
- **Purpose:** A single unified feed of *unowned* care items — open unassigned tasks, active medications with no responsible person, scheduled unassigned appointments, planned unlinked visits — that a claim-capable member can take on in one tap.

### Layout, top to bottom (`figma-available-to-claim.tsx`)

1. **Header** — `FigmaHeader` with title `claiming.title` = **«متاح للتكفّل» / "Available to claim"**. FigmaHeader renders a round 44dp back pill (ArrowRight glyph, `common.back`) at the start, a centered title, and — since no `onAdd` is passed — an empty spacer at the end (no add button on this screen).
2. **Body** — one of five mutually exclusive states (see below).
3. **`ClaimFeedbackSheet`** — a bottom-anchored result sheet mounted outside the scroll area, visible at any scroll position.

### States

| State | Condition | What renders |
| --- | --- | --- |
| **Not allowed** | `!canClaim` | `EmptyState` with `iconName="claim"` and title `claiming.notAllowed` = **«التكفّل غير متاح لدورك» / "Claiming isn't available for your role"**. (Defensive — the entry is already hidden for these roles.) |
| **Loading** | `feed.isLoading` | `SkeletonList` placeholder rows. |
| **Error** | `feed.isError` | A `Surface` (tone `card`, radius `lg`, 20dp padding) with centered `errorFg` text `claiming.loadError` = **«تعذّر تحميل العناصر المتاحة. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load available items. Check your connection and try again."** plus a primary-filled **«إعادة المحاولة» / "Retry"** (`retry`) button that refetches. In `__DEV__` the query error is also `console.error`-logged (no secrets). |
| **Empty** | `items.length === 0` | `EmptyState` with `iconName="claim"` and title `claiming.empty` = **«لا عناصر بانتظار من يتكفّل بها الآن» / "Nothing is waiting for someone to take it on right now"**. No subtitle. |
| **Populated** | items present | Grouped sections (below). |

Data auto-refreshes on screen focus via `useFocusEffect` (the screen is a plain ScrollView with no pull-to-refresh), so a just-claimed or just-freed item reconciles when returning.

### Populated layout — sections

Items are grouped into **four fixed sections in canonical feature order** (`figma-available-to-claim.tsx:32-37`); a section only renders when it has ≥1 item. Each section header is a row of: a 16dp lucide icon in the section's category color, a bold label, and a muted LTR-isolated count.

| Section | Label key | Arabic / English | Header icon | Category color | Card GlyphChip icon |
| --- | --- | --- | --- | --- | --- |
| Tasks | `claiming.sections.tasks` | مهام / Tasks | `ListChecks` | `categoryBlue` | `task` |
| Medications | `claiming.sections.medications` | أدوية / Medications | `Pill` | `categoryTeal` | `medication` |
| Appointments | `claiming.sections.appointments` | مواعيد / Appointments | `Calendar` | `categoryPurple` | `appointment` |
| Visits | `claiming.sections.visits` | زيارات / Visits | `Users` | `categoryGreen` | `member` |

### Claim card (`ClaimCard`, `figma-available-to-claim.tsx:239`)

Each item is a `Surface` (tone `card`, radius `xl`, 16dp padding) laid out as:

- **Top row:** a `GlyphChip` (size `md`) in the section's icon + category color, then an info column:
  - **Title** — `item.title`, bold 16, up to 2 lines.
  - **When meta** (only if the item has a date/time) — a 13dp `Clock` icon + LTR-isolated text. For appointments: `scheduled_at` rendered as `YYYY-MM-DD، HH:MM`. For tasks (`due_date`/`due_time`) and visits (`visit_date`/`start_time`): the date, plus `، HH:MM` when a time exists (`whenText()`, lines 227-237).
  - **Subtitle** (only if present) — `item.subtitle`, muted, 1 line. The server returns only safe display fields (title/subtitle) — no descriptions, instructions, notes, or doctor.
- **CTA button** — the shared `Button` with label `claiming.cta` = **«أنا متكفّل» / "I'll take it"**, icon `claim` (Ionicons `hand-left-outline`), accessibility hint `claiming.ctaHint` = **«تكفّل بهذا العنصر ليصبح من مسؤوليتك» / "Take responsibility for this item"**. Shows a spinner (`loading`) while that specific item is pending.

**Data available per item** (`types.ts` — `AvailableClaimItem`): `item_type`, `item_id`, `circle_id`, `title`, `subtitle`, `category`, `priority`, `scheduled_at` (appointments), `date_value` (task due_date / visit_date), `time_value` (task due_time / visit start_time), `status`, `created_at`. (Only title/subtitle/date are surfaced in the current card; category/priority are carried but not displayed.)

### The claim interaction (confirmation pattern)

Tapping the CTA runs `onClaim` → **`confirmAction()`** (the lightweight cross-platform prompt — one of the three sanctioned confirmation patterns). Confirm copy:

- **Title:** `claiming.confirmTitle` = **«التكفّل بهذا العنصر؟» / "Take responsibility for this?"**
- **Message:** `claiming.confirmMessage` = **«سيصبح «{{title}}» من مسؤوليتك.» / "\"{{title}}\" will become your responsibility."** (item title interpolated).
- **Confirm button:** `claiming.cta` = **«أنا متكفّل» / "I'll take it"**
- **Cancel button:** `common.cancel` = **«إلغاء» / "Cancel"**

Only one claim runs at a time (`pendingId` guard). On accept, `runClaim` calls the `useClaimItem` mutation, which dispatches to the RPC matching the item type (`claim_care_task`, `claim_medication_responsibility`, `claim_care_appointment`, `claim_family_visit`) and, on success, invalidates the feed plus the `tasks` / `appointments` / `medications` / `visits` query roots so the item drops here and appears in the owner's own screens.

### Result feedback (`ClaimFeedbackSheet`)

Claim results appear in a **bottom-anchored `FigmaBottomSheet`** (canonical sheet chrome: rounded-top `backgroundElement` card, grab handle, title, slide-up over a scrim, backdrop-tap to dismiss). The sheet's title is the result title; its body is a row of a tinted 44dp round chip (icon in the tone color at 12% alpha) + a body line, announced with `accessibilityRole="alert"` / assertive live region, then a large dismiss button. Status is **icon + text + color**, never color-only.

| Outcome | Tone / icon | Title | Body | Dismiss button |
| --- | --- | --- | --- | --- |
| **Success** | `successFg` / `Check` | `claiming.claimSuccess` = **«تم التكفّل بهذا العنصر» / "You've taken responsibility for this item"** | `claiming.claimSuccessBody` = **«سيظهر الآن ضمن العناصر المسندة إليك» / "It will now appear in your assigned items"** | `common.ok` = «حسنًا» / "OK", **primary** variant |
| **Already claimed** (RPC error code `23505`) | `warningFg` / `AlertCircle` | `claiming.alreadyClaimed` = **«تم التكفّل بهذا العنصر من شخص آخر» / "Someone else already claimed this item"** | `claiming.alreadyClaimedBody` = **«تم تحديث القائمة لإزالة العنصر» / "The list has been refreshed to remove it"** | `common.ok`, **secondary** variant |
| **Failure** (any other error) | `errorFg` / `AlertCircle` | `claiming.claimFailed` = **«تعذّر التكفّل بهذا العنصر. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't take on this item. Check your connection and try again."** | (none) | `common.ok`, **secondary** variant |

On the "already claimed" race, the feed is refetched so the stale item disappears.

### Components used

`CircleGate`, `FigmaScreen`, `FigmaHeader`, `Surface`, `GlyphChip`, `EmptyState`, `SkeletonList`, `Button`, `FigmaBottomSheet`, lucide icons (`ListChecks`, `Pill`, `Calendar`, `Users`, `Clock`, `Check`, `AlertCircle`), `isolateLtr` for LTR-isolated dates/counts.

### Cross-links

Claiming an item makes it appear in that feature's own screen (tasks list, today's doses, appointments, visits). No detail/sub-screen is opened from this feed — the card CTA is the only action; the card body itself is not tappable to detail.

---

## Inline claim affordance («أنا متكفّل» on the tasks list)

- **Where:** The tasks list (`src/features/tasks/figma-tasks.tsx`), inside each `TaskRow`. It lets a claim-capable member take an unassigned open task **without leaving the list or visiting the Available-to-Claim screen**.
- **Visibility gate (`figma-tasks.tsx:408`):** `showClaim = canClaim && unassigned && task.status === 'open'` — i.e. the row's task has no assignee and is still open, and the viewer is claim-capable (`canManage || canCollaborate`). Hidden the moment the task has an owner.
- **Appearance:** A filled teal pill (`c.primary` background) below the task meta row, containing a 14dp `HandHelping` icon + the label `claiming.cta` = **«أنا متكفّل» / "I'll take it"** in `onPrimary`. While claiming, the pill shows an `ActivityIndicator` in place of icon+label. Accessibility label = `claiming.cta`, hint = `claiming.ctaHint`.
- **Confirmation:** Identical `confirmAction()` prompt as the feed (same `claiming.confirmTitle` / `confirmMessage` with the task title / `cta` / `common.cancel`).
- **Mutation:** `useClaimTask` (`hooks.ts:46`) → `claim_care_task` RPC, invalidating the available-to-claim feed and `tasks`. A single `claimingId` guards against double taps.
- **Result feedback:** Unlike the feed screen, a **successful** inline claim shows **no sheet** — the row simply re-renders as "assigned to me" (or moves into «مهامي» when the invalidated query resolves). Only race/failure surfaces a `ClaimNoteSheet` (a `FigmaBottomSheet`, `figma-tasks.tsx:299`):
  - **Already claimed** (`23505`): title `claiming.alreadyClaimed`, body `claiming.alreadyClaimedBody`, warning tone.
  - **Failure**: title `claiming.claimFailed`, no body, error tone.
  - Dismiss button `common.ok`, secondary variant; body announced as an alert.

Note: This inline affordance appears regardless of the task's `assigned_to` being unassigned; but note that a non-manager collaborator can *act on* (complete/cancel) only tasks already assigned to themselves — claiming is how they take ownership first (`canActOn`, `figma-tasks.tsx:142-147`).

---

## Assignment picker (`MemberSelect`) & responsibility resolvers

File: `src/features/circle-members/member-assignment.tsx`. This is the shared assignee UI reused by tasks, appointments, medications, and visits forms — the manager-facing counterpart to claiming (explicit assignment vs. self-claim).

### `MemberSelect` component

- **Purpose:** A single-choice assignee picker over the circle roster. `value` is the assigned user id, or `NO_ASSIGNEE` (`''`) for unassigned.
- **Layout:** A muted group label (defaults to `assignment.label` = **«تعيين إلى» / "Assign to"**, overridable via `label` prop) above an `OptionSelect` chip group (single-select radio pills — teal tint + leading check on the selected chip; see `option-select.tsx`).
- **Options built by `buildOptions` (lines 54-88), in order:**
  1. **No assignment** — always first — label `assignment.none` = **«غير محدد» / "Unassigned"** (value `''`).
  2. **Me** — only when the current user is an active doer — label `assignment.me` = **«أنا» / "Me"**.
  3. **Every other active doer** — by `memberDisplayName()` (full name → email local-part → the neutral fallback `assignment.unknownMember` = «عضو» / "Member").
  4. **A stale current assignee** — if the stored value is a member who is no longer an active doer (role changed / left), it is still appended so the assignment stays visible and is never silently dropped. An inactive member is suffixed with `(assignment.inactiveMember)` = «(عضو سابق)» / "(Former member)".
- **Assignable roles (`DOER_ROLES`, line 28):** only active `admin`, `primary_caregiver`, `family_member`. A member must be `active` and have a self/name/email identity (`isAssignableDoer`, line 39).

### Read-only resolvers (same file)

- **`useMemberLookup(circleId)`** → maps a stored user id to a `ResolvedMember` (`label`, `isSelf`, `isInactive`, `role`, `roleLabel`). Self → `assignment.me` («أنا»); an active member → full name; an unknown/removed id → `assignment.unknownMember` («عضو») — never an email, to avoid leaking it on broadcast surfaces; a null id → `null` (unassigned). Used e.g. by the tasks list to render another member's name on a row.
- **`useResponsibleLabel(circleId)`** → a single localized line for manager read-only surfaces: unassigned → `assignment.unassigned` = «غير مسند» / "Unassigned"; self → «المسؤول: أنا»; another member → «المسؤول: {name} - {role}» via `assignment.responsibleValue` + `assignment.nameWithRole`.

### Components used

`OptionSelect` (chip variant), `memberDisplayName`, `useCircleMembers`, theme tokens.

---

## Supporting data module: `care-activity/today.ts`

`src/features/care-activity/today.ts` is a pure client-side summarization module (no UI) shared by the dashboard cards and feature centers. It computes deterministic "today" counts using the device's local calendar: `summarizeTodayTasks` (dueToday / completedToday / openTotal), `countAppointmentsToday`, `countVisitsToday`, `summarizeTodayLogs` (todayCount + latest mood), `summarizeVitals` (total / today / latest type). It is **not** claiming-specific — it feeds the Home "today" glance rows that sit near the claim entry, and is included here only because it lives in the care-activity domain. No claim logic here.

---

## Workflows

### 1. Claim an unowned item from the Available-to-Claim screen
1. On **Home**, a claim-capable member (admin / primary_caregiver / family_member / caregiver) sees the gold-tinted **«متاح للتكفّل»** card («عناصر بلا مسؤول — يمكنك التكفّل بها» / "Unassigned items you can take on") and taps it.
2. The `/available-to-claim` screen loads the cross-feature feed of unowned items, grouped into Tasks → Medications → Appointments → Visits.
3. The member finds an item and taps **«أنا متكفّل»** on its card.
4. A `confirmAction` prompt appears: **«التكفّل بهذا العنصر؟» — «سيصبح «{title}» من مسؤوليتك.»** with «أنا متكفّل» / «إلغاء».
5. On confirm, the matching RPC atomically sets the responsibility column to the caller.
6. A success sheet slides up: **«تم التكفّل بهذا العنصر» — «سيظهر الآن ضمن العناصر المسندة إليك»**; the member taps «حسنًا».
7. The feed invalidates: the item disappears here and now appears in the member's own tasks/doses/appointments/visits screen.

### 2. Claim an unassigned task inline (without opening the claim screen)
1. On the **Tasks** list, a claim-capable member views an open task showing «غير مُسندة» (unassigned).
2. Below the task meta, the filled teal **«أنا متكفّل»** pill is visible; the member taps it.
3. Same `confirmAction` prompt (with the task title). On confirm, `claim_care_task` runs.
4. **No success sheet** — the row re-renders as «مُسندة إليك» (assigned to you), and if the scope toggle is on «مهامي» the task moves into that view once the query invalidates.

### 3. Race — someone else claims first
1. Two members open the same unowned item; both tap «أنا متكفّل» and confirm.
2. The first claim wins; the second RPC returns error code `23505`.
3. The loser sees a **warning** sheet: **«تم التكفّل بهذا العنصر من شخص آخر» — «تم تحديث القائمة لإزالة العنصر»**, the feed refetches, and the item is gone.

### 4. Read-only follower reaches the claim surface
1. A `remote_member` / `elder` has no claim entry on Home (hidden by the `canManage || canLogDoses` gate) and cannot claim inline.
2. If the `/available-to-claim` route is reached directly, `canClaim` is false → the screen shows **«التكفّل غير متاح لدورك» / "Claiming isn't available for your role"**; the RPC would also reject them (`42501`).

### 5. Manager assigns work explicitly (the assignment-picker counterpart)
1. On a task/appointment/medication/visit form, a manager sees `MemberSelect` under **«تعيين إلى»**.
2. The chips list «غير محدد» first, then «أنا» (if the manager is an active doer), then each active doer by name.
3. The manager taps a member's chip; the stored assignee updates. That item is now owned and no longer surfaces in the Available-to-Claim feed or as an inline claim.

### 6. Toggle scope (mine / all) to reveal claimable work
1. A collaborator opens the **Tasks** list, defaulted to **«مهامي»** (their own tasks only).
2. They tap **«كل المهام»** in the scope segmented control to see the whole circle's tasks (transparent posture).
3. Unassigned open tasks now show the inline «أنا متكفّل» pill, letting them take one on directly (Workflow 2).
