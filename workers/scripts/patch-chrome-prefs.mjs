/**
 * Disable Chrome "password found in a data breach" popups for bot profiles.
 * Chrome checks typed passwords against Google's breach list — bot accounts often
 * use password=username or patterns like "player1" that trigger false positives.
 *
 * Usage: node patch-chrome-prefs.mjs "%LOCALAPPDATA%\SpinoraAllBots"
 */
import fs from "node:fs";
import path from "node:path";

const profileDir = process.argv[2]?.trim();
if (!profileDir) {
  console.error("Usage: node patch-chrome-prefs.mjs <chrome-user-data-dir>");
  process.exit(1);
}

const prefsPath = path.join(profileDir, "Default", "Preferences");

function patchPrefs(filePath) {
  let prefs = {};
  if (fs.existsSync(filePath)) {
    try {
      prefs = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      prefs = {};
    }
  }

  prefs.profile ??= {};
  prefs.profile.password_manager_leak_detection = false;
  prefs.profile.password_manager_enabled = false;
  prefs.credentials_enable_service = false;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(prefs, null, 2));
}

patchPrefs(prefsPath);
console.log(`Patched Chrome prefs: ${prefsPath}`);
