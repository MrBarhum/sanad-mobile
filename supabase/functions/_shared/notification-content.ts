// Centralized formatter for the REMOTE push payload (Phase 2F-11A).
//
// Product decision: Sanad now sends DETAILED, actionable push notifications by
// default — the reminder clearly says what it is for (medication / task / visit /
// appointment name) instead of a privacy-generic "لديك تذكير جديد". This module is
// the SINGLE place that turns a stored `notifications` row into the outgoing push
// content, so the copy + category logic is never duplicated across the pipeline.
//
// The detailed title/body come from the row itself (authored once by the producer
// via _shared/messages.ts). This module does NOT re-author copy — it selects the
// stored copy with a robust fallback, resolves the action-category id from the
// type, and assembles the routing/occurrence `data` the app's action handler needs.

import { genericPushMessage } from './messages.ts';

/**
 * Notification action categories the APP registers with expo-notifications. The
 * ids must avoid ':' and '-' (Expo warns those can break categories), so they use
 * '_' only. Kept in sync with SANAD_NOTIFICATION_CATEGORY on the client
 * (src/features/notifications/push-registration.ts).
 */
export const SANAD_PUSH_CATEGORY = {
  medication: 'sanad_medication_reminder',
  task: 'sanad_task_reminder',
  visit: 'sanad_visit_reminder',
  appointment: 'sanad_appointment_reminder',
  generic: 'sanad_generic_reminder',
} as const;

/**
 * The action category for a notification type. The four entity reminders carry the
 * "تم" + "ذكرني بعد 5 دقائق" buttons; other pushed reminder types fall back to the
 * generic (snooze-only) category. `emergency` gets NO category — an emergency must
 * never be snoozed/deferred from a button. Types that are never pushed by the
 * reminder cron simply never reach here.
 */
export function pushCategoryId(type: string): string | undefined {
  switch (type) {
    case 'medication_due':
    case 'medication_missed':
      return SANAD_PUSH_CATEGORY.medication;
    case 'task_due':
    case 'task_overdue':
      return SANAD_PUSH_CATEGORY.task;
    case 'visit_upcoming':
    case 'visit_update':
      return SANAD_PUSH_CATEGORY.visit;
    case 'appointment_upcoming':
      return SANAD_PUSH_CATEGORY.appointment;
    case 'emergency':
      return undefined;
    default:
      return SANAD_PUSH_CATEGORY.generic;
  }
}

/** The stored notification row fields this formatter needs (read at send time). */
export type NotificationContentRow = {
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
};

/** Routing identifiers the delivery already knows (independent of the row). */
export type PushRouting = {
  notificationId: string;
  circleId: string | null;
  deepLink: string | null;
};

export type PushContent = {
  title: string;
  body: string;
  categoryId?: string;
  data: Record<string, unknown>;
};

/**
 * Builds the outgoing push content for one delivery. `row` is the stored
 * notification (may be null if it could not be read — then the generic fallback
 * copy is used). The returned `data` merges the row's immutable occurrence context
 * (entity, itemId, scheduleId, doseDate, scheduledTime, taskId, appointmentId, …)
 * with the routing ids + the resolved categoryId, so the app can both deep-link and
 * run the "تم" / snooze actions. No medical NAMES are added to `data` beyond what
 * the (now-detailed) title/body already carry on screen.
 */
export function formatPushNotificationContent(
  type: string,
  row: NotificationContentRow | null,
  routing: PushRouting,
): PushContent {
  const fallback = genericPushMessage();
  const title = (row?.title ?? '').trim() || fallback.title;
  const body = (row?.body ?? '').trim() || fallback.body;
  const categoryId = pushCategoryId(type);

  const source =
    row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {};
  const data: Record<string, unknown> = {
    ...source,
    type,
    notificationId: routing.notificationId,
    circleId: routing.circleId,
    deepLink: routing.deepLink,
  };
  if (categoryId) data.categoryId = categoryId;

  return { title, body, categoryId, data };
}
