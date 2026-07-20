# Family Visits

The Family Visits domain lets a care circle plan, record, and track in-person family visits to the person receiving care. It is a lightweight, non-medical coordination tool (its disclaimer states it is "for organizing and coordinating family visits only" — no medical advice). A visit carries a **visitor name**, a **date**, an **optional start/end time window**, optional **notes**, an optional **link to a member's account** (which drives who may edit/delete it), and a lifecycle **status** (planned → completed / cancelled). The domain is three Expo-Router screens under `/visits`: a **list center** with Upcoming/Recent tabs (`figma-visits.tsx`), an **add form** (`visit-form.tsx`), and a **detail/editor** that branches into manager-edit vs. read-only view (`visit-editor.tsx`). Visibility and mutation are role-gated: managers (admin / primary caregiver) see and edit everything; collaborators (family member / caregiver) see only visits linked to their own account and may only record the outcome; read-only members see all visits but get no action affordances.

Role vocabulary used throughout this section (from `src/features/circle-selection/permissions.ts`):
- **`canManage`** — `role === 'admin' || 'primary_caregiver'`. Full edit, relink, delete, reopen.
- **`canCollaborate`** / `canLogDoses` — `admin | primary_caregiver | family_member | caregiver`. May add a visit and mark the outcome on their own linked visit.
- A **collaborator** in this doc = `canCollaborate && !canManage` (family_member / caregiver). Their visits are scoped to "mine".
- A **read-only** member = neither flag (e.g. remote_member / elder). Sees the list; no add, no edit.

All three screens are wrapped in `CircleGate` (`src/features/care-circle/circle-gate.tsx`), which renders the shared `LoadingState` (spinner) while the active circle resolves, an `ErrorState` ("careCircle.loadError" + Retry) on failure, and an `EmptyState` ("careCircle.noActiveCircle") when the user has no active circle — before any visit UI shows.

---

## Screen 1 — Family Visits center (list)

- **Route & how reached**: `/visits` (`src/app/(app)/visits/index.tsx` → `FigmaVisits`). Reached from the Home dashboard's visits quick-action / summary card and from the Explore/features list (canonical feature order places visits after vitals). The nested stack (`_layout.tsx`) anchors back-navigation here (`initialRouteName: 'index'`).
- **Purpose**: Browse the circle's family visits, split into Upcoming and Recent, and jump into add or detail.
- **Component**: `FigmaVisits` (`src/features/visits/figma-visits.tsx`), rendered inside `FigmaScreen`.

### Layout, top to bottom

1. **Header** (`FigmaHeader`): a round 44dp back pill (start; RTL `ArrowRight` = back), a centered bold title **«الزيارات العائلية» / "Family visits"** (`figma.visits.title`), and — only when `canAdd` (`canManage || canCollaborate`) — a round teal **"+"** add button (end) with `accessibilityLabel` **«إضافة زيارة» / "Add visit"** (`visits.add`). Read-only members see an empty spacer instead of the add button. Tapping "+" navigates to `/visits/new`. (figma-visits.tsx:110-114)
2. **Segmented tabs** (`FigmaSegmentedTabs`): two equal-width, ≥44dp pills — **«القادمة» / "Upcoming"** (`figma.visits.tabs.upcoming`) and **«السابقة» / "Recent"** (`figma.visits.tabs.recent`). Active tab = filled teal + on-primary text; inactive = card fill + hairline border + secondary text. Default active tab is `upcoming`. (figma-visits.tsx:103-116)
3. **Body**: loading, error, empty, or the card list (see States).

### Data & bucketing logic

- Source is `useVisits(circleId)` → `fetchVisits` (all circle visits, ordered `visit_date` desc then `created_at` desc). (api.ts:31-41)
- **Scope-to-mine**: `scopeToMine = !canManage && canCollaborate`. Collaborators see only visits where `visitor_user_id === userId`; managers and read-only members see all. This is UI scoping only (RLS unchanged). (figma-visits.tsx:87-90)
- **Upcoming** bucket = `visit_date >= today` (today included), sorted ascending by `${visit_date} ${start_time ?? '99:99:99'}` (visits with no start time sort last within a day). **Recent** = `visit_date < today`, sorted descending by the same key. (figma-visits.tsx:88-99)
- `filtered` = the current tab's list.

### Visit card (each row) — `VisitCard`

