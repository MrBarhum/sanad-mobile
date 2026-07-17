import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Persistence for a circle-join code captured from a WhatsApp invite deep link
 * (`sanadmobile://join-circle?code=…`) while the tapper is SIGNED OUT. The (app)
 * auth gate would otherwise redirect to /sign-in and drop the `?code`, so we stash
 * it — in-memory for the live session AND in SecureStore so it survives a cold
 * start / force-quit mid sign-up — and replay it into /join-circle once the user
 * authenticates. The code is not a secret; SecureStore is simply the persistent
 * store this app already uses for the session (F1). No new native dependency.
 */
const KEY = 'sanad.pending_join_code';

let inMemoryCode: string | null = null;

/** The pending code held for the current JS session (no async round-trip). */
export function pendingJoinCodeInMemory(): string | null {
  return inMemoryCode;
}

/** Stash a captured code (memory + persistent, best-effort). */
export async function stashPendingJoinCode(code: string): Promise<void> {
  inMemoryCode = code;
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(KEY, code);
  } catch {
    // Persistence is best-effort; the in-memory copy still covers this session.
  }
}

/** Load any previously-stashed code (memory first, then persistent). */
export async function loadPendingJoinCode(): Promise<string | null> {
  if (inMemoryCode) return inMemoryCode;
  if (Platform.OS === 'web') return null;
  try {
    inMemoryCode = (await SecureStore.getItemAsync(KEY)) || null;
  } catch {
    inMemoryCode = null;
  }
  return inMemoryCode;
}

/** Clear the stash (memory + persistent) once the code has been replayed. */
export async function clearPendingJoinCode(): Promise<void> {
  inMemoryCode = null;
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Best-effort; the in-memory copy is already cleared above.
  }
}

/**
 * Extracts the join code from a `…/join-circle?code=…` deep link (any scheme /
 * host / dev-server prefix), or null when the URL isn't a join link or carries no
 * code. Deliberately tolerant so it works for both the production
 * `sanadmobile://join-circle?code=…` and a dev-client `exp://…/--/join-circle?…`.
 */
export function joinCodeFromUrl(url: string | null | undefined): string | null {
  if (!url || !url.includes('join-circle')) return null;
  const q = url.indexOf('?');
  if (q < 0) return null;
  const query = url.slice(q + 1).split('#')[0];
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const value = eq >= 0 ? pair.slice(eq + 1) : '';
    if (key === 'code') {
      try {
        return decodeURIComponent(value).trim() || null;
      } catch {
        return value.trim() || null;
      }
    }
  }
  return null;
}
