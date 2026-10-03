import "dotenv/config";
import { runBotWorker } from "../../shared/create-bot-worker.js";
import { botPollIntervalMs } from "../../shared/fast-panel-login.js";
import { ensurePanelLoggedIn, runJob } from "./bot.js";

runBotWorker({
  botLabel: "mafia-bot",
  gameSlug: "mafia",
  pollMs: botPollIntervalMs("MAFIA_POLL_MS"),
  envPathHint: "workers/mafia-bot/.env",
  ensurePanelLoggedIn,
  runJob,
}).catch((err) => {
  console.error("[mafia-bot] Fatal:", err);
  process.exit(1);
});
