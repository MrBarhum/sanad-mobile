import { supabase } from '../../../lib/supabase';

/**
 * Account deletion (Milestone 7 · A10). Google Play requires in-app account
 * deletion for any app that allows account creation.
 *
 * Two server pieces, deliberately split:
 *   - `account_deletion_preflight()` — a read-only RPC that says what deleting
 *     the account would do to each circle. Runs under the caller's RLS.
 *   - the `delete-account` edge function — the only place the service role is
 *     used, and only for `auth.admin.deleteUser` (auth.users is owned by
 *     supabase_auth_admin, so nothing else can touch it).
 *
 * The preflight is shown to the user BEFORE they confirm, and re-run
 * server-side inside the function, because the client's copy cannot be trusted.
 */

/** One circle the caller is an active member of, and what deletion does to it. */
export type AccountDeletionPreflightRow = {
  circleId: string;
  circleName: string | null;
  recipientName: string | null;
  /**
   * - `blocked` — the caller OWNS it and other active members remain. Deleting
   *   would cascade the circle and every record in it out from under them, so the
   *   server refuses until ownership is transferred.
   * - `deleted` — the caller owns it and is the only active member. It goes with them.
   * - `left`    — the caller is a member but not the owner. The circle is untouched.
   */
  outcome: 'blocked' | 'deleted' | 'left';
  otherActiveMembers: number;
};

type PreflightRpcRow = {
  circle_id: string;
  circle_name: string | null;
  recipient_name: string | null;
  outcome: string;
  other_active_members: number;
};

export const accountDeletionKeys = {
  all: ['account-deletion'] as const,
  preflight: () => ['account-deletion', 'preflight'] as const,
};

/**
 * `account_deletion_preflight` post-dates the last `supabase gen types` run
 * (2026-07-04), so the typed client does not know it yet. Cast the call SHAPE
 * only, exactly as `src/features/pulse/api.ts` does for `list_care_activity`, and
 * keep the cast in this one file. Remove it when the types are regenerated —
 * see the Milestone 7 plan, runbook R3.
 *
 * Called as a METHOD on the client so `this` stays bound: supabase-js implements
 * `rpc()` as `return this.rest.rpc(...)`, so a detached reference throws before
 * any request is made.
 */
export async function fetchAccountDeletionPreflight(): Promise<AccountDeletionPreflightRow[]> {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      params?: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc('account_deletion_preflight');
  if (error) throw error;
  const rows = (data ?? []) as PreflightRpcRow[];
  return rows.map((row) => ({
    circleId: row.circle_id,
    circleName: row.circle_name,
    recipientName: row.recipient_name,
    outcome:
      row.outcome === 'blocked' || row.outcome === 'deleted' || row.outcome === 'left'
        ? row.outcome
        : 'left',
    otherActiveMembers: row.other_active_members ?? 0,
  }));
}

/** A machine code from the edge function; the client renders the copy from i18n. */
export class AccountDeletionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'AccountDeletionError';
    this.code = code;
  }
}

/**
 * Invokes the `delete-account` edge function. The user's session JWT is attached
 * automatically; the function derives the identity from it and never accepts a
 * user id from the body.
 *
 * NOTE: this is the FIRST `functions.invoke` call in the app. Everything else
 * talks to Postgres through PostgREST/RPC under RLS.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; code?: string }>(
    'delete-account',
    { method: 'POST' },
  );

  // A non-2xx surfaces as `error`, but the machine code we care about is in the
  // body, which supabase-js still parses into `data` for a FunctionsHttpError.
  if (data?.code) throw new AccountDeletionError(data.code);
  if (error) throw new AccountDeletionError('server_error');
  if (!data?.ok) throw new AccountDeletionError('server_error');
}

/** Maps a failure to an i18n key. */
export function accountDeletionErrorKey(error: unknown): string {
  const code = error instanceof AccountDeletionError ? error.code : null;
  switch (code) {
    case 'ownership_transfer_required':
      return 'account.delete.blockedError';
    case 'unauthorized':
      return 'account.delete.sessionExpired';
    default:
      return 'account.delete.failed';
  }
}
