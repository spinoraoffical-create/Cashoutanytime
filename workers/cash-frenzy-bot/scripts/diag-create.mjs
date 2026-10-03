import { chromium } from "playwright";

const user = `z${Date.now().toString().slice(-6)}`;
const browser = await chromium.connectOverCDP("http://127.0.0.1:9229");
const page = browser.contexts()[0].pages().find((p) => p.url().includes("/player/index")) ?? browser.contexts()[0].pages()[0];
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(500);
await page.getByRole("button", { name: /new account/i }).first().click({ force: true });

let frame = null;
for (let i = 0; i < 40; i++) {
  frame = page.frames().find((f) => /\/player\/insert/i.test(f.url())) ?? null;
  if (frame && (await frame.locator('input[name="username"]').count()) > 0) break;
  await page.waitForTimeout(400);
}

await frame.locator('input[name="username"]').fill(user);
await frame.locator('input[name="password"]').fill(user);
await frame.locator('input[name="password_confirmation"]').fill(user);
await frame.locator('button[lay-submit][lay-filter="add"]').click();
await page.waitForTimeout(5000);

console.log("iframe open:", Boolean(page.frames().find((f) => /\/player\/insert/i.test(f.url()))));
await page.locator('input[name="search_content"]').fill(user);
await page.getByRole("button", { name: /^\s*search\s*$/i }).first().click({ force: true });
await page.waitForTimeout(2000);
console.log("found:", (await page.locator("tbody tr:not(#noData)").filter({ hasText: user }).count()) > 0, user);

browser.close().catch(() => {});
