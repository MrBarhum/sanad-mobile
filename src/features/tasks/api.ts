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

/** All tasks for a circle, newest first (RLS: active members). */
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
  // `cancelled_by` ships in the milestone-4 migration and is intentionally not in
  // the generated types yet (types aren't regenerated this phase), so this single
  // update payload is cast through `unknown`. The runtime object keeps the field.
  const patch = {
    status: 'cancelled',
    cancelled_at: cancelledAt,
    cancelled_by: cancelledBy,
  } as unknown as Database['public']['Tables']['care_tasks']['Update'];
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
  // Clears cancelled_by too (added by the milestone-4 migration; cast as in
  // cancelTask above). Harmless if the column is absent pre-migration only in that
  // the whole update would fail — apply the migration first (runbook).
  const patch = {
    status: 'open',
    completed_at: null,
    completed_by: null,
    cancelled_at: null,
    cancelled_by: null,
  } as unknown as Database['public']['Tables']['care_tasks']['Update'];
  const { error } = await supabase.from('care_tasks').update(patch).eq('id', id);
  if (error) throw error;
}

/** Deletes a task. RLS restricts this to admin / primary_caregiver. */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('care_tasks').delete().eq('id', id);
  if (error) throw error;
}
