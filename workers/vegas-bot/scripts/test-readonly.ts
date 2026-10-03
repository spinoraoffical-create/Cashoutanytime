import "dotenv/config";
import { openBrowserSession } from "../src/browser.js";
import { loginToPanel, readBalance } from "../src/vegas-panel.js";

const accounts = (process.argv.slice(2).length ? process.argv.slice(2) : ["megz5512", "megz567i"]);

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
  if (!process.env.VEGAS_CDP_URL) await close();
}
