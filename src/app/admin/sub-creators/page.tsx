import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StoreAccountFocus } from "@/components/admin/store-account-focus";
import { StoreHierarchyNote } from "@/components/admin/store-hierarchy";
import { SubCreatorsManager } from "@/components/admin/sub-creators-manager";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
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
        title="Stores and sub-creators"
        description="A store is a business account. A sub-creator works under one store. A player is a customer. Deactivate, edit, and password reset change the account. They do not send a payment."
      />
      <StoreHierarchyNote />
      {loaded.error ? (
        <div className="mb-4">
          <AdminErrorState title="Store list unavailable" body={loaded.error} />
        </div>
      ) : null}
      {scope.missingTable ? (
        <div className="mb-4">
          <AdminErrorState
            title="Store list unavailable"
            body="Apply supabase/migrations/20261008000120_agent_network.sql in Supabase before creating agents."
          />
        </div>
      ) : null}
      {focus ? <StoreAccountFocus row={focus} rows={loaded.rows} /> : null}
      <SubCreatorsManager
        rows={loaded.rows}
        stores={loaded.stores}
        canAddStore={scope.level === "platform"}
        query={params}
      />
    </div>
  );
}
