import type { Page } from "playwright";

export type PanelTabOptions = {
  /** e.g. "gameroom777.com" */
  host: string;
  logPrefix: string;
  /** Human label for error messages */
  panelName: string;
  /** Optional direct URL hint in errors */
  panelUrlHint?: string;
};

/**
 * Pick the correct Chrome tab for a game panel — host URL match ONLY.
 * Never falls back to generic titles like "Management System" (shared across games).
 */
export async function findPanelTab(pages: Page[], opts: PanelTabOptions): Promise<Page> {
  const { host, logPrefix, panelName, panelUrlHint } = opts;

  const dashboard = pages.find((p) => {
    const url = p.url();
    return (
      url.includes(host) &&
      !url.includes("about:") &&
      !url.startsWith("chrome-error:") &&
      (/\/admin\/?$/i.test(url) ||
        url.includes("/HomeDetail") ||
        url.includes("/userManagement") ||
        (url.includes("/admin") && !url.includes("/login")))
    );
  });
  if (dashboard) {
    console.log(`${logPrefix} Using tab:`, dashboard.url());
    await dashboard.bringToFront();
    return dashboard;
  }

  const playerList = pages.find((p) => {
    const url = p.url();
    return url.includes(host) && /player\/index/i.test(url);
  });
  if (playerList) {
    console.log(`${logPrefix} Using tab (User List):`, playerList.url());
    await playerList.bringToFront();
    return playerList;
  }

  for (const page of pages) {
    const url = page.url();
    if (url.includes(host) && !url.includes("about:") && !url.startsWith("chrome-error:")) {
      console.log(`${logPrefix} Using tab:`, url);
      await page.bringToFront();
      return page;
    }
  }

  const hint = panelUrlHint ? ` Open ${panelUrlHint} in the unified Chrome (port 9222).` : "";
  throw new Error(
    `No ${panelName} tab found in Chrome.${hint} Run start-unified-chrome.bat and log in on the correct tab.`
  );
}
