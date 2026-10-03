import type { Locator, Page } from "playwright";
import {
  captchaMaxRetries,
  isAutoCaptchaEnabled,
  solveCaptchaImage,
} from "./captcha-solver.js";

export { isAutoCaptchaEnabled, isCaptchaSolverConfigured } from "./captcha-solver.js";

export type PanelLoginLog = (step: string, detail?: string) => void;

export interface PanelLoginOptions {
  log: PanelLoginLog;
  isLoginPage: (page: Page) => Promise<boolean>;
  /** When false, only auto-solve is attempted (no waiting for human). */
  allowManual?: boolean;
  manualTimeoutMs?: number;
  loginButtonPatterns?: RegExp[];
}

const DEFAULT_LOGIN_PATTERNS = [/sign in|log in|login|登[录陆]/i];

async function findCaptchaInput(page: Page): Promise<Locator | null> {
  const explicit = page
    .locator(
      [
        'input[name="code"]',
        'input[name="verifyCode"]',
        'input[name="verify_code"]',
        'input[name="captcha"]',
        'input[name="vcode"]',
        'input[placeholder*="code" i]',
        'input[placeholder*="verify" i]',
        'input[placeholder*="captcha" i]',
        'input[placeholder*="vc" i]',
        'input[name*="captcha" i]',
        'input[name*="verify" i]',
        'input[id*="captcha" i]',
        'input[id*="verify" i]',
      ].join(", ")
    )
    .first();
  if ((await explicit.count()) > 0 && (await explicit.isVisible().catch(() => false))) {
    return explicit;
  }

  const textInputs = page.locator(
    'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'
  );
  const count = await textInputs.count();
  if (count >= 2) {
    const last = textInputs.last();
    if (await last.isVisible().catch(() => false)) return last;
  }
  return null;
}

async function findCaptchaImage(page: Page): Promise<Locator | null> {
  const srcPatterns = [
    'img[src*="captcha" i]',
    'img[src*="Captcha" i]',
    'img[src*="verify" i]',
    'img[src*="vcode" i]',
    'img[src*="validate" i]',
    'img[src*="code" i]',
    "#verifyImg",
    "#captchaImg",
    "#imgVerify",
    ".captcha img",
    ".verify-code img",
    ".login-captcha img",
    ".layui-form img",
  ];

  for (const sel of srcPatterns) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    if (!(await loc.isVisible().catch(() => false))) continue;
    const box = await loc.boundingBox().catch(() => null);
    if (box && box.width >= 40 && box.height >= 15) return loc;
  }

  const verifyInput = await findCaptchaInput(page);
  if (verifyInput) {
    const nearImg = verifyInput
      .locator("xpath=ancestor::form[1]//img | ancestor::div[1]//img | following::img[1] | preceding::img[1]")
      .first();
    if ((await nearImg.count()) > 0 && (await nearImg.isVisible().catch(() => false))) {
      return nearImg;
    }
  }

  const imgs = page.locator("img");
  const count = await imgs.count();
  for (let i = 0; i < count; i++) {
    const img = imgs.nth(i);
    if (!(await img.isVisible().catch(() => false))) continue;
    const box = await img.boundingBox().catch(() => null);
    if (!box) continue;
    if (box.width >= 60 && box.width <= 220 && box.height >= 20 && box.height <= 90) {
      return img;
    }
  }

  return null;
}

async function clickLoginButton(page: Page, patterns: RegExp[]): Promise<boolean> {
  const tryClick = async (loc: Locator): Promise<boolean> => {
    if ((await loc.count()) === 0 || !(await loc.isVisible().catch(() => false))) return false;
    try {
      await loc.click({ timeout: 8000, force: true });
      return true;
    } catch {
      try {
        await loc.evaluate((el) => (el as HTMLElement).click());
        return true;
      } catch {
        return false;
      }
    }
  };

  for (const pattern of patterns) {
    const btn = page.getByRole("button", { name: pattern }).first();
    if (await tryClick(btn)) return true;
  }

  const fallbacks = [
    page.locator('.layui-btn-fluid, .layui-btn-normal, .layui-btn').filter({ hasText: /login|sign in|log in/i }).first(),
    page.locator(".el-button--primary").first(),
    page.locator('button[type="submit"], input[type="submit"]').first(),
  ];
  for (const loc of fallbacks) {
    if (await tryClick(loc)) return true;
  }
  return false;
}

async function refreshCaptchaImage(page: Page, log: PanelLoginLog): Promise<void> {
  const img = await findCaptchaImage(page);
  if (!img) return;
  await img.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  log("login", "refreshed CAPTCHA image");
}

