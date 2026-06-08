import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

type RecipientRow = Database['public']['Tables']['care_recipients']['Row'];

/** The recipient fields this feature reads/edits (photo_url is out of scope). */
export type Recipient = Pick<
  RecipientRow,
  | 'id'
  | 'circle_id'
  | 'full_name'
  | 'birth_date'
  | 'dialect'
  | 'blood_type'
  | 'allergies'
  | 'chronic_conditions'
  | 'emergency_notes'
>;

export type RecipientUpdateInput = {
  full_name: string;
  birth_date: string | null;
  dialect: string | null;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  emergency_notes: string | null;
};

const RECIPIENT_COLUMNS =
  'id, circle_id, full_name, birth_date, dialect, blood_type, allergies, chronic_conditions, emergency_notes';

export const recipientKeys = {
  all: ['recipient'] as const,
  byCircle: (circleId: string | undefined) => ['recipient', circleId] as const,
};

/** Loads the single care recipient for a circle (RLS: active members only). */
export async function fetchRecipient(circleId: string): Promise<Recipient | null> {
  const { data, error } = await supabase
    .from('care_recipients')
    .select(RECIPIENT_COLUMNS)
    .eq('circle_id', circleId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Updates the recipient's editable profile fields. RLS restricts UPDATE to the
 * circle's admin / primary_caregiver, so a non-manager's call fails server-side
 * even if the UI is bypassed. Targets the row by circle_id (one recipient per
 * circle, enforced by a unique constraint).
 */
export async function updateRecipient(
  circleId: string,
  patch: RecipientUpdateInput,
): Promise<void> {
  const { error } = await supabase
    .from('care_recipients')
    .update(patch)
    .eq('circle_id', circleId);

  if (error) throw error;
}
