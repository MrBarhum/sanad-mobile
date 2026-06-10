import type { Database } from '@/types/supabase';
import { startOfTodayInstant } from '@/utils/date';

import { supabase } from '../../../lib/supabase';

export type CareAppointment = Database['public']['Tables']['care_appointments']['Row'];
export type AppointmentType = Database['public']['Enums']['care_appointment_type'];
export type AppointmentStatus = Database['public']['Enums']['care_appointment_status'];

/** Editable appointment fields. `starts_at` / `ends_at` are ISO timestamps. */
export type AppointmentInput = {
  title: string;
  appointment_type: AppointmentType;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  doctor_id: string | null;
  notes: string | null;
};

export type CreateAppointmentInput = AppointmentInput & { created_by: string | null };

export const appointmentKeys = {
  all: ['appointments'] as const,
  upcoming: (circleId: string | undefined) => ['appointments', 'upcoming', circleId] as const,
  detail: (id: string | undefined) => ['appointments', 'detail', id] as const,
};

/**
 * Upcoming appointments for a circle (from local midnight today onward), soonest
 * first. Past appointments are intentionally excluded from the center; the detail
 * screen still loads any appointment by id.
 */
export async function fetchUpcomingAppointments(circleId: string): Promise<CareAppointment[]> {
  const { data, error } = await supabase
    .from('care_appointments')
    .select('*')
    .eq('circle_id', circleId)
    .gte('starts_at', startOfTodayInstant())
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** A single appointment by id — for the detail / edit screen. */
export async function fetchAppointment(id: string): Promise<CareAppointment | null> {
  const { data, error } = await supabase
    .from('care_appointments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates an appointment. RLS restricts this to admin / primary_caregiver. */
export async function createAppointment(
  circleId: string,
  input: CreateAppointmentInput,
): Promise<void> {
  const { error } = await supabase.from('care_appointments').insert({ circle_id: circleId, ...input });
  if (error) throw error;
}

/** Updates an appointment's editable fields (not its status). */
export async function updateAppointment(id: string, patch: AppointmentInput): Promise<void> {
  const { error } = await supabase.from('care_appointments').update(patch).eq('id', id);
  if (error) throw error;
}

/** Marks an appointment scheduled / completed / cancelled. */
export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const { error } = await supabase.from('care_appointments').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Deletes an appointment. RLS restricts this to admin / primary_caregiver. */
export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('care_appointments').delete().eq('id', id);
  if (error) throw error;
}
