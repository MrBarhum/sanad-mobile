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

/** Inserts a contact. RLS restricts this to admin / primary_caregiver. */
export async function createEmergencyContact(
  circleId: string,
  input: EmergencyContactInput,
): Promise<void> {
  const { error } = await supabase
    .from('emergency_contacts')
    .insert({ circle_id: circleId, ...input });

  if (error) throw error;
}

/** Updates a contact by id. RLS restricts this to admin / primary_caregiver. */
export async function updateEmergencyContact(
  id: string,
  input: EmergencyContactInput,
): Promise<void> {
  const { error } = await supabase.from('emergency_contacts').update(input).eq('id', id);

  if (error) throw error;
}

/** Deletes a contact by id. RLS restricts this to admin / primary_caregiver. */
export async function deleteEmergencyContact(id: string): Promise<void> {
  const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);

  if (error) throw error;
}
