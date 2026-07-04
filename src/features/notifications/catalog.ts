import type { Href } from 'expo-router';

import type { AppNotification, NotificationType } from './api';

/**
 * Per-type display metadata. `labelKey` is the i18n key for the type's short
 * label; `fallbackRoute` is where a tap goes when the notification carries no
 * explicit deep link. The per-type visual anchor (a calm non-emoji glyph + tone)
 * lives with the UI that renders it — see `TYPE_GLYPH` in
 * `notifications-center.tsx` — so this stays a pure data/routing module.
 */
type NotificationTypeMeta = {
  labelKey: string;
  fallbackRoute: Href | null;
};

export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  medication_due: { labelKey: 'notifications.types.medication_due', fallbackRoute: '/medications' },
  medication_missed: { labelKey: 'notifications.types.medication_missed', fallbackRoute: '/medications' },
  task_due: { labelKey: 'notifications.types.task_due', fallbackRoute: '/tasks' },
  appointment_upcoming: { labelKey: 'notifications.types.appointment_upcoming', fallbackRoute: '/appointments' },
  visit_update: { labelKey: 'notifications.types.visit_update', fallbackRoute: '/visits' },
  care_update: { labelKey: 'notifications.types.care_update', fallbackRoute: '/daily-logs' },
  emergency: { labelKey: 'notifications.types.emergency', fallbackRoute: '/emergency-card' },
  system: { labelKey: 'notifications.types.system', fallbackRoute: null },
  // Phase 2F responsibility-aware types. Owner/assignment/awareness rows carry an
  // explicit `deep_link` from the producer (entity varies), so their fallbackRoute
  // is null — a tap without a deep link just opens the inbox. `claim_digest` has no
  // itemId and its recipients cannot open an item detail via RLS, so it must fall
  // back to the `/available-to-claim` feed, never an entity screen.
  item_assigned: { labelKey: 'notifications.types.itemAssigned', fallbackRoute: null },
  task_overdue: { labelKey: 'notifications.types.taskOverdue', fallbackRoute: '/tasks' },
  visit_upcoming: { labelKey: 'notifications.types.visitUpcoming', fallbackRoute: '/visits' },
  item_claimed: { labelKey: 'notifications.types.itemClaimed', fallbackRoute: null },
  item_completed: { labelKey: 'notifications.types.itemCompleted', fallbackRoute: null },
  item_cancelled: { labelKey: 'notifications.types.itemCancelled', fallbackRoute: null },
  claim_digest: { labelKey: 'notifications.types.claimDigest', fallbackRoute: '/available-to-claim' },
};

export function notificationMeta(type: NotificationType): NotificationTypeMeta {
  return NOTIFICATION_TYPE_META[type] ?? NOTIFICATION_TYPE_META.system;
}

/** Shape we read out of a notification's `data` jsonb (all optional/untrusted). */
export type NotificationData = {
  deepLink?: string;
  circleId?: string;
  [key: string]: unknown;
};

export function notificationData(n: Pick<AppNotification, 'data'>): NotificationData {
  const d = n.data;
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as NotificationData) : {};
}

/**
 * The in-app route a notification should open. Prefers the explicit `deep_link`
 * column, then a `deepLink` in `data`, then the type's fallback route. Returns
 * null when there is nowhere sensible to go (the item still opens the inbox).
 */
export function notificationRoute(
  n: Pick<AppNotification, 'type' | 'deep_link' | 'data'>,
): Href | null {
  const explicit = n.deep_link ?? notificationData(n).deepLink ?? null;
  if (explicit) return explicit as Href;
  return notificationMeta(n.type).fallbackRoute;
}
