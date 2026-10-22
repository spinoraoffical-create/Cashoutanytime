/** Separate from the existing alert bots. Reads membership only; never sends a message. */

export async function telegramMembershipConfirmed(telegramUserId: string): Promise<"member" | "absent" | "unconfigured"> {
  const token = process.env.TELEGRAM_MEMBERSHIP_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_COMMUNITY_CHAT_ID?.trim();
  if (!token || !chatId || !telegramUserId) return "unconfigured";
  const url = new URL(`https://api.telegram.org/bot${token}/getChatMember`);
  url.searchParams.set("chat_id", chatId);
  url.searchParams.set("user_id", telegramUserId);
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) return "absent";
  const body = (await response.json()) as { ok?: boolean; result?: { status?: string } };
  const status = body.result?.status;
  if (body.ok && (status === "creator" || status === "administrator" || status === "member")) return "member";
  return "absent";
}
