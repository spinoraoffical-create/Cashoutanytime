import type { Frame, Locator, Page } from "playwright";
import { normalizeUsername } from "./credentials.js";
import { CREATE_ACCOUNT_MAX_ATTEMPTS, DUPLICATE_USERNAME_RE } from "../../shared/panel-create.js";
import { isCaptchaSolverConfigured } from "../../shared/panel-login-captcha.js";
import { isLoginPage, log, screenshot, waitForManualLogin } from "./panel-utils.js";

const ADMIN_URL =
  process.env.CASHFRENZY_ADMIN_URL?.trim() || "https://agentserver.cashfrenzy777.com/admin/login";
const BASE_URL = ADMIN_URL.replace(/\/login.*$/i, "");
/** Same Backend UI as Game Vault — Cash Frenzy hosts user list under /admin/player/index */
const USER_MGMT_URL = `${BASE_URL}/player/index`;

/* ------------------------------------------------------------------ login */

export async function loginToPanel(page: Page): Promise<void> {
  await page.bringToFront().catch(() => {});

  if (await isLoginPage(page)) {
    const username = process.env.CASHFRENZY_AGENT_USERNAME?.trim();
    const password = process.env.CASHFRENZY_AGENT_PASSWORD?.trim();
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
      process.env.CASHFRENZY_HEADLESS === "false" || Boolean(process.env.CASHFRENZY_CDP_URL);
    if (interactive || isCaptchaSolverConfigured()) {
      await waitForManualLogin(page);
    } else {
      await screenshot(page, "login-captcha");
      throw new Error(
        "Cash Frenzy login needs CAPTCHA. Run start-chrome-for-bot.bat, log in, open User List, " +
          "then set CASHFRENZY_CDP_URL=http://127.0.0.1:9229 and start the bot."
      );
    }
  }

  await gotoUserList(page);
  log("login", `ready at ${page.url()}`);
}

/* ---------------------------------------------------------- dialog helpers */

/** Cash Frenzy create form loads in Layui iframe /admin/player/insert (not .el-dialog). */
function insertFrame(page: Page): Frame | null {
  return page.frames().find((f) => /\/player\/insert/i.test(f.url())) ?? null;
}

function actionFrame(page: Page, kind: "recharge" | "redeem"): Frame | null {
  const parts = kind === "redeem" ? ["withdraw", "redeem"] : ["recharge"];
  for (const part of parts) {
    const frame = page.frames().find((f) => new RegExp(`/player/${part}`, "i").test(f.url()));
    if (frame) return frame;
  }
  return null;
}

async function waitForActionFrame(page: Page, kind: "recharge" | "redeem"): Promise<Frame> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const frame = actionFrame(page, kind);
    if (frame && (await frame.locator("input").count()) > 0) return frame;
    await page.waitForTimeout(350);
  }
  const pathHint = kind === "redeem" ? "/admin/player/redeem or /withdraw" : `/admin/player/${kind}`;
  throw new Error(`${kind} iframe (${pathHint}) did not open`);
}

async function openActionIframe(page: Page, kind: "recharge" | "redeem"): Promise<void> {
  if (actionFrame(page, kind)) return;

  const layFilter = kind === "recharge" ? "recharge" : "redeem";
  const label = kind === "recharge" ? /^\s*recharge\s*$/i : /^\s*redeem\s*$/i;
  const btn = page
    .locator(`#${layFilter}, button[lay-filter="${layFilter}"]`)
    .first()
    .or(page.getByRole("button", { name: label }).first());
  await btn.waitFor({ state: "attached", timeout: 10000 });
  await btn.click({ force: true });
  await page.waitForTimeout(800);

  await waitForActionFrame(page, kind);
  log(kind, `opened layui iframe for ${kind}`);
}

function visibleDialog(page: Page): Locator {
  return page.locator(".el-overlay:not([style*='display: none']) .el-dialog").last();
}

/** Recharge/Redeem amount modal (not the account editor drawer). */
function amountDialog(page: Page, kind: "recharge" | "redeem"): Locator {
  const titleRe = kind === "recharge" ? /recharge/i : /redeem/i;
  const labeled = page
    .locator(".el-overlay:not([style*='display: none']) .el-dialog")
    .filter({ hasText: titleRe })
    .last();
  return labeled.or(visibleDialog(page));
}

async function typeIntoEl(input: Locator, value: string): Promise<void> {
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.scrollIntoViewIfNeeded().catch(() => {});
  await input.click({ clickCount: 3, force: true });
  await input.fill("");
  await input.pressSequentially(value, { delay: 30 });
  await input.blur();
  await input.page().waitForTimeout(200);
}

async function closeOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    for (const kind of ["recharge", "redeem"] as const) {
      const action = actionFrame(page, kind);
      if (action) {
        await action.getByRole("button", { name: /^\s*cancel\s*$/i }).click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }

    const insert = insertFrame(page);
    if (insert) {
      await insert.getByRole("button", { name: /^\s*cancel\s*$/i }).click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      if (!insertFrame(page)) continue;
    }

    const layuiClose = page.locator(".layui-layer-close, .layui-layer-setwin .layui-layer-close1").first();
    if ((await layuiClose.count()) > 0) {
      await layuiClose.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }

    const essential = page
      .locator(".el-dialog, [role='dialog']")
      .filter({ hasText: /Essential information/i })
      .last();
    if ((await essential.count()) > 0) {
      const cancel = essential.locator("button").filter({ hasText: /^\s*cancel\s*$/i }).first();
      if ((await cancel.count()) > 0) {
        await cancel.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        continue;
      }
    }

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
  await input.waitFor({ state: "attached", timeout: 10000 });
  await input.scrollIntoViewIfNeeded().catch(() => {});
  await input.click({ clickCount: 3, force: true });
  await input.fill("");
  // Layui tracks values via native setter + input events — fill() alone often fails validation.
  await input.evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, val);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: val }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await input.blur();
  await input.page().waitForTimeout(150);
}

