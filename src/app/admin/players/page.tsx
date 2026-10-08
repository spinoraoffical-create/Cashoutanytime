import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { NetworkPlayers } from "@/components/admin/network-players";
import { loadNetworkPlayers } from "@/lib/actions/agents";
import { requireAgentScope } from "@/lib/agents/scope";

export const metadata: Metadata = { title: "Network players" };

export default async function NetworkPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; parent?: string }>;
}) {
  const scope = await requireAgentScope();
  const params = await searchParams;
  const loaded = await loadNetworkPlayers({ q: params.q, parentId: params.parent });

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Players"
        description={
          scope.level === "sub"
            ? "Players who registered with your code."
            : scope.level === "store"
              ? "Players under you and your sub-creators."
              : "Every player, with the sub-creator who owns them."
        }
      />
      {loaded.error ? <p className="mb-4 text-sm text-destructive">{loaded.error}</p> : null}
      <NetworkPlayers
        rows={loaded.rows}
        parents={loaded.parents}
        canMove={scope.level !== "sub"}
        query={{ q: params.q, parent: params.parent }}
      />
    </div>
  );
}
