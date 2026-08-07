-- Milestone 7 · A5 — Dose-proof photo: the storage half.
--
-- ⚠️  DASHBOARD SQL EDITOR ONLY. Do NOT put this file in supabase/migrations/ and
--     do NOT run it through `supabase db push`.
--
--     storage.objects is owned by supabase_storage_admin, not postgres, and
--     CREATE POLICY requires table ownership — so these statements can fail with
--     42501 "must be owner of table objects" through a CLI/pgAdmin connection
--     while succeeding in the Dashboard SQL Editor. This project already applies
--     all SQL through the Dashboard (docs/deployment/notifications-and-reminders.md:4-11),
--     which is exactly the path that works.
--
-- ORDER: apply supabase/migrations/20260726130000_dose_proof_helpers.sql FIRST.
--        Every policy below calls public.storage_path_uuid(), which that file
--        creates. Running this first fails with "function does not exist".
--
-- SMOKE TEST FIRST. Before running the real thing, confirm the Dashboard path
-- works on this project at all:
--
--     create policy "zz_throwaway" on storage.objects for select to authenticated using (false);
--     drop policy "zz_throwaway" on storage.objects;
--
--     If that pair succeeds, the rest of this file will. If it raises 42501,
--     stop — the policies must be created from the Storage → Policies UI instead,
--     and the predicates below can be pasted into it unchanged.
--
-- NEVER add `alter table storage.objects enable row level security`. It always
-- fails and it is unnecessary — RLS is on by default on that table.

-- ── 1) The bucket ────────────────────────────────────────────────────────────
-- PRIVATE. A dose-proof photo is medical-adjacent; a public bucket is readable by
-- anyone holding the URL and bypasses RLS entirely on read. Reads go through
-- createSignedUrl() with a short TTL.
--
-- file_size_limit is in BYTES at the SQL level. 2 MiB is the server backstop that
-- matches the client's post-compression cap; it sits far inside the 50 MB Free-plan
-- global ceiling.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dose-proof',
  'dose-proof',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2) Policies ──────────────────────────────────────────────────────────────
--
-- Path: dose-proof/<circle_id>/<medication_id>/<medication_log_id>.<ext>
--   segment 1 = circle_id      → public.storage_path_uuid(name, 1)
--   segment 2 = medication_id  → public.storage_path_uuid(name, 2)
--
-- Every predicate below MIRRORS the live policy on public.medication_logs so the
-- photo is never more visible, or more writable, than the dose-log row it belongs
-- to. If those row policies ever change, change these in the same migration.

-- SELECT — mirrors "Members can view medication logs"
-- (20260626161000_backfill_phase_2d_responsibility_rls.sql:150-161) EXACTLY.
-- Deliberately NOT the broader is_circle_member(circle_id): a plain-membership
-- check here would decouple the photo from its row, letting someone who cannot see
-- the ROW still fetch a signed URL for its PHOTO.
--
-- UPDATED 2026-08-07 (Milestone 9 · D1). The original wording named
-- "a family_member who cannot see the ROW" as the case being excluded. That is no
-- longer the example: D1 added `family_member` to can_view_all_operational
-- (20260807120000_widen_can_view_all_operational_to_family_member.sql), so a
-- family_member now DOES see the row — and, through the first disjunct below, the
-- photo with it. That is the mirror invariant working as designed, not a leak: this
-- policy is written to move WITH the row policy, and freezing it narrow would leave
-- the photo less visible than the row that points at it, so the UI would render a
-- photo slot whose signed-URL request 400s. The role still excluded here is the
-- hired `caregiver`, who reaches only her own medications' photos via the second
-- disjunct. Do NOT "fix" this back to narrow — see docs/deployment/milestone-9-d1-runbook.md.
drop policy if exists "Circle members can read dose proof" on storage.objects;
create policy "Circle members can read dose proof"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'dose-proof'
  and (
    public.can_view_all_operational(public.storage_path_uuid(name, 1))
    or (
      public.is_circle_member(public.storage_path_uuid(name, 1))
      and public.is_responsible_for_medication(
            public.storage_path_uuid(name, 1),
            public.storage_path_uuid(name, 2),
            (select auth.uid())
          )
    )
  )
);

