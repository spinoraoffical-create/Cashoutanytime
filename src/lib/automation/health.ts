import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import { AI_SETTINGS_IDS } from "@/lib/ai/settings";
import { classifyJob, healthLabel, needsPersonPayout, type JobHealth } from "@/lib/automation/health-rules";

export type AutomationJobView = {
  name: string;
  path: string;
  health: JobHealth;
  label: string;
  detail: string;
};

export type AutomationHealth = {
  jobs: AutomationJobView[];
  alerts: string[];
  summary: { label: string; value: string }[];
  providers: { name: string; configured: boolean }[];
};

const SCHEDULED = new Set(["/api/cron/seo-index"]);

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function loadAutomationHealth(now = new Date()): Promise<AutomationHealth> {
  const db = adminDb();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();

  const [blog, telegram, chatbot, campaigns, webhooks, payouts] = await Promise.all([
    db.from("ai_blog_settings").select("is_enabled, last_generated_at, posting_frequency_hours").eq("id", AI_SETTINGS_IDS.blog).maybeSingle(),
    db.from("ai_telegram_settings").select("autopilot_enabled, last_autopilot_at").eq("id", AI_SETTINGS_IDS.telegram).maybeSingle(),
    db.from("ai_chatbot_settings").select("is_enabled").eq("id", AI_SETTINGS_IDS.chatbot).maybeSingle(),
    db.from("newsletter_campaigns").select("status, scheduled_at, updated_at").in("status", ["scheduled", "sending", "failed"]),
    db.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", dayAgo),
    db.from("paydora_payout_requests").select("status, provider_status").in("status", ["reserved", "submitted"]).limit(200),
  ]);

  const blogRow = blog.error ? null : (blog.data as { is_enabled?: boolean; last_generated_at?: string | null; posting_frequency_hours?: number } | null);
  const telegramRow = telegram.error ? null : (telegram.data as { autopilot_enabled?: boolean; last_autopilot_at?: string | null } | null);
  const chatbotRow = chatbot.error ? null : (chatbot.data as { is_enabled?: boolean } | null);

  const drafts: Omit<AutomationJobView, "label">[] = [
    {
      name: "Search index",
      path: "/api/cron/seo-index",
      health: classifyJob({
        scheduled: SCHEDULED.has("/api/cron/seo-index"),
        switchOn: null,
        lastRunAt: null,
        expectedEveryHours: 24,
        now,
      }),
      detail: "Daily at 08:00 UTC in vercel.json. This app does not store the last successful call.",
    },
    {
      name: "AI blog",
      path: "/api/cron/auto-blog",
      health: classifyJob({
        scheduled: false,
        switchOn: blog.error ? null : blogRow ? Boolean(blogRow.is_enabled) : null,
        lastRunAt: blogRow?.last_generated_at ?? null,
        expectedEveryHours: Number(blogRow?.posting_frequency_hours) || 24,
        now,
      }),
      detail: blog.error
        ? "The saved switch could not be loaded."
        : blogRow?.last_generated_at
          ? `Last saved run ${new Date(blogRow.last_generated_at).toLocaleString()}.`
          : "No saved run.",
    },
    {
      name: "Telegram autopilot",
      path: "/api/cron/auto-post",
      health: classifyJob({
        scheduled: false,
        switchOn: telegram.error ? null : telegramRow ? Boolean(telegramRow.autopilot_enabled) : null,
        lastRunAt: telegramRow?.last_autopilot_at ?? null,
        expectedEveryHours: 24,
        now,
      }),
      detail: telegram.error
        ? "The saved switch could not be loaded."
        : telegramRow?.last_autopilot_at
          ? `Last saved run ${new Date(telegramRow.last_autopilot_at).toLocaleString()}.`
          : "No saved run.",
    },
    {
      name: "Support chatbot",
      path: "/admin/ai-bot",
      health: (chatbot.error ? "unknown" : chatbotRow?.is_enabled === false ? "off" : chatbotRow ? "ok" : "unknown") satisfies JobHealth,
      detail: "Saved switch only. It does not post on a schedule.",
    },
  ];
  const jobs: AutomationJobView[] = drafts.map((job) => ({ ...job, label: healthLabel(job.health) }));

  const campaignRows = campaigns.error
    ? null
    : ((campaigns.data ?? []) as { status: string; scheduled_at: string | null; updated_at: string | null }[]);
  const stuckCampaigns =
    campaignRows?.filter((row) => {
      if (row.status === "sending") return true;
      if (row.status !== "scheduled" || !row.scheduled_at) return false;
      return new Date(row.scheduled_at).getTime() < now.getTime() - 3_600_000;
    }).length ?? null;
  const failedCampaigns = campaignRows?.filter((row) => row.status === "failed").length ?? null;

  const payoutRows = payouts.error
    ? null
    : ((payouts.data ?? []) as { status: string | null; provider_status: string | null }[]);
  const ambiguousPayouts = payoutRows?.filter((row) => needsPersonPayout(row.status, row.provider_status)).length ?? null;

  const failedWebhooks = webhooks.error ? null : (webhooks.count ?? 0);

  const alerts = [
    jobs.some((job) => job.health === "not_scheduled" && job.name !== "Support chatbot")
      ? "AI blog, Telegram, and newsletter jobs are not on the Vercel schedule. A switch that says on does not mean they are running."
      : null,
    jobs.some((job) => job.health === "stale") ? "A scheduled job's last saved run is later than expected." : null,
    stuckCampaigns ? `${stuckCampaigns} email campaign${stuckCampaigns === 1 ? " is" : "s are"} scheduled or still sending.` : null,
    ambiguousPayouts ? `${ambiguousPayouts} cash out${ambiguousPayouts === 1 ? "" : "s"} need a person. This screen does not pay them again.` : null,
    failedWebhooks ? `${failedWebhooks} payment webhook${failedWebhooks === 1 ? "" : "s"} failed in the last 24 hours.` : null,
  ].filter((item): item is string => Boolean(item));

  const show = (value: number | null) => (value == null ? "Not available" : String(value));

  return {
    jobs,
    alerts,
    summary: [
      { label: "Failed webhooks, 24 hours", value: show(failedWebhooks) },
      { label: "Email campaigns failed", value: campaigns.error ? "Not available" : show(failedCampaigns) },
      { label: "Email campaigns waiting", value: campaigns.error ? "Not available" : show(stuckCampaigns) },
      { label: "Cash outs needing a person", value: payouts.error ? "Not available" : show(ambiguousPayouts) },
    ],
    providers: [
      { name: "Paydora API key", configured: configured("PAYDORA_API_KEY") },
      { name: "Paydora webhook secret", configured: configured("PAYDORA_WEBHOOK_SECRET") },
      { name: "Resend email key", configured: configured("RESEND_API_KEY") },
      { name: "Twilio SMS", configured: configured("TWILIO_ACCOUNT_SID") && configured("TWILIO_AUTH_TOKEN") && configured("TWILIO_FROM_NUMBER") },
      { name: "Telegram bot token", configured: configured("TELEGRAM_BOT_TOKEN") },
      { name: "Cron secret", configured: configured("CRON_SECRET") },
    ],
  };
}
