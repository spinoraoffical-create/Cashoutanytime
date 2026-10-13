/** Decisions for a game load. No database and no provider calls. */

export type ProviderOutcome = "confirmed_success" | "confirmed_failure" | "unknown";

const UNKNOWN_PROVIDER = /timed out|timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network|aborted|unreachable|empty response|invalid JSON|bad gateway|fetch failed|worker interrupted/i;

export function classifyProviderOutcome(input: {
  success: boolean;
  error?: string | null;
}): ProviderOutcome {
  if (input.success) return "confirmed_success";
  const message = input.error?.trim() ?? "";
  if (!message || UNKNOWN_PROVIDER.test(message)) return "unknown";
  return "confirmed_failure";
}

export function mayRefundLoad(input: {
  outcome: ProviderOutcome;
  loadType: string;
  gameApiDebited: boolean;
  walletRefunded: boolean;
}): boolean {
  if (input.outcome !== "confirmed_failure") return false;
  if (input.gameApiDebited || input.walletRefunded) return false;
  return input.loadType === "load" || input.loadType === "reload";
}

export function shouldRefundProviderError(message: string | null | undefined, loadType: string): boolean {
  return mayRefundLoad({
    outcome: classifyProviderOutcome({ success: false, error: message }),
    loadType,
    gameApiDebited: false,
    walletRefunded: false,
  });
}

/** A second load is refused while the first row is still open. */
export function secondLoadBlocked(status: string | null): boolean {
  return status === "pending" || status === "processing";
}

/** complete_game_load ignores a row that is no longer open. */
export function completionApplies(status: string | null): boolean {
  return status === "pending" || status === "processing";
}