-- INSERT — mirrors "Caregivers can add medication logs" (same file, :102-120):
-- managers, or a family_member/caregiver who is responsible for THAT medication.
-- Plus is_circle_medication(), so the medication in the path must actually belong
-- to the circle in the path, and an extension allow-list matching the bucket's
-- allowed_mime_types.
drop policy if exists "Caregivers can upload dose proof" on storage.objects;
create policy "Caregivers can upload dose proof"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dose-proof'
  and (
    public.has_circle_role(
      public.storage_path_uuid(name, 1),
      array['admin', 'primary_caregiver']::public.circle_role[]
    )
    or (
      public.has_circle_role(
        public.storage_path_uuid(name, 1),
        array['family_member', 'caregiver']::public.circle_role[]
      )
      and public.is_responsible_for_medication(
            public.storage_path_uuid(name, 1),
            public.storage_path_uuid(name, 2),
            (select auth.uid())
          )
    )
  )
  and public.is_circle_medication(
        public.storage_path_uuid(name, 1),
        public.storage_path_uuid(name, 2)
      )
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp')
);

-- UPDATE — needed only for upsert (re-photographing the same dose). Same
-- predicate as INSERT on both sides of the policy.
drop policy if exists "Caregivers can replace dose proof" on storage.objects;
create policy "Caregivers can replace dose proof"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'dose-proof'
  and (
    public.has_circle_role(
      public.storage_path_uuid(name, 1),
      array['admin', 'primary_caregiver']::public.circle_role[]
    )
    or (
      public.has_circle_role(
        public.storage_path_uuid(name, 1),
        array['family_member', 'caregiver']::public.circle_role[]
      )
      and public.is_responsible_for_medication(
            public.storage_path_uuid(name, 1),
            public.storage_path_uuid(name, 2),
            (select auth.uid())
          )
    )
  )
)
with check (
  bucket_id = 'dose-proof'
  and (
    public.has_circle_role(
      public.storage_path_uuid(name, 1),
      array['admin', 'primary_caregiver']::public.circle_role[]
    )
    or (
      public.has_circle_role(
        public.storage_path_uuid(name, 1),
        array['family_member', 'caregiver']::public.circle_role[]
      )
      and public.is_responsible_for_medication(
            public.storage_path_uuid(name, 1),
            public.storage_path_uuid(name, 2),
            (select auth.uid())
          )
    )
  )
  and public.is_circle_medication(
        public.storage_path_uuid(name, 1),
        public.storage_path_uuid(name, 2)
      )
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp')
);

-- DELETE — DELIBERATELY WIDER than "Managers can delete medication logs"
-- (20260608130200_create_medication_logs.sql:136-142, admins + primary caregivers
-- only). Whoever may ATTACH a photo must be able to DETACH it: a responsible
-- family_member clearing proof_object_path on their own dose log has to be able to
-- remove the object too, or every removal leaks an orphan. Storage has no
-- ON DELETE CASCADE from medication_logs, so object cleanup is always an explicit
-- client call — a manager-only DELETE would simply make that call fail.
drop policy if exists "Caregivers can delete dose proof" on storage.objects;
create policy "Caregivers can delete dose proof"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dose-proof'
  and (
    public.has_circle_role(
      public.storage_path_uuid(name, 1),
      array['admin', 'primary_caregiver']::public.circle_role[]
    )
    or (
      public.has_circle_role(
        public.storage_path_uuid(name, 1),
        array['family_member', 'caregiver']::public.circle_role[]
      )
      and public.is_responsible_for_medication(
            public.storage_path_uuid(name, 1),
            public.storage_path_uuid(name, 2),
            (select auth.uid())
          )
    )
  )
);

-- ── 3) Verification (read-only; run as a normal signed-in user, not as postgres) ─
--
--   -- the bucket exists and is private:
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'dose-proof';
--
--   -- all four policies are present:
--   select policyname, cmd from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and policyname like '%dose proof%'
--    order by cmd;
--
--   -- the path helper denies rather than raises on a malformed path
--   -- (expect: null, not an error):
--   select public.storage_path_uuid('not-a-uuid/also-not/file.jpg', 1);
--
-- Then verify ON DEVICE with three real accounts, because nothing above proves
-- the runtime behaviour:
--   1. a manager               → can upload, read, replace and delete
--   2. the responsible member  → same
--   3. a family_member who is NOT responsible for that medication
--                              → createSignedUrl must FAIL, matching the fact
--                                that they cannot read the dose-log row either
