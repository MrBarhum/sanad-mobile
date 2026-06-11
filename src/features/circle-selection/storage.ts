import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Persists the user's selected active circle id, namespaced per user so two
 * accounts on the same device never share a selection. Web uses localStorage;
 * native uses the encrypted SecureStore (the selected id is a single UUID, well
 * under SecureStore's size limit, so no chunking is needed). All calls are
 * best-effort: a storage failure degrades to an in-memory selection for the
 * session rather than breaking the app.
 *
 * SecureStore keys must match [A-Za-z0-9._-]; user UUIDs satisfy that.
 */
const KEY_PREFIX = 'sanad_active_circle_';

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function loadSelectedCircleId(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(keyFor(userId)) ?? null;
    }
    return await SecureStore.getItemAsync(keyFor(userId));
  } catch {
    return null;
  }
}

export async function saveSelectedCircleId(userId: string, circleId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(keyFor(userId), circleId);
      return;
    }
    await SecureStore.setItemAsync(keyFor(userId), circleId);
  } catch {
    // Ignore: selection still works in memory for this session.
  }
}
