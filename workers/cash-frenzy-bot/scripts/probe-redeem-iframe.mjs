import { chromium } from "playwright";

const cdpUrl = process.env.CASHFRENZY_CDP_URL?.trim() || "http://127.0.0.1:9229";
const account = process.env.PROBE_ACCOUNT || "spin5314";

const browser = await chromium.connectOverCDP(cdpUrl);
const page =
  browser.contexts()[0].pages().find((p) => p.url().includes("cashfrenzy")) ??
  browser.contexts()[0].pages()[0];

console.log("URL:", page.url());

const search = page.locator('input[name="search_content"]').first().or(page.getByPlaceholder(/search/i).first());
await search.fill(account);
await page.getByRole("button", { name: /search/i }).first().click({ force: true }).catch(() => {});
await page.waitForTimeout(2000);

const row = page.locator(".el-table__body-wrapper tbody tr").filter({ hasText: account }).first();
const editor = row.getByText(/^editor$/i).first();
await editor.click({ force: true });
await page.waitForTimeout(1500);

const btns = await page.locator("button, .layui-btn, a").evaluateAll((els) =>
  els
    .map((e) => ({
      text: (e.textContent ?? "").trim().slice(0, 40),
      id: e.id,
      layFilter: e.getAttribute("lay-filter"),
      laySubmit: e.getAttribute("lay-submit"),
    }))
    .filter((b) => /recharge|redeem|editor|confirm|submit/i.test(b.text) || b.layFilter || b.id)
);
console.log("EDITOR BUTTONS:", JSON.stringify(btns, null, 2));

const redeemBtn = page
  .locator("#redeem, button[lay-filter='redeem']")
  .first()
  .or(page.getByRole("button", { name: /^\s*redeem\s*$/i }).first());
await redeemBtn.click({ force: true });
await page.waitForTimeout(2000);

console.log("FRAMES:", page.frames().map((f) => f.url()));

const frame = page.frames().find((f) => /\/player\/(redeem|withdraw)/i.test(f.url()));
if (!frame) {
  console.log("NO REDEEM FRAME");
  await browser.close();
  process.exit(1);
}

const formInfo = await frame.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")].map((el) => ({
    name: el.name,
    type: el.type,
    value: el.value,
    placeholder: el.placeholder,
    readonly: el.readOnly,
  }));
  const buttons = [...document.querySelectorAll("button, .layui-btn")].map((el) => ({
    text: (el.textContent ?? "").trim(),
    layFilter: el.getAttribute("lay-filter"),
    laySubmit: el.getAttribute("lay-submit"),
  }));
  const labels = [...document.querySelectorAll(".layui-form-label")].map((el) => (el.textContent ?? "").trim());
  return { labels, inputs, buttons };
});
console.log("IFRAME FORM:", JSON.stringify(formInfo, null, 2));

await browser.close();
