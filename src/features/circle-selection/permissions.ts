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

/** True for the top/owner role — only an admin may grant the admin role. */
export function isAdminRole(role: CircleRole): boolean {
  return role === 'admin';
}

export type ActiveCircle = {
  circleId: string;
  circleName: string;
  recipientName: string | null;
  role: CircleRole;
  /** True for admin / primary_caregiver — they may mutate circle data. */
  canManage: boolean;
  /** True for any caregiving role — they may record care activity. */
  canLogDoses: boolean;
};

/** Maps a circle summary to the role-derived view the screens consume. */
export function toActiveCircle(summary: CircleSummary): ActiveCircle {
  return {
    circleId: summary.circleId,
    circleName: summary.circleName,
    recipientName: summary.recipientName,
    role: summary.role,
    canManage: canManageCircle(summary.role),
    canLogDoses: canLogDoses(summary.role),
  };
}
