import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptInvitation,
  createInvitation,
  invitationKeys,
  listInvitations,
  revokeInvitation,
  type AcceptedInvitation,
  type CircleRole,
  type CreatedInvitation,
} from './api';

/** Manager-only list of a circle's invitations. */
export function useCircleInvitations(circleId: string | undefined) {
  return useQuery({
    queryKey: invitationKeys.list(circleId),
    queryFn: () => listInvitations(circleId as string),
    enabled: Boolean(circleId),
  });
}

/** Creates an invitation; refreshes the circle's invitation list. */
export function useCreateInvitation(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation<CreatedInvitation, Error, { role: CircleRole; invitedName: string | null }>({
    mutationFn: (input) => createInvitation({ circleId, ...input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: invitationKeys.list(circleId) }),
  });
}

/** Revokes a pending invitation; refreshes the circle's invitation list. */
export function useRevokeInvitation(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (invitationId) => revokeInvitation(invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: invitationKeys.list(circleId) }),
  });
}

/**
 * Accepts an invitation by code. On success the caller should switch the active
 * circle to the joined one and the circle list is refreshed.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation<AcceptedInvitation, Error, string>({
    mutationFn: (code) => acceptInvitation(code),
    onSuccess: () => {
      // The user now belongs to a new circle; refresh everything circle-scoped.
      void queryClient.invalidateQueries();
    },
  });
}
