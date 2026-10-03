import type { Metadata } from "next";
import { format } from "date-fns";
import { UserPlus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb } from "@/lib/actions/admin/core";
import { profileDisplayName, profileHandle } from "@/lib/admin/spinora-profile";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Referrals" };

export default async function AdminReferralsPage() {
  await requirePermission("referrals.manage");
  const db = adminDb();

  const [countRes, recentRes] = await Promise.all([
    db.from("referrals").select("id", { count: "exact", head: true }),
    db
      .from("referrals")
      .select(
        "id, reward_points, created_at, referrer:profiles!referrals_referrer_id_fkey(email, full_name), referred:profiles!referrals_referred_id_fkey(email, full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const referrals = recentRes.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Referrals"
        description="Spinora referral signups and reward points."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Total referrals"
          value={(countRes.count ?? 0).toLocaleString()}
          icon={<UserPlus />}
          accent="cyan"
        />
        <StatCard
          label="Recent (shown)"
          value={referrals.length.toLocaleString()}
          icon={<UserPlus />}
          accent="purple"
        />
      </div>

      {referrals.length === 0 ? (
        <EmptyState
          icon={<UserPlus />}
          title="No referrals yet"
          description="Referral activity will appear here as members invite friends."
        />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-foreground/8 hover:bg-transparent">
                  <TableHead>Referrer → Referred</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((r) => {
                  const referrer = r.referrer as { email?: string | null; full_name?: string | null } | null;
                  const referred = r.referred as { email?: string | null; full_name?: string | null } | null;
                  return (
                    <TableRow key={r.id} className="border-foreground/8">
                      <TableCell>
                        <p className="text-sm font-medium">
                          {profileDisplayName(referrer ?? {})}{" "}
                          <span className="text-muted-foreground">→</span>{" "}
                          {profileDisplayName(referred ?? {})}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {profileHandle(referrer ?? {})} → {profileHandle(referred ?? {})}
                        </p>
                      </TableCell>
                      <TableCell className="tnum text-right">
                        {r.reward_points ?? 0}
                      </TableCell>
                      <TableCell className="tnum text-right text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, HH:mm")}
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
