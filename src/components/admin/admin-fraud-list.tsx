"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  blockUserFreeplay,
  clearUserFraudFlags,
  type AdminFraudRow,
} from "@/lib/actions/admin-fraud";
import { MessageCircle, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";

interface AdminFraudListProps {
  users: AdminFraudRow[];
}

export function AdminFraudList({ users }: AdminFraudListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q)
    );
  }, [users, query]);

  async function handleClear(userId: string) {
    if (!window.confirm("Clear fraud flags and restore this player? This is written to the audit log.")) return;
    setLoadingId(userId);
    const result = await clearUserFraudFlags(userId);
    setLoadingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("User restored — spin rewards enabled");
    router.refresh();
  }

  async function handleBlockFreeplay(userId: string) {
    if (!window.confirm("Block freeplay for this player? This is written to the audit log.")) return;
    setLoadingId(userId);
    const result = await blockUserFreeplay(userId);
    setLoadingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Freeplay blocked for this user");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8ea0c3]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone, or user id..."
          className="border-white/10 bg-[#0c1224] pl-9 text-white"
          aria-label="Search flagged players"
        />
      </div>

      <p className="text-sm text-[#9fb0d0]">
        {filtered.length} flagged player{filtered.length === 1 ? "" : "s"} in this view
      </p>

      {filtered.length === 0 ? (
        <AdminEmptyState
          title={users.length === 0 ? "No flagged players" : "No matches"}
          body={
            users.length === 0
              ? "Players appear here when the existing multi-account or freeplay rules flag them."
              : "Try another name, email, phone, or user id."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => {
            const busy = loadingId === user.user_id;
            return (
              <article key={user.user_id} className="rounded-2xl border border-[#7c3aed]/25 bg-gradient-to-br from-[#141432] to-[#0d1428] p-4 shadow-[0_16px_40px_rgba(49,46,129,0.2)]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">{user.full_name || "Unnamed"}</h3>
                        <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-[#d5def2]">
                          Risk {user.risk_score}
                        </span>
                        {user.rewards_blocked ? <AdminStatusBadge status="freeplay blocked" /> : null}
                        {user.blocked ? <AdminStatusBadge status="blocked" /> : null}
                        {user.manual_review ? <AdminStatusBadge status="manual review" /> : null}
                        {user.is_suspended ? <AdminStatusBadge status="suspended" /> : null}
                      </div>
                      <p className="break-all text-sm text-[#9fb0d0]">{user.email}</p>
                      {user.phone ? <p className="text-sm text-[#9fb0d0]">{user.phone}</p> : null}
                      <p className="mt-2 text-xs text-[#8ea0c3]">
                        Signup IP {user.signupIp} · Last seen IP {user.lastSeenIp}
                      </p>
                      <p className="mt-1 text-xs text-[#8ea0c3]">
                        Risk score {user.risk_score}
                        {user.flags.length ? ` · ${user.flags.join(", ")}` : ""}
                      </p>
                      <p className="mt-2 text-xs text-[#8ea0c3]">
                        Joined {formatDate(user.created_at)} · {user.device_count} linked device
                        {user.device_count === 1 ? "" : "s"} · Updated {formatDate(user.last_calculated_at)}
                      </p>
                      {user.flags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {user.flags.map((flag) => (
                            <span key={flag} className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#d5def2]">
                              {flag.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild className="gap-1.5 border-white/15 text-[#e8eefc]">
                        <Link href={`/admin/chat?userId=${user.user_id}`}>
                          <MessageCircle className="h-4 w-4" />
                          Message
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white"
                        disabled={busy}
                        onClick={() => handleClear(user.user_id)}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Restore access
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => handleBlockFreeplay(user.user_id)}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Block freeplay
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
