import type { Locator, Page } from "playwright";
import { CREATE_ACCOUNT_MAX_ATTEMPTS, DUPLICATE_USERNAME_RE } from "../../shared/panel-create.js";
import { isCaptchaSolverConfigured } from "../../shared/panel-login-captcha.js";
import { dismissSessionExpiredModal } from "../../shared/panel-session-expired.js";
import { isLoginPage, log, screenshot, waitForManualLogin } from "./panel-utils.js";

const ADMIN_URL = process.env.GAMEVAULT_ADMIN_URL?.trim() || "https://agent.gamevault999.com/login";
const BASE_URL = ADMIN_URL.replace(/\/login.*$/i, "");
const USER_MGMT_URL = `${BASE_URL}/userManagement`;

/* ------------------------------------------------------------------ login */

export async function loginToPanel(page: Page): Promise<void> {
  await dismissSessionExpiredModal(page, log);

  const alreadyOnPanel =
    /userManagement/i.test(page.url()) && !(await isLoginPage(page));
  if (!alreadyOnPanel) {
    await page.goto(USER_MGMT_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  if (!(await isLoginPage(page))) {
    log("login", "already authenticated");
    return;
  }

  // The panel requires an image CAPTCHA on every login, so it can't be fully
  // automated. Pre-fill the credentials, then the operator only types the code.
  const username = process.env.GAMEVAULT_AGENT_USERNAME?.trim();
  const password = process.env.GAMEVAULT_AGENT_PASSWORD?.trim();
  if (username) {
    await page
      .locator('input:not([type="password"]):not([type="hidden"])')
      .first()
      .fill(username)
      .catch(() => {});
  }
  if (password) {
    await page.locator('input[type="password"]').first().fill(password).catch(() => {});
  }

  const interactive =
    process.env.GAMEVAULT_HEADLESS === "false" || Boolean(process.env.GAMEVAULT_CDP_URL);
  if (interactive || isCaptchaSolverConfigured()) {
    await waitForManualLogin(page);
    await page.goto(USER_MGMT_URL, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    log("login", "success");
    return;
  }

  await screenshot(page, "login-captcha");
  throw new Error(
    "Game Vault login needs an image CAPTCHA. Run start-chrome-for-bot.bat, log in by hand, " +
      "then set GAMEVAULT_CDP_URL=http://127.0.0.1:9224 and start the bot."
  );
}

/* ---------------------------------------------------------- dialog helpers */

function visibleDialog(page: Page): Locator {
  return page.locator(".el-overlay:not([style*='display: none']) .el-dialog").last();
}

async function closeOverlays(page: Page): Promise<void> {
  if (await dismissSessionExpiredModal(page, log)) {
    await loginToPanel(page);
    return;
  }
  for (let i = 0; i < 5; i++) {
    const dlg = visibleDialog(page);
    if (!(await dlg.isVisible().catch(() => false))) break;
    const cancel = dlg.locator("button").filter({ hasText: /^\s*(cancel|close)\s*$/i }).last();
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click().catch(() => {});
    } else {
      const x = dlg.locator(".el-dialog__headerbtn").last();
      if (await x.isVisible().catch(() => false)) await x.click({ force: true }).catch(() => {});
      else await page.keyboard.press("Escape").catch(() => {});
    }
    await page.waitForTimeout(500);
  }
}

async function typeInto(input: Locator, value: string): Promise<void> {
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 25 });
}

async function clickDialogButton(dlg: Locator, pattern: RegExp): Promise<void> {
  const footer = dlg.locator(".el-dialog__footer button, button").filter({ hasText: pattern }).last();
  await footer.waitFor({ state: "visible", timeout: 8000 });
  await footer.click();
}

/* ----------------------------------------------------------- user listing */

