import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type FamilyVisit = Database['public']['Tables']['family_visits']['Row'];
export type VisitStatus = Database['public']['Enums']['family_visit_status'];

/**
 * Editable visit fields. `visitor_user_id` links the visit to a member's account
 * (required by RLS when a caregiver / family member records their own visit).
 * Times are 'HH:MM'; the date is 'YYYY-MM-DD'.
 */
export type VisitInput = {
  visitor_name: string;
  visitor_user_id: string | null;
  visit_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

export type CreateVisitInput = VisitInput & { created_by: string | null };

export const visitKeys = {
  all: ['visits'] as const,
  list: (circleId: string | undefined) => ['visits', 'list', circleId] as const,
  detail: (id: string | undefined) => ['visits', 'detail', id] as const,
};

/** All visits for a circle, most recent date first (RLS: active members). */
export async function fetchVisits(circleId: string): Promise<FamilyVisit[]> {
  const { data, error } = await supabase
    .from('family_visits')
    .select('*')
    .eq('circle_id', circleId)
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** A single visit by id — for the detail / edit screen. */
export async function fetchVisit(id: string): Promise<FamilyVisit | null> {
  const { data, error } = await supabase.from('family_visits').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Creates a visit. RLS lets admins / primary caregivers record any visitor, and
 * caregivers / family members record a visit linked to their own account.
 */
export async function createVisit(circleId: string, input: CreateVisitInput): Promise<void> {
  const { error } = await supabase.from('family_visits').insert({ circle_id: circleId, ...input });
  if (error) throw error;
}

/** Updates a visit's editable fields (not its status). */
export async function updateVisit(id: string, patch: VisitInput): Promise<void> {
  const { error } = await supabase.from('family_visits').update(patch).eq('id', id);
  if (error) throw error;
}

/** Marks a visit planned / completed / cancelled. */
export async function setVisitStatus(id: string, status: VisitStatus): Promise<void> {
  const { error } = await supabase.from('family_visits').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Deletes a visit. RLS allows managers, or the owner of an own-account visit. */
export async function deleteVisit(id: string): Promise<void> {
  const { error } = await supabase.from('family_visits').delete().eq('id', id);
  if (error) throw error;
}
