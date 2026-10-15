import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminCountChart } from "@/components/admin/ui/admin-count-chart";
import { AdminDataTable } from "@/components/admin/ui/admin-data-table";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { adminDb } from "@/lib/actions/admin/core";
import { loadAutomationHealth } from "@/lib/automation/health";
import { profileDisplayName } from "@/lib/admin/spinora-profile";
import { AgentHome } from "@/components/admin/agent-home";
import { getAgentScope } from "@/lib/agents/scope";
import { can, requireStaff } from "@/lib/data/admin";
import { platformTicketAccess } from "@/lib/support/ticket-access";
import { countOpenTickets, listRecentTickets } from "@/lib/support/ticket-store";

type FeedItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
  at: string;
};

async function headCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number | null> {
  try {
    const { count, error } = await query;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function statusCount(
  table: "game_load_requests" | "cashout_holds" | "webhook_events",
  status: string
): Promise<number | null> {
  try {
    const { count, error } = await adminDb()
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function utcDayStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export default async function AdminOverviewPage() {
  const scope = await getAgentScope();
  if (scope && (scope.level === "store" || scope.level === "sub")) {
    return <AgentHome scope={scope} />;
  }
  const ctx = await requireStaff();
  const db = adminDb();
  const money = can(ctx, "requests.manage");
  const ticketAccess = await platformTicketAccess();
  const support = ticketAccess.tickets;
  const players = can(ctx, "users.manage");
  const kyc = can(ctx, "kyc.manage");
  const analytics = can(ctx, "analytics.read");

  const [pendingDeposits, pendingLoads, openTickets, pendingKyc, fraudFlags, todayUsers, weekUsers, monthUsers, todayDeposits, weekDeposits, monthDeposits] =
    await Promise.all([
      money
        ? headCount(db.from("deposit_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]))
        : Promise.resolve(null),
      money
        ? headCount(db.from("game_load_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]))
        : Promise.resolve(null),
      support ? countOpenTickets() : Promise.resolve(0),
      kyc
        ? headCount(db.from("kyc_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"))
        : Promise.resolve(null),
      ctx.isSuperAdmin
        ? headCount(
            db
              .from("fraud_scores")
              .select("user_id", { count: "exact", head: true })
              .or("rewards_blocked.eq.true,blocked.eq.true,manual_review.eq.true,risk_score.gte.50")
          )
        : Promise.resolve(null),
      players ? headCount(db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since(1))) : Promise.resolve(null),
      players ? headCount(db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since(7))) : Promise.resolve(null),
      players ? headCount(db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since(30))) : Promise.resolve(null),
      money
        ? headCount(db.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", since(1)))
        : Promise.resolve(null),
      money
        ? headCount(db.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", since(7)))
        : Promise.resolve(null),
      money
        ? headCount(db.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", since(30)))
        : Promise.resolve(null),
    ]);

  const attention = [
    money ? { href: "/admin/deposits?status=pending", label: "Pending deposits", count: pendingDeposits, hint: "Deposit records still marked pending." } : null,
    money ? { href: "/admin/game-loads", label: "Pending wallet loads", count: pendingLoads, hint: "Game loads still marked pending or processing." } : null,
    support ? { href: "/admin/support", label: "Open tickets", count: openTickets, hint: "Open this queue to take the next action." } : null,
    kyc ? { href: "/admin/kyc", label: "New identity checks", count: pendingKyc, hint: "Identity records still marked pending." } : null,
    ctx.isSuperAdmin ? { href: "/admin/fraud", label: "Fraud flags", count: fraudFlags, hint: "Open this queue to take the next action." } : null,
    money ? { href: "/admin/failed-loads", label: "Failed game loads", count: await statusCount("game_load_requests", "failed"), hint: "Game-load records marked failed. Opens the failed-load list." } : null,
    money ? { href: "/admin/cashout-holds", label: "Held cash outs", count: await statusCount("cashout_holds", "held"), hint: "Cash outs marked held. The wallet is not debited while they stay held." } : null,
  ].filter((item): item is { href: string; label: string; count: number | null; hint: string } => Boolean(item));

  const dayStart = utcDayStart();
  const [depositsToday, cashoutsToday, seenToday, storesOnFile, subsOnFile, linkedPlayers] = await Promise.all([
    money
      ? headCount(
          db.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", dayStart)
        )
      : Promise.resolve(null),
    money
      ? headCount(
          db
            .from("wallet_transactions")
            .select("id", { count: "exact", head: true })
            .eq("wallet_type", "cashout")
            .eq("transaction_type", "debit")
            .gte("created_at", dayStart)
        )
      : Promise.resolve(null),
    players
      ? headCount(db.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", dayStart))
      : Promise.resolve(null),
    players
      ? headCount(db.from("agent_accounts").select("user_id", { count: "exact", head: true }).eq("tier", "store_creator").eq("active", true))
      : Promise.resolve(null),
    players
      ? headCount(db.from("agent_accounts").select("user_id", { count: "exact", head: true }).eq("tier", "sub_creator").eq("active", true))
      : Promise.resolve(null),
    players
      ? headCount(db.from("profiles").select("id", { count: "exact", head: true }).not("parent_agent_id", "is", null))
      : Promise.resolve(null),
  ]);
  const failedWebhooks = ctx.isSuperAdmin ? await statusCount("webhook_events", "failed") : null;

  const feed: FeedItem[] = [];
  let activityFailed = false;
  if (players) {
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) activityFailed = true;
    for (const row of error ? [] : data ?? []) {
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
    const data = await listRecentTickets(5);
    if (data == null) activityFailed = true;
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
    const { data, error } = await db
      .from("deposit_requests")
      .select("id, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) activityFailed = true;
    for (const row of error ? [] : data ?? []) {
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

  let recentTx: { id: string; amount: number | null; wallet_type: string | null; transaction_type: string | null; source: string | null; created_at: string | null }[] | null = null;
  if (money) {
    const { data, error } = await db
      .from("wallet_transactions")
      .select("id, amount, wallet_type, transaction_type, source, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    recentTx = error ? null : (data ?? []);
  }

  let loadIssues: { id: string; game_name: string | null; status: string | null; amount: number | null; created_at: string | null }[] | null = null;
  if (money) {
    const { data, error } = await db
      .from("game_load_requests")
      .select("id, game_name, status, amount, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(5);
    loadIssues = error ? null : (data ?? []);
  }

  let kycRows: { id: string; user_name: string | null; status: string | null; created_at: string | null }[] | null = null;
  if (kyc) {
    const { data, error } = await db
      .from("kyc_submissions")
      .select("id, user_name, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);
    kycRows = error ? null : (data ?? []);
  }

  const operator = ctx.isSuperAdmin || ctx.roles.some((role) => role === "admin" || role === "manager");
  let automation: { name: string; label: string }[] | null = null;
  if (operator) {
    try {
      const health = await loadAutomationHealth();
      automation = health.jobs.map((job) => ({ name: job.name, label: job.label }));
    } catch {
      automation = null;
    }
  }

  const actions = [
    money ? { href: "/admin/deposits?status=pending", label: "Review deposits" } : null,
    money ? { href: "/admin/payouts", label: "Process cash outs" } : null,
    players ? { href: "/admin/users", label: "Find a player" } : null,
    support ? { href: "/admin/support", label: "Open support" } : null,
    kyc ? { href: "/admin/kyc", label: "Review identity" } : null,
    analytics ? { href: "/admin/analytics", label: "View reports" } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AdminPageHeader
        title="Dashboard"
        description="These numbers come from the live database. If a count cannot be loaded, it says Unavailable."
        action={
          <div className="rounded-2xl border border-[#7c3aed]/30 bg-[#12182e] px-4 py-2">
            <p className="text-xs font-semibold text-[#c4b5fd]">{roleLabel(ctx)}</p>
            <p className="max-w-[16rem] truncate text-sm text-white">{ctx.email ?? "Account email is not on file."}</p>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {money ? (
          <AdminStatCard href="/admin/deposits" label="Deposits completed today" value={showCount(depositsToday)} hint="Completed deposit records since 00:00 UTC. This is a count, not revenue." />
        ) : null}
        {money ? (
          <AdminStatCard href="/admin/payouts" label="Cash-out debits today" value={showCount(cashoutsToday)} hint="Cash-out wallet debit rows since 00:00 UTC. This is not profit." />
        ) : null}
        {players ? (
          <AdminStatCard href="/admin/users" label="Players seen today" value={showCount(seenToday)} hint="Profiles with a last-seen time since 00:00 UTC." />
        ) : null}
      </div>

      {attention.length > 0 ? (
        <AdminSectionCard title="Needs attention" description="These counts are pending work or warnings. Each card opens the existing page. Nothing on this list moves money by itself.">
          <ul className="grid gap-3 sm:grid-cols-2">
            {attention.map((item) => (
              <li key={item.href + item.label}>
                <Link
                  href={item.href}
                  title={item.hint}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${attentionTone(item.label, item.count)}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{item.label}</span>
                    <span className="block text-xs leading-5 text-[#9fb0d0]">{item.hint}</span>
                  </span>
                  <span className="shrink-0 text-2xl font-semibold tabular-nums text-white">{showCount(item.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </AdminSectionCard>
      ) : (
        <AdminEmptyState title="No attention items" body="This role does not have a pending queue on the dashboard." />
      )}

      {money || players ? (
        <AdminSectionCard title="Activity counts" description="Completed deposit records and new player profiles. A day-by-day history is not available from the current data source. These bars are the existing 24-hour, 7-day, and 30-day counts. This chart is not revenue.">
          <div className="grid gap-6 lg:grid-cols-2">
            {money ? (
              <AdminCountChart
                title="Completed deposits"
                caption="Count of deposit records marked completed."
                points={[
                  { label: "24 hours", value: todayDeposits },
                  { label: "7 days", value: weekDeposits },
                  { label: "30 days", value: monthDeposits },
                ]}
              />
            ) : null}
            {players ? (
              <AdminCountChart
                title="New players"
                caption="Count of player profiles created in each window."
                points={[
                  { label: "24 hours", value: todayUsers },
                  { label: "7 days", value: weekUsers },
                  { label: "30 days", value: monthUsers },
                ]}
              />
            ) : null}
          </div>
        </AdminSectionCard>
      ) : null}

      {actions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <AdminQuickAction key={action.href} href={action.href} label={action.label} detail="Opens the existing tool. It does not move money by itself." />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {money ? (
          <AdminSectionCard title="Recent transactions" description="Latest wallet rows. Amounts are the stored row amounts.">
            {recentTx == null ? (
              <AdminErrorState title="Unavailable" body="The transaction list could not be loaded." />
            ) : (
              <AdminDataTable
                columns={[
                  { key: "when", label: "When" },
                  { key: "amount", label: "Amount" },
                  { key: "type", label: "Type" },
                  { key: "source", label: "Source" },
                ]}
                rows={recentTx.map((row) => ({
                  when: row.created_at ? formatDistanceToNow(new Date(row.created_at), { addSuffix: true }) : "Unavailable",
                  amount: row.amount == null ? "Unavailable" : `$${Number(row.amount).toFixed(2)}`,
                  type: <AdminStatusBadge status={row.transaction_type ?? "unknown"} />,
                  source: row.source ?? row.wallet_type ?? "Unavailable",
                }))}
                emptyTitle="No transactions yet"
                emptyBody="New wallet rows will show up here."
              />
            )}
          </AdminSectionCard>
        ) : null}

        <AdminSectionCard title="Recent activity" description="Newest players, tickets, and deposits your role can see.">
          {activityFailed && feed.length === 0 ? (
            <AdminErrorState title="Unavailable" body="Recent activity could not be loaded." />
          ) : feed.length === 0 ? (
            <AdminEmptyState title="No recent activity" body="Nothing new is waiting in the feeds you can open." />
          ) : (
            <ul className="divide-y divide-white/10">
              {activityFailed ? (
                <li className="py-3 text-xs text-[#9fb0d0]">
                  One feed could not be loaded. The rows below are only the feeds that loaded.
                </li>
              ) : null}
              {feed.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={item.href} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs capitalize text-[#9fb0d0]">{item.meta}</p>
                  </Link>
                  <time dateTime={item.at} className="shrink-0 text-xs text-[#9fb0d0]">
                    {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </AdminSectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {money ? (
          <AdminSectionCard title="Game-load issues" description="The newest loads already marked failed.">
            {loadIssues == null ? (
              <AdminErrorState title="Unavailable" body="Failed game loads could not be loaded." />
            ) : (
              <AdminDataTable
                columns={[
                  { key: "game", label: "Game" },
                  { key: "amount", label: "Amount" },
                  { key: "status", label: "Status" },
                ]}
                rows={loadIssues.map((row) => ({
                  game: row.game_name ?? "Unavailable",
                  amount: row.amount == null ? "Unavailable" : Number(row.amount).toFixed(2),
                  status: <AdminStatusBadge status={row.status ?? "failed"} />,
                }))}
                emptyTitle="No failed loads"
                emptyBody="There are no failed game loads in the latest rows."
              />
            )}
          </AdminSectionCard>
        ) : null}

        {kyc ? (
          <AdminSectionCard title="Identity checks" description="Pending reviews. Photos stay on the identity page.">
            {kycRows == null ? (
              <AdminErrorState title="Unavailable" body="Identity checks could not be loaded." />
            ) : (
              <AdminDataTable
                columns={[
                  { key: "name", label: "Player" },
                  { key: "status", label: "Status" },
                ]}
                rows={kycRows.map((row) => ({
                  name: row.user_name ?? "Player",
                  status: <AdminStatusBadge status={row.status ?? "pending"} />,
                }))}
                emptyTitle="No pending identity checks"
                emptyBody="New ID uploads will show up here."
              />
            )}
          </AdminSectionCard>
        ) : null}
      </div>

      {players ? (
        <AdminSectionCard title="Store activity" description="Counts of stores and linked players. This is not revenue.">
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminStatCard label="Active stores" value={showCount(storesOnFile)} hint="Store accounts marked active." />
            <AdminStatCard label="Active sub-creators" value={showCount(subsOnFile)} hint="Sub-creator accounts marked active." />
            <AdminStatCard label="Players linked to a store" value={showCount(linkedPlayers)} hint="Players with a parent store or sub-creator, including inactive parents." />
          </div>
        </AdminSectionCard>
      ) : null}

      {operator ? (
        <AdminSectionCard title="Automation health" description="Saved job status. This page does not start a job or send a payment.">
          {automation == null ? (
            <AdminErrorState title="Unavailable" body="Automation health could not be loaded." />
          ) : (
            <ul className="space-y-2">
              {automation.map((job) => (
                <li key={job.name} className="flex items-center justify-between gap-3 rounded-xl bg-[#0b1224] px-3 py-2">
                  <span className="text-sm text-white">{job.name}</span>
                  <AdminStatusBadge status={job.label} />
                </li>
              ))}
            </ul>
          )}
        </AdminSectionCard>
      ) : null}

      {ctx.isSuperAdmin ? (
        <AdminSectionCard title="System health" description="Whether a key is present. The key itself is not shown.">
          <ul className="space-y-2 text-sm text-[#d5def2]">
            <li>Email sender: {process.env.RESEND_API_KEY?.trim() ? "Configured" : "Not configured"}</li>
            <li>Scheduled job secret: {process.env.CRON_SECRET?.trim() ? "Configured" : "Not configured"}</li>
            <li>Paydora webhook secret: {process.env.PAYDORA_WEBHOOK_SECRET?.trim() ? "Configured" : "Not configured"}</li>
            <li>Failed webhooks: {showCount(failedWebhooks)}</li>
          </ul>
        </AdminSectionCard>
      ) : null}
    </div>
  );
}

function attentionTone(label: string, count: number | null) {
  if (count == null) return "border-white/10 bg-[#0c1224]";
  if (count === 0) return "border-white/10 bg-[#0c1224]";
  const name = label.toLowerCase();
  if (name.includes("failed") || name.includes("fraud")) return "border-rose-400/40 bg-rose-500/10";
  return "border-[#7c3aed]/40 bg-[#1a1440]";
}

function roleLabel(ctx: { isSuperAdmin: boolean; roles: string[] }) {
  if (ctx.isSuperAdmin) return "Super Admin";
  if (ctx.roles.includes("admin")) return "Admin";
  if (ctx.roles.includes("manager")) return "Manager";
  return "Platform staff";
}

function showCount(count: number | null) {
  return count == null ? "Unavailable" : count.toLocaleString();
}
