import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** A recipient resolved by the circle_notification_recipients DB function. */
export type Recipient = {
  user_id: string;
  timezone: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export type NotificationTypeName =
  | 'medication_due'
  | 'medication_missed'
  | 'task_due'
  | 'task_overdue'
  | 'appointment_upcoming'
  | 'visit_upcoming'
  | 'visit_update'
  | 'care_update'
  | 'item_assigned'
  | 'item_claimed'
  | 'item_completed'
  | 'item_cancelled'
  | 'claim_digest'
  | 'daily_summary'
  | 'emergency'
  | 'system';

/** The entity dimension carried in data.entity and used by the responsibility resolver. */
export type ItemEntity = 'task' | 'medication' | 'appointment' | 'visit';

/**
 * Map of circle_id → IANA timezone (default 'UTC'). The CARE-CIRCLE timezone is
 * the canonical zone for resolving wall-clock medication/task schedules into one
 * absolute occurrence shared by every recipient (a remote member does NOT shift
 * the dose to their own country). Recipient timezones are used only for quiet
 * hours / display.
 */
export async function fetchCircleTimezones(sb: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await sb.from('care_circles').select('id, timezone');
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.id, row.timezone ?? 'UTC');
  return map;
}

/**
 * Active members of a circle eligible for a notification type (role + prefs).
 * CIRCLE-BROAD — retained for legacy / broadcast types (e.g. emergency, system,
 * care_update, visit_update). Owner-targeted item reminders use recipientsForItem
 * instead (this helper has no owner awareness).
 */
export async function recipientsFor(
  sb: SupabaseClient,
  circleId: string,
  type: NotificationTypeName,
): Promise<Recipient[]> {
  const { data, error } = await sb.rpc('circle_notification_recipients', {
    p_circle_id: circleId,
    p_type: type,
  });
  if (error) throw error;
  return (data ?? []) as Recipient[];
}

/**
 * Responsibility-aware recipients for ONE item event: the accountable owner
 * (assigned_to / responsible_user_id / visitor_user_id), with manager fallback only
 * where the resolver allows it, and manager-only awareness for claim/outcome types.
 * Wraps notification_recipients_for_item_event (service_role only). An unassigned
 * TASK resolves to NOBODY; an unassigned medication/appointment/visit falls back to
 * managers. remote_member/elder exclusion, preferences and quiet hours are enforced
 * in SQL. Same row shape as recipientsFor, so enqueueForRecipient is unchanged.
 */
export async function recipientsForItem(
  sb: SupabaseClient,
  circleId: string,
  type: NotificationTypeName,
  entity: ItemEntity,
  itemId: string,
): Promise<Recipient[]> {
  const { data, error } = await sb.rpc('notification_recipients_for_item_event', {
    p_circle_id: circleId,
    p_type: type,
    p_entity: entity,
    p_item_id: itemId,
  });
  if (error) throw error;
  return (data ?? []) as Recipient[];
}

/**
 * Active managers (admin / primary_caregiver) of a circle, with tz + quiet hours,
 * for TIER-2 escalation (an assigned owner failed to act). Wraps
 * notification_item_managers (service_role only). Escalation rows MUST also set
 * data.tier='manager' so the send-time currency gate validates a current manager
 * (and re-applies preference / remote eligibility) instead of item ownership.
 */
export async function notificationManagers(
  sb: SupabaseClient,
  circleId: string,
): Promise<Recipient[]> {
  const { data, error } = await sb.rpc('notification_item_managers', {
    p_circle_id: circleId,
  });
  if (error) throw error;
  return (data ?? []) as Recipient[];
}

/**
 * Enqueues one notification for one recipient via the SECURITY DEFINER
 * enqueue_notification function (dedupe + outbox + quiet-hours deferral happen in
 * the DB). Returns the new notification id, or null when the dedupe key collapsed
 * it to an existing row. Passing the recipient's own timezone + quiet hours keeps
 * deferral correct per person.
 */
export async function enqueueForRecipient(
  sb: SupabaseClient,
  recipient: Recipient,
  args: {
    type: NotificationTypeName;
    title: string;
    body: string;
    circleId: string | null;
    data?: Record<string, unknown>;
    deepLink?: string | null;
    dedupeKey: string;
    expiresAt?: string | null;
  },
): Promise<string | null> {
  const { data, error } = await sb.rpc('enqueue_notification', {
    p_user_id: recipient.user_id,
    p_type: args.type,
    p_title: args.title,
    p_body: args.body,
    p_circle_id: args.circleId,
    p_data: args.data ?? {},
    p_deep_link: args.deepLink ?? null,
    p_dedupe_key: args.dedupeKey,
    p_expires_at: args.expiresAt ?? null,
    p_timezone: recipient.timezone,
    p_quiet_hours_enabled: recipient.quiet_hours_enabled,
    p_quiet_hours_start: recipient.quiet_hours_start,
    p_quiet_hours_end: recipient.quiet_hours_end,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}
