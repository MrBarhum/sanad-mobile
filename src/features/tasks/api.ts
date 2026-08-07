import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type CareTask = Database['public']['Tables']['care_tasks']['Row'];
export type TaskCategory = Database['public']['Enums']['care_task_category'];
export type TaskPriority = Database['public']['Enums']['care_task_priority'];
export type TaskStatus = Database['public']['Enums']['care_task_status'];

/**
 * Editable task fields. `circle_id` comes from context; status transitions
 * (complete / cancel) are handled by their own functions so the matching
 * timestamps are always set together.
 */
export type TaskInput = {
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  due_date: string | null;
  due_time: string | null;
  assigned_to: string | null;
  notes: string | null;
};

export type CreateTaskInput = TaskInput & { created_by: string | null };

export const taskKeys = {
  all: ['tasks'] as const,
  list: (circleId: string | undefined) => ['tasks', 'list', circleId] as const,
  detail: (id: string | undefined) => ['tasks', 'detail', id] as const,
};

/**
 * All tasks for a circle, newest first.
 *
 * The query is unscoped; RLS decides what comes back, and it does NOT return the
 * whole circle to every active member. `"Members can view care tasks"`
 * (`20260626161000_backfill_phase_2d_responsibility_rls.sql:55-68`) is
 * `can_view_all_operational(circle_id) OR (is_circle_member(circle_id) AND
 * (assigned_to = auth.uid() OR completed_by = auth.uid()))`, and
 * `can_view_all_operational` is `admin | primary_caregiver | remote_member` only
 * (same file, `:24-32`). So a `family_member` or `caregiver` receives ONLY the
 * tasks assigned to them or completed by them — unassigned tasks included nowhere.
 *
 * That is narrower than standing decision A1 describes; widening it is the
 * pending D1 migration (see `docs/claude-reports/2026-08-07-qa-verification.md`
 * F1). Until that is hand-applied, do not write code here that assumes a
 * collaborator can see another member's work.
 */
export async function fetchTasks(circleId: string): Promise<CareTask[]> {
  const { data, error } = await supabase
    .from('care_tasks')
    .select('*')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** A single task by id — for the detail / edit screen. */
export async function fetchTask(id: string): Promise<CareTask | null> {
  const { data, error } = await supabase.from('care_tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates a task. RLS restricts this to admin / primary_caregiver. */
export async function createTask(circleId: string, input: CreateTaskInput): Promise<void> {
  const { error } = await supabase.from('care_tasks').insert({ circle_id: circleId, ...input });
  if (error) throw error;
}

/** Updates a task's editable fields (not its status). */
export async function updateTask(id: string, patch: TaskInput): Promise<void> {
  const { error } = await supabase.from('care_tasks').update(patch).eq('id', id);
  if (error) throw error;
}

/** Marks a task completed, recording who completed it and when. */
export async function completeTask(
  id: string,
  completedBy: string | null,
  completedAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('care_tasks')
    .update({ status: 'completed', completed_at: completedAt, completed_by: completedBy })
    .eq('id', id);
  if (error) throw error;
}

/** Marks a task cancelled, recording when AND who cancelled it. */
export async function cancelTask(
  id: string,
  cancelledAt: string,
  cancelledBy: string | null,
): Promise<void> {
  const patch: Database['public']['Tables']['care_tasks']['Update'] = {
    status: 'cancelled',
    cancelled_at: cancelledAt,
    cancelled_by: cancelledBy,
  };
  const { error } = await supabase.from('care_tasks').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * Reopens a completed/cancelled task back to `open`. RLS + the collaborator-scope
 * trigger restrict this to managers (admin / primary_caregiver), who "may change
 * anything". Clears the terminal timestamps so the status/timestamp CHECK
 * constraints (`*_at_consistent`, `completed_by_consistent`) stay satisfied.
 */
export async function reopenTask(id: string): Promise<void> {
  // Clears cancelled_by too, so the status/timestamp CHECK constraints
  // (`*_at_consistent`, `completed_by_consistent`, `cancelled_by_consistent`) all
  // stay satisfied on the way back to `open`.
  const patch: Database['public']['Tables']['care_tasks']['Update'] = {
    status: 'open',
    completed_at: null,
    completed_by: null,
    cancelled_at: null,
    cancelled_by: null,
  };
  const { error } = await supabase.from('care_tasks').update(patch).eq('id', id);
  if (error) throw error;
}

/** Deletes a task. RLS restricts this to admin / primary_caregiver. */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('care_tasks').delete().eq('id', id);
  if (error) throw error;
}
