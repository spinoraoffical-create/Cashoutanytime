import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import { campaignOwnerStatus, type MarketingRange } from "@/lib/admin/marketing-center-rules";

export type MarketingMetric = {
  label: string;
  help: string;
  value: string | null;
  error: string | null;
};

function metric(label: string, help: string, value: string | null, error: string | null): MarketingMetric {
  return { label, help, value: error ? null : value, error };
}

function countLabel(count: number | null) {
  return count == null ? null : String(count);
}

export async function loadMarketingCenter(range: { since: string; until: string; label: string; id: MarketingRange }) {
  const db = adminDb();
  const metrics: MarketingMetric[] = [];

  const email = await db
    .from("notification_preferences")
    .select("user_id", { count: "exact", head: true })
    .eq("email_promotions", true);
  metrics.push(metric(
    "Eligible email subscribers",
    "Current rows with promotional email still on. This is not limited to the date filter, and it is not proof the inbox received a message.",
    countLabel(email.count),
    email.error ? "Unavailable" : null
  ));

  const sms = await db
    .from("notification_preferences")
    .select("user_id", { count: "exact", head: true })
    .eq("sms_marketing", true);
  metrics.push(metric(
    "Eligible SMS subscribers",
    "Current rows with SMS marketing still on. Registration alone does not count. A missing Twilio setup means these people are not being texted.",
    countLabel(sms.count),
    sms.error ? "Unavailable" : null
  ));

  const optedOut = await db
    .from("notification_preferences")
    .select("user_id", { count: "exact", head: true })
    .eq("email_promotions", false);
  metrics.push(metric(
    "Email opt-outs",
    "Current rows with promotional email turned off. This is the saved preference, not a provider unsubscribe event.",
    countLabel(optedOut.count),
    optedOut.error ? "Unavailable" : null
  ));

  const signups = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "customer")
    .gte("created_at", range.since)
    .lte("created_at", range.until);
  metrics.push(metric(
    "New registered users",
    `${range.label}. Accounts created in this range. Registration is not a campaign conversion.`,
    countLabel(signups.count),
    signups.error ? "Unavailable" : null
  ));

  const campaigns = await db
    .from("newsletter_campaigns")
    .select("id, status, failed_count, created_at")
    .gte("created_at", range.since)
    .lte("created_at", range.until)
    .limit(500);
  if (campaigns.error) {
    metrics.push(metric("Campaigns created", `${range.label}. Saved email campaigns.`, null, "Unavailable"));
    metrics.push(metric("Campaigns scheduled", "Saved status is scheduled.", null, "Unavailable"));
    metrics.push(metric("Campaigns processing", "Saved status is sending.", null, "Unavailable"));
  } else {
    const rows = campaigns.data ?? [];
    const owner = rows.map((row) => campaignOwnerStatus({
      status: String(row.status ?? ""),
      failedCount: Number(row.failed_count ?? 0),
    }));
    metrics.push(metric("Campaigns created", `${range.label}. Capped at 500 rows. An empty list is not a failed query.`, String(rows.length), null));
    metrics.push(metric("Campaigns scheduled", "Saved status is scheduled. The daily 09:00 UTC job sends them after that time.", String(owner.filter((item) => item === "Scheduled").length), null));
    metrics.push(metric("Campaigns processing", "Saved status is sending.", String(owner.filter((item) => item === "Processing").length), null));
  }

  const accepted = await db
    .from("newsletter_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", range.since)
    .lte("sent_at", range.until);
  metrics.push(metric(
    "Provider-accepted emails",
    `${range.label}. Resend accepted the send request. This is not a confirmed delivery, open, or click.`,
    countLabel(accepted.count),
    accepted.error ? "Unavailable" : null
  ));

  const failed = await db
    .from("newsletter_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");
  metrics.push(metric(
    "Email failures and skips",
    "Current recipient rows marked failed. This includes opted-out skips. It is not limited to the date filter when the failure time is not stored.",
    countLabel(failed.count),
    failed.error ? "Unavailable" : null
  ));

  metrics.push(metric("Confirmed inbox deliveries", "Resend delivery events are not stored here.", "Not tracked", null));
  metrics.push(metric("Clicks", "Campaign click tracking is not stored.", "Not tracked", null));
  metrics.push(metric("Verified campaign conversions", "A signup or deposit is not attributed to a campaign id.", "Not tracked", null));
  metrics.push(metric("Campaign revenue", "Wallet transfers are not marketing revenue.", "Not tracked", null));

  const resendReady = Boolean(process.env.RESEND_API_KEY?.trim());
  const twilioReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_FROM_NUMBER?.trim()
  );
  const telegramBot = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const telegramAdmin = Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID?.trim());
  const telegramPromo = Boolean(process.env.TELEGRAM_PROMO_CHAT_ID?.trim());

  return {
    metrics,
    providers: {
      email: resendReady ? "Resend key is present. A key does not prove a send reached an inbox." : "RESEND_API_KEY is missing. Email campaigns cannot send.",
      sms: twilioReady
        ? "Twilio account, token, and from-number are present. This does not confirm US campaign registration. SMS still requires sms_marketing to be on."
        : "Twilio is not fully configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER. No SMS will be sent.",
      telegram: !telegramBot
        ? "TELEGRAM_BOT_TOKEN is missing."
        : telegramPromo
          ? "A separate promo destination is set. Admin alerts stay on the admin chat."
          : telegramAdmin
            ? "Promo is not on its own destination. A promo send can use the same chat as admin alerts. Set TELEGRAM_PROMO_CHAT_ID before posting promotions."
            : "TELEGRAM_ADMIN_CHAT_ID is missing.",
    },
  };
}
