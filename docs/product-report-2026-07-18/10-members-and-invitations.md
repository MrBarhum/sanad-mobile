# Circle Members, Roles & Invitations

This domain is the people layer of a care circle: who belongs, what each person may do, and how new people are brought in. It has three routed screens under the `circle-members/` nested stack — the **roster** (members list), the **invitations manager**, and the **invite-a-member form** — plus a **per-member actions bottom sheet** and a **created-code reveal** view. Any active member may *view* the roster (transparent-visibility posture); mutating controls (change role, remove, invite, revoke, transfer ownership) are gated to managers (admin / primary caregiver) and, for ownership transfer, to the circle owner. All copy is i18n-driven from `circleMembers.*`, `invitations.*`, `figma.members.*`, `assignment.*`, and `common.*`; both `ar.json` and `en.json` are quoted verbatim below.

Roles in the enum: `admin`, `primary_caregiver`, `family_member`, `caregiver`, `remote_member`, `elder`. Only four are ever assignable/invitable in the current build — `admin`, `primary_caregiver`, `family_member`, `remote_member`. `caregiver` and `elder` exist but are deferred (never offered) until their dedicated least-privilege RLS exists (`role-capabilities.ts:19-28`, `permissions.ts:22-32`, `invitations/api.ts:48-53`).

---

## Navigation container

**File**: `src/app/(app)/circle-members/_layout.tsx`

A nested Expo Router `Stack` under the `(app)` stack (which hides its own header for this group, `_layout.tsx:45` of `(app)`). It provides themed headers (background = `theme.background`, tint/title = `theme.text`, no shadow). Anchored to `index` for back-navigation (`unstable_settings.initialRouteName = 'index'`).

Three registered screens with native-header titles:
| Route | Native title key | ar | en |
|---|---|---|---|
| `index` | `circleMembers.title` | «الأعضاء» | "Members" |
| `invite` | `invitations.inviteTitle` | «دعوة عضو جديد» | "Invite a new member" |
| `invitations` | `invitations.manageTitle` | «الدعوات» | "Invitations" |

Note: both the roster (`FigmaMembers`) and the invite form (`InviteForm`) draw **their own** in-body headers, so the native title above is effectively superseded on those screens. The invite screen explicitly hides the native header (`invite.tsx:20`, `<Stack.Screen options={{ headerShown: false }} />`).

---

## Screen 1 — Members roster (`/circle-members`)

**Route & how reached**: `/circle-members`. Entry points:
- **Account tab** → "Care circles" section → a `FigmaListRow` (member icon, primary color) whose title is the active circle's name (fallback `circleMembers.title`) and subtitle is the circle subtitle or `circleMembers.subtitle` «العائلة ومقدّمو الرعاية في هذه الدائرة» / "Family and caregivers in this circle" (`account.tsx:136-142`).
- **Explore tab** → a members item (member icon, purple), title `circleMembers.title`, subtitle `figma.explore.items.members` (`explore.tsx:125-132`).
- **Home** quick-actions grid → members tile (member icon, gold), `circleMembers.title` (`figma-home.tsx:219`).

**Purpose**: View the care circle's people; managers get controls to invite, change roles, remove/reactivate, transfer ownership; any member can leave.

**Files**: `src/app/(app)/circle-members/index.tsx` → `CircleGate` → `src/features/circle-members/figma-members.tsx` (`FigmaMembers`).

### Gate & data
`index.tsx` wraps everything in `CircleGate`, which resolves the active circle and renders shared loading/error/no-circle states first (`circle-gate.tsx`):
- **Loading**: `LoadingState` (centered large spinner, `theme.primary`).
- **Error**: `ErrorState` — a warning `GlyphChip` (error tone, lg), message `careCircle.loadError`, and a retry button labeled `retry` «إعادة المحاولة» / "Retry".
- **No active circle**: `EmptyState` with member glyph and title `careCircle.noActiveCircle`.

Once a circle resolves, `FigmaMembers` gets `circleId`, `actorRole`, `circleName`, `recipientName`. It fetches the roster via `useCircleMembers` → `list_circle_members` RPC. `canManage = isManagerRole(actorRole)` (true only for `admin` / `primary_caregiver`).

Rows split into `active` (status `active`) and `inactive` (status ≠ active). **Inactive members are only fetched into view for managers** (`figma-members.tsx:93`) so they can reactivate them; collaborators never see removed members.

