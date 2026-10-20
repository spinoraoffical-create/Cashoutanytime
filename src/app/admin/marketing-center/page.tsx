import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { loadMarketingCenter } from "@/lib/admin/marketing-center-data";
import { MARKETING_CRON_JOBS, parseMarketingRange } from "@/lib/admin/marketing-center-rules";
import { parseNepalLocalToUtc } from "@/lib/admin/nepal-time";
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
  const range = parseMarketingRange({
    range: params.range,
    from: params.from ? parseNepalLocalToUtc(params.from)?.toISOString() : null,
    to: params.to ? parseNepalLocalToUtc(params.to)?.toISOString() : null,
  });
  const canEmail = can(ctx, "newsletters.manage");
  const snapshot = canEmail ? await loadMarketingCenter(range) : null;

  const groups = [
    {
      title: "Email and newsletters",
      help: "Use this when you want to email players who agreed to promotional mail. Opening a page never sends.",
      tools: [
        canEmail ? { href: "/admin/marketing-center/create", title: "Write an email", body: "Save a draft. You still confirm before anyone is emailed." } : null,
        canEmail ? { href: "/admin/newsletters", title: "Saved emails", body: "Preview, test, send now, or choose a Nepal time. Check results on the same page." } : null,
      ],
    },
    {
      title: "Text messages",
      help: "Use this for one player at a time. There is no bulk text send on this site.",
      tools: [
        can(ctx, "cms.manage") ? { href: "/admin/marketing", title: "Text one player", body: "Copy one message or open one WhatsApp chat. Opt-out people stay out." } : null,
      ],
    },
    {
      title: "Offers and promotions",
      help: "Use this to turn an offer on or off. It does not email the list by itself.",
      tools: [
        can(ctx, "promotions.manage") ? { href: "/admin/promotions", title: "Promotions", body: "See which promotions are on, waiting, or finished." } : null,
        ctx.isSuperAdmin || ctx.roles.includes("store_creator") || ctx.roles.includes("sub_creator")
          ? { href: "/admin/offers", title: "One-time offers", body: "One email and one text to people who agreed. Wallet balances are not changed here." }
          : null,
        can(ctx, "referrals.manage") ? { href: "/admin/referrals", title: "Referrals", body: "See the existing referral tools. This page does not create a new referral system." } : null,
      ],
    },
    {
      title: "Automation",
      help: "These checks run on their own only when they are already turned on. This page does not start them.",
      tools: [
        can(ctx, "cms.manage") ? { href: "/admin/automation", title: "Automation", body: "See what is on or off. A last run is shown only when it is saved." } : null,
      ],
    },
    {
      title: "Content and search",
      help: "Use this for the blog. A draft stays unpublished until you publish it.",
      tools: [
        can(ctx, "cms.manage") ? { href: "/admin/ai-blog", title: "AI blog", body: "Review drafts. Publishing is a separate button." } : null,
        can(ctx, "cms.manage") ? { href: "/admin/content", title: "Site content", body: "Edit existing pages. This does not publish a blog draft." } : null,
      ],
    },
    {
      title: "Other messages",
      help: "Use this for Telegram posts and notices inside the site. They are not email.",
      tools: [
        can(ctx, "cms.manage") ? { href: "/admin/telegram", title: "Telegram posts", body: "A post goes out only when you press send." } : null,
        can(ctx, "notifications.broadcast") ? { href: "/admin/notifications", title: "Site notices", body: "A notice appears inside the site. It is not an email or a text." } : null,
        can(ctx, "support.manage") ? { href: "/admin/chat", title: "Player chat", body: "Read and reply to support messages." } : null,
      ],
    },
  ].map((group) => ({
    ...group,
    tools: group.tools.filter((tool): tool is { href: string; title: string; body: string } => Boolean(tool)),
  })).filter((group) => group.tools.length > 0);

  const tools = groups.flatMap((group) => group.tools);

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
          From (Nepal time)
          <input name="from" type="datetime-local" className="mt-1 block min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white" />
        </label>
        <label className="text-sm text-[#9fb0d0]">
          To (Nepal time)
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
            <p className="font-semibold text-white">Automatic checks</p>
            <p className="mt-1 text-xs text-[#9fb0d0]">Opening this page does not send email, texts, or Telegram posts. A check that is not set to run by itself stays off. Last run is unavailable until a run is saved.</p>
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
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="text-base font-semibold text-white">{group.title}</h2>
            <p className="mt-1 text-sm text-[#9fb0d0]">{group.help}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.tools.map((tool) => (
                <AdminQuickAction key={tool.href} href={tool.href} label={tool.title} detail={tool.body} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-white/10 p-4 text-sm text-[#d5def2]">
        <p className="font-semibold text-white">Search tools</p>
        <p className="mt-1 text-[#9fb0d0]">These open outside this site. They do not change campaigns.</p>
        <p className="mt-3 flex flex-wrap gap-4">
          <Link className="text-cyan-200 underline" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Google Search Console</Link>
          <Link className="text-cyan-200 underline" href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">Bing Webmaster Tools</Link>
        </p>
      </div>
    </div>
  );
}
