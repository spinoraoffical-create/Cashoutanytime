import { createAdminClient } from "@/lib/supabase/admin";
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  sendTelegramPhoto,
  isTelegramPromoConfigured,
} from "@/lib/telegram/client";

export type TelegramPromoRow = {
  id: string;
  text: string;
  link: string | null;
  image_url: string | null;
};

export function formatPromoCaption(text: string, link?: string | null): string {
  const body = text.trim();
  const url = link?.trim();
  if (!url) return body;
  const safeUrl = url.replace(/"/g, "%22");
  return `${body}\n\n<a href="${safeUrl}">🎰 Play now →</a>`;
}

export async function pickNextTelegramPromoMessage(): Promise<TelegramPromoRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("telegram_promo_messages")
    .select("id, text, link, image_url")
    .eq("is_active", true)
    .order("last_sent_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[telegram-promo] pick message failed:", error.message);
    return null;
  }

  return data;
}

export async function isTelegramPromoEnabled(): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "telegram_promo")
    .maybeSingle();

  const value = data?.value as { enabled?: boolean } | null;
  return value?.enabled === true;
}

export async function markTelegramPromoSent(id: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  await admin
    .from("telegram_promo_messages")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", id);
}

export type TelegramPromoRunResult =
  | { ok: true; status: "sent"; messageId: string; preview: string }
  | { ok: true; status: "skipped"; reason: string }
  | { ok: false; error: string };

/** Post the next promo in the rotation pool to your Telegram channel/group. */
export async function runTelegramPromoBroadcast(options?: {
  /** Manual "Send test now" skips the admin toggle check. */
  force?: boolean;
}): Promise<TelegramPromoRunResult> {
  if (!isTelegramPromoConfigured()) {
    return {
      ok: true,
      status: "skipped",
      reason: "Telegram promo not configured (set TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID, or TELEGRAM_PROMO_CHAT_ID for a public channel)",
    };
  }

  const enabled = options?.force ? true : await isTelegramPromoEnabled();
  if (!enabled) {
    return { ok: true, status: "skipped", reason: "Telegram promo broadcast is disabled in Admin → Settings" };
  }

  const message = await pickNextTelegramPromoMessage();
  if (!message) {
    return { ok: true, status: "skipped", reason: "No active promo messages in the pool" };
  }

  const caption = formatPromoCaption(message.text, message.link);

  const result = message.image_url?.trim()
    ? await sendTelegramPhoto(message.image_url.trim(), caption, { channel: "promo" })
    : await sendTelegramMessage(caption, { channel: "promo" });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Telegram send failed" };
  }

  await markTelegramPromoSent(message.id);

  return {
    ok: true,
    status: "sent",
    messageId: message.id,
    preview: message.text.slice(0, 120),
  };
}
