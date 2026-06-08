import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  careCircleKeys,
  createCareCircle,
  fetchCircleSummary,
  type CreateCircleInput,
} from './api';

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
