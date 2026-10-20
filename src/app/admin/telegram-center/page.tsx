import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TelegramCenterActions, TelegramUpdateRecovery } from "@/components/admin/telegram-center-actions";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { requireSuperAdmin } from "@/lib/data/admin";
import { adminDb } from "@/lib/actions/admin/core";
import { botStatus } from "@/lib/telegram/control/delivery";
import { PLAYERS_DELIVERY_CHECK_EVENT, TELEGRAM_BOTS, TELEGRAM_DELIVERY_CRON, deliveryLatencyMs, deliveryPanelState, formatDeliveryLatency, safeTelegramTestError, webhookPath } from "@/lib/telegram/control/rules";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = { title: "Telegram Control Center" };

export default async function TelegramCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string }>;
}) {
  await requireSuperAdmin();
  const section = (await searchParams)?.section ?? "overview";
  const bots = TELEGRAM_BOTS.map((bot) => botStatus(bot));
  const db = adminDb();
  const jobsQuery = await db
    .from("telegram_delivery_jobs")
    .select("id, bot_key, category, status, attempt_count, last_error, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  const jobsUnavailable = Boolean(jobsQuery.error);
  const jobs = (jobsQuery.data ?? []) as Array<{
    id: string;
    bot_key: string;
    category: string;
    status: string;
    attempt_count: number;
    last_error: string | null;
    created_at: string;
  }>;
  const failed = jobs.filter((job) => job.status === "failed" || job.status === "uncertain" || job.status === "retry_pending" || job.status === "needs_investigation");
  const checkQuery = await db
    .from("telegram_delivery_jobs")
    .select("status, attempt_count, created_at, updated_at, last_error")
    .eq("event_key", PLAYERS_DELIVERY_CHECK_EVENT)
    .maybeSingle();
  const deliveryCheckUnavailable = Boolean(checkQuery.error);
  const checkRow = checkQuery.data as {
    status: string;
    attempt_count: number;
    created_at: string;
    updated_at: string;
    last_error: string | null;
  } | null;
  const deliveryCheck = checkRow
    ? {
        status: checkRow.status,
        attemptCount: checkRow.attempt_count,
        latency: formatDeliveryLatency(deliveryLatencyMs(checkRow.created_at, checkRow.updated_at)),
        error: safeTelegramTestError(checkRow.last_error),
      }
    : null;
  let summaryFailed = false;
  let summaryRows: Array<{
    status: string;
    bot_key: string;
    category: string;
    created_at: string;
    updated_at: string;
    last_error: string | null;
  }> = [];
  try {
    const summaryQuery = await db
      .from("telegram_delivery_jobs")
      .select("status, bot_key, category, created_at, updated_at, last_error")
      .order("updated_at", { ascending: false })
      .limit(200);
    summaryFailed = Boolean(summaryQuery.error);
    summaryRows = (summaryQuery.data ?? []) as typeof summaryRows;
  } catch {
    summaryFailed = true;
  }
  const panel = deliveryPanelState({
    queryFailed: summaryFailed,
    isSuperAdmin: true,
    rows: summaryRows.map((row) => ({
      status: row.status,
      bot: row.bot_key,
      category: row.category,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastError: row.last_error,
    })),
  });
  const updatesQuery = await db
    .from("telegram_webhook_updates")
    .select("bot_key, update_id, status, attempts, command_name, last_error")
    .eq("status", "exhausted")
    .order("update_id", { ascending: false })
    .limit(20);
  const updates = (updatesQuery.data ?? []) as Array<{
    bot_key: string;
    update_id: number;
    status: string;
    attempts: number;
    command_name: string | null;
    last_error: string | null;
  }>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-1">
      <AdminPageHeader
        title="Telegram Control Center"
        description={`A new alert is sent after the website finishes the operation. The daily cron at ${TELEGRAM_DELIVERY_CRON} UTC sends anything still waiting. Queued includes jobs waiting for a retry. Telegram acceptance is not a read receipt.`}
      />
      <nav className="flex gap-2 overflow-x-auto pb-1 text-sm">
        {[
          ["overview", "Overview"],
          ["bots", "Bots"],
          ["delivery", "Delivery"],
          ["failed", "Failed"],
          ["updates", "Updates"],
          ["settings", "Settings"],
        ].map(([key, label]) => (
          <a
            key={key}
            href={key === "overview" ? "/admin/telegram-center" : `/admin/telegram-center?section=${key}`}
            className={`shrink-0 rounded-full px-3 py-1 ${section === key ? "bg-white text-[#0b1224]" : "bg-white/10 text-[#d7e3ff]"}`}
          >
            {label}
          </a>
        ))}
      </nav>

      {section === "overview" || section === "bots" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {bots.map((bot) => (
            <AdminSectionCard key={bot.bot} title={bot.bot} description={`Webhook ${SITE_URL}${webhookPath(bot.bot)}`}>
              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge status={bot.token ? "Token set" : "Token missing"} />
                <AdminStatusBadge status={bot.secret ? "Secret set" : "Secret missing"} />
                <AdminStatusBadge status={bot.chat ? "Chat set" : "Chat missing"} />
              </div>
            </AdminSectionCard>
          ))}
        </div>
      ) : null}

      {section === "overview" || section === "delivery" ? (
        <AdminSectionCard title="Delivery status" description="Counts come from the latest 200 jobs. Errors are shortened and do not include message text.">
          {panel.kind === "hidden" ? (
            <AdminEmptyState title="Delivery status hidden" body="Only a Super Admin can see delivery status." />
          ) : panel.kind === "unavailable" ? (
            <AdminEmptyState title="Delivery status unavailable" body="The delivery counts could not be read. No alert was sent or changed." />
          ) : (
            <div className="space-y-3 text-sm text-[#d7e3ff]">
              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge status={`Queued ${panel.summary.counts.queued}`} />
                <AdminStatusBadge status={`Sending ${panel.summary.counts.sending}`} />
                <AdminStatusBadge status={`Accepted ${panel.summary.counts.accepted}`} />
                <AdminStatusBadge status={`Failed ${panel.summary.counts.failed}`} />
                <AdminStatusBadge status={`Uncertain ${panel.summary.counts.uncertain}`} />
              </div>
              <p>
                {panel.summary.lastSuccess
                  ? `Last success: ${panel.summary.lastSuccess.category} on ${panel.summary.lastSuccess.bot}${formatDeliveryLatency(panel.summary.lastSuccess.latencyMs) ? ` in ${formatDeliveryLatency(panel.summary.lastSuccess.latencyMs)}` : ""}.`
                  : "No accepted delivery in the latest 200 jobs."}
              </p>
              {panel.summary.problems.length > 0 ? (
                <ul className="space-y-1">
                  {panel.summary.problems.map((problem, index) => (
                    <li key={`${problem.bot}-${problem.category}-${index}`}>
                      {problem.status}: {problem.category} on {problem.bot}
                      {problem.error ? ` — ${problem.error}` : ""}
                      {formatDeliveryLatency(problem.latencyMs) ? ` (${formatDeliveryLatency(problem.latencyMs)})` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </AdminSectionCard>
      ) : null}

      {section === "overview" || section === "delivery" ? (
        <AdminSectionCard title="Delivery history" description="Statuses are queued, accepted, failed, retry pending, or uncertain. Accepted means Telegram took the message.">
          {jobsUnavailable ? (
            <AdminEmptyState title="Delivery history unavailable" body="Apply supabase/migrations/20261019000300_telegram_control_center.sql. Until then, the old Telegram sender still runs." />
          ) : jobs.length === 0 ? (
            <AdminEmptyState title="No delivery jobs" body="Alerts appear here after the SQL is applied and a bot token is set." />
          ) : (
            <ul className="divide-y divide-white/10">
              {jobs.map((job) => (
                <li key={job.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{job.category}</p>
                    <p className="text-[#9fb0d0]">{job.bot_key} · attempts {job.attempt_count}</p>
                    {job.last_error ? <p className="text-[#f0b4b4]">{safeTelegramTestError(job.last_error)}</p> : null}
                  </div>
                  <AdminStatusBadge status={job.status} />
                </li>
              ))}
            </ul>
          )}
        </AdminSectionCard>
      ) : null}

      {section === "failed" ? (
        <AdminSectionCard title="Failed and uncertain" description="Uncertain means Telegram may have received the message. It is not retried automatically.">
          {failed.length === 0 ? (
            <AdminEmptyState title="No failed jobs in the latest 40" body="Older failures stay in the database." />
          ) : (
            <ul className="space-y-2 text-sm text-[#d7e3ff]">
              {failed.map((job) => (
                <li key={job.id}>{job.status}: {job.category} {job.last_error ? `— ${safeTelegramTestError(job.last_error)}` : ""}</li>
              ))}
            </ul>
          )}
        </AdminSectionCard>
      ) : null}

      {section === "updates" ? (
        <AdminSectionCard title="Exhausted webhook updates" description="These updates stopped after five attempts. Reopen lets Telegram deliver the same update id again. It does not run the command and it does not move money.">
          {updatesQuery.error ? (
            <AdminEmptyState title="Webhook history unavailable" body="Apply the Telegram SQL before recovery tools can read update ids." />
          ) : updates.length === 0 ? (
            <AdminEmptyState title="No exhausted updates" body="A command that fails five times appears here with its command name, not the message text." />
          ) : (
            <ul className="space-y-3">
              {updates.map((update) => (
                <li key={`${update.bot_key}-${update.update_id}`} className="rounded-xl bg-white/5 p-3 text-sm text-[#d7e3ff]">
                  <p className="font-semibold text-white">{update.bot_key} · update {update.update_id}</p>
                  <p>Command: {update.command_name && /^[a-z]+$/.test(update.command_name) ? `/${update.command_name}` : "unavailable"} · attempts {update.attempts}</p>
                  {update.last_error ? <p className="text-[#f0b4b4]">{update.last_error}</p> : null}
                  <div className="mt-2">
                    <TelegramUpdateRecovery bot={update.bot_key} updateId={update.update_id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminSectionCard>
      ) : null}

      {section === "overview" || section === "settings" ? (
        <AdminSectionCard title="Owner tools" description="Owner test goes only to the saved owner chat. Payments, Players, and Errors each send one labeled test to that bot's saved chat. The real-time Players check sends one diagnostic message through the live queue. A second click does not send again. You cannot type a chat id here.">
          <TelegramCenterActions deliveryCheck={deliveryCheck} deliveryCheckUnavailable={deliveryCheckUnavailable} />
        </AdminSectionCard>
      ) : null}
    </div>
  );
}
