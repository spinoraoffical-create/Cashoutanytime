import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { replyToCommand } from "@/lib/telegram/control/commands";
import { botEnv, hashLinkCode, sendTelegramText } from "@/lib/telegram/control/delivery";
import {
  groupCommandRefusal,
  isPrivateTelegramChat,
  isTelegramBotKey,
  parseCommand,
  secretsMatch,
  webhookReplayDecision,
} from "@/lib/telegram/control/rules";

type Update = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
    from?: { id?: number };
  };
};

type Claim = "start" | "retry" | "duplicate" | "stopped" | "busy" | "unavailable";

export async function handleTelegramWebhook(botName: string, request: Request): Promise<Response> {
  if (!isTelegramBotKey(botName)) return new Response("NOT FOUND", { status: 404 });
  const env = botEnv(botName);
  if (!env.secret || !secretsMatch(request.headers.get("x-telegram-bot-api-secret-token"), env.secret)) {
    return new Response("UNAUTHORIZED", { status: 401 });
  }
  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return new Response("BAD JSON", { status: 400 });
  }
  const updateId = update.update_id;
  if (typeof updateId !== "number") return new Response("IGNORED", { status: 200 });
  const admin = createAdminClient();
  if (!admin) return new Response("RETRY", { status: 500 });

  let claim: Claim;
  try {
    claim = await claimWebhookUpdate(admin, botName, updateId);
  } catch {
    return new Response("RETRY", { status: 500 });
  }
  if (claim === "duplicate" || claim === "stopped") return new Response(claim === "duplicate" ? "DUPLICATE" : "STOPPED", { status: 200 });
  if (claim === "busy" || claim === "unavailable") return new Response("RETRY", { status: 500 });

  try {
    await runUpdate(botName, env.token, update);
    await admin
      .from("telegram_webhook_updates")
      .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null })
      .eq("bot_key", botName)
      .eq("update_id", updateId);
    return new Response("OK", { status: 200 });
  } catch (err) {
    await admin
      .from("telegram_webhook_updates")
      .update({
        status: "failed",
        last_error: err instanceof Error ? err.message.slice(0, 180) : "command failed",
      })
      .eq("bot_key", botName)
      .eq("update_id", updateId);
    return new Response("RETRY", { status: 500 });
  }
}

async function claimWebhookUpdate(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  botName: string,
  updateId: number
): Promise<Claim> {
  const inserted = await admin
    .from("telegram_webhook_updates")
    .insert({ bot_key: botName, update_id: updateId, status: "received", attempts: 1 })
    .select("status, attempts")
    .maybeSingle();
  if (!inserted.error) return "start";
  if (!/duplicate|unique/i.test(inserted.error.message)) return "unavailable";
  const { data, error } = await admin
    .from("telegram_webhook_updates")
    .select("status, attempts")
    .eq("bot_key", botName)
    .eq("update_id", updateId)
    .maybeSingle();
  if (error || !data) return "unavailable";
  const row = data as { status: "received" | "processed" | "failed" | "exhausted" | "reviewed"; attempts: number };
  const decision = webhookReplayDecision({ status: row.status, attempts: row.attempts });
  if (decision === "duplicate") return "duplicate";
  if (decision === "stopped") {
    if (row.status !== "exhausted" && row.status !== "reviewed") {
      await admin
        .from("telegram_webhook_updates")
        .update({ status: "exhausted", last_error: "Retry limit reached. Telegram was told to stop. Reopen does not run the command again." })
        .eq("bot_key", botName)
        .eq("update_id", updateId);
    }
    return "stopped";
  }
  const { data: claimed } = await admin
    .from("telegram_webhook_updates")
    .update({ status: "received", attempts: row.attempts + 1, last_error: null })
    .eq("bot_key", botName)
    .eq("update_id", updateId)
    .eq("attempts", row.attempts)
    .in("status", ["received", "failed"])
    .select("attempts")
    .maybeSingle();
  if (!claimed) return "busy";
  return "retry";
}

async function runUpdate(botName: string, token: string, update: Update) {
  const text = update.message?.text ?? "";
  const telegramUserId = update.message?.from?.id;
  const chatId = update.message?.chat?.id;
  const chatType = update.message?.chat?.type;
  if (!telegramUserId || !chatId) return;
  const command = parseCommand(text);
  if (command && /^[a-z]{1,32}$/.test(command.name)) {
    const admin = createAdminClient();
    const updateId = update.update_id;
    if (admin && typeof updateId === "number") {
      await admin
        .from("telegram_webhook_updates")
        .update({ command_name: command.name })
        .eq("bot_key", botName)
        .eq("update_id", updateId);
    }
  }
  if (!command) return;
  if (!isPrivateTelegramChat(chatType)) {
    await answer(token, chatId, groupCommandRefusal());
    return;
  }
  if ((command.name === "link" || command.name === "start") && botName === "owner" && command.arg) {
    await answer(token, chatId, await redeemLink("owner", command.arg, telegramUserId, chatId));
    return;
  }
  if (command.name === "link" && botName === "support") {
    await answer(token, chatId, await redeemLink("customer", command.arg, telegramUserId, chatId));
    return;
  }
  if (command.name === "start" && botName === "support" && command.arg) {
    await answer(token, chatId, await redeemLink("customer", command.arg, telegramUserId, chatId));
    return;
  }
  if (botName === "owner" || botName === "support") {
    const reply = await replyToCommand({
      bot: botName,
      telegramUserId,
      name: command.name,
      arg: command.arg,
    });
    await answer(token, chatId, reply);
  }
}

async function redeemLink(
  purpose: "owner" | "customer",
  code: string,
  telegramUserId: number,
  chatId: number
): Promise<string> {
  const codeHash = hashLinkCode(code);
  if (!codeHash) return "Linking is not configured yet.";
  const admin = createAdminClient();
  if (!admin) return "Linking is unavailable.";
  const { data, error } = await admin.rpc("redeem_telegram_link", {
    p_code_hash: codeHash,
    p_telegram_user_id: telegramUserId,
    p_chat_id: chatId,
    p_expected_purpose: purpose,
  });
  if (error) return "Linking is unavailable. The code was not used.";
  const row = (Array.isArray(data) ? data[0] : data) as { result?: string } | null;
  if (row?.result === "linked") {
    return purpose === "owner"
      ? "Owner chat linked. Commands stay read-only."
      : "This chat is linked. Use /wallet or /help. Money cannot be moved from here.";
  }
  if (row?.result === "not_owner") return "That account is not an owner. The code was not used.";
  if (row?.result === "purpose") return "That code is for a different bot. The code was not used.";
  return "That code is missing, expired, or already used.";
}

async function answer(token: string, chatId: number, text: string) {
  if (!token) return;
  const sent = await sendTelegramText(token, chatId, text, false);
  if (sent.thrown) throw new Error("Telegram reply timed out");
}
