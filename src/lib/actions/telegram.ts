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

/** Hashed one-time code for the support bot. The raw code is not stored. */
export async function createCustomerTelegramLink(): Promise<TelegramLinkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const username = process.env.TELEGRAM_SUPPORT_BOT_USERNAME;
  if (!username) return { ok: false, error: "The support bot username is not set." };
  const { expireOpenLinkCodes, hashLinkCode } = await import("@/lib/telegram/control/delivery");
  const { randomBytes } = await import("node:crypto");
  const code = randomBytes(24).toString("hex");
  const codeHash = hashLinkCode(code);
  if (!codeHash) return { ok: false, error: "Telegram linking is not configured yet." };
  const db = adminDb();
  await expireOpenLinkCodes(db, user.id, "customer");
  const { error } = await db.from("telegram_link_challenges").insert({
    code_hash: codeHash,
    purpose: "customer",
    user_id: user.id,
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) return { ok: false, error: "Apply the Telegram SQL before linking." };
  return {
    ok: true,
    deepLink: `https://t.me/${username.replace(/^@/, "")}?start=${code}`,
    expiresInMinutes: CODE_TTL_MINUTES,
  };
}
