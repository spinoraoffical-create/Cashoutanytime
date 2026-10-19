import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";
import type { GameLoadWalletType } from "@/lib/game-automation/types";
import { escapeTelegramHtml, isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram/client";
import { isAnyAdminOnline } from "@/lib/telegram/admin-presence";
import { recordLegacyOutcome } from "@/lib/telegram/control/delivery";
import { noteLegacySend, safePaymentAlert } from "@/lib/telegram/control/safe-emit";

export type WalletActivityKind = "create_account" | "load" | "reload" | "redeem";

const KIND_LABELS: Record<WalletActivityKind, { emoji: string; title: string }> = {
  create_account: { emoji: "🎰", title: "New game account request" },
  load: { emoji: "💵", title: "Wallet load request" },
  reload: { emoji: "💵", title: "Wallet reload request" },
  redeem: { emoji: "💸", title: "Redeem request" },
};

export async function notifyAdminOfWalletActivity(input: {
  userId: string;
  gameName: string;
  gameSlug: string;
  kind: WalletActivityKind;
  amount?: number | null;
  walletType?: GameLoadWalletType;
  redeemAll?: boolean;
  requestId: string;
}): Promise<void> {
  try {
  const routed = await safePaymentAlert({
    category: "load_requested",
    eventKey: `game-request:${input.requestId}`,
    source: "ledger",
    reference: input.requestId,
    amount: input.amount,
    detail: `${input.kind} opened for ${input.gameName}. This is a request, not a finished provider result.`,
    adminPath: "/admin/game-loads",
  });
  if (routed.disposition === "handled") return;
  if (!isTelegramConfigured()) {
    console.error("[telegram] wallet activity skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not set");
    await noteLegacySend(routed.eventKey, { configured: false, ok: null, thrown: false });
    return;
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("[telegram] wallet activity skipped: SUPABASE_SERVICE_ROLE_KEY not set on server");
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

  const displayName = sender.full_name?.trim() || "Player";
  const { emoji, title } = KIND_LABELS[input.kind];
  const loadsUrl = `${SITE_URL}/admin/game-loads`;

  const lines = [
    `${emoji} <b>${title}</b>`,
    "",
    `<b>From:</b> ${escapeTelegramHtml(displayName)}`,
    `<b>Game:</b> ${escapeTelegramHtml(input.gameName)}`,
  ];

  if (input.kind === "load" || input.kind === "reload") {
    const walletLabel = input.walletType === "bonus" ? "Bonus Wallet" : "Total Deposit";
    lines.push(`<b>Wallet:</b> ${escapeTelegramHtml(walletLabel)}`);
    if (input.amount != null && input.amount > 0) {
      lines.push(`<b>Amount:</b> $${input.amount.toFixed(2)}`);
    }
  }

  if (input.kind === "redeem") {
    const walletLabel = input.walletType === "bonus" ? "Bonus Wallet" : "Total Deposit";
    lines.push(`<b>To wallet:</b> ${escapeTelegramHtml(walletLabel)}`);
    if (input.redeemAll) {
      lines.push("<b>Amount:</b> All available");
    } else if (input.amount != null && input.amount > 0) {
      lines.push(`<b>Amount:</b> $${input.amount.toFixed(2)}`);
    }
  }

  lines.push("", `<a href="${loadsUrl}">Open Wallet Loads in Sweepstakes Hub</a>`);

  // Same as deposit alerts: always send. Silent push when an admin tab is open.
  const disableNotification = await isAnyAdminOnline();

  const result = await sendTelegramMessage(lines.join("\n"), { disableNotification });
  await noteLegacySend(routed.eventKey, { configured: true, ok: result.ok, thrown: result.thrown });
  if (!result.ok) {
    console.error("[telegram] wallet activity notify failed:", result.error);
  }
  } catch (err) {
    console.error("[telegram] wallet activity notify failed", err instanceof Error ? err.message : err);
  }
}
