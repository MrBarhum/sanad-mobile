# Tasks (Care Tasks)

Care Tasks is the shared to‑do surface for a care circle: discrete pieces of care work (buy medication, drive to an appointment, meal, hygiene, movement, errands, etc.) that family members create, assign, claim, complete, or cancel. The domain follows Sanad's **transparent‑circle** posture — every active member can *see* every task in the circle, and lists offer an explicit «مهامي / كل المهام» (mine / all) scope toggle rather than hiding others' work; who may *mutate* is still gated by role. Tasks live under a nested Expo Router stack (`center → add → detail`) whose native header is styled from theme tokens (`_layout.tsx`) but is hidden by the individual Figma screens, each of which draws its own header. There are three screens: the **task center list** (`FigmaTasks`), the **add‑task form** (`TaskForm`), and the **task detail / editor** (`TaskEditor`, which forks into an editable manager view and a read‑only member view). Task ordering across open tabs is **overdue → priority (urgent→low) → due date/time** (standing decision A7); the "done" tab is chronological. Every one‑tap mutation is guarded by a sanctioned confirmation pattern (bottom‑sheet confirm for row actions, inline two‑step for status/delete, `confirmAction` for inline claim).

Role vocabulary used throughout (from the circle gate; see `figma-tasks.tsx:70‑78`):
- **Managers** = `admin` / `primary_caregiver` → `canManage = true`. See and mutate every task; can add, edit all fields, delete, and reopen.
- **Collaborators** = `family_member` / `caregiver` → `canCollaborate = canLogDoses = true`. May complete/cancel tasks **assigned to themselves only**, and may claim unassigned open tasks.
- **Read‑only followers** = `remote_member` / `elder`. Full read view, no action affordances, no scope toggle (always see "all").

The canonical status enum is **open = «مفتوحة»**, completed = «منجزة», cancelled = «ملغاة» (`tasks.status.*`).

---

## Screen 1 — Task Center (list)

