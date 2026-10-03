import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";
import { getDepositMethod } from "@/lib/payments/methods";
import type { DepositPaymentMethodId } from "@/lib/payments/methods";
import {
  escapeTelegramHtml,
  isTelegramConfigured,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "@/lib/telegram/client";
import { isAnyAdminOnline } from "@/lib/telegram/admin-presence";
import { CHAT_ATTACHMENT_BUCKET } from "@/lib/chat/attachments";

export async function notifyAdminOfDeposit(input: {
  userId: string;
  gameName: string;
  paymentMethod: DepositPaymentMethodId;
  amount?: number | null;
  proofPath: string;
  depositId: string;
}): Promise<void> {
  if (!isTelegramConfigured()) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { data: sender } = await admin
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", input.userId)
    .single();

  if (!sender || sender.role === "admin") return;

  const method = getDepositMethod(input.paymentMethod);
  const displayName =
    sender.full_name?.trim() || sender.email?.split("@")[0] || "Player";
  const email = sender.email ?? "unknown";
  const depositsUrl = `${SITE_URL}/admin/deposits`;
  const amountLine =
    input.amount != null && input.amount > 0
      ? `<b>Amount:</b> $${input.amount.toFixed(2)}`
      : "";

  const captionLines = [
    "💰 <b>New deposit proof</b>",
    "",
    `<b>From:</b> ${escapeTelegramHtml(displayName)}`,
    `<b>Email:</b> ${escapeTelegramHtml(email)}`,
    `<b>Game:</b> ${escapeTelegramHtml(input.gameName)}`,
    `<b>Method:</b> ${escapeTelegramHtml(method?.label ?? input.paymentMethod)}`,
    amountLine,
    "",
    `<a href="${depositsUrl}">Review in Spinora</a>`,
  ].filter(Boolean);

  const caption = captionLines.join("\n");
  const disableNotification = await isAnyAdminOnline();

  const { data: signed } = await admin.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .createSignedUrl(input.proofPath, 3600);

  if (signed?.signedUrl) {
    const photoResult = await sendTelegramPhoto(signed.signedUrl, caption, {
      disableNotification,
    });
    if (photoResult.ok) return;
    if (process.env.NODE_ENV === "development") {
      console.warn("[telegram] deposit photo failed, falling back to text:", photoResult.error);
    }
  }

  const textLines = [
    ...captionLines,
    "",
    "<b>Screenshot:</b> uploaded (open admin panel to view)",
  ];

  const result = await sendTelegramMessage(textLines.join("\n"), { disableNotification });
  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[telegram] deposit notify failed:", result.error);
  }
}
