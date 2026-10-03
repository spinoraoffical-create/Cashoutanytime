import type { Page } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameLoadJob, JuwaBotResult } from "./types.js";
import { planCreateAccount, variantFromPlan } from "../../shared/numbered-credentials.js";
import { CREATE_ACCOUNT_MAX_ATTEMPTS } from "../../shared/panel-create.js";
import { resolveDepositRedeemForJob } from "../../shared/deposit-redeem-guard.js";
import { openBrowserSession, vpnHint } from "./browser.js";
import {
  goToUserManagement,
  fillCreateUserForm,
  rechargeAccount,
  redeemAccount,
  readUserGameBalanceForCheck,
  userExists,
} from "./juwa-panel.js";
import {
  fillFirstTextInput,
  fillPasswordInput,
  log,
  screenshot,
  waitForManualLogin,
  isLoginPage,
} from "./panel-utils.js";

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function envOptional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function passwordForUsername(username: string, preferred?: string | null): string {
  return preferred?.trim() || username;
}

/** Find a free numbered account name (shivoo1, shivoo2, …). */
async function resolveUniqueUsername(
  page: Page,
  plan: ReturnType<typeof planCreateAccount>
): Promise<string> {
  const variant = variantFromPlan(plan);
  for (let attempt = 0; attempt < CREATE_ACCOUNT_MAX_ATTEMPTS; attempt++) {
    const candidate = variant(plan.stem, attempt);
    const taken = await userExists(page, candidate).catch(() => false);
    if (!taken) {
      if (attempt > 0) log("create-user", `using "${candidate}" (${plan.stem}#${plan.startNum + attempt})`);
      return candidate;
    }
  }
  const suffix = String(Date.now()).slice(-4);
  return `${plan.stem.slice(0, 13 - suffix.length)}${suffix}`;
}

async function createUser(
  page: Page,
  job: GameLoadJob
): Promise<{ username: string; password: string }> {
  const plan = planCreateAccount(job);
  log(
    "create-user",
    `${plan.stem} from #${plan.startNum} (requester: ${job.requester_name ?? job.requester_email ?? job.user_id})`
  );

  await goToUserManagement(page);
  await screenshot(page, "03-user-management");

  const username = await resolveUniqueUsername(page, plan);
  const password = passwordForUsername(username, plan.preferredPassword);
  const creds = { username, password };

  await fillCreateUserForm(page, creds.username, creds.password);
  await screenshot(page, "04-after-create");
  return creds;
}

async function checkBalance(page: Page, job: GameLoadJob): Promise<number> {
  const username = job.game_username?.trim();
  if (!username) throw new Error("Check balance requires game username");
  log("check-balance", username);
  const balance = await readUserGameBalanceForCheck(page, username);
  await screenshot(page, "08-balance");
  return balance;
}

async function fillLoginCredentials(page: Page, username: string, password: string) {
  const customUser = envOptional("JUWA_SEL_LOGIN_USER");
  const customPass = envOptional("JUWA_SEL_LOGIN_PASS");

  if (customUser) {
    await page.fill(customUser, username);
  } else {
    await fillFirstTextInput(page, username, 0);
  }

  if (customPass) {
    await page.fill(customPass, password);
  } else {
    await fillPasswordInput(page, password, 0);
  }
}

async function login(page: Page) {
  const url = envOptional("JUWA_ADMIN_URL") ?? "https://ht.juwa777.com/login";
  const username = envOptional("JUWA_AGENT_USERNAME") ?? envOptional("PANEL_USERNAME") ?? "";
  const password = envOptional("JUWA_AGENT_PASSWORD") ?? envOptional("PANEL_PASSWORD") ?? "";

  if (!(await isLoginPage(page)) && page.url().includes("juwa")) {
    log("login", "already logged in — skipping");
    return;
  }

  if (!page.url().includes("juwa") || !(await isLoginPage(page))) {
    log("login", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
  await screenshot(page, "01-login-page");

  if (!(await isLoginPage(page))) {
    log("login", "already logged in after navigation");
    return;
  }

  await fillLoginCredentials(page, username, password);
  await waitForManualLogin(page);
  await screenshot(page, "02-after-login");
  log("login", "success");
}

async function rechargeUser(page: Page, username: string, amount: number) {
  log("recharge", `${username} $${amount}`);
  await rechargeAccount(page, username, amount);
  await screenshot(page, "06-after-recharge");
}

async function redeemUser(
  page: Page,
  job: GameLoadJob,
  supabase: SupabaseClient
): Promise<{ username: string; redeemedAmount: number }> {
  const username = job.game_username?.trim();
  if (!username) throw new Error("Redeem requires game username");

  const balance = await readUserGameBalanceForCheck(page, username);
  const amount = await resolveDepositRedeemForJob(supabase, job, balance);
  log("redeem", `${username} $${amount}`);

  const redeemedAmount = await redeemAccount(page, username, amount);
  await screenshot(page, "07-after-redeem");
  return { username, redeemedAmount };
}

export async function ensurePanelLoggedIn(): Promise<void> {
  const session = await openBrowserSession();
  try {
    await login(session.page);
  } finally {
    if (!process.env.JUWA_CDP_URL) {
      await session.close();
    }
  }
}

export async function runJuwaJob(job: GameLoadJob, supabase: SupabaseClient): Promise<JuwaBotResult> {
  const session = await openBrowserSession();
  const { page, close } = session;

  try {
    await login(page);

    if (job.load_type === "create_account" || job.load_type === "new_account") {
      const creds = await createUser(page, job);
      return creds;
    }

    if (job.load_type === "load" || job.load_type === "reload") {
      const username = job.game_username?.trim();
      if (!username) throw new Error("Load requires game username");
      await rechargeUser(page, username, Number(job.amount));
      return { username };
    }

    if (job.load_type === "redeem") {
      const result = await redeemUser(page, job, supabase);
      return { username: result.username, redeemedAmount: result.redeemedAmount };
    }

    if (job.load_type === "check_balance") {
      const balance = await checkBalance(page, job);
      return { username: job.game_username?.trim() ?? "", balance };
    }

    throw new Error(`Unknown load type: ${job.load_type}`);
  } catch (err) {
    await screenshot(page, "error");
    throw new Error(vpnHint(err));
  } finally {
    // Keep Chrome open when using CDP — don't disconnect mid-session
    if (!process.env.JUWA_CDP_URL) {
      await close();
    }
  }
}
