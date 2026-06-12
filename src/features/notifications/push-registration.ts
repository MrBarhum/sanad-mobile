import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAppVersion, getDeviceTimezone, getOrCreateDeviceId } from './device';

/**
 * Expo push registration lifecycle. This module owns the native plumbing only —
 * orchestration (when to register, listeners, deep-link routing) lives in hooks.
 *
 * Principles enforced here:
 *   * Never request permission as a side effect of import or launch — only the
 *     explicit `requestPermission()` call (driven by a user action) prompts.
 *   * Native push is iOS/Android only. On web (and on simulators without a real
 *     device) we report "unsupported" rather than faking a token.
 *   * The Expo project id is resolved from app/EAS config, never hardcoded; if it
 *     is missing we surface a typed error the UI can explain.
 *   * The raw token is returned to the caller for registration but never logged.
 */

export const ANDROID_CHANNEL_ID = 'default';

export type PushSupport = 'supported' | 'web-unsupported' | 'no-device';
export type PushPermission = 'granted' | 'denied' | 'undetermined';

/** Thrown by token acquisition when no EAS project id is configured. */
export class ProjectIdMissingError extends Error {
  constructor() {
    super('Missing EAS projectId; configure expo.extra.eas.projectId.');
    this.name = 'ProjectIdMissingError';
  }
}

let handlerConfigured = false;

/**
 * Restrained foreground behavior: show the banner + add to the notification
 * list, but no sound or badge churn while the app is open. Safe to call more than
 * once; only the first call installs the handler. Guarded for web where the
 * handler is a no-op.
 */
export function configureForegroundHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export function pushSupport(): PushSupport {
  if (Platform.OS === 'web') return 'web-unsupported';
  if (!Device.isDevice) return 'no-device';
  return 'supported';
}

export function resolveProjectId(): string | null {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  return (typeof fromExtra === 'string' && fromExtra) || (typeof fromEas === 'string' && fromEas) || null;
}

export async function getPermission(): Promise<PushPermission> {
  const settings = await Notifications.getPermissionsAsync();
  return toPermission(settings);
}

/** Explicit, user-initiated permission prompt. Returns the resulting status. */
export async function requestPermission(): Promise<PushPermission> {
  const settings = await Notifications.requestPermissionsAsync();
  return toPermission(settings);
}

function toPermission(settings: Notifications.NotificationPermissionsStatus): PushPermission {
  if (settings.granted) return 'granted';
  if (settings.status === 'undetermined' || settings.canAskAgain) return 'undetermined';
  return 'denied';
}

/** Creates/updates the Android notification channel. No-op off Android. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Sanad reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: true,
  });
}

/**
 * Acquires the device's Expo push token. Assumes permission is already granted.
 * Returns null when push is unsupported on this platform/device. Throws
 * ProjectIdMissingError when no EAS project id is configured.
 */
export async function acquireExpoPushToken(): Promise<string | null> {
  if (pushSupport() !== 'supported') return null;
  const projectId = resolveProjectId();
  if (!projectId) throw new ProjectIdMissingError();
  await ensureAndroidChannel();
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data; // raw token — handed to the caller, never logged
}

/** Snapshot of the device facts a registration call needs. */
export async function deviceRegistrationInfo(): Promise<{
  platform: string;
  deviceId: string;
  appVersion: string | null;
  timezone: string;
}> {
  return {
    platform: Platform.OS,
    deviceId: await getOrCreateDeviceId(),
    appVersion: getAppVersion(),
    timezone: getDeviceTimezone(),
  };
}

/**
 * Schedules a LOCAL device notification a few seconds out — a self-test that the
 * device can display notifications. Creates NO server row and affects no other
 * member. Native only.
 */
export async function scheduleLocalTestNotification(
  title: string,
  body: string,
  seconds = 5,
): Promise<void> {
  if (pushSupport() === 'web-unsupported') return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { test: true } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: ANDROID_CHANNEL_ID },
  });
}
