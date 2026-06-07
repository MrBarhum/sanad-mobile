import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Database } from '../src/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  // Fail fast instead of constructing a broken client with empty credentials.
  // Never embed a fallback URL/key in the bundle.
  throw new Error(
    'Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file.',
  );
}

/**
 * SecureStore persists values in the iOS Keychain / Android Keystore (encrypted
 * at rest), but the underlying platform can reject values larger than ~2048
 * bytes. Supabase session payloads (access token + refresh token + user object)
 * routinely exceed that, so this adapter transparently splits a value into
 * byte-bounded chunks.
 *
 * Layout for a logical `key`:
 *   key          -> {"__sb_chunks__": N}   (manifest)
 *   key.0..key.N-1 -> the value slices, in order
 */
const CHUNK_SIZE_BYTES = 2000;
const CHUNK_MANIFEST_KEY = '__sb_chunks__';

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // high surrogate -> single 4-byte code point
      i++; // skip the paired low surrogate
    } else bytes += 3;
  }
  return bytes;
}

function splitIntoByteChunks(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  // Iterate by code point so multi-byte characters are never split mid-sequence.
  for (const char of value) {
    const charBytes = utf8ByteLength(char);
    if (currentBytes + charBytes > maxBytes && current.length > 0) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function readChunkCount(rawManifest: string): number | null {
  try {
    const parsed = JSON.parse(rawManifest) as Record<string, unknown>;
    const count = parsed[CHUNK_MANIFEST_KEY];
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}

const ChunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const manifest = await SecureStore.getItemAsync(key);
    if (manifest === null) return null;

    const count = readChunkCount(manifest);
    if (count === null) {
      // Value was written outside this adapter; return it verbatim.
      return manifest;
    }

    let value = '';
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null; // incomplete -> treat as no value
      value += part;
    }
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    // Remove any stale chunks left behind by a previous, longer value.
    const previous = await SecureStore.getItemAsync(key);
    if (previous !== null) {
      const previousCount = readChunkCount(previous);
      if (previousCount !== null) {
        for (let i = 0; i < previousCount; i++) {
          await SecureStore.deleteItemAsync(`${key}.${i}`);
        }
      }
    }

    const chunks = splitIntoByteChunks(value, CHUNK_SIZE_BYTES);
    let index = 0;
    for (const chunk of chunks) {
      await SecureStore.setItemAsync(`${key}.${index}`, chunk);
      index++;
    }
    await SecureStore.setItemAsync(key, JSON.stringify({ [CHUNK_MANIFEST_KEY]: chunks.length }));
  },

  async removeItem(key: string): Promise<void> {
    const manifest = await SecureStore.getItemAsync(key);
    if (manifest !== null) {
      const count = readChunkCount(manifest);
      if (count !== null) {
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}.${i}`);
        }
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Native: encrypted Keychain/Keystore via the chunked adapter above.
    // Web: SecureStore is unavailable, so fall back to the default browser storage.
    storage: Platform.OS === 'web' ? undefined : ChunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
