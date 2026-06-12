import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type AppNotification = Database['public']['Tables']['notifications']['Row'];
export type NotificationType = Database['public']['Enums']['notification_type'];
export type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row'];

/** Editable preference fields (everything except the server-managed columns). */
export type NotificationPreferencesInput = {
  medicationReminders: boolean;
  missedDoseAlerts: boolean;
  taskReminders: boolean;
  appointmentReminders: boolean;
  visitUpdates: boolean;
  careUpdates: boolean;
  emergencyAlerts: boolean;
  remoteSummary: boolean;
  quietHoursEnabled: boolean;
  /** 'HH:MM' or null. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
};

/** Default initial limit for the inbox. The list is recent-first and bounded; a
 * "load more" extends the range. */
export const NOTIFICATIONS_PAGE_SIZE = 50;

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (userId: string | undefined, circleId: string | null | undefined) =>
    ['notifications', 'list', userId, circleId ?? 'all'] as const,
  unread: (userId: string | undefined) => ['notifications', 'unread', userId] as const,
  preferences: (userId: string | undefined, circleId: string | null | undefined) =>
    ['notifications', 'prefs', userId, circleId ?? 'global'] as const,
  device: (userId: string | undefined) => ['notifications', 'device', userId] as const,
};

// ---------------------------------------------------------------------------
// Reads (RLS: a user can only ever read their own notifications/preferences)
// ---------------------------------------------------------------------------

/**
 * Recent notifications for the signed-in user, newest first. The inbox is global
 * across circles by default; pass a circleId to filter to one circle. `before`
 * (an ISO created_at) pages backwards. RLS restricts rows to the caller, and the
 * explicit user_id filter keeps the query intent obvious.
 */
export async function fetchNotifications(
  userId: string,
  options: { circleId?: string | null; limit?: number; before?: string | null } = {},
): Promise<AppNotification[]> {
  const limit = options.limit ?? NOTIFICATIONS_PAGE_SIZE;
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.circleId) query = query.eq('circle_id', options.circleId);
  if (options.before) query = query.lt('created_at', options.before);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Count of unread notifications for the user (head-only, no row payload). */
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * The user's preference row for a circle (or their global default when circleId
 * is null). Returns null when none has been saved yet — the UI then shows the
 * server defaults (everything on, quiet hours off).
 */
export async function fetchPreferences(
  userId: string,
  circleId: string | null,
): Promise<NotificationPreferences | null> {
  let query = supabase.from('notification_preferences').select('*').eq('user_id', userId);
  query = circleId ? query.eq('circle_id', circleId) : query.is('circle_id', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/** Whether an active push token is registered for the user on this device id. */
export async function fetchDeviceToken(
  userId: string,
  deviceId: string | null,
): Promise<{ id: string; is_active: boolean } | null> {
  if (!deviceId) return null;
  // A device can briefly hold more than one active token (token rotation before
  // the old row is deactivated), so take the most-recently-seen one rather than
  // assuming a single row.
  const { data, error } = await supabase
    .from('push_tokens')
    .select('id, is_active')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Mutations (all sensitive writes go through SECURITY DEFINER RPCs)
// ---------------------------------------------------------------------------

export async function setNotificationRead(notificationId: string, read: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_notification_read', {
    p_notification_id: notificationId,
    p_read: read,
  });
  if (error) throw error;
}

export async function markAllNotificationsRead(circleId: string | null): Promise<number> {
  const { data, error } = await supabase.rpc('mark_all_notifications_read', {
    p_circle_id: circleId ?? undefined,
  });
  if (error) throw error;
  return data ?? 0;
}

export async function upsertPreferences(
  circleId: string | null,
  input: NotificationPreferencesInput,
): Promise<NotificationPreferences> {
  // Every param is positional (no SQL default), so all 13 must be sent; the
  // nullable ones (circle/quiet-hours/timezone) are passed as null, not omitted.
  const { data, error } = await supabase.rpc('upsert_notification_preferences', {
    p_circle_id: circleId,
    p_medication_reminders: input.medicationReminders,
    p_missed_dose_alerts: input.missedDoseAlerts,
    p_task_reminders: input.taskReminders,
    p_appointment_reminders: input.appointmentReminders,
    p_visit_updates: input.visitUpdates,
    p_care_updates: input.careUpdates,
    p_emergency_alerts: input.emergencyAlerts,
    p_remote_summary: input.remoteSummary,
    p_quiet_hours_enabled: input.quietHoursEnabled,
    p_quiet_hours_start: input.quietHoursStart,
    p_quiet_hours_end: input.quietHoursEnd,
    p_timezone: input.timezone,
  });
  if (error) throw error;
  return data as NotificationPreferences;
}

/** Registers/refreshes the caller's Expo push token. Never logs the raw token. */
export async function registerPushToken(input: {
  token: string;
  platform: string;
  deviceId: string | null;
  appVersion: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('register_push_token', {
    p_token: input.token,
    p_platform: input.platform,
    p_device_id: input.deviceId ?? undefined,
    p_app_version: input.appVersion ?? undefined,
  });
  if (error) throw error;
}

export async function deactivatePushToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_push_token', { p_token: token });
  if (error) throw error;
}

/** Maps a saved preference row to the editable input (server defaults when absent). */
export function preferencesToInput(
  row: NotificationPreferences | null,
): NotificationPreferencesInput {
  return {
    medicationReminders: row?.medication_reminders ?? true,
    missedDoseAlerts: row?.missed_dose_alerts ?? true,
    taskReminders: row?.task_reminders ?? true,
    appointmentReminders: row?.appointment_reminders ?? true,
    visitUpdates: row?.visit_updates ?? true,
    careUpdates: row?.care_updates ?? true,
    emergencyAlerts: row?.emergency_alerts ?? true,
    remoteSummary: row?.remote_summary ?? true,
    quietHoursEnabled: row?.quiet_hours_enabled ?? false,
    quietHoursStart: row?.quiet_hours_start ? row.quiet_hours_start.slice(0, 5) : null,
    quietHoursEnd: row?.quiet_hours_end ? row.quiet_hours_end.slice(0, 5) : null,
    timezone: row?.timezone ?? null,
  };
}
