import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatNepalTime } from "@/lib/admin/nepal-time";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { TierBadge } from "@/components/shared/tier-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminDb } from "@/lib/actions/admin/core";
import {
  profileDisplayName,
  profileHandle,
  profileInitials,
  profileIsBanned,
  profileNum,
  type ProfileRow,
} from "@/lib/admin/spinora-profile";
import { assertCanSeePlayer } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";
import { platformTicketAccess } from "@/lib/support/ticket-access";
import { listPlayerTickets } from "@/lib/support/ticket-store";
import type { VipTierKey } from "@/lib/database.types";

export const metadata: Metadata = { title: "Player" };

const CATEGORY_LABEL: Record<string, string> = {
  account: "Account", rewards: "Rewards", vip: "VIP",
  referrals: "Referrals", technical: "Technical", other: "Other",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await assertCanSeePlayer(id);
  const ctx = await getStaffContext();
  const ticketAccess = await platformTicketAccess();
  const db = adminDb();

  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();
  const p = profile as ProfileRow;

  const { data: authUser } = await db.auth.admin.getUserById(id);
  const email = authUser?.user?.email ?? p.email ?? null;

  const [rolesRes, userRolesRes, vipRes, ledgerRes, spinoraDepositsRes, winDepositsRes] = await Promise.all([
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
  ]);
  const ticketsRes = ticketAccess.tickets
    ? { data: await listPlayerTickets(id) }
    : { data: [] };

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

  const canManageRoles = Boolean(ctx && scope.level === "platform" && can(ctx, "users.roles"));
  const canDelete = Boolean(ctx && scope.level === "platform" && can(ctx, "users.delete"));
  const parentId = (p as ProfileRow & { parent_agent_id?: string | null }).parent_agent_id ?? null;
  const { data: parentProfile } = parentId
    ? await db.from("profiles").select("full_name, email").eq("id", parentId).maybeSingle()
    : { data: null };
  const parentName =
    (parentProfile as { full_name?: string | null; email?: string | null } | null)?.full_name?.trim() ||
    (parentProfile as { email?: string | null } | null)?.email ||
    (parentId ? "Agent" : "Unassigned");

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={scope.level === "platform" ? "/admin/users" : "/admin/players"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#9fb0d0] transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {scope.level === "platform" ? "All players" : "Network players"}
      </Link>

      <AdminPageHeader
        title={profileDisplayName(p)}
        description={`${profileHandle(p)}${email ? ` · ${email}` : ""} · Assigned store or sub-creator: ${parentName} · Joined ${formatNepalTime(p.created_at)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <AdminStatusBadge status={profileIsBanned(p) ? "Banned" : "Active"} />
            {p.is_suspended ? <AdminStatusBadge status="Suspended" /> : null}
            <AdminStatusBadge status={(p as ProfileRow & { kyc_status?: string | null }).kyc_status || "Not on file"} />
          </div>
        }
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0">
          <TabsTrigger value="profile" className="h-9 flex-none rounded-full border border-white/10 px-3 text-[#9fb0d0] data-[state=active]:border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#6d28d9] data-[state=active]:to-[#2563eb] data-[state=active]:text-white">Profile</TabsTrigger>
          <TabsTrigger value="ledger" className="h-9 flex-none rounded-full border border-white/10 px-3 text-[#9fb0d0] data-[state=active]:border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#6d28d9] data-[state=active]:to-[#2563eb] data-[state=active]:text-white">
            Coin ledger
            {ledger.length > 0 && (
              <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
                {ledger.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="deposits" className="h-9 flex-none rounded-full border border-white/10 px-3 text-[#9fb0d0] data-[state=active]:border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#6d28d9] data-[state=active]:to-[#2563eb] data-[state=active]:text-white">
            Deposits and games
            {spinoraDeposits.length + deposits.length > 0 && (
              <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
                {spinoraDeposits.length + deposits.length}
              </span>
            )}
          </TabsTrigger>
          {ticketAccess.tickets ? (
            <TabsTrigger value="support" className="h-9 flex-none rounded-full border border-white/10 px-3 text-[#9fb0d0] data-[state=active]:border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#6d28d9] data-[state=active]:to-[#2563eb] data-[state=active]:text-white">
              Support
              {tickets.length > 0 && (
                <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
                  {tickets.length}
                </span>
              )}
            </TabsTrigger>
          ) : null}
        </TabsList>

        {/* ── Profile tab ── */}
        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <AdminSectionCard
                title="Account details"
                description="Read-only. These values come from the player record. They do not change until an action on the right is used."
              >
                <div className="flex items-center gap-4">
                  <Avatar className="size-16">
                    <AvatarImage src={p.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-[#1a2450] text-lg font-bold text-white">
                      {profileInitials(p)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-wrap items-center gap-2">
                    {vipTier && <TierBadge tier={vipTier} />}
                    {userRoleKeys
                      .filter((k) => k !== "customer")
                      .map((k) => (
                        <AdminStatusBadge key={k} status={k.replaceAll("_", " ")} />
                      ))}
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: "Level", value: profileNum(p.level, 1).toLocaleString() },
                    { label: "Total XP", value: profileNum(p.xp).toLocaleString() },
                    { label: "Coins", value: profileNum(p.coins_balance).toLocaleString() },
                    { label: "Streak", value: `${profileNum(p.current_streak)} days` },
                    { label: "Play wallet", value: `$${profileNum(p.wallet_balance).toFixed(2)}` },
                    { label: "Cash-out wallet", value: `$${profileNum(p.cashout_wallet).toFixed(2)}` },
                    { label: "Identity status", value: (p as ProfileRow & { kyc_status?: string | null }).kyc_status || "Not on file" },
                    { label: "Assigned store or sub-creator", value: parentName },
                  ].map((s) => (
                    <div key={s.label}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-[#8ea0c3]">{s.label}</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{s.value}</dd>
                    </div>
                  ))}
                </dl>

                {p.referral_code ? (
                  <p className="mt-4 text-xs text-[#9fb0d0]">
                    Referral code: <span className="font-semibold text-white">{p.referral_code}</span>
                  </p>
                ) : null}
              </AdminSectionCard>

              <AdminSectionCard
                title="Recent coin activity"
                description="The latest 10 coin and XP rows. The Coin ledger tab has the longer list. This view does not change a balance."
              >
                {ledger.length === 0 ? (
                  <AdminEmptyState title="No coin activity yet" body="Coin and XP rows will show here after this player earns or spends them." />
                ) : (
                  <ul className="divide-y divide-white/10">
                    {ledger.slice(0, 10).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{e.description || e.entry_type}</p>
                          <p className="text-xs text-[#9fb0d0]">
                            {formatNepalTime(e.created_at)}
                          </p>
                        </div>
                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${e.amount >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                          {e.amount >= 0 ? "+" : ""}
                          {e.amount.toLocaleString()}
                          <span className="ml-1 text-[10px] uppercase text-[#8ea0c3]">{e.currency}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminSectionCard>
            </div>

            {scope.level === "sub" ? (
              <AdminSectionCard title="View only" description="You can read this player's details. Account changes stay with platform staff.">
                <p className="text-sm text-[#9fb0d0]">No balance, role, ban, or delete actions are shown for this login.</p>
              </AdminSectionCard>
            ) : (
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
            )}
          </div>
        </TabsContent>

        {/* ── Coin Ledger tab ── */}
        <TabsContent value="ledger">
          <AdminSectionCard title="Coin and XP ledger" description={`Read-only. Showing the last ${ledger.length} stored entries.`}>
            {ledger.length === 0 ? (
              <AdminEmptyState title="No ledger entries yet" body="Coin and XP history will appear after this player has activity." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#8ea0c3]">
                      <th className="px-2 py-2 font-medium">Date</th>
                      <th className="px-2 py-2 font-medium">Description</th>
                      <th className="px-2 py-2 font-medium">Type</th>
                      <th className="px-2 py-2 text-right font-medium">Amount</th>
                      <th className="px-2 py-2 text-right font-medium">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e) => (
                      <tr key={e.id} className="border-b border-white/5 last:border-0">
                        <td className="whitespace-nowrap px-2 py-3 text-xs text-[#9fb0d0]">
                          {formatNepalTime(e.created_at)}
                        </td>
                        <td className="max-w-xs truncate px-2 py-3 text-[#e8eefc]">
                          {e.description || e.entry_type}
                        </td>
                        <td className="px-2 py-3">
                          <AdminStatusBadge status={e.entry_type.replace(/_/g, " ")} />
                        </td>
                        <td className={`px-2 py-3 text-right font-semibold tabular-nums ${e.amount >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                          {e.amount >= 0 ? "+" : ""}
                          {e.amount.toLocaleString()}
                        </td>
                        <td className="px-2 py-3 text-right text-[10px] uppercase text-[#8ea0c3]">
                          {e.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSectionCard>
        </TabsContent>

        {/* ── Deposits tab ── */}
        <TabsContent value="deposits">
          <AdminSectionCard
            title="Deposits and game requests"
            description="Read-only history already stored for this player. This tab does not approve, load, or refund anything."
          >
          {spinoraDeposits.length === 0 && deposits.length === 0 ? (
            <AdminEmptyState title="No deposit or game requests" body="Completed and pending requests for this player will show here." />
          ) : (
            <div className="space-y-3">
              {spinoraDeposits.map((dep) => (
                <div key={dep.id} className="rounded-xl border border-white/10 bg-[#0b1224] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{dep.game_name}</span>
                        <AdminStatusBadge status={dep.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#9fb0d0]">
                        <span className="font-semibold text-white">${Number(dep.amount ?? 0).toFixed(2)}</span>
                        <span className="capitalize">{dep.payment_method}</span>
                      </div>
                    </div>
                    <p className="text-right text-xs text-[#9fb0d0]">{formatNepalTime(dep.created_at)}</p>
                  </div>
                </div>
              ))}
              {deposits.map((dep) => (
                <div key={dep.id} className="rounded-xl border border-white/10 bg-[#0b1224] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-cyan-200">{dep.reference_code}</span>
                        <AdminStatusBadge status={dep.status} />
                        {dep.games?.name ? <AdminStatusBadge status={dep.games.name} /> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#9fb0d0]">
                        <span>{dep.request_type === "new_account" ? "New account" : "Reload"}</span>
                        <span className="font-semibold text-white">${dep.deposit_amount.toFixed(2)}</span>
                        <span className="capitalize">{dep.payment_method}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[#9fb0d0]">
                      <p>{formatNepalTime(dep.created_at)}</p>
                      {dep.resolved_at ? <p className="text-emerald-200">Fulfilled {formatNepalTime(dep.resolved_at)}</p> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </AdminSectionCard>
        </TabsContent>

        {/* ── Support History tab ── */}
        {ticketAccess.tickets ? <TabsContent value="support">
          <AdminSectionCard title="Support tickets" description="Read-only list. Open a ticket to reply. Store and sub logins do not see this tab.">
          {tickets.length === 0 ? (
            <AdminEmptyState title="No support tickets" body="Tickets this player sends to Super Admin will show here." />
          ) : (
            <ul className="divide-y divide-white/10">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/support/${t.id}`}
                    className="flex items-center gap-4 py-4 transition-colors hover:text-cyan-200"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-[#9fb0d0]">
                        <span>#{t.ticket_no}</span>
                        <span>{CATEGORY_LABEL[t.category] ?? t.category}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold text-white">{t.subject}</p>
                      <p className="text-xs text-[#8ea0c3]">{formatNepalTime(t.last_message_at)}</p>
                    </div>
                    <AdminStatusBadge status={t.status.replaceAll("_", " ")} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          </AdminSectionCard>
        </TabsContent> : null}
      </Tabs>
    </div>
  );
}
