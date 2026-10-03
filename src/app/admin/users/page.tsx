import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Ban, Search } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb } from "@/lib/actions/admin/core";
import {
  ADMIN_PROFILE_SELECT,
  profileDisplayName,
  profileHandle,
  profileIsBanned,
  profileNum,
} from "@/lib/admin/spinora-profile";
import { requirePermission } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requirePermission("users.manage");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const db = adminDb();
  let query = db.from("profiles").select(ADMIN_PROFILE_SELECT, { count: "exact" });

  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const users = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Users"
        description={`${total.toLocaleString()} members registered.`}
      />

      <form className="mb-4 flex gap-2" action="/admin/users">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by email or name…"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-foreground/8 hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Level</TableHead>
                <TableHead className="text-right">Coins</TableHead>
                <TableHead className="text-right">Wallet</TableHead>
                <TableHead className="text-right">Cash-out</TableHead>
                <TableHead className="text-right">Joined</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No members match “{q}”.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className="border-foreground/8">
                    <TableCell>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="font-medium hover:text-ws-green-deep dark:text-ws-green"
                      >
                        {profileDisplayName(u)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{profileHandle(u)}</p>
                    </TableCell>
                    <TableCell className="tnum text-right">{profileNum(u.level, 1)}</TableCell>
                    <TableCell className="tnum text-right text-ws-green-deep dark:text-ws-green">
                      {profileNum(u.coins_balance).toLocaleString()}
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold text-ws-gold-deep dark:text-ws-gold">
                      ${profileNum(u.wallet_balance).toFixed(2)}
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold text-ws-emerald">
                      ${profileNum(u.cashout_wallet).toFixed(2)}
                    </TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      {u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {profileIsBanned(u) ? (
                        <Badge className="bg-ws-danger/15 text-ws-danger">
                          <Ban className="size-3" aria-hidden />
                          Suspended
                        </Badge>
                      ) : (
                        <Badge className="bg-ws-emerald/15 text-ws-emerald">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(page <= 1 && "pointer-events-none opacity-50")}
          >
            <Link href={`/admin/users?q=${encodeURIComponent(q)}&page=${page - 1}`}>
              Previous
            </Link>
          </Button>
          <p className="tnum text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(page >= totalPages && "pointer-events-none opacity-50")}
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
