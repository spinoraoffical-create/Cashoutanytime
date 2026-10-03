"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferralShare } from "@/components/dashboard/referral-share";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardRouteLoading } from "@/components/dashboard/dashboard-route-loading";
import { useDashboardSession } from "@/lib/dashboard/use-dashboard-session";
import { useDashboardProfile } from "@/lib/dashboard/dashboard-profile-context";
import { formatDate } from "@/lib/utils";

interface ReferralRow {
  id: string;
  reward_points: number;
  created_at: string;
  referred: { full_name?: string | null; email?: string } | null;
}

export function ReferralsPageClient() {
  const dashboardProfile = useDashboardProfile();
  const { supabase, userId, ready } = useDashboardSession();
  const [referralCode, setReferralCode] = useState(
    () => dashboardProfile?.profile.referral_code ?? ""
  );
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready || !supabase || !userId) return;

    let cancelled = false;
    void supabase
      .from("referrals")
      .select("*, referred:profiles!referrals_referred_id_fkey(full_name, email)")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        if (!referralCode && dashboardProfile?.profile.referral_code) {
          setReferralCode(dashboardProfile.profile.referral_code);
        }
        setReferrals((data ?? []) as ReferralRow[]);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, supabase, userId, dashboardProfile]);

  if (!loaded) {
    return <DashboardRouteLoading cards={3} />;
  }

  const totalPoints = referrals.reduce((sum, r) => sum + r.reward_points, 0);

  return (
    <div>
      <DashboardPageHeader
        title="Referral Program"
        description="Share your link and earn VIP points"
      />

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold gradient-text">{referrals.length}</p>
            <p className="text-sm text-muted-foreground">Total Referrals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold gradient-text">{totalPoints}</p>
            <p className="text-sm text-muted-foreground">Points Earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <ReferralShare code={referralCode} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No referrals yet. Share your link to start earning points!
            </p>
          ) : (
            <div className="space-y-3">
              {referrals.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {ref.referred?.full_name || ref.referred?.email || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(ref.created_at)}</p>
                  </div>
                  <p className="text-sm font-semibold text-primary">+{ref.reward_points} pts</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
