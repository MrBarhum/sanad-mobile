import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Service-role Supabase client for the Edge Functions. SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are injected automatically into the Functions
 * runtime; the service-role key NEVER ships in the app bundle and must never be
 * logged. The service role bypasses RLS, so these functions are the only place
 * the enqueue / outbox / recipient functions (granted to service_role) can run.
 */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the function environment');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Supabase client scoped to the CALLING USER, built from the request's
 * Authorization header. Every query it makes runs under that user's RLS and sees
 * the correct `auth.uid()`.
 *
 * Added in Milestone 7 (A10) — the first user-invoked function in this project.
 * Every function before it is cron-invoked and uses serviceClient().
 *
 * USE THIS, NOT serviceClient(), FOR ANY DATA READ IN A USER-FACING FUNCTION.
 * The service role bypasses RLS entirely, so a user-facing function that reads
 * with it will happily return another family's data to anyone who can guess an
 * id. Reserve serviceClient() for the one privileged operation that genuinely
 * cannot be done as the user (for A10: auth.admin.deleteUser).
 *
 * Returns null when the header is missing or malformed, so the caller can answer
 * 401 without a thrown error.
 */
export function userClient(req: Request): SupabaseClient | null {
  const authorization = req.headers.get('Authorization');
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) return null;

  const url = Deno.env.get('SUPABASE_URL');
  // SUPABASE_ANON_KEY is the legacy name; newer runtimes inject
  // SUPABASE_PUBLISHABLE_KEYS (comma-separated). Either works — the key only
  // identifies the project; the JWT in the header is what carries the identity.
  const publishable =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')?.split(',')[0]?.trim();
  if (!url || !publishable) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEYS in the function environment',
    );
  }

  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
}
