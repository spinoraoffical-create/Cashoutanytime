import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RetryLoadButton } from "@/components/admin/retry-load-button";
import { adminDb } from "@/lib/actions/admin/core";
import { getAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Failed loads" };

export default async function FailedLoadsPage() {
  const ctx = await getStaffContext();
  const scope = await getAgentScope();
  const platform = Boolean(ctx && (ctx.isSuperAdmin || can(ctx, "requests.manage")));
  const network = scope && (scope.level === "store" || scope.level === "sub");
  if (!platform && !network) redirect("/admin");

  const db = adminDb();
  let userIds: string[] | null = null;
  if (network && !platform && scope) {
    const { data: owned } = scope.parentIds.length
      ? await db.from("profiles").select("id").in("parent_agent_id", scope.parentIds).limit(1000)
      : { data: [] as { id: string }[] };
    userIds = ((owned ?? []) as { id: string }[]).map((row) => row.id);
  }

  type LoadRow = {
    id: string;
    user_id: string;
    game_name: string;
    amount: number;
    status: string;
    error_message: string | null;
    source_key: string | null;
    created_at: string;
  };
  let query = db
    .from("game_load_requests")
    .select("id, user_id, game_name, amount, status, error_message, source_key, created_at")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(100);
  if (userIds) query = userIds.length ? query.in("user_id", userIds) : query.eq("user_id", "00000000-0000-0000-0000-000000000000");
  const loaded = await query;
  let rows = (loaded.data ?? []) as LoadRow[];
  let error = loaded.error;
  if (loaded.error && /source_key|column|schema cache/i.test(loaded.error.message)) {
    let fallback = db
      .from("game_load_requests")
      .select("id, user_id, game_name, amount, status, error_message, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(100);
    if (userIds) fallback = userIds.length ? fallback.in("user_id", userIds) : fallback.eq("user_id", "00000000-0000-0000-0000-000000000000");
    const retry = await fallback;
    rows = ((retry.data ?? []) as Omit<LoadRow, "source_key">[]).map((row) => ({ ...row, source_key: null }));
    error = retry.error;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Failed loads"
        description="The deposit credit already happened once. Retry only sends the game load again."
      />
      {error ? <p className="mb-4 text-sm text-destructive">Could not load failed game loads.</p> : null}
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {rows.length === 0 ? <li className="p-6 text-sm text-muted-foreground">No failed loads.</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{row.game_name} · ${Number(row.amount).toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">{row.error_message || "Game API failed."}</p>
            </div>
            {row.source_key?.startsWith("auto:") && scope?.level !== "sub" ? <RetryLoadButton requestId={row.id} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
