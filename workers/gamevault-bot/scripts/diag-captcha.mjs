/**
 * Diagnose Game Vault CAPTCHA selectors on the live Chrome tab.
 * Usage: node scripts/diag-captcha.mjs
 */
import "dotenv/config";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const OUT = join(process.cwd(), "debug");
mkdirSync(OUT, { recursive: true });

const cdp = process.env.GAMEVAULT_CDP_URL?.trim() || "http://127.0.0.1:9222";
const browser = await chromium.connectOverCDP(cdp);
const context = browser.contexts()[0];
const page =
  context.pages().find((p) => p.url().includes("gamevault999.com")) ??
  context.pages()[0];

await page.bringToFront();
console.log("Tab:", page.url(), "|", await page.title());

const inputs = await page.locator("input").evaluateAll((els) =>
  els.map((el, i) => ({
    i,
    type: el.type,
    name: el.name,
    id: el.id,
    placeholder: el.placeholder,
    className: el.className?.slice?.(0, 80),
  }))
);
console.log("\nINPUTS:", JSON.stringify(inputs, null, 2));

const imgs = await page.locator("img").evaluateAll((els) =>
  els.map((el, i) => {
    const r = el.getBoundingClientRect();
    return {
      i,
      src: (el.src || "").slice(0, 120),
      w: Math.round(r.width),
      h: Math.round(r.height),
      visible: r.width > 0 && r.height > 0,
    };
  })
);
console.log("\nIMAGES:", JSON.stringify(imgs, null, 2));

const canvases = await page.locator("canvas").evaluateAll((els) =>
  els.map((el, i) => {
    const r = el.getBoundingClientRect();
    return { i, w: Math.round(r.width), h: Math.round(r.height) };
  })
);
console.log("\nCANVAS:", JSON.stringify(canvases, null, 2));

const buttons = await page.locator("button, .el-button").evaluateAll((els) =>
  els
    .map((el) => el.textContent?.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 20)
);
console.log("\nBUTTONS:", buttons.join(" | "));

writeFileSync(join(OUT, "gv-login.html"), (await page.content()).slice(0, 80000));
await page.screenshot({ path: join(OUT, "gv-login-diag.png"), fullPage: true });
console.log("\nSaved debug/gv-login-diag.png and gv-login.html");

browser.close().catch(() => {});
