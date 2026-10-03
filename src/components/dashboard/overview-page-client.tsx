"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Crown, Users, Bell, Star, Gamepad2 } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardRouteLoading } from "@/components/dashboard/dashboard-route-loading";
import { ReviewsPreviewClient } from "@/components/dashboard/reviews-preview-client";
import { useDashboardSession } from "@/lib/dashboard/use-dashboard-session";
import { useDashboardProfile } from "@/lib/dashboard/dashboard-profile-context";
import { VIP_TIERS } from "@/lib/constants";

interface OverviewStats {
  referralCount: number;
  notifCount: number;
  reviewCount: number;
  vipTier: string;
  vipPoints: number;
  fullName: string | null;
}

export function OverviewPageClient() {
  const dashboardProfile = useDashboardProfile();
  const { supabase, userId, ready } = useDashboardSession();
  const [stats, setStats] = useState<OverviewStats | null>(() => {
    if (!dashboardProfile) return null;
    return {
      referralCount: 0,
      notifCount: 0,
      reviewCount: 0,
      vipTier: dashboardProfile.profile.vip_tier,
      vipPoints: dashboardProfile.profile.vip_points,
      fullName: dashboardProfile.profile.full_name,
    };
  });

  useEffect(() => {
    if (!ready || !supabase || !userId) return;

    let cancelled = false;

    void Promise.all([
      supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", userId),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false),
      supabase.from("reviews").select("*", { count: "exact", head: true }),
    ]).then(([refRes, notifRes, reviewRes]) => {
      if (cancelled) return;
      setStats((prev) => ({
        referralCount: refRes.count ?? 0,
        notifCount: notifRes.count ?? 0,
        reviewCount: reviewRes.count ?? 0,
        vipTier: prev?.vipTier ?? dashboardProfile?.profile.vip_tier ?? "bronze",
        vipPoints: prev?.vipPoints ?? dashboardProfile?.profile.vip_points ?? 0,
        fullName: prev?.fullName ?? dashboardProfile?.profile.full_name ?? null,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [ready, supabase, userId, dashboardProfile]);

  if (!stats) {
    return <DashboardRouteLoading cards={4} />;
  }

  const currentTier = VIP_TIERS.find((t) => t.id === stats.vipTier);
  const nextTier = VIP_TIERS[VIP_TIERS.findIndex((t) => t.id === stats.vipTier) + 1];
  const progress = nextTier ? (stats.vipPoints / nextTier.minPoints) * 100 : 100;

  const statCards = [
    { icon: Gamepad2, label: "Browse Games", value: "Play", href: "/#games" },
    { icon: Crown, label: "VIP Tier", value: currentTier?.name || "Bronze", href: "/dashboard/vip" },
    { icon: Users, label: "Referrals", value: stats.referralCount, href: "/dashboard/referrals" },
    { icon: Star, label: "Reviews", value: stats.reviewCount, href: "/dashboard/reviews" },
    { icon: Bell, label: "Unread Alerts", value: stats.notifCount },
  ];

  return (
    <div>
      <DashboardPageHeader
        title={`Welcome back, ${stats.fullName || "Player"}`}
        description="Here's your account overview"
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const inner = (
            <Card className={stat.href ? "hover:glow-purple transition-all cursor-pointer" : ""}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href} prefetch={false}>
              {inner}
            </Link>
          ) : (
            <div key={stat.label}>{inner}</div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-400" /> VIP Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <Badge>{currentTier?.name}</Badge>
              <span className="text-sm text-muted-foreground">{stats.vipPoints} points</span>
            </div>
            <Progress value={Math.min(progress, 100)} className="mb-2" />
            {nextTier && (
              <p className="text-xs text-muted-foreground">
                {nextTier.minPoints - stats.vipPoints} points to {nextTier.name}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/#games" prefetch={false}>
                Browse Games
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/referrals" prefetch={false}>
                Share Referral
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/messages" prefetch={false}>
                Open Messages
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/reviews" prefetch={false}>
                Write a Review
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <ReviewsPreviewClient />
    </div>
  );
}
