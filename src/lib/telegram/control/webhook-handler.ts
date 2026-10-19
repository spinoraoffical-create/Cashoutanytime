import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { replyToCommand } from "@/lib/telegram/control/commands";
import { botEnv, hashLinkCode } from "@/lib/telegram/control/delivery";
import { isTelegramBotKey, parseCommand, secretsMatch } from "@/lib/telegram/control/rules";

type Update = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number };
  };
};

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
  const { error: seen } = await admin.from("telegram_webhook_updates").insert({ bot_key: botName, update_id: updateId });
  if (seen && /duplicate|unique/i.test(seen.message)) return new Response("DUPLICATE", { status: 200 });
  if (seen) return new Response("RETRY", { status: 500 });

  const text = update.message?.text ?? "";
  const telegramUserId = update.message?.from?.id;
  const chatId = update.message?.chat?.id;
  if (!telegramUserId || !chatId) return new Response("OK", { status: 200 });
  const command = parseCommand(text);
  if (!command) return new Response("OK", { status: 200 });

  try {
    if ((command.name === "link" || command.name === "start") && botName === "owner" && command.arg) {
      await answer(env.token, chatId, await linkOwner(command.arg, telegramUserId, chatId));
      return new Response("OK", { status: 200 });
    }
    if (command.name === "link" && botName === "support") {
      await answer(env.token, chatId, await linkCustomer(command.arg, telegramUserId, chatId));
      return new Response("OK", { status: 200 });
    }
    if (command.name === "start" && botName === "support" && command.arg) {
      await answer(env.token, chatId, await linkCustomer(command.arg, telegramUserId, chatId));
      return new Response("OK", { status: 200 });
    }
    if (botName === "owner" || botName === "support") {
      const reply = await replyToCommand({
        bot: botName,
        telegramUserId,
        name: command.name,
        arg: command.arg,
      });
      await answer(env.token, chatId, reply);
    }
  } catch {
    await answer(env.token, chatId, "That command could not be completed.");
  }
  return new Response("OK", { status: 200 });
}

async function linkOwner(code: string, telegramUserId: number, chatId: number): Promise<string> {
  const codeHash = hashLinkCode(code);
  if (!codeHash) return "Linking is not configured yet.";
  const admin = createAdminClient();
  if (!admin) return "Linking is unavailable.";
  const { data, error } = await admin.rpc("consume_telegram_link_code", { p_code_hash: codeHash });
  if (error) return "Linking is unavailable. The SQL for link codes has not been applied.";
  const row = (Array.isArray(data) ? data[0] : data) as { user_id?: string; purpose?: string } | null;
  if (!row?.user_id || row.purpose !== "owner") return "That code is missing, expired, or already used.";
  const { data: roles } = await admin.from("user_roles").select("roles(key)").eq("user_id", row.user_id);
  const isOwner = ((roles ?? []) as unknown as Array<{ roles?: { key?: string } | null }>).some((item) => item.roles?.key === "super_admin");
  if (!isOwner) return "That account is not an owner. The code was used and cannot be reused.";
  const { error: linkError } = await admin.from("telegram_account_links").upsert(
    {
      purpose: "owner",
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      user_id: row.user_id,
      revoked_at: null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "purpose,telegram_user_id" }
  );
  if (linkError) return "The owner link was not saved. Create a new code.";
  return "Owner chat linked. Commands stay read-only.";
}

async function linkCustomer(code: string, telegramUserId: number, chatId: number): Promise<string> {
  const codeHash = hashLinkCode(code);
  if (!codeHash) return "Linking is not configured yet.";
  const admin = createAdminClient();
  if (!admin) return "Linking is unavailable.";
  const { data, error } = await admin.rpc("consume_telegram_link_code", { p_code_hash: codeHash });
  if (error) return "Linking is unavailable. The SQL for link codes has not been applied.";
  const row = (Array.isArray(data) ? data[0] : data) as { user_id?: string; purpose?: string } | null;
  if (!row?.user_id || row.purpose !== "customer") return "That code is missing, expired, or already used.";
  const { error: linkError } = await admin.from("telegram_account_links").upsert(
    {
      purpose: "customer",
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      user_id: row.user_id,
      revoked_at: null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "purpose,telegram_user_id" }
  );
  if (linkError) return "The code was used but the link was not saved. Create a new code on the website.";
  return "This chat is linked. Use /wallet or /help. Money cannot be moved from here.";
}

async function answer(token: string, chatId: number, text: string) {
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500) }),
    cache: "no-store",
  }).catch(() => undefined);
}
