import "dotenv/config";
import { runBotWorker } from "../../shared/create-bot-worker.js";
import { botPollIntervalMs } from "../../shared/fast-panel-login.js";
import { ensurePanelLoggedIn, runJob } from "./bot.js";

runBotWorker({
  botLabel: "gameroom-bot",
  gameSlug: "gameroom",
  pollMs: botPollIntervalMs("GAMEROOM_POLL_MS"),
  envPathHint: "workers/gameroom-bot/.env",
  ensurePanelLoggedIn,
  runJob,
}).catch((err) => {
  console.error("[gameroom-bot] Fatal:", err);
  process.exit(1);
});
