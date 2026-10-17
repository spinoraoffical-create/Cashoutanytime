import type { Metadata } from "next";

import { setProviderPause, reconcileTransfer } from "@/app/admin/game-automation/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { loadGameAutomationHealth, type Capability } from "@/lib/admin/game-automation-health";
import { requireSuperAdmin } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Game automation" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NOTICES: Record<string, string> = {
  paused: "Provider paused. No transfer was sent.",
  resumed: "Provider resumed. No transfer was sent. A live transfer still needs a supervised test.",
  reconciled: "Review saved. No wallet was credited or refunded.",
  unchanged: "That operation was already settled, or it could not be confirmed.",
  "ledger-missing": "The transfer ledger is not installed. Nothing was changed.",
  "reconcile-failed": "The review was not saved. No wallet was changed.",
  invalid: "That control was not accepted.",
};

function capabilityLabel(value: Capability) {
  if (value === "working") return "Working";
  if (value === "failed") return "Failed";
  if (value === "blocked") return "Blocked";
  if (value === "unavailable") return "Unavailable";
  return "Unverified";
}

function countText(value: number | null) {
  return value == null ? "Unavailable" : String(value);
}

export default async function GameAutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const health = await loadGameAutomationHealth();
  const notice = params.notice ? NOTICES[params.notice] : "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        title="Game automation"
        description="Connection and capability status for Fire Kirin, Milky Way, Orion Stars, and Panda Master. A capability stays unverified until that exact call has succeeded. This page does not create accounts, recharge, redeem, or change passwords."
      />
      {notice ? <p className="text-sm text-[#d6def6]">{notice}</p> : null}
      <p className="text-sm text-[#9fb0d0]">{health.ledgerNote}</p>
      <AdminSectionCard title="Provider health" description="Agent balance is read when this page opens for Fire Kirin and Milky Way. Orion Stars stays blocked. Panda Master has no API.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#8ea0c3]">
                <th className="px-2 py-2 font-medium">Provider</th>
                <th className="px-2 py-2 font-medium">Connection</th>
                <th className="px-2 py-2 font-medium">Last authentication</th>
                <th className="px-2 py-2 font-medium">Agent balance</th>
                <th className="px-2 py-2 font-medium">Lookup</th>
                <th className="px-2 py-2 font-medium">Create</th>
                <th className="px-2 py-2 font-medium">Recharge</th>
                <th className="px-2 py-2 font-medium">Redeem</th>
                <th className="px-2 py-2 font-medium">Pause</th>
              </tr>
            </thead>
            <tbody>
              {health.rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 align-top last:border-0">
                  <td className="px-2 py-3 text-white">{row.name}</td>
                  <td className="px-2 py-3">
                    <AdminStatusBadge status={capabilityLabel(row.connection)} />
                    <p className="mt-1 max-w-xs text-xs text-[#9fb0d0]">{row.connectionDetail}</p>
                  </td>
                  <td className="px-2 py-3 text-xs text-[#d6def6]">{row.lastAuthentication}</td>
                  <td className="px-2 py-3">
                    <p className="text-white">{row.agentBalance}</p>
                    <p className="mt-1 text-xs text-[#9fb0d0]">{row.lastRefresh}</p>
                  </td>
                  <td className="px-2 py-3"><AdminStatusBadge status={capabilityLabel(row.playerLookup)} /></td>
                  <td className="px-2 py-3"><AdminStatusBadge status={capabilityLabel(row.accountCreation)} /></td>
                  <td className="px-2 py-3"><AdminStatusBadge status={capabilityLabel(row.recharge)} /></td>
                  <td className="px-2 py-3"><AdminStatusBadge status={capabilityLabel(row.redemption)} /></td>
                  <td className="px-2 py-3">
                    {row.pause === "none" ? (
                      <p className="text-xs text-[#9fb0d0]">{row.pauseReason}</p>
                    ) : row.pause === "not_installed" ? (
                      <p className="text-xs text-[#9fb0d0]">Ledger not installed. Transfers are not sent.</p>
                    ) : (
                      <form action={setProviderPause} className="space-y-2">
                        <input type="hidden" name="provider" value={row.id} />
                        <input type="hidden" name="paused" value={row.pause === "paused" ? "false" : "true"} />
                        <AdminStatusBadge status={row.pause === "paused" ? "Paused" : "Resumed"} />
                        <p className="max-w-xs text-xs text-[#9fb0d0]">{row.pauseReason}</p>
                        <button type="submit" className="rounded-md border border-white/15 px-2 py-1 text-xs text-white">
                          {row.pause === "paused" ? "Resume" : "Pause"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSectionCard>
      <AdminSectionCard title="Operations waiting for review" description="Pending, submitted, unknown, and manual-review rows. Confirming or failing a row here does not credit, debit, or refund a wallet.">
        <p className="mb-3 text-sm text-[#d6def6]">
          Pending {countText(health.counts.pending)} · Submitted {countText(health.counts.submitted)} · Unknown {countText(health.counts.unknown)} · Manual review {countText(health.counts.manualReview)}
        </p>
        {health.reviews.length === 0 ? (
          <p className="text-sm text-[#9fb0d0]">{health.counts.installed ? "No operations are waiting." : "The queue is unavailable until the ledger migration is applied."}</p>
        ) : (
          <div className="space-y-3">
            {health.reviews.map((row) => (
              <form key={row.operationKey} action={reconcileTransfer} className="rounded-xl border border-white/10 p-3">
                <input type="hidden" name="operationKey" value={row.operationKey} />
                <p className="text-sm text-white">{row.provider} · {row.action} · {row.state} · ${row.amount.toFixed(2)}</p>
                <p className="mt-1 text-xs text-[#9fb0d0]">{row.message || "No provider message."} {row.updatedAt}</p>
                <label className="mt-2 block text-xs text-[#9fb0d0]">
                  Review note
                  <input name="note" maxLength={500} className="mt-1 w-full rounded-md border border-white/10 bg-transparent px-2 py-1 text-sm text-white" />
                </label>
                <div className="mt-2 flex gap-2">
                  <button name="decision" value="failed" className="rounded-md border border-white/15 px-2 py-1 text-xs text-white" type="submit">Mark failed</button>
                  <button name="decision" value="confirmed" className="rounded-md border border-white/15 px-2 py-1 text-xs text-white" type="submit">Mark confirmed</button>
                </div>
              </form>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
