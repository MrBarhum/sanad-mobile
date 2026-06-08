# Step 1.2 — Care Recipient Profile, Emergency Card, Emergency Contacts & Doctors

Date: 2026-06-08
Branch: `master`
Status: Implemented locally. **Requires manual SQL in the Sanad Supabase Dashboard before the new screens work.** Not committed.

---

## Summary

This slice turns the placeholder dashboard into a working care foundation:

1. **Care recipient profile** — view/edit screen for the elder's `full_name`, `birth_date`, `dialect`, `blood_type`, `allergies`, `chronic_conditions`, `emergency_notes` (no photo upload). zod validation, TanStack Query mutation + invalidation, RLS-aware role gating (read-only for non-managers).
2. **Emergency card** — read-only Arabic quick-reference aggregating the recipient profile + emergency contacts + doctors, with tap-to-call phone links and an "informational only / not medical advice" disclaimer. Reachable from a prominent red-accented card on Home.
3. **Emergency contacts CRUD** — new `public.emergency_contacts` table + list/add/edit/delete UI.
4. **Doctors CRUD** — new `public.doctors` table + list/add/edit/delete UI.
5. **Routing** — the `(app)` group became a Stack wrapping the tab group, so the four detail screens push full-screen over the tab bar with a themed native header + back button. Auth routing untouched.

No medical logic, AI, medications, notifications, payments, OTP, image upload, or invitations were added (per scope). Safety: the emergency card only displays family-provided data and gives no advice/diagnosis.

---

## Migration files created (local only — NOT pushed)

- `supabase/migrations/20260608120000_create_emergency_contacts.sql`
- `supabase/migrations/20260608120100_create_doctors.sql`

These were created locally only. I did **not** run `supabase db push`, `link`, `login`, `logout`, or change the global CLI account. They must be applied manually (see SQL below).

---

## Exact SQL to run manually in the Sanad Supabase Dashboard → SQL Editor

Paste and run this whole block (it is the concatenation of the two migration files). It reuses the existing `public.set_updated_at()` trigger function and the existing `public.is_circle_member` / `public.has_circle_role` security-definer helpers from the initial core schema — no existing policies are modified.

**This SQL is idempotent and safe to re-run.** Tables and indexes use `create ... if not exists`, and each trigger/policy is preceded by a matching `drop ... if exists`. Because we apply it manually via the Dashboard, Supabase's migration history may not record it; if `supabase db push` later runs these migration files again, they will not fail on already-existing objects. (`alter table ... enable row level security` is itself a no-op when RLS is already enabled.)

```sql
-- =========================================================
-- 1) emergency_contacts
-- =========================================================
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null,
  relationship text,
  phone text not null,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists emergency_contacts_circle_id_idx on public.emergency_contacts (circle_id);

drop trigger if exists emergency_contacts_set_updated_at on public.emergency_contacts;
create trigger emergency_contacts_set_updated_at
before update on public.emergency_contacts
for each row execute function public.set_updated_at();

alter table public.emergency_contacts enable row level security;

drop policy if exists "Members can view emergency contacts" on public.emergency_contacts;
create policy "Members can view emergency contacts"
on public.emergency_contacts
for select
to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Managers can add emergency contacts" on public.emergency_contacts;
create policy "Managers can add emergency contacts"
on public.emergency_contacts
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Managers can update emergency contacts" on public.emergency_contacts;
create policy "Managers can update emergency contacts"
on public.emergency_contacts
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Managers can delete emergency contacts" on public.emergency_contacts;
create policy "Managers can delete emergency contacts"
on public.emergency_contacts
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

-- =========================================================
-- 2) doctors
-- =========================================================
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null,
  specialty text,
  phone text,
  clinic_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists doctors_circle_id_idx on public.doctors (circle_id);

drop trigger if exists doctors_set_updated_at on public.doctors;
create trigger doctors_set_updated_at
before update on public.doctors
for each row execute function public.set_updated_at();

alter table public.doctors enable row level security;

drop policy if exists "Members can view doctors" on public.doctors;
create policy "Members can view doctors"
on public.doctors
for select
to authenticated
using (public.is_circle_member(circle_id));

drop policy if exists "Managers can add doctors" on public.doctors;
create policy "Managers can add doctors"
on public.doctors
for insert
to authenticated
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Managers can update doctors" on public.doctors;
create policy "Managers can update doctors"
on public.doctors
for update
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
)
with check (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);

drop policy if exists "Managers can delete doctors" on public.doctors;
create policy "Managers can delete doctors"
on public.doctors
for delete
to authenticated
using (
  public.has_circle_role(circle_id, array['admin', 'primary_caregiver']::public.circle_role[])
);
```

---

## Tables / RLS policies added

