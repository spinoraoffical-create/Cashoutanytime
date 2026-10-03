/**
 * Live status for all 8 game bots:
 * - CAPTCHA auto-solve config
 * - Chrome tab / login state (port 9222)
 * - Supabase heartbeats (bot running?)
 * - Pending jobs in queue (will bot pick them up?)
 *
 * Usage: node scripts/check-bots-live.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WORKERS = path.join(ROOT, "..");

const BOTS = [
  { name: "Juwa", slug: "juwa", host: "juwa777.com", agentKey: "JUWA_AGENT_USERNAME" },
  { name: "Vegas", slug: "vegas-sweeps", host: "lasvegassweeps.com", agentKey: "VEGAS_AGENT_USERNAME" },
  { name: "Game Vault", slug: "game-vault", host: "gamevault999.com", agentKey: "GAMEVAULT_AGENT_USERNAME" },
  { name: "Gameroom", slug: "gameroom", host: "gameroom777.com", agentKey: "GAMEROOM_AGENT_USERNAME" },
  { name: "Cash Machine", slug: "cash-machine", host: "cashmachine777.com", agentKey: "CASHMACHINE_AGENT_USERNAME" },
  { name: "MR All-in-One", slug: "mr-all-in-one", host: "mrallinone777.com", agentKey: "MRALLINONE_AGENT_USERNAME" },
  { name: "Mafia", slug: "mafia", host: "mafia77777.com", agentKey: "MAFIA_AGENT_USERNAME" },
  { name: "Cash Frenzy", slug: "cash-frenzy", host: "cashfrenzy777.com", agentKey: "CASHFRENZY_AGENT_USERNAME" },
];

function parseEnv(filePath) {
  const map = new Map();
  if (!fs.existsSync(filePath)) return map;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(t.slice(0, eq).trim(), val);
  }
  return map;
}

function hasRealKey(map, key) {
  const v = map.get(key)?.trim();
  return Boolean(v && !v.includes("your_") && v.length > 8);
}

function tabLoginState(url) {
  if (!url || url.includes("about:") || url.startsWith("chrome-error:")) return "no tab";
  if (!url.includes("/login") && (url.includes("/HomeDetail") || url.includes("/userManagement") || /player\/index/i.test(url) || (url.includes("/admin") && !url.includes("/login")))) {
    return "logged in";
  }
  if (url.includes("/login")) return "login page";
  return "unknown page";
}

async function fetchChromeTabs() {
  try {
    const res = await fetch("http://127.0.0.1:9222/json/list", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function fmtAgo(iso) {
  if (!iso) return "never";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

async function main() {
  const sharedEnv = parseEnv(path.join(WORKERS, ".env"));

  console.log("\n============================================================");
  console.log("  SPINORA — LIVE BOT CHECK (CAPTCHA + jobs + Chrome)");
  console.log("============================================================\n");

  // --- CAPTCHA ---
  const captchaAuto = (sharedEnv.get("CAPTCHA_AUTO") ?? "true").toLowerCase();
  const captchaOn = !["false", "0", "off", "no"].includes(captchaAuto);
  const captchaSolver = sharedEnv.get("CAPTCHA_SOLVER") ?? "2captcha";
  const hasCaptchaKey = hasRealKey(sharedEnv, "CAPTCHA_API_KEY");

  console.log("  CAPTCHA AUTO-SOLVE");
  console.log(`    CAPTCHA_AUTO     = ${sharedEnv.get("CAPTCHA_AUTO") ?? "true (default)"}  →  ${captchaOn ? "ON (bots will try OCR + 2Captcha)" : "OFF (manual login only)"}`);
  console.log(`    CAPTCHA_SOLVER   = ${captchaSolver}`);
  console.log(`    CAPTCHA_API_KEY  = ${hasCaptchaKey ? "set ✓" : "MISSING ✗"}`);
  if (captchaOn && !hasCaptchaKey) {
    console.log("    ⚠ Auto CAPTCHA enabled but no API key — only local OCR will run (often fails).");
  }
  console.log("");

  // --- Chrome ---
  const tabs = await fetchChromeTabs();
  if (!tabs) {
    console.log("  CHROME: NOT RUNNING on port 9222");
    console.log("    → Run: workers\\start-unified-chrome.bat\n");
  } else {
    console.log(`  CHROME: running (${tabs.length} tabs on port 9222)\n`);
  }

  // --- Supabase heartbeats + pending jobs ---
  const url = sharedEnv.get("NEXT_PUBLIC_SUPABASE_URL") ?? sharedEnv.get("SUPABASE_URL");
  const key = sharedEnv.get("SUPABASE_SERVICE_ROLE_KEY");
  let heartbeats = new Map();
  let pendingBySlug = new Map();

  if (url && hasRealKey(sharedEnv, "SUPABASE_SERVICE_ROLE_KEY")) {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await db
      .from("system_health_logs")
      .select("cron_metrics, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    for (const row of rows ?? []) {
      const m = row.cron_metrics;
      const slug = m?.bot?.trim();
      if (!slug || heartbeats.has(slug)) continue;
      heartbeats.set(slug, {
        status: m?.status ?? "online",
        jobs: Number(m?.jobsProcessed ?? 0),
        ping: m?.ping ?? row.created_at,
      });
    }

    const { data: pending } = await db
      .from("game_load_requests")
      .select("game_slug, status")
      .in("status", ["pending", "processing"]);

    for (const row of pending ?? []) {
      const slug = row.game_slug;
      pendingBySlug.set(slug, (pendingBySlug.get(slug) ?? 0) + 1);
    }
  } else {
    console.log("  SUPABASE: missing URL or SERVICE_ROLE_KEY in workers/.env\n");
  }

  // --- Per-bot table ---
  console.log("  BOT          | CHROME TAB      | WORKER        | JOBS DONE | QUEUE");
  console.log("  -------------|-----------------|---------------|-----------|------");

  for (const bot of BOTS) {
    const dirMap = {
      juwa: "juwa-bot",
      "vegas-sweeps": "vegas-bot",
      "game-vault": "gamevault-bot",
      gameroom: "gameroom-bot",
      "cash-machine": "cashmachine-bot",
      "mr-all-in-one": "mr-all-in-one-bot",
      mafia: "mafia-bot",
      "cash-frenzy": "cash-frenzy-bot",
    };
    const botDirEnv = parseEnv(path.join(WORKERS, dirMap[bot.slug], ".env"));
    const merged = new Map([...sharedEnv, ...botDirEnv]);
    const hasAgent = hasRealKey(merged, bot.agentKey) || hasRealKey(merged, "PANEL_USERNAME");

    let chromeState = "no chrome";
    if (tabs) {
      const matching = tabs.filter((t) => t.url?.includes(bot.host));
      if (matching.length === 0) {
        chromeState = "no tab";
      } else {
        const best = matching.find((t) => tabLoginState(t.url) === "logged in") ?? matching[0];
        chromeState = tabLoginState(best.url);
      }
    }

    const hb = heartbeats.get(bot.slug);
    let workerState = "offline";
    if (hb) {
      const sec = Math.floor((Date.now() - new Date(hb.ping).getTime()) / 1000);
      workerState = sec <= 90 ? hb.status : "offline";
    }
    const workerLabel = workerState === "offline" ? "offline" : `${workerState} (${fmtAgo(hb?.ping)})`;

    const jobsDone = hb?.jobs ?? 0;
    const queue = pendingBySlug.get(bot.slug) ?? 0;
    const agentOk = hasAgent ? "" : " ⚠no login";

    const pad = (s, n) => String(s).padEnd(n).slice(0, n);
    console.log(
      `  ${pad(bot.name, 12)} | ${pad(chromeState, 15)} | ${pad(workerLabel, 13)} | ${pad(jobsDone, 9)} | ${queue}${agentOk}`
    );
  }

  console.log("\n============================================================");
  console.log("  HOW TO READ THIS");
  console.log("============================================================");
  console.log("  CHROME TAB");
  console.log("    logged in  = panel ready for loads/balance");
  console.log("    login page = needs manual login OR CAPTCHA_AUTO=true + API key");
  console.log("  WORKER");
  console.log("    idle/online = bot process running + polling Supabase");
  console.log("    offline     = run restart-bots-stable.bat (watchdog window)");
  console.log("  JOBS DONE = total completed since bot started (increments when jobs work)");
  console.log("  QUEUE     = pending jobs waiting — if >0 and worker offline, bot won't run them");
  console.log("\n  Admin UI: http://localhost:3000/admin/bot-status");
  console.log("  Test job: request $5 load → watch QUEUE then JOBS DONE increase");
  console.log("============================================================\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
