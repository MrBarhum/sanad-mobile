import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { careCircleKeys } from '@/features/care-circle/api';

import {
  fetchRecipient,
  recipientKeys,
  updateRecipient,
  type RecipientUpdateInput,
} from './api';

/** Loads the care recipient for a circle. */
export function useRecipient(circleId: string | undefined) {
  return useQuery({
    queryKey: recipientKeys.byCircle(circleId),
    queryFn: () => fetchRecipient(circleId as string),
    enabled: Boolean(circleId),
  });
}

/**
 * Updates the recipient profile and invalidates both the recipient query and the
 * care-circle summary (the dashboard shows the recipient's name), so every
 * surface refreshes after a save.
 */
export function useUpdateRecipient(circleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: RecipientUpdateInput) => updateRecipient(circleId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipientKeys.byCircle(circleId) });
      queryClient.invalidateQueries({ queryKey: careCircleKeys.all });
    },
  });
}
