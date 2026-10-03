import "dotenv/config";
import { runBotWorker } from "../../shared/create-bot-worker.js";
import { botPollIntervalMs } from "../../shared/fast-panel-login.js";
import { ensurePanelLoggedIn, runJuwaJob } from "./juwa-bot.js";

runBotWorker({
  botLabel: "juwa-bot",
  gameSlug: "juwa",
  pollMs: botPollIntervalMs("JUWA_POLL_MS"),
  envPathHint: "workers/juwa-bot/.env",
  ensurePanelLoggedIn,
  runJob: runJuwaJob,
}).catch((err) => {
  console.error("[juwa-bot] Fatal:", err);
  process.exit(1);
});
