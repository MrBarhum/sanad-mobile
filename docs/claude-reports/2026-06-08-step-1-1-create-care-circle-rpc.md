# Step 1.1 — Atomic care-circle creation via `create_care_circle` RPC

**Date:** 2026-06-08
**Scope:** Replace the RLS-deadlocked three-insert client flow with a single security-definer Postgres RPC; add an owner SELECT policy; wire the typed client to the RPC. No commit.
**Status:** Code + migration complete and type-checked. ⚠️ The migration could **not** be pushed/introspected from this environment (the CLI is logged into a different Supabase account that lacks access to the linked Sanad project). The user must run `supabase db push` + `gen types` with the correct account to apply it. Details below.

---

## Summary

The Step 1.0 onboarding code was correct but creation deadlocked on the care-circle RLS bootstrap (an owner couldn't see their own circle before becoming a member). Per the approved direction, this step adds a **`SECURITY DEFINER` RPC `public.create_care_circle`** that performs all three inserts (circle → owner admin membership → recipient) **atomically in one transaction**, plus an **owner SELECT policy** on `care_circles`. The client now calls `supabase.rpc('create_care_circle', …)` instead of three RLS-fragile inserts, eliminating both the deadlock and the orphan-row risk.

`npx tsc --noEmit` is clean. However, `supabase db push` and `supabase gen types --linked` returned **HTTP 403** because the authenticated CLI account does not have access to the linked project `qccgshanmoeybagxwvcs` (its visible projects are `thinkmate-*` only), and no `SUPABASE_DB_PASSWORD` is set. So the migration is **authored but not yet applied**, and the generated types were **hand-patched** to match it (so the client compiles); they should be regenerated after a real push.

---

## Migration name

`supabase/migrations/20260607224314_create_care_circle_rpc.sql` (created via `supabase migration new create_care_circle_rpc`; orders after `20260607033000_initial_core_schema.sql`).

## SQL changes

**1. Owner SELECT policy** (so owners can view circles they own, in addition to circles they're an active member of — multiple permissive SELECT policies are OR-ed):

```sql
drop policy if exists "Owners can view their own circles" on public.care_circles;
create policy "Owners can view their own circles"
on public.care_circles for select to authenticated
using (owner_id = auth.uid());
```

**2. Atomic creation RPC** (`SECURITY DEFINER`, `search_path = ''`, all references schema-qualified):

```sql
create or replace function public.create_care_circle(
  circle_name text,
  recipient_full_name text,
  recipient_birth_date date default null
)
returns table (circle_id uuid, recipient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_circle_id uuid;
  v_recipient_id uuid;
begin
  if v_uid is null then
    raise exception 'create_care_circle: authentication required' using errcode = '28000';
  end if;

  insert into public.care_circles (name, owner_id)
  values (circle_name, v_uid) returning id into v_circle_id;

  insert into public.circle_members (circle_id, user_id, role, status)
  values (v_circle_id, v_uid, 'admin'::public.circle_role, 'active'::public.member_status);

  insert into public.care_recipients (circle_id, full_name, birth_date)
  values (v_circle_id, recipient_full_name, recipient_birth_date) returning id into v_recipient_id;

  circle_id := v_circle_id;
  recipient_id := v_recipient_id;
  return next;
end;
$$;
```

**3. Execute grant** (authenticated only, never anon):

```sql
revoke all on function public.create_care_circle(text, text, date) from public;
grant execute on function public.create_care_circle(text, text, date) to authenticated;
```

## Client changes

- **`src/features/care-circle/api.ts`** — `createCareCircle(input)` now calls `supabase.rpc('create_care_circle', { circle_name, recipient_full_name, recipient_birth_date })` (one request). Dropped the three `.from().insert()` calls, the `.select().single()` read-back, and the `userId` parameter (identity comes from `auth.uid()` server-side). Diagnostics simplified: dev-only `logCreateError(error)` logs the RPC failure's `code/message/details/hint`.
- **`src/features/care-circle/hooks.ts`** — `useCreateCareCircle` mutation now calls `createCareCircle(input)` (no `userId`); still invalidates `careCircleKeys.summary(userId)` on success.
- **`src/types/supabase.ts`** — added the `create_care_circle` function to `Database.public.Functions` (hand-patched to mirror `gen types`, since the CLI can't reach the project — see below).
- **`src/features/care-circle/onboarding-form.tsx`** — unchanged (still calls `mutateAsync(input)`); the `TopTabInset` clipping fix from the debug round remains.

## Tables / RLS / RPC notes

- **Why a SECURITY DEFINER RPC unblocks it:** the function runs as its owner (`postgres`, the table owner), so its three inserts bypass the care-circle RLS bootstrap deadlock — while `auth.uid()` (read from the request JWT, unaffected by `SECURITY DEFINER`) still scopes every row to the **calling** user. One function body = one transaction, so a failure rolls back all three rows (no orphans).
- **RLS is not weakened for normal access.** Only a controlled creation gateway was added; all reads/updates/future writes still go through the existing policies. The new owner SELECT policy is additive (owner OR active-member visibility).
- **Tables touched by the RPC:** `care_circles` (insert), `circle_members` (insert, `admin`/`active`), `care_recipients` (insert). Returns `{ circle_id, recipient_id }`.
- **Detection/dashboard reads** are unchanged and still pass RLS (the user is an active member after creation).
- **Exposure:** the explicit `grant execute … to authenticated` keeps the RPC callable via PostgREST even under Supabase's "revoke-by-default for new objects" behavior noted in `config.toml`. After applying, PostgREST may need a schema-cache reload (Supabase normally does this automatically on migration).

## Commands run

| Command | Result |
| --- | --- |
| `npx supabase migration new create_care_circle_rpc` | ✅ created `…/20260607224314_create_care_circle_rpc.sql` |
| `npx supabase projects list` | ✅ logged in, but lists only `thinkmate-chess` / `thinkmate-staging` — **not** the linked Sanad ref `qccgshanmoeybagxwvcs` |
| `npx supabase db push --linked` | ❌ **403** "Your account does not have the necessary privileges to access this endpoint"; also requires `SUPABASE_DB_PASSWORD` |
| `npx supabase gen types typescript --linked --schema public` | ❌ same **403** (run to a temp file — the real `src/types/supabase.ts` was never touched/truncated) |
| `npx tsc --noEmit` | ✅ clean |
| `git status --short` / `git diff --stat` | see below |

## Type generation result

**Could not run** (403 — account lacks access to the linked project). To avoid the classic `gen types > src/types/supabase.ts` truncation-on-failure, generation was attempted into a temp file only. I then **hand-patched** `src/types/supabase.ts` to add the `create_care_circle` function (Args: `circle_name`, `recipient_full_name`, optional `recipient_birth_date`; Returns `{ circle_id, recipient_id }[]`) so the typed client compiles. **Action for you:** after `supabase db push` with the correct account, run `npx supabase gen types typescript --linked --schema public > src/types/supabase.ts` to regenerate authoritatively (it should match the hand-patch).

## TypeScript result

`npx tsc --noEmit` → **no output, no errors**. The hand-patched function type makes `supabase.rpc('create_care_circle', …)` fully type-checked.

## Manual test instructions

**Prerequisite (you must run, with the Sanad-owning Supabase account):**
```bash
supabase login                 # if needed, as the account that owns qccgshanmoeybagxwvcs
export SUPABASE_DB_PASSWORD=…   # the Sanad DB password
supabase db push
supabase gen types typescript --linked --schema public > src/types/supabase.ts
```
Then:
```bash
npm run web
```
1. Sign in → Home shows the onboarding form (heading no longer clipped under the web tab bar).
2. Submit a circle name + elder name (birth date optional). It should succeed in one request.
3. Home swaps to the dashboard with the circle + elder name; reloading keeps you there.
4. DB check: exactly one new row in each of `care_circles`, `circle_members` (`role=admin`, `status=active`), `care_recipients`, sharing the new `circle_id`. Inducing a failure rolls back all three (no orphan circle).
5. Dev console on failure shows `[careCircle] create_care_circle RPC failed { code, message, … }`.

## Known risks / assumptions

- **Migration not applied from here.** The single biggest caveat: the RPC/policy exist only in the migration file until you push them with an authorized account. Until then, onboarding creation keeps failing exactly as in Step 1.0.
- **Hand-patched types** must be regenerated post-push; if the real `gen types` differs cosmetically (e.g., arg ordering), prefer its output.
- **Orphan rows from Step 1.0 debugging:** earlier failed attempts may have left orphan `care_circles` rows (no member/recipient). Optional cleanup after push: `delete from public.care_circles cc where not exists (select 1 from public.circle_members m where m.circle_id = cc.id);` (run as a privileged role).
- **Function ownership:** assumes the migration is applied by `postgres` (Supabase default), which owns the tables — required for the `SECURITY DEFINER` bypass to work.
- Per scope: no unrelated features; routing, other RLS, and the initial migration are untouched; nothing committed.

## Git status summary

Nothing committed. Working tree (Step 1.0 + 1.0-debug + 1.1 all uncommitted):

```
 M src/app/(app)/index.tsx          (1.0)
 M src/constants/theme.ts           (1.0-debug: TopTabInset)
 M src/locales/ar.json              (1.0)
 M src/locales/en.json              (1.0)
 M src/types/supabase.ts            (1.1: create_care_circle type)
?? src/features/                    (1.0 + debug + 1.1 edits)
?? supabase/migrations/20260607224314_create_care_circle_rpc.sql   (1.1)
?? docs/claude-reports/2026-06-08-step-1-0-care-circle-onboarding.md
?? docs/claude-reports/2026-06-08-step-1-0-care-circle-onboarding-debug.md
?? docs/claude-reports/2026-06-08-step-1-1-create-care-circle-rpc.md
```

`git diff --stat` (tracked only): **5 files changed, 162 insertions(+), 88 deletions(-)** (the new feature files + migration are untracked, not shown).

## Is Step 1.0 creation now functionally unblocked?

**In code: yes — and correctly so.** The transactional RPC + owner SELECT policy remove the RLS deadlock and the orphan-row risk, the client is wired to the RPC, and everything type-checks.

**At runtime: not until the migration is applied.** Because this environment's CLI account can't reach the linked Sanad project (403), I could not `db push` or regenerate types here. **Once you push the migration (and reload types) with the Sanad-owning account, creation works end-to-end.** I did not bypass RLS or commit anything.

---

## Recommended next step

1. Push the migration + regenerate types with the correct account (commands above); smoke-test onboarding on web and a native dev client.
2. Clean up any orphan `care_circles` rows from the Step 1.0 debugging.
3. Then commit Steps 1.0 + 1.1 together as the first working care-circle slice, and proceed to recipient editing / care-circle members.
