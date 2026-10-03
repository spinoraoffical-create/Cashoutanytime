import type { Locator, Page } from "playwright";

/** Panels show this when the agent session idle-times out (Element Plus + layui). */
const SESSION_EXPIRED_RE =
  /timed?\s*out|log\s*in\s*again|session\s*expired|please\s*log\s*in|login\s*again|重新登录/i;

export type SessionLog = (step: string, detail?: string) => void;

async function visibleModalRoots(page: Page): Promise<Locator[]> {
  const roots: Locator[] = [];
  const selectors = [
    ".el-message-box",
    ".el-overlay .el-dialog",
    ".el-dialog",
    ".layui-layer-dialog",
    ".layui-layer",
    "[role='dialog']",
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel).filter({ hasText: SESSION_EXPIRED_RE });
    const count = await loc.count();
    for (let i = 0; i < count; i++) {
      const item = loc.nth(i);
      if (await item.isVisible().catch(() => false)) roots.push(item);
    }
  }
  return roots;
}

/** True when the "Message timed out, please log in again!" dialog is on screen. */
export async function isSessionExpiredVisible(page: Page): Promise<boolean> {
  const roots = await visibleModalRoots(page);
  return roots.length > 0;
}

async function clickConfirmOnModal(modal: Locator): Promise<boolean> {
  const confirmPatterns = /^\s*(confirm|ok|yes|确定|知道了)\s*$/i;
  const candidates: Locator[] = [
    modal.getByRole("button", { name: confirmPatterns }),
    modal.locator("button, .layui-btn, a").filter({ hasText: confirmPatterns }),
    modal.locator(".el-message-box__btns .el-button--primary"),
    modal.locator(".el-dialog__footer .el-button--primary"),
    modal.locator(".layui-layer-btn .layui-layer-btn0"),
    modal.locator(".layui-layer-btn a").first(),
  ];

  for (const btn of candidates) {
    if ((await btn.count()) === 0) continue;
    const first = btn.first();
    if (!(await first.isVisible().catch(() => false))) continue;
    await first.click({ force: true, timeout: 5000 }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Dismiss the session-timeout modal (click Confirm) so the login form can appear.
 * Returns true when a timeout dialog was found and dismissed.
 */
export async function dismissSessionExpiredModal(page: Page, log?: SessionLog): Promise<boolean> {
  const roots = await visibleModalRoots(page);
  if (roots.length === 0) return false;

  log?.("session", "session expired — clicking Confirm and preparing re-login");

  for (const modal of roots) {
    await clickConfirmOnModal(modal);
  }

  await page.waitForTimeout(1200);
  await page.waitForLoadState("domcontentloaded", { timeout: 12_000 }).catch(() => {});
  return true;
}

/**
 * If the session timed out, dismiss the modal and run the panel login flow (incl. CAPTCHA).
 */
export async function recoverExpiredPanelSession(
  page: Page,
  loginToPanel: (page: Page) => Promise<void>,
  log?: SessionLog
): Promise<boolean> {
  if (!(await dismissSessionExpiredModal(page, log))) return false;
  await loginToPanel(page);
  return true;
}
