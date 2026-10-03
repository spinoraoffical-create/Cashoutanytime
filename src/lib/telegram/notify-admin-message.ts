import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";
import { escapeTelegramHtml, isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram/client";
import { isAnyAdminOnline } from "@/lib/telegram/admin-presence";

function messagePreview(content: string, attachmentType?: "image" | "file" | null): string {
  const trimmed = content.trim();
  if (trimmed) return trimmed;
  if (attachmentType === "image") return "Sent an image";
  if (attachmentType === "file") return "Sent a file";
  return "Sent a message";
}

export async function notifyAdminOfCustomerMessage(input: {
  conversationId: string;
  senderId: string;
  content: string;
  attachmentType?: "image" | "file" | null;
}): Promise<void> {
  if (!isTelegramConfigured()) return;

  if (await isAnyAdminOnline()) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { data: sender } = await admin
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", input.senderId)
    .single();

  if (!sender || sender.role === "admin") return;

  const { data: conversation } = await admin
    .from("conversations")
    .select("user_id")
    .eq("id", input.conversationId)
    .single();

  if (!conversation) return;

  const displayName =
    sender.full_name?.trim() ||
    sender.email?.split("@")[0] ||
    "Customer";
  const email = sender.email ?? "unknown";
  const preview = messagePreview(input.content, input.attachmentType);
  const clippedPreview = preview.length > 200 ? `${preview.slice(0, 197)}...` : preview;
  const chatUrl = `${SITE_URL}/admin/chat?userId=${conversation.user_id}`;

  const text = [
    "💬 <b>New customer message</b>",
    "",
    `<b>From:</b> ${escapeTelegramHtml(displayName)}`,
    `<b>Email:</b> ${escapeTelegramHtml(email)}`,
    `<b>Message:</b> ${escapeTelegramHtml(clippedPreview)}`,
    "",
    `<a href="${chatUrl}">Open chat in Spinora</a>`,
  ].join("\n");

  const result = await sendTelegramMessage(text);
  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[telegram] notify failed:", result.error);
  }
}
