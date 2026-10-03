/**
 * Test CAPTCHA auto-read + login for Gameroom.
 *
 * 1) npm install  (once, includes tesseract.js)
 * 2) start-unified-chrome.bat OR start-chrome-for-bot.bat
 * 3) On the Gameroom tab, open the login page (log out if needed):
 *    https://agentserver1.gameroom777.com/admin/login
 * 4) Run: npm run test-captcha
 */
import "dotenv/config";
import { openBrowserSession } from "../src/browser.js";
import { loginToPanel } from "../src/panel.js";

const { page, close } = await openBrowserSession();

try {
  console.log("\n=== CAPTCHA LOGIN TEST ===");
  console.log("Tab URL:", page.url());
  console.log("CAPTCHA_AUTO:", process.env.CAPTCHA_AUTO ?? "true (default)");
  console.log("\nAttempting login (bot will read CAPTCHA if on login page)...\n");

  await loginToPanel(page);

  console.log("\n=== RESULT ===");
  console.log("URL after login:", page.url());
  console.log("If you are past /login, CAPTCHA login worked (or session was already valid).");
} catch (err) {
  console.error("\n=== FAILED ===");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  if (!process.env.GAMEROOM_CDP_URL) await close();
  else console.log("\nChrome left open (CDP mode).");
}
