/** Why a saved newsletter recipient must not be emailed right now. */

export function recipientOutcome(status: string, error: string | null | undefined): "accepted" | "pending" | "skipped" | "failed" | "unknown" {
  if (status === "sent") return "accepted";
  if (status === "pending") return "pending";
  if ((error || "").startsWith("Skipped:")) return "skipped";
  if (status === "failed") return "failed";
  return "unknown";
}

export const PROMO_SKIP_OFF = "Skipped: email notices are off.";
export const PROMO_SKIP_UNKNOWN_PREFS = "Skipped: could not confirm email notices.";
export const PROMO_SKIP_BANNED = "Skipped: account is banned.";
export const PROMO_SKIP_SUSPENDED = "Skipped: account is suspended.";
export const PROMO_SKIP_UNKNOWN_ACCOUNT = "Skipped: could not confirm the account.";
export const PROMO_SKIP_MISSING_ACCOUNT = "Skipped: account was not found.";

/** Map one profile read to the send guard. A database error stays ineligible. */
export function accountStateFromProfileRead(input: {
  error: boolean;
  row: { is_suspended?: boolean | null } | null;
}): {
  accountError: boolean;
  hasAccount: boolean;
  suspended: boolean | null;
  banned: boolean | null;
} {
  if (input.error) {
    return { accountError: true, hasAccount: false, suspended: null, banned: null };
  }
  if (!input.row) {
    return { accountError: false, hasAccount: false, suspended: null, banned: null };
  }
  return {
    accountError: false,
    hasAccount: true,
    suspended: input.row.is_suspended === true,
    banned: null,
  };
}

export function promoEmailBlockReason(input: {
  prefsError: boolean;
  hasPrefs: boolean;
  emailPromotions: boolean | null | undefined;
  accountError: boolean;
  hasAccount: boolean;
  suspended: boolean | null | undefined;
  banned: boolean | null | undefined;
}): string | null {
  if (input.prefsError) return PROMO_SKIP_UNKNOWN_PREFS;
  if (!input.hasPrefs || input.emailPromotions !== true) return PROMO_SKIP_OFF;
  if (input.accountError) return PROMO_SKIP_UNKNOWN_ACCOUNT;
  if (!input.hasAccount) return PROMO_SKIP_MISSING_ACCOUNT;
  if (input.banned === true) return PROMO_SKIP_BANNED;
  if (input.suspended === true) return PROMO_SKIP_SUSPENDED;
  return null;
}
