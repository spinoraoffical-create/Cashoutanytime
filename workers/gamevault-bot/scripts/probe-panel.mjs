import "dotenv/config";
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const url = process.env.GAMEVAULT_ADMIN_URL ?? "https://agent.gamevault999.com/login";
const user = process.env.GAMEVAULT_AGENT_USERNAME;
const pass = process.env.GAMEVAULT_AGENT_PASSWORD;
if (!user || !pass) throw new Error("Missing GAMEVAULT_AGENT_USERNAME / GAMEVAULT_AGENT_PASSWORD in .env");

const cdpUrl = process.env.GAMEVAULT_CDP_URL?.trim();
const headless = process.env.GAMEVAULT_HEADLESS !== "false";

let browser;
let page;
let usingCdp = false;

if (cdpUrl) {
  console.log("Connecting to your Chrome via CDP:", cdpUrl);
  browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const pages = context.pages();
  page =
    pages.find((p) => p.url().includes("gamevault999.com")) ??
    pages[0] ??
    (await context.newPage());
  await page.bringToFront();
  usingCdp = true;
} else {
  browser = await chromium.launch({ headless });
  page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
}

function dumpInputs(els) {
  return els.map((el, i) => ({
    i,
    type: el.type,
    name: el.name,
    id: el.id,
    placeholder: el.placeholder,
    className: el.className?.slice?.(0, 100),
  }));
}

try {
  if (!usingCdp) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("Loaded:", page.url(), await page.title());
    await page.waitForTimeout(2500);

    writeFileSync("probe-login.html", (await page.content()).slice(0, 60000));
    console.log("LOGIN INPUTS:", JSON.stringify(await page.locator("input").evaluateAll(dumpInputs), null, 2));

    // Generic login (will not pass a CAPTCHA — use CDP mode for that)
    const textInputs = page.locator('input:not([type="password"]):not([type="hidden"])');
    const passInput = page.locator('input[type="password"]').first();
    await textInputs.first().fill(user);
    await passInput.fill(pass);

    const loginBtn = page
      .locator('button, input[type="submit"], .el-button')
      .filter({ hasText: /login|sign in|submit|登/i })
      .first();
    if ((await loginBtn.count()) === 0) {
      await page.locator('button[type="submit"], .el-button--primary, button').first().click();
    } else {
      await loginBtn.click();
    }
    await page.waitForTimeout(5000);
    console.log("After login URL:", page.url(), "| title:", await page.title());
    await page.screenshot({ path: "probe-after-login.png", fullPage: true });
  } else {
    console.log("CDP: current tab is", page.url());
  }

  // Go to user management
  const mgmt = url.replace(/\/login.*$/i, "/userManagement");
  await page.goto(mgmt, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  console.log("User mgmt URL:", page.url());
  await page.screenshot({ path: "probe-user-management.png", fullPage: true });
  writeFileSync("probe-user-management.html", (await page.content()).slice(0, 120000));

  // Table headers
  const headers = await page.locator("table th, table thead td").allInnerTexts().catch(() => []);
  console.log("TABLE HEADERS:", headers.map((h) => h.trim()).filter(Boolean).join(" | "));

  // Buttons / clickable text
  const texts = await page.locator("a, button, .el-menu-item, span, li").evaluateAll((els) =>
    els.map((el) => el.textContent?.trim().replace(/\s+/g, " ")).filter((t) => t && t.length > 1 && t.length < 40)
  );
  console.log("CLICKABLE TEXT:", [...new Set(texts)].slice(0, 100).join(" | "));

  // Open New Account dialog to capture its inputs
  const newAcc = page.locator("a, button, span, div").filter({ hasText: /new account|add account|create/i }).first();
  if ((await newAcc.count()) > 0) {
    await newAcc.click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "probe-new-account.png", fullPage: true });
    console.log("NEW ACCOUNT INPUTS:", JSON.stringify(await page.locator("input").evaluateAll(dumpInputs), null, 2));
  }
} catch (e) {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  await page.screenshot({ path: "probe-error.png", fullPage: true }).catch(() => {});
} finally {
  if (usingCdp) {
    browser.close().catch(() => {});
  } else {
    await browser.close();
  }
}
