import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The in-app appearance choice: an explicit light/dark, or `system` to follow the
 * OS. Device-level (not per-user) — it is an app preference, so it persists across
 * sign-in / sign-out. Web uses localStorage; native uses SecureStore (a single
 * short enum value, well under the size limit — no chunking). All calls are
 * best-effort: a storage failure degrades to the in-memory choice for the session.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

const KEY = 'sanad_theme_preference';
const VALID: readonly ThemePreference[] = ['light', 'dark', 'system'];

export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? (globalThis.localStorage?.getItem(KEY) ?? null)
        : await SecureStore.getItemAsync(KEY);
    return raw && (VALID as readonly string[]).includes(raw) ? (raw as ThemePreference) : null;
  } catch {
    return null;
  }
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(KEY, pref);
      return;
    }
    await SecureStore.setItemAsync(KEY, pref);
  } catch {
    // Ignore: the preference still applies in memory for this session.
  }
}
