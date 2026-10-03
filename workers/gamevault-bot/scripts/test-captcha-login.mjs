/**
 * Test CAPTCHA auto-read + login for Game Vault.
 * 1) Chrome on 9222 with Game Vault login tab open
 * 2) npm run test-captcha
 */
import "dotenv/config";
import { config } from "dotenv";
import { join } from "path";
import { openBrowserSession } from "../src/browser.js";
import { loginToPanel } from "../src/panel.js";

config({ path: join(process.cwd(), "..", ".env") });

const { page, close } = await openBrowserSession();

try {
  console.log("\n=== GAME VAULT CAPTCHA LOGIN TEST ===");
  console.log("Tab URL:", page.url());
  console.log("CAPTCHA_AUTO:", process.env.CAPTCHA_AUTO ?? "true (default)");
  console.log("CAPTCHA_API_KEY:", process.env.CAPTCHA_API_KEY ? "set" : "MISSING");
  console.log("\nAttempting login...\n");

  await loginToPanel(page);

  console.log("\n=== RESULT ===");
  console.log("URL after login:", page.url());
  console.log(
    page.url().includes("/login")
      ? "FAILED — still on login page"
      : "SUCCESS — past login"
  );
} catch (err) {
  console.error("\n=== FAILED ===");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  if (!process.env.GAMEVAULT_CDP_URL) await close();
  else console.log("\nChrome left open (CDP mode).");
}
