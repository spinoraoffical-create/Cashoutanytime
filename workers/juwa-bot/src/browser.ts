import { chromium, type Page } from "playwright";
import { join } from "path";
import { findPanelTab } from "../../shared/find-panel-tab.js";

export interface BrowserSession {
  page: Page;
  close: () => Promise<void>;
}

function envOptional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function launchOptions() {
  const headless = process.env.JUWA_HEADLESS !== "false";
  const proxy = envOptional("JUWA_PROXY");
  const browserKind = envOptional("JUWA_BROWSER") ?? "chrome";

  return {
    headless,
    slowMo: headless ? 0 : (process.env.BOT_SLOWMO ? Number(process.env.BOT_SLOWMO) : 100),
    ...(browserKind === "chromium" ? {} : { channel: browserKind as "chrome" }),
    proxy: proxy ? { server: proxy } : undefined,
    args: ["--disable-blink-features=AutomationControlled"],
  };
}

async function findJuwaPage(pages: Page[]): Promise<Page> {
  return findPanelTab(pages, {
    host: "juwa777.com",
    logPrefix: "[juwa]",
    panelName: "Juwa",
    panelUrlHint: "https://ht.juwa777.com/login",
  });
}

export async function openBrowserSession(): Promise<BrowserSession> {
  const cdpUrl = envOptional("JUWA_CDP_URL");
  const profileDir =
    envOptional("JUWA_CHROME_PROFILE_DIR") ?? join(process.cwd(), "chrome-bot-profile");

  if (cdpUrl) {
    console.log("[juwa] Connecting to your Chrome via CDP (VPN should already be on)…");
    try {
      const browser = await chromium.connectOverCDP(cdpUrl, { slowMo: process.env.BOT_SLOWMO ? Number(process.env.BOT_SLOWMO) : 100 });
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const pages = context.pages();
      const page = pages.length > 0 ? await findJuwaPage(pages) : await context.newPage();
      return {
        page,
        close: async () => {
          browser.close().catch(() => {});
        },
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("No Juwa tab")) throw err;
      throw new Error(
        "Could not connect to Chrome on port 9222. Run start-chrome-for-bot.bat first, connect VPN, then start the bot."
      );
    }
  }

  console.log("[juwa] Launching Google Chrome with bot profile…");
  const context = await chromium.launchPersistentContext(profileDir, {
    ...launchOptions(),
    viewport: { width: 1366, height: 900 },
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const pages = context.pages();
  const page = pages.length > 0 ? await findJuwaPage(pages) : await context.newPage();
  return {
    page,
    close: async () => {
      await context.close();
    },
  };
}

export function vpnHint(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("ERR_CONNECTION_REFUSED") ||
    msg.includes("ERR_CONNECTION_RESET") ||
    msg.includes("ERR_NAME_NOT_RESOLVED") ||
    msg.includes("ERR_TIMED_OUT") ||
    msg.includes("net::ERR")
  ) {
    return (
      `${msg}\n\n` +
      "VPN fix: connect VPN in the bot Chrome window, then retry.\n" +
      "Run start-chrome-for-bot.bat → connect VPN → open Juwa → start-bot.bat"
    );
  }
  return msg;
}
