# Step 1.0 — Debug: onboarding clipping + care-circle creation failure

**Date:** 2026-06-08
**Scope:** Fix the web title clipping; add diagnostics for the creation failure and reason about the root cause. No migrations, no RLS bypass, no new features. Not committed.

---

## 1. What caused the title clipping

**Cause:** On **web**, the tab bar is rendered **absolutely positioned at the top** of every tab screen. In `src/components/app-tabs.web.tsx`:

```ts
tabListContainer: { position: 'absolute', width: '100%', padding: Spacing.three, ... }
```

The screen content (`TabSlot`) fills the viewport starting at `y = 0`, and the tab pill **floats on top of it**. The care-circle screens only had `paddingTop: Spacing.five` (32px), while the floating bar occupies roughly the top ~60px — so the heading "أنشئ دائرة الرعاية" rendered *under* the bar. (The Account screen didn't show this because it already uses `paddingTop: Spacing.six` = 64px.) On native this doesn't happen: the tab bar sits at the **bottom**, and the top is handled by the safe-area inset.

**Fix (client-only, web-only):** added a shared inset constant and applied it to the onboarding + dashboard scroll content so the heading clears the floating web bar. Native is unchanged (the inset is `0` there).

```ts
// src/constants/theme.ts
export const TopTabInset = Platform.select({ web: Spacing.five }) ?? 0; // 32 on web, 0 on native
// onboarding-form.tsx & circle-dashboard.tsx
content: { paddingTop: TopTabInset + Spacing.five /* = 64 on web, 32 on native */, ... }
```

This is a per-screen fix consistent with the existing convention (Account already pads for the bar). The underlying shared cause — the absolutely-positioned web bar — is documented on the new constant so future tab screens can reuse `TopTabInset`.

---

## 2. What caused the creation failure

A diagnostic was added (see below) so the **exact** failing op + code is printed on the next manual retry. Reasoning from the code + the RLS in `supabase/migrations/20260607033000_initial_core_schema.sql`, the cause is a **real RLS blocker, not a client bug** — and it has a single root.

### Root cause: `care_circles` has no "owner can SELECT their own circle" policy

The only SELECT policy on `care_circles` is:

```sql
create policy "Users can view circles they belong to"
on public.care_circles for select to authenticated
using (public.is_circle_member(id));   -- true only once you're an ACTIVE member
```

There is **no** policy letting the *owner* see a circle before they’ve joined it. That single gap breaks the creation flow in **two** places:

**Symptom A — the failure the user actually hits now (step 1, `care_circles`).**
The client does `.insert({...}).select('id').single()`. PostgREST inserts the row (the INSERT `with check (owner_id = auth.uid())` passes), then tries to **return** it — and the returned row is filtered by the SELECT policy above. The owner isn’t a member yet → `is_circle_member(id)` is false → **0 rows returned** → `.single()` errors with **`PGRST116`**. So the client throws at `care_circles`, even though the INSERT committed. ⮕ Each failed attempt leaves an **orphan circle** row.

**Symptom B — the deeper bootstrap blocker (step 2, `circle_members`).**
Even if step 1 could read the id back, the membership insert policy is:

```sql
create policy "Circle owners can add initial membership"
on public.circle_members for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.care_circles cc
              where cc.id = circle_id and cc.owner_id = auth.uid())
);
```

That inline `exists (select 1 from public.care_circles …)` is a **direct table reference**, so it is itself subject to `care_circles`’ SELECT RLS — which (again) hides the not-yet-joined circle from its owner. The subquery returns 0 rows → `with check` is false → the insert is denied with **`42501`** ("new row violates row-level security policy"). (The schema deliberately uses `security definer` helpers — `is_circle_member`, `has_circle_role` — elsewhere to avoid exactly this RLS-in-policy filtering / recursion; this one policy uses an inline subquery instead, which is the oversight.)

Both symptoms share the same root: **the owner cannot see their own circle until they are a member, but they cannot become a member until the owner-check can see the circle.** A classic bootstrap deadlock.

### Why this is not fixable on the client (without bypassing RLS)
- We can’t read the new circle’s id back (Symptom A), and we can’t re-query it by name either — every `care_circles` SELECT is gated by `is_circle_member`.
- Even if we generated the id client-side to skip the read-back, the `circle_members` insert (Symptom B) would still be denied.
- The only ways through are RLS/schema changes (add an owner SELECT policy, or do the work in a `security definer` RPC) — i.e. a **migration**, which is explicitly out of scope for this round.

### Diagnostic added (so runtime confirms the above)
`src/features/care-circle/api.ts` now logs the precise failing step in development only, while the UI keeps its friendly Arabic message in all environments:

```ts
function logCreateError(step, error) {
  if (__DEV__) console.error(`[careCircle] insert into "${step}" failed`,
    { code: error.code, message: error.message, details: error.details, hint: error.hint });
}
```

**Expected console output on the next retry:** `[careCircle] insert into "care_circles" failed { code: "PGRST116", … }` (the read-back). If the recommended owner-SELECT policy is added, the failure would move to — and then clear — `circle_members` (`42501`).

### Recommended fix (NOT applied — needs your approval, it’s a migration)
Minimal, unblocks both symptoms at once (multiple permissive SELECT policies are OR-ed):

```sql
create policy "Owners can view their own circles"
on public.care_circles for select to authenticated
using (owner_id = auth.uid());
```

Stronger alternative (also fixes the Step 1.0 atomicity caveat): move all three inserts into a `security definer` RPC `create_care_circle(...)` and call that once from the client. Either is a new migration — **stopping here for approval before changing migrations**, per scope.

---

## Files changed

| File | Change |
| --- | --- |
| `src/constants/theme.ts` | Added `TopTabInset` (web-only top inset for the floating web tab bar). |
| `src/features/care-circle/onboarding-form.tsx` | Content `paddingTop` now includes `TopTabInset` (clears the web bar). |
| `src/features/care-circle/circle-dashboard.tsx` | Same top-inset fix. |
| `src/features/care-circle/api.ts` | Added dev-only `logCreateError` and per-step logging in `createCareCircle` (which insert failed + Supabase code/message/details/hint). UI message unchanged. |
| `docs/claude-reports/2026-06-08-step-1-0-care-circle-onboarding-debug.md` | This report. |

No migrations, RLS, or routing changes. No new dependencies.

## Commands run

```bash
npx tsc --noEmit       # type-check
git status --short
git diff --stat
```

## TypeScript result

`npx tsc --noEmit` → **no output, no errors** (clean; `__DEV__` resolves via the React Native globals).

## Manual test instructions

**Clipping (web):**
```bash
npm run web
```
- On Home (onboarding *or* dashboard), the heading is fully visible **below** the floating top tab pill — not clipped. Resize the window narrow/wide to confirm.

**Creation diagnostic (web, dev):**
1. Open the browser devtools console.
2. On the onboarding screen, fill the fields and submit.
3. The UI shows the friendly Arabic error; the console shows e.g.
   `[careCircle] insert into "care_circles" failed { code: "PGRST116", … }`.
4. That confirms the read-back/RLS root cause above. (Note: a `care_circles` orphan row is created per attempt until the policy is fixed.)

## Git status summary

Step 1.0 remains **uncommitted** (as instructed); this round adds `theme.ts` + edits to the untracked feature files:

```
 M src/app/(app)/index.tsx          (Step 1.0)
 M src/constants/theme.ts           (this round)
 M src/locales/ar.json              (Step 1.0)
 M src/locales/en.json              (Step 1.0)
?? src/features/                    (Step 1.0 + this round's edits)
?? docs/claude-reports/2026-06-08-step-1-0-care-circle-onboarding.md
?? docs/claude-reports/2026-06-08-step-1-0-care-circle-onboarding-debug.md
```

`git diff --stat` (tracked only): **4 files changed, 151 insertions(+), 88 deletions(-)**. Not committed.

## Is Step 1.0 safe to commit?

**Partially.** The **client code is correct and safe** — the clipping fix and diagnostics are good to commit, and the creation code is already forward-compatible with the recommended policy (it will work as-is once the owner-SELECT policy exists). **But the onboarding *creation flow cannot succeed* until the RLS blocker is fixed by a migration**, so Step 1.0 is **not yet functionally complete**.

Recommendation: commit this as a checkpoint (clipping + diagnostics) if you like, but treat **Step 1.1 = apply the approved `care_circles` owner-SELECT policy (or the `create_care_circle` RPC) migration** as the immediate next step before considering Step 1.0 "done". I did **not** change any migration; awaiting your approval.

---

## Recommended next step

**Step 1.1 — Unblock creation (migration, with approval).** Add the `care_circles` owner-SELECT policy (minimal) *or* a `security definer create_care_circle(...)` RPC (also makes creation atomic, retiring the Step 1.0 partial-write caveat). Then re-run the onboarding flow end-to-end on web + a native dev client and confirm the three rows are created. Optionally add a one-time cleanup for any orphan `care_circles` rows produced during this debugging.
