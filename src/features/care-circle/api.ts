import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../../../lib/supabase';

// The canonical circle summary + multi-circle fetching now live in the
// circle-selection feature; re-exported here for existing importers.
export type { CircleSummary } from '@/features/circle-selection/api';

export type CreateCircleInput = {
  circleName: string;
  recipientName: string;
  birthDate: string | null;
};

/**
 * Dev-only structured logging for a failed care-circle creation RPC, so we can
 * see the Postgres/PostgREST code/details/hint. Never shown to users — the
 * screen keeps a friendly Arabic message in every environment. (`code` is e.g.
 * "28000" when the function is called without an authenticated user.)
 */
function logCreateError(error: PostgrestError): void {
  if (__DEV__) {
    console.error('[careCircle] create_care_circle RPC failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }
}

/**
 * Creates the first care circle (circle + owner admin membership + care
 * recipient) in a single transaction via the `create_care_circle` security-
 * definer RPC. The caller's identity comes from auth.uid() inside the function,
 * so no user id is passed from the client.
 */
export async function createCareCircle(input: CreateCircleInput): Promise<void> {
  const { error } = await supabase.rpc('create_care_circle', {
    circle_name: input.circleName,
    recipient_full_name: input.recipientName,
    recipient_birth_date: input.birthDate ?? undefined,
  });
  if (error) {
    logCreateError(error);
    throw error;
  }
}
