import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { getAgentScope } from "@/lib/agents/scope";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Money" };

export default async function MoneyCenterPage() {
  const scope = await getAgentScope();
  const network = scope && (scope.level === "store" || scope.level === "sub");
  if (!network) await requirePermission("requests.manage");
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
          title: "Incoming deposits",
            body: "Pending, processing, completed, and rejected deposit records. Completed records are not called revenue here.",
        },
        {
          href: "/admin/game-loads",
          title: "Wallet loads & redeems",
          body: "Pending, processing, completed, and failed loads. Pending players stay first.",
        },
        {
          href: "/admin/payouts",
          title: "Cash-out / payouts",
          body: "Players with a cash-out balance. Mark paid records the payout and removes that amount.",
        },
        {
          href: "/admin/transactions",
          title: "Transaction history",
          body: "Search one player and open their stored deposit and redeem history.",
        },
        {
          href: "/admin/requests",
          title: "Deposit records",
          body: "Opens the same deposit list. New deposits are confirmed by Paydora.",
        },
        {
          href: "/admin/failed-loads",
          title: "Failed loads",
          body: "Opens game loads marked failed. A retry does not credit the deposit again.",
        },
        {
          href: "/admin/cashout-holds",
          title: "Held cash outs",
          body: "Cash outs marked held. Saving the limit asks for confirmation.",
        },
      ];

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Financial center"
        description="Open deposits, loads, cash outs, and history. Each tool keeps its current actions. Opening a tool does not move money by itself."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <AdminQuickAction key={tool.href + tool.title} href={tool.href} label={tool.title} detail={tool.body} />
        ))}
      </div>
    </div>
  );
}
