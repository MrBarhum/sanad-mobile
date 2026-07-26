import type { CircleRole } from './api';

/**
 * Central, single-source description of what each circle role can and cannot do
 * TODAY. These mirror the CURRENTLY implemented server rules (the RLS policies +
 * the Step 5.0 membership/invitation RPCs), not future intentions — keep them in
 * sync with the migrations, never aspirational. The RPCs remain authoritative;
 * this module only powers the explanatory role-picker UI.
 *
 * The human-readable strings live in i18n under `circleMembers.roles.*` (titles)
 * and `circleMembers.capabilities.*` (summary / can / cannot), so the same Arabic
 * and English wording is reused everywhere a role is shown.
 */

/**
 * Roles a manager may actually assign, in display order (highest privilege
 * first).
 *
 * `caregiver` joined this list in Milestone 8, when it got the dedicated
 * least-privilege RLS its absence was always waiting on: restrictive policies in
 * `20260726160000_caregiver_least_privilege_rls.sql`, RPC scoping in
 * `20260726160100_caregiver_rpc_scope.sql`, and assignability in
 * `20260726160200_enable_caregiver_role_assignment.sql`. It sits LAST because it
 * is the narrowest role, not because it is provisional.
 *
 * `elder` is still omitted and is now genuinely rejected by both
 * `create_circle_invitation` and `update_circle_member_role`.
 *
 * A correction worth keeping: until Milestone 8 this file asserted that those two
 * RPCs rejected `caregiver` and `elder`. They did not — the guard existed only in
 * the repo's migration file and had never been installed in production, so the
 * client array below was the ONLY thing preventing either assignment. Treat this
 * list as UI ergonomics, never as the security boundary; the RLS and the RPC
 * guards are the boundary.
 */
export const ASSIGNABLE_ROLE_ORDER: CircleRole[] = [
  'admin',
  'primary_caregiver',
  'family_member',
  'remote_member',
  'caregiver',
];

export type RoleCapability = {
  role: CircleRole;
  /** False for caregiver/elder — present for documentation, never offered. */
  assignable: boolean;
  /** i18n key for the role's display title (shared with the rest of the app). */
  titleKey: string;
  /** i18n key for a one-line capability summary. */
  summaryKey: string;
  /** i18n key resolving to a string[] of "Can do" bullet points. */
  canKey: string;
  /** i18n key resolving to a string[] of "Cannot do" bullet points. */
  cannotKey: string;
};

function capability(role: CircleRole, assignable: boolean): RoleCapability {
  return {
    role,
    assignable,
    titleKey: `circleMembers.roles.${role}`,
    summaryKey: `circleMembers.capabilities.${role}.summary`,
    canKey: `circleMembers.capabilities.${role}.can`,
    cannotKey: `circleMembers.capabilities.${role}.cannot`,
  };
}

export const ROLE_CAPABILITIES: Record<CircleRole, RoleCapability> = {
  admin: capability('admin', true),
  primary_caregiver: capability('primary_caregiver', true),
  family_member: capability('family_member', true),
  remote_member: capability('remote_member', true),
  caregiver: capability('caregiver', true),
  // Deferred — unavailable until dedicated least-privilege RLS/UI is built.
  elder: capability('elder', false),
};

export function roleCapability(role: CircleRole): RoleCapability {
  return ROLE_CAPABILITIES[role];
}

/**
 * Relative privilege rank, used only to explain whether a role change raises or
 * lowers a member's access in the confirmation dialog. Mirrors the manager
 * hierarchy in the RPCs (admin highest).
 *
 * `caregiver` ranks EQUAL to `remote_member` on purpose, so a change between the
 * two reads as «lateral» rather than as a promotion or a demotion. The two are
 * genuinely incomparable: a remote member can view every operational row
 * (`can_view_all_operational` includes them) but can write nothing; a caregiver
 * can write in her own lane but sees almost nothing. Calling either direction an
 * "increase" would be false. The shell-change warning
 * (`caregiver.roster.shellChangeWarning`) carries the part that actually matters
 * about that change.
 *
 * `elder` stays 0 (unassignable, so unused).
 */
const ROLE_RANK: Record<CircleRole, number> = {
  admin: 4,
  primary_caregiver: 3,
  family_member: 2,
  remote_member: 1,
  caregiver: 1,
  elder: 0,
};

export type RoleChangeDirection = 'increase' | 'decrease' | 'lateral';

export function roleChangeDirection(from: CircleRole, to: CircleRole): RoleChangeDirection {
  if (ROLE_RANK[to] > ROLE_RANK[from]) return 'increase';
  if (ROLE_RANK[to] < ROLE_RANK[from]) return 'decrease';
  return 'lateral';
}
