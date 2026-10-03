import "dotenv/config";
import { openBrowserSession } from "../src/browser.js";
import { loginToPanel, readBalance } from "../src/panel.js";

const accounts = process.argv.slice(2).length ? process.argv.slice(2) : ["anthony7999", "freeman009"];

const { page, close } = await openBrowserSession();
try {
  await loginToPanel(page);
  for (const acc of accounts) {
    try {
      const bal = await readBalance(page, acc);
      console.log(`RESULT ${acc} => ${bal}`);
    } catch (e) {
      console.log(`RESULT ${acc} => ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }
} finally {
  if (!process.env.CASHFRENZY_CDP_URL) await close();
}
