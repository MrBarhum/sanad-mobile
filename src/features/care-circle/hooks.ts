import { useMutation, useQueryClient } from '@tanstack/react-query';

import { circleSelectionKeys } from '@/features/circle-selection/api';

import { createCareCircle, type CreateCircleInput } from './api';

// Multi-circle selection now backs the active-circle resolution. These are
// re-exported here so the existing screen imports (`@/features/care-circle/...`)
// keep working unchanged.
export {
  canManageCircle,
  canLogDoses,
  isAdminRole,
  type ActiveCircle,
} from '@/features/circle-selection/permissions';
export { useActiveCircle } from '@/features/circle-selection/hooks';

/**
 * Creates the first care circle and refreshes the user's circle list so Home
 * swaps from onboarding to the dashboard (and the new circle becomes selectable).
 */
export function useCreateCareCircle(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCircleInput) => createCareCircle(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: circleSelectionKeys.list(userId) }),
  });
}