function actionResponseOk(body: string): boolean {
  if (!body) return false;
  try {
    const j = JSON.parse(body) as { code?: number; status?: number; msg?: string; message?: string };
    if (j.code === 0 || j.status === 0 || j.status === 1) return true;
    if (typeof j.code === "number" && j.code > 0) return false;
  } catch {
    /* not JSON */
  }
  return /success|成功|ok|complete|recharge|redeem/i.test(body) && !/fail|error|insufficient|不足/i.test(body);
}

async function clickLayuiSubmitInFrame(frame: Frame, kind: "recharge" | "redeem"): Promise<string | null> {
  const filters = kind === "redeem" ? ["withdraw", "redeem"] : ["recharge"];
  for (const f of filters) {
    const btn = frame.locator(`button[lay-submit][lay-filter="${f}"]`).first();
    if ((await btn.count()) > 0) {
      const text = (await btn.innerText().catch(() => "")).trim();
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true });
      return `${f}:${text}`;
    }
  }
  const submit = frame
    .locator("button[lay-submit], .layui-btn[lay-submit], .layui-btn")
    .filter({ hasText: /^\s*(submit|confirm|save|ok)\s*$/i })
    .first();
  if ((await submit.count()) > 0) {
    const text = (await submit.innerText().catch(() => "")).trim();
    await submit.scrollIntoViewIfNeeded().catch(() => {});
    await submit.click({ force: true });
    return `lay-submit:${text}`;
  }
  return null;
}

async function submitActionForm(page: Page, frame: Frame, kind: "recharge" | "redeem"): Promise<string> {
  const pathParts = kind === "redeem" ? ["withdraw", "redeem"] : ["recharge"];
  const frameUrl = frame.url();
  const responseMatches = (url: string, method: string): boolean => {
    if (method === "GET") return false;
    if (pathParts.some((p) => new RegExp(`/player/${p}`, "i").test(url))) return true;
    if (frameUrl && url.startsWith(frameUrl.split("?")[0] ?? frameUrl)) return true;
    return /\/player\//i.test(url) && /redeem|withdraw|recharge/i.test(url);
  };

  const responsePromise = page
    .waitForResponse((r) => responseMatches(r.url(), r.request().method()), { timeout: 25000 })
    .catch(() => null);

  const clickedLabel = await clickLayuiSubmitInFrame(frame, kind);
  if (!clickedLabel) {
    await screenshot(page, `${kind}-submit-missing`);
    throw new Error(`${kind} Submit/Confirm button not found in iframe (${frame.url()})`);
  }
  log(kind, `clicked iframe button ${clickedLabel}`);

  const resp = await responsePromise;
  if (resp) {
    const body = (await resp.text().catch(() => "")).trim();
    log(kind, `HTTP ${resp.status()} ${resp.url()} ${body.slice(0, 280)}`);
    if (!actionResponseOk(body)) {
      throw new Error(`${kind} rejected: ${body.slice(0, 200) || `HTTP ${resp.status()}`}`);
    }
    return body;
  }

  const msg = await page
    .locator(".layui-layer-msg .layui-layer-content, .layui-layer-dialog .layui-layer-content")
    .last()
    .innerText()
    .catch(() => "");
  if (msg && /fail|error|insufficient|不足|invalid|cannot|exceed|required/i.test(msg)) {
    throw new Error(`${kind} failed: ${msg.trim()}`);
  }

  await screenshot(page, `${kind}-no-response`);
  throw new Error(
    `${kind} submit got no server response (iframe ${frame.url()})${msg ? `: ${msg.trim()}` : ""}`
  );
}

async function fillInsertForm(frame: Frame, username: string, password: string): Promise<void> {
  await frame.locator('input[name="username"]').waitFor({ state: "attached", timeout: 20000 });
  await typeInto(frame.locator('input[name="username"]'), username);
  await typeInto(frame.locator('input[name="password"]'), password);
  await typeInto(frame.locator('input[name="password_confirmation"]'), password);
}

async function clickSaveInInsertFrame(frame: Frame): Promise<void> {
  await frame.waitForFunction(
    () => Boolean(document.querySelector('button[lay-submit][lay-filter="add"]')),
    null,
    { timeout: 10000 }
  );
  await frame.evaluate(() => {
    const btn = document.querySelector('button[lay-submit][lay-filter="add"]') as HTMLButtonElement | null;
    btn?.click();
  });
}

async function waitUntilInsertFrameClosed(page: Page, timeoutMs = 20000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!insertFrame(page)) return true;
    await page.waitForTimeout(350);
  }
  return false;
}

async function accountVisibleInList(page: Page, account: string): Promise<boolean> {
  await searchAccount(page, account);
  const row = accountRow(page, account);
  if (await row.isVisible().catch(() => false)) return true;
  // Layui sometimes renders account in any tbody cell
  const hit = page.locator("tbody tr:not(#noData)").filter({ hasText: account }).first();
  return hit.isVisible().catch(() => false);
}

async function clickDialogButton(dlg: Locator, pattern: RegExp): Promise<void> {
  const footer = dlg.locator(".el-dialog__footer button, button").filter({ hasText: pattern }).last();
  await footer.waitFor({ state: "attached", timeout: 8000 });
  await footer.click({ force: true });
}

