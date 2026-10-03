import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Ban } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { GlassCard } from "@/components/shared/glass-card";
import { TierBadge } from "@/components/shared/tier-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminDb } from "@/lib/actions/admin/core";
import {
  profileDisplayName,
  profileHandle,
  profileInitials,
  profileIsBanned,
  profileNum,
  type SpinoraProfileRow,
} from "@/lib/admin/spinora-profile";
import { requirePermission, can } from "@/lib/data/admin";
import type { VipTierKey } from "@/lib/database.types";

export const metadata: Metadata = { title: "Member" };

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-ws-green/15 text-ws-green-deep dark:text-ws-green",
  contacted: "bg-blue-500/15 text-blue-400",
  fulfilled: "bg-ws-emerald/15 text-ws-emerald",
  rejected:  "bg-red-500/15 text-red-400",
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  daily_claim:  "bg-ws-emerald/15 text-ws-emerald",
  referral:     "bg-ws-purple/15 text-ws-purple",
  promotion:    "bg-ws-green/15 text-ws-green-deep dark:text-ws-green",
  achievement:  "bg-blue-500/15 text-blue-400",
  admin_grant:  "bg-ws-cyan/15 text-ws-cyan",
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  open:        "bg-ws-emerald/15 text-ws-emerald",
  in_progress: "bg-blue-500/15 text-blue-400",
  pending:     "bg-ws-green/15 text-ws-green-deep dark:text-ws-green",
  resolved:    "bg-foreground/10 text-muted-foreground",
  closed:      "bg-foreground/8 text-muted-foreground",
};

