import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { circleSelectionKeys } from '@/features/circle-selection/api';

import {
  circleMemberKeys,
  leaveCircle,
  listCircleMembers,
  transferOwnership,
  updateMemberRole,
  updateMemberStatus,
  type CircleRole,
  type MemberStatus,
} from './api';

/** Roster of a circle (active members may view). */
export function useCircleMembers(circleId: string | undefined) {
  return useQuery({
    queryKey: circleMemberKeys.list(circleId),
    queryFn: () => listCircleMembers(circleId as string),
    enabled: Boolean(circleId),
  });
}

/** Changes a member's role; refreshes the roster + circle list (own role/name). */
export function useUpdateMemberRole(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { memberId: string; role: CircleRole }>({
    mutationFn: ({ memberId, role }) => updateMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circleMemberKeys.list(circleId) });
      queryClient.invalidateQueries({ queryKey: circleSelectionKeys.all });
    },
  });
}

/** Activates/removes a member; refreshes the roster + circle list. */
export function useUpdateMemberStatus(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { memberId: string; status: MemberStatus }>({
    mutationFn: ({ memberId, status }) => updateMemberStatus(memberId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circleMemberKeys.list(circleId) });
      queryClient.invalidateQueries({ queryKey: circleSelectionKeys.all });
    },
  });
}

/** Leaves a circle (self). Refreshes everything circle-scoped. */
export function useLeaveCircle() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (circleId) => leaveCircle(circleId),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/** Transfers ownership to another active member (owner-only). */
export function useTransferOwnership(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (newOwnerUserId) => transferOwnership(circleId, newOwnerUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circleMemberKeys.list(circleId) });
      queryClient.invalidateQueries({ queryKey: circleSelectionKeys.all });
    },
  });
}