**Route & how reached:** `/tasks` (also the stack's `initialRouteName`, so back‑navigation anchors here). File: `src/app/(app)/tasks/index.tsx` → wraps `CircleGate` → renders `FigmaTasks` (`src/features/tasks/figma-tasks.tsx`). Reached from the app's Tasks tab / Home quick‑actions. The `CircleGate` first resolves the active circle and renders shared loading / error / no‑circle states before `FigmaTasks` mounts (see "Gate states" below).

**Purpose:** Browse and triage the circle's care tasks by time/status and scope, and perform quick complete / cancel / claim actions inline.

### Layout, top to bottom

1. **Header** (`FigmaHeader`, `figma-tasks.tsx:217`): a round 44dp back pill (start; `ArrowRight` glyph — points to the start edge in RTL) + centered bold title **«المهام» / "Tasks"** (`figma.tasks.title`) + trailing round **teal "+" add** button (`Plus` icon, `onPrimary` foreground). The add button renders **only for managers** (`onAdd` passed only when `canManage`); its accessibility label is «إضافة مهمة» / "Add task" (`tasks.add`). For non‑managers the trailing slot is an empty 44dp spacer.
2. **Status/time segmented tabs** (`FigmaSegmentedTabs`, `:223`): three equal‑width pills, ≥44dp tall — active = filled teal, inactive = card + hairline. Tabs (`figma.tasks.tabs.*`):
   | key | AR | EN |
   |---|---|---|
   | `today` | «اليوم» | "Today" |
   | `open` | «مفتوحة» | "Open" |
   | `done` | «مكتملة» | "Done" |
   Default active tab = `today`.
3. **Scope toggle row** (`figma-tasks.tsx:227`) — **only rendered for members who can be assigned work** (`canBeAssigned = canManage || canCollaborate`). A second two‑pill `FigmaSegmentedTabs` (`figma.tasks.scope.*`):
   | key | AR | EN |
   |---|---|---|
   | `mine` | «مهامي» | "My tasks" |
   | `all` | «كل المهام» | "All tasks" |
   Default: managers start on **`all`**, collaborators start on **`mine`** (`:117`). Read‑only followers never see this row and always view `all`.
4. **List body** — one of: skeleton, error card, empty state, or the list of `TaskRow`s (hairline‑bordered cards, 8dp gap).

### Tabs / filtering logic (`figma-tasks.tsx:127‑140`)
- `visible` = all circle tasks, then filtered to "mine" if scope=mine. A task is **"mine"** when `assigned_to === userId` **or** `completed_by === userId` (so completed history stays yours; `:120‑125`).
- **today** tab: open tasks with `due_date === today`, sorted by `compareOpenTasks` (overdue → priority → due key).
- **open** tab: all open tasks, same `compareOpenTasks` sort.
- **done** tab: tasks whose status ≠ open (completed + cancelled), sorted chronologically by `due_date + due_time` (missing dates sort last via `'9999-99-99' '99:99:99'`).
- Priority weights: urgent 0, high 1, normal 2, low 3 (`:49`); unknown priorities sort as normal.

### Every interactive element

| Element | Label (AR / EN) | Icon | Action | Confirm |
|---|---|---|---|---|
| Back pill | a11y «رجوع» / "Back" (`common.back`) | `ArrowRight` | `router.back()` | — |
| Add "+" (managers only) | a11y «إضافة مهمة» / "Add task" | `Plus` | `router.push('/tasks/new')` | — |
| Tab pills (today/open/done) | see table | — | `setTab(key)` | — |
| Scope pills (mine/all) | see table | — | `setScope(key)` | — |
| Retry (error state) | «إعادة المحاولة» / "Retry" (`retry`) | — | `tasksQuery.refetch()` | — |
| **Row body tap** | — | — | Opens detail `router.push('/tasks/{id}')` | — |
| **Row checkbox** (complete) — only when `canAct` | a11y «إنجاز» / "Complete" (`tasks.complete`), hint = complete‑confirm title | done→`Check`, cancelled→`X`, open→empty outline | Opens the **complete bottom‑sheet confirm** | Bottom‑sheet (see below) |
| **Row "X"** (cancel) — only when open & `canAct` | a11y «تعذّر الإنجاز» / "Couldn't complete" (`tasks.markUnable`), hint = unable‑confirm title | `X` | Opens the **cancel bottom‑sheet confirm** | Bottom‑sheet |
| **Inline claim pill** — only when claim‑capable & task unassigned & open | «أنا متكفّل» / "I'll take it" (`claiming.cta`), hint «تكفّل بهذا العنصر ليصبح من مسؤوليتك» / "Take responsibility for this item" (`claiming.ctaHint`) | `HandHelping` (filled teal pill) | Runs `onClaim` → `confirmAction` prompt → assigns task to me | `confirmAction` (see below) |

When a row is **not actionable** (read‑only follower, or a collaborator on someone else's / unassigned task), the checkbox becomes a non‑interactive status **dot** (`pointerEvents="none"`) so a tap falls through to open detail rather than being a silent no‑op (`figma-tasks.tsx:459‑465`).

### TaskRow — data shown (`figma-tasks.tsx:379‑530`)
Per card, top‑to‑bottom inside the info column:
- **Checkbox / status indicator** (28dp round, 2dp border): completed → success‑tinted fill + `Check` (success color); cancelled → error‑tinted fill + `X` (error color); open → hairline outline, empty.
- **Title** (15/semibold). When completed: **strikethrough + 0.6 opacity**. Up to 2 lines.
- **Note** — `task.description` (trimmed), 1 line, secondary color. Omitted if empty.
- **Meta row**: if a due exists, a `Clock` (12dp) + the due string, LTR‑isolated (`isolateLtr`); format is `due_date` alone, or `due_date + " " + formatHm(due_time)` when a time exists. Then a «·» separator, then the **assignee text in teal (`primary`)**:
  - assigned to me → «مُسندة إليك» / "Assigned to you" (`tasks.assignedToMe`)
  - unassigned → «غير مُسندة» / "Unassigned" (`tasks.unassigned`)
  - assigned to another member → that member's resolved display name (via `useMemberLookup`), or fallback «مُسندة إلى أحد الأعضاء» / "Assigned to a member" (`tasks.assignedToMember`).
- **Inline claim pill** (when eligible) — filled teal, `HandHelping` + «أنا متكفّل»; shows a spinner while claiming.
- Cancelled rows render the whole card dimmed (0.5 opacity, `rowDim`).

### States

- **Gate loading** — `CircleGate` shows `LoadingState` (centered large teal spinner). **Gate error** — `ErrorState`: warning glyph chip + «تعذّر تحميل الدائرة…» (`careCircle.loadError`) + «إعادة المحاولة» retry. **No circle** — `EmptyState` with members icon + `careCircle.noActiveCircle`.
- **List loading** — `SkeletonList` (placeholder rows).
- **List error** — a `Surface` card: centered error text **«تعذّر تحميل المهام. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't load tasks. Check your connection and try again."** (`tasks.loadError`) + a teal **«إعادة المحاولة» / "Retry"** button.
- **Empty** — `EmptyState` (Surface card + neutral task GlyphChip + title). Copy depends on scope:
  - scope = mine → **«لا مهام مُسندة إليك حالياً» / "No tasks assigned to you right now"** (`figma.tasks.emptyMine`)
  - scope = all → **«لا مهام الآن — كل شيء على ما يُرام» / "No tasks right now — everything's in order"** (`figma.tasks.empty`)
  - (Note: this single empty copy is used for all three tabs; there are also unused `tasks.noTodayTitle/Subtitle` and `tasks.noOpenTitle/Subtitle` strings in i18n from an earlier design.)
- **Populated** — the `TaskRow` list.

### Bottom‑sheet: quick complete / cancel confirm (`TaskConfirmSheet`, `figma-tasks.tsx:331`)
A `FigmaBottomSheet` (rounded‑top card, grab handle, scrim, dismiss on backdrop tap). It retains a snapshot of the task so copy stays correct during slide‑out.
- **Complete variant** — title **«تأكيد إنجاز المهمة؟» / "Mark task complete?"** (`tasks.confirmCompleteTitle`); body **«هل تريد تعليم هذه المهمة كمُنجَزة؟» / "Mark this task as completed?"** (`tasks.confirmCompleteBody`); the task title (up to 3 lines); primary teal CTA **«تم الإنجاز» / "Mark complete"** (`tasks.markComplete`); secondary **«إلغاء» / "Cancel"** (`common.cancel`).
- **Cancel variant** — title **«تأكيد تعذّر إنجاز المهمة؟» / "Mark task as not completed?"** (`tasks.confirmUnableTitle`); body **«هل تريد تسجيل هذه المهمة كمتعذّرة الإنجاز؟» / "Record this task as not completed?"** (`tasks.confirmUnableBody`); danger CTA **«تعذّر الإنجاز» / "Couldn't complete"** (`tasks.markUnable`); secondary cancel.
- Confirming calls `complete.mutateAsync` / `cancel.mutateAsync`. On failure the sheet **stays open** so the user can retry; the row is unchanged (no silent revert). CTA shows a loading spinner while pending; cancel button disabled while pending.

### Inline claim confirmation (`confirmAction`, `figma-tasks.tsx:149‑187`)
Tapping «أنا متكفّل» fires a cross‑platform `confirmAction` prompt:
- title **«التكفّل بهذا العنصر؟» / "Take responsibility for this?"** (`claiming.confirmTitle`)
- message **«سيصبح «{title}» من مسؤوليتك.» / "\"{title}\" will become your responsibility."** (`claiming.confirmMessage`, interpolates the task title)
- confirm **«أنا متكفّل» / "I'll take it"** (`claiming.cta`); cancel **«إلغاء» / "Cancel"**.
On confirm, `useClaimTask` assigns the task to the current user. **Success is silent** — the row re‑renders as "assigned to me" (and moves under «مهامي») when the query invalidates. Failures surface in a second `FigmaBottomSheet` (`ClaimNoteSheet`, `:299`):
- Already claimed by someone else (Postgres unique‑violation `23505`): warning tone, title **«تم التكفّل بهذا العنصر من شخص آخر» / "Someone else already claimed this item"** (`claiming.alreadyClaimed`), body **«تم تحديث القائمة لإزالة العنصر» / "The list has been refreshed to remove it"** (`claiming.alreadyClaimedBody`).
- Other failure: error tone, title **«تعذّر التكفّل بهذا العنصر. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't take on this item. …"** (`claiming.claimFailed`), no body.
- Dismissed with an **«حسنًا» / "OK"** (`common.ok`) secondary button. Body is announced as an assertive alert.

### Components used
`FigmaScreen`, `FigmaHeader`, `FigmaSegmentedTabs` (×2), `SkeletonList`, `Surface`, `EmptyState`, `FigmaBottomSheet` (×2), `Button`, `GlyphChip` (inside EmptyState), plus lucide icons (`Check`, `Clock`, `HandHelping`, `X`, `Plus`, `ArrowRight`). Data via `useTasks`, `useCompleteTask`, `useCancelTask`, `useClaimTask`, `useMemberLookup`.

### Cross‑links
Row tap → `/tasks/{id}` (detail). "+" → `/tasks/new` (add).

---

## Screen 2 — Add Task (form)

**Route & how reached:** `/tasks/new` (`src/app/(app)/tasks/new.tsx`). Reached only from the list's "+" (managers). Non‑managers who somehow land here see a centered `EmptyState` with title **«إضافة المهام متاحة للمشرف ومقدّم الرعاية الأساسي فقط» / "Only the admin and primary caregiver can add tasks"** (`tasks.managersOnly`) — no form. Managers get `TaskForm` (`src/features/tasks/task-form.tsx`) with the native stack header hidden.

**Purpose:** Create a new care task and optionally assign it.

### Layout, top to bottom (`FigmaFormScreen`)
1. **Header**: round back pill (`ArrowRight`) + stacked title **«إضافة مهمة» / "Add task"** (`tasks.addTitle`), hairline divider below.
2. **Muted disclaimer note** (`FigmaMutedNote`): **«تنظيم وتنسيق مهام الرعاية بين أفراد العائلة فقط، دون أي نصيحة طبية.» / "For organizing and coordinating care tasks among the family only. It does not provide medical advice."** (`tasks.disclaimer`).
3. **Main‑info card** (`Surface`, gap 16): Title field, Description field, Category chip group, Priority chip group.
4. **Due card** (`Surface`): section label **«الموعد النهائي» / "Deadline"** (`tasks.dueTitle`), then a row of Due date (flex 2) + Due time (flex 1).
5. **Assignee card** (`Surface`): `MemberSelect`.
6. **Notes card** (`Surface`): Notes field.
7. **Footer block** (in‑body, not pinned): optional error line + primary teal CTA **«إضافة مهمة» / "Add task"** (`tasks.add`), via `FigmaFooterPrimaryButton`.

An `UnsavedChangesGuard` warns on leaving with unsaved edits (active while `dirty && !submitted`). On success the screen navigates back (`router.back()`).

### Form fields (in order)

| # | Field | Key | Type | Required | Placeholder (AR / EN) | Validation → error copy |
|---|---|---|---|---|---|---|
| 1 | Title | `tasks.fields.title` «عنوان المهمة» / "Task title" | text | **Yes** (`required` mark) | «مثال: شراء الدواء من الصيدلية» / "e.g. Pick up medication from the pharmacy" | min 1 → «يرجى إدخال عنوان المهمة» / "Please enter a task title" (`tasks.errors.title`); max 120 → «النص طويل جدًا» / "This text is too long" (`validation.tooLong`) |
| 2 | Description | `tasks.fields.description` «الوصف» / "Description" | textarea (multiline) | No | «تفاصيل إضافية» / "Additional details" | max 1000 → tooLong |
| 3 | Category | `tasks.fields.category` «التصنيف» / "Category" | chips (`OptionSelect`) | choice (default `general`) | — | — |
| 4 | Priority | `tasks.fields.priority` «الأولوية» / "Priority" | chips (`OptionSelect`) | choice (default `normal`) | — | — |
| 5 | Due date | `tasks.fields.dueDate` «تاريخ الاستحقاق» / "Due date" | date (`DateField`, wheel picker, clearable) | No | — | must be `YYYY-MM-DD` → «أدخل التاريخ بصيغة YYYY-MM-DD» / "Enter the date as YYYY-MM-DD" (`tasks.errors.dueDate`) |
| 6 | Due time | `tasks.fields.dueTime` «وقت الاستحقاق» / "Due time" | time (`TimeField`, wheel picker, clearable) | No | — | must be `HH:MM` → «أدخل الوقت بصيغة HH:MM» / "Enter the time as HH:MM" (`tasks.errors.dueTime`); **a time without a date** → «حدّد تاريخ الاستحقاق أولاً» / "Set a due date first" (`tasks.errors.dueTimeNeedsDate`) |
| 7 | Assignee | `tasks.fields.assignedTo` «تعيين إلى» / "Assign to" | chips (`MemberSelect`) | No (default unassigned) | — | — |
| 8 | Notes | `tasks.fields.notes` «ملاحظات» / "Notes" | textarea (multiline) | No | «ملاحظات إضافية» / "Additional notes" | max 1000 → tooLong |

**Category chip options** (`TASK_CATEGORIES`, display order): general «عام», medication «دواء», meal «وجبة», hygiene «نظافة», movement «حركة», errand «مشوار», appointment «موعد», other «أخرى» (`tasks.category.*`).
**Priority chip options** (`TASK_PRIORITIES`, order): low «منخفضة», normal «عادية», high «عالية», urgent «عاجلة» (`tasks.priority.*`).

Validation runs on submit (`taskSchema.safeParse`). Empty title/date/time are trimmed to `null` before insert (`nullify`). On network failure the footer shows an alert‑role line **«تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't save your changes. …"** (`tasks.saveFailed`); the CTA shows a spinner while submitting.

### Submit behavior
`useCreateTask` inserts a `care_tasks` row (`circle_id` from context, `created_by` = current user). RLS restricts insert to admin / primary_caregiver. On success → `submitted=true` → effect calls `router.back()`.

### Components used
`FigmaFormScreen`, `FigmaMutedNote`, `FigmaSectionLabel`, `Surface`, `FormField` (×3: title/description/notes), `OptionSelect` (×2), `DateField`, `TimeField`, `MemberSelect`, `FigmaFooterPrimaryButton`, `UnsavedChangesGuard`.

---

## Screen 3 — Task Detail / Editor

**Route & how reached:** `/tasks/{id}` (`src/app/(app)/tasks/[id].tsx`). Reached by tapping any row in the list. Wraps `CircleGate` → `TaskEditor` (`src/features/tasks/task-editor.tsx`). `TaskEditor` loads the task via `useTask(id)` and forks:
- **Managers** → `TaskEditScreen` (fully editable form + status card + delete).
- **Non‑managers** → `TaskViewScreen` (read‑only fields + status card, which may still allow status updates for the assignee).

**Purpose:** View a task's full detail; for managers, edit any field / change status / delete; for the assignee, complete or cancel.

### Loading / error / not‑found states (`TaskEditor`, `:82‑94`)
- Loading → `LoadingState` spinner.
- Error → `ErrorState`: warning chip + **«تعذّر تحميل المهام…»** (`tasks.loadError`) + «إعادة المحاولة» retry.
- Not found (task deleted) → centered `EmptyState` with task glyph + **«تعذّر العثور على هذه المهمة. ربما حُذفت.» / "This task couldn't be found. It may have been removed."** (`tasks.notFound`).

### 3a — Manager edit view (`TaskEditScreen`, `:114`)

Layout (all in `FigmaFormScreen`, native header hidden):
1. **Header**: back pill + title **«تفاصيل المهمة» / "Task details"** (`tasks.detailTitle`).
2. **Muted disclaimer note**: `tasks.disclaimer` (same non‑medical line as the add form).
3. **Main‑info card**: Title (required), Description, Category chips, Priority chips — same fields/validation as the add form (table above), pre‑seeded from the task. (Note: the description field here has no placeholder set in the editor.)
4. **Due card**: section label «الموعد النهائي», Due date (clearable, seeded from `due_date`) + Due time (clearable, seeded from `formatHm(due_time)`).
5. **Assignee card**: `MemberSelect` seeded from `assigned_to` (a full member picker — replaced an old self‑only toggle that used to wipe another member's assignment on save).
6. **Status card** (`StatusSection`) — see below.
7. **Delete card** (`DeleteTaskRow`) — see below.
8. **Footer**: a `saved`/`error` status line + primary CTA **«حفظ التغييرات» / "Save changes"** (`common.saveChanges`).

**Save** (`onSubmit`, `:177`): validates via `taskSchema`, then `useUpdateTask` patches title, description, category, priority, due_date, due_time, `assigned_to` (empty→null), notes. On success shows **«تم حفظ التغييرات» / "Changes saved"** (`tasks.saved`, polite live region) and marks the form clean; on failure shows **«تعذّر الحفظ…» / "Couldn't save your changes…"** (`tasks.saveFailed`, alert role). Editing any field clears a prior saved/error status (`touch()`). `UnsavedChangesGuard` active while `dirty`.

### 3b — Non‑manager read‑only view (`TaskViewScreen`, `:352`)

1. **Header**: back pill + «تفاصيل المهمة».
2. **Muted note** — conditional: if the viewer is the assignee of an open task → **«يمكنك تحديث حالة المهمة فقط» / "You can update the task status only"** (`tasks.statusOnly`); otherwise → **«للعرض فقط — لا تملك صلاحية التعديل» / "View only — you don't have permission to edit"** (`tasks.readOnly`).
3. **Detail card** — read‑only rows (`ReadOnlyRow`, label + value):
   - Title (large, bold — rendered as heading, not a labeled row).
   - Category «التصنيف» → localized `tasks.category.*`.
   - Priority «الأولوية» → localized `tasks.priority.*`.
   - Due «الاستحقاق» (`tasks.dueLabel`) → `due_date [+ formatHm(due_time)]`, or **«بدون تاريخ» / "No date"** (`tasks.noDueDate`) when none.
   - Responsible «المسؤول» (`assignment.responsible`) → resolved member name, or **«غير محدد» / "Unassigned"** (`assignment.none`).
   - Description row — only if present.
   - Notes row — only if present.
4. **Status card** (`StatusSection`, `canManage=false`).

### Status card (`StatusSection`, `:417`) — shared by both views

Header row: label **«الحالة» / "Status"** (`tasks.fields.status`) on the start, a **`StatusBadge`** on the end (color + glyph + text, never color alone):
| status | tone | glyph | label (AR / EN) |
|---|---|---|---|
| open | info | clock | «مفتوحة» / "Open" |
| completed | success | check | «منجزة» / "Completed" |
| cancelled | error | cross | «ملغاة» / "Cancelled" |

Below the badge, a meta timestamp when terminal:
- completed → **«اكتملت في» / "Completed at"** (`tasks.completedAt`) + `ymd hm` of `completed_at`, LTR‑isolated.
- cancelled → **«أُلغيت في» / "Cancelled at"** (`tasks.cancelledAt`) + `cancelled_at`.

**Action affordances** depend on permission:
- `canAct` = task open **and** (manager, or collaborator who is the assignee). When actionable, the card first shows two buttons — primary **«تم الإنجاز» / "Mark complete"** (`tasks.markComplete`) and secondary **«تعذّر الإنجاز» / "Couldn't complete"** (`tasks.markUnable`). Tapping either enters an **inline two‑step confirm**: it shows the confirm body (`tasks.confirmCompleteBody` / `tasks.confirmUnableBody`) + a confirm CTA (complete = teal primary «تم الإنجاز»; cancel = red danger «تعذّر الإنجاز») + a secondary **«إلغاء» / "Cancel"**. Confirming calls `useCompleteTask` / `useCancelTask`. On failure an alert line **«تعذّر الحفظ…»** (`tasks.saveFailed`) appears and the confirm stays.
- `canReopen` = manager **and** task not open. Shows a single secondary **«إعادة فتح المهمة» / "Reopen task"** (`tasks.reopen`) button → `useReopenTask` clears terminal timestamps and returns the task to `open` (managers only via RLS).

### Delete card (`DeleteTaskRow`, `:566`) — managers only
A `Surface` card with an **inline two‑step confirm**. First state: a danger button **«حذف المهمة» / "Delete task"** (`tasks.deleteTask`). Tapping reveals two side‑by‑side buttons — danger **«تأكيد الحذف» / "Confirm delete"** (`common.confirmDelete`) and secondary **«إلغاء» / "Cancel"**. Confirming calls `useDeleteTask` and, on success, `router.back()` to the list. On failure it stays (button re‑enables).

### Assignee picker (`MemberSelect`, `member-assignment.tsx`) — used by add + manager edit
A labeled chip group (`OptionSelect`) over the circle roster. Label defaults to «تعيين إلى» / "Assign to" (`assignment.label`), passed here as `tasks.fields.assignedTo`. Options built by `buildOptions`:
1. **«غير محدد» / "Unassigned"** (`assignment.none`) — value `''`, always first.
2. **«أنا» / "Me"** (`assignment.me`) — only when the current user is an active "doer".
3. Every **other active doer** by real display name (`memberDisplayName`: full name → email local‑part → neutral «عضو»/"Member" fallback `assignment.unknownMember`).
4. If the currently‑stored assignee is no longer an active doer, it's still appended (labeled with «(عضو سابق)» / "(Former member)" `assignment.inactiveMember` when inactive) so the assignment is never silently dropped.

Only **active "doer" roles** are assignable: `admin`, `primary_caregiver`, `family_member`. `remote_member` / `elder` / `caregiver` are excluded from being assignees (RLS remains authoritative). Single‑select; selecting a chip calls `onChange` with the user id (or `''`).

### Components used
`FigmaFormScreen`, `FigmaMutedNote`, `FigmaSectionLabel`, `Surface`, `FormField`, `OptionSelect`, `DateField`, `TimeField`, `MemberSelect`, `StatusBadge`, `Button`, `FigmaFooterPrimaryButton`, `UnsavedChangesGuard`, `EmptyState`/`ErrorState`/`LoadingState`, `useMemberLookup`. Mutations: `useUpdateTask`, `useCompleteTask`, `useCancelTask`, `useReopenTask`, `useDeleteTask`.

### Cross‑links
Back → list. Delete success → back to list.

---

## Data model reference (`api.ts`, `schema.ts`)

- Table `care_tasks`; a task row exposes: `id`, `circle_id`, `title`, `description`, `category` (enum), `priority` (enum), `status` (`open`/`completed`/`cancelled`), `due_date`, `due_time`, `assigned_to` (user id | null), `notes`, `created_by`, `completed_at`, `completed_by`, `cancelled_at`, `cancelled_by`, `created_at`.
- Lists fetch **all circle tasks ordered by `created_at` desc** (RLS: active members) then re‑sort client‑side per tab.
- Status transitions are their own API calls so paired timestamps are always set together: complete sets `completed_at` + `completed_by`; cancel sets `cancelled_at` + `cancelled_by`; reopen clears all four and returns to `open`.
- Completions/cancellations/reopens also invalidate the **Care Pulse** feed (`invalidateWithPulse`) so Home's activity strip refreshes.

---

## Workflows

### A. Create and assign a task (manager)
1. On `/tasks`, tap the round teal **"+"** (visible only to managers).
2. Land on `/tasks/new`. Enter **Title** (required). Optionally add Description.
3. Pick a **Category** chip and a **Priority** chip (default general / normal).
4. Optionally set **Due date**, then **Due time** (a time requires a date, else error «حدّد تاريخ الاستحقاق أولاً»).
5. Optionally pick an **Assignee** chip — «غير محدد», «أنا», or a named member.
6. Optionally add Notes. Tap **«إضافة مهمة» / "Add task"**.
7. Validation runs; on success the app returns to the list, where the new task appears in the appropriate tab.

### B. Complete a task from the list (quick action)
1. On `/tasks`, the current user must be able to act (manager, or the assignee) — the row shows an interactive round checkbox.
2. Tap the **checkbox**. A bottom sheet opens: **«تأكيد إنجاز المهمة؟»** / "Mark task complete?".
3. Tap **«تم الإنجاز» / "Mark complete"** (teal). The task is marked completed (`completed_by`/`completed_at` recorded), the sheet closes, and the row moves to the "done" tab strikethrough. On error the sheet stays open to retry.

### C. Mark a task not completed (cancel) from the list
1. On an open, actionable row, tap the trailing **"X"**.
2. Bottom sheet: **«تأكيد تعذّر إنجاز المهمة؟»** / "Mark task as not completed?".
3. Tap the danger **«تعذّر الإنجاز» / "Couldn't complete"**. Task becomes cancelled; the row dims and moves to "done".

### D. Claim an unassigned task (collaborator or manager)
1. Find an **open, unassigned** task (meta shows «غير مُسندة»); its row shows a teal **«أنا متكفّل»** pill.
2. Tap it. A `confirmAction` prompt appears: **«التكفّل بهذا العنصر؟»** with body «سيصبح «{title}» من مسؤوليتك.».
3. Confirm with **«أنا متكفّل»**. The task is assigned to you; the row silently re‑renders as «مُسندة إليك» and appears under «مهامي».
4. If someone else claimed it first, a warning sheet explains it was already taken («تم التكفّل بهذا العنصر من شخص آخر»); dismiss with «حسنًا».

### E. Reassign / edit a task (manager)
1. Tap a task row → `/tasks/{id}` (manager edit view).
2. Change any field — e.g. open the **Assignee** picker and select a different member (or «غير محدد» to unassign, «أنا» to take it).
3. Tap **«حفظ التغييرات» / "Save changes"**. On success shows «تم حفظ التغييرات».

### F. Update status from detail (assignee, non‑manager)
1. Tap a task row → `/tasks/{id}` (read‑only view). If you're the assignee of an open task, the note reads «يمكنك تحديث حالة المهمة فقط».
2. In the **Status** card tap **«تم الإنجاز»** or **«تعذّر الإنجاز»**.
3. Confirm inline (the confirm body + CTA replace the buttons). The status badge updates.

### G. Reopen a completed/cancelled task (manager)
1. Open a done/cancelled task's detail. In the Status card tap **«إعادة فتح المهمة» / "Reopen task"**.
2. The task returns to «مفتوحة»; terminal timestamps are cleared. (Managers only.)

### H. Delete a task (manager)
1. In the manager edit view, scroll to the delete card and tap **«حذف المهمة» / "Delete task"**.
2. Confirm with **«تأكيد الحذف» / "Confirm delete"** (or «إلغاء» to back out).
3. On success the app returns to the list.

### I. Switch scope and tabs (any assignable member)
1. On `/tasks`, use the **today / open / done** tabs to filter by time/status.
2. Use the **مهامي / كل المهام** scope toggle to switch between only‑your tasks and the whole circle. Managers default to «كل المهام»; collaborators to «مهامي». Read‑only followers see all with no toggle.
