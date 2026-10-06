"use client";

import Link from "next/link";
import { X, Radio, Wallet } from "lucide-react";

import { GameLoadActions } from "@/components/admin/game-load-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";
import type { GameLoadStatus } from "@/lib/game-automation/types";
import type {
  AdminGameLoadRow,
  AdminGameLoadUser,
} from "@/components/admin/admin-wallet-loads-panels";

const statusVariant: Record<GameLoadStatus, "default" | "warning" | "success" | "destructive"> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  failed: "destructive",
  cancelled: "destructive",
};

function loadSummary(load: AdminGameLoadRow): string {
  if (load.load_type === "redeem") {
    if (load.redeem_all) {
      return `Redeem all → ${load.wallet_type === "bonus" ? "Bonus Redeem" : "Deposit Redeem"}`;
    }
    return `$${Number(load.amount).toFixed(2)} redeem`;
  }
  return `$${Number(load.amount).toFixed(2)} load to ${load.game_name}`;
}

function LoadEntry({ load, compact }: { load: AdminGameLoadRow; compact?: boolean }) {
  const isRedeem = load.load_type === "redeem";

  return (
    <div className="border-b border-white/[0.06] py-3 last:border-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-white">{load.game_name}</span>
            <Badge variant={statusVariant[load.status]} className="text-[10px]">
              {load.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {isRedeem ? "redeem" : "load"}
            </Badge>
          </div>
          <p
            className={cn(
              "text-sm font-bold",
              isRedeem ? "text-sky-400" : "text-emerald-400"
            )}
          >
            {loadSummary(load)}
          </p>
          {load.game_username && (
            <p className="mt-1 text-xs text-slate-400">Game login: {load.game_username}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">
            {formatDate(load.created_at)} · {formatRelativeTime(load.created_at)}
          </p>
          {!compact && load.error_message && (
            <p className="mt-1 text-xs text-red-400">{load.error_message}</p>
          )}
        </div>
        <GameLoadActions load={load} />
      </div>
    </div>
  );
}

interface AdminWalletLoadsSidebarPanelProps {
  user: AdminGameLoadUser;
  loads: AdminGameLoadRow[];
  open: boolean;
  live?: boolean;
  onClose: () => void;
}

export function AdminWalletLoadsSidebarPanel({
  user,
  loads,
  open,
  live,
  onClose,
}: AdminWalletLoadsSidebarPanelProps) {
  const displayName = user.full_name || user.email;
  const pending = loads.filter((l) => l.status === "pending" || l.status === "processing");
  const completed = loads.filter((l) => l.status === "completed");

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full max-w-lg flex-col border-r border-violet-400/25 bg-[#0b0c1b] shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!open}
        aria-label={`Loads for ${displayName}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-500/20 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/70">
              Deposit loads
            </p>
            <h2 className="truncate text-lg font-bold text-white">{displayName}</h2>
            <p className="truncate text-sm text-slate-400">{user.email}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-white"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3 text-sm">
          <div className="flex gap-4">
            <span>
              Wallet{" "}
              <strong className="text-emerald-300">
                ${Number(user.wallet_balance ?? 0).toLocaleString()}
              </strong>
            </span>
            <span>
              Loads{" "}
              <strong className="text-white">{loads.length}</strong>
              {pending.length > 0 && (
                <strong className="ml-1 text-amber-400">({pending.length} pending)</strong>
              )}
            </span>
          </div>
          {live && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {pending.length > 0 && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-300">
                Needs action ({pending.length})
              </p>
              <div className="space-y-1">
                {pending.map((load) => <LoadEntry key={load.id} load={load} compact />)}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-violet-400/20 bg-[rgba(18,14,34,0.72)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-white">All loads & redeems</h3>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {completed.length} completed
              </Badge>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {loads.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No deposit wallet loads or redeems yet.
                </p>
              ) : (
                loads.map((load) => <LoadEntry key={load.id} load={load} />)
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-violet-500/20 px-5 py-4">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/admin/transactions?userId=${user.id}`}>View transactions</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/admin/users?userId=${user.id}`}>Open user panel</Link>
          </Button>
        </div>
      </aside>
    </>
  );
}
