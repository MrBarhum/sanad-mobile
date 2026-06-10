import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type VitalReading = Database['public']['Tables']['vital_readings']['Row'];
export type VitalReadingType = Database['public']['Enums']['vital_reading_type'];

/**
 * Editable vital-reading fields. `circle_id` comes from context and `recorded_by`
 * is set to the acting user on create (mirrors RLS). `reading_at` is an ISO
 * timestamp. For blood pressure, `systolic` + `diastolic` are set and
 * `numeric_value` is null; for other measured types, `numeric_value` (+ `unit`)
 * is set.
 */
export type VitalInput = {
  reading_at: string;
  reading_type: VitalReadingType;
  systolic: number | null;
  diastolic: number | null;
  numeric_value: number | null;
  unit: string | null;
  notes: string | null;
};

export type CreateVitalInput = VitalInput & { recorded_by: string | null };

export const vitalKeys = {
  all: ['vitals'] as const,
  list: (circleId: string | undefined) => ['vitals', 'list', circleId] as const,
  detail: (id: string | undefined) => ['vitals', 'detail', id] as const,
};

/** All vital readings for a circle, newest first (RLS: active members). */
export async function fetchVitals(circleId: string): Promise<VitalReading[]> {
  const { data, error } = await supabase
    .from('vital_readings')
    .select('*')
    .eq('circle_id', circleId)
    .order('reading_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** A single reading by id — for the detail / edit screen. */
export async function fetchVital(id: string): Promise<VitalReading | null> {
  const { data, error } = await supabase
    .from('vital_readings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates a reading. RLS restricts this to caregiving roles. */
export async function createVital(circleId: string, input: CreateVitalInput): Promise<void> {
  const { error } = await supabase.from('vital_readings').insert({ circle_id: circleId, ...input });
  if (error) throw error;
}

/** Updates a reading's editable fields. */
export async function updateVital(id: string, patch: VitalInput): Promise<void> {
  const { error } = await supabase.from('vital_readings').update(patch).eq('id', id);
  if (error) throw error;
}

/** Deletes a reading. RLS: managers (any) or the author (own). */
export async function deleteVital(id: string): Promise<void> {
  const { error } = await supabase.from('vital_readings').delete().eq('id', id);
  if (error) throw error;
}
