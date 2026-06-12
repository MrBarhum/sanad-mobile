import Constants from 'expo-constants';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Device-scoped helpers for push registration. The device id is a stable,
 * non-secret identifier persisted once per device so a user's token row can be
 * matched to "this device" across launches (and so a re-registration updates the
 * same row instead of piling up duplicates). It is NOT a hardware id.
 */
const DEVICE_ID_KEY = 'sanad_device_id';

function randomId(): string {
  // Non-cryptographic: a device id only needs to be stable + unique-enough.
  const rand = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `${rand()}-${rand()}-${rand()}-${rand()}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      const existing = globalThis.localStorage?.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const next = randomId();
      globalThis.localStorage?.setItem(DEVICE_ID_KEY, next);
      return next;
    }
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;
    const next = randomId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, next);
    return next;
  } catch {
    // Storage failure: a per-session id still lets registration work this run.
    return randomId();
  }
}

/**
 * The device's IANA timezone (e.g. "Asia/Riyadh"), captured to store on the
 * user's preferences so reminders/quiet hours use the right local time. Falls
 * back to the JS runtime zone, then UTC — never a hardcoded region.
 */
export function getDeviceTimezone(): string {
  try {
    const calendarTz = Localization.getCalendars?.()[0]?.timeZone;
    if (calendarTz) return calendarTz;
  } catch {
    // fall through
  }
  try {
    const intlTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (intlTz) return intlTz;
  } catch {
    // fall through
  }
  return 'UTC';
}

export function getAppVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}