Rendered as a `Surface` (tone `card`, `Radius.xl`, 16dp padding), tappable (`onPress` → `/visits/${id}`), with `accessibilityLabel` = the visitor name and `accessibilityHint` **«التفاصيل» / "Details"** (`common.details`). (figma-visits.tsx:184-229)

Card top row:
- **Identity chip** (`GlyphChip`, `iconName="member"`, size `md`) whose accent color cycles by list index through `categoryBlue → categoryPurple → categoryGreen → categoryGold` (purely decorative variation).
- **Title**: the visitor name (`visit.visitor_name`), up to 2 lines, bold 16.
- **Subtitle**: static type label **«زيارة عائلية» / "Family visit"** (`figma.visits.visitorLabel`), 1 line, secondary.
- **Status pill** (`StatusBadge`), shown **only** when status ≠ `planned`: `completed` → success tone; `cancelled` → error tone. Label from `visits.status.<status>` (**«تمّت» / "Completed"**, **«ملغاة» / "Cancelled"**). Planned visits show no pill on the card. Status is icon+tone+text, never color-only. (figma-visits.tsx:41-44, 202-204)

Card meta list (below top row):
- **When row**: `Clock` icon (13px) + LTR-isolated date/time. Text = `visit_date` alone, or `«{date}، {start} – {end}»` when times exist (either time may be present; both join with an en-dash). (figma-visits.tsx:174-180, 207-211)
- **Second meta row** (conditional):
  - If the visit is **mine** (`visitor_user_id === userId`): `Home` icon + **«زيارتك» / "Your visit"** (`visits.mineLabel`).
  - Else if the visit is linked to **another** member: `Users` icon + that member's display name (resolved via `useMemberLookup`; falls back to «عضو» / "Member" for unknown ids, never an email).
  - Else (unlinked): no second row. (figma-visits.tsx:212-226)

### States

| State | Rendering | Copy |
|---|---|---|
| **Loading** | `SkeletonList` placeholder | — |
| **Error** | `Surface` card with alert text (`errorFg`) + a teal **Retry** pill that calls `refetch()` | Body: **«تعذّر تحميل الزيارات. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load visits. Check your connection and try again."** (`visits.loadError`); button **«إعادة المحاولة» / "Retry"** (`retry`) (figma-visits.tsx:120-129) |
| **Empty — Upcoming tab** | `EmptyState` card, `iconName="visit"` | Title: **«لا زيارات قادمة — لا شيء مُخطَّط بعد» / "No upcoming visits — nothing planned yet"** (`figma.visits.emptyUpcoming`). No subtitle. |
| **Empty — Recent tab** | `EmptyState` card, `iconName="visit"` | Title: **«لا توجد زيارات سابقة» / "No recent visits"** (`figma.visits.emptyRecent`). No subtitle. |
| **Populated** | `View` with 12dp-gap list of `VisitCard`s | — |

> Note: there is **no** "mine / all" scope toggle on this screen and no inline «أنا متكفّل» claim — visit scoping is implicit by role (collaborators are silently limited to their own linked visits). The `visits.*Title` / `no*Title` / `no*Subtitle` keys (todayTitle, upcomingTitle, noTodaySubtitle, etc.) exist in i18n but belong to an older three-bucket "VisitsCenter"; the shipping Figma list uses only the two `figma.visits.*` tab/empty keys.

### Components used
`FigmaScreen`, `FigmaHeader`, `FigmaSegmentedTabs`, `SkeletonList`, `Surface`, `GlyphChip`, `StatusBadge`, `EmptyState`, `isolateLtr`. Hooks: `useVisits`, `useMemberLookup`, `useAuth`, `useTheme`.

### Cross-links
- "+" → **Add visit** (`/visits/new`).
- Card tap → **Visit detail** (`/visits/[id]`).

---

## Screen 2 — Add a visit (form)

- **Route & how reached**: `/visits/new` (`src/app/(app)/visits/new.tsx` → `VisitForm`). Reached from the list header "+" and from Home quick-actions. The stack title (native, when shown) is **«تسجيل زيارة» / "Record a visit"** (`visits.addTitle`), but the Figma form hides the native header and draws its own.
- **Permission gate**: only `canManage || canLogDoses` reach the form. A non-collaborator hitting this route sees a centered `EmptyState` with title **«تسجيل الزيارات متاح لأعضاء دائرة الرعاية النشطين» / "Recording visits is available to active care circle members"** (`visits.cannotAdd`) and no form. (new.tsx:16-28)
- **Purpose**: Create a new family visit.
- **Component**: `VisitForm` (`src/features/visits/visit-form.tsx`) inside `FigmaFormScreen`.