### `public.emergency_contacts`
- Columns: `id`, `circle_id` (FK → `care_circles`, `on delete cascade`), `name` (not null), `relationship`, `phone` (not null), `is_primary` (not null default false), `notes`, `created_at`, `updated_at`.
- Index on `circle_id`. `updated_at` trigger via `set_updated_at()`.
- RLS: SELECT = active circle members; INSERT/UPDATE/DELETE = `admin` + `primary_caregiver` only.

### `public.doctors`
- Columns: `id`, `circle_id` (FK → `care_circles`, `on delete cascade`), `name` (not null), `specialty`, `phone`, `clinic_name`, `notes`, `created_at`, `updated_at`.
- Index on `circle_id`. `updated_at` trigger via `set_updated_at()`.
- RLS: SELECT = active circle members; INSERT/UPDATE/DELETE = `admin` + `primary_caregiver` only.

The `caregiver` role (and other non-manager roles) can view but not manage contacts/doctors, per scope. **No existing tables or RLS policies were changed.** The recipient profile edit relies on the already-existing `care_recipients` UPDATE policy (admin/primary_caregiver), so it needs no migration.

---

## Client / data-access changes

- New typed Supabase reads/writes (existing `lib/supabase.ts` client, RLS enforced):
  - `src/features/recipient-profile/api.ts` — `fetchRecipient`, `updateRecipient`.
  - `src/features/emergency/api.ts` — `fetchEmergencyContacts`, `createEmergencyContact`, `updateEmergencyContact`, `deleteEmergencyContact`.
  - `src/features/doctors/api.ts` — `fetchDoctors`, `createDoctor`, `updateDoctor`, `deleteDoctor`.
- TanStack Query hooks with per-circle query keys and invalidation:
  - `useRecipient` / `useUpdateRecipient` (also invalidates the care-circle summary so the dashboard name refreshes).
  - `useEmergencyContacts` + create/update/delete.
  - `useDoctors` + create/update/delete.
  - `useActiveCircle` (new, in `care-circle/hooks.ts`) wraps the existing summary query and derives `canManage` (admin/primary_caregiver) for UI gating.
- `src/types/supabase.ts` — manually added `emergency_contacts` and `doctors` `Row`/`Insert`/`Update`/`Relationships` in alphabetical position, matching the expected `supabase gen types` output (we did not run gen types — see risks).

---

## UI / screens added

New routes (all behind the existing `(app)` session guard):
- `/recipient-profile` — recipient view/edit form (read-only for non-managers).
- `/emergency-card` — read-only aggregated emergency card with call links + disclaimer.
- `/emergency-contacts` — contacts list + add/edit (bottom-sheet modal) + delete (inline confirm).
- `/doctors` — doctors list + add/edit + delete.

Shared, reusable presentational components added: `Button` (primary/secondary/danger, md/sm), `FormField`, `FormModal` (cross-platform bottom sheet), `ItemActions` (web-safe two-step delete confirm — no `Alert.alert`), `LoadingState`/`ErrorState`/`EmptyState`, and `CircleGate` (resolves the active circle + shared loading/error states for the four screens).

Home dashboard (`circle-dashboard.tsx`) now has a prominent red-accented **Emergency Card** button plus navigable cards for Recipient profile, Emergency contacts, and Doctors; Medications/Tasks remain "coming soon".

