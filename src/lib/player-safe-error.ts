/** Player-facing copy when deposits cannot run. Never include env or provider setup details. */
export const DEPOSITS_UNAVAILABLE =
  "Deposits are temporarily unavailable. Please try again later or contact support.";

const SENSITIVE_PLAYER_ERROR =
  /paydora|process\.env|supabase|migration|sql editor|[A-Z0-9_]{3,}(?:API_KEY|SECRET|TOKEN|WEBHOOK|ADMIN_URL)|is not configured|not configured|credentials (?:are )?not configured|bearer\s+[a-z0-9._-]+/i;

export function isSensitivePlayerError(message: string): boolean {
  return SENSITIVE_PLAYER_ERROR.test(message);
}

/** Client-safe. Does not log — the raw message must stay on the server. */
export function friendlyPlayerError(message: string | null | undefined, fallback: string): string {
  const msg = (message ?? "").trim();
  if (!msg || isSensitivePlayerError(msg)) return fallback;
  return msg;
}

/** Server-only: log the real error, return copy that is safe to send to a player. */
export function playerPaymentError(err: unknown, fallback = DEPOSITS_UNAVAILABLE): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (!msg.trim() || isSensitivePlayerError(msg)) {
    console.error("[payments]", msg || err);
    return fallback;
  }
  return msg;
}
