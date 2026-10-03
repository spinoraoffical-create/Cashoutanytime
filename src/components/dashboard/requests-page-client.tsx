"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GameRequestFromUrl } from "@/components/dashboard/game-request-from-url";
import { GameRequestsLiveRefresh } from "@/components/requests/game-requests-live-refresh";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardRouteLoading } from "@/components/dashboard/dashboard-route-loading";
import { useDashboardSession } from "@/lib/dashboard/use-dashboard-session";
import { formatDate } from "@/lib/utils";
import type { GameRequest, RequestStatus } from "@/types/database";

const GameRequestForm = dynamic(
  () =>
    import("@/components/dashboard/game-request-form").then((m) => ({
      default: m.GameRequestForm,
    })),
  { loading: () => <Skeleton className="h-48 w-full rounded-lg" /> }
);

const statusVariant: Record<RequestStatus, "default" | "warning" | "success" | "destructive"> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  rejected: "destructive",
};

export function RequestsPageClient() {
  const { supabase, userId, ready } = useDashboardSession();
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready || !supabase || !userId) return;

    let cancelled = false;
    void supabase
      .from("game_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setRequests((data ?? []) as GameRequest[]);
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
      <GameRequestsLiveRefresh />
      <Suspense fallback={null}>
        <GameRequestFromUrl />
      </Suspense>
      <DashboardPageHeader
        title="Game Requests"
        description="Request and track your game accounts"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>New Request</CardTitle>
            </CardHeader>
            <CardContent>
              <GameRequestForm />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {requests.length > 0 ? (
            requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{req.game_name}</h3>
                      <p className="text-xs text-muted-foreground">{req.game_provider}</p>
                    </div>
                    <Badge variant={statusVariant[req.status as RequestStatus]}>{req.status}</Badge>
                  </div>
                  {req.notes && <p className="text-sm text-muted-foreground mb-2">{req.notes}</p>}
                  {req.credentials && req.status === "completed" && (
                    <div className="mt-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-xs text-green-400 font-semibold mb-1">Your Credentials</p>
                      <p className="text-sm font-mono">{req.credentials}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(req.created_at)}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No requests yet. Submit your first game account request!
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
