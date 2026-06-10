import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { summarizeTodayTasks } from '@/features/care-activity/today';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import {
  cancelTask,
  completeTask,
  createTask,
  deleteTask,
  fetchTask,
  fetchTasks,
  taskKeys,
  updateTask,
  type TaskInput,
} from './api';

/** Invalidate every task query (list, detail) after a mutation. */
function invalidateAll(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: taskKeys.all });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTasks(circleId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.list(circleId),
    queryFn: () => fetchTasks(circleId as string),
    enabled: Boolean(circleId),
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => fetchTask(id as string),
    enabled: Boolean(id),
  });
}

/** Today's task counts for the Home dashboard card. */
export function useTodayTaskSummary(circleId: string | undefined) {
  const tasks = useTasks(circleId);
  const summary = useMemo(
    () => summarizeTodayTasks(tasks.data ?? [], todayYmd()),
    [tasks.data],
  );
  return { summary, isLoading: tasks.isLoading, isError: tasks.isError };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateTask(circleId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: TaskInput) =>
      createTask(circleId, { ...input, created_by: user?.id ?? null }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateTask(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: TaskInput }) => updateTask(vars.id, vars.patch),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCompleteTask(circleId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => completeTask(id, user?.id ?? null, new Date().toISOString()),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCancelTask(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelTask(id, new Date().toISOString()),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteTask(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}
