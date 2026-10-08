import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Money Center" };

export default async function MoneyCenterPage() {
  await requirePermission("requests.manage");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Money Center"
        description="Approve deposits, move wallet loads, pay cash outs, and look up history. Every money change is confirmed on the next screen and written to the audit log."
      />
      <AdminToolGrid
        tools={[
          {
            href: "/admin/deposits?status=pending",
            title: "Incoming deposits",
            body: "Review payment proof, then approve or reject with an amount and a note.",
          },
          {
            href: "/admin/game-loads",
            title: "Wallet loads & redeems",
            body: "See each player's load and redeem queue, pending requests first.",
          },
          {
            href: "/admin/payouts",
            title: "Cash-out / payouts",
            body: "Pay players who have a cash-out balance and record the payout.",
          },
          {
            href: "/admin/transactions",
            title: "Transaction history",
            body: "Search one player and export their deposit and redeem history.",
          },
          {
            href: "/admin/requests",
            title: "Manual requests",
            body: "Older contact-us deposit requests that are not in the payment queue.",
          },
        ]}
      />
    </div>
  );
}
