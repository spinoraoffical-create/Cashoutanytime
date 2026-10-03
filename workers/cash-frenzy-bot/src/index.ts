import "dotenv/config";
import { runBotWorker } from "../../shared/create-bot-worker.js";
import { botPollIntervalMs } from "../../shared/fast-panel-login.js";
import { ensurePanelLoggedIn, runJob } from "./bot.js";

runBotWorker({
  botLabel: "cash-frenzy-bot",
  gameSlug: "cash-frenzy",
  pollMs: botPollIntervalMs("CASHFRENZY_POLL_MS"),
  envPathHint: "workers/cash-frenzy-bot/.env",
  ensurePanelLoggedIn,
  runJob,
}).catch((err) => {
  console.error("[cash-frenzy-bot] Fatal:", err);
  process.exit(1);
});