/* ----------------------------------------------------------- user listing */

function allRoots(page: Page): Array<Page | Frame> {
  return [page, ...page.frames()];
}

async function hasNewAccountButton(page: Page): Promise<boolean> {
  for (const root of allRoots(page)) {
    if ((await root.getByRole("button", { name: /new account/i }).count()) > 0) return true;
    if ((await root.locator(".el-button").filter({ hasText: /new account/i }).count()) > 0) return true;
  }
  return false;
}

async function clickSidebarUserList(page: Page): Promise<void> {
  for (const root of allRoots(page)) {
    const item = root.locator(".el-menu-item, a, li, span").filter({ hasText: /user list/i }).first();
    if ((await item.count()) > 0) {
      await item.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
      log("nav", "clicked User List in sidebar");
      return;
    }
  }
}

async function gotoUserList(page: Page): Promise<void> {
  await page.bringToFront().catch(() => {});
  await closeOverlays(page);

  if (!/\/player\/index/i.test(page.url())) {
    await page.goto(USER_MGMT_URL, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  if (!(await hasNewAccountButton(page))) {
    await clickSidebarUserList(page);
  }

  if (!(await hasNewAccountButton(page)) && !/\/player\/index/i.test(page.url())) {
    await page.goto(USER_MGMT_URL, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  if (!(await hasNewAccountButton(page))) {
    await screenshot(page, "user-list-missing");
    throw new Error(
      "User List not open. In bot Chrome go to User List (/admin/player/index) — same screen as Game Vault user management with New Account button."
    );
  }

  log("nav", `user list at ${page.url()}`);
}

function listTable(page: Page): Locator {
  return page
    .locator(".el-table")
    .filter({ hasText: /Register date|Account/i })
    .first()
    .or(page.locator(".layui-table, table").filter({ hasText: /Account|Register date/i }).first());
}

async function searchAccount(page: Page, account: string): Promise<void> {
  await gotoUserList(page);
  const search = page.locator('input[name="search_content"]').first().or(
    page.getByPlaceholder(/search content|please enter/i).first()
  );
  await search.waitFor({ state: "attached", timeout: 15000 });
  await search.click({ force: true }).catch(() => {});
  await search.fill("");
  await search.fill(account);

  const btn = page.getByRole("button", { name: /^\s*search\s*$/i }).first();
  if ((await btn.count()) > 0) await btn.click({ force: true });
  else await search.press("Enter");
  await page.waitForTimeout(2000);
}

function accountRow(page: Page, account: string): Locator {
  return listTable(page)
    .locator(".el-table__body-wrapper tbody tr")
    .filter({ has: page.locator(`.cell:text-is("${account}")`) })
    .first()
    .or(page.locator(".el-table__body-wrapper tbody tr").filter({ hasText: account }).first())
    .or(page.locator("tbody tr:not(#noData)").filter({ hasText: account }).first());
}

async function clickEditorForAccount(page: Page, account: string): Promise<void> {
  const row = await findRow(page, account);
  const editor = row
    .getByText(/^editor$/i)
    .first()
    .or(row.locator("a, button, .layui-btn, .el-button").filter({ hasText: /^editor$/i }).first());
  if ((await editor.count()) === 0) {
    await page.locator("a, button, .layui-btn, .el-button").filter({ hasText: /^editor$/i }).last().click();
  } else {
    await editor.click({ force: true });
  }
  await page.waitForTimeout(1200);
  log("nav", `opened editor for ${account}`);
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

async function accountExists(page: Page, account: string): Promise<boolean> {
  return accountVisibleInList(page, account);
}

/* -------------------------------------------------------- balance reading */

const BALANCE_CELL =
  'td[data-field="balance"] .layui-table-cell, td[data-field="balance"], td[data-field="Balance"] .layui-table-cell, td[data-field="Balance"], td[data-field="score"] .layui-table-cell, td[data-field="score"]';

async function balanceColumnIndex(page: Page): Promise<number> {
  const headers = await listTable(page)
    .locator(".el-table__header th, .layui-table-header th, thead th")
    .allInnerTexts()
    .catch(() => [] as string[]);
  const idx = headers.findIndex((h) => /balance/i.test(h) && !/bonus|available|your/i.test(h));
  return idx >= 0 ? idx : 4;
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
  const byField = row.locator(BALANCE_CELL).first();
  if ((await byField.count()) > 0) {
    const text = (await byField.innerText().catch(() => "")).trim();
    const value = parseAmount(text);
    if (value !== null) {
      log("balance", `${account} = ${value}`);
      return value;
    }
  }
  const idx = await balanceColumnIndex(page);
  const cell = row.locator("td .cell").nth(idx).or(row.locator("td").nth(idx));
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
  await clickEditorForAccount(page, account);
}

async function visibleAmountInput(frame: Frame, kind: "recharge" | "redeem"): Promise<Locator> {
  for (const name of ["balance", "money", "amount", "recharge_balance", "redeem_balance"]) {
    const byName = frame
      .locator(`input[name="${name}"]:not([type="hidden"]):not([readonly]):not([disabled])`)
      .first();
    if ((await byName.count()) > 0) return byName;
  }

  const labelRe = kind === "recharge" ? /recharge balance/i : /redeem balance/i;
  const byLabel = frame
    .locator(".layui-form-item")
    .filter({ hasText: labelRe })
    .locator('input:not([type="hidden"]):not([readonly])')
    .first();
  if ((await byLabel.count()) > 0) return byLabel;

  const byNumber = frame.locator('input[type="number"]:not([type="hidden"]):not([readonly])').first();
  if ((await byNumber.count()) > 0) return byNumber;

  return frame.locator('input:not([type="hidden"]):not([type="checkbox"]):not([readonly]):not([name*="available"])').last();
}

async function fillAmountDialog(page: Page, amount: number, kind: "recharge" | "redeem"): Promise<void> {
  const frame = actionFrame(page, kind) ?? (await waitForActionFrame(page, kind));
  log(kind, `iframe form at ${frame.url()}`);

  const amountInput = await visibleAmountInput(frame, kind);
  await typeInto(amountInput, String(amount));

  const filled = await amountInput.inputValue().catch(() => "");
  if (filled !== String(amount) && parseFloat(filled) !== amount) {
    await screenshot(page, `${kind}-amount-mismatch`);
    throw new Error(`${kind} amount not set in iframe (expected ${amount}, got "${filled}")`);
  }
  log(kind, `iframe amount set to ${filled}`);

  await submitActionForm(page, frame, kind);

  const closeDeadline = Date.now() + 15000;
  while (Date.now() < closeDeadline) {
    if (!actionFrame(page, kind)) break;
    await page.waitForTimeout(350);
  }

  log(kind, `${kind} confirmed for $${amount}`);
}

async function verifyBalanceDelta(
  page: Page,
  account: string,
  before: number,
  delta: number,
  kind: "recharge" | "redeem"
): Promise<void> {
  await closeOverlays(page);
  const expected = kind === "recharge" ? before + delta : before - delta;
  const deadline = Date.now() + 22000;

  while (Date.now() < deadline) {
    await gotoUserList(page);
    await searchAccount(page, account);
    await page.waitForTimeout(1200);
    const after = await readBalance(page, account);
    if (Math.abs(after - expected) <= 0.02) {
      log(kind, `verified balance ${before} → ${after}`);
      return;
    }
    await page.waitForTimeout(1500);
  }

  const after = await readBalance(page, account);
  await screenshot(page, `${kind}-balance-verify-failed`);
  throw new Error(
    `${kind} did not apply on server: balance ${before} → ${after}, expected ~${expected.toFixed(2)}`
  );
}

async function selectAccountRow(page: Page, account: string): Promise<void> {
  const row = await findRow(page, account);
  const editor = row
    .getByText(/^editor$/i)
    .first()
    .or(row.locator("a, button, .layui-btn, .el-button").filter({ hasText: /^editor$/i }).first());
  if ((await editor.count()) > 0) {
    await editor.click({ force: true });
    log("nav", `selected ${account} via editor`);
    await page.waitForTimeout(1000);
  }
}

/** Element Plus modal (Game Vault style) — Cash Frenzy uses this after Editor → Recharge/Redeem. */
async function amountInputInDialog(dlg: Locator, kind: "recharge" | "redeem"): Promise<Locator> {
  const labelRe =
    kind === "recharge" ? /recharge\s*balance|amount|money/i : /redeem\s*balance|withdraw|amount|money/i;
  const byLabel = dlg
    .locator(".el-form-item")
    .filter({ hasText: labelRe })
    .locator('input:not([readonly]):not([disabled]):not([type="hidden"])')
    .first();
  if ((await byLabel.count()) > 0) return byLabel;

  const editable = dlg.locator('input:not([readonly]):not([disabled]):not([type="hidden"])');
  const count = await editable.count();
  for (let i = 0; i < count; i++) {
    const input = editable.nth(i);
    const ro = await input.getAttribute("readonly").catch(() => null);
    if (!ro) return input;
  }

  return dlg.locator('input[type="number"]:not([readonly])').first().or(dlg.locator("input.el-input__inner").last());
}

async function submitAmountDialogEl(page: Page, dlg: Locator, kind: "recharge" | "redeem"): Promise<void> {
  const responsePromise = page
    .waitForResponse(
      (r) =>
        r.request().method() !== "GET" &&
        /recharge|redeem|withdraw|player|user/i.test(r.url()) &&
        (r.status() === 200 || r.status() === 201),
      { timeout: 25000 }
    )
    .catch(() => null);

  const confirm = dlg.locator(".el-dialog__footer button, button").filter({ hasText: /^\s*confirm\s*$/i }).last();
  await confirm.waitFor({ state: "attached", timeout: 8000 });
  await confirm.scrollIntoViewIfNeeded().catch(() => {});
  await confirm.click({ force: true });

  const resp = await responsePromise;
  if (resp) {
    const body = (await resp.text().catch(() => "")).trim();
    log(kind, `HTTP ${resp.status()} ${body.slice(0, 280)}`);
    if (!actionResponseOk(body)) {
      throw new Error(`${kind} rejected: ${body.slice(0, 200) || `HTTP ${resp.status()}`}`);
    }
  }

  const msg = await readPanelMessages(page);
  if (msg && /fail|error|insufficient|不足|invalid|cannot|exceed/i.test(msg)) {
    throw new Error(`${kind} failed: ${msg}`);
  }

  const closeDeadline = Date.now() + 15000;
  while (Date.now() < closeDeadline) {
    if (!(await dlg.isVisible().catch(() => false))) break;
    await page.waitForTimeout(350);
  }

  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

async function fillAmountDialogEl(page: Page, amount: number, kind: "recharge" | "redeem"): Promise<void> {
  const dlg = amountDialog(page, kind);
  await dlg.waitFor({ state: "visible", timeout: 10000 });
  const amountInput = await amountInputInDialog(dlg, kind);
  await typeIntoEl(amountInput, String(amount));

  const filled = await amountInput.inputValue().catch(() => "");
  const filledNum = parseFloat(filled);
  if (filled !== String(amount) && Math.abs(filledNum - amount) > 0.01) {
    await screenshot(page, `${kind}-amount-mismatch`);
    throw new Error(`${kind} amount not set (expected ${amount}, got "${filled}")`);
  }

  await submitAmountDialogEl(page, dlg, kind);
  await closeOverlays(page);
  log(kind, `${kind} el-dialog confirmed for $${amount}`);
}

async function openActionDialog(page: Page, kind: "recharge" | "redeem"): Promise<void> {
  if (actionFrame(page, kind)) {
    log(kind, `reuse open layui iframe for ${kind}`);
    return;
  }

  const layFilter = kind === "recharge" ? "recharge" : "redeem";
  const label = kind === "recharge" ? /^\s*recharge\s*$/i : /^\s*redeem\s*$/i;
  const btn = page
    .locator(`#${layFilter}, button[lay-filter="${layFilter}"]`)
    .first()
    .or(page.getByRole("button", { name: label }).first());
  await btn.waitFor({ state: "attached", timeout: 10000 });
  await btn.click({ force: true });
  await page.waitForTimeout(900);

  const dlg = amountDialog(page, kind);
  if (await dlg.isVisible().catch(() => false)) {
    log(kind, `opened ${kind} Element Plus dialog`);
    return;
  }

  await waitForActionFrame(page, kind);
  log(kind, `opened layui iframe for ${kind}`);
}

export async function rechargeAccount(page: Page, account: string, amount: number): Promise<void> {
  const before = await readBalance(page, account);
  await clickEditorForAccount(page, account);
  await openActionDialog(page, "recharge");

  if (await amountDialog(page, "recharge").isVisible().catch(() => false)) {
    await fillAmountDialogEl(page, amount, "recharge");
  } else if (actionFrame(page, "recharge")) {
    await fillAmountDialog(page, amount, "recharge");
  } else {
    await screenshot(page, "recharge-dialog-missing");
    throw new Error("recharge dialog/iframe did not open after clicking Recharge");
  }
  await verifyBalanceDelta(page, account, before, amount, "recharge");
}

export async function redeemAccount(
  page: Page,
  account: string,
  amount: number,
  redeemAll: boolean
): Promise<number> {
  const before = await readBalance(page, account);
  let target = amount;
  if (redeemAll) {
    target = before;
    if (target <= 0) {
      log("redeem", `${account} has no balance to redeem`);
      return 0;
    }
  } else if (target > before) {
    throw new Error(`Redeem amount $${target} exceeds balance $${before}`);
  }

  await clickEditorForAccount(page, account);
  await openActionDialog(page, "redeem");

  if (await amountDialog(page, "redeem").isVisible().catch(() => false)) {
    await fillAmountDialogEl(page, target, "redeem");
  } else if (actionFrame(page, "redeem")) {
    await fillAmountDialog(page, target, "redeem");
  } else {
    await screenshot(page, "redeem-dialog-missing");
    throw new Error("redeem dialog/iframe did not open after clicking Redeem");
  }
  await verifyBalanceDelta(page, account, before, target, "redeem");
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

const DUPLICATE_RE = DUPLICATE_USERNAME_RE;
const NEW_ACCOUNT_RE = /new\s*account/i;

function newAccountLocators(root: Page | Frame): Locator[] {
  return [
    root.getByRole("button", { name: NEW_ACCOUNT_RE }),
    root.locator(".el-button").filter({ hasText: NEW_ACCOUNT_RE }),
    root.locator("button").filter({ hasText: NEW_ACCOUNT_RE }),
  ];
}

/** Click via bounding box — CDP often reports modal elements as not "visible". */
async function clickLocatorByBox(page: Page, loc: Locator): Promise<boolean> {
  if ((await loc.count()) === 0) return false;
  const box = await loc.first().boundingBox().catch(() => null);
  if (box && box.width > 0 && box.height > 0) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return true;
  }
  await loc.first().click({ force: true, timeout: 5000 }).catch(() => {});
  return true;
}

async function clickNewAccountInFrame(page: Page, frame: Page | Frame): Promise<boolean> {
  for (const loc of newAccountLocators(frame)) {
    if (await clickLocatorByBox(page, loc.first())) return true;
  }
  return false;
}

async function clickNewAccountViaDom(frame: Page | Frame): Promise<boolean> {
  return frame
    .evaluate(() => {
      const norm = (s: string) => s.replace(/\s+/g, " ").trim();
      for (const el of document.querySelectorAll("button, .el-button, a, span, div")) {
        if (!/^new account$/i.test(norm(el.textContent ?? ""))) continue;
        (el.closest("button, .el-button, a") ?? el).dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
        );
        return true;
      }
      return false;
    })
    .catch(() => false);
}

function everyFrame(page: Page): Array<Page | Frame> {
  const seen = new Set<Frame | Page>();
  const out: Array<Page | Frame> = [];
  for (const p of page.context().pages()) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
    for (const f of p.frames()) {
      if (!seen.has(f)) {
        seen.add(f);
        out.push(f);
      }
    }
  }
  return out;
}

/** Page has `goto`; Frame has `page()` — avoid `instanceof Frame` (type-only import). */
function ownerPageOf(root: Page | Frame): Page {
  return "goto" in root ? root : root.page();
}

function isChildFrame(root: Page | Frame): boolean {
  return !("goto" in root) && Boolean(root.parentFrame());
}

function hasEssentialFormScript() {
  return () => {
    const norm = (s: string) => s.replace(/\s+/g, " ").replace(/\*/g, "").trim();
    if (!/essential information/i.test(document.body?.innerText ?? "")) return false;
    const labels = [...document.querySelectorAll(".el-form-item__label, label")].map((l) =>
      norm(l.textContent ?? "")
    );
    return labels.some((t) => /^account/i.test(t)) && labels.some((t) => /login password/i.test(t));
  };
}

async function waitForCreateDialog(page: Page, timeoutMs = 18000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const root of everyFrame(page)) {
      const found = await root.evaluate(hasEssentialFormScript()).catch(() => false);
      if (found) return true;
    }
    if ((await page.getByText(/Essential information/i).count()) > 0) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

async function readDomMessages(page: Page): Promise<string> {
  const parts: string[] = [];
  for (const root of everyFrame(page)) {
    const chunk = await root
      .evaluate(() =>
        [...document.querySelectorAll(".el-message, .el-form-item__error, .el-message-box__message")]
          .map((el) => el.textContent?.trim())
          .filter(Boolean)
          .join(" ")
      )
      .catch(() => "");
    if (chunk) parts.push(chunk);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function createDialogStillOpen(page: Page): Promise<boolean> {
  for (const root of everyFrame(page)) {
    const open = await root.evaluate(hasEssentialFormScript()).catch(() => false);
    if (open) return true;
  }
  return (await page.getByText(/Essential information/i).count()) > 0;
}

type FillCreateResult = { ok: true } | { ok: false; error: string };

async function fillAndSaveCreateDialog(
  page: Page,
  username: string,
  password: string
): Promise<FillCreateResult> {
  const fillScript = ({ user, pass }: { user: string; pass: string }) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const setVal = (el: HTMLInputElement, val: string) => {
      el.focus();
      el.setAttribute("autocomplete", "off");
      setter?.call(el, val);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: val, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    };

    const norm = (s: string) => s.replace(/\s+/g, " ").replace(/\*/g, "").trim();

    const findDialog = (): Element | undefined => {
      const pick = (dlg: Element | null | undefined): Element | undefined => {
        if (!dlg) return undefined;
        const rect = dlg.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return dlg;
        if (dlg.querySelector(".el-form-item input")) return dlg;
        return undefined;
      };
      for (const dlg of document.querySelectorAll(".el-dialog, [role='dialog'], .el-overlay-dialog")) {
        const title =
          dlg.querySelector(".el-dialog__title, .el-dialog__header")?.textContent ?? dlg.textContent ?? "";
        if (/essential information/i.test(title)) {
          const hit = pick(dlg);
          if (hit) return hit;
        }
      }
      for (const title of document.querySelectorAll(".el-dialog__title, .el-dialog__header, h2, h3, span, div")) {
        const text = (title.textContent ?? "").trim();
        if (!/^essential information$/i.test(text)) continue;
        const dlg =
          title.closest(".el-dialog, [role='dialog'], .el-overlay-dialog") ??
          title.parentElement?.closest(".el-dialog, [role='dialog']");
        const hit = pick(dlg ?? title.parentElement);
        if (hit) return hit;
      }
      if (/essential information/i.test(document.body?.innerText ?? "")) {
        const overlay = document.querySelector(".el-overlay:not([style*='display: none'])") ?? document.body;
        return overlay;
      }
      return undefined;
    };

    const inputByLabel = (dlg: Element, pattern: RegExp): HTMLInputElement | null => {
      for (const item of dlg.querySelectorAll(".el-form-item")) {
        const label = norm(item.querySelector(".el-form-item__label, label")?.textContent ?? "");
        if (!pattern.test(label)) continue;
        const input = item.querySelector("input") as HTMLInputElement | null;
        if (input) return input;
      }
      return null;
    };

    const dlg = findDialog();
    if (!dlg) return { ok: false as const, error: "create dialog not found" };

    let accountInput = inputByLabel(dlg, /^account/i);
    let loginPass = inputByLabel(dlg, /login\s*password/i);
    let confirmPass = inputByLabel(dlg, /confirm\s*password/i);

    const passInputs = [...dlg.querySelectorAll('input[type="password"]')] as HTMLInputElement[];
    if (!loginPass && passInputs.length >= 1) loginPass = passInputs[0];
    if (!confirmPass && passInputs.length >= 2) confirmPass = passInputs[1];

    if (!accountInput) {
      const textInputs = [
        ...dlg.querySelectorAll(
          'input.el-input__inner:not([type="password"]), input:not([type="password"]):not([type="hidden"])'
        ),
      ].filter((el) => (el as HTMLInputElement).type !== "checkbox") as HTMLInputElement[];
      accountInput = textInputs[0] ?? null;
      if (!loginPass) loginPass = textInputs[2] ?? textInputs[1] ?? null;
      if (!confirmPass) confirmPass = textInputs[3] ?? textInputs[2] ?? null;
    }

    if (!accountInput || !loginPass || !confirmPass) {
      return {
        ok: false as const,
        error: `create form fields missing (account=${Boolean(accountInput)}, login=${Boolean(loginPass)}, confirm=${Boolean(confirmPass)})`,
      };
    }

    for (const el of [accountInput, loginPass, confirmPass]) setVal(el, "");
    setVal(accountInput, user);
    setVal(loginPass, pass);
    setVal(confirmPass, pass);

    if (accountInput.value !== user || loginPass.value !== pass || confirmPass.value !== pass) {
      for (const el of [accountInput, loginPass, confirmPass]) setVal(el, "");
      setVal(accountInput, user);
      setVal(loginPass, pass);
      setVal(confirmPass, pass);
    }

    if (accountInput.value !== user || loginPass.value !== pass || confirmPass.value !== pass) {
      return {
        ok: false as const,
        error: `form values mismatch (account="${accountInput.value}", passLen=${loginPass.value.length})`,
      };
    }

    const saveBtn = [...dlg.querySelectorAll("button, .el-button")].find((b) =>
      /^\s*save\s*$/i.test((b.textContent ?? "").trim())
    );
    if (!saveBtn) return { ok: false as const, error: "Save button not found" };
    (saveBtn as HTMLElement).click();
    return { ok: true as const };
  };

  let lastError = "create dialog not found";
  for (const root of everyFrame(page)) {
    const result = await root.evaluate(fillScript, { user: username, pass: password }).catch(() => null);
    if (result?.ok) return { ok: true };
    if (result && !result.ok && result.error !== "create dialog not found") {
      lastError = result.error;
    }
  }
  return { ok: false, error: lastError };
}

/** Playwright locators + typeInto — works when evaluate fill does not stick in Vue. */
async function fillCreateViaLocators(page: Page, username: string, password: string): Promise<boolean> {
  for (const root of everyFrame(page)) {
    const dlg = root.locator(".el-dialog, [role='dialog']").filter({ hasText: /Essential information/i });
    if ((await dlg.count()) === 0) continue;
    const d = dlg.last();
    try {
      const account = d.locator(".el-form-item").filter({ hasText: /^[\s*]*account/i }).locator("input").first();
      const login = d.locator(".el-form-item").filter({ hasText: /login password/i }).locator("input").first();
      const confirm = d.locator(".el-form-item").filter({ hasText: /confirm password/i }).locator("input").first();
      await typeInto(account, username);
      await typeInto(login, password);
      await typeInto(confirm, password);
      await clickDialogButton(d, /^\s*save\s*$/i);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/** Fill by input order in the open overlay — Account, Nickname, Recharge, Login, Confirm. */
async function fillCreateByInputOrder(page: Page, username: string, password: string): Promise<boolean> {
  await page.bringToFront().catch(() => {});
  if ((await page.getByText(/Essential information/i).count()) === 0) return false;

  const scopes = [
    page.locator(".el-overlay:not([style*='display: none'])"),
    page.locator(".el-dialog").filter({ hasText: /Essential information/i }),
    page.locator("[role='dialog']").filter({ hasText: /Essential information/i }),
    page.locator("body"),
  ];

  for (const scope of scopes) {
    const inputs = scope.locator('input:not([type="checkbox"]):not([type="hidden"])');
    const n = await inputs.count().catch(() => 0);
    if (n < 3) continue;
    try {
      if (n >= 5) {
        await typeInto(inputs.nth(0), username);
        await typeInto(inputs.nth(3), password);
        await typeInto(inputs.nth(4), password);
      } else {
        await typeInto(inputs.nth(0), username);
        await typeInto(inputs.nth(1), password);
        await typeInto(inputs.nth(2), password);
      }
      const save = page.getByRole("button", { name: /^\s*save\s*$/i }).last();
      await save.click({ force: true });
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/** Type into fields by clicking their on-screen coordinates (last resort for CDP). */
async function fillCreateByCoords(page: Page, username: string, password: string): Promise<boolean> {
  for (const root of everyFrame(page)) {
    const ownerPage = ownerPageOf(root);
    await ownerPage.bringToFront().catch(() => {});

    let offsetX = 0;
    let offsetY = 0;
    if (isChildFrame(root)) {
      const frameEl = await root.frameElement().catch(() => null);
      const box = frameEl ? await frameEl.boundingBox().catch(() => null) : null;
      if (box) {
        offsetX = box.x;
        offsetY = box.y;
      }
    }

    const fields = await root
      .evaluate(() => {
        const norm = (s: string) => s.replace(/\s+/g, " ").replace(/\*/g, "").trim();
        const center = (input: Element) => {
          const r = input.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        };

        const findRoot = (): Element | null => {
          for (const dlg of document.querySelectorAll(".el-dialog, [role='dialog'], .el-overlay-dialog")) {
            const title =
              dlg.querySelector(".el-dialog__title, .el-dialog__header")?.textContent ?? dlg.textContent ?? "";
            if (/essential information/i.test(title)) return dlg;
          }
          if (/essential information/i.test(document.body?.innerText ?? "")) {
            return (
              document.querySelector(".el-overlay:not([style*='display: none'])") ??
              document.querySelector(".el-dialog") ??
              document.body
            );
          }
          return null;
        };

        const dlg = findRoot();
        if (!dlg) return null;

        let account: { x: number; y: number } | null = null;
        let login: { x: number; y: number } | null = null;
        let confirm: { x: number; y: number } | null = null;

        for (const item of dlg.querySelectorAll(".el-form-item")) {
          const label = norm(item.querySelector(".el-form-item__label, label")?.textContent ?? "");
          const input = item.querySelector("input");
          if (!input) continue;
          const pt = center(input);
          if (/^account/i.test(label)) account = pt;
          else if (/login\s*password/i.test(label)) login = pt;
          else if (/confirm\s*password/i.test(label)) confirm = pt;
        }

        const inputs = [...dlg.querySelectorAll("input")].filter(
          (el) => (el as HTMLInputElement).type !== "checkbox"
        );
        if (!account && inputs[0]) account = center(inputs[0]);
        if (!login && inputs[3]) login = center(inputs[3]);
        if (!confirm && inputs[4]) confirm = center(inputs[4]);
        if (!login && inputs[1]) login = center(inputs[1]);
        if (!confirm && inputs[2]) confirm = center(inputs[2]);

        const saveEl = [...dlg.querySelectorAll("button, .el-button")].find((b) =>
          /^\s*save\s*$/i.test((b.textContent ?? "").trim())
        );
        if (!account || !login || !confirm || !saveEl) return null;
        const sr = saveEl.getBoundingClientRect();
        return {
          account,
          login,
          confirm,
          save: { x: sr.x + sr.width / 2, y: sr.y + sr.height / 2 },
        };
      })
      .catch(() => null);

    if (!fields) continue;

    const typeAt = async (pt: { x: number; y: number }, text: string) => {
      await ownerPage.mouse.click(pt.x + offsetX, pt.y + offsetY, { clickCount: 3 });
      await ownerPage.waitForTimeout(200);
      await ownerPage.keyboard.press("Backspace").catch(() => {});
      await ownerPage.keyboard.type(text, { delay: 40 });
    };

    await typeAt(fields.account, username);
    await typeAt(fields.login, password);
    await typeAt(fields.confirm, password);
    await ownerPage.mouse.click(fields.save.x + offsetX, fields.save.y + offsetY);
    return true;
  }
  return false;
}

async function resolveFormPage(page: Page): Promise<Page> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const p of page.context().pages()) {
      if ((await p.getByText(/Essential information/i).count()) > 0) {
        await p.bringToFront().catch(() => {});
        log("create", `Essential information on tab: ${p.url() || "(popup)"}`);
        return p;
      }
      for (const root of [p, ...p.frames()]) {
        const found = await root.evaluate(hasEssentialFormScript()).catch(() => false);
        if (found) {
          await p.bringToFront().catch(() => {});
          log("create", `Essential information on tab: ${p.url() || "(popup)"}`);
          return p;
        }
      }
    }
    await page.waitForTimeout(400);
  }
  return page;
}

type CreateOutcome =
  | { status: "created" }
  | { status: "duplicate" }
  | { status: "error"; message: string };

async function clickNewAccount(page: Page): Promise<void> {
  await page.bringToFront().catch(() => {});
  for (const loc of [
    page.getByRole("button", { name: /new account/i }).first(),
    page.locator(".el-button").filter({ hasText: /new account/i }).first(),
    page.locator("button").filter({ hasText: /new account/i }).first(),
  ]) {
    if ((await loc.count()) === 0) continue;
    const box = await loc.boundingBox().catch(() => null);
    if (box && box.width > 0 && box.height > 0) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      log("create", "clicked New Account");
      await page.waitForTimeout(800);
      return;
    }
    await loc.click({ force: true });
    log("create", "clicked New Account (force)");
    await page.waitForTimeout(800);
    return;
  }
  throw new Error("New Account button not found on User List");
}

/** Wait until Layui iframe form inputs are loaded (not just the loading spinner). */
async function waitForInsertFrame(page: Page, timeoutMs = 20000): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = insertFrame(page);
    if (frame) {
      const ready =
        (await frame.locator('input[type="password"]').count().catch(() => 0)) >= 2 &&
        (await frame.locator("input[type='text']").count().catch(() => 0)) >= 1;
      if (ready) return frame;
    }
    await page.waitForTimeout(400);
  }
  throw new Error("Create iframe (/admin/player/insert) form did not load");
}

async function tryCreateOnce(page: Page, username: string, password: string): Promise<CreateOutcome> {
  await gotoUserList(page);
  await clickNewAccount(page);

  const form = await waitForInsertFrame(page);
  log("create", `filling ${form.url()}`);

  await fillInsertForm(form, username, password);

  await clickSaveInInsertFrame(form);
  const closed = await waitUntilInsertFrameClosed(page);
  log("create", closed ? "iframe closed after Save" : "iframe still open after Save");

  if (!closed && insertFrame(page)) {
    const dupMsg = await insertFrame(page)!
      .locator(".layui-form-danger, .el-form-item__error")
      .allInnerTexts()
      .catch(() => [] as string[]);
    if (DUPLICATE_RE.test(dupMsg.join(" "))) {
      await insertFrame(page)?.getByRole("button", { name: /^\s*cancel\s*$/i }).click({ force: true }).catch(() => {});
      return { status: "duplicate" };
    }
  }

  if (await accountVisibleInList(page, username)) {
    log("create", `verified ${username} in list`);
    return { status: "created" };
  }

  await screenshot(page, "create-error");
  return { status: "error", message: "Account not found in list after Save" };
}

export async function createAccount(
  page: Page,
  baseUsername: string,
  _password: string,
  variant: (base: string, attempt: number) => string,
  options?: { forceNewAccount?: boolean }
): Promise<{ username: string; password: string }> {
  for (let attempt = 0; attempt < CREATE_ACCOUNT_MAX_ATTEMPTS; attempt++) {
    const username = normalizeUsername(variant(baseUsername, attempt));

    if (await accountExists(page, username)) {
      log("create", `"${username}" already exists — trying next number`);
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

    if (await accountExists(page, username)) {
      log("create", `"${username}" on panel after retry — success`);
      return { username, password: username };
    }

    await screenshot(page, "create-error");
    throw new Error(`Account creation failed: ${outcome.message}`);
  }

  await screenshot(page, "create-exhausted");
  throw new Error(`Could not create a unique account from base "${baseUsername}"`);
}
