import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TelegramCenterActions } from "@/components/admin/telegram-center-actions";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { requireSuperAdmin } from "@/lib/data/admin";
import { adminDb } from "@/lib/actions/admin/core";
import { botStatus } from "@/lib/telegram/control/delivery";
import { TELEGRAM_BOTS, webhookPath } from "@/lib/telegram/control/rules";
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
  const failed = jobs.filter((job) => job.status === "failed" || job.status === "uncertain" || job.status === "retry_pending");

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-1">
      <AdminPageHeader
        title="Telegram Control Center"
        description="Five bots, one delivery record. A message Telegram accepts is not a message a person has read. Tokens stay on the server."
      />
      <nav className="flex gap-2 overflow-x-auto pb-1 text-sm">
        {[
          ["overview", "Overview"],
          ["bots", "Bots"],
          ["delivery", "Delivery"],
          ["failed", "Failed"],
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
                    {job.last_error ? <p className="text-[#f0b4b4]">{job.last_error}</p> : null}
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
                <li key={job.id}>{job.status}: {job.category} {job.last_error ? `— ${job.last_error}` : ""}</li>
              ))}
            </ul>
          )}
        </AdminSectionCard>
      ) : null}

      {section === "overview" || section === "settings" ? (
        <AdminSectionCard title="Owner tools" description="The test goes only to the owner chat saved in the server environment. You cannot type a chat id here.">
          <TelegramCenterActions />
        </AdminSectionCard>
      ) : null}
    </div>
  );
}
