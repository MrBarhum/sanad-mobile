import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type CircleRole = Database['public']['Enums']['circle_role'];
export type MemberStatus = Database['public']['Enums']['member_status'];

export type CircleMember = {
  memberId: string;
  userId: string;
  role: CircleRole;
  status: MemberStatus;
  fullName: string | null;
  email: string | null;
  isSelf: boolean;
  isOwner: boolean;
  createdAt: string;
};

export const circleMemberKeys = {
  all: ['circle-members'] as const,
  list: (circleId: string | undefined) => ['circle-members', 'list', circleId] as const,
};

/** Roster (active + inactive) of a circle — any active member may view it. */
export async function listCircleMembers(circleId: string): Promise<CircleMember[]> {
  const { data, error } = await supabase.rpc('list_circle_members', { p_circle_id: circleId });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    memberId: row.member_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    fullName: row.full_name,
    email: row.email,
    isSelf: row.is_self,
    isOwner: row.is_owner,
    createdAt: row.created_at,
  }));
}

export async function updateMemberRole(memberId: string, role: CircleRole): Promise<void> {
  const { error } = await supabase.rpc('update_circle_member_role', {
    p_member_id: memberId,
    p_role: role,
  });
  if (error) throw error;
}

export async function updateMemberStatus(memberId: string, status: MemberStatus): Promise<void> {
  const { error } = await supabase.rpc('update_circle_member_status', {
    p_member_id: memberId,
    p_status: status,
  });
  if (error) throw error;
}

export async function leaveCircle(circleId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_care_circle', { p_circle_id: circleId });
  if (error) throw error;
}

/** Transfers ownership to an active member (owner-only; new owner becomes admin). */
export async function transferOwnership(
  circleId: string,
  newOwnerUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('transfer_circle_ownership', {
    p_circle_id: circleId,
    p_new_owner_user_id: newOwnerUserId,
  });
  if (error) throw error;
}

/**
 * Maps a membership/ownership mutation failure to a localized message key. The DB
 * messages are fixed strings from the migrations, so substring matching is
 * stable. Owner-related messages are checked first (they also carry SQLSTATE
 * 23514, shared with last-admin).
 */
export function memberErrorKey(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const code = e?.code;
  const message = (e?.message ?? '').toLowerCase();
  if (message.includes('owner')) {
    return 'circleMembers.errors.owner';
  }
  if (code === '23514' || message.includes('last admin') || message.includes('last administrator')) {
    return 'circleMembers.errors.lastAdmin';
  }
  if (code === '42501' || message.includes('cannot') || message.includes('only')) {
    return 'circleMembers.errors.notAllowed';
  }
  return 'circleMembers.errors.generic';
}
