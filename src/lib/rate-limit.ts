import "server-only";

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
  telegramAdmin: { max: 30, windowSeconds: 60 },
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

/** Money / mass-action paths deny the request if limiter infra is down. */
const FAIL_CLOSED_ACTIONS = new Set<keyof typeof RATE_LIMITS>([
  "paydoraCreate",
  "paydoraPayout",
  "gameLoad",
  "broadcast",
]);

export type RateLimitOutcome = {
  allowed: boolean;
  reason?: "limited" | "unavailable";
};

/**
 * Fixed-window rate limit via the check_rate_limit RPC (service role).
 * Fail-open: public/read/chat/auth so a DB blip does not lock members out.
 * Fail-closed: deposits, payouts, game loads, broadcasts — never move money
 * if the limiter cannot be evaluated.
 */
export async function checkRateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string
): Promise<RateLimitOutcome> {
  const rule = RATE_LIMITS[action];
  const failClosed = FAIL_CLOSED_ACTIONS.has(action);
  try {
    const admin = createAdminClient();
    if (!admin) {
      return failClosed ? { allowed: false, reason: "unavailable" } : { allowed: true };
    }
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: `${action}:${identifier}`,
      p_max_hits: rule.max,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) {
      return failClosed ? { allowed: false, reason: "unavailable" } : { allowed: true };
    }
    if (data === true) return { allowed: true };
    return { allowed: false, reason: "limited" };
  } catch {
    return failClosed ? { allowed: false, reason: "unavailable" } : { allowed: true };
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
