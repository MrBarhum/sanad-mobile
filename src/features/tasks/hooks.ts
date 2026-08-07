import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { summarizeTodayTasks } from '@/features/care-activity/today';
import { pulseKeys } from '@/features/pulse/hooks';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import {
  cancelTask,
  completeTask,
  createTask,
  deleteTask,
  fetchTask,
  fetchTasks,
  reopenTask,
  taskKeys,
  updateTask,
  type TaskInput,
} from './api';

/** Invalidate every task query (list, detail) after a mutation. */
function invalidateAll(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: taskKeys.all });
}

/**
 * Invalidate the task queries AND the Care Pulse feed. A completion / cancellation
 * / reopen adds or removes a pulse event, so the Home «نبض اليوم» strip and the
 * activity log must refresh alongside the task lists (D1).
 */
function invalidateWithPulse(queryClient: QueryClient) {
  invalidateAll(queryClient);
  queryClient.invalidateQueries({ queryKey: pulseKeys.all });
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

/**
 * Today's task counts for the Home dashboard card.
 *
 * Pass `scopeToUserId` to restrict every count to tasks assigned to that user —
 * the family_member / collaborator scope, so the Home stat matches the scoped
 * tasks list (only their assigned tasks; unassigned and others' tasks excluded).
 * Managers pass `null`/`undefined` to count the whole circle. Completed and
 * cancelled tasks are already excluded from the open/due counts by
 * `summarizeTodayTasks`.
 *
 * The underlying query is unchanged, but note that it is NOT true that "RLS still
 * returns the full circle set" — it does so only for the roles inside
 * `can_view_all_operational` (admin / primary_caregiver / remote_member). For a
 * `family_member` or `caregiver` the server has already narrowed the rows to their
 * own, so `scopeToUserId` is a no-op for them rather than the load-bearing filter
 * it is for a manager. See `fetchTasks` in ./api.ts for the policy text.
 */
export function useTodayTaskSummary(circleId: string | undefined, scopeToUserId?: string | null) {
  const tasks = useTasks(circleId);
  const summary = useMemo(() => {
    const all = tasks.data ?? [];
    const scoped = scopeToUserId ? all.filter((task) => task.assigned_to === scopeToUserId) : all;
    return summarizeTodayTasks(scoped, todayYmd());
  }, [tasks.data, scopeToUserId]);
  return { summary, isLoading: tasks.isLoading, isError: tasks.isError, refetch: tasks.refetch };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Creates a task; `mutateAsync` resolves to the new task's id. */
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
    onSuccess: () => invalidateWithPulse(queryClient),
  });
}

export function useCancelTask(circleId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => cancelTask(id, new Date().toISOString(), user?.id ?? null),
    onSuccess: () => invalidateWithPulse(queryClient),
  });
}

export function useReopenTask(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reopenTask(id),
    onSuccess: () => invalidateWithPulse(queryClient),
  });
}

export function useDeleteTask(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}
