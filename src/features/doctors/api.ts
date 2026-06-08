import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type Doctor = Database['public']['Tables']['doctors']['Row'];

/** Editable fields for a doctor (circle_id comes from context). */
export type DoctorInput = {
  name: string;
  specialty: string | null;
  phone: string | null;
  clinic_name: string | null;
  notes: string | null;
};

export const doctorKeys = {
  all: ['doctors'] as const,
  byCircle: (circleId: string | undefined) => ['doctors', circleId] as const,
};

/** Lists a circle's doctors, oldest first. */
export async function fetchDoctors(circleId: string): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Inserts a doctor. RLS restricts this to admin / primary_caregiver. */
export async function createDoctor(circleId: string, input: DoctorInput): Promise<void> {
  const { error } = await supabase.from('doctors').insert({ circle_id: circleId, ...input });
  if (error) throw error;
}

/** Updates a doctor by id. RLS restricts this to admin / primary_caregiver. */
export async function updateDoctor(id: string, input: DoctorInput): Promise<void> {
  const { error } = await supabase.from('doctors').update(input).eq('id', id);
  if (error) throw error;
}

/** Deletes a doctor by id. RLS restricts this to admin / primary_caregiver. */
export async function deleteDoctor(id: string): Promise<void> {
  const { error } = await supabase.from('doctors').delete().eq('id', id);
  if (error) throw error;
}
