import type { Page } from "playwright";

/** Open browser, log in (incl. CAPTCHA OCR), keep Chrome open in CDP mode. */
export async function ensurePanelSession(
  openBrowserSession: () => Promise<{ page: Page; close: () => Promise<void> }>,
  cdpEnvVar: string,
  loginToPanel: (page: Page) => Promise<void>
): Promise<void> {
  const session = await openBrowserSession();
  try {
    await loginToPanel(session.page);
  } finally {
    if (!process.env[cdpEnvVar]?.trim()) {
      await session.close();
    }
  }
}
