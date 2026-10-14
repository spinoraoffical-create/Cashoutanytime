import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StoreHierarchyNote } from "@/components/admin/store-hierarchy";
import { NetworkPlayers } from "@/components/admin/network-players";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
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
    <div className="mx-auto max-w-[90rem]">
      <AdminPageHeader
        title="Players"
        description={
          scope.level === "sub"
            ? "Players who registered with your code. Opening a player does not change their balance."
            : scope.level === "store"
              ? "Players under you and your sub-creators. You can move a player to another sub-creator. Opening a player does not change their balance."
              : "Every player, with the store or sub-creator they belong to. Moving a player changes that assignment. Opening a player does not change their balance."
        }
      />
      <StoreHierarchyNote />
      <p className="mb-4 text-sm text-[#9fb0d0]">
        A dash under Sub-creator means that player is not assigned to a sub-creator.
        {scope.level === "sub"
          ? " This list does not include players outside your code."
          : " Moving a selected player changes that assignment. It does not change the wallet."}
      </p>
      {loaded.error ? <div className="mb-4"><AdminErrorState title="Player list unavailable" body={loaded.error} /></div> : null}
      <NetworkPlayers
        rows={loaded.rows}
        parents={loaded.parents}
        canMove={scope.level !== "sub"}
        showParentFilter={scope.level !== "sub"}
        showIp={scope.level === "platform"}
        query={{ q: params.q, parent: params.parent }}
      />
    </div>
  );
}