### Layout, top to bottom
1. **Header** (`FigmaHeader`, `figma-members.tsx:180`):
   - Round 44dp back button at the start (RTL right), icon `ArrowRight`, a11y label `common.back` «رجوع» / "Back".
   - Centered title `figma.members.title` = «دائرة الرعاية» / "Care circle".
   - **Add button** (round teal "+", `Plus` icon) — **managers only**; navigates to `/circle-members/invite`. A11y label `invitations.invite` «دعوة عضو» / "Invite member". Non-managers get an empty 44dp spacer instead.
2. **Roster body states**:
   - **Loading**: `SkeletonList` (shimmer placeholder rows).
   - **Error**: a `Surface` (card, radius lg, 20dp pad) with centered text `circleMembers.loadError` «تعذّر تحميل الأعضاء. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't load the members. Check your connection and try again." plus a teal retry pill labeled `retry`.
   - **Loaded** (below).
3. **Summary line** (`figma-members.tsx:201`): a soft primary-tinted pill (8% primary bg, 15% primary border) with `figma.members.summary` = «دائرة رعاية {{name}} · {{count}} أعضاء» / "{{name}}'s care circle · {{count}} members". `name` = recipient name (trimmed) or circle name; `count` = number of **active** members.
4. **"Manage invitations" button** (`Button` secondary) — **managers only** — label `circleMembers.manageInvitations` «إدارة الدعوات» / "Manage invitations"; navigates to `/circle-members/invitations`.
5. **Active member rows** (`styles.list`, 8dp gap) — one row per active member (see Row anatomy).
6. **Inactive section** (managers only, when any) — a section label `circleMembers.inactiveTitle` «غير نشطين» / "Inactive", then the inactive rows (dimmed to 65% opacity).
7. **Role legend card** (`Surface` card, radius xl, 16dp pad, `figma-members.tsx:231`): title `figma.members.rolesTitle` «الأدوار» / "Roles", then three color-dotted rows built from `figma.members.legend.*`:

| Dot color | Role name (bold) | Description |
|---|---|---|
| primary/teal | `legend.manager` «مسؤول» / "Manager" | `legend.managerDesc` «يمكنه إدارة كل شيء وإضافة أعضاء» / "Can manage everything and add members" |
| categoryGold | `legend.editor` «محرر» / "Editor" | `legend.editorDesc` «يمكنه إضافة وتعديل السجلات» / "Can add and edit records" |
| categoryPurple | `legend.viewer` «مشاهد» / "Viewer" | `legend.viewerDesc` «يمكنه الاطلاع على المعلومات فقط» / "Can only view information" |

Name and description are joined with `figma.members.legendSeparator` = `":"`. This legend is a plain-language grouping (manager/editor/viewer), not the exact role enum.

### Row anatomy (`renderRow`, `figma-members.tsx:98`)
Each member row is a horizontal card (`backgroundElement` bg, hairline border, radius lg, 56dp min height):
- **Letter avatar** — 48dp pill, background = role color at 15% alpha, showing the first grapheme of the display name (uppercased; `"?"` fallback).
- **Name row**: display name (from `memberDisplayName()`), plus a **"You" badge** for the viewer's own row — pill with `circleMembers.you` «أنت» / "You".
- **Meta row**:
  - Role icon (11dp) + **role label** in the role color, from `circleMembers.roles.<role>` (see role table below).
  - If inactive: a `·` separator + status text from `circleMembers.status.<status>` («نشط»/"Active", «مدعو»/"Invited", «مُزال»/"Removed").
  - If the member has both a full name and an email (email adds info beyond the name): a `·` separator + the email, LTR-isolated, selectable, in muted color. (Server masks email for non-managers/non-self, so a present email means the viewer is allowed to see it — `display-name.ts:1-13`.)
- **Trailing `MoreHorizontal` (⋯) icon** — shown **only** when the viewer has at least one available action on this member (`memberHasActions`). Rows with no available action render as a static `View` (not pressable); actionable rows are a `Pressable` with a11y hint `circleMembers.manage` «إدارة العضو» / "Manage member" that opens the actions sheet.

