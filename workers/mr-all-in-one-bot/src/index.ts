import "dotenv/config";
import { runBotWorker } from "../../shared/create-bot-worker.js";
import { botPollIntervalMs } from "../../shared/fast-panel-login.js";
import { ensurePanelLoggedIn, runJob } from "./bot.js";

runBotWorker({
  botLabel: "mr-all-in-one-bot",
  gameSlug: "mr-all-in-one",
  pollMs: botPollIntervalMs("MRALLINONE_POLL_MS"),
  envPathHint: "workers/mr-all-in-one-bot/.env",
  ensurePanelLoggedIn,
  runJob,
}).catch((err) => {
  console.error("[mr-all-in-one-bot] Fatal:", err);
  process.exit(1);
});
