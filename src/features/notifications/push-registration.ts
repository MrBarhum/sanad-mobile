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

// ---------------------------------------------------------------------------
// Action categories (Phase 2F-11A: actionable notifications)
// ---------------------------------------------------------------------------

/**
 * Action-category identifiers. They must avoid ':' and '-' (Expo warns those can
 * break categories), so they use '_' only. Kept in sync with SANAD_PUSH_CATEGORY on
 * the server (supabase/functions/_shared/notification-content.ts): the push carries
 * `categoryId`, which Expo maps to `categoryIdentifier` on the device.
 */
export const SANAD_NOTIFICATION_CATEGORY = {
  medication: 'sanad_medication_reminder',
  task: 'sanad_task_reminder',
  visit: 'sanad_visit_reminder',
  appointment: 'sanad_appointment_reminder',
  generic: 'sanad_generic_reminder',
} as const;

/** Action identifiers reported back via NotificationResponse.actionIdentifier. */
export const SANAD_NOTIFICATION_ACTION = {
  complete: 'complete',
  snooze5: 'snooze_5',
} as const;

// Registration state. `categoriesConfigured` flips to true ONLY after a fully
// successful batch, so a partial/failed registration is retried on the next call
// rather than being masked as "done". `categoriesInFlight` coalesces concurrent or
// repeated startup calls (root layout + observer) onto a single registration.
let categoriesConfigured = false;
let categoriesInFlight: Promise<void> | null = null;

/**
 * Registers the Sanad notification action categories ("تم" + "ذكرني بعد 5 دقائق").
 * Idempotent and SAFE to call at startup: setNotificationCategoryAsync does NOT
 * request notification permission, so this preserves the explicit opt-in flow.
 * The generic category carries snooze only ("تم" is meaningful only for the four
 * completable entities). No-op on web.
 *
 * Robustness: repeated/concurrent calls share one in-flight promise; every
 * setNotificationCategoryAsync is awaited before the "configured" flag is set; a
 * failed batch leaves the flag false so a later call retries and (in development)
 * logs a clear, secret-free warning.
 */
export async function ensureNotificationCategories(): Promise<void> {
  if (categoriesConfigured) return;
  if (pushSupport() === 'web-unsupported') return;
  if (categoriesInFlight) return categoriesInFlight;

  const complete: Notifications.NotificationAction = {
    identifier: SANAD_NOTIFICATION_ACTION.complete,
    buttonTitle: 'تم',
    options: { opensAppToForeground: true },
  };
  const snooze: Notifications.NotificationAction = {
    identifier: SANAD_NOTIFICATION_ACTION.snooze5,
    buttonTitle: 'ذكرني بعد 5 دقائق',
    options: { opensAppToForeground: true },
  };
  const entityActions = [complete, snooze];

  categoriesInFlight = (async () => {
    try {
      // Await ALL registrations, then mark configured — never optimistically.
      await Promise.all([
        Notifications.setNotificationCategoryAsync(SANAD_NOTIFICATION_CATEGORY.medication, entityActions),
        Notifications.setNotificationCategoryAsync(SANAD_NOTIFICATION_CATEGORY.task, entityActions),
        Notifications.setNotificationCategoryAsync(SANAD_NOTIFICATION_CATEGORY.visit, entityActions),
        Notifications.setNotificationCategoryAsync(SANAD_NOTIFICATION_CATEGORY.appointment, entityActions),
        Notifications.setNotificationCategoryAsync(SANAD_NOTIFICATION_CATEGORY.generic, [snooze]),
      ]);
      categoriesConfigured = true;
      if (__DEV__) await logRegisteredCategories();
    } catch (err) {
      // Non-critical: without categories the notification still shows and deep-links;
      // it just won't render action buttons. Leave the flag false so a later startup
      // call retries, and surface the failure in development. No secrets are involved —
      // categories carry only the static button ids/titles above, never tokens.
      if (__DEV__) {
        console.warn('[sanad][notifications] action-category registration failed; buttons may not render', err);
      }
    } finally {
      categoriesInFlight = null;
    }
  })();

  return categoriesInFlight;
}