**Role visual mapping** (`roleVisual`, `figma-members.tsx:33`): `admin`/`primary_caregiver` → Crown icon + primary/teal; `family_member`/`caregiver` → Edit3 icon + gold; everything else (`remote_member`/`elder`) → Eye icon + purple. Status is always icon + text + color, never color-only.

### Role labels (`circleMembers.roles.*`)
| Role | ar | en |
|---|---|---|
| `admin` | مشرف | Administrator |
| `primary_caregiver` | مقدّم الرعاية الأساسي | Primary caregiver |
| `family_member` | فرد من العائلة | Family member |
| `caregiver` | مقدّم رعاية | Caregiver |
| `remote_member` | عضو عن بُعد | Remote member |
| `elder` | الشخص الذي تتم رعايته | Care recipient |

### Components used
`CircleGate`, `FigmaScreen`, `FigmaHeader`, `SkeletonList`, `Surface`, `Button`, `MemberActionsSheet` (⊃ `FigmaBottomSheet`, `Button`, `OptionSelect`), `GlyphChip`/lucide icons (Crown, Edit3, Eye, MoreHorizontal, Plus, ArrowRight), `isolateLtr`.

### Cross-links
→ `/circle-members/invite` (add button), → `/circle-members/invitations` (manage-invitations button), → member actions sheet (row tap), → `/` on self-leave.

---

## Screen 1a — Member actions bottom sheet (modal)

**File**: `src/features/circle-members/figma-member-actions.tsx` (`MemberActionsSheet`). Rendered by `FigmaMembers`; opens when an actionable row is tapped (`selected` member set). Built on `FigmaBottomSheet` (the canonical action-sheet chrome: rounded-top `backgroundElement` card over a scrim, 48×8 grab handle, `sectionTitle` header, backdrop-tap dismiss with a11y label `common.close` «إغلاق» / "Close").

**Purpose**: The single home for every membership mutation on one member — change role, reactivate, remove, leave (own row), transfer ownership.

It is a **stateful multi-mode sheet** (`mode`: `menu` | `role` | `remove` | `leave` | `owner`). A `shown` snapshot keeps content painted during slide-out. Each fresh open resets to `menu` with a clean role selection and no error (`figma-member-actions.tsx:92`).

The sheet **title** changes by mode: menu → the member's display name; `role` → `circleMembers.changeRoleTitle` «تغيير الدور» / "Change role"; `leave` → `circleMembers.leaveConfirmTitle` «مغادرة الدائرة» / "Leave circle"; `remove` → `circleMembers.remove` «إزالة» / "Remove"; `owner` → `circleMembers.makeOwner` «تعيين كمالك» / "Make owner".

### Mode: `menu`
- Subtitle line: the member's role label + (if owner) `· circleMembers.owner` «المالك» / "Owner".
- A **note** appears if owner (`circleMembers.ownerNote` «لا يمكن إزالة المالك أو تخفيض دوره. انقل الملكية إلى عضو آخر أولاً.» / "The owner can't be removed or demoted. Transfer ownership to another member first.") **or else** if last admin (`circleMembers.lastAdminNote` «لا يمكن إزالة آخر مشرف أو تخفيض دوره. أضف مشرفًا آخر أولاً.» / "The last administrator can't be removed or demoted. Add another admin first.").
- Action buttons (each conditional on a permission gate):

| Button | Label (ar / en) | Variant | Gate (`memberHasActions`/sheet gates) | Effect |
|---|---|---|---|---|
| Change role | `circleMembers.changeRole` «تغيير الدور» / "Change role" | secondary | `assignableRolesFor(actor,target)` non-empty AND not last-admin AND not owner | → `role` mode |
| Make owner | `circleMembers.makeOwner` «تعيين كمالك» / "Make owner" | secondary | viewer is owner AND target not owner AND not self AND active | → `owner` confirm |
| Reactivate | `circleMembers.reactivate` «إعادة تفعيل» / "Reactivate" | secondary | `canChangeStatus` AND target not active | immediate `update_circle_member_status(active)` |
| Remove | `circleMembers.remove` «إزالة» / "Remove" | danger | not self AND `canChangeStatus` AND active AND not last-admin AND not owner | → `remove` confirm |
| Leave circle | `circleMembers.leave` «مغادرة الدائرة» / "Leave circle" | danger | is self AND active AND not last-admin AND not owner | → `leave` confirm |

