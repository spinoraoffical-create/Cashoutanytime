import "dotenv/config";
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const cdpUrl = process.env.GAMEVAULT_CDP_URL?.trim() || "http://127.0.0.1:9224";
const base = (process.env.GAMEVAULT_ADMIN_URL ?? "https://agent.gamevault999.com/login").replace(
  /\/login.*$/i,
  ""
);

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0];
const pages = context.pages();
const page =
  pages.find((p) => p.url().includes("gamevault999.com")) ?? pages[0] ?? (await context.newPage());
await page.bringToFront();

const log = (...a) => console.log(...a);

function visibleDialog() {
  return page
    .locator(".el-overlay:not([style*='display: none']) .el-dialog, .el-dialog:visible")
    .last();
}

async function dumpVisibleDialog(tag) {
  const dlg = visibleDialog();
  if (!(await dlg.isVisible().catch(() => false))) {
    log(`[${tag}] no visible dialog`);
    return;
  }
  const title = await dlg.locator(".el-dialog__title").innerText().catch(() => "");
  const labels = await dlg.locator(".el-form-item__label").allInnerTexts().catch(() => []);
  const inputs = await dlg.locator("input").evaluateAll((els) =>
    els.map((el, i) => ({
      i,
      type: el.type,
      placeholder: el.placeholder,
      readonly: el.readOnly,
      className: el.className?.slice?.(0, 60),
    }))
  );
  const buttons = await dlg.locator(".el-dialog__footer button, .el-dialog__body button").allInnerTexts().catch(() => []);
  log(`[${tag}] TITLE:`, title);
  log(`[${tag}] LABELS:`, labels.map((s) => s.trim()).filter(Boolean).join(" | "));
  log(`[${tag}] INPUTS:`, JSON.stringify(inputs));
  log(`[${tag}] BUTTONS:`, buttons.map((s) => s.trim()).filter(Boolean).join(" | "));
  await page.screenshot({ path: `dlg-${tag}.png`, fullPage: true });
}

async function closeDialogs() {
  for (let i = 0; i < 5; i++) {
    const dlg = visibleDialog();
    if (!(await dlg.isVisible().catch(() => false))) break;
    const cancel = dlg.locator("button").filter({ hasText: /^\s*(cancel|close)\s*$/i }).last();
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click().catch(() => {});
    } else {
      const x = dlg.locator(".el-dialog__headerbtn").last();
      if (await x.isVisible().catch(() => false)) await x.click({ force: true }).catch(() => {});
      else await page.keyboard.press("Escape").catch(() => {});
    }
    await page.waitForTimeout(600);
  }
}

try {
  await page.goto(`${base}/userManagement`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // 1) Dump every table's headers with indices
  const tables = page.locator(".el-table");
  const tCount = await tables.count();
  log("TABLE COUNT:", tCount);
  for (let t = 0; t < tCount; t++) {
    const ths = await tables.nth(t).locator(".el-table__header th").allInnerTexts().catch(() => []);
    log(`TABLE ${t} HEADERS:`, ths.map((s, i) => `${i}:${s.trim()}`).filter((s) => !s.endsWith(":")).join(" | "));
  }

  // 2) New Account dialog
  await closeDialogs();
  const newBtn = page.getByRole("button", { name: /new account/i }).first();
  if (await newBtn.isVisible().catch(() => false)) {
    await newBtn.click();
    await page.waitForTimeout(1500);
    await dumpVisibleDialog("new-account");
    await closeDialogs();
  } else {
    log("New Account button not found");
  }

  // 3) Pick an existing account, click its row "editor"
  const account = process.env.PROBE_ACCOUNT || "anthony7999";
  const search = page.getByPlaceholder(/search content|please enter/i).first();
  await search.fill("");
  await search.fill(account);
  await page.getByRole("button", { name: /^\s*search\s*$/i }).first().click().catch(() => {});
  await page.waitForTimeout(2000);

  const row = page.locator(".el-table__body-wrapper tbody tr").filter({ hasText: account }).first();
  const editor = row.getByText(/^editor$/i).first();
  if (await editor.isVisible().catch(() => false)) {
    await editor.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "after-editor.png", fullPage: true });
    const actionButtons = await page.locator("button, .el-button").allInnerTexts().catch(() => []);
    log("ACTION BUTTONS AFTER EDITOR:", [...new Set(actionButtons.map((s) => s.trim()).filter(Boolean))].join(" | "));

    // Recharge dialog
    const recharge = page.getByRole("button", { name: /^\s*recharge\s*$/i }).first();
    if (await recharge.isVisible().catch(() => false)) {
      await recharge.click();
      await page.waitForTimeout(1200);
      await dumpVisibleDialog("recharge");
      await closeDialogs();
    } else {
      log("Recharge button not visible after editor");
    }

    // Redeem dialog
    const redeem = page.getByRole("button", { name: /^\s*redeem\s*$/i }).first();
    if (await redeem.isVisible().catch(() => false)) {
      await redeem.click();
      await page.waitForTimeout(1200);
      await dumpVisibleDialog("redeem");
      await closeDialogs();
    } else {
      log("Redeem button not visible after editor");
    }
  } else {
    log(`No 'editor' link found for account ${account}`);
    writeFileSync("probe-row.html", await row.innerHTML().catch(() => ""));
  }

  log("DONE");
} catch (e) {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  await page.screenshot({ path: "probe-dialogs-error.png", fullPage: true }).catch(() => {});
} finally {
  browser.close().catch(() => {});
}
