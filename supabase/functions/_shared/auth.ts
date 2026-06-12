/**
 * Authorizes a scheduled/server invocation. These functions are not for end
 * users: they are triggered by the scheduler (pg_cron + pg_net, or an external
 * cron) which must present the shared secret NOTIFICATIONS_CRON_SECRET in the
 * `x-cron-secret` header (or as a Bearer token). If the secret is not configured
 * we FAIL CLOSED (return false) rather than running unauthenticated.
 *
 * The comparison is length-constant to avoid leaking the secret via timing.
 */
export function authorizeScheduledRequest(req: Request): boolean {
  const expected = Deno.env.get('NOTIFICATIONS_CRON_SECRET');
  if (!expected) return false;

  const headerSecret = req.headers.get('x-cron-secret');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const provided = headerSecret ?? bearer ?? '';
  return timingSafeEqual(provided, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}
