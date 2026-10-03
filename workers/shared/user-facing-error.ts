const TECHNICAL_ERROR_PATTERNS = [
  /^locator\./i,
  /playwright/i,
  /timeout \d+ms exceeded/i,
  /call log:/i,
  /waiting for locator/i,
  /element is not (visible|enabled|stable)/i,
  /attempting click action/i,
  /locator resolved to/i,
];

const BOT_INTERNAL_PATTERNS = [
  /no .* tab found/i,
  /open user management/i,
  /bot chrome/i,
  /ht\.juwa777/i,
  /agentserver/i,
  /not logged in/i,
  /panel not found/i,
];

function isTechnicalError(message: string): boolean {
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function isBotInternalError(message: string): boolean {
  return BOT_INTERNAL_PATTERNS.some((pattern) => pattern.test(message));
}

function genericGameLoadError(loadType?: string | null): string {
  if (loadType === "create_account" || loadType === "new_account") {
    return "Account creation failed. Please try again or contact support if this continues.";
  }
  if (loadType === "load" || loadType === "reload") {
    return "Load failed. Please try again or contact support.";
  }
  if (loadType === "redeem") {
    return "Redeem failed. Please try again or contact support.";
  }
  if (loadType === "check_balance") {
    return "Balance check failed. Please try again.";
  }
  return "Request failed. Please try again or contact support.";
}

/** Store short player-safe text in game_load_requests.error_message. */
export function sanitizeBotErrorForUser(
  errorMessage: string,
  loadType?: string | null
): string {
  const msg = errorMessage.trim();
  if (!msg) return genericGameLoadError(loadType);
  if (isTechnicalError(msg) || isBotInternalError(msg)) {
    return genericGameLoadError(loadType);
  }
  return msg.slice(0, 500);
}
