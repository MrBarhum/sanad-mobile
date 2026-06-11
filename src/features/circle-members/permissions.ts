import type { CircleMember, CircleRole } from './api';

export function isManagerRole(role: CircleRole): boolean {
  return role === 'admin' || role === 'primary_caregiver';
}

/** Number of active admins among the roster — drives last-admin protection. */
export function activeAdminCount(members: CircleMember[]): number {
  return members.filter((m) => m.role === 'admin' && m.status === 'active').length;
}

/** True when removing/demoting this member would leave the circle adminless. */
export function isLastActiveAdmin(member: CircleMember, members: CircleMember[]): boolean {
  return member.role === 'admin' && member.status === 'active' && activeAdminCount(members) === 1;
}

/**
 * Roles `actorRole` may assign to `target`, mirroring update_circle_member_role.
 * Returns [] when the actor may not change this member's role at all. The UI uses
 * this to show only valid choices; the RPC remains authoritative.
 */
// `caregiver` and `elder` are deferred until their dedicated least-privilege RLS
// exists; they are excluded here AND rejected by update_circle_member_role.
export function assignableRolesFor(actorRole: CircleRole, target: CircleMember): CircleRole[] {
  if (!isManagerRole(actorRole)) return [];
  if (actorRole === 'admin') {
    return ['admin', 'primary_caregiver', 'family_member', 'remote_member'];
  }
  // primary_caregiver: may not grant manager roles, nor modify a manager peer.
  if (isManagerRole(target.role) && !target.isSelf) return [];
  return ['family_member', 'remote_member'];
}

/** Whether `actorRole` may change `target`'s active/removed status. */
export function canChangeStatus(actorRole: CircleRole, target: CircleMember): boolean {
  if (!isManagerRole(actorRole)) return false;
  if (target.role === 'admin' && actorRole !== 'admin') return false;
  if (actorRole === 'primary_caregiver' && isManagerRole(target.role) && !target.isSelf) {
    return false;
  }
  return true;
}
