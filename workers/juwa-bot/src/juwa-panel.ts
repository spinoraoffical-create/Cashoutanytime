import type { Locator, Page } from "playwright";
import { log, screenshot } from "./panel-utils.js";

function sidebar(page: Page) {
  return page.locator(
    '.sidebar, aside, nav, .left-menu, [class*="sidebar"], [class*="side-menu"], .el-menu, #menu, .menu'
  ).first();
}

async function clickSidebarText(page: Page, text: string): Promise<boolean> {
  const root = sidebar(page);
  const scopes = (await root.count()) > 0 ? [root, page] : [page];

  for (const scope of scopes) {
    const exact = scope.getByText(text, { exact: true });
    if ((await exact.count()) > 0) {
      for (let i = 0; i < (await exact.count()); i++) {
        const el = exact.nth(i);
        if (!(await el.isVisible().catch(() => false))) continue;
        const box = await el.boundingBox();
        if (box && box.x > 350) continue;
        await el.click({ timeout: 8000 });
        log("sidebar", text);
        await page.waitForTimeout(900);
        return true;
      }
    }
  }
  return false;
}

async function isOnUserManagement(page: Page): Promise<boolean> {
  if (page.url().includes("userManagement")) return true;
  const createBtn = page.locator("button.el-button--primary").filter({ hasText: /create/i }).first();
  if (await createBtn.isVisible().catch(() => false)) return true;
  return page.getByText("User Management", { exact: true }).isVisible().catch(() => false);
}

export async function goToUserManagement(page: Page) {
  if (await isOnUserManagement(page)) {
    log("sidebar", "already on User Management");
    return;
  }

  await page.goto("https://ht.juwa777.com/userManagement", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  }).catch(() => {});
  await page.waitForTimeout(1500);

  if (await isOnUserManagement(page)) return;

  await clickSidebarText(page, "Game User");
  await clickSidebarText(page, "User Management");
  await page.waitForTimeout(800);
}

function createDialog(page: Page) {
  return page.locator(".add-user-dialog .el-dialog, .el-dialog").filter({ hasText: /essential information/i }).last();
}

async function closeOpenDialogs(page: Page) {
  for (let i = 0; i < 5; i++) {
    const closeBtn = page.locator(".el-dialog__wrapper:not([style*='display: none']) .el-dialog__headerbtn").first();
    if (!(await closeBtn.isVisible().catch(() => false))) break;
    await closeBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

async function openCreateDialog(page: Page): Promise<Locator> {
  await page.goto("https://ht.juwa777.com/userManagement", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  }).catch(() => {});
  await page.waitForTimeout(2000);

  const existing = createDialog(page);
  if (await existing.isVisible().catch(() => false)) {
    log("action", "create dialog already open — filling it");
    return existing;
  }

  await closeOpenDialogs(page);
  await page.waitForTimeout(500);

  const createBtn = page.getByRole("button", { name: /create/i }).first();

  await createBtn.waitFor({ state: "visible", timeout: 20000 });
  await createBtn.scrollIntoViewIfNeeded();
  await createBtn.click({ timeout: 10000 });
  log("action", "+ create");
  await page.waitForTimeout(1000);

  const dialog = createDialog(page);
  await dialog.waitFor({ state: "visible", timeout: 15000 });
  return dialog;
}

async function typeInto(input: Locator, value: string) {
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 30 });
}

