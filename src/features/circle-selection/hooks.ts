import { useMutation, useQueryClient } from '@tanstack/react-query';

import { circleSelectionKeys, setCircleTimezone } from './api';
import { useCircleSelection } from './provider';

/**
 * Resolves the signed-in user's *active* care circle (multi-circle aware). Keeps
 * the exact return shape the detail screens already consume via CircleGate
 * (`{ circle, isLoading, isError, refetch }`), so adding multi-circle support
 * required no changes at the call sites.
 */
export function useActiveCircle() {
  const { activeCircle, isLoading, isError, refetch } = useCircleSelection();
  return { circle: activeCircle, isLoading, isError, refetch };
}

/** Manager-only mutation to set the active circle's canonical timezone. */
export function useSetCircleTimezone() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { circleId: string; timezone: string }>({
    mutationFn: ({ circleId, timezone }) => setCircleTimezone(circleId, timezone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: circleSelectionKeys.all }),
  });
}
