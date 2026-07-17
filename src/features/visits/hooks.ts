import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { countVisitsToday } from '@/features/care-activity/today';
import { pulseKeys } from '@/features/pulse/hooks';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import {
  createVisit,
  deleteVisit,
  fetchVisit,
  fetchVisits,
  setVisitStatus,
  updateVisit,
  visitKeys,
  type VisitInput,
  type VisitStatus,
} from './api';

/** Invalidate every visit query (list, detail) after a mutation. */
function invalidateAll(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: visitKeys.all });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useVisits(circleId: string | undefined) {
  return useQuery({
    queryKey: visitKeys.list(circleId),
    queryFn: () => fetchVisits(circleId as string),
    enabled: Boolean(circleId),
  });
}

export function useVisit(id: string | undefined) {
  return useQuery({
    queryKey: visitKeys.detail(id),
    queryFn: () => fetchVisit(id as string),
    enabled: Boolean(id),
  });
}

/** Today's visit count for the Home dashboard card. */
export function useTodayVisitSummary(circleId: string | undefined) {
  const visits = useVisits(circleId);
  const count = useMemo(() => countVisitsToday(visits.data ?? [], todayYmd()), [visits.data]);
  return { count, isLoading: visits.isLoading, isError: visits.isError };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateVisit(circleId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: VisitInput) =>
      createVisit(circleId, { ...input, created_by: user?.id ?? null }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateVisit(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: VisitInput }) => updateVisit(vars.id, vars.patch),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetVisitStatus(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: VisitStatus }) => setVisitStatus(vars.id, vars.status),
    onSuccess: () => {
      invalidateAll(queryClient);
      // A completed visit is a Care Pulse event — refresh the feed (D1).
      queryClient.invalidateQueries({ queryKey: pulseKeys.all });
    },
  });
}

export function useDeleteVisit(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVisit(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}
