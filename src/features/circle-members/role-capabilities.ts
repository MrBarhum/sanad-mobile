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
 * first). `caregiver` and `elder` exist in the circle_role enum but are
 * deliberately omitted: they are server-authoritatively unavailable until their
 * dedicated least-privilege RLS/UI exists, and BOTH update_circle_member_role and
 * create_circle_invitation reject them. Do NOT surface them as assignable
 * choices anywhere — see the deferred entries in ROLE_CAPABILITIES below.
 */
export const ASSIGNABLE_ROLE_ORDER: CircleRole[] = [
  'admin',
  'primary_caregiver',
  'family_member',
  'remote_member',
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
  // Deferred — unavailable until dedicated least-privilege RLS/UI is built.
  caregiver: capability('caregiver', false),
  elder: capability('elder', false),
};

export function roleCapability(role: CircleRole): RoleCapability {
  return ROLE_CAPABILITIES[role];
}

/**
 * Relative privilege rank, used only to explain whether a role change raises or
 * lowers a member's access in the confirmation dialog. Mirrors the manager
 * hierarchy in the RPCs (admin highest). caregiver/elder rank 0 (unused).
 */
const ROLE_RANK: Record<CircleRole, number> = {
  admin: 4,
  primary_caregiver: 3,
  family_member: 2,
  remote_member: 1,
  caregiver: 0,
  elder: 0,
};

export type RoleChangeDirection = 'increase' | 'decrease' | 'lateral';

export function roleChangeDirection(from: CircleRole, to: CircleRole): RoleChangeDirection {
  if (ROLE_RANK[to] > ROLE_RANK[from]) return 'increase';
  if (ROLE_RANK[to] < ROLE_RANK[from]) return 'decrease';
  return 'lateral';
}
