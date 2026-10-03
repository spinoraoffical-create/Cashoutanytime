import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepositActions } from "@/components/admin/deposit-actions";
import { DepositsLiveRefresh } from "@/components/deposits/deposits-live-refresh";
import { DepositProofImage } from "@/components/deposits/deposit-proof-image";
import { getDepositMethod } from "@/lib/payments/methods";
import { cn, formatDate } from "@/lib/utils";
import type { RequestStatus } from "@/types/database";

const statusVariant: Record<RequestStatus, "default" | "warning" | "success" | "destructive"> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  rejected: "destructive",
};

const FILTER_TABS: { id: string; label: string; href: string }[] = [
  { id: "pending", label: "Pending", href: "/admin/deposits?status=pending" },
  { id: "processing", label: "Processing", href: "/admin/deposits?status=processing" },
  { id: "all", label: "All", href: "/admin/deposits" },
  { id: "completed", label: "Completed", href: "/admin/deposits?status=completed" },
  { id: "rejected", label: "Rejected", href: "/admin/deposits?status=rejected" },
];

export default async function AdminDepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = status ?? "all";
  const supabase = await createClient();

  let query = supabase
    .from("deposit_requests")
    .select("*, user:profiles!deposit_requests_user_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: deposits } = await query;

  return (
    <div className="mx-auto max-w-7xl">
      <DepositsLiveRefresh />
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Deposit Requests</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Review payment screenshots and confirm deposits — confirming credits the user&apos;s Total Deposit wallet
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              activeFilter === tab.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {!deposits?.length ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No deposit requests{status && status !== "all" ? ` with status "${status}"` : ""}.
            </CardContent>
          </Card>
        ) : (
          deposits.map((dep) => {
            const user = dep.user as { full_name?: string; email?: string };
            const method = getDepositMethod(dep.payment_method);
            return (
              <Card key={dep.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{dep.game_name}</h3>
                        <Badge variant={statusVariant[dep.status as RequestStatus]}>{dep.status}</Badge>
                        <Badge variant="outline">{method?.label ?? dep.payment_method}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {user?.full_name} ({user?.email})
                        {dep.amount != null && dep.amount > 0 && (
                          <span className="text-emerald-400 font-semibold"> · ${Number(dep.amount).toFixed(2)}</span>
                        )}
                      </p>
                      <DepositProofImage path={dep.proof_url} />
                      {dep.admin_notes && (
                        <p className="text-sm text-primary">Admin: {dep.admin_notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDate(dep.created_at)}</p>
                    </div>
                    <DepositActions
                      depositId={dep.id}
                      currentStatus={dep.status as RequestStatus}
                      amount={dep.amount != null ? Number(dep.amount) : null}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
