import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import type { AgentRow } from "@/lib/actions/agents";

function roleName(label: string) {
  if (label === "store_creator") return "Store";
  if (label === "sub_creator") return "Sub-creator";
  if (label === "store_sub_creator") return "Store sub-creator";
  return label.replaceAll("_", " ");
}

export function StoreAccountFocus({ row, rows }: { row: AgentRow; rows: AgentRow[] }) {
  const directSubs = rows.filter((item) => item.tier === "sub_creator" && item.managerId === row.userId);
  const fields = [
    ["Account", row.name],
    ["Email", row.email || "No email"],
    ["Phone", row.phone || "No phone"],
    ["Kind", roleName(row.roleLabel)],
    ["Signup code", row.promoCode],
    ["Managed by", row.managerName],
    ["Opened", row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "Unavailable"],
    ["Deposit approval limit", row.approveLimit == null ? "Not set" : `$${row.approveLimit.toFixed(2)}`],
  ];

  return (
    <div className="mb-4 space-y-3">
      <AdminSectionCard
        title="Account overview"
        description="Stored account details. Editing, deactivating, and password reset stay in the directory below. Those actions change the account. They do not send a payment."
        action={<AdminStatusBadge status={row.active ? "Active" : "Inactive"} />}
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-[#8ea0c3]">{label}</dt>
              <dd className="mt-1 text-sm text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </AdminSectionCard>
      <div className="grid gap-3 lg:grid-cols-3">
        <AdminSectionCard title="Assigned players" description="Players whose account points directly at this store or sub-creator.">
          <p className="text-3xl font-semibold tabular-nums text-white">{row.playerCount.toLocaleString()}</p>
          <Link href={`/admin/players?parent=${row.userId}`} className="mt-3 inline-flex text-sm font-semibold text-cyan-200">
            Open these players
          </Link>
        </AdminSectionCard>
        <AdminSectionCard
          title="Sub-creators"
          description={row.tier === "store_creator" ? "Sub-creators managed by this store in the current list." : "A sub-creator does not manage other sub-creators."}
        >
          {row.tier === "store_creator" ? (
            directSubs.length ? (
              <ul className="space-y-1 text-sm text-white">
                {directSubs.map((sub) => (
                  <li key={sub.userId}>{sub.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#9fb0d0]">No sub-creators are listed under this store.</p>
            )
          ) : (
            <p className="text-sm text-[#9fb0d0]">Managed by {row.managerName}.</p>
          )}
        </AdminSectionCard>
        <AdminSectionCard title="Stored account figures" description="These numbers are already stored on the account. This view does not calculate profit and does not pay commission.">
          <p className="text-sm text-[#9fb0d0]">Wallet balance</p>
          <p className="text-2xl font-semibold tabular-nums text-white">${row.wallet.toFixed(2)}</p>
          <p className="mt-3 text-sm text-[#9fb0d0]">Stored commission rate</p>
          <p className="text-2xl font-semibold tabular-nums text-white">{(row.commissionBps / 100).toFixed(2)}%</p>
        </AdminSectionCard>
      </div>
    </div>
  );
}
