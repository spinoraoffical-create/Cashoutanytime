export type MarketingRange = "today" | "7" | "30" | "custom";

export function parseMarketingRange(input: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
}, now = Date.now()): { id: MarketingRange; since: string; until: string; label: string } {
  const until = input.to && !Number.isNaN(Date.parse(input.to)) ? new Date(input.to) : new Date(now);
  const range = input.range === "today" || input.range === "30" || input.range === "custom" ? input.range : "7";
  if (range === "custom" && input.from && !Number.isNaN(Date.parse(input.from))) {
    return {
      id: "custom",
      since: new Date(input.from).toISOString(),
      until: until.toISOString(),
      label: "Custom range",
    };
  }
  const days = range === "today" ? 1 : range === "30" ? 30 : 7;
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    id: range === "custom" ? "7" : range,
    since: since.toISOString(),
    until: until.toISOString(),
    label: range === "today" ? "Today" : range === "30" ? "Last 30 days" : "Last 7 days",
  };
}

/** Resend acceptance is not a confirmed inbox delivery. */
export function emailProviderStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "pending":
      return "Waiting to send";
    case "sent":
      return "Accepted by the email provider";
    case "failed":
      return "Failed or skipped";
    default:
      return "Unknown";
  }
}

export function campaignOwnerStatus(input: {
  status: string;
  failedCount?: number | null;
}): "Draft" | "Scheduled" | "Processing" | "Completed" | "Partially Failed" | "Failed" | "Cancelled" {
  if (input.status === "draft") return "Draft";
  if (input.status === "scheduled") return "Scheduled";
  if (input.status === "sending") return "Processing";
  if (input.status === "cancelled") return "Cancelled";
  if (input.status === "failed") return "Failed";
  if (input.status === "sent" && Number(input.failedCount ?? 0) > 0) return "Partially Failed";
  if (input.status === "sent") return "Completed";
  return "Draft";
}

export const MARKETING_CRON_JOBS = [
  {
    name: "Email campaign sender",
    path: "/api/cron/newsletter-send",
    scheduled: true,
    schedule: "Daily at 09:00 UTC. The Hobby plan allows one run a day.",
    sendsOnDeploy: false,
  },
  {
    name: "Search indexing",
    path: "/api/cron/seo-index",
    scheduled: true,
    schedule: "Daily at 08:00 UTC",
    sendsOnDeploy: false,
  },
  {
    name: "Telegram promo",
    path: "/api/cron/telegram-promo",
    scheduled: false,
    schedule: "Not on the Vercel schedule",
    sendsOnDeploy: false,
  },
  {
    name: "Telegram auto-post",
    path: "/api/cron/telegram-auto-post",
    scheduled: false,
    schedule: "Not on the Vercel schedule",
    sendsOnDeploy: false,
  },
  {
    name: "AI blog",
    path: "/api/cron/auto-blog",
    scheduled: false,
    schedule: "Not on the Vercel schedule",
    sendsOnDeploy: false,
  },
] as const;
