/**
 * Care Pulse («نبض اليوم») — a read-only activity feed. The `list_care_activity`
 * RPC (migration 20260715130000) is live in the DB but intentionally not in the
 * generated Supabase types this phase, so these local types describe its row
 * shape; the only cast lives in `./api`.
 */

export type PulseEventType =
  | 'dose_logged'
  | 'task_completed'
  | 'task_cancelled'
  | 'appointment_outcome'
  | 'visit_completed'
  | 'vital_recorded'
  | 'daily_log_added'
  | 'member_joined';

/** What kind of entity the event points at (drives the deep-link on tap). */
export type PulseItemType =
  | 'medication'
  | 'task'
  | 'appointment'
  | 'visit'
  | 'vital'
  | 'daily_log'
  | 'member';

/** One normalized activity event from `list_care_activity`. */
export type PulseEvent = {
  event_type: PulseEventType;
  event_id: string;
  occurred_at: string;
  actor_user_id: string | null;
  /** Actor's stored full name (may be null; the client resolves via the roster). */
  actor_name: string | null;
  /** Safe display title (medication/task/appointment/visit name, or a date/type). */
  title: string | null;
  subtitle: string | null;
  item_type: PulseItemType;
  item_id: string;
  /** Domain status where relevant (dose status, task/appointment/visit status). */
  status: string | null;
};
