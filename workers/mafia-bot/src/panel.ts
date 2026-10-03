import type { Frame, Locator, Page } from "playwright";
import { normalizeUsername, passwordForAccount } from "./credentials.js";
import { CREATE_ACCOUNT_MAX_ATTEMPTS, DUPLICATE_USERNAME_RE } from "../../shared/panel-create.js";
import { isCaptchaSolverConfigured } from "../../shared/panel-login-captcha.js";
import { isLoginPage, log, parseMoney, screenshot, waitForManualLogin } from "./panel-utils.js";

/**
 * Mafia layui admin (agentserver.mafia77777.com/admin).
 * Like the manual workflow: stay on /admin, open Game User → User Management,
 * then operate inside the player/index iframe (Add user / Search / Recharge / Withdraw).
 */
const ADMIN_URL =
  process.env.MAFIA_ADMIN_URL?.trim() || "https://agentserver.mafia77777.com/admin/login";
const BASE_URL = ADMIN_URL.replace(/\/login.*$/i, ""); // .../admin
const ADMIN_HOME = `${BASE_URL}`;
const PLAYER_URL = `${BASE_URL}/player/index`;

/** The player list table lives here — iframe on /admin, or the main tab if opened directly. */
type ListScope = Page | Frame;

function rootPage(scope: ListScope): Page {
  const maybeFrame = scope as Frame;
  if (typeof maybeFrame.page === "function") {
    return maybeFrame.page();
  }
  return scope as Page;
}

function playerListFrame(page: Page): Frame | undefined {
  return page.frames().find((f) => /\/player\/index/i.test(f.url()));
}

function isAdminDashboard(url: string): boolean {
  return (
    /mafia77777\.com\/admin\/?$/i.test(url) ||
    (url.includes("mafia77777.com/admin") && !url.includes("/player/") && !url.includes("/login"))
  );
}

/* ------------------------------------------------------------------ login */

