import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asksForPerson } from "../src/lib/ai/escalate.ts";

assert.equal(asksForPerson("where is my deposit?"), false);
assert.equal(asksForPerson("I need help with my payment"), false);
assert.equal(asksForPerson("I need help redeeming."), false);
assert.equal(asksForPerson("I want a person"), true);
assert.equal(asksForPerson("I need to speak with a person."), true);

const chatbot = readFileSync(new URL("../src/lib/ai/chatbot.ts", import.meta.url), "utf8");
assert.match(chatbot, /asksForPerson\(queryLower\) \|\| modelFailed/);
assert.doesNotMatch(chatbot, /queryLower\.includes\("help"\)/);
assert.doesNotMatch(chatbot, /queryLower\.includes\("deposit"\)/);
assert.doesNotMatch(chatbot, /\.eq\("role", "admin"\)/);

const settings = readFileSync(new URL("../src/lib/ai/settings.ts", import.meta.url), "utf8");
assert.match(settings, /SPINORA_BOT_SENDER_ID/);
assert.match(settings, /support-bot/);
assert.match(settings, /role: "customer"/);
assert.doesNotMatch(settings, /\.eq\("role", "admin"\)/);

const afterSend = readFileSync(new URL("../src/app/api/chat/after-send/route.ts", import.meta.url), "utf8");
const insertAt = afterSend.indexOf('from("messages").insert');
const telegramAt = afterSend.indexOf("await sendTelegramMessage");
assert.ok(insertAt > 0 && telegramAt > insertAt);
assert.match(afterSend, /is_read: false/);
assert.doesNotMatch(afterSend, /void \(async/);

const sender = readFileSync(new URL("../src/lib/chat/send-message-client.ts", import.meta.url), "utf8");
assert.match(sender, /await fetch\("\/api\/chat\/after-send"/);
assert.doesNotMatch(sender, /void fetch/);
assert.doesNotMatch(sender, /\.catch\(\(\) => \{\}\)/);

const starter = readFileSync(new URL("../src/components/chat/support-ai-starter.tsx", import.meta.url), "utf8");
assert.match(starter, /sendMessageClient/);
assert.doesNotMatch(starter, /\/api\/chat\/live-bot/);

const inbox = readFileSync(new URL("../src/components/chat/user-messages-inbox.tsx", import.meta.url), "utf8");
assert.match(inbox, /subscribeToConversationInserts/);

const sql = readFileSync(
  new URL("../supabase/migrations/20261008000180_chat_thread.sql", import.meta.url),
  "utf8"
);
assert.match(sql, /public\.is_staff\(\)/);
assert.match(sql, /sender_id = auth\.uid\(\)/);
assert.match(sql, /add table public\.messages/);
assert.doesNotMatch(sql, /profiles\.role/);

console.log("chat thread checks passed");