**Reactivate** is the only immediate mutation (no second step); everything destructive/irreversible gets a confirm mode. Any failure shows an inline `accessibilityRole="alert"` error resolved via `memberErrorKey` (see error table).

### Mode: `role` (change role)
- Hint: `circleMembers.changeRoleHint` «اختر الدور الجديد لهذا العضو.» / "Choose the new role for this member."
- **`OptionSelect` variant="card"** (radio cards) listing the assignable roles from `assignableRolesFor(actorRole, target)`; each card shows the role title (`circleMembers.roles.<r>`) + description (`circleMembers.roleDescriptions.<r>`):

| Role | roleDescriptions ar | en |
|---|---|---|
| `admin` | صلاحية كاملة — يدير الدائرة والأعضاء وكل بيانات الرعاية. | Full access — manages the circle, members, and all care data. |
| `primary_caregiver` | يدير الرعاية اليومية ويمكنه إدارة الأعضاء والدعوات. | Manages day-to-day care and can manage members and invitations. |
| `family_member` | يتابع بيانات الرعاية ويمكنه تسجيل المستجدّات. | Follows the care data and can record updates. |
| `remote_member` | يتابع دائرة الرعاية عن بُعد. | Follows the care circle from afar. |

- **Assignable set** (`permissions.ts:24`): an `admin` may assign `admin`, `primary_caregiver`, `family_member`, `remote_member`. A `primary_caregiver` may assign only `family_member`, `remote_member` — and may not modify a manager peer at all (returns empty). Never offers `caregiver`/`elder`.
- **Live direction note** (only when the selection differs from current), from `circleMembers.direction.<direction>`:
  - `increase` — «هذا يمنح العضو صلاحيات أوسع مما لديه الآن.» / "This gives the member more access than they have now."
  - `decrease` — «هذا يقلّل صلاحيات العضو.» / "This reduces the member's access."
  - `lateral` — «هذا يغيّر دور العضو دون رفع أو خفض صلاحياته.» / "This changes the member's role without raising or lowering their access."
- **Save** button `circleMembers.saveRole` «حفظ تغيير الدور» / "Save role change" → `update_circle_member_role`. If nothing changed it just returns to menu.
- **Cancel** button `common.cancel` «إلغاء» / "Cancel" → back to menu.

### Modes: `remove` / `leave` / `owner` (confirm bodies)
Two-step confirm: a body paragraph, an optional inline error, a primary/danger action button, and a `common.cancel` back-to-menu button.

| Mode | Body copy (ar / en) | Confirm button (ar / en) | Variant | Mutation |
|---|---|---|---|---|
| `remove` | `removeConfirmBody` «سيُزال {{name}} من هذه الدائرة ولن يستطيع رؤية بياناتها. يمكنك دعوته مجدّدًا لاحقًا.» / "{{name}} will be removed from this circle and will no longer see its data. You can invite them again later." | `confirmRemove` «تأكيد الإزالة» / "Confirm removal" | danger | `update_circle_member_status(removed)` |
| `leave` | `leaveConfirmBody` «لن تعود ترى بيانات هذه الدائرة بعد مغادرتها. يمكن لأحد المديرين دعوتك مجدّدًا.» / "You'll no longer see this circle's data after leaving. A manager can invite you again." | `confirmLeave` «تأكيد المغادرة» / "Confirm leaving" | danger | `leave_care_circle`; on success parent `router.replace('/')` |
| `owner` | `makeOwnerConfirmBody` «سيصبح {{name}} مالك الدائرة، وستفقد أنت صلاحيات المالك. يبقى دورك كما هو.» / "{{name}} will become the circle owner and you'll lose owner privileges. Your role stays the same." | `confirmMakeOwner` «تأكيد النقل» / "Confirm transfer" | primary (non-danger) | `transfer_circle_ownership` |

### Membership error mapping (`memberErrorKey`, `api.ts:81` → `circleMembers.errors.*`)
| Condition | Key | ar | en |
|---|---|---|---|
| message contains "owner" | `errors.owner` | انقل الملكية إلى عضو آخر قبل تنفيذ هذا الإجراء. | Transfer ownership to another member before this can be done. |
| SQLSTATE 23514 / "last admin" | `errors.lastAdmin` | هذا سيترك الدائرة دون مشرف. | This would leave the circle without an administrator. |
| 42501 / "cannot" / "only" | `errors.notAllowed` | لا تملك صلاحية تنفيذ هذا الإجراء. | You don't have permission to do that. |
| fallback | `errors.generic` | تعذّر إكمال التغيير. تحقّق من الاتصال وحاول مجددًا. | We couldn't complete the change. Check your connection and try again. |