### Routing restructure (why)
The `(app)` layout previously rendered the tab navigator directly, so there was no parent Stack to push detail screens onto. Per the Expo v56 router docs (native tabs don't document sibling non-tab routes and recommend a Stack for pushing screens), I introduced an `(app)/(tabs)/` group for the tab screens and made `(app)/_layout.tsx` a themed `Stack` with the auth guard + `unstable_settings.initialRouteName = '(tabs)'`. Tab URLs (`/`, `/explore`, `/account`) are unchanged. `(auth)` routing is untouched.

---

## Commands run

| Command | Result |
| --- | --- |
| `node -e "JSON.parse(ar.json/en.json)"` | OK — both locale files parse |
| `npx tsc --noEmit` | **Exit 0 — no type errors** |
| `npx expo export --platform web` | **Exit 0 — 26 static routes** incl. `/recipient-profile`, `/emergency-card`, `/emergency-contacts`, `/doctors` |
| `git status --short` / `git diff --stat` | See below |

I did **not** run any `supabase` CLI commands, and did not commit.

### TypeScript result
`npx tsc --noEmit` → exit 0 (clean).

### Web export result
`npx expo export --platform web` → exit 0. Static rendering produced all routes, including the four new detail screens and the relocated `(tabs)` routes. (`dist/` is git-ignored and was removed after validation.)

---

## Manual test instructions

1. **Apply the SQL** above in the Sanad Supabase Dashboard → SQL Editor (one-time).
2. **Refresh the web app** (`npm run web`, signed in as the circle owner = `admin`).
3. **Edit recipient profile**: Home → "ملف من تعتني به". Change blood type / allergies / chronic conditions / emergency notes; tap "حفظ التغييرات" → expect "تم حفظ التغييرات". Enter a bad birth date (e.g. `2020-13-40`) → expect the inline Arabic date error.
4. **Add/edit/delete an emergency contact**: Home → "جهات اتصال الطوارئ" → "إضافة جهة اتصال", fill name + phone, toggle "جهة اتصال رئيسية", save. Edit it. Delete it (two-step inline confirm "تأكيد الحذف").
5. **Add/edit/delete a doctor**: Home → "الأطباء" → "إضافة طبيب", same flow.
6. **Open the emergency card**: Home → red "بطاقة الطوارئ" card. Confirm name, birth date + approximate age, blood type, allergies, chronic conditions, emergency notes, the contact(s) (primary badge first) and doctor(s) all appear. Tap a phone number (opens the dialer where available).
7. **Reload the page** and confirm everything persists (data is from Supabase, not local state).

Expected before SQL is applied: the new screens render but show "تعذّر التحميل…" load errors (missing tables). Auth, onboarding, and the existing dashboard are unaffected.

---

## Known risks / assumptions

- **SQL must be applied first.** Without it, the contacts/doctors screens show a load error (PostgREST: relation does not exist). This does not crash the app or affect auth/onboarding.
- **Hand-written types.** `emergency_contacts`/`doctors` types in `src/types/supabase.ts` were written by hand (gen types was intentionally not run). They match the migration and the expected generated shape; re-run `supabase gen types` later to confirm parity when convenient.
- **`is_primary` is not uniqueness-constrained** — multiple "primary" contacts are allowed; the UI only shows a badge and sorts primaries first. Add a partial unique index later if single-primary is desired.
- **Role gating** is enforced server-side by RLS; the UI additionally hides add/edit/delete and makes the profile read-only for non-managers. The current owner is `admin`, so all actions are available.
- **Approximate age** on the emergency card is computed client-side from `birth_date` and is informational only.
- **Detail screens are full-screen** over the tab bar (tab bar hidden while open), returning via the header back button — intended UX for focus/forms.
- **`tel:` links** no-op on desktop web without a registered handler (the number stays visible/selectable).
- **RTL**: relies on the existing `applyRTL()`; the native Stack header's back button auto-flips for RTL. Verify header alignment on a real device.
- **CRLF warnings** from Git on the modified files are pre-existing line-ending normalization, not content issues.

---

## Git status summary

Renames (tab screens moved into the new `(tabs)` group):
```
R  src/app/(app)/index.tsx   -> src/app/(app)/(tabs)/index.tsx
R  src/app/(app)/explore.tsx -> src/app/(app)/(tabs)/explore.tsx
RM src/app/(app)/account.tsx -> src/app/(app)/(tabs)/account.tsx   (import depth fixed)
```
Modified:
```
 src/app/(app)/_layout.tsx                     (tabs render -> Stack wrapper + guard + detail screens)
 src/features/care-circle/circle-dashboard.tsx (navigable cards + emergency button)
 src/features/care-circle/hooks.ts             (useActiveCircle, canManageCircle, ActiveCircle)
 src/features/care-circle/schema.ts            (reuse shared isValidYmd)
 src/locales/ar.json, src/locales/en.json      (new keys)
 src/types/supabase.ts                         (emergency_contacts + doctors types)
```
New (untracked):
```
 supabase/migrations/20260608120000_create_emergency_contacts.sql
 supabase/migrations/20260608120100_create_doctors.sql
 src/app/(app)/(tabs)/_layout.tsx
 src/app/(app)/recipient-profile.tsx, emergency-card.tsx, emergency-contacts.tsx, doctors.tsx
 src/components/button.tsx, form-field.tsx, form-modal.tsx, item-actions.tsx, states.tsx
 src/features/care-circle/circle-gate.tsx
 src/features/recipient-profile/ (api, schema, hooks, profile-form)
 src/features/emergency/ (api, schema, hooks, contacts-manager, emergency-card)
 src/features/doctors/ (api, schema, hooks, doctors-manager)
 src/utils/ (date.ts, form.ts)
```
`git diff --stat`: 8 tracked files changed, 480 insertions(+), 29 deletions(-) (excludes new untracked files).

---

## Is this slice safe to commit after manual SQL + test?

**Yes.** The code compiles (`tsc` clean), the web build succeeds, and it is self-contained: existing auth/onboarding/dashboard behavior is preserved, and the only hard dependency is the manual SQL (without which the new screens degrade gracefully to a load-error state). Recommended order: apply the SQL in the Dashboard, run the manual tests above, then commit (migrations + app code together). Per instructions, I did **not** commit.
