import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { summarizeTodayLogs } from '@/features/care-activity/today';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import {
  createDailyLog,
  dailyLogKeys,
  deleteDailyLog,
  fetchDailyLog,
  fetchDailyLogs,
  updateDailyLog,
  type DailyLogInput,
} from './api';

/** Invalidate every daily-log query (list, detail) after a mutation. */
function invalidateAll(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: dailyLogKeys.all });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDailyLogs(circleId: string | undefined) {
  return useQuery({
    queryKey: dailyLogKeys.list(circleId),
    queryFn: () => fetchDailyLogs(circleId as string),
    enabled: Boolean(circleId),
  });
}

export function useDailyLog(id: string | undefined) {
  return useQuery({
    queryKey: dailyLogKeys.detail(id),
    queryFn: () => fetchDailyLog(id as string),
    enabled: Boolean(id),
  });
}

/** Today's daily-log summary for the Home dashboard card. */
export function useTodayLogSummary(circleId: string | undefined) {
  const logs = useDailyLogs(circleId);
  const summary = useMemo(() => summarizeTodayLogs(logs.data ?? [], todayYmd()), [logs.data]);
  return { summary, isLoading: logs.isLoading, isError: logs.isError };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateDailyLog(circleId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: DailyLogInput) =>
      createDailyLog(circleId, { ...input, recorded_by: user?.id ?? null }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateDailyLog(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: DailyLogInput }) =>
      updateDailyLog(vars.id, vars.patch),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteDailyLog(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDailyLog(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}
