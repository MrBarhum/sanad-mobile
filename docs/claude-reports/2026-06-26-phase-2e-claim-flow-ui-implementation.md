# Phase 2E-2 — "متاح للتكفّل" / Available-to-Claim: UI + app API wiring

**Baseline:** `87e5a8c docs(product): verify responsibility-based RLS hardening`.
**Server context:** Phase 2E-1 SQL is already applied + verified in the Sanad Supabase Dashboard (see `…-applied-verification.md`). This phase wires the app to those live RPCs and closes the two UI/permission gaps the server hardening opened.
**Constraints:** no commit, no stage, no EAS/prebuild/CLI/SQL, no Supabase connection outside app code, no `.env`/secrets, no dependency/native/Expo-config/backend/generated-types/migration changes. Only app source + this report. Stayed inside `E:\Projects\sanad-mobile`.

---

## 1. Files changed

### New (feature module + route)
| File | Purpose |
| --- | --- |
| `src/features/claiming/types.ts` | `AvailableClaimItem` + `ClaimItemType` — local types for the `list_available_to_claim` row shape (generated Supabase types intentionally not regenerated). |
| `src/features/claiming/api.ts` | The **single** localized RPC boundary: `callClaimRpc` wrapper (one cast around the typed client), `listAvailableToClaim`, four `claim*` functions + `claimAvailableItem` dispatcher, and `setAssignedAppointmentOutcome`. |
| `src/features/claiming/hooks.ts` | React Query `useAvailableToClaim` (feed) + `useClaimItem` (mutation, invalidates the feed and the four operational roots). |
| `src/features/claiming/figma-available-to-claim.tsx` | The `متاح للتكفّل` screen — grouped feed, `أنا متكفّل` CTA, loading/error/empty/notice states, refresh-on-focus. |
| `src/app/(app)/available-to-claim.tsx` | Route wrapper (`CircleGate` → screen), gates `canClaim = canManage || canLogDoses`. |

### Modified
| File | Change |
| --- | --- |
| `src/app/(app)/_layout.tsx` | Registered `available-to-claim` in the Stack with `headerShown: false` (screen draws its own `FigmaHeader`). |
| `src/features/appointments/hooks.ts` | Added `useSetAppointmentOutcome` (calls `set_assigned_appointment_outcome`). |
| `src/features/appointments/appointment-editor.tsx` | Threaded `canCollaborate`; assigned member can now mark completed/cancelled via the outcome RPC; reopen stays manager-only (direct). Read-only note switches to "status only" for the assignee. |
| `src/app/(app)/appointments/[id].tsx` | Passes `canCollaborate={circle.canLogDoses}`. |
| `src/features/visits/visit-editor.tsx` | Detail edit + delete are now **manager-only**; a linked visitor gets a status-only view (complete/cancel), no delete, no detail edit; reopen gated to managers. |
| `src/features/care-circle/figma-home.tsx` | Added the accent "متاح للتكفّل" entry card, shown only to claim-capable members. |
| `src/locales/ar.json`, `src/locales/en.json` | New `claiming` namespace; clearer appointment/visit outcome labels + `statusOnly` notes. |

---

## 2. API functions added / changed

**`src/features/claiming/api.ts`** (all six RPC casts confined here):
- `callClaimRpc<T>(fn, args)` — the only place casting around the generated client; throws the raw PostgREST error so callers can branch on `error.code`.
- `listAvailableToClaim(circleId) → AvailableClaimItem[]` → `list_available_to_claim(p_circle_id)`.
- `claimCareTask(id)`, `claimMedicationResponsibility(id)`, `claimCareAppointment(id)`, `claimFamilyVisit(id)` → the four `claim_*` RPCs.
- `claimAvailableItem(item)` — maps `item_type` → the correct RPC (`task→claim_care_task`, `medication→claim_medication_responsibility`, `appointment→claim_care_appointment`, `visit→claim_family_visit`).
- `setAssignedAppointmentOutcome(id, 'completed'|'cancelled')` → `set_assigned_appointment_outcome(p_appointment_id, p_status)`.

