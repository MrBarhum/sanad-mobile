import { supabase } from '../../../lib/supabase';

import type { AvailableClaimItem, ClaimItemType } from './types';

/**
 * Phase 2E claim-flow RPCs.
 *
 * These used to go through a hand-rolled `supabase as unknown as { rpc … }` cast
 * because the RPCs post-dated the generated types. They no longer do — all six
 * (`list_available_to_claim`, `claim_care_task`, `claim_medication_responsibility`,
 * `claim_care_appointment`, `claim_family_visit`, `set_assigned_appointment_outcome`)
 * are present in `src/types/supabase.ts` with full `Args`/`Returns`, so the client
 * cast is gone and every call is checked against the real signature.
 *
 * Each wrapper throws the raw PostgREST error so callers can branch on
 * `error.code` — most importantly `'23505'` (someone else already claimed it).
 */

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Every unowned, still-eligible item in the circle (open unassigned tasks, active
 * medications with no responsible person, scheduled unassigned appointments,
 * planned unlinked visits). The RPC verifies the caller is an active,
 * claim-capable member and returns items across the WHOLE circle (not just seeded
 * rows) — remote_member / elder are rejected server-side with SQLSTATE 42501.
 *
 * The one remaining cast is on the RESULT, not the client, and is a narrowing:
 * `supabase gen types` emits every `RETURNS TABLE` column as non-nullable `string`,
 * so the generated row is strictly wider than reality. `AvailableClaimItem`
 * (./types) mirrors the RPC's actual nullability and constrains `item_type` to the
 * four values the function can emit.
 */
export async function listAvailableToClaim(circleId: string): Promise<AvailableClaimItem[]> {
  const { data, error } = await supabase.rpc('list_available_to_claim', {
    p_circle_id: circleId,
  });
  if (error) throw error;
  return (data ?? []) as AvailableClaimItem[];
}

// ---------------------------------------------------------------------------
// Claim (each RPC atomically fills the responsibility column with auth.uid())
// ---------------------------------------------------------------------------

export async function claimCareTask(taskId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_care_task', { p_task_id: taskId });
  if (error) throw error;
}

export async function claimMedicationResponsibility(medicationId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_medication_responsibility', {
    p_medication_id: medicationId,
  });
  if (error) throw error;
}

export async function claimCareAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_care_appointment', {
    p_appointment_id: appointmentId,
  });
  if (error) throw error;
}

export async function claimFamilyVisit(visitId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_family_visit', { p_visit_id: visitId });
  if (error) throw error;
}

/** Dispatches a feed item to the RPC that matches its `item_type`. */
export async function claimAvailableItem(item: {
  item_type: ClaimItemType;
  item_id: string;
}): Promise<void> {
  switch (item.item_type) {
    case 'task':
      return claimCareTask(item.item_id);
    case 'medication':
      return claimMedicationResponsibility(item.item_id);
    case 'appointment':
      return claimCareAppointment(item.item_id);
    case 'visit':
      return claimFamilyVisit(item.item_id);
  }
}

// ---------------------------------------------------------------------------
// Appointment outcome (assigned owner or manager) — status-only, no detail edit
// ---------------------------------------------------------------------------

/**
 * Marks a scheduled appointment `completed` or `cancelled` via the
 * `set_assigned_appointment_outcome` RPC. Server-side the RPC allows a manager OR
 * the assigned member, only from `scheduled`, and writes only the status — a
 * family assignee can record the outcome without editing any appointment detail.
 * Lives here (not in appointments/api.ts) so the whole claim-flow RPC surface
 * stays in one file.
 */
export async function setAssignedAppointmentOutcome(
  appointmentId: string,
  status: 'completed' | 'cancelled',
): Promise<void> {
  const { error } = await supabase.rpc('set_assigned_appointment_outcome', {
    p_appointment_id: appointmentId,
    p_status: status,
  });
  if (error) throw error;
}
