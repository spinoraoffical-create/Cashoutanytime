import "dotenv/config";
import { runBotWorker } from "../../shared/create-bot-worker.js";
import { botPollIntervalMs } from "../../shared/fast-panel-login.js";
import { ensurePanelLoggedIn, runJob } from "./bot.js";

runBotWorker({
  botLabel: "cashmachine-bot",
  gameSlug: "cash-machine",
  pollMs: botPollIntervalMs("CASHMACHINE_POLL_MS"),
  envPathHint: "workers/cashmachine-bot/.env",
  ensurePanelLoggedIn,
  runJob,
}).catch((err) => {
  console.error("[cashmachine-bot] Fatal:", err);
  process.exit(1);
});
