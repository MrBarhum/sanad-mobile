/**
 * Structured logging helper. Logs are intentionally minimal: counts, ids and
 * statuses only. NEVER pass a raw OR partial push token, a secret, a notification
 * title/body, or any health value here. To correlate a token in logs, log its
 * `push_token_id` / `delivery_id` instead — never the token value or any slice of
 * it.
 */
export function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ event, error: message, ...fields }));
}
