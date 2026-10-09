import "server-only";

import os from "node:os";
import path from "node:path";
import { chromium, type Frame, type Page } from "playwright";

const STORE_URL = "https://firekirin.xyz:8888/Store.aspx";

function agentLogin(): { username: string; password: string } {
  const username = process.env.FIREKIRIN_AGENT_USERNAME?.trim() || "";
  const password = process.env.FIREKIRIN_AGENT_PASSWORD?.trim() || "";
  if (!username || !password) {
    throw new Error("Fire Kirin store login is not configured.");
  }
  return { username, password };
}

async function readCaptcha(page: Page): Promise<string> {
  const filePath = path.join(os.tmpdir(), `fk-captcha-${Date.now()}.png`);
  await page.locator("#ImageCheck").screenshot({ path: filePath });
  const sharp = (await import("sharp")).default;
  const { createWorker, PSM } = await import("tesseract.js");
  const image = await sharp(filePath).resize({ width: 320, kernel: "nearest" }).greyscale().png().toBuffer();
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: PSM.SINGLE_WORD,
    });
    const recognized = await worker.recognize(image);
    return recognized.data.text.replace(/\D/g, "");
  } finally {
    await worker.terminate();
  }
}

async function panelMessage(page: Page): Promise<string> {
  const box = page.locator("#mb_msg");
  if (await box.count()) {
    const text = (await box.innerText()).replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const match = body.match(/Message\s+(.{3,180})/i);
  return match?.[1]?.trim() || "";
}

async function dismissMessage(page: Page) {
  const ok = page.locator("#mb_btn_ok");
  if (await ok.count()) await ok.click().catch(() => {});
}

async function login(page: Page, username: string, password: string) {
  await page.goto(STORE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("#txtLoginName").waitFor({ timeout: 20000 });
  let lastMessage = "Fire Kirin store login failed.";
  for (let attempt = 1; attempt <= 6; attempt++) {
    await dismissMessage(page);
    const code = await readCaptcha(page);
    if (code.length < 4) continue;
    await page.fill("#txtLoginName", username);
    await page.fill("#txtLoginPass", password);
    await page.fill("#txtVerifyCode", code);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.locator("#btnLogin").click({ force: true }),
    ]);
    if ((await page.locator("#txtLoginName").count()) === 0) return;
    lastMessage = (await panelMessage(page)) || lastMessage;
    if (!/validation code/i.test(lastMessage)) break;
  }
  throw new Error(lastMessage);
}

async function frameWith(page: Page, part: string, timeoutMs = 20000): Promise<Frame> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const frame = page.frames().find((item) => item.url().includes(part));
    if (frame) return frame;
    await page.waitForTimeout(300);
  }
  throw new Error("Fire Kirin store did not open User Management.");
}

async function confirmListed(page: Page, username: string) {
  await dismissMessage(page);
  const list = await frameWith(page, "AccountsList.aspx");
  await list.locator("#txtSearch").fill(username);
  await list.locator("a", { hasText: "Search" }).first().click();
  await page.waitForTimeout(2000);
  const text = await list.locator("body").innerText();
  if (!text.toLowerCase().includes(username.toLowerCase())) {
    throw new Error(`Fire Kirin did not show ${username} in User Management.`);
  }
}

/** Create a player in the agent store. Does not call the Terminal API. */
export async function createFireKirinPlayerOnStore(username: string, password: string): Promise<void> {
  const agent = agentLogin();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await login(page, agent.username, agent.password);

    const left = await frameWith(page, "Left.aspx");
    const menu = left.locator("text=User Management").first();
    if (await menu.count()) await menu.click().catch(() => {});

    const list = await frameWith(page, "AccountsList.aspx");
    await list.locator("a", { hasText: "Create Player" }).first().click();
    const form = await frameWith(page, "CreateAccount.aspx");
    await form.locator("#txtAccount").fill(username);
    await form.locator("#txtLogonPass").fill(password);
    await form.locator("#txtLogonPass2").fill(password);
    await form.locator("a", { hasText: "Create Player" }).click();

    await page.waitForTimeout(2500);
    const message = await panelMessage(page);
    if (!/added successfully/i.test(message)) {
      throw new Error(message || "Fire Kirin store did not confirm the new player.");
    }
    await confirmListed(page, username);
  } finally {
    await browser.close();
  }
}
