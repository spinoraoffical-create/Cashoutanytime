/** Welcome Coins. These are not cash, freeplay, or Reward Points. */

export const WELCOME_COIN_TASKS = [
  { key: "signup", label: "Complete account signup", coins: 200, requires: "A new account is created. Existing accounts are not backfilled." },
  { key: "email_verified", label: "Verify email", coins: 150, requires: "The login email is confirmed. Saving an address is not enough." },
  { key: "phone_otp", label: "Verify phone by OTP", coins: 150, requires: "A completed phone code. A typed phone number is not enough." },
  { key: "kyc_approved", label: "KYC approved", coins: 300, requires: "Staff approval. Upload and rejection award nothing." },
  { key: "telegram_member", label: "Join Telegram community", coins: 100, requires: "A server-side membership check. A checkbox is not enough." },
  { key: "welcome_survey", label: "Complete welcome survey", coins: 100, requires: "One saved submission of the three welcome questions." },
] as const;

export const WELCOME_COIN_TOTAL = WELCOME_COIN_TASKS.reduce((sum, task) => sum + task.coins, 0);

/** Coins a player can actually earn from welcome tasks that are on and can be verified. */
export function availableWelcomeCoins(
  tasks: readonly { key: string; coins: number; enabled: boolean }[],
  options: { phoneReady: boolean; telegramReady: boolean },
): number {
  return tasks.reduce((sum, task) => {
    if (!task.enabled || task.coins <= 0 || task.key.endsWith("_checkin")) return sum;
    if (task.key === "phone_otp" && !options.phoneReady) return sum;
    if (task.key === "telegram_member" && !options.telegramReady) return sum;
    if (!WELCOME_COIN_TASKS.some((item) => item.key === task.key)) return sum;
    return sum + task.coins;
  }, 0);
}

export const DEPOSIT_COINS_PER_DOLLAR = 5;
export const DEPOSIT_COINS_ENABLED = false;
export const COIN_REDEMPTION_ENABLED = false;
export const COINS_PER_FREEPLAY_DOLLAR = 1000;
export const GLOBAL_COIN_BUDGET = 30000;

export const CHECKIN_COINS = { daily: 20, weekly: 100, monthly: 200 } as const;
export const CHECKIN_DAILY_REQUIRED = { weekly: 5, monthly: 20 } as const;
export const CHECKIN_TIMEZONE = "UTC";

export function depositCoinsFor(
  dollars: number,
  enabled = DEPOSIT_COINS_ENABLED,
  rate = DEPOSIT_COINS_PER_DOLLAR,
  maxPerTransaction = Number.POSITIVE_INFINITY,
): number {
  if (!enabled) return 0;
  if (!Number.isFinite(dollars) || dollars <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const raw = Math.floor(dollars) * rate;
  if (!Number.isFinite(maxPerTransaction)) return raw;
  return Math.min(raw, Math.max(0, Math.floor(maxPerTransaction)));
}

/** Coins removed after a refund. A full refund removes the Coins still left on that deposit. */
export function clawbackDepositCoins(input: {
  granted: number;
  alreadyReversed: number;
  reverseDollars: number;
  originalDollars: number;
  rate?: number;
}): number {
  const rate = input.rate ?? DEPOSIT_COINS_PER_DOLLAR;
  const remaining = Math.max(0, Math.floor(input.granted) - Math.floor(input.alreadyReversed));
  if (remaining <= 0 || !Number.isFinite(input.reverseDollars) || input.reverseDollars <= 0) return 0;
  if (input.originalDollars > 0 && input.reverseDollars >= input.originalDollars) return remaining;
  return Math.min(remaining, Math.floor(input.reverseDollars) * rate);
}

/** Freeplay and Coin check-in never both pay. A pause does not turn freeplay back on. */
export function claimSwitchResult(input: { legacy: boolean; coinCheckin: boolean; earning: boolean }) {
  if (input.legacy && input.coinCheckin) return { freeplay: false, coins: false };
  return {
    freeplay: input.legacy && !input.coinCheckin,
    coins: input.coinCheckin && !input.legacy && input.earning,
  };
}

export const BOTH_CLAIM_SWITCHES_ERROR =
  "Both reward systems cannot be active together. Disable one before enabling the other.";

/** Refuse a save that would turn both claim systems on. Nothing is written in that case. */
export function claimSwitchSave(input: { legacy: boolean; coinCheckin: boolean }): { ok: true } | { ok: false; error: string } {
  if (input.legacy && input.coinCheckin) return { ok: false, error: BOTH_CLAIM_SWITCHES_ERROR };
  return { ok: true };
}

export function redemptionAvailable(): false {
  return COIN_REDEMPTION_ENABLED;
}

export function budgetAllows(issued: number, next: number, cap = GLOBAL_COIN_BUDGET): boolean {
  return issued >= 0 && next >= 0 && issued + next <= cap;
}

export const SURVEY_CHOICES = {
  games: ["slots", "fish", "both"],
  source: ["telegram", "friend", "search", "other"],
  interest: ["rewards", "variety", "support"],
} as const;

export function surveyAnswersValid(input: { games?: string; source?: string; interest?: string }): boolean {
  return (SURVEY_CHOICES.games as readonly string[]).includes(input.games ?? "")
    && (SURVEY_CHOICES.source as readonly string[]).includes(input.source ?? "")
    && (SURVEY_CHOICES.interest as readonly string[]).includes(input.interest ?? "");
}
