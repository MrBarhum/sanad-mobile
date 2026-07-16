import { supabase } from '../../../lib/supabase';

/**
 * The current user's own profile row. Only the fields the app edits/display today
 * are surfaced; the row is always the caller's own (`id = auth.uid()` per RLS).
 */
export type MyProfile = {
  id: string;
  fullName: string | null;
};

/** Loads the signed-in user's profile (RLS restricts this to their own row). */
export async function getMyProfile(userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return { id: data.id, fullName: data.full_name };
}

/**
 * Updates the signed-in user's display name. An empty/whitespace name is stored
 * as NULL (so the display-name fallback chain takes over) rather than a blank
 * string. RLS guarantees a user can only write their own row.
 */
export async function updateMyName(userId: string, fullName: string): Promise<void> {
  const trimmed = fullName.trim();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: trimmed === '' ? null : trimmed })
    .eq('id', userId);
  if (error) throw error;
}
