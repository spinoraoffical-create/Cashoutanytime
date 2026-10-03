import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegramPhoto } from "@/lib/telegram/client";
import { SITE_URL } from "@/lib/constants";
import { getTelegramSettings, updateTelegramSettings } from "@/lib/ai/settings";

export interface AutopilotStatus {
  enabled: boolean;
  frequencyHours: number;
  lastRunTime: string | null;
  totalAutopilotPosts: number;
}

interface PosterOffer {
  photo: string;
  title: string;
  perks: string[];
}

const POSTER_OFFERS: PosterOffer[] = [
  {
    photo: "/images/promos/spinora_dealer_ten.jpg",
    title: "👑 <b>DEALER'S EXCLUSIVE — $10.00 FREE PLAY DROP</b>",
    perks: [
      "• Get $10.00 Instant Free Play added on your next deposit",
      "• 24/7 Automated Game Wallet Loads",
      "• 15-Minute Verified Cashouts"
    ]
  },
  {
    photo: "/images/promos/spinora_model_five.jpg",
    title: "🔥 <b>VIP WHEEL REWARDS — $5.00 COIN BLAST</b>",
    perks: [
      "• Claim an extra $5.00 Coin Blast to play slots",
      "• Spin the Daily Wheel for up to $50.00",
      "• 24/7 Live Agent Support on Telegram"
    ]
  },
  {
    photo: "/images/promos/spinora_slot_fifteen.jpg",
    title: "🎰 <b>MEGA SLOT SPECIAL — $15.00 BONUS LOAD</b>",
    perks: [
      "• Get a $15.00 Bonus Load on deposits of $20.00 or more",
      "• Play top slots on Juwa, Orion Stars & Game Vault",
      "• Instant account setup in under 5 minutes"
    ]
  },
  {
    photo: "/images/promos/spinora_gift_three.jpg",
    title: "🎁 <b>DAILY GIFT DROP — $3.00 FREE PLAY</b>",
    perks: [
      "• Claim your daily $3.00 Free Play gift drop",
      "• No bonus codes required — claim directly from dashboard",
      "• Fast cashouts via Cash App & Venmo"
    ]
  }
];

export async function getAutopilotStatus(): Promise<AutopilotStatus> {
  const settings = await getTelegramSettings();
  const db = createAdminClient();

  let totalPosts = 0;
  if (db) {
    try {
      const { count } = await db
        .from("system_health_logs")
        .select("*", { count: "exact", head: true })
        .contains("cron_metrics", { type: "telegram_autopilot" });
      totalPosts = count ?? 0;
    } catch {
      totalPosts = 0;
    }
  }

  return {
    enabled: settings.autopilot_enabled,
    frequencyHours: 24,
    lastRunTime: settings.last_autopilot_at,
    totalAutopilotPosts: totalPosts,
  };
}

export async function toggleAutopilot(enable?: boolean): Promise<AutopilotStatus> {
  const settings = await getTelegramSettings();
  const next = typeof enable === "boolean" ? enable : !settings.autopilot_enabled;
  await updateTelegramSettings({ autopilot_enabled: next });
  return getAutopilotStatus();
}

export async function runAutopilotDailyPostNow(): Promise<{ ok: boolean; message: string }> {
  const settings = await getTelegramSettings();
  if (!settings.autopilot_enabled) {
    return { ok: false, message: "Autopilot is disabled in Telegram settings." };
  }

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const selectedOffer = POSTER_OFFERS[Math.floor(Math.random() * POSTER_OFFERS.length)];
  const photoUrl = `${SITE_URL}${selectedOffer.photo}`;

  const autoCaption = `${settings.template_header}

${selectedOffer.title}
🗓️ <b>${todayStr}</b>

Daily bonus drop is active on all 8 game platforms!

✨ <b>Today's perks:</b>
${selectedOffer.perks.join("\n")}

👉 <a href="${SITE_URL}/dashboard">Claim Today's Bonus</a>

${settings.template_footer}`;

  const result = await sendTelegramPhoto(photoUrl, autoCaption, { channel: "promo" });

  await updateTelegramSettings({ last_autopilot_at: new Date().toISOString() });

  const db = createAdminClient();
  if (db) {
    try {
      await db.from("system_health_logs").insert({
        health_score: 100,
        seo_metrics: {},
        cron_metrics: { type: "telegram_autopilot", at: new Date().toISOString() },
        database_metrics: {},
        recommendations: [],
      });
    } catch {
      /* ignore */
    }
  }

  if (!result.ok) {
    return { ok: false, message: result.error || "Telegram send failed" };
  }

  return {
    ok: true,
    message: `Autopilot posted daily offer for ${todayStr}.`,
  };
}
