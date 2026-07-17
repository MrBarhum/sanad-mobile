import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { summarizeVitals } from '@/features/care-activity/today';
import { pulseKeys } from '@/features/pulse/hooks';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import {
  createVital,
  deleteVital,
  fetchVital,
  fetchVitals,
  updateVital,
  vitalKeys,
  type VitalInput,
} from './api';

/** Invalidate every vitals query (list, detail) after a mutation. */
function invalidateAll(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: vitalKeys.all });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useVitals(circleId: string | undefined) {
  return useQuery({
    queryKey: vitalKeys.list(circleId),
    queryFn: () => fetchVitals(circleId as string),
    enabled: Boolean(circleId),
  });
}

export function useVital(id: string | undefined) {
  return useQuery({
    queryKey: vitalKeys.detail(id),
    queryFn: () => fetchVital(id as string),
    enabled: Boolean(id),
  });
}

/** Today's / latest vitals summary for the Home dashboard card. */
export function useTodayVitalSummary(circleId: string | undefined) {
  const vitals = useVitals(circleId);
  const summary = useMemo(() => summarizeVitals(vitals.data ?? [], todayYmd()), [vitals.data]);
  return { summary, isLoading: vitals.isLoading, isError: vitals.isError };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateVital(circleId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: VitalInput) =>
      createVital(circleId, { ...input, recorded_by: user?.id ?? null }),
    onSuccess: () => {
      invalidateAll(queryClient);
      // A new vital reading is a Care Pulse event — refresh the feed (D1).
      queryClient.invalidateQueries({ queryKey: pulseKeys.all });
    },
  });
}

export function useUpdateVital(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: VitalInput }) => updateVital(vars.id, vars.patch),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteVital(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVital(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}
