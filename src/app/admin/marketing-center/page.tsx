import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { loadMarketingCenter } from "@/lib/admin/marketing-center-data";
import { MARKETING_CRON_JOBS, parseMarketingRange } from "@/lib/admin/marketing-center-rules";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

export default async function MarketingCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const ctx = await requireStaff();
  const params = await searchParams;
  const range = parseMarketingRange(params);
  const canEmail = can(ctx, "newsletters.manage");
  const snapshot = canEmail ? await loadMarketingCenter(range) : null;

  const tools = [
    canEmail
      ? { href: "/admin/marketing-center/create", title: "Create campaign", body: "Save an email draft, or schedule it after you confirm. Opening this does not send." }
      : null,
    canEmail
      ? { href: "/admin/newsletters", title: "Email campaigns", body: "Test, send, or schedule a saved email. A player who turns notices off is skipped again before the send." }
      : null,
    can(ctx, "cms.manage")
      ? { href: "/admin/marketing", title: "Text one player", body: "Copy one text or open one WhatsApp chat. This does not send bulk SMS." }
      : null,
    can(ctx, "cms.manage")
      ? { href: "/admin/telegram", title: "Telegram channel", body: "Post only when you use the send button. Promo and admin alerts should not share a chat." }
      : null,
    can(ctx, "notifications.broadcast")
      ? { href: "/admin/notifications", title: "In-app notices", body: "Send a notice inside the site. This is not email or SMS." }
      : null,
    can(ctx, "promotions.manage")
      ? { href: "/admin/promotions", title: "Promotions", body: "Turn site promotions on or off. This screen does not send a campaign." }
      : null,
    ctx.isSuperAdmin || ctx.roles.includes("store_creator") || ctx.roles.includes("sub_creator")
      ? { href: "/admin/offers", title: "One-time offers", body: "One email and one SMS to people who agreed. This does not change wallet math." }
      : null,
  ].filter((tool): tool is { href: string; title: string; body: string } => Boolean(tool));

  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Marketing center"
        description="Real saved counts. A failed read says Unavailable. Accepted by the email provider is not the same as delivered. Clicks, conversions, and revenue stay Not tracked until those events are stored."
      />
      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <label className="text-sm text-[#9fb0d0]">
          Date range
          <select name="range" defaultValue={range.id} className="mt-1 block min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white">
            <option value="today">Today</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="text-sm text-[#9fb0d0]">
          From
          <input name="from" type="datetime-local" className="mt-1 block min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white" />
        </label>
        <label className="text-sm text-[#9fb0d0]">
          To
          <input name="to" type="datetime-local" className="mt-1 block min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white" />
        </label>
        <button className="min-h-11 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white" type="submit">Apply</button>
      </form>
      <p className="mb-4 text-sm text-[#9fb0d0]">Showing {range.label}. Store staff do not see the network counts.</p>
      {snapshot ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {snapshot.metrics.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 p-4">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-white">{item.error ?? item.value}</p>
                <p className="mt-1 text-xs leading-5 text-[#9fb0d0]">{item.help}</p>
              </div>
            ))}
          </div>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 p-4 text-sm text-[#d5def2]"><p className="font-semibold text-white">Email</p><p className="mt-2">{snapshot.providers.email}</p></div>
            <div className="rounded-2xl border border-white/10 p-4 text-sm text-[#d5def2]"><p className="font-semibold text-white">SMS</p><p className="mt-2">{snapshot.providers.sms}</p></div>
            <div className="rounded-2xl border border-white/10 p-4 text-sm text-[#d5def2]"><p className="font-semibold text-white">Telegram</p><p className="mt-2">{snapshot.providers.telegram}</p></div>
          </div>
          <div className="mb-6 rounded-2xl border border-white/10 p-4">
            <p className="font-semibold text-white">Automation</p>
            <p className="mt-1 text-xs text-[#9fb0d0]">A job that is not on the schedule does not run by itself. Deploying this page does not send an old campaign. There were no saved email campaigns waiting.</p>
            <ul className="mt-3 space-y-2 text-sm text-[#d5def2]">
              {MARKETING_CRON_JOBS.map((job) => (
                <li key={job.path}>
                  <span className="text-white">{job.name}</span> · {job.scheduled ? "Scheduled" : "Not scheduled"} · {job.schedule}. Last run: Not tracked.
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="mb-6 text-sm text-[#9fb0d0]">Network campaign counts are hidden for this account. Use the tools you are allowed to open.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <AdminQuickAction key={tool.href} href={tool.href} label={tool.title} detail={tool.body} />
        ))}
      </div>
      <p className="mt-4 text-sm">
        <Link className="text-cyan-200 underline" href="/admin/ai-blog">AI blog stays a draft until you publish it.</Link>
      </p>
    </div>
  );
}
