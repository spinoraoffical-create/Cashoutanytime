import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SubCreatorsManager } from "@/components/admin/sub-creators-manager";
import { loadAgentRows } from "@/lib/actions/agents";
import { requireAgentScope } from "@/lib/agents/scope";

export const metadata: Metadata = { title: "Sub-creators" };

export default async function SubCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; focus?: string }>;
}) {
  const scope = await requireAgentScope();
  if (scope.level === "sub") redirect("/admin/players");
  const params = await searchParams;
  const loaded = await loadAgentRows(params);
  const focus = loaded.rows.find((row) => row.userId === params.focus);

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Sub-creators"
        description="Store creators manage their own agents. A sub-creator only sees players who registered with their code."
      />
      {loaded.error ? <p className="mb-4 text-sm text-destructive">{loaded.error}</p> : null}
      {scope.missingTable ? (
        <p className="mb-4 text-sm text-destructive">
          Apply supabase/migrations/20261008000120_agent_network.sql in Supabase before creating agents.
        </p>
      ) : null}
      {focus ? (
        <p className="mb-4 rounded-2xl border border-border px-4 py-3 text-sm">
          {focus.name} has {focus.playerCount} players, wallet ${focus.wallet.toFixed(2)}, and an estimated commission rate of {focus.commissionBps / 100}%.
          Code {focus.promoCode}.
        </p>
      ) : null}
      <SubCreatorsManager
        rows={loaded.rows}
        stores={loaded.stores}
        canAddStore={scope.level === "platform"}
        query={params}
      />
    </div>
  );
}
