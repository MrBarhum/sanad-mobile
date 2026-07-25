import { Platform } from 'react-native';

/**
 * The exact native deep link (the `scheme` in app.json + the reset route). Passed
 * verbatim rather than built via `Linking.createURL`, whose value varies in a dev
 * client / Expo Go (an `exp+…`/dev-server URL) and so would NOT match the Supabase
 * Auth "Redirect URLs" allow-list — when the redirect isn't allow-listed Supabase
 * silently falls back to the project Site URL (its `http://localhost:3000` default),
 * which is exactly the "link opens localhost:3000" symptom. Keep this in sync with
 * the allow-list and the native-first Site URL — see the milestone-4.1 addendum.
 *
 * MILESTONE 7: the emailed **link** is no longer the primary recovery path — see
 * `OTP_LENGTH` below. This constant (and the URL-parsing helpers) stay so that
 * recovery emails already in flight keep resolving while the Dashboard template
 * transitions to the 6-digit code.
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

/**
 * ── Why recovery moved to a 6-digit code (Milestone 7) ────────────────────────
 * `{{ .ConfirmationURL }}` resolves to a **single-use** `GET /auth/v1/verify`.
 * Email security scanners (Microsoft Defender Safe Links, Outlook.com, corporate
 * gateways) prefetch links to analyse them, and that GET is indistinguishable
 * from the user's — so the token is consumed before the human ever taps it and
 * the real tap lands on `#error=access_denied&error_code=otp_expired`. Supabase
 * documents this ("email prefetching") and lists a typed OTP as the mitigation;
 * the upstream issue (supabase/auth#1214) is open and unresolved.
 *
 * `verifyOtp({ email, token, type: 'recovery' })` is a plain POST with no URL at
 * all, so it is immune to prefetch AND to every deep-link/allow-list failure this
 * file used to document. It is also flow-type independent — unlike PKCE, which
 * would still be burned by a scanner and additionally fails whenever the link
 * opens outside this app install (the code verifier lives in this app's
 * SecureStore only).
 *
 * Requires a maintainer-applied Dashboard change: the "Reset Password" template
 * must render `{{ .Token }}` and must REMOVE `{{ .ConfirmationURL }}` — they are
 * the same underlying secret, so leaving the URL in means a scanner GET still
 * invalidates the printed code.
 */
export const OTP_LENGTH = 6;

/** Supabase allows one recovery email per address per 60s; match it exactly. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Client-side cap on wrong-code submissions. Supabase rate-limits `/verify` by IP
 * (360/hour) but documents no per-user lockout, so this is a cheap brute-force
 * floor — and it stops a user burning the whole IP budget on a typo.
 */
export const MAX_CODE_ATTEMPTS = 5;

const ARABIC_INDIC_ZERO = 0x0660; // ٠-٩
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0; // ۰-۹

/**
 * Normalise a typed recovery code to the exact ASCII digits Supabase compares
 * against. An Arabic keyboard emits Arabic-Indic digits (٠-٩) or the Persian
 * extended set (۰-۹), and the RTL context can leave bidi control marks inside the
 * value — Supabase does a byte comparison, so any of those silently fails as a
 * "wrong code". Everything that is not a digit is dropped (spaces, dashes,
 * U+200E/U+200F, U+2066…U+2069), which also makes a pasted "123 456" work.
 */
export function normalizeOtpCode(raw: string): string {
  let out = '';
  for (const char of raw) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code >= 0x30 && code <= 0x39) {
      out += char;
    } else if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    }
  }
  return out.slice(0, OTP_LENGTH);
}

/** True once the normalised code is exactly `OTP_LENGTH` digits. */
export function isCompleteOtpCode(value: string): boolean {
  return normalizeOtpCode(value).length === OTP_LENGTH;
}

/** Reads Supabase's machine-readable `AuthError.code` without importing its types. */
function authErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return null;
}

/**
 * Maps a `resetPasswordForEmail` failure to an i18n key. Account existence is
 * never disclosed — a missing address resolves without error — but a rate limit
 * is about the REQUESTER, not about whether the account exists, so surfacing it
 * is safe and stops the user waiting for an email that was never sent.
 */
export function requestCodeErrorKey(error: unknown): string {
  switch (authErrorCode(error)) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'auth.errors.tooManyRequests';
    default:
      return 'auth.errors.generic';
  }
}

/** Maps a `verifyOtp` failure to an i18n key so expiry reads differently from a typo. */
export function verifyCodeErrorKey(error: unknown): string {
  switch (authErrorCode(error)) {
    case 'otp_expired':
      return 'auth.errors.codeExpired';
    case 'over_request_rate_limit':
      return 'auth.errors.tooManyRequests';
    case 'otp_disabled':
      return 'auth.errors.generic';
    default:
      return 'auth.errors.codeInvalid';
  }
}

/** Maps an `updateUser({ password })` failure to an i18n key. */
export function updatePasswordErrorKey(error: unknown): string {
  switch (authErrorCode(error)) {
    case 'same_password':
      return 'auth.errors.samePassword';
    case 'weak_password':
      return 'auth.errors.weakPassword';
    default:
      return 'auth.resetFailed';
  }
}

export type RecoveryParams = {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  type?: string;
  error?: string;
  /** e.g. `otp_expired` — distinguishes a consumed link from a malformed one. */
  errorCode?: string;
  errorDescription?: string;
};

/**
 * Extracts the recovery credentials from an incoming reset-link URL. Supabase
 * delivers them either in the URL fragment (implicit flow:
 * `#access_token=…&refresh_token=…&type=recovery`) or as a `?code=…` query
 * (PKCE) — we read BOTH because `detectSessionInUrl` is disabled on this client,
 * so nothing parses the URL for us. Also surfaces `error`/`error_code`/
 * `error_description` (e.g. a scanner-consumed link) so the screen can show a
 * real message.
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
    errorCode: params.error_code || undefined,
    errorDescription: params.error_description || undefined,
  };
}

/**
 * True when an incoming URL actually carries recovery credentials. Used to keep
 * the legacy link path from hijacking the OTP path (and to stop an
 * already-signed-in user reaching the "set a new password" state with no token —
 * which would silently change the CURRENT account's password).
 */
export function hasRecoveryPayload(params: RecoveryParams): boolean {
  return Boolean(params.accessToken || params.code || params.error);
}