/** Game Vault / Element Plus CAPTCHA imgs auto-refresh — element.screenshot() times out on "not stable". */
async function captureCaptchaPng(page: Page, captchaImg: Locator): Promise<Buffer | null> {
  const box = await captchaImg.boundingBox().catch(() => null);
  if (box && box.width >= 40 && box.height >= 15) {
    const clip = await page
      .screenshot({ clip: box, type: "png", timeout: 8000 })
      .catch(() => null);
    if (clip) return Buffer.from(clip);
  }

  const src = await captchaImg.getAttribute("src").catch(() => null);
  if (src) {
    try {
      const url = src.startsWith("http") ? src : new URL(src, page.url()).href;
      const res = await page.request.get(url);
      if (res.ok()) {
        const body = await res.body();
        if (body.length > 100) return Buffer.from(body);
      }
    } catch {
      /* fall through */
    }
  }

  const el = await captchaImg.screenshot({ type: "png", timeout: 8000 }).catch(() => null);
  return el ? Buffer.from(el) : null;
}

/** Stop auto-refreshing CAPTCHA while 2Captcha/OCR runs (Game Vault refreshes every ~1s). */
async function freezeCaptchaDisplay(captchaImg: Locator, png: Buffer): Promise<void> {
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  await captchaImg
    .evaluate((el, frozen) => {
      const img = el as HTMLImageElement;
      img.src = frozen;
      img.style.pointerEvents = "none";
    }, dataUrl)
    .catch(() => {});
}

async function attemptAutoCaptchaLogin(page: Page, options: PanelLoginOptions): Promise<boolean> {
  const { log, isLoginPage } = options;
  const patterns = options.loginButtonPatterns ?? DEFAULT_LOGIN_PATTERNS;

  const captchaImg = await findCaptchaImage(page);
  if (!captchaImg) {
    log("login", "auto captcha — no CAPTCHA image found on page");
    return false;
  }

  const captchaInput = await findCaptchaInput(page);
  if (!captchaInput) {
    log("login", "auto captcha — no CAPTCHA input found on page");
    return false;
  }

  const refreshPattern = /\/(api\/agent\/captcha|captcha|vcode|verifycode)/i;
  let blockCaptchaRefresh = false;
  await page.route(refreshPattern, async (route) => {
    if (blockCaptchaRefresh && route.request().resourceType() === "image") {
      await route.abort();
      return;
    }
    await route.continue();
  });

  try {
    const png = await captureCaptchaPng(page, captchaImg);
    if (!png) {
      log("login", "auto captcha — could not capture CAPTCHA image");
      return false;
    }

    blockCaptchaRefresh = true;
    await freezeCaptchaDisplay(captchaImg, png);

    let solution: string;
    try {
      const result = await solveCaptchaImage(png);
      solution = result.text;
      if (!solution || solution.length < 3) {
        log("login", "CAPTCHA read returned empty — skipping fill");
        return false;
      }
      log("login", `CAPTCHA read (${result.method}, ${solution.length} chars): ${solution}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("login", `CAPTCHA read failed: ${msg}`);
      return false;
    }

    await captchaInput.click().catch(() => {});
    await captchaInput.fill("");
    await captchaInput.fill(solution);

    const clicked = await clickLoginButton(page, patterns);
    if (!clicked) {
      log("login", "auto captcha — could not find Login button");
      return false;
    }

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    if (!(await isLoginPage(page))) {
      return true;
    }

    log("login", "still on login page after auto CAPTCHA — wrong code or bad credentials");
    return false;
  } finally {
    await page.unroute(refreshPattern).catch(() => {});
  }
}

async function waitForManualLoginOnly(page: Page, options: PanelLoginOptions): Promise<void> {
  const { log, isLoginPage } = options;
  const timeoutMs = options.manualTimeoutMs ?? 180_000;
  log("login", "CAPTCHA on page — log in manually in Chrome (enter code + click Login)");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isLoginPage(page))) return;
    await page.waitForTimeout(1000);
  }
  throw new Error("Login timeout — enter CAPTCHA and click Login in the Chrome window");
}

/**
 * Bot reads the CAPTCHA image (local OCR), submits login, then falls back to manual wait.
 */
export async function waitForPanelLogin(page: Page, options: PanelLoginOptions): Promise<void> {
  const { log, isLoginPage } = options;
  const allowManual = options.allowManual !== false;
  const maxRetries = captchaMaxRetries();

  if (isAutoCaptchaEnabled()) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      log("login", `reading CAPTCHA attempt ${attempt}/${maxRetries}`);
      const ok = await attemptAutoCaptchaLogin(page, options);
      if (ok) {
        log("login", "success (bot read CAPTCHA)");
        return;
      }
      if (attempt < maxRetries) {
        await refreshCaptchaImage(page, log);
        await page.waitForTimeout(500);
      }
    }
    log("login", "bot could not read CAPTCHA — needs manual login or CAPTCHA_API_KEY fallback");
  }

  if (allowManual) {
    await waitForManualLoginOnly(page, options);
    return;
  }

  if (!(await isLoginPage(page))) return;

  throw new Error(
    "Login failed — bot could not read CAPTCHA. Use CDP mode and log in manually in Chrome."
  );
}
