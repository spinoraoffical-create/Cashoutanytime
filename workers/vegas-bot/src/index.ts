import "dotenv/config";
import { runBotWorker } from "../../shared/create-bot-worker.js";
import { botPollIntervalMs } from "../../shared/fast-panel-login.js";
import { ensurePanelLoggedIn, runVegasJob } from "./vegas-bot.js";

runBotWorker({
  botLabel: "vegas-bot",
  gameSlug: "vegas-sweeps",
  pollMs: botPollIntervalMs("VEGAS_POLL_MS"),
  envPathHint: "workers/vegas-bot/.env",
  ensurePanelLoggedIn,
  runJob: runVegasJob,
}).catch((err) => {
  console.error("[vegas-bot] Fatal:", err);
  process.exit(1);
});
