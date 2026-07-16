import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type EmergencyContact = Database['public']['Tables']['emergency_contacts']['Row'];

/** Editable fields for an emergency contact (circle_id comes from context). */
export type EmergencyContactInput = {
  name: string;
  relationship: string | null;
  phone: string;
  is_primary: boolean;
  notes: string | null;
};

export const emergencyContactKeys = {
  all: ['emergency-contacts'] as const,
  byCircle: (circleId: string | undefined) => ['emergency-contacts', circleId] as const,
};

/** Lists a circle's emergency contacts, primary first then oldest. */
export async function fetchEmergencyContacts(circleId: string): Promise<EmergencyContact[]> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('circle_id', circleId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Client-side single-primary enforcement (P2-12): demote every other primary
 * contact in the circle before promoting one. Best-effort and idempotent — the
 * emergency card only ever surfaces one "primary" contact, so two rows flagged
 * primary would be ambiguous. (No DB uniqueness exists yet; this keeps the data
 * consistent from the app.)
 */
async function clearOtherPrimaries(circleId: string, exceptId: string | null): Promise<void> {
  let query = supabase
    .from('emergency_contacts')
    .update({ is_primary: false })
    .eq('circle_id', circleId)
    .eq('is_primary', true);
  if (exceptId) query = query.neq('id', exceptId);
  const { error } = await query;
  if (error) throw error;
}

/** Inserts a contact. RLS restricts this to admin / primary_caregiver. */
export async function createEmergencyContact(
  circleId: string,
  input: EmergencyContactInput,
): Promise<void> {
  if (input.is_primary) await clearOtherPrimaries(circleId, null);
  const { error } = await supabase
    .from('emergency_contacts')
    .insert({ circle_id: circleId, ...input });

  if (error) throw error;
}

/** Updates a contact by id. RLS restricts this to admin / primary_caregiver. */
export async function updateEmergencyContact(
  circleId: string,
  id: string,
  input: EmergencyContactInput,
): Promise<void> {
  if (input.is_primary) await clearOtherPrimaries(circleId, id);
  const { error } = await supabase.from('emergency_contacts').update(input).eq('id', id);

  if (error) throw error;
}

/** Deletes a contact by id. RLS restricts this to admin / primary_caregiver. */
export async function deleteEmergencyContact(id: string): Promise<void> {
  const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);

  if (error) throw error;
}
