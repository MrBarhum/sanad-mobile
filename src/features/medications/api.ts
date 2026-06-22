import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type Medication = Database['public']['Tables']['medications']['Row'];
export type MedicationSchedule = Database['public']['Tables']['medication_schedules']['Row'];
export type MedicationLog = Database['public']['Tables']['medication_logs']['Row'];
export type MedicationLogStatus = Database['public']['Enums']['medication_log_status'];

/** Editable medication fields (circle_id / activation handled separately). */
export type MedicationInput = {
  name: string;
  dosage: string | null;
  form: string | null;
  instructions: string | null;
  with_food: boolean;
  responsible_user_id: string | null;
};

/** Editable schedule fields. `times` are 'HH:MM'; dates are 'YYYY-MM-DD'. */
export type ScheduleInput = {
  days_of_week: number[];
  times: string[];
  start_date: string;
  end_date: string | null;
  notes: string | null;
};

export type LogDoseInput = {
  circleId: string;
  medicationId: string;
  scheduleId: string | null;
  doseDate: string;
  scheduledTime: string;
  status: MedicationLogStatus;
  recordedBy: string | null;
};

export const medicationKeys = {
  all: ['medications'] as const,
  list: (circleId: string | undefined) => ['medications', 'list', circleId] as const,
  detail: (id: string | undefined) => ['medications', 'detail', id] as const,
  activeSchedules: (circleId: string | undefined) =>
    ['medications', 'schedules', 'active', circleId] as const,
  schedulesByMed: (medicationId: string | undefined) =>
    ['medications', 'schedules', 'med', medicationId] as const,
  logs: (circleId: string | undefined, date: string) =>
    ['medications', 'logs', circleId, date] as const,
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Active medications for a circle, alphabetical (RLS: active members). */
export async function fetchActiveMedications(circleId: string): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('circle_id', circleId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** A single medication by id (active or not) — for the edit screen. */
export async function fetchMedication(id: string): Promise<Medication | null> {
  const { data, error } = await supabase.from('medications').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Active schedules for a circle — feeds the today's-doses computation. */
export async function fetchActiveSchedules(circleId: string): Promise<MedicationSchedule[]> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*')
    .eq('circle_id', circleId)
    .eq('is_active', true);

  if (error) throw error;
  return data ?? [];
}

/** All schedules for one medication (active + inactive) — for the edit screen. */
export async function fetchSchedulesByMedication(
  medicationId: string,
): Promise<MedicationSchedule[]> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*')
    .eq('medication_id', medicationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Medication logs recorded for a given date in a circle. */
export async function fetchLogsForDate(circleId: string, date: string): Promise<MedicationLog[]> {
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('circle_id', circleId)
    .eq('dose_date', date);

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Medication writes (RLS: admin / primary_caregiver)
// ---------------------------------------------------------------------------

/**
 * Creates a medication and its first schedule. Since the client cannot run a
 * transaction, this deletes the just-created medication if the schedule insert
 * fails, so we never leave a medication with no schedule.
 */
export async function createMedicationWithSchedule(
  circleId: string,
  medication: MedicationInput,
  schedule: ScheduleInput,
): Promise<void> {
  const { data: med, error: medError } = await supabase
    .from('medications')
    .insert({ circle_id: circleId, ...medication })
    .select('id')
    .single();
  if (medError) throw medError;

  const { error: scheduleError } = await supabase
    .from('medication_schedules')
    .insert({ circle_id: circleId, medication_id: med.id, ...schedule });
  if (scheduleError) {
    await supabase.from('medications').delete().eq('id', med.id);
    throw scheduleError;
  }
}

export async function updateMedication(id: string, patch: MedicationInput): Promise<void> {
  const { error } = await supabase.from('medications').update(patch).eq('id', id);
  if (error) throw error;
}

export async function setMedicationActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('medications').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

export async function deleteMedication(id: string): Promise<void> {
  const { error } = await supabase.from('medications').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Schedule writes (RLS: admin / primary_caregiver)
// ---------------------------------------------------------------------------

export async function createSchedule(
  circleId: string,
  medicationId: string,
  schedule: ScheduleInput,
): Promise<void> {
  const { error } = await supabase
    .from('medication_schedules')
    .insert({ circle_id: circleId, medication_id: medicationId, ...schedule });
  if (error) throw error;
}

export async function updateSchedule(id: string, schedule: ScheduleInput): Promise<void> {
  const { error } = await supabase.from('medication_schedules').update(schedule).eq('id', id);
  if (error) throw error;
}

export async function setScheduleActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('medication_schedules')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('medication_schedules').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Dose logs (RLS: any caregiving member may insert/update; managers may delete)
// ---------------------------------------------------------------------------

export async function insertLog(input: LogDoseInput): Promise<void> {
  const { error } = await supabase.from('medication_logs').insert({
    circle_id: input.circleId,
    medication_id: input.medicationId,
    schedule_id: input.scheduleId,
    dose_date: input.doseDate,
    scheduled_time: input.scheduledTime,
    status: input.status,
    recorded_by: input.recordedBy,
  });
  if (error) throw error;
}

export async function updateLogStatus(
  id: string,
  status: MedicationLogStatus,
  recordedBy: string | null,
  recordedAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('medication_logs')
    .update({ status, recorded_by: recordedBy, recorded_at: recordedAt })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteLog(id: string): Promise<void> {
  const { error } = await supabase.from('medication_logs').delete().eq('id', id);
  if (error) throw error;
}
