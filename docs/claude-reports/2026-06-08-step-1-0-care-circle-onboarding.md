# Step 1.0 — First care-circle onboarding + elder profile creation

**Date:** 2026-06-08
**Scope:** On the authenticated Home screen, detect care-circle membership; if none, onboard (create circle + elder); if present, show a dashboard. TanStack Query + typed Supabase client + zod. RLS respected, no migration changes.
**Status:** Implemented and validated. Not committed (per instructions).

---

## Summary

Home is now data-driven. It reads the current user's first **active** care-circle membership via TanStack Query:

- **Loading** → spinner.
- **Error** → Arabic message + retry.
- **No circle** → an Arabic onboarding form that creates the first care circle and the elder/recipient record.
- **Has circle** → an Arabic dashboard showing the circle name + elder name, with placeholder cards for medications, tasks, and the emergency card.

Creation is three sequential, **RLS-respecting** inserts (`care_circles` → `circle_members` as `admin`/`active` → `care_recipients`), in the only order the existing policies allow. Validation is via zod; success invalidates the summary query so Home swaps to the dashboard automatically. **No Supabase migration was needed** — the schema already includes the bootstrap policy for the owner's first membership.

`npx tsc --noEmit` is clean and a static **web export passed (exit 0)** across all 12 routes.

---

## Files created

| File | Purpose |
| --- | --- |
| `src/features/care-circle/schema.ts` | zod `createCircleSchema` (circle name, recipient name, optional real `YYYY-MM-DD` birth date). |
| `src/features/care-circle/api.ts` | Query keys, `fetchCircleSummary` (detection + circle/recipient reads), `createCareCircle` (ordered inserts), and the `CircleSummary` / `CreateCircleInput` types. |
| `src/features/care-circle/hooks.ts` | `useCircleSummary` (query) and `useCreateCareCircle` (mutation + invalidation). |
| `src/features/care-circle/onboarding-form.tsx` | Arabic onboarding form component (pre-fills circle name "رعاية الوالد"). |
| `src/features/care-circle/circle-dashboard.tsx` | Arabic dashboard component (circle/elder card + 3 placeholder cards). |

## Files modified

| File | Change |
| --- | --- |
| `src/app/(app)/index.tsx` | Home rewritten as an orchestrator: loading / error+retry / onboarding / dashboard based on `useCircleSummary`. |
| `src/locales/ar.json` | Added the `careCircle.*` block (onboarding labels/placeholders/errors, dashboard labels + sections, loadError). |
| `src/locales/en.json` | Added matching English `careCircle.*` (fallback parity). |

> The previously-static `home.sections.*` keys are now unused (Home no longer renders them); `home.greeting`/`home.tagline` are reused on the dashboard. Left in place to keep this diff focused.

---

## Supabase tables used

| Table | Operation | Columns touched |
| --- | --- | --- |
| `circle_members` | SELECT (detection) | `circle_id, role` where `user_id = me AND status = 'active'` (oldest first, limit 1) |
| `care_circles` | SELECT (dashboard) + INSERT | read `id, name`; insert `{ name, owner_id }` |
| `circle_members` | INSERT (bootstrap) | `{ circle_id, user_id, role: 'admin', status: 'active' }` |
| `care_recipients` | SELECT (dashboard) + INSERT | read `full_name, birth_date`; insert `{ circle_id, full_name, birth_date }` |

No reads/writes to `profiles` (the `handle_new_user` trigger already creates it at sign-up). Enums used: `circle_role = 'admin'`, `member_status = 'active'`.

---

## Commands run

```bash
npx tsc --noEmit                                      # type-check (gate)
git status --short                                    # working-tree state
git diff --stat                                       # change summary
git log --oneline -4                                  # confirm 0.4 committed
npx expo export --platform web --output-dir <temp>    # web smoke test (outside repo, then removed)
```

## TypeScript result

`npx tsc --noEmit` → **no output, no errors** (clean under `"strict": true`). The typed Supabase client validates every column/enum used.

## Web smoke test result

`npx expo export --platform web` → **EXIT_CODE=0**, all **12 static routes** rendered (incl. `/`). This confirms the new `src/features/care-circle/*` modules resolve, and that Home + the Supabase client init survive SSR (during static render there is no session, so Home renders nothing and the query stays disabled — no crash). Bundle ≈ 2.9 MB. Exported outside the repo and deleted; working tree stayed clean.

---

## Functional changes

1. **Detection:** `fetchCircleSummary(userId)` returns the user's first active circle (name + elder name + role) or `null`.
2. **Onboarding (no circle):** form with
   - Care-circle name — **pre-filled** with "رعاية الوالد", editable (required).
   - Elder/recipient full name (required).
   - Birth date (optional, plain `YYYY-MM-DD`; validated as a real date when present).
   On submit: zod validation → ordered inserts → query invalidation → dashboard appears. Any failure shows a clear Arabic error and re-enables the button.
3. **Dashboard (has circle):** greeting + a card with the circle name and elder name (graceful "لم تتم إضافة البيانات بعد" if no recipient row), then placeholder cards for **الأدوية / المهام / بطاقة الطوارئ** marked "قريباً".
4. **Data stack:** TanStack Query for fetch + mutation + invalidation; typed Supabase client; zod validation. Arabic-first and RTL-friendly (reuses the established header/field/card patterns, ≥52px touch targets, alert live-regions).

