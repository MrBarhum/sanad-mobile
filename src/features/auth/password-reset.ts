import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Where Supabase should send the user after they tap the reset link in their
 * email. Native returns the app's deep link (`sanadmobile://reset-password`);
 * web returns the same path on the current origin. This exact URL (its scheme +
 * path) must be added to the Supabase Auth "Redirect URLs" allow-list — see the
 * milestone-4 runbook — or Supabase rejects it and the email link won't open.
 */
export function passwordResetRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/reset-password`;
  }
  return Linking.createURL('/reset-password');
}

export type RecoveryParams = {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  type?: string;
  error?: string;
  errorDescription?: string;
};

/**
 * Extracts the recovery credentials from an incoming reset-link URL. Supabase
 * delivers them either in the URL fragment (implicit flow:
 * `#access_token=…&refresh_token=…&type=recovery`) or as a `?code=…` query
 * (PKCE) — we read BOTH because `detectSessionInUrl` is disabled on this client,
 * so nothing parses the URL for us. Also surfaces `error`/`error_description`
 * (e.g. an expired link) so the screen can show a real message.
 */
export function parseRecoveryParams(url: string | null | undefined): RecoveryParams {
  if (!url) return {};
  const params: Record<string, string> = {};
  const collect = (segment: string) => {
    for (const pair of segment.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = eq >= 0 ? pair.slice(0, eq) : pair;
      const value = eq >= 0 ? pair.slice(eq + 1) : '';
      try {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      } catch {
        params[key] = value;
      }
    }
  };

  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  if (queryIdx >= 0) {
    const end = hashIdx > queryIdx ? hashIdx : url.length;
    collect(url.slice(queryIdx + 1, end));
  }
  if (hashIdx >= 0) collect(url.slice(hashIdx + 1));

  return {
    accessToken: params.access_token || undefined,
    refreshToken: params.refresh_token || undefined,
    code: params.code || undefined,
    type: params.type || undefined,
    error: params.error || undefined,
    errorDescription: params.error_description || undefined,
  };
}
