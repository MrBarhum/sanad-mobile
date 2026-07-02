import { supabase } from '../../../lib/supabase';

import type { AvailableClaimItem, ClaimItemType } from './types';

/**
 * Phase 2E claim-flow RPCs. These functions are live in the DB but not yet in the
 * generated Supabase types (we deliberately do not regenerate types this phase),
 * so this file is the ONE place that casts around the typed client. Everything
 * else in the app stays fully typed. The wrapper throws the raw PostgREST error so
 * callers can branch on `error.code` — most importantly `'23505'` (someone else
 * already claimed the item).
 */
async function callClaimRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // Call `.rpc(...)` AS A METHOD on the client so `this` stays bound. supabase-js
  // implements `rpc()` as `return this.rest.rpc(...)`, so a detached
  // `const rpc = supabase.rpc; rpc(...)` loses its receiver and throws
  // synchronously (before any network request) instead of hitting the endpoint.
  // We cast only the call SHAPE here — these Phase 2E RPCs are not in the
  // generated types yet — and the cast stays localized to this file.
  const client = supabase as unknown as {
    rpc: (
      name: string,
      params?: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Every unowned, still-eligible item in the circle (open unassigned tasks, active
 * medications with no responsible person, scheduled unassigned appointments,
 * planned unlinked visits). The RPC verifies the caller is an active,
 * claim-capable member and returns items across the WHOLE circle (not just seeded
 * rows) — remote_member / elder are rejected server-side with SQLSTATE 42501.
 */
export async function listAvailableToClaim(circleId: string): Promise<AvailableClaimItem[]> {
  const rows = await callClaimRpc<AvailableClaimItem[] | null>('list_available_to_claim', {
    p_circle_id: circleId,
  });
  return rows ?? [];
}

// ---------------------------------------------------------------------------
// Claim (each RPC atomically fills the responsibility column with auth.uid())
// ---------------------------------------------------------------------------

export async function claimCareTask(taskId: string): Promise<void> {
  await callClaimRpc('claim_care_task', { p_task_id: taskId });
}

export async function claimMedicationResponsibility(medicationId: string): Promise<void> {
  await callClaimRpc('claim_medication_responsibility', { p_medication_id: medicationId });
}

export async function claimCareAppointment(appointmentId: string): Promise<void> {
  await callClaimRpc('claim_care_appointment', { p_appointment_id: appointmentId });
}

export async function claimFamilyVisit(visitId: string): Promise<void> {
  await callClaimRpc('claim_family_visit', { p_visit_id: visitId });
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
 * Lives here (not in appointments/api.ts) so every un-typed claim-flow RPC cast
 * stays in this single file.
 */
export async function setAssignedAppointmentOutcome(
  appointmentId: string,
  status: 'completed' | 'cancelled',
): Promise<void> {
  await callClaimRpc('set_assigned_appointment_outcome', {
    p_appointment_id: appointmentId,
    p_status: status,
  });
}
