import type { Page } from "playwright";

export type FastLoginOptions = {
  isLoginPage: (page: Page) => Promise<boolean>;
  loginToPanel: (page: Page) => Promise<void>;
  /** If current URL matches, skip navigation when already logged in */
  readyUrlTest?: RegExp;
};

/**
 * Skip full panel navigation when Chrome tab is already on the agent dashboard.
 * Cuts ~2–3s per load/balance/create job.
 */
export async function ensureLoggedInForJob(
  page: Page,
  options: FastLoginOptions
): Promise<void> {
  const url = page.url();
  const readyPattern = options.readyUrlTest ?? /userManagement|player\/index|HomeDetail/i;
  if (readyPattern.test(url) && !(await options.isLoginPage(page))) {
    return;
  }
  await options.loginToPanel(page);
}

/** Default queue poll interval for all bots (ms). */
export function botPollIntervalMs(botSpecificEnv?: string): number {
  const specific = botSpecificEnv ? Number(process.env[botSpecificEnv]) : NaN;
  if (Number.isFinite(specific) && specific >= 500) return Math.floor(specific);
  const shared = Number(process.env.BOT_POLL_MS ?? 2500);
  return Number.isFinite(shared) && shared >= 500 ? Math.floor(shared) : 2500;
}