**`src/features/claiming/hooks.ts`:** `useAvailableToClaim`, `useClaimItem` (on success invalidates `['available-to-claim']`, `['tasks']`, `['appointments']`, `['medications']`, `['visits']` so a claimed item leaves the feed and appears in the owner's normal screen).

**`src/features/appointments/hooks.ts`:** `useSetAppointmentOutcome` (RPC, completed/cancelled). `useSetAppointmentStatus` retained for the manager reopen path (→ scheduled), which the RPC intentionally rejects.

Medication dose logging is **unchanged** — once a member claims a medication (`responsible_user_id = me`), the existing responsibility-gated dose UI on Home / Medications lets them log given/missed/postponed; no medication screen edit was needed.

---

## 3. Navigation / screen added

- New route `/available-to-claim` (`src/app/(app)/available-to-claim.tsx`), pushed from the Home entry card.
- Uses the existing `CircleGate` + `FigmaScreen`/`FigmaHeader` conventions; back button is automatic. Registered in `(app)/_layout.tsx` with `headerShown: false`.
- One **unified feed** surface (not per-center), grouped into `مهام` / `أدوية` / `مواعيد` / `زيارات` sections in that fixed order, each with a count.

---

## 4. Role gating behavior

Uses the existing permission helpers (`permissions.ts` → `ActiveCircle.canManage` / `canLogDoses`) — no parallel permission system introduced.

- **Home entry card** renders only when `circle.canManage || circle.canLogDoses` → hidden for `remote_member` and `elder`.
- **Claim route** passes `canClaim = canManage || canLogDoses`. If a read-only member deep-links in, the screen shows a neutral "not available for your role" state and never issues the feed query; the RPC would also reject them (`42501`) as defense-in-depth.
- **Claim-capable set** (matches the server): `admin`, `primary_caregiver`, `family_member`, and `caregiver` (present in helpers, no special UI). **Not** claim-capable: `remote_member`, `elder`.
- **Outcome/detail gating:** managers keep full edit/delete on appointments and visits. A non-manager who is the **assignee** (appointment) or **linked visitor** (visit) can set the outcome only. Medication responsible users log doses only. Detail editing and delete stay manager-only everywhere (mirrors the server's status-only triggers + manager-only delete).

---

## 5. Claim error mapping

`claim.mutateAsync` rejects with the raw PostgREST error; the screen branches on `error.code`:

| Condition | SQLSTATE | Copy shown | Follow-up |
| --- | --- | --- | --- |
| Someone else already claimed | `23505` | `تم التكفّل بهذا العنصر من شخص آخر` / *Someone else already claimed this item* (warning tone) | refetch feed |
| Success | — | `تم التكفّل بهذا العنصر` / *You've taken responsibility…* (success tone) | invalidation drops the item, it appears in the owner's screen |
| Any other error (`42501`, network, …) | * | `تعذّر التكفّل، حاول مرة أخرى` / *Could not claim this item. Please try again.* (error tone) | — |

Feed load failure → `claiming.loadError` + a Retry button. Feedback is a live-region notice card (`accessibilityLiveRegion="polite"`), icon + text + color (never color-only).

---

## 6. Appointment outcome RPC wiring

- `StatusSection` in `appointment-editor.tsx` now takes `canMarkOutcome` (manager **or** assignee) and `canReopen` (manager only).
- **Scheduled + `canMarkOutcome`** → "تم الموعد" / "تعذّر الموعد" call `set_assigned_appointment_outcome(id, 'completed'|'cancelled')`. Server-side the RPC allows a manager or the assignee, only from `scheduled`, and writes only the status — so an assigned family member records the outcome **without** permission to edit any appointment detail.
- **Closed + `canReopen`** (managers) → reopen via the direct manager update (`setAppointmentStatus('scheduled')`); the outcome RPC deliberately does not allow reopening, so this stays a manager path.
- The assigned member reaches this via the read-only detail screen, whose note now reads "you can update the appointment status only".

---

## 7. Visit delete / detail safety adjustment

Phase 2E-1 removed the own-visit DELETE policy and added a status-only trigger, so the previous UI (which gave a linked visitor the full edit screen incl. delete + field editing) would now hit server errors. Fix in `visit-editor.tsx`:

- The full editor (`FigmaVisitFields` + relink + **delete**) is now rendered for `canManage` **only**.
- A linked visitor (`canCollaborate && isOwner`) gets the read-only view with a **status-only** action row (mark completed/cancelled) — no delete affordance, no detail fields.
- `StatusSection` gained `canMarkOutcome` / `canReopen`: a linked visitor can move `planned → completed/cancelled` (a plain status write the server trigger permits) but **cannot reopen** a closed visit (manager-only). The view note reads "you can update the visit status only".

---

## 8. Localization

New `claiming` namespace (ar + en): `title` (`متاح للتكفّل`), `cta` (`أنا متكفّل`), `ctaHint`, `entryTitle`/`entrySubtitle` (Home card), `sections.{tasks,medications,appointments,visits}`, `loadError`, `empty` (`لا توجد عناصر متاحة للتكفّل الآن`), `notAllowed`, `claimSuccess`, `alreadyClaimed` (`تم التكفّل بهذا العنصر من شخص آخر`), `claimFailed` (`تعذّر التكفّل، حاول مرة أخرى`).

Outcome labels updated for clarity + added `statusOnly` notes:
- `appointments.markCompleted` → `تم الموعد` / "Mark completed"; `appointments.markCancelled` → `تعذّر الموعد` / "Couldn't attend"; `appointments.statusOnly`.
- `visits.markCompleted` → `تمت الزيارة` / "Mark completed"; `visits.markCancelled` → `تعذّرت الزيارة` / "Couldn't visit"; `visits.statusOnly`.

All numerals stay Western digits; times/dates are LTR-isolated with `isolateLtr` inside Arabic.

---

## 9. Validation commands run & results

| Command | Result |
| --- | --- |
| `npm run check:mojibake` | ✅ scanned 266 files — "No strong mojibake signatures found." |
| `git -c core.autocrlf=false diff --check` | ✅ clean (no whitespace/encoding issues) |
| `npx tsc --noEmit` | ✅ exit 0 — no type errors |
| `npx eslint <changed files>` | ✅ exit 0 — no lint errors/warnings |

Not run (per constraints): EAS, prebuild, Supabase CLI, SQL, `expo-doctor`/dev server (no dependency/native change was made, so no rebuild is required — all changes are JS/TS/JSON that reload through Metro).

---

## 10. Manual QA checklist (`[QA]` users, circle `رعاية الوالد الغالي`)

> Note: `list_available_to_claim` returns **all** live claimable items in the circle (not only `[QA]` rows), so expect ~15 items in the QA circle (existing unassigned + the `[QA]` unowned rows), grouped by type.

- [ ] **family1** — Home shows the "متاح للتكفّل" card; opening it lists unowned items grouped مهام/أدوية/مواعيد/زيارات with counts.
- [ ] **family1 claims a task** → success notice, task leaves the feed, appears in **my tasks** (assigned, open); can then mark تم الإنجاز/تعذّر الإنجاز.
- [ ] **family1 claims a medication** (e.g. فيتامين د) → appears in **today's doses**; register أُعطيت/لم تُعطَ/مؤجلة works; cannot edit the medication.
- [ ] **family1 claims an appointment** → appears in **my appointments**; open it → "status only" note + تم الموعد/تعذّر الموعد via the RPC; no detail editing, no delete.
- [ ] **family1 claims a visit** → appears in **my visits**; open it → status-only actions تمت الزيارة/تعذّرت الزيارة; **no delete**, no detail fields.
- [ ] **Race** — family1 + family2 claim the same item near-simultaneously → one succeeds; the other shows `تم التكفّل بهذا العنصر من شخص آخر` and the item refreshes out of the feed.
- [ ] **Manager (admin/primary)** — still sees the full editor: edit details, reassign/relink, delete, mark outcomes; the "All medications" catalog is intact; a manager may also open the claim feed.
- [ ] **remote1** — **no** "متاح للتكفّل" card on Home; deep-linking `/available-to-claim` shows the neutral not-available state; remote never becomes an owner.
- [ ] **family2** — symmetric to family1; sees none of family1's owned items.
- [ ] **RTL / dark mode / S24 Ultra** — feed cards, section headers, CTA, and notice render RTL with Western digits; date/time LTR-isolated; touch targets ≥52 dp (CTA); no clipping.

---

## Sanad UI/UX change report

### What changed
- Added a unified `متاح للتكفّل` feed screen + Home entry card; wired appointment outcomes to the assignee-safe RPC; made visit detail/delete manager-only with a status-only path for linked visitors; added claiming locale keys.

### Why
- Phase 2E-1 made unowned items claimable and tightened server permissions; the app needed a discovery surface and needed its editors to match the new "outcome-only for owners, details for managers" reality (clarity + trust: no dead buttons that fail server-side).

### Design rules honored
- **RTL/Arabic:** RTL-first layout via `FigmaScreen`/`FigmaHeader`; all times/dates/counts LTR-isolated with `isolateLtr`; Western digits.
- **Accessibility:** primary CTA ≥52 dp; status/notice = icon + text + color (never color-only); `accessibilityRole`/`accessibilityLabel`/`accessibilityHint` on actions; polite live region for claim feedback; clear loading/error/empty states.
- **Icons/encoding:** all icons via `lucide-react-native` (existing dep) — `HandHelping`, `ListChecks`, `Pill`, `Calendar`, `Users`, `Clock`, `Check`, `AlertCircle`; no raw Unicode literals; mojibake check clean; UTF-8/LF intact.
- **Tokens:** all color/spacing/radius/font from `figma-tokens` (`FigmaColors`, `FigmaCategory`, `FigmaRadius`, `FigmaFont`, `withAlpha`); the entry card uses the `accent` token ("needs attention / act now"), no hardcoded values.
- **Medical safety:** no interpretation; copy describes taking responsibility / recording outcomes only.

### Preserved (no regressions)
- [x] Date/time picker code untouched.
- [x] Notification opt-in / channel-before-permission untouched.
- [x] Validation passes (`tsc --noEmit`, `eslint`, `check:mojibake`, `git diff --check`).
- [x] Home stays today-first (a single calm card added below the quick-actions grid — not a new feature-button grid).

### Needs real-device check (S24 Ultra, AR/RTL/dark)
- Claim feed grouping/counts, CTA loading + success/already-claimed notices, refresh-on-focus after a claim.
- Assigned-user appointment outcome buttons; linked-visitor status-only visit screen (no delete affordance).
- remote_member: no Home card, neutral state on deep-link.

### Constraints respected
- [x] No backend/secret/deploy actions; no SQL/CLI.
- [x] No new dependencies (reused `lucide-react-native`, `@tanstack/react-query`, `expo-router`).
- [x] No `git add` / no stage / no commit / no push.
- [x] Stayed inside `E:\Projects\sanad-mobile`.

### Open questions / suggested follow-ups
- Optional: show a live count badge on the Home "متاح للتكفّل" card (adds one feed query on Home for claim-capable users).
- Future: manager notification when a member claims an item (Phase 2E-1 report §12) — the `claim_*` RPCs are the natural hook; not in scope here.

---

## Runtime QA fix

Runtime QA on Expo Web (`http://localhost:19007/available-to-claim`) showed the screen stuck on the Arabic error state `تعذّر تحميل العناصر المتاحة`, Retry doing nothing, and — critically — **no** `rpc/list_available_to_claim` request in DevTools Network, while other Supabase table queries returned 200.

### Root cause
`callClaimRpc` in `src/features/claiming/api.ts` **detached `.rpc` from the client**:

```ts
const rpc = supabase.rpc as unknown as (...) => ...;
await rpc(fn, args);   // ← called unbound
```

supabase-js implements the method as `rpc(fn, args, opts) { return this.rest.rpc(...) }`. Called unbound, `this` was `undefined`, so `this.rest` threw a **synchronous `TypeError`** the moment `rpc(...)` executed — before any PostgREST request was constructed or sent. React Query caught the synchronous throw, so the query resolved straight to `isError` (the error state) and Retry just re-ran the same broken call. Table reads elsewhere use `.from(...)` invoked as methods, so they kept their `this` and worked — matching the observed "tables 200, no RPC request."

### Why no RPC request was visible before
The throw happened at the call site inside `callClaimRpc` (dereferencing `this.rest` on `undefined`), which is *before* supabase-js builds/sends the `POST …/rest/v1/rpc/list_available_to_claim` fetch. So DevTools never saw an RPC request — only the pre-existing `.from(...)` table requests.

### Fix
Call `.rpc(...)` **as a method** on the client so `this` stays bound, casting only the call *shape* (the Phase 2E RPCs still aren't in the generated types), with the cast kept localized to `api.ts`:

```ts
const client = supabase as unknown as {
  rpc: (name: string, params?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};
const { data, error } = await client.rpc(fn, args);
```

This fixes all six Phase 2E RPCs (feed, four claims, appointment outcome), which all route through `callClaimRpc`. The parameter name is correct (`{ p_circle_id: circleId }`), and the query gating was already correct and left unchanged: `canClaim = canManage || canLogDoses` enables the query for admin/primary/family (and activated caregiver) and disables it for `remote_member`/`elder`, which keep the not-allowed state and never issue the RPC.

Also added a dev-only diagnostic (mirrors the existing `care-circle/api.ts` pattern; logs only the error object — no secrets/env):

```ts
useEffect(() => {
  if (__DEV__ && feed.isError) console.error('[available-to-claim] load failed', feed.error);
}, [feed.isError, feed.error]);
```

### Files changed (fix)
| File | Change |
| --- | --- |
| `src/features/claiming/api.ts` | `callClaimRpc` now invokes `.rpc` as a bound method (casts the client's call shape instead of a detached function). |
| `src/features/claiming/figma-available-to-claim.tsx` | Added `useEffect` import + `__DEV__`-only load-failure `console.error`. |

Both files live under the still-untracked `src/features/claiming/`, so the tracked `diff --stat` is unchanged.

### Validation results (post-fix)
| Command | Result |
| --- | --- |
| `npm run check:mojibake` | ✅ 266 files — no mojibake |
| `git -c core.autocrlf=false diff --check` | ✅ clean |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx eslint src/features/claiming/api.ts src/features/claiming/figma-available-to-claim.tsx` | ✅ exit 0 |

### What to retest
- **family1 / admin / primary** on `/available-to-claim`: DevTools Network now shows `POST …/rest/v1/rpc/list_available_to_claim` (200); the grouped feed renders; `أنا متكفّل` claims succeed and move the item to the owner's screen; a race claim shows `تم التكفّل بهذا العنصر من شخص آخر`.
- **remote1**: no Home "متاح للتكفّل" card; deep-linking `/available-to-claim` shows the not-available state and issues **no** RPC request.
- Confirm the appointment outcome buttons (assignee) also work now — they share the same `callClaimRpc` path that was broken.

---

## Claim feedback visibility polish

**Issue:** the success/warning notice rendered at the **top of the scroll content**, so claiming an item while scrolled down succeeded (item disappeared) but the confirmation was off-screen — the user couldn't tell what happened.

**Change:** replaced the top-of-content `NoticeCard` with a **bottom-anchored `FigmaBottomSheet`** (`src/components/figma/figma-bottom-sheet.tsx` — an existing RN `Modal` primitive already used by the tasks confirm sheet; **no new dependency**). Claim results now appear over the content at the bottom of the viewport regardless of scroll position:

- **Success** → title `تم التكفّل بهذا العنصر` / *You've taken responsibility for this item*; body `سيظهر الآن ضمن العناصر المسندة إليك` / *It will now appear in your assigned items*; `حسنًا` / *OK*.
- **Already claimed (`23505`)** → title `تم التكفّل بهذا العنصر من شخص آخر`; body `تم تحديث القائمة لإزالة العنصر` / *The list has been refreshed to remove it*; `حسنًا` / *OK* (+ feed refetch).
- **Generic claim failure** → title `تعذّر التكفّل، حاول مرة أخرى`; `حسنًا` — same sheet, since it had the same scroll-visibility problem.
- The feed **load** error (with Retry) is **unchanged** (already full-content and visible).

**Accessibility / tokens:** the sheet body is `accessibilityRole="alert"` + `accessibilityLiveRegion="assertive"`; status is icon + text + color (never color-only); the `حسنًا / OK` dismiss is a ≥52 dp `FigmaButton` and scrim-tap also dismisses. All colors/spacing/radii from Figma tokens. RN `Modal` renders on both web and native. (The retained-snapshot trick from the tasks sheet was dropped in favor of rendering straight from state — it tripped the newer `react-hooks/set-state-in-effect` rule; the only trade-off is a brief empty sheet during the slide-out *after* the user taps OK, which is inconsequential.)

**Files changed:** `src/features/claiming/figma-available-to-claim.tsx` (bottom-sheet feedback); `src/locales/ar.json` + `src/locales/en.json` (new `common.ok`, `claiming.claimSuccessBody`, `claiming.alreadyClaimedBody`).

**Validation:** `npm run check:mojibake` ✅ (266 files) · `git -c core.autocrlf=false diff --check` ✅ clean · `npx tsc --noEmit` ✅ exit 0 · `npx eslint src/features/claiming/figma-available-to-claim.tsx` ✅ exit 0.

**Retest:** scroll to the bottom of a long feed and claim an item → a bottom sheet confirms `تم التكفّل بهذا العنصر` regardless of scroll; tap `حسنًا` to dismiss and see the refreshed feed. Repeat as two users racing the same item → the warning sheet appears with the refreshed list.

---

## 11. Confirmation

- No Supabase CLI used; no SQL run; no Supabase connection outside normal app code.
- No `.env`/secrets read or modified; no dependency/native/Expo-config/backend/generated-types/migration change; no EAS/prebuild.
- App source changed + this report only; **not committed, not staged**.

---

## 12. Git status & diff

`git --no-pager status --short`:

```
 M src/app/(app)/_layout.tsx
 M src/app/(app)/appointments/[id].tsx
 M src/features/appointments/appointment-editor.tsx
 M src/features/appointments/hooks.ts
 M src/features/care-circle/figma-home.tsx
 M src/features/visits/visit-editor.tsx
 M src/locales/ar.json
 M src/locales/en.json
?? src/app/(app)/available-to-claim.tsx
?? src/features/claiming/
```

*(New untracked: `src/app/(app)/available-to-claim.tsx` and `src/features/claiming/` = `types.ts`, `api.ts`, `hooks.ts`, `figma-available-to-claim.tsx`. Plus this report under `docs/claude-reports/`.)*

`git --no-pager diff --stat`:

```
 src/app/(app)/_layout.tsx                        |   1 +
 src/app/(app)/appointments/[id].tsx              |   1 +
 src/features/appointments/appointment-editor.tsx | 109 +++++++++++++++--------
 src/features/appointments/hooks.ts               |  17 ++++
 src/features/care-circle/figma-home.tsx          |  30 +++++++
 src/features/visits/visit-editor.tsx             |  88 ++++++++++--------
 src/locales/ar.json                              |  32 ++++++-
 src/locales/en.json                              |  32 ++++++-
 8 files changed, 228 insertions(+), 82 deletions(-)
```
