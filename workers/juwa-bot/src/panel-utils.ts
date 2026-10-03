import type { Locator, Page } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";
import { waitForPanelLogin } from "../../shared/panel-login-captcha.js";

const DEBUG_DIR = join(process.cwd(), "debug");

export function log(step: string, detail?: string) {
  const msg = detail ? `[juwa] ${step}: ${detail}` : `[juwa] ${step}`;
  console.log(msg);
}

export async function screenshot(page: Page, name: string) {
  try {
    mkdirSync(DEBUG_DIR, { recursive: true });
    const path = join(DEBUG_DIR, `${Date.now()}-${name}.png`);
    await page.screenshot({ path, fullPage: true });
    log("screenshot", path);
  } catch {
    /* ignore */
  }
}

/** Click first visible element matching any of these text patterns */
export async function clickByText(page: Page, patterns: RegExp[], timeout = 8000): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const pattern of patterns) {
      const locators: Locator[] = [
        page.getByRole("button", { name: pattern }),
        page.getByRole("link", { name: pattern }),
        page.locator("a, button, span, li, div, .el-menu-item, .el-button").filter({ hasText: pattern }),
      ];
      for (const loc of locators) {
        const first = loc.first();
        if ((await first.count()) > 0 && (await first.isVisible().catch(() => false))) {
          await first.click({ timeout: 5000 });
          log("clicked", pattern.source);
          await page.waitForTimeout(800);
          return true;
        }
      }
    }
    await page.waitForTimeout(400);
  }
  return false;
}

export async function fillFirstTextInput(page: Page, value: string, index = 0) {
  const inputs = page.locator(
    'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'
  );
  const count = await inputs.count();
  if (count <= index) throw new Error(`Expected text input #${index}, found ${count}`);
  const input = inputs.nth(index);
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.fill(value);
}

export async function fillPasswordInput(page: Page, value: string, index = 0) {
  const inputs = page.locator('input[type="password"]');
  const count = await inputs.count();
  if (count <= index) throw new Error(`Expected password input #${index}, found ${count}`);
  const input = inputs.nth(index);
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.fill(value);
}

export async function fillByLabelOrPlaceholder(page: Page, hints: RegExp[], value: string) {
  for (const hint of hints) {
    const byPlaceholder = page.getByPlaceholder(hint);
    if ((await byPlaceholder.count()) > 0) {
      await byPlaceholder.first().fill(value);
      return;
    }
    const byLabel = page.getByLabel(hint);
    if ((await byLabel.count()) > 0) {
      await byLabel.first().fill(value);
      return;
    }
  }
  throw new Error(`Could not find input for: ${hints.map((h) => h.source).join(", ")}`);
}

export async function submitForm(page: Page) {
  const patterns = [/login|sign in|submit|confirm|ok|save|create|add|recharge|deposit|充值|确认|提交|登录/i];
  if (await clickByText(page, patterns, 3000)) return;

  const primary = page.locator('.el-button--primary, button[type="submit"], input[type="submit"]').first();
  if ((await primary.count()) > 0 && (await primary.isVisible().catch(() => false))) {
    await primary.click();
    return;
  }

  throw new Error("Could not find submit button");
}

export async function waitForDashboard(page: Page, loginUrl: string) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  if (await isLoginPage(page)) {
    throw new Error("Login failed — still on login page. Check agent username/password.");
  }
}

export async function isLoginPage(page: Page): Promise<boolean> {
  if (page.url().includes("/login")) return true;
  const pwd = await page.locator('input[type="password"]').count();
  const signIn = page.getByRole("button", { name: /sign in|log in|login/i });
  return pwd > 0 && (await signIn.isVisible().catch(() => false));
}

export async function waitForManualLogin(page: Page, timeoutMs = 180_000) {
  const allowManual =
    process.env.JUWA_HEADLESS === "false" || Boolean(process.env.JUWA_CDP_URL);
  await waitForPanelLogin(page, {
    log,
    isLoginPage,
    allowManual,
    manualTimeoutMs: timeoutMs,
    loginButtonPatterns: [/sign in|login|log in|登[录陆]/i],
  });
}