### Layout, top to bottom

1. **Header** (`FigmaFormScreen` header): round 44dp back pill + title **«تسجيل زيارة» / "Record a visit"** (`visits.addTitle`). Back → `router.back()`. An `UnsavedChangesGuard` warns on leave when the draft is dirty and not yet submitted. (visit-form.tsx:74-76)
2. **Muted disclaimer note** (`FigmaMutedNote`): **«تنظيم زيارات العائلة وتنسيقها فقط، دون أي نصيحة طبية.» / "For organizing and coordinating family visits only. It does not provide medical advice."** (`visits.disclaimer`). (visit-form.tsx:77)
3. **Fields card** (one `Surface`, tone `card`, `Radius.lg`, 16dp padding, 16dp gap) containing `FigmaVisitFields` (see Form table) followed by:
   - **Managers**: a hairline divider + `MemberSelect` labeled **«ربط بعضو» / "Link to a member"** (`visits.fields.linkToMember`) — a chip group of active "doer" members (admin / primary_caregiver / family_member), preceded by **«غير محدد» / "Unassigned"** (`assignment.none`) and, when applicable, **«أنا» / "Me"** (`assignment.me`). Default = unlinked (`''`). (visit-form.tsx:82-91)
   - **Collaborators**: a hairline divider + `FigmaMutedNote` **«ستظهر هذه الزيارة في سجل حسابك» / "This visit will appear in your account log"** (`visits.ownVisitNote`) — no picker; the visit is force-linked to the collaborator's own account. (visit-form.tsx:92-97)
4. **Footer (in-body, not pinned)**: an inline alert line (only on submit error) + the primary CTA `FigmaFooterPrimaryButton` labeled **«إضافة زيارة» / "Add visit"** (`visits.add`), showing a spinner while `create.isPending`. On error: alert text **«تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't save. Check your connection and try again."** (`visits.saveFailed`), `accessibilityRole="alert"`. (visit-form.tsx:103-113)

### Form fields (`FigmaVisitFields`, figma-visit-fields.tsx)

Field order top-to-bottom; start/end times sit side-by-side in one row:

| # | Label (AR / EN) | i18n key | Type | Req? | Placeholder (AR / EN) | Validation & error copy |
|---|---|---|---|---|---|---|
| 1 | «اسم الزائر» / "Visitor name" | `visits.fields.visitorName` | Text (`FormField`, `required`) | **Yes** | «من سيزور؟» / "Who will visit?" (`visits.placeholders.visitorName`) | 1–120 chars. Empty → **«يرجى إدخال اسم الزائر» / "Please enter the visitor's name"** (`visits.errors.visitorName`); over 120 → **«النص طويل جدًا» / "This text is too long"** (`validation.tooLong`) |
| 2 | «تاريخ الزيارة» / "Visit date" | `visits.fields.visitDate` | Date (`DateField` wheel picker, label via `FigmaFieldLabel` + `*`) | **Yes** | «YYYY-MM-DD» | Must be valid `YYYY-MM-DD`. Invalid → **«أدخل التاريخ بصيغة YYYY-MM-DD» / "Enter the date as YYYY-MM-DD"** (`visits.errors.visitDate`) |
| 3 | «وقت البدء» / "Start time" | `visits.fields.startTime` | Time (`TimeField` wheel picker, `clearable`) | Optional | «HH:MM» | If set, valid `HH:MM`, else **«أدخل الوقت بصيغة HH:MM» / "Enter the time as HH:MM"** (`visits.errors.startTime`) |
| 4 | «وقت الانتهاء» / "End time" | `visits.fields.endTime` | Time (`TimeField` wheel picker, `clearable`) | Optional | «اختياري — HH:MM» / "Optional — HH:MM" (`visits.placeholders.endTime`) | If set, valid `HH:MM` (`visits.errors.endTime`); and must not precede start → **«وقت الانتهاء قبل وقت البدء» / "End time is before the start time"** (`visits.errors.endBeforeStart`) |
| 5 | «ملاحظات» / "Notes" | `visits.fields.notes` | Multiline text (`FormField multiline`) | Optional | «تفاصيل الزيارة...» / "Visit details..." (`visits.placeholders.notes`) | ≤1000 chars; over → **«النص طويل جدًا»** (`validation.tooLong`) |

