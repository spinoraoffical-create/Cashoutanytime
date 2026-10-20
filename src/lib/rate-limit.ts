import "server-only";

import { logIncident } from "@/lib/observability/incident";
import { decideRateLimit, securityActionFor } from "@/lib/rate-limit-decision";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitRule = { max: number; windowSeconds: number };

/** Centralized limits per sensitive action. */
export const RATE_LIMITS = {
  claim: { max: 30, windowSeconds: 60 },
  ticketCreate: { max: 5, windowSeconds: 300 },
  ticketReply: { max: 20, windowSeconds: 60 },
  reviewCreate: { max: 5, windowSeconds: 3600 },
  profileUpdate: { max: 15, windowSeconds: 60 },
  broadcast: { max: 5, windowSeconds: 60 },
  pushSubscribe: { max: 8, windowSeconds: 60 },
  telegramAdmin: { max: 30, windowSeconds: 60 },
  telegramRecovery: { max: 5, windowSeconds: 60 },
  telegramCustomer: { max: 20, windowSeconds: 60 },
  paydoraCreate: { max: 8, windowSeconds: 60 },
  paydoraPayout: { max: 5, windowSeconds: 300 },
  paydoraStatus: { max: 30, windowSeconds: 60 },
  authOtp: { max: 5, windowSeconds: 300 },
  gameLoad: { max: 10, windowSeconds: 60 },
  chatLiveBot: { max: 30, windowSeconds: 60 },
  chatAiBot: { max: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isPublicIp(ip: string) {
  if (!ip || ip === "unknown") return false;
  const bare = ip.replace(/^::ffff:/i, "");
  if (bare === "::1" || bare.startsWith("fe80:") || bare.startsWith("fc") || bare.startsWith("fd")) return false;
  const match = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return bare.includes(":");
  const a = Number(match[1]);
  const b = Number(match[2]);
  if ([a, b, Number(match[3]), Number(match[4])].some((n) => n > 255)) return false;
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 192 && b === 168) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 169 && b === 254) return false;
  return true;
}

/** Paydora rejects loopback and private addresses. */
export function publicClientIp(request: Request): string | null {
  const header = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"),
  ]
    .filter(Boolean)
    .join(",");
  for (const part of header.split(",")) {
    const ip = part.trim();
    if (isPublicIp(ip)) return ip.replace(/^::ffff:/i, "");
  }
  return null;
}

export type RateLimitOutcome = {
  allowed: boolean;
  reason?: "limited" | "unavailable";
};

/**
 * Fixed-window rate limit via check_rate_limit (service role).
 * The live function takes p_bucket_key, p_action, p_max_attempts, p_window_seconds
 * and returns JSON { allowed }. A database error blocks the request.
 */
export async function checkRateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string
): Promise<RateLimitOutcome> {
  const rule = RATE_LIMITS[action];
  try {
    const admin = createAdminClient();
    if (!admin) {
      logIncident("rate-limit", `${action} admin client unavailable`);
      return { allowed: false, reason: "unavailable" };
    }
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket_key: `${action}:${identifier}`,
      p_action: securityActionFor(action),
      p_max_attempts: rule.max,
      p_window_seconds: rule.windowSeconds,
      p_block_seconds: 0,
    } as never);
    if (error) {
      logIncident("rate-limit", `${action} ${error.message}`);
      return decideRateLimit(null, true);
    }
    return decideRateLimit(data, false);
  } catch (err) {
    logIncident("rate-limit", err instanceof Error ? err.message : "check failed");
    return { allowed: false, reason: "unavailable" };
  }
}

export async function rateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string
): Promise<boolean> {
  return (await checkRateLimit(action, identifier)).allowed;
}

export function rateLimitUserMessage(outcome: RateLimitOutcome): string {
  if (outcome.reason === "unavailable") {
    return "Temporarily unavailable. Please try again shortly.";
  }
  return "Too many requests. Please wait a moment.";
}
