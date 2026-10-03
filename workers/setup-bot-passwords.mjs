import fs from "fs";
import path from "path";
import readline from "readline";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const botDirs = [
  { name: "juwa-bot", dir: "juwa-bot", userKey: "JUWA_AGENT_USERNAME", passKey: "JUWA_AGENT_PASSWORD" },
  { name: "vegas-bot", dir: "vegas-bot", userKey: "VEGAS_AGENT_USERNAME", passKey: "VEGAS_AGENT_PASSWORD" },
  { name: "gamevault-bot", dir: "gamevault-bot", userKey: "GAMEVAULT_AGENT_USERNAME", passKey: "GAMEVAULT_AGENT_PASSWORD" },
  { name: "gameroom-bot", dir: "gameroom-bot", userKey: "GAMEROOM_AGENT_USERNAME", passKey: "GAMEROOM_AGENT_PASSWORD" },
  { name: "cashmachine-bot", dir: "cashmachine-bot", userKey: "CASHMACHINE_AGENT_USERNAME", passKey: "CASHMACHINE_AGENT_PASSWORD" },
  { name: "mr-all-in-one-bot", dir: "mr-all-in-one-bot", userKey: "MRALLINONE_AGENT_USERNAME", passKey: "MRALLINONE_AGENT_PASSWORD" },
  { name: "mafia-bot", dir: "mafia-bot", userKey: "MAFIA_AGENT_USERNAME", passKey: "MAFIA_AGENT_PASSWORD" },
  { name: "cash-frenzy-bot", dir: "cash-frenzy-bot", userKey: "CASHFRENZY_AGENT_USERNAME", passKey: "CASHFRENZY_AGENT_PASSWORD" },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("==================================================");
  console.log("🔑 SPINORA AUTOMATIC AGENT LOGIN SETUP 🔑");
  console.log("Enter your agent panel credentials once.");
  console.log("Bots will automatically log in with CAPTCHA OCR!");
  console.log("==================================================\n");

  try {
    execSync("node sync-bot-env.mjs", { cwd: ROOT_DIR, stdio: "inherit" });
  } catch {
    console.warn("Note: sync-bot-env.mjs failed — ensure workers/.env exists.\n");
  }

  const mode = await askQuestion(
    "Use same Username & Password for ALL 8 games? (y/n) [default: y]: "
  );

  if (mode.trim().toLowerCase() !== "n") {
    const user = await askQuestion("Enter Master Agent Username: ");
    const pass = await askQuestion("Enter Master Agent Password: ");

    for (const b of botDirs) {
      updateEnv(b.dir, b.userKey, b.passKey, user.trim(), pass.trim());
      console.log(`✅ ${b.name}: Auto-login configured`);
    }
  } else {
    for (const b of botDirs) {
      console.log(`\n--- Config for ${b.name} ---`);
      const user = await askQuestion(`Username for ${b.name}: `);
      const pass = await askQuestion(`Password for ${b.name}: `);
      updateEnv(b.dir, b.userKey, b.passKey, user.trim(), pass.trim());
      console.log(`✅ ${b.name}: Auto-login configured`);
    }
  }

  console.log("\n🎉 ALL 8 BOTS CONFIGURED FOR 100% AUTOMATIC LOGIN!");
  console.log("Now run start-all-advanced-free.bat — bots will log in automatically!");
  rl.close();
}

function updateEnv(botFolder, userKey, passKey, username, password) {
  let fullPath = path.resolve(ROOT_DIR, botFolder, ".env");
  if (!fs.existsSync(path.dirname(fullPath))) {
    fullPath = path.resolve("workers", botFolder, ".env");
  }

  let content = "";
  if (fs.existsSync(fullPath)) {
    content = fs.readFileSync(fullPath, "utf8");
  }

  const lines = content
    .split("\n")
    .filter(
      (l) =>
        !l.startsWith("PANEL_USERNAME=") &&
        !l.startsWith("PANEL_PASSWORD=") &&
        !l.startsWith(`${userKey}=`) &&
        !l.startsWith(`${passKey}=`)
    );

  lines.push(`PANEL_USERNAME=${username}`);
  lines.push(`PANEL_PASSWORD=${password}`);
  lines.push(`${userKey}=${username}`);
  lines.push(`${passKey}=${password}`);

  fs.writeFileSync(fullPath, lines.join("\n"), "utf8");
}

main();
