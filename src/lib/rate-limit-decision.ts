/** Maps app limits onto the live check_rate_limit signature. No database call. */

export const SECURITY_ACTIONS = [
  "signup",
  "login",
  "spin",
  "task_claim",
  "deposit",
  "withdraw",
] as const;

export type SecurityAction = (typeof SECURITY_ACTIONS)[number];

const ACTION_ENUM: Record<string, SecurityAction> = {
  claim: "task_claim",
  ticketCreate: "login",
  ticketReply: "login",
  reviewCreate: "login",
  profileUpdate: "login",
  broadcast: "login",
  telegramAdmin: "login",
  telegramCustomer: "login",
  paydoraCreate: "deposit",
  paydoraPayout: "withdraw",
  paydoraStatus: "deposit",
  authOtp: "login",
  gameLoad: "task_claim",
  chatLiveBot: "login",
  chatAiBot: "login",
};

export function securityActionFor(action: string): SecurityAction {
  return ACTION_ENUM[action] ?? "login";
}

export function rateLimitAllowed(data: unknown): boolean | null {
  if (data === true) return true;
  if (data === false) return false;
  if (data && typeof data === "object" && "allowed" in data) {
    return Boolean((data as { allowed: unknown }).allowed);
  }
  return null;
}

/** A failed check blocks the request. It does not become unlimited. */
export function decideRateLimit(data: unknown, errored: boolean): { allowed: boolean; reason?: "limited" | "unavailable" } {
  if (errored) return { allowed: false, reason: "unavailable" };
  const allowed = rateLimitAllowed(data);
  if (allowed === null) return { allowed: false, reason: "unavailable" };
  if (allowed) return { allowed: true };
  return { allowed: false, reason: "limited" };
}
