import type { PostgrestError } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

type CircleRole = Database['public']['Enums']['circle_role'];

export type CircleSummary = {
  circleId: string;
  circleName: string;
  recipientName: string | null;
  recipientBirthDate: string | null;
  role: CircleRole;
};

export type CreateCircleInput = {
  circleName: string;
  recipientName: string;
  birthDate: string | null;
};

export const careCircleKeys = {
  all: ['care-circle'] as const,
  summary: (userId: string | undefined) => ['care-circle', 'summary', userId] as const,
};

/**
 * Returns the user's first active care circle (with circle + recipient names) or
 * `null` when they are not yet an active member of any circle. All reads pass
 * RLS because the user is an active member of the circle they belong to.
 */
export async function fetchCircleSummary(userId: string): Promise<CircleSummary | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('circle_members')
    .select('circle_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  const [{ data: circle, error: circleError }, { data: recipient, error: recipientError }] =
    await Promise.all([
      supabase
        .from('care_circles')
        .select('id, name')
        .eq('id', membership.circle_id)
        .maybeSingle(),
      supabase
        .from('care_recipients')
        .select('full_name, birth_date')
        .eq('circle_id', membership.circle_id)
        .maybeSingle(),
    ]);

  if (circleError) throw circleError;
  if (recipientError) throw recipientError;
  if (!circle) return null;

  return {
    circleId: circle.id,
    circleName: circle.name,
    recipientName: recipient?.full_name ?? null,
    recipientBirthDate: recipient?.birth_date ?? null,
    role: membership.role,
  };
}

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
 * definer RPC. This replaces the previous three separate client inserts, which
 * deadlocked on the care-circle RLS bootstrap and could leave orphan rows. The
 * caller's identity comes from auth.uid() inside the function, so no user id is
 * passed from the client.
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
