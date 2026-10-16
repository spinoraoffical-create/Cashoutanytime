import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asksForPerson } from "../src/lib/ai/escalate.ts";
import { appendMessage, mergeMessagesById } from "../src/lib/chat/merge-messages.ts";

assert.equal(asksForPerson("where is my deposit?"), false);
assert.equal(asksForPerson("I need help with my payment"), false);
assert.equal(asksForPerson("I need help redeeming."), false);
assert.equal(asksForPerson("I want a person"), true);
assert.equal(asksForPerson("I need to speak with a person."), true);

const chatbot = readFileSync(new URL("../src/lib/ai/chatbot.ts", import.meta.url), "utf8");
assert.match(chatbot, /human-only/i);
assert.doesNotMatch(chatbot, /gpt-4o/);
assert.doesNotMatch(chatbot, /ai_chat_logs/);
assert.doesNotMatch(chatbot, /queryLower\.includes\("help"\)/);
assert.doesNotMatch(chatbot, /queryLower\.includes\("deposit"\)/);

const autoReply = readFileSync(new URL("../src/lib/chat/support-auto-reply.ts", import.meta.url), "utf8");
assert.match(autoReply, /return null/);
assert.match(autoReply, /return false/);
assert.doesNotMatch(autoReply, /\.insert\(/);
assert.doesNotMatch(autoReply, /\.delete\(/);

const widget = readFileSync(new URL("../src/components/chat/live-casino-chat-widget.tsx", import.meta.url), "utf8");
assert.doesNotMatch(widget, /\/api\/chat\/live-bot/);
assert.doesNotMatch(widget, /I'm here to help/);
assert.match(widget, /Support team will reply as soon as possible/);

const inbox = readFileSync(new URL("../src/components/chat/user-messages-inbox.tsx", import.meta.url), "utf8");
assert.match(inbox, /mergeMessagesById/);
assert.match(inbox, /Support team will reply as soon as possible/);

const settings = readFileSync(new URL("../src/lib/ai/settings.ts", import.meta.url), "utf8");
assert.match(settings, /SPINORA_BOT_SENDER_ID/);
assert.match(settings, /support-bot/);
assert.match(settings, /role: "customer"/);
assert.doesNotMatch(settings, /\.eq\("role", "admin"\)/);

const afterSend = readFileSync(new URL("../src/app/api/chat/after-send/route.ts", import.meta.url), "utf8");
assert.doesNotMatch(afterSend, /processAIChatQuery/);
assert.doesNotMatch(afterSend, /insertSupportReplyOnce/);
assert.doesNotMatch(afterSend, /scriptedSupportReply/);
assert.doesNotMatch(afterSend, /void \(async/);

const sender = readFileSync(new URL("../src/lib/chat/send-message-client.ts", import.meta.url), "utf8");
assert.match(sender, /await fetch\("\/api\/chat\/after-send"/);
assert.doesNotMatch(sender, /void fetch/);
assert.doesNotMatch(sender, /\.catch\(\(\) => \{\}\)/);

const starter = readFileSync(new URL("../src/components/chat/support-ai-starter.tsx", import.meta.url), "utf8");
assert.match(starter, /sendMessageClient/);
assert.doesNotMatch(starter, /\/api\/chat\/live-bot/);

assert.match(inbox, /subscribeToConversationInserts/);

const sql = readFileSync(
  new URL("../supabase/migrations/20261008000180_chat_thread.sql", import.meta.url),
  "utf8"
);
assert.match(sql, /public\.is_staff\(\)/);
assert.match(sql, /sender_id = auth\.uid\(\)/);
assert.match(sql, /add table public\.messages/);
assert.doesNotMatch(sql, /profiles\.role/);

const first = { id: "a", created_at: "2026-01-01T00:00:00.000Z", conversation_id: "c", sender_id: "u", content: "hi", is_read: false };
const again = { ...first };
const second = { id: "b", created_at: "2026-01-01T00:00:02.000Z", conversation_id: "c", sender_id: "s", content: "ok", is_read: false };
assert.equal(appendMessage([first], again).length, 1);
assert.deepEqual(mergeMessagesById([second], [first]).map((message) => message.id), ["a", "b"]);

const provider = readFileSync(new URL("../src/components/chat/message-realtime-provider.tsx", import.meta.url), "utf8");
assert.match(provider, /seenMessageIdsRef/);
assert.match(provider, /removeChannel|subscription\.unsubscribe/);

console.log("chat thread checks passed");
