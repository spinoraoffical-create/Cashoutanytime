"use server";

import { authorize, adminDb } from "@/lib/actions/admin/core";
import { createClient } from "@/lib/supabase/server";
import type { TelegramBotPurpose } from "@/lib/database.types";

export type TelegramLinkResult =
  | { ok: true; deepLink: string; expiresInMinutes: number }
  | { ok: false; error: string };

const CODE_TTL_MINUTES = 10;

/** Mint a one-time deep-link code for linking the caller's WinSweeps account to a Telegram bot. */
export async function generateTelegramLinkCode(
  purpose: TelegramBotPurpose
): Promise<TelegramLinkResult> {
  let userId: string;

  if (purpose === "admin") {
    const auth = await authorize("settings.manage");
    if ("error" in auth) return { ok: false, error: auth.error };
    userId = auth.staff.userId;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again." };
    userId = user.id;
  }

  const botUsername =
    purpose === "admin"
      ? process.env.TELEGRAM_ADMIN_BOT_USERNAME
      : process.env.TELEGRAM_CUSTOMER_BOT_USERNAME;
  if (!botUsername) {
    return { ok: false, error: "The Telegram bot isn't configured yet." };
  }

  const code = crypto.randomUUID().replace(/-/g, "");
  const db = adminDb();
  const { error } = await db.from("telegram_link_codes").insert({
    code,
    purpose,
    user_id: userId,
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) return { ok: false, error: "Could not generate a link code. Try again." };

  return {
    ok: true,
    deepLink: `https://t.me/${botUsername}?start=${code}`,
    expiresInMinutes: CODE_TTL_MINUTES,
  };
}
