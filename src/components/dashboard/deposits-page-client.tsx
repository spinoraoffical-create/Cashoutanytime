"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepositProofImage } from "@/components/deposits/deposit-proof-image";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardRouteLoading } from "@/components/dashboard/dashboard-route-loading";
import { useDashboardSession } from "@/lib/dashboard/use-dashboard-session";
import { getDepositMethod, type DepositPaymentMethodId } from "@/lib/payments/methods";
import { formatDate } from "@/lib/utils";
import type { RequestStatus } from "@/types/database";

interface DepositRow {
  id: string;
  game_name: string;
  payment_method: string;
  status: string;
  amount: number | null;
  proof_url: string | null;
  created_at: string;
}

const statusVariant: Record<RequestStatus, "default" | "warning" | "success" | "destructive"> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  rejected: "destructive",
};

export function DepositsPageClient() {
  const { supabase, userId, ready } = useDashboardSession();
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready || !supabase || !userId) return;

    let cancelled = false;
    void supabase
      .from("deposit_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setDeposits((data ?? []) as DepositRow[]);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ready, supabase, userId]);

  if (!loaded) {
    return <DashboardRouteLoading cards={2} />;
  }

  return (
    <div>
      <DashboardPageHeader
        title="My Deposits"
        description="Track your deposit proofs and status"
      />

      <div className="space-y-4">
        {deposits.length > 0 ? (
          deposits.map((dep) => {
            const method = getDepositMethod(dep.payment_method as DepositPaymentMethodId);
            return (
              <Card key={dep.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold">{dep.game_name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {method?.label ?? dep.payment_method}
                      </p>
                    </div>
                    <Badge variant={statusVariant[dep.status as RequestStatus]}>{dep.status}</Badge>
                  </div>
                  {dep.amount != null && dep.amount > 0 && (
                    <p className="text-sm text-emerald-400 font-semibold mb-2">
                      ${Number(dep.amount).toFixed(2)}
                    </p>
                  )}
                  {dep.proof_url && <DepositProofImage path={dep.proof_url} />}
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(dep.created_at)}</p>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No deposits yet.{" "}
              <Link href="/dashboard/deposit" className="text-orange-400 hover:underline">
                Make a deposit
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