- Defaults: all fields blank (`defaultVisitDraft()` → every string `''`). (visit-fields.tsx:24-26)
- Validation is Zod (`visitSchema`, schema.ts) run by `prepareVisit`; codes map to the copy above; unmapped codes fall back to **«قيمة غير صحيحة» / "Invalid value"** (`validation.generic`). (visit-fields.tsx:51-71, figma-visit-fields.tsx:29-48)
- Empty times/notes are persisted as `null`.

### Submit behavior
On CTA press: validate → if invalid, set inline field errors and stop (no navigation). If valid, call `createVisit` with `visitor_user_id` = (manager's chosen link or `null`) / (collaborator's own `user.id`) and `created_by` = current user. On success `submitted` flips true and a `useEffect` calls `router.back()` to the list. On failure, `submitError` shows the `visits.saveFailed` alert. (visit-form.tsx:46-72)

### Components used
`FigmaFormScreen`, `FigmaMutedNote`, `FigmaFieldLabel`, `Surface`, `FormField`, `DateField`, `TimeField`, `MemberSelect` (→ `OptionSelect`), `FigmaFooterPrimaryButton`, `UnsavedChangesGuard`. Hook: `useCreateVisit`.

---

## Screen 3 — Visit detail / editor

- **Route & how reached**: `/visits/[id]` (`src/app/(app)/visits/[id].tsx` → `VisitEditor`). Reached by tapping any card in the list. Native stack title (when shown) is **«تفاصيل الزيارة» / "Visit details"** (`visits.detailTitle`), but each variant hides the native header and draws its own.
- **Purpose**: View a visit; managers edit/relink/delete it; the linked visitor records its outcome.
- **Component**: `VisitEditor` (`src/features/visits/visit-editor.tsx`), which loads `useVisit(id)` then branches.

### Load states (before branching)
- **Loading** → `LoadingState` (full-area spinner).
- **Error** → `ErrorState` with message **«تعذّر تحميل الزيارات…»** (`visits.loadError`), retry **«إعادة المحاولة»** (`retry`).
- **Not found** (`visit.data` null) → centered `EmptyState`, `icon` = visit glyph, title **«تعذّر العثور على هذه الزيارة. ربما حُذفت.» / "Couldn't find this visit. It may have been removed."** (`visits.notFound`). (visit-editor.tsx:67-79)

### Branching
- `isOwner` = the visit is linked to the current user (`visitor_user_id === userId`).
- `canMarkOutcome` (for the view screen) = `canCollaborate && isOwner`.
- If **`canManage`** → the full **edit** screen (`VisitEditScreen`). Otherwise → the **read-only view** (`VisitViewScreen`). (visit-editor.tsx:81-101)

---

### 3a — Manager edit screen (`VisitEditScreen`)

Layout inside `FigmaFormScreen` (title **«تفاصيل الزيارة»** `visits.detailTitle`, back → `router.back()`, `UnsavedChangesGuard` on dirty):

1. **Muted disclaimer**: `visits.disclaimer` (same as add). (visit-editor.tsx:168)
2. **Fields card** (`Surface`): `FigmaVisitFields` seeded from the row (`visitDraftFromRow` — times sliced to `HH:MM`), then a hairline divider + `MemberSelect` labeled **«ربط بعضو»** (`visits.fields.linkToMember`) seeded from `visitor_user_id`. Managers may relink to any active doer or clear the link. Same five fields, same validation, as the add form. (visit-editor.tsx:170-183)
3. **Status card** (`StatusSection`, `canMarkOutcome` + `canReopen` both true for managers) — see below.
4. **Delete card** (`DeleteVisitRow`) — see below.
5. **Save footer (in-body)**: optional status line — success **«تم حفظ التغييرات» / "Changes saved"** (`visits.saved`, `successFg`, live-region polite) or error **«تعذّر الحفظ…»** (`visits.saveFailed`, `errorFg`, `role="alert"`) — plus `FigmaFooterPrimaryButton` **«حفظ التغييرات» / "Save changes"** (`common.saveChanges`), spinner while pending. (visit-editor.tsx:191-207)

