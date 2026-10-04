import { clientIp, rateLimit as dbRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export { clientIp };

/** DB-backed limiter with the previous in-memory call shape. */
export async function rateLimit(
  key: string,
  _maxRequests?: number,
  _windowMs?: number
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const action = key.startsWith("ai-bot") ? "chatAiBot" : "chatLiveBot";
  const ok = await dbRateLimit(action, key);
  if (ok) return { ok: true };
  return { ok: false, retryAfterSec: RATE_LIMITS[action].windowSeconds };
}