### Components used
`FigmaBottomSheet`, `Button` (secondary/danger/primary), `OptionSelect` (card variant). Display name inside the sheet uses `shown.fullName?.trim() || shown.email || circleMembers.unnamed` — note this uses the **full email** as a fallback, unlike the roster's `memberDisplayName` which uses only the local-part.

---

## Screen 2 — Invitations manager (`/circle-members/invitations`)

**Route & how reached**: `/circle-members/invitations`. Reached from the roster's "Manage invitations" button (managers only).

**Purpose**: List a circle's invitations and revoke pending ones.

**Files**: `src/app/(app)/circle-members/invitations.tsx` → `CircleGate` → gate on `circle.canManage`; managers get `InvitationsList` (`src/features/invitations/invitations-list.tsx`), non-managers get a centered `EmptyState` with title `invitations.managersOnly` «إدارة الدعوات متاحة للمشرف ومقدّم الرعاية الأساسي فقط» / "Only the admin and primary caregiver can manage invitations".

### Layout & states (`InvitationsList`)
Data via `useCircleInvitations` → `list_circle_invitations` RPC.
- **Loading**: `LoadingState` spinner.
- **Error**: `ErrorState` — warning glyph, message `invitations.loadError` «تعذّر تحميل الدعوات. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't load the invitations. Check your connection and try again.", retry button `retry`.
- **Top action**: a full `Button` labeled `invitations.invite` «دعوة عضو» / "Invite member" → `/circle-members/invite`.
- **Inline revoke error** (if a revoke fails): `invitations.revokeFailed` «تعذّر إلغاء الدعوة. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't revoke the invitation. Check your connection and try again." rendered as `accessibilityRole="alert"`.
- **Empty**: `EmptyState` (member glyph) — title `invitations.emptyTitle` «لا دعوات بعد» / "No invitations yet", subtitle `invitations.emptySubtitle` «يمكن إنشاء دعوة لانضمام فرد من العائلة أو مقدّم رعاية إلى الدائرة.» / "Create an invitation to bring a family member or caregiver into the circle."
- **Populated**: a `Surface` card per invitation (`InvitationCard`).

### Invitation card (`InvitationCard`, `invitations-list.tsx:94`)
- **Header row**: a `GlyphChip` (member glyph, primary tone, sm) + a title = `invitedName` (trimmed) or, if none, the role label `circleMembers.roles.<role>` + a `StatusBadge`.
- **Status badge** tone map (`STATUS_TONE`): `pending`→info, `accepted`→success, `revoked`→error, `expired`→warning. Label from `invitations.status.<status>`:

| status | ar | en |
|---|---|---|
| `pending` | قيد الانتظار | Pending |
| `accepted` | مقبولة | Accepted |
| `revoked` | ملغاة | Revoked |
| `expired` | منتهية | Expired |

- **Role line** (always): `invitations.roleLabel` «الدور: {{role}}» / "Role: {{role}}".
- **Expiry line** (pending only): `invitations.expiresLabel` «ينتهي في: {{date}}» / "Expires: {{date}}" — date via `ymdFromInstant(expiresAt)`.
- **Accepted-by line** (accepted + has acceptedByName): `invitations.acceptedByLabel` «انضم {{name}} في {{date}}» / "Joined by {{name}} on {{date}}".
- **Created-by line** (when createdByName present): `invitations.createdByLabel` «أنشأها {{name}}» / "Created by {{name}}".
- **Revoke action** (pending only) — **inline two-step confirm** in a bordered actions row:
  1. First tap: a danger `Button` (sm) `invitations.revoke` «إلغاء» / "Revoke" → enters confirming state.
  2. Confirming: a danger `Button` `invitations.confirmRevoke` «تأكيد الإلغاء» / "Confirm revoke" (calls `revoke_circle_invitation`) + a secondary `Button` `common.cancel` «إلغاء» / "Cancel".

Non-pending invitations show no action row.

