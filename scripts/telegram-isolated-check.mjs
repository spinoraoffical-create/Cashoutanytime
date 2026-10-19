import assert from "node:assert/strict";

import { isolatedTelegramTarget, TELEGRAM_BOTS, webhookPath } from "../src/lib/telegram/control/rules.ts";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
const target = isolatedTelegramTarget(`${supabaseUrl} ${siteUrl}`);

assert.equal(isolatedTelegramTarget("https://zecitlewsynyioemsqna.supabase.co"), "production");
assert.equal(isolatedTelegramTarget("https://www.sweeptakehub.com/api/telegram/payments"), "production");
if (target === "production") {
  console.log("Current environment points at production. No webhook or worker request was sent.");
} else {
  console.log("Current environment is not the production Supabase project or site.");
}

console.log("Isolated Telegram test checklist");
console.log("Use a separate Supabase project and five BotFather test bots. Do not copy production payment keys.");
for (const bot of TELEGRAM_BOTS) {
  console.log(`- ${bot}: POST ${webhookPath(bot)} with header x-telegram-bot-api-secret-token`);
}
console.log("- Worker: POST /api/cron/telegram-delivery with Authorization: Bearer <test CRON_SECRET>");
console.log("- Do not point those webhooks at sweeptakehub.com while the database is the production project.");
console.log("telegram-isolated-check.mjs passed");
