import { supabase } from '../../../lib/supabase';

import type { PulseEvent } from './types';

/**
 * Calls `list_care_activity` — live in the DB but not yet in the generated types
 * (types aren't regenerated this phase), so, exactly like the claim flow, this
 * file is the ONE place that casts around the typed client. The RPC is read-only,
 * member-gated server-side, and returns the newest events first.
 */
async function callActivityRpc(args: Record<string, unknown>): Promise<PulseEvent[]> {
  // Call `.rpc(...)` as a METHOD so `this` stays bound (a detached reference throws
  // synchronously). The cast is limited to the call shape.
  const client = supabase as unknown as {
    rpc: (
      name: string,
      params?: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc('list_care_activity', args);
  if (error) throw error;
  return (data as PulseEvent[] | null) ?? [];
}

/** Newest `limit` events for a circle (member-gated server-side). */
export async function listCareActivity(circleId: string, limit: number): Promise<PulseEvent[]> {
  return callActivityRpc({ p_circle_id: circleId, p_limit: limit });
}
