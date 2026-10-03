import "dotenv/config";
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages().find((p) => p.url().includes("gamevault999.com"));
await page.bringToFront();

const img = page.locator('img[src*="captcha" i]').first();
console.log("count", await img.count());
console.log("visible", await img.isVisible());

try {
  const buf = await img.screenshot({ type: "png" });
  console.log("element screenshot OK", buf.length);
} catch (e) {
  console.log("element screenshot FAIL", e.message);
}

const box = await img.boundingBox();
console.log("box", box);
if (box) {
  const clip = await page.screenshot({ clip: box, type: "png" });
  console.log("clip screenshot OK", clip.length);
}

const src = await img.getAttribute("src");
console.log("src", src);
if (src) {
  const res = await page.request.get(src.startsWith("http") ? src : new URL(src, page.url()).href);
  const body = await res.body();
  console.log("fetch src OK", body.length, "status", res.status());
}

browser.close().catch(() => {});
