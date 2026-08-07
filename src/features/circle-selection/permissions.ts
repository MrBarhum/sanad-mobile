import type { CircleRole, CircleSummary } from './api';

/** Roles allowed to manage circle data (mirrors every RLS manager check). */
export function canManageCircle(role: CircleRole): boolean {
  return role === 'admin' || role === 'primary_caregiver';
}

/** Roles allowed to record/confirm care activity (doses, logs, vitals…). */
export function canLogDoses(role: CircleRole): boolean {
  return (
    role === 'admin' ||
    role === 'primary_caregiver' ||
    role === 'family_member' ||
    role === 'caregiver'
  );
}

/**
 * Roles the claim RPCs actually accept. This MUST mirror the server allow-list,
 * not "any role that can do care work" — the two diverged in Milestone 8.
 *
 * `20260726160100_caregiver_rpc_scope.sql` narrowed all five claim functions from
 * `('admin','primary_caregiver','family_member','caregiver')` to
 * `('admin','primary_caregiver','family_member')` — `list_available_to_claim`
 * (`:341`), `claim_care_task` (`:106`), `claim_medication_responsibility` (`:169`),
 * `claim_care_appointment` (`:228`) and `claim_family_visit` (`:291`). A hired
 * caregiver is refused by every one of them with SQLSTATE 42501.
 *
 * Gating claim UI on {@link canLogDoses} instead sent her to a screen that throws:
 * she can record doses, so `canLogDoses` was true, but she cannot claim anything.
 * Claiming means taking on unowned work across the circle, which is the family's
 * coordination layer — deliberately not a hired worker's remit.
 */
export function canClaimWork(role: CircleRole): boolean {
  return role === 'admin' || role === 'primary_caregiver' || role === 'family_member';
}

/** True for the top/owner role — only an admin may grant the admin role. */
export function isAdminRole(role: CircleRole): boolean {
  return role === 'admin';
}

export type ActiveCircle = {
  circleId: string;
  circleName: string;
  recipientName: string | null;
  role: CircleRole;
  /** Canonical IANA zone for the circle's scheduled care events. */
  timezone: string;
  /** True for admin / primary_caregiver — they may mutate circle data. */
  canManage: boolean;
  /** True for any caregiving role — they may record care activity. */
  canLogDoses: boolean;
  /**
   * True for admin / primary_caregiver / family_member — the claim RPCs' own
   * allow-list. Narrower than {@link canLogDoses}, which admits `caregiver`.
   */
  canClaim: boolean;
};

/** Maps a circle summary to the role-derived view the screens consume. */
export function toActiveCircle(summary: CircleSummary): ActiveCircle {
  return {
    circleId: summary.circleId,
    circleName: summary.circleName,
    recipientName: summary.recipientName,
    role: summary.role,
    timezone: summary.circleTimezone,
    canManage: canManageCircle(summary.role),
    canLogDoses: canLogDoses(summary.role),
    canClaim: canClaimWork(summary.role),
  };
}
