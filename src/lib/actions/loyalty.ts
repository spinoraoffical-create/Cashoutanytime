"use server";

import { createHash, randomInt } from "node:crypto";

import { parseInternationalPhone } from "@/lib/auth/phone";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { surveyAnswersValid } from "@/lib/rewards/loyalty-coins";
import { tryGrantLoyaltyCoins } from "@/lib/rewards/try-grant-loyalty";

export async function recordEmailVerifiedCoins(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at) return;
  await tryGrantLoyaltyCoins(user.id, "email_verified", `email:${user.id}`);
}

export async function saveWelcomeSurveyAction(input: {
  games: string;
  source: string;
  interest: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!surveyAnswersValid(input)) return { ok: false, error: "Choose an answer for each question." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.rpc("save_loyalty_survey", {
    p_games: input.games,
    p_source: input.source,
    p_interest: input.interest,
  });
  if (error) {
    if (/already|duplicate|unique/i.test(error.message)) return { ok: false, error: "You already sent this survey." };
    if (/not turned on|schema cache|does not exist|save_loyalty_survey/i.test(error.message)) {
      return { ok: false, error: "Welcome Coins are not turned on yet." };
    }
    return { ok: false, error: "Could not save the survey." };
  }
  return { ok: true };
}

function phoneCodeHash(code: string, pepper: string) {
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}

/** Sends a text only when the owner has turned phone codes on and SMS is configured. */
export async function requestPhoneCodeAction(phone: string): Promise<{ ok: boolean; error?: string }> {
  if (process.env.PHONE_OTP_SENDING_ENABLED !== "true") {
    return { ok: false, error: "Phone verification is not turned on yet." };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  const pepper = process.env.PHONE_OTP_PEPPER?.trim();
  if (!sid || !token || !from || !pepper) {
    return { ok: false, error: "Phone verification is not configured yet." };
  }
  const parsed = parseInternationalPhone(phone);
  if (!parsed) return { ok: false, error: "Enter a valid phone number." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Phone verification is not available yet." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await admin.rpc("start_loyalty_phone_challenge", {
    p_user: user.id,
    p_phone: parsed,
    p_code_hash: phoneCodeHash(code, pepper),
  });
  if (error) {
    if (/schema cache|does not exist|start_loyalty_phone_challenge/i.test(error.message)) {
      return { ok: false, error: "Phone verification is not turned on yet." };
    }
    return { ok: false, error: error.message };
  }

  const body = new URLSearchParams({ To: parsed, From: from, Body: `SweepTakeHub code: ${code}` });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) return { ok: false, error: "The text message could not be sent." };
  return { ok: true };
}

export async function confirmPhoneCodeAction(code: string): Promise<{ ok: boolean; error?: string; coins?: number }> {
  const pepper = process.env.PHONE_OTP_PEPPER?.trim();
  if (!pepper) return { ok: false, error: "Phone verification is not configured yet." };
  const trimmed = code.trim();
  if (!/^[0-9]{6}$/.test(trimmed)) return { ok: false, error: "Enter the 6-digit code." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data, error } = await supabase.rpc("confirm_loyalty_phone", {
    p_code_hash: phoneCodeHash(trimmed, pepper),
  });
  if (error) {
    if (/schema cache|does not exist|confirm_loyalty_phone/i.test(error.message)) {
      return { ok: false, error: "Phone verification is not turned on yet." };
    }
    return { ok: false, error: error.message };
  }
  const coins = Number(data ?? 0);
  return coins > 0
    ? { ok: true, coins }
    : { ok: true, coins: 0, error: "Phone verified. The Coin reward is not turned on yet." };
}

export async function claimTelegramCoinsAction(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Telegram rewards are not available yet." };
  const { data, error } = await admin
    .from("telegram_links")
    .select("telegram_user_id")
    .eq("user_id", user.id)
    .limit(1);
  if (error || !data?.length) return { ok: false, error: "Link your Telegram account before claiming Coins." };
  const telegramUserId = String((data[0] as { telegram_user_id?: number }).telegram_user_id ?? "");
  const { telegramMembershipConfirmed } = await import("@/lib/rewards/telegram-membership");
  const membership = await telegramMembershipConfirmed(telegramUserId);
  if (membership === "unconfigured") {
    return { ok: false, error: "Telegram membership check is not configured yet. The bot token or community chat is missing." };
  }
  if (membership !== "member") {
    return { ok: false, error: "Join the Telegram community, then try again. Opening the link is not enough." };
  }
  const granted = await tryGrantLoyaltyCoins(user.id, "telegram_member", `telegram:${user.id}`);
  if (!granted) return { ok: false, error: "Telegram Coins are not turned on yet, or this reward was already claimed." };
  return { ok: true };
}

export async function claimLoyaltyCheckinAction(
  kind: "daily" | "weekly" | "monthly",
): Promise<{ ok: boolean; error?: string; coins?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data, error } = await supabase.rpc("claim_loyalty_checkin", { p_kind: kind });
  if (error) {
    if (/schema cache|does not exist|claim_loyalty_checkin/i.test(error.message)) {
      return { ok: false, error: "Coins check-in is not turned on yet." };
    }
    return { ok: false, error: error.message };
  }
  if (Number(data) <= 0) return { ok: false, error: "This Coin check-in was already claimed." };
  return { ok: true, coins: Number(data) };
}