/**
 * Dev-only observability: read the action categories back out of the OS store and
 * log each id with its action ids, so a "buttons missing" retest can confirm at a
 * glance whether registration actually landed on this device. Logs only the static
 * category/action identifiers — never push tokens, user data, or secrets.
 */
async function logRegisteredCategories(): Promise<void> {
  try {
    const categories = await Notifications.getNotificationCategoriesAsync();
    const summary = categories
      .map((c) => `${c.identifier}[${c.actions.map((a) => a.identifier).join(',')}]`)
      .sort();
    console.log(`[sanad][notifications] registered categories (${categories.length}):`, summary);
  } catch (err) {
    console.warn('[sanad][notifications] could not read back registered categories', err);
  }
}

/**
 * One-shot, idempotent startup bootstrap for the notification subsystem. SAFE to
 * call from the ROOT layout, before the auth gate: nothing here prompts for
 * permission, so the explicit opt-in flow is preserved. Registering the Android
 * channel and the action categories this early populates the OS category store
 * before the first push can arrive — even on a first launch or while signed out —
 * so action buttons render regardless of when (or whether) the user has signed in.
 * Cheap to repeat: the foreground handler and categories are guarded, and
 * setNotificationChannelAsync simply upserts the channel.
 */
export async function bootstrapNotifications(): Promise<void> {
  configureForegroundHandler();
  try {
    await ensureAndroidChannel();
  } catch (err) {
    if (__DEV__) console.warn('[sanad][notifications] android channel setup failed', err);
  }
  await ensureNotificationCategories();
}

/**
 * Schedules a LOCAL "snooze" reminder ~5 minutes out, reusing the original
 * notification's clear title/body, data, deep link and category so the same text
 * and action buttons reappear. Uses a deterministic identifier keyed on the source
 * notification and cancels any prior snooze for it first, so re-snoozing the same
 * reminder never stacks duplicates. Native only; creates NO server row.
 */
export async function scheduleSnoozeNotification(params: {
  key: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  categoryIdentifier?: string;
  minutes?: number;
}): Promise<void> {
  if (pushSupport() === 'web-unsupported') return;
  await ensureAndroidChannel();
  const identifier = `sanad_snooze_${params.key}`;
  const seconds = Math.max(60, Math.round((params.minutes ?? 5) * 60));
  // Cancel any existing snooze for this reminder so we never stack duplicates.
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: params.title,
      body: params.body,
      data: { ...params.data, snoozed: true },
      categoryIdentifier: params.categoryIdentifier,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}

// ---------------------------------------------------------------------------
// TEMPORARY — Phase 2F-11C Test A (dev-only local action-button discriminator)
// ---------------------------------------------------------------------------

/**
 * DEV-ONLY discriminator for the "no action buttons on Android" investigation.
 * Schedules a LOCAL notification that references the existing `sanad_task_reminder`
 * category (buttons "تم" / "ذكرني بعد 5 دقائق"). A LOCAL notification is always built
 * by expo-notifications, so — unlike a backgrounded REMOTE push, which Android renders
 * as an FCM "Notification Message" without applying the category — its action buttons
 * SHOULD render. This isolates the remote/background path (forensics report
 * 2026-07-13) from the category setup. Creates NO server row and notifies no one else.
 * Native only; call behind __DEV__. Remove with the dev button once the test concludes.
 */
export async function scheduleLocalActionButtonTest(seconds = 5): Promise<void> {
  if (pushSupport() === 'web-unsupported') return;
  // Self-contained: make sure the channel + categories exist before we reference them.
  await ensureAndroidChannel();
  await ensureNotificationCategories();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'اختبار الأزرار',
      body: 'محلي — يجب أن تظهر أزرار تم / ذكرني',
      categoryIdentifier: SANAD_NOTIFICATION_CATEGORY.task,
      data: { test: true, actionButtonTest: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}
