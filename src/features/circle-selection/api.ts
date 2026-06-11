import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type CircleRole = Database['public']['Enums']['circle_role'];
export type MemberStatus = Database['public']['Enums']['member_status'];

/** A circle the signed-in user actively belongs to, with their role in it. */
export type CircleSummary = {
  circleId: string;
  circleName: string;
  recipientName: string | null;
  recipientBirthDate: string | null;
  role: CircleRole;
};

export const circleSelectionKeys = {
  all: ['circle-selection'] as const,
  list: (userId: string | undefined) => ['circle-selection', 'list', userId] as const,
};

/**
 * All care circles the user is an ACTIVE member of, oldest membership first,
 * each with the circle + recipient names and the user's role. Replaces the
 * earlier single-circle resolver so the app can support belonging to more than
 * one circle. Three small RLS-passing reads (memberships, circle names,
 * recipients) joined in memory — robust and avoids embed/type fragility.
 */
export async function fetchUserCircles(userId: string): Promise<CircleSummary[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from('circle_members')
    .select('circle_id, role, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (membershipError) throw membershipError;
  if (!memberships || memberships.length === 0) return [];

  const ids = memberships.map((m) => m.circle_id);

  const [{ data: circles, error: circlesError }, { data: recipients, error: recipientsError }] =
    await Promise.all([
      supabase.from('care_circles').select('id, name').in('id', ids),
      supabase
        .from('care_recipients')
        .select('circle_id, full_name, birth_date')
        .in('circle_id', ids),
    ]);

  if (circlesError) throw circlesError;
  if (recipientsError) throw recipientsError;

  const nameById = new Map((circles ?? []).map((c) => [c.id, c.name]));
  const recipientByCircle = new Map((recipients ?? []).map((r) => [r.circle_id, r]));

  return memberships
    .filter((m) => nameById.has(m.circle_id))
    .map((m) => {
      const recipient = recipientByCircle.get(m.circle_id);
      return {
        circleId: m.circle_id,
        circleName: nameById.get(m.circle_id) as string,
        recipientName: recipient?.full_name ?? null,
        recipientBirthDate: recipient?.birth_date ?? null,
        role: m.role,
      };
    });
}
