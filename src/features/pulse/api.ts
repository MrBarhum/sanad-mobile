import { supabase } from '../../../lib/supabase';

import type { PulseEvent } from './types';

/**
 * Calls `list_care_activity`. The RPC is read-only, member-gated server-side, and
 * returns the newest events first.
 *
 * It is in the generated types as of the Milestone 7 regeneration, so the
 * client-level cast this file used to carry is gone. One narrowing remains, on the
 * RESULT: `supabase gen types` emits every `RETURNS TABLE` column as non-nullable
 * `string`, so the generated row is wider than reality — `PulseEvent` (./types)
 * records the RPC's real nullability and narrows `event_type` / `item_type` to the
 * values the function can actually emit.
 */

/** Newest `limit` events for a circle (member-gated server-side). */
export async function listCareActivity(circleId: string, limit: number): Promise<PulseEvent[]> {
  const { data, error } = await supabase.rpc('list_care_activity', {
    p_circle_id: circleId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as PulseEvent[];
}