---

## RLS notes

**No policies were changed.** The flow was built to satisfy the existing policies in `20260607033000_initial_core_schema.sql`:

- **`care_circles` INSERT** — *"Users can create their own circles"*: `with check (owner_id = auth.uid())`. We insert with `owner_id = session user id`. ✅
- **`circle_members` INSERT** — *"Circle owners can add initial membership"*: allows `user_id = auth.uid()` when the row's `circle_id` is owned by `auth.uid()`. This is the **bootstrap** policy that breaks the chicken-and-egg (you can't be a member of a circle that doesn't exist). It places no restriction on `role`/`status`, so `admin`/`active` is allowed. ✅
- **`care_recipients` INSERT** — *"Circle admins can create care recipient"*: `with check (has_circle_role(circle_id, ['admin','primary_caregiver']))`. This is only true **after** the membership row is committed — hence the strict order **circle → member → recipient**. ✅
- **Reads** — `is_circle_member(circle_id)` gates SELECT on all three tables; the user is an active member of their own circle, so detection + dashboard reads pass. The helper functions are `security definer`, which also avoids policy recursion. ✅

The client never uses the service role or bypasses RLS; all calls run as the authenticated user.

---

## How to test manually

**Web:**
```bash
npm run web   # expo start --web
```
1. Sign in (or sign up + confirm) so you reach the tabs.
2. **First run (no circle):** Home shows "أنشئ دائرة الرعاية". The circle-name field is pre-filled "رعاية الوالد".
   - Submit with an empty elder name → Arabic validation error.
   - Enter an invalid birth date (e.g. `2026-13-40`) → "أدخل التاريخ بصيغة YYYY-MM-DD".
   - Enter a valid elder name (birth date optional, e.g. `1955-04-12`) → submit.
3. On success Home swaps to the **dashboard** showing your circle name + elder name and the 3 "قريباً" cards.
4. Reload the page → you stay on the dashboard (detection re-runs and finds the active membership).
5. Optional DB check (Supabase dashboard): one new row each in `care_circles`, `circle_members` (`role=admin`, `status=active`), and `care_recipients`, all sharing the new `circle_id`.

**Native (dev client, not Expo Go):** `npm run ios` / `npm run android` — same flow; RTL layout applies.

**Error path:** disconnect the network and submit → "تعذّر إنشاء دائرة الرعاية…" appears and the button re-enables.

---

## Known risks / assumptions

- **Not atomic (main caveat).** The three inserts are separate requests, not one transaction, and there is **no client DELETE policy** for rollback. If the **recipient** insert fails after the circle + membership commit, the user lands on the dashboard with "no details added yet" and (in this step) no UI to add the recipient. Mitigations in place: zod validates everything up-front, inserts are strictly ordered and error-checked, and a clear Arabic error is shown. **Recommended follow-up:** a `security definer` RPC (e.g. `create_care_circle(...)`) that does all three inserts in one transaction — that would be a *migration*, intentionally deferred per scope.
- **Single circle assumed.** Detection takes the oldest active membership (`limit 1`). Multi-circle UX (switcher) is out of scope.
- **Profile must exist.** `owner_id`/`user_id` FK to `profiles`; the `handle_new_user` trigger covers normal sign-ups. A pre-existing auth user without a profile row would hit an FK error (treated as the generic submit error).
- **Now-unused keys:** `home.sections.*` remain in the locale files (harmless); optional cleanup later.
- Per scope: **no** invitations, medicines, tasks, AI, notifications, payments, phone OTP, or subscriptions; **no** migration/RLS edits; routing unchanged.

---

## Git status summary

Step 0.4 was committed between turns (`eeeb077 feat(app): clean starter shell`), so the working tree contains **only** Step 1.0 — 3 modified files and 5 new (untracked) files, plus this report:

```
 M src/app/(app)/index.tsx
 M src/locales/ar.json
 M src/locales/en.json
?? src/features/care-circle/api.ts
?? src/features/care-circle/circle-dashboard.tsx
?? src/features/care-circle/hooks.ts
?? src/features/care-circle/onboarding-form.tsx
?? src/features/care-circle/schema.ts
?? docs/claude-reports/2026-06-08-step-1-0-care-circle-onboarding.md
```

`git diff --stat` (tracked only): **3 files changed, 144 insertions(+), 88 deletions(-)**. Not committed.

> Cosmetic: Git warned `LF will be replaced by CRLF` on the edited files (Windows line-ending normalization) — no content impact.

---

## Recommended next step

**Step 1.1 — Transactional circle creation + recipient management.**
1. Add a `security definer` RPC `create_care_circle(circle_name, recipient_name, birth_date)` that inserts all three rows in one transaction (eliminates the atomicity gap) and call it from `createCareCircle` (single round-trip). *(This is the first justified migration.)*
2. Add a minimal "edit recipient" path so a circle that somehow lacks a recipient (or needs corrections) can be completed without creating a new circle.
3. Verify the full flow on a device/simulator dev client (only web has been smoke-tested), and add the language toggle deferred from Step 0.4/0.5.
