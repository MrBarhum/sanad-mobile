-- Milestone 7 · A5 — Dose-proof photo: public-schema half.
--
-- Adds the column that points a dose log at its proof object, plus the path
-- helper the storage policies need. The bucket itself and the storage.objects
-- policies are DELIBERATELY NOT in this file — see the note at the bottom and
-- docs/deployment/dose-proof-storage.sql.
--
-- OBJECT PATH CONVENTION (load-bearing — the whole policy design rests on it):
--
--     dose-proof/<circle_id>/<medication_id>/<medication_log_id>.<ext>
--
-- The medication_id segment is NOT decoration. The live read policy on
-- public.medication_logs is responsibility-scoped
-- (20260626161000_backfill_phase_2d_responsibility_rls.sql:150-161):
--
--     can_view_all_operational(circle_id)
--     or (is_circle_member(circle_id)
--         and is_responsible_for_medication(circle_id, medication_id, auth.uid()))
--
-- A circle-only path (…/<circle_id>/<log_id>) could only express
-- `is_circle_member(circle_id)`, which is STRICTLY BROADER than the data it
-- guards: a family_member who is not responsible for a medication cannot read
-- that dose-log ROW, but could still fetch a signed URL for its photo. That is a
-- privacy regression introduced by the feature itself. Carrying medication_id in
-- the path lets the bucket policy mirror the row policy exactly.
--
-- Idempotent: `add column if not exists`, a pg_constraint-guarded constraint, and
-- `create or replace function` with re-asserted grants. Safe to re-run.
--
-- NOT auto-applied — Milestone 7 runbook step R6.1
-- (docs/claude-reports/2026-07-26-milestone-7-plan.md).

-- 1) Where the proof object lives. The PATH only — never a URL. The bucket is
--    private, so a URL would be a short-lived signed artifact and must never be
--    persisted.
alter table public.medication_logs
  add column if not exists proof_object_path text;

-- 2) Structurally bind a row to its OWN object. Without this a client could set
--    proof_object_path to another circle's object and the app would happily fetch
--    a signed URL for it — the storage policy authorises the PATH, so the path
--    must be provably this row's. `like` (not `=`) because the extension varies
--    with what the picker returned.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medication_logs'::regclass
      and conname = 'medication_logs_proof_object_path_scoped'
  ) then
    alter table public.medication_logs
      add constraint medication_logs_proof_object_path_scoped
      check (
        proof_object_path is null
        or proof_object_path like (
             circle_id::text || '/' || medication_id::text || '/' || id::text || '.%'
           )
      );
  end if;
end
$$;

-- 3) Safely read a UUID segment out of a storage object path.
--
--    A naked `(storage.foldername(name))[1]::uuid` inside a policy RAISES
--    22P02 invalid_text_representation on any non-UUID segment rather than simply
--    denying — so one malformed upload path turns into an error for the whole
--    statement. This wrapper converts that into a clean NULL, and every membership
--    helper returns false for a NULL circle, so a malformed path is DENIED.
--
--    Not SECURITY DEFINER: it needs no privilege beyond storage.foldername, and
--    least privilege is the right default for something reachable from a policy.
create or replace function public.storage_path_uuid(object_name text, segment integer)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(object_name))[segment]::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.storage_path_uuid(text, integer) from public;
grant execute on function public.storage_path_uuid(text, integer) to authenticated;

notify pgrst, 'reload schema';

-- ── Why the bucket and its policies are NOT in this file ─────────────────────
-- storage.objects is owned by supabase_storage_admin, not postgres, and
-- CREATE POLICY requires table ownership — so these statements can fail with
-- 42501 "must be owner of table objects" through a plain postgres connection while
-- succeeding in the Dashboard SQL Editor. Keeping them out of supabase/migrations/
-- means a future `supabase db push` can never trip over them.
--
-- Also: NEVER write `alter table storage.objects enable row level security`.
-- It always fails, and it is unnecessary — RLS is on by default.
--
-- The bucket + policies live in docs/deployment/dose-proof-storage.sql and are
-- runbook step R6.2, applied by hand in the Dashboard SQL Editor.
