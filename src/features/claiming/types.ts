/**
 * Phase 2E — "متاح للتكفّل" / Available-to-Claim.
 *
 * The claim-flow RPCs are live in the DB (applied manually, see
 * docs/claude-reports/2026-06-26-phase-2e-claim-flow-*) AND are now present in
 * the generated `src/types/supabase.ts`, so `./api` calls them through the typed
 * client with no client-level cast.
 *
 * This file still exists because `supabase gen types` emits every `RETURNS TABLE`
 * column as non-nullable `string`: the generated row for `list_available_to_claim`
 * is strictly wider than reality. `AvailableClaimItem` records the RPC's actual
 * nullability and narrows `item_type` to the four values the function can emit,
 * and `./api` applies it as a result-level narrowing.
 */

/** The four claimable operational entities. */
export type ClaimItemType = 'task' | 'medication' | 'appointment' | 'visit';

/**
 * One normalized row from `list_available_to_claim(p_circle_id)`. Mirrors the
 * RPC's RETURNS TABLE(...) exactly. Only safe display fields are returned by the
 * server (no descriptions / instructions / notes / doctor).
 */
export type AvailableClaimItem = {
  item_type: ClaimItemType;
  item_id: string;
  circle_id: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  priority: string | null;
  /** Appointments: ISO instant. Null for the other types. */
  scheduled_at: string | null;
  /** Tasks: due_date. Visits: visit_date. 'YYYY-MM-DD'. */
  date_value: string | null;
  /** Tasks: due_time. Visits: start_time. 'HH:MM[:SS]'. */
  time_value: string | null;
  status: string;
  created_at: string;
};