### Components used
`CircleGate`, `Screen`, `Button`, `Surface`, `GlyphChip`, `StatusBadge`, `EmptyState`/`ErrorState`/`LoadingState`, `ThemedText`.

### Cross-links
→ `/circle-members/invite`.

---

## Screen 3 — Invite a member (`/circle-members/invite`)

**Route & how reached**: `/circle-members/invite`. Reached from the roster's add "+" button and from the invitations manager's "Invite member" button (both managers-only paths).

**Purpose**: Create a one-time invitation code granting a chosen role.

**Files**: `src/app/(app)/circle-members/invite.tsx` → `CircleGate` → gate on `circle.canManage` (non-managers see the same `invitations.managersOnly` `EmptyState`) → `InviteForm` (`src/features/invitations/invite-form.tsx`). The native header is hidden; the form draws its own via `FigmaFormScreen`.

### Layout (form state)
`FigmaFormScreen` chrome: a fixed header (round 44dp back button + title), an optional full-bleed **gold disclaimer banner**, a scrolling stack of cards, and the primary CTA as the last body block.
- **Header title**: `invitations.inviteTitle` «دعوة عضو جديد» / "Invite a new member". Back button → `router.back()`.
- **Gold disclaimer banner**: `invitations.warning` «أي شخص يملك هذا الرمز يمكنه الانضمام إلى الدائرة والاطّلاع على معلومات رعاية حسّاسة. شاركه فقط مع من تثق بهم.» / "Anyone with this code can join the circle and see sensitive care information. Share it only with people you trust."
- **Role card** (`Surface` card): group label `invitations.fields.role` «الدور في الدائرة» / "Role in the circle", then an **`OptionSelect` variant="card"** of the invitable roles (radio cards: title + description). Default selection prefers `family_member`, else the first allowed role.
- **Reference-name card** (`Surface` card): a single `FormField` (see form table).
- **Inline error** (on failure): `invitations.createFailed` «تعذّر إنشاء الدعوة. تحقّق من الاتصال وحاول مجددًا.» / "We couldn't create the invitation. Check your connection and try again." (`accessibilityRole="alert"`).
- **Primary CTA**: `FigmaFooterPrimaryButton` labeled `invitations.create` «إنشاء دعوة» / "Create invitation" (full-width 56dp teal button, loading spinner blocks double-submit; no disabled state).

### Form fields
| # | Field | Label (ar / en) | Type | Req | Placeholder / hint | Default |
|---|---|---|---|---|---|---|
| 1 | Role | `fields.role` «الدور في الدائرة» / "Role in the circle" | Single-choice cards (`OptionSelect`) | required (always has a value) | — | `family_member` (or first allowed) |
| 2 | Reference name | `fields.invitedName` «اسم مرجعي (اختياري)» / "Reference name (optional)" | text (`FormField`) | optional | placeholder `placeholders.invitedName` «مثال: ابنتي نورة» / "e.g. my daughter Noura"; hint `helpers.invitedName` «فقط لتذكيرك — لن يراه المدعو» / "For your reminder only — the invitee won't see it" | empty |

On submit, `invitedName` is trimmed; empty → `null`. Calls `create_circle_invitation` (`useCreateInvitation`).

**Invitable roles** (`invitableRoles`, `invitations/api.ts:48`): an `admin` may invite `primary_caregiver`, `family_member`, `remote_member`. A `primary_caregiver` may invite only `family_member`, `remote_member`. `admin` is **never** invitable; `caregiver`/`elder` are never offered. Same `roleDescriptions.*` copy as the role sheet (plus `primary_caregiver`: «يدير الرعاية اليومية ويمكنه إدارة الأعضاء والدعوات.» / "Manages day-to-day care and can manage members and invitations.").

### Screen 3a — Created-code reveal (`CreatedCard`)
On success the form swaps to `CreatedCard` (same `FigmaFormScreen` shell). The **raw code is shown only once**.
- **Header title**: `invitations.createdTitle` «رمز الدعوة» / "Invitation code". Back button → resets to the form (`onReset`).
- **Gold disclaimer**: `invitations.codeOnceWarning` «يظهر هذا الرمز الآن فقط ولا يمكن استرجاعه لاحقًا. إذا فُقد، ألغِ الدعوة وأنشئ واحدة جديدة.» / "This code is shown only now and can't be retrieved later. If it's lost, revoke it and create a new one."
- **Muted subtitle** (`FigmaMutedNote`): `invitations.createdSubtitle` «شارك هذا الرمز مع الشخص الذي تدعوه. يُستخدم مرة واحدة.» / "Share this code with the person you're inviting. It works once."
- **Code card** (`Surface`): a large sunken box showing the code (28dp bold, letter-spaced, LTR-isolated, selectable). Below it: role line `invitations.roleLabel` and expiry line `invitations.expiresLabel` (date via `ymdFromInstant`).
- **Feedback line** (after copy/share): success-colored, `accessibilityLiveRegion="polite"`.
- **Action buttons** (stacked):

