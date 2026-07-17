import { Platform } from 'react-native';

/**
 * The exact native deep link (the `scheme` in app.json + the reset route). Passed
 * verbatim rather than built via `Linking.createURL`, whose value varies in a dev
 * client / Expo Go (an `exp+…`/dev-server URL) and so would NOT match the Supabase
 * Auth "Redirect URLs" allow-list — when the redirect isn't allow-listed Supabase
 * silently falls back to the project Site URL (its `http://localhost:3000` default),
 * which is exactly the "link opens localhost:3000" symptom. Keep this in sync with
 * the allow-list and the native-first Site URL — see the milestone-4.1 addendum.
 */
export const RESET_PASSWORD_DEEP_LINK = 'sanadmobile://reset-password';

/**
 * Where Supabase should send the user after they tap the reset link in their
 * email. Native returns the fixed app deep link above; web returns the same path
 * on the current origin.
 */
export function passwordResetRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/reset-password`;
  }
  return RESET_PASSWORD_DEEP_LINK;
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
