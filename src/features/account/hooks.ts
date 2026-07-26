import { useMutation, useQuery } from '@tanstack/react-query';

import { accountDeletionKeys, deleteAccount, fetchAccountDeletionPreflight } from './api';

// ------ Queries ------

/**
 * What deleting the account would do to each circle. Always refetched on mount
 * (`staleTime: 0`) — the answer changes the moment another member joins or
 * leaves, and this one is load-bearing: showing a stale "nothing will be lost"
 * would be the worst possible time to be wrong.
 */
export function useAccountDeletionPreflight(enabled = true) {
  return useQuery({
    queryKey: accountDeletionKeys.preflight(),
    queryFn: fetchAccountDeletionPreflight,
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

// ------ Mutations ------

/**
 * Deletes the account. Nothing is invalidated on success: the account no longer
 * exists, so the caller signs out and the (app) guard unmounts the whole tree.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: deleteAccount,
  });
}