| Button | Label (ar / en) | Action |
|---|---|---|
| Share via WhatsApp | `shareWhatsApp` «مشاركة عبر واتساب» / "Share via WhatsApp" | `shareViaWhatsApp(whatsappMessage)` (see below); on return sets feedback `invitations.shared` «تم فتح المشاركة» / "Opened share" |
| Copy code (secondary) | `copy` «نسخ الرمز» / "Copy code" | `copyInviteCode(code)`; on success feedback `invitations.copied` «تم نسخ الرمز» / "Code copied" |
| Share (secondary) | `share` «مشاركة» / "Share" | `shareInviteMessage(shareMessage)`; feedback `invitations.shared` |
| Create another (secondary) | `createAnother` «إنشاء دعوة أخرى» / "Create another" | `onReset` → back to blank form |

- **Plain share message** (`shareMessage`): «انضم إلى دائرة الرعاية في سند بهذا الرمز: {{code}}» / "Join our care circle on Sanad with this code: {{code}}".
- **Rich WhatsApp message** (`whatsappMessage`) includes circle name, inviter name (`profile.fullName` → email local-part → `assignment.unknownMember` «عضو» / "Member"), the code, numbered join steps, and a deep link built with `Linking.createURL('/join-circle', { code })`. ar/en both multi-line with numbered steps «١) ثبّت تطبيق سند…» / "1) Install Sanad…".

**Share mechanics** (`invitations/share.ts`): native uses the OS `Share.share` / `whatsapp://send` scheme (falls back to OS share sheet if WhatsApp is missing); web uses the Web Share API / `wa.me` / Clipboard API. Copy on native has no clipboard dependency, so it falls back to the OS share sheet. The raw code is never logged.

### Components used
`CircleGate`, `FigmaFormScreen` (⊃ `FigmaMutedNote`), `Surface`, `FormField`, `OptionSelect` (card), `FigmaFooterPrimaryButton`, `Button`, `LtrText`.

---

## Roles & permissions model (reference)

Two authoritative gate modules power the UI; the server RPCs/RLS remain the true authority.

**`circle-members/permissions.ts`**
- `isManagerRole(role)` — true for `admin` / `primary_caregiver`. Drives `canManage` (add button, manage-invitations link, inactive list, all mutations).
- `activeAdminCount` / `isLastActiveAdmin` — last-admin protection; blocks removing/demoting the sole active admin.
- `assignableRolesFor(actor, target)` — see role-change table above.
- `canChangeStatus(actor, target)` — managers only; a non-admin manager cannot change an admin's status; a primary caregiver cannot change a manager peer's status.

**`circle-selection/permissions.ts`** (circle-level derived flags on `ActiveCircle`):
- `canManageCircle` = admin / primary_caregiver → `canManage`.
- `canLogDoses` = admin / primary_caregiver / family_member / caregiver.
- `isAdminRole` = admin only.