**Save behavior**: `prepareVisit(draft)` → on invalid, show field errors and stop. On valid, `updateVisit(id, { ...value, visitor_user_id })` where the manager's chosen link (or `null`) is preserved so RLS still holds. Success → `markSaved()` + status "saved"; failure → status "error". (visit-editor.tsx:139-163)

#### Status card — `StatusSection`
Header row: label **«الحالة» / "Status"** (`visits.fields.status`) on the start, a `StatusBadge` on the end showing the current status with glyph + tone: `planned` → info tone + clock glyph + **«مخطّطة» / "Planned"**; `completed` → success + check + **«تمّت» / "Completed"**; `cancelled` → error + cross + **«ملغاة» / "Cancelled"**. (visit-editor.tsx:28-39, 302-310)

Below the header, an alert line appears on failure (**«تعذّر الحفظ…»** `visits.saveFailed`, `role="alert"`). (visit-editor.tsx:312-319)

Actions depend on current status:
- **Planned** (`showOutcome`, since managers have `canMarkOutcome`): a two-button row — **«تمت الزيارة» / "Mark completed"** (`visits.markCompleted`, primary) and **«تعذّرت الزيارة» / "Couldn't visit"** (`visits.markCancelled`, secondary). This is an **inline two-step confirm**: tapping either replaces the row with a confirm stack:
  - Body text: for complete → **«هل تريد تعليم هذه الزيارة كمكتملة؟» / "Mark this visit as completed?"** (`visits.confirmCompletedBody`); for cancel → **«هل تريد تعليم هذه الزيارة كمتعذّرة؟» / "Mark this visit as not completed?"** (`visits.confirmCancelledBody`).
  - Confirm button: **«تمت الزيارة»** (primary) or **«تعذّرت الزيارة»** (danger), spinner while pending.
  - Cancel button: **«إلغاء» / "Cancel"** (`common.cancel`, secondary), disabled while pending. (visit-editor.tsx:321-357)
- **Completed / Cancelled** (`showReopen`, managers only): a single secondary button **«إعادة كمخطّطة» / "Mark as planned"** (`visits.reopen`) — reopens with no confirm (an explicit, reversible action). (visit-editor.tsx:358-366)

Both write via `useSetVisitStatus` → `setVisitStatus(id, status)`; on success it also invalidates the Care Pulse feed (a completed visit is a Pulse event). (hooks.ts:75-85)

#### Delete card — `DeleteVisitRow`
Default: a single **danger** button **«حذف الزيارة» / "Delete visit"** (`visits.deleteVisit`). This is an **inline two-step confirm**: tapping it swaps to a two-button row — **«تأكيد الحذف» / "Confirm delete"** (`common.confirmDelete`, danger, spinner while pending) and **«إلغاء» / "Cancel"** (`common.cancel`, secondary). Confirming calls `deleteVisit(id)` then `router.back()`; on failure it clears the pending state (stays on screen). Delete is manager-only (only rendered inside `VisitEditScreen`). (visit-editor.tsx:371-418)

---

### 3b — Read-only / collaborator view screen (`VisitViewScreen`)

Shown to any non-manager (collaborators and read-only members). Layout inside `FigmaFormScreen` (title **«تفاصيل الزيارة»**, back → `router.back()`):

1. **Muted note**: if the viewer is the linked visitor (`canMarkOutcome`) → **«يمكنك تحديث حالة الزيارة فقط» / "You can update the visit status only"** (`visits.statusOnly`); otherwise → **«للعرض فقط — لا تملك صلاحية التعديل» / "View only — you don't have permission to edit"** (`visits.readOnly`). (visit-editor.tsx:233)
2. **Details card** (`Surface`), read-only rows:
   - Bold title = `visitor_name`.
   - **«الموعد» / "When"** (`visits.whenLabel`) → `visit_date` or `«{date} {start} – {end}»` (LTR-isolated times).
   - **«مرتبطة بـ» / "Linked to"** (`visits.linkedToLabel`) → resolved member name — only when the visit is linked.
   - **«ملاحظات» / "Notes"** (`visits.fields.notes`) → the notes text — only when present. (visit-editor.tsx:235-242, 249-257)
