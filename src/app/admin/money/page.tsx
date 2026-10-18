import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { loadFinancialOverview } from "@/lib/admin/financial-overview-data";
import { getAgentScope } from "@/lib/agents/scope";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Money" };

export default async function MoneyCenterPage() {
  const scope = await getAgentScope();
  const network = scope && (scope.level === "store" || scope.level === "sub");
  if (!network) await requirePermission("requests.manage");
  const metrics = network ? [] : await loadFinancialOverview();
  const tools = network
    ? [
        {
            href: "/admin/deposits?status=pending",
            title: "Incoming deposits",
            body:
              scope?.level === "sub"
                ? "Review pending deposits for your players. Larger amounts stay with the store creator."
                : "Review pending deposits for players under you and your sub-creators.",
          },
          {
            href: "/admin/failed-loads",
            title: "Failed loads",
            body: "Game loads marked failed. A retry does not credit the deposit again.",
          },
        ]
    : [
        {
          href: "/admin/deposits?status=pending",
          title: "Deposits",
          body: "Pending, processing, completed, and rejected deposit records. A note is not proof of payment.",
        },
        {
          href: "/admin/game-loads",
          title: "Game transactions",
          body: "Loads and redeems. Failed loads stay on the failed filter. Pending players stay first.",
        },
        {
          href: "/admin/failed-loads",
          title: "Failed loads",
          body: "Failed loads, missing refunds, unknown provider results, and requests still open after 30 minutes.",
        },
        {
          href: "/admin/payouts",
          title: "Withdrawals",
          body: "Players with a cash-out balance. This page does not send a payout. Paid is recorded only from the payout screen after confirmation.",
        },
        {
          href: "/admin/cashout-holds",
          title: "Held cash outs",
          body: "Held withdrawals. A held cash out does not by itself mean the money was sent.",
        },
        {
          href: "/admin/payout-operations",
          title: "Payout activity",
          body: "Read-only payout records. Submitted does not mean paid.",
        },
        {
          href: "/admin/transactions",
          title: "Wallet history",
          body: "Open one player's stored deposit-wallet and cash-out rows.",
        },
        {
          href: "/admin/transaction-explorer",
          title: "Transaction explorer",
          body: "Read-only search across wallet rows, deposits, game loads, and payout records.",
        },
        {
          href: "/admin/reconciliation",
          title: "Reconciliation",
          body: "Read-only alerts. Opening one does not refund or pay anyone.",
        },
        {
          href: "/admin/audit",
          title: "Reports and audit",
          body: "Staff audit records. An audit row is not a second wallet credit.",
        },
      ];

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Financial center"
        description="Open deposits, loads, cash outs, and history. Each tool keeps its current actions. Opening a tool does not move money by itself."
      />
      {metrics.length ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 p-4">
              <p className="text-sm font-semibold text-white">{metric.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{metric.error ? "Not available" : metric.value}</p>
              <p className="mt-1 text-xs leading-5 text-[#9fb0d0]">{metric.error ?? metric.definition}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <AdminQuickAction key={tool.href + tool.title} href={tool.href} label={tool.title} detail={tool.body} />
        ))}
      </div>
    </div>
  );
}
