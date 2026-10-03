/**
 * Pre-flight smoke check for all 8 game bots (env, deps, optional Chrome CDP).
 * Usage: node scripts/smoke-check.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WORKERS = path.join(ROOT, "..");

const BOTS = [
  { name: "Juwa", dir: "juwa-bot", agentUser: "JUWA_AGENT_USERNAME" },
  { name: "Vegas", dir: "vegas-bot", agentUser: "VEGAS_AGENT_USERNAME" },
  { name: "Game Vault", dir: "gamevault-bot", agentUser: "GAMEVAULT_AGENT_USERNAME" },
  { name: "Gameroom", dir: "gameroom-bot", agentUser: "GAMEROOM_AGENT_USERNAME" },
  { name: "Cash Machine", dir: "cashmachine-bot", agentUser: "CASHMACHINE_AGENT_USERNAME" },
  { name: "MR All-in-One", dir: "mr-all-in-one-bot", agentUser: "MRALLINONE_AGENT_USERNAME" },
  { name: "Mafia", dir: "mafia-bot", agentUser: "MAFIA_AGENT_USERNAME" },
  { name: "Cash Frenzy", dir: "cash-frenzy-bot", agentUser: "CASHFRENZY_AGENT_USERNAME" },
];

function parseEnv(filePath) {
  const map = new Map();
  if (!fs.existsSync(filePath)) return map;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    map.set(t.slice(0, eq).trim(), t.slice(eq + 1).trim());
  }
  return map;
}

function hasRealKey(map, key) {
  const v = map.get(key)?.trim();
  return Boolean(v && !v.includes("your_") && v.length > 8);
}

async function chromeOk(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let pass = 0;
let warn = 0;
let fail = 0;

console.log("\n============================================================");
console.log("  SPINORA BOT SMOKE CHECK");
console.log("============================================================\n");

if (!fs.existsSync(path.join(WORKERS, ".env"))) {
  console.log("  [FAIL] workers/.env missing — copy from .env.example");
  fail++;
} else {
  console.log("  [OK]   workers/.env exists");
  pass++;
}

const chromeRunning = await chromeOk(9222);
if (chromeRunning) {
  console.log("  [OK]   Chrome CDP on port 9222");
  pass++;
} else {
  console.log("  [WARN] Chrome not on 9222 — run start-unified-chrome.bat");
  warn++;
}

console.log("");

for (const bot of BOTS) {
  const botDir = path.join(WORKERS, bot.dir);
  const envPath = path.join(botDir, ".env");
  const issues = [];

  if (!fs.existsSync(path.join(botDir, "package.json"))) {
    issues.push("missing folder");
    fail++;
  } else if (!fs.existsSync(envPath)) {
    issues.push("no .env");
    warn++;
  } else {
    const env = parseEnv(envPath);
    if (!hasRealKey(env, "SUPABASE_SERVICE_ROLE_KEY")) issues.push("no Supabase key");
    if (!hasRealKey(env, "CAPTCHA_API_KEY")) issues.push("no CAPTCHA key");
    const hasAgent =
      hasRealKey(env, bot.agentUser) ||
      hasRealKey(env, "PANEL_USERNAME");
    if (!hasAgent) issues.push("no agent login");
    if (!fs.existsSync(path.join(botDir, "node_modules"))) issues.push("npm install needed");

    if (issues.length === 0) {
      pass++;
      console.log(`  [OK]   ${bot.name} (${bot.dir})`);
    } else if (issues.some((i) => i.includes("missing folder"))) {
      console.log(`  [FAIL] ${bot.name} — ${issues.join(", ")}`);
    } else {
      warn++;
      console.log(`  [WARN] ${bot.name} — ${issues.join(", ")}`);
    }
  }
}

console.log("\n============================================================");
console.log(`  SUMMARY: ${pass} passed | ${warn} warnings | ${fail} failed`);
console.log("============================================================\n");

if (fail > 0) process.exit(1);
process.exit(0);
