/**
 * Copy shared keys from workers/.env into each bot's .env.
 * Preserves bot-specific keys (agent credentials, CDP URLs, poll intervals).
 *
 * Usage: node sync-bot-env.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_ENV = path.join(ROOT_DIR, ".env");

const BOT_DIRS = [
  "juwa-bot",
  "vegas-bot",
  "gamevault-bot",
  "gameroom-bot",
  "cashmachine-bot",
  "mr-all-in-one-bot",
  "mafia-bot",
  "cash-frenzy-bot",
];

/** Keys copied from workers/.env into every bot folder. */
const SHARED_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CAPTCHA_SOLVER",
  "CAPTCHA_API_KEY",
  "CAPTCHA_AUTO",
  "CAPTCHA_MAX_RETRIES",
  "CAPTCHA_POLL_MS",
  "CAPTCHA_TIMEOUT_MS",
  "SESSION_CHECK_MS",
  "SESSION_KEEPER",
  "BOT_POLL_MS",
  "BOT_SLOWMO",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
];

const AGENT_KEY_SUFFIXES = ["_AGENT_USERNAME", "_AGENT_PASSWORD"];

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1));
  }
  return map;
}

function hasAgentCredentials(map) {
  if (map.get("PANEL_USERNAME")?.trim() && map.get("PANEL_PASSWORD")?.trim()) return true;
  for (const key of map.keys()) {
    if (AGENT_KEY_SUFFIXES.some((s) => key.endsWith(s)) && map.get(key)?.trim()) return true;
  }
  return false;
}

function mergeBotEnv(botDir, rootMap) {
  const botEnvPath = path.join(ROOT_DIR, botDir, ".env");
  const botMap = fs.existsSync(botEnvPath)
    ? parseEnv(fs.readFileSync(botEnvPath, "utf8"))
    : new Map();

  const botSpecific = new Map();
  for (const [key, value] of botMap) {
    if (!SHARED_KEYS.includes(key)) botSpecific.set(key, value);
  }

  const merged = new Map(botSpecific);

  for (const key of SHARED_KEYS) {
    const rootVal = rootMap.get(key)?.trim();
    if (rootVal) merged.set(key, rootVal);
  }

  const supabaseUrl =
    merged.get("SUPABASE_URL")?.trim() ||
    merged.get("NEXT_PUBLIC_SUPABASE_URL")?.trim() ||
    rootMap.get("SUPABASE_URL")?.trim() ||
    rootMap.get("NEXT_PUBLIC_SUPABASE_URL")?.trim();
  if (supabaseUrl) {
    merged.set("SUPABASE_URL", supabaseUrl);
    merged.set("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
  }

  const siteUrl =
    merged.get("NEXT_PUBLIC_SITE_URL")?.trim() ||
    merged.get("NEXT_PUBLIC_APP_URL")?.trim() ||
    rootMap.get("NEXT_PUBLIC_SITE_URL")?.trim() ||
    rootMap.get("NEXT_PUBLIC_APP_URL")?.trim();
  if (siteUrl) {
    merged.set("NEXT_PUBLIC_SITE_URL", siteUrl);
    merged.set("NEXT_PUBLIC_APP_URL", siteUrl);
  }

  if (!merged.get("CAPTCHA_AUTO")?.trim()) merged.set("CAPTCHA_AUTO", "true");
  if (!merged.get("CAPTCHA_MAX_RETRIES")?.trim()) merged.set("CAPTCHA_MAX_RETRIES", "5");
  if (!merged.get("CAPTCHA_SOLVER")?.trim() && rootMap.get("CAPTCHA_SOLVER")?.trim()) {
    merged.set("CAPTCHA_SOLVER", rootMap.get("CAPTCHA_SOLVER").trim());
  }

  const lines = [];
  for (const [key, value] of botSpecific) lines.push(`${key}=${value}`);
  for (const key of SHARED_KEYS) {
    if (merged.has(key)) lines.push(`${key}=${merged.get(key)}`);
  }

  fs.writeFileSync(botEnvPath, `${lines.join("\n")}\n`, "utf8");

  return {
    botDir,
    hasSupabase: Boolean(
      merged.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() &&
        !merged.get("SUPABASE_SERVICE_ROLE_KEY").includes("your_service_role")
    ),
    hasCaptcha: Boolean(merged.get("CAPTCHA_API_KEY")?.trim()),
    hasAgent: hasAgentCredentials(merged),
  };
}

function main() {
  console.log("==================================================");
  console.log("  SPINORA — SYNC workers/.env → all bot .env files");
  console.log("==================================================\n");

  if (!fs.existsSync(ROOT_ENV)) {
    console.error("ERROR: workers/.env not found. Create it with Supabase + CAPTCHA keys first.");
    process.exit(1);
  }

  const rootMap = parseEnv(fs.readFileSync(ROOT_ENV, "utf8"));
  const results = BOT_DIRS.map((dir) => mergeBotEnv(dir, rootMap));

  for (const r of results) {
    const flags = [
      r.hasSupabase ? "supabase OK" : "supabase MISSING",
      r.hasCaptcha ? "captcha OK" : "captcha MISSING",
      r.hasAgent ? "agent OK" : "agent MISSING — run set-bot-credentials.bat",
    ];
    console.log(`  ✅ ${r.botDir}: ${flags.join(" | ")}`);
  }

  const missingAgent = results.filter((r) => !r.hasAgent);
  console.log("\n==================================================");
  if (missingAgent.length) {
    console.log(`  Synced 8 bots. ${missingAgent.length} still need agent login credentials.`);
    console.log("  Run: set-bot-credentials.bat");
  } else {
    console.log("  Synced 8 bots — Supabase + CAPTCHA keys copied.");
  }
  console.log("==================================================\n");
}

main();