const CATEGORY_LABEL: Record<string, string> = {
  account: "Account", rewards: "Rewards", vip: "VIP",
  referrals: "Referrals", technical: "Technical", other: "Other",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePermission("users.manage");
  const { id } = await params;
  const db = adminDb();

  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();
  const p = profile as SpinoraProfileRow;

  const { data: authUser } = await db.auth.admin.getUserById(id);
  const email = authUser?.user?.email ?? p.email ?? null;

  const [rolesRes, userRolesRes, vipRes, ledgerRes, spinoraDepositsRes, winDepositsRes, ticketsRes] = await Promise.all([
    db.from("roles").select("key, name").order("key"),
    db.from("user_roles").select("roles(key)").eq("user_id", id),
    db.from("vip_status").select("vip_tiers(key, name)").eq("user_id", id).maybeSingle(),
    db
      .from("ledger_entries")
      .select("id, currency, amount, entry_type, description, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("deposit_requests")
      .select("id, game_name, payment_method, amount, status, created_at, reviewed_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("requests")
      .select("id, reference_code, request_type, deposit_amount, payment_method, status, created_at, resolved_at, games(name)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("support_tickets")
      .select("id, ticket_no, subject, category, status, last_message_at, created_at")
      .eq("user_id", id)
      .order("last_message_at", { ascending: false }),
  ]);

  const allRoles = rolesRes.data ?? [];
  const userRoleKeys = (userRolesRes.data ?? [])
    .map((r) => (r.roles as unknown as { key: string } | null)?.key)
    .filter((k): k is string => Boolean(k));
  const vipTier = (vipRes.data?.vip_tiers as unknown as { key: VipTierKey } | null)?.key;
  const ledger = ledgerRes.data ?? [];
  const spinoraDeposits = spinoraDepositsRes.data ?? [];
  const deposits = (winDepositsRes.data ?? []) as unknown as Array<{
    id: string; reference_code: string; request_type: string;
    deposit_amount: number; payment_method: string; status: string;
    created_at: string; resolved_at: string | null;
    games: { name: string } | null;
  }>;
  const tickets = ticketsRes.data ?? [];

  const canManageRoles = can(ctx, "users.roles");
  const canDelete = can(ctx, "users.delete");

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All users
      </Link>

      <AdminPageHeader
        title={profileDisplayName(p)}
        description={`${profileHandle(p)}${email ? ` · ${email}` : ""} · joined ${format(new Date(p.created_at!), "MMMM d, yyyy")}`}
        action={
          profileIsBanned(p) ? (
            <Badge className="bg-ws-danger/15 text-ws-danger">
              <Ban className="size-3" aria-hidden />
              Banned
            </Badge>
          ) : (
            <Badge className="bg-ws-emerald/15 text-ws-emerald">Active</Badge>
          )
        }
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ledger">
            Coin Ledger
            {ledger.length > 0 && (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold">
                {ledger.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="deposits">
            Deposits
            {deposits.length > 0 && (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold">
                {deposits.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="support">
            Support
            {tickets.length > 0 && (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold">
                {tickets.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Profile tab ── */}
        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Avatar + stats */}
              <GlassCard className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="size-16">
                    <AvatarImage src={p.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-ws-surface-3 text-lg font-bold">
                      {profileInitials(p)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-wrap items-center gap-2">
                    {vipTier && <TierBadge tier={vipTier} />}
                    {userRoleKeys
                      .filter((k) => k !== "customer")
                      .map((k) => (
                        <Badge key={k} className="bg-ws-purple/15 text-ws-purple uppercase">
                          {k.replace("_", " ")}
                        </Badge>
                      ))}
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: "Level",    value: profileNum(p.level, 1).toLocaleString() },
                    { label: "Total XP", value: profileNum(p.xp).toLocaleString() },
                    { label: "Coins",    value: profileNum(p.coins_balance).toLocaleString() },
                    { label: "Streak",   value: `${profileNum(p.current_streak)}d` },
                    {
                      label: "Wallet",
                      value: `$${profileNum(p.wallet_balance).toFixed(2)}`,
                      accent: "text-ws-gold-deep dark:text-ws-gold",
                    },
                    {
                      label: "Cash-out",
                      value: `$${profileNum(p.cashout_wallet).toFixed(2)}`,
                      accent: "text-ws-emerald",
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <dt className="hud-label text-muted-foreground">{s.label}</dt>
                      <dd className={`tnum mt-1 text-lg font-bold ${s.accent ?? ""}`}>{s.value}</dd>
                    </div>
                  ))}
                </dl>

                {p.referral_code && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Referral code:{" "}
                    <span className="tnum font-semibold text-foreground">
                      {p.referral_code}
                    </span>
                  </p>
                )}
              </GlassCard>

              {/* Recent ledger preview */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Recent ledger</h3>
                  <button
                    className="text-xs font-medium text-ws-cyan underline-offset-4 hover:underline"
                    onClick={undefined}
                    data-tab-target="ledger"
                  >
                    View all →
                  </button>
                </div>
                <ul className="mt-4 divide-y divide-foreground/8">
                  {ledger.length === 0 ? (
                    <li className="py-3 text-sm text-muted-foreground">No ledger entries yet.</li>
                  ) : (
                    ledger.slice(0, 10).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{e.description || e.entry_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(e.created_at), "MMM d, HH:mm")}
                          </p>
                        </div>
                        <span
                          className={`tnum shrink-0 text-sm font-semibold ${
                            e.amount >= 0 ? "text-ws-emerald" : "text-ws-danger"
                          }`}
                        >
                          {e.amount >= 0 ? "+" : ""}
                          {e.amount.toLocaleString()}
                          <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                            {e.currency}
                          </span>
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </GlassCard>
            </div>

            <UserManagementPanel
              userId={id}
              isBanned={profileIsBanned(p)}
              walletBalance={profileNum(p.wallet_balance)}
              cashoutWallet={profileNum(p.cashout_wallet)}
              coinsBalance={profileNum(p.coins_balance)}
              allRoles={allRoles}
              userRoleKeys={userRoleKeys}
              canManageRoles={canManageRoles}
              canDelete={canDelete}
            />
          </div>
        </TabsContent>

        {/* ── Coin Ledger tab ── */}
        <TabsContent value="ledger">
          <GlassCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-foreground/8 px-6 py-4">
              <h3 className="font-bold">Coin &amp; XP Ledger</h3>
              <p className="text-xs text-muted-foreground">
                Showing last {ledger.length} entries
              </p>
            </div>
            {ledger.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">No ledger entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-foreground/8 text-xs text-muted-foreground">
                      <th className="px-6 py-3 text-left font-medium">Date</th>
                      <th className="px-6 py-3 text-left font-medium">Description</th>
                      <th className="px-6 py-3 text-left font-medium">Type</th>
                      <th className="px-6 py-3 text-right font-medium">Amount</th>
                      <th className="px-6 py-3 text-right font-medium">Currency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/8">
                    {ledger.map((e) => (
                      <tr key={e.id} className="hover:bg-foreground/[0.02]">
                        <td className="tnum whitespace-nowrap px-6 py-3 text-xs text-muted-foreground">
                          {format(new Date(e.created_at), "MMM d, yyyy HH:mm")}
                        </td>
                        <td className="max-w-xs truncate px-6 py-3">
                          {e.description || e.entry_type}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ENTRY_TYPE_COLORS[e.entry_type] ?? "bg-foreground/10 text-muted-foreground"}`}>
                            {e.entry_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className={`tnum px-6 py-3 text-right font-semibold ${e.amount >= 0 ? "text-ws-emerald" : "text-ws-danger"}`}>
                          {e.amount >= 0 ? "+" : ""}
                          {e.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-[10px] uppercase text-muted-foreground">
                          {e.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </TabsContent>

        {/* ── Deposits tab ── */}
        <TabsContent value="deposits">
          {spinoraDeposits.length === 0 && deposits.length === 0 ? (
            <GlassCard className="py-10 text-center text-sm text-muted-foreground">
              No deposit requests found for this player.
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {spinoraDeposits.map((dep) => (
                <GlassCard key={dep.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{dep.game_name}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[dep.status] ?? "bg-foreground/10 text-muted-foreground"}`}>
                          {dep.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          ${Number(dep.amount ?? 0).toFixed(2)}
                        </span>
                        <span className="capitalize">{dep.payment_method}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{format(new Date(dep.created_at), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
              {deposits.map((dep) => (
                <GlassCard key={dep.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tnum font-mono text-sm font-bold text-ws-green-deep dark:text-ws-green">
                          {dep.reference_code}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[dep.status] ?? "bg-foreground/10 text-muted-foreground"}`}>
                          {dep.status}
                        </span>
                        {dep.games?.name && (
                          <span className="rounded-full border border-ws-green/20 bg-ws-green/10 px-2.5 py-0.5 text-[11px] font-medium text-ws-green-deep dark:text-ws-green">
                            {dep.games.name}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{dep.request_type === "new_account" ? "New Account" : "Reload"}</span>
                        <span className="font-semibold text-foreground">
                          ${dep.deposit_amount.toFixed(2)}
                        </span>
                        <span className="capitalize">{dep.payment_method}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{format(new Date(dep.created_at), "MMM d, yyyy")}</p>
                      {dep.resolved_at && (
                        <p className="text-ws-emerald">
                          Fulfilled {format(new Date(dep.resolved_at), "MMM d")}
                        </p>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Support History tab ── */}
        <TabsContent value="support">
          {tickets.length === 0 ? (
            <GlassCard className="py-10 text-center text-sm text-muted-foreground">
              No support tickets found for this player.
            </GlassCard>
          ) : (
            <GlassCard className="overflow-hidden">
              <ul className="divide-y divide-foreground/8">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/support/${t.id}`}
                      className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-foreground/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="tnum text-xs text-muted-foreground">
                            #{t.ticket_no}
                          </span>
                          <span className="text-xs text-ws-text-faint">
                            {CATEGORY_LABEL[t.category] ?? t.category}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-semibold">
                          {t.subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.last_message_at), "MMM d, yyyy HH:mm")}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TICKET_STATUS_COLORS[t.status] ?? "bg-foreground/10 text-muted-foreground"}`}>
                        {t.status.replace("_", " ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
