import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Wrappers that FAIL LOUD on a Supabase error. supabase-js returns { data, error }
// and does NOT reliably throw on its own, so every RPC/query result must be
// checked. The thrown message carries only the operation name + SQLSTATE — never
// arguments, tokens, notification titles/bodies, health data, or secrets.

export async function rpcChecked<T = unknown>(
  sb: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    throw new Error(`rpc ${fn} failed (${error.code ?? 'unknown'})`);
  }
  return data as T;
}

/**
 * Awaits a PostgREST query builder and throws on error, returning the full result
 * (so callers can read `data` and/or `count`). `label` is a safe identifier only.
 */
export async function queryChecked<R extends { error: { code?: string | null } | null }>(
  builder: PromiseLike<R>,
  label: string,
): Promise<R> {
  const res = await builder;
  if (res.error) {
    throw new Error(`query ${label} failed (${res.error.code ?? 'unknown'})`);
  }
  return res;
}