async function gotoUserList(page: Page): Promise<void> {
  await closeOverlays(page);
  if (!/userManagement/i.test(page.url())) {
    await page
      .goto(USER_MGMT_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
  }
}

/** The main list table (the one with the "Register date" column). */
function listTable(page: Page): Locator {
  return page.locator(".el-table").filter({ hasText: "Register date" }).first();
}

async function searchAccount(page: Page, account: string): Promise<void> {
  await gotoUserList(page);
  const search = page.getByPlaceholder(/search content|please enter/i).first();
  await search.waitFor({ state: "visible", timeout: 15000 });
  await search.click();
  await search.fill("");
  await search.fill(account);

  const btn = page.getByRole("button", { name: /^\s*search\s*$/i }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
  else await search.press("Enter");
  await page.waitForTimeout(1000);
}

/** Row in the main list whose Account cell exactly equals `account`. */
function accountRow(page: Page, account: string): Locator {
  return listTable(page)
    .locator(".el-table__body-wrapper tbody tr")
    .filter({ has: page.locator(`.cell:text-is("${account}")`) })
    .first();
}

async function findRow(page: Page, account: string): Promise<Locator> {
  await searchAccount(page, account);
  const row = accountRow(page, account);
  if (!(await row.isVisible().catch(() => false))) {
    await screenshot(page, "user-not-found");
    throw new Error(`Account "${account}" not found in panel`);
  }
  return row;
}

/** Does an account name already exist? (exact match, non-throwing) */
async function accountExists(page: Page, account: string): Promise<boolean> {
  await searchAccount(page, account);
  return accountRow(page, account)
    .isVisible()
    .catch(() => false);
}

/* -------------------------------------------------------- balance reading */

async function balanceColumnIndex(page: Page): Promise<number> {
  const headers = await listTable(page)
    .locator(".el-table__header th")
    .allInnerTexts()
    .catch(() => [] as string[]);
  const idx = headers.findIndex((h) => /balance/i.test(h) && !/bonus/i.test(h));
  return idx >= 0 ? idx : 4; // observed: Balance is column 4
}

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export async function readBalance(page: Page, account: string): Promise<number> {
  const row = await findRow(page, account);
  const idx = await balanceColumnIndex(page);
  const cell = row.locator("td").nth(idx);
  const text = (await cell.innerText().catch(() => "")).trim();
  const value = parseAmount(text);
  if (value === null) {
    await screenshot(page, "balance-parse-failed");
    throw new Error(`Could not read balance for "${account}" (raw: "${text}")`);
  }
  log("balance", `${account} = ${value}`);
  return value;
}

/* ------------------------------------------------ editor → action buttons */

async function openEditor(page: Page, account: string): Promise<void> {
  const row = await findRow(page, account);
  await row.getByText(/^editor$/i).first().click();
  await page.waitForTimeout(1000);
}

async function fillAmountDialog(page: Page, amount: number, kind: "recharge" | "redeem"): Promise<void> {
  const dlg = visibleDialog(page);
  await dlg.waitFor({ state: "visible", timeout: 10000 });
  const amountInput = dlg.locator('input[type="number"]').first();
  await typeInto(amountInput, String(amount));
  await page.waitForTimeout(300);
  await clickDialogButton(dlg, /^\s*confirm\s*$/i);
  await page.waitForTimeout(2000);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  log(kind, `${kind} confirmed for $${amount}`);
}

/* --------------------------------------------------------------- recharge */

export async function rechargeAccount(page: Page, account: string, amount: number): Promise<void> {
  await openEditor(page, account);
  const btn = page.getByRole("button", { name: /^\s*recharge\s*$/i }).first();
  await btn.waitFor({ state: "visible", timeout: 8000 });
  await btn.click();
  await page.waitForTimeout(800);
  await fillAmountDialog(page, amount, "recharge");
}

/* ----------------------------------------------------------------- redeem */

export async function redeemAccount(
  page: Page,
  account: string,
  amount: number,
  redeemAll: boolean
): Promise<number> {
  let target = amount;
  if (redeemAll) {
    target = await readBalance(page, account);
    if (target <= 0) {
      log("redeem", `${account} has no balance to redeem`);
      return 0;
    }
  }

  await openEditor(page, account);
  const btn = page.getByRole("button", { name: /^\s*redeem\s*$/i }).first();
  await btn.waitFor({ state: "visible", timeout: 8000 });
  await btn.click();
  await page.waitForTimeout(800);
  await fillAmountDialog(page, target, "redeem");
  return target;
}

/* ------------------------------------------------------- account creation */

async function readPanelMessages(page: Page): Promise<string> {
  const messages = await page
    .locator(".el-message, .el-form-item__error")
    .allInnerTexts()
    .catch(() => [] as string[]);
  return messages.join(" ").replace(/\s+/g, " ").trim();
}

/** Panel rejects taken names with messages like "login name have used". */
const DUPLICATE_RE = DUPLICATE_USERNAME_RE;

/** The create dialog stays open on error and closes on success. */
function createDialogOpen(page: Page): Promise<boolean> {
  return page
    .locator(".el-overlay:not([style*='display: none']) .el-dialog")
    .filter({ hasText: /Essential information/i })
    .last()
    .isVisible()
    .catch(() => false);
}

type CreateOutcome =
  | { status: "created" }
  | { status: "duplicate" }
  | { status: "error"; message: string };

async function tryCreateOnce(page: Page, username: string, password: string): Promise<CreateOutcome> {
  await gotoUserList(page);
  await page.getByRole("button", { name: /new account/i }).first().click();
  await page.waitForTimeout(1000);

  const dlg = visibleDialog(page);
  await dlg.waitFor({ state: "visible", timeout: 10000 });

  const textInputs = dlg.locator('input.el-input__inner:not([type="password"])');
  const passInputs = dlg.locator('input[type="password"]');

  await typeInto(textInputs.nth(0), username); // Account (Nickname defaults to account; leave blank)
  await typeInto(passInputs.nth(0), password); // Login password
  await typeInto(passInputs.nth(1), password); // Confirm password

  await clickDialogButton(dlg, /^\s*save\s*$/i);
  await page.waitForTimeout(1500);

  // Read any toast/validation message BEFORE it disappears.
  const messages = await readPanelMessages(page);

  // Success signal: the "Essential information" dialog closes only on success.
  let stillOpen = await createDialogOpen(page);
  if (stillOpen && !DUPLICATE_RE.test(messages)) {
    await page.waitForTimeout(1200); // give a slow success a moment to close
    stillOpen = await createDialogOpen(page);
  }

  if (!stillOpen) {
    await closeOverlays(page); // dismiss any post-create confirmation popup
    return { status: "created" };
  }

  // Dialog still open → not created.
  await closeOverlays(page);
  if (DUPLICATE_RE.test(messages)) {
    log("create", `username ${username} already exists (${messages})`);
    return { status: "duplicate" };
  }
  return { status: "error", message: messages || "create dialog stayed open (unknown panel error)" };
}

export async function createAccount(
  page: Page,
  baseUsername: string,
  password: string,
  variant: (base: string, attempt: number) => string,
  options?: { forceNewAccount?: boolean }
): Promise<{ username: string; password: string }> {
  const forceNewAccount = Boolean(options?.forceNewAccount);

  for (let attempt = 0; attempt < CREATE_ACCOUNT_MAX_ATTEMPTS; attempt++) {
    const username = variant(baseUsername, attempt);

    if (await accountExists(page, username)) {
      if (forceNewAccount) {
        log("create", `"${username}" already exists — trying next number`);
        continue;
      }
      log("create", `"${username}" already exists — trying next variant`);
      continue;
    }

    const outcome = await tryCreateOnce(page, username, username);
    if (outcome.status === "created") {
      log("create", `created ${username}`);
      return { username, password: username };
    }
    if (outcome.status === "duplicate") {
      continue;
    }

    // Panel sometimes leaves the dialog open after a duplicate — try the next number.
    if (await accountExists(page, username)) {
      log("create", `"${username}" still on panel after failed submit — trying next number`);
      continue;
    }

    // A real error (e.g. validation) — stop so we don't create junk accounts.
    await screenshot(page, "create-error");
    throw new Error(`Account creation failed: ${outcome.message}`);
  }

  await screenshot(page, "create-exhausted");
  throw new Error(`Could not create a unique account from base "${baseUsername}"`);
}
