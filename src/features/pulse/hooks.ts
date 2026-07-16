import { useQuery } from '@tanstack/react-query';

import { listCareActivity } from './api';

export const pulseKeys = {
  all: ['pulse'] as const,
  list: (circleId: string | undefined, limit: number) => ['pulse', 'list', circleId, limit] as const,
};

/**
 * The Care Pulse feed for a circle. `limit` grows on "load more" (the RPC returns
 * the newest `limit` events), matching the notification center's simple paging.
 * `keepPreviousData` avoids a flash to the spinner while a larger page loads.
 */
export function useCareActivity(circleId: string | undefined, limit: number) {
  return useQuery({
    queryKey: pulseKeys.list(circleId, limit),
    queryFn: () => listCareActivity(circleId as string, limit),
    enabled: Boolean(circleId),
  });
}
