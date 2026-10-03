const TECHNICAL_ERROR_PATTERNS = [
  /^locator\./i,
  /playwright/i,
  /timeout \d+ms exceeded/i,
  /call log:/i,
  /waiting for locator/i,
  /element is not (visible|enabled|stable)/i,
  /attempting click action/i,
  /locator resolved to/i,
  /no juwa tab/i,
  /user management/i,
  /bot chrome/i,
  /open.*chrome/i,
  /then retry\.?$/i,
  /account creation failed:/i,
  /could not read balance/i,
  /https?:\/\//i,
  /\.com\b/i,
  /ht\.juwa777/i,
];

/** Short server-side messages that are safe to show players. */
const PLAYER_SAFE_ERROR_PATTERNS = [
  /^cancelled/i,
  /^you already have/i,
  /^no account to replace/i,
  /^load credits/i,
  /^check your live/i,
  /^need at least \$/i,
  /^enter \$/i,
  /^minimum/i,
  /^maximum/i,
  /^insufficient/i,
  /^you loaded from/i,
  /^not enough balance/i,
  /^create your game account/i,
  /^a request is already/i,
  /^loads must use/i,
  /^redeems go to/i,
  /^username must/i,
  /^password must/i,
  /^run supabase\//i,
];

function isTechnicalError(message: string): boolean {
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function isPlayerSafeError(message: string): boolean {
  return PLAYER_SAFE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
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

/** Map bot/Playwright errors to short messages for players — never expose bot setup details. */
export function userFacingGameLoadError(
  errorMessage: string | null | undefined,
  loadType?: string | null
): string | null {
  if (!errorMessage?.trim()) return null;

  const msg = errorMessage.trim();
  if (isPlayerSafeError(msg) && !isTechnicalError(msg)) return msg;

  return genericGameLoadError(loadType);
}

/** Recent activity: status line only (e.g. "Balance check · failed") — no error body for players. */
export function showGameLoadErrorDetail(
  _errorMessage: string | null | undefined,
  _loadType?: string | null
): boolean {
  return false;
}
