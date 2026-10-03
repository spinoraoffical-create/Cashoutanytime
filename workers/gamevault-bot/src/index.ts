import "dotenv/config";
import { runBotWorker } from "../../shared/create-bot-worker.js";
import { botPollIntervalMs } from "../../shared/fast-panel-login.js";
import { ensurePanelLoggedIn, runJob } from "./bot.js";

runBotWorker({
  botLabel: "gamevault-bot",
  gameSlug: "game-vault",
  pollMs: botPollIntervalMs("GAMEVAULT_POLL_MS"),
  envPathHint: "workers/gamevault-bot/.env",
  ensurePanelLoggedIn,
  runJob,
}).catch((err) => {
  console.error("[gamevault-bot] Fatal:", err);
  process.exit(1);
});
