import "dotenv/config";
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const url = process.env.JUWA_ADMIN_URL;
const user = process.env.JUWA_AGENT_USERNAME;
const pass = process.env.JUWA_AGENT_PASSWORD;
if (!url || !user || !pass) throw new Error("Missing JUWA env vars in .env");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log("Loaded:", page.url(), await page.title());

  const html = await page.content();
  writeFileSync("probe-login.html", html.slice(0, 50000));

  const inputs = await page.locator("input").evaluateAll((els) =>
    els.map((el, i) => ({
      i,
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      className: el.className?.slice?.(0, 100),
    }))
  );
  console.log("INPUTS:", JSON.stringify(inputs, null, 2));

  // Try login with generic selectors
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
  console.log("After login URL:", page.url());
  console.log("After login title:", await page.title());

  await page.screenshot({ path: "probe-after-login.png", fullPage: true });
  writeFileSync("probe-after-login.html", (await page.content()).slice(0, 80000));

  const allText = await page.locator("a, button, .el-menu-item, span, li").evaluateAll((els) =>
    els
      .map((el) => el.textContent?.trim().replace(/\s+/g, " "))
      .filter((t) => t && t.length > 1 && t.length < 50)
  );
  const unique = [...new Set(allText)].slice(0, 80);
  console.log("PAGE TEXT SAMPLES:", unique.join(" | "));
} catch (e) {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  await page.screenshot({ path: "probe-error.png", fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}
