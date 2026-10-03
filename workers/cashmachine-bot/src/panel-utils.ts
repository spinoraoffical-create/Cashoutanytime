import type { Locator, Page } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";
import { waitForPanelLogin } from "../../shared/panel-login-captcha.js";

const DEBUG_DIR = join(process.cwd(), "debug");

export function log(step: string, detail?: string) {
  const msg = detail ? `[cm] ${step}: ${detail}` : `[cm] ${step}`;
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
        page
          .locator("a, button, span, li, div, .el-menu-item, .el-button")
          .filter({ hasText: pattern }),
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

/** Click a specific selector if provided (env override), else fall back to text. */
export async function clickSelectorOrText(
  page: Page,
  selector: string | undefined,
  patterns: RegExp[],
  timeout = 8000
): Promise<boolean> {
  if (selector) {
    const loc = page.locator(selector).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      await loc.click({ timeout });
      log("clicked-selector", selector);
      await page.waitForTimeout(800);
      return true;
    }
  }
  return clickByText(page, patterns, timeout);
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

/** Fill the first visible input that matches a selector (env override) else placeholder hints. */
export async function fillSelectorOrPlaceholder(
  page: Page,
  selector: string | undefined,
  hints: RegExp[],
  value: string
) {
  if (selector) {
    const loc = page.locator(selector).first();
    if ((await loc.count()) > 0) {
      await loc.fill(value);
      return;
    }
  }
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

export async function isLoginPage(page: Page): Promise<boolean> {
  if (page.url().includes("/login")) return true;
  const pwd = await page.locator('input[type="password"]').count();
  const signIn = page.getByRole("button", { name: /sign in|log in|login/i });
  return pwd > 0 && (await signIn.isVisible().catch(() => false));
}

export async function waitForManualLogin(page: Page, timeoutMs = 180_000) {
  const allowManual =
    process.env.CASHMACHINE_HEADLESS === "false" || Boolean(process.env.CASHMACHINE_CDP_URL);
  await waitForPanelLogin(page, { log, isLoginPage, allowManual, manualTimeoutMs: timeoutMs });
}

/** Parse a money string -> number, or null if it doesn't look like a number. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