3. **Status card** (`StatusSection`): same badge as above. If `canMarkOutcome` (the linked visitor) and status is `planned`, the same two-step **«تمت الزيارة» / «تعذّرت الزيارة»** confirm flow is available. `canReopen` is **false** here — a linked visitor may close a visit but **cannot reopen** it, and read-only members get no actions at all (badge only). (visit-editor.tsx:244)

There is **no** delete card and **no** editable fields on this screen.

### Components used (detail)
`FigmaFormScreen`, `FigmaMutedNote`, `Surface`, `FigmaVisitFields`, `MemberSelect`, `StatusBadge`, `Button` (primary/secondary/danger variants), `FigmaFooterPrimaryButton`, `UnsavedChangesGuard`, `EmptyState`/`ErrorState`/`LoadingState`, `useMemberLookup`. Hooks: `useVisit`, `useUpdateVisit`, `useSetVisitStatus`, `useDeleteVisit`.

### Cross-links
Back → list (`/visits`). No further sub-screens; `MemberSelect` opens no modal (inline chip group).

---

## Data model reference

`FamilyVisit` row (`family_visits` table, api.ts): `id`, `circle_id`, `visitor_name`, `visitor_user_id` (nullable link to a member account — governs own-visit RLS), `visit_date` (`YYYY-MM-DD`), `start_time` / `end_time` (`HH:MM:SS` nullable), `notes` (nullable), `status` (`planned | completed | cancelled`), `created_by`, `created_at`. Status enum labels localize via `visits.status.*`. Times are stored full-precision but displayed `HH:MM` via `formatHm`.

---

## Workflows

### A. Add a family visit (manager or collaborator)
1. On `/visits`, tap the header **"+"** (visible only to `canManage || canCollaborate`).
2. Land on `/visits/new`. If somehow reached without permission, see the `visits.cannotAdd` empty state instead.
3. Enter **Visitor name** (required) and **Visit date** (required); optionally set **Start**/**End time** and **Notes**.
4. Manager only: pick a member in **«ربط بعضو»** (or leave Unassigned). Collaborator: sees the **«ستظهر هذه الزيارة في سجل حسابك»** note — the visit auto-links to their own account.
5. Tap **«إضافة زيارة»**. Invalid fields show inline errors and block submit; end-before-start shows `visits.errors.endBeforeStart`.
6. On success the screen pops back to `/visits`; the new visit appears in **Upcoming** (if today/future) or **Recent** (if past). On failure, the `visits.saveFailed` alert appears; the draft is retained.

### B. Browse and open a visit
1. On `/visits`, choose the **«القادمة»** or **«السابقة»** tab.
2. Scan cards (chip + visitor name + "Family visit" + when + your-visit/linked-member meta + status pill for closed visits).
3. Tap a card → `/visits/[id]`; a manager gets the editor, anyone else gets the read-only view.

### C. Edit a visit (manager)
1. Open the visit → `VisitEditScreen`.
2. Change any field, and/or relink via **«ربط بعضو»**.
3. Tap **«حفظ التغييرات»**. Validation runs; on success the **«تم حفظ التغييرات»** line shows and the guard clears; on failure the **«تعذّر الحفظ…»** alert shows.

### D. Record a visit outcome (manager, or the linked visitor)
1. Open a **planned** visit.
2. In the Status card tap **«تمت الزيارة»** (completed) or **«تعذّرت الزيارة»** (couldn't visit).
3. Confirm in the inline two-step prompt (**«هل تريد تعليم هذه الزيارة كمكتملة/كمتعذّرة؟»**) via the confirm button, or **«إلغاء»** to back out.
4. The status badge updates (success/error tone + glyph + label) and the Care Pulse feed refreshes. A read-only member cannot do this.

### E. Reopen a closed visit (manager only)
1. Open a completed/cancelled visit as a manager.
2. In the Status card tap **«إعادة كمخطّطة»** — status returns to `planned` immediately (no confirm). A linked visitor has no reopen affordance.

### F. Delete a visit (manager only)
1. Open the visit → `VisitEditScreen` → the delete card at the bottom.
2. Tap **«حذف الزيارة»** → the inline confirm row appears.
3. Tap **«تأكيد الحذف»** (or **«إلغاء»** to abort). On success the screen pops back to `/visits`; on failure it stays open (pending cleared) — RLS permits delete only for managers or the owner of an own-account visit.
