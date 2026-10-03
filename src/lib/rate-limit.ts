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
} as const satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window rate limit via the check_rate_limit RPC (service role).
 * Returns true when ALLOWED. Fails open on infra error so a transient DB
 * blip never blocks legitimate members.
 */
export async function rateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string
): Promise<boolean> {
  const rule = RATE_LIMITS[action];
  try {
    const admin = createAdminClient();
    if (!admin) return true;
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: `${action}:${identifier}`,
      p_max_hits: rule.max,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) return true; // fail open
    return data === true;
  } catch {
    return true; // fail open
  }
}
