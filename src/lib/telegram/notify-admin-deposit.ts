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
import { recordLegacyOutcome } from "@/lib/telegram/control/delivery";
import { noteLegacySend, safePaymentAlert } from "@/lib/telegram/control/safe-emit";
import { CHAT_ATTACHMENT_BUCKET } from "@/lib/chat/attachments";

export async function notifyAdminOfDeposit(input: {
  userId: string;
  gameName: string;
  paymentMethod: DepositPaymentMethodId;
  amount?: number | null;
  proofPath: string;
  depositId: string;
}): Promise<void> {
  try {
  const routed = await safePaymentAlert({
    category: "deposit_requested",
    eventKey: `deposit-proof:${input.depositId}`,
    source: "ledger",
    reference: input.depositId,
    amount: input.amount,
    detail: "A deposit proof was uploaded. Payment is not confirmed.",
    adminPath: "/admin/deposits",
  });
  if (routed.disposition === "handled") return;
  if (!isTelegramConfigured()) {
    await noteLegacySend(routed.eventKey, { configured: false, ok: null, thrown: false });
    return;
  }

  const admin = createAdminClient();
  if (!admin) {
    await noteLegacySend(routed.eventKey, { configured: true, ok: null, thrown: true });
    return;
  }

  const { data: sender, error: senderError } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", input.userId)
    .single();

  if (senderError || !sender) {
    await noteLegacySend(routed.eventKey, { configured: true, ok: null, thrown: true });
    return;
  }
  if (sender.role === "admin") {
    await recordLegacyOutcome(routed.eventKey, "skipped");
    return;
  }

  const method = getDepositMethod(input.paymentMethod);
  const displayName = sender.full_name?.trim() || "Player";
  const depositsUrl = `${SITE_URL}/admin/deposits`;
  const amountLine =
    input.amount != null && input.amount > 0
      ? `<b>Amount:</b> $${input.amount.toFixed(2)}`
      : "";

  const captionLines = [
    "💰 <b>New deposit proof</b>",
    "",
    `<b>From:</b> ${escapeTelegramHtml(displayName)}`,
    `<b>Game:</b> ${escapeTelegramHtml(input.gameName)}`,
    `<b>Method:</b> ${escapeTelegramHtml(method?.label ?? input.paymentMethod)}`,
    amountLine,
    "",
    `<a href="${depositsUrl}">Review in Sweepstakes Hub</a>`,
  ].filter(Boolean);

  const caption = captionLines.join("\n");
  const disableNotification = await isAnyAdminOnline();

  const { data: signed } = await admin.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .createSignedUrl(input.proofPath, 3600);

  let photoThrown = false;
  if (signed?.signedUrl) {
    const photoResult = await sendTelegramPhoto(signed.signedUrl, caption, {
      disableNotification,
    });
    if (photoResult.ok) {
      await noteLegacySend(routed.eventKey, { configured: true, ok: true, thrown: false });
      return;
    }
    photoThrown = photoResult.thrown;
  }

  const textLines = [
    ...captionLines,
    "",
    "<b>Screenshot:</b> uploaded (open admin panel to view)",
  ];

  const result = await sendTelegramMessage(textLines.join("\n"), { disableNotification });
  await noteLegacySend(routed.eventKey, {
    configured: true,
    ok: result.ok,
    thrown: result.ok ? false : photoThrown || result.thrown,
  });
  if (!result.ok) {
    console.error("[telegram] deposit notify failed:", result.error);
  }
  } catch (err) {
    console.error("[telegram] deposit notify failed", err instanceof Error ? err.message : err);
  }
}
