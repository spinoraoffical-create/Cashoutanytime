import type { Metadata } from "next";
import Link from "next/link";
import { formatNepalTime } from "@/lib/admin/nepal-time";
import { Search } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminDataTable } from "@/components/admin/ui/admin-data-table";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminDb } from "@/lib/actions/admin/core";
import { authPhonesFor, shownPhone } from "@/lib/admin/member-phone";
import {
  ADMIN_PROFILE_SELECT,
  missingProfileColumn,
  profileDisplayName,
  profileHandle,
  profileIsBanned,
  profileNum,
  type ProfileRow,
} from "@/lib/admin/spinora-profile";
import { TestAccountForm } from "@/components/admin/test-account-form";
import { getStaffContext, requirePermission } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "All players" };

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requirePermission("users.manage");
  const staff = await getStaffContext();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const db = adminDb();
  const fields = [
    ...new Set(
      `${ADMIN_PROFILE_SELECT}, phone`
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    ),
  ];
  let users: (ProfileRow & { phone?: string | null })[] = [];
  let total = 0;
  let loaded = false;

  for (let attempt = 0; attempt < fields.length; attempt += 1) {
    let query = db.from("profiles").select(fields.join(", "), { count: "exact" });
    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
    if (!error) {
      users = (data ?? []) as typeof users;
      total = count ?? users.length;
      loaded = true;
      break;
    }
    const column = missingProfileColumn(error.message);
    if (column && fields.includes(column) && column !== "id") {
      fields.splice(fields.indexOf(column), 1);
      continue;
    }
    break;
  }

  if (!loaded) {
    const safe = ["id", "email", "full_name", "created_at", "is_suspended", "wallet_balance", "cashout_wallet", "coins_balance", "phone"];
    for (let attempt = 0; attempt < safe.length; attempt += 1) {
      let query = db.from("profiles").select(safe.join(", "), { count: "exact" });
      if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
      const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
      if (!error) {
        users = (data ?? []) as typeof users;
        total = count ?? users.length;
        loaded = true;
        break;
      }
      const column = missingProfileColumn(error.message);
      if (column && safe.includes(column) && column !== "id") {
        safe.splice(safe.indexOf(column), 1);
        continue;
      }
      break;
    }
  }

  if (!loaded) {
    let probe = db.from("profiles").select("id", { count: "exact", head: true });
    if (q) probe = probe.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    const { count } = await probe;
    total = count ?? 0;
  }

  if (total === 0 && users.length > 0) total = users.length;

  const phones = await authPhonesFor(
    db,
    users.filter((user) => !user.phone?.trim()).map((user) => user.id ?? "").filter(Boolean)
  );
  const rows = users.map((user) => ({
    ...user,
    phoneLabel: shownPhone(user.phone, phones.get(user.id ?? "")),
  }));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="All players"
        description="Search by name or email, then open a player. Balances on this list are read-only."
      />

      {staff?.isSuperAdmin ? <TestAccountForm /> : null}

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/admin/users">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8ea0c3]"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name or email"
            className="border-white/10 bg-[#0b1224] pl-9 text-white placeholder:text-[#8ea0c3]"
            aria-label="Search players"
          />
        </div>
        <Button type="submit" variant="outline" className="border-white/15 bg-transparent text-white">
          Search
        </Button>
      </form>

      {!loaded ? (
        <AdminErrorState title="Player list unavailable" body="The player list could not be loaded. Try the search again." />
      ) : (
        <AdminSectionCard
          title="Player records"
          description={`${total.toLocaleString()} players match this view. Open a name to see the profile.`}
        >
          <AdminDataTable
            columns={[
              { key: "member", label: "Player" },
              { key: "level", label: "Level", align: "right" },
              { key: "coins", label: "Coins", align: "right" },
              { key: "wallet", label: "Play wallet", align: "right" },
              { key: "cashout", label: "Cash-out wallet", align: "right" },
              { key: "joined", label: "Joined", align: "right" },
              { key: "status", label: "Status", align: "right" },
            ]}
            rows={rows.map((u) => ({
              member: (
                <div>
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-white hover:text-cyan-200">
                    {profileDisplayName(u)}
                  </Link>
                  <p className="text-xs text-[#9fb0d0]">
                    {profileHandle(u)}
                    {" · "}
                    {u.phoneLabel}
                  </p>
                </div>
              ),
              level: profileNum(u.level, 1),
              coins: profileNum(u.coins_balance).toLocaleString(),
              wallet: `$${profileNum(u.wallet_balance).toFixed(2)}`,
              cashout: `$${profileNum(u.cashout_wallet).toFixed(2)}`,
              joined: u.created_at ? formatNepalTime(u.created_at) : "—",
              status: <AdminStatusBadge status={profileIsBanned(u) ? "Suspended" : "Active"} />,
            }))}
            emptyTitle={q ? "No matching players" : "No players yet"}
            emptyBody={q ? "Try a different name or email." : "Players appear here after they create an account."}
          />
        </AdminSectionCard>
      )}

      {loaded && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("border-white/15 bg-transparent text-white", page <= 1 && "pointer-events-none opacity-50")}
          >
            <Link href={`/admin/users?q=${encodeURIComponent(q)}&page=${page - 1}`}>
              Previous
            </Link>
          </Button>
          <p className="text-sm tabular-nums text-[#9fb0d0]">
            Page {page} of {totalPages}
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("border-white/15 bg-transparent text-white", page >= totalPages && "pointer-events-none opacity-50")}
          >
            <Link href={`/admin/users?q=${encodeURIComponent(q)}&page=${page + 1}`}>
              Next
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
