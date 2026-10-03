/**
 * Opens all agent panel tabs in the unified Spinora bot Chrome (port 9222).
 * Run via workers/start-unified-chrome.bat (must live under juwa-bot for playwright).
 */
import { chromium } from "playwright";

const CDP = process.env.SPINORA_CDP_URL?.trim() || "http://127.0.0.1:9222";
const TAB_DELAY_MS = Number(process.env.SPINORA_TAB_DELAY_MS ?? 1500);

const PANELS = [
  { name: "Juwa", host: "juwa777.com", url: "https://ht.juwa777.com/login" },
  { name: "Vegas Sweeps", host: "lasvegassweeps.com", url: "https://agent.lasvegassweeps.com/login" },
  { name: "Game Vault", host: "gamevault999.com", url: "https://agent.gamevault999.com/login" },
  { name: "Gameroom", host: "gameroom777.com", url: "https://agentserver1.gameroom777.com/admin" },
  { name: "Cash Machine", host: "cashmachine777.com", url: "https://agentserver.cashmachine777.com/admin" },
  { name: "MR All-in-One", host: "mrallinone777.com", url: "https://agentserver.mrallinone777.com/admin" },
  { name: "Mafia", host: "mafia77777.com", url: "https://agentserver.mafia77777.com/admin" },
  { name: "Cash Frenzy", host: "cashfrenzy777.com", url: "https://agentserver.cashfrenzy777.com/admin" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pageForHost(pages, host) {
  return pages.find((p) => {
    try {
      const url = p.url();
      return (
        url.includes(host) &&
        !url.includes("about:") &&
        !url.startsWith("chrome-error:") &&
        !url.startsWith("chrome://")
      );
    } catch {
      return false;
    }
  });
}

async function openPanel(context, panel, force = false) {
  let pages = context.pages();
  let page = pageForHost(pages, panel.host);

  if (page && !force) {
    console.log(`[ok] ${panel.name} — ${page.url()}`);
    await page.bringToFront().catch(() => {});
    return page;
  }

  if (!page) {
    page = await context.newPage();
  }

  console.log(`[open] ${panel.name} → ${panel.url}`);
  await page.bringToFront().catch(() => {});
  await page.goto(panel.url, { waitUntil: "domcontentloaded", timeout: 120000 }).catch((e) => {
    console.warn(`[warn] ${panel.name} goto: ${e instanceof Error ? e.message : e}`);
  });
  await sleep(TAB_DELAY_MS);
  return page;
}

let browser;
try {
  browser = await chromium.connectOverCDP(CDP, { timeout: 20000 });
} catch (err) {
  console.error(`\nCould not connect to Chrome at ${CDP}.`);
  console.error("Close other Chromes on port 9222, run start-unified-chrome.bat again.\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const context = browser.contexts()[0] ?? (await browser.newContext());

for (const panel of PANELS) {
  await openPanel(context, panel);
}

await sleep(2000);

const missing = [];
for (const panel of PANELS) {
  if (!pageForHost(context.pages(), panel.host)) {
    missing.push(panel);
  }
}

if (missing.length > 0) {
  console.log(`\n[retry] ${missing.length} panel(s) still missing — opening again...\n`);
  for (const panel of missing) {
    await openPanel(context, panel, true);
  }
}

console.log("\n========== TAB CHECK ==========");
let allOk = true;
for (const panel of PANELS) {
  const hit = pageForHost(context.pages(), panel.host);
  if (hit) {
    console.log(`  OK  ${panel.name.padEnd(16)} ${hit.url().slice(0, 60)}`);
  } else {
    allOk = false;
    console.log(`  !!  ${panel.name.padEnd(16)} MISSING — open manually: ${panel.url}`);
  }
}
console.log("================================\n");

if (allOk) {
  console.log("All 8 tabs ready. Log in on each, then run start-all-bots-unified.bat");
  process.exit(0);
} else {
  console.log("Some tabs missing. Check VPN for Juwa/Vegas, then re-run start-unified-chrome.bat");
  process.exit(1);
}
