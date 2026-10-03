import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_ENV = path.join(ROOT_DIR, ".env");

const BOTS = [
  { name: "juwa-bot", dir: "juwa-bot" },
  { name: "vegas-bot", dir: "vegas-bot" },
  { name: "gamevault-bot", dir: "gamevault-bot" },
  { name: "gameroom-bot", dir: "gameroom-bot" },
  { name: "cashmachine-bot", dir: "cashmachine-bot" },
  { name: "mr-all-in-one-bot", dir: "mr-all-in-one-bot" },
  { name: "mafia-bot", dir: "mafia-bot" },
  { name: "cash-frenzy-bot", dir: "cash-frenzy-bot" },
];

const isWin = process.platform === "win32";
const processes = new Map();

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1);
  }
  return env;
}

/** Shared env from workers/.env — Supabase, CAPTCHA, site URL. */
const sharedEnv = parseEnvFile(ROOT_ENV);

const cdpEnv = {
  JUWA_CDP_URL: "http://127.0.0.1:9222",
  VEGAS_CDP_URL: "http://127.0.0.1:9222",
  GAMEVAULT_CDP_URL: "http://127.0.0.1:9222",
  GAMEROOM_CDP_URL: "http://127.0.0.1:9222",
  CASHMACHINE_CDP_URL: "http://127.0.0.1:9222",
  MRALLINONE_CDP_URL: "http://127.0.0.1:9222",
  MAFIA_CDP_URL: "http://127.0.0.1:9222",
  CASHFRENZY_CDP_URL: "http://127.0.0.1:9222",
  JUWA_HEADLESS: "false",
  VEGAS_HEADLESS: "false",
  GAMEVAULT_HEADLESS: "false",
  GAMEROOM_HEADLESS: "false",
  CASHMACHINE_HEADLESS: "false",
  MRALLINONE_HEADLESS: "false",
  MAFIA_HEADLESS: "false",
  CASHFRENZY_HEADLESS: "false",
  CAPTCHA_AUTO: sharedEnv.CAPTCHA_AUTO ?? "true",
  CAPTCHA_MAX_RETRIES: sharedEnv.CAPTCHA_MAX_RETRIES ?? "5",
  CAPTCHA_SOLVER: sharedEnv.CAPTCHA_SOLVER ?? "2captcha",
  ...(sharedEnv.CAPTCHA_API_KEY ? { CAPTCHA_API_KEY: sharedEnv.CAPTCHA_API_KEY } : {}),
  ...(sharedEnv.SUPABASE_URL ? { SUPABASE_URL: sharedEnv.SUPABASE_URL } : {}),
  ...(sharedEnv.NEXT_PUBLIC_SUPABASE_URL
    ? { NEXT_PUBLIC_SUPABASE_URL: sharedEnv.NEXT_PUBLIC_SUPABASE_URL }
    : {}),
  ...(sharedEnv.SUPABASE_SERVICE_ROLE_KEY
    ? { SUPABASE_SERVICE_ROLE_KEY: sharedEnv.SUPABASE_SERVICE_ROLE_KEY }
    : {}),
  SESSION_CHECK_MS: sharedEnv.SESSION_CHECK_MS ?? "120000",
  BOT_POLL_MS: sharedEnv.BOT_POLL_MS ?? "2500",
};

function startBot(bot) {
  console.log(`[WATCHDOG] 🚀 Starting ${bot.name}...`);

  const botDir = path.resolve(ROOT_DIR, bot.dir);
  const command = isWin ? "cmd.exe" : "npx";
  const args = isWin ? ["/c", "npx", "tsx", "src/index.ts"] : ["tsx", "src/index.ts"];

  const child = spawn(command, args, {
    cwd: botDir,
    stdio: "inherit",
    env: { ...process.env, ...sharedEnv, ...cdpEnv },
  });

  processes.set(bot.name, child);

  child.on("exit", (code, signal) => {
    console.warn(
      `[WATCHDOG] ⚠️ ${bot.name} exited with code ${code} (signal: ${signal}). Auto-restarting in 3 seconds...`
    );
    processes.delete(bot.name);
    setTimeout(() => startBot(bot), 3000);
  });

  child.on("error", (err) => {
    console.error(`[WATCHDOG] ❌ Error starting ${bot.name}:`, err.message);
  });
}

console.log("==========================================");
console.log("🛡️ SPINORA ADVANCED ZERO-COST BOT WATCHDOG 🛡️");
console.log("Auto-monitors & restarts game bots 24/7");
if (sharedEnv.CAPTCHA_API_KEY) {
  console.log(`CAPTCHA: ${sharedEnv.CAPTCHA_SOLVER ?? "2captcha"} API key loaded`);
} else {
  console.warn("WARNING: CAPTCHA_API_KEY not found in workers/.env — run sync-bot-env.mjs");
}
console.log("==========================================");

for (const bot of BOTS) {
  const index = BOTS.indexOf(bot);
  setTimeout(() => startBot(bot), index * 4000);
}

process.on("SIGINT", () => {
  console.log("[WATCHDOG] Stopping all bot workers gracefully...");
  for (const [, child] of processes.entries()) {
    child.kill();
  }
  process.exit(0);
});