**`role-capabilities.ts`** — the documentation model (`circleMembers.capabilities.*`) with `summary`/`can[]`/`cannot[]` bullets per role, and `ASSIGNABLE_ROLE_ORDER` = `[admin, primary_caregiver, family_member, remote_member]`. `roleChangeDirection` (rank admin 4 → remote 1) powers the increase/decrease/lateral note. (These capability strings exist in i18n but are not directly rendered by the four files in this domain's screens — they back an explanatory role-picker surface.)

**Who can do what (summary)**
| Action | Who |
|---|---|
| View roster | any active member |
| See inactive/removed members | managers only |
| Invite / create invitation | managers (admin invites down to primary_caregiver; primary_caregiver invites only family/remote) |
| Manage/revoke invitations | managers |
| Change a member's role | managers, within `assignableRolesFor` (never last-admin, never owner) |
| Remove a member | managers (not self, not last-admin, not owner) |
| Reactivate a removed member | managers |
| Leave the circle | any active member on their own row (not last-admin, not owner) |
| Transfer ownership | the circle **owner** only |

**Display-name resolution** (`display-name.ts`): full name (trimmed) → email **local-part** (before `@`) → caller's neutral fallback (`circleMembers.unnamed` «عضو» / "Member"). The roster never renders a full email as the name and only shows the full email as a secondary meta line when both name and email exist. (The actions sheet is the one exception — it falls back to the full email string.)

---

## Workflows

### 1. View the care circle roster
1. From Account / Explore / Home, tap the members entry → `/circle-members`.
2. `CircleGate` resolves the active circle (loading spinner → error+retry, or no-circle empty as applicable).
3. Roster loads (skeleton → error+retry, or content). See the summary line, active member rows (avatar, name, "You" badge, role icon+label, optional email), the role legend, and — for managers — a manage-invitations button and any inactive members.

### 2. Change a member's role (manager)
1. On the roster, tap an actionable row (⋯ visible) → actions sheet opens on `menu`.
2. Tap "Change role" `circleMembers.changeRole` → `role` mode.
3. Pick a new role card; read the live direction note (increase/decrease/lateral) if it changed.
4. Tap "Save role change" `circleMembers.saveRole` → `update_circle_member_role`. On success the sheet closes and the roster refreshes; on failure an inline alert shows the mapped error.

### 3. Remove a member (manager)
1. Tap the row → sheet menu → tap "Remove" `circleMembers.remove` (danger) → `remove` confirm.
2. Read `removeConfirmBody` (names the member) → tap "Confirm removal" `circleMembers.confirmRemove` → status set to `removed`.
3. Sheet closes; member moves to the (manager-only) inactive list.

### 4. Reactivate a removed member (manager)
1. Scroll to the "Inactive" section; tap the dimmed row → sheet menu.
2. Tap "Reactivate" `circleMembers.reactivate` → immediate `update_circle_member_status(active)` (no second step). Member returns to the active list.

### 5. Transfer ownership (owner only)
1. Owner taps another active member's row → sheet menu → "Make owner" `circleMembers.makeOwner` → `owner` confirm.
2. Read `makeOwnerConfirmBody` → tap "Confirm transfer" `circleMembers.confirmMakeOwner` → `transfer_circle_ownership`. The target becomes owner; the previous owner loses owner privileges (role unchanged).

### 6. Leave the circle (any active member)
1. Tap your own row (⋯ visible when leaving is allowed) → sheet menu → "Leave circle" `circleMembers.leave` (danger) → `leave` confirm.
2. Read `leaveConfirmBody` → tap "Confirm leaving" `circleMembers.confirmLeave` → `leave_care_circle`. On success the app navigates to `/` (home) and all circle-scoped queries refresh. (Blocked for the last admin and the owner — those rows expose no leave action and show the owner/last-admin note.)

### 7. Invite a member and reveal the code (manager)
1. From the roster tap "+" (or from the invitations manager tap "Invite member") → `/circle-members/invite`.
2. Read the gold sensitive-data warning. Pick a role card. Optionally enter a private reference name.
3. Tap "Create invitation" `invitations.create` → `create_circle_invitation`.
4. The reveal screen appears with the one-time code, its role and expiry. Share via WhatsApp (rich message with deep link), Copy, or Share (plain message) — confirmation shows «تم نسخ الرمز» / «تم فتح المشاركة».
5. Optionally tap "Create another" to issue another invitation.

### 8. Revoke a pending invitation (manager)
1. Open `/circle-members/invitations` (roster → "Manage invitations").
2. On a pending card tap "Revoke" `invitations.revoke` → the card enters confirm state.
3. Tap "Confirm revoke" `invitations.confirmRevoke` → `revoke_circle_invitation`; the list refreshes. (Cancel returns to the single Revoke button.) A failure shows the inline `revokeFailed` alert.

### 9. Non-manager hits a managers-only screen
1. A collaborator navigating to `/circle-members/invitations` or `/circle-members/invite` sees a centered `EmptyState` titled `invitations.managersOnly` — no controls. (On the roster itself collaborators still see everyone, just without the add/manage/role/remove affordances.)
