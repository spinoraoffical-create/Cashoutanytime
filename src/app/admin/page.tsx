import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { adminDb } from "@/lib/actions/admin/core";
import { profileDisplayName } from "@/lib/admin/spinora-profile";
import { AgentHome } from "@/components/admin/agent-home";
import { getAgentScope } from "@/lib/agents/scope";
import { can, requireStaff } from "@/lib/data/admin";

type FeedItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
  at: string;
};

async function headCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
) {
  try {
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function AdminOverviewPage() {
  const scope = await getAgentScope();
  if (scope && (scope.level === "store" || scope.level === "sub")) {
    return <AgentHome scope={scope} />;
  }
  const ctx = await requireStaff();
  const db = adminDb();
  const money = can(ctx, "requests.manage");
  const support = can(ctx, "support.manage");
  const players = can(ctx, "users.manage");
  const kyc = can(ctx, "cms.manage");
  const analytics = can(ctx, "analytics.read");

  const [pendingDeposits, pendingLoads, openTickets, pendingKyc, fraudFlags, todayUsers, weekUsers, monthUsers, todayDeposits, weekDeposits, monthDeposits] =
    await Promise.all([
      money
        ? headCount(db.from("deposit_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]))
        : Promise.resolve(0),
      money
        ? headCount(db.from("game_load_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]))
        : Promise.resolve(0),
      support
        ? headCount(db.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "pending", "in_progress"]))
        : Promise.resolve(0),
      kyc
        ? headCount(db.from("kyc_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"))
        : Promise.resolve(0),
      ctx.isSuperAdmin
        ? headCount(
            db
              .from("fraud_scores")
              .select("user_id", { count: "exact", head: true })
              .or("rewards_blocked.eq.true,blocked.eq.true,manual_review.eq.true,risk_score.gte.50")
          )
        : Promise.resolve(0),
      players ? headCount(db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since(1))) : Promise.resolve(0),
      players ? headCount(db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since(7))) : Promise.resolve(0),
      players ? headCount(db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since(30))) : Promise.resolve(0),
      money
        ? headCount(db.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", since(1)))
        : Promise.resolve(0),
      money
        ? headCount(db.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", since(7)))
        : Promise.resolve(0),
      money
        ? headCount(db.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", since(30)))
        : Promise.resolve(0),
    ]);

  const attention = [
    money ? { href: "/admin/deposits?status=pending", label: "Pending deposits", count: pendingDeposits } : null,
    money ? { href: "/admin/game-loads", label: "Pending wallet loads", count: pendingLoads } : null,
    support ? { href: "/admin/support", label: "Open tickets", count: openTickets } : null,
    kyc ? { href: "/admin/kyc", label: "New identity checks", count: pendingKyc } : null,
    ctx.isSuperAdmin ? { href: "/admin/fraud", label: "Fraud flags", count: fraudFlags } : null,
  ].filter((item): item is { href: string; label: string; count: number } => Boolean(item));

  const feed: FeedItem[] = [];
  if (players) {
    const { data } = await db
      .from("profiles")
      .select("id, full_name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    for (const row of data ?? []) {
      if (!row.created_at) continue;
      feed.push({
        id: `user-${row.id}`,
        href: `/admin/users/${row.id}`,
        title: `${profileDisplayName(row)} joined`,
        meta: "Player",
        at: row.created_at,
      });
    }
  }
  if (support) {
    const { data } = await db
      .from("support_tickets")
      .select("id, ticket_no, subject, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    for (const row of data ?? []) {
      feed.push({
        id: `ticket-${row.id}`,
        href: `/admin/support/${row.id}`,
        title: `#${row.ticket_no} ${row.subject}`,
        meta: "Ticket",
        at: row.created_at,
      });
    }
  }
  if (money) {
    const { data } = await db
      .from("deposit_requests")
      .select("id, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    for (const row of data ?? []) {
      feed.push({
        id: `deposit-${row.id}`,
        href: "/admin/deposits",
        title: `Deposit ${row.amount != null ? `$${Number(row.amount).toFixed(2)}` : ""}`.trim(),
        meta: row.status,
        at: row.created_at,
      });
    }
  }
  feed.sort((a, b) => (a.at < b.at ? 1 : -1));

  const actions = [
    money ? { href: "/admin/deposits?status=pending", label: "Review deposits" } : null,
    money ? { href: "/admin/payouts", label: "Process cash outs" } : null,
    players ? { href: "/admin/users", label: "Find a player" } : null,
    support ? { href: "/admin/support", label: "Open support" } : null,
    kyc ? { href: "/admin/kyc", label: "Review identity" } : null,
    analytics ? { href: "/admin/analytics", label: "View reports" } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Dashboard"
        description="What needs a decision right now."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {attention.map((item) => (
          <Link key={item.href + item.label} href={item.href}>
            <GlassCard className="flex items-center justify-between p-4 transition-colors hover:border-ws-green/40">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-3xl font-black tabular-nums">{item.count.toLocaleString()}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </GlassCard>
          </Link>
        ))}
      </div>

      <GlassCard className="mt-4 overflow-hidden">
        <div className="grid grid-cols-3 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <p className="px-4 py-3">Today</p>
          <p className="px-4 py-3">7 days</p>
          <p className="px-4 py-3">30 days</p>
        </div>
        <div className="grid grid-cols-3">
          <Metric label="New players" values={[todayUsers, weekUsers, monthUsers]} />
          <Metric label="Completed deposits" values={[todayDeposits, weekDeposits, monthDeposits]} />
        </div>
      </GlassCard>

      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background"
          >
            {action.label}
          </Link>
        ))}
      </div>

      <GlassCard className="mt-6 p-5">
        <h2 className="font-bold">Recent activity</h2>
        <ul className="mt-3 divide-y divide-border">
          {feed.slice(0, 8).length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No recent activity for your role.</li>
          ) : (
            feed.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <Link href={item.href} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="text-xs capitalize text-muted-foreground">{item.meta}</p>
                </Link>
                <time dateTime={item.at} className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                </time>
              </li>
            ))
          )}
        </ul>
      </GlassCard>
    </div>
  );
}

function Metric({ label, values }: { label: string; values: number[] }) {
  return (
    <>
      {values.map((value, index) => (
        <div key={`${label}-${index}`} className="border-t border-border px-4 py-3 first:border-t-0 sm:border-t-0">
          <p className="text-lg font-black tabular-nums">{value.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </>
  );
}
