/**
 * HTTP helpers for USER-INVOKED edge functions.
 *
 * Every function before Milestone 7 is cron-invoked: it answers a bare
 * `{ ok: true }` / `{ ok: false }`, needs no CORS, and duplicates a private
 * `json()` helper per file. A user-invoked function needs three things none of
 * them do — a CORS preflight, a machine-readable failure code, and a method
 * guard — so those live here rather than being copy-pasted. Getting CORS subtly
 * wrong in one of several copies is exactly the failure this avoids.
 *
 * On `*` as the allowed origin: these endpoints authenticate with a Bearer JWT
 * and set no cookies, so a permissive origin grants a browser nothing it could
 * not already do with the token it would have to already hold. The app also runs
 * on web from a dev-server origin that varies per machine, so pinning one origin
 * would break local development for no security gain.
 */

export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
};

/** JSON response with CORS headers attached. */
export function json(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

/** 204 answer to a CORS preflight. Returns null when the request is not one. */
export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * A machine code the client maps to an i18n string. The function NEVER returns
 * user-facing prose: all copy lives in ar.json/en.json at parity, and a server
 * that returns Arabic would put a user-facing string outside the i18n layer.
 */
export function failure(code: string, status: number, extra?: Record<string, unknown>): Response {
  return json({ ok: false, code, ...extra }, status);
}
