import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type DailyCareLog = Database['public']['Tables']['daily_care_logs']['Row'];
export type DailyMood = Database['public']['Enums']['daily_mood'];
export type SleepQuality = Database['public']['Enums']['sleep_quality'];
export type AppetiteLevel = Database['public']['Enums']['appetite_level'];
export type HydrationLevel = Database['public']['Enums']['hydration_level'];
export type MobilityLevel = Database['public']['Enums']['mobility_level'];

/**
 * Editable daily-log fields. `circle_id` comes from context and `recorded_by` is
 * set to the acting user on create (mirrors RLS). Enum-typed fields are null when
 * the family didn't record that observation.
 */
export type DailyLogInput = {
  log_date: string;
  mood: DailyMood | null;
  sleep_quality: SleepQuality | null;
  appetite: AppetiteLevel | null;
  hydration: HydrationLevel | null;
  pain_level: number | null;
  mobility: MobilityLevel | null;
  bathroom_notes: string | null;
  food_notes: string | null;
  activity_notes: string | null;
  general_notes: string | null;
};

export type CreateDailyLogInput = DailyLogInput & { recorded_by: string | null };

export const dailyLogKeys = {
  all: ['daily-logs'] as const,
  list: (circleId: string | undefined) => ['daily-logs', 'list', circleId] as const,
  detail: (id: string | undefined) => ['daily-logs', 'detail', id] as const,
};

/** All daily logs for a circle, newest day first (RLS: active members). */
export async function fetchDailyLogs(circleId: string): Promise<DailyCareLog[]> {
  const { data, error } = await supabase
    .from('daily_care_logs')
    .select('*')
    .eq('circle_id', circleId)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** A single daily log by id — for the detail / edit screen. */
export async function fetchDailyLog(id: string): Promise<DailyCareLog | null> {
  const { data, error } = await supabase
    .from('daily_care_logs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates a daily log. RLS restricts this to caregiving roles. */
export async function createDailyLog(circleId: string, input: CreateDailyLogInput): Promise<void> {
  const { error } = await supabase.from('daily_care_logs').insert({ circle_id: circleId, ...input });
  if (error) throw error;
}

/** Updates a daily log's editable fields. */
export async function updateDailyLog(id: string, patch: DailyLogInput): Promise<void> {
  const { error } = await supabase.from('daily_care_logs').update(patch).eq('id', id);
  if (error) throw error;
}

/** Deletes a daily log. RLS: managers (any) or the author (own). */
export async function deleteDailyLog(id: string): Promise<void> {
  const { error } = await supabase.from('daily_care_logs').delete().eq('id', id);
  if (error) throw error;
}
