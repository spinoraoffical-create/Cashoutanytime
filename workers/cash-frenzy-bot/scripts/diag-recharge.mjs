import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9229");
const page = browser.contexts()[0].pages().find((p) => p.url().includes("/player/index")) ?? browser.contexts()[0].pages()[0];

await page.locator('input[name="search_content"]').fill("shivoo3");
await page.getByRole("button", { name: /^\s*search\s*$/i }).first().click({ force: true });
await page.waitForTimeout(2500);

const buttons = await page.locator("button, .layui-btn, a").evaluateAll((els) =>
  els.map((e) => ({
    text: (e.textContent ?? "").trim().slice(0, 30),
    id: e.id,
    layFilter: e.getAttribute("lay-filter"),
    visible: e.offsetParent !== null,
  }))
);
console.log("buttons after search:", JSON.stringify(buttons.filter((b) => /recharge|redeem|editor|save|confirm/i.test(b.text)), null, 2));

// try editor click then recheck recharge
await page.locator("tbody tr:not(#noData)").filter({ hasText: "shivoo3" }).locator("a, button").filter({ hasText: /^editor$/i }).first().click().catch(() => {});
await page.waitForTimeout(1500);
console.log("after editor:", JSON.stringify(buttons.filter((b) => /recharge/i.test(b.text)), null, 2));

await page.locator("#recharge, button[lay-filter='recharge']").first().click().catch((e) => console.log("recharge click err:", e.message));
await page.waitForTimeout(2000);
console.log("frames:", page.frames().map((f) => f.url()));

browser.close().catch(() => {});
