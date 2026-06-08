import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/providers';

import {
  careCircleKeys,
  createCareCircle,
  fetchCircleSummary,
  type CircleSummary,
  type CreateCircleInput,
} from './api';

/** Roles allowed to edit recipient data, contacts, and doctors (mirrors RLS). */
export function canManageCircle(role: CircleSummary['role']): boolean {
  return role === 'admin' || role === 'primary_caregiver';
}

/** Roles allowed to record/confirm medication doses (mirrors the logs RLS). */
export function canLogDoses(role: CircleSummary['role']): boolean {
  return (
    role === 'admin' ||
    role === 'primary_caregiver' ||
    role === 'family_member' ||
    role === 'caregiver'
  );
}

export type ActiveCircle = {
  circleId: string;
  circleName: string;
  recipientName: string | null;
  role: CircleSummary['role'];
  /** True for admin / primary_caregiver — they may mutate circle data. */
  canManage: boolean;
  /** True for any caregiving role — they may record medication doses. */
  canLogDoses: boolean;
};

/** Loads the current user's active care-circle summary (or null if none yet). */
export function useCircleSummary(userId: string | undefined) {
  return useQuery({
    queryKey: careCircleKeys.summary(userId),
    queryFn: () => fetchCircleSummary(userId as string),
    enabled: Boolean(userId),
  });
}

/** Creates the first care circle and invalidates the summary so Home updates. */
export function useCreateCareCircle(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCircleInput) => createCareCircle(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: careCircleKeys.summary(userId) }),
  });
}

/**
 * Resolves the signed-in user's active care circle for the detail screens
 * (recipient profile, emergency card, contacts, doctors). Wraps the same summary
 * query Home uses, and derives `canManage` from the member's role so screens can
 * gate their edit/delete UI without re-implementing the auth + role logic. The
 * underlying RLS still enforces permissions server-side regardless of the UI.
 */
export function useActiveCircle() {
  const { user } = useAuth();
  const query = useCircleSummary(user?.id);

  const circle: ActiveCircle | null = query.data
    ? {
        circleId: query.data.circleId,
        circleName: query.data.circleName,
        recipientName: query.data.recipientName,
        role: query.data.role,
        canManage: canManageCircle(query.data.role),
        canLogDoses: canLogDoses(query.data.role),
      }
    : null;

  return { ...query, circle };
}
