/**
 * Diagnose CAPTCHA detection + OCR on open unified Chrome tabs.
 * Usage: set SPINORA_CDP_URL=http://127.0.0.1:9222 && node workers/scripts/diag-captcha.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const CDP = process.env.SPINORA_CDP_URL?.trim() || "http://127.0.0.1:9222";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "diag-captcha-out");
mkdirSync(OUT, { recursive: true });

async function findCaptchaInput(page) {
  const explicit = page.locator(
    [
      'input[placeholder*="code" i]',
      'input[placeholder*="verify" i]',
      'input[placeholder*="captcha" i]',
      'input[placeholder*="vc" i]',
      'input[name*="captcha" i]',
      'input[name*="verify" i]',
    ].join(", ")
  );
  if ((await explicit.count()) > 0) return explicit.first();

  const textInputs = page.locator(
    'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'
  );
  if ((await textInputs.count()) >= 2) return textInputs.last();
  return null;
}

async function findCaptchaImage(page) {
  const sels = [
    'img[src*="captcha" i]',
    'img[src*="verify" i]',
    'img[src*="vcode" i]',
    'img[src*="code" i]',
    "#verifyImg",
    ".captcha img",
    "canvas",
  ];
  for (const sel of sels) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return loc;
  }
  const imgs = page.locator("img");
  for (let i = 0; i < (await imgs.count()); i++) {
    const img = imgs.nth(i);
    if (!(await img.isVisible().catch(() => false))) continue;
    const box = await img.boundingBox().catch(() => null);
    if (box && box.width >= 50 && box.width <= 250 && box.height >= 15 && box.height <= 100) return img;
  }
  return null;
}

const browser = await chromium.connectOverCDP(CDP);
const context = browser.contexts()[0];
const pages = context.pages();

console.log(`Connected — ${pages.length} tabs\n`);

for (const page of pages) {
  const url = page.url();
  if (url.includes("about:") || url.startsWith("chrome://")) continue;

  const host = new URL(url).hostname;
  const slug = host.split(".")[0];
  console.log(`=== ${host} ===`);
  console.log("URL:", url);

  const inputs = await page.locator("input").evaluateAll((els) =>
    els.map((el, i) => ({
      i,
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
    }))
  );
  console.log("Inputs:", JSON.stringify(inputs, null, 2));

  const imgs = await page.locator("img").evaluateAll((els) =>
    els.map((el, i) => ({
      i,
      src: (el.src || "").slice(0, 120),
      w: el.naturalWidth,
      h: el.naturalHeight,
    }))
  );
  console.log("Images:", JSON.stringify(imgs, null, 2));

  const captchaInput = await findCaptchaInput(page);
  const captchaImg = await findCaptchaImage(page);
  console.log("Captcha input found:", Boolean(captchaInput));
  console.log("Captcha image found:", Boolean(captchaImg));

  if (captchaImg) {
    const buf = await captchaImg.screenshot({ type: "png" });
    const path = join(OUT, `${slug}-captcha.png`);
    writeFileSync(path, buf);
    console.log("Saved:", path);

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      });
      const { data } = await worker.recognize(buf);
      console.log("OCR raw:", JSON.stringify(data.text));
      console.log("OCR confidence:", data.confidence);
      await worker.terminate();
    } catch (e) {
      console.log("OCR error:", e.message);
    }
  } else {
    await page.screenshot({ path: join(OUT, `${slug}-page.png`), fullPage: true });
    console.log("No captcha img — saved full page screenshot");
  }
  console.log("");
}

await browser.close();
console.log("Done. Output in", OUT);
