// Minimal Expo Push API client (send + receipts). No SDK dependency. The Expo
// service authenticates by the token itself, so no secret is needed here.

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  // Notification category id → the app's registered action category (the "تم" /
  // "ذكرني بعد 5 دقائق" buttons). Expo maps this to `categoryIdentifier` on the
  // device; supported on Android and iOS. The category must be registered on the
  // device (setNotificationCategoryAsync) before the notification arrives.
  categoryId?: string;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
};

export type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

export type ExpoReceipt =
  | { status: 'ok' }
  | { status: 'error'; message: string; details?: { error?: string } };

export function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

/**
 * When Expo "Enhanced Push Security" is enabled, the send/receipt APIs require an
 * access token. If EXPO_ACCESS_TOKEN is set (server env only — never in the app or
 * Git, never logged), it is sent as a Bearer token. If it is absent and Expo
 * rejects the request as unauthorized, we throw a clear operational error pointing
 * at the missing secret (without ever echoing the token).
 */
function expoHeaders(): Record<string, string> {
  const base: Record<string, string> = {
    Accept: 'application/json',
    'Accept-encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) base.Authorization = `Bearer ${accessToken}`;
  return base;
}

function assertNotUnauthorized(status: number, api: string): void {
  if (status !== 401 && status !== 403) return;
  const hasToken = Boolean(Deno.env.get('EXPO_ACCESS_TOKEN'));
  throw new Error(
    hasToken
      ? `Expo ${api} rejected (${status}) despite EXPO_ACCESS_TOKEN — verify the token / its scopes`
      : `Expo ${api} rejected (${status}); Enhanced Push Security appears enabled — set EXPO_ACCESS_TOKEN`,
  );
}

/** Sends one batch (<=100) of messages; returns tickets aligned to input order. */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const res = await fetch(EXPO_SEND_URL, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify(messages),
  });
  assertNotUnauthorized(res.status, 'push send');
  if (!res.ok) {
    throw new Error(`Expo push send failed: ${res.status}`);
  }
  const json = (await res.json()) as { data?: ExpoTicket[] };
  return json.data ?? [];
}

/** Fetches delivery receipts for a set of ticket ids. */
export async function getExpoReceipts(
  ticketIds: string[],
): Promise<Record<string, ExpoReceipt>> {
  if (ticketIds.length === 0) return {};
  const res = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify({ ids: ticketIds }),
  });
  assertNotUnauthorized(res.status, 'receipts');
  if (!res.ok) {
    throw new Error(`Expo receipts failed: ${res.status}`);
  }
  const json = (await res.json()) as { data?: Record<string, ExpoReceipt> };
  return json.data ?? {};
}

/** Provider errors that definitively mean a token is dead and must be deactivated. */
export function isUnregisteredError(detail: string | undefined): boolean {
  return detail === 'DeviceNotRegistered';
}
