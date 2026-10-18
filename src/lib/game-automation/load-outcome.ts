/** Decisions for a game load. No database and no provider calls. */

export type ProviderOutcome = "confirmed_success" | "confirmed_failure" | "unknown";

const UNKNOWN_PROVIDER = /timed out|timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network|aborted|unreachable|empty response|invalid JSON|bad gateway|fetch failed|worker interrupted|outcome unknown/i;

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

const FALSE_REFUND_CLAIM =
  /your funds have been 100% refunded to your wallet balance\.?|100% refunded|the wallet refund is recorded\.?|the wallet refund is not confirmed\.?/gi;

export function stripFalseRefundClaim(message: string): string {
  return message.replace(FALSE_REFUND_CLAIM, " ").replace(/\s+/g, " ").trim();
}

/**
 * A refund sentence is allowed only after wallet_refunded is read back.
 * An unconfirmed provider failure does not get a refund sentence.
 */
export function loadRefundNotice(input: {
  providerMessage: string;
  walletRefunded: boolean;
  refundExpected: boolean;
}): string {
  const base = stripFalseRefundClaim(input.providerMessage);
  if (!input.refundExpected) return base;
  if (input.walletRefunded) return `${base} The wallet refund is recorded.`.trim();
  return `${base} The wallet refund is not confirmed.`.trim();
}

/** Admin display. A stored "refunded" sentence is not proof. */
export function displayedLoadError(
  message: string | null | undefined,
  walletRefunded?: boolean | null
): string | null {
  const text = message?.trim();
  if (!text) return null;
  if (!/100% refunded|wallet refund is recorded|wallet refund is not confirmed/i.test(text)) return text;
  return loadRefundNotice({
    providerMessage: text,
    walletRefunded: walletRefunded === true,
    refundExpected: true,
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

export const PROVIDER_OUTCOME_UNVERIFIED =
  "Provider outcome unverified. Investigate before changing this request.";

/**
 * Admin Complete / Failed / Cancel must not move money from a stored row.
 * game_load_requests has no provider-outcome column. error_message is not proof:
 * an unknown hold is saved as "Needs review …", and reading that text back can
 * classify as a confirmed failure. Pending is not a failed provider result.
 * Confirmed failures are still refunded only by the automatic provider path.
 */
export function adminFinancialStatusDecision(input: {
  status: string | null | undefined;
  loadType?: string | null;
}): { proceed: false; reason: string } {
  if (input.status === "completed" || input.status === "failed" || input.status === "cancelled") {
    return { proceed: false, reason: "already_settled" };
  }
  return { proceed: false, reason: PROVIDER_OUTCOME_UNVERIFIED };
}

export const STALE_LOAD_CHECK_FAILED =
  "Stale-request check failed. Leave this request unchanged and investigate before closing it.";

/**
 * A failed fail_my_stale_game_load call is not a confirmed provider failure.
 * The app must not refund or close the row from that error.
 */
/**
 * A successful balance check must carry the provider's number.
 * Zero is a real balance. A missing number is unknown and must not be saved as zero.
 */
export function confirmedCheckBalance(reported: number | null | undefined): number | null {
  if (typeof reported !== "number" || !Number.isFinite(reported)) return null;
  return reported;
}

export function staleLoadRpcDecision(input: {
  rpcFailed: boolean;
  healedCount?: number | null;
}): { appRefund: false; healed: number; error?: string } {
  if (input.rpcFailed) {
    return { appRefund: false, healed: 0, error: STALE_LOAD_CHECK_FAILED };
  }
  const healed = Number(input.healedCount ?? 0);
  return { appRefund: false, healed: Number.isFinite(healed) ? healed : 0 };
}
