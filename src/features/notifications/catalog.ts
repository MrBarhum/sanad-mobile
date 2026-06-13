import type { Href } from 'expo-router';

import type { AppNotification, NotificationType } from './api';

/**
 * Per-type display metadata. `labelKey` is the i18n key for the type's short
 * label; `fallbackRoute` is where a tap goes when the notification carries no
 * explicit deep link. The per-type visual anchor (a calm non-emoji glyph + tone)
 * lives with the UI that renders it â€” see `TYPE_GLYPH` in
 * `notifications-center.tsx` â€” so this stays a pure data/routing module.
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
