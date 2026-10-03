import type { Metadata } from "next";
import { revalidatePath } from "next/cache";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb, authorize } from "@/lib/actions/admin/core";
import { profileDisplayName } from "@/lib/admin/spinora-profile";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Bot Jobs" };

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-ws-green/15 text-ws-green-deep dark:text-ws-green",
  processing: "bg-blue-500/15 text-blue-400",
  completed:  "bg-ws-emerald/15 text-ws-emerald",
  failed:     "bg-red-500/15 text-red-400",
  cancelled:  "bg-foreground/8 text-muted-foreground",
};

const TYPE_LABELS: Record<string, string> = {
  new_account: "Create",
  reload: "Load",
  redeem: "Redeem",
  check_balance: "Balance",
};

// Money never moves on new_account / check_balance, so re-queuing them is safe.
const RETRYABLE = new Set(["new_account", "check_balance"]);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Re-queue a failed create/balance job (no wallet implications).
async function retryJob(id: string): Promise<void> {
  "use server";
  const auth = await authorize("requests.manage");
  if ("error" in auth) return;

  await adminDb()
    .from("game_load_requests")
    .update({ status: "pending", error_message: null, bot_attempts: 0, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("load_type", ["new_account", "check_balance"])
    .eq("status", "failed");

  revalidatePath("/admin/provision-jobs");
}

// Cancel a non-money job (create/balance). Money jobs (load/redeem) are cancelled
// by the player so the wallet refund stays atomic (cancel_my_game_load).
async function cancelJob(id: string): Promise<void> {
  "use server";
  const auth = await authorize("requests.manage");
  if ("error" in auth) return;

  await adminDb()
    .from("game_load_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("load_type", ["new_account", "check_balance"])
    .in("status", ["pending", "processing", "failed"]);

  revalidatePath("/admin/provision-jobs");
}

export default async function AdminBotJobsPage() {
  await requirePermission("requests.manage");
  const db = adminDb();

  const { data } = await db
    .from("game_load_requests")
    .select(
      "id, user_id, game_name, game_username, amount, wallet_type, load_type, status, bot_attempts, wallet_refunded, error_message, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    game_name: string;
    game_username: string | null;
    amount: number;
    wallet_type: "current" | "cashout";
    load_type: string;
    status: string;
    bot_attempts: number;
    wallet_refunded: boolean;
    error_message: string | null;
    created_at: string;
  }>;

  // Resolve player display names (admin client bypasses RLS).
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profs } = userIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map(
    (profs ?? []).map((p) => [p.id, profileDisplayName(p)])
  );

  const pending    = rows.filter((r) => r.status === "pending").length;
  const processing = rows.filter((r) => r.status === "processing").length;
  const failed     = rows.filter((r) => r.status === "failed").length;

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Bot Jobs"
        description={`${rows.length} total · ${pending} pending · ${processing} processing · ${failed} failed — the local bot fleet drains this queue`}
      />

      {rows.length === 0 ? (
        <GlassCard className="py-16 text-center text-muted-foreground">
          No jobs yet. Jobs appear here when players create accounts, load credits, or redeem.
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-foreground/8 hover:bg-transparent">
                  <TableHead>When</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tries</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isMoney = r.load_type === "reload" || r.load_type === "redeem";
                  return (
                    <TableRow key={r.id} className="border-foreground/8">
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(r.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">{r.game_name}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm text-muted-foreground">
                        {nameById.get(r.user_id) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-foreground/8 text-xs text-muted-foreground">
                          {TYPE_LABELS[r.load_type] ?? r.load_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.game_username ? `@${r.game_username}` : "—"}
                      </TableCell>
                      <TableCell className="tnum text-right text-ws-green-deep dark:text-ws-green">
                        {r.amount ? `$${r.amount.toLocaleString()}` : "—"}
                        {isMoney && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {r.wallet_type === "cashout" ? "cash-out" : "wallet"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[r.status] ?? "bg-foreground/8"}>{r.status}</Badge>
                        {r.status === "failed" && isMoney && r.wallet_refunded && (
                          <span className="ml-1 text-[10px] text-ws-emerald">refunded</span>
                        )}
                      </TableCell>
                      <TableCell className="tnum text-xs text-muted-foreground">{r.bot_attempts}</TableCell>
                      <TableCell
                        className="max-w-[220px] truncate text-xs text-red-400"
                        title={r.error_message ?? ""}
                      >
                        {r.error_message ?? ""}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {r.status === "failed" && RETRYABLE.has(r.load_type) && (
                            <form action={retryJob.bind(null, r.id)}>
                              <Button type="submit" size="sm" variant="outline">
                                Retry
                              </Button>
                            </form>
                          )}
                          {RETRYABLE.has(r.load_type) &&
                            ["pending", "processing", "failed"].includes(r.status) && (
                              <form action={cancelJob.bind(null, r.id)}>
                                <Button type="submit" size="sm" variant="ghost">
                                  Cancel
                                </Button>
                              </form>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
