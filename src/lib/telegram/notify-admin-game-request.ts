import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";
import { escapeTelegramHtml, isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram/client";
import { isAnyAdminOnline } from "@/lib/telegram/admin-presence";

export async function notifyAdminOfGameRequest(input: {
  userId: string;
  gameName: string;
  gameProvider: string;
  notes?: string | null;
}): Promise<void> {
  if (!isTelegramConfigured()) return;
  if (await isAnyAdminOnline()) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { data: sender } = await admin
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", input.userId)
    .single();

  if (!sender || sender.role === "admin") return;

  const displayName =
    sender.full_name?.trim() ||
    sender.email?.split("@")[0] ||
    "Customer";
  const email = sender.email ?? "unknown";
  const requestsUrl = `${SITE_URL}/admin/requests`;

  const lines = [
    "🎮 <b>New game request</b>",
    "",
    `<b>From:</b> ${escapeTelegramHtml(displayName)}`,
    `<b>Email:</b> ${escapeTelegramHtml(email)}`,
    `<b>Game:</b> ${escapeTelegramHtml(input.gameName)}`,
    `<b>Provider:</b> ${escapeTelegramHtml(input.gameProvider)}`,
  ];

  const notes = input.notes?.trim();
  if (notes) {
    const clipped = notes.length > 200 ? `${notes.slice(0, 197)}...` : notes;
    lines.push(`<b>Notes:</b> ${escapeTelegramHtml(clipped)}`);
  }

  lines.push("", `<a href="${requestsUrl}">Open requests in Spinora</a>`);

  const result = await sendTelegramMessage(lines.join("\n"));
  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[telegram] game request notify failed:", result.error);
  }
}