export async function loginToPanel(page: Page): Promise<void> {
  await page.goto(ADMIN_HOME, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  if (!(await isLoginPage(page))) {
    await getListScope(page);
    log("login", "already authenticated");
    return;
  }

  const username = process.env.MAFIA_AGENT_USERNAME?.trim();
  const password = process.env.MAFIA_AGENT_PASSWORD?.trim();
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
    process.env.MAFIA_HEADLESS === "false" || Boolean(process.env.MAFIA_CDP_URL);
  if (interactive || isCaptchaSolverConfigured()) {
    await waitForManualLogin(page);
    await getListScope(page);
    log("login", "success");
    return;
  }

  await screenshot(page, "login-captcha");
  throw new Error(
    "Mafia login needs an image CAPTCHA. Run start-chrome-for-bot.bat, log in by hand, " +
      "then set MAFIA_CDP_URL=http://127.0.0.1:9228 and start the bot."
  );
}

/* ----------------------------------------------------------- list helpers */

async function assertPageOpen(page: Page): Promise<void> {
  if (page.isClosed()) {
    throw new Error(
      "Mafia Chrome tab was closed. Keep /admin open in bot Chrome (port 9228) and do not close that window."
    );
  }
}

async function ensureAdminDashboard(page: Page): Promise<void> {
  await assertPageOpen(page);
  if (!isAdminDashboard(page.url()) && !/player\/index/i.test(page.url())) {
    log("nav", `opening admin (${page.url()})`);
    await page.goto(ADMIN_HOME, { waitUntil: "domcontentloaded", timeout: 30000 });
  }
  await page.waitForTimeout(800);
}

/** Click Game User → User Management so the player list iframe loads on /admin. */
async function openUserManagementMenu(page: Page): Promise<void> {
  await ensureAdminDashboard(page);

  const gameUser = page.getByText(/Game User|Player|Member|用户|会员/i).first();
  if (await gameUser.isVisible().catch(() => false)) {
    await gameUser.click().catch(() => {});
    await page.waitForTimeout(900);
  }

  const um = page.getByText(/User Management|User List|Player List|会员/i).first();
  if (await um.isVisible().catch(() => false)) {
    await um.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
}

/**
 * Return the scope where Search / Add user / the table live.
 * Prefers the iframe on /admin; falls back to a standalone /player/index tab.
 */
async function getListScope(page: Page): Promise<ListScope> {
  await assertPageOpen(page);

  if (/player\/index/i.test(page.url())) {
    await page.locator('input[name="account"], input[name="username"]').first().waitFor({ state: "visible", timeout: 20000 });
    log("nav", "using standalone player list tab");
    return page;
  }

  await ensureAdminDashboard(page);

  let frame = playerListFrame(page);
  if (!frame) {
    log("nav", "opening User Management on /admin");
    await openUserManagementMenu(page);
    frame = playerListFrame(page);
  }

  if (frame) {
    await findSearchInput(frame).then((el) => el.waitFor({ state: "visible", timeout: 20000 })).catch(() => {});
    log("nav", "using User Management iframe on /admin");
    return frame;
  }

  log("nav", "using page root on /admin");
  return page;
}

function mainRows(scope: ListScope): Locator {
  return scope.locator(".layui-table-main tbody tr");
}

const USERNAME_CELL =
  'td[data-field="Account"] .layui-table-cell, td[data-field="Account"], td[data-field="Username"] .layui-table-cell, td[data-field="Username"]';

const BALANCE_CELL =
  'td[data-field="score"] .layui-table-cell, td[data-field="score"], td[data-field="balance"] .layui-table-cell, td[data-field="balance"], td[data-field="Balance"] .layui-table-cell, td[data-field="Balance"]';

function pageRoots(page: Page): Array<Page | Frame> {
  return [page, ...page.frames()];
}

function rowsWithAccount(scope: ListScope): Locator {
  return scope
    .locator("table tbody tr")
    .filter({ has: scope.locator('td[data-field="Account"], td[data-field="Username"]') });
}

async function accountVisibleInTable(scope: ListScope, username: string): Promise<boolean> {
  const target = username.toLowerCase();
  const cells = await scope.locator(USERNAME_CELL).allInnerTexts().catch(() => [] as string[]);
  return cells.some((c) => c.trim().toLowerCase() === target);
}

async function findSearchInput(scope: ListScope): Promise<Locator> {
  for (const sel of [
    'input[name="account"]',
    'input[name="username"]',
    'input[placeholder*="Username" i]',
  ]) {
    const loc = scope.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return loc;
  }
  throw new Error("User search input not found in User Management");
}

async function searchAccount(page: Page, account: string): Promise<ListScope> {
  await assertPageOpen(page);
  await dismissAllLayers(page);
  const scope = await getListScope(page);

  const reset = scope.locator(".layui-btn, button").filter({ hasText: /^\s*Reset\s*$/i }).first();
  if (await reset.isVisible().catch(() => false)) {
    await reset.click().catch(() => {});
    await rootPage(scope).waitForTimeout(600);
  }

  const search = await findSearchInput(scope);
  await search.click();
  await search.fill("");
  await search.fill(account);
  const btn = scope.locator(".layui-btn, button").filter({ hasText: /^\s*Search\s*$/i }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
  else await search.press("Enter");

  await rootPage(scope).waitForTimeout(400);
  await scope
    .locator(".layui-table-loading, .layui-table-init, .layui-icon-loading")
    .first()
    .waitFor({ state: "hidden", timeout: 12000 })
    .catch(() => {});
  await rootPage(scope).waitForTimeout(600);
  return scope;
}

async function findRowIndex(scope: ListScope, account: string, timeout = 12000): Promise<number> {
  const target = account.toLowerCase();
  const pg = rootPage(scope);
  const deadline = Date.now() + timeout;
  for (;;) {
    const rows = (await mainRows(scope).count()) > 0 ? mainRows(scope) : rowsWithAccount(scope);
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const cell = (await rows
        .nth(i)
        .locator(USERNAME_CELL)
        .first()
        .innerText()
        .catch(() => ""))
        .trim();
      if (cell.toLowerCase() === target) return i;
    }
    if (Date.now() > deadline) return -1;
    await pg.waitForTimeout(500);
  }
}

async function accountExists(page: Page, account: string): Promise<boolean> {
  const scope = await searchAccount(page, account);
  return (await findRowIndex(scope, account)) >= 0;
}

/* -------------------------------------------------------- balance reading */

export async function readBalance(page: Page, account: string): Promise<number> {
  const scope = await searchAccount(page, account);
  const idx = await findRowIndex(scope, account);
  if (idx < 0) {
    await screenshot(page, "user-not-found");
    throw new Error(`Account "${account}" not found in panel`);
  }
  const rows = (await mainRows(scope).count()) > 0 ? mainRows(scope) : rowsWithAccount(scope);
  const text = (await rows
    .nth(idx)
    .locator(BALANCE_CELL)
    .first()
    .innerText()
    .catch(() => ""))
    .trim();
  const value = parseMoney(text);
  if (value === null) {
    await screenshot(page, "balance-parse-failed");
    throw new Error(`Could not read balance for "${account}" (raw: "${text}")`);
  }
  log("balance", `${account} = ${value}`);
  return value;
}

/* ---------------------------------------------------------- dialog helpers */

async function waitForDialogFrame(page: Page, kind: string, timeout = 12000): Promise<Frame> {
  const deadline = Date.now() + timeout;
  const re = new RegExp(`/player/${kind}`, "i");
  while (Date.now() < deadline) {
    const frame = page.frames().find((f) => re.test(f.url()));
    if (frame) {
      await frame.locator("input, .layui-btn").first().waitFor({ state: "visible", timeout: 6000 }).catch(() => {});
      return frame;
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`${kind} dialog did not open`);
}

async function layerShadeVisible(page: Page): Promise<boolean> {
  return page.locator(".layui-layer-shade").first().isVisible().catch(() => false);
}

/** After create, layui shows ACCOUNT/PASSWORD summary — must click Close (not just X). */
async function readCredentialSummary(page: Page): Promise<{ username: string; password: string } | null> {
  for (const root of pageRoots(page)) {
    const layers = root.locator(".layui-layer");
    const count = await layers.count();
    for (let i = count - 1; i >= 0; i--) {
      const layer = layers.nth(i);
      if (!(await layer.isVisible().catch(() => false))) continue;
      const text = (await layer.innerText().catch(() => "")).replace(/\s+/g, " ");
      if (!/(ACCOUNT|USERNAME|Login\s*name)/i.test(text) || !/PASSWORD/i.test(text)) continue;
      const username =
        text.match(/(?:ACCOUNT|USERNAME|Login\s*name)\s*:\s*(\S+)/i)?.[1]?.toLowerCase() ?? "";
      const password = text.match(/PASSWORD\s*:\s*(\S+)/i)?.[1]?.toLowerCase() ?? "";
      if (username && password) return { username, password };
    }
  }
  return null;
}

async function dismissCredentialSuccessDialog(page: Page): Promise<boolean> {
  for (const root of pageRoots(page)) {
    const layer = root.locator(".layui-layer").filter({ hasText: /ACCOUNT|USERNAME|PASSWORD/i }).last();
    if (!(await layer.isVisible().catch(() => false))) continue;

    const closeBtn = layer
      .locator("a, button, .layui-btn, span")
      .filter({ hasText: /^Close$/i })
      .last();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.scrollIntoViewIfNeeded().catch(() => {});
      await closeBtn.click({ force: true });
      log("panel", "clicked Close on credential summary dialog");
      await page.waitForTimeout(700);
      return true;
    }
  }

  const fallback = page.getByRole("button", { name: /^Close$/i }).last();
  if (await fallback.isVisible().catch(() => false)) {
    await fallback.click({ force: true });
    log("panel", "clicked Close button");
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

async function waitForCredentialSummary(
  page: Page,
  username: string,
  timeoutMs = 12000
): Promise<{ username: string; password: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const summary = await readCredentialSummary(page);
    if (summary) return summary;
    await page.waitForTimeout(350);
  }
  return null;
}

/** Close any open layui popup (Add user / Recharge / credential summary / etc.). */
async function dismissAllLayers(page: Page): Promise<void> {
  await assertPageOpen(page);
  for (let i = 0; i < 10; i++) {
    await dismissCredentialSuccessDialog(page);
    if (!(await layerShadeVisible(page))) break;
    const closeBtn = page
      .locator(".layui-layer:visible .layui-btn, .layui-layer:visible button")
      .filter({ hasText: /^\s*Close\s*$/i })
      .last();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }
    await page.locator(".layui-layer-close").last().click({ force: true }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.locator(".layui-layer-shade").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
}

async function waitForLayerClosed(page: Page, kind?: string, timeout = 20000): Promise<void> {
  const re = kind ? new RegExp(`/player/${kind}`, "i") : null;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const shade = await layerShadeVisible(page);
    const dialogOpen = re ? page.frames().some((f) => re.test(f.url())) : false;
    if (!shade && !dialogOpen) return;
    await page.waitForTimeout(400);
  }
}

async function waitForAccountListed(page: Page, username: string, timeoutMs = 22000): Promise<boolean> {
  await assertPageOpen(page);
  await dismissAllLayers(page);
  await page.waitForTimeout(800);

  const scope = await searchAccount(page, username);
  if ((await findRowIndex(scope, username, timeoutMs)) >= 0) return true;

  const reset = scope.locator(".layui-btn, button").filter({ hasText: /^\s*Reset\s*$/i }).first();
  if (await reset.isVisible().catch(() => false)) {
    await reset.click().catch(() => {});
    await page.waitForTimeout(1200);
    await scope.locator(".layui-table-loading, .layui-table-init, .layui-icon-loading").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    if (await accountVisibleInTable(scope, username)) return true;
  }

  return false;
}

async function readPanelMessages(page: Page, frame?: Frame): Promise<string> {
  const parts: string[] = [];
  if (frame) {
    parts.push(
      ...(await frame
        .locator(".layui-layer-content, .layui-form-danger, .layui-form-mid")
        .allInnerTexts()
        .catch(() => [] as string[]))
    );
  }
  parts.push(
    ...(await page
      .locator(".layui-layer-msg .layui-layer-content, .layui-layer-dialog .layui-layer-content")
      .allInnerTexts()
      .catch(() => [] as string[]))
  );
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function typeInto(input: Locator, value: string): Promise<void> {
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.click({ clickCount: 3 });
  await input.fill("");
  // layui tracks values via native setter + input events — fill() alone often fails validation.
  await input.evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, val);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: val }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await input.blur();
  await input.page().waitForTimeout(120);
}

/** Click Submit once and wait for the insert/recharge/withdraw POST to finish. */
async function submitFormAndWait(page: Page, frame: Frame, action: string): Promise<string> {
  const responsePromise = page
    .waitForResponse(
      (r) => new RegExp(`/player/${action}`, "i").test(r.url()) && r.request().method() !== "GET",
      { timeout: 25000 }
    )
    .catch(() => null);

  const submit = frame
    .locator("button[lay-submit], button.layui-btn[lay-submit], .layui-btn")
    .filter({ hasText: /^\s*Submit\s*$/i })
    .first();
  await submit.waitFor({ state: "visible", timeout: 8000 });
  await submit.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await submit.click();

  log("submit", `clicked Submit (${action})`);

  const resp = await responsePromise;
  if (resp) {
    const body = (await resp.text().catch(() => "")).trim();
    log("submit", `HTTP ${resp.status()} ${body.slice(0, 280)}`);
    return body;
  }
  await page.waitForTimeout(2000);
  return "";
}

function insertResponseOk(body: string): boolean {
  if (!body) return false;
  try {
    const j = JSON.parse(body) as { code?: number; status?: number; msg?: string; message?: string };
    if (j.code === 0 || j.status === 0 || j.status === 1) return true;
    if (typeof j.code === "number" && j.code > 0) return false;
  } catch {
    /* not JSON */
  }
  return /success|成功|ok|created|added/i.test(body) && !/fail|error|exist|already/i.test(body);
}

async function insertFrameOpen(page: Page): Promise<Frame | undefined> {
  return page.frames().find((f) => /\/player\/insert/i.test(f.url()));
}

async function clickRowAction(page: Page, account: string, label: RegExp): Promise<void> {
  const scope = await searchAccount(page, account);
  const idx = await findRowIndex(scope, account);
  if (idx < 0) {
    await screenshot(page, "user-not-found");
    throw new Error(`Account "${account}" not found in panel`);
  }
  const fixedR = scope.locator(".layui-table-fixed-r tbody tr");
  const rowScope =
    (await fixedR.count()) > idx
      ? fixedR.nth(idx)
      : (await mainRows(scope).count()) > 0
        ? mainRows(scope).nth(idx)
        : rowsWithAccount(scope).nth(idx);
  const btn = rowScope.locator("a, .layui-btn, button").filter({ hasText: label }).first();
  await btn.waitFor({ state: "visible", timeout: 8000 });
  await btn.click({ force: true });
  await page.waitForTimeout(800);
}

async function submitDialog(page: Page, frame: Frame, action: "recharge" | "withdraw"): Promise<void> {
  await submitFormAndWait(page, frame, action);
}

/* --------------------------------------------------------------- recharge */

export async function rechargeAccount(page: Page, account: string, amount: number): Promise<void> {
  await clickRowAction(page, account, /^\s*Recharge\s*$/i);
  const frame = await waitForDialogFrame(page, "recharge");
  await typeInto(frame.locator('input[name="balance"]').first(), String(amount));
  await page.waitForTimeout(300);
  await submitDialog(page, frame, "recharge");
  await dismissAllLayers(page);
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

  await clickRowAction(page, account, /^\s*Withdraw\s*$/i);
  const frame = await waitForDialogFrame(page, "withdraw");
  await typeInto(frame.locator('input[name="balance"]').first(), String(target));
  await page.waitForTimeout(300);
  await submitDialog(page, frame, "withdraw");
  await page.waitForTimeout(2000);
  log("redeem", `withdrew $${target} from ${account}`);
  await dismissAllLayers(page);
  return target;
}

/* ------------------------------------------------------- account creation */

/** Initial balance on the Add user form ($0 is accepted by the panel). */
const CREATE_INITIAL_BALANCE = "0";

const DUPLICATE_RE = DUPLICATE_USERNAME_RE;
const VALIDATION_RE =
  /required|cannot be blank|format|length|invalid|incorrect|6\s*to\s*13|6-13|至少|不能为空|格式|character/i;
const SUCCESS_RE = /success|成功|added|complete|created/i;

type CreateOutcome =
  | { status: "created"; password?: string }
  | { status: "duplicate" }
  | { status: "error"; message: string };

async function verifyInsertFields(frame: Frame, username: string, password: string): Promise<void> {
  const u = await frame.locator('input[name="username"]').first().inputValue();
  const m = await frame.locator('input[name="money"]').first().inputValue();
  const p = await frame.locator('input[name="password"]').first().inputValue();
  if (u !== username || m !== CREATE_INITIAL_BALANCE || p !== password) {
    log("create", `field mismatch before submit (u=${u}, m=${m}, p=${p ? "set" : "empty"}) — refilling`);
    await typeInto(frame.locator('input[name="username"]').first(), username);
    await typeInto(frame.locator('input[name="nickname"]').first(), username).catch(() => {});
    await typeInto(frame.locator('input[name="money"]').first(), CREATE_INITIAL_BALANCE);
    await typeInto(frame.locator('input[name="password"]').first(), password);
    await typeInto(frame.locator('input[name="password_confirmation"]').first(), password);
  }
}

async function tryCreateOnce(page: Page, username: string, password: string): Promise<CreateOutcome> {
  await dismissAllLayers(page);
  const scope = await getListScope(page);

  await scope
    .locator(".layui-btn, button")
    .filter({ hasText: /^\s*Add user\s*$/i })
    .first()
    .click();

  const frame = await waitForDialogFrame(page, "insert");
  await typeInto(frame.locator('input[name="username"]').first(), username);
  await typeInto(frame.locator('input[name="nickname"]').first(), username).catch(() => {});
  await typeInto(frame.locator('input[name="money"]').first(), CREATE_INITIAL_BALANCE);
  await typeInto(frame.locator('input[name="password"]').first(), password);
  await typeInto(frame.locator('input[name="password_confirmation"]').first(), password);

  await page.waitForTimeout(400);
  await verifyInsertFields(frame, username, password);
  log(
    "create",
    `submitting ${username} (pw len ${password.length}, has letter+digit ${/[a-z]/.test(password) && /[0-9]/.test(password)})`
  );

  const body = await submitFormAndWait(page, frame, "insert");
  await page.waitForTimeout(800);

  const summary = await waitForCredentialSummary(page, username);
  if (summary) {
    log("create", `panel showed credentials for ${summary.username}`);
    await dismissCredentialSuccessDialog(page);
    await dismissAllLayers(page);
    if (summary.username === username.toLowerCase()) {
      return { status: "created", password: summary.password };
    }
  }

  await dismissCredentialSuccessDialog(page);
  await dismissAllLayers(page);

  const stillOpen = await insertFrameOpen(page);
  const msgFrame = stillOpen ?? frame;
  const msg = [body, await readPanelMessages(page, msgFrame)].filter(Boolean).join(" ");

  if (insertResponseOk(body) || SUCCESS_RE.test(msg)) {
    log("create", `insert succeeded for ${username} — completing job`);
    await dismissAllLayers(page);
    return { status: "created" };
  }

  if (stillOpen) {
    const emptyUser = !(await stillOpen.locator('input[name="username"]').first().inputValue()).trim();
    if (emptyUser && !insertResponseOk(body)) {
      log("create", `insert dialog still open with empty form — ${msg || "validation failed"}`);
      await dismissAllLayers(page);
      if (DUPLICATE_RE.test(msg)) return { status: "duplicate" };
      return { status: "error", message: msg || "Add user form rejected — fields cleared after submit" };
    }
  }

  await waitForLayerClosed(page, "insert", 20000).catch(() => {});
  await dismissAllLayers(page);

  if (await waitForAccountListed(page, username, 12000)) return { status: "created" };

  await dismissAllLayers(page);

  if (msg && VALIDATION_RE.test(msg) && !DUPLICATE_RE.test(msg)) {
    return { status: "error", message: msg };
  }
  if (DUPLICATE_RE.test(msg)) {
    log("create", `username ${username} rejected by panel (${msg})`);
    return { status: "duplicate" };
  }

  if (await waitForAccountListed(page, username, 8000)) return { status: "created" };

  log("create", `username ${username} not visible after submit — ${msg || "no panel message"}`);
  return { status: "duplicate" };
}

export async function createAccount(
  page: Page,
  baseUsername: string,
  password: string,
  variant: (base: string, attempt: number) => string,
  options?: { forceNewAccount?: boolean }
): Promise<{ username: string; password: string }> {
  for (let attempt = 0; attempt < CREATE_ACCOUNT_MAX_ATTEMPTS; attempt++) {
    const username = normalizeUsername(variant(baseUsername, attempt));
    const pwd = passwordForAccount(username, password);

    if (await accountExists(page, username)) {
      log("create", `"${username}" already on panel — trying next number`);
      continue;
    }

    const outcome = await tryCreateOnce(page, username, pwd);
    if (outcome.status === "created") {
      log("create", `created ${username}`);
      return { username, password: outcome.password ?? pwd };
    }
    if (outcome.status === "duplicate") {
      if (await accountExists(page, username)) {
        log("create", `created ${username} (confirmed on retry)`);
        return { username, password: pwd };
      }
      continue;
    }

    await screenshot(page, "create-error");
    throw new Error(`Account creation failed: ${outcome.message}`);
  }

  await screenshot(page, "create-exhausted");
  throw new Error(`Could not create a unique account from base "${baseUsername}"`);
}
