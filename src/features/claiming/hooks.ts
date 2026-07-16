import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claimAvailableItem, claimCareTask, listAvailableToClaim } from './api';
import type { AvailableClaimItem } from './types';

export const availableToClaimKeys = {
  all: ['available-to-claim'] as const,
  list: (circleId: string | undefined) => ['available-to-claim', 'list', circleId] as const,
};

/** The available-to-claim feed for a circle (claim-capable members only). */
export function useAvailableToClaim(circleId: string | undefined) {
  return useQuery({
    queryKey: availableToClaimKeys.list(circleId),
    queryFn: () => listAvailableToClaim(circleId as string),
    enabled: Boolean(circleId),
  });
}

/**
 * Claims one feed item. On success we invalidate the feed AND the four
 * operational query roots so the item disappears here and appears in the owner's
 * normal screen (my tasks / today's doses / my appointments / my visits).
 * Errors bubble up (the caller branches on `error.code === '23505'`).
 */
export function useClaimItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: AvailableClaimItem) => claimAvailableItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: availableToClaimKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
  });
}

/**
 * Claims a single task by id — the inline "أنا متكفّل" affordance on the tasks
 * list (a non-manager taking an unassigned task without visiting the claim feed).
 * Mirrors {@link useClaimItem}'s invalidation for tasks. Callers branch on
 * `error.code === '23505'` (someone else claimed it first).
 */
export function useClaimTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => claimCareTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: availableToClaimKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