export async function fillCreateUserForm(page: Page, username: string, password: string) {
  const dialog = await openCreateDialog(page);
  const body = dialog.locator(".el-dialog__body");

  const textInputs = body.locator(
    'input.el-input__inner:not([readonly]):not([type="password"]), input:not([readonly]):not([type="password"]):not([type="hidden"])'
  );
  await typeInto(textInputs.nth(0), username);

  if ((await textInputs.count()) > 1) {
    await typeInto(textInputs.nth(1), "");
  }

  const passwordInputs = body.locator('input[type="password"]');
  await typeInto(passwordInputs.nth(0), password);
  await typeInto(passwordInputs.nth(1), password);

  await dialog.locator(".el-dialog__footer").getByRole("button", { name: /^Save$/i }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  log("create-user", `saved ${username}`);
}

async function clickSearch(page: Page) {
  const btn = page.getByRole("button", { name: /^search$/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(2000);
  }
}

function rechargeDialog(page: Page) {
  return page.locator(".el-dialog").filter({ hasText: /recharge/i }).last();
}

function redeemDialog(page: Page) {
  return page.locator(".el-dialog").filter({ hasText: /redeem/i }).last();
}

async function searchForUser(page: Page, username: string) {
  const search = page.getByPlaceholder(/search account|search content|please enter/i).first();
  await search.waitFor({ state: "visible", timeout: 10000 });
  await search.click();
  await search.fill("");
  await search.fill(username);
  await clickSearch(page);
  // give the table time to re-render the filtered result
  await page.waitForTimeout(1500);
}

async function findUserRow(page: Page, username: string) {
  await searchForUser(page, username);

  // Prefer the main (non-fixed) table body so cell indices line up with headers.
  const scoped = page
    .locator(".el-table__body-wrapper tbody tr")
    .filter({ hasText: username })
    .first();
  if (await scoped.isVisible().catch(() => false)) return scoped;

  const row = page.locator("tbody tr, .el-table__row").filter({ hasText: username }).first();
  if (!(await row.isVisible().catch(() => false))) {
    await screenshot(page, "user-not-found");
    throw new Error(`User "${username}" not found — create account first`);
  }
  return row;
}

/** Search the user table for an EXACT account-name match (non-throwing). */
export async function userExists(page: Page, username: string): Promise<boolean> {
  await goToUserManagement(page);
  await closeOpenDialogs(page);

  const search = page.getByPlaceholder(/search account|search content|please enter/i).first();
  if (!(await search.isVisible().catch(() => false))) return false;
  await search.click();
  await search.fill("");
  await search.fill(username);
  await clickSearch(page);

  const rows = page.locator("tbody tr, .el-table__row");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    if (!(await row.isVisible().catch(() => false))) continue;
    const text = await row.innerText().catch(() => "");
    // word-boundary match so "spinora" does not match "spinora2"
    const re = new RegExp(`(^|[^a-z0-9_])${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`, "i");
    if (re.test(text)) return true;
  }
  return false;
}

/** Strict: whole cell must be a money value (avoids grabbing IDs/phones/dates). */
function parseMoney(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  const match = cleaned.match(/^\$?\s*(\d+(?:\.\d{1,2})?)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Lenient: extract the first number from a cell (used once we know it's the balance column). */
function extractMoney(text: string): number | null {
  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

/** Find which column holds the balance by reading the table headers. */
async function getBalanceColumnIndex(page: Page): Promise<number> {
  const pattern = /score|balance|coin|credit|wallet|amount|余额|金币|分数|积分/i;
  const scopes = [
    ".el-table__header-wrapper .el-table__header th",
    ".el-table__header th",
    "thead th",
  ];
  for (const scope of scopes) {
    const ths = page.locator(scope);
    const count = await ths.count();
    if (count === 0) continue;
    for (let i = 0; i < count; i++) {
      const text = (await ths.nth(i).innerText().catch(() => "")).trim();
      if (pattern.test(text)) {
        log("balance-col", `"${text}" at index ${i}`);
        return i;
      }
    }
    return -1; // header found but no balance-like column
  }
  return -1;
}

/**
 * Read the user's score/balance from their table row. Prefers the column that
 * the header identifies as the balance; falls back to scanning money-like cells.
 */
async function readBalanceFromRow(
  page: Page,
  row: Locator,
  username: string,
  allowZero: boolean
): Promise<number> {
  const idx = await getBalanceColumnIndex(page);
  const tds = row.locator("td");
  const tdCount = await tds.count();

  if (idx >= 0 && idx < tdCount) {
    const text = (await tds.nth(idx).innerText().catch(() => "")).trim();
    const value = extractMoney(text);
    if (value !== null && (allowZero || value > 0)) {
      log("balance", `${username} = ${value} (column ${idx}, raw "${text}")`);
      return value;
    }
  }

  // Fallback: scan strict money cells in the row.
  const cells = row.locator("td, .cell");
  const count = await cells.count();
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const text = (await cells.nth(i).innerText()).trim();
    if (text.includes(username)) continue;
    const value = parseMoney(text);
    if (value !== null && (allowZero || value > 0)) values.push(value);
  }
  log("balance", `${username} fallback cells = [${values.join(", ")}]`);
  if (values.length > 0) return Math.max(...values);
  return allowZero ? 0 : Number.NaN;
}

export async function readUserGameBalance(page: Page, username: string): Promise<number> {
  await goToUserManagement(page);
  await closeOpenDialogs(page);
  const row = await findUserRow(page, username);
  const value = await readBalanceFromRow(page, row, username, false);
  if (!Number.isFinite(value)) {
    throw new Error(`Could not read balance for "${username}"`);
  }
  return value;
}

/**
 * Balance reader for the "Check Balance" button. Unlike readUserGameBalance
 * (used by redeem), a zero balance is a valid result and is returned as 0
 * rather than throwing. Still throws if the account row can't be found.
 */
export async function readUserGameBalanceForCheck(page: Page, username: string): Promise<number> {
  await goToUserManagement(page);
  await closeOpenDialogs(page);
  const row = await findUserRow(page, username);
  return readBalanceFromRow(page, row, username, true);
}

async function openRedeemDialog(page: Page, username: string) {
  const row = await findUserRow(page, username);
  await row.getByText("editor", { exact: true }).click();
  await page.waitForTimeout(400);

  await page.locator(".el-dropdown-menu, ul").getByText(/^Redeem$/i).last().click({ timeout: 5000 }).catch(async () => {
    await page.getByText(/^Redeem$/i).last().click();
  });
  log("action", `editor → Redeem for ${username}`);
  await page.waitForTimeout(800);

  const dialog = redeemDialog(page);
  return (await dialog.isVisible().catch(() => false)) ? dialog : page;
}

async function readBalanceFromRedeemDialog(root: Page | Locator): Promise<number | null> {
  const text = await root.innerText().catch(() => "");
  const match = text.match(/(?:balance|available|current)[:\s]*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  if (match) return Number(match[1]);

  const labels = root.locator("label, span, p").filter({ hasText: /balance/i });
  if ((await labels.count()) > 0) {
    const labelText = await labels.first().innerText();
    const value = parseMoney(labelText.replace(/balance/i, "").trim());
    if (value !== null) return value;
  }

  return null;
}

export async function redeemAccount(
  page: Page,
  username: string,
  amount: number | "all"
): Promise<number> {
  await goToUserManagement(page);
  await closeOpenDialogs(page);

  let redeemAmount = amount;
  if (amount === "all") {
    try {
      redeemAmount = await readUserGameBalance(page, username);
    } catch {
      const root = await openRedeemDialog(page, username);
      const fromDialog = await readBalanceFromRedeemDialog(root);
      if (fromDialog === null || fromDialog <= 0) {
        throw new Error(`No balance to redeem for "${username}"`);
      }
      redeemAmount = fromDialog;
    }
    if (redeemAmount <= 0) {
      throw new Error(`No balance to redeem for "${username}"`);
    }
  }

  const root = await openRedeemDialog(page, username);
  const amountInput = root.locator('input.el-input__inner:not([readonly]), input[type="number"]').last();
  await typeInto(amountInput, String(redeemAmount));

  await root.locator("button, .el-button").filter({ hasText: /^Submit$|^Redeem$|^Confirm$|^OK$|^Save$/i }).last().click();
  await page.waitForTimeout(2500);
  log("redeem", `${username} $${redeemAmount}`);
  return redeemAmount;
}

export async function rechargeAccount(page: Page, username: string, amount: number) {
  await goToUserManagement(page);
  await closeOpenDialogs(page);

  const row = await findUserRow(page, username);
  await row.getByText("editor", { exact: true }).click();
  await page.waitForTimeout(400);

  await page.locator(".el-dropdown-menu, ul").getByText(/^Recharge$/i).last().click({ timeout: 5000 }).catch(async () => {
    await page.getByText(/^Recharge$/i).last().click();
  });
  log("action", `editor → Recharge for ${username}`);
  await page.waitForTimeout(800);

  const dialog = rechargeDialog(page);
  const root = (await dialog.isVisible().catch(() => false)) ? dialog : page;

  const amountInput = root.locator('input.el-input__inner:not([readonly]), input[type="number"]').last();
  await typeInto(amountInput, String(amount));

  await root.locator("button, .el-button").filter({ hasText: /^Submit$|^Recharge$|^Confirm$|^OK$|^Save$/i }).last().click();
  await page.waitForTimeout(2500);
  log("recharge", `${username} $${amount}`);
}
