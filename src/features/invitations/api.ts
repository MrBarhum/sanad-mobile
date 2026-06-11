import type { PostgrestError } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type CircleRole = Database['public']['Enums']['circle_role'];
export type InvitationStatus = Database['public']['Enums']['invitation_status'];

export type CreatedInvitation = {
  invitationId: string;
  code: string;
  role: CircleRole;
  expiresAt: string;
};

export type InvitationListItem = {
  id: string;
  role: CircleRole;
  status: InvitationStatus;
  invitedName: string | null;
  invitedEmail: string | null;
  createdByName: string | null;
  acceptedByName: string | null;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

export type AcceptedInvitation = {
  circleId: string;
  membershipId: string;
  role: CircleRole;
};

export const invitationKeys = {
  all: ['invitations'] as const,
  list: (circleId: string | undefined) => ['invitations', 'list', circleId] as const,
};

/**
 * Roles a manager with `actorRole` is permitted to grant by invitation, mirroring
 * the create_circle_invitation RPC checks. `admin` is never invitable; `caregiver`
 * and `elder` are deferred until their dedicated least-privilege RLS exists, so
 * they are excluded here AND rejected by the RPC; a primary caregiver may grant
 * only collaboration roles.
 */
export function invitableRoles(actorRole: CircleRole): CircleRole[] {
  const base: CircleRole[] = ['family_member', 'remote_member'];
  if (actorRole === 'admin') return ['primary_caregiver', ...base];
  if (actorRole === 'primary_caregiver') return base;
  return [];
}

/** Creates an invitation and returns the RAW code (shown to the inviter once). */
export async function createInvitation(input: {
  circleId: string;
  role: CircleRole;
  invitedName: string | null;
}): Promise<CreatedInvitation> {
  const { data, error } = await supabase.rpc('create_circle_invitation', {
    p_circle_id: input.circleId,
    p_role: input.role,
    p_invited_name: input.invitedName ?? undefined,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('create_circle_invitation returned no row');
  return {
    invitationId: row.invitation_id,
    code: row.code,
    role: row.role,
    expiresAt: row.expires_at,
  };
}

/** Manager-only list of a circle's invitations (never returns the code hash). */
export async function listInvitations(circleId: string): Promise<InvitationListItem[]> {
  const { data, error } = await supabase.rpc('list_circle_invitations', { p_circle_id: circleId });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    status: row.status,
    invitedName: row.invited_name,
    invitedEmail: row.invited_email,
    createdByName: row.created_by_name,
    acceptedByName: row.accepted_by_name,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_circle_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}

/** Accepts an invitation by raw code (normalized + hashed server-side). */
export async function acceptInvitation(code: string): Promise<AcceptedInvitation> {
  const { data, error } = await supabase.rpc('accept_circle_invitation', { p_code: code });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('accept_circle_invitation returned no row');
  return { circleId: row.circle_id, membershipId: row.membership_id, role: row.role };
}

/**
 * Maps an accept failure to a localized message key. The DB error messages are
 * fixed strings we control in the migration, so substring matching is stable and
 * lets us distinguish expired / revoked / used / already-member cleanly.
 */
export function acceptErrorKey(error: unknown): string {
  const e = error as Partial<PostgrestError> & { message?: string };
  const code = e?.code;
  const message = (e?.message ?? '').toLowerCase();
  if (code === '23505' || message.includes('already a member')) {
    return 'joinCircle.errors.alreadyMember';
  }
  if (message.includes('expired')) return 'joinCircle.errors.expired';
  if (message.includes('revoked')) return 'joinCircle.errors.revoked';
  if (message.includes('already been used')) return 'joinCircle.errors.used';
  if (code === 'P0002' || message.includes('invalid invitation')) {
    return 'joinCircle.errors.invalid';
  }
  return 'joinCircle.errors.generic';
}
