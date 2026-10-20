import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TelegramCenterActions, TelegramUpdateRecovery } from "@/components/admin/telegram-center-actions";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { requireSuperAdmin } from "@/lib/data/admin";
import { adminDb } from "@/lib/actions/admin/core";
import { botStatus } from "@/lib/telegram/control/delivery";
import { loadTelegramMonitoring } from "@/lib/telegram/control/coverage";
import { PLAYERS_DELIVERY_CHECK_EVENT, TELEGRAM_BOTS, TELEGRAM_DELIVERY_CRON, deliveryLatencyMs, formatDeliveryLatency, safeTelegramTestError, webhookPath } from "@/lib/telegram/control/rules";
import { SITE_URL } from "@/lib/constants";

const STATUS_LABELS = [
  ["queued", "Queued"],
  ["retry_pending", "Retry pending"],
  ["sending", "Sending"],
  ["accepted", "Accepted"],
  ["failed", "Failed"],
  ["uncertain", "Uncertain"],
  ["unconfigured", "Unconfigured"],
  ["duplicate", "Duplicate"],
  ["needs_investigation", "Needs investigation"],
] as const;

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
  const monitoring = await loadTelegramMonitoring(db, true);
  const counts = monitoring.counts;
  const coverage = monitoring.coverage;
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
        description={`A new alert is sent after the website finishes the operation. The daily cron at ${TELEGRAM_DELIVERY_CRON} UTC sends queued and retry-pending jobs that are still waiting. Uncertain and failed jobs are not retried. Telegram acceptance is not a read receipt.`}
      />
      <nav className="flex gap-2 overflow-x-auto pb-1 text-sm">
        {[
          ["overview", "Overview"],
          ["bots", "Bots"],
          ["delivery", "Delivery"],
          ["missing", "Missing"],
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
        <AdminSectionCard title="Delivery status" description="Each count includes every job in that status. Retry pending is not added to queued. The recent list below is not the count.">
          {counts.kind === "hidden" ? (
            <AdminEmptyState title="Delivery status hidden" body="Only a Super Admin can see delivery status." />
          ) : counts.kind === "unavailable" ? (
            <AdminEmptyState title="Delivery status unavailable" body="The delivery counts could not be read. No alert was sent or changed." />
          ) : (
            <div className="space-y-3 text-sm text-[#d7e3ff]">
              <div className="flex flex-wrap gap-2">
                {STATUS_LABELS.map(([status, label]) => (
                  <AdminStatusBadge key={status} status={`${label} ${counts.summary.counts[status]}`} />
                ))}
                {counts.summary.other > 0 ? <AdminStatusBadge status={`Other ${counts.summary.other}`} /> : null}
              </div>
              <p>
                {monitoring.lastSuccess
                  ? `Last success: ${monitoring.lastSuccess.category} on ${monitoring.lastSuccess.bot}${formatDeliveryLatency(deliveryLatencyMs(monitoring.lastSuccess.createdAt, monitoring.lastSuccess.updatedAt)) ? ` in ${formatDeliveryLatency(deliveryLatencyMs(monitoring.lastSuccess.createdAt, monitoring.lastSuccess.updatedAt))}` : ""}.`
                  : "No accepted delivery is stored."}
              </p>
              {monitoring.problems.length > 0 ? (
                <ul className="space-y-1">
                  {monitoring.problems.map((problem, index) => (
                    <li key={`${problem.bot}-${problem.category}-${index}`}>
                      {problem.status}: {problem.category} on {problem.bot}
                      {problem.error ? ` — ${safeTelegramTestError(problem.error)}` : ""}
                      {formatDeliveryLatency(deliveryLatencyMs(problem.createdAt, problem.updatedAt)) ? ` (${formatDeliveryLatency(deliveryLatencyMs(problem.createdAt, problem.updatedAt))})` : ""}
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

      {section === "overview" || section === "missing" ? (
        <AdminSectionCard title="Missing notifications" description="Read only, from 20 October 2026, 00:00 UTC. A job in any status, including uncertain or failed, is not missing. Nothing is inserted or sent.">
          {coverage.kind === "hidden" ? (
            <AdminEmptyState title="Missing notifications hidden" body="Only a Super Admin can see this comparison." />
          ) : coverage.kind === "unavailable" ? (
            <AdminEmptyState title="Missing notifications unavailable" body="The comparison could not be read. No alert was sent or changed." />
          ) : coverage.confirmed.length === 0 && coverage.unproven.length === 0 && coverage.unread.length === 0 && !coverage.truncated ? (
            <AdminEmptyState title="No missing notifications" body="Every checked business event in this window has a delivery job, or it is not eligible for an alert." />
          ) : (
            <div className="space-y-4 text-sm text-[#d7e3ff]">
              {coverage.truncated ? <p>The comparison reached its row limit. Older rows in this window were not checked.</p> : null}
              {coverage.unread.length > 0 ? <p>These sources could not be read, so they are not included: {coverage.unread.join(", ")}.</p> : null}
              <div>
                <p className="font-semibold text-white">Confirmed missing ({coverage.confirmed.length})</p>
                <p className="mb-2 text-[#9fb0d0]">The path that stores this alert ran, and no delivery job exists.</p>
                {coverage.confirmed.length === 0 ? <p>None.</p> : (
                  <ul className="space-y-2">
                    {coverage.confirmed.slice(0, 40).map((item) => (
                      <li key={item.eventKey}>
                        <span className="font-semibold text-white">{item.bot}</span> · {item.reference}
                        <br />
                        <span className="break-all text-[#9fb0d0]">{item.eventKey}</span>
                        <br />
                        {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
                {coverage.confirmed.length > 40 ? <p className="mt-2">{coverage.confirmed.length - 40} more confirmed gaps are not listed.</p> : null}
              </div>
              <div>
                <p className="font-semibold text-white">Callback not proven ({coverage.unproven.length})</p>
                <p className="mb-2 text-[#9fb0d0]">The business record exists, but the alert is stored only on a callback or branch this record does not prove.</p>
                {coverage.unproven.length === 0 ? <p>None.</p> : (
                  <ul className="space-y-2">
                    {coverage.unproven.slice(0, 40).map((item) => (
                      <li key={item.eventKey}>
                        <span className="font-semibold text-white">{item.bot}</span> · {item.reference}
                        <br />
                        <span className="break-all text-[#9fb0d0]">{item.eventKey}</span>
                        <br />
                        {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
                {coverage.unproven.length > 40 ? <p className="mt-2">{coverage.unproven.length - 40} more unproven rows are not listed.</p> : null}
              </div>
            </div>
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
