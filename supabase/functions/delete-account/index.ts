// delete-account — USER-INVOKED Edge Function (Milestone 7 · A10).
//
// Permanently deletes the calling user's account. Google Play requires in-app
// account deletion for any app that allows account creation, alongside a
// publicly reachable web deletion URL (that URL is a hosting task, not code —
// see the Milestone 7 runbook).
//
// THIS IS THE FIRST USER-INVOKED FUNCTION IN THIS PROJECT. Every other function
// is cron-invoked with a shared secret and sets `verify_jwt = false`. This one
// must NOT copy that: it keeps verify_jwt = true (see supabase/config.toml) so
// the platform validates the JWT before the handler runs, and it does NOT use
// authorizeScheduledRequest() — that authenticates the SCHEDULER and carries no
// user identity.
//
// AUTH MODEL, and why it is split:
//   * The caller is identified ONLY from the verified JWT (userClient + getUser).
//     No user id is ever read from the request body. A body-supplied id would let
//     any authenticated user delete any other account.
//   * The preflight runs on the USER-scoped client, so RLS and auth.uid() apply.
//   * The service role is used for EXACTLY ONE operation — auth.admin.deleteUser —
//     because auth.users is owned by supabase_auth_admin and nothing else can
//     touch it. It reads no data.
//
// WHY THE PREFLIGHT IS NOT OPTIONAL:
//   profiles.id -> auth.users(id) ON DELETE CASCADE, and
//   care_circles.owner_id -> profiles(id) ON DELETE CASCADE.
//   So deleting the auth row destroys every circle the user OWNS and everything
//   in it — medications, dose logs, tasks, appointments, visits, vitals, daily
//   logs, the care recipient. If that circle has other active members, tapping
//   "delete my account" would silently wipe their data too. The preflight blocks
//   that case and tells them to transfer ownership first. The check is repeated
//   HERE rather than trusted from the client, because the client cannot be.
//
// REQUIRES migration 20260726140000_account_deletion_preflight.sql. Do NOT deploy
// this before it. DEPLOY MANUALLY.

import { failure, json, preflight } from '../_shared/http.ts';
import { log, logError } from '../_shared/log.ts';
import { serviceClient, userClient } from '../_shared/supabase.ts';

type PreflightRow = {
  circle_id: string;
  circle_name: string | null;
  recipient_name: string | null;
  outcome: 'blocked' | 'deleted' | 'left';
  other_active_members: number;
};

Deno.serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;

  if (req.method !== 'POST') return failure('method_not_allowed', 405);

  const asUser = userClient(req);
  if (!asUser) return failure('unauthorized', 401);

  try {
    // 1) Identity comes from the verified token, never from the body.
    const { data: userData, error: userError } = await asUser.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return failure('unauthorized', 401);

    // 2) Re-run the preflight server-side, as the user.
    const { data, error: preflightError } = await asUser.rpc('account_deletion_preflight');
    if (preflightError) {
      logError('delete_account_preflight_failed', preflightError, { user_id: user.id });
      return failure('server_error', 500);
    }

    const rows = (data ?? []) as PreflightRow[];
    const blocked = rows.filter((row) => row.outcome === 'blocked');
    if (blocked.length > 0) {
      // Not an error — an actionable state. The client renders the circle names
      // from this payload and routes the user to transfer ownership.
      log('delete_account_blocked', { user_id: user.id, blocked: blocked.length });
      return failure('ownership_transfer_required', 409, {
        circles: blocked.map((row) => ({ id: row.circle_id, name: row.circle_name })),
      });
    }

    // 3) The one privileged step. Service role reads NOTHING; it only deletes.
    const admin = serviceClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      logError('delete_account_failed', deleteError, { user_id: user.id });
      return failure('server_error', 500);
    }

    // Counts only — never a circle name, a recipient name, or any health value.
    log('delete_account_done', {
      user_id: user.id,
      circles_deleted: rows.filter((row) => row.outcome === 'deleted').length,
      circles_left: rows.filter((row) => row.outcome === 'left').length,
    });
    return json({ ok: true });
  } catch (error) {
    logError('delete_account_unhandled', error);
    return failure('server_error', 500);
  }
});
