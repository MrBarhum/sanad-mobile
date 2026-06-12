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
